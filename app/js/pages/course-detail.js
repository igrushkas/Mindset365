/**
 * Mindset365 - Course Detail Page
 * Full course view with header, module accordion, student enrollment, and inline editing.
 * Modules are expandable sections with completion tracking and content display.
 */

import api from '../api.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, statusBadge, formatCurrency, getInitials, capitalize } from '../utils.js';
import { getState, setState } from '../store.js';

/** Currently loaded course data */
let course = null;

/** Module list */
let modules = [];

/** Enrolled students */
let students = [];

/** Index of the currently expanded module (-1 = none) */
let expandedModuleIdx = -1;

/** Whether the edit course form is visible */
let isEditingCourse = false;

/** Whether the add module form is visible */
let isAddingModule = false;

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
 * Render a loading skeleton for the course detail page.
 * @returns {string} HTML string
 */
function renderSkeleton() {
    return `
        <div class="page-enter">
            <div class="flex items-center gap-3 mb-6">
                <div class="skeleton" style="width: 120px; height: 32px; border-radius: var(--radius-sm);"></div>
            </div>
            <div class="card mb-6">
                <div class="flex gap-6" style="padding: var(--sp-6); flex-wrap: wrap;">
                    <div class="skeleton" style="width: 280px; aspect-ratio: 16/9; border-radius: var(--radius-sm);"></div>
                    <div style="flex: 1;">
                        <div class="skeleton skeleton-title" style="width: 60%; margin-bottom: var(--sp-3);"></div>
                        <div class="skeleton skeleton-text" style="width: 80%; margin-bottom: var(--sp-2);"></div>
                        <div class="skeleton skeleton-text" style="width: 50%;"></div>
                    </div>
                </div>
            </div>
            <div class="skeleton skeleton-title" style="width: 120px; margin-bottom: var(--sp-4);"></div>
            ${Array(4).fill('<div class="skeleton skeleton-card mb-3" style="height: 64px;"></div>').join('')}
        </div>
    `;
}

/**
 * Compute the overall progress percentage for enrolled users.
 * @returns {number} 0-100
 */
function computeEnrollmentProgress() {
    if (!course) return 0;
    return course.enrollment_progress ?? course.progress ?? 0;
}

/**
 * Render the course header card.
 * @returns {string} HTML string
 */
function renderCourseHeader() {
    const title = escapeHtml(course.title || 'Untitled Course');
    const description = escapeHtml(course.description || '');
    const studentCount = course.student_count ?? course.enrolled_count ?? students.length;
    const progress = computeEnrollmentProgress();
    const isEnrolled = course.is_enrolled ?? false;

    return `
        <div class="card mb-6">
            <div class="card-header">
                <h3>Course Details</h3>
                ${isCoachOrOwner() ? `<button class="btn btn-secondary btn-sm" id="edit-course-btn">Edit</button>` : ''}
            </div>
            <div class="card-body">
                <div class="flex gap-6" style="flex-wrap: wrap;">
                    <div style="width: 280px; aspect-ratio: 16/9; background: linear-gradient(135deg, var(--bg-input), var(--bg-card-hover)); border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        ${course.thumbnail_url
                            ? `<img src="${escapeHtml(course.thumbnail_url)}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : `<span style="font-size: 3rem; opacity: 0.3;">&#128218;</span>`
                        }
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <div class="flex items-center gap-2 mb-2">
                            ${statusBadge(course.status || 'draft')}
                            <span class="badge ${difficultyBadge(course.difficulty)}">${escapeHtml(course.difficulty || 'All Levels')}</span>
                            ${course.category ? `<span class="badge badge-primary">${escapeHtml(course.category)}</span>` : ''}
                        </div>
                        <h1 style="font-size: var(--fs-2xl); font-weight: var(--fw-bold); margin-bottom: var(--sp-2);">${title}</h1>
                        ${description ? `<p class="text-secondary mb-4">${description}</p>` : ''}
                        <div class="flex items-center gap-4 mb-4">
                            <span class="text-sm text-muted">${modules.length} module${modules.length !== 1 ? 's' : ''}</span>
                            <span class="text-sm text-muted">${studentCount} student${studentCount !== 1 ? 's' : ''} enrolled</span>
                            ${course.duration ? `<span class="text-sm text-muted">${escapeHtml(course.duration)}</span>` : ''}
                        </div>

                        <!-- Enrollment progress bar -->
                        ${isEnrolled ? `
                            <div style="max-width: 320px;">
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
        </div>
    `;
}

