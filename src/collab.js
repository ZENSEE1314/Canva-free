// Live collaboration for designs opened from an edit link.
//
// How it works: everyone on the same edit link joins a WebSocket room (/api/collab). After each change
// the editor sends a snapshot of the page it changed (debounced ~300 ms) together with the page
// revision it was based on; page order, added/removed pages and the name are sent as a whole-design
// message. The server orders all updates. When a snapshot is based on an older revision (two people
// edited the same page at the same time) the server merges it object by object (src/pagemerge.js):
// objects the sender changed take the sender's version, everything else keeps the newer version.
// Only when both changed the very same object does the last one to arrive win.
// Remote snapshots are applied object by object (matched by each object's `cid`) so the local
// selection survives; while the local user is dragging, typing or has just edited, they wait.
import { util, ActiveSelection } from 'fabric';

const NAMES = ['Otter', 'Panda', 'Koala', 'Fox', 'Robin', 'Tiger', 'Lynx', 'Heron', 'Gecko', 'Bison'];
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];
const ls = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export function myIdentity() {
  let name = ls.get('artvas-collab-name');
  let color = ls.get('artvas-collab-color');
  if (!name) {
    name = `Guest ${NAMES[Math.floor(Math.random() * NAMES.length)]}`;
    ls.set('artvas-collab-name', name);
  }
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) {
    color = COLORS[Math.floor(Math.random() * COLORS.length)];
    ls.set('artvas-collab-color', color);
  }
  return { name, color };
}
export function setMyName(name) {
  ls.set('artvas-collab-name', String(name || '').trim().slice(0, 40) || myIdentity().name);
  C.ws && send({ t: 'hello', ...myIdentity() });
}

const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

/** Give every top-level object in a page JSON a stable id, so edits can be matched across people. */
export function ensureCids(json, mk) {
  for (const o of json?.objects || []) if (!o.cid) o.cid = mk();
  return json;
}

// one live session at a time
const C = {
  ctx: null,
  ws: null,
  share: null,
  peers: new Map(),
  me: null,
  sendT: 0,
  dirtyPage: false,
  lastSig: '',
  suppress: 0,
  lastLocal: 0,
  pending: null, // a remote snapshot for the current page that waits until the user is idle
  waitT: 0,
  retry: 0,
  retryT: 0,
  cursorT: 0,
  cursorLast: 0,
  mouseDown: false,
  unbind: null,
  overlay: null,
  ro: null,
  version: 0,
};
export const collabState = C;

// remote updates and local merges run one at a time
let queue = Promise.resolve();
function serial(fn) {
  queue = queue.then(fn).catch((err) => console.error('collab', err));
  return queue;
}

