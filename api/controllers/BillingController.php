<?php

class BillingController {
    /**
     * GET /billing/credits
     * Returns the authenticated user's credit balance.
     */
    public function credits(Request $request): void {
        $credits = CreditService::getBalance(Auth::id());
        Response::json([
            'credits_balance' => (int)$credits['credits_balance'],
            'lifetime_purchased' => (int)$credits['lifetime_credits_purchased'],
            'lifetime_used' => (int)$credits['lifetime_credits_used'],
            'is_owner' => Auth::isOwner(),
        ]);
    }

    /**
     * GET /billing/packages
     * Returns available credit packages for purchase.
     */
    public function packages(Request $request): void {
        $config = require __DIR__ . '/../config/payment.php';
        $packages = [];
        foreach ($config['packages'] as $key => $pkg) {
            $packages[] = [
                'key' => $key,
                'name' => $pkg['name'],
                'credits' => $pkg['credits'],
                'price' => $pkg['price'],
                'price_per_credit' => round($pkg['price'] / $pkg['credits'], 3),
                'badge' => $pkg['badge'],
            ];
        }
        Response::json($packages);
    }

    /**
     * POST /billing/checkout
     * Creates a Lemon Squeezy checkout URL.
     * Body: { "package": "starter" | "growth" | "pro" }
     */
    public function checkout(Request $request): void {
        $packageKey = $request->body('package');
        if (!$packageKey) {
            Response::error('Package is required');
        }

        $config = require __DIR__ . '/../config/payment.php';
        if (!isset($config['packages'][$packageKey])) {
            Response::error('Invalid package', 400);
        }

        $ls = new LemonSqueezy();
        $user = Auth::user();

        $checkoutUrl = $ls->createCheckoutUrl(
            $packageKey,
            (int)$user['id'],
            $user['email']
        );

        if (!$checkoutUrl) {
            Response::error('Failed to create checkout session. Payment provider may not be configured yet.', 500);
        }

        Response::json(['checkout_url' => $checkoutUrl]);
    }

    /**
     * GET /billing/transactions
     * Returns paginated credit transaction history.
     */
    public function transactions(Request $request): void {
        $page = max(1, (int)$request->query('page', 1));
        $perPage = min(50, max(10, (int)$request->query('per_page', 20)));
        $offset = ($page - 1) * $perPage;

        $total = Database::count(
            'credit_transactions',
            'user_id = ?',
            [Auth::id()]
        );

        $transactions = Database::fetchAll(
            "SELECT * FROM credit_transactions
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT $perPage OFFSET $offset",
            [Auth::id()]
        );

        Response::paginated($transactions, $total, $page, $perPage);
    }
}
