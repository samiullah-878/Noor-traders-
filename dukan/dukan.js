// dukan.js — v2.148.0 (30 Oct 2026): 🏪 NOOR TRADERS ONLINE DUKAN — customer ki website
//   Malik: "store ke har rack jaisa site — customer ko lage wo shop mein hai · racks category-wise (shuru cosmetics, phir chemicals …
//          aakhir ghee/oil) · cart ki bajaye bande ka saman COUNTER par aaye (hamare counter jaisa) — lage khud dukan mein hai".
//   Data: Firestore REST (bina login, SIRF parhna — rules: webDukan read true) businesses/noor-traders/webDukan/
//     cat   = PC sync-stock {j: JSON [[id, naam, category, retail rate, unit]], at} — sirf majood maal · khareed / nafa KABHI nahi
//     info  = malik {name, line, wa, addr, time, map, on} · racks = app {order:[cat], cn:{cat:naam}, hc:{cat:1}, hide:{id:1}, ic:{id:cat}}
//     phIdx = {m:{id:v}} · ph_<id> = {b: Bytes JPEG, v}  (tasveer ek dafa aa kar phone ke IndexedDB mein)
//   AI NAHI. Order = WhatsApp link (muft) — koi server / payment nahi. Tokri sirf gahak ke phone mein (localStorage).
//   v2.156.0 (malik: "customer ko feel aaye ke dukan ke andar hai" · "har shelf par 4 items, 2 shelf zyada — racks kam" · "rack ke neeche baqi racks ke chips"):
//     📷 asal tasveerein — ph_shop (darwaze ke peeche dukan) + ph_rk_<hash(rack)> (rack ke peeche) · phIdx.m.shop / m['rk_…'] (app 🗂 Racks / 🏪 maloomat se)
//     🚶 farsh (3D) + chhat ki lights scroll ke saath (--sx), qadam ka jhoola (--bob) · 🧑‍💼 dukan wala (bani hui SVG) racks ke chips se le jata hai
//     📳 halka vibrate · 🔔 darwaze ki ghanti (awaaz on ho to) · 🌙 info.open / info.close (Pakistan waqt) — band = aadha shutter, order phir bhi.
//   v2.158.0 (malik: "rack ki asal photo — customer photo par cheez dabaye, rate naam se aaye"): racks.rp[pid] {k, o, w, h, s: JSON [[x,y,w,h,itemId]] 0–1000}
//     + ph_rp_<pid> = PHOTO BAY (asal rack) · har cheez par tap wali jagah + peeli rate parchi (racks.nmOn = naam bhi) · rate cat se (POS) · khatam = "Khatam".
//     Photo wale items bane hue rack mein nahi (dohra nahi) · tasveer ka tukda canvas se kaat kar tokri / parchi / dhoondo mein · 📱 phone ghumao = 3D · 🔍 qareeb se.
import { firebaseConfig, BUSINESS_ID } from '../config.js?v=2.158.0';

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
SFX.bell = () => { const a = ac(); if (!a) return; const t = a.currentTime;   // v2.156.0: 🔔 darwaze ki ghanti (ding-dong)
  [[659.25, 0], [523.25, 0.42]].forEach(([f, d]) => [[1, 0.2], [2.76, 0.05], [5.4, 0.02]].forEach(([m, v]) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f * m; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(v, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.25 / m); o.connect(g); g.connect(a.destination); o.start(t + d); o.stop(t + d + 1.3); })); };
