/**
 * Mindset365 - Client Detail Page
 * Full client profile with tabbed interface: Overview, Sessions, Goals, Notes.
 * Supports inline editing, session creation, and note management.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, statusBadge, formatCurrency, getInitials, capitalize } from '../utils.js';
import { getState, setState } from '../store.js';

/** Currently loaded client data */
let client = null;

/** Related data */
let sessions = [];
let goals = [];
let notes = [];

/** Active tab key */
let activeTab = 'overview';

/** Whether the inline edit form is visible */
let isEditing = false;

/** Whether the add-session form is visible */
let isAddingSession = false;

/**
 * Tab definitions for the detail page.
 */
const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'goals', label: 'Goals' },
    { key: 'notes', label: 'Notes' }
];

/**
 * Render a loading skeleton for the client detail page.
 * @returns {string} HTML string
 */
function renderSkeleton() {
    return `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <div class="skeleton" style="width: 100px; height: 32px; border-radius: var(--radius-sm);"></div>
            </div>
            <div class="card mb-6">
                <div class="card-body">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="skeleton" style="width: 64px; height: 64px; border-radius: 50%;"></div>
                        <div>
                            <div class="skeleton skeleton-title" style="width: 200px;"></div>
                            <div class="skeleton skeleton-text" style="width: 160px; margin-top: var(--sp-2);"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="grid grid-4 gap-4 mb-6">
                ${Array(4).fill('<div class="skeleton skeleton-card" style="height: 80px;"></div>').join('')}
            </div>
            <div class="skeleton skeleton-card" style="height: 300px;"></div>
        </div>
    `;
}

/**
 * Compute quick stats from client data.
 * @returns {Array<{ label: string, value: string }>}
 */
function computeStats() {
    const sessionCount = sessions.length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    const totalGoals = goals.length;
    const goalPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
    const totalRevenue = client?.total_revenue ?? (client?.monthly_rate ? client.monthly_rate * (client?.months_active || 1) : 0);
    const lastSession = sessions.length > 0
        ? formatDate(sessions[0].date || sessions[0].scheduled_at || sessions[0].created_at)
        : 'None';

    return [
        { label: 'Sessions', value: String(sessionCount) },
        { label: 'Goal Completion', value: `${goalPct}%` },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Last Session', value: lastSession }
    ];
}

/**
 * Render the client info header card.
 * @returns {string} HTML string
 */
