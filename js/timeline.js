/**
 * Thiptine's Day — Timeline Module
 * Simple continuous progress bar with click-to-seek.
 */

const Timeline = (() => {
    let container = null;
    let bar = null;
    let progressEl = null;
    let tooltipEl = null;
    let totalDuration = 0;
    let onSeek = null;
    let isDragging = false;

    function init(duration) {
        container = document.getElementById('timeline-container');
        bar = document.getElementById('timeline-bar');
        progressEl = document.getElementById('timeline-progress');
        tooltipEl = document.getElementById('timeline-tooltip');
        totalDuration = duration || 0;

        _bindEvents();
    }

    function setDuration(d) {
        totalDuration = d;
    }

    function _bindEvents() {
        // Click to seek
        bar.addEventListener('mousedown', (e) => {
            isDragging = true;
            _seekFromEvent(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                _seekFromEvent(e);
            }
            // Tooltip on hover
            if (e.target === bar || bar.contains(e.target)) {
                _showTooltip(e);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        bar.addEventListener('mouseleave', () => {
            if (!isDragging) tooltipEl.classList.remove('visible');
        });

        // Touch support
        bar.addEventListener('touchstart', (e) => {
            isDragging = true;
            _seekFromTouch(e);
        }, { passive: true });

        bar.addEventListener('touchmove', (e) => {
            if (isDragging) _seekFromTouch(e);
        }, { passive: true });

        bar.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    function _seekFromEvent(e) {
        if (!totalDuration) return;
        const rect = bar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct = x / rect.width;
        const time = pct * totalDuration;
        if (onSeek) onSeek(time);
    }

    function _seekFromTouch(e) {
        if (!totalDuration || !e.touches.length) return;
        const rect = bar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
        const pct = x / rect.width;
        const time = pct * totalDuration;
        if (onSeek) onSeek(time);
    }

    function _showTooltip(e) {
        if (!totalDuration) return;
        const rect = bar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct = x / rect.width;
        const time = pct * totalDuration;

        tooltipEl.textContent = _formatTime(time);
        tooltipEl.classList.add('visible');
        tooltipEl.style.left = `${x}px`;
    }

    function update(currentTime) {
        if (!totalDuration) return;
        const pct = (currentTime / totalDuration) * 100;
        progressEl.style.width = `${Math.min(pct, 100)}%`;
    }

    function setOnSeek(cb) { onSeek = cb; }

    function _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    return { init, setDuration, update, setOnSeek };
})();
