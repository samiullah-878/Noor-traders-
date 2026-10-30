// dukan.js — v2.148.0 (30 Oct 2026): 🏪 NOOR TRADERS ONLINE DUKAN — customer ki website
//   Malik: "store ke har rack jaisa site — customer ko lage wo shop mein hai · racks category-wise (shuru cosmetics, phir chemicals …
//          aakhir ghee/oil) · cart ki bajaye bande ka saman COUNTER par aaye (hamare counter jaisa) — lage khud dukan mein hai".
//   Data: Firestore REST (bina login, SIRF parhna — rules: webDukan read true) businesses/noor-traders/webDukan/
//     cat   = PC sync-stock {j: JSON [[id, naam, category, retail rate, unit]], at} — sirf majood maal · khareed / nafa KABHI nahi
//     info  = malik {name, line, wa, addr, time, map, on} · racks = app {order:[cat], cn:{cat:naam}, hc:{cat:1}, hide:{id:1}, ic:{id:cat}}
//     phIdx = {m:{id:v}} · ph_<id> = {b: Bytes JPEG, v}  (tasveer ek dafa aa kar phone ke IndexedDB mein)
//   AI NAHI. Order = WhatsApp link (muft) — koi server / payment nahi. Tokri sirf gahak ke phone mein (localStorage).
import { firebaseConfig, BUSINESS_ID } from '../config.js?v=2.152.0';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const rs = n => 'Rs ' + num(n);
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const title = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
// ---------- 🎬 v2.151.0: animation + 🔊 awaaz (malik: "shutter khulne, item chunne, tokri mein dalne aur rack se rack par animation") ----------
//   Sab transform / opacity (tez). Kamzor phone (deviceMemory ≤ 2 / 2 core) ya "kam harkat" setting = LITE (3D / stagger nahi). Awaaz WebAudio se bani (koi file nahi), shuru mein BAND.
const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const LITE = RM || (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 2) || (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 2);
document.documentElement.classList.toggle('lite', !!LITE);
const anim = (el, kf, o) => { try { if (RM || !el || !el.animate) return null; return el.animate(kf, o); } catch { return null; } };
const replay = (el, c) => { if (!el || RM) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
let SND = false, AC = null;
function ac() { if (!SND) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch { return null; } }
function noiseSrc(a, dur) { const b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = a.createBufferSource(); n.buffer = b; return n; }
function thump(a, t, v) {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.22);
  const n = noiseSrc(a, 0.05), hp = a.createBiquadFilter(), ng = a.createGain(); hp.type = 'highpass'; hp.frequency.value = 2200; ng.gain.setValueAtTime(v * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); n.connect(hp); hp.connect(ng); ng.connect(a.destination); n.start(t); n.stop(t + 0.05);
}
const SFX = {
  shutter() { const a = ac(); if (!a) return; const t = a.currentTime, n = noiseSrc(a, 1.4), bp = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1700, t + 1.2); bp.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.1); g.gain.setValueAtTime(0.32, t + 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    lfo.frequency.setValueAtTime(16, t); lfo.frequency.linearRampToValueAtTime(32, t + 1.1); lg.gain.value = 0.22; lfo.connect(lg); lg.connect(g.gain);
    n.connect(bp); bp.connect(g); g.connect(a.destination); n.start(t); n.stop(t + 1.4); lfo.start(t); lfo.stop(t + 1.4); thump(a, t + 1.18, 0.22); },
  drop() { const a = ac(); if (a) thump(a, a.currentTime, 0.4); },
  pick() { const a = ac(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.13); },
  step() { const a = ac(); if (!a) return; const t = a.currentTime, n = noiseSrc(a, 0.26), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.22); f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24); n.connect(f); f.connect(g); g.connect(a.destination); n.start(t); n.stop(t + 0.26); },
  print() { const a = ac(); if (!a) return; const t = a.currentTime; for (let k = 0; k < 9; k++) { const n = noiseSrc(a, 0.03), f = a.createBiquadFilter(), g = a.createGain(), tt = t + 0.35 + k * 0.075; f.type = 'bandpass'; f.frequency.value = 3200; g.gain.setValueAtTime(0.06, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03); n.connect(f); f.connect(g); g.connect(a.destination); n.start(tt); n.stop(tt + 0.03); } }
};
const sfx = k => { try { SFX[k] && SFX[k](); } catch {} };
function sndPaint() { [['sndBtn', SND ? '🔊' : '🔇'], ['sndDoor', SND ? '🔊 Awaaz chalu' : '🔇 Awaaz band']].forEach(([id, t]) => { const b = document.getElementById(id); if (b) { b.textContent = t; b.setAttribute('aria-pressed', String(SND)); } }); }
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };

SND = ls.get('nt-dk-snd', false) === true; sndPaint();

