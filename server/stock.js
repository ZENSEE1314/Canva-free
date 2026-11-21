// Free stock media search: openly licensed photos, audio and video — no API key needed.
// Photos + audio: Openverse (openverse.org). Video: Wikimedia Commons.
// Optional: set PEXELS_API_KEY or PIXABAY_API_KEY to use those providers for photos and videos.
//
// Every route answers with the same shape:
//   { items: [{ id, title, thumb, url, width, height, duration, author, license, source, link }], page, hasMore }
// and on failure: 502 { error: '<friendly message>' }.
import express from 'express';

// Wikimedia asks for a descriptive User-Agent with contact details: set STOCK_USER_AGENT to add yours.
export const STOCK_UA = process.env.STOCK_USER_AGENT || 'Artvas/1.0 (stock media search for a self-hosted design editor)';
const TIMEOUT = 15000;
const TTL = 10 * 60 * 1000;
const cache = new Map(); // key -> { at, data }

const lastGood = new Map(); // key -> data: served when a library is down after the cache expired
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const p = fn().then(
    (data) => {
      lastGood.delete(key);
      lastGood.set(key, data);
      if (lastGood.size > 300) lastGood.delete(lastGood.keys().next().value);
      return data;
    },
    (err) => {
      cache.delete(key);
      if (lastGood.has(key)) return lastGood.get(key);
      throw err;
    }
  );
  cache.set(key, { at: Date.now(), data: p });
  if (cache.size > 500) {
    // drop the oldest entries
    const old = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
    for (const [k] of old) cache.delete(k);
  }
  return p;
}

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': STOCK_UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const strip = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
const num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const cleanQ = (q) => String(q || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
const pageOf = (p) => Math.max(1, Math.min(50, parseInt(p, 10) || 1));

function ovLicense(it) {
  const l = String(it.license || '').toLowerCase();
  if (!l) return '';
  if (l === 'cc0') return 'CC0';
  if (l === 'pdm') return 'Public Domain';
  return `CC ${l.toUpperCase()}${it.license_version ? ' ' + it.license_version : ''}`;
}
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');

// ---------- Openverse ----------
async function openverse(kind, q, page) {
  const u = new URL(`https://api.openverse.org/v1/${kind}/`);
  if (q) u.searchParams.set('q', q);
  u.searchParams.set('page', page);
  u.searchParams.set('page_size', '20'); // the most anonymous requests may ask for
  u.searchParams.set('license_type', 'commercial');
  u.searchParams.set('mature', 'false');
  const data = await getJSON(u);
  const items = (data.results || [])
    .filter((it) => it.url && /^https:/.test(it.url))
    .filter((it) => kind !== 'audio' || /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac)(\?|$)/i.test(it.url) || /^(mp3|ogg|wav|m4a|aac|flac|opus)$/i.test(it.filetype || ''))
    .map((it) => ({
      id: String(it.id),
      title: strip(it.title) || 'Untitled',
      thumb: it.thumbnail || '',
      url: it.url,
      width: num(it.width),
      height: num(it.height),
      duration: kind === 'audio' ? Math.round((num(it.duration) / 1000) * 10) / 10 : 0,
      author: strip(it.creator) || 'Unknown',
      license: ovLicense(it),
      source: cap(it.source || it.provider || 'openverse'),
      link: it.foreign_landing_url || '',
    }));
  return { items, page, hasMore: page < Math.min(data.page_count || 0, 12) };
}

