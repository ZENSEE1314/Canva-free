// Load web fonts on demand — only the families a design, template or text layer actually uses.
// Every wait is capped so a slow connection can never freeze the app.
const cache = new Map();
const WEIGHTS = ['400', '700', '800', '900'];

function load(spec) {
  if (!cache.has(spec)) cache.set(spec, document.fonts.load(spec).catch(() => []));
  return cache.get(spec);
}

export function loadFamily(family) {
  if (!family) return Promise.resolve();
  return Promise.all([...WEIGHTS.map((w) => load(`${w} 40px "${family}"`)), load(`italic 400 40px "${family}"`), load(`italic 700 40px "${family}"`)]);
}

const capped = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

/** Font families mentioned anywhere in a design/template/project object. */
export function familiesIn(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj || '');
  const set = new Set();
  for (const m of s.matchAll(/"(?:fontFamily|font)":"([^"]+)"/g)) set.add(m[1]);
  return [...set];
}

/** Load the fonts used in obj; resolves when loaded or after `ms`, whichever is first. */
export function fontsIn(obj, ms = 3500) {
  const fams = familiesIn(obj);
  if (!fams.length) return Promise.resolve();
  return capped(Promise.all(fams.map(loadFamily)), ms);
}

/** Resolves when the fonts are really loaded (no cap) — for re-measuring text afterwards. */
export function fontsInFully(obj) {
  return Promise.all(familiesIn(obj).map(loadFamily));
}

/** The two interface fonts, loaded at start-up (capped). */
export const coreFonts = capped(Promise.all(['Inter', 'DM Sans'].map(loadFamily)), 2500);
