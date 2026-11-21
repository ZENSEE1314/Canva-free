// Artvas Video — a timeline video editor that lives next to the design editor.
// Clips play in sequence on the main track; text, stickers and images float on overlay tracks;
// music and voice-overs sit on audio tracks. Everything is drawn into one canvas, which is also
// what gets recorded on export (with the mixed audio).
import './video-extra.css';
import { saveDesign, getMedia, saveMedia, uid } from './storage.js';
import { videoMime } from './animate.js';
import { loadPack, flatSrc, PACK_CATS } from './library.js';
import { FONTS } from './data.js';
import { getKey, AI_MODELS, AI_STYLES, VIDEO_MODELS, closestRatio, generateImage, generateVideo, toDataURL } from './ai.js';
import { VIDEO_TEMPLATES, TEMPLATE_CATS as VT_CATS, buildFromTemplate, templateDuration } from './videotemplates.js';
import { transcribeMedia, scriptToLines } from './captions.js';
import { MUSIC_STYLES, SFX, renderMusic, renderSfx } from './music.js';
import { VOICES, speak, ONLINE_LANGS, speakOnline, faceFor } from './tts.js';
import { fontsIn } from './fonts.js';
import { VIDEO_FX, BODY_FX, FX_CATS, COLOR_FX, fxName, applyVideoFx, applyBodyFx, segmentCanvas, loadSegmenter, segState, fxThumb, loadFxSamples, fxSamplesReady, drawSample, drawFxFrame, bindCardPreview, layerCanvas, MASKS, maskIcon, DEFAULT_MASK, isMasked, maskLayer, strokeMaskGuide, BLEND_MODES, blendOp, LOOK_KEYS, hasLook, applyLook, VOICE_FX, voiceName, changeVoice } from './vfx.js';
import { needsSite, inPreview as IN_PREVIEW } from './env.js';
import { SPEED_CURVES, curveName, hasCurve, videoLen, srcTime, srcRate, avgSpeed, curveFactor, subCurve, flatCurve, curveThumb, mountCurveEditor } from './video-speed.js';
import { reverseSupport, reverseVideo } from './video-reverse.js';
import { detectBeats, trackBeats } from './video-beats.js';
import { STAB_LEVELS, analyseMotion, corrections as stabCorrections, stabAt } from './video-stabilize.js';
import { renderStockVideos, renderStockMusic, stopStockPreview, creditLine } from './video-stock.js';

export const VIDEO_PRESETS = [
  { id: 'tiktok', name: 'TikTok', w: 1080, h: 1920, color: '#111111', hint: '9:16 · up to 10 min' },
  { id: 'reels', name: 'Instagram Reels', w: 1080, h: 1920, color: '#e1306c', hint: '9:16 · up to 90 s' },
  { id: 'xhs', name: 'Xiaohongshu (RED)', w: 1080, h: 1440, color: '#ff2442', hint: '3:4 · notes & videos' },
  { id: 'fbreel', name: 'Facebook Reels', w: 1080, h: 1920, color: '#1877f2', hint: '9:16' },
  { id: 'fbfeed', name: 'Facebook feed video', w: 1080, h: 1350, color: '#1877f2', hint: '4:5' },
  { id: 'ytshorts', name: 'YouTube Shorts', w: 1080, h: 1920, color: '#ff0000', hint: '9:16 · up to 60 s' },
  { id: 'youtube', name: 'YouTube video', w: 1920, h: 1080, color: '#ff0000', hint: '16:9 · HD' },
  { id: 'square', name: 'Square video', w: 1080, h: 1080, color: '#7c3aed', hint: '1:1' },
];

// Every other screen size people ask for: real phone screens, 4K, cinematic, classic ratios.
export const SCREEN_SIZES = [
  { group: 'Phone full screen', name: 'Phone 19.5:9 (most iPhones & Androids)', w: 1080, h: 2340 },
  { group: 'Phone full screen', name: 'iPhone 15 / 16', w: 1179, h: 2556 },
  { group: 'Phone full screen', name: 'iPhone Pro Max', w: 1290, h: 2796 },
  { group: 'Phone full screen', name: 'Android 20:9', w: 1080, h: 2400 },
  { group: 'Phone full screen', name: 'Android QHD+', w: 1440, h: 3200 },
  { group: 'Portrait', name: 'Vertical 9:16 HD', w: 720, h: 1280 },
  { group: 'Portrait', name: 'Vertical 9:16 Full HD', w: 1080, h: 1920 },
  { group: 'Portrait', name: 'Vertical 4K', w: 2160, h: 3840 },
  { group: 'Portrait', name: 'Portrait 4:5', w: 1080, h: 1350 },
  { group: 'Portrait', name: 'Portrait 3:4', w: 1080, h: 1440 },
  { group: 'Portrait', name: 'Portrait 2:3', w: 1080, h: 1620 },
  { group: 'Square', name: 'Square 1:1', w: 1080, h: 1080 },
  { group: 'Landscape', name: 'HD 720p', w: 1280, h: 720 },
  { group: 'Landscape', name: 'Full HD 1080p', w: 1920, h: 1080 },
  { group: 'Landscape', name: '4K UHD', w: 3840, h: 2160 },
  { group: 'Landscape', name: 'Cinematic 21:9', w: 2560, h: 1080 },
  { group: 'Landscape', name: 'Classic 4:3', w: 1440, h: 1080 },
  { group: 'Landscape', name: 'Phone landscape 19.5:9', w: 2340, h: 1080 },
];
export const ALL_VIDEO_SIZES = [...VIDEO_PRESETS.map((p) => ({ group: 'Platforms', name: p.name, w: p.w, h: p.h })), ...SCREEN_SIZES];

// Starter layouts: text/sticker overlays ready for the user's clips.
export const VIDEO_STARTERS = [
  { id: 'hook', name: 'Hook + captions', overlays: [
    { type: 'text', text: 'Wait for the end 😳', font: 'Anton', weight: 'normal', size: 0.09, color: '#ffffff', stroke: '#000000', x: 0.5, y: 0.2, start: 0, dur: 3, animIn: 'pop', animOut: 'fade' },
    { type: 'text', text: 'Your caption here', font: 'DM Sans', weight: '700', size: 0.045, color: '#111111', bg: '#ffffff', x: 0.5, y: 0.78, start: 0.5, dur: 4, animIn: 'up', animOut: 'fade' },
  ] },
  { id: 'vlog', name: 'Vlog intro', overlays: [
    { type: 'text', text: 'a day in my life', font: 'Instrument Serif', weight: 'normal', italic: true, size: 0.1, color: '#ffffff', shadow: true, x: 0.5, y: 0.45, start: 0, dur: 3.5, animIn: 'fade', animOut: 'fade' },
    { type: 'text', text: 'VLOG 01', font: 'DM Sans', weight: '700', size: 0.035, color: '#111111', bg: '#ffffff', x: 0.5, y: 0.55, start: 0.4, dur: 3.1, animIn: 'up', animOut: 'fade' },
  ] },
  { id: 'product', name: 'Product promo', overlays: [
    { type: 'text', text: 'NEW DROP', font: 'Unbounded', weight: '900', size: 0.08, color: '#111111', bg: '#facc15', x: 0.5, y: 0.15, start: 0, dur: 2.5, animIn: 'pop', animOut: 'pop' },
    { type: 'text', text: '50% OFF\nTODAY ONLY', font: 'Anton', weight: 'normal', size: 0.1, color: '#ffffff', stroke: '#000000', x: 0.5, y: 0.5, start: 2.5, dur: 2.5, animIn: 'zoom', animOut: 'fade' },
    { type: 'text', text: 'Link in bio 👆', font: 'DM Sans', weight: '700', size: 0.045, color: '#ffffff', bg: '#ef4444', x: 0.5, y: 0.82, start: 5, dur: 2.5, animIn: 'up', animOut: 'fade' },
  ] },
  { id: 'tutorial', name: 'How-to steps', overlays: [
    { type: 'text', text: 'How to ___ in 3 steps', font: 'Bricolage Grotesque', weight: '800', size: 0.07, color: '#ffffff', shadow: true, x: 0.5, y: 0.18, start: 0, dur: 2.5, animIn: 'pop', animOut: 'fade' },
    { type: 'text', text: '1. First step', font: 'DM Sans', weight: '700', size: 0.05, color: '#ffffff', bg: '#7c3aed', x: 0.5, y: 0.8, start: 2.5, dur: 2.5, animIn: 'left', animOut: 'fade' },
    { type: 'text', text: '2. Second step', font: 'DM Sans', weight: '700', size: 0.05, color: '#ffffff', bg: '#7c3aed', x: 0.5, y: 0.8, start: 5, dur: 2.5, animIn: 'left', animOut: 'fade' },
    { type: 'text', text: '3. Done! ✅', font: 'DM Sans', weight: '700', size: 0.05, color: '#ffffff', bg: '#10b981', x: 0.5, y: 0.8, start: 7.5, dur: 2.5, animIn: 'pop', animOut: 'fade' },
  ] },
  { id: 'xhsnote', name: 'RED note cover', overlays: [
    { type: 'text', text: '3 places you must try', font: 'Bricolage Grotesque', weight: '800', size: 0.08, color: '#ffffff', bg: '#ff2442', x: 0.5, y: 0.2, start: 0, dur: 4, animIn: 'pop', animOut: 'fade' },
    { type: 'text', text: 'save this for later ✨', font: 'Caveat', weight: '700', size: 0.07, color: '#ffffff', shadow: true, x: 0.5, y: 0.85, start: 0.6, dur: 3.4, animIn: 'fade', animOut: 'fade' },
  ] },
  { id: 'quote', name: 'Quote / lyrics', overlays: [
    { type: 'text', text: 'small steps\nevery day', font: 'Instrument Serif', weight: 'normal', italic: true, size: 0.1, color: '#ffffff', shadow: true, x: 0.5, y: 0.5, start: 0, dur: 5, animIn: 'type', animOut: 'fade' },
  ] },
];
export function applyStarter(project, starterId) {
  const st = VIDEO_STARTERS.find((s) => s.id === starterId);
  if (!st) return project;
  project.overlays = st.overlays.map((o) => ({ id: uid(), opacity: 1, align: 'center', ...o }));
  project.name = `${project.name} — ${st.name}`;
  return project;
}

export function newVideoProject(w, h, name) {
  return { id: uid(), kind: 'video', name: name || 'Untitled video', width: w, height: h, bg: '#000000', clips: [], overlays: [], audio: [], effects: [], mediaIds: [], updatedAt: Date.now() };
}

const FILTERS = [
  { id: 'none', label: 'Original', f: {} },
  { id: 'vivid', label: 'Vivid', f: { saturate: 1.45, contrast: 1.1 } },
  { id: 'warm', label: 'Warm', f: { sepia: 0.25, saturate: 1.2, brightness: 1.03 } },
  { id: 'cool', label: 'Cool', f: { hue: -12, saturate: 1.1, brightness: 1.02 } },
  { id: 'bw', label: 'B&W', f: { grayscale: 1, contrast: 1.15 } },
  { id: 'vintage', label: 'Vintage', f: { sepia: 0.45, contrast: 0.9, brightness: 1.05, saturate: 0.85 } },
  { id: 'fade', label: 'Faded', f: { contrast: 0.8, brightness: 1.1, saturate: 0.8 } },
  { id: 'drama', label: 'Dramatic', f: { contrast: 1.35, brightness: 0.92, saturate: 1.1 } },
  // temp / tint / fade / vignette are drawn as colour layers (see applyLook in vfx.js)
  { id: 'warmfilm', label: 'Warm film', f: { sepia: 0.18, contrast: 0.95, saturate: 1.05, temp: 0.35, fade: 0.25 } },
  { id: 'coolblue', label: 'Cool blue', f: { saturate: 0.95, brightness: 1.02, temp: -0.55 } },
  { id: 'tealorange', label: 'Teal & orange', f: { contrast: 1.12, saturate: 1.2, temp: 0.25, tint: -0.25, hue: -6 } },
  { id: 'golden', label: 'Golden hour', f: { brightness: 1.05, saturate: 1.25, sepia: 0.12, temp: 0.6, vignette: 0.25 } },
  { id: 'moody', label: 'Moody', f: { brightness: 0.88, contrast: 1.15, saturate: 0.7, temp: -0.2, vignette: 0.55 } },
  { id: 'matte', label: 'Fade matte', f: { contrast: 0.88, saturate: 0.85, fade: 0.6 } },
  { id: 'noir', label: 'Noir', f: { grayscale: 1, contrast: 1.5, brightness: 0.9, vignette: 0.6 } },
  { id: 'highkey', label: 'High key', f: { brightness: 1.25, contrast: 0.85, saturate: 0.9, fade: 0.15 } },
  { id: 'lowkey', label: 'Low key', f: { brightness: 0.75, contrast: 1.35, saturate: 0.9, vignette: 0.45 } },
  { id: 'pastel', label: 'Pastel', f: { brightness: 1.1, contrast: 0.85, saturate: 0.7, tint: 0.15, fade: 0.35 } },
  { id: 'pop', label: 'Vivid pop', f: { saturate: 1.8, contrast: 1.2, brightness: 1.03 } },
  { id: 'sunset', label: 'Sunset', f: { saturate: 1.3, hue: -10, temp: 0.5, tint: 0.3 } },
  { id: 'forest', label: 'Forest', f: { saturate: 1.15, hue: 8, contrast: 1.05, tint: -0.4, temp: -0.1 } },
  { id: 'rose', label: 'Rose', f: { saturate: 1.05, brightness: 1.05, tint: 0.5, temp: 0.15 } },
  { id: 'retro70', label: 'Retro 70s', f: { sepia: 0.35, saturate: 1.3, contrast: 0.9, temp: 0.3, fade: 0.4, hue: -8 } },
  { id: 'cyber', label: 'Cyber', f: { saturate: 1.5, contrast: 1.2, hue: 15, temp: -0.5, tint: 0.45 } },
  { id: 'chrome', label: 'Chrome', f: { saturate: 0.6, contrast: 1.3, brightness: 1.05, temp: -0.15 } },
  { id: 'cinema', label: 'Cinematic', f: { contrast: 1.18, saturate: 0.9, temp: 0.1, tint: -0.12, fade: 0.15, vignette: 0.4 } },
];
/** Look values (temperature, tint, fade, vignette, sharpen) of a clip: its filter plus its own sliders. */
function lookOf(c) {
  const f = FILTERS.find((x) => x.id === c.filter)?.f || {};
  const a = c.adjust || {};
  const k = {};
  for (const key of LOOK_KEYS) k[key] = (f[key] || 0) + (a[key] || 0);
  return k;
}
const TRANSITIONS = [
  ['none', 'None'], ['fade', 'Crossfade'], ['black', 'Dip to black'], ['white', 'Flash'], ['slide', 'Slide'], ['up', 'Push up'], ['zoom', 'Zoom'], ['zoomblur', 'Zoom blur'],
  ['wipe', 'Wipe'], ['iris', 'Circle'], ['spin', 'Spin'], ['glitch', 'Glitch'], ['blur', 'Blur'],
  ['whip', 'Whip pan'], ['down', 'Push down'], ['pixel', 'Pixelate'], ['doors', 'Doors open'], ['blinds', 'Blinds'], ['flip', 'Flip'], ['heart', 'Heart'],
  ['diag', 'Diagonal wipe'], ['rotate', 'Rotate zoom'], ['rgb', 'RGB split'], ['shakecut', 'Shake cut'],
];
const EFFECTS = [
  ['none', 'None'], ['kb-in', 'Zoom in'], ['kb-out', 'Zoom out'], ['pan', 'Pan'], ['zoompulse', 'Beat pulse'], ['shake', 'Shake'], ['glitch', 'Glitch'],
  ['flash', 'Flash in'], ['blurin', 'Blur in'], ['vhs', 'VHS'], ['vignette', 'Vignette'], ['mirror', 'Mirror'],
];
const ANIM_IN = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Pop'], ['up', 'Slide up'], ['left', 'Slide in'], ['type', 'Typewriter'], ['zoom', 'Zoom']];
const ANIM_OUT = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Pop'], ['down', 'Slide down'], ['zoom', 'Zoom out']];
const TEXT_PRESETS = [
  { label: 'Title', text: 'Your title', font: 'Bricolage Grotesque', weight: '800', size: 0.09, color: '#ffffff', shadow: true },
  { label: 'Subtitle', text: 'Add a subtitle', font: 'DM Sans', weight: '700', size: 0.05, color: '#ffffff', shadow: true },
  { label: 'Caption', text: 'This is a caption', font: 'DM Sans', weight: '700', size: 0.045, color: '#111111', bg: '#ffffff', y: 0.8 },
  { label: 'Bold outline', text: 'WAIT FOR IT', font: 'Anton', weight: 'normal', size: 0.11, color: '#ffffff', stroke: '#000000' },
  { label: 'Highlight', text: 'big news', font: 'Unbounded', weight: '900', size: 0.06, color: '#111111', bg: '#facc15' },
  { label: 'Neon', text: 'Late night', font: 'Unbounded', weight: '900', size: 0.08, color: '#fdf4ff', glow: '#e879f9' },
  { label: 'Elegant', text: 'a little story', font: 'Instrument Serif', weight: 'normal', italic: true, size: 0.09, color: '#ffffff', shadow: true },
  { label: 'Lower third', text: 'Alex Morgan\nCreative Director', font: 'DM Sans', weight: '700', size: 0.04, color: '#ffffff', bg: '#7c3aed', x: 0.3, y: 0.82, align: 'left' },
  { label: 'Handwritten', text: 'so good!', font: 'Caveat', weight: '700', size: 0.1, color: '#fde047', shadow: true },
];
const STICKERS = ['🔥', '✨', '😂', '😍', '👏', '💯', '🎉', '❤️', '👀', '⭐', '✅', '❌', '👉', '🚀', '😱', '🤯', '💥', '🎵', '📍', '⚡'];

let H = null; // helpers from the app shell
let V = null; // editor state

