// Artvas Suite: nine free tools in one place (docs, tasks, booking, inbox, screen recorder,
// dictation, SEO checker, voice studio, AI studio). Everything runs in the browser and saves locally.
import './suite.css';
import { speak, speakOnline, VOICES, ONLINE_LANGS } from './tts.js';
import { AI_MODELS, VIDEO_MODELS, getKey, setKey, generateImage, generateVideo, isFreeModel } from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const load = (k, d) => { try { const v = localStorage.getItem('artvas-suite-' + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('artvas-suite-' + k, JSON.stringify(v)); } catch {} };
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const textBlob = (t, type = 'text/plain') => new Blob([t], { type: type + ';charset=utf-8' });
const toast = (m) => {
  const t = Object.assign(document.createElement('div'), { className: 'su-toast', textContent: m });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
};

// ---------------------------------------------------------------- Docs (Notion / AppFlowy)
function docsTool(el) {
  let pages = load('docs', [{ id: uid(), title: 'Welcome', html: '<h2>Welcome to Docs</h2><p>Write notes, wikis and plans here. Everything saves in your browser.</p><ul><li>Use the toolbar for headings and lists</li><li>Add more pages on the left</li></ul>' }]);
  let cur = pages[0].id;
  const persist = () => save('docs', pages);
  const draw = () => {
    const p = pages.find((x) => x.id === cur) || pages[0];
    cur = p.id;
    el.innerHTML = `<div class="su-split">
      <aside class="su-side"><button class="su-btn pri" id="dNew">+ New page</button>
        ${pages.map((x) => `<button class="su-item ${x.id === cur ? 'on' : ''}" data-id="${x.id}">${esc(x.title || 'Untitled')}</button>`).join('')}</aside>
      <section class="su-main">
        <div class="su-bar"><input id="dTitle" class="su-title" value="${esc(p.title)}" placeholder="Untitled">
          <span class="su-sp"></span><button class="su-btn" id="dMd">Export .md</button><button class="su-btn danger" id="dDel">Delete</button></div>
        <div class="su-tb">${[['bold', 'B'], ['italic', 'I'], ['h', 'H2'], ['p', 'Text'], ['ul', '• List'], ['ol', '1. List'], ['todo', '☐ To-do'], ['hr', '—']].map(([c, l]) => `<button data-c="${c}">${l}</button>`).join('')}</div>
        <div id="dBody" class="su-doc" contenteditable="true" spellcheck="true"></div>
      </section></div>`;
    const body = $('#dBody', el);
    body.innerHTML = p.html;
    body.oninput = () => { p.html = body.innerHTML; persist(); };
    $('#dTitle', el).oninput = (e) => { p.title = e.target.value; persist(); const b = $(`.su-item[data-id="${p.id}"]`, el); if (b) b.textContent = p.title || 'Untitled'; };
    $$('.su-item', el).forEach((b) => (b.onclick = () => { cur = b.dataset.id; draw(); }));
    $('#dNew', el).onclick = () => { const n = { id: uid(), title: '', html: '<p><br></p>' }; pages.push(n); cur = n.id; persist(); draw(); };
    $('#dDel', el).onclick = () => { if (pages.length < 2 || !confirm('Delete this page?')) return; pages = pages.filter((x) => x.id !== p.id); persist(); draw(); };
    $('#dMd', el).onclick = () => {
      const d = document.createElement('div'); d.innerHTML = p.html;
      const md = [...d.childNodes].map((n) => {
        const t = (n.textContent || '').trim(); const tag = (n.tagName || '').toLowerCase();
        if (/^h[1-6]$/.test(tag)) return '#'.repeat(+tag[1]) + ' ' + t;
        if (tag === 'ul') return [...n.children].map((li) => (li.dataset.todo ? '- [ ] ' : '- ') + li.textContent.trim()).join('\n');
        if (tag === 'ol') return [...n.children].map((li, i) => `${i + 1}. ${li.textContent.trim()}`).join('\n');
        if (tag === 'hr') return '---';
        return t;
      }).join('\n\n');
      download((p.title || 'page') + '.md', textBlob(`# ${p.title}\n\n${md}\n`));
    };
    $$('.su-tb button', el).forEach((b) => (b.onmousedown = (e) => {
      e.preventDefault(); body.focus();
      const c = b.dataset.c;
      if (c === 'bold') document.execCommand('bold');
      else if (c === 'italic') document.execCommand('italic');
      else if (c === 'h') document.execCommand('formatBlock', false, 'h2');
      else if (c === 'p') document.execCommand('formatBlock', false, 'p');
      else if (c === 'ul') document.execCommand('insertUnorderedList');
      else if (c === 'ol') document.execCommand('insertOrderedList');
      else if (c === 'hr') document.execCommand('insertHorizontalRule');
      else if (c === 'todo') document.execCommand('insertHTML', false, '<ul class="su-todo"><li data-todo="1">To-do</li></ul>');
      p.html = body.innerHTML; persist();
    }));
    body.onclick = (e) => { const li = e.target.closest('li[data-todo]'); if (li && e.offsetX < 24) { li.classList.toggle('done'); p.html = body.innerHTML; persist(); } };
  };
  draw();
}

// ---------------------------------------------------------------- Tasks (Asana / OpenProject)
function tasksTool(el) {
  const COLS = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  let tasks = load('tasks', [{ id: uid(), title: 'Plan this week', col: 'todo', due: '', note: '' }, { id: uid(), title: 'Post a Reel', col: 'doing', due: '', note: '' }]);
  const persist = () => save('tasks', tasks);
  const draw = () => {
    const today = new Date().toISOString().slice(0, 10);
    el.innerHTML = `<div class="su-bar"><input id="tIn" placeholder="New task…" class="su-in"><input id="tDue" type="date" class="su-in sm"><button class="su-btn pri" id="tAdd">Add</button>
      <span class="su-sp"></span><span class="su-muted">${tasks.filter((t) => t.col === 'done').length}/${tasks.length} done</span></div>
      <div class="su-board">${COLS.map(([id, label]) => `<div class="su-col" data-col="${id}"><h4>${label} <small>${tasks.filter((t) => t.col === id).length}</small></h4>
        ${tasks.filter((t) => t.col === id).map((t) => `<div class="su-task ${t.due && t.due < today && t.col !== 'done' ? 'late' : ''}" draggable="true" data-id="${t.id}"><b>${esc(t.title)}</b>
          ${t.due ? `<small>Due ${esc(t.due)}</small>` : ''}<div class="su-tact"><button data-mv="-1" title="Back">←</button><button data-mv="1" title="Forward">→</button><button data-rm title="Delete">✕</button></div></div>`).join('')}</div>`).join('')}</div>`;
    const add = () => { const v = $('#tIn', el).value.trim(); if (!v) return; tasks.push({ id: uid(), title: v, col: 'todo', due: $('#tDue', el).value, note: '' }); persist(); draw(); };
    $('#tAdd', el).onclick = add;
    $('#tIn', el).onkeydown = (e) => e.key === 'Enter' && add();
    $$('.su-task', el).forEach((c) => {
      const t = tasks.find((x) => x.id === c.dataset.id);
      c.ondragstart = (e) => e.dataTransfer.setData('text/plain', t.id);
      $$('[data-mv]', c).forEach((b) => (b.onclick = () => { const i = COLS.findIndex(([k]) => k === t.col) + +b.dataset.mv; if (COLS[i]) { t.col = COLS[i][0]; persist(); draw(); } }));
      $('[data-rm]', c).onclick = () => { tasks = tasks.filter((x) => x !== t); persist(); draw(); };
    });
    $$('.su-col', el).forEach((col) => {
      col.ondragover = (e) => e.preventDefault();
      col.ondrop = (e) => { e.preventDefault(); const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (t) { t.col = col.dataset.col; persist(); draw(); } };
    });
  };
  draw();
}

// ---------------------------------------------------------------- Booking (Cal.com / Calendly)
function bookingTool(el) {
  const cfg = load('book-cfg', { title: '30 min meeting', days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', len: 30 });
  let bookings = load('bookings', []);
  const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slots = () => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if (!cfg.days.includes(d.getDay())) continue;
      const key = d.toISOString().slice(0, 10);
      const list = [];
      for (let m = mins(cfg.from); m + cfg.len <= mins(cfg.to); m += cfg.len) list.push(hm(m));
      out.push({ key, label: `${DN[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, list });
    }
    return out;
  };
  const ics = (b) => {
    const z = (s) => s.replace(/[-:]/g, '');
    const st = new Date(`${b.date}T${b.time}:00`); const en = new Date(st.getTime() + cfg.len * 60000);
    const f = (d) => z(d.toISOString().slice(0, 19)) + 'Z';
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${b.id}@artvas\r\nDTSTART:${f(st)}\r\nDTEND:${f(en)}\r\nSUMMARY:${cfg.title} with ${b.name}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  };
  const draw = () => {
    const sl = slots();
    el.innerHTML = `<div class="su-grid2"><section class="su-card"><h3>Your availability</h3>
      <label>Event name<input id="bT" class="su-in" value="${esc(cfg.title)}"></label>
      <div class="su-days">${DN.map((n, i) => `<button class="su-chip ${cfg.days.includes(i) ? 'on' : ''}" data-d="${i}">${n}</button>`).join('')}</div>
      <div class="su-row"><label>From<input id="bF" type="time" class="su-in" value="${cfg.from}"></label><label>To<input id="bTo" type="time" class="su-in" value="${cfg.to}"></label>
      <label>Length<select id="bL" class="su-in">${[15, 30, 45, 60].map((n) => `<option ${n === cfg.len ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <h3>Bookings (${bookings.length})</h3>${bookings.length ? bookings.map((b) => `<div class="su-line"><span><b>${esc(b.name)}</b> · ${b.date} ${b.time}<br><small>${esc(b.email)}</small></span><button class="su-btn sm" data-ics="${b.id}">.ics</button><button class="su-btn sm danger" data-x="${b.id}">✕</button></div>`).join('') : '<p class="su-muted">No bookings yet.</p>'}</section>
      <section class="su-card"><h3>Booking page preview</h3><p class="su-muted">${esc(cfg.title)} · ${cfg.len} min</p>
      ${sl.slice(0, 7).map((d) => `<div class="su-day"><b>${d.label}</b><div class="su-slots">${d.list.map((t) => { const taken = bookings.some((b) => b.date === d.key && b.time === t); return `<button class="su-chip" ${taken ? 'disabled' : ''} data-date="${d.key}" data-time="${t}">${t}</button>`; }).join('')}</div></div>`).join('') || '<p class="su-muted">Pick at least one day.</p>'}</section></div>`;
    const upd = () => { save('book-cfg', cfg); draw(); };
    $('#bT', el).onchange = (e) => { cfg.title = e.target.value; upd(); };
    $('#bF', el).onchange = (e) => { cfg.from = e.target.value; upd(); };
    $('#bTo', el).onchange = (e) => { cfg.to = e.target.value; upd(); };
    $('#bL', el).onchange = (e) => { cfg.len = +e.target.value; upd(); };
    $$('[data-d]', el).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; cfg.days = cfg.days.includes(d) ? cfg.days.filter((x) => x !== d) : [...cfg.days, d]; upd(); }));
    $$('[data-date]', el).forEach((b) => (b.onclick = () => {
      const name = prompt('Your name?'); if (!name) return;
      const email = prompt('Your email?') || '';
      bookings.push({ id: uid(), name, email, date: b.dataset.date, time: b.dataset.time }); save('bookings', bookings); draw(); toast('Booked!');
    }));
    $$('[data-x]', el).forEach((b) => (b.onclick = () => { bookings = bookings.filter((x) => x.id !== b.dataset.x); save('bookings', bookings); draw(); }));
    $$('[data-ics]', el).forEach((b) => (b.onclick = () => download('booking.ics', textBlob(ics(bookings.find((x) => x.id === b.dataset.ics)), 'text/calendar'))));
  };
  draw();
}

// ---------------------------------------------------------------- Inbox (Chatwoot / Intercom)
function inboxTool(el) {
  let convs = load('inbox', [{ id: uid(), name: 'Sample customer', open: true, msgs: [{ from: 'c', text: 'Hi! Do you have this in stock?', at: Date.now() }] }]);
  let cur = convs[0]?.id;
  const canned = ['Thanks for reaching out! Let me check that for you.', 'It is in stock and ready to ship.', 'Is there anything else I can help with?'];
  const persist = () => save('inbox', convs);
  const draw = () => {
    const c = convs.find((x) => x.id === cur) || convs[0]; cur = c?.id;
    el.innerHTML = `<div class="su-split"><aside class="su-side"><button class="su-btn pri" id="iNew">+ New conversation</button>
      ${convs.map((x) => `<button class="su-item ${x.id === cur ? 'on' : ''}" data-id="${x.id}">${x.open ? '🟢' : '✔️'} ${esc(x.name)}<small>${esc(x.msgs[x.msgs.length - 1]?.text.slice(0, 40) || '')}</small></button>`).join('')}</aside>
      <section class="su-main">${c ? `<div class="su-bar"><b>${esc(c.name)}</b><span class="su-sp"></span><button class="su-btn" id="iRes">${c.open ? 'Resolve' : 'Reopen'}</button><button class="su-btn danger" id="iDel">Delete</button></div>
      <div class="su-chat" id="iChat">${c.msgs.map((m) => `<div class="su-msg ${m.from}">${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')}</div>
      <div class="su-canned">${canned.map((t, i) => `<button class="su-chip" data-c="${i}">${esc(t.slice(0, 28))}…</button>`).join('')}</div>
      <div class="su-bar"><input id="iIn" class="su-in" placeholder="Reply as agent…"><button class="su-btn pri" id="iAgent">Send</button><button class="su-btn" id="iCust" title="Add a message as the customer (to test)">As customer</button></div>` : '<p class="su-muted">No conversations.</p>'}</section></div>`;
    $$('.su-item', el).forEach((b) => (b.onclick = () => { cur = b.dataset.id; draw(); }));
    $('#iNew', el).onclick = () => { const n = prompt('Customer name?'); if (!n) return; const x = { id: uid(), name: n, open: true, msgs: [] }; convs.unshift(x); cur = x.id; persist(); draw(); };
    if (!c) return;
    const send = (from) => { const v = $('#iIn', el).value.trim(); if (!v) return; c.msgs.push({ from, text: v, at: Date.now() }); persist(); draw(); };
    $('#iAgent', el).onclick = () => send('a'); $('#iCust', el).onclick = () => send('c');
    $('#iIn', el).onkeydown = (e) => e.key === 'Enter' && send('a');
    $$('[data-c]', el).forEach((b) => (b.onclick = () => { $('#iIn', el).value = canned[+b.dataset.c]; $('#iIn', el).focus(); }));
    $('#iRes', el).onclick = () => { c.open = !c.open; persist(); draw(); };
    $('#iDel', el).onclick = () => { convs = convs.filter((x) => x !== c); persist(); draw(); };
    const ch = $('#iChat', el); ch.scrollTop = ch.scrollHeight;
  };
  draw();
}

// ---------------------------------------------------------------- Recorder (Cap / Loom)
function recorderTool(el) {
  let stream, rec, chunks = [], t0 = 0, timer, cam;
  const ok = !!navigator.mediaDevices?.getDisplayMedia && 'MediaRecorder' in window;
  el.innerHTML = `<div class="su-card wide"><h3>Screen recorder</h3>
    <p class="su-muted">Record your screen, with your microphone and an optional camera bubble. Nothing is uploaded: the video stays on your device.</p>
    ${ok ? '' : '<p class="su-warn">Screen recording is not supported in this browser (try Chrome or Edge on a computer).</p>'}
    <div class="su-row"><label class="su-chk"><input type="checkbox" id="rMic" checked> Microphone</label><label class="su-chk"><input type="checkbox" id="rCam"> Camera bubble</label>
    <button class="su-btn pri" id="rGo" ${ok ? '' : 'disabled'}>● Start recording</button><button class="su-btn danger" id="rStop" disabled>■ Stop</button><span id="rT" class="su-muted">00:00</span></div>
    <div class="su-stage"><video id="rPrev" playsinline muted></video><video id="rCam2" class="su-bubble" playsinline muted hidden></video></div>
    <div class="su-row"><button class="su-btn" id="rDl" disabled>Download video</button><span id="rS" class="su-muted"></span></div></div>`;
  const prev = $('#rPrev', el), camV = $('#rCam2', el);
  const clean = () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); cam?.getTracks().forEach((t) => t.stop()); camV.hidden = true; $('#rGo', el).disabled = false; $('#rStop', el).disabled = true; };
  $('#rGo', el).onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      if ($('#rMic', el).checked) { try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); m.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch { toast('Microphone not available'); } }
      if ($('#rCam', el).checked) { try { cam = await navigator.mediaDevices.getUserMedia({ video: true }); camV.srcObject = cam; camV.hidden = false; camV.play(); } catch { toast('Camera not available'); } }
      prev.srcObject = stream; prev.muted = true; prev.controls = false; prev.play();
      const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      chunks = []; rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        prev.srcObject = null; prev.src = URL.createObjectURL(blob); prev.controls = true; prev.muted = false;
        $('#rDl', el).disabled = false; $('#rDl', el).onclick = () => download(`recording.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob);
        $('#rS', el).textContent = `${(blob.size / 1048576).toFixed(1)} MB`; clean();
      };
      stream.getVideoTracks()[0].onended = () => rec.state !== 'inactive' && rec.stop();
      rec.start(1000); t0 = Date.now();
      timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#rT', el).textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
      $('#rGo', el).disabled = true; $('#rStop', el).disabled = false; $('#rDl', el).disabled = true;
    } catch (e) { toast(e.name === 'NotAllowedError' ? 'Recording was cancelled' : 'Could not start recording'); clean(); }
  };
  $('#rStop', el).onclick = () => rec?.state !== 'inactive' && rec.stop();
  return () => { try { rec?.state !== 'inactive' && rec.stop(); } catch {} clean(); };
}

// ---------------------------------------------------------------- Dictation (OpenWhispr / Wispr Flow)
function dictationTool(el) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = [['id-ID', 'Bahasa Indonesia'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['zh-CN', '中文 普通话'], ['ms-MY', 'Bahasa Melayu'], ['ta-IN', 'தமிழ்'], ['th-TH', 'ไทย'], ['vi-VN', 'Tiếng Việt'], ['ja-JP', '日本語'], ['ko-KR', '한국어'], ['es-ES', 'Español'], ['fr-FR', 'Français']];
  el.innerHTML = `<div class="su-card wide"><h3>Voice dictation</h3><p class="su-muted">Speak and your words are typed. Uses your browser's speech recognition (Chrome and Edge work best).</p>
    ${SR ? '' : '<p class="su-warn">This browser has no speech recognition. Try Chrome or Edge.</p>'}
    <div class="su-row"><select id="vL" class="su-in sm">${LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select>
    <button class="su-btn pri" id="vGo" ${SR ? '' : 'disabled'}>🎙 Start</button><button class="su-btn" id="vCp">Copy</button><button class="su-btn" id="vDoc">Save to Docs</button><button class="su-btn danger" id="vClr">Clear</button><span id="vS" class="su-muted"></span></div>
    <textarea id="vOut" class="su-area" placeholder="Your dictated text appears here…"></textarea></div>`;
  let r, on = false;
  const out = $('#vOut', el), st = $('#vS', el), go = $('#vGo', el);
  const stop = () => { on = false; try { r?.stop(); } catch {} go.textContent = '🎙 Start'; st.textContent = ''; };
  go.onclick = () => {
    if (on) return stop();
    r = new SR(); r.lang = $('#vL', el).value; r.continuous = true; r.interimResults = true;
    let base = out.value ? out.value.replace(/\s*$/, ' ') : '';
    r.onresult = (e) => { let fin = '', tmp = ''; for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript)); if (fin) base += fin.trim() + ' '; out.value = base + tmp; };
    r.onerror = (e) => { st.textContent = e.error === 'not-allowed' ? 'Microphone blocked' : e.error; };
    r.onend = () => { if (on) { try { r.start(); } catch {} } };
    on = true; r.start(); go.textContent = '■ Stop'; st.textContent = 'Listening…';
  };
  $('#vCp', el).onclick = () => navigator.clipboard?.writeText(out.value).then(() => toast('Copied'), () => toast('Select the text and copy it'));
  $('#vClr', el).onclick = () => (out.value = '');
  $('#vDoc', el).onclick = () => { if (!out.value.trim()) return; const d = load('docs', []); d.push({ id: uid(), title: 'Dictation ' + new Date().toLocaleString(), html: '<p>' + esc(out.value).replace(/\n/g, '<br>') + '</p>' }); save('docs', d); toast('Saved as a new Docs page'); };
  return stop;
}

