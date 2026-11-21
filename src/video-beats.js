// Beat detection for music tracks: an onset envelope from spectral flux, the tempo from the
// envelope's autocorrelation, and a beat grid placed where it lines up best with the onsets
// (each beat then nudged onto a strong onset close to it).

const SR = 22050;
const N = 1024; // FFT size
const HOP = 256; // ~11.6 ms

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Remove the slowly moving mean (~0.4 s), keep the rises, scale to 0–1. */
function rises(env) {
  const n = env.length;
  const w = Math.round((0.4 * SR) / HOP);
  const pre = new Float64Array(n + 1);
  for (let f = 0; f < n; f++) pre[f + 1] = pre[f] + env[f];
  const out = new Float32Array(n);
  let peak = 0;
  for (let f = 0; f < n; f++) {
    const a = Math.max(0, f - w);
    const b = Math.min(n, f + w + 1);
    const v = env[f] - (pre[b] - pre[a]) / (b - a);
    out[f] = v > 0 ? v : 0;
    if (out[f] > peak) peak = out[f];
  }
  if (peak > 0) for (let f = 0; f < n; f++) out[f] /= peak;
  return out;
}

/**
 * Onset strength per hop: spectral flux on a log-magnitude spectrum, for the whole spectrum and
 * for the bass band only (kick drums), each mean-removed and scaled to 0–1.
 */
export function onsetEnvelope(x) {
  const frames = Math.max(0, Math.floor((x.length - N) / HOP) + 1);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const bins = N / 2;
  const lowBins = Math.ceil(LOW_HZ / (SR / N));
  let prev = new Float32Array(bins);
  let cur = new Float32Array(bins);
  const full = new Float32Array(frames);
  const low = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) {
      re[i] = x[o + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    let lf = 0;
    for (let k = 1; k < bins; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      cur[k] = m;
      const d = m - prev[k];
      if (d > 0) {
        flux += d;
        if (k <= lowBins) lf += d;
      }
    }
    full[f] = f ? flux : 0;
    low[f] = f ? lf : 0;
    [prev, cur] = [cur, prev];
  }
  return { full: rises(full), low: rises(low) };
}
const LOW_HZ = 180;

const frameTime = (f) => (f * HOP + N / 2) / SR;
const toBpm = (lag) => (60 * SR) / HOP / lag;
const prior = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 1.0, 2));

const sample = (env, x) => {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= env.length) return 0;
  return env[i] + (env[i + 1] - env[i]) * (x - i);
};
/** Strongest value within ±1 frame (beats rarely sit exactly on a hop). */
const near = (env, x) => Math.max(sample(env, x - 1), sample(env, x), sample(env, x + 1));

/** Autocorrelation of the envelope for lags up to maxLag. */
function autocorr(env, maxLag) {
  const n = env.length;
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag && lag < n; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += env[i] * env[i - lag];
    ac[lag] = s / (n - lag);
  }
  return ac;
}

/** Best phase (and a slightly refined period) for a period; score = mean on-grid strength. */
function fitGrid(env, P0) {
  let best = { score: -1, P: P0, phase: 0 };
  for (let dp = -0.015; dp <= 0.01501; dp += 0.0025) {
    const P = P0 * (1 + dp);
    for (let ph = 0; ph < P; ph += 0.5) {
      let s = 0;
      let n = 0;
      for (let t = ph; t < env.length; t += P) {
        s += near(env, t);
        n++;
      }
      s /= n || 1;
      if (s > best.score) best = { score: s, P, phase: ph };
    }
  }
  return best;
}
function gridMean(env, phase, P) {
  let s = 0;
  let n = 0;
  for (let t = phase; t < env.length; t += P) {
    s += near(env, t);
    n++;
  }
  return s / (n || 1);
}

