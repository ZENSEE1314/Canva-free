// Effects for the Artvas video editor.
// - Video effects: full-frame looks applied to everything under an effect layer on the timeline.
// - Body effects: find the person in the frame (MediaPipe selfie segmenter, Apache-2.0, runs on
//   the device) and draw outlines, auras, clones, background blur and more around them.
// All effects are drawn on a 2D canvas and depend only on time, so preview and export match.

const TASKS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

export const VIDEO_FX = [
  ['shake', 'Shake', 'Motion'], ['pulse', 'Beat zoom', 'Motion'], ['zoomin', 'Slow zoom', 'Motion'], ['swing', 'Swing', 'Motion'], ['zoomblur', 'Zoom blur', 'Motion'], ['echo', 'Motion trail', 'Motion'],
  ['flash', 'Flash beat', 'Light'], ['strobe', 'Strobe', 'Light'], ['glow', 'Dreamy glow', 'Light'], ['neon', 'Neon bloom', 'Light'], ['leak', 'Light leak', 'Light'], ['flare', 'Lens flare', 'Light'], ['rainbow', 'Rainbow', 'Light'], ['focus', 'Focus in', 'Light'],
  ['vhs', 'VHS', 'Retro'], ['oldfilm', 'Old film', 'Retro'], ['grain', 'Film grain', 'Retro'], ['camcorder', 'REC camera', 'Retro'], ['pixel', 'Pixelate', 'Retro'], ['rgb', 'RGB split', 'Retro'], ['glitch', 'Glitch', 'Retro'], ['invert', 'Negative beat', 'Retro'],
  ['snow', 'Snow', 'Particles'], ['rain', 'Rain', 'Particles'], ['hearts', 'Hearts', 'Particles'], ['confetti', 'Confetti', 'Particles'], ['sparkle', 'Sparkles', 'Particles'], ['bokeh', 'Bokeh', 'Particles'], ['bubbles', 'Bubbles', 'Particles'], ['petals', 'Petals', 'Particles'], ['fireworks', 'Fireworks', 'Particles'],
  ['bars', 'Cinema bars', 'Frame'], ['vignette', 'Vignette', 'Frame'], ['mirror', 'Mirror', 'Frame'], ['kaleido', 'Kaleidoscope', 'Frame'], ['split4', 'Split ×4', 'Frame'], ['split9', 'Split ×9', 'Frame'], ['countdown', 'Countdown 3-2-1', 'Frame'],
].map(([id, name, cat]) => ({ id, name, cat }));

export const BODY_FX = [
  ['outline', 'Neon outline'], ['aura', 'Rainbow aura'], ['fire', 'Fire aura'], ['sparkbody', 'Body sparkles'], ['clone', 'Clones'], ['trail', 'Echo trail'], ['bodyglitch', 'Body glitch'],
  ['silhouette', 'Silhouette flash'], ['bgblur', 'Background blur'], ['colorpop', 'Color pop'], ['spotlight', 'Spotlight'], ['bgneon', 'Neon background'], ['xray', 'X-ray'],
].map(([id, name]) => ({ id, name, cat: 'Body' }));

