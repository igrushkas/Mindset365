<?php

class User {
    protected static string $table = 'users';

    /**
     * Find a user by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find a user by their Google OAuth ID.
     */
    public static function findByGoogleId(string $googleId): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE google_id = ?", [$googleId]);
    }

    /**
     * Find a user by email address.
     */
    public static function findByEmail(string $email): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE email = ?", [$email]);
    }

    /**
     * Find all users belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT u.* FROM " . static::$table . " u
             INNER JOIN workspace_members wm ON wm.user_id = u.id
             WHERE wm.workspace_id = ?",
            [$workspaceId]
        );
    }

    /**
     * Create a new user and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a user by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a user by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
