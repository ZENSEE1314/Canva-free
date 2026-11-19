// Element library: graphic packs (loaded on demand), icons, charts, tables, photo grids, frames, gradients.
import { Group, Rect, Textbox, Path, Circle, Line, loadSVGFromString, util } from 'fabric';
import { createShape, createPhotoPlaceholder, makeGradient, createGlow } from './elements.js';

export const PACK_CATS = [
  ['objects', 'Objects'],
  ['food', 'Food & drink'],
  ['nature', 'Animals & nature'],
  ['travel', 'Travel & places'],
  ['activities', 'Activities'],
  ['symbols', 'Symbols'],
  ['smileys', 'Faces'],
  ['people', 'Hands & gestures'],
];

const packCache = new Map();
/** kind: '3d' | 'flat'; returns [{n, d}|{n, s}] */
export function loadPack(kind, cat) {
  const key = `${kind}-${cat}`;
  if (!packCache.has(key)) {
    packCache.set(
      key,
      fetch(`elements/${key}.json`)
        .then((r) => {
          if (!r.ok) throw new Error('missing pack');
          return r.json();
        })
        .catch((e) => {
          packCache.delete(key);
          throw e;
        })
    );
  }
  return packCache.get(key);
}

export const flatSrc = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

// ---------------- Icons (Lucide) ----------------
let iconNodes;
export async function loadIcons() {
  if (!iconNodes) iconNodes = fetch('elements/icons.json').then((r) => r.json());
  return iconNodes;
}
export const POPULAR_ICONS = [
  'heart', 'star', 'check', 'x', 'arrow-right', 'arrow-up-right', 'phone', 'mail', 'map-pin', 'globe', 'calendar', 'clock',
  'camera', 'music', 'shopping-bag', 'shopping-cart', 'gift', 'tag', 'sparkles', 'zap', 'sun', 'moon', 'cloud', 'leaf',
  'coffee', 'utensils', 'home', 'user', 'users', 'message-circle', 'thumbs-up', 'award', 'trophy', 'rocket', 'lightbulb',
  'instagram', 'youtube', 'facebook', 'twitter', 'linkedin', 'wifi', 'play', 'pause', 'download', 'search', 'settings',
  'smile', 'flame', 'crown', 'diamond', 'briefcase', 'graduation-cap', 'book-open', 'pen-tool', 'palette', 'scissors',
];
export function iconSVG(nodes, color = '#111827', width = 2) {
  const inner = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}
export async function createIcon(name, nodes, size, color) {
  const { objects, options } = await loadSVGFromString(iconSVG(nodes, color));
  const g = util.groupSVGElements(objects.filter(Boolean), options);
  g.scaleToWidth(size);
  g.set({ name: `Icon: ${name}`, kind: 'icon' });
  return g;
}

