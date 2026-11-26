// "Remove area" for the Artvas video editor: hides burned-in captions, logos, date stamps and
// other text or graphics in a box of the video. An eraser is an effect layer on the timeline
// ({ kind: 'erase', rect: {x, y, w, h} in 0–1 video coordinates, mode, feather, amount, color }).
// Modes:
//  - fill: fills the box from the pixels around it (push-pull pyramid fill at low resolution,
//    smoothed, with texture and grain matched to the surroundings, feathered into the picture)
//  - blur, pixelate, color: classic cover-ups
// Everything is recomputed from the current frame, so it follows the video and works the same in
// preview and export.
import { scratch } from './vfx.js';

export const ERASE_MODES = [
  ['fill', 'Fill'],
  ['blur', 'Blur'],
  ['pixelate', 'Pixelate'],
  ['color', 'Color'],
];
export const eraseModeName = (m) => ERASE_MODES.find(([id]) => id === m)?.[1] || 'Fill';

/** Quick areas (normalised to the video frame). */
export const ERASE_PRESETS = [
  ['bottom', 'Bottom captions', { x: 0.04, y: 0.79, w: 0.92, h: 0.15 }],
  ['top', 'Top text', { x: 0.04, y: 0.03, w: 0.92, h: 0.14 }],
  ['tl', 'Logo top left', { x: 0.02, y: 0.02, w: 0.22, h: 0.12 }],
  ['tr', 'Logo top right', { x: 0.76, y: 0.02, w: 0.22, h: 0.12 }],
  ['bl', 'Logo bottom left', { x: 0.02, y: 0.86, w: 0.22, h: 0.12 }],
  ['br', 'Logo bottom right', { x: 0.76, y: 0.86, w: 0.22, h: 0.12 }],
];
/** Logo boxes are a similar size on screen whatever the video shape. */
export function presetRect(id, W, H) {
  const p = ERASE_PRESETS.find(([k]) => k === id);
  if (!p) return null;
  const r = { ...p[2] };
  if (['tl', 'tr', 'bl', 'br'].includes(id)) {
    const a = W / H;
    // keep the box roughly square-ish in pixels: 22% of the short side wide, 12% tall in 16:9
    if (a < 1) { r.w = 0.3; r.h = 0.3 * a * 0.55; }
    r.x = id === 'tl' || id === 'bl' ? 0.02 : 1 - 0.02 - r.w;
    r.y = id === 'tl' || id === 'tr' ? 0.02 : 1 - 0.02 - r.h;
  }
  return r;
}

export const normRect = (r) => {
  const x = Math.max(0, Math.min(0.98, r.x));
  const y = Math.max(0, Math.min(0.98, r.y));
  return { x, y, w: Math.max(0.02, Math.min(1 - x, r.w)), h: Math.max(0.02, Math.min(1 - y, r.h)) };
};

// One canvas per name, resized only when needed (the box can change size every frame while dragged).
// Canvases are kept per name and size (preview and export render the same boxes at two sizes
// every frame, so one canvas per name would be re-allocated all the time). A few dozen at most:
// the least recently used ones go first, e.g. while a box is being resized.
const bufs = new Map();
const BUF_MAX = 40;
function buf(name, w, h, opts) {
  const key = `${name}:${w}x${h}`;
  let c = bufs.get(key);
  if (c) bufs.delete(key);
  else {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    if (bufs.size >= BUF_MAX) bufs.delete(bufs.keys().next().value);
  }
  bufs.set(key, c);
  const g = c.getContext('2d', opts);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'low';
  return [c, g];
}

/** Feather width in pixels for a canvas W×H. */
const featherPx = (e, W, H) => (e.feather ?? 0.4) * 0.045 * Math.min(W, H);

