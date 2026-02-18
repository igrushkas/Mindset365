/**
 * Mindset365 - Workspace Page
 * Workspace info card with inline editing, members table with role badges,
 * invite member modal, remove member confirmation, and role-based admin controls.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, getInitials, capitalize, statusBadge } from '../utils.js';
import { getState, setState } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';

/** Cached workspace data */
let workspace = null;

/** Cached members list */
let members = [];

/** Whether the current user has admin/owner privileges */
let isAdmin = false;

/** Whether the workspace name/description are being edited inline */
let isEditingInfo = false;

// ── Role helpers ───────────────────────────────────────────────────────

const ROLES = ['admin', 'coach', 'client'];

function roleBadgeClass(role) {
    switch ((role || '').toLowerCase()) {
        case 'owner': return 'badge-warning';
        case 'admin': return 'badge-warning';
        case 'coach': return 'badge-success';
        case 'client': return 'badge-neutral';
        default: return 'badge-neutral';
    }
}

// ── Rendering ──────────────────────────────────────────────────────────

/**
 * Render the workspace info card, optionally in edit mode.
 */
function renderInfoCard(container) {
    const infoEl = container.querySelector('#workspace-info');
    if (!infoEl) return;

    if (isEditingInfo) {
        infoEl.innerHTML = `
            <div class="card mb-6">
                <div class="card-header">
                    <h3>Workspace Details</h3>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm" id="cancel-edit-info">Cancel</button>
                        <button class="btn btn-primary btn-sm" id="save-edit-info">Save</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Workspace Name</label>
                        <input type="text" id="edit-ws-name" value="${escapeHtml(workspace?.name || '')}" placeholder="Workspace name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="edit-ws-desc" rows="3" placeholder="Describe your workspace...">${escapeHtml(workspace?.description || '')}</textarea>
                    </div>
                </div>
            </div>`;

        infoEl.querySelector('#cancel-edit-info')?.addEventListener('click', () => {
            isEditingInfo = false;
            renderInfoCard(container);
        });

        infoEl.querySelector('#save-edit-info')?.addEventListener('click', async () => {
            const name = infoEl.querySelector('#edit-ws-name')?.value?.trim();
            if (!name) {
                window.showToast('Workspace name is required.', 'warning');
                return;
            }
            const description = infoEl.querySelector('#edit-ws-desc')?.value?.trim() || '';

            const btn = infoEl.querySelector('#save-edit-info');
            btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
            btn.disabled = true;

            try {
                const wsId = workspace?.id || getState('workspace')?.id;
                const res = await api.put(`/workspaces/${wsId}`, { name, description });
                const updated = res?.data || res;
                if (updated) {
                    workspace = { ...workspace, ...updated };
                    // Update the global store
                    const currentWs = getState('workspace');
                    if (currentWs) {
                        setState('workspace', { ...currentWs, name, description });
                    }
                }
                window.showToast('Workspace updated.', 'success');
                isEditingInfo = false;
                renderInfoCard(container);
            } catch (err) {
                window.showToast(err.message || 'Failed to update workspace.', 'error');
                btn.textContent = 'Save';
                btn.disabled = false;
            }
        });
        return;
    }

    // Read-only view
    infoEl.innerHTML = `
        <div class="card mb-6">
            <div class="card-header">
                <h3>Workspace Details</h3>
                ${isAdmin ? '<button class="btn btn-secondary btn-sm" id="edit-info-btn">Edit</button>' : ''}
            </div>
            <div class="card-body">
                <h3 style="margin-bottom:var(--sp-2);">${escapeHtml(workspace?.name || 'My Workspace')}</h3>
                <p class="text-sm text-muted">${escapeHtml(workspace?.description || 'No description provided.')}</p>
                <div class="grid grid-3 gap-4 mt-4">
                    <div>
                        <span class="text-xs text-muted">Created</span>
                        <div class="text-sm">${workspace?.created_at ? escapeHtml(formatDate(workspace.created_at)) : 'N/A'}</div>
                    </div>
                    <div>
                        <span class="text-xs text-muted">Members</span>
                        <div class="text-sm">${members.length}</div>
                    </div>
                    <div>
                        <span class="text-xs text-muted">Your Role</span>
                        <div class="text-sm"><span class="badge ${roleBadgeClass(workspace?.current_user_role || 'member')}">${escapeHtml(capitalize(workspace?.current_user_role || 'member'))}</span></div>
                    </div>
                </div>
            </div>
        </div>`;

    infoEl.querySelector('#edit-info-btn')?.addEventListener('click', () => {
        isEditingInfo = true;
        renderInfoCard(container);
    });
}

