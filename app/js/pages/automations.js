/**
 * Mindset365 - Automations Page
 * Full CRUD for workflow automations with trigger/action configuration,
 * active/inactive toggle, modal forms, and delete confirmation.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, capitalize, debounce } from '../utils.js';
import { getState } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';

/** Cached automations list */
let automations = [];

/** Search query */
let searchQuery = '';

// ── Trigger / Action metadata ──────────────────────────────────────────

const TRIGGER_TYPES = [
    { value: 'task_status_change', label: 'Task Status Change' },
    { value: 'goal_completed',     label: 'Goal Completed' },
    { value: 'date_reached',       label: 'Date Reached' },
    { value: 'client_added',       label: 'Client Added' },
    { value: 'session_completed',  label: 'Session Completed' }
];

const ACTION_TYPES = [
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'create_task',       label: 'Create Task' },
    { value: 'update_status',     label: 'Update Status' },
    { value: 'send_email',        label: 'Send Email' }
];

/**
 * Human-readable label for a trigger/action value.
 */
function typeLabel(value, list) {
    const item = list.find(t => t.value === value);
    return item ? item.label : capitalize((value || '').replace(/_/g, ' '));
}

/**
 * Build trigger-specific config fields HTML.
 * @param {string} triggerType
 * @param {Object} config - existing config values for editing
 * @returns {string}
 */
function triggerConfigFields(triggerType, config = {}) {
    switch (triggerType) {
        case 'task_status_change':
            return `
                <div class="form-group">
                    <label class="form-label">From Status</label>
                    <input type="text" id="trigger-from-status" placeholder="e.g., todo" value="${escapeHtml(config.from_status || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">To Status</label>
                    <input type="text" id="trigger-to-status" placeholder="e.g., completed" value="${escapeHtml(config.to_status || '')}">
                </div>`;
        case 'goal_completed':
            return `
                <div class="form-group">
                    <label class="form-label">Goal Category (optional)</label>
                    <input type="text" id="trigger-goal-category" placeholder="e.g., sales" value="${escapeHtml(config.goal_category || '')}">
                </div>`;
        case 'date_reached':
            return `
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" id="trigger-date" value="${escapeHtml(config.date || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Repeat</label>
                    <select id="trigger-repeat">
                        <option value="once" ${config.repeat === 'once' ? 'selected' : ''}>Once</option>
                        <option value="daily" ${config.repeat === 'daily' ? 'selected' : ''}>Daily</option>
                        <option value="weekly" ${config.repeat === 'weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="monthly" ${config.repeat === 'monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>`;
        case 'client_added':
            return `
                <div class="form-group">
                    <label class="form-label">Client Status Filter (optional)</label>
                    <input type="text" id="trigger-client-status" placeholder="e.g., lead" value="${escapeHtml(config.client_status || '')}">
                </div>`;
        case 'session_completed':
            return `
                <div class="form-group">
                    <label class="form-label">Session Type (optional)</label>
                    <input type="text" id="trigger-session-type" placeholder="e.g., coaching" value="${escapeHtml(config.session_type || '')}">
                </div>`;
        default:
            return '<p class="text-sm text-muted">Select a trigger type above.</p>';
    }
}

/**
 * Build action-specific config fields HTML.
 * @param {string} actionType
 * @param {Object} config - existing config values for editing
 * @returns {string}
 */
