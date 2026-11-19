import { StaticCanvas } from 'fabric';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const ANIMATIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'rise', label: 'Rise' },
  { id: 'drop', label: 'Drop' },
  { id: 'slideLeft', label: 'Slide in ←' },
  { id: 'slideRight', label: 'Slide in →' },
  { id: 'zoom', label: 'Zoom in' },
  { id: 'pop', label: 'Pop' },
  { id: 'spin', label: 'Spin' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'blink', label: 'Blink' },
  { id: 'pulse', label: 'Pulse (loop)' },
  { id: 'wiggle', label: 'Wiggle (loop)' },
];

export const PAGE_PRESETS = [
  { id: 'fade', label: 'Gentle fade', type: 'fade', stagger: 0.15 },
  { id: 'rise', label: 'Rise up', type: 'rise', stagger: 0.2 },
  { id: 'pop', label: 'Pop in', type: 'pop', stagger: 0.15 },
  { id: 'slide', label: 'Slide in', type: 'slideLeft', stagger: 0.15 },
  { id: 'zoom', label: 'Zoom', type: 'zoom', stagger: 0.12 },
  { id: 'bounce', label: 'Bounce', type: 'bounce', stagger: 0.18 },
  { id: 'drop', label: 'Drop', type: 'drop', stagger: 0.15 },
  { id: 'none', label: 'Remove all', type: 'none', stagger: 0 },
];

const clamp = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutBounce = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

export const hasAnimation = (json) => !!json?.objects?.some((o) => o.anim && o.anim.type && o.anim.type !== 'none');

/** Create an offscreen canvas for a page, ready to render animation frames. */
export async function createAnimCanvas(json, W, H, scale = 1) {
  const el = document.createElement('canvas');
  const w = Math.max(2, Math.round((W * scale) / 2) * 2);
  const h = Math.max(2, Math.round((H * scale) / 2) * 2);
  const sc = new StaticCanvas(el, { width: w, height: h, enableRetinaScaling: false, renderOnAddRemove: false });
  if (json) await sc.loadFromJSON(json);
  if (!sc.backgroundColor) sc.backgroundColor = '#ffffff';
  sc.setZoom(scale);
  sc.getObjects().forEach((o) => {
    const c = o.getCenterPoint();
    o.set({ originX: 'center', originY: 'center' });
    o.setPositionByOrigin(c, 'center', 'center');
    o.objectCaching = false;
    o._base = {
      left: o.left, top: o.top, opacity: o.opacity ?? 1, scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle || 0,
      text: o.text,
    };
  });
  sc._W = W;
  sc._H = H;
  return sc;
}

/** Render the frame at time t (seconds). */
export function renderFrame(sc, t) {
  const W = sc._W;
  const H = sc._H;
  for (const o of sc.getObjects()) {
    const a = o.anim;
    const b = o._base;
    if (!a || !a.type || a.type === 'none') continue;
    const dur = Math.max(0.05, a.duration ?? 0.8);
    const raw = clamp((t - (a.delay ?? 0)) / dur);
    const p = easeOut(raw);
    o.set({ left: b.left, top: b.top, opacity: b.opacity, scaleX: b.scaleX, scaleY: b.scaleY, angle: b.angle });
    switch (a.type) {
      case 'fade':
        o.opacity = b.opacity * p;
        break;
      case 'rise':
        o.top = b.top + (1 - p) * H * 0.12;
        o.opacity = b.opacity * p;
        break;
      case 'drop':
        o.top = b.top - (1 - p) * H * 0.12;
        o.opacity = b.opacity * p;
        break;
      case 'slideLeft':
        o.left = b.left + (1 - p) * W * 0.25;
        o.opacity = b.opacity * p;
        break;
      case 'slideRight':
        o.left = b.left - (1 - p) * W * 0.25;
        o.opacity = b.opacity * p;
        break;
      case 'zoom': {
        const s = 0.4 + 0.6 * p;
        o.scaleX = b.scaleX * s;
        o.scaleY = b.scaleY * s;
        o.opacity = b.opacity * p;
        break;
      }
      case 'pop': {
        const s = raw <= 0 ? 0 : Math.max(0, easeOutBack(raw));
        o.scaleX = b.scaleX * s;
        o.scaleY = b.scaleY * s;
        o.opacity = raw <= 0 ? 0 : b.opacity;
        break;
      }
      case 'spin':
        o.angle = b.angle - (1 - p) * 270;
        o.scaleX = b.scaleX * (0.3 + 0.7 * p);
        o.scaleY = b.scaleY * (0.3 + 0.7 * p);
        o.opacity = b.opacity * p;
        break;
      case 'bounce':
        o.top = b.top - (1 - easeOutBounce(raw)) * H * 0.35;
        o.opacity = raw <= 0 ? 0 : b.opacity;
        break;
      case 'typewriter':
        if (b.text != null) {
          const n = Math.round(b.text.length * raw);
          const txt = b.text.slice(0, n);
          if (o.text !== txt) o.set('text', txt);
        } else o.opacity = b.opacity * p;
        break;
      case 'blink':
        o.opacity = raw <= 0 ? 0 : b.opacity * (Math.floor(Math.max(0, t - (a.delay ?? 0)) * 4) % 2 === 0 || raw >= 1 ? 1 : 0.15);
        break;
      case 'pulse': {
        const s = 1 + 0.06 * Math.sin(Math.max(0, t - (a.delay ?? 0)) * Math.PI * 2 / dur);
        o.scaleX = b.scaleX * s;
        o.scaleY = b.scaleY * s;
        break;
      }
      case 'wiggle':
        o.angle = b.angle + 6 * Math.sin(Math.max(0, t - (a.delay ?? 0)) * Math.PI * 2 / (dur / 2));
        break;
    }
    o.setCoords();
  }
  sc.renderAll();
}

