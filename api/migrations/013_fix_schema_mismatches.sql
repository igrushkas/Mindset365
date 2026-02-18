-- Fix schema mismatches between migrations and controllers

-- 1. Fix course_modules: add missing columns that controllers expect
ALTER TABLE `course_modules`
    ADD COLUMN IF NOT EXISTS `description` TEXT DEFAULT NULL AFTER `title`,
    ADD COLUMN IF NOT EXISTS `module_type` ENUM('video', 'text', 'pdf', 'quiz', 'assignment') NOT NULL DEFAULT 'text' AFTER `description`,
    ADD COLUMN IF NOT EXISTS `content_url` VARCHAR(500) DEFAULT NULL AFTER `module_type`,
    ADD COLUMN IF NOT EXISTS `content_text` LONGTEXT DEFAULT NULL AFTER `content_url`,
    ADD COLUMN IF NOT EXISTS `content_config` JSON DEFAULT NULL AFTER `content_text`,
    ADD COLUMN IF NOT EXISTS `is_required` TINYINT(1) DEFAULT 1 AFTER `sort_order`;

-- 2. Fix course_enrollments: add missing status column
ALTER TABLE `course_enrollments`
    ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'paused', 'completed', 'dropped') DEFAULT 'active' AFTER `progress_pct`;

-- 3. Fix courses: make slug nullable (controller doesn't set it)
ALTER TABLE `courses` MODIFY COLUMN `slug` VARCHAR(500) DEFAULT NULL;
-- Drop the unique index if it exists (slug may be null now)
-- We need to handle the case where slug is null
ALTER TABLE `courses` DROP INDEX IF EXISTS `slug`;

-- 4. Create course_module_completions table (controller expects this name, not module_completions)
CREATE TABLE IF NOT EXISTS `course_module_completions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `enrollment_id` INT UNSIGNED NOT NULL,
    `module_id` INT UNSIGNED NOT NULL,
    `completed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_enrollment_module` (`enrollment_id`, `module_id`),
    FOREIGN KEY (`enrollment_id`) REFERENCES `course_enrollments`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Fix content_library: add missing columns
ALTER TABLE `content_library`
    ADD COLUMN IF NOT EXISTS `thumbnail_url` VARCHAR(500) DEFAULT NULL AFTER `external_url`,
    ADD COLUMN IF NOT EXISTS `metadata` JSON DEFAULT NULL AFTER `tags`;

-- 6. Add tags column to courses if missing
ALTER TABLE `courses`
    ADD COLUMN IF NOT EXISTS `tags` JSON DEFAULT NULL AFTER `sort_order`,
    ADD COLUMN IF NOT EXISTS `estimated_duration` INT DEFAULT NULL AFTER `tags`;