// ---------- ☁️ Firestore REST (sirf parhna) ----------
const ROOT = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const PATH = id => `${ROOT}/businesses/${BUSINESS_ID}/webDukan/${id}`;
const API = `https://firestore.googleapis.com/v1/${ROOT}:batchGet?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
function val(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('bytesValue' in v) return { b64: v.bytesValue };
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
}
async function batchGet(ids) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: ids.map(PATH) }) });
  if (!r.ok) throw Object.assign(Error('HTTP ' + r.status), { status: r.status });
  const a = await r.json(), out = {};
  for (const x of Array.isArray(a) ? a : []) if (x && x.found) out[x.found.name.split('/').pop()] = val({ mapValue: { fields: x.found.fields || {} } });
  return out;
}
const phDoc = id => 'ph_' + String(id).replace(/[/\s]/g, '_');

// ---------- 💾 tasveer phone mein (IndexedDB) ----------
let dbP = null;
function idb() {
  if (dbP) return dbP;
  dbP = new Promise(ok => { try { const r = indexedDB.open('nt-dukan', 1); r.onupgradeneeded = () => r.result.createObjectStore('ph'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null); } catch { ok(null); } });
  return dbP;
}
async function cGet(k) { const db = await idb(); if (!db) return null; return new Promise(ok => { try { const q = db.transaction('ph').objectStore('ph').get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch { ok(null); } }); }
async function cPut(k, v) { const db = await idb(); if (!db) return; try { db.transaction('ph', 'readwrite').objectStore('ph').put(v, k); } catch {} }

// ---------- 🧠 haalat ----------
const S = { racks: [], bays: [], items: new Map(), bayOf: new Map(), info: {}, ph: {}, at: 0, crate: ls.get('nt-dk-crate', {}) || {}, cur: 0, open: null, q: 1, dims: null, loadedAt: 0 };
const PHURL = new Map();
const phV = id => { const x = S.ph[id]; return x && typeof x === 'object' ? Number(x.v) || 0 : Number(x) || 0; };
const saveCrate = () => ls.set('nt-dk-crate', S.crate);

function build(d) {
  const cat = d.cat || {}, R = d.racks || {};
  let rows = []; try { rows = JSON.parse(cat.j || '[]'); } catch {}
  const hide = R.hide || {}, ic = R.ic || {}, hc = R.hc || {}, cn = R.cn || {};
  const groups = new Map(); S.items = new Map();
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const id = String(r[0] ?? ''), rate = Number(r[3]) || 0, n = String(r[1] || '').trim();
    if (!id || !n || hide[id] || rate <= 0) continue;
    const key = String(ic[id] || r[2] || '').trim() || 'Mutafarriq';
    if (hc[key]) continue;
    const it = { id, n, c: key, r: rate, u: String(r[4] || '').trim() };
    S.items.set(id, it);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const order = Array.isArray(R.order) ? R.order.map(String) : [];
  const pos = k => { const i = order.indexOf(k); return i < 0 ? 1e9 : i; };
  const keys = [...groups.keys()].sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b));
  S.racks = keys.map((k, i) => ({ key: k, no: i + 1, name: String(cn[k] || '').trim() || title(k), items: groups.get(k).sort((a, b) => a.n.localeCompare(b.n)) }));
  S.racks.forEach(rk => rk.items.forEach(it => { it.rk = rk; }));
  S.info = d.info || {}; S.ph = (d.phIdx && d.phIdx.m) || {}; S.at = Number(cat.at) || 0;
  for (const id of Object.keys(S.crate)) if (!S.items.has(id) || !(Number(S.crate[id]) > 0)) delete S.crate[id];
  saveCrate();
}

// ---------- 📐 rack ka naap ----------
function dims() {
  const a = $('aisle'), W = a.clientWidth || innerWidth, H = a.clientHeight || 600;
  const bw = W >= 1100 ? Math.floor(W / 2) : W;
  const cols = Math.max(3, Math.min(7, Math.floor((bw - 76) / 104)));
  const rows = Math.max(2, Math.min(6, Math.floor((H - 96) / 118)));
  return { bw, cols, rows, per: cols * rows };
}

// ---------- 🧴 bina tasveer: dabba / botal / pouch ----------
const BOT = /(oil|ghee|sharbat|shampoo|syrup|vinegar|sirka|sauce|ketchup|ltr|litre|liter|\d\s?ml\b|bottle|squash|lotion|bleach|phenyl|cleaner|juice|drink|water|honey|shehad)/i;
const PCH = /(nimko|chips|biscuit|slanty|daal|dal\b|rice|chawal|sugar|cheeni|masala|pouch|surf|powder|namak|salt|atta|maida|besan|sooji|chana|moong|masoor|mash)/i;
const hueOf = it => (hash(it.c) * 47 + (hash(it.n) % 150) - 75 + 360) % 360;
function pkHTML(it, big) {
  const h = hash(it.n), shape = BOT.test(it.n) ? 'bt1' : PCH.test(it.n) ? 'pc1' : '';
  const hue = hueOf(it);
  return `<span class="pk ${shape}" style="--h:${hue}"><span>${esc(big ? it.n : it.n)}</span></span>`;
}
const imgOf = (it, big) => PHURL.has(it.id) ? `<img src="${PHURL.get(it.id)}" alt="">` : pkHTML(it, big);

function itemHTML(it) {
  const q = Number(S.crate[it.id]) || 0;
  return `<button type="button" class="it${q ? ' in-crate' : ''}" data-id="${esc(it.id)}" aria-label="${esc(it.n)}, ${rs(it.r)}"><span class="it-box">${imgOf(it)}</span><span class="tag"><small>Rs</small>${num(it.r)}</span><span class="plus" data-plus="1" aria-label="Tokri mein dalo">${q ? num(q) : '+'}</span></button>`;
}
function bayHTML(b, i, D) {
  const sh = [];
  const rows = Math.min(D.rows, Math.max(3, Math.ceil(b.items.length / D.cols)));
  for (let s = 0; s < rows; s++) sh.push(`<div class="shelf">${b.items.slice(s * D.cols, (s + 1) * D.cols).map(itemHTML).join('')}</div>`);
  return `<section class="bay" data-bay="${i}" style="--rows:${rows};--cols:${D.cols};--bayW:${D.bw}px" aria-label="Rack ${b.rk.no}: ${esc(b.rk.name)}"><header class="sign"><span class="sk">Rack ${b.rk.no}</span><b>${esc(b.rk.name)}</b>${b.parts > 1 ? `<span class="sp">${b.p + 1}/${b.parts}</span>` : ''}</header><div class="rack">${sh.join('')}</div></section>`;
}
function renderAisle(keepId) {
  const D = dims(); S.dims = D;
  const bays = [];
  S.racks.forEach(rk => { const parts = Math.max(1, Math.ceil(rk.items.length / D.per)); for (let p = 0; p < parts; p++) bays.push({ rk, p, parts, items: rk.items.slice(p * D.per, (p + 1) * D.per) }); });
  S.bays = bays; S.bayOf = new Map();
  bays.forEach((b, i) => b.items.forEach(it => S.bayOf.set(it.id, i)));
  const a = $('aisle');
  a.innerHTML = bays.length ? bays.map((b, i) => bayHTML(b, i, D)).join('') : '<p class="empty-aisle">Abhi racks par maal nahi saja — thori der baad dobara dekhein.</p>';
  bayEls = [...a.querySelectorAll('.bay')];
  observe();
  if (keepId && S.bayOf.has(keepId)) go(S.bayOf.get(keepId), true);
  onScroll();
}

// ---------- 📷 tasveerein (sirf jo rack nazar aaye / qareeb ho) ----------
let io = null, loadT = 0, loading = false;
const want = new Set();
function observe() {
  try { io && io.disconnect(); } catch {}
  if (!('IntersectionObserver' in window)) { S.items.forEach(it => { if (phV(it.id)) want.add(it.id); }); loadPhotos(); return; }
  io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { const b = S.bays[Number(e.target.dataset.bay)]; if (b) b.items.forEach(it => { if (phV(it.id) && !PHURL.has(it.id)) want.add(it.id); }); }
    clearTimeout(loadT); loadT = setTimeout(loadPhotos, 50);
  }, { root: $('aisle'), rootMargin: '0px 120% 0px 120%' });
  document.querySelectorAll('.bay').forEach(el => io.observe(el));
}
async function loadPhotos() {
  if (loading) return; loading = true;
  try {
    while (want.size) {
      const ids = [...want].slice(0, 20); ids.forEach(id => want.delete(id));
      const need = [];
      for (const id of ids) { const c = await cGet(id); if (c && c.v === phV(id) && c.b) setPhoto(id, c.b); else need.push(id); }
      if (!need.length) continue;
      try {
        const got = await batchGet(need.map(phDoc));
        for (const id of need) { const b = got[phDoc(id)]?.b?.b64; if (b) { const url = 'data:image/jpeg;base64,' + b; setPhoto(id, url); cPut(id, { v: phV(id), b: url }); } }
      } catch (e) { console.warn('tasveer', e); }
    }
  } finally { loading = false; }
}
function setPhoto(id, url) {
  PHURL.set(id, url);
  document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"] .it-box`).forEach(b => { b.innerHTML = `<img src="${url}" alt="">`; });
  if (S.open === id) $('shImg').innerHTML = imgOf(S.items.get(id), true);
  paintCrate();
}

