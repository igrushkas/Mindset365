<?php

class TaskTemplateController {

    /**
     * List all templates for the workspace, grouped by phase.
     * Auto-seeds default templates on first access.
     */
    public function index(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $workspaceId = Auth::workspaceId();

        // Auto-seed if no templates exist
        $count = Database::fetch(
            "SELECT COUNT(*) as cnt FROM task_templates WHERE workspace_id = ?",
            [$workspaceId]
        );
        if ((int)($count['cnt'] ?? 0) === 0) {
            $this->seedDefaultTemplates($workspaceId);
        }

        $templates = TaskTemplate::findByWorkspace($workspaceId);
        Response::json($templates);
    }

    /**
     * Show a single template with its tasks.
     */
    public function show(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $id = (int) $request->param('id');
        $template = TaskTemplate::find($id);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        $template['tasks'] = TaskTemplate::getTasks($id);
        Response::json($template);
    }

    /**
     * Create a new template.
     */
    public function store(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $v = Validator::make($request->body());
        $v->required('name', 'Name');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $phase = $request->body('phase', 'foundation');
        if (!in_array($phase, ['foundation', 'growth', 'scale'])) {
            $phase = 'foundation';
        }

        $maxOrder = Database::fetch(
            "SELECT MAX(sort_order) as max_order FROM task_templates WHERE workspace_id = ? AND phase = ?",
            [Auth::workspaceId(), $phase]
        );

        $id = TaskTemplate::create([
            'workspace_id' => Auth::workspaceId(),
            'name' => Validator::sanitize($request->body('name')),
            'description' => $request->body('description', ''),
            'phase' => $phase,
            'sort_order' => ($maxOrder['max_order'] ?? 0) + 1,
            'created_by' => Auth::id(),
        ]);

        Response::created(TaskTemplate::find($id));
    }

    /**
     * Update template metadata.
     */
    public function update(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $id = (int) $request->param('id');
        $template = TaskTemplate::find($id);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        $allowed = ['name', 'description', 'phase', 'sort_order', 'is_active'];
        $data = [];
        foreach ($allowed as $field) {
            if ($request->has($field)) {
                $value = $request->body($field);
                if (in_array($field, ['name', 'description'])) $value = Validator::sanitize($value);
                if ($field === 'phase' && !in_array($value, ['foundation', 'growth', 'scale'])) continue;
                $data[$field] = $value;
            }
        }

        if (!empty($data)) {
            TaskTemplate::updateById($id, $data);
        }

        Response::json(TaskTemplate::find($id));
    }

    /**
     * Delete a template (cascades to template_tasks via FK).
     */
    public function destroy(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $id = (int) $request->param('id');
        $template = TaskTemplate::find($id);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        TaskTemplate::deleteById($id);
        Response::noContent();
    }

    /**
     * Add a task to a template.
     */
    public function addTask(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $templateId = (int) $request->param('id');
        $template = TaskTemplate::find($templateId);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        $v = Validator::make($request->body());
        $v->required('title', 'Title');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $maxOrder = Database::fetch(
            "SELECT MAX(sort_order) as max_order FROM template_tasks WHERE template_id = ?",
            [$templateId]
        );

        $id = Database::insert('template_tasks', [
            'template_id' => $templateId,
            'title' => Validator::sanitize($request->body('title')),
            'description' => $request->body('description', ''),
            'priority' => $request->body('priority', 'medium'),
            'sort_order' => ($maxOrder['max_order'] ?? 0) + 1,
            'estimated_hours' => $request->body('estimated_hours'),
            'tags' => $request->body('tags') ? json_encode($request->body('tags')) : null,
        ]);

        $task = Database::fetch("SELECT * FROM template_tasks WHERE id = ?", [$id]);
        Response::created($task);
    }

