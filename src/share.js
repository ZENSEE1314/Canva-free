// Share dialog (view / edit links), opening shared links, and the read-only view page.
import { jsPDF } from 'jspdf';
import { inPreview, needsSite } from './env.js';
import { myIdentity, setMyName, ensureCids, collabState } from './collab.js';
import { startPresentation } from './present.js';

const SI = {
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2A5 5 0 0 1 21.5 19"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
export const sicon = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[n]}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const shareLink = (id, token) => `${location.origin}${location.pathname}#/shared/${id}/${token}`;
export const parseSharedHash = (h = location.hash) => {
  const m = String(h).match(/^#\/shared\/([a-f0-9]{32})\/([a-f0-9]{48})/);
  return m ? { id: m[1], token: m[2] } : null;
};
/** The local copy of a shared design uses this id (so opening the link twice does not duplicate it). */
export const localIdFor = (shareId) => `sh${shareId.slice(0, 24)}`;

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) throw new Error(data?.error || (r.status === 413 ? 'This design is too big to share (25 MB limit).' : `Server error ${r.status}`));
  return data;
}
export const fetchShared = (id, token) => api('GET', `/api/share/${id}?t=${token}`);

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (input) {
      input.value = text;
      input.hidden = false;
      input.select();
      try {
        return document.execCommand('copy');
      } catch {}
    }
    return false;
  }
}

/**
 * The Share dialog. ctx: { state, capture, persist, toast, uid, startLive }
 */
export function openShareDialog(ctx) {
  const { state, toast } = ctx;
  if (inPreview) return toast(needsSite('Sharing', ''));
  const d = state.design;
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  const me = myIdentity();
  modal.innerHTML = `<div class="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="shTitle">
    <div class="row"><h3 id="shTitle">${sicon('users')} Share & edit together</h3><span class="spacer"></span><button class="icon-btn" data-close title="Close">${sicon('x')}</button></div>
    <p class="muted">Anyone with a link can open this design — no account needed. A copy is kept on your Artvas server.</p>
    <div class="share-links">
      <button class="share-opt" id="shView">${sicon('eye', 22)}<span><b>Copy view link</b><small>They can look, present and download</small></span></button>
      <button class="share-opt" id="shEdit">${sicon('edit', 22)}<span><b>Copy edit link</b><small>They can edit with you, live</small></span></button>
    </div>
    <input class="search share-out" id="shOut" readonly hidden>
    <p class="share-status muted" id="shStatus">${d.shared ? statusText(d) : 'Not shared yet.'}</p>
    <label class="flabel">Your name (shown to people editing with you)<input class="search" id="shName" value="${esc(me.name)}" maxlength="40"></label>
    <p class="muted tiny">Live editing: everyone's changes show up within a second or two. If two people change the same page at the same moment, the last change saved wins for that page.</p>
  </div>`;
  document.body.appendChild(modal);
  const $ = (s) => modal.querySelector(s);
  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  modal.onclick = (e) => {
    if (e.target === modal || e.target.closest('[data-close]')) close();
  };
  $('#shName').onchange = (e) => setMyName(e.target.value);

  const ensureShared = async () => {
    if (d.shared?.id && d.shared.editToken) return d.shared;
    if (d.shared?.id && !d.shared.editToken) throw new Error('You opened this design with a view link');
    ctx.capture();
    const payload = {
      name: d.name,
      width: d.width,
      height: d.height,
      present: d.present,
      pages: d.pages.map((p) => ({ id: p.id, json: ensureCids(structuredClone(p.json), ctx.uid), thumb: p.thumb, notes: p.notes, duration: p.duration, transition: p.transition })),
    };
    const r = await api('POST', '/api/share', { design: payload });
    d.shared = { id: r.id, viewToken: r.viewToken, editToken: r.editToken, role: 'edit', owner: true, version: 1 };
    // the shared copy got cids: keep the local one identical so live edits line up
    d.pages.forEach((p, i) => (p.json = payload.pages[i].json));
    await ctx.persist();
    ctx.startLive();
    return d.shared;
  };
  const run = async (btn, kind) => {
    const was = btn.innerHTML;
    btn.disabled = true;
    $('#shStatus').textContent = d.shared ? 'Copying…' : 'Saving a shared copy…';
    try {
      const s = await ensureShared();
      const token = kind === 'edit' ? s.editToken : s.viewToken;
      if (!token) throw new Error('No link of that kind for this design');
      const link = shareLink(s.id, token);
      const ok = await copyText(link, $('#shOut'));
      $('#shOut').value = link;
      $('#shOut').hidden = false;
      $('#shStatus').textContent = `${ok ? 'Copied! ' : 'Copy this link: '}${kind === 'edit' ? 'People with this link can edit.' : 'People with this link can view.'} ${statusText(d)}`;
      toast(ok ? `${kind === 'edit' ? 'Edit' : 'View'} link copied` : 'Link ready — copy it from the box');
    } catch (e) {
      console.error(e);
      $('#shStatus').textContent = e.message || 'Sharing failed';
      toast(e.message || 'Sharing failed');
    }
    btn.disabled = false;
    btn.innerHTML = was;
  };
  $('#shView').onclick = () => run($('#shView'), 'view');
  $('#shEdit').onclick = () => run($('#shEdit'), 'edit');
  if (d.shared && !d.shared.editToken) $('#shEdit').disabled = true;
}

function statusText(d) {
  if (!d.shared) return '';
  const n = collabState.peers.size;
  return collabState.ws ? (n ? `Live — ${n} other ${n === 1 ? 'person' : 'people'} editing now.` : 'Live — nobody else is editing right now.') : 'Shared.';
}

