/**
 * Mindset365 - Settings Page
 * Profile, workspace, theme, referral, API keys, and notification preferences.
 */

import api from '../api.js';
import { getState, setState } from '../store.js';
import { getInitials } from '../utils.js';

/**
 * Common timezone list for the timezone selector.
 */
const TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland'
];

/**
 * Render the settings page.
 * @param {HTMLElement} container
 */
export async function render(container) {
    const user = getState('user');
    const workspace = getState('workspace');
    const theme = getState('theme') || 'dark';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Settings</h1>
            </div>

            <div style="max-width: 800px;">
                <!-- Profile Section -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>Profile</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex items-center gap-4 mb-6">
                            <div class="avatar avatar-xl" id="settings-avatar">
                                ${user?.avatar_url
                                    ? `<img src="${user.avatar_url}" alt="${user.name}">`
                                    : getInitials(user?.name || 'U')
                                }
                            </div>
                            <div>
                                <div class="font-semibold">${user?.name || 'User'}</div>
                                <div class="text-sm text-muted">${user?.email || ''}</div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Full Name</label>
                                <input type="text" id="profile-name" value="${user?.name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="profile-email" value="${user?.email || ''}" disabled>
                                <span class="form-help">Email cannot be changed (linked to Google account).</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Timezone</label>
                            <select id="profile-timezone">
                                ${TIMEZONES.map(tz => `
                                    <option value="${tz}" ${(user?.timezone || 'America/New_York') === tz ? 'selected' : ''}>${tz.replace(/_/g, ' ')}</option>
                                `).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary" id="save-profile-btn">Save Profile</button>
                    </div>
                </div>

                <!-- Workspace Section -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>Workspace</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Workspace Name</label>
                            <input type="text" id="workspace-name" value="${workspace?.name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="workspace-desc" rows="2">${workspace?.description || ''}</textarea>
                        </div>
                        <button class="btn btn-primary" id="save-workspace-btn">Save Workspace</button>
                    </div>
                </div>

                <!-- Theme Section -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>Appearance</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-medium">Theme</div>
                                <div class="text-sm text-muted">Choose between dark and light mode.</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm ${theme === 'dark' ? 'text-primary' : 'text-muted'}">Dark</span>
                                <label class="toggle">
                                    <input type="checkbox" id="theme-toggle" ${theme === 'light' ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                                <span class="text-sm ${theme === 'light' ? 'text-primary' : 'text-muted'}">Light</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Referral Section -->
                <div class="card referral-card mb-6">
                    <div class="card-header">
                        <h3>Referral Program</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-sm text-secondary mb-4">Share your unique referral link and earn rewards when friends sign up!</p>
                        <div class="referral-link mb-4">
                            <input type="text" id="referral-link" value="${user?.referral_code ? `https://moneymindset365.com/ref/${user.referral_code}` : 'Loading...'}" readonly>
                            <button class="btn btn-primary" id="copy-referral-btn">Copy</button>
                        </div>
                        <div class="referral-stats" id="referral-stats">
                            <div class="referral-stat">
                                <div class="referral-stat-value" id="ref-sent">--</div>
                                <div class="referral-stat-label">Invites Sent</div>
                            </div>
                            <div class="referral-stat">
                                <div class="referral-stat-value" id="ref-signups">--</div>
                                <div class="referral-stat-label">Signed Up</div>
                            </div>
                            <div class="referral-stat">
                                <div class="referral-stat-value" id="ref-rewards">--</div>
                                <div class="referral-stat-label">Rewards Earned</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- API Keys Section -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>AI Configuration</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <div class="font-medium">OpenAI API Key</div>
                                <div class="text-sm text-muted">Used for AI coach features. Status shown below.</div>
                            </div>
                            <span class="badge" id="api-key-status">
                                <span class="status-dot status-inactive"></span>
                                Checking...
                            </span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">API Key</label>
                            <div class="flex gap-2">
                                <input type="password" id="openai-key" placeholder="sk-..." style="flex: 1;">
                                <button class="btn btn-ghost btn-sm" id="toggle-key-vis">Show</button>
                            </div>
                            <span class="form-help">Your key is encrypted and stored securely. We never share it.</span>
                        </div>
                        <button class="btn btn-secondary" id="save-api-key-btn">Update API Key</button>
                    </div>
                </div>

                <!-- Notification Preferences -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>Notification Preferences</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            ${renderNotifToggle('notif-email-goals', 'Goal Reminders', 'Receive email reminders for goal check-ins.', true)}
                            ${renderNotifToggle('notif-email-tasks', 'Task Due Dates', 'Email notifications when tasks are due.', true)}
                            ${renderNotifToggle('notif-email-sessions', 'Session Reminders', 'Get notified before coaching sessions.', true)}
                            ${renderNotifToggle('notif-email-reports', 'Weekly Reports', 'Receive weekly progress summary emails.', false)}
                            ${renderNotifToggle('notif-push', 'Push Notifications', 'Browser push notifications for important events.', false)}
                        </div>
                        <button class="btn btn-primary mt-6" id="save-notif-btn">Save Preferences</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- Event Handlers ---

    // Save profile
    container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#save-profile-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            const res = await api.put('/users/me', {
                name: container.querySelector('#profile-name')?.value?.trim(),
                timezone: container.querySelector('#profile-timezone')?.value
            });
            const updatedUser = res?.data || res;
            if (updatedUser) {
                setState('user', { ...user, ...updatedUser });
            }
            showToast('Profile updated successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to update profile.', 'error');
        }

        btn.innerHTML = 'Save Profile';
        btn.disabled = false;
    });

    // Save workspace
    container.querySelector('#save-workspace-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#save-workspace-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            const res = await api.put('/workspaces/current', {
                name: container.querySelector('#workspace-name')?.value?.trim(),
                description: container.querySelector('#workspace-desc')?.value?.trim()
            });
            const updatedWs = res?.data || res;
            if (updatedWs) {
                setState('workspace', { ...workspace, ...updatedWs });
            }
            showToast('Workspace updated!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to update workspace.', 'error');
        }

        btn.innerHTML = 'Save Workspace';
        btn.disabled = false;
    });

    // Theme toggle
    container.querySelector('#theme-toggle')?.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'light' : 'dark';
        setState('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    });

    // Copy referral link
    container.querySelector('#copy-referral-btn')?.addEventListener('click', () => {
        const input = container.querySelector('#referral-link');
        if (input) {
            navigator.clipboard.writeText(input.value).then(() => {
                showToast('Referral link copied to clipboard!', 'success');
            }).catch(() => {
                input.select();
                document.execCommand('copy');
                showToast('Referral link copied!', 'success');
            });
        }
    });

    // Toggle API key visibility
    container.querySelector('#toggle-key-vis')?.addEventListener('click', () => {
        const input = container.querySelector('#openai-key');
        const btn = container.querySelector('#toggle-key-vis');
        if (input && btn) {
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        }
    });

    // Save API key
    container.querySelector('#save-api-key-btn')?.addEventListener('click', async () => {
        const key = container.querySelector('#openai-key')?.value?.trim();
        if (!key) {
            showToast('Please enter an API key.', 'warning');
            return;
        }

        const btn = container.querySelector('#save-api-key-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        try {
            await api.put('/settings/api-keys', { openai_key: key });
            showToast('API key updated!', 'success');
            container.querySelector('#openai-key').value = '';
            checkApiKeyStatus(container);
        } catch (err) {
            showToast(err.message || 'Failed to update API key.', 'error');
        }

        btn.innerHTML = 'Update API Key';
        btn.disabled = false;
    });

    // Save notification preferences
    container.querySelector('#save-notif-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#save-notif-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        btn.disabled = true;

        const prefs = {
            email_goals: container.querySelector('#notif-email-goals')?.checked ?? true,
            email_tasks: container.querySelector('#notif-email-tasks')?.checked ?? true,
            email_sessions: container.querySelector('#notif-email-sessions')?.checked ?? true,
            email_reports: container.querySelector('#notif-email-reports')?.checked ?? false,
            push_enabled: container.querySelector('#notif-push')?.checked ?? false
        };

        try {
            await api.put('/settings/notifications', prefs);
            showToast('Notification preferences saved!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to save notification preferences.', 'error');
        }

        btn.innerHTML = 'Save Preferences';
        btn.disabled = false;
    });

    // Load referral stats
    loadReferralStats(container);

    // Check API key status
    checkApiKeyStatus(container);

    // Load notification preferences
    loadNotificationPrefs(container);
}

