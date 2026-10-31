// web-dukan.js — v2.148.0 (30 Oct 2026): 🏪 ONLINE DUKAN — app ka screen (malik + Full mulazim, CAP v:web OPT_IN)
//   Malik: "pictures hum lagayenge aur list se naam select karenge · racks category-wise (shuru cosmetics … aakhir ghee/oil)".
//   ① 📷 Rack ki photo (camera / gallery) → ungli se item ke gird dabba → list (pehle se nazar, search, bina tasveer pehle) se naam → ✅
//      wahi photo se agla item (ek photo, kai items). Item ki line ka 📷 = seedha usi item ki photo.
//   ② 🗂 Racks ki tarteeb (↑ ↓, naam, chhupao) · item ka rack badlo / website se chhupao · 🏪 dukan ki maloomat (malik: WhatsApp, pata, timing).
//   Data (cloud.js): webDukan/racks · phIdx · ph_<id> (JPEG ≤ 560 px) · info (malik) · cat (PC sync-stock v3; malik ka 🔄 fallback).
//   AI NAHI — naam insaan chunta hai. Website: dukan/ (sab dekh sakte, sirf naam / retail rate / tasveer).
//   v2.156.0: ☑ KAI ITEMS EK SAATH RACK MEIN (⋮ "☑ Items chuno" → ☐ tap / ☑ Sab → "🗂 N → Rack" — sirf racks.ic, ek save) ·
//     📷 RACK KI ASAL TASVEER (🗂 Racks ki tarteeb ka 📷, ya photo-se-items mein "🗂 Rack ke peeche") = ph_<rkPh(rack)> + phIdx.m ·
//     🏪 DUKAN KI TASVEER (shutter ke peeche) = ph_shop · khulne / band hone ka waqt info.open / info.close (website par 🌙 band).
//   v2.157.0: 🤖 RACKS KHUD BANAO (AI — Gemini, malik ki key): POS mein category khali (sab "Mutafarriq") — AI har item ka naam parh kar AIR
//     ki list se rack chunti hai (sirf jin ka rack haath se nahi laga) → PREVIEW → malik ka ✅ Lagao = ek saveWebRacks (ic + order). Ijazat ke baghair kuch nahi.
//   v2.158.0: 📸 ASAL RACK KI PHOTO = DUKAN (malik: "rack ki photo par AI khud item pehchane, hum tap kar ke naam likhein, rate naam se aaye"):
//     photo → ph_rp_<pid> (≤1600px) · racks.rp[pid] = {k: rack, o, w, h, s: JSON [[x,y,w,h,itemId] | [x,y,w,h,'',aiLabel]]} (0–1000) ·
//     🤖 AI (Gemini, box_2d) har cheez ka dabba + label → malik tap / ☑ kai dabbe → item (POS list, AI label se mashwara) — same label wale khud.
//     racks.nmOn = customer ko photo par naam. Website: photo bay + tap wali jagah + rate ki parchi (rate POS se).
import { kindOf } from './dukan/khula.js?v=2.160.0';
import { smartFind } from './dukan/dhoond.js?v=2.160.0';   // v2.160.0: 🔍 smart dhoondo (website ke saath EK qaida)
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const title = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const rkPh = k => 'rk_' + hash(k).toString(36);
// v2.159.0: 🌾 khula maal — website par 🫙 sheeshe ka dabba / 🧺 tora / ▦ shelf. Qaida website (dukan/khula.js) wala hi — ek jagah.
const KIND = { g: '🫙 Dabba', s: '🧺 Tora', n: '▦ Shelf' };   // v2.156.0: website dukan.js mein BILKUL yahi (rack ki tasveer ka id)
const ago = t => { const m = Math.round((Date.now() - (Number(t) || 0)) / 60000); return !t ? '—' : m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; };
const LS = 'sam-web-dukan';
const pref = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } })();
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ ck: W?.ck || '', f: W?.f || 'all' })); } catch {} };
export const WEB_URL = () => new URL('dukan/', location.href.split('#')[0].replace(/[^/]*$/, '')).href;

let A = null;   // {cloud, stock, owner, notice}
let W = null;   // screen ki haalat
let un = null;  // Firestore listeners
const TH = new Map();   // id -> {v, url} chhoti tasveer (phone ki memory)

function fresh() {
  return { cat: {}, info: {}, racks: { order: [], cn: {}, hc: {}, hide: {}, ic: {}, rp: {}, nmOn: false, lp: {}, draw: false }, ph: {}, got: {}, q: '', ck: pref.ck || '', f: pref.f || 'all', lim: 120, view: 'list', busy: new Set(), ok: new Set(), err: new Map(), crop: null, pq: '', pck: '', arm: '', act: '', rkSt: '', infoSt: '', sel: null, ai: null, aiOpen: '', rpe: null, rpq: '', rpNew: null, rpDelArm: 0, lastF: [], rkIds: new Set(), rkWait: new Set() };
}

// ---------- 📦 items (POS stock → website wali list) ----------
function base() {
  const st = A.stock(); if (!st || !st.loaded) return null;
  const names = st.names || {}, bs = st.branches || [];
  const shopB = bs.find(b => /noor/i.test(String(names[b] || ''))) ?? (bs.includes(1) ? 1 : bs[0]);
  const band = st.hidden || {}, M = new Map();
  for (const b of bs) for (const r of st.itemsFor(b)) {
    const k = String(r.id); let m = M.get(k);
    if (!m) { m = { id: r.id, n: String(r.name || '').trim(), c: r.cat || '', r: 0, u: r.uName || 'Pcs', s: 0, shop: false, pk: [] }; M.set(k, m); }
    if (!m.pk.length && Array.isArray(r.sb)) m.pk = r.sb.filter(x => Number(x?.q) > 0).map(x => [Number(x.q), Number(x.r) || 0]);   // 🌾 packet (sub-barcode) — dabba / tora ka khud wala faisla
    m.s += Number(r.stock) || 0;
    if (!m.c && r.cat) m.c = r.cat;
    if (b === shopB && Number(r.rate) > 0) { m.r = Number(r.rate); m.shop = true; m.u = r.uName || m.u; }
    else if (!m.shop && Number(r.rate) > m.r) m.r = Number(r.rate);
  }
  return [...M.values()].filter(m => m.s > 0 && m.r > 0 && m.n && !band[String(m.id)]);
}
function items() {
  const B = base(); if (!B) return null;
  const R = W.racks;
  return B.map(m => { const id = String(m.id), pc = String(m.c || '').trim() || 'Mutafarriq'; const o = { id, n: m.n, pc, c: String(R.ic[id] || '') || pc, r: Math.round(m.r * 100) / 100, u: m.u, pk: m.pk || [], hide: !!R.hide[id], pic: !!W.ph[id] }; o.auto = kindOf(o, null); o.k = kindOf(o, R.lp); return o; });
}
function racksOf(L) {
  const R = W.racks, cnt = new Map();
  for (const it of L) cnt.set(it.c, (cnt.get(it.c) || 0) + (it.hide ? 0 : 1));
  for (const k of R.order || []) if (!cnt.has(k)) cnt.set(k, 0);
  const pos = k => { const i = (R.order || []).indexOf(k); return i < 0 ? 1e9 : i; };
  return [...cnt.keys()].sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b)).map(k => ({ k, name: String(R.cn[k] || '').trim() || title(k), n: cnt.get(k), off: !!R.hc[k] }));
}
const rackName = k => String(W.racks.cn[k] || '').trim() || title(k);

