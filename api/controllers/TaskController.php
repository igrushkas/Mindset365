<?php

class TaskController {
    public function index(Request $request): void {
        $boardId = $request->query('board_id');
        $assignedTo = $request->query('assigned_to');
        $status = $request->query('status');
        $priority = $request->query('priority');

        $sql = "SELECT t.*, u.name as assigned_to_name, u.avatar_url as assigned_to_avatar,
                       bc.name as column_name, b.name as board_name
                FROM tasks t
                JOIN board_columns bc ON t.column_id = bc.id
                JOIN boards b ON t.board_id = b.id
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE b.workspace_id = ?";
        $params = [Auth::workspaceId()];

        if ($boardId) { $sql .= " AND t.board_id = ?"; $params[] = (int)$boardId; }
        if ($assignedTo) { $sql .= " AND t.assigned_to = ?"; $params[] = (int)$assignedTo; }
        if ($priority) { $sql .= " AND t.priority = ?"; $params[] = $priority; }

        $sql .= " ORDER BY t.sort_order ASC, t.created_at DESC";

        Response::json(Database::fetchAll($sql, $params));
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('title', 'Title')
          ->required('board_id', 'Board')
          ->required('column_id', 'Column');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $maxOrder = Database::fetch(
            "SELECT MAX(sort_order) as max_order FROM tasks WHERE column_id = ?",
            [$request->body('column_id')]
        );

        $data = [
            'board_id' => (int)$request->body('board_id'),
            'column_id' => (int)$request->body('column_id'),
            'title' => Validator::sanitize($request->body('title')),
            'description' => $request->body('description', ''),
            'assigned_to' => $request->body('assigned_to') ? (int)$request->body('assigned_to') : null,
            'created_by' => Auth::id(),
            'priority' => $request->body('priority', 'none'),
            'due_date' => $request->body('due_date'),
            'estimated_hours' => $request->body('estimated_hours'),
            'sort_order' => ($maxOrder['max_order'] ?? 0) + 1,
            'parent_task_id' => $request->body('parent_task_id') ? (int)$request->body('parent_task_id') : null,
            'goal_id' => $request->body('goal_id') ? (int)$request->body('goal_id') : null,
            'tags' => $request->body('tags') ? json_encode($request->body('tags')) : null,
        ];

        $id = Database::insert('tasks', $data);

        // Log activity
        Database::insert('task_activity_log', [
            'task_id' => $id,
            'user_id' => Auth::id(),
            'action' => 'created',
            'new_value' => $data['title'],
        ]);

        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'task_created',
            'entity_type' => 'task',
            'entity_id' => $id,
            'event_date' => date('Y-m-d'),
        ]);

        $task = Database::fetch("SELECT * FROM tasks WHERE id = ?", [$id]);
        Response::created($task);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $task = Database::fetch(
            "SELECT t.*, u.name as assigned_to_name, u.avatar_url as assigned_to_avatar,
                    c.name as created_by_name, bc.name as column_name, b.name as board_name
             FROM tasks t
             JOIN boards b ON t.board_id = b.id
             JOIN board_columns bc ON t.column_id = bc.id
             LEFT JOIN users u ON t.assigned_to = u.id
             JOIN users c ON t.created_by = c.id
             WHERE t.id = ? AND b.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$task) Response::notFound('Task not found');

        // Comments
        $task['comments'] = Database::fetchAll(
            "SELECT tc.*, u.name as user_name, u.avatar_url as user_avatar
             FROM task_comments tc JOIN users u ON tc.user_id = u.id
             WHERE tc.task_id = ? ORDER BY tc.created_at ASC",
            [$id]
        );

        // Activity log
        $task['activity'] = Database::fetchAll(
            "SELECT tal.*, u.name as user_name
             FROM task_activity_log tal JOIN users u ON tal.user_id = u.id
             WHERE tal.task_id = ? ORDER BY tal.created_at DESC LIMIT 20",
            [$id]
        );

        // Subtasks
        $task['subtasks'] = Database::fetchAll(
            "SELECT t.*, u.name as assigned_to_name
             FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
             WHERE t.parent_task_id = ? ORDER BY t.sort_order ASC",
            [$id]
        );

        // Parse JSON fields
        $task['tags'] = json_decode($task['tags'] ?? '[]', true);
        $task['attachments'] = json_decode($task['attachments'] ?? '[]', true);

        Response::json($task);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $task = Database::fetch(
            "SELECT t.* FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = ? AND b.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$task) Response::notFound('Task not found');

        $allowed = ['title', 'description', 'assigned_to', 'priority', 'due_date',
                     'estimated_hours', 'actual_hours', 'tags', 'column_id', 'sort_order'];
        $data = [];
        foreach ($allowed as $field) {
            if ($request->has($field)) {
                $value = $request->body($field);
                if ($field === 'tags' && is_array($value)) $value = json_encode($value);
                if (in_array($field, ['title', 'description']) && is_string($value)) $value = Validator::sanitize($value);
                $data[$field] = $value;
            }
        }

        // Track column change (task moved)
        if (isset($data['column_id']) && $data['column_id'] != $task['column_id']) {
            $oldCol = Database::fetch("SELECT name FROM board_columns WHERE id = ?", [$task['column_id']]);
            $newCol = Database::fetch("SELECT name FROM board_columns WHERE id = ?", [$data['column_id']]);

            Database::insert('task_activity_log', [
                'task_id' => $id,
                'user_id' => Auth::id(),
                'action' => 'moved',
                'old_value' => $oldCol['name'] ?? '',
                'new_value' => $newCol['name'] ?? '',
            ]);

            // Check if moved to done column
            if ($newCol && Database::fetch("SELECT is_done_column FROM board_columns WHERE id = ? AND is_done_column = 1", [$data['column_id']])) {
                $data['completed_at'] = date('Y-m-d H:i:s');
                Database::insert('analytics_events', [
                    'workspace_id' => Auth::workspaceId(),
                    'user_id' => Auth::id(),
                    'event_type' => 'task_completed',
                    'entity_type' => 'task',
                    'entity_id' => $id,
                    'event_date' => date('Y-m-d'),
                ]);
            }
        }

        if (!empty($data)) {
            Database::update('tasks', $data, 'id = ?', [$id]);
        }

        Response::json(Database::fetch("SELECT * FROM tasks WHERE id = ?", [$id]));
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $task = Database::fetch(
            "SELECT t.* FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = ? AND b.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$task) Response::notFound('Task not found');
        Database::delete('tasks', 'id = ?', [$id]);
        Response::noContent();
    }

    public function move(Request $request): void {
        $id = (int) $request->param('id');
        $columnId = (int)$request->body('column_id');
        $sortOrder = (int)$request->body('sort_order', 0);

        $task = Database::fetch(
            "SELECT t.* FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = ? AND b.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$task) Response::notFound('Task not found');

        $oldCol = Database::fetch("SELECT name FROM board_columns WHERE id = ?", [$task['column_id']]);
        $newCol = Database::fetch("SELECT name, is_done_column FROM board_columns WHERE id = ?", [$columnId]);

        $updateData = ['column_id' => $columnId, 'sort_order' => $sortOrder];
        if ($newCol && $newCol['is_done_column']) {
            $updateData['completed_at'] = date('Y-m-d H:i:s');
        }

        Database::update('tasks', $updateData, 'id = ?', [$id]);

        if ($task['column_id'] != $columnId) {
            Database::insert('task_activity_log', [
                'task_id' => $id,
                'user_id' => Auth::id(),
                'action' => 'moved',
                'old_value' => $oldCol['name'] ?? '',
                'new_value' => $newCol['name'] ?? '',
            ]);
        }

        Response::json(Database::fetch("SELECT * FROM tasks WHERE id = ?", [$id]));
    }

    public function addComment(Request $request): void {
        $taskId = (int) $request->param('id');
        $content = $request->body('content');
        if (!$content) Response::error('Comment content is required');

        $id = Database::insert('task_comments', [
            'task_id' => $taskId,
            'user_id' => Auth::id(),
            'content' => Validator::sanitize($content),
        ]);

        Database::insert('task_activity_log', [
            'task_id' => $taskId,
            'user_id' => Auth::id(),
            'action' => 'commented',
        ]);

        $comment = Database::fetch(
            "SELECT tc.*, u.name as user_name, u.avatar_url as user_avatar
             FROM task_comments tc JOIN users u ON tc.user_id = u.id WHERE tc.id = ?",
            [$id]
        );
        Response::created($comment);
    }

    public function myTasks(Request $request): void {
        $includeCompleted = $request->query('include_completed');

        $sql = "SELECT t.*, bc.name as column_name, bc.is_done_column,
                       b.name as board_name, b.color as board_color
                FROM tasks t
                JOIN board_columns bc ON t.column_id = bc.id
                JOIN boards b ON t.board_id = b.id
                WHERE t.assigned_to = ? AND b.workspace_id = ?";
        $params = [Auth::id(), Auth::workspaceId()];

        if (!$includeCompleted) {
            $sql .= " AND t.completed_at IS NULL";
        }

        $sql .= " ORDER BY t.completed_at IS NOT NULL ASC, FIELD(t.priority, 'urgent', 'high', 'medium', 'low', 'none'), t.due_date ASC";

        $tasks = Database::fetchAll($sql, $params);
        Response::json($tasks);
    }

    public function reorder(Request $request): void {
        $tasks = $request->body('tasks'); // [{id, sort_order, column_id}]
        if (!is_array($tasks)) Response::error('Tasks array is required');

        Database::beginTransaction();
        try {
            foreach ($tasks as $t) {
                Database::update('tasks', [
                    'sort_order' => (int)$t['sort_order'],
                    'column_id' => (int)$t['column_id'],
                ], 'id = ?', [(int)$t['id']]);
            }
            Database::commit();
        } catch (Exception $e) {
            Database::rollback();
            Response::serverError('Failed to reorder tasks');
        }

        Response::json(['message' => 'Tasks reordered']);
    }
}
