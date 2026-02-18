<?php

class ReferralController {

    public function getMyReferralInfo(Request $request): void {
        $user = Auth::user();

        // Generate referral code if user doesn't have one
        if (empty($user['referral_code'])) {
            $code = $this->generateCode();
            Database::update('users', ['referral_code' => $code], 'id = ?', [Auth::id()]);
            $user['referral_code'] = $code;
        }

        $config = require __DIR__ . '/../config/app.php';
        $referralLink = $config['url'] . '?ref=' . $user['referral_code'];

        // Get referral stats
        $stats = Database::fetch(
            "SELECT
                COUNT(*) as total_referrals,
                SUM(CASE WHEN status IN ('signed_up', 'active') THEN 1 ELSE 0 END) as successful_referrals,
                SUM(CASE WHEN reward_granted = 1 THEN 1 ELSE 0 END) as rewards_earned
             FROM referrals WHERE referrer_id = ?",
            [Auth::id()]
        );

        // Get recent referrals
        $referrals = Database::fetchAll(
            "SELECT r.*, u.name as referred_name, u.email as referred_email_user
             FROM referrals r
             LEFT JOIN users u ON r.referred_user_id = u.id
             WHERE r.referrer_id = ?
             ORDER BY r.created_at DESC LIMIT 20",
            [Auth::id()]
        );

        // Calculate total free months earned
        $freeMonths = ((int)($stats['successful_referrals'] ?? 0)) * 12; // 1 year per referral

        Response::json([
            'referral_code' => $user['referral_code'],
            'referral_link' => $referralLink,
            'stats' => [
                'total_sent' => (int)($stats['total_referrals'] ?? 0),
                'successful' => (int)($stats['successful_referrals'] ?? 0),
                'rewards_earned' => (int)($stats['rewards_earned'] ?? 0),
                'free_months_earned' => $freeMonths,
            ],
            'ai_access_until' => $user['ai_access_until'],
            'referrals' => $referrals,
        ]);
    }

    public function trackClick(Request $request): void {
        $code = $request->body('code');
        if (!$code) Response::error('Referral code required');

        // Verify the code exists
        $referrer = Database::fetch("SELECT id FROM users WHERE referral_code = ?", [$code]);
        if (!$referrer) Response::error('Invalid referral code', 404);

        // Store in session for later use during sign-up
        if (session_status() === PHP_SESSION_NONE) session_start();
        $_SESSION['referral_code'] = $code;

        Response::json(['tracked' => true]);
    }

    public function processReferral(int $newUserId, string $referralCode): void {
        $referrer = Database::fetch("SELECT id FROM users WHERE referral_code = ?", [$referralCode]);
        if (!$referrer) return;

        // Don't let users refer themselves
        if ($referrer['id'] == $newUserId) return;

        // Check if this user was already referred
        $existing = Database::fetch("SELECT id FROM referrals WHERE referred_user_id = ?", [$newUserId]);
        if ($existing) return;

        // Create referral record
        $referralId = Database::insert('referrals', [
            'referrer_id' => $referrer['id'],
            'referral_code' => $referralCode,
            'referred_user_id' => $newUserId,
            'status' => 'signed_up',
            'reward_type' => 'ai_coaching_1yr',
            'signed_up_at' => date('Y-m-d H:i:s'),
        ]);

        // Update new user's referred_by
        Database::update('users', ['referred_by' => $referrer['id']], 'id = ?', [$newUserId]);

        // Grant reward: 1 year of free AI coaching to referrer
        $this->grantReward($referrer['id'], $referralId);

        // Log analytics
        Database::insert('analytics_events', [
            'workspace_id' => Auth::workspaceId() ?? 0,
            'user_id' => $referrer['id'],
            'event_type' => 'referral_success',
            'entity_type' => 'referral',
            'entity_id' => $referralId,
            'event_date' => date('Y-m-d'),
        ]);
    }

    private function grantReward(int $userId, int $referralId): void {
        $user = Database::fetch("SELECT ai_access_until FROM users WHERE id = ?", [$userId]);

        // Extend AI access by 1 year from now (or from current expiry if later)
        $baseDate = new DateTime();
        if ($user['ai_access_until']) {
            $existing = new DateTime($user['ai_access_until']);
            if ($existing > $baseDate) {
                $baseDate = $existing; // Stack on top of existing access
            }
        }
        $baseDate->modify('+1 year');

        Database::update('users', [
            'ai_access_until' => $baseDate->format('Y-m-d H:i:s'),
        ], 'id = ?', [$userId]);

        Database::update('referrals', [
            'reward_granted' => 1,
            'reward_expires_at' => $baseDate->format('Y-m-d H:i:s'),
            'status' => 'active',
        ], 'id = ?', [$referralId]);

        // Send notification to referrer
        Database::insert('notifications', [
            'user_id' => $userId,
            'type' => 'referral_reward',
            'title' => 'Referral Reward Earned!',
            'message' => 'Someone signed up using your referral link. You earned 1 year of free AI coaching!',
            'link' => '/settings',
        ]);
    }

    private function generateCode(): string {
        do {
            $code = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
            $exists = Database::count('users', 'referral_code = ?', [$code]);
        } while ($exists > 0);
        return $code;
    }
}