// ---------- 🪟 khirki ----------
export function webOpen(ctx) {
  A = ctx; W = fresh();
  let d = $('wdDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'wdDlg'; d.className = 'wd';
    d.innerHTML = `<div class="wd-in"><header class="wd-h"><button type="button" class="wd-x" data-wd="back" aria-label="Wapas">‹</button><b id="wdT">🏪 Online Dukan</b><button type="button" class="wd-x" data-wd="menu" aria-label="Aur">⋮</button></header><div class="wd-strip" id="wdStrip"></div><div class="wd-body" id="wdBody"></div><footer class="wd-f" id="wdFoot"></footer><div class="wd-sheet" id="wdSheet" hidden><div class="wd-sbg" data-wd="sclose"></div><div class="wd-scard" id="wdSCard"></div></div><input type="file" accept="image/*" capture="environment" hidden id="wdCam"><input type="file" accept="image/*" hidden id="wdGal"></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', onClick);
    d.addEventListener('input', onInput);
    d.addEventListener('change', onChange);
    d.addEventListener('cancel', e => { e.preventDefault(); webClose(); });
    d.addEventListener('submit', onSubmit);
    ['wdCam', 'wdGal'].forEach(k => $(k).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) gotFile(f); }));
  }
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  if (un) { try { un(); } catch {} }
  un = A.cloud.listenWebDukan((k, v, e) => {
    if (!W) return;
    if (e) { W.got[k] = 'err'; paint(); return; }
    W.got[k] = 1;
    if (k === 'cat') W.cat = v || {};
    else if (k === 'info') W.info = v || {};
    else if (k === 'phIdx') W.ph = (v && v.m) || {};
    else if (k === 'racks' && !W.rkDirty) W.racks = { order: Array.isArray(v?.order) ? v.order : [], cn: v?.cn || {}, hc: v?.hc || {}, hide: v?.hide || {}, ic: v?.ic || {}, rp: v?.rp || {}, nmOn: !!v?.nmOn, lp: v?.lp || {}, draw: !!v?.draw };
    paintSoon();
  });
  paint();
  waitStock();
}
let wsT = 0;
function waitStock() { clearTimeout(wsT); let n = 0; const t = () => { if (!W) return; const st = A.stock(); if (st && st.loaded) { paint(); return; } if (++n < 90) wsT = setTimeout(t, 1000); }; wsT = setTimeout(t, 600); }
// phone ka back / Esc: pehle andar ka qadam, phir band (app.js popstate → window.ntWebClose)
export function webClose() {
  const d = $('wdDlg'); if (!d || !d.open || !W) return false;
  if (!$('wdSheet').hidden) { sheetClose(); return true; }
  if (W.sel && W.view === 'list') { W.sel = null; paint(); return true; }   // v2.156.0: back = chunne ka mode band
  if (W.view === 'rpe') { if (W.rpe?.draw || W.rpe?.sel?.size) { W.rpe.draw = false; W.rpe.sel = new Set(); } else { W.rpe = null; W.view = 'rps'; } paint(); return true; }   // v2.158.0
  if (W.view === 'pick') { W.view = 'crop'; paint(); return true; }
  if (W.view !== 'list') { if (W.ai) W.ai.run = false; W.ai = null; W.view = 'list'; W.crop = null; paint(); return true; }
  try { d.close(); } catch { d.removeAttribute('open'); }
  if (un) { try { un(); } catch {} un = null; }
  clearTimeout(wsT); W = null;
  return true;
}
window.ntWebClose = webClose;
let psT = 0;
function paintSoon() { clearTimeout(psT); psT = setTimeout(paint, 60); }

// ---------- 🖌 paint ----------
function paint() {
  if (!W || !$('wdDlg')) return;
  const v = W.view;
  $('wdT').textContent = v === 'crop' ? '✂️ Photo se items' : v === 'pick' ? '🔎 Ye kaun sa item?' : v === 'racks' ? '🗂 Racks ki tarteeb' : v === 'info' ? '🏪 Dukan ki maloomat' : v === 'ai' ? '🤖 Racks khud banao' : '🏪 Online Dukan';
  if (v === 'ai') return paintAi();
  if (v === 'rps' || v === 'rpe') { $('wdT').textContent = v === 'rps' ? '📸 Rack ki asal photos' : '📸 ' + rackName(W.racks.rp?.[W.rpe?.pid]?.k || ''); return v === 'rps' ? paintRps() : paintRpe(); }
  if (v === 'crop') return paintCrop();
  if (v === 'pick') return paintPick();
  if (v === 'racks') return paintRacks();
  if (v === 'info') return paintInfo();
  paintList();
}
function stripHTML(L) {
  const all = L.filter(x => !x.hide), pics = all.filter(x => x.pic).length;
  const rk = W.ck ? rackName(W.ck) : 'Sab racks';
  const F = { all: 'Sab', nopic: '📷 Bina tasveer', pic: '✅ Tasveer wale', hid: '🙈 Chhupe' }[W.f] || 'Sab';
  const catAt = Number(W.cat.at) || 0, old = !catAt || Date.now() - catAt > 6 * 3600e3;
  if (W.sel) return `<span><b>☑ Chunne ka mode</b> · item par dabayein</span><span class="wd-k ok">✓ ${num(W.sel.size)} chune</span><span class="wd-dim">${esc(rk)} · ${esc(F)}</span>`;
  return `<span><b>${esc(rk)}</b> · ${esc(F)}</span><span class="wd-k">🌐 ${num(all.length)} items · 📷 ${num(pics)}</span><span class="wd-k ${old ? 'bad' : ''}" title="Website par rates">🕘 ${catAt ? ago(catAt) : 'website list nahi'}</span><span class="wd-dim">⋮ se badlein</span>`;
}
function paintList() {
  const L = items();
  if (!L) { $('wdStrip').innerHTML = '<span>⏳ Items load ho rahe hain…</span>'; $('wdBody').innerHTML = '<p class="wd-empty">Stock aa raha hai…</p>'; $('wdFoot').innerHTML = ''; return; }
  $('wdStrip').innerHTML = stripHTML(L);
  const q = W.q.trim();
  const rk = racksOf(L), no = new Map(rk.filter(r => !r.off).map((r, i) => [r.k, i + 1])), onP = W.f === 'noph' ? onPhotoSet() : null;
  let F = L.filter(it => (!W.ck || it.c === W.ck) && (W.f === 'all' || (W.f === 'nopic' && !it.pic && !it.hide) || (W.f === 'pic' && it.pic) || (W.f === 'hid' && it.hide) || (W.f === 'noph' && !it.hide && it.k === 'n' && !onP.has(it.id))));
  let NR = [];
  if (q) { const r = smartFind(F, q, it => it.n + ' ' + rackName(it.c), it => it.id); F = r.hits; NR = r.near; }   // v2.160.0: 🔍 smart (daal = dal = دال · sugar = cheeni · ghalat typing = "Shayad ye")
  else F.sort((a, b) => ((no.get(a.c) || 999) - (no.get(b.c) || 999)) || a.n.localeCompare(b.n));
  W.lastF = F.map(x => x.id);
  const body = $('wdBody'), keepY = body.scrollTop;
  body.innerHTML = `<label class="wd-q"><span>🔍</span><input id="wdQ" type="search" placeholder="Item dhoondo…" value="${esc(W.q)}" autocomplete="off"></label>` +
    (F.length ? `<div class="wd-list">${F.slice(0, W.lim).map(it => rowHTML(it, no)).join('')}</div>${F.length > W.lim ? `<button type="button" class="wd-chip wd-more" data-wd="more">⬇ Aur ${num(Math.min(120, F.length - W.lim))} (kul ${num(F.length)})</button>` : ''}` : NR.length ? '' : `<p class="wd-empty">${q ? 'Is naam ka item nahi mila.' : W.f === 'nopic' ? '✅ Is rack ke sab items ki tasveer lag chuki!' : W.f === 'noph' ? '✅ Sab items kisi rack ki photo par hain!' : 'Yahan koi item nahi.'}</p>`) +
    (NR.length ? `<p class="wd-near">🤔 ${F.length ? 'Ye bhi ho sakte hain' : `"${esc(q)}" seedha nahi mila — shayad ye`}:</p><div class="wd-list">${NR.map(it => rowHTML(it, no)).join('')}</div>` : '');
  body.scrollTop = keepY;
  if (W.sel) { const n = W.sel.size, all = F.length && F.every(x => W.sel.has(x.id));
    $('wdFoot').innerHTML = `<button type="button" class="wd-chip" data-wd="selall">${all ? '☐ Koi nahi' : `☑ Sab ${num(F.length)}`}</button><button type="button" class="wd-chip" data-wd="selx">✕ Band</button><button type="button" class="wd-main" data-wd="selmv"${n ? '' : ' disabled'}>🗂 ${num(n)} → Rack</button>`; }
  else $('wdFoot').innerHTML = `<button type="button" class="wd-main" data-wd="rackpic">📷 Rack ki photo se items lagao</button>`;
  thumbs();
  const qi = $('wdQ'); if (W.qFocus && qi) { qi.focus(); const n = qi.value.length; try { qi.setSelectionRange(n, n); } catch {} }
}
function rowHTML(it, no) {
  const st = W.busy.has(it.id) || W.rkIds.has(it.id) || W.rkWait.has(it.id) ? '<span class="wd-s">⏳</span>' : W.err.has(it.id) ? `<span class="wd-s bad" title="${esc(W.err.get(it.id))}">✕</span>` : W.ok.has(it.id) ? '<span class="wd-s ok">✅</span>' : '';
  const on = W.sel && W.sel.has(it.id);
  return `<div class="wd-r${it.hide ? ' off' : ''}${W.sel ? ' sel' : ''}${on ? ' on' : ''}" data-row="${esc(it.id)}">${W.sel ? `<span class="wd-ck" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}<span class="wd-th${it.pic ? '' : ' none'}" data-th="${esc(it.id)}">${it.pic ? '' : '📷'}</span><span class="wd-n"><b>${esc(it.n)}</b><small>Rs ${num(it.r)}${it.u ? ' / ' + esc(it.u) : ''} · ${no.get(it.c) ? 'Rack ' + no.get(it.c) + ' ' : ''}${esc(rackName(it.c))}${it.c !== it.pc ? ' ✏️' : ''}${it.k !== 'n' ? ' · ' + KIND[it.k] : ''}${it.hide ? ' · 🙈 website se chhupa' : ''}</small></span>${st}${W.sel ? '' : `<button type="button" class="wd-cam" data-cam="${esc(it.id)}" aria-label="Tasveer lo">📷</button>`}</div>`;
}

// ---------- 🖼 chhoti tasveerein (sirf nazar aane wali) ----------
let thIO = null; const thQ = []; let thRun = 0;
function thumbs() {
  try { thIO && thIO.disconnect(); } catch {}
  const els = [...document.querySelectorAll('#wdDlg [data-th]')];
  els.forEach(el => { const id = el.dataset.th, c = TH.get(id); if (c && c.v === W.ph[id]) setTh(el, c.url); });
  if (!('IntersectionObserver' in window)) return;
  thIO = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const id = e.target.dataset.th; if (W && W.ph[id] && !(TH.get(id)?.v === W.ph[id]) && !thQ.includes(id)) thQ.push(id); } thPump(); }, { root: $('wdBody'), rootMargin: '200px 0px' });
  els.forEach(el => { if (W.ph[el.dataset.th]) thIO.observe(el); });
}
function setTh(el, url) { el.style.backgroundImage = `url("${url}")`; el.classList.remove('none'); el.textContent = ''; }
function thPump() {
  while (thRun < 4 && thQ.length) {
    const id = thQ.shift(); thRun++;
    const v = W?.ph[id];
    A.cloud.getWebPhoto(id).then(b => { if (b) { const url = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); TH.set(id, { v, url }); document.querySelectorAll(`#wdDlg [data-th="${CSS.escape(id)}"]`).forEach(el => setTh(el, url)); } }).catch(() => {}).finally(() => { thRun--; thPump(); });
  }
}

