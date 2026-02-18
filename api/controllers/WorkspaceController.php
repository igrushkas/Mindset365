<?php

class WorkspaceController {
    public function index(Request $request): void {
        $workspaces = Database::fetchAll(
            "SELECT w.*, wm.role as member_role,
                    (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) as member_count
             FROM workspaces w
             JOIN workspace_members wm ON w.id = wm.workspace_id
             WHERE wm.user_id = ?
             ORDER BY w.created_at ASC",
            [Auth::id()]
        );
        Response::json($workspaces);
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('name', 'Workspace name')
          ->maxLength('name', 255, 'Workspace name');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $name = Validator::sanitize($request->body('name'));
        $slug = $this->generateSlug($name);

        $id = Database::insert('workspaces', [
            'name' => $name,
            'slug' => $slug,
            'owner_id' => Auth::id(),
            'description' => Validator::sanitize($request->body('description', '')),
        ]);

        // Add creator as admin member
        Database::insert('workspace_members', [
            'workspace_id' => $id,
            'user_id' => Auth::id(),
            'role' => 'admin',
        ]);

        $workspace = Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$id]);
        Response::created($workspace);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');

        // Verify user is a member
        $membership = Database::fetch(
            "SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        if (!$membership) Response::notFound('Workspace not found');

        $workspace = Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$id]);
        if (!$workspace) Response::notFound('Workspace not found');

        // Get members
        $workspace['members'] = Database::fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar_url, u.status, wm.role, wm.created_at as joined_at
             FROM workspace_members wm
             JOIN users u ON wm.user_id = u.id
             WHERE wm.workspace_id = ?
             ORDER BY wm.created_at ASC",
            [$id]
        );

        // Get pending invites
        $workspace['invites'] = Database::fetchAll(
            "SELECT * FROM workspace_invites
             WHERE workspace_id = ? AND status = 'pending' AND expires_at > NOW()
             ORDER BY created_at DESC",
            [$id]
        );

        Response::json($workspace);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');

        $workspace = Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$id]);
        if (!$workspace) Response::notFound('Workspace not found');

        // Only owner or admin can update
        $membership = Database::fetch(
            "SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role IN ('admin', 'owner')",
            [$id, Auth::id()]
        );
        if (!$membership && $workspace['owner_id'] !== Auth::id()) {
            Response::forbidden('Only workspace admins can update settings');
        }

        $allowed = ['name', 'description', 'logo_url'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if (isset($data['name'])) {
            $data['slug'] = $this->generateSlug($data['name'], $id);
        }

        if (!empty($data)) {
            Database::update('workspaces', $data, 'id = ?', [$id]);
        }

        Response::json(Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$id]));
    }

    public function invite(Request $request): void {
        $id = (int) $request->param('id');

        $workspace = Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$id]);
        if (!$workspace) Response::notFound('Workspace not found');

        // Only owner or admin can invite
        $membership = Database::fetch(
            "SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role IN ('admin', 'owner')",
            [$id, Auth::id()]
        );
        if (!$membership && $workspace['owner_id'] !== Auth::id()) {
            Response::forbidden('Only workspace admins can invite members');
        }

        $v = Validator::make($request->body());
        $v->required('email', 'Email')->email('email', 'Email');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $email = Validator::sanitize($request->body('email'));
        $role = $request->body('role', 'member');

        // Check if user is already a member
        $existingUser = Database::fetch("SELECT id FROM users WHERE email = ?", [$email]);
        if ($existingUser) {
            $existingMember = Database::fetch(
                "SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
                [$id, $existingUser['id']]
            );
            if ($existingMember) {
                Response::error('User is already a member of this workspace', 409);
            }
        }

        // Check for existing pending invite
        $existingInvite = Database::fetch(
            "SELECT * FROM workspace_invites WHERE workspace_id = ? AND email = ? AND status = 'pending' AND expires_at > NOW()",
            [$id, $email]
        );
        if ($existingInvite) {
            Response::error('An invite has already been sent to this email', 409);
        }

        // Generate invite code
        $code = bin2hex(random_bytes(16));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));

        $inviteId = Database::insert('workspace_invites', [
            'workspace_id' => $id,
            'email' => $email,
            'role' => $role,
            'invite_code' => $code,
            'invited_by' => Auth::id(),
            'status' => 'pending',
            'expires_at' => $expiresAt,
        ]);

        $config = require __DIR__ . '/../config/app.php';
        $inviteLink = $config['url'] . '/invite/' . $code;

        Response::created([
            'id' => $inviteId,
            'email' => $email,
            'role' => $role,
            'invite_code' => $code,
            'invite_link' => $inviteLink,
            'expires_at' => $expiresAt,
        ]);
    }

    public function removeMember(Request $request): void {
        $workspaceId = (int) $request->param('id');
        $userId = (int) $request->param('uid');

        $workspace = Database::fetch("SELECT * FROM workspaces WHERE id = ?", [$workspaceId]);
        if (!$workspace) Response::notFound('Workspace not found');

        // Cannot remove the workspace owner
        if ($workspace['owner_id'] === $userId) {
            Response::error('Cannot remove the workspace owner', 403);
        }

        // Only owner or admin can remove members
        $membership = Database::fetch(
            "SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role IN ('admin', 'owner')",
            [$workspaceId, Auth::id()]
        );
        if (!$membership && $workspace['owner_id'] !== Auth::id()) {
            Response::forbidden('Only workspace admins can remove members');
        }

        $deleted = Database::delete(
            'workspace_members',
            'workspace_id = ? AND user_id = ?',
            [$workspaceId, $userId]
        );
        if (!$deleted) Response::notFound('Member not found');

        Response::noContent();
    }

    private function generateSlug(string $name, ?int $excludeId = null): string {
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $name), '-'));
        $baseSlug = $slug;
        $counter = 1;

        while (true) {
            $where = "slug = ?";
            $params = [$slug];
            if ($excludeId) {
                $where .= " AND id != ?";
                $params[] = $excludeId;
            }
            $existing = Database::fetch("SELECT id FROM workspaces WHERE $where", $params);
            if (!$existing) break;
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }
}
