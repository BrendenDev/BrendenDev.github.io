/**
 * Thiptine's Day — Audio Engine Module (Simplified)
 * Now only handles: Web Audio context, recording clip playback overlay, and export helpers.
 * Video provides all primary audio — this module just overlays recorded clips.
 */

const AudioEngine = (() => {
    let audioContext = null;
    let masterGain = null;
    let activeClipSources = [];   // currently playing clip sources
    let clipGains = {};           // clipId → gain value (0-1)

    function init() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioContext.destination);
    }

    function getAudioContext() {
        return audioContext;
    }

    function resumeContext() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    /**
     * Play all recorded clips that overlap with the current video time.
     * Called when playback starts or after seeking.
     */
    function playClipsAtTime(clips, currentTime) {
        stopAllClips();

        clips.forEach(clip => {
            const clipEnd = clip.startTime + clip.duration;
            if (currentTime >= clip.startTime && currentTime < clipEnd) {
                const offset = currentTime - clip.startTime;
                _playClip(clip, offset);
            }
        });
    }

    /**
     * Start playing upcoming clips as video progresses.
     * Returns a checker function to call on each frame.
     */
    function createClipScheduler(clips) {
        const started = new Set();

        return function checkTime(currentTime) {
            clips.forEach(clip => {
                const clipEnd = clip.startTime + clip.duration;
                if (currentTime >= clip.startTime && currentTime < clipEnd && !started.has(clip.id)) {
                    started.add(clip.id);
                    const offset = currentTime - clip.startTime;
                    _playClip(clip, offset);
                }
            });
        };
    }

    function _playClip(clip, offset = 0) {
        if (!audioContext || !clip.audioBuffer) return;

        const source = audioContext.createBufferSource();
        source.buffer = clip.audioBuffer;

        const gainNode = audioContext.createGain();
        const vol = clipGains[clip.id] !== undefined ? clipGains[clip.id] : 0.8;
        gainNode.gain.value = vol;

        source.connect(gainNode);
        gainNode.connect(masterGain);

        source.start(0, offset);
        activeClipSources.push({ source, gainNode, clipId: clip.id });

        source.onended = () => {
            activeClipSources = activeClipSources.filter(s => s.source !== source);
        };
    }

    function stopAllClips() {
        activeClipSources.forEach(({ source }) => {
            try { source.stop(); } catch (e) { /* already stopped */ }
        });
        activeClipSources = [];
    }

    function setClipVolume(clipId, vol) {
        clipGains[clipId] = vol;
        const active = activeClipSources.find(s => s.clipId === clipId);
        if (active) {
            active.gainNode.gain.value = vol;
        }
    }

    function setMasterVolume(vol) {
        if (masterGain) masterGain.gain.value = vol;
    }

    // ── Export helpers ──
    function getClipGain(clipId) {
        return clipGains[clipId] !== undefined ? clipGains[clipId] : 0.8;
    }

    return {
        init, getAudioContext, resumeContext,
        playClipsAtTime, createClipScheduler, stopAllClips,
        setClipVolume, setMasterVolume, getClipGain,
    };
})();