/** Pixel box of the eraser on a W×H canvas. */
export function eraseBox(e, W, H) {
  const r = e.rect || { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.max(0, Math.floor(r.x * W));
  const y0 = Math.max(0, Math.floor(r.y * H));
  const x1 = Math.min(W, Math.ceil((r.x + r.w) * W));
  const y1 = Math.min(H, Math.ceil((r.y + r.h) * H));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** How far around the box an eraser reads the picture (fill ring, soft edge, mirrored texture). */
function reach(e, W, H, R) {
  const fpx = featherPx(e, W, H);
  if ((e.mode || 'fill') !== 'fill') return { l: edgePad(fpx), t: edgePad(fpx), r: edgePad(fpx), b: edgePad(fpx) };
  const k = Math.min(1, 96 / Math.max(R.w, R.h));
  const m = Math.ceil(Math.max(edgePad(fpx) + 2, Math.max(R.w, R.h) * 0.08, 4 / k)) + 2;
  // the mirrored texture comes from up to one box size above/below (wide boxes) or beside it
  const wide = R.w >= R.h;
  return wide ? { l: m, r: m, t: Math.max(m, R.h), b: Math.max(m, R.h) } : { l: Math.max(m, R.w), r: Math.max(m, R.w), t: m, b: m };
}

/**
 * Apply erasers to what is drawn on g (W×H canvas pixels). The picture around every box is copied
 * first, in one go: reading the canvas we draw on makes the browser copy all of it on the next
 * write, so reads and writes are kept apart.
 */
export function applyErasers(g, W, H, list, t = 0) {
  const sc = g.canvas.width / W;
  const jobs = [];
  for (const e of list) {
    const R = eraseBox(e, W, H);
    if (R.w < 2 || R.h < 2) continue;
    const m = reach(e, W, H, R);
    const ox = Math.max(0, R.x - m.l);
    const oy = Math.max(0, R.y - m.t);
    const w = Math.min(W, R.x + R.w + m.r) - ox;
    const h = Math.min(H, R.y + R.h + m.b) - oy;
    const [c, cg] = buf(`erase-src${jobs.length}`, w, h);
    cg.imageSmoothingEnabled = false;
    cg.drawImage(g.canvas, ox * sc, oy * sc, w * sc, h * sc, 0, 0, w, h);
    jobs.push({ e, R, src: { c, ox, oy } });
  }
  if (!jobs.length) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  for (const { e, R, src } of jobs) {
    if ((e.mode || 'fill') === 'fill') fillArea(g, src, W, H, R, featherPx(e, W, H), t);
    else coverArea(g, src, W, H, R, e);
  }
  g.restore();
}

// ---------- fill from the surroundings ----------
// Push-pull fill: average the known pixels down a pyramid (the hole has weight 0), then pull the
// coarse estimates back up wherever a finer level had no data. Smooth, stable from frame to frame
// and cheap at ~100 px.
const pyr = [];
function level(i, w, h) {
  let L = pyr[i];
  const n = w * h;
  if (!L || L.cap < n) {
    L = pyr[i] = { cap: n, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), w: new Float32Array(n) };
  }
  L.W = w;
  L.H = h;
  return L;
}
function pushPull(L0) {
  // push: build coarser levels
  const levels = [L0];
  let cur = L0;
  let i = 1;
  while (cur.W > 1 || cur.H > 1) {
    const w = Math.max(1, (cur.W + 1) >> 1);
    const h = Math.max(1, (cur.H + 1) >> 1);
    const N = level(i++, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let dy = 0; dy < 2; dy++) {
          const yy = 2 * y + dy;
          if (yy >= cur.H) break;
          for (let dx = 0; dx < 2; dx++) {
            const xx = 2 * x + dx;
            if (xx >= cur.W) break;
            const k = yy * cur.W + xx;
            const wt = cur.w[k];
            if (wt > 0) {
              sr += cur.r[k] * wt;
              sg += cur.g[k] * wt;
              sb += cur.b[k] * wt;
              sw += wt;
            }
          }
        }
        const k = y * w + x;
        if (sw > 0) {
          N.r[k] = sr / sw;
          N.g[k] = sg / sw;
          N.b[k] = sb / sw;
        } else N.r[k] = N.g[k] = N.b[k] = 0;
        N.w[k] = Math.min(1, sw);
      }
    }
    levels.push(N);
    cur = N;
    if (levels.length > 14) break;
  }
  // pull: fill each level's gaps from the (already complete) coarser level, bilinear
  for (let li = levels.length - 2; li >= 0; li--) {
    const F = levels[li];
    const C = levels[li + 1];
    for (let y = 0; y < F.H; y++) {
      const cy = Math.max(0, Math.min(C.H - 1, (y + 0.5) / 2 - 0.5));
      const y0 = Math.floor(cy);
      const y1 = Math.min(C.H - 1, y0 + 1);
      const fy = cy - y0;
      for (let x = 0; x < F.W; x++) {
        const k = y * F.W + x;
        const wt = F.w[k];
        if (wt >= 1) continue;
        const cx = Math.max(0, Math.min(C.W - 1, (x + 0.5) / 2 - 0.5));
        const x0 = Math.floor(cx);
        const x1 = Math.min(C.W - 1, x0 + 1);
        const fx = cx - x0;
        const a = y0 * C.W + x0, b = y0 * C.W + x1, c = y1 * C.W + x0, d = y1 * C.W + x1;
        const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
        const r = C.r[a] * w00 + C.r[b] * w01 + C.r[c] * w10 + C.r[d] * w11;
        const gg = C.g[a] * w00 + C.g[b] * w01 + C.g[c] * w10 + C.g[d] * w11;
        const bb = C.b[a] * w00 + C.b[b] * w01 + C.b[c] * w10 + C.b[d] * w11;
        F.r[k] = F.r[k] * wt + r * (1 - wt);
        F.g[k] = F.g[k] * wt + gg * (1 - wt);
        F.b[k] = F.b[k] * wt + bb * (1 - wt);
        F.w[k] = 1;
      }
    }
  }
}
const hash = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const [c, g] = scratch('erase-grain', 128, 128);
  const im = g.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    // roughly gaussian grey around 50%
    const v = 128 + ((hash(i % 128, (i / 128) | 0) + hash(i * 0.37, 7.1) + hash(3.3, i * 0.71) - 1.5) * 150);
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = Math.max(0, Math.min(255, v));
    im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  grainTile = c;
  return c;
}

