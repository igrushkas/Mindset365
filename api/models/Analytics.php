<?php

class Analytics {
    protected static string $eventsTable = 'analytics_events';
    protected static string $snapshotsTable = 'daily_snapshots';

    /**
     * Find an analytics event by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$eventsTable . " WHERE id = ?", [$id]);
    }

    /**
     * Find all analytics events belonging to a workspace.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$eventsTable . " WHERE workspace_id = ? ORDER BY created_at DESC",
            [$workspaceId]
        );
    }

    /**
     * Log a new analytics event.
     */
    public static function logEvent(array $data): int {
        return Database::insert(static::$eventsTable, $data);
    }

    /**
     * Get aggregated dashboard statistics for a workspace.
     */
    public static function getDashboardStats(int $workspaceId): array {
        $totalEvents = Database::count(static::$eventsTable, 'workspace_id = ?', [$workspaceId]);

        $todayEvents = Database::count(
            static::$eventsTable,
            'workspace_id = ? AND DATE(created_at) = CURDATE()',
            [$workspaceId]
        );

        $latestSnapshot = Database::fetch(
            "SELECT * FROM " . static::$snapshotsTable . "
             WHERE workspace_id = ?
             ORDER BY snapshot_date DESC LIMIT 1",
            [$workspaceId]
        );

        $recentEvents = Database::fetchAll(
            "SELECT event_type, COUNT(*) AS count
             FROM " . static::$eventsTable . "
             WHERE workspace_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY event_type
             ORDER BY count DESC",
            [$workspaceId]
        );

        return [
            'total_events'    => $totalEvents,
            'today_events'    => $todayEvents,
            'latest_snapshot' => $latestSnapshot,
            'recent_events'   => $recentEvents,
        ];
    }

    /**
     * Get daily snapshots for a workspace within a date range.
     */
    public static function getDateRange(int $workspaceId, string $startDate, string $endDate): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$snapshotsTable . "
             WHERE workspace_id = ? AND snapshot_date BETWEEN ? AND ?
             ORDER BY snapshot_date ASC",
            [$workspaceId, $startDate, $endDate]
        );
    }

    /**
     * Create a daily snapshot and return the inserted ID.
     */
    public static function createSnapshot(array $data): int {
        return Database::insert(static::$snapshotsTable, $data);
    }

    /**
     * Delete an analytics event by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$eventsTable, 'id = ?', [$id]);
    }
}
