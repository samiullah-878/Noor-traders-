// wa-sale.js — v1.0 (2026-11-04, app v2.178.0) 📲 WHATSAPP PARCHI SALE — ALAG SCREEN
//   Malik: "purchase ki line jaisi hi sale ki screen par bhi line ho … alag screen jis ka naam WhatsApp Parchi Sale … us mein hum next kaam
//          bhi kar sakenge … sale screen bilkul purchase jaisi ho gi, same ditto copy, bas farq yahan default PCS hoga wahan carton".
//   Raasta: gahak WhatsApp par parchi (tasveer / likha order) → dukan ka WhatsApp → PC (pc/wa-parchi.js, AI wahin) parchi parh kar
//     parchiOrders/<id> {j: lines JSON text, n, u, pr …} + parchiImg/<id> {img} likhta hai aur thermal / A4 par chhapta hai.
//   Yahan: upar orders ki patti (aaj + kal) → tap = bill (POS Purchase jaisi 📊 table PC par / ☰ lines phone par, default PCS).
//     ❓ lines (samajh nahi aayi / kam yaqeen) = tasveer ka tukda + search se sahi item. 🧾 Bill banao = WAHI appSales (sale.js save() jaisa
//     doc) → PC sale-post POS bill + print. Phir order {st 'billed', saleId}. ✓ Maal nikla = {st 'picked'} · 🖨 Dobara print = {prReq}.
//   ⋮: 📷 Parchi photo / 🖼 gallery (app se: parchiImg + parchiOrders {src 'app', st 'new'} → PC parhta hai; 90 s jawab nahi = ⚠️) ·
//     Counter / Wholesale · Table / Lines · print copies · counter · 👤 gahak (v2.179.0: gate pass hata — line ka 🏬 godam chip) · ⚙️ WhatsApp setting (sirf malik: QR, numbers, print).
//   Data attr SIRF `data-ws-*`, root `data-ws-root` — purchase.js ke (pp-root wale) listeners yahan kabhi nahi chalte (aur ulta bhi).
//   Look: purchase ki classes (pp-tbl · pp-cr · pp-foot · pp-hbar · sale-hit …); apni nayi classes `wps-*` (purani .ws-* se takrao nahi).
//   v2.179.1: 🗑 PARCHI HATAO (malik: "parchi katt bhi sake jaise remove kar sake") — khuli parchi ke card par ✕ + ⋮ 🗑 · st 'x:<pehle wala>'
//     (mitti nahi — list se chhupi; ↩ Wapas 6 sec + ⋮ ♻️ Hatai hui) · CAP sale.wshide · PC (wa-parchi v1.1) chhupi ko wapas nahi laata. Rules wahi.
//   v2.179.2: 🔁 DOBARA PARHO (malik OK) — khuli parchi ⋮ 🔁 + ✕ / ⚠️ wale dabbe mein chip → {st:'new'} (rules 2.86 wahi) → PC (wa-parchi claimNew) AI se phir
//     parhe + naya thermal / A4; bill khud dobara bhar jata hai (pendLoad). Bill bana / maal nikla / abhi parh raha = nahi.
//   CAP sale.wsale (default khula). AI app mein NAHI — parchi PC parhta hai. Agent action NAHI (malik ka qaida v2.111.0).
import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, setSaleLineGodamHook, openSaleCamera, stockWaitHTML } from './pos-stock.js?v=2.180.2';
import { smartSearch, noteHit } from './smart-search.js?v=2.180.2';
import { smWatch, smChipHTML, smForDoc, smName } from './sale-man.js?v=2.180.2';   // v2.180.0: 👦 larka (POS SP Man) chip

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);   // tadad 3 decimal tak (0.125)
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const dayStr = (off = 0) => { const d = new Date(Date.now() + off * 864e5), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const todayStr = () => dayStr(0);
const LG = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const LS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const perm = e => /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || ''));
const tms = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : Number(v) || 0;
const hm = ms => { try { return ms ? new Date(Number(ms)).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : ''; } catch { return ''; } };
const ago = ms => { if (!ms) return ''; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' : Math.floor(m / 1440) + ' din'; };
const withT = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(Error('internet / server se jawab nahi')), ms))]);
const stTxt = s => s === 'w' ? '⏳' : s === 'ok' ? '✅' : s === 'bad' ? '✕' : '';
// 📞 Pakistan number: 0300-1234567 · +92 300 1234567 · 923001234567 · 3001234567 → 03001234567 (warna '')
export const phNorm = v => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('0092')) d = d.slice(2); if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2); if (d.length === 10 && d.startsWith('3')) d = '0' + d; return /^03\d{9}$/.test(d) ? d : ''; };
const waOf = ph => { const n = phNorm(ph); return n ? '92' + n.slice(1) : String(ph || '').replace(/\D/g, ''); };
const telOf = ph => phNorm(ph) || String(ph || '').replace(/[^\d+]/g, '');
const ini = n => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => [...w][0]).join('').toUpperCase();

const SALE_BRANCH = 1;          // POS bill hamesha NOOR TRADERS (branch 1) — sale.js jaisa
const DRAFT_KEY = 'sam-ws-draft', VIEW_KEY = 'sam-ws-view', GRP = '📲 WhatsApp Parchi';
const BASE_COUNTERS = [['abdurehman', 'Abdurehman'], ['bilal', 'Bilal bhai'], ['mithu', 'Mithu']];   // sale.js wale ('🖥 Yehi device' yahan nahi — wo print sale.js ki apni line hai)

let C = { cloud: null, rerender: () => {}, notice: () => {}, owner: () => false, uid: () => '', name: () => '', can: () => true, modal: null };
let mode = 'counter', cart = [], cash = null, note = '', saving = false;
let cur = '', curSnap = null, unclear = [], pendLoad = '';          // cur = khuli parchi (order id) · unclear = ❓ lines · pendLoad = PC ka intezar
let selKey = '', addAt = 0, addScrolled = 0, live = false;
let orders = [], ordErr = '', ordErrAt = 0, ordStop = null, ordKey = '', ordFirst = true, tick = null;
const seenAt = new Map(), localOrd = new Map(), imgCache = new Map(), cropCache = new Map(), chipSt = {};

export function wsSetup(o) {
  C = { ...C, ...o };
  try { smWatch(C.cloud); } catch {}   // v2.180.0: 👦
  try {
    const d = JSON.parse(LG(DRAFT_KEY) || 'null');
    if (d && d.day === todayStr()) {
      mode = d.mode === 'wholesale' ? 'wholesale' : 'counter'; cart = Array.isArray(d.cart) ? d.cart : []; cash = d.cash ?? null; note = String(d.note || '');
      cur = String(d.cur || ''); curSnap = d.curSnap && d.curSnap.id === cur ? d.curSnap : null; unclear = Array.isArray(d.unclear) ? d.unclear : []; pendLoad = String(d.pend || '');
    }
  } catch {}
}
function keep() { LS(DRAFT_KEY, JSON.stringify({ day: todayStr(), mode, cart, cash, note, cur, curSnap, unclear, pend: pendLoad })); }
// screen chhori: listener band, footer / 📷 button saaf (sirf ek dafa)
export function wsStop() {
  if (!live) return; live = false;
  try { ordStop?.(); } catch {} ordStop = null; ordKey = '';
  clearInterval(tick); tick = null;
  $('actions')?.classList.remove('pp-foot', 'pp-small', 'wps-foot');
  const b = document.querySelector('label.search .pp-scanbtn.wps-scan'); if (b) { b.closest('label')?.classList.remove('has-scan'); b.remove(); }
}

// ---------- data ----------
function stock() {
  const s = saleStock();
  const base = s.branches.includes(SALE_BRANCH) ? SALE_BRANCH : s.branches[0];
  const items = base == null ? [] : s.itemsFor(base).filter(r => !s.hidden?.[String(r.id)]);
  return { ...s, base, items };
}
function itemIn(g, id) { const st = saleStock(); return st.itemsFor(Number(g)).find(r => String(r.id) === String(id)) || null; }
const brName = (s, b) => (s.branchName ? s.branchName(b, s.names) : '') || s.names?.[b] || ('Godam ' + b);
// v2.179.0: 🏬 godam chip — line ke aakhir mein; dabao = agla godam (NT → G1 → G2 … → NT), na dabao = NOOR TRADERS. Naam se pehchan (number se nahi).
function gdList() { const s = saleStock(); return (s.branches || []).filter(b => Number(b) !== 0).map(b => { const full = String(brName(s, b)), m = full.match(/(\d+)\s*$/);
  return { b: Number(b), name: Number(b) === SALE_BRANCH ? 'NT' : 'G' + (m ? m[1] : full.slice(0, 3)), full }; }).sort((a, b) => (a.b === SALE_BRANCH ? -1 : b.b === SALE_BRANCH ? 1 : a.name.localeCompare(b.name, 'en', { numeric: true }))); }
function gcHTML(l, i) { const L = gdList(); if (L.length < 2) return ''; const g = Number(l.godam) || SALE_BRANCH, c = L.find(x => x.b === g) || L[0];
  return `<button type="button" class="wps-gc${g !== SALE_BRANCH ? ' is-in' : ''}" data-ws-gc="${i}" title="${esc(c.full)} — dabayein = agla godam" aria-label="Godam ${esc(c.full)}">${esc(c.name)}</button>`; }
