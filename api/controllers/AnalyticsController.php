<?php

class AnalyticsController {
    public function dashboard(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $from = $request->query('from', date('Y-m-d', strtotime('-30 days')));
        $to = $request->query('to', date('Y-m-d'));

        // Active clients
        $activeClients = Database::count(
            'clients',
            "workspace_id = ? AND status = 'active'",
            [$workspaceId]
        );

        // Total revenue
        $revenueRow = Database::fetch(
            "SELECT COALESCE(SUM(monthly_rate), 0) as total
             FROM clients
             WHERE workspace_id = ? AND status = 'active'",
            [$workspaceId]
        );
        $totalRevenue = (float) ($revenueRow['total'] ?? 0);

        // Goals completed in range
        $goalsCompleted = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'goal_completed' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        // Tasks completed in range
        $tasksCompleted = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'task_completed' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        // Total goals
        $totalGoals = Database::count('goals', 'workspace_id = ?', [$workspaceId]);
        $goalsInProgress = Database::count('goals', "workspace_id = ? AND status = 'in_progress'", [$workspaceId]);

        // Total tasks (open)
        $openTasks = Database::count(
            'tasks',
            "board_id IN (SELECT id FROM boards WHERE workspace_id = ?) AND completed_at IS NULL",
            [$workspaceId]
        );

        // Sessions completed in range
        $sessionsCompleted = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'session_completed' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        // AI chats in range
        $aiChats = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'ai_chat' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        // Course enrollments
        $courseEnrollments = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'course_enrolled' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        // Daily activity trend (from daily_snapshots or analytics_events)
        $dailyActivity = Database::fetchAll(
            "SELECT event_date, COUNT(*) as event_count
             FROM analytics_events
             WHERE workspace_id = ? AND event_date BETWEEN ? AND ?
             GROUP BY event_date ORDER BY event_date ASC",
            [$workspaceId, $from, $to]
        );

        // Recent snapshots
        $snapshots = Database::fetchAll(
            "SELECT * FROM daily_snapshots
             WHERE workspace_id = ? AND snapshot_date BETWEEN ? AND ?
             ORDER BY snapshot_date ASC",
            [$workspaceId, $from, $to]
        );

        Response::json([
            'period' => ['from' => $from, 'to' => $to],
            'kpis' => [
                'active_clients' => $activeClients,
                'total_revenue' => $totalRevenue,
                'goals_completed' => $goalsCompleted,
                'tasks_completed' => $tasksCompleted,
                'goals_in_progress' => $goalsInProgress,
                'total_goals' => $totalGoals,
                'open_tasks' => $openTasks,
                'sessions_completed' => $sessionsCompleted,
                'ai_chats' => $aiChats,
                'course_enrollments' => $courseEnrollments,
            ],
            'daily_activity' => $dailyActivity,
            'snapshots' => $snapshots,
        ]);
    }

    public function goals(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $from = $request->query('from', date('Y-m-d', strtotime('-30 days')));
        $to = $request->query('to', date('Y-m-d'));

        // Goal stats by category
        $byCategory = Database::fetchAll(
            "SELECT category, COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
             FROM goals
             WHERE workspace_id = ?
             GROUP BY category ORDER BY total DESC",
            [$workspaceId]
        );

        // Goal completions over time
        $completionTrend = Database::fetchAll(
            "SELECT event_date, COUNT(*) as count
             FROM analytics_events
             WHERE workspace_id = ? AND event_type = 'goal_completed' AND event_date BETWEEN ? AND ?
             GROUP BY event_date ORDER BY event_date ASC",
            [$workspaceId, $from, $to]
        );

        // Goals by status
        $byStatus = Database::fetchAll(
            "SELECT status, COUNT(*) as count
             FROM goals WHERE workspace_id = ?
             GROUP BY status",
            [$workspaceId]
        );

        // Goals by priority
        $byPriority = Database::fetchAll(
            "SELECT priority, COUNT(*) as count
             FROM goals WHERE workspace_id = ?
             GROUP BY priority",
            [$workspaceId]
        );

        // Average completion rate
        $avgProgress = Database::fetch(
            "SELECT AVG(CASE WHEN target_value > 0 THEN LEAST(100, (current_value / target_value) * 100) ELSE 0 END) as avg_pct
             FROM goals WHERE workspace_id = ? AND status != 'completed'",
            [$workspaceId]
        );

        // Overdue goals
        $overdue = Database::count(
            'goals',
            "workspace_id = ? AND target_date < CURDATE() AND status NOT IN ('completed', 'cancelled')",
            [$workspaceId]
        );

        Response::json([
            'period' => ['from' => $from, 'to' => $to],
            'by_category' => $byCategory,
            'by_status' => $byStatus,
            'by_priority' => $byPriority,
            'completion_trend' => $completionTrend,
            'avg_progress_pct' => round((float)($avgProgress['avg_pct'] ?? 0), 1),
            'overdue' => $overdue,
        ]);
    }

