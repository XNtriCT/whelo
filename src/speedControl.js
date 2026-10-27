// Interactive Mouse-Wheel Speed Lock Engine (1.0x - 4.0x) for WHELO
// Middle-click locks onto speed control, horizontal mouse movement shifts speed smoothly, middle-click releases
// Speeds below 1.0x are selected via dedicated on-screen button/controls

export class SpeedControlManager {
  constructor(videoElement, containerElement, onSpeedChange = () => {}) {
    this.video = videoElement;
    this.container = containerElement;
    this.onSpeedChange = onSpeedChange;

    this.isLocked = false;
    this.currentSpeed = 1.0;
    
    // Mouse wheel lock boundaries: strictly 1.0x to 4.0x
    this.minWheelSpeed = 1.0;
    this.maxWheelSpeed = 4.0;

    // Absolute player limits (for on-screen button selection)
    this.absoluteMinSpeed = 0.25;
    this.absoluteMaxSpeed = 4.0;

    // Smooth sensitivity: calibrated for natural, fluid hand movement
    this.sensitivity = 0.0035; 

    this.lastX = 0;
    this.accumulatedDelta = 0;
    this.targetSpeed = 1.0;
    this.animationFrameId = null;

    // Audio context for clean subtle activation click
    this.audioFeedbackCtx = null;

    this.initListeners();
  }