// v1.61 (sale.js): counter mein KHULA PIECE = Peice Rate (rate2), POORA CARTON = Cotton Rate (rate, fi piece) · wholesale = W rate
const rateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate2) || Number(it.rate) || 0));
const crateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate) || 0));
const setStd = (l, it) => { l.rate = rateFor(it); l.std = l.rate; l.crate = crateFor(it); l.cstd = l.crate; };
const packOf = l => Number(l.pack) > 1 ? Number(l.pack) : 0;
const ctnPcsOf = l => r3((Number(l.ctn) || 0) * packOf(l));
const linePcs = l => r3(ctnPcsOf(l) + (Number(l.pcs) || 0));
const crateOf = l => Number(l.crate ?? l.rate) || 0;
const lineTotal = l => r2(ctnPcsOf(l) * crateOf(l) + (Number(l.pcs) || 0) * (Number(l.rate) || 0));
const cartTotal = () => r2(cart.reduce((n, l) => n + lineTotal(l), 0));
const cashNow = () => mode === 'counter' || cash == null ? cartTotal() : cash;
const newKey = () => 'W' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const qtyTxt = l => { const c = Number(l.ctn) || 0, p = Number(l.pcs) || 0; return packOf(l) && c ? `${num(c)} ${l.cName || 'Ctn'}${p ? ' + ' + num(p) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(p)} ${l.uName || 'Pcs'}`; };
// print / counter / gate — is screen ki apni yaad (pehli dafa Sale screen wali se shuru)
const copiesNow = () => Math.min(3, Math.max(1, Number(LG('sam-ws-copies') || LG('sam-sale-copies')) || 1));
const counterNow = () => { const c = LG('sam-ws-counter') || LG('sam-sale-counter'); return BASE_COUNTERS.some(x => x[0] === c) || c.startsWith('pc:') ? c : 'abdurehman'; };
const gateNow = () => 0;   // v2.179.0: 🚪 Gate pass switch hata (malik: "zaroorat nahi") — har line ka apna godam chip (NT → G1 → G2 … → NT)
const viewNow = () => { const v = LG(VIEW_KEY); return v === 'grid' || v === 'rows' ? v : (window.innerWidth >= 900 ? 'grid' : 'rows'); };
function findByCode(items, code) {
  const clean = String(code).trim(), bare = clean.replace(/^0+/, '');
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...(Array.isArray(r.bq) ? r.bq.map(x => x?.b) : [])].map(x => String(x || '').trim()).filter(Boolean);
  return items.find(r => codesOf(r).includes(clean)) || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare)) || null;
}
function subQty(it, code) {   // POS sub-barcode ki tadad (garam masala 0.25 …)
  const clean = String(code || '').trim(), bare = clean.replace(/^0+/, '');
  if (!clean || !Array.isArray(it?.bq)) return 1;
  const e = it.bq.find(x => { const b = String(x?.b || '').trim(); return b === clean || (bare && b.replace(/^0+/, '') === bare); });
  return Number(e?.q) > 0 ? Number(e.q) : 1;
}
// DEFAULT PCS (purchase mein carton): naya item = 1 Pcs · dobara = +1 Pcs · Pcs ≥ carton = poore carton alag (sale.js jaisa)
function addItem(it, q = 1, ctn = 0) {
  addAt = Date.now(); noteHit(it.id);
  const had = [...cart].reverse().find(l => String(l.id) === String(it.id));
  let l = had;
  if (had) { had.pcs = r3((Number(had.pcs) || 0) + (Number(q) || 0)); had.ctn = (Number(had.ctn) || 0) + (Number(ctn) || 0); }
  else {
    const g = gateNow() || SALE_BRANCH, src = itemIn(g, it.id) || it;
    l = { k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', godam: g, ctn: Number(ctn) || 0, pcs: r3(Number(q) || 0), edited: false };
    setStd(l, src); cart.push(l);
  }
  const pk = packOf(l); if (pk && l.pcs >= pk) { const c = Math.floor(l.pcs / pk + 1e-9); l.ctn = (Number(l.ctn) || 0) + c; l.pcs = r3(l.pcs - c * pk); }
  selKey = l.k; cash = null; keep();
  return { line: l, again: !!had };
}
function setLineGodam(l, b) { l.godam = Number(b) || SALE_BRANCH; const it = itemIn(l.godam, l.id); if (it && !l.edited) setStd(l, it); cash = null; keep(); C.rerender(); }
const scanItemOf = l => ({ id: l.id, code: l.code, name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: crateOf(l), rate2: Number(l.rate) || 0, g: Number(l.godam) || SALE_BRANCH });

// ---------- 📷 camera / scanner gun (pos-stock ke sale hooks — jo screen khule woh apne laga leti hai) ----------
function installHooks() {
  setSaleDelHook(key => { const i = cart.findIndex(l => l.k === key); if (i < 0) return; cart.splice(i, 1); cash = null; keep(); C.rerender(); });
  setSaleCartHook(() => cart.map(l => ({ key: l.k, item: scanItemOf(l), pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
  setSaleFindHook(q => smartSearch(stock().items, q, 12));
  setSaleLineGodamHook((key, b) => { const l = cart.find(x => x.k === key); if (l) setLineGodam(l, b); });
  setSaleQtyHook((it, q, key) => {
    const l = (key && cart.find(x => x.k === key)) || [...cart].reverse().find(x => String(x.id) === String(it.id));
    if (!l) return; l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0; cash = null; keep(); C.rerender();
  });
  setSaleScanHook((code, direct, qty) => {
    const it = direct || findByCode(stock().items, code);
    if (!it) return { state: null };
    const q = Number(qty) > 0 ? r3(qty) : direct ? 1 : subQty(it, code);
    const r = addItem(it, q);
    C.notice(r.again ? `+${num(q)} · ${it.name}` : `✓ ${it.name}${q !== 1 ? ' — ' + num(q) : ''}`);
    const s = $('search'); if (s && s.value) s.value = '';
    C.rerender();
    return { state: 'added', item: scanItemOf(r.line), line: r.line.k, pcs: Number(r.line.pcs) || 0, ctn: Number(r.line.ctn) || 0 };
  });
}
function scanInSearch() {   // 📷 search ke dabbe ke andar (purchase ka .pp-scanbtn look) — doosri screen par wsStop hata deta hai
  const lab = $('search')?.closest('label.search'); if (!lab) return;
  let b = lab.querySelector('.pp-scanbtn');
  if (b && !b.classList.contains('wps-scan')) { b.remove(); b = null; }   // purchase wala 📷 button yahan kaam nahi karta
  if (!b) lab.insertAdjacentHTML('beforeend', '<span class="pp-scanbtn wps-scan"><button type="button" data-ws-camera="1" title="Barcode scan — camera" aria-label="Barcode scan">📷</button></span>');
  lab.classList.add('has-scan');
}

// ---------- 📲 orders (parchiOrders — aaj + kal) ----------
function listenOrders() {
  const key = todayStr();
  if (ordStop && ordKey === key) return;
  if (!ordStop && ordErr && Date.now() - ordErrAt < 30000) return;   // ghalti par har render mein dobara nahi
  try { ordStop?.(); } catch {} ordStop = null; ordKey = key; ordFirst = true;
  if (!C.cloud?.listenParchiOrders) { ordErr = 'old'; return; }
  ordStop = C.cloud.listenParchiOrders([key, dayStr(-1)], list => onOrders(list || []), e => {
    ordErr = perm(e) ? 'rules' : 'net'; ordErrAt = Date.now(); try { ordStop?.(); } catch {} ordStop = null; ordKey = ''; paintOrders();
  });
  clearInterval(tick);
  tick = setInterval(() => {   // ⏳ → ⚠️ (90 s) waqt ke saath — sirf patti / header · listener toota ho to 30 s baad dobara
    if (!document.querySelector('[data-ws-root]')) return;
    if (!ordStop && Date.now() - ordErrAt > 30000) { listenOrders(); return; }
    if (allOrders().some(o => o._local || String(o.st || 'new') === 'new')) { paintOrders(); headPaint(); const w = $('wpsWait'); if (w) w.outerHTML = waitHTML(curOrder()); }
  }, 10000);
}
const hid = o => /^x:/.test(String(o?.st || ''));   // v2.179.1: 🗑 hatai hui (st 'x:<pehle wala>') — list se chhupi, ↩ wapas
const canHide = () => C.owner() || C.can('sale.wshide');
const canReread = o => !!o && !o._local && !hid(o) && !['new', 'read', 'billed', 'picked'].includes(String(o.st || 'new'));   // v2.179.2: 🔁
const ready = o => !!o && !o._local && ('j' in o || 'n' in o) && !['new', 'read', 'fail', 'skip'].includes(String(o.st || 'new'));   // PC ne parh li ('read' = PC parh raha — abhi lines nahi) (sirf server wala doc yahan aata hai)
function onOrders(list) {
  const t = Date.now(), fresh = [];
  for (const o of list) if (!seenAt.has(o.id)) { seenAt.set(o.id, t); if (!ordFirst && o.src !== 'app') fresh.push(o); }
  ordFirst = false; ordErr = '';
  orders = list.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
  if (!live || !document.querySelector('[data-ws-root]')) return;
  if (fresh.length) { C.notice(`📲 Nayi parchi: ${fresh[0].nm || fresh[0].ph || 'WhatsApp'}${fresh.length > 1 ? ' + ' + (fresh.length - 1) : ''}`); try { navigator.vibrate?.(60); } catch {} }
  const o = orders.find(x => x.id === cur);
  if (o) curSnap = snapOf(o);
  if (pendLoad && pendLoad === cur && o) {
    if (ready(o) && stock().loaded) { C.rerender(); return; }   // PC ne parh li — bill khud bhar do (renderWS → fill)
    if (o.st === 'fail' || o.st === 'skip') { pendLoad = ''; keep(); C.rerender(); return; }
  }
  paintOrders(); headPaint(); footPaint();
}
function allOrders() {
  const ids = new Set(orders.map(o => o.id));
  for (const [id, lo] of [...localOrd]) if (ids.has(id) && lo._local !== 'prep') { try { if (String(lo.th).startsWith('blob:')) URL.revokeObjectURL(lo.th); } catch {} lo.th = ''; localOrd.delete(id); }
  return [...localOrd.values(), ...orders.filter(o => !hid(o))].sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
}
const curOrder = () => !cur ? null : orders.find(o => o.id === cur) || localOrd.get(cur) || (curSnap && curSnap.id === cur ? curSnap : null);
const snapOf = o => ({ id: o.id, src: o.src || '', at: Number(o.at) || 0, day: o.day || '', ph: o.ph || '', nm: o.nm || '', st: o.st || '', n: Number(o.n) || 0, u: Number(o.u) || 0, by: o.by || '', txt: String(o.txt || '').slice(0, 2000) });
const rrAt = new Map();   // v2.179.2: 🔁 dobara parhne ka waqt (⚠️ isi se)
const ageOf = o => rrAt.has(o.id) ? Date.now() - rrAt.get(o.id) : o.src === 'app' && o.by && o.by === C.uid() && Number(o.at) ? Date.now() - Number(o.at) : Date.now() - (seenAt.get(o.id) || Date.now());   // apni bheji = apni ghari · baqi = jab is phone ne dekhi (PC ki ghari ka farq nahi)
function stOf(o) {
  if (!o) return ['w', ''];
  if (o._local === 'prep') return ['w', '⏳ Tayyar ho rahi'];
  if (o._local === 'send') return ['w', '⏳ Bhej raha'];
  if (o._local === 'err') return ['bad', '✕ ' + (o.err || 'Nahi gayi')];
  const st = String(o.st || 'new'), n = Number(o.n) || 0, u = Number(o.u) || 0;
  if (st === 'new') { const a = ageOf(o); return o.src === 'app' && a > 90000 ? ['warn', '⚠️ PC se jawab nahi'] : a > 240000 ? ['warn', '⚠️ AI se jawab nahi'] : ['w', '⏳ AI parh raha']; }
  if (st === 'read') return ageOf(o) > 240000 ? ['warn', '⚠️ AI se jawab nahi'] : ['w', '⏳ AI parh raha'];   // PC ne utha li, Gemini parh raha
  if (st === 'fail') return ['bad', '✕ ' + String(o.err || 'Parh nahi saka').slice(0, 60)];
  if (st === 'skip') return ['bad', '✕ ' + String(o.err || 'Chhori gayi').slice(0, 60)];
  if (st === 'billed') return ['ok', '🧾 Bill bana'];
  if (st === 'picked') return ['ok', '📦 Maal nikla'];
  return [u ? 'warn' : 'ok', `✅ ${n} items${u ? ' · ❓ ' + u : ''}`];
}
function prOf(o) {   // 🖨 PC ki parchi (thermal / A4)
  const p = o?.pr || {}, v = [p.th, p.a4].filter(x => x && x !== 'off');
  if (!v.length) return '';
  if (!v.includes('failed') && v.some(x => x !== 'done')) return '<i class="wps-pr" title="Chhap rahi">🖨⏳</i>';   // wait / printing / sent
  return v.includes('failed') ? `<i class="wps-pr bad" title="${esc('Print nahi hua' + (o.perr ? ': ' + o.perr : ''))}">🖨✕</i>` : '<i class="wps-pr ok" title="Chhap gayi">🖨✓</i>';
}
function ordersHTML() {
  const L = allOrders(), t0 = todayStr();
  const err = ordErr === 'rules' ? '<p class="wps-err">🔐 Firebase rules 2.86 abhi nahi lagi — shop PC 5 min mein khud lagata hai.</p>' : ordErr === 'net' ? '<p class="wps-err">📶 Parchiyan load nahi huin — internet? (30 sec mein khud dobara)</p>' : ordErr === 'old' ? '<p class="wps-err">App purani hai — Update karein.</p>' : '';
  if (!L.length) return `<div class="wps-ords" id="wpsOrds">${err}${ordErr ? '' : '<p class="wps-oempty">📲 Aaj koi parchi nahi aayi — gahak ki parchi dukan ke WhatsApp se PC ke number par forward karein, ya ⋮ → 📷 Parchi photo.</p>'}</div>`;
  return `<div class="wps-ords" id="wpsOrds">${err}<div class="wps-orow">${L.map(o => {
    const [cl, lab] = stOf(o), who = o.nm || o.ph || (o.src === 'app' ? 'App ki parchi' : 'WhatsApp parchi');
    const th = o.th ? `<img src="${esc(o.th)}" alt="" loading="lazy">` : `<span class="wps-oi">${o.src === 'app' ? '📷' : o.txt && !o.cap ? '✍️' : '📲'}</span>`;
    return `<button type="button" class="wps-oc ${cl}${o.id === cur ? ' is-in' : ''}${o.st === 'billed' ? ' done' : ''}" data-ws-ord="${esc(o.id)}">${th}<span class="wps-ot"><b>${esc(who)}</b><small>${o.day && o.day !== t0 ? 'kal · ' : ''}${esc(hm(o.at))}${o.nm && o.ph ? ' · ' + esc(o.ph) : ''}</small><i class="wps-ost ${cl}">${esc(lab)}</i></span>${prOf(o)}${o.id === cur && canHide() && o._local !== 'prep' && o._local !== 'send' ? `<i class="wps-ox" data-ws-hide="${esc(o.id)}" role="button" aria-label="Parchi hatao" title="Parchi hatao">✕</i>` : ''}</button>`;
  }).join('')}</div></div>`;
}
function paintOrders() { const el = $('wpsOrds'); if (el) el.outerHTML = ordersHTML(); }
function waitHTML(o) {
  if (!o || !cur) return '';
  if (pendLoad === cur) { const [cl, lab] = stOf(o); return `<div class="wps-wait ${cl}" id="wpsWait">${esc(lab || '⏳')} — ${o._local === 'err' ? 'parchi par tap kar ke dobara bhejein' : cl === 'warn' ? 'dukan ka PC ON hai? Malik ko batayein · tab tak items upar search / 📷 se khud lagayein' : 'items aate hi bill khud bhar jayega'}</div>`; }   // PC chup = khamosh nahi (malik ka qaida v2.110.0)
  if ((o.st === 'fail' || o.st === 'skip') && !cart.length && !unclear.length) return `<div class="wps-wait bad" id="wpsWait">✕ PC parchi nahi parh saka${o.err ? ' (' + esc(o.err) + ')' : ''} — ⋮ → 🧾 Parchi ki tasveer dekh kar items khud likhein.${canReread(o) ? `<button type="button" class="wps-rr" data-ws-reread="${esc(o.id)}">🔁 Dobara parho</button>` : ''}</div>`;
  return '';
}

// ---------- parchi → bill ----------
const CTN_U = /\b(ctn|ctns|crtn|carton|cartons|cartoon|katon|kartan|peti|pety|box|dabba|dabbe|dibba)\b|کارٹن|کاٹن|پیٹی|ڈبہ|ڈبے|ڈبا|بکس/i;
const DZ_U = /\b(dz|dozen|darjan|darjn)\b|درجن/i;
const KG_U = /\b(kg|kgs|kilo|kilogram|ltr|litre|liter)\b|کلو|لیٹر|لٹر/i;
const GM_U = /\b(g|gm|gms|gram|grams|gr)\b|گرام/i;
function qtyOf(x, it) {   // saada: PCS = q (gol, kam az kam 1) · carton likha ho = Ctn · darjan = ×12 · kg wala item = q (gram → kg)
  const q = Number(x?.q) || 0, u = String(x?.u || ''), pk = Number(it?.pack) > 1 ? Number(it.pack) : 0, kgItem = KG_U.test(String(it?.uName || ''));
  if (pk && q > 0 && CTN_U.test(u)) return { ctn: Math.max(1, Math.round(q)), pcs: 0 };
  if (q > 0 && DZ_U.test(u)) return { ctn: 0, pcs: Math.max(1, Math.round(q * 12)) };
  if (kgItem && q >= 50 && GM_U.test(u) && !KG_U.test(u)) return { ctn: 0, pcs: r3(q / 1000) };
  if (kgItem && q > 0) return { ctn: 0, pcs: r3(q) };
  return { ctn: 0, pcs: q > 0 ? Math.max(1, Math.round(q)) : 1 };
}
function itemAny(id) {   // pehle dukan (branch 1), na mile to kisi bhi godam ki list
  const s = stock(), k = String(id), a = s.items.find(r => String(r.id) === k); if (a) return a;
  for (const b of s.branches) { if (b === s.base) continue; const x = s.itemsFor(b).find(r => String(r.id) === k && !s.hidden?.[k]); if (x) return x; }
  return null;
}
function fill(o) {
  let L = []; try { L = JSON.parse(o.j || '[]'); } catch {} if (!Array.isArray(L)) L = [];
  const s = stock(), byId = new Map(s.items.map(r => [String(r.id), r]));
  cart = []; unclear = []; cash = null; let added = 0;
  L.slice(0, 200).forEach((x, i) => {
    if (!x || typeof x !== 'object') return;
    const sc = x.s == null ? 1 : Number(x.s) || 0, it = x.id ? (byId.get(String(x.id)) || itemAny(x.id)) : null;
    const u = { i, r: String(x.r || '').slice(0, 200), it: String(x.it || '').slice(0, 120), q: Number(x.q) || 0, u: String(x.u || '').slice(0, 30), b: Array.isArray(x.b) && x.b.length === 4 ? x.b.map(Number) : null, id: x.id ? String(x.id) : '', n: String(x.n || '').slice(0, 120), s: sc, rk: String(x.rk || '').slice(0, 40), done: '' };
    if (it && sc >= 0.5) { const q = qtyOf(u, it); addItem(it, q.pcs, q.ctn); added++; } else unclear.push(u);
  });
  addAt = 0; pendLoad = ''; selKey = cart[0]?.k || ''; curSnap = snapOf(o); keep();
  C.notice(`📲 Parchi lag gayi — ${added} items${unclear.length ? ' · ❓ ' + unclear.length + ' dekhein' : ''}`);
}
function loadOrder(id) {
  const o = allOrders().find(x => x.id === id); if (!o) return;
  if (o._local === 'err' && o.file) { if (!confirm('Yeh parchi PC ko nahi gayi — dobara bhejein?')) return; localOrd.delete(id); sendPic(o.file); return; }
  if (id === cur) { if (!cart.length && !unclear.length && ready(o) && stock().loaded) fill(o); C.rerender(); return; }
  if ((cart.length || unclear.some(u => !u.done)) && !confirm('Bill par pehle se items hain — chhor kar yeh parchi kholein?')) return;
  if (o.st === 'billed' && !confirm('Is parchi ka bill pehle ban chuka hai — phir bhi dobara kholein?')) return;
  cart = []; unclear = []; cash = null; note = ''; selKey = ''; cur = id; curSnap = snapOf(o); pendLoad = '';
  if (ready(o) && stock().loaded) { fill(o); C.rerender(); return; }
  if (o.st !== 'fail' && o.st !== 'skip') pendLoad = id;   // PC abhi parh raha / stock aa raha — aate hi khud bharega
  keep(); C.rerender();
  if (pendLoad && !ready(o)) C.notice('⏳ PC abhi parchi parh raha hai — items aate hi khud lag jayenge');
}

// ---------- ❓ samajh nahi aayi lines: tasveer ka tukda + search ----------
function imgOf(id) {
  if (!imgCache.has(id)) { imgCache.set(id, (C.cloud?.getParchiImg ? C.cloud.getParchiImg(id) : Promise.resolve('')).catch(() => '')); while (imgCache.size > 4) imgCache.delete(imgCache.keys().next().value); }
  return imgCache.get(id);
}
const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(Error('tasveer nahi khuli')); im.src = src; });
function cropOf(im, b) {   // b = [ymin, xmin, ymax, xmax] 0–1000 (AI box) — thora upar / neeche zyada taake poori likhai aaye
  const W = im.naturalWidth || 1, H = im.naturalHeight || 1;
  let [y0, x0, y1, x1] = b.map(v => Math.max(0, Math.min(1000, Number(v) || 0))); if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 < x0) [x0, x1] = [x1, x0];
  const bh = y1 - y0, bw = x1 - x0;
  y0 = Math.max(0, y0 - bh * 0.35 - 6); y1 = Math.min(1000, y1 + bh * 0.35 + 6); x0 = Math.max(0, x0 - bw * 0.06 - 8); x1 = Math.min(1000, x1 + bw * 0.06 + 8);
  const sx = x0 / 1000 * W, sy = y0 / 1000 * H, sw = Math.max(4, (x1 - x0) / 1000 * W), sh = Math.max(4, (y1 - y0) / 1000 * H);
  const k = Math.min(1, 520 / sw, 150 / sh), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}
let cropBusy = false;
async function paintCrops() {
  const id = cur; if (!id || cropBusy) return;
  const need = unclear.filter(u => !u.done && Array.isArray(u.b) && u.b.length === 4 && !cropCache.has(id + '|' + u.i));
  if (!need.length) return;
  cropBusy = true;
  const put = (i, v) => { const el = document.querySelector(`#list [data-ws-crop="${i}"]`); if (el && cur === id) el.innerHTML = String(v).startsWith('data:') ? `<img src="${v}" alt="">` : esc(v); };
  try {
    const src = await imgOf(id);
    if (!src) { imgCache.delete(id); need.forEach(u => put(u.i, '📄')); return; }   // tasveer nahi (ya net) — agli dafa dobara
    const im = await loadImg(src); if (cur !== id) return;
    for (const u of need) { let v = ''; try { v = cropOf(im, u.b); } catch {} cropCache.set(id + '|' + u.i, v); put(u.i, v || '📄'); }
    while (cropCache.size > 80) cropCache.delete(cropCache.keys().next().value);
  } catch { need.forEach(u => put(u.i, '📄')); } finally { cropBusy = false; }
}
const sugHTML = u => u.id && u.n ? `<button type="button" class="wps-uh wps-sug" data-ws-upick="${u.i}|${esc(u.id)}">✓ ${esc(u.n)}<small>AI ka andaza</small></button>` : '';
function uHits(u) {
  const q = String(u.qq ?? u.it ?? '').trim(); if (!q) return '<small class="wps-mut">Item ka naam likhein</small>';
  const L = smartSearch(stock().items, q, 8).filter(r => String(r.id) !== String(u.id)).slice(0, 6);
  return L.map(r => `<button type="button" class="wps-uh" data-ws-upick="${u.i}|${esc(r.id)}">${esc(r.name)}<small>R ${num(r.rate2 || r.rate)} · stock ${num(r.stock)}</small></button>`).join('') || (u.id && u.n ? '' : '<small class="wps-mut">Kuch nahi mila — naam badal kar likhein</small>');
}
function uRowHTML(u) {
  const crop = cropCache.get(cur + '|' + u.i);
  const pic = Array.isArray(u.b) && u.b.length === 4 ? `<span class="wps-crop" data-ws-crop="${u.i}" data-ws-pv="1" title="Poori parchi">${crop ? `<img src="${esc(crop)}" alt="">` : crop === '' ? '📄' : '⏳'}</span>` : '';
  const sub = [u.it && u.it !== u.r ? 'AI: ' + esc(u.it) : '', Number(u.q) ? num(u.q) + (u.u ? ' ' + esc(u.u) : '') : esc(u.u), u.rk ? '🗄 ' + esc(u.rk) : ''].filter(Boolean).join(' · ');
  return `<div class="wps-ur" data-ws-ur="${u.i}">
    <div class="wps-ur1">${pic}<span class="wps-urt"><b class="wps-raw" dir="auto">${esc(u.r || u.it || '—')}</b>${sub ? `<small>${sub}</small>` : ''}</span><button type="button" class="wps-ux" data-ws-uskip="${u.i}" title="Is line ko chhoro" aria-label="Chhoro">✕</button></div>
    <label class="wps-uql"><input type="search" data-ws-uq="${u.i}" value="${esc(u.qq ?? u.it ?? '')}" placeholder="🔍 sahi item ka naam" autocomplete="off" enterkeyhint="done"></label>
    <div class="wps-uhits" data-ws-uhits="${u.i}">${sugHTML(u)}${uHits(u)}</div></div>`;
}
function unclearHTML() {
  if (!cur || !unclear.length) return '';
  const left = unclear.filter(u => !u.done), hand = unclear.filter(u => u.done && u.done !== 'skip').length, sk = unclear.filter(u => u.done === 'skip').length;
  const back = sk ? `<button type="button" class="wps-uc" data-ws-uback="1">↩ ${sk} chhori wapas</button>` : '';
  if (!left.length) return `<div class="wps-unc wps-unc-ok" id="wpsUnc"><span>✓ Parchi ki sab lines theek${hand ? ' · ' + hand + ' haath se' : ''}</span>${back}</div>`;
  return `<div class="wps-unc" id="wpsUnc"><div class="wps-unh"><b>❓ Samajh nahi aaya · ${left.length}</b><small>tukda dekh kar sahi item chunein</small>${back}</div>${left.map(uRowHTML).join('')}</div>`;
}
function uPick(i, id) {
  const u = unclear.find(x => String(x.i) === String(i)), it = itemAny(id); if (!u) return;
  if (!it) { C.notice('Yeh item stock list mein nahi (band?) — doosra chunein'); return; }
  const q = qtyOf(u, it); addItem(it, q.pcs, q.ctn); u.done = String(it.id); u.dn = it.name; keep();
  C.notice('✓ ' + it.name + ' · ' + qtyTxt(cart.find(l => l.k === selKey) || { pcs: q.pcs, ctn: q.ctn, uName: it.uName, cName: it.cName, pack: it.pack }));
  C.rerender();
}

// ---------- screen ----------
function hbarHTML(o) {
  const nm = o?.nm || '', ph = o?.ph || '', [cl, lab] = stOf(o);
  const av = o ? esc(ini(nm) || '📲') : '📲';
  return `<div class="pp-hbar wps-hbar"><span class="pp-av">${av}</span><b>${o ? esc(nm || ph || (o.src === 'app' ? 'App ki parchi' : 'WhatsApp parchi')) : 'Naya bill'}</b>${o && nm && ph ? `<span class="pp-hsep">·</span><span>${esc(ph)}</span>` : ''}${ph ? `<a class="wps-hc" href="tel:${esc(telOf(ph))}" title="Call" aria-label="Call">📞</a><a class="wps-hc wa" href="https://wa.me/${esc(waOf(ph))}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">💬</a>` : ''}${o && lab ? `<em class="wps-hst ${cl}">${esc(lab)}</em>` : ''}<i>${mode === 'wholesale' ? '📦 Wholesale' : '🛒 Counter'}</i>${smChipHTML()}</div>`;   // v2.180.0: 👦 larka chip
}
function headPaint() { const h = document.querySelector('#summary .wps-hbar'); if (h) h.outerHTML = hbarHTML(curOrder()); }
function gahakBox(o) {
  return `<div class="wps-gbox" data-mn-box="ws.gahak" data-mn-i="👤" data-mn-t="Gahak ka naam / number" data-mn-s="${esc([o.nm, o.ph].filter(Boolean).join(' · ') || 'likhein')}" data-mn-g="${GRP}">
    <label>👤 Naam<input data-ws-gnm="1" maxlength="60" value="${esc(o.nm || '')}" autocomplete="off"></label>
    <label>📞 Number<input type="tel" inputmode="tel" data-ws-gph="1" maxlength="20" value="${esc(o.ph || '')}" placeholder="0300-1234567" autocomplete="off"></label>
    <button type="button" class="wps-tc pri" data-ws-gsave="1">💾 Save</button><i class="wps-wst" id="wpsGst">${stTxt(chipSt.g)}</i></div>`;
}
function toolsHTML(o) {
  const v = viewNow(), cp = copiesNow(), ctr = counterNow();
  const seg = (k, i, t, sub, body) => `<div class="pp-vseg" data-mn-seg="${k}" data-mn-i="${i}" data-mn-t="${t}"${sub ? ` data-mn-s="${esc(sub)}"` : ''} data-mn-g="${GRP}">${body}</div>`;
  const B = (on, at, val, lab) => `<button type="button" class="${on ? 'is-in' : ''}" data-ws-${at}="${esc(val)}">${lab}</button>`;
  return `<div class="account-tools pp-tools wps-tools">
    <button type="button" class="sh-wide" data-ws-cam="1" data-mn="ws.cam" data-mn-i="📷" data-mn-t="Parchi photo" data-mn-s="camera — PC parh kar items bharega" data-mn-g="${GRP}">📷 Parchi photo</button>
    <button type="button" class="sh-wide" data-ws-gal="1" data-mn="ws.gal" data-mn-i="🖼" data-mn-t="Parchi gallery se" data-mn-s="phone mein rakhi tasveer" data-mn-g="${GRP}">🖼 Gallery se parchi</button>
    ${o && canHide() && !hid(o) && o._local !== 'prep' && o._local !== 'send' ? `<button type="button" class="sh-wide" data-ws-hide="${esc(o.id)}" data-mn="ws.hide" data-mn-i="🗑" data-mn-t="Parchi hatao" data-mn-s="list se — ↩ wapas ho sakti hai" data-mn-g="${GRP}">🗑 Parchi hatao</button>` : ''}
    ${canReread(o) ? `<button type="button" class="sh-wide" data-ws-reread="${esc(o.id)}" data-mn="ws.reread" data-mn-i="🔁" data-mn-t="Dobara parho" data-mn-s="AI phir se parhe + naya print" data-mn-g="${GRP}">🔁 Dobara parho</button>` : ''}
    ${canHide() && orders.some(hid) ? `<button type="button" class="sh-wide" data-ws-hidlist="1" data-mn="ws.hid" data-mn-i="♻️" data-mn-t="Hatai hui parchiyan" data-mn-s="${orders.filter(hid).length} — tap = wapas list mein" data-mn-g="${GRP}">♻️ Hatai hui parchiyan</button>` : ''}
    ${o && !o._local ? `<button type="button" class="sh-wide" data-ws-pv="1" data-mn="ws.pv" data-mn-i="🧾" data-mn-t="Parchi ki tasveer" data-mn-s="poori parchi dekhein" data-mn-g="${GRP}">🧾 Parchi ki tasveer</button>${gahakBox(o)}` : ''}
    ${seg('ws.mode', '🛒', 'Sale ki qism', mode === 'wholesale' ? 'Wholesale (W rate)' : 'Counter (R rate)', B(mode === 'counter', 'mode', 'counter', '🛒 Counter') + (C.can('sale.wholesale') ? B(mode === 'wholesale', 'mode', 'wholesale', '📦 Wholesale') : ''))}
    ${seg('ws.view', '📊', 'Bill ka look', v === 'grid' ? 'Table' : 'Lines', B(v === 'grid', 'view', 'grid', '📊 Table') + B(v === 'rows', 'view', 'rows', '☰ Lines'))}
    ${seg('ws.cp', '🖨', 'Bill kitni dafa chhape', '×' + cp, [1, 2, 3].map(n => B(cp === n, 'copies', n, '×' + n)).join(''))}
    ${C.can('sale.pc') ? seg('ws.ctr', '🖨', 'Kis counter par print', '', BASE_COUNTERS.map(([k, n]) => B(ctr === k, 'counter', k, n)).join('') + (ctr.startsWith('pc:') ? B(true, 'counter', ctr, '💻 PC (Sale screen wala)') : '')) : ''}
    ${C.owner() ? `<button type="button" class="sh-wide" data-ws-set="1" data-mn="ws.set" data-mn-i="⚙️" data-mn-t="WhatsApp setting" data-mn-s="QR · numbers · print" data-mn-g="${GRP}">⚙️ WhatsApp setting</button>` : ''}
  </div>`;
}
function lineInfo(l, s, IX) {
  const lg = Number(l.godam) || SALE_BRANCH;
  let m = IX.get(lg); if (!m) { m = new Map(s.itemsFor(lg).map(r => [String(r.id), r])); IX.set(lg, m); }
  const it = m.get(String(l.id)) || null, short = !!it && linePcs(l) > (Number(it.stock) || 0) + 0.0005;
  return { lg, it, short, block: short && lg !== SALE_BRANCH };
}
function subTxt(l, f, s, tbl) {
  const pk = packOf(l), Cn = esc(l.cName || 'Ctn');
  const parts = [pk ? '1 ' + Cn + ' = ' + num(pk) : '', 'stock ' + (f.it ? num(f.it.stock) : '—') + (f.lg !== SALE_BRANCH ? ' (' + esc(brName(s, f.lg)) + ')' : ''),
    pk && Math.abs(crateOf(l) - (Number(l.rate) || 0)) > 0.004 ? Cn + ' rate ' + num(r2(crateOf(l) * pk)) : '', l.edited ? '✎ apna rate' : '',
    f.block ? '<i>⛔ godam mein stock nahi</i>' : f.short ? '<i>stock kam</i>' : ''].filter(Boolean).join(' · ');
  return (l.code ? (tbl ? `<u class="pp-tcd">${esc(l.code)} · </u>` : esc(l.code) + ' · ') : '') + parts;
}
const freshCls = i => i === cart.length - 1 && Date.now() - addAt < 1800 ? ' fresh' : '';
const qInp = (k, i, v, cls = '') => `<input class="${cls}" type="number" min="0" step="${k === 'ctn' ? '1' : 'any'}" inputmode="${k === 'ctn' ? 'numeric' : 'decimal'}" data-ws-${k}="${i}" value="${Number(v) ? r3(v) : ''}">`;
const rateInp = (l, i) => `<input class="${l.edited ? 'chg' : ''}" type="number" min="0" step="any" inputmode="decimal" data-ws-rate="${i}" value="${Number(l.rate) ? r2(l.rate) : ''}"${C.owner() ? '' : ' readonly tabindex="-1" title="Rate POS wala — sirf malik badal sakta hai"'}>`;
// 📊 TABLE (PC) — POS Purchase ki table jaisi: # · Code · Item · Ctn · Pcs · Rate (fi pc) · Raqam · ✕
function gridHTML(s, IX) {
  const anyPk = cart.some(l => packOf(l));
  const cols = [['#', 'n'], ['Code', 'cd'], ['Item', 'nm'], ...(anyPk ? [['Ctn', 'q']] : []), ['Pcs', 'q'], ['Rate / Pcs', 'r'], ['Raqam', 'a'], ['', 'x']];
  let tc = 0, tp = 0;
  const body = cart.map((l, i) => {
    const pk = packOf(l), f = lineInfo(l, s, IX); tc += pk ? Number(l.ctn) || 0 : 0; tp += Number(l.pcs) || 0;
    return `<tr class="pp-line pp-tr${l.k === selKey ? ' sel' : ''}${f.short ? ' warn' : ''}${freshCls(i)}" data-ws-line="${i}" data-ws-sel="${esc(l.k)}">
      <td class="n">${i + 1}</td><td class="cd">${esc(l.code || '')}</td>
      <td class="nm"><button type="button" data-ws-open="${esc(l.k)}" title="Yeh line chunein"><b>${esc(l.name)}</b><small>${subTxt(l, f, s, true)}</small></button></td>
      ${anyPk ? `<td class="q">${pk ? qInp('ctn', i, l.ctn) : ''}</td>` : ''}
      <td class="q">${qInp('pcs', i, l.pcs)}</td>
      <td class="r">${rateInp(l, i)}</td>
      <td class="a"><span class="wps-amt" data-ws-amt="${i}">${num(lineTotal(l))}</span></td>
      <td class="x">${gcHTML(l, i)}<button type="button" class="danger sale-x" data-ws-del="${i}" aria-label="Hatao">✕</button></td></tr>`;
  }).join('');
  return `<div class="pp-tw"><table class="pp-tbl wps-tbl"><thead><tr>${cols.map(([t, c]) => `<th class="${c}">${t}</th>`).join('')}</tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td class="n"></td><td class="cd"></td><td class="nm"><b>${cart.length} items</b></td>${anyPk ? `<td class="q"><b id="wpsTc">${num(tc)}</b></td>` : ''}<td class="q"><b id="wpsTp">${num(tp)}</b></td><td colspan="3" class="tt"><b id="wpsTot">Total Rs ${num(cartTotal())}</b></td></tr></tfoot></table></div>`;
}
// ☰ LINES (phone) — purchase ki .pp-cr jaisi: naam · stock · Rs / Ctn · Pcs · Rate · Raqam
function rowsHTML(s, IX) {
  const K = (lab, html) => `<label class="pp-k"><small>${lab}</small>${html}</label>`;
  return cart.map((l, i) => {
    const pk = packOf(l), f = lineInfo(l, s, IX), U = esc(l.uName || 'Pcs'), Cn = esc(l.cName || 'Ctn');
    const amt = K('Raqam', `<span class="wps-ro" data-ws-amt="${i}">${num(lineTotal(l))}</span>`), rt = K('Rate / ' + U, rateInp(l, i));
    const g = pk ? [K(Cn + ' (' + num(pk) + ')', qInp('ctn', i, l.ctn, 'q')), K(U, qInp('pcs', i, l.pcs, 'q')), rt, amt] : [K(U, qInp('pcs', i, l.pcs, 'q')), rt, amt];
    return `<div class="sale-line pp-line pp-cr${l.k === selKey ? ' sel' : ''}${f.short ? ' warn' : ''}${freshCls(i)}" data-ws-line="${i}" data-ws-sel="${esc(l.k)}">
      <div class="pp-cr1"><span class="pp-no">${i + 1}.</span><b>${esc(l.name)}</b><small>${subTxt(l, f, s, false)}</small><em class="pp-rs" data-ws-rs="${i}">Rs ${num(lineTotal(l))}</em>${gcHTML(l, i)}</div>
      <div class="pp-cg pp-cg${g.length}">${g.join('')}</div></div>`;
  }).join('') + `<div class="pp-crf"><b>${cart.length} items</b><b id="wpsTot">Total Rs ${num(cartTotal())}</b></div>`;
}
const noteBase = () => { const o = curOrder(); return o ? ['WA parchi', o.nm, o.ph].filter(Boolean).join(' · ') : 'WA parchi'; };
const noteOut = () => [noteBase(), note.trim()].filter(Boolean).join(' · ').slice(0, 100);
function dueText() {
  const T = cartTotal(), due = r2(T - cashNow());
  return due > 0 ? `Udhaar: Rs ${num(due)} (whole sale khate mein)` : due < 0 ? `<span class="red">Cash bill se zyada hai (Rs ${num(-due)})</span>` : 'Poora cash';
}
function payHTML() {
  return `<div class="sale-pay wps-pay">${mode === 'wholesale' ? `<label>Cash mila (baqi whole sale khate mein udhaar)<input type="number" min="0" step="any" inputmode="decimal" data-ws-cash="1" value="${cashNow()}"></label><p id="wpsDue" class="stat-note">${dueText()}</p>` : ''}
    <label>Note (ikhtiyari) — bill par: <b>${esc(noteBase())}</b><input maxlength="60" data-ws-note="1" value="${esc(note)}" placeholder="aur kuch likhna ho"></label>
    <p class="stat-note wps-hint">ℹ️ Abhi bill Counter / Wholesale par banta hai — gahak ka khata agla kaam. ${C.owner() ? 'Aap ka likha rate PC lagata hai.' : 'Rate POS wala (sirf malik badal sakta hai).'}</p></div>`;
}
function keepScan(el) {   // scan box upar nazar rahe; nayi line uske neeche
  const sb = $('search'); if (!el || !sb) return;
  const r = el.getBoundingClientRect(), s = sb.getBoundingClientRect(), vh = window.innerHeight || 800;
  if (r.top >= 0 && r.bottom <= vh && s.top >= 0 && s.bottom <= vh) return;
  window.scrollTo({ top: Math.max(0, (window.scrollY || 0) + s.top - 8), behavior: 'smooth' });
}
export function renderWS() {
  live = true; installHooks(); listenOrders(); picInputs();
  const s = stock();
  if (s.loaded && pendLoad && pendLoad === cur) { const o = orders.find(x => x.id === cur); if (ready(o)) fill(o); else if (o && (o.st === 'fail' || o.st === 'skip')) { pendLoad = ''; keep(); } }
  if (!C.owner() && s.loaded) cart.forEach(l => { const it = itemIn(l.godam, l.id); if (it) { setStd(l, it); l.edited = false; } });   // mulazim = hamesha POS ka rate
  if (cart.length && !cart.some(l => l.k === selKey)) selKey = cart[cart.length - 1].k;
  const o = curOrder();
  $('summary').innerHTML = `<div class="stock-head sale-head pp-head wps-head" data-ws-root="1">${hbarHTML(o)}${toolsHTML(o)}</div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya item ka naam / code (Enter)';
  scanInSearch();
  const ords = ordersHTML();
  if (s.failed) { $('list').innerHTML = ords + `<div class="empty"><strong>Items nahi mile</strong><p>${esc(s.failed)}</p></div>`; footPaint(); return; }
  if (!s.loaded) { $('list').innerHTML = ords + waitHTML(o) + stockWaitHTML(); footPaint(); return; }
  const q = norm(si?.value || '');
  let found = '';
  if (q) {
    const hits = smartSearch(s.items, q, 25);
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-ws-add="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate2 || r.rate)}${r.wrate ? ' · W ' + num(r.wrate) : ''} · stock ${num(r.stock)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''}</small></button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }
  const IX = new Map(), wait = waitHTML(o);
  const rows = cart.length ? (viewNow() === 'grid' ? gridHTML(s, IX) : rowsHTML(s, IX)) : '';
  $('list').innerHTML = ords + found + wait + unclearHTML() + (cart.length ? `<div class="sale-cart pp-gridc">${rows}</div>${payHTML()}`
    : (q || wait || unclear.length ? '' : '<div class="empty"><strong>📲 WhatsApp Parchi Sale</strong><p>Upar se parchi chunein — ya item ka naam likhein / 📷 scan karein. Naya item = 1 Pcs.</p></div>'));
  if (addAt && Date.now() - addAt < 1800 && addAt !== addScrolled) { addScrolled = addAt; requestAnimationFrame(() => keepScan(document.querySelector('#list .pp-line.fresh'))); }
  footPaint();
  if (unclear.some(u => !u.done && u.b)) requestAnimationFrame(() => { paintCrops(); });
}

// ---------- neeche ki patti (purchase ka pp-foot + pp-cbar) ----------
function selIx() { const i = cart.findIndex(l => l.k === selKey); return i >= 0 ? i : cart.length - 1; }
const chipLbl = (k, lab) => chipSt[k] ? `${stTxt(chipSt[k])} ${lab}` : lab;
function footHTML() {
  const o = curOrder(); if (!cart.length && !o) return '';
  const i = selIx(), l = cart[i];   // v2.179.0: godam ab line ke aakhir mein chip (neeche select nahi)
  const line = l ? `<div class="pp-cb1"><span class="pp-cbn">⚡ <b>${i + 1}. ${esc(l.name)}</b> · ${esc(qtyTxt(l))}</span><button type="button" class="pp-cbx" data-ws-del="${i}" aria-label="Hatao">✕</button></div>` : '';
  const oc = o && !o._local && String(o.st || 'new') !== 'new' ? `<div class="pp-cb2 wps-fch">${o.st === 'billed' ? '<span class="wps-fc ok">🧾 Bill bana</span>' : o.st === 'picked' ? '<span class="wps-fc ok">📦 Maal nikla ✓</span>' : `<button type="button" class="wps-fc" data-ws-pick="1">${chipLbl('pick', '✓ Maal nikla')}</button>`}<button type="button" class="wps-fc" data-ws-reprint="1">${chipLbl('print', '🖨 Dobara print')}</button></div>` : '';
  const bar = line || oc ? `<div class="pp-cbar" id="wpsCbar">${line}${oc}</div>` : '';
  return bar + `<button class="give" data-ws-clear="1">✕ Naya</button>` + (cart.length ? `<button class="got" data-ws-save="1"${saving ? ' disabled' : ''}>${saving ? '⏳ Bhej raha…' : '🧾 Bill banao · Rs ' + num(cartTotal())}</button>` : '');
}
function footPaint() {
  const a = $('actions'); if (!a || !document.querySelector('[data-ws-root]')) return;
  if (a.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT') return;   // godam chunte waqt nahi
  const h = footHTML(); a.innerHTML = h;
  a.classList.toggle('pp-foot', h.includes('pp-cbar')); a.classList.toggle('pp-small', !!h); a.classList.add('wps-foot');
}
function refreshTotals() {   // likhte waqt poora render nahi (focus na toote) — sirf raqam
  const T = cartTotal();
  cart.forEach((l, i) => {
    document.querySelectorAll(`#list [data-ws-amt="${i}"]`).forEach(e => { e.textContent = num(lineTotal(l)); });
    document.querySelectorAll(`#list [data-ws-rs="${i}"]`).forEach(e => { e.textContent = 'Rs ' + num(lineTotal(l)); });
  });
  const tt = $('wpsTot'); if (tt) tt.textContent = 'Total Rs ' + num(T);
  const tc = $('wpsTc'); if (tc) tc.textContent = num(cart.reduce((n, l) => n + (packOf(l) ? Number(l.ctn) || 0 : 0), 0));
  const tp = $('wpsTp'); if (tp) tp.textContent = num(cart.reduce((n, l) => n + (Number(l.pcs) || 0), 0));
  const c = document.querySelector('[data-ws-cash]'); if (c && cash == null && document.activeElement !== c) c.value = T;
  const d = $('wpsDue'); if (d) d.innerHTML = dueText();
  const b = document.querySelector('[data-ws-save]'); if (b && !saving) b.textContent = '🧾 Bill banao · Rs ' + num(T);
  const l = cart[selIx()], cn = document.querySelector('#wpsCbar .pp-cbn'); if (l && cn) cn.innerHTML = `⚡ <b>${selIx() + 1}. ${esc(l.name)}</b> · ${esc(qtyTxt(l))}`;
}
function selSet(k) {
  if (!k || k === selKey) return; selKey = k;
  document.querySelectorAll('#list [data-ws-sel].sel').forEach(x => x.classList.remove('sel'));
  document.querySelectorAll(`#list [data-ws-sel="${CSS.escape(k)}"]`).forEach(x => x.classList.add('sel'));
  footPaint();
}

