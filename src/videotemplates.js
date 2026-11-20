// Artvas original video templates. A template is a sequence of media slots (cut length, effect,
// transition, filter) plus timed text/sticker layers. "Use template" fills the slots with the
// user's photos and videos in order.
import { uid } from './storage.js';

// Text styles used by templates (sizes are a fraction of the shorter video side).
const S = {
  hook: { font: 'Anton', weight: 'normal', size: 0.085, color: '#ffffff', stroke: '#000000' },
  big: { font: 'Unbounded', weight: '900', size: 0.11, color: '#ffffff', shadow: true },
  title: { font: 'Bricolage Grotesque', weight: '800', size: 0.08, color: '#ffffff', shadow: true },
  caption: { font: 'DM Sans', weight: '700', size: 0.045, color: '#111111', bg: '#ffffff' },
  capdark: { font: 'DM Sans', weight: '700', size: 0.045, color: '#ffffff', bg: 'rgba(0,0,0,0.6)' },
  serif: { font: 'Instrument Serif', weight: 'normal', italic: true, size: 0.1, color: '#ffffff', shadow: true },
  marker: { font: 'Caveat', weight: '700', size: 0.09, color: '#ffffff', shadow: true },
  neon: { font: 'Unbounded', weight: '900', size: 0.085, color: '#fdf4ff', glow: '#e879f9' },
  highlight: { font: 'Unbounded', weight: '900', size: 0.06, color: '#111111', bg: '#facc15' },
  red: { font: 'Bricolage Grotesque', weight: '800', size: 0.06, color: '#ffffff', bg: '#ff2442' },
  lower: { font: 'DM Sans', weight: '700', size: 0.04, color: '#ffffff', bg: '#7c3aed' },
  count: { font: 'Anton', weight: 'normal', size: 0.22, color: '#ffffff', stroke: '#000000' },
  hand: { font: 'Permanent Marker', weight: 'normal', size: 0.08, color: '#fde047', shadow: true },
  emoji: { emoji: true },
};

// slot helper: [duration, effect, transition, filter]
const slots = (n, dur, effect = 'none', transition = 'none', filter = 'none') => Array.from({ length: n }, () => [dur, effect, transition, filter]);
// text layer: at = slot index | 'all' | 'end' | [start, dur]
const t = (text, style, at, y = 0.5, extra = {}) => ({ text, style, at, y, ...extra });

