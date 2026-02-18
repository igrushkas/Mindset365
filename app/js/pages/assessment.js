/**
 * Mindset365 - Assessment Page
 * Full-screen wizard for business assessment with multi-step questions,
 * results display with category breakdowns, and AI recommendations.
 */

import api from '../api.js';
import { getState, setState } from '../store.js';
import { navigate } from '../router.js';

/** Assessment state */
let assessmentId = null;
let questions = [];
let answers = {};
let currentStep = 0;
let categories = [];
let results = null;

/**
 * Get unique categories from questions.
 * @param {Array} qs
 * @returns {Array}
 */
function extractCategories(qs) {
    const seen = new Set();
    return qs.reduce((acc, q) => {
        const cat = q.category || 'General';
        if (!seen.has(cat)) {
            seen.add(cat);
            acc.push(cat);
        }
        return acc;
    }, []);
}

/**
 * Build a progress ring SVG (large, for results display).
 * @param {number} percent
 * @param {number} size
 * @param {number} stroke
 * @returns {string} SVG HTML
 */
function buildScoreRing(percent, size = 160, stroke = 12) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    const color = percent >= 70 ? 'var(--color-success)' : percent >= 40 ? 'var(--color-warning)' : 'var(--color-danger)';

    return `
        <div class="progress-ring score-ring" style="width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="var(--border-color)" stroke-width="${stroke}" />
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="${color}" stroke-width="${stroke}"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 1s ease;" />
            </svg>
            <span class="progress-ring-text" style="font-size: var(--fs-3xl); font-weight: var(--fw-extrabold);">${Math.round(percent)}</span>
        </div>
    `;
}

/**
 * Render the question step.
 * @param {HTMLElement} container
 */
function renderQuestion(container) {
    const wizardEl = container.querySelector('#assessment-wizard');
    if (!wizardEl) return;

    if (currentStep >= questions.length) {
        // All questions answered, submit and show results
        submitAssessment(container);
        return;
    }

    const q = questions[currentStep];
    const totalSteps = questions.length;
    const progressPct = ((currentStep) / totalSteps) * 100;
    const currentAnswer = answers[q.id];

    wizardEl.innerHTML = `
        <div class="assessment-progress animate-fade-in">
            <div class="flex justify-between items-center">
                <div class="assessment-step-count">Step ${currentStep + 1} of ${totalSteps}</div>
                <div class="assessment-category">${q.category || 'General'}</div>
            </div>
            <div class="assessment-progress-bar">
                <div class="assessment-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
        </div>

        <div class="animate-fade-up">
            <div class="assessment-question">${q.question || q.text || q.title}</div>
            ${q.help_text ? `<div class="assessment-help">${q.help_text}</div>` : ''}

            <div id="answer-area">
                ${renderAnswerInput(q, currentAnswer)}
            </div>
        </div>

        <div class="flex justify-between mt-8">
            <button class="btn btn-ghost" id="prev-btn" ${currentStep === 0 ? 'disabled' : ''}>
                &larr; Back
            </button>
            <button class="btn btn-primary" id="next-btn">
                ${currentStep === totalSteps - 1 ? 'Complete' : 'Next &rarr;'}
            </button>
        </div>
    `;

    // Attach answer handlers
    attachAnswerHandlers(container, q);

    // Navigation
    container.querySelector('#prev-btn')?.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            renderQuestion(container);
        }
    });

    container.querySelector('#next-btn')?.addEventListener('click', () => {
        // Validate that current question is answered
        if (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '') {
            window.showToast?.('Please answer this question before continuing.', 'warning');
            return;
        }

        currentStep++;
        renderQuestion(container);
    });
}

/**
 * Render the appropriate input for a question type.
 * @param {Object} q - question
 * @param {*} currentAnswer
 * @returns {string} HTML string
 */
