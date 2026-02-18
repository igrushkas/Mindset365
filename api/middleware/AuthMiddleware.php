<?php

class AuthMiddleware {
    public function handle(Request $request): void {
        $token = $request->bearerToken();

        if (!$token) {
            Response::unauthorized('Authentication required');
        }

        $payload = Auth::verifyJWT($token);
        if (!$payload) {
            Response::unauthorized('Invalid or expired token');
        }

        // Verify token exists in database (allows forced logout)
        $tokenHash = Auth::hashToken($token);
        $dbToken = Database::fetch(
            "SELECT * FROM api_tokens WHERE token_hash = ? AND expires_at > NOW()",
            [$tokenHash]
        );

        if (!$dbToken) {
            Response::unauthorized('Token has been revoked');
        }

        // Update last used
        Database::update('api_tokens', ['last_used_at' => date('Y-m-d H:i:s')], 'id = ?', [$dbToken['id']]);

        // Load user
        $user = Database::fetch("SELECT * FROM users WHERE id = ? AND status = 'active'", [$payload['user_id']]);
        if (!$user) {
            Response::unauthorized('User not found or inactive');
        }

        // Add workspace context
        $user['workspace_id'] = $payload['workspace_id'] ?? null;
        Auth::setUser($user);
    }
}
