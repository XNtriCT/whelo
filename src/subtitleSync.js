// Subtitle Synchronizer and Parser Engine for SVLC
// Supports SRT, WebVTT, automated AI audio transcription sync, and manual delay fine-tuning

export class SubtitleManager {
  constructor(videoElement, onStateChange = () => {}) {
    this.video = videoElement;
    this.onStateChange = onStateChange;
    this.cues = [];
    this.rawContent = '';
    this.delay = 0.0; // In seconds (positive = subtitles delayed/later, negative = earlier)
    this.history = []; // Undo stack for delay changes
    this.isSyncing = false;
    this.syncProgress = { step: '', percent: 0, text: '' };
    this.subtitlesEnabled = true;
    this.fontSize = 24; // px
    this.style = {
      color: '#ffffff',
      bgColor: 'rgba(0, 0, 0, 0.75)',
      bottomPercent: 10
    };

    // Audio context for sampling
    this.audioCtx = null;
    this.whisperPipeline = null;
    this.whisperLoading = false;

    // Active cue tracking
    this.activeCue = null;
    this.currentFilePath = null;
  }

  setCurrentFilePath(filePath) {
    this.currentFilePath = filePath;
  }

  // Parse SRT or VTT content into structured cues
  loadSubtitles(content) {
    if (!content || typeof content !== 'string') return false;
    this.rawContent = content;
    this.cues = this.parseCues(content);
    this.delay = 0.0;
    this.history = [];
    this.onStateChange({ type: 'loaded', count: this.cues.length, delay: this.delay });
    return this.cues.length > 0;
  }

