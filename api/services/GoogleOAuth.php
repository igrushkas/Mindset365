<?php

class GoogleOAuth {
    private string $clientId;
    private static ?array $googleCerts = null;
    private static int $certsExpiry = 0;

    public function __construct() {
        $config = require __DIR__ . '/../config/auth.php';
        $this->clientId = $config['google_client_id'];
    }

    public function verifyIdToken(string $idToken): ?array {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            error_log('[GoogleOAuth] JWT parts count: ' . count($parts) . ' (expected 3)');
            return null;
        }

        [$headerB64, $payloadB64, $signatureB64] = $parts;

        // Decode header to get key ID
        $header = json_decode($this->base64UrlDecode($headerB64), true);
        if (!$header || ($header['alg'] ?? '') !== 'RS256') {
            error_log('[GoogleOAuth] Invalid header or alg: ' . json_encode($header));
            return null;
        }

        $kid = $header['kid'] ?? null;
        if (!$kid) {
            error_log('[GoogleOAuth] No kid in header');
            return null;
        }

        // Get Google's public keys
        $certs = $this->getGoogleCerts();
        error_log('[GoogleOAuth] Certs keys: ' . implode(', ', array_keys($certs)) . ' | Looking for kid: ' . $kid);
        if (!isset($certs[$kid])) {
            error_log('[GoogleOAuth] kid not found in certs');
            return null;
        }

        // Verify signature
        $publicKey = openssl_pkey_get_public($certs[$kid]);
        if (!$publicKey) {
            error_log('[GoogleOAuth] openssl_pkey_get_public failed: ' . openssl_error_string());
            return null;
        }

        $dataToVerify = "$headerB64.$payloadB64";
        $signature = $this->base64UrlDecode($signatureB64);

        $valid = openssl_verify($dataToVerify, $signature, $publicKey, OPENSSL_ALGO_SHA256);
        if ($valid !== 1) {
            error_log('[GoogleOAuth] Signature verification failed: ' . $valid . ' | openssl_error: ' . openssl_error_string());
            return null;
        }

        // Decode and validate payload
        $payload = json_decode($this->base64UrlDecode($payloadB64), true);
        if (!$payload) {
            error_log('[GoogleOAuth] Payload decode failed');
            return null;
        }

        // Validate issuer
        if (!in_array($payload['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'])) {
            error_log('[GoogleOAuth] Invalid issuer: ' . ($payload['iss'] ?? 'null'));
            return null;
        }

        // Validate audience (must match our client ID)
        if (($payload['aud'] ?? '') !== $this->clientId) {
            error_log('[GoogleOAuth] Audience mismatch: token=' . ($payload['aud'] ?? 'null') . ' config=' . $this->clientId);
            return null;
        }

        // Validate expiration
        if (($payload['exp'] ?? 0) < time()) {
            error_log('[GoogleOAuth] Token expired: exp=' . ($payload['exp'] ?? 0) . ' now=' . time());
            return null;
        }

        // Email must be verified
        if (!($payload['email_verified'] ?? false)) {
            error_log('[GoogleOAuth] Email not verified for: ' . ($payload['email'] ?? 'unknown'));
            return null;
        }

        error_log('[GoogleOAuth] Token verified successfully for: ' . ($payload['email'] ?? 'unknown'));

        return [
            'google_id' => $payload['sub'],
            'email' => $payload['email'],
            'name' => $payload['name'] ?? $payload['email'],
            'avatar_url' => $payload['picture'] ?? null,
        ];
    }

    private function getGoogleCerts(): array {
        if (self::$googleCerts !== null && time() < self::$certsExpiry) {
            return self::$googleCerts;
        }

        $ch = curl_init('https://www.googleapis.com/oauth2/v1/certs');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            // Fallback: try v3 certs endpoint
            return $this->getGoogleCertsV3();
        }

        $certs = json_decode($response, true);
        if (!$certs) return [];

        self::$googleCerts = $certs;
        self::$certsExpiry = time() + 3600; // Cache for 1 hour

        return $certs;
    }

    private function getGoogleCertsV3(): array {
        $ch = curl_init('https://www.googleapis.com/oauth2/v3/certs');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        if (!$data || !isset($data['keys'])) return [];

        $certs = [];
        foreach ($data['keys'] as $key) {
            if (isset($key['kid'], $key['n'], $key['e'])) {
                $pem = $this->jwkToPem($key);
                if ($pem) $certs[$key['kid']] = $pem;
            }
        }

        self::$googleCerts = $certs;
        self::$certsExpiry = time() + 3600;

        return $certs;
    }

    private function jwkToPem(array $jwk): ?string {
        $n = $this->base64UrlDecode($jwk['n']);
        $e = $this->base64UrlDecode($jwk['e']);

        // DER integers must have leading 0x00 if high bit is set (to indicate positive)
        if (ord($n[0]) > 0x7f) {
            $n = "\x00" . $n;
        }
        if (ord($e[0]) > 0x7f) {
            $e = "\x00" . $e;
        }

        // Build DER encoded RSA public key
        $nLen = strlen($n);
        $eLen = strlen($e);

        // Integer encoding for n
        $nEncoded = "\x02" . $this->derLength($nLen) . $n;
        // Integer encoding for e
        $eEncoded = "\x02" . $this->derLength($eLen) . $e;

        // Sequence of n and e
        $seq = $nEncoded . $eEncoded;
        $seqEncoded = "\x30" . $this->derLength(strlen($seq)) . $seq;

        // BitString wrapper
        $bitString = "\x00" . $seqEncoded;
        $bitStringEncoded = "\x03" . $this->derLength(strlen($bitString)) . $bitString;

        // Algorithm identifier for RSA
        $algorithmIdentifier = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";

        // Final sequence
        $publicKeyInfo = $algorithmIdentifier . $bitStringEncoded;
        $publicKeyInfoEncoded = "\x30" . $this->derLength(strlen($publicKeyInfo)) . $publicKeyInfo;

        $pem = "-----BEGIN PUBLIC KEY-----\n";
        $pem .= chunk_split(base64_encode($publicKeyInfoEncoded), 64, "\n");
        $pem .= "-----END PUBLIC KEY-----";

        return $pem;
    }

    private function derLength(int $length): string {
        if ($length < 128) {
            return chr($length);
        }
        $temp = ltrim(pack('N', $length), "\x00");
        return chr(0x80 | strlen($temp)) . $temp;
    }

    private function base64UrlDecode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
