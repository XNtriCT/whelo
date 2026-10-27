// VLSub Subtitle Finder Engine for WHELO
// Connects directly to the real OpenSubtitles REST API (used by VLC Media Player)
// Supports real-time search by Title and 64-bit MovieHash across 100+ languages
// Downloads and decompresses real .srt files with 1-click player injection

export class VLSubService {
  constructor() {
    this.languages = [
      { code: 'all', name: 'All Languages' },
      { code: 'eng', name: 'English' },
      { code: 'spa', name: 'Spanish (Español)' },
      { code: 'fre', name: 'French (Français)' },
      { code: 'ger', name: 'German (Deutsch)' },
      { code: 'ita', name: 'Italian (Italiano)' },
      { code: 'por', name: 'Portuguese (Português)' },
      { code: 'pob', name: 'Brazilian Portuguese' },
      { code: 'jpn', name: 'Japanese (日本語)' },
      { code: 'kor', name: 'Korean (한국어)' },
      { code: 'chi', name: 'Chinese (中文)' },
      { code: 'hin', name: 'Hindi (हिन्दी)' },
      { code: 'ara', name: 'Arabic (العربية)' },
      { code: 'rus', name: 'Russian (Русский)' },
      { code: 'dut', name: 'Dutch (Nederlands)' },
      { code: 'tur', name: 'Turkish (Türkçe)' },
      { code: 'pol', name: 'Polish (Polski)' },
      { code: 'swe', name: 'Swedish (Svenska)' },
      { code: 'dan', name: 'Danish (Dansk)' },
      { code: 'fin', name: 'Finnish (Suomi)' },
      { code: 'gre', name: 'Greek (Ελληνικά)' },
      { code: 'heb', name: 'Hebrew (עברית)' },
      { code: 'ind', name: 'Indonesian (Bahasa)' },
      { code: 'nor', name: 'Norwegian (Norsk)' },
      { code: 'rum', name: 'Romanian (Română)' },
      { code: 'tha', name: 'Thai (ไทย)' },
      { code: 'vie', name: 'Vietnamese (Tiếng Việt)' }
    ];
  }

  // Real-time search using OpenSubtitles REST API
  async searchSubtitles({ query, language = 'all', isHash = false, filePath = null }) {
    const cleanQuery = (query || '').trim();
    const ISO_MAP = {
      en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por',
      ja: 'jpn', ko: 'kor', zh: 'chi', hi: 'hin', ar: 'ara', ru: 'rus',
      nl: 'dut', tr: 'tur', pl: 'pol', sv: 'swe'
    };
    const mappedLang = ISO_MAP[language] || language;
    const langCode = (mappedLang === 'all' || !mappedLang) ? '' : mappedLang;

    // 1. Electron IPC mode (Real OpenSubtitles API with zero CORS and direct gzip handling)
    if (window.electronAPI && typeof window.electronAPI.vlsubSearch === 'function') {
      try {
        let hash = null;
        let fileSize = null;

        if (isHash && filePath && typeof window.electronAPI.getMovieHash === 'function') {
          const hashInfo = await window.electronAPI.getMovieHash(filePath);
          if (hashInfo && hashInfo.movieHash) {
            hash = hashInfo.movieHash;
            fileSize = hashInfo.fileSize;
          }
        }

        const results = await window.electronAPI.vlsubSearch({
          query: isHash ? '' : cleanQuery,
          hash,
          fileSize,
          lang: langCode
        });

        if (Array.isArray(results) && results.length > 0) {
          return results;
        }

        // If hash search found no results, fallback to title search automatically
        if (isHash && cleanQuery) {
          const fallbackResults = await window.electronAPI.vlsubSearch({
            query: cleanQuery,
            lang: langCode
          });
          if (Array.isArray(fallbackResults) && fallbackResults.length > 0) {
            return fallbackResults;
          }
        }

        return [];
      } catch (ipcErr) {
        console.warn('Electron VLSub search error, attempting web fallback:', ipcErr);
      }
    }

    // 2. Direct Web API fallback
    try {
      let url = 'https://rest.opensubtitles.org/search';
      if (cleanQuery) {
        url += `/query-${encodeURIComponent(cleanQuery)}`;
      }
      if (langCode) {
        url += `/sublanguageid-${langCode}`;
      }

      const res = await fetch(url, {
        headers: {
          'X-User-Agent': 'TemporaryUserAgent'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map(item => ({
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
        }
      }
    } catch (webErr) {
      console.warn('Web VLSub fallback search error:', webErr);
    }

    return [];
  }

  // Download real subtitle text from OpenSubtitles
  async downloadSubtitle(item, savePath = null) {
    if (!item) throw new Error('No subtitle item specified');

    // 1. Electron IPC download (Native gunzip)
    if (window.electronAPI && typeof window.electronAPI.vlsubDownload === 'function') {
      if (item.downloadUrl) {
        const srtContent = await window.electronAPI.vlsubDownload({
          downloadUrl: item.downloadUrl,
          savePath
        });
        return srtContent;
      }
    }

    // 2. Direct web download fallback
    if (item.downloadUrl) {
      const res = await fetch(item.downloadUrl);
      if (res.ok) {
        // If server returns compressed stream
        if (typeof DecompressionStream !== 'undefined') {
          try {
            const ds = new DecompressionStream('gzip');
            const decompressedStream = res.body.pipeThrough(ds);
            return await new Response(decompressedStream).text();
          } catch (e) {
            // Not compressed or direct text
          }
        }
        return await res.text();
      }
    }

    if (item.content) {
      return item.content;
    }

    throw new Error('Subtitle download URL is unavailable');
  }
}
