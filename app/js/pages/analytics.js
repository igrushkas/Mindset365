/**
 * Mindset365 - Analytics Page
 * Dashboard analytics with KPI cards, charts, and date range filtering.
 */

import api from '../api.js';
import { renderChart } from '../components/chart.js';
import { formatCurrency } from '../utils.js';

/** Date range state */
let dateRange = {
    start: getDefaultStartDate(),
    end: new Date().toISOString().split('T')[0]
};

/**
 * Get default start date (30 days ago).
 * @returns {string} ISO date string
 */
function getDefaultStartDate() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
}

/**
 * Build a KPI card.
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
 * Render the analytics page.
 * @param {HTMLElement} container
 */
export async function render(container) {
    // Initial skeleton
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Analytics</h1>
                <div class="page-actions">
                    <div class="flex items-center gap-2">
                        <input type="date" id="date-start" value="${dateRange.start}" style="width: auto;">
                        <span class="text-muted text-sm">to</span>
                        <input type="date" id="date-end" value="${dateRange.end}" style="width: auto;">
                        <button class="btn btn-secondary btn-sm" id="apply-date-range">Apply</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-4 stagger mb-6" id="kpi-section">
                ${Array(4).fill('<div class="card skeleton-card" style="height: 100px;"></div>').join('')}
            </div>

            <div class="grid grid-2 gap-6 mb-6" id="charts-row-1">
                <div class="card" style="min-height: 300px;">
                    <div class="card-header"><h3>Activity Trend</h3></div>
                    <div class="card-body" id="chart-activity" style="height: 250px;">
                        <div class="skeleton" style="height: 100%; border-radius: var(--radius-sm);"></div>
                    </div>
                </div>
                <div class="card" style="min-height: 300px;">
                    <div class="card-header"><h3>Goals by Category</h3></div>
                    <div class="card-body" id="chart-goals" style="height: 250px;">
                        <div class="skeleton" style="height: 100%; border-radius: var(--radius-sm);"></div>
                    </div>
                </div>
            </div>

            <div class="grid grid-2 gap-6" id="charts-row-2">
                <div class="card" style="min-height: 300px;">
                    <div class="card-header"><h3>Client Status Distribution</h3></div>
                    <div class="card-body" id="chart-clients" style="height: 250px;">
                        <div class="skeleton" style="height: 100%; border-radius: var(--radius-sm);"></div>
                    </div>
                </div>
                <div class="card" style="min-height: 300px;">
                    <div class="card-header"><h3>Revenue Trend</h3></div>
                    <div class="card-body" id="chart-revenue" style="height: 250px;">
                        <div class="skeleton" style="height: 100%; border-radius: var(--radius-sm);"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Date range controls
    container.querySelector('#apply-date-range')?.addEventListener('click', () => {
        const startInput = container.querySelector('#date-start');
        const endInput = container.querySelector('#date-end');
        if (startInput && endInput) {
            dateRange.start = startInput.value;
            dateRange.end = endInput.value;
            loadAnalytics(container);
        }
    });

    // Initial data load
    await loadAnalytics(container);
}

/**
 * Fetch all analytics data and render.
 * @param {HTMLElement} container
 */
