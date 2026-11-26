// Stock videos (Media tab) and stock music (Audio tab) for the video editor. Searches the Artvas
// server's /api/stock/* routes; files are downloaded through /api/image-proxy and imported like
// any other media, keeping the credit line (title, author, licence, source) on the media.

export const VIDEO_CATS = ['Nature', 'City', 'People', 'Food', 'Travel', 'Sports', 'Abstract', 'Business'];
export const MUSIC_MOODS = ['Happy', 'Chill', 'Epic', 'Romantic', 'Sad', 'Upbeat', 'Lo-fi', 'Cinematic', 'Piano', 'Guitar', 'Electronic', 'Hip hop', 'Jazz', 'Rock', 'Acoustic', 'Ambient', 'Dance', 'Funny'];

const state = {
  videos: { q: '', cat: '', src: 'all', items: [], page: 1, hasMore: false, busy: false, msg: '', loaded: false, adding: null },
  audio: { q: '', cat: 'Chill', src: 'all', items: [], page: 1, hasMore: false, busy: false, msg: '', loaded: false, adding: null },
};
/** Libraries the server can search (fetched once): { audio: [{id, name}], videos: [...] }. */
let sources = null;
let sourcesP = null;
function loadSources() {
  if (!sourcesP)
    sourcesP = fetch('/api/stock/sources')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (d && d.audio) sources = d;
        else sourcesP = null;
        return sources;
      });
  return sourcesP;
}
let preview = null;

