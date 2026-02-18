/**
 * Mindset365 - Client-Side SPA Router
 * History API-based router with lazy-loaded page modules, auth guards, and page transitions.
 */

import { isAuthenticated } from './auth.js';
import { setState, getState } from './store.js';

// Routes that require owner/admin role
const ownerRoutes = new Set(['/clients', '/courses', '/content', '/analytics', '/automations']);

/**
 * Route definitions.
 * Each route maps a path pattern to a lazy-loaded page module.
 * The page module must export a render(container, params) function.
 */
const routes = [
    { path: '/login',             loader: () => import('./pages/login.js') },
    { path: '/',                  loader: () => import('./pages/dashboard.js') },
    { path: '/goals',             loader: () => import('./pages/goals.js') },
    { path: '/tasks',             loader: () => import('./pages/tasks.js') },
    { path: '/tasks/:id',         loader: () => import('./pages/task-detail.js') },
    { path: '/clients',           loader: () => import('./pages/clients.js') },
    { path: '/clients/:id',       loader: () => import('./pages/client-detail.js') },
    { path: '/courses',           loader: () => import('./pages/courses.js') },
    { path: '/courses/:id',       loader: () => import('./pages/course-detail.js') },
    { path: '/content',           loader: () => import('./pages/content.js') },
    { path: '/chat',              loader: () => import('./pages/chat.js') },
    { path: '/analytics',         loader: () => import('./pages/analytics.js') },
    { path: '/workspace',         loader: () => import('./pages/workspace.js') },
    { path: '/automations',       loader: () => import('./pages/automations.js') },
    { path: '/settings',          loader: () => import('./pages/settings.js') },
    { path: '/assessment',        loader: () => import('./pages/assessment.js') },
    { path: '/referrals',         loader: () => import('./pages/referrals.js') },
    { path: '/billing',           loader: () => import('./pages/billing.js') }
];

// Public routes that do not require authentication
const publicRoutes = new Set(['/login']);

// Current route abort controller for cancelling in-flight navigation
let currentAbortController = null;

/**
 * Match a URL path against the defined routes.
 * Supports dynamic segments like :id.
 *
 * @param {string} path - URL path to match
 * @returns {{ route: Object, params: Object } | null}
 */
function matchRoute(path) {
    // Remove trailing slash (except for root)
    const cleanPath = path === '/' ? '/' : path.replace(/\/+$/, '');

    for (const route of routes) {
        const params = extractParams(route.path, cleanPath);
        if (params !== null) {
            return { route, params };
        }
    }
    return null;
}

/**
 * Extract URL parameters from a path based on a route pattern.
 *
 * @param {string} pattern - route pattern like "/tasks/:id"
 * @param {string} path - actual URL path like "/tasks/abc123"
 * @returns {Object|null} params object or null if no match
 */
function extractParams(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
        return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            // Dynamic segment
            const paramName = patternParts[i].slice(1);
            params[paramName] = decodeURIComponent(pathParts[i]);
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }

    return params;
}

/**
 * Navigate to a new URL path.
 * Handles auth guards, lazy loading, and page transition animations.
 *
 * @param {string} path - URL path to navigate to
 * @param {Object} options
 * @param {boolean} options.replace - use replaceState instead of pushState
 * @param {Object} options.state - state to pass to pushState
 */