function send(msg) {
  if (C.ws?.readyState === 1) {
    C.ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

const designSig = (d) => JSON.stringify([d.name, d.width, d.height, d.pages.map((p) => p.id), d.present || null]);
const designPayload = (d) => ({
  name: d.name,
  width: d.width,
  height: d.height,
  present: d.present,
  pages: d.pages.map(pagePayload),
});
const pagePayload = (p) => ({ id: p.id, rev: p.rev || 0, json: p.json, thumb: p.thumb, notes: p.notes, duration: p.duration, transition: p.transition });

export const isLive = () => !!C.share;

/**
 * Join the room for a shared design. ctx gives access to the editor:
 * { state, PROPS, capture, schedulePersist, renderPages, renderProps, renderLayersIfOpen, pushHistory, loadPage, reopen, toast, uid, setTitle }
 */
export function connect(ctx, share) {
  disconnect();
  C.ctx = ctx;
  C.share = share;
  C.version = share.version || 0;
  C.lastSig = designSig(ctx.state.design);
  C.retry = 0;
  bindCanvas();
  open();
}

function open() {
  if (!C.share) return;
  const { id, editToken } = C.share;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let ws;
  try {
    ws = new WebSocket(`${proto}://${location.host}/api/collab?id=${encodeURIComponent(id)}&t=${encodeURIComponent(editToken)}`);
  } catch {
    return scheduleReconnect();
  }
  C.ws = ws;
  setStatus('connecting');
  ws.onopen = () => {
    C.retry = 0;
    send({ t: 'hello', ...myIdentity() });
  };
  ws.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.t === 'cursor') onMessage(m);
    else serial(() => onMessage(m));
  };
  let opened = false;
  ws.addEventListener('open', () => (opened = true));
  ws.onclose = async () => {
    if (C.ws !== ws) return;
    C.ws = null;
    C.peers.clear();
    renderPeers();
    if (!C.share) return;
    if (!opened) {
      // refused: was the shared copy removed (e.g. the server lost its data on a redeploy)?
      const share = C.share;
      const r = await fetch(`/api/share/${share.id}?t=${share.editToken}`).catch(() => null);
      if (r?.status === 404 && C.share === share) {
        const d = C.ctx.state.design;
        disconnect();
        if (d?.shared?.id === share.id) {
          delete d.shared;
          C.ctx.schedulePersist();
          try {
            history.replaceState(null, '', `#/design/${d.id}`);
          } catch {}
        }
        C.ctx.toast('This shared design is no longer on the server — share it again to get new links');
        return;
      }
    }
    if (C.share) scheduleReconnect();
  };
  ws.onerror = () => {};
}

function scheduleReconnect() {
  setStatus('offline');
  clearTimeout(C.retryT);
  const wait = Math.min(15000, 1000 * 2 ** C.retry++);
  C.retryT = setTimeout(open, wait);
}

export function disconnect() {
  clearTimeout(C.retryT);
  clearTimeout(C.sendT);
  clearTimeout(C.waitT);
  const ws = C.ws;
  C.ws = null;
  C.share = null;
  C.pending = null;
  C.peers.clear();
  try {
    ws?.close();
  } catch {}
  C.unbind?.();
  C.unbind = null;
  C.ro?.disconnect();
  C.overlay?.remove();
  C.overlay = null;
  document.getElementById('collabAvatars')?.replaceChildren();
}

function setStatus(s) {
  const el = document.getElementById('collabAvatars');
  if (el) el.dataset.status = s;
}

// ---------- incoming ----------
async function onMessage(m) {
  const { state } = C.ctx;
  if (!state.design || !C.share) return;
  switch (m.t) {
    case 'welcome':
      C.me = m.you;
      C.peers = new Map((m.peers || []).map((p) => [p.id, { ...p }]));
      renderPeers();
      setStatus('live');
      if (C.dirtyPage) flush();
      else if (m.version !== C.version) send({ t: 'sync' });
      if (designSig(state.design) !== C.lastSig) sendDesign();
      break;
    case 'join':
    case 'peer':
      C.peers.set(m.peer.id, { ...(C.peers.get(m.peer.id) || {}), ...m.peer });
      renderPeers();
      if (m.t === 'join') C.ctx.toast(`${m.peer.name} joined`);
      break;
    case 'leave':
      C.peers.delete(m.id);
      renderPeers();
      renderCursors();
      break;
    case 'cursor': {
      const p = C.peers.get(m.from);
      if (!p) return;
      p.cursor = m.out ? null : { x: m.x, y: m.y, page: m.page };
      renderCursors();
      break;
    }
    case 'page':
      C.version = m.version || C.version;
      await applyRemotePage(m.page, m.index);
      break;
    case 'ack': {
      // the server stored our page; if it had to merge in someone else's changes, show the result
      C.version = m.version || C.version;
      if (m.page) await applyRemotePage(m.page, m.index);
      else {
        const p = state.design.pages.find((x) => x.id === m.id);
        if (p && (p.rev || 0) < m.rev) p.rev = m.rev;
      }
      break;
    }
    case 'design':
      C.version = m.version || C.version;
      await applyRemoteDesign(m.design);
      break;
  }
  if (state.design?.shared) state.design.shared.version = C.version;
}

