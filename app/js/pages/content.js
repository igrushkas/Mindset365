/**
 * Mindset365 - Content Library Page
 * Grid of content cards with filter bar (search, type, tags), CRUD via modal forms,
 * file upload support via FormData, and delete confirmation.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, capitalize, truncate, debounce } from '../utils.js';
import { getState } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';

/** Cached content items */
let contentItems = [];

/** Filter state */
let searchQuery = '';
let filterType = '';
let filterTag = '';

// ── Constants ──────────────────────────────────────────────────────────

const CONTENT_TYPES = [
    { value: 'document',   label: 'Document' },
    { value: 'video',      label: 'Video' },
    { value: 'template',   label: 'Template' },
    { value: 'worksheet',  label: 'Worksheet' },
    { value: 'guide',      label: 'Guide' },
    { value: 'checklist',  label: 'Checklist' }
];

function typeBadgeClass(type) {
    switch ((type || '').toLowerCase()) {
        case 'document':  return 'badge-neutral';
        case 'video':     return 'badge-primary';
        case 'template':  return 'badge-success';
        case 'worksheet': return 'badge-warning';
        case 'guide':     return 'badge-info';
        case 'checklist': return 'badge-danger';
        default:          return 'badge-neutral';
    }
}

/** Collect unique tags from all content items. */
function allTags() {
    const tagSet = new Set();
    contentItems.forEach(item => {
        const tags = parseTags(item.tags);
        tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
}

/** Parse tags from various formats (string, array, comma-separated). */
function parseTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.map(t => t.trim()).filter(Boolean);
    return String(tags).split(',').map(t => t.trim()).filter(Boolean);
}

// ── Filtering ──────────────────────────────────────────────────────────

function filteredContent() {
    let items = contentItems;

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(item =>
            (item.title || '').toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q) ||
            parseTags(item.tags).some(t => t.toLowerCase().includes(q))
        );
    }

    if (filterType) {
        items = items.filter(item => (item.content_type || item.type || '') === filterType);
    }

    if (filterTag) {
        const ft = filterTag.toLowerCase();
        items = items.filter(item =>
            parseTags(item.tags).some(t => t.toLowerCase() === ft)
        );
    }

    return items;
}

// ── Rendering ──────────────────────────────────────────────────────────

