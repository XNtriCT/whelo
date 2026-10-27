// WHELO — presentation helpers.
// Purely visual: keeps range fills in sync and reflects popover state.
// No playback, media or IPC behaviour lives here.

const RANGE_SELECTOR = 'input[type="range"]';

function paintRange(el) {
  if (!el || el.type !== 'range') return;
  const min = Number.isFinite(el.minAsNumber) ? el.minAsNumber : parseFloat(el.min || '0');
  const max = Number.isFinite(el.maxAsNumber) ? el.maxAsNumber : parseFloat(el.max || '100');
  const value = parseFloat(el.value || '0');
  const span = max - min;
  const pct = span > 0 ? ((value - min) / span) * 100 : 0;
  const fill = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
  if (el.dataset.fill === fill) return;
  el.dataset.fill = fill;
  el.style.setProperty('--fill', fill);
}

function paintAllRanges() {
  document.querySelectorAll(RANGE_SELECTOR).forEach(paintRange);
}

document.addEventListener(
  'input',
  (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range') {
      paintRange(event.target);
    }
  },
  true
);

document.addEventListener(
  'change',
  (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range') {
      paintRange(event.target);
    }
  },
  true
);

// Some values are set programmatically (volume OSD, resets, delay sync).
// A low-frequency reconciliation keeps the visual fill truthful without
// touching any of the player's own state.
setInterval(paintAllRanges, 320);

// Rotate the chevron while the speed popover is open.
function watchSpeedMenu() {
  const menu = document.getElementById('speed-preset-menu');
  const chip = document.getElementById('btn-speed-badge');
  if (!menu || !chip) return;

  const sync = () => chip.classList.toggle('menu-open', menu.classList.contains('open'));
  new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });
  sync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    paintAllRanges();
    watchSpeedMenu();
  });
} else {
  paintAllRanges();
  watchSpeedMenu();
}