// Detail transfer: the push-pull fill is smooth, so lend it the fine texture of the picture right
// next to the hole, mirrored across the hole's edge (so it continues seamlessly at that edge). Only
// the high frequencies are used (picture minus its blurred self, centred on grey), added with
// 'overlay', so colours and big shapes still come from the fill. Around the hole (the soft edge) the
// layer holds the picture's own detail, which the blurry fill would otherwise wash out there.
function detailLayer(src, B, R) {
  const { W, H, bx, by, bw, bh, q, lw, lh } = B;
  const wide = R.w >= R.h;
  const before = wide ? R.y : R.x;
  const after = wide ? H - (R.y + R.h) : W - (R.x + R.w);
  const useBefore = before >= after;
  const avail = Math.floor(useBefore ? before : after);
  const len = wide ? R.h : R.w;
  if (avail < 6) return null;
  const dl = Math.min(len, avail);
  const [D, dg] = buf('erase-detail', lw, lh);
  dg.clearRect(0, 0, lw, lh);
  // drawn in frame pixels, relative to the patch box (the layer may be smaller, see patchBox)
  dg.setTransform(q, 0, 0, q, 0, 0);
  dg.drawImage(src.c, bx - src.ox, by - src.oy, bw, bh, 0, 0, bw, bh);
  // the donor strip nearest to the hole lands on the hole's edge, mirrored and stretched to fit
  dg.translate(R.x - bx, R.y - by);
  if (wide) {
    const sy = useBefore ? R.y - dl : R.y + R.h;
    dg.translate(0, R.h);
    dg.scale(1, -R.h / dl);
    dg.drawImage(src.c, R.x - src.ox, sy - src.oy, R.w, dl, 0, 0, R.w, dl);
  } else {
    const sx = useBefore ? R.x - dl : R.x + R.w;
    dg.translate(R.w, 0);
    dg.scale(-R.w / dl, 1);
    dg.drawImage(src.c, sx - src.ox, R.y - src.oy, dl, R.h, 0, 0, dl, R.h);
  }
  dg.setTransform(1, 0, 0, 1, 0, 0);
  // high-pass: 0.5·picture + 0.5·(1 − blurred picture)
  // only fine texture (pores, grain, strands): larger shapes would show up as mirrored ghosts
  const f = Math.max(3, Math.min(R.w, R.h) / 10) * q;
  const tw = Math.max(2, Math.round(lw / f));
  const th = Math.max(2, Math.round(lh / f));
  const [lo, lg] = buf('erase-detail-lo', tw, th);
  lg.drawImage(D, 0, 0, lw, lh, 0, 0, tw, th);
  lg.globalCompositeOperation = 'difference';
  lg.fillStyle = '#fff';
  lg.fillRect(0, 0, tw, th);
  lg.globalCompositeOperation = 'source-over';
  dg.globalAlpha = 0.5;
  dg.drawImage(lo, 0, 0, tw, th, 0, 0, lw, lh);
  dg.globalAlpha = 1;
  // 'overlay' with itself doubles the contrast around grey (one overlay pass onto the picture
  // would otherwise give back only about a third of the texture)
  dg.globalCompositeOperation = 'overlay';
  dg.drawImage(D, 0, 0);
  // only where the fill is drawn (same soft edge), fading away from the donor edge
  dg.globalCompositeOperation = 'destination-in';
  dg.drawImage(boxMask(B, R), 0, 0);
  const z0 = (wide ? (useBefore ? R.y : R.y + R.h) - by : (useBefore ? R.x : R.x + R.w) - bx) * q;
  const z1 = (wide ? (useBefore ? R.y + R.h : R.y) - by : (useBefore ? R.x + R.w : R.x) - bx) * q;
  const gr = wide ? dg.createLinearGradient(0, z0, 0, z1) : dg.createLinearGradient(z0, 0, z1, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.3, 'rgba(0,0,0,0.4)');
  gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  dg.fillStyle = gr;
  dg.fillRect(0, 0, lw, lh);
  dg.globalCompositeOperation = 'source-over';
  return D;
}
const edgePad = (fpx) => Math.ceil(fpx * 1.6 + 2);
/**
 * The box a fill patch is built in: the hole plus its soft edge. Big boxes (a caption band in a
 * 1080p export) are built at reduced resolution, at most ~0.16 MP, and scaled up when drawn: the
 * fill and its texture are soft anyway, and this keeps the per-frame cost flat.
 */
