// Pure JavaScript Container Parser for Matroska (MKV/WebM) and MP4/MOV
// Extracts embedded audio tracks and subtitle tracks directly from file headers

export async function parseContainerTracks(file) {
  if (!file || !(file instanceof Blob)) {
    return { audioTracks: [], subtitleTracks: [] };
  }

  try {
    const headerBuffer = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);

    // 1. Check for Matroska / WebM EBML ID (0x1A, 0x45, 0xDF, 0xA3)
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return parseMatroskaTracks(bytes);
    }

    // 2. Check for MP4 / QuickTime ftyp / moov
    const isMp4 = hasMp4Box(bytes, 'ftyp') || hasMp4Box(bytes, 'moov');
    if (isMp4) {
      return parseMp4Tracks(bytes);
    }
  } catch (err) {
    console.warn('Container parser error:', err);
  }

  return { audioTracks: [], subtitleTracks: [] };
}

// -------------------------------------------------------------
// MATROSKA (MKV / WEBM) EBML TRACK PARSER
// -------------------------------------------------------------
function parseMatroskaTracks(bytes) {
  const audioTracks = [];
  const subtitleTracks = [];

  // Search for Tracks element ID: 0x16, 0x54, 0xAE, 0x6B
  let tracksPos = -1;
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x16 && bytes[i + 1] === 0x54 && bytes[i + 2] === 0xae && bytes[i + 3] === 0x6b) {
      tracksPos = i;
      break;
    }
  }

  if (tracksPos === -1) {
    return { audioTracks, subtitleTracks };
  }

  // Parse TrackEntry elements (ID: 0xAE)
  let pos = tracksPos + 4;
  // skip tracks element size VINT
  const tracksSize = readVint(bytes, pos);
  pos += tracksSize.length;
  const tracksEnd = Math.min(bytes.length, pos + tracksSize.value);

  let trackIndex = 0;
  while (pos < tracksEnd - 2) {
    if (bytes[pos] === 0xae) { // TrackEntry
      pos++;
      const entrySize = readVint(bytes, pos);
      pos += entrySize.length;
      const entryEnd = Math.min(bytes.length, pos + entrySize.value);

      let trackType = 0; // 1 = video, 2 = audio, 17 = subtitle
      let trackNum = ++trackIndex;
      let name = '';
      let lang = 'und';
      let codec = '';
      let channels = 2;

      while (pos < entryEnd - 1) {
        const idByte = bytes[pos];

        if (idByte === 0xd7) { // TrackNumber
          pos++;
          const sz = readVint(bytes, pos); pos += sz.length;
          trackNum = readUint(bytes, pos, sz.value); pos += sz.value;
        } else if (idByte === 0x83) { // TrackType
          pos++;
          const sz = readVint(bytes, pos); pos += sz.length;
          trackType = readUint(bytes, pos, sz.value); pos += sz.value;
        } else if (idByte === 0x53 && bytes[pos + 1] === 0x6e) { // Name (0x536E)
          pos += 2;
          const sz = readVint(bytes, pos); pos += sz.length;
          name = new TextDecoder('utf-8').decode(bytes.subarray(pos, pos + sz.value));
          pos += sz.value;
        } else if (idByte === 0x22 && bytes[pos + 1] === 0xb5 && bytes[pos + 2] === 0x9c) { // Language (0x22B59C)
          pos += 3;
          const sz = readVint(bytes, pos); pos += sz.length;
          lang = new TextDecoder('ascii').decode(bytes.subarray(pos, pos + sz.value)).trim();
          pos += sz.value;
        } else if (idByte === 0x86) { // CodecID
          pos++;
          const sz = readVint(bytes, pos); pos += sz.length;
          codec = new TextDecoder('ascii').decode(bytes.subarray(pos, pos + sz.value)).trim();
          pos += sz.value;
        } else if (idByte === 0xe1) { // Audio settings
          pos++;
          const sz = readVint(bytes, pos); pos += sz.length;
          const aEnd = pos + sz.value;
          while (pos < aEnd) {
            if (bytes[pos] === 0x9f) { // Channels
              pos++;
              const cSz = readVint(bytes, pos); pos += cSz.length;
              channels = readUint(bytes, pos, cSz.value); pos += cSz.value;
            } else {
              pos++;
            }
          }
        } else {
          pos++;
        }
      }

      if (trackType === 2) { // Audio
        const cleanCodec = codec.replace(/^A_/, '').toUpperCase() || 'AUDIO';
        const label = name || `Track ${audioTracks.length + 1} [${lang.toUpperCase()}] • ${cleanCodec} (${channels}ch)`;
        audioTracks.push({
          id: `mkv-audio-${trackNum}`,
          streamIndex: trackNum,
          name: label,
          lang,
          codec: cleanCodec,
          channels,
          isNative: true
        });
      } else if (trackType === 17) { // Subtitle
        const cleanCodec = codec.replace(/^S_TEXT\//, '').replace(/^S_/, '').toUpperCase() || 'SUB';
        const label = name || `Track ${subtitleTracks.length + 1} [${lang.toUpperCase()}] • ${cleanCodec}`;
        subtitleTracks.push({
          id: `mkv-sub-${trackNum}`,
          streamIndex: trackNum,
          name: label,
          lang,
          codec: cleanCodec,
          isNative: true
        });
      }

      pos = entryEnd;
    } else {
      pos++;
    }
  }

  return { audioTracks, subtitleTracks };
}

