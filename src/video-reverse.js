// Reverse a piece of a video: frames are read from a hidden <video> (half a second at a time,
// while it plays fast; by seeking for any frame missed), drawn to a canvas and written out in
// reverse order as a new WebM file (VP8 + Opus via WebCodecs), with the sound reversed sample by
// sample. Browsers without WebCodecs (or that can't play WebM) get a slower
// path: frames are kept as JPEGs and the reversed sequence is recorded in real time.
import { WebmWriter } from './video-webm.js';
import { loadVideo, seekTo, playCapture } from './video-frames.js';

export const REVERSE_MAX = 60; // seconds, WebCodecs path
export const REVERSE_MAX_SLOW = 20; // seconds, real-time fallback
const FPS = 30;

const webmPlays = () => {
  try {
    return !!document.createElement('video').canPlayType('video/webm; codecs="vp8, opus"');
  } catch {
    return false;
  }
};
/** Which method this browser will use and the longest clip it can reverse. */
export function reverseSupport() {
  // window.__artvasSlowReverse forces the fallback (tests)
  const fast = !window.__artvasSlowReverse && typeof VideoEncoder === 'function' && typeof VideoFrame === 'function' && webmPlays();
  const slow = typeof MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  return { fast, slow, max: fast ? REVERSE_MAX : slow ? REVERSE_MAX_SLOW : 0 };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Output size: at most 720 on the short side (and even numbers for the encoder). */
function outSize(v, maxShort) {
  const w = v.videoWidth || 640;
  const h = v.videoHeight || 360;
  const s = Math.min(1, maxShort / Math.min(w, h));
  return [Math.max(2, Math.round((w * s) / 2) * 2), Math.max(2, Math.round((h * s) / 2) * 2)];
}

/** Decode the sound of [from, to] at 48 kHz and reverse it. Returns an AudioBuffer-like {chans, sampleRate} or null. */
async function reversedSound(buf, from, to) {
  try {
    const sr = 48000;
    const dec = await new OfflineAudioContext(1, 1, sr).decodeAudioData(buf);
    const a = Math.max(0, Math.floor(from * sr));
    const b = Math.min(dec.length, Math.floor(to * sr));
    if (b - a < sr * 0.05) return null;
    const chans = [];
    for (let c = 0; c < Math.min(2, dec.numberOfChannels); c++) chans.push(dec.getChannelData(c).slice(a, b).reverse());
    return { chans, sampleRate: sr };
  } catch {
    return null; // no sound track
  }
}

/**
 * blob: the source media; from/to: seconds. onProgress(fraction 0–1, text).
 * Returns { blob, duration, width, height, hasAudio, method }.
 */
export async function reverseVideo(blob, from, to, { onProgress = () => {}, maxShort = 720 } = {}) {
  const sup = reverseSupport();
  const len = to - from;
  if (len > sup.max + 0.05) throw new Error(`too long:${sup.max}`);
  if (len < 0.1) throw new Error('too short');
  const url = URL.createObjectURL(blob);
  try {
    const v = await loadVideo(url);
    const [w, h] = outSize(v, sup.fast ? maxShort : Math.min(maxShort, 480));
    onProgress(0, 'Reading the sound…');
    const sound = await reversedSound(await blob.arrayBuffer(), from, to);
    return sup.fast ? await reverseFast(v, from, to, w, h, sound, onProgress) : await reverseSlow(v, from, to, w, h, sound, onProgress);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function reverseFast(v, from, to, w, h, sound, onProgress) {
  const n = Math.max(1, Math.round((to - from) * FPS));
  const codec = 'vp8';
  const writer = new WebmWriter({ video: { codec, width: w, height: h }, audio: sound ? { sampleRate: sound.sampleRate, channels: sound.chans.length } : null });
  let fail = null;
  const ve = new VideoEncoder({ output: (chunk, meta) => writer.addVideoChunk(chunk, meta), error: (e) => (fail = e) });
  ve.configure({ codec, width: w, height: h, bitrate: Math.round(Math.min(8e6, Math.max(1.5e6, w * h * 5))), framerate: FPS, latencyMode: 'quality' });
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { alpha: false });
  const stats = { play: 0, seek: 0, encode: 0, seeks: 0 };
  // output frame i shows the source at (to - (i + 0.5) / fps): the last frame first
  const srcOf = (i) => Math.max(from, to - (i + 0.5) / FPS);
  const SEG = 0.5; // seconds read per pass (frames are held in memory until encoded)
  let i = 0;
  let segEnd = to;
  while (i < n) {
    if (fail) throw fail;
    const segStart = Math.max(from, segEnd - SEG);
    let iEnd = i;
    while (iEnd < n && (srcOf(iEnd) >= segStart - 1e-9 || segStart <= from)) iEnd++;
    if (iEnd === i) iEnd = i + 1;
    const lo = srcOf(iEnd - 1);
    const hi = srcOf(i);
    const frames = [];
    let tA = performance.now();
    await playCapture(v, Math.max(0, lo - 0.12), hi + 0.001, (t) => {
      if (t < lo - 0.15 || t > hi + 0.05) return;
      g.drawImage(v, 0, 0, w, h);
      frames.push({ t, bmp: createImageBitmap(c) });
    });
    stats.play += performance.now() - tA;
    for (let k = i; k < iEnd; k++) {
      const s = srcOf(k);
      let f = null;
      for (const x of frames) if (x.t <= s + 0.002 && (!f || x.t > f.t)) f = x;
      let src;
      if (f && s - f.t < 0.1) src = await f.bmp;
      else {
        // not caught while playing: seek to it
        tA = performance.now();
        await seekTo(v, s);
        g.drawImage(v, 0, 0, w, h);
        src = c;
        stats.seek += performance.now() - tA;
        stats.seeks++;
      }
      tA = performance.now();
      const frame = new VideoFrame(src, { timestamp: Math.round((k * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      ve.encode(frame, { keyFrame: k % FPS === 0 });
      frame.close();
      while (ve.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      stats.encode += performance.now() - tA;
    }
    for (const x of frames) x.bmp.then((b) => b.close());
    onProgress((iEnd / n) * (sound ? 0.85 : 0.97), `Reversing frames… ${Math.round((iEnd / n) * 100)}%`);
    i = iEnd;
    segEnd = segStart;
  }
  await ve.flush();
  ve.close();
  if (fail) throw fail;
  let hasAudio = false;
  if (sound && typeof AudioEncoder === 'function') {
    onProgress(0.9, 'Reversing the sound…');
    try {
      await encodeOpus(writer, sound);
      hasAudio = true;
    } catch (e) {
      console.warn('reverse: sound left out', e);
    }
  }
  onProgress(0.98, 'Saving…');
  const out = writer.finish(n / FPS);
  for (const k in stats) stats[k] = Math.round(stats[k]);
  return { blob: new Blob([out], { type: 'video/webm' }), duration: n / FPS, width: w, height: h, hasAudio, method: 'webcodecs', stats };
}

async function encodeOpus(writer, { chans, sampleRate }) {
  const ch = chans.length;
  const cfg = { codec: 'opus', sampleRate, numberOfChannels: ch, bitrate: 128000 };
  if (!(await AudioEncoder.isConfigSupported(cfg)).supported) throw new Error('opus not supported');
  let fail = null;
  const ae = new AudioEncoder({ output: (chunk, meta) => writer.addAudioChunk(chunk, meta), error: (e) => (fail = e) });
  ae.configure(cfg);
  const step = 960 * 5; // 100 ms per AudioData
  const total = chans[0].length;
  for (let o = 0; o < total; o += step) {
    const k = Math.min(step, total - o);
    const data = new Float32Array(k * ch);
    for (let c = 0; c < ch; c++) data.set(chans[c].subarray(o, o + k), c * k);
    const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: k, numberOfChannels: ch, timestamp: Math.round((o / sampleRate) * 1e6), data });
    ae.encode(ad);
    ad.close();
    if (fail) throw fail;
    if (ae.encodeQueueSize > 20) await tick();
  }
  await ae.flush();
  ae.close();
  if (fail) throw fail;
}

/** Fallback: keep frames as JPEGs, then play them back in reverse into a MediaRecorder. */
async function reverseSlow(v, from, to, w, h, sound, onProgress) {
  const fps = 24;
  const n = Math.max(1, Math.round((to - from) * fps));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { alpha: false });
  const jpgs = [];
  for (let i = 0; i < n; i++) {
    await seekTo(v, Math.max(from, to - (i + 0.5) / fps));
    g.drawImage(v, 0, 0, w, h);
    jpgs.push(await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85)));
    if (i % 5 === 0) onProgress((i / n) * 0.5, `Reading frames… ${Math.round((i / n) * 100)}%`);
  }
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  const tracks = [...c.captureStream(fps).getVideoTracks()];
  let ac = null;
  let srcNode = null;
  if (sound) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC({ sampleRate: sound.sampleRate });
    const buf = ac.createBuffer(sound.chans.length, sound.chans[0].length, sound.sampleRate);
    sound.chans.forEach((d, i) => buf.copyToChannel(d, i));
    srcNode = ac.createBufferSource();
    srcNode.buffer = buf;
    const dest = ac.createMediaStreamDestination();
    srcNode.connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  }
  const rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : {});
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  // decode a few frames ahead
  const bmp = new Map();
  const want = (i) => {
    if (i < n && !bmp.has(i)) bmp.set(i, createImageBitmap(jpgs[i]));
  };
  for (let i = 0; i < 6; i++) want(i);
  g.drawImage(await bmp.get(0), 0, 0, w, h);
  rec.start(200);
  await ac?.resume?.();
  srcNode?.start();
  const t0 = performance.now();
  let shown = 0;
  while (shown < n) {
    await new Promise((r) => requestAnimationFrame(r));
    const i = Math.min(n - 1, Math.floor(((performance.now() - t0) / 1000) * fps));
    if (i >= shown) {
      want(i + 1);
      for (let k = i + 1; k < i + 7; k++) want(k);
      const b = await bmp.get(i);
      g.drawImage(b, 0, 0, w, h);
      for (const [k, p] of bmp) if (k <= i) { p.then((x) => x.close?.()); bmp.delete(k); }
      shown = i + 1;
      onProgress(0.5 + (shown / n) * 0.48, `Recording… ${Math.round((shown / n) * 100)}%`);
    }
  }
  await new Promise((r) => setTimeout(r, 1000 / fps + 30));
  rec.stop();
  await stopped;
  srcNode?.stop?.();
  ac?.close?.();
  const type = (mime || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), duration: n / fps, width: w, height: h, hasAudio: !!sound, method: 'recorder' };
}
