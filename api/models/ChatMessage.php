<?php

class ChatMessage {
    protected static string $table = 'chat_messages';

    /**
     * Find a chat message by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all messages belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Find all messages in a specific chat session, ordered chronologically.
     */
    public static function findBySession(int $sessionId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE session_id = ? ORDER BY created_at ASC",
            [$sessionId]
        );
    }

    /**
     * Create a new chat message and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a chat message by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a chat message by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
