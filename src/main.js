import './style.css';
import './design-extra.css';
import {
  Canvas, StaticCanvas, Textbox, FabricImage, Group, ActiveSelection, PencilBrush, Shadow,
  Circle, Rect, filters, cache, util, InteractiveFabricObject, Path, Point, classRegistry,
} from 'fabric';
import qrcode from 'qrcode-generator';
import { needsSite } from './env.js';
import { jsPDF } from 'jspdf';
import { storageStatus, saveDesign, getDesign, listDesigns, deleteDesign, uid, listVersions, saveVersion, getVersion, deleteVersion, kvGet, kvSet } from './storage.js';
import {
  SIZE_PRESETS, FONTS, PALETTE, GRADIENTS, TEXT_PRESETS, TEXT_COMBOS, SHAPES, STICKERS, TEMPLATES, TEMPLATE_CATS, FORMATS, formatsFor,
} from './data.js';
import { removeBackgroundAI, removeColor } from './bgremove.js';
import { ANIMATIONS, PAGE_PRESETS, playPreview, exportGIF, exportVideo, animationLength, videoMime } from './animate.js';
import { createShape, makeGradient, buildTemplate, createPhotoPlaceholder } from './elements.js';
import {
  PACK_CATS, loadPack, flatSrc, loadIcons, POPULAR_ICONS, iconSVG, createIcon, CHART_PRESETS, buildChart, TABLE_PRESETS, buildTable,
  GRIDS, buildGrid, gridPreview, FRAMES, buildFrame, GRADIENT_ELEMENTS, buildGradientElement, gradientPreview,
} from './library.js';
import { AI_MODELS, AI_STYLES, closestRatio, getKey, setKey, generateImage, toDataURL, fetchMediaBlob, isFreeModel } from './ai.js';
import { openVideoEditor, closeVideoEditor, newVideoProject, VIDEO_PRESETS, SCREEN_SIZES, VIDEO_STARTERS, applyStarter, _videoDebug } from './video.js';
import { VIDEO_TEMPLATES, TEMPLATE_CATS as VT_CATS, buildFromTemplate, templateDuration } from './videotemplates.js';
import { icon } from './icons.js';
import { fontsIn, fontsInFully, coreFonts, loadFamily } from './fonts.js';

const PROPS = [
  'name', 'locked', 'selectable', 'evented', 'hasControls', 'lockMovementX', 'lockMovementY',
  'lockRotation', 'lockScalingX', 'lockScalingY', 'bgGradient', 'anim', 'placeholder', 'frameShape', 'kind', 'chart', 'table', 'aiPrompt',
  'curve', 'qr',
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
  tplFmt: 'fit',
  panelOpen: true,
  propsOpen: false,
  propsClosedByUser: false,
  autoFit: true,
  brand: { colors: [], headingFont: 'Montserrat', bodyFont: 'Inter', logos: [], fonts: [] },
  lastVersionAt: 0,
  myTemplates: [],
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
// Only the interface fonts load up front; design fonts load when a design or template needs them.
const fontsReady = coreFonts;

async function ensureFont(family, weight = '400', style = 'normal') {
  try {
    await Promise.race([document.fonts.load(`${style} ${weight} 40px "${family}"`), new Promise((r) => setTimeout(r, 3000))]);
    cache.clearFontCache(family);
  } catch {}
}

/** Re-measure all text once late fonts arrive (slow connections). */
function refreshTextWhenFontsLoad(obj) {
  fontsInFully(obj).then(() => {
    const c = state.canvas;
    if (!c) return;
    cache.clearFontCache();
    c.getObjects().forEach((o) => {
      if (o.initDimensions) {
        o.initDimensions();
        o.setCoords();
      }
    });
    c.requestRenderAll();
  });
}

// =====================================================
// HOME SCREEN
// =====================================================
async function renderHome() {
  closeVideoEditor();
  state.canvas?.dispose();
  state.canvas = null;
  state.design = null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  const designs = await listDesigns().catch(() => []);
  app.innerHTML = `
  <div class="home">
    <header class="home-top">
      <div class="logo">${logoSvg()}<span>Artvas</span></div>
      <div class="home-actions">
        <label class="btn ghost">${icon('folder')} Open file<input type="file" id="openFile" accept=".json,.artvas" class="file-hide" tabindex="-1"></label>
        <button class="btn primary" id="newCustomTop">${icon('plus')} Create a design</button>
      </div>
    </header>
    <section class="hero">
      <h1>Create anything. Design, video & AI in one studio.</h1>
      <p>Make posts, posters and presentations, edit videos for TikTok, Reels, RED and YouTube, and generate images with AI — free, in your browser.</p>
      <div class="mode-cards">
        <button class="mode-card" data-mode="design"><span class="mc-ic">${icon('layout', 22)}</span><b>Design</b><small>Posts, posters, slides</small></button>
        <button class="mode-card" data-mode="video"><span class="mc-ic">${icon('film', 22)}</span><b>Video</b><small>Edit clips, text & music</small></button>
        <button class="mode-card" data-mode="ai"><span class="mc-ic">${icon('wand', 22)}</span><b>AI Image</b><small>Describe it, get it</small></button>
      </div>
      <div class="custom-size">
        <input type="number" id="cw" value="1080" min="16" max="8000"> <span>×</span>
        <input type="number" id="ch" value="1080" min="16" max="8000"> <span>px</span>
        <button class="btn primary" id="newCustom">Create custom size</button>
      </div>
    </section>
    <section class="home-section" id="videoSection">
      <h2>Make a video</h2>
      <div class="vpresets">
        ${VIDEO_PRESETS.map((p, i) => `<button class="vpreset" data-vp="${i}" style="--pc:${p.color}">
          <div class="vp-frame"><div style="aspect-ratio:${p.w}/${p.h}"><span>${icon('play', 18)}</span></div></div>
          <b>${esc(p.name)}</b><small>${p.w} × ${p.h} · ${esc(p.hint)}</small></button>`).join('')}
      </div>
      <h3 class="fmt-title">More screen sizes</h3>
      <div class="size-chips">${SCREEN_SIZES.map((z, i) => `<button class="size-chip" data-ss="${i}"><i style="aspect-ratio:${z.w}/${z.h}"></i><span><b>${esc(z.name)}</b><small>${z.w}×${z.h}</small></span></button>`).join('')}</div>
      <div class="custom-video"><span>Custom video size</span><input type="number" id="vcw" value="1080" min="64" max="4096"> × <input type="number" id="vch" value="2340" min="64" max="4096"><button class="btn ghost small" id="vcGo">Create</button></div>
    </section>
    <section class="home-section">
      <h2>Video templates <small>(${VIDEO_TEMPLATES.length})</small></h2>
      <div class="chips" id="vtChips">${VT_CATS.map((c) => `<button class="chip ${c === 'All' ? 'on' : ''}" data-hvtc="${c}">${c}</button>`).join('')}</div>
      <div class="vt-row" id="vtRow">${VIDEO_TEMPLATES.map((t) => homeTemplateCard(t)).join('')}</div>
    </section>
    <section class="home-section" id="designSection">
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
    ${state.myTemplates.length ? `<section class="home-section">
      <h2>My templates <small>(${state.myTemplates.length})</small></h2>
      <div class="tpl-row mine-row">${myTemplateCards()}</div>
    </section>` : ''}
    <section class="home-section">
      <h2>Start from a template <small>(${TEMPLATES.length})</small></h2>
      ${Object.entries(FORMATS)
        .map(([key, f]) => {
          const list = TEMPLATES.map((t, i) => [t, i]).filter(([t]) => t.fmt === key);
          if (!list.length) return '';
          return `<h3 class="fmt-title">${f.plural || f.name + 's'} <small>${f.w} × ${f.h}</small></h3>
          <div class="tpl-row">${list
            .map(([t, i]) => `<button class="tpl-card" data-t="${i}" style="flex-basis:${Math.round(150 * Math.max(0.6, Math.min(1.9, f.w / f.h)))}px"><img alt="${esc(t.name)}" data-tplthumb="${i}" style="aspect-ratio:${f.w}/${f.h}"><span>${esc(t.name)}</span></button>`)
            .join('')}</div>`;
        })
        .join('')}
    </section>
    <section class="home-section">
      <h2>Your designs ${designs.length ? `<small>(${designs.length})</small>` : ''}</h2>
      ${
        designs.length
          ? `<div class="designs">${designs
              .map(
                (d) => `
            <div class="design-card" data-id="${d.id}">
              <div class="thumb">${(d.kind === 'video' ? d.thumb : d.pages?.[0]?.thumb) ? `<img src="${d.kind === 'video' ? d.thumb : d.pages[0].thumb}" alt="">` : ''}${d.kind === 'video' ? `<span class="kind-badge">${icon('play', 12)} Video</span>` : ''}</div>
              <div class="meta"><b>${esc(d.name || 'Untitled')}</b><small>${d.width}×${d.height} · ${d.kind === 'video' ? `${d.clips?.length || 0} clip(s)` : `${d.pages?.length || 1} page(s)`} · ${new Date(d.updatedAt).toLocaleString()}</small></div>
              <div class="card-actions">
                ${d.kind === 'video' ? '' : `<button class="icon-btn" data-dup="${d.id}" title="Duplicate">${icon('copy')}</button>`}
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
  $$('[data-vp]').forEach((b) => (b.onclick = () => pickVideoStarter(VIDEO_PRESETS[+b.dataset.vp])));
  $$('[data-ss]').forEach((b) => (b.onclick = () => pickVideoStarter(SCREEN_SIZES[+b.dataset.ss])));
  $('#vcGo').onclick = () => {
    const w = Math.max(64, Math.min(4096, Math.round(+$('#vcw').value || 1080)));
    const h = Math.max(64, Math.min(4096, Math.round(+$('#vch').value || 1920)));
    pickVideoStarter({ name: 'Custom video', w, h });
  };
  $$('[data-hvtc]').forEach((b) =>
    (b.onclick = () => {
      $$('[data-hvtc]').forEach((x) => x.classList.toggle('on', x === b));
      $$('#vtRow [data-hvt]').forEach((c) => (c.style.display = b.dataset.hvtc === 'All' || c.dataset.cat === b.dataset.hvtc ? '' : 'none'));
    })
  );
  $$('[data-hvt]').forEach((b) => (b.onclick = () => pickTemplateFormat(b.dataset.hvt)));
  $$('[data-mode]').forEach((b) =>
    (b.onclick = async () => {
      const m = b.dataset.mode;
      if (m === 'video') return $('#videoSection').scrollIntoView({ behavior: 'smooth' });
      if (m === 'design') return $('#designSection').scrollIntoView({ behavior: 'smooth' });
      state.tab = 'ai';
      await newDesign(1080, 1080, 'AI image');
    })
  );
  bindMyTemplateCards(app, (id) => newDesignFromMyTemplate(id), renderHome);
  $$('[data-t]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = TEMPLATES[+b.dataset.t];
      const f = FORMATS[t.fmt] || FORMATS.ig;
      newDesign(f.w, f.h, t.name, +b.dataset.t);
    })
  );
  $$('.design-card').forEach((c) =>
    c.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openDesign(c.dataset.id);
    })
  );
  $$('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await askConfirm('Delete this design permanently?', { ok: 'Delete', danger: true }))) return;
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
  if (storageStatus.blocked) showStorageBanner();
  // template thumbnails (rendered when scrolled into view)
  lazyThumbs($$('[data-tplthumb]'), (img) => {
    const t = TEMPLATES[+img.dataset.tplthumb];
    const f = FORMATS[t.fmt] || FORMATS.ig;
    return templateThumb(+img.dataset.tplthumb, f.w, f.h, 300);
  });
}

/** Render thumbnails only when they scroll into view, one at a time. */
function lazyThumbs(imgs, render) {
  let queue = Promise.resolve();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const img = e.target;
        queue = queue.then(async () => {
          if (!img.isConnected) return;
          try { img.src = await render(img); } catch (err) { console.warn(err); }
        });
      }
    },
    { rootMargin: '300px' }
  );
  imgs.forEach((img) => io.observe(img));
}

function logoSvg() {
  return `<svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset=".55" stop-color="#e2489a"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#lg)"/><path d="M17 48 32 14l15 34" stroke="#fff" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M27.5 33.5v10l9-5z" fill="#fff"/></svg>`;
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
  if (d.kind === 'video') return openVideo(d);
  openEditor(d);
}

// =====================================================
// VIDEO MODE
// =====================================================
function videoHelpers() {
  return {
    app, icon, esc, toast, logoSvg, isMobile, setKey, download,
    goHome: renderHome,
    listDesigns: () => listDesigns().catch(() => []),
    fetchMedia: fetchMediaBlob,
    designPageToBlob,
  };
}
async function openVideo(project, opts = {}) {
  state.canvas?.dispose();
  state.canvas = null;
  state.design = null;
  try { history.replaceState(null, '', `#/video/${project.id}`); } catch {}
  await openVideoEditor(project, videoHelpers(), opts);
}
function homeTemplateCard(t) {
  const sample = (t.layers.find((l) => l.text) || {}).text || t.name;
  return `<button class="vt-card" data-hvt="${t.id}" data-cat="${esc(t.cat)}" style="--tc:${t.color}">
    <div class="vt-thumb"><span class="vt-sample">${esc(sample.split('\n')[0])}</span><span class="vt-meta">${t.slots.length} clips · ${templateDuration(t).toFixed(0)}s</span></div>
    <b>${esc(t.name)}</b><small>${esc(t.cat)}</small></button>`;
}
async function startVideoFromTemplate(tplId, size) {
  const tpl = VIDEO_TEMPLATES.find((t) => t.id === tplId);
  const p = newVideoProject(size.w, size.h, tpl.name);
  const { clips, overlays } = buildFromTemplate(tpl, []);
  p.clips = clips;
  p.overlays = overlays;
  await saveDesign(p);
  openVideo(p, { tab: 'templates' });
}
function pickTemplateFormat(tplId) {
  const tpl = VIDEO_TEMPLATES.find((t) => t.id === tplId);
  const sizes = [VIDEO_PRESETS[0], VIDEO_PRESETS[2], SCREEN_SIZES[0], VIDEO_PRESETS[4], VIDEO_PRESETS[7], VIDEO_PRESETS[6]];
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal">
    <div class="row"><h3>${esc(tpl.name)}</h3><span class="spacer"></span><button class="icon-btn" data-x>${icon('x')}</button></div>
    <p class="muted">${tpl.slots.length} clips · ${templateDuration(tpl).toFixed(0)} seconds. Pick a format, then add your photos & videos.</p>
    <div class="starter-grid">${sizes.map((z, i) => `<button class="starter" data-zi="${i}"><b>${esc(z.name)}</b><small>${z.w} × ${z.h}</small></button>`).join('')}</div>
  </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal || e.target.closest('[data-x]')) return modal.remove();
    const b = e.target.closest('[data-zi]');
    if (!b) return;
    modal.remove();
    startVideoFromTemplate(tplId, sizes[+b.dataset.zi]);
  };
}
function pickVideoStarter(preset) {
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal">
    <div class="row"><h3>${esc(preset.name)} video</h3><span class="spacer"></span><button class="icon-btn" data-x>${icon('x')}</button></div>
    <p class="muted">${preset.w} × ${preset.h}. Start blank or pick a starter layout — you can change everything later.</p>
    <div class="starter-grid">
      <button class="starter" data-st=""><b>Blank video</b><small>Just your clips</small></button>
      ${VIDEO_STARTERS.map((st) => `<button class="starter" data-st="${st.id}"><b>${esc(st.name)}</b><small>${st.overlays.length} text layer${st.overlays.length > 1 ? 's' : ''}</small></button>`).join('')}
    </div>
    <h4>Or start from a video template</h4>
    <div class="vt-row small">${VIDEO_TEMPLATES.slice(0, 12).map((t) => homeTemplateCard(t).replace('data-hvt=', 'data-mvt=')).join('')}</div>
  </div>`;
  document.body.appendChild(modal);
  modal.onclick = async (e) => {
    if (e.target === modal || e.target.closest('[data-x]')) return modal.remove();
    const tb = e.target.closest('[data-mvt]');
    if (tb) {
      modal.remove();
      return startVideoFromTemplate(tb.dataset.mvt, preset);
    }
    const b = e.target.closest('[data-st]');
    if (!b) return;
    modal.remove();
    let p = newVideoProject(preset.w, preset.h, preset.name);
    if (b.dataset.st) p = applyStarter(p, b.dataset.st);
    await saveDesign(p);
    openVideo(p);
  };
}
/** Render one page of a design to a PNG blob (used to turn designs into video slides). */
async function designPageToBlob(d, i) {
  await fontsIn(d.pages[i]?.json);
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: d.width, height: d.height, enableRetinaScaling: false, renderOnAddRemove: false });
  if (d.pages[i]?.json) await sc.loadFromJSON(d.pages[i].json);
  if (!sc.backgroundColor) sc.backgroundColor = '#ffffff';
  sc.renderAll();
  const blob = await new Promise((r) => sc.lowerCanvasEl.toBlob(r, 'image/png'));
  sc.dispose();
  return blob;
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
  closeVideoEditor();
  state.design = design;
  state.page = 0;
  state.lastVersionAt = 0;
  try { history.replaceState(null, '', `#/design/${design.id}`); } catch {}
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
  state.panelOpen = !isMobile();
  state.propsOpen = false;
  state.propsClosedByUser = false;
  state.autoFit = true;
  syncPanels();
  $('#panelClose').onclick = () => setPanelOpen(false);
  $('#propsClose').onclick = () => {
    state.propsClosedByUser = true;
    setPropsOpen(false);
  };
  const ro = new ResizeObserver(() => {
    if (state.autoFit) fitZoom();
  });
  ro.observe($('#stage'));

  await fontsIn(design.pages);
  await loadPage(0);
  refreshTextWhenFontsLoad(design.pages);
  if (state.tab === 'ai') $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'ai'));
  fitZoom();
  renderTab();
  renderProps();
  renderPages();
}

