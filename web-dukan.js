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
import { kindOf, KHK, KH_NAME, netQuery, szW, rackCols, rackRowsOf, trimUrl, dherN, dherHTML, RK_RA, RK_ROWS, RK_K, rkImgU, sizeOf, itemU, rackLayoutU, imgAr } from './dukan/khula.js?v=2.275.0';
import { smartFind } from './dukan/dhoond.js?v=2.275.0';   // v2.160.0: 🔍 smart dhoondo (website ke saath EK qaida)
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
const WD_ON = 'sam-wd-open';   // v2.269.0: khirki khuli hai (app refresh / dobara khulne par wapas yahin)
const pref = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } })();
const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ ck: W?.ck || '', f: W?.f || 'all' })); } catch {} };
export const WEB_URL = () => new URL('dukan/', location.href.split('#')[0].replace(/[^/]*$/, '')).href;

let A = null;   // {cloud, stock, owner, notice}
let W = null;   // screen ki haalat
let un = null;  // Firestore listeners
// v2.275.0 (malik 13 Nov: "dukan ke orders par WhatsApp Business number add kar do"): website ke order ka number = dukan ka Business number (blueAccess/waLinkOut.me, PC wa-out likhta hai).
//   EK dafa khud (info.waAuto = jo number laga) — malik baad mein haath se koi aur number likhe to dobara nahi badalta. Sirf malik ke login par (waLinkOut sirf malik parhta hai).
let bizUn = null;
const waDig = x => { let d = String(x || '').replace(/\D/g, ''); if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2); return d; };
function bizWaApply() {
  const w = W, me = w && w.bizWa; if (!me || w.got.info !== 1 || w.bizBusy) return;
  const I = w.info || {}; if (I.waAuto === me) return;
  const o = { ...I, wa: me, waAuto: me }; delete o.at; delete o.by; if (!o.name) o.name = 'Noor Traders'; if (o.on === undefined) o.on = true;
  const was = waDig(I.wa); w.bizBusy = 1; w.info = { ...I, wa: me, waAuto: me };
  A.cloud.saveWebInfo(o).then(() => { if (was !== me) A.notice('✅ Website ke order ab dukan ke Business number par: ' + me); }).catch(e => { if (W === w) w.info = I; console.warn('biz wa', e); }).finally(() => { w.bizBusy = 0; });
}
function bizWaWatch() {
  if (bizUn || !A.owner() || !A.cloud.listenWaLinkOut) return;
  try { bizUn = A.cloud.listenWaLinkOut((d, e) => { if (e || !W || !d) return; const me = waDig(d.me); if (/^03\d{9}$/.test(me)) { W.bizWa = me; bizWaApply(); } }); } catch {}
}
const TH = new Map();   // id -> {v, url} chhoti tasveer (phone ki memory)

function fresh() {
  return { cat: {}, info: {}, racks: { order: [], cn: {}, hc: {}, hide: {}, ic: {}, rp: {}, nmOn: false, lp: {}, draw: false, cr: {}, sn: {}, sz: {}, rn: {}, sh: {}, dh: {}, ar: {} }, ph: {}, got: {}, q: '', ck: pref.ck || '', f: pref.f || 'all', lim: 120, view: 'list', busy: new Set(), ok: new Set(), err: new Map(), crop: null, pq: '', pck: '', arm: '', act: '', rkSt: '', infoSt: '', sel: null, ai: null, aiOpen: '', rpe: null, rpq: '', rpNew: null, rpDelArm: 0, lastF: [], rkIds: new Set(), rkWait: new Set() };
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
    if (!m.sb && Array.isArray(r.sb) && r.sb.length) m.sb = r.sb;   // v2.177.0: website ke packet (publish)
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
  const P = onPhotoSet();   // rack photo par laga item = photo par hi (dabba / tora nahi) — website jaisa
  return B.map(m => { const id = String(m.id), pc = String(m.c || '').trim() || 'Mutafarriq'; const o = { id, n: m.n, pc, c: String(R.ic[id] || '') || pc, r: Math.round(m.r * 100) / 100, u: m.u, pk: m.pk || [], hide: !!R.hide[id], pic: !!W.ph[id] };
    o.auto = P.has(id) ? 'n' : kindOf(o, null); o.k = P.has(id) ? 'n' : kindOf(o, R.lp); if (o.k !== 'n') o.c = KHK; return o; });   // v2.160.0: 🌾 dabbe / tore = alag section
}
function racksOf(L) {
  const R = W.racks, cnt = new Map();
  for (const it of L) cnt.set(it.c, (cnt.get(it.c) || 0) + (it.hide ? 0 : 1));
  for (const k of R.order || []) if (!cnt.has(k)) cnt.set(k, 0);
  const pos = k => { const i = (R.order || []).indexOf(k); return i < 0 ? (k === KHK ? -1 : 1e9) : i; };   // 🌾 section shuru mein (website jaisa)
  return [...cnt.keys()].sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b)).map(k => ({ k, name: rackName(k), n: cnt.get(k), off: !!R.hc[k] }));
}
const rackName = k => String(W.racks.cn[k] || '').trim() || (k === KHK ? KH_NAME : title(k));