function renderClientHeader() {
    const name = escapeHtml(client.name || 'Unknown');
    const email = escapeHtml(client.email || '');
    const phone = escapeHtml(client.phone || '');
    const company = escapeHtml(client.company || '');

    return `
        <div class="card mb-6">
            <div class="card-header">
                <h3>Client Profile</h3>
                <button class="btn btn-secondary btn-sm" id="edit-client-btn">Edit</button>
            </div>
            <div class="card-body">
                <div class="flex items-center gap-4">
                    <div class="avatar avatar-lg">${client.avatar_url ? `<img src="${escapeHtml(client.avatar_url)}" alt="">` : getInitials(client.name || 'U')}</div>
                    <div style="flex: 1;">
                        <div class="flex items-center gap-2 mb-1">
                            <h2 style="font-size: var(--fs-xl); font-weight: var(--fw-bold);">${name}</h2>
                            ${statusBadge(client.status)}
                        </div>
                        <div class="flex items-center gap-4 flex-wrap">
                            ${email ? `<span class="text-sm text-secondary">${email}</span>` : ''}
                            ${phone ? `<span class="text-sm text-muted">${phone}</span>` : ''}
                            ${company ? `<span class="text-sm text-muted">${company}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the inline edit form for client details.
 * @returns {string} HTML string
 */
function renderEditForm() {
    return `
        <div class="card mb-6" id="edit-form-card">
            <div class="card-header">
                <h3>Edit Client</h3>
                <button class="btn btn-ghost btn-sm" id="cancel-edit-btn">Cancel</button>
            </div>
            <div class="card-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Full Name *</label>
                        <input type="text" id="edit-name" value="${escapeHtml(client.name || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email *</label>
                        <input type="email" id="edit-email" value="${escapeHtml(client.email || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" id="edit-phone" value="${escapeHtml(client.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Company</label>
                        <input type="text" id="edit-company" value="${escapeHtml(client.company || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="edit-status">
                            <option value="lead" ${client.status === 'lead' ? 'selected' : ''}>Lead</option>
                            <option value="active" ${client.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="paused" ${client.status === 'paused' ? 'selected' : ''}>Paused</option>
                            <option value="completed" ${client.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="churned" ${client.status === 'churned' ? 'selected' : ''}>Churned</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Package</label>
                        <select id="edit-package">
                            <option value="">None</option>
                            <option value="starter" ${client.package === 'starter' ? 'selected' : ''}>Starter</option>
                            <option value="growth" ${client.package === 'growth' ? 'selected' : ''}>Growth</option>
                            <option value="premium" ${client.package === 'premium' ? 'selected' : ''}>Premium</option>
                            <option value="enterprise" ${client.package === 'enterprise' ? 'selected' : ''}>Enterprise</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Monthly Rate ($)</label>
                        <input type="number" id="edit-rate" step="0.01" value="${client.monthly_rate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Coach</label>
                        <input type="text" id="edit-coach" value="${escapeHtml(client.coach_name || '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Bio / Notes</label>
                    <textarea id="edit-bio" rows="3">${escapeHtml(client.bio || client.notes || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Tags (comma separated)</label>
                    <input type="text" id="edit-tags" value="${escapeHtml((client.tags || []).join(', '))}">
                </div>
                <div class="flex justify-between mt-4">
                    <button class="btn btn-ghost" id="cancel-edit-btn-2">Cancel</button>
                    <button class="btn btn-primary" id="save-edit-btn">Save Changes</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the quick stats row.
 * @returns {string} HTML string
 */
function renderStatsRow() {
    const stats = computeStats();
    return `
        <div class="grid grid-4 gap-4 mb-6 stagger">
            ${stats.map(s => `
                <div class="card hover-lift" style="padding: var(--sp-4); text-align: center;">
                    <div class="text-xs text-muted mb-1">${escapeHtml(s.label)}</div>
                    <div style="font-size: var(--fs-xl); font-weight: var(--fw-bold);">${escapeHtml(s.value)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render the Overview tab content.
 * @returns {string} HTML string
 */
function renderOverviewTab() {
    const bio = client.bio || client.description || '';
    const tags = client.tags || [];
    const pkg = client.package || '';

    return `
        <div class="grid grid-2 gap-4 stagger">
            <!-- Bio / Notes -->
            <div class="card">
                <div class="card-header"><h3>About</h3></div>
                <div class="card-body">
                    ${bio
                        ? `<p class="text-sm text-secondary" style="white-space: pre-wrap;">${escapeHtml(bio)}</p>`
                        : '<p class="text-sm text-muted">No bio available.</p>'
                    }
                </div>
            </div>

            <!-- Tags & Package -->
            <div class="card">
                <div class="card-header"><h3>Details</h3></div>
                <div class="card-body">
                    <div class="mb-4">
                        <span class="text-xs text-muted">Tags</span>
                        <div class="flex gap-2 flex-wrap mt-2">
                            ${tags.length > 0
                                ? tags.map(t => `<span class="badge badge-neutral">${escapeHtml(t)}</span>`).join('')
                                : '<span class="text-sm text-muted">No tags</span>'
                            }
                        </div>
                    </div>
                    <div class="mb-4">
                        <span class="text-xs text-muted">Coaching Package</span>
                        <div class="text-sm font-medium mt-1">${pkg ? escapeHtml(capitalize(pkg)) : 'None assigned'}</div>
                    </div>
                    <div class="mb-4">
                        <span class="text-xs text-muted">Monthly Rate</span>
                        <div class="text-sm font-medium mt-1">${client.monthly_rate ? formatCurrency(client.monthly_rate) : '-'}</div>
                    </div>
                    <div class="mb-4">
                        <span class="text-xs text-muted">Coach</span>
                        <div class="text-sm font-medium mt-1">${escapeHtml(client.coach_name || 'Unassigned')}</div>
                    </div>
                    <div>
                        <span class="text-xs text-muted">Joined</span>
                        <div class="text-sm font-medium mt-1">${client.created_at ? formatDate(client.created_at) : '-'}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the Sessions tab content.
 * @returns {string} HTML string
 */
function renderSessionsTab() {
    const addFormHTML = isAddingSession ? `
        <div class="card mb-4" id="add-session-form">
            <div class="card-header">
                <h3>New Session</h3>
                <button class="btn btn-ghost btn-sm" id="cancel-session-btn">Cancel</button>
            </div>
            <div class="card-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" id="session-title" placeholder="Session topic...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date *</label>
                        <input type="datetime-local" id="session-date" value="${new Date().toISOString().slice(0, 16)}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Duration (min)</label>
                        <input type="number" id="session-duration" value="60" min="15" step="15">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="session-status">
                            <option value="scheduled">Scheduled</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea id="session-notes" rows="3" placeholder="Session notes..."></textarea>
                </div>
                <div class="flex justify-end gap-2 mt-4">
                    <button class="btn btn-ghost" id="cancel-session-btn-2">Cancel</button>
                    <button class="btn btn-primary" id="save-session-btn">Add Session</button>
                </div>
            </div>
        </div>
    ` : '';

    const listHTML = sessions.length > 0 ? `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Date</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${sessions.map(s => `
                        <tr>
                            <td class="font-medium">${escapeHtml(s.title || 'Session')}</td>
                            <td class="text-sm">${formatDate(s.date || s.scheduled_at || s.created_at, 'datetime')}</td>
                            <td class="text-sm">${s.duration ? `${escapeHtml(String(s.duration))} min` : '-'}</td>
                            <td>${statusBadge(s.status || 'completed')}</td>
                            <td class="text-sm text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.notes || s.summary || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div class="empty-state">
            <div class="empty-state-icon">&#128197;</div>
            <h3>No sessions yet</h3>
            <p>Schedule the first coaching session with this client.</p>
        </div>
    `;

    return `
        <div class="flex justify-end mb-4">
            <button class="btn btn-primary btn-sm" id="add-session-btn">+ Add Session</button>
        </div>
        ${addFormHTML}
        ${listHTML}
    `;
}

/**
 * Render the Goals tab content.
 * @returns {string} HTML string
 */
function renderGoalsTab() {
    if (goals.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">&#127919;</div>
                <h3>No goals found</h3>
                <p>No goals are linked to this client yet.</p>
            </div>
        `;
    }

    return `
        <div class="flex flex-col gap-4 stagger">
            ${goals.map(g => {
                const progress = g.current_value && g.target_value
                    ? Math.min(100, Math.round((g.current_value / g.target_value) * 100))
                    : (g.progress ?? 0);

                return `
                    <div class="card" style="padding: var(--sp-4);">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <span class="font-medium">${escapeHtml(g.title)}</span>
                                ${g.category ? `<span class="badge badge-primary">${escapeHtml(g.category)}</span>` : ''}
                            </div>
                            ${statusBadge(g.status)}
                        </div>
                        ${g.description ? `<p class="text-sm text-muted mb-2">${escapeHtml(g.description)}</p>` : ''}
                        <div class="flex items-center gap-3">
                            <div class="progress-bar" style="flex: 1;">
                                <div class="progress-fill ${progress >= 100 ? 'green' : progress >= 60 ? '' : 'orange'}" style="width: ${progress}%;"></div>
                            </div>
                            <span class="text-sm font-medium" style="min-width: 40px;">${progress}%</span>
                        </div>
                        ${g.target_date ? `<div class="text-xs text-muted mt-2">Target: ${formatDate(g.target_date)}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render the Notes tab content.
 * @returns {string} HTML string
 */
function renderNotesTab() {
    const notesList = Array.isArray(notes) ? notes : (typeof notes === 'string' && notes ? [{ content: notes }] : []);

    const listHTML = notesList.length > 0 ? `
        <div class="flex flex-col gap-3 stagger">
            ${notesList.map(n => `
                <div class="card" style="padding: var(--sp-4);">
                    <p class="text-sm text-secondary" style="white-space: pre-wrap;">${escapeHtml(n.content || n.body || String(n))}</p>
                    <div class="flex items-center gap-2 mt-2">
                        ${n.user_name ? `<span class="text-xs font-medium">${escapeHtml(n.user_name)}</span>` : ''}
                        ${n.created_at ? `<span class="text-xs text-muted">${formatDate(n.created_at, 'relative')}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="empty-state" style="padding: var(--sp-6);">
            <p class="text-sm text-muted">No notes yet.</p>
        </div>
    `;

    return `
        ${listHTML}
        <div class="card mt-4" style="padding: var(--sp-4);">
            <div class="flex gap-2">
                <textarea id="new-note-input" rows="3" placeholder="Add a note..." style="flex: 1;"></textarea>
                <button class="btn btn-primary btn-sm" id="add-note-btn" style="align-self: flex-end;">Add Note</button>
            </div>
        </div>
    `;
}

/**
 * Render the tab content based on the active tab.
 * @returns {string} HTML string
 */
function renderTabContent() {
    switch (activeTab) {
        case 'overview': return renderOverviewTab();
        case 'sessions': return renderSessionsTab();
        case 'goals': return renderGoalsTab();
        case 'notes': return renderNotesTab();
        default: return renderOverviewTab();
    }
}

/**
 * Render the full page layout and attach event listeners.
 * @param {HTMLElement} container
 */
function renderPage(container) {
    container.innerHTML = `
        <div class="page-enter">
            <!-- Back Button -->
            <div class="flex items-center justify-between mb-6">
                <button class="btn btn-ghost btn-sm" id="back-btn">&larr; Back to Clients</button>
            </div>

            <!-- Client Header or Edit Form -->
            <div id="client-header-area">
                ${isEditing ? renderEditForm() : renderClientHeader()}
            </div>

            <!-- Quick Stats -->
            ${renderStatsRow()}

            <!-- Tabs -->
            <div class="tabs mb-4" id="detail-tabs">
                ${TABS.map(t => `
                    <div class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</div>
                `).join('')}
            </div>

            <!-- Tab Content -->
            <div id="tab-content">
                ${renderTabContent()}
            </div>
        </div>
    `;

    attachEventListeners(container);
}

/**
 * Attach all event listeners for the page.
 * @param {HTMLElement} container
 */
function attachEventListeners(container) {
    // Back button
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/clients'));

    // Edit button
    container.querySelector('#edit-client-btn')?.addEventListener('click', () => {
        isEditing = true;
        renderPage(container);
    });

    // Cancel edit
    const cancelEditHandler = () => {
        isEditing = false;
        renderPage(container);
    };
    container.querySelector('#cancel-edit-btn')?.addEventListener('click', cancelEditHandler);
    container.querySelector('#cancel-edit-btn-2')?.addEventListener('click', cancelEditHandler);

    // Save edit
    container.querySelector('#save-edit-btn')?.addEventListener('click', async () => {
        const name = container.querySelector('#edit-name')?.value?.trim();
        const email = container.querySelector('#edit-email')?.value?.trim();

        if (!name || !email) {
            window.showToast('Name and email are required.', 'warning');
            return;
        }

        const btn = container.querySelector('#save-edit-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            const tagsRaw = container.querySelector('#edit-tags')?.value || '';
            const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

            await api.put(`/clients/${client.id}`, {
                name,
                email,
                phone: container.querySelector('#edit-phone')?.value?.trim() || '',
                company: container.querySelector('#edit-company')?.value?.trim() || '',
                status: container.querySelector('#edit-status')?.value,
                package: container.querySelector('#edit-package')?.value || null,
                monthly_rate: parseFloat(container.querySelector('#edit-rate')?.value) || 0,
                coach_name: container.querySelector('#edit-coach')?.value?.trim() || '',
                bio: container.querySelector('#edit-bio')?.value?.trim() || '',
                tags
            });

            window.showToast('Client updated successfully!', 'success');
            isEditing = false;
            await loadClientData(client.id);
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to update client.', 'error');
            btn.innerHTML = 'Save Changes';
            btn.disabled = false;
        }
    });

    // Tab switching
    container.querySelector('#detail-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        activeTab = tab.dataset.tab;
        container.querySelectorAll('#detail-tabs .tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === activeTab)
        );
        const tabContent = container.querySelector('#tab-content');
        if (tabContent) {
            tabContent.innerHTML = renderTabContent();
            attachTabListeners(container);
        }
    });

    // Tab-specific listeners
    attachTabListeners(container);
}

/**
 * Attach event listeners specific to the active tab.
 * @param {HTMLElement} container
 */
function attachTabListeners(container) {
    if (activeTab === 'sessions') {
        // Add session button
        container.querySelector('#add-session-btn')?.addEventListener('click', () => {
            isAddingSession = true;
            const tabContent = container.querySelector('#tab-content');
            if (tabContent) {
                tabContent.innerHTML = renderSessionsTab();
                attachTabListeners(container);
            }
        });

        // Cancel session form
        const cancelSessionHandler = () => {
            isAddingSession = false;
            const tabContent = container.querySelector('#tab-content');
            if (tabContent) {
                tabContent.innerHTML = renderSessionsTab();
                attachTabListeners(container);
            }
        };
        container.querySelector('#cancel-session-btn')?.addEventListener('click', cancelSessionHandler);
        container.querySelector('#cancel-session-btn-2')?.addEventListener('click', cancelSessionHandler);

        // Save session
        container.querySelector('#save-session-btn')?.addEventListener('click', async () => {
            const dateVal = container.querySelector('#session-date')?.value;
            if (!dateVal) {
                window.showToast('Session date is required.', 'warning');
                return;
            }

            const btn = container.querySelector('#save-session-btn');
            btn.innerHTML = '<span class="spinner-sm"></span> Adding...';
            btn.disabled = true;

            try {
                await api.post(`/clients/${client.id}/sessions`, {
                    title: container.querySelector('#session-title')?.value?.trim() || 'Coaching Session',
                    date: dateVal,
                    duration: parseInt(container.querySelector('#session-duration')?.value, 10) || 60,
                    status: container.querySelector('#session-status')?.value || 'scheduled',
                    notes: container.querySelector('#session-notes')?.value?.trim() || ''
                });

                window.showToast('Session added successfully!', 'success');
                isAddingSession = false;
                await loadClientSessions(client.id);
                const tabContent = container.querySelector('#tab-content');
                if (tabContent) {
                    tabContent.innerHTML = renderSessionsTab();
                    attachTabListeners(container);
                }
            } catch (err) {
                window.showToast(err.message || 'Failed to add session.', 'error');
                btn.innerHTML = 'Add Session';
                btn.disabled = false;
            }
        });
    }

    if (activeTab === 'notes') {
        // Add note
        container.querySelector('#add-note-btn')?.addEventListener('click', async () => {
            const input = container.querySelector('#new-note-input');
            const content = input?.value?.trim();
            if (!content) {
                window.showToast('Please enter a note.', 'warning');
                return;
            }

            const btn = container.querySelector('#add-note-btn');
            btn.innerHTML = '<span class="spinner-sm"></span>';
            btn.disabled = true;

            try {
                await api.post(`/clients/${client.id}/notes`, { content });
                window.showToast('Note added!', 'success');
                await loadClientNotes(client.id);
                const tabContent = container.querySelector('#tab-content');
                if (tabContent) {
                    tabContent.innerHTML = renderNotesTab();
                    attachTabListeners(container);
                }
            } catch (err) {
                window.showToast(err.message || 'Failed to add note.', 'error');
                btn.innerHTML = 'Add Note';
                btn.disabled = false;
            }
        });
    }
}

/**
 * Load the primary client data.
 * @param {string|number} id
 * @returns {Promise<boolean>} true if loaded successfully
 */
async function loadClientData(id) {
    try {
        const res = await api.get(`/clients/${id}`);
        client = res?.data || res;
        goals = client?.goals || [];
        notes = client?.notes_list || client?.notes || [];
        return true;
    } catch {
        return false;
    }
}

/**
 * Load sessions for the client.
 * @param {string|number} id
 */
async function loadClientSessions(id) {
    try {
        const res = await api.get(`/clients/${id}/sessions`);
        sessions = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch {
        sessions = client?.sessions || [];
    }
}

/**
 * Load notes for the client.
 * @param {string|number} id
 */
async function loadClientNotes(id) {
    try {
        const res = await api.get(`/clients/${id}/notes`);
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        notes = data;
    } catch {
        // Keep existing notes from client data
    }
}

/**
 * Render the client detail page.
 * @param {HTMLElement} container
 * @param {Object} params - Route params with params.id
 */
export async function render(container, params) {
    // Guard: missing ID
    if (!params?.id) {
        navigate('/clients', { replace: true });
        return;
    }

    // Reset state
    client = null;
    sessions = [];
    goals = [];
    notes = [];
    activeTab = 'overview';
    isEditing = false;
    isAddingSession = false;

    // Show loading skeleton
    container.innerHTML = renderSkeleton();

    // Load client data
    const loaded = await loadClientData(params.id);

    if (!loaded || !client) {
        container.innerHTML = `
            <div class="page-enter">
                <div class="empty-state">
                    <div class="empty-state-icon">&#128533;</div>
                    <h3>Client not found</h3>
                    <p>The client may have been removed or the link is invalid.</p>
                    <button class="btn btn-primary mt-4" id="back-btn">Back to Clients</button>
                </div>
            </div>
        `;
        container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/clients'));
        window.showToast('Failed to load client.', 'error');
        return;
    }

    // Load sessions (may be included in client response or separate)
    if (client.sessions && Array.isArray(client.sessions)) {
        sessions = client.sessions;
    } else {
        await loadClientSessions(params.id);
    }

    // Render full page
    renderPage(container);
}