// ---------- small utils ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s) => {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeBack = (x) => {
  x = clamp(x, 0, 1);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function clipDur(c) {
  return c.type === 'image' || c.type === 'color' ? c.dur : Math.max(0.1, videoLen(c));
}
/** Timeline seconds per source second of a video clip (1 / its average speed). */
const timePerSrc = (c) => (hasCurve(c) ? curveFactor(c.curve.pts) : 1 / (c.speed || 1));
function clipStarts() {
  let t = 0;
  return V.p.clips.map((c) => {
    const s = t;
    t += clipDur(c);
    return s;
  });
}
function mainDur() {
  return V.p.clips.reduce((a, c) => a + clipDur(c), 0);
}
function totalDur() {
  const ov = V.p.overlays.reduce((a, o) => Math.max(a, o.start + o.dur), 0);
  const au = V.p.audio.reduce((a, x) => Math.max(a, x.start + (x.out - x.in)), 0);
  return Math.max(mainDur(), ov, au, 0.5);
}
function activeClip(t) {
  const starts = clipStarts();
  for (let i = 0; i < V.p.clips.length; i++) {
    const d = clipDur(V.p.clips[i]);
    if (t >= starts[i] && t < starts[i] + d) return { clip: V.p.clips[i], idx: i, start: starts[i] };
  }
  if (V.p.clips.length && t >= mainDur() - 0.0001 && t <= mainDur() + 0.05) {
    const i = V.p.clips.length - 1;
    return { clip: V.p.clips[i], idx: i, start: starts[i] };
  }
  return null;
}
function filterString(c) {
  const f = { ...(FILTERS.find((x) => x.id === c.filter)?.f || {}), ...(c.adjust || {}) };
  const parts = [];
  if (f.brightness != null && f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast != null && f.contrast !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturate != null && f.saturate !== 1) parts.push(`saturate(${f.saturate})`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale})`);
  if (f.sepia) parts.push(`sepia(${f.sepia})`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  return parts.join(' ') || 'none';
}

// ---------- media ----------
async function mediaURL(id) {
  if (V.urls.has(id)) return V.urls.get(id);
  const m = await getMedia(id);
  if (!m) return null;
  const url = URL.createObjectURL(m.blob);
  V.urls.set(id, url);
  V.meta.set(id, { type: m.type, name: m.name, duration: m.duration, w: m.w, h: m.h, thumb: m.thumb, ...(m.credit ? { credit: m.credit } : {}) });
  return url;
}

function probe(file, type) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (meta) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    if (type === 'image') {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const s = 160 / Math.max(img.width, img.height);
        c.width = Math.max(1, img.width * s);
        c.height = Math.max(1, img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        done({ w: img.width, h: img.height, duration: 0, thumb: c.toDataURL('image/jpeg', 0.7) });
      };
      img.onerror = () => done(null);
      img.src = url;
    } else if (type === 'video') {
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'auto';
      v.playsInline = true;
      v.onloadeddata = () => {
        v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
      };
      v.onseeked = () => {
        const c = document.createElement('canvas');
        const s = 160 / Math.max(v.videoWidth || 160, v.videoHeight || 90);
        c.width = Math.max(1, (v.videoWidth || 160) * s);
        c.height = Math.max(1, (v.videoHeight || 90) * s);
        try {
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        } catch {}
        done({ w: v.videoWidth, h: v.videoHeight, duration: v.duration, thumb: c.toDataURL('image/jpeg', 0.7) });
      };
      v.onerror = () => done(null);
      v.src = url;
    } else {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => done({ duration: a.duration });
      a.onerror = () => done(null);
      a.src = url;
    }
  });
}

/** extra: more fields kept with the media (e.g. credit for stock files, duration when the file has none). */
async function importFile(file, extra = {}) {
  const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'image' : null;
  if (!type) return H.toast(`${file.name} is not a video, image or audio file`);
  const meta = await probe(file, type);
  if (!meta) return H.toast(`Could not read ${file.name}. Try MP4/WebM video, JPG/PNG images or MP3/WAV audio.`);
  if (extra.duration && !(Number.isFinite(meta.duration) && meta.duration > 0)) meta.duration = extra.duration;
  delete extra.duration;
  if (!V) return null;
  const id = uid();
  await saveMedia({ id, blob: file, type, name: file.name || type, ...meta, ...extra });
  if (!V) return null;
  V.p.mediaIds.push(id);
  V.meta.set(id, { type, name: file.name, ...meta, ...extra });
  return { id, type, ...meta, ...extra };
}

async function importFiles(files, { add = true } = {}) {
  const wasEmpty = !V.p.clips.length;
  for (const f of files) {
    H.toast(`Importing ${f.name}…`);
    const m = await importFile(f);
    if (!m || !add) continue;
    if (m.type === 'audio') addAudio(m.id, m.duration);
    else addClip(m.id, m.type, m.duration);
  }
  if (wasEmpty && V.p.clips.length) fitTimeline();
  renderPanel();
  commit();
  // phones: show the timeline with the new clips instead of leaving the sheet over it
  if (add && H.isMobile() && V?.panelOpen) closePanel();
}

// ---------- element management ----------
function ensureAudioGraph() {
  if (V.ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  V.ac = new AC();
  V.dest = V.ac.createMediaStreamDestination();
  for (const el of [...V.els.values(), ...V.aels.values(), ...V.oels.values()]) wireAudio(el);
}
function wireAudio(el) {
  if (!V.ac || el._gain || !(el instanceof HTMLMediaElement)) return;
  try {
    const src = V.ac.createMediaElementSource(el);
    const g = V.ac.createGain();
    src.connect(g);
    g.connect(V.ac.destination);
    g.connect(V.dest);
    el._gain = g;
  } catch (e) {
    console.warn(e);
  }
}
function setGain(el, v) {
  if (el._gain) el._gain.gain.value = v;
  else el.volume = clamp(v, 0, 1);
}

async function elFor(clip) {
  if (clip.type === 'color') return null;
  let el = V.els.get(clip.id);
  if (el && el._media === clip.mediaId) return el;
  if (el instanceof HTMLMediaElement) el.pause();
  const url = await mediaURL(clip.mediaId);
  if (!url) return null;
  if (V.els.get(clip.id)?._media === clip.mediaId) return V.els.get(clip.id);
  if (clip.type === 'image') {
    el = new Image();
    el.src = url;
  } else {
    el = document.createElement('video');
    el.preload = 'auto';
    el.playsInline = true;
    el.src = url;
    trackFrameTime(el);
    wireAudio(el);
  }
  el._media = clip.mediaId;
  V.els.set(clip.id, el);
  return el;
}
/** Remember the source time of the frame the video is showing (stabilization uses it). */
function trackFrameTime(el) {
  if (!('requestVideoFrameCallback' in el)) return;
  const cb = (_now, md) => {
    el._ft = md.mediaTime;
    el._ftAt = performance.now();
    el.requestVideoFrameCallback(cb);
  };
  el.requestVideoFrameCallback(cb);
}
/** Source time of the frame drawImage(el) draws now. */
function shownTime(el) {
  // a VideoFrame made from the element holds exactly the frame that would be drawn
  if (typeof VideoFrame === 'function' && el.readyState >= 2) {
    try {
      const vf = new VideoFrame(el);
      const t = vf.timestamp / 1e6;
      vf.close();
      if (Math.abs(t - el.currentTime) < 0.3) return t;
    } catch {}
  }
  const ft = el._ft;
  return ft != null && Math.abs(ft - el.currentTime) < 0.25 ? ft : el.currentTime;
}
async function audioElFor(a) {
  let el = V.aels.get(a.id);
  if (el && el._media === a.mediaId) return el;
  // the track now points at other media (voice changer, undo): drop the old element
  if (el) dropEl(V.aels, a.id);
  const url = await mediaURL(a.mediaId);
  if (!url) return null;
  if (V.aels.get(a.id)?._media === a.mediaId) return V.aels.get(a.id);
  el = document.createElement('audio');
  el.preload = 'auto';
  el.src = url;
  el._media = a.mediaId;
  wireAudio(el);
  V.aels.set(a.id, el);
  return el;
}
async function overlayElFor(o) {
  if (o.type !== 'video') return null;
  let el = V.oels.get(o.id);
  if (el && el._media === o.mediaId) return el;
  const url = await mediaURL(o.mediaId);
  if (!url) return null;
  el = document.createElement('video');
  el.preload = 'auto';
  el.playsInline = true;
  el.src = url;
  el._media = o.mediaId;
  wireAudio(el);
  V.oels.set(o.id, el);
  return el;
}
async function prepareAll() {
  await Promise.all([...V.p.clips.map(elFor), ...V.p.audio.map(audioElFor), ...V.p.overlays.map(overlayElFor)]);
  for (const id of [...V.oels.keys()]) if (!V.p.overlays.some((o) => o.id === id)) dropEl(V.oels, id);
  for (const id of [...V.els.keys()]) if (!V.p.clips.some((c) => c.id === id)) dropEl(V.els, id);
  for (const id of [...V.aels.keys()]) if (!V.p.audio.some((a) => a.id === id)) dropEl(V.aels, id);
}
function dropEl(map, id) {
  const el = map.get(id);
  if (el instanceof HTMLMediaElement) el.pause();
  map.delete(id);
}

// ---------- playback sync ----------
function sync(t, playing) {
  const act = activeClip(t);
  const starts = clipStarts();
  V.p.clips.forEach((c, i) => {
    const el = V.els.get(c.id);
    if (!(el instanceof HTMLVideoElement)) return;
    const isActive = act && act.clip === c;
    if (isActive) {
      const local = t - starts[i];
      const target = clamp(srcTime(c, local), c.in, c.out - 0.02);
      const curved = hasCurve(c);
      // a speed curve: the rate follows the curve, nudged so the picture stays on time
      const rate = clamp(srcRate(c, local), 0.0625, 16);
      setGain(el, c.muted ? 0 : c.volume ?? 1);
      if (playing) {
        if (el.paused) {
          el.playbackRate = rate;
          el.currentTime = target;
          el.play().catch(() => {});
        } else {
          const err = target - el.currentTime;
          if (Math.abs(err) > (curved ? 0.5 : 0.35)) el.currentTime = target;
          const want = curved ? clamp(rate * (1 + clamp(err * 1.5, -0.4, 0.4)), 0.0625, 16) : rate;
          if (Math.abs(el.playbackRate - want) > want * 0.02) el.playbackRate = want;
        }
      } else {
        if (el.playbackRate !== rate) el.playbackRate = rate;
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.04 && !el.seeking) el.currentTime = target;
      }
    } else {
      if (!el.paused) el.pause();
      // keep the clip before the active one parked on its last frame (used by transitions)
      if (act && i === act.idx - 1 && Math.abs(el.currentTime - (c.out - 0.05)) > 0.1 && !el.seeking) el.currentTime = Math.max(c.in, c.out - 0.05);
      // keep the next clip parked on its first frame so it starts instantly
      if (act && i === act.idx + 1 && Math.abs(el.currentTime - c.in) > 0.1 && !el.seeking) el.currentTime = c.in;
    }
  });
  V.p.overlays.forEach((o) => {
    if (o.type !== 'video') return;
    const el = V.oels.get(o.id);
    if (!el) return;
    const local = t - o.start;
    if (local >= 0 && local < o.dur) {
      const target = clamp((o.in || 0) + local, 0, (el.duration || 1e9) - 0.02);
      setGain(el, o.muted ? 0 : o.volume ?? 1);
      if (playing) {
        if (el.paused) {
          el.currentTime = target;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > 0.35) el.currentTime = target;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - target) > 0.04 && !el.seeking) el.currentTime = target;
      }
    } else if (!el.paused) el.pause();
  });
  V.p.audio.forEach((a) => {
    const el = V.aels.get(a.id);
    if (!el) return;
    const len = a.out - a.in;
    const local = t - a.start;
    if (local >= 0 && local < len) {
      let vol = a.volume ?? 1;
      if (a.fadeIn) vol *= clamp(local / a.fadeIn, 0, 1);
      if (a.fadeOut) vol *= clamp((len - local) / a.fadeOut, 0, 1);
      setGain(el, vol);
      const target = a.in + local;
      if (playing) {
        if (el.paused) {
          el.currentTime = target;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > 0.35) el.currentTime = target;
      } else if (!el.paused) el.pause();
    } else if (!el.paused) el.pause();
  });
}

// ---------- rendering ----------
const imgCache = new Map();
function overlayImg(o) {
  const src = o.mediaId ? V.urls.get(o.mediaId) : o.src;
  if (!src) return new Image();
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imgCache.set(src, img);
  }
  return img;
}

/**
 * Draw one main-track clip. Clips with a mask or a colour look are drawn on a layer first,
 * then cut / tinted there and put on the frame with the clip's opacity.
 */
function drawMedia(g, el, c, W, Hh, o = {}) {
  const alpha = (o.alpha ?? 1) * clamp(c.opacity ?? 1, 0, 1);
  const mask = c.type !== 'color' && isMasked(c.mask) ? c.mask : null;
  const look = c.type !== 'color' ? lookOf(c) : null;
  if (!mask && !hasLook(look)) return drawMediaRaw(g, el, c, W, Hh, { ...o, alpha });
  if (!el || alpha <= 0) return;
  const T0 = g.getTransform();
  const [lc, lg] = layerCanvas('clipLayer', g.canvas.width, g.canvas.height);
  lg.setTransform(T0);
  let T = null;
  drawMediaRaw(lg, el, c, W, Hh, { ...o, alpha: 1, onSpace: (m) => (T = m) });
  if (!T) return;
  if (hasLook(look)) applyLook(lc, look, T0, W, Hh);
  if (mask) maskLayer(lc, mask, maskMatrix(T, mask, W, Hh), Math.min(W, Hh));
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = alpha;
  g.filter = 'none';
  g.drawImage(lc, 0, 0);
  g.restore();
  if (mask && g === V.g && !V.playing && V.sel?.kind === 'clip' && V.sel.id === c.id) strokeMaskGuide(g, mask, maskMatrix(T, mask, W, Hh), Math.min(W, Hh));
}
/** Mask space of a clip: the clip's position and rotation, then the mask's own offset and angle. */
function maskMatrix(T, m, W, Hh) {
  return T.translate((m.x || 0) * W * 0.5, (m.y || 0) * Hh * 0.5).rotate(m.rot || 0);
}

function drawMediaRaw(g, el, c, W, Hh, { alpha = 1, dx = 0, dy = 0, scale = 1, blur = 0, rot = 0, local = 0, onSpace = null } = {}) {
  if (c.type === 'color') {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = c.color || '#222';
    g.translate(W / 2 + dx, Hh / 2 + dy);
    g.rotate(rot);
    g.scale(scale, scale);
    g.fillRect(-W / 2, -Hh / 2, W, Hh);
    if (c.slot) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = `700 ${Math.round(Math.min(W, Hh) * 0.045)}px "DM Sans", sans-serif`;
      g.textAlign = 'center';
      g.fillText(`Clip ${c.slot} — tap Replace`, 0, Math.min(W, Hh) * 0.02);
    }
    g.restore();
    return;
  }
  if (!el) return;
  const tf = c.tf || {};
  const quarter = ((tf.rot || 0) / 90) % 2 !== 0;
  let sw = el.videoWidth || el.naturalWidth || el.width;
  let sh = el.videoHeight || el.naturalHeight || el.height;
  if (!sw || !sh) return;
  if (el instanceof HTMLVideoElement && el.readyState < 2) return;
  const [ew, eh] = quarter ? [sh, sw] : [sw, sh];
  // free rotation: fill = the turned picture still covers the frame, fit = all of it stays visible
  const fr = ((tf.r || 0) * Math.PI) / 180;
  const ca = Math.abs(Math.cos(fr));
  const sa = Math.abs(Math.sin(fr));
  const cover = Math.max((W * ca + Hh * sa) / ew, (W * sa + Hh * ca) / eh);
  const contain = Math.min(W / (ew * ca + eh * sa), Hh / (ew * sa + eh * ca));
  const filt = filterString(c);
  // clip effects
  const fx = clipEffect(c, local, W, Hh);
  g.save();
  g.globalAlpha = alpha;
  g.translate(W / 2 + dx + fx.dx, Hh / 2 + dy + fx.dy);
  g.rotate(rot + fx.rot);
  g.scale(scale * fx.scale, scale * fx.scale);
  if (c.fit === 'fit' && Math.abs(cover - contain) > 0.001) {
    // blurred backdrop behind letterboxed media
    g.save();
    g.rotate(((tf.rot || 0) * Math.PI) / 180);
    g.filter = `blur(${Math.round(Math.min(W, Hh) * 0.04)}px) brightness(0.7)`;
    g.drawImage(el, (-sw * cover) / 2 - 20, (-sh * cover) / 2 - 20, sw * cover + 40, sh * cover + 40);
    g.restore();
  }
  const s0 = (c.fit === 'fit' ? contain : cover) * (tf.zoom || 1);
  g.translate((tf.x || 0) * W * 0.5, (tf.y || 0) * Hh * 0.5);
  g.rotate((((tf.rot || 0) + (tf.r || 0)) * Math.PI) / 180);
  if (onSpace) onSpace(g.getTransform());
  g.scale(tf.fx ? -1 : 1, tf.fy ? -1 : 1);
  const st = stabFor(c, el);
  if (st) {
    // stabilization: undo the shake of this frame, zoomed in a little to hide the edges
    g.scale(st.zoom, st.zoom);
    g.rotate(st.rot);
    g.translate(st.dx * sw * s0, st.dy * sh * s0);
  }
  const bl = blur + fx.blur;
  g.filter = bl ? `${filt === 'none' ? '' : filt} blur(${bl}px)` : filt;
  if (fx.mirror) {
    g.save();
    g.beginPath();
    g.rect((-sw * s0) / 2, (-sh * s0) / 2, (sw * s0) / 2, sh * s0);
    g.clip();
    g.drawImage(el, (-sw * s0) / 2, (-sh * s0) / 2, sw * s0, sh * s0);
    g.restore();
    g.save();
    g.scale(-1, 1);
    g.beginPath();
    g.rect((-sw * s0) / 2, (-sh * s0) / 2, (sw * s0) / 2, sh * s0);
    g.clip();
    g.drawImage(el, (-sw * s0) / 2, (-sh * s0) / 2, sw * s0, sh * s0);
    g.restore();
  } else g.drawImage(el, (-sw * s0) / 2, (-sh * s0) / 2, sw * s0, sh * s0);
  if (fx.glitch) {
    // horizontal slice displacement + colour split
    g.filter = 'none';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = (-sh * s0) / 2 + ((Math.sin(local * 37 + i * 13) + 1) / 2) * sh * s0 * 0.9;
      const hgt = sh * s0 * (0.02 + 0.05 * Math.abs(Math.sin(i * 7 + local * 11)));
      const off = Math.sin(local * 53 + i) * W * 0.06 * fx.glitch;
      g.drawImage(el, 0, ((y + (sh * s0) / 2) / (sh * s0)) * sh, sw, (hgt / (sh * s0)) * sh, (-sw * s0) / 2 + off, y, sw * s0, hgt);
    }
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.35 * fx.glitch * alpha;
    g.filter = 'hue-rotate(90deg) saturate(3)';
    g.drawImage(el, (-sw * s0) / 2 + W * 0.012, (-sh * s0) / 2, sw * s0, sh * s0);
  }
  g.restore();
  if (fx.overlay) fx.overlay(g, W, Hh, alpha);
}

const stabCache = new WeakMap();
/** Stabilization correction for the frame a clip's video is showing, or null. */
function stabFor(c, el) {
  const s = c.stab;
  if (!s || c.type !== 'video' || s.mediaId !== c.mediaId || !(el instanceof HTMLVideoElement)) return null;
  let k = stabCache.get(s);
  if (!k || k.level !== s.level) {
    k = { ...stabCorrections(s, s.level), t0: s.t0, fps: s.fps, level: s.level };
    stabCache.set(s, k);
  }
  return stabAt(k, shownTime(el));
}

/** Per-clip effect at local time t (seconds into the clip). */
function clipEffect(c, t, W, Hh) {
  const fx = { dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, glitch: 0, mirror: false, overlay: null };
  const d = clipDur(c);
  const p = clamp(t / Math.max(0.1, d), 0, 1);
  switch (c.effect) {
    case 'kb-in': fx.scale = 1 + 0.15 * p; break;
    case 'kb-out': fx.scale = 1.15 - 0.15 * p; break;
    case 'pan': fx.scale = 1.15; fx.dx = W * 0.06 * (1 - 2 * p); break;
    case 'zoompulse': fx.scale = 1 + 0.06 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2)), 4); break;
    case 'shake': fx.scale = 1.06; fx.dx = Math.sin(t * 61) * W * 0.012; fx.dy = Math.cos(t * 47) * Hh * 0.01; fx.rot = Math.sin(t * 29) * 0.012; break;
    case 'glitch': fx.glitch = t < 0.35 || (t % 1.3) < 0.12 ? 1 : 0; break;
    case 'blurin': fx.blur = Math.max(0, 1 - t / 0.6) * Math.min(W, Hh) * 0.04; break;
    case 'mirror': fx.mirror = true; break;
    case 'flash':
      fx.overlay = (g, w, h, a) => {
        const k = Math.max(0, 1 - t / 0.25);
        if (!k) return;
        g.save();
        g.globalAlpha = k * a;
        g.fillStyle = '#fff';
        g.fillRect(0, 0, w, h);
        g.restore();
      };
      break;
    case 'vignette':
      fx.overlay = (g, w, h, a) => {
        g.save();
        g.globalAlpha = a;
        const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        r.addColorStop(0, 'rgba(0,0,0,0)');
        r.addColorStop(1, 'rgba(0,0,0,0.7)');
        g.fillStyle = r;
        g.fillRect(0, 0, w, h);
        g.restore();
      };
      break;
    case 'vhs':
      fx.glitch = (t % 2.1) < 0.08 ? 0.6 : 0;
      fx.overlay = (g, w, h, a) => {
        g.save();
        g.globalAlpha = 0.18 * a;
        g.fillStyle = '#000';
        const step = Math.max(3, Math.round(h / 240));
        for (let y = 0; y < h; y += step * 2) g.fillRect(0, y, w, step);
        g.globalAlpha = 0.9 * a;
        g.fillStyle = '#ffffff';
        g.font = `700 ${Math.round(Math.min(w, h) * 0.04)}px "Courier New", monospace`;
        g.textAlign = 'left';
        g.fillText('PLAY ▶', w * 0.06, h * 0.08);
        g.textAlign = 'right';
        const ss = Math.floor(t);
        g.fillText(`00:00:${String(ss).padStart(2, '0')}`, w * 0.94, h * 0.94);
        g.restore();
      };
      break;
  }
  return fx;
}

function drawClipWithTransition(g, W, Hh, t) {
  const act = activeClip(t);
  if (!act) return;
  const cur = act.clip;
  const el = V.els.get(cur.id);
  const local = t - act.start;
  const tr = cur.transition;
  const prev = act.idx > 0 ? V.p.clips[act.idx - 1] : null;
  const pel = prev && V.els.get(prev.id);
  const prevLocal = prev ? clipDur(prev) : 0;
  const drawPrev = (o = {}) => drawMedia(g, pel, prev, W, Hh, { local: prevLocal, ...o });
  const drawCur = (o = {}) => drawMedia(g, el, cur, W, Hh, { local, ...o });
  if (prev && (pel || prev.type === 'color') && tr && tr.type !== 'none' && local < tr.dur) {
    const p = ease(local / tr.dur);
    switch (tr.type) {
      case 'fade':
        drawPrev();
        drawCur({ alpha: p });
        return;
      case 'zoomblur': {
        const b = Math.round(Math.min(W, Hh) * 0.03);
        if (local / tr.dur < 0.5) drawPrev({ scale: 1 + p * 0.5, blur: b * p * 2 });
        else drawCur({ scale: 1.5 - (p - 0.5), blur: b * (1 - p) * 2 });
        return;
      }
      case 'iris':
        drawPrev();
        g.save();
        g.beginPath();
        g.arc(W / 2, Hh / 2, Math.hypot(W, Hh) * 0.5 * p, 0, Math.PI * 2);
        g.clip();
        drawCur();
        g.restore();
        return;
      case 'spin':
        if (local / tr.dur < 0.5) drawPrev({ rot: p * Math.PI, scale: 1 - p * 0.6, alpha: 1 - p });
        else drawCur({ rot: -(1 - p) * Math.PI, scale: 0.4 + p * 0.6, alpha: p });
        return;
      case 'glitch':
        if (local / tr.dur < 0.5) drawPrev({ dx: Math.sin(local * 90) * W * 0.05 });
        else drawCur({ dx: Math.sin(local * 90) * W * 0.05 });
        g.save();
        g.globalCompositeOperation = 'difference';
        g.fillStyle = `rgba(0,255,200,${0.3 * (1 - Math.abs(local / tr.dur - 0.5) * 2)})`;
        g.fillRect(0, Hh * ((local * 7) % 1), W, Hh * 0.12);
        g.restore();
        return;
      case 'black':
      case 'white': {
        const half = local / tr.dur < 0.5;
        if (half) drawPrev();
        else drawCur();
        g.save();
        g.fillStyle = tr.type === 'black' ? '#000' : '#fff';
        g.globalAlpha = 1 - Math.abs(local / tr.dur - 0.5) * 2;
        g.fillRect(0, 0, W, Hh);
        g.restore();
        return;
      }
      case 'slide':
        drawPrev({ dx: -W * p });
        drawCur({ dx: W * (1 - p) });
        return;
      case 'up':
        drawPrev({ dy: -Hh * p });
        drawCur({ dy: Hh * (1 - p) });
        return;
      case 'zoom':
        drawPrev({ scale: 1 + p * 0.6, alpha: 1 - p });
        drawCur({ scale: 0.7 + 0.3 * p, alpha: p });
        return;
      case 'wipe':
        drawPrev();
        g.save();
        g.beginPath();
        g.rect(0, 0, W * p, Hh);
        g.clip();
        drawCur();
        g.restore();
        return;
      case 'blur': {
        const b = Math.round(Math.min(W, Hh) * 0.03);
        drawPrev({ blur: b * p, alpha: 1 - p });
        drawCur({ blur: b * (1 - p), alpha: p });
        return;
      }
      case 'whip': {
        const b = Math.round(Math.min(W, Hh) * 0.03 * Math.sin(Math.PI * p));
        drawPrev({ dx: -W * p, blur: b });
        drawCur({ dx: W * (1 - p), blur: b });
        return;
      }
      case 'down':
        drawPrev({ dy: Hh * p });
        drawCur({ dy: -Hh * (1 - p) });
        return;
      case 'pixel': {
        const raw = local / tr.dur;
        if (raw < 0.5) drawPrev();
        else drawCur();
        applyVideoFx(g, W, Hh, 'pixel', { local: 0, dur: tr.dur, amt: 0.2 + 2.5 * (1 - Math.abs(raw - 0.5) * 2) });
        return;
      }
      case 'doors':
        drawCur();
        [[0, -1], [W / 2, 1]].forEach(([x0, dir]) => {
          g.save();
          g.beginPath();
          g.rect(x0 + dir * (W / 2) * p, 0, W / 2, Hh);
          g.clip();
          drawPrev({ dx: dir * (W / 2) * p });
          g.restore();
        });
        return;
      case 'blinds': {
        drawPrev();
        g.save();
        g.beginPath();
        const n = 8;
        for (let i = 0; i < n; i++) g.rect(0, (i * Hh) / n, W, (Hh / n) * p + 1);
        g.clip();
        drawCur();
        g.restore();
        return;
      }
      case 'flip': {
        const raw = local / tr.dur;
        const k = Math.max(0.001, Math.abs(Math.cos(Math.PI * raw)));
        g.save();
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, Hh);
        g.translate(W / 2, 0);
        g.scale(k, 1);
        g.translate(-W / 2, 0);
        if (raw < 0.5) drawPrev();
        else drawCur();
        g.restore();
        return;
      }
      case 'heart': {
        drawPrev();
        const s = Math.hypot(W, Hh) * 1.6 * p;
        g.save();
        g.beginPath();
        const x = W / 2;
        const y = Hh / 2 - s * 0.45;
        g.moveTo(x, y + s * 0.3);
        g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
        g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
        g.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
        g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
        g.clip();
        drawCur();
        g.restore();
        return;
      }
      case 'diag':
        drawPrev();
        g.save();
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo((W + Hh) * 2 * p, 0);
        g.lineTo(0, (W + Hh) * 2 * p);
        g.closePath();
        g.clip();
        drawCur();
        g.restore();
        return;
      case 'rotate':
        if (local / tr.dur < 0.5) drawPrev({ rot: p * 0.6, scale: 1 + p * 1.2, alpha: 1 - p * 0.5 });
        else drawCur({ rot: -(1 - p) * 0.6, scale: 1 + (1 - p) * 1.2, alpha: 0.5 + p * 0.5 });
        return;
      case 'rgb': {
        const raw = local / tr.dur;
        if (raw < 0.5) drawPrev();
        else drawCur();
        applyVideoFx(g, W, Hh, 'rgb', { local: 0.26, dur: tr.dur, amt: 3 * (1 - Math.abs(raw - 0.5) * 2) });
        return;
      }
      case 'shakecut': {
        const raw = local / tr.dur;
        const k = 1 - Math.abs(raw - 0.5) * 2;
        const o = { dx: Math.sin(local * 80) * W * 0.04 * k, dy: Math.cos(local * 70) * Hh * 0.03 * k, scale: 1 + 0.1 * k };
        if (raw < 0.5) drawPrev(o);
        else drawCur(o);
        if (Math.abs(raw - 0.5) < 0.12) {
          g.save();
          g.globalAlpha = 0.6;
          g.fillStyle = '#fff';
          g.fillRect(0, 0, W, Hh);
          g.restore();
        }
        return;
      }
    }
  }
  drawCur();
}

/** Effect layers (video & body effects) that cover time t, applied to the picture under them. */
function applyEffectLayers(g, W, Hh, t, preview) {
  const list = (V.p.effects || []).filter((e) => t >= e.start && t < e.start + e.dur);
  if (!list.length) return;
  let mask;
  for (const e of list) {
    const o = { local: t - e.start, dur: e.dur, amt: e.amount ?? 1, color: e.color };
    if (e.kind === 'body') {
      if (mask === undefined) mask = frameMask(g, t);
      if (mask) applyBodyFx(g, W, Hh, e.fx, o, mask);
      else if (preview) {
        const st = segState();
        g.save();
        g.fillStyle = 'rgba(0,0,0,.55)';
        const m = Math.min(W, Hh);
        g.font = `600 ${Math.round(m * 0.035)}px "DM Sans", sans-serif`;
        const msg = st === 'error' ? (IN_PREVIEW ? 'Body effects work on your own Artvas site, not in this preview' : "Body effects couldn't load — check your internet") : 'Loading body effects…';
        const tw = g.measureText(msg).width;
        g.fillRect((W - tw) / 2 - m * 0.03, Hh * 0.06, tw + m * 0.06, m * 0.07);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(msg, W / 2, Hh * 0.06 + m * 0.035);
        g.restore();
      }
    } else applyVideoFx(g, W, Hh, e.fx, o);
  }
}
/** Person mask for the current frame; found once per frame and shared by preview and export. */
function frameMask(g, t) {
  const live = V.playing || V.exporting;
  const key = live ? `${t}|${V.rev || 0}` : `${t}|${V.rev || 0}|${Math.floor(performance.now() / 300)}`;
  if (V.maskKey === key) return V.mask;
  const mk = segmentCanvas(g.canvas);
  if (!mk) return null;
  V.maskKey = key;
  V.mask = mk;
  return mk;
}

function animState(o, t) {
  const local = t - o.start;
  const d = Math.min(0.5, o.dur / 3);
  const st = { alpha: 1, dx: 0, dy: 0, scale: 1, chars: Infinity };
  const ai = o.animIn || 'none';
  const ao = o.animOut || 'none';
  if (local < d && ai !== 'none') {
    const p = local / d;
    if (ai === 'fade') st.alpha = ease(p);
    if (ai === 'pop') st.scale = Math.max(0.01, easeBack(p));
    if (ai === 'zoom') { st.scale = 0.4 + 0.6 * ease(p); st.alpha = ease(p); }
    if (ai === 'up') { st.dy = (1 - ease(p)) * 0.08; st.alpha = ease(p); }
    if (ai === 'left') { st.dx = (1 - ease(p)) * 0.15; st.alpha = ease(p); }
  }
  if (ai === 'type' && o.type === 'text') st.chars = Math.floor((o.text || '').length * clamp(local / Math.max(0.3, Math.min(1.5, o.dur * 0.5)), 0, 1));
  const rem = o.dur - local;
  if (rem < d && ao !== 'none') {
    const p = 1 - rem / d;
    if (ao === 'fade') st.alpha *= 1 - ease(p);
    if (ao === 'pop') st.scale *= Math.max(0.01, 1 - ease(p));
    if (ao === 'zoom') { st.scale *= 1 + ease(p) * 0.5; st.alpha *= 1 - ease(p); }
    if (ao === 'down') { st.dy += ease(p) * 0.08; st.alpha *= 1 - ease(p); }
  }
  return st;
}

/** Keyframed values of an overlay at local time lt. */
function keyed(o, lt) {
  const base = { x: o.x, y: o.y, size: o.size, scale: o.scale, opacity: o.opacity ?? 1 };
  const ks = o.keys;
  if (!ks || !ks.length) return base;
  const sorted = [...ks].sort((a, b) => a.t - b.t);
  if (lt <= sorted[0].t) return { ...base, ...sorted[0].v };
  const last = sorted[sorted.length - 1];
  if (lt >= last.t) return { ...base, ...last.v };
  const i = sorted.findIndex((k) => k.t > lt);
  const a = sorted[i - 1];
  const b = sorted[i];
  const p = ease((lt - a.t) / Math.max(0.001, b.t - a.t));
  const out = { ...base };
  for (const key of Object.keys(a.v)) if (typeof a.v[key] === 'number' && typeof b.v[key] === 'number') out[key] = a.v[key] + (b.v[key] - a.v[key]) * p;
  return out;
}

const keyCanvas = document.createElement('canvas');
/** Remove a solid backdrop colour (green screen) from a frame. */
function chromaKey(src, hex, tol) {
  const sw = src.videoWidth || src.naturalWidth;
  const sh = src.videoHeight || src.naturalHeight;
  const s = Math.min(1, 480 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s));
  const h = Math.max(1, Math.round(sh * s));
  keyCanvas.width = w;
  keyCanvas.height = h;
  const g = keyCanvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  const p = d.data;
  const r0 = parseInt(hex.slice(1, 3), 16);
  const g0 = parseInt(hex.slice(3, 5), 16);
  const b0 = parseInt(hex.slice(5, 7), 16);
  const max = (tol / 100) * 441;
  const soft = max * 0.35;
  for (let i = 0; i < p.length; i += 4) {
    const dist = Math.hypot(p[i] - r0, p[i + 1] - g0, p[i + 2] - b0);
    if (dist <= max) p[i + 3] = 0;
    else if (dist <= max + soft) p[i + 3] = Math.round(((dist - max) / soft) * 255);
  }
  g.putImageData(d, 0, 0);
  return keyCanvas;
}

/** Draw a picture-in-picture image/video at (-w/2, -h/2), cut to its mask when it has one. */
function drawOverlayMedia(g, o, src, w, h) {
  const m = isMasked(o.mask) ? o.mask : null;
  if (!m) return g.drawImage(src, -w / 2, -h / 2, w, h);
  // work at the size it ends up on the frame (capped) so edges stay crisp in exports
  const T = g.getTransform();
  const px = clamp(Math.hypot(T.a, T.b), 0.05, 4);
  const k = Math.min(px, 2048 / Math.max(w, h));
  const lw = Math.max(1, Math.round(w * k));
  const lh = Math.max(1, Math.round(h * k));
  const [lc, lg] = layerCanvas('ovLayer', lw, lh);
  lg.drawImage(src, 0, 0, lw, lh);
  const M = new DOMMatrix().translate(lw / 2 + (m.x || 0) * lw * 0.5, lh / 2 + (m.y || 0) * lh * 0.5).rotate(m.rot || 0);
  maskLayer(lc, m, M, Math.min(lw, lh));
  g.drawImage(lc, -w / 2, -h / 2, w, h);
  if (g === V.g && !V.playing && V.sel?.kind === 'overlay' && V.sel.id === o.id) {
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    strokeMaskGuide(g, m, T.translate(-w / 2, -h / 2).scale(w / lw, h / lh).multiply(M), Math.min(lw, lh));
    g.restore();
  }
}

function drawOverlays(g, W, Hh, t, hits) {
  const m = Math.min(W, Hh);
  for (const o of V.p.overlays) {
    if (t < o.start || t >= o.start + o.dur) continue;
    const a = animState(o, t);
    const k = keyed(o, t - o.start);
    const cx = (k.x + a.dx) * W;
    const cy = (k.y + a.dy) * Hh;
    g.save();
    g.globalAlpha = a.alpha * k.opacity;
    g.globalCompositeOperation = blendOp(o.blend);
    g.translate(cx, cy);
    if (o.rot) g.rotate((o.rot * Math.PI) / 180);
    g.scale(a.scale, a.scale);
    let bw, bh;
    if (o.type === 'text') {
      const size = k.size * m;
      g.font = `${o.italic ? 'italic ' : ''}${o.weight || 'normal'} ${size}px "${o.font}", sans-serif`;
      g.textBaseline = 'middle';
      const text = a.chars === Infinity ? o.text : (o.text || '').slice(0, a.chars);
      const lines = (text || ' ').split('\n');
      const allLines = (o.text || ' ').split('\n');
      const lh = size * 1.15;
      const widths = allLines.map((l) => g.measureText(l).width);
      const tw = Math.max(1, ...widths);
      const pad = o.bg ? size * 0.35 : 0;
      bw = tw + pad * 2;
      bh = allLines.length * lh + pad * 2;
      const align = o.align || 'center';
      g.textAlign = align;
      const ax = align === 'left' ? -tw / 2 : align === 'right' ? tw / 2 : 0;
      if (o.bg) {
        g.fillStyle = o.bg;
        g.beginPath();
        g.roundRect(-bw / 2, -bh / 2, bw, bh, size * 0.25);
        g.fill();
      }
      if (o.glow) {
        g.shadowColor = o.glow;
        g.shadowBlur = size * 0.45;
      } else if (o.shadow) {
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = size * 0.2;
        g.shadowOffsetY = size * 0.05;
      }
      lines.forEach((l, i) => {
        const y = -bh / 2 + pad + lh * (i + 0.5);
        if (o.stroke) {
          g.lineJoin = 'round';
          g.lineWidth = size * 0.14;
          g.strokeStyle = o.stroke;
          g.strokeText(l, ax, y);
        }
        g.fillStyle = o.color || '#fff';
        g.fillText(l, ax, y);
        if (o.glow) g.fillText(l, ax, y);
      });
    } else {
      const img = o.type === 'video' ? V.oels.get(o.id) : o.emoji ? null : overlayImg(o);
      const w = k.scale * m;
      if (o.type === 'video') {
        const vw = img?.videoWidth;
        if (img && vw && img.readyState >= 2) {
          const h = (w * img.videoHeight) / vw;
          if (o.round) {
            g.beginPath();
            g.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
            g.clip();
          }
          drawOverlayMedia(g, o, o.chroma ? chromaKey(img, o.chroma, o.chromaTol ?? 30) : img, w, h);
          bw = w;
          bh = h;
        } else {
          bw = w;
          bh = w * 0.56;
        }
      } else if (o.emoji) {
        g.font = `${w * 0.85}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(o.emoji, 0, w * 0.04);
        bw = w;
        bh = w;
      } else if (img.complete && img.naturalWidth) {
        const h = (w * img.naturalHeight) / img.naturalWidth;
        if (o.round) {
          g.beginPath();
          g.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
          g.clip();
        }
        drawOverlayMedia(g, o, o.chroma ? chromaKey(img, o.chroma, o.chromaTol ?? 30) : img, w, h);
        bw = w;
        bh = h;
      } else {
        bw = w;
        bh = w;
      }
    }
    g.restore();
    if (hits) hits.push({ id: o.id, x: cx - (bw * a.scale) / 2, y: cy - (bh * a.scale) / 2, w: bw * a.scale, h: bh * a.scale });
  }
}