const sfx = k => { try { SFX[k] && SFX[k](); } catch {} };
const buzz = p => { try { if (!RM && navigator.vibrate) navigator.vibrate(p); } catch {} };   // v2.156.0: 📳 halka jhatka
const rkPh = k => 'rk_' + hash(k).toString(36);   // v2.156.0: rack ki tasveer ka id (app web-dukan.js mein bhi BILKUL yahi)
// 🧑‍💼 dukan wala — bani hui tasveer (asal banda nahi): neeli topi par sunehra NT, moonchh, muskurahat
const AVA = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="#ffe7b3"/><path d="M8 64c2-12 12-19 24-19s22 7 24 19z" fill="#1b2f5c"/><rect x="27" y="37" width="10" height="10" rx="3" fill="#c98d5e"/><path d="M25.5 46.5l6.5 7 6.5-7" fill="none" stroke="#f2b632" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="29" r="12.5" fill="#d9a074"/><circle cx="19.8" cy="30" r="2.6" fill="#c98d5e"/><circle cx="44.2" cy="30" r="2.6" fill="#c98d5e"/><path d="M19 25.5c0-9 6-14.5 13-14.5s13 5.5 13 14.5z" fill="#1b2f5c"/><path d="M17.5 25.6h29" stroke="#163b8f" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="18.6" r="3.4" fill="#f2b632"/><circle cx="27.4" cy="30.2" r="1.7" fill="#2a1d14"/><circle cx="36.6" cy="30.2" r="1.7" fill="#2a1d14"/><path d="M27.6 33.6c1.6-1 2.9-1 4.4 0 1.5-1 2.8-1 4.4 0" fill="none" stroke="#3a2a20" stroke-width="1.8" stroke-linecap="round"/><path d="M28 36.4c2.4 2.2 5.6 2.2 8 0" fill="none" stroke="#7a3b22" stroke-width="1.8" stroke-linecap="round"/></svg>';
const b64url = b64 => { try { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type: 'image/jpeg' })); } catch { return 'data:image/jpeg;base64,' + b64; } };
// 🌙 dukan khuli / band (Pakistan ka waqt) — info.open / info.close "HH:MM"
const pkNow = () => { try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); const g = k => Number(p.find(x => x.type === k)?.value) || 0; return g('hour') * 60 + g('minute'); } catch { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); } };
const hm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
const tl = v => { const t = hm(v); if (t < 0) return ''; const h = Math.floor(t / 60), m = t % 60; return `${h < 12 ? 'subah' : h < 16 ? 'dopahar' : h < 19 ? 'shaam' : 'raat'} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; };
function isClosed() { const o = hm(S.info.open), c = hm(S.info.close); if (o < 0 || c < 0 || o === c) return false; const n = pkNow(); return o < c ? !(n >= o && n < c) : !(n >= o || n < c); }
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
const S = { racks: [], bays: [], items: new Map(), bayOf: new Map(), info: {}, ph: {}, at: 0, crate: ls.get('nt-dk-crate', {}) || {}, cur: 0, open: null, q: 1, dims: null, loadedAt: 0, walkTo: -1, goal: -1 };
const PHURL = new Map(), RBG = new Map();   // RBG: rack key -> rack ki asal tasveer (blob url)
const phV = id => { const x = S.ph[id]; return x && typeof x === 'object' ? Number(x.v) || 0 : Number(x) || 0; };
const saveCrate = () => ls.set('nt-dk-crate', S.crate);

function build(d) {
  const cat = d.cat || {}, R = d.racks || {};
  S.ph = (d.phIdx && d.phIdx.m) || {};
  let rows = []; try { rows = JSON.parse(cat.j || '[]'); } catch {}
  const hide = R.hide || {}, ic = R.ic || {}, hc = R.hc || {}, cn = R.cn || {};
  const groups = new Map(); S.items = new Map();
  // 📸 v2.158.0: asal rack ki photos — photo par jo item hai wo usi rack ka (bane hue rack mein dohra nahi)
  S.nmOn = !!R.nmOn;
  S.rps = Object.entries(R.rp && typeof R.rp === 'object' ? R.rp : {}).map(([pid, x]) => { let a = []; try { a = JSON.parse((x && x.s) || '[]'); } catch {}
    return { pid, k: String(x?.k || '').trim(), o: Number(x?.o) || 0, w: Number(x?.w) || 3, h: Number(x?.h) || 4, spots: (Array.isArray(a) ? a : []).filter(t => Array.isArray(t) && t[4]).map(t => ({ x: +t[0] || 0, y: +t[1] || 0, w: +t[2] || 0, h: +t[3] || 0, id: String(t[4]) })) }; })
    .filter(p => p.k && !hc[p.k] && p.spots.length && phV('rp_' + p.pid)).sort((a, b) => a.o - b.o);
  const onPh = new Map(); for (const p of S.rps) for (const sp of p.spots) if (!onPh.has(sp.id)) onPh.set(sp.id, p.k);
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const id = String(r[0] ?? ''), rate = Number(r[3]) || 0, n = String(r[1] || '').trim();
    if (!id || !n || hide[id] || rate <= 0) continue;
    const key = onPh.get(id) || String(ic[id] || r[2] || '').trim() || 'Mutafarriq';
    if (hc[key]) continue;
    const it = { id, n, c: key, r: rate, u: String(r[4] || '').trim() };
    S.items.set(id, it);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  for (const p of S.rps) if (!groups.has(p.k)) groups.set(p.k, []);
  const order = Array.isArray(R.order) ? R.order.map(String) : [];
  const pos = k => { const i = order.indexOf(k); return i < 0 ? 1e9 : i; };
  const keys = [...groups.keys()].sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b));
  S.racks = keys.map((k, i) => ({ key: k, no: i + 1, name: String(cn[k] || '').trim() || title(k), items: groups.get(k).sort((a, b) => a.n.localeCompare(b.n)) }));
  S.racks.forEach(rk => { rk.items.forEach(it => { it.rk = rk; }); rk.photos = S.rps.filter(p => p.k === rk.key); rk.rest = rk.items.filter(it => !onPh.has(it.id)); });
  S.info = d.info || {}; S.at = Number(cat.at) || 0;
  for (const id of Object.keys(S.crate)) if (!S.items.has(id) || !(Number(S.crate[id]) > 0)) delete S.crate[id];
  saveCrate();
}

// ---------- 📐 rack ka naap ----------
function dims() {
  const a = $('aisle'), W = a.clientWidth || innerWidth, H = a.clientHeight || 600;
  const bw = W >= 1100 ? Math.floor(W / 2) : W;
  const cols = Math.max(4, Math.min(7, Math.floor((bw - 76) / 104)));   // v2.156.0: malik — har shelf par kam az kam 4
  const rows = Math.min(8, Math.max(2, Math.min(6, Math.floor((H - 96) / 118))) + 2);   // v2.156.0: 2 shelf zyada (racks kam)
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
// v2.156.1: ⚡ malik — "aage peeche karte hain to lag aata hai": sirf qareeb ke racks mein maal (DOM chhota) — door ke rack khali dhancha (sign + shelf), paas aate hi bhar jate
const NEAR = 2, FAR = 5;
function shelvesHTML(b, D, fill) {
  const rows = Math.min(D.rows, Math.max(D.rows - 2, 3, Math.ceil(b.items.length / D.cols)));   // v2.156.0: chhota rack = pehle jitni shelf (maal bara na lage)
  let h = ''; for (let s = 0; s < rows; s++) h += `<div class="shelf">${fill ? b.items.slice(s * D.cols, (s + 1) * D.cols).map(itemHTML).join('') : ''}</div>`;
  return { rows, h };
}
function fillNear(i) {
  const D = S.dims; if (!D) return;
  bayEls.forEach((el, k) => {
    const want = Math.abs(k - i) <= NEAR, drop = Math.abs(k - i) > FAR, has = el._fill;
    if (S.bays[k]?.photo) { if (want) loadRp(S.bays[k].photo); return; }   // 📸 photo bay: sirf photo lao
    if (want && !has) { const rk = el.querySelector('.rack'), bg = rk.querySelector('.rk-bg'); rk.innerHTML = ''; if (bg) rk.appendChild(bg); rk.insertAdjacentHTML('beforeend', shelvesHTML(S.bays[k], D, true).h); el._fill = true; }
    else if (drop && has) { const rk = el.querySelector('.rack'), bg = rk.querySelector('.rk-bg'); rk.innerHTML = ''; if (bg) rk.appendChild(bg); rk.insertAdjacentHTML('beforeend', shelvesHTML(S.bays[k], D, false).h); el._fill = false; }
  });
}
function bayHTML(b, i, D) {
  const { rows, h } = shelvesHTML(b, D, false), sh = [h];
  const bg = RBG.get(b.rk.key);
  return `<section class="bay${D.rows >= 6 ? ' cmp' : ''}" data-bay="${i}" style="--rows:${rows};--cols:${D.cols};--bayW:${D.bw}px" aria-label="Rack ${b.rk.no}: ${esc(b.rk.name)}"><header class="sign"><span class="sk">Rack ${b.rk.no}</span><b>${esc(b.rk.name)}</b>${b.parts > 1 ? `<span class="sp">${b.p + 1}/${b.parts}</span>` : ''}</header><div class="rack"><div class="rk-bg${bg ? ' on' : ''}" data-rbg="${esc(b.rk.key)}"${bg ? ` style="background-image:url('${bg}')"` : ''}></div>${sh.join('')}</div></section>`;
}
// ---------- 📸 v2.158.0: asal rack ki photo (bay) ----------
const RPU = new Map();   // pid -> photo (blob url)
function spotsHTML(p, pxW) {   // pxW = photo screen par kitni chauri (px) — naam sirf jahan jagah ho (≥ 66px), tang jagah par sirf raqam
  const k = 1000 / Math.max(120, pxW || 360), seen = new Set(), wN = 66 * k, wR = 46 * k;
  return p.spots.map(sp => { const it = S.items.get(sp.id), first = !seen.has(sp.id); seen.add(sp.id); const q = Number(S.crate[sp.id]) || 0, nar = sp.w < wR;
    return `<button type="button" class="spot${it ? '' : ' gone'}${q ? ' in-crate' : ''}" data-spot="${esc(sp.id)}" style="left:${sp.x / 10}%;top:${sp.y / 10}%;width:${sp.w / 10}%;height:${sp.h / 10}%" aria-label="${it ? esc(it.n) + ', ' + rs(it.r) : 'Khatam'}">${first ? `<span class="pin${nar ? ' nar' : ''}">${it ? `${S.nmOn && sp.w >= wN ? `<b>${esc(it.n)}</b>` : ''}<span class="pr">${nar ? '' : '<small>Rs</small>'}${num(it.r)}</span>` : '<span class="pr">Khatam</span>'}${q ? `<em>${num(q)}</em>` : ''}</span>` : ''}</button>`; }).join('');
}
function pbayHTML(b, i, D) {
  const p = b.photo, url = RPU.get(p.pid);
  const ah = $('aisle').clientHeight || 600, pxW = Math.min(D.bw - 40, (ah - 110) * p.w / p.h);
  return `<section class="bay pbay" data-bay="${i}" data-rp="${esc(p.pid)}" style="--bayW:${D.bw}px" aria-label="Rack ${b.rk.no}: ${esc(b.rk.name)} — asal photo"><header class="sign"><span class="sk">Rack ${b.rk.no}</span><b>${esc(b.rk.name)}</b><span class="sp">📸${b.parts > 1 ? ` ${b.p + 1}/${b.parts}` : ''}</span></header><div class="pv"><div class="pv-in" style="--ar:${(p.w / p.h).toFixed(4)}">${url ? `<img src="${url}" alt="" draggable="false">` : '<i class="pv-wait">📸 Asal rack aa raha hai…</i>'}${spotsHTML(p, pxW)}</div><button type="button" class="pv-z" data-pz="${i}" aria-label="Qareeb se dekho">🔍</button></div></section>`;
}
const rpLoading = new Set();
async function loadRp(p) {
  if (RPU.has(p.pid) || rpLoading.has(p.pid)) return; rpLoading.add(p.pid);
  try { const url = await bigPhoto('rp_' + p.pid); if (!url) return; RPU.set(p.pid, url);
    document.querySelectorAll(`.pbay[data-rp="${CSS.escape(p.pid)}"] .pv-in`).forEach(el => { el.querySelector('.pv-wait')?.remove(); if (!el.querySelector('img')) el.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" draggable="false">`); });
    cropSpots(p, url);
  } catch (e) { console.warn('rack photo', e); } finally { rpLoading.delete(p.pid); }
}
// photo ka tukda (us cheez ki tasveer) — tokri / parchi / dhoondo / khirki mein (jis item ki apni tasveer nahi)
async function cropSpots(p, url) {
  const need = new Map(); for (const sp of p.spots) { if (phV(sp.id) || PHURL.has(sp.id) || !S.items.has(sp.id)) continue; const o = need.get(sp.id); if (!o || sp.w * sp.h > o.w * o.h) need.set(sp.id, sp); }
  if (!need.size) return;
  try { const im = new Image(); im.src = url; await im.decode(); const W0 = im.naturalWidth, H0 = im.naturalHeight;
    for (const [id, sp] of need) { const sx = sp.x / 1000 * W0, sy = sp.y / 1000 * H0, sw = Math.max(1, sp.w / 1000 * W0), sh = Math.max(1, sp.h / 1000 * H0), k = Math.min(1, 280 / Math.max(sw, sh));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k)); cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      const bl = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.82)); if (bl) PHURL.set(id, URL.createObjectURL(bl)); }
    paintCrate(); } catch {}
}
function openPz(i) {
  const b = S.bays[i], p = b && b.photo, url = p && RPU.get(p.pid); if (!url) return;
  const box = $('pzIn'); box.style.setProperty('--ar', (p.w / p.h).toFixed(4)); box.innerHTML = `<img src="${url}" alt="" draggable="false">${spotsHTML(p, Math.min(2400, Math.max(innerWidth * 2.3, 900)))}`;
  $('pzT').textContent = `🔍 Rack ${b.rk.no} · ${b.rk.name}`; $('pz').hidden = false; openOv('pz');
  requestAnimationFrame(() => { const sc = $('pzSc'); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 3; });
}
// 📱 phone ghumao = rack bhi halka ghoome (3D) — Android seedha, iPhone pehli ungli par ijazat
const GY = { on: false, x: 0, y: 0, tx: 0, ty: 0, b0: null, g0: null, raf: 0, asked: false };
function gyroStart() {
  if (GY.on || GY.asked || LITE || RM || !('DeviceOrientationEvent' in window)) return; GY.asked = true;
  const go = () => { GY.on = true; addEventListener('deviceorientation', e => { if (e.beta == null || e.gamma == null) return; if (GY.b0 == null) { GY.b0 = e.beta; GY.g0 = e.gamma; } GY.b0 += (e.beta - GY.b0) * 0.01; GY.g0 += (e.gamma - GY.g0) * 0.01;
    GY.tx = Math.max(-7, Math.min(7, (e.gamma - GY.g0) * 0.4)); GY.ty = Math.max(-5, Math.min(5, (e.beta - GY.b0) * -0.3));
    if (!GY.raf) GY.raf = requestAnimationFrame(() => { GY.raf = 0; GY.x += (GY.tx - GY.x) * 0.45; GY.y += (GY.ty - GY.y) * 0.45; depth(); }); }); };
  const P = window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission;
  if (typeof P === 'function') P.call(window.DeviceOrientationEvent).then(r => { if (r === 'granted') go(); }).catch(() => {}); else go();
}
function renderAisle(keepId) {
  const D = dims(); S.dims = D;
  const bays = [];
  S.racks.forEach(rk => { rk.bay0 = bays.length;
    rk.photos.forEach((ph, j) => bays.push({ rk, photo: ph, p: j, parts: rk.photos.length, items: [...new Set(ph.spots.map(x => x.id))].map(id => S.items.get(id)).filter(Boolean) }));   // 📸 pehle asal photo
    const parts = Math.ceil(rk.rest.length / D.per); for (let p = 0; p < parts; p++) bays.push({ rk, p, parts, items: rk.rest.slice(p * D.per, (p + 1) * D.per) }); });
  S.bays = bays; S.bayOf = new Map();
  bays.forEach((b, i) => b.items.forEach(it => { if (!S.bayOf.has(it.id)) S.bayOf.set(it.id, i); }));
  const a = $('aisle');
  a.innerHTML = bays.length ? bays.map((b, i) => b.photo ? pbayHTML(b, i, D) : bayHTML(b, i, D)).join('') : '<p class="empty-aisle">Abhi racks par maal nahi saja — thori der baad dobara dekhein.</p>';
  bayEls = [...a.querySelectorAll('.bay')]; rackEls = bayEls.map(el => el.querySelector('.rack, .pv-in')); filledAt = -99;
  paintRkBar();
  observe();
  if (keepId && S.bayOf.has(keepId)) go(S.bayOf.get(keepId), true);
  onScroll();
}

