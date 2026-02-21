-- Task Templates: reusable sets of tasks that coaches can assign to clients
CREATE TABLE IF NOT EXISTS `task_templates` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `phase` ENUM('foundation', 'growth', 'scale') NOT NULL DEFAULT 'foundation',
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_by` INT UNSIGNED NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_workspace_phase` (`workspace_id`, `phase`),
    INDEX `idx_workspace_active` (`workspace_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual tasks within a template
CREATE TABLE IF NOT EXISTS `template_tasks` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `template_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `priority` ENUM('none', 'low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    `sort_order` INT DEFAULT 0,
    `estimated_hours` DECIMAL(6,2) DEFAULT NULL,
    `tags` JSON DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON DELETE CASCADE,
    INDEX `idx_template_order` (`template_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Track which templates have been assigned to which clients
CREATE TABLE IF NOT EXISTS `client_template_assignments` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `client_id` INT UNSIGNED NOT NULL,
    `template_id` INT UNSIGNED NOT NULL,
    `assigned_by` INT UNSIGNED NOT NULL,
    `board_id` INT UNSIGNED DEFAULT NULL,
    `tasks_created` INT DEFAULT 0,
    `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_client` (`client_id`),
    INDEX `idx_template` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
