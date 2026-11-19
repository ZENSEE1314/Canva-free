import './style.css';
import {
  Canvas, StaticCanvas, Textbox, FabricImage, Group, ActiveSelection, PencilBrush, Shadow,
  Circle, Rect, filters, cache, util, InteractiveFabricObject,
} from 'fabric';
import { jsPDF } from 'jspdf';
import { saveDesign, getDesign, listDesigns, deleteDesign, uid, listVersions, saveVersion, getVersion, deleteVersion, kvGet, kvSet } from './storage.js';
import {
  SIZE_PRESETS, FONTS, PALETTE, GRADIENTS, TEXT_PRESETS, TEXT_COMBOS, SHAPES, STICKERS, TEMPLATES, TEMPLATE_CATS,
} from './data.js';
import { removeBackgroundAI, removeColor } from './bgremove.js';
import { ANIMATIONS, PAGE_PRESETS, playPreview, exportGIF, exportVideo, animationLength, videoMime } from './animate.js';
import { createShape, makeGradient, buildTemplate } from './elements.js';
import { icon } from './icons.js';

const PROPS = [
  'name', 'locked', 'selectable', 'evented', 'hasControls', 'lockMovementX', 'lockMovementY',
  'lockRotation', 'lockScalingX', 'lockScalingY', 'bgGradient', 'anim',
];

const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- Global state ----------
const state = {
  design: null, // { id, name, width, height, pages: [{ id, json, thumb }] }
  page: 0,
  canvas: null,
  zoom: 1,
  fitZoom: 1,
  history: [],
  redo: [],
  loading: false,
  clipboard: null,
  tab: 'templates',
  drawing: { on: false, color: '#7c3aed', width: 8, eraser: false },
  photosPage: 1,
  uploads: [],
  tplCat: 'All',
  brand: { colors: [], headingFont: 'Montserrat', bodyFont: 'Inter', logos: [], fonts: [] },
  lastVersionAt: 0,
};

// ---------- Toast ----------
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Fonts ----------
const fontsReady = Promise.all(
  FONTS.flatMap((f) => [document.fonts.load(`400 40px "${f}"`), document.fonts.load(`700 40px "${f}"`)])
).catch(() => {});

async function ensureFont(family, weight = '400', style = 'normal') {
  try {
    await document.fonts.load(`${style} ${weight} 40px "${family}"`);
    cache.clearFontCache(family);
  } catch {}
}

// =====================================================
// HOME SCREEN
// =====================================================
async function renderHome() {
  state.canvas?.dispose();
  state.canvas = null;
  state.design = null;
  history.replaceState(null, '', '/');
  const designs = await listDesigns().catch(() => []);
  app.innerHTML = `
  <div class="home">
    <header class="home-top">
      <div class="logo">${logoSvg()}<span>Artvas</span></div>
      <div class="home-actions">
        <label class="btn ghost">${icon('folder')} Open file<input type="file" id="openFile" accept=".json,.artvas" hidden></label>
        <button class="btn primary" id="newCustomTop">${icon('plus')} Create a design</button>
      </div>
    </header>
    <section class="hero">
      <h1>What will you design today?</h1>
      <p>Free design editor for social posts, posters, presentations, cards and more — right in your browser.</p>
      <div class="custom-size">
        <input type="number" id="cw" value="1080" min="16" max="8000"> <span>×</span>
        <input type="number" id="ch" value="1080" min="16" max="8000"> <span>px</span>
        <button class="btn primary" id="newCustom">Create custom size</button>
      </div>
    </section>
    <section class="home-section">
      <h2>Start a new design</h2>
      <div class="presets">
        ${SIZE_PRESETS.map(
          (p, i) => `
          <button class="preset" data-i="${i}">
            <div class="preset-shape"><div style="aspect-ratio:${p.w}/${p.h}"></div></div>
            <b>${p.name}</b><small>${p.w} × ${p.h} px</small>
          </button>`
        ).join('')}
      </div>
    </section>
    <section class="home-section">
      <h2>Start from a template</h2>
      <div class="tpl-row">
        ${TEMPLATES.map((t, i) => `<button class="tpl-card" data-t="${i}"><img alt="${esc(t.name)}" data-tplthumb="${i}"><span>${esc(t.name)}</span></button>`).join('')}
      </div>
    </section>
    <section class="home-section">
      <h2>Your designs ${designs.length ? `<small>(${designs.length})</small>` : ''}</h2>
      ${
        designs.length
          ? `<div class="designs">${designs
              .map(
                (d) => `
            <div class="design-card" data-id="${d.id}">
              <div class="thumb">${d.pages?.[0]?.thumb ? `<img src="${d.pages[0].thumb}" alt="">` : ''}</div>
              <div class="meta"><b>${esc(d.name || 'Untitled')}</b><small>${d.width}×${d.height} · ${d.pages?.length || 1} page(s) · ${new Date(d.updatedAt).toLocaleString()}</small></div>
              <div class="card-actions">
                <button class="icon-btn" data-dup="${d.id}" title="Duplicate">${icon('copy')}</button>
                <button class="icon-btn danger" data-del="${d.id}" title="Delete">${icon('trash')}</button>
              </div>
            </div>`
              )
              .join('')}</div>`
          : `<p class="muted">No designs yet. Pick a size above to get started — your work is saved automatically in this browser.</p>`
      }
    </section>
    <footer class="home-foot">Artvas · Designs are stored privately in your browser.</footer>
  </div>`;

  $$('.preset').forEach((b) =>
    b.addEventListener('click', () => {
      const p = SIZE_PRESETS[+b.dataset.i];
      newDesign(p.w, p.h, p.name);
    })
  );
  const custom = () => {
    const w = Math.max(16, Math.min(8000, +$('#cw').value || 1080));
    const h = Math.max(16, Math.min(8000, +$('#ch').value || 1080));
    newDesign(w, h, 'Custom design');
  };
  $('#newCustom').onclick = custom;
  $('#newCustomTop').onclick = () => newDesign(1080, 1080, 'Instagram Post');
  $('#openFile').onchange = (e) => importDesignFile(e.target.files[0]);
  $$('[data-t]').forEach((b) =>
    b.addEventListener('click', () => newDesign(1080, 1080, TEMPLATES[+b.dataset.t].name, +b.dataset.t))
  );
  $$('.design-card').forEach((c) =>
    c.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openDesign(c.dataset.id);
    })
  );
  $$('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Delete this design permanently?')) return;
      await deleteDesign(b.dataset.del);
      renderHome();
    })
  );
  $$('[data-dup]').forEach((b) =>
    b.addEventListener('click', async () => {
      const d = await getDesign(b.dataset.dup);
      await saveDesign({ ...d, id: uid(), name: `${d.name} (copy)`, updatedAt: Date.now() });
      renderHome();
    })
  );
  // template thumbnails
  await fontsReady;
  for (let i = 0; i < TEMPLATES.length; i++) {
    const img = $(`[data-tplthumb="${i}"]`);
    if (img) img.src = await templateThumb(i, 1080, 1080, 260);
  }
}