export async function navigate(path, { replace = false, state = {} } = {}) {
    // Check if dev mode is active (user state was set without real auth)
    const devMode = getState('user') && !isAuthenticated();

    // Auth guard: redirect unauthenticated users to login (skip in dev mode)
    if (!devMode && !publicRoutes.has(path) && !isAuthenticated()) {
        navigate('/login', { replace: true });
        return;
    }

    // Redirect authenticated users away from login
    if (path === '/login' && (isAuthenticated() || devMode)) {
        navigate('/', { replace: true });
        return;
    }

    // Owner-only route guard
    const user = getState('user');
    const basePath = '/' + (path.split('/').filter(Boolean)[0] || '');
    if (ownerRoutes.has(basePath) && user && user.role !== 'owner' && user.role !== 'admin') {
        navigate('/', { replace: true });
        return;
    }

    // Ensure login-active class is cleared when navigating to non-login routes
    if (path !== '/login') {
        document.body.classList.remove('login-active');
    }

    // Cancel any in-flight navigation
    if (currentAbortController) {
        currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    // Match the route
    const match = matchRoute(path);

    if (!match) {
        // 404 - navigate to dashboard or show error
        console.warn(`[Router] No route found for: ${path}`);
        if (path !== '/') {
            navigate('/', { replace: true });
        }
        return;
    }

    // Update browser history
    if (replace) {
        history.replaceState(state, '', path);
    } else {
        history.pushState(state, '', path);
    }

    // Update store
    setState('currentPage', path);

    // Update active nav item in sidebar
    updateActiveNavItem(path);

    // Render the page
    await renderPage(match, signal);
}

/**
 * Render a matched route's page module into the #page-content container.
 *
 * @param {{ route: Object, params: Object }} match
 * @param {AbortSignal} signal
 */
async function renderPage(match, signal) {
    const container = document.getElementById('page-content');
    if (!container) {
        console.error('[Router] #page-content element not found in DOM.');
        return;
    }

    // Page exit animation
    container.classList.remove('page-enter');
    container.classList.add('page-exit');

    // Wait for exit animation (150ms per animations.css)
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (signal.aborted) return;

    // Show loading state
    setState('loading', true);
    container.innerHTML = renderLoadingSkeleton();
    container.classList.remove('page-exit');
    container.classList.add('page-enter');

    try {
        // Lazy-load the page module
        const pageModule = await match.route.loader();

        if (signal.aborted) return;

        // Clear loading state
        container.innerHTML = '';
        container.classList.remove('page-enter');

        // Trigger page enter animation
        void container.offsetWidth; // force reflow
        container.classList.add('page-enter');

        // Call the page module's render function
        if (typeof pageModule.render === 'function') {
            await pageModule.render(container, match.params);
        } else if (typeof pageModule.default?.render === 'function') {
            await pageModule.default.render(container, match.params);
        } else {
            console.error('[Router] Page module does not export a render function:', match.route.path);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128679;</div>
                    <h3>Page Under Construction</h3>
                    <p>This page is coming soon.</p>
                </div>
            `;
        }

    } catch (err) {
        if (signal.aborted) return;

        console.error('[Router] Failed to load page:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#9888;&#65039;</div>
                <h3>Failed to Load Page</h3>
                <p>${err.message || 'An unexpected error occurred.'}</p>
                <button class="btn btn-primary mt-4" onclick="window.location.reload()">Reload</button>
            </div>
        `;
    } finally {
        setState('loading', false);
    }
}

/**
 * Render a loading skeleton placeholder.
 * @returns {string} HTML string
 */
function renderLoadingSkeleton() {
    return `
        <div class="animate-pulse" style="padding: var(--sp-2);">
            <div class="skeleton skeleton-title" style="width: 40%; margin-bottom: var(--sp-6);"></div>
            <div class="grid grid-4" style="margin-bottom: var(--sp-6);">
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
            </div>
            <div class="skeleton skeleton-card" style="height: 200px;"></div>
        </div>
    `;
}

/**
 * Update the active state of sidebar nav items based on the current path.
 * @param {string} path
 */
function updateActiveNavItem(path) {
    const navItems = document.querySelectorAll('.nav-item[data-path]');
    const basePath = '/' + (path.split('/').filter(Boolean)[0] || '');

    navItems.forEach((item) => {
        const itemPath = item.getAttribute('data-path');
        if (itemPath === path || (itemPath !== '/' && path.startsWith(itemPath))) {
            item.classList.add('active');
        } else if (itemPath === '/' && path === '/') {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Get the current URL path.
 * @returns {string}
 */
export function getCurrentPath() {
    return window.location.pathname;
}

/**
 * Initialize the router.
 * Listens for popstate events and link clicks.
 */
export function initRouter() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        const path = getCurrentPath();
        navigate(path, { replace: true });
    });

    // Intercept clicks on internal links
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[href]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');

        // Skip external links, hash links, and special protocols
        if (!href ||
            href.startsWith('http') ||
            href.startsWith('//') ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            anchor.hasAttribute('target') ||
            anchor.hasAttribute('download')) {
            return;
        }

        // Internal navigation
        e.preventDefault();
        navigate(href);
    });
}

/**
 * Navigate to the current URL path (used during app boot).
 */
export function navigateToCurrentPath() {
    const path = getCurrentPath();
    // Strip /app prefix if present
    const cleanPath = path.replace(/^\/app/, '') || '/';
    navigate(cleanPath, { replace: true });
}

export default {
    navigate,
    initRouter,
    getCurrentPath,
    navigateToCurrentPath
};
