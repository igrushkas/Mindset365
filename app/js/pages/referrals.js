/**
 * Mindset365 - Referrals Page
 * Referral dashboard with unique link, stats, and tracking.
 * Reward: 1 year free AI coaching for each successful referral.
 */
import api from '../api.js';
import { getState } from '../store.js';
import { escapeHtml, formatDate, formatNumber } from '../utils.js';

export async function render(container) {
    const user = getState('user');

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1>Referrals</h1>
                <span class="text-muted">Earn 1 year free AI coaching for every client you refer</span>
            </div>

            <div class="referral-hero card mb-6">
                <div class="card-body" style="text-align:center; padding: var(--sp-8) var(--sp-6);">
                    <div style="font-size:3rem; margin-bottom:var(--sp-2);">&#127873;</div>
                    <h2 style="margin-bottom:var(--sp-2);">Share. Grow. Earn.</h2>
                    <p class="text-muted" style="max-width:500px; margin:0 auto var(--sp-6);">
                        For every client that signs up using your referral link, you get <strong>1 full year of free AI coaching</strong>. They get a better coach. You get a smarter business.
                    </p>
                    <div class="referral-link-box" id="referral-link-box">
                        <div class="flex items-center gap-2" style="justify-content:center;">
                            <input type="text" id="referral-link" class="referral-link-input" readonly value="Loading...">
                            <button class="btn btn-primary" id="copy-link-btn">Copy Link</button>
                        </div>
                        <p class="text-sm text-muted mt-2" id="copy-feedback"></p>
                    </div>
                </div>
            </div>

            <div class="grid grid-4 mb-6" id="referral-stats">
                <div class="card hover-lift">
                    <div class="card-body" style="text-align:center;">
                        <div class="stat-value" id="stat-clicks">-</div>
                        <div class="stat-label">Link Clicks</div>
                    </div>
                </div>
                <div class="card hover-lift">
                    <div class="card-body" style="text-align:center;">
                        <div class="stat-value" id="stat-signups">-</div>
                        <div class="stat-label">Sign-ups</div>
                    </div>
                </div>
                <div class="card hover-lift">
                    <div class="card-body" style="text-align:center;">
                        <div class="stat-value" id="stat-conversion">-</div>
                        <div class="stat-label">Conversion Rate</div>
                    </div>
                </div>
                <div class="card hover-lift">
                    <div class="card-body" style="text-align:center;">
                        <div class="stat-value" id="stat-reward">-</div>
                        <div class="stat-label">Years Earned</div>
                    </div>
                </div>
            </div>

            <div class="grid grid-2 mb-6">
                <div class="card">
                    <div class="card-header">
                        <h3>Share Your Link</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            <button class="btn btn-secondary share-btn" data-method="email" style="width:100%; justify-content:flex-start; gap:var(--sp-3);">
                                <span style="font-size:1.25rem;">&#9993;</span>
                                Share via Email
                            </button>
                            <button class="btn btn-secondary share-btn" data-method="whatsapp" style="width:100%; justify-content:flex-start; gap:var(--sp-3);">
                                <span style="font-size:1.25rem;">&#128172;</span>
                                Share on WhatsApp
                            </button>
                            <button class="btn btn-secondary share-btn" data-method="twitter" style="width:100%; justify-content:flex-start; gap:var(--sp-3);">
                                <span style="font-size:1.25rem;">&#128038;</span>
                                Share on X / Twitter
                            </button>
                            <button class="btn btn-secondary share-btn" data-method="linkedin" style="width:100%; justify-content:flex-start; gap:var(--sp-3);">
                                <span style="font-size:1.25rem;">&#128188;</span>
                                Share on LinkedIn
                            </button>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3>How It Works</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            <div class="flex items-center gap-4">
                                <div class="step-number">1</div>
                                <div>
                                    <strong>Share your unique link</strong>
                                    <p class="text-sm text-muted">Send it to potential clients via any channel</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="step-number">2</div>
                                <div>
                                    <strong>They sign up & start coaching</strong>
                                    <p class="text-sm text-muted">Your referral link tracks them automatically</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="step-number">3</div>
                                <div>
                                    <strong>You earn free AI coaching</strong>
                                    <p class="text-sm text-muted">1 full year of AI coach access per sign-up</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Referral History</h3>
                </div>
                <div class="card-body" id="referral-history">
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128279;</div>
                        <h3>No referrals yet</h3>
                        <p>Share your link to start earning rewards.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load referral data
    let referralCode = '';
    try {
        const res = await api.get('/referrals/me');
        const data = res?.data || res || {};

        referralCode = data.referral_code || user?.referral_code || '';
        const link = referralCode
            ? `${window.location.origin}/?ref=${referralCode}`
            : 'Sign in to get your referral link';

        const linkInput = container.querySelector('#referral-link');
        if (linkInput) linkInput.value = link;

        // Stats
        const clicks = data.total_clicks || 0;
        const signups = data.total_signups || 0;
        const conversion = clicks > 0 ? ((signups / clicks) * 100).toFixed(1) : '0';
        const yearsEarned = signups;

        const setEl = (id, val) => {
            const el = container.querySelector(`#${id}`);
            if (el) el.textContent = val;
        };

        setEl('stat-clicks', formatNumber(clicks));
        setEl('stat-signups', formatNumber(signups));
        setEl('stat-conversion', `${conversion}%`);
        setEl('stat-reward', `${yearsEarned} yr${yearsEarned !== 1 ? 's' : ''}`);

        // Referral history
        const referrals = data.referrals || [];
        if (referrals.length > 0) {
            const historyEl = container.querySelector('#referral-history');
            historyEl.innerHTML = `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Signed Up</th>
                                <th>Reward</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${referrals.map(r => `
                                <tr>
                                    <td class="font-medium">${escapeHtml(r.name || 'Unknown')}</td>
                                    <td class="text-sm text-muted">${escapeHtml(r.email || '')}</td>
                                    <td>
                                        <span class="badge ${r.status === 'converted' ? 'badge-success' : 'badge-warning'}">
                                            ${escapeHtml(r.status === 'converted' ? 'Signed Up' : 'Clicked')}
                                        </span>
                                    </td>
                                    <td class="text-sm text-muted">${r.created_at ? formatDate(r.created_at) : '-'}</td>
                                    <td>
                                        ${r.status === 'converted'
                                            ? '<span class="badge badge-success">1 Year Free</span>'
                                            : '<span class="text-sm text-muted">Pending</span>'
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

    } catch (err) {
        // API not available - show placeholder
        const linkInput = container.querySelector('#referral-link');
        if (linkInput) {
            const fallbackCode = user?.id ? `ref-${user.id}` : 'demo';
            linkInput.value = `${window.location.origin}/?ref=${fallbackCode}`;
        }
    }

    // Copy link button
    const copyBtn = container.querySelector('#copy-link-btn');
    const linkInput = container.querySelector('#referral-link');
    const copyFeedback = container.querySelector('#copy-feedback');

    if (copyBtn && linkInput) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(linkInput.value);
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('btn-success');
                if (copyFeedback) copyFeedback.textContent = 'Link copied to clipboard';
                window.showToast?.('Referral link copied!', 'success');
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Link';
                    copyBtn.classList.remove('btn-success');
                    if (copyFeedback) copyFeedback.textContent = '';
                }, 3000);
            } catch {
                // Fallback: select and copy
                linkInput.select();
                document.execCommand('copy');
                window.showToast?.('Link copied!', 'success');
            }
        });
    }

    // Share buttons
    container.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const method = btn.dataset.method;
            const link = linkInput?.value || '';
            const text = encodeURIComponent('Level up your coaching business with Mindset365 - AI-powered coaching platform');
            const url = encodeURIComponent(link);

            switch (method) {
                case 'email':
                    window.open(`mailto:?subject=${text}&body=Check%20out%20Mindset365%3A%20${url}`, '_blank');
                    break;
                case 'whatsapp':
                    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
                    break;
                case 'twitter':
                    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
                    break;
                case 'linkedin':
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
                    break;
            }
        });
    });
}
