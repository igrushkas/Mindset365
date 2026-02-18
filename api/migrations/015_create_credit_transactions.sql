CREATE TABLE IF NOT EXISTS `credit_transactions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `amount` INT NOT NULL,
    `type` ENUM('purchase', 'usage', 'bonus', 'refund', 'trial') NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `balance_after` INT NOT NULL,
    `related_entity_type` VARCHAR(50) DEFAULT NULL,
    `related_entity_id` VARCHAR(100) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_ct_user` (`user_id`),
    INDEX `idx_ct_type` (`type`),
    INDEX `idx_ct_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
