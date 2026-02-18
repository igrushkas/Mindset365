<?php

class LemonSqueezy {
    private string $apiKey;
    private string $storeId;
    private string $webhookSecret;
    private array $packages;

    public function __construct() {
        $config = require __DIR__ . '/../config/payment.php';
        $this->apiKey = $config['api_key'];
        $this->storeId = $config['store_id'];
        $this->webhookSecret = $config['webhook_secret'];
        $this->packages = $config['packages'];
    }

    /**
     * Verify webhook signature from Lemon Squeezy (HMAC SHA-256).
     */
    public function verifyWebhookSignature(string $payload, string $signature): bool {
        if (empty($this->webhookSecret) || $this->webhookSecret === 'PENDING') {
            error_log('[LemonSqueezy] Webhook secret not configured');
            return false;
        }
        $computed = hash_hmac('sha256', $payload, $this->webhookSecret);
        return hash_equals($computed, $signature);
    }

    /**
     * Create a checkout URL via Lemon Squeezy API.
     * Embeds user_id in custom_data for webhook reconciliation.
     */
    public function createCheckoutUrl(string $packageKey, int $userId, string $userEmail): ?string {
        $package = $this->packages[$packageKey] ?? null;
        if (!$package || $package['ls_variant_id'] === 'PENDING') {
            error_log("[LemonSqueezy] Package not found or variant not configured: $packageKey");
            return null;
        }

        $payload = [
            'data' => [
                'type' => 'checkouts',
                'attributes' => [
                    'checkout_data' => [
                        'email' => $userEmail,
                        'custom' => [
                            'user_id' => (string) $userId,
                        ],
                    ],
                ],
                'relationships' => [
                    'store' => [
                        'data' => [
                            'type' => 'stores',
                            'id' => $this->storeId,
                        ],
                    ],
                    'variant' => [
                        'data' => [
                            'type' => 'variants',
                            'id' => $package['ls_variant_id'],
                        ],
                    ],
                ],
            ],
        ];

        $ch = curl_init('https://api.lemonsqueezy.com/v1/checkouts');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/vnd.api+json',
                'Accept: application/vnd.api+json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("[LemonSqueezy] Curl error: $curlError");
            return null;
        }

        if ($httpCode !== 201 && $httpCode !== 200) {
            error_log("[LemonSqueezy] API error (HTTP $httpCode): $response");
            return null;
        }

        $data = json_decode($response, true);
        return $data['data']['attributes']['url'] ?? null;
    }

    /**
     * Map a variant ID from webhook to a package definition.
     */
    public function getPackageByVariantId(string $variantId): ?array {
        foreach ($this->packages as $key => $package) {
            if ((string)$package['ls_variant_id'] === $variantId) {
                $package['key'] = $key;
                return $package;
            }
        }
        return null;
    }

    /**
     * Get all available packages for display.
     */
    public function getPackages(): array {
        return $this->packages;
    }
}