function actionConfigFields(actionType, config = {}) {
    switch (actionType) {
        case 'send_notification':
            return `
                <div class="form-group">
                    <label class="form-label">Notification Title</label>
                    <input type="text" id="action-notif-title" placeholder="Notification title" value="${escapeHtml(config.title || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Message</label>
                    <textarea id="action-notif-message" rows="2" placeholder="Notification message...">${escapeHtml(config.message || '')}</textarea>
                </div>`;
        case 'create_task':
            return `
                <div class="form-group">
                    <label class="form-label">Task Title</label>
                    <input type="text" id="action-task-title" placeholder="New task title" value="${escapeHtml(config.task_title || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Assign To (optional)</label>
                    <input type="text" id="action-task-assignee" placeholder="Name or email" value="${escapeHtml(config.assignee || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select id="action-task-priority">
                        <option value="low" ${config.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${(config.priority || 'medium') === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${config.priority === 'high' ? 'selected' : ''}>High</option>
                        <option value="urgent" ${config.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                    </select>
                </div>`;
        case 'update_status':
            return `
                <div class="form-group">
                    <label class="form-label">Entity Type</label>
                    <select id="action-entity-type">
                        <option value="task" ${config.entity_type === 'task' ? 'selected' : ''}>Task</option>
                        <option value="goal" ${config.entity_type === 'goal' ? 'selected' : ''}>Goal</option>
                        <option value="client" ${config.entity_type === 'client' ? 'selected' : ''}>Client</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">New Status</label>
                    <input type="text" id="action-new-status" placeholder="e.g., in_progress" value="${escapeHtml(config.new_status || '')}">
                </div>`;
        case 'send_email':
            return `
                <div class="form-group">
                    <label class="form-label">Recipient (or leave blank for trigger subject)</label>
                    <input type="email" id="action-email-to" placeholder="email@example.com" value="${escapeHtml(config.to || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Subject</label>
                    <input type="text" id="action-email-subject" placeholder="Email subject" value="${escapeHtml(config.subject || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Body</label>
                    <textarea id="action-email-body" rows="3" placeholder="Email body...">${escapeHtml(config.body || '')}</textarea>
                </div>`;
        default:
            return '<p class="text-sm text-muted">Select an action type above.</p>';
    }
}

/**
 * Collect trigger config values from the modal form.
 */
function collectTriggerConfig(modal, triggerType) {
    switch (triggerType) {
        case 'task_status_change':
            return {
                from_status: modal.querySelector('#trigger-from-status')?.value?.trim() || '',
                to_status: modal.querySelector('#trigger-to-status')?.value?.trim() || ''
            };
        case 'goal_completed':
            return {
                goal_category: modal.querySelector('#trigger-goal-category')?.value?.trim() || ''
            };
        case 'date_reached':
            return {
                date: modal.querySelector('#trigger-date')?.value || '',
                repeat: modal.querySelector('#trigger-repeat')?.value || 'once'
            };
        case 'client_added':
            return {
                client_status: modal.querySelector('#trigger-client-status')?.value?.trim() || ''
            };
        case 'session_completed':
            return {
                session_type: modal.querySelector('#trigger-session-type')?.value?.trim() || ''
            };
        default:
            return {};
    }
}

/**
 * Collect action config values from the modal form.
 */
function collectActionConfig(modal, actionType) {
    switch (actionType) {
        case 'send_notification':
            return {
                title: modal.querySelector('#action-notif-title')?.value?.trim() || '',
                message: modal.querySelector('#action-notif-message')?.value?.trim() || ''
            };
        case 'create_task':
            return {
                task_title: modal.querySelector('#action-task-title')?.value?.trim() || '',
                assignee: modal.querySelector('#action-task-assignee')?.value?.trim() || '',
                priority: modal.querySelector('#action-task-priority')?.value || 'medium'
            };
        case 'update_status':
            return {
                entity_type: modal.querySelector('#action-entity-type')?.value || 'task',
                new_status: modal.querySelector('#action-new-status')?.value?.trim() || ''
            };
        case 'send_email':
            return {
                to: modal.querySelector('#action-email-to')?.value?.trim() || '',
                subject: modal.querySelector('#action-email-subject')?.value?.trim() || '',
                body: modal.querySelector('#action-email-body')?.value?.trim() || ''
            };
        default:
            return {};
    }
}

// ── Rendering helpers ──────────────────────────────────────────────────

/**
 * Describe a trigger in human-readable text.
 */