// ---------- 🪟 khirki ----------
export function webOpen(ctx, back) {
  A = ctx; W = fresh();
  if (back && back.v === 'racks') W.view = 'racks'; else if (back && back.v === 'rsz' && back.k) { W.view = 'rsz'; W.rz = { k: String(back.k) }; }   // v2.269.0: app dobara khuli = wahin wapas
  let d = $('wdDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'wdDlg'; d.className = 'wd';
    d.innerHTML = `<div class="wd-in"><header class="wd-h"><button type="button" class="wd-x" data-wd="back" aria-label="Wapas">‹</button><b id="wdT">🏪 Online Dukan</b><button type="button" class="wd-x wd-site" data-wd="site" aria-label="Website kholo" title="Website kholo">🌐</button><button type="button" class="wd-x" data-wd="menu" aria-label="Aur">⋮</button></header><div class="wd-strip" id="wdStrip"></div><div class="wd-body" id="wdBody"></div><footer class="wd-f" id="wdFoot"></footer><div class="wd-sheet" id="wdSheet" hidden><div class="wd-sbg" data-wd="sclose"></div><div class="wd-scard" id="wdSCard"></div></div><input type="file" accept="image/*" capture="environment" hidden id="wdCam"><input type="file" accept="image/*" hidden id="wdGal"><input type="file" accept="image/*" multiple hidden id="wdMulti"></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', onClick);
    d.addEventListener('input', onInput);
    d.addEventListener('change', onChange);
    d.addEventListener('cancel', e => { e.preventDefault(); webClose(); });
    d.addEventListener('close', () => { if (!W) return; try { d.showModal(); } catch {} webClose(); });   // v2.267.1: phone ka back browser khud khirki band kar deta tha (cancel rok nahi sakte) — wapas khol kar sirf EK qadam
    d.addEventListener('submit', onSubmit);
    $('wdMulti').addEventListener('change', e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) gotMulti(fs); });
    ['wdCam', 'wdGal'].forEach(k => $(k).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) gotFile(f); }));
  }
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
  if (un) { try { un(); } catch {} }
  un = A.cloud.listenWebDukan((k, v, e) => {
    if (!W) return;
    if (e) { W.got[k] = 'err'; paint(); return; }
    W.got[k] = 1;
    if (k === 'cat') W.cat = v || {};
    else if (k === 'info') { W.info = v || {}; bizWaApply(); }
    else if (k === 'phIdx') W.ph = (v && v.m) || {};
    else if (k === 'racks' && !W.rkDirty) W.racks = { order: Array.isArray(v?.order) ? v.order : [], cn: v?.cn || {}, hc: v?.hc || {}, hide: v?.hide || {}, ic: v?.ic || {}, rp: v?.rp || {}, nmOn: !!v?.nmOn, lp: v?.lp || {}, draw: !!v?.draw, cr: v?.cr || {}, sn: v?.sn || {}, sz: v?.sz || {}, rn: v?.rn || {}, sh: v?.sh || {}, dh: v?.dh || {}, ar: v?.ar || {} };
    paintSoon();
  });
  paint();
  waitStock();
  bizWaWatch();
}
let wsT = 0;
function waitStock() { clearTimeout(wsT); let n = 0; const t = () => { if (!W) return; const st = A.stock(); if (st && st.loaded) { paint(); return; } if (++n < 90) wsT = setTimeout(t, 1000); }; wsT = setTimeout(t, 600); }
// phone ka back / Esc: pehle andar ka qadam, phir band (app.js popstate → window.ntWebClose)
export function webClose() {
  const d = $('wdDlg'); if (!d || !d.open || !W) return false;
  if (!$('wdSheet').hidden) { sheetClose(); return true; }
  if (W.sel && W.view === 'list') { W.sel = null; paint(); return true; }   // v2.156.0: back = chunne ka mode band
  if (W.view === 'rpe') { if (W.rpe?.draw || W.rpe?.sel?.size) { W.rpe.draw = false; W.rpe.sel = new Set(); } else { W.rpe = null; W.view = 'rps'; } paint(); return true; }   // v2.158.0
  if (W.view === 'multi') { if (W.multi?.rows?.length && !W.multi.saving && !confirm('Yeh tasveerein chhor dein? (save nahi hui)')) return true; W.multi = null; W.view = 'list'; paint(); return true; }
  if (W.view === 'crop' && W.crop && W.crop.back === 'rsz' && W.rz) { W.crop = null; W.rz.pend = ''; W.view = 'rsz'; paint(); return true; }   // v2.272.0: rack ke size se aayi crop = wapas wahin
  if (W.view === 'rsz') { if (W.rz && W.rz.it) { W.rz.it = ''; paint(); return true; } const fr = W.rz && W.rz.from; W.rz = null; W.view = fr === 'racks' ? 'racks' : 'list'; paint(); return true; }
  if (W.view === 'pick') { W.view = 'crop'; paint(); return true; }
  if (W.view !== 'list') { if (W.ai) W.ai.run = false; W.ai = null; W.view = 'list'; W.crop = null; paint(); return true; }
  try { d.close(); } catch { d.removeAttribute('open'); }
  if (un) { try { un(); } catch {} un = null; }
  if (bizUn) { try { bizUn(); } catch {} bizUn = null; }
  if (rkT) { clearTimeout(rkT); rkFlush(W); }   // v2.177.0: baqi rack save foran
  clearTimeout(wsT); W = null;
  try { localStorage.removeItem(WD_ON); } catch {}
  return true;
}
window.ntWebClose = webClose;
let psT = 0;
function paintSoon() { clearTimeout(psT); psT = setTimeout(paint, 60); }

// ---------- 🖌 paint ----------
function paint() {
  if (!W || !$('wdDlg')) return;
  const v = W.view;
  try { localStorage.setItem(WD_ON, JSON.stringify({ t: Date.now(), v, k: W.rz?.k || '' })); } catch {}
  $('wdT').textContent = v === 'crop' ? '✂️ Photo se items' : v === 'pick' ? '🔎 Ye kaun sa item?' : v === 'racks' ? '🗂 Racks ki tarteeb' : v === 'info' ? '🏪 Dukan ki maloomat' : v === 'ai' ? '🤖 Racks khud banao' : '🏪 Online Dukan';
  if (v === 'ai') return paintAi();
  if (v === 'net') { $('wdT').textContent = '🌐 Khula maal ki tasveerein'; return paintNet(); }
  if (v === 'rps' || v === 'rpe') { $('wdT').textContent = v === 'rps' ? '📸 Rack ki asal photos' : '📸 ' + rackName(W.racks.rp?.[W.rpe?.pid]?.k || ''); return v === 'rps' ? paintRps() : paintRpe(); }
  if (v === 'multi') { $('wdT').textContent = '🗄 Tasveerein → shelf'; return paintMulti(); }
  if (v === 'crop') return paintCrop();
  if (v === 'pick') return paintPick();
  if (v === 'rsz') { $('wdT').textContent = '🔍 ' + rackName(W.rz?.k || ''); return paintRsz(); }
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
  else $('wdFoot').innerHTML = `<button type="button" class="wd-chip" data-wd="multi">🗄 Kai tasveerein</button><button type="button" class="wd-main" data-wd="rackpic">📷 Rack ki photo se items lagao</button>`;
  thumbs();
  const qi = $('wdQ'); if (W.qFocus && qi) { qi.focus(); const n = qi.value.length; try { qi.setSelectionRange(n, n); } catch {} }
}
function rowHTML(it, no) {
  const st = W.busy.has(it.id) || W.rkIds.has(it.id) || W.rkWait.has(it.id) ? '<span class="wd-s">⏳</span>' : W.err.has(it.id) ? `<span class="wd-s bad" title="${esc(W.err.get(it.id))}">✕</span>` : W.ok.has(it.id) ? '<span class="wd-s ok">✅</span>' : '';
  const on = W.sel && W.sel.has(it.id);
  return `<div class="wd-r${it.hide ? ' off' : ''}${W.sel ? ' sel' : ''}${on ? ' on' : ''}" data-row="${esc(it.id)}">${W.sel ? `<span class="wd-ck" aria-hidden="true">${on ? '✓' : ''}</span>` : ''}<span class="wd-th${it.pic ? '' : ' none'}" data-th="${esc(it.id)}">${it.pic ? '' : '📷'}</span><span class="wd-n"><b>${esc(it.n)}</b><small>Rs ${num(it.r)}${it.u ? ' / ' + esc(it.u) : ''} · ${no.get(it.c) ? 'Rack ' + no.get(it.c) + ' ' : ''}${esc(rackName(it.c))}${it.c !== it.pc && it.c !== KHK ? ' ✏️' : ''}${it.k !== 'n' ? ' · ' + KIND[it.k] : ''}${it.hide ? ' · 🙈 website se chhupa' : ''}</small></span>${st}${W.sel ? '' : `<button type="button" class="wd-cam" data-cam="${esc(it.id)}" aria-label="Tasveer lo">📷</button>`}</div>`;
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
const TRIM = new Map();   // v2.270.2: rack ke preview mein tasveer ka khali peecha kata hua (website jaisa)
let arT = 0;
function arNote(id, a) {   // v2.272.0: tasveer ki shakal (chaurai / oonchai) racks.ar mein — website isi se items jor kar lagati hai
  if (!W || !id || !(a > 0.12 && a < 8)) return; const R = W.racks; R.ar = R.ar || {}; const v = Math.round(a * 100) / 100;
  if (Math.abs((Number(R.ar[id]) || 0) - v) < 0.03) return; R.ar[id] = v; clearTimeout(arT); arT = setTimeout(() => { if (W) saveRacks(); }, 700);
}
function setTh(el, url) { el.style.backgroundImage = `url("${url}")`; el.classList.remove('none'); el.textContent = '';
  if (el.classList.contains('wd-zp')) { const t = TRIM.get(url), id = el.dataset.th; if (t) { el.style.backgroundImage = `url("${t}")`; return; }
    if (t === undefined) { TRIM.set(url, ''); const done = u => { TRIM.set(url, u); document.querySelectorAll('#wdDlg .wd-zp').forEach(x => { if (x.style.backgroundImage.includes(url)) x.style.backgroundImage = `url("${u}")`; }); imgAr(u).then(a => arNote(id, a)); };
      trimUrl(url).then(u => done(u || url)).catch(() => done(url)); } } }
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
const MENU_OLD = false;   // true = purane chips wapas (rack photos / bane racks / internet tasveerein / items chuno / AI racks)
function menuHTML() {
  const L = items() || [], rk = racksOf(L), own = A.owner();
  const ch = (on, attr, t) => `<button type="button" class="wd-chip${on ? ' is-in' : ''}" ${attr}>${t}</button>`;
  // v2.268.0 (malik 13 Nov: 'jo cheezein ab use nahi kar raha nikal do'): purane chips MENU_OLD ke peeche — data / code wahi, sirf chhupe
  const oldH = !MENU_OLD ? '' : `<h3>📸 Asal rack ki photo</h3><div class="wd-chips">${ch(0, 'data-wd="rps"', `📸 Rack ki photos <small>${Object.keys(W.racks.rp || {}).length}</small>`)}${ch(!!W.racks.draw, 'data-wd="draw"', W.racks.draw ? '▦ Bane hue racks: ON' : '▦ Bane hue racks: Band')}</div>
<h3>🌾 Khula maal</h3><div class="wd-chips">${ch(0, 'data-wd="net"', '🌐 Internet se tasveerein')}</div>
<h3>☑ Kai items ek saath</h3><div class="wd-chips">${ch(!!W.sel, 'data-wd="sel"', W.sel ? '☑ Chunne ka mode ON — band karo' : '☑ Items chuno → ek saath rack mein')}</div>`;
  return `<h3>🌐 Website</h3><div class="wd-chips">${ch(0, 'data-wd="share"', '🔗 Link bhejo')}${ch(0, 'data-wd="copy"', '📋 Link copy')}</div>
${oldH}
<h3>📂 Category · 📐 Rack</h3><div class="wd-chips">${ch(!!W.ck, 'data-wd="cats"', `📂 Category: ${W.ck ? esc(rackName(W.ck)) : 'Sab'}`)}${ch(0, 'data-wd="rsize"', '📐 Rack ka size')}</div>
<h3>🔎 Dikhao</h3><div class="wd-chips">${[['all', 'Sab'], ['nopic', '📷 Bina tasveer'], ['pic', '✅ Tasveer wale'], ...(MENU_OLD ? [['noph', `📸 Rack photo par nahi <small>${num(nophCount())}</small>`]] : []), ['hid', '🙈 Chhupe']].map(([k, t]) => ch(W.f === k, `data-f="${k}"`, t)).join('')}</div>
<h3>⚙️ Tarteeb</h3><div class="wd-chips">${MENU_OLD && own && A.aiText ? ch(0, 'data-wd="airk"', '🤖 Racks khud banao (AI)') : ''}${ch(0, 'data-wd="racks"', '🗂 Racks ki tarteeb')}${own ? ch(0, 'data-wd="info"', '🏪 Dukan ki maloomat') + ch(0, 'data-wd="pub"', '🔄 Rates abhi website par bhejo') : ''}</div>
<p class="wd-note">Website par sirf naam, retail rate aur tasveer jati hai — khareed / nafa kabhi nahi. Rates PC khud bhejta hai.</p>`;
}
// ---------- 🌐 v2.160.0: KHULA MAAL KI TASVEEREIN INTERNET SE (malik: "pictures online utha lain") ----------
//   Wikimedia Commons (muft, qanooni tasveerein — CORS khula) · har item ke 6 namoone → malik tap = wohi item ki tasveer (putPhoto, credit racks.cr).
//   Google Images khud download nahi hota (ijazat / copyright) — "🔎 Google" chip Google kholta hai, malik save kar ke 🖼 Gallery se lagaye. AI nahi.
const COMMONS = (q, off) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=12&gsroffset=${off}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist`;
const NET = new Map();   // id -> {q, off, list:[{u, cr}], st: 'ld'|'ok'|'none'|'err'}
const plain = v => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
let netRun = 0;
async function netLoad(id, more) {
  const it = (items() || []).find(x => x.id === id); if (!it) return;
  const o = NET.get(id) || { q: netQuery(it.n), off: 0, list: [], st: '' }; if (o.st === 'ld') return;
  if (more) o.off += 12; o.st = 'ld'; NET.set(id, o); paintSoon();
  try {
    const r = await fetch(COMMONS(o.q, o.off)); if (!r.ok) throw Error('HTTP ' + r.status);
    const j = await r.json(), P = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const got = P.map(p => { const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !ii.thumburl || /svg|gif|pdf|djvu|tiff?/i.test(ii.mime || '') && !/jpe?g|png|webp/i.test(ii.thumburl)) return null;
      const m = ii.extmetadata || {}; return { u: ii.thumburl, cr: `${plain(m.Artist?.value).slice(0, 60) || 'Wikimedia'} · ${plain(m.LicenseShortName?.value) || 'Commons'} · Wikimedia Commons` }; }).filter(Boolean).slice(0, 6);
    o.list = more ? got.concat(o.list).slice(0, 6) : got; o.st = o.list.length ? 'ok' : 'none';
    if (!o.list.length && !more && o.q !== it.n) { o.q = it.n; o.off = 0; o.st = ''; NET.set(id, o); return netLoad(id); }   // English lafz se na mile to item ka apna naam
  } catch (e) { o.st = 'err'; o.err = e.message || String(e); }
  NET.set(id, o); paintSoon();
}
function netQueue(ids) {   // 3 ek saath
  const q = ids.filter(id => !NET.has(id)); let i = 0; const run = ++netRun;
  const next = () => { if (run !== netRun || !W || W.view !== 'net' || i >= q.length) return; const id = q[i++]; netLoad(id).finally(next); };
  for (let k = 0; k < 3; k++) next();
}
async function netPick(id, i) {
  const o = NET.get(id), x = o && o.list[i], it = (items() || []).find(y => y.id === id); if (!x || !it || W.busy.has(id)) return;
  W.busy.add(id); paintSoon();
  try { const r = await fetch(x.u); if (!r.ok) throw Error('HTTP ' + r.status); const bm = await createImageBitmap(await r.blob()); const bytes = await bigBytes(bm, 720); W.busy.delete(id); await putPhoto(id, bytes, '🌐 ' + it.n, x.cr); }
  catch (e) { W.busy.delete(id); W.err.set(id, 'Internet tasveer nahi aayi'); A.notice('❌ Tasveer nahi aayi (' + (e.message || e) + ') — 🔎 Google / 🖼 Gallery se lagayein'); paintSoon(); }
}
function paintNet() {
  const L = (items() || []).filter(it => it.k !== 'n' && !it.hide).sort((a, b) => (a.pic - b.pic) || a.n.localeCompare(b.n));
  const done = L.filter(it => it.pic).length, can = L.filter(it => !it.pic && NET.get(it.id)?.list?.length).length;
  const keepY = $('wdBody').scrollTop;
  $('wdStrip').innerHTML = `<span>🌐 Internet (Wikimedia — muft tasveerein) · jo tasveer pasand ho us par tap</span><span class="wd-k">📷 ${num(done)} / ${num(L.length)}</span>`;
  $('wdBody').innerHTML = L.length ? `<div class="wd-nl">${L.map(it => { const o = NET.get(it.id) || {}, st = W.busy.has(it.id) ? '<span class="wd-s">⏳</span>' : W.err.has(it.id) ? '<span class="wd-s bad">✕</span>' : W.ok.has(it.id) ? '<span class="wd-s ok">✅</span>' : '';
    return `<div class="wd-nr" data-nrow="${esc(it.id)}"><div class="wd-nh"><span class="wd-th${it.pic ? '' : ' none'}" data-th="${esc(it.id)}">${it.pic ? '' : (it.k === 'g' ? '🫙' : '🧺')}</span><span class="wd-n"><b>${esc(it.n)}</b><small>${it.k === 'g' ? '🫙 Dabba' : '🧺 Tora'} · 🔎 "${esc(o.q || netQuery(it.n))}"${it.pic ? ' · ✅ tasveer lagi hai' : ''}</small></span>${st}</div>
<div class="wd-nc">${(o.list || []).map((x, i) => `<button type="button" class="wd-ncp" data-netpick="${esc(it.id)}|${i}" aria-label="Ye tasveer lagao"><img src="${esc(x.u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}${o.st === 'ld' ? '<span class="wd-dim">⏳ internet par dhoond rahe…</span>' : o.st === 'none' ? '<span class="wd-dim">Internet par nahi mili — 🔎 Google / 🖼 Gallery</span>' : o.st === 'err' ? '<span class="wd-dim bad">✕ Internet nahi chala — dobara 🔄</span>' : ''}</div>
<div class="wd-chips"><button type="button" class="wd-chip" data-netmore="${esc(it.id)}">🔄 Aur</button><button type="button" class="wd-chip" data-netg="${esc(it.id)}">🔎 Google</button><button type="button" class="wd-chip" data-netgal="${esc(it.id)}">🖼 Gallery</button></div></div>`; }).join('')}</div>`
    : '<p class="wd-empty">Abhi koi 🫙 dabba / 🧺 tora wala item nahi.<br>Item par tap kar ke "🌾 Website par kaise rakha ho?" se chunein.</p>';
  $('wdBody').scrollTop = keepY;
  $('wdFoot').innerHTML = `<button type="button" class="wd-chip" data-wd="back">‹ Wapas</button><button type="button" class="wd-main" data-wd="netall"${can ? '' : ' disabled'}>✅ Bina tasveer walon par pehli wali (${num(can)})</button>`;
  thumbs();
  netQueue(L.map(it => it.id));
}
async function netAll() {
  const L = (items() || []).filter(it => it.k !== 'n' && !it.hide && !it.pic && NET.get(it.id)?.list?.length);
  A.notice(`🌐 ${num(L.length)} items par tasveer lag rahi hai ⏳`);
  for (const it of L) { if (!W || W.view !== 'net') break; await netPick(it.id, 0); }
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
${it.k !== 'n' ? '<p class="wd-note">🌾 Ye item "' + esc(rackName(KHK)) + '" section mein hai (rack badalne se nahi hilta — ▦ Shelf chunein to wapas apne rack mein).</p>' : ''}<h3>🌾 Website par kaise rakha ho?</h3><div class="wd-chips">${Object.entries(KIND).map(([k, t]) => `<button type="button" class="wd-chip${it.k === k ? ' is-in' : ''}" data-lp="${k}">${t}${it.auto === k ? ' <small>khud</small>' : ''}</button>`).join('')}</div>
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
const SGC = new Map(), NTC = new Map(); let sgcN = -1, sgcAt = 0;   // v2.177.0: 🐞 har paint par 100 dabbe × 2000 items dobara — ab yaad (1 min / items badle to taza)
function sugg(label, L) {   // AI ka label -> POS ke naam (lafz milao, size / brand) — sirf mashwara
  if (L.length !== sgcN || Date.now() - sgcAt > 60000) { SGC.clear(); NTC.clear(); sgcN = L.length; sgcAt = Date.now(); }
  const ck = String(label); if (SGC.has(ck)) return SGC.get(ck);
  const lt = tks(label); if (!lt.length) return [];
  const out = [];
  for (const it of L) { let nt = NTC.get(it.n); if (!nt) { nt = tks(it.n); NTC.set(it.n, nt); } let sc = 0; for (const w of lt) { if (nt.includes(w)) sc += 1; else if (nt.some(t => (t.length >= 3 && w.startsWith(t)) || (w.length >= 3 && t.startsWith(w)))) sc += 0.6; } sc /= lt.length; if (sc >= 0.34) out.push([sc, it]); }
  const res = out.sort((a, b) => b[0] - a[0]).slice(0, 3); SGC.set(ck, res); return res;
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
  const w0 = W; rkT = setTimeout(() => rkFlush(w0), 500);
}
async function rkFlush(w) {   // v2.177.0: 🐞 screen 0.5 sec mein band = rack badalna khoya — ab webClose bhi foran bhejta hai
  rkT = 0; {
    if (!w) return;
    const ids = [...w.rkIds]; w.rkIds.clear(); ids.forEach(id => w.rkWait.add(id));   // v2.156.0: har item ka ⏳ → ✅ / ✕
    try { await A.cloud.saveWebRacks(w.racks); w.rkSt = '✅'; ids.forEach(id => w.ok.add(id)); if (ids.length > 1) A.notice(`✅ ${num(ids.length)} items ka rack website par badal gaya`); }
    catch (e) { w.rkSt = '✕'; ids.forEach(id => w.err.set(id, 'Rack save nahi hua')); A.notice('❌ Racks save nahi hue: ' + (e.message || e)); }
    ids.forEach(id => w.rkWait.delete(id));
    w.rkDirty = false; if (W === w) paint();
  }
}
function paintRacks() {
  const L = items() || [], rk = racksOf(L);
  $('wdStrip').innerHTML = `<span>Upar wala rack website par pehle (darwaze ke paas) · ↑ ↓ tarteeb · naam badlo · 🔍 size (items chhote / bare) · 👁 chhupao · 📷 rack ki asal tasveer (🖼 = lagi hai)</span>${W.rkSt ? `<span class="wd-k">${W.rkSt === '⏳' ? '⏳ save…' : W.rkSt === '✅' ? '✅ save' : '✕ nahi hua'}</span>` : ''}`;
  $('wdBody').innerHTML = `<ol class="wd-rks">${rk.map((r, i) => `<li class="${r.off ? 'off' : ''}"><span class="wd-no">${r.off ? '🙈' : i + 1}</span><span class="wd-rkn"><input value="${esc(r.name)}" placeholder="${esc(title(r.k))}" data-rn="${esc(r.k)}" maxlength="40" aria-label="Rack ka naam"><small>POS: ${esc(r.k)} · ${r.n} items</small></span><button type="button" class="wd-chip" data-rz="${esc(r.k)}" aria-label="Size">🔍</button><button type="button" class="wd-chip" data-up="${esc(r.k)}" aria-label="Upar">↑</button><button type="button" class="wd-chip" data-dn="${esc(r.k)}" aria-label="Neeche">↓</button><button type="button" class="wd-chip" data-hc="${esc(r.k)}" aria-label="Chhupao">${r.off ? '👁' : '🙈'}</button><button type="button" class="wd-chip wd-bgc${W.ph[rkPh(r.k)] ? ' has' : ''}" data-rbg="${esc(r.k)}" aria-label="Rack ki asal tasveer">${W.busy.has(rkPh(r.k)) ? '⏳' : W.ph[rkPh(r.k)] ? '🖼' : '📷'}</button></li>`).join('')}</ol>`;
  $('wdFoot').innerHTML = `<button type="button" class="wd-main" data-wd="back">✓ Ho gaya</button>`;
}
// ---------- 📐 v2.270.0: RACK KA SIZE (malik 13 Nov: "⋮ mein · ek rack par kitni shelf 3-5-8-9 · shelf chun kar search se item lagao · item ka size box se haath se") ----------
//   racks.rn[rack] = shelf ki ginti · racks.sh[id] = chuni shelf (0 se) · racks.sz[id] = size (number, 1 = aam). Naqsha dukan/khula.js rackLayout — website wahi.
function catsHTML() { const rk = racksOf(items() || []); const ch = (on, k, t) => `<button type="button" class="wd-chip${on ? ' is-in' : ''}" data-ck="${esc(k)}">${t}</button>`;
  return `<h3 class="wd-st">📂 Category</h3><div class="wd-chips">${ch(!W.ck, '', 'Sab racks')}${rk.map((r, i) => ch(W.ck === r.k, r.k, `${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)} <small>${r.n}</small>`)).join('')}</div>`; }
function rsizeHTML() { const rk = racksOf(items() || []).filter(r => r.k !== KHK);
  return `<h3 class="wd-st">📐 Kis rack ka size?</h3><div class="wd-chips">${rk.map((r, i) => `<button type="button" class="wd-chip" data-rz="${esc(r.k)}" data-rzf="menu">${i + 1}. ${esc(r.name)}</button>`).join('')}</div>`; }
function rzItems(k) { return (items() || []).filter(x => x.c === k && !x.hide && x.k === 'n' && (W.racks.draw || x.pic)).sort((a, b) => (Number(W.ph[a.id]) || 0) - (Number(W.ph[b.id]) || 0)); }
// v2.272.0: 🧲 items jure hue (unit — khula.js itemU / rackLayoutU, website wahi) · ✂️ Crop · 📸 Camera / Gallery item lagate waqt
const rzRows = k => rackRowsOf(k, W.racks.rn, RK_ROWS);
function rzFindHTML() {
  const q = String(W.rz.q || '').trim(); if (!q) return '';
  const L = (items() || []).filter(x => !x.hide && x.k === 'n');
  const F = (r => [...r.hits, ...r.near])(smartFind(L, q, it => it.n, it => it.id)).sort((a, b) => (b.pic - a.pic)).slice(0, 30);
  if (!F.length) return `<p class="wd-note">"${esc(q)}" nahi mila.</p>`;
  return F.map(it => it.pic
    ? `<button type="button" class="wd-zf" data-zadd="${esc(it.id)}"><span class="wd-zft none" data-th="${esc(it.id)}"></span><span class="wd-zfn">${esc(it.n)}<small>${it.c === W.rz.k ? 'isi rack par hai — shelf badlegi' : esc(rackName(it.c))}</small></span></button>`
    : `<div class="wd-zf nop"><span class="wd-zft">${W.busy.has(it.id) ? '⏳' : '📷'}</span><span class="wd-zfn">${esc(it.n)}<small>${W.busy.has(it.id) ? 'tasveer ja rahi hai…' : 'tasveer nahi — abhi lein, shelf ' + (W.rz.s + 1) + ' par lag jayega:'}</small>${W.busy.has(it.id) ? '' : `<span class="wd-zfc"><button type="button" class="wd-chip" data-zshot="cam" data-zid="${esc(it.id)}">📸 Camera</button><button type="button" class="wd-chip" data-zshot="gal" data-zid="${esc(it.id)}">🖼 Gallery</button></span>`}</span></div>`).join('');
}
function rzGeo(rows) { const Wp = Math.max(240, Math.min(($('wdBody').clientWidth || 360) - 24, 520)), u = (Wp - 16) / 100; return { Wp, Hp: Math.round((rows || RK_ROWS) * (RK_K + rkImgU(rows || RK_ROWS)) * u), u }; }   // v2.273.0: shelf = parchi + item (website par is ke upar peeche ki qatar jhaankti hai — item ki chaurai / ginti wahi)
function paintRsz() {
  const k = W.rz.k, L = rzItems(k), sz = W.racks.sz || {}, dh = W.racks.dh || {}, rows = rzRows(k), G = rzGeo(rows);
  if (!(W.rz.s >= 0 && W.rz.s < rows)) W.rz.s = 0;
  const foc = document.activeElement && document.activeElement.id === 'wdZQ', keepY = $('wdBody').scrollTop;
  const B = rackLayoutU(L, rows, sz, dh, W.racks.ar, W.racks.sh), sh = B[0] || [];
  $('wdStrip').innerHTML = `<span><b>Shelf:</b></span>${[3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" class="wd-chip wd-zn${n === rows ? ' is-in' : ''}" data-zrn="${n}">${n}</button>`).join('')}${W.rkSt ? `<span class="wd-k">${W.rkSt === '⏳' ? '⏳' : W.rkSt === '✅' ? '✅' : '✕'}</span>` : ''}`;
  let h = ''; for (let s = 0; s < rows; s++) { const R = sh[s] || [];
    h += `<div class="wd-zs${W.rz.s === s ? ' is-in' : ''}" data-zsf="${s}"><span class="wd-zno">${s + 1}</span>${R.map(x => { const it = x.it, on = W.rz.it === it.id, one = `<span class="wd-zp none" data-th="${esc(it.id)}"></span>`; return `<button type="button" class="wd-zi${on ? ' is-in' : ''}" data-zi="${esc(it.id)}" data-zsh="${s}" style="--wu:${x.wu.toFixed(2)};--hu:${x.hu.toFixed(2)}">${x.n > 1 ? `<span class="wd-zd">${dherHTML(one, x.n)}</span>` : one}<span class="wd-zt">${num(it.r)}</span>${on ? '<i class="wd-zh" data-zh="1"></i>' : ''}</button>`; }).join('')}</div>`; }
  const more = B.length > 1 ? `<p class="wd-note">Yeh pehla rack hai — baqi items agle ${B.length - 1} rack par khud lage hain.</p>` : '';
  $('wdBody').innerHTML = `<div class="wd-zq"><input id="wdZQ" type="search" placeholder="🔍 Shelf ${W.rz.s + 1} par item lagao — naam likhein" value="${esc(W.rz.q || '')}" autocomplete="off"></div><div class="wd-zl" id="wdZL">${rzFindHTML()}</div><div class="wd-zr" id="wdZr" style="width:${G.Wp}px;height:${G.Hp}px;--rows:${rows};--u:${G.u.toFixed(3)}px">${h}</div><p class="wd-note">Shelf ka number dabayein = wo shelf chuni (peeli). Item dabayein = neeche us ke chips (－ ＋ · ✂️ Crop · 📸 · 🧱 Dher). Items ek doosre se jure rehte hain — jitni shelf kam, utne bare. Website par har item ke peeche usi ki 2 qatarein bhi dikhti hain.</p>${more}`;
  const it = W.rz.it && L.find(x => x.id === W.rz.it), dn = it ? dherN(it.id, dh) : 1;
  $('wdFoot').innerHTML = it ? `<div class="wd-zb"><b>${esc(it.n)}</b><span><button type="button" class="wd-chip" data-zsz="-1">－</button><button type="button" class="wd-chip" data-zsz="1">＋</button><button type="button" class="wd-chip" data-zcrop="1">✂️ Crop</button><button type="button" class="wd-chip" data-cam="${esc(it.id)}">📸 Tasveer</button><button type="button" class="wd-chip${dn > 1 ? ' is-in' : ''}" data-zdh="1">🧱 Dher${dn > 1 ? ': ' + dn : ''}</button><button type="button" class="wd-chip" data-zmv="-1">⬆ shelf</button><button type="button" class="wd-chip" data-zmv="1">⬇ shelf</button><button type="button" class="wd-chip" data-zsz="0">↩ Poora</button><button type="button" class="wd-chip is-in" data-zok="1">✓</button></span></div>` : `<button type="button" class="wd-main" data-wd="back">✓ Ho gaya</button>`;
  $('wdBody').scrollTop = keepY;
  if (foc) { const q = $('wdZQ'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch {} } }
  thumbs(); rzDrag();
}
function rzSize(id, v) { W.racks.sz = W.racks.sz || {}; v = Math.round(Math.max(0.4, Math.min(1, v)) * 20) / 20; if (v >= 0.99) delete W.racks.sz[id]; else W.racks.sz[id] = v; saveRacks(); }
function rzDrag() {
  const hd = document.querySelector('#wdZr [data-zh]'), el = hd && hd.closest('.wd-zi'), rk = $('wdZr'); if (!hd || !el || !rk) return;
  const id = el.dataset.zi, rows = rzRows(W.rz.k), it = (items() || []).find(x => x.id === id); if (!it) return; let st = null;
  hd.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); st = { x: e.clientX, y: e.clientY, s0: sizeOf(id, W.racks.sz), full: Math.max(20, rkImgU(rows) * rk.getBoundingClientRect().width / 100), v: 0 }; try { hd.setPointerCapture(e.pointerId); } catch {} });
  hd.addEventListener('pointermove', e => { if (!st) return; const d = ((e.clientX - st.x) - (e.clientY - st.y)) / 2; st.v = Math.max(0.4, Math.min(1, st.s0 + d / st.full));
    const X = itemU(it, rows, { ...(W.racks.sz || {}), [id]: st.v }, W.racks.dh, W.racks.ar); el.style.setProperty('--wu', X.wu.toFixed(2)); el.style.setProperty('--hu', X.hu.toFixed(2)); });
  const end = () => { if (!st) return; const v = st.v; st = null; if (v) rzSize(id, v); };
  hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end);
  hd.addEventListener('click', e => e.stopPropagation());
}
function rzPlace(id) {
  const it = (items() || []).find(x => x.id === id); if (!it || !W.rz) return; const k = W.rz.k;
  if (k === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = k;
  W.racks.sh = W.racks.sh || {}; W.racks.sh[id] = W.rz.s; W.rz.it = id; saveRacks();
}
function rzAdd(id) { const it = (items() || []).find(x => x.id === id); if (!it || !it.pic) return; rzPlace(id); }
async function rzCrop(id) {   // lagi hui tasveer ko dobara kaato (zoom): wohi crop screen, Save par wapas isi rack par
  const w = W; A.notice('✂️ Tasveer khul rahi hai…');
  try { const c = TH.get(id); let bl = null; if (c && c.url) { try { bl = await (await fetch(c.url)).blob(); } catch {} }
    if (!bl) { const b = await A.cloud.getWebPhoto(id); if (!b) throw Error('Tasveer nahi mili'); bl = new Blob([b], { type: 'image/jpeg' }); }
    if (W !== w || W.view !== 'rsz') return; shotFor = id; shotBack = 'rsz'; await gotFile(bl); }
  catch (e) { A.notice('❌ ' + (e.message || e)); }
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
let shotFor = '', shotBack = '';
function shoot(kind, forId) { shotFor = forId || ''; sheetClose(); $(kind === 'cam' ? 'wdCam' : 'wdGal').click(); }
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  const url = URL.createObjectURL(file); const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img;
}
// ---------- 🗄 v2.266.0: KAI TASVEEREIN EK SAATH → shelf par khud (malik 13 Nov: "4 ya 10 pictures list mein lagayein, phir shelf par khud lagti jayein · bina tasveer wale bilkul na dikhein") ----------
async function gotMulti(files) {
  if (!W) return;
  if (!W.multi) W.multi = { k: W.multiK || '', rows: [], n: 0 };
  const M = W.multi; W.view = 'multi'; M.load = (M.load || 0) + files.length; paint();
  for (const f of files.slice(0, 30)) {
    try { const bm = await decode(f), bytes = await bigBytes(bm, 720); if (W && W.multi === M) M.rows.push({ i: ++M.n, bytes, url: URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })), id: '' }); }
    catch { A.notice('❌ Ek tasveer khul nahi saki'); }
    M.load--; if (W && W.multi === M) paint();
  }
  M.load = 0; if (W && W.multi === M) paint();
}
function paintMulti() {
  const M = W.multi; if (!M) { W.view = 'list'; return paint(); }
  const L = items() || [], by = new Map(L.map(i => [i.id, i])), ok = M.rows.filter(r => r.id).length;
  $('wdStrip').innerHTML = `<span>🗄 Har tasveer ka <b>naam</b> chunein → shelf par khud lag jayegi</span><span class="wd-k">✓ ${ok} / ${M.rows.length}</span>${M.load ? `<span class="wd-k">⏳ ${M.load} tasveer aa rahi…</span>` : ''}`;
  $('wdBody').innerHTML = `<div class="wd-chips wd-mrk"><button type="button" class="wd-chip${M.k ? ' is-in' : ''}" data-wd="murack">🗂 Rack: ${M.k ? esc(rackName(M.k)) : 'chunein ▾'}</button></div>`
    + (M.rows.length ? `<div class="wd-ml">${M.rows.map(r => { const it = r.id ? by.get(r.id) : null; return `<div class="wd-mr${r.id ? ' ok' : ''}"><img src="${r.url}" alt=""><button type="button" class="wd-mn" data-mpick="${r.i}">${it ? `<b>${esc(it.n)}</b><small>Rs ${num(it.r)}${W.ph?.[it.id] ? ' · 📷 purani tasveer badal jayegi' : ''}</small>` : '<b>🔍 Naam chunein</b>'}</button>${r.st ? `<i class="wd-ms">${r.st}</i>` : `<button type="button" class="wd-mx" data-mdel="${r.i}" aria-label="Hatao">✕</button>`}</div>`; }).join('')}</div>` : '<p class="wd-empty">Neeche "＋ Tasveerein" dabayein — gallery se 4, 10 ya zyada ek saath chunein.<br>Saaf roshni, ek tasveer mein ek cheez.</p>');
  $('wdFoot').innerHTML = `<button type="button" class="wd-chip" data-wd="multiadd"${M.saving ? ' disabled' : ''}>＋ Tasveerein</button><button type="button" class="wd-main" data-wd="musave"${ok && M.k && !M.saving && !M.load ? '' : ' disabled'}>${M.saving ? '⏳ Lag rahi hain…' : `✓ ${ok} shelf par lagao`}</button>`;
}
function muListHTML() {
  const M = W.multi, L = items() || [], q = (W.muq || '').trim(), used = new Set(M.rows.filter(r => r.id && r.i !== M.act).map(r => r.id));
  const F = (q ? (r => [...r.hits, ...r.near])(smartFind(L, q, it => it.n, it => it.id)) : L).filter(it => !used.has(it.id)).slice(0, 60);   // dohra roko
  return F.map(it => `<button type="button" class="wd-r wd-pr" data-mit="${esc(it.id)}"><span class="wd-n"><b>${esc(it.n)}</b><small>Rs ${num(it.r)} · ${esc(rackName(it.c))}${W.ph?.[it.id] ? ' · 📷' : ''}</small></span></button>`).join('') || '<p class="wd-empty">Is naam ka item nahi mila.</p>';
}
function muPick(i) {
  const M = W.multi, r = M && M.rows.find(x => x.i === i); if (!r || M.saving) return; M.act = i; W.muq = '';
  sheet(`<h3 class="wd-st">🏷 Ye kaunsi cheez hai?</h3><p class="wd-note"><img src="${r.url}" alt="" style="height:64px;border-radius:8px;vertical-align:middle"> POS ka naam chunein</p><label class="wd-q wd-q2"><span>🔍</span><input id="wdMQ" type="search" placeholder="Naam likhein…" autocomplete="off"></label><div class="wd-list wd-mxl">${muListHTML()}</div>`);
  setTimeout(() => { try { $('wdMQ')?.focus(); } catch {} }, 60);
}
function muRackSheet() {
  const rk = racksOf(items() || []).filter(r => r.k !== KHK);
  sheet(`<h3 class="wd-st">🗂 Kis rack ki shelf par?</h3><div class="wd-chips">${rk.map((r, i) => `<button type="button" class="wd-chip${W.multi?.k === r.k ? ' is-in' : ''}" data-mrk="${esc(r.k)}">${r.off ? '🙈 ' : (i + 1) + '. '}${esc(r.name)}</button>`).join('')}</div>
<form class="wd-newrk" data-form="munewrk"><input name="k" placeholder="Naya rack ka naam" maxlength="40"><button type="submit" class="wd-chip">＋ Naya rack</button></form>`);
}
function muSetRack(k) { if (!W.multi || !k) return; W.multi.k = k; W.multiK = k; sheetClose(); paint(); }
async function muSave() {
  const w = W, M = w.multi; if (!M || M.saving || !M.k) return;
  const R = M.rows.filter(r => r.id && r.st !== '✅'); if (!R.length) return;
  const by = new Map((items() || []).map(i => [i.id, i]));
  M.saving = true;
  for (const r of R) { const it = by.get(r.id); if (!it) continue; if (M.k === it.pc) delete w.racks.ic[r.id]; else w.racks.ic[r.id] = M.k; w.rkIds.add(r.id); r.st = '⏳'; }
  if (!w.racks.order.includes(M.k)) w.racks.order = [...racksOf(items() || []).map(x => x.k).filter(x => x !== M.k), M.k];
  saveRacks();
  let n = 0;
  for (const r of R) {   // ek ek kar ke — tarteeb wahi rahe (website par tasveer ke waqt se shelf ki tarteeb)
    await putPhoto(r.id, r.bytes, '', '', true); r.st = w.err.has(r.id) ? '✕' : '✅'; if (r.st === '✅') n++;
    if (W === w && w.view === 'multi') paintMulti();
  }
  M.saving = false;
  if (W !== w) return;
  const bad = M.rows.filter(r => r.st === '✕').length, left = M.rows.filter(r => !r.id).length;
  A.notice(`🗄 ${n} items "${rackName(M.k)}" ki shelf par lag gaye${bad ? ` · ✕ ${bad} nahi hue` : ''}`);
  if (!bad && !left) { w.multi = null; w.view = 'list'; } else M.rows = M.rows.filter(r => r.st !== '✅');
  paint();
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
  W.crop = { bm, w, h, url: URL.createObjectURL(f), box: one ? { x: w * 0.06, y: h * 0.06, w: w * 0.88, h: h * 0.88 } : { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.4 }, one, done: [], back: shotBack }; shotBack = '';
  W.view = 'crop'; paint();
  if (one) acRun();
}
// ---------- 🤖 v2.274.0: AI AUTO CROP (malik 13 Nov: "1 bana do — background hatne ka koi issue nahi") ----------
//   Ek item ki tasveer (camera / gallery / ✂️ Crop) aate hi Gemini se us cheez ka dabba (box_2d 0-1000) -> ✂️ dabba khud lag jata hai; malik dekh kar Save (kone khench kar theek bhi kar sakta).
//   Sirf DABBA (kaatna) — peecha mitana NAHI. Rack ki photo (kai items) par nahi (malik: wahan AI chhor do). Malik ne dabba chhoo liya ho to AI us par zabardasti nahi (🤖 AI chip se lagao).
const AC_PROMPT = 'This photo was taken by a shopkeeper to show ONE retail product (a packet, box, bottle, jar, pouch, soap bar, tin, sachet strip or bag). It may lie on a table, stand on a shelf or be held in a hand, and other things may be visible around it. Return the tight bounding box of the MAIN product only: the single item the photo is about (the largest / most central one). If the photo shows a neat stack or pile of the same product, box the whole stack. Do NOT include the table, hand, background or neighbouring products. Answer ONLY with JSON like {"box_2d":[ymin,xmin,ymax,xmax]} using numbers 0-1000 (normalized to image height and width). If no product is visible answer {"box_2d":null}.';
function acBox(out, C) {
  const re = /box_2d"?\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g; let m, best = null;
  while ((m = re.exec(String(out || '')))) {
    let [y0, x0, y1, x1] = m.slice(1, 5).map(Number); if (![y0, x0, y1, x1].every(Number.isFinite)) continue;
    [y0, x0, y1, x1] = [y0, x0, y1, x1].map(v => Math.max(0, Math.min(1000, v))); if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    if (x1 - x0 < 50 || y1 - y0 < 50) continue;   // bohat chhota = shak
    const a = (x1 - x0) * (y1 - y0); if (!best || a > best.a) best = { a, x0, y0, x1, y1 };   // kai dabbe aayein to sab se bara (asal cheez)
  }
  if (!best) return null;
  const px = (best.x1 - best.x0) * 0.025, py = (best.y1 - best.y0) * 0.025, X0 = Math.max(0, best.x0 - px), Y0 = Math.max(0, best.y0 - py), X1 = Math.min(1000, best.x1 + px), Y1 = Math.min(1000, best.y1 + py);
  return { x: X0 / 1000 * C.w, y: Y0 / 1000 * C.h, w: (X1 - X0) / 1000 * C.w, h: (Y1 - Y0) / 1000 * C.h };
}
const acChip = C => { const a = C && C.ai; if (!a) return '';
  return a.run ? '<span class="wd-k" id="wdAc">🤖 AI dabba dhoond raha hai ⏳</span>' : a.st === 'ok' ? '<span class="wd-k ok" id="wdAc">🤖 AI ka dabba ✅ theek ho to Save</span>' : a.st === 'hold' ? '<span class="wd-k" id="wdAc">🤖 AI tayyar — 🤖 AI dabayein</span>'
    : `<span class="wd-k bad" id="wdAc">🤖 ${a.st === 'no' ? 'AI ko cheez nahi mili' : 'AI nahi chala'} ✕ khud dabba banayein</span>`; };
