<?php

// Load all core files
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Request.php';
require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Router.php';
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Validator.php';

// Load middleware
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../middleware/CsrfMiddleware.php';
require_once __DIR__ . '/../middleware/RateLimitMiddleware.php';

// Load services
require_once __DIR__ . '/../services/GoogleOAuth.php';
require_once __DIR__ . '/../services/AICoach.php';
require_once __DIR__ . '/../services/CreditService.php';
require_once __DIR__ . '/../services/LemonSqueezy.php';

// Load models
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Goal.php';
require_once __DIR__ . '/../models/Board.php';
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Client.php';
require_once __DIR__ . '/../models/Course.php';
require_once __DIR__ . '/../models/Content.php';
require_once __DIR__ . '/../models/ChatSession.php';
require_once __DIR__ . '/../models/ChatMessage.php';
require_once __DIR__ . '/../models/Analytics.php';
require_once __DIR__ . '/../models/Workspace.php';
require_once __DIR__ . '/../models/Automation.php';
require_once __DIR__ . '/../models/Notification.php';
require_once __DIR__ . '/../models/TaskTemplate.php';

// Load controllers
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/GoalController.php';
require_once __DIR__ . '/../controllers/BoardController.php';
require_once __DIR__ . '/../controllers/TaskController.php';
require_once __DIR__ . '/../controllers/ClientController.php';
require_once __DIR__ . '/../controllers/CourseController.php';
require_once __DIR__ . '/../controllers/ContentController.php';
require_once __DIR__ . '/../controllers/ChatController.php';
require_once __DIR__ . '/../controllers/AnalyticsController.php';
require_once __DIR__ . '/../controllers/WorkspaceController.php';
require_once __DIR__ . '/../controllers/AutomationController.php';
require_once __DIR__ . '/../controllers/NotificationController.php';
require_once __DIR__ . '/../controllers/FileController.php';
require_once __DIR__ . '/../controllers/AssessmentController.php';
require_once __DIR__ . '/../controllers/ReferralController.php';
require_once __DIR__ . '/../controllers/BillingController.php';
require_once __DIR__ . '/../controllers/WebhookController.php';
require_once __DIR__ . '/../controllers/TaskTemplateController.php';

class App {
    private Router $router;

    public function __construct() {
        $config = require __DIR__ . '/../config/app.php';
        date_default_timezone_set($config['timezone']);

        // Set error handling - never display errors in API (breaks JSON responses)
        error_reporting(E_ALL);
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        ini_set('error_log', __DIR__ . '/../../error_log.txt');

        // Set global headers
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');

        $this->router = new Router();
        $this->registerRoutes();
    }