function describeTrigger(auto) {
    const cfg = auto.trigger_config || {};
    switch (auto.trigger_type) {
        case 'task_status_change':
            return `Task moves${cfg.from_status ? ' from ' + cfg.from_status : ''}${cfg.to_status ? ' to ' + cfg.to_status : ''}`;
        case 'goal_completed':
            return cfg.goal_category ? `Goal completed in ${cfg.goal_category}` : 'Any goal is completed';
        case 'date_reached':
            return cfg.date ? `Date ${cfg.date} is reached (${cfg.repeat || 'once'})` : 'A date is reached';
        case 'client_added':
            return cfg.client_status ? `New ${cfg.client_status} client added` : 'A new client is added';
        case 'session_completed':
            return cfg.session_type ? `${capitalize(cfg.session_type)} session completed` : 'A session is completed';
        default:
            return typeLabel(auto.trigger_type, TRIGGER_TYPES);
    }
}

/**
 * Describe an action in human-readable text.
 */
function describeAction(auto) {
    const cfg = auto.action_config || {};
    switch (auto.action_type) {
        case 'send_notification':
            return cfg.title ? `Notify: ${cfg.title}` : 'Send a notification';
        case 'create_task':
            return cfg.task_title ? `Create task: ${cfg.task_title}` : 'Create a new task';
        case 'update_status':
            return cfg.new_status ? `Set ${cfg.entity_type || 'entity'} status to ${cfg.new_status}` : 'Update status';
        case 'send_email':
            return cfg.subject ? `Email: ${cfg.subject}` : 'Send an email';
        default:
            return typeLabel(auto.action_type, ACTION_TYPES);
    }
}

/**
 * Return filtered automations based on search.
 */
function filteredAutomations() {
    if (!searchQuery) return automations;
    const q = searchQuery.toLowerCase();
    return automations.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.trigger_type || '').toLowerCase().includes(q) ||
        (a.action_type || '').toLowerCase().includes(q)
    );
}

/**
 * Render the automations card list.
 */
function renderAutomationsList(container) {
    const listEl = container.querySelector('#automations-list');
    if (!listEl) return;

    const items = filteredAutomations();

    if (items.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#9889;</div>
                <h3>${searchQuery ? 'No matching automations' : 'No automations yet'}</h3>
                <p>${searchQuery ? 'Try a different search term.' : 'Create automation rules to streamline your workflow. Trigger actions when tasks move, goals complete, or dates arrive.'}</p>
                ${!searchQuery ? '<button class="btn btn-primary mt-4" id="empty-new-automation">+ New Automation</button>' : ''}
            </div>`;
        listEl.querySelector('#empty-new-automation')?.addEventListener('click', () => openAutomationModal(container));
        return;
    }

    listEl.innerHTML = `
        <div class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-4);">
            ${items.map(auto => `
                <div class="card hover-lift automation-card" data-id="${escapeHtml(String(auto.id))}" style="cursor:pointer;">
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div style="flex:1;min-width:0;">
                                <div class="flex items-center gap-2 mb-2">
                                    <h4 style="margin:0;">${escapeHtml(auto.name || 'Untitled Automation')}</h4>
                                </div>
                                <p class="text-sm text-muted" style="margin-bottom:var(--sp-1);">
                                    <strong>When:</strong> ${escapeHtml(describeTrigger(auto))}
                                </p>
                                <p class="text-sm text-muted">
                                    <strong>Then:</strong> ${escapeHtml(describeAction(auto))}
                                </p>
                                ${auto.created_at ? `<span class="text-sm text-muted mt-2" style="display:inline-block;">${escapeHtml(formatDate(auto.created_at))}</span>` : ''}
                            </div>
                            <div class="flex items-center gap-4" style="flex-shrink:0;">
                                <label class="toggle-switch" title="${auto.is_active ? 'Active' : 'Inactive'}" data-toggle-id="${escapeHtml(String(auto.id))}">
                                    <input type="checkbox" ${auto.is_active ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                                <span class="badge ${auto.is_active ? 'badge-success' : 'badge-neutral'}">
                                    ${auto.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button class="btn btn-icon btn-danger delete-automation-btn" data-id="${escapeHtml(String(auto.id))}" title="Delete">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`;

    // Card click -> edit (but not on toggle or delete)
    listEl.querySelectorAll('.automation-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.toggle-switch') || e.target.closest('.delete-automation-btn')) return;
            const id = card.dataset.id;
            const auto = automations.find(a => String(a.id) === id);
            if (auto) openAutomationModal(container, auto);
        });
    });

    // Toggle switches
    listEl.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            e.stopPropagation();
            const id = toggle.closest('.toggle-switch').dataset.toggleId;
            await toggleAutomation(container, id, toggle.checked);
        });
    });

    // Delete buttons
    listEl.querySelectorAll('.delete-automation-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const auto = automations.find(a => String(a.id) === id);
            deleteAutomation(container, auto);
        });
    });
}

