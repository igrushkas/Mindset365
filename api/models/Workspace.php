<?php

class Workspace {
    protected static string $table = 'workspaces';
    protected static string $membersTable = 'workspace_members';

    /**
     * Find a workspace by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all workspaces owned by a specific user.
     */
    public static function findByOwner(int $ownerId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE owner_id = ? ORDER BY created_at DESC",
            [$ownerId]
        );
    }

    /**
     * Find all workspaces a user is a member of (including owned).
     */
    public static function findByUser(int $userId): array {
        return Database::fetchAll(
            "SELECT w.* FROM " . static::$table . " w
             INNER JOIN " . static::$membersTable . " wm ON wm.workspace_id = w.id
             WHERE wm.user_id = ?
             ORDER BY w.created_at DESC",
            [$userId]
        );
    }

    /**
     * Get all members of a workspace with their user details.
     */
    public static function getMembers(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
             FROM " . static::$membersTable . " wm
             INNER JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id = ?
             ORDER BY wm.joined_at ASC",
            [$workspaceId]
        );
    }

    /**
     * Add a member to a workspace. Returns the inserted membership ID.
     */
    public static function addMember(int $workspaceId, int $userId, string $role = 'member'): int {
        return Database::insert(static::$membersTable, [
            'workspace_id' => $workspaceId,
            'user_id'      => $userId,
            'role'         => $role,
            'joined_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Remove a member from a workspace. Returns affected row count.
     */
    public static function removeMember(int $workspaceId, int $userId): int {
        return Database::delete(
            static::$membersTable,
            'workspace_id = ? AND user_id = ?',
            [$workspaceId, $userId]
        );
    }

    /**
     * Update a member's role in a workspace. Returns affected row count.
     */
    public static function updateMemberRole(int $workspaceId, int $userId, string $role): int {
        return Database::update(
            static::$membersTable,
            ['role' => $role],
            'workspace_id = ? AND user_id = ?',
            [$workspaceId, $userId]
        );
    }

    /**
     * Check if a user is a member of a workspace.
     */
    public static function isMember(int $workspaceId, int $userId): bool {
        return Database::count(
            static::$membersTable,
            'workspace_id = ? AND user_id = ?',
            [$workspaceId, $userId]
        ) > 0;
    }

    /**
     * Create a new workspace and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a workspace by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a workspace by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
