/**
 * Mindset365 - API Client
 * Fetch-based HTTP client with automatic token handling, retry on 401, and error parsing.
 */

const BASE_URL = '/api';
const TOKEN_KEY = 'mindset365_token';

class ApiClient {
    #token = null;

    constructor() {
        // Restore token from localStorage on init
        this.#token = localStorage.getItem(TOKEN_KEY) || null;
    }

    /**
     * Store the auth token.
     * @param {string} token
     */
    setToken(token) {
        this.#token = token;
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    /**
     * Get the current auth token.
     * @returns {string|null}
     */
    getToken() {
        return this.#token;
    }

    /**
     * Clear the auth token.
     */
    clearToken() {
        this.#token = null;
        localStorage.removeItem(TOKEN_KEY);
    }

    /**
     * Make an authenticated API request.
     * Automatically attaches Authorization header and handles 401 with token refresh.
     *
     * @param {string} endpoint - API endpoint (relative to BASE_URL)
     * @param {Object} options - fetch options
     * @param {boolean} _isRetry - internal flag to prevent infinite retry loops
     * @returns {Promise<*>} parsed JSON response
     */
    async request(endpoint, options = {}, _isRetry = false) {
        const url = `${BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Attach authorization header if token exists
        if (this.#token) {
            headers['Authorization'] = `Bearer ${this.#token}`;
        }

        // Remove Content-Type for FormData (let browser set boundary)
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const config = {
            ...options,
            headers
        };

        // Serialize body to JSON if it is a plain object
        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);

            // Handle 401 - attempt token refresh once
            if (response.status === 401 && !_isRetry && this.#token) {
                const refreshed = await this.#attemptTokenRefresh();
                if (refreshed) {
                    return this.request(endpoint, options, true);
                }
                // Refresh failed - clear token and throw
                this.clearToken();
                window.dispatchEvent(new CustomEvent('mindset365:auth:expired'));
                throw new ApiError('Session expired. Please log in again.', 401);
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return null;
            }

            // Parse response
            const contentType = response.headers.get('Content-Type') || '';
            let data;

            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const message = (data && typeof data === 'object' && (data.message || data.error))
                    ? (data.message || data.error)
                    : `Request failed with status ${response.status}`;
                throw new ApiError(message, response.status, data);
            }

            // Unwrap { success, data } envelope from backend Response::json()
            if (data && typeof data === 'object' && data.success === true && data.data !== undefined) {
                return data.data;
            }

            return data;

        } catch (err) {
            if (err instanceof ApiError) {
                throw err;
            }
            // Network error or other fetch failure
            throw new ApiError(
                err.message || 'Network error. Please check your connection.',
                0
            );
        }
    }

    /**
     * Attempt to refresh the auth token.
     * @returns {Promise<boolean>} true if refresh succeeded
     */
    async #attemptTokenRefresh() {
        try {
            const response = await fetch(`${BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.#token}`
                }
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            const inner = data?.data || data;
            if (inner.token) {
                this.setToken(inner.token);
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * GET request.
     * @param {string} endpoint
     * @param {Object} params - query parameters
     * @returns {Promise<*>}
     */
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST request.
     * @param {string} endpoint
     * @param {Object|FormData} body
     * @returns {Promise<*>}
     */
    async post(endpoint, body = {}) {
        return this.request(endpoint, { method: 'POST', body });
    }

    /**
     * PUT request.
     * @param {string} endpoint
     * @param {Object} body
     * @returns {Promise<*>}
     */
    async put(endpoint, body = {}) {
        return this.request(endpoint, { method: 'PUT', body });
    }

    /**
     * PATCH request.
     * @param {string} endpoint
     * @param {Object} body
     * @returns {Promise<*>}
     */
    async patch(endpoint, body = {}) {
        return this.request(endpoint, { method: 'PATCH', body });
    }

    /**
     * DELETE request.
     * @param {string} endpoint
     * @param {Object} body
     * @returns {Promise<*>}
     */
    async delete(endpoint, body = null) {
        const options = { method: 'DELETE' };
        if (body) {
            options.body = body;
        }
        return this.request(endpoint, options);
    }
}

/**
 * Custom API error class with status code and response data.
 */
export class ApiError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Export singleton instance
const api = new ApiClient();
export default api;
