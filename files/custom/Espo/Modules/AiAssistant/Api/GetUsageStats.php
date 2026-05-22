<?php
/**
 * API endpoint for AI usage statistics.
 *
 * Route: GET /api/v1/AiAssistant/usageStats
 *
 * Returns aggregated usage data for today, 7 days, and 30 days:
 * - Total tokens by model
 * - Total tool calls (MCP operations)
 * - Request count and error rate
 * - Average latency
 * - Per-user breakdown
 * - Top tools used
 *
 * Only accessible to admin users.
 */

namespace Espo\Modules\AiAssistant\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\Forbidden;
use Espo\Entities\User;
use Espo\ORM\EntityManager;

class GetUsageStats implements Action
{
    public function __construct(
        private User $user,
        private EntityManager $entityManager,
    ) {}

    public function process(Request $request): Response
    {
        // Only admins can view usage stats.
        if (!$this->user->isAdmin()) {
            throw new Forbidden('Only administrators can view AI usage statistics.');
        }

        $pdo = $this->entityManager->getPDO();

        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $todayStart = $now->format('Y-m-d') . ' 00:00:00';
        $sevenDaysAgo = $now->modify('-7 days')->format('Y-m-d H:i:s');
        $thirtyDaysAgo = $now->modify('-30 days')->format('Y-m-d H:i:s');

        $result = [
            'today' => $this->getStats($pdo, $todayStart),
            'last7Days' => $this->getStats($pdo, $sevenDaysAgo),
            'last30Days' => $this->getStats($pdo, $thirtyDaysAgo),
            'tokensByModel' => $this->getTokensByModel($pdo, $thirtyDaysAgo),
            'tokensByDay' => $this->getTokensByDay($pdo, $thirtyDaysAgo),
            'topTools' => $this->getTopTools($pdo, $thirtyDaysAgo),
            'perUser' => $this->getPerUser($pdo, $thirtyDaysAgo),
        ];

        return ResponseComposer::json($result);
    }

    private function getStats(\PDO $pdo, string $since): array
    {
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as requestCount,
                COALESCE(SUM(prompt_tokens), 0) as promptTokens,
                COALESCE(SUM(completion_tokens), 0) as completionTokens,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(tool_calls), 0) as toolCalls,
                COALESCE(AVG(duration_ms), 0) as avgDurationMs,
                COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as errorCount,
                COUNT(DISTINCT user_id) as uniqueUsers,
                COUNT(DISTINCT session_id) as uniqueSessions
            FROM `ai_usage_log`
            WHERE `created_at` >= :since
              AND `deleted` = 0
        ");

        $stmt->execute(['since' => $since]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        return [
            'requestCount' => (int) $row['requestCount'],
            'promptTokens' => (int) $row['promptTokens'],
            'completionTokens' => (int) $row['completionTokens'],
            'totalTokens' => (int) $row['totalTokens'],
            'toolCalls' => (int) $row['toolCalls'],
            'avgDurationMs' => (int) round((float) $row['avgDurationMs']),
            'errorCount' => (int) $row['errorCount'],
            'uniqueUsers' => (int) $row['uniqueUsers'],
            'uniqueSessions' => (int) $row['uniqueSessions'],
        ];
    }

    private function getTokensByModel(\PDO $pdo, string $since): array
    {
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(model, 'unknown') as model,
                COUNT(*) as requestCount,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(prompt_tokens), 0) as promptTokens,
                COALESCE(SUM(completion_tokens), 0) as completionTokens,
                COALESCE(SUM(tool_calls), 0) as toolCalls
            FROM `ai_usage_log`
            WHERE `created_at` >= :since
              AND `deleted` = 0
            GROUP BY model
            ORDER BY totalTokens DESC
        ");

        $stmt->execute(['since' => $since]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            return [
                'model' => $row['model'],
                'requestCount' => (int) $row['requestCount'],
                'totalTokens' => (int) $row['totalTokens'],
                'promptTokens' => (int) $row['promptTokens'],
                'completionTokens' => (int) $row['completionTokens'],
                'toolCalls' => (int) $row['toolCalls'],
            ];
        }, $rows);
    }

    private function getTokensByDay(\PDO $pdo, string $since): array
    {
        $stmt = $pdo->prepare("
            SELECT
                DATE(created_at) as day,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(tool_calls), 0) as toolCalls,
                COUNT(*) as requestCount
            FROM `ai_usage_log`
            WHERE `created_at` >= :since
              AND `deleted` = 0
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        ");

        $stmt->execute(['since' => $since]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            return [
                'day' => $row['day'],
                'totalTokens' => (int) $row['totalTokens'],
                'toolCalls' => (int) $row['toolCalls'],
                'requestCount' => (int) $row['requestCount'],
            ];
        }, $rows);
    }

    private function getTopTools(\PDO $pdo, string $since): array
    {
        // Get all tool_names entries and count occurrences
        $stmt = $pdo->prepare("
            SELECT tool_names
            FROM `ai_usage_log`
            WHERE `created_at` >= :since
              AND `deleted` = 0
              AND `tool_names` IS NOT NULL
              AND `tool_names` != ''
        ");

        $stmt->execute(['since' => $since]);
        $rows = $stmt->fetchAll(\PDO::FETCH_COLUMN);

        $toolCounts = [];

        foreach ($rows as $toolNamesStr) {
            $tools = explode(',', $toolNamesStr);

            foreach ($tools as $tool) {
                $tool = trim($tool);

                if ($tool === '') {
                    continue;
                }

                if (!isset($toolCounts[$tool])) {
                    $toolCounts[$tool] = 0;
                }

                $toolCounts[$tool]++;
            }
        }

        arsort($toolCounts);

        $result = [];

        foreach (array_slice($toolCounts, 0, 20, true) as $tool => $count) {
            $result[] = ['tool' => $tool, 'count' => $count];
        }

        return $result;
    }

    private function getPerUser(\PDO $pdo, string $since): array
    {
        $stmt = $pdo->prepare("
            SELECT
                user_id as userId,
                user_name as userName,
                COUNT(*) as requestCount,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(tool_calls), 0) as toolCalls
            FROM `ai_usage_log`
            WHERE `created_at` >= :since
              AND `deleted` = 0
            GROUP BY user_id, user_name
            ORDER BY totalTokens DESC
            LIMIT 20
        ");

        $stmt->execute(['since' => $since]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            return [
                'userId' => $row['userId'],
                'userName' => $row['userName'],
                'requestCount' => (int) $row['requestCount'],
                'totalTokens' => (int) $row['totalTokens'],
                'toolCalls' => (int) $row['toolCalls'],
            ];
        }, $rows);
    }
}