    /**
     * Update a task within a template.
     */
    public function updateTask(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $templateId = (int) $request->param('id');
        $taskId = (int) $request->param('tid');

        $template = TaskTemplate::find($templateId);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        $task = Database::fetch("SELECT * FROM template_tasks WHERE id = ? AND template_id = ?", [$taskId, $templateId]);
        if (!$task) Response::notFound('Template task not found');

        $allowed = ['title', 'description', 'priority', 'sort_order', 'estimated_hours', 'tags'];
        $data = [];
        foreach ($allowed as $field) {
            if ($request->has($field)) {
                $value = $request->body($field);
                if (in_array($field, ['title', 'description'])) $value = Validator::sanitize($value);
                if ($field === 'tags' && is_array($value)) $value = json_encode($value);
                $data[$field] = $value;
            }
        }

        if (!empty($data)) {
            Database::update('template_tasks', $data, 'id = ?', [$taskId]);
        }

        Response::json(Database::fetch("SELECT * FROM template_tasks WHERE id = ?", [$taskId]));
    }

    /**
     * Remove a task from a template.
     */
    public function removeTask(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can manage templates');
        }

        $templateId = (int) $request->param('id');
        $taskId = (int) $request->param('tid');

        $template = TaskTemplate::find($templateId);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        Database::delete('template_tasks', 'id = ? AND template_id = ?', [$taskId, $templateId]);
        Response::noContent();
    }

    /**
     * Assign a template to a client — the CORE workflow action.
     * Creates real tasks on the client's board from the template.
     */
    public function assignToClient(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can assign templates');
        }

        $clientId = (int) $request->param('id');
        $templateId = (int) $request->body('template_id');

        if (!$templateId) {
            Response::error('template_id is required');
        }

        // Verify client exists in workspace
        $client = Database::fetch(
            "SELECT c.*, u.name as user_name FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ? AND c.workspace_id = ?",
            [$clientId, Auth::workspaceId()]
        );
        if (!$client) Response::notFound('Client not found');

        // Verify template exists in workspace
        $template = TaskTemplate::find($templateId);
        if (!$template || (int)$template['workspace_id'] !== Auth::workspaceId()) {
            Response::notFound('Template not found');
        }

        // Check if already assigned
        if (TaskTemplate::isAssignedToClient($templateId, $clientId)) {
            Response::error('This template has already been assigned to this client', 409);
        }

        // Get or create board for this client
        $boardName = ($client['name'] ?? 'Client') . ' Tasks';
        $board = Database::fetch(
            "SELECT * FROM boards WHERE workspace_id = ? AND name = ?",
            [Auth::workspaceId(), $boardName]
        );

        if (!$board) {
            // Create board with default columns
            $boardId = Database::insert('boards', [
                'workspace_id' => Auth::workspaceId(),
                'name' => $boardName,
                'description' => 'Tasks for ' . ($client['name'] ?? 'client'),
                'color' => '#6C5CE7',
                'created_by' => Auth::id(),
            ]);

            $columns = [
                ['name' => 'To Do', 'sort_order' => 1, 'is_done_column' => 0],
                ['name' => 'In Progress', 'sort_order' => 2, 'is_done_column' => 0],
                ['name' => 'Review', 'sort_order' => 3, 'is_done_column' => 0],
                ['name' => 'Done', 'sort_order' => 4, 'is_done_column' => 1],
            ];

            foreach ($columns as $col) {
                Database::insert('board_columns', [
                    'board_id' => $boardId,
                    'name' => $col['name'],
                    'sort_order' => $col['sort_order'],
                    'is_done_column' => $col['is_done_column'],
                ]);
            }

            $board = Database::fetch("SELECT * FROM boards WHERE id = ?", [$boardId]);
        } else {
            $boardId = (int)$board['id'];
        }

        // Get the "To Do" column
        $todoColumn = Database::fetch(
            "SELECT id FROM board_columns WHERE board_id = ? AND is_done_column = 0 ORDER BY sort_order ASC LIMIT 1",
            [$boardId]
        );

        if (!$todoColumn) {
            Response::error('Board has no columns. Please fix the board first.');
        }

        // Get all template tasks
        $templateTasks = TaskTemplate::getTasks($templateId);

        if (empty($templateTasks)) {
            Response::error('Template has no tasks to assign');
        }

        // Create real tasks from template
        $tasksCreated = 0;
        Database::beginTransaction();
        try {
            foreach ($templateTasks as $idx => $tt) {
                $tags = $tt['tags'] ? json_decode($tt['tags'], true) : [];
                // Add phase and template info to tags
                $tags[] = $template['phase'];
                $tags[] = 'template:' . $template['name'];

                Database::insert('tasks', [
                    'board_id' => $boardId,
                    'column_id' => (int)$todoColumn['id'],
                    'title' => $tt['title'],
                    'description' => $tt['description'] ?? '',
                    'assigned_to' => $client['user_id'] ? (int)$client['user_id'] : null,
                    'created_by' => Auth::id(),
                    'priority' => $tt['priority'] ?? 'medium',
                    'estimated_hours' => $tt['estimated_hours'],
                    'sort_order' => $idx + 1,
                    'tags' => json_encode($tags),
                ]);
                $tasksCreated++;
            }

            // Record the assignment
            Database::insert('client_template_assignments', [
                'client_id' => $clientId,
                'template_id' => $templateId,
                'assigned_by' => Auth::id(),
                'board_id' => $boardId,
                'tasks_created' => $tasksCreated,
            ]);

            Database::commit();
        } catch (\Exception $e) {
            Database::rollback();
            error_log('[TaskTemplate] Assignment failed: ' . $e->getMessage());
            Response::serverError('Failed to assign template tasks');
        }

        // Log analytics event
        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'template_assigned',
            'entity_type' => 'client',
            'entity_id' => $clientId,
            'event_date' => date('Y-m-d'),
            'metadata' => json_encode([
                'template_id' => $templateId,
                'template_name' => $template['name'],
                'tasks_created' => $tasksCreated,
            ]),
        ]);

        Response::json([
            'message' => "{$tasksCreated} tasks created from \"{$template['name']}\"",
            'tasks_created' => $tasksCreated,
            'board_id' => $boardId,
            'template_name' => $template['name'],
        ]);
    }

    /**
     * Get template assignments for a specific client.
     */
    public function clientTemplates(Request $request): void {
        if (!Auth::isCoach()) {
            Response::forbidden('Only coaches can view client templates');
        }

        $clientId = (int) $request->param('id');

        $client = Database::fetch(
            "SELECT * FROM clients WHERE id = ? AND workspace_id = ?",
            [$clientId, Auth::workspaceId()]
        );
        if (!$client) Response::notFound('Client not found');

        $assignments = TaskTemplate::getClientAssignments($clientId);
        Response::json($assignments);
    }

    /**
     * Auto-seed default templates for a workspace.
     * Called automatically on first access.
     * Content is placeholder — will be replaced with Hormozi-based content.
     */
    private function seedDefaultTemplates(int $workspaceId): void {
        $templates = [
            // Phase: Foundation (0-10 clients)
            [
                'name' => 'Define Your Grand Slam Offer',
                'description' => 'Create an offer so good people feel stupid saying no. The foundation of your entire business.',
                'phase' => 'foundation',
                'sort_order' => 1,
                'tasks' => [
                    ['Write down your dream client\'s biggest pain point', 'What keeps them up at night? What problem are they desperately trying to solve?', 'high'],
                    ['List 3-5 problems your service solves', 'Be specific. Each problem should be something your client would pay money to fix.', 'high'],
                    ['Draft your offer — what is included and what outcome it delivers', 'Focus on the transformation, not the deliverables. What result will they get?', 'high'],
                    ['Apply the Value Equation to your offer', 'Increase Dream Outcome & Perceived Likelihood. Decrease Time Delay & Effort/Sacrifice.', 'medium'],
                    ['Set your pricing (aim for premium, not cheap)', 'Price based on the value of the outcome, not the cost of your time.', 'medium'],
                    ['Create a one-page offer document you can share', 'Clear, concise, compelling. Someone should understand your offer in 60 seconds.', 'medium'],
                ],
            ],
            [
                'name' => 'Identify Your Dream Client',
                'description' => 'Get crystal clear on who you serve so every piece of marketing hits the bullseye.',
                'phase' => 'foundation',
                'sort_order' => 2,
                'tasks' => [
                    ['Define your ideal client avatar (industry, revenue, team size, pain points)', 'Be as specific as possible. "Everyone" is not a target market.', 'high'],
                    ['List 10 places where your dream clients hang out (online and offline)', 'Facebook groups, LinkedIn, conferences, podcasts, forums, etc.', 'high'],
                    ['Research 3 competitors and how they position to this audience', 'What do they promise? Where do they fall short? That is your opportunity.', 'medium'],
                    ['Write your positioning statement: "I help [who] achieve [what] without [pain]"', 'This becomes your north star for all marketing and sales messaging.', 'high'],
                    ['Create a list of 50 potential dream clients by name', 'Real people, real businesses. You should be able to reach out to each one.', 'medium'],
                ],
            ],
            [
                'name' => 'Create Your Lead Magnet',
                'description' => 'Build something so valuable that people give you their attention (and contact info) for free.',
                'phase' => 'foundation',
                'sort_order' => 3,
                'tasks' => [
                    ['Choose your lead magnet format (checklist, guide, video training, audit)', 'Pick the format that best showcases your expertise for your audience.', 'high'],
                    ['Write the lead magnet content (solve one specific problem)', 'Give away your best stuff. Prove you can help before they pay you.', 'high'],
                    ['Create a simple landing page or sign-up form', 'Keep it simple: headline, benefit bullets, and a sign-up form. No distractions.', 'medium'],
                    ['Set up email capture and delivery automation', 'They sign up, they get the lead magnet delivered automatically.', 'medium'],
                    ['Test the full flow: sign-up to delivery', 'Go through it yourself. Then ask 3 people to test it and give feedback.', 'low'],
                ],
            ],
            [
                'name' => 'Launch Your Outreach System',
                'description' => 'Start conversations with potential clients every single day. No outreach = no business.',
                'phase' => 'foundation',
                'sort_order' => 4,
                'tasks' => [
                    ['Choose your primary outreach channel (DMs, email, calls, events)', 'Pick ONE channel to master first before adding more.', 'high'],
                    ['Write 3 outreach scripts/message templates', 'Lead with value, not a pitch. Focus on their problem, not your service.', 'high'],
                    ['Build a daily outreach schedule (minimum 10 contacts per day)', 'Consistency beats everything. Block time for outreach daily.', 'high'],
                    ['Track your outreach numbers: contacts, responses, calls booked', 'What gets measured gets improved. Set up a simple tracking spreadsheet.', 'medium'],
                    ['Create a 3-touch follow-up sequence', 'Most sales happen on follow-up 3-7. Don\'t quit after one message.', 'medium'],
                    ['Book your first 5 discovery calls', 'Action over perfection. Get on calls and learn what your market wants.', 'high'],
                ],
            ],

            // Phase: Growth (10-50 clients)
            [
                'name' => 'Scale Your Offer Suite',
                'description' => 'Build a value ladder so clients can grow with you from entry to premium.',
                'phase' => 'growth',
                'sort_order' => 1,
                'tasks' => [
                    ['Analyze your current client results — what is working best', 'Double down on what gets results. Cut what does not.', 'high'],
                    ['Create a value ladder: entry offer, core offer, premium offer', 'Give people a way to start small and ascend to higher-value offers.', 'high'],
                    ['Design an upsell path from entry to premium', 'Make the next step feel like a natural progression, not a hard sell.', 'medium'],
                    ['Create case studies from your best client results', 'Numbers and stories. Show proof that your system works.', 'medium'],
                    ['Test pricing adjustments on your core offer', 'You are probably undercharging. Test raising prices by 20%.', 'medium'],
                ],
            ],
            [
                'name' => 'Build a Sales System',
                'description' => 'Turn your sales from random conversations into a repeatable, predictable machine.',
                'phase' => 'growth',
                'sort_order' => 2,
                'tasks' => [
                    ['Map your sales process: lead to close in clear steps', 'Write out every step from first contact to payment received.', 'high'],
                    ['Create a sales script for discovery calls', 'Not robotic — a framework that guides the conversation to a decision.', 'high'],
                    ['Build a proposal/presentation template', 'Professional, branded, and focused on the outcome they want.', 'medium'],
                    ['Set up a CRM or tracking system for your pipeline', 'Know where every deal stands. Nothing should fall through the cracks.', 'medium'],
                    ['Implement a follow-up cadence for all open proposals', 'Automate reminders. Follow up until you get a yes or a no.', 'medium'],
                ],
            ],
            [
                'name' => 'Content Marketing Engine',
                'description' => 'Build an audience that knows, likes, and trusts you so leads come to YOU.',
                'phase' => 'growth',
                'sort_order' => 3,
                'tasks' => [
                    ['Choose 2-3 content platforms where your audience is active', 'Go where your dream clients already spend their time.', 'high'],
                    ['Create a 30-day content calendar', 'Plan themes, topics, and posting schedule. Remove daily decision-making.', 'high'],
                    ['Batch-create one week of content', 'Sit down, create 5-7 pieces in one session. Efficiency over daily grinding.', 'medium'],
                    ['Establish a consistent posting schedule', 'Same days, same times. Consistency builds algorithmic and audience trust.', 'medium'],
                    ['Create a system to repurpose one piece of content into 5+', 'One video becomes a post, a reel, a tweet thread, an email, a story.', 'medium'],
                    ['Track engagement metrics and optimize weekly', 'What resonates? Do more of that. What flops? Learn and adjust.', 'low'],
                ],
            ],

            // Phase: Scale (50-100+ clients)
            [
                'name' => 'Systematize Your Operations',
                'description' => 'Build systems so your business runs without you doing everything.',
                'phase' => 'scale',
                'sort_order' => 1,
                'tasks' => [
                    ['Document your top 5 recurring processes as SOPs', 'Write them so someone else could do them without asking you questions.', 'high'],
                    ['Identify bottlenecks: what takes the most time per client', 'Find the 20% of tasks causing 80% of your time drain.', 'high'],
                    ['Set up project management for client delivery', 'Every client should go through the same proven system.', 'medium'],
                    ['Create client onboarding and offboarding checklists', 'First impressions and last impressions matter most. Systematize both.', 'medium'],
                    ['Implement quality control checkpoints', 'Build in reviews and checks so nothing ships below your standard.', 'medium'],
                ],
            ],
            [
                'name' => 'Build Your Team',
                'description' => 'You cannot scale yourself. Hire the right people to multiply your impact.',
                'phase' => 'scale',
                'sort_order' => 2,
                'tasks' => [
                    ['Identify the first 2-3 roles you need to hire', 'What tasks drain your energy or do not require your expertise?', 'high'],
                    ['Write job descriptions and KPIs for each role', 'Clear expectations = clear performance. Define what success looks like.', 'high'],
                    ['Create a hiring process: post, screen, interview, trial', 'A system for hiring, not gut feelings. Include a paid trial period.', 'medium'],
                    ['Build a team training and onboarding system', 'New hires should be productive within their first week.', 'medium'],
                    ['Set up weekly team sync and accountability rhythm', 'Short, focused meetings. Everyone knows their numbers and next actions.', 'medium'],
                ],
            ],
            [
                'name' => 'Scale Revenue to 100+ Clients',
                'description' => 'Optimize your acquisition and delivery to handle volume without breaking.',
                'phase' => 'scale',
                'sort_order' => 3,
                'tasks' => [
                    ['Analyze unit economics: cost per acquisition, lifetime value, margins', 'Know your numbers cold. Profitable growth requires this foundation.', 'high'],
                    ['Identify your highest-ROI acquisition channel and double down', 'Stop spreading thin. Go all-in on what works best.', 'high'],
                    ['Create a referral program for existing clients', 'Happy clients are your best salespeople. Make it easy for them to refer.', 'medium'],
                    ['Explore partnerships and affiliate channels', 'Who already has your dream clients? Partner with them.', 'medium'],
                    ['Set 90-day revenue targets with weekly milestones', 'Big goals broken into small, measurable weekly actions.', 'high'],
                ],
            ],
        ];

        foreach ($templates as $t) {
            $templateId = Database::insert('task_templates', [
                'workspace_id' => $workspaceId,
                'name' => $t['name'],
                'description' => $t['description'],
                'phase' => $t['phase'],
                'sort_order' => $t['sort_order'],
                'created_by' => Auth::id(),
            ]);

            foreach ($t['tasks'] as $idx => $task) {
                Database::insert('template_tasks', [
                    'template_id' => $templateId,
                    'title' => $task[0],
                    'description' => $task[1],
                    'priority' => $task[2],
                    'sort_order' => $idx + 1,
                ]);
            }
        }
    }
}