export const FX_CATS = ['All', 'Motion', 'Light', 'Retro', 'Particles', 'Frame'];
export const fxName = (id) => [...VIDEO_FX, ...BODY_FX].find((f) => f.id === id)?.name || id;
// effects whose colour can be changed
export const COLOR_FX = { outline: '#22d3ee', bgneon: '#e879f9', silhouette: '#ffffff' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
/** Deterministic pseudo-random number in [0, 1) for a seed. */
const hr = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------- scratch canvases ----------
const pool = new Map();
function scratch(name, w, h, opts) {
  const key = `${name}:${w}x${h}`;
  let c = pool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    pool.set(key, c);
  }
  const g = c.getContext('2d', opts);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.imageSmoothingEnabled = true;
  g.shadowBlur = 0;
  return [c, g];
}
/** Copy what is on g so far. */
function snap(g, W, H, name = 'src') {
  const [c, cg] = scratch(name, W, H);
  cg.clearRect(0, 0, W, H);
  cg.drawImage(g.canvas, 0, 0, W, H);
  return c;
}
function redraw(g, W, H, src, { dx = 0, dy = 0, s = 1, r = 0, filter = 'none', alpha = 1, op = 'source-over' } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = op;
  g.filter = filter;
  g.translate(W / 2 + dx, H / 2 + dy);
  g.rotate(r);
  g.scale(s, s);
  g.drawImage(src, -W / 2, -H / 2, W, H);
  g.restore();
}
function rgbSplit(g, W, H, src, off, { only } = {}) {
  const chans = [['#ff0000', -off], ['#00ff00', 0], ['#0000ff', off]];
  const layers = chans.map(([col, dx], i) => {
    const [c, cg] = scratch('ch' + i, W, H);
    cg.clearRect(0, 0, W, H);
    cg.drawImage(src, dx, 0, W, H);
    cg.globalCompositeOperation = 'multiply';
    cg.fillStyle = col;
    cg.fillRect(0, 0, W, H);
    cg.globalCompositeOperation = 'destination-in';
    cg.drawImage(src, dx, 0, W, H);
    return c;
  });
  g.save();
  if (!only) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  }
  g.globalCompositeOperation = 'lighter';
  layers.forEach((c) => g.drawImage(c, 0, 0));
  g.restore();
}
function vignette(g, W, H, k = 0.7) {
  g.save();
  const r = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  r.addColorStop(0, 'rgba(0,0,0,0)');
  r.addColorStop(1, `rgba(0,0,0,${k})`);
  g.fillStyle = r;
  g.fillRect(0, 0, W, H);
  g.restore();
}
let noiseTiles;
function grain(g, W, H, frame, alpha) {
  if (!noiseTiles) {
    noiseTiles = [0, 1, 2, 3].map(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const cg = c.getContext('2d');
      const d = cg.createImageData(160, 160);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = Math.random() * 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        d.data[i + 3] = 255;
      }
      cg.putImageData(d, 0, 0);
      return c;
    });
  }
  const tile = noiseTiles[frame % 4];
  const sz = Math.max(120, Math.round(Math.min(W, H) / 3));
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'overlay';
  for (let y = 0; y < H; y += sz) for (let x = 0; x < W; x += sz) g.drawImage(tile, x, y, sz, sz);
  g.restore();
}
function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
  g.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
}
function starPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
}
function timecode(sec) {
  const f = Math.floor((sec % 1) * 30);
  const s = Math.floor(sec);
  return `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

// motion-trail state per output size
const trails = new Map();

/**
 * Apply a full-frame video effect to what is already drawn on g.
 * o: { local: seconds into the effect, dur, amt: strength 0.2–1.5 }
 */
export function applyVideoFx(g, W, H, id, o) {
  const a = o.amt ?? 1;
  const t = o.local;
  const m = Math.min(W, H);
  const frame = Math.floor(t * 24);
  switch (id) {
    case 'shake':
      redraw(g, W, H, snap(g, W, H), { dx: Math.sin(t * 61) * W * 0.015 * a, dy: Math.cos(t * 47) * H * 0.012 * a, s: 1.06 + 0.02 * a, r: Math.sin(t * 29) * 0.015 * a });
      break;
    case 'pulse': {
      const beat = (t * 2) % 1;
      redraw(g, W, H, snap(g, W, H), { s: 1 + 0.09 * a * Math.pow(1 - beat, 3) });
      break;
    }
    case 'zoomin':
      redraw(g, W, H, snap(g, W, H), { s: 1 + 0.25 * a * clamp(t / Math.max(0.5, o.dur), 0, 1) });
      break;
    case 'swing':
      redraw(g, W, H, snap(g, W, H), { s: 1.12, r: Math.sin(t * 2.5) * 0.05 * a });
      break;
    case 'zoomblur': {
      const src = snap(g, W, H);
      const k = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI));
      for (let i = 1; i <= 5; i++) redraw(g, W, H, src, { s: 1 + i * 0.025 * a * k, alpha: 0.22 });
      break;
    }
    case 'echo': {
      const key = `${W}x${H}`;
      let st = trails.get(key);
      if (!st) {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        st = { c, g: c.getContext('2d'), t: -1 };
        trails.set(key, st);
      }
      const jump = st.t < 0 || t < st.t || t - st.t > 0.25;
      st.g.globalAlpha = jump ? 1 : clamp(0.45 - 0.25 * a, 0.12, 0.5);
      st.g.drawImage(g.canvas, 0, 0, W, H);
      st.t = t;
      g.drawImage(st.c, 0, 0, W, H);
      break;
    }
    case 'flash': {
      const k = Math.max(0, 1 - (t % 0.5) / 0.16);
      if (k) {
        g.save();
        g.globalAlpha = k * 0.8 * Math.min(1, a);
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        g.restore();
      }
      break;
    }
    case 'strobe': {
      const ph = Math.floor(t * 9) % 3;
      if (ph !== 1) {
        g.save();
        g.globalAlpha = 0.5 * Math.min(1, a);
        g.fillStyle = ph === 0 ? '#fff' : '#000';
        g.fillRect(0, 0, W, H);
        g.restore();
      }
      break;
    }
    case 'glow':
      redraw(g, W, H, snap(g, W, H), { filter: `blur(${Math.round(m * 0.02)}px) brightness(1.15)`, op: 'screen', alpha: 0.55 * Math.min(1, a) });
      break;
    case 'neon':
      redraw(g, W, H, snap(g, W, H), { filter: `blur(${Math.round(m * 0.012)}px) saturate(2.2) brightness(1.2)`, op: 'lighter', alpha: 0.45 * Math.min(1.3, a) });
      break;
    case 'leak': {
      g.save();
      g.globalCompositeOperation = 'screen';
      const spots = [[0.2, 0.15, 'rgba(255,140,60,', 0.7], [0.85, 0.8, 'rgba(255,60,140,', 1.1]];
      spots.forEach(([x, y, col, sp], i) => {
        const cx = W * (x + 0.15 * Math.sin(t * sp + i));
        const cy = H * (y + 0.1 * Math.cos(t * sp * 0.8 + i));
        const r = Math.max(W, H) * (0.45 + 0.1 * Math.sin(t * 1.3 + i));
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, `${col}${0.6 * Math.min(1, a)})`);
        gr.addColorStop(1, `${col}0)`);
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      });
      g.restore();
      break;
    }
    case 'flare': {
      const cx = W * (0.25 + 0.1 * Math.sin(t * 0.6));
      const cy = H * 0.22;
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = Math.min(1, a);
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, m * 0.35);
      core.addColorStop(0, 'rgba(255,255,240,0.95)');
      core.addColorStop(0.15, 'rgba(255,200,120,0.5)');
      core.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = core;
      g.fillRect(0, 0, W, H);
      const streak = g.createLinearGradient(0, cy, W, cy);
      streak.addColorStop(0, 'rgba(120,180,255,0)');
      streak.addColorStop(cx / W, 'rgba(200,230,255,0.7)');
      streak.addColorStop(1, 'rgba(120,180,255,0)');
      g.fillStyle = streak;
      g.fillRect(0, cy - m * 0.006, W, m * 0.012);
      [0.35, 0.6, 0.85, 1.2].forEach((k, i) => {
        const x = cx + (W / 2 - cx) * 2 * k;
        const y = cy + (H / 2 - cy) * 2 * k;
        g.beginPath();
        g.arc(x, y, m * (0.02 + 0.025 * (i % 2)), 0, Math.PI * 2);
        g.fillStyle = ['rgba(120,255,200,0.25)', 'rgba(255,160,220,0.2)', 'rgba(140,170,255,0.25)', 'rgba(255,220,120,0.2)'][i];
        g.fill();
      });
      g.restore();
      break;
    }
    case 'rainbow':
      redraw(g, W, H, snap(g, W, H), { filter: `hue-rotate(${Math.round((t * 160) % 360)}deg) saturate(1.4)`, alpha: Math.min(1, a) });
      break;
    case 'focus': {
      const b = Math.max(0, 1 - t / 0.9) * m * 0.04 * a;
      if (b > 0.3) redraw(g, W, H, snap(g, W, H), { filter: `blur(${b.toFixed(1)}px) brightness(${1 + b / m})` });
      break;
    }
    case 'vhs': {
      const src = snap(g, W, H);
      rgbSplit(g, W, H, src, m * 0.006 * a);
      // a rolling band of displaced picture
      const by = ((t * 0.35) % 1.2 - 0.1) * H;
      const bh = H * 0.06;
      g.drawImage(src, 0, by, W, bh, W * 0.02 * Math.sin(t * 40), by, W, bh);
      g.save();
      g.globalAlpha = 0.16;
      g.fillStyle = '#000';
      const step = Math.max(2, Math.round(H / 260));
      for (let y = 0; y < H; y += step * 2) g.fillRect(0, y, W, step);
      g.globalAlpha = 0.9;
      g.fillStyle = '#fff';
      g.shadowColor = 'rgba(0,0,0,.6)';
      g.shadowBlur = m * 0.01;
      g.font = `700 ${Math.round(m * 0.045)}px "Courier New", monospace`;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText('PLAY ▶', W * 0.06, H * 0.08);
      g.textAlign = 'right';
      g.fillText(timecode(t).slice(3, 8), W * 0.94, H * 0.94);
      g.textAlign = 'left';
      g.fillText('SP', W * 0.06, H * 0.94);
      g.restore();
      break;
    }
    case 'oldfilm': {
      const src = snap(g, W, H);
      redraw(g, W, H, src, { filter: `sepia(0.85) contrast(1.15) brightness(${(0.88 + 0.12 * hr(frame)).toFixed(3)})`, dx: (hr(frame + 0.5) - 0.5) * m * 0.004 });
      grain(g, W, H, frame, 0.35);
      g.save();
      g.strokeStyle = 'rgba(30,20,10,0.5)';
      g.lineWidth = Math.max(1, m * 0.002);
      for (let i = 0; i < 3; i++) {
        if (hr(frame * 3 + i) > 0.55) continue;
        const x = hr(frame * 7 + i) * W;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + (hr(i + frame) - 0.5) * m * 0.03, H);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,10,0,0.6)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(hr(frame * 11 + i) * W, hr(frame * 13 + i) * H, m * 0.003 * (1 + hr(i)), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      vignette(g, W, H, 0.75);
      break;
    }
    case 'grain':
      grain(g, W, H, frame, 0.3 * Math.min(1.5, a));
      break;
    case 'camcorder': {
      g.save();
      const pad = m * 0.06;
      const len = m * 0.08;
      g.strokeStyle = '#fff';
      g.lineWidth = Math.max(2, m * 0.006);
      g.shadowColor = 'rgba(0,0,0,.5)';
      g.shadowBlur = m * 0.008;
      [[pad, pad, 1, 1], [W - pad, pad, -1, 1], [pad, H - pad, 1, -1], [W - pad, H - pad, -1, -1]].forEach(([x, y, sx, sy]) => {
        g.beginPath();
        g.moveTo(x, y + len * sy);
        g.lineTo(x, y);
        g.lineTo(x + len * sx, y);
        g.stroke();
      });
      g.font = `700 ${Math.round(m * 0.045)}px "DM Sans", sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      if (Math.floor(t * 2) % 2 === 0) {
        g.fillStyle = '#ef4444';
        g.beginPath();
        g.arc(pad * 1.6, pad * 1.6, m * 0.016, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.fillText('REC', pad * 1.6 + m * 0.03, pad * 1.6);
      g.textAlign = 'right';
      g.fillText(timecode(t), W - pad * 1.6, H - pad * 1.6);
      // battery
      const bx = W - pad * 1.6 - m * 0.09;
      const byy = pad * 1.6 - m * 0.018;
      g.strokeRect(bx, byy, m * 0.08, m * 0.036);
      g.fillRect(bx + m * 0.08, byy + m * 0.01, m * 0.008, m * 0.016);
      g.fillRect(bx + m * 0.008, byy + m * 0.008, m * 0.05, m * 0.02);
      g.textAlign = 'left';
      g.font = `600 ${Math.round(m * 0.032)}px "DM Sans", sans-serif`;
      g.fillText('HD 1080', pad * 1.6, H - pad * 1.6);
      g.restore();
      break;
    }
    case 'pixel': {
      const block = Math.max(2, Math.round(m * 0.022 * a));
      const sw = Math.max(1, Math.ceil(W / block));
      const sh = Math.max(1, Math.ceil(H / block));
      const [c, cg] = scratch('pix', sw, sh);
      cg.drawImage(g.canvas, 0, 0, sw, sh);
      g.save();
      g.imageSmoothingEnabled = false;
      g.drawImage(c, 0, 0, W, H);
      g.restore();
      break;
    }
    case 'rgb':
      rgbSplit(g, W, H, snap(g, W, H), m * 0.012 * a * (0.6 + 0.4 * Math.sin(t * 6)));
      break;
    case 'glitch': {
      const on = t < 0.25 || t % 1.1 < 0.2;
      if (!on) break;
      const src = snap(g, W, H);
      rgbSplit(g, W, H, src, m * 0.02 * a);
      for (let i = 0; i < 6; i++) {
        const y = hr(frame * 5 + i) * H;
        const h = H * (0.02 + 0.06 * hr(frame + i * 3));
        const off = (hr(frame * 9 + i) - 0.5) * W * 0.12 * a;
        g.drawImage(src, 0, y, W, h, off, y, W, h);
      }
      g.save();
      g.globalAlpha = 0.6;
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#22d3ee', '#f0abfc', '#a3e635', '#fff'][i];
        g.fillRect(hr(frame + i * 17) * W, hr(frame * 3 + i) * H, m * 0.08 * hr(i + frame), m * 0.012);
      }
      g.restore();
      break;
    }
    case 'invert':
      if (t % 0.5 < 0.09) redraw(g, W, H, snap(g, W, H), { filter: 'invert(1)' });
      break;
    case 'snow':
    case 'rain':
    case 'hearts':
    case 'confetti':
    case 'sparkle':
    case 'bokeh':
    case 'bubbles':
    case 'petals':
      particles(g, W, H, id, t, a);
      break;
    case 'fireworks': {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const period = 1.7;
        const tt = t + k * 0.57;
        const cycle = Math.floor(tt / period);
        const lc = tt % period;
        const cx = W * (0.2 + 0.6 * hr(cycle * 7 + k));
        const cy = H * (0.15 + 0.3 * hr(cycle * 3 + k * 5));
        const hue = Math.floor(hr(cycle + k * 11) * 360);
        const n = 36;
        const r = ease(lc / 0.9) * m * 0.28;
        const fade = clamp(1 - lc / period, 0, 1);
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r + lc * lc * m * 0.06;
          g.fillStyle = `hsla(${hue},100%,65%,${fade * Math.min(1, a)})`;
          g.beginPath();
          g.arc(x, y, m * 0.006 * (0.6 + fade), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      break;
    }
    case 'bars': {
      const bh = (H > W ? H * 0.09 : H * 0.12) * ease(t / 0.6) * Math.min(1.5, a);
      g.save();
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, bh);
      g.fillRect(0, H - bh, W, bh);
      g.restore();
      break;
    }
    case 'vignette':
      vignette(g, W, H, 0.75 * Math.min(1.3, a));
      break;
    case 'mirror': {
      const src = snap(g, W, H);
      g.save();
      g.beginPath();
      g.rect(W / 2, 0, W / 2, H);
      g.clip();
      g.translate(W, 0);
      g.scale(-1, 1);
      g.drawImage(src, 0, 0, W, H);
      g.restore();
      break;
    }
    case 'kaleido': {
      const src = snap(g, W, H);
      const hw = W / 2;
      const hh = H / 2;
      g.save();
      [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([x, y, sx, sy]) => {
        g.save();
        g.translate(x, y);
        g.scale(sx, sy);
        g.drawImage(src, W / 4, H / 4, hw, hh, 0, 0, hw, hh);
        g.restore();
      });
      g.restore();
      break;
    }
    case 'split4':
    case 'split9': {
      const n = id === 'split4' ? 2 : 3;
      const src = snap(g, W, H);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g.drawImage(src, (c * W) / n, (r * H) / n, W / n, H / n);
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = Math.max(2, m * 0.006);
      for (let i = 1; i < n; i++) {
        g.beginPath();
        g.moveTo((i * W) / n, 0);
        g.lineTo((i * W) / n, H);
        g.moveTo(0, (i * H) / n);
        g.lineTo(W, (i * H) / n);
        g.stroke();
      }
      g.restore();
      break;
    }
    case 'countdown': {
      if (t >= 3) break;
      const num = 3 - Math.floor(t);
      const lt = t % 1;
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, W, H);
      g.translate(W / 2, H / 2);
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = m * 0.015;
      g.beginPath();
      g.arc(0, 0, m * 0.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lt);
      g.stroke();
      const s = 0.6 + 0.4 * ease(lt / 0.25);
      g.scale(s, s);
      g.fillStyle = '#fff';
      g.font = `800 ${Math.round(m * 0.3)}px "Bricolage Grotesque", "DM Sans", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.globalAlpha = 1 - Math.max(0, lt - 0.8) * 5;
      g.fillText(String(num), 0, m * 0.01);
      g.restore();
      break;
    }
  }
}

function particles(g, W, H, id, t, a) {
  const m = Math.min(W, H);
  const k = Math.min(1.5, a);
  g.save();
  if (id === 'snow') {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    const n = Math.round(90 * k);
    for (let i = 0; i < n; i++) {
      const sp = 0.05 + 0.1 * hr(i + 0.3);
      const y = (((hr(i + 0.1) + t * sp) % 1) * 1.1 - 0.05) * H;
      const x = hr(i) * W + Math.sin(t * 1.3 + i) * m * 0.02;
      g.beginPath();
      g.arc(x, y, m * (0.003 + 0.007 * hr(i + 0.7)), 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'rain') {
    g.fillStyle = 'rgba(20,40,80,0.15)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(200,220,255,0.55)';
    g.lineWidth = Math.max(1, m * 0.002);
    const n = Math.round(140 * k);
    const len = m * 0.045;
    for (let i = 0; i < n; i++) {
      const sp = 1.2 + 0.8 * hr(i + 0.4);
      const y = (((hr(i + 0.2) + t * sp) % 1) * 1.2 - 0.1) * H;
      const x = hr(i) * W * 1.1 - y * 0.08;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * 0.15, y + len);
      g.stroke();
    }
  } else if (id === 'hearts') {
    const n = Math.round(18 * k);
    const cols = ['#fb7185', '#f472b6', '#ef4444', '#fda4af'];
    for (let i = 0; i < n; i++) {
      const sp = 0.12 + 0.12 * hr(i + 0.5);
      const p = (hr(i + 0.9) + t * sp) % 1;
      const y = H * (1.1 - p * 1.3);
      const x = hr(i) * W + Math.sin(t * 2 + i) * m * 0.04;
      const s = m * (0.035 + 0.04 * hr(i + 0.2));
      g.globalAlpha = clamp(Math.min(p * 4, (1 - p) * 3), 0, 1) * 0.9;
      g.fillStyle = cols[i % cols.length];
      heartPath(g, x, y, s);
      g.fill();
    }
  } else if (id === 'confetti') {
    const n = Math.round(90 * k);
    const cols = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#facc15'];
    for (let i = 0; i < n; i++) {
      const sp = 0.25 + 0.25 * hr(i + 0.6);
      const y = (((hr(i + 0.15) + t * sp) % 1) * 1.15 - 0.08) * H;
      const x = hr(i) * W + Math.sin(t * 3 + i) * m * 0.03;
      g.save();
      g.translate(x, y);
      g.rotate(t * (2 + 4 * hr(i)) + i);
      g.scale(1, Math.abs(Math.cos(t * 5 + i)));
      g.fillStyle = cols[i % cols.length];
      g.fillRect(-m * 0.008, -m * 0.004, m * 0.016, m * 0.008);
      g.restore();
    }
  } else if (id === 'sparkle') {
    const n = Math.round(40 * k);
    g.shadowColor = '#fff7cc';
    g.shadowBlur = m * 0.02;
    for (let i = 0; i < n; i++) {
      const tw = Math.max(0, Math.sin(t * 3 + i * 1.7));
      if (tw < 0.05) continue;
      g.globalAlpha = tw;
      g.fillStyle = i % 3 ? '#ffffff' : '#fde68a';
      starPath(g, hr(i) * W, hr(i + 0.5) * H, m * (0.01 + 0.025 * hr(i + 0.8)) * tw);
      g.fill();
    }
  } else if (id === 'bokeh') {
    g.globalCompositeOperation = 'screen';
    const n = Math.round(22 * k);
    const cols = ['255,200,120', '255,140,180', '160,200,255', '255,240,200'];
    for (let i = 0; i < n; i++) {
      const x = hr(i) * W + Math.sin(t * 0.4 + i) * m * 0.05;
      const y = hr(i + 0.4) * H + Math.cos(t * 0.3 + i) * m * 0.04;
      const r = m * (0.04 + 0.07 * hr(i + 0.9));
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const al = 0.25 + 0.2 * Math.sin(t + i);
      gr.addColorStop(0, `rgba(${cols[i % 4]},${al})`);
      gr.addColorStop(0.8, `rgba(${cols[i % 4]},${al * 0.8})`);
      gr.addColorStop(1, `rgba(${cols[i % 4]},0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'bubbles') {
    const n = Math.round(24 * k);
    g.lineWidth = Math.max(1, m * 0.003);
    for (let i = 0; i < n; i++) {
      const sp = 0.08 + 0.1 * hr(i + 0.3);
      const p = (hr(i + 0.7) + t * sp) % 1;
      const y = H * (1.1 - p * 1.25);
      const x = hr(i) * W + Math.sin(t * 1.5 + i) * m * 0.03;
      const r = m * (0.015 + 0.035 * hr(i + 0.1));
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.fillStyle = 'rgba(180,220,255,0.12)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'petals') {
    const n = Math.round(35 * k);
    for (let i = 0; i < n; i++) {
      const sp = 0.1 + 0.12 * hr(i + 0.3);
      const y = (((hr(i + 0.2) + t * sp) % 1) * 1.15 - 0.08) * H;
      const x = hr(i) * W + Math.sin(t * 1.4 + i) * m * 0.06;
      g.save();
      g.translate(x, y);
      g.rotate(t * (1 + hr(i)) + i);
      g.fillStyle = i % 2 ? '#fbcfe8' : '#f9a8d4';
      g.beginPath();
      g.ellipse(0, 0, m * 0.014, m * 0.008, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.restore();
}

// ---------- person segmentation ----------
let segP = null;
let seg = null;
let segErr = null;
export const segState = () => (seg ? 'ready' : segErr ? 'error' : segP ? 'loading' : 'idle');
export function loadSegmenter() {
  if (seg) return Promise.resolve(seg);
  if (!segP) {
    segErr = null;
    segP = (async () => {
      const vision = await import(/* @vite-ignore */ `${TASKS_URL}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${TASKS_URL}/wasm`);
      const model = new URL('models/selfie_segmenter.tflite', document.baseURI).href;
      seg = await vision.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: model, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      return seg;
    })().catch((e) => {
      console.error(e);
      segErr = e;
      segP = null;
      throw e;
    });
  }
  return segP;
}

/** Turn per-pixel person confidence into a mask canvas plus edge points and the body centre. */
function maskFromConfidence(data, w, h) {
  const [c, cg] = scratch('mask', w, h);
  const img = cg.createImageData(w, h);
  let sx = 0;
  let sy = 0;
  let n = 0;
  const edges = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = data[i];
      const al = clamp((v - 0.3) / 0.4, 0, 1);
      const p = i * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = 255;
      img.data[p + 3] = Math.round(al * 255);
      if (v > 0.5) {
        sx += x;
        sy += y;
        n++;
        if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && (data[i - 1] <= 0.5 || data[i + 1] <= 0.5 || data[i - w] <= 0.5 || data[i + w] <= 0.5)) edges.push([x / w, y / h]);
      }
    }
  }
  cg.putImageData(img, 0, 0);
  return { c, edges, cx: n ? sx / n / w : 0.5, cy: n ? sy / n / h : 0.5, area: n / (w * h) };
}

