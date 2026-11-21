// Speed curves: a clip's speed can change over its length. A curve is a list of points
// [x, speed] where x (0–1) is the position in the clip's source range and speed runs from 0.1× to
// 10× (interpolated on a log scale). Everything that needs "which source second shows at this
// timeline second" asks srcTime(); the clip's length on the timeline follows the curve.

export const SPEED_MIN = 0.1;
export const SPEED_MAX = 10;

export const SPEED_CURVES = [
  { id: 'montage', name: 'Montage', pts: [[0, 1], [0.2, 2.6], [0.4, 0.6], [0.6, 2.6], [0.8, 0.6], [1, 1.4]] },
  { id: 'hero', name: 'Hero', pts: [[0, 1.6], [0.3, 2.2], [0.45, 0.25], [0.6, 0.25], [0.75, 2.2], [1, 1.6]] },
  { id: 'bullet', name: 'Bullet', pts: [[0, 4], [0.32, 4], [0.45, 0.15], [0.6, 0.15], [0.72, 4], [1, 4]] },
  { id: 'jump', name: 'Jump cut', pts: [[0, 1], [0.3, 1], [0.38, 7], [0.62, 7], [0.7, 1], [1, 1]] },
  { id: 'flashin', name: 'Flash in', pts: [[0, 8], [0.25, 5], [0.45, 1.2], [0.7, 1], [1, 1]] },
  { id: 'flashout', name: 'Flash out', pts: [[0, 1], [0.3, 1], [0.55, 1.2], [0.75, 5], [1, 8]] },
];
export const curveName = (id) => (id === 'custom' ? 'Custom' : SPEED_CURVES.find((x) => x.id === id)?.name || 'Curve');

const clampV = (v) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, v));
export const hasCurve = (c) => c?.type === 'video' && Array.isArray(c.curve?.pts) && c.curve.pts.length >= 2;

/** Speed at source position u (0–1) of a curve. */
export function speedAt(pts, u) {
  if (u <= pts[0][0]) return clampV(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x1, v1] = pts[i];
    if (u <= x1) {
      const [x0, v0] = pts[i - 1];
      const k = x1 > x0 ? (u - x0) / (x1 - x0) : 1;
      return clampV(Math.exp(Math.log(clampV(v0)) * (1 - k) + Math.log(clampV(v1)) * k));
    }
  }
  return clampV(pts[pts.length - 1][1]);
}

const K = 240;
const tables = new Map();
/** Cumulative timeline time over K steps of the source range, for 1 s of source. */
function unitTable(pts) {
  const key = JSON.stringify(pts);
  let t = tables.get(key);
  if (t) return t;
  t = new Float64Array(K + 1);
  for (let k = 0; k < K; k++) {
    // midpoint rule on 1 / speed
    t[k + 1] = t[k] + 1 / K / speedAt(pts, (k + 0.5) / K);
  }
  if (tables.size > 200) tables.clear();
  tables.set(key, t);
  return t;
}
/** Timeline seconds per source second, averaged over the curve (1 / average speed). */
export const curveFactor = (pts) => unitTable(pts)[K];
export const avgSpeed = (c) => (hasCurve(c) ? 1 / curveFactor(c.curve.pts) : c.speed || 1);

/** Length of a video clip on the timeline. */
export function videoLen(c) {
  const L = Math.max(0, c.out - c.in);
  return hasCurve(c) ? L * curveFactor(c.curve.pts) : L / (c.speed || 1);
}
/** Source position u (0–1) shown at timeline second `local` of the clip. */
function uAt(c, local) {
  const L = Math.max(1e-6, c.out - c.in);
  const t = unitTable(c.curve.pts);
  const x = Math.max(0, local / L);
  if (x >= t[K]) return 1;
  let lo = 0;
  let hi = K;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (t[m] <= x) lo = m;
    else hi = m;
  }
  return (lo + (x - t[lo]) / Math.max(1e-12, t[lo + 1] - t[lo])) / K;
}
/** The source second shown at timeline second `local` of the clip (local 0 = clip start). */
export function srcTime(c, local) {
  if (!hasCurve(c)) return c.in + local * (c.speed || 1);
  return c.in + uAt(c, local) * (c.out - c.in);
}
/** Playback rate at timeline second `local`. */
export function srcRate(c, local) {
  if (!hasCurve(c)) return c.speed || 1;
  return speedAt(c.curve.pts, uAt(c, local));
}
/** Inverse of srcTime: the timeline second (into the clip) that shows source second `s`. */
export function localOf(c, s) {
  if (!hasCurve(c)) return (s - c.in) / (c.speed || 1);
  const L = Math.max(1e-6, c.out - c.in);
  const u = Math.max(0, Math.min(1, (s - c.in) / L)) * K;
  const t = unitTable(c.curve.pts);
  const k = Math.min(K - 1, Math.floor(u));
  return (t[k] + (t[k + 1] - t[k]) * (u - k)) * L;
}
/** The part [u0, u1] of a curve, rescaled to 0–1 (used when a curved clip is split). */
export function subCurve(pts, u0, u1) {
  const span = Math.max(1e-6, u1 - u0);
  const out = [[0, speedAt(pts, u0)]];
  for (const [x, v] of pts) if (x > u0 + 1e-6 && x < u1 - 1e-6) out.push([(x - u0) / span, v]);
  out.push([1, speedAt(pts, u1)]);
  return out.map(([x, v]) => [+x.toFixed(4), +v.toFixed(3)]);
}
/** A fresh custom curve: 5 points at the clip's current speed. */
export const flatCurve = (v = 1) => [0, 0.25, 0.5, 0.75, 1].map((x) => [x, clampV(v)]);