// ---------- 📷 tasveerein (sirf jo rack nazar aaye / qareeb ho) ----------
let io = null, loadT = 0, loading = false;
const want = new Set(), wantBg = new Set();
function observe() {
  try { io && io.disconnect(); } catch {}
  if (!('IntersectionObserver' in window)) { S.items.forEach(it => { if (phV(it.id)) want.add(it.id); }); loadPhotos(); return; }
  io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { const b = S.bays[Number(e.target.dataset.bay)]; if (b) { b.items.forEach(it => { if (phV(it.id) && !PHURL.has(it.id)) want.add(it.id); }); if (!b.photo && phV(rkPh(b.rk.key)) && !RBG.has(b.rk.key)) wantBg.add(b.rk.key); } }
    clearTimeout(loadT); loadT = setTimeout(() => { loadPhotos(); loadBgs(); }, 50);
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
// v2.156.0: 📷 rack ki asal tasveer (rack ke peeche) + dukan ki tasveer (shutter ke peeche) — ek dafa aa kar IndexedDB
let bgLoading = false;
async function bigPhoto(id) {   // id = 'shop' ya rkPh(key) -> blob url
  const v = phV(id); if (!v) return '';
  const c = await cGet('big:' + id); if (c && c.v === v && c.b64) return b64url(c.b64);
  const got = await batchGet([phDoc(id)]), b = got[phDoc(id)]?.b?.b64; if (!b) return '';
  cPut('big:' + id, { v, b64: b }); return b64url(b);
}
async function loadBgs() {
  if (bgLoading) return; bgLoading = true;
  try {
    while (wantBg.size) {
      const k = [...wantBg][0]; wantBg.delete(k); if (RBG.has(k)) continue;
      try { const raw = await bigPhoto(rkPh(k)); if (!raw) continue; const url = await soften(raw); RBG.set(k, url); document.querySelectorAll(`.rk-bg[data-rbg="${CSS.escape(k)}"]`).forEach(el => { el.style.backgroundImage = `url('${url}')`; el.classList.add('on'); }); } catch (e) { console.warn('rack tasveer', e); }
    }
  } finally { bgLoading = false; }
}
// rack ki tasveer ek dafa halki + dhundli bana lo (canvas) — har frame CSS blur ka bojh nahi
async function soften(url) {
  try {
    const im = new Image(); im.src = url; await im.decode();
    const k = Math.min(1, 520 / (im.naturalWidth || 520)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
    const cx = cv.getContext('2d'); try { cx.filter = 'blur(2px) saturate(.92)'; } catch {} cx.drawImage(im, -4, -4, cv.width + 8, cv.height + 8); cx.filter = 'none';
    cx.fillStyle = 'rgba(255,253,247,.52)'; cx.fillRect(0, 0, cv.width, cv.height);
    const b = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.72)); if (!b) return url;
    try { URL.revokeObjectURL(url); } catch {} return URL.createObjectURL(b);
  } catch { return url; }
}
async function loadShop() { try { const url = await bigPhoto('shop'); const el = $('shopPh'); if (url && el) { el.style.backgroundImage = `url('${url}')`; el.classList.add('has'); } } catch {} }
function setPhoto(id, url) {
  PHURL.set(id, url);
  document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"] .it-box`).forEach(b => { b.innerHTML = `<img src="${url}" alt="">`; });
  if (S.open === id) $('shImg').innerHTML = imgOf(S.items.get(id), true);
  paintCrate();
}

