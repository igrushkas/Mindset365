/**
 * Mindset365 - Courses Page
 * Course catalog with enrollment, module viewer, and course creation for coaches/owners.
 */

import api from '../api.js';
import { getState } from '../store.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../components/modal.js';

/** Cached courses list */
let courses = [];

/**
 * Difficulty badge color mapping.
 * @param {string} difficulty
 * @returns {string} badge class
 */
function difficultyBadge(difficulty) {
    const map = {
        beginner: 'badge-success',
        intermediate: 'badge-warning',
        advanced: 'badge-danger'
    };
    return map[(difficulty || '').toLowerCase()] || 'badge-neutral';
}

/**
 * Render a single course card.
 * @param {Object} course
 * @returns {string} HTML string
 */
function renderCourseCard(course) {
    const moduleCount = course.module_count ?? (course.modules ? course.modules.length : 0);
    const progress = course.enrollment_progress ?? course.progress ?? null;
    const isEnrolled = progress !== null && progress !== undefined;

    return `
        <div class="card card-clickable hover-lift course-card" data-course-id="${course.id}">
            <div style="aspect-ratio: 16/9; background: linear-gradient(135deg, var(--bg-input), var(--bg-card-hover)); border-radius: var(--radius-sm); margin-bottom: var(--sp-4); overflow: hidden; display: flex; align-items: center; justify-content: center;">
                ${course.thumbnail_url
                    ? `<img src="${course.thumbnail_url}" alt="${course.title}" style="width: 100%; height: 100%; object-fit: cover;">`
                    : `<span style="font-size: 2.5rem; opacity: 0.3;">&#128218;</span>`
                }
            </div>
            <div class="flex items-center gap-2 mb-2">
                <span class="badge ${difficultyBadge(course.difficulty)}">${course.difficulty || 'All Levels'}</span>
                <span class="text-xs text-muted">${moduleCount} module${moduleCount !== 1 ? 's' : ''}</span>
            </div>
            <h3 style="font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--sp-1);">${course.title}</h3>
            ${course.description ? `<p class="text-sm text-muted line-clamp-2 mb-4">${course.description}</p>` : ''}
            ${isEnrolled ? `
                <div class="mt-4">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-muted">Progress</span>
                        <span class="font-medium">${Math.round(progress)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progress >= 100 ? 'green' : ''}" style="width: ${progress}%;"></div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Check if current user is a coach or owner.
 * @returns {boolean}
 */
function isCoachOrOwner() {
    const user = getState('user');
    const role = user?.role || '';
    return ['coach', 'owner', 'admin'].includes(role.toLowerCase());
}

/**
 * Open the create course modal.
 * @param {HTMLElement} container
 */
function openCreateCourseModal(container) {
    openModal({
        title: 'Create Course',
        size: 'lg',
        body: `
            <div class="form-group">
                <label class="form-label">Course Title *</label>
                <input type="text" id="course-title" placeholder="e.g., Mastering Sales Funnels">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="course-desc" rows="3" placeholder="What will students learn?"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="course-category">
                        <option value="marketing">Marketing</option>
                        <option value="sales">Sales</option>
                        <option value="operations">Operations</option>
                        <option value="finance">Finance</option>
                        <option value="mindset">Mindset</option>
                        <option value="product">Product</option>
                        <option value="leadership">Leadership</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Difficulty</label>
                    <select id="course-difficulty">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Thumbnail URL</label>
                <input type="url" id="course-thumbnail" placeholder="https://example.com/image.jpg">
                <span class="form-help">Paste a URL or leave blank for a default thumbnail.</span>
            </div>
        `,
        footer: `
            <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-create">Create Course</button>
        `,
        onMount: (modal) => {
            modal.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
            modal.querySelector('#modal-create')?.addEventListener('click', async () => {
                const title = modal.querySelector('#course-title')?.value?.trim();
                if (!title) {
                    showToast('Course title is required.', 'warning');
                    return;
                }

                const btn = modal.querySelector('#modal-create');
                btn.innerHTML = '<span class="spinner-sm"></span> Creating...';
                btn.disabled = true;

                try {
                    await api.post('/courses', {
                        title,
                        description: modal.querySelector('#course-desc')?.value?.trim() || '',
                        category: modal.querySelector('#course-category')?.value,
                        difficulty: modal.querySelector('#course-difficulty')?.value,
                        thumbnail_url: modal.querySelector('#course-thumbnail')?.value?.trim() || null
                    });
                    showToast('Course created successfully!', 'success');
                    closeModal();
                    await loadCourses(container);
                } catch (err) {
                    showToast(err.message || 'Failed to create course.', 'error');
                    btn.innerHTML = 'Create Course';
                    btn.disabled = false;
                }
            });
        }
    });
}

/**
 * Render the course detail view with modules.
 * @param {HTMLElement} container
 * @param {string|number} courseId
 */
async function renderCourseDetail(container, courseId) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-ghost btn-sm" id="back-to-courses">&larr; Back to Courses</button>
            </div>
            <div class="card skeleton-card" style="height: 200px;"></div>
            <div class="mt-6">
                ${Array(3).fill('<div class="skeleton skeleton-card mb-4" style="height: 60px;"></div>').join('')}
            </div>
        </div>
    `;

    container.querySelector('#back-to-courses')?.addEventListener('click', () => navigate('/courses'));

    let course = null;
    try {
        const res = await api.get(`/courses/${courseId}`);
        course = res?.data || res;
    } catch (err) {
        showToast(err.message || 'Failed to load course.', 'error');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#128533;</div>
                <h3>Course not found</h3>
                <button class="btn btn-primary mt-4" id="back-btn">Back to Courses</button>
            </div>
        `;
        container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/courses'));
        return;
    }

    if (!course) return;

    const modules = course.modules || [];
    const progress = course.enrollment_progress ?? course.progress ?? 0;
    const isEnrolled = course.is_enrolled ?? false;

    container.innerHTML = `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <button class="btn btn-ghost btn-sm" id="back-to-courses">&larr; Back to Courses</button>
            </div>

            <!-- Course Header -->
            <div class="card mb-6">
                <div class="flex gap-6" style="flex-wrap: wrap;">
                    <div style="width: 280px; aspect-ratio: 16/9; background: linear-gradient(135deg, var(--bg-input), var(--bg-card-hover)); border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        ${course.thumbnail_url
                            ? `<img src="${course.thumbnail_url}" alt="${course.title}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : `<span style="font-size: 3rem; opacity: 0.3;">&#128218;</span>`
                        }
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="badge ${difficultyBadge(course.difficulty)}">${course.difficulty || 'All Levels'}</span>
                            ${course.category ? `<span class="badge badge-primary">${course.category}</span>` : ''}
                            <span class="text-xs text-muted">${modules.length} module${modules.length !== 1 ? 's' : ''}</span>
                        </div>
                        <h1 style="font-size: var(--fs-2xl); margin-bottom: var(--sp-2);">${course.title}</h1>
                        ${course.description ? `<p class="text-secondary mb-4">${course.description}</p>` : ''}
                        ${isEnrolled ? `
                            <div style="max-width: 300px;">
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-muted">Your Progress</span>
                                    <span class="font-medium">${Math.round(progress)}%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill ${progress >= 100 ? 'green' : ''}" style="width: ${progress}%;"></div>
                                </div>
                            </div>
                        ` : `
                            <button class="btn btn-primary" id="enroll-btn">Enroll Now</button>
                        `}
                    </div>
                </div>
            </div>

            <!-- Modules List -->
            <h2 style="font-size: var(--fs-xl); margin-bottom: var(--sp-4);">Modules</h2>
            <div class="flex flex-col gap-3 stagger" id="modules-list">
                ${modules.length > 0 ? modules.map((mod, idx) => {
                    const isCompleted = mod.completed ?? mod.is_completed ?? false;
                    return `
                        <div class="card card-clickable module-item" data-module-id="${mod.id}" data-module-idx="${idx}" style="padding: var(--sp-4);">
                            <div class="flex items-center gap-4">
                                <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-weight: var(--fw-bold); font-size: var(--fs-sm); ${isCompleted ? 'background: rgba(0, 184, 148, 0.15); color: var(--color-success);' : 'background: var(--bg-input); color: var(--text-muted);'}">
                                    ${isCompleted ? '&#10003;' : idx + 1}
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium text-sm">${mod.title || `Module ${idx + 1}`}</div>
                                    ${mod.description ? `<div class="text-xs text-muted">${mod.description}</div>` : ''}
                                </div>
                                <span class="text-xs text-muted">${mod.duration || ''}</span>
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div class="empty-state">
                        <p class="text-sm text-muted">No modules have been added to this course yet.</p>
                    </div>
                `}
            </div>

            <!-- Module Viewer -->
            <div id="module-viewer" class="mt-6" style="display: none;">
                <div class="card" style="padding: var(--sp-6);">
                    <div class="flex items-center justify-between mb-4">
                        <h3 id="module-viewer-title" style="font-size: var(--fs-lg);"></h3>
                        <button class="btn btn-ghost btn-sm" id="close-module-viewer">Close</button>
                    </div>
                    <div class="divider"></div>
                    <div id="module-viewer-content" class="mt-4" style="line-height: var(--lh-relaxed);"></div>
                    <div class="divider mt-6"></div>
                    <div class="flex justify-between mt-4">
                        <button class="btn btn-ghost btn-sm" id="module-prev">&larr; Previous</button>
                        <button class="btn btn-primary btn-sm" id="module-complete">Mark Complete</button>
                        <button class="btn btn-ghost btn-sm" id="module-next">Next &rarr;</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Back button
    container.querySelector('#back-to-courses')?.addEventListener('click', () => navigate('/courses'));

    // Enroll button
    container.querySelector('#enroll-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#enroll-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Enrolling...';
        btn.disabled = true;

        try {
            await api.post(`/courses/${courseId}/enroll`);
            showToast('Enrolled successfully!', 'success');
            await renderCourseDetail(container, courseId);
        } catch (err) {
            showToast(err.message || 'Failed to enroll.', 'error');
            btn.innerHTML = 'Enroll Now';
            btn.disabled = false;
        }
    });

    // Module click -> open viewer
    let activeModuleIdx = 0;

    function openModuleViewer(idx) {
        if (idx < 0 || idx >= modules.length) return;
        activeModuleIdx = idx;
        const mod = modules[idx];

        const viewer = container.querySelector('#module-viewer');
        const titleEl = container.querySelector('#module-viewer-title');
        const contentEl = container.querySelector('#module-viewer-content');

        if (!viewer || !titleEl || !contentEl) return;

        titleEl.textContent = mod.title || `Module ${idx + 1}`;

        // Render content based on type
        let contentHTML = '';
        if (mod.content) {
            contentHTML += `<div class="text-sm text-secondary" style="white-space: pre-wrap;">${mod.content}</div>`;
        }
        if (mod.video_url) {
            contentHTML += `
                <div class="mt-4" style="aspect-ratio: 16/9; border-radius: var(--radius-md); overflow: hidden; background: #000;">
                    <iframe src="${mod.video_url}" style="width: 100%; height: 100%; border: none;" allowfullscreen></iframe>
                </div>
            `;
        }
        if (mod.pdf_url) {
            contentHTML += `
                <div class="mt-4">
                    <a href="${mod.pdf_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                        &#128196; View PDF Resource
                    </a>
                </div>
            `;
        }
        if (!contentHTML) {
            contentHTML = '<p class="text-muted">No content available for this module.</p>';
        }

        contentEl.innerHTML = contentHTML;
        viewer.style.display = 'block';
        viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    container.querySelector('#modules-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.module-item');
        if (item) {
            openModuleViewer(parseInt(item.dataset.moduleIdx, 10));
        }
    });

    container.querySelector('#close-module-viewer')?.addEventListener('click', () => {
        const viewer = container.querySelector('#module-viewer');
        if (viewer) viewer.style.display = 'none';
    });

    container.querySelector('#module-prev')?.addEventListener('click', () => {
        openModuleViewer(activeModuleIdx - 1);
    });

    container.querySelector('#module-next')?.addEventListener('click', () => {
        openModuleViewer(activeModuleIdx + 1);
    });

    container.querySelector('#module-complete')?.addEventListener('click', async () => {
        const mod = modules[activeModuleIdx];
        if (!mod) return;

        try {
            await api.post(`/courses/${courseId}/modules/${mod.id}/complete`);
            showToast('Module marked as complete!', 'success');
            await renderCourseDetail(container, courseId);
        } catch (err) {
            showToast(err.message || 'Failed to mark module complete.', 'error');
        }
    });
}

