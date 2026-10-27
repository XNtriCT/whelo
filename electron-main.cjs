const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const { execFile } = require('child_process');
const os = require('os');

// Enable GPU acceleration and high-performance video decoding
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-audio-tracks');

// Locate ffmpeg and ffprobe binaries
function findBinary(name) {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name;
  const candidates = [
    path.join('C:', 'ffmpeg', 'bin', exeName),
    path.join(process.resourcesPath || '', 'bin', exeName),
    path.join(__dirname, 'bin', exeName),
    exeName
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return exeName;
}

// -------------------------------------------------------------
// MEDIA PROBE & EXTRACTION IPC HANDLERS
// -------------------------------------------------------------

// Probe video container for audio and subtitle streams
ipcMain.handle('media:probe', async (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ffprobe = findBinary('ffprobe');
  return new Promise((resolve, reject) => {
    execFile(
      ffprobe,
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
        try {
          const info = JSON.parse(stdout);
          const streams = info.streams || [];

          // Map Audio Tracks
          const audioTracks = streams
            .filter(s => s.codec_type === 'audio')
            .map((s, idx) => {
              const lang = (s.tags && (s.tags.language || s.tags.LANGUAGE)) || 'und';
              const title = (s.tags && (s.tags.title || s.tags.TITLE)) || '';
              const codec = (s.codec_name || 'aac').toUpperCase();
              const channels = s.channels ? `${s.channels}ch` : 'Stereo';
              const name = title || `Track ${idx + 1} [${lang.toUpperCase()}] • ${codec} (${channels})`;

              return {
                index: s.index,
                streamIndex: s.index,
                id: `audio-stream-${s.index}`,
                name,
                lang,
                codec: s.codec_name,
                channels: s.channels || 2,
                profile: 'normal',
                isNative: true
              };
            });

          // Map Subtitle Tracks
          const subtitleTracks = streams
            .filter(s => s.codec_type === 'subtitle')
            .map((s, idx) => {
              const lang = (s.tags && (s.tags.language || s.tags.LANGUAGE)) || 'und';
              const title = (s.tags && (s.tags.title || s.tags.TITLE)) || '';
              const codec = (s.codec_name || 'subrip').toUpperCase();
              const name = title || `Track ${idx + 1} [${lang.toUpperCase()}] • ${codec}`;

              return {
                index: s.index,
                streamIndex: s.index,
                id: `sub-stream-${s.index}`,
                name,
                lang,
                codec: s.codec_name,
                isNative: true
              };
            });

          resolve({
            format: info.format?.format_name,
            duration: parseFloat(info.format?.duration || 0),
            audioTracks,
            subtitleTracks
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    );
  });
});

// Extract subtitle track from container into WebVTT text
ipcMain.handle('media:extract-subtitle', async (event, { filePath, streamIndex }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ffmpeg = findBinary('ffmpeg');
  return new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      ['-v', 'quiet', '-i', filePath, '-map', `0:${streamIndex}`, '-f', 'webvtt', 'pipe:1'],
      { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return reject(new Error(`Failed to extract subtitle: ${err.message}`));
        resolve(stdout);
      }
    );
  });
});

// Extract secondary audio track from container for multi-track playback
ipcMain.handle('media:extract-audio', async (event, { filePath, streamIndex }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ffmpeg = findBinary('ffmpeg');
  const tempFile = path.join(os.tmpdir(), `whelo_audio_${Date.now()}_stream${streamIndex}.m4a`);

  return new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      ['-v', 'quiet', '-i', filePath, '-map', `0:${streamIndex}`, '-c:a', 'aac', '-ac', '2', '-vn', '-y', tempFile],
      (err) => {
        if (err) return reject(new Error(`Failed to demux audio track: ${err.message}`));
        resolve(tempFile);
      }
    );
  });
});

// -------------------------------------------------------------
// ONE-CLICK SPEECH-TO-TEXT DIALOGUE AUTO-SYNC (WHISPER AI)
// -------------------------------------------------------------
let whisperPipelineInstance = null;