// ---------- 🚶 chalna ----------
function onScroll() {
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth || 1;
  let i = Math.min(Math.max(0, S.bays.length - 1), Math.max(0, Math.round(a.scrollLeft / bw)));
  const vis = Math.max(1, Math.round(a.clientWidth / bw)); if (S.goal >= i && S.goal < i + vis) i = S.goal;   // v2.156.0: PC par do rack saath — jis rack ko chuna wahi "yahan"
  S.cur = i;
  const b = S.bays[i], x = a.scrollLeft;
  if (i !== filledAt) { filledAt = i; fillNear(i);   // v2.156.1: sirf rack badle to DOM likho (har frame nahi)
    $('where').textContent = b ? `Rack ${b.rk.no}/${S.racks.length} · ${b.rk.name}${b.photo ? ' 📸' : ''}${b.parts > 1 ? ` (${b.p + 1}/${b.parts})` : ''}` : 'Noor Traders';
    const w = S.bays.length ? Math.round((i + 1) / S.bays.length * 100) + '%' : '0';
    $('walkBar').style.width = w; $('walkFeet').style.setProperty('--w', w); }
  if (!LITE) { FL ||= document.querySelector('.floor-t'); CE ||= document.querySelector('.ceil-t'); if (FL) FL.style.transform = `translate3d(${-(x % 128).toFixed(1)}px,0,0)`; if (CE) CE.style.transform = `translate3d(${-((x * 0.55) % 250).toFixed(1)}px,0,0)`; }   // 🚶 farsh / lights — sirf transform (GPU), poori dukan dobara nahi
  if (b && b.rk !== curRk) { curRk = b.rk; markRk(); }
  const pd = x < 4, nd = x + a.clientWidth >= a.scrollWidth - 4;
  if (pd !== lastPd) { lastPd = pd; $('prevBtn').disabled = pd; } if (nd !== lastNd) { lastNd = nd; $('nextBtn').disabled = nd; }
  depth();
  if (i !== arrived) { clearTimeout(arriveT); arriveT = setTimeout(() => { if (S.cur !== i || i === arrived) return; const first = arrived < 0; arrived = i; if (first || !doorGone) return; replay(bayEls[i]?.querySelector('.sign'), 'swing'); replay($('walkFeet'), 'bob'); sfx('step'); buzz(6); if (S.walkTo === i) { S.walkTo = -1; hpArrive(); } phHint(i); }, 140); }
}
function phHint(i) { if (!S.bays[i]?.photo || ss.get('nt-dk-ph')) return; ss.set('nt-dk-ph', '1'); const h = $('hint'); h.textContent = '👆 Photo par cheez dabayein — rate aur tokri'; h.hidden = false; setTimeout(() => { h.hidden = true; }, 3600); }
// 🚶 rack se rack: racks halka sa mud kar (3D) aage, farsh ki tiles alag raftaar (sirf qareeb ke 3–4 racks)
let bayEls = [], rackEls = [], arrived = -1, arriveT = 0, doorGone = false, curRk = null, filledAt = -99, FL = null, CE = null, lastPd = null, lastNd = null;
function depth() {
  if (LITE || !bayEls.length) return;
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth || 1, x = a.scrollLeft, mid = x + a.clientWidth / 2;
  const lo = Math.max(0, Math.floor(x / bw) - 1), hi = Math.min(bayEls.length - 1, Math.ceil((x + a.clientWidth) / bw) + 1);
  for (let k = lo; k <= hi; k++) {   // v2.156.1: seedha rack ka transform (CSS var nahi — warna rack ka har item dobara style hota tha)
    const p = Math.max(-1, Math.min(1, ((k + 0.5) * bw - mid) / bw)), el = rackEls[k]; if (!el) continue;
    el.style.transform = `perspective(900px) rotateY(${(-p * 14 + GY.x).toFixed(2)}deg) rotateX(${GY.y.toFixed(2)}deg) scale(${(1 - Math.abs(p) * 0.07).toFixed(3)})`; el.style.opacity = (1 - Math.abs(p) * 0.3).toFixed(3);   // + 📱 phone ka jhukao
  }
}
function go(i, now) {
  const a = $('aisle'), bw = S.dims?.bw || a.clientWidth;
  i = Math.max(0, Math.min(S.bays.length - 1, i)); S.goal = i;
  if (now) { a.style.scrollBehavior = 'auto'; a.scrollLeft = i * bw; a.style.scrollBehavior = ''; } else { a.scrollTo({ left: i * bw, behavior: 'smooth' }); }   // v2.156.1: gali ka jhatka (aisle transform) hataya — scroll ko bhari karta tha
}