/**
 * Render a notification toggle row.
 * @param {string} id
 * @param {string} title
 * @param {string} description
 * @param {boolean} defaultChecked
 * @returns {string} HTML string
 */
function renderNotifToggle(id, title, description, defaultChecked) {
    return `
        <div class="flex items-center justify-between">
            <div>
                <div class="font-medium text-sm">${title}</div>
                <div class="text-xs text-muted">${description}</div>
            </div>
            <label class="toggle">
                <input type="checkbox" id="${id}" ${defaultChecked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
    `;
}

/**
 * Load referral stats from API.
 * @param {HTMLElement} container
 */
async function loadReferralStats(container) {
    try {
        const res = await api.get('/referrals/stats');
        const stats = res?.data || res || {};

        const sentEl = container.querySelector('#ref-sent');
        const signupsEl = container.querySelector('#ref-signups');
        const rewardsEl = container.querySelector('#ref-rewards');

        if (sentEl) sentEl.textContent = stats.sent ?? stats.invites_sent ?? 0;
        if (signupsEl) signupsEl.textContent = stats.signed_up ?? stats.signups ?? 0;
        if (rewardsEl) rewardsEl.textContent = stats.rewards_earned ?? stats.rewards ?? 0;
    } catch {
        // Silently fail - referral stats are not critical
    }

    // Also load referral code if not already set
    const user = getState('user');
    if (!user?.referral_code) {
        try {
            const res = await api.get('/referrals/code');
            const code = res?.data?.code || res?.code;
            if (code) {
                const linkInput = container.querySelector('#referral-link');
                if (linkInput) linkInput.value = `https://moneymindset365.com/ref/${code}`;
            }
        } catch {
            const linkInput = container.querySelector('#referral-link');
            if (linkInput) linkInput.value = 'Failed to load referral link.';
        }
    }
}

