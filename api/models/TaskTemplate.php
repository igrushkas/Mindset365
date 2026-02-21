<?php

class TaskTemplate {
    protected static string $table = 'task_templates';

    /**
     * Find a template by primary key.
     */
    public static function find(int $id): ?array {
        return Database::fetch("SELECT * FROM " . static::$table . " WHERE id = ?", [$id]);
    }

    /**
     * Find all active templates for a workspace, grouped by phase.
     */
    public static function findByWorkspace(int $workspaceId): array {
        return Database::fetchAll(
            "SELECT tt.*, (SELECT COUNT(*) FROM template_tasks WHERE template_id = tt.id) as task_count
             FROM " . static::$table . " tt
             WHERE tt.workspace_id = ? AND tt.is_active = 1
             ORDER BY FIELD(tt.phase, 'foundation', 'growth', 'scale'), tt.sort_order ASC",
            [$workspaceId]
        );
    }

    /**
     * Find templates by phase.
     */
    public static function findByPhase(int $workspaceId, string $phase): array {
        return Database::fetchAll(
            "SELECT * FROM " . static::$table . " WHERE workspace_id = ? AND phase = ? AND is_active = 1 ORDER BY sort_order ASC",
            [$workspaceId, $phase]
        );
    }

    /**
     * Get template tasks for a specific template.
     */
    public static function getTasks(int $templateId): array {
        return Database::fetchAll(
            "SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC",
            [$templateId]
        );
    }

    /**
     * Check if a template is already assigned to a client.
     */
    public static function isAssignedToClient(int $templateId, int $clientId): bool {
        $row = Database::fetch(
            "SELECT id FROM client_template_assignments WHERE template_id = ? AND client_id = ?",
            [$templateId, $clientId]
        );
        return $row !== null;
    }

    /**
     * Get all template assignments for a client.
     */
    public static function getClientAssignments(int $clientId): array {
        return Database::fetchAll(
            "SELECT cta.*, tt.name as template_name, tt.phase,
                    (SELECT COUNT(*) FROM template_tasks WHERE template_id = tt.id) as template_task_count
             FROM client_template_assignments cta
             JOIN task_templates tt ON cta.template_id = tt.id
             WHERE cta.client_id = ?
             ORDER BY cta.assigned_at DESC",
            [$clientId]
        );
    }

    /**
     * Create a new template and return the inserted ID.
     */
    public static function create(array $data): int {
        return Database::insert(static::$table, $data);
    }

    /**
     * Update a template by ID. Returns affected row count.
     */
    public static function updateById(int $id, array $data): int {
        return Database::update(static::$table, $data, 'id = ?', [$id]);
    }

    /**
     * Delete a template by ID. Returns affected row count.
     */
    public static function deleteById(int $id): int {
        return Database::delete(static::$table, 'id = ?', [$id]);
    }
}