// -------------------------------------------------------------
// MP4 / MOV BOX PARSER
// -------------------------------------------------------------
function hasMp4Box(bytes, boxType) {
  for (let i = 0; i < Math.min(bytes.length - 4, 1024); i++) {
    if (bytes[i] === boxType.charCodeAt(0) &&
        bytes[i + 1] === boxType.charCodeAt(1) &&
        bytes[i + 2] === boxType.charCodeAt(2) &&
        bytes[i + 3] === boxType.charCodeAt(3)) {
      return true;
    }
  }
  return false;
}

function parseMp4Tracks(bytes) {
  const audioTracks = [];
  const subtitleTracks = [];

  // Find 'trak' boxes in bytes
  for (let i = 0; i < bytes.length - 12; i++) {
    if (bytes[i + 4] === 0x74 && bytes[i + 5] === 0x72 && bytes[i + 6] === 0x61 && bytes[i + 7] === 0x6b) { // 'trak'
      const trakSize = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
      if (trakSize > 0 && i + trakSize <= bytes.length) {
        const trakBytes = bytes.subarray(i, i + trakSize);
        // Look for handler type in 'hdlr' box
        for (let j = 0; j < trakBytes.length - 12; j++) {
          if (trakBytes[j] === 0x68 && trakBytes[j + 1] === 0x64 && trakBytes[j + 2] === 0x6c && trakBytes[j + 3] === 0x72) { // 'hdlr'
            const handler = String.fromCharCode(trakBytes[j + 8], trakBytes[j + 9], trakBytes[j + 10], trakBytes[j + 11]);
            if (handler === 'soun') {
              const idx = audioTracks.length + 1;
              audioTracks.push({
                id: `mp4-audio-${idx}`,
                streamIndex: idx,
                name: `Track ${idx} [Audio AAC/Stereo]`,
                lang: 'und',
                codec: 'AAC',
                channels: 2,
                isNative: true
              });
            } else if (handler === 'sbtl' || handler === 'subt' || handler === 'text') {
              const idx = subtitleTracks.length + 1;
              subtitleTracks.push({
                id: `mp4-sub-${idx}`,
                streamIndex: idx,
                name: `Track ${idx} [Inbuilt Subtitle]`,
                lang: 'und',
                codec: 'TX3G',
                isNative: true
              });
            }
            break;
          }
        }
      }
    }
  }

  return { audioTracks, subtitleTracks };
}

// -------------------------------------------------------------
// EBML HELPERS
// -------------------------------------------------------------
function readVint(bytes, pos) {
  if (pos >= bytes.length) return { length: 1, value: 0 };
  const first = bytes[pos];
  let mask = 0x80;
  let length = 1;
  while ((first & mask) === 0 && length < 8) {
    mask >>= 1;
    length++;
  }
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) {
    if (pos + i < bytes.length) {
      value = (value << 8) | bytes[pos + i];
    }
  }
  return { length, value };
}

function readUint(bytes, pos, length) {
  let val = 0;
  for (let i = 0; i < length; i++) {
    if (pos + i < bytes.length) {
      val = (val << 8) | bytes[pos + i];
    }
  }
  return val;
}