// ---------- 🧾 BILL BANAO — WAHI appSales doc jo sale.js save() banata hai ----------
async function save() {
  if (saving) return;
  const s = stock(), gate = gateNow(), lines = []; let empty = 0;
  for (const l of cart) {   // carton aur khule piece ka rate alag ho to POS ko DO lines (unit ctn / pcs) — sale.js v1.61 jaisa
    const base = { id: String(l.id), code: String(l.code || ''), name: String(l.name || ''), pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, godam: gate > 0 ? gate : (Number(l.godam) || SALE_BRANCH) };
    const cq = ctnPcsOf(l), pq = r3(Number(l.pcs) || 0), cr = r2(crateOf(l)), pr = r2(l.rate);
    if (!(cq + pq > 0.0005)) { empty++; continue; }
    if (cq && pq && Math.abs(cr - pr) > 0.004) { lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) }); lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) }); }
    else if (cq && !pq) lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
    else if (!cq) lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    else lines.push({ ...base, qty: r3(cq + pq), rate: pr, std: r2(l.std) });
  }
  if (!lines.length) { C.notice('Kisi item ki tadad likhein'); return; }
  if (lines.length > 150) { C.notice('Ek bill mein 150 lines tak — do bill banayein'); return; }
  const short = [];   // POS ka qanoon: GODAM (NOOR TRADERS ke ilawa) mein stock kam = sale nahi
  for (const l of cart) {
    const g = gate > 0 ? gate : (Number(l.godam) || SALE_BRANCH); if (g === SALE_BRANCH) continue;
    const need = linePcs(l); if (!(need > 0)) continue;
    const it = itemIn(g, l.id), have = it ? Number(it.stock) || 0 : 0;
    if (have < need - 0.0005) short.push(`${l.name}: ${brName(s, g)} mein stock ${num(have)}, chahiye ${num(need)}`);
  }
  if (short.length) { alert('Godam mein stock kam hai — sale nahi ban sakti:\n\n' + short.join('\n') + '\n\nGodam badlein (NOOR TRADERS par rok nahi).'); return; }
  const left = cur ? unclear.filter(u => !u.done).length : 0;
  if (left && !confirm(`❓ Parchi ki ${left} line abhi samajh nahi aayi (bill mein nahi jayegi). Phir bhi bill banayein?`)) return;
  if (empty && !confirm('Jin items ki tadad khali hai woh bill mein nahi jayenge. Theek hai?')) return;
  if (lines.some(l => !(l.rate > 0)) && !confirm('Kisi item ka rate 0 hai. Phir bhi bill banayein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  if (!(total > 0.005)) { C.notice('Bill ka total 0 hai — tadad / rate dekhein'); return; }
  let paid = r2(cashNow());
  if (mode === 'counter') paid = total;   // POS: counter sale ka CashReceived = bill
  else if (paid > total) { C.notice('Cash bill se zyada nahi ho sakta'); return; }
  const o = curOrder(), who = o ? [o.nm, o.ph].filter(Boolean).join(' · ') : '', oid = o && !o._local ? o.id : '';
  const msg = `${mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE'}${who ? ' · ' + who : ''}\n${lines.length} items · Rs ${num(total)}` + (mode === 'wholesale' ? `\nCash Rs ${num(paid)}${total - paid > 0 ? ' · Udhaar Rs ' + num(total - paid) : ''}` : '') + (smName() ? '\n👦 Larka: ' + smName() : '') + '\n\nBill banayein? (PC POS mein bill bana kar print karega)';
  if (!confirm(msg)) return;
  saving = true; footPaint();
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let token = 0;
  try { token = await Promise.race([C.cloud.nextToken(todayStr()), new Promise((_, j) => setTimeout(() => j(Error('token der')), 4000))]); }
  catch { const k = 'sam-tok-' + todayStr(); token = Number(LG(k) || 0) + 1; LS(k, String(token)); }
  const doc = { id, copies: copiesNow(), counter: counterNow(), token: Math.max(0, Math.floor(Number(token) || 0)), crates: 1, date: todayStr(), at: new Date().toISOString(), mode, branch: SALE_BRANCH, godam: SALE_BRANCH, gate: gate > 0 ? gate : 0,
    lines, total, cash: paid, note: noteOut(), role: C.owner() ? 'owner' : 'staff', by: C.uid(), status: 'new', createdAt: Date.now() };
  { const sm = smForDoc(C.cloud); if (sm) doc.sm = sm; }   // v2.180.0: 👦 larka → PC POS Sale.SupplyManID
  const snap = { cart: cart.slice(), unclear: unclear.slice(), cur, curSnap, note, mode, cash };
  try {
    const p = C.cloud.saveAppSale(doc);
    await Promise.race([p, new Promise(r => setTimeout(r, 4000))]);   // internet na ho to bhi phone par mehfooz; net aate hi chali jayegi
    if (oid) {   // 🧾 parchi par bill ka link — bill server par pakka hone ke BAAD (ghalat link kabhi nahi)
      const patch = { st: 'billed', saleId: id, by: C.uid(), upAt: Date.now() }, lo = orders.find(x => x.id === oid), was = lo ? { st: lo.st, saleId: lo.saleId } : null;
      if (lo) Object.assign(lo, patch);
      p.then(() => Promise.resolve(C.cloud.updateParchiOrder?.(oid, patch)).catch(er => C.notice('⚠️ Bill ban gaya magar parchi par "bill bana" nahi likha: ' + (perm(er) ? 'ijazat (rules)' : er?.message || er))),
        () => { if (lo && was) Object.assign(lo, was); paintOrders(); });   // bill hi nahi gaya = parchi pehle jaisi
    }
    cart = []; unclear = []; cur = ''; curSnap = null; pendLoad = ''; cash = null; note = ''; mode = 'counter'; selKey = ''; keep();
    C.notice(`🧾 Bill PC ko gaya${who ? ' — ' + who : ''} · PC bana kar print karega`);
    setTimeout(() => { const se = $('search'); if (se) se.value = ''; }, 60);
    p.catch(err => {   // server ne mana kar diya: bill wapas screen par (khoye nahi)
      if (!cart.length) { ({ cart, unclear, cur, curSnap, note, mode, cash } = snap); keep(); C.rerender(); }
      alert('Bill PC tak NAHI gaya: ' + (err?.message || err) + '\nBill wapas screen par hai — dobara banayein.');
    });
  } catch (err) { C.notice('Bill save nahi hua: ' + (err?.message || err)); }
  finally { saving = false; C.rerender(); }
}
function clearCur() { cart = []; unclear = []; cur = ''; curSnap = null; pendLoad = ''; cash = null; note = ''; mode = 'counter'; selKey = ''; keep(); }
// ---------- 🗑 parchi hatao (v2.179.1) — st 'x:<pehle>' (mitti nahi) · ↩ Wapas 6 sec · ⋮ ♻️ Hatai hui ----------
let undoT = 0;
function undoShow(id) {
  clearTimeout(undoT); document.getElementById('wpsUndo')?.remove();
  const el = document.createElement('div'); el.id = 'wpsUndo'; el.className = 'wps-undo'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>🗑 Parchi hata di</span><button type="button" data-ws-unhide="${esc(id)}">↩ Wapas</button>`;
  document.body.appendChild(el); undoT = setTimeout(() => el.remove(), 6000);
}
async function hideOrd(id) {
  if (!canHide()) { C.notice('Parchi hatane ki ijazat nahi — malik se poochein'); return; }
  const lo = localOrd.get(id);
  if (lo) {   // is phone ki parchi jo PC tak nahi gayi (✕ Nahi gayi) — seedha hatao
    if (lo._local === 'prep' || lo._local === 'send') { C.notice('⏳ Parchi abhi ja rahi hai — thori der baad'); return; }
    try { if (String(lo.th).startsWith('blob:')) URL.revokeObjectURL(lo.th); } catch {} localOrd.delete(id);
    if (cur === id) clearCur(); C.rerender(); C.notice('🗑 Parchi hata di'); return;
  }
  const o = orders.find(x => x.id === id); if (!o || hid(o)) return;
  if (cur === id && o.st !== 'billed' && (cart.length || unclear.some(u => !u.done)) && !confirm('Is parchi ka adhoora bill bhi saaf ho jayega — hata dein?')) return;
  const prev = String(o.st || 'new'), st = 'x:' + prev;
  o.st = st; if (cur === id) clearCur(); C.rerender(); undoShow(id);
  try { await withT(C.cloud.updateParchiOrder(id, { st, upAt: Date.now() }), 12000); }
  catch (e) { if (o.st === st) o.st = prev; document.getElementById('wpsUndo')?.remove(); C.rerender(); C.notice('✕ Parchi nahi hati: ' + (perm(e) ? 'ijazat nahi' : String(e?.message || e).slice(0, 60))); }
}
async function unhide(id) {
  clearTimeout(undoT); document.getElementById('wpsUndo')?.remove();
  const o = orders.find(x => x.id === id); if (!o || !hid(o)) return;
  const was = o.st, st = String(o.st).slice(2) || 'new';
  o.st = st; C.rerender(); hidPaint();
  try { await withT(C.cloud.updateParchiOrder(id, { st, upAt: Date.now() }), 12000); C.notice('↩ Parchi wapas list mein'); }
  catch (e) { if (o.st === st) o.st = was; C.rerender(); hidPaint(); C.notice('✕ Wapas nahi aayi: ' + (perm(e) ? 'ijazat nahi' : String(e?.message || e).slice(0, 60))); }
}
// ---------- 🔁 dobara parho (v2.179.2) — {st:'new'} → PC AI se phir parhe + naya print; bill khud bhar jata hai ----------
async function reread(id, btn) {
  const o = orders.find(x => x.id === id); if (!canReread(o)) { C.notice('Yeh parchi abhi dobara nahi parhi ja sakti'); return; }
  if (cur === id && (cart.length || unclear.some(u => !u.done)) && !confirm('Bill mein lage items hat kar AI ke naye items aayenge — theek?')) return;
  if (btn) btn.disabled = true;
  try { await withT(C.cloud.updateParchiOrder(id, { st: 'new', upAt: Date.now() }), 12000); }
  catch (e) { if (btn) btn.disabled = false; C.notice('✕ Nahi gaya: ' + (perm(e) ? 'ijazat nahi' : String(e?.message || e).slice(0, 60))); return; }
  o.st = 'new'; seenAt.set(id, Date.now()); rrAt.set(id, Date.now());   // ⚠️ ka waqt naye sire se
  if (cur === id) { cart = []; unclear = []; cash = null; selKey = ''; pendLoad = id; keep(); }
  C.rerender(); C.notice('🔁 PC ko bhej di — AI phir se parh raha (10–40 sec), naya print bhi nikle ga');
}
function hidHTML() {
  const L = orders.filter(hid), t0 = todayStr();
  if (!L.length) return '<p class="wps-oempty">♻️ Koi hatai hui parchi nahi (aaj + kal).</p>';
  return `<div class="wps-hl">${L.map(o => { const who = o.nm || o.ph || (o.src === 'app' ? 'App ki parchi' : 'WhatsApp parchi');
    return `<div class="wps-hr"><span class="wps-oi">${o.src === 'app' ? '📷' : '📲'}</span><span class="wps-ot"><b>${esc(who)}</b><small>${o.day && o.day !== t0 ? 'kal · ' : ''}${esc(hm(o.at))}</small></span><button type="button" class="wps-tc pri" data-ws-unhide="${esc(o.id)}">↩ Wapas</button></div>`; }).join('')}</div>`;
}
function hidPaint() { const b = document.querySelector('#dialog[open] #dialogBody [data-ws-hidbox]'); if (b) b.innerHTML = hidHTML(); }
function hidOpen() { if (!C.modal) return; C.modal('♻️ Hatai hui parchiyan', `<div data-ws-hidbox="1">${hidHTML()}</div>`, true); }
async function orderPatch(k, patch, okMsg) {   // ✓ Maal nikla / 🖨 Dobara print — chip par ⏳ → ✅ / ✕
  const o = curOrder(); if (!o || o._local || !C.cloud?.updateParchiOrder) return;
  chipSt[k] = 'w'; footPaint();
  try { await withT(C.cloud.updateParchiOrder(o.id, patch), 12000); const x = orders.find(y => y.id === o.id); if (x) Object.assign(x, patch); if (curSnap) Object.assign(curSnap, patch); chipSt[k] = 'ok'; C.notice(okMsg); }
  catch (e) { chipSt[k] = 'bad'; C.notice('✕ ' + (perm(e) ? 'Ijazat nahi — rules 2.86 lagi hain?' : e?.message || e)); }
  footPaint(); paintOrders(); headPaint();
  setTimeout(() => { if (chipSt[k] !== 'w') { delete chipSt[k]; footPaint(); } }, 4000);
}
async function gahakSave() {
  const o = curOrder(); if (!o || o._local || !C.cloud?.updateParchiOrder) return;
  const nm = String(document.querySelector('[data-ws-gnm]')?.value || '').trim().slice(0, 60), raw = String(document.querySelector('[data-ws-gph]')?.value || '').trim();
  const ph = raw ? phNorm(raw) : ''; if (raw && !ph) { C.notice('Number aisa likhein: 0300-1234567'); return; }
  const g = $('wpsGst'); chipSt.g = 'w'; if (g) g.textContent = '⏳';
  try { await withT(C.cloud.updateParchiOrder(o.id, { nm, ph }), 12000); for (const x of [orders.find(y => y.id === o.id), curSnap]) if (x) { x.nm = nm; x.ph = ph; } chipSt.g = 'ok'; keep(); C.notice('✓ Gahak: ' + ([nm, ph].filter(Boolean).join(' · ') || 'saaf')); }
  catch (e) { chipSt.g = 'bad'; C.notice('✕ ' + (perm(e) ? 'Ijazat nahi (rules)' : e?.message || e)); }
  const g2 = $('wpsGst'); if (g2) g2.textContent = stTxt(chipSt.g);
  headPaint(); paintOrders();
  setTimeout(() => { delete chipSt.g; const g3 = $('wpsGst'); if (g3) g3.textContent = ''; }, 4000);
}
async function photoOpen() {
  const o = curOrder(); if (!o || o._local || !C.modal) return;
  C.modal('🧾 Parchi — ' + (o.nm || o.ph || hm(o.at) || ''), `<div class="wps-pv" data-ws-pvbox="${esc(o.id)}">⏳ Tasveer aa rahi…</div>`, true);
  const src = await imgOf(o.id);
  const box = document.querySelector(`#dialog[open] #dialogBody [data-ws-pvbox="${CSS.escape(o.id)}"]`); if (!box) return;   // ‹ se nikal gaye to mat likho
  if (!src) imgCache.delete(o.id);
  const txt = String(o.txt || '').trim();
  box.innerHTML = (src ? `<img src="${esc(src)}" alt="parchi">` : '') + (txt ? `<p class="wps-txt" dir="auto">${esc(txt)}</p>` : '') + (!src && !txt ? '<p class="wps-mut">Tasveer nahi mili (internet?)</p>' : '');
}

// ---------- 📷 app se parchi (PC parhta hai) ----------
function picInputs() {
  if ($('wpsPicCam')) return;
  const mk = (id, cam) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cam) i.setAttribute('capture', 'environment'); i.id = id; i.hidden = true; i.dataset.wsPic = '1'; document.body.appendChild(i); };
  mk('wpsPicCam', true); mk('wpsPicGal', false);   // EK dafa — render mein kabhi dobara nahi (picker khula ho to input DOM se na hate)
}
function shrink(file) {   // lamba kinara ≤ 1600px, JPEG 0.85 (Firestore doc 1 MB se kam) + chhota namoona
  return new Promise((ok, no) => {
    let url = ''; try { url = URL.createObjectURL(file); } catch (e) { no(e); return; }
    const im = new Image();
    im.onload = () => {
      try {
        const W0 = im.naturalWidth || 1, H0 = im.naturalHeight || 1, LIM = 950000, cv = document.createElement('canvas'), cx = cv.getContext('2d');
        let k = Math.min(1, 1600 / Math.max(W0, H0)), q = 0.85, out = '';
        const draw = () => { cv.width = Math.max(1, Math.round(W0 * k)); cv.height = Math.max(1, Math.round(H0 * k)); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height); out = cv.toDataURL('image/jpeg', q); };
        draw();
        while (out.length > LIM && q > 0.5) { q -= 0.08; out = cv.toDataURL('image/jpeg', q); }
        while (out.length > LIM && k > 0.25) { k *= 0.85; draw(); }
        if (out.length > LIM) throw Error('tasveer bohat bari');
        const s = Math.min(1, 120 / Math.max(cv.width, cv.height)), tc = document.createElement('canvas'); tc.width = Math.max(1, Math.round(cv.width * s)); tc.height = Math.max(1, Math.round(cv.height * s));
        tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
        const th = tc.toDataURL('image/jpeg', 0.6);
        ok({ img: out, th: th.length < 40000 ? th : '' });
      } catch (e) { no(e); } finally { try { URL.revokeObjectURL(url); } catch {} }
    };
    im.onerror = () => { try { URL.revokeObjectURL(url); } catch {} no(Error('tasveer khuli nahi')); };
    im.src = url;
  });
}
async function sendPic(file) {
  if (!C.cloud?.saveParchiApp) { C.notice('App purani hai — Update karein'); return; }
  const id = 'a' + Date.now().toString(36), at = Date.now(), day = todayStr();
  let blob = ''; try { blob = URL.createObjectURL(file); } catch {}
  const lo = { id, src: 'app', st: 'new', at, day, from: 'app', ph: '', nm: '', cap: '', th: blob, by: C.uid(), _local: 'prep', file };
  localOrd.set(id, lo); seenAt.set(id, at);
  if (!cart.length && !unclear.some(u => !u.done)) { cur = id; curSnap = snapOf(lo); pendLoad = id; unclear = []; cash = null; note = ''; keep(); C.rerender(); }   // khali bill = yahi parchi khud khule
  else paintOrders();
  try {
    const { img, th } = await shrink(file);
    lo._local = 'send'; paintOrders(); headPaint();
    const done = C.cloud.saveParchiApp({ id, at, day, ph: '', nm: '', cap: '', th }, img);   // offline: Firestore phone mein rakh kar baad mein bhejta hai (dobara mat bhejo)
    imgCache.set(id, Promise.resolve(img));
    await done;
    C.notice('📷 Parchi PC ko gayi — AI parh kar items bharega');
  } catch (e) {
    lo._local = 'err'; lo.err = perm(e) ? '🔐 Rules 2.86 abhi nahi lagi' : String(e?.message || e).slice(0, 80);
    localOrd.set(id, lo); imgCache.delete(id);   // server ne mana kiya = Firestore ne doc wapas le liya — card ✕ ke saath wapas (tap = dobara)
    if (pendLoad === id) pendLoad = ''; keep(); paintOrders(); headPaint(); C.notice('✕ Parchi nahi gayi: ' + lo.err);
  }
}

