CREATE TABLE IF NOT EXISTS `lemon_squeezy_orders` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `ls_order_id` VARCHAR(100) UNIQUE NOT NULL,
    `ls_product_id` VARCHAR(100) DEFAULT NULL,
    `ls_variant_id` VARCHAR(100) DEFAULT NULL,
    `package_name` VARCHAR(50) DEFAULT NULL,
    `credits_amount` INT UNSIGNED NOT NULL DEFAULT 0,
    `amount_paid` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('pending', 'paid', 'refunded', 'failed') NOT NULL DEFAULT 'pending',
    `webhook_payload` JSON DEFAULT NULL,
    `webhook_received_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_lso_user` (`user_id`),
    INDEX `idx_lso_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
