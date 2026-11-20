// Artvas Music — an original generative composer and sound-effect synth.
// Every track is composed and rendered in the browser (Web Audio), so it is royalty-free and
// yours to use anywhere. Each style defines tempo, scale, chord progression, groove and instruments;
// a seed makes endless variations.
import { encodeWav } from './tts.js';

const SR = 44100;
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
// 16-step drum grids: k=kick s=snare c=clap h=closed hat o=open hat t=tom r=rim
const GROOVES = {
  four: { k: [0, 4, 8, 12], c: [4, 12], h: [2, 6, 10, 14], o: [] },
  pop: { k: [0, 7, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  boombap: { k: [0, 7, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], swing: 0.12 },
  trap: { k: [0, 11], s: [8], h: [0, 2, 4, 6, 8, 10, 12, 13, 14, 15], halftime: true },
  funk: { k: [0, 3, 10], s: [4, 12], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], r: [7, 15] },
  dembow: { k: [0, 4, 8, 12], s: [3, 6, 11, 14], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  dnb: { k: [0, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  shuffle: { k: [0, 8], s: [4, 12], h: [0, 3, 4, 7, 8, 11, 12, 15], swing: 0.2 },
  brush: { k: [0, 10], r: [4, 12], h: [0, 3, 4, 7, 8, 11, 12, 15], swing: 0.22, soft: true },
  epic: { k: [0, 8, 10], t: [0, 6, 8, 12, 14], s: [12] },
  soft: { k: [0, 8], r: [12], h: [4, 12], soft: true },
  none: {},
};

export const MUSIC_STYLES = [
  { id: 'lofi', name: 'Lo-fi chill', mood: 'Relaxed · study', color: '#a78bfa', bpm: [76, 86], scale: 'dorian', prog: [[1, 7], [4, 7], [0, 7], [5, 7]], groove: 'boombap', inst: { keys: 'rhodes', bass: 'round', pad: 'warm' }, vinyl: true },
  { id: 'pop', name: 'Upbeat pop', mood: 'Happy · bright', color: '#f472b6', bpm: [116, 124], scale: 'major', prog: [[0], [4], [5], [3]], groove: 'pop', inst: { pluck: true, bass: 'pluck', pad: 'bright', lead: 'square' } },
  { id: 'hiphop', name: 'Hip-hop beat', mood: 'Cool · confident', color: '#f59e0b', bpm: [86, 94], scale: 'minor', prog: [[0, 7], [5, 7], [3, 7], [4]], groove: 'boombap', inst: { keys: 'rhodes', bass: 'sub' } },
  { id: 'trap', name: 'Trap', mood: 'Dark · hype', color: '#ef4444', bpm: [136, 145], scale: 'minor', prog: [[0], [5], [3], [4]], groove: 'trap', inst: { bell: true, bass: '808', pad: 'dark' } },
  { id: 'house', name: 'Dance / house', mood: 'Party · energy', color: '#06b6d4', bpm: [122, 126], scale: 'minor', prog: [[0, 7], [5, 7], [2, 7], [6, 7]], groove: 'four', inst: { stabs: true, bass: 'offbeat', arp: 'saw' } },
  { id: 'cinematic', name: 'Cinematic epic', mood: 'Epic · trailer', color: '#1e3a8a', bpm: [84, 92], scale: 'minor', prog: [[0], [5], [2], [6]], groove: 'epic', inst: { pad: 'strings', bass: 'sub', lead: 'brass' } },
  { id: 'corporate', name: 'Corporate inspire', mood: 'Positive · business', color: '#0ea5e9', bpm: [108, 116], scale: 'major', prog: [[0], [4], [5], [3]], groove: 'soft', inst: { piano: 'arp', pad: 'bright', bass: 'round' } },
  { id: 'ambient', name: 'Ambient calm', mood: 'Peaceful · spa', color: '#14b8a6', bpm: [64, 72], scale: 'lydian', prog: [[0, 7], [1], [0, 7], [4]], groove: 'none', inst: { pad: 'warm', bell: 'sparse' } },
  { id: 'sadpiano', name: 'Sad piano', mood: 'Emotional · reflective', color: '#64748b', bpm: [64, 72], scale: 'minor', prog: [[0], [5], [2], [6]], groove: 'none', inst: { piano: 'ballad', pad: 'dark' } },
  { id: 'ukulele', name: 'Happy strum', mood: 'Cheerful · family', color: '#facc15', bpm: [100, 110], scale: 'major', prog: [[0], [3], [4], [0]], groove: 'shuffle', inst: { strum: true, bass: 'round', whistle: true } },
  { id: 'synthwave', name: 'Synthwave', mood: 'Retro · night drive', color: '#d946ef', bpm: [98, 108], scale: 'minor', prog: [[0], [5], [3], [4]], groove: 'four', inst: { arp: 'saw', bass: 'eighths', pad: 'dark', lead: 'saw' } },
  { id: 'funk', name: 'Funk groove', mood: 'Groovy · fun', color: '#fb923c', bpm: [102, 110], scale: 'dorian', prog: [[0, 7], [3, 7], [0, 7], [4, 7]], groove: 'funk', inst: { stabs: true, bass: 'slap' } },
  { id: 'reggaeton', name: 'Reggaeton', mood: 'Latin · summer', color: '#22c55e', bpm: [90, 96], scale: 'minor', prog: [[0], [5], [2], [6]], groove: 'dembow', inst: { pluck: true, bass: 'sub' } },
  { id: 'dnb', name: 'Drum & bass', mood: 'Fast · sport', color: '#0f766e', bpm: [170, 174], scale: 'minor', prog: [[0], [5], [3], [6]], groove: 'dnb', inst: { pad: 'dark', bass: 'reese' } },
  { id: 'tension', name: 'Suspense', mood: 'Tense · mystery', color: '#334155', bpm: [78, 84], scale: 'phrygian', prog: [[0], [1], [0], [6]], groove: 'none', inst: { pulse: true, pad: 'dark', bell: 'sparse' } },
  { id: 'kids', name: 'Playful kids', mood: 'Cute · cartoon', color: '#fb7185', bpm: [118, 126], scale: 'major', prog: [[0], [3], [4], [0]], groove: 'pop', inst: { bell: 'melody', bass: 'pluck', pluck: true } },
  { id: 'christmas', name: 'Holiday bells', mood: 'Festive · warm', color: '#16a34a', bpm: [98, 106], scale: 'major', prog: [[0], [3], [4], [0]], groove: 'shuffle', inst: { bell: 'melody', piano: 'arp', bass: 'round', sleigh: true } },
  { id: 'jazz', name: 'Jazz lounge', mood: 'Classy · cafe', color: '#92400e', bpm: [86, 96], scale: 'major', prog: [[1, 7], [4, 7], [0, 7], [5, 7]], groove: 'brush', inst: { keys: 'rhodes', bass: 'walking' } },
  { id: 'vlog', name: 'Summer vlog', mood: 'Sunny · travel', color: '#f97316', bpm: [104, 112], scale: 'major', prog: [[0], [5], [3], [4]], groove: 'pop', inst: { pluck: true, bass: 'pluck', pad: 'bright', whistle: true } },
  { id: 'dreamy', name: 'Dreamy pop', mood: 'Soft · romantic', color: '#c084fc', bpm: [84, 92], scale: 'major', prog: [[0, 7], [2, 7], [3, 7], [4]], groove: 'soft', inst: { pad: 'warm', pluck: true, bell: 'sparse' } },
];

export const SFX = [
  { id: 'whoosh', name: 'Whoosh' }, { id: 'swoosh', name: 'Swoosh up' }, { id: 'pop', name: 'Pop' }, { id: 'ding', name: 'Ding' },
  { id: 'notify', name: 'Notification' }, { id: 'click', name: 'Click' }, { id: 'shutter', name: 'Camera' }, { id: 'boom', name: 'Boom' },
  { id: 'riser', name: 'Riser' }, { id: 'glitch', name: 'Glitch' }, { id: 'coin', name: 'Coin' }, { id: 'success', name: 'Success' },
  { id: 'error', name: 'Error buzz' }, { id: 'laser', name: 'Laser' }, { id: 'heartbeat', name: 'Heartbeat' }, { id: 'typing', name: 'Typing' },
  { id: 'drumroll', name: 'Drum roll' }, { id: 'bubble', name: 'Bubble' }, { id: 'swipe', name: 'Swipe' }, { id: 'tada', name: 'Ta-da!' },
];

// ---------- helpers ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, secs = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function reverb(ctx, secs = 2.4, decay = 2.5) {
  const len = ctx.sampleRate * secs;
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const conv = ctx.createConvolver();
  conv.buffer = b;
  return conv;
}

function env(g, t, a, d, peak, sustain = 0, rel = 0.05, end) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  if (end != null) {
    g.gain.setTargetAtTime(Math.max(0.0001, peak * sustain), t + a, d / 3);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// ---------- instruments ----------
function makeKit(ctx, out, noise) {
  const N = (t, dur, type, freq, q = 1, gain = 0.4) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, 0.002, dur, gain);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  };
  const T = (t, f0, f1, dur, gain, type = 'sine') => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    const g = ctx.createGain();
    env(g, t, 0.003, dur, gain);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  return {
    k: (t, v = 1) => T(t, 150, 42, 0.32, 0.95 * v),
    s: (t, v = 1) => { N(t, 0.18, 'highpass', 1200, 0.7, 0.42 * v); T(t, 220, 160, 0.1, 0.25 * v, 'triangle'); },
    c: (t, v = 1) => { for (let i = 0; i < 3; i++) N(t + i * 0.011, 0.09 + i * 0.03, 'bandpass', 1400, 1.2, 0.35 * v); },
    h: (t, v = 1) => N(t, 0.04, 'highpass', 8000, 0.7, 0.16 * v),
    o: (t, v = 1) => N(t, 0.28, 'highpass', 7000, 0.7, 0.14 * v),
    r: (t, v = 1) => { N(t, 0.05, 'bandpass', 2500, 4, 0.3 * v); T(t, 820, 780, 0.04, 0.1 * v, 'square'); },
    t: (t, v = 1) => T(t, 130, 70, 0.6, 0.8 * v),
    shaker: (t, v = 1) => N(t, 0.06, 'bandpass', 6000, 1.5, 0.12 * v),
    crackle: (t) => N(t, 0.006, 'highpass', 3000, 1, 0.18),
  };
}

function voice(ctx, out, { t, midi, dur, type = 'sawtooth', gain = 0.12, cutoff = 2000, q = 1, a = 0.01, d = 0.3, sustain = 0.6, rel = 0.15, detune = 0, sweep = 0, glide = 0, pan = 0 }) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * sweep), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, d, gain, sustain, rel, t + dur);
  let node = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  node.connect(out);
  f.connect(g);
  const oscs = detune ? [-detune, detune] : [0];
  for (const dt of oscs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(mtof(midi) * (glide ? 2 : 1), t);
    if (glide) o.frequency.exponentialRampToValueAtTime(mtof(midi), t + glide);
    o.detune.value = dt;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + rel + 0.1);
  }
}
function piano(ctx, out, t, midi, dur, gain = 0.16) {
  // additive tone with fast-decaying upper partials
  [1, 2, 3, 4].forEach((h, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(midi) * h;
    const g = ctx.createGain();
    env(g, t, 0.004, Math.min(2.5, dur + 1) / (i + 1), gain / (i * 1.6 + 1));
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 3);
  });
}
function bell(ctx, out, t, midi, gain = 0.1) {
  [[1, 1], [2.76, 0.4], [5.4, 0.2]].forEach(([r, a]) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(midi) * r;
    const g = ctx.createGain();
    env(g, t, 0.002, 1.6 / r, gain * a);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 2);
  });
}

