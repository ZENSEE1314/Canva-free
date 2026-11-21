// A small WebM (Matroska) writer for WebCodecs output: one VP8/VP9 video track and an optional
// Opus audio track. Everything is kept in memory and written out at the end with a SeekHead,
// a known Segment size, a Duration and Cues, so browsers can seek the file right away.

const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2, EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac,
  Info: 0x1549a966, TimecodeScale: 0x2ad7b1, Duration: 0x4489, MuxingApp: 0x4d80, WritingApp: 0x5741,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83, FlagLacing: 0x9c,
  CodecID: 0x86, CodecPrivate: 0x63a2, CodecDelay: 0x56aa, SeekPreRoll: 0x56bb, DefaultDuration: 0x23e383,
  Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba, Colour: 0x55b0, MatrixCoefficients: 0x55b1, Range: 0x55b9, TransferCharacteristics: 0x55ba, Primaries: 0x55bb, Audio: 0xe1, SamplingFrequency: 0xb5, Channels: 0x9f,
  Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b, CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7, CueClusterPosition: 0xf1,
};

const enc = new TextEncoder();
function idBytes(id) {
  const out = [];
  while (id > 0) {
    out.unshift(id & 0xff);
    id = Math.floor(id / 256);
  }
  return out;
}
function sizeBytes(n) {
  let len = 1;
  while (len < 8 && n >= 2 ** (7 * len) - 1) len++;
  const out = new Array(len);
  let v = n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0] |= 0x80 >> (len - 1);
  return out;
}
function uintBytes(v, fixed = 0) {
  const out = [];
  do {
    out.unshift(v % 256);
    v = Math.floor(v / 256);
  } while (v > 0);
  while (out.length < fixed) out.unshift(0);
  return out;
}
function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
/** One element: id + size + payload. Payload: Uint8Array, array of Uint8Arrays, or number array. */
function el(id, payload) {
  const body = payload instanceof Uint8Array ? payload : Array.isArray(payload) && payload.length && payload[0] instanceof Uint8Array ? concat(payload) : Array.isArray(payload) && !payload.length ? new Uint8Array(0) : new Uint8Array(payload);
  return concat([new Uint8Array(idBytes(id)), new Uint8Array(sizeBytes(body.length)), body]);
}
const uint = (id, v, fixed) => el(id, uintBytes(v, fixed));
const str = (id, s) => el(id, enc.encode(s));
function float(id, v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v);
  return el(id, b);
}

/** OpusHead for CodecPrivate (used when the encoder gives no description). */
function opusHead(channels, sampleRate, preSkip = 312) {
  const b = new Uint8Array(19);
  b.set(enc.encode('OpusHead'));
  const d = new DataView(b.buffer);
  d.setUint8(8, 1);
  d.setUint8(9, channels);
  d.setUint16(10, preSkip, true);
  d.setUint32(12, sampleRate, true);
  d.setInt16(16, 0, true);
  d.setUint8(18, 0);
  return b;
}

// WebCodecs colour space names -> Matroska codes (ISO/IEC 23091-4)
const MATRIX = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
const TRANSFER = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8, pq: 16, hlg: 18 };
const PRIMARIES = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };
/** The Colour element, so players know the range (encoders fed from a canvas write full range). */
function colourEl(cs) {
  if (!cs) return [];
  const parts = [];
  if (cs.matrix in MATRIX) parts.push(uint(ID.MatrixCoefficients, MATRIX[cs.matrix]));
  if (cs.fullRange != null) parts.push(uint(ID.Range, cs.fullRange ? 2 : 1));
  if (cs.transfer in TRANSFER) parts.push(uint(ID.TransferCharacteristics, TRANSFER[cs.transfer]));
  if (cs.primaries in PRIMARIES) parts.push(uint(ID.Primaries, PRIMARIES[cs.primaries]));
  return parts.length ? [el(ID.Colour, parts)] : [];
}

