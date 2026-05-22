<?php
/**
 * Service for logging AI usage statistics.
 *
 * Extracts usage metadata from AI Backend responses and persists
 * to the ai_usage_log table for analytics.
 */

namespace Espo\Modules\AiAssistant\Services;

use Espo\ORM\EntityManager;

class UsageLogger
{
    public function __construct(
        private EntityManager $entityManager,
    ) {}

    /**
     * Log a usage event from an AI Backend response.
     *
     * @param string      $userId     EspoCRM user ID
     * @param string      $userName   Display name
     * @param string      $endpoint   Which endpoint was called (chat, brief, upload)
     * @param object|null $response   Decoded AI Backend response (may contain usage metadata)
     * @param int         $durationMs Request duration in milliseconds
     * @param string|null $sessionId  Chat session ID
     * @param string|null $model      AI model used
     */
    public function log(
        string $userId,
        string $userName,
        string $endpoint,
        ?object $response,
        int $durationMs,
        ?string $sessionId = null,
        ?string $model = null,
    ): void {
        $promptTokens = 0;
        $completionTokens = 0;
        $totalTokens = 0;
        $toolCalls = 0;
        $toolNames = null;
        $success = true;

        // Extract usage metadata from the AI Backend response.
        // The AI Backend should include a `_usage` object in its response.
        if ($response !== null) {
            if (isset($response->_usage) && is_object($response->_usage)) {
                $usage = $response->_usage;
                $promptTokens = (int) ($usage->promptTokens ?? $usage->promptTokenCount ?? 0);
                $completionTokens = (int) ($usage->completionTokens ?? $usage->candidatesTokenCount ?? 0);
                $totalTokens = (int) ($usage->totalTokens ?? $usage->totalTokenCount ?? 0);
                $toolCalls = (int) ($usage->toolCalls ?? 0);

                if (isset($usage->toolNames) && is_array($usage->toolNames)) {
                    $toolNames = implode(',', $usage->toolNames);
                } elseif (isset($usage->toolNames) && is_string($usage->toolNames)) {
                    $toolNames = $usage->toolNames;
                }
            }

            // Fallback: check top-level fields (some backends put these at root)
            if ($totalTokens === 0) {
                if (isset($response->promptTokenCount)) {
                    $promptTokens = (int) $response->promptTokenCount;
                }
                if (isset($response->candidatesTokenCount)) {
                    $completionTokens = (int) $response->candidatesTokenCount;
                }
                if (isset($response->totalTokenCount)) {
                    $totalTokens = (int) $response->totalTokenCount;
                }
            }

            if ($toolCalls === 0 && isset($response->toolCallCount)) {
                $toolCalls = (int) $response->toolCallCount;
            }

            // Extract model from response if not provided
            if ($model === null && isset($response->model) && is_string($response->model)) {
                $model = $response->model;
            }

            // Detect errors
            if (isset($response->error) && $response->error === true) {
                $success = false;
            }
            if (isset($response->_debug) && $response->_debug === 'connection_refused') {
                $success = false;
            }
            if (isset($response->_debug) && $response->_debug === 'timeout') {
                $success = false;
            }
        }

        // Generate a unique ID (EspoCRM uses 17-char IDs)
        $id = substr(bin2hex(random_bytes(12)), 0, 17);

        $pdo = $this->entityManager->getPDO();

        $stmt = $pdo->prepare("
            INSERT INTO `ai_usage_log`
                (`id`, `user_id`, `user_name`, `model`, `endpoint`,
                 `prompt_tokens`, `completion_tokens`, `total_tokens`,
                 `tool_calls`, `tool_names`, `duration_ms`, `success`,
                 `session_id`, `created_at`, `deleted`)
            VALUES
                (:id, :userId, :userName, :model, :endpoint,
                 :promptTokens, :completionTokens, :totalTokens,
                 :toolCalls, :toolNames, :durationMs, :success,
                 :sessionId, :createdAt, 0)
        ");

        $stmt->execute([
            'id' => $id,
            'userId' => $userId,
            'userName' => $userName,
            'model' => $model,
            'endpoint' => $endpoint,
            'promptTokens' => $promptTokens,
            'completionTokens' => $completionTokens,
            'totalTokens' => $totalTokens,
            'toolCalls' => $toolCalls,
            'toolNames' => $toolNames,
            'durationMs' => $durationMs,
            'success' => $success ? 1 : 0,
            'sessionId' => $sessionId,
            'createdAt' => date('Y-m-d H:i:s'),
        ]);
    }
}