// ---------- ⋮ aur (sheet) ----------
function sheet(html) { $('wdSCard').innerHTML = html; $('wdSheet').hidden = false; }
function sheetClose() { $('wdSheet').hidden = true; W && (W.act = ''); }
function menuHTML() {
  const L = items() || [], rk = racksOf(L), own = A.owner();
  const ch = (on, attr, t) => `<button type="button" class="wd-chip${on ? ' is-in' : ''}" ${attr}>${t}</button>`;
  return `<h3>🌐 Website</h3><div class="wd-chips">${ch(0, 'data-wd="site"', '🌐 Website kholo')}${ch(0, 'data-wd="share"', '🔗 Link bhejo')}${ch(0, 'data-wd="copy"', '📋 Link copy')}</div>
<h3>📸 Asal rack ki photo (customer photo par cheez dabaye)</h3><div class="wd-chips">${ch(0, 'data-wd="rps"', `📸 Rack ki photos <small>${Object.keys(W.racks.rp || {}).length}</small>`)}${ch(!!W.racks.draw, 'data-wd="draw"', W.racks.draw ? '▦ Bane hue racks: ON' : '▦ Bane hue racks: Band')}</div>
<p class="wd-note">▦ Band = website par sirf asal rack ki photos + 🌾 dabbe / tore. Jo item kisi photo par nahi, wo sirf customer ke 🔍 dhoondo mein (tokri mein daal sakta hai). Koi rack photo na ho to bane hue racks khud dikhte hain (dukan khali na lage).</p>
<h3>☑ Kai items ek saath</h3><div class="wd-chips">${ch(!!W.sel, 'data-wd="sel"', W.sel ? '☑ Chunne ka mode ON — band karo' : '☑ Items chuno → ek saath rack mein')}</div>
<h3>🗂 Rack</h3><div class="wd-chips">${ch(!W.ck, 'data-ck=""', 'Sab racks')}${rk.map((r, i) => ch(W.ck === r.k, `data-ck="${esc(r.k)}"`, `${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)} <small>${r.n}</small>`)).join('')}</div>
<h3>🔎 Dikhao</h3><div class="wd-chips">${[['all', 'Sab'], ['nopic', '📷 Bina tasveer'], ['pic', '✅ Tasveer wale'], ['noph', `📸 Rack photo par nahi <small>${num(nophCount())}</small>`], ['hid', '🙈 Chhupe']].map(([k, t]) => ch(W.f === k, `data-f="${k}"`, t)).join('')}</div>
<h3>⚙️ Tarteeb</h3><div class="wd-chips">${own && A.aiText ? ch(0, 'data-wd="airk"', '🤖 Racks khud banao (AI)') : ''}${ch(0, 'data-wd="racks"', '🗂 Racks ki tarteeb')}${own ? ch(0, 'data-wd="info"', '🏪 Dukan ki maloomat') + ch(0, 'data-wd="pub"', '🔄 Rates abhi website par bhejo') : ''}</div>
<p class="wd-note">Website par sirf naam, retail rate aur tasveer jati hai — khareed / nafa kabhi nahi. Rates PC khud bhejta hai.</p>`;
}
// v2.160.0: kaun se items kisi asal rack ki photo par lage hain (bane racks band hon to baqi website ke manzar mein nahi — sirf dhoondo)
function onPhotoSet() { const S = new Set(); for (const pid of Object.keys(W.racks.rp || {})) for (const t of rpS(pid)) if (t[4]) S.add(String(t[4])); return S; }
function nophCount() { const L = items() || [], P = onPhotoSet(); return L.filter(it => !it.hide && it.k === 'n' && !P.has(it.id)).length; }
function itemSheet(id) {
  const it = (items() || []).find(x => x.id === id); if (!it) return;
  W.act = id;
  sheet(`<h3 class="wd-st">${esc(it.n)}</h3><p class="wd-note">Rs ${num(it.r)} · ${esc(rackName(it.c))}${it.pic ? ' · ✅ tasveer lagi hai' : ''}</p>
<div class="wd-chips"><button type="button" class="wd-chip" data-shot="cam">📸 Camera</button><button type="button" class="wd-chip" data-shot="gal">🖼 Gallery</button>
<button type="button" class="wd-chip" data-wd="mvrack">🗂 Rack badlo</button>
<button type="button" class="wd-chip" data-wd="hide">${it.hide ? '👁 Website par dikhao' : '🙈 Website se chhupao'}</button>
${it.pic ? '<button type="button" class="wd-chip bad" data-wd="delph">🗑 Tasveer hatao</button>' : ''}</div>
<h3>🌾 Website par kaise rakha ho?</h3><div class="wd-chips">${Object.entries(KIND).map(([k, t]) => `<button type="button" class="wd-chip${it.k === k ? ' is-in' : ''}" data-lp="${k}">${t}${it.auto === k ? ' <small>khud</small>' : ''}</button>`).join('')}</div>
<p class="wd-note">🫙 sheeshe ka dabba (dry fruit / masale) · 🧺 farsh par tora (daal / chawal / cheeni) — customer tap kar ke packet chunta hai (250 g · 1 kg … ya POS ke packet). Tasveer lagao to dabbe / tore mein wohi dikhegi.</p>`);
}
function mvSheet() {
  const id = W.act, it = (items() || []).find(x => x.id === id); if (!it) return;
  const rk = racksOf(items() || []);
  sheet(`<h3 class="wd-st">🗂 ${esc(it.n)} — kis rack par?</h3><div class="wd-chips">${rk.map(r => `<button type="button" class="wd-chip${r.k === it.c ? ' is-in' : ''}" data-mv="${esc(r.k)}">${esc(r.name)}</button>`).join('')}${it.c !== it.pc ? `<button type="button" class="wd-chip" data-mv="${esc(it.pc)}">↺ POS wala (${esc(title(it.pc))})</button>` : ''}</div>
<form class="wd-newrk" data-form="newrk"><input name="k" placeholder="Naya rack ka naam" maxlength="40"><button type="submit" class="wd-chip">＋ Naya rack</button></form>`);
}