    public function tasks(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $from = $request->query('from', date('Y-m-d', strtotime('-30 days')));
        $to = $request->query('to', date('Y-m-d'));

        // Tasks completed over time
        $completionTrend = Database::fetchAll(
            "SELECT event_date, COUNT(*) as count
             FROM analytics_events
             WHERE workspace_id = ? AND event_type = 'task_completed' AND event_date BETWEEN ? AND ?
             GROUP BY event_date ORDER BY event_date ASC",
            [$workspaceId, $from, $to]
        );

        // Tasks by board
        $byBoard = Database::fetchAll(
            "SELECT b.name as board_name, b.id as board_id,
                    COUNT(t.id) as total,
                    SUM(CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
             FROM boards b
             LEFT JOIN tasks t ON t.board_id = b.id
             WHERE b.workspace_id = ?
             GROUP BY b.id, b.name ORDER BY total DESC",
            [$workspaceId]
        );

        // Tasks by assignee
        $byAssignee = Database::fetchAll(
            "SELECT u.name as user_name, u.id as user_id,
                    COUNT(t.id) as total,
                    SUM(CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
             FROM tasks t
             JOIN boards b ON t.board_id = b.id
             LEFT JOIN users u ON t.assigned_to = u.id
             WHERE b.workspace_id = ?
             GROUP BY u.id, u.name ORDER BY total DESC",
            [$workspaceId]
        );

        // Tasks by priority
        $byPriority = Database::fetchAll(
            "SELECT t.priority, COUNT(*) as count
             FROM tasks t
             JOIN boards b ON t.board_id = b.id
             WHERE b.workspace_id = ?
             GROUP BY t.priority",
            [$workspaceId]
        );

        // Overdue tasks
        $overdue = Database::count(
            'tasks',
            "board_id IN (SELECT id FROM boards WHERE workspace_id = ?) AND due_date < CURDATE() AND completed_at IS NULL",
            [$workspaceId]
        );

        // Created vs completed in range
        $created = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'task_created' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );
        $completed = Database::count(
            'analytics_events',
            "workspace_id = ? AND event_type = 'task_completed' AND event_date BETWEEN ? AND ?",
            [$workspaceId, $from, $to]
        );

        Response::json([
            'period' => ['from' => $from, 'to' => $to],
            'completion_trend' => $completionTrend,
            'by_board' => $byBoard,
            'by_assignee' => $byAssignee,
            'by_priority' => $byPriority,
            'overdue' => $overdue,
            'created_in_period' => $created,
            'completed_in_period' => $completed,
        ]);
    }

    public function clients(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $from = $request->query('from', date('Y-m-d', strtotime('-30 days')));
        $to = $request->query('to', date('Y-m-d'));

        // Clients by status
        $byStatus = Database::fetchAll(
            "SELECT status, COUNT(*) as count
             FROM clients WHERE workspace_id = ?
             GROUP BY status",
            [$workspaceId]
        );

        // Client acquisition trend
        $acquisitionTrend = Database::fetchAll(
            "SELECT event_date, COUNT(*) as count
             FROM analytics_events
             WHERE workspace_id = ? AND event_type = 'client_created' AND event_date BETWEEN ? AND ?
             GROUP BY event_date ORDER BY event_date ASC",
            [$workspaceId, $from, $to]
        );

        // Sessions completed trend
        $sessionsTrend = Database::fetchAll(
            "SELECT event_date, COUNT(*) as count
             FROM analytics_events
             WHERE workspace_id = ? AND event_type = 'session_completed' AND event_date BETWEEN ? AND ?
             GROUP BY event_date ORDER BY event_date ASC",
            [$workspaceId, $from, $to]
        );

        // Top clients by sessions
        $topClients = Database::fetchAll(
            "SELECT c.id, c.name, c.status, c.completed_sessions, c.total_sessions, c.monthly_rate
             FROM clients c
             WHERE c.workspace_id = ?
             ORDER BY c.completed_sessions DESC LIMIT 10",
            [$workspaceId]
        );

        // Average monthly rate
        $avgRate = Database::fetch(
            "SELECT AVG(monthly_rate) as avg_rate
             FROM clients
             WHERE workspace_id = ? AND status = 'active' AND monthly_rate > 0",
            [$workspaceId]
        );

        // Retention: active vs churned
        $totalClients = Database::count('clients', 'workspace_id = ?', [$workspaceId]);
        $activeClients = Database::count('clients', "workspace_id = ? AND status = 'active'", [$workspaceId]);
        $retentionRate = $totalClients > 0 ? round(($activeClients / $totalClients) * 100, 1) : 0;

        Response::json([
            'period' => ['from' => $from, 'to' => $to],
            'by_status' => $byStatus,
            'acquisition_trend' => $acquisitionTrend,
            'sessions_trend' => $sessionsTrend,
            'top_clients' => $topClients,
            'avg_monthly_rate' => round((float)($avgRate['avg_rate'] ?? 0), 2),
            'total_clients' => $totalClients,
            'active_clients' => $activeClients,
            'retention_rate' => $retentionRate,
        ]);
    }

    public function revenue(Request $request): void {
        $workspaceId = Auth::workspaceId();
        $from = $request->query('from', date('Y-m-d', strtotime('-12 months')));
        $to = $request->query('to', date('Y-m-d'));

        // Current MRR (monthly recurring revenue)
        $mrrRow = Database::fetch(
            "SELECT COALESCE(SUM(monthly_rate), 0) as mrr
             FROM clients
             WHERE workspace_id = ? AND status = 'active'",
            [$workspaceId]
        );
        $mrr = (float) ($mrrRow['mrr'] ?? 0);

        // Revenue by client package
        $byPackage = Database::fetchAll(
            "SELECT package, COUNT(*) as client_count, COALESCE(SUM(monthly_rate), 0) as revenue
             FROM clients
             WHERE workspace_id = ? AND status = 'active'
             GROUP BY package ORDER BY revenue DESC",
            [$workspaceId]
        );

        // Revenue from snapshots over time
        $revenueTrend = Database::fetchAll(
            "SELECT snapshot_date, total_revenue as daily_revenue
             FROM daily_snapshots
             WHERE workspace_id = ? AND snapshot_date BETWEEN ? AND ?
             ORDER BY snapshot_date ASC",
            [$workspaceId, $from, $to]
        );

        // New clients in period with revenue
        $newClientRevenue = Database::fetch(
            "SELECT COUNT(*) as count, COALESCE(SUM(monthly_rate), 0) as revenue
             FROM clients
             WHERE workspace_id = ? AND created_at BETWEEN ? AND ?",
            [$workspaceId, $from . ' 00:00:00', $to . ' 23:59:59']
        );

        // Churned clients in period
        $churnedRevenue = Database::fetch(
            "SELECT COUNT(*) as count, COALESCE(SUM(monthly_rate), 0) as revenue
             FROM clients
             WHERE workspace_id = ? AND status IN ('inactive', 'churned')
             AND updated_at BETWEEN ? AND ?",
            [$workspaceId, $from . ' 00:00:00', $to . ' 23:59:59']
        );

        // Top revenue clients
        $topRevenue = Database::fetchAll(
            "SELECT id, name, package, monthly_rate, status
             FROM clients
             WHERE workspace_id = ? AND monthly_rate > 0
             ORDER BY monthly_rate DESC LIMIT 10",
            [$workspaceId]
        );

        Response::json([
            'period' => ['from' => $from, 'to' => $to],
            'mrr' => $mrr,
            'arr' => $mrr * 12,
            'by_package' => $byPackage,
            'revenue_trend' => $revenueTrend,
            'new_clients' => [
                'count' => (int) ($newClientRevenue['count'] ?? 0),
                'revenue' => (float) ($newClientRevenue['revenue'] ?? 0),
            ],
            'churned_clients' => [
                'count' => (int) ($churnedRevenue['count'] ?? 0),
                'lost_revenue' => (float) ($churnedRevenue['revenue'] ?? 0),
            ],
            'top_revenue_clients' => $topRevenue,
        ]);
    }
}
