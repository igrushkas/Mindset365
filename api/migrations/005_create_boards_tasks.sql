CREATE TABLE IF NOT EXISTS `boards` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `board_type` ENUM('kanban', 'list', 'calendar') DEFAULT 'kanban',
    `color` VARCHAR(7) DEFAULT '#6C5CE7',
    `sort_order` INT DEFAULT 0,
    `is_archived` TINYINT(1) DEFAULT 0,
    `created_by` INT UNSIGNED NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_workspace` (`workspace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `board_columns` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `board_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(7) DEFAULT '#636e72',
    `sort_order` INT DEFAULT 0,
    `wip_limit` INT DEFAULT NULL,
    `is_done_column` TINYINT(1) DEFAULT 0,
    FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE,
    INDEX `idx_board_order` (`board_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `board_id` INT UNSIGNED NOT NULL,
    `column_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `assigned_to` INT UNSIGNED DEFAULT NULL,
    `created_by` INT UNSIGNED NOT NULL,
    `priority` ENUM('none', 'low', 'medium', 'high', 'urgent') DEFAULT 'none',
    `due_date` DATETIME DEFAULT NULL,
    `estimated_hours` DECIMAL(6,2) DEFAULT NULL,
    `actual_hours` DECIMAL(6,2) DEFAULT NULL,
    `sort_order` INT DEFAULT 0,
    `parent_task_id` INT UNSIGNED DEFAULT NULL,
    `goal_id` INT UNSIGNED DEFAULT NULL,
    `tags` JSON DEFAULT NULL,
    `attachments` JSON DEFAULT NULL,
    `completed_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`column_id`) REFERENCES `board_columns`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE SET NULL,
    INDEX `idx_board_column` (`board_id`, `column_id`),
    INDEX `idx_assigned` (`assigned_to`),
    INDEX `idx_due_date` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_comments` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_activity_log` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `task_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `old_value` VARCHAR(500) DEFAULT NULL,
    `new_value` VARCHAR(500) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_task_time` (`task_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
