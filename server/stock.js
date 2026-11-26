// Free stock media search: openly licensed photos, audio and video — no API key needed.
// Photos: Openverse, Wikimedia Commons, NASA, The Met, Art Institute of Chicago.
// Music: Openverse (incl. Freesound, Jamendo, Wikimedia audio), Internet Archive (netlabels), Wikimedia Commons.
// Video: Wikimedia Commons.
// Several libraries are searched at once and their results are mixed (?source=<id> picks one).
// Optional keys (environment variables) add more libraries:
//   JAMENDO_CLIENT_ID (music), UNSPLASH_ACCESS_KEY (photos), PEXELS_API_KEY / PIXABAY_API_KEY (photos and videos).
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

async function getJSON(url, headers = {}, tries = 2) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': STOCK_UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT) });
    if (r.ok) return r.json();
    // libraries like Openverse sometimes answer 500/502/504 for a moment: try once more
    if (i >= tries || r.status < 500) throw new Error(`HTTP ${r.status}`);
    await new Promise((res) => setTimeout(res, 700));
  }
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

// ---------- licences ----------
/** 'http://creativecommons.org/licenses/by-nc-sa/3.0/' → 'CC BY-NC-SA 3.0' */
function ccFromUrl(u) {
  const s = String(u || '').toLowerCase();
  if (!s) return '';
  if (/publicdomain\/zero/.test(s)) return 'CC0';
  if (/publicdomain/.test(s)) return 'Public Domain';
  const m = s.match(/licenses\/([a-z-]+)\/(\d(?:\.\d)?)/);
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : 'Creative Commons';
}
const secs = (v) => {
  if (v == null || v === '') return 0;
  if (/^\d+(\.\d+)?$/.test(String(v))) return Math.round(+v * 10) / 10;
  const parts = String(v).split(':').map(Number);
  if (parts.some((x) => !Number.isFinite(x))) return 0;
  return parts.reduce((a, x) => a * 60 + x, 0);
};
/** Run fn over items with at most n at a time. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k], k);
        } catch {
          out[k] = null;
        }
      }
    })
  );
  return out;
}

// ---------- Internet Archive: Creative Commons music from netlabels ----------
async function archiveAudio(q, page) {
  const rows = 12;
  const u = new URL('https://archive.org/advancedsearch.php');
  u.searchParams.set('q', `(${q || 'music'}) AND collection:netlabels AND mediatype:audio AND licenseurl:*creativecommons*`);
  for (const f of ['identifier', 'title', 'creator', 'licenseurl']) u.searchParams.append('fl[]', f);
  u.searchParams.set('rows', String(rows));
  u.searchParams.set('page', String(page));
  u.searchParams.append('sort[]', 'downloads desc');
  u.searchParams.set('output', 'json');
  const data = await getJSON(u);
  const docs = data.response?.docs || [];
  const found = await pool(docs, 6, async (d) => {
    const meta = await getJSON(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`);
    const files = (meta.files || []).filter((f) => /\.(mp3|ogg)$/i.test(f.name || '') && f.source === 'original' ? true : /\.(mp3)$/i.test(f.name || ''));
    // prefer MP3 (plays everywhere), the first track of the album
    const f = files.sort((a, b) => /\.mp3$/i.test(b.name) - /\.mp3$/i.test(a.name) || String(a.track || a.name).localeCompare(String(b.track || b.name), undefined, { numeric: true }))[0];
    if (!f) return null;
    const path = String(f.name).split('/').map(encodeURIComponent).join('/');
    const creator = Array.isArray(d.creator) ? d.creator[0] : d.creator;
    return {
      id: `ia:${d.identifier}`,
      title: strip(f.title || d.title || f.name.replace(/\.\w+$/, '')),
      thumb: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      url: `https://archive.org/download/${encodeURIComponent(d.identifier)}/${path}`,
      width: 0,
      height: 0,
      duration: secs(f.length),
      author: strip(f.artist || f.creator || creator) || 'Internet Archive',
      license: ccFromUrl(Array.isArray(d.licenseurl) ? d.licenseurl[0] : d.licenseurl) || 'Creative Commons',
      source: 'Internet Archive',
      link: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
    };
  });
  return { items: found.filter(Boolean), page, hasMore: page * rows < Math.min(data.response?.numFound || 0, 600) };
}

// ---------- Wikimedia Commons audio ----------
async function commonsAudio(q, page) {
  const per = 15;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:audio ${q || 'music'}`,
    gsrlimit: String(per),
    gsroffset: String((page - 1) * per),
    prop: 'videoinfo',
    viprop: 'url|size|mime|extmetadata|derivatives|mediatype',
    viextmetadatafilter: 'Artist|LicenseShortName|ObjectName',
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const data = await getJSON(u);
  const pages = (data.query?.pages || []).sort((a, b) => (a.index || 0) - (b.index || 0));
  const items = [];
  for (const pg of pages) {
    const info = pg.videoinfo?.[0] || pg.imageinfo?.[0];
    if (!info || (info.mediatype && info.mediatype !== 'AUDIO')) continue;
    const ders = info.derivatives || [];
    const mp3 = ders.find((d) => /audio\/mpeg/.test(d.type || '') && /^https:/.test(d.src || ''));
    const url = mp3?.src || (/^audio\/(mpeg|ogg|wav|x-wav|flac)/.test(info.mime || '') ? noUtm(info.url) : '');
    if (!url) continue;
    const md = info.extmetadata || {};
    items.push({
      id: `wma:${pg.pageid}`,
      title: strip(md.ObjectName?.value) || pg.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      thumb: '',
      url,
      width: 0,
      height: 0,
      duration: Math.round(num(info.duration) * 10) / 10,
      author: strip(md.Artist?.value).slice(0, 120) || 'Wikimedia Commons contributor',
      license: strip(md.LicenseShortName?.value) || 'See source page',
      source: 'Wikimedia Commons',
      link: info.descriptionurl || '',
    });
  }
  return { items, page, hasMore: !!data.continue };
}

// ---------- Jamendo (optional key: JAMENDO_CLIENT_ID, free at devportal.jamendo.com) ----------
async function jamendo(q, page) {
  const per = 20;
  const u = new URL('https://api.jamendo.com/v3.0/tracks/');
  u.searchParams.set('client_id', process.env.JAMENDO_CLIENT_ID);
  u.searchParams.set('format', 'json');
  u.searchParams.set('limit', String(per));
  u.searchParams.set('offset', String((page - 1) * per));
  if (q) u.searchParams.set('search', q);
  u.searchParams.set('audioformat', 'mp32');
  u.searchParams.set('order', 'popularity_total');
  const data = await getJSON(u);
  const items = (data.results || [])
    .filter((it) => it.audio)
    .map((it) => ({
      id: `jam:${it.id}`,
      title: strip(it.name) || 'Untitled',
      thumb: it.image || it.album_image || '',
      url: it.audio,
      width: 0,
      height: 0,
      duration: num(it.duration),
      author: strip(it.artist_name) || 'Jamendo artist',
      license: ccFromUrl(it.license_ccurl) || 'Creative Commons',
      source: 'Jamendo',
      link: it.shareurl || '',
    }));
  return { items, page, hasMore: items.length === per };
}

// ---------- NASA image library (public domain) ----------
async function nasaImages(q, page) {
  const u = new URL('https://images-api.nasa.gov/search');
  u.searchParams.set('q', q || 'earth');
  u.searchParams.set('media_type', 'image');
  u.searchParams.set('page', String(page));
  u.searchParams.set('page_size', '20');
  const data = await getJSON(u);
  const items = (data.collection?.items || [])
    .map((it) => {
      const d = it.data?.[0] || {};
      const href = it.links?.find((l) => l.render === 'image')?.href || it.links?.[0]?.href || '';
      if (!/^https:/.test(href)) return null;
      return {
        id: `nasa:${d.nasa_id}`,
        title: strip(d.title) || 'NASA image',
        thumb: href.replace(/~(medium|small|large|orig)\.(jpe?g|png)$/i, '~thumb.$2'),
        url: href.replace(/~(thumb|small)\.(jpe?g|png)$/i, '~medium.$2'),
        width: 0,
        height: 0,
        duration: 0,
        author: strip(d.photographer || d.secondary_creator || d.center) || 'NASA',
        license: 'Public Domain (NASA)',
        source: 'NASA',
        link: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id || '')}`,
      };
    })
    .filter(Boolean);
  return { items, page, hasMore: !!data.collection?.links?.some((l) => l.rel === 'next') };
}

// ---------- The Metropolitan Museum of Art (public-domain artworks) ----------
async function metImages(q, page) {
  const per = 15;
  const u = new URL('https://collectionapi.metmuseum.org/public/collection/v1.1/search');
  u.searchParams.set('q', q || 'flowers');
  u.searchParams.set('hasImages', 'true');
  u.searchParams.set('isPublicDomain', 'true');
  u.searchParams.set('limit', String(per));
  u.searchParams.set('offset', String((page - 1) * per));
  const data = await getJSON(u);
  const ids = data.objectIDs || [];
  const objs = await pool(ids, 8, (id) => getJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`));
  const items = objs
    .filter((o) => o && o.isPublicDomain && o.primaryImageSmall && /^https:/.test(o.primaryImageSmall))
    .map((o) => ({
      id: `met:${o.objectID}`,
      title: strip(o.title) || 'Artwork',
      thumb: o.primaryImageSmall,
      url: o.primaryImage || o.primaryImageSmall,
      width: 0,
      height: 0,
      duration: 0,
      author: strip(o.artistDisplayName) || strip(o.culture) || 'The Met',
      license: 'Public Domain (CC0)',
      source: 'The Met',
      link: o.objectURL || '',
    }));
  return { items, page, hasMore: page * per < Math.min(data.total || 0, 600) };
}

// ---------- Art Institute of Chicago (public-domain artworks) ----------
async function aicImages(q, page) {
  const per = 20;
  const u = new URL('https://api.artic.edu/api/v1/artworks/search');
  if (q) u.searchParams.set('q', q);
  u.searchParams.set('query[term][is_public_domain]', 'true');
  u.searchParams.set('fields', 'id,title,artist_title,image_id,thumbnail');
  u.searchParams.set('limit', String(per));
  u.searchParams.set('page', String(page));
  const data = await getJSON(u, { 'AIC-User-Agent': STOCK_UA });
  const iiif = data.config?.iiif_url || 'https://www.artic.edu/iiif/2';
  const items = (data.data || [])
    .filter((it) => it.image_id)
    .map((it) => ({
      id: `aic:${it.id}`,
      title: strip(it.title) || 'Artwork',
      thumb: `${iiif}/${it.image_id}/full/400,/0/default.jpg`,
      url: `${iiif}/${it.image_id}/full/1686,/0/default.jpg`,
      width: num(it.thumbnail?.width),
      height: num(it.thumbnail?.height),
      duration: 0,
      author: strip(it.artist_title) || 'Art Institute of Chicago',
      license: 'Public Domain (CC0)',
      source: 'Art Institute of Chicago',
      link: `https://www.artic.edu/artworks/${it.id}`,
    }));
  return { items, page, hasMore: page < Math.min(data.pagination?.total_pages || 0, 30) };
}

// ---------- Unsplash (optional key: UNSPLASH_ACCESS_KEY) ----------
async function unsplash(q, page) {
  const u = new URL(q ? 'https://api.unsplash.com/search/photos' : 'https://api.unsplash.com/photos');
  if (q) u.searchParams.set('query', q);
  u.searchParams.set('page', String(page));
  u.searchParams.set('per_page', '24');
  u.searchParams.set('content_filter', 'high');
  const data = await getJSON(u, { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' });
  const list = Array.isArray(data) ? data : data.results || [];
  const items = list.map((it) => ({
    id: `uns:${it.id}`,
    title: strip(it.alt_description || it.description) || 'Unsplash photo',
    thumb: it.urls?.small || '',
    url: it.urls?.regular || it.urls?.full || '',
    width: num(it.width),
    height: num(it.height),
    duration: 0,
    author: strip(it.user?.name) || 'Unsplash',
    license: 'Unsplash License',
    source: 'Unsplash',
    link: it.links?.html ? `${it.links.html}?utm_source=artvas&utm_medium=referral` : '',
  })).filter((it) => it.url);
  return { items, page, hasMore: Array.isArray(data) ? items.length === 24 : page < (data.total_pages || 0) };
}

// ---------- searching several libraries at once ----------
/** Which libraries can be searched for each kind (keyed ones only when their key is set). */
function sourcesFor(kind) {
  const env = process.env;
  if (kind === 'images')
    return [
      env.UNSPLASH_ACCESS_KEY && { id: 'unsplash', name: 'Unsplash', run: unsplash },
      env.PEXELS_API_KEY && { id: 'pexels', name: 'Pexels', run: (q, p) => pexels('images', q, p) },
      env.PIXABAY_API_KEY && { id: 'pixabay', name: 'Pixabay', run: (q, p) => pixabay('images', q, p) },
      { id: 'openverse', name: 'Openverse', run: (q, p) => openverse('images', q, p) },
      { id: 'wikimedia', name: 'Wikimedia', run: commonsImages },
      { id: 'nasa', name: 'NASA', run: nasaImages },
      { id: 'met', name: 'The Met', run: metImages },
      { id: 'aic', name: 'Art Institute', run: aicImages },
    ].filter(Boolean);
  if (kind === 'audio')
    return [
      env.JAMENDO_CLIENT_ID && { id: 'jamendo', name: 'Jamendo', run: jamendo },
      { id: 'openverse', name: 'Openverse', run: (q, p) => openverse('audio', q, p) },
      { id: 'archive', name: 'Internet Archive', run: archiveAudio },
      { id: 'wikimedia', name: 'Wikimedia', run: commonsAudio },
    ].filter(Boolean);
  return [
    env.PEXELS_API_KEY && { id: 'pexels', name: 'Pexels', run: (q, p) => pexels('videos', q, p) },
    env.PIXABAY_API_KEY && { id: 'pixabay', name: 'Pixabay', run: (q, p) => pixabay('videos', q, p) },
    { id: 'wikimedia', name: 'Wikimedia', run: commonsVideos },
  ].filter(Boolean);
}
const SOURCE_TIMEOUT = 14000;
/**
 * Search every library (or just `source`) at the same time and mix the results, a few from each
 * in turn. A slow or failing library is skipped instead of failing the whole search.
 */