/** True while the local user is in the middle of something a remote update would disturb. */
function busy() {
  const { state } = C.ctx;
  const c = state.canvas;
  if (!c) return false;
  if (C.mouseDown || c._currentTransform || state.crop || c.isDrawingMode && C.mouseDown) return true;
  if (c.getActiveObject()?.isEditing) return true;
  if (Date.now() - C.lastLocal < 700) return true;
  return false;
}

function waitIdle() {
  clearTimeout(C.waitT);
  C.waitT = setTimeout(async () => {
    if (!C.pending) return;
    if (busy()) return waitIdle();
    serial(async () => {
      const p = C.pending;
      if (!p) return;
      C.pending = null;
      await applyRemotePage(p.page, p.index);
    });
  }, 250);
}

async function applyRemotePage(page, index) {
  const { state } = C.ctx;
  const d = state.design;
  let i = d.pages.findIndex((p) => p.id === page.id);
  if (i >= 0 && (page.rev || 0) < (d.pages[i].rev || 0)) return; // older than what we have
  if (i < 0) {
    i = Math.max(0, Math.min(d.pages.length, index || 0));
    d.pages.splice(i, 0, { ...page });
    if (i <= state.page && d.pages.length > 1) state.page++;
    quietSave();
    C.ctx.renderPages();
    C.lastSig = designSig(d);
    return;
  }
  if (i !== state.page) {
    d.pages[i] = { ...d.pages[i], ...page, thumb: page.thumb || d.pages[i].thumb };
    quietSave();
    C.ctx.updatePageThumb(i);
    return;
  }
  if (busy()) {
    if (!C.pending || C.pending.page.id !== page.id || (C.pending.page.rev || 0) <= (page.rev || 0)) C.pending = { page, index };
    return waitIdle();
  }
  // current page: notes etc. first, then the canvas
  const cur = d.pages[i];
  Object.assign(cur, { notes: page.notes, duration: page.duration, transition: page.transition, rev: page.rev || 0 });
  C.ctx.onNotesChanged?.();
  await applyToCanvas(page.json);
  cur.json = page.json;
  if (page.thumb) cur.thumb = page.thumb;
  C.ctx.updatePageThumb(i);
}

async function applyRemoteDesign(rd) {
  const { state } = C.ctx;
  const d = state.design;
  if (rd.width !== d.width || rd.height !== d.height) {
    Object.assign(d, { name: rd.name, width: rd.width, height: rd.height, pages: rd.pages, present: rd.present });
    C.lastSig = designSig(d);
    quietSave();
    return C.ctx.reopen(d);
  }
  const curId = d.pages[state.page]?.id;
  const curLocal = d.pages[state.page];
  d.name = rd.name;
  d.present = rd.present;
  C.ctx.setTitle(rd.name);
  d.pages = rd.pages.map((p) => ({ ...p }));
  C.lastSig = designSig(d);
  const ni = d.pages.findIndex((p) => p.id === curId);
  if (ni < 0) {
    state.page = Math.min(state.page, d.pages.length - 1);
    await withSuppress(() => C.ctx.loadPage(state.page));
    C.ctx.renderPages();
    quietSave();
    return;
  }
  state.page = ni;
  const remotePage = d.pages[ni];
  // keep the live canvas page object as is until we apply the snapshot
  d.pages[ni] = curLocal;
  C.ctx.renderPages();
  if (JSON.stringify(remotePage.json) !== JSON.stringify(curLocal.json) || remotePage.notes !== curLocal.notes) await applyRemotePage(remotePage, ni);
  else {
    curLocal.rev = Math.max(curLocal.rev || 0, remotePage.rev || 0);
    quietSave();
  }
}

