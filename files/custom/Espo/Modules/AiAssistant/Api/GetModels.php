<?php
/**
 * PHP proxy endpoint for fetching available AI models.
 *
 * Route: GET /api/v1/AiAssistant/models
 *
 * Forwards the request to the AI Backend's GET /models endpoint
 * and returns the list of available models + default model.
 */

namespace Espo\Modules\AiAssistant\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Utils\Config;
use Espo\ORM\EntityManager;

class GetModels implements Action
{
    private const DEFAULT_BACKEND_URL = 'http://ai-backend:3001';
    private const CONNECT_TIMEOUT = 5;
    private const REQUEST_TIMEOUT = 10;

    public function __construct(
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    public function process(Request $request): Response
    {
        $backendUrl = $this->getBackendUrl() . '/models';

        $ch = curl_init($backendUrl);

        curl_setopt_array($ch, [
            CURLOPT_HTTPGET        => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
        ]);

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrno = curl_errno($ch);

        curl_close($ch);

        if ($curlErrno !== 0 || $httpCode >= 400) {
            // Fallback: return a hardcoded default so the UI doesn't break
            return ResponseComposer::json((object) [
                'models' => ['gemini-3.5-flash'],
                'defaultModel' => 'gemini-3.5-flash',
            ]);
        }

        $decoded = json_decode($responseBody);

        if (!is_object($decoded)) {
            return ResponseComposer::json((object) [
                'models' => ['gemini-3.5-flash'],
                'defaultModel' => 'gemini-3.5-flash',
            ]);
        }

        return ResponseComposer::json($decoded);
    }

    private function getBackendUrl(): string
    {
        $integration = $this->entityManager
            ->getRDBRepository('Integration')
            ->where(['id' => 'AiAssistant'])
            ->findOne();

        if ($integration !== null) {
            $data = $integration->get('data') ?? null;

            if ($data !== null) {
                $url = $data->backendUrl ?? null;

                if (is_string($url) && $url !== '') {
                    return rtrim($url, '/');
                }
            }
        }

        $url = $this->config->get('aiAssistantBackendUrl');

        if (is_string($url) && $url !== '') {
            return rtrim($url, '/');
        }

        return self::DEFAULT_BACKEND_URL;
    }
}