    private function registerRoutes(): void {
        $r = $this->router;

        // Public auth routes
        $r->post('/api/auth/google', [AuthController::class, 'google']);
        $r->post('/api/auth/refresh', [AuthController::class, 'refresh']);
        $r->get('/api/auth/csrf', [AuthController::class, 'csrf']);

        // Public referral tracking (no auth needed)
        $r->post('/api/referrals/track', [ReferralController::class, 'trackClick']);

        // Public webhook endpoint (no auth, verified by HMAC signature)
        $r->post('/api/webhooks/lemonsqueezy', [WebhookController::class, 'lemonSqueezy']);

        // Protected routes
        $r->group('/api', [AuthMiddleware::class], function(Router $r) {

            // Auth
            $r->get('/auth/me', [AuthController::class, 'me']);
            $r->post('/auth/logout', [AuthController::class, 'logout']);

            // Users
            $r->get('/users', [UserController::class, 'index']);
            $r->get('/users/{id}', [UserController::class, 'show']);
            $r->put('/users/{id}', [UserController::class, 'update']);
            $r->put('/users/{id}/preferences', [UserController::class, 'updatePreferences']);

            // Workspaces
            $r->get('/workspaces', [WorkspaceController::class, 'index']);
            $r->post('/workspaces', [WorkspaceController::class, 'store']);
            $r->get('/workspaces/{id}', [WorkspaceController::class, 'show']);
            $r->put('/workspaces/{id}', [WorkspaceController::class, 'update']);
            $r->post('/workspaces/{id}/invite', [WorkspaceController::class, 'invite']);
            $r->delete('/workspaces/{id}/members/{uid}', [WorkspaceController::class, 'removeMember']);

            // Goals
            $r->get('/goals', [GoalController::class, 'index']);
            $r->post('/goals', [GoalController::class, 'store']);
            $r->get('/goals/stats', [GoalController::class, 'stats']);
            $r->get('/goals/{id}', [GoalController::class, 'show']);
            $r->put('/goals/{id}', [GoalController::class, 'update']);
            $r->delete('/goals/{id}', [GoalController::class, 'destroy']);
            $r->post('/goals/{id}/checkins', [GoalController::class, 'addCheckin']);
            $r->get('/goals/{id}/checkins', [GoalController::class, 'checkins']);

            // Boards
            $r->get('/boards', [BoardController::class, 'index']);
            $r->post('/boards', [BoardController::class, 'store']);
            $r->get('/boards/{id}', [BoardController::class, 'show']);
            $r->put('/boards/{id}', [BoardController::class, 'update']);
            $r->delete('/boards/{id}', [BoardController::class, 'destroy']);
            $r->post('/boards/{id}/columns', [BoardController::class, 'addColumn']);
            $r->put('/boards/{id}/columns/{cid}', [BoardController::class, 'updateColumn']);

            // Tasks
            $r->get('/tasks', [TaskController::class, 'index']);
            $r->post('/tasks', [TaskController::class, 'store']);
            $r->get('/tasks/my', [TaskController::class, 'myTasks']);
            $r->put('/tasks/reorder', [TaskController::class, 'reorder']);
            $r->get('/tasks/{id}', [TaskController::class, 'show']);
            $r->put('/tasks/{id}', [TaskController::class, 'update']);
            $r->delete('/tasks/{id}', [TaskController::class, 'destroy']);
            $r->put('/tasks/{id}/move', [TaskController::class, 'move']);
            $r->post('/tasks/{id}/comments', [TaskController::class, 'addComment']);

            // Clients
            $r->get('/clients', [ClientController::class, 'index']);
            $r->post('/clients', [ClientController::class, 'store']);
            $r->get('/clients/{id}', [ClientController::class, 'show']);
            $r->put('/clients/{id}', [ClientController::class, 'update']);
            $r->delete('/clients/{id}', [ClientController::class, 'destroy']);
            $r->get('/clients/{id}/sessions', [ClientController::class, 'sessions']);
            $r->post('/clients/{id}/sessions', [ClientController::class, 'addSession']);
            $r->put('/clients/{id}/sessions/{sid}', [ClientController::class, 'updateSession']);
            $r->post('/clients/{id}/assign-template', [TaskTemplateController::class, 'assignToClient']);
            $r->get('/clients/{id}/templates', [TaskTemplateController::class, 'clientTemplates']);

            // Task Templates (coach only)
            $r->get('/task-templates', [TaskTemplateController::class, 'index']);
            $r->post('/task-templates', [TaskTemplateController::class, 'store']);
            $r->get('/task-templates/{id}', [TaskTemplateController::class, 'show']);
            $r->put('/task-templates/{id}', [TaskTemplateController::class, 'update']);
            $r->delete('/task-templates/{id}', [TaskTemplateController::class, 'destroy']);
            $r->post('/task-templates/{id}/tasks', [TaskTemplateController::class, 'addTask']);
            $r->put('/task-templates/{id}/tasks/{tid}', [TaskTemplateController::class, 'updateTask']);
            $r->delete('/task-templates/{id}/tasks/{tid}', [TaskTemplateController::class, 'removeTask']);

            // Courses
            $r->get('/courses', [CourseController::class, 'index']);
            $r->post('/courses', [CourseController::class, 'store']);
            $r->get('/courses/{id}', [CourseController::class, 'show']);
            $r->put('/courses/{id}', [CourseController::class, 'update']);
            $r->delete('/courses/{id}', [CourseController::class, 'destroy']);
            $r->post('/courses/{id}/modules', [CourseController::class, 'addModule']);
            $r->put('/courses/{id}/modules/{mid}', [CourseController::class, 'updateModule']);
            $r->post('/courses/{id}/enroll', [CourseController::class, 'enroll']);
            $r->post('/courses/{id}/modules/{mid}/complete', [CourseController::class, 'completeModule']);

            // Content Library
            $r->get('/content', [ContentController::class, 'index']);
            $r->post('/content', [ContentController::class, 'store']);
            $r->get('/content/{id}', [ContentController::class, 'show']);
            $r->put('/content/{id}', [ContentController::class, 'update']);
            $r->delete('/content/{id}', [ContentController::class, 'destroy']);

            // AI Chat
            $r->get('/chat/sessions', [ChatController::class, 'sessions']);
            $r->post('/chat/sessions', [ChatController::class, 'createSession']);
            $r->get('/chat/sessions/{id}', [ChatController::class, 'showSession']);
            $r->delete('/chat/sessions/{id}', [ChatController::class, 'deleteSession']);
            $r->post('/chat/sessions/{id}/messages', [ChatController::class, 'sendMessage']);

            // Analytics
            $r->get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
            $r->get('/analytics/goals', [AnalyticsController::class, 'goals']);
            $r->get('/analytics/tasks', [AnalyticsController::class, 'tasks']);
            $r->get('/analytics/clients', [AnalyticsController::class, 'clients']);
            $r->get('/analytics/revenue', [AnalyticsController::class, 'revenue']);

            // Automations
            $r->get('/automations', [AutomationController::class, 'index']);
            $r->post('/automations', [AutomationController::class, 'store']);
            $r->put('/automations/{id}', [AutomationController::class, 'update']);
            $r->delete('/automations/{id}', [AutomationController::class, 'destroy']);

            // Notifications
            $r->get('/notifications', [NotificationController::class, 'index']);
            $r->put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
            $r->put('/notifications/read-all', [NotificationController::class, 'markAllRead']);

            // Files
            $r->post('/files/upload', [FileController::class, 'upload']);
            $r->get('/files/{id}', [FileController::class, 'show']);
            $r->delete('/files/{id}', [FileController::class, 'destroy']);

            // Assessments
            $r->get('/assessments/templates/default', [AssessmentController::class, 'getDefaultTemplate']);
            $r->post('/assessments', [AssessmentController::class, 'startAssessment']);
            $r->get('/assessments/{id}', [AssessmentController::class, 'show']);
            $r->post('/assessments/{id}/answers', [AssessmentController::class, 'submitAnswer']);
            $r->post('/assessments/{id}/complete', [AssessmentController::class, 'complete']);

            // Referrals
            $r->get('/referrals/me', [ReferralController::class, 'getMyReferralInfo']);

            // Billing / Credits
            $r->get('/billing/credits', [BillingController::class, 'credits']);
            $r->get('/billing/packages', [BillingController::class, 'packages']);
            $r->post('/billing/checkout', [BillingController::class, 'checkout']);
            $r->get('/billing/transactions', [BillingController::class, 'transactions']);
        });
    }

    public function run(): void {
        try {
            $request = new Request();
            $this->router->dispatch($request);
        } catch (PDOException $e) {
            error_log('Database error: ' . $e->getMessage());
            Response::serverError('A database error occurred');
        } catch (Exception $e) {
            error_log('App error: ' . $e->getMessage());
            Response::serverError('An unexpected error occurred');
        }
    }
}