/**
 * Open a #/shared/<id>/<token> link. Edit links open in the editor; view links get the read-only page.
 * ctx: { app, openEditor, getDesign, saveDesign, toast, renderHome, designPageToBlob, logoSvg }
 */
export async function openSharedLink(ctx, { id, token }) {
  const { app } = ctx;
  if (inPreview) {
    app.innerHTML = `<div class="sv-msg"><p>${esc(needsSite('Shared designs', ''))}</p></div>`;
    return;
  }
  app.innerHTML = `<div class="sv-msg"><p>Opening shared design…</p></div>`;
  let data;
  try {
    data = await fetchShared(id, token);
  } catch (e) {
    app.innerHTML = `<div class="sv-msg"><h2>Can't open this link</h2><p>${esc(e.message)}</p><p><a href="${location.pathname}" class="btn primary">Go to Artvas</a></p></div>`;
    return;
  }
  const sd = data.design;
  if (data.role === 'edit') {
    const localId = localIdFor(id);
    const prev = await ctx.getDesign(localId).catch(() => null);
    const design = {
      ...(prev || {}),
      id: localId,
      name: sd.name,
      width: sd.width,
      height: sd.height,
      pages: sd.pages,
      present: sd.present,
      updatedAt: Date.now(),
      shared: { ...(prev?.shared || {}), id, editToken: token, viewToken: data.viewToken || prev?.shared?.viewToken, role: 'edit', version: data.version },
    };
    try {
      await ctx.saveDesign(design);
    } catch {}
    return ctx.openEditor(design);
  }
  renderSharedView(ctx, { id, token, design: sd });
}

function renderSharedView(ctx, { design }) {
  const { app } = ctx;
  document.title = `${design.name} · Artvas`;
  const n = design.pages.length;
  app.innerHTML = `<div class="sv">
    <header class="sv-top">
      <a class="logo small" href="${location.pathname}" title="Artvas home">${ctx.logoSvg()}<span>Artvas</span></a>
      <div class="sv-title"><b>${esc(design.name)}</b><small>${design.width} × ${design.height}px · ${n} page${n === 1 ? '' : 's'} · view only</small></div>
      <span class="spacer"></span>
      <button class="btn ghost" id="svPng">${sicon('download')}<span class="lbl">PNG</span></button>
      <button class="btn ghost" id="svPdf">${sicon('download')}<span class="lbl">PDF</span></button>
      <button class="btn primary" id="svPresent">${sicon('play')}<span class="lbl">Present</span></button>
    </header>
    <main class="sv-pages" id="svPages">
      ${design.pages
        .map(
          (p, i) => `<figure class="sv-page" data-i="${i}" style="width:min(960px, 100%, calc(80vh * ${design.width / design.height}))">
        <div class="sv-img" style="aspect-ratio:${design.width}/${design.height}">${p.thumb ? `<img src="${esc(p.thumb)}" alt="Page ${i + 1}" class="lowres">` : ''}</div>
        <figcaption><span>Page ${i + 1}</span><button class="link-btn" data-png="${i}">Download PNG</button><button class="link-btn" data-play="${i}">Present from here</button></figcaption>
      </figure>`
        )
        .join('')}
    </main>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const blobs = new Map();
  const pageBlob = (i) => {
    if (!blobs.has(i)) blobs.set(i, ctx.designPageToBlob(design, i));
    return blobs.get(i);
  };
  // render full-quality pages one after another
  (async () => {
    for (let i = 0; i < n; i++) {
      try {
        const b = await pageBlob(i);
        const box = app.querySelector(`.sv-page[data-i="${i}"] .sv-img`);
        if (!box || !b) continue;
        box.innerHTML = `<img src="${URL.createObjectURL(b)}" alt="Page ${i + 1}">`;
      } catch (e) {
        console.warn('page render failed', e);
      }
    }
  })();
  const fileBase = (design.name || 'artvas-design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'artvas-design';
  const save = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const downloadPng = async (i) => save(await pageBlob(i), `${fileBase}${n > 1 ? `-${i + 1}` : ''}.png`);
  app.querySelectorAll('[data-png]').forEach((b) => (b.onclick = () => downloadPng(+b.dataset.png).catch(() => ctx.toast('Download failed'))));
  $('#svPng').onclick = async () => {
    for (let i = 0; i < n; i++) await downloadPng(i).catch(() => ctx.toast('Download failed'));
  };
  $('#svPdf').onclick = async () => {
    const btn = $('#svPdf');
    btn.disabled = true;
    try {
      const W = design.width;
      const H = design.height;
      const pdf = new jsPDF({ orientation: W >= H ? 'landscape' : 'portrait', unit: 'px', format: [W, H], hotfixes: ['px_scaling'] });
      for (let i = 0; i < n; i++) {
        const b = await pageBlob(i);
        const url = await new Promise((r) => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result);
          fr.readAsDataURL(b);
        });
        if (i) pdf.addPage([W, H], W >= H ? 'landscape' : 'portrait');
        pdf.addImage(url, 'PNG', 0, 0, W, H);
      }
      save(pdf.output('blob'), `${fileBase}.pdf`);
    } catch (e) {
      console.error(e);
      ctx.toast('PDF download failed');
    }
    btn.disabled = false;
  };
  const present = (start) => startPresentation(design, { ...(design.present || {}), start, toast: ctx.toast });
  $('#svPresent').onclick = () => present(0);
  app.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => present(+b.dataset.play)));
  app.querySelectorAll('.sv-img').forEach((b) => (b.ondblclick = () => present(+b.closest('[data-i]').dataset.i)));
}
