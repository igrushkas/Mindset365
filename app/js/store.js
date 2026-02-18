/**
 * Mindset365 - Reactive State Store
 * Simple reactive state management using Proxy pattern with CustomEvent-based subscriptions.
 */

const initialState = {
    user: null,
    workspace: null,
    theme: localStorage.getItem('mindset365_theme') || 'dark',
    notifications: [],
    sidebarOpen: true,
    currentPage: '',
    loading: false
};

const subscribers = new Map();

const handler = {
    set(target, key, value) {
        const oldValue = target[key];
        target[key] = value;

        if (oldValue !== value) {
            // Persist theme to localStorage
            if (key === 'theme') {
                localStorage.setItem('mindset365_theme', value);
            }

            notify(key, value, oldValue);
        }

        return true;
    },
    get(target, key) {
        return target[key];
    }
};

const state = new Proxy({ ...initialState }, handler);

/**
 * Set a value in the store.
 * @param {string} key
 * @param {*} value
 */
export function setState(key, value) {
    state[key] = value;
}

/**
 * Get a value from the store.
 * @param {string} key
 * @returns {*}
 */
export function getState(key) {
    return state[key];
}

/**
 * Subscribe to changes on a specific key.
 * @param {string} key
 * @param {function} callback - receives (newValue, oldValue)
 * @returns {function} unsubscribe function
 */
export function subscribe(key, callback) {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);

    // Also listen via CustomEvent for cross-module reactivity
    const eventHandler = (e) => {
        callback(e.detail.newValue, e.detail.oldValue);
    };
    const eventName = `mindset365:state:${key}`;
    document.addEventListener(eventName, eventHandler);

    // Return unsubscribe function
    return () => {
        const subs = subscribers.get(key);
        if (subs) {
            subs.delete(callback);
        }
        document.removeEventListener(eventName, eventHandler);
    };
}

/**
 * Notify all subscribers of a state change.
 * @param {string} key
 * @param {*} newValue
 * @param {*} oldValue
 */
function notify(key, newValue, oldValue) {
    // Notify direct subscribers
    const subs = subscribers.get(key);
    if (subs) {
        subs.forEach((callback) => {
            try {
                callback(newValue, oldValue);
            } catch (err) {
                console.error(`[Store] Subscriber error for key "${key}":`, err);
            }
        });
    }

    // Dispatch CustomEvent for cross-module communication
    document.dispatchEvent(
        new CustomEvent(`mindset365:state:${key}`, {
            detail: { key, newValue, oldValue }
        })
    );
}

/**
 * Batch-update multiple state keys at once.
 * @param {Object} updates - key/value pairs to set
 */
export function batchUpdate(updates) {
    for (const [key, value] of Object.entries(updates)) {
        state[key] = value;
    }
}

/**
 * Reset the store to initial state.
 */
export function resetState() {
    for (const [key, value] of Object.entries(initialState)) {
        if (key !== 'theme') {
            state[key] = value;
        }
    }
}

export default {
    setState,
    getState,
    subscribe,
    batchUpdate,
    resetState
};
