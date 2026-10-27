// Core Video Player Engine for SVLC
// Handles audio boost up to 200%, equalizer, video filters, aspect ratios, seek bar, and VLC hotkeys

export class PlayerEngine {
  constructor(videoElement, containerElement, onStateChange = () => {}) {
    this.video = videoElement;
    this.container = containerElement;
    this.onStateChange = onStateChange;

    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    this.volume = 1.0; // 0.0 to 2.0 (VLC 200% audio boost)
    this.isMuted = false;
    this.aspectRatio = 'auto'; // 'auto', '16:9', '4:3', '2.35:1', 'fill'
    this.isFullscreen = false;
    this.isPiP = false;

    // Web Audio API graph for 200% volume boost and equalizer
    this.audioCtx = null;
    this.audioSource = null;
    this.gainNode = null;
    this.compressorNode = null;
    this.eqBass = null;
    this.eqMid = null;
    this.eqTreble = null;
    this.audioGraphReady = false;

    // Video filters
    this.filters = {
      brightness: 100, // %
      contrast: 100,   // %
      saturation: 100, // %
      hue: 0           // deg
    };

    this.initVideoEvents();
    this.initKeyboardEvents();
  }

  // Initialize Web Audio API graph on first user interaction to satisfy browser autoplay policies
  ensureAudioGraph() {
    if (this.audioGraphReady) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();

      // Create nodes
      this.audioSource = this.audioCtx.createMediaElementSource(this.video);
      this.gainNode = this.audioCtx.createGain();
      this.compressorNode = this.audioCtx.createDynamicsCompressor();

      // 3-band equalizer
      this.eqBass = this.audioCtx.createBiquadFilter();
      this.eqBass.type = 'lowshelf';
      this.eqBass.frequency.value = 200;
      this.eqBass.gain.value = 0;

      this.eqMid = this.audioCtx.createBiquadFilter();
      this.eqMid.type = 'peaking';
      this.eqMid.frequency.value = 1000;
      this.eqMid.Q.value = 1;
      this.eqMid.gain.value = 0;

      this.eqTreble = this.audioCtx.createBiquadFilter();
      this.eqTreble.type = 'highshelf';
      this.eqTreble.frequency.value = 3500;
      this.eqTreble.gain.value = 0;

      // Soft limiter settings to prevent distortion on >100% volume boost
      this.compressorNode.threshold.setValueAtTime(-4, this.audioCtx.currentTime);
      this.compressorNode.knee.setValueAtTime(8, this.audioCtx.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime);

      // Rematrixing downmix matrix (VLC ITU-R BS.775 + Speech/Dialogue Enhancement)
      // Extracts all channels from multi-channel audio (7.1, 5.1) and folds Center (dialogue) & Surrounds into stereo
      this.channelSplitter = this.audioCtx.createChannelSplitter(8);
      this.channelMerger = this.audioCtx.createChannelMerger(2);

      // Channel 0: Front Left -> Merger Left (1.0)
      const gainFL = this.audioCtx.createGain();
      gainFL.gain.value = 1.0;
      this.channelSplitter.connect(gainFL, 0);
      gainFL.connect(this.channelMerger, 0, 0);

      // Channel 1: Front Right -> Merger Right (1.0)
      const gainFR = this.audioCtx.createGain();
      gainFR.gain.value = 1.0;
      this.channelSplitter.connect(gainFR, 1);
      gainFR.connect(this.channelMerger, 0, 1);

      // Channel 2: Center (FC - DIALOGUES & VOCALS) -> Folded into BOTH Left & Right
      // In 8CH/6CH movies, dialogue is in Channel 2. We route it to both ears with 1.1x Dialogue Boost
      const gainCenterL = this.audioCtx.createGain();
      gainCenterL.gain.value = 1.1;
      const gainCenterR = this.audioCtx.createGain();
      gainCenterR.gain.value = 1.1;
      this.channelSplitter.connect(gainCenterL, 2);
      gainCenterL.connect(this.channelMerger, 0, 0);
      this.channelSplitter.connect(gainCenterR, 2);
      gainCenterR.connect(this.channelMerger, 0, 1);

      // Channel 3: LFE (Subwoofer / Bass) -> Folded into Left (0.5) & Right (0.5)
      const gainLfeL = this.audioCtx.createGain();
      gainLfeL.gain.value = 0.5;
      const gainLfeR = this.audioCtx.createGain();
      gainLfeR.gain.value = 0.5;
      this.channelSplitter.connect(gainLfeL, 3);
      gainLfeL.connect(this.channelMerger, 0, 0);
      this.channelSplitter.connect(gainLfeR, 3);
      gainLfeR.connect(this.channelMerger, 0, 1);

      // Channel 4: Back Left (Surround) -> Merger Left (0.707)
      const gainBLL = this.audioCtx.createGain();
      gainBLL.gain.value = 0.707;
      this.channelSplitter.connect(gainBLL, 4);
      gainBLL.connect(this.channelMerger, 0, 0);

      // Channel 5: Back Right (Surround) -> Merger Right (0.707)
      const gainBRR = this.audioCtx.createGain();
      gainBRR.gain.value = 0.707;
      this.channelSplitter.connect(gainBRR, 5);
      gainBRR.connect(this.channelMerger, 0, 1);

      // Channel 6: Side Left (Surround in 7.1) -> Merger Left (0.707)
      const gainSLL = this.audioCtx.createGain();
      gainSLL.gain.value = 0.707;
      this.channelSplitter.connect(gainSLL, 6);
      gainSLL.connect(this.channelMerger, 0, 0);

      // Channel 7: Side Right (Surround in 7.1) -> Merger Right (0.707)
      const gainSRR = this.audioCtx.createGain();
      gainSRR.gain.value = 0.707;
      this.channelSplitter.connect(gainSRR, 7);
      gainSRR.connect(this.channelMerger, 0, 1);

      // Connect source to splitter
      this.audioSource.connect(this.channelSplitter);

      // Connect merger to EQ and output chain
      this.channelMerger.connect(this.eqBass);
      this.eqBass.connect(this.eqMid);
      this.eqMid.connect(this.eqTreble);
      this.eqTreble.connect(this.gainNode);
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.audioCtx.destination);