async function withSuppress(fn) {
  C.suppress++;
  try {
    return await fn();
  } finally {
    C.suppress--;
  }
}
function quietSave() {
  C.suppress++;
  try {
    C.ctx.schedulePersist();
  } finally {
    C.suppress--;
  }
}

/** Bring the canvas in line with a page JSON, keeping unchanged objects (and the selection). */
async function applyToCanvas(json) {
  const { state, PROPS } = C.ctx;
  const c = state.canvas;
  if (!c) return;
  const remote = json || { objects: [] };
  const act = c.getActiveObject();
  const multi = act instanceof ActiveSelection;
  const activeIds = c.getActiveObjects().map((o) => o.cid).filter(Boolean);
  state.loading = true;
  C.suppress++;
  try {
    // objects inside a multi-selection have group-relative positions: drop it while comparing
    if (multi) c.discardActiveObject();
    const cur = c.toObject(PROPS);
    const bgKeys = ['background', 'backgroundImage', 'overlay', 'overlayImage', 'bgGradient'];
    const bgChanged = bgKeys.some((k) => JSON.stringify(cur[k] ?? null) !== JSON.stringify(remote[k] ?? null));
    if (bgChanged || (remote.objects || []).some((o) => !o.cid)) {
      await c.loadFromJSON(remote);
    } else {
      const locals = c.getObjects();
      const byId = new Map(locals.filter((o) => o.cid && !o.excludeFromExport).map((o) => [o.cid, { o, s: JSON.stringify(o.toObject(PROPS)) }]));
      const list = remote.objects || [];
      const keep = new Set();
      const need = [];
      const next = list.map((ro, k) => {
        const hit = byId.get(ro.cid);
        if (hit && hit.s === JSON.stringify(ro)) {
          keep.add(hit.o);
          return hit.o;
        }
        need.push(k);
        return null;
      });
      const made = need.length ? await util.enlivenObjects(need.map((k) => list[k])) : [];
      need.forEach((k, j) => (next[k] = made[j]));
      for (const o of locals) if (!keep.has(o)) c.remove(o);
      next.forEach((o, k) => {
        if (!o) return;
        if (keep.has(o)) c.moveObjectTo(o, k);
        else c.insertAt(k, o);
      });
    }
    // reselect what was selected, if it still exists
    const objs = c.getObjects();
    if (!multi && act && objs.includes(act)) {
      // still the same object: nothing to do
    } else {
      if (!multi && act) c.discardActiveObject();
      const sel = objs.filter((o) => o.cid && activeIds.includes(o.cid) && o.selectable !== false);
      if (sel.length === 1) c.setActiveObject(sel[0]);
      else if (sel.length > 1) c.setActiveObject(new ActiveSelection(sel, { canvas: c }));
    }
    c.requestRenderAll();
  } finally {
    state.loading = false;
    C.suppress--;
  }
  C.suppress++;
  try {
    C.ctx.pushHistory();
    C.ctx.renderProps();
    C.ctx.renderLayersIfOpen();
    C.ctx.schedulePersist();
  } finally {
    C.suppress--;
  }
}

// ---------- outgoing ----------
/** Called by the editor after every local change (schedulePersist). */
export function onLocalChange() {
  if (!C.share || C.suppress) return;
  C.lastLocal = Date.now();
  C.dirtyPage = true;
  clearTimeout(C.sendT);
  C.sendT = setTimeout(flush, 300);
}
/** Called by the editor after it saved (catches page add/delete/reorder and renames). */
export function afterPersist() {
  if (!C.share || C.suppress) return;
  if (designSig(C.ctx.state.design) !== C.lastSig) sendDesign();
}