// ---------- 🚶 chalna ----------
function onScroll() {
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth || 1;
  const i = Math.min(Math.max(0, S.bays.length - 1), Math.max(0, Math.round(a.scrollLeft / bw)));
  S.cur = i;
  const b = S.bays[i];
  $('where').textContent = b ? `Rack ${b.rk.no}/${S.racks.length} · ${b.rk.name}${b.parts > 1 ? ` (${b.p + 1}/${b.parts})` : ''}` : 'Noor Traders';
  const w = S.bays.length ? Math.round((i + 1) / S.bays.length * 100) + '%' : '0';
  $('walkBar').style.width = w; $('walkFeet').style.setProperty('--w', w);
  $('prevBtn').disabled = a.scrollLeft < 4;
  $('nextBtn').disabled = a.scrollLeft + a.clientWidth >= a.scrollWidth - 4;
  depth();
  if (i !== arrived) { clearTimeout(arriveT); arriveT = setTimeout(() => { if (S.cur !== i || i === arrived) return; const first = arrived < 0; arrived = i; if (first || !doorGone) return; replay(bayEls[i]?.querySelector('.sign'), 'swing'); replay($('walkFeet'), 'bob'); sfx('step'); }, 140); }
}
// 🚶 rack se rack: racks halka sa mud kar (3D) aage, farsh ki tiles alag raftaar (sirf qareeb ke 3–4 racks)
let bayEls = [], arrived = -1, arriveT = 0, doorGone = false;
function depth() {
  if (LITE || !bayEls.length) return;
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth || 1, x = a.scrollLeft, mid = x + a.clientWidth / 2;
  const lo = Math.max(0, Math.floor(x / bw) - 1), hi = Math.min(bayEls.length - 1, Math.ceil((x + a.clientWidth) / bw) + 1);
  for (let k = lo; k <= hi; k++) {
    const p = Math.max(-1, Math.min(1, ((k + 0.5) * bw - mid) / bw)), el = bayEls[k]; if (!el) continue;
    el.style.setProperty('--p', p.toFixed(3)); el.style.setProperty('--s', (1 - Math.abs(p) * 0.07).toFixed(3)); el.style.setProperty('--o', (1 - Math.abs(p) * 0.3).toFixed(3));
  }
}
function go(i, now) {
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth;
  i = Math.max(0, Math.min(S.bays.length - 1, i));
  if (now) { a.style.scrollBehavior = 'auto'; a.scrollLeft = i * bw; a.style.scrollBehavior = ''; } else { a.scrollTo({ left: i * bw, behavior: 'smooth' }); if (!LITE) replay(a, 'bob'); }
}

