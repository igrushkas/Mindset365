CREATE TABLE IF NOT EXISTS `analytics_events` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED DEFAULT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) DEFAULT NULL,
    `entity_id` INT UNSIGNED DEFAULT NULL,
    `metadata` JSON DEFAULT NULL,
    `event_date` DATE NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
    INDEX `idx_workspace_type_date` (`workspace_id`, `event_type`, `event_date`),
    INDEX `idx_user_date` (`user_id`, `event_date`),
    INDEX `idx_event_date` (`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `daily_snapshots` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `active_clients` INT DEFAULT 0,
    `total_revenue` DECIMAL(12,2) DEFAULT 0,
    `tasks_completed` INT DEFAULT 0,
    `tasks_created` INT DEFAULT 0,
    `goals_in_progress` INT DEFAULT 0,
    `goals_completed` INT DEFAULT 0,
    `sessions_held` INT DEFAULT 0,
    `ai_chats` INT DEFAULT 0,
    `metadata` JSON DEFAULT NULL,
    UNIQUE KEY `uk_workspace_date` (`workspace_id`, `snapshot_date`),
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
