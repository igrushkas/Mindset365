/**
 * Mindset365 - Task Templates Management Page
 * Coach-only page for managing reusable task template groups.
 * Templates are organized by growth phase: Foundation, Growth, Scale.
 */
import api from '../api.js';
import { escapeHtml } from '../utils.js';
import { openModal, closeModal } from '../components/modal.js';

const PHASE_LABELS = {
    foundation: { label: 'Foundation', desc: '0-10 clients', color: '#6C5CE7' },
    growth: { label: 'Growth', desc: '10-50 clients', color: '#00B894' },
    scale: { label: 'Scale', desc: '50-100+ clients', color: '#FDCB6E' },
};

const PRIORITY_BADGES = {
    urgent: '<span class="badge badge-danger">Urgent</span>',
    high: '<span class="badge badge-warning">High</span>',
    medium: '<span class="badge badge-info">Medium</span>',
    low: '<span class="badge badge-secondary">Low</span>',
    none: '',
};

let templates = [];
let expandedTemplateId = null;

export async function render(container) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <div>
                    <h1>Task Templates</h1>
                    <span class="text-muted">Reusable task sets to assign to clients</span>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" id="create-template-btn">+ New Template</button>
                </div>
            </div>

            <div class="tabs" id="phase-tabs">
                <div class="tab-item active" data-phase="all">All</div>
                <div class="tab-item" data-phase="foundation">Foundation</div>
                <div class="tab-item" data-phase="growth">Growth</div>
                <div class="tab-item" data-phase="scale">Scale</div>
            </div>

            <div id="templates-content">
                <div class="animate-pulse" style="padding: var(--sp-4);">
                    <div class="skeleton skeleton-card" style="height:100px;margin-bottom:var(--sp-3);"></div>
                    <div class="skeleton skeleton-card" style="height:100px;margin-bottom:var(--sp-3);"></div>
                    <div class="skeleton skeleton-card" style="height:100px;"></div>
                </div>
            </div>
        </div>
    `;

    // Load templates
    try {
        templates = await api.get('/task-templates');
        if (!Array.isArray(templates)) templates = [];
    } catch (err) {
        templates = [];
    }

    renderTemplateList('all');
    bindEvents(container);
}

function renderTemplateList(phaseFilter) {
    const el = document.getElementById('templates-content');
    if (!el) return;

    const filtered = phaseFilter === 'all'
        ? templates
        : templates.filter(t => t.phase === phaseFilter);

    if (filtered.length === 0) {
        el.innerHTML = `
            <div class="empty-state" style="padding:var(--sp-8);text-align:center;">
                <div style="font-size:3rem;margin-bottom:var(--sp-2);">&#128203;</div>
                <h3>No Templates</h3>
                <p class="text-muted">Create your first task template to get started.</p>
            </div>
        `;
        return;
    }

    // Group by phase
    const grouped = {};
    filtered.forEach(t => {
        if (!grouped[t.phase]) grouped[t.phase] = [];
        grouped[t.phase].push(t);
    });

    let html = '';
    for (const [phase, items] of Object.entries(grouped)) {
        const p = PHASE_LABELS[phase] || { label: phase, desc: '', color: '#888' };
        html += `
            <div class="template-phase-group" style="margin-bottom:var(--sp-6);">
                <div class="flex items-center gap-2" style="margin-bottom:var(--sp-3);">
                    <span class="badge" style="background:${p.color};color:#fff;font-size:0.75rem;padding:4px 10px;border-radius:var(--radius-sm);">${escapeHtml(p.label)}</span>
                    <span class="text-muted" style="font-size:0.8rem;">${escapeHtml(p.desc)}</span>
                </div>
                ${items.map(t => renderTemplateCard(t)).join('')}
            </div>
        `;
    }

    el.innerHTML = html;
    bindCardEvents();
}

function renderTemplateCard(t) {
    const isExpanded = expandedTemplateId === t.id;
    const taskCount = t.task_count || 0;

    return `
        <div class="template-card card" style="margin-bottom:var(--sp-2);cursor:pointer;" data-template-id="${t.id}">
            <div class="card-body" style="padding:var(--sp-4);">
                <div class="flex items-center" style="justify-content:space-between;">
                    <div style="flex:1;">
                        <div class="flex items-center gap-2">
                            <h3 style="font-size:1rem;font-weight:600;margin:0;">${escapeHtml(t.name)}</h3>
                            <span class="text-muted" style="font-size:0.75rem;">${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
                        </div>
                        ${t.description ? `<p class="text-muted" style="font-size:0.8rem;margin-top:var(--sp-1);margin-bottom:0;">${escapeHtml(t.description)}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="btn btn-sm btn-secondary edit-template-btn" data-id="${t.id}" title="Edit template">Edit</button>
                        <button class="btn btn-sm btn-ghost delete-template-btn" data-id="${t.id}" title="Delete template" style="color:var(--color-danger);">Delete</button>
                        <span style="transition:transform 0.2s;transform:rotate(${isExpanded ? '90' : '0'}deg);color:var(--text-muted);">&#9654;</span>
                    </div>
                </div>
            </div>
            ${isExpanded ? `<div class="template-tasks-list" style="border-top:1px solid var(--border-color);padding:var(--sp-4);" id="template-tasks-${t.id}">Loading...</div>` : ''}
        </div>
    `;
}

function bindEvents(container) {
    // Create template button
    container.querySelector('#create-template-btn')?.addEventListener('click', () => {
        openCreateTemplateModal();
    });

    // Phase tabs
    container.querySelectorAll('#phase-tabs .tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('#phase-tabs .tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTemplateList(tab.dataset.phase);
        });
    });
}

