// Background removal.
// 1) AI remover, fully in the browser via transformers.js (loaded from a CDN on first use):
//    - with a GPU (WebGPU): BiRefNet_lite (MIT) — best edges, ~115 MB, cached after first use
//    - without a GPU, or if that fails: ormbg (Apache-2.0), a light CPU-friendly model, ~44 MB
// 2) Color remover: removes pixels close to a chosen color (works offline, great for logos/flat backgrounds).

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';
const LIGHT_ID = 'onnx-community/ormbg-ONNX';
let lightPipe;

let tfPromise;
let working = null; // { model, processor, opt } that has run successfully
const failed = new Set();

function loadTF() {
  if (!tfPromise) {
    tfPromise = import(/* @vite-ignore */ TRANSFORMERS_URL)
      .then((tf) => {
        tf.env.allowLocalModels = false;
        return tf;
      })
      .catch((e) => {
        tfPromise = null;
        throw e;
      });
  }
  return tfPromise;
}

async function candidates() {
  const hasGPU = !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null));
  const list = hasGPU ? [{ device: 'webgpu', dtype: 'fp16' }, { device: 'webgpu', dtype: 'fp32' }] : [];
  return list.filter((o) => !failed.has(o.device + o.dtype));
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read image'));
    i.src = src;
  });
}

async function runModel(tf, model, processor, image) {
  const { pixel_values } = await processor(image);
  const out = await model({ input_image: pixel_values });
  const tensor = out.output_image ?? Object.values(out)[0];
  return tf.RawImage.fromTensor(tensor[0].sigmoid().mul(255).to('uint8'));
}

/** Returns a PNG data URL of the image with its background removed. */
export async function removeBackgroundAI(src, onProgress) {
  onProgress?.('Loading AI model…');
  const tf = await loadTF();
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const image = await tf.RawImage.fromURL(cv.toDataURL('image/png'));
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.file?.endsWith('.onnx')) onProgress?.(`Downloading AI model… ${Math.round(p.progress)}%`);
  };
  let mask;
  let lastErr;
  // Try the fastest setup first; if this browser can't run it, fall back to the next one.
  const tries = working ? [working] : await candidates();
  for (const t of tries) {
    try {
      const model = t.model || (await tf.AutoModel.from_pretrained(MODEL_ID, { ...t, progress_callback }));
      const processor = t.processor || (await tf.AutoProcessor.from_pretrained(MODEL_ID));
      onProgress?.('Removing background…');
      mask = await runModel(tf, model, processor, image);
      working = { ...t, model, processor };
      break;
    } catch (e) {
      lastErr = e;
      console.warn('Background removal failed with', t.device, t.dtype, e);
      failed.add(t.device + t.dtype);
      if (working === t) working = null;
    }
  }
  if (!mask) {
    // Light CPU model
    try {
      if (!lightPipe) {
        lightPipe = tf.pipeline('background-removal', LIGHT_ID, { device: 'wasm', dtype: 'uint8', progress_callback }).catch((e) => {
          lightPipe = null;
          throw e;
        });
      }
      const pipe = await lightPipe;
      onProgress?.('Removing background…');
      const out = await pipe(image);
      const rgba = Array.isArray(out) ? out[0] : out;
      // the pipeline returns the cut-out image; take its alpha channel as the mask
      mask = rgba;
    } catch (e) {
      console.warn('Light background removal failed', e);
      throw new Error(typeof e === 'number' || !e?.message ? (typeof lastErr === 'number' || !lastErr?.message ? 'this device ran out of memory — try a smaller image' : lastErr.message) : e.message);
    }
    const sized = await mask.resize(cv.width, cv.height);
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    const m = sized.data;
    const ch = sized.channels || 4;
    for (let i = 0; i < data.data.length / 4; i++) data.data[i * 4 + 3] = m[i * ch + (ch - 1)];
    ctx.putImageData(data, 0, 0);
    return cv.toDataURL('image/png');
  }
  const sized = await mask.resize(cv.width, cv.height);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const m = sized.data;
  const ch = sized.channels || 1;
  for (let i = 0; i < data.data.length / 4; i++) data.data[i * 4 + 3] = m[i * ch];
  ctx.putImageData(data, 0, 0);
  return cv.toDataURL('image/png');
}

/** Remove pixels similar to `color` (hex). tolerance 0-100. If color is null, uses the top-left pixel. */
export async function removeColor(src, color, tolerance = 20) {
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height);
  const p = d.data;
  let r0, g0, b0;
  if (color) {
    r0 = parseInt(color.slice(1, 3), 16);
    g0 = parseInt(color.slice(3, 5), 16);
    b0 = parseInt(color.slice(5, 7), 16);
  } else [r0, g0, b0] = [p[0], p[1], p[2]];
  const max = (tolerance / 100) * 441;
  const soft = max * 0.25;
  for (let i = 0; i < p.length; i += 4) {
    const dist = Math.hypot(p[i] - r0, p[i + 1] - g0, p[i + 2] - b0);
    if (dist <= max) p[i + 3] = 0;
    else if (dist <= max + soft) p[i + 3] = Math.min(p[i + 3], Math.round(((dist - max) / soft) * 255));
  }
  ctx.putImageData(d, 0, 0);
  return cv.toDataURL('image/png');
}
