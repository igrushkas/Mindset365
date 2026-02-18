/**
 * Mindset365 - Dashboard Page
 * Welcome banner, KPI cards, recent activity, and quick actions.
 */

import api from '../api.js';
import { getState } from '../store.js';
import { navigate } from '../router.js';
import { formatCurrency, timeAgo } from '../utils.js';

/**
 * Render a skeleton loading state for the dashboard.
 * @returns {string} HTML string
 */
function renderSkeleton() {
    return `
        <div class="welcome-banner" style="min-height: 120px;">
            <div class="skeleton skeleton-title" style="width: 260px;"></div>
            <div class="skeleton skeleton-text" style="width: 340px; margin-top: var(--sp-3);"></div>
        </div>
        <div class="grid grid-4 mb-6">
            ${Array(4).fill('<div class="card skeleton-card"></div>').join('')}
        </div>
        <div class="grid grid-2">
            <div class="card skeleton-card" style="height: 200px;"></div>
            <div class="card skeleton-card" style="height: 200px;"></div>
        </div>
    `;
}

/**
 * Render the onboarding CTA banner for users who haven't completed the assessment.
 * @returns {string} HTML string
 */
function renderOnboardingCTA() {
    return `
        <div class="card animate-fade-up" style="background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.15), rgba(0, 206, 201, 0.1)); border-color: rgba(var(--color-primary-rgb), 0.3); padding: var(--sp-8); text-align: center; margin-bottom: var(--sp-6);">
            <div style="font-size: 2.5rem; margin-bottom: var(--sp-4);">&#127919;</div>
            <h2 style="font-size: var(--fs-xl); margin-bottom: var(--sp-2);">Complete Your Business Assessment</h2>
            <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto var(--sp-6);">
                Take a quick assessment to get personalized AI coaching recommendations tailored to your business goals.
            </p>
            <button class="btn btn-primary btn-lg" id="start-assessment-btn">
                Start Assessment
            </button>
        </div>
    `;
}

/**
 * Build a single KPI card.
 * @param {Object} opts
 * @returns {string} HTML string
 */
