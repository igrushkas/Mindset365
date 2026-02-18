<?php

class WebhookController {
    /**
     * POST /api/webhooks/lemonsqueezy
     * Handles Lemon Squeezy webhook events.
     * PUBLIC endpoint (no AuthMiddleware) — secured by HMAC signature.
     */
    public function lemonSqueezy(Request $request): void {
        $rawPayload = $request->rawBody();
        $signature = $request->header('x-signature') ?? '';

        $ls = new LemonSqueezy();

        if (!$ls->verifyWebhookSignature($rawPayload, $signature)) {
            error_log('[Webhook] Invalid Lemon Squeezy signature');
            Response::error('Invalid signature', 403);
        }

        $payload = json_decode($rawPayload, true);
        if (!$payload) {
            Response::error('Invalid payload', 400);
        }

        $eventName = $payload['meta']['event_name'] ?? '';

        switch ($eventName) {
            case 'order_created':
                $this->handleOrderCreated($payload);
                break;
            case 'order_refunded':
                $this->handleOrderRefunded($payload);
                break;
            default:
                Response::json(['received' => true]);
        }
    }

    private function handleOrderCreated(array $payload): void {
        $attributes = $payload['data']['attributes'] ?? [];
        $customData = $payload['meta']['custom_data'] ?? [];
        $userId = (int)($customData['user_id'] ?? 0);

        if (!$userId) {
            error_log('[Webhook] No user_id in custom_data');
            Response::error('Missing user_id', 400);
        }

        $user = Database::fetch("SELECT id FROM users WHERE id = ?", [$userId]);
        if (!$user) {
            error_log("[Webhook] User not found: $userId");
            Response::error('User not found', 404);
        }

        $orderId = (string)($payload['data']['id'] ?? '');

        // Idempotency: skip duplicates
        $existing = Database::fetch(
            "SELECT id FROM lemon_squeezy_orders WHERE ls_order_id = ?",
            [$orderId]
        );
        if ($existing) {
            Response::json(['received' => true, 'duplicate' => true]);
        }

        $variantId = (string)($attributes['first_order_item']['variant_id'] ?? '');

        $ls = new LemonSqueezy();
        $package = $ls->getPackageByVariantId($variantId);
        $creditsAmount = $package ? $package['credits'] : 0;

        if ($creditsAmount === 0) {
            error_log("[Webhook] Unknown variant_id: $variantId");
            Response::error('Unknown product variant', 400);
        }

        // Record order
        $lsoId = Database::insert('lemon_squeezy_orders', [
            'user_id' => $userId,
            'ls_order_id' => $orderId,
            'ls_product_id' => (string)($attributes['first_order_item']['product_id'] ?? ''),
            'ls_variant_id' => $variantId,
            'package_name' => $package['name'] ?? null,
            'credits_amount' => $creditsAmount,
            'amount_paid' => (float)($attributes['total'] ?? 0) / 100,
            'currency' => strtoupper($attributes['currency'] ?? 'USD'),
            'status' => 'paid',
            'webhook_payload' => json_encode($payload),
            'webhook_received_at' => gmdate('Y-m-d H:i:s'),
        ]);

        // Add credits
        CreditService::addCredits(
            $userId,
            $creditsAmount,
            'purchase',
            "Purchased {$package['name']} package ({$creditsAmount} credits)",
            'lemon_squeezy_order',
            (string)$lsoId
        );

        // Send notification
        Database::insert('notifications', [
            'user_id' => $userId,
            'type' => 'credits_purchased',
            'title' => 'Credits Added!',
            'message' => "{$creditsAmount} AI coaching credits have been added to your account.",
            'link' => '/billing',
        ]);

        Response::json(['received' => true, 'credits_added' => $creditsAmount]);
    }

    private function handleOrderRefunded(array $payload): void {
        $orderId = (string)($payload['data']['id'] ?? '');
        $order = Database::fetch(
            "SELECT * FROM lemon_squeezy_orders WHERE ls_order_id = ? AND status = 'paid'",
            [$orderId]
        );
        if (!$order) {
            Response::json(['received' => true, 'skipped' => true]);
        }

        Database::update('lemon_squeezy_orders', ['status' => 'refunded'], 'id = ?', [$order['id']]);

        $credits = CreditService::getBalance($order['user_id']);
        $deductAmount = min((int)$order['credits_amount'], (int)$credits['credits_balance']);

        if ($deductAmount > 0) {
            CreditService::addCredits(
                $order['user_id'],
                -$deductAmount,
                'refund',
                "Refund: {$order['package_name']} package",
                'lemon_squeezy_order',
                (string)$order['id']
            );
        }

        Response::json(['received' => true, 'refunded' => true]);
    }
}