/** Find the person in a canvas. Returns null until the model has loaded. */
export function segmentCanvas(src) {
  if (!seg) {
    if (!segErr) loadSegmenter().catch(() => {});
    return null;
  }
  const W = src.width;
  const H = src.height;
  const s = 256 / Math.max(W, H);
  const w = Math.max(16, Math.round(W * s));
  const h = Math.max(16, Math.round(H * s));
  const [c, cg] = scratch('seg-in', w, h);
  cg.drawImage(src, 0, 0, w, h);
  let res;
  try {
    res = seg.segment(c);
    const mk = res?.confidenceMasks?.[0];
    if (!mk) return null;
    return maskFromConfidence(mk.getAsFloat32Array(), mk.width, mk.height);
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    res?.close?.();
  }
}

// ---------- body effects ----------
function personLayer(W, H, src, mk, name = 'person') {
  const [c, cg] = scratch(name, W, H);
  cg.clearRect(0, 0, W, H);
  cg.drawImage(src, 0, 0, W, H);
  cg.globalCompositeOperation = 'destination-in';
  cg.drawImage(mk.c, 0, 0, W, H);
  return c;
}
function silhouette(W, H, mk, color, name = 'sil') {
  const [c, cg] = scratch(name, W, H);
  cg.clearRect(0, 0, W, H);
  cg.drawImage(mk.c, 0, 0, W, H);
  cg.globalCompositeOperation = 'source-in';
  cg.fillStyle = color;
  cg.fillRect(0, 0, W, H);
  return c;
}
function dilate(W, H, sil, r, name = 'dil') {
  const [c, cg] = scratch(name, W, H);
  cg.clearRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    cg.drawImage(sil, Math.cos(ang) * r, Math.sin(ang) * r);
  }
  cg.drawImage(sil, 0, 0);
  return c;
}

