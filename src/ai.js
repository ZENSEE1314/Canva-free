// AI image generation via Muapi.ai (https://muapi.ai), using the user's own API key.
// On the Artvas server (e.g. Railway) requests go through a small same-origin relay; otherwise directly to the API.

export const AI_MODELS = [
  { id: 'free-flux', name: 'Free AI — no key needed', free: true, fmodel: 'flux', ar: null },
  { id: 'free-turbo', name: 'Free AI Turbo — fastest', free: true, fmodel: 'turbo', ar: null },
  { id: 'flux-schnell-image', name: 'Flux Schnell — fast & cheap', ar: null },
  { id: 'nano-banana', name: 'Nano Banana', ar: ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', ar: ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '5:4', '4:5', '21:9'] },
  { id: 'flux-2-pro', name: 'Flux 2 Pro', ar: ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2'] },
  { id: 'bytedance-seedream-v4', name: 'Seedream 4', ar: ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2', '21:9'] },
  { id: 'google-imagen4-fast', name: 'Imagen 4 Fast', ar: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
  { id: 'google-imagen4-ultra', name: 'Imagen 4 Ultra', ar: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
  { id: 'ideogram-v3-t2i', name: 'Ideogram 3 — great with text', ar: ['1:1', '3:4', '4:3', '9:16', '16:9'] },
  { id: 'midjourney-v7-text-to-image', name: 'Midjourney 7', ar: ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2'] },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5', ar: ['1:1', '2:3', '3:2'] },
  { id: 'flux-dev-image', name: 'Flux Dev', ar: null },
];

export const VIDEO_MODELS = [
  { id: 'seedance-lite-t2v', name: 'Seedance Lite — cheapest', ar: ['16:9', '9:16', '1:1', '4:3', '3:4'], durations: [5] },
  { id: 'wan2.5-text-to-video-fast', name: 'Wan 2.5 Fast', ar: ['16:9', '9:16'], durations: [5] },
  { id: 'kling-v2.5-turbo-pro-t2v', name: 'Kling 2.5 Turbo', ar: ['16:9', '9:16', '1:1'], durations: [5] },
  { id: 'pixverse-v5-t2v', name: 'PixVerse 5', ar: ['16:9', '9:16', '1:1', '4:3', '3:4'], durations: [5] },
  { id: 'veo3-fast-text-to-video', name: 'Veo 3 Fast — with sound', ar: ['16:9', '9:16'], durations: [8] },
];

export const AI_STYLES = [
  { id: 'none', label: 'No style', suffix: '' },
  { id: 'photo', label: 'Photo', suffix: ', professional photography, natural light, sharp focus, high detail' },
  { id: 'cinematic', label: 'Cinematic', suffix: ', cinematic film still, dramatic lighting, shallow depth of field, color graded' },
  { id: '3d', label: '3D render', suffix: ', 3D render, soft clay style, glossy materials, studio lighting, pastel background' },
  { id: 'illustration', label: 'Illustration', suffix: ', flat vector illustration, bold shapes, clean lines, vibrant colors' },
  { id: 'anime', label: 'Anime', suffix: ', anime style illustration, vibrant, detailed' },
  { id: 'watercolor', label: 'Watercolor', suffix: ', watercolor painting, soft washes, paper texture' },
  { id: 'product', label: 'Product shot', suffix: ', studio product photography, clean background, soft shadows, commercial' },
  { id: 'neon', label: 'Neon', suffix: ', neon lights, synthwave colors, glowing, night' },
];

const RATIOS = { '1:1': 1, '4:5': 0.8, '5:4': 1.25, '3:4': 0.75, '4:3': 4 / 3, '2:3': 2 / 3, '3:2': 1.5, '9:16': 9 / 16, '16:9': 16 / 9, '21:9': 21 / 9 };
/** Closest supported aspect ratio string for a width/height. */
export function closestRatio(w, h, allowed) {
  const r = w / h;
  const list = allowed || ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];
  return list.filter((k) => RATIOS[k]).reduce((best, k) => (Math.abs(Math.log(RATIOS[k] / r)) < Math.abs(Math.log(RATIOS[best] / r)) ? k : best), list[0]);
}

const KEY = 'artvas-muapi-key';
export function getKey() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}
export function setKey(v) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {}
}

let relay;
async function useRelay() {
  if (relay === undefined) {
    try {
      const r = await fetch('api/muapi/ping');
      relay = r.ok && (r.headers.get('content-type') || '').includes('json');
    } catch {
      relay = false;
    }
  }
  return relay;
}

async function check(r) {
  if (r.ok) return r.json();
  const t = await r.text().catch(() => '');
  if (r.status === 401 || r.status === 403) throw new Error('Your Muapi API key was rejected. Check it in AI settings.');
  if (r.status === 402) throw new Error('Your Muapi account is out of credits.');
  throw new Error(`AI service error ${r.status}${t ? ': ' + t.slice(0, 120) : ''}`);
}

export const isFreeModel = (id) => !!AI_MODELS.find((m) => m.id === id)?.free;

const RATIO_DIMS = (ratio) => {
  const [a, b] = String(ratio || '1:1').split(':').map(Number);
  const r = a / b || 1;
  const long = 1024;
  return r >= 1 ? [long, Math.round(long / r / 8) * 8] : [Math.round((long * r) / 8) * 8, long];
};
let lastFree = 0;
/** Free image generation (Pollinations.ai community service, no key). Returns a blob URL. */
async function generateFree({ model, prompt, aspectRatio, onStatus }) {
  const m = AI_MODELS.find((x) => x.id === model);
  const [w, h] = RATIO_DIMS(aspectRatio);
  for (let attempt = 0; attempt < 6; attempt++) {
    // the free tier allows about one image every 15 seconds
    const wait = Math.max(0, lastFree + 15500 - Date.now());
    if (wait > 0) {
      for (let s = Math.ceil(wait / 1000); s > 0; s--) {
        onStatus?.(`Free AI is queueing… ${s}s`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    lastFree = Date.now();
    onStatus?.('Generating with free AI…');
    const seed = Math.floor(Math.random() * 1e9);
    const viaRelay = await useRelay();
    const fmodel = attempt >= 2 ? 'turbo' : m?.fmodel || 'flux';
    const url = viaRelay
      ? `api/free-image?prompt=${encodeURIComponent(prompt.slice(0, 900))}&w=${w}&h=${h}&seed=${seed}&model=${fmodel}`
      : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=${w}&height=${h}&seed=${seed}&model=${fmodel}&nologo=true`;
    let r;
    try {
      r = await fetch(url, viaRelay ? {} : { referrerPolicy: 'no-referrer' });
    } catch {
      throw new Error("Couldn't reach the free AI service. Free AI images work on your own Artvas site (for example on Railway).");
    }
    if ([402, 403, 429, 502, 503].includes(r.status)) {
      lastFree = Date.now();
      onStatus?.('Free AI is busy — trying again…');
      continue;
    }
    if (!r.ok) throw new Error(`Free AI error ${r.status}. Try again in a moment.`);
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Free AI returned no image. Try again.');
    return URL.createObjectURL(blob);
  }
  throw new Error('The free AI service is busy right now. Try again in a minute.');
}

/** Generate one video clip. Returns a video URL. */
export async function generateVideo({ model, prompt, aspectRatio, duration, onStatus }) {
  return generateImage({ model, prompt, aspectRatio, onStatus, extra: duration ? { duration } : {}, polls: 180 });
}

/** Generate one image. Returns an image URL. */
export async function generateImage({ model, prompt, aspectRatio, onStatus, extra = {}, polls = 90 }) {
  if (isFreeModel(model)) return generateFree({ model, prompt, aspectRatio, onStatus });
  const key = getKey();
  if (!key) throw new Error('Add your Muapi API key first.');
  const viaRelay = await useRelay();
  const body = { prompt, image_url: null, ...extra };
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  const submitUrl = viaRelay ? `api/muapi/generate/${model}` : `https://api.muapi.ai/api/v1/${model}`;
  onStatus?.('Sending…');
  let first;
  try {
    first = await fetch(submitUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach Muapi.ai from this page. AI images work on your own Artvas site (for example on Railway), or check your internet connection.");
  }
  const sub = await check(first);
  const id = sub.request_id || sub.id;
  let result = sub;
  if (id) {
    for (let i = 0; i < polls; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      onStatus?.(`Generating… ${i * 2}s`);
      const url = viaRelay ? `api/muapi/result/${id}` : `https://api.muapi.ai/api/v1/predictions/${id}/result`;
      let r;
      try {
        r = await fetch(url, { headers: { 'x-api-key': key } });
      } catch {
        continue;
      }
      if (r.status >= 500) continue;
      const data = await check(r);
      const st = String(data.status || '').toLowerCase();
      if (['completed', 'succeeded', 'success'].includes(st)) {
        result = data;
        break;
      }
      if (['failed', 'error'].includes(st)) throw new Error('Generation failed: ' + (data.error || 'unknown error'));
      if (i === polls - 1) throw new Error('Generation timed out. Try again or pick a faster model.');
    }
  }
  const out = result.outputs?.[0] || result.url || result.output?.url;
  if (!out) throw new Error('The AI service returned no result.');
  return out;
}

/** Turn a remote image URL into a data URL the canvas can export. */
export async function toDataURL(url) {
  const tryFetch = async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error('fetch failed');
    const blob = await r.blob();
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  };
  try {
    return await tryFetch(url);
  } catch {
    if (await useRelay()) return tryFetch(`api/image-proxy?url=${encodeURIComponent(url)}`);
    return url;
  }
}

/** Download a generated media file (video or image) as a Blob, via the relay when needed. */
export async function fetchMediaBlob(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.blob();
  } catch {}
  if (await useRelay()) {
    const r = await fetch(`api/image-proxy?url=${encodeURIComponent(url)}`);
    if (r.ok) return r.blob();
  }
  throw new Error('Could not download the generated file.');
}