async function loadAnalytics(container) {
    let dashboardData = null;
    let goalsData = null;
    let tasksData = null;
    let clientsData = null;
    let revenueData = null;

    try {
        const [dashRes, goalsRes, tasksRes, clientsRes, revenueRes] = await Promise.allSettled([
            api.get('/analytics/dashboard', { start_date: dateRange.start, end_date: dateRange.end }),
            api.get('/goals'),
            api.get('/tasks/my'),
            api.get('/clients'),
            api.get('/analytics/revenue', { start_date: dateRange.start, end_date: dateRange.end })
        ]);

        dashboardData = dashRes.status === 'fulfilled' ? (dashRes.value?.data || dashRes.value) : null;
        goalsData = goalsRes.status === 'fulfilled' ? goalsRes.value : null;
        tasksData = tasksRes.status === 'fulfilled' ? tasksRes.value : null;
        clientsData = clientsRes.status === 'fulfilled' ? clientsRes.value : null;
        revenueData = revenueRes.status === 'fulfilled' ? (revenueRes.value?.data || revenueRes.value) : null;
    } catch (err) {
        showToast('Failed to load analytics data.', 'error');
    }

    // Extract KPI values
    const mrr = dashboardData?.mrr ?? 0;
    const mrrTrend = dashboardData?.mrr_trend ?? null;

    const allClients = Array.isArray(clientsData?.data) ? clientsData.data : (Array.isArray(clientsData) ? clientsData : []);
    const activeClientsCount = allClients.filter(c => c.status === 'active').length;

    const allGoals = Array.isArray(goalsData?.data) ? goalsData.data : (Array.isArray(goalsData) ? goalsData : []);
    const completedGoals = allGoals.filter(g => g.status === 'completed').length;

    const allTasks = Array.isArray(tasksData?.data) ? tasksData.data : (Array.isArray(tasksData) ? tasksData : []);
    const completedTasks = allTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const taskVelocity = dashboardData?.task_velocity ?? completedTasks;

    // Render KPI cards
    const kpiSection = container.querySelector('#kpi-section');
    if (kpiSection) {
        kpiSection.innerHTML = `
            ${kpiCard({
                icon: '&#128176;',
                color: 'green',
                label: 'Revenue (MRR)',
                value: formatCurrency(mrr),
                trend: mrrTrend ? `${mrrTrend > 0 ? '+' : ''}${mrrTrend}%` : null,
                trendDir: mrrTrend > 0 ? 'up' : mrrTrend < 0 ? 'down' : ''
            })}
            ${kpiCard({
                icon: '&#128101;',
                color: 'teal',
                label: 'Active Clients',
                value: activeClientsCount
            })}
            ${kpiCard({
                icon: '&#127919;',
                color: 'purple',
                label: 'Goals Completed',
                value: completedGoals
            })}
            ${kpiCard({
                icon: '&#9889;',
                color: 'blue',
                label: 'Task Velocity',
                value: taskVelocity
            })}
        `;
    }

    // --- Charts ---

    // 1. Activity Trend (Line chart - tasks completed per day)
    const activityChartEl = container.querySelector('#chart-activity');
    if (activityChartEl) {
        const activityByDay = dashboardData?.activity_trend || buildActivityTrend(allTasks);
        renderChart(activityChartEl, {
            type: 'line',
            labels: activityByDay.map(d => d.date || d.label),
            datasets: [{
                label: 'Tasks Completed',
                data: activityByDay.map(d => d.count || d.value || 0),
                color: 'var(--color-primary)'
            }]
        });
    }

    // 2. Goals by Category (Bar chart)
    const goalsChartEl = container.querySelector('#chart-goals');
    if (goalsChartEl) {
        const goalsByCategory = buildGoalsByCategory(allGoals);
        renderChart(goalsChartEl, {
            type: 'bar',
            labels: goalsByCategory.map(d => d.category),
            datasets: [{
                label: 'Goals',
                data: goalsByCategory.map(d => d.count),
                color: 'var(--color-primary-light)'
            }]
        });
    }

    // 3. Client Status Distribution (Donut chart)
    const clientsChartEl = container.querySelector('#chart-clients');
    if (clientsChartEl) {
        const clientsByStatus = buildClientsByStatus(allClients);
        renderChart(clientsChartEl, {
            type: 'donut',
            labels: clientsByStatus.map(d => d.status),
            datasets: [{
                label: 'Clients',
                data: clientsByStatus.map(d => d.count),
                colors: [
                    'var(--color-success)',
                    'var(--color-primary)',
                    'var(--color-warning)',
                    'var(--color-info)',
                    'var(--color-danger)',
                    'var(--text-muted)'
                ]
            }]
        });
    }

    // 4. Revenue Trend (Line chart)
    const revenueChartEl = container.querySelector('#chart-revenue');
    if (revenueChartEl) {
        const revenueTrend = revenueData?.trend || revenueData?.monthly || dashboardData?.revenue_trend || [];
        renderChart(revenueChartEl, {
            type: 'line',
            labels: revenueTrend.map(d => d.month || d.date || d.label),
            datasets: [{
                label: 'Revenue',
                data: revenueTrend.map(d => d.amount || d.value || d.revenue || 0),
                color: 'var(--color-success)'
            }]
        });
    }
}

/**
 * Build activity trend data from task list.
 * @param {Array} tasks
 * @returns {Array}
 */
function buildActivityTrend(tasks) {
    const dayMap = {};
    const now = new Date();

    // Initialize last 14 days
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dayMap[key] = 0;
    }

    // Count completed tasks by day
    tasks.forEach(t => {
        if ((t.status === 'done' || t.status === 'completed') && t.completed_at) {
            const key = t.completed_at.split('T')[0];
            if (dayMap[key] !== undefined) {
                dayMap[key]++;
            }
        }
    });

    return Object.entries(dayMap).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
    }));
}

/**
 * Build goals by category from goals list.
 * @param {Array} goals
 * @returns {Array}
 */
function buildGoalsByCategory(goals) {
    const catMap = {};
    goals.forEach(g => {
        const cat = g.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + 1;
    });

    return Object.entries(catMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Build client status distribution.
 * @param {Array} clients
 * @returns {Array}
 */
function buildClientsByStatus(clients) {
    const statusMap = {};
    clients.forEach(c => {
        const status = (c.status || 'unknown').charAt(0).toUpperCase() + (c.status || 'unknown').slice(1);
        statusMap[status] = (statusMap[status] || 0) + 1;
    });

    return Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
}
