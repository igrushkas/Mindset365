<?php
/**
 * Run credit system migrations (014-016)
 */
$secretKey = 'mindset365_migrate_2024';
if (php_sapi_name() !== 'cli') {
    if (($_GET['key'] ?? '') !== $secretKey) {
        http_response_code(403);
        die('Unauthorized');
    }
}

require_once __DIR__ . '/../core/Database.php';
$db = Database::connect();

echo "<pre>\n=== Credit System Migrations ===\n\n";

$files = [
    '014_create_user_credits.sql',
    '015_create_credit_transactions.sql',
    '016_create_lemon_squeezy_orders.sql',
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    if (!file_exists($path)) {
        echo "SKIP: $file (not found)\n";
        continue;
    }
    echo "Running: $file ... ";
    $sql = file_get_contents($path);
    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        fn($s) => !empty($s) && !str_starts_with(trim($s), '--')
    );
    try {
        foreach ($statements as $stmt) {
            $stmt = trim($stmt);
            if (empty($stmt) || str_starts_with($stmt, '--')) continue;
            $db->exec($stmt);
        }
        echo "OK\n";
    } catch (PDOException $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
    }
}

// Give existing owner user trial credits
echo "\n--- Initializing credits for existing users ---\n";
try {
    $users = $db->query("SELECT id, role FROM users")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($users as $u) {
        $existing = $db->prepare("SELECT id FROM user_credits WHERE user_id = ?");
        $existing->execute([$u['id']]);
        if (!$existing->fetch()) {
            $trialCredits = 25;
            $db->prepare("INSERT INTO user_credits (user_id, credits_balance, lifetime_credits_purchased) VALUES (?, ?, ?)")
               ->execute([$u['id'], $trialCredits, 0]);
            $db->prepare("INSERT INTO credit_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'trial', ?, ?)")
               ->execute([$u['id'], $trialCredits, "Welcome bonus: $trialCredits free AI coaching credits", $trialCredits]);
            echo "User #{$u['id']} ({$u['role']}): $trialCredits trial credits added\n";
        } else {
            echo "User #{$u['id']}: already has credits\n";
        }
    }
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n=== Done ===\n</pre>";