function bindCardEvents() {
    // Expand/collapse
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            if (e.target.closest('.edit-template-btn') || e.target.closest('.delete-template-btn') || e.target.closest('.add-task-btn')) return;

            const id = parseInt(card.dataset.templateId);
            if (expandedTemplateId === id) {
                expandedTemplateId = null;
            } else {
                expandedTemplateId = id;
            }

            // Re-render
            const activePhase = document.querySelector('#phase-tabs .tab-item.active')?.dataset.phase || 'all';
            renderTemplateList(activePhase);

            // Load tasks if expanding
            if (expandedTemplateId === id) {
                await loadTemplateTasks(id);
            }
        });
    });

    // Edit buttons
    document.querySelectorAll('.edit-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const t = templates.find(t => t.id == id);
            if (t) openEditTemplateModal(t);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            if (confirm('Delete this template? This cannot be undone.')) {
                try {
                    await api.delete(`/task-templates/${id}`);
                    templates = templates.filter(t => t.id != id);
                    const activePhase = document.querySelector('#phase-tabs .tab-item.active')?.dataset.phase || 'all';
                    renderTemplateList(activePhase);
                    showToast('Template deleted', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to delete', 'error');
                }
            }
        });
    });
}

async function loadTemplateTasks(templateId) {
    const el = document.getElementById(`template-tasks-${templateId}`);
    if (!el) return;

    try {
        const data = await api.get(`/task-templates/${templateId}`);
        const tasks = data.tasks || [];

        if (tasks.length === 0) {
            el.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No tasks in this template yet.</p>
                <button class="btn btn-sm btn-primary add-task-btn" data-template-id="${templateId}" style="margin-top:var(--sp-2);">+ Add Task</button>`;
        } else {
            el.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
                    ${tasks.map((task, idx) => `
                        <div class="flex items-center gap-3" style="padding:var(--sp-2) var(--sp-3);background:var(--bg-primary);border-radius:var(--radius-md);border:1px solid var(--border-color);">
                            <span class="text-muted" style="font-size:0.75rem;font-weight:600;min-width:20px;">${idx + 1}.</span>
                            <div style="flex:1;">
                                <div style="font-size:0.875rem;font-weight:500;">${escapeHtml(task.title)}</div>
                                ${task.description ? `<div class="text-muted" style="font-size:0.75rem;margin-top:2px;">${escapeHtml(task.description).substring(0, 100)}</div>` : ''}
                            </div>
                            ${PRIORITY_BADGES[task.priority] || ''}
                            <button class="btn-icon btn-ghost edit-task-inline" data-template-id="${templateId}" data-task-id="${task.id}" title="Edit" style="font-size:0.75rem;padding:4px;">&#9998;</button>
                            <button class="btn-icon btn-ghost remove-task-inline" data-template-id="${templateId}" data-task-id="${task.id}" title="Remove" style="font-size:0.75rem;padding:4px;color:var(--color-danger);">&#10005;</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-sm btn-primary add-task-btn" data-template-id="${templateId}" style="margin-top:var(--sp-3);">+ Add Task</button>
            `;
        }

        // Bind task action events
        el.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAddTaskModal(parseInt(btn.dataset.templateId));
            });
        });

        el.querySelectorAll('.edit-task-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditTaskModal(parseInt(btn.dataset.templateId), parseInt(btn.dataset.taskId));
            });
        });

        el.querySelectorAll('.remove-task-inline').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tid = parseInt(btn.dataset.templateId);
                const taskId = parseInt(btn.dataset.taskId);
                if (confirm('Remove this task from the template?')) {
                    try {
                        await api.delete(`/task-templates/${tid}/tasks/${taskId}`);
                        await loadTemplateTasks(tid);
                        // Update task count in local list
                        const tmpl = templates.find(t => t.id == tid);
                        if (tmpl) tmpl.task_count = Math.max(0, (tmpl.task_count || 1) - 1);
                        showToast('Task removed', 'success');
                    } catch (err) {
                        showToast(err.message || 'Failed to remove', 'error');
                    }
                }
            });
        });

    } catch (err) {
        el.innerHTML = `<p style="color:var(--color-danger);font-size:0.85rem;">Failed to load tasks</p>`;
    }
}

function openCreateTemplateModal() {
    openModal({
        title: 'Create Template',
        body: `
            <div class="form-group">
                <label>Template Name</label>
                <input type="text" id="tmpl-name" placeholder="e.g., Build Your Sales System" autofocus>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="tmpl-desc" rows="2" placeholder="What does this template help clients accomplish?"></textarea>
            </div>
            <div class="form-group">
                <label>Growth Phase</label>
                <select id="tmpl-phase">
                    <option value="foundation">Foundation (0-10 clients)</option>
                    <option value="growth">Growth (10-50 clients)</option>
                    <option value="scale">Scale (50-100+ clients)</option>
                </select>
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Create</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const name = overlay.querySelector('#tmpl-name').value.trim();
                if (!name) { showToast('Name is required', 'error'); return; }

                try {
                    const newTmpl = await api.post('/task-templates', {
                        name,
                        description: overlay.querySelector('#tmpl-desc').value.trim(),
                        phase: overlay.querySelector('#tmpl-phase').value,
                    });
                    newTmpl.task_count = 0;
                    templates.push(newTmpl);
                    closeModal();
                    const activePhase = document.querySelector('#phase-tabs .tab-item.active')?.dataset.phase || 'all';
                    renderTemplateList(activePhase);
                    showToast('Template created', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to create', 'error');
                }
            });
        }
    });
}

