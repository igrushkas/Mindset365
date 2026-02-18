// sidebar.js - Sidebar navigation component
import { store } from '../store.js';
import { navigate } from '../router.js';

const ICONS = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>`,
    clients: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    aicoach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    courses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    content: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    automations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>`,
    collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`
};

const NAV_SECTIONS = [
    {
        title: 'MAIN',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            { id: 'goals', label: 'Goals', icon: 'goals' },
            { id: 'tasks', label: 'Tasks', icon: 'tasks', badge: null },
            { id: 'clients', label: 'Clients', icon: 'clients' }
        ]
    },
    {
        title: 'GROW',
        items: [
            { id: 'ai-coach', label: 'AI Coach', icon: 'aicoach' },
            { id: 'courses', label: 'Courses', icon: 'courses' },
            { id: 'content', label: 'Content', icon: 'content' }
        ]
    },
    {
        title: 'ANALYZE',
        items: [
            { id: 'analytics', label: 'Analytics', icon: 'analytics' },
            { id: 'automations', label: 'Automations', icon: 'automations' }
        ]
    },
    {
        title: 'ACCOUNT',
        items: [
            { id: 'settings', label: 'Settings', icon: 'settings' }
        ]
    }
];

/**
 * Renders the sidebar HTML.
 * Reads active page from store and user data for the user info section.
 * @returns {string} Sidebar HTML string
 */
export function renderSidebar() {
    const state = store.getState();
    const activePage = state.activePage || 'dashboard';
    const user = state.user || {};
    const collapsed = state.sidebarCollapsed || false;
    const userName = user.name || 'User';
    const userRole = user.role || 'Member';
    const userInitial = userName.charAt(0).toUpperCase();

    const navHTML = NAV_SECTIONS.map(section => {
        const itemsHTML = section.items.map(item => {
            const isActive = activePage === item.id;
            const badgeCount = item.badge != null ? item.badge : (state.badges && state.badges[item.id]);
            const badgeHTML = badgeCount ? `<span class="nav-badge">${badgeCount}</span>` : '';

            return `
                <div class="nav-item${isActive ? ' active' : ''}" data-page="${item.id}">
                    <span class="nav-icon">${ICONS[item.icon]}</span>
                    <span class="nav-label">${item.label}</span>
                    ${badgeHTML}
                </div>`;
        }).join('');

        return `
            <div class="nav-section">
                <div class="nav-section-title">${section.title}</div>
                ${itemsHTML}
            </div>`;
    }).join('');

    return `
        <aside class="app-sidebar${collapsed ? ' collapsed' : ''}" id="app-sidebar">
            <div class="sidebar-logo">
                <div class="logo-icon">M</div>
                <div class="logo-text">Mindset<span>365</span></div>
            </div>

            <nav class="sidebar-nav">
                ${navHTML}
            </nav>

            <div class="sidebar-footer">
                <div class="nav-item sidebar-collapse-btn" id="sidebar-collapse-btn" data-tip="Toggle sidebar">
                    <span class="nav-icon">${collapsed ? ICONS.expand : ICONS.collapse}</span>
                    <span class="nav-label">Collapse</span>
                </div>
                <div class="sidebar-user" id="sidebar-user">
                    <div class="avatar avatar-sm">${user.avatar ? `<img src="${user.avatar}" alt="${userName}">` : userInitial}</div>
                    <div class="sidebar-user-info">
                        <div class="sidebar-user-name">${userName}</div>
                        <div class="sidebar-user-role">${userRole}</div>
                    </div>
                </div>
            </div>
        </aside>`;
}

/**
 * Initializes sidebar event handlers.
 * Attaches click listeners for navigation, collapse toggle, and user info.
 */
export function initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    // Navigation click handler — delegate from sidebar-nav
    const navEl = sidebar.querySelector('.sidebar-nav');
    if (navEl) {
        navEl.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;

            const page = navItem.dataset.page;
            if (!page) return;

            // Update active state in DOM immediately for responsiveness
            navEl.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            navItem.classList.add('active');

            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
                const overlay = document.getElementById('sidebar-overlay');
                if (overlay) overlay.remove();
            }

            navigate(page);
        });
    }

    // Collapse toggle
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            store.setState({ sidebarCollapsed: isCollapsed });

            // Update the collapse icon
            const iconSpan = collapseBtn.querySelector('.nav-icon');
            if (iconSpan) {
                iconSpan.innerHTML = isCollapsed ? ICONS.expand : ICONS.collapse;
            }

            // Update the label
            const labelSpan = collapseBtn.querySelector('.nav-label');
            if (labelSpan) {
                labelSpan.textContent = isCollapsed ? 'Expand' : 'Collapse';
            }
        });
    }

    // User info click — navigate to settings or show profile
    const userEl = document.getElementById('sidebar-user');
    if (userEl) {
        userEl.addEventListener('click', () => {
            navigate('settings');
        });
    }
}
