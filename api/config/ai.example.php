<?php
return [
    'provider' => 'openai',
    'api_key' => 'YOUR_OPENAI_API_KEY',
    'model' => 'gpt-4o-mini',
    'max_tokens' => 1000,
    'temperature' => 0.7,
    'base_url' => 'https://api.openai.com/v1',
    'owner_unlimited' => true,    // Owner role bypasses credit check
];
