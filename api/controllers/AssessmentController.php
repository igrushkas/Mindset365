<?php

class AssessmentController {

    public function getDefaultTemplate(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $template = Database::fetch(
            "SELECT * FROM assessment_templates WHERE workspace_id = ? AND is_default = 1 AND is_active = 1",
            [$workspaceId]
        );

        if (!$template) {
            // Auto-create default template with Hormozi-inspired questions
            $template = $this->createDefaultTemplate($workspaceId);
        }

        $template['questions'] = Database::fetchAll(
            "SELECT * FROM assessment_questions WHERE template_id = ? ORDER BY sort_order ASC",
            [$template['id']]
        );

        foreach ($template['questions'] as &$q) {
            $q['options'] = json_decode($q['options'] ?? '[]', true);
        }

        Response::json($template);
    }

    public function startAssessment(Request $request): void {
        $templateId = $request->body('template_id');
        if (!$templateId) {
            $template = Database::fetch(
                "SELECT id FROM assessment_templates WHERE workspace_id = ? AND is_default = 1",
                [Auth::workspaceId()]
            );
            $templateId = $template ? $template['id'] : null;
        }

        if (!$templateId) Response::error('No assessment template found');

        // Check if user already has an in-progress assessment
        $existing = Database::fetch(
            "SELECT * FROM assessments WHERE user_id = ? AND template_id = ? AND status = 'in_progress'",
            [Auth::id(), $templateId]
        );

        if ($existing) {
            // Return existing in-progress assessment
            $existing['answers'] = Database::fetchAll(
                "SELECT * FROM assessment_answers WHERE assessment_id = ?",
                [$existing['id']]
            );
            Response::json($existing);
            return;
        }

        $id = Database::insert('assessments', [
            'template_id' => $templateId,
            'user_id' => Auth::id(),
            'workspace_id' => Auth::workspaceId(),
            'client_id' => $request->body('client_id'),
            'status' => 'in_progress',
        ]);

        Response::created(Database::fetch("SELECT * FROM assessments WHERE id = ?", [$id]));
    }

    public function submitAnswer(Request $request): void {
        $assessmentId = (int) $request->param('id');
        $assessment = Database::fetch(
            "SELECT * FROM assessments WHERE id = ? AND user_id = ?",
            [$assessmentId, Auth::id()]
        );
        if (!$assessment) Response::notFound('Assessment not found');

        $questionId = (int) $request->body('question_id');
        $answerValue = $request->body('answer_value');

        // Get question to calculate score
        $question = Database::fetch("SELECT * FROM assessment_questions WHERE id = ?", [$questionId]);
        if (!$question) Response::error('Question not found');

        $score = $this->calculateScore($question, $answerValue);

        // Upsert answer
        $existing = Database::fetch(
            "SELECT id FROM assessment_answers WHERE assessment_id = ? AND question_id = ?",
            [$assessmentId, $questionId]
        );

        if ($existing) {
            Database::update('assessment_answers', [
                'answer_value' => $answerValue,
                'answer_score' => $score,
            ], 'id = ?', [$existing['id']]);
        } else {
            Database::insert('assessment_answers', [
                'assessment_id' => $assessmentId,
                'question_id' => $questionId,
                'answer_value' => $answerValue,
                'answer_score' => $score,
            ]);
        }

        Response::json(['saved' => true, 'score' => $score]);
    }

