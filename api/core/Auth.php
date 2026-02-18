<?php

class Auth {
    private static ?array $user = null;

    public static function generateJWT(array $payload): string {
        $config = require __DIR__ . '/../config/app.php';
        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));

        $payload['iat'] = time();
        $payload['exp'] = time() + $config['jwt_expiry'];
        $payload['iss'] = $config['url'];

        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payloadEncoded", $config['jwt_secret'], true)
        );

        return "$header.$payloadEncoded.$signature";
    }

    public static function verifyJWT(string $token): ?array {
        $config = require __DIR__ . '/../config/app.php';
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $payload, $signature] = $parts;

        // Verify signature
        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", $config['jwt_secret'], true)
        );
        if (!hash_equals($expectedSig, $signature)) return null;

        // Decode payload
        $data = json_decode(self::base64UrlDecode($payload), true);
        if (!$data) return null;

        // Check expiration
        if (isset($data['exp']) && $data['exp'] < time()) return null;

        return $data;
    }

    public static function generateRefreshToken(): string {
        return bin2hex(random_bytes(32));
    }

    public static function hashToken(string $token): string {
        return hash('sha256', $token);
    }

    public static function setUser(array $user): void {
        self::$user = $user;
    }

    public static function user(): ?array {
        return self::$user;
    }

    public static function id(): ?int {
        return self::$user['id'] ?? null;
    }

    public static function role(): ?string {
        return self::$user['role'] ?? null;
    }

    public static function workspaceId(): ?int {
        return self::$user['workspace_id'] ?? null;
    }

    public static function isOwner(): bool {
        return self::role() === 'owner';
    }

    public static function isCoach(): bool {
        return in_array(self::role(), ['owner', 'coach', 'admin']);
    }

    public static function check(): bool {
        return self::$user !== null;
    }

    public static function setRefreshCookie(string $token, int $expiry): void {
        setcookie('refresh_token', $token, [
            'expires' => time() + $expiry,
            'path' => '/api/auth/',
            'domain' => '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function clearRefreshCookie(): void {
        setcookie('refresh_token', '', [
            'expires' => time() - 3600,
            'path' => '/api/auth/',
            'domain' => '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function getRefreshCookie(): ?string {
        return $_COOKIE['refresh_token'] ?? null;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
