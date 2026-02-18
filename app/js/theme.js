/**
 * Mindset365 - Theme Module
 * Manages dark/light theme toggling with localStorage persistence.
 */

import { setState, getState } from './store.js';

const STORAGE_KEY = 'mindset365_theme';
const VALID_THEMES = ['dark', 'light'];

/**
 * Initialize the theme.
 * Reads from localStorage or defaults to 'dark'.
 * Applies the data-theme attribute to document.documentElement.
 */
export function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const theme = VALID_THEMES.includes(stored) ? stored : 'dark';

    apply(theme);
    setState('theme', theme);
}

/**
 * Toggle between dark and light themes.
 * @returns {string} the new active theme
 */
export function toggle() {
    const current = get();
    const next = current === 'dark' ? 'light' : 'dark';

    apply(next);
    setState('theme', next);
    localStorage.setItem(STORAGE_KEY, next);

    return next;
}

/**
 * Set a specific theme.
 * @param {string} theme - 'dark' or 'light'
 */
export function set(theme) {
    if (!VALID_THEMES.includes(theme)) {
        console.warn(`[Theme] Invalid theme: "${theme}". Expected "dark" or "light".`);
        return;
    }

    apply(theme);
    setState('theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Get the currently active theme.
 * @returns {string} 'dark' or 'light'
 */
export function get() {
    return getState('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Apply a theme to the document.
 * @param {string} theme
 */
function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = theme === 'dark' ? '#0a0a14' : '#F5F6FA';
}

export default {
    init,
    toggle,
    set,
    get
};
