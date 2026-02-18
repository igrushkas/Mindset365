// kanban.js - Kanban board component with drag-and-drop

const ICON_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const ICON_MORE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

/**
 * Renders a kanban board inside a container.
 *
 * @param {HTMLElement} container - DOM element to render the board into
 * @param {Object} config
 * @param {Array} config.columns - Array of column objects:
 *   { id: string, title: string, color?: string, tasks: Array<Task> }
 *   Where Task = { id, title, priority?, assignee?, dueDate?, tags?: string[] }
 * @param {Function} [config.onTaskMove] - Callback: (taskId, newColumnId, newOrder) => void
 * @param {Function} [config.onTaskClick] - Callback: (task) => void
 * @param {Function} [config.onAddTask] - Callback: (columnId) => void
 * @returns {Object} Controller with { refresh(columns) }
 */
export function renderKanban(container, { columns = [], onTaskMove, onTaskClick, onAddTask }) {
    if (!container) {
        console.error('renderKanban: invalid container element');
        return null;
    }

    // State
    let currentColumns = JSON.parse(JSON.stringify(columns));
    let dragState = null;

    // Initial render
    render();

    /**
     * Full re-render of the board HTML and event binding.
     */
    function render() {
        container.innerHTML = buildBoardHTML(currentColumns);
        bindEvents();
    }

    /**
     * Builds the full kanban board HTML.
     * @param {Array} cols - Columns data array
     * @returns {string} HTML string
     */
    function buildBoardHTML(cols) {
        const columnsHTML = cols.map(col => {
            const taskCount = (col.tasks || []).length;
            const colorDot = col.color
                ? `<span style="width:8px;height:8px;border-radius:50%;background:${col.color};flex-shrink:0"></span>`
                : '';

            const tasksHTML = (col.tasks || []).map(task => buildCardHTML(task)).join('');

            return `
                <div class="kanban-column" data-column-id="${col.id}">
                    <div class="kanban-column-header">
                        <div class="kanban-column-title">
                            ${colorDot}
                            <span>${escapeHTML(col.title || col.name)}</span>
                            <span class="kanban-column-count">${taskCount}</span>
                        </div>
                        <button class="btn-icon btn-ghost" data-action="column-more" data-column-id="${col.id}" aria-label="Column options">
                            ${ICON_MORE}
                        </button>
                    </div>
                    <div class="kanban-column-body" data-column-id="${col.id}">
                        ${tasksHTML}
                    </div>
                    <div class="kanban-add-task" data-action="add-task" data-column-id="${col.id}">
                        ${ICON_PLUS} Add task
                    </div>
                </div>`;
        }).join('');

        return `<div class="kanban-board">${columnsHTML}</div>`;
    }

    /**
     * Builds a single kanban card HTML.
     * @param {Object} task
     * @returns {string} Card HTML
     */
    function buildCardHTML(task) {
        const priorityClass = task.priority ? `priority-${task.priority}` : 'priority-none';

        // Support tags as both array and JSON string
        let tags = task.tags || [];
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch { tags = []; }
        }
        const tagsHTML = tags.map(tag =>
            `<span class="tag">${escapeHTML(tag)}</span>`
        ).join('');

        // Support both task.assignee object and flat assigned_to_name/assigned_to_avatar fields
        const assigneeName = task.assignee?.name || task.assigned_to_name || '';
        const assigneeAvatar = task.assignee?.avatar || task.assigned_to_avatar || '';
        const assigneeHTML = assigneeName
            ? `<div class="avatar avatar-sm" title="${escapeHTML(assigneeName)}">${
                assigneeAvatar
                    ? `<img src="${assigneeAvatar}" alt="${escapeHTML(assigneeName)}">`
                    : assigneeName.charAt(0).toUpperCase()
              }</div>`
            : '';

        // Support both camelCase and snake_case
        const dueDate = task.dueDate || task.due_date || '';
        const dueDateHTML = dueDate
            ? `<span class="flex items-center gap-1 text-xs text-muted">${ICON_CALENDAR} ${escapeHTML(dueDate)}</span>`
            : '';

        return `
            <div class="kanban-card" draggable="true" data-task-id="${task.id}" data-action="task-click">
                <div class="flex items-center gap-2 mb-2">
                    <span class="priority-dot ${priorityClass}"></span>
                    <span class="kanban-card-title flex-1">${escapeHTML(task.title)}</span>
                </div>
                ${tagsHTML ? `<div class="kanban-card-tags mb-2">${tagsHTML}</div>` : ''}
                <div class="kanban-card-meta">
                    ${dueDateHTML}
                    ${assigneeHTML}
                </div>
            </div>`;
    }

    /**
     * Binds all event handlers: drag-and-drop, clicks, add-task.
     */
    function bindEvents() {
        const board = container.querySelector('.kanban-board');
        if (!board) return;

        // Drag-and-drop using event delegation on the board
        board.addEventListener('dragstart', handleDragStart);
        board.addEventListener('dragover', handleDragOver);
        board.addEventListener('dragleave', handleDragLeave);
        board.addEventListener('drop', handleDrop);
        board.addEventListener('dragend', handleDragEnd);

        // Clicks (delegated)
        board.addEventListener('click', (e) => {
            // Add task button
            const addBtn = e.target.closest('[data-action="add-task"]');
            if (addBtn) {
                const columnId = addBtn.dataset.columnId;
                if (typeof onAddTask === 'function') {
                    onAddTask(columnId);
                }
                return;
            }

            // Task card click
            const card = e.target.closest('[data-action="task-click"]');
            if (card) {
                const taskId = card.dataset.taskId;
                const task = findTask(taskId);
                if (task && typeof onTaskClick === 'function') {
                    onTaskClick(task);
                }
            }
        });
    }

    // ===== DRAG AND DROP HANDLERS =====

    function handleDragStart(e) {
        const card = e.target.closest('.kanban-card');
        if (!card) return;

        dragState = {
            taskId: card.dataset.taskId,
            sourceColumnId: card.closest('.kanban-column-body')?.dataset.columnId
        };

        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);

        // Slight delay to allow drag image to show
        requestAnimationFrame(() => {
            card.style.opacity = '0.4';
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const columnBody = e.target.closest('.kanban-column-body');
        if (!columnBody) return;

        // Add visual feedback
        columnBody.classList.add('drag-over');

        // Determine insertion point for ordering
        const afterEl = getDragAfterElement(columnBody, e.clientY);
        const dragCard = container.querySelector('.kanban-card.dragging');
        if (!dragCard) return;

        if (afterEl == null) {
            columnBody.appendChild(dragCard);
        } else {
            columnBody.insertBefore(dragCard, afterEl);
        }
    }

    function handleDragLeave(e) {
        const columnBody = e.target.closest('.kanban-column-body');
        if (columnBody && !columnBody.contains(e.relatedTarget)) {
            columnBody.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const columnBody = e.target.closest('.kanban-column-body');
        if (!columnBody || !dragState) return;

        columnBody.classList.remove('drag-over');

        const newColumnId = columnBody.dataset.columnId;
        const dragCard = container.querySelector('.kanban-card.dragging');

        if (dragCard) {
            dragCard.classList.remove('dragging');
            dragCard.style.opacity = '1';
        }

        // Calculate new order based on DOM position
        const cards = [...columnBody.querySelectorAll('.kanban-card')];
        const newOrder = cards.findIndex(c => c.dataset.taskId === dragState.taskId);

        // Update internal state
        moveTaskInState(dragState.taskId, dragState.sourceColumnId, newColumnId, newOrder);

        // Update column counts in DOM
        updateColumnCounts();

        // Invoke callback
        if (typeof onTaskMove === 'function') {
            onTaskMove(dragState.taskId, newColumnId, newOrder);
        }

        dragState = null;
    }

    function handleDragEnd(e) {
        const card = e.target.closest('.kanban-card');
        if (card) {
            card.classList.remove('dragging');
            card.style.opacity = '1';
        }

        // Remove all drag-over states
        container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        dragState = null;
    }

    /**
     * Returns the card element after which the dragged item should be inserted,
     * based on the current Y position of the pointer.
     */
    function getDragAfterElement(columnBody, y) {
        const cards = [...columnBody.querySelectorAll('.kanban-card:not(.dragging)')];

        return cards.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element || null;
    }

    // ===== STATE MANAGEMENT =====

    function moveTaskInState(taskId, sourceColId, targetColId, newOrder) {
        let task = null;

        // Remove from source column
        for (const col of currentColumns) {
            const idx = (col.tasks || []).findIndex(t => String(t.id) === String(taskId));
            if (idx !== -1) {
                task = col.tasks.splice(idx, 1)[0];
                break;
            }
        }

        if (!task) return;

        // Insert into target column at new order
        const targetCol = currentColumns.find(c => String(c.id) === String(targetColId));
        if (targetCol) {
            if (!targetCol.tasks) targetCol.tasks = [];
            const insertIdx = Math.min(newOrder, targetCol.tasks.length);
            targetCol.tasks.splice(insertIdx, 0, task);
        }
    }

    function findTask(taskId) {
        for (const col of currentColumns) {
            const task = (col.tasks || []).find(t => String(t.id) === String(taskId));
            if (task) return task;
        }
        return null;
    }

    function updateColumnCounts() {
        container.querySelectorAll('.kanban-column').forEach(colEl => {
            const colId = colEl.dataset.columnId;
            const body = colEl.querySelector('.kanban-column-body');
            const countEl = colEl.querySelector('.kanban-column-count');
            if (body && countEl) {
                countEl.textContent = body.querySelectorAll('.kanban-card').length;
            }
        });
    }

    // ===== CONTROLLER =====
    return {
        /**
         * Refresh the board with new columns data.
         * @param {Array} newColumns
         */
        refresh(newColumns) {
            currentColumns = JSON.parse(JSON.stringify(newColumns));
            render();
        },

        /**
         * Get current columns state (reflects drag-and-drop moves).
         * @returns {Array}
         */
        getState() {
            return JSON.parse(JSON.stringify(currentColumns));
        }
    };
}

// ===== HELPERS =====

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