export const VIDEO_TEMPLATES = [
  // ---------- Trending ----------
  { id: 'photodump', name: 'Photo dump', cat: 'Trending', color: '#f472b6', slots: slots(8, 0.6, 'kb-in'), layers: [t('photo dump 📸', 'marker', [0, 2.4], 0.15, { animIn: 'pop' })] },
  { id: 'beat10', name: 'Beat sync 10', cat: 'Trending', color: '#8b5cf6', slots: [...slots(9, 0.45, 'flash'), [1.6, 'kb-in', 'zoom', 'none']], layers: [t('VIBES', 'big', 'end', 0.5, { animIn: 'zoom' })] },
  { id: 'glitchintro', name: 'Glitch intro', cat: 'Trending', color: '#06b6d4', slots: slots(4, 1.1, 'glitch', 'glitch'), layers: [t('NEW VIDEO', 'neon', [0, 2], 0.5, { animIn: 'pop' }), t('watch till the end', 'capdark', [2.2, 2.2], 0.82)] },
  { id: 'zoomcuts', name: 'Zoom cuts', cat: 'Trending', color: '#f59e0b', slots: slots(6, 0.8, 'kb-in', 'zoom'), layers: [t('wait for it…', 'hook', [0, 2], 0.2, { animIn: 'pop' })] },
  { id: 'pov', name: 'POV', cat: 'Trending', color: '#ef4444', slots: slots(3, 1.8, 'kb-in', 'fade'), layers: [t('POV: you finally did it', 'hook', 'all', 0.18, { animIn: 'type' })] },
  { id: 'grwm', name: 'Get ready with me', cat: 'Trending', color: '#ec4899', slots: slots(5, 1.3, 'kb-in', 'slide'), layers: [t('GRWM ✨', 'highlight', [0, 2.2], 0.15, { animIn: 'pop' }), t('skincare', 'caption', 1, 0.82), t('makeup', 'caption', 2, 0.82), t('outfit', 'caption', 3, 0.82), t('ready!', 'caption', 4, 0.82)] },
  { id: 'storytime', name: 'Story time', cat: 'Trending', color: '#a855f7', slots: [[7, 'kb-in', 'none', 'none']], layers: [t('story time 👀', 'marker', [0, 2], 0.15, { animIn: 'pop' }), t('so this happened…', 'caption', [2, 2.5], 0.8), t('and then…', 'caption', [4.5, 2.5], 0.8)] },
  { id: 'recap', name: 'Year recap', cat: 'Trending', color: '#0ea5e9', slots: slots(12, 0.5, 'flash'), layers: [t('2026 RECAP', 'big', [0, 2.5], 0.5, { animIn: 'zoom' }), t('thank you ❤️', 'serif', 'end', 0.5)] },
  // ---------- Lifestyle ----------
  { id: 'dayinlife', name: 'Day in my life', cat: 'Lifestyle', color: '#fb923c', slots: slots(6, 1.6, 'kb-in', 'fade', 'warm'), layers: [t('a day in my life', 'serif', [0, 2.4], 0.45, { animIn: 'fade' }), t('7:00 wake up', 'caption', 1, 0.82), t('coffee first', 'caption', 2, 0.82), t('work mode', 'caption', 3, 0.82), t('golden hour', 'caption', 4, 0.82), t('night in', 'caption', 5, 0.82)] },
  { id: 'travel', name: 'Travel diary', cat: 'Travel', color: '#14b8a6', slots: slots(6, 1.6, 'kb-in', 'fade', 'vivid'), layers: [t('summer in Bali', 'serif', [0, 3], 0.42, { animIn: 'fade' }), t('📍 Uluwatu', 'capdark', 2, 0.85), t('📍 Ubud', 'capdark', 3, 0.85), t('📍 Canggu', 'capdark', 4, 0.85)] },
  { id: 'roadtrip', name: 'Road trip', cat: 'Travel', color: '#22c55e', slots: slots(7, 1, 'pan', 'slide'), layers: [t('ROAD TRIP', 'big', [0, 2], 0.5, { animIn: 'pop' }), t('day 1 / 7', 'marker', 'end', 0.8)] },
  { id: 'memories', name: 'Memories (VHS)', cat: 'Lifestyle', color: '#78716c', slots: slots(6, 1.4, 'vhs', 'fade', 'vintage'), layers: [t('memories', 'marker', [0, 3], 0.5, { animIn: 'fade' })] },
  { id: 'pets', name: 'Pet moments', cat: 'Lifestyle', color: '#f59e0b', slots: slots(6, 1.1, 'kb-in', 'zoom'), layers: [t('my best friend', 'marker', [0, 2.4], 0.15, { animIn: 'pop' }), { emoji: '🐶', at: [0.5, 3], x: 0.82, y: 0.3, scale: 0.18 }, { emoji: '❤️', at: 'end', x: 0.5, y: 0.5, scale: 0.3 }] },
  { id: 'love', name: 'Love story', cat: 'Lifestyle', color: '#f43f5e', slots: slots(6, 1.5, 'kb-out', 'blur', 'warm'), layers: [t('you & me', 'serif', [0, 3], 0.5, { animIn: 'fade' }), t('forever', 'serif', 'end', 0.5)] },
  { id: 'birthday', name: 'Birthday wishes', cat: 'Celebration', color: '#ec4899', slots: slots(6, 1.2, 'kb-in', 'zoom'), layers: [t('Happy Birthday!', 'hand', [0, 3], 0.2, { animIn: 'pop' }), { emoji: '🎂', at: [0, 3], x: 0.5, y: 0.75, scale: 0.22 }, t('love you 🎉', 'marker', 'end', 0.5)] },
  { id: 'wedding', name: 'Wedding highlights', cat: 'Celebration', color: '#d4a373', slots: slots(6, 1.8, 'kb-in', 'fade', 'fade'), layers: [t('Emma & James', 'serif', [0, 3.5], 0.45, { animIn: 'fade' }), t('12 · 09 · 2026', 'capdark', [0.8, 2.7], 0.58)] },
  { id: 'graduation', name: 'Graduation', cat: 'Celebration', color: '#1e3a8a', slots: slots(5, 1.3, 'kb-in', 'slide'), layers: [t('CLASS OF 2026', 'big', [0, 2.5], 0.5, { animIn: 'zoom' }), { emoji: '🎓', at: 'end', x: 0.5, y: 0.5, scale: 0.3 }] },
  { id: 'holiday', name: 'Holiday greetings', cat: 'Celebration', color: '#16a34a', slots: slots(5, 1.4, 'kb-in', 'fade', 'warm'), layers: [t('Merry Christmas', 'serif', [0, 3], 0.45, { animIn: 'fade' }), { emoji: '🎄', at: 'end', x: 0.5, y: 0.5, scale: 0.3 }] },
  // ---------- Fashion & beauty ----------
  { id: 'ootd', name: 'OOTD', cat: 'Fashion', color: '#111111', slots: slots(4, 1, 'kb-in', 'slide'), layers: [t('OOTD', 'highlight', [0, 1.6], 0.14, { animIn: 'pop' }), t('jacket — vintage', 'caption', 1, 0.82), t('jeans — thrifted', 'caption', 2, 0.82), t('shoes — new in', 'caption', 3, 0.82)] },
  { id: 'beforeafter', name: 'Before / after', cat: 'Fashion', color: '#a78bfa', slots: [[2.2, 'none', 'none', 'none'], [2.8, 'kb-in', 'wipe', 'vivid']], layers: [t('BEFORE', 'capdark', 0, 0.12), t('AFTER', 'red', 1, 0.12, { animIn: 'pop' })] },
  { id: 'glowup', name: 'Glow up', cat: 'Fashion', color: '#f0abfc', slots: [[2, 'none', 'none', 'bw'], [0.4, 'flash', 'white', 'none'], [2.6, 'kb-in', 'none', 'vivid']], layers: [t('my glow up', 'marker', [0, 2], 0.15), t('✨✨✨', 'big', 2, 0.5)] },
  // ---------- Food ----------
  { id: 'recipe', name: 'Recipe in 15s', cat: 'Food', color: '#ea580c', slots: slots(6, 2.2, 'kb-in', 'slide', 'vivid'), layers: [t('15-MIN PASTA', 'hook', [0, 2.2], 0.15, { animIn: 'pop' }), t('1. boil pasta', 'caption', 1, 0.82), t('2. garlic + butter', 'caption', 2, 0.82), t('3. add tomatoes', 'caption', 3, 0.82), t('4. toss & cheese', 'caption', 4, 0.82), t('enjoy! 🍝', 'marker', 5, 0.5)] },
  { id: 'foodreview', name: 'Food review', cat: 'Food', color: '#facc15', slots: slots(5, 1.4, 'kb-in', 'zoom', 'warm'), layers: [t('is it worth the hype?', 'hook', [0, 2.6], 0.15, { animIn: 'pop' }), t('⭐⭐⭐⭐⭐', 'big', 'end', 0.5, { animIn: 'pop' })] },
  { id: 'cafe', name: 'Cafe hopping', cat: 'Food', color: '#8a6f5a', slots: slots(6, 1.3, 'kb-in', 'fade', 'warm'), layers: [t('cafe hopping', 'serif', [0, 2.6], 0.45), t('📍 save for later', 'red', 'end', 0.82)] },
  // ---------- Business ----------
  { id: 'productlaunch', name: 'Product launch', cat: 'Business', color: '#4f46e5', slots: slots(5, 1.4, 'kb-in', 'zoom', 'vivid'), layers: [t('NEW DROP', 'highlight', [0, 2], 0.15, { animIn: 'pop' }), t('available now', 'title', 3, 0.5, { animIn: 'zoom' }), t('link in bio 👆', 'red', 4, 0.82, { animIn: 'up' })] },
  { id: 'sale', name: 'Flash sale', cat: 'Business', color: '#ef4444', slots: slots(4, 1, 'shake', 'zoom', 'vivid'), layers: [t('FLASH SALE', 'hook', [0, 2], 0.2, { animIn: 'pop' }), t('50% OFF', 'big', [2, 2], 0.5, { animIn: 'zoom' })] },
  { id: 'realestate', name: 'Home tour', cat: 'Business', color: '#0f766e', slots: slots(6, 1.6, 'pan', 'fade'), layers: [t('JUST LISTED', 'highlight', [0, 2.2], 0.15, { animIn: 'pop' }), t('3 bed · 2 bath · garden', 'lower', [2.2, 3.5], 0.85), t('book a viewing', 'title', 'end', 0.5)] },
  { id: 'restaurant', name: 'Restaurant promo', cat: 'Business', color: '#b45309', slots: slots(5, 1.3, 'kb-in', 'slide', 'warm'), layers: [t('NOW OPEN', 'big', [0, 2], 0.5, { animIn: 'zoom' }), t('📍 123 Main Street', 'capdark', 'end', 0.82)] },
  { id: 'unboxing', name: 'Unboxing', cat: 'Business', color: '#7c3aed', slots: slots(5, 1.4, 'kb-in', 'zoom'), layers: [t('unboxing 📦', 'marker', [0, 2], 0.15, { animIn: 'pop' }), t('first look', 'caption', 1, 0.82), t('the details', 'caption', 3, 0.82), t('worth it? yes.', 'caption', 4, 0.82)] },
  // ---------- Fitness & gaming ----------
  { id: 'gym', name: 'Gym progress', cat: 'Fitness', color: '#991b1b', slots: slots(4, 1.4, 'shake', 'zoom', 'drama'), layers: [t('DAY 1', 'count', 0, 0.5, { animIn: 'pop' }), t('DAY 30', 'count', 1, 0.5, { animIn: 'pop' }), t('DAY 60', 'count', 2, 0.5, { animIn: 'pop' }), t('DAY 90', 'count', 3, 0.5, { animIn: 'pop' })] },
  { id: 'workout', name: 'Workout routine', cat: 'Fitness', color: '#dc2626', slots: slots(5, 1.6, 'kb-in', 'slide'), layers: [t('FULL BODY', 'hook', [0, 2], 0.15), t('squats × 15', 'caption', 1, 0.82), t('push-ups × 12', 'caption', 2, 0.82), t('lunges × 10', 'caption', 3, 0.82), t('plank 45s', 'caption', 4, 0.82)] },
  { id: 'gaming', name: 'Gaming highlights', cat: 'Gaming', color: '#a855f7', slots: slots(5, 1.2, 'glitch', 'glitch', 'drama'), layers: [t('CLUTCH', 'neon', [0, 2], 0.5, { animIn: 'zoom' }), t('GG 🏆', 'big', 'end', 0.5, { animIn: 'pop' })] },
  { id: 'top3', name: 'Top 3 countdown', cat: 'Gaming', color: '#f97316', slots: slots(3, 2.4, 'kb-in', 'zoom'), layers: [t('#3', 'count', 0, 0.3, { animIn: 'pop' }), t('#2', 'count', 1, 0.3, { animIn: 'pop' }), t('#1', 'count', 2, 0.3, { animIn: 'pop' })] },
  // ---------- Quotes & music ----------
  { id: 'quote', name: 'Motivation quote', cat: 'Quotes', color: '#334155', slots: slots(3, 2.4, 'kb-in', 'fade', 'drama'), layers: [t('small steps\nevery day', 'serif', 'all', 0.5, { animIn: 'type' })] },
  { id: 'lyrics', name: 'Lyrics', cat: 'Quotes', color: '#1e1b4b', slots: slots(4, 1.8, 'kb-out', 'blur', 'cool'), layers: [t('and I know', 'serif', 0, 0.6, { animIn: 'type' }), t('we will be okay', 'serif', 1, 0.6, { animIn: 'type' }), t('under the same', 'serif', 2, 0.6, { animIn: 'type' }), t('night sky', 'serif', 3, 0.6, { animIn: 'type' })] },
  { id: 'concert', name: 'Concert night', cat: 'Quotes', color: '#be185d', slots: slots(6, 0.9, 'zoompulse', 'flash', 'drama'), layers: [t('LIVE', 'neon', [0, 2], 0.5, { animIn: 'pop' }), t('best night ever', 'marker', 'end', 0.8)] },
  { id: 'rednote', name: 'RED note', cat: 'Trending', color: '#ff2442', slots: slots(5, 1.5, 'kb-in', 'slide', 'vivid'), layers: [t('3 places you must try', 'red', [0, 3], 0.18, { animIn: 'pop' }), t('save this ✨', 'marker', 'end', 0.85)] },
];

