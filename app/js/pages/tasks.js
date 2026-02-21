/**
 * Mindset365 - Tasks Page
 * Kanban board with board selector, task detail modal, and list view toggle.
 */

import api from '../api.js';
import { getState } from '../store.js';
import { openModal, closeModal } from '../components/modal.js';
import { renderKanban } from '../components/kanban.js';
import { formatDate, timeAgo, getInitials, statusBadge, escapeHtml } from '../utils.js';

/** Current view mode */
let viewMode = 'kanban';

/** Active board data */
let activeBoard = null;

/** All boards for the selector */
let boards = [];

/**
 * Fetch the list of boards.
 * @returns {Promise<Array>}
 */
async function fetchBoards() {
    try {
        const res = await api.get('/boards');
        return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch (err) {
        showToast(err.message || 'Failed to load boards.', 'error');
        return [];
    }
}

/**
 * Fetch a single board with columns and tasks.
 * @param {number|string} boardId
 * @returns {Promise<Object|null>}
 */
async function fetchBoard(boardId) {
    try {
        const res = await api.get(`/boards/${boardId}`);
        return res?.data || res || null;
    } catch (err) {
        showToast(err.message || 'Failed to load board.', 'error');
        return null;
    }
}

/**
 * Open the task detail modal.
 * @param {Object} task
 * @param {HTMLElement} container
 */
function openTaskDetailModal(task, container) {
    openModal({
        title: task.title,
        size: 'lg',
        body: `
            <div class="flex items-center gap-3 mb-4">
                ${task.priority ? `<span class="priority-dot priority-${task.priority}"></span>` : ''}
                ${statusBadge(task.status)}
                ${task.due_date ? `<span class="text-xs text-muted">Due: ${formatDate(task.due_date)}</span>` : ''}
            </div>

            <!-- Editable fields -->
            <div class="form-group">
                <label class="form-label">Title</label>
                <input type="text" id="task-edit-title" value="${task.title || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="task-edit-desc" rows="3">${task.description || ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select id="task-edit-status">
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="review" ${task.status === 'review' ? 'selected' : ''}>Review</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select id="task-edit-priority">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" id="task-edit-due" value="${task.due_date ? task.due_date.split('T')[0] : ''}">
            </div>

            <div class="divider"></div>

            <!-- Subtasks -->
            <div class="mb-4">
                <h4 style="font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--sp-3);">Subtasks</h4>
                <div id="subtasks-list">
                    ${(task.subtasks || []).length > 0 ? task.subtasks.map(st => `
                        <div class="flex items-center gap-2 mb-2">
                            <input type="checkbox" ${st.completed ? 'checked' : ''} style="width: auto; accent-color: var(--color-primary);" data-subtask-id="${st.id}">
                            <span class="text-sm ${st.completed ? 'text-muted' : ''}" style="${st.completed ? 'text-decoration: line-through;' : ''}">${st.title}</span>
                        </div>
                    `).join('') : '<p class="text-xs text-muted">No subtasks yet.</p>'}
                </div>
                <div class="flex gap-2 mt-2">
                    <input type="text" id="new-subtask-input" placeholder="Add a subtask..." style="flex: 1;">
                    <button class="btn btn-sm btn-secondary" id="add-subtask-btn">Add</button>
                </div>
            </div>

            <div class="divider"></div>

            <!-- Comments -->
            <div class="mb-4">
                <h4 style="font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--sp-3);">Comments</h4>
                <div id="comments-list">
                    ${(task.comments || []).length > 0 ? task.comments.map(c => `
                        <div class="flex gap-3 mb-3">
                            <div class="avatar avatar-sm">${getInitials(c.user_name || 'U')}</div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium">${c.user_name || 'User'}</span>
                                    <span class="text-xs text-muted">${timeAgo(c.created_at)}</span>
                                </div>
                                <p class="text-sm text-secondary mt-1">${c.content || c.body || ''}</p>
                            </div>
                        </div>
                    `).join('') : '<p class="text-xs text-muted">No comments yet.</p>'}
                </div>
                <div class="flex gap-2 mt-3">
                    <textarea id="new-comment-input" rows="2" placeholder="Write a comment..." style="flex: 1;"></textarea>
                    <button class="btn btn-sm btn-primary" id="add-comment-btn" style="align-self: flex-end;">Post</button>
                </div>
            </div>

            <div class="divider"></div>

            <!-- Activity Log -->
            <div>
                <h4 style="font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--sp-3);">Activity</h4>
                <div id="activity-log">
                    ${(task.activity || []).length > 0 ? task.activity.slice(0, 5).map(a => `
                        <div class="flex items-center gap-2 mb-2">
                            <div class="status-dot status-active"></div>
                            <span class="text-xs text-muted">${a.description || a.action || 'Activity'} - ${timeAgo(a.created_at)}</span>
                        </div>
                    `).join('') : '<p class="text-xs text-muted">No activity logged.</p>'}
                </div>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-danger btn-sm" id="modal-delete" style="margin-right: auto;">Delete</button>
            <button class="btn btn-primary" id="modal-save">Save Changes</button>
        `,
        onMount: (modal) => {
            // Cancel
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

            // Save task changes
            modal.querySelector('#modal-save')?.addEventListener('click', async () => {
                const saveBtn = modal.querySelector('#modal-save');
                saveBtn.innerHTML = '<span class="spinner-sm"></span> Saving...';
                saveBtn.disabled = true;

                try {
                    await api.put(`/tasks/${task.id}`, {
                        title: modal.querySelector('#task-edit-title')?.value?.trim(),
                        description: modal.querySelector('#task-edit-desc')?.value?.trim(),
                        status: modal.querySelector('#task-edit-status')?.value,
                        priority: modal.querySelector('#task-edit-priority')?.value,
                        due_date: modal.querySelector('#task-edit-due')?.value || null
                    });
                    showToast('Task updated successfully!', 'success');
                    closeModal();
                    await reloadBoard(container);
                } catch (err) {
                    showToast(err.message || 'Failed to update task.', 'error');
                    saveBtn.innerHTML = 'Save Changes';
                    saveBtn.disabled = false;
                }
            });

            // Delete task
            modal.querySelector('#modal-delete')?.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this task?')) return;
                try {
                    await api.delete(`/tasks/${task.id}`);
                    showToast('Task deleted.', 'success');
                    closeModal();
                    await reloadBoard(container);
                } catch (err) {
                    showToast(err.message || 'Failed to delete task.', 'error');
                }
            });

            // Add comment
            modal.querySelector('#add-comment-btn')?.addEventListener('click', async () => {
                const input = modal.querySelector('#new-comment-input');
                const content = input?.value?.trim();
                if (!content) return;

                try {
                    await api.post(`/tasks/${task.id}/comments`, { content });
                    showToast('Comment added.', 'success');
                    input.value = '';
                    // Re-open modal with fresh data would be ideal, but we keep it simple
                } catch (err) {
                    showToast(err.message || 'Failed to add comment.', 'error');
                }
            });

            // Add subtask
            modal.querySelector('#add-subtask-btn')?.addEventListener('click', async () => {
                const input = modal.querySelector('#new-subtask-input');
                const title = input?.value?.trim();
                if (!title) return;

                try {
                    await api.post(`/tasks/${task.id}/subtasks`, { title });
                    showToast('Subtask added.', 'success');
                    input.value = '';
                } catch (err) {
                    showToast(err.message || 'Failed to add subtask.', 'error');
                }
            });
        }
    });
}