// ---------- 📸 v2.158.0: ASAL RACK KI PHOTO — AI dabbe, malik ka naam ----------
const rpS = pid => { try { const a = JSON.parse(W.racks.rp?.[pid]?.s || '[]'); return Array.isArray(a) ? a.filter(t => Array.isArray(t) && t.length >= 4) : []; } catch { return []; } };
function rpSet(pid, arr) {
  if (!W.racks.rp[pid]) return;
  W.racks.rp[pid] = { ...W.racks.rp[pid], s: JSON.stringify(arr.map(t => { const r = [0, 1, 2, 3].map(k => Math.max(0, Math.min(1000, Math.round(Number(t[k]) || 0)))); return t[4] ? [...r, String(t[4])] : [...r, '', String(t[5] || '').slice(0, 40)]; })), at: Date.now() };
  saveRacks();
}
const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
const tks = s => nrm(s).split(' ').filter(w => w.length > 1);
function sugg(label, L) {   // AI ka label -> POS ke naam (lafz milao, size / brand) — sirf mashwara
  const lt = tks(label); if (!lt.length) return [];
  const out = [];
  for (const it of L) { const nt = tks(it.n); let sc = 0; for (const w of lt) { if (nt.includes(w)) sc += 1; else if (nt.some(t => (t.length >= 3 && w.startsWith(t)) || (w.length >= 3 && t.startsWith(w)))) sc += 0.6; } sc /= lt.length; if (sc >= 0.34) out.push([sc, it]); }
  return out.sort((a, b) => b[0] - a[0]).slice(0, 3);
}
const iou = (a, b) => { const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[0] + a[2], b[0] + b[2]), y1 = Math.min(a[1] + a[3], b[1] + b[3]); const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return i / Math.max(1, a[2] * a[3] + b[2] * b[3] - i); };
const u8b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const DET_PROMPT = 'This photo shows shelves of a Pakistani grocery / general store. Find EVERY individual retail product on the shelves: each bottle, box, packet, pouch, jar, tin or bag separately (if several identical items stand side by side, still give each clearly visible one its own box). Ignore shelf edges, price labels, walls, hands and people. For each product return box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000, and label = brand + product + size as printed on the pack, short (like "Rooh Afza 800ml", "Olpers milk 1L", "Dalda 1kg"); if unreadable give a short generic name like "red sharbat bottle". Return ONLY a JSON array: [{"box_2d":[ymin,xmin,ymax,xmax],"label":"..."}]. At most 120 products.';
function paintRps() {
  const P = Object.entries(W.racks.rp || {}).sort((a, b) => (a[1].o || 0) - (b[1].o || 0));
  $('wdStrip').innerHTML = `<span>📸 Rack ki photo lagao → 🤖 AI har cheez ke gird dabba → aap tap kar ke naam · rate POS se khud</span><span class="wd-k">${P.length} photo</span>${W.rkSt ? `<span class="wd-k">${W.rkSt === '⏳' ? '⏳ save…' : W.rkSt === '✅' ? '✅ save' : '✕ nahi hua'}</span>` : ''}`;
  $('wdBody').innerHTML = P.length ? `<div class="wd-rpl">${P.map(([pid, x]) => { const S = rpS(pid), ok = S.filter(t => t[4]).length; return `<button type="button" class="wd-rpc" data-rpo="${esc(pid)}"><span class="wd-rpt wd-th none" data-th="rp_${esc(pid)}">📸</span><span class="wd-n"><b>${esc(rackName(x.k))}</b><small>${W.busy.has('rp_' + pid) ? '⏳ photo save ho rahi hai…' : `✓ ${ok} / ${S.length} cheezon ka naam${S.length - ok ? ` · ${S.length - ok} baqi` : ''}`}</small></span><span class="wd-s">›</span></button>`; }).join('')}</div>`
    : '<p class="wd-empty">Abhi koi rack photo nahi.<br>Neeche "＋ Rack ki photo" dabayein — saamne se poora rack, roshni mein.</p>';
  $('wdFoot').innerHTML = `<button type="button" class="wd-chip${W.racks.nmOn ? ' is-in' : ''}" data-wd="nmon" title="Customer ko photo par naam">🏷 Naam: ${W.racks.nmOn ? 'ON' : 'Band'}</button><button type="button" class="wd-main" data-wd="rpadd">＋ Rack ki photo</button>`;
  thumbs();
}
function paintRpe() {
  const E = W.rpe, x = E && W.racks.rp?.[E.pid]; if (!x) { W.view = 'rps'; W.rpe = null; return paint(); }
  const S = rpS(E.pid), L = items() || [], by = new Map(L.map(i => [i.id, i])), ok = S.filter(t => t[4]).length;
  const nSug = S.filter(t => !t[4] && t[5] && (sugg(t[5], L)[0]?.[0] || 0) >= 0.67).length; E.nSug = nSug;
  $('wdStrip').innerHTML = `<span><b>${esc(rackName(x.k))}</b> · ✓ ${ok} / ${S.length} naam</span>${E.ai?.run ? '<span class="wd-k">🤖 AI cheezein dhoond rahi hai… 10–40 sec</span>' : ''}${E.ai?.err ? `<span class="wd-k bad">✕ ${esc(E.ai.err)}</span>` : ''}${E.draw ? '<span class="wd-k ok">✏️ Photo par ungli se dabba banayein</span>' : E.sel.size ? `<span class="wd-k ok">☑ ${E.sel.size} chune</span>` : '<span class="wd-dim">Dabba dabao = chuno · kai chun kar ek naam</span>'}${W.rkSt === '⏳' ? '<span class="wd-k">⏳ save…</span>' : W.rkSt === '✅' ? '<span class="wd-k ok">✅ save</span>' : ''}`;
  $('wdBody').innerHTML = `<div class="wd-pe"><div class="wd-pimg${E.draw ? ' draw' : ''}" id="wdPimg" style="aspect-ratio:${Number(x.w) || 3}/${Number(x.h) || 4}">${E.url ? `<img src="${E.url}" alt="" draggable="false">` : '<i class="wd-pw">⏳ Photo aa rahi hai…</i>'}${S.map((t, i) => { const it = t[4] ? by.get(String(t[4])) : null; return `<button type="button" class="wd-bx${t[4] ? ' ok' : ''}${E.sel.has(i) ? ' sel' : ''}${t[4] && !it ? ' gone' : ''}" data-bx="${i}" style="left:${t[0] / 10}%;top:${t[1] / 10}%;width:${t[2] / 10}%;height:${t[3] / 10}%"><i>${t[4] ? esc(it ? it.n : '⚠ stock mein nahi') : '?' + (t[5] ? ' ' + esc(t[5]) : '')}</i></button>`; }).join('')}<div class="wd-bx tmp" id="wdBxTmp" hidden></div></div></div>`;
  $('wdFoot').innerHTML = E.sel.size
    ? `<button type="button" class="wd-chip" data-wd="bxnone">☐ Chhoro</button><button type="button" class="wd-chip bad" data-wd="bxdel">✕ Hatao</button><button type="button" class="wd-main" data-wd="bxname">🏷 ${E.sel.size} → Naam</button>`
    : `${A.aiImage && A.owner() ? `<button type="button" class="wd-chip" data-wd="rpai"${E.ai?.run ? ' disabled' : ''}>🤖 AI</button>` : ''}<button type="button" class="wd-chip${E.draw ? ' is-in' : ''}" data-wd="rpdraw">✏️ Dabba</button>${nSug ? `<button type="button" class="wd-chip" data-wd="rpsug">✓ ${nSug} mashware</button>` : ''}<button type="button" class="wd-chip" data-wd="rpmore" aria-label="Aur">⋮</button><button type="button" class="wd-main" data-wd="rpdone">✓ Ho gaya</button>`;
  rpPointer();
}
function rpPointer() {
  const wrap = $('wdPimg'); if (!wrap || wrap._on) return; wrap._on = 1;
  let st = null;
  const pt = e => { const r = wrap.getBoundingClientRect(); return { x: Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000)), y: Math.max(0, Math.min(1000, (e.clientY - r.top) / r.height * 1000)) }; };   // % se — html zoom mein bhi sahi
  const box = () => { const a = st.a, b = st.b; return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y)]; };
  wrap.addEventListener('pointerdown', e => { if (!W?.rpe?.draw) return; e.preventDefault(); st = { a: pt(e), b: pt(e) }; try { wrap.setPointerCapture(e.pointerId); } catch {} });
  wrap.addEventListener('pointermove', e => { if (!st) return; st.b = pt(e); const b = box(), t = $('wdBxTmp'); if (t) { t.hidden = false; Object.assign(t.style, { left: b[0] / 10 + '%', top: b[1] / 10 + '%', width: b[2] / 10 + '%', height: b[3] / 10 + '%' }); } });
  const end = () => { if (!st) return; const b = box(); st = null; const E = W?.rpe; if (!E) return; if (b[2] < 12 || b[3] < 12) { const t = $('wdBxTmp'); if (t) t.hidden = true; return; }
    const S = rpS(E.pid); S.push([...b, '', '']); E.draw = false; E.sel = new Set([S.length - 1]); rpSet(E.pid, S); paint(); namePick(); };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', () => { st = null; });
}
function pickListHTML() {
  const L = items() || [], q = (W.rpq || '').trim();
  const F = (q ? (r => [...r.hits, ...r.near])(smartFind(L, q, it => it.n, it => it.id)) : L).slice(0, 60);
  return F.map(it => `<button type="button" class="wd-r wd-pr" data-bxit="${esc(it.id)}"><span class="wd-n"><b>${esc(it.n)}</b><small>Rs ${num(it.r)} · ${esc(rackName(it.c))}</small></span></button>`).join('') || '<p class="wd-empty">Is naam ka item nahi mila.</p>';
}
function namePick() {
  const E = W.rpe; if (!E || !E.sel.size) return;
  const S = rpS(E.pid), lab = [...E.sel].map(i => S[i]?.[5]).find(Boolean) || '', sg = lab ? sugg(lab, items() || []) : [];
  W.rpq = '';
  sheet(`<h3 class="wd-st">🏷 ${E.sel.size} dabb${E.sel.size > 1 ? 'e' : 'a'} — kaunsi cheez?</h3>${lab ? `<p class="wd-note">🤖 AI ne parha: <b>${esc(lab)}</b></p>` : ''}${sg.length ? `<div class="wd-chips">${sg.map(([, it]) => `<button type="button" class="wd-chip is-in" data-bxit="${esc(it.id)}">✓ ${esc(it.n)} <small>Rs ${num(it.r)}</small></button>`).join('')}</div>` : ''}
<label class="wd-q wd-q2"><span>🔍</span><input id="wdRQ" type="search" placeholder="Naam likhein…" autocomplete="off"></label><div class="wd-list wd-bxl">${pickListHTML()}</div>`);
}
function bxAssign(itemId) {
  const E = W.rpe; if (!E) return;
  const S = rpS(E.pid), labs = new Set(), it = (items() || []).find(x => x.id === itemId);
  for (const i of E.sel) if (S[i]) { if (!S[i][4] && S[i][5]) labs.add(nrm(S[i][5])); S[i] = [S[i][0], S[i][1], S[i][2], S[i][3], itemId]; }
  let extra = 0; if (labs.size) S.forEach((t, i) => { if (!t[4] && t[5] && labs.has(nrm(t[5]))) { S[i] = [t[0], t[1], t[2], t[3], itemId]; extra++; } });   // same label wale khud
  E.sel = new Set(); sheetClose(); rpSet(E.pid, S); paint();
  A.notice(`🏷 ${it ? it.n : itemId}${extra ? ` · 🔁 same label wale ${extra} dabbe bhi` : ''}`);
}
async function rpLoad(pid) {
  const k = 'rp_' + pid, c = TH.get(k); if (c && c.url) return c.url;
  try { const b = await A.cloud.getWebPhoto(k); if (!b) return ''; const url = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); TH.set(k, { v: W?.ph?.[k], url, b }); return url; } catch { return ''; }
}
async function rpOpen(pid) {
  W.rpe = { pid, url: TH.get('rp_' + pid)?.url || '', sel: new Set(), draw: false, ai: null }; W.view = 'rpe'; paint();
  if (!W.rpe.url) { const w = W, url = await rpLoad(pid); if (W === w && w.rpe?.pid === pid) { w.rpe.url = url; paint(); } }
}
async function rpDetect() {
  const w = W, E = w.rpe; if (!E || !A.aiImage || E.ai?.run) return;
  E.ai = { run: true }; paint();
  try {
    let bytes = TH.get('rp_' + E.pid)?.b || E.bytes; if (!bytes) bytes = await A.cloud.getWebPhoto('rp_' + E.pid); if (!bytes) throw Error('Photo nahi mili');
    const out = await A.aiImage(u8b64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), DET_PROMPT), m = String(out || '').match(/\[[\s\S]*\]/);
    let arr = []; try { arr = m ? JSON.parse(m[0]) : []; } catch {}
    if (W !== w || w.rpe !== E) return;
    const S = rpS(E.pid), add = [];
    for (const o of Array.isArray(arr) ? arr : []) {
      const b = o && (o.box_2d || o.box || o.b); if (!Array.isArray(b) || b.length < 4) continue;
      let [y0, x0, y1, x1] = b.map(Number); if (![y0, x0, y1, x1].every(Number.isFinite)) continue;
      [y0, x0, y1, x1] = [y0, x0, y1, x1].map(v => Math.max(0, Math.min(1000, v))); if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
      const nb = [x0, y0, x1 - x0, y1 - y0, '', String(o.label || o.name || '').slice(0, 40)];
      if (nb[2] < 8 || nb[3] < 8 || (nb[2] > 900 && nb[3] > 900)) continue;
      if ([...S, ...add].some(t => iou(t, nb) > 0.6)) continue;
      add.push(nb); if (S.length + add.length >= 150) break;
    }
    E.ai = { run: false, n: add.length }; rpSet(E.pid, [...S, ...add]);
    A.notice(add.length ? `🤖 ${add.length} cheezein mili — ab dabbe par tap kar ke naam lagayein` : '🤖 AI ko nayi cheez nahi mili — ✏️ Dabba se khud banayein');
  } catch (e) { E.ai = { run: false, err: e.message || String(e) }; }
  if (W === w) paint();
}
async function rpCreate(k) {
  const w = W, bm = w.rpNew; if (!bm || !k) return; w.rpNew = null; sheetClose();
  let bytes; try { bytes = await bigBytes(bm, 1600); } catch (e) { A.notice('❌ ' + (e.message || e)); return; }
  const pid = Date.now().toString(36), url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  TH.set('rp_' + pid, { v: -1, url, b: bytes });
  w.racks.rp = { ...(w.racks.rp || {}), [pid]: { k, o: Date.now(), w: bm.width || bm.naturalWidth || 3, h: bm.height || bm.naturalHeight || 4, s: '[]', at: Date.now() } };
  if (!w.racks.order.includes(k)) w.racks.order = [...racksOf(items() || []).map(r => r.k).filter(x => x !== k), k];
  saveRacks(); putPhoto('rp_' + pid, bytes, 'Rack ki photo — ' + rackName(k));
  w.rpe = { pid, url, bytes, sel: new Set(), draw: false, ai: null }; w.view = 'rpe'; paint();
  if (A.aiImage && A.owner()) rpDetect();
}
function rpRackSheet(forPid) {
  const rk = racksOf(items() || []);
  sheet(`<h3 class="wd-st">🗂 Ye kaunsa rack hai?</h3><div class="wd-chips">${rk.map((r, i) => `<button type="button" class="wd-chip" data-rpk="${esc(r.k)}"${forPid ? ` data-rpfor="${esc(forPid)}"` : ''}>${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)}</button>`).join('')}</div>
<form class="wd-newrk" data-form="rpnewrk"${forPid ? ` data-rpfor="${esc(forPid)}"` : ''}><input name="k" placeholder="Naya rack ka naam" maxlength="40"><button type="submit" class="wd-chip">＋ Naya rack</button></form>`);
}

