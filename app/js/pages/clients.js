/**
 * Mindset365 - Clients Page
 * Client listing with pipeline tabs, table view, client detail, and add client modal.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../components/modal.js';
import { formatDate, formatCurrency, getInitials, statusBadge, timeAgo } from '../utils.js';

/** Active status filter */
let activeTab = 'all';

/** Cached client list */
let clients = [];

/**
 * Status tab definitions with display labels.
 */
const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'lead', label: 'Leads' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'completed', label: 'Completed' },
    { key: 'churned', label: 'Churned' }
];

/**
 * Filter clients based on active tab.
 * @returns {Array}
 */
function filteredClients() {
    if (activeTab === 'all') return clients;
    return clients.filter(c => c.status === activeTab);
}

/**
 * Render the client table.
 * @param {HTMLElement} container
 */
function renderClientTable(container) {
    const tableEl = container.querySelector('#clients-table');
    if (!tableEl) return;

    const filtered = filteredClients();

    if (filtered.length === 0) {
        tableEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128101;</div>
                <h3>No clients found</h3>
                <p>${activeTab === 'all' ? 'Add your first client to start coaching.' : `No ${activeTab} clients.`}</p>
                <button class="btn btn-primary mt-4" id="empty-add-client">Add Client</button>
            </div>
        `;
        tableEl.querySelector('#empty-add-client')?.addEventListener('click', () => openAddClientModal(container));
        return;
    }

    tableEl.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Coach</th>
                        <th>Package</th>
                        <th>Sessions</th>
                        <th>Monthly Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(client => {
                        const sessionsUsed = client.sessions_used ?? 0;
                        const sessionsTotal = client.sessions_total ?? client.sessions_per_month ?? 0;
                        const sessionsPct = sessionsTotal > 0 ? Math.round((sessionsUsed / sessionsTotal) * 100) : 0;

                        return `
                            <tr class="client-row" data-client-id="${client.id}" style="cursor: pointer;">
                                <td>
                                    <div class="flex items-center gap-3">
                                        <div class="avatar avatar-sm">${client.avatar_url ? `<img src="${client.avatar_url}" alt="">` : getInitials(client.name || 'U')}</div>
                                        <span class="font-medium">${client.name || 'Unknown'}</span>
                                    </div>
                                </td>
                                <td class="text-sm text-secondary">${client.email || '-'}</td>
                                <td class="text-sm">${client.company || '-'}</td>
                                <td>${statusBadge(client.status)}</td>
                                <td class="text-sm">${client.coach_name || '-'}</td>
                                <td class="text-sm">${client.package || '-'}</td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <div class="progress-bar" style="width: 60px;">
                                            <div class="progress-fill ${sessionsPct >= 80 ? 'orange' : ''}" style="width: ${sessionsPct}%;"></div>
                                        </div>
                                        <span class="text-xs text-muted">${sessionsUsed}/${sessionsTotal}</span>
                                    </div>
                                </td>
                                <td class="text-sm font-medium">${client.monthly_rate ? formatCurrency(client.monthly_rate) : '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Row click -> client detail
    tableEl.querySelectorAll('.client-row').forEach(row => {
        row.addEventListener('click', () => {
            navigate(`/clients/${row.dataset.clientId}`);
        });
    });
}

/**
 * Open the add client modal.
 * @param {HTMLElement} container
 */
function openAddClientModal(container) {
    openModal({
        title: 'Add Client',
        body: `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Full Name *</label>
                    <input type="text" id="client-name" placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label class="form-label">Email *</label>
                    <input type="email" id="client-email" placeholder="john@example.com">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Phone</label>
                    <input type="tel" id="client-phone" placeholder="+1 (555) 123-4567">
                </div>
                <div class="form-group">
                    <label class="form-label">Company</label>
                    <input type="text" id="client-company" placeholder="Company name">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select id="client-status">
                        <option value="lead">Lead</option>
                        <option value="active" selected>Active</option>
                        <option value="paused">Paused</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Package</label>
                    <select id="client-package">
                        <option value="">Select package...</option>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Monthly Rate ($)</label>
                    <input type="number" id="client-rate" placeholder="0.00" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">Assign Coach</label>
                    <input type="text" id="client-coach" placeholder="Coach name or leave blank">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea id="client-notes" rows="2" placeholder="Initial notes about this client..."></textarea>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-create">Add Client</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-create')?.addEventListener('click', async () => {
                const name = modal.querySelector('#client-name')?.value?.trim();
                const email = modal.querySelector('#client-email')?.value?.trim();

                if (!name || !email) {
                    showToast('Name and email are required.', 'warning');
                    return;
                }

                const btn = modal.querySelector('#modal-create');
                btn.innerHTML = '<span class="spinner-sm"></span> Adding...';
                btn.disabled = true;

                try {
                    await api.post('/clients', {
                        name,
                        email,
                        phone: modal.querySelector('#client-phone')?.value?.trim() || '',
                        company: modal.querySelector('#client-company')?.value?.trim() || '',
                        status: modal.querySelector('#client-status')?.value,
                        package: modal.querySelector('#client-package')?.value || null,
                        monthly_rate: parseFloat(modal.querySelector('#client-rate')?.value) || 0,
                        coach_name: modal.querySelector('#client-coach')?.value?.trim() || '',
                        notes: modal.querySelector('#client-notes')?.value?.trim() || ''
                    });
                    showToast('Client added successfully!', 'success');
                    closeModal();
                    await loadClients(container);
                } catch (err) {
                    showToast(err.message || 'Failed to add client.', 'error');
                    btn.innerHTML = 'Add Client';
                    btn.disabled = false;
                }
            });
        }
    });
}

/**
 * Fetch clients from API.
 * @param {HTMLElement} container
 */
async function loadClients(container) {
    try {
        const res = await api.get('/clients');
        clients = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        renderClientTable(container);
    } catch (err) {
        showToast(err.message || 'Failed to load clients.', 'error');
    }
}

/**
 * Render the client detail view (when navigated to /clients/:id).
 * @param {HTMLElement} container
 * @param {string|number} clientId
 */
async function renderClientDetail(container, clientId) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-ghost btn-sm" id="back-to-clients">&larr; Back to Clients</button>
            </div>
            <div class="grid grid-2 gap-6">
                <div class="card skeleton-card" style="height: 300px;"></div>
                <div class="card skeleton-card" style="height: 300px;"></div>
            </div>
        </div>
    `;

    container.querySelector('#back-to-clients')?.addEventListener('click', () => navigate('/clients'));

    let client = null;
    try {
        const res = await api.get(`/clients/${clientId}`);
        client = res?.data || res;
    } catch (err) {
        showToast(err.message || 'Failed to load client.', 'error');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128533;</div>
                <h3>Client not found</h3>
                <p>The client may have been removed or the link is invalid.</p>
                <button class="btn btn-primary mt-4" id="back-btn">Back to Clients</button>
            </div>
        `;
        container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/clients'));
        return;
    }

    if (!client) return;

    const sessions = client.sessions || [];
    const linkedGoals = client.goals || [];
    const notes = client.notes_list || client.notes || [];

    container.innerHTML = `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-ghost btn-sm" id="back-to-clients">&larr; Back to Clients</button>
                <h1 style="font-size: var(--fs-xl);">${client.name}</h1>
                ${statusBadge(client.status)}
            </div>

            <div class="grid grid-2 gap-6">
                <!-- Profile Card -->
                <div class="card">
                    <div class="card-header">
                        <h3>Profile</h3>
                        <button class="btn btn-sm btn-secondary" id="edit-client-btn">Edit</button>
                    </div>
                    <div class="card-body">
                        <div class="flex items-center gap-4 mb-4">
                            <div class="avatar avatar-xl">${client.avatar_url ? `<img src="${client.avatar_url}" alt="">` : getInitials(client.name || 'U')}</div>
                            <div>
                                <h3 style="font-size: var(--fs-lg); margin-bottom: var(--sp-1);">${client.name}</h3>
                                <p class="text-sm text-secondary">${client.email || ''}</p>
                                ${client.phone ? `<p class="text-sm text-muted">${client.phone}</p>` : ''}
                            </div>
                        </div>
                        <div class="divider"></div>
                        <div class="grid grid-2 gap-4 mt-4">
                            <div>
                                <span class="text-xs text-muted">Company</span>
                                <div class="text-sm font-medium">${client.company || '-'}</div>
                            </div>
                            <div>
                                <span class="text-xs text-muted">Package</span>
                                <div class="text-sm font-medium">${client.package || '-'}</div>
                            </div>
                            <div>
                                <span class="text-xs text-muted">Monthly Rate</span>
                                <div class="text-sm font-medium">${client.monthly_rate ? formatCurrency(client.monthly_rate) : '-'}</div>
                            </div>
                            <div>
                                <span class="text-xs text-muted">Coach</span>
                                <div class="text-sm font-medium">${client.coach_name || '-'}</div>
                            </div>
                            <div>
                                <span class="text-xs text-muted">Joined</span>
                                <div class="text-sm font-medium">${client.created_at ? formatDate(client.created_at) : '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Session History -->
                <div class="card">
                    <div class="card-header">
                        <h3>Session History</h3>
                        <button class="btn btn-sm btn-primary" id="schedule-session-btn">Schedule Session</button>
                    </div>
                    <div class="card-body">
                        ${sessions.length > 0 ? `
                            <div class="flex flex-col gap-3">
                                ${sessions.slice(0, 10).map(s => `
                                    <div class="flex items-center justify-between" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border-light);">
                                        <div>
                                            <div class="text-sm font-medium">${s.title || 'Session'}</div>
                                            <div class="text-xs text-muted">${formatDate(s.date || s.created_at)}</div>
                                        </div>
                                        ${statusBadge(s.status || 'completed')}
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state" style="padding: var(--sp-6);">
                                <p class="text-sm text-muted">No sessions recorded yet.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Linked Goals -->
                <div class="card">
                    <div class="card-header">
                        <h3>Goals</h3>
                    </div>
                    <div class="card-body">
                        ${linkedGoals.length > 0 ? `
                            <div class="flex flex-col gap-3">
                                ${linkedGoals.map(g => `
                                    <div class="flex items-center justify-between" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border-light);">
                                        <div>
                                            <div class="text-sm font-medium">${g.title}</div>
                                            <span class="badge badge-primary">${g.category || 'General'}</span>
                                        </div>
                                        ${statusBadge(g.status)}
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state" style="padding: var(--sp-6);">
                                <p class="text-sm text-muted">No goals linked to this client.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Notes -->
                <div class="card">
                    <div class="card-header">
                        <h3>Notes</h3>
                    </div>
                    <div class="card-body">
                        ${typeof notes === 'string' && notes ? `<p class="text-sm text-secondary">${notes}</p>` : ''}
                        ${Array.isArray(notes) && notes.length > 0 ? notes.map(n => `
                            <div class="mb-3" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border-light);">
                                <p class="text-sm text-secondary">${n.content || n.body || n}</p>
                                ${n.created_at ? `<span class="text-xs text-muted">${timeAgo(n.created_at)}</span>` : ''}
                            </div>
                        `).join('') : ''}
                        ${(!notes || (Array.isArray(notes) && notes.length === 0)) ? '<p class="text-sm text-muted">No notes yet.</p>' : ''}
                        <div class="flex gap-2 mt-4">
                            <textarea id="new-note" rows="2" placeholder="Add a note..." style="flex: 1;"></textarea>
                            <button class="btn btn-sm btn-secondary" id="add-note-btn" style="align-self: flex-end;">Add</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    container.querySelector('#back-to-clients')?.addEventListener('click', () => navigate('/clients'));

    container.querySelector('#schedule-session-btn')?.addEventListener('click', () => {
        showToast('Session scheduling coming soon!', 'info');
    });

    container.querySelector('#edit-client-btn')?.addEventListener('click', () => {
        showToast('Client editing coming soon!', 'info');
    });

    container.querySelector('#add-note-btn')?.addEventListener('click', async () => {
        const noteInput = container.querySelector('#new-note');
        const content = noteInput?.value?.trim();
        if (!content) return;

        try {
            await api.post(`/clients/${clientId}/notes`, { content });
            showToast('Note added!', 'success');
            noteInput.value = '';
            await renderClientDetail(container, clientId);
        } catch (err) {
            showToast(err.message || 'Failed to add note.', 'error');
        }
    });
}

/**
 * Render the clients page.
 * @param {HTMLElement} container
 * @param {Object} params - Route params (may include id for detail view)
 */
export async function render(container, params) {
    // If params include an id, render detail view
    if (params?.id) {
        await renderClientDetail(container, params.id);
        return;
    }

    activeTab = 'all';
    clients = [];

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Clients</h1>
                <div class="page-actions">
                    <button class="btn btn-primary" id="add-client-btn">+ Add Client</button>
                </div>
            </div>

            <div class="tabs" id="client-tabs">
                ${STATUS_TABS.map(t => `
                    <div class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</div>
                `).join('')}
            </div>

            <div id="clients-table">
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Email</th>
                                <th>Company</th>
                                <th>Status</th>
                                <th>Coach</th>
                                <th>Package</th>
                                <th>Sessions</th>
                                <th>Monthly Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array(5).fill(`
                                <tr>
                                    <td><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 70px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
                                    <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Tab switching
    container.querySelector('#client-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        activeTab = tab.dataset.tab;
        container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
        renderClientTable(container);
    });

    // Add client button
    container.querySelector('#add-client-btn')?.addEventListener('click', () => openAddClientModal(container));

    // Load clients
    await loadClients(container);
}