function renderFrame(g, W, Hh, t, { preview = false } = {}) {
  g.save();
  g.fillStyle = V.p.bg || '#000';
  g.fillRect(0, 0, W, Hh);
  drawClipWithTransition(g, W, Hh, t);
  applyEffectLayers(g, W, Hh, t, preview);
  const hits = preview ? [] : null;
  drawOverlays(g, W, Hh, t, hits);
  g.restore();
  if (preview) {
    V.hits = hits;
    const sel = V.sel?.kind === 'overlay' && hits.find((h) => h.id === V.sel.id);
    if (sel) {
      g.save();
      g.strokeStyle = '#a78bfa';
      g.lineWidth = Math.max(2, W / 400);
      g.setLineDash([8, 6]);
      g.strokeRect(sel.x, sel.y, sel.w, sel.h);
      g.setLineDash([]);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#7c3aed';
      const r = Math.max(8, W / 90);
      g.beginPath();
      g.arc(sel.x + sel.w, sel.y + sel.h, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
      V.handle = { x: sel.x + sel.w, y: sel.y + sel.h, r: r * 1.8 };
    } else V.handle = null;
    if (!V.p.clips.length && !V.p.overlays.length) {
      g.save();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = `600 ${Math.round(Math.min(W, Hh) * 0.04)}px "DM Sans", sans-serif`;
      g.textAlign = 'center';
      g.fillText('Import videos or photos to start', W / 2, Hh / 2);
      g.restore();
    }
  }
}

// ---------- loop ----------
function loop(ts) {
  if (!V) return;
  V.raf = requestAnimationFrame(loop);
  const dt = V.last ? Math.min(0.1, (ts - V.last) / 1000) : 0;
  V.last = ts;
  const total = totalDur();
  if (V.playing) {
    V.t += dt;
    if (V.t >= total) {
      if (V.exporting) {
        V.t = total;
        finishExport();
      } else {
        V.t = total;
        setPlaying(false);
      }
    }
  }
  if (V.playing && V.stopAt != null && !V.exporting && V.t >= V.stopAt) {
    V.stopAt = null;
    setPlaying(false);
  }
  sync(V.t, V.playing);
  renderFrame(V.g, V.cw, V.ch, V.t, { preview: true });
  if (V.exporting && V.out) {
    renderFrame(V.out.g, V.out.w, V.out.h, Math.min(V.t, total));
    V.out.prog.textContent = `Rendering… ${Math.round((V.t / total) * 100)}%`;
  }
  const ph = $('#tlPlayhead');
  if (ph) ph.style.transform = `translateX(${V.t * V.pps}px)`;
  const tl = $('#vTime');
  if (tl) tl.textContent = `${fmt(V.t)} / ${fmt(total)}`;
  if (V.playing && V.follow) {
    const sc = $('#tlScroll');
    if (sc) {
      const x = V.t * V.pps;
      if (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft) sc.scrollLeft = x - 60;
    }
  }
}

function setPlaying(on) {
  if (on) {
    ensureAudioGraph();
    V.ac?.resume?.();
    if (V.t >= totalDur() - 0.05) V.t = 0;
  }
  V.playing = on;
  V.follow = on;
  const b = $('#vPlay');
  if (b) b.innerHTML = H.icon(on ? 'pause' : 'play', 20);
}

function seek(t) {
  V.t = clamp(t, 0, totalDur());
  if (V.playing) {
    // force resync
    V.p.overlays.forEach((o) => V.oels.get(o.id)?.pause?.());
    V.p.clips.forEach((c) => V.els.get(c.id)?.pause?.());
    V.p.audio.forEach((a) => V.aels.get(a.id)?.pause?.());
  }
}

// ---------- keyframes ----------
function keyValues(o, lt) {
  const k = keyed(o, lt);
  return o.type === 'text' ? { x: k.x, y: k.y, size: k.size, opacity: k.opacity } : { x: k.x, y: k.y, scale: k.scale, opacity: k.opacity };
}
/** Write values into the keyframe at the playhead (creating one if needed). */
function setKeyValue(o, vals) {
  const lt = clamp(V.t - o.start, 0, o.dur);
  o.keys = o.keys || [];
  let k = o.keys.find((x) => Math.abs(x.t - lt) < 0.05);
  if (!k) {
    k = { t: +lt.toFixed(2), v: keyValues(o, lt) };
    o.keys.push(k);
  }
  Object.assign(k.v, vals);
}

// ---------- editing ops ----------
function addClip(mediaId, type, duration, at = V.p.clips.length) {
  const c = {
    id: uid(), mediaId, type, in: 0, out: type === 'video' ? duration : 0, dur: type === 'image' ? 3 : 0,
    speed: 1, volume: 1, muted: false, fit: 'fill', filter: 'none', adjust: {}, transition: { type: V.p.clips.length && at > 0 ? 'fade' : 'none', dur: 0.5 },
  };
  V.p.clips.splice(at, 0, c);
  prepareAll();
  select({ kind: 'clip', id: c.id });
  return c;
}
function addAudio(mediaId, duration, start = 0) {
  const a = { id: uid(), mediaId, start, in: 0, out: duration, volume: 1, fadeIn: 0, fadeOut: 1, name: V.meta.get(mediaId)?.name || 'Audio' };
  V.p.audio.push(a);
  prepareAll();
  select({ kind: 'audio', id: a.id });
}
function addOverlay(o) {
  const ov = { id: uid(), start: V.t >= totalDur() - 0.1 && V.p.clips.length ? 0 : V.t, dur: 3, x: 0.5, y: 0.5, opacity: 1, animIn: 'fade', animOut: 'fade', ...o };
  if (ov.font) fontsIn([ov]);
  V.p.overlays.push(ov);
  select({ kind: 'overlay', id: ov.id });
  commit();
  if (H.isMobile()) closePanel();
}
function addText(preset) {
  addOverlay({ type: 'text', text: preset.text, font: preset.font, weight: preset.weight, italic: !!preset.italic, size: preset.size, color: preset.color, bg: preset.bg || '', stroke: preset.stroke || '', glow: preset.glow || '', shadow: !!preset.shadow, align: preset.align || 'center', x: preset.x ?? 0.5, y: preset.y ?? 0.5, animIn: 'pop' });
}
function findSel() {
  if (!V.sel) return null;
  const list = V.sel.kind === 'clip' ? V.p.clips : V.sel.kind === 'overlay' ? V.p.overlays : V.sel.kind === 'effect' ? V.p.effects : V.p.audio;
  return list.find((x) => x.id === V.sel.id) || null;
}
function deleteSel() {
  const s = findSel();
  if (!s) return;
  const key = V.sel.kind === 'clip' ? 'clips' : V.sel.kind === 'overlay' ? 'overlays' : V.sel.kind === 'effect' ? 'effects' : 'audio';
  V.p[key] = V.p[key].filter((x) => x !== s);
  V.sel = null;
  prepareAll();
  commit();
}
function duplicateSel() {
  const s = findSel();
  if (!s) return;
  const c = { ...structuredClone(s), id: uid() };
  if (V.sel.kind === 'clip') V.p.clips.splice(V.p.clips.indexOf(s) + 1, 0, c);
  else if (V.sel.kind === 'overlay') { c.start = s.start + s.dur; V.p.overlays.push(c); }
  else if (V.sel.kind === 'effect') { c.start = s.start + s.dur; V.p.effects.push(c); }
  else { c.start = s.start + (s.out - s.in); V.p.audio.push(c); }
  V.sel = { kind: V.sel.kind, id: c.id };
  prepareAll();
  commit();
}
function splitAtPlayhead() {
  const t = V.t;
  let s = findSel();
  let kind = V.sel?.kind;
  if (!s) {
    const act = activeClip(t);
    if (!act) return H.toast('Move the playhead over a clip to split it');
    s = act.clip;
    kind = 'clip';
  }
  if (kind === 'clip') {
    const starts = clipStarts();
    const i = V.p.clips.indexOf(s);
    const local = t - starts[i];
    if (local < 0.1 || local > clipDur(s) - 0.1) return H.toast('Move the playhead inside the clip to split it');
    const b = { ...structuredClone(s), id: uid(), transition: { type: 'none', dur: 0.5 } };
    if (s.type === 'image') {
      b.dur = s.dur - local;
      s.dur = local;
    } else {
      const cut = srcTime(s, local);
      if (hasCurve(s)) {
        // each half keeps its own part of the speed curve
        const u = (cut - s.in) / Math.max(1e-6, s.out - s.in);
        b.curve = { ...s.curve, id: 'custom', pts: subCurve(s.curve.pts, u, 1) };
        s.curve = { ...s.curve, id: 'custom', pts: subCurve(s.curve.pts, 0, u) };
      }
      b.in = cut;
      s.out = cut;
    }
    V.p.clips.splice(i + 1, 0, b);
  } else if (kind === 'overlay' || kind === 'effect') {
    const local = t - s.start;
    if (local < 0.1 || local > s.dur - 0.1) return H.toast('Move the playhead inside the item to split it');
    const b = { ...structuredClone(s), id: uid(), start: t, dur: s.dur - local };
    s.dur = local;
    (kind === 'effect' ? V.p.effects : V.p.overlays).push(b);
  } else {
    const local = t - s.start;
    if (local < 0.1 || local > s.out - s.in - 0.1) return H.toast('Move the playhead inside the audio to split it');
    const b = { ...structuredClone(s), id: uid(), start: t, in: s.in + local };
    s.out = s.in + local;
    V.p.audio.push(b);
  }
  prepareAll();
  commit();
  H.toast('Split');
}
function replaceClip(c) {
  const inp = document.createElement('input');
  inp.type = 'file';
  attachPicker(inp);
  inp.accept = 'video/*,image/*';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    const m = await importFile(f);
    if (!m || m.type === 'audio') return;
    const keep = clipDur(c);
    delete c.slot;
    delete c.color;
    c.mediaId = m.id;
    if (m.type === 'image') {
      c.type = 'image';
      c.dur = keep;
    } else {
      c.type = 'video';
      c.in = 0;
      c.out = Math.min(m.duration, Math.max(0.5, keep / timePerSrc(c)));
      delete c.rev;
      delete c.stab;
      delete c.dur;
    }
    V.els.delete(c.id);
    await prepareAll();
    commit();
    renderPanel();
  };
  inp.click();
}

async function freezeFrame() {
  const act = activeClip(V.t);
  if (!act || act.clip.type !== 'video') return H.toast('Move the playhead over a video clip');
  const el = V.els.get(act.clip.id);
  if (!el?.videoWidth) return H.toast('The video frame is not ready yet');
  const c = document.createElement('canvas');
  c.width = el.videoWidth;
  c.height = el.videoHeight;
  c.getContext('2d').drawImage(el, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  const m = await importFile(new File([blob], 'Freeze frame.jpg', { type: 'image/jpeg' }));
  if (!m) return;
  const local = V.t - act.start;
  const i = act.idx;
  const src = act.clip;
  const freeze = { id: uid(), type: 'image', mediaId: m.id, dur: 2, speed: 1, fit: src.fit, filter: src.filter, adjust: { ...(src.adjust || {}) }, effect: 'none', tf: src.tf ? { ...src.tf } : undefined, opacity: src.opacity, mask: src.mask ? { ...src.mask } : undefined, transition: { type: 'none', dur: 0.5 } };
  if (local > 0.1 && local < clipDur(src) - 0.1) {
    const b = { ...structuredClone(src), id: uid(), transition: { type: 'none', dur: 0.5 } };
    const cut = srcTime(src, local);
    if (hasCurve(src)) {
      const u = (cut - src.in) / Math.max(1e-6, src.out - src.in);
      b.curve = { ...src.curve, id: 'custom', pts: subCurve(src.curve.pts, u, 1) };
      src.curve = { ...src.curve, id: 'custom', pts: subCurve(src.curve.pts, 0, u) };
    }
    b.in = cut;
    src.out = cut;
    V.p.clips.splice(i + 1, 0, freeze, b);
  } else V.p.clips.splice(local <= 0.1 ? i : i + 1, 0, freeze);
  await prepareAll();
  commit();
  H.toast('Freeze frame added (2s)');
}

function moveClip(dir) {
  const s = findSel();
  if (V.sel?.kind !== 'clip' || !s) return;
  const i = V.p.clips.indexOf(s);
  const j = i + dir;
  if (j < 0 || j >= V.p.clips.length) return;
  [V.p.clips[i], V.p.clips[j]] = [V.p.clips[j], V.p.clips[i]];
  commit();
}
function select(sel, { open = false } = {}) {
  V.sel = sel;
  renderInspector();
  renderTimeline();
  if (H.isMobile()) {
    if (sel && open) openInspector();
  } else if (sel && !V.inspClosedByUser && !V.inspectorOpen) openInspector();
  else if (!sel && V.inspectorOpen && !V.inspPinned) { V.inspectorOpen = false; syncPanels(); }
}

// ---------- history & saving ----------
function snapshot() {
  const { thumb, ...rest } = V.p;
  return JSON.stringify(rest);
}
function commit({ history = true } = {}) {
  V.rev = (V.rev || 0) + 1;
  if (history) {
    const s = snapshot();
    if (V.hist[V.hist.length - 1] !== s) {
      V.hist.push(s);
      if (V.hist.length > 80) V.hist.shift();
      V.redo = [];
    }
  }
  renderTimeline();
  renderInspector();
  scheduleSave();
}
function restore(s) {
  const keep = { id: V.p.id, thumb: V.p.thumb };
  V.p = { effects: [], ...JSON.parse(s), ...keep };
  if (V.sel && !findSel()) V.sel = null;
  prepareAll();
  renderTimeline();
  renderInspector();
  scheduleSave();
}
function undo() {
  if (V.hist.length < 2) return;
  V.redo.push(V.hist.pop());
  restore(V.hist[V.hist.length - 1]);
}
function redo() {
  const s = V.redo.pop();
  if (!s) return;
  V.hist.push(s);
  restore(s);
}
let saveTimer;
function scheduleSave() {
  const st = $('#saveStatus');
  if (st) st.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 700);
}
async function save() {
  clearTimeout(saveTimer);
  if (!V) return;
  try {
    const c = document.createElement('canvas');
    const s = 240 / Math.max(V.p.width, V.p.height);
    c.width = Math.round(V.p.width * s);
    c.height = Math.round(V.p.height * s);
    const g = c.getContext('2d');
    g.scale(s, s);
    renderFrame(g, V.p.width, V.p.height, Math.min(0.6, totalDur() / 2));
    V.p.thumb = c.toDataURL('image/jpeg', 0.7);
  } catch {}
  V.p.updatedAt = Date.now();
  try {
    await saveDesign(V.p);
    const st = $('#saveStatus');
    if (st) st.textContent = 'Saved';
  } catch (e) {
    console.error(e);
    const st = $('#saveStatus');
    if (st) st.textContent = 'Not saved';
  }
}

// ---------- UI ----------
const TABS = [
  ['templates', 'layout', 'Templates'],
  ['media', 'upload', 'Media'],
  ['text', 'type', 'Text'],
  ['effects', 'sparkle', 'Effects'],
  ['transitions', 'transition', 'Transitions'],
  ['captions', 'captions', 'Captions'],
  ['elements', 'shapes', 'Elements'],
  ['audio', 'music', 'Audio'],
  ['designs', 'image', 'Designs'],
  ['ai', 'wand', 'AI'],
];

export async function openVideoEditor(project, helpers, opts = {}) {
  H = helpers;
  closeVideoEditor();
  if (!Array.isArray(project.effects)) project.effects = [];
  V = {
    p: project, t: 0, playing: false, sel: null, els: new Map(), aels: new Map(), oels: new Map(), urls: new Map(), meta: new Map(),
    pps: 60, hist: [], redo: [], tab: opts.tab || (project.clips.some((c) => c.slot) ? 'templates' : 'media'), panelOpen: !H.isMobile() || !!opts.tab, inspectorOpen: false, hits: [], last: 0,
  };
  for (const id of project.mediaIds || []) await mediaURL(id).catch(() => {});
  await fontsIn(project.overlays);
  H.app.innerHTML = editorHTML();
  V.canvas = $('#vCanvas');
  sizeCanvas();
  V.g = V.canvas.getContext('2d');
  bindUI();
  await prepareAll();
  V.hist = [snapshot()];
  renderPanel();
  fitTimeline();
  renderTimeline();
  renderInspector();
  syncPanels();
  V.raf = requestAnimationFrame(loop);
}

export function closeVideoEditor() {
  if (!V) return;
  cancelAnimationFrame(V.raf);
  V.playing = false;
  for (const el of [...V.els.values(), ...V.aels.values(), ...V.oels.values()]) if (el instanceof HTMLMediaElement) { el.pause(); el.removeAttribute('src'); el.load?.(); }
  for (const u of V.urls.values()) URL.revokeObjectURL(u);
  V.ac?.close?.();
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', sizeCanvas);
  V = null;
}

function sizeCanvas() {
  if (!V) return;
  const max = 960;
  const s = Math.min(1, max / Math.max(V.p.width, V.p.height));
  V.cw = Math.round(V.p.width * s);
  V.ch = Math.round(V.p.height * s);
  V.canvas.width = V.cw;
  V.canvas.height = V.ch;
  if (V.view && V.view.z !== 1) resetView();
  fitPreview();
}
function fitPreview() {
  const stage = $('#vStage');
  if (!stage || !V) return;
  const pad = H.isMobile() ? 16 : 32;
  const z = Math.min((stage.clientWidth - pad) / V.cw, (stage.clientHeight - pad) / V.ch);
  if (z > 0) {
    V.canvas.style.width = `${Math.round(V.cw * z)}px`;
    V.canvas.style.height = `${Math.round(V.ch * z)}px`;
  }
}

function editorHTML() {
  const p = V.p;
  return `
  <div class="editor video-editor" id="editor">
    <header class="topbar">
      <button class="icon-btn light" id="vHome" title="Home">${H.icon('home')}</button>
      <div class="logo small">${H.logoSvg()}<span>Artvas</span></div>
      <span class="mode-chip">Video</span>
      <div class="sep"></div>
      <button class="icon-btn light" id="vUndo" title="Undo (Ctrl+Z)">${H.icon('undo')}</button>
      <button class="icon-btn light" id="vRedo" title="Redo (Ctrl+Y)">${H.icon('redo')}</button>
      <span class="save-status" id="saveStatus">Saved</span>
      <input class="title-input" id="vTitle" value="${H.esc(p.name)}" spellcheck="false">
      <div class="spacer"></div>
      <span class="dim-label">${p.width} × ${p.height}</span>
      <button class="btn primary" id="vExport" title="Export video">${H.icon('download')}<span class="lbl">Export</span></button>
    </header>
    <div class="main">
      <nav class="tabs">${TABS.map(([id, ic, label]) => `<button class="tab" data-vtab="${id}">${H.icon(ic)}<span>${label}</span></button>`).join('')}</nav>
      <aside class="panel" id="panelWrap">
        <div class="sheet-handle"></div>
        <button class="panel-close icon-btn" id="vPanelClose" title="Hide panel">${H.icon('chevLeft')}</button>
        <div class="panel-body" id="vPanel"></div>
      </aside>
      <section class="workspace">
        <div class="v-stage" id="vStage"><canvas id="vCanvas"></canvas><button class="v-zoomchip" id="vViewFit" hidden title="Show the whole video">${H.icon('resize', 14)} <span id="vViewPct">100%</span> · Fit</button></div>
        <div class="v-controls">
          <button class="tool" id="vSplit" title="Split at playhead (S)">${H.icon('scissors')}<span>Split</span></button>
          <button class="tool" id="vDup" title="Duplicate">${H.icon('copy')}</button>
          <button class="tool" id="vDel" title="Delete (Del)">${H.icon('trash')}</button>
          <span class="spacer"></span>
          <button class="tool" id="vBack" title="Back 1 second">${H.icon('chevLeft')}</button>
          <button class="v-play" id="vPlay" title="Play / pause (Space)">${H.icon('play', 20)}</button>
          <button class="tool" id="vFwd" title="Forward 1 second">${H.icon('chevRight')}</button>
          <span class="v-time" id="vTime">00:00.0 / 00:00.0</span>
          <span class="spacer"></span>
          <button class="tool ctx-toggle" id="vInspToggle" title="Edit selected">${H.icon('resize')}<span>Edit</span></button>
        </div>
        <div class="tl" id="tl">
          <div class="tl-scroll" id="tlScroll"><div class="tl-inner" id="tlInner"></div></div>
          <div class="tl-zoom" title="Zoom the timeline (pinch, or Ctrl + scroll)">
            <button id="vZoomOut" title="Zoom out — see the whole video">${H.icon('minus', 14)}</button>
            <input type="range" id="vZoom" min="0" max="100" step="1" aria-label="Timeline zoom">
            <button id="vZoomIn" title="Zoom in — see more detail">${H.icon('plus', 14)}</button>
            <button id="vZoomFit" class="fit" title="Fit the whole video">Fit</button>
          </div>
        </div>
      </section>
      <aside class="props" id="propsWrap">
        <div class="sheet-handle"></div>
        <button class="panel-close icon-btn" id="vInspClose" title="Hide">${H.icon('x')}</button>
        <div class="panel-body" id="vInspector"></div>
      </aside>
    </div>
    <input type="file" id="vFile" accept="video/*,image/*,audio/*" multiple class="file-hide" tabindex="-1">
  </div>`;
}

function syncPanels() {
  const ed = $('#editor');
  if (!ed) return;
  ed.classList.toggle('panel-closed', !V.panelOpen);
  ed.classList.toggle('props-open', !!V.inspectorOpen);
  $$('[data-vtab]').forEach((t) => t.classList.toggle('active', V.panelOpen && t.dataset.vtab === V.tab));
  requestAnimationFrame(fitPreview);
}
function closePanel() {
  V.panelOpen = false;
  syncPanels();
}
function openInspector() {
  V.inspectorOpen = true;
  V.panelOpen = H.isMobile() ? false : V.panelOpen;
  syncPanels();
}

function bindUI() {
  $('#vHome').onclick = async () => {
    await save();
    closeVideoEditor();
    H.goHome();
  };
  $('#vUndo').onclick = undo;
  $('#vRedo').onclick = redo;
  $('#vTitle').oninput = (e) => {
    V.p.name = e.target.value || 'Untitled video';
    scheduleSave();
  };
  $('#vExport').onclick = openExport;
  $('#vPlay').onclick = () => { V.stopAt = null; setPlaying(!V.playing); };
  $('#vBack').onclick = () => seek(V.t - 1);
  $('#vFwd').onclick = () => seek(V.t + 1);
  $('#vSplit').onclick = splitAtPlayhead;
  $('#vDup').onclick = duplicateSel;
  $('#vDel').onclick = deleteSel;
  bindTimelineZoom();
  // "Edit" toggles the right panel; with nothing selected it shows the video settings
  $('#vInspToggle').onclick = () => {
    V.inspectorOpen = !V.inspectorOpen;
    V.inspClosedByUser = !V.inspectorOpen;
    V.inspPinned = V.inspectorOpen && !V.sel;
    if (H.isMobile() && V.inspectorOpen) V.panelOpen = false;
    renderInspector();
    syncPanels();
  };
  $('#vInspClose').onclick = () => { V.inspectorOpen = false; V.inspClosedByUser = true; V.inspPinned = false; syncPanels(); };
  $('#vPanelClose').onclick = closePanel;
  $$('[data-vtab]').forEach((t) =>
    (t.onclick = () => {
      if (V.tab === t.dataset.vtab && V.panelOpen) return closePanel();
      V.tab = t.dataset.vtab;
      V.panelOpen = true;
      if (H.isMobile()) V.inspectorOpen = false;
      syncPanels();
      renderPanel();
    })
  );
  $('#vFile').onchange = (e) => {
    importFiles([...e.target.files]);
    e.target.value = '';
  };
  const ed = $('#editor');
  ed.addEventListener('dragover', (e) => e.preventDefault());
  ed.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) importFiles(files);
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', sizeCanvas);
  new ResizeObserver(fitPreview).observe($('#vStage'));
  bindPreviewPointer();
  bindPreviewZoom();
}