/**
 * Apply a body effect. mk is the person mask from segmentCanvas (or a synthetic one).
 * o: { local, dur, amt, color }
 */
export function applyBodyFx(g, W, H, id, o, mk) {
  if (!mk || mk.area < 0.003) return;
  const a = o.amt ?? 1;
  const t = o.local;
  const m = Math.min(W, H);
  const frame = Math.floor(t * 24);
  const src = snap(g, W, H, 'body-src');
  const person = personLayer(W, H, src, mk);
  const blur = (px) => `blur(${Math.max(0.5, px).toFixed(1)}px)`;
  g.save();
  switch (id) {
    case 'outline': {
      const col = o.color || COLOR_FX.outline;
      const dil = dilate(W, H, silhouette(W, H, mk, col), m * 0.007 * a);
      g.filter = blur(m * 0.014 * a);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(dil, 0, 0);
      g.filter = 'none';
      g.globalCompositeOperation = 'source-over';
      g.drawImage(dil, 0, 0);
      g.drawImage(person, 0, 0);
      break;
    }
    case 'aura': {
      const hue = Math.round((t * 140) % 360);
      const dil = dilate(W, H, silhouette(W, H, mk, `hsl(${hue},100%,60%)`), m * (0.012 + 0.008 * Math.sin(t * 5)) * a);
      g.globalCompositeOperation = 'lighter';
      g.filter = blur(m * 0.035 * a);
      g.drawImage(dil, 0, 0);
      g.filter = blur(m * 0.012 * a);
      g.drawImage(dilate(W, H, silhouette(W, H, mk, `hsl(${(hue + 120) % 360},100%,60%)`, 'sil2'), m * 0.006 * a, 'dil2'), 0, 0);
      g.filter = 'none';
      g.globalCompositeOperation = 'source-over';
      g.drawImage(person, 0, 0);
      break;
    }
    case 'fire': {
      const layers = [['#fde047', 0.006], ['#fb923c', 0.014], ['#ef4444', 0.024]];
      g.globalCompositeOperation = 'lighter';
      layers.forEach(([col, up], i) => {
        const sil = silhouette(W, H, mk, col, 'fsil' + i);
        const flick = 1 + 0.25 * Math.sin(t * (9 + i * 3) + i);
        g.filter = blur(m * (0.01 + i * 0.008) * a);
        g.globalAlpha = 0.85;
        g.drawImage(sil, (Math.sin(t * 7 + i) * m * 0.004), -m * up * flick * a * 2, W, H * (1 + up * 0.5));
      });
      g.filter = 'none';
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(person, 0, 0);
      break;
    }
    case 'sparkbody': {
      g.drawImage(person, 0, 0);
      const pts = mk.edges;
      if (!pts.length) break;
      g.shadowColor = '#fff7cc';
      g.shadowBlur = m * 0.02;
      const n = Math.round(34 * Math.min(1.5, a));
      for (let i = 0; i < n; i++) {
        const tw = Math.max(0, Math.sin(t * 4 + i * 1.9));
        if (tw < 0.05) continue;
        const [px, py] = pts[Math.floor(hr(i * 3.7 + Math.floor(t * 2 + i * 0.13)) * pts.length)];
        g.globalAlpha = tw;
        g.fillStyle = i % 3 ? '#ffffff' : '#fde68a';
        starPath(g, px * W, py * H, m * (0.012 + 0.02 * hr(i)) * tw);
        g.fill();
      }
      break;
    }
    case 'clone': {
      const off = W * 0.24;
      g.globalAlpha = 0.75;
      g.drawImage(person, -off, 0);
      g.drawImage(person, off, 0);
      g.globalAlpha = 1;
      g.drawImage(person, 0, 0);
      break;
    }
    case 'trail': {
      for (let k = 4; k >= 1; k--) {
        g.globalAlpha = 0.5 / k;
        g.drawImage(person, Math.sin(t * 3 - k * 0.35) * W * 0.05 * a * k * 0.5, Math.cos(t * 2.2 - k * 0.3) * H * 0.01 * k);
      }
      g.globalAlpha = 1;
      g.drawImage(person, 0, 0);
      break;
    }
    case 'bodyglitch': {
      const on = t < 0.3 || t % 0.9 < 0.22;
      if (!on) break;
      rgbSplit(g, W, H, person, m * 0.02 * a, { only: true });
      for (let i = 0; i < 4; i++) {
        const y = hr(frame * 5 + i) * H;
        const h = H * (0.02 + 0.04 * hr(frame + i));
        g.drawImage(person, 0, y, W, h, (hr(frame * 9 + i) - 0.5) * W * 0.1 * a, y, W, h);
      }
      break;
    }
    case 'silhouette': {
      const ph = Math.floor(t * 2) % 2;
      const col = o.color || COLOR_FX.silhouette;
      if (ph) {
        g.fillStyle = col;
        g.globalAlpha = 0.9;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        g.drawImage(silhouette(W, H, mk, '#000'), 0, 0);
      } else {
        g.drawImage(silhouette(W, H, mk, col), 0, 0);
      }
      break;
    }
    case 'bgblur':
      g.filter = blur(m * 0.025 * a);
      g.drawImage(src, -m * 0.02, -m * 0.02, W + m * 0.04, H + m * 0.04);
      g.filter = 'none';
      g.drawImage(person, 0, 0);
      break;
    case 'colorpop':
      g.filter = `grayscale(${Math.min(1, a)}) contrast(1.1)`;
      g.drawImage(src, 0, 0);
      g.filter = 'none';
      g.drawImage(person, 0, 0);
      break;
    case 'spotlight': {
      g.fillStyle = `rgba(0,0,0,${0.7 * Math.min(1.2, a)})`;
      g.fillRect(0, 0, W, H);
      const cx = mk.cx * W;
      const cy = mk.cy * H;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, m * 0.6);
      gr.addColorStop(0, 'rgba(255,240,200,0.35)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.globalCompositeOperation = 'screen';
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(person, 0, 0);
      break;
    }
    case 'bgneon': {
      const ang = t * 0.6;
      const gr = g.createLinearGradient(W / 2 - Math.cos(ang) * W, H / 2 - Math.sin(ang) * H, W / 2 + Math.cos(ang) * W, H / 2 + Math.sin(ang) * H);
      gr.addColorStop(0, '#1e1b4b');
      gr.addColorStop(0.5, '#7c3aed');
      gr.addColorStop(1, '#db2777');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = Math.max(1, m * 0.002);
      const step = m / 10;
      const sh = (t * step) % step;
      for (let y = sh; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      const dil = dilate(W, H, silhouette(W, H, mk, o.color || COLOR_FX.bgneon), m * 0.006 * a);
      g.filter = blur(m * 0.015);
      g.drawImage(dil, 0, 0);
      g.filter = 'none';
      g.drawImage(dil, 0, 0);
      g.drawImage(person, 0, 0);
      break;
    }
    case 'xray': {
      g.fillStyle = 'rgba(2,6,23,0.75)';
      g.fillRect(0, 0, W, H);
      const [c, cg] = scratch('xray', W, H);
      cg.clearRect(0, 0, W, H);
      cg.filter = 'invert(1) grayscale(1) contrast(1.3)';
      cg.drawImage(person, 0, 0);
      cg.filter = 'none';
      cg.globalCompositeOperation = 'source-atop';
      cg.fillStyle = 'rgba(56,189,248,0.55)';
      cg.fillRect(0, 0, W, H);
      g.shadowColor = '#38bdf8';
      g.shadowBlur = m * 0.03 * a;
      g.drawImage(c, 0, 0);
      break;
    }
  }
  g.restore();
}

// ---------- previews on sample photos ----------
// Two sample photos of people (made with the free image AI for Artvas) with person masks worked out
// ahead of time, so body-effect previews work even before the segmenter has loaded.
const SAMPLE_FILES = ['fx-a', 'fx-b'];
let samples = null;
let samplesP = null;
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not load ' + src));
    im.src = src;
  });
}
/** Load the sample photos and their person masks (small, cached by the browser). */
export function loadFxSamples() {
  if (samples) return Promise.resolve(samples);
  if (!samplesP) {
    samplesP = Promise.all(
      SAMPLE_FILES.map(async (n) => {
        const base = new URL(`samples/${n}`, document.baseURI).href;
        const [img, m] = await Promise.all([loadImg(`${base}.jpg`), loadImg(`${base}-mask.png`)]);
        const c = document.createElement('canvas');
        c.width = m.width;
        c.height = m.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(m, 0, 0);
        const d = g.getImageData(0, 0, m.width, m.height).data;
        const conf = new Float32Array(m.width * m.height);
        for (let i = 0; i < conf.length; i++) conf[i] = d[i * 4 + 3] / 255;
        const mk = maskFromConfidence(conf, m.width, m.height);
        // keep a private copy: the scratch mask canvas is reused by live person detection
        const own = document.createElement('canvas');
        own.width = m.width;
        own.height = m.height;
        own.getContext('2d').drawImage(mk.c, 0, 0);
        return { img, mk: { ...mk, c: own } };
      })
    )
      .then((list) => (samples = list))
      .catch((e) => {
        samplesP = null;
        throw e;
      });
  }
  return samplesP;
}
export const fxSamplesReady = () => !!samples;
/** Draw sample photo i to cover a w×h canvas. */
export function drawSample(g, w, h, i = 0) {
  const s = samples?.[i];
  if (!s) {
    g.fillStyle = '#2a2340';
    g.fillRect(0, 0, w, h);
    return;
  }
  const im = s.img;
  const k = Math.max(w / im.width, h / im.height);
  g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k);
}
/** Draw an effect on a sample photo at time t (seconds into the effect). */
export function drawFxFrame(g, w, h, kind, id, t, i = 0) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  drawSample(g, w, h, i);
  g.restore();
  const o = { local: t, dur: 3, amt: 1 };
  try {
    if (kind === 'body') applyBodyFx(g, w, h, id, o, samples?.[i]?.mk);
    else applyVideoFx(g, w, h, id, o);
  } catch (e) {
    console.error(e);
  }
}
const thumbCache = new Map();
/** Still preview of an effect on the sample photo ('' until the photos have loaded). */
export function fxThumb(id, kind, w = 120, h = 160) {
  if (!samples) return '';
  const key = `${kind}:${id}:${w}x${h}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = id === 'countdown' ? 0.4 : id === 'glitch' || id === 'bodyglitch' ? 0.1 : id === 'flash' ? 0.02 : 0.7;
  drawFxFrame(c.getContext('2d'), w, h, kind, id, t);
  const url = c.toDataURL('image/jpeg', 0.82);
  thumbCache.set(key, url);
  return url;
}

/**
 * Play a preview on a card while it is hovered or pressed.
 * draw(g, w, h, t) paints one frame at time t (seconds since the preview started).
 */
export function bindCardPreview(card, draw, { w = 120, h = 160 } = {}) {
  let raf = 0;
  let cv = null;
  let t0 = 0;
  const frame = (ts) => {
    if (!t0) t0 = ts;
    draw(cv.getContext('2d'), w, h, (ts - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf || !samples) return;
    const img = card.querySelector('img');
    if (!img) return;
    cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.className = 'fx-live';
    img.after(cv);
    t0 = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    cv?.remove();
    cv = null;
  };
  // touch: press and hold to watch; lifting after a long press doesn't apply the effect
  let downAt = 0;
  card.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && start());
  card.addEventListener('pointerleave', stop);
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    downAt = Date.now();
    start();
  });
  card.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    if (Date.now() - downAt > 400) card.dataset.held = '1';
    stop();
  });
  card.addEventListener(
    'click',
    (e) => {
      if (card.dataset.held) {
        delete card.dataset.held;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );
  card.addEventListener('contextmenu', (e) => downAt && e.preventDefault());
  card.addEventListener('pointercancel', stop);
  card.addEventListener('focus', start);
  card.addEventListener('blur', stop);
  return stop;
}

// ---------- masks, looks and blend modes (clips and picture-in-picture layers) ----------
/** One reusable canvas per name; it is resized (and so cleared) only when the size changes. */
const layers = new Map();
export function layerCanvas(name, w, h) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  let c = layers.get(name);
  if (!c) {
    c = document.createElement('canvas');
    layers.set(name, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.shadowBlur = 0;
  g.clearRect(0, 0, w, h);
  return [c, g];
}

export const MASKS = [
  ['none', 'None'], ['circle', 'Circle'], ['rect', 'Rectangle'], ['heart', 'Heart'], ['star', 'Star'], ['linear', 'Linear'], ['mirror', 'Mirror'],
];
/** Small line icons (24×24) for the mask picker. */
export const MASK_ICONS = {
  none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="3"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10a4 4 0 0 1 7.5-2 4 4 0 0 1 7.5 2c0 5.4-7.5 10-7.5 10z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  linear: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16"/><path d="M4 16h16M4 20h16" opacity=".45"/>',
  mirror: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 15h16"/>',
};
export const maskIcon = (id, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${MASK_ICONS[id] || ''}</svg>`;
export const DEFAULT_MASK = { type: 'none', x: 0, y: 0, size: 0.7, aspect: 1, round: 0.2, feather: 0, rot: 0, invert: false };
export const isMasked = (m) => !!(m && m.type && m.type !== 'none');

/** Trace the mask outline around (0,0) in mask space; u is the unit length (shorter side). */
function maskPath(g, m, u) {
  const s = (m.size ?? 0.7) * u;
  const ar = clamp(m.aspect ?? 1, 0.2, 5);
  const big = u * 40;
  g.beginPath();
  switch (m.type) {
    case 'circle':
      g.ellipse(0, 0, Math.max(0.5, (s * ar) / 2), Math.max(0.5, s / 2), 0, 0, Math.PI * 2);
      break;
    case 'rect': {
      const w = s * ar;
      const r = clamp(m.round ?? 0, 0, 1) * Math.min(w, s) * 0.5;
      g.roundRect(-w / 2, -s / 2, w, s, r);
      break;
    }
    case 'heart': {
      // two lobes and a point, drawn as one smooth outline (height s, width s * ar)
      const hx = (s * ar) / 2;
      const top = -s * 0.28;
      g.moveTo(0, top);
      g.bezierCurveTo(-hx * 0.15, -s * 0.52, -hx * 1.02, -s * 0.55, -hx, -s * 0.12);
      g.bezierCurveTo(-hx * 0.98, s * 0.16, -hx * 0.45, s * 0.3, 0, s * 0.5);
      g.bezierCurveTo(hx * 0.45, s * 0.3, hx * 0.98, s * 0.16, hx, -s * 0.12);
      g.bezierCurveTo(hx * 1.02, -s * 0.55, hx * 0.15, -s * 0.52, 0, top);
      g.closePath();
      break;
    }
    case 'star': {
      const R = s / 2;
      const ri = R * 0.42;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? ri : R;
        const x = Math.cos(a) * r * ar;
        const y = Math.sin(a) * r + R * 0.1;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      break;
    }
    case 'linear':
      // keep everything below the line
      g.rect(-big, 0, big * 2, big);
      break;
    case 'mirror':
      // keep a band of height s across the picture
      g.rect(-big, -s / 2, big * 2, s);
      break;
  }
}

/**
 * Cut a layer canvas to a mask shape. T maps mask space (centred on the shape) to the layer's
 * pixels; u is the unit length in mask space. Feather softens the edge with a blur.
 */
export function maskLayer(layer, m, T, u) {
  const w = layer.width;
  const h = layer.height;
  const [mc, mg] = layerCanvas('maskShape', w, h);
  const px = Math.hypot(T.a, T.b) || 1;
  const f = clamp(m.feather || 0, 0, 1) * u * 0.18 * px;
  if (m.invert) {
    mg.fillStyle = '#fff';
    mg.fillRect(0, 0, w, h);
    mg.globalCompositeOperation = 'destination-out';
  }
  mg.setTransform(T);
  if (f >= 0.5) mg.filter = `blur(${f.toFixed(1)}px)`;
  mg.fillStyle = '#fff';
  maskPath(mg, m, u);
  mg.fill();
  const lg = layer.getContext('2d');
  lg.save();
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalAlpha = 1;
  lg.filter = 'none';
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(mc, 0, 0);
  lg.restore();
}

/** Outline of a mask for the on-canvas guide while editing. */
export function strokeMaskGuide(g, m, T, u) {
  g.save();
  g.setTransform(T);
  maskPath(g, m, u);
  const px = Math.hypot(T.a, T.b) || 1;
  g.lineWidth = 2 / px;
  g.setLineDash([6 / px, 5 / px]);
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.shadowColor = 'rgba(0,0,0,.6)';
  g.shadowBlur = 3;
  g.stroke();
  g.restore();
}

export const BLEND_MODES = [
  ['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'],
  ['color-dodge', 'Color dodge'], ['color-burn', 'Color burn'], ['hard-light', 'Hard light'], ['soft-light', 'Soft light'], ['difference', 'Difference'],
  ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
];
export const blendOp = (id) => (id && id !== 'normal' && BLEND_MODES.some(([b]) => b === id) ? id : 'source-over');

/** Colour looks that a CSS filter can't do: temperature, tint, fade, vignette and sharpen. */
export const LOOK_KEYS = ['temp', 'tint', 'fade', 'vignette', 'sharpen'];
export const hasLook = (k) => !!k && LOOK_KEYS.some((key) => Math.abs(k[key] || 0) > 0.005);

/**
 * Apply a look to a layer that holds one clip. T0 maps frame coordinates (W×H) to the layer's
 * pixels. Tints are drawn over the whole layer, then the clip's own alpha is put back so they
 * stay inside the picture.
 */
export function applyLook(layer, k, T0, W, H) {
  const w = layer.width;
  const h = layer.height;
  const lg = layer.getContext('2d');
  const [ac, ag] = layerCanvas('lookAlpha', w, h);
  ag.drawImage(layer, 0, 0);
  lg.save();
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.globalAlpha = 1;
  lg.filter = 'none';
  const sharp = clamp(k.sharpen || 0, 0, 1);
  if (sharp > 0.005) {
    // high-pass detail (0.5 + (image - blurred) / 2) laid over the picture with overlay
    const [sc, sg] = layerCanvas('lookSharp', w, h);
    sg.fillStyle = '#808080';
    sg.fillRect(0, 0, w, h);
    sg.filter = `blur(${Math.max(1, Math.min(w, h) / 500).toFixed(1)}px) invert(1)`;
    sg.drawImage(layer, 0, 0);
    sg.filter = 'none';
    sg.globalAlpha = 0.5;
    sg.drawImage(layer, 0, 0);
    lg.globalCompositeOperation = 'overlay';
    lg.globalAlpha = sharp;
    lg.drawImage(sc, 0, 0);
    lg.globalAlpha = 1;
  }
  const fill = (op, color, a) => {
    if (a <= 0.003) return;
    lg.globalCompositeOperation = op;
    lg.globalAlpha = clamp(a, 0, 1);
    lg.fillStyle = color;
    lg.fillRect(0, 0, w, h);
  };
  const temp = clamp(k.temp || 0, -1, 1);
  if (temp > 0) fill('soft-light', '#ff8a1f', temp * 0.75);
  else if (temp < 0) fill('soft-light', '#1f7bff', -temp * 0.75);
  if (temp) fill('color', temp > 0 ? '#ffb36b' : '#6bb0ff', Math.abs(temp) * 0.08);
  const tint = clamp(k.tint || 0, -1, 1);
  if (tint > 0) fill('soft-light', '#ff2bd6', tint * 0.6);
  else if (tint < 0) fill('soft-light', '#2bff6a', -tint * 0.6);
  const fade = clamp(k.fade || 0, -1, 1);
  if (fade > 0) {
    // lift the blacks and soften the highlights a little
    fill('screen', '#4a4a52', fade);
    fill('multiply', '#ececec', fade * 0.6);
  }
  const vig = clamp(k.vignette || 0, 0, 1);
  if (vig > 0.005) {
    lg.setTransform(T0);
    lg.globalCompositeOperation = 'source-over';
    lg.globalAlpha = 1;
    const r = lg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.45 - vig * 0.2), W / 2, H / 2, Math.hypot(W, H) * 0.55);
    r.addColorStop(0, 'rgba(0,0,0,0)');
    r.addColorStop(1, `rgba(0,0,0,${(0.35 + vig * 0.55).toFixed(3)})`);
    lg.fillStyle = r;
    lg.fillRect(-W, -H, W * 3, H * 3);
    lg.setTransform(1, 0, 0, 1, 0, 0);
  }
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(ac, 0, 0);
  lg.restore();
}