/** Detect beats in a decoded mono signal at 22.05 kHz. Returns { bpm, beats: [seconds] }. */
export function beatsFromSignal(x) {
  const { full, low } = onsetEnvelope(x);
  const n = full.length;
  if (n < 50) return { bpm: 0, beats: [] };
  // kick drums mark the beat best, so they count double
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = (full[i] + 2 * low[i]) / 3;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  // 1) tempo candidates: autocorrelation peaks between 55 and 200 BPM, plus their simple ratios
  const minLag = Math.floor((60 / 200) * (SR / HOP));
  const maxLag = Math.ceil((60 / 55) * (SR / HOP));
  const ac = autocorr(env, maxLag + 2);
  const peaks = [];
  for (let lag = minLag; lag <= maxLag; lag++) if (ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) peaks.push([lag, ac[lag] * prior(toBpm(lag))]);
  peaks.sort((p, q) => q[1] - p[1]);
  const cands = new Set();
  for (const [lag] of peaks.slice(0, 4)) for (const k of [1, 2, 0.5, 1.5, 2 / 3]) {
    const L = lag * k;
    if (L >= minLag && L <= maxLag) cands.add(+L.toFixed(2));
  }
  if (!cands.size) return { bpm: 0, beats: [] };
  // 2) score each candidate by how strongly its best grid lines up with onsets
  let best = null;
  for (const L of cands) {
    const g = fitGrid(env, L);
    const score = (g.score - mean) * prior(toBpm(g.P));
    if (!best || score > best.score) best = { ...g, score };
  }
  let { P, phase } = best;
  // 3) octave check: if every other beat is much weaker, the beat is twice as slow
  const a = gridMean(full, phase, 2 * P);
  const b = gridMean(full, phase + P, 2 * P);
  if (Math.min(a, b) < 0.45 * Math.max(a, b) && toBpm(2 * P) >= 58) {
    phase = a >= b ? phase : phase + P;
    P *= 2;
  }
  // 4) the beat sits on kicks rather than off-beats: compare the grid with its half-beat shift
  const on = gridMean(low, phase, P) + gridMean(full, phase, P) * 0.5;
  const off = gridMean(low, phase + P / 2, P) + gridMean(full, phase + P / 2, P) * 0.5;
  let flipped = off > on * 1.15;
  if (Math.min(on, off) > 0.55 * Math.max(on, off)) {
    // too close to call: music almost always starts on a beat, so follow the first strong onset
    let first = -1;
    for (let i = 1; i < n - 1; i++) if (env[i] > 0.3 && env[i] >= env[i - 1] && env[i] >= env[i + 1]) { first = i; break; }
    if (first >= 0) {
      const d = (((first - phase) % P) + P) % P; // 0..P: distance after the grid
      const toGrid = Math.min(d, P - d);
      const toOff = Math.abs(d - P / 2);
      flipped = toOff < toGrid;
    }
  }
  if (flipped) phase += P / 2;
  while (phase >= P) phase -= P;
  const bpm = toBpm(P);
  const beats = [];
  const reach = Math.round(0.045 * (SR / HOP));
  for (let t = phase; t < n; t += P) {
    // nudge onto a strong onset nearby
    let bt = t;
    let bv = sample(env, t);
    for (let k = Math.floor(t) - reach; k <= Math.ceil(t) + reach; k++) {
      if (k < 1 || k >= n - 1) continue;
      const pk = env[k] >= env[k - 1] && env[k] >= env[k + 1];
      if (pk && env[k] > 0.3 && env[k] > bv * 1.5) {
        bv = env[k];
        bt = k;
      }
    }
    beats.push(+frameTime(bt).toFixed(3));
  }
  return { bpm: +bpm.toFixed(1), beats, info: { on: +on.toFixed(3), off: +off.toFixed(3), flipped, lowOn: +gridMean(low, phase, P).toFixed(3), lowOff: +gridMean(low, phase + P / 2, P).toFixed(3), fullOn: +gridMean(full, phase, P).toFixed(3), fullOff: +gridMean(full, phase + P / 2, P).toFixed(3) } };
}

/** Decode an audio (or video) file and find its beats. Times are seconds from the file start. */
export async function detectBeats(arrayBuffer) {
  const dec = await new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  const n = dec.length;
  const x = new Float32Array(n);
  for (let c = 0; c < dec.numberOfChannels; c++) {
    const d = dec.getChannelData(c);
    for (let i = 0; i < n; i++) x[i] += d[i] / dec.numberOfChannels;
  }
  await new Promise((r) => setTimeout(r, 0));
  return beatsFromSignal(x);
}

/** Beats of an audio track on the timeline (seconds), inside the part of the track that plays. */
export function trackBeats(a) {
  if (!a?.beats?.length) return [];
  return a.beats.filter((b) => b >= a.in - 1e-3 && b <= a.out + 1e-3).map((b) => a.start + (b - a.in));
}