let flushing = false;
function flush() {
  clearTimeout(C.sendT);
  if (flushing) {
    C.sendT = setTimeout(flush, 300);
    return;
  }
  flushing = true;
  serial(flushNow).finally(() => (flushing = false));
}
async function flushNow() {
  const { state } = C.ctx;
  if (!C.share || !state.design || !state.canvas) return;
  if (state.crop || C.mouseDown) {
    C.sendT = setTimeout(flush, 300);
    return;
  }
  if (designSig(state.design) !== C.lastSig) return sendDesign();
  const page = state.design.pages[state.page];
  C.ctx.capture();
  if (send({ t: 'page', page: pagePayload(page), index: state.page, base: page.rev || 0 })) C.dirtyPage = false;
}

function sendDesign() {
  const { state } = C.ctx;
  if (state.canvas && !state.crop) C.ctx.capture();
  if (send({ t: 'design', design: designPayload(state.design) })) {
    C.lastSig = designSig(state.design);
    C.dirtyPage = false;
  }
}

// ---------- presence ----------
function bindCanvas() {
  const { state } = C.ctx;
  const c = state.canvas;
  if (!c) return;
  const onMove = (e) => {
    const now = Date.now();
    if (now - C.cursorLast < 60) return;
    C.cursorLast = now;
    const p = c.getScenePoint(e.e);
    send({ t: 'cursor', x: Math.round(p.x), y: Math.round(p.y), page: state.design.pages[state.page]?.id });
  };
  const onDown = () => (C.mouseDown = true);
  const onUp = () => {
    C.mouseDown = false;
    if (C.pending) waitIdle();
  };
  const onOut = () => send({ t: 'cursor', out: true });
  c.on('mouse:move', onMove);
  c.on('mouse:down', onDown);
  c.on('mouse:up', onUp);
  c.on('mouse:out', onOut);
  window.addEventListener('pointerup', onUp);
  C.unbind = () => {
    c.off('mouse:move', onMove);
    c.off('mouse:down', onDown);
    c.off('mouse:up', onUp);
    c.off('mouse:out', onOut);
    window.removeEventListener('pointerup', onUp);
  };
  const holder = document.getElementById('holder');
  if (holder) {
    C.overlay = document.createElement('div');
    C.overlay.className = 'collab-cursors';
    holder.appendChild(C.overlay);
    C.ro = new ResizeObserver(() => renderCursors());
    C.ro.observe(holder);
  }
}

/** Re-place cursors (also after zooming or switching pages). */
export function renderCursors() {
  const ov = C.overlay;
  if (!ov || !C.ctx) return;
  const { state } = C.ctx;
  const pageId = state.design?.pages[state.page]?.id;
  const z = state.zoom || 1;
  const seen = new Set();
  for (const [id, p] of C.peers) {
    if (!p.cursor || p.cursor.page !== pageId) continue;
    seen.add(id);
    let el = ov.querySelector(`[data-peer="${id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'collab-cursor';
      el.dataset.peer = id;
      el.innerHTML = `<svg viewBox="0 0 16 16" width="18" height="18"><path d="M1 1l5.5 13 1.8-5.2L13.5 7z" fill="currentColor" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg><span></span>`;
      ov.appendChild(el);
    }
    el.style.color = p.color;
    el.querySelector('span').textContent = p.name;
    el.querySelector('span').style.background = p.color;
    el.style.transform = `translate(${p.cursor.x * z}px, ${p.cursor.y * z}px)`;
  }
  ov.querySelectorAll('[data-peer]').forEach((el) => !seen.has(el.dataset.peer) && el.remove());
}

function renderPeers() {
  const el = document.getElementById('collabAvatars');
  if (!el) return;
  const me = myIdentity();
  const list = [...C.peers.values()].filter((p) => p.joined !== false);
  const chip = (p, you) => `<span class="cav${you ? ' you' : ''}" style="background:${p.color}" title="${esc(p.name)}${you ? ' (you)' : ''}">${esc(initials(p.name))}</span>`;
  el.innerHTML = C.share ? list.slice(0, 5).map((p) => chip(p, false)).join('') + (list.length > 5 ? `<span class="cav more">+${list.length - 5}</span>` : '') + chip(me, true) : '';
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const _collab = C;
