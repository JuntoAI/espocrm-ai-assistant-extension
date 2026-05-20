<?php
/**
 * PHP proxy endpoint for the AI Assistant daily brief.
 *
 * Route (defined in routes.json):
 *   POST /api/v1/AiAssistant/brief → process()
 *
 * The EspoCRM framework authenticates the user before this code runs.
 * This endpoint extracts the user's API key, forwards the request to
 * the AI Backend at POST /brief, and returns the response.
 */

namespace Espo\Modules\AiAssistant\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\Error;
use Espo\Core\Utils\Config;
use Espo\Entities\User;
use Espo\ORM\EntityManager;

class PostBrief implements Action
{
    /** Default AI Backend URL (Docker internal network). */
    private const DEFAULT_BACKEND_URL = 'http://ai-backend:3001';

    /** Default API user name used to proxy requests for browser/OIDC users. */
    private const DEFAULT_API_USER_NAME = 'mcp-integration';

    /** cURL timeout for brief generation (brief can take up to 5s per spec). */
    private const REQUEST_TIMEOUT = 30;

    /** cURL connection timeout in seconds. */
    private const CONNECT_TIMEOUT = 5;

    public function __construct(
        private User $user,
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    /**
     * Handle POST /api/v1/AiAssistant/brief
     *
     * Forwards the brief request to the AI Backend along with
     * the user's API key for permission-scoped CRM operations.
     */
    public function process(Request $request): Response
    {
        $apiKey = $this->getUserApiKey();

        $payload = [
            'userApiKey' => $apiKey,
            'userId'     => $this->user->getId(),
            'userName'   => $this->user->getName(),
        ];

        $backendUrl = $this->getBackendUrl() . '/brief';

        $result = $this->postJson($backendUrl, $payload);

        return ResponseComposer::json($result);
    }

    // ─── Private helpers ────────────────────────────────────

    /**
     * Look up the authenticated user's API key from EspoCRM.
     *
     * Strategy 1: If the user is an API user (type = 'api'), use their apiKey.
     * Strategy 2: Look for the configured API user (aiAssistantApiUserName
     *             config, defaults to 'mcp-integration') to proxy requests
     *             on behalf of browser/OIDC users.
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

        // Strategy 2: Look for the configured API user to proxy requests.
        $apiUserName = $this->getApiUserName();

        $apiUser = $this->entityManager
            ->getRDBRepository('User')
            ->where([
                'type' => 'api',
                'userName' => $apiUserName,
                'isActive' => true,
            ])
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
     * Load integration settings from Administration > Integrations > AI Assistant.
     */
    private function getIntegrationData(): ?object
    {
        $integration = $this->entityManager
            ->getRDBRepository('Integration')
            ->where(['id' => 'AiAssistant'])
            ->findOne();

        if ($integration === null) {
            return null;
        }

        return $integration->get('data') ?? null;
    }

    /**
     * Get the AI Backend base URL.
     *
     * Reads from Administration > Integrations > AI Assistant (backendUrl).
     * Falls back to config.php 'aiAssistantBackendUrl', then the default constant.
     */
    private function getBackendUrl(): string
    {
        $data = $this->getIntegrationData();

        if ($data !== null) {
            $url = $data->backendUrl ?? null;

            if (is_string($url) && $url !== '') {
                return rtrim($url, '/');
            }
        }

        $url = $this->config->get('aiAssistantBackendUrl');

        if (is_string($url) && $url !== '') {
            return rtrim($url, '/');
        }

        return self::DEFAULT_BACKEND_URL;
    }

    /**
     * Get the API user name used to proxy requests for browser/OIDC users.
     */
    private function getApiUserName(): string
    {
        $data = $this->getIntegrationData();

        if ($data !== null) {
            $name = $data->apiUserName ?? null;

            if (is_string($name) && $name !== '') {
                return $name;
            }
        }

        $name = $this->config->get('aiAssistantApiUserName');

        if (is_string($name) && $name !== '') {
            return $name;
        }

        return self::DEFAULT_API_USER_NAME;
    }

    /**
     * Send a JSON POST request to the AI Backend via cURL.
     *
     * @param string $url  Full URL to POST to.
     * @param array  $data Payload to JSON-encode.
     * @return object Decoded JSON response.
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
     * Execute a cURL handle and return the decoded response.
     *
     * Handles connection errors, timeouts, and HTTP error codes from
     * the AI Backend with user-friendly fallback messages.
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
                'error' => true,
                'code' => 'CONNECTION_FAILED',
                'message' => 'The AI service is temporarily unavailable. Please try again in a moment.',
            ];
        }

        // Timeout.
        if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
            return (object) [
                'error' => true,
                'code' => 'TIMEOUT',
                'message' => 'Brief generation timed out. Please try again in a moment.',
            ];
        }

        // Any other cURL error.
        if ($curlErrno !== 0) {
            return (object) [
                'error' => true,
                'code' => 'CONNECTION_FAILED',
                'message' => 'An unexpected error occurred while contacting the AI service.',
            ];
        }

        // Decode the response.
        $decoded = json_decode($responseBody);

        if (!is_object($decoded)) {
            return (object) [
                'error' => true,
                'code' => 'SERVICE_UNAVAILABLE',
                'message' => 'Received an invalid response from the AI service.',
            ];
        }

        // Backend returned an HTTP error status.
        if ($httpCode >= 500) {
            return (object) [
                'error' => true,
                'code' => 'SERVICE_UNAVAILABLE',
                'message' => $decoded->error ?? 'The AI service encountered an internal error.',
            ];
        }

        if ($httpCode === 429) {
            $retryAfter = $decoded->retryAfter ?? 30;

            return (object) [
                'error' => true,
                'code' => 'RATE_LIMITED',
                'message' => "Rate limit exceeded. Please wait {$retryAfter} seconds.",
                'retryAfter' => $retryAfter,
            ];
        }

        if ($httpCode === 401) {
            return (object) [
                'error' => true,
                'code' => 'AUTH_FAILED',
                'message' => 'Authentication failed. Please check your API key permissions.',
            ];
        }

        if ($httpCode === 400) {
            return (object) [
                'error' => true,
                'code' => 'BAD_REQUEST',
                'message' => $decoded->error ?? 'Invalid request.',
            ];
        }

        return $decoded;
    }
}