// ---------- 🗂 v2.156.0: neeche racks ke naam (chips) — jis par khare hain wo roshan ----------
function paintRkBar() {
  const box = $('rkChips'); if (!box) return;
  box.innerHTML = S.racks.map((rk, k) => `<button type="button" class="rkc" data-rk="${k}"><i>${rk.no}</i>${esc(rk.name)}</button>`).join('');
  curRk = null; markRk();
}
function markRk() {
  const box = $('rkChips'); if (!box) return;
  const k = curRk ? S.racks.indexOf(curRk) : -1;
  box.querySelectorAll('.rkc').forEach((el, j) => el.classList.toggle('cur', j === k));
  const el = box.children[k]; if (el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: LITE ? 'auto' : 'smooth' });
}
function goRack(k, why) {
  const rk = S.racks[k]; if (!rk || rk.bay0 == null || !S.bays[rk.bay0]) return;
  const i = rk.bay0;
  if (why === 'help') S.walkTo = i;
  if (i === S.cur) { if (why === 'help') { S.walkTo = -1; hpArrive(); } replay(bayEls[i]?.querySelector('.sign'), 'swing'); return; }
  go(i); buzz(8);
}
// ---------- 🧑‍💼 v2.156.0: dukan wala (madadgar) — "Kya chahiye?" → rack tak le jata hai (AI nahi, sirf racks ke naam) ----------
function openHelper(auto) {
  const h = $('helper'); if (!h || !S.racks.length) return;
  $('hpT').textContent = auto ? 'Assalam o Alaikum! 👋' : 'Ji, farmaiye 🙂';
  $('hpS').textContent = isClosed() ? 'Dukan abhi band hai, magar aap order chhor sakte hain — khulte hi bhej denge. Kya chahiye?' : 'Kya chahiye? Rack chunein — main aap ko wahan le chalta hoon. 👉 Ungli se bhi agla rack dekh sakte hain.';
  $('hpChips').innerHTML = '<button type="button" class="hp-alt" data-hp-find="1">🔍 Naam se dhoondo</button>' + S.racks.map((rk, k) => `<button type="button" data-hp-rk="${k}"><i>${rk.no}</i>${esc(rk.name)}</button>`).join('');
  h.hidden = false; replay(h.querySelector('.hp-ava'), 'wave'); buzz(10);
}
function closeHelper() { const h = $('helper'); if (h) h.hidden = true; }
function hpWalk(k) {
  const rk = S.racks[k]; if (!rk) return;
  $('hpT').textContent = 'Chaliye! 👣'; $('hpS').textContent = `Rack ${rk.no} · ${rk.name} — ye raha.`;
  $('hpChips').innerHTML = '';
  goRack(k, 'help');
}
function hpArrive() { const h = $('helper'); if (!h || h.hidden) return; $('hpT').textContent = 'Lijiye, aa gaye 🙂'; replay(h.querySelector('.hp-ava'), 'wave'); setTimeout(closeHelper, 1600); }

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
  document.querySelectorAll(`.spot[data-spot="${CSS.escape(id)}"]`).forEach(el => { el.classList.toggle('in-crate', q > 0); const pin = el.querySelector('.pin'); if (!pin) return; let em = pin.querySelector('em'); if (q) { if (!em) { em = document.createElement('em'); pin.appendChild(em); } em.textContent = num(q); } else if (em) em.remove(); });   // 📸
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
  buzz(14);
}

