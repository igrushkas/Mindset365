// form.js - Dynamic form builder component

/**
 * Renders a form inside a container from a field configuration array.
 *
 * @param {HTMLElement} container - DOM element to render the form into
 * @param {Object} config
 * @param {Array} config.fields - Array of field definitions:
 *   {
 *     name: string,
 *     label: string,
 *     type: 'text'|'textarea'|'email'|'number'|'select'|'date'|'toggle',
 *     required?: boolean,
 *     options?: Array<{value, label}>,  // for select type
 *     placeholder?: string,
 *     value?: any,                      // default value
 *     help?: string,                    // help text below the field
 *     min?: number,                     // for number type
 *     max?: number,                     // for number type
 *     rows?: number,                    // for textarea type
 *     disabled?: boolean,
 *     pattern?: string,                 // regex pattern for validation
 *     validate?: Function               // custom validation: (value) => string|null (return error string or null)
 *   }
 * @param {Function} config.onSubmit - Callback with form data object: (data) => Promise<void>|void
 * @param {string} [config.submitText='Save'] - Submit button label
 * @param {string} [config.cancelText] - Cancel button label (if provided, shows cancel button)
 * @param {Function} [config.onCancel] - Cancel button callback
 * @returns {Object} Controller with { getData, setData, setErrors, reset, setLoading }
 */