// ---------- 🧺 tokri (counter par) ----------
const lines = () => Object.entries(S.crate).map(([id, q]) => ({ it: S.items.get(id), q: Number(q) || 0 })).filter(x => x.it && x.q > 0);
function paintCrate() {
  const L = lines(), n = L.length, tot = L.reduce((s, x) => s + x.q * x.it.r, 0);
  $('counterBar').classList.toggle('has', n > 0);
  $('cSum').textContent = n ? `${n} cheez${n > 1 ? 'ein' : ''} · ${rs(tot)} — parchi dekhein` : 'Counter khali hai — rack se cheez uthayein';
  $('crateN').hidden = !n; $('crateN').textContent = String(n);
  $('cratePeek').innerHTML = L.slice(-4).map(x => `<span style="${thumbStyle(x.it)}"></span>`).join('');
  if (!$('cv').hidden) paintCounter();
}
const thumbStyle = it => PHURL.has(it.id) ? `background-image:url('${PHURL.get(it.id)}')` : `background:linear-gradient(160deg,hsl(${hueOf(it)} 72% 60%),hsl(${hueOf(it)} 66% 40%))`;
function markItem(id) {
  const q = Number(S.crate[id]) || 0;
  document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"]`).forEach(el => { el.classList.toggle('in-crate', q > 0); const p = el.querySelector('.plus'); if (p) p.textContent = q ? num(q) : '+'; });
}
function setQty(id, q) {
  q = Math.max(0, Math.round(q * 100) / 100);
  if (q > 0) S.crate[id] = q; else delete S.crate[id];
  saveCrate(); paintCrate(); markItem(id);
}
function flyFrom(el, it, q = 1) {
  const crate = $('crate'); if (!el || !crate) return;
  const r0 = el.getBoundingClientRect(), r1 = crate.getBoundingClientRect();
  if (!r0.width || RM) { landed(q); return; }
  const f = PHURL.has(it.id) ? Object.assign(document.createElement('img'), { src: PHURL.get(it.id), alt: '' }) : document.createElement('div');
  if (!PHURL.has(it.id)) f.style.cssText = thumbStyle(it);
  f.className = 'fly';
  const w = Math.min(r0.width, 120), h = Math.min(r0.height, 140);
  Object.assign(f.style, { left: (r0.left + (r0.width - w) / 2) + 'px', top: (r0.top + (r0.height - h) / 2) + 'px', width: w + 'px', height: h + 'px' });
  document.body.appendChild(f);
  const dx = r1.left + r1.width / 2 - (r0.left + r0.width / 2), dy = r1.top + r1.height / 3 - (r0.top + r0.height / 2);
  let ok = false; const done = () => { if (ok) return; ok = true; f.remove(); landed(q); };
  try {
    const an = f.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 110}px) scale(.8) rotate(-${LITE ? 10 : 140}deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,${dy}px) scale(.2) rotate(${LITE ? 14 : 300}deg)`, opacity: 0.75 }], { duration: 680, easing: 'cubic-bezier(.45,.05,.55,.95)' });
    an.onfinish = done; an.oncancel = done; setTimeout(done, 900);
  } catch { done(); }
}
function bump() { replay($('crate'), 'bump'); }
// 🧺 tokri mein gira: tokri uchhle · tadad "pop" · "+1" upar · counter patti chamke · "thak"
function landed(q) {
  bump(); replay($('crateN'), 'pop'); replay($('counterBar'), 'glow'); sfx('drop');
  if (RM) return;
  const c = $('crate').getBoundingClientRect(), s1 = document.createElement('span');
  s1.className = 'plus1'; s1.textContent = '+' + num(q); s1.style.left = (c.left + c.width / 2) + 'px'; s1.style.top = (c.top - 6) + 'px';
  document.body.appendChild(s1); setTimeout(() => s1.remove(), 950);
}
function addToCrate(id, q, el) {
  const it = S.items.get(id); if (!it) return;
  setQty(id, (Number(S.crate[id]) || 0) + q);
  flyFrom(el, it, q);
  document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"] .plus`).forEach(p => replay(p, 'pop'));
  try { navigator.vibrate && navigator.vibrate(12); } catch {}
}

