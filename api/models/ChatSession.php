<?php

class ChatSession {
    protected static string $table = 'chat_sessions';

    /**
     * Find a chat session by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all chat sessions belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY updated_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Find all chat sessions for a specific user.
     */
    public static function findByUser(int $userId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE user_id = ? ORDER BY updated_at DESC",
            [$userId]
        );
    }

    /**
     * Create a new chat session and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a chat session by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a chat session by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