/**
 * Open the new board creation modal.
 * @param {HTMLElement} container
 */
function openNewBoardModal(container) {
    openModal({
        title: 'New Board',
        body: `
            <div class="form-group">
                <label class="form-label">Board Name *</label>
                <input type="text" id="board-name" placeholder="e.g., Q1 Sprint">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="board-desc" rows="2" placeholder="Board description..."></textarea>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-create">Create Board</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-create')?.addEventListener('click', async () => {
                const name = modal.querySelector('#board-name')?.value?.trim();
                if (!name) {
                    showToast('Board name is required.', 'warning');
                    return;
                }

                const btn = modal.querySelector('#modal-create');
                btn.innerHTML = '<span class="spinner-sm"></span> Creating...';
                btn.disabled = true;

                try {
                    const res = await api.post('/boards', {
                        name,
                        description: modal.querySelector('#board-desc')?.value?.trim() || ''
                    });
                    showToast('Board created!', 'success');
                    closeModal();
                    boards = await fetchBoards();
                    const newBoard = res?.data || res;
                    if (newBoard?.id) {
                        activeBoard = await fetchBoard(newBoard.id);
                    }
                    renderPage(container);
                } catch (err) {
                    showToast(err.message || 'Failed to create board.', 'error');
                    btn.innerHTML = 'Create Board';
                    btn.disabled = false;
                }
            });
        }
    });
}

/**
 * Open quick-add task inline form.
 * @param {string|number} columnId
 * @param {HTMLElement} container
 */
function openQuickAddTask(columnId, container) {
    openModal({
        title: 'New Task',
        body: `
            <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" id="quick-task-title" placeholder="Task title..." autofocus>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select id="quick-task-priority">
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input type="date" id="quick-task-due">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="quick-task-desc" rows="2" placeholder="Optional description..."></textarea>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-create">Add Task</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-create')?.addEventListener('click', async () => {
                const title = modal.querySelector('#quick-task-title')?.value?.trim();
                if (!title) {
                    showToast('Task title is required.', 'warning');
                    return;
                }

                const btn = modal.querySelector('#modal-create');
                btn.innerHTML = '<span class="spinner-sm"></span> Adding...';
                btn.disabled = true;

                try {
                    await api.post('/tasks', {
                        title,
                        description: modal.querySelector('#quick-task-desc')?.value?.trim() || '',
                        priority: modal.querySelector('#quick-task-priority')?.value,
                        due_date: modal.querySelector('#quick-task-due')?.value || null,
                        board_id: activeBoard?.id,
                        column_id: columnId
                    });
                    showToast('Task created!', 'success');
                    closeModal();
                    await reloadBoard(container);
                } catch (err) {
                    showToast(err.message || 'Failed to create task.', 'error');
                    btn.innerHTML = 'Add Task';
                    btn.disabled = false;
                }
            });
        }
    });
}