// ---------- Wikimedia Commons (video) ----------
const wmThumb = (u) => (u ? String(u).replace('https://thumb.wikimedia.org/wikipedia/', 'https://upload.wikimedia.org/wikipedia/').replace(/\?utm_[^#]*$/, '') : '');
const noUtm = (u) => String(u || '').replace(/\?utm_[^#]*$/, '');

/** The best ≤720p transcode a browser can play: MP4 first, then VP9/VP8 WebM. */
function pickDerivative(info) {
  const ders = (info.derivatives || []).filter((d) => d.src && /^https:/.test(d.src));
  const score = (d) => {
    const t = String(d.type || '');
    const h = d.height || 0;
    if (h > 720) return -1;
    const fmt = t.startsWith('video/mp4') ? 3 : t.includes('vp9') ? 2 : t.startsWith('video/webm') ? 1 : 0;
    if (!fmt) return -1;
    return fmt * 10000 + h;
  };
  const best = ders.map((d) => [score(d), d]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0])[0]?.[1];
  if (best) return { url: best.src, width: best.width || info.width, height: best.height || info.height };
  // small originals in a playable format are fine too
  if (/^video\/(webm|mp4)/.test(info.mime || '') && (info.height || 0) <= 1080) return { url: noUtm(info.url), width: info.width, height: info.height };
  return null;
}

async function commonsVideos(q, page) {
  const per = 20;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:video ${q || 'nature'}`,
    gsrlimit: String(per),
    gsroffset: String((page - 1) * per),
    prop: 'videoinfo',
    viprop: 'url|size|mime|extmetadata|derivatives|mediatype',
    viurlwidth: '320',
    viextmetadatafilter: 'Artist|LicenseShortName|ObjectName|ImageDescription',
    origin: '*',
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const data = await getJSON(u);
  const pages = (data.query?.pages || []).sort((a, b) => (a.index || 0) - (b.index || 0));
  const items = [];
  for (const pg of pages) {
    const info = pg.videoinfo?.[0] || pg.imageinfo?.[0];
    if (!info || (info.mediatype && info.mediatype !== 'VIDEO')) continue;
    const pick = pickDerivative(info);
    if (!pick) continue;
    const md = info.extmetadata || {};
    items.push({
      id: String(pg.pageid),
      title: strip(md.ObjectName?.value) || pg.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      thumb: wmThumb(info.thumburl),
      url: pick.url,
      width: num(pick.width),
      height: num(pick.height),
      duration: Math.round(num(info.duration) * 10) / 10,
      author: strip(md.Artist?.value).slice(0, 120) || 'Wikimedia Commons contributor',
      license: strip(md.LicenseShortName?.value) || 'See source page',
      source: 'Wikimedia Commons',
      link: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title)}`,
    });
  }
  return { items, page, hasMore: !!data.continue };
}

/** Photos from Wikimedia Commons — used when Openverse is busy. */
async function commonsImages(q, page) {
  const per = 20;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:bitmap ${q || 'nature'}`,
    gsrlimit: String(per),
    gsroffset: String((page - 1) * per),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName',
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const data = await getJSON(u);
  const pages = (data.query?.pages || []).sort((a, b) => (a.index || 0) - (b.index || 0));
  const items = [];
  for (const pg of pages) {
    const info = pg.imageinfo?.[0];
    if (!info || !/^image\/(jpeg|png|webp)/.test(info.mime || '')) continue;
    const big = wmThumb(info.thumburl) || noUtm(info.url);
    const md = info.extmetadata || {};
    items.push({
      id: `wm${pg.pageid}`,
      title: strip(md.ObjectName?.value) || pg.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      thumb: big.replace(/\/1280px-/, '/330px-'),
      url: big,
      width: num(info.thumbwidth || info.width),
      height: num(info.thumbheight || info.height),
      duration: 0,
      author: strip(md.Artist?.value).slice(0, 120) || 'Wikimedia Commons contributor',
      license: strip(md.LicenseShortName?.value) || 'See source page',
      source: 'Wikimedia Commons',
      link: info.descriptionurl || '',
    });
  }
  return { items, page, hasMore: !!data.continue };
}

/** Openverse first; if it is slow or down, Wikimedia Commons. */
async function freeImages(q, page) {
  try {
    const r = await openverse('images', q, page);
    if (r.items.length || page > 1) return r;
  } catch (e) {
    console.warn('openverse images failed, trying Wikimedia Commons:', e?.message || e);
  }
  return commonsImages(q, page);
}

// ---------- Optional keyed providers ----------
async function pexels(kind, q, page) {
  const key = process.env.PEXELS_API_KEY;
  const base = kind === 'videos' ? 'https://api.pexels.com/videos/' : 'https://api.pexels.com/v1/';
  const path = q ? `search?query=${encodeURIComponent(q)}&` : kind === 'videos' ? 'popular?' : 'curated?';
  const data = await getJSON(`${base}${path}page=${page}&per_page=30`, { Authorization: key });
  const list = kind === 'videos' ? data.videos || [] : data.photos || [];
  const items = list.map((it) => {
    if (kind === 'videos') {
      const files = (it.video_files || []).filter((f) => f.link && /mp4/.test(f.file_type || '') && (f.height || 0) <= 720).sort((a, b) => (b.height || 0) - (a.height || 0));
      const f = files[0] || (it.video_files || [])[0] || {};
      return { id: String(it.id), title: (it.url || '').split('/').filter(Boolean).pop()?.replace(/-\d+$/, '').replace(/-/g, ' ') || 'Pexels video', thumb: it.image || '', url: f.link || '', width: num(f.width || it.width), height: num(f.height || it.height), duration: num(it.duration), author: it.user?.name || 'Pexels', license: 'Pexels License', source: 'Pexels', link: it.url || '' };
    }
    return { id: String(it.id), title: it.alt || 'Pexels photo', thumb: it.src?.medium || '', url: it.src?.large2x || it.src?.original || '', width: num(it.width), height: num(it.height), duration: 0, author: it.photographer || 'Pexels', license: 'Pexels License', source: 'Pexels', link: it.url || '' };
  }).filter((it) => it.url);
  return { items, page, hasMore: !!data.next_page };
}

async function pixabay(kind, q, page) {
  const key = process.env.PIXABAY_API_KEY;
  const base = kind === 'videos' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/';
  const data = await getJSON(`${base}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q || '')}&page=${page}&per_page=30&safesearch=true${kind === 'videos' ? '' : '&image_type=photo'}`);
  const items = (data.hits || []).map((it) => {
    if (kind === 'videos') {
      const v = it.videos?.medium?.url ? it.videos.medium : it.videos?.small || it.videos?.tiny || {};
      return { id: String(it.id), title: it.tags || 'Pixabay video', thumb: v.thumbnail || it.videos?.tiny?.thumbnail || '', url: v.url || '', width: num(v.width), height: num(v.height), duration: num(it.duration), author: it.user || 'Pixabay', license: 'Pixabay License', source: 'Pixabay', link: it.pageURL || '' };
    }
    return { id: String(it.id), title: it.tags || 'Pixabay photo', thumb: it.webformatURL || '', url: it.largeImageURL || it.webformatURL || '', width: num(it.imageWidth), height: num(it.imageHeight), duration: 0, author: it.user || 'Pixabay', license: 'Pixabay License', source: 'Pixabay', link: it.pageURL || '' };
  }).filter((it) => it.url);
  return { items, page, hasMore: page * 30 < Math.min(data.totalHits || 0, 500) };
}

/** Try the keyed provider first (if configured), then the free one. */
async function withKeyed(kind, q, page, free) {
  const keyed = process.env.PEXELS_API_KEY ? pexels : process.env.PIXABAY_API_KEY ? pixabay : null;
  if (keyed) {
    try {
      const r = await keyed(kind, q, page);
      if (r.items.length) return r;
    } catch (e) {
      console.warn('keyed stock provider failed', e?.message || e);
    }
  }
  return free();
}

// Drop results whose title, author or search text suggest adult content. Openverse already
// filters by its 'mature' flag; Wikimedia Commons and others have no such flag.
const UNSAFE = /\b(nude|nudes|nudity|naked|erotic|erotica|porn|porno|pornographic|sex|sexy|sexual|xxx|nsfw|topless|lingerie|fetish|bdsm|genital|genitals|penis|vagina|breasts?|nipples?|masturbat\w*|orgasm|hentai|stripper|striptease|playboy)\b/i;
const isSafe = (it) => !UNSAFE.test(`${it.title || ''} ${it.author || ''} ${it.link || ''}`);
function safeOnly(data) {
  return { ...data, items: (data.items || []).filter(isSafe) };
}
export const _isSafeForTests = isSafe;

export function stockRouter() {
  const r = express.Router();
  const handle = (kind, run, fail) => async (req, res) => {
    const q = cleanQ(req.query.q);
    if (UNSAFE.test(q)) return res.json({ items: [], page: 1, hasMore: false });
    const page = pageOf(req.query.page);
    try {
      const data = await cached(`${kind}|${q.toLowerCase()}|${page}`, () => run(q, page));
      res.set('Cache-Control', 'public, max-age=600').json(safeOnly(data));
    } catch (e) {
      console.warn(`stock ${kind} failed:`, e?.message || e);
      res.status(502).json({ error: fail });
    }
  };
  r.get('/images', handle('images', (q, page) => withKeyed('images', q, page, () => freeImages(q, page)), 'The free photo library is busy or unreachable right now. Try again in a minute.'));
  r.get('/audio', handle('audio', (q, page) => openverse('audio', q, page), 'The free audio library is busy or unreachable right now. Try again in a minute.'));
  r.get('/videos', handle('videos', (q, page) => withKeyed('videos', q, page, () => commonsVideos(q, page)), 'The free video library is busy or unreachable right now. Try again in a minute.'));
  return r;
}
