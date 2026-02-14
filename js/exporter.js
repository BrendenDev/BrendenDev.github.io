/**
 * Thiptine's Day — Exporter Module
 * Renders clip-based recorded audio and mixed video+audio for download.
 * Uses OfflineAudioContext for audio rendering and MediaRecorder + Canvas for video.
 */

const Exporter = (() => {
    let onProgress = null;

    function setOnProgress(cb) { onProgress = cb; }

    function _emit(stage, pct) {
        if (onProgress) onProgress(stage, Math.round(pct));
    }

    // ══════════════════════════════════════════
    // 1. Original Audio (from video)
    // ══════════════════════════════════════════

    /**
     * Extract audio from the video element and download as WAV.
     */
    async function downloadOriginalAudio() {
        _emit('Extracting audio from video…', 0);

        const videoEl = VideoPlayer.getElement();
        if (!videoEl || !videoEl.src && !videoEl.querySelector('source')) {
            throw new Error('No video source found');
        }

        // Use the video element to capture audio via MediaRecorder
        const stream = videoEl.captureStream();
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            throw new Error('Video has no audio track');
        }

        const audioStream = new MediaStream(audioTracks);
        const duration = VideoPlayer.getDuration();

        // Create audio context to capture
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(audioStream);
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);

        const recorder = new MediaRecorder(dest.stream, {
            mimeType: _getAudioMimeType(),
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = async () => {
                _emit('Encoding WAV…', 80);
                const blob = new Blob(chunks, { type: recorder.mimeType });
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    const wav = audioBufferToWav(audioBuffer);
                    _downloadBlob(new Blob([wav], { type: 'audio/wav' }), 'thiptines-day-original.wav');
                    _emit('Done!', 100);
                } catch (err) {
                    // Fallback: just download the webm
                    _downloadBlob(blob, 'thiptines-day-original.webm');
                    _emit('Done!', 100);
                }
                ctx.close();
                resolve();
            };

            // Play video from start to capture audio
            const prevTime = videoEl.currentTime;
            const prevMuted = videoEl.muted;
            const prevPaused = videoEl.paused;
            videoEl.muted = false;
            videoEl.currentTime = 0;

            recorder.start(100);

            let progressInterval = setInterval(() => {
                const pct = (videoEl.currentTime / duration) * 70;
                _emit('Recording audio…', pct);
            }, 500);

            videoEl.onended = () => {
                clearInterval(progressInterval);
                recorder.stop();
                // Restore state
                videoEl.currentTime = prevTime;
                videoEl.muted = prevMuted;
                if (prevPaused) videoEl.pause();
            };

            videoEl.play();
        });
    }

    // ══════════════════════════════════════════
    // 2. Recorded Clips Audio
    // ══════════════════════════════════════════

    /**
     * Render all recorded clips at their time positions into one WAV.
     */
    async function downloadRecordedAudio() {
        const clips = Recorder.getAllClips();
        if (clips.length === 0) {
            alert('No recordings to export.');
            return;
        }

        _emit('Preparing recordings…', 0);

        const duration = VideoPlayer.getDuration();
        const sampleRate = clips[0].audioBuffer.sampleRate;
        const totalSamples = Math.ceil(duration * sampleRate);

        const offline = new OfflineAudioContext(1, totalSamples, sampleRate);

        clips.forEach((clip, i) => {
            const source = offline.createBufferSource();
            source.buffer = clip.audioBuffer;
            const gain = offline.createGain();
            gain.gain.value = AudioEngine.getClipGain(clip.id);
            source.connect(gain);
            gain.connect(offline.destination);
            source.start(clip.startTime);
            _emit('Mixing clips…', (i / clips.length) * 60);
        });

        _emit('Rendering…', 60);
        const rendered = await offline.startRendering();
        _emit('Encoding WAV…', 85);
        const wav = audioBufferToWav(rendered);
        _downloadBlob(new Blob([wav], { type: 'audio/wav' }), 'thiptines-day-recordings.wav');
        _emit('Done!', 100);
    }

    // ══════════════════════════════════════════
    // 3. Mixed Audio (Video audio + Recordings)
    // ══════════════════════════════════════════

    async function downloadMixedAudio() {
        const clips = Recorder.getAllClips();
        if (clips.length === 0) {
            alert('No recordings to mix. Record something first!');
            return;
        }

        _emit('This may take a while…', 0);

        // We need to capture video audio + overlay clips
        // Use a similar approach: play video and record the mixed output
        const videoEl = VideoPlayer.getElement();
        const duration = VideoPlayer.getDuration();

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ctx.createMediaStreamDestination();

        // Video audio
        const stream = videoEl.captureStream();
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            const videoSource = ctx.createMediaStreamSource(new MediaStream(audioTracks));
            videoSource.connect(dest);
        }

        // Recording clips — schedule them
        clips.forEach(clip => {
            const source = ctx.createBufferSource();
            source.buffer = clip.audioBuffer;
            const gain = ctx.createGain();
            gain.gain.value = AudioEngine.getClipGain(clip.id);
            source.connect(gain);
            gain.connect(dest);
            source.start(ctx.currentTime + clip.startTime);
        });

        const recorder = new MediaRecorder(dest.stream, {
            mimeType: _getAudioMimeType(),
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = async () => {
                _emit('Encoding WAV…', 85);
                const blob = new Blob(chunks, { type: recorder.mimeType });
                try {
                    const ab = await blob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(ab);
                    const wav = audioBufferToWav(audioBuffer);
                    _downloadBlob(new Blob([wav], { type: 'audio/wav' }), 'thiptines-day-mixed.wav');
                } catch {
                    _downloadBlob(blob, 'thiptines-day-mixed.webm');
                }
                _emit('Done!', 100);
                ctx.close();
                resolve();
            };

            const prevTime = videoEl.currentTime;
            const prevPaused = videoEl.paused;
            videoEl.currentTime = 0;
            videoEl.muted = false;

            recorder.start(100);

            let progressInterval = setInterval(() => {
                const pct = (videoEl.currentTime / duration) * 80;
                _emit('Mixing audio…', pct);
            }, 500);

            videoEl.onended = () => {
                clearInterval(progressInterval);
                recorder.stop();
                videoEl.currentTime = prevTime;
                if (prevPaused) videoEl.pause();
            };

            videoEl.play();
        });
    }

    // ══════════════════════════════════════════
    // 4. Final Mixed Video + Audio (WebM)
    // ══════════════════════════════════════════

    async function downloadMixedVideo() {
        const clips = Recorder.getAllClips();
        _emit('Preparing video export…', 0);

        const videoEl = VideoPlayer.getElement();
        const duration = VideoPlayer.getDuration();

        // Canvas for video frames
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 1280;
        canvas.height = videoEl.videoHeight || 720;
        const canvasCtx = canvas.getContext('2d');

        // Audio context for mixing
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioDest = audioCtx.createMediaStreamDestination();

        // Video audio source
        const videoStream = videoEl.captureStream();
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const videoAudioSrc = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
            videoAudioSrc.connect(audioDest);
        }

        // Schedule recorded clips
        clips.forEach(clip => {
            const src = audioCtx.createBufferSource();
            src.buffer = clip.audioBuffer;
            const gain = audioCtx.createGain();
            gain.gain.value = AudioEngine.getClipGain(clip.id);
            src.connect(gain);
            gain.connect(audioDest);
            src.start(audioCtx.currentTime + clip.startTime);
        });

        // Combine canvas video + mixed audio
        const canvasStream = canvas.captureStream(30);
        audioDest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

        const mimeType = _getVideoMimeType();
        const recorder = new MediaRecorder(canvasStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000,
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve) => {
            recorder.onstop = () => {
                const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                const blob = new Blob(chunks, { type: mimeType });
                _downloadBlob(blob, `thiptines-day-final.${ext}`);
                _emit('Done!', 100);
                audioCtx.close();
                resolve();
            };

            // Start recording
            const prevTime = videoEl.currentTime;
            const prevPaused = videoEl.paused;
            videoEl.currentTime = 0;
            videoEl.muted = false;

            recorder.start(100);

            let frameId;
            function drawFrame() {
                if (videoEl.ended || videoEl.paused) return;
                canvasCtx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                const pct = (videoEl.currentTime / duration) * 90;
                _emit('Recording video…', pct);
                frameId = requestAnimationFrame(drawFrame);
            }

            videoEl.onended = () => {
                cancelAnimationFrame(frameId);
                recorder.stop();
                videoEl.currentTime = prevTime;
                if (prevPaused) videoEl.pause();
            };

            videoEl.play().then(drawFrame);
        });
    }

    // ══════════════════════════════════════════
    // WAV encoder
    // ══════════════════════════════════════════

    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitsPerSample = 16;

        let interleaved;
        if (numChannels === 1) {
            interleaved = buffer.getChannelData(0);
        } else {
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            interleaved = new Float32Array(left.length * 2);
            for (let i = 0; i < left.length; i++) {
                interleaved[i * 2] = left[i];
                interleaved[i * 2 + 1] = right[i];
            }
        }

        const dataLength = interleaved.length * (bitsPerSample / 8);
        const headerLength = 44;
        const totalLength = headerLength + dataLength;

        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);

        // RIFF header
        _writeString(view, 0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        _writeString(view, 8, 'WAVE');

        // fmt chunk
        _writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
        view.setUint16(32, numChannels * (bitsPerSample / 8), true);
        view.setUint16(34, bitsPerSample, true);

        // data chunk
        _writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write samples
        let offset = 44;
        for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return arrayBuffer;
    }

    function _writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // ══════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════

    function _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function _getAudioMimeType() {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    }

    function _getVideoMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'video/webm';
    }

    return {
        downloadOriginalAudio,
        downloadRecordedAudio,
        downloadMixedAudio,
        downloadMixedVideo,
        setOnProgress,
    };
})();
