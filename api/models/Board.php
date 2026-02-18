<?php

class Board {
    protected static string $table = 'boards';

    /**
     * Find a board by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all boards belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Get a board with all its columns and nested tasks.
     */
    public static function getWithColumnsAndTasks(int $id): ?array {
        $board = Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
        if (!$board) {
            return null;
        }

        $columns = Database::fetchAll(
            "SELECT * FROM board_columns WHERE board_id = ? ORDER BY position ASC",
            [$id]
        );

        foreach ($columns as &$column) {
            $column['tasks'] = Database::fetchAll(
                "SELECT * FROM tasks WHERE column_id = ? ORDER BY position ASC",
                [$column['id']]
            );
        }
        unset($column);

        $board['columns'] = $columns;
        return $board;
    }

    /**
     * Create a new board and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a board by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a board by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
