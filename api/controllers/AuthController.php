<?php

class AuthController {
    public function google(Request $request): void {
        $credential = $request->body('credential');
        if (!$credential) {
            error_log('[AuthController] No credential in request body. Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
            Response::error('Google credential is required');
        }

        error_log('[AuthController] Received credential, length=' . strlen($credential));

        $oauth = new GoogleOAuth();
        $googleUser = $oauth->verifyIdToken($credential);

        if (!$googleUser) {
            error_log('[AuthController] verifyIdToken returned null');
            Response::error('Invalid Google token', 401);
        }

        error_log('[AuthController] Google user verified: ' . ($googleUser['email'] ?? 'unknown'));

        // Find or create user
        $user = Database::fetch(
            "SELECT * FROM users WHERE google_id = ?",
            [$googleUser['google_id']]
        );

        if (!$user) {
            // Determine role: first user in the system is owner, others are members
            $existingUserCount = Database::count('users');
            $role = $existingUserCount === 0 ? 'owner' : 'member';

            // Create new user
            $userId = Database::insert('users', [
                'google_id' => $googleUser['google_id'],
                'email' => $googleUser['email'],
                'name' => $googleUser['name'],
                'avatar_url' => $googleUser['avatar_url'],
                'role' => $role,
                'status' => 'active',
            ]);

            // For owner: create their own workspace
            // For members: add to the owner's existing workspace
            if ($role === 'owner') {
                $workspaceId = Database::insert('workspaces', [
                    'name' => 'My Workspace',
                    'slug' => 'workspace-' . $userId,
                    'owner_id' => $userId,
                ]);

                Database::insert('workspace_members', [
                    'workspace_id' => $workspaceId,
                    'user_id' => $userId,
                    'role' => 'admin',
                ]);

                // Create default board
                $boardId = Database::insert('boards', [
                    'workspace_id' => $workspaceId,
                    'name' => 'My Tasks',
                    'board_type' => 'kanban',
                    'color' => '#6C5CE7',
                    'created_by' => $userId,
                ]);

                $columns = ['To Do', 'In Progress', 'Review', 'Done'];
                $colors = ['#636e72', '#0984e3', '#fdcb6e', '#00b894'];
                foreach ($columns as $i => $col) {
                    Database::insert('board_columns', [
                        'board_id' => $boardId,
                        'name' => $col,
                        'color' => $colors[$i],
                        'sort_order' => $i,
                        'is_done_column' => $col === 'Done' ? 1 : 0,
                    ]);
                }
            } else {
                // Add new member to the first existing workspace
                $existingWorkspace = Database::fetch(
                    "SELECT id FROM workspaces ORDER BY id ASC LIMIT 1"
                );
                if ($existingWorkspace) {
                    Database::insert('workspace_members', [
                        'workspace_id' => $existingWorkspace['id'],
                        'user_id' => $userId,
                        'role' => 'member',
                    ]);
                }
            }

            // Process referral code if present
            $referralCode = $request->body('referral_code');
            if ($referralCode) {
                $referralController = new ReferralController();
                $referralController->processReferral($userId, $referralCode);
            }

            // Initialize trial credits for new user
            CreditService::initTrialCredits($userId);

            $user = Database::fetch("SELECT * FROM users WHERE id = ?", [$userId]);
            $user['is_new'] = true;
        } else {
            // Update last login
            Database::update('users', [
                'last_login_at' => date('Y-m-d H:i:s'),
                'avatar_url' => $googleUser['avatar_url'],
                'name' => $googleUser['name'],
            ], 'id = ?', [$user['id']]);
        }

        // Get user's workspace
        $workspace = Database::fetch(
            "SELECT w.* FROM workspaces w
             JOIN workspace_members wm ON w.id = wm.workspace_id
             WHERE wm.user_id = ? ORDER BY w.id ASC LIMIT 1",
            [$user['id']]
        );

        $workspaceId = $workspace ? $workspace['id'] : null;

        // Clean up expired tokens for this user
        Database::delete('api_tokens', "user_id = ? AND expires_at < NOW()", [$user['id']]);

        // Generate JWT
        $config = require __DIR__ . '/../config/app.php';
        $jwt = Auth::generateJWT([
            'user_id' => (int) $user['id'],
            'role' => $user['role'],
            'workspace_id' => $workspaceId,
        ]);

        // Store token hash for server-side invalidation (replace if exists)
        $jwtHash = Auth::hashToken($jwt);
        Database::delete('api_tokens', 'token_hash = ?', [$jwtHash]);
        Database::insert('api_tokens', [
            'user_id' => $user['id'],
            'token_hash' => $jwtHash,
            'name' => 'session',
            'expires_at' => gmdate('Y-m-d H:i:s', time() + $config['jwt_expiry']),
        ]);

        // Generate refresh token (replace if exists)
        $refreshToken = Auth::generateRefreshToken();
        $refreshHash = Auth::hashToken($refreshToken);
        Database::delete('api_tokens', 'token_hash = ?', [$refreshHash]);
        Database::insert('api_tokens', [
            'user_id' => $user['id'],
            'token_hash' => $refreshHash,
            'name' => 'refresh',
            'expires_at' => gmdate('Y-m-d H:i:s', time() + $config['refresh_expiry']),
        ]);

        Auth::setRefreshCookie($refreshToken, $config['refresh_expiry']);

        Response::json([
            'token' => $jwt,
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'avatar_url' => $user['avatar_url'],
                'role' => $user['role'],
                'onboarding_completed' => (bool) ($user['onboarding_completed'] ?? false),
            ],
            'workspace' => $workspace,
            'is_new_user' => !empty($user['is_new']),
        ]);
    }