const fmtDur = (s) => {
  s = Math.max(0, Math.round(+s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** Shown in the claude.ai preview, which has no Artvas server to search or download through. */
const previewNote = (what) => `${what} can't load in this claude.ai preview — it has no Artvas server to search and download through. Open your own Artvas site (your Railway link) and it works there.`;
export const creditLine = (c) => (c ? `${c.title || 'Untitled'} — ${c.author || 'Unknown'} (${[c.license, c.source].filter(Boolean).join(', ')})` : '');

/** URL to fetch a stock file: https links go through the Artvas proxy, local ones are used as they are. */
export const viaProxy = (url) => (/^https:\/\//i.test(url) ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url);

const EXT_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' };
async function download(item, kind, onProgress) {
  const r = await fetch(viaProxy(item.url));
  if (!r.ok) throw new Error(`download ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  let blob;
  if (r.body && total && onProgress) {
    const reader = r.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      onProgress(got / total);
    }
    blob = new Blob(parts, { type: r.headers.get('content-type') || '' });
  } else blob = await r.blob();
  const ext = (item.url.split('?')[0].match(/\.(\w{2,4})$/) || [])[1]?.toLowerCase();
  let type = blob.type && !/octet-stream/.test(blob.type) ? blob.type.split(';')[0] : EXT_TYPES[ext] || (kind === 'video' ? 'video/mp4' : 'audio/mpeg');
  if (kind === 'video' && !type.startsWith('video')) type = EXT_TYPES[ext]?.startsWith('video') ? EXT_TYPES[ext] : 'video/mp4';
  if (kind === 'audio' && !type.startsWith('audio')) type = EXT_TYPES[ext]?.startsWith('audio') ? EXT_TYPES[ext] : 'audio/mpeg';
  const name = `${(item.title || (kind === 'video' ? 'Stock video' : 'Stock music')).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60)}.${Object.keys(EXT_TYPES).find((k) => EXT_TYPES[k] === type) || ext || 'mp4'}`;
  return new File([blob], name, { type });
}

async function search(kind, more) {
  const s = state[kind];
  if (s.busy) return;
  s.busy = true;
  s.msg = 'Searching…';
  const page = more ? s.page + 1 : 1;
  const q = s.q.trim() || s.cat;
  try {
    const r = await fetch(`/api/stock/${kind === 'videos' ? 'videos' : 'audio'}?q=${encodeURIComponent(q)}&page=${page}&source=${encodeURIComponent(s.src || 'all')}`);
    let j = null;
    try {
      j = await r.json();
    } catch {}
    if (!r.ok || !j || j.error) throw new Error(j?.error || `The stock library is not available right now (${r.status}).`);
    const items = Array.isArray(j.items) ? j.items.filter((it) => it && it.url) : [];
    s.items = more ? [...s.items, ...items] : items;
    s.page = j.page || page;
    s.hasMore = !!j.hasMore;
    s.msg = s.items.length ? '' : `Nothing found for “${q}”. Try another word.`;
  } catch (e) {
    s.msg = /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not reach the stock library. Check your connection and try again.' : e.message;
    if (!more) s.items = [];
  }
  s.loaded = true;
  s.busy = false;
}

const searchBox = (H, kind, cats) => {
  const s = state[kind];
  const libs = sources?.[kind === 'videos' ? 'videos' : 'audio'] || [];
  return `<form class="stock-search" data-stock-form="${kind}"><input class="search" type="search" name="q" value="${H.esc(s.q)}" placeholder="${kind === 'videos' ? 'Search free stock videos' : 'Search songs, moods, genres, instruments…'}" enterkeyhint="search"><button class="btn ghost small" type="submit">Search</button></form>
    <div class="chips stock-chips">${cats.map((c) => `<button type="button" class="chip ${!s.q && s.cat === c ? 'on' : ''}" data-stock-cat="${H.esc(c)}">${H.esc(c)}</button>`).join('')}</div>
    ${libs.length > 1 ? `<div class="chips stock-chips stock-src" aria-label="Library">${[{ id: 'all', name: 'All libraries' }, ...libs].map((x) => `<button type="button" class="chip ${(s.src || 'all') === x.id ? 'on' : ''}" data-stock-src="${H.esc(x.id)}">${H.esc(x.name)}</button>`).join('')}</div>` : ''}`;
};

/**
 * Stock videos section. ctx: { H, inPreview, addVideo(file, credit) → Promise }.
 */
export function renderStockVideos(host, ctx) {
  const { H } = ctx;
  if (ctx.inPreview) {
    host.innerHTML = `<p class="muted stock-note">${H.esc(previewNote('Stock videos'))}</p>`;
    return;
  }
  const s = state.videos;
  const draw = () => {
    if (!host.isConnected) return;
    host.innerHTML = `${searchBox(H, 'videos', VIDEO_CATS)}
      <div class="stock-grid">${s.items.map((it, i) => `<button type="button" class="stock-v ${s.adding === i ? 'busy' : ''}" data-sv="${i}" title="Add “${H.esc(it.title || 'video')}” to the end">
        ${it.thumb ? `<img loading="lazy" src="${H.esc(it.thumb)}" alt="">` : ''}<span class="stock-dur">${fmtDur(it.duration)}</span>${s.adding === i ? `<span class="stock-prog">${H.esc(s.addMsg || 'Adding…')}</span>` : ''}</button>`).join('')}</div>
      ${s.items.length ? `<p class="muted stock-credit">Tap a video to add it. Credits are kept on each clip.</p>` : !s.loaded && !s.busy ? `<p class="muted">Pick a topic or search to see free videos.</p>` : ''}
      <p class="muted stock-msg" aria-live="polite">${H.esc(s.busy ? 'Searching…' : s.msg)}</p>
      ${s.hasMore && !s.busy ? `<button type="button" class="btn ghost small block" data-stock-more>Load more</button>` : ''}`;
    bindSearch(host, 'videos', draw);
    host.querySelectorAll('[data-sv]').forEach((b) => (b.onclick = async () => {
      if (s.adding != null) return H.toast('Still adding the last video…');
      const i = +b.dataset.sv;
      const it = s.items[i];
      s.adding = i;
      s.addMsg = 'Downloading…';
      draw();
      try {
        const file = await download(it, 'video', (f) => {
          s.addMsg = `Downloading ${Math.round(f * 100)}%`;
          const pr = host.querySelector(`[data-sv="${i}"] .stock-prog`);
          if (pr) pr.textContent = s.addMsg;
        });
        await ctx.addVideo(file, credit(it));
      } catch (e) {
        console.warn('stock video', e);
        H.toast('Could not download this video. Try another one.');
      }
      s.adding = null;
      draw();
    }));
  };
  draw();
  if (!sources) loadSources().then((d) => d && draw());
}

/** Stock music section. ctx: { H, inPreview, addAudio(file, credit) → Promise }. */
export function renderStockMusic(host, ctx) {
  const { H } = ctx;
  if (ctx.inPreview) {
    host.innerHTML = `<p class="muted stock-note">${H.esc(previewNote('Stock music'))}</p>`;
    return;
  }
  const s = state.audio;
  const draw = () => {
    if (!host.isConnected) return;
    host.innerHTML = `${searchBox(H, 'audio', MUSIC_MOODS)}
      <div class="mus-list stock-list">${s.items.map((it, i) => `<div class="mus-item">
        <button type="button" class="mus-play ${preview?.i === i ? 'on' : ''}" data-sap="${i}" title="Preview" aria-label="Preview ${H.esc(it.title || '')}">${H.icon(preview?.i === i ? 'pause' : 'play', 16)}</button>
        <div class="mus-meta"><b>${H.esc(it.title || 'Untitled')}</b><small>${H.esc(it.author || '')}${it.duration ? ` · ${fmtDur(it.duration)}` : ''}${it.license ? ` · ${H.esc(it.license)}` : ''}${it.source ? ` · ${H.esc(it.source)}` : ''}</small></div>
        <button type="button" class="btn ghost small" data-saa="${i}" ${s.adding != null ? 'disabled' : ''}>${s.adding === i ? H.esc(s.addMsg || 'Adding…') : 'Add'}</button></div>`).join('')}</div>
      <p class="muted stock-msg" aria-live="polite">${H.esc(s.busy ? 'Searching…' : s.msg)}</p>
      ${s.hasMore && !s.busy ? `<button type="button" class="btn ghost small block" data-stock-more>Load more</button>` : ''}`;
    bindSearch(host, 'audio', draw);
    host.querySelectorAll('[data-sap]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.sap;
      const same = preview?.i === i;
      stopStockPreview();
      if (!same) {
        const a = new Audio(viaProxy(s.items[i].url));
        a.play().catch(() => H.toast('Could not play this preview'));
        a.onended = () => {
          stopStockPreview();
          draw();
        };
        preview = { a, i };
      }
      draw();
    }));
    host.querySelectorAll('[data-saa]').forEach((b) => (b.onclick = async () => {
      if (s.adding != null) return;
      const i = +b.dataset.saa;
      const it = s.items[i];
      stopStockPreview();
      s.adding = i;
      s.addMsg = 'Downloading…';
      draw();
      try {
        const file = await download(it, 'audio', (f) => {
          s.addMsg = `${Math.round(f * 100)}%`;
          const bt = host.querySelector(`[data-saa="${i}"]`);
          if (bt) bt.textContent = s.addMsg;
        });
        await ctx.addAudio(file, credit(it));
      } catch (e) {
        console.warn('stock audio', e);
        H.toast('Could not download this track. Try another one.');
      }
      s.adding = null;
      draw();
    }));
  };
  draw();
  if (!sources) loadSources().then((d) => d && draw());
  if (!s.loaded && !s.busy) search('audio').then(draw);
}

export function stopStockPreview() {
  if (preview) {
    preview.a.pause();
    preview.a.src = '';
    preview = null;
  }
}

function credit(it) {
  return { title: it.title || '', author: it.author || '', license: it.license || '', source: it.source || '', link: it.link || '' };
}

function bindSearch(host, kind, draw) {
  const s = state[kind];
  const form = host.querySelector(`[data-stock-form="${kind}"]`);
  form.onsubmit = (e) => {
    e.preventDefault();
    s.q = form.q.value;
    search(kind).then(draw);
    draw();
  };
  host.querySelectorAll('[data-stock-cat]').forEach((b) => (b.onclick = () => {
    s.q = '';
    s.cat = b.dataset.stockCat;
    search(kind).then(draw);
    draw();
  }));
  host.querySelectorAll('[data-stock-src]').forEach((b) => (b.onclick = () => {
    s.src = b.dataset.stockSrc;
    search(kind).then(draw);
    draw();
  }));
  const more = host.querySelector('[data-stock-more]');
  if (more) more.onclick = () => {
    search(kind, true).then(draw);
    draw();
  };
}

/** For tests: forget cached results. */
export function resetStock() {
  for (const k of Object.keys(state)) Object.assign(state[k], { items: [], page: 1, hasMore: false, busy: false, msg: '', loaded: false, adding: null });
}