// ---------------------------------------------------------------- SEO checker (OpenSEO / Semrush)
function seoTool(el) {
  el.innerHTML = `<div class="su-card wide"><h3>On-page SEO checker</h3><p class="su-muted">Paste your page's HTML (or just the text) and a target keyword. Runs entirely in your browser.</p>
    <div class="su-row"><input id="sK" class="su-in" placeholder="Target keyword, e.g. iPhone 15 Batam"><button class="su-btn pri" id="sGo">Analyze</button></div>
    <textarea id="sIn" class="su-area" placeholder="Paste HTML or text here…"></textarea><div id="sOut"></div></div>`;
  $('#sGo', el).onclick = () => {
    const raw = $('#sIn', el).value; const kw = $('#sK', el).value.trim().toLowerCase(); if (!raw.trim()) return toast('Paste some content first');
    const d = new DOMParser().parseFromString(raw, 'text/html');
    const title = d.querySelector('title')?.textContent.trim() || '';
    const desc = d.querySelector('meta[name="description"]')?.content || '';
    const h1 = [...d.querySelectorAll('h1')].map((h) => h.textContent.trim());
    const h2 = d.querySelectorAll('h2').length;
    const imgs = [...d.querySelectorAll('img')]; const noAlt = imgs.filter((i) => !i.getAttribute('alt')).length;
    const links = [...d.querySelectorAll('a[href]')]; const ext = links.filter((a) => /^https?:/.test(a.getAttribute('href'))).length;
    const text = (d.body?.textContent || '').replace(/\s+/g, ' ').trim(); const words = text ? text.split(' ').length : 0;
    const count = kw ? (text.toLowerCase().match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
    const dens = words && kw ? ((count * kw.split(/\s+/).length) / words) * 100 : 0;
    const sent = Math.max(1, (text.match(/[.!?]+/g) || []).length); const avg = words / sent;
    const has = (s) => kw && s.toLowerCase().includes(kw);
    const checks = [
      [title.length >= 30 && title.length <= 60, `Title length ${title.length} (aim for 30–60)`, !title],
      [has(title), 'Keyword in title', !kw],
      [desc.length >= 70 && desc.length <= 160, `Meta description ${desc.length} chars (aim for 70–160)`, !desc],
      [h1.length === 1, `${h1.length} H1 heading(s) (use exactly one)`, false],
      [h1.some(has), 'Keyword in H1', !kw],
      [words >= 300, `${words} words (300+ recommended)`, false],
      [dens >= 0.5 && dens <= 3, `Keyword density ${dens.toFixed(1)}% (${count} uses; aim for 0.5–3%)`, !kw],
      [avg <= 22, `Average sentence ${avg.toFixed(0)} words (22 or fewer reads easily)`, false],
      [!imgs.length || !noAlt, `${noAlt} of ${imgs.length} images missing alt text`, false],
      [links.length > 0, `${links.length} links (${ext} external)`, false],
      [h2 > 0, `${h2} H2 subheading(s)`, false],
    ];
    const pass = checks.filter((c) => c[0]).length;
    $('#sOut', el).innerHTML = `<div class="su-score"><b>${Math.round((pass / checks.length) * 100)}</b><span>/100</span></div>${checks.map(([p, m]) => `<div class="su-check ${p ? 'ok' : 'bad'}">${p ? '✓' : '✗'} ${esc(m)}</div>`).join('')}`;
  };
}

// ---------------------------------------------------------------- Voice studio (Voicebox / ElevenLabs)
function voiceTool(el) {
  el.innerHTML = `<div class="su-card wide"><h3>Voice studio</h3><p class="su-muted">Turn text into speech. Private voices run in your browser (first use downloads a model); online voices cover 17 languages.</p>
    <div class="su-row"><select id="aM" class="su-in sm"><option value="local">Private (in browser)</option><option value="online">Online (17 languages)</option></select>
    <select id="aL" class="su-in sm" hidden>${ONLINE_LANGS.map((l, i) => `<option value="${i}">${esc(l.label)}</option>`).join('')}</select>
    <select id="aV" class="su-in sm"></select><label>Speed <input id="aSp" type="range" min=".6" max="1.5" step=".05" value="1"></label></div>
    <textarea id="aT" class="su-area" placeholder="Type what the voice should say…"></textarea>
    <div class="su-row"><button class="su-btn pri" id="aGo">Generate voice</button><span id="aS" class="su-muted"></span></div><div id="aOut"></div></div>`;
  const M = $('#aM', el), L = $('#aL', el), V = $('#aV', el);
  const fill = () => {
    const online = M.value === 'online'; L.hidden = !online;
    const list = online ? ONLINE_LANGS[+L.value].voices : VOICES;
    V.innerHTML = list.map((v) => `<option value="${esc(v.id)}">${esc(v.name)} · ${esc(v.desc || '')}</option>`).join('');
  };
  M.onchange = L.onchange = fill; fill();
  $('#aGo', el).onclick = async () => {
    const b = $('#aGo', el), s = $('#aS', el); b.disabled = true;
    try {
      const o = { voice: V.value, speed: +$('#aSp', el).value, onStatus: (m) => (s.textContent = m) };
      const text = $('#aT', el).value;
      const r = M.value === 'online' ? await speakOnline(text, o) : await speak(text, o);
      const url = URL.createObjectURL(r.blob);
      $('#aOut', el).innerHTML = `<audio controls src="${url}"></audio>`;
      $('#aOut', el).insertAdjacentHTML('beforeend', `<button class="su-btn" id="aDl">Download</button>`);
      $('#aDl', el).onclick = () => download('voice.' + (r.blob.type.includes('wav') ? 'wav' : 'mp3'), r.blob);
      s.textContent = `${r.duration.toFixed(1)} s`;
    } catch (e) { s.textContent = e.message; } finally { b.disabled = false; }
  };
}

// ---------------------------------------------------------------- AI studio (Open Higgsfield / Higgsfield)
function aiTool(el) {
  el.innerHTML = `<div class="su-card wide"><h3>AI image & video studio</h3><p class="su-muted">Free image AI needs no key. For video and premium image models add a Muapi.ai key (stored only in this browser).</p>
    <div class="su-row"><select id="gK" class="su-in sm"><option value="img">Image</option><option value="vid">Video</option></select><select id="gM" class="su-in sm"></select>
    <select id="gA" class="su-in sm">${['1:1', '16:9', '9:16', '4:3', '3:4'].map((a) => `<option>${a}</option>`).join('')}</select></div>
    <textarea id="gP" class="su-area short" placeholder="Describe what you want to see…"></textarea>
    <div class="su-row"><input id="gKey" class="su-in" type="password" placeholder="Muapi API key (optional)" value="${esc(getKey())}"><button class="su-btn pri" id="gGo">Generate</button><span id="gS" class="su-muted"></span></div><div id="gOut" class="su-gen"></div></div>`;
  const K = $('#gK', el), M = $('#gM', el);
  const fill = () => { M.innerHTML = (K.value === 'vid' ? VIDEO_MODELS : AI_MODELS).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join(''); };
  K.onchange = fill; fill();
  $('#gKey', el).onchange = (e) => setKey(e.target.value.trim());
  $('#gGo', el).onclick = async () => {
    const b = $('#gGo', el), s = $('#gS', el), prompt = $('#gP', el).value.trim(); if (!prompt) return toast('Describe what to generate');
    b.disabled = true;
    try {
      setKey($('#gKey', el).value.trim());
      const o = { model: M.value, prompt, aspectRatio: $('#gA', el).value, onStatus: (m) => (s.textContent = m) };
      const url = K.value === 'vid' ? await generateVideo({ ...o, duration: VIDEO_MODELS.find((m) => m.id === M.value)?.durations?.[0] }) : await generateImage(o);
      const tag = K.value === 'vid' ? `<video src="${esc(url)}" controls playsinline></video>` : `<img src="${esc(url)}" alt="">`;
      $('#gOut', el).insertAdjacentHTML('afterbegin', `<div class="su-gi">${tag}<a class="su-btn sm" href="${esc(url)}" target="_blank" rel="noopener" ${isFreeModel(M.value) ? `download="ai-image.png"` : ''}>Open / save</a></div>`);
      s.textContent = 'Done';
    } catch (e) { s.textContent = e.message; } finally { b.disabled = false; }
  };
}

// ---------------------------------------------------------------- Suite shell
const TOOLS = [
  { id: 'docs', icon: '📝', name: 'Docs', swap: 'Notion', oss: 'AppFlowy', fn: docsTool },
  { id: 'tasks', icon: '✅', name: 'Tasks', swap: 'Asana', oss: 'OpenProject', fn: tasksTool },
  { id: 'booking', icon: '📅', name: 'Booking', swap: 'Calendly', oss: 'Cal.com', fn: bookingTool },
  { id: 'inbox', icon: '💬', name: 'Inbox', swap: 'Intercom', oss: 'Chatwoot', fn: inboxTool },
  { id: 'recorder', icon: '🎥', name: 'Recorder', swap: 'Loom', oss: 'Cap', fn: recorderTool },
  { id: 'dictation', icon: '🎙', name: 'Dictation', swap: 'Wispr Flow', oss: 'OpenWhispr', fn: dictationTool },
  { id: 'seo', icon: '🔎', name: 'SEO', swap: 'Semrush', oss: 'OpenSEO', fn: seoTool },
  { id: 'voice', icon: '🔊', name: 'Voice', swap: 'ElevenLabs', oss: 'Voicebox', fn: voiceTool },
  { id: 'ai', icon: '✨', name: 'AI Studio', swap: 'Higgsfield', oss: 'Open-Higgsfield-AI', fn: aiTool },
];
const PRICES = { Notion: 12, Asana: 13.49, Calendly: 12, Intercom: 29, Loom: 18, 'Wispr Flow': 15, Semrush: 139, ElevenLabs: 6, Higgsfield: 19 };

export function openSuite(app, { onBack, tool } = {}) {
  let cleanup;
  const show = (id) => {
    cleanup?.(); cleanup = null;
    const t = TOOLS.find((x) => x.id === id) || TOOLS[0];
    try { history.replaceState(null, '', `#/suite/${t.id}`); } catch {}
    $$('.su-tab', app).forEach((b) => b.classList.toggle('on', b.dataset.id === t.id));
    const host = $('#suBody', app); host.innerHTML = '';
    $('#suHint', app).textContent = `Free replacement for ${t.swap} ($${PRICES[t.swap]}/mo). Open-source inspiration: ${t.oss}.`;
    cleanup = t.fn(host) || null;
  };
  app.innerHTML = `<div class="suite"><header class="su-top"><button class="su-btn" id="suBack">← Home</button><b class="su-logo">Artvas Suite</b>
    <span class="su-muted" id="suHint"></span></header>
    <nav class="su-tabs">${TOOLS.map((t) => `<button class="su-tab" data-id="${t.id}"><span>${t.icon}</span>${t.name}</button>`).join('')}</nav>
    <main id="suBody" class="su-body"></main></div>`;
  $('#suBack', app).onclick = () => { cleanup?.(); onBack?.(); };
  $$('.su-tab', app).forEach((b) => (b.onclick = () => show(b.dataset.id)));
  show(tool);
}
export const SUITE_TOOLS = TOOLS;
