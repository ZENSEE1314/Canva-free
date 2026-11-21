// Video stabilization. Frames are read while a hidden <video> plays (every frame, up to 30 a
// second; 12 a second by seeking where that is not possible),
// each frame is shrunk to 160 px wide grayscale, and the motion between neighbouring frames is
// found by block matching on a 3×3 grid of blocks (translation + a small rotation fitted to the
// block shifts). The summed camera path is smoothed with a Gaussian; the difference between the
// smooth path and the real one is the correction applied (with a slight zoom) when drawing.

import { loadVideo, seekTo, playCapture } from './video-frames.js';

export const STAB_LEVELS = [
  ['low', 'Low', { sigma: 0.25, zoom: 1.05 }],
  ['medium', 'Medium', { sigma: 0.6, zoom: 1.1 }],
  ['high', 'High', { sigma: 1.4, zoom: 1.15 }],
];
const SAMPLE_FPS = 12; // when frames have to be found by seeking
const PLAY_FPS = 30; // when frames are read while playing
const AW = 160; // analysis width
const MAX_SECONDS = 180;

/** Sum of absolute differences of block (bx,by,bw,bh) in a against b shifted by (dx,dy). */
function sad(a, b, w, bx, by, bw, bh, dx, dy, step) {
  let s = 0;
  for (let y = by; y < by + bh; y += step) {
    const ra = y * w;
    const rb = (y + dy) * w + dx;
    for (let x = bx; x < bx + bw; x += step) s += Math.abs(a[ra + x] - b[rb + x]);
  }
  return s;
}
/** Best shift of one block from frame a to frame b, with sub-pixel refinement. */
function matchBlock(a, b, w, h, bx, by, bw, bh, R) {
  // coarse (every 2nd shift, every 2nd pixel), then fine around the best
  let best = [0, 0];
  let bs = Infinity;
  for (let dy = -R; dy <= R; dy += 2)
    for (let dx = -R; dx <= R; dx += 2) {
      const s = sad(a, b, w, bx, by, bw, bh, dx, dy, 2);
      if (s < bs) {
        bs = s;
        best = [dx, dy];
      }
    }
  let [cx, cy] = best;
  bs = Infinity;
  const cost = {};
  for (let dy = cy - 2; dy <= cy + 2; dy++)
    for (let dx = cx - 2; dx <= cx + 2; dx++) {
      if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
      const s = sad(a, b, w, bx, by, bw, bh, dx, dy, 1);
      cost[`${dx},${dy}`] = s;
      if (s < bs) {
        bs = s;
        best = [dx, dy];
      }
    }
  [cx, cy] = best;
  const sub = (m, c, p) => {
    if (m == null || p == null) return 0;
    const den = m - 2 * c + p;
    return den > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (m - p)) / den)) : 0;
  };
  const c0 = cost[`${cx},${cy}`];
  const fx = sub(cost[`${cx - 1},${cy}`], c0, cost[`${cx + 1},${cy}`]);
  const fy = sub(cost[`${cx},${cy - 1}`], c0, cost[`${cx},${cy + 1}`]);
  // contrast of the block: flat blocks give unreliable matches
  let mn = 255;
  let mx = 0;
  for (let y = by; y < by + bh; y += 3) for (let x = bx; x < bx + bw; x += 3) {
    const v = a[y * w + x];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return { dx: cx + fx, dy: cy + fy, ok: mx - mn > 18, err: bs / ((bw * bh) || 1) };
}

/**
 * Motion of content from frame a to frame b: { dx, dy } in analysis pixels and rot in radians
 * (positive = content turned clockwise).
 */
export function frameMotion(a, b, w, h) {
  const R = Math.round(w * 0.08);
  const gx = 3;
  const gy = 3;
  const bw = Math.floor((w - 2 * R) / gx) - 4;
  const bh = Math.floor((h - 2 * R) / gy) - 4;
  const pts = [];
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const bx = R + 2 + i * (bw + 4);
      const by = R + 2 + j * (bh + 4);
      const m = matchBlock(a, b, w, h, bx, by, bw, bh, R);
      // block centre relative to the frame centre
      if (m.ok) pts.push({ x: bx + bw / 2 - w / 2, y: by + bh / 2 - h / 2, ...m });
    }
  if (!pts.length) return { dx: 0, dy: 0, rot: 0 };
  const med = (arr) => {
    const s = [...arr].sort((p, q) => p - q);
    return s[Math.floor(s.length / 2)];
  };
  const tx = med(pts.map((p) => p.dx));
  const ty = med(pts.map((p) => p.dy));
  // rotation: least squares on the residual shifts, ignoring outliers
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const rx = p.dx - tx;
    const ry = p.dy - ty;
    if (Math.hypot(rx, ry) > R * 0.6) continue;
    num += p.x * ry - p.y * rx;
    den += p.x * p.x + p.y * p.y;
  }
  const rot = den > 0 && pts.length >= 4 ? Math.max(-0.08, Math.min(0.08, num / den)) : 0;
  return { dx: tx, dy: ty, rot };
}

function gaussSmooth(arr, sigma) {
  if (sigma <= 0) return arr.slice();
  const r = Math.ceil(sigma * 3);
  const k = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp((-i * i) / (2 * sigma * sigma)));
  const n = arr.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let ws = 0;
    for (let j = -r; j <= r; j++) {
      // mirror at the ends so the path is not pulled toward zero
      let q = i + j;
      if (q < 0) q = -q;
      if (q >= n) q = 2 * n - 2 - q;
      q = Math.max(0, Math.min(n - 1, q));
      s += arr[q] * k[j + r];
      ws += k[j + r];
    }
    out[i] = s / ws;
  }
  return out;
}

