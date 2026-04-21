<?php
/**
 * PHP proxy endpoint for the AI Assistant chat.
 *
 * Handles two routes (defined in routes.json):
 *   POST /api/v1/AiAssistant/chat        → process()
 *   POST /api/v1/AiAssistant/chat/upload  → processUpload()
 *
 * The EspoCRM framework authenticates the user before this code runs.
 * This endpoint extracts the user's API key, forwards the request to
 * the AI Backend at http://ai-backend:3001, and returns the response.
 */

namespace Espo\Modules\AiAssistant\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Error;
use Espo\Core\Utils\Config;
use Espo\Entities\User;
use Espo\ORM\EntityManager;

class PostChat implements Action
{
    /** Default AI Backend URL (Docker internal network). */
    private const DEFAULT_BACKEND_URL = 'http://ai-backend:3001';

    /** cURL timeout for AI Backend requests in seconds. */
    private const REQUEST_TIMEOUT = 65;

    /** cURL connection timeout in seconds. */
    private const CONNECT_TIMEOUT = 5;

    public function __construct(
        private User $user,
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    /**
     * Handle POST /api/v1/AiAssistant/chat
     *
     * Forwards the user's chat message to the AI Backend along with
     * the user's API key for permission-scoped CRM operations.
     */
    public function process(Request $request): Response
    {
        $body = $request->getParsedBody();

        $message = $body->message ?? null;

        if (!is_string($message) || trim($message) === '') {
            throw new BadRequest('Message is required and must be a non-empty string.');
        }

        $apiKey = $this->getUserApiKey();

        $payload = [
            'message'    => trim($message),
            'userApiKey' => $apiKey,
            'userId'     => $this->user->getId(),
            'userName'   => $this->user->getName(),
        ];

        // Forward optional fields if present.
        if (isset($body->model) && is_string($body->model) && $body->model !== '') {
            $payload['model'] = $body->model;
        }

        if (isset($body->sessionId) && is_string($body->sessionId) && $body->sessionId !== '') {
            $payload['sessionId'] = $body->sessionId;
        }

        $backendUrl = $this->getBackendUrl() . '/chat';

        $result = $this->postJson($backendUrl, $payload);

        return ResponseComposer::json($result);
    }

    /**
     * Handle POST /api/v1/AiAssistant/chat/upload
     *
     * Receives a multipart file upload from the browser and forwards
     * it to the AI Backend's /chat/upload endpoint.
     *
     * EspoCRM authenticates the user before this action runs, so the
     * PHP proxy can safely add the user's API key to the forwarded request.
     */
    public function processUpload(Request $request): Response
    {
        $body = $request->getParsedBody();

        $apiKey = $this->getUserApiKey();

        // Build the multipart fields to forward to the AI backend.
        $fields = [
            'userApiKey' => $apiKey,
            'userId'     => $this->user->getId(),
            'userName'   => $this->user->getName(),
        ];

        if (isset($body->message) && is_string($body->message) && trim($body->message) !== '') {
            $fields['message'] = trim($body->message);
        }

        if (isset($body->model) && is_string($body->model) && $body->model !== '') {
            $fields['model'] = $body->model;
        }

        if (isset($body->sessionId) && is_string($body->sessionId) && $body->sessionId !== '') {
            $fields['sessionId'] = $body->sessionId;
        }

        // Accept file from either multipart ($_FILES) or base64 JSON (fileData).
        $fileKey = 'file';

        if (isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
            // Multipart upload (from XHR/fetch with FormData).
            $filePath = $_FILES[$fileKey]['tmp_name'];
            $fileName = $_FILES[$fileKey]['name'];
            $fileMime = $_FILES[$fileKey]['type'] ?: 'application/octet-stream';
        } elseif (isset($body->fileData) && is_string($body->fileData) && $body->fileData !== '') {
            // Base64 JSON upload (from Espo.Ajax.postRequest).
            $decoded = base64_decode($body->fileData, true);

            if ($decoded === false) {
                throw new BadRequest('fileData is not valid base64.');
            }

            $filePath = tempnam(sys_get_temp_dir(), 'espo_upload_');

            if ($filePath === false || file_put_contents($filePath, $decoded) === false) {
                throw new \RuntimeException('Failed to write temporary file.');
            }

            $fileName = (isset($body->fileName) && is_string($body->fileName))
                ? $body->fileName
                : 'upload.pdf';

            $fileMime = (isset($body->fileMime) && is_string($body->fileMime))
                ? $body->fileMime
                : 'application/pdf';
        } else {
            throw new BadRequest('A file upload is required (multipart or base64 fileData).');
        }

        $backendUrl = $this->getBackendUrl() . '/chat/upload';

        try {
            $result = $this->postMultipart($backendUrl, $fields, $filePath, $fileName, $fileMime);
        } finally {
            // Clean up temp file if we created one from base64.
            if (isset($body->fileData) && isset($filePath) && file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        return ResponseComposer::json($result);
    }

    // ─── Private helpers ────────────────────────────────────

    /**
     * Look up the authenticated user's API key from EspoCRM.
     *
     * Strategy 1: If the user is an API user (type = 'api'), look up
     *             their authToken from the User entity's apiKey field.
     * Strategy 2: Look for a dedicated API user linked to this user
     *             (a User entity with type = 'api' and the same userName).
     * Strategy 3: Fall back to the user's active AuthToken (session token).
     *
     * @throws Error If no API key can be found for the user.
     */
    private function getUserApiKey(): string
    {
        $userId = $this->user->getId();

        // Strategy 1: Check if the current user itself is an API user.
        $userType = $this->user->get('type');

        if ($userType === 'api') {
            $apiKey = $this->user->get('apiKey');

            if (is_string($apiKey) && $apiKey !== '') {
                return $apiKey;
            }
        }

        // Strategy 2: Look for a dedicated API user (type = 'api') in the User entity.
        // This is needed because browser users authenticated via OIDC may not have
        // a session token that works with the X-Api-Key header on the AI backend.
        $apiUser = $this->entityManager
            ->getRDBRepository('User')
            ->where([
                'type' => 'api',
                'isActive' => true,
            ])
            ->order('createdAt', 'DESC')
            ->findOne();

        if ($apiUser !== null) {
            $apiKey = $apiUser->get('apiKey');

            if (is_string($apiKey) && $apiKey !== '') {
                return $apiKey;
            }
        }

        // Strategy 3: Fall back to the user's active AuthToken (session token).
        $authToken = $this->entityManager
            ->getRDBRepository('AuthToken')
            ->where([
                'userId' => $userId,
                'isActive' => true,
            ])
            ->order('createdAt', 'DESC')
            ->findOne();

        if ($authToken !== null) {
            $token = $authToken->get('token');

            if (is_string($token) && $token !== '') {
                return $token;
            }
        }

        throw new Error(
            'No API key found for your user account. '
            . 'Please ask an administrator to create an API key for you.'
        );
    }

    /**
     * Get the AI Backend base URL from EspoCRM config or use the default.
     */
    private function getBackendUrl(): string
    {
        $url = $this->config->get('aiAssistantBackendUrl');

        if (is_string($url) && $url !== '') {
            return rtrim($url, '/');
        }

        return self::DEFAULT_BACKEND_URL;
    }

    /**
     * Send a JSON POST request to the AI Backend via cURL.
     *
     * @param string $url  Full URL to POST to.
     * @param array  $data Payload to JSON-encode.
     * @return object Decoded JSON response.
     * @throws Error On connection failure, timeout, or backend error.
     */
    private function postJson(string $url, array $data): object
    {
        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
        ]);

        return $this->executeCurl($ch);
    }

    /**
     * Send a multipart POST request to the AI Backend via cURL.
     *
     * @param string $url      Full URL to POST to.
     * @param array  $fields   Key-value text fields.
     * @param string $filePath Local path to the uploaded file.
     * @param string $fileName Original filename.
     * @param string $fileMime MIME type of the file.
     * @return object Decoded JSON response.
     * @throws Error On connection failure, timeout, or backend error.
     */
    private function postMultipart(
        string $url,
        array $fields,
        string $filePath,
        string $fileName,
        string $fileMime,
    ): object {
        $ch = curl_init($url);

        $postFields = $fields;
        $postFields['file'] = new \CURLFile($filePath, $fileMime, $fileName);

        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postFields,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
        ]);

