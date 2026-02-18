CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `google_id` VARCHAR(255) UNIQUE NOT NULL,
    `email` VARCHAR(255) UNIQUE NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `avatar_url` VARCHAR(500) DEFAULT NULL,
    `role` ENUM('owner', 'coach', 'client', 'admin') NOT NULL DEFAULT 'client',
    `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    `timezone` VARCHAR(64) DEFAULT 'America/New_York',
    `preferences` JSON DEFAULT NULL,
    `onboarding_completed` TINYINT(1) DEFAULT 0,
    `last_login_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_role` (`role`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
