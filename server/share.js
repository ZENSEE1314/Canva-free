// Shared designs + live collaboration.
//
// A shared design is stored as one JSON file under DATA_DIR/shares/<id>.json:
//   { id, viewToken, editToken, createdAt, updatedAt, version, design }
// The id and tokens are long random hex strings. Anyone with the view token can read the design;
// anyone with the edit token can read and change it. Designs are never listed.
//
// Live editing uses a WebSocket at /api/collab?id=<id>&t=<editToken>. Clients send whole-page
// snapshots (debounced) with the page revision they were based on. The server orders the updates and
// keeps every page's latest copy; a snapshot based on an older revision (two people editing the same
// page at once) is merged object by object (src/pagemerge.js). Only when both changed the very same
// object does the last one to arrive win.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { mergePage } from '../src/pagemerge.js';

const MAX_BYTES = 25 * 1024 * 1024;
const ID_RE = /^[a-f0-9]{32}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;

export function createShareStore(dataDir) {
  const dir = path.join(dataDir, 'shares');
  fs.mkdirSync(dir, { recursive: true });
  const mem = new Map(); // id -> record (recently used)
  const timers = new Map();
  const file = (id) => path.join(dir, `${id}.json`);

  async function load(id) {
    if (!ID_RE.test(id || '')) return null;
    if (mem.has(id)) return mem.get(id);
    try {
      const rec = JSON.parse(await fs.promises.readFile(file(id), 'utf8'));
      for (const p of rec.design?.pages || []) remember(rec, p);
      mem.set(id, rec);
      return rec;
    } catch {
      return null;
    }
  }
  async function writeNow(rec) {
    const tmp = `${file(rec.id)}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(rec, (k, v) => (k.startsWith('_') ? undefined : v)));
    await fs.promises.rename(tmp, file(rec.id));
  }
  /** Save soon (coalesces bursts of live edits into one write). */
  function save(rec, delay = 1500) {
    clearTimeout(timers.get(rec.id));
    timers.set(
      rec.id,
      setTimeout(() => {
        timers.delete(rec.id);
        writeNow(rec).catch((e) => console.error('share save failed', e?.message || e));
      }, delay)
    );
  }
  async function flush() {
    const ids = [...timers.keys()];
    for (const id of ids) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      const rec = mem.get(id);
      if (rec) await writeNow(rec).catch(() => {});
    }
  }
  async function create(design) {
    const rec = {
      id: crypto.randomBytes(16).toString('hex'),
      viewToken: crypto.randomBytes(24).toString('hex'),
      editToken: crypto.randomBytes(24).toString('hex'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      design,
    };
    for (const p of design.pages) remember(rec, p);
    mem.set(rec.id, rec);
    await writeNow(rec);
    return rec;
  }
  // keep memory small: forget records nobody is using
  setInterval(() => {
    for (const [id, rec] of mem) if (!timers.has(id) && !rec._live && Date.now() - (rec._used || 0) > 30 * 60 * 1000) mem.delete(id);
  }, 10 * 60 * 1000).unref();
  return { load, save, create, flush };
}

/** Constant-time token check. Returns 'edit', 'view' or null. */
export function roleFor(rec, token) {
  if (!rec || !TOKEN_RE.test(token || '')) return null;
  const t = Buffer.from(token);
  const eq = (s) => {
    const b = Buffer.from(String(s || ''));
    return b.length === t.length && crypto.timingSafeEqual(b, t);
  };
  if (eq(rec.editToken)) return 'edit';
  if (eq(rec.viewToken)) return 'view';
  return null;
}

/** Keep only what a design needs; reject anything that does not look like one. */
function cleanDesign(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.pages) || !d.pages.length || d.pages.length > 300) return null;
  const width = Math.round(+d.width);
  const height = Math.round(+d.height);
  if (!(width >= 1 && width <= 20000 && height >= 1 && height <= 20000)) return null;
  const pages = d.pages.map(cleanPage);
  if (pages.some((p) => !p)) return null;
  const pr = d.present && typeof d.present === 'object' ? d.present : null;
  const present = pr
    ? { transition: ['none', 'fade', 'slide', 'zoom'].includes(pr.transition) ? pr.transition : 'fade', autoplay: !!pr.autoplay, loop: !!pr.loop, fromCurrent: !!pr.fromCurrent }
    : undefined;
  return { name: String(d.name || 'Shared design').slice(0, 200), width, height, pages, present };
}
function cleanPage(p) {
  if (!p || typeof p !== 'object') return null;
  const id = String(p.id || crypto.randomBytes(6).toString('hex')).slice(0, 64);
  const out = { id, json: p.json && typeof p.json === 'object' ? p.json : null, thumb: typeof p.thumb === 'string' && p.thumb.length < 400000 && /^data:image\/(jpeg|png|webp);base64,/.test(p.thumb) ? p.thumb : '' };
  if (p.duration != null && Number.isFinite(+p.duration)) out.duration = Math.max(0.5, Math.min(600, +p.duration));
  if (typeof p.notes === 'string') out.notes = p.notes.slice(0, 20000);
  if (p.transition && typeof p.transition === 'string') out.transition = p.transition.slice(0, 20);
  out.rev = Number.isInteger(p.rev) && p.rev > 0 ? p.rev : 1;
  return out;
}

/** Recent revisions of each page (in memory), so late snapshots can be merged. */
function remember(rec, page) {
  rec._hist ||= new Map();
  const h = rec._hist.get(page.id) || [];
  h.push({ rev: page.rev, json: page.json });
  if (h.length > 40) h.shift();
  rec._hist.set(page.id, h);
}

export function shareRouter(store, rooms) {
  const r = express.Router();
  const json = express.json({ limit: MAX_BYTES });
  const tooBig = (err, _req, res, next) => (err?.type === 'entity.too.large' ? res.status(413).json({ error: 'This design is too big to share (25 MB limit). Try smaller images.' }) : next(err));

  r.post('/', json, tooBig, async (req, res) => {
    const design = cleanDesign(req.body?.design || req.body);
    if (!design) return res.status(400).json({ error: 'That is not a design' });
    try {
      const rec = await store.create(design);
      res.json({ id: rec.id, viewToken: rec.viewToken, editToken: rec.editToken });
    } catch (e) {
      console.error('share create failed', e?.message || e);
      res.status(500).json({ error: 'Could not save the shared copy' });
    }
  });
  r.get('/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const rec = await store.load(req.params.id);
    const role = roleFor(rec, String(req.query.t || ''));
    if (!role) return res.status(404).json({ error: 'This link is not valid or the design was removed' });
    rec._used = Date.now();
    res.json({ id: rec.id, role, version: rec.version, updatedAt: rec.updatedAt, design: rec.design, ...(role === 'edit' ? { viewToken: rec.viewToken } : {}) });
  });
  r.put('/:id', json, tooBig, async (req, res) => {
    const rec = await store.load(req.params.id);
    if (roleFor(rec, String(req.query.t || '')) !== 'edit') return res.status(403).json({ error: 'This link can only view the design' });
    const design = cleanDesign(req.body?.design || req.body);
    if (!design) return res.status(400).json({ error: 'That is not a design' });
    const old = new Map(rec.design.pages.map((p) => [p.id, p]));
    for (const p of design.pages) {
      p.rev = (old.get(p.id)?.rev || 0) + 1;
      remember(rec, p);
    }
    rec.design = design;
    rec.version++;
    rec.updatedAt = Date.now();
    store.save(rec, 200);
    rooms?.broadcast(rec.id, { t: 'design', design: rec.design, version: rec.version });
    res.json({ ok: true, version: rec.version });
  });
  return r;
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5'];

/** WebSocket rooms for live editing, one room per shared design. */
export function attachCollab(server, store) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BYTES });
  const rooms = new Map(); // id -> Set<ws>
  const send = (ws, msg) => {
    if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  };
  const broadcast = (id, msg, except) => {
    const s = rooms.get(id);
    if (!s) return;
    const data = JSON.stringify(msg);
    for (const ws of s) if (ws !== except) send(ws, data);
  };

  server.on('upgrade', async (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://x');
    } catch {
      return socket.destroy();
    }
    if (url.pathname !== '/api/collab') return; // not ours (leave it for anyone else)
    const rec = await store.load(url.searchParams.get('id') || '');
    if (roleFor(rec, url.searchParams.get('t') || '') !== 'edit') {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => join(ws, rec));
  });

  function join(ws, rec) {
    const id = rec.id;
    if (!rooms.has(id)) rooms.set(id, new Set());
    const room = rooms.get(id);
    rec._live = true;
    ws.peer = { id: crypto.randomBytes(6).toString('hex'), name: 'Guest', color: COLORS[room.size % COLORS.length] };
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    room.add(ws);
    send(ws, { t: 'welcome', you: ws.peer.id, version: rec.version, peers: [...room].filter((o) => o !== ws && o.peer.joined).map((o) => o.peer) });

    ws.on('message', (raw) => {
      let m;
      try {
        m = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!m || typeof m !== 'object') return;
      const from = ws.peer.id;
      switch (m.t) {
        case 'hello': {
          ws.peer.name = String(m.name || 'Guest').slice(0, 40);
          if (/^#[0-9a-f]{6}$/i.test(m.color || '')) ws.peer.color = m.color;
          const first = !ws.peer.joined;
          ws.peer.joined = true;
          broadcast(id, { t: first ? 'join' : 'peer', peer: ws.peer }, ws);
          break;
        }
        case 'cursor':
          broadcast(id, { t: 'cursor', from, x: +m.x || 0, y: +m.y || 0, page: String(m.page || ''), out: !!m.out }, ws);
          break;
        case 'page': {
          const page = cleanPage(m.page);
          if (!page) return;
          const pages = rec.design.pages;
          let i = pages.findIndex((p) => p.id === page.id);
          let merged = false;
          if (i >= 0) {
            const cur = pages[i];
            const base = Number.isInteger(m.base) ? m.base : 0;
            if (base !== cur.rev) {
              // based on an older revision: fold the sender's changes into the current page
              const parent = rec._hist?.get(page.id)?.find((h) => h.rev === base);
              if (parent) {
                page.json = mergePage(parent.json, page.json, cur.json);
                merged = true;
              }
            }
            page.rev = (cur.rev || 1) + 1;
            pages[i] = page;
          } else {
            if (pages.length >= 300) return;
            i = Math.max(0, Math.min(pages.length, +m.index || 0));
            page.rev = 1;
            pages.splice(i, 0, page);
          }
          remember(rec, page);
          rec.version++;
          rec.updatedAt = Date.now();
          store.save(rec);
          broadcast(id, { t: 'page', from, page, index: i, version: rec.version }, ws);
          send(ws, { t: 'ack', id: page.id, rev: page.rev, index: i, version: rec.version, ...(merged ? { page } : {}) });
          break;
        }
        case 'design': {
          // page order / added or removed pages / name — whole design. A page whose content is older
          // than what the server has keeps the server's content.
          const design = cleanDesign(m.design);
          if (!design) return;
          const old = new Map(rec.design.pages.map((p) => [p.id, p]));
          design.pages = design.pages.map((p) => {
            const s0 = old.get(p.id);
            if (!s0) {
              p.rev = 1;
              remember(rec, p);
              return p;
            }
            if ((m.design.pages.find((x) => x?.id === p.id)?.rev || 0) < (s0.rev || 1)) return s0;
            if (JSON.stringify(p.json) !== JSON.stringify(s0.json) || p.notes !== s0.notes) {
              p.rev = (s0.rev || 1) + 1;
              remember(rec, p);
              return p;
            }
            return { ...p, rev: s0.rev || 1 };
          });
          rec.design = design;
          rec.version++;
          rec.updatedAt = Date.now();
          store.save(rec);
          // everyone, the sender included, gets the result (with the page revisions)
          broadcast(id, { t: 'design', from, design, version: rec.version });
          break;
        }
        case 'sync':
          send(ws, { t: 'design', design: rec.design, version: rec.version });
          break;
      }
    });
    ws.on('close', () => {
      room.delete(ws);
      broadcast(id, { t: 'leave', id: ws.peer.id });
      if (!room.size) {
        rooms.delete(id);
        rec._live = false;
        rec._used = Date.now();
      }
    });
    ws.on('error', () => {});
  }

  // drop dead connections
  const ping = setInterval(() => {
    for (const s of rooms.values())
      for (const ws of s) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {}
      }
  }, 30000);
  ping.unref();
  return { broadcast, wss };
}