function editorHTML() {
  const d = state.design;
  const tabs = [
    ['templates', 'layout', 'Templates'],
    ['ai', 'wand', 'AI Image'],
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
  <div class="editor" id="editor">
    <header class="topbar">
      <button class="icon-btn light" id="goHome" title="Home">${icon('home')}</button>
      <div class="logo small">${logoSvg()}<span>Artvas</span></div>
      <div class="sep"></div>
      <button class="icon-btn light" id="undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
      <button class="icon-btn light" id="redo" title="Redo (Ctrl+Y)">${icon('redo')}</button>
      <button class="tb-btn" id="resizeBtn" title="Resize design">${icon('resize')}<span class="lbl">Resize</span></button>
      <button class="tb-btn" id="historyBtn" title="Version history">${icon('clock')}<span class="lbl">History</span></button>
      <span class="save-status" id="saveStatus">Saved</span>
      <input class="title-input" id="title" value="${esc(d.name)}" spellcheck="false">
      <div class="spacer"></div>
      <span class="dim-label">${d.width} × ${d.height}px</span>
      <button class="tb-btn" id="saveFile" title="Download editable .json file">${icon('save')}<span class="lbl">Save file</span></button>
      <div class="dropdown">
        <button class="btn primary" id="shareBtn" title="Download">${icon('download')}<span class="lbl">Download</span></button>
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
      <aside class="panel" id="panelWrap">
        <div class="sheet-handle"></div>
        <button class="panel-close icon-btn" id="panelClose" title="Hide panel">${icon('chevLeft')}</button>
        <div class="panel-body" id="panel"></div>
      </aside>
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
      <aside class="props" id="propsWrap">
        <div class="sheet-handle"></div>
        <button class="panel-close icon-btn" id="propsClose" title="Hide edit panel">${icon('x')}</button>
        <div class="panel-body" id="props"></div>
      </aside>
    </div>
    <div class="ctxmenu" id="ctxMenu" hidden></div>
    <input type="file" id="fileUpload" accept="image/*" multiple class="file-hide" tabindex="-1">
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
  $('#zoomIn').onclick = () => { state.autoFit = false; setZoom(state.zoom * 1.2); };
  $('#zoomOut').onclick = () => { state.autoFit = false; setZoom(state.zoom / 1.2); };
  $('#zoomFit').onclick = () => { state.autoFit = true; fitZoom(); };
  $('#zoomRange').oninput = (e) => { state.autoFit = false; setZoom(+e.target.value / 100); };
  $('#stage').addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      state.autoFit = false;
      setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    },
    { passive: false }
  );
  bindStagePinch($('#stage'));
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
/**
 * Phones and tablets: pinch with two fingers to zoom the design around the fingers,
 * and move both fingers to pan. While two fingers are down, objects can't be grabbed.
 */