// ---------- 🪟 khirkiyan + phone ka back ----------
const OV = []; let skipPop = 0;
function openOv(n) { OV.push(n); try { history.pushState({ ntOv: n }, ''); } catch {} }
function hideOv(n) {
  if (n === 'sheet') { $('sheet').hidden = true; S.open = null; }
  else if (n === 'cv') $('cv').hidden = true;
  else if (n === 'find') $('find').hidden = true;
  else if (n === 'map') $('map').hidden = true;
  else if (n === 'pz') { $('pz').hidden = true; $('pzIn').innerHTML = ''; }
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
  note.textContent = !wa ? 'Dukan ka WhatsApp number abhi nahi laga — dukan par rabta karein.' : (L.length ? (isClosed() ? `🌙 Dukan abhi band hai — order bhej dein, ${tl(S.info.open) ? tl(S.info.open) + ' ' : ''}khulte hi bhej denge. ` : '') + 'WhatsApp khulega, parchi likhi hogi — bas "Send" dabayein.' : '');
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
  if (isClosed()) t.push('🌙 (Dukan band waqt par order — khulne par)');
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
  setTimeout(() => document.querySelectorAll(`.it[data-id="${CSS.escape(id)}"], .spot[data-spot="${CSS.escape(id)}"]`).forEach(el => { el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); setTimeout(() => el.classList.remove('glow'), 3600); }), 450);
}