      this.audioGraphReady = true;
      this.updateVolume();
    } catch (e) {
      // If CORS or already connected, fallback to native video volume
      this.audioGraphReady = false;
    }
  }

  initVideoEvents() {
    this.video.addEventListener('loadedmetadata', () => {
      this.duration = this.video.duration;
      this.onStateChange({ type: 'metadata_loaded', duration: this.duration });
    });

    this.video.addEventListener('timeupdate', () => {
      this.currentTime = this.video.currentTime;
      this.onStateChange({
        type: 'time_updated',
        currentTime: this.currentTime,
        duration: this.video.duration || 1,
        buffered: this.getBufferedRanges()
      });
    });

    this.video.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.onStateChange({ type: 'play_state', isPlaying: true });
    });

    this.video.addEventListener('pause', () => {
      this.isPlaying = false;
      this.onStateChange({ type: 'play_state', isPlaying: false });
    });

    this.video.addEventListener('ended', () => {
      this.isPlaying = false;
      this.onStateChange({ type: 'ended' });
    });

    this.video.addEventListener('error', (e) => {
      const err = this.video.error;
      const errorMsg = err ? (err.message || `MediaError Code ${err.code}`) : 'Unknown video playback error';
      console.warn('HTML5 Video Error:', errorMsg, err);
      this.isPlaying = false;
      this.onStateChange({ type: 'video_error', error: errorMsg, code: err?.code });
    });

    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      this.onStateChange({ type: 'fullscreen_changed', isFullscreen: this.isFullscreen });
    });
  }

  initKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) this.seekBy(-10);
          else if (e.ctrlKey) this.seekBy(-30);
          else this.seekBy(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) this.seekBy(10);
          else if (e.ctrlKey) this.seekBy(30);
          else this.seekBy(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.adjustVolume(0.05); // +5%
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.adjustVolume(-0.05); // -5%
          break;
        case 'KeyM':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'KeyP':
          e.preventDefault();
          this.togglePictureInPicture();
          break;
        case 'KeyS':
          if (e.shiftKey) {
            e.preventDefault();
            this.captureSnapshot();
          }
          break;
      }
    });
  }

  // Load a video source
  loadSource(src, title = 'Media Track') {
    this.video.src = src;
    this.video.load();
    this.onStateChange({ type: 'source_loaded', title, src });
  }

  togglePlay() {
    this.ensureAudioGraph();
    if (this.video.paused) {
      this.video.play().catch(() => {});
    } else {
      this.video.pause();
    }
  }

  play() {
    this.ensureAudioGraph();
    this.video.play().catch(() => {});
  }

  pause() {
    this.video.pause();
  }

  seekTo(seconds) {
    const clamped = Math.max(0, Math.min(this.video.duration || 0, seconds));
    this.video.currentTime = clamped;
  }

  seekBy(deltaSeconds) {
    this.seekTo(this.video.currentTime + deltaSeconds);
    this.onStateChange({
      type: 'osd_message',
      title: 'Seek',
      text: `${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s (${this.formatTime(this.video.currentTime)})`,
      icon: deltaSeconds > 0 ? '⏩' : '⏪'
    });
  }

  // Volume with 200% boost (VLC signature feature)
  setVolume(vol) {
    this.ensureAudioGraph();
    const clamped = Math.max(0, Math.min(2.0, vol)); // 0% to 200%
    this.volume = Math.round(clamped * 100) / 100;
    this.isMuted = this.volume === 0;

    this.updateVolume();

    this.onStateChange({
      type: 'volume_changed',
      volume: this.volume,
      percent: Math.round(this.volume * 100),
      isMuted: this.isMuted
    });
  }

  adjustVolume(delta) {
    this.setVolume(this.volume + delta);
    this.onStateChange({
      type: 'osd_message',
      title: 'Volume',
      text: `${Math.round(this.volume * 100)}%`,
      icon: ''
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateVolume();
    this.onStateChange({
      type: 'volume_changed',
      volume: this.volume,
      percent: this.isMuted ? 0 : Math.round(this.volume * 100),
      isMuted: this.isMuted
    });
    this.onStateChange({
      type: 'osd_message',
      title: 'Mute',
      text: this.isMuted ? 'Muted' : `${Math.round(this.volume * 100)}%`,
      icon: ''
    });
  }

  updateVolume() {
    if (this.isMuted) {
      this.video.volume = 0;
      if (this.gainNode) this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
      return;
    }

    if (this.audioGraphReady && this.gainNode) {
      // Normal video volume at 1.0, and gain node handles up to 2.0x boost
      this.video.volume = 1.0;
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    } else {
      // Fallback: standard HTML5 video volume clamped to 1.0
      this.video.volume = Math.min(1.0, this.volume);
    }
  }

  // Equalizer adjustments
  setEqualizer(band, gainValue) {
    this.ensureAudioGraph();
    if (!this.audioGraphReady) return;
    const gain = Math.max(-12, Math.min(12, gainValue)); // -12dB to +12dB
    if (band === 'bass' && this.eqBass) this.eqBass.gain.setValueAtTime(gain, this.audioCtx.currentTime);
    if (band === 'mid' && this.eqMid) this.eqMid.gain.setValueAtTime(gain, this.audioCtx.currentTime);
    if (band === 'treble' && this.eqTreble) this.eqTreble.gain.setValueAtTime(gain, this.audioCtx.currentTime);
  }

  // Video Filters (Brightness, Contrast, Saturation, Hue)
  setFilter(key, value) {
    if (this.filters[key] !== undefined) {
      this.filters[key] = value;
      this.applyVideoFilters();
    }
  }

  applyVideoFilters() {
    const filterString = `brightness(${this.filters.brightness}%) contrast(${this.filters.contrast}%) saturate(${this.filters.saturation}%) hue-rotate(${this.filters.hue}deg)`;
    this.video.style.filter = filterString;
    this.onStateChange({ type: 'filters_updated', filters: { ...this.filters } });
  }

  resetFilters() {
    this.filters = { brightness: 100, contrast: 100, saturation: 100, hue: 0 };
    this.applyVideoFilters();
  }

  // Aspect Ratio Mode
  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    this.video.classList.remove('ar-16-9', 'ar-4-3', 'ar-235-1', 'ar-fill', 'ar-auto');
    if (ratio === '16:9') this.video.classList.add('ar-16-9');
    else if (ratio === '4:3') this.video.classList.add('ar-4-3');
    else if (ratio === '2.35:1') this.video.classList.add('ar-235-1');
    else if (ratio === 'fill') this.video.classList.add('ar-fill');
    else this.video.classList.add('ar-auto');

    this.onStateChange({
      type: 'aspect_ratio_changed',
      ratio,
      label: ratio.toUpperCase()
    });
    this.onStateChange({
      type: 'osd_message',
      title: 'Aspect Ratio',
      text: ratio.toUpperCase(),
      icon: ''
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  togglePictureInPicture() {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (document.pictureInPictureEnabled && this.video) {
      this.video.requestPictureInPicture().catch(() => {});
    }
  }

  // Snapshot current frame
  captureSnapshot() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.video.videoWidth || 1920;
      canvas.height = this.video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `WHELO_Snapshot_${Math.floor(this.video.currentTime)}s.png`;
      a.click();
      this.onStateChange({
        type: 'osd_message',
        title: 'Snapshot',
        text: 'Frame saved to Downloads',
        icon: ''
      });
    } catch (e) {
      this.onStateChange({
        type: 'osd_message',
        title: 'Snapshot Failed',
        text: 'CORS protected media',
        icon: ''
      });
    }
  }

  getBufferedRanges() {
    const ranges = [];
    if (!this.video.buffered) return ranges;
    for (let i = 0; i < this.video.buffered.length; i++) {
      ranges.push({
        start: this.video.buffered.start(i),
        end: this.video.buffered.end(i)
      });
    }
    return ranges;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }
}
