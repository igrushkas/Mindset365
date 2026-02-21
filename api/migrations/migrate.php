<?php
/**
 * Database Migration Runner
 * Run via browser: https://moneymindset365.com/api/migrations/migrate.php?key=YOUR_SECRET
 * Or via cron/CLI if available
 */

// Simple security key - change this!
$secretKey = 'mindset365_migrate_2024';

if (php_sapi_name() !== 'cli') {
    if (($_GET['key'] ?? '') !== $secretKey) {
        http_response_code(403);
        die('Unauthorized. Provide ?key=YOUR_SECRET');
    }
}

require_once __DIR__ . '/../core/Database.php';

$config = require __DIR__ . '/../config/database.php';

echo "<pre>\n";
echo "=== Mindset365 Database Migration ===\n\n";

// Migration files in order
$migrations = [
    '001_create_users.sql',
    '002_create_workspaces.sql',
    '003_create_assessments.sql',
    '004_create_goals.sql',
    '005_create_boards_tasks.sql',
    '006_create_clients.sql',
    '007_create_courses_content.sql',
    '008_create_chat.sql',
    '009_create_analytics.sql',
    '010_create_automations_notifications.sql',
    '011_seed_default_assessment.sql',
    '012_create_referrals.sql',
    '013_fix_schema_mismatches.sql',
    '014_create_user_credits.sql',
    '015_create_credit_transactions.sql',
    '016_create_lemon_squeezy_orders.sql',
    '017_create_task_templates.sql',
];

$db = Database::connect();

foreach ($migrations as $file) {
    $path = __DIR__ . '/' . $file;
    if (!file_exists($path)) {
        echo "SKIP: $file (not found)\n";
        continue;
    }

    echo "Running: $file ... ";

    $sql = file_get_contents($path);

    // Split by semicolons to handle multiple statements
    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        fn($s) => !empty($s) && !str_starts_with(trim($s), '--')
    );

    try {
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if (empty($statement) || str_starts_with($statement, '--')) continue;
            $db->exec($statement);
        }
        echo "OK\n";
    } catch (PDOException $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
    }
}

echo "\n=== Seeding Default Assessment Template ===\n";

// Check if default assessment already exists
try {
    $existing = $db->query("SELECT COUNT(*) FROM assessment_templates WHERE is_default = 1")->fetchColumn();
    if ($existing > 0) {
        echo "Default assessment template already exists. Skipping seed.\n";
    } else {
        echo "No default template found. It will be created when the first workspace is set up.\n";
    }
} catch (PDOException $e) {
    echo "Note: assessment_templates table check: " . $e->getMessage() . "\n";
}

echo "\n=== Migration Complete ===\n";
echo "</pre>";
