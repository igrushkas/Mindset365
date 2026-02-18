/**
 * Mindset365 - Goals Page
 * Goal listing with tabs, goal cards with progress rings, and create/detail modals.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../components/modal.js';
import { formatDate } from '../utils.js';

/** Active filter tab */
let activeTab = 'all';

/** Cached goals list */
let goals = [];

/**
 * Build a progress ring SVG.
 * @param {number} percent - 0-100
 * @param {number} size - diameter in px
 * @param {number} stroke - stroke width
 * @returns {string} SVG HTML
 */
function progressRing(percent, size = 48, stroke = 4) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    const color = percent >= 100 ? 'var(--color-success)' : percent >= 50 ? 'var(--color-primary)' : 'var(--color-warning)';

    return `
        <div class="progress-ring" style="width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="var(--border-color)" stroke-width="${stroke}" />
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="${color}" stroke-width="${stroke}"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" />
            </svg>
            <span class="progress-ring-text">${Math.round(percent)}%</span>
        </div>
    `;
}

/**
 * Map priority to a CSS class suffix.
 * @param {string} priority
 * @returns {string}
 */
function priorityClass(priority) {
    const map = { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' };
    return map[priority] || 'none';
}

/**
 * Render a single goal card.
 * @param {Object} goal
 * @returns {string} HTML string
 */
function renderGoalCard(goal) {
    const progress = goal.current_value && goal.target_value
        ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
        : 0;

    return `
        <div class="card card-clickable hover-lift goal-card" data-goal-id="${goal.id}">
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="priority-dot priority-${priorityClass(goal.priority)}"></span>
                        <span class="badge badge-primary">${goal.category || 'General'}</span>
                    </div>
                    <h3 style="font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--sp-1);">${goal.title}</h3>
                    ${goal.description ? `<p class="text-sm text-muted line-clamp-2">${goal.description}</p>` : ''}
                </div>
                ${progressRing(progress)}
            </div>
            <div class="card-footer" style="margin-top: var(--sp-3); padding-top: var(--sp-3);">
                <span class="text-xs text-muted">
                    ${goal.target_date ? `Target: ${formatDate(goal.target_date)}` : 'No target date'}
                </span>
                <span class="badge ${goal.status === 'completed' ? 'badge-success' : goal.status === 'in_progress' ? 'badge-primary' : 'badge-neutral'}">
                    ${(goal.status || 'not_started').replace(/_/g, ' ')}
                </span>
            </div>
        </div>
    `;
}

/**
 * Filter goals based on active tab.
 * @returns {Array}
 */
function filteredGoals() {
    if (activeTab === 'all') return goals;
    return goals.filter(g => g.status === activeTab);
}

/**
 * Re-render the goal grid.
 * @param {HTMLElement} container
 */
function renderGoalGrid(container) {
    const gridEl = container.querySelector('#goals-grid');
    if (!gridEl) return;

    const filtered = filteredGoals();

    if (filtered.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">&#127919;</div>
                <h3>No goals found</h3>
                <p>${activeTab === 'all' ? 'Create your first goal to get started.' : `No ${activeTab.replace(/_/g, ' ')} goals.`}</p>
                <button class="btn btn-primary mt-4" id="empty-new-goal">New Goal</button>
            </div>
        `;
        gridEl.querySelector('#empty-new-goal')?.addEventListener('click', () => openNewGoalModal(container));
        return;
    }

    gridEl.innerHTML = filtered.map(renderGoalCard).join('');
    gridEl.classList.add('stagger');

    // Attach click listeners for goal detail
    gridEl.querySelectorAll('.goal-card').forEach(card => {
        card.addEventListener('click', () => {
            const goalId = card.dataset.goalId;
            const goal = goals.find(g => String(g.id) === goalId);
            if (goal) openGoalDetailModal(goal, container);
        });
    });
}

/**
 * Open the goal detail modal with check-in form.
 * @param {Object} goal
 * @param {HTMLElement} container
 */
function openGoalDetailModal(goal, container) {
    const progress = goal.current_value && goal.target_value
        ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
        : 0;

    openModal({
        title: goal.title,
        size: 'lg',
        body: `
            <div class="flex items-start gap-6 mb-6">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="badge badge-primary">${goal.category || 'General'}</span>
                        <span class="badge ${goal.status === 'completed' ? 'badge-success' : goal.status === 'in_progress' ? 'badge-primary' : 'badge-neutral'}">
                            ${(goal.status || 'not_started').replace(/_/g, ' ')}
                        </span>
                        <span class="priority-dot priority-${priorityClass(goal.priority)}" style="margin-left: auto;"></span>
                    </div>
                    ${goal.description ? `<p class="text-sm text-secondary mb-4">${goal.description}</p>` : ''}
                    <div class="grid grid-2 gap-4">
                        <div>
                            <span class="text-xs text-muted">Start Date</span>
                            <div class="text-sm font-medium">${goal.start_date ? formatDate(goal.start_date) : 'Not set'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-muted">Target Date</span>
                            <div class="text-sm font-medium">${goal.target_date ? formatDate(goal.target_date) : 'Not set'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-muted">Current Value</span>
                            <div class="text-sm font-medium">${goal.current_value ?? 0} ${goal.unit || ''}</div>
                        </div>
                        <div>
                            <span class="text-xs text-muted">Target Value</span>
                            <div class="text-sm font-medium">${goal.target_value ?? 0} ${goal.unit || ''}</div>
                        </div>
                    </div>
                </div>
                <div style="text-align: center;">
                    ${progressRing(progress, 80, 6)}
                    <div class="text-xs text-muted mt-2">Progress</div>
                </div>
            </div>

            <div class="divider"></div>

            <h4 style="font-size: var(--fs-md); margin-bottom: var(--sp-4);">Log Check-in</h4>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">New Value</label>
                    <input type="number" id="checkin-value" placeholder="Enter current value" value="${goal.current_value || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select id="checkin-status">
                        <option value="not_started" ${goal.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                        <option value="in_progress" ${goal.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${goal.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea id="checkin-notes" rows="3" placeholder="What progress have you made?"></textarea>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-checkin">Save Check-in</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-checkin')?.addEventListener('click', async () => {
                const value = parseFloat(modal.querySelector('#checkin-value')?.value);
                const status = modal.querySelector('#checkin-status')?.value;
                const notes = modal.querySelector('#checkin-notes')?.value;

                const submitBtn = modal.querySelector('#modal-checkin');
                submitBtn.innerHTML = '<span class="spinner-sm"></span> Saving...';
                submitBtn.disabled = true;

                try {
                    await api.put(`/goals/${goal.id}`, {
                        current_value: isNaN(value) ? goal.current_value : value,
                        status,
                        notes
                    });
                    showToast('Check-in saved successfully!', 'success');
                    closeModal();
                    await loadGoals(container);
                } catch (err) {
                    showToast(err.message || 'Failed to save check-in.', 'error');
                    submitBtn.innerHTML = 'Save Check-in';
                    submitBtn.disabled = false;
                }
            });
        }
    });
}

/**
 * Open the new goal creation modal.
 * @param {HTMLElement} container
 */
function openNewGoalModal(container) {
    const categories = ['Marketing', 'Sales', 'Operations', 'Finance', 'Mindset', 'Product', 'Health', 'Other'];
    const priorities = ['low', 'medium', 'high', 'urgent'];

    openModal({
        title: 'New Goal',
        body: `
            <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" id="goal-title" placeholder="e.g., Increase monthly revenue by 20%">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="goal-description" rows="3" placeholder="Describe your goal..."></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="goal-category">
                        ${categories.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select id="goal-priority">
                        ${priorities.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select id="goal-type">
                        <option value="numeric">Numeric Target</option>
                        <option value="boolean">Yes / No</option>
                        <option value="milestone">Milestone</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <input type="text" id="goal-unit" placeholder="e.g., $, leads, hours">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Target Value</label>
                    <input type="number" id="goal-target" placeholder="e.g., 10000">
                </div>
                <div class="form-group">
                    <label class="form-label">Starting Value</label>
                    <input type="number" id="goal-start-value" value="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Start Date</label>
                    <input type="date" id="goal-start-date" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label class="form-label">Target Date</label>
                    <input type="date" id="goal-target-date">
                </div>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-create">Create Goal</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-create')?.addEventListener('click', async () => {
                const title = modal.querySelector('#goal-title')?.value?.trim();
                if (!title) {
                    showToast('Goal title is required.', 'warning');
                    return;
                }

                const createBtn = modal.querySelector('#modal-create');
                createBtn.innerHTML = '<span class="spinner-sm"></span> Creating...';
                createBtn.disabled = true;

                try {
                    const payload = {
                        title,
                        description: modal.querySelector('#goal-description')?.value?.trim() || '',
                        category: modal.querySelector('#goal-category')?.value,
                        priority: modal.querySelector('#goal-priority')?.value,
                        type: modal.querySelector('#goal-type')?.value,
                        unit: modal.querySelector('#goal-unit')?.value?.trim() || '',
                        target_value: parseFloat(modal.querySelector('#goal-target')?.value) || 0,
                        current_value: parseFloat(modal.querySelector('#goal-start-value')?.value) || 0,
                        start_date: modal.querySelector('#goal-start-date')?.value || null,
                        target_date: modal.querySelector('#goal-target-date')?.value || null
                    };

                    await api.post('/goals', payload);
                    showToast('Goal created successfully!', 'success');
                    closeModal();
                    await loadGoals(container);
                } catch (err) {
                    showToast(err.message || 'Failed to create goal.', 'error');
                    createBtn.innerHTML = 'Create Goal';
                    createBtn.disabled = false;
                }
            });
        }
    });
}

/**
 * Fetch goals from API and re-render grid.
 * @param {HTMLElement} container
 */
async function loadGoals(container) {
    try {
        const res = await api.get('/goals');
        goals = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        renderGoalGrid(container);
    } catch (err) {
        showToast(err.message || 'Failed to load goals.', 'error');
    }
}

/**
 * Render the goals page.
 * @param {HTMLElement} container
 */
export async function render(container) {
    activeTab = 'all';
    goals = [];

    const tabs = [
        { key: 'all', label: 'All' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'completed', label: 'Completed' },
        { key: 'not_started', label: 'Not Started' }
    ];

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Goals</h1>
                <div class="page-actions">
                    <button class="btn btn-primary" id="new-goal-btn">
                        + New Goal
                    </button>
                </div>
            </div>

            <div class="tabs" id="goals-tabs">
                ${tabs.map(t => `
                    <div class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</div>
                `).join('')}
            </div>

            <div class="grid grid-auto" id="goals-grid">
                ${Array(6).fill('<div class="skeleton skeleton-card"></div>').join('')}
            </div>
        </div>
    `;

    // Tab switching
    container.querySelector('#goals-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        activeTab = tab.dataset.tab;
        container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
        renderGoalGrid(container);
    });

    // New goal button
    container.querySelector('#new-goal-btn')?.addEventListener('click', () => openNewGoalModal(container));

    // Load goals
    await loadGoals(container);
}
