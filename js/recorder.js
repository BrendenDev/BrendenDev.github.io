/**
 * Thiptine's Day — Recorder Module
 * Captures microphone audio as free-form clips (time-based, not segment-based).
 */

const Recorder = (() => {
    let audioContext = null;
    let mediaStream = null;
    let mediaRecorder = null;
    let clips = [];         // Array of { id, startTime, duration, audioBuffer }
    let nextClipId = 1;
    let isRecording = false;
    let recordStartTime = 0;
    let chunks = [];

    // Callbacks
    let onRecordingComplete = null;
    let onRecordingStart = null;
    let onMicError = null;

    function init(ctx) {
        audioContext = ctx;
    }

    /**
     * Request microphone access. Returns true if granted.
     */
    async function requestMic() {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            return true;
        } catch (err) {
            console.error('Mic access denied:', err);
            if (onMicError) onMicError(err);
            return false;
        }
    }

    /**
     * Start recording from a given video time position.
     */
    async function startRecording(startTime) {
        if (isRecording) stopRecording();

        if (!mediaStream) {
            const granted = await requestMic();
            if (!granted) return false;
        }

        recordStartTime = startTime;
        chunks = [];
        isRecording = true;

        mediaRecorder = new MediaRecorder(mediaStream, {
            mimeType: _getSupportedMimeType(),
        });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            if (chunks.length === 0) return;

            const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const clip = {
                    id: nextClipId++,
                    startTime: recordStartTime,
                    duration: audioBuffer.duration,
                    audioBuffer: audioBuffer,
                };
                clips.push(clip);
                if (onRecordingComplete) onRecordingComplete(clip);
            } catch (err) {
                console.error('Failed to decode recorded audio:', err);
            }
            isRecording = false;
        };

        mediaRecorder.start(100); // collect in 100ms chunks
        if (onRecordingStart) onRecordingStart(startTime);
        return true;
    }

    /**
     * Stop current recording.
     */
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        isRecording = false;
    }

    /**
     * Get all recorded clips.
     */
    function getAllClips() {
        return clips.slice(); // return copy
    }

    /**
     * Delete a clip by id.
     */
    function deleteClip(id) {
        clips = clips.filter(c => c.id !== id);
    }

    /**
     * Move a clip to a new start time.
     */
    function moveClip(id, newStart) {
        const clip = clips.find(c => c.id === id);
        if (clip) {
            clip.startTime = Math.max(0, newStart);
        }
    }

    /**
     * Get a specific clip by id.
     */
    function getClip(id) {
        return clips.find(c => c.id === id) || null;
    }

    /**
     * Check if any recordings exist.
     */
    function hasRecordings() {
        return clips.length > 0;
    }

    function getIsRecording() { return isRecording; }
    function getRecordStartTime() { return recordStartTime; }

    function setOnRecordingComplete(cb) { onRecordingComplete = cb; }
    function setOnRecordingStart(cb) { onRecordingStart = cb; }
    function setOnMicError(cb) { onMicError = cb; }

    /**
     * Find a supported MIME type for MediaRecorder.
     */
    function _getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return ''; // let browser choose default
    }

    /**
     * Release microphone stream.
     */
    function releaseMic() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            mediaStream = null;
        }
    }

    return {
        init, requestMic, startRecording, stopRecording,
        getAllClips, deleteClip, moveClip, getClip, hasRecordings,
        getIsRecording, getRecordStartTime,
        setOnRecordingComplete, setOnRecordingStart, setOnMicError,
        releaseMic,
    };
})();
