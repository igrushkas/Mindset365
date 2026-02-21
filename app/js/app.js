/**
 * Mindset365 - Main Application Bootstrap
 * Initializes the SPA: theme, authentication, layout rendering, and routing.
 */

import { setState, getState, subscribe } from './store.js';
import api from './api.js';
import { checkAuth, isAuthenticated, logout } from './auth.js';
import { navigate, initRouter, navigateToCurrentPath } from './router.js';
import { init as initTheme, toggle as toggleTheme, get as getTheme } from './theme.js';
import { getInitials, escapeHtml } from './utils.js';
import { showToast as _showToast } from './components/toast.js';

/**
 * Global showToast helper.
 * Supports both `showToast('message', 'type')` shorthand and `showToast({...})` object form.
 */
window.showToast = function(messageOrOpts, type) {
    if (typeof messageOrOpts === 'string') {
        _showToast({ message: messageOrOpts, type: type || 'info' });
    } else {
        _showToast(messageOrOpts);
    }
};

/**
 * SVG icon library.
 * Inline SVG icons used in the sidebar and topbar for zero-dependency rendering.
 */
const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    goals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    automations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    referrals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
    credits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'
};

/**
 * Sidebar navigation items configuration.
 * Items with ownerOnly: true are only visible to owner/admin users.
 */
const navItems = [
    { section: 'Main', items: [
        { label: 'Dashboard', icon: 'dashboard', path: '/' },
        { label: 'Goals', icon: 'goals', path: '/goals' },
        { label: 'Tasks', icon: 'tasks', path: '/tasks' },
    ]},
    { section: 'Manage', ownerOnly: true, items: [
        { label: 'Clients', icon: 'clients', path: '/clients' },
        { label: 'Templates', icon: 'templates', path: '/templates' },
        { label: 'Courses', icon: 'courses', path: '/courses' },
        { label: 'Content', icon: 'content', path: '/content' },
    ]},
    { section: 'Tools', items: [
        { label: 'AI Coach', icon: 'chat', path: '/chat' },
        { label: 'Credits', icon: 'credits', path: '/billing' },
    ]},
    { section: 'Admin', ownerOnly: true, items: [
        { label: 'Analytics', icon: 'analytics', path: '/analytics' },
        { label: 'Automations', icon: 'automations', path: '/automations' },
    ]},
    { section: '', items: [
        { label: 'Referrals', icon: 'referrals', path: '/referrals' },
        { label: 'Settings', icon: 'settings', path: '/settings' },
    ]}
];

/**
 * DEV_MODE: Set to true to bypass Google authentication and preview the UI.
 * Set back to false once Google OAuth and database are configured.
 */
const DEV_MODE = false;

/**
 * Application bootstrap.
 * Runs on DOMContentLoaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Step 1: Initialize theme immediately (prevents flash)
        initTheme();

        // Step 2: Initialize the router
        initRouter();

        if (DEV_MODE) {
            setState('user', {
                id: 1,
                name: 'Demo User',
                email: 'demo@moneymindset365.com',
                avatar_url: null,
                role: 'owner',
                onboarding_completed: false,
            });
            setState('workspace', { id: 1, name: 'My Workspace', slug: 'workspace-1' });
            renderAppLayout();
            navigateToCurrentPath();
            return;
        }

        // Step 3: Check authentication
        const authenticated = await checkAuth();

        if (authenticated) {
            renderAppLayout();
            navigateToCurrentPath();
        } else {
            renderAppLayout();
            navigate('/login', { replace: true });
        }
    } catch (err) {
        console.error('[App] Bootstrap failed:', err);
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;padding:2rem;text-align:center;font-family:sans-serif;">
                    <h2 style="color:#e74c3c;">Failed to load Mindset365</h2>
                    <pre style="color:#888;max-width:600px;white-space:pre-wrap;font-size:0.85rem;">${err.stack || err.message || err}</pre>
                    <button onclick="window.location.reload()" style="padding:10px 24px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Reload</button>
                </div>`;
        }
    }
});

/**
 * Render the full application layout: sidebar, topbar, and content area.
 * This replaces the contents of the #app element.
 */