function bindStagePinch(stage) {
  let pinch = null;
  const mid = (ts) => ({ x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 });
  const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const start = (e) => {
    const c = state.canvas;
    if (!c) return;
    pinch = { d: dist(e.touches), z: state.zoom, m: mid(e.touches), skip: c.skipTargetFind, sel: c.selection };
    // the first finger may already have started moving an object: put it back and stop that drag
    const t = c._currentTransform;
    if (t?.target && t.original) {
      const { left, top, scaleX, scaleY, angle, skewX, skewY, flipX, flipY } = t.original;
      t.target.set(Object.fromEntries(Object.entries({ left, top, scaleX, scaleY, angle, skewX, skewY, flipX, flipY }).filter(([, v]) => v !== undefined)));
      t.target.setCoords();
    }
    c._currentTransform = null;
    c._groupSelector = null;
    c.requestRenderAll();
    // keep the first finger from dragging or selecting while zooming
    c.skipTargetFind = true;
    c.selection = false;
    state.autoFit = false;
  };
  stage.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) start(e);
    },
    { capture: true, passive: true }
  );
  stage.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 2) return;
      if (!pinch) start(e);
      e.preventDefault();
      const c = state.canvas;
      if (!c) return;
      const m = mid(e.touches);
      const el = c.lowerCanvasEl;
      const r0 = el.getBoundingClientRect();
      const old = state.zoom;
      // the design point under the fingers stays under the fingers
      const px = (pinch.m.x - r0.left) / old;
      const py = (pinch.m.y - r0.top) / old;
      setZoom((pinch.z * dist(e.touches)) / Math.max(10, pinch.d));
      const r1 = el.getBoundingClientRect();
      stage.scrollLeft += r1.left + px * state.zoom - m.x;
      stage.scrollTop += r1.top + py * state.zoom - m.y;
      pinch.m = m;
    },
    { capture: true, passive: false }
  );
  const end = (e) => {
    if (!pinch || e.touches.length >= 2) return;
    const c = state.canvas;
    if (c) {
      c.skipTargetFind = pinch.skip;
      c.selection = pinch.sel;
    }
    pinch = null;
  };
  stage.addEventListener('touchend', end, { capture: true, passive: true });
  stage.addEventListener('touchcancel', end, { capture: true, passive: true });
}

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
  const pad = isMobile() ? 24 : 56;
  const z = Math.min((stage.clientWidth - pad) / state.design.width, (stage.clientHeight - pad) / state.design.height);
  if (!(z > 0)) return;
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
  // curved text is shown straight while typing, so its box changes size
  const refit = (e) => { const t = e.target; if (t?.curve) { t.dirty = true; t.setCoords(); c.requestRenderAll(); } };
  c.on('text:editing:entered', refit);
  c.on('text:editing:exited', refit);
  const onSel = () => {
    if (state.crop && c.getActiveObject() !== state.crop.box) {
      c.setActiveObject(state.crop.box);
      c.requestRenderAll();
    }
    renderProps();
    if (state.tab === 'animate' || state.tab === 'ai') renderTab();
  };
  c.on('selection:created', onSel);
  c.on('selection:updated', onSel);
  c.on('selection:cleared', onSel);

  // Smart guides: snap to page center and edges
  let guides = [];
  c.on('object:moving', (e) => {
    const o = e.target;
    if (state.crop) return;
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
  if (active?.isEditing || state.crop) return;
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
    if (state.crop) {
      if (k === 'escape') finishCrop(false);
      else if (k === 'enter') { e.preventDefault(); finishCrop(true); }
      else if (k === 'delete' || k === 'backspace') e.preventDefault();
      return;
    }
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
  if (state.loading || !state.canvas || state.crop) return;
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
  if (state.crop) finishCrop(false);
  if (state.history.length < 2) return;
  state.redo.push(state.history.pop());
  await restore(state.history[state.history.length - 1]);
  updateUndoButtons();
}
async function redo() {
  if (state.crop) finishCrop(false);
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
  if (state.crop) finishCrop(false);
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
  if (state.crop) return; // saved when the crop is finished
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
  if (state.crop) finishCrop(false);
  state.page = i;
  await fontsIn(state.design.pages[i]?.json);
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
        if (!(await askConfirm(`Delete page ${i + 1}?`, { ok: 'Delete page', danger: true }))) return;
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
  if (isMobile()) setPanelOpen(false);
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

async function fillPlaceholder(ph, src) {
  const c = state.canvas;
  const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
  const w = ph.width * ph.scaleX;
  const h = ph.height * ph.scaleY;
  const s = Math.max(w / img.width, h / img.height);
  const center = ph.getCenterPoint();
  const rx = (ph.rx || 0) * ph.scaleX;
  img.set({ scaleX: s, scaleY: s, originX: 'center', originY: 'center', left: center.x, top: center.y, angle: ph.angle || 0, name: 'Photo' });
  if (ph.frameShape && ph.type !== 'rect') {
    const clip = createShape(ph.frameShape, 100);
    clip.set({ originX: 'center', originY: 'center', left: 0, top: 0, strokeWidth: 0, scaleX: w / s / clip.width, scaleY: h / s / clip.height });
    img.clipPath = clip;
  } else {
    img.clipPath = new Rect({ width: w / s, height: h / s, rx: rx / s, ry: rx / s, originX: 'center', originY: 'center' });
  }
  const idx = c.getObjects().indexOf(ph);
  state.loading = true;
  c.remove(ph);
  c.insertAt(idx, img);
  state.loading = false;
  img.setCoords();
  c.setActiveObject(img);
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderLayersIfOpen();
  renderProps();
  return img;
}

function addPhotoPlaceholder() {
  const m = minSide() * 0.5;
  return place(createPhotoPlaceholder(m, m * 0.75, {}));
}

async function addImage(src, opts = {}) {
  const active = state.canvas.getActiveObject();
  if (active?.placeholder && !opts.noFill) {
    try {
      return await fillPlaceholder(active, src);
    } catch (e) {
      console.error(e);
      return toast('Could not load image');
    }
  }
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
  if (hasContent && !(await askConfirm('Replace the current page with this template?', { ok: 'Replace' }))) return;
  await fontsIn(tpl.items);
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

const thumbCache = new Map();
async function templateThumb(i, W, H, size) {
  const key = `${i}:${W}x${H}:${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  await fontsIn(TEMPLATES[i].items, 2500);
  const k = Math.min(1, size / Math.max(W, H)) * 1.5;
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: Math.round(W * k), height: Math.round(H * k), enableRetinaScaling: false, renderOnAddRemove: false });
  sc.setZoom(k);
  const tpl = TEMPLATES[i];
  sc.backgroundColor = tpl.bg.gradient ? makeGradient(tpl.bg.gradient, W, H, tpl.bg.angle ?? 135) : tpl.bg.color;
  buildTemplate(tpl, W, H).forEach((o) => sc.add(o));
  sc.renderAll();
  const url = sc.toDataURL({ format: 'jpeg', quality: 0.82 });
  sc.dispose();
  thumbCache.set(key, url);
  return url;
}

// =====================================================
// LEFT PANEL TABS
// =====================================================
function bindTabs() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      if (state.tab === t.dataset.tab && state.panelOpen) {
        setPanelOpen(false);
        return;
      }
      state.tab = t.dataset.tab;
      state.elView = null;
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      if (isMobile()) setPropsOpen(false);
      setPanelOpen(true);
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
  const map = { ai: tabAI, templates: tabTemplates, text: tabText, elements: tabElements, uploads: tabUploads, photos: tabPhotos, draw: tabDraw, background: tabBackground, animate: tabAnimate, brand: tabBrand, layers: tabLayers };
  map[state.tab]?.(p);
}

async function tabTemplates(p) {
  const mine = state.myTemplates;
  const fits = formatsFor(state.design.width, state.design.height);
  const cats = [TEMPLATE_CATS[0], ...(mine.length ? ['Mine'] : []), ...TEMPLATE_CATS.slice(1)];
  if (!cats.includes(state.tplCat)) state.tplCat = 'All';
  p.innerHTML = `<h3>Templates</h3>
    <button class="btn primary block" id="saveTpl">${icon('save')} Save this design as a template</button>
    <input class="search" id="tplSearch" placeholder="Search templates…">
    <select id="tplFmt" class="fmt-select">
      <option value="fit">Fits this design${fits.length ? ` (${fits.map((k) => FORMATS[k].name).join(', ')})` : ''}</option>
      <option value="all">All formats</option>
      ${Object.entries(FORMATS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}
    </select>
    <div class="chips">${cats.map((c) => `<button class="chip ${state.tplCat === c ? 'on' : ''}" data-cat="${c}">${c === 'Mine' ? 'My templates' : c}</button>`).join('')}</div>
    <div id="mineWrap">
      <div class="row"><h4 style="margin:6px 0">My templates ${mine.length ? `<small class="muted">(${mine.length})</small>` : ''}</h4><span class="spacer"></span>
        <label class="btn ghost small" id="tplImport" for="tplImportFile" role="button" tabindex="0" title="Import templates from a file">Import</label>
        ${mine.length ? `<button class="btn ghost small" id="tplExport" title="Download your templates as a file">Export</button>` : ''}
        <input type="file" id="tplImportFile" accept=".json" class="file-hide" tabindex="-1"></div>
      ${mine.length ? `<div class="tpl-grid">${myTemplateCards()}</div>` : `<p class="muted">Design something, then click “Save this design as a template” to reuse it anytime.</p>`}
    </div>
    <h4 id="builtinTitle">Artvas templates</h4>
    <div class="tpl-grid" id="builtinGrid">${TEMPLATES.map(
      (t, i) => `<button class="tpl-card" data-ti="${i}" data-name="${esc(t.name.toLowerCase())} ${t.cat.toLowerCase()} ${FORMATS[t.fmt].name.toLowerCase()}" data-tcat="${t.cat}" data-fmt="${t.fmt}"><img data-tthumb="${i}" alt="" style="aspect-ratio:${state.design.width}/${state.design.height}"><span>${esc(t.name)}</span><small>${FORMATS[t.fmt].name}</small></button>`
    ).join('')}</div>`;
  const filter = () => {
    const q = $('#tplSearch', p).value.toLowerCase();
    const cat = state.tplCat;
    const fmt = state.tplFmt;
    const fmtOk = (f) => fmt === 'all' || (fmt === 'fit' ? !fits.length || fits.includes(f) || q : f === fmt);
    $$('[data-ti]', p).forEach((b) => {
      const ok = (cat === 'All' || b.dataset.tcat === cat) && b.dataset.name.includes(q) && fmtOk(b.dataset.fmt);
      b.style.display = ok ? '' : 'none';
    });
    $$('[data-mt]', p).forEach((b) => {
      b.style.display = b.dataset.name.includes(q) ? '' : 'none';
    });
    $('#mineWrap', p).style.display = cat === 'All' || cat === 'Mine' ? '' : 'none';
    $('#builtinTitle', p).style.display = cat === 'Mine' ? 'none' : '';
    $('#builtinGrid', p).style.display = cat === 'Mine' ? 'none' : '';
  };
  $('#tplSearch', p).oninput = filter;
  $('#tplFmt', p).value = state.tplFmt;
  $('#tplFmt', p).onchange = (e) => {
    state.tplFmt = e.target.value;
    filter();
  };
  $$('[data-cat]', p).forEach(
    (b) =>
      (b.onclick = () => {
        state.tplCat = b.dataset.cat;
        $$('[data-cat]', p).forEach((x) => x.classList.toggle('on', x === b));
        filter();
      })
  );
  filter();
  $('#saveTpl', p).onclick = openSaveTemplateDialog;
  $('#tplImportFile', p).onchange = async (e) => {
    await importMyTemplates(e.target.files[0]);
    tabTemplates(p);
  };
  const ex = $('#tplExport', p);
  if (ex) ex.onclick = exportMyTemplates;
  bindMyTemplateCards(p, (id) => applyMyTemplate(id), () => tabTemplates(p));
  $$('[data-ti]', p).forEach((b) => (b.onclick = () => applyTemplate(+b.dataset.ti)));
  const { width: W, height: H } = state.design;
  lazyThumbs($$('[data-tthumb]', p), (img) => templateThumb(+img.dataset.tthumb, W, H, 220));
}

function tabText(p) {
  p.innerHTML = `
    <h3>Text</h3>
    <button class="btn primary block" id="addTextBox">${icon('type')} Add a text box</button>
    ${magicWriteHTML()}
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
  bindMagicWrite(p);
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

// ---------- Elements library ----------
async function tabElements(p, view = state.elView) {
  state.elView = view || null;
  const back = `<button class="link-btn" id="elBack">${icon('chevLeft', 16)} Elements</button>`;
  // --- Detail views
  if (view?.section === '3d' || view?.section === 'flat') {
    const kind = view.section;
    const cat = view.cat || 'objects';
    p.innerHTML = `${back}<h3>${kind === '3d' ? '3D graphics' : 'Illustrations'}</h3>
      <div class="chips">${PACK_CATS.map(([k, l]) => `<button class="chip ${k === cat ? 'on' : ''}" data-pc="${k}">${l}</button>`).join('')}</div>
      <div class="lib-grid ${kind}" id="packGrid"><p class="muted">Loading…</p></div>`;
    $('#elBack', p).onclick = () => tabElements(p, null);
    $$('[data-pc]', p).forEach((b) => (b.onclick = () => tabElements(p, { section: kind, cat: b.dataset.pc })));
    try {
      const items = await loadPack(kind, cat);
      if (!$('#packGrid', p)) return;
      $('#packGrid', p).innerHTML = items.map((it, i) => `<button class="lib-item" data-pi="${i}" title="${esc(it.n)}"><img loading="lazy" src="${kind === '3d' ? it.d : flatSrc(it.s)}" alt="${esc(it.n)}"></button>`).join('');
      $$('[data-pi]', p).forEach((b) => (b.onclick = () => addGraphic(kind, items[+b.dataset.pi])));
    } catch {
      $('#packGrid', p).innerHTML = '<p class="muted">Could not load graphics.</p>';
    }
    return;
  }
  if (view?.section === 'icons') {
    p.innerHTML = `${back}<h3>Icons</h3><input class="search" id="icSearch" placeholder="Search 2,000+ icons…" value="${esc(view.q || '')}">
      <div class="lib-grid icons" id="icGrid"><p class="muted">Loading…</p></div>`;
    $('#elBack', p).onclick = () => tabElements(p, null);
    const nodes = await loadIcons();
    const render = () => {
      const q = $('#icSearch', p).value.trim().toLowerCase();
      const names = q ? Object.keys(nodes).filter((n) => n.includes(q)).slice(0, 240) : POPULAR_ICONS.filter((n) => nodes[n]).concat(Object.keys(nodes).slice(0, 180));
      $('#icGrid', p).innerHTML = names.map((n) => `<button class="lib-item ic" data-ic="${n}" title="${n}">${iconSVG(nodes[n], 'currentColor').replace('width="24" height="24"', 'width="30" height="30"')}</button>`).join('') || '<p class="muted">No icons found.</p>';
      $$('[data-ic]', p).forEach((b) => (b.onclick = () => addIconEl(b.dataset.ic)));
    };
    $('#icSearch', p).oninput = render;
    render();
    return;
  }
  if (view?.section === 'shapes') {
    p.innerHTML = `${back}<h3>Shapes & lines</h3><div class="shape-grid">${SHAPES.map((s) => `<button class="shape-item" data-shape="${s.id}" title="${s.label}">${shapePreview(s.id)}<small>${s.label}</small></button>`).join('')}</div>`;
    $('#elBack', p).onclick = () => tabElements(p, null);
    $$('[data-shape]', p).forEach((b) => (b.onclick = () => addShape(b.dataset.shape)));
    return;
  }

  // --- Overview
  const row = (id, title, inner) => `<section class="lib-sec"><div class="lib-head"><h4>${title}</h4>${id ? `<button class="link-btn" data-see="${id}">See all</button>` : ''}</div><div class="lib-row">${inner}</div></section>`;
  p.innerHTML = `
    <h3>Elements</h3>
    <input class="search" id="elSearch" placeholder="Search graphics, icons, shapes…">
    <div id="elResults"></div>
    <div id="elOverview">
      ${row('shapes', 'Shapes', SHAPES.slice(0, 10).map((s) => `<button class="shape-item" data-shape="${s.id}" title="${s.label}">${shapePreview(s.id)}</button>`).join(''))}
      ${row('3d', '3D graphics', '<span class="muted">Loading…</span>').replace('class="lib-row"', 'class="lib-row" id="row3d"')}
      ${row('flat', 'Illustrations', '<span class="muted">Loading…</span>').replace('class="lib-row"', 'class="lib-row" id="rowFlat"')}
      ${row('icons', 'Icons', '<span class="muted">Loading…</span>').replace('class="lib-row"', 'class="lib-row" id="rowIcons"')}
      ${qrSectionHTML()}
      ${row('', 'Photo frames', FRAMES.map((f) => `<button class="shape-item frame" data-frame2="${f}" title="${f}">${framePreview(f)}</button>`).join(''))}
      ${row('', 'Photo grids', GRIDS.map((g, i) => `<button class="shape-item grid" data-grid="${i}" title="${g.label}">${gridPreview(g)}</button>`).join(''))}
      ${row('', 'Charts', CHART_PRESETS.map((c, i) => `<button class="chart-item" data-chart="${i}" title="${c.label}">${chartPreview(c.type)}<small>${c.label}</small></button>`).join(''))}
      ${row('', 'Tables', TABLE_PRESETS.map((t, i) => `<button class="chart-item" data-table="${i}">${tablePreview(t)}<small>${t.label}</small></button>`).join(''))}
      ${row('', 'Gradients', GRADIENT_ELEMENTS.map((g, i) => `<button class="shape-item" data-gel="${i}">${gradientPreview(g)}</button>`).join(''))}
      ${row('', 'Stickers', STICKERS.slice(0, 24).map((s) => `<button class="sticker" data-st="${s}">${s}</button>`).join(''))}
    </div>`;
  $$('[data-see]', p).forEach((b) => (b.onclick = () => tabElements(p, { section: b.dataset.see })));
  $$('[data-shape]', p).forEach((b) => (b.onclick = () => addShape(b.dataset.shape)));
  $$('[data-frame2]', p).forEach((b) => (b.onclick = () => addFrameEl(b.dataset.frame2)));
  $$('[data-grid]', p).forEach((b) => (b.onclick = () => addGridEl(+b.dataset.grid)));
  $$('[data-chart]', p).forEach((b) => (b.onclick = () => addChartEl(CHART_PRESETS[+b.dataset.chart])));
  $$('[data-table]', p).forEach((b) => (b.onclick = () => addTableEl(TABLE_PRESETS[+b.dataset.table])));
  $$('[data-gel]', p).forEach((b) => (b.onclick = () => addGradientEl(GRADIENT_ELEMENTS[+b.dataset.gel])));
  $$('[data-st]', p).forEach((b) => (b.onclick = () => addSticker(b.dataset.st)));
  bindQrSection(p);

  // Search across graphics + icons + shapes
  $('#elSearch', p).oninput = debounce(async (e) => {
    const q = e.target.value.trim().toLowerCase();
    const res = $('#elResults', p);
    $('#elOverview', p).hidden = !!q;
    if (q.length < 2) return (res.innerHTML = '');
    res.innerHTML = '<p class="muted">Searching…</p>';
    const [nodes, ...packs] = await Promise.all([
      loadIcons(),
      ...PACK_CATS.map(([k]) => loadPack('3d', k).catch(() => [])),
      ...PACK_CATS.map(([k]) => loadPack('flat', k).catch(() => [])),
    ]);
    if ($('#elSearch', p)?.value.trim().toLowerCase() !== q) return;
    const g3 = packs.slice(0, PACK_CATS.length).flat().filter((it) => it.n.includes(q)).slice(0, 40);
    const gf = packs.slice(PACK_CATS.length).flat().filter((it) => it.n.includes(q)).slice(0, 40);
    const ics = Object.keys(nodes).filter((n) => n.includes(q)).slice(0, 40);
    const shp = SHAPES.filter((s) => s.label.toLowerCase().includes(q));
    res.innerHTML =
      (shp.length ? `<h4>Shapes</h4><div class="shape-grid">${shp.map((s) => `<button class="shape-item" data-shape="${s.id}">${shapePreview(s.id)}<small>${s.label}</small></button>`).join('')}</div>` : '') +
      (g3.length ? `<h4>3D graphics</h4><div class="lib-grid 3d">${g3.map((it, i) => `<button class="lib-item" data-s3="${i}" title="${esc(it.n)}"><img src="${it.d}" alt=""></button>`).join('')}</div>` : '') +
      (gf.length ? `<h4>Illustrations</h4><div class="lib-grid flat">${gf.map((it, i) => `<button class="lib-item" data-sf="${i}" title="${esc(it.n)}"><img src="${flatSrc(it.s)}" alt=""></button>`).join('')}</div>` : '') +
      (ics.length ? `<h4>Icons</h4><div class="lib-grid icons">${ics.map((n) => `<button class="lib-item ic" data-ic="${n}" title="${n}">${iconSVG(nodes[n], 'currentColor').replace('width="24" height="24"', 'width="30" height="30"')}</button>`).join('')}</div>` : '') ||
      `<p class="muted">Nothing found for “${esc(q)}”.</p>`;
    $$('[data-shape]', res).forEach((b) => (b.onclick = () => addShape(b.dataset.shape)));
    $$('[data-s3]', res).forEach((b) => (b.onclick = () => addGraphic('3d', g3[+b.dataset.s3])));
    $$('[data-sf]', res).forEach((b) => (b.onclick = () => addGraphic('flat', gf[+b.dataset.sf])));
    $$('[data-ic]', res).forEach((b) => (b.onclick = () => addIconEl(b.dataset.ic)));
  }, 250);

  // Fill the preview rows
  loadPack('3d', 'objects').then((items) => {
    const r = $('#row3d', p);
    if (!r) return;
    const pick = items.slice(0, 14);
    r.innerHTML = pick.map((it, i) => `<button class="lib-item" data-r3="${i}" title="${esc(it.n)}"><img src="${it.d}" alt=""></button>`).join('');
    $$('[data-r3]', r).forEach((b) => (b.onclick = () => addGraphic('3d', pick[+b.dataset.r3])));
  }).catch(() => ($('#row3d', p).innerHTML = '<span class="muted">Unavailable</span>'));
  loadPack('flat', 'nature').then((items) => {
    const r = $('#rowFlat', p);
    if (!r) return;
    const pick = items.slice(0, 14);
    r.innerHTML = pick.map((it, i) => `<button class="lib-item" data-rf="${i}" title="${esc(it.n)}"><img src="${flatSrc(it.s)}" alt=""></button>`).join('');
    $$('[data-rf]', r).forEach((b) => (b.onclick = () => addGraphic('flat', pick[+b.dataset.rf])));
  }).catch(() => ($('#rowFlat', p).innerHTML = '<span class="muted">Unavailable</span>'));
  loadIcons().then((nodes) => {
    const r = $('#rowIcons', p);
    if (!r) return;
    r.innerHTML = POPULAR_ICONS.slice(0, 16).filter((n) => nodes[n]).map((n) => `<button class="lib-item ic" data-ic="${n}" title="${n}">${iconSVG(nodes[n], 'currentColor').replace('width="24" height="24"', 'width="28" height="28"')}</button>`).join('');
    $$('[data-ic]', r).forEach((b) => (b.onclick = () => addIconEl(b.dataset.ic)));
  }).catch(() => ($('#rowIcons', p).innerHTML = '<span class="muted">Unavailable</span>'));
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function framePreview(f) {
  if (f === 'polaroid') return `<svg viewBox="0 0 40 40" width="44" height="44"><rect x="8" y="4" width="24" height="32" fill="#fff" stroke="#d4d4d8"/><rect x="10" y="6" width="20" height="21" fill="currentColor" opacity=".7"/></svg>`;
  if (f === 'phone') return `<svg viewBox="0 0 40 40" width="44" height="44"><rect x="12" y="2" width="16" height="36" rx="3" fill="#111827"/><rect x="13.5" y="4" width="13" height="32" rx="2" fill="currentColor" opacity=".7"/></svg>`;
  if (f === 'arch') return `<svg viewBox="0 0 40 40" width="44" height="44"><path d="M6 38V18a14 14 0 0 1 28 0v20z" fill="currentColor" opacity=".75"/></svg>`;
  return shapePreview(f).replace('fill="currentColor"', 'fill="currentColor" opacity=".75"');
}
function chartPreview(type) {
  const c = '#7c3aed';
  const P = {
    bar: `<rect x="4" y="22" width="6" height="14" fill="${c}"/><rect x="13" y="12" width="6" height="24" fill="#ec4899"/><rect x="22" y="18" width="6" height="18" fill="#f59e0b"/><rect x="31" y="6" width="6" height="30" fill="#10b981"/>`,
    hbar: `<rect x="4" y="5" width="30" height="6" rx="3" fill="${c}"/><rect x="4" y="14" width="22" height="6" rx="3" fill="#ec4899"/><rect x="4" y="23" width="15" height="6" rx="3" fill="#f59e0b"/><rect x="4" y="32" width="9" height="5" rx="2.5" fill="#10b981"/>`,
    line: `<path d="M3 32 L12 20 L20 25 L28 12 L37 8" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    donut: `<circle cx="20" cy="20" r="13" fill="none" stroke="${c}" stroke-width="7" stroke-dasharray="40 82"/><circle cx="20" cy="20" r="13" fill="none" stroke="#ec4899" stroke-width="7" stroke-dasharray="25 82" stroke-dashoffset="-40"/><circle cx="20" cy="20" r="13" fill="none" stroke="#f59e0b" stroke-width="7" stroke-dasharray="17 82" stroke-dashoffset="-65"/>`,
    pie: `<path d="M20 20 L20 4 A16 16 0 0 1 35 25 Z" fill="${c}"/><path d="M20 20 L35 25 A16 16 0 0 1 8 31 Z" fill="#ec4899"/><path d="M20 20 L8 31 A16 16 0 0 1 20 4 Z" fill="#f59e0b"/>`,
    progress: `<circle cx="20" cy="20" r="14" fill="none" stroke="#e5e7eb" stroke-width="5"/><circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="63 88" transform="rotate(-90 20 20)"/>`,
  };
  return `<svg viewBox="0 0 40 40" width="56" height="56">${P[type]}</svg>`;
}
function tablePreview(t) {
  const cols = t.rows[0].length;
  const cw = 36 / cols;
  let s = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < cols; c++) s += `<rect x="${2 + c * cw}" y="${4 + r * 6.5}" width="${cw}" height="6.5" fill="${r === 0 ? t.color : r % 2 ? '#fff' : '#f1f5f9'}" stroke="#e2e8f0" stroke-width=".5"/>`;
  return `<svg viewBox="0 0 40 40" width="56" height="56">${s}</svg>`;
}

async function addGraphic(kind, item) {
  const src = kind === '3d' ? item.d : flatSrc(item.s);
  const img = await FabricImage.fromURL(src);
  const size = minSide() * 0.35;
  img.scaleToWidth(size);
  img.set({ name: item.n.replace(/^\w/, (c) => c.toUpperCase()) });
  return place(img);
}

async function addIconEl(name) {
  const nodes = await loadIcons();
  if (!nodes[name]) return;
  const g = await createIcon(name, nodes[name], minSide() * 0.2, '#111827');
  return place(g);
}

function addFrameEl(kind) {
  const size = minSide() * 0.45;
  const f = buildFrame(kind, size);
  if (Array.isArray(f)) {
    const { width: W, height: H } = state.design;
    state.loading = true;
    f.forEach((o) => {
      o.set({ left: W / 2 + (o.left || 0), top: H / 2 + (o.top || 0) });
      if (o.name === 'Polaroid card') o.set({ shadow: new Shadow({ color: 'rgba(0,0,0,0.18)', blur: size * 0.06, offsetY: size * 0.02 }) });
      o.setCoords();
      state.canvas.add(o);
    });
    state.loading = false;
    state.canvas.setActiveObject(f[1]);
    state.canvas.requestRenderAll();
    pushHistory();
    schedulePersist();
    renderProps();
    if (isMobile()) setPanelOpen(false);
    return;
  }
  return place(f);
}

function addGridEl(i) {
  const { width: W, height: H } = state.design;
  const gap = minSide() * 0.015;
  const cells = buildGrid(GRIDS[i], W, H, gap);
  state.loading = true;
  cells.forEach((o) => state.canvas.add(o));
  state.loading = false;
  state.canvas.setActiveObject(cells[0]);
  state.canvas.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
  if (isMobile()) setPanelOpen(false);
  toast('Select a frame, then upload or pick a photo to fill it');
}

function addChartEl(spec) {
  return place(buildChart({ ...spec }, minSide() * 0.6));
}
function addTableEl(spec) {
  return place(buildTable({ ...spec, rows: spec.rows.map((r) => [...r]) }, minSide() * 0.7));
}
function addGradientEl(g) {
  return place(buildGradientElement(g, minSide() * 0.45));
}

/** Rebuild a chart or table in place after its data changed. */
function rebuildDataObject(o, build) {
  const c = state.canvas;
  const idx = c.getObjects().indexOf(o);
  const center = o.getCenterPoint();
  const { scaleX, scaleY, angle } = o;
  const g = build();
  g.set({ scaleX: scaleX * (o.width / g.width), scaleY: scaleY * (o.width / g.width), angle, originX: 'center', originY: 'center' });
  g.setPositionByOrigin(center, 'center', 'center');
  state.loading = true;
  c.remove(o);
  c.insertAt(idx, g);
  state.loading = false;
  g.setCoords();
  c.setActiveObject(g);
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
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
  P.arch = '<path d="M6 38V18a14 14 0 0 1 28 0v20z"/>';
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
    <label class="btn primary block" id="upBtn" for="fileUpload" role="button" tabindex="0">${icon('upload')} Upload images</label>
    <p class="muted">Or drag & drop / paste images onto the canvas. Drag a thumbnail onto the page to place it.</p>
    <div class="img-grid">${state.uploads
      .map((u, i) => `<div class="img-item"><img src="${u}" data-up="${i}" draggable="true" alt=""><button class="rm" data-rm="${i}" title="Remove">${icon('x')}</button></div>`)
      .join('') || '<p class="muted">No uploads yet.</p>'}</div>`;
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
    <label class="btn ghost block" id="bgUpload" for="bgFile" role="button" tabindex="0">${icon('upload')} Upload background image</label>
    ${c.backgroundImage ? `<button class="btn ghost block" id="bgRemove">${icon('x')} Remove background image</button>` : ''}
    <input type="file" id="bgFile" accept="image/*" class="file-hide" tabindex="-1">
    <p class="muted">Tip: in Photos, use the palette button on a photo to set it as background.</p>`;
  bindColorPicker('bgColor', (v) => setBackgroundFill({ color: v }));
  $$('[data-g]', p).forEach((b) => (b.onclick = () => setBackgroundFill({ gradient: GRADIENTS[+b.dataset.g] })));
  $('#gApply').onclick = () => setBackgroundFill({ gradient: [$('#g1').value, $('#g2').value], angle: +$('#gA').value });
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
    ${state.photoColors?.length ? `<small class="cp-label">Photo colours</small><div class="swatches photo-row" title="Colours from your last selected photo">${state.photoColors.map((c) => `<button style="background:${c}" data-cp="sw" data-c="${c}" title="Photo: ${c}"></button>`).join('')}</div>` : ''}
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
    if (o.kind === 'icon' && (key === 'fill' || key === 'stroke')) {
      (o.getObjects ? o.getObjects() : [o]).forEach((ch) => ch.set('stroke', value));
      o.dirty = true;
      return;
    }
    if ((o.chart || o.table || o.qr) && (key === 'fill' || key === 'stroke')) return;
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
  if (state.crop) return renderCropProps(el, bar);
  const o = c.getActiveObject();
  if (!o) {
    bar.innerHTML = `<span class="muted hint">Select an element to edit it · Right-click for more options · Shortcuts: T text, R rectangle, C circle</span><span class="spacer"></span>
      <button class="tb-btn small ctx-toggle" id="propsToggle" title="Page settings">${icon('palette')}<span>Page</span></button>`;
    el.innerHTML = pagePropsHTML();
    bindPageProps();
    $('#propsToggle').onclick = () => { state.propsClosedByUser = false; setPropsOpen(!state.propsOpen); };
    if (state.propsOpen && !state.propsPinned) setPropsOpen(false);
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
    ${img ? `<button class="tool" id="qCrop" title="Crop">${xicon('crop')}</button>` : ''}
    <span class="spacer"></span>
    <button class="tool" data-q="forward" title="Bring forward">${icon('up')}</button>
    <button class="tool" data-q="backward" title="Send backward">${icon('down')}</button>
    ${multi ? `<button class="tool" data-q="group" title="Group">${icon('group')}</button>` : ''}
    ${o.type === 'group' && !o.qr ? `<button class="tool" data-q="ungroup" title="Ungroup">${icon('ungroup')}</button>` : ''}
    <button class="tool ${o.locked ? 'on' : ''}" data-q="lock" title="Lock">${icon(o.locked ? 'lock' : 'unlock')}</button>
    <button class="tool" data-q="duplicate" title="Duplicate">${icon('copy')}</button>
    <button class="tool" data-q="delete" title="Delete">${icon('trash')}</button>`;

  // Right panel (full properties)
  el.innerHTML = `
    <h3>${multi ? `${o.getObjects().length} elements` : esc(o.name || o.type)}</h3>
    ${multi ? arrangeHTML(o) : ''}
    ${text ? `
    <div class="field"><label>Text color</label>${colorPicker('pFill', fill)}</div>
    <div class="field"><label>Line height <b>${(text.lineHeight || 1).toFixed(2)}</b></label><input type="range" min="0.5" max="3" step="0.05" value="${text.lineHeight}" id="pLH"></div>
    <div class="field"><label>Letter spacing <b>${text.charSpacing || 0}</b></label><input type="range" min="-200" max="1500" step="10" value="${text.charSpacing || 0}" id="pCS"></div>
    <div class="field"><label>Curve <b id="pCurveV">${text.curve || 0}</b></label><input type="range" min="-100" max="100" step="1" value="${text.curve || 0}" id="pCurve" class="curve-range">
      <div class="row curve-hint"><span class="muted">Arch down</span><button class="link-btn" id="pCurve0" ${text.curve ? '' : 'hidden'}>Straighten</button><span class="muted">Arch up</span></div></div>
    <div class="field"><label>Highlight</label><div class="row"><input type="color" id="pTBG" value="${toHex(text.textBackgroundColor || '#ffff00')}"><button class="btn ghost small" id="pTBGx">${text.textBackgroundColor ? 'Remove' : 'None'}</button></div></div>
    <div class="field"><label>Outline</label><div class="row"><input type="color" id="pStroke" value="${toHex(text.stroke || '#000000')}"><input type="range" min="0" max="${Math.round(text.fontSize / 4)}" step="0.5" value="${text.strokeWidth || 0}" id="pSW"></div></div>
    ` : ''}
    ${o.placeholder ? `<div class="ph-box">${icon('image', 28)}<b>Photo placeholder</b>
      <p class="muted">Upload a photo, or click any image in Uploads, Photos or Brand Kit logos to fill this frame.</p>
      <button class="btn primary block" id="phUpload">${icon('upload')} Upload photo</button>
      <button class="btn ghost block" id="phPhotos">${icon('image')} Choose from Photos</button>
      <button class="btn ghost block" id="phAI">${icon('wand')} Generate with AI</button></div>` : ''}
    ${dataPropsHTML(o)}
    ${!text && !img && !o.chart && !o.table && !o.qr ? `
    <div class="field"><label>${o.kind === 'icon' ? 'Icon color' : o.type === 'line' ? 'Line color' : 'Fill'}</label>${colorPicker('pFill', o.type === 'line' || (o.type === 'path' && !o.fill) ? o.stroke : fill)}</div>
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
    <h4>${multi ? 'Align to page' : 'Position'}</h4>
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
  bar.insertAdjacentHTML('beforeend', `<button class="tb-btn small ctx-toggle ${state.propsOpen ? 'on' : ''}" id="propsToggle" title="Show all edit options">${icon('resize')}<span>Edit</span></button>`);
  $('#propsToggle').onclick = () => { state.propsClosedByUser = !state.propsOpen ? false : true; state.propsPinned = false; setPropsOpen(!state.propsOpen); };
  if (!isMobile() && !state.propsClosedByUser && !state.propsOpen) setPropsOpen(true);
  bindProps(o, text, img);
}

function imageFiltersHTML(img) {
  const f = getFilterValues(img);
  const r = (id, label, min, max, step, v) =>
    `<label class="frow">${label} <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  return `
    ${imageExtrasHTML(img)}
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
    ${duotoneHTML(img)}
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
  const duo = (img.filters || []).find((f) => f?.type === 'Duotone');
  if (duo) list.push(duo);
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

  bindDataProps(o);
  bindExtras(o, text, img);
  // photo placeholder
  on('phUpload', 'onclick', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    attachPicker(inp);
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      const url = await shrinkDataURL(await fileToDataURL(f));
      state.uploads.unshift(url);
      saveUploads();
      await fillPlaceholder(o, url);
    };
    inp.click();
  });
  on('phPhotos', 'onclick', () => $('[data-tab="photos"]').click());
  on('phAI', 'onclick', () => {
    state.ai.promptTouched = false;
    if (state.tab === 'ai' && state.panelOpen) return renderTab();
    $('[data-tab="ai"]').click();
  });

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
      attachPicker(inp);
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
    <button class="btn ghost block" id="pgSaveTpl">${icon('save')} Save as template</button>
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
  $('#pgSaveTpl').onclick = openSaveTemplateDialog;
  $('#pgClear').onclick = async () => {
    if (!(await askConfirm('Remove everything from this page?', { ok: 'Clear page', danger: true }))) return;
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
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
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
  for (const page of d.pages) {
    if (page.json) page.json = await scalePageJSON(page.json, d.width, d.height, W2, H2);
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
  if (isEmbedded) showSaveFallback(url, filename);
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
  modal.onclick = (e) => { if (e.target === modal) close(); };
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
    <label class="btn ghost block" id="bfUpload" for="bfFile" role="button" tabindex="0">${icon('upload')} Upload a font (.ttf .otf .woff)</label>
    <input type="file" id="bfFile" accept=".ttf,.otf,.woff,.woff2" class="file-hide" tabindex="-1">
    ${(b.fonts || []).length ? `<div class="muted">Your fonts: ${b.fonts.map((f) => `<span class="tag" style="font-family:'${esc(f.name)}'">${esc(f.name)} <button data-bfrm="${esc(f.name)}">×</button></span>`).join(' ')}</div>` : ''}
    <h4>Logos</h4>
    <label class="btn ghost block" id="blUpload" for="blFile" role="button" tabindex="0">${icon('upload')} Upload logo</label>
    <input type="file" id="blFile" accept="image/*" multiple class="file-hide" tabindex="-1">
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
          if (!v || !(await askConfirm('Restore this version? Your current design will be saved as a version first.', { ok: 'Restore' }))) return;
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
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
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
    <p class="muted" id="bgAIstatus">Runs privately in your browser. First use downloads an AI model (44–115 MB, then cached).</p>
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
// MY TEMPLATES (user-saved templates)
// =====================================================
async function loadMyTemplates() {
  try {
    state.myTemplates = (await kvGet('myTemplates')) || [];
  } catch {
    state.myTemplates = [];
  }
}
async function saveMyTemplates() {
  try {
    await kvSet('myTemplates', state.myTemplates);
  } catch (e) {
    console.error(e);
    toast('Could not save templates (storage full?)');
  }
}

/** Scale a page's JSON from W×H to W2×H2, keeping everything centered and proportional. */
async function scalePageJSON(json, W, H, W2, H2) {
  if (!json) return json;
  if (W === W2 && H === H2) return structuredClone(json);
  const s = Math.min(W2 / W, H2 / H);
  const ox = (W2 - W * s) / 2;
  const oy = (H2 - H * s) / 2;
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: W, height: H, renderOnAddRemove: false });
  await sc.loadFromJSON(structuredClone(json));
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
  const g = sc.bgGradient || json.bgGradient;
  if (g) sc.backgroundColor = makeGradient(g.colors, W2, H2, g.angle);
  const out = sc.toObject(PROPS);
  sc.dispose();
  return out;
}

const TEMPLATE_DEFAULT_CATS = ['Social', 'Business', 'Sale', 'Event', 'Cards', 'Food', 'Holiday', 'Quote', 'Other'];

function openSaveTemplateDialog() {
  captureCurrentPage();
  const d = state.design;
  const cats = [...new Set([...state.myTemplates.map((t) => t.cat), ...TEMPLATE_DEFAULT_CATS])];
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal">
    <h3>Save as template</h3>
    <p class="muted">Your template appears under <b>My templates</b> and fits any design size when you use it.</p>
    <label class="flabel">Template name<input class="search" id="stName" value="${esc(d.name)}"></label>
    <label class="flabel">Category<input class="search" id="stCat" list="stCats" value="${esc(state.myTemplates[0]?.cat || 'Social')}"><datalist id="stCats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <div class="row"><label class="row"><input type="radio" name="stScope" value="page" checked> This page only</label>
    ${d.pages.length > 1 ? `<label class="row"><input type="radio" name="stScope" value="all"> All ${d.pages.length} pages</label>` : ''}</div>
    <div class="row end"><button class="btn ghost" id="stCancel">Cancel</button><button class="btn primary" id="stOk">Save template</button></div>
  </div>`;
  document.body.appendChild(modal);
  $('#stName').select();
  $('#stCancel').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  $('#stOk').onclick = async () => {
    const all = $('[name="stScope"]:checked', modal)?.value === 'all';
    const src = all ? d.pages : [d.pages[state.page]];
    const t = {
      id: uid(),
      name: $('#stName').value.trim() || 'My template',
      cat: $('#stCat').value.trim() || 'Other',
      width: d.width,
      height: d.height,
      pages: src.map((p) => ({ json: structuredClone(p.json), duration: p.duration })),
      thumb: src[0].thumb,
      createdAt: Date.now(),
    };
    state.myTemplates.unshift(t);
    await saveMyTemplates();
    modal.remove();
    toast(`Saved "${t.name}" to My templates`);
    if (state.tab === 'templates') renderTab();
  };
}

async function applyMyTemplate(id) {
  const t = state.myTemplates.find((x) => x.id === id);
  if (!t) return;
  const c = state.canvas;
  if (c.getObjects().length && !(await askConfirm('Replace the current page with this template?', { ok: 'Replace' }))) return;
  const d = state.design;
  const scaled = [];
  for (const p of t.pages) scaled.push(await scalePageJSON(p.json, t.width, t.height, d.width, d.height));
  captureCurrentPage();
  d.pages[state.page].json = scaled[0];
  d.pages[state.page].duration = t.pages[0].duration;
  const extra = scaled.slice(1).map((json, i) => ({ id: uid(), json, thumb: '', duration: t.pages[i + 1].duration }));
  d.pages.splice(state.page + 1, 0, ...extra);
  await loadPage(state.page);
  pushHistory();
  renderPages();
  await persist();
  if (extra.length) toast(`Template added (${t.pages.length} pages)`);
}

async function newDesignFromMyTemplate(id) {
  const t = state.myTemplates.find((x) => x.id === id);
  if (!t) return;
  const design = {
    id: uid(),
    name: t.name,
    width: t.width,
    height: t.height,
    pages: t.pages.map((p, i) => ({ id: uid(), json: structuredClone(p.json), thumb: i === 0 ? t.thumb : '', duration: p.duration })),
    updatedAt: Date.now(),
  };
  await saveDesign(design);
  await openEditor(design);
}

async function renameMyTemplate(id) {
  const t = state.myTemplates.find((x) => x.id === id);
  if (!t) return;
  const res = await askText('Edit template', [{ label: 'Template name', value: t.name }, { label: 'Category', value: t.cat }]);
  if (!res) return;
  const [name, cat] = res;
  t.name = name.trim() || t.name;
  t.cat = cat.trim() || t.cat;
  await saveMyTemplates();
}

async function deleteMyTemplate(id) {
  const t = state.myTemplates.find((x) => x.id === id);
  if (!t || !(await askConfirm(`Delete template "${t.name}"?`, { ok: 'Delete', danger: true }))) return;
  state.myTemplates = state.myTemplates.filter((x) => x.id !== id);
  await saveMyTemplates();
}

function exportMyTemplates() {
  if (!state.myTemplates.length) return toast('You have no templates to export yet');
  const blob = new Blob([JSON.stringify({ app: 'artvas-templates', version: 1, templates: state.myTemplates })], { type: 'application/json' });
  download(URL.createObjectURL(blob), 'artvas-templates.json');
  toast(`Exported ${state.myTemplates.length} template(s)`);
}

async function importMyTemplates(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    let list = [];
    if (Array.isArray(data.templates)) list = data.templates;
    else if (data.pages && data.width) {
      // An Artvas design file can be imported as a template too
      list = [{ id: uid(), name: data.name || 'Imported', cat: 'Other', width: data.width, height: data.height, pages: data.pages.map((p) => ({ json: p.json, duration: p.duration })), thumb: data.pages[0]?.thumb || '', createdAt: Date.now() }];
    } else throw new Error('bad');
    const ids = new Set(state.myTemplates.map((t) => t.id));
    const fresh = list.filter((t) => t && t.pages && t.width && !ids.has(t.id));
    state.myTemplates = [...fresh, ...state.myTemplates];
    await saveMyTemplates();
    toast(`Imported ${fresh.length} template(s)`);
  } catch {
    toast('That file is not an Artvas template file');
  }
}

function myTemplateCards(onUse) {
  return state.myTemplates
    .map(
      (t) => `<div class="tpl-card mine" data-mt="${t.id}" data-name="${esc((t.name + ' ' + t.cat).toLowerCase())}" data-tcat="${esc(t.cat)}">
      <div class="mt-thumb" style="aspect-ratio:${t.width}/${t.height}">${t.thumb ? `<img src="${t.thumb}" alt="">` : ''}${t.pages.length > 1 ? `<span class="pnum">${t.pages.length} pages</span>` : ''}</div>
      <span>${esc(t.name)}</span><small>${esc(t.cat)} · ${t.width}×${t.height}</small>
      <div class="mt-acts"><button data-mtren="${t.id}" title="Rename">✎</button><button data-mtdel="${t.id}" title="Delete">${icon('trash', 14)}</button></div>
    </div>`
    )
    .join('');
}

function bindMyTemplateCards(root, onUse, rerender) {
  $$('[data-mt]', root).forEach((card) =>
    card.addEventListener('click', async (e) => {
      const ren = e.target.closest('[data-mtren]');
      const del = e.target.closest('[data-mtdel]');
      if (ren) { await renameMyTemplate(ren.dataset.mtren); return rerender(); }
      if (del) { await deleteMyTemplate(del.dataset.mtdel); return rerender(); }
      onUse(card.dataset.mt);
    })
  );
}

// =====================================================
// IN-APP DIALOGS (work everywhere, including sandboxed frames)
// =====================================================
function askConfirm(message, { ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `<div class="modal small" role="dialog" aria-modal="true">
      <p class="dlg-msg">${esc(message)}</p>
      <div class="row end"><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div>
    </div>`;
    const done = (v) => { modal.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.stopPropagation(); done(true); }
    };
    modal.onclick = (e) => {
      if (e.target === modal) return done(false);
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
    };
    document.addEventListener('keydown', key, true);
    document.body.appendChild(modal);
    $('[data-r="1"]', modal).focus();
  });
}

/** Ask for one or more text values. fields: [{ label, value }]. Resolves to an array of strings or null. */
function askText(title, fields, { ok = 'Save' } = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-back';
    modal.innerHTML = `<form class="modal small" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>
      ${fields.map((f, i) => `<label class="flabel">${esc(f.label)}<input class="search" id="askf${i}" value="${esc(f.value || '')}"></label>`).join('')}
      <div class="row end"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="submit" class="btn primary">${esc(ok)}</button></div>
    </form>`;
    const form = $('form', modal);
    const done = (v) => { modal.remove(); resolve(v); };
    form.onsubmit = (e) => { e.preventDefault(); done(fields.map((_, i) => $(`#askf${i}`, modal).value)); };
    $('[data-cancel]', modal).onclick = () => done(null);
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    modal.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.body.appendChild(modal);
    $('#askf0', modal).select();
  });
}

const isEmbedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

/** When running inside a sandboxed frame (where downloads are blocked), show the file so it can be saved by hand. */
function showSaveFallback(url, filename) {
  const isImg = /\.(png|jpe?g|gif|svg)$/i.test(filename);
  const isVid = /\.(mp4|webm)$/i.test(filename);
  const modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal wide">
    <div class="row"><h3>${esc(filename)}</h3><span class="spacer"></span><button class="icon-btn" data-x>${icon('x')}</button></div>
    ${isImg ? `<img class="save-preview" src="${url}" alt="${esc(filename)}">
      <p class="muted">If the download didn’t start: on a phone, press and hold the image and choose <b>Save image</b>; on a computer, right-click it and choose <b>Save image as…</b></p>`
      : isVid ? `<video class="save-preview" src="${url}" controls playsinline></video>
      <p class="muted">If the download didn’t start: right-click the video (or use its ⋮ menu) and choose <b>Save video as…</b></p>`
      : `<p class="muted">This preview page can’t save ${esc(filename.split('.').pop().toUpperCase())} files. Use the full Artvas site (your Railway link) to download this format, or export as PNG / JPG here.</p>`}
  </div>`;
  modal.onclick = (e) => { if (e.target === modal || e.target.closest('[data-x]')) modal.remove(); };
  document.body.appendChild(modal);
}

// =====================================================
// AI IMAGE (Muapi.ai)
// =====================================================
state.ai = { prompt: '', style: 'photo', model: AI_MODELS[0].id, ratio: 'auto', count: 1, busy: false, history: [] };
(async () => {
  try {
    state.ai.history = (await kvGet('aiHistory')) || [];
  } catch {}
})();
async function saveAIHistory() {
  try {
    await kvSet('aiHistory', state.ai.history.slice(0, 24));
  } catch {}
}

function aiTargetSize(o) {
  if (o) return [o.width * o.scaleX, o.height * o.scaleY];
  return [state.design.width, state.design.height];
}

async function tabAI(p) {
  const a = state.ai;
  const key = getKey();
  const c = state.canvas;
  const sel = c.getActiveObject();
  const ph = sel?.placeholder ? sel : null;
  const spots = c.getObjects().filter((o) => o.placeholder);
  const model = AI_MODELS.find((m) => m.id === a.model) || AI_MODELS[0];
  if (ph && ph.aiPrompt && !a.promptTouched) a.prompt = ph.aiPrompt;
  const ratios = model.ar || ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];
  const [tw, th] = aiTargetSize(ph);
  const autoRatio = closestRatio(tw, th, ratios);
  p.innerHTML = `
    <h3>AI Image</h3>
    ${
      key || model.free
        ? ''
        : `<div class="ai-connect">
      <b>Connect your Muapi.ai key</b>
      <p class="muted">Artvas creates images with 10+ AI models through Muapi.ai. Images are billed to your own Muapi account. Your key is saved only in this browser.</p>
      <label class="flabel">API key<input class="search" id="aiKey" type="password" autocomplete="off" placeholder="Paste your Muapi API key"></label>
      <button class="btn primary block" id="aiKeySave">Save key</button>
      <p class="muted">Get a key at <a href="https://muapi.ai" target="_blank" rel="noopener">muapi.ai</a></p>
    </div>`
    }
    ${ph ? `<div class="ai-note">${icon('image', 16)} Results will fill the selected photo spot.</div>` : ''}
    <label class="flabel">Describe your image<textarea class="search ai-prompt" id="aiPrompt" rows="4" placeholder="e.g. a golden retriever wearing sunglasses on a beach at sunset">${esc(a.prompt)}</textarea></label>
    <h4>Style</h4>
    <div class="chips">${AI_STYLES.map((s) => `<button class="chip ${a.style === s.id ? 'on' : ''}" data-aist="${s.id}">${s.label}</button>`).join('')}</div>
    <div class="grid2 mt">
      <label>Model<select id="aiModel">${AI_MODELS.map((m) => `<option value="${m.id}" ${m.id === model.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Shape<select id="aiRatio"><option value="auto">Auto (${autoRatio})</option>${ratios.map((r) => `<option value="${r}" ${a.ratio === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Images<select id="aiCount">${[1, 2, 3, 4].map((n) => `<option ${a.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    ${model.free ? `<p class="muted ai-free">Free AI by Pollinations.ai — no key, about one image every 15 seconds, small watermark. For watermark-free premium models pick a Muapi model.</p>` : ''}
    <button class="btn primary block mt" id="aiGo" ${(!key && !model.free) || a.busy ? 'disabled' : ''}>${icon('wand')} ${a.busy ? 'Generating…' : 'Generate'}</button>
    <p class="muted" id="aiStatus">${a.status ? esc(a.status) : ''}</p>
    ${
      spots.length
        ? `<div class="ai-fill"><b>${spots.length} empty photo spot${spots.length > 1 ? 's' : ''} on this page</b>
      <p class="muted">Fill every spot with an AI image that matches the template${spots.some((s) => s.aiPrompt) ? '' : ' (uses your description above)'}.</p>
      <button class="btn ghost block" id="aiFillAll" ${(!key && !model.free) || a.busy ? 'disabled' : ''}>${icon('wand')} Generate photos for this page</button></div>`
        : ''
    }
    <h4>Your AI images</h4>
    <div class="img-grid" id="aiHist">${
      a.history.length
        ? a.history.map((h, i) => `<div class="img-item"><img src="${h.src}" data-aih="${i}" title="${esc(h.prompt)}" alt=""><button class="rm bgset" data-aibg="${i}" title="Use as background">${icon('palette')}</button></div>`).join('')
        : '<p class="muted">Images you generate appear here. Click one to add it to your design.</p>'
    }</div>
    ${key ? `<details class="ai-settings"><summary>AI settings</summary>
      <p class="muted">Connected to Muapi.ai with your key (saved in this browser only).</p>
      <button class="btn ghost small" id="aiKeyRemove">Remove key</button></details>` : ''}`;

  const prm = $('#aiPrompt', p);
  prm.oninput = () => {
    a.prompt = prm.value;
    a.promptTouched = true;
  };
  $$('[data-aist]', p).forEach((b) => (b.onclick = () => { a.style = b.dataset.aist; $$('[data-aist]', p).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#aiModel', p).onchange = (e) => { a.model = e.target.value; a.ratio = 'auto'; tabAI(p); };
  $('#aiRatio', p).value = a.ratio;
  $('#aiRatio', p).onchange = (e) => (a.ratio = e.target.value);
  $('#aiCount', p).onchange = (e) => (a.count = +e.target.value);
  const save = $('#aiKeySave', p);
  if (save) save.onclick = () => {
    const v = $('#aiKey', p).value.trim();
    if (!v) return toast('Paste your API key first');
    setKey(v);
    toast('Key saved in this browser');
    tabAI(p);
  };
  const rm = $('#aiKeyRemove', p);
  if (rm) rm.onclick = () => { setKey(''); tabAI(p); };
  $('#aiGo', p).onclick = () => runAIGenerate(p);
  const fill = $('#aiFillAll', p);
  if (fill) fill.onclick = () => runAIFillAll(p);
  $$('[data-aih]', p).forEach((img) => (img.onclick = () => addImage(a.history[+img.dataset.aih].src, { name: 'AI image' })));
  $$('[data-aibg]', p).forEach((b) => (b.onclick = () => setBackgroundImage(a.history[+b.dataset.aibg].src)));
}

function aiSetStatus(p, msg) {
  state.ai.status = msg;
  const s = $('#aiStatus', p);
  if (s) s.textContent = msg;
}

async function aiOne(prompt, ratio) {
  const a = state.ai;
  const style = AI_STYLES.find((s) => s.id === a.style);
  const url = await generateImage({ model: a.model, prompt: prompt + (style?.suffix || ''), aspectRatio: ratio, onStatus: (m) => aiSetStatus(state.aiPanel, m) });
  const src = await toDataURL(url);
  a.history.unshift({ src, prompt, t: Date.now() });
  a.history = a.history.slice(0, 24);
  saveAIHistory();
  return src;
}

async function runAIGenerate(p) {
  const a = state.ai;
  const prompt = a.prompt.trim();
  if (!prompt) return toast('Describe the image you want first');
  const sel = state.canvas.getActiveObject();
  const ph = sel?.placeholder ? sel : null;
  const model = AI_MODELS.find((m) => m.id === a.model) || AI_MODELS[0];
  const [tw, th] = aiTargetSize(ph);
  const ratio = a.ratio === 'auto' ? closestRatio(tw, th, model.ar || undefined) : a.ratio;
  a.busy = true;
  state.aiPanel = p;
  tabAI(p);
  try {
    let results;
    if (isFreeModel(a.model)) {
      // the free service handles one image at a time
      results = [];
      for (let i = 0; i < a.count; i++) results.push(await aiOne(prompt, ratio).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason })));
    } else results = await Promise.allSettled(Array.from({ length: a.count }, () => aiOne(prompt, ratio)));
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!ok.length) throw results[0].reason;
    if (ph && state.canvas.getObjects().includes(ph)) await fillPlaceholder(ph, ok[0]);
    else if (a.count === 1) await addImage(ok[0], { name: 'AI image', noFill: true });
    a.status = ok.length < a.count ? `Done — ${a.count - ok.length} image(s) failed.` : 'Done! Click an image below to use it.';
  } catch (e) {
    console.error(e);
    a.status = e.message || 'Generation failed.';
    toast(a.status);
  }
  a.busy = false;
  if (state.tab === 'ai') tabAI(p);
}

async function runAIFillAll(p) {
  const a = state.ai;
  const spots = state.canvas.getObjects().filter((o) => o.placeholder);
  if (!spots.length) return;
  const fallback = a.prompt.trim() || `${state.design.name} photo`;
  const model = AI_MODELS.find((m) => m.id === a.model) || AI_MODELS[0];
  a.busy = true;
  state.aiPanel = p;
  tabAI(p);
  let done = 0;
  let failed = 0;
  const queue = [...spots];
  const worker = async () => {
    while (queue.length) {
      const ph = queue.shift();
      try {
        const [w, h] = aiTargetSize(ph);
        const src = await aiOne(ph.aiPrompt || fallback, closestRatio(w, h, model.ar || undefined));
        if (state.canvas.getObjects().includes(ph)) await fillPlaceholder(ph, src);
        done++;
      } catch (e) {
        failed++;
        console.error(e);
        a.status = e.message;
      }
      aiSetStatus(p, `Filled ${done} of ${spots.length}${failed ? ` · ${failed} failed` : ''}`);
    }
  };
  await Promise.all(isFreeModel(a.model) ? [worker()] : [worker(), worker()]);
  a.busy = false;
  a.status = failed ? `Filled ${done} of ${spots.length}. ${a.status || ''}` : `Filled all ${done} photo spot${done > 1 ? 's' : ''}.`;
  if (failed && !done) toast(a.status);
  if (state.tab === 'ai') tabAI(p);
}

// =====================================================
// CHART / TABLE DATA EDITING
// =====================================================
function dataPropsHTML(o) {
  if (o.qr) return qrPropsHTML(o);
  if (o.chart) {
    const ch = o.chart;
    const multi = ch.type === 'donut' || ch.type === 'pie';
    return `<h4>Chart data</h4>
      <div class="field"><label>Type</label><select id="chType">${CHART_PRESETS.map((c) => `<option value="${c.type}" ${c.type === ch.type ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div>
      <label class="flabel">Labels (comma separated)<input class="search" id="chLabels" value="${esc(ch.labels.join(', '))}"></label>
      <label class="flabel">Values (comma separated)<input class="search" id="chValues" value="${esc(ch.values.join(', '))}"></label>
      ${multi ? '' : `<div class="field"><label>Color</label><div class="row"><input type="color" id="chColor" value="${toHex(ch.color || '#7c3aed')}"><button class="btn ghost small" id="chMulti">Multi-color</button></div></div>`}
      <div class="field"><label>Text color</label><input type="color" id="chText" value="${toHex(ch.text || '#374151')}"></div>
      <button class="btn primary block" id="chApply">Update chart</button>`;
  }
  if (o.table) {
    return `<h4>Table data</h4>
      <label class="flabel">One row per line, separate cells with |<textarea class="search table-edit" id="tbRows" rows="6">${esc(o.table.rows.map((r) => r.join(' | ')).join('\n'))}</textarea></label>
      <div class="field"><label>Header color</label><input type="color" id="tbColor" value="${toHex(o.table.color)}"></div>
      <button class="btn primary block" id="tbApply">Update table</button>`;
  }
  return '';
}
function bindDataProps(o) {
  if (o.qr) bindQrProps(o);
  if (o.chart) {
    const read = (color) => ({
      type: $('#chType').value,
      labels: $('#chLabels').value.split(',').map((x) => x.trim()),
      values: $('#chValues').value.split(',').map((x) => x.trim()).filter((x) => x !== ''),
      color: color !== undefined ? color : $('#chColor')?.value ?? o.chart.color,
      text: $('#chText').value,
    });
    const apply = (color) => rebuildDataObject(o, () => buildChart(read(color), o.width));
    $('#chApply').onclick = () => apply();
    $('#chType').onchange = () => apply();
    const m = $('#chMulti');
    if (m) m.onclick = () => apply('');
    const cc = $('#chColor');
    if (cc) cc.onchange = () => apply();
    $('#chText').onchange = () => apply();
  }
  if (o.table) {
    const apply = () =>
      rebuildDataObject(o, () =>
        buildTable({ rows: $('#tbRows').value.split('\n').filter((l) => l.trim()).map((l) => l.split('|').map((c) => c.trim())), color: $('#tbColor').value }, o.width)
      );
    $('#tbApply').onclick = apply;
    $('#tbColor').onchange = apply;
  }
}

// =====================================================
// PANELS / RESPONSIVE LAYOUT
// =====================================================
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

function syncPanels() {
  const ed = $('#editor');
  if (!ed) return;
  ed.classList.toggle('panel-closed', !state.panelOpen);
  ed.classList.toggle('props-open', !!state.propsOpen);
  $$('.tab').forEach((x) => x.classList.toggle('active', state.panelOpen && x.dataset.tab === state.tab));
  const t = $('#propsToggle');
  if (t) t.classList.toggle('on', !!state.propsOpen);
}
function setPanelOpen(open) {
  state.panelOpen = open;
  if (!open && state.canvas?.isDrawingMode && isMobile()) {
    // keep drawing mode on phones so the user can draw after closing the sheet
  }
  syncPanels();
}
function setPropsOpen(open) {
  state.propsOpen = open;
  state.propsPinned = open && !state.canvas?.getActiveObject();
  if (open && isMobile()) state.panelOpen = false;
  syncPanels();
}

// =====================================================
// ROUTING
// =====================================================
function showStorageBanner() {
  if (document.getElementById('storageBanner')) return;
  const b = document.createElement('div');
  b.id = 'storageBanner';
  b.className = 'storage-banner';
  b.innerHTML = `<b>Artvas is open in another tab or window.</b> Your saved designs can't load until the other Artvas tabs (including any older preview) are closed. <button class="btn primary small" id="sbReload">Reload</button>`;
  document.body.appendChild(b);
  b.querySelector('#sbReload').onclick = () => location.reload();
}

async function boot() {
  await loadBrand();
  await loadMyTemplates();
  const m = location.hash.match(/^#\/(?:design|video)\/(\w+)/) || location.pathname.match(/^\/design\/(\w+)/);
  if (m) {
    const d = await getDesign(m[1]).catch(() => null);
    if (d) return d.kind === 'video' ? openVideo(d) : openEditor(d);
  }
  renderHome();
}
// =====================================================
// DESIGN EXTRAS: curved text, QR codes, crop, duotone, photo colours,
// arrange selection, Magic Write
// =====================================================
const XI = {
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3"/>',
  'dist-h': '<path d="M4 3v18M20 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  'dist-v': '<path d="M3 4h18M3 20h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
};
function xicon(name, size = 18) {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${XI[name] || ''}</svg>`;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** One-time setup: teach Fabric's Textbox to draw itself on an arc, and register the duotone filter. */
function installDesignExtras() {
  if (installDesignExtras.done) return;
  installDesignExtras.done = true;
  const P = Textbox.prototype;
  P.curve = 0;
  const curved = (t) => !!t.curve && !t.isEditing && !!t.text;
  const td = P._getTransformedDimensions;
  P._getTransformedDimensions = function (options = {}) {
    if (curved(this) && options.width === undefined && options.height === undefined) {
      const L = curveLayout(this);
      return td.call(this, { ...options, width: L.w, height: L.h });
    }
    return td.call(this, options);
  };
  const ntd = P._getNonTransformedDimensions;
  P._getNonTransformedDimensions = function () {
    if (!curved(this)) return ntd.call(this);
    const L = curveLayout(this);
    return new Point(L.w, L.h).scalarAdd(this.strokeWidth);
  };
  const init = P.initDimensions;
  P.initDimensions = function () {
    this.__curve = null;
    return init.call(this);
  };
  const vis = P.isControlVisible;
  P.isControlVisible = function (key) {
    if ((key === 'ml' || key === 'mr') && curved(this)) return false;
    return vis.call(this, key);
  };
  const render = P._render;
  P._render = function (ctx) {
    if (!curved(this)) return render.call(this, ctx);
    const L = curveLayout(this);
    ctx.save();
    this._setTextStyles(ctx);
    ctx.textAlign = 'left';
    const hasStroke = this.stroke && this.strokeWidth > 0;
    const hasFill = this.fill && this.fill !== 'transparent';
    if (hasFill) this._setFillStyles(ctx, this);
    if (hasStroke) this._setStrokeStyles(ctx, this);
    const paint = (mode) => {
      for (const ch of L.chars) {
        ctx.save();
        ctx.translate(ch.x, ch.y);
        ctx.rotate(ch.a);
        if (mode === 'fill') ctx.fillText(ch.ch, -ch.w / 2, 0);
        else ctx.strokeText(ch.ch, -ch.w / 2, 0);
        ctx.restore();
      }
    };
    const order = this.paintFirst === 'stroke' ? ['stroke', 'fill'] : ['fill', 'stroke'];
    for (const m of order) {
      if (m === 'fill' && hasFill) paint('fill');
      if (m === 'stroke' && hasStroke) {
        paint('stroke');
        this._removeShadow?.(ctx);
      }
    }
    ctx.restore();
  };
  const svg = P._toSVG;
  P._toSVG = function () {
    if (!curved(this)) return svg.call(this);
    const L = curveLayout(this);
    const f = (n) => (Math.round(n * 100) / 100).toString();
    const xs = [];
    const ys = [];
    const rs = [];
    for (const ch of L.chars) {
      const cs = Math.cos(ch.a);
      const sn = Math.sin(ch.a);
      // SVG places each glyph by its start point on the baseline and rotates it about that point
      for (const _ of [...ch.ch]) {
        xs.push(f(ch.x - (ch.w / 2) * cs));
        ys.push(f(ch.y - (ch.w / 2) * sn));
        rs.push(f((ch.a * 180) / Math.PI));
      }
    }
    return [
      '\t\t<text xml:space="preserve" ',
      `font-family="${esc(this.fontFamily)}" font-size="${this.fontSize}" `,
      this.fontStyle ? `font-style="${this.fontStyle}" ` : '',
      this.fontWeight ? `font-weight="${this.fontWeight}" ` : '',
      'style="', this.getSvgStyles(true), '"', this.addPaintOrder(),
      ` x="${xs.join(' ')}" y="${ys.join(' ')}" rotate="${rs.join(' ')}">`,
      esc(L.chars.map((c) => c.ch).join('')),
      '</text>\n',
    ];
  };

  // ---- Duotone: map dark tones to one colour and light tones to another
  const hexRGB = (h) => {
    const v = toHex(h).slice(1);
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  };
  class Duotone extends filters.BaseFilter {
    getFragmentSource() {
      return `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec3 uDark;
        uniform vec3 uLight;
        varying vec2 vTexCoord;
        void main() {
          vec4 color = texture2D(uTexture, vTexCoord);
          float l = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          gl_FragColor = vec4(mix(uDark, uLight, l), color.a);
        }`;
    }
    applyTo2d({ imageData: { data } }) {
      const d = hexRGB(this.dark);
      const l = hexRGB(this.light);
      const lut = [0, 1, 2].map((k) => {
        const a = new Uint8ClampedArray(256);
        for (let i = 0; i < 256; i++) a[i] = Math.round((d[k] + (l[k] - d[k]) * (i / 255)) * 255);
        return a;
      });
      for (let i = 0; i < data.length; i += 4) {
        const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = lut[0][y];
        data[i + 1] = lut[1][y];
        data[i + 2] = lut[2][y];
      }
    }
    sendUniformData(gl, loc) {
      gl.uniform3fv(loc.uDark, hexRGB(this.dark));
      gl.uniform3fv(loc.uLight, hexRGB(this.light));
    }
  }
  Duotone.type = 'Duotone';
  Duotone.defaults = { dark: '#2b1055', light: '#ff9a3c' };
  Duotone.uniformLocations = ['uDark', 'uLight'];
  classRegistry.setClass(Duotone);
  installDesignExtras.Duotone = Duotone;
}

// ---------- Curved text ----------
let curveCtx;
/** Where each letter sits when a text is bent on a circle. Cached until the text, font or curve change. */
function curveLayout(t) {
  const font = t._getFontDeclaration();
  const key = `${t.text}|${font}|${t.charSpacing}|${t.curve}`;
  if (t.__curve?.key === key) return t.__curve;
  curveCtx ||= document.createElement('canvas').getContext('2d');
  curveCtx.font = font;
  const fs = t.fontSize;
  const glyphs = t.graphemeSplit(String(t.text).replace(/\s*\n\s*/g, ' '));
  const gap = ((t.charSpacing || 0) / 1000) * fs;
  const widths = glyphs.map((g) => curveCtx.measureText(g).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, glyphs.length - 1);
  const k = clamp(t.curve, -100, 100) / 100;
  const span = Math.abs(k) * Math.PI * 2 * 0.94; // 100 = almost a full circle
  const R = total / Math.max(span, 1e-6);
  const asc = fs * 0.8;
  const desc = fs * 0.24;
  const chars = [];
  let pos = -total / 2;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  glyphs.forEach((ch, i) => {
    const w = widths[i];
    const phi = (pos + w / 2) / R;
    pos += w + gap;
    // positive curve: letters stand on top of the circle; negative: they hang under it
    const x = R * Math.sin(phi);
    const y = k > 0 ? R - R * Math.cos(phi) : R * Math.cos(phi) - R;
    const a = k > 0 ? phi : -phi;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    for (const dx of [-w / 2, w / 2]) {
      for (const dy of [-asc, desc]) {
        const px = x + dx * cs - dy * sn;
        const py = y + dx * sn + dy * cs;
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
    chars.push({ ch, w, x, y, a });
  });
  if (!chars.length) { minX = minY = -1; maxX = maxY = 1; }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  chars.forEach((c) => { c.x -= cx; c.y -= cy; });
  t.__curve = { key, chars, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  return t.__curve;
}

function setCurve(o, v) {
  const cp = o.getCenterPoint();
  o.curve = v;
  o.__curve = null;
  o.dirty = true;
  o.setPositionByOrigin(cp, 'center', 'center');
  o.setCoords();
  state.canvas.requestRenderAll();
}

// ---------- QR codes ----------
/** A crisp vector QR code: a background square and one path of dark modules, sized `size` px. */
function buildQR(spec, size) {
  const text = String(spec.text || '').slice(0, 1200);
  const q = qrcode(0, 'M');
  // the encoder works on bytes; feed it UTF-8 so Chinese, emoji, etc. scan correctly
  q.addData(String.fromCharCode(...new TextEncoder().encode(text)), 'Byte');
  q.make();
  const n = q.getModuleCount();
  const m = 2; // quiet zone in modules
  const tot = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; ) {
      if (!q.isDark(r, c)) { c++; continue; }
      let e = c;
      while (e < n && q.isDark(r, e)) e++;
      d += `M${c + m} ${r + m}h${e - c}v1h${c - e}z`;
      c = e;
    }
  }
  const transparent = !spec.bg || spec.bg === 'transparent';
  const bg = new Rect({ left: 0, top: 0, width: tot, height: tot, fill: transparent ? '' : spec.bg, strokeWidth: 0, name: 'QR background' });
  const dots = new Path(d, { fill: spec.fg || '#111827', strokeWidth: 0, name: 'QR modules' });
  const g = new Group([bg, dots], { name: 'QR code', kind: 'qr', qr: { text, fg: spec.fg || '#111827', bg: transparent ? 'transparent' : spec.bg } });
  g.scale(size / tot);
  return g;
}
function addQR(spec) {
  if (!String(spec.text || '').trim()) return toast('Type a link or some text first');
  try {
    return place(buildQR(spec, minSide() * 0.35));
  } catch (e) {
    console.error(e);
    toast('That is too long for a QR code — try a shorter link');
  }
}
function qrSectionHTML() {
  return `<section class="lib-sec qr-sec"><div class="lib-head"><h4>${xicon('qr', 16)} QR code</h4></div>
    <div class="qr-form">
      <input class="search" id="qrText" placeholder="Paste a link or type text" value="${esc(state.qrDraft?.text || '')}">
      <div class="row qr-row">
        <label class="qr-col" title="Code colour"><input type="color" id="qrFg" value="${toHex(state.qrDraft?.fg || '#111827')}"><span>Code</span></label>
        <label class="qr-col" title="Background colour"><input type="color" id="qrBg" value="${toHex(state.qrDraft?.bg || '#ffffff')}"><span>Background</span></label>
        <span class="spacer"></span>
        <button class="btn primary small" id="qrAdd">Add QR code</button>
      </div>
    </div></section>`;
}
function bindQrSection(p) {
  const btn = $('#qrAdd', p);
  if (!btn) return;
  const read = () => (state.qrDraft = { text: $('#qrText', p).value.trim(), fg: $('#qrFg', p).value, bg: $('#qrBg', p).value });
  ['qrText', 'qrFg', 'qrBg'].forEach((id) => ($('#' + id, p).oninput = read));
  $('#qrText', p).onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
  btn.onclick = () => addQR(read());
}
function qrPropsHTML(o) {
  const q = o.qr;
  const tr = q.bg === 'transparent';
  return `<h4>QR code</h4>
    <label class="flabel">Link or text<textarea class="search" id="qrEText" rows="3">${esc(q.text)}</textarea></label>
    <div class="row qr-row mt">
      <label class="qr-col"><input type="color" id="qrEFg" value="${toHex(q.fg)}"><span>Code</span></label>
      <label class="qr-col"><input type="color" id="qrEBg" value="${toHex(tr ? '#ffffff' : q.bg)}"><span>Background</span></label>
      <label class="row qr-tr"><input type="checkbox" id="qrETr" ${tr ? 'checked' : ''}> No background</label>
    </div>
    <button class="btn primary block mt" id="qrEApply">Update QR code</button>`;
}
function bindQrProps(o) {
  const apply = () => {
    const spec = { text: $('#qrEText').value.trim(), fg: $('#qrEFg').value, bg: $('#qrETr').checked ? 'transparent' : $('#qrEBg').value };
    if (!spec.text) return toast('Type a link or some text first');
    try {
      const size = o.width;
      rebuildDataObject(o, () => buildQR(spec, size));
    } catch (e) {
      console.error(e);
      toast('That is too long for a QR code — try a shorter link');
    }
  };
  $('#qrEApply').onclick = apply;
  ['qrEFg', 'qrEBg', 'qrETr'].forEach((id) => ($('#' + id).onchange = apply));
}

// ---------- Image extras: crop button, photo colours ----------
function imgNatural(img) {
  const el = img._originalElement || img.getElement();
  return { w: el.naturalWidth || el.width || img.width, h: el.naturalHeight || el.height || img.height };
}
function isCropped(img) {
  const N = imgNatural(img);
  return (img.cropX || 0) > 0.5 || (img.cropY || 0) > 0.5 || img.width < N.w - 0.5 || img.height < N.h - 0.5;
}
function imageExtrasHTML(img) {
  const pal = paletteFor(img);
  return `<div class="row wrap img-tools">
      <button class="btn ghost small" id="imgCrop">${xicon('crop', 16)} Crop</button>
      ${isCropped(img) ? `<button class="btn ghost small" id="imgCropReset">Reset crop</button>` : ''}
    </div>
    ${pal.length ? `<h4>Photo colours</h4>
    <div class="photo-cols">${pal.map((c) => `<button style="background:${c}" data-pcol="${c}" title="${c}"></button>`).join('')}</div>
    <p class="muted tiny">Click a colour to use it as the page background. They also appear under “Photo colours” in every colour picker.</p>` : ''}`;
}
/** Main colours of an image (k-means on a small copy of the visible part). */
function extractPalette(img, k = 6) {
  const el = img._originalElement || img.getElement();
  const sx = img.cropX || 0;
  const sy = img.cropY || 0;
  const sw = img.width;
  const sh = img.height;
  const S = 72;
  const sc = Math.min(1, S / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * sc));
  const ch = Math.max(1, Math.round(sh * sc));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  let data;
  try {
    ctx.drawImage(el, sx, sy, sw, sh, 0, 0, cw, ch);
    data = ctx.getImageData(0, 0, cw, ch).data;
  } catch {
    return [];
  }
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 160) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return [];
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // farthest-point start keeps the result stable (no randomness) and spreads the seeds out
  const cents = [px[Math.floor(px.length / 2)].slice()];
  const dmin = px.map((p) => dist(p, cents[0]));
  while (cents.length < Math.min(k, px.length)) {
    let bi = 0;
    for (let i = 1; i < px.length; i++) if (dmin[i] > dmin[bi]) bi = i;
    if (dmin[bi] === 0) break;
    cents.push(px[bi].slice());
    for (let i = 0; i < px.length; i++) dmin[i] = Math.min(dmin[i], dist(px[i], cents[cents.length - 1]));
  }
  let counts = [];
  for (let it = 0; it < 12; it++) {
    const sum = cents.map(() => [0, 0, 0]);
    counts = cents.map(() => 0);
    for (const p of px) {
      let bj = 0;
      let bd = Infinity;
      for (let j = 0; j < cents.length; j++) {
        const dd = dist(p, cents[j]);
        if (dd < bd) { bd = dd; bj = j; }
      }
      counts[bj]++;
      sum[bj][0] += p[0]; sum[bj][1] += p[1]; sum[bj][2] += p[2];
    }
    cents.forEach((c, j) => { if (counts[j]) for (let q = 0; q < 3; q++) c[q] = sum[j][q] / counts[j]; });
  }
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const out = [];
  cents
    .map((c, j) => ({ c, n: counts[j] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .forEach(({ c }) => { if (!out.some((o) => dist(o, c) < 18 * 18)) out.push(c); });
  return out.map(hex);
}
function paletteFor(img) {
  const key = `${img.getSrc?.() || ''}|${img.cropX}|${img.cropY}|${img.width}|${img.height}`;
  if (img.__palette?.key !== key) img.__palette = { key, colors: extractPalette(img) };
  if (img.__palette.colors.length) state.photoColors = img.__palette.colors;
  return img.__palette.colors;
}

// ---------- Duotone ----------
const DUO_PRESETS = [
  { name: 'Purple / orange', dark: '#3b0a6b', light: '#ff9a3c' },
  { name: 'Blue / pink', dark: '#1e3a8a', light: '#ff8fc7' },
  { name: 'Black / gold', dark: '#111111', light: '#f5c542' },
  { name: 'Teal / coral', dark: '#0f4c5c', light: '#ff7f6e' },
  { name: 'Forest / lime', dark: '#0b3d2e', light: '#c6f36b' },
  { name: 'Navy / cream', dark: '#14213d', light: '#fbeec1' },
];
const getDuotone = (img) => (img.filters || []).find((f) => f?.type === 'Duotone');
function duotoneHTML(img) {
  const d = getDuotone(img);
  return `<h4>Duotone</h4>
    <div class="duo-grid">
      <button class="duo none ${d ? '' : 'on'}" data-duo="none" title="No duotone">None</button>
      ${DUO_PRESETS.map((p, i) => `<button class="duo ${d && d.dark === p.dark && d.light === p.light ? 'on' : ''}" data-duo="${i}" title="${p.name}" style="background:linear-gradient(135deg,${p.dark} 0 50%,${p.light} 50% 100%)"></button>`).join('')}
    </div>
    <div class="row duo-custom">
      <label class="qr-col"><input type="color" id="duoDark" value="${toHex(d?.dark || DUO_PRESETS[0].dark)}"><span>Shadows</span></label>
      <label class="qr-col"><input type="color" id="duoLight" value="${toHex(d?.light || DUO_PRESETS[0].light)}"><span>Highlights</span></label>
    </div>`;
}
function setDuotone(img, dark, light) {
  const list = (img.filters || []).filter((f) => f && f.type !== 'Duotone');
  if (dark) list.push(new installDesignExtras.Duotone({ dark, light }));
  img.filters = list;
  img.applyFilters();
  img.dirty = true;
  state.canvas?.requestRenderAll();
}

// ---------- Arrange several selected elements ----------
function arrangeHTML(sel) {
  const n = sel.getObjects().length;
  return `<h4>Align elements</h4>
    <div class="align-grid">
      <button data-arr="left" title="Align left edges">${icon('al-left')}</button>
      <button data-arr="hcenter" title="Align centers">${icon('al-hcenter')}</button>
      <button data-arr="right" title="Align right edges">${icon('al-right')}</button>
      <button data-arr="top" title="Align tops">${icon('al-top')}</button>
      <button data-arr="vcenter" title="Align middles">${icon('al-vcenter')}</button>
      <button data-arr="bottom" title="Align bottoms">${icon('al-bottom')}</button>
    </div>
    <h4>Space evenly</h4>
    <div class="row dist-row">
      <button class="btn ghost small" data-arr="dist-h" ${n < 3 ? 'disabled title="Select 3 or more elements"' : 'title="Equal gaps from left to right"'}>${xicon('dist-h', 16)} Horizontally</button>
      <button class="btn ghost small" data-arr="dist-v" ${n < 3 ? 'disabled title="Select 3 or more elements"' : 'title="Equal gaps from top to bottom"'}>${xicon('dist-v', 16)} Vertically</button>
    </div>`;
}
/** Align the selected elements to each other, or give them equal gaps. */
function arrangeSelection(how) {
  const c = state.canvas;
  const sel = c.getActiveObject();
  if (!(sel instanceof ActiveSelection)) return;
  const objs = sel.getObjects();
  c.discardActiveObject();
  const items = objs.map((o) => ({ o, b: o.getBoundingRect() }));
  const L = Math.min(...items.map((i) => i.b.left));
  const T = Math.min(...items.map((i) => i.b.top));
  const R = Math.max(...items.map((i) => i.b.left + i.b.width));
  const B = Math.max(...items.map((i) => i.b.top + i.b.height));
  const move = (o, dx, dy) => {
    if (o.locked) return;
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
  };
  if (how === 'dist-h' || how === 'dist-v') {
    const h = how === 'dist-h';
    const s = [...items].sort((a, b) => (h ? a.b.left + a.b.width / 2 - (b.b.left + b.b.width / 2) : a.b.top + a.b.height / 2 - (b.b.top + b.b.height / 2)));
    const size = s.reduce((a, i) => a + (h ? i.b.width : i.b.height), 0);
    const gap = ((h ? R - L : B - T) - size) / (s.length - 1);
    let at = h ? L : T;
    for (const i of s) {
      if (h) move(i.o, at - i.b.left, 0);
      else move(i.o, 0, at - i.b.top);
      at += (h ? i.b.width : i.b.height) + gap;
    }
  } else {
    for (const { o, b } of items) {
      if (how === 'left') move(o, L - b.left, 0);
      if (how === 'right') move(o, R - (b.left + b.width), 0);
      if (how === 'hcenter') move(o, (L + R) / 2 - (b.left + b.width / 2), 0);
      if (how === 'top') move(o, 0, T - b.top);
      if (how === 'bottom') move(o, 0, B - (b.top + b.height));
      if (how === 'vcenter') move(o, 0, (T + B) / 2 - (b.top + b.height / 2));
    }
  }
  c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
  c.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
}

// ---------- Crop ----------
const CROP_RATIOS = [['free', 'Free', 0], ['orig', 'Original', -1], ['1:1', '1:1', 1], ['4:5', '4:5', 4 / 5], ['16:9', '16:9', 16 / 9], ['9:16', '9:16', 9 / 16]];
/** Turn a vector in the image's own pixels into a vector on the page (scale, flip and rotation). */
function imgVec(img, x, y) {
  const m = util.composeMatrix({ scaleX: img.scaleX, scaleY: img.scaleY, flipX: img.flipX, flipY: img.flipY, angle: img.angle, skewX: img.skewX, skewY: img.skewY });
  return new Point(x, y).transform(m, true);
}
function pageToImg(img, p) {
  const m = util.composeMatrix({ scaleX: img.scaleX, scaleY: img.scaleY, flipX: img.flipX, flipY: img.flipY, angle: img.angle, skewX: img.skewX, skewY: img.skewY });
  return p.subtract(img.getCenterPoint()).transform(util.invertTransform(m), true);
}
function startCrop(img) {
  const c = state.canvas;
  if (state.crop || !img || img.type !== 'image') return;
  if (img.locked) return toast('Unlock the image to crop it');
  const N = imgNatural(img);
  const orig = { cropX: img.cropX || 0, cropY: img.cropY || 0, width: img.width, height: img.height, left: img.left, top: img.top, clipPath: img.clipPath, selectable: img.selectable, evented: img.evented };
  const center = img.getCenterPoint();
  state.loading = true;
  // show the whole photo, with the current crop staying exactly where it is
  const off = imgVec(img, orig.cropX + orig.width / 2 - N.w / 2, orig.cropY + orig.height / 2 - N.h / 2);
  img.set({ cropX: 0, cropY: 0, width: N.w, height: N.h, clipPath: undefined, selectable: false, evented: false });
  img.setPositionByOrigin(center.subtract(off), 'center', 'center');
  img.setCoords();
  img.dirty = true;
  const box = new Rect({
    originX: 'center', originY: 'center', fill: 'transparent', strokeWidth: 0, objectCaching: false,
    lockRotation: true, lockSkewingX: true, lockSkewingY: true, lockScalingFlip: true, excludeFromExport: true,
    cornerSize: isMobile() ? 18 : 13, touchCornerSize: 40, cornerStyle: 'rect', cornerColor: '#ffffff', cornerStrokeColor: '#7c3aed',
    borderColor: '#ffffff', padding: 0, name: 'Crop area',
  });
  box.setControlsVisibility({ mtr: false });
  box._render = function (ctx) {
    const w = this.width;
    const h = this.height;
    const z = (this.canvas?.getZoom?.() || 1) * Math.abs(this.scaleX || 1);
    const lw = 1 / z;
    const B = 1e5;
    ctx.save();
    ctx.fillStyle = 'rgba(17,12,34,0.6)';
    ctx.beginPath();
    ctx.rect(-B, -B, 2 * B, 2 * B);
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const f of [1 / 3, 2 / 3]) {
      ctx.moveTo(-w / 2 + w * f, -h / 2); ctx.lineTo(-w / 2 + w * f, h / 2);
      ctx.moveTo(-w / 2, -h / 2 + h * f); ctx.lineTo(w / 2, -h / 2 + h * f);
    }
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * lw;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  };
  c.add(box);
  state.loading = false;
  state.crop = { img, box, N, orig, ratio: 'free', uniform: c.uniformScaling, rect: { x: orig.cropX, y: orig.cropY, w: orig.width, h: orig.height } };
  c.uniformScaling = false;
  const sync = () => { syncCropFromBox(); placeCropBox(); updateCropSliders(); };
  box.on('moving', sync);
  box.on('scaling', sync);
  box.on('modified', sync);
  placeCropBox();
  c.setActiveObject(box);
  c.requestRenderAll();
  if (!isMobile() && !state.propsOpen) setPropsOpen(true);
  renderProps();
}
function cropAspect() {
  const cr = state.crop;
  const r = CROP_RATIOS.find((x) => x[0] === cr.ratio)?.[2] || 0;
  if (r === -1) return (cr.N.w * Math.abs(cr.img.scaleX)) / (cr.N.h * Math.abs(cr.img.scaleY));
  return r;
}
/** Keep the crop rectangle inside the photo, at least 8px, and at the chosen shape. */
function clampCropRect(anchor = 'center') {
  const { N, img } = state.crop;
  const r = state.crop.rect;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let w = clamp(r.w, 8, N.w);
  let h = clamp(r.h, 8, N.h);
  const a = cropAspect();
  if (a) {
    const k = Math.abs(img.scaleX) / Math.abs(img.scaleY); // page aspect = (w * sx) / (h * sy)
    if ((w * k) / h > a) w = (a * h) / k;
    else h = (w * k) / a;
  }
  let x = anchor === 'keep' ? r.x : cx - w / 2;
  let y = anchor === 'keep' ? r.y : cy - h / 2;
  x = clamp(x, 0, N.w - w);
  y = clamp(y, 0, N.h - h);
  state.crop.rect = { x, y, w, h };
}
function syncCropFromBox() {
  const { img, box } = state.crop;
  const w = (box.width * box.scaleX) / Math.abs(img.scaleX);
  const h = (box.height * box.scaleY) / Math.abs(img.scaleY);
  const p = pageToImg(img, box.getCenterPoint());
  const { N } = state.crop;
  state.crop.rect = { x: p.x + N.w / 2 - w / 2, y: p.y + N.h / 2 - h / 2, w, h };
  clampCropRect();
}
function placeCropBox() {
  const { img, box, N, rect } = state.crop;
  const center = img.getCenterPoint().add(imgVec(img, rect.x + rect.w / 2 - N.w / 2, rect.y + rect.h / 2 - N.h / 2));
  box.set({ width: rect.w, height: rect.h, scaleX: Math.abs(img.scaleX), scaleY: Math.abs(img.scaleY), angle: img.angle || 0 });
  box.setPositionByOrigin(center, 'center', 'center');
  const locked = !!cropAspect();
  box.setControlsVisibility({ ml: !locked, mr: !locked, mt: !locked, mb: !locked, mtr: false });
  state.canvas.uniformScaling = locked;
  box.setCoords();
  state.canvas.requestRenderAll();
}
function cropSliderValues() {
  const { N, rect } = state.crop;
  return {
    l: Math.round((rect.x / N.w) * 1000) / 10,
    r: Math.round(((N.w - rect.x - rect.w) / N.w) * 1000) / 10,
    t: Math.round((rect.y / N.h) * 1000) / 10,
    b: Math.round(((N.h - rect.y - rect.h) / N.h) * 1000) / 10,
  };
}
function updateCropSliders() {
  if (!state.crop) return;
  const v = cropSliderValues();
  for (const k of ['l', 'r', 't', 'b']) {
    const s = $(`#crop_${k}`);
    if (s && document.activeElement !== s) s.value = v[k];
    const lab = $(`#crop_${k}_v`);
    if (lab) lab.textContent = `${Math.round(v[k])}%`;
  }
  const sz = $('#cropSize');
  if (sz) sz.textContent = `${Math.round(state.crop.rect.w)} × ${Math.round(state.crop.rect.h)} px`;
}
function renderCropProps(el, bar) {
  const cr = state.crop;
  const v = cropSliderValues();
  const ratios = CROP_RATIOS.map(([id, label]) => `<button class="chip ${cr.ratio === id ? 'on' : ''}" data-cratio="${id}">${label}</button>`).join('');
  bar.innerHTML = `<b class="crop-title">${xicon('crop', 16)} Crop</b>
    <select id="cropRatioQ" class="crop-ratio-q" title="Shape">${CROP_RATIOS.map(([id, label]) => `<option value="${id}" ${cr.ratio === id ? 'selected' : ''}>${label}</option>`).join('')}</select>
    <span class="spacer"></span>
    ${isMobile() ? `<button class="btn ghost small" id="cropMore" title="Precise sliders">Adjust</button>` : ''}
    <button class="btn ghost small" id="cropCancelQ">Cancel</button>
    <button class="btn primary small" id="cropDoneQ">Done</button>`;
  const sl = (k, label) => `<label class="frow crop-sl">${label} <b id="crop_${k}_v">${Math.round(v[k])}%</b><input type="range" id="crop_${k}" min="0" max="95" step="0.5" value="${v[k]}"></label>`;
  el.innerHTML = `<h3>Crop image</h3>
    <p class="muted">Drag the box or its handles on the photo, or use the sliders. <span id="cropSize">${Math.round(cr.rect.w)} × ${Math.round(cr.rect.h)} px</span></p>
    <h4>Shape</h4><div class="chips">${ratios}</div>
    <h4>Trim edges</h4>
    <div class="field">${sl('l', 'Left')}${sl('r', 'Right')}${sl('t', 'Top')}${sl('b', 'Bottom')}</div>
    <button class="btn ghost block" id="cropReset">Reset crop</button>
    <div class="row crop-actions"><button class="btn ghost" id="cropCancel">Cancel</button><button class="btn primary" id="cropDone">Done</button></div>`;
  const setRatio = (id) => {
    cr.ratio = id;
    if (cropAspect()) {
      // biggest box of that shape around the current centre
      const r = cr.rect;
      cr.rect = { x: r.x + r.w / 2 - cr.N.w / 2, y: r.y + r.h / 2 - cr.N.h / 2, w: cr.N.w, h: cr.N.h };
    }
    clampCropRect();
    placeCropBox();
    renderProps();
  };
  $$('[data-cratio]', el).forEach((b) => (b.onclick = () => setRatio(b.dataset.cratio)));
  $('#cropRatioQ').onchange = (e) => setRatio(e.target.value);
  const more = $('#cropMore');
  if (more) more.onclick = () => setPropsOpen(!state.propsOpen);
  for (const k of ['l', 'r', 't', 'b']) {
    $(`#crop_${k}`).oninput = () => {
      const { N } = cr;
      const val = (id) => +$(`#crop_${id}`).value / 100;
      let { x, y, w, h } = cr.rect;
      if (k === 'l') { const right = x + w; x = Math.min(val('l') * N.w, right - 8); w = right - x; }
      if (k === 'r') { w = Math.max(8, N.w * (1 - val('r')) - x); }
      if (k === 't') { const bottom = y + h; y = Math.min(val('t') * N.h, bottom - 8); h = bottom - y; }
      if (k === 'b') { h = Math.max(8, N.h * (1 - val('b')) - y); }
      cr.rect = { x, y, w, h };
      if (cropAspect()) {
        // keep the shape: the other side follows, centred
        const a = cropAspect();
        const kk = Math.abs(cr.img.scaleX) / Math.abs(cr.img.scaleY);
        if (k === 'l' || k === 'r') { const nh = (w * kk) / a; cr.rect.y = y + h / 2 - nh / 2; cr.rect.h = nh; }
        else { const nw = (a * h) / kk; cr.rect.x = x + w / 2 - nw / 2; cr.rect.w = nw; }
        clampCropRect();
      } else clampCropRect('keep');
      placeCropBox();
      updateCropSliders();
    };
  }
  $('#cropReset').onclick = () => {
    cr.ratio = 'free';
    cr.rect = { x: 0, y: 0, w: cr.N.w, h: cr.N.h };
    placeCropBox();
    renderProps();
  };
  $('#cropDone').onclick = $('#cropDoneQ').onclick = () => finishCrop(true);
  $('#cropCancel').onclick = $('#cropCancelQ').onclick = () => finishCrop(false);
}
function finishCrop(apply) {
  const cr = state.crop;
  if (!cr) return;
  const c = state.canvas;
  const { img, box, orig } = cr;
  if (apply) syncCropFromBox();
  const { x, y, w, h } = cr.rect;
  const center = box.getCenterPoint();
  state.crop = null;
  state.loading = true;
  c.remove(box);
  c.uniformScaling = cr.uniform;
  if (apply) {
    img.set({ cropX: x, cropY: y, width: w, height: h });
    img.setPositionByOrigin(center, 'center', 'center');
    const cp = orig.clipPath;
    if (cp) {
      // keep a photo frame's shape, fitted to the new crop
      cp.set({ scaleX: (cp.scaleX || 1) * (w / orig.width), scaleY: (cp.scaleY || 1) * (h / orig.height), left: 0, top: 0 });
      img.clipPath = cp;
    }
  } else {
    img.set({ cropX: orig.cropX, cropY: orig.cropY, width: orig.width, height: orig.height, left: orig.left, top: orig.top });
    img.clipPath = orig.clipPath;
  }
  img.set({ selectable: orig.selectable !== false, evented: orig.evented !== false });
  img.dirty = true;
  img.setCoords();
  state.loading = false;
  if (c.getObjects().includes(img)) c.setActiveObject(img);
  c.requestRenderAll();
  if (apply) pushHistory();
  schedulePersist();
  renderProps();
}
function resetCrop(img) {
  const N = imgNatural(img);
  const center = img.getCenterPoint();
  const off = imgVec(img, (img.cropX || 0) + img.width / 2 - N.w / 2, (img.cropY || 0) + img.height / 2 - N.h / 2);
  const ow = img.width;
  const oh = img.height;
  img.set({ cropX: 0, cropY: 0, width: N.w, height: N.h });
  img.setPositionByOrigin(center.subtract(off), 'center', 'center');
  if (img.clipPath) img.clipPath.set({ scaleX: (img.clipPath.scaleX || 1) * (N.w / ow), scaleY: (img.clipPath.scaleY || 1) * (N.h / oh) });
  img.dirty = true;
  img.setCoords();
  state.canvas.requestRenderAll();
  pushHistory();
  schedulePersist();
  renderProps();
}

// ---------- Magic Write ----------
const MW_TONES = ['Friendly', 'Professional', 'Fun', 'Persuasive'];
const MW_LANGS = [['en', 'English'], ['zh', '中文'], ['ms', 'Melayu'], ['ta', 'தமிழ்'], ['id', 'Indonesia']];
function magicWriteHTML() {
  const mw = (state.mw ||= { prompt: '', tone: 'Friendly', lang: 'en', kind: 'headline', result: '' });
  return `<section class="mw-box">
    <h4>${icon('wand', 16)} Magic Write <small>free AI</small></h4>
    <textarea id="mwPrompt" class="search" rows="2" maxlength="600" placeholder="Describe what to write, e.g. “a headline for a bakery's weekend sale”">${esc(mw.prompt)}</textarea>
    <div class="mw-opts">
      <select id="mwKind" title="Length"><option value="headline" ${mw.kind === 'headline' ? 'selected' : ''}>Headline</option><option value="paragraph" ${mw.kind === 'paragraph' ? 'selected' : ''}>Paragraph</option></select>
      <select id="mwTone" title="Tone">${MW_TONES.map((t) => `<option ${t === mw.tone ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="mwLang" title="Language">${MW_LANGS.map(([v, l]) => `<option value="${v}" ${v === mw.lang ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <button class="btn primary block" id="mwGo">${icon('sparkle', 16)} Write for me</button>
    <div id="mwOut">${mw.result ? mwResultHTML(mw.result) : ''}</div>
  </section>`;
}
function mwResultHTML(text) {
  return `<div class="mw-result"><p id="mwText">${esc(text)}</p>
    <div class="row wrap"><button class="btn primary small" id="mwAdd">Add to page</button><button class="btn ghost small" id="mwReplace">Replace selected text</button><button class="btn ghost small" id="mwAgain">Try again</button></div></div>`;
}
async function magicWrite({ prompt, tone, lang, kind }) {
  let r;
  try {
    r = await fetch('api/free-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, tone, lang, kind }) });
  } catch {
    throw new Error(needsSite('Magic Write', "Couldn't reach the Artvas server. Check your internet connection and try again."));
  }
  const type = r.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error(needsSite('Magic Write', 'Magic Write needs the Artvas server. Open Artvas from your Railway link (not a plain static copy).'));
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.text) throw new Error(data.error || 'Magic Write could not write that. Try again.');
  return data.text;
}
function bindMagicWrite(p) {
  const mw = state.mw;
  const read = () => Object.assign(mw, { prompt: $('#mwPrompt', p).value, tone: $('#mwTone', p).value, lang: $('#mwLang', p).value, kind: $('#mwKind', p).value });
  ['mwPrompt', 'mwTone', 'mwLang', 'mwKind'].forEach((id) => ($('#' + id, p).onchange = read));
  $('#mwPrompt', p).oninput = read;
  const out = $('#mwOut', p);
  const bindResult = () => {
    if (!$('#mwAdd', out)) return;
    $('#mwAdd', out).onclick = () => {
      const head = mw.resultKind !== 'paragraph';
      addText({ text: mw.result, size: head ? 0.065 : 0.034, weight: head ? '700' : '400' });
    };
    $('#mwReplace', out).onclick = () => {
      const o = state.canvas.getActiveObject();
      if (!o || !isText(o)) return toast('Select a text box on the page first');
      setTextProp('text', mw.result);
      toast('Text replaced');
    };
    $('#mwAgain', out).onclick = go;
  };
  const go = async () => {
    read();
    if (!mw.prompt.trim()) return toast('Describe what you want to write first');
    const btn = $('#mwGo', p);
    btn.disabled = true;
    btn.textContent = 'Writing…';
    out.innerHTML = '<p class="muted">Writing with free AI…</p>';
    try {
      mw.result = await magicWrite(mw);
      mw.resultKind = mw.kind;
      if (!out.isConnected) return;
      out.innerHTML = mwResultHTML(mw.result);
      bindResult();
    } catch (e) {
      if (out.isConnected) out.innerHTML = `<p class="mw-err">${esc(e.message)}</p>`;
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.innerHTML = `${icon('sparkle', 16)} Write for me`;
      }
    }
  };
  $('#mwGo', p).onclick = go;
  bindResult();
}

// ---------- Panel bindings for all of the above ----------
function bindExtras(o, text, img) {
  const commit = () => { pushHistory(); schedulePersist(); };
  if (text) {
    const s = $('#pCurve');
    if (s) {
      s.oninput = () => { setCurve(text, +s.value); $('#pCurveV').textContent = s.value; $('#pCurve0').hidden = !+s.value; };
      s.onchange = commit;
      $('#pCurve0').onclick = () => { setCurve(text, 0); commit(); renderProps(); };
    }
  }
  if (img) {
    const crop = () => startCrop(img);
    const b1 = $('#imgCrop');
    if (b1) b1.onclick = crop;
    const b2 = $('#qCrop');
    if (b2) b2.onclick = crop;
    const b3 = $('#imgCropReset');
    if (b3) b3.onclick = () => resetCrop(img);
    $$('[data-pcol]').forEach((b) => (b.onclick = () => { setBackgroundFill({ color: b.dataset.pcol }); toast('Page background changed'); }));
    $$('[data-duo]').forEach((b) => (b.onclick = () => {
      const p = DUO_PRESETS[+b.dataset.duo];
      setDuotone(img, p?.dark, p?.light);
      commit();
      renderProps();
    }));
    const custom = () => setDuotone(img, $('#duoDark').value, $('#duoLight').value);
    ['duoDark', 'duoLight'].forEach((id) => {
      const e = $('#' + id);
      if (!e) return;
      e.oninput = custom;
      e.onchange = () => { commit(); renderProps(); };
    });
  }
  $$('[data-arr]').forEach((b) => (b.onclick = () => arrangeSelection(b.dataset.arr)));
}

installDesignExtras();
window.addEventListener('beforeunload', () => { if (state.design) captureCurrentPage(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.design) persist(); });
boot();

// expose a tiny API for debugging/testing
window.artvas = { video: _videoDebug, openVideo, pickVideoStarter, loadPack, state, addText, addShape, addImage, exportDesign, util, templateThumb, TEMPLATES, FORMATS, extras: { startCrop, finishCrop, setCrop: (r) => { if (state.crop) { state.crop.rect = { ...state.crop.rect, ...r }; clampCropRect(); placeCropBox(); } }, extractPalette, arrangeSelection, buildQR, addQR, setDuotone, curveLayout, ActiveSelection, duotoneClass: () => installDesignExtras.Duotone } };

/** Put a file input made in code into the page (visually hidden) so phones open the picker. */
function attachPicker(inp) {
  inp.className = 'file-hide';
  inp.tabIndex = -1;
  document.body.appendChild(inp);
  inp.addEventListener('change', () => setTimeout(() => inp.remove(), 1000));
  // if the picker is closed without choosing, tidy up the next time the page gets focus
  window.addEventListener('focus', () => setTimeout(() => !inp.files?.length && inp.remove(), 3000), { once: true });
}
