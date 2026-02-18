<?php
return [
    'provider' => 'lemonsqueezy',
    'api_key' => 'YOUR_LEMON_SQUEEZY_API_KEY',
    'store_id' => 'YOUR_STORE_ID',
    'webhook_secret' => 'YOUR_WEBHOOK_SECRET',

    // Credit packages (match Lemon Squeezy products)
    'packages' => [
        'starter' => [
            'name' => 'Starter',
            'credits' => 50,
            'price' => 4.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'badge' => null,
        ],
        'growth' => [
            'name' => 'Growth',
            'credits' => 200,
            'price' => 14.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'badge' => 'Best Value',
        ],
        'pro' => [
            'name' => 'Pro',
            'credits' => 500,
            'price' => 29.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'badge' => null,
        ],
    ],

    // Trial credits for new users
    'trial_credits' => 25,
];