// ---------- 🤖 v2.157.0: RACKS KHUD BANAO (AI) — malik: "AI khud categories wise laga de · shuru cosmetics / chemicals … aakhir ghee oil" ----------
const AIR = ['Cosmetics', 'Shampoo & Baal', 'Sabun', 'Daant (Paste / Brush)', 'Surf & Kapre', 'Safai / Chemicals', 'Baby', 'Tissue & Ghar ka Saman', 'Biscuit & Toffee', 'Chips & Nimko', 'Sharbat & Drinks', 'Chai & Doodh', 'Sauce & Achar', 'Masala', 'Daalein', 'Chawal, Atta & Cheeni', 'Ghee & Oil', 'Mutafarriq'];
const AI_CH = 150;
async function aiRun() {
  if (!A.aiText || !A.owner()) { A.notice('🤖 Ye sirf malik ke login par'); return; }
  const L = items(); if (!L) { A.notice('⏳ Stock abhi load nahi hua'); return; }
  const todo = L.filter(it => !W.racks.ic[it.id]);   // sirf jin ka rack haath se nahi laga (naye bhi)
  if (!todo.length) { A.notice('✅ Har item ka rack pehle se laga hai'); return; }
  const w = W, R = { run: true, n: todo.length, done: 0, map: {}, err: '' };
  w.ai = R; w.aiOpen = ''; w.view = 'ai'; sheetClose(); paint();
  const list = AIR.map((r, i) => `${i + 1}. ${r}`).join('\n');
  for (let i = 0; i < todo.length; i += AI_CH) {
    if (W !== w || w.ai !== R || !R.run) return;
    const ch = todo.slice(i, i + AI_CH), ids = new Set(ch.map(it => it.id));
    const prompt = `You sort the items of a Pakistani grocery / wholesale shop (Noor Traders) onto shop racks. For EACH item choose exactly ONE rack number from this list:\n${list}\n` +
      `Hints (common Pakistani brands): Dalda, Habib, Sufi, Eva, Kisan, Meezan = ghee/oil · Tapal, Lipton, Vital, Nescafe, Milkpak, Olpers, Tarang = chai & doodh · Shan, National, Mehran = masala · Lux, Safeguard, Lifebuoy, Dettol soap = sabun · Surf Excel, Ariel, Bonus, Brite = surf & kapre · Sunsilk, Head & Shoulders, Clear, hair oil, hair colour = shampoo & baal · Colgate, Sensodyne, Medicam = daant · Pampers, Huggies, Molfix, baby = baby · Harpic, Finis, Mortein, phenyl, bleach, dish wash = safai · Rooh Afza, Jam-e-Shirin, Pakola, juice = sharbat & drinks · Lays, Kurkure, Slanty, nimko = chips & nimko · Peek Freans, LU, Candyland, Hilal, chocolate = biscuit & toffee · cream, lotion, powder, makeup, perfume = cosmetics. ` +
      `If you are not sure, use the number of "Mutafarriq". Return ONLY a JSON array (no other text) with one object for every item: [{"i":"<id>","r":<number>}]\n` + JSON.stringify(ch.map(it => ({ i: it.id, n: it.n.slice(0, 70) })));
    try {
      const out = await A.aiText(prompt), m = String(out || '').match(/\[[\s\S]*\]/); let arr = []; try { arr = m ? JSON.parse(m[0]) : []; } catch {}
      for (const x of Array.isArray(arr) ? arr : []) { const id = String(x?.i ?? ''), r = Math.round(Number(x?.r)); if (ids.has(id) && r >= 1 && r <= AIR.length) R.map[id] = AIR[r - 1]; }
      for (const id of ids) if (!R.map[id]) R.map[id] = 'Mutafarriq';   // AI ne chhor diya = Mutafarriq
    } catch (e) { R.err = e.message || String(e); R.run = false; if (W === w) paint(); return; }
    R.done = Math.min(todo.length, i + AI_CH); if (W === w && w.ai === R) paint();
  }
  R.run = false; if (W === w && w.ai === R) paint();
}
function aiGroups() {
  const R = W.ai, by = new Map((items() || []).map(x => [x.id, x])), G = new Map(AIR.map(k => [k, []]));
  for (const [id, k] of Object.entries(R.map)) { const it = by.get(id); if (it && G.has(k)) G.get(k).push(it); }
  return [...G.entries()].filter(([, L]) => L.length);
}
function paintAi() {
  const R = W.ai; if (!R) { W.view = 'list'; return paint(); }
  const got = Object.keys(R.map).length, G = aiGroups();
  $('wdStrip').innerHTML = R.run ? `<span>🤖 AI items ke naam parh rahi hai…</span><span class="wd-k">⏳ ${num(R.done)} / ${num(R.n)}</span>`
    : R.err ? `<span class="wd-k bad">✕ ${esc(R.err)}</span>${got ? `<span>${num(got)} items ho gaye</span>` : ''}`
    : `<span><b>🤖 AI ka mashwara</b> · ${num(got)} items · ${G.length} racks</span><span class="wd-dim">✅ Lagao dabane tak website nahi badlegi</span>`;
  $('wdBody').innerHTML = (R.run && !got ? '<p class="wd-empty">⏳ AI pehle ' + num(Math.min(AI_CH, R.n)) + ' items parh rahi hai — 10-30 second…</p>' : '') +
    `<div class="wd-ail">${G.map(([k, L], i) => { const open = W.aiOpen === k; return `<button type="button" class="wd-ai${k === 'Mutafarriq' ? ' mut' : ''}${open ? ' open' : ''}" data-aio="${esc(k)}"><span class="wd-no">${k === 'Mutafarriq' ? '?' : i + 1}</span><span class="wd-ait"><b>${esc(k)} <em>${num(L.length)}</em></b><small>${esc((open ? L : L.slice(0, 6)).map(x => x.n).join(' · '))}${!open && L.length > 6 ? ` … +${num(L.length - 6)} (dabao)` : ''}</small>${k === 'Mutafarriq' ? '<small class="wd-aim">AI ko samajh nahi aaye — baad mein ☑ chuno se rack mein bhejein</small>' : ''}</span></button>`; }).join('')}</div>`;
  $('wdFoot').innerHTML = R.run ? `<button type="button" class="wd-chip" data-wd="aistop">✕ Roko</button><span class="wd-k">⏳ ${num(R.done)} / ${num(R.n)}</span>`
    : `<button type="button" class="wd-chip" data-wd="back">✕ Rehne do</button>${R.err ? '<button type="button" class="wd-chip" data-wd="airk">🔄 Dobara</button>' : ''}${got ? `<button type="button" class="wd-main" data-wd="aiok">✅ Lagao — ${num(got)} items</button>` : ''}`;
}
function aiApply() {
  const R = W.ai; if (!R || R.run) return;
  const L = items() || [], by = new Map(L.map(x => [x.id, x])); let n = 0;
  for (const [id, k] of Object.entries(R.map)) { const it = by.get(id); if (!it) continue; if (k === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = k; W.rkIds.add(id); W.ok.delete(id); W.err.delete(id); n++; }
  const used = new Set(racksOf(items() || []).map(r => r.k)), mine = (W.racks.order || []).filter(k => !AIR.includes(k) && used.has(k));
  const ai = AIR.filter(k => k !== 'Mutafarriq' && used.has(k)), gi = ai.indexOf('Ghee & Oil');
  W.racks.order = gi < 0 ? [...ai, ...mine, 'Mutafarriq'] : [...ai.slice(0, gi), ...mine, ...ai.slice(gi), 'Mutafarriq'];   // malik ke apne rack Ghee & Oil se pehle — ghee / oil aakhir mein
  for (const k of AIR) if (k !== title(k) && !W.racks.cn[k]) W.racks.cn[k] = k;   // naam jaisa likha (title() "Ka" bana deta)
  delete W.racks.cn.Mutafarriq;   // sab items wale dabbe ka purana naam ("Surf") wapas
  W.ai = null; W.view = 'list'; W.ck = ''; keep(); saveRacks();
  A.notice(`🤖 ${num(n)} items racks mein lag rahe hain ⏳`);
}

// v2.156.0: ☑ chune hue items — kis rack par?
function selMvSheet() {
  const n = W.sel ? W.sel.size : 0; if (!n) return;
  const rk = racksOf(items() || []);
  W.act = '';
  sheet(`<h3 class="wd-st">🗂 ${num(n)} items — kis rack par?</h3><div class="wd-chips">${rk.map((r, i) => `<button type="button" class="wd-chip" data-smv="${esc(r.k)}">${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)} <small>${r.n}</small></button>`).join('')}<button type="button" class="wd-chip" data-smv="@pos">↺ POS wala rack (har item ka apna)</button></div>
<h3>🌾 Ya website par kaise rakhe hon?</h3><div class="wd-chips">${Object.entries(KIND).map(([k, t]) => `<button type="button" class="wd-chip" data-slp="${k}">${t}</button>`).join('')}</div>
<form class="wd-newrk" data-form="newrk"><input name="k" placeholder="Naya rack ka naam" maxlength="40"><button type="submit" class="wd-chip">＋ Naya rack</button></form>`);
}
function lpMany(ids, k) {   // 🌾 kai items ek saath dabba / tora / shelf (khud wala = override hatao)
  const by = new Map((items() || []).map(x => [x.id, x])); let n = 0; W.racks.lp = W.racks.lp || {};
  for (const id of ids) { const it = by.get(id); if (!it) continue; if (k === it.auto) delete W.racks.lp[id]; else W.racks.lp[id] = k; W.rkIds.add(id); W.ok.delete(id); W.err.delete(id); n++; }
  if (W.sel) W.sel.clear();
  sheetClose(); saveRacks();
  A.notice(`🌾 ${num(n)} items → ${KIND[k]} ⏳`);
}
function moveMany(ids, k) {
  const L = items() || [], by = new Map(L.map(x => [x.id, x])); let n = 0;
  for (const id of ids) { const it = by.get(id); if (!it) continue; if (k === '@pos' || k === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = k; W.rkIds.add(id); W.ok.delete(id); W.err.delete(id); n++; }
  if (k !== '@pos' && !W.racks.order.includes(k)) W.racks.order = [...racksOf(L).map(r => r.k).filter(x => x !== k), k];
  if (W.sel) W.sel.clear();
  sheetClose(); saveRacks();
  A.notice(`🗂 ${num(n)} items → ${k === '@pos' ? 'POS wale rack' : rackName(k)} ⏳`);
}
// v2.156.0: 📷 rack / dukan ki ASAL tasveer (poori photo, chhoti kar ke) — website par rack ke peeche / shutter ke peeche
function bgSheet(k) {
  const id = rkPh(k), has = !!W.ph[id];
  W.act = '';
  sheet(`<h3 class="wd-st">📷 ${esc(rackName(k))} — rack ki asal tasveer</h3><p class="wd-note">Website par is rack ke peeche halki si nazar aayegi (maal us ke upar). Saamne se poora rack — roshni mein.</p>
<div class="wd-chips"><button type="button" class="wd-chip" data-bgshot="cam" data-bgk="${esc(k)}">📸 Camera</button><button type="button" class="wd-chip" data-bgshot="gal" data-bgk="${esc(k)}">🖼 Gallery</button>${has ? `<button type="button" class="wd-chip bad" data-bgdel="${esc(id)}">🗑 Tasveer hatao</button>` : ''}</div>`);
}
async function bigBytes(src, M = 1100) {
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, k = Math.min(1, M / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
  const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(src, 0, 0, cv.width, cv.height);
  const blob = q => new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(Error('Tasveer nahi bani')), 'image/jpeg', q));
  let b = await blob(0.74); if (b.size > 330000) b = await blob(0.6); if (b.size > 600000) throw Error('Tasveer bohat bari hai');
  return new Uint8Array(await b.arrayBuffer());
}
async function bgSave(id, src, label) {
  let bytes; try { bytes = await bigBytes(src); } catch (e) { A.notice('❌ ' + (e.message || e)); return; }
  putPhoto(id, bytes, label);
}