// ---------- 🗺 naqsha ----------
function openMap() {
  const curRack = S.bays[S.cur]?.rk?.no;
  $('mapList').innerHTML = `<li><button type="button" data-go="0"><span class="n">🚪</span><span class="t"><b>Darwaza</b><small>Shuru</small></span></button></li>` +
    S.racks.map(rk => `<li><button type="button" class="${rk.no === curRack ? 'cur' : ''}" data-go="${rk.bay0 ?? 0}"><span class="n">${rk.no}</span><span class="t"><b>${esc(rk.name)}</b><small>${rk.items.length} cheezein</small></span></button></li>`).join('') +
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
  const off = I.on === false, cl = !off && isClosed();
  $('enterBtn').disabled = off;
  $('enterTxt').textContent = off ? 'Online dukan abhi band hai' : cl ? 'Andar aayein (order chhor dein)' : 'Shutter uthayein';
  $('dClosed').hidden = !cl; if (cl) $('dClosed').textContent = `🌙 Dukan abhi band hai — order chhor dein, ${tl(I.open) ? tl(I.open) + ' baje ' : ''}khulte hi bhej denge.`;
  $('board').classList.add('lit'); $('board').classList.toggle('night', cl);   // 💡 board ke bulb ek ek kar ke jalte hain
  paintClosed();
}
function paintClosed() {   // 🌙 andar: upar aadha shutter
  const cl = S.info.on !== false && isClosed();
  $('closedBand').hidden = !cl; $('aisleWrap').classList.toggle('closed', cl);
  if (cl) $('cbTxt').textContent = `Order chhor dein — ${tl(S.info.open) ? tl(S.info.open) + ' baje ' : ''}khulte hi bhej denge`;
}
function enter() {
  const d = $('door'); if (d.classList.contains('up')) return;
  d.classList.add('up'); ss.set('nt-dk-in', '1'); sfx('shutter'); buzz([18, 70, 18]);
  const sh = $('shutter'), board = $('board'), top = d.querySelector('.door-top');
  const finish = () => { if (doorGone) return; doorGone = true; d.classList.add('gone'); lightsOn(); sfx('bell'); welcome(); };
  if (RM) { finish(); return; }
  // ① jhatka · ② drum mein lipat kar upar · ③ board upar ghayab
  const j = anim(sh, [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(-12px)' }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
  const shop = $('shopPh'), walkIn = () => { if (!shop.classList.contains('has') || LITE) { finish(); return; } const w = anim(shop, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'scale(1.45)', opacity: 0, filter: 'blur(3px)' }], { duration: 950, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }); if (w) w.onfinish = finish; else finish(); };   // v2.156.0: asal dukan mein qadam
  const roll = () => { const r = anim(sh, [{ transform: 'translateY(-12px)' }, { transform: 'translateY(-101%)' }], { duration: LITE ? 650 : 1200, easing: 'cubic-bezier(.45,.05,.45,1)', fill: 'forwards' }); if (r) r.onfinish = () => setTimeout(walkIn, shop.classList.contains('has') ? 380 : 0); else finish(); };
  if (j) j.onfinish = roll; else roll();
  anim(top, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-110%)', opacity: 0 }], { duration: 520, delay: LITE ? 400 : 760, easing: 'ease-in', fill: 'forwards' });
  setTimeout(finish, $('shopPh').classList.contains('has') ? 3400 : 2200);
}
// 👋 andar aate hi (har session ek dafa) dukan wala salaam karta hai — pehle wala "👉 Ungli se agla rack" ab isi ke andar
function welcome() { if (ss.get('nt-dk-help') || !S.racks.length) return; ss.set('nt-dk-help', '1'); setTimeout(() => { if (!OV.length) openHelper(true); }, RM || LITE ? 300 : 1500); }
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
    build(d); renderAisle(keep); paintCrate(); paintDoor(); if (phV('shop')) loadShop();
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
  if (!GY.asked) gyroStart();   // 📱 pehli ungli par (iPhone ijazat maangta hai)
  const sp = t.closest('[data-spot]');
  if (sp) { const id = sp.dataset.spot, si = S.items.get(id); if (!si) { replay(sp, 'nope'); buzz([10, 40, 10]); return; } replay(sp, 'tap'); sfx('pick'); buzz(8); closeHelper(); setTimeout(() => openSheet(id, null), LITE || RM ? 0 : 120); return; }   // 📸 photo par cheez
  const pzb = t.closest('[data-pz]'); if (pzb) { openPz(Number(pzb.dataset.pz)); return; }
  if (t.closest('[data-pz-close]')) { closeOv('pz'); return; }
  const it = t.closest('.it');
  if (!t.closest('#helper') && !t.closest('#helpBtn') && !t.closest('[data-rk]') && $('helper') && !$('helper').hidden && S.walkTo < 0) closeHelper();
  if (it && t.closest('#aisle')) {
    if (t.closest('[data-plus]')) addToCrate(it.dataset.id, 1, it.querySelector('img,.pk'));
    else { replay(it, 'lift'); replay(it.querySelector('.tag'), 'wig'); sfx('pick'); buzz(8); const el = it; setTimeout(() => openSheet(el.dataset.id, el), LITE || RM ? 0 : 150); }
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
  const rc = t.closest('[data-rk]'); if (rc) { closeHelper(); goRack(Number(rc.dataset.rk)); return; }   // v2.156.0: 🗂 neeche ka rack chip
  if (t.closest('#helpBtn')) { if ($('helper').hidden) openHelper(false); else closeHelper(); return; }
  if (t.closest('[data-hp-close]')) { closeHelper(); return; }
  const hr = t.closest('[data-hp-rk]'); if (hr) { hpWalk(Number(hr.dataset.hpRk)); return; }
  if (t.closest('[data-hp-find]')) { closeHelper(); $('find').hidden = false; openOv('find'); findPaint(); setTimeout(() => $('findQ').focus(), 30); return; }
});
$('who').addEventListener('change', e => { if (e.target.name === 'how') $('addrL').hidden = e.target.value !== 'home'; });
$('who').addEventListener('submit', sendOrder);
$('findQ').addEventListener('input', () => { clearTimeout(findPaint.t); findPaint.t = setTimeout(findPaint, 90); });
$('aisle').addEventListener('scroll', () => { cancelAnimationFrame(onScroll.r); onScroll.r = requestAnimationFrame(onScroll); }, { passive: true });
['pointerdown', 'wheel'].forEach(k => $('aisle').addEventListener(k, () => { S.goal = -1; }, { passive: true }));   // ungli / pahiya = khud chal raha hai
addEventListener('keydown', e => {
  if (e.key === 'Escape' && OV.length) { closeOv(OV[OV.length - 1]); return; }
  if (OV.length || /input|textarea/i.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') go(S.cur + 1); else if (e.key === 'ArrowLeft') go(S.cur - 1);
});
let rzT = 0;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const D = dims(), o = S.dims; if (!o || D.bw !== o.bw || D.cols !== o.cols || D.rows !== o.rows) renderAisle(S.bays[S.cur]?.items?.[0]?.id); }, 180); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.loadedAt && Date.now() - S.loadedAt > 15 * 60e3) load(true); });

document.querySelectorAll('#helpBtn,.hp-ava').forEach(el => { el.innerHTML = AVA; });   // v2.156.0
setInterval(() => { if (S.loadedAt) { paintClosed(); if (!doorGone) paintDoor(); } }, 60000);   // 🌙 waqt guzre to band / khuli
load();
