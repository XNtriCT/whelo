const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
      return file.path || null;
    } catch (e) {
      return file.path || null;
    }
  },
  showOpenVideoDialog: () => ipcRenderer.invoke('dialog:open-video'),
  showOpenSubtitleDialog: () => ipcRenderer.invoke('dialog:open-subtitle'),
  getInitialFile: () => ipcRenderer.invoke('app:get-initial-file'),
  onOpenFile: (callback) => {
    ipcRenderer.on('app:open-file', (event, filePath) => callback(filePath));
  },
  probeMedia: (filePath) => ipcRenderer.invoke('media:probe', filePath),
  extractSubtitle: (filePath, streamIndex) => ipcRenderer.invoke('media:extract-subtitle', { filePath, streamIndex }),
  extractAudio: (filePath, streamIndex) => ipcRenderer.invoke('media:extract-audio', { filePath, streamIndex }),
  getMovieHash: (filePath) => ipcRenderer.invoke('media:movie-hash', filePath),
  vlsubSearch: (params) => ipcRenderer.invoke('vlsub:search', params),
  vlsubDownload: (params) => ipcRenderer.invoke('vlsub:download', params),
  transcribeAudioSnippet: (params) => ipcRenderer.invoke('media:transcribe-audio-snippet', params)
});
