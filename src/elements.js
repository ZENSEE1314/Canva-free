import { Rect, Circle, Triangle, Polygon, Path, Line, Textbox, Gradient, Shadow, Pattern } from 'fabric';

function regularPolygon(sides, r, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push({ x: r + r * Math.cos(a), y: r + r * Math.sin(a) });
  }
  return pts;
}

function starPoints(points, outer, inner) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push({ x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) });
  }
  return pts;
}

const PATHS = {
  heart: 'M50 88 C20 66 4 50 4 30 C4 15 16 4 30 4 C39 4 46 9 50 16 C54 9 61 4 70 4 C84 4 96 15 96 30 C96 50 80 66 50 88 Z',
  arrow: 'M0 35 H60 V10 L100 50 L60 90 V65 H0 Z',
  bubble: 'M10 5 H90 Q98 5 98 13 V60 Q98 68 90 68 H45 L25 90 L28 68 H10 Q2 68 2 60 V13 Q2 5 10 5 Z',
  cloud: 'M25 80 Q5 80 5 62 Q5 46 22 44 Q22 22 44 20 Q60 6 76 22 Q96 22 96 44 Q100 60 88 70 Q84 80 72 80 Z',
  blob: 'M60 4 C82 6 98 24 96 48 C94 72 78 96 52 96 C26 96 4 80 4 54 C4 28 32 2 60 4 Z',
  ring: 'M50 0 A50 50 0 1 1 49.99 0 Z M50 18 A32 32 0 1 0 50.01 18 Z',
};

/** Build a shape object. `size` is the target bounding size in design px. */
export function createShape(id, size, fill = '#7c3aed') {
  const base = { fill, strokeWidth: 0, stroke: '#111827', name: id };
  switch (id) {
    case 'rect':
      return new Rect({ ...base, width: size, height: size });
    case 'rounded':
      return new Rect({ ...base, width: size, height: size, rx: size * 0.15, ry: size * 0.15 });
    case 'circle':
      return new Circle({ ...base, radius: size / 2 });
    case 'triangle':
      return new Triangle({ ...base, width: size, height: size * 0.9 });
    case 'star':
      return new Polygon(starPoints(5, size / 2, size / 4.6), base);
    case 'burst':
      return new Polygon(starPoints(16, size / 2, size / 2.6), base);
    case 'pentagon':
      return new Polygon(regularPolygon(5, size / 2), base);
    case 'hexagon':
      return new Polygon(regularPolygon(6, size / 2, 0), base);
    case 'diamond':
      return new Polygon(regularPolygon(4, size / 2), base);
    case 'line':
    case 'dashed':
      return new Line([0, 0, size * 1.5, 0], {
        stroke: fill === 'transparent' ? '#111827' : fill,
        strokeWidth: Math.max(4, size / 40),
        strokeDashArray: id === 'dashed' ? [size / 12, size / 18] : null,
        strokeLineCap: 'round',
        name: id,
      });
    case 'arrowline': {
      const L = size * 1.5;
      const t = Math.max(4, size / 40);
      const p = new Path(`M0 0 L${L} 0 M${L - size / 6} ${-size / 8} L${L} 0 L${L - size / 6} ${size / 8}`, {
        fill: '',
        stroke: fill,
        strokeWidth: t,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        name: id,
      });
      return p;
    }
    default: {
      const d = PATHS[id];
      if (!d) return new Rect({ ...base, width: size, height: size });
      const p = new Path(d, { ...base, fillRule: 'evenodd' });
      p.scaleToWidth(size);
      return p;
    }
  }
}

export function makeGradient(colors, width, height, angle = 135) {
  const rad = (angle * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) / 2;
  return new Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords: {
      x1: cx - Math.cos(rad) * len,
      y1: cy - Math.sin(rad) * len,
      x2: cx + Math.cos(rad) * len,
      y2: cy + Math.sin(rad) * len,
    },
    colorStops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })),
  });
}

