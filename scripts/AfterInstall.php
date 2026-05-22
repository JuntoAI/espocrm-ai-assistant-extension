<?php
/**
 * AfterInstall script for the AI Assistant extension.
 *
 * Creates the `ai_usage_log` table for tracking AI usage statistics
 * (token counts, model usage, tool calls, latency).
 */

use Espo\Core\Container;
use Espo\Core\Utils\Config;

class AfterInstall
{
    public function run(Container $container): void
    {
        $pdo = $container->getByClass(\Espo\ORM\EntityManager::class)
            ->getPDO();

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `ai_usage_log` (
                `id` VARCHAR(24) NOT NULL,
                `user_id` VARCHAR(24) DEFAULT NULL,
                `user_name` VARCHAR(150) DEFAULT NULL,
                `model` VARCHAR(100) DEFAULT NULL,
                `endpoint` VARCHAR(50) DEFAULT NULL,
                `prompt_tokens` INT DEFAULT 0,
                `completion_tokens` INT DEFAULT 0,
                `total_tokens` INT DEFAULT 0,
                `tool_calls` INT DEFAULT 0,
                `tool_names` TEXT DEFAULT NULL,
                `duration_ms` INT DEFAULT 0,
                `success` TINYINT(1) DEFAULT 1,
                `session_id` VARCHAR(100) DEFAULT NULL,
                `created_at` DATETIME DEFAULT NULL,
                `deleted` TINYINT(1) DEFAULT 0,
                PRIMARY KEY (`id`),
                INDEX `idx_created_at_model` (`created_at`, `model`),
                INDEX `idx_created_at_user_id` (`created_at`, `user_id`),
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_model` (`model`),
                INDEX `idx_endpoint` (`endpoint`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
}