function openEditTemplateModal(t) {
    openModal({
        title: 'Edit Template',
        body: `
            <div class="form-group">
                <label>Template Name</label>
                <input type="text" id="tmpl-name" value="${escapeHtml(t.name)}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="tmpl-desc" rows="2">${escapeHtml(t.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Growth Phase</label>
                <select id="tmpl-phase">
                    <option value="foundation" ${t.phase === 'foundation' ? 'selected' : ''}>Foundation (0-10 clients)</option>
                    <option value="growth" ${t.phase === 'growth' ? 'selected' : ''}>Growth (10-50 clients)</option>
                    <option value="scale" ${t.phase === 'scale' ? 'selected' : ''}>Scale (50-100+ clients)</option>
                </select>
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Save</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const name = overlay.querySelector('#tmpl-name').value.trim();
                if (!name) { showToast('Name is required', 'error'); return; }

                try {
                    const updated = await api.put(`/task-templates/${t.id}`, {
                        name,
                        description: overlay.querySelector('#tmpl-desc').value.trim(),
                        phase: overlay.querySelector('#tmpl-phase').value,
                    });
                    // Update local list
                    const idx = templates.findIndex(x => x.id == t.id);
                    if (idx >= 0) Object.assign(templates[idx], updated);
                    closeModal();
                    const activePhase = document.querySelector('#phase-tabs .tab-item.active')?.dataset.phase || 'all';
                    renderTemplateList(activePhase);
                    showToast('Template updated', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to update', 'error');
                }
            });
        }
    });
}

function openAddTaskModal(templateId) {
    openModal({
        title: 'Add Task to Template',
        body: `
            <div class="form-group">
                <label>Task Title</label>
                <input type="text" id="task-title" placeholder="e.g., Write your positioning statement" autofocus>
            </div>
            <div class="form-group">
                <label>Description / Instructions</label>
                <textarea id="task-desc" rows="2" placeholder="What should the client do? Be specific."></textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="task-priority">
                    <option value="high">High</option>
                    <option value="medium" selected>Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Add Task</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const title = overlay.querySelector('#task-title').value.trim();
                if (!title) { showToast('Title is required', 'error'); return; }

                try {
                    await api.post(`/task-templates/${templateId}/tasks`, {
                        title,
                        description: overlay.querySelector('#task-desc').value.trim(),
                        priority: overlay.querySelector('#task-priority').value,
                    });
                    closeModal();
                    // Update count
                    const tmpl = templates.find(t => t.id == templateId);
                    if (tmpl) tmpl.task_count = (tmpl.task_count || 0) + 1;
                    await loadTemplateTasks(templateId);
                    showToast('Task added', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to add task', 'error');
                }
            });
        }
    });
}

async function openEditTaskModal(templateId, taskId) {
    let task;
    try {
        const data = await api.get(`/task-templates/${templateId}`);
        task = (data.tasks || []).find(t => t.id == taskId);
    } catch (err) {
        showToast('Failed to load task', 'error');
        return;
    }
    if (!task) { showToast('Task not found', 'error'); return; }

    openModal({
        title: 'Edit Template Task',
        body: `
            <div class="form-group">
                <label>Task Title</label>
                <input type="text" id="task-title" value="${escapeHtml(task.title)}">
            </div>
            <div class="form-group">
                <label>Description / Instructions</label>
                <textarea id="task-desc" rows="2">${escapeHtml(task.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="task-priority">
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
            </div>
        `,
        footer: `<button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                 <button class="btn btn-primary" id="modal-save-btn">Save</button>`,
        onMount: (overlay) => {
            overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
            overlay.querySelector('#modal-save-btn').addEventListener('click', async () => {
                const title = overlay.querySelector('#task-title').value.trim();
                if (!title) { showToast('Title is required', 'error'); return; }

                try {
                    await api.put(`/task-templates/${templateId}/tasks/${taskId}`, {
                        title,
                        description: overlay.querySelector('#task-desc').value.trim(),
                        priority: overlay.querySelector('#task-priority').value,
                    });
                    closeModal();
                    await loadTemplateTasks(templateId);
                    showToast('Task updated', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to update task', 'error');
                }
            });
        }
    });
}
