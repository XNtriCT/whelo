# Contributing to WHELO

Thanks for taking the time to improve WHELO. This project favours small, focused
changes that keep playback behaviour intact and the interface quiet.

## Prerequisites

- Windows 10/11
- Node.js 20 or newer
- ffmpeg and ffprobe available in `PATH` (or in `C:\ffmpeg\bin`)

## Set up

```bash
npm ci
npm run models        # fetch the local Whisper model (~41 MB)
npm run dev           # Vite dev server
npm run electron:start  # run the desktop shell against the dev server
```

## Before you open a pull request

```bash
npm run verify        # syntax checks, unit tests, production build
```

`npm run verify` must pass. If you touched the renderer, also open the app and check
the empty state, playback chrome, speed popover, inspector and subtitle search.

## Project layout

| Path | Purpose |
| --- | --- |
| `electron-main.cjs` | Main process: window, IPC, ffprobe/ffmpeg, Whisper, OpenSubtitles |
| `preload.cjs` | Context-isolated bridge exposed as `window.electronAPI` |
| `index.html` | Renderer markup (Vite entry) |
| `src/main.js` | UI controller and event wiring |
| `src/player.js` | Video engine, audio graph, filters, aspect ratios |
| `src/speedControl.js` | Wheel speed lock (1x–4x) |
| `src/subtitleSync.js` | Subtitle parsing, delay and auto-sync |
| `src/trackManager.js` | Embedded audio/subtitle tracks |
| `src/vlsub.js` | OpenSubtitles client |
| `src/contextMenu.js` | Desktop context menu |
| `src/ui.js` | Presentation helpers (range fills, popover state) |
| `src/style.css` | Design tokens and every component style |
| `tests/` | Unit and contract tests |

## Rules of the road

- **Keep the player's behaviour unchanged** unless the change is the point of the PR.
- **Preserve DOM contracts.** The renderer queries specific IDs and toggles specific
  classes; renaming them breaks playback silently. `tests/contracts.test.js` guards this.
- **No emoji in the UI.** Use the stroke icon set or typography.
- **Use design tokens.** Colours, radii and shadows come from `:root`; no raw hex values
  in new component rules.
- **Stay offline.** No web fonts or CDN assets; the app must work with the network off.
- **Accessibility matters.** Keep focus rings, contrast and keyboard paths intact.

## Commit style

Conventional Commits, for example:

```
feat(player): preserve pitch when changing speed
fix(subtitles): keep cue order after a negative delay
docs(readme): clarify model download step
```

## Pull request checklist

- [ ] `npm run verify` passes
- [ ] Manual smoke test on Windows (open, play, seek, speed, subtitles)
- [ ] No secrets, tokens or personal paths in the diff
- [ ] Screenshots attached for visual changes
- [ ] Docs updated when behaviour or setup changes

By contributing you agree that your work is licensed under the MIT License.