// ---------- 🪟 khirkiyan + phone ka back ----------
const OV = []; let skipPop = 0;
function openOv(n) { OV.push(n); try { history.pushState({ ntOv: n }, ''); } catch {} }
function hideOv(n) {
  if (n === 'sheet') { $('sheet').hidden = true; S.open = null; }
  else if (n === 'cv') $('cv').hidden = true;
  else if (n === 'find') $('find').hidden = true;
  else if (n === 'map') $('map').hidden = true;
}
function closeOv(n) {
  const i = OV.lastIndexOf(n); hideOv(n);
  if (i < 0) return;
  OV.splice(i, 1); skipPop++;
  try { history.back(); } catch { skipPop--; }
}
addEventListener('popstate', () => { if (skipPop > 0) { skipPop--; return; } const n = OV.pop(); if (n) hideOv(n); });

// ---------- 🛍 item uthaya ----------
function openSheet(id, fromEl) {
  const it = S.items.get(id); if (!it) return;
  const src = fromEl && fromEl.querySelector('img,.pk'), r0 = src ? src.getBoundingClientRect() : null;
  S.open = id; S.q = 1;
  $('shRack').textContent = `Rack ${it.rk.no} · ${it.rk.name}`;
  $('shName').textContent = it.n;
  $('shRate').textContent = rs(it.r);
  $('shUnit').textContent = it.u ? 'fi ' + it.u : '';
  $('shQty').textContent = '1';
  $('shImg').innerHTML = imgOf(it, true);
  const have = Number(S.crate[id]) || 0;
  $('shAdd').textContent = have ? `🧺 Aur rakho (tokri mein ${num(have)})` : '🧺 Counter par rakho';
  $('sheet').hidden = false; openOv('sheet');
  if (r0 && r0.width && !LITE && !RM) requestAnimationFrame(() => flip(src, r0, $('shImg').querySelector('img,.pk')));   // 🛍 shelf se uth kar khirki mein
  setTimeout(() => $('shAdd').focus({ preventScroll: true }), 50);
}
function flip(src, r0, tgt) {
  if (!tgt) return; const r1 = tgt.getBoundingClientRect(); if (!r1.width) return;
  const c = src.tagName === 'IMG' ? Object.assign(document.createElement('img'), { src: src.src, alt: '' }) : src.cloneNode(true);
  c.classList.add('fly2'); Object.assign(c.style, { left: r1.left + 'px', top: r1.top + 'px', width: r1.width + 'px', height: r1.height + 'px', margin: '0' });
  document.body.appendChild(c); tgt.style.opacity = '0';
  const sx = r0.width / r1.width, sy = r0.height / r1.height, dx = r0.left - r1.left, dy = r0.top - r1.top;
  let ok = false; const end = () => { if (ok) return; ok = true; c.remove(); tgt.style.opacity = ''; };
  const an = anim(c, [{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transform: `translate(${dx * 0.4}px,${dy * 0.4 - 30}px) scale(${(sx + 1) / 2},${(sy + 1) / 2})`, offset: 0.5 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.25,.8,.25,1)' });
  if (an) { an.onfinish = end; an.oncancel = end; } setTimeout(end, 700);
}

// ---------- 🧾 counter ----------
const fmtNow = t => new Date(t || Date.now()).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
function plImg(it) { return PHURL.has(it.id) ? `<span class="pl-img" style="background-image:url('${PHURL.get(it.id)}')"></span>` : `<span class="pl-img">${pkHTML(it)}</span>`; }
function paintCounter() {
  const L = lines(), tot = L.reduce((s, x) => s + x.q * x.it.r, 0);
  $('pDate').textContent = fmtNow();
  $('pLines').innerHTML = L.map(x => `<li>${plImg(x.it)}<span class="pl-n"><b>${esc(x.it.n)}</b><small>${rs(x.it.r)}${x.it.u ? ' / ' + esc(x.it.u) : ''} × ${num(x.q)}</small></span><span class="pl-r"><b>${rs(x.q * x.it.r)}</b><span class="mini-q"><button type="button" data-pq="-1" data-id="${esc(x.it.id)}" aria-label="Kam">−</button><span>${num(x.q)}</span><button type="button" data-pq="1" data-id="${esc(x.it.id)}" aria-label="Zyada">+</button></span></span></li>`).join('');
  $('pEmpty').hidden = L.length > 0;
  $('pCount').textContent = L.length + (L.length === 1 ? ' cheez' : ' cheezein');
  $('pTot').textContent = rs(tot); $('mTot').textContent = rs(tot);
  $('bcIn').innerHTML = L.slice(-12).map(x => `<span style="${thumbStyle(x.it)}"></span>`).join('');
  const wa = waNum(S.info.wa);
  $('sendBtn').disabled = !L.length || !wa;
  const note = $('sendNote');
  note.classList.toggle('bad', !wa);
  note.textContent = !wa ? 'Dukan ka WhatsApp number abhi nahi laga — dukan par rabta karein.' : (L.length ? 'WhatsApp khulega, parchi likhi hogi — bas "Send" dabayein.' : '');
  const bits = [];
  if (S.at) bits.push('Rates taza: ' + fmtNow(S.at));
  if (S.info.time) bits.push('🕘 ' + S.info.time);
  if (S.info.addr) bits.push('📍 ' + S.info.addr);
  $('cvFoot').textContent = bits.join(' · ');
}
function openCounter() {
  const f = $('who'), w = ls.get('nt-dk-who', {}) || {};
  f.elements.name.value = w.name || ''; f.elements.phone.value = w.phone || ''; f.elements.addr.value = w.addr || '';
  [...f.elements.how].forEach(r => { r.checked = r.value === (w.how || 'self'); });
  $('addrL').hidden = (w.how || 'self') !== 'home';
  paintCounter();
  const cv = $('cv'); cv.querySelectorAll('#pLines li').forEach((li, k) => li.style.setProperty('--d', String(Math.min(k, 12))));
  cv.classList.remove('cvin'); cv.hidden = false; openOv('cv');
  if (!RM) { void cv.offsetWidth; cv.classList.add('cvin'); clearTimeout(openCounter.t); openCounter.t = setTimeout(() => cv.classList.remove('cvin'), 2200); }   // 'enter' class darwaze ke button ki hai — takrao nahi
  sfx('print');
  $('cv').querySelector('.cv-scroll').scrollTop = 0;
}
function waNum(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}
function sendOrder(e) {
  e.preventDefault();
  const f = $('who'), L = lines(), note = $('sendNote'), wa = waNum(S.info.wa);
  const w = { name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim(), addr: f.elements.addr.value.trim(), how: f.elements.how.value || 'self' };
  ls.set('nt-dk-who', w);
  const bad = t => { note.textContent = t; note.classList.add('bad'); };
  if (!L.length) return bad('Tokri khali hai — racks se cheez uthayein.');
  if (!wa) return bad('Dukan ka WhatsApp number abhi nahi laga.');
  if (!w.name) { f.elements.name.focus(); return bad('Apna naam likhein.'); }
  if (w.how === 'home' && !w.addr) { f.elements.addr.focus(); return bad('Ghar bhejna hai to pata likhein.'); }
  const tot = L.reduce((s, x) => s + x.q * x.it.r, 0);
  const t = [`*${S.info.name || 'Noor Traders'} — Online order* 🧾`, fmtNow(), ''];
  L.forEach((x, i) => { t.push(`${i + 1}. ${x.it.n}`); t.push(`    ${num(x.q)}${x.it.u ? ' ' + x.it.u : ''} × ${rs(x.it.r)} = ${rs(x.q * x.it.r)}`); });
  t.push('──────────', `*Kul: ${rs(tot)}* (${L.length} ${L.length === 1 ? 'cheez' : 'cheezein'})`, '', `Naam: ${w.name}`);
  if (w.phone) t.push(`Mobile: ${w.phone}`);
  t.push(w.how === 'home' ? `🛵 Ghar bhejein — Pata: ${w.addr}` : '🏪 Khud dukan se le jaunga');
  note.classList.remove('bad'); note.textContent = '✅ WhatsApp khul raha hai…';
  location.href = `https://wa.me/${wa}?text=${encodeURIComponent(t.join('\n'))}`;
}

// ---------- 🔍 dhoondo ----------
function findPaint() {
  const q = $('findQ').value.trim().toLowerCase(), box = $('findList');
  if (!q) { box.innerHTML = `<p class="find-empty">Naam likhein — jaise "oil", "sabun", "chawal"</p>`; return; }
  const words = q.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const it of S.items.values()) {
    const s = (it.n + ' ' + it.rk.name).toLowerCase();
    if (words.every(w => s.includes(w))) { const nl = it.n.toLowerCase(); hits.push([nl.startsWith(words[0]) ? 0 : words.every(w => nl.includes(w)) ? 1 : 2, it]); }
    if (hits.length > 400) break;
  }
  hits.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n));
  box.innerHTML = hits.length ? hits.slice(0, 80).map(([, it]) => `<button type="button" class="fr" data-find="${esc(it.id)}">${plImg(it)}<span><b>${esc(it.n)}</b><small>Rack ${it.rk.no} · ${esc(it.rk.name)}</small></span><span class="tag"><small>Rs</small>${num(it.r)}</span></button>`).join('') : `<p class="find-empty">"${esc(q)}" nahi mila — doosra naam likh kar dekhein.</p>`;
}
function showOnRack(id) {
  if (!S.bayOf.has(id)) return;
  go(S.bayOf.get(id));
  setTimeout(() => document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"]`).forEach(el => { el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); setTimeout(() => el.classList.remove('glow'), 3600); }), 450);
}

// ---------- 🗺 naqsha ----------
function openMap() {
  const curRack = S.bays[S.cur]?.rk?.no;
  $('mapList').innerHTML = `<li><button type="button" data-go="0"><span class="n">🚪</span><span class="t"><b>Darwaza</b><small>Shuru</small></span></button></li>` +
    S.racks.map(rk => `<li><button type="button" class="${rk.no === curRack ? 'cur' : ''}" data-go="${S.bayOf.get(rk.items[0]?.id) ?? 0}"><span class="n">${rk.no}</span><span class="t"><b>${esc(rk.name)}</b><small>${rk.items.length} cheezein</small></span></button></li>`).join('') +
    `<li class="end"><button type="button" data-counter="1"><span class="n">🧾</span><span class="t"><b>Counter</b><small>Parchi + order</small></span></button></li>`;
  $('map').hidden = false; openOv('map');
  setTimeout(() => $('mapList').querySelector('.cur')?.scrollIntoView({ block: 'center' }), 30);
}

// ---------- 🚪 darwaza ----------
function paintDoor() {
  const I = S.info, b = [];
  $('dLine').textContent = I.line || 'Wholesale & Retail';
  if (I.time) b.push(`<span>🕘 ${esc(I.time)}</span>`);
  if (I.addr) b.push(`<span>📍 ${esc(I.addr)}</span>`);
  if (I.wa) b.push(`<span>📞 ${esc(I.wa)}</span>`);
  $('dMeta').innerHTML = b.join('');
  const off = I.on === false;
  $('enterBtn').disabled = off;
  $('enterTxt').textContent = off ? 'Online dukan abhi band hai' : 'Shutter uthayein';
  $('board').classList.add('lit');   // 💡 board ke bulb ek ek kar ke jalte hain
}
function enter() {
  const d = $('door'); if (d.classList.contains('up')) return;
  d.classList.add('up'); ss.set('nt-dk-in', '1'); sfx('shutter');
  const sh = $('shutter'), board = $('board'), top = d.querySelector('.door-top');
  const finish = () => { if (doorGone) return; doorGone = true; d.classList.add('gone'); lightsOn(); if (!ss.get('nt-dk-hint') && S.bays.length > 1) { ss.set('nt-dk-hint', '1'); $('hint').hidden = false; setTimeout(() => { $('hint').hidden = true; }, 3600); } };
  if (RM) { finish(); return; }
  // ① jhatka · ② drum mein lipat kar upar · ③ board upar ghayab
  const j = anim(sh, [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(-12px)' }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
  const roll = () => { const r = anim(sh, [{ transform: 'translateY(-12px)' }, { transform: 'translateY(-101%)' }], { duration: LITE ? 650 : 1200, easing: 'cubic-bezier(.45,.05,.45,1)', fill: 'forwards' }); if (r) r.onfinish = finish; else finish(); };
  if (j) j.onfinish = roll; else roll();
  anim(top, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-110%)', opacity: 0 }], { duration: 520, delay: LITE ? 400 : 760, easing: 'ease-in', fill: 'forwards' });
  setTimeout(finish, 2200);
}
// 💡 andar ki batti: tube light do teen jhapak kar roshan, racks neeche se ubhar kar
function lightsOn() {
  const L = $('lights');
  if (RM || LITE) { L.classList.add('off'); return; }
  L.classList.add('on'); replay($('top'), 'flick');
  setTimeout(() => { L.classList.add('off'); }, 1100);
  setTimeout(rise, 520);
}
function rise() {
  const els = [bayEls[S.cur], bayEls[S.cur + 1]].filter(Boolean);
  els.forEach(el => { el.querySelectorAll('.it').forEach((it, k) => it.style.setProperty('--d', String(Math.min(k, 24)))); replay(el, 'rise'); setTimeout(() => el.classList.remove('rise'), 1600); });
}

// ---------- ⚠️ ghalti ----------
function oops(t) { $('oopsTxt').textContent = t; $('oops').hidden = false; $('enterTxt').textContent = 'Maal load nahi hua'; }

async function load(again) {
  $('oops').hidden = true;
  const keep = again ? S.bays[S.cur]?.items?.[0]?.id : null;
  try {
    const d = await batchGet(['cat', 'info', 'racks', 'phIdx']);
    if (!d.cat) throw Object.assign(Error('nocat'), { code: 'nocat' });
    build(d); renderAisle(keep); paintCrate(); paintDoor();
    S.loadedAt = Date.now();
    if (!again && ss.get('nt-dk-in') && S.info.on !== false) { $('door').classList.add('up', 'gone'); $('lights').classList.add('off'); doorGone = true; }
  } catch (e) {
    console.warn('dukan load', e);
    if (again) return;
    oops(e.code === 'nocat' ? 'Dukan ka maal abhi online nahi aaya — thori der baad dobara dekhein.' : e.status === 403 ? 'Online dukan abhi tayyar ho rahi hai — thori der baad dobara dekhein.' : 'Internet check karein — dukan ka maal load nahi hua.');
  }
}

// ---------- 👆 clicks ----------
document.addEventListener('click', e => {
  const t = e.target;
  const it = t.closest('.it');
  if (it && t.closest('#aisle')) {
    if (t.closest('[data-plus]')) addToCrate(it.dataset.id, 1, it.querySelector('img,.pk'));
    else { replay(it, 'lift'); replay(it.querySelector('.tag'), 'wig'); sfx('pick'); const el = it; setTimeout(() => openSheet(el.dataset.id, el), LITE || RM ? 0 : 150); }
    return;
  }
  if (t.closest('[data-close]')) { closeOv('sheet'); return; }
  if (t.closest('[data-q]')) { S.q = Math.max(1, Math.min(999, S.q + Number(t.closest('[data-q]').dataset.q))); $('shQty').textContent = String(S.q); return; }
  if (t.closest('#shAdd')) {
    const id = S.open, el = $('shImg').querySelector('img,.pk');
    if (!id) return;
    const r = el ? el.getBoundingClientRect() : null, ghost = r ? { getBoundingClientRect: () => r } : null;
    closeOv('sheet'); addToCrate(id, S.q, ghost); return;
  }
  if (t.closest('#counterBar')) { openCounter(); return; }
  if (t.closest('[data-cv-close]')) { closeOv('cv'); return; }
  const pq = t.closest('[data-pq]');
  if (pq) { const id = pq.dataset.id; setQty(id, (Number(S.crate[id]) || 0) + Number(pq.dataset.pq)); markItem(id); return; }
  if (t.closest('#findBtn')) { $('find').hidden = false; openOv('find'); findPaint(); setTimeout(() => $('findQ').focus(), 30); return; }
  if (t.closest('[data-find-close]')) { closeOv('find'); return; }
  const fr = t.closest('[data-find]');
  if (fr) { const id = fr.dataset.find; closeOv('find'); showOnRack(id); return; }
  if (t.closest('#mapBtn')) { openMap(); return; }
  if (t.closest('[data-map-close]') || t === $('map')) { closeOv('map'); return; }
  const g = t.closest('[data-go]');
  if (g) { closeOv('map'); go(Number(g.dataset.go)); return; }
  if (t.closest('[data-counter]')) { closeOv('map'); setTimeout(openCounter, 60); return; }
  if (t.closest('#prevBtn')) { go(S.cur - (S.dims && S.dims.bw < $('aisle').clientWidth - 10 ? 2 : 1)); return; }
  if (t.closest('#nextBtn')) { go(S.cur + (S.dims && S.dims.bw < $('aisle').clientWidth - 10 ? 2 : 1)); return; }
  if (t.closest('#enterBtn')) { enter(); return; }
  if (t.closest('#sndBtn') || t.closest('#sndDoor')) { SND = !SND; ls.set('nt-dk-snd', SND); sndPaint(); if (SND) sfx('pick'); return; }
  if (t.closest('#retryBtn')) { load(); return; }
});
$('who').addEventListener('change', e => { if (e.target.name === 'how') $('addrL').hidden = e.target.value !== 'home'; });
$('who').addEventListener('submit', sendOrder);
$('findQ').addEventListener('input', () => { clearTimeout(findPaint.t); findPaint.t = setTimeout(findPaint, 90); });
$('aisle').addEventListener('scroll', () => { cancelAnimationFrame(onScroll.r); onScroll.r = requestAnimationFrame(onScroll); }, { passive: true });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && OV.length) { closeOv(OV[OV.length - 1]); return; }
  if (OV.length || /input|textarea/i.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') go(S.cur + 1); else if (e.key === 'ArrowLeft') go(S.cur - 1);
});
let rzT = 0;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const D = dims(), o = S.dims; if (!o || D.bw !== o.bw || D.cols !== o.cols || D.rows !== o.rows) renderAisle(S.bays[S.cur]?.items?.[0]?.id); }, 180); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.loadedAt && Date.now() - S.loadedAt > 15 * 60e3) load(true); });

load();