function renderFilterBar(container) {
    const filterEl = container.querySelector('#content-filters');
    if (!filterEl) return;

    const tags = allTags();

    filterEl.innerHTML = `
        <div class="flex items-center gap-4 mb-6" style="flex-wrap:wrap;">
            <div class="search-box" style="flex:1;min-width:200px;max-width:400px;">
                <input type="text" id="content-search" placeholder="Search content..." value="${escapeHtml(searchQuery)}">
            </div>
            <div class="form-group" style="margin-bottom:0;min-width:160px;">
                <select id="content-type-filter">
                    <option value="">All Types</option>
                    ${CONTENT_TYPES.map(t => `<option value="${t.value}" ${filterType === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                </select>
            </div>
            ${tags.length > 0 ? `
                <div class="form-group" style="margin-bottom:0;min-width:160px;">
                    <select id="content-tag-filter">
                        <option value="">All Tags</option>
                        ${tags.map(t => `<option value="${escapeHtml(t)}" ${filterTag === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                    </select>
                </div>
            ` : ''}
        </div>`;

    // Search input
    const searchInput = filterEl.querySelector('#content-search');
    const debouncedSearch = debounce((value) => {
        searchQuery = value;
        renderContentGrid(container);
    }, 300);
    searchInput?.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));

    // Type filter
    filterEl.querySelector('#content-type-filter')?.addEventListener('change', (e) => {
        filterType = e.target.value;
        renderContentGrid(container);
    });

    // Tag filter
    filterEl.querySelector('#content-tag-filter')?.addEventListener('change', (e) => {
        filterTag = e.target.value;
        renderContentGrid(container);
    });
}

function renderContentGrid(container) {
    const gridEl = container.querySelector('#content-grid');
    if (!gridEl) return;

    const items = filteredContent();

    if (items.length === 0) {
        const hasFilters = searchQuery || filterType || filterTag;
        gridEl.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-state-icon">&#128218;</div>
                <h3>${hasFilters ? 'No matching content' : 'No content yet'}</h3>
                <p>${hasFilters ? 'Try adjusting your filters or search term.' : 'Add resources, templates, and documents for your clients.'}</p>
                ${!hasFilters ? '<button class="btn btn-primary mt-4" id="empty-add-content">+ Add Content</button>' : ''}
            </div>`;
        gridEl.querySelector('#empty-add-content')?.addEventListener('click', () => openContentModal(container));
        return;
    }

    gridEl.innerHTML = items.map(item => {
        const tags = parseTags(item.tags);
        const contentType = item.content_type || item.type || 'document';

        return `
            <div class="card hover-lift content-card" data-id="${escapeHtml(String(item.id))}" style="cursor:pointer;">
                <div class="card-body">
                    <div class="flex items-center justify-between mb-2">
                        <span class="badge ${typeBadgeClass(contentType)}">${escapeHtml(capitalize(contentType))}</span>
                        <button class="btn btn-icon btn-danger btn-sm delete-content-btn" data-id="${escapeHtml(String(item.id))}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                    </div>
                    <h4 style="margin-bottom:var(--sp-1);">${escapeHtml(item.title || 'Untitled')}</h4>
                    <p class="text-sm text-muted mt-2" style="min-height:2.5em;">${escapeHtml(truncate(item.description || '', 120))}</p>
                    ${tags.length > 0 ? `
                        <div class="flex items-center gap-2 mt-3" style="flex-wrap:wrap;">
                            ${tags.slice(0, 4).map(t => `<span class="badge badge-neutral" style="font-size:var(--fs-xs);">${escapeHtml(t)}</span>`).join('')}
                            ${tags.length > 4 ? `<span class="text-xs text-muted">+${tags.length - 4} more</span>` : ''}
                        </div>
                    ` : ''}
                    ${item.created_at ? `<div class="text-xs text-muted mt-3">${escapeHtml(formatDate(item.created_at))}</div>` : ''}
                </div>
            </div>`;
    }).join('');

    gridEl.classList.add('stagger');

    // Card click -> edit (not on delete button)
    gridEl.querySelectorAll('.content-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-content-btn')) return;
            const id = card.dataset.id;
            const item = contentItems.find(c => String(c.id) === id);
            if (item) openContentModal(container, item);
        });
    });

    // Delete buttons
    gridEl.querySelectorAll('.delete-content-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const item = contentItems.find(c => String(c.id) === id);
            deleteContent(container, item);
        });
    });
}

// ── Delete ─────────────────────────────────────────────────────────────

function deleteContent(container, item) {
    if (!item) return;
    confirmModal({
        title: 'Delete Content',
        message: `Are you sure you want to delete <strong>${escapeHtml(item.title || 'this item')}</strong>? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
            try {
                await api.delete(`/content/${item.id}`);
                contentItems = contentItems.filter(c => c.id !== item.id);
                window.showToast('Content deleted.', 'success');
                renderFilterBar(container);
                renderContentGrid(container);
            } catch (err) {
                window.showToast(err.message || 'Failed to delete content.', 'error');
            }
        }
    });
}

// ── Modal (Create / Edit) ──────────────────────────────────────────────