        return $this->executeCurl($ch);
    }

    /**
     * Execute a cURL handle and return the decoded response.
     *
     * Handles connection errors, timeouts, and HTTP error codes from
     * the AI Backend with user-friendly fallback messages.
     *
     * @param \CurlHandle $ch cURL handle to execute.
     * @return object Decoded JSON response body.
     * @throws Error On unrecoverable errors.
     */
    private function executeCurl(\CurlHandle $ch): object
    {
        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);

        curl_close($ch);

        // Connection refused or DNS failure.
        if ($curlErrno === CURLE_COULDNT_CONNECT || $curlErrno === CURLE_COULDNT_RESOLVE_HOST) {
            return (object) [
                'message' => 'The AI service is temporarily unavailable. Please try again in a moment.',
                '_debug' => 'connection_refused',
            ];
        }

        // Timeout.
        if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
            return (object) [
                'message' => "I'm having trouble processing your request. Please try again in a moment.",
                '_debug' => 'timeout',
            ];
        }

        // Any other cURL error.
        if ($curlErrno !== 0) {
            return (object) [
                'message' => 'An unexpected error occurred while contacting the AI service. Please try again later.',
                '_debug_curlErrno' => $curlErrno,
                '_debug_curlError' => $curlError,
                '_debug_httpCode' => $httpCode,
            ];
        }

        // Decode the response.
        $decoded = json_decode($responseBody);

        if (!is_object($decoded)) {
            return (object) [
                'message' => 'Received an invalid response from the AI service. Please try again.',
            ];
        }

        // Backend returned an HTTP error status.
        if ($httpCode >= 400) {
            // Log the error for debugging — write to a file since error_log may not be visible.
            @file_put_contents(
                '/tmp/ai_upload_debug.log',
                date('Y-m-d H:i:s') . ' | HTTP ' . $httpCode
                . ' | cURL errno=' . $curlErrno
                . ' | Response: ' . substr((string) $responseBody, 0, 500)
                . "\n",
                FILE_APPEND
            );
        }

        // Also log cURL errors.
        if ($curlErrno !== 0) {
            @file_put_contents(
                '/tmp/ai_upload_debug.log',
                date('Y-m-d H:i:s') . ' | cURL ERROR errno=' . $curlErrno
                . ' | error=' . $curlError
                . ' | httpCode=' . $httpCode
                . "\n",
                FILE_APPEND
            );
        }

        if ($httpCode >= 500) {
            return (object) [
                'message' => $decoded->error
                    ?? 'The AI service encountered an internal error. Please try again later.',
                '_debug_httpCode' => $httpCode,
                '_debug_response' => substr((string) $responseBody, 0, 300),
            ];
        }

        if ($httpCode === 429) {
            $retryAfter = $decoded->retryAfter ?? 30;

            return (object) [
                'message' => "You're sending messages too quickly. Please wait {$retryAfter} seconds.",
                'retryAfter' => $retryAfter,
            ];
        }

        if ($httpCode === 401) {
            return (object) [
                'message' => 'Your session has expired. Please refresh the page and try again.',
            ];
        }

        if ($httpCode === 400) {
            return (object) [
                'message' => $decoded->error ?? 'Invalid request. Please try again.',
            ];
        }

        return $decoded;
    }
}
