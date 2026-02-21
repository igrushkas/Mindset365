<?php

class ChatController {
    public function sessions(Request $request): void {
        $sessions = Database::fetchAll(
            "SELECT * FROM chat_sessions WHERE user_id = ? AND workspace_id = ?
             ORDER BY last_message_at DESC",
            [Auth::id(), Auth::workspaceId()]
        );
        Response::json($sessions);
    }

    public function createSession(Request $request): void {
        $id = Database::insert('chat_sessions', [
            'user_id' => Auth::id(),
            'workspace_id' => Auth::workspaceId(),
            'title' => Validator::sanitize($request->body('title', 'New Chat')),
            'context_type' => $request->body('context_type', 'general'),
            'context_id' => $request->body('context_id'),
            'system_prompt' => $request->body('system_prompt'),
        ]);

        Response::created(Database::fetch("SELECT * FROM chat_sessions WHERE id = ?", [$id]));
    }

    public function showSession(Request $request): void {
        $id = (int) $request->param('id');
        $session = Database::fetch(
            "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
            [$id, Auth::id()]
        );
        if (!$session) Response::notFound('Chat session not found');

        $session['messages'] = Database::fetchAll(
            "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            [$id]
        );

        Response::json($session);
    }

    public function deleteSession(Request $request): void {
        $id = (int) $request->param('id');
        Database::delete('chat_sessions', 'id = ? AND user_id = ?', [$id, Auth::id()]);
        Response::noContent();
    }

    public function sendMessage(Request $request): void {
        $sessionId = (int) $request->param('id');
        $session = Database::fetch(
            "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
            [$sessionId, Auth::id()]
        );
        if (!$session) Response::notFound('Chat session not found');

        $content = $request->body('content');
        if (!$content) Response::error('Message content is required');

        // Check credits (owner bypasses)
        $aiConfig = require __DIR__ . '/../config/ai.php';
        $isOwner = Auth::isOwner() && ($aiConfig['owner_unlimited'] ?? true);
        $creditsBalance = null;

        if (!$isOwner) {
            $credits = CreditService::getBalance(Auth::id());
            $creditsBalance = (int)$credits['credits_balance'];
            if ($creditsBalance < 1) {
                Response::error('No AI credits remaining. Purchase more credits to continue.', 402);
            }
        }

        // Save user message
        Database::insert('chat_messages', [
            'session_id' => $sessionId,
            'role' => 'user',
            'content' => Validator::sanitize($content),
        ]);

        // Get conversation history
        $history = Database::fetchAll(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            [$sessionId]
        );

        // Build context-aware system prompt
        $systemPrompt = $this->buildSystemPrompt($session);

        // Call AI
        $aiCoach = new AICoach();
        $response = $aiCoach->chat($history, $systemPrompt);

        // Save assistant message
        Database::insert('chat_messages', [
            'session_id' => $sessionId,
            'role' => 'assistant',
            'content' => $response['content'],
            'tokens_used' => $response['tokens'] ?? null,
            'model' => $response['model'] ?? null,
        ]);

        // Update session
        Database::update('chat_sessions', [
            'message_count' => $session['message_count'] + 2,
            'last_message_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$sessionId]);

        // Update title if first message
        if ($session['message_count'] == 0) {
            $title = mb_substr($content, 0, 50);
            if (mb_strlen($content) > 50) $title .= '...';
            Database::update('chat_sessions', ['title' => $title], 'id = ?', [$sessionId]);
        }

        // Deduct credit after successful AI response
        if (!$isOwner) {
            try {
                $creditsBalance = CreditService::deductCredit(
                    Auth::id(),
                    'AI chat message',
                    'chat_session',
                    (string)$sessionId
                );
            } catch (\RuntimeException $e) {
                // Race condition: credit was available at check but not at deduction
                // Message already sent, log but don't fail
                error_log('[Chat] Credit deduction failed after AI response: ' . $e->getMessage());
            }
        }

        // Log analytics
        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId(),
            'user_id' => Auth::id(),
            'event_type' => 'ai_chat',
            'entity_type' => 'chat_session',
            'entity_id' => $sessionId,
            'event_date' => date('Y-m-d'),
        ]);

        $responseData = [
            'role' => 'assistant',
            'content' => $response['content'],
            'tokens_used' => $response['tokens'] ?? null,
        ];
        if (!$isOwner && $creditsBalance !== null) {
            $responseData['credits_remaining'] = $creditsBalance;
        }

        Response::json($responseData);
    }

    private function buildSystemPrompt(array $session): string {
        $base = "You are Ereana Swan, a business growth coach who helps entrepreneurs scale from 0 to 10 to 100 clients. "
              . "You speak in first person as the coach: 'As your coach, here is what I want you to focus on...', 'I need you to...', 'What I see in your business is...'. "
              . "Your methodology is built on the Value Equation: Dream Outcome x Perceived Likelihood / Time Delay x Effort & Sacrifice. "
              . "You help clients craft irresistible offers, build lead generation systems, create scalable sales processes, and systematize operations. "
              . "You are direct, action-oriented, and results-focused. You do not sugarcoat — you tell clients exactly what they need to hear. "
              . "You push clients toward concrete next actions with clear deadlines. Every conversation should end with a specific action item. "
              . "You believe every business can scale with the right offer, the right audience, and the right systems. "
              . "Keep responses concise, practical, and actionable. Use bullet points when listing steps. "
              . "When appropriate, reference the three growth phases: Foundation (0-10 clients), Growth (10-50 clients), and Scale (50-100+ clients).";

        // Add context based on session type
        if ($session['context_type'] !== 'general' && $session['context_id']) {
            switch ($session['context_type']) {
                case 'goal':
                    $goal = Database::fetch("SELECT * FROM goals WHERE id = ?", [$session['context_id']]);
                    if ($goal) {
                        $progress = $goal['target_value'] > 0
                            ? round(($goal['current_value'] / $goal['target_value']) * 100, 1) . '%'
                            : 'N/A';
                        $base .= "\n\nCONTEXT - The user is working on this goal:\n"
                               . "Title: {$goal['title']}\n"
                               . "Category: {$goal['category']}\n"
                               . "Status: {$goal['status']}\n"
                               . "Progress: {$progress}\n"
                               . "Target Date: " . ($goal['target_date'] ?? 'Not set');
                    }
                    break;
                case 'client':
                    $client = Database::fetch("SELECT * FROM clients WHERE id = ?", [$session['context_id']]);
                    if ($client) {
                        $base .= "\n\nCONTEXT - Coaching about this client:\n"
                               . "Name: {$client['name']}\n"
                               . "Status: {$client['status']}\n"
                               . "Package: " . ($client['package'] ?? 'Not set') . "\n"
                               . "Sessions: {$client['completed_sessions']}/{$client['total_sessions']}";
                    }
                    break;
            }
        }

        // Override with custom prompt if set
        if (!empty($session['system_prompt'])) {
            $base = $session['system_prompt'] . "\n\n" . $base;
        }

        return $base;
    }
}