/**
 * Reload the active board and re-render.
 * @param {HTMLElement} container
 */
async function reloadBoard(container) {
    if (activeBoard?.id) {
        activeBoard = await fetchBoard(activeBoard.id);
    }
    renderBoardContent(container);
}

/**
 * Render the board content area (kanban or list).
 * @param {HTMLElement} container
 */
function renderBoardContent(container) {
    const contentEl = container.querySelector('#board-content');
    if (!contentEl) return;

    if (!activeBoard) {
        contentEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128203;</div>
                <h3>No board selected</h3>
                <p>Create a new board or select one from the dropdown to get started.</p>
                <button class="btn btn-primary mt-4" id="empty-new-board">Create Board</button>
            </div>
        `;
        contentEl.querySelector('#empty-new-board')?.addEventListener('click', () => openNewBoardModal(container));
        return;
    }

    const columns = activeBoard.columns || [];

    if (viewMode === 'kanban') {
        renderKanban(contentEl, {
            columns,
            onTaskClick: (task) => openTaskDetailModal(task, container),
            onAddTask: (columnId) => openQuickAddTask(columnId, container),
            onTaskMove: async (taskId, newColumnId, newPosition) => {
                try {
                    await api.put(`/tasks/${taskId}`, {
                        column_id: newColumnId,
                        position: newPosition
                    });
                } catch (err) {
                    showToast(err.message || 'Failed to move task.', 'error');
                    await reloadBoard(container);
                }
            }
        });
    } else {
        // List view
        const allTasks = columns.flatMap(col =>
            (col.tasks || []).map(t => ({ ...t, column_name: col.name || col.title }))
        );

        if (allTasks.length === 0) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#9989;</div>
                    <h3>No tasks yet</h3>
                    <p>Add your first task to this board.</p>
                </div>
            `;
            return;
        }

        contentEl.innerHTML = `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Due Date</th>
                            <th>Column</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTasks.map(task => `
                            <tr class="task-row" data-task-id="${task.id}" style="cursor: pointer;">
                                <td>
                                    <div class="font-medium">${task.title}</div>
                                    ${task.description ? `<div class="text-xs text-muted truncate" style="max-width: 300px;">${task.description}</div>` : ''}
                                </td>
                                <td>${statusBadge(task.status)}</td>
                                <td>
                                    <span class="flex items-center gap-2">
                                        <span class="priority-dot priority-${task.priority || 'none'}"></span>
                                        <span class="text-sm">${task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : '-'}</span>
                                    </span>
                                </td>
                                <td class="text-sm">${task.due_date ? formatDate(task.due_date) : '-'}</td>
                                <td><span class="badge badge-neutral">${task.column_name}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        contentEl.querySelectorAll('.task-row').forEach(row => {
            row.addEventListener('click', () => {
                const taskId = row.dataset.taskId;
                const task = allTasks.find(t => String(t.id) === taskId);
                if (task) openTaskDetailModal(task, container);
            });
        });
    }
}

