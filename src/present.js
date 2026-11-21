// Presentation mode: a full-screen slideshow of a design's pages, with element animations,
// page transitions, autoplay, a laser pointer and an optional presenter window
// (current + next slide, speaker notes, timer) kept in sync through a BroadcastChannel.
import { StaticCanvas } from 'fabric';
import { createAnimCanvas, renderFrame, animationLength } from './animate.js';
import { fontsIn } from './fonts.js';

export const TRANSITIONS = [
  ['none', 'None'],
  ['fade', 'Fade'],
  ['slide', 'Slide'],
  ['zoom', 'Zoom'],
];
const LOOPING = new Set(['pulse', 'wiggle', 'blink']);
const PI = {
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  laser: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const pi = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PI[n]}</svg>`;
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pageDuration = (p) => Math.max(1, +p?.duration || 5);
const hasLoopAnim = (json) => !!json?.objects?.some((o) => LOOPING.has(o.anim?.type));

let active = null; // the running presentation (only one at a time)
export const isPresenting = () => !!active;

/**
 * Start presenting. Must be called from a click/tap so full screen and the presenter window are allowed.
 * design: { name, width, height, pages: [{ json, notes, duration }] }
 * opts: { start, transition, autoplay, loop, presenter, onExit }
 */
export function startPresentation(design, opts = {}) {
  if (active) active.exit();
  const W = design.width;
  const H = design.height;
  const pages = design.pages;
  const n = pages.length;
  const transition = TRANSITIONS.some(([k]) => k === opts.transition) ? opts.transition : 'fade';
  const root = document.createElement('div');
  root.className = 'pv-root';
  root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Presentation');
  root.innerHTML = `
    <div class="pv-stage" id="pvStage"></div>
    <div class="pv-end" hidden><p>End of presentation</p><small>Click to exit · ← to go back</small></div>
    <div class="pv-laser" hidden></div>
    <div class="pv-progress"><i></i></div>
    <div class="pv-ui">
      <button class="pv-b" data-pv="prev" title="Previous (←)">${pi('prev')}</button>
      <span class="pv-count" aria-live="polite">1 / ${n}</span>
      <button class="pv-b" data-pv="next" title="Next (→ or space)">${pi('next')}</button>
      <span class="pv-sep"></span>
      <button class="pv-b" data-pv="auto" title="Autoplay (A)">${pi('play')}</button>
      <button class="pv-b" data-pv="laser" title="Laser pointer (L)">${pi('laser')}</button>
      <button class="pv-b" data-pv="presenter" title="Presenter view (P)">${pi('screen')}</button>
      <button class="pv-b" data-pv="full" title="Full screen (F)">${pi('full')}</button>
      <button class="pv-b" data-pv="exit" title="Exit (Esc)">${pi('x')}</button>
    </div>`;
  document.body.appendChild(root);
  const stage = root.querySelector('#pvStage');
  const ui = root.querySelector('.pv-ui');
  const bar = root.querySelector('.pv-progress i');
  const counter = root.querySelector('.pv-count');
  const laser = root.querySelector('.pv-laser');
  const endEl = root.querySelector('.pv-end');

  // full screen right away (needs the click that started us)
  let wentFull = false;
  if (opts.fullscreen !== false && root.requestFullscreen && !document.fullscreenElement) {
    root.requestFullscreen().then(() => (wentFull = true)).catch(() => {});
  }

  const S = {
    cur: -1,
    atEnd: false,
    autoplay: !!opts.autoplay,
    loop: !!opts.loop,
    laser: false,
    token: 0,
    cache: new Map(), // index -> Promise<StaticCanvas>
    slideEl: null,
    raf: 0,
    timer: 0,
    chan: null,
    chanId: '',
    win: null,
    startedAt: Date.now(),
    openedAt: 0,
  };

  // ---- sizing
  let fit = 1;
  const layout = () => {
    fit = Math.min(root.clientWidth / W, root.clientHeight / H) || 1;
    stage.style.width = `${Math.round(W * fit)}px`;
    stage.style.height = `${Math.round(H * fit)}px`;
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  const renderScale = () => {
    const dpr = window.devicePixelRatio || 1;
    return Math.max(0.05, Math.min(fit * dpr, 4096 / Math.max(W, H), 3));
  };

  function prepare(i) {
    if (!S.cache.has(i)) {
      const p = (async () => {
        await fontsIn(pages[i]?.json);
        const sc = await createAnimCanvas(pages[i]?.json, W, H, renderScale());
        renderFrame(sc, 0);
        return sc;
      })();
      p.catch(() => S.cache.delete(i));
      S.cache.set(i, p);
    }
    return S.cache.get(i);
  }
  function trimCache() {
    for (const [i, p] of S.cache)
      if (Math.abs(i - S.cur) > 2) {
        S.cache.delete(i);
        p.then((sc) => sc.dispose?.()).catch(() => {});
      }
  }

  function playElementAnimations(sc, json) {
    cancelAnimationFrame(S.raf);
    const len = animationLength(json);
    const loops = hasLoopAnim(json);
    if (!len && !loops) {
      renderFrame(sc, 1e6);
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      renderFrame(sc, t);
      if (t <= len + 0.05 || loops) S.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function setProgress(i, animate) {
    const from = (i / n) * 100;
    const to = ((i + 1) / n) * 100;
    bar.style.transition = 'none';
    bar.style.width = `${animate ? from : to}%`;
    if (animate) {
      void bar.offsetWidth;
      bar.style.transition = `width ${pageDuration(pages[i])}s linear`;
      bar.style.width = `${to}%`;
    }
  }

  function scheduleAutoplay() {
    clearTimeout(S.timer);
    if (!S.autoplay || S.atEnd) return;
    S.timer = setTimeout(() => next(), pageDuration(pages[S.cur]) * 1000);
  }

  function transitionIn(el, old, dir) {
    const dur = 480;
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    const anims = [];
    if (transition === 'fade' && old) {
      anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'ease' }));
    } else if (transition === 'slide' && old) {
      anims.push(el.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], { duration: dur, easing: ease }));
      anims.push(old.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], { duration: dur, easing: ease, fill: 'forwards' }));
    } else if (transition === 'zoom' && old) {
      anims.push(el.animate([{ transform: 'scale(.82)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: dur, easing: ease }));
      anims.push(old.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.12)', opacity: 0 }], { duration: dur, easing: ease, fill: 'forwards' }));
    }
    return Promise.all(anims.map((a) => a.finished.catch(() => {})));
  }

  async function goTo(i, { fromRemote = false } = {}) {
    if (!active) return;
    if (i >= n) {
      if (S.loop) i = 0;
      else return showEnd();
    }
    if (i < 0) return;
    if (i === S.cur && !S.atEnd) return;
    const dir = i >= S.cur ? 1 : -1;
    const token = ++S.token;
    hideEnd();
    let sc;
    try {
      sc = await prepare(i);
    } catch (e) {
      console.error('slide failed', e);
      sc = null;
    }
    if (token !== S.token || !active) return;
    const old = S.slideEl;
    const el = document.createElement('div');
    el.className = 'pv-slide';
    if (sc) {
      // a canvas can only be in one place: give each shown slide its own fresh canvas
      el.appendChild(sc.lowerCanvasEl);
      S.cache.delete(i);
    } else el.innerHTML = '<p class="pv-err">This page could not be shown</p>';
    stage.appendChild(el);
    S.slideEl = el;
    S.cur = i;
    S.atEnd = false;
    counter.textContent = `${i + 1} / ${n}`;
    setProgress(i, S.autoplay);
    if (sc) playElementAnimations(sc, pages[i]?.json);
    el._sc = sc;
    if (!fromRemote) broadcast({ t: 'go', index: i });
    scheduleAutoplay();
    transitionIn(el, old, dir).then(() => {
      if (old && old !== S.slideEl) {
        old._sc?.dispose?.();
        old.remove();
      }
    });
    if (old && transition === 'none') {
      old._sc?.dispose?.();
      old.remove();
    }
    trimCache();
    // get the neighbours ready for snappy transitions
    if (i + 1 < n) prepare(i + 1);
    if (i > 0) prepare(i - 1);
  }
  const next = () => (S.atEnd ? exit() : goTo(S.cur + 1));
  function showEnd() {
    S.atEnd = true;
    clearTimeout(S.timer);
    endEl.hidden = false;
    counter.textContent = `${n} / ${n}`;
    bar.style.transition = 'none';
    bar.style.width = '100%';
    broadcast({ t: 'end' });
  }
  function hideEnd() {
    endEl.hidden = true;
  }
  // going back from the end screen re-shows the last slide
  const backFromEnd = () => {
    S.atEnd = false;
    hideEnd();
    counter.textContent = `${S.cur + 1} / ${n}`;
    setProgress(S.cur, false);
    broadcast({ t: 'go', index: S.cur });
  };
  const prev = () => (S.atEnd ? backFromEnd() : goTo(S.cur - 1));

  // ---- UI auto-hide
  let hideT = 0;
  const poke = () => {
    root.classList.add('pv-show-ui');
    clearTimeout(hideT);
    hideT = setTimeout(() => root.classList.remove('pv-show-ui'), 2600);
  };
  poke();

  function syncButtons() {
    const a = ui.querySelector('[data-pv="auto"]');
    a.innerHTML = pi(S.autoplay ? 'pause' : 'play');
    a.classList.toggle('on', S.autoplay);
    a.title = S.autoplay ? 'Stop autoplay (A)' : 'Autoplay (A)';
    ui.querySelector('[data-pv="laser"]').classList.toggle('on', S.laser);
    root.classList.toggle('pv-laser-on', S.laser);
    if (!S.laser) laser.hidden = true;
  }
  function toggleAutoplay() {
    S.autoplay = !S.autoplay;
    syncButtons();
    setProgress(S.cur, S.autoplay);
    scheduleAutoplay();
  }
  function toggleLaser() {
    S.laser = !S.laser;
    syncButtons();
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.requestFullscreen?.().then(() => (wentFull = true)).catch(() => {});
  }

  ui.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pv]');
    if (!b) return;
    e.stopPropagation();
    const a = b.dataset.pv;
    if (a === 'prev') prev();
    else if (a === 'next') next();
    else if (a === 'auto') toggleAutoplay();
    else if (a === 'laser') toggleLaser();
    else if (a === 'full') toggleFull();
    else if (a === 'presenter') openPresenter();
    else if (a === 'exit') exit();
  });
  ui.addEventListener('pointerdown', (e) => e.stopPropagation());
  ui.addEventListener('pointerup', (e) => e.stopPropagation());

  // ---- keyboard (captured so the editor's shortcuts don't run underneath)
  const onKey = (e) => {
    const k = e.key;
    e.stopImmediatePropagation();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) next();
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) prev();
    else if (k === 'Home') goTo(0);
    else if (k === 'End') goTo(n - 1);
    else if (k === 'Escape') exit();
    else if (k === 'l' || k === 'L') toggleLaser();
    else if (k === 'a' || k === 'A') toggleAutoplay();
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'p' || k === 'P') openPresenter();
    else return;
    e.preventDefault();
    poke();
  };
  window.addEventListener('keydown', onKey, true);

  // ---- pointer: click halves, swipe, laser
  let down = null;
  const moveLaser = (e) => {
    const r = root.getBoundingClientRect();
    laser.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    laser.hidden = false;
  };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') poke();
    if (S.laser && (e.pointerType === 'mouse' || down)) moveLaser(e);
  });
  root.addEventListener('pointerleave', () => {
    if (S.laser) laser.hidden = true;
  });
  root.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: Date.now(), type: e.pointerType };
    if (S.laser) moveLaser(e);
  });
  root.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const touch = down.type !== 'mouse';
    down = null;
    if (touch) poke();
    if (S.laser && touch) {
      setTimeout(() => !down && (laser.hidden = true), 700);
      return; // with the laser on, fingers point instead of turning pages (use the buttons)
    }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) return dx < 0 ? next() : prev();
    if (Math.hypot(dx, dy) > 12) return;
    if (S.atEnd) return exit();
    const r = root.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 2) prev();
    else next();
  });
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- presenter window
  function broadcast(msg) {
    try {
      S.chan?.postMessage(msg);
    } catch {}
  }
  function openPresenter() {
    if (!S.chan) {
      S.chanId = Math.random().toString(36).slice(2, 10);
      S.chan = new BroadcastChannel(`artvas-present-${S.chanId}`);
      S.chan.onmessage = (e) => {
        const m = e.data || {};
        if (m.t === 'hello') {
          broadcast({
            t: 'init',
            design: { name: design.name, width: W, height: H, pages: pages.map((p) => ({ json: p.json, notes: p.notes || '', duration: p.duration })) },
            index: Math.max(0, S.cur),
            atEnd: S.atEnd,
            startedAt: S.startedAt,
          });
        } else if (m.t === 'go') goTo(+m.index);
        else if (m.t === 'next') next();
        else if (m.t === 'prev') prev();
        else if (m.t === 'exit') exit();
      };
    }
    const url = `${location.pathname}${location.search}#/presenter/${S.chanId}`;
    S.openedAt = Date.now();
    S.win = window.open(url, `artvas-presenter-${S.chanId}`, 'popup,width=1100,height=700');
    if (!S.win) opts.toast?.('Allow pop-ups to open the presenter view');
    root.focus();
  }

  function exit() {
    if (!active) return;
    active = null;
    S.token++;
    cancelAnimationFrame(S.raf);
    clearTimeout(S.timer);
    clearTimeout(hideT);
    broadcast({ t: 'exit' });
    try {
      S.chan?.close();
    } catch {}
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('fullscreenchange', onFs);
    ro.disconnect();
    for (const p of S.cache.values()) p.then((sc) => sc.dispose?.()).catch(() => {});
    S.cache.clear();
    root.querySelectorAll('.pv-slide').forEach((el) => el._sc?.dispose?.());
    if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
    root.remove();
    opts.onExit?.(S.cur);
  }
  // leaving full screen (Esc) ends the show — except when the browser dropped full screen because the
  // presenter window opened
  const onFs = () => {
    if (document.fullscreenElement || !wentFull) return;
    wentFull = false;
    if ((S.win && !S.win.closed) || Date.now() - S.openedAt < 3000) return;
    exit();
  };
  document.addEventListener('fullscreenchange', onFs);

  active = { exit, goTo, next, prev, state: S, root };
  syncButtons();
  if (opts.presenter) openPresenter();
  root.focus();
  goTo(Math.max(0, Math.min(n - 1, opts.start || 0)));
  return active;
}