// ---------- composer ----------
/** Render a music track. Returns { blob (WAV), duration }. */
export async function renderMusic(styleId, { duration = 30, seed = 1, bpm } = {}) {
  const st = MUSIC_STYLES.find((s) => s.id === styleId) || MUSIC_STYLES[0];
  const R = rng(seed * 7919 + styleId.length * 131);
  const tempo = bpm || Math.round(st.bpm[0] + R() * (st.bpm[1] - st.bpm[0]));
  const beat = 60 / tempo;
  const step = beat / 4;
  const bar = beat * 4;
  const len = Math.max(4, duration);
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * (len + 0.5)), SR);
  const noise = noiseBuffer(ctx);
  // master: bus -> compressor -> fade -> out ; reverb send
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.4);
  master.gain.setValueAtTime(0.9, Math.max(0.5, len - 2.5));
  master.gain.linearRampToValueAtTime(0.0001, len);
  comp.connect(master).connect(ctx.destination);
  const bus = ctx.createGain();
  bus.connect(comp);
  const rv = reverb(ctx);
  const rvGain = ctx.createGain();
  rvGain.gain.value = st.groove === 'none' || st.id === 'cinematic' ? 0.45 : 0.22;
  rv.connect(rvGain).connect(comp);
  const wet = ctx.createGain();
  wet.connect(bus);
  wet.connect(rv);
  const drums = ctx.createGain();
  drums.gain.value = GROOVES[st.groove]?.soft ? 0.55 : 0.9;
  drums.connect(bus);
  const kit = makeKit(ctx, drums, noise);

  const scale = SCALES[st.scale];
  const root = 48 + Math.floor(R() * 7) - 2; // around C3
  const deg = (d, oct = 0) => root + scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
  const chordNotes = ([d, ext]) => [deg(d), deg(d + 2), deg(d + 4), ...(ext ? [deg(d + 6)] : [])];
  const groove = GROOVES[st.groove] || {};
  const bars = Math.ceil(len / bar);
  const introBars = st.groove === 'none' ? 0 : 1;
  // motif for lead/bell melody (2 bars, 8th notes), repeated with variation
  const motif = Array.from({ length: 16 }, () => (R() < 0.62 ? Math.floor(R() * 7) + (R() < 0.3 ? 7 : 0) : null));
  const arpPattern = [0, 1, 2, 1, 2, 3, 2, 1].map((x) => (R() < 0.15 ? (x + 1) % 4 : x));
  const I = st.inst;

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    if (t0 > len) break;
    const chord = st.prog[b % st.prog.length];
    const notes = chordNotes(chord);
    const intro = b < introBars;
    const breakdown = bars > 10 && b % 8 === 6;
    const lastBars = b >= bars - 1;
    // ---- drums
    if (!intro && !breakdown && st.groove !== 'none') {
      const sw = groove.swing || 0;
      for (let s = 0; s < 16; s++) {
        const tt = t0 + s * step + (s % 2 ? sw * step : 0);
        const hv = 0.7 + R() * 0.3;
        if (groove.k?.includes(s)) kit.k(tt);
        if (groove.s?.includes(s)) kit.s(tt);
        if (groove.c?.includes(s)) kit.c(tt);
        if (groove.h?.includes(s)) kit.h(tt, hv);
        if (groove.o?.includes(s)) kit.o(tt);
        if (groove.r?.includes(s)) kit.r(tt);
        if (groove.t?.includes(s)) kit.t(tt, 0.9);
        if (st.groove === 'trap' && s === 14 && R() < 0.5) for (let r = 0; r < 4; r++) kit.h(tt + (r * step) / 4, 0.6);
        if (I.sleigh && s % 2 === 0) kit.shaker(tt, 0.8);
      }
      if (b % 4 === 3 && st.groove !== 'trap') kit.s(t0 + 15 * step, 0.6);
    }
    if (st.vinyl) for (let i = 0; i < 6; i++) kit.crackle(t0 + R() * bar);
    // ---- pad / chords
    if (I.pad) {
      const type = I.pad === 'bright' ? 'sawtooth' : I.pad === 'strings' ? 'sawtooth' : 'triangle';
      const cutoff = { warm: 900, bright: 2200, dark: 600, strings: 1600 }[I.pad];
      notes.forEach((m, i) => voice(ctx, wet, { t: t0, midi: m + 12, dur: bar * 0.98, type, gain: 0.045, cutoff, a: I.pad === 'strings' ? 0.6 : 0.35, d: 1, sustain: 0.8, rel: 0.6, detune: 9, pan: (i - 1.5) * 0.3 }));
    }
    if (I.keys === 'rhodes') {
      const hits = st.groove === 'brush' ? [0, 6, 10] : [0, 7];
      hits.forEach((h) => notes.forEach((m) => voice(ctx, wet, { t: t0 + h * step, midi: m + 12, dur: step * 5, type: 'triangle', gain: 0.06, cutoff: 1800, a: 0.005, d: 0.8, sustain: 0.3, rel: 0.3 })));
    }
    if (I.stabs && !intro) [2, 6, 10, 14].forEach((h) => R() < 0.85 && notes.forEach((m) => voice(ctx, wet, { t: t0 + h * step, midi: m + 12, dur: step * 0.8, type: 'sawtooth', gain: 0.045, cutoff: 2600, a: 0.003, d: 0.12, sustain: 0.1, rel: 0.05 })));
    if (I.strum) [0, 3, 6, 8, 11, 14].forEach((h, k) => notes.forEach((m, i) => voice(ctx, wet, { t: t0 + h * step + i * 0.012, midi: m + 12, dur: step * 1.6, type: 'triangle', gain: k % 2 ? 0.035 : 0.05, cutoff: 3000, a: 0.002, d: 0.25, sustain: 0.1, rel: 0.1 })));
    if (I.piano) {
      if (I.piano === 'ballad') {
        piano(ctx, wet, t0, notes[0] - 12, bar);
        [0, 2, 1, 2].forEach((ni, k) => piano(ctx, wet, t0 + k * beat, notes[ni] + 12, beat, 0.11));
        const mm = motif[(b * 2) % 16];
        if (mm != null && b >= 1) piano(ctx, wet, t0 + beat * 2.5, deg(mm, 2), beat * 1.5, 0.12);
      } else for (let k = 0; k < 8; k++) piano(ctx, wet, t0 + k * step * 2, notes[arpPattern[k] % notes.length] + 12, step * 2, 0.07);
    }
    if (I.pluck && !intro) for (let k = 0; k < 8; k++) if (R() < 0.7) voice(ctx, wet, { t: t0 + k * step * 2, midi: notes[arpPattern[k] % notes.length] + 24, dur: step * 1.2, type: 'square', gain: 0.03, cutoff: 2400, sweep: 0.3, a: 0.002, d: 0.15, sustain: 0.05, rel: 0.05, pan: (k % 2 ? 0.3 : -0.3) });
    if (I.arp && !intro) for (let k = 0; k < 16; k++) voice(ctx, wet, { t: t0 + k * step, midi: notes[(arpPattern[k % 8] + (k > 7 ? 1 : 0)) % notes.length] + 24, dur: step * 0.9, type: 'sawtooth', gain: 0.026, cutoff: 1400 + 900 * Math.sin((b * 16 + k) / 12), a: 0.002, d: 0.1, sustain: 0.2, rel: 0.04 });
    if (I.pulse) for (let k = 0; k < 8; k++) voice(ctx, wet, { t: t0 + k * step * 2, midi: notes[0], dur: step * 1.2, type: 'sawtooth', gain: 0.04, cutoff: 500, a: 0.005, d: 0.2, sustain: 0.2 });
    // ---- bass
    if (I.bass && !intro) {
      const r = notes[0] - 12;
      const B = (s, m, d, o = {}) => voice(ctx, bus, { t: t0 + s * step, midi: m, dur: d * step, type: 'sawtooth', gain: 0.11, cutoff: 420, a: 0.005, d: 0.2, sustain: 0.7, rel: 0.06, ...o });
      switch (I.bass) {
        case 'sub': [0, 7, 10].forEach((s) => B(s, r - 12, 3, { type: 'sine', gain: 0.22, cutoff: 300 })); break;
        case '808': B(0, r - 12, 10, { type: 'sine', gain: 0.3, cutoff: 260, glide: 0.06, sustain: 0.8 }); B(11, r - 12, 5, { type: 'sine', gain: 0.25, cutoff: 260 }); break;
        case 'offbeat': [2, 6, 10, 14].forEach((s) => B(s, r, 1.6, { cutoff: 700, gain: 0.12 })); break;
        case 'eighths': for (let s = 0; s < 16; s += 2) B(s, r + (s === 14 ? 12 : 0), 1.8, { cutoff: 600 }); break;
        case 'pluck': [0, 3, 6, 8, 11, 14].forEach((s) => B(s, r, 1.5, { cutoff: 900, sweep: 0.4 })); break;
        case 'slap': [0, 3, 6, 7, 10, 13].forEach((s, i) => B(s, r + (i === 3 ? 12 : i === 5 ? 7 : 0), 1, { type: 'square', cutoff: 1200, sweep: 0.3, gain: 0.08 })); break;
        case 'reese': B(0, r, 16, { detune: 18, cutoff: 500, gain: 0.1, sustain: 0.9 }); break;
        case 'walking': [0, 4, 8, 12].forEach((s, i) => B(s, [r, deg(chord[0] + 2) - 12, deg(chord[0] + 4) - 12, deg(chord[0] + 5) - 12][i], 3.5, { type: 'triangle', cutoff: 800, gain: 0.16 })); break;
        default: [0, 8].forEach((s) => B(s, r, 7, { type: 'triangle', cutoff: 500, gain: 0.18 }));
      }
    }
    // ---- melody (lead / bell / whistle)
    const melodyOn = !intro && !breakdown && (b % 8 >= 2 || st.groove === 'none');
    if (melodyOn && (I.lead || I.bell || I.whistle)) {
      for (let k = 0; k < 8; k++) {
        const m = motif[((b % 2) * 8 + k) % 16];
        if (m == null) continue;
        const note = deg(m + (b % 4 === 3 && k > 5 ? 1 : 0), 2);
        const tt = t0 + k * step * 2;
        if (I.bell === 'melody' || (I.bell === true && st.id === 'trap')) bell(ctx, wet, tt, note + (st.id === 'trap' ? 0 : 12), 0.09);
        else if (I.bell === 'sparse' && R() < 0.35) bell(ctx, wet, tt, note + 12, 0.06);
        if (I.lead) voice(ctx, wet, { t: tt, midi: note, dur: step * 1.8, type: I.lead === 'square' ? 'square' : I.lead === 'brass' ? 'sawtooth' : 'sawtooth', gain: I.lead === 'brass' ? 0.05 : 0.035, cutoff: I.lead === 'brass' ? 1400 : 2500, a: I.lead === 'brass' ? 0.06 : 0.01, d: 0.3, sustain: 0.6, rel: 0.1 });
        if (I.whistle && b % 4 >= 2) voice(ctx, wet, { t: tt, midi: note + 12, dur: step * 1.6, type: 'sine', gain: 0.05, cutoff: 5000, a: 0.03, d: 0.2, sustain: 0.8, rel: 0.12 });
      }
    }
    if (lastBars && st.id === 'cinematic') kit.t(t0 + bar - beat, 1);
  }
  const buf = await ctx.startRendering();
  const chans = [buf.getChannelData(0).slice(0, Math.ceil(SR * len)), buf.getChannelData(1).slice(0, Math.ceil(SR * len))];
  // normalise
  let peak = 0;
  for (const c of chans) for (let i = 0; i < c.length; i += 8) peak = Math.max(peak, Math.abs(c[i]));
  const k = peak > 0 ? Math.min(3, 0.89 / peak) : 1;
  if (k !== 1) for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= k;
  return { blob: encodeWav(chans, SR), duration: len, bpm: tempo };
}