/**
 * Render the full page layout.
 * @param {HTMLElement} container
 */
function renderPage(container) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Tasks</h1>
                <div class="page-actions">
                    <select id="board-selector" class="btn btn-secondary" style="min-width: 160px;">
                        ${boards.length === 0
                            ? '<option value="">No boards</option>'
                            : boards.map(b => `<option value="${b.id}" ${activeBoard && String(b.id) === String(activeBoard.id) ? 'selected' : ''}>${b.name || b.title}</option>`).join('')
                        }
                    </select>
                    <button class="btn btn-secondary" id="new-board-btn">+ Board</button>
                    <button class="btn btn-primary" id="new-task-btn">+ Task</button>
                    <button class="btn btn-ghost btn-icon" id="toggle-view" title="Toggle view">
                        ${viewMode === 'kanban' ? '&#9776;' : '&#9638;'}
                    </button>
                </div>
            </div>

            <div id="board-content">
                <div class="flex gap-4">
                    ${Array(4).fill('<div class="skeleton" style="min-width: 280px; height: 300px; border-radius: var(--radius-md);"></div>').join('')}
                </div>
            </div>
        </div>
    `;

    // Board selector
    container.querySelector('#board-selector')?.addEventListener('change', async (e) => {
        const boardId = e.target.value;
        if (boardId) {
            activeBoard = await fetchBoard(boardId);
            renderBoardContent(container);
        }
    });

    // New board
    container.querySelector('#new-board-btn')?.addEventListener('click', () => openNewBoardModal(container));

    // New task
    container.querySelector('#new-task-btn')?.addEventListener('click', () => {
        const firstColumn = activeBoard?.columns?.[0];
        openQuickAddTask(firstColumn?.id || null, container);
    });

    // Toggle view
    container.querySelector('#toggle-view')?.addEventListener('click', () => {
        viewMode = viewMode === 'kanban' ? 'list' : 'kanban';
        const btn = container.querySelector('#toggle-view');
        if (btn) btn.innerHTML = viewMode === 'kanban' ? '&#9776;' : '&#9638;';
        renderBoardContent(container);
    });

    renderBoardContent(container);
}

/**
 * Render the tasks page.
 * Coach sees Kanban board. Client sees personal task checklist.
 * @param {HTMLElement} container
 */
export async function render(container) {
    const user = getState('user');
    const isCoach = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'coach';

    if (!isCoach) {
        await renderClientTaskView(container);
        return;
    }

    // Coach view: Kanban board (existing behavior)
    viewMode = 'kanban';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <div class="skeleton skeleton-title" style="width: 120px;"></div>
                <div class="skeleton" style="width: 200px; height: 36px;"></div>
            </div>
            <div class="flex gap-4">
                ${Array(4).fill('<div class="skeleton" style="min-width: 280px; height: 300px; border-radius: var(--radius-md);"></div>').join('')}
            </div>
        </div>
    `;

    boards = await fetchBoards();
    if (boards.length > 0 && !activeBoard) {
        activeBoard = await fetchBoard(boards[0].id);
    }
    renderPage(container);
}

