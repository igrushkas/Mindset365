/**
 * Mindset365 - Utility Functions
 * Common helpers used throughout the application.
 */

/**
 * Format a date into a human-readable string.
 *
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Format string: 'short', 'long', 'datetime', 'time', 'iso', or custom
 * @returns {string} formatted date string
 */
export function formatDate(date, format = 'short') {
    const d = date instanceof Date ? date : new Date(date);

    if (isNaN(d.getTime())) {
        return '';
    }

    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        case 'long':
            return d.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        case 'datetime':
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        case 'time':
            return d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });
        case 'iso':
            return d.toISOString().split('T')[0];
        case 'relative':
            return timeAgo(d);
        default:
            return d.toLocaleDateString('en-US');
    }
}

/**
 * Return a relative time string like "2 hours ago", "3 days ago", "just now".
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function timeAgo(date) {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHr === 1) return '1 hour ago';
    if (diffHr < 24) return `${diffHr} hours ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffWeek === 1) return '1 week ago';
    if (diffWeek < 5) return `${diffWeek} weeks ago`;
    if (diffMonth === 1) return '1 month ago';
    if (diffMonth < 12) return `${diffMonth} months ago`;
    if (diffYear === 1) return '1 year ago';
    return `${diffYear} years ago`;
}

/**
 * Debounce a function call.
 *
 * @param {Function} fn - function to debounce
 * @param {number} ms - delay in milliseconds
 * @returns {Function} debounced function with a .cancel() method
 */
export function debounce(fn, ms = 300) {
    let timer = null;

    const debounced = function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, ms);
    };

    debounced.cancel = () => {
        clearTimeout(timer);
    };

    return debounced;
}

/**
 * Format a number as USD currency.
 *
 * @param {number} amount
 * @param {string} currency - currency code (default: 'USD')
 * @returns {string} formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 *
 * @param {string} str
 * @param {number} len - maximum length
 * @returns {string}
 */
export function truncate(str, len = 100) {
    if (!str || str.length <= len) return str || '';
    return str.slice(0, len).trimEnd() + '...';
}

/**
 * Escape HTML special characters to prevent XSS.
 *
 * @param {string} str
 * @returns {string} escaped string safe for innerHTML
 */
export function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Generate a random ID string suitable for DOM element IDs.
 *
 * @param {string} prefix - optional prefix
 * @returns {string}
 */
export function generateId(prefix = 'el') {
    const random = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${random}${timestamp}`;
}

/**
 * Extract initials from a full name.
 * "John Doe" -> "JD", "alice" -> "A", "John Michael Doe" -> "JD"
 *
 * @param {string} name
 * @returns {string} uppercase initials (max 2 characters)
 */
export function getInitials(name) {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Return a CSS class name for a given priority level.
 * Maps to the priority-* classes in components.css.
 *
 * @param {string} priority - 'urgent', 'high', 'medium', 'low', or 'none'
 * @returns {string} CSS class name
 */
export function priorityColor(priority) {
    const map = {
        urgent: 'priority-urgent',
        high: 'priority-high',
        medium: 'priority-medium',
        low: 'priority-low',
        none: 'priority-none'
    };
    return map[(priority || '').toLowerCase()] || 'priority-none';
}

/**
 * Generate a badge HTML string for a given status.
 * Maps to the badge-* classes in components.css.
 *
 * @param {string} status - status string
 * @returns {string} HTML string for the badge
 */
export function statusBadge(status) {
    const statusConfig = {
        active: { label: 'Active', class: 'badge-success' },
        completed: { label: 'Completed', class: 'badge-success' },
        done: { label: 'Done', class: 'badge-success' },
        in_progress: { label: 'In Progress', class: 'badge-primary' },
        'in-progress': { label: 'In Progress', class: 'badge-primary' },
        in_review: { label: 'In Review', class: 'badge-info' },
        pending: { label: 'Pending', class: 'badge-warning' },
        todo: { label: 'To Do', class: 'badge-neutral' },
        blocked: { label: 'Blocked', class: 'badge-danger' },
        cancelled: { label: 'Cancelled', class: 'badge-danger' },
        overdue: { label: 'Overdue', class: 'badge-danger' },
        inactive: { label: 'Inactive', class: 'badge-neutral' },
        draft: { label: 'Draft', class: 'badge-neutral' },
        published: { label: 'Published', class: 'badge-success' },
        archived: { label: 'Archived', class: 'badge-neutral' }
    };

    const key = (status || '').toLowerCase().replace(/\s+/g, '_');
    const config = statusConfig[key] || {
        label: status || 'Unknown',
        class: 'badge-neutral'
    };

    return `<span class="badge ${config.class}">${escapeHtml(config.label)}</span>`;
}

/**
 * Safely parse a JSON string with a fallback value.
 *
 * @param {string} str - JSON string to parse
 * @param {*} fallback - value to return on parse failure
 * @returns {*}
 */
export function parseJSON(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

/**
 * Format a large number into a compact form (1.2K, 3.4M, etc.)
 *
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(num);
}

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Create a throttled version of a function.
 *
 * @param {Function} fn
 * @param {number} ms - throttle interval in milliseconds
 * @returns {Function}
 */
export function throttle(fn, ms = 300) {
    let lastCall = 0;
    let timer = null;

    return function (...args) {
        const now = Date.now();
        const remaining = ms - (now - lastCall);

        if (remaining <= 0) {
            clearTimeout(timer);
            lastCall = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

export default {
    formatDate,
    timeAgo,
    debounce,
    formatCurrency,
    truncate,
    escapeHtml,
    generateId,
    getInitials,
    priorityColor,
    statusBadge,
    parseJSON,
    formatNumber,
    capitalize,
    throttle
};
