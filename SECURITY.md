# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting:
**[Report a vulnerability](https://github.com/XNtriCT/whelo/security/advisories/new)**

Include, where possible:

- a description of the issue and its impact;
- steps to reproduce, or a minimal proof of concept;
- the WHELO version and Windows build;
- any relevant logs (remove personal paths first).

You can expect an acknowledgement within 72 hours. Fixes are shipped in a patch
release and credited in the advisory unless you prefer to stay anonymous.

## Scope

In scope:

- the Electron main process and preload bridge (`electron-main.cjs`, `preload.cjs`);
- renderer code under `src/`;
- the IPC surface exposed on `window.electronAPI`;
- the build and packaging configuration.

Out of scope:

- third-party services (OpenSubtitles, Hugging Face) and their availability;
- vulnerabilities in ffmpeg/ffprobe binaries installed on the host;
- malicious media or subtitle files you choose to open.

## Design notes

- WHELO performs **no telemetry** and stores no credentials. It has no account system.
- The renderer loads local media through `file://`, so `webSecurity` is disabled to
  allow seekable local playback. Treat media files from untrusted sources with the
  same care you would in any desktop player.
- Outbound requests are limited to OpenSubtitles when you explicitly search for
  subtitles. Speech recognition runs locally against the bundled Whisper model;
  audio never leaves the machine.
- Model weights are downloaded at build time by `npm run models`, not at runtime.