// ---------- ⚙️ WhatsApp setting (sirf malik): link / QR · numbers · print ----------
let wl = null, wlErr = '', wlStop = null, wc = null, wcErr = '', wcStop = null, qrLib = null, qrLast = '';
const wst = {};
function setAlive() { if (document.querySelector('#dialog[open] #dialogBody [data-ws-setroot]')) return true; setUnlisten(); return false; }
function setUnlisten() { for (const f of [wlStop, wcStop]) { try { f?.(); } catch {} } wlStop = wcStop = null; qrLast = ''; }
function setOpen() {
  if (!C.owner()) { C.notice('Sirf malik'); return; }
  if (!C.modal) return;
  qrLast = '';
  C.modal('📲 WhatsApp Parchi — setting', `<div class="wps-set" data-ws-setroot="1"><div data-ws-link="1">${linkHTML()}</div><div data-ws-cfg="1">${cfgHTML()}</div></div>`, true);
  if (!wlStop && C.cloud?.listenWaLink) wlStop = C.cloud.listenWaLink((d, e) => { if (!setAlive()) return; if (e) wlErr = perm(e) ? 'rules' : 'net'; else { wl = d || {}; wlErr = ''; } linkPaint(); });
  if (!wcStop && C.cloud?.listenWaParchi) wcStop = C.cloud.listenWaParchi((d, e) => { if (!setAlive()) return; if (e) wcErr = perm(e) ? 'rules' : 'net'; else { wc = d || null; wcErr = ''; } cfgPaint(); });   // d null = abhi save nahi hui
  try { $('dialog')?.addEventListener('close', setUnlisten, { once: true }); } catch {}
  qrPaint();
}
function linkHTML() {
  if (wlErr === 'rules') return '<p class="wps-err">🔐 Ijazat nahi (rules) — shop PC 5 min mein rules khud lagata hai.</p>';
  const L = wl || {}, at = tms(L.at), st = String(L.st || ''), quiet = !!at && Date.now() - at > 5 * 60000;
  const [cl, t, sub] = !at ? ['w', '🖥 PC ne abhi jawab nahi diya', 'PC ki nayi script (wa-parchi) 3–5 min mein khud lagti hai — PC ON hai?']
    : st === 'open' ? ['ok', '🟢 WhatsApp juda hua', L.me ? '📱 ' + L.me : '']
    : st === 'qr' ? ['warn', '🟡 QR scan karein', 'Dukan wale phone mein WhatsApp kholein → ⋮ (upar daayein) → Linked devices → Link a device → neeche wala QR scan karein.']
    : st === 'closed' ? ['bad', '🔴 WhatsApp toot gaya', '🔄 Naya QR dabayein, phir scan karein.']
    : st === 'off' ? ['w', '⚪ PC par band', 'Neeche ✅ Chalu karein.'] : st === 'error' ? ['bad', '⚠️ Ghalti', String(L.err || '')] : ['w', '⏳ ' + (st || 'intezar'), ''];
  const pcl = at ? `🖥 ${esc(L.host || 'PC')}${L.ver ? ' · v' + esc(L.ver) : ''} · ${ago(at) === 'abhi' ? 'abhi' : ago(at) + ' pehle'}${quiet ? ' · ⚠️ PC chup?' : ''}` : '';
  const qr = st === 'qr' && L.qr ? `<div class="wps-qr" data-ws-qr="1">⏳ QR ban raha…</div>${at && Date.now() - at > 60000 ? '<p class="wps-err">⚠️ QR purana ho sakta hai — 🔄 Naya QR dabayein</p>' : ''}` : '';
  return `<div class="wps-lk ${cl}"><b>${t}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${pcl ? `<small class="wps-mut">${pcl}</small>` : ''}</div>${qr}
    <div class="wps-row"><button type="button" class="wps-tc" data-ws-relink="1">🔄 Naya QR</button>${st === 'open' || st === 'qr' ? '<button type="button" class="wps-tc bad" data-ws-logout="1">⛔ Unlink</button>' : ''}<i class="wps-wst">${stTxt(wst.cmd)}</i></div>`;
}
function linkPaint() { const b = document.querySelector('#dialogBody [data-ws-link]'); if (!b) return; b.innerHTML = linkHTML(); qrLast = ''; qrPaint(); }
function qrLoad() {   // vendor/qrcode.js (qrcode-generator 1.4.4, MIT) — sirf zaroorat par
  if (!qrLib) qrLib = new Promise((ok, no) => {
    if (window.qrcode) { ok(window.qrcode); return; }
    const s = document.createElement('script'); s.src = new URL('./vendor/qrcode.js?v=1.4.4', import.meta.url).href;
    s.onload = () => window.qrcode ? ok(window.qrcode) : no(Error('QR library nahi mili'));
    s.onerror = () => { qrLib = null; no(Error('QR load nahi hua (internet?)')); };
    document.head.appendChild(s);
  });
  return qrLib;
}
async function qrPaint() {
  const q = String(wl?.qr || ''); if (!q || wl?.st !== 'qr' || q === qrLast || !document.querySelector('#dialogBody [data-ws-qr]')) return;
  try {
    const qrcode = await qrLoad(), x = qrcode(0, 'M'); x.addData(q); x.make();
    const el = document.querySelector('#dialogBody [data-ws-qr]'); if (!el) return;
    el.innerHTML = x.createSvgTag({ cellSize: 6, margin: 4, scalable: true }); qrLast = q;
  } catch (e) { const el = document.querySelector('#dialogBody [data-ws-qr]'); if (el) el.textContent = '✕ ' + (e?.message || e); }
}
const cfgNow = () => ({ on: wc?.on ?? true, th: wc?.th ?? true, a4: wc?.a4 ?? false, allow: Array.isArray(wc?.allow) ? wc.allow.map(String) : [] });
function cfgHTML() {
  if (wcErr === 'rules') return '<p class="wps-err">🔐 Setting parh nahi sake (rules).</p>';
  const c = cfgNow(), tg = (k, v, a, b) => `<button type="button" class="wps-tc${v ? ' is-in' : ''}" data-ws-tg="${k}">${v ? a : b}</button>`;
  return `<div class="wps-sec"><h4>⚙️ Kaam</h4><div class="wps-row">${tg('on', c.on, '✅ Chalu', '⛔ Band')}${tg('th', c.th, '🧾 Thermal parchi: ON', '🧾 Thermal: BAND')}${tg('a4', c.a4, '🖨 A4: ON', '🖨 A4: BAND')}<i class="wps-wst">${stTxt(wst.cfg)}</i></div>${!wc ? '<small class="wps-mut">Abhi setting save nahi hui — koi chip dabayein to save ho jayegi.</small>' : ''}</div>
    <div class="wps-sec"><h4>📞 Kin numbers ki forward parchi PC le</h4><small class="wps-mut">Sirf in numbers se forward hui parchi (tasveer / likha order) PC parhega.</small>
    <div class="wps-nums">${c.allow.map(n => `<span class="wps-num">📱 ${esc(n)}<button type="button" data-ws-numx="${esc(n)}" aria-label="Hatao">✕</button></span>`).join('') || '<small class="wps-mut">Abhi koi number nahi</small>'}</div>
    <div class="wps-nadd"><input type="tel" inputmode="tel" data-ws-numin="1" maxlength="20" placeholder="0300-1234567" autocomplete="off" enterkeyhint="done"><button type="button" class="wps-tc pri" data-ws-numadd="1">➕ Jorein</button></div></div>
    <p class="wps-mut">🤖 AI sirf dukan ke PC par chalta hai (parchi parhna) — app mein AI nahi.</p>`;
}
function cfgPaint() {
  const b = document.querySelector('#dialogBody [data-ws-cfg]'); if (!b) return;
  const inp = b.querySelector('[data-ws-numin]'), v = inp?.value || '', f = document.activeElement === inp;
  b.innerHTML = cfgHTML();
  const n = b.querySelector('[data-ws-numin]'); if (n) { n.value = v; if (f) n.focus(); }
}
async function cfgSave(patch, msg) {
  if (!C.owner() || !C.cloud?.saveWaParchi) return;
  const next = { ...cfgNow(), ...patch };
  wc = { ...(wc || {}), ...next }; wst.cfg = 'w'; cfgPaint();   // pehle UI
  try { await withT(C.cloud.saveWaParchi(next), 12000); wst.cfg = 'ok'; if (msg) C.notice(msg); }
  catch (e) { wst.cfg = 'bad'; C.notice('✕ Setting save nahi hui: ' + (perm(e) ? 'ijazat nahi' : e?.message || e)); }
  cfgPaint(); setTimeout(() => { if (wst.cfg !== 'w') { wst.cfg = ''; cfgPaint(); } }, 4000);
}
function numAdd() {
  const inp = document.querySelector('#dialogBody [data-ws-numin]'), n = phNorm(inp?.value);
  if (!n) { C.notice('Number aisa likhein: 0300-1234567'); inp?.focus(); return; }
  const c = cfgNow(); if (c.allow.includes(n)) { C.notice('Yeh number pehle se hai'); return; }
  if (inp) inp.value = '';
  cfgSave({ allow: [...c.allow, n].slice(0, 30) }, '✓ ' + n + ' jur gaya');
}
async function waCmd(cmd) {
  if (!C.owner() || !C.cloud?.sendWaCmd) return;
  if (cmd === 'relink' && wl?.st === 'open' && !confirm('Abhi WhatsApp juda hua hai — naya QR banane se purana link toot jayega. Theek?')) return;
  if (cmd === 'logout' && !confirm('WhatsApp ko PC se ALAG (unlink) karein?\nPhir parchiyan nahi aayengi jab tak naya QR scan na karein.')) return;
  wst.cmd = 'w'; linkPaint();
  try { await withT(C.cloud.sendWaCmd(cmd), 12000); wst.cmd = 'ok'; C.notice(cmd === 'relink' ? '🔄 PC ko kaha — naya QR 10–30 sec mein' : '⛔ Unlink ka hukam PC ko gaya'); }
  catch (e) { wst.cmd = 'bad'; C.notice('✕ ' + (perm(e) ? 'Ijazat nahi' : e?.message || e)); }
  linkPaint(); setTimeout(() => { if (wst.cmd !== 'w') { wst.cmd = ''; linkPaint(); } }, 5000);
}