function renderAnswerInput(q, currentAnswer) {
    const type = (q.type || q.question_type || 'scale').toLowerCase();

    switch (type) {
        case 'scale':
            return `
                <div class="scale-input" id="scale-buttons">
                    ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `
                        <button class="scale-btn ${currentAnswer === n ? 'selected' : ''}" data-value="${n}">${n}</button>
                    `).join('')}
                </div>
                <div class="scale-labels">
                    <span>${q.scale_min_label || 'Not at all'}</span>
                    <span>${q.scale_max_label || 'Extremely'}</span>
                </div>
            `;

        case 'yes_no':
            return `
                <div class="flex gap-4">
                    <button class="btn ${currentAnswer === 'yes' ? 'btn-primary' : 'btn-secondary'} btn-lg yes-no-btn" data-value="yes" style="flex: 1; padding: var(--sp-4);">
                        Yes
                    </button>
                    <button class="btn ${currentAnswer === 'no' ? 'btn-primary' : 'btn-secondary'} btn-lg yes-no-btn" data-value="no" style="flex: 1; padding: var(--sp-4);">
                        No
                    </button>
                </div>
            `;

        case 'multiple_choice':
            const options = q.options || q.choices || [];
            return `
                <div class="flex flex-col gap-2">
                    ${options.map((opt, idx) => {
                        const value = typeof opt === 'string' ? opt : (opt.value || opt.label);
                        const label = typeof opt === 'string' ? opt : (opt.label || opt.value);
                        return `
                            <button class="btn ${currentAnswer === value ? 'btn-primary' : 'btn-secondary'} mc-btn" data-value="${value}" style="justify-content: flex-start; padding: var(--sp-3) var(--sp-4);">
                                <span style="width: 24px; height: 24px; border-radius: var(--radius-full); border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: var(--fs-xs); flex-shrink: 0; margin-right: var(--sp-2);">
                                    ${String.fromCharCode(65 + idx)}
                                </span>
                                ${label}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;

        case 'text':
            return `
                <textarea id="text-answer" rows="4" placeholder="Type your answer..."
                    class="w-full" style="font-size: var(--fs-md);">${currentAnswer || ''}</textarea>
            `;

        case 'number':
            return `
                <input type="number" id="number-answer" placeholder="Enter a number"
                    value="${currentAnswer || ''}" style="font-size: var(--fs-lg); max-width: 200px;">
            `;

        default:
            return `<p class="text-muted">Unknown question type: ${type}</p>`;
    }
}

/**
 * Attach event handlers to answer inputs.
 * @param {HTMLElement} container
 * @param {Object} q - current question
 */
function attachAnswerHandlers(container, q) {
    const type = (q.type || q.question_type || 'scale').toLowerCase();

    switch (type) {
        case 'scale':
            container.querySelectorAll('.scale-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = parseInt(btn.dataset.value, 10);
                    answers[q.id] = value;
                    container.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
            break;

        case 'yes_no':
            container.querySelectorAll('.yes-no-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    answers[q.id] = btn.dataset.value;
                    container.querySelectorAll('.yes-no-btn').forEach(b => {
                        b.className = `btn ${b.dataset.value === btn.dataset.value ? 'btn-primary' : 'btn-secondary'} btn-lg yes-no-btn`;
                    });
                });
            });
            break;

        case 'multiple_choice':
            container.querySelectorAll('.mc-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    answers[q.id] = btn.dataset.value;
                    container.querySelectorAll('.mc-btn').forEach(b => {
                        b.className = `btn ${b.dataset.value === btn.dataset.value ? 'btn-primary' : 'btn-secondary'} mc-btn`;
                    });
                });
            });
            break;

        case 'text': {
            const textarea = container.querySelector('#text-answer');
            if (textarea) {
                textarea.addEventListener('input', () => {
                    answers[q.id] = textarea.value;
                });
            }
            break;
        }

        case 'number': {
            const numInput = container.querySelector('#number-answer');
            if (numInput) {
                numInput.addEventListener('input', () => {
                    answers[q.id] = parseFloat(numInput.value) || 0;
                });
            }
            break;
        }
    }
}

/**
 * Submit assessment answers and load results.
 * @param {HTMLElement} container
 */
