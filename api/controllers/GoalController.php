<?php

class GoalController {
    public function index(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $status = $request->query('status');
        $category = $request->query('category');
        $userId = $request->query('user_id');

        $sql = "SELECT g.*, u.name as user_name, u.avatar_url as user_avatar
                FROM goals g
                JOIN users u ON g.user_id = u.id
                WHERE g.workspace_id = ?";
        $params = [$workspaceId];

        if ($status) {
            $sql .= " AND g.status = ?";
            $params[] = $status;
        }
        if ($category) {
            $sql .= " AND g.category = ?";
            $params[] = $category;
        }
        if ($userId) {
            $sql .= " AND g.user_id = ?";
            $params[] = (int) $userId;
        }

        $sql .= " ORDER BY g.priority DESC, g.target_date ASC";

        $goals = Database::fetchAll($sql, $params);

        // Calculate progress percentage for each goal
        foreach ($goals as &$goal) {
            $goal['progress_pct'] = 0;
            if ($goal['target_value'] > 0) {
                $goal['progress_pct'] = min(100, round(($goal['current_value'] / $goal['target_value']) * 100, 1));
            }
        }

        Response::json($goals);
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('title', 'Title')
          ->maxLength('title', 500, 'Title')
          ->in('category', ['health', 'wealth', 'relationships', 'business', 'mindset', 'custom'], 'Category')
          ->in('goal_type', ['outcome', 'habit', 'milestone'], 'Goal type')
          ->in('priority', ['low', 'medium', 'high', 'critical'], 'Priority');

        if ($v->fails()) {
            Response::error('Validation failed', 422, $v->errors());
        }

        $data = Validator::sanitizeArray($request->body(), [
            'title', 'description', 'category', 'goal_type', 'target_value',
            'unit', 'priority', 'start_date', 'target_date', 'parent_goal_id'
        ]);

        $data['workspace_id'] = Auth::workspaceId();
        $data['user_id'] = Auth::id();
        $data['status'] = 'not_started';
        $data['current_value'] = 0;

        $id = Database::insert('goals', $data);
        $goal = Database::fetch("SELECT * FROM goals WHERE id = ?", [$id]);

        // Log analytics event
        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'goal_created',
            'entity_type' => 'goal',
            'entity_id' => $id,
            'event_date' => date('Y-m-d'),
        ]);

        Response::created($goal);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $goal = Database::fetch(
            "SELECT g.*, u.name as user_name FROM goals g JOIN users u ON g.user_id = u.id WHERE g.id = ? AND g.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$goal) Response::notFound('Goal not found');

        // Get recent check-ins
        $goal['checkins'] = Database::fetchAll(
            "SELECT * FROM goal_checkins WHERE goal_id = ? ORDER BY checkin_date DESC LIMIT 30",
            [$id]
        );

        // Get sub-goals
        $goal['sub_goals'] = Database::fetchAll(
            "SELECT * FROM goals WHERE parent_goal_id = ? ORDER BY sort_order ASC, created_at ASC",
            [$id]
        );

        // Calculate progress
        $goal['progress_pct'] = 0;
        if ($goal['target_value'] > 0) {
            $goal['progress_pct'] = min(100, round(($goal['current_value'] / $goal['target_value']) * 100, 1));
        }

        Response::json($goal);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $goal = Database::fetch("SELECT * FROM goals WHERE id = ? AND workspace_id = ?", [$id, Auth::workspaceId()]);
        if (!$goal) Response::notFound('Goal not found');

        $allowed = ['title', 'description', 'category', 'goal_type', 'target_value',
                     'current_value', 'unit', 'status', 'priority', 'start_date', 'target_date'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if (isset($data['status']) && $data['status'] === 'completed' && $goal['status'] !== 'completed') {
            $data['completed_at'] = date('Y-m-d H:i:s');
            Database::insert('analytics_events', [
                'workspace_id' => Auth::workspaceId(),
                'user_id' => Auth::id(),
                'event_type' => 'goal_completed',
                'entity_type' => 'goal',
                'entity_id' => $id,
                'event_date' => date('Y-m-d'),
            ]);
        }

        if (!empty($data)) {
            Database::update('goals', $data, 'id = ?', [$id]);
        }

        $updated = Database::fetch("SELECT * FROM goals WHERE id = ?", [$id]);
        Response::json($updated);
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('goals', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Goal not found');
        Response::noContent();
    }

    public function addCheckin(Request $request): void {
        $goalId = (int) $request->param('id');
        $goal = Database::fetch("SELECT * FROM goals WHERE id = ? AND workspace_id = ?", [$goalId, Auth::workspaceId()]);
        if (!$goal) Response::notFound('Goal not found');

        $v = Validator::make($request->body());
        $v->required('checkin_date', 'Check-in date');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = [
            'goal_id' => $goalId,
            'user_id' => Auth::id(),
            'value' => $request->body('value'),
            'note' => Validator::sanitize($request->body('note', '')),
            'checkin_date' => $request->body('checkin_date'),
        ];

        $id = Database::insert('goal_checkins', $data);

        // Update goal's current value if provided
        if ($data['value'] !== null) {
            Database::update('goals', ['current_value' => $data['value']], 'id = ?', [$goalId]);
        }

        $checkin = Database::fetch("SELECT * FROM goal_checkins WHERE id = ?", [$id]);
        Response::created($checkin);
    }

    public function checkins(Request $request): void {
        $goalId = (int) $request->param('id');
        $checkins = Database::fetchAll(
            "SELECT gc.*, u.name as user_name FROM goal_checkins gc
             JOIN users u ON gc.user_id = u.id
             WHERE gc.goal_id = ? ORDER BY gc.checkin_date DESC",
            [$goalId]
        );
        Response::json($checkins);
    }

    public function stats(Request $request): void {
        $workspaceId = Auth::workspaceId();

        $stats = [
            'total' => Database::count('goals', 'workspace_id = ?', [$workspaceId]),
            'in_progress' => Database::count('goals', "workspace_id = ? AND status = 'in_progress'", [$workspaceId]),
            'completed' => Database::count('goals', "workspace_id = ? AND status = 'completed'", [$workspaceId]),
            'not_started' => Database::count('goals', "workspace_id = ? AND status = 'not_started'", [$workspaceId]),
        ];

        $stats['completion_rate'] = $stats['total'] > 0
            ? round(($stats['completed'] / $stats['total']) * 100, 1)
            : 0;

        // Goals due this week
        $stats['due_this_week'] = Database::count(
            'goals',
            "workspace_id = ? AND target_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status != 'completed'",
            [$workspaceId]
        );

        Response::json($stats);
    }
}
