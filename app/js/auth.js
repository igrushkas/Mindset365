/**
 * Mindset365 - Authentication Module
 * Handles Google OAuth login, token management, and session lifecycle.
 */

import api from './api.js';
import { setState, getState, resetState } from './store.js';

/**
 * Initialize Google Identity Services and render the sign-in button.
 * The button is rendered into the element with id="google-signin-btn".
 */
export function initGoogleAuth() {
    const clientId = window.MINDSET365_CONFIG?.googleClientId;

    if (!clientId) {
        console.error('[Auth] Google Client ID not configured. Set window.MINDSET365_CONFIG.googleClientId');
        return;
    }

    // Wait for the Google Identity Services library to load
    if (typeof google === 'undefined' || !google.accounts) {
        // Library not yet loaded - set up a callback
        window.__mindset365GoogleInit = () => {
            _initializeGIS(clientId);
        };

        // If the script hasn't been added yet, add it
        if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => _initializeGIS(clientId);
            document.head.appendChild(script);
        }
        return;
    }

    _initializeGIS(clientId);
}

/**
 * Internal: Initialize the Google Identity Services client and render button.
 * @param {string} clientId
 */
function _initializeGIS(clientId) {
    try {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const buttonContainer = document.getElementById('google-signin-btn');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                theme: getState('theme') === 'dark' ? 'filled_black' : 'outline',
                size: 'large',
                width: 320,
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            });
        }
    } catch (err) {
        console.error('[Auth] Failed to initialize Google Identity Services:', err);
    }
}

/**
 * Handle the Google OAuth callback.
 * Sends the credential (JWT) to the backend for verification and token exchange.
 * @param {Object} response - Google Identity Services callback response
 */
export async function handleGoogleCallback(response) {
    if (!response.credential) {
        console.error('[Auth] No credential received from Google.');
        return;
    }

    setState('loading', true);

    try {
        const data = await api.post('/auth/google', {
            credential: response.credential
        });

        if (data.token) {
            api.setToken(data.token);
        }

        if (data.user) {
            setState('user', data.user);
        }

        if (data.workspace) {
            setState('workspace', data.workspace);
        }

        // Re-render the full app layout with authenticated user data
        if (window.renderAppLayout) {
            window.renderAppLayout();
        }

        // Navigate to dashboard after successful login
        const { navigate } = await import('./router.js');
        navigate('/');

    } catch (err) {
        console.error('[Auth] Google login failed:', err.message);
        _showAuthError('Login failed. Please try again.');
    } finally {
        setState('loading', false);
    }
}

/**
 * Refresh the auth token.
 * @returns {Promise<boolean>} true if refresh succeeded
 */
export async function refreshToken() {
    try {
        const data = await api.post('/auth/refresh');

        if (data.token) {
            api.setToken(data.token);
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

/**
 * Log out the current user.
 * Clears all auth state and navigates to the login page.
 */
export async function logout() {
    try {
        await api.post('/auth/logout');
    } catch {
        // Logout endpoint may fail if token is already invalid - that's OK
    }

    // Clear token and state
    api.clearToken();
    resetState();

    // Revoke Google session if available
    if (typeof google !== 'undefined' && google.accounts) {
        try {
            google.accounts.id.disableAutoSelect();
        } catch {
            // Ignore errors during Google cleanup
        }
    }

    // Navigate to login
    const { navigate } = await import('./router.js');
    navigate('/login');
}

/**
 * Fetch the current authenticated user from the API.
 * @returns {Promise<Object|null>} user object or null if not authenticated
 */
export async function getUser() {
    try {
        const data = await api.get('/auth/me');

        if (data && data.id) {
            // /auth/me returns the user object directly (with workspace nested)
            const workspace = data.workspace;
            setState('user', data);
            if (workspace) {
                setState('workspace', workspace);
            }
            return data;
        }

        return data;
    } catch {
        return null;
    }
}

/**
 * Check if the user has an auth token stored.
 * @returns {boolean}
 */
export function isAuthenticated() {
    return !!api.getToken();
}

/**
 * Verify the current token's validity by calling the API.
 * If the token is expired, attempts a refresh.
 * @returns {Promise<boolean>} true if the user is authenticated
 */
export async function checkAuth() {
    if (!isAuthenticated()) {
        return false;
    }

    try {
        const user = await getUser();
        if (user) {
            return true;
        }

        // Token might be expired - try to refresh
        const refreshed = await refreshToken();
        if (refreshed) {
            const retryUser = await getUser();
            return !!retryUser;
        }

        return false;
    } catch {
        // Token is invalid
        api.clearToken();
        return false;
    }
}

/**
 * Display an auth error on the login page.
 * @param {string} message
 */
function _showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }
}

// Listen for auth expiry events from the API client
// Only redirect if not already on the login page (prevents double navigation)
window.addEventListener('mindset365:auth:expired', async () => {
    resetState();
    if (window.location.pathname !== '/login') {
        try {
            if (window.renderAppLayout) {
                window.renderAppLayout();
            }
            const { navigate } = await import('./router.js');
            navigate('/login', { replace: true });
        } catch {
            window.location.href = '/login';
        }
    }
});

export default {
    initGoogleAuth,
    handleGoogleCallback,
    refreshToken,
    logout,
    getUser,
    isAuthenticated,
    checkAuth
};
