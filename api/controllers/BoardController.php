<?php

class BoardController {
    public function index(Request $request): void {
        $boards = Database::fetchAll(
            "SELECT b.*, u.name as created_by_name,
                    (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) as task_count
             FROM boards b
             JOIN users u ON b.created_by = u.id
             WHERE b.workspace_id = ? AND b.is_archived = 0
             ORDER BY b.sort_order ASC, b.created_at DESC",
            [Auth::workspaceId()]
        );
        Response::json($boards);
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('name', 'Board name')->maxLength('name', 255, 'Board name');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = [
            'workspace_id' => Auth::workspaceId(),
            'name' => Validator::sanitize($request->body('name')),
            'description' => Validator::sanitize($request->body('description', '')),
            'board_type' => $request->body('board_type', 'kanban'),
            'color' => $request->body('color', '#6C5CE7'),
            'created_by' => Auth::id(),
        ];

        $id = Database::insert('boards', $data);

        // Create default columns
        $columns = $request->body('columns', ['To Do', 'In Progress', 'Review', 'Done']);
        $colors = ['#636e72', '#0984e3', '#fdcb6e', '#00b894'];
        foreach ($columns as $i => $col) {
            $colName = is_string($col) ? $col : ($col['name'] ?? 'Column ' . ($i + 1));
            Database::insert('board_columns', [
                'board_id' => $id,
                'name' => Validator::sanitize($colName),
                'color' => $colors[$i % count($colors)] ?? '#636e72',
                'sort_order' => $i,
                'is_done_column' => ($i === count($columns) - 1) ? 1 : 0,
            ]);
        }

        $board = Database::fetch("SELECT * FROM boards WHERE id = ?", [$id]);
        $board['columns'] = Database::fetchAll("SELECT * FROM board_columns WHERE board_id = ? ORDER BY sort_order", [$id]);

        Response::created($board);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $board = Database::fetch(
            "SELECT * FROM boards WHERE id = ? AND workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$board) Response::notFound('Board not found');

        // Get columns
        $board['columns'] = Database::fetchAll(
            "SELECT * FROM board_columns WHERE board_id = ? ORDER BY sort_order ASC",
            [$id]
        );

        // Get tasks for each column
        foreach ($board['columns'] as &$column) {
            $column['tasks'] = Database::fetchAll(
                "SELECT t.*, u.name as assigned_to_name, u.avatar_url as assigned_to_avatar
                 FROM tasks t
                 LEFT JOIN users u ON t.assigned_to = u.id
                 WHERE t.column_id = ?
                 ORDER BY t.sort_order ASC",
                [$column['id']]
            );
        }

        Response::json($board);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $board = Database::fetch("SELECT * FROM boards WHERE id = ? AND workspace_id = ?", [$id, Auth::workspaceId()]);
        if (!$board) Response::notFound('Board not found');

        $data = Validator::sanitizeArray($request->body(), ['name', 'description', 'color', 'board_type', 'is_archived', 'sort_order']);
        if (!empty($data)) {
            Database::update('boards', $data, 'id = ?', [$id]);
        }

        Response::json(Database::fetch("SELECT * FROM boards WHERE id = ?", [$id]));
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('boards', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Board not found');
        Response::noContent();
    }

    public function addColumn(Request $request): void {
        $boardId = (int) $request->param('id');
        $board = Database::fetch("SELECT * FROM boards WHERE id = ? AND workspace_id = ?", [$boardId, Auth::workspaceId()]);
        if (!$board) Response::notFound('Board not found');

        $maxOrder = Database::fetch("SELECT MAX(sort_order) as max_order FROM board_columns WHERE board_id = ?", [$boardId]);

        $id = Database::insert('board_columns', [
            'board_id' => $boardId,
            'name' => Validator::sanitize($request->body('name', 'New Column')),
            'color' => $request->body('color', '#636e72'),
            'sort_order' => ($maxOrder['max_order'] ?? 0) + 1,
            'wip_limit' => $request->body('wip_limit'),
        ]);

        Response::created(Database::fetch("SELECT * FROM board_columns WHERE id = ?", [$id]));
    }

    public function updateColumn(Request $request): void {
        $boardId = (int) $request->param('id');
        $colId = (int) $request->param('cid');

        $data = Validator::sanitizeArray($request->body(), ['name', 'color', 'sort_order', 'wip_limit', 'is_done_column']);
        if (!empty($data)) {
            Database::update('board_columns', $data, 'id = ? AND board_id = ?', [$colId, $boardId]);
        }

        Response::json(Database::fetch("SELECT * FROM board_columns WHERE id = ?", [$colId]));
    }
}