// ---------- voice changer ----------
export const VOICE_FX = [
  ['chipmunk', 'Chipmunk'], ['deep', 'Deep'], ['robot', 'Robot'], ['echo', 'Echo'], ['telephone', 'Telephone'],
  ['megaphone', 'Megaphone'], ['monster', 'Monster'], ['cave', 'Cave reverb'], ['radio', 'Radio'], ['underwater', 'Underwater'],
];
export const voiceName = (id) => VOICE_FX.find(([v]) => v === id)?.[1] || 'Original';
const VOICE_PITCH = { chipmunk: 1.6, deep: 0.76, monster: 0.62 };

/**
 * Change pitch and/or tempo with overlapping windowed grains (time-domain overlap-add).
 * pitch > 1 raises the voice; speed > 1 makes it shorter. Both are independent.
 */
function grainShift(x, pitch, speed, sr) {
  const N = Math.max(256, Math.round(sr * 0.046) & ~1);
  const hop = N >> 2;
  const outLen = Math.max(1, Math.round(x.length / speed));
  const out = new Float32Array(outLen);
  const wsum = new Float32Array(outLen);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const span = N * pitch;
  for (let o = -N; o < outLen; o += hop) {
    const centre = (o + N / 2) * speed;
    const start = centre - span / 2;
    for (let i = 0; i < N; i++) {
      const j = o + i;
      if (j < 0 || j >= outLen) continue;
      const p = start + i * pitch;
      const k = Math.floor(p);
      if (k < 0 || k + 1 >= x.length) continue;
      const fr = p - k;
      out[j] += win[i] * (x[k] + (x[k + 1] - x[k]) * fr);
      wsum[j] += win[i];
    }
  }
  for (let j = 0; j < outLen; j++) out[j] = wsum[j] > 1e-3 ? out[j] / Math.max(wsum[j], 0.35) : 0;
  return out;
}