export function renderAppLayout() {
    const app = document.getElementById('app');
    if (!app) {
        console.error('[App] #app element not found.');
        return;
    }

    // Always clear login-active class so sidebar/topbar are visible
    document.body.classList.remove('login-active');

    const user = getState('user');
    const sidebarOpen = getState('sidebarOpen');

    app.innerHTML = `
        <div class="app-layout">
            ${renderSidebar(user, sidebarOpen)}
            <div class="app-main">
                ${renderTopbar(user)}
                <div class="app-content">
                    <div id="page-content" class="page-enter"></div>
                </div>
            </div>
        </div>
        <div id="toast-container" class="toast-container"></div>
    `;

    // Attach event listeners
    bindSidebarEvents();
    bindTopbarEvents();

    // Subscribe to user changes for avatar updates
    subscribe('user', (newUser) => {
        updateUserDisplay(newUser);
    });

    // Subscribe to sidebar state
    subscribe('sidebarOpen', (isOpen) => {
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed', !isOpen);
        }
    });
}

/**
 * Render the sidebar HTML.
 *
 * @param {Object|null} user
 * @param {boolean} sidebarOpen
 * @returns {string} HTML string
 */
function renderSidebar(user, sidebarOpen) {
    const collapsedClass = sidebarOpen ? '' : 'collapsed';
    const userName = user?.name || 'User';
    const userRole = user?.role || 'Member';
    const userInitials = getInitials(userName);
    const userAvatar = user?.avatar
        ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(userName)}">`
        : escapeHtml(userInitials);

    const isOwner = user?.role === 'owner' || user?.role === 'admin';

    const navSectionsHTML = navItems
        .filter(section => !section.ownerOnly || isOwner)
        .map((section) => {
        const sectionTitle = section.section
            ? `<div class="nav-section-title">${escapeHtml(section.section)}</div>`
            : '';

        const itemsHTML = section.items.map((item) => `
            <div class="nav-item" data-path="${item.path}" role="button" tabindex="0">
                <span class="nav-icon">${icons[item.icon] || ''}</span>
                <span class="nav-label">${escapeHtml(item.label)}</span>
            </div>
        `).join('');

        return `<div class="nav-section">${sectionTitle}${itemsHTML}</div>`;
    }).join('');

    return `
        <aside class="app-sidebar ${collapsedClass}" id="app-sidebar">
            <div class="sidebar-logo">
                <div class="logo-icon">M</div>
                <div class="logo-text">Mindset<span>365</span></div>
            </div>
            <nav class="sidebar-nav">
                ${navSectionsHTML}
            </nav>
            <div class="sidebar-footer">
                <div class="sidebar-user" id="sidebar-user" role="button" tabindex="0">
                    <div class="avatar avatar-sm">${userAvatar}</div>
                    <div class="sidebar-user-info">
                        <div class="sidebar-user-name">${escapeHtml(userName)}</div>
                        <div class="sidebar-user-role">${escapeHtml(userRole)}</div>
                    </div>
                </div>
            </div>
        </aside>
    `;
}

/**
 * Render the topbar HTML.
 *
 * @param {Object|null} user
 * @returns {string} HTML string
 */
