<?php

class NotificationController {
    public function index(Request $request): void {
        $sql = "SELECT * FROM notifications WHERE user_id = ?";
        $params = [Auth::id()];

        if ($request->query('unread_only') === '1') {
            $sql .= " AND is_read = 0";
        }
        if ($type = $request->query('type')) {
            $sql .= " AND type = ?";
            $params[] = $type;
        }

        $sql .= " ORDER BY created_at DESC";

        $limit = (int)$request->query('limit', 50);
        $limit = min(max($limit, 1), 100);
        $sql .= " LIMIT ?";
        $params[] = $limit;

        $notifications = Database::fetchAll($sql, $params);

        foreach ($notifications as &$notification) {
            $notification['data'] = json_decode($notification['data'] ?? '{}', true);
        }

        $unreadCount = Database::count('notifications', 'user_id = ? AND is_read = 0', [Auth::id()]);

        Response::json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markRead(Request $request): void {
        $id = (int) $request->param('id');

        $notification = Database::fetch(
            "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        if (!$notification) Response::notFound('Notification not found');

        Database::update('notifications', [
            'is_read' => 1,
            'read_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$id]);

        Response::json(Database::fetch("SELECT * FROM notifications WHERE id = ?", [$id]));
    }

    public function markAllRead(Request $request): void {
        Database::update('notifications', [
            'is_read' => 1,
            'read_at' => date('Y-m-d H:i:s'),
        ], 'user_id = ? AND is_read = 0', [Auth::id()]);

        Response::json(['message' => 'All notifications marked as read']);
    }
}