/** Build fabric objects for a template on a W x H canvas. */
export function buildTemplate(tpl, W, H) {
  const m = Math.min(W, H);
  const objects = [];
  for (let it of tpl.items) {
    let o;
    if (it.t === 'text' || it.t === 'emoji') {
      o = new Textbox(it.text, {
        fontFamily: it.font || 'Inter',
        fontSize: it.size * m,
        fontWeight: it.weight || 'normal',
        fontStyle: it.style || 'normal',
        fill: it.fill || '#111827',
        textAlign: it.align || 'center',
        width: (it.w || 0.9) * W,
        lineHeight: it.lh || 1.05,
        charSpacing: it.charSpacing || 0,
        textBackgroundColor: it.bgc || '',
        shadow: it.shadow ? new Shadow({ color: it.shadow, blur: m * 0.02, offsetX: m * 0.006, offsetY: m * 0.008 }) : null,
        stroke: it.stroke || null,
        strokeWidth: it.strokeW ? it.strokeW * m : 0,
        paintFirst: 'stroke',
        originX: 'center',
        originY: 'center',
        angle: it.angle || 0,
        name: it.t === 'emoji' ? 'Sticker' : 'Text',
      });
      if (it.t === 'emoji') o.set({ width: it.size * m * 1.4 });
      if (it.grad) {
        o.initDimensions();
        o.set('fill', new Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: { x1: 0, y1: 0, x2: it.gradDir === 'x' ? o.width : 0, y2: it.gradDir === 'x' ? 0 : o.height },
          colorStops: it.grad.map((c, i) => ({ offset: i / (it.grad.length - 1), color: c })),
        }));
      }
      if (it.glow) o.set('shadow', new Shadow({ color: it.glow, blur: m * 0.04, offsetX: 0, offsetY: 0 }));
    } else if (it.t === 'rect') {
      o = new Rect({
        width: it.w * W,
        height: it.h * H,
        rx: it.rx ? it.rx * m : 0,
        ry: it.rx ? it.rx * m : 0,
        fill: it.fill,
        stroke: it.stroke || null,
        strokeWidth: it.strokeW ? it.strokeW * m : 0,
        originX: 'center',
        originY: 'center',
        name: 'Rectangle',
      });
    } else if (it.t === 'photo') {
      o = createPhotoPlaceholder(it.r ? it.r * 2 * m : it.w * W, it.r ? it.r * 2 * m : it.h * H, {
        rx: it.r ? it.r * m : it.rx ? it.rx * m : 0,
        fill: it.fill,
      });
      o.set({ originX: 'center', originY: 'center' });
    } else if (it.t === 'glow') {
      o = createGlow(it.r * m, it.color);
      o.set({ originX: 'center', originY: 'center' });
    } else if (it.t === 'grain') {
      o = createGrain(W, H, it.amount ?? 0.12);
      o.set({ originX: 'center', originY: 'center' });
      it = { ...it, x: 0.5, y: 0.5 };
    } else if (it.t === 'circle') {
      o = new Circle({ radius: it.r * m, fill: it.fill, originX: 'center', originY: 'center', name: 'Circle', stroke: it.stroke || null, strokeWidth: it.strokeW ? it.strokeW * m : 0 });
    } else if (it.t === 'shape') {
      o = createShape(it.shape, it.s * m, it.fill);
      o.set({ originX: 'center', originY: 'center' });
    }
    if (!o) continue;
    o.set({ left: it.x * W, top: it.y * H });
    if (it.angle && it.t !== 'text' && it.t !== 'emoji') o.set({ angle: it.angle });
    if (it.opacity != null) o.set({ opacity: it.opacity });
    if (it.blend) o.set({ globalCompositeOperation: it.blend });
    if (it.drop && !o.shadow) o.set({ shadow: new Shadow({ color: it.drop, blur: m * 0.04, offsetX: 0, offsetY: m * 0.015 }) });
    o.setCoords();
    objects.push(o);
  }
  return objects;
}

/** A grey box that marks where the user should drop a photo. */
export function createPhotoPlaceholder(w, h, { rx = 0, fill } = {}) {
  return new Rect({
    width: w,
    height: h,
    rx,
    ry: rx,
    fill: fill || '#cbd5e1',
    stroke: 'rgba(255,255,255,0.6)',
    strokeWidth: Math.max(2, Math.min(w, h) * 0.008),
    strokeDashArray: [Math.max(6, Math.min(w, h) * 0.03), Math.max(6, Math.min(w, h) * 0.02)],
    name: 'Photo placeholder',
    placeholder: true,
  });
}

/** Soft blurred color blob (radial gradient fading to transparent) — for aurora / mesh backgrounds. */
export function createGlow(radius, color) {
  return new Circle({
    radius,
    fill: new Gradient({
      type: 'radial',
      gradientUnits: 'pixels',
      coords: { x1: radius, y1: radius, r1: 0, x2: radius, y2: radius, r2: radius },
      colorStops: [
        { offset: 0, color },
        { offset: 0.45, color: withAlpha(color, 0.55) },
        { offset: 1, color: withAlpha(color, 0) },
      ],
    }),
    name: 'Glow',
  });
}

function withAlpha(color, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let grainTile;
function grainCanvas() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const ctx = c.getContext('2d');
  const d = ctx.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  grainTile = c;
  return c;
}

/** Full-page film-grain texture overlay. */
export function createGrain(W, H, amount = 0.12) {
  return new Rect({
    width: W,
    height: H,
    fill: new Pattern({ source: grainCanvas(), repeat: 'repeat' }),
    opacity: amount,
    globalCompositeOperation: 'overlay',
    name: 'Grain texture',
  });
}