// ---------- 🗂 racks save (foran UI, server baad mein) ----------
let rkT = 0;
function saveRacks() {
  W.rkDirty = true; W.rkSt = '⏳'; paint();
  clearTimeout(rkT);
  rkT = setTimeout(async () => {
    const w = W; if (!w) return;
    const ids = [...w.rkIds]; w.rkIds.clear(); ids.forEach(id => w.rkWait.add(id));   // v2.156.0: har item ka ⏳ → ✅ / ✕
    try { await A.cloud.saveWebRacks(w.racks); w.rkSt = '✅'; ids.forEach(id => w.ok.add(id)); if (ids.length > 1) A.notice(`✅ ${num(ids.length)} items ka rack website par badal gaya`); }
    catch (e) { w.rkSt = '✕'; ids.forEach(id => w.err.set(id, 'Rack save nahi hua')); A.notice('❌ Racks save nahi hue: ' + (e.message || e)); }
    ids.forEach(id => w.rkWait.delete(id));
    w.rkDirty = false; if (W === w) paint();
  }, 500);
}
function paintRacks() {
  const L = items() || [], rk = racksOf(L);
  $('wdStrip').innerHTML = `<span>Upar wala rack website par pehle (darwaze ke paas) · ↑ ↓ tarteeb · naam badlo · 👁 chhupao · 📷 rack ki asal tasveer (🖼 = lagi hai)</span>${W.rkSt ? `<span class="wd-k">${W.rkSt === '⏳' ? '⏳ save…' : W.rkSt === '✅' ? '✅ save' : '✕ nahi hua'}</span>` : ''}`;
  $('wdBody').innerHTML = `<ol class="wd-rks">${rk.map((r, i) => `<li class="${r.off ? 'off' : ''}"><span class="wd-no">${r.off ? '🙈' : i + 1}</span><span class="wd-rkn"><input value="${esc(r.name)}" placeholder="${esc(title(r.k))}" data-rn="${esc(r.k)}" maxlength="40" aria-label="Rack ka naam"><small>POS: ${esc(r.k)} · ${r.n} items</small></span><button type="button" class="wd-chip" data-up="${esc(r.k)}" aria-label="Upar">↑</button><button type="button" class="wd-chip" data-dn="${esc(r.k)}" aria-label="Neeche">↓</button><button type="button" class="wd-chip" data-hc="${esc(r.k)}" aria-label="Chhupao">${r.off ? '👁' : '🙈'}</button><button type="button" class="wd-chip wd-bgc${W.ph[rkPh(r.k)] ? ' has' : ''}" data-rbg="${esc(r.k)}" aria-label="Rack ki asal tasveer">${W.busy.has(rkPh(r.k)) ? '⏳' : W.ph[rkPh(r.k)] ? '🖼' : '📷'}</button></li>`).join('')}</ol>`;
  $('wdFoot').innerHTML = `<button type="button" class="wd-main" data-wd="back">✓ Ho gaya</button>`;
}
function moveRack(k, d) {
  const L = items() || [], ks = racksOf(L).map(r => r.k), i = ks.indexOf(k), j = i + d;
  if (i < 0 || j < 0 || j >= ks.length) return;
  [ks[i], ks[j]] = [ks[j], ks[i]];
  W.racks.order = ks; saveRacks();
}

// ---------- 🏪 dukan ki maloomat (malik) ----------
function paintInfo() {
  const f0 = document.querySelector('#wdDlg [data-form="info"]');   // v2.156.0: likha hua (abhi save nahi) dobara paint mein na mite (jaise tasveer lagate waqt)
  const I = f0 ? { ...(W.info || {}), ...Object.fromEntries([...new FormData(f0)].map(([k, v]) => [k, String(v)])), on: !!f0.elements.on.checked } : (W.info || {});
  $('wdStrip').innerHTML = `<span>Ye sab website par sab ko nazar aata hai.</span>${W.infoSt ? `<span class="wd-k">${W.infoSt}</span>` : ''}`;
  $('wdBody').innerHTML = `<form class="wd-form" data-form="info">
<label>Dukan ka naam<input name="name" value="${esc(I.name || 'Noor Traders')}" maxlength="40"></label>
<label>Board ki neeche wali line<input name="line" value="${esc(I.line || 'Wholesale & Retail')}" maxlength="50"></label>
<label>WhatsApp number (order yahan aayenge)<input name="wa" inputmode="tel" value="${esc(I.wa || '')}" placeholder="03xx xxxxxxx" maxlength="20"></label>
<label>Pata<input name="addr" value="${esc(I.addr || '')}" maxlength="90"></label>
<label>Timing<input name="time" value="${esc(I.time || '')}" placeholder="Subah 9 se raat 10" maxlength="50"></label>
<div class="wd-two"><label>Dukan khulti hai<input type="time" name="open" value="${esc(I.open || '')}"></label><label>Band hoti hai<input type="time" name="close" value="${esc(I.close || '')}"></label></div>
<p class="wd-note">🌙 Band waqt par website par aadha shutter + "Dukan band hai — order chhor dein, khulte hi bhej denge". Dono khali = hamesha khuli.</p>
<div class="wd-shop"><span class="wd-shopt"><b>🏪 Dukan ki asal tasveer</b><small>${W.busy.has('shop') ? '⏳ save ho rahi hai…' : W.ph.shop ? '✅ lagi hai — shutter khulte hi nazar aati hai' : 'Shutter ke peeche — andar se dukan ki photo'}</small></span><button type="button" class="wd-chip" data-bgshot="cam" data-bgk="@shop">📸</button><button type="button" class="wd-chip" data-bgshot="gal" data-bgk="@shop">🖼</button>${W.ph.shop ? '<button type="button" class="wd-chip bad" data-bgdel="shop">🗑</button>' : ''}</div>
<label class="wd-tick"><input type="checkbox" name="on" ${I.on === false ? '' : 'checked'}> Online dukan chalu (band = website par "abhi band hai")</label>
<button type="submit" class="wd-main">💾 Save</button></form>`;
  $('wdFoot').innerHTML = '';
}

// ---------- ✂️ photo se items ----------
let shotFor = '';
function shoot(kind, forId) { shotFor = forId || ''; sheetClose(); $(kind === 'cam' ? 'wdCam' : 'wdGal').click(); }
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  const url = URL.createObjectURL(file); const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img;
}
async function gotFile(f) {
  if (!W) return;
  let bm; try { bm = await decode(f); } catch { A.notice('❌ Tasveer khul nahi saki'); return; }
  const w = bm.width || bm.naturalWidth, h = bm.height || bm.naturalHeight;
  if (!w || !h) { A.notice('❌ Tasveer khul nahi saki'); return; }
  if (shotFor === '@rp') { shotFor = ''; W.rpNew = bm; rpRackSheet(''); return; }   // v2.158.0: asal rack photo
  if (shotFor.startsWith('@bg:')) { const k = shotFor.slice(4); shotFor = ''; if (k === '@shop') bgSave('shop', bm, 'Dukan ki tasveer'); else bgSave(rkPh(k), bm, 'Rack ' + rackName(k)); paint(); return; }   // v2.156.0
  if (W.crop?.url) { try { URL.revokeObjectURL(W.crop.url); } catch {} }
  const one = shotFor;
  W.crop = { bm, w, h, url: URL.createObjectURL(f), box: one ? { x: w * 0.06, y: h * 0.06, w: w * 0.88, h: h * 0.88 } : { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4 }, one, done: [] };
  W.view = 'crop'; paint();
}
function paintCrop() {
  const C = W.crop; if (!C) { W.view = 'list'; return paint(); }
  const it = C.one ? (items() || []).find(x => x.id === C.one) : null;
  $('wdStrip').innerHTML = `<span>✂️ Ungli se item ke gird dabba banayein · kone khench kar chhota / bara</span>${C.done.length ? `<span class="wd-k ok">✅ Is photo se ${C.done.length}</span>` : ''}`;
  $('wdBody').innerHTML = `<div class="wd-cw" id="wdCw"><div class="wd-cimg"><img id="wdCi" src="${C.url}" alt="" draggable="false"><div class="wd-box" id="wdBox"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div></div></div>${C.done.length ? `<p class="wd-done">${C.done.map(d => `✅ ${esc(d)}`).join(' · ')}</p>` : ''}`;
  $('wdFoot').innerHTML = C.one
    ? `<button type="button" class="wd-chip" data-wd="back">✕ Rehne do</button><button type="button" class="wd-main" data-wd="cropsave">✅ Save — ${esc(it ? it.n : 'item')}</button>`
    : `<button type="button" class="wd-chip" data-wd="rackpic">🖼 Nayi photo</button><button type="button" class="wd-chip" data-wd="cropbg" title="Ye poori photo website par rack ke peeche">🗂 Rack ke peeche</button><button type="button" class="wd-main" data-wd="pick">✂️ Ye kaun sa item? ›</button>`;
  const img = $('wdCi');
  img.style.maxHeight = Math.max(220, ($('wdBody').clientHeight || 400) - 50) + 'px';   // 100dvh nahi (html zoom)
  const go = () => { boxPaint(); cropPointer(); };
  if (img.complete) go(); else img.onload = go;
}
function imgRect() { return $('wdCi')?.getBoundingClientRect(); }
function boxPaint() {
  const C = W?.crop, b = $('wdBox'); if (!C || !b) return;
  const P = (v, t) => (v / t * 100).toFixed(3) + '%';   // % — html{zoom:.92} mein px khisak jate (getBoundingClientRect ≠ style px)
  Object.assign(b.style, { left: P(C.box.x, C.w), top: P(C.box.y, C.h), width: P(C.box.w, C.w), height: P(C.box.h, C.h) });
}
function cropPointer() {
  const wrap = $('wdCw')?.querySelector('.wd-cimg'); if (!wrap || wrap._on) return; wrap._on = 1;
  let mode = '', sx = 0, sy = 0, b0 = null;
  const pt = e => { const r = imgRect(), C = W.crop, k = C.w / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
  const clamp = B => { const C = W.crop, m = Math.max(24, Math.min(C.w, C.h) * 0.03); B.w = Math.max(m, Math.min(B.w, C.w)); B.h = Math.max(m, Math.min(B.h, C.h)); B.x = Math.max(0, Math.min(B.x, C.w - B.w)); B.y = Math.max(0, Math.min(B.y, C.h - B.h)); return B; };
  wrap.addEventListener('pointerdown', e => {
    if (!W?.crop) return; e.preventDefault();
    const p = pt(e), B = W.crop.box, h = e.target.dataset && e.target.dataset.h;
    sx = p.x; sy = p.y; b0 = { ...B };
    mode = h ? h : (p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h) ? 'mv' : 'new';
    if (mode === 'new') { W.crop.box = clamp({ x: p.x, y: p.y, w: 1, h: 1 }); b0 = { x: p.x, y: p.y, w: 0, h: 0 }; boxPaint(); }
    try { wrap.setPointerCapture(e.pointerId); } catch {}
  });
  wrap.addEventListener('pointermove', e => {
    if (!mode || !W?.crop) return;
    const p = pt(e), dx = p.x - sx, dy = p.y - sy, B = { ...b0 };
    if (mode === 'mv') { B.x += dx; B.y += dy; }
    else if (mode === 'new') { B.x = Math.min(sx, p.x); B.y = Math.min(sy, p.y); B.w = Math.abs(p.x - sx); B.h = Math.abs(p.y - sy); }
    else {
      if (mode.includes('l')) { B.x += dx; B.w -= dx; } if (mode.includes('r')) B.w += dx;
      if (mode.includes('t')) { B.y += dy; B.h -= dy; } if (mode.includes('b')) B.h += dy;
      if (B.w < 0) { B.x += B.w; B.w = -B.w; } if (B.h < 0) { B.y += B.h; B.h = -B.h; }
    }
    W.crop.box = clamp(B); boxPaint();
  });
  const end = () => { mode = ''; };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
}
async function cropBytes() {
  const C = W.crop, B = C.box, M = 560, k = Math.min(1, M / Math.max(B.w, B.h));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(B.w * k)); cv.height = Math.max(1, Math.round(B.h * k));
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.imageSmoothingQuality = 'high';
  cx.drawImage(C.bm, B.x, B.y, B.w, B.h, 0, 0, cv.width, cv.height);
  const blob = q => new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(Error('Tasveer nahi bani')), 'image/jpeg', q));
  let b = await blob(0.86); if (b.size > 170000) b = await blob(0.72);
  return new Uint8Array(await b.arrayBuffer());
}
async function putPhoto(id, bytes, label) {
  const it = (items() || []).find(x => x.id === id), nm = label || (it ? it.n : id);
  W.busy.add(id); W.err.delete(id); W.ok.delete(id);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  TH.set(id, { v: -1, url });
  const w = W;
  try {
    const v = await A.cloud.putWebPhoto(id, bytes);
    TH.set(id, { v, url }); w.ok.add(id);
    A.notice('✅ Website par tasveer lag gayi — ' + nm); if (W === w && (w.view === 'racks' || w.view === 'info')) w.ph = { ...w.ph, [id]: v };
  } catch (e) { w.err.set(id, e.message || String(e)); A.notice('❌ Tasveer save nahi hui: ' + (e.message || e)); }
  finally { w.busy.delete(id); if (W === w) paintSoon(); }
}
async function cropSave(id) {
  let bytes; try { bytes = await cropBytes(); } catch (e) { A.notice('❌ ' + (e.message || e)); return; }
  const it = (items() || []).find(x => x.id === id);
  putPhoto(id, bytes);
  if (W.crop.one) { W.view = 'list'; W.crop = null; paint(); return; }
  W.crop.done.push(it ? it.n : id);
  const C = W.crop, B = C.box;
  C.box = { x: Math.min(C.w - B.w, B.x + B.w), y: B.y, w: B.w, h: B.h };   // agla item aksar daayein
  W.view = 'crop'; W.pq = ''; W.arm = ''; paint();
}