function logoSvg() {
  return `<svg viewBox="0 0 64 64" width="30" height="30"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M20 46 32 16l12 30M24.5 36h15" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function blankPage() {
  return { id: uid(), json: null, thumb: '' };
}

async function newDesign(w, h, name, templateIndex) {
  const design = { id: uid(), name: name || 'Untitled design', width: w, height: h, pages: [blankPage()], updatedAt: Date.now() };
  await openEditor(design);
  if (templateIndex != null) await applyTemplate(templateIndex);
  await persist();
}

async function openDesign(id) {
  const d = await getDesign(id);
  if (!d) return renderHome();
  openEditor(d);
}

async function importDesignFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.pages || !data.width) throw new Error('bad');
    data.id = uid();
    data.updatedAt = Date.now();
    await saveDesign(data);
    openEditor(data);
  } catch {
    toast('That file is not a valid Artvas design');
  }
}

// =====================================================
// EDITOR
// =====================================================
async function openEditor(design) {
  state.design = design;
  state.page = 0;
  state.lastVersionAt = 0;
  history.replaceState(null, '', `/design/${design.id}`);
  app.innerHTML = editorHTML();
  bindTopbar();
  bindTabs();

  const el = $('#c');
  state.canvas = new Canvas(el, {
    preserveObjectStacking: true,
    backgroundColor: '#ffffff',
    selectionColor: 'rgba(124,58,237,0.08)',
    selectionBorderColor: '#7c3aed',
    stopContextMenu: true,
    fireRightClick: true,
  });
  styleControls();
  bindCanvasEvents();
  bindKeyboard();
  window.addEventListener('resize', fitZoom);

  await fontsReady;
  await loadPage(0);
  fitZoom();
  renderTab();
  renderProps();
  renderPages();
}

function editorHTML() {
  const d = state.design;
  const tabs = [
    ['templates', 'layout', 'Templates'],
    ['text', 'type', 'Text'],
    ['elements', 'shapes', 'Elements'],
    ['uploads', 'upload', 'Uploads'],
    ['photos', 'image', 'Photos'],
    ['draw', 'pen', 'Draw'],
    ['background', 'palette', 'Background'],
    ['animate', 'play', 'Animate'],
    ['brand', 'brand', 'Brand Kit'],
    ['layers', 'layers', 'Layers'],
  ];
  return `
  <div class="editor">
    <header class="topbar">
      <button class="icon-btn light" id="goHome" title="Home">${icon('home')}</button>
      <div class="logo small">${logoSvg()}<span>Artvas</span></div>
      <div class="sep"></div>
      <button class="icon-btn light" id="undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
      <button class="icon-btn light" id="redo" title="Redo (Ctrl+Y)">${icon('redo')}</button>
      <button class="tb-btn" id="resizeBtn">${icon('resize')} Resize</button>
      <button class="tb-btn" id="historyBtn" title="Version history">${icon('clock')} History</button>
      <span class="save-status" id="saveStatus">Saved</span>
      <input class="title-input" id="title" value="${esc(d.name)}" spellcheck="false">
      <div class="spacer"></div>
      <span class="dim-label">${d.width} × ${d.height}px</span>
      <button class="tb-btn" id="saveFile" title="Download editable .json file">${icon('save')} Save file</button>
      <div class="dropdown">
        <button class="btn primary" id="shareBtn">${icon('download')} Download</button>
        <div class="menu" id="exportMenu" hidden>
          <label>File type
            <select id="exFormat">
              <option value="png">PNG (best quality)</option>
              <option value="jpg">JPG (small file)</option>
              <option value="pdf">PDF (all pages)</option>
              <option value="svg">SVG (vector)</option>
              <option value="gif">GIF (animated)</option>
              <option value="video">Video MP4/WebM (animated)</option>
              <option value="json">Artvas project (.json)</option>
            </select>
          </label>
          <label>Size <select id="exScale"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option></select></label>
          <label>Pages <select id="exPages"><option value="current">Current page</option><option value="all">All pages</option></select></label>
          <label class="row"><input type="checkbox" id="exTransparent"> Transparent background (PNG)</label>
          <button class="btn primary block" id="doExport">Download</button>
        </div>
      </div>
    </header>
    <div class="main">
      <nav class="tabs">
        ${tabs.map(([id, ic, label]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}
      </nav>
      <aside class="panel" id="panel"></aside>
      <section class="workspace">
        <div class="ctx-bar" id="ctxBar"></div>
        <div class="stage" id="stage">
          <div class="canvas-holder" id="holder"><canvas id="c"></canvas></div>
        </div>
        <div class="bottom-bar">
          <div class="pages" id="pages"></div>
          <div class="zoom">
            <button class="icon-btn" id="zoomOut" title="Zoom out">${icon('minus')}</button>
            <input type="range" id="zoomRange" min="5" max="400" value="100">
            <button class="icon-btn" id="zoomIn" title="Zoom in">${icon('plus')}</button>
            <button class="tb-btn small" id="zoomFit" title="Fit to screen"><span id="zoomLabel">100%</span></button>
          </div>
        </div>
      </section>
      <aside class="props" id="props"></aside>
    </div>
    <div class="ctxmenu" id="ctxMenu" hidden></div>
    <input type="file" id="fileUpload" accept="image/*" multiple hidden>
  </div>`;
}

function styleControls() {
  // Nicer selection handles for every object
  InteractiveFabricObject.ownDefaults = {
    ...InteractiveFabricObject.ownDefaults,
    cornerStyle: 'circle',
    cornerColor: '#ffffff',
    cornerStrokeColor: '#7c3aed',
    borderColor: '#7c3aed',
    cornerSize: 12,
    transparentCorners: false,
    borderScaleFactor: 1.5,
    padding: 2,
  };
}

// ---------- Topbar ----------
function bindTopbar() {
  $('#goHome').onclick = async () => {
    await persist();
    renderHome();
  };
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  $('#title').oninput = (e) => {
    state.design.name = e.target.value || 'Untitled design';
    schedulePersist();
  };
  $('#saveFile').onclick = () => exportDesign('json');
  $('#shareBtn').onclick = (e) => {
    e.stopPropagation();
    $('#exportMenu').hidden = !$('#exportMenu').hidden;
  };
  $('#exportMenu').onclick = (e) => e.stopPropagation();
  document.addEventListener('click', () => {
    const m = $('#exportMenu');
    if (m) m.hidden = true;
    hideContextMenu();
  });
  $('#doExport').onclick = async () => {
    const fmt = $('#exFormat').value;
    $('#doExport').disabled = true;
    $('#doExport').textContent = 'Preparing…';
    try {
      await exportDesign(fmt, {
        scale: +$('#exScale').value,
        all: $('#exPages').value === 'all',
        transparent: $('#exTransparent').checked,
      });
    } catch (err) {
      console.error(err);
      toast('Export failed: ' + err.message);
    }
    $('#doExport').disabled = false;
    $('#doExport').textContent = 'Download';
    $('#exportMenu').hidden = true;
  };
  $('#resizeBtn').onclick = openResizeDialog;
  $('#historyBtn').onclick = openHistoryDialog;
  $('#zoomIn').onclick = () => setZoom(state.zoom * 1.2);
  $('#zoomOut').onclick = () => setZoom(state.zoom / 1.2);
  $('#zoomFit').onclick = fitZoom;
  $('#zoomRange').oninput = (e) => setZoom(+e.target.value / 100);
  $('#stage').addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    },
    { passive: false }
  );
  // drag & drop images onto stage
  const stage = $('#stage');
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) handleUploads(files, true);
    const url = e.dataTransfer?.getData('text/artvas-img');
    if (url) addImage(url);
  });
  $('#fileUpload').onchange = (e) => {
    handleUploads([...e.target.files], true);
    e.target.value = '';
  };
  // paste images from clipboard
  document.addEventListener('paste', (e) => {
    if (!state.canvas || isTyping()) return;
    const items = [...(e.clipboardData?.items || [])];
    const imgs = items.filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile());
    if (imgs.length) {
      e.preventDefault();
      handleUploads(imgs, true);
    }
  });
}

// ---------- Zoom ----------
function setZoom(z) {
  const c = state.canvas;
  if (!c) return;
  z = Math.max(0.05, Math.min(4, z));
  state.zoom = z;
  const { width, height } = state.design;
  c.setDimensions({ width: Math.round(width * z), height: Math.round(height * z) });
  c.setZoom(z);
  c.requestRenderAll();
  $('#zoomLabel').textContent = Math.round(z * 100) + '%';
  $('#zoomRange').value = Math.round(z * 100);
}

function fitZoom() {
  const stage = $('#stage');
  if (!stage || !state.design) return;
  const pad = 64;
  const z = Math.min((stage.clientWidth - pad) / state.design.width, (stage.clientHeight - pad) / state.design.height);
  state.fitZoom = z;
  setZoom(z);
}

// ---------- Canvas events ----------
function bindCanvasEvents() {
  const c = state.canvas;
  const onChange = () => {
    if (state.loading) return;
    pushHistory();
    schedulePersist();
    renderLayersIfOpen();
  };
  c.on('object:added', onChange);
  c.on('object:removed', onChange);
  c.on('object:modified', () => {
    onChange();
    renderProps();
  });
  c.on('path:created', (e) => {
    if (state.drawing.eraser && e.path) {
      e.path.set({ globalCompositeOperation: 'destination-out', name: 'Eraser' });
    } else e.path?.set({ name: 'Drawing' });
  });
  c.on('text:changed', () => schedulePersist());
  c.on('text:editing:exited', onChange);
  const onSel = () => {
    renderProps();
    if (state.tab === 'animate') renderTab();
  };
  c.on('selection:created', onSel);
  c.on('selection:updated', onSel);
  c.on('selection:cleared', onSel);

  // Smart guides: snap to page center and edges
  let guides = [];
  c.on('object:moving', (e) => {
    const o = e.target;
    const { width: W, height: H } = state.design;
    const tol = 8 / state.zoom;
    guides = [];
    const br = o.getBoundingRect();
    // Bounding rect in v6 is in scene coords (design units)
    const cx = br.left + br.width / 2;
    const cy = br.top + br.height / 2;
    let dx = 0;
    let dy = 0;
    const xs = [
      [cx, W / 2],
      [br.left, 0],
      [br.left + br.width, W],
    ];
    const ys = [
      [cy, H / 2],
      [br.top, 0],
      [br.top + br.height, H],
    ];
    for (const [v, t] of xs) if (!dx && Math.abs(v - t) < tol) { dx = t - v; guides.push({ x: t }); }
    for (const [v, t] of ys) if (!dy && Math.abs(v - t) < tol) { dy = t - v; guides.push({ y: t }); }
    if (dx || dy) {
      o.set({ left: o.left + dx, top: o.top + dy });
      o.setCoords();
    }
  });
  c.on('mouse:up', () => {
    if (guides.length) {
      guides = [];
      c.requestRenderAll();
    }
  });
  c.on('after:render', () => {
    if (!guides.length) return;
    const ctx = c.contextTop;
    c.clearContext(ctx);
    ctx.save();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const z = state.zoom;
    for (const g of guides) {
      ctx.beginPath();
      if (g.x != null) {
        ctx.moveTo(g.x * z + 0.5, 0);
        ctx.lineTo(g.x * z + 0.5, c.height);
      } else {
        ctx.moveTo(0, g.y * z + 0.5);
        ctx.lineTo(c.width, g.y * z + 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
  });

  // Right-click context menu
  c.on('mouse:down', (e) => {
    if (e.e.button === 2) {
      if (e.target && !c.getActiveObjects().includes(e.target)) c.setActiveObject(e.target);
      c.requestRenderAll();
      showContextMenu(e.e.clientX, e.e.clientY);
    }
  });
  c.on('mouse:dblclick', (e) => {
    const t = e.target;
    if (t && t.type === 'group' && !t.locked) {
      // double click a group -> ungroup for quick editing
    }
  });
}

function showContextMenu(x, y) {
  const m = $('#ctxMenu');
  const has = !!state.canvas.getActiveObject();
  const items = has
    ? [
        ['copy', 'Copy', 'Ctrl+C'], ['paste', 'Paste', 'Ctrl+V'], ['duplicate', 'Duplicate', 'Ctrl+D'],
        ['delete', 'Delete', 'Del'], ['-'], ['front', 'Bring to front', ''], ['forward', 'Bring forward', ''],
        ['backward', 'Send backward', ''], ['back', 'Send to back', ''], ['-'], ['group', 'Group', 'Ctrl+G'],
        ['ungroup', 'Ungroup', 'Ctrl+Shift+G'], ['lock', 'Lock / Unlock', ''], ['-'], ['setbg', 'Set image as background', ''],
      ]
    : [['paste', 'Paste', 'Ctrl+V'], ['selectall', 'Select all', 'Ctrl+A']];
  m.innerHTML = items
    .map((i) => (i[0] === '-' ? '<hr>' : `<button data-act="${i[0]}"><span>${i[1]}</span><kbd>${i[2]}</kbd></button>`))
    .join('');
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  $$('button', m).forEach((b) => (b.onclick = () => { hideContextMenu(); runAction(b.dataset.act); }));
}
function hideContextMenu() {
  const m = $('#ctxMenu');
  if (m) m.hidden = true;
}

// ---------- Actions ----------
async function runAction(act) {
  const c = state.canvas;
  const obj = c.getActiveObject();
  switch (act) {
    case 'copy': return copy();
    case 'paste': return paste();
    case 'duplicate': return duplicate();
    case 'delete': return removeSelected();
    case 'front': obj && c.bringObjectToFront(obj); break;
    case 'back': obj && c.sendObjectToBack(obj); break;
    case 'forward': obj && c.bringObjectForward(obj); break;
    case 'backward': obj && c.sendObjectBackwards(obj); break;
    case 'group': return groupSelected();
    case 'ungroup': return ungroupSelected();
    case 'lock': return toggleLock();
    case 'selectall': return selectAll();
    case 'setbg': return setSelectedAsBackground();
  }
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderLayersIfOpen();
}

async function copy() {
  const o = state.canvas.getActiveObject();
  if (!o) return;
  state.clipboard = await o.clone(PROPS);
  toast('Copied');
}

async function paste() {
  if (!state.clipboard) return;
  const c = state.canvas;
  const clone = await state.clipboard.clone(PROPS);
  c.discardActiveObject();
  clone.set({ left: clone.left + 20, top: clone.top + 20, evented: true });
  if (clone instanceof ActiveSelection) {
    clone.canvas = c;
    clone.forEachObject((o) => c.add(o));
    clone.setCoords();
  } else c.add(clone);
  state.clipboard.top += 20;
  state.clipboard.left += 20;
  c.setActiveObject(clone);
  c.requestRenderAll();
}

async function duplicate() {
  await copy();
  await paste();
}

function removeSelected() {
  const c = state.canvas;
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  const active = c.getActiveObject();
  if (active?.isEditing) return;
  c.discardActiveObject();
  state.loading = true;
  objs.forEach((o) => c.remove(o));
  state.loading = false;
  pushHistory();
  schedulePersist();
  c.requestRenderAll();
  renderLayersIfOpen();
}

function selectAll() {
  const c = state.canvas;
  c.discardActiveObject();
  const objs = c.getObjects().filter((o) => o.selectable !== false);
  if (!objs.length) return;
  c.setActiveObject(objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: c }));
  c.requestRenderAll();
}

function groupSelected() {
  const c = state.canvas;
  const sel = c.getActiveObject();
  if (!(sel instanceof ActiveSelection)) return;
  const objs = sel.getObjects();
  c.discardActiveObject();
  state.loading = true;
  objs.forEach((o) => c.remove(o));
  const g = new Group(objs, { name: 'Group' });
  c.add(g);
  state.loading = false;
  c.setActiveObject(g);
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderLayersIfOpen();
}

function ungroupSelected() {
  const c = state.canvas;
  const g = c.getActiveObject();
  if (!g || g.type !== 'group') return;
  state.loading = true;
  const idx = c.getObjects().indexOf(g);
  const objs = g.removeAll();
  c.remove(g);
  objs.forEach((o, i) => c.insertAt(idx + i, o));
  state.loading = false;
  c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderLayersIfOpen();
}

function setLocked(o, locked) {
  o.set({
    locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockRotation: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    hasControls: !locked,
  });
  if (o.isType?.('textbox', 'i-text')) o.editable = !locked;
}

function toggleLock() {
  const c = state.canvas;
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  const lock = !objs[0].locked;
  objs.forEach((o) => setLocked(o, lock));
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
  renderLayersIfOpen();
  toast(lock ? 'Locked' : 'Unlocked');
}

async function setSelectedAsBackground() {
  const o = state.canvas.getActiveObject();
  if (!o || o.type !== 'image') return toast('Select an image first');
  const src = o.getSrc();
  state.canvas.remove(o);
  await setBackgroundImage(src);
}

// ---------- Keyboard ----------
function isTyping() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) {
    // fabric uses a hidden textarea when editing text
    return true;
  }
  return !!state.canvas?.getActiveObject()?.isEditing;
}

let keyBound = false;
function bindKeyboard() {
  if (keyBound) return;
  keyBound = true;
  document.addEventListener('keydown', (e) => {
    if (!state.canvas) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') {
      e.preventDefault();
      persist().then(() => toast('Saved'));
      return;
    }
    if (isTyping()) return;
    const c = state.canvas;
    const obj = c.getActiveObject();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) { e.preventDefault(); redo(); }
    else if (mod && k === 'c') { e.preventDefault(); copy(); }
    else if (mod && k === 'x') { e.preventDefault(); copy().then(removeSelected); }
    else if (mod && k === 'v') { if (state.clipboard) { e.preventDefault(); paste(); } }
    else if (mod && k === 'd') { e.preventDefault(); duplicate(); }
    else if (mod && k === 'a') { e.preventDefault(); selectAll(); }
    else if (mod && k === 'g' && e.shiftKey) { e.preventDefault(); ungroupSelected(); }
    else if (mod && k === 'g') { e.preventDefault(); groupSelected(); }
    else if (mod && (k === '=' || k === '+')) { e.preventDefault(); setZoom(state.zoom * 1.2); }
    else if (mod && k === '-') { e.preventDefault(); setZoom(state.zoom / 1.2); }
    else if (mod && k === '0') { e.preventDefault(); fitZoom(); }
    else if (k === 'delete' || k === 'backspace') { if (obj) { e.preventDefault(); removeSelected(); } }
    else if (k === 'escape') { c.discardActiveObject(); c.requestRenderAll(); }
    else if (k.startsWith('arrow') && obj && !obj.locked) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (k === 'arrowleft') obj.left -= step;
      if (k === 'arrowright') obj.left += step;
      if (k === 'arrowup') obj.top -= step;
      if (k === 'arrowdown') obj.top += step;
      obj.setCoords();
      c.requestRenderAll();
      clearTimeout(bindKeyboard._t);
      bindKeyboard._t = setTimeout(() => { pushHistory(); schedulePersist(); }, 300);
    } else if (!mod && k === 't') addText({ text: 'Your text here', size: 0.06, weight: '600' });
    else if (!mod && k === 'r') addShape('rect');
    else if (!mod && k === 'c') addShape('circle');
  });
}

// ---------- History ----------
function snapshot() {
  return JSON.stringify(state.canvas.toObject(PROPS));
}
function pushHistory() {
  if (state.loading || !state.canvas) return;
  const s = snapshot();
  if (state.history[state.history.length - 1] === s) return;
  state.history.push(s);
  if (state.history.length > 80) state.history.shift();
  state.redo = [];
  updateUndoButtons();
}
async function restore(json) {
  state.loading = true;
  const c = state.canvas;
  c.discardActiveObject();
  await c.loadFromJSON(JSON.parse(json));
  c.requestRenderAll();
  state.loading = false;
  renderProps();
  renderLayersIfOpen();
  schedulePersist();
}
async function undo() {
  if (state.history.length < 2) return;
  state.redo.push(state.history.pop());
  await restore(state.history[state.history.length - 1]);
  updateUndoButtons();
}
async function redo() {
  const s = state.redo.pop();
  if (!s) return;
  state.history.push(s);
  await restore(s);
  updateUndoButtons();
}
function updateUndoButtons() {
  const u = $('#undo');
  const r = $('#redo');
  if (u) u.disabled = state.history.length < 2;
  if (r) r.disabled = !state.redo.length;
}

// ---------- Persist ----------
let persistTimer;
function schedulePersist() {
  const s = $('#saveStatus');
  if (s) s.textContent = 'Saving…';
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 700);
}
function captureCurrentPage() {
  const d = state.design;
  const c = state.canvas;
  if (!d || !c) return;
  const page = d.pages[state.page];
  page.json = c.toObject(PROPS);
  try {
    page.thumb = c.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 240 / (d.width * state.zoom) });
  } catch {
    // tainted canvas (cross-origin image without CORS)
    page.thumb = '';
  }
}
async function persist() {
  clearTimeout(persistTimer);
  if (!state.design || !state.canvas) return;
  captureCurrentPage();
  state.design.updatedAt = Date.now();
  try {
    await saveDesign(state.design);
    const s = $('#saveStatus');
    if (s) s.textContent = 'Saved';
    maybeAutoVersion();
  } catch (e) {
    console.error(e);
    const s = $('#saveStatus');
    if (s) s.textContent = 'Not saved';
  }
  updatePageThumb(state.page);
}

// ---------- Pages ----------
async function loadPage(i) {
  const c = state.canvas;
  state.page = i;
  state.loading = true;
  c.discardActiveObject();
  c.clear();
  c.backgroundColor = '#ffffff';
  const json = state.design.pages[i].json;
  if (json) await c.loadFromJSON(json);
  c.requestRenderAll();
  state.loading = false;
  state.history = [snapshot()];
  state.redo = [];
  updateUndoButtons();
  renderProps();
  renderLayersIfOpen();
}

async function switchPage(i) {
  if (i === state.page) return;
  captureCurrentPage();
  await loadPage(i);
  renderPages();
}

function renderPages() {
  const el = $('#pages');
  if (!el) return;
  const d = state.design;
  el.innerHTML =
    d.pages
      .map(
        (p, i) => `
    <div class="page-thumb ${i === state.page ? 'active' : ''}" data-p="${i}" style="aspect-ratio:${d.width}/${d.height}">
      ${p.thumb ? `<img src="${p.thumb}" alt="">` : ''}
      <span class="pnum">${i + 1}</span>
      <div class="page-acts">
        <button data-pact="up" title="Move left">${icon('chevLeft')}</button>
        <button data-pact="down" title="Move right">${icon('chevRight')}</button>
        <button data-pact="dup" title="Duplicate page">${icon('copy')}</button>
        <button data-pact="del" title="Delete page">${icon('trash')}</button>
      </div>
    </div>`
      )
      .join('') + `<button class="add-page" id="addPage" title="Add page">${icon('plus')}</button>`;
  $$('.page-thumb', el).forEach((t) =>
    t.addEventListener('click', async (e) => {
      const i = +t.dataset.p;
      const act = e.target.closest('[data-pact]')?.dataset.pact;
      if (!act) return switchPage(i);
      captureCurrentPage();
      if (act === 'dup') {
        d.pages.splice(i + 1, 0, { id: uid(), json: structuredClone(d.pages[i].json), thumb: d.pages[i].thumb });
        await loadPage(i + 1);
      } else if (act === 'del') {
        if (d.pages.length === 1) return toast('A design needs at least one page');
        if (!confirm(`Delete page ${i + 1}?`)) return;
        d.pages.splice(i, 1);
        await loadPage(Math.min(i, d.pages.length - 1));
      } else if (act === 'up' && i > 0) {
        [d.pages[i - 1], d.pages[i]] = [d.pages[i], d.pages[i - 1]];
        await loadPage(i - 1);
      } else if (act === 'down' && i < d.pages.length - 1) {
        [d.pages[i + 1], d.pages[i]] = [d.pages[i], d.pages[i + 1]];
        await loadPage(i + 1);
      }
      renderPages();
      persist();
    })
  );
  $('#addPage').onclick = async () => {
    captureCurrentPage();
    d.pages.splice(state.page + 1, 0, blankPage());
    await loadPage(state.page + 1);
    renderPages();
    persist();
  };
}
function updatePageThumb(i) {
  const t = $(`.page-thumb[data-p="${i}"]`);
  const p = state.design?.pages[i];
  if (!t || !p) return;
  let img = $('img', t);
  if (!p.thumb) return img?.remove();
  if (!img) {
    img = document.createElement('img');
    t.prepend(img);
  }
  img.src = p.thumb;
}

// =====================================================
// ADDING CONTENT
// =====================================================
function place(obj, { center = true } = {}) {
  const c = state.canvas;
  const { width: W, height: H } = state.design;
  if (center) {
    obj.set({ originX: 'center', originY: 'center', left: W / 2, top: H / 2 });
  }
  obj.setCoords();
  c.add(obj);
  c.setActiveObject(obj);
  c.requestRenderAll();
  renderProps();
  return obj;
}

const minSide = () => Math.min(state.design.width, state.design.height);

async function addText(p) {
  await ensureFont(p.font || 'Inter', p.weight || '400');
  const m = minSide();
  const t = new Textbox(p.text, {
    fontFamily: p.font || 'Inter',
    fontSize: Math.round((p.size || 0.06) * m),
    fontWeight: p.weight || 'normal',
    fill: p.color || '#111827',
    textAlign: 'center',
    width: Math.min(state.design.width * 0.85, Math.max(200, p.text.length * (p.size || 0.06) * m * 0.62)),
    lineHeight: 1.1,
    charSpacing: p.charSpacing || 0,
    textBackgroundColor: p.bg || '',
    stroke: p.stroke || null,
    strokeWidth: p.stroke ? Math.max(2, m * 0.004) : 0,
    paintFirst: 'stroke',
    shadow: p.glow ? new Shadow({ color: p.glow, blur: m * 0.03, offsetX: 0, offsetY: 0 }) : null,
    name: 'Text',
  });
  return place(t);
}

function addShape(id) {
  const o = createShape(id, minSide() * 0.3, id.includes('line') || id === 'dashed' ? '#111827' : '#7c3aed');
  return place(o);
}

function addSticker(ch) {
  const m = minSide();
  const t = new Textbox(ch, { fontSize: m * 0.18, width: m * 0.25, textAlign: 'center', name: 'Sticker', fontFamily: 'Inter' });
  return place(t);
}

async function addImage(src, opts = {}) {
  try {
    const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
    const { width: W, height: H } = state.design;
    const s = Math.min((W * 0.6) / img.width, (H * 0.6) / img.height, 1.5);
    img.scale(s);
    img.set({ name: opts.name || 'Image' });
    return place(img);
  } catch (e) {
    console.error(e);
    toast('Could not load image');
  }
}

async function setBackgroundImage(src) {
  const c = state.canvas;
  const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
  const { width: W, height: H } = state.design;
  const s = Math.max(W / img.width, H / img.height);
  img.set({ scaleX: s, scaleY: s, originX: 'center', originY: 'center', left: W / 2, top: H / 2 });
  c.backgroundImage = img;
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderTab();
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Downscale very large images so designs stay light.
async function shrinkDataURL(url, max = 2400) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  if (img.width <= max && img.height <= max) return url;
  const s = max / Math.max(img.width, img.height);
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * s);
  cv.height = Math.round(img.height * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL(url.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 0.9);
}

async function handleUploads(files, addToCanvas) {
  for (const f of files) {
    if (!f) continue;
    let url = await fileToDataURL(f);
    if (!f.type.includes('svg')) url = await shrinkDataURL(url);
    state.uploads.unshift(url);
    if (addToCanvas) await addImage(url, { name: f.name?.replace(/\.[^.]+$/, '') || 'Image' });
  }
  saveUploads();
  if (state.tab === 'uploads') renderTab();
}
function saveUploads() {
  try {
    localStorage.setItem('artvas-uploads', JSON.stringify(state.uploads.slice(0, 30)));
  } catch {
    // quota exceeded: keep only a few
    try { localStorage.setItem('artvas-uploads', JSON.stringify(state.uploads.slice(0, 5))); } catch {}
  }
}
try { state.uploads = JSON.parse(localStorage.getItem('artvas-uploads') || '[]'); } catch {}

async function applyTemplate(i) {
  const tpl = TEMPLATES[i];
  const c = state.canvas;
  const { width: W, height: H } = state.design;
  const hasContent = c.getObjects().length > 0;
  if (hasContent && !confirm('Replace the current page with this template?')) return;
  await fontsReady;
  state.loading = true;
  c.clear();
  c.backgroundImage = null;
  setBackgroundFill(tpl.bg, false);
  buildTemplate(tpl, W, H).forEach((o) => c.add(o));
  state.loading = false;
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderLayersIfOpen();
}

function setBackgroundFill(bg, record = true) {
  const c = state.canvas;
  const { width: W, height: H } = state.design;
  if (bg.gradient) {
    c.backgroundColor = makeGradient(bg.gradient, W, H, bg.angle ?? 135);
    c.bgGradient = { colors: bg.gradient, angle: bg.angle ?? 135 };
  } else {
    c.backgroundColor = bg.color;
    c.bgGradient = null;
  }
  c.requestRenderAll();
  if (record) {
    pushHistory();
    schedulePersist();
  }
}

async function templateThumb(i, W, H, size) {
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: W, height: H, enableRetinaScaling: false, renderOnAddRemove: false });
  const tpl = TEMPLATES[i];
  sc.backgroundColor = tpl.bg.gradient ? makeGradient(tpl.bg.gradient, W, H, tpl.bg.angle ?? 135) : tpl.bg.color;
  buildTemplate(tpl, W, H).forEach((o) => sc.add(o));
  sc.renderAll();
  const url = sc.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: size / W });
  sc.dispose();
  return url;
}

// =====================================================
// LEFT PANEL TABS
// =====================================================
function bindTabs() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      state.tab = t.dataset.tab;
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#panel').classList.remove('collapsed');
      renderTab();
    })
  );
}

function renderLayersIfOpen() {
  if (state.tab === 'layers') renderTab();
}

function renderTab() {
  const p = $('#panel');
  if (!p) return;
  if (state.tab !== 'draw' && state.canvas?.isDrawingMode) {
    state.canvas.isDrawingMode = false;
    state.drawing.on = false;
  }
  const map = { templates: tabTemplates, text: tabText, elements: tabElements, uploads: tabUploads, photos: tabPhotos, draw: tabDraw, background: tabBackground, animate: tabAnimate, brand: tabBrand, layers: tabLayers };
  map[state.tab]?.(p);
}

async function tabTemplates(p) {
  p.innerHTML = `<h3>Templates</h3>
    <input class="search" id="tplSearch" placeholder="Search ${TEMPLATES.length} templates…">
    <div class="chips">${TEMPLATE_CATS.map((c) => `<button class="chip ${state.tplCat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
    <div class="tpl-grid">${TEMPLATES.map(
      (t, i) => `<button class="tpl-card" data-ti="${i}" data-name="${esc(t.name.toLowerCase())} ${t.cat.toLowerCase()}" data-tcat="${t.cat}"><img data-tthumb="${i}" alt=""><span>${esc(t.name)}</span></button>`
    ).join('')}</div>`;
  const filter = () => {
    const q = $('#tplSearch', p).value.toLowerCase();
    $$('[data-ti]', p).forEach((b) => {
      const ok = (state.tplCat === 'All' || b.dataset.tcat === state.tplCat) && b.dataset.name.includes(q);
      b.style.display = ok ? '' : 'none';
    });
  };
  $('#tplSearch', p).oninput = filter;
  $$('[data-cat]', p).forEach(
    (b) =>
      (b.onclick = () => {
        state.tplCat = b.dataset.cat;
        $$('[data-cat]', p).forEach((x) => x.classList.toggle('on', x === b));
        filter();
      })
  );
  filter();
  $$('[data-ti]', p).forEach((b) => (b.onclick = () => applyTemplate(+b.dataset.ti)));
  const { width: W, height: H } = state.design;
  for (let i = 0; i < TEMPLATES.length; i++) {
    const img = $(`[data-tthumb="${i}"]`, p);
    if (!img || !img.isConnected) return;
    img.style.aspectRatio = `${W}/${H}`;
    img.src = await templateThumb(i, W, H, 200);
  }
}

function tabText(p) {
  p.innerHTML = `
    <h3>Text</h3>
    <button class="btn primary block" id="addTextBox">${icon('type')} Add a text box</button>
    <div class="text-presets">
      ${TEXT_PRESETS.map((t, i) => `<button class="text-preset" data-tp="${i}" style="font-weight:${t.weight};font-size:${[26, 18, 13][i]}px">${t.label}</button>`).join('')}
    </div>
    <h4>Font combinations</h4>
    <div class="combo-grid">
      ${TEXT_COMBOS.map(
        (t, i) => `<button class="combo" data-tc="${i}" style="font-family:'${t.font}';color:${t.color === 'transparent' ? '#fff' : t.color};${t.stroke ? `-webkit-text-stroke:1px ${t.stroke};` : ''}${t.bg ? `background:${t.bg};` : ''}${t.glow ? `text-shadow:0 0 8px ${t.glow};background:#1f1235;` : ''}letter-spacing:${(t.charSpacing || 0) / 1000}em">${esc(t.text)}</button>`
      ).join('')}
    </div>
    <h4>Fonts</h4>
    <div class="font-list">${FONTS.map((f) => `<button class="font-item" data-font="${esc(f)}" style="font-family:'${f}'">${esc(f)}</button>`).join('')}</div>`;
  $('#addTextBox').onclick = () => addText({ text: 'Your text here', size: 0.06, weight: '600' });
  $$('[data-tp]', p).forEach((b) => (b.onclick = () => addText(TEXT_PRESETS[+b.dataset.tp])));
  $$('[data-tc]', p).forEach((b) => (b.onclick = () => addText(TEXT_COMBOS[+b.dataset.tc])));
  $$('[data-font]', p).forEach(
    (b) =>
      (b.onclick = async () => {
        const o = state.canvas.getActiveObject();
        if (o && isText(o)) return setTextProp('fontFamily', b.dataset.font);
        addText({ text: b.dataset.font, font: b.dataset.font, size: 0.07 });
      })
  );
}

function tabElements(p) {
  p.innerHTML = `
    <h3>Elements</h3>
    <input class="search" id="elSearch" placeholder="Search shapes & stickers…">
    <h4>Shapes & lines</h4>
    <div class="shape-grid">${SHAPES.map((s) => `<button class="shape-item" data-shape="${s.id}" title="${s.label}">${shapePreview(s.id)}<small>${s.label}</small></button>`).join('')}</div>
    <h4>Frames <small class="muted">(select an image, then pick a frame)</small></h4>
    <div class="shape-grid">
      ${['none', 'circle', 'rounded', 'star', 'heart', 'hexagon'].map((f) => `<button class="shape-item" data-frame="${f}">${f === 'none' ? icon('x') : shapePreview(f)}<small>${f === 'none' ? 'No frame' : f}</small></button>`).join('')}
    </div>
    <h4>Stickers</h4>
    <div class="sticker-grid">${STICKERS.map((s) => `<button class="sticker" data-st="${s}">${s}</button>`).join('')}</div>`;
  $$('[data-shape]', p).forEach((b) => (b.onclick = () => addShape(b.dataset.shape)));
  $$('[data-st]', p).forEach((b) => (b.onclick = () => addSticker(b.dataset.st)));
  $$('[data-frame]', p).forEach((b) => (b.onclick = () => applyFrame(b.dataset.frame)));
  $('#elSearch').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    $$('.shape-item', p).forEach((b) => (b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'));
  };
}

function shapePreview(id) {
  const P = {
    rect: '<rect x="4" y="4" width="32" height="32"/>',
    rounded: '<rect x="4" y="4" width="32" height="32" rx="7"/>',
    circle: '<circle cx="20" cy="20" r="16"/>',
    triangle: '<path d="M20 5 36 35H4Z"/>',
    star: '<path d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>',
    burst: '<path d="M20 2l3 7 7-3-1 7 7 2-5 5 5 5-7 2 1 7-7-3-3 7-3-7-7 3 1-7-7-2 5-5-5-5 7-2-1-7 7 3z"/>',
    pentagon: '<path d="M20 4 36 16 30 35H10L4 16Z"/>',
    hexagon: '<path d="M4 20 12 6h16l8 14-8 14H12Z"/>',
    diamond: '<path d="M20 3 37 20 20 37 3 20Z"/>',
    heart: '<path d="M20 35C8 26 3 20 3 13a8 8 0 0 1 17-3 8 8 0 0 1 17 3c0 7-5 13-17 22z"/>',
    arrow: '<path d="M3 15h20V7l14 13-14 13v-8H3z"/>',
    bubble: '<path d="M6 5h28a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H18l-8 8 1-8H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"/>',
    cloud: '<path d="M11 32a7 7 0 0 1-1-14 9 9 0 0 1 17-4 8 8 0 0 1 4 18z"/>',
    blob: '<path d="M24 3c9 1 14 9 13 18-1 10-8 16-17 16S3 31 3 21 13 2 24 3z"/>',
    ring: '<path fill-rule="evenodd" d="M20 3a17 17 0 1 1 0 34 17 17 0 0 1 0-34zm0 7a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>',
    line: '<path d="M4 20h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    dashed: '<path d="M4 20h32" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>',
    arrowline: '<path d="M4 20h31M28 13l7 7-7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return `<svg viewBox="0 0 40 40" width="40" height="40" fill="currentColor">${P[id] || P.rect}</svg>`;
}

function applyFrame(kind) {
  const o = state.canvas.getActiveObject();
  if (!o || o.type !== 'image') return toast('Select an image first');
  const w = o.width;
  const h = o.height;
  const m = Math.min(w, h);
  let clip = null;
  if (kind === 'circle') clip = new Circle({ radius: m / 2, originX: 'center', originY: 'center' });
  else if (kind === 'rounded') clip = new Rect({ width: w, height: h, rx: m * 0.12, ry: m * 0.12, originX: 'center', originY: 'center' });
  else if (kind !== 'none') {
    clip = createShape(kind, m);
    clip.set({ originX: 'center', originY: 'center', left: 0, top: 0 });
  }
  o.clipPath = clip;
  o.dirty = true;
  state.canvas.requestRenderAll();
  pushHistory();
  schedulePersist();
}

function tabUploads(p) {
  p.innerHTML = `
    <h3>Uploads</h3>
    <button class="btn primary block" id="upBtn">${icon('upload')} Upload images</button>
    <p class="muted">Or drag & drop / paste images onto the canvas. Drag a thumbnail onto the page to place it.</p>
    <div class="img-grid">${state.uploads
      .map((u, i) => `<div class="img-item"><img src="${u}" data-up="${i}" draggable="true" alt=""><button class="rm" data-rm="${i}" title="Remove">${icon('x')}</button></div>`)
      .join('') || '<p class="muted">No uploads yet.</p>'}</div>`;
  $('#upBtn').onclick = () => $('#fileUpload').click();
  $$('[data-up]', p).forEach((img) => {
    img.onclick = () => addImage(state.uploads[+img.dataset.up]);
    img.ondragstart = (e) => e.dataTransfer.setData('text/artvas-img', state.uploads[+img.dataset.up]);
  });
  $$('[data-rm]', p).forEach(
    (b) =>
      (b.onclick = () => {
        state.uploads.splice(+b.dataset.rm, 1);
        saveUploads();
        renderTab();
      })
  );
}

async function tabPhotos(p) {
  p.innerHTML = `
    <h3>Photos</h3>
    <p class="muted">Free stock photos from Lorem Picsum (Unsplash photographers). Click to add, or use as background.</p>
    <div class="img-grid" id="photoGrid"><p class="muted">Loading…</p></div>
    <button class="btn ghost block" id="morePhotos">Load more</button>`;
  const grid = $('#photoGrid', p);
  const load = async () => {
    try {
      const r = await fetch(`https://picsum.photos/v2/list?page=${state.photosPage}&limit=24`);
      const list = await r.json();
      if (state.photosPage === 1) grid.innerHTML = '';
      grid.insertAdjacentHTML(
        'beforeend',
        list
          .map((ph) => {
            const ratio = ph.height / ph.width;
            const full = `https://picsum.photos/id/${ph.id}/${1600}/${Math.round(1600 * ratio)}`;
            return `<div class="img-item"><img loading="lazy" src="https://picsum.photos/id/${ph.id}/300/${Math.round(300 * ratio)}" data-full="${full}" draggable="true" title="Photo by ${esc(ph.author)}" alt=""><button class="rm bgset" data-bg="${full}" title="Use as background">${icon('palette')}</button></div>`;
          })
          .join('')
      );
      $$('img[data-full]', grid).forEach((img) => {
        img.onclick = () => addImage(img.dataset.full, { name: 'Photo' });
        img.ondragstart = (e) => e.dataTransfer.setData('text/artvas-img', img.dataset.full);
      });
      $$('[data-bg]', grid).forEach((b) => (b.onclick = () => setBackgroundImage(b.dataset.bg)));
    } catch {
      grid.innerHTML = '<p class="muted">Could not load photos (are you offline?).</p>';
    }
  };
  state.photosPage = 1;
  $('#morePhotos', p).onclick = () => {
    state.photosPage++;
    load();
  };
  load();
}

function tabDraw(p) {
  const d = state.drawing;
  p.innerHTML = `
    <h3>Draw</h3>
    <button class="btn ${d.on ? 'primary' : 'ghost'} block" id="drawToggle">${icon('pen')} ${d.on ? 'Drawing ON — click to stop' : 'Start drawing'}</button>
    <div class="field"><label>Tool</label>
      <div class="seg"><button data-tool="pen" class="${!d.eraser ? 'on' : ''}">Pen</button><button data-tool="eraser" class="${d.eraser ? 'on' : ''}">Eraser</button></div>
    </div>
    <div class="field"><label>Brush size <b id="bw">${d.width}</b></label><input type="range" min="1" max="120" value="${d.width}" id="brushW"></div>
    <div class="field"><label>Color</label>${colorPicker('brushC', d.color)}</div>
    <p class="muted">Each stroke becomes its own object — select it later to move, recolor or delete.</p>`;
  const apply = () => {
    const c = state.canvas;
    c.isDrawingMode = d.on;
    if (d.on) {
      const b = new PencilBrush(c);
      b.color = d.eraser ? '#000000' : d.color;
      b.width = d.width;
      b.decimate = 2;
      c.freeDrawingBrush = b;
    }
  };
  $('#drawToggle').onclick = () => { d.on = !d.on; apply(); tabDraw(p); };
  $$('[data-tool]', p).forEach((b) => (b.onclick = () => { d.eraser = b.dataset.tool === 'eraser'; apply(); tabDraw(p); }));
  $('#brushW').oninput = (e) => { d.width = +e.target.value; $('#bw').textContent = d.width; apply(); };
  bindColorPicker('brushC', (v) => { d.color = v; apply(); });
  apply();
}

function tabBackground(p) {
  const c = state.canvas;
  const cur = typeof c.backgroundColor === 'string' ? c.backgroundColor : '#ffffff';
  p.innerHTML = `
    <h3>Background</h3>
    <div class="field"><label>Solid color</label>${colorPicker('bgColor', cur)}</div>
    <h4>Gradients</h4>
    <div class="grad-grid">${GRADIENTS.map((g, i) => `<button class="grad" data-g="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></button>`).join('')}</div>
    <div class="field"><label>Custom gradient</label>
      <div class="row"><input type="color" id="g1" value="${c.bgGradient?.colors?.[0] || '#ff7a45'}"><input type="color" id="g2" value="${c.bgGradient?.colors?.[1] || '#7c3aed'}">
      <input type="number" id="gA" value="${c.bgGradient?.angle ?? 135}" min="0" max="360" title="Angle" style="width:64px">°
      <button class="btn ghost" id="gApply">Apply</button></div>
    </div>
    <h4>Background image</h4>
    <button class="btn ghost block" id="bgUpload">${icon('upload')} Upload background image</button>
    ${c.backgroundImage ? `<button class="btn ghost block" id="bgRemove">${icon('x')} Remove background image</button>` : ''}
    <input type="file" id="bgFile" accept="image/*" hidden>
    <p class="muted">Tip: in Photos, use the palette button on a photo to set it as background.</p>`;
  bindColorPicker('bgColor', (v) => setBackgroundFill({ color: v }));
  $$('[data-g]', p).forEach((b) => (b.onclick = () => setBackgroundFill({ gradient: GRADIENTS[+b.dataset.g] })));
  $('#gApply').onclick = () => setBackgroundFill({ gradient: [$('#g1').value, $('#g2').value], angle: +$('#gA').value });
  $('#bgUpload').onclick = () => $('#bgFile').click();
  $('#bgFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) setBackgroundImage(await shrinkDataURL(await fileToDataURL(f)));
  };
  const rm = $('#bgRemove');
  if (rm)
    rm.onclick = () => {
      c.backgroundImage = null;
      c.requestRenderAll();
      pushHistory();
      schedulePersist();
      renderTab();
    };
}

function tabLayers(p) {
  const c = state.canvas;
  const objs = c.getObjects().slice().reverse();
  const active = c.getActiveObjects();
  p.innerHTML = `
    <h3>Layers</h3>
    <p class="muted">Top of the list is in front. Drag to reorder.</p>
    <div class="layers">${
      objs
        .map((o, i) => {
          const label = o.name || o.type;
          const extra = isText(o) ? ` — ${esc(o.text.slice(0, 22))}` : '';
          return `<div class="layer ${active.includes(o) ? 'sel' : ''}" draggable="true" data-li="${objs.length - 1 - i}">
          <span class="lname">${icon(layerIcon(o))}<span>${esc(label)}${extra}</span></span>
          <span class="lacts">
            <button data-la="vis" title="Show/hide">${icon(o.visible === false ? 'eyeOff' : 'eye')}</button>
            <button data-la="lock" title="Lock">${icon(o.locked ? 'lock' : 'unlock')}</button>
            <button data-la="del" title="Delete">${icon('trash')}</button>
          </span></div>`;
        })
        .join('') || '<p class="muted">This page is empty.</p>'
    }</div>`;
  let dragFrom = null;
  $$('.layer', p).forEach((row) => {
    const o = c.getObjects()[+row.dataset.li];
    row.onclick = (e) => {
      const a = e.target.closest('[data-la]')?.dataset.la;
      if (a === 'vis') { o.visible = o.visible === false; c.discardActiveObject(); }
      else if (a === 'lock') { setLocked(o, !o.locked); }
      else if (a === 'del') { c.remove(o); }
      else if (o.visible !== false) c.setActiveObject(o);
      c.requestRenderAll();
      if (a) { pushHistory(); schedulePersist(); }
      tabLayers(p);
      renderProps();
    };
    row.ondragstart = () => (dragFrom = +row.dataset.li);
    row.ondragover = (e) => e.preventDefault();
    row.ondrop = (e) => {
      e.preventDefault();
      const to = +row.dataset.li;
      if (dragFrom == null || dragFrom === to) return;
      const obj = c.getObjects()[dragFrom];
      c.moveObjectTo(obj, to);
      c.requestRenderAll();
      pushHistory();
      schedulePersist();
      tabLayers(p);
    };
  });
}

function layerIcon(o) {
  if (isText(o)) return 'type';
  if (o.type === 'image') return 'image';
  if (o.type === 'group') return 'layers';
  if (o.type === 'path' && (o.name === 'Drawing' || o.name === 'Eraser')) return 'pen';
  return 'shapes';
}

// =====================================================
// PROPERTIES PANEL (right) + context toolbar
// =====================================================
const isText = (o) => o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');

function colorPicker(id, value) {
  const v = toHex(value);
  return `<div class="color-picker" id="${id}">
    <div class="row"><input type="color" value="${v}" data-cp="input"><input type="text" value="${esc(value || '')}" data-cp="text" class="hex" spellcheck="false"></div>
    ${state.brand.colors?.length ? `<div class="swatches brand-row" title="Brand colors">${state.brand.colors.map((c) => `<button style="background:${c}" data-cp="sw" data-c="${c}" title="Brand: ${c}"></button>`).join('')}</div>` : ''}
    <div class="swatches">${PALETTE.map((c) => `<button style="background:${c}" data-cp="sw" data-c="${c}" title="${c}"></button>`).join('')}
    <button class="none" data-cp="sw" data-c="transparent" title="Transparent"></button></div>
  </div>`;
}
function bindColorPicker(id, cb) {
  const root = document.getElementById(id);
  if (!root) return;
  const inp = $('[data-cp="input"]', root);
  const txt = $('[data-cp="text"]', root);
  inp.oninput = () => { txt.value = inp.value; cb(inp.value); };
  txt.onchange = () => { cb(txt.value); if (/^#[0-9a-f]{6}$/i.test(txt.value)) inp.value = txt.value; };
  $$('[data-cp="sw"]', root).forEach((b) => (b.onclick = () => { txt.value = b.dataset.c; if (b.dataset.c !== 'transparent') inp.value = b.dataset.c; cb(b.dataset.c); }));
}
function toHex(c) {
  if (!c || typeof c !== 'string' || c === 'transparent') return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = c;
  const v = ctx.fillStyle;
  return /^#/.test(v) ? v : '#000000';
}

function setProp(key, value, { record = true } = {}) {
  const c = state.canvas;
  const objs = c.getActiveObjects();
  objs.forEach((o) => {
    if (o.type === 'group' && (key === 'fill' || key === 'stroke')) {
      o.getObjects().forEach((ch) => ch.set(key, value));
    }
    o.set(key, value);
    o.setCoords();
  });
  c.requestRenderAll();
  if (record) {
    pushHistory();
    schedulePersist();
  }
}

async function setTextProp(key, value) {
  const c = state.canvas;
  const objs = c.getActiveObjects().filter(isText);
  if (key === 'fontFamily') await ensureFont(value, objs[0]?.fontWeight || '400');
  if (key === 'fontWeight') await ensureFont(objs[0]?.fontFamily, value);
  objs.forEach((o) => {
    o.set(key, value);
    if (key === 'fontFamily' || key === 'fontWeight' || key === 'fontStyle') o.initDimensions?.();
    o.setCoords();
  });
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
}

function renderProps() {
  const el = $('#props');
  const bar = $('#ctxBar');
  if (!el || !state.canvas) return;
  const c = state.canvas;
  const o = c.getActiveObject();
  if (!o) {
    bar.innerHTML = `<span class="muted">Select an element to edit it · Right-click for more options · Shortcuts: T text, R rectangle, C circle</span>`;
    el.innerHTML = pagePropsHTML();
    bindPageProps();
    return;
  }
  const multi = o instanceof ActiveSelection;
  const text = isText(o) ? o : null;
  const img = o.type === 'image' ? o : null;
  const fill = typeof o.fill === 'string' ? o.fill : '';
  const shadow = o.shadow || null;

  // Context bar (quick actions)
  bar.innerHTML = `
    ${text ? `<select id="qFont" class="font-select">${FONTS.map((f) => `<option ${f === text.fontFamily ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select>
      <div class="num"><button id="fsMinus">${icon('minus')}</button><input id="qSize" type="number" value="${Math.round(text.fontSize)}"><button id="fsPlus">${icon('plus')}</button></div>
      <button class="tool ${text.fontWeight == 'bold' || +text.fontWeight >= 600 ? 'on' : ''}" id="qBold" title="Bold"><b>B</b></button>
      <button class="tool ${text.fontStyle === 'italic' ? 'on' : ''}" id="qItalic" title="Italic"><i>I</i></button>
      <button class="tool ${text.underline ? 'on' : ''}" id="qUnder" title="Underline"><u>U</u></button>
      <button class="tool ${text.linethrough ? 'on' : ''}" id="qStrike" title="Strikethrough"><s>S</s></button>
      <button class="tool" id="qAlign" title="Alignment">${icon('align-' + (text.textAlign || 'left'))}</button>
      <button class="tool" id="qCase" title="Uppercase / lowercase">aA</button>
      <span class="vsep"></span>` : ''}
    <label class="swatch-btn" title="Color"><span style="background:${fill && fill !== 'transparent' ? fill : 'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0/8px 8px'}"></span><input type="color" id="qFill" value="${toHex(fill)}"></label>
    <span class="spacer"></span>
    <button class="tool" data-q="forward" title="Bring forward">${icon('up')}</button>
    <button class="tool" data-q="backward" title="Send backward">${icon('down')}</button>
    ${multi ? `<button class="tool" data-q="group" title="Group">${icon('group')}</button>` : ''}
    ${o.type === 'group' ? `<button class="tool" data-q="ungroup" title="Ungroup">${icon('ungroup')}</button>` : ''}
    <button class="tool ${o.locked ? 'on' : ''}" data-q="lock" title="Lock">${icon(o.locked ? 'lock' : 'unlock')}</button>
    <button class="tool" data-q="duplicate" title="Duplicate">${icon('copy')}</button>
    <button class="tool" data-q="delete" title="Delete">${icon('trash')}</button>`;

  // Right panel (full properties)
  el.innerHTML = `
    <h3>${multi ? `${o.getObjects().length} elements` : esc(o.name || o.type)}</h3>
    ${text ? `
    <div class="field"><label>Text color</label>${colorPicker('pFill', fill)}</div>
    <div class="field"><label>Line height <b>${(text.lineHeight || 1).toFixed(2)}</b></label><input type="range" min="0.5" max="3" step="0.05" value="${text.lineHeight}" id="pLH"></div>
    <div class="field"><label>Letter spacing <b>${text.charSpacing || 0}</b></label><input type="range" min="-200" max="1500" step="10" value="${text.charSpacing || 0}" id="pCS"></div>
    <div class="field"><label>Highlight</label><div class="row"><input type="color" id="pTBG" value="${toHex(text.textBackgroundColor || '#ffff00')}"><button class="btn ghost small" id="pTBGx">${text.textBackgroundColor ? 'Remove' : 'None'}</button></div></div>
    <div class="field"><label>Outline</label><div class="row"><input type="color" id="pStroke" value="${toHex(text.stroke || '#000000')}"><input type="range" min="0" max="${Math.round(text.fontSize / 4)}" step="0.5" value="${text.strokeWidth || 0}" id="pSW"></div></div>
    ` : ''}
    ${!text && !img ? `
    <div class="field"><label>${o.type === 'line' ? 'Line color' : 'Fill'}</label>${colorPicker('pFill', o.type === 'line' || (o.type === 'path' && !o.fill) ? o.stroke : fill)}</div>
    ${!multi && o.type !== 'line' && o.type !== 'group' ? `<div class="field"><label>Gradient fill</label><div class="grad-grid small">${GRADIENTS.slice(0, 8).map((g, i) => `<button class="grad" data-og="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></button>`).join('')}</div></div>` : ''}
    <div class="field"><label>Border</label><div class="row"><input type="color" id="pStroke" value="${toHex(o.stroke || '#000000')}"><input type="range" min="0" max="60" step="1" value="${o.strokeWidth || 0}" id="pSW"></div>
      <div class="seg mt"><button data-dash="solid" class="${!o.strokeDashArray ? 'on' : ''}">Solid</button><button data-dash="dash" class="${o.strokeDashArray ? 'on' : ''}">Dashed</button></div></div>
    ${o.type === 'rect' ? `<div class="field"><label>Corner radius <b>${Math.round(o.rx || 0)}</b></label><input type="range" min="0" max="${Math.round(Math.min(o.width, o.height) / 2)}" value="${o.rx || 0}" id="pRX"></div>` : ''}
    ` : ''}
    ${img ? imageFiltersHTML(img) : ''}
    <div class="field"><label>Transparency <b>${Math.round((o.opacity ?? 1) * 100)}%</b></label><input type="range" min="0" max="1" step="0.01" value="${o.opacity ?? 1}" id="pOp"></div>
    <div class="field"><label>Blend mode</label><select id="pBlend">${['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((b) => `<option value="${b}" ${o.globalCompositeOperation === b ? 'selected' : ''}>${b === 'source-over' ? 'normal' : b}</option>`).join('')}</select></div>
    <div class="field"><label class="row"><input type="checkbox" id="pShadow" ${shadow ? 'checked' : ''}> Shadow</label>
      ${shadow ? `<div class="sub">
        <div class="row"><input type="color" id="shC" value="${toHex(shadow.color)}"><span class="muted">color</span></div>
        <label>Blur <input type="range" id="shB" min="0" max="100" value="${shadow.blur}"></label>
        <label>Offset X <input type="range" id="shX" min="-100" max="100" value="${shadow.offsetX}"></label>
        <label>Offset Y <input type="range" id="shY" min="-100" max="100" value="${shadow.offsetY}"></label>
      </div>` : ''}
    </div>
    <h4>Position</h4>
    <div class="align-grid">
      <button data-al="left" title="Align left">${icon('al-left')}</button>
      <button data-al="hcenter" title="Align center">${icon('al-hcenter')}</button>
      <button data-al="right" title="Align right">${icon('al-right')}</button>
      <button data-al="top" title="Align top">${icon('al-top')}</button>
      <button data-al="vcenter" title="Align middle">${icon('al-vcenter')}</button>
      <button data-al="bottom" title="Align bottom">${icon('al-bottom')}</button>
    </div>
    <div class="grid2">
      <label>X <input type="number" id="pX" value="${Math.round(o.getBoundingRect().left)}"></label>
      <label>Y <input type="number" id="pY" value="${Math.round(o.getBoundingRect().top)}"></label>
      <label>W <input type="number" id="pW" value="${Math.round(o.getScaledWidth())}"></label>
      <label>H <input type="number" id="pH" value="${Math.round(o.getScaledHeight())}"></label>
      <label>Rotate <input type="number" id="pA" value="${Math.round(o.angle || 0)}"></label>
      <div class="row"><button class="tool" id="flipX" title="Flip horizontal">${icon('flipH')}</button><button class="tool" id="flipY" title="Flip vertical">${icon('flipV')}</button></div>
    </div>
    <div class="row wrap mt">
      <button class="btn ghost small" data-q="front">To front</button>
      <button class="btn ghost small" data-q="back">To back</button>
      ${img ? `<button class="btn ghost small" data-q="setbg">Set as background</button><button class="btn ghost small" id="replaceImg">Replace</button>` : ''}
    </div>`;
  bindProps(o, text, img);
}

function imageFiltersHTML(img) {
  const f = getFilterValues(img);
  const r = (id, label, min, max, step, v) =>
    `<label class="frow">${label} <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  return `
    ${bgRemoverHTML()}
    <h4>Adjust</h4>
    <div class="field">
      ${r('fBright', 'Brightness', -1, 1, 0.02, f.brightness)}
      ${r('fContrast', 'Contrast', -1, 1, 0.02, f.contrast)}
      ${r('fSat', 'Saturation', -1, 1, 0.02, f.saturation)}
      ${r('fHue', 'Hue', -1, 1, 0.02, f.hue)}
      ${r('fBlur', 'Blur', 0, 1, 0.01, f.blur)}
      ${r('fPix', 'Pixelate', 1, 40, 1, f.pixelate)}
    </div>
    <h4>Filters</h4>
    <div class="filter-grid">
      ${['none', 'grayscale', 'sepia', 'invert', 'vintage', 'kodachrome', 'technicolor', 'polaroid', 'brownie', 'blackwhite']
        .map((n) => `<button class="${f.preset === n ? 'on' : ''}" data-fp="${n}">${n}</button>`)
        .join('')}
    </div>
    <h4>Frame</h4>
    <div class="row wrap">${['none', 'circle', 'rounded', 'star', 'heart', 'hexagon'].map((fr) => `<button class="btn ghost small" data-fr="${fr}">${fr}</button>`).join('')}</div>`;
}

function getFilterValues(img) {
  const v = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, pixelate: 1, preset: 'none' };
  for (const f of img.filters || []) {
    if (!f) continue;
    const t = f.type;
    if (t === 'Brightness') v.brightness = f.brightness;
    else if (t === 'Contrast') v.contrast = f.contrast;
    else if (t === 'Saturation') v.saturation = f.saturation;
    else if (t === 'HueRotation') v.hue = f.rotation;
    else if (t === 'Blur') v.blur = f.blur;
    else if (t === 'Pixelate') v.pixelate = f.blocksize;
    else if (t === 'Grayscale') v.preset = 'grayscale';
    else if (t === 'Invert') v.preset = 'invert';
    else if (t === 'ColorMatrix' || ['Sepia', 'Vintage', 'Kodachrome', 'Technicolor', 'Polaroid', 'Brownie', 'BlackWhite'].includes(t)) v.preset = (f.presetName || t).toLowerCase();
  }
  return v;
}

function applyFilters(img, v) {
  const list = [];
  const P = {
    grayscale: () => new filters.Grayscale(),
    invert: () => new filters.Invert(),
    sepia: () => new filters.Sepia(),
    vintage: () => new filters.Vintage(),
    kodachrome: () => new filters.Kodachrome(),
    technicolor: () => new filters.Technicolor(),
    polaroid: () => new filters.Polaroid(),
    brownie: () => new filters.Brownie(),
    blackwhite: () => new filters.BlackWhite(),
  };
  if (v.preset && P[v.preset]) list.push(P[v.preset]());
  if (v.brightness) list.push(new filters.Brightness({ brightness: v.brightness }));
  if (v.contrast) list.push(new filters.Contrast({ contrast: v.contrast }));
  if (v.saturation) list.push(new filters.Saturation({ saturation: v.saturation }));
  if (v.hue) list.push(new filters.HueRotation({ rotation: v.hue }));
  if (v.blur) list.push(new filters.Blur({ blur: v.blur }));
  if (v.pixelate > 1) list.push(new filters.Pixelate({ blocksize: v.pixelate }));
  img.filters = list;
  img.applyFilters();
  state.canvas.requestRenderAll();
}

function alignObject(o, how) {
  const { width: W, height: H } = state.design;
  const br = o.getBoundingRect();
  let dx = 0;
  let dy = 0;
  if (how === 'left') dx = -br.left;
  if (how === 'right') dx = W - (br.left + br.width);
  if (how === 'hcenter') dx = W / 2 - (br.left + br.width / 2);
  if (how === 'top') dy = -br.top;
  if (how === 'bottom') dy = H - (br.top + br.height);
  if (how === 'vcenter') dy = H / 2 - (br.top + br.height / 2);
  o.set({ left: o.left + dx, top: o.top + dy });
  o.setCoords();
}

function bindProps(o, text, img) {
  const c = state.canvas;
  const on = (id, ev, fn) => {
    const e = document.getElementById(id);
    if (e) e[ev] = fn;
  };
  const commit = () => { pushHistory(); schedulePersist(); };

  // quick bar
  $$('[data-q]').forEach((b) => (b.onclick = () => runAction(b.dataset.q).then(renderProps)));
  on('qFill', 'oninput', (e) => setProp(o.type === 'line' ? 'stroke' : 'fill', e.target.value, { record: false }));
  on('qFill', 'onchange', commit);
  if (text) {
    on('qFont', 'onchange', (e) => setTextProp('fontFamily', e.target.value));
    on('qSize', 'onchange', (e) => setTextProp('fontSize', Math.max(1, +e.target.value)));
    on('fsMinus', 'onclick', () => setTextProp('fontSize', Math.max(1, Math.round(text.fontSize - Math.max(1, text.fontSize * 0.1)))));
    on('fsPlus', 'onclick', () => setTextProp('fontSize', Math.round(text.fontSize + Math.max(1, text.fontSize * 0.1))));
    on('qBold', 'onclick', () => setTextProp('fontWeight', text.fontWeight == 'bold' || +text.fontWeight >= 600 ? 'normal' : 'bold'));
    on('qItalic', 'onclick', () => setTextProp('fontStyle', text.fontStyle === 'italic' ? 'normal' : 'italic'));
    on('qUnder', 'onclick', () => setTextProp('underline', !text.underline));
    on('qStrike', 'onclick', () => setTextProp('linethrough', !text.linethrough));
    on('qAlign', 'onclick', () => {
      const order = ['left', 'center', 'right', 'justify'];
      setTextProp('textAlign', order[(order.indexOf(text.textAlign) + 1) % order.length]);
    });
    on('qCase', 'onclick', () => {
      const t = text.text;
      setTextProp('text', t === t.toUpperCase() ? t.toLowerCase() : t.toUpperCase());
    });
    on('pLH', 'oninput', (e) => { setProp('lineHeight', +e.target.value, { record: false }); });
    on('pLH', 'onchange', () => { commit(); renderProps(); });
    on('pCS', 'oninput', (e) => setProp('charSpacing', +e.target.value, { record: false }));
    on('pCS', 'onchange', () => { commit(); renderProps(); });
    on('pTBG', 'oninput', (e) => setProp('textBackgroundColor', e.target.value, { record: false }));
    on('pTBG', 'onchange', () => { commit(); renderProps(); });
    on('pTBGx', 'onclick', () => { setProp('textBackgroundColor', ''); renderProps(); });
  }
  bindColorPicker('pFill', (v) => {
    const key = o.type === 'line' || (o.type === 'path' && !o.fill) ? 'stroke' : 'fill';
    setProp(key, v);
  });
  $$('[data-og]').forEach(
    (b) =>
      (b.onclick = () => {
        const g = GRADIENTS[+b.dataset.og];
        setProp('fill', makeGradient(g, o.width, o.height, 135));
        // gradient coords are relative to object top-left in fabric
        o.fill.offsetX = -o.width / 2;
        o.fill.offsetY = -o.height / 2;
        c.requestRenderAll();
      })
  );
  on('pStroke', 'oninput', (e) => { setProp('stroke', e.target.value, { record: false }); if (!o.strokeWidth) setProp('strokeWidth', text ? 2 : 4, { record: false }); });
  on('pStroke', 'onchange', () => { commit(); renderProps(); });
  on('pSW', 'oninput', (e) => { if (!o.stroke) setProp('stroke', '#000000', { record: false }); setProp('strokeWidth', +e.target.value, { record: false }); });
  on('pSW', 'onchange', commit);
  $$('[data-dash]').forEach((b) => (b.onclick = () => { const w = o.strokeWidth || 4; setProp('strokeDashArray', b.dataset.dash === 'dash' ? [w * 3, w * 2] : null); renderProps(); }));
  on('pRX', 'oninput', (e) => { setProp('rx', +e.target.value, { record: false }); setProp('ry', +e.target.value, { record: false }); });
  on('pRX', 'onchange', () => { commit(); renderProps(); });
  on('pOp', 'oninput', (e) => setProp('opacity', +e.target.value, { record: false }));
  on('pOp', 'onchange', () => { commit(); renderProps(); });
  on('pBlend', 'onchange', (e) => setProp('globalCompositeOperation', e.target.value));
  on('pShadow', 'onchange', (e) => {
    const m = minSide();
    setProp('shadow', e.target.checked ? new Shadow({ color: 'rgba(0,0,0,0.45)', blur: Math.round(m * 0.02), offsetX: Math.round(m * 0.008), offsetY: Math.round(m * 0.008) }) : null);
    renderProps();
  });
  const sh = (k, v) => {
    c.getActiveObjects().forEach((x) => { if (x.shadow) { x.shadow[k] = v; x.dirty = true; } });
    c.requestRenderAll();
  };
  on('shC', 'oninput', (e) => sh('color', e.target.value));
  on('shB', 'oninput', (e) => sh('blur', +e.target.value));
  on('shX', 'oninput', (e) => sh('offsetX', +e.target.value));
  on('shY', 'oninput', (e) => sh('offsetY', +e.target.value));
  ['shC', 'shB', 'shX', 'shY'].forEach((id) => on(id, 'onchange', commit));

  // position
  $$('[data-al]').forEach((b) => (b.onclick = () => { alignObject(o, b.dataset.al); c.requestRenderAll(); commit(); renderProps(); }));
  const pos = () => {
    const br = o.getBoundingRect();
    o.set({ left: o.left + (+$('#pX').value - br.left), top: o.top + (+$('#pY').value - br.top) });
    o.setCoords();
    c.requestRenderAll();
    commit();
  };
  on('pX', 'onchange', pos);
  on('pY', 'onchange', pos);
  on('pW', 'onchange', (e) => {
    const v = Math.max(1, +e.target.value);
    if (text) o.set({ width: v / o.scaleX });
    else o.scaleX = v / o.width;
    o.setCoords(); c.requestRenderAll(); commit(); renderProps();
  });
  on('pH', 'onchange', (e) => {
    if (text) return renderProps();
    o.scaleY = Math.max(1, +e.target.value) / o.height;
    o.setCoords(); c.requestRenderAll(); commit();
  });
  on('pA', 'onchange', (e) => { o.rotate(+e.target.value); o.setCoords(); c.requestRenderAll(); commit(); });
  on('flipX', 'onclick', () => setProp('flipX', !o.flipX));
  on('flipY', 'onclick', () => setProp('flipY', !o.flipY));

  if (img) {
    const read = () => ({
      brightness: +$('#fBright').value,
      contrast: +$('#fContrast').value,
      saturation: +$('#fSat').value,
      hue: +$('#fHue').value,
      blur: +$('#fBlur').value,
      pixelate: +$('#fPix').value,
      preset: getFilterValues(img).preset,
    });
    ['fBright', 'fContrast', 'fSat', 'fHue', 'fBlur', 'fPix'].forEach((id) => {
      on(id, 'oninput', () => applyFilters(img, read()));
      on(id, 'onchange', commit);
    });
    $$('[data-fp]').forEach((b) => (b.onclick = () => { applyFilters(img, { ...read(), preset: b.dataset.fp }); commit(); renderProps(); }));
    $$('[data-fr]').forEach((b) => (b.onclick = () => applyFrame(b.dataset.fr)));
    bindBgRemover(img);
    on('replaceImg', 'onclick', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        const url = await shrinkDataURL(await fileToDataURL(f));
        const w = img.getScaledWidth();
        await img.setSrc(url);
        img.scaleToWidth(w);
        applyFilters(img, getFilterValues(img));
        img.setCoords();
        c.requestRenderAll();
        commit();
      };
      inp.click();
    });
  }
}

function pagePropsHTML() {
  const d = state.design;
  return `
    <h3>Page ${state.page + 1} of ${d.pages.length}</h3>
    <div class="field"><label>Background color</label>${colorPicker('pgBg', typeof state.canvas.backgroundColor === 'string' ? state.canvas.backgroundColor : '#ffffff')}</div>
    <button class="btn ghost block" id="pgMoreBg">${icon('palette')} More backgrounds</button>
    <h4>Design</h4>
    <p class="muted">${d.width} × ${d.height} px · ${d.pages.length} page(s)</p>
    <button class="btn ghost block" id="pgResize">${icon('resize')} Resize design</button>
    <button class="btn ghost block" id="pgClear">${icon('trash')} Clear page</button>
    <h4>Keyboard shortcuts</h4>
    <ul class="shortcuts">
      <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Y</kbd> Undo / redo</li>
      <li><kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd> / <kbd>X</kbd> Copy / paste / cut</li>
      <li><kbd>Ctrl</kbd>+<kbd>D</kbd> Duplicate</li>
      <li><kbd>Ctrl</kbd>+<kbd>G</kbd> Group · <kbd>Shift</kbd> ungroup</li>
      <li><kbd>Ctrl</kbd>+<kbd>A</kbd> Select all</li>
      <li><kbd>Del</kbd> Delete · <kbd>Arrows</kbd> Nudge</li>
      <li><kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd>/<kbd>0</kbd> Zoom</li>
      <li><kbd>Ctrl</kbd>+<kbd>S</kbd> Save</li>
    </ul>`;
}
function bindPageProps() {
  bindColorPicker('pgBg', (v) => setBackgroundFill({ color: v }));
  $('#pgMoreBg').onclick = () => $('[data-tab="background"]').click();
  $('#pgResize').onclick = openResizeDialog;
  $('#pgClear').onclick = () => {
    if (!confirm('Remove everything from this page?')) return;
    const c = state.canvas;
    state.loading = true;
    c.clear();
    c.backgroundColor = '#ffffff';
    state.loading = false;
    c.requestRenderAll();
    pushHistory();
    schedulePersist();
    renderLayersIfOpen();
  };
}

// =====================================================
// RESIZE
// =====================================================
function openResizeDialog() {
  const d = state.design;
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal">
    <h3>Resize design</h3>
    <p class="muted">Content on every page is scaled to fit the new size.</p>
    <div class="grid2"><label>Width <input type="number" id="rw" value="${d.width}"></label><label>Height <input type="number" id="rh" value="${d.height}"></label></div>
    <div class="preset-list">${SIZE_PRESETS.map((p, i) => `<button data-rp="${i}">${p.name}<small>${p.w}×${p.h}</small></button>`).join('')}</div>
    <label class="row"><input type="checkbox" id="rcopy" checked> Make a resized copy (keep original)</label>
    <div class="row end"><button class="btn ghost" id="rcancel">Cancel</button><button class="btn primary" id="rok">Resize</button></div>
  </div>`;
  document.body.appendChild(modal);
  $$('[data-rp]', modal).forEach((b) => (b.onclick = () => { const p = SIZE_PRESETS[+b.dataset.rp]; $('#rw').value = p.w; $('#rh').value = p.h; }));
  $('#rcancel').onclick = () => modal.remove();
  modal.onclick = (e) => e.target === modal && modal.remove();
  $('#rok').onclick = async () => {
    const w = Math.max(16, Math.min(8000, +$('#rw').value));
    const h = Math.max(16, Math.min(8000, +$('#rh').value));
    const copy = $('#rcopy').checked;
    modal.remove();
    await resizeDesign(w, h, copy);
  };
}

async function resizeDesign(W2, H2, copy) {
  await persist();
  const d = copy ? structuredClone(state.design) : state.design;
  if (copy) { d.id = uid(); d.name = `${d.name} (${W2}×${H2})`; }
  const W = d.width;
  const H = d.height;
  const s = Math.min(W2 / W, H2 / H);
  const ox = (W2 - W * s) / 2;
  const oy = (H2 - H * s) / 2;
  for (const page of d.pages) {
    if (!page.json) continue;
    const el = document.createElement('canvas');
    const sc = new StaticCanvas(el, { width: W, height: H, renderOnAddRemove: false });
    await sc.loadFromJSON(page.json);
    sc.getObjects().forEach((o) => {
      const center = o.getCenterPoint();
      o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
      o.setPositionByOrigin({ x: center.x * s + ox, y: center.y * s + oy }, 'center', 'center');
      o.setCoords();
    });
    if (sc.backgroundImage) {
      const bi = sc.backgroundImage;
      const cs = Math.max(W2 / bi.width, H2 / bi.height);
      bi.set({ scaleX: cs, scaleY: cs, originX: 'center', originY: 'center', left: W2 / 2, top: H2 / 2 });
    }
    if (sc.bgGradient || page.json.bgGradient) {
      const g = sc.bgGradient || page.json.bgGradient;
      sc.backgroundColor = makeGradient(g.colors, W2, H2, g.angle);
    }
    page.json = sc.toObject(PROPS);
    sc.dispose();
  }
  d.width = W2;
  d.height = H2;
  d.updatedAt = Date.now();
  await saveDesign(d);
  await openEditor(d);
  toast(copy ? 'Resized copy created' : 'Design resized');
}

// =====================================================
// EXPORT
// =====================================================
async function renderPageCanvas(json, transparent = false) {
  const { width: W, height: H } = state.design;
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: W, height: H, enableRetinaScaling: false, renderOnAddRemove: false });
  if (json) await sc.loadFromJSON(json);
  if (transparent) {
    sc.backgroundColor = '';
  } else if (!sc.backgroundColor) sc.backgroundColor = '#ffffff';
  sc.renderAll();
  return sc;
}

function download(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safeName = () => (state.design.name || 'artvas-design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'artvas-design';

async function exportDesign(fmt, { scale = 1, all = false, transparent = false } = {}) {
  captureCurrentPage();
  const d = state.design;
  const name = safeName();
  if (fmt === 'json') {
    const blob = new Blob([JSON.stringify({ ...d, app: 'artvas', version: 1 })], { type: 'application/json' });
    download(URL.createObjectURL(blob), `${name}.json`);
    persist();
    return toast('Project file downloaded');
  }
  if (fmt === 'gif' || fmt === 'video') {
    const list = all ? d.pages : [d.pages[state.page]];
    if (!list.some((pg) => pg.json?.objects?.some((o) => o.anim && o.anim.type !== 'none'))) {
      toast('Tip: add animations in the Animate tab — exporting a still clip');
    }
    const btn = $('#doExport');
    const onProgress = (pct) => {
      const t = `Rendering… ${pct}%`;
      if (btn && !btn.closest('[hidden]')) btn.textContent = t;
      const s = $('#saveStatus');
      if (s) s.textContent = t;
    };
    if (fmt === 'gif') {
      const blob = await exportGIF(list, d.width, d.height, { maxSize: Math.round(600 * Math.min(2, scale)), onProgress });
      download(URL.createObjectURL(blob), `${name}.gif`);
    } else {
      const { blob, ext } = await exportVideo(list, d.width, d.height, { maxSize: Math.round(1920 * Math.min(1, scale)), onProgress });
      download(URL.createObjectURL(blob), `${name}.${ext}`);
    }
    const s = $('#saveStatus');
    if (s) s.textContent = 'Saved';
    return toast('Animation downloaded');
  }
  const pages = fmt === 'pdf' || all ? d.pages.map((p, i) => [p, i]) : [[d.pages[state.page], state.page]];
  if (fmt === 'pdf') {
    const orientation = d.width >= d.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [d.width, d.height], hotfixes: ['px_scaling'], compress: true });
    for (let k = 0; k < pages.length; k++) {
      const sc = await renderPageCanvas(pages[k][0].json);
      const url = sc.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: scale });
      sc.dispose();
      if (k > 0) pdf.addPage([d.width, d.height], orientation);
      pdf.addImage(url, 'JPEG', 0, 0, d.width, d.height);
    }
    pdf.save(`${name}.pdf`);
    return toast('PDF downloaded');
  }
  for (const [page, i] of pages) {
    const sc = await renderPageCanvas(page.json, transparent && fmt === 'png');
    const suffix = pages.length > 1 ? `-${i + 1}` : '';
    if (fmt === 'svg') {
      const svg = sc.toSVG();
      download(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), `${name}${suffix}.svg`);
    } else {
      const url = sc.toDataURL({ format: fmt === 'jpg' ? 'jpeg' : 'png', quality: 0.92, multiplier: scale });
      download(url, `${name}${suffix}.${fmt}`);
    }
    sc.dispose();
    await new Promise((r) => setTimeout(r, 150));
  }
  toast('Downloaded');
}

// =====================================================
// ANIMATE
// =====================================================
function tabAnimate(p) {
  const c = state.canvas;
  const page = state.design.pages[state.page];
  const dur = page.duration || 4;
  const o = c.getActiveObject();
  const objs = c.getActiveObjects();
  const a = o && !(o instanceof ActiveSelection) ? o.anim || { type: 'none', duration: 0.8, delay: 0 } : null;
  p.innerHTML = `
    <h3>Animate</h3>
    <button class="btn primary block" id="animPreview">${icon('play')} Preview animation</button>
    <div class="field"><label>Page duration <b id="pdurV">${dur}s</b></label><input type="range" min="1" max="20" step="0.5" value="${dur}" id="pdur"></div>
    <h4>Animate whole page</h4>
    <div class="anim-grid">${PAGE_PRESETS.map((pr) => `<button class="anim-item" data-pp="${pr.id}">${pr.label}</button>`).join('')}</div>
    <h4>Selected element</h4>
    ${
      objs.length
        ? `<div class="anim-grid">${ANIMATIONS.map((an) => `<button class="anim-item ${a && a.type === an.id ? 'on' : ''}" data-an="${an.id}">${an.label}</button>`).join('')}</div>
      ${a ? `<div class="field mt"><label>Duration <b>${(a.duration ?? 0.8).toFixed(1)}s</b></label><input type="range" min="0.2" max="5" step="0.1" value="${a.duration ?? 0.8}" id="anDur"></div>
      <div class="field"><label>Delay <b>${(a.delay ?? 0).toFixed(1)}s</b></label><input type="range" min="0" max="10" step="0.1" value="${a.delay ?? 0}" id="anDelay"></div>` : ''}`
        : '<p class="muted">Select an element on the page to give it its own animation.</p>'
    }
    <h4>Download animation</h4>
    <button class="btn ghost block" id="animGif">${icon('download')} Download GIF</button>
    <button class="btn ghost block" id="animVideo">${icon('download')} Download video (${(videoMime() || 'webm').includes('mp4') ? 'MP4' : 'WebM'})</button>
    <p class="muted">Video and GIF include every page, each shown for its page duration.</p>`;

  $('#animPreview').onclick = openAnimPreview;
  $('#pdur').oninput = (e) => {
    page.duration = +e.target.value;
    $('#pdurV').textContent = page.duration + 's';
    schedulePersist();
  };
  $$('[data-pp]', p).forEach(
    (b) =>
      (b.onclick = () => {
        const pr = PAGE_PRESETS.find((x) => x.id === b.dataset.pp);
        c.getObjects().forEach((obj, i) => {
          obj.anim = pr.type === 'none' ? null : { type: pr.type, duration: 0.8, delay: +(i * pr.stagger).toFixed(2) };
        });
        const len = animationLength(c.toObject(PROPS));
        if (len + 1 > (page.duration || 4)) page.duration = Math.min(20, Math.ceil(len + 1.5));
        pushHistory();
        schedulePersist();
        tabAnimate(p);
        toast(pr.type === 'none' ? 'Animations removed' : `"${pr.label}" applied to page`);
      })
  );
  $$('[data-an]', p).forEach(
    (b) =>
      (b.onclick = () => {
        objs.forEach((obj) => {
          const prev = obj.anim || { duration: 0.8, delay: 0 };
          obj.anim = b.dataset.an === 'none' ? null : { ...prev, type: b.dataset.an };
        });
        pushHistory();
        schedulePersist();
        tabAnimate(p);
      })
  );
  const upd = (key, v) => {
    objs.forEach((obj) => obj.anim && (obj.anim = { ...obj.anim, [key]: v }));
    schedulePersist();
  };
  const d1 = $('#anDur');
  if (d1) {
    d1.oninput = (e) => { upd('duration', +e.target.value); d1.previousElementSibling.querySelector('b').textContent = (+e.target.value).toFixed(1) + 's'; };
    d1.onchange = pushHistory;
  }
  const d2 = $('#anDelay');
  if (d2) {
    d2.oninput = (e) => { upd('delay', +e.target.value); d2.previousElementSibling.querySelector('b').textContent = (+e.target.value).toFixed(1) + 's'; };
    d2.onchange = pushHistory;
  }
  $('#animGif').onclick = () => runExportButton($('#animGif'), () => exportDesign('gif', { all: true }));
  $('#animVideo').onclick = () => runExportButton($('#animVideo'), () => exportDesign('video', { all: true }));
}

async function runExportButton(btn, fn) {
  const html = btn.innerHTML;
  btn.disabled = true;
  try {
    await fn((pct) => (btn.textContent = `Rendering… ${pct}%`));
  } catch (e) {
    console.error(e);
    toast('Export failed: ' + e.message);
  }
  btn.disabled = false;
  btn.innerHTML = html;
}

async function openAnimPreview() {
  captureCurrentPage();
  const d = state.design;
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal wide"><div class="row"><h3>Animation preview</h3><span class="spacer"></span><button class="icon-btn" id="pvClose">${icon('x')}</button></div>
    <div class="row"><label class="row"><input type="radio" name="pvw" value="page" checked> This page</label><label class="row"><input type="radio" name="pvw" value="all"> All pages</label></div>
    <div class="preview-box" id="pvBox"></div></div>`;
  document.body.appendChild(modal);
  let stop = null;
  const start = async (all) => {
    stop?.();
    const pages = all ? d.pages : [d.pages[state.page]];
    stop = await playPreview($('#pvBox'), pages, d.width, d.height, Math.min(740, innerWidth - 100, (innerHeight - 220) * Math.max(1, d.width / d.height)));
  };
  const close = () => { stop?.(); modal.remove(); };
  $('#pvClose').onclick = close;
  modal.onclick = (e) => e.target === modal && close();
  $$('[name="pvw"]', modal).forEach((r) => (r.onchange = () => start(r.value === 'all')));
  start(false);
}

// =====================================================
// BRAND KIT
// =====================================================
async function loadBrand() {
  try {
    const b = await kvGet('brand');
    if (b) state.brand = { ...state.brand, ...b };
  } catch {}
  for (const f of state.brand.fonts || []) await registerFont(f.name, f.data);
}

async function saveBrand() {
  try {
    await kvSet('brand', state.brand);
  } catch (e) {
    toast('Could not save brand kit');
  }
}

async function registerFont(name, dataURL) {
  try {
    const ff = new FontFace(name, `url(${dataURL})`);
    await ff.load();
    document.fonts.add(ff);
    if (!FONTS.includes(name)) FONTS.unshift(name);
  } catch (e) {
    console.warn('Font failed', name, e);
  }
}

function tabBrand(p) {
  const b = state.brand;
  const fontOpts = (sel) => FONTS.map((f) => `<option ${f === sel ? 'selected' : ''}>${esc(f)}</option>`).join('');
  p.innerHTML = `
    <h3>Brand Kit</h3>
    <p class="muted">Your brand colors, fonts and logos — available in every design.</p>
    <h4>Brand colors</h4>
    <div class="brand-colors">${(b.colors || []).map((c, i) => `<div class="bc" style="background:${c}" title="${c}" data-bci="${i}"><button data-bcrm="${i}" title="Remove">${icon('x', 12)}</button></div>`).join('')}
      <label class="bc add" title="Add color">${icon('plus')}<input type="color" id="bcAdd" value="#7c3aed"></label></div>
    <button class="btn ghost block mt" id="bcApply">${icon('palette')} Apply brand colors to page</button>
    <h4>Brand fonts</h4>
    <div class="field"><label>Heading</label><select id="bfH">${fontOpts(b.headingFont)}</select></div>
    <div class="field"><label>Body</label><select id="bfB">${fontOpts(b.bodyFont)}</select></div>
    <div class="row"><button class="btn ghost small" id="bfAddH" style="font-family:'${b.headingFont}'">+ Heading</button><button class="btn ghost small" id="bfAddB" style="font-family:'${b.bodyFont}'">+ Body text</button></div>
    <button class="btn ghost block mt" id="bfApply">${icon('type')} Apply brand fonts to page</button>
    <button class="btn ghost block" id="bfUpload">${icon('upload')} Upload a font (.ttf .otf .woff)</button>
    <input type="file" id="bfFile" accept=".ttf,.otf,.woff,.woff2" hidden>
    ${(b.fonts || []).length ? `<div class="muted">Your fonts: ${b.fonts.map((f) => `<span class="tag" style="font-family:'${esc(f.name)}'">${esc(f.name)} <button data-bfrm="${esc(f.name)}">×</button></span>`).join(' ')}</div>` : ''}
    <h4>Logos</h4>
    <button class="btn ghost block" id="blUpload">${icon('upload')} Upload logo</button>
    <input type="file" id="blFile" accept="image/*" multiple hidden>
    <div class="img-grid">${(b.logos || []).map((l, i) => `<div class="img-item logo-item"><img src="${l}" data-bl="${i}" alt=""><button class="rm" data-blrm="${i}">${icon('x')}</button></div>`).join('') || '<p class="muted">No logos yet.</p>'}</div>`;

  $('#bcAdd').onchange = (e) => {
    b.colors = [...(b.colors || []), e.target.value];
    saveBrand();
    tabBrand(p);
  };
  $$('[data-bcrm]', p).forEach((x) => (x.onclick = (e) => { e.stopPropagation(); b.colors.splice(+x.dataset.bcrm, 1); saveBrand(); tabBrand(p); }));
  $$('[data-bci]', p).forEach((x) => (x.onclick = () => {
    const col = b.colors[+x.dataset.bci];
    if (state.canvas.getActiveObject()) setProp(state.canvas.getActiveObject().type === 'line' ? 'stroke' : 'fill', col);
    else setBackgroundFill({ color: col });
  }));
  $('#bcApply').onclick = () => {
    if (!b.colors?.length) return toast('Add some brand colors first');
    let i = 0;
    state.canvas.getObjects().forEach((o) => {
      if (o.type === 'image' || isText(o) || o.type === 'group') return;
      const key = o.type === 'line' || (o.type === 'path' && !o.fill) ? 'stroke' : 'fill';
      if (o[key] === 'transparent' || !o[key]) return;
      o.set(key, b.colors[i++ % b.colors.length]);
    });
    const texts = state.canvas.getObjects().filter(isText);
    if (b.colors.length > 1) texts.forEach((t) => t.text.length > 2 && t.fill !== 'transparent' && t.set('fill', b.colors[0]));
    state.canvas.requestRenderAll();
    pushHistory();
    schedulePersist();
  };
  $('#bfH').onchange = (e) => { b.headingFont = e.target.value; saveBrand(); tabBrand(p); };
  $('#bfB').onchange = (e) => { b.bodyFont = e.target.value; saveBrand(); tabBrand(p); };
  $('#bfAddH').onclick = () => addText({ text: 'Brand heading', font: b.headingFont, size: 0.09, weight: '700', color: b.colors?.[0] });
  $('#bfAddB').onclick = () => addText({ text: 'Brand body text', font: b.bodyFont, size: 0.035, color: b.colors?.[1] });
  $('#bfApply').onclick = async () => {
    await ensureFont(b.headingFont, '700');
    await ensureFont(b.bodyFont);
    const big = minSide() * 0.06;
    state.canvas.getObjects().filter(isText).forEach((t) => {
      if (t.name === 'Sticker') return;
      t.set('fontFamily', t.fontSize * (t.scaleY || 1) >= big ? b.headingFont : b.bodyFont);
      t.initDimensions?.();
      t.setCoords();
    });
    state.canvas.requestRenderAll();
    pushHistory();
    schedulePersist();
  };
  $('#bfUpload').onclick = () => $('#bfFile').click();
  $('#bfFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, ' ').trim() || 'Custom font';
    const data = await fileToDataURL(f);
    await registerFont(name, data);
    b.fonts = [...(b.fonts || []).filter((x) => x.name !== name), { name, data }];
    await saveBrand();
    toast(`Font "${name}" added`);
    tabBrand(p);
  };
  $$('[data-bfrm]', p).forEach((x) => (x.onclick = () => { b.fonts = b.fonts.filter((f) => f.name !== x.dataset.bfrm); saveBrand(); tabBrand(p); }));
  $('#blUpload').onclick = () => $('#blFile').click();
  $('#blFile').onchange = async (e) => {
    for (const f of e.target.files) {
      let url = await fileToDataURL(f);
      if (!f.type.includes('svg')) url = await shrinkDataURL(url, 1200);
      b.logos = [...(b.logos || []), url];
    }
    await saveBrand();
    tabBrand(p);
  };
  $$('[data-bl]', p).forEach((x) => (x.onclick = () => addImage(b.logos[+x.dataset.bl], { name: 'Logo' })));
  $$('[data-blrm]', p).forEach((x) => (x.onclick = () => { b.logos.splice(+x.dataset.blrm, 1); saveBrand(); tabBrand(p); }));
}

// =====================================================
// VERSION HISTORY
// =====================================================
async function openHistoryDialog() {
  await persist();
  const d = state.design;
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  document.body.appendChild(modal);
  const render = async () => {
    const versions = await listVersions(d.id);
    modal.innerHTML = `<div class="modal wide">
      <div class="row"><h3>Version history</h3><span class="spacer"></span><button class="icon-btn" id="vhClose">${icon('x')}</button></div>
      <p class="muted">Artvas saves a version automatically every few minutes while you work (last 30 kept). You can also save one yourself.</p>
      <div class="row"><input class="search" id="vhName" placeholder="Version name (optional)" style="margin:0"><button class="btn primary" id="vhSave">Save version</button></div>
      <div class="versions">${
        versions
          .map(
            (v) => `<div class="version">
          <div class="vthumb">${v.design.pages?.[0]?.thumb ? `<img src="${v.design.pages[0].thumb}" alt="">` : ''}</div>
          <div class="vmeta"><b>${esc(v.label || 'Version')}</b><small>${new Date(v.createdAt).toLocaleString()} · ${v.design.pages.length} page(s) · ${v.design.width}×${v.design.height}</small></div>
          <button class="btn ghost small" data-vr="${v.id}">Restore</button>
          <button class="icon-btn danger" data-vd="${v.id}" title="Delete">${icon('trash')}</button>
        </div>`
          )
          .join('') || '<p class="muted">No versions yet.</p>'
      }</div></div>`;
    $('#vhClose').onclick = () => modal.remove();
    $('#vhSave').onclick = async () => {
      captureCurrentPage();
      await saveVersion(d, $('#vhName').value.trim() || 'Saved version');
      toast('Version saved');
      render();
    };
    $$('[data-vr]', modal).forEach(
      (b) =>
        (b.onclick = async () => {
          const v = await getVersion(b.dataset.vr);
          if (!v || !confirm('Restore this version? Your current design will be saved as a version first.')) return;
          captureCurrentPage();
          await saveVersion(d, 'Before restore');
          const restored = { ...structuredClone(v.design), id: d.id, updatedAt: Date.now() };
          await saveDesign(restored);
          modal.remove();
          await openEditor(restored);
          state.lastVersionAt = Date.now();
          toast('Version restored');
        })
    );
    $$('[data-vd]', modal).forEach((b) => (b.onclick = async () => { await deleteVersion(b.dataset.vd); render(); }));
  };
  modal.onclick = (e) => e.target === modal && modal.remove();
  render();
}

async function maybeAutoVersion() {
  const now = Date.now();
  if (now - state.lastVersionAt < 3 * 60 * 1000) return;
  state.lastVersionAt = now;
  try {
    await saveVersion(state.design, 'Auto-save');
  } catch (e) {
    console.warn(e);
  }
}

// =====================================================
// BACKGROUND REMOVER
// =====================================================
function bgRemoverHTML() {
  return `
    <h4>Background remover</h4>
    <button class="btn primary block" id="bgAI">${icon('wand')} Remove background (AI)</button>
    <p class="muted" id="bgAIstatus">Runs privately in your browser. First use downloads the AI model (~115 MB, then cached).</p>
    <div class="field"><label>Remove a color <b id="tolV">25</b></label>
      <div class="row"><input type="color" id="rcColor" value="#ffffff"><input type="range" id="rcTol" min="1" max="80" value="25" style="flex:1"></div>
      <div class="row mt"><button class="btn ghost small" id="rcAuto">Auto (corner color)</button><button class="btn ghost small" id="rcGo">Remove color</button></div>
    </div>
    ${state.canvas.getActiveObject()?._origSrc ? `<button class="btn ghost small" id="bgRestore">Restore original</button>` : ''}`;
}

function bindBgRemover(img) {
  const c = state.canvas;
  const replace = async (url) => {
    if (!img._origSrc) img._origSrc = img.getSrc();
    const w = img.width;
    const h = img.height;
    await img.setSrc(url, { crossOrigin: 'anonymous' });
    img.set({ width: w, height: h });
    if (img.filters?.length) img.applyFilters();
    img.setCoords();
    c.requestRenderAll();
    pushHistory();
    schedulePersist();
  };
  const ai = $('#bgAI');
  if (ai)
    ai.onclick = async () => {
      const status = $('#bgAIstatus');
      ai.disabled = true;
      try {
        const url = await removeBackgroundAI(img.getSrc(), (msg) => { if (status) status.textContent = msg; });
        await replace(url);
        toast('Background removed');
      } catch (e) {
        console.error(e);
        toast('Background removal failed: ' + (e.message || e));
      }
      if (ai.isConnected) {
        ai.disabled = false;
        renderProps();
      }
    };
  const tol = $('#rcTol');
  if (tol) tol.oninput = () => ($('#tolV').textContent = tol.value);
  const go = async (auto) => {
    try {
      await replace(await removeColor(img.getSrc(), auto ? null : $('#rcColor').value, +$('#rcTol').value));
    } catch (e) {
      toast('Could not process this image');
    }
    renderProps();
  };
  const rcGo = $('#rcGo');
  if (rcGo) rcGo.onclick = () => go(false);
  const rcAuto = $('#rcAuto');
  if (rcAuto) rcAuto.onclick = () => go(true);
  const rs = $('#bgRestore');
  if (rs)
    rs.onclick = async () => {
      const src = img._origSrc;
      img._origSrc = null;
      await replace(src);
      img._origSrc = null;
      renderProps();
    };
}

// =====================================================
// ROUTING
// =====================================================
async function boot() {
  await loadBrand();
  const m = location.pathname.match(/^\/design\/([\w]+)/);
  if (m) {
    const d = await getDesign(m[1]).catch(() => null);
    if (d) return openEditor(d);
  }
  renderHome();
}
window.addEventListener('beforeunload', () => { if (state.design) captureCurrentPage(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.design) persist(); });
boot();

// expose a tiny API for debugging/testing
window.artvas = { state, addText, addShape, addImage, exportDesign, util };
