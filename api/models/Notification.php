<?php

class Notification {
    protected static string $table = 'notifications';

    /**
     * Find a notification by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all notifications belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Find all notifications for a specific user, newest first.
     */
    public static function findByUser(int $userId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE user_id = ? ORDER BY created_at DESC",
            [$userId]
        );
    }

    /**
     * Get the count of unread notifications for a user.
     */
    public static function getUnreadCount(int $userId): int {
        return Database::count(
            static::$table,
            'user_id = ? AND read_at IS NULL',
            [$userId]
        );
    }

    /**
     * Mark a single notification as read. Returns affected row count.
     */
    public static function markAsRead(int $id): int {
        return Database::update(
            static::$table,
            ['read_at' => date('Y-m-d H:i:s')],
            'id = ?',
            [$id]
        );
    }

    /**
     * Mark all notifications for a user as read. Returns affected row count.
     */
    public static function markAllAsRead(int $userId): int {
        return Database::update(
            static::$table,
            ['read_at' => date('Y-m-d H:i:s')],
            'user_id = ? AND read_at IS NULL',
            [$userId]
        );
    }

    /**
     * Create a new notification and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a notification by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a notification by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
