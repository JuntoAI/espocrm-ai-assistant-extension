<?php
/**
 * PHP proxy endpoint for AI Assistant file uploads.
 *
 * Separate action class because EspoCRM always calls process() on the
 * actionClassName — there is no actionMethodName support.
 *
 * Route: POST /api/v1/AiAssistant/upload
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

class PostUpload implements Action
{
    private const DEFAULT_BACKEND_URL = 'http://ai-backend:3001';
    private const REQUEST_TIMEOUT = 120;
    private const CONNECT_TIMEOUT = 5;

    public function __construct(
        private User $user,
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    public function process(Request $request): Response
    {
        $body = $request->getParsedBody();
        $apiKey = $this->getUserApiKey();

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
            $filePath = $_FILES[$fileKey]['tmp_name'];
            $fileName = $_FILES[$fileKey]['name'];
            $fileMime = $_FILES[$fileKey]['type'] ?: 'application/octet-stream';
            $isTemp = false;
        } elseif (isset($body->fileData) && is_string($body->fileData) && $body->fileData !== '') {
            $decoded = base64_decode($body->fileData, true);

            if ($decoded === false) {
                throw new BadRequest('fileData is not valid base64.');
            }

            $filePath = tempnam(sys_get_temp_dir(), 'espo_upload_');

            if ($filePath === false || file_put_contents($filePath, $decoded) === false) {
                throw new \RuntimeException('Failed to write temporary file.');
            }

            $fileName = (isset($body->fileName) && is_string($body->fileName))
                ? $body->fileName : 'upload.pdf';
            $fileMime = (isset($body->fileMime) && is_string($body->fileMime))
                ? $body->fileMime : 'application/octet-stream';
            $isTemp = true;
        } else {
            throw new BadRequest('A file upload is required (multipart or base64 fileData).');
        }

        $backendUrl = $this->getBackendUrl() . '/chat/upload';

        try {
            $result = $this->postMultipart($backendUrl, $fields, $filePath, $fileName, $fileMime);
        } finally {
            if ($isTemp && isset($filePath) && file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        return ResponseComposer::json($result);
    }

    private function getUserApiKey(): string
    {
        $userType = $this->user->get('type');

        if ($userType === 'api') {
            $apiKey = $this->user->get('apiKey');
            if (is_string($apiKey) && $apiKey !== '') {
                return $apiKey;
            }
        }

        $apiUser = $this->entityManager
            ->getRDBRepository('User')
            ->where(['type' => 'api', 'isActive' => true])
            ->order('createdAt', 'DESC')
            ->findOne();

        if ($apiUser !== null) {
            $apiKey = $apiUser->get('apiKey');
            if (is_string($apiKey) && $apiKey !== '') {
                return $apiKey;
            }
        }

        $authToken = $this->entityManager
            ->getRDBRepository('AuthToken')
            ->where(['userId' => $this->user->getId(), 'isActive' => true])
            ->order('createdAt', 'DESC')
            ->findOne();

        if ($authToken !== null) {
            $token = $authToken->get('token');
            if (is_string($token) && $token !== '') {
                return $token;
            }
        }

        throw new Error('No API key found for your user account.');
    }

    private function getBackendUrl(): string
    {
        $url = $this->config->get('aiAssistantBackendUrl');
        return (is_string($url) && $url !== '') ? rtrim($url, '/') : self::DEFAULT_BACKEND_URL;
    }

    private function postMultipart(string $url, array $fields, string $filePath, string $fileName, string $fileMime): object
    {
        $ch = curl_init($url);
        $postFields = $fields;
        $postFields['file'] = new \CURLFile($filePath, $fileMime, $fileName);

        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postFields,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
        ]);

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrno = curl_errno($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlErrno !== 0) {
            return (object) [
                'message' => 'Failed to contact the AI service: ' . $curlError,
                '_debug' => ['errno' => $curlErrno, 'error' => $curlError, 'httpCode' => $httpCode],
            ];
        }

        $decoded = json_decode($responseBody);

        if (!is_object($decoded)) {
            return (object) [
                'message' => 'Invalid response from AI service.',
                '_debug' => ['httpCode' => $httpCode, 'body' => substr((string) $responseBody, 0, 500)],
            ];
        }

        if ($httpCode >= 400) {
            return (object) [
                'message' => $decoded->error ?? $decoded->message ?? 'AI service error (HTTP ' . $httpCode . ').',
                '_debug' => ['httpCode' => $httpCode, 'body' => substr((string) $responseBody, 0, 500)],
            ];
        }

        return $decoded;
    }
}
