<?php
/**
 * One-time user creation script.
 * Creates irishka.lebedeva@gmail.com as a member user.
 * DELETE THIS FILE AFTER USE.
 */

require_once __DIR__ . '/../core/Database.php';

header('Content-Type: application/json');

try {
    // Check if user already exists
    $existing = Database::fetch("SELECT id, email, role FROM users WHERE email = ?", ['irishka.lebedeva@gmail.com']);

    if ($existing) {
        echo json_encode(['status' => 'exists', 'user' => $existing]);
        exit;
    }

    // Get the first workspace
    $workspace = Database::fetch("SELECT id FROM workspaces ORDER BY id ASC LIMIT 1");

    if (!$workspace) {
        echo json_encode(['status' => 'error', 'message' => 'No workspace found']);
        exit;
    }

    // Create the user
    $userId = Database::insert('users', [
        'google_id' => '',
        'email' => 'irishka.lebedeva@gmail.com',
        'name' => 'Irishka Lebedeva',
        'avatar_url' => '',
        'role' => 'member',
        'status' => 'active',
    ]);

    // Add to workspace
    Database::insert('workspace_members', [
        'workspace_id' => $workspace['id'],
        'user_id' => $userId,
        'role' => 'member',
    ]);

    $user = Database::fetch("SELECT id, email, name, role FROM users WHERE id = ?", [$userId]);

    echo json_encode(['status' => 'created', 'user' => $user, 'workspace_id' => $workspace['id']]);

} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
