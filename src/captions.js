// Auto captions: speech-to-text that runs in the browser with Whisper (transformers.js).
// The library loads from a CDN on first use; the model (~40 MB) is downloaded once and cached.
import { needsSite, inPreview } from './env.js';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
const MODELS = { fast: 'Xenova/whisper-tiny', accurate: 'Xenova/whisper-base' };
const cache = {};
let tfLib = null;

async function getASR(quality, onStatus) {
  const id = MODELS[quality] || MODELS.fast;
  if (!cache[id]) {
    cache[id] = (async () => {
      const tf = await import(/* @vite-ignore */ TRANSFORMERS_URL);
      tfLib = tf;
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

// Languages Artvas users speak most; the speech model picks the most likely one.
const DETECT = ['en', 'zh', 'ms', 'id', 'ta', 'th', 'vi', 'tl', 'ja', 'ko', 'hi', 'es', 'fr', 'pt', 'de', 'ar', 'ru', 'it'];
export const LANG_NAMES = { en: 'English', zh: 'Chinese', ms: 'Malay', id: 'Indonesian', ta: 'Tamil', th: 'Thai', vi: 'Vietnamese', tl: 'Filipino', ja: 'Japanese', ko: 'Korean', hi: 'Hindi', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German', ar: 'Arabic', ru: 'Russian', it: 'Italian' };

/**
 * Work out the spoken language from the first 30 seconds.
 * (Left alone, the model assumes English and turns other languages into English or nonsense.)
 */
async function detectLanguage(asr, data) {
  const tf = tfLib;
  const tok = asr.tokenizer;
  const id = (t) => tok.model.tokens_to_ids.get(t);
  const sot = id('<|startoftranscript|>');
  if (sot == null || !tf) return null;
  const { input_features } = await asr.processor(data.subarray(0, 16000 * 30));
  const dec = new tf.Tensor('int64', BigInt64Array.from([BigInt(sot)]), [1, 1]);
  const out = await asr.model({ input_features, decoder_input_ids: dec });
  const logits = out.logits.data;
  let best = null;
  let bestV = -Infinity;
  for (const l of DETECT) {
    const i = id(`<|${l}|>`);
    if (i == null) continue;
    if (logits[i] > bestV) {
      bestV = logits[i];
      best = l;
    }
  }
  return best;
}

/** Remove the loops speech models sometimes fall into ("a video of a video of a video…"). */
export function cleanRepeats(text) {
  let t = text;
  for (let k = 0; k < 3; k++) {
    // a phrase of 1–8 words said 3+ times in a row
    t = t.replace(/((?:\S+\s+){1,8}?)\1{2,}/g, '$1');
    // the same for Chinese/Japanese: 1–12 characters repeated 3+ times
    t = t.replace(/([\u3000-\u9fff\uac00-\ud7af]{1,12}?)\1{2,}/g, '$1');
  }
  return t.replace(/\s+/g, ' ').trim();
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
    throw new Error(needsSite('Auto captions', "Couldn't load the speech model. Check your internet connection and try again (it downloads once, the first time)."));
  }
  let lang = language;
  if (!lang) {
    onStatus?.('Detecting the language…');
    try {
      lang = await detectLanguage(asr, data);
    } catch (e) {
      console.warn('language detection failed', e);
    }
    if (lang) onStatus?.(`Heard ${LANG_NAMES[lang] || lang}. Listening…`);
  } else onStatus?.('Listening…');
  const out = await asr(data, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, ...(lang ? { language: lang, task: 'transcribe' } : {}) });
  const chunks = out.chunks?.length ? out.chunks : [{ timestamp: [0, data.length / 16000], text: out.text || '' }];
  const seen = new Map();
  const segs = chunks
    .map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 2, text: cleanRepeats((c.text || '').trim()) }))
    .filter((c) => c.text && !/^[\[(♪].*[\])♪]$/.test(c.text))
    // the same line coming back again and again is a loop, not speech
    .filter((c) => {
      const n = (seen.get(c.text) || 0) + 1;
      seen.set(c.text, n);
      return n <= 2;
    });
  segs.language = lang || null;
  return segs;
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