/** Test/debug access to the running presentation. */
export const _present = () => active;

// =====================================================
// Presenter window (opened at #/presenter/<channel>)
// =====================================================
async function staticSlide(design, i, maxSize) {
  const p = design.pages[i];
  await fontsIn(p?.json);
  const scale = Math.min(1, maxSize / Math.max(design.width, design.height)) * Math.min(2, window.devicePixelRatio || 1);
  const el = document.createElement('canvas');
  const sc = new StaticCanvas(el, { width: Math.round(design.width * scale), height: Math.round(design.height * scale), enableRetinaScaling: false, renderOnAddRemove: false });
  if (p?.json) await sc.loadFromJSON(p.json);
  if (!sc.backgroundColor) sc.backgroundColor = '#ffffff';
  sc.setZoom(scale);
  sc.renderAll();
  return sc;
}

export function bootPresenter(app, chanId) {
  document.title = 'Presenter view · Artvas';
  app.innerHTML = `<div class="pr-root">
    <header class="pr-top"><b id="prTitle">Presenter view</b><span class="pr-spacer"></span>
      <span class="pr-clock" id="prClock"></span>
      <span class="pr-timer" title="Time since the presentation started"><b id="prTimer">00:00</b><button class="pr-small" id="prReset">Reset</button></span>
    </header>
    <div class="pr-main">
      <section class="pr-cur"><div class="pr-label">Current <span id="prCount"></span></div><div class="pr-slide" id="prCur"><p class="pr-wait">Waiting for the presentation…</p></div></section>
      <section class="pr-side">
        <div class="pr-label">Next</div><div class="pr-slide small" id="prNext"></div>
        <div class="pr-label">Notes</div><div class="pr-notes" id="prNotes"></div>
      </section>
    </div>
    <footer class="pr-bottom">
      <button class="pr-btn" id="prPrev">${pi('prev')} Previous</button>
      <button class="pr-btn primary" id="prNextBtn">Next ${pi('next')}</button>
      <span class="pr-spacer"></span>
      <button class="pr-btn" id="prExit">${pi('x')} End presentation</button>
    </footer>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const chan = new BroadcastChannel(`artvas-present-${chanId}`);
  const st = { design: null, index: 0, atEnd: false, startedAt: Date.now(), token: 0, ended: false };
  const pad = (v) => String(v).padStart(2, '0');
  const tick = () => {
    const s = Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000));
    $('#prTimer').textContent = `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    $('#prClock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 500);
  $('#prReset').onclick = () => {
    st.startedAt = Date.now();
    tick();
  };

  const put = (box, sc) => {
    box.querySelectorAll('canvas').forEach((c) => c._sc?.dispose?.());
    box.innerHTML = '';
    if (sc) {
      sc.lowerCanvasEl._sc = sc;
      box.appendChild(sc.lowerCanvasEl);
    }
  };
  async function show() {
    const d = st.design;
    if (!d) return;
    const token = ++st.token;
    const i = st.index;
    const n = d.pages.length;
    $('#prCount').textContent = st.atEnd ? `· end (${n} / ${n})` : `· ${i + 1} / ${n}`;
    const notes = d.pages[i]?.notes || '';
    $('#prNotes').innerHTML = notes ? escH(notes).replace(/\n/g, '<br>') : '<span class="pr-muted">No notes for this page. Add them in the editor under the page (Notes).</span>';
    const [cur, nxt] = await Promise.all([staticSlide(d, i, 1200), i + 1 < n ? staticSlide(d, i + 1, 600) : null]);
    if (token !== st.token) {
      cur?.dispose();
      nxt?.dispose();
      return;
    }
    put($('#prCur'), cur);
    put($('#prNext'), nxt);
    if (!nxt) $('#prNext').innerHTML = '<p class="pr-muted">End of presentation</p>';
  }
  chan.onmessage = (e) => {
    const m = e.data || {};
    if (m.t === 'init') {
      st.design = m.design;
      st.index = m.index || 0;
      st.atEnd = !!m.atEnd;
      st.startedAt = m.startedAt || Date.now();
      $('#prTitle').textContent = m.design.name || 'Presenter view';
      show();
    } else if (m.t === 'go') {
      st.index = +m.index || 0;
      st.atEnd = false;
      show();
    } else if (m.t === 'end') {
      st.atEnd = true;
      show();
    } else if (m.t === 'exit') {
      st.ended = true;
      $('#prCur').innerHTML = '<p class="pr-wait">The presentation has ended. You can close this window.</p>';
      $('#prNext').innerHTML = '';
      setTimeout(() => window.close(), 1500);
    }
  };
  chan.postMessage({ t: 'hello' });
  // ask again in case the main window was still busy
  const again = setInterval(() => (st.design ? clearInterval(again) : chan.postMessage({ t: 'hello' })), 800);
  $('#prPrev').onclick = () => chan.postMessage({ t: 'prev' });
  $('#prNextBtn').onclick = () => chan.postMessage({ t: 'next' });
  $('#prExit').onclick = () => chan.postMessage({ t: 'exit' });
  window.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) chan.postMessage({ t: 'next' });
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) chan.postMessage({ t: 'prev' });
    else return;
    e.preventDefault();
  });
  window._presenter = st;
}
