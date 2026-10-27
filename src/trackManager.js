// Track Manager for WHELO (VLC-style Audio & Subtitle Track Control)
// Full detection of embedded MKV/MP4 audio and subtitle tracks via ffprobe/ffmpeg IPC & EBML parser
// Provides real-time track switching, sub-second extraction, V/B hotkeys, and OSD feedback

import { parseContainerTracks } from './containerParser.js';

export class TrackManager {
  constructor(videoElement, subtitleManager, playerEngine, onStateChange = () => {}) {
    this.video = videoElement;
    this.subtitles = subtitleManager;
    this.player = playerEngine;
    this.onStateChange = onStateChange;

    this.currentFilePath = null;
    this.currentFileBlob = null;

    this.audioTracks = [];
    this.activeAudioIndex = 0;

    this.subtitleTracks = [];
    this.activeSubtitleIndex = 0; // -1 means disabled

    // Secondary audio element for synchronized multi-track audio playback
    this.secondaryAudio = new Audio();
    this.secondaryAudio.preload = 'auto';
    this.initSecondaryAudioSync();

    this.initVideoListeners();
  }

  initSecondaryAudioSync() {
    this.video.addEventListener('play', () => {
      if (this.activeAudioIndex > 0 && this.secondaryAudio.src) {
        this.secondaryAudio.currentTime = this.video.currentTime;
        this.secondaryAudio.playbackRate = this.video.playbackRate;
        this.secondaryAudio.play().catch(() => {});
      }
    });

    this.video.addEventListener('pause', () => {
      if (this.secondaryAudio.src) {
        this.secondaryAudio.pause();
      }
    });

    this.video.addEventListener('seeking', () => {
      if (this.activeAudioIndex > 0 && this.secondaryAudio.src) {
        this.secondaryAudio.currentTime = this.video.currentTime;
      }
    });

    this.video.addEventListener('seeked', () => {
      if (this.activeAudioIndex > 0 && this.secondaryAudio.src) {
        this.secondaryAudio.currentTime = this.video.currentTime;
      }
    });

    this.video.addEventListener('ratechange', () => {
      if (this.secondaryAudio.src) {
        this.secondaryAudio.playbackRate = this.video.playbackRate;
      }
    });
  }

  initVideoListeners() {
    if (this.video.textTracks) {
      this.video.textTracks.addEventListener('addtrack', () => {
        this.detectBrowserTracks();
      });
    }

    this.video.addEventListener('loadedmetadata', () => {
      this.detectBrowserTracks();
    });
  }

  // Load tracks for a media item (sample or local file)
  async loadMediaTracks(mediaItem) {
    this.currentFilePath = mediaItem.filePath || null;
    this.currentFileBlob = mediaItem.fileBlob || null;
    if (this.subtitles && typeof this.subtitles.setCurrentFilePath === 'function') {
      this.subtitles.setCurrentFilePath(this.currentFilePath);
    }

    // Reset secondary audio
    if (this.secondaryAudio.src) {
      this.secondaryAudio.pause();
      this.secondaryAudio.src = '';
    }

    let detectedAudio = [];
    let detectedSubs = [];

    // 1. If in Electron and we have a local filesystem path, probe directly via ffprobe
    if (this.currentFilePath && window.electronAPI && typeof window.electronAPI.probeMedia === 'function') {
      try {
        const probeResult = await window.electronAPI.probeMedia(this.currentFilePath);
        console.log('[WHELO] probeMedia returned streams for:', this.currentFilePath, 'audioTracks:', probeResult?.audioTracks?.length, 'subTracks:', probeResult?.subtitleTracks?.length);
        if (probeResult) {
          if (Array.isArray(probeResult.audioTracks) && probeResult.audioTracks.length > 0) {
            detectedAudio = probeResult.audioTracks;
          }
          if (Array.isArray(probeResult.subtitleTracks) && probeResult.subtitleTracks.length > 0) {
            detectedSubs = probeResult.subtitleTracks;
          }
        }
      } catch (err) {
        console.warn('Native probe failed, falling back to container parser:', err.message);
      }
    }

    // 2. If no tracks detected yet, parse container headers (MKV EBML / MP4 boxes) via pure JS
    if ((detectedAudio.length === 0 || detectedSubs.length === 0) && this.currentFileBlob) {
      try {
        const parsed = await parseContainerTracks(this.currentFileBlob);
        if (detectedAudio.length === 0 && parsed.audioTracks.length > 0) {
          detectedAudio = parsed.audioTracks;
        }
        if (detectedSubs.length === 0 && parsed.subtitleTracks.length > 0) {
          detectedSubs = parsed.subtitleTracks;
        }
      } catch (err) {
        console.warn('Container parser fallback error:', err);
      }
    }

    // 3. Audio Tracks Assignment
    if (detectedAudio.length > 0) {
      this.audioTracks = detectedAudio;
      this.activeAudioIndex = 0;
    } else if (mediaItem.audioTracks && mediaItem.audioTracks.length > 0) {
      this.audioTracks = mediaItem.audioTracks.map((t, idx) => ({
        id: t.id || `audio-${idx}`,
        streamIndex: t.streamIndex || idx,
        name: t.name || `Track ${idx + 1}`,
        lang: t.lang || 'und',
        profile: t.profile || 'normal',
        isNative: false
      }));
      this.activeAudioIndex = 0;
    } else {
      this.audioTracks = [
        { id: 'audio-main', streamIndex: 0, name: 'Track 1 - Default Audio', lang: 'und', profile: 'normal', isNative: false }
      ];
      this.activeAudioIndex = 0;
    }

    // 4. Subtitle Tracks Assignment
    if (detectedSubs.length > 0) {
      this.subtitleTracks = detectedSubs;
      this.activeSubtitleIndex = 0;

      // Extract and load the first detected subtitle track immediately by default!
      await this.extractAndApplySubtitleTrack(0);
    } else if (mediaItem.subtitleTracks && mediaItem.subtitleTracks.length > 0) {
      this.subtitleTracks = mediaItem.subtitleTracks.map((s, idx) => ({
        id: s.id || `sub-${idx}`,
        streamIndex: s.streamIndex || idx,
        name: s.name || `Track ${idx + 1}`,
        lang: s.lang || 'und',
        content: s.content || '',
        isNative: false
      }));
      this.activeSubtitleIndex = 0;
      this.subtitles.loadSubtitles(this.subtitleTracks[0].content);
      this.subtitles.setEnabled(true);
    } else if (mediaItem.subtitlesContent) {
      this.subtitleTracks = [
        { id: 'sub-main', streamIndex: 0, name: 'Track 1 [Default Subtitles]', lang: 'en', content: mediaItem.subtitlesContent, isNative: false }
      ];
      this.activeSubtitleIndex = 0;
      this.subtitles.loadSubtitles(mediaItem.subtitlesContent);
      this.subtitles.setEnabled(true);
    } else {
      this.subtitleTracks = [];
      this.activeSubtitleIndex = -1;
      this.subtitles.loadSubtitles('');
      this.subtitles.setEnabled(false);
    }

    this.detectBrowserTracks();
    this.notifyTrackUpdate();
  }