// ---------- events (sirf data-ws-* · root data-ws-root) ----------
const inWS = t => !!t?.closest?.('#list,#summary,#actions') && !!document.querySelector('[data-ws-root]');
document.addEventListener('input', e => {
  const t = e.target, d = t?.dataset; if (!d) return;
  if (d.wsUq != null) {   // ❓ line ka search — sirf us line ki list
    if (!document.querySelector('[data-ws-root]')) return;
    const u = unclear.find(x => String(x.i) === d.wsUq); if (!u) return; u.qq = t.value; keep();
    const box = document.querySelector(`#list [data-ws-uhits="${CSS.escape(d.wsUq)}"]`); if (box) box.innerHTML = sugHTML(u) + uHits(u);
    return;
  }
  if (!inWS(t)) return;
  let i, l;
  if ((i = d.wsCtn) != null) { if (!(l = cart[i])) return; l.ctn = Math.max(0, Math.floor(Number(t.value) || 0)); cash = null; }
  else if ((i = d.wsPcs) != null) { if (!(l = cart[i])) return; l.pcs = Math.max(0, r3(Number(t.value) || 0)); cash = null; }
  else if ((i = d.wsRate) != null) { if (!C.owner() || !(l = cart[i])) return; l.rate = Math.max(0, r2(Number(t.value) || 0)); l.crate = l.rate; l.edited = Math.abs(l.rate - (Number(l.std) || 0)) > 0.004; t.classList.toggle('chg', l.edited); cash = null; }   // malik ka apna rate: carton par bhi wohi (sale.js)
  else if (d.wsCash != null) { cash = t.value === '' ? 0 : Math.max(0, Number(t.value) || 0); keep(); const dd = $('wpsDue'); if (dd) dd.innerHTML = dueText(); return; }
  else if (d.wsNote != null) { note = t.value.slice(0, 60); keep(); return; }
  else return;
  keep(); refreshTotals();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t?.dataset?.wsPic) { const f = t.files?.[0]; t.value = ''; if (f) sendPic(f); return; }
  if (!inWS(t)) return;
  if (t.dataset.wsLg != null) { const l = cart[t.dataset.wsLg]; if (l) setLineGodam(l, t.value); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t?.matches?.('#dialogBody [data-ws-numin]')) { e.preventDefault(); numAdd(); return; }
  if (!document.querySelector('[data-ws-root]') || !t || t.tagName !== 'INPUT') return;
  if (t.id === 'search') {   // Enter = code / ek hi milta item → line
    const v = t.value.trim(); if (!v) return; e.preventDefault();
    const { items } = stock(); let it = findByCode(items, v); const byCode = !!it;
    if (!it) { const hs = smartSearch(items, v, 2); if (hs.length === 1) it = hs[0]; }
    if (!it) { C.notice('Ek item nahi mila — list se chunein'); return; }
    const q = byCode ? subQty(it, v) : 1, r = addItem(it, q); t.value = ''; C.notice(r.again ? `+${num(q)} · ${it.name}` : `✓ ${it.name}`); C.rerender();
    return;
  }
  if (t.dataset.wsUq != null) { e.preventDefault(); document.querySelector(`#list [data-ws-uhits="${CSS.escape(t.dataset.wsUq)}"] [data-ws-upick]`)?.click(); return; }
  if (t.matches('[data-ws-gnm],[data-ws-gph]')) { e.preventDefault(); gahakSave(); return; }
  const box = t.closest('#list .sale-cart'); if (!box) return;   // khane mein Enter = agla khana
  e.preventDefault();
  const all = [...box.querySelectorAll('input:not([readonly]):not([disabled])')], nx = all[all.indexOf(t) + 1];
  if (nx) { nx.focus(); try { nx.select?.(); } catch {} } else t.blur();
}, true);
document.addEventListener('focusin', e => { const r = e.target?.closest?.('#list .pp-cr, #list .pp-tr'); if (r && r.dataset.wsSel) selSet(r.dataset.wsSel); });
document.addEventListener('click', e => {
  const t = e.target; if (!t?.closest) return;
  const set = t.closest('[data-ws-relink],[data-ws-logout],[data-ws-tg],[data-ws-numx],[data-ws-numadd]');
  if (set && set.closest('#dialogBody [data-ws-setroot]')) { const d = set.dataset;
    if (d.wsRelink) waCmd('relink'); else if (d.wsLogout) waCmd('logout'); else if (d.wsNumadd) numAdd();
    else if (d.wsNumx) { if (confirm(d.wsNumx + ' hata dein? Is number ki parchi phir PC nahi lega.')) cfgSave({ allow: cfgNow().allow.filter(n => n !== d.wsNumx) }, '✓ ' + d.wsNumx + ' hata diya'); }
    else if (d.wsTg) { const c = cfgNow(), k = d.wsTg; if (!['on', 'th', 'a4'].includes(k)) return; cfgSave({ [k]: !c[k] }, k === 'on' ? (c.on ? '⛔ WhatsApp parchi band' : '✅ WhatsApp parchi chalu') : (k === 'th' ? '🧾 Thermal: ' : '🖨 A4: ') + (c[k] ? 'BAND' : 'ON')); }
    return; }
  if (!document.querySelector('[data-ws-root]')) return;
  const r = t.closest('#list .pp-cr, #list .pp-tr'); if (r && r.dataset.wsSel && !t.closest('button,select,input')) selSet(r.dataset.wsSel);
  const b = t.closest('[data-ws-reread],[data-ws-hide],[data-ws-hidlist],[data-ws-unhide],[data-ws-ord],[data-ws-add],[data-ws-del],[data-ws-open],[data-ws-mode],[data-ws-view],[data-ws-copies],[data-ws-counter],[data-ws-gc],[data-ws-cam],[data-ws-gal],[data-ws-camera],[data-ws-pv],[data-ws-gsave],[data-ws-set],[data-ws-upick],[data-ws-uskip],[data-ws-uback],[data-ws-pick],[data-ws-reprint],[data-ws-clear],[data-ws-save]');
  if (!b) return;
  const d = b.dataset;
  if (d.wsReread) { reread(d.wsReread, b); return; }   // v2.179.2
  if (d.wsHide) { hideOrd(d.wsHide); return; }   // v2.179.1
  if (d.wsHidlist) { hidOpen(); return; }
  if (d.wsUnhide) { unhide(d.wsUnhide); return; }
  if (d.wsOrd) { loadOrder(d.wsOrd); return; }
  if (d.wsCamera) { openSaleCamera(); return; }
  if (d.wsAdd) { const it = stock().items.find(x => String(x.id) === d.wsAdd); if (!it) return; const res = addItem(it); const s = $('search'); if (s) s.value = ''; C.notice(res.again ? `+1 · ${it.name}` : `✓ ${it.name}`); C.rerender(); setTimeout(() => { const el = document.querySelector(`#list [data-ws-sel="${CSS.escape(res.line.k)}"]`); if (el) keepScan(el); }, 60); return; }
  if (d.wsDel != null) { const i = Number(d.wsDel); if (!cart[i]) return; cart.splice(i, 1); cash = null; keep(); C.rerender(); return; }
  if (d.wsOpen) { selSet(d.wsOpen); const i = cart.findIndex(l => l.k === d.wsOpen), q = document.querySelector(`#list [data-ws-pcs="${i}"]`); if (q) { q.focus(); try { q.select(); } catch {} } return; }
  if (d.wsMode) {
    const m = d.wsMode === 'wholesale' && C.can('sale.wholesale') ? 'wholesale' : 'counter'; if (m === mode) return;
    mode = m; for (const l of cart) { const it = itemIn(l.godam, l.id); if (it && (!l.edited || !C.owner())) { setStd(l, it); l.edited = false; } }
    cash = null; keep(); C.rerender(); C.notice(m === 'wholesale' ? '📦 Wholesale — W rate' : '🛒 Counter — R rate'); return;
  }
  if (d.wsView) { LS(VIEW_KEY, d.wsView === 'grid' ? 'grid' : 'rows'); C.rerender(); return; }
  if (d.wsCopies) { LS('sam-ws-copies', String(Math.min(3, Math.max(1, Number(d.wsCopies) || 1)))); C.rerender(); return; }
  if (d.wsCounter) { LS('sam-ws-counter', d.wsCounter); C.rerender(); return; }
  if (d.wsGc != null) { const l = cart[Number(d.wsGc)]; if (!l) return; const L = gdList(), i = L.findIndex(x => x.b === (Number(l.godam) || SALE_BRANCH)), nx = L[(i + 1) % L.length]; if (!nx) return;
    selKey = l.k; setLineGodam(l, nx.b); C.notice('🏬 ' + nx.full + ' — dobara dabayein = agla godam'); return; }   // v2.179.0: godam chip
  if (d.wsCam || d.wsGal) { picInputs(); $(d.wsCam ? 'wpsPicCam' : 'wpsPicGal')?.click(); return; }
  if (d.wsPv) { photoOpen(); return; }
  if (d.wsGsave) { gahakSave(); return; }
  if (d.wsSet) { setOpen(); return; }
  if (d.wsUpick) { const [i, id] = d.wsUpick.split('|'); uPick(i, id); return; }
  if (d.wsUskip != null) { const u = unclear.find(x => String(x.i) === d.wsUskip); if (u) { u.done = 'skip'; keep(); C.rerender(); } return; }
  if (d.wsUback) { unclear.forEach(u => { if (u.done === 'skip') u.done = ''; }); keep(); C.rerender(); return; }
  if (d.wsPick) { orderPatch('pick', { st: 'picked', by: C.uid(), upAt: Date.now() }, '📦 Maal nikla — parchi par likh diya'); return; }
  if (d.wsReprint) { orderPatch('print', { prReq: Date.now() }, '🖨 Dobara print ka hukam PC ko gaya'); return; }
  if (d.wsClear) {
    if ((cart.length || unclear.some(u => !u.done)) && !confirm('Yeh bill saaf kar dein? (parchi waisi hi rahegi)')) return;
    clearCur(); C.rerender(); return;
  }
  if (d.wsSave) save();
});

export const _wsTest = { phNorm, qtyOf, stOf, addItem, fill, state: () => ({ mode, cart, unclear, cur, pendLoad }), setOrders: L => { orders = L; }, reset: () => { cart = []; unclear = []; cur = ''; curSnap = null; pendLoad = ''; cash = null; note = ''; mode = 'counter'; } };   // test seam
