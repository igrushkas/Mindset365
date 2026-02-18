<?php

class Client {
    protected static string $table = 'clients';

    /**
     * Find a client by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all clients belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY name ASC",
            [$workspaceId]
        );
    }

    /**
     * Find all clients assigned to a specific coach (user).
     */
    public static function findByCoach(int $coachId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE coach_id = ? ORDER BY name ASC",
            [$coachId]
        );
    }

    /**
     * Get a client together with their coaching sessions.
     */
    public static function getWithSessions(int $id): ?array {
        $client = Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
        if (!$client) {
            return null;
        }
        $client['sessions'] = Database::fetchAll(
            "SELECT * FROM coaching_sessions WHERE client_id = ? ORDER BY scheduled_at DESC",
            [$id]
        );
        return $client;
    }

    /**
     * Create a new client and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a client by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a client by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