// ── Toggle active/inactive ─────────────────────────────────────────────

async function toggleAutomation(container, id, isActive) {
    try {
        await api.put(`/automations/${id}`, { is_active: isActive });
        const auto = automations.find(a => String(a.id) === String(id));
        if (auto) auto.is_active = isActive;
        window.showToast(`Automation ${isActive ? 'activated' : 'deactivated'}.`, 'success');
        renderAutomationsList(container);
    } catch (err) {
        window.showToast(err.message || 'Failed to update automation.', 'error');
        renderAutomationsList(container);
    }
}

// ── Delete ─────────────────────────────────────────────────────────────

function deleteAutomation(container, auto) {
    if (!auto) return;
    confirmModal({
        title: 'Delete Automation',
        message: `Are you sure you want to delete <strong>${escapeHtml(auto.name || 'this automation')}</strong>? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
            try {
                await api.delete(`/automations/${auto.id}`);
                automations = automations.filter(a => a.id !== auto.id);
                window.showToast('Automation deleted.', 'success');
                renderAutomationsList(container);
            } catch (err) {
                window.showToast(err.message || 'Failed to delete automation.', 'error');
            }
        }
    });
}

// ── Modal (Create / Edit) ──────────────────────────────────────────────

function openAutomationModal(container, existing = null) {
    const isEdit = !!existing;
    const triggerType = existing?.trigger_type || 'task_status_change';
    const actionType = existing?.action_type || 'send_notification';

    const overlay = openModal({
        title: isEdit ? 'Edit Automation' : 'New Automation',
        size: 'lg',
        content: `
            <div class="form-group">
                <label class="form-label">Name *</label>
                <input type="text" id="auto-name" placeholder="e.g., Notify on task completion" value="${escapeHtml(existing?.name || '')}">
            </div>

            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
                <div class="form-group">
                    <label class="form-label">Trigger Type *</label>
                    <select id="auto-trigger-type">
                        ${TRIGGER_TYPES.map(t => `<option value="${t.value}" ${triggerType === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Action Type *</label>
                    <select id="auto-action-type">
                        ${ACTION_TYPES.map(t => `<option value="${t.value}" ${actionType === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-4);margin-bottom:var(--sp-4);">
                <h4 style="margin-bottom:var(--sp-3);font-size:var(--fs-sm);text-transform:uppercase;color:var(--text-muted);">Trigger Configuration</h4>
                <div id="trigger-config-fields">
                    ${triggerConfigFields(triggerType, existing?.trigger_config || {})}
                </div>
            </div>

            <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);padding:var(--sp-4);margin-bottom:var(--sp-4);">
                <h4 style="margin-bottom:var(--sp-3);font-size:var(--fs-sm);text-transform:uppercase;color:var(--text-muted);">Action Configuration</h4>
                <div id="action-config-fields">
                    ${actionConfigFields(actionType, existing?.action_config || {})}
                </div>
            </div>

            <div class="form-group">
                <label class="form-label flex items-center gap-2" style="cursor:pointer;">
                    <input type="checkbox" id="auto-active" ${existing ? (existing.is_active ? 'checked' : '') : 'checked'}>
                    <span>Active</span>
                </label>
            </div>
        `,
        footer: `
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-save">${isEdit ? 'Save Changes' : 'Create Automation'}</button>
        `
    });

    if (!overlay) return;

    // Dynamic trigger config fields
    const triggerSelect = overlay.querySelector('#auto-trigger-type');
    const triggerContainer = overlay.querySelector('#trigger-config-fields');
    triggerSelect?.addEventListener('change', () => {
        triggerContainer.innerHTML = triggerConfigFields(triggerSelect.value, {});
    });

    // Dynamic action config fields
    const actionSelect = overlay.querySelector('#auto-action-type');
    const actionContainer = overlay.querySelector('#action-config-fields');
    actionSelect?.addEventListener('change', () => {
        actionContainer.innerHTML = actionConfigFields(actionSelect.value, {});
    });

    // Cancel
    overlay.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

    // Save
    overlay.querySelector('#modal-save')?.addEventListener('click', async () => {
        const name = overlay.querySelector('#auto-name')?.value?.trim();
        if (!name) {
            window.showToast('Automation name is required.', 'warning');
            return;
        }

        const selectedTrigger = overlay.querySelector('#auto-trigger-type')?.value;
        const selectedAction = overlay.querySelector('#auto-action-type')?.value;

        const payload = {
            name,
            trigger_type: selectedTrigger,
            trigger_config: collectTriggerConfig(overlay, selectedTrigger),
            action_type: selectedAction,
            action_config: collectActionConfig(overlay, selectedAction),
            is_active: overlay.querySelector('#auto-active')?.checked ?? true
        };

        const btn = overlay.querySelector('#modal-save');
        const originalText = btn.textContent;
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            if (isEdit) {
                await api.put(`/automations/${existing.id}`, payload);
                window.showToast('Automation updated.', 'success');
            } else {
                await api.post('/automations', payload);
                window.showToast('Automation created.', 'success');
            }
            closeModal();
            await loadAutomations(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to save automation.', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

// ── Data loading ───────────────────────────────────────────────────────

async function loadAutomations(container) {
    try {
        const res = await api.get('/automations');
        automations = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        renderAutomationsList(container);
    } catch (err) {
        window.showToast(err.message || 'Failed to load automations.', 'error');
        const listEl = container.querySelector('#automations-list');
        if (listEl) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#9888;</div>
                    <h3>Failed to load automations</h3>
                    <p>${escapeHtml(err.message || 'Please try again later.')}</p>
                    <button class="btn btn-primary mt-4" id="retry-btn">Retry</button>
                </div>`;
            listEl.querySelector('#retry-btn')?.addEventListener('click', () => loadAutomations(container));
        }
    }
}

// ── Main render ────────────────────────────────────────────────────────

export async function render(container) {
    automations = [];
    searchQuery = '';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Automations</h1>
                <button class="btn btn-primary" id="new-automation-btn">+ New Automation</button>
            </div>

            <div class="flex items-center gap-4 mb-6">
                <div class="search-box" style="flex:1;max-width:400px;">
                    <input type="text" id="automations-search" placeholder="Search automations...">
                </div>
            </div>

            <div id="automations-list">
                <div class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-4);">
                    ${Array(3).fill(`
                        <div class="card">
                            <div class="card-body">
                                <div class="skeleton skeleton-text" style="width:40%;margin-bottom:var(--sp-2);"></div>
                                <div class="skeleton skeleton-text" style="width:70%;margin-bottom:var(--sp-1);"></div>
                                <div class="skeleton skeleton-text" style="width:50%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;

    // New automation button
    container.querySelector('#new-automation-btn')?.addEventListener('click', () => openAutomationModal(container));

    // Search
    const searchInput = container.querySelector('#automations-search');
    const debouncedSearch = debounce((value) => {
        searchQuery = value;
        renderAutomationsList(container);
    }, 300);
    searchInput?.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));

    // Load data
    await loadAutomations(container);
}
