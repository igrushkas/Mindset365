/**
 * Mindset365 - Login Page
 * Full-page login with Google OAuth. No sidebar/topbar.
 */

import api from '../api.js';
import { setState } from '../store.js';
import { navigate } from '../router.js';

/**
 * Handle Google credential response.
 * Sends the token to the backend, stores the returned JWT, and navigates to dashboard.
 * @param {Object} response - Google credential response
 */
async function handleGoogleCredential(response) {
    console.log('[Login] handleGoogleCredential called, credential length:', response?.credential?.length);

    try {
        console.log('[Login] Sending credential to /auth/google...');
        const result = await api.post('/auth/google', {
            credential: response.credential
        });

        console.log('[Login] API response:', JSON.stringify(result).substring(0, 200));

        if (result.token) {
            api.setToken(result.token);
        }

        if (result.user) {
            setState('user', result.user);
        }

        if (result.workspace) {
            setState('workspace', result.workspace);
        }

        if (window.renderAppLayout) {
            window.renderAppLayout();
        }

        showToast('Welcome to Mindset365!', 'success');
        navigate('/');
    } catch (err) {
        console.error('[Login] Error:', err.message, err.status, err.data);
        showToast(err.message || 'Login failed. Please try again.', 'error');

        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.textContent = err.message || 'Login failed. Please try again.';
            errorEl.style.display = 'block';
        }
    }
}

/**
 * Initialize Google Sign-In SDK and render the button.
 */
function initGoogleSignIn() {
    const clientId = window.MINDSET365_CONFIG?.googleClientId;

    if (!clientId) {
        console.error('[Login] Google Client ID not configured');
        showToast('Google Sign-In is not configured. Please contact support.', 'error');
        return;
    }

    // Wait for the Google SDK to load
    const waitForGoogle = () => {
        if (window.google?.accounts?.id) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleCredential,
                auto_select: false,
                cancel_on_tap_outside: true
            });

            const buttonContainer = document.getElementById('google-btn-container');
            if (buttonContainer) {
                window.google.accounts.id.renderButton(buttonContainer, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    width: 320,
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left'
                });
            }
        } else {
            setTimeout(waitForGoogle, 100);
        }
    };

    waitForGoogle();
}

/**
 * Render the login page.
 * @param {HTMLElement} container - The container element to render into
 */
export async function render(container) {
    // Hide the app layout (sidebar/topbar) — login is full-page
    // Uses a CSS class instead of inline styles so renderAppLayout() always restores cleanly
    document.body.classList.add('login-active');

    container.innerHTML = `
        <div class="login-page">
            <div class="login-card animate-scale-in">
                <div class="login-logo">
                    <div class="logo-icon">M</div>
                    <h1>Mindset<span>365</span></h1>
                </div>
                <p class="login-subtitle">AI-Powered Coaching Platform</p>

                <div id="google-btn-container" style="display: flex; justify-content: center; margin-bottom: var(--sp-6); min-height: 44px;">
                    <!-- Google rendered button will appear here -->
                </div>

                <div id="login-error" style="display:none; color: #e74c3c; background: #ffeaea; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; text-align: center;"></div>

                <div class="login-footer">
                    <p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
                </div>
            </div>
        </div>
    `;

    // Initialize Google Sign-In
    initGoogleSignIn();
}
