// Background removal.
// 1) AI remover: BiRefNet_lite (MIT license) running fully in the browser via transformers.js.
//    The library is loaded from a CDN only when first used; the model (~115 MB) is downloaded once
//    and then cached by the browser.
// 2) Color remover: removes pixels close to a chosen color (works offline, great for logos/flat backgrounds).

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';

let modelPromise;

async function loadModel(onProgress) {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import(/* @vite-ignore */ TRANSFORMERS_URL);
      tf.env.allowLocalModels = false;
      const progress_callback = (p) => {
        if (p.status === 'progress' && p.file?.endsWith('.onnx')) onProgress?.(`Downloading AI model… ${Math.round(p.progress)}%`);
      };
      const hasGPU = !!navigator.gpu && !!(await navigator.gpu.requestAdapter().catch(() => null));
      let model;
      const tries = hasGPU
        ? [{ device: 'webgpu', dtype: 'fp16' }, { device: 'wasm', dtype: 'fp16' }, { device: 'wasm', dtype: 'fp32' }]
        : [{ device: 'wasm', dtype: 'fp16' }, { device: 'wasm', dtype: 'fp32' }];
      let lastErr;
      for (const opt of tries) {
        try {
          model = await tf.AutoModel.from_pretrained(MODEL_ID, { ...opt, progress_callback });
          break;
        } catch (e) {
          lastErr = e;
          console.warn('Model load failed with', opt, e);
        }
      }
      if (!model) throw lastErr;
      const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
      return { tf, model, processor };
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
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

/** Returns a PNG data URL of the image with its background removed. */
export async function removeBackgroundAI(src, onProgress) {
  onProgress?.('Loading AI model…');
  const { tf, model, processor } = await loadModel(onProgress);
  onProgress?.('Removing background…');
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const image = await tf.RawImage.fromURL(cv.toDataURL('image/png'));
  const { pixel_values } = await processor(image);
  const out = await model({ input_image: pixel_values });
  const tensor = out.output_image ?? Object.values(out)[0];
  const mask = await tf.RawImage.fromTensor(tensor[0].sigmoid().mul(255).to('uint8')).resize(cv.width, cv.height);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const m = mask.data;
  const ch = mask.channels || 1;
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
