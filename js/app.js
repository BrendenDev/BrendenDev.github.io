/**
 * Thiptine's Day — App Orchestrator
 * Video-driven playback with free-form recording.
 */

(async function App() {
    'use strict';

    // ── DOM references ──
    const btnPlay = document.getElementById('btn-play');
    const btnLargePlay = document.getElementById('play-btn-large');
    const iconPlay = btnPlay.querySelector('.icon-play');
    const iconPause = btnPlay.querySelector('.icon-pause');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const volumeSlider = document.getElementById('volume-slider');

    // Recording bar DOM
    const recPanel = document.getElementById('recording-panel');
    const recIndicator = document.getElementById('rec-indicator');
    const btnRecord = document.getElementById('btn-record');
    const btnRecDone = document.getElementById('btn-rec-done');
    const recBtnLabel = document.getElementById('rec-btn-label');

    // Audio source toggle
    const pillOriginal = document.getElementById('pill-original');
    const pillInstrumental = document.getElementById('pill-instrumental');

    // Export modal DOM
    const btnDownload = document.getElementById('btn-download');
    const exportModal = document.getElementById('export-modal');
    const exportBackdrop = document.getElementById('export-modal-backdrop');
    const exportClose = document.getElementById('export-close');
    const dlOriginalVideo = document.getElementById('dl-original-video');
    const dlRecordings = document.getElementById('dl-recordings');
    const exportProgress = document.getElementById('export-progress');
    const exportProgressFill = document.getElementById('export-progress-fill');
    const exportProgressText = document.getElementById('export-progress-text');

    // State
    let isRecordingMode = false;
    let audioSourceOriginal = true;
    let isUnlocked = localStorage.getItem('thiptines_unlocked') === 'true';
    let clipScheduler = null;
    let schedulerRAF = null;

    // ── Initialize modules ──
    VideoPlayer.init('#bg-video');
    AudioEngine.init();
    Recorder.init(AudioEngine.getAudioContext());

    // Wait for video metadata to get duration
    VideoPlayer.setOnLoadedMetadata((duration) => {
        timeTotal.textContent = formatTime(duration);
        Timeline.init(duration);
        RecTimeline.init(duration);
    });

    // If metadata already loaded
    if (VideoPlayer.getDuration()) {
        timeTotal.textContent = formatTime(VideoPlayer.getDuration());
        Timeline.init(VideoPlayer.getDuration());
        RecTimeline.init(VideoPlayer.getDuration());
    }

    // Set initial volume
    VideoPlayer.setVolume(volumeSlider.value / 100);

    // ══════════════════════════════════════════
    // ── VIDEO PLAYBACK CALLBACKS ──
    // ══════════════════════════════════════════

    VideoPlayer.setOnTimeUpdate((currentTime, duration) => {
        timeCurrent.textContent = formatTime(currentTime);
        Timeline.update(currentTime);

        // Schedule recording clip playback
        if (clipScheduler) clipScheduler(currentTime);
    });

    VideoPlayer.setOnEnded(() => {
        _setPlayState(false);
        if (isRecordingMode) {
            _finishRecording();
        }
    });

    Timeline.setOnSeek((time) => {
        if (isRecordingMode) return; // block seeking during recording
        VideoPlayer.seek(time);
        Timeline.update(time);
        timeCurrent.textContent = formatTime(time);

        // Restart clip playback from new position
        _restartClipPlayback();
    });

    // ══════════════════════════════════════════
    // ── PLAY / PAUSE ──
    // ══════════════════════════════════════════

    function _setPlayState(playing) {
        if (playing) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            btnLargePlay.classList.add('hidden');
            btnPlay.title = 'Pause';
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            if (!isRecordingMode) {
                btnLargePlay.classList.remove('hidden');
            }
            btnPlay.title = 'Play';
        }
    }

    async function _togglePlay() {
        AudioEngine.resumeContext();

        if (VideoPlayer.isPlaying()) {
            VideoPlayer.pause();
            AudioEngine.stopAllClips();
            _setPlayState(false);
        } else {
            await VideoPlayer.play();
            _setPlayState(true);
            _restartClipPlayback();
        }
    }

    btnPlay.addEventListener('click', _togglePlay);
    btnLargePlay.addEventListener('click', _togglePlay);

    // Skip forward / back
    const btnSkipBack = document.getElementById('btn-skip-back');
    const btnSkipFwd = document.getElementById('btn-skip-fwd');

    function _skip(delta) {
        const t = Math.max(0, Math.min(VideoPlayer.getTime() + delta, VideoPlayer.getDuration()));
        VideoPlayer.seek(t);
        Timeline.update(t);
        timeCurrent.textContent = formatTime(t);
        _restartClipPlayback();
    }

    btnSkipBack.addEventListener('click', () => _skip(-5));
    btnSkipFwd.addEventListener('click', () => _skip(5));

    // Volume
    volumeSlider.addEventListener('input', () => {
        VideoPlayer.setVolume(volumeSlider.value / 100);
    });

    // ══════════════════════════════════════════
    // ── RECORDING FLOW ──
    // ══════════════════════════════════════════

    // Start recording
    btnRecord.addEventListener('click', async () => {
        if (isRecordingMode) return;

        AudioEngine.resumeContext();
        isRecordingMode = true;

        // If not playing, start playback
        if (!VideoPlayer.isPlaying()) {
            await VideoPlayer.play();
            _setPlayState(true);
        }

        const startTime = VideoPlayer.getTime();
        const started = await Recorder.startRecording(startTime);

        if (!started) {
            isRecordingMode = false;
            return;
        }

        // Update UI
        btnRecord.classList.add('hidden');
        btnRecDone.classList.remove('hidden');
        recIndicator.classList.remove('hidden');
        recBtnLabel.textContent = 'Record';

        // Apply audio source setting
        if (!audioSourceOriginal) {
            VideoPlayer.setMuted(true);
        }
    });

    // Stop recording
    btnRecDone.addEventListener('click', () => {
        _finishRecording();
    });

    function _finishRecording() {
        if (!isRecordingMode) return;

        Recorder.stopRecording();
        isRecordingMode = false;

        // Restore UI
        btnRecord.classList.remove('hidden');
        btnRecDone.classList.add('hidden');
        recIndicator.classList.add('hidden');

        // Restore audio
        VideoPlayer.setMuted(false);
    }

    // Recording complete callback — clip was decoded and saved
    Recorder.setOnRecordingComplete((clip) => {
        const clips = Recorder.getAllClips();
        RecTimeline.render(clips);
        _showRecTimeline();
        AudioEngine.setClipVolume(clip.id, 0.8);
        _restartClipPlayback();
    });

    // Audio source toggle (Original / Muted)
    pillOriginal.addEventListener('click', () => {
        audioSourceOriginal = true;
        pillOriginal.classList.add('active');
        pillInstrumental.classList.remove('active');
        if (isRecordingMode) {
            VideoPlayer.setMuted(false);
        }
    });

    pillInstrumental.addEventListener('click', () => {
        audioSourceOriginal = false;
        pillInstrumental.classList.add('active');
        pillOriginal.classList.remove('active');
        if (isRecordingMode) {
            VideoPlayer.setMuted(true);
        }
    });

    // ══════════════════════════════════════════
    // ── RECORDING CLIP MANAGEMENT ──
    // ══════════════════════════════════════════

    RecTimeline.setOnClipDelete((clipId) => {
        Recorder.deleteClip(clipId);
        const clips = Recorder.getAllClips();
        RecTimeline.render(clips);
        if (clips.length === 0) _hideRecTimeline();
        _restartClipPlayback();
    });

    RecTimeline.setOnClipMove((clipId, newStart) => {
        Recorder.moveClip(clipId, newStart);
        const clips = Recorder.getAllClips();
        RecTimeline.render(clips);
        _restartClipPlayback();
    });

    function _restartClipPlayback() {
        AudioEngine.stopAllClips();
        if (VideoPlayer.isPlaying() && Recorder.hasRecordings()) {
            clipScheduler = AudioEngine.createClipScheduler(Recorder.getAllClips());
            clipScheduler(VideoPlayer.getTime());
        } else {
            clipScheduler = null;
        }
    }

    function _showRecTimeline() {
        const container = document.getElementById('rec-timeline-container');
        if (container) container.classList.remove('hidden');
    }

    function _hideRecTimeline() {
        const container = document.getElementById('rec-timeline-container');
        if (container) container.classList.add('hidden');
    }

    // ══════════════════════════════════════════
    // ── EXPORT (Phase 3) ──
    // ══════════════════════════════════════════

    let isExporting = false;

    function _openExportModal() {
        exportModal.classList.remove('hidden');
        _setExportButtons(true);
        exportProgress.classList.add('hidden');
    }

    function _closeExportModal() {
        if (isExporting) return;
        exportModal.classList.add('hidden');
    }

    btnDownload.addEventListener('click', _openExportModal);
    exportClose.addEventListener('click', _closeExportModal);
    exportBackdrop.addEventListener('click', _closeExportModal);

    function _setExportButtons(enabled) {
        [dlOriginalVideo, dlRecordings].forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.4';
        });
    }

    Exporter.setOnProgress((stage, pct) => {
        exportProgress.classList.remove('hidden');
        exportProgressFill.style.width = `${pct}%`;
        exportProgressText.textContent = stage;
    });

    async function _runExport(exportFn) {
        if (isExporting) return;
        isExporting = true;
        _setExportButtons(false);

        try {
            await exportFn();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err.message);
        }

        isExporting = false;
        _setExportButtons(true);
    }

    dlOriginalVideo.addEventListener('click', () => {
        // Direct download of the video file
        const a = document.createElement('a');
        a.href = CONFIG.videoSrc;
        a.download = CONFIG.videoSrc.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
    dlRecordings.addEventListener('click', () => _runExport(Exporter.downloadRecordedAudio));

    // ══════════════════════════════════════════
    // ── SECRET UNLOCK SYSTEM ──
    // ══════════════════════════════════════════

    const barTitle = document.getElementById('bar-title');
    const passwordModal = document.getElementById('password-modal');
    const passwordBackdrop = document.getElementById('password-backdrop');
    const passwordClose = document.getElementById('password-close');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordError = document.getElementById('password-error');
    const messageModal = document.getElementById('message-modal');
    const messageBackdrop = document.getElementById('message-backdrop');
    const messageClose = document.getElementById('message-close');

    const btnToggleRec = document.getElementById('btn-toggle-rec');
    let recPanelVisible = false;

    function _applyUnlockState() {
        if (isUnlocked) {
            btnDownload.classList.remove('hidden');
            btnToggleRec.classList.remove('hidden');
            // Panel starts collapsed — user clicks mic button to show
        } else {
            btnDownload.classList.add('hidden');
            btnToggleRec.classList.add('hidden');
            recPanel.classList.add('hidden');
        }
    }

    btnToggleRec.addEventListener('click', () => {
        recPanelVisible = !recPanelVisible;
        if (recPanelVisible) {
            recPanel.classList.remove('hidden');
            btnToggleRec.classList.add('active');
        } else {
            recPanel.classList.add('hidden');
            btnToggleRec.classList.remove('active');
        }
    });

    // Apply on load
    _applyUnlockState();

    // Title click handler
    barTitle.addEventListener('click', () => {
        if (!isUnlocked) {
            passwordModal.classList.remove('hidden');
            passwordInput.value = '';
            passwordError.classList.add('hidden');
            setTimeout(() => passwordInput.focus(), 100);
        } else {
            messageModal.classList.remove('hidden');
        }
    });

    // Password submit
    function _tryPassword() {
        const val = passwordInput.value.trim().toLowerCase();
        if (val === 'hamster') {
            isUnlocked = true;
            localStorage.setItem('thiptines_unlocked', 'true');
            passwordModal.classList.add('hidden');
            _applyUnlockState();
            setTimeout(() => {
                messageModal.classList.remove('hidden');
            }, 300);
        } else {
            passwordError.classList.remove('hidden');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    passwordSubmit.addEventListener('click', _tryPassword);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _tryPassword();
    });

    // Close handlers
    passwordClose.addEventListener('click', () => passwordModal.classList.add('hidden'));
    passwordBackdrop.addEventListener('click', () => passwordModal.classList.add('hidden'));
    messageClose.addEventListener('click', () => messageModal.classList.add('hidden'));
    messageBackdrop.addEventListener('click', () => messageModal.classList.add('hidden'));

    // ══════════════════════════════════════════
    // ── HELPERS ──
    // ══════════════════════════════════════════

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

})();