async function submitAssessment(container) {
    const wizardEl = container.querySelector('#assessment-wizard');
    if (!wizardEl) return;

    wizardEl.innerHTML = `
        <div class="text-center animate-fade-in" style="padding: var(--sp-12) 0;">
            <div class="spinner-sm" style="width: 48px; height: 48px; border-width: 4px; margin: 0 auto var(--sp-6);"></div>
            <h3 style="font-size: var(--fs-xl); margin-bottom: var(--sp-2);">Analyzing Your Results</h3>
            <p class="text-muted">Our AI is generating personalized recommendations...</p>
        </div>
    `;

    try {
        // Submit each answer individually (backend expects single answer per request)
        for (const [questionId, value] of Object.entries(answers)) {
            await api.post(`/assessments/${assessmentId}/answers`, {
                question_id: questionId,
                answer_value: value
            });
        }

        // Complete assessment (calculates scores + generates AI recommendations)
        const completeRes = await api.post(`/assessments/${assessmentId}/complete`);
        results = completeRes?.data || completeRes;

        // Mark onboarding as complete
        const user = getState('user');
        if (user) {
            setState('user', { ...user, onboarding_completed: 1 });
        }

        renderResults(container);
    } catch (err) {
        window.showToast?.(err.message || 'Failed to submit assessment.', 'error');
        wizardEl.innerHTML = `
            <div class="text-center" style="padding: var(--sp-12) 0;">
                <div class="empty-state-icon">&#128533;</div>
                <h3 style="margin-bottom: var(--sp-2);">Something went wrong</h3>
                <p class="text-muted mb-6">${err.message || 'Failed to process your assessment.'}</p>
                <button class="btn btn-primary" id="retry-submit">Try Again</button>
                <button class="btn btn-ghost" id="go-dashboard">Go to Dashboard</button>
            </div>
        `;

        container.querySelector('#retry-submit')?.addEventListener('click', () => submitAssessment(container));
        container.querySelector('#go-dashboard')?.addEventListener('click', () => navigate('/'));
    }
}

/**
 * Render assessment results page.
 * @param {HTMLElement} container
 */