// ---------- curve editor (SVG, mouse + touch) ----------
const logPos = (v) => Math.log(clampV(v) / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN); // 0..1
const posLog = (p) => SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, Math.max(0, Math.min(1, p)));

/** SVG path for a curve inside a w×h box (used for the preset thumbnails too). */
export function curvePath(pts, w, h, pad = 4) {
  let d = '';
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const x = pad + u * (w - 2 * pad);
    const y = pad + (1 - logPos(speedAt(pts, u))) * (h - 2 * pad);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
export function curveThumb(pts, w = 64, h = 30) {
  const mid = 4 + (1 - logPos(1)) * (h - 8);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="4" x2="${w - 4}" y1="${mid}" y2="${mid}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 2"/><path d="${curvePath(pts, w, h)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/**
 * Mount a draggable curve editor in `host`. pts is edited in place; onInput() while dragging,
 * onChange() when a drag ends. Points keep their order; the first and last stay at the ends.
 */
export function mountCurveEditor(host, pts, { onInput = () => {}, onChange = () => {} } = {}) {
  const W = 300;
  const Hh = 150;
  const P = 14;
  host.innerHTML = `<svg class="sc-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Speed curve editor"></svg>`;
  const svg = host.firstElementChild;
  const px = (x) => P + x * (W - 2 * P);
  const py = (v) => P + (1 - logPos(v)) * (Hh - 2 * P);
  const draw = () => {
    const grid = [0.1, 0.5, 1, 2, 5, 10]
      .map((v) => `<line x1="${P}" x2="${W - P}" y1="${py(v)}" y2="${py(v)}" class="sc-grid${v === 1 ? ' one' : ''}"/><text x="2" y="${py(v) + 3}" class="sc-lbl">${v}×</text>`)
      .join('');
    let d = '';
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      d += `${i ? 'L' : 'M'}${px(u).toFixed(1)} ${py(speedAt(pts, u)).toFixed(1)}`;
    }
    svg.innerHTML = `${grid}<path d="${d}" class="sc-line"/>${pts.map(([x, v], i) => `<circle cx="${px(x)}" cy="${py(v)}" r="7" class="sc-pt" data-i="${i}"/>`).join('')}`;
  };
  draw();
  let drag = null;
  const toLocal = (e) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * Hh];
  };
  svg.addEventListener('pointerdown', (e) => {
    const [mx, my] = toLocal(e);
    let best = -1;
    let bd = 1e9;
    pts.forEach(([x, v], i) => {
      const d = Math.hypot(px(x) - mx, py(v) - my);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0 || bd > 40) return;
    e.preventDefault();
    drag = best;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag == null) return;
    const [mx, my] = toLocal(e);
    const i = drag;
    const v = +posLog(1 - (my - P) / (Hh - 2 * P)).toFixed(2);
    let x = pts[i][0];
    if (i > 0 && i < pts.length - 1) {
      x = (mx - P) / (W - 2 * P);
      x = Math.max(pts[i - 1][0] + 0.03, Math.min(pts[i + 1][0] - 0.03, x));
    }
    pts[i] = [+x.toFixed(3), v];
    draw();
    onInput(pts[i]);
  });
  const end = () => {
    if (drag == null) return;
    drag = null;
    onChange();
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  return { redraw: draw };
}