    public function complete(Request $request): void {
        $assessmentId = (int) $request->param('id');
        $assessment = Database::fetch(
            "SELECT * FROM assessments WHERE id = ? AND user_id = ?",
            [$assessmentId, Auth::id()]
        );
        if (!$assessment) Response::notFound('Assessment not found');

        // Calculate category scores
        $categoryScores = Database::fetchAll(
            "SELECT aq.category,
                    AVG(aa.answer_score) as avg_score,
                    COUNT(*) as question_count
             FROM assessment_answers aa
             JOIN assessment_questions aq ON aa.question_id = aq.id
             WHERE aa.assessment_id = ?
             GROUP BY aq.category",
            [$assessmentId]
        );

        $scores = [];
        $totalScore = 0;
        $totalCategories = 0;
        foreach ($categoryScores as $cs) {
            $scores[$cs['category']] = round((float)$cs['avg_score'], 1);
            $totalScore += (float)$cs['avg_score'];
            $totalCategories++;
        }

        $overallScore = $totalCategories > 0 ? round($totalScore / $totalCategories, 1) : 0;

        // Generate AI recommendations
        $aiSummary = null;
        $aiRecommendations = null;
        try {
            $aiResult = $this->generateRecommendations($scores, $overallScore);
            $aiSummary = $aiResult['summary'];
            $aiRecommendations = $aiResult['recommendations'];
        } catch (Exception $e) {
            error_log('AI recommendation failed: ' . $e->getMessage());
        }

        Database::update('assessments', [
            'status' => 'completed',
            'overall_score' => $overallScore,
            'category_scores' => json_encode($scores),
            'ai_summary' => $aiSummary,
            'ai_recommendations' => $aiRecommendations ? json_encode($aiRecommendations) : null,
            'completed_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$assessmentId]);

        // Mark user onboarding as completed
        Database::update('users', ['onboarding_completed' => 1], 'id = ?', [Auth::id()]);

        $result = Database::fetch("SELECT * FROM assessments WHERE id = ?", [$assessmentId]);
        $result['category_scores'] = json_decode($result['category_scores'], true);
        $result['ai_recommendations'] = json_decode($result['ai_recommendations'] ?? '[]', true);

        Response::json($result);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $assessment = Database::fetch(
            "SELECT * FROM assessments WHERE id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        if (!$assessment) Response::notFound('Assessment not found');

        $assessment['category_scores'] = json_decode($assessment['category_scores'] ?? '{}', true);
        $assessment['ai_recommendations'] = json_decode($assessment['ai_recommendations'] ?? '[]', true);
        $assessment['answers'] = Database::fetchAll(
            "SELECT aa.*, aq.question, aq.category, aq.question_type
             FROM assessment_answers aa
             JOIN assessment_questions aq ON aa.question_id = aq.id
             WHERE aa.assessment_id = ?
             ORDER BY aq.sort_order ASC",
            [$id]
        );

        Response::json($assessment);
    }

    private function calculateScore(array $question, $answer): float {
        switch ($question['question_type']) {
            case 'scale':
                return min(10, max(0, (float)$answer));
            case 'yes_no':
                return ($answer === 'yes' || $answer === true || $answer === '1') ? 10 : 2;
            case 'number':
                return min(10, max(0, (float)$answer));
            case 'multiple_choice':
                $options = json_decode($question['options'] ?? '[]', true);
                foreach ($options as $opt) {
                    if (($opt['value'] ?? '') === $answer) {
                        return (float)($opt['score'] ?? 5);
                    }
                }
                return 5;
            default:
                return 5; // Text answers get neutral score
        }
    }

    private function generateRecommendations(array $categoryScores, float $overallScore): array {
        $aiCoach = new AICoach();

        $scoreText = "Overall business score: $overallScore/10\n";
        foreach ($categoryScores as $cat => $score) {
            $scoreText .= "- $cat: $score/10\n";
        }

        $prompt = "You are Ereana Swan, a business growth coach. Based on this business assessment, provide:\n"
                . "1. A 2-3 sentence summary of where this business stands, written in first person as the coach (e.g., 'Based on what I am seeing...' or 'Here is where your business is right now...')\n"
                . "2. The top 3 priority areas to focus on (JSON array of objects with 'area', 'score', 'recommendation', 'action_items' fields)\n"
                . "Use the Value Equation framework: Dream Outcome x Perceived Likelihood / Time Delay x Effort & Sacrifice.\n"
                . "Frame recommendations around the growth phases: Foundation (0-10 clients), Growth (10-50), Scale (50-100+).\n"
                . "Focus on quick wins that generate immediate revenue.\n\n"
                . "Assessment Results:\n" . $scoreText
                . "\nRespond ONLY with valid JSON: {\"summary\": \"...\", \"recommendations\": [...]}";

        $response = $aiCoach->chat([
            ['role' => 'user', 'content' => $prompt]
        ], 'You are Ereana Swan, a business growth coach. Respond only with valid JSON.');

        $parsed = json_decode($response['content'], true);
        if ($parsed && isset($parsed['summary'])) {
            return $parsed;
        }

        // Fallback if AI doesn't return valid JSON
        return [
            'summary' => $response['content'],
            'recommendations' => [],
        ];
    }

    private function createDefaultTemplate(int $workspaceId): array {
        $templateId = Database::insert('assessment_templates', [
            'workspace_id' => $workspaceId,
            'title' => 'Business Growth Assessment',
            'description' => 'Assess where your business stands today so we can build your growth plan.',
            'is_default' => 1,
            'is_active' => 1,
            'created_by' => Auth::id(),
        ]);

        // Hormozi-inspired assessment questions
        $questions = [
            // Marketing (How are you getting attention?)
            ['Marketing', 'How would you rate your current lead generation efforts?', 'scale', null, 'Think about how many new potential customers you attract weekly.', 1],
            ['Marketing', 'Do you have a documented marketing strategy?', 'yes_no', null, 'A written plan with channels, budgets, and targets.', 2],
            ['Marketing', 'Which marketing channels are you currently using?', 'multiple_choice', json_encode([
                ['value' => 'none', 'label' => 'None yet', 'score' => 1],
                ['value' => 'social_organic', 'label' => 'Social media (organic)', 'score' => 4],
                ['value' => 'paid_ads', 'label' => 'Paid advertising', 'score' => 6],
                ['value' => 'referrals', 'label' => 'Referrals & word of mouth', 'score' => 7],
                ['value' => 'multi_channel', 'label' => 'Multiple channels working together', 'score' => 9],
            ]), null, 3],
            ['Marketing', 'How many leads do you generate per week?', 'number', null, 'Count all inquiries, sign-ups, and warm contacts.', 4],

            // Sales (How are you converting?)
            ['Sales', 'How confident are you in your sales process?', 'scale', null, 'From initial contact to closing the deal.', 5],
            ['Sales', 'What is your approximate close rate on sales calls/meetings?', 'multiple_choice', json_encode([
                ['value' => 'under_10', 'label' => 'Under 10%', 'score' => 2],
                ['value' => '10_25', 'label' => '10-25%', 'score' => 4],
                ['value' => '25_50', 'label' => '25-50%', 'score' => 6],
                ['value' => '50_75', 'label' => '50-75%', 'score' => 8],
                ['value' => 'over_75', 'label' => 'Over 75%', 'score' => 10],
            ]), null, 6],
            ['Sales', 'Do you have a clear, irresistible offer?', 'yes_no', null, 'An offer so good people feel stupid saying no (Hormozi\'s Grand Slam Offer).', 7],
            ['Sales', 'How would you rate your pricing strategy?', 'scale', null, 'Are you charging what you\'re worth? Premium vs race-to-bottom.', 8],

            // Operations (How are you delivering?)
            ['Operations', 'How streamlined are your daily operations?', 'scale', null, 'Do you have systems or are you doing everything manually?', 9],
            ['Operations', 'Do you have documented SOPs (Standard Operating Procedures)?', 'yes_no', null, 'Written processes someone else could follow.', 10],
            ['Operations', 'How would you rate your client delivery/fulfillment?', 'scale', null, 'The quality and consistency of what you deliver.', 11],

            // Finance (How healthy is the money?)
            ['Finance', 'Do you track your revenue and expenses monthly?', 'yes_no', null, 'Regular financial tracking and reporting.', 12],
            ['Finance', 'What is your approximate monthly revenue?', 'multiple_choice', json_encode([
                ['value' => 'pre_revenue', 'label' => 'Pre-revenue', 'score' => 1],
                ['value' => 'under_5k', 'label' => 'Under $5K/month', 'score' => 3],
                ['value' => '5k_10k', 'label' => '$5K - $10K/month', 'score' => 5],
                ['value' => '10k_50k', 'label' => '$10K - $50K/month', 'score' => 7],
                ['value' => 'over_50k', 'label' => 'Over $50K/month', 'score' => 9],
            ]), null, 13],
            ['Finance', 'How would you rate your profit margins?', 'scale', null, 'After all expenses, how much do you keep?', 14],

            // Mindset (How is the operator?)
            ['Mindset', 'How clear are you on your 90-day goals?', 'scale', null, 'Do you know exactly what you need to accomplish in the next 90 days?', 15],
            ['Mindset', 'How would you rate your consistency and discipline?', 'scale', null, 'Doing the work even when you don\'t feel like it.', 16],
            ['Mindset', 'Do you have a coach or mentor currently?', 'yes_no', null, 'Someone holding you accountable and guiding strategy.', 17],

            // Offer/Product
            ['Offer', 'How unique is your offer compared to competitors?', 'scale', null, 'Would someone choose you over 10 other options? Why?', 18],
            ['Offer', 'How would you rate your customer results/testimonials?', 'scale', null, 'Do your clients get amazing results they rave about?', 19],
            ['Offer', 'Do you have a value ladder (multiple offers at different price points)?', 'yes_no', null, 'Low-ticket entry, mid-ticket core, high-ticket premium.', 20],
        ];

        foreach ($questions as $q) {
            Database::insert('assessment_questions', [
                'template_id' => $templateId,
                'category' => $q[0],
                'question' => $q[1],
                'question_type' => $q[2],
                'options' => $q[3],
                'help_text' => $q[4],
                'sort_order' => $q[5],
                'weight' => 1.00,
            ]);
        }

        return Database::fetch("SELECT * FROM assessment_templates WHERE id = ?", [$templateId]);
    }
}
