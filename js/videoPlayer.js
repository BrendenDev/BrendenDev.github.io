/**
 * Thiptine's Day — Video Player Module
 * Controls the video element with native audio.
 */

const VideoPlayer = (() => {
    let videoEl = null;
    let onTimeUpdate = null;
    let onEnded = null;
    let onLoadedMetadata = null;

    function init(selector = '#bg-video') {
        videoEl = document.querySelector(selector);
        videoEl.muted = false;
        videoEl.playsInline = true;
        videoEl.loop = false;
        videoEl.preload = 'auto';

        videoEl.addEventListener('timeupdate', () => {
            if (onTimeUpdate) onTimeUpdate(videoEl.currentTime, videoEl.duration);
        });

        videoEl.addEventListener('ended', () => {
            if (onEnded) onEnded();
        });

        videoEl.addEventListener('loadedmetadata', () => {
            if (onLoadedMetadata) onLoadedMetadata(videoEl.duration);
        });
    }

    function play() {
        if (!videoEl) return Promise.reject();
        return videoEl.play().catch(() => {
            // Autoplay blocked — user will click the big play button
        });
    }

    function pause() {
        if (!videoEl) return;
        videoEl.pause();
    }

    function seek(time) {
        if (!videoEl) return;
        videoEl.currentTime = time;
    }

    function getTime() {
        return videoEl ? videoEl.currentTime : 0;
    }

    function getDuration() {
        return videoEl ? videoEl.duration || 0 : 0;
    }

    function setVolume(vol) {
        if (!videoEl) return;
        videoEl.volume = Math.max(0, Math.min(1, vol));
    }

    function getVolume() {
        return videoEl ? videoEl.volume : 1;
    }

    function setMuted(muted) {
        if (!videoEl) return;
        videoEl.muted = muted;
    }

    function isMuted() {
        return videoEl ? videoEl.muted : false;
    }

    function isPlaying() {
        return videoEl ? !videoEl.paused && !videoEl.ended : false;
    }

    function isReady() {
        return videoEl && videoEl.readyState >= 2;
    }

    function getElement() {
        return videoEl;
    }

    function setOnTimeUpdate(cb) { onTimeUpdate = cb; }
    function setOnEnded(cb) { onEnded = cb; }
    function setOnLoadedMetadata(cb) { onLoadedMetadata = cb; }

    return {
        init, play, pause, seek,
        getTime, getDuration, setVolume, getVolume,
        setMuted, isMuted, isPlaying, isReady, getElement,
        setOnTimeUpdate, setOnEnded, setOnLoadedMetadata,
    };
})();
