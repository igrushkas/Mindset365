<?php

class CourseController {
    public function index(Request $request): void {
        $sql = "SELECT c.*, u.name as created_by_name,
                       (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id) as module_count,
                       (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) as enrollment_count
                FROM courses c
                JOIN users u ON c.created_by = u.id
                WHERE c.workspace_id = ?";
        $params = [Auth::workspaceId()];

        if ($status = $request->query('status')) {
            $sql .= " AND c.status = ?";
            $params[] = $status;
        }
        if ($category = $request->query('category')) {
            $sql .= " AND c.category = ?";
            $params[] = $category;
        }

        $sql .= " ORDER BY c.sort_order ASC, c.created_at DESC";
        Response::json(Database::fetchAll($sql, $params));
    }

    public function store(Request $request): void {
        $v = Validator::make($request->body());
        $v->required('title', 'Title')
          ->maxLength('title', 500, 'Title')
          ->in('status', ['draft', 'published', 'archived'], 'Status');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $data = Validator::sanitizeArray($request->body(), [
            'title', 'description', 'category', 'thumbnail_url',
            'status', 'difficulty', 'estimated_duration'
        ]);
        $data['workspace_id'] = Auth::workspaceId();
        $data['created_by'] = Auth::id();
        $data['status'] = $data['status'] ?? 'draft';

        // Generate slug from title
        $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $data['title'] ?? 'course'), '-'));
        $slug .= '-' . time();
        $data['slug'] = $slug;

        if ($request->body('tags')) {
            $data['tags'] = json_encode($request->body('tags'));
        }

        $id = Database::insert('courses', $data);

        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'course_created',
            'entity_type' => 'course',
            'entity_id' => $id,
            'event_date' => date('Y-m-d'),
        ]);

        Response::created(Database::fetch("SELECT * FROM courses WHERE id = ?", [$id]));
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $course = Database::fetch(
            "SELECT c.*, u.name as created_by_name
             FROM courses c
             JOIN users u ON c.created_by = u.id
             WHERE c.id = ? AND c.workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$course) Response::notFound('Course not found');

        $course['tags'] = json_decode($course['tags'] ?? '[]', true);

        // Get modules
        $course['modules'] = Database::fetchAll(
            "SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC",
            [$id]
        );
        foreach ($course['modules'] as &$module) {
            $module['content_config'] = json_decode($module['content_config'] ?? '{}', true);
        }

        // Get enrollment info for current user
        $enrollment = Database::fetch(
            "SELECT * FROM course_enrollments WHERE course_id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        $course['enrollment'] = $enrollment;

        // If enrolled, get completed module IDs
        if ($enrollment) {
            $completions = Database::fetchAll(
                "SELECT module_id FROM course_module_completions WHERE enrollment_id = ?",
                [$enrollment['id']]
            );
            $course['completed_module_ids'] = array_column($completions, 'module_id');
        } else {
            $course['completed_module_ids'] = [];
        }

        // Enrollment count
        $course['enrollment_count'] = Database::count('course_enrollments', 'course_id = ?', [$id]);

        Response::json($course);
    }

    public function update(Request $request): void {
        $id = (int) $request->param('id');
        $course = Database::fetch("SELECT * FROM courses WHERE id = ? AND workspace_id = ?", [$id, Auth::workspaceId()]);
        if (!$course) Response::notFound('Course not found');

        $allowed = ['title', 'description', 'category', 'thumbnail_url',
                     'status', 'difficulty', 'estimated_duration', 'sort_order'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if ($request->body('tags')) {
            $data['tags'] = json_encode($request->body('tags'));
        }

        if (!empty($data)) {
            Database::update('courses', $data, 'id = ?', [$id]);
        }

        Response::json(Database::fetch("SELECT * FROM courses WHERE id = ?", [$id]));
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $deleted = Database::delete('courses', 'id = ? AND workspace_id = ?', [$id, Auth::workspaceId()]);
        if (!$deleted) Response::notFound('Course not found');
        Response::noContent();
    }

    public function addModule(Request $request): void {
        $courseId = (int) $request->param('id');
        $course = Database::fetch("SELECT * FROM courses WHERE id = ? AND workspace_id = ?", [$courseId, Auth::workspaceId()]);
        if (!$course) Response::notFound('Course not found');

        $v = Validator::make($request->body());
        $v->required('title', 'Title')
          ->in('module_type', ['video', 'text', 'pdf', 'quiz', 'assignment'], 'Module type');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $maxOrder = Database::fetch(
            "SELECT MAX(sort_order) as max_order FROM course_modules WHERE course_id = ?",
            [$courseId]
        );

        $data = [
            'course_id' => $courseId,
            'title' => Validator::sanitize($request->body('title')),
            'description' => Validator::sanitize($request->body('description', '')),
            'module_type' => $request->body('module_type', 'text'),
            'content_url' => $request->body('content_url'),
            'content_text' => $request->body('content_text'),
            'duration_minutes' => $request->body('duration_minutes') ? (int)$request->body('duration_minutes') : null,
            'sort_order' => ($maxOrder['max_order'] ?? 0) + 1,
            'is_required' => $request->body('is_required', 1) ? 1 : 0,
        ];

        if ($request->body('content_config')) {
            $data['content_config'] = json_encode($request->body('content_config'));
        }

        $id = Database::insert('course_modules', $data);
        Response::created(Database::fetch("SELECT * FROM course_modules WHERE id = ?", [$id]));
    }

    public function updateModule(Request $request): void {
        $courseId = (int) $request->param('id');
        $moduleId = (int) $request->param('mid');

        $module = Database::fetch(
            "SELECT * FROM course_modules WHERE id = ? AND course_id = ?",
            [$moduleId, $courseId]
        );
        if (!$module) Response::notFound('Module not found');

        $allowed = ['title', 'description', 'module_type', 'content_url',
                     'content_text', 'duration_minutes', 'sort_order', 'is_required'];
        $data = Validator::sanitizeArray($request->body(), $allowed);

        if ($request->body('content_config')) {
            $data['content_config'] = json_encode($request->body('content_config'));
        }

        if (!empty($data)) {
            Database::update('course_modules', $data, 'id = ? AND course_id = ?', [$moduleId, $courseId]);
        }

        Response::json(Database::fetch("SELECT * FROM course_modules WHERE id = ?", [$moduleId]));
    }

    public function enroll(Request $request): void {
        $courseId = (int) $request->param('id');
        $course = Database::fetch(
            "SELECT * FROM courses WHERE id = ? AND workspace_id = ?",
            [$courseId, Auth::workspaceId()]
        );
        if (!$course) Response::notFound('Course not found');

        $userId = $request->body('user_id') ? (int)$request->body('user_id') : Auth::id();

        // Check if already enrolled
        $existing = Database::fetch(
            "SELECT * FROM course_enrollments WHERE course_id = ? AND user_id = ?",
            [$courseId, $userId]
        );
        if ($existing) {
            Response::error('User is already enrolled in this course', 409);
        }

        $id = Database::insert('course_enrollments', [
            'course_id' => $courseId,
            'user_id' => $userId,
            'progress_pct' => 0,
            'status' => 'active',
        ]);

        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => $userId,
            'event_type' => 'course_enrolled',
            'entity_type' => 'course',
            'entity_id' => $courseId,
            'event_date' => date('Y-m-d'),
        ]);

        Response::created(Database::fetch("SELECT * FROM course_enrollments WHERE id = ?", [$id]));
    }

    public function completeModule(Request $request): void {
        $courseId = (int) $request->param('id');
        $moduleId = (int) $request->param('mid');

        $module = Database::fetch(
            "SELECT * FROM course_modules WHERE id = ? AND course_id = ?",
            [$moduleId, $courseId]
        );
        if (!$module) Response::notFound('Module not found');

        $enrollment = Database::fetch(
            "SELECT * FROM course_enrollments WHERE course_id = ? AND user_id = ?",
            [$courseId, Auth::id()]
        );
        if (!$enrollment) Response::error('You are not enrolled in this course', 403);

        // Check if already completed
        $existing = Database::fetch(
            "SELECT * FROM course_module_completions WHERE enrollment_id = ? AND module_id = ?",
            [$enrollment['id'], $moduleId]
        );
        if ($existing) {
            Response::error('Module already completed', 409);
        }

        Database::insert('course_module_completions', [
            'enrollment_id' => $enrollment['id'],
            'module_id' => $moduleId,
            'completed_at' => date('Y-m-d H:i:s'),
        ]);

        // Recalculate progress
        $totalModules = Database::count('course_modules', 'course_id = ?', [$courseId]);
        $completedModules = Database::count(
            'course_module_completions',
            'enrollment_id = ?',
            [$enrollment['id']]
        );

        $progressPct = $totalModules > 0 ? round(($completedModules / $totalModules) * 100, 1) : 0;

        $updateData = ['progress_pct' => $progressPct];
        if ($progressPct >= 100) {
            $updateData['status'] = 'completed';
            $updateData['completed_at'] = date('Y-m-d H:i:s');

            Database::insert('analytics_events', [
                'workspace_id' => Auth::workspaceId(),
                'user_id' => Auth::id(),
                'event_type' => 'course_completed',
                'entity_type' => 'course',
                'entity_id' => $courseId,
                'event_date' => date('Y-m-d'),
            ]);
        }

        Database::update('course_enrollments', $updateData, 'id = ?', [$enrollment['id']]);

        Response::json([
            'module_id' => $moduleId,
            'progress_pct' => $progressPct,
            'completed_modules' => $completedModules,
            'total_modules' => $totalModules,
            'course_completed' => $progressPct >= 100,
        ]);
    }
}