async function getWhisperPipeline() {
  if (!whisperPipelineInstance) {
    const { pipeline, env } = require('@xenova/transformers');
    const localModelsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'models')
      : path.join(__dirname, 'models');

    env.localModelPath = localModelsPath;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    whisperPipelineInstance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      quantized: true,
      local_files_only: true
    });
  }
  return whisperPipelineInstance;
}

ipcMain.handle('media:transcribe-audio-snippet', async (event, { filePath, currentTime, duration = 8 }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Media file not found for auto-sync: ${filePath}`);
  }

  const ffmpeg = findBinary('ffmpeg');
  // Center audio snippet around currentTime to capture the spoken dialogue
  const sampleDuration = Math.min(10.0, Math.max(4.0, duration));
  const startSec = Math.max(0, (currentTime || 0) - 1.5);

  // Extract 16kHz mono audio from video file around currentTime
  const wavBuffer = await new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        '-ss', startSec.toFixed(3),
        '-t', sampleDuration.toFixed(3),
        '-i', filePath,
        '-map', '0:a:0',
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'pcm_s16le',
        '-f', 'wav',
        'pipe:1'
      ],
      { maxBuffer: 15 * 1024 * 1024, encoding: 'buffer' },
      (err, stdout) => {
        if (err) return reject(new Error(`Failed to extract audio snippet: ${err.message}`));
        resolve(stdout);
      }
    );
  });

  if (!wavBuffer || wavBuffer.length <= 44) {
    throw new Error('No audio data could be extracted from video at this timestamp');
  }

  // Parse PCM16 into Float32 normalized array
  const headerOffset = 44;
  const pcm16 = new Int16Array(wavBuffer.buffer, wavBuffer.byteOffset + headerOffset, Math.floor((wavBuffer.length - headerOffset) / 2));
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }

  // Transcribe via Whisper ONNX
  const transcriber = await getWhisperPipeline();
  const result = await transcriber(float32, {
    sampling_rate: 16000,
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true
  });

  const recognizedText = (result.text || '').trim();
  const chunks = result.chunks || [];

  return {
    text: recognizedText,
    chunks,
    snippetStart: startSec,
    snippetDuration: sampleDuration
  };
});

// Calculate OpenSubtitles 64-bit checksum and file size
ipcMain.handle('media:movie-hash', async (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;
    const chunkSize = 65536; // 64KB

    if (fileSize < chunkSize) {
      return { movieHash: '', fileSize };
    }

    const buf = Buffer.alloc(chunkSize);

    // Read first 64KB
    fs.readSync(fd, buf, 0, chunkSize, 0);
    let hash = BigInt(fileSize);
    for (let i = 0; i < chunkSize; i += 8) {
      hash = (hash + buf.readBigUInt64LE(i)) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    // Read last 64KB
    fs.readSync(fd, buf, 0, chunkSize, fileSize - chunkSize);
    for (let i = 0; i < chunkSize; i += 8) {
      hash = (hash + buf.readBigUInt64LE(i)) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    return {
      movieHash: hash.toString(16).padStart(16, '0'),
      fileSize
    };
  } finally {
    fs.closeSync(fd);
  }
});

// -------------------------------------------------------------
// VLSUB REAL-TIME OPENSUBTITLES SEARCH & DOWNLOAD
// -------------------------------------------------------------

function fetchWithRedirect(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many HTTP redirects'));

    https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWithRedirect(res.headers.location, headers, maxRedirects - 1));
      }

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try {
            buf = zlib.gunzipSync(buf);
          } catch (e) {
            // Not gzipped
          }
        }
        resolve(buf);
      });
    }).on('error', reject);
  });
}

// Search OpenSubtitles REST API
ipcMain.handle('vlsub:search', async (event, { query, hash, fileSize, lang }) => {
  let url = 'https://rest.opensubtitles.org/search';

  if (hash && fileSize) {
    url += `/moviebytesize-${fileSize}/moviehash-${hash}`;
  } else if (query) {
    url += `/query-${encodeURIComponent(query.trim())}`;
  } else {
    return [];
  }

  if (lang && lang !== 'all') {
    url += `/sublanguageid-${lang}`;
  }

  try {
    const rawData = await fetchWithRedirect(url, {
      'User-Agent': 'TemporaryUserAgent'
    });

    const parsed = JSON.parse(rawData.toString('utf8'));
    if (!Array.isArray(parsed)) return [];

    return parsed.map(item => ({
      id: item.IDSubtitleFile || item.IDSubtitle || String(Math.random()),
      title: item.SubFileName || item.MovieReleaseName || 'Untitled Subtitle',
      releaseName: item.MovieReleaseName || item.SubFileName || '',
      lang: item.SubLanguageID || item.ISO639 || 'und',
      langName: item.LanguageName || 'Unknown',
      format: (item.SubFormat || 'srt').toUpperCase(),
      rating: parseFloat(item.SubRating || '0').toFixed(1),
      downloads: parseInt(item.SubDownloadsCnt || '0', 10),
      downloadUrl: item.SubDownloadLink
    }));
  } catch (err) {
    console.error('VLSub Search Error:', err);
    throw new Error(`OpenSubtitles search failed: ${err.message}`);
  }
});

// Download and decompress .srt subtitle file
ipcMain.handle('vlsub:download', async (event, { downloadUrl, savePath }) => {
  if (!downloadUrl) throw new Error('Missing download URL');

  try {
    const gzippedBuffer = await fetchWithRedirect(downloadUrl, {
      'User-Agent': 'VLSub 0.10.2'
    });

    let srtText = '';
    try {
      const decompressed = zlib.gunzipSync(gzippedBuffer);
      srtText = decompressed.toString('utf8');
    } catch (e) {
      srtText = gzippedBuffer.toString('utf8');
    }

    if (savePath) {
      try {
        fs.writeFileSync(savePath, srtText, 'utf8');
      } catch (writeErr) {
        console.warn('Could not save subtitle to disk:', writeErr.message);
      }
    }

    return srtText;
  } catch (err) {
    console.error('VLSub Download Error:', err);
    throw new Error(`Failed to download subtitle: ${err.message}`);
  }
});

// -------------------------------------------------------------
// NATIVE FILE DIALOGS & INITIAL FILE IPC
// -------------------------------------------------------------

let mainWindow = null;
let initialFilePath = null;

function getFilePathFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  const videoExts = ['.mkv', '.mp4', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v', '.ts', '.m2ts', '.mpg', '.mpeg', '.vob', '.3gp', '.ogv'];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg && typeof arg === 'string' && !arg.startsWith('--') && !arg.startsWith('-')) {
      const ext = path.extname(arg).toLowerCase();
      if (videoExts.includes(ext) && fs.existsSync(arg)) {
        return path.resolve(arg);
      }
    }
  }
  return null;
}

// Extract initial file if WHELO was launched by double-clicking a video in Windows Explorer
initialFilePath = getFilePathFromArgv(process.argv);

ipcMain.handle('app:get-initial-file', () => {
  const file = initialFilePath;
  initialFilePath = null;
  return file;
});

// Native Open File Dialog for Videos
ipcMain.handle('dialog:open-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Video - WHELO Media Player',
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mkv', 'mp4', 'avi', 'mov', 'webm', 'wmv', 'flv', 'm4v', 'ts', 'm2ts', 'mpg', 'mpeg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Native Open File Dialog for Subtitles
ipcMain.handle('dialog:open-subtitle', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Subtitle File - WHELO',
    properties: ['openFile'],
    filters: [
      { name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass', 'ssa', 'sub'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, fileName: path.basename(filePath), content };
  }
  return null;
});

// -------------------------------------------------------------
// MAIN BROWSER WINDOW & SINGLE INSTANCE LOCK
// -------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: '#0A0C10',
    title: 'WHELO Media Player',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows loading local video/subtitle files freely
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false
    }
  });

  Menu.setApplicationMenu(null);

  // Load the built production HTML directly from disk
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('[RENDERER]:', message);
  });

  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Enforce single instance so double-clicking another video sends it to the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const newFile = getFilePathFromArgv(commandLine);
      if (newFile) {
        mainWindow.webContents.send('app:open-file', newFile);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