/**
 * Check and display API key status.
 * @param {HTMLElement} container
 */
async function checkApiKeyStatus(container) {
    const statusEl = container.querySelector('#api-key-status');
    if (!statusEl) return;

    try {
        const res = await api.get('/settings/api-keys/status');
        const hasKey = res?.data?.openai_configured ?? res?.openai_configured ?? false;

        if (hasKey) {
            statusEl.innerHTML = '<span class="status-dot status-active"></span> Configured';
            statusEl.className = 'badge badge-success';
        } else {
            statusEl.innerHTML = '<span class="status-dot status-inactive"></span> Not Set';
            statusEl.className = 'badge badge-neutral';
        }
    } catch {
        statusEl.innerHTML = '<span class="status-dot status-inactive"></span> Unknown';
        statusEl.className = 'badge badge-neutral';
    }
}

/**
 * Load notification preferences and update toggle states.
 * @param {HTMLElement} container
 */
async function loadNotificationPrefs(container) {
    try {
        const res = await api.get('/settings/notifications');
        const prefs = res?.data || res || {};

        const setCheck = (id, value) => {
            const el = container.querySelector(`#${id}`);
            if (el && value !== undefined) el.checked = !!value;
        };

        setCheck('notif-email-goals', prefs.email_goals);
        setCheck('notif-email-tasks', prefs.email_tasks);
        setCheck('notif-email-sessions', prefs.email_sessions);
        setCheck('notif-email-reports', prefs.email_reports);
        setCheck('notif-push', prefs.push_enabled);
    } catch {
        // Use defaults if fetch fails
    }
}