export const TEMPLATE_CATS = ['All', ...new Set(VIDEO_TEMPLATES.map((t) => t.cat))];

export function templateDuration(tpl) {
  return tpl.slots.reduce((a, s) => a + s[0], 0);
}

/** Build clips + overlays for a template. media: [{id, type, duration}] (may be empty: colored slots). */
export function buildFromTemplate(tpl, media) {
  const clips = tpl.slots.map(([dur, effect, transition, filter], i) => {
    const m = media.length ? media[i % media.length] : null;
    const base = { id: uid(), speed: 1, volume: 1, muted: false, fit: 'fill', filter, adjust: {}, effect, transition: { type: i === 0 ? 'none' : transition, dur: Math.min(0.4, dur / 2) } };
    if (!m) return { ...base, type: 'color', color: shade(tpl.color, i), dur, slot: i + 1 };
    if (m.type === 'image') return { ...base, type: 'image', mediaId: m.id, dur };
    // videos: use a slice of the clip; spread slices if the same video is reused
    const reuse = Math.floor(i / media.length);
    const start = Math.min(Math.max(0, (m.duration || dur) - dur), reuse * dur);
    return { ...base, type: 'video', mediaId: m.id, in: start, out: Math.min(m.duration || dur, start + dur) };
  });
  const starts = [];
  let acc = 0;
  for (const s of tpl.slots) {
    starts.push(acc);
    acc += s[0];
  }
  const total = acc;
  const overlays = tpl.layers.map((l) => {
    let start;
    let dur;
    if (l.at === 'all') [start, dur] = [0, total];
    else if (l.at === 'end') [start, dur] = [starts[starts.length - 1], tpl.slots[tpl.slots.length - 1][0]];
    else if (Array.isArray(l.at)) [start, dur] = l.at;
    else [start, dur] = [starts[l.at], tpl.slots[l.at][0]];
    const base = { id: uid(), start, dur: Math.max(0.3, Math.min(dur, total - start)), x: l.x ?? 0.5, y: l.y ?? 0.5, opacity: 1, animIn: l.animIn || 'fade', animOut: l.animOut || 'fade' };
    if (l.emoji) return { ...base, type: 'image', emoji: l.emoji, scale: l.scale || 0.2, animIn: l.animIn || 'pop' };
    const st = S[l.style] || S.title;
    return { ...base, type: 'text', text: l.text, align: 'center', italic: !!st.italic, bg: st.bg || '', stroke: st.stroke || '', glow: st.glow || '', shadow: !!st.shadow, font: st.font, weight: st.weight, size: st.size, color: st.color };
  });
  return { clips, overlays };
}

function shade(hex, i) {
  const n = parseInt(hex.slice(1), 16);
  const f = 0.55 + ((i * 37) % 45) / 100;
  const c = (v) => Math.round(Math.min(255, v * f + (1 - f) * 30));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