export function renderForm(container, { fields = [], onSubmit, submitText = 'Save', cancelText, onCancel }) {
    if (!container) {
        console.error('renderForm: invalid container element');
        return null;
    }

    let isLoading = false;

    // Build and inject HTML
    container.innerHTML = buildFormHTML(fields, submitText, cancelText);

    // Bind events
    const formEl = container.querySelector('form');
    if (formEl) {
        formEl.addEventListener('submit', handleSubmit);
    }

    // Cancel button
    if (cancelText) {
        const cancelBtn = container.querySelector('[data-action="form-cancel"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof onCancel === 'function') onCancel();
            });
        }
    }

    // Initialize toggle switches
    initToggles(container);

    // ===== HTML BUILDING =====

    function buildFormHTML(fields, submitText, cancelText) {
        const fieldsHTML = fields.map(field => buildFieldHTML(field)).join('');
        const cancelBtnHTML = cancelText
            ? `<button type="button" class="btn btn-secondary" data-action="form-cancel">${escapeHTML(cancelText)}</button>`
            : '';

        return `
            <form class="form" novalidate>
                ${fieldsHTML}
                <div class="flex justify-end gap-3 mt-6">
                    ${cancelBtnHTML}
                    <button type="submit" class="btn btn-primary" id="form-submit-btn">
                        <span class="btn-label">${escapeHTML(submitText)}</span>
                    </button>
                </div>
            </form>`;
    }

    function buildFieldHTML(field) {
        const requiredMark = field.required ? ' <span style="color:var(--color-danger)">*</span>' : '';
        const helpHTML = field.help ? `<div class="form-help">${escapeHTML(field.help)}</div>` : '';
        const errorHTML = `<div class="form-error" data-error-for="${field.name}" style="display:none"></div>`;
        const disabledAttr = field.disabled ? ' disabled' : '';

        let inputHTML = '';

        switch (field.type) {
            case 'textarea':
                inputHTML = `<textarea
                    name="${field.name}"
                    id="field-${field.name}"
                    placeholder="${escapeHTML(field.placeholder || '')}"
                    rows="${field.rows || 3}"
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >${escapeHTML(field.value || '')}</textarea>`;
                break;

            case 'select':
                const optionsHTML = (field.options || []).map(opt => {
                    const selected = field.value === opt.value ? ' selected' : '';
                    return `<option value="${escapeHTML(String(opt.value))}"${selected}>${escapeHTML(opt.label)}</option>`;
                }).join('');
                inputHTML = `<select
                    name="${field.name}"
                    id="field-${field.name}"
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >
                    <option value="">${escapeHTML(field.placeholder || 'Select...')}</option>
                    ${optionsHTML}
                </select>`;
                break;

            case 'toggle':
                const checked = field.value ? ' checked' : '';
                inputHTML = `
                    <label class="toggle" for="field-${field.name}">
                        <input type="checkbox" name="${field.name}" id="field-${field.name}"${checked}${disabledAttr}>
                        <span class="toggle-slider"></span>
                    </label>`;
                break;

            case 'number':
                inputHTML = `<input
                    type="number"
                    name="${field.name}"
                    id="field-${field.name}"
                    placeholder="${escapeHTML(field.placeholder || '')}"
                    value="${field.value != null ? field.value : ''}"
                    ${field.min != null ? `min="${field.min}"` : ''}
                    ${field.max != null ? `max="${field.max}"` : ''}
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >`;
                break;

            case 'date':
                inputHTML = `<input
                    type="date"
                    name="${field.name}"
                    id="field-${field.name}"
                    value="${field.value || ''}"
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >`;
                break;

            case 'email':
                inputHTML = `<input
                    type="email"
                    name="${field.name}"
                    id="field-${field.name}"
                    placeholder="${escapeHTML(field.placeholder || '')}"
                    value="${escapeHTML(field.value || '')}"
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >`;
                break;

            case 'text':
            default:
                inputHTML = `<input
                    type="text"
                    name="${field.name}"
                    id="field-${field.name}"
                    placeholder="${escapeHTML(field.placeholder || '')}"
                    value="${escapeHTML(field.value || '')}"
                    ${field.pattern ? `pattern="${field.pattern}"` : ''}
                    ${field.required ? 'required' : ''}
                    ${disabledAttr}
                >`;
                break;
        }

        return `
            <div class="form-group" data-field="${field.name}">
                ${field.type !== 'toggle' ? `<label class="form-label" for="field-${field.name}">${field.label}${requiredMark}</label>` : ''}
                ${field.type === 'toggle' ? `
                    <div class="flex items-center justify-between">
                        <label class="form-label" for="field-${field.name}" style="margin-bottom:0">${field.label}${requiredMark}</label>
                        ${inputHTML}
                    </div>` : inputHTML}
                ${helpHTML}
                ${errorHTML}
            </div>`;
    }

    // ===== EVENT HANDLERS =====

    async function handleSubmit(e) {
        e.preventDefault();
        if (isLoading) return;

        // Clear previous errors
        clearErrors();

        // Collect data
        const data = getData();

        // Validate
        const errors = validate(data);
        if (Object.keys(errors).length > 0) {
            setErrors(errors);
            // Focus first error field
            const firstErrorField = Object.keys(errors)[0];
            const el = container.querySelector(`#field-${firstErrorField}`);
            if (el) el.focus();
            return;
        }

        // Set loading state
        setLoading(true);

        try {
            if (typeof onSubmit === 'function') {
                await onSubmit(data);
            }
        } catch (err) {
            console.error('Form submit error:', err);
        } finally {
            setLoading(false);
        }
    }

    // ===== VALIDATION =====

    function validate(data) {
        const errors = {};

        for (const field of fields) {
            const value = data[field.name];

            // Required check
            if (field.required) {
                if (field.type === 'toggle') {
                    // toggles are always valid for required
                } else if (value === '' || value === null || value === undefined) {
                    errors[field.name] = `${field.label} is required`;
                    continue;
                }
            }

            // Skip further validation if empty and not required
            if (value === '' || value === null || value === undefined) continue;

            // Email validation
            if (field.type === 'email' && value) {
                const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRe.test(value)) {
                    errors[field.name] = 'Please enter a valid email address';
                    continue;
                }
            }

            // Number range validation
            if (field.type === 'number' && value !== '') {
                const num = parseFloat(value);
                if (isNaN(num)) {
                    errors[field.name] = 'Please enter a valid number';
                    continue;
                }
                if (field.min != null && num < field.min) {
                    errors[field.name] = `Minimum value is ${field.min}`;
                    continue;
                }
                if (field.max != null && num > field.max) {
                    errors[field.name] = `Maximum value is ${field.max}`;
                    continue;
                }
            }

            // Pattern validation
            if (field.pattern && value) {
                const re = new RegExp(field.pattern);
                if (!re.test(value)) {
                    errors[field.name] = `${field.label} format is invalid`;
                    continue;
                }
            }

            // Custom validation function
            if (typeof field.validate === 'function') {
                const customError = field.validate(value);
                if (customError) {
                    errors[field.name] = customError;
                }
            }
        }

        return errors;
    }

    // ===== HELPERS =====

    function initToggles(container) {
        // Toggle switches already work via native checkbox; no extra JS needed
    }

    // ===== CONTROLLER =====

    /**
     * Collects all current form data as a plain object.
     * @returns {Object} key-value pairs of field name to value
     */
    function getData() {
        const data = {};
        for (const field of fields) {
            const el = container.querySelector(`#field-${field.name}`);
            if (!el) continue;

            if (field.type === 'toggle') {
                data[field.name] = el.checked;
            } else if (field.type === 'number') {
                const val = el.value.trim();
                data[field.name] = val === '' ? null : parseFloat(val);
            } else {
                data[field.name] = el.value;
            }
        }
        return data;
    }

    /**
     * Sets values on form fields.
     * @param {Object} values - key-value pairs to set
     */
    function setData(values) {
        for (const [name, value] of Object.entries(values)) {
            const el = container.querySelector(`#field-${name}`);
            if (!el) continue;

            const field = fields.find(f => f.name === name);
            if (field && field.type === 'toggle') {
                el.checked = Boolean(value);
            } else {
                el.value = value != null ? value : '';
            }
        }
    }

    /**
     * Sets error messages under fields.
     * @param {Object} errors - { fieldName: errorMessage }
     */
    function setErrors(errors) {
        for (const [name, message] of Object.entries(errors)) {
            const errorEl = container.querySelector(`[data-error-for="${name}"]`);
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            }
            // Add error styling to input
            const input = container.querySelector(`#field-${name}`);
            if (input) {
                input.style.borderColor = 'var(--color-danger)';
            }
        }
    }

    /**
     * Clears all displayed error messages.
     */
    function clearErrors() {
        container.querySelectorAll('.form-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
        // Reset border colors
        container.querySelectorAll('input, textarea, select').forEach(el => {
            el.style.borderColor = '';
        });
    }

    /**
     * Resets form to initial field values.
     */
    function reset() {
        clearErrors();
        const initialValues = {};
        for (const field of fields) {
            initialValues[field.name] = field.value != null ? field.value : (field.type === 'toggle' ? false : '');
        }
        setData(initialValues);
    }

    /**
     * Sets the loading/disabled state on the submit button.
     * @param {boolean} loading
     */
    function setLoading(loading) {
        isLoading = loading;
        const btn = container.querySelector('#form-submit-btn');
        if (!btn) return;

        if (loading) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-sm"></span> <span class="btn-label">Saving...</span>`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `<span class="btn-label">${escapeHTML(submitText)}</span>`;
        }
    }

    return {
        getData,
        setData,
        setErrors,
        clearErrors,
        reset,
        setLoading
    };
}

// ===== UTILITY =====

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