    public function refresh(Request $request): void {
        $refreshToken = Auth::getRefreshCookie();
        if (!$refreshToken) {
            Response::unauthorized('No refresh token');
        }

        $tokenHash = Auth::hashToken($refreshToken);
        $dbToken = Database::fetch(
            "SELECT * FROM api_tokens WHERE token_hash = ? AND name = 'refresh' AND expires_at > NOW()",
            [$tokenHash]
        );

        if (!$dbToken) {
            Auth::clearRefreshCookie();
            Response::unauthorized('Invalid refresh token');
        }

        $user = Database::fetch("SELECT * FROM users WHERE id = ? AND status = 'active'", [$dbToken['user_id']]);
        if (!$user) {
            Response::unauthorized('User not found');
        }

        $workspace = Database::fetch(
            "SELECT w.* FROM workspaces w
             JOIN workspace_members wm ON w.id = wm.workspace_id
             WHERE wm.user_id = ? ORDER BY w.id ASC LIMIT 1",
            [$user['id']]
        );

        $config = require __DIR__ . '/../config/app.php';

        // Generate new JWT
        $jwt = Auth::generateJWT([
            'user_id' => (int) $user['id'],
            'role' => $user['role'],
            'workspace_id' => $workspace ? $workspace['id'] : null,
        ]);

        $jwtHash = Auth::hashToken($jwt);
        Database::delete('api_tokens', 'token_hash = ?', [$jwtHash]);
        Database::insert('api_tokens', [
            'user_id' => $user['id'],
            'token_hash' => $jwtHash,
            'name' => 'session',
            'expires_at' => gmdate('Y-m-d H:i:s', time() + $config['jwt_expiry']),
        ]);

        Response::json([
            'token' => $jwt,
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'avatar_url' => $user['avatar_url'],
                'role' => $user['role'],
            ],
            'workspace' => $workspace,
        ]);
    }

    public function me(Request $request): void {
        $user = Auth::user();
        $workspace = Database::fetch(
            "SELECT w.* FROM workspaces w
             JOIN workspace_members wm ON w.id = wm.workspace_id
             WHERE wm.user_id = ? ORDER BY w.id ASC LIMIT 1",
            [$user['id']]
        );

        Response::json([
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'avatar_url' => $user['avatar_url'],
            'role' => $user['role'],
            'timezone' => $user['timezone'],
            'onboarding_completed' => (bool) ($user['onboarding_completed'] ?? false),
            'preferences' => json_decode($user['preferences'] ?? '{}', true),
            'workspace' => $workspace,
        ]);
    }

    public function logout(Request $request): void {
        $token = $request->bearerToken();
        if ($token) {
            Database::delete('api_tokens', 'token_hash = ?', [Auth::hashToken($token)]);
        }

        // Also delete refresh token
        $refreshToken = Auth::getRefreshCookie();
        if ($refreshToken) {
            Database::delete('api_tokens', 'token_hash = ?', [Auth::hashToken($refreshToken)]);
        }

        Auth::clearRefreshCookie();
        Response::json(['message' => 'Logged out']);
    }

    public function csrf(Request $request): void {
        Response::json(['token' => CsrfMiddleware::generateToken()]);
    }
}