// ---------------- Charts ----------------
export const CHART_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#a855f7'];
export const CHART_PRESETS = [
  { type: 'bar', label: 'Bar chart', values: [12, 19, 8, 15, 22], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { type: 'hbar', label: 'Horizontal bars', values: [82, 64, 45, 30], labels: ['Design', 'Code', 'Marketing', 'Sales'] },
  { type: 'line', label: 'Line chart', values: [5, 9, 7, 14, 12, 18], labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
  { type: 'donut', label: 'Donut chart', values: [45, 25, 20, 10], labels: ['Social', 'Search', 'Email', 'Other'] },
  { type: 'pie', label: 'Pie chart', values: [50, 30, 20], labels: ['Yes', 'No', 'Maybe'] },
  { type: 'progress', label: 'Progress ring', values: [72], labels: ['Complete'] },
];

function arcPath(cx, cy, r0, r1, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r, a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  if (r0 <= 0) return `M${cx} ${cy} L${p(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M${p(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

/** Build a chart group. spec: {type, values, labels, color, text} ; S = width in px */
export function buildChart(spec, S) {
  const { type } = spec;
  const values = spec.values.map((v) => +v || 0);
  const labels = spec.labels || [];
  const text = spec.text || '#374151';
  const colors = spec.color ? [spec.color] : CHART_COLORS;
  const font = { fontFamily: 'Inter', fill: text };
  const parts = [];
  const max = Math.max(1, ...values);
  if (type === 'bar') {
    const H = S * 0.65;
    const n = values.length;
    const gap = (S / n) * 0.28;
    const bw = S / n - gap;
    parts.push(new Line([0, H, S, H], { stroke: '#d1d5db', strokeWidth: S * 0.004 }));
    values.forEach((v, i) => {
      const h = (v / max) * H * 0.85;
      const x = i * (S / n) + gap / 2;
      parts.push(new Rect({ left: x, top: H - h, width: bw, height: h, fill: colors[i % colors.length], rx: bw * 0.12, ry: bw * 0.12 }));
      parts.push(new Textbox(String(spec.values[i]), { ...font, left: x, top: H - h - S * 0.06, width: bw, fontSize: S * 0.045, textAlign: 'center', fontWeight: '700' }));
      parts.push(new Textbox(labels[i] || '', { ...font, left: x - gap / 2, top: H + S * 0.02, width: bw + gap, fontSize: S * 0.04, textAlign: 'center' }));
    });
  } else if (type === 'hbar') {
    const n = values.length;
    const rowH = S * 0.13;
    const lw = S * 0.28;
    values.forEach((v, i) => {
      const y = i * rowH;
      const w = (v / max) * (S - lw - S * 0.12);
      parts.push(new Textbox(labels[i] || '', { ...font, left: 0, top: y + rowH * 0.2, width: lw - S * 0.03, fontSize: S * 0.042, textAlign: 'right' }));
      parts.push(new Rect({ left: lw, top: y + rowH * 0.15, width: S - lw - S * 0.12, height: rowH * 0.6, fill: '#f1f5f9', rx: rowH * 0.3, ry: rowH * 0.3 }));
      parts.push(new Rect({ left: lw, top: y + rowH * 0.15, width: Math.max(rowH * 0.6, w), height: rowH * 0.6, fill: colors[i % colors.length], rx: rowH * 0.3, ry: rowH * 0.3 }));
      parts.push(new Textbox(String(spec.values[i]), { ...font, left: S - S * 0.11, top: y + rowH * 0.2, width: S * 0.11, fontSize: S * 0.042, fontWeight: '700' }));
    });
    void n;
  } else if (type === 'line') {
    const H = S * 0.6;
    const n = values.length;
    const step = S / Math.max(1, n - 1);
    const pts = values.map((v, i) => [i * step, H - (v / max) * H * 0.85]);
    const c = colors[0];
    parts.push(new Line([0, H, S, H], { stroke: '#d1d5db', strokeWidth: S * 0.004 }));
    const area = `M${pts[0][0]} ${H} ` + pts.map((p) => `L${p[0]} ${p[1]}`).join(' ') + ` L${pts[n - 1][0]} ${H} Z`;
    parts.push(new Path(area, { fill: c, opacity: 0.12 }));
    parts.push(new Path('M' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L'), { fill: '', stroke: c, strokeWidth: S * 0.012, strokeLineJoin: 'round', strokeLineCap: 'round' }));
    pts.forEach(([x, y], i) => {
      parts.push(new Circle({ left: x, top: y, radius: S * 0.016, fill: '#ffffff', stroke: c, strokeWidth: S * 0.008, originX: 'center', originY: 'center' }));
      parts.push(new Textbox(labels[i] || '', { ...font, left: x - step / 2, top: H + S * 0.02, width: step, fontSize: S * 0.038, textAlign: 'center' }));
    });
  } else if (type === 'donut' || type === 'pie') {
    const R = S * 0.32;
    const cx = R;
    const cy = R;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let a = -Math.PI / 2;
    values.forEach((v, i) => {
      const a1 = a + (v / total) * Math.PI * 2;
      parts.push(new Path(arcPath(cx, cy, type === 'donut' ? R * 0.58 : 0, R, a, a1 - 0.0001), { fill: CHART_COLORS[i % CHART_COLORS.length], stroke: '#ffffff', strokeWidth: S * 0.004 }));
      a = a1;
    });
    if (type === 'donut') parts.push(new Textbox(`${Math.round(total)}`, { ...font, left: cx - R * 0.5, top: cy - S * 0.045, width: R, fontSize: S * 0.08, fontWeight: '800', textAlign: 'center' }));
    values.forEach((v, i) => {
      const y = i * S * 0.08 + S * 0.05;
      parts.push(new Rect({ left: R * 2 + S * 0.06, top: y, width: S * 0.04, height: S * 0.04, rx: S * 0.01, ry: S * 0.01, fill: CHART_COLORS[i % CHART_COLORS.length] }));
      parts.push(new Textbox(`${labels[i] || ''}  ${Math.round((v / total) * 100)}%`, { ...font, left: R * 2 + S * 0.12, top: y - S * 0.002, width: S - R * 2 - S * 0.12, fontSize: S * 0.04 }));
    });
  } else if (type === 'progress') {
    const R = S * 0.4;
    const pct = Math.max(0, Math.min(100, values[0] || 0));
    parts.push(new Path(arcPath(R, R, R * 0.8, R, -Math.PI / 2, Math.PI * 1.5 - 0.0001), { fill: '#e5e7eb' }));
    if (pct > 0) parts.push(new Path(arcPath(R, R, R * 0.8, R, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2 - 0.0001), { fill: colors[0] }));
    parts.push(new Textbox(`${pct}%`, { ...font, left: R * 0.3, top: R - S * 0.08, width: R * 1.4, fontSize: S * 0.13, fontWeight: '800', textAlign: 'center' }));
    parts.push(new Textbox(labels[0] || '', { ...font, left: R * 0.3, top: R + S * 0.07, width: R * 1.4, fontSize: S * 0.045, textAlign: 'center' }));
  }
  const g = new Group(parts, { name: `Chart (${type})` });
  g.chart = { type, values: spec.values, labels, color: spec.color || '', text };
  return g;
}

// ---------------- Tables ----------------
export const TABLE_PRESETS = [
  { label: 'Simple table', color: '#7c3aed', rows: [['Plan', 'Price', 'Users'], ['Basic', '$9', '1'], ['Pro', '$19', '5'], ['Team', '$49', '20']] },
  { label: 'Schedule', color: '#0ea5e9', rows: [['Time', 'Session'], ['9:00', 'Welcome'], ['10:30', 'Workshop'], ['12:00', 'Lunch'], ['14:00', 'Panel talk']] },
  { label: 'Comparison', color: '#10b981', rows: [['Feature', 'Us', 'Them'], ['Free plan', '✓', '✗'], ['Templates', '60+', '10'], ['Support', '24/7', 'Email']] },
];
export function buildTable(spec, S) {
  const rows = spec.rows;
  const cols = Math.max(...rows.map((r) => r.length));
  const cw = S / cols;
  const rh = S * 0.11;
  const fs = Math.min(rh * 0.38, cw * 0.18);
  const parts = [];
  rows.forEach((r, ri) => {
    for (let ci = 0; ci < cols; ci++) {
      const head = ri === 0;
      parts.push(new Rect({ left: ci * cw, top: ri * rh, width: cw, height: rh, fill: head ? spec.color : ri % 2 ? '#ffffff' : '#f8fafc', stroke: '#e2e8f0', strokeWidth: Math.max(1, S * 0.002) }));
      parts.push(new Textbox(String(r[ci] ?? ''), { left: ci * cw + cw * 0.08, top: ri * rh + (rh - fs * 1.2) / 2, width: cw * 0.84, fontSize: fs, fontFamily: 'Inter', fontWeight: head ? '700' : 'normal', fill: head ? '#ffffff' : '#1f2937' }));
    }
  });
  const g = new Group(parts, { name: 'Table' });
  g.table = { rows, color: spec.color };
  return g;
}

// ---------------- Photo grids (collages) ----------------
// Each cell: [x, y, w, h] as fractions of the page.
export const GRIDS = [
  { label: '2 columns', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { label: '2 rows', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { label: '3 columns', cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  { label: '2 × 2', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { label: '1 + 2', cells: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
  { label: '2 + 1', cells: [[0, 0, 0.5, 0.55], [0.5, 0, 0.5, 0.55], [0, 0.55, 1, 0.45]] },
  { label: '3 × 3', cells: [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [c / 3, r / 3, 1 / 3, 1 / 3])) },
  { label: 'Feature + 3', cells: [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]] },
];
export function buildGrid(grid, W, H, gap) {
  return grid.cells.map(([x, y, w, h]) => {
    const ph = createPhotoPlaceholder(w * W - gap * 1.5, h * H - gap * 1.5, { rx: gap * 0.6 });
    ph.set({ left: x * W + (w * W) / 2, top: y * H + (h * H) / 2, originX: 'center', originY: 'center' });
    return ph;
  });
}
export function gridPreview(grid) {
  return `<svg viewBox="0 0 40 40" width="44" height="44">${grid.cells
    .map(([x, y, w, h]) => `<rect x="${x * 40 + 1}" y="${y * 40 + 1}" width="${w * 40 - 2}" height="${h * 40 - 2}" rx="2" fill="currentColor" opacity=".75"/>`)
    .join('')}</svg>`;
}

// ---------------- Frames (photo placeholders in shapes) ----------------
export const FRAMES = ['rounded', 'circle', 'arch', 'blob', 'heart', 'star', 'hexagon', 'diamond', 'polaroid', 'phone'];
export function buildFrame(kind, size) {
  if (kind === 'rounded') return createPhotoPlaceholder(size, size * 1.2, { rx: size * 0.08 });
  if (kind === 'polaroid') {
    // A white card with a photo slot: added as two separate objects (card + placeholder)
    const card = new Rect({ width: size, height: size * 1.2, fill: '#ffffff', shadow: null, name: 'Polaroid card', originX: 'center', originY: 'center' });
    const ph = createPhotoPlaceholder(size * 0.88, size * 0.88, {});
    ph.set({ originX: 'center', originY: 'center', top: -size * 0.08 });
    return [card, ph];
  }
  if (kind === 'phone') {
    const body = new Rect({ width: size * 0.56, height: size * 1.12, rx: size * 0.08, ry: size * 0.08, fill: '#111827', name: 'Phone', originX: 'center', originY: 'center' });
    const ph = createPhotoPlaceholder(size * 0.5, size * 1.04, { rx: size * 0.05 });
    ph.set({ originX: 'center', originY: 'center' });
    return [body, ph];
  }
  const shape = createShape(kind, size, '#cbd5e1');
  shape.set({
    fill: '#cbd5e1',
    stroke: 'rgba(255,255,255,0.7)',
    strokeWidth: Math.max(2, size * 0.008),
    strokeDashArray: [size * 0.03, size * 0.02],
    name: 'Photo frame',
    placeholder: true,
    frameShape: kind,
  });
  return shape;
}

// ---------------- Gradients ----------------
export const GRADIENT_ELEMENTS = [
  { kind: 'glow', colors: ['#a855f7'] },
  { kind: 'glow', colors: ['#ec4899'] },
  { kind: 'glow', colors: ['#06b6d4'] },
  { kind: 'glow', colors: ['#f59e0b'] },
  { kind: 'card', colors: ['#ff7a45', '#7c3aed'] },
  { kind: 'card', colors: ['#06b6d4', '#3b82f6'] },
  { kind: 'card', colors: ['#f43f5e', '#f59e0b'] },
  { kind: 'card', colors: ['#22c55e', '#14b8a6'] },
  { kind: 'circle', colors: ['#fde68a', '#fca5a5'] },
  { kind: 'circle', colors: ['#c4b5fd', '#a5f3fc'] },
];
export function buildGradientElement(g, size) {
  if (g.kind === 'glow') return createGlow(size / 2, g.colors[0]);
  if (g.kind === 'circle') return new Circle({ radius: size / 2, fill: makeGradient(g.colors, size, size, 135), name: 'Gradient circle' });
  return new Rect({ width: size, height: size * 0.7, rx: size * 0.06, ry: size * 0.06, fill: makeGradient(g.colors, size, size * 0.7, 135), name: 'Gradient card' });
}
export function gradientPreview(g) {
  const bg = g.kind === 'glow' ? `radial-gradient(circle, ${g.colors[0]} 0%, ${g.colors[0]}88 40%, transparent 70%)` : `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`;
  const r = g.kind === 'card' ? '8px' : '50%';
  return `<span class="grad-el" style="background:${bg};border-radius:${r}"></span>`;
}