function renderResults(container) {
    const wizardEl = container.querySelector('#assessment-wizard');
    if (!wizardEl) return;

    const overallScore = results?.overall_score ?? results?.score ?? 0;
    const categoryScores = results?.category_scores ?? results?.categories ?? {};
    const recommendations = results?.recommendations ?? results?.ai_recommendations ?? [];
    const aiSummary = results?.ai_summary ?? results?.summary ?? '';

    wizardEl.innerHTML = `
        <div class="assessment-results animate-fade-up">
            <!-- Score Header -->
            <div class="text-center mb-8">
                <h2 style="font-size: var(--fs-2xl); margin-bottom: var(--sp-2);">Your Assessment Results</h2>
                <p class="text-muted mb-6">Here is a breakdown of your current business health.</p>

                ${buildScoreRing(overallScore)}
                <div class="text-sm text-muted mt-2">Overall Score</div>
            </div>

            <!-- Category Breakdown -->
            <div class="card mb-6">
                <div class="card-header">
                    <h3>Category Breakdown</h3>
                </div>
                <div class="card-body">
                    <div class="category-scores">
                        ${Object.entries(categoryScores).map(([category, score]) => {
                            const pct = typeof score === 'object' ? (score.percentage || score.score || 0) : score;
                            const maxScore = typeof score === 'object' ? (score.max || 10) : 10;
                            const displayPct = maxScore === 10 ? pct * 10 : (maxScore === 100 ? pct : (pct / maxScore) * 100);
                            const barColor = displayPct >= 70 ? 'green' : displayPct >= 40 ? 'orange' : 'red';

                            return `
                                <div class="category-score-item">
                                    <div class="category-score-label">
                                        <span>${category}</span>
                                        <span class="category-score-value">${typeof score === 'object' ? (score.score || score.percentage || pct) : score}${maxScore <= 10 ? '/10' : '%'}</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill ${barColor}" style="width: ${Math.min(100, displayPct)}%; animation: progressGrow 0.8s ease;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- AI Summary -->
            ${aiSummary ? `
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>AI Analysis</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-sm text-secondary" style="white-space: pre-wrap; line-height: var(--lh-relaxed);">${aiSummary}</p>
                    </div>
                </div>
            ` : ''}

            <!-- Recommendations -->
            ${recommendations.length > 0 ? `
                <div class="card mb-6">
                    <div class="card-header">
                        <h3>Recommendations</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            ${recommendations.map((rec, idx) => `
                                <div class="flex gap-3 items-start" style="padding: var(--sp-3); background: var(--bg-input); border-radius: var(--radius-sm);">
                                    <div style="width: 28px; height: 28px; border-radius: var(--radius-full); background: rgba(var(--color-primary-rgb), 0.15); color: var(--color-primary-light); display: flex; align-items: center; justify-content: center; font-weight: var(--fw-bold); font-size: var(--fs-xs); flex-shrink: 0;">
                                        ${idx + 1}
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-medium text-sm mb-1">${rec.title || rec.heading || `Recommendation ${idx + 1}`}</div>
                                        <p class="text-xs text-secondary">${rec.description || rec.body || rec.content || (typeof rec === 'string' ? rec : '')}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- CTA -->
            <div class="text-center mt-8 mb-8">
                <button class="btn btn-primary btn-lg" id="start-plan-btn">
                    Start Your Plan
                </button>
                <p class="text-xs text-muted mt-3">This will create goals and tasks based on the AI recommendations above.</p>
            </div>
        </div>
    `;

    // Start plan button
    container.querySelector('#start-plan-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#start-plan-btn');
        btn.innerHTML = '<span class="spinner-sm"></span> Creating your plan...';
        btn.disabled = true;

        try {
            await api.post(`/assessments/${assessmentId}/generate-plan`);
            window.showToast?.('Your personalized plan has been created!', 'success');
            navigate('/');
        } catch (err) {
            window.showToast?.(err.message || 'Failed to generate plan. You can try again from the dashboard.', 'error');
            btn.innerHTML = 'Start Your Plan';
            btn.disabled = false;
        }
    });
}

/**
 * Render the assessment page.
 * @param {HTMLElement} container
 * @param {Object} params
 */
export async function render(container, params) {
    // Reset state
    assessmentId = null;
    questions = [];
    answers = {};
    currentStep = 0;
    categories = [];
    results = null;

    container.innerHTML = `
        <div class="page-enter">
            <div class="assessment-wizard" id="assessment-wizard">
                <div class="text-center" style="padding: var(--sp-12) 0;">
                    <div class="spinner-sm" style="width: 40px; height: 40px; border-width: 3px; margin: 0 auto var(--sp-4);"></div>
                    <p class="text-muted">Loading assessment...</p>
                </div>
            </div>
        </div>
    `;

    // Check if viewing existing results
    if (params?.id && params?.view === 'results') {
        try {
            const res = await api.get(`/assessments/${params.id}`);
            results = res?.data || res;
            assessmentId = params.id;
            renderResults(container);
        } catch (err) {
            window.showToast?.(err.message || 'Failed to load assessment results.', 'error');
            navigate('/');
        }
        return;
    }

    // Load or create assessment
    try {
        // Fetch the default template questions
        const templateRes = await api.get('/assessments/templates/default');
        const templateData = templateRes?.data || templateRes;

        questions = templateData?.questions || [];
        if (questions.length === 0) {
            throw new Error('No assessment questions available.');
        }

        categories = extractCategories(questions);

        // Create a new assessment instance
        const assessRes = await api.post('/assessments', {
            template_id: templateData?.id || 'default'
        });
        const assessData = assessRes?.data || assessRes;
        assessmentId = assessData?.id;

        if (!assessmentId) {
            throw new Error('Failed to create assessment session.');
        }

        // Render first question
        renderQuestion(container);

    } catch (err) {
        window.showToast?.(err.message || 'Failed to load assessment.', 'error');

        const wizardEl = container.querySelector('#assessment-wizard');
        if (wizardEl) {
            wizardEl.innerHTML = `
                <div class="empty-state" style="padding: var(--sp-12) 0;">
                    <div class="empty-state-icon">&#128203;</div>
                    <h3>Assessment Unavailable</h3>
                    <p>${err.message || 'Unable to load the assessment. Please try again later.'}</p>
                    <div class="flex gap-3 mt-6 justify-center">
                        <button class="btn btn-primary" id="retry-btn">Try Again</button>
                        <button class="btn btn-ghost" id="skip-btn">Go to Dashboard</button>
                    </div>
                </div>
            `;

            container.querySelector('#retry-btn')?.addEventListener('click', () => render(container, params));
            container.querySelector('#skip-btn')?.addEventListener('click', () => navigate('/'));
        }
    }
}
