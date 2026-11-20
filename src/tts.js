// Text to speech with Kokoro-82M (Apache-2.0), running 100% in the browser via kokoro-js.
// The library loads from a CDN on first use; the voice model (~90 MB) is downloaded once and cached.
const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export const VOICES = [
  { id: 'af_heart', name: 'Heart', desc: 'warm, friendly', accent: 'US', gender: 'Female' },
  { id: 'af_bella', name: 'Bella', desc: 'bright, energetic', accent: 'US', gender: 'Female' },
  { id: 'af_nicole', name: 'Nicole', desc: 'soft, ASMR', accent: 'US', gender: 'Female' },
  { id: 'af_sarah', name: 'Sarah', desc: 'clear, calm', accent: 'US', gender: 'Female' },
  { id: 'af_sky', name: 'Sky', desc: 'young, light', accent: 'US', gender: 'Female' },
  { id: 'af_nova', name: 'Nova', desc: 'confident', accent: 'US', gender: 'Female' },
  { id: 'af_aoede', name: 'Aoede', desc: 'storyteller', accent: 'US', gender: 'Female' },
  { id: 'af_kore', name: 'Kore', desc: 'neutral', accent: 'US', gender: 'Female' },
  { id: 'af_river', name: 'River', desc: 'relaxed', accent: 'US', gender: 'Female' },
  { id: 'af_alloy', name: 'Alloy', desc: 'even, modern', accent: 'US', gender: 'Female' },
  { id: 'am_michael', name: 'Michael', desc: 'deep, narrator', accent: 'US', gender: 'Male' },
  { id: 'am_fenrir', name: 'Fenrir', desc: 'bold, punchy', accent: 'US', gender: 'Male' },
  { id: 'am_puck', name: 'Puck', desc: 'playful', accent: 'US', gender: 'Male' },
  { id: 'am_echo', name: 'Echo', desc: 'smooth', accent: 'US', gender: 'Male' },
  { id: 'am_eric', name: 'Eric', desc: 'professional', accent: 'US', gender: 'Male' },
  { id: 'am_liam', name: 'Liam', desc: 'young, casual', accent: 'US', gender: 'Male' },
  { id: 'am_onyx', name: 'Onyx', desc: 'low, serious', accent: 'US', gender: 'Male' },
  { id: 'am_adam', name: 'Adam', desc: 'everyday', accent: 'US', gender: 'Male' },
  { id: 'am_santa', name: 'Santa', desc: 'jolly, festive', accent: 'US', gender: 'Male' },
  { id: 'bf_emma', name: 'Emma', desc: 'polished', accent: 'UK', gender: 'Female' },
  { id: 'bf_isabella', name: 'Isabella', desc: 'elegant', accent: 'UK', gender: 'Female' },
  { id: 'bf_alice', name: 'Alice', desc: 'crisp', accent: 'UK', gender: 'Female' },
  { id: 'bf_lily', name: 'Lily', desc: 'gentle', accent: 'UK', gender: 'Female' },
  { id: 'bm_george', name: 'George', desc: 'classic narrator', accent: 'UK', gender: 'Male' },
  { id: 'bm_fable', name: 'Fable', desc: 'storybook', accent: 'UK', gender: 'Male' },
  { id: 'bm_lewis', name: 'Lewis', desc: 'documentary', accent: 'UK', gender: 'Male' },
  { id: 'bm_daniel', name: 'Daniel', desc: 'calm, clear', accent: 'UK', gender: 'Male' },
];

let ttsPromise;
async function getTTS(onStatus) {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const { KokoroTTS } = await import(/* @vite-ignore */ KOKORO_URL);
      const gpu = !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null));
      const progress_callback = (p) => {
        if (p.status === 'progress' && p.file?.endsWith('.onnx')) onStatus?.(`Downloading voice model… ${Math.round(p.progress)}%`);
      };
      try {
        return await KokoroTTS.from_pretrained(MODEL_ID, { dtype: gpu ? 'fp32' : 'q8', device: gpu ? 'webgpu' : 'wasm', progress_callback });
      } catch (e) {
        if (!gpu) throw e;
        return KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback });
      }
    })().catch((e) => {
      ttsPromise = null;
      throw e;
    });
  }
  return ttsPromise;
}

function splitText(text) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const out = [];
  for (const s of sentences) {
    if (s.length <= 300) out.push(s);
    else {
      // long sentence: break at commas / spaces
      let cur = '';
      for (const w of s.split(/(?<=,)\s+|\s+/)) {
        if ((cur + ' ' + w).length > 280) {
          out.push(cur.trim());
          cur = w;
        } else cur += ' ' + w;
      }
      if (cur.trim()) out.push(cur.trim());
    }
  }
  return out;
}

export function encodeWav(channels, sampleRate) {
  const n = channels[0].length;
  const ch = channels.length;
  const buf = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * ch * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Speak text with a voice. Returns { blob (WAV), duration, segments: [{text, start, end}] }.
 * segments are the timed sentences, useful for captions.
 */
export async function speak(text, { voice = 'af_heart', speed = 1, onStatus } = {}) {
  const parts = splitText(text);
  if (!parts.length) throw new Error('Type something to say first.');
  onStatus?.('Loading voice model…');
  let tts;
  try {
    tts = await getTTS(onStatus);
  } catch (e) {
    console.error(e);
    throw new Error("Couldn't load the voice model. Voices need an internet connection the first time (works on your own Artvas site).");
  }
  const pieces = [];
  const segments = [];
  let sr = 24000;
  let t = 0;
  for (let i = 0; i < parts.length; i++) {
    onStatus?.(parts.length > 1 ? `Speaking… ${i + 1} / ${parts.length}` : 'Speaking…');
    const a = await tts.generate(parts[i], { voice, speed });
    sr = a.sampling_rate || sr;
    const samples = a.audio;
    pieces.push(samples);
    segments.push({ text: parts[i], start: t, end: t + samples.length / sr });
    t += samples.length / sr;
    const gap = new Float32Array(Math.round(sr * 0.18));
    pieces.push(gap);
    t += gap.length / sr;
  }
  const total = pieces.reduce((a, p) => a + p.length, 0);
  const mono = new Float32Array(total);
  let o = 0;
  for (const p of pieces) {
    mono.set(p, o);
    o += p.length;
  }
  return { blob: encodeWav([mono], sr), duration: total / sr, segments };
}