async function searchAll(kind, q, page, source) {
  const all = sourcesFor(kind);
  const list = source && source !== 'all' ? all.filter((x) => x.id === source) : all;
  if (!list.length) throw new Error('unknown library');
  const results = await Promise.all(
    list.map(async (src) => {
      try {
        const r = await Promise.race([
          cached(`${kind}|${src.id}|${q.toLowerCase()}|${page}`, () => src.run(q, page)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), SOURCE_TIMEOUT)),
        ]);
        return { src, r };
      } catch (e) {
        console.warn(`stock ${kind}/${src.id} failed:`, e?.message || e);
        return { src, err: true };
      }
    })
  );
  const ok = results.filter((x) => !x.err);
  if (!ok.length) throw new Error('all libraries failed');
  const lists = ok.map((x) => x.r.items.filter(isSafe));
  const items = [];
  const seen = new Set();
  for (let i = 0; lists.some((l) => i < l.length); i++)
    for (const l of lists)
      if (i < l.length) {
        const it = l[i];
        const key = `${it.source}|${it.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(it);
        }
      }
  return {
    items,
    page,
    hasMore: ok.some((x) => x.r.hasMore),
    sources: results.map((x) => ({ id: x.src.id, name: x.src.name, count: x.err ? 0 : x.r.items.length, ok: !x.err })),
  };
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
    const source = String(req.query.source || 'all').replace(/[^a-z]/g, '').slice(0, 20) || 'all';
    try {
      const data = await run(q, page, source);
      res.set('Cache-Control', 'public, max-age=600').json(safeOnly(data));
    } catch (e) {
      console.warn(`stock ${kind} failed:`, e?.message || e);
      res.status(502).json({ error: fail });
    }
  };
  r.get('/sources', (_req, res) => {
    const pick = (k) => sourcesFor(k).map(({ id, name }) => ({ id, name }));
    res.json({ images: pick('images'), audio: pick('audio'), videos: pick('videos') });
  });
  r.get('/images', handle('images', (q, page, src) => searchAll('images', q, page, src), 'The free photo libraries are busy or unreachable right now. Try again in a minute.'));
  r.get('/audio', handle('audio', (q, page, src) => searchAll('audio', q, page, src), 'The free music libraries are busy or unreachable right now. Try again in a minute.'));
  r.get('/videos', handle('videos', (q, page, src) => searchAll('videos', q, page, src), 'The free video library is busy or unreachable right now. Try again in a minute.'));
  return r;
}
