// toast.js - Toast notification component

const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * Ensures the toast-container element exists in the DOM.
 * @returns {HTMLElement} The toast container element
 */
function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Shows a toast notification.
 *
 * @param {Object} options
 * @param {string} [options.type='info'] - Toast type: 'success', 'error', 'warning', 'info'
 * @param {string} [options.title=''] - Toast title
 * @param {string} [options.message=''] - Toast message body
 * @param {number} [options.duration=4000] - Auto-dismiss duration in ms (0 = no auto-dismiss)
 * @returns {HTMLElement} The toast element
 */
export function showToast({ type = 'info', title = '', message = '', duration = 4000 } = {}) {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');

    const icon = ICONS[type] || ICONS.info;

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Dismiss">${ICON_CLOSE}</button>`;

    container.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => dismissToast(toast));
    }

    // Auto-dismiss
    let dismissTimer = null;
    if (duration > 0) {
        dismissTimer = setTimeout(() => dismissToast(toast), duration);
    }

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => {
        if (dismissTimer) {
            clearTimeout(dismissTimer);
            dismissTimer = null;
        }
    });

    toast.addEventListener('mouseleave', () => {
        if (duration > 0 && toast.parentNode) {
            dismissTimer = setTimeout(() => dismissToast(toast), duration);
        }
    });

    // Limit to 5 visible toasts — remove oldest if over limit
    const toasts = container.querySelectorAll('.toast');
    if (toasts.length > 5) {
        dismissToast(toasts[0]);
    }

    return toast;
}

/**
 * Dismisses a toast with a slide-out animation, then removes it from the DOM.
 * @param {HTMLElement} toast - The toast element to dismiss
 */
function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;

    // Slide-out animation
    toast.style.animation = 'none';
    toast.offsetHeight; // Force reflow
    toast.style.transition = 'opacity 200ms ease, transform 200ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }

        // Remove container if empty
        const container = document.getElementById('toast-container');
        if (container && container.children.length === 0) {
            container.remove();
        }
    }, 200);
}

/**
 * Clears all currently visible toasts.
 */
export function clearToasts() {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toasts = container.querySelectorAll('.toast');
    toasts.forEach(toast => dismissToast(toast));
}
