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

// ---------- Online voices (Chinese, Malay, Tamil, Indonesian, English and more) ----------
// Served by the Artvas server (free Microsoft Edge neural voices). Fast: no model download.
const v = (id, name, desc) => ({ id, name, desc });
export const ONLINE_LANGS = [
  { id: 'en', label: 'English', voices: [v('en-US-AvaNeural', 'Ava', 'US · female · friendly'), v('en-US-AndrewNeural', 'Andrew', 'US · male · warm'), v('en-US-EmmaNeural', 'Emma', 'US · female · cheerful'), v('en-US-BrianNeural', 'Brian', 'US · male · casual'), v('en-US-AriaNeural', 'Aria', 'US · female · confident'), v('en-US-GuyNeural', 'Guy', 'US · male · narrator'), v('en-GB-SoniaNeural', 'Sonia', 'UK · female'), v('en-GB-RyanNeural', 'Ryan', 'UK · male'), v('en-AU-NatashaNeural', 'Natasha', 'Australia · female'), v('en-AU-WilliamNeural', 'William', 'Australia · male'), v('en-SG-LunaNeural', 'Luna', 'Singapore · female'), v('en-SG-WayneNeural', 'Wayne', 'Singapore · male'), v('en-IN-NeerjaNeural', 'Neerja', 'India · female'), v('en-IN-PrabhatNeural', 'Prabhat', 'India · male')] },
  { id: 'zh-CN', label: '中文 普通话 · Mandarin', voices: [v('zh-CN-XiaoxiaoNeural', '晓晓 Xiaoxiao', 'female · warm'), v('zh-CN-XiaoyiNeural', '晓伊 Xiaoyi', 'female · lively'), v('zh-CN-YunxiNeural', '云希 Yunxi', 'male · sunny'), v('zh-CN-YunjianNeural', '云健 Yunjian', 'male · energetic'), v('zh-CN-YunyangNeural', '云扬 Yunyang', 'male · news'), v('zh-CN-YunxiaNeural', '云夏 Yunxia', 'boy'), v('zh-CN-liaoning-XiaobeiNeural', '晓北 Xiaobei', 'female · 东北话'), v('zh-CN-shaanxi-XiaoniNeural', '晓妮 Xiaoni', 'female · 陕西话')] },
  { id: 'zh-TW', label: '中文 台灣 · Taiwan Mandarin', voices: [v('zh-TW-HsiaoChenNeural', '曉臻 HsiaoChen', 'female'), v('zh-TW-HsiaoYuNeural', '曉雨 HsiaoYu', 'female'), v('zh-TW-YunJheNeural', '雲哲 YunJhe', 'male')] },
  { id: 'zh-HK', label: '粵語 · Cantonese', voices: [v('zh-HK-HiuGaaiNeural', '曉佳 HiuGaai', 'female'), v('zh-HK-HiuMaanNeural', '曉曼 HiuMaan', 'female'), v('zh-HK-WanLungNeural', '雲龍 WanLung', 'male')] },
  { id: 'ms', label: 'Bahasa Melayu · Malay', voices: [v('ms-MY-YasminNeural', 'Yasmin', 'female'), v('ms-MY-OsmanNeural', 'Osman', 'male')] },
  { id: 'id', label: 'Bahasa Indonesia', voices: [v('id-ID-GadisNeural', 'Gadis', 'female'), v('id-ID-ArdiNeural', 'Ardi', 'male')] },
  { id: 'ta', label: 'தமிழ் · Tamil (Malaysia)', voices: [v('ta-MY-KaniNeural', 'Kani', 'female'), v('ta-MY-SuryaNeural', 'Surya', 'male')] },
  { id: 'th', label: 'ไทย · Thai', voices: [v('th-TH-PremwadeeNeural', 'Premwadee', 'female'), v('th-TH-NiwatNeural', 'Niwat', 'male')] },
  { id: 'vi', label: 'Tiếng Việt · Vietnamese', voices: [v('vi-VN-HoaiMyNeural', 'HoaiMy', 'female'), v('vi-VN-NamMinhNeural', 'NamMinh', 'male')] },
  { id: 'fil', label: 'Filipino', voices: [v('fil-PH-BlessicaNeural', 'Blessica', 'female'), v('fil-PH-AngeloNeural', 'Angelo', 'male')] },
  { id: 'ja', label: '日本語 · Japanese', voices: [v('ja-JP-NanamiNeural', 'Nanami', 'female'), v('ja-JP-KeitaNeural', 'Keita', 'male')] },
  { id: 'ko', label: '한국어 · Korean', voices: [v('ko-KR-SunHiNeural', 'SunHi', 'female'), v('ko-KR-InJoonNeural', 'InJoon', 'male')] },
  { id: 'hi', label: 'हिन्दी · Hindi', voices: [v('hi-IN-SwaraNeural', 'Swara', 'female'), v('hi-IN-MadhurNeural', 'Madhur', 'male')] },
  { id: 'es', label: 'Español · Spanish', voices: [v('es-ES-ElviraNeural', 'Elvira', 'Spain · female'), v('es-ES-AlvaroNeural', 'Alvaro', 'Spain · male'), v('es-MX-DaliaNeural', 'Dalia', 'Mexico · female'), v('es-MX-JorgeNeural', 'Jorge', 'Mexico · male')] },
  { id: 'fr', label: 'Français · French', voices: [v('fr-FR-DeniseNeural', 'Denise', 'female'), v('fr-FR-HenriNeural', 'Henri', 'male')] },
  { id: 'pt', label: 'Português · Portuguese', voices: [v('pt-BR-FranciscaNeural', 'Francisca', 'Brazil · female'), v('pt-BR-AntonioNeural', 'Antonio', 'Brazil · male')] },
  { id: 'ar', label: 'العربية · Arabic', voices: [v('ar-SA-ZariyahNeural', 'Zariyah', 'female'), v('ar-SA-HamedNeural', 'Hamed', 'male')] },
];

/** Speak with an online voice through the Artvas server. Returns { blob, duration, segments }. */
export async function speakOnline(text, { voice, speed = 1, onStatus } = {}) {
  if (!text.trim()) throw new Error('Type something to say first.');
  onStatus?.('Generating voice…');
  let r;
  try {
    r = await fetch('api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice, rate: speed }) });
  } catch {
    throw new Error('Online voices need the Artvas server (your Railway site). Pick an "On this device" English voice here instead.');
  }
  const type = r.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('Online voices need the Artvas server (your Railway site). Pick an "On this device" English voice here instead.');
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'The voice service failed. Try again.');
  const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: data.mime || 'audio/mpeg' });
  // exact duration from the decoded audio
  let duration = 0;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    duration = (await ac.decodeAudioData(bytes.buffer.slice(0))).duration;
    ac.close?.();
  } catch {
    duration = data.sentences?.length ? data.sentences[data.sentences.length - 1].end + 0.3 : text.length * 0.08;
  }
  let segments = (data.sentences || []).filter((x) => x.text);
  if (!segments.length) segments = [{ text, start: 0, end: duration }];
  return { blob, duration, segments };
}
