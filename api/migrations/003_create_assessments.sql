-- Onboarding assessment templates (questions coaches create)
CREATE TABLE IF NOT EXISTS `assessment_templates` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `workspace_id` INT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL DEFAULT 'Business Assessment',
    `description` TEXT DEFAULT NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_by` INT UNSIGNED NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual questions within an assessment
CREATE TABLE IF NOT EXISTS `assessment_questions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `template_id` INT UNSIGNED NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `question` TEXT NOT NULL,
    `question_type` ENUM('scale', 'multiple_choice', 'text', 'yes_no', 'number') NOT NULL DEFAULT 'scale',
    `options` JSON DEFAULT NULL,
    `help_text` TEXT DEFAULT NULL,
    `sort_order` INT DEFAULT 0,
    `weight` DECIMAL(3,2) DEFAULT 1.00,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`template_id`) REFERENCES `assessment_templates`(`id`) ON DELETE CASCADE,
    INDEX `idx_template_order` (`template_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Completed assessments (per user/client)
CREATE TABLE IF NOT EXISTS `assessments` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `template_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `workspace_id` INT UNSIGNED NOT NULL,
    `client_id` INT UNSIGNED DEFAULT NULL,
    `status` ENUM('in_progress', 'completed') DEFAULT 'in_progress',
    `overall_score` DECIMAL(5,2) DEFAULT NULL,
    `category_scores` JSON DEFAULT NULL,
    `ai_summary` TEXT DEFAULT NULL,
    `ai_recommendations` JSON DEFAULT NULL,
    `completed_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`template_id`) REFERENCES `assessment_templates`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_workspace` (`user_id`, `workspace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individual answers
CREATE TABLE IF NOT EXISTS `assessment_answers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `assessment_id` INT UNSIGNED NOT NULL,
    `question_id` INT UNSIGNED NOT NULL,
    `answer_value` TEXT DEFAULT NULL,
    `answer_score` DECIMAL(5,2) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`question_id`) REFERENCES `assessment_questions`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_assessment_question` (`assessment_id`, `question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
