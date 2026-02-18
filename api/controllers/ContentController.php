<?php

class ContentController {
    public function index(Request $request): void {
        $sql = "SELECT cl.*, u.name as created_by_name
                FROM content_library cl
                JOIN users u ON cl.created_by = u.id
                WHERE cl.workspace_id = ?";
        $params = [Auth::workspaceId()];

        if ($type = $request->query('type')) {
            $sql .= " AND cl.content_type = ?";
            $params[] = $type;
        }
        if ($category = $request->query('category')) {
            $sql .= " AND cl.category = ?";
            $params[] = $category;
        }
        if ($search = $request->query('search')) {
            $sql .= " AND (cl.title LIKE ? OR cl.description LIKE ?)";
            $term = '%' . $search . '%';
            $params[] = $term;
            $params[] = $term;
        }
        if ($tag = $request->query('tag')) {
            $sql .= " AND JSON_CONTAINS(cl.tags, ?)";
            $params[] = json_encode($tag);
        }

        $sql .= " ORDER BY cl.created_at DESC";
        $items = Database::fetchAll($sql, $params);

        foreach ($items as &$item) {
            $item['tags'] = json_decode($item['tags'] ?? '[]', true);
        }

        Response::json($items);
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('title', 'Title')
          ->maxLength('title', 500, 'Title')
          ->in('content_type', ['document', 'template', 'worksheet', 'video', 'audio', 'link'], 'Content type');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = Validator::sanitizeArray($request->body(), [
            'title', 'description', 'content_type', 'category',
            'file_url', 'external_url', 'thumbnail_url'
        ]);
        $data['workspace_id'] = Auth::workspaceId();
        $data['created_by'] = Auth::id();
        $data['download_count'] = 0;

        if ($request->body('tags')) {
            $data['tags'] = json_encode($request->body('tags'));
        }
        if ($request->body('metadata')) {
            $data['metadata'] = json_encode($request->body('metadata'));
        }

        $id = Database::insert('content_library', $data);

        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'content_created',
            'entity_type' => 'content',
            'entity_id' => $id,
            'event_date' => date('Y-m-d'),
        ]);

        $item = Database::fetch("SELECT * FROM content_library WHERE id = ?", [$id]);
        $item['tags'] = json_decode($item['tags'] ?? '[]', true);
        Response::created($item);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $item = Database::fetch(
            "SELECT cl.*, u.name as created_by_name
             FROM content_library cl
             JOIN users u ON cl.created_by = u.id
             WHERE cl.id = ? AND cl.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$item) Response::notFound('Content not found');

        $item['tags'] = json_decode($item['tags'] ?? '[]', true);
        $item['metadata'] = json_decode($item['metadata'] ?? '{}', true);

        // Increment download count
        Database::query(
            "UPDATE content_library SET download_count = download_count + 1 WHERE id = ?",
            [$id]
        );
        $item['download_count'] = (int)$item['download_count'] + 1;

        Response::json($item);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $item = Database::fetch(
            "SELECT * FROM content_library WHERE id = ? AND workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$item) Response::notFound('Content not found');

        $allowed = ['title', 'description', 'content_type', 'category',
                     'file_url', 'external_url', 'thumbnail_url'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if ($request->body('tags')) {
            $data['tags'] = json_encode($request->body('tags'));
        }
        if ($request->body('metadata')) {
            $data['metadata'] = json_encode($request->body('metadata'));
        }

        if (!empty($data)) {
            Database::update('content_library', $data, 'id = ?', [$id]);
        }

        $updated = Database::fetch("SELECT * FROM content_library WHERE id = ?", [$id]);
        $updated['tags'] = json_decode($updated['tags'] ?? '[]', true);
        Response::json($updated);
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('content_library', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Content not found');
        Response::noContent();
    }
}