function patchBox(W, H, R, fpx) {
  const pad = edgePad(fpx);
  const bx = Math.max(0, R.x - pad);
  const by = Math.max(0, R.y - pad);
  const bw = Math.min(W, R.x + R.w + pad) - bx;
  const bh = Math.min(H, R.y + R.h + pad) - by;
  const q = Math.min(1, Math.sqrt(160000 / (bw * bh)));
  return { W, H, fpx, bx, by, bw, bh, q, lw: Math.max(1, Math.round(bw * q)), lh: Math.max(1, Math.round(bh * q)) };
}
/** Soft-edged mask of the hole at the patch layer's resolution. */
const boxMask = (B, R) => featherMask(B.lw, B.lh, { x: (R.x - B.bx) * B.q, y: (R.y - B.by) * B.q, w: R.w * B.q, h: R.h * B.q }, 0, 0, B.fpx * B.q);

function fillArea(g, src, W, H, R, fpx, t) {
  const B = patchBox(W, H, R, fpx);
  const detail = detailLayer(src, B, R);
  const MAX = 96;
  const k = Math.min(1, MAX / Math.max(R.w, R.h));
  // a ring of known pixels around the hole: at least 4 low-res pixels, and the feather width
  const margin = Math.max(edgePad(fpx) + 2, Math.max(R.w, R.h) * 0.08, 4 / k);
  const sx0 = Math.max(0, Math.floor(R.x - margin));
  const sy0 = Math.max(0, Math.floor(R.y - margin));
  const sx1 = Math.min(W, Math.ceil(R.x + R.w + margin));
  const sy1 = Math.min(H, Math.ceil(R.y + R.h + margin));
  const sw = sx1 - sx0;
  const sh = sy1 - sy0;
  const pw = Math.max(2, Math.ceil(sw * k));
  const ph = Math.max(2, Math.ceil(sh * k));
  const kx = pw / sw;
  const ky = ph / sh;
  // downscale in two steps when shrinking a lot (keeps text from aliasing into the ring)
  const [small, sg] = buf('erase-small', pw, ph, { willReadFrequently: true });
  sg.clearRect(0, 0, pw, ph);
  if (k < 0.34) {
    const mw = pw * 3;
    const mh = ph * 3;
    const [mid, mg] = buf('erase-mid', mw, mh);
    mg.clearRect(0, 0, mw, mh);
    mg.imageSmoothingQuality = 'medium';
    mg.drawImage(src.c, sx0 - src.ox, sy0 - src.oy, sw, sh, 0, 0, mw, mh);
    sg.drawImage(mid, 0, 0, mw, mh, 0, 0, pw, ph);
  } else sg.drawImage(src.c, sx0 - src.ox, sy0 - src.oy, sw, sh, 0, 0, pw, ph);
  const im = sg.getImageData(0, 0, pw, ph);
  const px = im.data;
  // hole in low-res pixels, grown a little so text anti-aliasing at the edge is not reused
  const hx0 = (R.x - sx0) * kx - 0.6;
  const hy0 = (R.y - sy0) * ky - 0.6;
  const hx1 = (R.x + R.w - sx0) * kx + 0.6;
  const hy1 = (R.y + R.h - sy0) * ky + 0.6;
  const L = level(0, pw, ph);
  const inHole = (x, y) => x + 0.5 > hx0 && x + 0.5 < hx1 && y + 0.5 > hy0 && y + 0.5 < hy1;
  let known = 0;
  for (let y = 0, i = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++, i++) {
      const hole = inHole(x, y);
      L.r[i] = px[i * 4];
      L.g[i] = px[i * 4 + 1];
      L.b[i] = px[i * 4 + 2];
      L.w[i] = hole ? 0 : 1;
      if (!hole) known++;
    }
  }
  if (!known) return;
  // texture of the surroundings: how much each known pixel differs from its neighbours
  let dsum = 0, dn = 0;
  for (let y = 1; y < ph - 1; y++) {
    for (let x = 1; x < pw - 1; x++) {
      const i = y * pw + x;
      if (!L.w[i] || !L.w[i - 1] || !L.w[i + 1] || !L.w[i - pw] || !L.w[i + pw]) continue;
      const lum = (j) => L.r[j] * 0.3 + L.g[j] * 0.59 + L.b[j] * 0.11;
      const d = lum(i) - (lum(i - 1) + lum(i + 1) + lum(i - pw) + lum(i + pw)) / 4;
      dsum += d * d;
      dn++;
    }
  }
  const tex = dn ? Math.min(28, Math.sqrt(dsum / dn)) : 4;
  pushPull(L);
  // relax the inside a little (Laplace smoothing) to hide the pyramid's blockiness
  const hxa = Math.max(0, Math.floor(hx0)), hxb = Math.min(pw - 1, Math.ceil(hx1));
  const hya = Math.max(0, Math.floor(hy0)), hyb = Math.min(ph - 1, Math.ceil(hy1));
  for (let it = 0; it < 6; it++) {
    for (let y = hya; y <= hyb; y++) {
      for (let x = hxa; x <= hxb; x++) {
        if (!inHole(x, y)) continue;
        const i = y * pw + x;
        const l = x > 0 ? i - 1 : i, r = x < pw - 1 ? i + 1 : i, u = y > 0 ? i - pw : i, d = y < ph - 1 ? i + pw : i;
        L.r[i] = (L.r[l] + L.r[r] + L.r[u] + L.r[d]) * 0.25;
        L.g[i] = (L.g[l] + L.g[r] + L.g[u] + L.g[d]) * 0.25;
        L.b[i] = (L.b[l] + L.b[r] + L.b[u] + L.b[d]) * 0.25;
      }
    }
  }
  // write back: filled colour inside (plus texture that stays put on the scene, so it does not boil
  // from frame to frame); outside the hole the (blurry) picture itself, which only shows in the
  // narrow soft edge
  const amp = tex * (detail ? 0.25 : 0.75);
  for (let y = 0, i = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++, i++) {
      const n = inHole(x, y) ? (hash(x + sx0 * kx, y + sy0 * ky) + hash(y * 1.7 + 3.1, x * 0.9) - 1) * 2 * amp : 0;
      px[i * 4] = L.r[i] + n;
      px[i * 4 + 1] = L.g[i] + n;
      px[i * 4 + 2] = L.b[i] + n;
      px[i * 4 + 3] = 255;
    }
  }
  sg.putImageData(im, 0, 0);
  // Build the finished patch off-screen (drawing on the big frame canvas is the slow part), then
  // copy it onto the frame once: the picture, the upscaled fill with its soft edge, the texture.
  const { bx, by, bw, bh, q, lw, lh } = B;
  const [fill, fg] = buf('erase-fill', lw, lh);
  fg.clearRect(0, 0, lw, lh);
  fg.setTransform(q, 0, 0, q, 0, 0);
  fg.drawImage(small, 0, 0, pw, ph, sx0 - bx, sy0 - by, pw / kx, ph / ky);
  fg.setTransform(1, 0, 0, 1, 0, 0);
  fg.globalCompositeOperation = 'destination-in';
  fg.drawImage(boxMask(B, R), 0, 0);
  const [lay, lg] = buf('erase-layer', lw, lh);
  lg.drawImage(src.c, bx - src.ox, by - src.oy, bw, bh, 0, 0, lw, lh);
  lg.drawImage(fill, 0, 0);
  if (detail) {
    lg.globalCompositeOperation = 'overlay';
    lg.drawImage(detail, 0, 0);
    lg.globalCompositeOperation = 'source-over';
  }
  // fine film grain on top, so the patch is not smoother than the video around it
  lg.save();
  lg.setTransform(q, 0, 0, q, 0, 0);
  lg.beginPath();
  lg.rect(R.x - bx, R.y - by, R.w, R.h);
  lg.clip();
  lg.globalAlpha = Math.min(detail ? 0.1 : 0.22, 0.04 + tex / 90);
  lg.globalCompositeOperation = 'overlay';
  const pat = lg.createPattern(grain(), 'repeat');
  const s = Math.max(1, Math.round(Math.min(W, H) / 700));
  const ox = Math.floor(hash(Math.floor(t * 24), 1.3) * 128) * s - bx;
  const oy = Math.floor(hash(2.7, Math.floor(t * 24)) * 128) * s - by;
  pat.setTransform(new DOMMatrix([s, 0, 0, s, ox, oy]));
  lg.fillStyle = pat;
  lg.fillRect(R.x - bx, R.y - by, R.w, R.h);
  lg.restore();
  if (q < 1) {
    // a scaled-down layer would soften the picture around the hole: keep only the patch part
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(boxMask(B, R), 0, 0);
    lg.globalCompositeOperation = 'source-over';
  }
  g.drawImage(lay, 0, 0, lw, lh, bx, by, bw, bh);
}

