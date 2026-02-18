-- Referral system: 1 year free AI coaching for each referred client who signs up
CREATE TABLE IF NOT EXISTS `referrals` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `referrer_id` INT UNSIGNED NOT NULL,
    `referral_code` VARCHAR(32) UNIQUE NOT NULL,
    `referred_email` VARCHAR(255) DEFAULT NULL,
    `referred_user_id` INT UNSIGNED DEFAULT NULL,
    `status` ENUM('pending', 'signed_up', 'active', 'expired') DEFAULT 'pending',
    `reward_type` VARCHAR(50) DEFAULT 'ai_coaching_1yr',
    `reward_granted` TINYINT(1) DEFAULT 0,
    `reward_expires_at` DATETIME DEFAULT NULL,
    `signed_up_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_referrer` (`referrer_id`),
    INDEX `idx_code` (`referral_code`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add referral fields to users table
ALTER TABLE `users` ADD COLUMN `referral_code` VARCHAR(32) UNIQUE DEFAULT NULL AFTER `onboarding_completed`;
ALTER TABLE `users` ADD COLUMN `referred_by` INT UNSIGNED DEFAULT NULL AFTER `referral_code`;
ALTER TABLE `users` ADD COLUMN `ai_access_until` DATETIME DEFAULT NULL AFTER `referred_by`;
