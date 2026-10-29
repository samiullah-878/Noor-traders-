// web-dukan.js — v2.148.0 (30 Oct 2026): 🏪 ONLINE DUKAN — app ka screen (malik + Full mulazim, CAP v:web OPT_IN)
//   Malik: "pictures hum lagayenge aur list se naam select karenge · racks category-wise (shuru cosmetics … aakhir ghee/oil)".
//   ① 📷 Rack ki photo (camera / gallery) → ungli se item ke gird dabba → list (pehle se nazar, search, bina tasveer pehle) se naam → ✅
//      wahi photo se agla item (ek photo, kai items). Item ki line ka 📷 = seedha usi item ki photo.
//   ② 🗂 Racks ki tarteeb (↑ ↓, naam, chhupao) · item ka rack badlo / website se chhupao · 🏪 dukan ki maloomat (malik: WhatsApp, pata, timing).
//   Data (cloud.js): webDukan/racks · phIdx · ph_<id> (JPEG ≤ 560 px) · info (malik) · cat (PC sync-stock v3; malik ka 🔄 fallback).
//   AI NAHI — naam insaan chunta hai. Website: dukan/ (sab dekh sakte, sirf naam / retail rate / tasveer).
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const title = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
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
  return { cat: {}, info: {}, racks: { order: [], cn: {}, hc: {}, hide: {}, ic: {} }, ph: {}, got: {}, q: '', ck: pref.ck || '', f: pref.f || 'all', lim: 120, view: 'list', busy: new Set(), ok: new Set(), err: new Map(), crop: null, pq: '', pck: '', arm: '', act: '', rkSt: '', infoSt: '' };
}

