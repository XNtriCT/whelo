// WHELO Media Player - Application Main Controller
import { PlayerEngine } from './player.js';
import { SpeedControlManager } from './speedControl.js';
import { SubtitleManager } from './subtitleSync.js';
import { TrackManager } from './trackManager.js';
import { VLSubService } from './vlsub.js';
import { ContextMenuManager } from './contextMenu.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const container = document.getElementById('player-container');
  const video = document.getElementById('main-video');
  const topBar = document.getElementById('top-bar');
  const bottomControls = document.getElementById('bottom-controls');
  const subtitleText = document.getElementById('subtitle-text');
  const subtitleContainer = document.getElementById('subtitle-container');

  // Media Meta
  const mediaTitle = document.getElementById('media-title');
  const mediaFormat = document.getElementById('media-format');

  // Controls Elements
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnSkipBackward = document.getElementById('btn-skip-backward');
  const btnSkipForward = document.getElementById('btn-skip-forward');
  const btnMute = document.getElementById('btn-mute');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolMuted = document.getElementById('icon-vol-muted');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeBadge = document.getElementById('volume-badge');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');
  const timeDisplay = document.getElementById('time-display');

  // Timeline
  const timelineContainer = document.getElementById('timeline-container');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineBuffer = document.getElementById('timeline-buffer');
  const timelineThumb = document.getElementById('timeline-thumb');
  const timelineTooltip = document.getElementById('timeline-tooltip');

  // Action Buttons
  const btnAspectRatio = document.getElementById('btn-aspect-ratio');
  const btnPip = document.getElementById('btn-pip');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');
  const btnToggleInspector = document.getElementById('btn-toggle-inspector');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const inspectorDrawer = document.getElementById('inspector-drawer');

  // Empty State Dropzone Screen
  const emptyStateDropzone = document.getElementById('empty-state-dropzone');
  const btnEmptyOpen = document.getElementById('btn-empty-open');

  // File Inputs & Subtitle Dropdown
  const btnOpenFile = document.getElementById('btn-open-file');
  const btnLoadSub = document.getElementById('btn-load-sub');
  const subDropdownLabel = document.getElementById('sub-dropdown-label');
  const subtitlesMenu = document.getElementById('subtitles-menu');
  const dropdownSubTracksList = document.getElementById('dropdown-sub-tracks-list');
  const btnSubMenuAddFile = document.getElementById('btn-sub-menu-add-file');
  const btnSubMenuVlsub = document.getElementById('btn-sub-menu-vlsub');
  const inputVideoFile = document.getElementById('input-video-file');
  const inputSubtitleFile = document.getElementById('input-subtitle-file');
  const dropOverlay = document.getElementById('drop-overlay');

  // VLSub Modal Elements
  const vlsubModal = document.getElementById('vlsub-modal');
  const btnCloseVlsub = document.getElementById('btn-close-vlsub');
  const vlsubQueryInput = document.getElementById('vlsub-query-input');
  const vlsubLangSelect = document.getElementById('vlsub-lang-select');
  const btnVlsubSearchName = document.getElementById('btn-vlsub-search-name');
  const btnVlsubSearchHash = document.getElementById('btn-vlsub-search-hash');
  const vlsubResultsList = document.getElementById('vlsub-results-list');
  const vlsubStatusText = document.getElementById('vlsub-status-text');

  // Drawer Track Selectors
  const selectDrawerSubTrack = document.getElementById('select-drawer-sub-track');
  const selectDrawerAudioTrack = document.getElementById('select-drawer-audio-track');

  // Feature 1: Speed Control HUD & On-Screen Preset Menu Elements
  const btnSpeedBadge = document.getElementById('btn-speed-badge');
  const speedBadgeText = document.getElementById('speed-badge-text');
  const speedPresetMenu = document.getElementById('speed-preset-menu');
  const btnSpeedOpts = document.querySelectorAll('.btn-speed-opt');
  const btnActivateWheelMode = document.getElementById('btn-activate-wheel-mode');
  const speedRadarHud = document.getElementById('speed-radar-hud');
  const speedHudVal = document.getElementById('speed-hud-val');
  const speedTierBadge = document.getElementById('speed-tier-badge');
  const tierIcon = document.getElementById('tier-icon');
  const tierName = document.getElementById('tier-name');
  const speedTrackFill = document.getElementById('speed-track-fill');
  const speedCursorDot = document.getElementById('speed-cursor-dot');
  const btnDisengageSpeed = document.getElementById('btn-disengage-speed');

  // Feature 2: Subtitle Sync Modal Elements
  const btnAutoSync = document.getElementById('btn-auto-sync');
  const btnDrawerAutoSync = document.getElementById('btn-drawer-auto-sync');
  const subSyncModal = document.getElementById('sub-sync-modal');
  const btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
  const btnRunAutoSync = document.getElementById('btn-run-auto-sync');
  const btnUndoSync = document.getElementById('btn-undo-sync');
  const syncQuoteBox = document.getElementById('sync-quote-box');
  const syncResultBadge = document.getElementById('sync-result-badge');
  const pipeStep1 = document.getElementById('pipe-step-1');
  const pipeStep2 = document.getElementById('pipe-step-2');
  const pipeStep3 = document.getElementById('pipe-step-3');
  const pipeStep4 = document.getElementById('pipe-step-4');

  // Drawer Subtitle Sync controls
  const delayReadout = document.getElementById('delay-readout');
  const drawerDelayBadge = document.getElementById('drawer-delay-badge');
  const sliderSubDelay = document.getElementById('slider-sub-delay');
  const btnDelayMinus = document.getElementById('btn-delay-minus');
  const btnDelayPlus = document.getElementById('btn-delay-plus');
  const btnSimulateDesync = document.getElementById('btn-simulate-desync');

  // Drawer Video & Audio EQ sliders
  const sliderDrawerVol = document.getElementById('slider-drawer-vol');
  const valDrawerVol = document.getElementById('val-drawer-vol');
  const sliderEqBass = document.getElementById('slider-eq-bass');
  const valEqBass = document.getElementById('val-eq-bass');
  const sliderEqMid = document.getElementById('slider-eq-mid');
  const valEqMid = document.getElementById('val-eq-mid');
  const sliderEqTreble = document.getElementById('slider-eq-treble');
  const valEqTreble = document.getElementById('val-eq-treble');

  const sliderBrightness = document.getElementById('slider-brightness');
  const valBrightness = document.getElementById('val-brightness');
  const sliderContrast = document.getElementById('slider-contrast');
  const valContrast = document.getElementById('val-contrast');
  const sliderSaturation = document.getElementById('slider-saturation');
  const valSaturation = document.getElementById('val-saturation');
  const sliderHue = document.getElementById('slider-hue');
  const valHue = document.getElementById('val-hue');
  const btnResetFilters = document.getElementById('btn-reset-filters');

  // Drawer Subtitle Style sliders
  const sliderSubSize = document.getElementById('slider-sub-size');
  const valSubSize = document.getElementById('val-sub-size');
  const sliderSubPos = document.getElementById('slider-sub-pos');
  const valSubPos = document.getElementById('val-sub-pos');

  // OSD & Toast
  const osdBadge = document.getElementById('osd-badge');
  const osdIcon = document.getElementById('osd-icon');
  const osdText = document.getElementById('osd-text');
  const toastContainer = document.getElementById('toast-container');

  let osdTimer = null;
  let idleTimer = null;
  let showRemainingTime = false;
  let isDraggingTimeline = false;

  // Display-only speed formatting: 1 -> 1×, 1.5 -> 1.5×
  const formatSpeed = (value) => `${Number(value.toFixed(2))}×`;

  // -------------------------------------------------------------
  // INITIALIZE SUB-SYSTEMS
  // -------------------------------------------------------------
  const subtitleManager = new SubtitleManager(video, handleSubtitleState);
  const player = new PlayerEngine(video, container, handlePlayerState);
  const speedControl = new SpeedControlManager(video, container, handleSpeedState);
  const vlsubService = new VLSubService();
  const trackManager = new TrackManager(video, subtitleManager, player, handleTrackState);
  const contextMenu = new ContextMenuManager({
    container,
    player,
    trackManager,
    speedControl,
    onAction: handleContextMenuAction
  });

  // Function to load and play any native file path directly with hardware decoding and full track probing
  async function playNativeFilePath(filePath) {
    if (!filePath) return;
    if (emptyStateDropzone) emptyStateDropzone.classList.add('hidden');
    console.log('[WHELO] playNativeFilePath loading:', filePath);
    const fileName = filePath.split(/[/\\]/).pop();
    const cleanPath = filePath.replace(/\\/g, '/');
    const fileUrl = 'file:///' + cleanPath.replace(/^([A-Za-z]):/, '$1:').split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
    console.log('[WHELO] Computed fileUrl:', fileUrl);

    mediaTitle.textContent = fileName;
    const ext = (fileName.split('.').pop() || 'VIDEO').toUpperCase();
    mediaFormat.textContent = `Local File • ${ext}`;

    player.loadSource(fileUrl, fileName);
    await trackManager.loadMediaTracks({
      title: fileName,
      videoUrl: fileUrl,
      filePath: filePath
    });
    subtitleManager.setCurrentFilePath(filePath);
    player.play();
    showToast(`Playing: ${fileName}`);
  }

  // Check if WHELO was launched by double-clicking a video in Windows Explorer
  async function checkInitialFileLaunch() {
    if (window.electronAPI && typeof window.electronAPI.getInitialFile === 'function') {
      try {
        const initialPath = await window.electronAPI.getInitialFile();
        console.log('[WHELO] getInitialFile returned:', initialPath);
        if (initialPath) {
          await playNativeFilePath(initialPath);
          return true;
        }
      } catch (err) {
        console.warn('Could not read initial file:', err);
      }
    } else {
      console.log('[WHELO] window.electronAPI.getInitialFile not available');
    }
    return false;
  }

  // Register listener for opening files on double-click while WHELO is already running
  if (window.electronAPI && typeof window.electronAPI.onOpenFile === 'function') {
    window.electronAPI.onOpenFile((filePath) => {
      playNativeFilePath(filePath);
    });
  }

  // Check initial file, or keep clean idle dropzone state
  checkInitialFileLaunch().then((hasFile) => {
    if (!hasFile) {
      if (emptyStateDropzone) emptyStateDropzone.classList.remove('hidden');
      mediaTitle.textContent = 'No media loaded';
      mediaFormat.textContent = 'Ready to Play';
    }
  });

  if (btnEmptyOpen) {
    btnEmptyOpen.addEventListener('click', () => {
      btnOpenFile.click();
    });
  }

  // -------------------------------------------------------------
  // PLAYBACK & TIMELINE EVENTS
  // -------------------------------------------------------------
  btnPlayPause.addEventListener('click', () => player.togglePlay());
  video.addEventListener('click', () => player.togglePlay());

  btnSkipBackward.addEventListener('click', () => player.seekBy(-10));
  btnSkipForward.addEventListener('click', () => player.seekBy(10));

  // Time toggle
  timeDisplay.addEventListener('click', () => {
    showRemainingTime = !showRemainingTime;
    updateTimeDisplay(player.currentTime, player.duration);
  });

  // Timeline Scrubbing
  timelineContainer.addEventListener('mousedown', (e) => {
    isDraggingTimeline = true;
    handleTimelineSeek(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingTimeline) {
      handleTimelineSeek(e);
    }
    handleTimelineHover(e);
  });

  window.addEventListener('mouseup', () => {
    isDraggingTimeline = false;
  });

  function handleTimelineSeek(e) {
    const rect = timelineContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * (player.duration || 1);
    player.seekTo(targetTime);
    updateSubtitleDisplay(targetTime);
  }

  function handleTimelineHover(e) {
    const rect = timelineContainer.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top - 15 && e.clientY <= rect.bottom + 15) {
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const hoverSec = pos * (player.duration || 1);
      timelineTooltip.textContent = player.formatTime(hoverSec);
      timelineTooltip.style.left = `${pos * 100}%`;
    }
  }

  // Volume slider
  volumeSlider.addEventListener('input', (e) => {
    player.setVolume(parseFloat(e.target.value));
  });

  btnMute.addEventListener('click', () => player.toggleMute());

  // Aspect ratio cycling
  const aspectRatios = ['auto', '16:9', '4:3', '2.35:1', 'fill'];
  let arIndex = 0;
  btnAspectRatio.addEventListener('click', () => {
    arIndex = (arIndex + 1) % aspectRatios.length;
    player.setAspectRatio(aspectRatios[arIndex]);
  });

  // PiP & Fullscreen
  btnPip.addEventListener('click', () => player.togglePictureInPicture());
  btnFullscreen.addEventListener('click', () => player.toggleFullscreen());

  // -------------------------------------------------------------
  // FEATURE 1: SPEED CONTROL & DEDICATED PRESETS MENU
  // Dedicated button opens speed preset menu (supports sub-1x speeds down to 0.25x)
  // Middle-click locks mouse wheel mode (strictly 1.0x to 4.0x)
  // -------------------------------------------------------------
  btnSpeedBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (speedPresetMenu) {
      speedPresetMenu.classList.toggle('open');
    }
  });

  // Middle-click on badge engages mouse wheel speed lock directly
  btnSpeedBadge.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (speedPresetMenu) speedPresetMenu.classList.remove('open');
      speedControl.toggleLock(e.clientX);
    }
  });

  // Dedicated speed preset buttons (supports sub-1x: 0.25x, 0.5x, 0.75x, and up to 4.0x)
  btnSpeedOpts.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetSpeed = parseFloat(btn.dataset.speed);
      speedControl.setSpeed(targetSpeed);
      if (speedPresetMenu) speedPresetMenu.classList.remove('open');
      showToast(`Playback speed set to ${formatSpeed(targetSpeed)}`);
      showOSD('Speed', formatSpeed(targetSpeed));
    });
  });

  // Activate wheel lock from preset menu footer
  if (btnActivateWheelMode) {
    btnActivateWheelMode.addEventListener('click', (e) => {
      e.stopPropagation();
      if (speedPresetMenu) speedPresetMenu.classList.remove('open');
      speedControl.engage(window.innerWidth / 2);
    });
  }

  // Close speed preset menu on outside clicks
  document.addEventListener('click', (e) => {
    if (speedPresetMenu && speedPresetMenu.classList.contains('open')) {
      if (!e.target.closest('.speed-menu-wrapper')) {
        speedPresetMenu.classList.remove('open');
      }
    }
  });

  btnDisengageSpeed.addEventListener('click', () => {
    speedControl.disengage();
  });

  function handleSpeedState(event) {
    const { speed, isLocked, tier, percent } = event;

    // Update Dock Badge
    speedBadgeText.textContent = formatSpeed(speed);
    if (isLocked) {
      btnSpeedBadge.classList.add('locked');
      speedRadarHud.classList.add('active');
    } else {
      btnSpeedBadge.classList.remove('locked');
      speedRadarHud.classList.remove('active');
    }

    // Update Speedometer HUD values
    speedHudVal.textContent = formatSpeed(speed);
    tierName.textContent = tier.label;
    tierIcon.textContent = tier.icon;
    speedTierBadge.style.color = tier.color;

    // 1.0x (0%) to 4.0x (100%) track mapping
    const progressFraction = Math.max(0, Math.min(1, (speed - 1.0) / 3.0));

    // Update Capsule Trajectory Mini-Bar
    const percentClamped = Math.max(0, Math.min(100, progressFraction * 100));
    if (speedTrackFill) speedTrackFill.style.width = `${percentClamped}%`;
    if (speedCursorDot) speedCursorDot.style.left = `${percentClamped}%`;

    // Highlight matching preset button
    btnSpeedOpts.forEach(btn => {
      const btnVal = parseFloat(btn.dataset.speed);
      if (Math.abs(btnVal - speed) < 0.04) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (event.type === 'lock_disengaged') {
      showToast(`Playback speed locked at ${formatSpeed(speed)}`);
      showOSD('Speed', formatSpeed(speed));
    }
  }

  // -------------------------------------------------------------
  // FEATURE 2: ONE-CLICK AUTOMATED SUBTITLE SYNC FIX
  // Extracts audio, transcribes speech, matches subtitle, fixes delay
  // -------------------------------------------------------------
  btnAutoSync.addEventListener('click', () => {
    openSubSyncModal();
  });

  btnDrawerAutoSync.addEventListener('click', () => {
    openSubSyncModal();
  });

  btnCloseSyncModal.addEventListener('click', () => {
    closeSubSyncModal();
  });

  btnRunAutoSync.addEventListener('click', async () => {
    btnRunAutoSync.disabled = true;
    btnRunAutoSync.innerHTML = '<span>Syncing…</span>';

    try {
      const result = await subtitleManager.autoSyncSubtitles();
      btnRunAutoSync.disabled = false;
      btnRunAutoSync.innerHTML = '<span>Re-sync</span>';
      btnUndoSync.style.display = 'inline-flex';
      
      syncResultBadge.style.display = 'block';
      syncResultBadge.textContent = `Synced · delay ${result.offset >= 0 ? '+' : ''}${result.offset.toFixed(2)} s`;
      
      showToast(`Subtitles synchronized · ${result.offset >= 0 ? '+' : ''}${result.offset.toFixed(2)} s offset applied`, 'success', () => {
        subtitleManager.undoDelay();
      });
    } catch (err) {
      btnRunAutoSync.disabled = false;
      btnRunAutoSync.innerHTML = '<span>Retry auto-sync</span>';
      showToast(`Auto-Sync error: ${err.message}`);
    }
  });

  btnUndoSync.addEventListener('click', () => {
    const prev = subtitleManager.undoDelay();
    if (prev !== null) {
      showToast(`Reverted subtitle delay to ${prev.toFixed(2)}s`);
      syncResultBadge.textContent = `Reverted to ${prev.toFixed(2)}s`;
    }
  });

  function openSubSyncModal() {
    subSyncModal.classList.add('active');
    syncResultBadge.style.display = 'none';
    syncQuoteBox.textContent = `Current playback time: ${player.formatTime(video.currentTime)}. Click "Start Auto-Sync Now" below to sample audio & fix subtitle delay...`;
    resetPipelineSteps();
  }

  function closeSubSyncModal() {
    subSyncModal.classList.remove('active');
  }

  function resetPipelineSteps() {
    [pipeStep1, pipeStep2, pipeStep3, pipeStep4].forEach(step => {
      step.classList.remove('active', 'completed');
    });
  }

  function updateSubtitleDisplay(currentTime = (video ? video.currentTime : 0)) {
    if (!subtitleText || !subtitleManager) return;
    const activeCue = subtitleManager.update(currentTime);
    if (activeCue && activeCue.text) {
      subtitleText.textContent = activeCue.text;
      subtitleText.classList.add('visible');
    } else {
      subtitleText.classList.remove('visible');
      subtitleText.textContent = '';
    }
  }

  video.addEventListener('seeked', () => updateSubtitleDisplay());
  video.addEventListener('seeking', () => updateSubtitleDisplay());

  function handleSubtitleState(event) {
    if (event.type === 'sync_progress') {
      const { step, text } = event;
      syncQuoteBox.textContent = text;

      if (step === 'extract') {
        pipeStep1.classList.add('active');
      } else if (step === 'transcribe') {
        pipeStep1.classList.remove('active');
        pipeStep1.classList.add('completed');
        pipeStep2.classList.add('active');
      } else if (step === 'match') {
        pipeStep2.classList.remove('active');
        pipeStep2.classList.add('completed');
        pipeStep3.classList.add('active');
      } else if (step === 'done') {
        pipeStep3.classList.remove('active');
        pipeStep3.classList.add('completed');
        pipeStep4.classList.add('completed');
      }
    } else if (event.type === 'delay_changed') {
      const delayFormatted = `${event.delay >= 0 ? '+' : ''}${event.delay.toFixed(3)} s`;
      delayReadout.textContent = delayFormatted;
      drawerDelayBadge.textContent = `${event.delay >= 0 ? '+' : ''}${event.delay.toFixed(3)} s`;
      sliderSubDelay.value = event.delay;
      showOSD('Subtitle Delay', `${event.delay >= 0 ? '+' : ''}${Math.round(event.delay * 1000)} ms`);
      updateSubtitleDisplay();
    } else if (event.type === 'loaded' || event.type === 'visibility_changed') {
      updateSubtitleDisplay();
    }
  }

  // Subtitle Manual Stepper & Slider
  btnDelayMinus.addEventListener('click', () => subtitleManager.adjustDelay(-0.05)); // -50ms (Key G)
  btnDelayPlus.addEventListener('click', () => subtitleManager.adjustDelay(0.05));   // +50ms (Key H)

  sliderSubDelay.addEventListener('input', (e) => {
    subtitleManager.setDelay(parseFloat(e.target.value));
  });

  // Test Simulator: Introduce desync of +2.5s so user can instantly test 1-click Auto Sub Sync
  btnSimulateDesync.addEventListener('click', () => {
    const desynced = subtitleManager.simulateDesync(2.5);
    showToast(`Simulated desync · subtitles delayed by ${desynced.toFixed(2)} s`);
  });

  // VLC Hotkeys G & H (Subtitle Delay) and V & B (Subtitle & Audio Tracks)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      subtitleManager.adjustDelay(-0.05); // Earlier by 50ms
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      subtitleManager.adjustDelay(0.05);  // Later by 50ms
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      trackManager.cycleSubtitleTrack(e.shiftKey ? -1 : 1);
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      trackManager.cycleAudioTrack(e.shiftKey ? -1 : 1);
    }
  });

  // Track Selector Change Handlers in Inspector Drawer
  if (selectDrawerSubTrack) {
    selectDrawerSubTrack.addEventListener('change', (e) => {
      trackManager.selectSubtitleTrack(parseInt(e.target.value, 10));
    });
  }

  if (selectDrawerAudioTrack) {
    selectDrawerAudioTrack.addEventListener('change', (e) => {
      trackManager.selectAudioTrack(parseInt(e.target.value, 10));
    });
  }

  // Handle updates from TrackManager (updates UI dropdowns and OSD)
  function handleTrackState(event) {
    if (event.type === 'osd_message') {
      showOSD(event.title, event.text, event.icon);
      return;
    }

    const { audioTracks, subtitleTracks, activeAudioIndex, activeSubtitleIndex } = event;

    // 1. Update Drawer Subtitle Track Selector
    if (selectDrawerSubTrack) {
      selectDrawerSubTrack.innerHTML = `
        ${subtitleTracks.map((s, idx) => `
          <option value="${idx}" ${idx === activeSubtitleIndex ? 'selected' : ''}>${s.name}</option>
        `).join('')}
        <option value="-1" ${activeSubtitleIndex === -1 ? 'selected' : ''}>[Disable Subtitles]</option>
      `;
    }

    // 2. Update Drawer Audio Track Selector
    if (selectDrawerAudioTrack) {
      selectDrawerAudioTrack.innerHTML = `
        ${audioTracks.map((a, idx) => `
          <option value="${idx}" ${idx === activeAudioIndex ? 'selected' : ''}>${a.name}</option>
        `).join('')}
        <option value="-1" ${activeAudioIndex === -1 ? 'selected' : ''}>[Disable Audio]</option>
      `;
    }

    // 3. Update Top Bar Subtitles Dropdown List
    if (dropdownSubTracksList) {
      dropdownSubTracksList.innerHTML = `
        ${subtitleTracks.map((s, idx) => `
          <button class="dropdown-item sub-track-item ${idx === activeSubtitleIndex ? 'active' : ''}" data-index="${idx}">
            <span class="dropdown-item-title">${idx === activeSubtitleIndex ? '✓ ' : '  '}${s.name}</span>
          </button>
        `).join('')}
        <button class="dropdown-item sub-track-item ${activeSubtitleIndex === -1 ? 'active' : ''}" data-index="-1">
          <span class="dropdown-item-title">${activeSubtitleIndex === -1 ? '✓ ' : '  '}[Disable Subtitles]</span>
        </button>
      `;

      dropdownSubTracksList.querySelectorAll('.sub-track-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          trackManager.selectSubtitleTrack(idx);
          subtitlesMenu.classList.remove('open');
        });
      });
    }

    // 4. Update Subtitles top bar button label
    if (subDropdownLabel) {
      if (activeSubtitleIndex >= 0 && subtitleTracks[activeSubtitleIndex]) {
        const code = (subtitleTracks[activeSubtitleIndex].lang || 'Sub').toUpperCase();
        subDropdownLabel.textContent = `Subs (${code})`;
      } else {
        subDropdownLabel.textContent = 'Subs (Off)';
      }
    }

    // Refresh subtitle display instantly on track changes
    updateSubtitleDisplay();
  }

  // -------------------------------------------------------------
  // FEATURE 4: VLSUB ONLINE SUBTITLE FINDER
  // -------------------------------------------------------------
  function openVLSubModal() {
    vlsubModal.classList.add('active');
    const rawTitle = mediaTitle.textContent.replace(/\.[^/.]+$/, '').split(' - ')[0].trim();
    vlsubQueryInput.value = rawTitle;
    performVLSubSearch(false);
  }

  function closeVLSubModal() {
    vlsubModal.classList.remove('active');
  }

  if (btnCloseVlsub) {
    btnCloseVlsub.addEventListener('click', closeVLSubModal);
  }

  vlsubModal.addEventListener('click', (e) => {
    if (e.target === vlsubModal) {
      closeVLSubModal();
    }
  });

  btnVlsubSearchName.addEventListener('click', () => {
    performVLSubSearch(false);
  });

  btnVlsubSearchHash.addEventListener('click', () => {
    performVLSubSearch(true);
  });

  vlsubQueryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performVLSubSearch(false);
    }
  });

  async function performVLSubSearch(isHash = false) {
    const query = vlsubQueryInput.value.trim();
    const language = vlsubLangSelect.value;

    vlsubStatusText.textContent = `Searching OpenSubtitles for "${query || 'Current Video'}"…`;
    vlsubResultsList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
        Connecting to OpenSubtitles database...
      </div>
    `;

    try {
      const results = await vlsubService.searchSubtitles({
        query,
        language,
        isHash,
        filePath: trackManager.currentFilePath
      });

      if (results.length === 0) {
        vlsubStatusText.textContent = `No subtitles found on OpenSubtitles for "${query}". Try searching with "All Languages" or a different keyword.`;
        vlsubResultsList.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
            No matching subtitles found on OpenSubtitles. Try searching with movie title or check spelling.
          </div>
        `;
        return;
      }

      vlsubStatusText.textContent = `Found ${results.length} live OpenSubtitles release${results.length > 1 ? 's' : ''}. Click "Download & Load" to apply.`;
      vlsubResultsList.innerHTML = '';

      results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'vlsub-item';
        row.innerHTML = `
          <div class="col-title" title="${item.title}">${item.title}</div>
          <div class="col-lang">${item.lang.toUpperCase()}</div>
          <div class="col-format">${item.format}</div>
          <div class="col-stats">${item.rating} ★ · ${item.downloads.toLocaleString()}</div>
          <div class="col-action">
            <button class="btn-vlsub-download" data-id="${item.id}">
              <span>Download</span>
            </button>
          </div>
        `;

        const btnDownload = row.querySelector('.btn-vlsub-download');
        btnDownload.addEventListener('click', async () => {
          btnDownload.disabled = true;
          btnDownload.innerHTML = '<span>⏳ Downloading...</span>';
          try {
            const savePath = trackManager.currentFilePath ? trackManager.currentFilePath.replace(/\.[^/.]+$/, `.${item.lang}.srt`) : null;
            const srtContent = await vlsubService.downloadSubtitle(item, savePath);
            trackManager.addCustomSubtitle(item.title, srtContent);
            closeVLSubModal();
            showToast(`Subtitle loaded · ${item.title}`, 'success');
          } catch (dlErr) {
            btnDownload.disabled = false;
            btnDownload.innerHTML = '<span>Retry</span>';
            showToast(`Download failed: ${dlErr.message}`);
          }
        });

        vlsubResultsList.appendChild(row);
      });
    } catch (err) {
      vlsubStatusText.textContent = `Search error: ${err.message}`;
    }
  }

  // -------------------------------------------------------------
  // FEATURE 1: VLC RIGHT-CLICK CONTEXT MENU DISPATCHER
  // -------------------------------------------------------------
  function handleContextMenuAction({ action, speed, index, ar }) {
    switch (action) {
      case 'open-file':
        if (window.electronAPI && typeof window.electronAPI.showOpenVideoDialog === 'function') {
          window.electronAPI.showOpenVideoDialog().then(selected => {
            if (selected) playNativeFilePath(selected);
          });
        } else {
          inputVideoFile.click();
        }
        break;
      case 'load-subtitle':
        if (window.electronAPI && typeof window.electronAPI.showOpenSubtitleDialog === 'function') {
          window.electronAPI.showOpenSubtitleDialog().then(sub => {
            if (sub) {
              trackManager.addCustomSubtitle(sub.fileName, sub.content);
              showToast(`Loaded subtitle: ${sub.fileName}`);
            }
          });
        } else {
          inputSubtitleFile.click();
        }
        break;
      case 'toggle-play':
        player.togglePlay();
        break;
      case 'stop':
        player.pause();
        player.seekTo(0);
        break;
      case 'seek-5':
        player.seekBy(5);
        break;
      case 'seek-10':
        player.seekBy(10);
        break;
      case 'seek-30':
        player.seekBy(30);
        break;
      case 'seek--5':
        player.seekBy(-5);
        break;
      case 'seek--10':
        player.seekBy(-10);
        break;
      case 'seek--30':
        player.seekBy(-30);
        break;
      case 'set-speed':
        if (speed) speedControl.setSpeed(parseFloat(speed));
        break;
      case 'toggle-wheel-lock':
        speedControl.toggleLock();
        break;
      case 'select-audio-track':
        if (index !== undefined) trackManager.selectAudioTrack(index);
        break;
      case 'stereo-original':
      case 'stereo-left':
      case 'stereo-right':
      case 'stereo-reverse':
        showToast(`Stereo Mode: ${action.replace('stereo-', '').toUpperCase()}`);
        break;
      case 'volume-up':
        player.adjustVolume(0.05);
        break;
      case 'volume-down':
        player.adjustVolume(-0.05);
        break;
      case 'toggle-mute':
        player.toggleMute();
        break;
      case 'open-audio-eq':
        openInspectorTab('tab-eq');
        break;
      case 'set-ar':
        if (ar) player.setAspectRatio(ar);
        break;
      case 'snapshot':
        player.captureSnapshot();
        break;
      case 'toggle-fullscreen':
        player.toggleFullscreen();
        break;
      case 'toggle-pip':
        player.togglePictureInPicture();
        break;
      case 'open-video-filters':
        openInspectorTab('tab-video');
        break;
      case 'select-sub-track':
        if (index !== undefined) trackManager.selectSubtitleTrack(index);
        break;
      case 'open-vlsub':
        openVLSubModal();
        break;
      case 'open-autosync':
        openSubSyncModal();
        break;
      case 'delay-plus':
        subtitleManager.adjustDelay(-0.05);
        break;
      case 'delay-minus':
        subtitleManager.adjustDelay(0.05);
        break;
      case 'delay-reset':
        subtitleManager.setDelay(0);
        showToast('Subtitle delay reset to 0 ms');
        break;
      case 'open-inspector':
        inspectorDrawer.classList.toggle('open');
        break;
      case 'show-media-info':
        showToast(`Media Info: ${mediaTitle.textContent} • ${mediaFormat.textContent}`);
        break;
      case 'toggle-dock':
        bottomControls.classList.toggle('idle-hidden');
        break;
      case 'about':
        showToast('WHELO Media Player v1.0.0 — Next-Gen VLC Clone with Smooth Speed Control & Auto Sub Sync');
        break;
    }
  }

  function openInspectorTab(tabId) {
    inspectorDrawer.classList.add('open');
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
  }

  // -------------------------------------------------------------
  // SUBTITLE STYLING ADJUSTMENTS
  // -------------------------------------------------------------
  sliderSubSize.addEventListener('input', (e) => {
    const size = e.target.value;
    subtitleText.style.fontSize = `${size}px`;
    valSubSize.textContent = `${size}px`;
  });

  sliderSubPos.addEventListener('input', (e) => {
    const pos = e.target.value;
    subtitleContainer.style.bottom = `${pos}%`;
    valSubPos.textContent = `${pos}%`;
  });

  // -------------------------------------------------------------
  // DRAWER & INSPECTOR TOGGLE
  // -------------------------------------------------------------
  btnToggleInspector.addEventListener('click', () => {
    inspectorDrawer.classList.toggle('open');
  });

  btnCloseDrawer.addEventListener('click', () => {
    inspectorDrawer.classList.remove('open');
  });

  // Drawer Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Equalizer & Video Filters
  sliderDrawerVol.addEventListener('input', (e) => {
    player.setVolume(parseFloat(e.target.value));
  });

  sliderEqBass.addEventListener('input', (e) => {
    valEqBass.textContent = `${e.target.value} dB`;
    player.setEqualizer('bass', parseFloat(e.target.value));
  });

  sliderEqMid.addEventListener('input', (e) => {
    valEqMid.textContent = `${e.target.value} dB`;
    player.setEqualizer('mid', parseFloat(e.target.value));
  });

  sliderEqTreble.addEventListener('input', (e) => {
    valEqTreble.textContent = `${e.target.value} dB`;
    player.setEqualizer('treble', parseFloat(e.target.value));
  });

  sliderBrightness.addEventListener('input', (e) => {
    valBrightness.textContent = `${e.target.value}%`;
    player.setFilter('brightness', e.target.value);
  });

  sliderContrast.addEventListener('input', (e) => {
    valContrast.textContent = `${e.target.value}%`;
    player.setFilter('contrast', e.target.value);
  });

  sliderSaturation.addEventListener('input', (e) => {
    valSaturation.textContent = `${e.target.value}%`;
    player.setFilter('saturation', e.target.value);
  });

  sliderHue.addEventListener('input', (e) => {
    valHue.textContent = `${e.target.value}°`;
    player.setFilter('hue', e.target.value);
  });

  btnResetFilters.addEventListener('click', () => {
    sliderBrightness.value = 100; valBrightness.textContent = '100%';
    sliderContrast.value = 100; valContrast.textContent = '100%';
    sliderSaturation.value = 100; valSaturation.textContent = '100%';
    sliderHue.value = 0; valHue.textContent = '0°';
    player.resetFilters();
  });

  // -------------------------------------------------------------
  // FILE PICKERS, SUBTITLES DROPDOWN & DRAG AND DROP
  // -------------------------------------------------------------
  btnOpenFile.addEventListener('click', async () => {
    if (window.electronAPI && typeof window.electronAPI.showOpenVideoDialog === 'function') {
      const selected = await window.electronAPI.showOpenVideoDialog();
      if (selected) {
        await playNativeFilePath(selected);
      }
    } else {
      inputVideoFile.click();
    }
  });

  // Subtitle Dropdown in Top Bar
  btnLoadSub.addEventListener('click', (e) => {
    e.stopPropagation();
    subtitlesMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.subtitle-dropdown')) {
      subtitlesMenu.classList.remove('open');
    }
  });

  btnSubMenuAddFile.addEventListener('click', async () => {
    subtitlesMenu.classList.remove('open');
    if (window.electronAPI && typeof window.electronAPI.showOpenSubtitleDialog === 'function') {
      const sub = await window.electronAPI.showOpenSubtitleDialog();
      if (sub) {
        trackManager.addCustomSubtitle(sub.fileName, sub.content);
        showToast(`Loaded subtitle: ${sub.fileName}`);
      }
    } else {
      inputSubtitleFile.click();
    }
  });

  btnSubMenuVlsub.addEventListener('click', () => {
    subtitlesMenu.classList.remove('open');
    openVLSubModal();
  });

  inputVideoFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleLoadedVideoFile(file);
  });

  inputSubtitleFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleLoadedSubtitleFile(file);
  });

  function handleLoadedVideoFile(file) {
    const realPath = (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function')
      ? window.electronAPI.getPathForFile(file)
      : (file.path || null);

    if (realPath) {
      playNativeFilePath(realPath);
      return;
    }

    if (emptyStateDropzone) emptyStateDropzone.classList.add('hidden');
    const objectUrl = URL.createObjectURL(file);
    mediaTitle.textContent = file.name;
    mediaFormat.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • Local File`;
    player.loadSource(objectUrl, file.name);
    trackManager.loadMediaTracks({
      title: file.name,
      videoUrl: objectUrl,
      filePath: null,
      fileBlob: file
    });
    player.play();
    showToast(`Playing: ${file.name}`);
  }

  function handleLoadedSubtitleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      trackManager.addCustomSubtitle(file.name, content);
      showToast(`Loaded subtitle: ${file.name}`);
    };
    reader.readAsText(file);
  }

  // Drag and Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      dropOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');
    const files = Array.from(e.dataTransfer.files);
    
    // Check for video file
    const videoFile = files.find(f => f.type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi|wmv|flv|m4v|ts|m2ts)$/i.test(f.name));
    if (videoFile) {
      const realPath = (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function')
        ? window.electronAPI.getPathForFile(videoFile)
        : (videoFile.path || null);

      if (realPath) {
        playNativeFilePath(realPath);
      } else {
        handleLoadedVideoFile(videoFile);
      }
    }

    // Check for subtitle file
    const subFile = files.find(f => /\.(srt|vtt|ass|ssa|sub)$/i.test(f.name));
    if (subFile) handleLoadedSubtitleFile(subFile);
  });

  // -------------------------------------------------------------
  // CORE STATE SYNCHRONIZATION
  // -------------------------------------------------------------
  function handlePlayerState(event) {
    switch (event.type) {
      case 'play_state':
        if (event.isPlaying) {
          iconPlay.style.display = 'none';
          iconPause.style.display = 'block';
        } else {
          iconPlay.style.display = 'block';
          iconPause.style.display = 'none';
        }
        break;

      case 'time_updated':
        const { currentTime, duration, buffered } = event;
        // Update timeline progress
        const percent = (currentTime / duration) * 100;
        timelineProgress.style.width = `${percent}%`;
        timelineThumb.style.left = `${percent}%`;

        // Update buffer
        if (buffered && buffered.length > 0) {
          const lastBuffer = buffered[buffered.length - 1];
          const bufPercent = (lastBuffer.end / duration) * 100;
          timelineBuffer.style.width = `${bufPercent}%`;
        }

        updateTimeDisplay(currentTime, duration);

        // Update active subtitle
        updateSubtitleDisplay(currentTime);
        break;

      case 'volume_changed':
        volumeSlider.value = event.volume;
        sliderDrawerVol.value = event.volume;
        volumeBadge.textContent = `${event.percent}%`;
        valDrawerVol.textContent = `${event.percent}%`;
        
        if (event.volume > 1.0) {
          volumeBadge.classList.add('boosted');
        } else {
          volumeBadge.classList.remove('boosted');
        }

        if (event.isMuted || event.volume === 0) {
          iconVolHigh.style.display = 'none';
          iconVolMuted.style.display = 'block';
        } else {
          iconVolHigh.style.display = 'block';
          iconVolMuted.style.display = 'none';
        }
        break;

      case 'fullscreen_changed':
        if (event.isFullscreen) {
          iconFsEnter.style.display = 'none';
          iconFsExit.style.display = 'block';
        } else {
          iconFsEnter.style.display = 'block';
          iconFsExit.style.display = 'none';
        }
        break;

      case 'video_error':
        showToast(`Playback error · ${event.error}`);
        showOSD('Video error', event.error);
        console.warn('Playback error received:', event);
        break;

      case 'osd_message':
        showOSD(event.title, event.text, event.icon);
        break;
    }
  }

  function updateTimeDisplay(current, duration) {
    timeCurrent.textContent = player.formatTime(current);
    if (showRemainingTime && duration > current) {
      timeDuration.textContent = `-${player.formatTime(duration - current)}`;
    } else {
      timeDuration.textContent = player.formatTime(duration);
    }
  }

  // -------------------------------------------------------------
  // AUTO-HIDE IDLE CONTROLS
  // -------------------------------------------------------------
  container.addEventListener('mousemove', resetIdleTimer);
  container.addEventListener('mousedown', resetIdleTimer);

  function resetIdleTimer() {
    topBar.classList.remove('idle-hidden');
    bottomControls.classList.remove('idle-hidden');
    subtitleContainer.classList.remove('dock-hidden');
    container.classList.remove('cursor-hidden');

    clearTimeout(idleTimer);
    if (player.isPlaying && !speedControl.isLocked && !inspectorDrawer.classList.contains('open')) {
      idleTimer = setTimeout(() => {
        topBar.classList.add('idle-hidden');
        bottomControls.classList.add('idle-hidden');
        subtitleContainer.classList.add('dock-hidden');
        container.classList.add('cursor-hidden');
      }, 2800);
    }
  }

  // -------------------------------------------------------------
  // OSD & TOAST NOTIFICATIONS
  // -------------------------------------------------------------
  function showOSD(title, text, icon = '') {
    osdIcon.textContent = icon;
    osdText.textContent = `${title} · ${text}`;
    osdBadge.classList.add('visible');

    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => {
      osdBadge.classList.remove('visible');
    }, 1200);
  }

  function showToast(message, type = 'info', onUndo = null) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    
    let undoHtml = '';
    if (onUndo) {
      undoHtml = `<button class="toast-btn">Undo</button>`;
    }

    toast.innerHTML = `<span>${message}</span>${undoHtml}`;
    if (onUndo) {
      toast.querySelector('.toast-btn').addEventListener('click', () => {
        onUndo();
        toast.remove();
      });
    }

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
});