/**
 * Analyse [from, to] of a video blob. Returns the raw camera path:
 * { t0, fps, px: [], py: [], pr: [] } with px/py as fractions of the frame width/height.
 */
export async function analyseMotion(blob, from, to, { onProgress = () => {} } = {}) {
  if (to - from > MAX_SECONDS) throw new Error(`too long:${MAX_SECONDS}`);
  const url = URL.createObjectURL(blob);
  try {
    const v = await loadVideo(url);
    const w = AW;
    const h = Math.max(48, Math.round((AW * (v.videoHeight || 90)) / (v.videoWidth || 160)));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      g.drawImage(v, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const gray = new Uint8Array(w * h);
      for (let k = 0, o = 0; k < gray.length; k++, o += 4) gray[k] = (d[o] * 77 + d[o + 1] * 150 + d[o + 2] * 29) >> 8;
      return gray;
    };
    const len = to - from;
    // 1) frames while playing (exact frame times from the video)
    const shots = [];
    let next = from - 0.02;
    onProgress(0, 'Reading frames…');
    const ok = await playCapture(v, Math.max(0, from - 0.05), to, (t) => {
      if (t < next || t > to + 0.05) return;
      shots.push({ t, gray: grab() });
      next = t + 1 / PLAY_FPS - 0.004;
      if (shots.length % 15 === 0) onProgress(Math.min(0.5, ((t - from) / len) * 0.5), `Reading frames… ${Math.round(((t - from) / len) * 100)}%`);
    }, { rate: 2 });
    // 2) seeking, where playing did not work or left gaps
    const gaps = !ok || shots.length < 2 || shots[0].t > from + 0.2 || shots[shots.length - 1].t < to - 0.2;
    if (gaps) {
      shots.length = 0;
      const n = Math.max(2, Math.round(len * SAMPLE_FPS) + 1);
      for (let i = 0; i < n; i++) {
        const t = Math.min(to - 0.01, from + (i * len) / (n - 1));
        await seekTo(v, t);
        shots.push({ t, gray: grab() });
        if (i % 4 === 0) onProgress((i / n) * 0.5, `Reading frames… ${Math.round((i / n) * 100)}%`);
      }
    }
    // 3) motion between neighbouring frames -> camera path at the frame times
    const ts = [shots[0].t];
    const px = [0];
    const py = [0];
    const pr = [0];
    for (let i = 1; i < shots.length; i++) {
      const m = frameMotion(shots[i - 1].gray, shots[i].gray, w, h);
      ts.push(shots[i].t);
      px.push(px[i - 1] + m.dx / w);
      py.push(py[i - 1] + m.dy / h);
      pr.push(pr[i - 1] + m.rot);
      if (i % 20 === 0) {
        onProgress(0.5 + (i / shots.length) * 0.5, `Analysing motion… ${Math.round((i / shots.length) * 100)}%`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    // 4) resample onto an even grid (smaller for long clips)
    const fps = gaps ? SAMPLE_FPS : len > 60 ? 15 : PLAY_FPS;
    const t0 = ts[0];
    const n = Math.max(2, Math.round((ts[ts.length - 1] - t0) * fps) + 1);
    const out = { t0, fps, px: [], py: [], pr: [] };
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = t0 + k / fps;
      while (j < ts.length - 2 && ts[j + 1] < t) j++;
      const f = Math.max(0, Math.min(1, (t - ts[j]) / Math.max(1e-6, ts[j + 1] - ts[j])));
      out.px.push(px[j] + (px[j + 1] - px[j]) * f);
      out.py.push(py[j] + (py[j + 1] - py[j]) * f);
      out.pr.push(pr[j] + (pr[j + 1] - pr[j]) * f);
    }
    out.method = gaps ? 'seek' : 'play';
    out.frames = shots.length;
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Corrections for a strength level from a raw path: what to add to each sample. */
export function corrections(path, level) {
  const cfg = (STAB_LEVELS.find(([id]) => id === level) || STAB_LEVELS[1])[2];
  const sigma = cfg.sigma * path.fps;
  const sx = gaussSmooth(path.px, sigma);
  const sy = gaussSmooth(path.py, sigma);
  const sr = gaussSmooth(path.pr, sigma);
  // limit the correction to what the zoom can hide
  const lim = (cfg.zoom - 1) / 2;
  const r4 = (x) => +x.toFixed(4);
  return {
    zoom: cfg.zoom,
    dx: path.px.map((p, i) => r4(Math.max(-lim, Math.min(lim, sx[i] - p)))),
    dy: path.py.map((p, i) => r4(Math.max(-lim, Math.min(lim, sy[i] - p)))),
    dr: path.pr.map((p, i) => r4(Math.max(-0.06, Math.min(0.06, sr[i] - p)))),
  };
}

/** Correction at source time t: { dx, dy (fractions), rot, zoom } or null. */
export function stabAt(st, t) {
  if (!st?.dx?.length) return null;
  const x = (t - st.t0) * st.fps;
  const n = st.dx.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(x)));
  const j = Math.min(n - 1, i + 1);
  const k = Math.max(0, Math.min(1, x - i));
  const lerp = (arr) => arr[i] + (arr[j] - arr[i]) * k;
  return { dx: lerp(st.dx), dy: lerp(st.dy), rot: lerp(st.dr), zoom: st.zoom };
}
