// chart.js - Canvas-based chart component (no external dependencies)

/**
 * Default color palette — reads CSS variables where possible,
 * falls back to hard-coded values matching the design system.
 */
function getColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
        primary: cs.getPropertyValue('--color-primary').trim() || '#6C5CE7',
        primaryLight: cs.getPropertyValue('--color-primary-light').trim() || '#A29BFE',
        accent: cs.getPropertyValue('--color-accent').trim() || '#00CEC9',
        success: cs.getPropertyValue('--color-success').trim() || '#00B894',
        warning: cs.getPropertyValue('--color-warning').trim() || '#FDCB6E',
        danger: cs.getPropertyValue('--color-danger').trim() || '#FF7675',
        info: cs.getPropertyValue('--color-info').trim() || '#74B9FF',
        textPrimary: cs.getPropertyValue('--text-primary').trim() || '#EAEAEA',
        textSecondary: cs.getPropertyValue('--text-secondary').trim() || '#8892B0',
        textMuted: cs.getPropertyValue('--text-muted').trim() || '#5a6380',
        borderColor: cs.getPropertyValue('--border-color').trim() || '#2a2a4a',
        bgCard: cs.getPropertyValue('--bg-card').trim() || '#1a1a2e'
    };
}

const DEFAULT_SERIES_COLORS = [
    '#6C5CE7', '#00CEC9', '#00B894', '#FDCB6E', '#FF7675', '#74B9FF', '#A29BFE', '#55EFC4'
];

/**
 * Renders a chart on a given canvas element.
 *
 * @param {HTMLCanvasElement} canvas - The canvas DOM element to draw on
 * @param {Object} config
 * @param {string} config.type - Chart type: 'line', 'bar', or 'donut'
 * @param {Object} config.data - Chart data
 * @param {string[]} [config.data.labels] - X-axis labels (line/bar)
 * @param {Array} config.data.datasets - Array of dataset objects
 *   For line: { label, values: number[], color? }
 *   For bar:  { label, values: number[], color? }
 *   For donut: { label, value, color? }[]  (or datasets[0].segments)
 * @param {Object} [config.options] - Additional options
 * @param {string} [config.options.centerText] - Center text for donut chart
 * @param {string} [config.options.centerSubText] - Smaller subtext for donut center
 * @param {boolean} [config.options.animate=true] - Whether to animate the render
 * @param {boolean} [config.options.showDots=true] - Show dots on line chart
 * @param {boolean} [config.options.showGrid=true] - Show grid lines
 * @param {boolean} [config.options.showLegend=false] - Show legend below chart
 * @returns {Object} Chart controller with { destroy, resize, update }
 */