// ---------- preview zoom (pinch / Ctrl+scroll), view only: the video itself is unchanged ----------
function applyView() {
  const v = V.view || (V.view = { z: 1, x: 0, y: 0 });
  if (v.z <= 1.001) {
    v.z = 1;
    v.x = 0;
    v.y = 0;
  }
  V.canvas.style.transform = v.z === 1 ? '' : `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
  const chip = $('#vViewFit');
  if (chip) {
    chip.hidden = v.z === 1;
    $('#vViewPct').textContent = `${Math.round(v.z * 100)}%`;
  }
}
/** Zoom the preview to z, keeping the screen point (mx, my) over the same spot of the video. */
function zoomViewAt(z, mx, my, panX = 0, panY = 0) {
  const v = V.view || (V.view = { z: 1, x: 0, y: 0 });
  const r = V.canvas.getBoundingClientRect();
  // untransformed centre of the canvas (scaling is about the centre)
  const cx = r.left + r.width / 2 - v.x;
  const cy = r.top + r.height / 2 - v.y;
  const nz = clamp(z, 1, 6);
  // video point under (mx, my), relative to the centre, before zooming
  const px = (mx - cx - v.x) / v.z;
  const py = (my - cy - v.y) / v.z;
  v.x = mx + panX - cx - nz * px;
  v.y = my + panY - cy - nz * py;
  v.z = nz;
  // don't let the video slide completely off the stage
  const maxX = (V.canvas.offsetWidth * (nz - 1)) / 2 + 40;
  const maxY = (V.canvas.offsetHeight * (nz - 1)) / 2 + 40;
  v.x = clamp(v.x, -maxX, maxX);
  v.y = clamp(v.y, -maxY, maxY);
  applyView();
}
function resetView() {
  V.view = { z: 1, x: 0, y: 0 };
  applyView();
}
function bindPreviewZoom() {
  const stage = $('#vStage');
  V.view = { z: 1, x: 0, y: 0 };
  $('#vViewFit').onclick = resetView;
  stage.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomViewAt(V.view.z * Math.exp(-clamp(e.deltaY, -60, 60) * 0.005), e.clientX, e.clientY);
    },
    { passive: false }
  );
  let pinch = null;
  let lastTap = 0;
  const mid = (ts) => ({ x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 });
  const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  stage.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        pinch = { d: dist(e.touches), z: V.view.z, m: mid(e.touches) };
        V.viewPinch = true;
      } else if (e.touches.length === 1 && V.view.z > 1) {
        // double-tap the stage to show the whole video again
        const now = Date.now();
        if (now - lastTap < 300) resetView();
        lastTap = now;
      }
    },
    { capture: true, passive: true }
  );
  stage.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 2) return;
      if (!pinch) {
        pinch = { d: dist(e.touches), z: V.view.z, m: mid(e.touches) };
        V.viewPinch = true;
      }
      e.preventDefault();
      const m = mid(e.touches);
      zoomViewAt((pinch.z * dist(e.touches)) / Math.max(10, pinch.d), pinch.m.x, pinch.m.y, m.x - pinch.m.x, m.y - pinch.m.y);
      pinch.m = m;
      pinch.z = V.view.z;
      pinch.d = dist(e.touches);
    },
    { capture: true, passive: false }
  );
  const end = (e) => {
    if (e.touches.length < 2 && pinch) {
      pinch = null;
      setTimeout(() => V && (V.viewPinch = false), 80);
    }
  };
  stage.addEventListener('touchend', end, { capture: true, passive: true });
  stage.addEventListener('touchcancel', end, { capture: true, passive: true });
}

function onKey(e) {
  if (!V || V.exporting) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); setPlaying(!V.playing); }
  else if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) { e.preventDefault(); redo(); }
  else if (mod && k === 'd') { e.preventDefault(); duplicateSel(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  else if (k === 's' && !mod) splitAtPlayhead();
  else if (k === 'arrowleft') seek(V.t - (e.shiftKey ? 1 : 1 / 30));
  else if (k === 'arrowright') seek(V.t + (e.shiftKey ? 1 : 1 / 30));
}

// Drag text/stickers on the preview; drag the corner dot to resize.
function bindPreviewPointer() {
  const cv = V.canvas;
  let drag = null;
  // touch: pick a clip only on a clean tap (a finger may be starting a pinch-zoom)
  let pendingTap = null;
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * V.cw, y: ((e.clientY - r.top) / r.height) * V.ch };
  };
  cv.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    const touch = e.pointerType === 'touch';
    pendingTap = null;
    const sel = V.sel?.kind === 'overlay' ? findSel() : null;
    if (sel && V.handle && Math.hypot(p.x - V.handle.x, p.y - V.handle.y) < V.handle.r) {
      const kv = keyed(sel, V.t - sel.start);
      drag = { mode: 'resize', o: sel, start: p, size: sel.type === 'text' ? kv.size : kv.scale, hit: V.hits.find((h) => h.id === sel.id), orig: { x: sel.x, y: sel.y, size: sel.size, scale: sel.scale } };
    } else {
      const hit = [...V.hits].reverse().find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
      if (hit) {
        const o = V.p.overlays.find((x) => x.id === hit.id);
        select({ kind: 'overlay', id: o.id }, { open: !touch });
        const kv = keyed(o, V.t - o.start);
        drag = { mode: 'move', o, start: p, ox: kv.x, oy: kv.y, tapOpen: touch, cx: e.clientX, cy: e.clientY, orig: { x: o.x, y: o.y, size: o.size, scale: o.scale } };
      } else {
        const act = activeClip(V.t);
        const target = act ? { kind: 'clip', id: act.clip.id } : null;
        if (touch) pendingTap = { x: e.clientX, y: e.clientY, sel: target };
        else select(target, { open: true });
      }
    }
    if (drag) cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (pendingTap && (V.viewPinch || Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y) > 10)) pendingTap = null;
    if (!drag) return;
    if (V.viewPinch) {
      // a pinch started: put the item back where it was and stop dragging it
      if (!drag.o.keys?.length) Object.assign(drag.o, drag.orig);
      drag = null;
      return;
    }
    if (drag.tapOpen && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 8) drag.tapOpen = false;
    const p = pos(e);
    if (drag.mode === 'move') {
      const nx = clamp(drag.ox + (p.x - drag.start.x) / V.cw, -0.2, 1.2);
      const ny = clamp(drag.oy + (p.y - drag.start.y) / V.ch, -0.2, 1.2);
      if (drag.o.keys?.length) setKeyValue(drag.o, { x: nx, y: ny });
      else { drag.o.x = nx; drag.o.y = ny; }
    } else {
      const h = drag.hit;
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h / 2;
      const d0 = Math.hypot(drag.start.x - cx, drag.start.y - cy);
      const d1 = Math.hypot(p.x - cx, p.y - cy);
      const f = clamp(d1 / Math.max(1, d0), 0.1, 10);
      const key = drag.o.type === 'text' ? 'size' : 'scale';
      const v = clamp(drag.size * f, key === 'size' ? 0.01 : 0.03, key === 'size' ? 0.5 : 2);
      if (drag.o.keys?.length) setKeyValue(drag.o, { [key]: v });
      else drag.o[key] = v;
    }
  });
  const end = (e) => {
    const pinched = V.viewPinch;
    if (pendingTap && e.type === 'pointerup' && !pinched) select(pendingTap.sel, { open: true });
    pendingTap = null;
    if (drag) {
      const tap = drag.tapOpen && e.type === 'pointerup' && !pinched;
      const sel = { kind: 'overlay', id: drag.o.id };
      drag = null;
      commit();
      if (tap) select(sel, { open: true });
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

// ---------- timeline ----------
function lanes(items, endOf) {
  const out = [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const laneEnds = [];
  for (const it of sorted) {
    let l = laneEnds.findIndex((e) => e <= it.start + 0.001);
    if (l === -1) {
      l = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[l] = it.start + endOf(it);
    out.push([it, l]);
  }
  return { out, count: laneEnds.length };
}

const PPS_MIN = 4;
const PPS_MAX = 600;
// slider position (0–100) <-> pixels per second, on a log scale
const ppsToZ = (pps) => Math.round((Math.log(pps / PPS_MIN) / Math.log(PPS_MAX / PPS_MIN)) * 100);
const zToPps = (z) => PPS_MIN * Math.pow(PPS_MAX / PPS_MIN, z / 100);
function fitTimeline() {
  const sc = $('#tlScroll');
  if (!sc) return;
  // the timeline can be hidden (phones, while a sheet is open): use the window width then
  const w = (sc.clientWidth || window.innerWidth) - 40;
  V.pps = clamp(w / Math.max(1, totalDur() + 0.5), PPS_MIN, 200);
  syncZoomUI();
}
function syncZoomUI() {
  const z = $('#vZoom');
  if (z) z.value = ppsToZ(V.pps);
}
/** Zoom the timeline, keeping the time under anchorX (or the playhead) in place. */
function setTimelineZoom(pps, anchorX, { live = false } = {}) {
  const sc = $('#tlScroll');
  if (!sc || !V) return;
  const old = V.pps;
  pps = clamp(pps, PPS_MIN, PPS_MAX);
  if (Math.abs(pps - old) < 0.01) return;
  const r = sc.getBoundingClientRect();
  let ax = anchorX;
  if (ax == null) {
    const px = V.t * old - sc.scrollLeft;
    ax = r.left + (px >= 0 && px <= sc.clientWidth ? px : sc.clientWidth / 2);
  }
  const tAt = (sc.scrollLeft + ax - r.left) / old;
  V.pps = pps;
  if (live) relayoutTimeline();
  else renderTimeline();
  sc.scrollLeft = Math.max(0, tAt * pps - (ax - r.left));
  syncZoomUI();
}
/** Resize the timeline in place (used while pinching, so the touched element is not replaced). */
function relayoutTimeline() {
  const inner = $('#tlInner');
  if (!inner) return;
  const pps = V.pps;
  const total = totalDur();
  inner.style.width = `${Math.max((total + 6) * pps, ($('#tlScroll')?.clientWidth || 600) - 10)}px`;
  const step = pps > 150 ? 0.5 : pps > 90 ? 1 : pps > 40 ? 2 : pps > 18 ? 5 : pps > 8 ? 10 : 30;
  let ticks = '';
  for (let x = 0; x <= total + 6; x += step) ticks += `<span class="tl-tick" style="left:${x * pps}px">${step < 1 ? fmt(x) : fmt(x).replace(/\.\d$/, '')}</span>`;
  const ruler = $('#tlRuler', inner);
  if (ruler) ruler.innerHTML = ticks;
  const starts = clipStarts();
  const place = (id, start, dur) => {
    const el = inner.querySelector(`.tl-block[data-id="${id}"]`);
    if (el) {
      el.style.left = `${start * pps}px`;
      el.style.width = `${Math.max(6, dur * pps - 2)}px`;
    }
  };
  V.p.clips.forEach((c, i) => place(c.id, starts[i], clipDur(c)));
  [...V.p.overlays, ...(V.p.effects || [])].forEach((o) => place(o.id, o.start, o.dur));
  V.p.audio.forEach((a) => place(a.id, a.start, a.out - a.in));
  $$('.tl-junc', inner).forEach((b) => (b.style.left = `${starts[+b.dataset.junc] * pps - 11}px`));
  const ph = $('#tlPlayhead', inner);
  if (ph) ph.style.transform = `translateX(${V.t * pps}px)`;
}
function bindTimelineZoom() {
  $('#vZoomIn').onclick = () => setTimelineZoom(V.pps * 1.5);
  $('#vZoomOut').onclick = () => setTimelineZoom(V.pps / 1.5);
  $('#vZoomFit').onclick = () => {
    fitTimeline();
    renderTimeline();
    $('#tlScroll').scrollLeft = 0;
  };
  $('#vZoom').oninput = (e) => setTimelineZoom(zToPps(+e.target.value));
  const sc = $('#tlScroll');
  // Ctrl/Cmd + wheel and trackpad pinch (which arrives as ctrl + wheel)
  sc.addEventListener(
    'wheel',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setTimelineZoom(V.pps * Math.exp(-clamp(e.deltaY, -60, 60) * 0.004), e.clientX);
    },
    { passive: false }
  );
  bindPinch();
}

// Two-finger pinch on the timeline. Listens on the whole page: the second finger may land on
// something else (a sheet, a button), and the element under the first finger may be redrawn.
let pinchBound = false;
function bindPinch() {
  if (pinchBound) return;
  pinchBound = true;
  let pinch = null;
  let fromTimeline = false;
  const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const inTimeline = (touch) => {
    const sc = document.getElementById('tlScroll');
    if (!sc) return false;
    const r = sc.getBoundingClientRect();
    return touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom;
  };
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!V) return;
      V.touches = e.touches.length;
      if (e.touches.length === 1) fromTimeline = inTimeline(e.touches[0]);
      if (e.touches.length === 2 && (fromTimeline || inTimeline(e.touches[1]))) {
        pinch = { d: dist(e.touches), pps: V.pps };
        V.pinching = true;
      }
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!V || e.touches.length !== 2) return;
      if (!pinch) {
        if (!fromTimeline && !inTimeline(e.touches[0])) return;
        pinch = { d: dist(e.touches), pps: V.pps };
        V.pinching = true;
      }
      e.preventDefault();
      const mid = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      setTimelineZoom((pinch.pps * dist(e.touches)) / Math.max(10, pinch.d), mid, { live: true });
    },
    { capture: true, passive: false }
  );
  const end = (e) => {
    if (!V) return;
    V.touches = e.touches.length;
    if (e.touches.length < 2 && pinch) {
      pinch = null;
      V.pinchEnd = Date.now();
      setTimeout(() => {
        if (!V) return;
        V.pinching = false;
        renderTimeline();
      }, 60);
    }
    if (!e.touches.length) fromTimeline = false;
  };
  document.addEventListener('touchend', end, { capture: true, passive: true });
  document.addEventListener('touchcancel', end, { capture: true, passive: true });
}

function renderTimeline() {
  const inner = $('#tlInner');
  if (!inner || !V) return;
  const pps = V.pps;
  const total = totalDur();
  const width = Math.max((total + 6) * pps, ($('#tlScroll')?.clientWidth || 600) - 10);
  const starts = clipStarts();
  const ov = lanes(V.p.overlays, (o) => o.dur);
  const au = lanes(V.p.audio, (a) => a.out - a.in);
  const fx = lanes(V.p.effects || [], (e) => e.dur);
  const step = pps > 150 ? 0.5 : pps > 90 ? 1 : pps > 40 ? 2 : pps > 18 ? 5 : pps > 8 ? 10 : 30;
  let ticks = '';
  for (let s = 0; s <= total + 6; s += step) ticks += `<span class="tl-tick" style="left:${s * pps}px">${step < 1 ? fmt(s) : fmt(s).replace(/\.\d$/, '')}</span>`;
  const isSel = (kind, id) => V.sel?.kind === kind && V.sel.id === id;
  const clipBlocks = V.p.clips
    .map((c, i) => {
      const m = V.meta.get(c.mediaId) || {};
      const d = clipDur(c);
      const tr = '';
      const bg = c.type === 'color' ? `background:${c.color}` : m.thumb ? `background-image:url(${m.thumb})` : '';
      const name = c.type === 'color' ? (c.slot ? `Clip ${c.slot}` : 'Color') : m.name || c.type;
      return `<div class="tl-block clip ${isSel('clip', c.id) ? 'sel' : ''}" data-kind="clip" data-id="${c.id}" style="left:${starts[i] * pps}px;width:${Math.max(6, d * pps - 2)}px;${bg}">
        ${tr}<span class="tl-label">${H.esc(name)} · ${d.toFixed(1)}s${hasCurve(c) ? ` · ${H.esc(curveName(c.curve.id))}` : c.speed && c.speed !== 1 ? ` · ${c.speed}×` : ''}${c.rev ? ' · ⟲' : ''}${c.stab && c.stab.mediaId === c.mediaId ? ' · ◎' : ''}${c.effect && c.effect !== 'none' ? ' · ✦' : ''}</span><i class="h-l"></i><i class="h-r"></i></div>`;
    })
    .join('');
  const ovBlocks = ov.out
    .map(([o, l]) => `<div class="tl-block ov ${o.type} ${isSel('overlay', o.id) ? 'sel' : ''}" data-kind="overlay" data-id="${o.id}" style="left:${o.start * pps}px;width:${Math.max(6, o.dur * pps - 2)}px;top:${l * 30}px">
      <span class="tl-label">${o.type === 'text' ? (o.caption ? 'CC ' : 'T  ') + H.esc((o.text || '').split('\n')[0]) : o.type === 'video' ? '▶ Video overlay' : o.emoji || 'Image'}${o.keys?.length ? ' ◆' : ''}</span><i class="h-l"></i><i class="h-r"></i></div>`)
    .join('');
  const juncs = V.p.clips
    .slice(1)
    .map((c, j) => {
      const i = j + 1;
      const has = c.transition?.type && c.transition.type !== 'none';
      const name = has ? (TRANSITIONS.find(([id]) => id === c.transition.type) || [, c.transition.type])[1] : 'Add transition';
      return `<button class="tl-junc ${has ? 'on' : ''} ${V.tab === 'transitions' && V.trIdx === i && V.panelOpen ? 'cur' : ''}" data-junc="${i}" style="left:${starts[i] * pps - 11}px" title="${H.esc(name)}">${H.icon(has ? 'transition' : 'plus', 12)}</button>`;
    })
    .join('');
  const fxBlocks = fx.out
    .map(([e, l]) => `<div class="tl-block fx ${e.kind === 'body' ? 'body' : ''} ${isSel('effect', e.id) ? 'sel' : ''}" data-kind="effect" data-id="${e.id}" style="left:${e.start * pps}px;width:${Math.max(6, e.dur * pps - 2)}px;top:${l * 30}px">
      <span class="tl-label">${e.kind === 'body' ? '☺' : '✦'} ${H.esc(fxName(e.fx))}</span><i class="h-l"></i><i class="h-r"></i></div>`)
    .join('');
  const auBlocks = au.out
    .map(([a, l]) => `<div class="tl-block au ${isSel('audio', a.id) ? 'sel' : ''}" data-kind="audio" data-id="${a.id}" style="left:${a.start * pps}px;width:${Math.max(6, (a.out - a.in) * pps - 2)}px;top:${l * 30}px">
      ${beatMarks(a, pps)}<span class="tl-label">♪ ${H.esc(a.name || 'Audio')}${a.voice ? ` · ${H.esc(voiceName(a.voice))}` : ''}${a.bpm ? ` · ${Math.round(a.bpm)} BPM` : ''}</span><i class="h-l"></i><i class="h-r"></i></div>`)
    .join('');
  inner.style.width = `${width}px`;
  inner.innerHTML = `
    <div class="tl-ruler" id="tlRuler">${ticks}</div>
    ${fx.count ? `<div class="tl-row tl-fx" style="height:${fx.count * 30}px">${fxBlocks}</div>` : ''}
    <div class="tl-row tl-ov" style="height:${Math.max(1, ov.count) * 30 + 6}px">${ovBlocks || '<span class="tl-empty">Text & stickers</span>'}</div>
    <div class="tl-row tl-main">${clipBlocks || '<span class="tl-empty">Drop videos & photos here</span>'}${juncs}</div>
    <div class="tl-row tl-au" style="height:${Math.max(1, au.count) * 30 + 6}px">${auBlocks || '<span class="tl-empty">Music & voice-over</span>'}</div>
    <div class="tl-playhead" id="tlPlayhead" style="transform:translateX(${V.t * pps}px)"><i></i></div>`;
  bindTimeline(inner);
}

/** Small beat markers inside an audio block (every 2nd/4th one when zoomed far out). */
function beatMarks(a, pps) {
  const bs = (a.beats || []).filter((b) => b >= a.in && b <= a.out);
  if (!bs.length) return '';
  const gap = bs.length > 1 ? ((bs[bs.length - 1] - bs[0]) / (bs.length - 1)) * pps : 99;
  const every = gap >= 5 ? 1 : gap >= 2.5 ? 2 : 4;
  return `<span class="tl-beats" aria-hidden="true">${bs.filter((_, i) => i % every === 0).map((b, i) => `<i class="${(i * every) % 4 === 0 ? 'bar' : ''}" style="left:${((b - a.in) * pps).toFixed(1)}px"></i>`).join('')}</span>`;
}
/** Beat times on the timeline from every audio track that has them. */
const allBeats = () => V.p.audio.flatMap(trackBeats).sort((x, y) => x - y);

function bindTimeline(inner) {
  const pps = V.pps;
  const x2t = (clientX) => {
    const r = inner.getBoundingClientRect();
    return (clientX - r.left) / pps;
  };
  // seek on ruler / empty area
  $$('.tl-junc', inner).forEach((b) => {
    b.onpointerdown = (e) => e.stopPropagation();
    b.onclick = (e) => {
      e.stopPropagation();
      openTransitions(+b.dataset.junc);
    };
  });
  inner.onpointerdown = (e) => {
    if (e.target.closest('.tl-block') || e.target.closest('.tl-junc') || V.pinching) return;
    if (e.pointerType === 'touch') {
      // touch: a tap moves the playhead; a drag scrolls; two fingers zoom. Act only on a clean tap,
      // so the timeline isn't redrawn under a finger that may be starting a pinch.
      const x0 = e.clientX;
      const y0 = e.clientY;
      const onRuler = !!e.target.closest('.tl-ruler');
      const up = (ev) => {
        window.removeEventListener('pointerup', up);
        if (!V || V.pinching || V.touches > 1 || Date.now() - (V.pinchEnd || 0) < 400) return;
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) return;
        seek(x2t(ev.clientX));
        if (!onRuler) select(null);
      };
      window.addEventListener('pointerup', up);
      return;
    }
    seek(x2t(e.clientX));
    const move = (ev) => seek(x2t(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    if (!e.target.closest('.tl-ruler')) select(null);
  };
  $$('.tl-block', inner).forEach((b) => {
    b.onpointerdown = (e) => {
      e.stopPropagation();
      const kind = b.dataset.kind;
      const id = b.dataset.id;
      if (!(V.sel?.kind === kind && V.sel.id === id)) {
        V.sel = { kind, id };
        renderInspector();
        $$('.tl-block.sel', inner).forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        if (!H.isMobile() && !V.inspClosedByUser && !V.inspectorOpen) openInspector();
      }
      const item = findSel();
      const mode = e.target.classList.contains('h-l') ? 'l' : e.target.classList.contains('h-r') ? 'r' : 'm';
      const x0 = e.clientX;
      const orig = structuredClone(item);
      const meta = V.meta.get(item.mediaId) || {};
      let moved = false;
      b.setPointerCapture(e.pointerId);
      b.onpointermove = (ev) => {
        if (V.pinching || V.touches > 1) {
          if (moved) {
            Object.assign(item, structuredClone(orig));
            moved = false;
            b.style.transform = '';
            b.classList.remove('dragging');
          }
          return;
        }
        const dt = (ev.clientX - x0) / pps;
        if (Math.abs(ev.clientX - x0) > 3) moved = true;
        if (!moved) return;
        if (kind === 'clip') {
          if (mode === 'm') {
            b.style.transform = `translateX(${ev.clientX - x0}px)`;
            b.classList.add('dragging');
            return;
          }
          const sp = item.type === 'video' ? 1 / timePerSrc(item) : 1;
          if (item.type === 'image' || item.type === 'color') {
            item.dur = clamp(orig.dur + (mode === 'r' ? dt : -dt), 0.3, 120);
          } else if (mode === 'l') {
            item.in = clamp(orig.in + dt * sp, 0, item.out - 0.2);
          } else {
            item.out = clamp(orig.out + dt * sp, item.in + 0.2, meta.duration || orig.out);
          }
          // snap the clip's end to a beat marker within ~8 px
          const beats = allBeats();
          b.classList.remove('snap');
          if (beats.length) {
            const ci = V.p.clips.indexOf(item);
            const end = clipStarts()[ci] + clipDur(item);
            let near = beats[0];
            for (const x of beats) if (Math.abs(x - end) < Math.abs(near - end)) near = x;
            const delta = near - end;
            if (Math.abs(delta) * pps <= 8 && Math.abs(delta) > 1e-4) {
              if (item.type === 'image' || item.type === 'color') item.dur = Math.max(0.3, item.dur + delta);
              else if (mode === 'l') item.in = clamp(item.in - delta * sp, 0, item.out - 0.2);
              else item.out = clamp(item.out + delta * sp, item.in + 0.2, meta.duration || item.out + delta * sp);
              b.classList.add('snap');
            }
          }
        } else if (kind === 'overlay' || kind === 'effect') {
          if (mode === 'm') item.start = Math.max(0, orig.start + dt);
          else if (mode === 'l') {
            const ns = clamp(orig.start + dt, 0, orig.start + orig.dur - 0.2);
            item.dur = orig.dur - (ns - orig.start);
            item.start = ns;
          } else item.dur = Math.max(0.2, orig.dur + dt);
        } else {
          if (mode === 'm') item.start = Math.max(0, orig.start + dt);
          else if (mode === 'l') {
            const ni = clamp(orig.in + dt, 0, orig.out - 0.2);
            item.start = Math.max(0, orig.start + (ni - orig.in));
            item.in = ni;
          } else item.out = clamp(orig.out + dt, item.in + 0.2, meta.duration || orig.out + dt);
        }
        renderTimelineLive();
      };
      b.onpointerup = (ev) => {
        b.onpointermove = null;
        b.onpointerup = null;
        b.classList.remove('snap');
        const pinched = V.pinching || V.touches > 1 || Date.now() - (V.pinchEnd || 0) < 400;
        if (pinched) {
          if (moved) Object.assign(item, structuredClone(orig));
          renderTimeline();
          return;
        }
        if (kind === 'clip' && mode === 'm' && moved) {
          // reorder: drop position decides new index
          const t = x2t(ev.clientX);
          const starts = clipStarts();
          const from = V.p.clips.indexOf(item);
          let to = V.p.clips.findIndex((c, i) => t < starts[i] + clipDur(c) / 2);
          if (to === -1) to = V.p.clips.length;
          V.p.clips.splice(from, 1);
          if (to > from) to--;
          V.p.clips.splice(to, 0, item);
        }
        if (moved) commit();
        else if (kind === 'clip' || kind === 'overlay' || kind === 'audio' || kind === 'effect') {
          // a click selects and seeks into the item
          const t = x2t(ev.clientX);
          seek(t);
          renderTimeline();
          if (H.isMobile()) openInspector();
        }
      };
    };
  });
}
let liveRaf;
function renderTimelineLive() {
  cancelAnimationFrame(liveRaf);
  liveRaf = requestAnimationFrame(() => {
    // keep the dragged element (pointer capture) — only update positions
    const pps = V.pps;
    const starts = clipStarts();
    V.p.clips.forEach((c, i) => {
      const el = $(`.tl-block[data-id="${c.id}"]`);
      if (el && !el.classList.contains('dragging')) {
        el.style.left = `${starts[i] * pps}px`;
        el.style.width = `${Math.max(6, clipDur(c) * pps - 2)}px`;
        const lb = el.querySelector('.tl-label');
        if (lb) lb.textContent = `${(V.meta.get(c.mediaId) || {}).name || c.type} · ${clipDur(c).toFixed(1)}s`;
      }
    });
    [...V.p.overlays, ...(V.p.effects || [])].forEach((o) => {
      const el = $(`.tl-block[data-id="${o.id}"]`);
      if (el) { el.style.left = `${o.start * pps}px`; el.style.width = `${Math.max(6, o.dur * pps - 2)}px`; }
    });
    V.p.audio.forEach((a) => {
      const el = $(`.tl-block[data-id="${a.id}"]`);
      if (el) { el.style.left = `${a.start * pps}px`; el.style.width = `${Math.max(6, (a.out - a.in) * pps - 2)}px`; }
    });
  });
}

// ---------- left panel ----------
async function renderPanel() {
  const p = $('#vPanel');
  if (!p || !V) return;
  const tab = V.tab;
  if (tab === 'media') {
    const items = V.p.mediaIds.map((id) => [id, V.meta.get(id)]).filter(([, m]) => m && m.type !== 'audio');
    p.innerHTML = `<h3>Media</h3>
      <label class="btn primary block" id="vImport" for="vFile" role="button" tabindex="0">${H.icon('upload')} Import videos & photos</label>
      <p class="muted">Or drag files anywhere onto the editor. Click a file to add it to the end of your video.</p>
      <div class="link-import"><input class="search" id="vLink" type="url" placeholder="Paste a link to a video, photo or audio file" spellcheck="false"><button class="btn ghost small" id="vLinkGo">Add</button></div>
      <p class="muted small-note" id="vLinkStatus">Works with direct file links (ending in .mp4, .mov, .webm, .mp3, .jpg…).</p>
      <div class="v-media">${items.map(([id, m]) => `<div class="v-media-wrap"><button class="v-media-item" data-mid="${id}" title="Add ${H.esc(m.name)} to the end${m.credit ? ` · ${H.esc(creditLine(m.credit))}` : ''}">${m.thumb ? `<img src="${m.thumb}" alt="">` : ''}<span>${m.type === 'video' ? fmt(m.duration).replace(/\.\d$/, '') : 'Photo'}</span></button><button class="v-pip" data-pip="${id}" title="Add as overlay (picture-in-picture)">PiP</button></div>`).join('') || '<p class="muted">Nothing imported yet.</p>'}</div>
      <p class="muted mt"><b>PiP</b> puts a video or photo on top of your main video — use it for reactions, logos or green-screen clips.</p>
      <h4>Blank clip</h4>
      <div class="row"><input type="color" id="vColorClip" value="#111111"><button class="btn ghost small" id="vAddColor">Add color clip (3s)</button></div>
      <h4 id="vStockHead">Stock videos</h4>
      <p class="muted">Free videos to use in your edits. Tap one to add it to the end.</p>
      <div id="vStock" class="stock"></div>`;
    renderStockVideos($('#vStock', p), {
      H, inPreview: IN_PREVIEW,
      addVideo: async (file, credit) => {
        const m = await importFile(file, { credit });
        if (!m) return;
        if (m.type !== 'video') return H.toast('That file is not a video');
        const wasEmpty = !V.p.clips.length;
        addClip(m.id, 'video', m.duration);
        if (wasEmpty) fitTimeline();
        commit();
        H.toast(`Added “${credit.title || 'stock video'}”`);
        if (V.tab === 'media') {
          // show it in the imported list, keeping the panel where it was scrolled to
          const top = p.scrollTop;
          await renderPanel();
          p.scrollTop = top;
        }
      },
    });
    const go = () => importFromLink($('#vLink', p).value.trim(), (m) => { const st = $('#vLinkStatus'); if (st) st.textContent = m; });
    $('#vLinkGo', p).onclick = go;
    $('#vLink', p).onkeydown = (e) => e.key === 'Enter' && go();
    $$('[data-mid]', p).forEach((b) => (b.onclick = () => {
      const m = V.meta.get(b.dataset.mid);
      addClip(b.dataset.mid, m.type, m.duration);
      commit();
    }));
    $$('[data-pip]', p).forEach((b) => (b.onclick = async () => {
      const id = b.dataset.pip;
      const m = V.meta.get(id);
      if (m.type === 'video') addOverlay({ type: 'video', mediaId: id, in: 0, dur: Math.min(m.duration, 10), scale: 0.45, x: 0.7, y: 0.3, volume: 1, animIn: 'pop' });
      else addOverlay({ type: 'image', mediaId: id, scale: 0.45, x: 0.7, y: 0.3, animIn: 'pop' });
      await prepareAll();
    }));
    $('#vAddColor', p).onclick = () => {
      V.p.clips.push({ id: uid(), type: 'color', color: $('#vColorClip', p).value, dur: 3, speed: 1, fit: 'fill', filter: 'none', adjust: {}, effect: 'none', transition: { type: 'none', dur: 0.5 } });
      commit();
    };
  } else if (tab === 'text') {
    p.innerHTML = `<h3>Text</h3><p class="muted">Added at the playhead for 3 seconds. Drag it on the video to move it; drag the dot to resize.</p>
      <div class="v-text-grid">${TEXT_PRESETS.map((t, i) => `<button class="v-text-item" data-tp="${i}" style="font-family:'${t.font}';font-weight:${t.weight};${t.italic ? 'font-style:italic;' : ''}color:${t.bg ? '#111' : t.color === '#ffffff' || t.color === '#fdf4ff' ? '#fff' : t.color};${t.bg ? `background:${t.bg};${t.bg === '#7c3aed' ? 'color:#fff;' : ''}` : 'background:#1f1a2e;'}${t.stroke ? '-webkit-text-stroke:1px #000;' : ''}${t.glow ? `text-shadow:0 0 8px ${t.glow};` : ''}">${H.esc(t.label)}</button>`).join('')}</div>`;
    $$('[data-tp]', p).forEach((b) => (b.onclick = () => addText(TEXT_PRESETS[+b.dataset.tp])));
  } else if (tab === 'elements') {
    p.innerHTML = `<h3>Elements</h3><h4>Stickers</h4><div class="sticker-grid">${STICKERS.map((s) => `<button class="sticker" data-st="${s}">${s}</button>`).join('')}</div>
      <h4>3D graphics</h4><div class="chips">${PACK_CATS.map(([k, l]) => `<button class="chip ${k === (V.packCat || 'objects') ? 'on' : ''}" data-pc="${k}">${l}</button>`).join('')}</div>
      <div class="lib-grid" id="vPack"><p class="muted">Loading…</p></div>`;
    $$('[data-st]', p).forEach((b) => (b.onclick = () => addOverlay({ type: 'image', emoji: b.dataset.st, scale: 0.2, animIn: 'pop' })));
    $$('[data-pc]', p).forEach((b) => (b.onclick = () => { V.packCat = b.dataset.pc; renderPanel(); }));
    try {
      const items = await loadPack('3d', V.packCat || 'objects');
      const g = $('#vPack', p);
      if (!g) return;
      g.innerHTML = items.slice(0, 120).map((it, i) => `<button class="lib-item" data-pi="${i}" title="${H.esc(it.n)}"><img loading="lazy" src="${it.d}" alt=""></button>`).join('');
      $$('[data-pi]', g).forEach((b) => (b.onclick = () => addOverlay({ type: 'image', src: items[+b.dataset.pi].d, scale: 0.3, animIn: 'pop' })));
    } catch {
      const g = $('#vPack', p);
      if (g) g.innerHTML = '<p class="muted">Could not load graphics.</p>';
    }
  } else if (tab === 'audio') {
    renderAudioPanel(p);
  } else if (tab === 'designs') {
    const list = (await H.listDesigns()).filter((d) => d.kind !== 'video');
    p.innerHTML = `<h3>Your designs</h3><p class="muted">Turn any Artvas design into a video slide. Click a design to add each of its pages as a 3-second photo clip.</p>
      <div class="v-media">${list.map((d) => `<button class="v-media-item" data-did="${d.id}" title="${H.esc(d.name)}">${d.pages?.[0]?.thumb ? `<img src="${d.pages[0].thumb}" alt="">` : ''}<span>${H.esc(d.name)}</span></button>`).join('') || '<p class="muted">No designs yet. Make one from the home page.</p>'}</div>`;
    $$('[data-did]', p).forEach((b) => (b.onclick = async () => {
      H.toast('Adding design…');
      const d = list.find((x) => x.id === b.dataset.did);
      for (let i = 0; i < d.pages.length; i++) {
        const blob = await H.designPageToBlob(d, i);
        const m = await importFile(new File([blob], `${d.name} p${i + 1}.png`, { type: 'image/png' }));
        if (m) addClip(m.id, 'image', 0);
      }
      renderPanel();
      commit();
    }));
  } else if (tab === 'ai') renderAIPanel(p);
  else if (tab === 'templates') renderTemplatesPanel(p);
  else if (tab === 'captions') renderCaptionsPanel(p);
  else if (tab === 'effects') renderEffectsPanel(p);
  else if (tab === 'transitions') renderTransitionsPanel(p);
}

// ---------- Audio panel: music library, sound effects, text to speech ----------
let previewAudio = null;
function stopPreview() {
  if (previewAudio) {
    previewAudio.pause();
    URL.revokeObjectURL(previewAudio.src);
    previewAudio = null;
  }
  $$('.mus-play.on').forEach((b) => b.classList.remove('on'));
}
function playBlob(blob, btn) {
  stopPreview();
  previewAudio = new Audio(URL.createObjectURL(blob));
  previewAudio.play().catch(() => {});
  if (btn) {
    btn.classList.add('on');
    previewAudio.onended = () => btn.classList.remove('on');
  }
}

function renderAudioPanel(p) {
  V.au = V.au || { section: 'music', len: 'auto', seeds: {}, voice: '', lang: 'en', speed: 1, ttsText: '', ttsBusy: false, ttsStatus: '', ttsCaptions: true };
  const a = V.au;
  const sec = a.section;
  const imported = V.p.mediaIds.map((id) => [id, V.meta.get(id)]).filter(([, m]) => m && m.type === 'audio');
  p.innerHTML = `<h3>Audio</h3>
    <div class="seg full wrap">${[['music', 'Music'], ['stock', 'Stock music'], ['sfx', 'Sound effects'], ['tts', 'Text to speech'], ['mine', 'My audio']].map(([id, l]) => `<button data-asec="${id}" class="${sec === id ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="auBody" class="mt"></div>`;
  $$('[data-asec]', p).forEach((b) => (b.onclick = () => { a.section = b.dataset.asec; stopPreview(); stopStockPreview(); renderAudioPanel(p); }));
  const body = $('#auBody', p);
  if (sec === 'stock') {
    body.innerHTML = `<p class="muted">Free music from the stock library. ▶ to listen, Add puts it at the playhead.</p><div id="auStock" class="stock"></div>`;
    renderStockMusic($('#auStock', body), {
      H, inPreview: IN_PREVIEW,
      addAudio: async (file, credit) => {
        const m = await importFile(file, { credit });
        if (!m) return;
        if (m.type !== 'audio') return H.toast('That file is not audio');
        addAudio(m.id, m.duration, V.t >= totalDur() - 0.1 ? 0 : V.t);
        const au = V.p.audio[V.p.audio.length - 1];
        au.name = credit.title || au.name;
        commit();
        H.toast(`Added “${credit.title || 'music'}”`);
      },
    });
    return;
  }

  if (sec === 'music') {
    const vlen = mainDur() ? Math.max(5, Math.ceil(mainDur())) : 30;
    body.innerHTML = `<p class="muted">Original tracks composed by Artvas for you — royalty-free, use them anywhere. Every tap on ⟳ makes a new variation.</p>
      <div class="field"><label>Length</label><div class="seg">${[['auto', `Video (${vlen}s)`], ['15', '15s'], ['30', '30s'], ['60', '60s']].map(([v, l]) => `<button data-mlen="${v}" class="${a.len === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="mus-list">${MUSIC_STYLES.map((s) => `<div class="mus-item" style="--mc:${s.color}">
        <button class="mus-play" data-mprev="${s.id}" title="Preview">${H.icon('play', 16)}</button>
        <div class="mus-meta"><b>${H.esc(s.name)}</b><small>${H.esc(s.mood)} · ${s.bpm[0]}–${s.bpm[1]} BPM</small></div>
        <button class="icon-btn" data-mseed="${s.id}" title="New variation">⟳</button>
        <button class="btn ghost small" data-madd="${s.id}">Add</button></div>`).join('')}</div>
      <p class="muted" id="musStatus"></p>`;
    $$('[data-mlen]', body).forEach((b) => (b.onclick = () => { a.len = b.dataset.mlen; renderAudioPanel(p); }));
    const status = (m) => { const s = $('#musStatus'); if (s) s.textContent = m; };
    const seedOf = (id) => a.seeds[id] || 1;
    $$('[data-mseed]', body).forEach((b) => (b.onclick = () => { a.seeds[b.dataset.mseed] = seedOf(b.dataset.mseed) + 1; H.toast('New variation — preview or add it'); }));
    $$('[data-mprev]', body).forEach((b) => (b.onclick = async () => {
      if (b.classList.contains('on')) return stopPreview();
      status('Composing preview…');
      const { blob, bpm } = await renderMusic(b.dataset.mprev, { duration: 12, seed: seedOf(b.dataset.mprev) });
      status(`Preview · ${bpm} BPM`);
      playBlob(blob, b);
    }));
    $$('[data-madd]', body).forEach((b) => (b.onclick = async () => {
      const st = MUSIC_STYLES.find((s) => s.id === b.dataset.madd);
      const len = a.len === 'auto' ? (mainDur() ? Math.max(5, Math.ceil(mainDur())) : 30) : +a.len;
      b.disabled = true;
      status(`Composing ${st.name} (${len}s)…`);
      const { blob } = await renderMusic(st.id, { duration: len, seed: seedOf(st.id) });
      const m = await importFile(new File([blob], `${st.name} · Artvas Music.wav`, { type: 'audio/wav' }));
      if (m) {
        addAudio(m.id, m.duration, 0);
        const au = V.p.audio[V.p.audio.length - 1];
        au.volume = 0.6;
        au.fadeOut = 2;
        commit();
      }
      b.disabled = false;
      status(`${st.name} added to your video.`);
    }));
  } else if (sec === 'sfx') {
    body.innerHTML = `<p class="muted">Tap to hear, + to add at the playhead.</p>
      <div class="sfx-grid">${SFX.map((s) => `<div class="sfx"><button class="sfx-play" data-sprev="${s.id}">${H.icon('play', 12)} ${H.esc(s.name)}</button><button class="sfx-add" data-sadd="${s.id}" title="Add at playhead">+</button></div>`).join('')}</div>`;
    $$('[data-sprev]', body).forEach((b) => (b.onclick = async () => playBlob((await renderSfx(b.dataset.sprev)).blob)));
    $$('[data-sadd]', body).forEach((b) => (b.onclick = async () => {
      const s = SFX.find((x) => x.id === b.dataset.sadd);
      const { blob } = await renderSfx(s.id);
      const m = await importFile(new File([blob], `${s.name}.wav`, { type: 'audio/wav' }));
      if (m) {
        addAudio(m.id, m.duration, Math.min(V.t, Math.max(0, totalDur() - 0.1)));
        const au = V.p.audio[V.p.audio.length - 1];
        au.fadeOut = 0;
        commit();
        H.toast(`${s.name} added`);
      }
    }));
  } else if (sec === 'tts') {
    a.lang = a.lang || 'en';
    const lang = ONLINE_LANGS.find((l) => l.id === a.lang) || ONLINE_LANGS[0];
    const isLocal = (id) => VOICES.some((x) => x.id === id);
    const allowed = [...lang.voices.map((x) => x.id), ...(a.lang === 'en' ? VOICES.map((x) => x.id) : [])];
    if (!allowed.includes(a.voice)) a.voice = lang.voices[0].id;
    body.innerHTML = `<p class="muted">Natural AI voices, free. Pick a language, then a voice.</p>
      <div class="field"><label>Language</label><select id="ttsLang">${ONLINE_LANGS.map((l) => `<option value="${l.id}" ${l.id === a.lang ? 'selected' : ''}>${H.esc(l.label)}</option>`).join('')}</select></div>
      <textarea class="search ai-prompt" id="ttsText" rows="5" placeholder="${{ 'zh-CN': '输入要朗读的文字…', 'zh-TW': '輸入要朗讀的文字…', 'zh-HK': '輸入要讀出嘅文字…', ms: 'Taip apa yang perlu dibaca…', id: 'Ketik teks yang ingin dibacakan…' }[a.lang] || 'Type what the voice should say…'}">${H.esc(a.ttsText)}</textarea>
      <div class="field mt"><label>Voice</label>
        <div class="voice-grid">${[...lang.voices.map((x) => ({ ...x, online: true })), ...(a.lang === 'en' ? VOICES : [])].map((x) => `<button type="button" class="voice-card ${x.id === a.voice ? 'on' : ''}" data-voice="${x.id}" title="${H.esc(x.name)}${x.online ? '' : ' (on this device)'}"><img src="${faceFor(x)}" alt="" loading="lazy"><b>${H.esc(x.name)}</b><small>${H.esc(x.online ? x.desc.split(' · ').filter((d) => !/^(female|male)$/.test(d)).join(' · ') || x.desc : `${x.accent} · ${x.desc}`)}</small>${x.online ? '' : '<i class="vc-dev" title="Runs on this device">device</i>'}</button>`).join('')}</div>
        <select id="ttsVoice" class="file-hide" tabindex="-1" aria-hidden="true">
        <optgroup label="Online · fast">${lang.voices.map((x) => `<option value="${x.id}" ${x.id === a.voice ? 'selected' : ''}>${H.esc(x.name)} — ${H.esc(x.desc)}</option>`).join('')}</optgroup>
        ${a.lang === 'en' ? `<optgroup label="On this device · private (90 MB download once)">${VOICES.map((x) => `<option value="${x.id}" ${x.id === a.voice ? 'selected' : ''}>${x.name} — ${x.accent} · ${x.desc}</option>`).join('')}</optgroup>` : ''}
      </select></div>
      <div class="field"><label>Speed <b>${a.speed.toFixed(2)}×</b></label><input type="range" id="ttsSpeed" min="0.6" max="1.6" step="0.05" value="${a.speed}"></div>
      <label class="row"><input type="checkbox" id="ttsCap" ${a.ttsCaptions ? 'checked' : ''}> Add matching captions</label>
      <div class="row mt"><button class="btn ghost" id="ttsPrev" ${a.ttsBusy ? 'disabled' : ''}>${H.icon('play', 14)} Preview</button>
        <button class="btn primary" id="ttsAdd" ${a.ttsBusy ? 'disabled' : ''}>${H.icon('music', 14)} Add voice-over</button></div>
      <p class="muted" id="ttsStatus">${H.esc(a.ttsStatus)}</p>
      ${V.sel?.kind === 'overlay' && findSel()?.type === 'text' ? `<button class="btn ghost small" id="ttsFromText">Use the selected text</button>` : ''}`;
    $('#ttsLang', body).onchange = (e) => { a.lang = e.target.value; a.voice = ''; renderAudioPanel(p); };
    $('#ttsText', body).oninput = (e) => (a.ttsText = e.target.value);
    $('#ttsVoice', body).onchange = (e) => { a.voice = e.target.value; $$('.voice-card', body).forEach((c) => c.classList.toggle('on', c.dataset.voice === a.voice)); };
    $$('.voice-card', body).forEach((c) => (c.onclick = () => { a.voice = c.dataset.voice; $('#ttsVoice', body).value = a.voice; $$('.voice-card', body).forEach((x) => x.classList.toggle('on', x === c)); }));
    $('#ttsSpeed', body).oninput = (e) => { a.speed = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = a.speed.toFixed(2) + '×'; };
    $('#ttsCap', body).onchange = (e) => (a.ttsCaptions = e.target.checked);
    const fromText = $('#ttsFromText', body);
    if (fromText) fromText.onclick = () => { a.ttsText = findSel().text; renderAudioPanel(p); };
    const status = (m) => { a.ttsStatus = m; const s = $('#ttsStatus'); if (s) s.textContent = m; };
    const run = async (add) => {
      if (!a.ttsText.trim()) return H.toast('Type what the voice should say first');
      a.ttsBusy = true;
      $('#ttsPrev', body).disabled = true;
      $('#ttsAdd', body).disabled = true;
      try {
        const local = isLocal(a.voice);
        const out = local ? await speak(a.ttsText, { voice: a.voice, speed: a.speed, onStatus: status }) : await speakOnline(a.ttsText, { voice: a.voice, speed: a.speed, onStatus: status });
        if (!add) {
          playBlob(out.blob);
          status(`Preview · ${out.duration.toFixed(1)}s`);
        } else {
          const vName = local ? VOICES.find((x) => x.id === a.voice)?.name : lang.voices.find((x) => x.id === a.voice)?.name;
          const ext = out.blob.type.includes('mpeg') ? 'mp3' : 'wav';
          const m = await importFile(new File([out.blob], `Voice-over (${vName || 'Voice'}).${ext}`, { type: out.blob.type }));
          const at = V.t >= totalDur() - 0.1 ? 0 : V.t;
          if (m) {
            addAudio(m.id, m.duration, at);
            const au = V.p.audio[V.p.audio.length - 1];
            au.fadeOut = 0;
            au.name = `Voice: ${vName || 'Voice'}`;
            if (a.ttsCaptions)
              for (const sg of out.segments) {
                const pieces = scriptToLines(sg.text);
                if (!pieces.length) continue;
                const weights = pieces.map((x) => Math.max(2, x.length));
                const sum = weights.reduce((x, y) => x + y, 0);
                let t0 = at + sg.start;
                pieces.forEach((piece, i) => {
                  const d = ((sg.end - sg.start) * weights[i]) / sum;
                  V.p.overlays.push(captionOverlay(piece, t0, t0 + d));
                  t0 += d;
                });
              }
            commit();
            status(`Voice-over added (${out.duration.toFixed(1)}s)${a.ttsCaptions ? ' with captions' : ''}.`);
          }
        }
      } catch (e) {
        console.error(e);
        status(e.message || 'Voice generation failed');
        H.toast(a.ttsStatus);
      }
      a.ttsBusy = false;
      if ($('#ttsPrev')) { $('#ttsPrev').disabled = false; $('#ttsAdd').disabled = false; }
    };
    $('#ttsPrev', body).onclick = () => run(false);
    $('#ttsAdd', body).onclick = () => run(true);
  } else {
    body.innerHTML = `<button class="btn primary block" id="vImportAudio">${H.icon('music')} Import music or voice-over</button>
      <p class="muted">MP3, WAV, M4A or OGG. Added at the playhead.</p>
      <div class="v-audio-list">${imported.map(([id, m]) => `<button class="v-audio-item" data-aid="${id}">♪ ${H.esc(m.name)} <small>${fmt(m.duration)}</small></button>`).join('') || '<p class="muted">No audio yet.</p>'}</div>`;
    $('#vImportAudio', body).onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      attachPicker(inp);
      inp.accept = 'audio/*';
      inp.multiple = true;
      inp.onchange = async () => {
        for (const f of inp.files) {
          const m = await importFile(f);
          if (m) addAudio(m.id, m.duration, V.t >= totalDur() - 0.1 ? 0 : V.t);
        }
        renderAudioPanel(p);
        commit();
      };
      inp.click();
    };
    $$('[data-aid]', body).forEach((b) => (b.onclick = () => { addAudio(b.dataset.aid, V.meta.get(b.dataset.aid).duration, V.t >= totalDur() - 0.1 ? 0 : V.t); commit(); }));
  }
}

function templateCard(tpl) {
  const dur = templateDuration(tpl);
  const sample = (tpl.layers.find((l) => l.text) || {}).text || tpl.name;
  return `<button class="vt-card" data-vt="${tpl.id}" style="--tc:${tpl.color}">
    <div class="vt-thumb"><span class="vt-sample">${H.esc(sample.split('\n')[0])}</span><span class="vt-meta">${tpl.slots.length} clips · ${dur.toFixed(0)}s</span></div>
    <b>${H.esc(tpl.name)}</b></button>`;
}

// ---------- import from a link ----------
const PAGE_HOSTS = /(^|\.)(tiktok\.com|douyin\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|xiaohongshu\.com|xhslink\.com|bilibili\.com|twitter\.com|x\.com)$/i;
async function importFromLink(raw, status) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return H.toast('Paste a full link starting with https://');
  }
  if (PAGE_HOSTS.test(url.hostname)) {
    status('That is a page on a social app, not a video file. Save the video from the app first (its Share → Save video option), then import the file here.');
    return;
  }
  status('Downloading…');
  let blob;
  try {
    let r;
    try {
      r = await fetch(url.href);
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      // most sites don't allow direct downloads from another page; the Artvas server fetches it instead
      r = await fetch(`api/image-proxy?url=${encodeURIComponent(url.href)}`);
    }
    if (!r.ok) throw new Error(r.status === 413 ? 'That file is over 200 MB.' : r.status === 415 ? "That link isn't a video, photo or audio file." : "Couldn't download that link.");
    blob = await r.blob();
  } catch (e) {
    status(e.message && !/^\d+$/.test(e.message) && !/fetch/i.test(e.message) ? e.message : "Couldn't download that link. Links from your own Artvas site work best.");
    return;
  }
  const ext = (url.pathname.split('.').pop() || '').toLowerCase();
  let type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : '';
  if (!type) type = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'video/mp4';
  const name = decodeURIComponent(url.pathname.split('/').pop() || 'download') || 'download';
  await importFiles([new File([blob], name, { type })]);
  status(`Added ${name}.`);
}

