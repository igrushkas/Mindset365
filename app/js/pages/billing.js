/**
 * Mindset365 - Billing / Credits Page
 * Credit balance, package purchase, and transaction history.
 */

import api from '../api.js';
import { getState } from '../store.js';
import { navigate } from '../router.js';
import { formatDate, escapeHtml } from '../utils.js';

/**
 * Render the billing page.
 * @param {HTMLElement} container
 */
export async function render(container) {
    const user = getState('user');
    const isOwner = user?.role === 'owner';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>AI Credits</h1>
                <p class="text-muted">Purchase credits to use the AI Coaching assistant</p>
            </div>

            <!-- Credit Balance Card -->
            <div class="card mb-6" id="balance-card">
                <div class="card-body" style="text-align: center; padding: var(--sp-8);">
                    ${isOwner ? `
                        <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">&#9854;</div>
                        <h2 style="margin-bottom: var(--sp-2);">Unlimited AI Access</h2>
                        <p class="text-muted">As the account owner, you have unlimited AI coaching credits.</p>
                    ` : `
                        <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">&#129302;</div>
                        <div class="text-xs text-muted mb-2">Your Credit Balance</div>
                        <div id="credit-balance" style="font-size: 3rem; font-weight: 800; color: var(--color-primary);">...</div>
                        <div class="text-sm text-muted" id="credit-subtitle">Loading...</div>
                    `}
                </div>
            </div>

            ${!isOwner ? `
            <!-- Credit Packages -->
            <h2 class="mb-4">Buy Credits</h2>
            <p class="text-muted text-sm mb-4">Each AI coaching message costs 1 credit. Choose a package below.</p>
            <div class="grid grid-3 mb-6" id="packages-grid">
                <div class="card skeleton-card" style="height: 240px;"></div>
                <div class="card skeleton-card" style="height: 240px;"></div>
                <div class="card skeleton-card" style="height: 240px;"></div>
            </div>
            ` : ''}

            <!-- Transaction History -->
            <div class="card">
                <div class="card-header">
                    <h3>Transaction History</h3>
                </div>
                <div class="card-body" id="transaction-history">
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                </div>
            </div>
        </div>
    `;

    // Load data in parallel
    const [balanceRes, packagesRes, transactionsRes] = await Promise.allSettled([
        api.get('/billing/credits'),
        !isOwner ? api.get('/billing/packages') : Promise.resolve([]),
        api.get('/billing/transactions'),
    ]);

    // Render balance
    if (!isOwner && balanceRes.status === 'fulfilled') {
        const balance = balanceRes.value;
        const balanceEl = container.querySelector('#credit-balance');
        const subtitleEl = container.querySelector('#credit-subtitle');
        if (balanceEl) balanceEl.textContent = balance.credits_balance ?? 0;
        if (subtitleEl) {
            subtitleEl.textContent = `${balance.lifetime_purchased ?? 0} purchased  |  ${balance.lifetime_used ?? 0} used`;
        }
    }

    // Render packages
    if (!isOwner && packagesRes.status === 'fulfilled') {
        const packages = packagesRes.value;
        renderPackages(container, Array.isArray(packages) ? packages : []);
    }

    // Render transactions
    if (transactionsRes.status === 'fulfilled') {
        const data = transactionsRes.value;
        const items = data?.items || (Array.isArray(data) ? data : []);
        renderTransactions(container, Array.isArray(items) ? items : []);
    }
}

/**
 * Render credit packages grid.
 */
function renderPackages(container, packages) {
    const grid = container.querySelector('#packages-grid');
    if (!grid || packages.length === 0) return;

    grid.innerHTML = packages.map(pkg => {
        const isFeatured = !!pkg.badge;
        return `
        <div class="card hover-lift"
             style="${isFeatured ? 'border: 2px solid var(--color-primary); box-shadow: 0 0 24px rgba(108, 92, 231, 0.15);' : ''}">
            <div class="card-body" style="text-align: center; padding: var(--sp-6);">
                ${isFeatured ? `<div class="badge badge-primary" style="margin-bottom: var(--sp-3);">${escapeHtml(pkg.badge)}</div>` : '<div style="height: 30px;"></div>'}
                <h3 style="margin-bottom: var(--sp-2);">${escapeHtml(pkg.name)}</h3>
                <div style="font-size: 2rem; font-weight: 800; color: var(--text-primary);">
                    $${pkg.price.toFixed(2)}
                </div>
                <div class="text-muted text-sm" style="margin-bottom: var(--sp-2);">${pkg.credits} credits</div>
                <div class="text-xs text-muted" style="margin-bottom: var(--sp-4);">
                    $${pkg.price_per_credit.toFixed(3)} per message
                </div>
                <button class="btn ${isFeatured ? 'btn-primary' : 'btn-secondary'} w-full buy-package-btn" data-package="${escapeHtml(pkg.key)}" data-name="${escapeHtml(pkg.name)}">
                    Buy ${escapeHtml(pkg.name)}
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Buy button handlers
    grid.querySelectorAll('.buy-package-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const packageKey = btn.dataset.package;
            const packageName = btn.dataset.name;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Creating checkout...';
            try {
                const res = await api.post('/billing/checkout', { package: packageKey });
                const checkoutUrl = res?.checkout_url;
                if (checkoutUrl) {
                    window.open(checkoutUrl, '_blank');
                    btn.textContent = 'Checkout opened...';
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }, 3000);
                } else {
                    window.showToast?.('Payment provider not configured yet. Contact the administrator.', 'warning');
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            } catch (err) {
                window.showToast?.(err.message || 'Checkout failed.', 'error');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });
}

/**
 * Render transaction history table.
 */
function renderTransactions(container, transactions) {
    const historyEl = container.querySelector('#transaction-history');
    if (!historyEl) return;

    if (transactions.length === 0) {
        historyEl.innerHTML = `
            <div class="empty-state" style="padding: var(--sp-8);">
                <div class="empty-state-icon">&#128179;</div>
                <h3>No transactions yet</h3>
                <p class="text-sm text-muted">Your credit purchases and AI usage will appear here.</p>
            </div>
        `;
        return;
    }

    const typeLabels = {
        purchase: 'Purchase',
        usage: 'AI Chat',
        bonus: 'Bonus',
        refund: 'Refund',
        trial: 'Trial'
    };
    const typeBadgeClass = {
        purchase: 'badge-success',
        usage: '',
        bonus: 'badge-info',
        refund: 'badge-warning',
        trial: 'badge-info'
    };

    historyEl.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th style="text-align: right;">Credits</th>
                        <th style="text-align: right;">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => {
                        const isPositive = t.amount > 0;
                        return `
                            <tr>
                                <td class="text-sm text-muted">${formatDate(t.created_at, 'datetime')}</td>
                                <td><span class="badge ${typeBadgeClass[t.type] || 'badge-neutral'}">${typeLabels[t.type] || t.type}</span></td>
                                <td class="text-sm">${escapeHtml(t.description || '')}</td>
                                <td style="text-align: right; font-weight: 600; color: ${isPositive ? 'var(--color-success)' : 'var(--text-secondary)'};">
                                    ${isPositive ? '+' : ''}${t.amount}
                                </td>
                                <td class="text-sm" style="text-align: right;">${t.balance_after}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}