// ---------- 📦 items (POS stock → website wali list) ----------
function base() {
  const st = A.stock(); if (!st || !st.loaded) return null;
  const names = st.names || {}, bs = st.branches || [];
  const shopB = bs.find(b => /noor/i.test(String(names[b] || ''))) ?? (bs.includes(1) ? 1 : bs[0]);
  const band = st.hidden || {}, M = new Map();
  for (const b of bs) for (const r of st.itemsFor(b)) {
    const k = String(r.id); let m = M.get(k);
    if (!m) { m = { id: r.id, n: String(r.name || '').trim(), c: r.cat || '', r: 0, u: r.uName || 'Pcs', s: 0, shop: false }; M.set(k, m); }
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
  return B.map(m => { const id = String(m.id), pc = String(m.c || '').trim() || 'Mutafarriq'; return { id, n: m.n, pc, c: String(R.ic[id] || '') || pc, r: Math.round(m.r * 100) / 100, u: m.u, hide: !!R.hide[id], pic: !!W.ph[id] }; });
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
    else if (k === 'racks' && !W.rkDirty) W.racks = { order: Array.isArray(v?.order) ? v.order : [], cn: v?.cn || {}, hc: v?.hc || {}, hide: v?.hide || {}, ic: v?.ic || {} };
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
  if (W.view === 'pick') { W.view = 'crop'; paint(); return true; }
  if (W.view !== 'list') { W.view = 'list'; W.crop = null; paint(); return true; }
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
  $('wdT').textContent = v === 'crop' ? '✂️ Photo se items' : v === 'pick' ? '🔎 Ye kaun sa item?' : v === 'racks' ? '🗂 Racks ki tarteeb' : v === 'info' ? '🏪 Dukan ki maloomat' : '🏪 Online Dukan';
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
  return `<span><b>${esc(rk)}</b> · ${esc(F)}</span><span class="wd-k">🌐 ${num(all.length)} items · 📷 ${num(pics)}</span><span class="wd-k ${old ? 'bad' : ''}" title="Website par rates">🕘 ${catAt ? ago(catAt) : 'website list nahi'}</span><span class="wd-dim">⋮ se badlein</span>`;
}
function paintList() {
  const L = items();
  if (!L) { $('wdStrip').innerHTML = '<span>⏳ Items load ho rahe hain…</span>'; $('wdBody').innerHTML = '<p class="wd-empty">Stock aa raha hai…</p>'; $('wdFoot').innerHTML = ''; return; }
  $('wdStrip').innerHTML = stripHTML(L);
  const q = W.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rk = racksOf(L), no = new Map(rk.filter(r => !r.off).map((r, i) => [r.k, i + 1]));
  let F = L.filter(it => (!W.ck || it.c === W.ck) && (W.f === 'all' || (W.f === 'nopic' && !it.pic && !it.hide) || (W.f === 'pic' && it.pic) || (W.f === 'hid' && it.hide)) && (!q.length || q.every(w => (it.n + ' ' + it.c).toLowerCase().includes(w))));
  F.sort((a, b) => ((no.get(a.c) || 999) - (no.get(b.c) || 999)) || a.n.localeCompare(b.n));
  const body = $('wdBody'), keepY = body.scrollTop;
  body.innerHTML = `<label class="wd-q"><span>🔍</span><input id="wdQ" type="search" placeholder="Item dhoondo…" value="${esc(W.q)}" autocomplete="off"></label>` +
    (F.length ? `<div class="wd-list">${F.slice(0, W.lim).map(it => rowHTML(it, no)).join('')}</div>${F.length > W.lim ? `<button type="button" class="wd-chip wd-more" data-wd="more">⬇ Aur ${num(Math.min(120, F.length - W.lim))} (kul ${num(F.length)})</button>` : ''}` : `<p class="wd-empty">${q.length ? 'Is naam ka item nahi mila.' : W.f === 'nopic' ? '✅ Is rack ke sab items ki tasveer lag chuki!' : 'Yahan koi item nahi.'}</p>`);
  body.scrollTop = keepY;
  $('wdFoot').innerHTML = `<button type="button" class="wd-main" data-wd="rackpic">📷 Rack ki photo se items lagao</button>`;
  thumbs();
  const qi = $('wdQ'); if (W.qFocus && qi) { qi.focus(); const n = qi.value.length; try { qi.setSelectionRange(n, n); } catch {} }
}
function rowHTML(it, no) {
  const st = W.busy.has(it.id) ? '<span class="wd-s">⏳</span>' : W.err.has(it.id) ? `<span class="wd-s bad" title="${esc(W.err.get(it.id))}">✕</span>` : W.ok.has(it.id) ? '<span class="wd-s ok">✅</span>' : '';
  return `<div class="wd-r${it.hide ? ' off' : ''}" data-row="${esc(it.id)}"><span class="wd-th${it.pic ? '' : ' none'}" data-th="${esc(it.id)}">${it.pic ? '' : '📷'}</span><span class="wd-n"><b>${esc(it.n)}</b><small>Rs ${num(it.r)}${it.u ? ' / ' + esc(it.u) : ''} · ${no.get(it.c) ? 'Rack ' + no.get(it.c) + ' ' : ''}${esc(rackName(it.c))}${it.c !== it.pc ? ' ✏️' : ''}${it.hide ? ' · 🙈 website se chhupa' : ''}</small></span>${st}<button type="button" class="wd-cam" data-cam="${esc(it.id)}" aria-label="Tasveer lo">📷</button></div>`;
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
  return `<h3>🌐 Website</h3><div class="wd-chips">${ch(0, 'data-wd="site"', '🌐 Website kholo')}${ch(0, 'data-wd="share"', '🔗 Link bhejo')}</div>
<h3>🗂 Rack</h3><div class="wd-chips">${ch(!W.ck, 'data-ck=""', 'Sab racks')}${rk.map((r, i) => ch(W.ck === r.k, `data-ck="${esc(r.k)}"`, `${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)} <small>${r.n}</small>`)).join('')}</div>
<h3>🔎 Dikhao</h3><div class="wd-chips">${[['all', 'Sab'], ['nopic', '📷 Bina tasveer'], ['pic', '✅ Tasveer wale'], ['hid', '🙈 Chhupe']].map(([k, t]) => ch(W.f === k, `data-f="${k}"`, t)).join('')}</div>
<h3>⚙️ Tarteeb</h3><div class="wd-chips">${ch(0, 'data-wd="racks"', '🗂 Racks ki tarteeb')}${own ? ch(0, 'data-wd="info"', '🏪 Dukan ki maloomat') + ch(0, 'data-wd="pub"', '🔄 Rates abhi website par bhejo') : ''}</div>
<p class="wd-note">Website par sirf naam, retail rate aur tasveer jati hai — khareed / nafa kabhi nahi. Rates PC khud bhejta hai.</p>`;
}
function itemSheet(id) {
  const it = (items() || []).find(x => x.id === id); if (!it) return;
  W.act = id;
  sheet(`<h3 class="wd-st">${esc(it.n)}</h3><p class="wd-note">Rs ${num(it.r)} · ${esc(rackName(it.c))}${it.pic ? ' · ✅ tasveer lagi hai' : ''}</p>
<div class="wd-chips"><button type="button" class="wd-chip" data-shot="cam">📸 Camera</button><button type="button" class="wd-chip" data-shot="gal">🖼 Gallery</button>
<button type="button" class="wd-chip" data-wd="mvrack">🗂 Rack badlo</button>
<button type="button" class="wd-chip" data-wd="hide">${it.hide ? '👁 Website par dikhao' : '🙈 Website se chhupao'}</button>
${it.pic ? '<button type="button" class="wd-chip bad" data-wd="delph">🗑 Tasveer hatao</button>' : ''}</div>`);
}
function mvSheet() {
  const id = W.act, it = (items() || []).find(x => x.id === id); if (!it) return;
  const rk = racksOf(items() || []);
  sheet(`<h3 class="wd-st">🗂 ${esc(it.n)} — kis rack par?</h3><div class="wd-chips">${rk.map(r => `<button type="button" class="wd-chip${r.k === it.c ? ' is-in' : ''}" data-mv="${esc(r.k)}">${esc(r.name)}</button>`).join('')}${it.c !== it.pc ? `<button type="button" class="wd-chip" data-mv="${esc(it.pc)}">↺ POS wala (${esc(title(it.pc))})</button>` : ''}</div>
<form class="wd-newrk" data-form="newrk"><input name="k" placeholder="Naya rack ka naam" maxlength="40"><button type="submit" class="wd-chip">＋ Naya rack</button></form>`);
}