function acPaint() {   // sirf chip + dabba (poori screen dobara nahi — ungli ka kaam na toote)
  const C = W && W.crop, st = $('wdStrip'); if (!C || W.view !== 'crop' || !st) return;
  const o = $('wdAc'), h = acChip(C); if (o) o.outerHTML = h; else if (h) st.insertAdjacentHTML('beforeend', h);
  const b = $('wdDlg')?.querySelector('[data-wd="acrun"]'); if (b) b.disabled = !!C.ai?.run;
  boxPaint();
}
async function acRun(manual) {
  const w = W, C = w && w.crop; if (!C || !C.one || !A.aiImage || C.ai?.run) return;
  if (manual && C.ai?.box) { C.box = { ...C.ai.box }; C.ai = { run: false, st: 'ok', box: C.ai.box }; C.touch = 0; acPaint(); return; }   // AI wala dabba wapas (naya sawal nahi)
  C.ai = { run: true }; if (manual) C.touch = 0; acPaint();
  const mine = () => W === w && w.crop === C;
  try {
    const out = await A.aiImage(u8b64(await bigBytes(C.bm, 768)), AC_PROMPT);   // AI ko chhoti copy (tez)
    if (!mine()) return;
    const box = acBox(out, C);
    if (!box) C.ai = { run: false, st: 'no' };
    else if (C.touch) C.ai = { run: false, st: 'hold', box };   // malik khud dabba bana raha hai — us ka kaam mat bigaro
    else { C.box = { ...box }; C.ai = { run: false, st: 'ok', box }; }
  } catch (e) { if (!mine()) return; C.ai = { run: false, st: 'err' }; A.notice('🤖 AI nahi chala — khud dabba banayein (' + String(e && e.message || e).slice(0, 70) + ')'); }
  acPaint();
}
function paintCrop() {
  const C = W.crop; if (!C) { W.view = 'list'; return paint(); }
  const it = C.one ? (items() || []).find(x => x.id === C.one) : null;
  $('wdStrip').innerHTML = `<span>${C.ai || (C.one && A.aiImage) ? '✂️ Dabba: kone khench kar chhota / bara' : '✂️ Ungli se item ke gird dabba banayein · kone khench kar chhota / bara'}</span>${acChip(C)}${C.done.length ? `<span class="wd-k ok">✅ Is photo se ${C.done.length}</span>` : ''}`;
  $('wdBody').innerHTML = `<div class="wd-cw" id="wdCw"><div class="wd-cimg"><img id="wdCi" src="${C.url}" alt="" draggable="false"><div class="wd-box" id="wdBox"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div></div></div>${C.done.length ? `<p class="wd-done">${C.done.map(d => `✅ ${esc(d)}`).join(' · ')}</p>` : ''}`;
  $('wdFoot').innerHTML = C.one
    ? `<button type="button" class="wd-chip" data-wd="back">✕ Rehne do</button>${A.aiImage ? `<button type="button" class="wd-chip" data-wd="acrun"${C.ai?.run ? ' disabled' : ''} title="AI se dabba lagao">🤖 AI</button>` : ''}<button type="button" class="wd-main" data-wd="cropsave">✅ Save — ${esc(it ? it.n : 'item')}</button>`
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
    if (!W?.crop) return; e.preventDefault(); W.crop.touch = 1;
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
async function putPhoto(id, bytes, label, credit, quiet) {   // credit = 🌐 internet tasveer ka haq (website khirki mein) · apni tasveer = credit hata
  const it = (items() || []).find(x => x.id === id), nm = label || (it ? it.n : id);
  W.busy.add(id); W.err.delete(id); W.ok.delete(id);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  TH.set(id, { v: -1, url });
  const w = W;
  try {
    const v = await A.cloud.putWebPhoto(id, bytes);
    TH.set(id, { v, url }); w.ok.add(id);
    const cr = w.racks.cr || (w.racks.cr = {}); if (credit) { cr[id] = String(credit).slice(0, 160); saveRacks(); } else if (cr[id]) { delete cr[id]; saveRacks(); }
    if (!quiet) A.notice('✅ Website par tasveer lag gayi — ' + nm); if (W === w) w.ph = { ...w.ph, [id]: v };   // v2.160.0: foran (phIdx ka jawab der se aaye tab bhi dohra nahi)
  } catch (e) { w.err.set(id, e.message || String(e)); A.notice('❌ Tasveer save nahi hui: ' + (e.message || e)); }
  finally { w.busy.delete(id); if (W === w) paintSoon(); }
}
async function cropSave(id) {
  let bytes; try { bytes = await cropBytes(); } catch (e) { A.notice('❌ ' + (e.message || e)); return; }
  const it = (items() || []).find(x => x.id === id);
  putPhoto(id, bytes);
  if (W.crop.one) { const bk = W.crop.back || 'list'; W.view = bk === 'rsz' && !W.rz ? 'list' : bk; W.crop = null;
    if (W.view === 'rsz' && W.rz.pend === id) { W.rz.pend = ''; rzPlace(id); return; }   // v2.272.0: 📸 lagate waqt li gayi tasveer = chuni hui shelf par
    paint(); return; }   // 🌐 net screen se aaye to wapas wahin
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
  if (e.target.id === 'wdZQ' && W.rz) { W.rz.q = e.target.value; clearTimeout(onInput.z); onInput.z = setTimeout(() => { const l = $('wdZL'); if (l && W && W.rz) { l.innerHTML = rzFindHTML(); thumbs(); } }, 140); return; }
  if (e.target.id === 'wdQ') { W.q = e.target.value; W.lim = 120; W.qFocus = 1; clearTimeout(onInput.t); onInput.t = setTimeout(() => { paint(); W && (W.qFocus = 0); }, 140); }
  else if (e.target.id === 'wdMQ') { W.muq = e.target.value; clearTimeout(onInput.m); onInput.m = setTimeout(() => { const l = document.querySelector('#wdDlg .wd-mxl'); if (l && W && W.multi) l.innerHTML = muListHTML(); }, 120); }
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
    const o = { name: g('name') || 'Noor Traders', line: g('line'), wa: g('wa'), addr: g('addr'), time: g('time'), open: g('open'), close: g('close'), on: !!f.elements.on.checked, ...(W.info && W.info.waAuto ? { waAuto: W.info.waAuto } : {}) };   // waAuto = Business number ek dafa lag chuka (dobara khud na badle)
    W.infoSt = '⏳ save…'; W.info = { ...W.info, ...o }; paint();
    try { await A.cloud.saveWebInfo(o); if (W) { W.infoSt = '✅ save ho gaya'; paint(); } A.notice('✅ Dukan ki maloomat website par'); } catch (er) { if (W) { W.infoSt = '✕ nahi hua'; paint(); } A.notice('❌ ' + (er.message || er)); }
  } else if (f.dataset.form === 'munewrk') {
    e.preventDefault(); const k = String(f.elements.k.value || '').trim().slice(0, 40); if (k) muSetRack(k);
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
// v2.177.0: 🐞 "Rates website par" packet (6th khana) mita deta tha — ab PC (sync-stock v4 webPacks) jaisa: Show ✓ wale (na hon to sab), rate 0 = tadad × rate, 8 tak
function webPacks(m) {
  const r2 = v => Math.round(Number(v) * 100) / 100, L = (m.sb || []).filter(x => Number(x?.q) > 0), S = L.some(x => x.s) ? L.filter(x => x.s) : L, seen = new Map();
  for (const x of S) { const q = Math.round(Number(x.q) * 1000) / 1000; if (seen.has(q) || q <= 0) continue; const pr = Number(x.r) > 0 ? r2(x.r) : r2(q * m.r); if (pr > 0) seen.set(q, pr); }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8);
}
async function publish() {
  const B = base(); if (!B) { A.notice('⏳ Stock abhi load nahi hua'); return; }
  const rows = B.sort((a, b) => Number(a.id) - Number(b.id)).map(m => { const row = [m.id, m.n, m.c, Math.round(m.r * 100) / 100, m.u], pk = webPacks(m); if (pk.length) row.push(pk); return row; });
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
  if (k === 'cats') { sheet(catsHTML()); return; }
  if (k === 'rsize') { sheet(rsizeHTML()); return; }
  if (k === 'sclose') { sheetClose(); return; }
  if (k === 'site') {
    let w = null; try { w = window.open(WEB_URL(), '_blank'); } catch {}
    if (!w) { try { const l = document.createElement('a'); l.href = WEB_URL(); l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); } catch { A.notice('🌐 Website: ' + WEB_URL()); } }
    return; }
  if (k === 'share') { share(); return; }
  if (k === 'copy') { sheetClose(); copyLink(); return; }
  if (k === 'airk') { sheetClose(); aiRun(); return; }   // v2.157.0
  if (k === 'rps') { sheetClose(); W.view = 'rps'; paint(); return; }   // v2.158.0: 📸 asal rack photos
  if (k === 'rpadd') { W.act = ''; sheet(`<h3 class="wd-st">📸 Rack ki asal photo</h3><p class="wd-note">Saamne se, seedha, poora rack ek photo mein — roshni mein. 🤖 AI har cheez ke gird dabba banayegi, aap naam lagayenge.</p><div class="wd-chips"><button type="button" class="wd-chip" data-rpshot="cam">📸 Camera</button><button type="button" class="wd-chip" data-rpshot="gal">🖼 Gallery</button></div>`); return; }
  if (k === 'net') { sheetClose(); W.view = 'net'; paint(); return; }   // 🌐
  if (k === 'netall') { netAll(); return; }
  if (k === 'draw') { W.racks.draw = !W.racks.draw; saveRacks(); sheetClose(); paint(); A.notice(W.racks.draw ? '▦ Website par bane hue racks ON' : '▦ Bane hue racks band — sirf asal photos + 🌾 dabbe / tore ⏳'); return; }
  if (k === 'nmon') { W.racks.nmOn = !W.racks.nmOn; saveRacks(); paint(); A.notice(W.racks.nmOn ? '🏷 Customer ko photo par naam bhi dikhega' : '🏷 Photo par sirf rate (naam nahi)'); return; }
  if (k === 'multi') { sheetClose(); if (!W.multi) W.multi = { k: W.multiK || '', rows: [], n: 0 }; W.view = 'multi'; paint(); if (!W.multi.rows.length) $('wdMulti').click(); return; }
  if (k === 'multiadd') { $('wdMulti').click(); return; }
  if (k === 'murack') { muRackSheet(); return; }
  if (k === 'musave') { muSave(); return; }
  { const mp = t.closest('[data-mpick]'); if (mp && W.multi) { muPick(Number(mp.dataset.mpick)); return; }
    const md = t.closest('[data-mdel]'); if (md && W.multi && !W.multi.saving) { W.multi.rows = W.multi.rows.filter(r => r.i !== Number(md.dataset.mdel)); paint(); return; }
    const mi = t.closest('[data-mit]'); if (mi && W.multi) { const r = W.multi.rows.find(x => x.i === W.multi.act); if (r) r.id = mi.dataset.mit; sheetClose(); paint(); if (!W.multi.k) muRackSheet(); return; }
    const mr = t.closest('[data-mrk]'); if (mr && W.multi) { muSetRack(mr.dataset.mrk); return; } }
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
  if (k === 'acrun') { acRun(true); return; }
  if (k === 'cropsave') { cropSave(W.crop.one); return; }
  if (k === 'mvrack') { mvSheet(); return; }
  if (k === 'hide') { const id = W.act; if (W.racks.hide[id]) delete W.racks.hide[id]; else W.racks.hide[id] = 1; sheetClose(); saveRacks(); return; }
  if (k === 'delph') { const id = W.act; sheetClose(); W.busy.add(id); paint(); A.cloud.delWebPhoto(id).then(() => { TH.delete(id); A.notice('🗑 Tasveer hata di'); }).catch(er => A.notice('❌ ' + (er.message || er))).finally(() => { W && W.busy.delete(id); paintSoon(); }); return; }
  const sh = t.closest('[data-shot]'); if (sh) { shotBack = W.view === 'rsz' ? 'rsz' : ''; shoot(sh.dataset.shot, W.act); return; }
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
  const np = t.closest('[data-netpick]'); if (np) { const [id, i] = np.dataset.netpick.split('|'); netPick(id, Number(i)); return; }
  const nm = t.closest('[data-netmore]'); if (nm) { netLoad(nm.dataset.netmore, true); return; }
  const ng = t.closest('[data-netg]'); if (ng) { const it = (items() || []).find(x => x.id === ng.dataset.netg); if (it) { window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(it.n), '_blank', 'noopener'); A.notice('🔎 Google se tasveer save karein, phir yahan 🖼 Gallery dabayein'); } return; }
  const nga = t.closest('[data-netgal]'); if (nga) { shotBack = 'net'; shoot('gal', nga.dataset.netgal); return; }
  const lpb = t.closest('[data-lp]'); if (lpb) { const id = W.act; if (id) lpMany([id], lpb.dataset.lp); return; }
  const slp = t.closest('[data-slp]'); if (slp) { if (W.sel && W.sel.size) lpMany([...W.sel], slp.dataset.slp); return; }
  const mv = t.closest('[data-mv]'); if (mv) { const id = W.act, it = (items() || []).find(x => x.id === id); if (it) { if (mv.dataset.mv === it.pc) delete W.racks.ic[id]; else W.racks.ic[id] = mv.dataset.mv; } sheetClose(); saveRacks(); return; }
  const rz = t.closest('[data-rz]'); if (rz) { W.rz = { k: rz.dataset.rz, s: 0, q: '', it: '', from: rz.dataset.rzf === 'menu' ? 'menu' : 'racks' }; W.view = 'rsz'; sheetClose(); paint(); return; }
  if (W.view === 'rsz' && W.rz) {
    const zrn = t.closest('[data-zrn]'); if (zrn) { const n = Number(zrn.dataset.zrn); W.racks.rn = W.racks.rn || {}; if (n === RK_ROWS) delete W.racks.rn[W.rz.k]; else W.racks.rn[W.rz.k] = n; saveRacks(); return; }
    const zshot = t.closest('[data-zshot]'); if (zshot) { W.rz.pend = zshot.dataset.zid; shotBack = 'rsz'; shoot(zshot.dataset.zshot, zshot.dataset.zid); return; }
    const zadd = t.closest('[data-zadd]'); if (zadd) { rzAdd(zadd.dataset.zadd); return; }
    if (t.closest('[data-zcrop]') && W.rz.it) { rzCrop(W.rz.it); return; }
    if (t.closest('[data-zdh]') && W.rz.it) { W.racks.dh = W.racks.dh || {}; if (dherN(W.rz.it, W.racks.dh) > 1) delete W.racks.dh[W.rz.it]; else W.racks.dh[W.rz.it] = 4; saveRacks(); return; }
    const zsz = t.closest('[data-zsz]'); if (zsz && W.rz.it) { const d = Number(zsz.dataset.zsz), id = W.rz.it, dn = dherN(id, W.racks.dh);
      if (d && dn > 1) { W.racks.dh[id] = Math.max(2, Math.min(12, dn + d)); saveRacks(); return; }
      const cur = sizeOf(id, W.racks.sz); if (d > 0 && cur >= 0.99) { A.notice('Yeh shelf jitna bara hai — aur bara chahiye to upar se shelf kam karein (5 ki jagah 4 ya 3)'); return; }
      rzSize(id, d ? cur + d * 0.1 : 1); return; }
    const zmv = t.closest('[data-zmv]'); if (zmv && W.rz.it) { const cur = Number(document.querySelector(`#wdZr [data-zi="${CSS.escape(W.rz.it)}"]`)?.dataset.zsh) || 0, n = Math.max(0, Math.min(rzRows(W.rz.k) - 1, cur + Number(zmv.dataset.zmv))); W.racks.sh = W.racks.sh || {}; W.racks.sh[W.rz.it] = n; W.rz.s = n; saveRacks(); return; }
    if (t.closest('[data-zok]')) { W.rz.it = ''; paint(); return; }
    const zi = t.closest('[data-zi]'); if (zi) { W.rz.it = W.rz.it === zi.dataset.zi ? '' : zi.dataset.zi; W.rz.s = Number(zi.dataset.zsh) || 0; paint(); return; }
    const zsf = t.closest('[data-zsf]'); if (zsf) { W.rz.s = Number(zsf.dataset.zsf) || 0; W.rz.it = ''; paint(); return; }
  }
  const up = t.closest('[data-up]'); if (up) { moveRack(up.dataset.up, -1); return; }
  const dn = t.closest('[data-dn]'); if (dn) { moveRack(dn.dataset.dn, 1); return; }
  const hc = t.closest('[data-hc]'); if (hc) { const kk = hc.dataset.hc; if (W.racks.hc[kk]) delete W.racks.hc[kk]; else W.racks.hc[kk] = 1; saveRacks(); return; }
  const row = t.closest('[data-row]'); if (row && W.view === 'list') { if (W.sel) { const id = row.dataset.row; if (W.sel.has(id)) W.sel.delete(id); else W.sel.add(id); paint(); return; } itemSheet(row.dataset.row); return; }
}
addEventListener('resize', () => { if (W && W.view === 'crop') boxPaint(); });
