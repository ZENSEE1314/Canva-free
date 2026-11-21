// "Free stock photos" panel for the design editor: searches openly licensed photos through the
// Artvas server (/api/stock/images) and adds them through the image proxy, so exports never get a
// tainted (cross-origin) canvas. Falls back to Lorem Picsum when the search is unavailable.
import { needsSite } from './env.js';

export const STOCK_CATEGORIES = ['Nature', 'Business', 'People', 'Food', 'Travel', 'Animals', 'City', 'Technology', 'Flowers', 'Abstract', 'Texture', 'Sky'];
export const proxied = (u) => (!u || /^(data:|blob:|\/)/.test(u) ? u : `/api/image-proxy?url=${encodeURIComponent(u)}`);

const SI = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  bg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
};
const si = (n, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[n]}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const creditLine = (it) => `${it.title || 'Untitled'} — ${it.author || 'Unknown'}${it.license ? `, ${it.license}` : ''}`;

/** Candidate URLs for the full photo, best first (the original, then a full-size copy from Openverse). */
function fullCandidates(it) {
  const list = [proxied(it.url)];
  if (/api\.openverse\.org\/v1\/images\/[^/]+\/thumb\/?$/.test(it.thumb || '')) list.push(proxied(`${it.thumb}?full_size=true`));
  if (it.thumb) list.push(proxied(it.thumb));
  return [...new Set(list.filter(Boolean))];
}
function probe(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(false), 30000);
    img.onload = () => {
      clearTimeout(t);
      resolve(img.naturalWidth > 0);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(false);
    };
    img.src = url;
  });
}
/** The first full-size URL that actually loads (through our proxy). */
export async function resolveStockImage(it) {
  for (const u of fullCandidates(it)) if (await probe(u)) return u;
  return null;
}

/**
 * Render the Photos tab. h: { addImage, setBackgroundImage, toast, picsum(grid, more) }
 */