/**
 * Fetch courses and re-render grid.
 * @param {HTMLElement} container
 */
async function loadCourses(container) {
    try {
        const res = await api.get('/courses');
        courses = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        renderCourseGrid(container);
    } catch (err) {
        showToast(err.message || 'Failed to load courses.', 'error');
    }
}

/**
 * Render the course card grid.
 * @param {HTMLElement} container
 */
function renderCourseGrid(container) {
    const gridEl = container.querySelector('#courses-grid');
    if (!gridEl) return;

    if (courses.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">&#128218;</div>
                <h3>No courses available</h3>
                <p>Courses will appear here once they are created by coaches.</p>
                ${isCoachOrOwner() ? '<button class="btn btn-primary mt-4" id="empty-create-course">Create Course</button>' : ''}
            </div>
        `;
        gridEl.querySelector('#empty-create-course')?.addEventListener('click', () => openCreateCourseModal(container));
        return;
    }

    gridEl.innerHTML = courses.map(renderCourseCard).join('');
    gridEl.classList.add('stagger');

    // Card click -> course detail
    gridEl.querySelectorAll('.course-card').forEach(card => {
        card.addEventListener('click', () => {
            renderCourseDetail(container, card.dataset.courseId);
        });
    });
}

/**
 * Render the courses page.
 * @param {HTMLElement} container
 * @param {Object} params
 */
export async function render(container, params) {
    // If params include an id, go directly to course detail
    if (params?.id) {
        await renderCourseDetail(container, params.id);
        return;
    }

    courses = [];

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Courses</h1>
                <div class="page-actions">
                    ${isCoachOrOwner() ? '<button class="btn btn-primary" id="create-course-btn">+ Create Course</button>' : ''}
                </div>
            </div>

            <div class="grid grid-auto" id="courses-grid">
                ${Array(6).fill(`
                    <div class="card">
                        <div class="skeleton" style="aspect-ratio: 16/9; border-radius: var(--radius-sm); margin-bottom: var(--sp-4);"></div>
                        <div class="skeleton skeleton-text" style="width: 60px;"></div>
                        <div class="skeleton skeleton-title" style="margin-top: var(--sp-2);"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Create course button
    container.querySelector('#create-course-btn')?.addEventListener('click', () => openCreateCourseModal(container));

    // Load courses
    await loadCourses(container);
}