function renderTopbar(user) {
    const themeIcon = getTheme() === 'dark' ? icons.sun : icons.moon;

    return `
        <header class="app-topbar">
            <div class="topbar-left">
                <button class="topbar-toggle btn-icon" id="sidebar-toggle" aria-label="Toggle sidebar">
                    ${icons.menu}
                </button>
                <div class="topbar-search search-box">
                    <span class="search-icon">${icons.search}</span>
                    <input type="text" placeholder="Search anything..." id="global-search" autocomplete="off">
                </div>
            </div>
            <div class="topbar-right">
                <button class="topbar-icon-btn" id="theme-toggle" aria-label="Toggle theme" data-tip="Toggle theme">
                    ${themeIcon}
                </button>
                <button class="topbar-icon-btn" id="notifications-btn" aria-label="Notifications">
                    ${icons.bell}
                    <span class="notif-dot" id="notif-dot" style="display: none;"></span>
                </button>
                <div class="dropdown" id="user-dropdown">
                    <button class="topbar-icon-btn" id="user-menu-btn" aria-label="User menu">
                        <div class="avatar avatar-sm" id="topbar-avatar">
                            ${user?.avatar
                                ? `<img src="${escapeHtml(user.avatar)}" alt="">`
                                : escapeHtml(getInitials(user?.name || 'U'))
                            }
                        </div>
                    </button>
                    <div class="dropdown-menu" id="user-dropdown-menu">
                        <div class="dropdown-item" data-action="profile">
                            ${icons.clients}
                            <span>Profile</span>
                        </div>
                        <div class="dropdown-item" data-action="settings">
                            ${icons.settings}
                            <span>Settings</span>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-item danger" data-action="logout">
                            ${icons.logout}
                            <span>Log Out</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;
}

/**
 * Bind click events for sidebar navigation and collapse.
 */
function bindSidebarEvents() {
    // Nav item clicks
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    sidebar.addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item[data-path]');
        if (navItem) {
            const path = navItem.getAttribute('data-path');
            navigate(path);

            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Keyboard support for nav items
    sidebar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const navItem = e.target.closest('.nav-item[data-path]');
            if (navItem) {
                e.preventDefault();
                navItem.click();
            }
        }
    });
}

/**
 * Bind click events for topbar buttons.
 */
function bindTopbarEvents() {
    // Sidebar toggle (mobile)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.toggle('open');
            } else {
                const isOpen = !sidebar.classList.contains('collapsed');
                sidebar.classList.toggle('collapsed');
                setState('sidebarOpen', !isOpen);
            }
        });
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = toggleTheme();
            themeToggle.innerHTML = newTheme === 'dark' ? icons.sun : icons.moon;
        });
    }

    // Notifications button
    const notifBtn = document.getElementById('notifications-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            // Placeholder for notifications panel
            showToast('Notifications panel coming soon.', 'info');
        });
    }

    // User dropdown
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');

    if (userMenuBtn && userDropdownMenu) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#user-dropdown')) {
                userDropdownMenu.classList.remove('show');
            }
        });

        // Dropdown actions
        userDropdownMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item[data-action]');
            if (!item) return;

            const action = item.getAttribute('data-action');
            userDropdownMenu.classList.remove('show');

            switch (action) {
                case 'profile':
                    navigate('/settings');
                    break;
                case 'settings':
                    navigate('/settings');
                    break;
                case 'logout':
                    logout();
                    break;
            }
        });
    }

    // Global search
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = searchInput.value.trim();
                if (query.length > 2) {
                    document.dispatchEvent(
                        new CustomEvent('mindset365:search', { detail: { query } })
                    );
                }
            }, 400);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchInput.blur();
            }
        });
    }

    // Close sidebar overlay on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar?.classList.contains('open')) {
            if (!e.target.closest('.app-sidebar') && !e.target.closest('#sidebar-toggle')) {
                sidebar.classList.remove('open');
            }
        }
    });
}

/**
 * Update user display elements when user data changes.
 *
 * @param {Object|null} user
 */
function updateUserDisplay(user) {
    if (!user) return;

    const sidebarUserName = document.querySelector('.sidebar-user-name');
    const sidebarUserRole = document.querySelector('.sidebar-user-role');
    const sidebarAvatar = document.querySelector('.sidebar-user .avatar');
    const topbarAvatar = document.getElementById('topbar-avatar');

    if (sidebarUserName) sidebarUserName.textContent = user.name || 'User';
    if (sidebarUserRole) sidebarUserRole.textContent = user.role || 'Member';

    const initials = getInitials(user.name || 'U');
    const avatarContent = user.avatar
        ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name || '')}">`
        : escapeHtml(initials);

    if (sidebarAvatar) sidebarAvatar.innerHTML = avatarContent;
    if (topbarAvatar) topbarAvatar.innerHTML = avatarContent;
}

/**
 * Show a toast notification.
 *
 * @param {string} message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {number} duration - auto-dismiss duration in ms
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastIcons = {
        success: '<span style="color: var(--color-success);">&#10003;</span>',
        error: '<span style="color: var(--color-danger);">&#10007;</span>',
        warning: '<span style="color: var(--color-warning);">&#9888;</span>',
        info: '<span style="color: var(--color-info);">&#8505;</span>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${toastIcons[type] || toastIcons.info}</div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    container.appendChild(toast);

    // Auto-dismiss
    if (duration > 0) {
        setTimeout(() => {
            dismissToast(toast);
        }, duration);
    }
}

/**
 * Dismiss a toast element with animation.
 *
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'fadeOut 200ms ease forwards';
    setTimeout(() => {
        toast.remove();
    }, 200);
}

// Expose globally for use from page modules
window.showToast = showToast;
window.renderAppLayout = renderAppLayout;

export default {
    renderAppLayout,
    showToast
};