// ================================================================
// CLIENT TASK CHECKLIST VIEW
// ================================================================

let clientFilter = 'all';
let clientTasks = [];

async function renderClientTaskView(container) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <div>
                    <h1>My Tasks</h1>
                    <span class="text-muted">Complete your tasks to grow your business</span>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" id="client-add-task-btn">+ Add Task</button>
                </div>
            </div>

            <div id="client-progress-bar" style="margin-bottom:var(--sp-4);"></div>

            <div class="tabs" id="client-filter-tabs">
                <div class="tab-item active" data-filter="all">All</div>
                <div class="tab-item" data-filter="todo">To Do</div>
                <div class="tab-item" data-filter="in_progress">In Progress</div>
                <div class="tab-item" data-filter="done">Done</div>
            </div>

            <div id="client-tasks-list">
                <div class="animate-pulse" style="padding:var(--sp-2);">
                    <div class="skeleton skeleton-card" style="height:60px;margin-bottom:var(--sp-2);"></div>
                    <div class="skeleton skeleton-card" style="height:60px;margin-bottom:var(--sp-2);"></div>
                    <div class="skeleton skeleton-card" style="height:60px;"></div>
                </div>
            </div>
        </div>
    `;

    // Load tasks
    try {
        clientTasks = await api.get('/tasks/my?include_completed=1');
        if (!Array.isArray(clientTasks)) clientTasks = [];
    } catch (err) {
        clientTasks = [];
    }

    renderClientProgress();
    renderClientList();
    bindClientEvents(container);
}

function renderClientProgress() {
    const el = document.getElementById('client-progress-bar');
    if (!el || clientTasks.length === 0) {
        if (el) el.innerHTML = '';
        return;
    }

    const total = clientTasks.length;
    const done = clientTasks.filter(t => t.completed_at || t.is_done_column == 1).length;
    const pct = Math.round((done / total) * 100);

    el.innerHTML = `
        <div class="flex items-center gap-3" style="margin-bottom:var(--sp-1);">
            <span style="font-size:0.8rem;font-weight:600;color:var(--text-primary);">${done} of ${total} completed</span>
            <span style="font-size:0.75rem;color:var(--text-muted);">${pct}%</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;"></div>
        </div>
    `;
}

function renderClientList() {
    const el = document.getElementById('client-tasks-list');
    if (!el) return;

    let filtered = clientTasks;
    if (clientFilter === 'todo') {
        filtered = clientTasks.filter(t => !t.completed_at && t.column_name?.toLowerCase() !== 'in progress');
    } else if (clientFilter === 'in_progress') {
        filtered = clientTasks.filter(t => !t.completed_at && t.column_name?.toLowerCase() === 'in progress');
    } else if (clientFilter === 'done') {
        filtered = clientTasks.filter(t => t.completed_at || t.is_done_column == 1);
    }

    if (filtered.length === 0) {
        el.innerHTML = `
            <div class="empty-state" style="padding:var(--sp-8);text-align:center;">
                <div style="font-size:3rem;margin-bottom:var(--sp-2);">&#9989;</div>
                <h3>${clientFilter === 'done' ? 'No completed tasks yet' : clientFilter === 'all' ? 'No tasks assigned yet' : 'No tasks in this category'}</h3>
                <p class="text-muted">${clientFilter === 'all' ? 'Your coach will assign tasks for you, or add your own.' : ''}</p>
            </div>
        `;
        return;
    }

    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:var(--sp-2);">
        ${filtered.map(task => {
            const isDone = !!task.completed_at || task.is_done_column == 1;
            const priorityColors = { urgent: '#e74c3c', high: '#f39c12', medium: '#3498db', low: '#95a5a6', none: 'transparent' };
            const priorityColor = priorityColors[task.priority] || 'transparent';

            return `
                <div class="client-task-item card" style="border-left:3px solid ${priorityColor};" data-task-id="${task.id}">
                    <div class="card-body" style="padding:var(--sp-3) var(--sp-4);display:flex;align-items:center;gap:var(--sp-3);">
                        <input type="checkbox" class="client-task-check" data-task-id="${task.id}" ${isDone ? 'checked' : ''}
                            style="width:20px;height:20px;accent-color:var(--color-primary);cursor:pointer;flex-shrink:0;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.9rem;font-weight:500;${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHtml(task.title)}</div>
                            ${task.description ? `<div class="text-muted" style="font-size:0.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(task.description).substring(0, 80)}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-2" style="flex-shrink:0;">
                            ${task.due_date ? `<span class="text-muted" style="font-size:0.7rem;">${formatDate(task.due_date)}</span>` : ''}
                            <span class="badge badge-neutral" style="font-size:0.65rem;">${escapeHtml(task.column_name || 'To Do')}</span>
                            <button class="btn-icon btn-ghost client-task-edit" data-task-id="${task.id}" title="Edit" style="font-size:0.75rem;padding:4px;">&#9998;</button>
                            <button class="btn-icon btn-ghost client-task-delete" data-task-id="${task.id}" title="Delete" style="font-size:0.75rem;padding:4px;color:var(--color-danger);">&#10005;</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
    </div>`;

    // Bind task checkbox events
    el.querySelectorAll('.client-task-check').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const taskId = parseInt(checkbox.dataset.taskId);
            const task = clientTasks.find(t => t.id == taskId);
            if (!task) return;

            const isChecking = checkbox.checked;

            try {
                if (isChecking) {
                    // Find the done column for this task's board
                    const boardData = await api.get(`/boards/${task.board_id}`);
                    const doneCol = (boardData.columns || []).find(c => c.is_done_column == 1);
                    if (doneCol) {
                        await api.put(`/tasks/${taskId}/move`, { column_id: doneCol.id, sort_order: 0 });
                        task.completed_at = new Date().toISOString();
                        task.is_done_column = 1;
                        task.column_name = doneCol.name || 'Done';
                    }
                } else {
                    // Move back to first non-done column
                    const boardData = await api.get(`/boards/${task.board_id}`);
                    const todoCol = (boardData.columns || []).find(c => c.is_done_column != 1);
                    if (todoCol) {
                        await api.put(`/tasks/${taskId}/move`, { column_id: todoCol.id, sort_order: 0 });
                        task.completed_at = null;
                        task.is_done_column = 0;
                        task.column_name = todoCol.name || 'To Do';
                    }
                }
                renderClientProgress();
                renderClientList();
            } catch (err) {
                checkbox.checked = !isChecking; // revert
                showToast(err.message || 'Failed to update task', 'error');
            }
        });
    });

    // Edit task
    el.querySelectorAll('.client-task-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = parseInt(btn.dataset.taskId);
            const task = clientTasks.find(t => t.id == taskId);
            if (task) openClientEditTaskModal(task);
        });
    });

    // Delete task
    el.querySelectorAll('.client-task-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskId = parseInt(btn.dataset.taskId);
            if (!confirm('Remove this task?')) return;
            try {
                await api.delete(`/tasks/${taskId}`);
                clientTasks = clientTasks.filter(t => t.id != taskId);
                renderClientProgress();
                renderClientList();
                showToast('Task removed', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to delete', 'error');
            }
        });
    });
}

