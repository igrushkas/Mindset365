<?php

class AutomationController {
    public function index(Request $request): void {
        $sql = "SELECT a.*, u.name as created_by_name
                FROM automations a
                JOIN users u ON a.created_by = u.id
                WHERE a.workspace_id = ?";
        $params = [Auth::workspaceId()];

        if ($triggerType = $request->query('trigger_type')) {
            $sql .= " AND a.trigger_type = ?";
            $params[] = $triggerType;
        }
        if ($request->query('is_active') !== null) {
            $sql .= " AND a.is_active = ?";
            $params[] = (int)$request->query('is_active');
        }

        $sql .= " ORDER BY a.created_at DESC";
        $automations = Database::fetchAll($sql, $params);

        foreach ($automations as &$automation) {
            $automation['trigger_config'] = json_decode($automation['trigger_config'] ?? '{}', true);
            $automation['action_config'] = json_decode($automation['action_config'] ?? '{}', true);
        }

        Response::json($automations);
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('name', 'Name')
          ->maxLength('name', 255, 'Name')
          ->required('trigger_type', 'Trigger type')
          ->in('trigger_type', ['task_moved', 'goal_completed', 'client_status_changed', 'date_reached', 'manual'], 'Trigger type')
          ->required('action_type', 'Action type')
          ->in('action_type', ['create_task', 'send_notification', 'update_status', 'assign_user', 'log_event'], 'Action type');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = [
            'workspace_id' => Auth::workspaceId(),
            'created_by' => Auth::id(),
            'name' => Validator::sanitize($request->body('name')),
            'description' => Validator::sanitize($request->body('description', '')),
            'trigger_type' => $request->body('trigger_type'),
            'action_type' => $request->body('action_type'),
            'is_active' => $request->body('is_active', 1) ? 1 : 0,
            'run_count' => 0,
        ];

        if ($request->body('trigger_config')) {
            $data['trigger_config'] = json_encode($request->body('trigger_config'));
        }
        if ($request->body('action_config')) {
            $data['action_config'] = json_encode($request->body('action_config'));
        }

        $id = Database::insert('automations', $data);

        $automation = Database::fetch("SELECT * FROM automations WHERE id = ?", [$id]);
        $automation['trigger_config'] = json_decode($automation['trigger_config'] ?? '{}', true);
        $automation['action_config'] = json_decode($automation['action_config'] ?? '{}', true);

        Response::created($automation);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $automation = Database::fetch(
            "SELECT * FROM automations WHERE id = ? AND workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$automation) Response::notFound('Automation not found');

        $allowed = ['name', 'description', 'trigger_type', 'action_type', 'is_active'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if (isset($data['trigger_type'])) {
            $validTriggers = ['task_moved', 'goal_completed', 'client_status_changed', 'date_reached', 'manual'];
            if (!in_array($data['trigger_type'], $validTriggers, true)) {
                Response::error('Invalid trigger type', 422);
            }
        }
        if (isset($data['action_type'])) {
            $validActions = ['create_task', 'send_notification', 'update_status', 'assign_user', 'log_event'];
            if (!in_array($data['action_type'], $validActions, true)) {
                Response::error('Invalid action type', 422);
            }
        }

        if ($request->body('trigger_config')) {
            $data['trigger_config'] = json_encode($request->body('trigger_config'));
        }
        if ($request->body('action_config')) {
            $data['action_config'] = json_encode($request->body('action_config'));
        }

        if (isset($data['is_active'])) {
            $data['is_active'] = $data['is_active'] ? 1 : 0;
        }

        if (!empty($data)) {
            Database::update('automations', $data, 'id = ?', [$id]);
        }

        $updated = Database::fetch("SELECT * FROM automations WHERE id = ?", [$id]);
        $updated['trigger_config'] = json_decode($updated['trigger_config'] ?? '{}', true);
        $updated['action_config'] = json_decode($updated['action_config'] ?? '{}', true);

        Response::json($updated);
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('automations', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Automation not found');
        Response::noContent();
    }
}