export function renderStockTab(p, h, st) {
  st.q ??= '';
  st.cat ??= 'Nature';
  p.innerHTML = `
    <h3>Photos</h3>
    <form class="ph-search" id="stockForm" role="search">
      ${si('search')}<input class="search" id="stockQ" placeholder="Search free stock photos" value="${esc(st.q)}" enterkeyhint="search" autocomplete="off">
    </form>
    <div class="chips ph-chips">${STOCK_CATEGORIES.map((c) => `<button class="chip ${!st.q && st.cat === c ? 'on' : ''}" data-scat="${c}">${c}</button>`).join('')}</div>
    <p class="muted tiny ph-note">Free, openly licensed photos (Openverse · Wikimedia Commons). Click to add — or into a selected photo frame. Check the licence before commercial use and credit the author where asked.</p>
    <div class="img-grid ph-grid" id="photoGrid"></div>
    <p class="muted ph-msg" id="stockMsg" hidden></p>
    <button class="btn ghost block" id="morePhotos" hidden>Load more</button>`;
  const grid = p.querySelector('#photoGrid');
  const msg = p.querySelector('#stockMsg');
  const more = p.querySelector('#morePhotos');
  let page = 1;
  let busy = false;
  let token = 0;
  let fallback = false;
  const items = new Map();

  const setMsg = (t) => {
    msg.hidden = !t;
    msg.textContent = t || '';
  };

  const card = (it) => {
    const key = `${it.source}:${it.id}`;
    items.set(key, it);
    const ratio = it.width && it.height ? `${it.width}/${it.height}` : '4/3';
    return `<div class="img-item ph-item" data-key="${esc(key)}">
      <img loading="lazy" src="${esc(it.thumb || proxied(it.url))}" alt="${esc(it.title)}" draggable="true" style="aspect-ratio:${ratio}">
      <button class="rm bgset" data-sbg title="Use as background">${si('bg', 14)}</button>
      <span class="ph-info" tabindex="0" aria-label="Photo details">${si('info', 14)}
        <span class="ph-tip" role="tooltip"><b>${esc(it.title)}</b><br>by ${esc(it.author)}<br>${esc(it.license)} · ${esc(it.source)}${it.link ? `<br><a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">View source</a>` : ''}</span>
      </span>
      <small class="ph-credit">${esc(creditLine(it))}</small>
    </div>`;
  };

  const use = async (el, asBg) => {
    const it = items.get(el.dataset.key);
    if (!it || el.classList.contains('loading')) return;
    el.classList.add('loading');
    const url = await resolveStockImage(it);
    el.classList.remove('loading');
    if (!url) return h.toast("Couldn't load that photo — try another one");
    if (asBg) await h.setBackgroundImage(url);
    else await h.addImage(url, { name: `Photo: ${creditLine(it)}`.slice(0, 120) });
  };

  async function load(reset) {
    if (fallback) return h.picsum(grid, more, false);
    if (busy && !reset) return;
    const my = ++token;
    busy = true;
    if (reset) {
      page = 1;
      grid.innerHTML = '';
      items.clear();
    }
    more.hidden = true;
    setMsg(page === 1 ? 'Searching…' : 'Loading more…');
    const q = st.q || st.cat;
    try {
      const r = await fetch(`/api/stock/images?q=${encodeURIComponent(q)}&page=${page}`);
      const data = await r.json().catch(() => ({}));
      if (my !== token) return;
      if (!r.ok) throw new Error(data.error || 'Search failed');
      setMsg(!data.items?.length && page === 1 ? `No photos found for “${q}”. Try another word.` : '');
      grid.insertAdjacentHTML('beforeend', (data.items || []).map(card).join(''));
      more.hidden = !data.hasMore;
      page++;
    } catch (e) {
      if (my !== token) return;
      if (page === 1) {
        // the free search is unavailable (offline, preview, or the library is busy): show Lorem Picsum
        fallback = true;
        setMsg(needsSite('Stock search', `${e.message || 'Stock search is unavailable'} — showing Lorem Picsum photos instead.`));
        grid.innerHTML = '';
        h.picsum(grid, more, true);
      } else {
        setMsg(e.message || 'Could not load more photos');
        more.hidden = false;
      }
    } finally {
      if (my === token) busy = false;
    }
  }

  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.ph-item');
    if (!el || e.target.closest('.ph-info a')) return;
    if (e.target.closest('.ph-info')) return;
    use(el, !!e.target.closest('[data-sbg]'));
  });
  grid.addEventListener('dragstart', (e) => {
    const el = e.target.closest('.ph-item');
    const it = el && items.get(el.dataset.key);
    if (it) e.dataTransfer.setData('text/artvas-img', fullCandidates(it)[0]);
  });
  // thumbnails come straight from the libraries; if one is blocked, go through our proxy
  grid.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG' || img.dataset.retried) return;
      img.dataset.retried = '1';
      img.src = proxied(img.src);
    },
    true
  );
  p.querySelector('#stockForm').onsubmit = (e) => {
    e.preventDefault();
    st.q = p.querySelector('#stockQ').value.trim();
    p.querySelectorAll('[data-scat]').forEach((b) => b.classList.toggle('on', !st.q && b.dataset.scat === st.cat));
    fallback = false;
    load(true);
  };
  p.querySelectorAll('[data-scat]').forEach(
    (b) =>
      (b.onclick = () => {
        st.cat = b.dataset.scat;
        st.q = '';
        p.querySelector('#stockQ').value = '';
        p.querySelectorAll('[data-scat]').forEach((x) => x.classList.toggle('on', x === b));
        fallback = false;
        load(true);
      })
  );
  more.onclick = () => load(false);
  // infinite scroll: load the next page when "Load more" comes into view
  const io = new IntersectionObserver(
    (es) => {
      if (!p.isConnected) return io.disconnect();
      if (es.some((x) => x.isIntersecting) && !more.hidden && !busy && !fallback) load(false);
    },
    { rootMargin: '200px' }
  );
  io.observe(more);
  load(true);
}