export class WebmWriter {
  /**
   * video: { codec: 'vp8' | 'vp9', width, height }
   * audio: { sampleRate, channels } or null
   */
  constructor({ video, audio = null }) {
    this.video = video;
    this.audio = audio;
    this.blocks = []; // { track, ts (ms), key, data }
    this.audioPrivate = null;
  }
  addVideoChunk(chunk, meta) {
    const cs = meta?.decoderConfig?.colorSpace;
    if (cs && !this.colorSpace) this.colorSpace = cs;
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.blocks.push({ track: 1, ts: chunk.timestamp / 1000, key: chunk.type === 'key', data });
  }
  addAudioChunk(chunk, meta) {
    if (!this.audio) return;
    const desc = meta?.decoderConfig?.description;
    if (desc && !this.audioPrivate) this.audioPrivate = new Uint8Array(desc instanceof ArrayBuffer ? desc : desc.buffer ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc);
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.blocks.push({ track: 2, ts: chunk.timestamp / 1000, key: true, data });
  }
  /** Build the file. duration in seconds. */
  finish(duration) {
    const v = this.video;
    const tracks = [
      el(ID.TrackEntry, [
        uint(ID.TrackNumber, 1), uint(ID.TrackUID, 1), uint(ID.TrackType, 1), uint(ID.FlagLacing, 0),
        str(ID.CodecID, v.codec === 'vp9' ? 'V_VP9' : 'V_VP8'),
        el(ID.Video, [uint(ID.PixelWidth, v.width), uint(ID.PixelHeight, v.height), ...colourEl(this.colorSpace)]),
      ]),
    ];
    const hasAudio = this.audio && this.blocks.some((b) => b.track === 2);
    if (hasAudio) {
      const a = this.audio;
      let priv = this.audioPrivate;
      if (!priv || priv.length < 19 || String.fromCharCode(...priv.slice(0, 8)) !== 'OpusHead') priv = opusHead(a.channels, a.sampleRate);
      const preSkip = new DataView(priv.buffer, priv.byteOffset).getUint16(10, true);
      tracks.push(
        el(ID.TrackEntry, [
          uint(ID.TrackNumber, 2), uint(ID.TrackUID, 2), uint(ID.TrackType, 2), uint(ID.FlagLacing, 0),
          str(ID.CodecID, 'A_OPUS'), el(ID.CodecPrivate, priv),
          uint(ID.CodecDelay, Math.round((preSkip / 48000) * 1e9)), uint(ID.SeekPreRoll, 80_000_000),
          el(ID.Audio, [float(ID.SamplingFrequency, a.sampleRate), uint(ID.Channels, a.channels)]),
        ])
      );
    }
    const info = el(ID.Info, [uint(ID.TimecodeScale, 1_000_000), float(ID.Duration, duration * 1000), str(ID.MuxingApp, 'Artvas'), str(ID.WritingApp, 'Artvas')]);
    const tracksEl = el(ID.Tracks, tracks);

    // clusters: a new one at every video keyframe (and at least every 5 s)
    const blocks = this.blocks.filter((b) => hasAudio || b.track === 1).sort((x, y) => x.ts - y.ts || x.track - y.track);
    const clusters = [];
    let cur = null;
    for (const b of blocks) {
      const ts = Math.max(0, Math.round(b.ts));
      if (!cur || (b.track === 1 && b.key) || ts - cur.ts > 5000) {
        cur = { ts, parts: [], key: b.track === 1 && b.key };
        clusters.push(cur);
      }
      const hdr = new Uint8Array(4);
      hdr[0] = 0x80 | b.track;
      new DataView(hdr.buffer).setInt16(1, ts - cur.ts);
      hdr[3] = b.key ? 0x80 : 0;
      cur.parts.push(el(ID.SimpleBlock, [hdr, b.data]));
    }
    const clusterEls = clusters.map((c) => el(ID.Cluster, [uint(ID.Timecode, c.ts), ...c.parts]));

    // SeekHead with fixed-width positions, so its size is known before the positions are
    const seekEntry = (id, pos) => el(ID.Seek, [el(ID.SeekID, idBytes(id)), uint(ID.SeekPosition, pos, 8)]);
    const seekSize = el(ID.SeekHead, [seekEntry(ID.Info, 0), seekEntry(ID.Tracks, 0), seekEntry(ID.Cues, 0)]).length;
    const infoPos = seekSize;
    const tracksPos = infoPos + info.length;
    let pos = tracksPos + tracksEl.length;
    const cuePoints = [];
    clusters.forEach((c, i) => {
      if (c.key) cuePoints.push(el(ID.CuePoint, [uint(ID.CueTime, c.ts), el(ID.CueTrackPositions, [uint(ID.CueTrack, 1), uint(ID.CueClusterPosition, pos)])]));
      pos += clusterEls[i].length;
    });
    const cuesPos = pos;
    const cues = el(ID.Cues, cuePoints);
    const seekHead = el(ID.SeekHead, [seekEntry(ID.Info, infoPos), seekEntry(ID.Tracks, tracksPos), seekEntry(ID.Cues, cuesPos)]);
    const segBody = [seekHead, info, tracksEl, ...clusterEls, cues];
    let segLen = 0;
    for (const p of segBody) segLen += p.length;
    const header = el(ID.EBML, [
      uint(ID.EBMLVersion, 1), uint(ID.EBMLReadVersion, 1), uint(ID.EBMLMaxIDLength, 4), uint(ID.EBMLMaxSizeLength, 8),
      str(ID.DocType, 'webm'), uint(ID.DocTypeVersion, 4), uint(ID.DocTypeReadVersion, 2),
    ]);
    const segHead = concat([new Uint8Array(idBytes(ID.Segment)), new Uint8Array(sizeBytes(segLen))]);
    return new Blob([header, segHead, ...segBody], { type: hasAudio ? 'video/webm; codecs="vp8, opus"'.replace('vp8', v.codec === 'vp9' ? 'vp9' : 'vp8') : 'video/webm' });
  }
}