// ---------- 🗂 racks save (foran UI, server baad mein) ----------
let rkT = 0;
function saveRacks() {
  W.rkDirty = true; W.rkSt = '⏳'; paint();
  clearTimeout(rkT);
  rkT = setTimeout(async () => {
    const w = W; if (!w) return;
    try { await A.cloud.saveWebRacks(w.racks); w.rkSt = '✅'; } catch (e) { w.rkSt = '✕'; A.notice('❌ Racks save nahi hue: ' + (e.message || e)); }
    w.rkDirty = false; if (W === w) paint();
  }, 500);
}
function paintRacks() {
  const L = items() || [], rk = racksOf(L);
  $('wdStrip').innerHTML = `<span>Upar wala rack website par pehle (darwaze ke paas) · ↑ ↓ tarteeb · naam badlo · 👁 chhupao</span>${W.rkSt ? `<span class="wd-k">${W.rkSt === '⏳' ? '⏳ save…' : W.rkSt === '✅' ? '✅ save' : '✕ nahi hua'}</span>` : ''}`;
  $('wdBody').innerHTML = `<ol class="wd-rks">${rk.map((r, i) => `<li class="${r.off ? 'off' : ''}"><span class="wd-no">${r.off ? '🙈' : i + 1}</span><span class="wd-rkn"><input value="${esc(r.name)}" placeholder="${esc(title(r.k))}" data-rn="${esc(r.k)}" maxlength="40" aria-label="Rack ka naam"><small>POS: ${esc(r.k)} · ${r.n} items</small></span><button type="button" class="wd-chip" data-up="${esc(r.k)}" aria-label="Upar">↑</button><button type="button" class="wd-chip" data-dn="${esc(r.k)}" aria-label="Neeche">↓</button><button type="button" class="wd-chip" data-hc="${esc(r.k)}" aria-label="Chhupao">${r.off ? '👁' : '🙈'}</button></li>`).join('')}</ol>`;
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
  const I = W.info || {};
  $('wdStrip').innerHTML = `<span>Ye sab website par sab ko nazar aata hai.</span>${W.infoSt ? `<span class="wd-k">${W.infoSt}</span>` : ''}`;
  $('wdBody').innerHTML = `<form class="wd-form" data-form="info">
<label>Dukan ka naam<input name="name" value="${esc(I.name || 'Noor Traders')}" maxlength="40"></label>
<label>Board ki neeche wali line<input name="line" value="${esc(I.line || 'Wholesale & Retail')}" maxlength="50"></label>
<label>WhatsApp number (order yahan aayenge)<input name="wa" inputmode="tel" value="${esc(I.wa || '')}" placeholder="03xx xxxxxxx" maxlength="20"></label>
<label>Pata<input name="addr" value="${esc(I.addr || '')}" maxlength="90"></label>
<label>Timing<input name="time" value="${esc(I.time || '')}" placeholder="Subah 9 se raat 10" maxlength="50"></label>
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
    : `<button type="button" class="wd-chip" data-wd="rackpic">🖼 Nayi photo</button><button type="button" class="wd-main" data-wd="pick">✂️ Ye kaun sa item? ›</button>`;
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
async function putPhoto(id, bytes) {
  const it = (items() || []).find(x => x.id === id), nm = it ? it.n : id;
  W.busy.add(id); W.err.delete(id); W.ok.delete(id);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  TH.set(id, { v: -1, url });
  const w = W;
  try {
    const v = await A.cloud.putWebPhoto(id, bytes);
    TH.set(id, { v, url }); w.ok.add(id);
    A.notice('✅ Website par tasveer lag gayi — ' + nm);
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
  const q = W.pq.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const F = L.filter(it => !it.hide && (!W.pck || it.c === W.pck) && (!q.length || q.every(w => it.n.toLowerCase().includes(w)))).sort((a, b) => (a.pic - b.pic) || a.n.localeCompare(b.n));
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
    const o = { name: g('name') || 'Noor Traders', line: g('line'), wa: g('wa'), addr: g('addr'), time: g('time'), on: !!f.elements.on.checked };
    W.infoSt = '⏳ save…'; W.info = { ...W.info, ...o }; paint();
    try { await A.cloud.saveWebInfo(o); if (W) { W.infoSt = '✅ save ho gaya'; paint(); } A.notice('✅ Dukan ki maloomat website par'); } catch (er) { if (W) { W.infoSt = '✕ nahi hua'; paint(); } A.notice('❌ ' + (er.message || er)); }
  } else if (f.dataset.form === 'newrk') {
    e.preventDefault();
    const k = String(f.elements.k.value || '').trim().slice(0, 40); if (!k || !W.act) return;
    W.racks.ic[W.act] = k; if (!W.racks.order.includes(k)) W.racks.order = [...racksOf(items() || []).map(r => r.k).filter(x => x !== k), k];
    sheetClose(); saveRacks();
  }
}
async function publish() {
  const B = base(); if (!B) { A.notice('⏳ Stock abhi load nahi hua'); return; }
  const rows = B.sort((a, b) => Number(a.id) - Number(b.id)).map(m => [m.id, m.n, m.c, Math.round(m.r * 100) / 100, m.u]);
  try { await A.cloud.publishWebCat(rows); A.notice(`✅ ${num(rows.length)} items ke rates website par`); } catch (e) { A.notice('❌ ' + (e.message || e)); }
}
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
  const cam = t.closest('[data-cam]'); if (cam) { W.act = cam.dataset.cam; sheet(`<h3 class="wd-st">📷 Tasveer</h3><div class="wd-chips"><button type="button" class="wd-chip" data-shot="cam">📸 Camera</button><button type="button" class="wd-chip" data-shot="gal">🖼 Gallery</button></div>`); return; }
  const ck = t.closest('[data-ck]'); if (ck) { W.ck = ck.dataset.ck; W.lim = 120; keep(); sheetClose(); paint(); return; }
  const f = t.closest('[data-f]'); if (f) { W.f = f.dataset.f; W.lim = 120; keep(); sheetClose(); paint(); return; }
  const pck = t.closest('[data-pck]'); if (pck) { W.pck = pck.dataset.pck; W.arm = ''; paint(); return; }
  const pk = t.closest('[data-pick]'); if (pk) { const id = pk.dataset.pick; if (W.ph[id] && W.arm !== id) { W.arm = id; paint(); return; } W.arm = ''; cropSave(id); return; }
  const mv = t.closest('[data-mv]'); if (mv) { const id = W.act, it = (items() || []).find(x => x.id === id); if (it) { if (mv.dataset.mv === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = mv.dataset.mv; } sheetClose(); saveRacks(); return; }
  const up = t.closest('[data-up]'); if (up) { moveRack(up.dataset.up, -1); return; }
  const dn = t.closest('[data-dn]'); if (dn) { moveRack(dn.dataset.dn, 1); return; }
  const hc = t.closest('[data-hc]'); if (hc) { const kk = hc.dataset.hc; if (W.racks.hc[kk]) delete W.racks.hc[kk]; else W.racks.hc[kk] = 1; saveRacks(); return; }
  const row = t.closest('[data-row]'); if (row && W.view === 'list') { itemSheet(row.dataset.row); return; }
}
addEventListener('resize', () => { if (W && W.view === 'crop') boxPaint(); });