export function renderChart(canvas, { type, data, options = {} }) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.error('renderChart: invalid canvas element');
        return null;
    }

    const ctx = canvas.getContext('2d');
    const colors = getColors();
    const animate = options.animate !== false;
    let animFrame = null;
    let resizeObserver = null;

    // Responsive sizing
    function setSize() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = (rect.height || 300) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (rect.height || 300) + 'px';
        ctx.scale(dpr, dpr);
    }

    setSize();

    // Observe container for resizing
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            setSize();
            drawImmediate();
        });
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
    }

    const W = () => canvas.width / (window.devicePixelRatio || 1);
    const H = () => canvas.height / (window.devicePixelRatio || 1);

    // ===== DRAWING FUNCTIONS =====

    function clear() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const dpr = window.devicePixelRatio || 1;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W(), H());
    }

    function drawImmediate() {
        clear();
        switch (type) {
            case 'line': drawLine(1); break;
            case 'bar': drawBar(1); break;
            case 'donut': drawDonut(1); break;
        }
    }

    // ----- LINE CHART -----
    function drawLine(progress) {
        const w = W();
        const h = H();
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const showDots = options.showDots !== false;
        const showGrid = options.showGrid !== false;
        const labels = data.labels || [];
        const datasets = data.datasets || [];

        // Calculate data range
        let allValues = [];
        datasets.forEach(ds => {
            if (ds.values) allValues = allValues.concat(ds.values);
        });
        const maxVal = Math.max(...allValues, 0);
        const minVal = Math.min(...allValues, 0);
        const range = maxVal - minVal || 1;
        const niceMax = ceilNice(maxVal);
        const niceMin = Math.min(0, floorNice(minVal));
        const niceRange = niceMax - niceMin || 1;

        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // Grid and axis labels
        ctx.save();
        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + (chartH / gridSteps) * i;
            const val = niceMax - ((niceMax - niceMin) / gridSteps) * i;

            if (showGrid) {
                ctx.strokeStyle = colors.borderColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(w - padding.right, y);
                ctx.stroke();
            }

            // Y-axis label
            ctx.fillStyle = colors.textMuted;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatValue(val), padding.left - 8, y);
        }

        // X-axis labels
        const labelStep = labels.length > 12 ? Math.ceil(labels.length / 10) : 1;
        labels.forEach((label, i) => {
            if (i % labelStep !== 0 && i !== labels.length - 1) return;
            const x = padding.left + (chartW / Math.max(labels.length - 1, 1)) * i;
            ctx.fillStyle = colors.textMuted;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, x, h - padding.bottom + 10);
        });
        ctx.restore();

        // Draw each dataset
        datasets.forEach((ds, dsIndex) => {
            const values = ds.values || [];
            const color = ds.color || DEFAULT_SERIES_COLORS[dsIndex % DEFAULT_SERIES_COLORS.length];
            const pointCount = Math.max(Math.floor(values.length * progress), 1);

            // Build points
            const points = [];
            for (let i = 0; i < pointCount; i++) {
                const x = padding.left + (chartW / Math.max(values.length - 1, 1)) * i;
                const y = padding.top + chartH - ((values[i] - niceMin) / niceRange) * chartH;
                points.push({ x, y });
            }

            if (points.length < 2) return;

            // Gradient fill
            ctx.save();
            const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
            gradient.addColorStop(0, hexToRgba(color, 0.25));
            gradient.addColorStop(1, hexToRgba(color, 0.0));

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
            ctx.lineTo(points[0].x, h - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();

            // Line
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            ctx.restore();

            // Dots
            if (showDots) {
                points.forEach(pt => {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = colors.bgCard;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                });
            }
        });
    }

    // ----- BAR CHART -----
    function drawBar(progress) {
        const w = W();
        const h = H();
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const showGrid = options.showGrid !== false;
        const labels = data.labels || [];
        const datasets = data.datasets || [];
        const groupCount = labels.length;
        const barGroupCount = datasets.length;

        // Calculate range
        let allValues = [];
        datasets.forEach(ds => {
            if (ds.values) allValues = allValues.concat(ds.values);
        });
        const maxVal = Math.max(...allValues, 0);
        const niceMax = ceilNice(maxVal);
        const niceRange = niceMax || 1;

        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // Grid
        ctx.save();
        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + (chartH / gridSteps) * i;
            const val = niceMax - (niceMax / gridSteps) * i;

            if (showGrid) {
                ctx.strokeStyle = colors.borderColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(w - padding.right, y);
                ctx.stroke();
            }

            ctx.fillStyle = colors.textMuted;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatValue(val), padding.left - 8, y);
        }
        ctx.restore();

        // Bars
        const groupWidth = chartW / groupCount;
        const barPadding = groupWidth * 0.2;
        const barAreaWidth = groupWidth - barPadding;
        const barWidth = barAreaWidth / barGroupCount;

        datasets.forEach((ds, dsIndex) => {
            const values = ds.values || [];
            const color = ds.color || DEFAULT_SERIES_COLORS[dsIndex % DEFAULT_SERIES_COLORS.length];

            values.forEach((val, i) => {
                const barH = (val / niceRange) * chartH * progress;
                const x = padding.left + groupWidth * i + barPadding / 2 + barWidth * dsIndex;
                const y = padding.top + chartH - barH;

                // Bar with rounded top corners
                ctx.save();
                ctx.fillStyle = color;
                const radius = Math.min(4, barWidth / 2);
                drawRoundedRect(ctx, x, y, barWidth - 2, barH, radius, radius, 0, 0);
                ctx.fill();
                ctx.restore();
            });
        });

        // X-axis labels
        labels.forEach((label, i) => {
            const x = padding.left + groupWidth * i + groupWidth / 2;
            ctx.fillStyle = colors.textMuted;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, x, h - padding.bottom + 10);
        });
    }

    // ----- DONUT CHART -----
    function drawDonut(progress) {
        const w = W();
        const h = H();
        const cx = w / 2;
        const cy = h / 2;
        const outerR = Math.min(w, h) / 2 - 20;
        const innerR = outerR * 0.65;

        // Segments can come from datasets array directly or datasets[0].segments
        let segments = [];
        if (Array.isArray(data.datasets) && data.datasets.length > 0) {
            if (data.datasets[0].segments) {
                segments = data.datasets[0].segments;
            } else {
                segments = data.datasets.map((ds, i) => ({
                    label: ds.label,
                    value: ds.value,
                    color: ds.color || DEFAULT_SERIES_COLORS[i % DEFAULT_SERIES_COLORS.length]
                }));
            }
        }

        const total = segments.reduce((sum, s) => sum + (s.value || 0), 0) || 1;
        let startAngle = -Math.PI / 2;

        segments.forEach((seg, i) => {
            const sliceAngle = ((seg.value || 0) / total) * Math.PI * 2 * progress;
            const color = seg.color || DEFAULT_SERIES_COLORS[i % DEFAULT_SERIES_COLORS.length];

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();

            startAngle += sliceAngle;
        });

        // Center text
        const centerText = options.centerText || '';
        const centerSubText = options.centerSubText || '';

        if (centerText) {
            ctx.save();
            ctx.fillStyle = colors.textPrimary;
            ctx.font = `bold ${Math.round(outerR * 0.28)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = centerSubText ? 'bottom' : 'middle';
            ctx.fillText(centerText, cx, cy + (centerSubText ? -4 : 0));

            if (centerSubText) {
                ctx.fillStyle = colors.textMuted;
                ctx.font = `${Math.round(outerR * 0.14)}px Inter, sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(centerSubText, cx, cy + 4);
            }
            ctx.restore();
        }
    }

    // ===== ANIMATION =====

    function animateDraw() {
        const duration = 600;
        const start = performance.now();

        function frame(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);

            clear();
            switch (type) {
                case 'line': drawLine(eased); break;
                case 'bar': drawBar(eased); break;
                case 'donut': drawDonut(eased); break;
            }

            if (progress < 1) {
                animFrame = requestAnimationFrame(frame);
            }
        }

        animFrame = requestAnimationFrame(frame);
    }

    // Initial draw
    if (animate) {
        animateDraw();
    } else {
        drawImmediate();
    }

    // ===== CONTROLLER =====
    return {
        /** Destroy chart: cancel animation and disconnect resize observer */
        destroy() {
            if (animFrame) cancelAnimationFrame(animFrame);
            if (resizeObserver) resizeObserver.disconnect();
        },
        /** Manually trigger resize */
        resize() {
            setSize();
            drawImmediate();
        },
        /** Update data and redraw */
        update(newData, newOptions) {
            if (newData) {
                data = { ...data, ...newData };
            }
            if (newOptions) {
                Object.assign(options, newOptions);
            }
            if (animate) {
                animateDraw();
            } else {
                drawImmediate();
            }
        }
    };
}

// ===== HELPERS =====

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

function formatValue(val) {
    if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1);
}

function ceilNice(val) {
    if (val <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(val)));
    const norm = val / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
}

function floorNice(val) {
    if (val >= 0) return 0;
    return -ceilNice(Math.abs(val));
}

/**
 * Draw a rectangle with individually rounded corners.
 */
function drawRoundedRect(ctx, x, y, w, h, rTL, rTR, rBR, rBL) {
    ctx.beginPath();
    ctx.moveTo(x + rTL, y);
    ctx.lineTo(x + w - rTR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
    ctx.lineTo(x + w, y + h - rBR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
    ctx.lineTo(x + rBL, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
    ctx.lineTo(x, y + rTL);
    ctx.quadraticCurveTo(x, y, x + rTL, y);
    ctx.closePath();
}