/**
 * Render the members table.
 */
function renderMembersTable(container) {
    const membersEl = container.querySelector('#members-list');
    if (!membersEl) return;

    if (members.length === 0) {
        membersEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128101;</div>
                <h3>Just you for now</h3>
                <p>Invite coaches or team members to collaborate.</p>
                ${isAdmin ? '<button class="btn btn-primary mt-4" id="empty-invite-btn">Invite Member</button>' : ''}
            </div>`;
        membersEl.querySelector('#empty-invite-btn')?.addEventListener('click', () => openInviteModal(container));
        return;
    }

    membersEl.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Member</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        ${isAdmin ? '<th style="width:120px;">Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${members.map(m => `
                        <tr data-uid="${escapeHtml(String(m.id || m.uid || ''))}">
                            <td>
                                <div class="flex items-center gap-3">
                                    <div class="avatar avatar-sm">${m.avatar_url ? `<img src="${escapeHtml(m.avatar_url)}" alt="">` : escapeHtml(getInitials(m.name || 'U'))}</div>
                                    <span class="font-medium">${escapeHtml(m.name || 'Unknown')}</span>
                                </div>
                            </td>
                            <td class="text-sm text-muted">${escapeHtml(m.email || '')}</td>
                            <td><span class="badge ${roleBadgeClass(m.role)}">${escapeHtml(capitalize(m.role || 'member'))}</span></td>
                            <td class="text-sm text-muted">${m.joined_at ? escapeHtml(formatDate(m.joined_at)) : (m.created_at ? escapeHtml(formatDate(m.created_at)) : 'N/A')}</td>
                            ${isAdmin ? `
                                <td>
                                    <div class="flex gap-2">
                                        ${(m.role || '').toLowerCase() !== 'owner' ? `
                                            <button class="btn btn-icon btn-danger btn-sm remove-member-btn" data-uid="${escapeHtml(String(m.id || m.uid || ''))}" data-name="${escapeHtml(m.name || 'this member')}" title="Remove member">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                            </button>
                                        ` : '<span class="text-xs text-muted">Owner</span>'}
                                    </div>
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;

    // Remove member buttons
    membersEl.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const uid = btn.dataset.uid;
            const name = btn.dataset.name;
            removeMember(container, uid, name);
        });
    });
}

// ── Invite Modal ───────────────────────────────────────────────────────

function openInviteModal(container) {
    const overlay = openModal({
        title: 'Invite Member',
        content: `
            <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input type="email" id="invite-email" placeholder="colleague@example.com">
            </div>
            <div class="form-group">
                <label class="form-label">Role *</label>
                <select id="invite-role">
                    <option value="coach">Coach</option>
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <p class="text-sm text-muted mt-2">An invitation will be sent to this email address. They will be able to join the workspace after accepting.</p>
        `,
        footer: `
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-invite">Send Invitation</button>
        `
    });

    if (!overlay) return;

    overlay.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

    overlay.querySelector('#modal-invite')?.addEventListener('click', async () => {
        const email = overlay.querySelector('#invite-email')?.value?.trim();
        const role = overlay.querySelector('#invite-role')?.value;

        if (!email) {
            window.showToast('Email address is required.', 'warning');
            return;
        }

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            window.showToast('Please enter a valid email address.', 'warning');
            return;
        }

        const btn = overlay.querySelector('#modal-invite');
        btn.innerHTML = '<span class="spinner-sm"></span> Sending...';
        btn.disabled = true;

        try {
            const wsId = workspace?.id || getState('workspace')?.id;
            await api.post(`/workspaces/${wsId}/invite`, { email, role });
            window.showToast(`Invitation sent to ${escapeHtml(email)}.`, 'success');
            closeModal();
            await loadWorkspace(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to send invitation.', 'error');
            btn.textContent = 'Send Invitation';
            btn.disabled = false;
        }
    });
}

// ── Remove Member ──────────────────────────────────────────────────────

function removeMember(container, uid, name) {
    if (!uid) return;
    const wsId = workspace?.id || getState('workspace')?.id;

    confirmModal({
        title: 'Remove Member',
        message: `Are you sure you want to remove <strong>${escapeHtml(name)}</strong> from this workspace? They will lose access to all workspace resources.`,
        confirmText: 'Remove',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
            try {
                await api.delete(`/workspaces/${wsId}/members/${uid}`);
                members = members.filter(m => String(m.id || m.uid) !== String(uid));
                window.showToast('Member removed.', 'success');
                renderMembersTable(container);
            } catch (err) {
                window.showToast(err.message || 'Failed to remove member.', 'error');
            }
        }
    });
}

// ── Data loading ───────────────────────────────────────────────────────

async function loadWorkspace(container) {
    const wsState = getState('workspace');
    const wsId = wsState?.id;

    if (!wsId) {
        // Try to fetch the list and use the first workspace
        try {
            const res = await api.get('/workspaces');
            const workspaces = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            if (workspaces.length > 0) {
                workspace = workspaces[0];
                setState('workspace', workspace);
            } else {
                workspace = { name: 'My Workspace', description: '' };
            }
        } catch (err) {
            window.showToast(err.message || 'Failed to load workspaces.', 'error');
            workspace = wsState || { name: 'My Workspace', description: '' };
        }
    } else {
        try {
            const res = await api.get(`/workspaces/${wsId}`);
            workspace = res?.data || res || wsState;
        } catch (err) {
            window.showToast(err.message || 'Failed to load workspace.', 'error');
            workspace = wsState || { name: 'My Workspace', description: '' };
        }
    }

    // Extract members
    members = workspace?.members || [];
    if (!Array.isArray(members)) members = [];

    // Determine admin status
    const userRole = (workspace?.current_user_role || '').toLowerCase();
    const user = getState('user');
    isAdmin = userRole === 'owner' || userRole === 'admin' ||
              (workspace?.owner_id && user?.id && String(workspace.owner_id) === String(user.id));

    // Render sub-sections
    renderInfoCard(container);
    renderMembersTable(container);

    // Show/hide invite button based on role
    const inviteBtn = container.querySelector('#invite-btn');
    if (inviteBtn) {
        inviteBtn.style.display = isAdmin ? '' : 'none';
    }
}

// ── Main render ────────────────────────────────────────────────────────

export async function render(container) {
    workspace = null;
    members = [];
    isAdmin = false;
    isEditingInfo = false;

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Workspace</h1>
                <button class="btn btn-primary" id="invite-btn">Invite Member</button>
            </div>

            <div id="workspace-info">
                <div class="card mb-6">
                    <div class="card-body">
                        <div class="skeleton skeleton-text" style="width:30%;margin-bottom:var(--sp-3);"></div>
                        <div class="skeleton skeleton-text" style="width:60%;margin-bottom:var(--sp-2);"></div>
                        <div class="skeleton skeleton-text" style="width:40%;"></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Team Members</h3>
                </div>
                <div class="card-body" id="members-list">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array(3).fill(`
                                    <tr>
                                        <td><div class="skeleton skeleton-text" style="width:120px;"></div></td>
                                        <td><div class="skeleton skeleton-text" style="width:150px;"></div></td>
                                        <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
                                        <td><div class="skeleton skeleton-text" style="width:80px;"></div></td>
                                        <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;

    // Invite button
    container.querySelector('#invite-btn')?.addEventListener('click', () => openInviteModal(container));

    // Load workspace data
    await loadWorkspace(container);
}
