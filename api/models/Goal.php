<?php

class Goal {
    protected static string $table = 'goals';

    /**
     * Find a goal by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all goals belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Find goals for a specific user within a workspace.
     */
    public static function findByUserAndWorkspace(int $userId, int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE user_id = ? AND workspace_id = ? ORDER BY created_at DESC",
            [$userId, $workspaceId]
        );
    }

    /**
     * Get a goal together with its check-in entries.
     */
    public static function getWithCheckins(int $id): ?array {
        $goal = Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
        if (!$goal) {
            return null;
        }
        $goal['checkins'] = Database::fetchAll(
            "SELECT * FROM goal_checkins WHERE goal_id = ? ORDER BY created_at DESC",
            [$id]
        );
        return $goal;
    }

    /**
     * Create a new goal and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a goal by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a goal by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
