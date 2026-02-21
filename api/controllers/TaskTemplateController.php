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
     *
     * Based on Ereana Swan's Growth System — adapted from Alex Hormozi's
     * $100M Offers, $100M Leads, Value Equation, and Grand Slam Offer frameworks.
     * Organized across three growth phases: Foundation (0-10), Growth (10-50), Scale (50-100+).
     */
    private function seedDefaultTemplates(int $workspaceId): void {
        $templates = [

            // ================================================================
            // PHASE: FOUNDATION (0 → 10 clients)
            // ================================================================

            [
                'name' => 'Craft Your Grand Slam Offer',
                'description' => 'Create an offer so good people feel stupid saying no. This is the cornerstone of everything — your pricing, positioning, and profit all start here.',
                'phase' => 'foundation',
                'sort_order' => 1,
                'tasks' => [
                    ['Identify Your Dream Outcome', 'Write down the single most valuable result your service delivers. Not features — the end transformation. Example: "Go from 0 to 20 paying clients in 90 days." The bigger and more specific, the better.', 'urgent'],
                    ['List Every Problem Between Start and Dream Outcome', 'Map out every obstacle, frustration, and fear your client faces on the journey. Think: before, during, and after working with you. Aim for 20+ problems. These become the building blocks of your offer.', 'high'],
                    ['Turn Problems Into Solutions', 'For each problem you listed, write a specific solution you provide. Each solution is a deliverable or component of your offer. This is how you make your offer feel comprehensive and irresistible.', 'high'],
                    ['Apply the Value Equation to Each Solution', 'Score each solution: Does it increase Dream Outcome? Increase Perceived Likelihood of Success? Decrease Time to Result? Decrease Effort & Sacrifice required? Prioritize solutions that move ALL four levers.', 'high'],
                    ['Stack Your Offer Components', 'Combine your top solutions into an offer stack. Name each component. Assign a value to each. The total perceived value should be 10x your price. Example: "6 weeks of coaching ($3,000 value) + Templates ($500 value) + Community ($1,000 value) = $4,500 value for $997."', 'high'],
                    ['Add Bonuses That Reduce Risk', 'Create 2-3 bonuses that address the biggest objections: "What if it doesn\'t work?" → guarantee. "What if I don\'t have time?" → done-for-you templates. "What if I get stuck?" → direct access to you.', 'medium'],
                    ['Name Your Offer', 'Give it a name that communicates the result, not the process. Bad: "6-Week Coaching Program." Good: "The Client Explosion System" or "Zero to 20 Clients Accelerator." Make it feel like a vehicle to their dream outcome.', 'medium'],
                    ['Set Premium Pricing Based on Value Delivered', 'Price based on the outcome value, NOT your time. If you help someone make $50K more per year, charging $2K-$5K is a steal. Aim for at least 10:1 value-to-price ratio. Raise your price until it scares you a little.', 'high'],
                    ['Write Your One-Page Offer Document', 'Create a single page with: Headline (dream outcome), Who it\'s for, What\'s included (the stack), Bonuses, Price, Guarantee, and CTA. Someone should understand your offer in 60 seconds flat.', 'medium'],
                    ['Test Your Offer With 5 Real Conversations', 'Present your offer to 5 potential clients. Track reactions, objections, and questions. Refine based on feedback. The market tells you what works — listen.', 'high'],
                ],
            ],
            [
                'name' => 'Define Your Dream Client',
                'description' => 'Get crystal clear on exactly who you serve. Every dollar wasted on the wrong audience is a dollar stolen from the right one.',
                'phase' => 'foundation',
                'sort_order' => 2,
                'tasks' => [
                    ['Write Your Dream Client Profile', 'Define: industry, revenue range, team size, years in business, and biggest pain point. Be ruthlessly specific. "Female coaches making $50K-$150K who want to hit $300K but are stuck doing everything themselves" is 100x better than "business owners."', 'urgent'],
                    ['Identify Their Top 3 Pain Points', 'What keeps them up at 2am? What have they already tried that failed? What would they pay almost anything to fix right now? Get inside their head. Use their exact language, not yours.', 'high'],
                    ['Map Their Dream Outcome', 'What does their life look like AFTER you help them? Be vivid. Revenue number, lifestyle, feelings, status. "Running a $30K/month business with 2 team members, taking Fridays off, and feeling in control for the first time."', 'high'],
                    ['Research Where They Hang Out Online', 'List 15+ specific places: Facebook groups (by name), LinkedIn hashtags, podcasts they listen to, YouTube channels they watch, newsletters they read, conferences they attend. Be specific — not "social media."', 'high'],
                    ['Study 5 Competitors Serving This Audience', 'Who else is selling to your dream client? What do they promise? What do they charge? What do their reviews say? Where do they fall short? Their weakness is your opportunity.', 'medium'],
                    ['Write Your Positioning Statement', 'Complete this: "I help [specific person] achieve [specific outcome] in [timeframe] without [biggest pain/sacrifice]." This becomes the North Star for ALL your marketing. Every piece of content, every DM, every ad runs through this filter.', 'high'],
                    ['Build Your Dream 100 List', 'Create a list of 100 specific people or businesses who match your ideal client. Real names, real companies. You should be able to find their LinkedIn, email, or DMs. This is your first outreach target list.', 'medium'],
                    ['Validate With 10 Conversations', 'Reach out to 10 people who fit your avatar. Ask about their challenges, what they\'ve tried, what they\'d pay for. Don\'t sell — listen. Use their exact words in your marketing later.', 'medium'],
                ],
            ],
            [
                'name' => 'Build Your Lead Magnet',
                'description' => 'Create something so valuable that strangers happily give you their contact info. This is how you start conversations at scale.',
                'phase' => 'foundation',
                'sort_order' => 3,
                'tasks' => [
                    ['Pick Your Lead Magnet Format', 'Choose based on your audience: PDF checklist (fastest), video training (highest perceived value), free audit/assessment (most qualified leads), quiz (most engaging), or templates/swipe files (most practical). Match the format to how your dream client consumes info.', 'high'],
                    ['Solve One Specific, Painful Problem', 'Your lead magnet should solve ONE narrow problem completely. Not "how to grow your business" but "the exact 5-step script to book 3 sales calls this week." Narrow + actionable = downloads.', 'urgent'],
                    ['Create the Content', 'Write/record the actual lead magnet. Keep it concise and results-focused. The ideal lead magnet can be consumed in under 15 minutes and gives an immediate quick win. They should think "if the free stuff is this good, the paid stuff must be incredible."', 'high'],
                    ['Build a High-Converting Landing Page', 'Elements needed: Attention-grabbing headline (state the outcome), 3-5 bullet points of what they\'ll learn, social proof if available, email capture form, and zero distractions. No navigation bars, no sidebars. One page, one action.', 'high'],
                    ['Set Up Email Capture + Auto-Delivery', 'Connect your form to an email tool (ConvertKit, Mailchimp, etc). When they submit → instantly deliver the lead magnet via email. Add a thank-you page that sets expectations for what comes next.', 'medium'],
                    ['Create a 3-Email Nurture Sequence', 'After they download: Email 1 (immediate): Deliver the magnet + introduce yourself. Email 2 (day 2): Share a quick win or case study. Email 3 (day 4): Invite them to a call or your core offer. Don\'t be shy — they opted in because they want help.', 'medium'],
                    ['Test the Full Funnel End-to-End', 'Go through the entire flow as if you\'re a prospect. Sign up, receive the magnet, get the emails. Then ask 3 real people to test it. Fix any friction, broken links, or confusing steps before promoting.', 'low'],
                    ['Promote Your Lead Magnet Everywhere', 'Add it to: your social media bios, your email signature, your website header, your content CTAs, and your outreach messages. Every touchpoint should drive to your lead magnet.', 'medium'],
                ],
            ],
            [
                'name' => 'Launch Daily Outreach',
                'description' => 'Start conversations with potential clients every single day. No outreach = no business. This is the fastest path to your first 10 clients.',
                'phase' => 'foundation',
                'sort_order' => 4,
                'tasks' => [
                    ['Choose Your Primary Outreach Channel', 'Pick ONE channel to master first: Instagram DMs, LinkedIn messages, Facebook group engagement, cold email, or phone calls. The best channel is where your dream clients are most active AND responsive. Don\'t spread across 5 channels — own one.', 'urgent'],
                    ['Write 3 Outreach Message Templates', 'Create message templates for: (1) Cold outreach — lead with value/observation, not a pitch. (2) Warm outreach — referencing shared connections or content. (3) Re-engagement — following up with people who went quiet. Each should feel personal, not spammy.', 'high'],
                    ['Build Your "Give First" Engagement System', 'Before you pitch anyone, engage with their content for 3-5 days. Like, comment thoughtfully, share their posts. When you finally reach out, you\'re not a stranger — you\'re someone who already adds value.', 'high'],
                    ['Create a Daily Outreach Block (60 min minimum)', 'Block the same time every day for outreach. Non-negotiable. Treat it like a client meeting you can\'t cancel. Minimum: 10 new contacts per day, 5 follow-ups, 5 engagement actions.', 'urgent'],
                    ['Set Up Simple Tracking', 'Track daily: Messages sent, Responses received, Calls booked, Sales made. Use a spreadsheet or your CRM. What gets measured gets improved. Review numbers weekly and adjust.', 'high'],
                    ['Master the Follow-Up Sequence', 'Create a 5-touch follow-up cadence: Day 1: Initial outreach. Day 3: Value-add follow-up (article, tip, or resource). Day 7: Check-in. Day 14: Different angle or new value. Day 30: "Last check-in" message. 80% of sales happen after the 5th touch.', 'high'],
                    ['Handle the Top 5 Objections', 'Write responses for: "I can\'t afford it" → ROI reframe. "I need to think about it" → isolate the real concern. "I\'m not ready" → cost of waiting. "I\'m working with someone else" → what\'s missing. "Send me more info" → book a call instead.', 'medium'],
                    ['Book Your First 10 Discovery Calls', 'Action over perfection. Your only goal in the first 30 days is to get on calls. Even if you stumble, every call teaches you what the market wants. Track your call-to-close ratio from day one.', 'high'],
                ],
            ],
            [
                'name' => 'Close Your First 10 Clients',
                'description' => 'Turn conversations into paying clients with a simple, repeatable sales process. No sleaze, no pressure — just honest conversations about results.',
                'phase' => 'foundation',
                'sort_order' => 5,
                'tasks' => [
                    ['Create Your Discovery Call Framework', 'Structure: (1) Build rapport — 2 min. (2) Set agenda and get permission to ask questions — 1 min. (3) Understand their situation — 5 min. (4) Identify their pain/problem — 10 min. (5) Paint the dream outcome — 5 min. (6) Present your solution — 5 min. (7) Handle objections — 5 min. (8) Close or next step — 2 min.', 'urgent'],
                    ['Master the Pain Discovery Questions', 'Ask: "What\'s the biggest challenge you\'re facing right now?" "How long has this been going on?" "What have you tried so far?" "What happened?" "How is this affecting your business/income/life?" "What does it cost you to stay stuck?" Go deep — surface answers mean surface commitments.', 'high'],
                    ['Paint the Gap Between Now and Their Dream Outcome', 'After understanding their pain, paint two futures: (1) What happens if nothing changes in 6-12 months? (2) What would life look like if this problem was completely solved? The gap between these two creates urgency. Don\'t manufacture urgency — reveal the urgency that already exists.', 'high'],
                    ['Present Your Offer as the Bridge', 'Transition: "Based on everything you\'ve told me, here\'s exactly how I\'d help you get from [current state] to [dream outcome]..." Present each component of your offer as the solution to a specific problem they mentioned. Personalize it — use their words.', 'high'],
                    ['Practice Objection Handling Until It\'s Natural', 'Role-play the top objections with a friend or record yourself. You should be able to handle any objection without freezing. The goal isn\'t to "overcome" — it\'s to genuinely help them see what\'s really holding them back.', 'medium'],
                    ['Set Up Payment Processing', 'Get a payment system ready: Stripe, PayPal, or manual invoicing at minimum. Offer payment plans for higher-ticket offers (2-3 monthly payments). Remove friction from the buying process — the fewer clicks, the better.', 'medium'],
                    ['Create an Onboarding Sequence for New Clients', 'The moment they pay: Welcome email with next steps, intake questionnaire, calendar link for first session, access to any materials or community. The faster they feel progress, the less buyer\'s remorse. Get a quick win within 48 hours.', 'high'],
                    ['Ask Every Client for a Testimonial After Their First Win', 'As soon as they get a result — even a small one — ask for a testimonial. "Would you mind sharing what\'s changed since we started working together?" Video is best, written is great too. These become your most powerful sales tools.', 'medium'],
                ],
            ],

            // ================================================================
            // PHASE: GROWTH (10 → 50 clients)
            // ================================================================

            [
                'name' => 'Build Your Value Ladder',
                'description' => 'Create multiple offers at different price points so clients can ascend from free to premium. Every rung of the ladder should deliver massive value.',
                'phase' => 'growth',
                'sort_order' => 1,
                'tasks' => [
                    ['Audit Your Current Offer Performance', 'Analyze: What are your best clients buying? What results are they getting? What do they wish you offered? What are they hiring other people for that you could do? Your existing clients tell you exactly what to build next.', 'high'],
                    ['Design Your Free Tier (Lead Magnet / Community)', 'This is the entry point to your world. Options: Free community (Facebook group, Discord), free workshop/masterclass, free assessment, or free mini-course. Goal: demonstrate expertise and build trust at zero cost to them.', 'high'],
                    ['Design Your Low-Ticket Entry Offer ($47-$297)', 'Create a self-serve product that solves a narrow problem: course, templates, workshop recording, or challenge. Purpose: convert cold leads into paying customers with low risk. This "tripwire" proves you can deliver before they invest more.', 'high'],
                    ['Refine Your Core Offer ($997-$5,000)', 'This is your bread and butter — the main coaching/service offer. Should deliver a significant, measurable transformation. Include: direct access to you, proven system, accountability, and community. This is where 60-80% of your revenue comes from.', 'high'],
                    ['Design Your Premium/VIP Offer ($5,000-$25,000+)', 'High-touch, high-result. Options: 1:1 coaching, done-for-you, intensive/retreat, or inner circle mastermind. For clients who want the fastest path, the most access, and the best results. Premium clients are often your easiest — they\'re committed.', 'high'],
                    ['Map the Ascension Path', 'Draw out the journey: Free → Low-ticket → Core → Premium. At each level, what triggers the next step? Natural progression: they finish one level and want more. Don\'t push — make the next step feel like the obvious move.', 'medium'],
                    ['Create Downsell and Continuity Options', 'For people who say no to your core offer: offer a payment plan, a smaller scope, or a DIY version. For clients who finish: offer ongoing support, a membership, or a mastermind. The goal is to never lose someone who wants to work with you.', 'medium'],
                    ['Set Revenue Targets for Each Tier', 'Decide: How many clients at each price point do you need for your revenue goal? Example: 100 x $97 entry + 20 x $2,000 core + 5 x $10,000 premium = $59,700/month. Model the math before you build.', 'medium'],
                ],
            ],
            [
                'name' => 'Build a Repeatable Sales System',
                'description' => 'Turn your sales from ad-hoc conversations into a predictable machine. Know your numbers, know your script, know your close rate.',
                'phase' => 'growth',
                'sort_order' => 2,
                'tasks' => [
                    ['Document Your Entire Sales Process Step by Step', 'Map every touchpoint from "stranger sees your content" to "sends payment." Include: lead capture → nurture → qualify → book call → discovery call → proposal → follow-up → close → onboard. Write it out like a recipe.', 'urgent'],
                    ['Create Your Sales Call Script (CLOSER Framework)', 'Build your script around: C-Clarify their situation, L-Label their problem, O-Overview their past failures, S-Sell the solution (your offer), E-Explain away concerns, R-Reinforce the decision. Practice until it flows naturally, not robotically.', 'high'],
                    ['Build a Qualification Process', 'Not everyone should get on a call with you. Create a short application form: What\'s your biggest challenge? What\'s your current revenue? Are you ready to invest? Timeframe? This saves hours of calls with tire-kickers.', 'high'],
                    ['Set Up Pipeline Tracking (CRM)', 'Track every deal: Lead → Qualified → Call Booked → Call Completed → Proposal Sent → Follow-Up → Won/Lost. Know exactly how many deals are in each stage at all times. Review weekly.', 'high'],
                    ['Create Your Proposal Template', 'Professional, branded one-pager or deck: Recap their situation, state the dream outcome, your solution (offer stack), investment, payment options, guarantee, next step. Send within 1 hour of the call while emotions are high.', 'medium'],
                    ['Implement a Follow-Up Machine', 'After every call: Day 0 → Proposal sent. Day 1 → Check-in email. Day 3 → Value-add (case study or testimonial). Day 7 → Personal video message. Day 14 → "Is this still a priority?" Day 30 → Permission-based close or breakup. Automate as much as possible.', 'high'],
                    ['Track Your Key Sales Metrics Weekly', 'Know your numbers cold: Leads generated, Calls booked, Show-up rate, Close rate, Average deal value, Revenue per call. If you don\'t know these, you\'re guessing. Post them weekly and improve 1% at a time.', 'medium'],
                    ['Build a Testimonial and Case Study Library', 'Collect: Before/after results, video testimonials, written reviews, and specific numbers. Organize by client type and problem solved. Use them in your sales process, content, and proposals. Social proof closes more deals than any pitch.', 'medium'],
                ],
            ],
            [
                'name' => 'Launch Your Content Engine',
                'description' => 'Build an audience that knows, likes, and trusts you so leads come to YOU instead of you chasing them.',
                'phase' => 'growth',
                'sort_order' => 3,
                'tasks' => [
                    ['Pick Your Primary Content Platform', 'Choose ONE platform to dominate first based on where your dream clients are: YouTube (long-form authority), Instagram (visual + reels), LinkedIn (B2B professionals), TikTok (short-form reach), Twitter/X (thought leadership), or Podcast (deep engagement). Master one before adding more.', 'urgent'],
                    ['Define Your 3-5 Content Pillars', 'What topics will you consistently create about? Align them with your offer. Example: (1) Offer creation, (2) Lead generation, (3) Sales conversations, (4) Mindset, (5) Client wins. Every piece of content should fit one of these pillars.', 'high'],
                    ['Create a Content Calendar (30 Days)', 'Plan 30 days of content mapped to your pillars. Include: educational posts (teach), story posts (personal/client), engagement posts (questions/polls), and promotional posts (offer). Mix ratio: 70% value, 20% story, 10% promotion.', 'high'],
                    ['Batch-Create One Week of Content', 'Set aside 3-4 hours. Create 5-7 pieces in one sitting. Write all captions, record all videos, design all graphics. Batching is 3x more efficient than creating daily. Schedule everything in advance.', 'high'],
                    ['Build a Content Repurposing System', 'One long-form piece (video, blog, podcast) becomes: 3-5 short clips, 5-10 social posts, 1 email, 1 thread, multiple stories. Never create from scratch when you can repurpose. Create once, distribute everywhere.', 'medium'],
                    ['Optimize Your Profile for Conversion', 'Your bio should instantly communicate: Who you help, what result you deliver, and how to take the next step (lead magnet link). Your profile is a landing page — every visitor should know what you do in 3 seconds.', 'high'],
                    ['Engage 30 Minutes Daily Before and After Posting', 'Comment on 10 posts in your niche, reply to all comments on your content, DM 5 people who engaged with your posts. The algorithm rewards engagement, and relationships convert better than broadcasting.', 'medium'],
                    ['Track Content Metrics Weekly', 'Monitor: Follower growth, engagement rate, link clicks, DMs received, leads generated from content. Double down on content types that drive leads. Cut what just gets vanity engagement but no business results.', 'low'],
                ],
            ],
            [
                'name' => 'Master the 4 Ways to Get Clients',
                'description' => 'Hormozi\'s Lead Generation Framework: Warm outreach, cold outreach, content, and paid ads. Master these four channels and you\'ll never worry about finding clients again.',
                'phase' => 'growth',
                'sort_order' => 4,
                'tasks' => [
                    ['Warm Outreach: Reach Out to Your Existing Network', 'Make a list of everyone you know: friends, family, former colleagues, social media connections, past clients. Message them: "Hey [name], I\'m helping [type of person] achieve [result]. Know anyone who might be interested?" This is the fastest, free-est lead source.', 'urgent'],
                    ['Warm Outreach: Get Referrals From Every Client', 'After every client win, ask: "Who else do you know who\'s dealing with the same challenge you had?" Make it easy — send them a message they can forward. Offer a referral incentive if it makes sense. Referred leads close 3-5x better.', 'high'],
                    ['Cold Outreach: Build Your Outreach List', 'Use LinkedIn Sales Navigator, Instagram search, Facebook groups, or industry directories to build a list of 500+ dream clients. Organize by: Name, Platform, Relevance Score. Refresh weekly with new names.', 'high'],
                    ['Cold Outreach: Create Value-First DM Scripts', 'Your first message should give, not ask. Lead with: a free audit, a specific observation about their business, a resource they\'d find helpful, or a genuine compliment + question. Never open with "I help [X] do [Y], interested?"', 'high'],
                    ['Content: Post Daily With a Clear CTA', 'Every piece of content should end with a call-to-action. Not always "buy my thing" — alternate: "DM me [keyword] for my free guide," "Comment below if this resonates," "Link in bio to book a free strategy call." Content without a CTA is a hobby, not a business.', 'high'],
                    ['Content: Create One "Big Piece" Weekly', 'One longer-form piece per week: YouTube video, blog post, podcast episode, or LinkedIn article. This is your authority builder. It shows depth of expertise that short posts can\'t. Repurpose it into 5-10 smaller pieces.', 'medium'],
                    ['Paid Ads: Start With $20/Day Retargeting', 'Before running cold ads, retarget people who already know you: website visitors, video viewers, social engagers. These convert 3-10x better than cold ads. $20/day on retargeting can outperform $200/day on cold traffic.', 'medium'],
                    ['Paid Ads: Create a Simple Lead Magnet Funnel', 'Ad → Landing page → Lead magnet → Email sequence → Call booking. Start with one platform (Facebook/Instagram or YouTube). Test 3-5 ad variations. Kill losers fast, scale winners slowly. Don\'t spend money until your organic offer converts.', 'medium'],
                    ['Track All 4 Channels Weekly', 'For each channel, track: Leads generated, Cost per lead, Calls booked, Sales closed, Revenue generated, ROI. Compare channels. Double down on what\'s working. Kill or fix what isn\'t. Review every Friday.', 'high'],
                ],
            ],
            [
                'name' => 'Client Retention & Results Machine',
                'description' => 'Keeping clients is 5x cheaper than finding new ones. Build a system that delivers insane results so clients stay, pay, and refer.',
                'phase' => 'growth',
                'sort_order' => 5,
                'tasks' => [
                    ['Design Your Client Onboarding Experience', 'First 48 hours after purchase: Welcome email, intake form, first call scheduled, access to materials, quick-win assignment. The speed of the first result determines lifetime value. Get them a win in week 1.', 'urgent'],
                    ['Create a 90-Day Client Success Roadmap', 'Map out what success looks like at Day 7, 30, 60, and 90. Set specific milestones. Share this with every client on Day 1. When clients see the path, they trust the process and stay engaged.', 'high'],
                    ['Build Weekly Accountability Touchpoints', 'Implement weekly check-ins: progress update, blockers, next actions. Can be a group call, 1:1 Voxer/Slack, or a simple form they fill out. Accountability is the #1 reason people pay for coaching over DIY.', 'high'],
                    ['Implement a Client Feedback Loop', 'Monthly pulse survey: "How likely are you to recommend us? (1-10)" "What\'s working best?" "What could improve?" Act on feedback publicly. Clients who feel heard stay 2x longer.', 'medium'],
                    ['Create an Offboarding & Graduation Process', 'When a program ends: Celebrate their wins, collect testimonial, present the next offer (ascension), ask for referrals, add to alumni community. Never let a client just... disappear.', 'medium'],
                    ['Set Up a Win Tracking System', 'Document every client win: revenue increase, client acquired, milestone hit, mindset shift. Use these in your marketing, sales calls, and content. A library of proof is your most valuable asset.', 'high'],
                    ['Calculate and Improve Client Lifetime Value', 'LTV = Average payment × Number of payments × Average duration. Know this number. Then work to increase each variable: raise prices, add offers, increase retention. A 20% LTV increase = 20% revenue increase with zero new clients.', 'medium'],
                ],
            ],

            // ================================================================
            // PHASE: SCALE (50 → 100+ clients)
            // ================================================================

            [
                'name' => 'Systematize Your Operations',
                'description' => 'Build systems so your business runs like a machine. If it depends on you doing everything, it\'s a job — not a business.',
                'phase' => 'scale',
                'sort_order' => 1,
                'tasks' => [
                    ['Audit Your Time: Track Every Hour for One Week', 'Log every task you do for 5 business days. Categorize: revenue-generating, client delivery, admin, marketing, and "things only I can do." You\'ll discover you\'re spending 60%+ on tasks someone else could do.', 'urgent'],
                    ['Document Your Top 10 SOPs (Standard Operating Procedures)', 'Write step-by-step processes for your most repeated tasks: client onboarding, content creation, social media posting, invoicing, call prep, follow-up sequences. Write them so a new hire could execute without asking questions.', 'high'],
                    ['Create Client Delivery Templates', 'Standardize: Onboarding forms, session agendas, progress trackers, reporting templates, email sequences. Every client gets the same excellent experience. Consistency is how you scale quality.', 'high'],
                    ['Set Up Automated Workflows', 'Automate everything that doesn\'t require your brain: appointment reminders, follow-up emails, invoice sending, onboarding sequences, feedback collection. Tools: Zapier, Make, or built-in automations in your CRM/tools.', 'high'],
                    ['Implement a Project Management System', 'Move from "everything in your head" to a visual system. Every client, every task, every deadline visible in one place. Assign, track, complete. Nothing falls through the cracks.', 'medium'],
                    ['Build Quality Control Checkpoints', 'Before anything reaches a client, build in review steps. Deliverable checklist, peer review for content, client feedback loops. Your standard should stay high as you grow.', 'medium'],
                    ['Create Client Onboarding and Offboarding Checklists', 'Step-by-step checklists for bringing clients in and graduating them out. First impressions and last impressions define your reputation. Nail both.', 'medium'],
                    ['Schedule a Weekly Operations Review', 'Every Friday: Review all active clients, pipeline status, team tasks, bottlenecks, and next week priorities. 30 minutes. This one habit prevents 90% of fires.', 'medium'],
                ],
            ],
            [
                'name' => 'Build & Lead Your Team',
                'description' => 'You can\'t scale yourself. Hire the right people, train them well, and build a culture of ownership and results.',
                'phase' => 'scale',
                'sort_order' => 2,
                'tasks' => [
                    ['Identify Your First 3 Hires', 'Based on your time audit, identify the roles that free up the most of YOUR revenue-generating time. Common first hires: Virtual assistant (admin), Content manager, Sales support/setter, Client success manager. Hire for your weaknesses.', 'urgent'],
                    ['Write Clear Job Descriptions With KPIs', 'Every role needs: specific responsibilities, measurable success metrics (KPIs), tools they\'ll use, and who they report to. Example: "Client Success Manager — KPI: 90%+ client retention rate, 9+ NPS score."', 'high'],
                    ['Create a Hiring Funnel', 'Post → Application form (with screening questions) → Task/test → Interview → Paid trial (1-2 weeks) → Hire or no-hire decision. Never hire based on resume alone. The paid trial reveals everything.', 'high'],
                    ['Build a Training and Onboarding System', 'Create: Company overview video, SOP library, tool access checklist, 30-day training plan, and shadowing schedule. A new hire should be independently productive within 2 weeks.', 'high'],
                    ['Implement Weekly Team Meetings', 'Short, focused 30-minute weekly sync: Each person shares (1) What they accomplished, (2) What\'s blocked, (3) What they\'re doing next. Plus weekly metrics review. Async updates in Slack/Teams for everything else.', 'medium'],
                    ['Set Up Compensation With Performance Incentives', 'Base pay for stability, bonuses for results. Sales roles: base + commission. Delivery roles: base + retention/satisfaction bonuses. Everyone should win when the business wins.', 'medium'],
                    ['Create a Company Culture Document', 'Write down your values, expectations, and how you work. Examples: "Speed over perfection," "Clients come first," "Own your results." This is your filter for hiring, firing, and daily decisions.', 'medium'],
                    ['Build a Leadership Rhythm', 'Daily: 5-min standup or async check-in. Weekly: Team meeting + 1:1s. Monthly: Performance review + company metrics. Quarterly: Strategy planning + team celebration. Rhythm creates reliability.', 'medium'],
                ],
            ],
            [
                'name' => 'Create a Course or Digital Product',
                'description' => 'Package your expertise into a scalable product that generates revenue without trading your time. One-to-many is how you break the income ceiling.',
                'phase' => 'scale',
                'sort_order' => 3,
                'tasks' => [
                    ['Choose Your Course Topic', 'Pick the topic where: (1) You have proven results, (2) People already pay you for help, (3) You can teach a clear transformation. Don\'t create what you think people want — create what they\'ve already paid for.', 'urgent'],
                    ['Define the Transformation (Point A → Point B)', 'Be specific: "Go from [where they are] to [where they want to be] in [timeframe]." Example: "Go from zero online presence to 1,000 followers and 5 leads/week in 30 days." The clearer the transformation, the easier it sells.', 'high'],
                    ['Outline Your Curriculum (5-8 Modules)', 'Each module = one major milestone on the journey from A to B. Keep it focused. Common mistake: over-teaching. Students want results, not information. Every module should have a clear deliverable they complete.', 'high'],
                    ['Record Your Core Lessons', 'Start simple: screen recording + your voice (Loom), or talking head + slides. Don\'t wait for a studio setup. Version 1.0 just needs to be clear and helpful. You\'ll improve it based on student feedback.', 'high'],
                    ['Create Supporting Materials', 'For each module: worksheets, templates, checklists, or swipe files. These are what students actually use to get results. The video teaches the concept, the materials help them execute.', 'medium'],
                    ['Build a Community Component', 'Add a private group (Facebook, Discord, or Circle) where students can ask questions, share wins, and get peer support. Community increases completion rates by 3-5x and adds massive perceived value.', 'medium'],
                    ['Set Up Your Course Platform', 'Host on: Teachable, Kajabi, Thinkific, Podia, or even a simple members area. Include: video hosting, progress tracking, community access, and certificate of completion. Keep it clean and easy to navigate.', 'medium'],
                    ['Launch With a Founding Members Offer', 'Sell the first 10-20 spots at a discount (50% off) in exchange for feedback and testimonials. This gives you proof, case studies, and improvements before your full-price launch. Email your list, post on social, DM your warmest contacts.', 'high'],
                    ['Create an Evergreen Sales Funnel', 'After launch: Ad or content → Landing page → Free training/webinar → Pitch → Course purchase → Upsell to coaching. This runs 24/7 and generates passive revenue while you sleep.', 'medium'],
                ],
            ],
            [
                'name' => 'Launch a YouTube / Content Authority Channel',
                'description' => 'Build a content asset that generates leads and establishes authority while you sleep. YouTube is the #1 platform for long-term organic reach.',
                'phase' => 'scale',
                'sort_order' => 4,
                'tasks' => [
                    ['Define Your Channel Niche and Viewer Avatar', 'Your channel should target the same dream client as your business. Niche down: not "business coaching" but "helping service-based entrepreneurs land their first 10 clients." Specific niches grow faster than broad ones.', 'high'],
                    ['Research 20 Video Ideas From Your Audience\'s Questions', 'What do your clients ask you most often? What problems do they Google? Use YouTube search autocomplete, AnswerThePublic, and your DMs to find topics people are actively searching for. Answer their exact questions.', 'high'],
                    ['Create Your First 5 Videos', 'Format for authority: Hook (first 10 seconds) → Problem → Solution → Steps → CTA. Keep videos 8-15 minutes for YouTube. Use good audio (more important than camera quality). Deliver genuine value — hold nothing back.', 'urgent'],
                    ['Optimize Titles and Thumbnails for Clicks', 'Titles: Include the keyword, create curiosity, promise a result. "How I Went From 0 to 30 Clients in 90 Days (Exact System)" > "My Business Journey." Thumbnails: Big text, expressive face, contrasting colors. Test 2-3 options per video.', 'high'],
                    ['Establish a Consistent Upload Schedule', 'Start with 1 video per week. Same day, same time. Consistency signals to the algorithm and your audience that you\'re reliable. Increase to 2x/week only when 1x/week feels easy.', 'high'],
                    ['Add Lead Magnets and CTAs to Every Video', 'In every video: mention your free resource (lead magnet) with a link in description. Pin a comment with the link. Add end screens linking to your other videos and landing page. Every viewer is a potential lead.', 'medium'],
                    ['Repurpose Each Video Into 5+ Pieces of Content', 'One 10-min YouTube video becomes: 3 short clips (Reels/Shorts/TikTok), 1 blog post, 1 email newsletter, 5 social media posts (quotes, tips, frameworks), 1 podcast episode (audio extract). Create once, distribute everywhere.', 'medium'],
                    ['Engage With Every Comment for the First 100 Videos', 'Reply to every single comment within 24 hours. This boosts the algorithm AND builds genuine relationships. Many of your best clients will come from YouTube comments. Don\'t outsource this early on.', 'medium'],
                    ['Track Growth Metrics Monthly', 'Monitor: Views, watch time, subscriber growth, click-through rate, lead magnet downloads, and clients acquired from YouTube. It\'s a slow burn — expect real traction at 30-50+ videos. Stay consistent.', 'low'],
                ],
            ],
            [
                'name' => 'Scale Revenue to $100K+/Month',
                'description' => 'Optimize every lever: acquisition, conversion, pricing, retention, and team — to break through the revenue ceiling and build a real asset.',
                'phase' => 'scale',
                'sort_order' => 5,
                'tasks' => [
                    ['Know Your Unit Economics Cold', 'Calculate and track: Cost Per Acquisition (CPA), Lifetime Value (LTV), LTV:CPA ratio (aim for 3:1+), Gross Margin, Net Profit Margin, Revenue Per Employee. If you can\'t recite these from memory, you\'re flying blind.', 'urgent'],
                    ['Identify Your #1 Growth Lever', 'Audit: Which ONE change would have the biggest revenue impact? More leads? Better close rate? Higher prices? Longer retention? Fix the biggest bottleneck first. Don\'t try to improve everything simultaneously.', 'urgent'],
                    ['Implement a Referral System', 'Create a formal referral program: What does the referrer get? (commission, gift, credits) What does the new client get? (discount, bonus) Make it dead simple — a link they can share, automated tracking. Happy clients will refer if you make it easy.', 'high'],
                    ['Build Strategic Partnership Channels', 'Identify 10 businesses that serve your same audience but aren\'t competitors. Propose: co-hosted workshops, affiliate partnerships, cross-promotions, or bundled offers. One good partnership can be worth 50 cold outreach messages.', 'high'],
                    ['Create a High-Ticket Backend Offer', 'For your best clients who want more: annual mastermind ($15K-$50K), done-for-you services, equity partnerships, or licensing your system to other coaches. Your backend offer should be where 30-50% of revenue comes from.', 'high'],
                    ['Set 90-Day Revenue Targets With Weekly Milestones', 'Break your revenue goal into weekly and daily actions: "To hit $100K/month, I need X calls/week at Y close rate at $Z average deal value." Work backwards from the goal to the daily habits. Review progress every Monday.', 'high'],
                    ['Optimize Your Sales Funnel Conversion Rates', 'Measure and improve each step: Ad CTR → Landing page conversion → Email open rate → Call booking rate → Show-up rate → Close rate. A 10% improvement at each step can 2-3x your total revenue.', 'medium'],
                    ['Build Recurring Revenue (MRR)', 'Add a subscription or membership component: monthly mastermind, ongoing coaching retainer, community membership, or SaaS tool. Recurring revenue is the foundation of a sellable business. Aim for 40-60% recurring.', 'high'],
                    ['Plan for Your Next Hire Before You Need Them', 'By the time you feel overwhelmed, you\'re 3 months late. Always be one hire ahead. Have job descriptions ready, a candidate pipeline warm, and funds allocated. Growth stalls when the founder becomes the bottleneck.', 'medium'],
                    ['Run a Quarterly Business Review', 'Every 90 days: Review all KPIs, analyze what worked and what didn\'t, set next quarter targets, reallocate budget to highest-ROI channels, celebrate team wins, and kill projects that aren\'t performing. This is how you compound growth.', 'medium'],
                ],
            ],

            // ================================================================
            // SPECIAL TEMPLATES (Assign to any phase client)
            // ================================================================

            [
                'name' => '80/20 Fast-Start: Make Money This Week',
                'description' => 'The Pareto principle applied to business launch. Focus ONLY on the 20% of actions that generate 80% of revenue. Skip everything else until you\'re making money.',
                'phase' => 'foundation',
                'sort_order' => 0,
                'tasks' => [
                    ['Write Down Your #1 Money-Making Skill', 'What is the ONE thing you can do for someone that they would pay for RIGHT NOW? Not what you want to sell — what people already ask you for help with. That\'s your starting offer. Don\'t overcomplicate it.', 'urgent'],
                    ['Set Your First Offer Price (Start Selling TODAY)', 'Price it at what feels uncomfortable but fair. If you\'re thinking $500, charge $1,000. If you\'re thinking $50/hr, charge $150/hr. You can always adjust — but most people start too low and stay stuck. Revenue cures all problems.', 'urgent'],
                    ['Message 10 People Today Who Need This', 'Open your phone. Text, DM, or email 10 people who have the problem you solve. Don\'t pitch — start a conversation: "Hey, I noticed you\'re working on [X]. I\'ve been helping people with exactly that. Would it be helpful if I shared what\'s been working?" Send these TODAY, not tomorrow.', 'urgent'],
                    ['Book 3 Calls This Week', 'From your 10 conversations, aim to book 3 calls. On the call: (1) Ask about their situation (5 min), (2) Identify their biggest pain (5 min), (3) Share how you\'d help (5 min), (4) Make the offer (2 min). That\'s it. No fancy slides. No website needed.', 'urgent'],
                    ['Close Your First Client (Imperfect Action > Perfect Planning)', 'On your calls, if they\'re a fit, say: "Based on what you\'ve told me, I\'m confident I can help you [result]. I charge [$X]. Want to get started this week?" Collect payment via Stripe, PayPal, Venmo, or even a bank transfer. Done is better than perfect.', 'urgent'],
                    ['Deliver an Amazing Result for Client #1', 'Go above and beyond for your first client. Over-deliver. Check in daily. Get them a quick win within the first 48 hours. Their success story becomes the proof you use to get clients 2-10. Their referral becomes client #2.', 'high'],
                    ['Ask for a Testimonial + Referral on Day 7', 'After their first win, ask: "Would you mind sharing a quick testimonial about your experience so far?" Then: "Who else do you know dealing with [problem]?" One happy client should lead to at least 1-2 warm introductions.', 'high'],
                    ['Repeat: 10 New Conversations Every Single Day', 'This is the 80/20 of business building. Everything else is a distraction until you have 10 paying clients. No website, no logo, no business cards, no course creation. Just conversations → calls → clients → results → referrals. Scale the thing that works.', 'urgent'],
                    ['Cut Everything That Doesn\'t Make Money This Week', 'Stop: Designing logos, building websites, creating courses nobody asked for, optimizing social media bios, watching business YouTube. START: Talking to potential clients, making offers, closing deals, delivering results. Revenue first, everything else second.', 'high'],
                    ['Set Your 30-Day Revenue Target', 'Based on your price and close rate, calculate: "I need X calls to close Y clients at $Z to make [$target]." Write it down. Track it daily. Every morning ask: "What is the ONE thing I can do today that will make me money?" Do that first.', 'high'],
                ],
            ],
            [
                'name' => 'AI Automation for Solopreneurs',
                'description' => 'Eliminate manual work using AI tools. Run your business like a team of 10 — by yourself. Every task that can be automated, should be. Free up your time for revenue-generating activities only.',
                'phase' => 'growth',
                'sort_order' => 6,
                'tasks' => [
                    ['Set Up AI for Content Creation (ChatGPT/Claude)', 'Use AI to: draft social media posts, write email sequences, create blog outlines, generate video scripts, and repurpose long-form into short-form. Create prompt templates for each content type. One hour of AI-assisted content = what used to take a full day.', 'urgent'],
                    ['Automate Email Marketing (ConvertKit + AI)', 'Set up: Welcome sequence (auto-delivered on signup), Nurture sequence (weekly value), Sales sequence (when lead is warm), Re-engagement (for cold leads). Use AI to write the emails, ConvertKit/Mailchimp to send automatically. Set it once, runs forever.', 'urgent'],
                    ['Build a ChatGPT-Powered FAQ/Support Bot', 'Train a custom GPT or chatbot with your FAQs, processes, and common questions. Embed on your website or use in your community. Handles 80% of support questions without you lifting a finger. Tools: CustomGPT, Chatbase, or Intercom with AI.', 'high'],
                    ['Automate Social Media Scheduling', 'Use tools like Buffer, Later, or Metricool to schedule all social posts in advance. Combine with AI content generation: batch-create a month of posts in 2 hours, schedule them all, then focus on engagement only. Stop posting manually every day.', 'high'],
                    ['Set Up Automated Lead Capture and Follow-Up', 'Build a system: Someone downloads your lead magnet → Automatically tagged in your CRM → Enters email nurture sequence → After 3 days, auto-sends calendar booking link → Reminder emails before the call. Zero manual follow-up needed. Tools: Calendly + Zapier + your email tool.', 'high'],
                    ['Use AI for Sales Call Prep and Notes', 'Before each call: AI reviews the lead\'s form responses and generates a personalized call prep doc. After each call: AI tool (Otter.ai, Fireflies, or Fathom) records, transcribes, and summarizes key points + action items. You never take manual notes again.', 'high'],
                    ['Automate Client Onboarding', 'When payment is received → Auto-send welcome email → Auto-create client folder → Auto-share intake form → Auto-book first session → Auto-grant access to community/resources. Trigger: one payment = everything happens automatically. Tools: Zapier/Make + your tools.', 'high'],
                    ['Build AI-Powered Proposal Generation', 'Create a template in Google Docs or Notion. After a discovery call, feed the call notes to AI → AI generates a customized proposal with their specific pain points, goals, and your solution. What took 45 minutes now takes 5 minutes.', 'medium'],
                    ['Set Up Automated Invoicing and Payment Reminders', 'Use Stripe or your payment processor with auto-recurring billing. Set up automatic reminders for failed payments. Auto-send receipts and renewal notices. Auto-generate monthly revenue reports. Never chase an invoice again.', 'medium'],
                    ['Automate Analytics and Weekly Reporting', 'Connect your tools (CRM, email, social, ads) to a dashboard (Google Sheets via Zapier, or Databox). Auto-generate a weekly report every Monday morning: leads, calls, sales, revenue, content performance. Make decisions from data, not gut feelings.', 'medium'],
                    ['Create an AI-Assisted Content Repurposing Pipeline', 'Record ONE video per week. AI pipeline: (1) Descript/Opus transcribes and creates clips, (2) ChatGPT turns transcript into blog post + 10 social posts + email newsletter, (3) Canva AI creates graphics, (4) Buffer schedules everything. 1 video = 20+ pieces of content, mostly automated.', 'medium'],
                    ['Review and Optimize Your Automations Monthly', 'Every month: Check what\'s working, what broke, what can be improved. Update AI prompts based on results. Add new automations as you discover repetitive tasks. Goal: every month, automate one more thing you\'re currently doing manually.', 'low'],
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
