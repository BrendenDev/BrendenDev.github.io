/**
 * Thiptine's Day — Recording Timeline Module
 * Shows recorded clips on a second timeline bar.
 * Clips can be deleted and dragged to reposition.
 */

const RecTimeline = (() => {
    let container = null;
    let bar = null;
    let totalDuration = 0;
    let onClipDelete = null;
    let onClipMove = null;

    // Drag state
    let dragClipId = null;
    let dragStartX = 0;
    let dragOriginalStart = 0;

    function init(duration) {
        container = document.getElementById('rec-timeline-container');
        bar = document.getElementById('rec-timeline-bar');
        totalDuration = duration || 0;

        if (!container || !bar) return;

        // Global mouse handlers for drag
        document.addEventListener('mousemove', _onMouseMove);
        document.addEventListener('mouseup', _onMouseUp);
    }

    function setDuration(d) {
        totalDuration = d;
    }

    /**
     * Re-render all clips on the timeline.
     */
    function render(clips) {
        if (!bar) return;
        bar.innerHTML = '';

        if (!totalDuration || clips.length === 0) {
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');

        clips.forEach(clip => {
            const leftPct = (clip.startTime / totalDuration) * 100;
            const widthPct = (clip.duration / totalDuration) * 100;

            const el = document.createElement('div');
            el.classList.add('rec-clip');
            el.dataset.clipId = clip.id;
            el.style.left = `${leftPct}%`;
            el.style.width = `${Math.max(widthPct, 0.5)}%`; // min 0.5% visible

            // Time label
            const label = document.createElement('span');
            label.classList.add('rec-clip-label');
            label.textContent = _formatTime(clip.startTime);
            el.appendChild(label);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.classList.add('rec-clip-delete');
            delBtn.innerHTML = '✕';
            delBtn.title = 'Delete recording';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onClipDelete) onClipDelete(clip.id);
            });
            el.appendChild(delBtn);

            // Drag to move
            el.addEventListener('mousedown', (e) => {
                if (e.target === delBtn) return;
                e.preventDefault();
                dragClipId = clip.id;
                dragStartX = e.clientX;
                dragOriginalStart = clip.startTime;
                el.classList.add('dragging');
            });

            // Tooltip on hover
            el.title = `Recording at ${_formatTime(clip.startTime)} (${clip.duration.toFixed(1)}s) — drag to move, ✕ to delete`;

            bar.appendChild(el);
        });
    }

    function _onMouseMove(e) {
        if (dragClipId === null || !bar) return;
        const rect = bar.getBoundingClientRect();
        const dx = e.clientX - dragStartX;
        const timeDelta = (dx / rect.width) * totalDuration;
        const newStart = Math.max(0, Math.min(dragOriginalStart + timeDelta, totalDuration));

        // Visual preview
        const el = bar.querySelector(`[data-clip-id="${dragClipId}"]`);
        if (el) {
            el.style.left = `${(newStart / totalDuration) * 100}%`;
        }
    }

    function _onMouseUp(e) {
        if (dragClipId === null || !bar) return;

        const rect = bar.getBoundingClientRect();
        const dx = e.clientX - dragStartX;
        const timeDelta = (dx / rect.width) * totalDuration;
        const newStart = Math.max(0, Math.min(dragOriginalStart + timeDelta, totalDuration));

        const el = bar.querySelector(`[data-clip-id="${dragClipId}"]`);
        if (el) el.classList.remove('dragging');

        if (onClipMove && Math.abs(dx) > 3) {
            onClipMove(dragClipId, newStart);
        }

        dragClipId = null;
    }

    function setOnClipDelete(cb) { onClipDelete = cb; }
    function setOnClipMove(cb) { onClipMove = cb; }

    function _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    return { init, setDuration, render, setOnClipDelete, setOnClipMove };
})();
