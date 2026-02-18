<?php

class CsrfMiddleware {
    public function handle(Request $request): void {
        // Skip for GET, HEAD, OPTIONS
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'])) {
            return;
        }

        // Skip CSRF check for API calls with Bearer token (JWT is sufficient)
        if ($request->bearerToken()) {
            return;
        }

        // For session-based requests, verify CSRF token
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $token = $request->header('x-csrf-token') ?? $request->body('_csrf_token');
        $sessionToken = $_SESSION['csrf_token'] ?? null;

        if (!$token || !$sessionToken || !hash_equals($sessionToken, $token)) {
            Response::error('Invalid CSRF token', 403);
        }
    }

    public static function generateToken(): string {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
}
