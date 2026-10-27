// VLC-Style Nested Right-Click Context Menu for WHELO
// Provides full desktop context control: Media, Playback, Audio Tracks, Video, Subtitles, VLSub, Tools, and View

export class ContextMenuManager {
  constructor({ container, player, trackManager, speedControl, onAction }) {
    this.container = container;
    this.player = player;
    this.trackManager = trackManager;
    this.speedControl = speedControl;
    this.onAction = onAction || (() => {});

    this.menuElement = null;
    this.isOpen = false;

    this.init();
  }

  init() {
    this.createMenuDOM();

    // Prevent default context menu and open VLC custom context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.open(e.clientX, e.clientY);
    });

    // Close on click outside or escape
    document.addEventListener('click', (e) => {
      if (this.isOpen && (!this.menuElement || !this.menuElement.contains(e.target))) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Auto-adjust submenus positioning on hover
    this.menuElement.addEventListener('mouseenter', (e) => {
      this.repositionSubmenus();
    }, true);
  }

  createMenuDOM() {
    this.menuElement = document.createElement('div');
    this.menuElement.id = 'vlc-context-menu';
    this.menuElement.className = 'vlc-context-menu';
    document.body.appendChild(this.menuElement);
  }

  open(clientX, clientY) {
    this.renderMenuContent();
    this.menuElement.classList.add('visible');
    this.isOpen = true;

    // Viewport boundary adjustment
    const rect = this.menuElement.getBoundingClientRect();
    let posX = clientX;
    let posY = clientY;

    if (posX + rect.width > window.innerWidth - 8) {
      posX = window.innerWidth - rect.width - 8;
    }
    if (posY + rect.height > window.innerHeight - 8) {
      posY = window.innerHeight - rect.height - 8;
    }

    this.menuElement.style.left = `${Math.max(8, posX)}px`;
    this.menuElement.style.top = `${Math.max(8, posY)}px`;

    this.repositionSubmenus();
  }

  close() {
    if (!this.isOpen) return;
    this.menuElement.classList.remove('visible');
    this.isOpen = false;
  }

  renderMenuContent() {
    const isPlaying = this.player.isPlaying;
    const currentSpeed = this.speedControl.currentSpeed;
    const audioTracks = this.trackManager.getAudioTracks();
    const subTracks = this.trackManager.getSubtitleTracks();
    const activeSubIndex = this.trackManager.activeSubtitleIndex;
    const activeAudioIndex = this.trackManager.activeAudioIndex;
    const currentAR = this.player.aspectRatio || 'auto';

    this.menuElement.innerHTML = `
      <!-- MEDIA -->
      <div class="menu-item has-submenu">
        <span class="item-label">Media</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="open-file">
            <span class="item-label">Open File...</span>
            <span class="item-shortcut">Ctrl+O</span>
          </div>
          <div class="menu-item" data-action="load-subtitle">
            <span class="item-label">Add Subtitle File...</span>
            <span class="item-shortcut">Ctrl+S</span>
          </div>
        </div>
      </div>

      <!-- PLAYBACK -->
      <div class="menu-item has-submenu">
        <span class="item-label">Playback</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="toggle-play">
            <span class="item-label">${isPlaying ? 'Pause' : 'Play'}</span>
            <span class="item-shortcut">Space</span>
          </div>
          <div class="menu-item" data-action="stop">
            <span class="item-label">Stop</span>
            <span class="item-shortcut">S</span>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item has-submenu">
            <span class="item-label">Jump Forward</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="seek-5">+5 seconds (Right)</div>
              <div class="menu-item" data-action="seek-10">+10 seconds (Shift+Right)</div>
              <div class="menu-item" data-action="seek-30">+30 seconds (Ctrl+Right)</div>
            </div>
          </div>
          <div class="menu-item has-submenu">
            <span class="item-label">Jump Backward</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="seek--5">-5 seconds (Left)</div>
              <div class="menu-item" data-action="seek--10">-10 seconds (Shift+Left)</div>
              <div class="menu-item" data-action="seek--30">-30 seconds (Ctrl+Left)</div>
            </div>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item has-submenu">
            <span class="item-label">Speed</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="set-speed" data-speed="0.25">
                <span class="item-check">${Math.abs(currentSpeed - 0.25) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">0.25×</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="0.5">
                <span class="item-check">${Math.abs(currentSpeed - 0.5) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">0.5×</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="0.75">
                <span class="item-check">${Math.abs(currentSpeed - 0.75) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">0.75×</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="1.0">
                <span class="item-check">${Math.abs(currentSpeed - 1.0) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">1× (Normal)</span>
                <span class="item-shortcut">=</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="1.25">
                <span class="item-check">${Math.abs(currentSpeed - 1.25) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">1.25×</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="1.5">
                <span class="item-check">${Math.abs(currentSpeed - 1.5) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">1.5×</span>
              </div>
              <div class="menu-item" data-action="set-speed" data-speed="2.0">
                <span class="item-check">${Math.abs(currentSpeed - 2.0) < 0.04 ? '✓' : ''}</span>
                <span class="item-label">2×</span>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item" data-action="toggle-wheel-lock">
                <span class="item-label">Lock Mouse Wheel (1.0x - 4.0x)</span>
                <span class="item-shortcut">Middle-Click</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- AUDIO -->
      <div class="menu-item has-submenu">
        <span class="item-label">Audio</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item has-submenu">
            <span class="item-label">Audio Track</span>
            <span class="item-shortcut">B</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu" id="menu-audio-tracks">
              ${audioTracks.map((t, idx) => `
                <div class="menu-item" data-action="select-audio-track" data-index="${idx}">
                  <span class="item-check">${idx === activeAudioIndex ? '✓' : ''}</span>
                  <span class="item-label">${t.name}</span>
                </div>
              `).join('')}
              <div class="menu-divider"></div>
              <div class="menu-item" data-action="select-audio-track" data-index="-1">
                <span class="item-check">${activeAudioIndex === -1 ? '✓' : ''}</span>
                <span class="item-label">Disable Audio</span>
              </div>
            </div>
          </div>
          <div class="menu-item has-submenu">
            <span class="item-label">Stereo Mode</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="stereo-original">
                <span class="item-check">✓</span>
                <span class="item-label">Original Stereo</span>
              </div>
              <div class="menu-item" data-action="stereo-left">
                <span class="item-label">Left Channel Only</span>
              </div>
              <div class="menu-item" data-action="stereo-right">
                <span class="item-label">Right Channel Only</span>
              </div>
              <div class="menu-item" data-action="stereo-reverse">
                <span class="item-label">Reverse Stereo</span>
              </div>
            </div>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item" data-action="volume-up">
            <span class="item-label">Volume Up (+5%)</span>
            <span class="item-shortcut">Up</span>
          </div>
          <div class="menu-item" data-action="volume-down">
            <span class="item-label">Volume Down (-5%)</span>
            <span class="item-shortcut">Down</span>
          </div>
          <div class="menu-item" data-action="toggle-mute">
            <span class="item-label">${this.player.isMuted ? 'Unmute' : 'Mute'}</span>
            <span class="item-shortcut">M</span>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item" data-action="open-audio-eq">
            <span class="item-label">Audio Equalizer...</span>
          </div>
        </div>
      </div>

      <!-- VIDEO -->
      <div class="menu-item has-submenu">
        <span class="item-label">Video</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item has-submenu">
            <span class="item-label">Aspect Ratio</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="set-ar" data-ar="auto">
                <span class="item-check">${currentAR === 'auto' ? '✓' : ''}</span>
                <span class="item-label">Default / Auto</span>
              </div>
              <div class="menu-item" data-action="set-ar" data-ar="16:9">
                <span class="item-check">${currentAR === '16:9' ? '✓' : ''}</span>
                <span class="item-label">16:9</span>
              </div>
              <div class="menu-item" data-action="set-ar" data-ar="4:3">
                <span class="item-check">${currentAR === '4:3' ? '✓' : ''}</span>
                <span class="item-label">4:3</span>
              </div>
              <div class="menu-item" data-action="set-ar" data-ar="2.35:1">
                <span class="item-check">${currentAR === '2.35:1' ? '✓' : ''}</span>
                <span class="item-label">2.35:1 (Cinematic)</span>
              </div>
              <div class="menu-item" data-action="set-ar" data-ar="fill">
                <span class="item-check">${currentAR === 'fill' ? '✓' : ''}</span>
                <span class="item-label">Fill Window</span>
              </div>
            </div>
          </div>
          <div class="menu-item" data-action="snapshot">
            <span class="item-label">Take Snapshot</span>
            <span class="item-shortcut">Shift+S</span>
          </div>
          <div class="menu-item" data-action="toggle-fullscreen">
            <span class="item-label">Toggle Fullscreen</span>
            <span class="item-shortcut">F</span>
          </div>
          <div class="menu-item" data-action="toggle-pip">
            <span class="item-label">Picture in Picture</span>
            <span class="item-shortcut">P</span>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item" data-action="open-video-filters">
            <span class="item-label">Video Adjustments & Filters...</span>
          </div>
        </div>
      </div>

      <!-- SUBTITLE -->
      <div class="menu-item has-submenu">
        <span class="item-label">Subtitle</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item has-submenu">
            <span class="item-label">Subtitle Track</span>
            <span class="item-shortcut">V</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu" id="menu-sub-tracks">
              ${subTracks.map((s, idx) => `
                <div class="menu-item" data-action="select-sub-track" data-index="${idx}">
                  <span class="item-check">${idx === activeSubIndex ? '✓' : ''}</span>
                  <span class="item-label">${s.name}</span>
                </div>
              `).join('')}
              <div class="menu-divider"></div>
              <div class="menu-item" data-action="select-sub-track" data-index="-1">
                <span class="item-check">${activeSubIndex === -1 ? '✓' : ''}</span>
                <span class="item-label">Disable Subtitles</span>
              </div>
            </div>
          </div>
          <div class="menu-item" data-action="load-subtitle">
            <span class="item-label">Add Subtitle File...</span>
          </div>
          <div class="menu-item" data-action="open-vlsub">
            <span class="item-label">VLSub (Find Subtitles...)</span>
          </div>
          <div class="menu-item" data-action="open-autosync">
            <span class="item-label">Auto Subtitle Sync</span>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item has-submenu">
            <span class="item-label">Subtitle Delay</span>
            <span class="arrow-indicator">▶</span>
            <div class="submenu">
              <div class="menu-item" data-action="delay-plus">Earlier (-50 ms) <span class="item-shortcut">G</span></div>
              <div class="menu-item" data-action="delay-minus">Later (+50 ms) <span class="item-shortcut">H</span></div>
              <div class="menu-item" data-action="delay-reset">Reset Delay (0 ms)</div>
            </div>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <!-- TOOLS -->
      <div class="menu-item has-submenu">
        <span class="item-label">Tools</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="open-vlsub">
            <span class="item-label">VLSub Subtitle Search...</span>
          </div>
          <div class="menu-item" data-action="open-autosync">
            <span class="item-label">One-Click Auto Sub Sync...</span>
          </div>
          <div class="menu-item" data-action="open-inspector">
            <span class="item-label">Inspector & Equalizers...</span>
          </div>
          <div class="menu-item" data-action="show-media-info">
            <span class="item-label">Media Information...</span>
          </div>
        </div>
      </div>

      <!-- VIEW -->
      <div class="menu-item has-submenu">
        <span class="item-label">View</span>
        <span class="arrow-indicator">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="toggle-dock">
            <span class="item-label">Toggle Controls Dock</span>
          </div>
          <div class="menu-item" data-action="toggle-fullscreen">
            <span class="item-label">Fullscreen</span>
            <span class="item-shortcut">F</span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <!-- ABOUT WHELO -->
      <div class="menu-item" data-action="about">
        <span class="item-label">About WHELO Media Player</span>
      </div>
    `;

    // Attach click listeners to actionable menu items
    const items = this.menuElement.querySelectorAll('.menu-item:not(.has-submenu)');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const speed = item.dataset.speed;
        const index = item.dataset.index;
        const ar = item.dataset.ar;

        this.close();
        this.onAction({ action, speed, index: index !== undefined ? parseInt(index, 10) : undefined, ar });
      });
    });
  }

  repositionSubmenus() {
    const submenus = this.menuElement.querySelectorAll('.submenu');
    submenus.forEach(sub => {
      const parent = sub.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      
      // Check if opening right would clip
      if (rect.right + 210 > window.innerWidth) {
        sub.style.left = 'auto';
        sub.style.right = '100%';
      } else {
        sub.style.left = '100%';
        sub.style.right = 'auto';
      }

      // Check vertical overflow
      const subRect = sub.getBoundingClientRect();
      if (subRect.bottom > window.innerHeight - 10) {
        sub.style.top = 'auto';
        sub.style.bottom = '0';
      } else {
        sub.style.top = '0';
        sub.style.bottom = 'auto';
      }
    });
  }
}