// ---------- 🔎 ye kaun sa item? (list pehle se, search, bina tasveer pehle) ----------
function paintPick() {
  const L = items() || [], rk = racksOf(L).filter(r => !r.off);
  const q = W.pq.trim(), F0 = L.filter(it => !it.hide && (!W.pck || it.c === W.pck));
  const F = q ? (r => [...r.hits, ...r.near])(smartFind(F0, q, it => it.n, it => it.id)) : F0.sort((a, b) => (a.pic - b.pic) || a.n.localeCompare(b.n));
  $('wdStrip').innerHTML = `<span>Item par dabayein — tasveer usi ki lag jayegi${W.crop?.done?.length ? ` · ✅ ${W.crop.done.length} lag chuki` : ''}</span>`;
  $('wdBody').innerHTML = `<div class="wd-pk"><img src="${W.crop?.url || ''}" alt="" id="wdPv"></div>
<label class="wd-q"><span>🔍</span><input id="wdPQ" type="search" placeholder="Naam likhein…" value="${esc(W.pq)}" autocomplete="off"></label>
<div class="wd-chips wd-row"><button type="button" class="wd-chip${!W.pck ? ' is-in' : ''}" data-pck="">Sab</button>${rk.map(r => `<button type="button" class="wd-chip${W.pck === r.k ? ' is-in' : ''}" data-pck="${esc(r.k)}">${esc(r.name)}</button>`).join('')}</div>
<div class="wd-list">${F.slice(0, 150).map(it => `<button type="button" class="wd-r wd-pr${W.arm === it.id ? ' arm' : ''}" data-pick="${esc(it.id)}"><span class="wd-th${it.pic ? '' : ' none'}" data-th="${esc(it.id)}">${it.pic ? '' : '📷'}</span><span class="wd-n"><b>${esc(it.n)}</b><small>${W.arm === it.id ? '⚠️ Tasveer pehle se hai — dobara dabayein to badal jayegi' : `Rs ${num(it.r)} · ${esc(rackName(it.c))}${it.pic ? ' · ✅ tasveer hai' : ''}`}</small></span></button>`).join('') || '<p class="wd-empty">Koi item nahi mila.</p>'}</div>`;
  $('wdFoot').innerHTML = `<button type="button" class="wd-chip" data-wd="back">‹ Dabba theek karo</button>`;
  previewCrop(); thumbs();
  const qi = $('wdPQ'); if (W.qFocus && qi) { qi.focus(); const n = qi.value.length; try { qi.setSelectionRange(n, n); } catch {} }
}
async function previewCrop() { try { const b = await cropBytes(), el = $('wdPv'); if (el) el.src = URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })); } catch {} }

