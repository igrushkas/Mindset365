<?php

class UserController {
    public function index(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $users = Database::fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.status, wm.role as workspace_role
             FROM users u
             JOIN workspace_members wm ON u.id = wm.user_id
             WHERE wm.workspace_id = ?
             ORDER BY u.name ASC",
            [$workspaceId]
        );
        Response::json($users);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $user = Database::fetch(
            "SELECT id, name, email, avatar_url, role, status, timezone, created_at FROM users WHERE id = ?",
            [$id]
        );
        if (!$user) Response::notFound('User not found');
        Response::json($user);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        if ($id !== Auth::id() && !Auth::isOwner()) {
            Response::forbidden('Cannot update other users');
        }

        $data = Validator::sanitizeArray($request->body(), ['name', 'timezone']);
        if (empty($data)) Response::error('No data to update');

        Database::update('users', $data, 'id = ?', [$id]);
        $user = Database::fetch("SELECT id, name, email, avatar_url, role, timezone FROM users WHERE id = ?", [$id]);
        Response::json($user);
    }

    public function updatePreferences(Request $request): void {
        $id = (int) $request->param('id');
        if ($id !== Auth::id()) {
            Response::forbidden('Cannot update other users preferences');
        }

        $preferences = $request->body('preferences');
        Database::update('users', ['preferences' => json_encode($preferences)], 'id = ?', [$id]);
        Response::json(['message' => 'Preferences updated']);
    }
}