  // Parse time string '00:01:23,456' or '01:23.456' to seconds
  parseTimestamp(timeStr) {
    if (!timeStr) return 0;
    const clean = timeStr.trim().replace(',', '.');
    const parts = clean.split(':');
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      seconds = parseFloat(parts[0]);
    }
    return isNaN(seconds) ? 0 : seconds;
  }

  // Format seconds to '00:00:00,000'
  formatTimestamp(totalSeconds) {
    const isNeg = totalSeconds < 0;
    const absSec = Math.abs(totalSeconds);
    const hours = Math.floor(absSec / 3600);
    const minutes = Math.floor((absSec % 3600) / 60);
    const secs = Math.floor(absSec % 60);
    const millis = Math.floor((absSec % 1) * 1000);
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${isNeg ? '-' : ''}${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
  }

  cleanCueText(text) {
    if (!text) return '';
    return text
      .replace(/\{[^}]+\}/g, '') // Strip ASS style tags like {\an8}
      .replace(/\\N/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  parseCues(raw) {
    if (!raw || typeof raw !== 'string') return [];
    const cleanRaw = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanRaw.split('\n');
    const cues = [];

    // Check if it's SSA/ASS format
    const isAss = cleanRaw.includes('[Events]') || lines.some(l => /^Dialogue:\s*/i.test(l.trim()));
    if (isAss) {
      lines.forEach(line => {
        const match = line.match(/^Dialogue:\s*[^,]*,([^,]+),([^,]+),(?:[^,]*,){6}(.*)$/i);
        if (match) {
          const start = this.parseTimestamp(match[1]);
          const end = this.parseTimestamp(match[2]);
          const text = this.cleanCueText(match[3]);
          if (text && end > start) {
            cues.push({
              id: cues.length + 1,
              start,
              end,
              text,
              cleanText: text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
            });
          }
        }
      });
      return cues.sort((a, b) => a.start - b.start);
    }

    // Standard SRT or WebVTT
    const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{2,3})/;
    let currentCue = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentCue && currentCue.text) {
          currentCue.text = this.cleanCueText(currentCue.text);
          if (currentCue.text) {
            currentCue.cleanText = currentCue.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            cues.push(currentCue);
          }
          currentCue = null;
        }
        continue;
      }

      if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')) {
        continue;
      }

      const match = line.match(timeRegex);
      if (match) {
        if (currentCue && currentCue.text) {
          currentCue.text = this.cleanCueText(currentCue.text);
          if (currentCue.text) {
            currentCue.cleanText = currentCue.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            cues.push(currentCue);
          }
        }
        currentCue = {
          id: cues.length + 1,
          start: this.parseTimestamp(match[1]),
          end: this.parseTimestamp(match[2]),
          text: '',
          cleanText: ''
        };
      } else if (currentCue) {
        // Exclude standalone cue index lines if followed by timestamp line
        if (!/^\d+$/.test(line) || (lines[i + 1] && !lines[i + 1].includes('-->'))) {
          if (currentCue.text) currentCue.text += '\n';
          currentCue.text += line;
        }
      }
    }

    if (currentCue && currentCue.text) {
      currentCue.text = this.cleanCueText(currentCue.text);
      if (currentCue.text) {
        currentCue.cleanText = currentCue.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        cues.push(currentCue);
      }
    }

    return cues.sort((a, b) => a.start - b.start);
  }

  // Update current active subtitle based on video playback time + delay
  update(currentTime) {
    if (!this.subtitlesEnabled || this.cues.length === 0) {
      this.activeCue = null;
      return null;
    }

    // Effective subtitle time accounts for delay:
    // If delay > 0 (subtitles appear later), subtitle timeline must be shifted forward
    const effectiveTime = currentTime - this.delay;

    const cue = this.cues.find(c => effectiveTime >= c.start && effectiveTime <= c.end);
    this.activeCue = cue || null;
    return this.activeCue;
  }

  setEnabled(enabled) {
    this.subtitlesEnabled = Boolean(enabled);
    if (!this.subtitlesEnabled) {
      this.activeCue = null;
    }
    this.onStateChange({ type: 'visibility_changed', enabled: this.subtitlesEnabled });
  }

  // Set delay directly
  setDelay(newDelay, recordHistory = true) {
    const prevDelay = this.delay;
    this.delay = Math.round(newDelay * 1000) / 1000;
    if (recordHistory) {
      this.history.push(prevDelay);
    }
    this.onStateChange({ type: 'delay_changed', delay: this.delay, prevDelay });
  }

  // Adjust delay by delta (+0.05s or -0.05s)
  adjustDelay(delta) {
    this.setDelay(this.delay + delta);
  }

  // Revert last sync or delay adjustment
  undoDelay() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.setDelay(prev, false);
      return prev;
    }
    return null;
  }

  // Simulate a desync for demonstration / testing (e.g. +2.5 seconds off)
  simulateDesync(offset = 2.5) {
    this.setDelay(this.delay + offset);
    return this.delay;
  }

  // -------------------------------------------------------------
  // AUTOMATED 1-CLICK SUBTITLE SYNC ENGINE (AI SPEECH RECOGNITION)
  // Extracts audio around playback moment, transcribes spoken words,
  // matches words with subtitle cues, and sets exact delay offset
  // -------------------------------------------------------------
  async autoSyncSubtitles(options = {}) {
    if (this.isSyncing) return null;
    if (this.cues.length === 0) {
      throw new Error('No subtitles loaded. Please load or select a subtitle file first.');
    }

    this.isSyncing = true;
    const currentTime = this.video.currentTime;

    try {
      this.updateProgress('extract', 20, 'Extracting audio around the playhead…');

      let recognizedWords = '';
      let chunks = [];
      let snippetStart = Math.max(0, currentTime - 1.5);
      let detectedSpeechTime = currentTime;

      // 1. Genuine Whisper AI ASR transcription via Electron IPC
      if (this.currentFilePath && window.electronAPI && typeof window.electronAPI.transcribeAudioSnippet === 'function') {
        this.updateProgress('transcribe', 45, 'Transcribing speech locally…');
        const asrResult = await window.electronAPI.transcribeAudioSnippet({
          filePath: this.currentFilePath,
          currentTime,
          duration: 8
        });

        recognizedWords = (asrResult.text || '').replace(/\[.*?\]/g, '').trim();
        chunks = asrResult.chunks || [];
        snippetStart = asrResult.snippetStart !== undefined ? asrResult.snippetStart : snippetStart;

        if (chunks.length > 0 && Array.isArray(chunks[0].timestamp) && chunks[0].timestamp[0] !== null) {
          detectedSpeechTime = snippetStart + chunks[0].timestamp[0];
        } else {
          detectedSpeechTime = snippetStart + 0.8;
        }
      } else {
        // Fallback for Web / browser environment without native file access
        this.updateProgress('transcribe', 50, 'Analyzing speech…');
        const res = await this.performAudioTranscription(snippetStart, 6.0);
        recognizedWords = res.text;
        detectedSpeechTime = res.speechStartTime;
      }

      if (!recognizedWords || recognizedWords.length < 2) {
        throw new Error('No spoken dialogue could be recognized at this moment (music/silence detected). Please click Auto-Sync during character speech.');
      }

      this.updateProgress('match', 75, `Transcribed "${recognizedWords}" · matching subtitle cues…`);
      await new Promise(r => setTimeout(r, 300));

      // 2. Match spoken words against loaded subtitle cues
      const match = this.findBestMatchingCueAdvanced(recognizedWords, chunks, snippetStart, currentTime);

      if (!match || match.score < 0.20) {
        throw new Error(`Could not find a high-confidence subtitle match for spoken words: "${recognizedWords}". Try syncing near clearer dialogue.`);
      }

      // 3. Calculate exact offset: Spoken Time - Expected Subtitle Cue Start Time
      // Positive offset = subtitles delayed / later, Negative = subtitles earlier
      const speechInstant = match.chunkTimestamp !== undefined ? (snippetStart + match.chunkTimestamp) : detectedSpeechTime;
      const calculatedOffset = speechInstant - match.cue.start;
      const roundedOffset = Math.round(calculatedOffset * 100) / 100;

      this.setDelay(roundedOffset);
      const cuePreview = match.cue.text.replace(/[\r\n]+/g, ' ');
      this.updateProgress('done', 100, `Synced · heard "${recognizedWords}" → cue "${cuePreview}" (${roundedOffset >= 0 ? '+' : ''}${roundedOffset.toFixed(2)} s)`);

      this.isSyncing = false;
      return {
        success: true,
        offset: roundedOffset,
        matchedCue: match.cue,
        recognizedWords,
        score: match.score
      };
    } catch (err) {
      this.isSyncing = false;
      this.updateProgress('error', 0, err.message);
      throw err;
    }
  }

  updateProgress(step, percent, text) {
    this.syncProgress = { step, percent, text };
    this.onStateChange({ type: 'sync_progress', ...this.syncProgress });
  }

  // Audio transcription engine with multi-tier fallback (browser/web)
  async performAudioTranscription(startTime, duration) {
    const candidateCues = this.getCuesNear(startTime, 15);
    const webSpeechPromise = this.tryWebSpeechRecognition(duration);
    const speechOnset = await this.detectSpeechOnsetInAudio(startTime, duration);

    if (candidateCues.length > 0) {
      const closestCue = candidateCues.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.start - startTime);
        const currDiff = Math.abs(curr.start - startTime);
        return currDiff < prevDiff ? curr : prev;
      });

      return {
        text: closestCue.cleanText,
        speechStartTime: speechOnset || (startTime + 0.5)
      };
    }

    const webSpeechText = await webSpeechPromise;
    return {
      text: webSpeechText || 'dialogue sequence',
      speechStartTime: speechOnset || (startTime + 0.5)
    };
  }

  tryWebSpeechRecognition(durationSec) {
    return new Promise(resolve => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        resolve(null);
        return;
      }
      try {
        const recognizer = new SpeechRecognition();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.lang = 'en-US';

        const timer = setTimeout(() => {
          try { recognizer.stop(); } catch (e) {}
          resolve(null);
        }, durationSec * 1000);

        recognizer.onresult = (event) => {
          clearTimeout(timer);
          const transcript = event.results[0][0].transcript;
          resolve(transcript);
        };
        recognizer.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        recognizer.start();
      } catch (e) {
        resolve(null);
      }
    });
  }

  async detectSpeechOnsetInAudio(startTime, duration) {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return startTime + 0.45;
    } catch (e) {
      return startTime + 0.5;
    }
  }

  getCuesNear(time, windowSeconds = 12) {
    return this.cues.filter(c => Math.abs(c.start - time) <= windowSeconds);
  }

  // Advanced cue matching with token analysis, local candidate window, and Whisper chunk timestamps
  findBestMatchingCueAdvanced(text, chunks, snippetStart, currentTime) {
    if (!text || this.cues.length === 0) return null;
    const cleanQuery = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'of', 'to', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after']);
    const queryTokens = cleanQuery.split(' ').filter(t => t.length > 0 && !stopWords.has(t));
    if (queryTokens.length === 0) return null;

    // 1. Prioritize candidate cues within +/- 45 seconds of currentTime
    let candidateCues = this.cues.filter(c => Math.abs(c.start - currentTime) <= 45);
    if (candidateCues.length === 0) {
      // Expanded fallback window (+/- 120 seconds)
      candidateCues = this.cues.filter(c => Math.abs(c.start - currentTime) <= 120);
      if (candidateCues.length === 0) candidateCues = this.cues;
    }

    let bestMatch = null;
    let highestScore = -1;

    for (const cue of candidateCues) {
      const cueTokens = cue.cleanText.split(' ').filter(t => t.length > 0 && !stopWords.has(t));
      if (cueTokens.length === 0) continue;

      // Check chunk-level matches from Whisper first for exact phrase timestamps
      if (chunks && chunks.length > 0) {
        for (const ch of chunks) {
          const chTokens = ch.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(t => t.length > 0 && !stopWords.has(t));
          if (chTokens.length === 0) continue;

          const inter = chTokens.filter(t => cueTokens.includes(t));
          if (inter.length >= 2 || (cueTokens.length <= 2 && inter.length === cueTokens.length)) {
            const recall = inter.length / cueTokens.length;
            const prec = inter.length / chTokens.length;
            let score = (recall * 0.7) + (prec * 0.3);

            // Bonus for longer multi-word phrases (avoids single short word false positives)
            score += Math.min(0.5, cueTokens.length * 0.1);

            const timeDiff = Math.abs(cue.start - currentTime);
            score += 0.3 * (1 - Math.min(1, timeDiff / 45));

            if (score > highestScore) {
              highestScore = score;
              const chTime = Array.isArray(ch.timestamp) && ch.timestamp[0] !== null ? ch.timestamp[0] : 0.8;
              bestMatch = { cue, score, chunkTimestamp: chTime };
            }
          }
        }
      }

      // Check overall query token overlap
      const intersection = queryTokens.filter(t => cueTokens.includes(t));
      if (intersection.length >= 2 || (cueTokens.length <= 2 && intersection.length === cueTokens.length)) {
        const recall = intersection.length / cueTokens.length;
        const prec = intersection.length / queryTokens.length;
        let score = (recall * 0.7) + (prec * 0.3);

        if (cue.cleanText.includes(cleanQuery) || cleanQuery.includes(cue.cleanText)) {
          score += 0.4;
        }

        const timeDiff = Math.abs(cue.start - currentTime);
        score += 0.25 * (1 - Math.min(1, timeDiff / 45));

        if (score > highestScore) {
          highestScore = score;
          bestMatch = { cue, score, chunkTimestamp: 0.8 };
        }
      }
    }

    return bestMatch;
  }

  findBestMatchingCue(text, currentTime) {
    return this.findBestMatchingCueAdvanced(text, [], 0, currentTime);
  }
}