function bindClientEvents(container) {
    // Filter tabs
    container.querySelectorAll('#client-filter-tabs .tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('#client-filter-tabs .tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            clientFilter = tab.dataset.filter;
            renderClientList();
        });
    });

    // Add task button
    container.querySelector('#client-add-task-btn')?.addEventListener('click', () => {
        openClientAddTaskModal();
    });
}

function openClientAddTaskModal() {
    openModal({
        title: 'Add a Task',
        body: `
            <div class="form-group">
                <label>Task Title</label>
                <input type="text" id="new-task-title" placeholder="What do you need to do?" autofocus>
            </div>
            <div class="form-group">
                <label>Description (optional)</label>
                <textarea id="new-task-desc" rows="2" placeholder="Any details or notes..."></textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="new-task-priority">
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                </select>
            </div>
            <div class="form-group">
                <label>Due Date (optional)</label>
                <input type="date" id="new-task-due">
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Add Task</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const title = overlay.querySelector('#new-task-title').value.trim();
                if (!title) { showToast('Title is required', 'error'); return; }

                const btn = overlay.querySelector('#modal-save-btn');
                btn.innerHTML = '<span class="spinner-sm"></span> Adding...';
                btn.disabled = true;

                try {
                    // Find an existing board for the client, or use first available board
                    let boardId, columnId;
                    if (clientTasks.length > 0) {
                        boardId = clientTasks[0].board_id;
                        // Use first non-done column
                        const boardData = await api.get(`/boards/${boardId}`);
                        const todoCol = (boardData.columns || []).find(c => c.is_done_column != 1);
                        columnId = todoCol?.id;
                    }

                    if (!boardId || !columnId) {
                        // Try to get any board
                        const allBoards = await api.get('/boards');
                        const boardList = Array.isArray(allBoards?.data) ? allBoards.data : (Array.isArray(allBoards) ? allBoards : []);
                        if (boardList.length > 0) {
                            const boardData = await api.get(`/boards/${boardList[0].id}`);
                            boardId = boardList[0].id;
                            const todoCol = (boardData.columns || []).find(c => c.is_done_column != 1);
                            columnId = todoCol?.id;
                        }
                    }

                    if (!boardId || !columnId) {
                        showToast('No task board available. Ask your coach to set one up.', 'warning');
                        btn.innerHTML = 'Add Task';
                        btn.disabled = false;
                        return;
                    }

                    const newTask = await api.post('/tasks', {
                        title,
                        description: overlay.querySelector('#new-task-desc').value.trim(),
                        priority: overlay.querySelector('#new-task-priority').value,
                        due_date: overlay.querySelector('#new-task-due').value || null,
                        board_id: boardId,
                        column_id: columnId,
                    });

                    clientTasks.unshift({ ...newTask, column_name: 'To Do', is_done_column: 0 });
                    closeModal();
                    renderClientProgress();
                    renderClientList();
                    showToast('Task added!', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to add task', 'error');
                    btn.innerHTML = 'Add Task';
                    btn.disabled = false;
                }
            });
        }
    });
}

function openClientEditTaskModal(task) {
    openModal({
        title: 'Edit Task',
        body: `
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="edit-task-title" value="${escapeHtml(task.title)}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="edit-task-desc" rows="2">${escapeHtml(task.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="edit-task-priority">
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" id="edit-task-due" value="${task.due_date ? task.due_date.split('T')[0] : ''}">
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Save</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const title = overlay.querySelector('#edit-task-title').value.trim();
                if (!title) { showToast('Title is required', 'error'); return; }

                try {
                    const updated = await api.put(`/tasks/${task.id}`, {
                        title,
                        description: overlay.querySelector('#edit-task-desc').value.trim(),
                        priority: overlay.querySelector('#edit-task-priority').value,
                        due_date: overlay.querySelector('#edit-task-due').value || null,
                    });
                    // Update local
                    const idx = clientTasks.findIndex(t => t.id == task.id);
                    if (idx >= 0) Object.assign(clientTasks[idx], updated);
                    closeModal();
                    renderClientList();
                    showToast('Task updated', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to update', 'error');
                }
            });
        }
    });
}
