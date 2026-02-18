/**
 * Mindset365 - Task Detail Page
 * Full task view with header, description, subtask checklist, activity/comments,
 * assignee display, and sidebar metadata. Supports inline editing.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, statusBadge, formatCurrency, getInitials, capitalize } from '../utils.js';
import { getState, setState } from '../store.js';

/** Currently loaded task data */
let task = null;

/** Comments list */
let comments = [];

/** Subtasks list */
let subtasks = [];

/** Activity log */
let activity = [];

/** Whether the inline edit form is visible */
let isEditing = false;

/** Whether the description is in edit mode */
let isEditingDescription = false;

/**
 * Map priority to a badge class.
 * @param {string} priority
 * @returns {string} badge class
 */
function priorityBadgeClass(priority) {
    const map = {
        urgent: 'badge-danger',
        high: 'badge-warning',
        medium: 'badge-primary',
        low: 'badge-neutral'
    };
    return map[(priority || '').toLowerCase()] || 'badge-neutral';
}

/**
 * Render a loading skeleton for the task detail page.
 * @returns {string} HTML string
 */
function renderSkeleton() {
    return `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <div class="skeleton" style="width: 100px; height: 32px; border-radius: var(--radius-sm);"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 300px; gap: var(--sp-6);">
                <div>
                    <div class="skeleton skeleton-title" style="width: 60%; margin-bottom: var(--sp-4);"></div>
                    <div class="skeleton skeleton-card" style="height: 120px; margin-bottom: var(--sp-4);"></div>
                    <div class="skeleton skeleton-card" style="height: 200px; margin-bottom: var(--sp-4);"></div>
                    <div class="skeleton skeleton-card" style="height: 160px;"></div>
                </div>
                <div>
                    <div class="skeleton skeleton-card" style="height: 300px;"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the task header section.
 * @returns {string} HTML string
 */
function renderTaskHeader() {
    const title = escapeHtml(task.title || 'Untitled Task');
    const priority = task.priority || 'medium';

    return `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3" style="flex: 1; min-width: 0;">
                <h1 style="font-size: var(--fs-2xl); font-weight: var(--fw-bold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</h1>
            </div>
            <div class="flex items-center gap-2">
                ${statusBadge(task.status)}
                <span class="badge ${priorityBadgeClass(priority)}">${escapeHtml(capitalize(priority))}</span>
                <button class="btn btn-secondary btn-sm" id="edit-task-btn">Edit</button>
            </div>
        </div>
        ${task.due_date ? `
            <div class="flex items-center gap-2 mb-4">
                <span class="text-sm text-muted">Due:</span>
                <span class="text-sm font-medium">${formatDate(task.due_date, 'long')}</span>
                ${isOverdue() ? '<span class="badge badge-danger">Overdue</span>' : ''}
            </div>
        ` : ''}
    `;
}

/**
 * Check if the task is overdue.
 * @returns {boolean}
 */
function isOverdue() {
    if (!task?.due_date) return false;
    if (task.status === 'done' || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
}

/**
 * Render the inline edit form for the task.
 * @returns {string} HTML string
 */
function renderEditForm() {
    return `
        <div class="card mb-6" id="edit-task-form">
            <div class="card-header">
                <h3>Edit Task</h3>
                <button class="btn btn-ghost btn-sm" id="cancel-edit-btn">Cancel</button>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" id="edit-title" value="${escapeHtml(task.title || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="edit-description" rows="4">${escapeHtml(task.description || '')}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="edit-status">
                            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="in_review" ${task.status === 'in_review' ? 'selected' : ''}>In Review</option>
                            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                            <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select id="edit-priority">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input type="date" id="edit-due-date" value="${task.due_date ? task.due_date.split('T')[0] : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Assignee</label>
                        <input type="text" id="edit-assignee" value="${escapeHtml(task.assignee_name || task.assignee || '')}" placeholder="Assignee name...">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Tags (comma separated)</label>
                    <input type="text" id="edit-tags" value="${escapeHtml((task.tags || []).join(', '))}">
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
 * Render the description section (editable on click).
 * @returns {string} HTML string
 */
function renderDescription() {
    const desc = task.description || '';

    if (isEditingDescription) {
        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h3>Description</h3>
                    <button class="btn btn-ghost btn-sm" id="cancel-desc-edit">Cancel</button>
                </div>
                <div class="card-body">
                    <textarea id="desc-textarea" rows="5" style="width: 100%;">${escapeHtml(desc)}</textarea>
                    <div class="flex justify-end gap-2 mt-2">
                        <button class="btn btn-ghost btn-sm" id="cancel-desc-edit-2">Cancel</button>
                        <button class="btn btn-primary btn-sm" id="save-desc-btn">Save</button>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="card mb-4">
            <div class="card-header">
                <h3>Description</h3>
                <button class="btn btn-ghost btn-sm" id="edit-desc-btn">Edit</button>
            </div>
            <div class="card-body">
                ${desc
                    ? `<p class="text-sm text-secondary" style="white-space: pre-wrap; line-height: var(--lh-relaxed);">${escapeHtml(desc)}</p>`
                    : '<p class="text-sm text-muted">No description provided. Click Edit to add one.</p>'
                }
            </div>
        </div>
    `;
}

/**
 * Render the subtask checklist.
 * @returns {string} HTML string
 */
function renderSubtasks() {
    const completedCount = subtasks.filter(st => st.completed || st.is_completed).length;

    return `
        <div class="card mb-4">
            <div class="card-header">
                <h3>Subtasks</h3>
                ${subtasks.length > 0 ? `<span class="text-xs text-muted">${completedCount}/${subtasks.length} done</span>` : ''}
            </div>
            <div class="card-body">
                ${subtasks.length > 0 ? `
                    <!-- Progress indicator -->
                    ${subtasks.length > 0 ? `
                        <div class="progress-bar mb-4" style="height: 6px;">
                            <div class="progress-fill ${completedCount === subtasks.length ? 'green' : ''}" style="width: ${subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0}%;"></div>
                        </div>
                    ` : ''}
                    <div class="flex flex-col gap-2" id="subtasks-list">
                        ${subtasks.map((st, idx) => {
                            const isDone = st.completed || st.is_completed;
                            return `
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" class="subtask-check" data-subtask-id="${st.id}" data-subtask-idx="${idx}" ${isDone ? 'checked' : ''} style="width: auto; accent-color: var(--color-primary);">
                                    <span class="text-sm ${isDone ? 'text-muted' : ''}" style="${isDone ? 'text-decoration: line-through;' : ''}">${escapeHtml(st.title || st.text || '')}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <p class="text-xs text-muted mb-3">No subtasks yet.</p>
                `}
                <div class="flex gap-2 mt-4">
                    <input type="text" id="new-subtask-input" placeholder="Add a subtask..." style="flex: 1;">
                    <button class="btn btn-secondary btn-sm" id="add-subtask-btn">Add</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the comments/activity section.
 * @returns {string} HTML string
 */
function renderComments() {
    return `
        <div class="card mb-4">
            <div class="card-header">
                <h3>Activity &amp; Comments</h3>
            </div>
            <div class="card-body">
                <!-- Activity log -->
                ${activity.length > 0 ? `
                    <div class="mb-4">
                        ${activity.slice(0, 10).map(a => `
                            <div class="flex items-center gap-2 mb-2">
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0;"></div>
                                <span class="text-xs text-muted">${escapeHtml(a.description || a.action || 'Activity')}</span>
                                <span class="text-xs text-muted" style="margin-left: auto;">${a.created_at ? formatDate(a.created_at, 'relative') : ''}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="divider mb-4"></div>
                ` : ''}

                <!-- Comments -->
                ${comments.length > 0 ? `
                    <div class="flex flex-col gap-4 mb-4" id="comments-list">
                        ${comments.map(c => `
                            <div class="flex gap-3">
                                <div class="avatar avatar-sm" style="flex-shrink: 0;">${getInitials(c.user_name || c.author || 'U')}</div>
                                <div style="flex: 1; min-width: 0;">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-sm font-medium">${escapeHtml(c.user_name || c.author || 'User')}</span>
                                        <span class="text-xs text-muted">${c.created_at ? formatDate(c.created_at, 'relative') : ''}</span>
                                    </div>
                                    <p class="text-sm text-secondary" style="white-space: pre-wrap;">${escapeHtml(c.content || c.body || '')}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="text-xs text-muted mb-4">No comments yet. Be the first to comment.</p>
                `}

                <!-- Add comment form -->
                <div class="flex gap-2 mt-2">
                    <textarea id="new-comment-input" rows="2" placeholder="Write a comment..." style="flex: 1;"></textarea>
                    <button class="btn btn-primary btn-sm" id="add-comment-btn" style="align-self: flex-end;">Post</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the sidebar with task metadata.
 * @returns {string} HTML string
 */
function renderSidebar() {
    const assigneeName = task.assignee_name || task.assignee || '';
    const tags = task.tags || [];
    const boardName = task.board_name || task.board || '';
    const columnName = task.column_name || task.column || '';

    return `
        <div class="flex flex-col gap-4">
            <!-- Assignee -->
            <div class="card">
                <div class="card-header"><h3>Assignee</h3></div>
                <div class="card-body">
                    ${assigneeName ? `
                        <div class="flex items-center gap-3">
                            <div class="avatar">${task.assignee_avatar ? `<img src="${escapeHtml(task.assignee_avatar)}" alt="">` : getInitials(assigneeName)}</div>
                            <div>
                                <div class="text-sm font-medium">${escapeHtml(assigneeName)}</div>
                                ${task.assignee_email ? `<div class="text-xs text-muted">${escapeHtml(task.assignee_email)}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <p class="text-sm text-muted">Unassigned</p>
                    `}
                </div>
            </div>

            <!-- Metadata -->
            <div class="card">
                <div class="card-header"><h3>Details</h3></div>
                <div class="card-body">
                    <div class="flex flex-col gap-3">
                        <div>
                            <span class="text-xs text-muted">Status</span>
                            <div class="mt-1">${statusBadge(task.status)}</div>
                        </div>
                        <div>
                            <span class="text-xs text-muted">Priority</span>
                            <div class="mt-1"><span class="badge ${priorityBadgeClass(task.priority)}">${escapeHtml(capitalize(task.priority || 'Medium'))}</span></div>
                        </div>
                        <div>
                            <span class="text-xs text-muted">Due Date</span>
                            <div class="text-sm font-medium mt-1">${task.due_date ? formatDate(task.due_date) : 'Not set'}</div>
                        </div>
                        ${boardName ? `
                            <div>
                                <span class="text-xs text-muted">Board</span>
                                <div class="text-sm font-medium mt-1">${escapeHtml(boardName)}</div>
                            </div>
                        ` : ''}
                        ${columnName ? `
                            <div>
                                <span class="text-xs text-muted">Column</span>
                                <div class="mt-1"><span class="badge badge-neutral">${escapeHtml(columnName)}</span></div>
                            </div>
                        ` : ''}
                        <div>
                            <span class="text-xs text-muted">Created</span>
                            <div class="text-sm mt-1">${task.created_at ? formatDate(task.created_at) : '-'}</div>
                        </div>
                        ${task.updated_at ? `
                            <div>
                                <span class="text-xs text-muted">Last Updated</span>
                                <div class="text-sm mt-1">${formatDate(task.updated_at, 'relative')}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Tags -->
            <div class="card">
                <div class="card-header"><h3>Tags</h3></div>
                <div class="card-body">
                    <div class="flex gap-2 flex-wrap">
                        ${tags.length > 0
                            ? tags.map(t => `<span class="badge badge-neutral">${escapeHtml(t)}</span>`).join('')
                            : '<span class="text-sm text-muted">No tags</span>'
                        }
                    </div>
                </div>
            </div>

            <!-- Quick Status Change -->
            <div class="card">
                <div class="card-header"><h3>Quick Actions</h3></div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Change Status</label>
                        <select id="quick-status-select">
                            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="in_review" ${task.status === 'in_review' ? 'selected' : ''}>In Review</option>
                            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                            <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the full page layout.
 * @param {HTMLElement} container
 */
function renderPage(container) {
    container.innerHTML = `
        <div class="page-enter">
            <!-- Back Button -->
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-ghost btn-sm" id="back-btn">&larr; Back to Tasks</button>
            </div>

            ${isEditing ? renderEditForm() : ''}

            <!-- Main layout: content + sidebar -->
            <div style="display: grid; grid-template-columns: 1fr 300px; gap: var(--sp-6);" class="task-detail-layout">
                <!-- Main content area -->
                <div>
                    ${!isEditing ? renderTaskHeader() : ''}
                    <div id="description-area">${renderDescription()}</div>
                    <div id="subtasks-area">${renderSubtasks()}</div>
                    <div id="comments-area">${renderComments()}</div>
                </div>

                <!-- Sidebar -->
                <div id="sidebar-area">
                    ${renderSidebar()}
                </div>
            </div>
        </div>

        <style>
            @media (max-width: 768px) {
                .task-detail-layout {
                    grid-template-columns: 1fr !important;
                }
            }
        </style>
    `;

    attachEventListeners(container);
}

/**
 * Attach all event listeners for the page.
 * @param {HTMLElement} container
 */
function attachEventListeners(container) {
    // Back button
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/tasks'));

    // Edit task button
    container.querySelector('#edit-task-btn')?.addEventListener('click', () => {
        isEditing = true;
        renderPage(container);
    });

    // Cancel edit
    const cancelEdit = () => {
        isEditing = false;
        renderPage(container);
    };
    container.querySelector('#cancel-edit-btn')?.addEventListener('click', cancelEdit);
    container.querySelector('#cancel-edit-btn-2')?.addEventListener('click', cancelEdit);

    // Save edit
    container.querySelector('#save-edit-btn')?.addEventListener('click', async () => {
        const title = container.querySelector('#edit-title')?.value?.trim();
        if (!title) {
            window.showToast('Task title is required.', 'warning');
            return;
        }

        const btn = container.querySelector('#save-edit-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            const tagsRaw = container.querySelector('#edit-tags')?.value || '';
            const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

            await api.put(`/tasks/${task.id}`, {
                title,
                description: container.querySelector('#edit-description')?.value?.trim() || '',
                status: container.querySelector('#edit-status')?.value,
                priority: container.querySelector('#edit-priority')?.value,
                due_date: container.querySelector('#edit-due-date')?.value || null,
                assignee_name: container.querySelector('#edit-assignee')?.value?.trim() || '',
                tags
            });

            window.showToast('Task updated successfully!', 'success');
            isEditing = false;
            await loadTaskData(task.id);
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to update task.', 'error');
            btn.innerHTML = 'Save Changes';
            btn.disabled = false;
        }
    });

    // Description edit toggle
    container.querySelector('#edit-desc-btn')?.addEventListener('click', () => {
        isEditingDescription = true;
        const descArea = container.querySelector('#description-area');
        if (descArea) {
            descArea.innerHTML = renderDescription();
            attachDescriptionListeners(container);
        }
    });
    attachDescriptionListeners(container);

    // Subtask listeners
    attachSubtaskListeners(container);

    // Comment listeners
    attachCommentListeners(container);

    // Quick status change
    container.querySelector('#quick-status-select')?.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        try {
            await api.put(`/tasks/${task.id}`, { status: newStatus });
            task.status = newStatus;
            window.showToast(`Status changed to ${capitalize(newStatus.replace(/_/g, ' '))}!`, 'success');
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to update status.', 'error');
            e.target.value = task.status;
        }
    });
}

/**
 * Attach description edit listeners.
 * @param {HTMLElement} container
 */
function attachDescriptionListeners(container) {
    const cancelDescEdit = () => {
        isEditingDescription = false;
        const descArea = container.querySelector('#description-area');
        if (descArea) {
            descArea.innerHTML = renderDescription();
            attachDescriptionListeners(container);
        }
    };

    container.querySelector('#cancel-desc-edit')?.addEventListener('click', cancelDescEdit);
    container.querySelector('#cancel-desc-edit-2')?.addEventListener('click', cancelDescEdit);

    container.querySelector('#save-desc-btn')?.addEventListener('click', async () => {
        const newDesc = container.querySelector('#desc-textarea')?.value?.trim() || '';
        const btn = container.querySelector('#save-desc-btn');
        btn.innerHTML = '<span class="spinner-sm"></span>';
        btn.disabled = true;

        try {
            await api.put(`/tasks/${task.id}`, { description: newDesc });
            task.description = newDesc;
            window.showToast('Description updated!', 'success');
            isEditingDescription = false;
            const descArea = container.querySelector('#description-area');
            if (descArea) {
                descArea.innerHTML = renderDescription();
                attachDescriptionListeners(container);
            }
        } catch (err) {
            window.showToast(err.message || 'Failed to update description.', 'error');
            btn.innerHTML = 'Save';
            btn.disabled = false;
        }
    });
}

/**
 * Attach subtask-related event listeners.
 * @param {HTMLElement} container
 */
function attachSubtaskListeners(container) {
    // Add subtask
    container.querySelector('#add-subtask-btn')?.addEventListener('click', async () => {
        const input = container.querySelector('#new-subtask-input');
        const title = input?.value?.trim();
        if (!title) return;

        const btn = container.querySelector('#add-subtask-btn');
        btn.innerHTML = '<span class="spinner-sm"></span>';
        btn.disabled = true;

        try {
            await api.post(`/tasks/${task.id}/subtasks`, { title });
            window.showToast('Subtask added!', 'success');
            input.value = '';
            await loadSubtasks(task.id);
            const subtasksArea = container.querySelector('#subtasks-area');
            if (subtasksArea) {
                subtasksArea.innerHTML = renderSubtasks();
                attachSubtaskListeners(container);
            }
        } catch (err) {
            window.showToast(err.message || 'Failed to add subtask.', 'error');
            btn.innerHTML = 'Add';
            btn.disabled = false;
        }
    });

    // Enter key to add subtask
    container.querySelector('#new-subtask-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            container.querySelector('#add-subtask-btn')?.click();
        }
    });

    // Subtask checkboxes
    container.querySelectorAll('.subtask-check').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const subtaskId = e.target.dataset.subtaskId;
            const idx = parseInt(e.target.dataset.subtaskIdx, 10);
            const isChecked = e.target.checked;

            try {
                await api.put(`/tasks/${task.id}/subtasks/${subtaskId}`, {
                    completed: isChecked
                });

                // Update local state
                if (subtasks[idx]) {
                    subtasks[idx].completed = isChecked;
                    subtasks[idx].is_completed = isChecked;
                }

                // Re-render subtasks
                const subtasksArea = container.querySelector('#subtasks-area');
                if (subtasksArea) {
                    subtasksArea.innerHTML = renderSubtasks();
                    attachSubtaskListeners(container);
                }
            } catch (err) {
                window.showToast(err.message || 'Failed to update subtask.', 'error');
                e.target.checked = !isChecked;
            }
        });
    });
}

/**
 * Attach comment-related event listeners.
 * @param {HTMLElement} container
 */
function attachCommentListeners(container) {
    container.querySelector('#add-comment-btn')?.addEventListener('click', async () => {
        const input = container.querySelector('#new-comment-input');
        const content = input?.value?.trim();
        if (!content) {
            window.showToast('Please enter a comment.', 'warning');
            return;
        }

        const btn = container.querySelector('#add-comment-btn');
        btn.innerHTML = '<span class="spinner-sm"></span>';
        btn.disabled = true;

        try {
            await api.post(`/tasks/${task.id}/comments`, { content });
            window.showToast('Comment added!', 'success');
            input.value = '';
            await loadComments(task.id);
            const commentsArea = container.querySelector('#comments-area');
            if (commentsArea) {
                commentsArea.innerHTML = renderComments();
                attachCommentListeners(container);
            }
        } catch (err) {
            window.showToast(err.message || 'Failed to add comment.', 'error');
            btn.innerHTML = 'Post';
            btn.disabled = false;
        }
    });

    // Ctrl+Enter to post comment
    container.querySelector('#new-comment-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            container.querySelector('#add-comment-btn')?.click();
        }
    });
}

/**
 * Load task data from API.
 * @param {string|number} id
 * @returns {Promise<boolean>} true if loaded successfully
 */
async function loadTaskData(id) {
    try {
        const res = await api.get(`/tasks/${id}`);
        task = res?.data || res;
        subtasks = task?.subtasks || [];
        comments = task?.comments || [];
        activity = task?.activity || [];
        return true;
    } catch {
        return false;
    }
}

/**
 * Load subtasks separately.
 * @param {string|number} id
 */
async function loadSubtasks(id) {
    try {
        const res = await api.get(`/tasks/${id}/subtasks`);
        subtasks = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch {
        // Keep existing subtasks
    }
}

/**
 * Load comments separately.
 * @param {string|number} id
 */
async function loadComments(id) {
    try {
        const res = await api.get(`/tasks/${id}/comments`);
        comments = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch {
        // Keep existing comments
    }
}

/**
 * Render the task detail page.
 * @param {HTMLElement} container
 * @param {Object} params - Route params with params.id
 */
export async function render(container, params) {
    // Guard: missing ID
    if (!params?.id) {
        navigate('/tasks', { replace: true });
        return;
    }

    // Reset state
    task = null;
    subtasks = [];
    comments = [];
    activity = [];
    isEditing = false;
    isEditingDescription = false;

    // Show loading skeleton
    container.innerHTML = renderSkeleton();

    // Load task data
    const loaded = await loadTaskData(params.id);

    if (!loaded || !task) {
        container.innerHTML = `
            <div class="page-enter">
                <div class="empty-state">
                    <div class="empty-state-icon">&#128533;</div>
                    <h3>Task not found</h3>
                    <p>The task may have been removed or the link is invalid.</p>
                    <button class="btn btn-primary mt-4" id="back-btn">Back to Tasks</button>
                </div>
            </div>
        `;
        container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/tasks'));
        window.showToast('Failed to load task.', 'error');
        return;
    }

    // Render full page
    renderPage(container);
}