  // Extract and activate a subtitle track from the video file
  async extractAndApplySubtitleTrack(index) {
    if (index < 0 || index >= this.subtitleTracks.length) return;
    const track = this.subtitleTracks[index];

    // If already extracted, load directly
    if (track.content) {
      this.subtitles.loadSubtitles(track.content);
      this.subtitles.setEnabled(true);
      return;
    }

    // Extract via native ffmpeg if available
    if (this.currentFilePath && track.streamIndex !== undefined && window.electronAPI && typeof window.electronAPI.extractSubtitle === 'function') {
      try {
        const vttText = await window.electronAPI.extractSubtitle(this.currentFilePath, track.streamIndex);
        console.log('[WHELO] extractSubtitle stream', track.streamIndex, 'extracted bytes:', vttText?.length);
        if (vttText && vttText.trim().length > 0) {
          track.content = vttText;
          this.subtitles.loadSubtitles(vttText);
          console.log('[WHELO] Loaded subtitles into subtitleManager, cue count:', this.subtitles.cues.length);
          this.subtitles.setEnabled(true);
          return;
        }
      } catch (err) {
        console.warn(`Failed to extract subtitle stream ${track.streamIndex}:`, err.message);
      }
    }

    this.subtitles.setEnabled(true);
  }

  // Detect HTML5 video text tracks or audioTracks
  detectBrowserTracks() {
    if (this.video.textTracks && this.video.textTracks.length > 0) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const t = this.video.textTracks[i];
        t.mode = 'hidden'; // Suppress browser default overlay
      }
    }
  }

  // Set active audio track
  async selectAudioTrack(index) {
    if (index < -1 || index >= this.audioTracks.length) return;
    this.activeAudioIndex = index;

    if (index === -1) {
      // Disable audio
      this.video.muted = true;
      if (this.secondaryAudio.src) this.secondaryAudio.pause();
      this.showOSD('Audio Track', 'Disable', '');
    } else if (index === 0) {
      // Primary track: use video audio
      if (this.secondaryAudio.src) this.secondaryAudio.pause();
      this.video.muted = false;

      // Experimental Chromium audioTracks switching if supported
      if (this.video.audioTracks && this.video.audioTracks.length > 0) {
        for (let i = 0; i < this.video.audioTracks.length; i++) {
          this.video.audioTracks[i].enabled = (i === 0);
        }
      }

      const track = this.audioTracks[0];
      this.applyAudioProfile(track.profile);
      this.showOSD('Audio Track', `${track.name} [1/${this.audioTracks.length}]`, '');
    } else {
      // Secondary track
      const track = this.audioTracks[index];

      // If in Electron and we have a streamIndex, demux track to temp audio file
      if (this.currentFilePath && track.streamIndex !== undefined && window.electronAPI && typeof window.electronAPI.extractAudio === 'function') {
        try {
          if (!track.tempAudioPath) {
            this.showOSD('Audio Track', `Demuxing ${track.name}...`, '⏳');
            track.tempAudioPath = await window.electronAPI.extractAudio(this.currentFilePath, track.streamIndex);
          }

          if (track.tempAudioPath) {
            this.video.muted = true; // Mute primary video track
            const cleanAudio = track.tempAudioPath.replace(/\\/g, '/');
            this.secondaryAudio.src = 'file:///' + cleanAudio.replace(/^([A-Za-z]):/, '$1:');
            this.secondaryAudio.currentTime = this.video.currentTime;
            this.secondaryAudio.playbackRate = this.video.playbackRate;
            this.secondaryAudio.volume = Math.min(1.0, this.player.volume || 1.0);
            if (!this.video.paused) {
              this.secondaryAudio.play().catch(() => {});
            }
          }
        } catch (err) {
          console.warn('Audio track extraction failed:', err);
          // Fallback to video volume
          this.video.muted = false;
        }
      } else if (this.video.audioTracks && this.video.audioTracks.length > index) {
        for (let i = 0; i < this.video.audioTracks.length; i++) {
          this.video.audioTracks[i].enabled = (i === index);
        }
      }

      this.applyAudioProfile(track.profile);
      this.showOSD('Audio Track', `${track.name} [${index + 1}/${this.audioTracks.length}]`, '');
    }

    this.notifyTrackUpdate();
  }

  applyAudioProfile(profile) {
    if (profile === 'voice-boost') {
      this.player.setEqualizer('mid', 5);
      this.player.setEqualizer('treble', 2);
      this.player.setEqualizer('bass', -2);
    } else if (profile === 'commentary') {
      this.player.setEqualizer('mid', 4);
      this.player.setEqualizer('bass', -3);
    } else {
      this.player.setEqualizer('bass', 0);
      this.player.setEqualizer('mid', 0);
      this.player.setEqualizer('treble', 0);
    }
  }

  // Cycle audio track (Hotkey B / Shift+B)
  cycleAudioTrack(direction = 1) {
    if (this.audioTracks.length === 0) {
      this.showOSD('Audio Track', 'No tracks available', '');
      return;
    }

    let nextIndex = this.activeAudioIndex + direction;
    if (nextIndex >= this.audioTracks.length) {
      nextIndex = 0; // Loop back
    } else if (nextIndex < 0) {
      nextIndex = this.audioTracks.length - 1;
    }

    this.selectAudioTrack(nextIndex);
  }

  // Set active subtitle track
  async selectSubtitleTrack(index) {
    if (index < -1 || index >= this.subtitleTracks.length) return;
    this.activeSubtitleIndex = index;

    if (index === -1) {
      // Disable subtitles
      this.subtitles.setEnabled(false);
      this.showOSD('Subtitle Track', 'Disable', '');
    } else {
      await this.extractAndApplySubtitleTrack(index);
      const track = this.subtitleTracks[index];
      this.showOSD('Subtitle Track', `${track.name} [${index + 1}/${this.subtitleTracks.length}]`, '');
    }

    this.notifyTrackUpdate();
  }

  // Cycle subtitle track (Hotkey V / Shift+V)
  cycleSubtitleTrack(direction = 1) {
    const totalOptions = this.subtitleTracks.length + 1; // Includes "Disable" (-1)
    if (this.subtitleTracks.length === 0) {
      this.showOSD('Subtitle Track', 'No subtitles loaded', '');
      return;
    }

    // Sequence: 0 -> 1 -> ... -> (N-1) -> -1 (Disable) -> 0
    let currentPos = this.activeSubtitleIndex === -1 ? this.subtitleTracks.length : this.activeSubtitleIndex;
    let nextPos = (currentPos + direction + totalOptions) % totalOptions;

    let nextIndex = nextPos === this.subtitleTracks.length ? -1 : nextPos;
    this.selectSubtitleTrack(nextIndex);
  }

  // Add a newly loaded subtitle file (from Open File or VLSub)
  addCustomSubtitle(name, content) {
    const newTrack = {
      id: `custom-sub-${Date.now()}`,
      name: name || `External Subtitle [${this.subtitleTracks.length + 1}]`,
      lang: 'ext',
      content: content,
      isCustom: true,
      isNative: false
    };

    this.subtitleTracks.push(newTrack);
    this.selectSubtitleTrack(this.subtitleTracks.length - 1);
  }

  getAudioTracks() {
    return this.audioTracks.map((t, idx) => ({
      ...t,
      isActive: idx === this.activeAudioIndex
    }));
  }

  getSubtitleTracks() {
    return this.subtitleTracks.map((t, idx) => ({
      ...t,
      isActive: idx === this.activeSubtitleIndex
    }));
  }

  notifyTrackUpdate() {
    this.onStateChange({
      type: 'tracks_updated',
      audioTracks: this.getAudioTracks(),
      subtitleTracks: this.getSubtitleTracks(),
      activeAudioIndex: this.activeAudioIndex,
      activeSubtitleIndex: this.activeSubtitleIndex
    });
  }

  showOSD(title, text, icon = '') {
    this.onStateChange({
      type: 'osd_message',
      title,
      text,
      icon
    });
  }
}
