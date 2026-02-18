/**
 * Mindset365 - Chat Page
 * AI coaching chat with session management, context selector, and streaming-style responses.
 */

import api from '../api.js';
import { getState } from '../store.js';
import { timeAgo, getInitials } from '../utils.js';

/** Chat state */
let sessions = [];
let activeSessionId = null;
let messages = [];
let isTyping = false;
let contextType = 'general';
let contextId = null;
let creditsBalance = null;
let isOwner = false;

/**
 * Render the typing indicator.
 * @returns {string} HTML string
 */
function typingIndicator() {
    return `
        <div class="chat-message assistant" id="typing-indicator">
            <div class="avatar avatar-sm" style="background: var(--color-accent);">AI</div>
            <div class="chat-message-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a single chat message.
 * @param {Object} msg
 * @returns {string} HTML string
 */
function renderMessage(msg) {
    const role = msg.role || msg.type || 'assistant';
    const isUser = role === 'user';
    const user = getState('user');

    return `
        <div class="chat-message ${role}">
            ${isUser
                ? `<div class="avatar avatar-sm">${user?.avatar_url ? `<img src="${user.avatar_url}" alt="">` : getInitials(user?.name || 'You')}</div>`
                : `<div class="avatar avatar-sm" style="background: var(--color-accent);">AI</div>`
            }
            <div class="chat-message-bubble">
                <div class="text-sm" style="white-space: pre-wrap;">${formatMessageContent(msg.content || msg.message || '')}</div>
                ${msg.created_at ? `<div class="text-xs text-muted" style="margin-top: var(--sp-1);">${timeAgo(msg.created_at)}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Basic markdown-like formatting for chat messages.
 * @param {string} text
 * @returns {string} HTML-formatted text
 */
function formatMessageContent(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background: var(--bg-input); padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); font-size: var(--fs-xs);">$1</code>')
        .replace(/\n/g, '<br>');
}

/**
 * Render the session list sidebar.
 * @param {HTMLElement} container
 */
function renderSessionList(container) {
    const listEl = container.querySelector('#chat-session-list');
    if (!listEl) return;

    if (sessions.length === 0) {
        listEl.innerHTML = `
            <div class="text-center p-4">
                <p class="text-xs text-muted">No conversations yet.<br>Start a new chat!</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = sessions.map(session => `
        <div class="chat-session-item ${String(session.id) === String(activeSessionId) ? 'active' : ''}" data-session-id="${session.id}">
            <div class="chat-session-title">${session.title || session.name || 'New Chat'}</div>
            <div class="chat-session-meta">${session.last_message_at ? timeAgo(session.last_message_at) : timeAgo(session.created_at)}</div>
        </div>
    `).join('');

    // Session click handler
    listEl.querySelectorAll('.chat-session-item').forEach(item => {
        item.addEventListener('click', async () => {
            activeSessionId = item.dataset.sessionId;
            renderSessionList(container);
            await loadMessages(container);
        });
    });
}

/**
 * Render the message area.
 * @param {HTMLElement} container
 */
function renderMessages(container) {
    const messagesEl = container.querySelector('#chat-messages');
    if (!messagesEl) return;

    if (!activeSessionId) {
        messagesEl.innerHTML = `
            <div class="empty-state" style="flex: 1;">
                <div class="empty-state-icon">&#129302;</div>
                <h3>AI Coaching Assistant</h3>
                <p>Start a new conversation or select an existing one. Ask about goals, strategies, mindset, or business growth.</p>
            </div>
        `;
        return;
    }

    if (messages.length === 0 && !isTyping) {
        messagesEl.innerHTML = `
            <div class="empty-state" style="flex: 1;">
                <div class="empty-state-icon">&#128172;</div>
                <h3>Start the conversation</h3>
                <p>Type a message below to begin your coaching session.</p>
            </div>
        `;
        return;
    }

    messagesEl.innerHTML = messages.map(renderMessage).join('');

    if (isTyping) {
        messagesEl.innerHTML += typingIndicator();
    }

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Load messages for the active session.
 * @param {HTMLElement} container
 */
async function loadMessages(container) {
    if (!activeSessionId) return;

    try {
        // GET /chat/sessions/:id returns session object with messages array
        const res = await api.get(`/chat/sessions/${activeSessionId}`);
        const session = res?.data || res;
        messages = Array.isArray(session?.messages) ? session.messages : [];
    } catch (err) {
        window.showToast?.(err.message || 'Failed to load messages.', 'error');
        messages = [];
    }

    renderMessages(container);
}

/**
 * Send a message and get AI response.
 * @param {string} content
 * @param {HTMLElement} container
 */
async function sendMessage(content, container) {
    if (!content.trim() || isTyping) return;

    // Check credits before sending (client-side pre-check)
    if (!isOwner && creditsBalance !== null && creditsBalance < 1) {
        window.showToast?.('No credits remaining. Visit the Credits page to buy more.', 'warning');
        return;
    }

    // Create a session if none is active
    if (!activeSessionId) {
        try {
            const res = await api.post('/chat/sessions', {
                title: content.substring(0, 50),
                context_type: contextType,
                context_id: contextId
            });
            const session = res?.data || res;
            activeSessionId = session.id;
            sessions.unshift(session);
            renderSessionList(container);
        } catch (err) {
            window.showToast?.(err.message || 'Failed to create chat session.', 'error');
            return;
        }
    }

    // Add user message to UI immediately
    const userMsg = {
        role: 'user',
        content,
        created_at: new Date().toISOString()
    };
    messages.push(userMsg);
    renderMessages(container);

    // Clear input
    const textarea = container.querySelector('#chat-input');
    if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto';
    }

    // Show typing indicator
    isTyping = true;
    renderMessages(container);

    // Send to API
    try {
        const res = await api.post(`/chat/sessions/${activeSessionId}/messages`, {
            content,
            context_type: contextType,
            context_id: contextId
        });

        isTyping = false;

        const assistantMsg = res?.data || res;
        if (assistantMsg) {
            messages.push({
                role: 'assistant',
                content: assistantMsg.content || assistantMsg.message || assistantMsg.reply || '',
                created_at: assistantMsg.created_at || new Date().toISOString()
            });
        }

        renderMessages(container);

        // Update credit balance from response
        if (assistantMsg?.credits_remaining !== undefined) {
            creditsBalance = assistantMsg.credits_remaining;
            updateCreditBadge(container);
        }

        // Update session title if it was auto-generated
        const session = sessions.find(s => String(s.id) === String(activeSessionId));
        if (session && (!session.title || session.title === content.substring(0, 50))) {
            session.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            renderSessionList(container);
        }
    } catch (err) {
        isTyping = false;
        if (err.status === 402 || (err.message && err.message.includes('No AI credits'))) {
            creditsBalance = 0;
            updateCreditBadge(container);
            window.showToast?.('No credits remaining. Visit the Credits page to buy more.', 'warning');
        } else {
            window.showToast?.(err.message || 'Failed to get AI response.', 'error');
        }
        renderMessages(container);
    }
}

/**
 * Update the credit balance badge in the UI.
 */
function updateCreditBadge(container) {
    const badge = container.querySelector('#credits-badge');
    if (!badge || isOwner) return;
    badge.textContent = `${creditsBalance} credits`;
    badge.className = 'badge';
    if (creditsBalance <= 5) badge.classList.add('badge-warning');
    if (creditsBalance <= 0) badge.classList.add('badge-danger');
}

/**
 * Create a new chat session.
 * @param {HTMLElement} container
 */
function newChat(container) {
    activeSessionId = null;
    messages = [];
    contextType = 'general';
    contextId = null;
    renderSessionList(container);
    renderMessages(container);

    // Reset context selector
    const ctxSelect = container.querySelector('#context-selector');
    if (ctxSelect) ctxSelect.value = 'general';

    // Focus input
    container.querySelector('#chat-input')?.focus();
}

/**
 * Render the chat page.
 * @param {HTMLElement} container
 */
export async function render(container) {
    const user = getState('user');
    isOwner = user?.role === 'owner';
    sessions = [];
    activeSessionId = null;
    messages = [];
    isTyping = false;
    contextType = 'general';
    contextId = null;
    creditsBalance = null;

    container.innerHTML = `
        <div class="page-enter" style="height: calc(100vh - var(--topbar-height) - 48px);">
            <div class="chat-layout">
                <!-- Sidebar -->
                <div class="chat-sidebar">
                    <div class="chat-sidebar-header">
                        <button class="btn btn-primary w-full" id="new-chat-btn">+ New Chat</button>
                    </div>
                    <div class="chat-sidebar-list" id="chat-session-list">
                        <div class="p-4">
                            <div class="skeleton skeleton-text"></div>
                            <div class="skeleton skeleton-text"></div>
                            <div class="skeleton skeleton-text"></div>
                        </div>
                    </div>
                </div>

                <!-- Main Chat Area -->
                <div class="chat-main">
                    <!-- Context selector bar -->
                    <div class="flex items-center gap-3 px-4 py-2" style="border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);">
                        <span class="text-xs text-muted">Context:</span>
                        <select id="context-selector" style="width: auto; min-width: 140px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-xs);">
                            <option value="general">General</option>
                            <option value="goal">Link to Goal</option>
                            <option value="client">Link to Client</option>
                        </select>
                        <div id="context-detail" class="text-xs text-muted" style="display: none;"></div>
                        <div style="margin-left: auto;">
                            ${isOwner
                                ? '<span class="badge badge-success">Unlimited</span>'
                                : '<span id="credits-badge" class="badge" style="cursor: pointer;" title="Click to buy more credits">...</span>'
                            }
                        </div>
                    </div>

                    <!-- Messages -->
                    <div class="chat-messages" id="chat-messages">
                        <div class="empty-state" style="flex: 1;">
                            <div class="empty-state-icon">&#129302;</div>
                            <h3>AI Coaching Assistant</h3>
                            <p>Start a new conversation or select an existing one. Ask about goals, strategies, mindset, or business growth.</p>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="chat-input-area">
                        <div class="chat-input-wrap">
                            <textarea
                                id="chat-input"
                                placeholder="Ask your AI coach anything..."
                                rows="1"
                                style="flex: 1;"
                            ></textarea>
                            <button class="btn btn-primary" id="send-btn" style="height: 44px; min-width: 44px; padding: 0;">
                                &#10148;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load sessions and credits in parallel
    try {
        const [sessionsRes, creditsRes] = await Promise.allSettled([
            api.get('/chat/sessions'),
            !isOwner ? api.get('/billing/credits') : Promise.resolve(null),
        ]);
        if (sessionsRes.status === 'fulfilled') {
            const res = sessionsRes.value;
            sessions = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        }
        if (!isOwner && creditsRes.status === 'fulfilled' && creditsRes.value) {
            creditsBalance = creditsRes.value.credits_balance ?? null;
            updateCreditBadge(container);
        }
    } catch (err) {
        // Silently fail
    }
    renderSessionList(container);

    // Credits badge click → navigate to billing
    container.querySelector('#credits-badge')?.addEventListener('click', async () => {
        const { navigate } = await import('../router.js');
        navigate('/billing');
    });

    // New chat button
    container.querySelector('#new-chat-btn')?.addEventListener('click', () => newChat(container));

    // Send button
    container.querySelector('#send-btn')?.addEventListener('click', () => {
        const input = container.querySelector('#chat-input');
        if (input?.value?.trim()) {
            sendMessage(input.value.trim(), container);
        }
    });

    // Enter to send (Shift+Enter for newline)
    container.querySelector('#chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const input = e.target;
            if (input.value?.trim()) {
                sendMessage(input.value.trim(), container);
            }
        }
    });

    // Auto-resize textarea
    container.querySelector('#chat-input')?.addEventListener('input', (e) => {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    // Context selector
    container.querySelector('#context-selector')?.addEventListener('change', async (e) => {
        const value = e.target.value;
        const detailEl = container.querySelector('#context-detail');

        if (value === 'general') {
            contextType = 'general';
            contextId = null;
            if (detailEl) detailEl.style.display = 'none';
        } else if (value === 'goal') {
            contextType = 'goal';
            if (detailEl) {
                detailEl.style.display = 'block';
                detailEl.textContent = 'Loading goals...';
            }
            try {
                const res = await api.get('/goals', { status: 'in_progress' });
                const goals = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                if (goals.length > 0) {
                    contextId = goals[0].id;
                    if (detailEl) {
                        detailEl.innerHTML = `
                            <select id="context-goal-select" style="width: auto; min-width: 160px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-xs);">
                                ${goals.map(g => `<option value="${g.id}">${g.title}</option>`).join('')}
                            </select>
                        `;
                        detailEl.querySelector('#context-goal-select')?.addEventListener('change', (ev) => {
                            contextId = ev.target.value;
                        });
                    }
                } else {
                    if (detailEl) detailEl.textContent = 'No active goals found.';
                    contextId = null;
                }
            } catch {
                if (detailEl) detailEl.textContent = 'Failed to load goals.';
            }
        } else if (value === 'client') {
            contextType = 'client';
            if (detailEl) {
                detailEl.style.display = 'block';
                detailEl.textContent = 'Loading clients...';
            }
            try {
                const res = await api.get('/clients', { status: 'active' });
                const clientsList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                if (clientsList.length > 0) {
                    contextId = clientsList[0].id;
                    if (detailEl) {
                        detailEl.innerHTML = `
                            <select id="context-client-select" style="width: auto; min-width: 160px; padding: var(--sp-1) var(--sp-2); font-size: var(--fs-xs);">
                                ${clientsList.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        `;
                        detailEl.querySelector('#context-client-select')?.addEventListener('change', (ev) => {
                            contextId = ev.target.value;
                        });
                    }
                } else {
                    if (detailEl) detailEl.textContent = 'No active clients found.';
                    contextId = null;
                }
            } catch {
                if (detailEl) detailEl.textContent = 'Failed to load clients.';
            }
        }
    });

    // Focus the input
    container.querySelector('#chat-input')?.focus();
}
