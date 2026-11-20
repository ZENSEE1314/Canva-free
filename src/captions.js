// Auto captions: speech-to-text that runs in the browser with Whisper (transformers.js).
// The library loads from a CDN on first use; the model (~40 MB) is downloaded once and cached.
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
const MODELS = { fast: 'Xenova/whisper-tiny', accurate: 'Xenova/whisper-base' };
const cache = {};

async function getASR(quality, onStatus) {
  const id = MODELS[quality] || MODELS.fast;
  if (!cache[id]) {
    cache[id] = (async () => {
      const tf = await import(/* @vite-ignore */ TRANSFORMERS_URL);
      tf.env.allowLocalModels = false;
      return tf.pipeline('automatic-speech-recognition', id, {
        progress_callback: (p) => {
          if (p.status === 'progress' && p.file?.endsWith('.onnx')) onStatus?.(`Downloading speech model… ${Math.round(p.progress)}%`);
        },
      });
    })().catch((e) => {
      delete cache[id];
      throw e;
    });
  }
  return cache[id];
}

/** Decode a media blob, take [inSec, outSec], resample to 16 kHz mono. */
async function toMono16k(blob, inSec = 0, outSec) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const tmp = new AC();
  let audio;
  try {
    audio = await tmp.decodeAudioData(await blob.arrayBuffer());
  } finally {
    tmp.close?.();
  }
  const end = Math.min(audio.duration, outSec ?? audio.duration);
  const dur = Math.max(0.1, end - inSec);
  const off = new OfflineAudioContext(1, Math.ceil(dur * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start(0, inSec, dur);
  const out = await off.startRendering();
  return out.getChannelData(0);
}

/**
 * Transcribe part of a media file. Returns [{start, end, text}] in seconds relative to inSec.
 * language: undefined = auto-detect.
 */
export async function transcribeMedia(blob, { inSec = 0, outSec, quality = 'fast', language, onStatus } = {}) {
  onStatus?.('Reading audio…');
  let data;
  try {
    data = await toMono16k(blob, inSec, outSec);
  } catch {
    throw new Error('This clip has no audio track that can be read.');
  }
  let peak = 0;
  for (let i = 0; i < data.length; i += 64) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 0.01) return [];
  onStatus?.('Loading speech model…');
  let asr;
  try {
    asr = await getASR(quality, onStatus);
  } catch {
    throw new Error("Couldn't load the speech model. Auto captions need an internet connection the first time (works on your own Artvas site).");
  }
  onStatus?.('Listening…');
  const out = await asr(data, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, ...(language ? { language, task: 'transcribe' } : {}) });
  const chunks = out.chunks?.length ? out.chunks : [{ timestamp: [0, data.length / 16000], text: out.text || '' }];
  return chunks
    .map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 2, text: (c.text || '').trim() }))
    .filter((c) => c.text && !/^\[.*\]$/.test(c.text));
}

/** Split text into caption lines (by line breaks, then sentences, then ~7 words). */
export function scriptToLines(text) {
  const parts = text
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?。！？])\s+/))
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    // Chinese/Japanese/Thai have no spaces: split long lines at commas, then every ~14 characters
    if (!/\s/.test(p) && p.length > 16) {
      for (const piece of p.split(/(?<=[，、,；;：:])/)) {
        for (let i = 0; i < piece.length; i += 14) out.push(piece.slice(i, i + 14));
      }
      continue;
    }
    const words = p.split(/\s+/);
    if (words.length <= 9) out.push(p);
    else for (let i = 0; i < words.length; i += 7) out.push(words.slice(i, i + 7).join(' '));
  }
  return out;
}