/**
 * Render the inline course edit form.
 * @returns {string} HTML string
 */
function renderEditCourseForm() {
    return `
        <div class="card mb-6" id="edit-course-form">
            <div class="card-header">
                <h3>Edit Course</h3>
                <button class="btn btn-ghost btn-sm" id="cancel-course-edit">Cancel</button>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" id="course-edit-title" value="${escapeHtml(course.title || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="course-edit-desc" rows="3">${escapeHtml(course.description || '')}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="course-edit-category">
                            ${['marketing', 'sales', 'operations', 'finance', 'mindset', 'product', 'leadership', 'other'].map(c =>
                                `<option value="${c}" ${course.category === c ? 'selected' : ''}>${capitalize(c)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Difficulty</label>
                        <select id="course-edit-difficulty">
                            <option value="beginner" ${course.difficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
                            <option value="intermediate" ${course.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                            <option value="advanced" ${course.difficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="course-edit-status">
                            <option value="draft" ${course.status === 'draft' ? 'selected' : ''}>Draft</option>
                            <option value="published" ${course.status === 'published' ? 'selected' : ''}>Published</option>
                            <option value="archived" ${course.status === 'archived' ? 'selected' : ''}>Archived</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail URL</label>
                        <input type="url" id="course-edit-thumbnail" value="${escapeHtml(course.thumbnail_url || '')}" placeholder="https://example.com/image.jpg">
                    </div>
                </div>
                <div class="flex justify-between mt-4">
                    <button class="btn btn-ghost" id="cancel-course-edit-2">Cancel</button>
                    <button class="btn btn-primary" id="save-course-edit">Save Changes</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the modules accordion list.
 * @returns {string} HTML string
 */
function renderModulesAccordion() {
    if (modules.length === 0 && !isAddingModule) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">&#128218;</div>
                <h3>No modules yet</h3>
                <p>This course has no modules. ${isCoachOrOwner() ? 'Add the first module below.' : 'Check back later for content.'}</p>
            </div>
        `;
    }

    return `
        <div class="flex flex-col gap-3 stagger" id="modules-accordion">
            ${modules.map((mod, idx) => {
                const isExpanded = idx === expandedModuleIdx;
                const isCompleted = mod.completed ?? mod.is_completed ?? false;
                const contentType = mod.content_type || 'text';

                return `
                    <div class="card module-accordion-item" data-module-idx="${idx}" style="overflow: hidden;">
                        <!-- Accordion Header -->
                        <div class="flex items-center gap-4 module-header" data-idx="${idx}" style="padding: var(--sp-4); cursor: pointer;">
                            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-weight: var(--fw-bold); font-size: var(--fs-sm); flex-shrink: 0; ${isCompleted ? 'background: rgba(0, 184, 148, 0.15); color: var(--color-success);' : 'background: var(--bg-input); color: var(--text-muted);'}">
                                ${isCompleted ? '&#10003;' : idx + 1}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div class="font-medium text-sm">${escapeHtml(mod.title || `Module ${idx + 1}`)}</div>
                                ${mod.description ? `<div class="text-xs text-muted" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(mod.description)}</div>` : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="badge badge-neutral">${escapeHtml(capitalize(contentType))}</span>
                                ${mod.duration ? `<span class="text-xs text-muted">${escapeHtml(mod.duration)}</span>` : ''}
                                <span class="text-muted" style="font-size: var(--fs-lg); transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'});">&#9660;</span>
                            </div>
                        </div>

                        <!-- Accordion Body (expanded content) -->
                        ${isExpanded ? `
                            <div style="border-top: 1px solid var(--border-color); padding: var(--sp-4);">
                                ${mod.description ? `<p class="text-sm text-secondary mb-4">${escapeHtml(mod.description)}</p>` : ''}

                                ${mod.content ? `
                                    <div class="text-sm text-secondary mb-4" style="white-space: pre-wrap; line-height: var(--lh-relaxed);">${escapeHtml(mod.content)}</div>
                                ` : ''}

                                ${mod.video_url ? `
                                    <div class="mb-4" style="aspect-ratio: 16/9; border-radius: var(--radius-md); overflow: hidden; background: #000;">
                                        <iframe src="${escapeHtml(mod.video_url)}" style="width: 100%; height: 100%; border: none;" allowfullscreen></iframe>
                                    </div>
                                ` : ''}

                                ${mod.pdf_url ? `
                                    <div class="mb-4">
                                        <a href="${escapeHtml(mod.pdf_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                                            &#128196; View PDF Resource
                                        </a>
                                    </div>
                                ` : ''}

                                ${(!mod.content && !mod.video_url && !mod.pdf_url) ? '<p class="text-sm text-muted">No content available for this module.</p>' : ''}

                                <!-- Completion checkbox -->
                                <div class="flex items-center justify-between mt-4" style="border-top: 1px solid var(--border-color); padding-top: var(--sp-3);">
                                    <label class="flex items-center gap-2" style="cursor: pointer;">
                                        <input type="checkbox" class="module-complete-check" data-module-id="${mod.id}" data-module-idx="${idx}" ${isCompleted ? 'checked' : ''} style="width: auto; accent-color: var(--color-primary);">
                                        <span class="text-sm">${isCompleted ? 'Completed' : 'Mark as complete'}</span>
                                    </label>
                                    <span class="text-xs text-muted">${mod.duration || ''}</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render the add module inline form.
 * @returns {string} HTML string
 */
function renderAddModuleForm() {
    if (!isAddingModule) return '';

    return `
        <div class="card mb-4" id="add-module-form">
            <div class="card-header">
                <h3>Add Module</h3>
                <button class="btn btn-ghost btn-sm" id="cancel-module-btn">Cancel</button>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Title *</label>
                    <input type="text" id="module-title" placeholder="Module title...">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="module-description" rows="2" placeholder="Brief description of this module..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Content Type</label>
                        <select id="module-content-type">
                            <option value="text">Text</option>
                            <option value="video">Video</option>
                            <option value="pdf">PDF</option>
                            <option value="quiz">Quiz</option>
                            <option value="assignment">Assignment</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration</label>
                        <input type="text" id="module-duration" placeholder="e.g., 15 min">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Content Body</label>
                    <textarea id="module-content" rows="6" placeholder="Module content, instructions, or embed URLs..."></textarea>
                </div>
                <div class="flex justify-end gap-2 mt-4">
                    <button class="btn btn-ghost" id="cancel-module-btn-2">Cancel</button>
                    <button class="btn btn-primary" id="save-module-btn">Add Module</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the student enrollment list.
 * @returns {string} HTML string
 */
function renderStudentList() {
    if (students.length === 0) {
        return `
            <div class="empty-state" style="padding: var(--sp-6);">
                <p class="text-sm text-muted">No students enrolled yet.</p>
            </div>
        `;
    }

    return `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Enrolled</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => {
                        const progress = s.progress ?? s.completion_pct ?? 0;
                        return `
                            <tr>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <div class="avatar avatar-sm">${s.avatar_url ? `<img src="${escapeHtml(s.avatar_url)}" alt="">` : getInitials(s.name || 'S')}</div>
                                        <span class="font-medium text-sm">${escapeHtml(s.name || 'Student')}</span>
                                    </div>
                                </td>
                                <td class="text-sm text-muted">${escapeHtml(s.email || '-')}</td>
                                <td class="text-sm">${s.enrolled_at ? formatDate(s.enrolled_at) : '-'}</td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <div class="progress-bar" style="width: 80px;">
                                            <div class="progress-fill ${progress >= 100 ? 'green' : ''}" style="width: ${progress}%;"></div>
                                        </div>
                                        <span class="text-xs text-muted">${Math.round(progress)}%</span>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
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
                <button class="btn btn-ghost btn-sm" id="back-btn">&larr; Back to Courses</button>
            </div>

            <!-- Course Header or Edit Form -->
            <div id="course-header-area">
                ${isEditingCourse ? renderEditCourseForm() : renderCourseHeader()}
            </div>

            <!-- Modules Section -->
            <div class="flex items-center justify-between mb-4">
                <h2 style="font-size: var(--fs-xl); font-weight: var(--fw-semibold);">Modules</h2>
                ${isCoachOrOwner() ? `<button class="btn btn-primary btn-sm" id="add-module-btn">+ Add Module</button>` : ''}
            </div>

            ${renderAddModuleForm()}

            <div id="modules-area">
                ${renderModulesAccordion()}
            </div>

            <!-- Students Section -->
            <div class="mt-6">
                <h2 style="font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--sp-4);">Enrolled Students</h2>
                <div class="card">
                    <div class="card-body" id="students-area">
                        ${renderStudentList()}
                    </div>
                </div>
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
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/courses'));

    // Enroll button
    container.querySelector('#enroll-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#enroll-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Enrolling...';
        btn.disabled = true;

        try {
            await api.post(`/courses/${course.id}/enroll`);
            window.showToast('Enrolled successfully!', 'success');
            await loadCourseData(course.id);
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to enroll.', 'error');
            btn.innerHTML = 'Enroll Now';
            btn.disabled = false;
        }
    });

    // Edit course button
    container.querySelector('#edit-course-btn')?.addEventListener('click', () => {
        isEditingCourse = true;
        renderPage(container);
    });

    // Cancel course edit
    const cancelCourseEdit = () => {
        isEditingCourse = false;
        renderPage(container);
    };
    container.querySelector('#cancel-course-edit')?.addEventListener('click', cancelCourseEdit);
    container.querySelector('#cancel-course-edit-2')?.addEventListener('click', cancelCourseEdit);

    // Save course edit
    container.querySelector('#save-course-edit')?.addEventListener('click', async () => {
        const title = container.querySelector('#course-edit-title')?.value?.trim();
        if (!title) {
            window.showToast('Course title is required.', 'warning');
            return;
        }

        const btn = container.querySelector('#save-course-edit');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            await api.put(`/courses/${course.id}`, {
                title,
                description: container.querySelector('#course-edit-desc')?.value?.trim() || '',
                category: container.querySelector('#course-edit-category')?.value,
                difficulty: container.querySelector('#course-edit-difficulty')?.value,
                status: container.querySelector('#course-edit-status')?.value,
                thumbnail_url: container.querySelector('#course-edit-thumbnail')?.value?.trim() || null
            });

            window.showToast('Course updated successfully!', 'success');
            isEditingCourse = false;
            await loadCourseData(course.id);
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to update course.', 'error');
            btn.innerHTML = 'Save Changes';
            btn.disabled = false;
        }
    });

    // Add module button
    container.querySelector('#add-module-btn')?.addEventListener('click', () => {
        isAddingModule = true;
        renderPage(container);
    });

    // Cancel add module
    const cancelModule = () => {
        isAddingModule = false;
        renderPage(container);
    };
    container.querySelector('#cancel-module-btn')?.addEventListener('click', cancelModule);
    container.querySelector('#cancel-module-btn-2')?.addEventListener('click', cancelModule);

    // Save new module
    container.querySelector('#save-module-btn')?.addEventListener('click', async () => {
        const title = container.querySelector('#module-title')?.value?.trim();
        if (!title) {
            window.showToast('Module title is required.', 'warning');
            return;
        }

        const btn = container.querySelector('#save-module-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Adding...';
        btn.disabled = true;

        try {
            await api.post(`/courses/${course.id}/modules`, {
                title,
                description: container.querySelector('#module-description')?.value?.trim() || '',
                content_type: container.querySelector('#module-content-type')?.value || 'text',
                duration: container.querySelector('#module-duration')?.value?.trim() || '',
                content: container.querySelector('#module-content')?.value?.trim() || ''
            });

            window.showToast('Module added successfully!', 'success');
            isAddingModule = false;
            await loadCourseData(course.id);
            renderPage(container);
        } catch (err) {
            window.showToast(err.message || 'Failed to add module.', 'error');
            btn.innerHTML = 'Add Module';
            btn.disabled = false;
        }
    });

    // Module accordion toggle
    container.querySelectorAll('.module-header').forEach(header => {
        header.addEventListener('click', () => {
            const idx = parseInt(header.dataset.idx, 10);
            expandedModuleIdx = expandedModuleIdx === idx ? -1 : idx;
            const modulesArea = container.querySelector('#modules-area');
            if (modulesArea) {
                modulesArea.innerHTML = renderModulesAccordion();
                attachModuleListeners(container);
            }
        });
    });

    // Module-specific listeners
    attachModuleListeners(container);
}

/**
 * Attach event listeners for module completion checkboxes.
 * @param {HTMLElement} container
 */
function attachModuleListeners(container) {
    // Module accordion toggle (reattach after re-render)
    container.querySelectorAll('.module-header').forEach(header => {
        // Remove old listeners by cloning (simple approach for inline event re-attach)
        const newHeader = header.cloneNode(true);
        header.parentNode?.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => {
            const idx = parseInt(newHeader.dataset.idx, 10);
            expandedModuleIdx = expandedModuleIdx === idx ? -1 : idx;
            const modulesArea = container.querySelector('#modules-area');
            if (modulesArea) {
                modulesArea.innerHTML = renderModulesAccordion();
                attachModuleListeners(container);
            }
        });
    });

    // Completion checkboxes
    container.querySelectorAll('.module-complete-check').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const moduleId = e.target.dataset.moduleId;
            const idx = parseInt(e.target.dataset.moduleIdx, 10);
            const isChecked = e.target.checked;

            try {
                if (isChecked) {
                    await api.post(`/courses/${course.id}/modules/${moduleId}/complete`);
                    window.showToast('Module marked as complete!', 'success');
                } else {
                    await api.delete(`/courses/${course.id}/modules/${moduleId}/complete`);
                    window.showToast('Module completion removed.', 'info');
                }

                // Update local state
                if (modules[idx]) {
                    modules[idx].completed = isChecked;
                    modules[idx].is_completed = isChecked;
                }

                // Update progress
                const completedCount = modules.filter(m => m.completed || m.is_completed).length;
                if (course && modules.length > 0) {
                    course.enrollment_progress = Math.round((completedCount / modules.length) * 100);
                }

                // Re-render modules area only
                const modulesArea = container.querySelector('#modules-area');
                if (modulesArea) {
                    modulesArea.innerHTML = renderModulesAccordion();
                    attachModuleListeners(container);
                }

                // Re-render header to update progress bar
                const headerArea = container.querySelector('#course-header-area');
                if (headerArea && !isEditingCourse) {
                    headerArea.innerHTML = renderCourseHeader();
                    // Re-attach enroll/edit listeners
                    container.querySelector('#enroll-btn')?.addEventListener('click', async () => {
                        const btn = container.querySelector('#enroll-btn');
                        btn.innerHTML = '<span class="spinner-sm"></span> Enrolling...';
                        btn.disabled = true;
                        try {
                            await api.post(`/courses/${course.id}/enroll`);
                            window.showToast('Enrolled successfully!', 'success');
                            await loadCourseData(course.id);
                            renderPage(container);
                        } catch (err) {
                            window.showToast(err.message || 'Failed to enroll.', 'error');
                            btn.innerHTML = 'Enroll Now';
                            btn.disabled = false;
                        }
                    });
                    container.querySelector('#edit-course-btn')?.addEventListener('click', () => {
                        isEditingCourse = true;
                        renderPage(container);
                    });
                }
            } catch (err) {
                window.showToast(err.message || 'Failed to update module.', 'error');
                e.target.checked = !isChecked;
            }
        });
    });
}

/**
 * Load all course data from the API.
 * @param {string|number} id
 * @returns {Promise<boolean>} true if loaded successfully
 */
async function loadCourseData(id) {
    try {
        const res = await api.get(`/courses/${id}`);
        course = res?.data || res;
        modules = course?.modules || [];
        students = course?.students || course?.enrollments || [];
        return true;
    } catch {
        return false;
    }
}

/**
 * Attempt to load students separately if not included in course data.
 * @param {string|number} id
 */
async function loadStudents(id) {
    try {
        const res = await api.get(`/courses/${id}/students`);
        students = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch {
        // Keep whatever was in the course response
    }
}

/**
 * Render the course detail page.
 * @param {HTMLElement} container
 * @param {Object} params - Route params with params.id
 */
export async function render(container, params) {
    // Guard: missing ID
    if (!params?.id) {
        navigate('/courses', { replace: true });
        return;
    }

    // Reset state
    course = null;
    modules = [];
    students = [];
    expandedModuleIdx = -1;
    isEditingCourse = false;
    isAddingModule = false;

    // Show loading skeleton
    container.innerHTML = renderSkeleton();

    // Load course data
    const loaded = await loadCourseData(params.id);

    if (!loaded || !course) {
        container.innerHTML = `
            <div class="page-enter">
                <div class="empty-state">
                    <div class="empty-state-icon">&#128533;</div>
                    <h3>Course not found</h3>
                    <p>The course may have been removed or the link is invalid.</p>
                    <button class="btn btn-primary mt-4" id="back-btn">Back to Courses</button>
                </div>
            </div>
        `;
        container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/courses'));
        window.showToast('Failed to load course.', 'error');
        return;
    }

    // Load students separately if not in the course payload
    if (students.length === 0) {
        await loadStudents(params.id);
    }

    // Render full page
    renderPage(container);
}
