// AI image generation via Muapi.ai (https://muapi.ai), using the user's own API key.
// On the Artvas server (e.g. Railway) requests go through a small same-origin relay; otherwise directly to the API.

export const AI_MODELS = [
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

/** Generate one image. Returns an image URL. */
export async function generateImage({ model, prompt, aspectRatio, onStatus }) {
  const key = getKey();
  if (!key) throw new Error('Add your Muapi API key first.');
  const viaRelay = await useRelay();
  const body = { prompt, image_url: null };
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
    for (let i = 0; i < 90; i++) {
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
      if (i === 89) throw new Error('Generation timed out. Try again or pick a faster model.');
    }
  }
  const out = result.outputs?.[0] || result.url || result.output?.url;
  if (!out) throw new Error('The AI service returned no image.');
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