/** Total length of animations on a page (seconds) */
export function animationLength(json) {
  let max = 0;
  for (const o of json?.objects || []) {
    if (!o.anim || o.anim.type === 'none') continue;
    max = Math.max(max, (o.anim.delay ?? 0) + (o.anim.duration ?? 0.8));
  }
  return max;
}

/** Play a page in a <canvas> element (preview). Returns stop(). */
export async function playPreview(container, pages, W, H, maxSize = 720) {
  const scale = Math.min(1, maxSize / Math.max(W, H));
  let stopped = false;
  let current = null;
  const run = async () => {
    while (!stopped) {
      for (const page of pages) {
        if (stopped) break;
        const sc = await createAnimCanvas(page.json, W, H, scale);
        container.innerHTML = '';
        container.appendChild(sc.lowerCanvasEl);
        current = sc;
        const dur = page.duration || 4;
        const start = performance.now();
        await new Promise((resolve) => {
          const tick = () => {
            if (stopped) return resolve();
            const t = (performance.now() - start) / 1000;
            renderFrame(sc, t);
            if (t >= dur) return resolve();
            requestAnimationFrame(tick);
          };
          tick();
        });
        sc.dispose();
      }
    }
  };
  run();
  return () => {
    stopped = true;
    current?.dispose?.();
  };
}

/** Export pages as an animated GIF. Returns a Blob. */
export async function exportGIF(pages, W, H, { maxSize = 600, fps = 15, onProgress } = {}) {
  const scale = Math.min(1, maxSize / Math.max(W, H));
  const gif = GIFEncoder();
  const total = pages.reduce((s, p) => s + Math.ceil((p.duration || 4) * fps), 0);
  let done = 0;
  for (const page of pages) {
    const sc = await createAnimCanvas(page.json, W, H, scale);
    const ctx = sc.lowerCanvasEl.getContext('2d', { willReadFrequently: true });
    const frames = Math.ceil((page.duration || 4) * fps);
    for (let f = 0; f < frames; f++) {
      renderFrame(sc, f / fps);
      const { data, width, height } = ctx.getImageData(0, 0, sc.lowerCanvasEl.width, sc.lowerCanvasEl.height);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, width, height, { palette, delay: Math.round(1000 / fps) });
      done++;
      if (f % 5 === 0) {
        onProgress?.(Math.round((done / total) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    sc.dispose();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export function videoMime() {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
}

/** Record pages as a video in real time. Returns { blob, ext }. */
export async function exportVideo(pages, W, H, { maxSize = 1920, fps = 30, onProgress } = {}) {
  const mime = videoMime();
  if (!mime) throw new Error('Video recording is not supported in this browser');
  const scale = Math.min(1, maxSize / Math.max(W, H));
  // A single visible-sized recording canvas that we copy each frame into.
  const rec = document.createElement('canvas');
  rec.width = Math.max(2, Math.round((W * scale) / 2) * 2);
  rec.height = Math.max(2, Math.round((H * scale) / 2) * 2);
  rec.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.appendChild(rec);
  const rctx = rec.getContext('2d');
  const stream = rec.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (recorder.onstop = r));
  const totalDur = pages.reduce((s, p) => s + (p.duration || 4), 0);
  let elapsed = 0;
  // Prepare all page canvases first to avoid gaps
  const canvases = [];
  for (const page of pages) canvases.push(await createAnimCanvas(page.json, W, H, scale));
  recorder.start(250);
  for (let i = 0; i < pages.length; i++) {
    const sc = canvases[i];
    const dur = pages[i].duration || 4;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        renderFrame(sc, Math.min(t, dur));
        rctx.drawImage(sc.lowerCanvasEl, 0, 0, rec.width, rec.height);
        onProgress?.(Math.min(100, Math.round(((elapsed + t) / totalDur) * 100)));
        if (t >= dur) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
    elapsed += dur;
  }
  recorder.stop();
  await stopped;
  canvases.forEach((c) => c.dispose());
  rec.remove();
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  return { blob, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
