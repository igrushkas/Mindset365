<?php
return [
    'provider' => 'lemonsqueezy',
    'api_key' => 'YOUR_LEMON_SQUEEZY_API_KEY',
    'store_id' => 'YOUR_STORE_ID',
    'webhook_secret' => 'YOUR_WEBHOOK_SECRET',

    // Credit packages (match Lemon Squeezy products)
    // ls_variant_id = variant ID from LS (used in checkout + webhook matching)
    // ls_product_id = product ID from LS (stored for reference)
    'packages' => [
        'starter' => [
            'name' => 'Starter Pack',
            'credits' => 50,
            'price' => 4.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'ls_product_id' => 'YOUR_PRODUCT_ID',
            'badge' => null,
        ],
        'growth' => [
            'name' => 'Growth Pack',
            'credits' => 200,
            'price' => 14.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'ls_product_id' => 'YOUR_PRODUCT_ID',
            'badge' => 'Best Value',
        ],
        'pro' => [
            'name' => 'Pro Pack',
            'credits' => 500,
            'price' => 29.99,
            'ls_variant_id' => 'YOUR_VARIANT_ID',
            'ls_product_id' => 'YOUR_PRODUCT_ID',
            'badge' => null,
        ],
    ],

    // Trial credits for new users
    'trial_credits' => 25,
];