function shaperCurve(amount) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return c;
}
function impulse(ctx, secs, decay, seed = 1) {
  const len = Math.round(ctx.sampleRate * secs);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (hr(i * 0.7 + ch * 9137 + seed) * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

/** Encode an AudioBuffer as a 16-bit PCM WAV file. */
export function encodeWav(buf) {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = clamp(chans[c][i], -1, 1);
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

/**
 * Render a voice effect offline. src is the encoded media (audio or video file); from/to pick
 * the part to use (seconds); speed > 1 also shortens it without changing the pitch (to match a
 * sped-up clip). Returns a WAV blob and its length in seconds.
 */
export async function changeVoice(src, preset, { from = 0, to = Infinity, speed = 1, onStep = () => {} } = {}) {
  const sr = 44100;
  onStep('Reading the sound…');
  const dec = await new OfflineAudioContext(1, 1, sr).decodeAudioData(src);
  const a = clamp(Math.floor(from * sr), 0, dec.length);
  const b = clamp(Math.floor((Number.isFinite(to) ? to : dec.duration) * sr), a + 1, dec.length);
  if (b - a < sr * 0.05) throw new Error('too short');
  const chs = Math.min(2, dec.numberOfChannels);
  onStep('Changing the voice…');
  await new Promise((r) => setTimeout(r, 0));
  const pitch = VOICE_PITCH[preset] || 1;
  let peakIn = 0;
  const chans = [];
  for (let c = 0; c < chs; c++) {
    let x = dec.getChannelData(c).slice(a, b);
    for (let i = 0; i < x.length; i++) peakIn = Math.max(peakIn, Math.abs(x[i]));
    if (pitch !== 1 || speed !== 1) x = grainShift(x, pitch, speed, sr);
    chans.push(x);
  }
  const len = chans[0].length;
  const ctx = new OfflineAudioContext(chs, len, sr);
  const buf = ctx.createBuffer(chs, len, sr);
  chans.forEach((x, c) => buf.copyToChannel(x, c));
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const filt = (type, f, q = 0.7, gain = 0) => {
    const n = ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.gain.value = gain;
    return n;
  };
  const shaper = (amt) => {
    const n = ctx.createWaveShaper();
    n.curve = shaperCurve(amt);
    n.oversample = '2x';
    return n;
  };
  const gain = (v) => {
    const n = ctx.createGain();
    n.gain.value = v;
    return n;
  };
  const chain = (...nodes) => {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  };
  switch (preset) {
    case 'chipmunk':
      chain(s, filt('highpass', 180), filt('highshelf', 4000, 0.7, 3), out);
      break;
    case 'deep':
      chain(s, filt('lowshelf', 220, 0.7, 5), filt('lowpass', 6000), out);
      break;
    case 'monster': {
      chain(s, shaper(6), filt('lowshelf', 160, 0.7, 7), filt('lowpass', 2600), gain(0.75), out);
      // a second voice an octave-ish lower for growl
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 30;
      const am = gain(0.5);
      const depth = gain(0.35);
      lfo.connect(depth).connect(am.gain);
      chain(s, filt('lowpass', 900), am, gain(0.5), out);
      lfo.start();
      break;
    }
    case 'robot': {
      // ring modulation plus a short metallic comb
      const ring = gain(0);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 60;
      osc.connect(ring.gain);
      osc.start();
      s.connect(ring);
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.011;
      const fb = gain(0.55);
      ring.connect(d);
      d.connect(fb).connect(d);
      const mix = gain(1);
      ring.connect(mix);
      d.connect(gain(0.6)).connect(mix);
      s.connect(gain(0.12)).connect(mix);
      chain(mix, filt('highpass', 120), gain(1.3), out);
      break;
    }
    case 'echo': {
      s.connect(out);
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.28;
      const fb = gain(0.42);
      s.connect(d);
      d.connect(filt('lowpass', 3500)).connect(fb).connect(d);
      d.connect(gain(0.55)).connect(out);
      break;
    }
    case 'telephone':
      chain(s, filt('highpass', 450, 0.9), filt('highpass', 450, 0.9), filt('lowpass', 3000, 0.9), filt('lowpass', 3000, 0.9), filt('peaking', 1600, 1, 6), shaper(3), gain(0.9), out);
      break;
    case 'megaphone':
      chain(s, filt('highpass', 650, 1), filt('lowpass', 3000, 1), filt('peaking', 1900, 1.4, 10), shaper(18), filt('lowpass', 4200), gain(0.55), out);
      break;
    case 'radio': {
      chain(s, filt('highpass', 320, 0.8), filt('lowpass', 3600, 0.8), filt('peaking', 1200, 0.8, 4), shaper(5), gain(0.85), out);
      // soft static
      const nb = ctx.createBuffer(1, len, sr);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = hr(i * 1.37) * 2 - 1;
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      chain(ns, filt('bandpass', 2500, 0.6), gain(0.035), out);
      ns.start();
      break;
    }
    case 'cave': {
      const conv = ctx.createConvolver();
      conv.buffer = impulse(ctx, 2.6, 3.2);
      s.connect(gain(0.75)).connect(out);
      const pre = ctx.createDelay(0.2);
      pre.delayTime.value = 0.04;
      chain(s, pre, conv, filt('lowpass', 4500), gain(0.55), out);
      break;
    }
    case 'underwater': {
      // muffled, wobbling (vibrato through a modulated delay) and a little bubbly
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.012;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 3.2;
      const depth = gain(0.004);
      lfo.connect(depth).connect(d.delayTime);
      lfo.start();
      const conv = ctx.createConvolver();
      conv.buffer = impulse(ctx, 0.6, 2, 7);
      const lp = chain(s, filt('lowpass', 520, 3), filt('lowpass', 900, 0.7), d);
      lp.connect(gain(1.4)).connect(out);
      lp.connect(conv).connect(gain(0.35)).connect(out);
      break;
    }
    default:
      s.connect(out);
  }
  s.start();
  const res = await ctx.startRendering();
  // match the loudness peak of the original (never clip)
  let peak = 0;
  for (let c = 0; c < res.numberOfChannels; c++) {
    const d = res.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const k = peak > 1e-4 ? Math.min(0.98, Math.max(peakIn, 0.3)) / peak : 1;
  if (Math.abs(k - 1) > 0.01) for (let c = 0; c < res.numberOfChannels; c++) {
    const d = res.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  onStep('Saving…');
  return { blob: encodeWav(res), duration: res.length / sr };
}
