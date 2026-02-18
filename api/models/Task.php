<?php

class Task {
    protected static string $table = 'tasks';

    /**
     * Find a task by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all tasks belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Find all tasks on a specific board.
     */
    public static function findByBoard(int $boardId): array {
        return Database::fetchAll(
            "SELECT t.* FROM " . static::$table . " t
             INNER JOIN board_columns bc ON bc.id = t.column_id
             WHERE bc.board_id = ?
             ORDER BY t.position ASC",
            [$boardId]
        );
    }

    /**
     * Find all tasks assigned to a specific user.
     */
    public static function findByUser(int $userId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE assigned_to = ? ORDER BY due_date ASC",
            [$userId]
        );
    }

    /**
     * Find tasks that are past their due date and not yet completed.
     */
    public static function findOverdue(?int $workspaceId = null): array {
        $sql = "SELECT * FROM " . static::$table . "
                WHERE due_date < NOW() AND status != 'completed'";
        $params = [];

        if ($workspaceId !== null) {
            $sql .= " AND workspace_id = ?";
            $params[] = $workspaceId;
        }

        $sql .= " ORDER BY due_date ASC";

        return Database::fetchAll($sql, $params);
    }

    /**
     * Create a new task and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a task by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a task by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