  initListeners() {
    // Middle mouse button click (button === 1) over the video player or document
    this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.container.addEventListener('auxclick', (e) => this.handleAuxClick(e));

    // Prevent default middle-click autoscroll behavior in browsers
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1 && (this.isLocked || this.container.contains(e.target))) {
        e.preventDefault();
      }
    }, { passive: false });

    // Pointer movement when locked
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('pointermove', (e) => this.handleMouseMove(e));

    // Escape key releases speed lock
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isLocked) {
        this.disengage();
      }
      // Hotkeys: '[' decreases speed, ']' increases speed, '=' resets to 1.0x
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (e.key === '[') {
          this.setSpeed(Math.max(this.absoluteMinSpeed, this.currentSpeed - 0.1));
        } else if (e.key === ']') {
          this.setSpeed(Math.min(this.absoluteMaxSpeed, this.currentSpeed + 0.1));
        } else if (e.key === '=') {
          this.setSpeed(1.0);
        }
      }
    });

    // Handle pointer lock state changes
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.isLocked) {
        // Pointer lock was released by browser, but maintain lock mode
      }
    });
  }

  handleMouseDown(e) {
    if (e.button === 1) { // Middle click / wheel button
      e.preventDefault();
      e.stopPropagation();
      this.toggleLock(e.clientX);
    }
  }

  handleAuxClick(e) {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  toggleLock(initialX = window.innerWidth / 2) {
    if (this.isLocked) {
      this.disengage();
    } else {
      this.engage(initialX);
    }
  }

  engage(initialX) {
    this.isLocked = true;
    
    // When activating via mouse wheel, ensure speed starts at least 1.0x
    const activeRate = this.video.playbackRate || 1.0;
    this.currentSpeed = Math.max(this.minWheelSpeed, Math.min(this.maxWheelSpeed, activeRate));
    this.targetSpeed = this.currentSpeed;
    this.lastX = initialX;
    this.accumulatedDelta = 0;

    // Apply clamped speed if it was below 1.0x
    if (this.video.playbackRate < this.minWheelSpeed) {
      this.setSpeed(this.minWheelSpeed);
    }

    // Request pointer lock for seamless borderless mouse movement
    try {
      if (this.container.requestPointerLock) {
        this.container.requestPointerLock();
      }
    } catch (err) {
      // Pointer lock fallback uses delta tracking
    }

    this.playAudioFeedback(480, 0.04); // Crisp activation tick

    this.onSpeedChange({
      type: 'lock_engaged',
      speed: this.currentSpeed,
      isLocked: true,
      tier: this.getSpeedTier(this.currentSpeed)
    });
  }

  disengage() {
    if (!this.isLocked) return;
    this.isLocked = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    try {
      if (document.exitPointerLock && document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch (err) {}

    this.playAudioFeedback(340, 0.05); // Disengage confirmation tick

    this.onSpeedChange({
      type: 'lock_disengaged',
      speed: this.currentSpeed,
      isLocked: false,
      tier: this.getSpeedTier(this.currentSpeed)
    });
  }

  handleMouseMove(e) {
    if (!this.isLocked) return;

    // Movement delta from PointerLock or standard coordinates
    let movementX = e.movementX;
    if (movementX === undefined || movementX === 0) {
      movementX = e.clientX - this.lastX;
      this.lastX = e.clientX;
    }

    if (movementX === 0) return;

    // Left movements decrease speed, Right movements increase speed
    // Smooth linear response with zero artificial stickiness or abrupt clamps
    const deltaSpeed = movementX * this.sensitivity;
    
    // Bounded strictly between 1.0x and 4.0x for mouse wheel control
    this.targetSpeed = Math.max(this.minWheelSpeed, Math.min(this.maxWheelSpeed, this.targetSpeed + deltaSpeed));
    
    const roundedSpeed = Math.round(this.targetSpeed * 100) / 100;

    if (roundedSpeed !== this.currentSpeed) {
      this.currentSpeed = roundedSpeed;
      this.applySpeedToVideo(this.currentSpeed);
    }
  }

  // Set speed programmatically (e.g. from on-screen button: 0.25x, 0.5x, 0.75x, 1x, etc.)
  setSpeed(speed) {
    const clamped = Math.max(this.absoluteMinSpeed, Math.min(this.absoluteMaxSpeed, speed));
    this.currentSpeed = Math.round(clamped * 100) / 100;
    this.targetSpeed = this.currentSpeed;
    this.applySpeedToVideo(this.currentSpeed);
  }

  applySpeedToVideo(speed) {
    // Apply speed to video element with pitch preservation
    this.video.playbackRate = speed;
    this.video.preservesPitch = true;

    // Calculate percent relative to 1.0x - 4.0x wheel span
    let percent;
    if (speed < 1.0) {
      percent = 0; // At min boundary
    } else {
      percent = ((speed - this.minWheelSpeed) / (this.maxWheelSpeed - this.minWheelSpeed)) * 100;
    }

    this.onSpeedChange({
      type: 'speed_updated',
      speed: this.currentSpeed,
      isLocked: this.isLocked,
      tier: this.getSpeedTier(this.currentSpeed),
      percent: Math.max(0, Math.min(100, percent))
    });
  }

  getSpeedTier(speed) {
    if (speed < 0.95) return { label: 'SLOW-MO', icon: '', color: '#93a8b8' };
    if (speed >= 0.95 && speed <= 1.05) return { label: 'NORMAL', icon: '', color: '#a9b3bd' };
    if (speed > 1.05 && speed <= 1.75) return { label: 'BRISK', icon: '', color: '#c9b79a' };
    if (speed > 1.75 && speed <= 2.75) return { label: 'FAST', icon: '', color: '#dcc197' };
    return { label: 'WARP', icon: '', color: '#f0dcbe' };
  }

  playAudioFeedback(frequency, duration) {
    try {
      if (!this.audioFeedbackCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioFeedbackCtx = new AudioContext();
      }
      if (this.audioFeedbackCtx.state === 'suspended') {
        this.audioFeedbackCtx.resume();
      }
      const osc = this.audioFeedbackCtx.createOscillator();
      const gain = this.audioFeedbackCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.audioFeedbackCtx.currentTime);
      gain.gain.setValueAtTime(0.03, this.audioFeedbackCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioFeedbackCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioFeedbackCtx.destination);
      osc.start();
      osc.stop(this.audioFeedbackCtx.currentTime + duration);
    } catch (e) {}
  }
}
