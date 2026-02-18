// topbar.js - Top bar / header component
import { store } from '../store.js';
import { navigate } from '../router.js';
import { api } from '../api.js';

const ICONS = {
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    settingsSmall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="6 9 12 15 18 9"/></svg>`
};

/**
 * Renders the topbar HTML string.
 * Includes mobile menu toggle, search, notifications, theme toggle, and user dropdown.
 * @returns {string} Topbar HTML
 */
export function renderTopbar() {
    const state = store.getState();
    const user = state.user || {};
    const theme = state.theme || 'dark';
    const hasUnread = state.unreadNotifications > 0;
    const userName = user.name || 'User';
    const userInitial = userName.charAt(0).toUpperCase();
    const isDark = theme === 'dark';

    return `
        <header class="app-topbar" id="app-topbar">
            <div class="topbar-left">
                <button class="topbar-toggle btn-icon" id="topbar-menu-toggle" aria-label="Toggle menu">
                    ${ICONS.menu}
                </button>
                <div class="topbar-search search-box">
                    ${ICONS.search}
                    <input type="text" id="topbar-search-input" placeholder="Search anything..." aria-label="Search" />
                </div>
            </div>

            <div class="topbar-right">
                <button class="topbar-icon-btn" id="topbar-notifications-btn" aria-label="Notifications">
                    ${ICONS.bell}
                    ${hasUnread ? '<span class="notif-dot"></span>' : ''}
                </button>

                <button class="topbar-icon-btn" id="topbar-theme-toggle" aria-label="Toggle theme">
                    ${isDark ? ICONS.sun : ICONS.moon}
                </button>

                <div class="dropdown" id="topbar-user-dropdown">
                    <button class="topbar-icon-btn flex items-center gap-2" id="topbar-user-btn" aria-label="User menu">
                        <div class="avatar avatar-sm">${user.avatar ? `<img src="${user.avatar}" alt="${userName}">` : userInitial}</div>
                        <span class="hide-mobile text-sm font-medium">${userName}</span>
                        ${ICONS.chevronDown}
                    </button>
                    <div class="dropdown-menu" id="topbar-user-menu">
                        <div class="dropdown-item" data-action="profile">
                            ${ICONS.user}
                            <span>Profile</span>
                        </div>
                        <div class="dropdown-item" data-action="settings">
                            ${ICONS.settingsSmall}
                            <span>Settings</span>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-item danger" data-action="logout">
                            ${ICONS.logout}
                            <span>Log out</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>`;
}

/**
 * Initializes topbar event handlers.
 * Handles mobile menu toggle, search, notifications, theme switch, and user dropdown.
 */
export function initTopbar() {
    const topbar = document.getElementById('app-topbar');
    if (!topbar) return;

    // Mobile menu toggle
    const menuToggle = document.getElementById('topbar-menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('app-sidebar');
            if (!sidebar) return;

            const isOpen = sidebar.classList.toggle('open');

            // Manage overlay
            let overlay = document.getElementById('sidebar-overlay');
            if (isOpen && !overlay) {
                overlay = document.createElement('div');
                overlay.id = 'sidebar-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;';
                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                    overlay.remove();
                });
                document.body.appendChild(overlay);
            } else if (!isOpen && overlay) {
                overlay.remove();
            }
        });
    }

    // Search input — debounced search
    const searchInput = document.getElementById('topbar-search-input');
    if (searchInput) {
        let searchTimeout = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    store.setState({ searchQuery: query });
                    document.dispatchEvent(new CustomEvent('app:search', { detail: { query } }));
                }
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchInput.blur();
                store.setState({ searchQuery: '' });
            }
        });
    }

    // Notifications button
    const notifBtn = document.getElementById('topbar-notifications-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('app:notifications-open'));
        });
    }

    // Theme toggle
    const themeToggle = document.getElementById('topbar-theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const state = store.getState();
            const currentTheme = state.theme || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            store.setState({ theme: newTheme });

            // Update the icon
            themeToggle.innerHTML = newTheme === 'dark' ? ICONS.sun : ICONS.moon;

            // Persist preference
            try {
                localStorage.setItem('mindset365-theme', newTheme);
            } catch (_) {
                // localStorage may be unavailable
            }
        });
    }

    // User dropdown
    const userBtn = document.getElementById('topbar-user-btn');
    const userMenu = document.getElementById('topbar-user-menu');
    if (userBtn && userMenu) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#topbar-user-dropdown')) {
                userMenu.classList.remove('show');
            }
        });

        // Dropdown actions
        userMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (!item) return;

            const action = item.dataset.action;
            userMenu.classList.remove('show');

            switch (action) {
                case 'profile':
                    navigate('settings');
                    break;
                case 'settings':
                    navigate('settings');
                    break;
                case 'logout':
                    document.dispatchEvent(new CustomEvent('app:logout'));
                    break;
            }
        });
    }

    // Global keyboard shortcut: Ctrl/Cmd + K to focus search
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });
}