/** Render a short sound effect. Returns { blob, duration }. */
export async function renderSfx(id) {
  const durMap = { riser: 2.2, drumroll: 2, heartbeat: 1.6, typing: 1.4, tada: 1.6, boom: 1.6, success: 1.1 };
  const dur = durMap[id] || 0.9;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const noise = noiseBuffer(ctx);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  const kit = makeKit(ctx, out, noise);
  const sweepNoise = (t, d, f0, f1, type = 'bandpass', gain = 0.5, q = 2) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + d + 0.05);
  };
  const tone = (t, f0, f1, d, type = 'sine', gain = 0.3) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    const g = ctx.createGain();
    env(g, t, 0.004, d, gain);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
  };
  switch (id) {
    case 'whoosh': sweepNoise(0, 0.7, 300, 3000, 'bandpass', 0.7, 1.2); break;
    case 'swoosh': sweepNoise(0, 0.5, 600, 7000, 'bandpass', 0.6, 3); break;
    case 'swipe': sweepNoise(0, 0.25, 2000, 6000, 'highpass', 0.5, 1); break;
    case 'pop': tone(0, 900, 180, 0.09, 'sine', 0.6); break;
    case 'bubble': [0, 0.12, 0.2].forEach((t, i) => tone(t, 400 + i * 180, 1200 + i * 200, 0.08, 'sine', 0.35)); break;
    case 'ding': bell(ctx, out, 0, 88, 0.4); break;
    case 'notify': bell(ctx, out, 0, 84, 0.3); bell(ctx, out, 0.13, 91, 0.3); break;
    case 'success': [72, 76, 79, 84].forEach((m, i) => bell(ctx, out, i * 0.09, m + 12, 0.25)); break;
    case 'tada': [60, 64, 67].forEach((m) => voice(ctx, out, { t: 0, midi: m + 12, dur: 0.12, type: 'sawtooth', gain: 0.1, cutoff: 3000 })); [60, 64, 67, 72].forEach((m) => voice(ctx, out, { t: 0.18, midi: m + 12, dur: 1, type: 'sawtooth', gain: 0.09, cutoff: 3000, sustain: 0.7, rel: 0.4 })); kit.c(0.18); break;
    case 'click': kit.r(0); break;
    case 'shutter': kit.r(0); sweepNoise(0.01, 0.12, 4000, 1500, 'bandpass', 0.6, 2); kit.r(0.14); break;
    case 'boom': tone(0, 120, 30, 1.4, 'sine', 1); sweepNoise(0, 0.6, 2000, 100, 'lowpass', 0.8, 0.5); break;
    case 'riser': sweepNoise(0, 2.1, 200, 9000, 'bandpass', 0.6, 4); tone(0, 110, 880, 2.1, 'sawtooth', 0.06); break;
    case 'glitch': for (let i = 0; i < 9; i++) tone(i * 0.07, 200 + Math.random() * 2000, 100 + Math.random() * 3000, 0.05, 'square', 0.15); break;
    case 'coin': tone(0, 988, 988, 0.08, 'square', 0.15); tone(0.08, 1318, 1318, 0.3, 'square', 0.15); break;
    case 'error': tone(0, 140, 130, 0.35, 'sawtooth', 0.25); tone(0.4, 130, 120, 0.35, 'sawtooth', 0.25); break;
    case 'laser': tone(0, 1800, 120, 0.35, 'sawtooth', 0.2); break;
    case 'heartbeat': [0, 0.22, 0.8, 1.02].forEach((t) => kit.k(t, 0.8)); break;
    case 'typing': for (let i = 0; i < 12; i++) kit.r(i * 0.11 + Math.random() * 0.04); break;
    case 'drumroll': for (let i = 0; i < 30; i++) kit.s(i * 0.055, 0.3 + (i / 30) * 0.6); kit.c(1.7); break;
  }
  const buf = await ctx.startRendering();
  return { blob: encodeWav([buf.getChannelData(0), buf.getChannelData(1)], SR), duration: dur };
}