function kpiCard({ icon, color, label, value, trend, trendDir }) {
    return `
        <div class="card kpi-card hover-lift">
            <div class="kpi-icon ${color}">${icon}</div>
            <div class="kpi-content">
                <div class="kpi-label">${label}</div>
                <div class="kpi-value">${value}</div>
                ${trend ? `<div class="kpi-trend ${trendDir || ''}">${trend}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Motivational messages pool.
 */
const motivationalMessages = [
    'Every step forward counts. Keep building momentum!',
    'Small consistent actions create extraordinary results.',
    'Your dedication today shapes your success tomorrow.',
    'Focus on progress, not perfection.',
    'Great things are built one day at a time.'
];

/**
 * Render the dashboard page.
 * @param {HTMLElement} container - The container element to render into
 */
export async function render(container) {
    const user = getState('user');
    const firstName = user?.name?.split(' ')[0] || 'there';

    // Show skeleton while loading
    container.innerHTML = renderSkeleton();

    // Check if onboarding is needed
    if (user && !user.onboarding_completed) {
        container.innerHTML = `
            <div class="welcome-banner animate-fade-up">
                <h2>Welcome, ${firstName}!</h2>
                <p>Let's set up your personalized coaching experience.</p>
            </div>
            ${renderOnboardingCTA()}
        `;

        document.getElementById('start-assessment-btn')?.addEventListener('click', () => {
            navigate('/assessment');
        });
        return;
    }

    // Fetch dashboard data in parallel
    let goalsStats = null;
    let tasksData = null;
    let clientsData = null;
    let analyticsData = null;

    try {
        const [goalsRes, tasksRes, clientsRes, analyticsRes] = await Promise.allSettled([
            api.get('/goals/stats'),
            api.get('/tasks/my'),
            api.get('/clients', { status: 'active' }),
            api.get('/analytics/dashboard')
        ]);

        goalsStats = goalsRes.status === 'fulfilled' ? goalsRes.value : null;
        tasksData = tasksRes.status === 'fulfilled' ? tasksRes.value : null;
        clientsData = clientsRes.status === 'fulfilled' ? clientsRes.value : null;
        analyticsData = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
    } catch (err) {
        showToast('Failed to load some dashboard data.', 'error');
    }

    // Extract KPI values
    // goalsStats from /goals/stats returns {total, in_progress, completed, not_started, ...}
    const activeGoals = goalsStats?.in_progress ?? goalsStats?.total ?? 0;
    // tasksData from /tasks/my returns an array directly (api.js unwraps envelope)
    const tasksThisWeek = Array.isArray(tasksData) ? tasksData.length : 0;
    // clientsData from /clients returns an array directly
    const activeClients = Array.isArray(clientsData) ? clientsData.length : 0;
    // analyticsData from /analytics/dashboard returns {kpis: {total_revenue, ...}, ...}
    const revenue = analyticsData?.kpis?.total_revenue ?? 0;
    const revenueTrend = null; // Not returned by current API

    // Recent activity from analytics daily_activity
    const recentActivity = analyticsData?.daily_activity ?? [];

    // Pick a motivational message
    const dayIndex = new Date().getDay();
    const motivation = motivationalMessages[dayIndex % motivationalMessages.length];

    container.innerHTML = `
        <div class="page-enter">
            <!-- Welcome Banner -->
            <div class="welcome-banner animate-fade-up">
                <h2>Welcome back, ${firstName}!</h2>
                <p>${motivation}</p>
            </div>

            <!-- KPI Cards -->
            <div class="grid grid-4 stagger mb-6">
                ${kpiCard({
                    icon: '&#127919;',
                    color: 'purple',
                    label: 'Active Goals',
                    value: activeGoals
                })}
                ${kpiCard({
                    icon: '&#9989;',
                    color: 'blue',
                    label: 'Tasks This Week',
                    value: tasksThisWeek
                })}
                ${kpiCard({
                    icon: '&#128101;',
                    color: 'teal',
                    label: 'Active Clients',
                    value: activeClients
                })}
                ${kpiCard({
                    icon: '&#128176;',
                    color: 'green',
                    label: 'Revenue (MRR)',
                    value: formatCurrency(revenue),
                    trend: revenueTrend ? `${revenueTrend > 0 ? '+' : ''}${revenueTrend}%` : null,
                    trendDir: revenueTrend > 0 ? 'up' : revenueTrend < 0 ? 'down' : ''
                })}
            </div>

            <div class="grid grid-2">
                <!-- Recent Activity -->
                <div class="card animate-fade-up">
                    <div class="card-header">
                        <h3>Recent Activity</h3>
                    </div>
                    <div class="card-body">
                        ${recentActivity.length > 0 ? `
                            <div class="flex flex-col gap-3">
                                ${recentActivity.slice(0, 5).map(event => `
                                    <div class="flex items-center gap-3" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border-light);">
                                        <div class="status-dot ${event.type === 'goal_completed' ? 'status-active' : event.type === 'task_completed' ? 'status-active' : 'status-pending'}"></div>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium">${event.description || event.event || 'Activity'}</div>
                                            <div class="text-xs text-muted">${timeAgo(event.created_at || event.timestamp)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state" style="padding: var(--sp-6);">
                                <div class="empty-state-icon">&#128203;</div>
                                <p class="text-sm text-muted">No recent activity yet. Start by creating a goal or task!</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="card animate-fade-up">
                    <div class="card-header">
                        <h3>Quick Actions</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-3">
                            <button class="btn btn-secondary w-full" id="quick-new-goal" style="justify-content: flex-start;">
                                &#127919;&nbsp;&nbsp;New Goal
                            </button>
                            <button class="btn btn-secondary w-full" id="quick-new-task" style="justify-content: flex-start;">
                                &#9989;&nbsp;&nbsp;New Task
                            </button>
                            <button class="btn btn-secondary w-full" id="quick-new-client" style="justify-content: flex-start;">
                                &#128101;&nbsp;&nbsp;New Client
                            </button>
                            <button class="btn btn-secondary w-full" id="quick-ai-chat" style="justify-content: flex-start;">
                                &#129302;&nbsp;&nbsp;Ask AI Coach
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Quick action event listeners
    document.getElementById('quick-new-goal')?.addEventListener('click', () => navigate('/goals'));
    document.getElementById('quick-new-task')?.addEventListener('click', () => navigate('/tasks'));
    document.getElementById('quick-new-client')?.addEventListener('click', () => navigate('/clients'));
    document.getElementById('quick-ai-chat')?.addEventListener('click', () => navigate('/chat'));
}
