// modal.js - Modal dialog component

const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const ICON_WARNING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;color:var(--color-warning)"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

/** Currently active modal overlay element, if any */
let activeOverlay = null;

/**
 * Opens a modal dialog.
 *
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.content - HTML string for the modal body
 * @param {string} [options.footer] - HTML string for the modal footer
 * @param {string} [options.size] - 'default' or 'lg'
 * @param {Function} [options.onClose] - Callback when modal is closed
 * @returns {HTMLElement} The modal overlay element
 */
export function openModal({ title, content, body, footer = '', size = 'default', onClose = null, onMount = null }) {
    // Close any existing modal first
    closeModal();

    // Support both 'content' and 'body' parameter names
    const bodyHTML = body || content || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';

    const sizeClass = size === 'lg' ? ' modal-lg' : '';

    overlay.innerHTML = `
        <div class="modal${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="modal-header">
                <h3 id="modal-title">${title}</h3>
                <button class="btn-icon btn-ghost" id="modal-close-btn" aria-label="Close modal">
                    ${ICON_CLOSE}
                </button>
            </div>
            <div class="modal-body">
                ${bodyHTML}
            </div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>`;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Store callback for cleanup
    overlay._onClose = onClose;

    // Close button
    const closeBtn = overlay.querySelector('#modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal());
    }

    // Click outside modal to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // Escape key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;

    // Focus trap: focus the close button
    requestAnimationFrame(() => {
        if (closeBtn) closeBtn.focus();
    });

    // Call onMount callback so pages can attach event listeners
    if (typeof onMount === 'function') {
        onMount(overlay);
    }

    return overlay;
}

/**
 * Closes the currently open modal.
 * Calls the onClose callback if one was provided.
 */
export function closeModal() {
    if (!activeOverlay) return;

    const overlay = activeOverlay;
    const onClose = overlay._onClose;
    const escHandler = overlay._escHandler;

    // Fade-out animation
    overlay.style.animation = 'fadeOut 150ms ease forwards';
    const modal = overlay.querySelector('.modal');
    if (modal) {
        modal.style.animation = 'fadeOut 150ms ease forwards';
    }

    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 150);

    // Restore body scroll
    document.body.style.overflow = '';

    // Cleanup escape handler
    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
    }

    activeOverlay = null;

    // Fire callback
    if (typeof onClose === 'function') {
        onClose();
    }
}

/**
 * Opens a confirmation dialog with confirm/cancel buttons.
 *
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Confirmation message body
 * @param {string} [options.confirmText='Confirm'] - Text for the confirm button
 * @param {string} [options.confirmClass='btn-danger'] - CSS class for the confirm button
 * @param {string} [options.cancelText='Cancel'] - Text for the cancel button
 * @param {Function} options.onConfirm - Callback when user confirms
 * @param {Function} [options.onCancel] - Callback when user cancels
 * @returns {HTMLElement} The modal overlay element
 */
export function confirmModal({
    title = 'Are you sure?',
    message = '',
    confirmText = 'Confirm',
    confirmClass = 'btn-danger',
    cancelText = 'Cancel',
    onConfirm,
    onCancel = null
}) {
    const content = `
        <div class="flex gap-4 items-start">
            <div style="flex-shrink:0;margin-top:2px">${ICON_WARNING}</div>
            <div>
                <p style="color:var(--text-primary);font-size:var(--fs-sm);line-height:var(--lh-relaxed)">${message}</p>
            </div>
        </div>`;

    const footer = `
        <button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>
        <button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>`;

    const overlay = openModal({
        title,
        content,
        footer,
        size: 'default',
        onClose: onCancel
    });

    // Confirm button
    const confirmBtn = overlay.querySelector('#modal-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            closeModal();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        });
    }

    // Cancel button
    const cancelBtn = overlay.querySelector('#modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (typeof onCancel === 'function') {
                onCancel();
            }
        });
    }

    return overlay;
}