// ---------- 👆 ----------
function onInput(e) {
  if (!W) return;
  if (e.target.id === 'wdQ') { W.q = e.target.value; W.lim = 120; W.qFocus = 1; clearTimeout(onInput.t); onInput.t = setTimeout(() => { paint(); W && (W.qFocus = 0); }, 140); }
  else if (e.target.id === 'wdRQ') { W.rpq = e.target.value; clearTimeout(onInput.r); onInput.r = setTimeout(() => { const l = document.querySelector('#wdDlg .wd-bxl'); if (l && W) l.innerHTML = pickListHTML(); }, 120); }
  else if (e.target.id === 'wdPQ') { W.pq = e.target.value; W.arm = ''; W.qFocus = 1; clearTimeout(onInput.t); onInput.t = setTimeout(() => { paint(); W && (W.qFocus = 0); }, 140); }
}
function onChange(e) {
  const rn = e.target.closest && e.target.closest('[data-rn]');
  if (rn && W) { const k = rn.dataset.rn, v = rn.value.trim(); if (v && v !== title(k)) W.racks.cn[k] = v; else delete W.racks.cn[k]; saveRacks(); }
}
async function onSubmit(e) {
  const f = e.target; if (!W) return;
  if (f.dataset.form === 'info') {
    e.preventDefault();
    const g = n => String(f.elements[n].value || '').trim();
    const o = { name: g('name') || 'Noor Traders', line: g('line'), wa: g('wa'), addr: g('addr'), time: g('time'), open: g('open'), close: g('close'), on: !!f.elements.on.checked };
    W.infoSt = '⏳ save…'; W.info = { ...W.info, ...o }; paint();
    try { await A.cloud.saveWebInfo(o); if (W) { W.infoSt = '✅ save ho gaya'; paint(); } A.notice('✅ Dukan ki maloomat website par'); } catch (er) { if (W) { W.infoSt = '✕ nahi hua'; paint(); } A.notice('❌ ' + (er.message || er)); }
  } else if (f.dataset.form === 'rpnewrk') {   // v2.158.0
    e.preventDefault(); const k = String(f.elements.k.value || '').trim().slice(0, 40); if (!k) return;
    if (f.dataset.rpfor) { rpMoveRack(f.dataset.rpfor, k); return; } rpCreate(k);
  } else if (f.dataset.form === 'newrk') {
    e.preventDefault();
    const k = String(f.elements.k.value || '').trim().slice(0, 40); if (!k) return;
    if (!W.act && W.sel && W.sel.size) { moveMany([...W.sel], k); return; }   // v2.156.0: ☑ kai items
    if (!W.act) return;
    W.racks.ic[W.act] = k; if (!W.racks.order.includes(k)) W.racks.order = [...racksOf(items() || []).map(r => r.k).filter(x => x !== k), k];
    sheetClose(); saveRacks();
  }
}
function rpMoveRack(pid, k) { if (!W.racks.rp?.[pid]) return; W.racks.rp[pid] = { ...W.racks.rp[pid], k }; if (!W.racks.order.includes(k)) W.racks.order = [...racksOf(items() || []).map(r => r.k).filter(x => x !== k), k]; sheetClose(); saveRacks(); paint(); A.notice('🗂 Photo ab ' + rackName(k) + ' mein'); }
async function publish() {
  const B = base(); if (!B) { A.notice('⏳ Stock abhi load nahi hua'); return; }
  const rows = B.sort((a, b) => Number(a.id) - Number(b.id)).map(m => [m.id, m.n, m.c, Math.round(m.r * 100) / 100, m.u]);
  try { await A.cloud.publishWebCat(rows); A.notice(`✅ ${num(rows.length)} items ke rates website par`); } catch (e) { A.notice('❌ ' + (e.message || e)); }
}
async function copyLink() { const url = WEB_URL(); try { await navigator.clipboard.writeText(url); A.notice('📋 Link copy ho gaya: ' + url); } catch { A.notice('🔗 ' + url); } }
async function share() {
  const url = WEB_URL(), text = `${W.info?.name || 'Noor Traders'} — online dukan: racks par ghoomein, cheez chunein, WhatsApp par order.`;
  try { if (navigator.share) { await navigator.share({ title: 'Noor Traders · Online Dukan', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); A.notice('🔗 Link copy ho gaya: ' + url); } catch { A.notice('🔗 ' + url); }
}
function onClick(e) {
  if (!W) return;
  const t = e.target, a = t.closest('[data-wd]'), k = a && a.dataset.wd;
  if (k === 'back') { webClose(); return; }
  if (k === 'menu') { sheet(menuHTML()); return; }
  if (k === 'sclose') { sheetClose(); return; }
  if (k === 'site') { window.open(WEB_URL(), '_blank', 'noopener'); return; }
  if (k === 'share') { share(); return; }
  if (k === 'copy') { sheetClose(); copyLink(); return; }
  if (k === 'airk') { sheetClose(); aiRun(); return; }   // v2.157.0
  if (k === 'rps') { sheetClose(); W.view = 'rps'; paint(); return; }   // v2.158.0: 📸 asal rack photos
  if (k === 'rpadd') { W.act = ''; sheet(`<h3 class="wd-st">📸 Rack ki asal photo</h3><p class="wd-note">Saamne se, seedha, poora rack ek photo mein — roshni mein. 🤖 AI har cheez ke gird dabba banayegi, aap naam lagayenge.</p><div class="wd-chips"><button type="button" class="wd-chip" data-rpshot="cam">📸 Camera</button><button type="button" class="wd-chip" data-rpshot="gal">🖼 Gallery</button></div>`); return; }
  if (k === 'draw') { W.racks.draw = !W.racks.draw; saveRacks(); sheetClose(); paint(); A.notice(W.racks.draw ? '▦ Website par bane hue racks ON' : '▦ Bane hue racks band — sirf asal photos + 🌾 dabbe / tore ⏳'); return; }
  if (k === 'nmon') { W.racks.nmOn = !W.racks.nmOn; saveRacks(); paint(); A.notice(W.racks.nmOn ? '🏷 Customer ko photo par naam bhi dikhega' : '🏷 Photo par sirf rate (naam nahi)'); return; }
  if (k === 'rpdraw' && W.rpe) { W.rpe.draw = !W.rpe.draw; W.rpe.sel = new Set(); paint(); return; }
  if (k === 'rpai') { rpDetect(); return; }
  if (k === 'rpdone') { W.rpe = null; W.view = 'rps'; paint(); return; }
  if (k === 'bxnone' && W.rpe) { W.rpe.sel = new Set(); paint(); return; }
  if (k === 'bxname') { namePick(); return; }
  if (k === 'bxdel' && W.rpe) { const E = W.rpe, n = E.sel.size; rpSet(E.pid, rpS(E.pid).filter((t, i) => !E.sel.has(i))); E.sel = new Set(); paint(); A.notice(`✕ ${n} dabbe hata diye`); return; }
  if (k === 'rpsug' && W.rpe) { const E = W.rpe, L = items() || [], S = rpS(E.pid); let n = 0; S.forEach((t, i) => { if (t[4] || !t[5]) return; const g = sugg(t[5], L)[0]; if (g && g[0] >= 0.67) { S[i] = [t[0], t[1], t[2], t[3], g[1].id]; n++; } }); rpSet(E.pid, S); paint(); A.notice(`✓ ${n} dabbon par AI ka mashwara laga — ghalat ho to dabba dabao aur badlo`); return; }
  if (k === 'rpmore' && W.rpe) { W.rpDelArm = 0; sheet(`<h3 class="wd-st">📸 Is photo ka</h3><div class="wd-chips"><button type="button" class="wd-chip" data-wd="rpmv">🗂 Rack badlo</button><button type="button" class="wd-chip bad" data-wd="rpdel">🗑 Photo hatao</button></div>`); return; }
  if (k === 'rpmv' && W.rpe) { rpRackSheet(W.rpe.pid); return; }
  if (k === 'rpdel' && W.rpe) { if (!W.rpDelArm) { W.rpDelArm = 1; a.textContent = '🗑 Pakka? Dobara dabayein'; return; } const pid = W.rpe.pid; sheetClose(); const rp = { ...W.racks.rp }; delete rp[pid]; W.racks.rp = rp; W.rpe = null; W.view = 'rps'; saveRacks(); A.cloud.delWebPhoto('rp_' + pid).catch(() => {}); TH.delete('rp_' + pid); paint(); A.notice('🗑 Rack ki photo hata di'); return; }
  if (k === 'aistop') { if (W.ai) { W.ai.run = false; } paint(); return; }
  if (k === 'aiok') { aiApply(); return; }
  const aio = t.closest('[data-aio]'); if (aio) { W.aiOpen = W.aiOpen === aio.dataset.aio ? '' : aio.dataset.aio; paint(); return; }
  if (k === 'sel') { W.sel = W.sel ? null : new Set(); sheetClose(); paint(); return; }   // v2.156.0: ☑ chunne ka mode
  if (k === 'selx') { W.sel = null; paint(); return; }
  if (k === 'selall') { const F = W.lastF || [], all = F.length && F.every(id => W.sel.has(id)); if (all) F.forEach(id => W.sel.delete(id)); else F.forEach(id => W.sel.add(id)); paint(); return; }
  if (k === 'selmv') { selMvSheet(); return; }
  if (k === 'cropbg') { const rk = racksOf(items() || []); sheet(`<h3 class="wd-st">🗂 Ye photo kis rack ke peeche?</h3><p class="wd-note">Poori photo website par us rack ke peeche halki si lagegi.</p><div class="wd-chips">${rk.map((r, i) => `<button type="button" class="wd-chip${W.ph[rkPh(r.k)] ? ' is-in' : ''}" data-cbg="${esc(r.k)}">${i + 1}. ${esc(r.name)}${W.ph[rkPh(r.k)] ? ' 🖼' : ''}</button>`).join('')}</div>`); return; }
  if (k === 'more') { W.lim += 120; paint(); return; }
  if (k === 'racks') { sheetClose(); W.view = 'racks'; paint(); return; }
  if (k === 'info') { sheetClose(); W.view = 'info'; paint(); return; }
  if (k === 'pub') { sheetClose(); publish(); return; }
  if (k === 'rackpic') { sheet(`<h3 class="wd-st">📷 Rack ki photo</h3><p class="wd-note">Ek photo mein kai items — har item ke gird dabba bana kar naam chunein. Qareeb se, roshni mein photo saaf aati hai.</p><div class="wd-chips"><button type="button" class="wd-chip" data-shot="cam">📸 Camera</button><button type="button" class="wd-chip" data-shot="gal">🖼 Gallery</button></div>`); W.act = ''; return; }
  if (k === 'pick') { W.view = 'pick'; W.pck = W.pck || W.ck || ''; paint(); return; }
  if (k === 'cropsave') { cropSave(W.crop.one); return; }
  if (k === 'mvrack') { mvSheet(); return; }
  if (k === 'hide') { const id = W.act; if (W.racks.hide[id]) delete W.racks.hide[id]; else W.racks.hide[id] = 1; sheetClose(); saveRacks(); return; }
  if (k === 'delph') { const id = W.act; sheetClose(); W.busy.add(id); paint(); A.cloud.delWebPhoto(id).then(() => { TH.delete(id); A.notice('🗑 Tasveer hata di'); }).catch(er => A.notice('❌ ' + (er.message || er))).finally(() => { W && W.busy.delete(id); paintSoon(); }); return; }
  const sh = t.closest('[data-shot]'); if (sh) { shoot(sh.dataset.shot, W.act); return; }
  const rs2 = t.closest('[data-rpshot]'); if (rs2) { shoot(rs2.dataset.rpshot, '@rp'); return; }   // v2.158.0
  const rpk = t.closest('[data-rpk]'); if (rpk) { if (rpk.dataset.rpfor) rpMoveRack(rpk.dataset.rpfor, rpk.dataset.rpk); else rpCreate(rpk.dataset.rpk); return; }
  const rpo = t.closest('[data-rpo]'); if (rpo) { rpOpen(rpo.dataset.rpo); return; }
  const bx = t.closest('[data-bx]'); if (bx && W.rpe && !W.rpe.draw) { const i = Number(bx.dataset.bx), E = W.rpe; if (E.sel.has(i)) E.sel.delete(i); else E.sel.add(i); paint(); return; }
  const bxit = t.closest('[data-bxit]'); if (bxit) { bxAssign(bxit.dataset.bxit); return; }
  const smv = t.closest('[data-smv]'); if (smv) { if (W.sel && W.sel.size) moveMany([...W.sel], smv.dataset.smv); return; }   // v2.156.0
  const rbg = t.closest('[data-rbg]'); if (rbg) { bgSheet(rbg.dataset.rbg); return; }
  const bs = t.closest('[data-bgshot]'); if (bs) { shoot(bs.dataset.bgshot, '@bg:' + bs.dataset.bgk); return; }
  const bd = t.closest('[data-bgdel]'); if (bd) { const id = bd.dataset.bgdel; sheetClose(); W.busy.add(id); paint(); A.cloud.delWebPhoto(id).then(() => { if (W) W.ph = Object.fromEntries(Object.entries(W.ph).filter(([x]) => x !== id)); A.notice('🗑 Tasveer hata di'); }).catch(er => A.notice('❌ ' + (er.message || er))).finally(() => { W && W.busy.delete(id); paintSoon(); }); return; }
  const cbg = t.closest('[data-cbg]'); if (cbg && W.crop) { const k = cbg.dataset.cbg; sheetClose(); bgSave(rkPh(k), W.crop.bm, 'Rack ' + rackName(k)); return; }
  const cam = t.closest('[data-cam]'); if (cam) { W.act = cam.dataset.cam; sheet(`<h3 class="wd-st">📷 Tasveer</h3><div class="wd-chips"><button type="button" class="wd-chip" data-shot="cam">📸 Camera</button><button type="button" class="wd-chip" data-shot="gal">🖼 Gallery</button></div>`); return; }
  const ck = t.closest('[data-ck]'); if (ck) { W.ck = ck.dataset.ck; W.lim = 120; keep(); sheetClose(); paint(); return; }
  const f = t.closest('[data-f]'); if (f) { W.f = f.dataset.f; W.lim = 120; keep(); sheetClose(); paint(); return; }
  const pck = t.closest('[data-pck]'); if (pck) { W.pck = pck.dataset.pck; W.arm = ''; paint(); return; }
  const pk = t.closest('[data-pick]'); if (pk) { const id = pk.dataset.pick; if (W.ph[id] && W.arm !== id) { W.arm = id; paint(); return; } W.arm = ''; cropSave(id); return; }
  const lpb = t.closest('[data-lp]'); if (lpb) { const id = W.act; if (id) lpMany([id], lpb.dataset.lp); return; }
  const slp = t.closest('[data-slp]'); if (slp) { if (W.sel && W.sel.size) lpMany([...W.sel], slp.dataset.slp); return; }
  const mv = t.closest('[data-mv]'); if (mv) { const id = W.act, it = (items() || []).find(x => x.id === id); if (it) { if (mv.dataset.mv === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = mv.dataset.mv; } sheetClose(); saveRacks(); return; }
  const up = t.closest('[data-up]'); if (up) { moveRack(up.dataset.up, -1); return; }
  const dn = t.closest('[data-dn]'); if (dn) { moveRack(dn.dataset.dn, 1); return; }
  const hc = t.closest('[data-hc]'); if (hc) { const kk = hc.dataset.hc; if (W.racks.hc[kk]) delete W.racks.hc[kk]; else W.racks.hc[kk] = 1; saveRacks(); return; }
  const row = t.closest('[data-row]'); if (row && W.view === 'list') { if (W.sel) { const id = row.dataset.row; if (W.sel.has(id)) W.sel.delete(id); else W.sel.add(id); paint(); return; } itemSheet(row.dataset.row); return; }
}
addEventListener('resize', () => { if (W && W.view === 'crop') boxPaint(); });