// ---------- caption files ----------
const srtTime = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
function captionList() {
  return V.p.overlays.filter((o) => o.caption && (o.text || '').trim()).sort((a, b) => a.start - b.start);
}
function captionsToSrt(list) {
  return list.map((o, i) => `${i + 1}\n${srtTime(o.start)} --> ${srtTime(o.start + o.dur)}\n${o.text.trim()}\n`).join('\n');
}
function captionsToText(list) {
  // join caption pieces back into sentences (no spaces between Chinese/Japanese pieces)
  let out = '';
  for (const o of list) {
    const t = o.text.trim().replace(/\n/g, ' ');
    const cjk = /[　-鿿가-힯]$/.test(out) && /^[　-鿿가-힯]/.test(t);
    out += out ? (cjk ? '' : ' ') + t : t;
  }
  return out;
}
function saveTextFile(text, name, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  H.download(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** Split a transcribed segment into caption pieces of about n words (or ~10 characters for Chinese/Japanese/Thai). */
function captionPieces(text, n) {
  const t = text.trim();
  if (!t) return [];
  if (!/\s/.test(t) || /[　-鿿]/.test(t)) {
    const size = n >= 99 ? 16 : Math.max(4, n * 2 + 2);
    const out = [];
    for (const part of t.split(/(?<=[，、,。！？!?；;：:])\s*/)) {
      const clean = part.trim();
      for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
    }
    return out.filter(Boolean);
  }
  const words = t.split(/\s+/).filter(Boolean);
  const size = n || 4;
  const groups = [];
  for (let w = 0; w < words.length; w += size) groups.push(words.slice(w, w + size).join(' '));
  return groups;
}
function pushSegments(fresh, segs, at, speed, words) {
  for (const sg of segs) {
    const groups = captionPieces(sg.text, words);
    const t0 = at + sg.start / speed;
    const t1 = at + sg.end / speed;
    const total = groups.reduce((a2, g2) => a2 + g2.length, 0) || 1;
    let cur = t0;
    groups.forEach((g2) => {
      const d = ((t1 - t0) * g2.length) / total;
      fresh.push(captionOverlay(g2, cur, cur + d));
      cur += d;
    });
  }
}

// ---------- effects & transitions ----------
/** Play a short stretch so a newly applied effect or transition is seen right away. */
function previewRange(from, to) {
  seek(Math.max(0, from));
  V.stopAt = Math.min(totalDur(), to);
  setPlaying(true);
  V.stopAt = Math.min(totalDur(), to);
}
function addEffectLayer(kind, id) {
  const cur = findSel();
  if (V.sel?.kind === 'effect' && cur && cur.kind === kind) {
    cur.fx = id;
    if (COLOR_FX[id] && !cur.color) cur.color = COLOR_FX[id];
    commit();
    if (kind === 'body') warmSegmenter();
    previewRange(cur.start, cur.start + Math.min(cur.dur, 2.5));
    return;
  }
  const total = totalDur();
  const start = V.t >= total - 0.1 ? 0 : V.t;
  const act = activeClip(start);
  let dur = kind === 'body' && act ? act.start + clipDur(act.clip) - start : 3;
  if (V.p.clips.length) dur = Math.min(dur, mainDur() - start);
  dur = Math.max(1, dur);
  const e = { id: uid(), kind, fx: id, start, dur, amount: 1 };
  if (COLOR_FX[id]) e.color = COLOR_FX[id];
  V.p.effects.push(e);
  select({ kind: 'effect', id: e.id });
  commit();
  if (kind === 'body') warmSegmenter();
  if (H.isMobile()) closePanel();
  previewRange(start, start + Math.min(dur, 2.5));
  H.toast(`${fxName(id)} added — drag its ends on the timeline to change how long it lasts`);
}
function warmSegmenter() {
  if (segState() === 'ready') return;
  loadSegmenter()
    .then(() => {
      if (!V) return;
      if (V.tab === 'effects') renderPanel();
      renderInspector();
    })
    .catch(() => {
      if (!V) return;
      H.toast(needsSite('Body effects', "Couldn't load body effects. Check your internet connection and try again."));
      if (V.tab === 'effects') renderPanel();
    });
}
function segStatusText() {
  const st = segState();
  return st === 'ready' ? 'Person detection is ready.' : st === 'loading' ? 'Loading person detection (about 3 MB, once)…' : st === 'error' ? (IN_PREVIEW ? needsSite('Person detection', '') : "Person detection couldn't load. Check your internet connection and try again.") : 'Finds the person in your video automatically. Runs on your device.';
}
function renderEffectsPanel(p) {
  const sec = V.fxSec || 'video';
  const cat = V.fxCat || 'All';
  const sel = V.sel?.kind === 'effect' ? findSel() : null;
  const list = sec === 'body' ? BODY_FX : VIDEO_FX.filter((f) => cat === 'All' || f.cat === cat);
  p.innerHTML = `<h3>Effects</h3>
    <div class="seg full"><button data-fsec="video" class="${sec === 'video' ? 'on' : ''}">${H.icon('sparkle', 14)} Video effects</button><button data-fsec="body" class="${sec === 'body' ? 'on' : ''}">${H.icon('person', 14)} Body effects</button></div>
    ${sec === 'video'
      ? `<div class="chips mt">${FX_CATS.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-fcat="${c}">${c}</button>`).join('')}</div>`
      : `<p class="muted mt" id="segStatus">${segStatusText()}</p>`}
    ${sel ? `<p class="fx-hint">Tap an effect to replace <b>${H.esc(fxName(sel.fx))}</b>. <button class="linkish" id="fxNew">Add a new layer instead</button></p>` : `<p class="muted fx-tip">Tap an effect to add it at the playhead. It applies to everything under it on the timeline.</p>`}
    <p class="muted small-note fx-tip">${H.isMobile() ? 'Press and hold a preview to see it move.' : 'Point at a preview to see it move.'}</p>
    <div class="fx-grid">${list.map((f) => `<button class="fx-card ${sel?.fx === f.id ? 'on' : ''}" data-fx-add="${f.id}" title="${H.esc(f.name)}"><span class="fx-pic"><img src="${fxThumb(f.id, sec)}" alt=""></span><span>${H.esc(f.name)}</span></button>`).join('')}</div>`;
  if (!fxSamplesReady()) loadFxSamples().then(() => V && V.tab === 'effects' && renderEffectsPanel(p)).catch(() => {});
  $$('[data-fsec]', p).forEach((b) => (b.onclick = () => { V.fxSec = b.dataset.fsec; if (V.fxSec === 'body') warmSegmenter(); renderEffectsPanel(p); }));
  $$('[data-fcat]', p).forEach((b) => (b.onclick = () => { V.fxCat = b.dataset.fcat; renderEffectsPanel(p); }));
  $$('[data-fx-add]', p).forEach((b) => {
    b.onclick = () => { addEffectLayer(sec, b.dataset.fxAdd); renderEffectsPanel(p); };
    // loop the effect on the sample photo (3 s, or 3.6 s for the countdown)
    const id = b.dataset.fxAdd;
    bindCardPreview(b, (g, w, h, t) => drawFxFrame(g, w, h, sec, id, t % (id === 'countdown' ? 3.6 : 3)));
  });
  const nw = $('#fxNew', p);
  if (nw) nw.onclick = () => { select(null); renderEffectsPanel(p); };
}

const transThumbs = new Map();
const sampleCanvases = new Map();
function sampleFrame(i, w, h) {
  const key = `${i}:${w}x${h}`;
  if (sampleCanvases.has(key)) return sampleCanvases.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawSample(c.getContext('2d'), w, h, i);
  sampleCanvases.set(key, c);
  return c;
}
/**
 * One frame of a transition between the two sample photos.
 * t: 0–1 shows photo A, 1–2 is the transition, 2–3 shows photo B.
 */
function drawTransFrame(g, w, h, type, t) {
  const base = { type: 'image', speed: 1, fit: 'fill', filter: 'none', adjust: {}, effect: 'none' };
  const a = { ...base, id: '__ta', dur: 1 };
  const b = { ...base, id: '__tb', dur: 2, transition: { type, dur: 1 } };
  const saved = { clips: V.p.clips, els: V.els, effects: V.p.effects };
  V.p.clips = [a, b];
  V.p.effects = [];
  V.els = new Map([['__ta', sampleFrame(0, w, h)], ['__tb', sampleFrame(1, w, h)]]);
  try {
    g.save();
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    drawClipWithTransition(g, w, h, clamp(t, 0, 2.99));
    g.restore();
  } catch (e) {
    console.error(e);
  } finally {
    V.p.clips = saved.clips;
    V.p.effects = saved.effects;
    V.els = saved.els;
  }
}
/** Still picture of a transition partway through ('' until the sample photos have loaded). */
function transThumb(type) {
  if (!fxSamplesReady()) return '';
  if (transThumbs.has(type)) return transThumbs.get(type);
  const w = 120;
  const h = 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawTransFrame(c.getContext('2d'), w, h, type, type === 'none' ? 0.5 : 1.42);
  const url = c.toDataURL('image/jpeg', 0.82);
  transThumbs.set(type, url);
  return url;
}
/** Loop: photo A, the transition, photo B. */
function bindTransPreview(card, type) {
  bindCardPreview(card, (g, w, h, t) => {
    const k = t % 2.8;
    // 0.6 s of A, 1 s transition, then B
    drawTransFrame(g, w, h, type, k < 0.6 ? 0.5 : k < 1.6 ? 1 + (k - 0.6) : 2.5);
  });
}
function openTransitions(i) {
  V.trIdx = i;
  V.tab = 'transitions';
  V.panelOpen = true;
  if (H.isMobile()) V.inspectorOpen = false;
  syncPanels();
  renderPanel();
  renderTimeline();
  const st = clipStarts()[i];
  if (st != null) seek(Math.max(0, st - 0.4));
}
function renderTransitionsPanel(p) {
  const n = V.p.clips.length;
  if (n < 2) {
    p.innerHTML = `<h3>Transitions</h3><p class="muted">Add two or more clips to the timeline. A transition plays where one clip changes to the next.</p>
      <div class="fx-grid">${TRANSITIONS.filter(([id]) => id !== 'none').map(([id, l]) => `<div class="fx-card dim" data-tr-demo="${id}"><span class="fx-pic"><img src="${transThumb(id)}" alt=""></span><span>${l}</span></div>`).join('')}</div>`;
    $$('[data-tr-demo]', p).forEach((b) => bindTransPreview(b, b.dataset.trDemo));
    if (!fxSamplesReady()) loadFxSamples().then(() => V && V.tab === 'transitions' && renderTransitionsPanel(p)).catch(() => {});
    return;
  }
  const starts = clipStarts();
  if (!(V.trIdx >= 1 && V.trIdx < n)) {
    // the cut nearest to the playhead
    let best = 1;
    for (let i = 1; i < n; i++) if (Math.abs(starts[i] - V.t) < Math.abs(starts[best] - V.t)) best = i;
    V.trIdx = best;
  }
  const i = V.trIdx;
  const c = V.p.clips[i];
  const cur = c.transition?.type || 'none';
  const dur = c.transition?.dur || 0.5;
  p.innerHTML = `<h3>Transitions</h3>
    <div class="tr-nav"><button class="icon-btn" id="trPrev" ${i <= 1 ? 'disabled' : ''} title="Previous cut">${H.icon('chevLeft')}</button>
      <div><b>Cut ${i} of ${n - 1}</b><small class="muted">Clip ${i} → clip ${i + 1} · at ${fmt(starts[i])}</small></div>
      <button class="icon-btn" id="trNext" ${i >= n - 1 ? 'disabled' : ''} title="Next cut">${H.icon('chevRight')}</button></div>
    <p class="muted fx-tip">Tap a transition to use it at this cut. You can also tap the ＋ between clips on the timeline.</p>
    <p class="muted small-note fx-tip">${H.isMobile() ? 'Press and hold a preview to see it play.' : 'Point at a preview to see it play.'}</p>
    <div class="fx-grid">${TRANSITIONS.map(([id, l]) => `<button class="fx-card ${cur === id ? 'on' : ''}" data-tr-set="${id}"><span class="fx-pic"><img src="${transThumb(id)}" alt=""></span><span>${l}</span></button>`).join('')}</div>
    <div class="field mt"><label>Length <b>${dur.toFixed(1)}s</b></label><input type="range" id="trDur" min="0.2" max="2" step="0.1" value="${dur}"></div>
    <div class="row wrap"><button class="btn ghost small" id="trAll">Use at every cut</button><button class="btn ghost small" id="trRandom">Mix it up (random)</button><button class="btn ghost small" id="trNone">Remove all</button></div>`;
  const play = () => previewRange(starts[i] - 0.7, starts[i] + (c.transition?.dur || 0.5) + 0.6);
  $('#trPrev', p).onclick = () => openTransitions(i - 1);
  $('#trNext', p).onclick = () => openTransitions(i + 1);
  if (!fxSamplesReady()) loadFxSamples().then(() => V && V.tab === 'transitions' && renderTransitionsPanel(p)).catch(() => {});
  $$('[data-tr-set]', p).forEach((b) => b.dataset.trSet !== 'none' && bindTransPreview(b, b.dataset.trSet));
  $$('[data-tr-set]', p).forEach((b) => (b.onclick = () => {
    c.transition = { type: b.dataset.trSet, dur };
    commit();
    renderTransitionsPanel(p);
    if (b.dataset.trSet !== 'none') play();
  }));
  const d = $('#trDur', p);
  d.oninput = () => { c.transition = { type: cur === 'none' ? 'fade' : cur, dur: +d.value }; d.previousElementSibling.querySelector('b').textContent = (+d.value).toFixed(1) + 's'; };
  d.onchange = () => { commit(); renderTransitionsPanel(p); play(); };
  $('#trAll', p).onclick = () => { const tr = { type: cur === 'none' ? 'fade' : cur, dur }; V.p.clips.forEach((x, k) => { if (k > 0) x.transition = { ...tr }; }); commit(); renderTransitionsPanel(p); H.toast(`Transitions added at all ${n - 1} cuts`); };
  $('#trRandom', p).onclick = () => { const pool = TRANSITIONS.filter(([id]) => id !== 'none'); V.p.clips.forEach((x, k) => { if (k > 0) x.transition = { type: pool[Math.floor(Math.random() * pool.length)][0], dur: x.transition?.dur || 0.5 }; }); commit(); renderTransitionsPanel(p); H.toast('Mixed transitions added'); };
  $('#trNone', p).onclick = () => { V.p.clips.forEach((x) => (x.transition = { type: 'none', dur: x.transition?.dur || 0.5 })); commit(); renderTransitionsPanel(p); };
}

function renderTemplatesPanel(p) {
  const slots = V.p.clips.filter((c) => c.slot).length;
  const cat = V.vtCat || 'All';
  p.innerHTML = `<h3>Video templates</h3>
    ${slots ? `<div class="ai-fill"><b>Add your ${slots} photo${slots > 1 ? 's' : ''} or video${slots > 1 ? 's' : ''}</b>
      <p class="muted">They fill the clip slots in order. Pick fewer and they repeat.</p>
      <button class="btn primary block" id="vtFill">${H.icon('upload')} Choose photos & videos</button></div>` : ''}
    <p class="muted">Tap a template to apply it — then add your clips. Cuts, effects, transitions and text are set up for you.</p>
    <div class="chips">${VT_CATS.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-vtc="${c}">${c}</button>`).join('')}</div>
    <div class="vt-grid">${VIDEO_TEMPLATES.filter((t) => cat === 'All' || t.cat === cat).map(templateCard).join('')}</div>`;
  $$('[data-vtc]', p).forEach((b) => (b.onclick = () => { V.vtCat = b.dataset.vtc; renderTemplatesPanel(p); }));
  $$('[data-vt]', p).forEach((b) => (b.onclick = () => applyTemplate(b.dataset.vt)));
  const f = $('#vtFill', p);
  if (f) f.onclick = () => pickAndFillSlots();
}

export function applyTemplate(id, media = []) {
  const tpl = VIDEO_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return;
  const { clips, overlays } = buildFromTemplate(tpl, media);
  V.p.clips = clips;
  V.p.overlays = overlays;
  fontsIn(overlays);
  V.sel = null;
  V.t = 0;
  prepareAll();
  fitTimeline();
  commit();
  if (V.tab === 'templates') renderPanel();
  H.toast(media.length ? `${tpl.name} applied` : `${tpl.name} applied — now add your clips`);
}

function pickAndFillSlots() {
  const inp = document.createElement('input');
  inp.type = 'file';
  attachPicker(inp);
  inp.accept = 'video/*,image/*';
  inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files];
    if (!files.length) return;
    H.toast(`Importing ${files.length} file(s)…`);
    const media = [];
    for (const f of files) {
      const m = await importFile(f);
      if (m && m.type !== 'audio') media.push(m);
    }
    if (!media.length) return;
    let i = 0;
    V.p.clips.forEach((c) => {
      if (!c.slot) return;
      const m = media[i % media.length];
      const reuse = Math.floor(i / media.length);
      i++;
      const dur = c.dur;
      delete c.slot;
      delete c.color;
      c.mediaId = m.id;
      if (m.type === 'image') {
        c.type = 'image';
        c.dur = dur;
      } else {
        c.type = 'video';
        c.in = Math.min(Math.max(0, (m.duration || dur) - dur), reuse * dur);
        c.out = Math.min(m.duration || dur, c.in + dur);
        delete c.dur;
      }
    });
    await prepareAll();
    commit();
    renderPanel();
    H.toast('Your clips are in!');
  };
  inp.click();
}

const CAPTION_STYLES = [
  { id: 'box', label: 'White box', st: { font: 'DM Sans', weight: '700', size: 0.045, color: '#111111', bg: '#ffffff' } },
  { id: 'bold', label: 'Bold outline', st: { font: 'Anton', weight: 'normal', size: 0.065, color: '#ffffff', stroke: '#000000' } },
  { id: 'yellow', label: 'Yellow pop', st: { font: 'Bricolage Grotesque', weight: '800', size: 0.055, color: '#fde047', stroke: '#000000' } },
  { id: 'dark', label: 'Dark box', st: { font: 'DM Sans', weight: '700', size: 0.045, color: '#ffffff', bg: 'rgba(0,0,0,0.65)' } },
  { id: 'neon', label: 'Neon', st: { font: 'Unbounded', weight: '900', size: 0.045, color: '#fdf4ff', glow: '#e879f9' } },
];

function captionOverlay(text, start, end) {
  const cs = CAPTION_STYLES.find((c) => c.id === (V.capStyle || 'box')) || CAPTION_STYLES[0];
  const y = { bottom: 0.8, middle: 0.55, top: 0.18 }[V.capPos || 'bottom'];
  return {
    id: uid(), type: 'text', caption: true, text, start, dur: Math.max(0.4, end - start), x: 0.5, y, opacity: 1, align: 'center', animIn: 'pop', animOut: 'none',
    italic: false, bg: '', stroke: '', glow: '', shadow: false, ...cs.st,
  };
}

function renderCaptionsPanel(p) {
  const n = V.p.overlays.filter((o) => o.caption).length;
  V.cap = V.cap || { busy: false, status: '', quality: 'fast', lang: '', audio: true };
  const c = V.cap;
  p.innerHTML = `<h3>Captions</h3>
    <h4>Style</h4>
    <div class="cap-grid">${CAPTION_STYLES.map((cs) => `<button class="cap-item ${cs.id === (V.capStyle || 'box') ? 'on' : ''}" data-cs="${cs.id}" style="font-family:'${cs.st.font}';color:${cs.st.color};${cs.st.bg ? `background:${cs.st.bg};` : 'background:#2a2340;'}${cs.st.stroke ? '-webkit-text-stroke:1px #000;' : ''}${cs.st.glow ? `text-shadow:0 0 8px ${cs.st.glow};background:#1f1235;` : ''}">${cs.label}</button>`).join('')}</div>
    <div class="field mt"><label>Position</label><div class="seg">${['top', 'middle', 'bottom'].map((x) => `<button data-cp="${x}" class="${(V.capPos || 'bottom') === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>
    <div class="ai-fill"><b>Auto captions</b>
      <p class="muted">Listens to the speech in your clips and voice-overs and writes timed captions. Runs privately in your browser — the first time it downloads a speech model (~40–75 MB).</p>
      <div class="grid2"><label>Accuracy<select id="capQ"><option value="fast" ${c.quality === 'fast' ? 'selected' : ''}>Fast</option><option value="accurate" ${c.quality === 'accurate' ? 'selected' : ''}>More accurate</option></select></label>
      <label>Language<select id="capL">${[['', 'Auto-detect'], ['english', 'English'], ['chinese', 'Chinese'], ['malay', 'Malay'], ['indonesian', 'Indonesian'], ['spanish', 'Spanish'], ['japanese', 'Japanese'], ['korean', 'Korean'], ['thai', 'Thai'], ['vietnamese', 'Vietnamese'], ['hindi', 'Hindi'], ['french', 'French']].map(([v, l]) => `<option value="${v}" ${c.lang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="row"><input type="checkbox" id="capAudio" ${c.audio ? 'checked' : ''}> Include voice-overs and audio tracks</label>
      <div class="field"><label>Words per caption</label><div class="seg">${[2, 3, 4, 6, 99].map((n) => `<button data-cw="${n}" class="${(c.words || 4) === n ? 'on' : ''}">${n === 99 ? 'Full line' : n}</button>`).join('')}</div></div>
      <button class="btn primary block" id="capAuto" ${c.busy ? 'disabled' : ''}>${H.icon('captions')} ${c.busy ? 'Working…' : 'Generate captions'}</button>
      <p class="muted" id="capStatus">${H.esc(c.status || '')}</p>
      <button class="btn ghost block" id="capFile" ${c.busy ? 'disabled' : ''}>${H.icon('upload', 14)} Get captions from another video or audio file</button>
      <p class="muted small-note">Listens to a file without adding it to your video, and puts its words on the timeline from the playhead.</p></div>
    ${n ? `<h4>Download captions</h4>
    <div class="row wrap"><button class="btn ghost small" id="capSrt">${H.icon('download', 14)} Subtitles (.srt)</button><button class="btn ghost small" id="capTxt">${H.icon('download', 14)} Text (.txt)</button><button class="btn ghost small" id="capCopy">${H.icon('copy', 14)} Copy text</button></div>
    <p class="muted small-note">.srt files work with YouTube, Facebook, TikTok Studio and most video players.</p>` : ''}
    <h4>From your script</h4>
    <textarea class="search" id="capScript" rows="5" placeholder="Paste or type what is said. Each line or sentence becomes one caption, spread across the video."></textarea>
    <button class="btn ghost block mt" id="capFromScript">Add captions from script</button>
    ${n ? `<button class="btn ghost block" id="capApply">Apply current style to all ${n} captions</button><button class="btn ghost block" id="capClear">Remove all captions</button>` : ''}`;
  $$('[data-cs]', p).forEach((b) => (b.onclick = () => { V.capStyle = b.dataset.cs; renderCaptionsPanel(p); }));
  $$('[data-cp]', p).forEach((b) => (b.onclick = () => { V.capPos = b.dataset.cp; renderCaptionsPanel(p); }));
  $('#capQ', p).onchange = (e) => (c.quality = e.target.value);
  $('#capL', p).onchange = (e) => (c.lang = e.target.value);
  $('#capAudio', p).onchange = (e) => (c.audio = e.target.checked);
  $$('[data-cw]', p).forEach((b) => (b.onclick = () => { c.words = +b.dataset.cw; renderCaptionsPanel(p); }));
  $('#capFromScript', p).onclick = () => {
    const lines = scriptToLines($('#capScript', p).value);
    if (!lines.length) return H.toast('Type or paste your script first');
    const span = mainDur() || totalDur();
    const weights = lines.map((l) => Math.max(4, l.length));
    const sum = weights.reduce((a, b) => a + b, 0);
    let t0 = 0;
    lines.forEach((l, i) => {
      const d = (weights[i] / sum) * span;
      V.p.overlays.push(captionOverlay(l, t0, t0 + d));
      t0 += d;
    });
    commit();
    H.toast(`${lines.length} captions added`);
    renderCaptionsPanel(p);
  };
  const ap = $('#capApply', p);
  if (ap) ap.onclick = () => {
    V.p.overlays = V.p.overlays.map((o) => (o.caption ? { ...captionOverlay(o.text, o.start, o.start + o.dur), id: o.id } : o));
    commit();
  };
  const cl = $('#capClear', p);
  if (cl) cl.onclick = () => { V.p.overlays = V.p.overlays.filter((o) => !o.caption); commit(); renderCaptionsPanel(p); };
  $('#capAuto', p).onclick = () => runAutoCaptions(p);
  $('#capFile', p).onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    attachPicker(inp);
    inp.accept = 'video/*,audio/*';
    inp.onchange = () => inp.files[0] && runAutoCaptions(p, inp.files[0]);
    inp.click();
  };
  const base = () => (V.p.name || 'artvas-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'artvas-video';
  const srt = $('#capSrt', p);
  if (srt) srt.onclick = () => saveTextFile(captionsToSrt(captionList()), `${base()}.srt`, 'application/x-subrip');
  const txt = $('#capTxt', p);
  if (txt) txt.onclick = () => saveTextFile(captionsToText(captionList()), `${base()}-transcript.txt`);
  const cp = $('#capCopy', p);
  if (cp) cp.onclick = async () => {
    try {
      await navigator.clipboard.writeText(captionsToText(captionList()));
      H.toast('Caption text copied');
    } catch {
      H.toast("Couldn't copy — use Text (.txt) instead");
    }
  };
}

async function runAutoCaptions(p, file) {
  const c = V.cap;
  const status = (m) => { c.status = m; const el = $('#capStatus'); if (el) el.textContent = m; };
  const jobs = [];
  const starts = clipStarts();
  if (file) {
    // a file from outside the project: its words start at the playhead (or 0 at the end)
    jobs.push({ blob: file, inSec: 0, at: V.t >= totalDur() - 0.1 ? 0 : V.t, speed: 1, keep: true });
  } else {
    V.p.clips.forEach((clip, i) => {
      if (clip.type === 'video' && !clip.muted) jobs.push({ mediaId: clip.mediaId, inSec: clip.in, outSec: clip.out, at: starts[i], speed: avgSpeed(clip) });
    });
    V.p.overlays.forEach((o) => {
      if (o.type === 'video' && !o.muted) jobs.push({ mediaId: o.mediaId, inSec: o.in || 0, outSec: (o.in || 0) + o.dur, at: o.start, speed: 1 });
    });
    if (c.audio) V.p.audio.forEach((a) => { if (!/Artvas Music/.test(a.name || '') && !SFX.some((x) => (a.name || '').startsWith(x.name))) jobs.push({ mediaId: a.mediaId, inSec: a.in, outSec: a.out, at: a.start, speed: 1 }); });
  }
  if (!jobs.length) return H.toast('Add a video clip or voice-over with speech first');
  c.busy = true;
  renderCaptionsPanel(p);
  let added = 0;
  try {
    const fresh = [];
    for (let j = 0; j < jobs.length; j++) {
      const job = jobs[j];
      const blob = job.blob || (await getMedia(job.mediaId))?.blob;
      if (!blob) continue;
      const pre = jobs.length > 1 ? `Track ${j + 1}/${jobs.length}: ` : '';
      let segs;
      try {
        segs = await transcribeMedia(blob, { inSec: job.inSec, outSec: job.outSec, quality: c.quality, language: c.lang || undefined, onStatus: (s2) => status(pre + s2) });
      } catch (e) {
        // a track with no readable sound shouldn't stop the others
        if (jobs.length > 1 && /no audio track/i.test(e.message || '')) continue;
        throw e;
      }
      pushSegments(fresh, segs, job.at, job.speed, c.words || 4);
    }
    if (fresh.length) {
      // a fresh run replaces old captions; captions from an outside file are added alongside them
      V.p.overlays = (file ? V.p.overlays : V.p.overlays.filter((o) => !o.caption)).concat(fresh);
      added = fresh.length;
      commit();
    }
    c.status = added ? `Added ${added} captions. Tap one on the timeline to edit its text.` : file ? 'No speech found in that file.' : 'No speech found in your clips.';
  } catch (e) {
    console.error(e);
    c.status = e.message || 'Auto captions failed.';
    H.toast(c.status);
  }
  c.busy = false;
  if (V?.tab === 'captions') renderCaptionsPanel(p);
}

function renderAIPanel(p) {
  const key = getKey();
  V.ai = V.ai || { prompt: '', mode: 'image', model: AI_MODELS[0].id, vmodel: VIDEO_MODELS[0].id, style: 'cinematic', duration: 5, busy: false, status: '' };
  const a = V.ai;
  const vm = VIDEO_MODELS.find((m) => m.id === a.vmodel) || VIDEO_MODELS[0];
  p.innerHTML = `<h3>AI generate</h3>
    ${key || (a.mode === 'image' && AI_MODELS.find((m) => m.id === a.model)?.free) ? '' : `<div class="ai-connect"><b>Connect your Muapi.ai key</b><p class="muted">Add your key in a design's AI Image tab, or here:</p>
      <input class="search" id="vAiKey" type="password" placeholder="Muapi API key"><button class="btn primary block" id="vAiKeySave">Save key</button></div>`}
    <div class="seg"><button data-aim="image" class="${a.mode === 'image' ? 'on' : ''}">Image clip</button><button data-aim="video" class="${a.mode === 'video' ? 'on' : ''}">Video clip</button></div>
    <label class="flabel mt">Describe it<textarea class="search ai-prompt" id="vAiPrompt" rows="4" placeholder="${a.mode === 'video' ? 'e.g. drone shot flying over a turquoise lagoon at sunrise' : 'e.g. neon city street at night in the rain'}">${H.esc(a.prompt)}</textarea></label>
    ${a.mode === 'image'
      ? `<div class="grid2"><label>Model<select id="vAiModel">${AI_MODELS.map((m) => `<option value="${m.id}" ${m.id === a.model ? 'selected' : ''}>${H.esc(m.name)}</option>`).join('')}</select></label>
         <label>Style<select id="vAiStyle">${AI_STYLES.map((s) => `<option value="${s.id}" ${s.id === a.style ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label></div>`
      : `<div class="grid2"><label>Model<select id="vAiVModel">${VIDEO_MODELS.map((m) => `<option value="${m.id}" ${m.id === a.vmodel ? 'selected' : ''}>${H.esc(m.name)}</option>`).join('')}</select></label>
         <label>Length<select id="vAiDur">${vm.durations.map((d) => `<option ${d === a.duration ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
         <p class="muted">Video generation can take 1–5 minutes and costs more credits than images.</p>`}
    ${a.mode === 'image' && AI_MODELS.find((m) => m.id === a.model)?.free ? '<p class="muted">Free AI by Pollinations.ai — no key needed, small watermark.</p>' : a.mode === 'video' ? '<p class="muted">AI video clips need a Muapi key and credits — no free video AI is good enough yet.</p>' : ''}
    <button class="btn primary block mt" id="vAiGo" ${(!key && !(a.mode === 'image' && AI_MODELS.find((m) => m.id === a.model)?.free)) || a.busy ? 'disabled' : ''}>${H.icon('wand')} ${a.busy ? 'Generating…' : a.mode === 'video' ? 'Generate video clip' : 'Generate image clip'}</button>
    <p class="muted" id="vAiStatus">${H.esc(a.status || '')}</p>`;
  const save = $('#vAiKeySave', p);
  if (save) save.onclick = () => { H.setKey($('#vAiKey', p).value.trim()); renderAIPanel(p); };
  $$('[data-aim]', p).forEach((b) => (b.onclick = () => { a.mode = b.dataset.aim; renderAIPanel(p); }));
  $('#vAiPrompt', p).oninput = (e) => (a.prompt = e.target.value);
  const m1 = $('#vAiModel', p);
  if (m1) m1.onchange = (e) => (a.model = e.target.value);
  const s1 = $('#vAiStyle', p);
  if (s1) s1.onchange = (e) => (a.style = e.target.value);
  const m2 = $('#vAiVModel', p);
  if (m2) m2.onchange = (e) => { a.vmodel = e.target.value; a.duration = (VIDEO_MODELS.find((m) => m.id === a.vmodel) || vm).durations[0]; renderAIPanel(p); };
  const d2 = $('#vAiDur', p);
  if (d2) d2.onchange = (e) => (a.duration = +e.target.value);
  $('#vAiGo', p).onclick = async () => {
    if (!a.prompt.trim()) return H.toast('Describe what to generate first');
    a.busy = true;
    a.status = '';
    renderAIPanel(p);
    const status = (m) => { a.status = m; const s = $('#vAiStatus'); if (s) s.textContent = m; };
    try {
      if (a.mode === 'image') {
        const model = AI_MODELS.find((m) => m.id === a.model) || AI_MODELS[0];
        const style = AI_STYLES.find((s) => s.id === a.style);
        const url = await generateImage({ model: model.id, prompt: a.prompt + (style?.suffix || ''), aspectRatio: closestRatio(V.p.width, V.p.height, model.ar || undefined), onStatus: status });
        const data = await toDataURL(url);
        const blob = await (await fetch(data)).blob();
        const m = await importFile(new File([blob], 'AI image.png', { type: blob.type || 'image/png' }));
        if (m) addClip(m.id, 'image', 0);
      } else {
        const url = await generateVideo({ model: vm.id, prompt: a.prompt, aspectRatio: closestRatio(V.p.width, V.p.height, vm.ar), duration: a.duration, onStatus: status });
        status('Downloading clip…');
        const blob = await H.fetchMedia(url);
        const m = await importFile(new File([blob], 'AI video.mp4', { type: blob.type || 'video/mp4' }));
        if (m) addClip(m.id, 'video', m.duration);
      }
      a.status = 'Added to the end of your video.';
      commit();
    } catch (e) {
      console.error(e);
      a.status = e.message || 'Generation failed';
      H.toast(a.status);
    }
    a.busy = false;
    if (V?.tab === 'ai') renderAIPanel(p);
  };
}

// ---------- inspector ----------
// ---------- masks, voice changer and audio extraction (inspector parts) ----------
const ADJ_EXTRA = [['temp', 'Temperature', -1], ['tint', 'Tint', -1], ['fade', 'Fade', 0], ['vignette', 'Vignette', 0], ['sharpen', 'Sharpen', 0]];
const MASK_SLIDERS = [
  ['size', 'Size', 0.05, 1.6, 0.01, (t) => t !== 'linear'],
  ['aspect', 'Stretch', 0.3, 3, 0.01, (t) => ['circle', 'rect', 'heart', 'star'].includes(t)],
  ['round', 'Corner roundness', 0, 1, 0.01, (t) => t === 'rect'],
  ['feather', 'Feather (soft edge)', 0, 1, 0.01, () => true],
  ['x', 'Move left / right', -1, 1, 0.01, () => true],
  ['y', 'Move up / down', -1, 1, 0.01, () => true],
  ['rot', 'Rotation', -180, 180, 1, () => true],
];
function maskSection(s) {
  const m = { ...DEFAULT_MASK, ...(s.mask || {}) };
  const on = isMasked(s.mask);
  return `<h4>Mask</h4>
    <div class="mask-grid" role="group" aria-label="Mask shape">${MASKS.map(([id, l]) => `<button data-mask="${id}" class="${m.type === id ? 'on' : ''}" title="${l}" aria-pressed="${m.type === id}">${maskIcon(id)}<span>${l}</span></button>`).join('')}</div>
    ${on ? `<div class="mask-opts">${MASK_SLIDERS.filter((x) => x[5](m.type)).map(([k, l, min, max, step]) => `<label class="frow">${k === 'size' && m.type === 'mirror' ? 'Band width' : k === 'rot' && m.type === 'linear' ? 'Angle' : l} <b data-mkv="${k}">${k === 'rot' ? `${Math.round(m[k])}°` : ''}</b><input type="range" data-mk="${k}" min="${min}" max="${max}" step="${step}" value="${m[k]}"></label>`).join('')}
      <div class="row wrap"><label class="row"><input type="checkbox" id="mInvert" ${m.invert ? 'checked' : ''}> Invert</label><button class="btn ghost small" id="mReset">Reset mask</button></div></div>` : ''}`;
}
function bindMask(el, s) {
  $$('[data-mask]', el).forEach((b) => (b.onclick = () => {
    const type = b.dataset.mask;
    const prev = s.mask || {};
    s.mask = { ...DEFAULT_MASK, ...prev, type };
    if (type === 'mirror' && (prev.type || 'none') !== 'mirror') s.mask.size = 0.4;
    if (type === 'linear' && (prev.type || 'none') !== 'linear') s.mask.feather = Math.max(s.mask.feather, 0.1);
    commit();
  }));
  $$('[data-mk]', el).forEach((r) => {
    r.oninput = () => {
      s.mask = { ...DEFAULT_MASK, ...(s.mask || {}), [r.dataset.mk]: +r.value };
      const v = $(`[data-mkv="${r.dataset.mk}"]`, el);
      if (v && r.dataset.mk === 'rot') v.textContent = `${Math.round(+r.value)}°`;
    };
    r.onchange = () => commit();
  });
  const inv = $('#mInvert', el);
  if (inv) inv.onchange = () => { s.mask = { ...DEFAULT_MASK, ...(s.mask || {}), invert: inv.checked }; commit(); };
  const rs = $('#mReset', el);
  if (rs) rs.onclick = () => { s.mask = { ...DEFAULT_MASK, type: s.mask?.type || 'none' }; commit(); };
}

function voiceSection(cur) {
  const busy = !!V.voiceBusy;
  return `<h4>Voice changer</h4>
    <div class="filter-grid voice-grid">${[['none', 'Original voice'], ...VOICE_FX].map(([id, l]) => `<button data-voice="${id}" class="${cur === id ? 'on' : ''}" ${busy ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <p class="muted vc-status" id="vcStatus" aria-live="polite">${H.esc(V.voiceMsg || '')}</p>`;
}
function voiceStatus(msg) {
  if (!V) return;
  V.voiceMsg = msg;
  const e = $('#vcStatus');
  if (e) e.textContent = msg;
}
async function runVoice(job) {
  if (V.voiceBusy) return H.toast('Still changing the last voice…');
  V.voiceBusy = true;
  $$('[data-voice]').forEach((b) => (b.disabled = true));
  try {
    await job();
  } catch (e) {
    console.warn('voice changer', e);
    H.toast(e?.name === 'EncodingError' || /too short|decode/i.test(String(e?.message)) ? 'There is no sound to change here' : 'Could not change the voice');
  } finally {
    if (V) {
      V.voiceBusy = false;
      V.voiceMsg = '';
      renderInspector();
    }
  }
}
async function renderVoice(mediaId, preset, opts, name) {
  const m = await getMedia(mediaId);
  if (!m?.blob) throw new Error('missing media');
  const started = performance.now();
  const { blob } = await changeVoice(await m.blob.arrayBuffer(), preset, { ...opts, onStep: voiceStatus });
  const meta = await importFile(new File([blob], `${(name || 'Voice').replace(/\.\w+$/, '')} · ${voiceName(preset)}.wav`, { type: 'audio/wav' }));
  if (!meta) throw new Error('import failed');
  voiceStatus(`Done in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  return meta;
}
/** Voice changer on an audio track. The original media and range are kept in voiceSrc. */
async function applyVoiceToTrack(a, preset) {
  const src = a.voiceSrc || { mediaId: a.mediaId, in: 0, speed: 1 };
  const sp = src.speed || 1;
  const from = src.in + a.in * sp;
  const to = src.in + a.out * sp;
  if (preset === 'none') {
    if (!a.voiceSrc) return;
    const clip = a.voiceOf && V.p.clips.find((c) => c.id === a.voiceOf);
    if (clip) {
      // made from a clip's sound: give the clip its own sound back
      V.p.audio = V.p.audio.filter((x) => x !== a);
      clip.muted = false;
      V.sel = { kind: 'clip', id: clip.id };
    } else {
      Object.assign(a, { mediaId: src.mediaId, in: from, out: to });
      delete a.voice;
      delete a.voiceSrc;
    }
    await prepareAll();
    commit();
    return H.toast('Original voice restored');
  }
  await runVoice(async () => {
    const meta = await renderVoice(src.mediaId, preset, { from, to, speed: sp }, a.name || V.meta.get(src.mediaId)?.name);
    Object.assign(a, { voiceSrc: { mediaId: src.mediaId, in: from, speed: sp }, voice: preset, mediaId: meta.id, in: 0, out: Math.max(0.1, meta.duration) });
    await prepareAll();
    commit();
    H.toast(`Voice: ${voiceName(preset)}`);
  });
}
/** Voice changer on a video clip's own sound: the changed sound goes on an audio track and the clip is muted. */
async function applyVoiceToClip(c, preset) {
  const linked = V.p.audio.find((a) => a.voiceOf === c.id);
  if (preset === 'none') {
    if (linked) V.p.audio = V.p.audio.filter((a) => a !== linked);
    c.muted = false;
    await prepareAll();
    commit();
    return H.toast('Original voice restored');
  }
  await runVoice(async () => {
    const sp = avgSpeed(c);
    const name = V.meta.get(c.mediaId)?.name || 'Clip';
    const meta = await renderVoice(c.mediaId, preset, { from: c.in, to: c.out, speed: sp }, name);
    const idx = V.p.clips.indexOf(c);
    if (idx < 0) return;
    const a = linked || { id: uid(), volume: c.volume ?? 1, fadeIn: 0, fadeOut: 0, voiceOf: c.id };
    Object.assign(a, { mediaId: meta.id, start: clipStarts()[idx], in: 0, out: Math.max(0.1, meta.duration), voice: preset, voiceSrc: { mediaId: c.mediaId, in: c.in, speed: sp }, name: `${name.replace(/\.\w+$/, '')} voice` });
    if (!linked) V.p.audio.push(a);
    c.muted = true;
    await prepareAll();
    commit();
    H.toast(`Voice: ${voiceName(preset)} — the clip's own sound is muted`);
  });
}
/** Put a video clip's sound on its own audio track (at 1× speed) and mute the clip. */
function extractAudio(c) {
  if (c.type !== 'video') return;
  const idx = V.p.clips.indexOf(c);
  if (idx < 0) return;
  const sp = +avgSpeed(c).toFixed(2);
  const name = (V.meta.get(c.mediaId)?.name || 'Clip').replace(/\.\w+$/, '');
  const a = { id: uid(), mediaId: c.mediaId, start: clipStarts()[idx], in: c.in, out: c.out, volume: c.volume ?? 1, fadeIn: 0, fadeOut: 0, name: `${name} audio`, fromClip: c.id };
  V.p.audio.push(a);
  c.muted = true;
  prepareAll();
  V.sel = { kind: 'audio', id: a.id };
  commit();
  H.toast(sp !== 1 ? `Audio extracted at normal speed (1×) — the clip plays at ${sp}×` : 'Audio extracted to its own track — the clip is muted');
}

// ---------- speed curves, reverse, stabilize (video clips) ----------
const CONST_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];
function speedSection(s) {
  const curved = hasCurve(s);
  const cur = curved ? s.curve.id : 'none';
  const sup = reverseSupport();
  const busy = V.job && V.job.clip === s.id ? V.job : null;
  return `<h4>Speed</h4>
    <div class="field"><label>Constant speed</label><div class="seg wrap">${CONST_SPEEDS.map((v) => `<button data-spd="${v}" class="${!curved && (s.speed || 1) === v ? 'on' : ''}">${v}×</button>`).join('')}</div></div>
    <div class="field"><label>Speed curve</label>
      <div class="curve-grid">${[{ id: 'none', name: 'None' }, ...SPEED_CURVES, { id: 'custom', name: 'Custom' }].map((c) => `<button type="button" data-curve="${c.id}" class="${cur === c.id ? 'on' : ''}" aria-pressed="${cur === c.id}">${c.id === 'none' ? curveThumb([[0, 1], [1, 1]]) : c.id === 'custom' ? curveThumb(curved && cur === 'custom' ? s.curve.pts : [[0, 1], [0.3, 0.4], [0.7, 3], [1, 1]]) : curveThumb(c.pts)}<span>${c.name}</span></button>`).join('')}</div>
      ${curved ? `<div class="sc-edit" id="cCurveEd"></div>
        <p class="muted small-note" id="cCurveInfo">${curveInfo(s)}</p>
        <div class="row wrap"><button class="btn ghost small" id="cCurveFlat">Reset points</button><button class="btn ghost small" id="cCurveOff">Remove curve</button></div>` : ''}
    </div>
    <div class="row wrap"><button class="btn ghost small" id="cReverse" ${busy ? 'disabled' : ''}>⟲ ${s.rev ? 'Play forward (original)' : 'Reverse'}</button></div>
    <p class="muted small-note">${s.rev ? 'This clip plays backwards (sound too).' : sup.max ? `Reverse makes a backwards copy of this clip (up to ${sup.max}s).` : 'Reverse needs a newer browser.'}</p>
    <p class="muted vc-status job-status" data-job="reverse" aria-live="polite">${H.esc(busy?.kind === 'reverse' ? busy.msg : '')}</p>`;
}
function stabSection(s) {
  const busy = V.job && V.job.clip === s.id ? V.job : null;
  const stabOn = s.stab && s.stab.mediaId === s.mediaId;
  return `<h4>Stabilize</h4>
    <p class="muted small-note">Smooths shaky footage. Higher strength zooms in a little more.</p>
    <div class="seg">${STAB_LEVELS.map(([id, l]) => `<button data-stab="${id}" class="${stabOn && s.stab.level === id ? 'on' : ''}" ${busy ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    ${stabOn ? `<button class="btn ghost small mt" id="cStabOff" ${busy ? 'disabled' : ''}>Remove stabilization</button>` : ''}
    <p class="muted vc-status job-status" data-job="stab" aria-live="polite">${H.esc(busy?.kind === 'stab' ? busy.msg : '')}</p>`;
}
function curveInfo(s) {
  return `Drag the points — higher is faster (0.1×–10×). Clip length ${clipDur(s).toFixed(1)}s, average ${avgSpeed(s).toFixed(2)}×. The sound follows the speed.`;
}
function bindSpeedSection(el, s) {
  $$('[data-curve]', el).forEach((b) => (b.onclick = () => {
    const id = b.dataset.curve;
    if (id === 'none') delete s.curve;
    else if (id === 'custom') s.curve = { id: 'custom', pts: hasCurve(s) ? structuredClone(s.curve.pts) : flatCurve(s.speed || 1) };
    else s.curve = { id, pts: structuredClone(SPEED_CURVES.find((c) => c.id === id).pts) };
    commit();
    if (id !== 'none') previewRange(clipStarts()[V.p.clips.indexOf(s)], clipStarts()[V.p.clips.indexOf(s)] + Math.min(clipDur(s), 6));
  }));
  const ed = $('#cCurveEd', el);
  if (ed && hasCurve(s)) {
    mountCurveEditor(ed, s.curve.pts, {
      onInput: () => {
        s.curve.id = 'custom';
        $('#cLen', el) && ($('#cLen', el).textContent = clipDur(s).toFixed(1));
        $('#cCurveInfo', el) && ($('#cCurveInfo', el).textContent = curveInfo(s));
        renderTimelineLive();
      },
      onChange: () => commit(),
    });
  }
  const on = (id, fn) => { const x = $(id, el); if (x) x.onclick = fn; };
  on('#cCurveFlat', () => { s.curve = { id: 'custom', pts: flatCurve(1) }; commit(); });
  on('#cCurveOff', () => { delete s.curve; commit(); });
  on('#cReverse', () => reverseClip(s));
  $$('[data-stab]', el).forEach((b) => (b.onclick = () => stabilizeClip(s, b.dataset.stab)));
  on('#cStabOff', () => { delete s.stab; commit(); H.toast('Stabilization removed'); });
}
function jobStatus(msg) {
  if (!V?.job) return;
  V.job.msg = msg;
  const e = $(`.job-status[data-job="${V.job.kind}"]`);
  if (e) e.textContent = msg;
}
async function runClipJob(c, kind, fn) {
  if (V.job) return H.toast('Still working on the last clip…');
  V.job = { clip: c.id, kind, msg: '' };
  renderInspector();
  try {
    await fn();
  } finally {
    if (V) {
      V.job = null;
      renderInspector();
    }
  }
}
/** Reverse a video clip (or go back to the original). The original media and range are kept in c.rev. */
async function reverseClip(c) {
  if (c.type !== 'video') return;
  if (c.rev) {
    const r = c.rev;
    // remember the reversed copy so reversing the same part again is instant
    c.revCache = { src: r.mediaId, in: r.in, out: r.out, media: c.mediaId, dur: c.out };
    Object.assign(c, { mediaId: r.mediaId, in: r.in, out: r.out });
    delete c.rev;
    await prepareAll();
    commit();
    return H.toast('Playing forward again');
  }
  const len = c.out - c.in;
  const sup = reverseSupport();
  if (!sup.max) return H.toast('Reverse needs a newer browser (Chrome, Edge, Firefox or Safari 17+)');
  if (len > sup.max + 0.05) return H.toast(`Reverse works on clips up to ${sup.max}s — split or trim this clip first (it is ${len.toFixed(1)}s of video)`);
  const rc = c.revCache;
  const apply = async (mediaId, dur) => {
    c.rev = { mediaId: c.mediaId, in: c.in, out: c.out };
    Object.assign(c, { mediaId, in: 0, out: Math.max(0.1, dur) });
    await prepareAll();
    commit();
  };
  if (rc && rc.src === c.mediaId && Math.abs(rc.in - c.in) < 1e-3 && Math.abs(rc.out - c.out) < 1e-3 && V.meta.has(rc.media)) {
    await apply(rc.media, rc.dur);
    return H.toast('Reversed');
  }
  await runClipJob(c, 'reverse', async () => {
    try {
      const m = await getMedia(c.mediaId);
      if (!m?.blob) throw new Error('missing media');
      const t0 = performance.now();
      const r = await reverseVideo(m.blob, c.in, c.out, { onProgress: (_f, msg) => jobStatus(msg) });
      if (!V) return;
      V.lastJob = { kind: 'reverse', ms: Math.round(performance.now() - t0), method: r.method, stats: r.stats, size: [r.width, r.height] };
      jobStatus('Saving…');
      const name = (V.meta.get(c.mediaId)?.name || 'Clip').replace(/\.\w+$/, '');
      const meta = await importFile(new File([r.blob], `${name} (reversed).${r.blob.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: r.blob.type || 'video/webm' }), { duration: r.duration, reverseOf: c.mediaId });
      if (!meta || !V.p.clips.includes(c)) return;
      await apply(meta.id, Math.min(r.duration, meta.duration || r.duration));
      H.toast(`Reversed in ${((performance.now() - t0) / 1000).toFixed(1)}s${r.hasAudio ? '' : ' (no sound to reverse)'}`);
    } catch (e) {
      console.warn('reverse', e);
      if (V) H.toast(/too long/.test(e.message) ? `Reverse works on clips up to ${sup.max}s` : 'Could not reverse this clip');
    }
  });
}
/** Analyse the clip's motion (once per media and range) and turn on stabilization at a strength. */
async function stabilizeClip(c, level) {
  if (c.type !== 'video') return;
  const st = c.stab;
  if (st && st.mediaId === c.mediaId && st.from <= c.in + 0.05 && st.to >= c.out - 0.05) {
    c.stab = { ...st, level };
    commit();
    return H.toast(`Stabilize: ${STAB_LEVELS.find(([id]) => id === level)[1]}`);
  }
  await runClipJob(c, 'stab', async () => {
    try {
      const m = await getMedia(c.mediaId);
      if (!m?.blob) throw new Error('missing media');
      const dur = V.meta.get(c.mediaId)?.duration || c.out;
      const from = Math.max(0, c.in - 0.25);
      const to = Math.min(Number.isFinite(dur) ? dur : c.out, c.out + 0.25);
      const t0 = performance.now();
      const path = await analyseMotion(m.blob, from, to, { onProgress: (_f, msg) => jobStatus(msg) });
      if (!V) return;
      V.lastJob = { kind: 'stab', ms: Math.round(performance.now() - t0), method: path.method, frames: path.frames, samples: path.px.length };
      if (!V.p.clips.includes(c)) return;
      const r4 = (a) => a.map((x) => +x.toFixed(4));
      c.stab = { mediaId: c.mediaId, from, to, level, t0: path.t0, fps: +path.fps.toFixed(4), px: r4(path.px), py: r4(path.py), pr: r4(path.pr) };
      commit();
      H.toast(`Stabilized in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.warn('stabilize', e);
      if (V) H.toast(/too long/.test(e.message) ? 'Stabilize works on clips up to 3 minutes — split this clip first' : 'Could not analyse this clip');
    }
  });
}

// ---------- beats (audio tracks) ----------
function beatSection(a) {
  const n = (a.beats || []).filter((b) => b >= a.in && b <= a.out).length;
  const every = V.beatEvery || 1;
  return `<h4>Beats</h4>
    <p class="muted small-note">${a.beats ? `${n} beats · ${Math.round(a.bpm || 0)} BPM — shown as marks on the track; clip edges snap to them.` : 'Find the beats of this music, then cut your clips in time with it.'}</p>
    <div class="row wrap"><button class="btn ghost small" id="aBeats" ${V.beatBusy ? 'disabled' : ''}>${a.beats ? 'Detect again' : '♩ Detect beats'}</button>${a.beats ? `<button class="btn ghost small" id="aBeatsClear">Clear beats</button>` : ''}</div>
    ${a.beats ? `<div class="field mt"><label>Cut on</label><div class="seg">${[1, 2, 4].map((k) => `<button data-bev="${k}" class="${every === k ? 'on' : ''}">${k === 1 ? 'Every beat' : `Every ${k}`}</button>`).join('')}</div></div>
      <button class="btn primary small" id="aAutoCut" ${V.p.clips.length ? '' : 'disabled'}>Auto cut to beat</button>` : ''}
    <p class="muted vc-status" id="beatStatus" aria-live="polite">${H.esc(V.beatMsg || '')}</p>`;
}
function bindBeatSection(el, a) {
  const b = $('#aBeats', el);
  if (b) b.onclick = () => detectTrackBeats(a);
  const c = $('#aBeatsClear', el);
  if (c) c.onclick = () => { delete a.beats; delete a.bpm; V.beatMsg = ''; commit(); };
  $$('[data-bev]', el).forEach((x) => (x.onclick = () => { V.beatEvery = +x.dataset.bev; renderInspector(); }));
  const ac = $('#aAutoCut', el);
  if (ac) ac.onclick = () => autoCutToBeat(a, V.beatEvery || 1);
}
async function detectTrackBeats(a) {
  if (V.beatBusy) return;
  V.beatBusy = true;
  V.beatMsg = 'Listening for the beat…';
  renderInspector();
  try {
    const m = await getMedia(a.mediaId);
    if (!m?.blob) throw new Error('missing media');
    const t0 = performance.now();
    const r = await detectBeats(await m.blob.arrayBuffer());
    if (!V) return;
    if (!r.beats.length) throw new Error('no beats');
    a.beats = r.beats;
    a.bpm = r.bpm;
    V.beatMsg = `Found ${r.beats.length} beats at ${Math.round(r.bpm)} BPM in ${((performance.now() - t0) / 1000).toFixed(1)}s.`;
    commit();
  } catch (e) {
    console.warn('beats', e);
    if (V) V.beatMsg = 'Could not find a beat in this audio.';
  } finally {
    if (V) {
      V.beatBusy = false;
      renderInspector();
    }
  }
}
/**
 * Set main-track clip lengths so every cut lands on a beat (every `every` beats), from the
 * first beat of the track. Videos are trimmed at their end; clips too short to reach the next
 * beat end on the last beat they can reach.
 */
function autoCutToBeat(a, every = 1) {
  const B = trackBeats(a).filter((t) => t > 0.05);
  if (!B.length || !V.p.clips.length) return H.toast('Detect the beats first');
  let i = B.findIndex((t) => t >= a.start - 0.02);
  if (i < 0) return H.toast('The music has no beats on the timeline');
  // the first clip runs from 0 to `every` beats after the first beat
  let start = 0;
  let cut = 0;
  let short = 0;
  for (const c of V.p.clips) {
    let k = i + every;
    if (k >= B.length) break;
    const maxLen = c.type === 'video' ? ((V.meta.get(c.mediaId)?.duration || c.out) - c.in) * timePerSrc(c) : 120;
    if (B[k] - start > maxLen + 1e-3) {
      short++;
      while (k > i + 1 && B[k] - start > maxLen) k--;
      if (B[k] - start > maxLen) {
        // not even one beat fits: use the whole clip and aim for the next beat after it
        const end = start + maxLen;
        setClipLen(c, maxLen);
        start = end;
        while (i < B.length - 1 && B[i + 1] <= end + 1e-3) i++;
        continue;
      }
    }
    setClipLen(c, B[k] - start);
    start = B[k];
    i = k;
    cut++;
  }
  commit();
  H.toast(`${cut} clip${cut === 1 ? '' : 's'} cut to the beat${short ? ` · ${short} too short to reach the next beat` : ''}`);
}
function setClipLen(c, d) {
  if (c.type === 'image' || c.type === 'color') c.dur = Math.max(0.1, +d.toFixed(4));
  else c.out = c.in + d / timePerSrc(c);
}

function renderInspector() {
  const el = $('#vInspector');
  if (!el || !V) return;
  const s = findSel();
  const kind = V.sel?.kind;
  const tg = $('#vInspToggle');
  if (tg) tg.classList.toggle('on', !!V.inspectorOpen);
  if (!s) {
    el.innerHTML = `<h3>Video</h3>
      <div class="field"><label>Size</label><select id="vSize">${[...new Set(ALL_VIDEO_SIZES.map((x) => x.group))].map((g) => `<optgroup label="${g}">${ALL_VIDEO_SIZES.filter((x) => x.group === g).map((pr) => `<option value="${pr.w}x${pr.h}" ${pr.w === V.p.width && pr.h === V.p.height ? 'selected' : ''}>${pr.name} (${pr.w}×${pr.h})</option>`).join('')}</optgroup>`).join('')}<option value="custom">Custom size…</option></select></div>
      <div class="grid2" id="vCustom" hidden><label>Width<input type="number" id="vCW" value="${V.p.width}" min="64" max="4096"></label><label>Height<input type="number" id="vCH" value="${V.p.height}" min="64" max="4096"></label><button class="btn ghost small" id="vCApply">Apply size</button></div>
      <div class="field"><label>Background color</label><input type="color" id="vBg" value="${V.p.bg || '#000000'}"></div>
      <p class="muted">${V.p.clips.length} clip(s) · ${V.p.overlays.length} text/sticker(s) · ${(V.p.effects || []).length} effect(s) · ${V.p.audio.length} audio · length ${fmt(totalDur())}</p>
      <h4>Shortcuts</h4>
      <ul class="shortcuts"><li><kbd>Space</kbd> Play / pause</li><li><kbd>S</kbd> Split at playhead</li><li><kbd>Del</kbd> Delete</li><li><kbd>←</kbd> <kbd>→</kbd> Step a frame (Shift: 1s)</li><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> Undo</li></ul>`;
    const setSize = (w, h) => {
      V.p.width = w;
      V.p.height = h;
      sizeCanvas();
      commit();
      const dl = $('.dim-label');
      if (dl) dl.textContent = `${w} × ${h}`;
    };
    $('#vCApply').onclick = () => setSize(clamp(Math.round(+$('#vCW').value || 1080), 64, 4096), clamp(Math.round(+$('#vCH').value || 1920), 64, 4096));
    $('#vSize').onchange = (e) => {
      if (e.target.value === 'custom') return ($('#vCustom').hidden = false);
      const [w, h] = e.target.value.split('x').map(Number);
      V.p.width = w;
      V.p.height = h;
      sizeCanvas();
      commit();
      const dl = $('.dim-label');
      if (dl) dl.textContent = `${w} × ${h}`;
    };
    $('#vBg').oninput = (e) => { V.p.bg = e.target.value; scheduleSave(); };
    return;
  }
  if (kind === 'clip') {
    const m = V.meta.get(s.mediaId) || {};
    const idx = V.p.clips.indexOf(s);
    const tf = s.tf || {};
    el.innerHTML = `<h3>${s.type === 'image' ? 'Photo clip' : s.type === 'color' ? (s.slot ? `Template clip ${s.slot}` : 'Color clip') : 'Video clip'}</h3>
      <p class="muted">${H.esc(m.name || '')} · <span id="cLen">${clipDur(s).toFixed(1)}</span>s on the timeline</p>
      ${m.credit ? `<p class="muted small-note credit">${H.esc(creditLine(m.credit))}${m.credit.link ? ` · <a href="${H.esc(m.credit.link)}" target="_blank" rel="noopener">source</a>` : ''}</p>` : ''}
      <div class="row wrap"><button class="btn ${s.type === 'color' ? 'primary' : 'ghost'} small" id="cReplace">${H.icon('upload', 14)} ${s.type === 'color' ? 'Add your clip' : 'Replace'}</button>
        ${s.type === 'video' ? `<button class="btn ghost small" id="cFreeze">Freeze frame</button>` : ''}</div>
      ${s.type === 'color' ? `<div class="field mt"><label>Color</label><input type="color" id="cColor" value="${/^#/.test(s.color || '') ? s.color : '#222222'}"></div>` : ''}
      ${s.type === 'image' || s.type === 'color'
        ? `<div class="field"><label>Duration <b>${s.dur.toFixed(1)}s</b></label><input type="range" id="cDur" min="0.5" max="15" step="0.1" value="${s.dur}"></div>`
        : `${speedSection(s)}
           <div class="field"><label>Volume <b>${Math.round((s.volume ?? 1) * 100)}%</b></label><input type="range" id="cVol" min="0" max="2" step="0.05" value="${s.volume ?? 1}"></div>
           <label class="row"><input type="checkbox" id="cMute" ${s.muted ? 'checked' : ''}> Mute clip sound</label>
           ${stabSection(s)}`}
      <div class="field mt"><label>Framing</label><div class="seg"><button data-fit="fill" class="${s.fit !== 'fit' ? 'on' : ''}">Fill frame</button><button data-fit="fit" class="${s.fit === 'fit' ? 'on' : ''}">Fit + blur</button></div></div>
      <div class="field"><label>Opacity <b>${Math.round((s.opacity ?? 1) * 100)}%</b></label><input type="range" id="cOp" min="0" max="1" step="0.01" value="${s.opacity ?? 1}"></div>
      ${s.type === 'video' ? `<h4>Sound</h4>
      <div class="row wrap"><button class="btn ghost small" id="cExtract">${H.icon('music', 14)} Extract audio</button></div>
      ${voiceSection(V.p.audio.find((a) => a.voiceOf === s.id)?.voice || 'none')}` : ''}
      <h4>Clip motion</h4>
      <div class="filter-grid">${EFFECTS.map(([id, l]) => `<button data-fx="${id}" class="${(s.effect || 'none') === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row wrap mt"><button class="btn ghost small" id="cMoreFx">${H.icon('sparkle', 14)} Video & body effects</button>${idx > 0 ? `<button class="btn ghost small" id="cMoreTr">${H.icon('transition', 14)} Transitions</button>` : ''}</div>
      ${s.type !== 'color' ? `<h4>Crop & position</h4>
      <label class="frow">Zoom <input type="range" id="tZoom" min="1" max="3" step="0.02" value="${tf.zoom || 1}"></label>
      <label class="frow">Move left / right <input type="range" id="tX" min="-1" max="1" step="0.01" value="${tf.x || 0}"></label>
      <label class="frow">Move up / down <input type="range" id="tY" min="-1" max="1" step="0.01" value="${tf.y || 0}"></label>
      <label class="frow">Rotate <b id="tRotFv">${Math.round(tf.r || 0)}°</b> <input type="range" id="tRotF" min="-180" max="180" step="1" value="${tf.r || 0}"></label>
      <div class="row wrap"><button class="btn ghost small" id="tRot">Rotate 90°</button><button class="btn ghost small" id="tFx">Flip ↔</button><button class="btn ghost small" id="tFy">Flip ↕</button><button class="btn ghost small" id="tReset">Reset</button></div>
      ${maskSection(s)}` : ''}
      <h4>Filter</h4>
      <div class="filter-grid">${FILTERS.map((f) => `<button data-flt="${f.id}" class="${(s.filter || 'none') === f.id ? 'on' : ''}">${f.label}</button>`).join('')}</div>
      <h4>Adjust</h4>
      ${['brightness', 'contrast', 'saturate'].map((k) => `<label class="frow">${k === 'saturate' ? 'Saturation' : k[0].toUpperCase() + k.slice(1)} <input type="range" data-adj="${k}" min="0.3" max="1.8" step="0.02" value="${s.adjust?.[k] ?? 1}"></label>`).join('')}
      ${s.type !== 'color' ? `${ADJ_EXTRA.map(([k, l, min]) => `<label class="frow">${l} <input type="range" data-adj="${k}" min="${min}" max="1" step="0.02" value="${s.adjust?.[k] ?? 0}"${min < 0 ? ' class="mid"' : ''}></label>`).join('')}
      ${Object.keys(s.adjust || {}).length ? `<button class="btn ghost small" id="cAdjReset">Reset adjustments</button>` : ''}` : ''}
      ${idx > 0 ? `<h4>Transition into this clip</h4>
        <div class="filter-grid">${TRANSITIONS.map(([id, l]) => `<button data-tr="${id}" class="${(s.transition?.type || 'none') === id ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="field mt"><label>Transition length <b>${(s.transition?.dur || 0.5).toFixed(1)}s</b></label><input type="range" id="cTrDur" min="0.2" max="2" step="0.1" value="${s.transition?.dur || 0.5}"></div>
        <button class="btn ghost small" id="cTrAll">Use this transition everywhere</button>` : ''}
      <div class="row wrap mt">
        <button class="btn ghost small" id="cLeft">${H.icon('chevLeft', 14)} Move earlier</button>
        <button class="btn ghost small" id="cRight">Move later ${H.icon('chevRight', 14)}</button>
        <button class="btn ghost small" id="cSplit">Split</button>
        <button class="btn ghost small" id="cDel">Delete</button>
      </div>`;
    const on = (id, ev, fn) => { const x = $(id, el); if (x) x[ev] = fn; };
    on('#cDur', 'oninput', (e) => { s.dur = +e.target.value; renderTimelineLive(); });
    on('#cReplace', 'onclick', () => replaceClip(s));
    on('#cFreeze', 'onclick', freezeFrame);
    on('#cColor', 'oninput', (e) => { s.color = e.target.value; });
    on('#cColor', 'onchange', () => commit());
    $$('[data-fx]', el).forEach((b) => (b.onclick = () => { s.effect = b.dataset.fx; commit(); seek(clipStarts()[idx]); }));
    const setTf = (k, v) => { s.tf = { ...(s.tf || {}), [k]: v }; };
    on('#tZoom', 'oninput', (e) => setTf('zoom', +e.target.value));
    on('#tX', 'oninput', (e) => setTf('x', +e.target.value));
    on('#tY', 'oninput', (e) => setTf('y', +e.target.value));
    ['#tZoom', '#tX', '#tY'].forEach((id) => on(id, 'onchange', () => commit()));
    on('#tRot', 'onclick', () => { setTf('rot', ((tf.rot || 0) + 90) % 360); commit(); });
    on('#tFx', 'onclick', () => { setTf('fx', !tf.fx); commit(); });
    on('#tFy', 'onclick', () => { setTf('fy', !tf.fy); commit(); });
    on('#tReset', 'onclick', () => { s.tf = {}; commit(); });
    on('#tRotF', 'oninput', (e) => { setTf('r', +e.target.value); $('#tRotFv', el).textContent = `${Math.round(+e.target.value)}°`; });
    on('#tRotF', 'onchange', () => commit());
    on('#tRotF', 'ondblclick', () => { setTf('r', 0); commit(); });
    on('#cOp', 'oninput', (e) => { s.opacity = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = `${Math.round(s.opacity * 100)}%`; });
    on('#cOp', 'onchange', () => commit());
    on('#cAdjReset', 'onclick', () => { s.adjust = {}; commit(); });
    on('#cExtract', 'onclick', () => extractAudio(s));
    bindMask(el, s);
    $$('[data-voice]', el).forEach((b) => (b.onclick = () => applyVoiceToClip(s, b.dataset.voice)));
    on('#cDur', 'onchange', () => commit());
    $$('[data-spd]', el).forEach((b) => (b.onclick = () => { s.speed = +b.dataset.spd; delete s.curve; commit(); }));
    if (s.type === 'video') bindSpeedSection(el, s);
    on('#cVol', 'oninput', (e) => { s.volume = +e.target.value; });
    on('#cVol', 'onchange', () => commit());
    on('#cMute', 'onchange', (e) => { s.muted = e.target.checked; commit(); });
    $$('[data-fit]', el).forEach((b) => (b.onclick = () => { s.fit = b.dataset.fit; commit(); }));
    $$('[data-flt]', el).forEach((b) => (b.onclick = () => { s.filter = b.dataset.flt; commit(); }));
    $$('[data-adj]', el).forEach((r) => {
      r.oninput = () => { s.adjust = { ...(s.adjust || {}), [r.dataset.adj]: +r.value }; };
      r.onchange = () => commit();
    });
    $$('[data-tr]', el).forEach((b) => (b.onclick = () => { s.transition = { type: b.dataset.tr, dur: s.transition?.dur || 0.5 }; commit(); seek(Math.max(0, clipStarts()[idx] - 0.6)); }));
    on('#cTrDur', 'oninput', (e) => { s.transition = { ...(s.transition || { type: 'fade' }), dur: +e.target.value }; });
    on('#cTrDur', 'onchange', () => commit());
    on('#cTrAll', 'onclick', () => { V.p.clips.forEach((c, i) => { if (i > 0) c.transition = { ...s.transition }; }); commit(); H.toast('Applied to all clips'); });
    on('#cMoreFx', 'onclick', () => { V.tab = 'effects'; V.panelOpen = true; if (H.isMobile()) V.inspectorOpen = false; syncPanels(); renderPanel(); });
    on('#cMoreTr', 'onclick', () => openTransitions(idx));
    on('#cLeft', 'onclick', () => moveClip(-1));
    on('#cRight', 'onclick', () => moveClip(1));
    on('#cSplit', 'onclick', splitAtPlayhead);
    on('#cDel', 'onclick', deleteSel);
    return;
  }
  if (kind === 'overlay') {
    const isText = s.type === 'text';
    el.innerHTML = `<h3>${isText ? 'Text' : 'Sticker / image'}</h3>
      ${isText ? `<label class="flabel">Text<textarea class="search" id="oText" rows="3">${H.esc(s.text)}</textarea></label>
      <div class="field"><label>Font</label><select id="oFont">${FONTS.map((f) => `<option ${f === s.font ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select></div>
      <div class="row wrap"><button class="tool ${s.weight === '800' || s.weight === '900' || s.weight === 'bold' ? 'on' : ''}" id="oBold"><b>B</b></button><button class="tool ${s.italic ? 'on' : ''}" id="oItal"><i>I</i></button>
        <div class="seg">${['left', 'center', 'right'].map((al) => `<button data-al="${al}" class="${(s.align || 'center') === al ? 'on' : ''}">${H.icon('align-' + al, 14)}</button>`).join('')}</div></div>
      <div class="field mt"><label>Size <b>${Math.round(s.size * 100)}</b></label><input type="range" id="oSize" min="0.02" max="0.3" step="0.005" value="${s.size}"></div>
      <div class="grid2"><label>Color<input type="color" id="oColor" value="${s.color || '#ffffff'}"></label>
        <label>Background<span class="row"><input type="checkbox" id="oBgOn" ${s.bg ? 'checked' : ''}><input type="color" id="oBg" value="${s.bg || '#ffffff'}"></span></label>
        <label>Outline<span class="row"><input type="checkbox" id="oStOn" ${s.stroke ? 'checked' : ''}><input type="color" id="oSt" value="${s.stroke || '#000000'}"></span></label>
        <label>Glow<span class="row"><input type="checkbox" id="oGlOn" ${s.glow ? 'checked' : ''}><input type="color" id="oGl" value="${s.glow || '#e879f9'}"></span></label></div>
      <label class="row mt"><input type="checkbox" id="oShadow" ${s.shadow ? 'checked' : ''}> Drop shadow</label>`
      : `<div class="field"><label>Size <b>${Math.round(s.scale * 100)}</b></label><input type="range" id="oScale" min="0.05" max="1.5" step="0.01" value="${s.scale}"></div>
         ${s.emoji ? '' : `<label class="row"><input type="checkbox" id="oRound" ${s.round ? 'checked' : ''}> Circle crop</label>`}
         <div class="field mt"><label>Blend mode</label><select id="oBlend">${BLEND_MODES.map(([id, l]) => `<option value="${id}" ${(s.blend || 'normal') === id ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
         ${s.emoji ? '' : maskSection(s)}
         ${s.type === 'video' ? `<div class="field mt"><label>Volume <b>${Math.round((s.volume ?? 1) * 100)}%</b></label><input type="range" id="oVol" min="0" max="2" step="0.05" value="${s.volume ?? 1}"></div>
           <label class="row"><input type="checkbox" id="oMute" ${s.muted ? 'checked' : ''}> Mute</label>` : ''}
         ${s.emoji ? '' : `<h4>Green screen (chroma key)</h4>
           <label class="row"><input type="checkbox" id="oChroma" ${s.chroma ? 'checked' : ''}> Remove background color</label>
           <div class="row mt"><input type="color" id="oChromaC" value="${s.chroma || '#00ff00'}"><button class="btn ghost small" data-ck="#00ff00">Green</button><button class="btn ghost small" data-ck="#0000ff">Blue</button><button class="btn ghost small" data-ck="#ffffff">White</button></div>
           <label class="frow mt">Strength <input type="range" id="oChromaT" min="5" max="70" value="${s.chromaTol ?? 30}"></label>`}`}
      <div class="field mt"><label>Rotation <b>${Math.round(s.rot || 0)}°</b></label><input type="range" id="oRot" min="-180" max="180" step="1" value="${s.rot || 0}"></div>
      <h4>Keyframes ${s.keys?.length ? `<small class="muted">(${s.keys.length})</small>` : ''}</h4>
      <p class="muted">Add a keyframe, move the playhead, then drag or resize the item on the video — it animates between keyframes.</p>
      <div class="row wrap"><button class="btn ghost small" id="kAdd">◆ Add keyframe at playhead</button>${s.keys?.length ? `<button class="btn ghost small" id="kClear">Remove keyframes</button>` : ''}</div>
      ${s.keys?.length ? `<div class="kf-list">${[...s.keys].sort((a, b) => a.t - b.t).map((k, i) => `<button class="kf" data-kt="${k.t}">◆ ${(s.start + k.t).toFixed(1)}s</button>`).join('')}</div>` : ''}
      <div class="field mt"><label>Opacity <b>${Math.round((s.opacity ?? 1) * 100)}%</b></label><input type="range" id="oOp" min="0.1" max="1" step="0.05" value="${s.opacity ?? 1}"></div>
      <div class="grid2"><label>Animation in<select id="oIn">${ANIM_IN.filter(([id]) => isText || id !== 'type').map(([id, l]) => `<option value="${id}" ${s.animIn === id ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Animation out<select id="oOut">${ANIM_OUT.map(([id, l]) => `<option value="${id}" ${s.animOut === id ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Starts at (s)<input type="number" id="oStart" step="0.1" min="0" value="${s.start.toFixed(1)}"></label>
        <label>Duration (s)<input type="number" id="oDur" step="0.1" min="0.2" value="${s.dur.toFixed(1)}"></label></div>
      <div class="row wrap mt"><button class="btn ghost small" id="oCenter">Center</button><button class="btn ghost small" id="oFull">Show for whole video</button><button class="btn ghost small" id="oDup">Duplicate</button><button class="btn ghost small" id="oDel">Delete</button></div>`;
    const on = (id, ev, fn) => { const x = $(id, el); if (x) x[ev] = fn; };
    on('#oText', 'oninput', (e) => { s.text = e.target.value; });
    on('#oText', 'onchange', () => commit());
    on('#oFont', 'onchange', async (e) => { s.font = e.target.value; try { await document.fonts.load(`${s.weight || 400} 40px "${s.font}"`); } catch {} commit(); });
    on('#oBold', 'onclick', () => { s.weight = s.weight === '800' || s.weight === '900' || s.weight === 'bold' ? 'normal' : '800'; commit(); });
    on('#oItal', 'onclick', () => { s.italic = !s.italic; commit(); });
    $$('[data-al]', el).forEach((b) => (b.onclick = () => { s.align = b.dataset.al; commit(); }));
    on('#oSize', 'oninput', (e) => { s.size = +e.target.value; });
    on('#oSize', 'onchange', () => commit());
    on('#oScale', 'oninput', (e) => { s.scale = +e.target.value; });
    on('#oScale', 'onchange', () => commit());
    on('#oColor', 'oninput', (e) => { s.color = e.target.value; });
    on('#oColor', 'onchange', () => commit());
    const pair = (chk, col, key) => {
      on(chk, 'onchange', (e) => { s[key] = e.target.checked ? $(col, el).value : ''; commit(); });
      on(col, 'oninput', (e) => { s[key] = e.target.value; $(chk, el).checked = true; });
      on(col, 'onchange', () => commit());
    };
    pair('#oBgOn', '#oBg', 'bg');
    pair('#oStOn', '#oSt', 'stroke');
    pair('#oGlOn', '#oGl', 'glow');
    on('#oShadow', 'onchange', (e) => { s.shadow = e.target.checked; commit(); });
    on('#oRound', 'onchange', (e) => { s.round = e.target.checked; commit(); });
    on('#oBlend', 'onchange', (e) => { s.blend = e.target.value; commit(); });
    bindMask(el, s);
    on('#oVol', 'oninput', (e) => { s.volume = +e.target.value; });
    on('#oVol', 'onchange', () => commit());
    on('#oMute', 'onchange', (e) => { s.muted = e.target.checked; commit(); });
    on('#oChroma', 'onchange', (e) => { s.chroma = e.target.checked ? $('#oChromaC', el).value : ''; commit(); });
    on('#oChromaC', 'oninput', (e) => { s.chroma = e.target.value; $('#oChroma', el).checked = true; });
    on('#oChromaC', 'onchange', () => commit());
    $$('[data-ck]', el).forEach((b) => (b.onclick = () => { s.chroma = b.dataset.ck; commit(); }));
    on('#oChromaT', 'oninput', (e) => { s.chromaTol = +e.target.value; });
    on('#oChromaT', 'onchange', () => commit());
    on('#oRot', 'oninput', (e) => { s.rot = +e.target.value; });
    on('#oRot', 'onchange', () => commit());
    on('#kAdd', 'onclick', () => {
      if (V.t < s.start || V.t > s.start + s.dur) seek(s.start);
      setKeyValue(s, {});
      commit();
      H.toast('Keyframe added — move the playhead and drag the item to animate it');
    });
    on('#kClear', 'onclick', () => {
      const k = keyed(s, V.t - s.start);
      Object.assign(s, { x: k.x, y: k.y, opacity: k.opacity, ...(s.type === 'text' ? { size: k.size } : { scale: k.scale }) });
      s.keys = [];
      commit();
    });
    $$('[data-kt]', el).forEach((b) => (b.onclick = () => seek(s.start + +b.dataset.kt)));
    on('#oOp', 'oninput', (e) => { s.opacity = +e.target.value; });
    on('#oOp', 'onchange', () => commit());
    on('#oIn', 'onchange', (e) => { s.animIn = e.target.value; commit(); seek(s.start); });
    on('#oOut', 'onchange', (e) => { s.animOut = e.target.value; commit(); seek(Math.max(s.start, s.start + s.dur - 0.7)); });
    on('#oStart', 'onchange', (e) => { s.start = Math.max(0, +e.target.value || 0); commit(); });
    on('#oDur', 'onchange', (e) => { s.dur = Math.max(0.2, +e.target.value || 1); commit(); });
    on('#oCenter', 'onclick', () => { s.x = 0.5; s.y = 0.5; commit(); });
    on('#oFull', 'onclick', () => { s.start = 0; s.dur = Math.max(0.5, totalDur()); commit(); });
    on('#oDup', 'onclick', duplicateSel);
    on('#oDel', 'onclick', deleteSel);
    return;
  }
  if (kind === 'effect') {
    const body = s.kind === 'body';
    const opts = body ? BODY_FX : VIDEO_FX;
    el.innerHTML = `<h3>${body ? 'Body effect' : 'Video effect'}</h3>
      <p class="muted">Applies to everything under it, from ${fmt(s.start)} for ${s.dur.toFixed(1)}s.</p>
      ${body ? `<p class="muted">${segStatusText()}</p>` : ''}
      <div class="field"><label>Effect</label><select id="eFx">${body ? opts.map((f) => `<option value="${f.id}" ${f.id === s.fx ? 'selected' : ''}>${H.esc(f.name)}</option>`).join('') : FX_CATS.slice(1).map((c) => `<optgroup label="${c}">${opts.filter((f) => f.cat === c).map((f) => `<option value="${f.id}" ${f.id === s.fx ? 'selected' : ''}>${H.esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field"><label>Strength <b>${Math.round((s.amount ?? 1) * 100)}%</b></label><input type="range" id="eAmt" min="0.2" max="1.5" step="0.05" value="${s.amount ?? 1}"></div>
      ${COLOR_FX[s.fx] ? `<div class="field"><label>Color</label><input type="color" id="eColor" value="${s.color || COLOR_FX[s.fx]}"></div>` : ''}
      <div class="grid2"><label>Starts at (s)<input type="number" id="eStart" step="0.1" min="0" value="${s.start.toFixed(1)}"></label>
        <label>Duration (s)<input type="number" id="eDur" step="0.1" min="0.2" value="${s.dur.toFixed(1)}"></label></div>
      <div class="row wrap mt"><button class="btn ghost small" id="ePlay">${H.icon('play', 14)} Preview</button><button class="btn ghost small" id="eFull">Whole video</button><button class="btn ghost small" id="eClip">Match clip</button></div>
      <div class="row wrap"><button class="btn ghost small" id="eDup">Duplicate</button><button class="btn ghost small" id="eSplit">Split</button><button class="btn ghost small" id="eDel">Delete</button></div>`;
    const on = (id, ev, fn) => { const x = $(id, el); if (x) x[ev] = fn; };
    on('#eFx', 'onchange', (e) => { s.fx = e.target.value; if (COLOR_FX[s.fx] && !s.color) s.color = COLOR_FX[s.fx]; commit(); previewRange(s.start, s.start + Math.min(s.dur, 2.5)); });
    on('#eAmt', 'oninput', (e) => { s.amount = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = Math.round(s.amount * 100) + '%'; });
    on('#eAmt', 'onchange', () => commit());
    on('#eColor', 'oninput', (e) => { s.color = e.target.value; });
    on('#eColor', 'onchange', () => commit());
    on('#eStart', 'onchange', (e) => { s.start = Math.max(0, +e.target.value || 0); commit(); });
    on('#eDur', 'onchange', (e) => { s.dur = Math.max(0.2, +e.target.value || 1); commit(); });
    on('#ePlay', 'onclick', () => previewRange(s.start, s.start + Math.min(s.dur, 4)));
    on('#eFull', 'onclick', () => { s.start = 0; s.dur = Math.max(0.5, V.p.clips.length ? mainDur() : totalDur()); commit(); });
    on('#eClip', 'onclick', () => { const act = activeClip(clamp(V.t, s.start, s.start + s.dur - 0.01)) || activeClip(s.start); if (act) { s.start = act.start; s.dur = clipDur(act.clip); commit(); } });
    on('#eDup', 'onclick', duplicateSel);
    on('#eSplit', 'onclick', splitAtPlayhead);
    on('#eDel', 'onclick', deleteSel);
    return;
  }
  if (kind === 'audio') {
    const len = s.out - s.in;
    const am = V.meta.get(s.mediaId) || V.meta.get(s.voiceSrc?.mediaId) || {};
    el.innerHTML = `<h3>Audio</h3><p class="muted">${H.esc(s.name || '')} · ${len.toFixed(1)}s</p>
      ${am.credit ? `<p class="muted small-note credit">${H.esc(creditLine(am.credit))}${am.credit.link ? ` · <a href="${H.esc(am.credit.link)}" target="_blank" rel="noopener">source</a>` : ''}</p>` : ''}
      <div class="field"><label>Volume <b>${Math.round((s.volume ?? 1) * 100)}%</b></label><input type="range" id="aVol" min="0" max="2" step="0.05" value="${s.volume ?? 1}"></div>
      <div class="field"><label>Fade in <b>${(s.fadeIn || 0).toFixed(1)}s</b></label><input type="range" id="aIn" min="0" max="5" step="0.1" value="${s.fadeIn || 0}"></div>
      <div class="field"><label>Fade out <b>${(s.fadeOut || 0).toFixed(1)}s</b></label><input type="range" id="aOut" min="0" max="5" step="0.1" value="${s.fadeOut || 0}"></div>
      <div class="row wrap"><button class="btn ghost small" id="aFit">Trim to video length</button><button class="btn ghost small" id="aSplit">Split</button><button class="btn ghost small" id="aDel">Delete</button></div>
      ${beatSection(s)}
      ${voiceSection(s.voice || 'none')}`;
    const on = (id, ev, fn) => { const x = $(id, el); if (x) x[ev] = fn; };
    on('#aVol', 'oninput', (e) => { s.volume = +e.target.value; });
    on('#aVol', 'onchange', () => commit());
    on('#aIn', 'onchange', (e) => { s.fadeIn = +e.target.value; commit(); });
    on('#aOut', 'onchange', (e) => { s.fadeOut = +e.target.value; commit(); });
    on('#aFit', 'onclick', () => { const md = mainDur(); if (md > s.start) { s.out = Math.min(s.out, s.in + (md - s.start)); commit(); } });
    on('#aSplit', 'onclick', splitAtPlayhead);
    on('#aDel', 'onclick', deleteSel);
    $$('[data-voice]', el).forEach((b) => (b.onclick = () => applyVoiceToTrack(s, b.dataset.voice)));
    bindBeatSection(el, s);
  }
}

// ---------- export ----------
function openExport() {
  if (!V.p.clips.length && !V.p.overlays.length) return H.toast('Add some clips first');
  const mime = videoMime();
  const m = document.createElement('div');
  m.className = 'modal-back';
  const short = Math.min(V.p.width, V.p.height);
  m.innerHTML = `<div class="modal small">
    <h3>Export video</h3>
    <p class="muted">Length ${fmt(totalDur())}. Exporting plays your video once in real time, so keep this tab open.</p>
    <div class="field"><label>Quality</label><select id="exRes">${[...new Set([480, 720, 1080, 1440, 2160, short].filter((r) => r <= short))].sort((a, b) => a - b).map((r) => `<option value="${r}" ${r === Math.min(1080, short) ? 'selected' : ''}>${r === short ? `Full size (${V.p.width}×${V.p.height})` : `${r}p`}</option>`).join('')}</select></div>
    <p class="muted">Format: ${mime ? (mime.includes('mp4') ? 'MP4' : 'WebM') : 'not supported in this browser'}</p>
    <div class="row end"><button class="btn ghost" id="exCancel">Cancel</button><button class="btn primary" id="exGo" ${mime ? '' : 'disabled'}>Export</button></div>
  </div>`;
  document.body.appendChild(m);
  $('#exCancel', m).onclick = () => m.remove();
  $('#exGo', m).onclick = async () => {
    const res = +$('#exRes', m).value;
    m.remove();
    if ((V.p.effects || []).some((e) => e.kind === 'body') && segState() !== 'ready') {
      H.toast('Loading body effects…');
      try {
        await loadSegmenter();
      } catch {
        H.toast("Body effects couldn't load, so they'll be left out of this export");
      }
    }
    startExport(res, mime);
  };
}

function startExport(res, mime) {
  const s = res / Math.min(V.p.width, V.p.height);
  const w = Math.round((V.p.width * s) / 2) * 2;
  const h = Math.round((V.p.height * s) / 2) * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.cssText = 'position:fixed;left:-99999px;top:0';
  document.body.appendChild(c);
  ensureAudioGraph();
  V.ac?.resume?.();
  const tracks = [...c.captureStream(30).getVideoTracks(), ...(V.dest ? V.dest.stream.getAudioTracks() : [])];
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: res >= 1080 ? 10_000_000 : 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const overlay = document.createElement('div');
  overlay.className = 'modal-back';
  overlay.innerHTML = `<div class="modal small"><h3>Exporting…</h3><p class="v-progress" id="exProg">Rendering… 0%</p><p class="muted">Keep this tab open and visible.</p><div class="row end"><button class="btn ghost" id="exStop">Cancel</button></div></div>`;
  document.body.appendChild(overlay);
  V.out = { c, g: c.getContext('2d'), w, h, rec, chunks, overlay, prog: $('#exProg', overlay), mime, cancelled: false };
  $('#exStop', overlay).onclick = () => {
    V.out.cancelled = true;
    finishExport();
  };
  V.sel = null;
  seek(0);
  V.exporting = true;
  // let elements park on their first frames before recording
  setTimeout(() => {
    if (!V?.out) return;
    rec.start(250);
    setPlaying(true);
  }, 400);
}

function finishExport() {
  const o = V.out;
  if (!o) return;
  V.exporting = false;
  setPlaying(false);
  V.out = null;
  o.rec.onstop = () => {
    o.c.remove();
    o.overlay.remove();
    if (o.cancelled) return H.toast('Export cancelled');
    const blob = new Blob(o.chunks, { type: o.mime.split(';')[0] });
    const name = `${(V?.p.name || 'artvas-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'artvas-video'}.${o.mime.includes('mp4') ? 'mp4' : 'webm'}`;
    H.download(URL.createObjectURL(blob), name);
    H.toast('Video exported');
  };
  if (o.rec.state !== 'inactive') o.rec.stop();
  else o.rec.onstop();
  renderTimeline();
  renderInspector();
}

// test hook
export const _videoDebug = () => V;

/** Put a file input made in code into the page (visually hidden) so phones open the picker. */
function attachPicker(inp) {
  inp.className = 'file-hide';
  inp.tabIndex = -1;
  document.body.appendChild(inp);
  inp.addEventListener('change', () => setTimeout(() => inp.remove(), 1000));
  // if the picker is closed without choosing, tidy up the next time the page gets focus
  window.addEventListener('focus', () => setTimeout(() => !inp.files?.length && inp.remove(), 3000), { once: true });
}