// ---------- blur / pixelate / colour, with a feathered edge ----------
// Soft-edged box masks, kept by geometry (making one needs a blur filter, which is slow)
const masks = new Map();
function featherMask(bw, bh, R, bx, by, fpx) {
  const key = `${bw}x${bh}|${R.x - bx},${R.y - by},${R.w},${R.h}|${fpx.toFixed(1)}`;
  let c = masks.get(key);
  if (c) {
    masks.delete(key);
    masks.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.width = bw;
  c.height = bh;
  if (masks.size >= 24) masks.delete(masks.keys().next().value);
  masks.set(key, c);
  const mg = c.getContext('2d');
  mg.clearRect(0, 0, bw, bh);
  mg.fillStyle = '#fff';
  if (fpx >= 1) {
    const grow = fpx * 0.6;
    mg.filter = `blur(${(fpx * 0.35).toFixed(2)}px)`;
    mg.fillRect(R.x - bx - grow, R.y - by - grow, R.w + grow * 2, R.h + grow * 2);
    mg.filter = 'none';
  } else mg.fillRect(R.x - bx, R.y - by, R.w, R.h);
  return c;
}
function coverArea(g, src, W, H, R, e) {
  const fpx = featherPx(e, W, H);
  const pad = Math.ceil(fpx * 1.5);
  const bx = Math.max(0, R.x - pad);
  const by = Math.max(0, R.y - pad);
  const bw = Math.min(W, R.x + R.w + pad) - bx;
  const bh = Math.min(H, R.y + R.h + pad) - by;
  if (bw < 2 || bh < 2) return;
  const [lay, lg] = buf('erase-layer', bw, bh);
  lg.clearRect(0, 0, bw, bh);
  const amt = e.amount ?? 1;
  const mode = e.mode;
  if (mode === 'color') {
    lg.fillStyle = e.color || '#000000';
    lg.fillRect(0, 0, bw, bh);
  } else if (mode === 'pixelate') {
    const block = Math.max(4, Math.round(Math.min(R.w, R.h) * 0.18 * amt));
    const tw = Math.max(1, Math.ceil(bw / block));
    const th = Math.max(1, Math.ceil(bh / block));
    const [tiny, tg] = buf('erase-tiny', tw, th);
    tg.drawImage(src.c, bx - src.ox, by - src.oy, bw, bh, 0, 0, tw, th);
    lg.imageSmoothingEnabled = false;
    lg.drawImage(tiny, 0, 0, tw, th, 0, 0, tw * block, th * block);
    lg.imageSmoothingEnabled = true;
  } else {
    // blur: shrink, then grow back with a soft blur; strength 1 ≈ text becomes unreadable
    const r = Math.max(3, Math.min(R.w, R.h) * 0.25 * amt);
    const f = Math.max(1, r / 3);
    const tw = Math.max(2, Math.round(bw / f));
    const th = Math.max(2, Math.round(bh / f));
    const [tiny, tg] = buf('erase-tiny', tw, th);
    tg.drawImage(src.c, bx - src.ox, by - src.oy, bw, bh, 0, 0, tw, th);
    const [t2, t2g] = buf('erase-tiny2', tw, th);
    t2g.clearRect(0, 0, tw, th);
    t2g.drawImage(tiny, 0, 0);
    // blurred copy on top of the sharp one, so the edges never go see-through
    t2g.filter = 'blur(2px)';
    t2g.drawImage(tiny, 0, 0);
    t2g.filter = 'none';
    lg.drawImage(t2, 0, 0, tw, th, 0, 0, bw, bh);
  }
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(featherMask(bw, bh, R, bx, by, fpx), 0, 0);
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(lay, 0, 0, bw, bh, bx, by, bw, bh);
}

// ---------- on-preview box (never drawn in export) ----------
/** Dashed box with corner handles for the selected eraser. Returns the hit areas in canvas px. */
export function drawEraseGuide(g, W, H, e, active) {
  const r = e.rect;
  const x = r.x * W, y = r.y * H, w = r.w * W, h = r.h * H;
  const hr = Math.max(7, W / 110);
  g.save();
  g.lineWidth = Math.max(2, W / 450);
  g.setLineDash([8, 6]);
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.strokeRect(x, y, w, h);
  g.lineDashOffset = 7;
  g.strokeStyle = active ? '#a78bfa' : 'rgba(167,139,250,.6)';
  g.strokeRect(x, y, w, h);
  g.setLineDash([]);
  if (!active) {
    g.fillStyle = 'rgba(124,58,237,.18)';
    g.fillRect(x, y, w, h);
  }
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#7c3aed';
  for (const [cx, cy] of corners) {
    g.beginPath();
    g.arc(cx, cy, hr, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
  return { x, y, w, h, r: hr * 2, corners };
}

/** Eraser icon (an eraser over a dashed box). */
export const eraseIcon = (size = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M3 15v4M9 21H5" stroke-dasharray="2 3"/><path d="m11.5 21 9-9-4.5-4.5-9 9 4.5 4.5zM9.25 18.75l4.5-4.5M14 21h7"/></svg>`;
