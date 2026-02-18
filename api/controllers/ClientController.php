<?php

class ClientController {
    public function index(Request $request): void {
        $sql = "SELECT c.*, u.name as coach_name, u.avatar_url as coach_avatar
                FROM clients c
                LEFT JOIN users u ON c.coach_id = u.id
                WHERE c.workspace_id = ?";
        $params = [Auth::workspaceId()];

        if ($status = $request->query('status')) {
            $sql .= " AND c.status = ?";
            $params[] = $status;
        }
        if ($coachId = $request->query('coach_id')) {
            $sql .= " AND c.coach_id = ?";
            $params[] = (int)$coachId;
        }

        $sql .= " ORDER BY c.created_at DESC";
        Response::json(Database::fetchAll($sql, $params));
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('name', 'Client name')->maxLength('name', 255, 'Client name');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = Validator::sanitizeArray($request->body(), [
            'name', 'email', 'phone', 'company', 'status', 'package',
            'start_date', 'end_date', 'monthly_rate', 'notes'
        ]);
        $data['workspace_id'] = Auth::workspaceId();
        $data['coach_id'] = $request->body('coach_id') ? (int)$request->body('coach_id') : Auth::id();
        $data['status'] = $data['status'] ?? 'lead';

        if ($request->body('tags')) $data['tags'] = json_encode($request->body('tags'));
        if ($request->body('custom_fields')) $data['custom_fields'] = json_encode($request->body('custom_fields'));

        $id = Database::insert('clients', $data);

        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'client_created',
            'entity_type' => 'client',
            'entity_id' => $id,
            'event_date' => date('Y-m-d'),
        ]);

        Response::created(Database::fetch("SELECT * FROM clients WHERE id = ?", [$id]));
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $client = Database::fetch(
            "SELECT c.*, u.name as coach_name FROM clients c
             LEFT JOIN users u ON c.coach_id = u.id
             WHERE c.id = ? AND c.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$client) Response::notFound('Client not found');

        $client['tags'] = json_decode($client['tags'] ?? '[]', true);
        $client['custom_fields'] = json_decode($client['custom_fields'] ?? '{}', true);

        // Recent sessions
        $client['sessions'] = Database::fetchAll(
            "SELECT cs.*, u.name as coach_name
             FROM client_sessions cs JOIN users u ON cs.coach_id = u.id
             WHERE cs.client_id = ? ORDER BY cs.scheduled_at DESC LIMIT 10",
            [$id]
        );

        // Linked goals
        $client['goals'] = [];
        if ($client['user_id']) {
            $client['goals'] = Database::fetchAll(
                "SELECT * FROM goals WHERE user_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 5",
                [$client['user_id'], Auth::workspaceId()]
            );
        }

        Response::json($client);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $client = Database::fetch("SELECT * FROM clients WHERE id = ? AND workspace_id = ?", [$id, Auth::workspaceId()]);
        if (!$client) Response::notFound('Client not found');

        $allowed = ['name', 'email', 'phone', 'company', 'status', 'package',
                     'start_date', 'end_date', 'monthly_rate', 'notes', 'coach_id',
                     'total_sessions', 'completed_sessions'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if ($request->body('tags')) $data['tags'] = json_encode($request->body('tags'));
        if ($request->body('custom_fields')) $data['custom_fields'] = json_encode($request->body('custom_fields'));

        if (!empty($data)) Database::update('clients', $data, 'id = ?', [$id]);

        Response::json(Database::fetch("SELECT * FROM clients WHERE id = ?", [$id]));
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('clients', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Client not found');
        Response::noContent();
    }

    public function sessions(Request $request): void {
        $clientId = (int) $request->param('id');
        $sessions = Database::fetchAll(
            "SELECT cs.*, u.name as coach_name
             FROM client_sessions cs JOIN users u ON cs.coach_id = u.id
             WHERE cs.client_id = ? ORDER BY cs.scheduled_at DESC",
            [$clientId]
        );
        foreach ($sessions as &$s) {
            $s['action_items'] = json_decode($s['action_items'] ?? '[]', true);
        }
        Response::json($sessions);
    }

    public function addSession(Request $request): void {
        $clientId = (int) $request->param('id');

        $v = Validator::make($request->body());
        $v->required('scheduled_at', 'Scheduled date');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = [
            'client_id' => $clientId,
            'coach_id' => $request->body('coach_id') ? (int)$request->body('coach_id') : Auth::id(),
            'scheduled_at' => $request->body('scheduled_at'),
            'duration_minutes' => $request->body('duration_minutes', 60),
            'status' => $request->body('status', 'scheduled'),
            'notes' => Validator::sanitize($request->body('notes', '')),
        ];

        if ($request->body('action_items')) {
            $data['action_items'] = json_encode($request->body('action_items'));
        }

        $id = Database::insert('client_sessions', $data);

        // Update client session count
        Database::query(
            "UPDATE clients SET total_sessions = total_sessions + 1 WHERE id = ?",
            [$clientId]
        );

        Response::created(Database::fetch("SELECT * FROM client_sessions WHERE id = ?", [$id]));
    }

    public function updateSession(Request $request): void {
        $clientId = (int) $request->param('id');
        $sessionId = (int) $request->param('sid');

        $allowed = ['scheduled_at', 'duration_minutes', 'status', 'notes', 'rating'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if ($request->body('action_items')) {
            $data['action_items'] = json_encode($request->body('action_items'));
        }

        // If completing a session, update client's completed count
        if (isset($data['status']) && $data['status'] === 'completed') {
            $session = Database::fetch("SELECT status FROM client_sessions WHERE id = ?", [$sessionId]);
            if ($session && $session['status'] !== 'completed') {
                Database::query("UPDATE clients SET completed_sessions = completed_sessions + 1 WHERE id = ?", [$clientId]);

                Database::insert('analytics_events', [
                    'workspace_id' => Auth::workspaceId(),
                    'user_id' => Auth::id(),
                    'event_type' => 'session_completed',
                    'entity_type' => 'client_session',
                    'entity_id' => $sessionId,
                    'event_date' => date('Y-m-d'),
                ]);
            }
        }

        if (!empty($data)) Database::update('client_sessions', $data, 'id = ? AND client_id = ?', [$sessionId, $clientId]);

        Response::json(Database::fetch("SELECT * FROM client_sessions WHERE id = ?", [$sessionId]));
    }
}