function openContentModal(container, existing = null) {
    const isEdit = !!existing;
    const contentType = existing?.content_type || existing?.type || 'document';
    const tags = parseTags(existing?.tags).join(', ');

    const overlay = openModal({
        title: isEdit ? 'Edit Content' : 'Add Content',
        size: 'lg',
        content: `
            <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" id="content-title" placeholder="Content title" value="${escapeHtml(existing?.title || '')}">
            </div>

            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="content-description" rows="3" placeholder="Brief description of this content...">${escapeHtml(existing?.description || '')}</textarea>
            </div>

            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
                <div class="form-group">
                    <label class="form-label">Content Type *</label>
                    <select id="content-type">
                        ${CONTENT_TYPES.map(t => `<option value="${t.value}" ${contentType === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Tags</label>
                    <input type="text" id="content-tags" placeholder="tag1, tag2, tag3" value="${escapeHtml(tags)}">
                    <span class="text-xs text-muted">Separate with commas</span>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Content Body</label>
                <textarea id="content-body" rows="8" placeholder="Write your content here. Markdown is supported..." style="font-family:var(--font-mono,monospace);font-size:var(--fs-sm);">${escapeHtml(existing?.body || existing?.content_body || '')}</textarea>
            </div>

            <div class="form-group">
                <label class="form-label">File Attachment (optional)</label>
                <input type="file" id="content-file" style="padding:var(--sp-2);">
                ${isEdit && existing?.file_name ? `<p class="text-xs text-muted mt-1">Current file: ${escapeHtml(existing.file_name)}</p>` : ''}
                <p class="text-xs text-muted mt-1">Upload a PDF, image, or document to attach to this content.</p>
            </div>
        `,
        footer: `
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-save">${isEdit ? 'Save Changes' : 'Add Content'}</button>
        `
    });

    if (!overlay) return;

    // Cancel
    overlay.querySelector('#modal-cancel')?.addEventListener('click', closeModal);

    // Save
    overlay.querySelector('#modal-save')?.addEventListener('click', async () => {
        const title = overlay.querySelector('#content-title')?.value?.trim();
        if (!title) {
            window.showToast('Content title is required.', 'warning');
            return;
        }

        const description = overlay.querySelector('#content-description')?.value?.trim() || '';
        const type = overlay.querySelector('#content-type')?.value || 'document';
        const tagsVal = overlay.querySelector('#content-tags')?.value?.trim() || '';
        const body = overlay.querySelector('#content-body')?.value || '';
        const fileInput = overlay.querySelector('#content-file');
        const file = fileInput?.files?.[0] || null;

        const btn = overlay.querySelector('#modal-save');
        const originalText = btn.textContent;
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            if (file) {
                // Use FormData for file upload
                const formData = new FormData();
                formData.append('title', title);
                formData.append('description', description);
                formData.append('content_type', type);
                formData.append('tags', tagsVal);
                formData.append('body', body);
                formData.append('file', file);

                if (isEdit) {
                    await api.put(`/content/${existing.id}`, formData);
                    window.showToast('Content updated.', 'success');
                } else {
                    await api.post('/content', formData);
                    window.showToast('Content created.', 'success');
                }
            } else {
                // JSON payload (no file)
                const payload = {
                    title,
                    description,
                    content_type: type,
                    tags: tagsVal,
                    body
                };

                if (isEdit) {
                    await api.put(`/content/${existing.id}`, payload);
                    window.showToast('Content updated.', 'success');
                } else {
                    await api.post('/content', payload);
                    window.showToast('Content created.', 'success');
                }
            }

            closeModal();
            await loadContent(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to save content.', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

// ── Data loading ───────────────────────────────────────────────────────

async function loadContent(container) {
    try {
        const res = await api.get('/content');
        contentItems = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        renderFilterBar(container);
        renderContentGrid(container);
    } catch (err) {
        window.showToast(err.message || 'Failed to load content.', 'error');
        const gridEl = container.querySelector('#content-grid');
        if (gridEl) {
            gridEl.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state-icon">&#9888;</div>
                    <h3>Failed to load content</h3>
                    <p>${escapeHtml(err.message || 'Please try again later.')}</p>
                    <button class="btn btn-primary mt-4" id="retry-btn">Retry</button>
                </div>`;
            gridEl.querySelector('#retry-btn')?.addEventListener('click', () => loadContent(container));
        }
    }
}

// ── Main render ────────────────────────────────────────────────────────

export async function render(container) {
    contentItems = [];
    searchQuery = '';
    filterType = '';
    filterTag = '';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Content Library</h1>
                <button class="btn btn-primary" id="add-content-btn">+ Add Content</button>
            </div>

            <div id="content-filters"></div>

            <div class="grid grid-3" id="content-grid">
                ${Array(6).fill(`
                    <div class="card">
                        <div class="card-body">
                            <div class="skeleton skeleton-text" style="width:60px;margin-bottom:var(--sp-3);"></div>
                            <div class="skeleton skeleton-text" style="width:80%;margin-bottom:var(--sp-2);"></div>
                            <div class="skeleton skeleton-text" style="width:100%;margin-bottom:var(--sp-1);"></div>
                            <div class="skeleton skeleton-text" style="width:50%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    // Add content button
    container.querySelector('#add-content-btn')?.addEventListener('click', () => openContentModal(container));

    // Load data
    await loadContent(container);
}
