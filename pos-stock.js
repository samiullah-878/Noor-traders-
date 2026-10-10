// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

import { smartSearch, setAliases, aliasOf, noteHit, voiceSearch, hlName, smartHit, fold, topItems } from './smart-search.js?v=2.99.12';
import { liveLabelsHTML } from './barcode.js?v=2.99.12';   // v2.97: 🖨 label live + ✕ cancel (wahi module jo app.js — ek hi nusqha)
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');   // ek hi dafa banao (har number par naya banana bohat slow tha)
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);   // v1.61.1: tadad 3 decimal
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;   // v1.61: yeh maujood nahi tha — camera ki list banate waqt ruk jata tha (kaala camera)
const NAMEC = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const PAGE = 30;        // ek dafa itni rows — baqi "Aur dikhao" se (phone tez rahe)
let limit = PAGE;

let cloud = null, rerender = () => {}, notice = () => {};
let stop = null, rows = [], loaded = false, failed = '';
let branch = null, sort = 'name', filter = 'all', bills = [];
let godamAll = false;   // v1.97: godam par 'Sab' khud chuna ho tabhi sab items   // v1.67: shuru mein SAB items
let postReq = null;
let hidden = {};   // item id -> true (Band kiye hue items, sab branches mein chhupe)
let counts = new Map(), round = '', stopCount = null, isOwner = () => false;
// v1.49: _flags (baqi / check nishan), _lock (malik ne ginti band ki)
let flags = {}, countOff = false;
const flagOf = id => flags[String(id)] || {};
const countLocked = () => countOff && !isOwner();

let aliasStop = null;
let itemCfg = {}, cfgStop = null, ptList = [], ptStop = null;                         // v2.5: stockConfig (mulazim item/rates badal sake)
const canEditItem = () => isOwner() || itemCfg.itemEdit === true;
let inPdfOf = null, tolaiOf = null, tolaiClickOf = null;
export function setInPdf(fn) { inPdfOf = fn; }
export function setTolai(open, click) { tolaiOf = open; tolaiClickOf = click; }   // v2.7
// v2.84: 🔤 URDU NAAM — blueAccess/urduNames {map: itemId -> Urdu}; AI (Gemini) se ek dafa, phir malik/stock theek kar sake; label par English ke saath.
let urdu = {}, urduStop = null, aiText = null, urduBusy = false;
const urduOf = id => String(urdu[String(id)] || '');
async function urduMake(items, onlyMissing = true) {
  if (!aiText) throw Error('AI tayyar nahi (login / key)');
  const todo = items.filter(r => r && r.id && r.name && (!onlyMissing || !urduOf(r.id)));
  if (!todo.length) return 0;
  let done = 0;
  for (let i = 0; i < todo.length; i += 60) {
    const chunk = todo.slice(i, i + 60);
    const prompt = `Tum ek Pakistani grocery (kiryana) ki dukaan ke items ke naam Urdu rasm-ul-khat mein likhte ho. Har English/Roman naam ko URDU script mein likho — tarjuma nahi, wahi naam Urdu harfon mein (brand ke naam jaise chhapte hain waise: Dettol = ڈیٹول, Surf = سرف, Colgate = کولگیٹ). Wazan/size (5kg, 160g, 1.5 ltr) hindson mein wahi rakho (jaise 5 کلو, 160 گرام, 1.5 لیٹر). Sirf JSON array do, aur kuch nahi: [{"id":"...","ur":"..."}]\n` + JSON.stringify(chunk.map(r => ({ id: String(r.id), en: String(r.name).slice(0, 80) })));
    const out = await aiText(prompt);
    const m = String(out || '').match(/\[[\s\S]*\]/); if (!m) continue;
    let arr = []; try { arr = JSON.parse(m[0]); } catch { continue; }
    const patch = {}; for (const x of arr) { if (x && x.id && x.ur && /[\u0600-\u06FF]/.test(x.ur)) patch[String(x.id)] = String(x.ur).trim().slice(0, 120); }
    if (Object.keys(patch).length) { await cloud.setUrdu(patch); Object.assign(urdu, patch); done += Object.keys(patch).length; }
    notice(`🔤 ${done} / ${todo.length} Urdu naam ban gaye…`);
  }
  return done;
}
export function stockSetup(opts) {
  aiText = opts?.ai || aiText;
  if (!urduStop && opts?.cloud?.listenUrdu) urduStop = opts.cloud.listenUrdu(m => { urdu = m || {}; if (stockActive) soft(); });
  if (!aliasStop && opts?.cloud?.listenAliases) aliasStop = opts.cloud.listenAliases(m => setAliases(m));   // v1.75: doosre naam
  if (!cfgStop && opts?.cloud?.listenStockConfig) cfgStop = opts.cloud.listenStockConfig(c => { itemCfg = c || {}; if (stockActive) soft(); });
  if (!trStop && opts?.cloud?.listenTransfers) trStop = opts.cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); });   // v2.6: transfer shuru se (aaya hua maal ke liye)
  if (!ptStop && opts?.cloud?.listenPosTransfers) ptStop = opts.cloud.listenPosTransfers(list => { ptList = list || []; });   // v2.8: POS ke apne transfer (PC transfer-dekho.js)
  cloud = opts.cloud;
  rerender = opts.rerender || (() => {});
  notice = opts.notice || (() => {});
  isOwner = opts.owner || (() => false);
}

// Snapshot par poori screen foran na banao: thora ruko, aur jab koi ginti likh raha ho to us ke baad
let softTimer = null, softWaiting = false;
function soft() {
  clearTimeout(softTimer);
  softTimer = setTimeout(() => {
    const a = document.activeElement;
    if (a && a.matches?.('input') && a.closest?.('#list')) { softWaiting = true; return; }
    softWaiting = false;
    rerender();
  }, 300);
}
document.addEventListener('focusout', e => {
  if (softWaiting && e.target.closest?.('#list')) setTimeout(soft, 50);
});

let stockT0 = 0, stockRetried = false, stockTick = null;   // v2.94.0: atke to khud / button se dobara
export function stockRetry() { if (stop) { try { stop(); } catch {} stop = null; } loaded = false; failed = ''; stockT0 = 0; start(false); rerender(); }
export function stockWaitHTML() {
  const w = stockT0 ? Date.now() - stockT0 : 0;
  if (w < 12000) return '<p class="stat-note">Items load ho rahe hain…</p>';
  const why = navigator.onLine === false ? '📵 Phone par internet nahi — Wi-Fi / mobile data dekhein.' : (w < 30000 ? '⏳ Pehli dafa (ya dheema internet) — sara stock aa raha hai, thora aur ruk jayein.' : '⚠️ Bohat der ho gayi — neeche dabayein, rabta naya jorta hoon.');
  return `<div class="empty stock-wait"><strong>Items load ho rahe hain… (${Math.round(w / 1000)} sec)</strong><p>${why}</p><button type="button" class="primary" data-stock-retry="1">🔄 Dobara load karo</button></div>`;
}
document.addEventListener('click', e => { if (e.target.closest?.('[data-stock-retry]')) { stockRetried = true; stockRetry(); } });
function start(withCounts = true) {
  if (!cloud) return;
  if (!stop) {
    loaded = false; failed = ''; stockT0 = Date.now();
    clearInterval(stockTick); stockTick = setInterval(() => { if (loaded) { clearInterval(stockTick); stockTick = null; return; } const w = Date.now() - stockT0; if (w > 30000 && !stockRetried) { stockRetried = true; stockRetry(); return; } if (w > 12000) rerender(); }, 6000);
    stop = cloud.listenStock(
      list => { rows = list.map(fixCost); loaded = true; failed = ''; soft(); },
      e => { failed = e?.message || 'Stock load nahi hua'; loaded = true; stop = null; rerender(); }
    );
  }
  if (withCounts && !stopCount && cloud.listenStockCount) {
    stopCount = cloud.listenStockCount(list => {
      counts = new Map();
      round = list.find(r => r.id === '_round')?.round || '';
      postReq = list.find(r => r.id === '_post') || null;
      hidden = list.find(r => r.id === '_hidden')?.items || {};
      flags = list.find(r => r.id === '_flags')?.items || {};
      countOff = !!list.find(r => r.id === '_lock')?.off;
      bills = list.filter(r => String(r.id).startsWith('_bill-')).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      list.forEach(r => { if (!String(r.id).startsWith('_')) counts.set(r.id, r); });
      soft();
    }, () => {});
  }
}

// POS mein kisi item ka Purchase Rate carton ka hota hai, kisi ka ek piece ka.
// sync-stock.js har dafa pack se taqseem karta hai, jis se piece wale items ka cost
// pack guna kam ho jata hai (ghee pouch: 590.4 / 5 = 118.08).
// Is liye dono imkaan dekhe jate hain aur jo sale Rate ke qareeb ho woh liya jata hai.
export function pieceCost(cost, pack, rate) {
  cost = Number(cost) || 0; pack = Number(pack) || 0; rate = Number(rate) || 0;
  if (!cost || pack <= 1 || !rate) return cost;
  const gap = v => Math.abs(Math.log(v / rate));
  const whole = cost * pack;
  return gap(whole) < gap(cost) ? Math.round(whole * 100) / 100 : cost;
}
function fixCost(r) {
  if (!r || !r.prate) return r;
  const c = pieceCost(r.prate, r.pack, r.rate);
  return c === r.prate ? r : { ...r, prate: c };
}

// Ginti ke waqt ka stock: PC ne POS ledger se nikaal kar likha ho to wahi (sahi), warna app ka dekha hua
const sysOf = (c, r) => (c && c.sysPos != null && c.sysPosAt === c.at) ? Number(c.sysPos) : Number(c?.sys ?? r?.stock ?? 0);
const sysSure = c => !!(c && c.sysPos != null && c.sysPosAt === c.at);

const countId = (b, itemId) => `c-${b}-${itemId}`;
const countOf = (b, r) => {
  const c = counts.get(countId(b, r.id));
  return c && c.round === round && round ? c : null;
};
const countedPcs = c => Number(c?.total) || 0;
const stampText = t => {
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
};

// Bill se cost: POS ke purchase bills (posBills) mein har item ka aakhri khareed bhao.
export function billRates(bills) {
  const byCode = new Map(), byName = new Map();
  const when = b => Number(b.at || b.createdAt) || Date.parse(b.date || '') || 0;
  const packOf = l => {
    const r = rows.find(x => (l.code && x.code === l.code) || norm(x.name) === norm(l.name));
    return Number(r?.pack) || 0;
  };
  bills.slice().sort((a, b) => when(a) - when(b)).forEach(b => (b.lines || []).forEach(l => {
    let c = Number(l.pcs) || 0;
    const item = rows.find(x => (l.code && x.code === l.code) || norm(x.name) === norm(l.name));
    if (!c && Number(l.ctn)) { const p = packOf(l); c = p > 0 ? Number(l.ctn) / p : Number(l.ctn); }
    if (!Number(l.pcs) && item && Number(l.ctn) && Number(item.pack) > 1 && Number(item.rate)) {
      const p = Number(item.pack), ctnPc = Number(l.ctn) / p;
      c = Math.abs(Math.log(ctnPc / item.rate)) < Math.abs(Math.log(Number(l.ctn) / item.rate)) ? ctnPc : Number(l.ctn);
    }
    if (!c) return;
    if (l.code) byCode.set(String(l.code), c);
    if (l.name) byName.set(norm(l.name), c);
  }));
  return r => (r.code && byCode.get(String(r.code))) || byName.get(norm(r.name)) || 0;
}

export function stockReport(fallback) {
  const { pick, items: raw, names } = collect();
  const items = raw.map(r => r.prate || !fallback ? r : { ...r, prate: fallback(r) });
  const line = r => {
    const c = countOf(pick, r);
    if (!c) return null;
    const d = Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100;
    const past = Array.isArray(c.history) ? c.history.slice().reverse() : [];
    const hist = past.map(h => {
      const hd = Math.round((Number(h.total) - Number(h.sys)) * 100) / 100;
      return `${stampText(h.at)}: ${num(h.ctn)}+${num(h.pcs)} = ${num(h.total)} · Farq ${hd > 0 ? '+' : ''}${num(hd)}`;
    }).join('\n');
    return {
      name: r.name, code: r.code || '',
      sys: num(sysOf(c, r)),
      now: num(r.stock),
      nowDiff: (() => { const nd = Math.round((r.stock - countedPcs(c)) * 100) / 100; return (nd > 0 ? '+' : '') + num(nd); })(),
      cost: r.prate ? (Number(r.pack) > 1
        ? `${num(r.prate)} / ${r.uName || 'Pcs'}\n${num(r.prate)} × ${num(r.pack)} = ${num(Math.round(r.prate * r.pack * 100) / 100)} / ${r.cName || 'Ctn'}`
        : num(r.prate)) : '',
      count: `${num(c.ctn)} ${r.cName || 'Ctn'} + ${num(c.pcs)} ${r.uName || 'Pcs'} = ${num(c.total)}`,
      diff: (d > 0 ? '+' : '') + num(d),
      value: r.prate ? (d > 0 ? '+' : '') + num(d * r.prate) : '',
      rs: r.prate ? Math.round(d * r.prate * 100) / 100 : 0,
      calc: r.prate ? `${(d > 0 ? '+' : '') + num(d)} × ${num(r.prate)} = ${(d > 0 ? '+' : '') + num(Math.round(d * r.prate * 100) / 100)}` : '',
      hist, d, sure: sysSure(c)
    };
  };
  const rows = items.map(line).filter(Boolean).filter(r => filter !== 'farq' || Math.abs(r.d) > 0.001);
  const netRs = rows.reduce((n, x) => n + x.rs, 0);
  const kamRs = rows.reduce((n, x) => n + (x.rs < 0 ? x.rs : 0), 0);
  const zyadaRs = rows.reduce((n, x) => n + (x.rs > 0 ? x.rs : 0), 0);
  const noCost = rows.filter(x => Math.abs(x.d) > 0.001 && !x.cost).length;
  return {
    kamRs: Math.round(kamRs * 100) / 100,
    zyadaRs: Math.round(zyadaRs * 100) / 100,
    noCost,
    unsure: rows.filter(x => !x.sure).length,
    branch: branchName(pick, names),
    round,
    counted: rows.length,
    total: items.length,
    netRs: Math.round(netRs * 100) / 100,
    rows
  };
}

export function stockStop() {
  stockActive = false;
  if (stop) { stop(); stop = null; }
  if (stopCount) { stopCount(); stopCount = null; }
  counts = new Map(); round = '';
  rows = []; loaded = false; failed = '';
}

export function stockBack() { stockStop(); }

// ---------- Nayi Sale (sale.js) ke liye: wahi posStock data, ginti ke baghair ----------
export function saleStock() {
  start(false);
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  const itemsFor = b => chunks.filter(c => c.branch === b)
    .sort((x, y) => (x.order || 0) - (y.order || 0)).flatMap(c => c.items);
  return { loaded, failed, branches, names, itemsFor, hidden, branchName };
}
let saleHook = null, saleSeen = [], saleQtyHook = null, saleFindHook = null;
export function setSaleFindHook(fn) { saleFindHook = fn; }
// v1.61.2: camera khulte waqt apni list BILL se dobara banaye (Naya bill / item hatane ke baad purani list na dikhe)
let saleCartHook = null, saleDelHook = null;
export function setSaleDelHook(fn) { saleDelHook = fn; }
let saleGodamHook = null, saleBillsHook = null;   // v2.64: scanner par godam chips + PC par aaj ke bills
export function setSaleGodamHook(fn) { saleGodamHook = fn; }
export function setSaleBillsHook(fn) { saleBillsHook = fn; }   // v1.64: camera ki list se line katna
export function setSaleCartHook(fn) { saleCartHook = fn; }
let saleLineGodamHook = null; export function setSaleLineGodamHook(fn) { saleLineGodamHook = fn; }   // v2.95: line ka godam
// v2.95: bill (edit / naya) bahar se badla -> khuli scan screen ki list dobara bill se; band ho to khol do
export function scanReload(noOpen) { if (scanBox && scanBox._reload) { scanBox._reload(); return; } if (!noOpen && saleRoot()) openSaleCamera(); }
function syncFromCart() {
  if (!saleRoot() || !saleCartHook) return;
  try {
    const cur = saleCartHook() || [];
    scanOrder = []; scanItems = new Map(); scanQty = new Map();
    for (const c of cur) {
      const k = String(c.key || c.item.id);   // v1.62: har bill line alag
      if (!scanItems.has(k)) { scanItems.set(k, c.item); scanOrder.push(k); scanQty.set(k, { pcs: 0, ctn: 0 }); }
      const q = scanQty.get(k); q.pcs = Math.round(((Number(q.pcs) || 0) + (Number(c.pcs) || 0)) * 1000) / 1000; q.ctn = (Number(q.ctn) || 0) + (Number(c.ctn) || 0);
    }
    lastKey = scanOrder[scanOrder.length - 1] || '';
    lastScan = lastKey ? scanItems.get(lastKey) : null;
  } catch {}
}
export function setSaleQtyHook(fn) { saleQtyHook = fn; }
let lastScan = null, lastKey = '', scanQty = new Map(), padUnit = 'pcs';   // v1.62: lastKey = aakhri line ki pehchan   // camera par tadad ke buttons
let scanOrder = [], scanItems = new Map();   // camera ki screen par bill ki lines
export function setSaleScanHook(fn) { saleHook = fn; }
export function openSaleCamera() { saleSeen = []; openScanner(); }
const saleRoot = () => !!document.querySelector('[data-sale-root],[data-pp-root],[data-tr-root]');   // v1.86: POS Purchase screen bhi · v2.42: transfer note bhi

// ---------- data ----------

function collect() {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  const g2 = jamaG2(branches, names);
  const canJama = branches.includes(1) && g2 != null;
  const pick = (branch === JAMA && canJama) ? JAMA : branches.includes(branch) ? branch : (branches.includes(1) ? 1 : branches[0]);   // v1.67: shuru mein NOOR TRADERS (branch 1) · v2.82: 0 = 🧮 jama
  const of = b => chunks.filter(c => c.branch === b).sort((a, b) => (a.order || 0) - (b.order || 0)).flatMap(c => c.items);
  const items = pick === JAMA ? jamaItems(of(1), of(g2)) : of(pick);
  const meta = rows.find(r => r.meta && r.branch === (pick === JAMA ? 1 : pick)) || null;
  return { branches, pick, items, meta, names, g2, canJama };
}

// v2.82: 🧮 JAMA (farzi) — NOOR TRADERS + Godam 2 ek jagah. Sirf dikhane ke liye, POS mein kuch nahi badalta.
// "apni factory" category (surf, soda, kala soap) ka NT wala MINUS stock jama mein shamil NAHI (0 gina jata).
const JAMA = 0;
const isFactory = r => /factory|fact?ry|فیکٹری/i.test(String(r.cat || ''));
function jamaG2(branches, names) {
  const byName = branches.find(b => /godam\s*-?\s*2\b/i.test(String(names[b] || '')));
  if (byName != null) return byName;
  return branches.includes(2) ? 2 : null;
}
function jamaItems(nt, g2) {
  const map = new Map();
  for (const r of nt) map.set(String(r.id), { ...r, _nt: Number(r.stock) || 0, _g2: 0 });
  for (const r of g2) { const k = String(r.id); const o = map.get(k); if (o) o._g2 = Number(r.stock) || 0; else map.set(k, { ...r, _nt: 0, _g2: Number(r.stock) || 0 }); }
  return [...map.values()].map(o => {
    const fac = isFactory(o) && o._nt < 0;
    const stock = Math.round(((fac ? 0 : o._nt) + o._g2) * 100) / 100;
    const pack = Number(o.pack) || 0, ctn = pack > 0 ? Math.floor(stock / pack) : 0;
    return { ...o, stock, ctn, pcs: pack > 0 ? Math.round((stock - ctn * pack) * 100) / 100 : stock, _fac: fac, _jama: true };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
const isHidden = r => !!hidden[String(r.id)];
const passes = r => {
  if (filter === 'hidden') return isHidden(r);
  if (isHidden(r)) return false;
  if (filter === 'has') return Math.abs(Number(r.stock) || 0) > 0.001 || !!countOf(pickedBranch, r);
  if (filter === 'minus') return r.stock < 0;
  if (filter === 'baqi') return !countOf(pickedBranch, r);
  if (filter === 'farq') { const c = countOf(pickedBranch, r); return c && Math.abs(countedPcs(c) - Number(sysOf(c, r))) > 0.001; }
  if (filter === 'nishan') return !!flagOf(r.id).baqi;
  if (filter === 'check') return !!flagOf(r.id).check;
  return true;
};
let pickedBranch = null;
const branchName = (b, names) => (names && names[b]) || (b === 9 ? 'Godam 1' : 'Branch ' + b);

function since(stamp) {
  if (!stamp) return '';
  const mins = Math.floor((Date.now() - stamp) / 60000);
  if (mins < 1) return 'abhi abhi';
  if (mins < 60) return mins + ' minute pehle';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' ghante pehle';
  return new Date(stamp).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------- screen ----------

// Screen dobara banne par likhi hui (abhi save nahi hui) ginti gum na ho
const COUNT_SEL = '[data-count-ctn],[data-count-pcs],[data-count-tot]';
// Likhte hi neeche ginti / system / farq dikhao
function liveCount(id) {
  const box = $('list')?.querySelector(`[data-count-live="${CSS.escape(String(id))}"]`);
  if (!box) return;
  const { items } = collect();
  const item = items.find(r => String(r.id) === String(id));
  if (!item) return;
  const v = readCount(item, true);
  if (!v || v.bad) { box.innerHTML = ''; return; }
  const sys = Number(item.stock) || 0, diff = Math.round((v.total - sys) * 100) / 100;
  const u = item.uName || 'Pcs';
  box.innerHTML = `<b>${num(v.total)} ${esc(u)}</b> · System ${num(sys)} · <b class="${diff < 0 ? 'red' : diff > 0 ? 'green' : ''}">Farq ${diff > 0 ? '+' : ''}${num(diff)} ${esc(u)}${diff < 0 ? ' (kam)' : diff > 0 ? ' (zyada)' : ' (barabar)'}</b>${item.prate && diff ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * item.prate) : ''}`;
}
document.addEventListener('input', e => {
  const t = e.target;
  const id = t.dataset?.countCtn ?? t.dataset?.countPcs ?? t.dataset?.countTot;
  if (id != null) liveCount(id);
});
let stockActive = false;
function captureTyped() {
  const keep = new Map();
  const lst = $('list');
  if (!lst?.querySelectorAll) return keep;
  lst.querySelectorAll(COUNT_SEL).forEach(el => {
    if (el.value === el.defaultValue) return;
    const [name, id] = Object.entries(el.dataset)[0] || [];
    if (name) keep.set(`${pickedBranch}|${name}|${id}`, el.value);
  });
  return keep;
}
function restoreTyped(keep) {
  if (!keep.size) return;
  const lst = $('list');
  if (!lst?.querySelectorAll) return;
  lst.querySelectorAll(COUNT_SEL).forEach(el => {
    const [name, id] = Object.entries(el.dataset)[0] || [];
    const k = `${pickedBranch}|${name}|${id}`;
    if (keep.has(k)) el.value = keep.get(k);
  });
}

export function renderStock() {
  stockActive = true;
  const typed = captureTyped();
  renderStockInner();
  restoreTyped(typed);
}

function renderStockInner() {
  start();

  const q = norm($('search')?.value || '');
  const { branches, pick, items, meta, names, canJama } = collect();
  pickedBranch = pick;

  $('actions').innerHTML = '';
  $('summary').innerHTML = summaryHTML(branches, pick, items, meta, names, canJama);

  if (failed) {
    $('list').innerHTML = `<div class="empty"><strong>Stock nahi mila</strong><p>${esc(failed)}</p></div>`;
    return;
  }
  if (!loaded) { $('list').innerHTML = '<p class="stat-note">Stock load ho raha hai…</p>'; return; }
  if (!items.length) {
    $('list').innerHTML = `<div class="empty"><strong>Abhi stock nahi aaya</strong>
      <p>PC par <b>node sync-stock.js</b> chala kar dekhein.</p></div>`;
    return;
  }

  if (scanList.length) {
    // SCAN LIST: sirf scan kiye hue items, scan ki tarteeb mein (filter/search nahi lagta)
    const byId = new Map(items.map(r => [String(r.id), r]));
    const shownScan = scanList.map(id => byId.get(String(id))).filter(Boolean);
    $('list').innerHTML = `<div class="scan-bar">
        <b>Scan list: ${num(shownScan.length)} items</b>
        <small>Har item ki ginti likhein (Enter = agla khana), phir neeche "Sab save karein"</small>
      </div>` + shownScan.map(rowHTML).join('') +
      `<div class="account-tools scan-foot">
        <button class="sh-wide scan-save" data-scan-saveall="1">💾 Sab save karein (${num(shownScan.length)})</button>
        <button class="sh-wide" data-stock-scan="1">${camIco()} Aur scan karein</button>
        <button class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button>
      </div>`;
    return;
  }

  if (pickedBranch !== 1 && filter === 'all' && !godamAll) filter = 'has';   // v1.97: godam khula ho to shuru se sirf usi ke items
  let shown = items.filter(passes), wide = 0;
  if (inPick && inPick.size) shown = items.filter(r => inPick.has(String(r.id)));   // v2.6: aaye hue maal ki ginti
  if (q) {   // v2.4.5: sale jaisi — poore stock mein (filter se bahar bhi), best match UPAR (tarteeb smartSearch ki)
    const pool = items.filter(r => filter === 'hidden' ? isHidden(r) : !isHidden(r));
    const inF = new Set(shown);
    shown = smartSearch(pool, q, 500);
    wide = shown.filter(r => !inF.has(r)).length;
  } else if (sort === 'stock') shown.sort((a, b) => b.stock - a.stock);
  else shown.sort((a, b) => NAMEC.compare(String(a.name), String(b.name)));

  const extra = shown.length - limit;
  const list = shown.slice(0, limit);

  $('list').innerHTML =
    (inPick && inPick.size ? `<div class="in-strip">📥 Aaye hue maal ki ginti — ${num(shown.length)} items <button type="button" data-in-clear="1">✕ saaf karein</button></div>` : '') +
    (q ? `<p class="stat-note">${shown.length} item mile${wide && filter !== 'all' ? ` · ${num(wide)} filter ke bahar se bhi (poore stock mein dhoonda)` : ''}</p>` : '') +
    list.map(rowHTML).join('') +
    (extra > 0 ? `<div class="account-tools"><button data-stock-more="1">Aur ${num(Math.min(extra, PAGE))} dikhao (${num(extra)} baqi)</button></div>
      <p class="stat-note">Ya naam / code search karein.</p>` : '');
}

// v1.67: ginti ka sirf ek line ka khulasa; poori tafseel "📋 Dekhein" khirki mein. Counting ON/OFF, Nayi ginti,
// Farq wale / Check wale ab samne nahi (malik ki farmaish). Nayi ginti sirf khirki ke andar (malik) — bill ke baad.
function gintiLine(pick, done) {
  if (!round) return '<div class="sh-note">Abhi koi ginti nahi hui</div>' + (isOwner() ? '<div class="account-tools"><button data-stock-ginti="1">📋 Ginti</button></div>' : '');
  const billed = postReq && postReq.round === round && postReq.branch === pick && postReq.status === 'done';
  const d = round.slice(8, 10) + '-' + round.slice(5, 7);
  return `<div class="sh-note">${esc(d)} ki ginti: <b>${num(done)} items</b> gine gaye · ${billed ? 'bill ban gaya' : 'bill abhi nahi bana'}</div>
    <div class="account-tools"><button data-stock-ginti="1">📋 Dekhein</button>${isOwner() ? '<button data-stock-post="1">Farq ka bill PC par banao</button>' : ''}</div>
    ${isOwner() && countOff ? '<div class="account-tools"><button data-stock-lock="1" class="sh-lock off">🔴 Counting band hai — kholein</button></div>' : ''}
    ${countLocked() ? '<p class="stat-note sh-locked">🔴 Malik ne counting band ki hui hai — ginti save nahi ho sakti.</p>' : ''}`;
}
// v2.13: ginti ki report ka data (PDF app.js banata hai)
export function gintiReport() {
  const { pick, items, names } = collect();
  const list = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c)
    .sort((a, b) => (Number(b.c.at) || 0) - (Number(a.c.at) || 0));
  if (!list.length) return null;
  let net = 0, kam = 0, zyada = 0;
  const rows = list.map(({ r, c }) => {
    const sys = Number(sysOf(c, r)), got = countedPcs(c), f = got - sys, rs = r.prate ? f * r.prate : 0;
    net += rs; if (f < 0) kam++; else if (f > 0) zyada++;
    return { name: r.name, at: stampText(c.at), gina: `${num(c.ctn)}+${num(c.pcs)}`, ginaPcs: num(got), sys: num(sys),
      farq: (f > 0 ? '+' : '') + num(f), rs: (rs > 0 ? '+' : '') + num(Math.round(rs)), conf: f < 0 ? 'r' : f > 0 ? 'g' : '' };
  });
  return { branch: branchName(pick, names), round: round || '', rows, net: Math.round(net), kam, zyada, total: list.length };
}
let gintiPdfOf = null;
export function setGintiPdf(fn) { gintiPdfOf = fn; }
function openGinti() {
  const d = $('dialog'); if (!d) return;
  const { pick, items, names } = collect();
  const list = items.map(r => ({ r, c: countOf(pick, r) })).filter(x => x.c)
    .sort((a, b) => (Number(b.c.at) || 0) - (Number(a.c.at) || 0));
  let net = 0;
  const rows = list.map(({ r, c }) => {
    const f = countedPcs(c) - Number(sysOf(c, r)); const rs = r.prate ? f * r.prate : 0; net += rs;
    return `<tr><td>${esc(r.name)}<br><small>${esc(stampText(c.at))}</small></td><td>${num(c.ctn)}+${num(c.pcs)}<br><small>${num(countedPcs(c))}</small></td><td>${num(sysOf(c, r))}</td><td>${f > 0 ? '+' : ''}${num(f)}${rs ? `<br><small>Rs ${rs > 0 ? '+' : ''}${num(rs)}</small>` : ''}</td></tr>`;
  }).join('');
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = `📋 Ginti ${round || ''} — ${branchName(pick, names)}`;
  $('dialogBody').innerHTML = (list.length
    ? `<p>${num(list.length)} items gine gaye · Kul farq <b>Rs ${net > 0 ? '+' : ''}${num(net)}</b></p>
       <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Gina</th><th>System</th><th>Farq</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p>Is branch mein abhi koi item nahi gina gaya.</p>')
    + (list.length ? `<div class="account-tools"><button type="button" class="primary" data-ginti-pdf="1">⇩ PDF · WhatsApp</button></div>` : '')   // v2.13
    + (isOwner() ? `<p class="muted" style="margin-top:12px;font-size:.85em">Farq ka bill banne ke baad nayi ginti shuru karein, taake purani ginti dobara na gine.</p>
       <div class="account-tools"><button data-stock-round="new">Nayi ginti shuru</button></div>` : '');
  if (!d.open) d.showModal();
}

// v2.76: MALIK ONLY — stock ki kul maaliyat (khareed rate se), bechne par, nafa; har godam alag. Minus / rate-ke-baghair alag gine.
let valShowUntil = 0;
function valueCardHTML(branches, names) {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const per = [], tot = { cost: 0, sale: 0, neg: 0, noRate: 0, n: 0 };
  for (const b of branches) {
    const its = chunks.filter(c => c.branch === b).flatMap(c => c.items).map(fixCost);
    const g = { b, cost: 0, sale: 0, neg: 0, noRate: 0, n: 0 };
    for (const r of its) {
      const q = Number(r.stock) || 0; if (q < -0.0005) { g.neg++; continue; } if (q <= 0.0005) continue;
      const pr = Number(r.prate) || 0, sr = Number(r.rate) || 0;
      if (!pr) { g.noRate++; } else g.cost += q * pr;
      if (sr) g.sale += q * sr; g.n++;
    }
    per.push(g); for (const k of Object.keys(tot)) tot[k] += g[k];
  }
  const show = Date.now() < valShowUntil, R = v => show ? 'Rs ' + num(Math.round(v)) : 'Rs ••••';
  return `<div class="val-card" data-val-toggle="1"><div class="vc-top"><span>💰 Kul stock ki maaliyat <small>(sirf malik)</small></span><b>${R(tot.cost)}</b></div>
    <div class="vc-sub"><span>Bechne par ${R(tot.sale)}</span><span>Andaza nafa <b>${R(tot.sale - tot.cost)}</b></span></div>
    <div class="vc-g">${per.map(g => `<span><small>${esc(branchName(g.b, names))}</small><b>${R(g.cost)}</b></span>`).join('')}</div>
    ${tot.neg || tot.noRate ? `<p class="vc-warn">${tot.neg ? `⚠ ${num(tot.neg)} items ka stock minus — jor mein nahi` : ''}${tot.neg && tot.noRate ? ' · ' : ''}${tot.noRate ? `${num(tot.noRate)} items ka khareed rate nahi` : ''}</p>` : ''}
    <p class="vc-tap">${show ? 'Tap = chhupao' : 'Tap = 30 second dikhao'}</p></div>`;
}
document.addEventListener('click', e => { const c = e.target.closest?.('[data-val-toggle]'); if (!c || !isOwner()) return; valShowUntil = Date.now() < valShowUntil ? 0 : Date.now() + 30000; rerender(); if (valShowUntil) setTimeout(() => { if (Date.now() >= valShowUntil) rerender(); }, 30500); });
function summaryHTML(branches, pick, items, meta, names, canJama = false) {
  const totalPcs = meta?.totalPcs ?? items.reduce((s, r) => s + (r.stock || 0), 0);
  const stamp = meta?.syncedAt;

  const branchBar = branches.length > 1
    ? `<div class="account-tools">${branches.map(b =>
        `<button data-stock-branch="${b}"${b === pick ? ' class="selected"' : ''}>${esc(branchName(b, names))}</button>`
      ).join('')}${canJama ? `<button data-stock-branch="${JAMA}" class="jama-chip${pick === JAMA ? ' selected' : ''}" title="NOOR TRADERS + Godam 2 ek jagah (farzi jama — POS mein kuch nahi badalta); apni factory ka minus shamil nahi">🧮 NT + G2 (jama)</button>` : ''}</div>${pick === JAMA ? '<p class="stat-note jama-note">🧮 Farzi jama: NOOR TRADERS + Godam 2 · apni factory (surf, soda, kala soap) ka minus 0 gina gaya · POS mein kuch nahi badla</p>' : ''}`
    : '';

  const minus = items.filter(r => r.stock < 0 && !isHidden(r)).length;
  const live = items.filter(r => !isHidden(r));
  const hasN = live.filter(r => Math.abs(Number(r.stock) || 0) > 0.001 || countOf(pick, r)).length;
  const hiddenN = items.length - live.length;
  const done = items.filter(r => countOf(pick, r)).length;
  const gap = items.filter(r => { const c = countOf(pick, r); return c && Math.abs(countedPcs(c) - Number(sysOf(c, r))) > 0.001; }).length;
  const netRs = items.reduce((n, r) => {
    const c = countOf(pick, r);
    if (!c || !r.prate) return n;
    return n + (countedPcs(c) - Number(sysOf(c, r))) * r.prate;
  }, 0);
  const shownCount = items.filter(passes).length;
  const btn = (attr, val, cur, label) => `<button ${attr}="${val}"${cur === val ? ' class="selected"' : ''}>${label}</button>`;
  const roundText = round ? 'Ginti ' + esc(round) + ' — ' + num(done) + ' / ' + num(items.length) + ' hue' : 'Ginti shuru nahi hui';
  const farqText = Math.abs(netRs) > 0.5
    ? `<br><b>Kul farq: Rs ${netRs > 0 ? '+' : ''}${num(netRs)}</b> ${netRs < 0 ? '(nuqsan)' : '(zyada nikla)'}` : '';
  const roundBtns = (isOwner() ? '<button data-stock-round="new">Nayi ginti shuru</button>' : '')
    + (isOwner() && round ? '<button data-stock-post="1">Farq ka bill PC par banao</button>' : '')
    + (isOwner() ? `<button data-stock-lock="1" class="${countOff ? 'sh-lock off' : 'sh-lock'}">${countOff ? '🔴 Counting OFF — mulazim save nahi kar sakta' : '🟢 Counting ON'}</button>` : '')
    + (countLocked() ? '<p class="stat-note sh-locked">🔴 Malik ne counting band ki hui hai — ginti save nahi ho sakti, sirf dekh sakte hain.</p>' : '');
  const nishanN = items.filter(r => flagOf(r.id).baqi).length, checkN = items.filter(r => flagOf(r.id).check).length;
  return `${isOwner() ? valueCardHTML(branches, names) : ''}<div class="stock-head">
    <div class="sh-title">
      <strong>${num(shownCount)} items</strong>
      <small>${esc(branchName(pick, names))} · kul ${num(totalPcs)} pcs${stamp ? ' · ' + esc(since(stamp)) : ''}</small>
    </div>
    <div class="account-tools">
      ${scanList.length
        ? `<button class="sh-wide sh-scan" data-stock-scan="1">${camIco()} Aur scan karein (${num(scanList.length)} list mein)</button>
           <button class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button>`
        : `<div class="sh-scanrow"><button class="sh-wide sh-scan" data-stock-scan="1">${camMissing() ? '🔫 Scanner gun se scan karein (ek ya kai items)' : '📷 Barcode scan karein (ek ya kai items)'}</button><button type="button" class="sh-mic" data-stock-mic="1" title="Awaz se dhoondein">🎤</button></div>
           ${canEditItem() ? '<button class="sh-wide" data-stock-newitem="1">➕ Naya item</button>' : ''}
           <button class="sh-wide" data-stock-in="1">📥 Aaya / gaya maal</button><button class="sh-wide" data-stock-reg="1">📋 Transfer register</button><button class="sh-wide dm-btn" data-demand="1">📢 Demand (khatam / kam)</button>
           <button class="sh-wide sh-tolai" data-stock-tolai="1">⚖️ Tolai</button>${canEditItem() ? `<button class="sh-wide sh-urdu" data-stock-urdu="1">🔤 Urdu naam banao (AI)${Object.keys(urdu).length ? ' · ' + num(Object.keys(urdu).length) + ' bane' : ''}</button>` : ''}
           <button class="sh-wide" data-stock-transfer="1">⇄ Transfer note (godam se godam)</button>
           ${($('search')?.value || '').trim() ? '<button class="sh-wide" data-stock-clear="1">✕ Search saaf karein</button>' : ''}`}
    </div>
    ${isOwner() ? `<label class="sh-switch"><input type="checkbox" data-stock-itemedit="1"${itemCfg.itemEdit ? ' checked' : ''}> Mulazim item aur rates badal sake</label>` : ''}
    ${branchBar ? `<div class="sh-label">Branch</div>${branchBar}` : ''}
    <div class="sh-label">Dikhao</div>
    <div class="account-tools">
      ${btn('data-stock-filter', 'has', filter, pick !== 1 ? `📦 Is godam ka stock (${num(hasN)})` : `Stock wale (${num(hasN)})`)}
      ${btn('data-stock-filter', 'all', filter, `Sab (${num(live.length)})`)}
      ${btn('data-stock-filter', 'minus', filter, `Minus stock (${num(minus)})`)}
      ${btn('data-stock-filter', 'baqi', filter, `Ginti baqi (${num(items.length - done)})`)}
      ${btn('data-stock-filter', 'nishan', filter, `⏳ Baqi nishan (${num(nishanN)})`)}
      ${hiddenN ? btn('data-stock-filter', 'hidden', filter, `Band items (${num(hiddenN)})`) : ''}
    </div>
    <div class="sh-label">Ginti</div>
    ${gintiLine(pick, done)}
    ${postLine(pick)}
    ${bills.length ? `<div class="account-tools"><button class="sh-wide" data-stock-bills="1">📋 Farq bills ki history (${num(bills.length)})</button></div>` : ''}
    <div class="sh-label">Tarteeb</div>
    <div class="account-tools">
      ${btn('data-stock-sort', 'name', sort, 'Naam se')}
      ${btn('data-stock-sort', 'stock', sort, 'Zyada stock pehle')}
    </div>
  </div>`;
}

// ---------- v1.66: BARCODE LABEL — item ke saare barcode, har ek ki tadad; PC ka TSC printer chhapta hai ----------
function labelRows(r) {
  const q = new Map((Array.isArray(r.bq) ? r.bq : []).map(x => [String(x.b || '').trim(), Number(x.q) || 1]));
  // v1.68: POS mein sub-barcode ka "Show" ✓ (sync-stock v8 -> r.bs) — sirf asal code + Show wale. bs na ho (purani sync) to sab.
  const pr = Number(r.rate2) || Number(r.rate) || 0;   // khula piece rate (POS "Peice Rate")
  const main = String(r.code || '').trim();
  const out = main ? [{ code: main, qty: 1, main: true, show: true }] : [];
  const seen = new Set(out.map(x => x.code));
  const sbList = subOverride(r);   // v1.70: sync-stock v9 ka sb (id ke saath) + app ki taaza tabdeeli
  if (sbList) {
    for (const x of sbList) { const c = String(x.b || '').trim(); if (!c || seen.has(c)) continue; seen.add(c); out.push({ code: c, qty: Number(x.q) || 1, subId: x.id, show: x.s !== false, rate: Number(x.r) || 0 }); }
  } else {
    const subs = Array.isArray(r.bs) ? r.bs.map(b => String(b).trim()) : (Array.isArray(r.bc) ? r.bc.map(b => String(b).trim()) : []);
    for (const c of subs) { if (!c || seen.has(c)) continue; seen.add(c); out.push({ code: c, qty: q.get(c) || 1, show: true }); }
  }
  return out.map(x => ({ ...x, price: x.rate > 0 ? x.rate : Math.round(x.qty * pr * 100) / 100 }));
}
// v1.70: app se banaya / badla / hataya barcode — sync-stock (2 min) se pehle bhi khirki mein sahi dikhe
const subPatch = new Map();   // itemId -> [{id,b,q,r,s}]
function subOverride(r) {
  const k = String(r.id);
  if (subPatch.has(k) && Date.now() - subPatch.get(k).at > 5 * 60000) subPatch.delete(k);   // 5 min baad sync-stock ka data hi sahi hai
  if (subPatch.has(k)) return subPatch.get(k).list;
  return Array.isArray(r.sb) ? r.sb : null;
}
function applySub(r, op, x) {
  const k = String(r.id);
  const list = (subOverride(r) || []).map(y => ({ ...y }));
  if (op === 'delete') subPatch.set(k, { at: Date.now(), list: list.filter(y => Number(y.id) !== Number(x.subId)) });
  else if (op === 'edit') subPatch.set(k, { at: Date.now(), list: list.map(y => Number(y.id) === Number(x.subId) ? { ...y, b: x.code, q: x.qty, r: x.rate, s: x.show } : y) });
  else subPatch.set(k, { at: Date.now(), list: [...list, { id: x.subId, b: x.code, q: x.qty, r: x.rate, s: x.show }] });
}
// ---------- v2.5: ITEM — naam, barcode, 1 CTN = PCS, khareed + parchoon / wholesale rates ----------
const itemDraft = new Map();
const ctnR = (p, pk) => { const x = (Number(p) || 0) * pk, n = Math.round(x); return Math.abs(x - n) <= 0.005 * pk + 1e-6 ? n : r2(x); };   // v2.98.7
function itemForm(r, pre) {
  const d = $('dialog'); if (!d) return;
  const isNew = !r;
  // v2.98.7: POS fi PIECE rakhta hai — CTN = fi piece × pack (POS ki 2-decimal gol-mol hata kar: 534.38 × 16 = 8550.08 -> 8550).
  //   W PCS = ws (SaleRateSize, sync-stock sirf farq par bhejti) warna wrate; W CTN = wrate (SaleRate3) × pack — dono alag
  const pk1 = Number(r?.pack) > 1 ? Number(r.pack) : 0;
  const v = { name: r?.name || '', code: r?.code || '', pack: Number(r?.pack) || 0,
    costP: Number(r?.prate) || 0, rpcs: Number(r?.rate2) || Number(r?.rate) || 0,
    rctn: (pk1 ? ctnR(Number(r?.rate) || 0, pk1) : 0) || 0,
    wpcs: Number(r?.ws) || Number(r?.wrate) || 0, wctn: (pk1 ? ctnR(Number(r?.wrate) || 0, pk1) : 0) || 0, costC: 0, ...(pre || {}) };
  const pk0 = Number(v.pack) > 0 ? Number(v.pack) : 1;
  if (!v.costC) v.costC = pk0 > 1 ? ctnR(v.costP, pk0) : r2(v.costP);
  if (Number(v.pack) > 1) { if (!v.rctn) v.rctn = r2(v.rpcs * v.pack); if (!v.wctn) v.wctn = r2(v.wpcs * v.pack); }
  const rates = canEditItem();
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = isNew ? '➕ Naya item' : '✏️ ' + r.name;
  const f = (lab, k) => `<label class="it-f"><span>${lab}</span><input type="number" min="0" step="any" inputmode="decimal" name="${k}" value="${v[k] ? r2(v[k]) : ''}" placeholder="0"${rates ? '' : ' disabled'}></label>`;
  const subs = r ? labelRows(r).filter(x => !x.main) : [];
  $('dialogBody').innerHTML = `<form class="item-form" data-item-form="${r ? esc(r.id) : 'new'}">
    <label class="it-wide"><span>Item ka naam</span><input name="name" required maxlength="150" autocomplete="off" value="${esc(v.name)}" placeholder="misal: marhaba honey 80gm"></label>
    <label class="it-wide"><span>Barcode</span><div class="it-code"><input name="code" maxlength="50" autocomplete="off" value="${esc(v.code)}" placeholder="${isNew ? 'Khali chhorein to POS khud banayega' : ''}"><button type="button" data-item-scan="1">📷</button></div></label>
    <label class="it-wide"><span>1 CTN = kitne PCS</span><input type="number" min="0" step="any" inputmode="decimal" name="pack" value="${v.pack || ''}" placeholder="misal: 12"></label>
    <div class="it-head">Khareed</div>
    <div class="it-grid">${f('Kh / CTN', 'costC')}${f('Kh / PCS', 'costP')}</div>
    <div class="it-note">Kh / CTN likhein — Kh / PCS khud nikal aayega</div>
    <div class="it-head">Parchoon</div>
    <div class="it-grid">${f('R / CTN', 'rctn')}${f('R / PCS', 'rpcs')}</div>
    <div class="it-head">Wholesale</div>
    <div class="it-grid">${f('W / CTN', 'wctn')}${f('W / PCS', 'wpcs')}</div>
    ${rates ? '' : '<p class="muted it-lock">🔒 Rates sirf malik badal sakta hai</p>'}
    ${r ? `<div class="it-head">Sub-barcode (${subs.length})</div>
      <div class="it-subs">${subs.map(x => `<div class="it-sub${x.show === false ? ' off' : ''}"><div><b>${esc(x.code)}</b><small>${x.qty !== 1 ? 'Tadad ' + num(x.qty) + ' · ' : ''}Rs ${num(x.price)}${x.show === false ? ' · Show off' : ''}</small></div>
        <button type="button" data-sub-edit="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Badlein">✏️</button>
        <button type="button" class="danger" data-sub-del="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Hatao">🗑️</button></div>`).join('') || '<p class="muted">Koi sub-barcode nahi</p>'}</div>
      <div class="account-tools"><button type="button" data-sub-new="${esc(r.id)}">➕ Naya barcode</button></div>` : ''}
    <div class="account-tools it-acts"><button type="submit" class="primary">${isNew ? '➕ POS mein banao' : '💾 POS mein save'}</button><button type="button" data-item-close="1">Wapas</button></div>
    <p class="muted it-msg" role="status"></p></form>`;
  if (!d.open) d.showModal();
  setTimeout(() => $('dialogBody').querySelector('input[name=name]')?.focus(), 50);
}
function itemRead(form) {
  const g = k => form.querySelector('[name=' + k + ']');
  const nv = k => { const e = g(k); return e && !e.disabled ? Math.max(0, Number(e.value) || 0) : null; };
  return { name: String(g('name').value || '').trim(), code: String(g('code').value || '').trim(),
    pack: Math.max(0, Number(g('pack').value) || 0), costC: nv('costC'), costP: nv('costP'), rctn: nv('rctn'), rpcs: nv('rpcs'), wctn: nv('wctn'), wpcs: nv('wpcs') };
}
async function itemSave(form, btn) {
  const id = form.dataset.itemForm, isNew = id === 'new';
  const r = isNew ? null : rowCache.get(String(id));
  const v = itemRead(form), msg = form.querySelector('.it-msg');
  const pk = (Number(v.pack) > 0 ? Number(v.pack) : 1);
  if (!(v.costP > 0) && v.costC > 0) v.costP = r2(v.costC / pk);        // v2.5.1: sirf CTN likha to PCS khud
  if (pk > 1 && v.costC > 0 && v.costP > 0 && Math.abs(v.costP * pk - v.costC) <= 0.005 * pk + 1e-6) v.costP = Math.round(v.costC / pk * 10000) / 10000;   // v2.98.7: POS ka CTN bilkul wohi (8450 ÷ 16 = 528.125)
  if (!v.name) { msg.textContent = 'Item ka naam likhein'; return; }
  if (!cloud?.requestItem) { msg.textContent = 'Item ke liye app update karein'; return; }
  const keep = k => (v[k] == null ? (k === 'costP' ? Number(r?.prate) || 0 : k === 'rpcs' ? Number(r?.rate2) || Number(r?.rate) || 0 : k === 'wpcs' ? Number(r?.ws) || Number(r?.wrate) || 0 : 0) : v[k]);   // v2.98.7: W PCS = ws
  const job = { op: isNew ? 'new' : 'edit', itemId: isNew ? '' : String(r.id), code: v.code, name: v.name, pack: v.pack,
    costP: keep('costP'), rctn: keep('rctn'), rpcs: keep('rpcs'), wctn: keep('wctn'), wpcs: keep('wpcs') };
  if (!isNew) job.subs = labelRows(r).filter(x => !x.main).map(x => ({ b: x.code, q: x.qty, r: x.rate || 0, s: x.show !== false }));
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ PC ko bhej raha hoon…';
  try {
    const jid = await cloud.requestItem(job);
    msg.textContent = '⏳ PC ke jawab ka intezar… (PC on ho aur item-post chal raha ho)';
    let stop = null, done = false;
    const end = (m, ok) => { if (done) return; done = true; try { stop && stop(); } catch {}
      btn.disabled = false; btn.textContent = old; msg.textContent = m;
      if (ok) { notice(isNew ? '✓ Item POS mein ban gaya' : '✓ Item POS mein save ho gaya'); setTimeout(() => $('dialog')?.close(), 900); rerender(); } };
    stop = cloud.watchItem ? cloud.watchItem(jid, j => {
      if (!j) return;
      if (j.status === 'done') end('✓ POS mein ho gaya' + (j.code ? ' — code ' + j.code : ''), true);
      else if (j.status === 'failed') end('Nahi hua: ' + (j.error || 'nakam'), false);
    }) : null;
    setTimeout(() => end('PC se jawab nahi aaya — PC on hai aur item-post chal raha hai? (hukum mehfooz hai, PC on hote hi lag jayega)', false), 45000);
  } catch (e) { btn.disabled = false; btn.textContent = old; msg.textContent = 'Nahi bheja: ' + (e?.message || e); }
}
function subForm(r, edit) {
  const d = $('dialog');
  const isEdit = !!(edit && edit.subId);
  $('dialogTitle').textContent = (isEdit ? '✏️ Barcode badlein — ' : '➕ Naya barcode — ') + r.name;
  const q = edit ? edit.qty : 1, qs = [0.125, 0.25, 0.5, 1, 5];
  $('dialogBody').innerHTML = `<form class="sub-form" data-sub-form="${esc(r.id)}"${isEdit ? ` data-sub-id="${edit.subId}"` : ''}>
    <label>Barcode<div class="sub-code-row"><input name="code" required maxlength="50" autocomplete="off" value="${esc(edit?.code || '')}" placeholder="Likhein ya scan karein"><button type="button" data-sub-scan="1">📷</button></div></label>
    <label>Tadad<input name="qty" type="text" inputmode="decimal" required value="${num(q)}"></label>
    <div class="account-tools sub-qty">${qs.map(v => `<button type="button" data-sub-qty="${v}"${v === q ? ' class="selected"' : ''}>${num(v)}</button>`).join('')}</div>
    <label>Rate (khali = item rate × tadad)<input name="rate" type="text" inputmode="decimal" value="${edit && edit.rate > 0 ? num(edit.rate) : ''}" placeholder="0"></label>
    <label class="sub-show"><input type="checkbox" name="show"${!edit || edit.show ? ' checked' : ''}> Show ✓ (label mein dikhe)</label>
    <div class="account-tools"><button type="submit" class="primary">${isEdit ? '💾 Save' : '➕ POS mein banao'}</button><button type="button" data-sub-back="${esc(r.id)}">Wapas</button></div>
    <p class="muted sub-msg" style="font-size:.85em"></p></form>`;
  if (!d.open) d.showModal();
  setTimeout(() => $('dialogBody').querySelector('input[name=code]')?.focus(), 50);
}
function subDupe(r, code, skipSubId) {
  const c = String(code).trim().toLowerCase();
  for (const it of collect().items) {
    if (String(it.code || '').trim().toLowerCase() === c) return `item "${it.name}" ka asal code`;
    const sb = subOverride(it);
    if (sb) { for (const x of sb) if (String(x.b || '').trim().toLowerCase() === c && Number(x.id) !== Number(skipSubId)) return `item "${it.name}" ka sub-barcode`; }
    else if (Array.isArray(it.bc) && it.bc.some(b => String(b).trim().toLowerCase() === c) && String(it.id) !== String(r.id)) return `item "${it.name}" ka sub-barcode`;
  }
  return '';
}
async function subSend(r, op, x, msgEl, btn) {
  if (!cloud?.requestSubcode) { notice('App update karein'); return; }
  if (btn) btn.disabled = true;
  const say = t => { if (msgEl) msgEl.textContent = t; };
  say('🖥 PC ko ja raha hai…');
  try {
    const jid = await cloud.requestSubcode({ op, itemId: r.id, subId: x.subId, code: x.code, qty: x.qty, rate: x.rate, show: x.show });
    let stop = null, done = false;
    const end = (ok, t) => { if (done) return; done = true; try { stop && stop(); } catch {} if (btn) btn.disabled = false;
      if (ok) { applySub(r, op, { ...x, subId: t.subId || x.subId, code: t.code || x.code }); notice(op === 'delete' ? '✓ Barcode POS se hat gaya' : '✓ POS mein ho gaya'); openLabels(r.id); }
      else { say('⚠️ ' + t); notice('Nahi hua: ' + t); } };
    stop = cloud.watchSubcode(jid, j => { if (!j) return; if (j.status === 'done') end(true, j); else if (j.status === 'failed') end(false, j.error || 'masla'); });
    setTimeout(() => end(false, 'PC se jawab nahi aaya — PC on hai aur subcode-sync chal raha hai? (hukum mehfooz hai, PC on hote hi ho jayega)'), 45000);
  } catch (e) { if (btn) btn.disabled = false; say('⚠️ ' + (e?.message || e)); }
}
// ek barcode scan karke wapas (chhota camera, sirf is form ke liye)
async function scanOnce(input) {
  if (!navigator.mediaDevices?.getUserMedia || !(await camCheck())) { notice('🔫 Is device par camera nahi — barcode scanner gun se seedha khane mein scan karein, ya code likhein.'); try { input.focus(); } catch {} return; }
  let det;
  if ('BarcodeDetector' in window) { try { det = new BarcodeDetector(); } catch {} }
  if (!det) { try { det = await zxingDetector(); } catch { notice('Barcode library load nahi hui'); return; } }
  const box = document.createElement('div'); box.className = 'sub-scan';
  box.innerHTML = '<video playsinline muted autoplay></video><div class="scan-line"></div><button type="button" class="sub-scan-x">✕ Band</button>';
  document.body.appendChild(box);
  const v = box.querySelector('video'); let stream = null, on = true;
  const close = () => { on = false; try { stream?.getTracks().forEach(t => t.stop()); } catch {} box.remove(); };
  box.querySelector('.sub-scan-x').onclick = close;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }); v.srcObject = stream; await v.play(); }
  catch (e) { close(); notice(e?.name === 'NotFoundError' ? '🔫 Is device par camera nahi mila — scanner gun se khane mein scan karein, ya code likhein.' : 'Camera nahi khula: ' + (e?.message || e)); try { input.focus(); } catch {} return; }
  const loop = async () => {
    if (!on) return;
    if (v.readyState >= 2) { try { const f = await det.detect(v); const c = f.map(x => String(x.rawValue || '').trim()).find(Boolean); if (c) { input.value = c; beep(true); if (navigator.vibrate) navigator.vibrate(60); close(); return; } } catch {} }
    setTimeout(loop, 120);
  };
  loop();
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-sub-new],[data-sub-edit],[data-sub-del],[data-sub-back],[data-sub-scan],[data-sub-qty]');
  if (!t) return;
  if (t.dataset.subNew) { const r = rowCache.get(t.dataset.subNew); if (r) subForm(r, null); return; }
  if (t.dataset.subBack) { openLabels(t.dataset.subBack); return; }
  if (t.dataset.subQty) { const f = t.closest('form'); f.elements.qty.value = t.dataset.subQty; f.querySelectorAll('[data-sub-qty]').forEach(b => b.classList.toggle('selected', b === t)); return; }
  if (t.dataset.subScan) {   // v1.74: sale wala bara scanner (Focus/Zoom/Camera/Light); dialog band karke, code milte hi form dobara
    const f = t.closest('form'), r = rowCache.get(f.dataset.subForm); if (!r) return;
    const st = { subId: Number(f.dataset.subId) || 0, code: f.elements.code.value, qty: Number(String(f.elements.qty.value).replace(',', '.')) || 1, rate: Number(f.elements.rate.value) || 0, show: f.elements.show.checked };
    try { $('dialog').close(); } catch {}
    scanPick(code => { subForm(r, { ...st, code }); });
    return;
  }
  if (t.dataset.subEdit) { const r = rowCache.get(t.dataset.subItem), x = r && labelRows(r).find(y => String(y.subId) === t.dataset.subEdit); if (x) subForm(r, x); return; }
  if (t.dataset.subDel) { const r = rowCache.get(t.dataset.subItem), x = r && labelRows(r).find(y => String(y.subId) === t.dataset.subDel);
    if (!x) return; if (!confirm(`"${x.code}" (${r.name}) POS se hata dein?`)) return; subSend(r, 'delete', x, t.closest('.label-row')?.querySelector('small'), t); return; }
});
// v2.5.1: Kh / CTN likhein -> Kh / PCS khud (÷ pack). Kh / PCS likhein to Kh / CTN khud (× pack).
// Parchoon aur Wholesale ko app HAATH NAHI lagati — wo aap ke apne likhe hue rehte hain.
document.addEventListener('input', e => {
  const t = e.target, f = t?.closest?.('[data-item-form]'); if (!f) return;
  const k = t.name; if (!['pack', 'costC', 'costP'].includes(k)) return;
  const g = n => f.querySelector('[name=' + n + ']');
  const pk = Math.max(0, Number(g('pack').value) || 0) || 1;
  const put = (n, val) => { const el = g(n); if (el && document.activeElement !== el && !el.disabled) el.value = val > 0 ? String(r2(val)) : ''; };   // number khane mein comma nahi
  if (k === 'costC') put('costP', (Number(t.value) || 0) / pk);
  else if (k === 'costP') put('costC', (Number(t.value) || 0) * pk);
  else { const c = Number(g('costC').value) || 0; if (c > 0) put('costP', c / pk); else put('costC', (Number(g('costP').value) || 0) * pk); }
});
document.addEventListener('submit', e => {                            // v2.5: item form
  const itf = e.target.closest?.('[data-item-form]');
  if (itf) { e.preventDefault(); itemSave(itf, itf.querySelector('button[type=submit]')); return; }
});
document.addEventListener('submit', e => {
  const f = e.target.closest?.('[data-sub-form]'); if (!f) return;
  e.preventDefault();
  const r = rowCache.get(f.dataset.subForm); if (!r) return;
  const code = String(f.elements.code.value || '').trim(), qty = Number(String(f.elements.qty.value).replace(',', '.')), rate = Number(f.elements.rate.value) || 0;
  const msg = f.querySelector('.sub-msg');
  if (!code) { msg.textContent = '⚠️ Barcode likhein'; return; }
  if (!(qty > 0)) { msg.textContent = '⚠️ Tadad 0 se zyada likhein'; return; }
  const subId = Number(f.dataset.subId) || 0;
  const dupe = subDupe(r, code, subId);
  if (dupe) { msg.textContent = `⚠️ "${code}" pehle se ${dupe} hai`; return; }
  subSend(r, subId ? 'edit' : 'add', { subId, code, qty: Math.round(qty * 1000) / 1000, rate, show: f.elements.show.checked }, msg, f.querySelector('button[type=submit]'));
});

function openLabels(id) {
  const r = rowCache.get(String(id)), d = $('dialog');
  if (!r || !d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = '🏷️ ' + r.name;
  const rows = labelRows(r);
  const pack = Number(r.pack) || 0;
  $('dialogBody').innerHTML = `<p style="margin:0 0 8px">${esc(r.code || '')} · Stock ${num(r.stock)} ${esc(r.uName || 'Pcs')}${pack > 1 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}
      <br>Piece rate <b>${num(Number(r.rate2) || Number(r.rate) || 0)}</b>${pack > 1 ? ` · ${esc(r.cName || 'Ctn')} rate <b>${num((Number(r.rate) || 0) * pack)}</b>` : ''}${r.wrate ? ` · Wholesale <b>${num(r.wrate)}</b>` : ''}</p>
    <div class="label-list">${rows.map((x, i) => `<div class="label-row${x.show === false ? ' off' : ''}">
      <div class="label-info"><b>${esc(x.code)}</b><small>${x.qty !== 1 ? 'Tadad ' + num(x.qty) + ' · ' : ''}Rs ${num(x.price)}${x.show === false ? ' · Show off' : ''}${x.main ? ' · asal code' : ''}</small></div>
      ${x.show === false ? '' : `<input type="number" min="1" max="1000" value="1" inputmode="numeric" data-label-copies="${i}" aria-label="Kitne label">
      <button type="button" class="primary" data-label-print="${i}" data-label-item="${esc(r.id)}">🖨️</button>`}
      ${x.subId ? `<button type="button" data-sub-edit="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Badlein">✏️</button><button type="button" class="danger" data-sub-del="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Hatao">🗑️</button>` : ''}
    </div>`).join('') || '<p>Is item ka koi barcode nahi.</p>'}</div>
    <div class="account-tools" style="margin-top:8px"><button type="button" data-sub-new="${esc(r.id)}">➕ Naya barcode</button></div>
    ${isOwner() ? `<label style="display:block;margin-top:10px">Doosre naam (search ke liye, comma se alag)<input type="text" data-alias-item="${esc(r.id)}" value="${esc(aliasOf(r.id))}" placeholder="misal: surkh mirch, lal mirch, chilli" maxlength="250"></label>` : (aliasOf(r.id) ? `<p class="muted" style="font-size:.85em">Doosre naam: ${esc(aliasOf(r.id))}</p>` : '')}
    <p class="muted" style="font-size:.85em;margin-top:8px">Label PC ke TSC printer par chhapta hai (PC par label-print chalna chahiye).</p>`;
  if (!d.open) d.showModal();
}
async function printLabel(btn) {
  const r = rowCache.get(String(btn.dataset.labelItem)); if (!r) return;
  const i = Number(btn.dataset.labelPrint), x = labelRows(r)[i]; if (!x) return;
  const inp = document.querySelector(`[data-label-copies="${i}"]`);
  const copies = Math.max(1, Math.min(1000, Math.floor(Number(inp?.value) || 1)));   // v2.95.5: 1000 tak — 200-200 ke hisson mein
  if (!cloud?.requestLabel) { notice('Label ke liye app update karein'); return; }
  const parts = []; for (let left = copies; left > 0; left -= 200) parts.push(Math.min(200, left));
  if (parts.length > 1 && !confirm(`${copies} label — ${parts.length} hisson mein chhapenge (${parts.join(' + ')}). Theek?`)) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Bhej rahe...';
  try {
    const jids = [];
    for (const c of parts) jids.push(await cloud.requestLabel({ itemId: r.id, code: x.code, name: r.name, qty: x.qty, rate: x.price, copies: c }));
    btn.textContent = '⏳ PC...';
    // v2.97: 🖨 live patti isi khirki mein — kitne chhape, line mein kaun, ✕ Cancel
    { const dlg = btn.closest('dialog') || document; let box = dlg.querySelector('.lv-pop'); if (!box) { box = document.createElement('div'); box.className = 'lv-pop'; (btn.closest('form,.label-box,div') || dlg.body || dlg).insertAdjacentElement('afterend', box); }
      if (cloud.listenLabelJobs && !box._un) { box._un = cloud.listenLabelJobs(Date.now() - 3 * 3600000, l => { if (!box.isConnected) { try { box._un?.(); } catch {} return; } box.innerHTML = liveLabelsHTML(l); }); } }
    const stops = []; let done = false, ok = 0;
    const end = (msg, good) => { if (done) return; done = true; stops.forEach(f => { try { f && f(); } catch {} }); btn.disabled = false; btn.textContent = good ? '✓ Chhap gaya' : old; notice(msg); setTimeout(() => { if (btn.isConnected) btn.textContent = old; }, 4000); };
    if (cloud.watchLabel) jids.forEach(jid => { let seen = false; stops.push(cloud.watchLabel(jid, j => {
      if (!j || seen) return;
      if (j.status === 'done') { seen = true; ok++; if (ok === jids.length) end(`✓ ${copies} label chhap gaye`, true); else btn.textContent = `⏳ ${ok}/${jids.length}`; }
      else if (j.status === 'failed' || j.status === 'skipped') { seen = true; end('Label nahi chhapa: ' + (j.error || j.status), false); }
      else if (j.status === 'cancelled') { seen = true; end('✕ Label cancel' + (Number(j.sent) ? ' — ~' + j.sent + ' chhapne ke baad' : ''), false); }
    })); });
    setTimeout(() => end('PC se jawab nahi aaya — PC on hai aur label-print chal raha hai? (hukum mehfooz hai, PC on hote hi chhapega)', false), 45000 * parts.length);
  } catch (e) { btn.disabled = false; btn.textContent = old; notice('Label nahi bheja: ' + (e?.message || e)); }
}

// ---------- v1.73: STOCK TRANSFER NOTE (godam se godam) — PC transfer-sync.js POS mein STN banata hai ----------
let trLines = [], trFrom = null, trTo = null, trStop = null, trList = [];
function trBranches() { const { branches, names } = collect(); return branches.map(b => ({ id: b, name: branchName(b, names) })); }
function trStockOf(b, id) { return Number(saleStockItem(b, id)?.stock || 0); }
// ---------- v2.18: Transfer note ki SMART search ----------
// - jis godam se maal nikalna hai wahan STOCK 0 / minus wale items DIKHTE HI NAHI (chahein to ek tap se dikha lein)
// - bade chips: godam · stock (green/amber/red) · 1 Ctn = ? · code | match hue harf highlight
// - poora barcode likhte hi item khud lag jata hai aur cursor seedha tadad par
// - khali khana: "aksar bheje jane wale" (isi phone ki yaad-dasht se)
const TR_REC_KEY = 'sam-tr-recent-v1';
let trRecent = null, trFocus = null, trZeroShow = false, trFindTimer = null;
let trCopies = 1; try { trCopies = Math.min(3, Math.max(1, Number(localStorage.getItem('sam-tr-copies')) || 1)); } catch {}   // v2.43: note kitni dafa chhape
const trCopyChips = () => `<div class="sale-copies"><small>🖨 Note print</small>${[1, 2, 3].map(n => `<button type="button" data-tr-copies="${n}"${trCopies === n ? ' class="on"' : ''}>×${n}</button>`).join('')}</div>`;
document.addEventListener('click', e => { const b = e.target.closest?.('[data-tr-copies]'); if (!b) return; trCopies = Number(b.dataset.trCopies) || 1; try { localStorage.setItem('sam-tr-copies', String(trCopies)); } catch {} document.querySelectorAll('[data-tr-copies]').forEach(x => x.classList.toggle('on', Number(x.dataset.trCopies) === trCopies)); });
function trRecLoad() { if (trRecent) return trRecent; try { trRecent = JSON.parse(localStorage.getItem(TR_REC_KEY) || '[]'); } catch { trRecent = []; } if (!Array.isArray(trRecent)) trRecent = []; return trRecent; }
function trRecNote(id) { const a = trRecLoad().filter(x => String(x) !== String(id)); a.unshift(String(id)); trRecent = a.slice(0, 15); try { localStorage.setItem(TR_REC_KEY, JSON.stringify(trRecent)); } catch {} }
function trRecRank(id) { const i = trRecLoad().indexOf(String(id)); return i < 0 ? 0 : (15 - i) / 6; }   // halka sa upar, match ki jagah nahi leta
function trRecItems(items, n = 6) { const out = [];
  for (const id of trRecLoad()) { const r = items.find(x => String(x.id) === String(id)); if (r && trHas(r)) out.push(r); if (out.length >= n) break; }
  return out; }
const trHas = r => trStockOf(trFrom, r.id) > 0.0005;
function trStockChip(r) {
  const s = trStockOf(trFrom, r.id), pk = Number(r.pack) || 0;
  const cls = s <= 0.0005 ? 'red' : (pk > 1 ? (s < pk ? 'amber' : 'green') : (s < 5 ? 'amber' : 'green'));
  const ctn = pk > 1 && s >= pk ? ` · ${num(Math.floor(s / pk))} ${esc(r.cName || 'Ctn')}` : '';
  return `<span class="sh-chip ${cls}">📦 ${num(s)} ${esc(r.uName || 'Pcs')}${ctn}</span>`;
}
function trRowHTML(r, i, q, gname) {
  const pk = Number(r.pack) || 0;
  return `<button type="button" class="sh-row" data-tr-pick="${i}"><b class="sh-name">${hlName(r.name, q)}</b><span class="sh-chips"><span class="sh-chip godam">${gname}</span>${trStockChip(r)}${pk > 1 ? `<span class="sh-chip pack">1 ${esc(r.cName || 'Ctn')} = ${num(pk)}</span>` : ''}${r.code ? `<span class="sh-chip code">#${esc(r.code)}</span>` : ''}</span></button>`;
}
function trMark(hits, n) {
  const rows = [...hits.querySelectorAll('[data-tr-pick]')];
  rows.forEach((b, i) => b.classList.toggle('on', i === n));
  if (n >= 0 && rows[n]) try { rows[n].scrollIntoView({ block: 'nearest' }); } catch {}
}
function trPaint(hits, list, q, zeroN, gname) {
  hits._src = list;
  hits.innerHTML = `<p class="sh-head">🔍 ${esc(q)}<button type="button" class="sh-close" data-tr-close="1" aria-label="band">✕</button></p>` + (list.length ? list.map((r, i) => trRowHTML(r, i, q, gname)).join('') : `<p class="sh-empty">Kuch nahi mila${zeroN ? '' : ' — naam ya code dobara dekh lein'}</p>`)
    + (zeroN ? `<button type="button" class="sh-more" data-tr-zero="1">🚫 ${num(zeroN)} item mile magar ${gname} mein stock 0 — phir bhi dikhayein</button>` : '');
  trMark(hits, list.length ? 0 : -1);
  hits.hidden = false;
}
function trShowRecent(hits) {
  const { items, names } = collect(), list = trRecItems(items, 6);
  if (!list.length) { hits.hidden = true; return; }
  const gname = esc(branchName(trFrom, names));
  hits._src = list;
  hits.innerHTML = `<p class="sh-head">⏱ Aksar bheje jane wale<button type="button" class="sh-close" data-tr-close="1" aria-label="band">✕</button></p>` + list.map((r, i) => trRowHTML(r, i, '', gname)).join('');
  trMark(hits, -1);
  hits.hidden = false;
}
function trPick(r, qtyFocus) { if (!r) return; trRecNote(r.id); trFocus = { id: r.id, qty: !!qtyFocus }; trAdd(r); }
function saleStockItem(b, id) { const chunks = rows.filter(r => !r.meta && Array.isArray(r.items) && r.branch === Number(b)); for (const c of chunks) { const it = c.items.find(x => String(x.id) === String(id)); if (it) return it; } return null; }
// ---------- v2.6: 📥 AAYA HUA MAAL — transfer + purchase bill se aaye items, dono taraf ka stock ----------
let inDays = 1, inKind = 'all', inRows = null, inFilter = false, inPick = null, inHere = false;
const dayAgo = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1)); return d.getTime(); };
const dmy = t => { const d = new Date(t); return String(d.getDate()).padStart(2, '0') + '-' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; };
async function inCollect() {
  const since = dayAgo(inDays), { pick, items, names } = collect();
  const G = new Map();                       // hisse: "tr:9>1" / "bill:Bhaiya"
  const add = (key, head, l, at) => {
    const qty = Number(l.qty) || 0; if (!(qty > 0)) return;
    let g = G.get(key); if (!g) { g = { key, ...head, items: new Map(), at: 0 }; G.set(key, g); }
    g.at = Math.max(g.at, at || 0);
    const id = String(l.itemId ?? l.id); let e = g.items.get(id);
    if (!e) { e = { id, name: l.name || '', qty: 0, at: 0 }; g.items.set(id, e); }
    e.qty = r2(e.qty + qty); e.at = Math.max(e.at, at || 0); e.name = e.name || l.name;
  };
  if (inKind !== 'bill') {
    // v2.8: POS ke apne transfer (PC se) — in mein app wale bhi aa jate hain, is liye yahi asal list hai
    const seen = new Set();
    for (const j of ptList) {
      if (Number(j.at) < since) continue;
      if (inHere && Number(j.to) !== Number(pick)) continue;
      seen.add(String(j.transferNo || '').trim());
      for (const l of (j.lines || [])) add(`tr:${j.from}>${j.to}`, { kind: 'tr', from: Number(j.from), to: Number(j.to) }, l, j.at);
    }
    for (const j of trList) {                                 // app ke wo transfer jo abhi POS tak nahi pahunche
      if (Number(j.at) < since || j.op === 'delete' || j.status === 'failed') continue;
      if (seen.has(String(j.transferNo || '').trim())) continue;
      if (inHere && Number(j.to) !== Number(pick)) continue;
      for (const l of (j.lines || [])) add(`tr:${j.from}>${j.to}`, { kind: 'tr', from: Number(j.from), to: Number(j.to) }, l, j.at);
    }
  }
  if (inKind !== 'tr' && cloud?.appPurchasesRecent) {        // 🧾 purchase bill
    try {
      for (const b of await cloud.appPurchasesRecent(since)) {
        if (b.status === 'cancelled' || b.status === 'replaced') continue;
        const at = b.at || Date.parse(b.date) || 0, party = b.partyName || 'Bill';
        for (const l of (b.lines || [])) {
          const to = Number(l.godam ?? b.godam) || 0;
          if (inHere && to !== Number(pick)) continue;
          add(`bill:${party}>${to}`, { kind: 'bill', party, to }, l, at);
        }
      }
    } catch {}
  }
  const stockOf = (b, id) => Number(saleStockItem(b, id)?.stock || 0);
  const groups = [...G.values()].map(g => {
    const rows = [...g.items.values()].map(e => {
      const it = items.find(x => String(x.id) === e.id) || {};
      const pack = Number(it.pack) || 0, rate = Number(it.prate) || 0;
      const to = { b: g.to, ab: stockOf(g.to, e.id) };
      to.pehle = r2(to.ab - e.qty);                                    // andaza: ab − jo aaya
      const from = g.kind === 'tr' ? { b: g.from, ab: stockOf(g.from, e.id) } : null;
      if (from) from.pehle = r2(from.ab + e.qty);                      // andaza: ab + jo gaya
      const bad = to.ab <= 0.001 && e.qty > 0;
      const tez = !bad && e.qty > 0 && to.ab / e.qty < 0.1;
      return { ...e, pack, rate, uName: it.uName || 'Pcs', cName: it.cName || 'Ctn',
        to, from, conf: bad ? 'r' : tez ? 'y' : 'g' };
    }).sort((x, y) => (x.conf === y.conf ? y.qty * y.rate - x.qty * x.rate : x.conf === 'r' ? -1 : y.conf === 'r' ? 1 : x.conf === 'y' ? -1 : 1));
    return { ...g, rows,
      title: g.kind === 'tr' ? `${branchName(g.from, names)} → ${branchName(g.to, names)}` : `${g.party} → ${branchName(g.to, names)}`,
      red: rows.filter(r => r.conf === 'r').length };
  }).sort((a, b) => {                                                   // tarteeb: transfer pehle (godam ke number se), phir bill
    if (a.kind !== b.kind) return a.kind === 'tr' ? -1 : 1;
    if (a.kind === 'tr') return (a.from - b.from) || (a.to - b.to);
    return String(a.party).localeCompare(String(b.party));
  });
  inRows = { groups, pick, names, at: Date.now() };
  return inRows;
}
// CTN / PCS alag — 20 carton hon to PCS 0
const cp = (qty, pack) => {
  const q = Number(qty) || 0, pk = Number(pack) || 0;
  if (pk > 1) { const c = Math.floor(Math.abs(q) / pk) * (q < 0 ? -1 : 1), p = r2(q - c * pk); return { c, p }; }
  return { c: 0, p: r2(q) };
};
const cpCell = (qty, pack, tilde) => { const { c, p } = cp(qty, pack); const t = tilde ? '~' : '';
  return `<span>${c ? t + num(c) : '0'}</span><span>${p ? t + num(p) : '0'}</span>`; };
function inRowHTML(r, names) {
  const line = (lab, qty, tilde, cls) => `<div class="iv-line ${cls || ''}"><small>${lab}</small>${cpCell(qty, r.pack, tilde)}</div>`;
  return `<button type="button" class="iv-card ${r.conf}" data-in-item="${esc(r.id)}">
    <div class="iv-top"><b>${esc(r.name)}</b><small>${dmy(r.at)}</small></div>
    <div class="iv-grid">
      <div class="iv-head"><small></small><span>${esc(r.cName).toUpperCase()}</span><span>${esc(r.uName).toUpperCase()}</span></div>
      ${line(r.from ? 'Gaya' : 'Bill se', r.qty, false, 'go')}
      ${r.from ? `<div class="iv-sub">${esc(branchName(r.from.b, names))}</div>
        ${line('pehle', r.from.pehle, true)}${line('ab', r.from.ab, false, 'now')}` : ''}
      <div class="iv-sub">${esc(branchName(r.to.b, names))}</div>
      ${line('pehle', r.to.pehle, true)}${line('ab', r.to.ab, false, 'now')}
    </div>
    ${r.conf === 'r' ? '<div class="iv-warn">⚠ Stock mein nahi — POS mein chadha?</div>'
      : r.conf === 'y' ? '<div class="iv-warn amber">Qareeb qareeb khatam</div>' : ''}</button>`;
}
async function openIn(refresh = true) {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = '📥 Aaya / gaya maal';
  if (refresh || !inRows) { $('dialogBody').innerHTML = '<p class="stat-note">Taza data le raha hoon…</p>'; if (!d.open) d.showModal(); await inCollect(); }
  const { groups, pick, names, at } = inRows;
  const show = groups.map(g => ({ ...g, rows: inFilter ? g.rows.filter(r => r.conf !== 'g') : g.rows })).filter(g => g.rows.length);
  const nItems = groups.reduce((n, g) => n + g.rows.length, 0), red = groups.reduce((n, g) => n + g.red, 0);
  const C = (on, k, v, lab) => `<button type="button" class="${on ? 'on' : ''}" data-in-${k}="${v}">${lab}</button>`;
  $('dialogBody').innerHTML = `<div class="iv-chips">
      ${C(inDays === 1, 'd', 1, 'Aaj')}${C(inDays === 3, 'd', 3, '3 din')}${C(inDays === 7, 'd', 7, '7 din')}
    </div><div class="iv-chips">
      ${C(inKind === 'all', 'k', 'all', 'Sab')}${C(inKind === 'tr', 'k', 'tr', '⇄ Transfer')}${C(inKind === 'bill', 'k', 'bill', '🧾 Bill')}
      ${C(inHere, 'here', '1', '📍 Sirf yahan')}${red ? C(inFilter, 'red', '1', `🔴 ${red}`) : ''}
    </div>
    <p class="iv-note">${esc(branchName(pick, names))} · ${num(nItems)} items · ⟳ ${new Date(at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })} par liya gaya</p>
    ${show.map(g => `<div class="iv-group">
      <div class="iv-gh ${g.kind}"><span>${g.kind === 'tr' ? '⇄' : '🧾'}</span><b>${esc(g.title)}</b><small>${g.rows.length}</small></div>
      ${g.rows.map(r => inRowHTML(r, names)).join('')}
    </div>`).join('') || '<p class="muted">Is arse mein kuch nahi aaya / gaya.</p>'}
    <div class="account-tools iv-acts">
      ${nItems ? `<button type="button" class="sh-wide" data-in-count="1">📋 Poori list ginti mein kholein (${nItems})</button>` : ''}
      <button type="button" class="primary" data-in-pdf="1">⇩ PDF</button><button type="button" data-in-close="1">✕ Band</button></div>`;
  if (!d.open) d.showModal();
}
// ---------- v2.35: 📋 TRANSFER REGISTER — har transfer note, waqt ke sath (POS + app), din-wise jor ----------
let regDays = 1, regGodam = 'all', regQ = '', regOpen = new Set(), regPdfOf = null;
export function setRegPdf(fn) { regPdfOf = fn; }
const regClock = ms => { try { return new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const regDay = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function regRows() {
  const since = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (regDays === 2 ? 1 : regDays - 1)); return d.getTime(); })();
  const till = regDays === 2 ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })() : Infinity;
  const q = norm(regQ);
  return (ptList || []).filter(t => t && t.at >= since && t.at < till)
    .filter(t => regGodam === 'all' || String(t.from) === regGodam || String(t.to) === regGodam)
    .filter(t => !q || smartHit('TN ' + (t.transferNo || '') + ' ' + (t.note || '') + ' ' + (t.byName || ''), regQ) || (t.lines || []).some(l => smartHit(l.name, regQ)))
    .map(t => { let c = 0, p = 0, rs = 0; for (const l of t.lines || []) { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); c += x.c; p += x.p; rs += (Number(l.qty) || 0) * (Number(l.rate) || 0); } return { ...t, c, p: Math.round(p * 1000) / 1000, rs: Math.round(rs), n: (t.lines || []).length }; })
    .sort((a, b) => b.at - a.at);
}
function regHTML() {
  const rows = regRows(), names = collect().names || {};
  const tot = rows.reduce((s, t) => ({ n: s.n + 1, i: s.i + t.n, c: s.c + t.c, p: s.p + t.p, rs: s.rs + t.rs }), { n: 0, i: 0, c: 0, p: 0, rs: 0 });
  const days = new Map(); for (const t of rows) { const k = regDay(t.at); if (!days.has(k)) days.set(k, []); days.get(k).push(t); }
  const gods = [...new Set((ptList || []).flatMap(t => [t.from, t.to]))].filter(Boolean).sort((a, b) => a - b);
  const C = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-reg-${k}="${esc(String(v))}">${lab}</button>`;
  const today = regDay(Date.now()), yest = regDay(Date.now() - 864e5);
  return `<div class="reg-root">
    <div class="mchips">${C(regDays === 1, 'd', 1, 'Aaj')}${C(regDays === 2, 'd', 2, 'Kal')}${C(regDays === 7, 'd', 7, '7 din')}${C(regDays === 30, 'd', 30, '30 din')}${C(regDays === 60, 'd', 60, '60 din')}</div>
    <div class="mchips">${C(regGodam === 'all', 'g', 'all', 'Sab godam')}${gods.map(g => C(regGodam === String(g), 'g', g, esc(branchName(g, names)))).join('')}</div>
    <label class="hs-search"><input type="search" data-reg-q="1" placeholder="🔍 item ya TN number…" value="${esc(regQ)}"></label>
    <div class="bc-kpis"><div><b>${num(tot.n)}</b><small>transfer note</small></div><div><b>${num(tot.i)}</b><small>items</small></div><div><b>${num(tot.c)}</b><small>ctn</small></div><div><b>${num(tot.p)}</b><small>pcs</small></div></div>
    ${tot.rs ? `<p class="iv-note">Kul maal: <b>Rs ${num(tot.rs)}</b></p>` : ''}
    ${[...days].map(([d, list]) => { const dc = list.reduce((s, t) => s + t.c, 0), dp = list.reduce((s, t) => s + t.p, 0);
      return `<div class="bc-day"><div class="bc-dayhead"><b>${d === today ? 'Aaj' : d === yest ? 'Kal' : esc(d)}</b><span>${list.length} note · ${num(dc)} ctn${dp ? ' + ' + num(dp) + ' pcs' : ''}</span></div>
      ${list.map(t => { const op = regOpen.has(String(t.transferId || t.id));
        return `<div class="reg-card${op ? ' open' : ''}"><button type="button" class="reg-h" data-reg-open="${esc(String(t.transferId || t.id))}">
          <span class="reg-time">${esc(regClock(t.at))}</span><span class="reg-main"><b>${esc(t.transferNo || '—')}</b><small>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))}</small></span>
          <span class="reg-tot"><b>${num(t.c)} ctn${t.p ? ' + ' + num(t.p) : ''}</b><small>${t.n} items${t.rs ? ' · Rs ' + num(t.rs) : ''}</small></span><i class="reg-src">${t.app ? '📱 App' : '🖥 POS'}</i></button>
          ${op ? `<div class="reg-lines">${(t.lines || []).map(l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); return `<div><span>${esc(l.name)}</span><b>${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b></div>`; }).join('')}${t.note ? `<small>📝 ${esc(t.note)}</small>` : ''}</div>` : ''}</div>`; }).join('')}</div>`; }).join('') || '<p class="muted">Is arse mein koi transfer note nahi.</p>'}
    <div class="account-tools iv-acts"><button type="button" class="primary" data-reg-pdf="1">📄 PDF · WhatsApp</button><button type="button" data-in-close="1">✕ Band</button></div></div>`;
}
function openRegister() {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog'); d.classList.add('full-dialog');
  $('dialogTitle').textContent = '📋 Transfer register';
  $('dialogBody').innerHTML = regHTML();
  if (!d.open) d.showModal();
}
function regPdf() {
  const rows = regRows(), names = collect().names || {}; if (!rows.length) { notice('Is arse mein koi transfer note nahi'); return; }
  const lab = { 1: 'Aaj', 2: 'Kal', 7: 'Pichhle 7 din', 30: 'Pichhle 30 din', 60: 'Pichhle 60 din' }[regDays];
  const html = `<h1>NOOR TRADERS</h1><h2>📋 Transfer register — ${esc(lab)}${regGodam !== 'all' ? ' · ' + esc(branchName(Number(regGodam), names)) : ''}</h2><p>${rows.length} transfer note · ${esc(new Date().toLocaleString('en-PK'))}</p>
    <table class="iv-tbl"><thead><tr><th>Waqt</th><th>TN</th><th>Se → Ko</th><th>Items (naam · tadad)</th><th>Kul</th><th>Rs</th></tr></thead><tbody>
    ${rows.map(t => `<tr><td>${esc(regDay(t.at))}<br><small>${esc(regClock(t.at))}</small></td><td><b>${esc(t.transferNo || '')}</b><br><small>${t.app ? 'App' : 'POS'}</small></td><td>${esc(branchName(t.from, names))} → ${esc(branchName(t.to, names))}</td><td class="reg-items">${(t.lines || []).map(l => { const x = cp(Number(l.qty) || 0, Number(l.pack) || 0); return `<div>${esc(l.name)} <b>${x.c ? num(x.c) + ' ctn' : ''}${x.c && x.p ? ' + ' : ''}${x.p ? num(x.p) + ' pcs' : ''}</b></div>`; }).join('') || t.n}</td><td class="iv-n">${num(t.c)} ctn${t.p ? ' + ' + num(t.p) : ''}</td><td class="iv-n">${t.rs ? num(t.rs) : ''}</td></tr>`).join('')}
    </tbody></table>`;
  regPdfOf ? regPdfOf(html, 'Transfer register ' + regDay(Date.now())) : notice('PDF abhi nahi bana');
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-stock-reg]')) { openRegister(); return; }
  if (!document.querySelector('.reg-root')) return;
  const t = e.target.closest?.('[data-reg-d],[data-reg-g],[data-reg-open],[data-reg-pdf]'); if (!t) return;
  const d = t.dataset;
  if (d.regD) regDays = Number(d.regD); else if (d.regG) regGodam = d.regG; else if (d.regOpen) { if (regOpen.has(d.regOpen)) regOpen.delete(d.regOpen); else regOpen.add(d.regOpen); } else if (d.regPdf != null) { regPdf(); return; }
  $('dialogBody').innerHTML = regHTML();
});
document.addEventListener('input', e => { if (!e.target.matches?.('[data-reg-q]')) return; regQ = e.target.value || ''; $('dialogBody').innerHTML = regHTML(); const q = document.querySelector('[data-reg-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });

// app.js PDF banata hai — yahan se sirf data
export function inReport() {
  const { groups, pick, names, at } = inRows || {}; if (!groups || !groups.length) return null;
  const cell = (q, pk) => { const x = cp(q, pk); return { c: x.c ? num(x.c) : '0', p: x.p ? num(x.p) : '0' }; };
  return { branch: branchName(pick, names), din: inDays === 1 ? 'Aaj' : inDays + ' din',
    at: new Date(at).toLocaleString('en-PK'),
    groups: groups.map(g => ({ title: g.title, kind: g.kind, red: g.red,
      rows: g.rows.map(r => ({ name: r.name, conf: r.conf, date: dmy(r.at), cName: r.cName, uName: r.uName,
        gaya: cell(r.qty, r.pack),
        from: r.from ? { name: branchName(r.from.b, names), pehle: cell(r.from.pehle, r.pack), ab: cell(r.from.ab, r.pack) } : null,
        to: { name: branchName(r.to.b, names), pehle: cell(r.to.pehle, r.pack), ab: cell(r.to.ab, r.pack) } })) })) };
}
document.addEventListener('pointerdown', e => { const h = document.querySelector('[data-tr-hits]'); if (!h || h.hidden) return; if (e.target.closest?.('[data-tr-hits],[data-tr-q]')) return; h.hidden = true; }, true);   // v2.41: list ke bahar tap = band
// ===== v2.42: transfer note ka camera = Sale wali screen (wahi hooks, wahi list, wahi Tadad/Pcs/Ctn pad) =====
let trRootMark = null, trHooksSaved = null;
const trKey = l => l.k || (l.k = 'tr' + Math.random().toString(36).slice(2, 8));
function trScanOpen() {
  try { $('dialog').close(); } catch {}
  trRootMark = document.createElement('div'); trRootMark.dataset.trRoot = '1'; trRootMark.hidden = true; document.body.appendChild(trRootMark);
  trHooksSaved = { saleHook, saleQtyHook, saleCartHook, saleDelHook, saleFindHook };
  saleDelHook = key => { const i = trLines.findIndex(l => l.k === key); if (i >= 0) trLines.splice(i, 1); };
  saleCartHook = () => trLines.map(l => ({ key: trKey(l), item: { id: l.id, code: l.code || '', name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: 0, rate2: 0 }, pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 }));
  saleFindHook = q => smartSearch(collect().items, q, 12).map(r => ({ ...r, stock: trStockOf(trFrom, r.id) }));   // stock = jis godam SE nikal raha hai
  saleQtyHook = (it, q, key) => { const l = (key && trLines.find(x => x.k === key)) || [...trLines].reverse().find(x => String(x.id) === String(it.id)); if (!l) return; l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0; trCalc(l); };
  saleHook = (code, direct, qty) => {
    const { items, names } = collect(), c = String(code || '').trim();
    const it = direct ? (items.find(x => String(x.id) === String(direct.id)) || direct) : items.find(x => String(x.code).trim() === c || (Array.isArray(x.bc) && x.bc.some(b => String(b).trim() === c)));
    if (!it) return { state: null };
    if (!trHas(it)) { notice(`⚠️ ${it.name} — ${branchName(trFrom, names)} mein stock NAHI, lagaya nahi`); return { state: null }; }
    trRecNote(it.id);
    const l = trAddLine(it); trKey(l);
    if (Number(qty) > 0) { const pk = Number(it.pack) || 0, q = Math.round(Number(qty) * 1000) / 1000; if (pk > 1) { l.ctn = Math.floor(q / pk + 1e-9); l.pcs = Math.round((q - l.ctn * pk) * 1000) / 1000; } else { l.pcs = q; l.ctn = 0; } trCalc(l); }
    const have = trStockOf(trFrom, it.id); if (l.qty > have + 0.0005) notice(`⚠️ ${it.name}: stock ${num(have)} — ${num(l.qty)} nahi ja sakte`);
    return { state: 'added', item: it, line: l.k, pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 };
  };
  pickHook = null; pickMulti = { done: () => { trRootMark?.remove(); trRootMark = null; if (trHooksSaved) ({ saleHook, saleQtyHook, saleCartHook, saleDelHook, saleFindHook } = trHooksSaved); trHooksSaved = null; openTransfer(); } };
  saleSeen = []; openScanner();
}
function openTransfer() {
  const d = $('dialog'); if (!d) return;
  trZeroShow = false;   // v2.18
  const bs = trBranches();
  if (trFrom == null) trFrom = bs.find(b => b.id !== 1)?.id ?? bs[0]?.id;
  if (trTo == null) trTo = 1;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = '⇄ Transfer note';
  const sel = (name, val) => `<select data-tr-${name}>${bs.map(b => `<option value="${b.id}"${b.id === val ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`;
  const kul = trLines.reduce((s, l) => s + l.qty, 0);
  $('dialogBody').innerHTML = `<div class="tr-head"><label>Se (nikle)${sel('from', trFrom)}</label><label>Ko (jaye)${sel('to', trTo)}</label></div>
    <div class="scan-find" style="margin:8px 0"><input class="scan-q" data-tr-q type="search" placeholder="🔍 Item ka naam / code likhein" autocomplete="off"><div class="scan-hits" data-tr-hits hidden></div></div>
    <div class="account-tools"><button type="button" data-tr-scan="1">${camMissing() ? '🔫 Scanner gun' : '📷 Scan'}</button></div>
    <div class="tr-lines">${trLines.map((l, i) => [l, i]).reverse().map(([l, i]) => { const have = trStockOf(trFrom, l.id); const short = trFrom !== 1 && have < l.qty - 0.0005; const pk = Number(l.pack) || 0;
      return `<div class="tr-line${short ? ' short' : ''}"><div class="tr-name">${pk > 1 ? `<span class="tr-pack">1 ${esc(l.cName || 'Ctn')} = ${num(pk)} ${esc(l.uName || 'Pcs')}</span>` : ''}<b><span class="tr-no">${i + 1}.</span> ${esc(l.name)}</b><small>${esc(branchName(trFrom, collect().names))} mein stock ${num(have)}${pk > 1 ? ' · 1 ' + esc(l.cName || 'Ctn') + ' = ' + num(pk) : ''}${short ? ' · <b class="red">⛔ kam hai</b>' : ''}</small>${pk > 1 ? `<small>= ${num(l.qty)} ${esc(l.uName || 'Pcs')}</small>` : ''}</div>
      ${pk > 1 ? `<label class="tr-q"><span>${esc(l.cName || 'Ctn')}</span><input type="text" inputmode="decimal" value="${num(l.ctn || 0)}" data-tr-ctn="${i}"></label>` : ''}
      <label class="tr-q"><span>${esc(l.uName || 'Pcs')}</span><input type="text" inputmode="decimal" value="${num(l.pcs ?? l.qty)}" data-tr-pcs="${i}"></label><button type="button" class="danger" data-tr-del="${i}">✕</button></div>`; }).join('') || '<p class="muted">Upar se item chunein ya scan karein.</p>'}</div>
    ${trLines.length ? `<p class="tr-sum">${trLines.length} items · ${(() => { const c = trLines.reduce((n, l) => n + (Number(l.pack) > 1 ? Number(l.ctn) || 0 : 0), 0), p = trLines.reduce((n, l) => n + (Number(l.pcs) || 0), 0); return [c ? num(c) + ' CTN' : '', p ? num(p) + ' PCS' : ''].filter(Boolean).join(' + ') || '0'; })()} · kul ${num(kul)} pcs</p>` : ''}
    <label>Note<input type="text" data-tr-note maxlength="150" placeholder="ikhtiyari"></label>
    ${trLines.length ? trCopyChips() : ''}<div class="account-tools tr-sticky"><button type="button" class="primary" data-tr-save="1"${trLines.length ? '' : ' disabled'}>✓ POS mein transfer note banao</button>${trLines.length ? '<button type="button" data-tr-clear="1">Saaf</button>' : ''}</div>
    <p class="muted tr-msg" style="font-size:.85em"></p>
    <div class="tr-hist"><b>Pichhle 14 din ke transfer (app se)</b><div data-tr-hist>${trHistHTML()}</div></div>`;
  if (!d.open) d.showModal();
  if (!trStop && cloud?.listenTransfers) trStop = cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); });
  const q = $('dialogBody').querySelector('[data-tr-q]'), hits = $('dialogBody').querySelector('[data-tr-hits]');
  hits.classList.add('sh-hits');   // v2.18: premium rows + chips
  const trFind = () => {
    const raw = q.value, t = norm(raw);
    if (!t) { trShowRecent(hits); return; }
    if (t.length < 2) { hits.hidden = true; return; }
    const { items, names } = collect(), gname = esc(branchName(trFrom, names));
    if (/^[0-9]{8,}$/.test(t)) {   // poora barcode — seedha lag jaye, cursor tadad par
      const exact = items.find(x => String(x.code || '').trim() === t || (Array.isArray(x.bc) && x.bc.some(b => String(b).trim() === t)));
      if (exact) { hits.hidden = true; q.value = ''; trPick(exact, true); return; }
    }
    const all = smartSearch(items, raw, 30, { bonus: r => trRecRank(r.id) });
    const ok = [], zero = [];
    for (const r of all) (trHas(r) ? ok : zero).push(r);
    const list = (trZeroShow ? ok.concat(zero) : ok).slice(0, 8);
    trPaint(hits, list, raw, trZeroShow ? 0 : zero.length, gname);
  };
  q.oninput = () => { trZeroShow = false; clearTimeout(trFindTimer); trFindTimer = setTimeout(trFind, 70); };
  q.onfocus = () => { if (!norm(q.value)) trShowRecent(hits); };
  hits.onclick = e => {
    if (e.target.closest('[data-tr-close]')) { hits.hidden = true; q.blur(); return; }   // v2.41: ✕ se list band
    if (e.target.closest('[data-tr-zero]')) { trZeroShow = true; trFind(); return; }
    const b = e.target.closest('[data-tr-pick]'); if (!b) return;
    trPick((hits._src || [])[Number(b.dataset.trPick)]);
  };
  q.onkeydown = e => {
    const rows = [...hits.querySelectorAll('[data-tr-pick]')];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !hits.hidden && rows.length) {
      e.preventDefault();
      const cur = rows.findIndex(b => b.classList.contains('on'));
      trMark(hits, Math.max(0, Math.min(rows.length - 1, (cur < 0 ? -1 : cur) + (e.key === 'ArrowDown' ? 1 : -1))));
      return;
    }
    if (e.key === 'Escape') { hits.hidden = true; return; }
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(trFindTimer);
      const cur = rows.findIndex(b => b.classList.contains('on'));
      const r = (hits._src || [])[cur < 0 ? 0 : cur]; if (r && !hits.hidden) trPick(r); }
  };
  if (trFocus) {   // item lagne ke baad: barcode wala -> tadad par, warna wapas search par (agla item foran likh sakein)
    const f = trFocus; trFocus = null;
    const i = trLines.findIndex(l => String(l.id) === String(f.id));
    const cell = f.qty && i >= 0 ? ($('dialogBody').querySelector(`[data-tr-ctn="${i}"]`) || $('dialogBody').querySelector(`[data-tr-pcs="${i}"]`)) : null;
    if (cell) { try { cell.focus(); cell.select(); } catch {} }
    else { try { q.focus(); } catch {} }
  }
}
function trCalc(l) { const pk = Number(l.pack) || 0; l.qty = Math.round(((pk > 1 ? (Number(l.ctn) || 0) * pk : 0) + (Number(l.pcs) || 0)) * 1000) / 1000; return l; }
// v2.17: naya item = 1 CTN (carton ho to), warna 1 PCS; wahi dobara aaye to +1 CTN. Naya neeche jurta hai.
function trAddLine(r) { if (!r) return null; const pk = Number(r.pack) || 0; let l = trLines.find(x => String(x.id) === String(r.id));
  if (l) { if (pk > 1) l.ctn = (Number(l.ctn) || 0) + 1; else l.pcs = Math.round(((Number(l.pcs) || 0) + 1) * 1000) / 1000; trCalc(l); }
  else { l = trCalc({ id: r.id, name: r.name, pack: pk, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs', ctn: pk > 1 ? 1 : 0, pcs: pk > 1 ? 0 : 1, qty: 0 }); trLines.push(l); }
  return l; }
function trAdd(r) { if (trAddLine(r)) openTransfer(); }
function trQtyText(l) { const pk = Number(l.pack) || 0; return pk > 1 ? `${num(l.ctn || 0)} ${l.cName || 'Ctn'}${Number(l.pcs) ? ' + ' + num(l.pcs) + ' ' + (l.uName || 'Pcs') : ''}` : `${num(l.pcs || 0)} ${l.uName || 'Pcs'}`; }
function trHistHTML() {
  if (!trList.length) return '<p class="muted">Koi nahi.</p>';
  const names = collect().names;
  return trList.slice(0, 20).map(j => `<div class="tr-hist-row"><div><b>${j.status === 'done' ? (j.op === 'delete' ? 'Hataya' : 'STN ' + esc(j.transferNo || '')) : j.status === 'failed' ? '⚠️ Nahi bana' : '⏳ PC...'}</b> · ${esc(branchName(j.from, names))} → ${esc(branchName(j.to, names))} · ${(j.lines || []).length} items<br><small>${esc(new Date(j.at).toLocaleString('en-PK'))}${j.error ? ' · <span class="red">' + esc(j.error) + '</span>' : ''}${(j.lines || []).slice(0, 4).map(l => ' · ' + esc(l.name) + ' ' + (Number(l.pack) > 1 && (l.ctn || l.pcs != null) ? num(l.ctn || 0) + ' ' + esc(l.cName || 'Ctn') + (l.pcs ? ' + ' + num(l.pcs) + ' ' + esc(l.uName || 'Pcs') : '') : num(l.qty))).join('')}${j.reprints?.length ? ` · <b>dobara print ${j.reprints.length}x</b>` : ''}</small></div>
    ${j.status === 'done' && j.op !== 'delete' ? `<button type="button" data-tr-print="${esc(j.id)}">🖨️</button>${isOwner() && Date.now() - j.at < 86400000 ? `<button type="button" class="danger" data-tr-undo="${esc(j.id)}">🗑️</button>` : ''}` : ''}</div>`).join('');
}
async function trSave(btn) {
  const msg = $('dialogBody').querySelector('.tr-msg'), note = $('dialogBody').querySelector('[data-tr-note]')?.value || '';
  if (trFrom === trTo) { msg.textContent = '⚠️ "Se" aur "Ko" alag godam chunein'; return; }
  const short = trLines.filter(l => trFrom !== 1 && trStockOf(trFrom, l.id) < l.qty - 0.0005);
  if (short.length) { msg.textContent = '⛔ Godam mein stock kam: ' + short.map(l => l.name).join(', '); return; }
  if (!confirm(`${trLines.length} items · ${branchName(trFrom, collect().names)} → ${branchName(trTo, collect().names)}\nPOS mein transfer note banayein?`)) return;
  btn.disabled = true; msg.textContent = '🖥 PC ko ja raha hai…';
  try {
    if (trLines.some(l => !(l.qty > 0))) { msg.textContent = '⚠️ Har item ki tadad 0 se zyada likhein'; return; }
    const jid = await cloud.requestTransfer({ op: 'create', copies: trCopies, from: trFrom, to: trTo, lines: trLines.map(l => ({ itemId: l.id, name: l.name, qty: l.qty, ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, pack: Number(l.pack) || 0, cName: l.cName || 'Ctn', uName: l.uName || 'Pcs' })), note, byName: '' });
    let stop = null, done = false; const t0 = Date.now(), tick = setInterval(() => { if (!done && msg) msg.textContent = `🖥 PC bana raha hai… ${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);   // v2.46: kitna waqt lag raha hai
    const end = (ok, t) => { if (done) return; done = true; clearInterval(tick); try { stop && stop(); } catch {} btn.disabled = false;
      if (ok) { trLines = []; notice('✓ Transfer note ' + t + ' ban gaya (' + Math.round((Date.now() - t0) / 1000) + 's)'); openTransfer(); } else { msg.textContent = '⚠️ ' + t; notice('Transfer nahi bana: ' + t); } };
    stop = cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end(true, j.transferNo || ''); else if (j.status === 'failed') end(false, j.error || 'masla'); });
    setTimeout(() => end(false, 'PC se jawab nahi aaya — PC on hai aur transfer-sync chal raha hai? (hukum mehfooz hai)'), 45000);
  } catch (e) { btn.disabled = false; msg.textContent = '⚠️ ' + (e?.message || e); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-tr-del],[data-tr-save],[data-tr-clear],[data-tr-scan],[data-tr-print],[data-tr-undo]');
  if (!t) return;
  if (t.dataset.trDel) { trLines.splice(Number(t.dataset.trDel), 1); openTransfer(); }
  else if (t.dataset.trClear) { trLines = []; openTransfer(); }
  else if (t.dataset.trSave) { const bad = trFrom !== 1 ? trLines.filter(l => l.qty > trStockOf(trFrom, l.id) + 0.0005) : []; if (bad.length) { notice(`⚠️ Stock se zyada: ${bad.slice(0, 3).map(l => l.name + ' (stock ' + num(trStockOf(trFrom, l.id)) + ')').join(', ')}${bad.length > 3 ? ' …' : ''} — pehle theek karein`); return; } trSave(t); }   // v2.42
  else if (t.dataset.trScan) trScanOpen();   // v2.42: Sale wali camera screen (search + Tadad + Pcs/Ctn + list)
  else if (t.dataset.trPrint) {   // v1.75: dobara print — wajah zaroori, note par bara "DOBARA PRINT" chhapta hai
    const j = trList.find(x => x.id === t.dataset.trPrint); const n = (j?.reprints?.length || 0) + 1;
    const reason = prompt(`Dobara print (${n}) ki wajah likhein:`); if (reason == null) return; if (!reason.trim()) { notice('Wajah likhna zaroori hai'); return; }
    const cps = Math.min(3, Math.max(1, Number(prompt('Kitni dafa chhapein? (1-3)', String(trCopies))) || 1));   // v2.43
    t.disabled = true; cloud.requestPrint({ kind: 'transfer', id: t.dataset.trPrint, reason: reason.trim().slice(0, 100), copies: cps }).then(() => notice('🖨️ Dobara print PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')).finally(() => { t.disabled = false; }); }
  else if (t.dataset.trUndo) { const j = trList.find(x => x.id === t.dataset.trUndo); if (!j || !confirm('Transfer note ' + (j.transferNo || '') + ' POS se hata dein? Dono godam ka stock wapas ho jayega.')) return; t.disabled = true;
    cloud.requestTransfer({ op: 'delete', from: j.from, to: j.to, transferId: j.transferId, lines: j.lines }).then(() => notice('Hatane ka hukum PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches?.('[data-stock-itemedit]')) {                          // v2.5: malik ka switch
    const on = t.checked;
    (cloud?.setItemEdit ? cloud.setItemEdit(on) : Promise.reject(Error('app update karein')))
      .then(() => notice(on ? 'Mulazim ab item aur rates badal sakta hai' : 'Mulazim ab item / rates nahi badal sakta'))
      .catch(err => { t.checked = !on; notice('Nahi hua: ' + (err?.message || err)); });
    return;
  }
  if (t.matches?.('[data-tr-from]')) { trFrom = Number(t.value); openTransfer(); }
  else if (t.matches?.('[data-tr-to]')) { trTo = Number(t.value); openTransfer(); }
  else if (t.matches?.('[data-tr-ctn]')) { const l = trLines[Number(t.dataset.trCtn)]; if (l) { l.ctn = Math.max(0, Math.floor(Number(t.value) || 0)); trCalc(l); } openTransfer(); }
  else if (t.matches?.('[data-tr-pcs]')) { const l = trLines[Number(t.dataset.trPcs)]; if (l) { l.pcs = Math.max(0, Math.round((Number(String(t.value).replace(',', '.')) || 0) * 1000) / 1000); trCalc(l); } openTransfer(); }
});

// v1.45.8: history ab alag khirki (dialog) mein — pehle list ke upar khulti thi aur search bohat neeche chala jata tha
function openBills() {
  const d = $('dialog');
  if (!d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = `Farq bills ki history (${num(bills.length)})`;
  $('dialogBody').innerHTML = bills.length ? billsHTML(collect().names) : '<p>Abhi koi farq bill nahi.</p>';
  if (!d.open) d.showModal();
}

function billsHTML(names) {
  const rows = (list, sign) => (list || []).map(x => `<tr><td>${esc(x.name)}</td><td>${num(x.sys)}</td><td>${num(x.count)}</td><td>${sign}${num(x.qty)}</td><td>${num(x.rate)}</td><td>${sign}${num(x.amount)}</td></tr>`).join('');
  const table = (title, list, sign) => (list || []).length ? `<p><b>${esc(title)}</b></p>
    <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>System</th><th>Ginti</th><th>Farq</th><th>Bhao</th><th>Rs</th></tr></thead>
    <tbody>${rows(list, sign)}</tbody></table></div>` : '';
  return bills.map(b => `<details style="margin:6px 0;padding:8px;border:1px solid #d5e0f2;border-radius:10px">
    <summary><b>Sale ${esc(b.saleNo || '')}${b.returnNo ? ' · Return ' + esc(b.returnNo) : ''}</b>
      · Rs ${num(b.total)} · ${esc(b.doneAt ? new Date(b.doneAt).toLocaleString('en-PK') : '')}
      <small>· Ginti ${esc(b.round || '')} · ${esc(branchName(b.branch, names))}</small></summary>
    ${b.party ? `<p><small>Account: ${esc(b.party)}</small></p>` : ''}
    ${table('Kam nikle — Sale', b.kam, '-')}
    ${table('Zyada nikle — Return', b.zyada, '+')}
    <p>Kam: Rs ${num(b.kamRs)} · Zyada: Rs ${num(b.zyadaRs)} · <b>Kul farq: Rs ${num(b.total)}</b></p>
  </details>`).join('');
}

function flagHTML(r) {
  const f = flagOf(r.id);
  const chk = f.checkedAt ? `<small class="stat-note">✓ Check hua ${esc(stampText(f.checkedAt))}${f.checkedNote ? ' · ' + esc(f.checkedNote) : ''}</small>` : '';
  return `<div class="account-tools sc-flags">
    <button type="button" data-flag-baqi="${esc(r.id)}"${f.baqi ? ' class="selected"' : ''}>⏳ ${f.baqi ? 'Baqi hai — aur likh kar dabayein, ya nishan hatao' : 'Baqi — aur ginna hai (likha hua jama hoga)'}</button>
  </div>${chk}`;
}
function countHTML(r) {
  const c = countOf(pickedBranch, r);
  const diff = c ? Math.round((countedPcs(c) - Number(sysOf(c, r))) * 100) / 100 : 0;
  if (countLocked()) return `<div style="margin:0 4px 14px">${c ? `<small>Ginti ${num(countedPcs(c))} · Farq ${diff > 0 ? '+' : ''}${num(diff)}</small><br>` : ''}${flagHTML(r)}</div>${historyHTML(r, c)}`;
  if (!round) return `<div style="margin:0 4px 12px"><small class="stat-note">Ginti abhi band hai — ${isOwner() ? 'upar "Nayi ginti shuru" dabayein' : 'malik "Nayi ginti shuru" kare'}, phir yahan Save aur ✓ Tick aayenge.</small></div>${historyHTML(r, c)}`;
  return `<div class="pos-dates" style="margin:0 4px 8px">
    <label>Ctn<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-ctn="${esc(r.id)}" value="${c ? esc(String(c.ctn ?? '')) : ''}"></label>
    <label>${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-pcs="${esc(r.id)}" value="${c ? esc(String(c.pcs ?? '')) : ''}"></label>
    <label>Kul ${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:5.6em" data-count-tot="${esc(r.id)}" value=""></label>
    <button type="button" data-count-save="${esc(r.id)}">Save</button>
    <button type="button" class="count-tick" data-count-tick="${esc(r.id)}" title="Jitna system mein hai utna hi maal hai">✓ Tick</button>
    <div class="count-live" data-count-live="${esc(r.id)}"></div>
    ${c ? `<small style="align-self:center">Ginti ${num(countedPcs(c))} · Us waqt system ${num(sysOf(c, r))}${sysSure(c) ? ' ✓' : ' (PC tasdeeq baqi)'} · Farq ${diff > 0 ? '+' : ''}${num(diff)}${
      r.prate ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * r.prate) : ''}</small>` : ''}
  </div>
  ${flagHTML(r)}
  ${c ? historyHTML(r, c) : oldHistoryHTML(r)}`;
}
// v2.61: is round mein abhi nahi gina — pichhli gintiyon ki history (wahi jo gine hue par neeche aati hai), tap se khule
function oldHistoryHTML(r) {
  const old = counts.get(countId(pickedBranch, r.id));
  const n = Array.isArray(old?.history) ? old.history.length : 0;
  if (!n) return '';
  return `<details class="old-hist"><summary>🕘 Pichhli ginti ki history (${n})</summary>${historyHTML(r, old)}</details>`;
}

function historyHTML(r, c) {
  const list = Array.isArray(c?.history) ? c.history.slice().reverse() : [];
  if (!list.length) return '';
  return `<div class="stat-note" style="margin:0 4px 12px">${list.map(h => {
    const d = Math.round((Number(h.total) - Number(h.sys)) * 100) / 100;
    const ctn = esc(r.cName || 'Ctn'), pcs = esc(r.uName || 'Pcs');
    const jama = h.tick ? '<b style="color:#0b6b2e">✓ Tick — system jaisa</b> · ' : h.add ? `<b style="color:#0b6b2e">+${num(h.add.ctn)} ${ctn} + ${num(h.add.pcs)} ${pcs}${h.note ? ' (' + esc(h.note) + ')' : ''}</b> → ` : (h.note ? `(${esc(h.note)}) ` : '');
    return `${esc(stampText(h.at))} — ${jama}<b>${num(h.ctn)} ${ctn} + ${num(h.pcs)} ${pcs}</b> · ${num(h.total)} ${pcs} · System ${num(h.sys)} · Farq ${d > 0 ? '+' : ''}${num(d)}${
      r.prate ? ' · Rs ' + (d > 0 ? '+' : '') + num(d * r.prate) : ''}`;
  }).join('<br>')}</div>`;
}

const rowCache = new Map();   // v1.66: label ke liye item
function rowHTML(r) {
  rowCache.set(String(r.id), r);
  const pack = Number(r.pack) || 0;
  const big = pack > 0
    ? `${num(r.ctn)} ${esc(r.cName || 'Ctn')} + ${num(r.pcs)} ${esc(r.uName || 'Pcs')}`
    : `${num(r.stock)} ${esc(r.uName || 'Pcs')}`;

  return `<div class="stock-row${String(r.id) === String(scanHit) ? ' stock-hit' : ''}" data-stock-row="${esc(r.id)}">
    <div class="party" style="border-bottom:0">
    <div class="name">
      <b>${esc(r.name)}</b>
      ${urduOf(r.id) || canEditItem() ? `<span class="ur-name" data-ur-edit="${esc(r.id)}" dir="rtl" title="Urdu naam — tap kar ke badlein">${urduOf(r.id) ? esc(urduOf(r.id)) : '<i>+ Urdu naam</i>'}</span>` : ''}
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · R ' + num(r.rate) : ''}${r.wrate ? ' · W ' + num(r.wrate) : ''}${r.prate ? ' · Khareed ' + num(r.prate) : ''}</small>
    </div>
    <div class="amount">
      <strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>
      ${r._jama ? `<small class="jama-sum">NT ${r._fac ? `<s>${num(r._nt)}</s> 0` : num(r._nt)} + G2 ${num(r._g2)} = ${num(r.stock)}${r._fac ? ' 🏭' : ''}</small>` : ''}
      <button type="button" class="stock-label-btn" data-stock-label="${esc(r.id)}">🏷️ Label</button>
      ${canEditItem() ? `<button type="button" class="stock-item-btn" data-stock-item="${esc(r.id)}">✏️ Item</button>` : ''}
      ${isOwner() ? `<label style="display:block;font-size:.85em;white-space:nowrap"><input type="checkbox" style="width:auto" data-stock-hide="${esc(r.id)}"${isHidden(r) ? ' checked' : ''}> Band</label>` : ''}
    </div>
    </div>
    ${countHTML(r)}
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { branch = Number(b.dataset.stockBranch); godamAll = false; if (branch !== 1) filter = 'has'; limit = PAGE; rerender(); return; }   // v2.82: 0 = jama (filter has)   // v1.95/97: godam kholte hi sirf USI godam ka stock
  if (e.target.closest?.('[data-stock-scan]')) { openScanner(); return; }
  { const u = e.target.closest?.('[data-ur-edit]'); if (u && canEditItem()) { const id = u.dataset.urEdit; const cur = urduOf(id); const v = prompt('Urdu naam (label par English ke saath aayega):', cur); if (v === null) return; cloud.setUrdu({ [id]: String(v).trim() }).then(() => { urdu[id] = String(v).trim(); notice('✓ Urdu naam save'); soft(); }).catch(er => notice('Nahi hua: ' + (er?.message || er))); return; } }
  if (e.target.closest?.('[data-stock-urdu]')) {
    if (urduBusy) { notice('Pehle wala kaam chal raha hai…'); return; }
    const { items } = collect(); const miss = items.filter(r => !urduOf(r.id)).length;
    if (!miss) { notice('Sab items ke Urdu naam pehle se hain'); return; }
    if (!confirm(`${miss} items ke Urdu naam AI se banayein? (sirf jin ka nahi hai — ${Math.ceil(miss / 60)} dafa AI chalega)`)) return;
    urduBusy = true; notice('🔤 AI se Urdu naam ban rahe hain…');
    urduMake(items, true).then(n => notice(`✓ ${n} Urdu naam ban gaye — ghalat ho to naam par tap kar ke theek karein`)).catch(er => notice('Nahi hua: ' + (er?.message || er))).finally(() => { urduBusy = false; soft(); });
    return;
  }
  const ib = e.target.closest?.('[data-stock-item],[data-stock-newitem],[data-item-close]');
  if (ib) { const d = ib.dataset;
    if (d.itemClose != null) $('dialog')?.close();
    else if (d.stockNewitem != null) itemForm(null, null);
    else itemForm(rowCache.get(String(d.stockItem)), null);
    return; }
  const isc = e.target.closest?.('[data-item-scan]');
  if (isc) { const form = isc.closest('form'), id = form.dataset.itemForm, v = itemRead(form);
    itemDraft.set(id, v); scanPick(code => { const r = id === 'new' ? null : rowCache.get(String(id)); itemForm(r, { ...itemDraft.get(id), code }); }); return; }
  if (e.target.closest?.('[data-stock-mic]')) {   // v2.4.5: awaz se search (sale jaisa)
    const ok = voiceSearch(t => { const s = $('search'); if (s) { s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); } });
    if (!ok) alert('Is phone/browser mein awaz se search nahi chalti'); return;
  }
  if (e.target.closest?.('[data-stock-clear]')) { clearScan(); return; }
  const sa = e.target.closest?.('[data-scan-saveall]');
  if (sa) { saveAll(sa); return; }
  const hb = e.target.closest?.('[data-stock-hide]');
  if (hb) {   // v2.94.0: 🔒 Band par password (default 7183; stockConfig.bandPw se badal sakte hain) — on aur off dono
    const want = String(itemCfg.bandPw || '7183'), got = prompt((hb.checked ? 'Item BAND karne' : 'Item dobara CHALU karne') + ' ka password:');
    if (got === null || got !== want) { hb.checked = !hb.checked; if (got !== null) notice('❌ Password ghalat'); return; }
    toggleHidden(hb.dataset.stockHide, hb.checked, hb); return; }
  if (e.target.closest?.('[data-stock-more]')) { limit += PAGE; rerender(); return; }
  if (e.target.closest?.('[data-stock-bills]')) { openBills(); return; }
  if (e.target.closest?.('[data-stock-ginti]')) { openGinti(); return; }
  if (e.target.closest?.('[data-stock-transfer]')) { openTransfer(); return; }
  if (e.target.closest?.('[data-stock-in]')) { openIn(true); return; }
  if (e.target.closest?.('[data-ginti-pdf]')) { gintiPdfOf?.(); return; }       // v2.13
  if (e.target.closest?.('[data-stock-tolai]')) { tolaiOf?.(); return; }        // v2.7
  if (tolaiClickOf && tolaiClickOf(e)) return;          // v2.6
  const inb = e.target.closest?.('[data-in-d],[data-in-k],[data-in-red],[data-in-item],[data-in-count],[data-in-pdf],[data-in-close]');
  if (inb) { const d = inb.dataset;                                   // v2.6: aaya hua maal
    if (d.inD != null) { inDays = Number(d.inD); openIn(true); }
    else if (d.inK != null) { inKind = d.inK; openIn(true); }
    else if (d.inRed != null) { inFilter = !inFilter; openIn(false); }
    else if (d.inClose != null) $('dialog')?.close();
    else if (d.inPdf != null) inPdfOf?.();
    else if (d.inCount != null) { const ids = (inRows?.groups || []).flatMap(g => g.rows).filter(r => !inFilter || r.conf !== 'g').map(r => r.id); inPick = new Set(ids); $('dialog')?.close(); const q = $('search'); if (q) q.value = ''; rerender(); }
    else if (d.inItem != null) { const r = (inRows?.groups || []).flatMap(g => g.rows).find(x => x.id === d.inItem); $('dialog')?.close(); const q = $('search'); if (q && r) { q.value = r.name; q.dispatchEvent(new Event('input', { bubbles: true })); } rerender(); setTimeout(() => document.querySelector(`[data-stock-row="${d.inItem}"] input`)?.focus(), 200); }
    return; }
  if (e.target.closest?.('[data-in-clear]')) { inPick = null; rerender(); return; }
  const lb = e.target.closest?.('[data-stock-label]');
  if (lb) { openLabels(lb.dataset.stockLabel); return; }
  const lp = e.target.closest?.('[data-label-print]');
  if (lp) { printLabel(lp); return; }
  const s = e.target.closest?.('[data-stock-sort]');
  if (s) { sort = s.dataset.stockSort; rerender(); return; }
  const f = e.target.closest?.('[data-stock-filter]');
  if (f) { filter = f.dataset.stockFilter; if (filter === 'all') godamAll = true; limit = PAGE; rerender(); return; }

  const nr = e.target.closest?.('[data-stock-round]');
  if (nr) { startNewRound(); return; }
  if (e.target.closest?.('[data-stock-post]')) { requestPost(); return; }
  if (e.target.closest?.('[data-stock-approve]')) { answerPost(true); return; }
  if (e.target.closest?.('[data-stock-cancelpost]')) { answerPost(false); return; }

  const tk = e.target.closest?.('[data-count-tick]');
  if (tk) { try { noteHit(tk.dataset.countTick); } catch {} tickCount(tk.dataset.countTick, tk); return; }   // v2.4.5: search mein aage
  const sv = e.target.closest?.('[data-count-save]');
  if (sv) { try { noteHit(sv.dataset.countSave); } catch {} saveCount(sv.dataset.countSave, sv); return; }
  const ad = e.target.closest?.('[data-count-add]');
  if (ad) { saveCount(ad.dataset.countAdd, ad, 'baqi'); return; }
  const fb = e.target.closest?.('[data-flag-baqi]');
  if (fb) { const it = collect().items.find(r => String(r.id) === fb.dataset.flagBaqi); const v = it ? readCount(it, false) : null; if (v && !v.bad && v.total > 0) saveCount(fb.dataset.flagBaqi, fb, 'baqi'); else setFlag(fb.dataset.flagBaqi, { baqi: !flagOf(fb.dataset.flagBaqi).baqi }); return; }
  const fc = e.target.closest?.('[data-flag-check]');
  if (fc) { setFlag(fc.dataset.flagCheck, { check: !flagOf(fc.dataset.flagCheck).check }); return; }
  const fd = e.target.closest?.('[data-flag-checked]');
  if (fd) { setFlag(fd.dataset.flagChecked, { check: false, checkedAt: Date.now() }); notice('✓ Check ho gaya'); return; }
  if (e.target.closest?.('[data-stock-lock]')) { toggleLock(); return; }
});

async function setFlag(id, patch) {
  if (!cloud?.setStockFlag) return;
  try { await cloud.setStockFlag(String(id), { ...flagOf(id), ...patch }); }
  catch (e) { notice(e?.message || 'Nishan save nahi hua'); }
}
async function toggleLock() {
  if (!isOwner() || !cloud?.setStockLock) return;
  const off = !countOff;
  if (!confirm(off ? 'Counting OFF karein? Mulazim koi ginti save nahi kar sakega (nishan laga sakega).' : 'Counting ON karein? Mulazim phir ginti save kar sakega.')) return;
  try { await cloud.setStockLock(off); notice(off ? 'Counting OFF' : 'Counting ON'); }
  catch (e) { notice(e?.message || 'Nahi hua'); }
}

function postLine(pick) {
  const p = postReq;
  if (!p || p.round !== round || p.branch !== pick) return '';
  const when = p.doneAt || p.previewAt || p.at;
  const t = when ? new Date(when).toLocaleString('en-PK') : '';
  if (p.status === 'preview' && p.preview) {
    const v = p.preview;
    const rows = (list, sign) => list.map(x => `<tr><td>${esc(x.name)}</td><td>${sign}${num(x.qty)}</td><td>${num(x.rate)}</td><td>${sign}${num(x.amount)}</td></tr>`).join('');
    const table = (title, list, sign) => list.length ? `<p><b>${esc(title)}</b></p>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Bhao</th><th>Rs</th></tr></thead>
      <tbody>${rows(list, sign)}</tbody></table></div>` : '';
    const skipped = (v.skipped || []).length
      ? `<p><small>Chhor diye: ${esc(v.skipped.map(x => x.name).join(', '))}</small></p>` : '';
    return `<div style="margin:8px 0;padding:10px;border:1px solid #9bb7e8;border-radius:10px">
      <p><b>PC ne bill ki list bheji hai — account ${esc(v.party || '')}</b></p>
      ${p.note ? `<p><small><b>${esc(p.note)}</b></small></p>` : ''}
      ${table('Kam nikle — Sale (stock kam hoga)', v.kam || [], '-')}
      ${table('Zyada nikle — Return (stock barhega)', v.zyada || [], '+')}
      ${skipped}
      <p>Kam: Rs ${num(v.kamRs)} · Zyada: Rs ${num(v.zyadaRs)}<br><b>Kul farq: Rs ${num(v.total)}</b></p>
      ${isOwner() ? `<div class="account-tools">
        <button data-stock-approve="1" class="selected">Bill banao</button>
        <button data-stock-cancelpost="1">Cancel</button></div>`
        : '<p><small>Bill sirf malik bana sakta hai</small></p>'}
      <small>${esc(t)}</small></div>`;
  }
  const msg = {
    pending: 'PC ko bheja gaya — PC list tayyar kar raha hai (PC chalu hona chahiye)',
    approved: 'OK ho gaya — PC bill bana raha hai…',
    posting: 'PC bill bana raha hai…',
    done: `PC par bill ban gaya: Sale No ${p.saleNo || ''}${p.returnNo ? ' · Return No ' + p.returnNo : ''} · Kul farq Rs ${num(p.total)} · ${num(p.lines)} items`,
    nothing: 'PC ne dekha: bill banane ke liye koi naya farq wala item nahi',
    cancelled: 'Bill cancel kar diya gaya',
    failed: 'PC par bill nahi bana: ' + (p.error || '')
  }[p.status] || '';
  return msg ? `<div class="account-tools"><small><b>${esc(msg)}</b>${t ? ' · ' + esc(t) : ''}</small></div>` : '';
}

async function answerPost(ok) {
  const p = postReq;
  if (!cloud?.requestFarqPost || !p || p.status !== 'preview') return;
  const v = p.preview || {};
  if (ok && !confirm(`POS mein bill ban jayega.\nKul farq: Rs ${num(v.total)}\nPakka?`)) return;
  const { id, ...rest } = p;
  try {
    await cloud.requestFarqPost(ok
      ? { ...rest, status: 'approved', approvedAt: Date.now() }
      : { round: p.round, branch: p.branch, at: p.at, status: 'cancelled', doneAt: Date.now() });
    notice(ok ? 'PC ko OK bhej diya' : 'Cancel kar diya');
  } catch (e) { notice(e?.message || 'Nahi hua'); }
}

async function requestPost() {
  if (!cloud?.requestFarqPost || !round) return;
  const r = stockReport();
  const kam = r.rows.filter(x => x.d < -0.001);
  const zyada = r.rows.filter(x => x.d > 0.001);
  if (!kam.length && !zyada.length) { notice('Koi farq wala item nahi'); return; }
  if (!confirm(`PC par bill banana hai?\nKam nikle: ${kam.length} items (Rs ${num(-r.kamRs)}) — Sale\nZyada nikle: ${zyada.length} items (Rs ${num(r.zyadaRs)}) — Return\nList thori der mein yahin aa jayegi.`)) return;
  try {
    await cloud.requestFarqPost({ round, branch: pickedBranch, status: 'pending', at: Date.now() });
    notice('PC ko bhej diya — list thori der mein yahin aayegi');
  } catch (e) { notice(e?.message || 'Nahi bheja ja saka'); }
}

async function toggleHidden(id, on, box) {
  if (!cloud?.setStockHidden || !isOwner()) { box.checked = !on; return; }
  const item = collect().items.find(r => String(r.id) === String(id));
  const nm = item ? item.name : 'Yeh item';
  const stk = item ? `\nAbhi stock: ${num(item.stock)} ${item.uName || 'Pcs'}` : '';
  const msg = on
    ? `"${nm}" BAND karein?${stk}\n\nPC par POS mein is ka stock 0 ho jayega (stock fraq ka bill banega) aur item INACTIVE ho jayega.`
    : `"${nm}" ko wapas chalu karein?\n\nPOS mein item dobara ACTIVE ho jayega (stock 0 hi rahega).`;
  if (!confirm(msg)) { box.checked = !on; return; }
  const next = { ...hidden };
  if (on) next[String(id)] = true; else delete next[String(id)];
  box.disabled = true;
  try {
    await cloud.setStockHidden(next);
    hidden = next;
    notice(on ? 'Item band — list se hat gaya ("Band items" mein milega)' : 'Item wapas list mein');
    rerender();
  } catch (e) { box.checked = !on; notice(e?.message || 'Nahi hua'); }
  finally { box.disabled = false; }
}

async function startNewRound() {
  if (!cloud?.setStockRound) return;
  // v1.67: waqt bhi saath, taake ek hi din mein nayi ginti purani se alag rahe
  const n = new Date(), p2 = x => String(x).padStart(2, '0');
  const label = `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
  if (!confirm('Nayi ginti shuru karein? Purani ginti ki list saaf ho jayegi (bills ki history rehti hai).')) return;
  try { $('dialog')?.open && $('dialog').close(); } catch {}
  try { await cloud.setStockRound(label); notice('Nayi ginti shuru — ' + label); }
  catch (e) { notice(e?.message || 'Nahi hua'); }
}

// Ek item ke khanon se ginti parho. skipBlank=true: teeno khane khali hon to null
function readCount(item, skipBlank) {
  const id = CSS.escape(String(item.id));
  const box = sel => $('list').querySelector(`[data-count-${sel}="${id}"]`);
  const per = Number(item.pack) || 0;
  const rawTot = (box('tot')?.value ?? '').trim();
  const rawCtn = (box('ctn')?.value ?? '').trim();
  const rawPcs = (box('pcs')?.value ?? '').trim();
  if (skipBlank && rawTot === '' && rawCtn === '' && rawPcs === '') return null;
  let ctn, pcs, total;
  if (rawTot !== '') {
    // Sirf kul pieces likhe gaye — carton khud ban jayega
    total = Math.round(Number(rawTot) * 100) / 100;
    ctn = per > 1 ? Math.floor(total / per) : 0;
    pcs = Math.round((total - ctn * (per > 1 ? per : 0)) * 100) / 100;
  } else {
    ctn = Number(rawCtn || 0);
    pcs = Number(rawPcs || 0);
    total = Math.round((ctn * (per > 0 ? per : 1) + pcs) * 100) / 100;
  }
  return { ctn, pcs, total, bad: !Number.isFinite(total) || !Number.isFinite(ctn) || !Number.isFinite(pcs) };
}

async function writeCount(item, v, add = null, tick = false) {
  const at = Date.now();
  const old = counts.get(countId(pickedBranch, item.id));
  const past = Array.isArray(old?.history) ? old.history : [];
  const h = { at, ctn: v.ctn, pcs: v.pcs, total: v.total, sys: item.stock };
  if (add) { h.add = { ctn: add.ctn, pcs: add.pcs, total: add.total }; if (add.note) h.note = add.note; }
  if (tick) h.tick = true;
  const history = [...past, h].slice(-20);
  await cloud.saveStockCount({
    id: countId(pickedBranch, item.id),
    round, branch: pickedBranch, itemId: item.id,
    name: item.name, sys: item.stock,
    ctn: v.ctn, pcs: v.pcs, total: v.total, at, history
  });
}

const zeroText = item => {
  const gap = -Number(item.stock || 0);
  const rs = item.prate ? ` (Rs ${num(gap * item.prate)})` : '';
  return `System mein: ${num(item.stock)} ${item.uName || 'Pcs'} · Farq: ${gap > 0 ? '+' : ''}${num(gap)}${rs}`;
};

// v1.76 (malik ki hidayat): "⏳ Baqi — aur ginna hai" = jo likha hai save + pichhli mein JAMA + nishan + khane saaf;
// phir "Save" = likha hua pichhli (baqi) ginti mein jama karke FINAL, nishan hat jata hai. Nishan na ho to Save = pehle jaisa (badal deta hai).
async function saveCount(itemId, button, mode = 'save') {
  if (!round) { notice('Pehle "Nayi ginti shuru" dabayein'); return; }
  if (countLocked()) { notice('Malik ne counting band ki hui hai'); return; }
  const { items } = collect();
  const item = items.find(r => String(r.id) === String(itemId));
  if (!item) return;
  let v = readCount(item, false), add = null;
  if (v.bad) { notice('Ginti sahi likhein'); return; }
  const old = countOf(pickedBranch, item);
  const baqi = flagOf(item.id).baqi;
  const jama = (mode === 'baqi' && old) || (mode === 'save' && baqi && old);
  if (mode === 'baqi' && v.total === 0 && !old) { notice('Pehle ginti likhein, phir "Baqi"'); return; }
  if (jama && v.total > 0) {
    const per = Number(item.pack) || 0;
    const total = Math.round((countedPcs(old) + v.total) * 1000) / 1000;
    const ctn = per > 1 ? Math.floor(total / per) : 0;
    const pcs = Math.round((total - ctn * (per > 1 ? per : 0)) * 1000) / 1000;
    add = { ...v, note: '' };
    v = { ctn, pcs, total, bad: false };
  } else if (jama && v.total === 0 && mode === 'save') {
    v = { ctn: Number(old.ctn) || 0, pcs: Number(old.pcs) || 0, total: countedPcs(old), bad: false };   // kuch nahi likha: pichhli ginti hi final
  }
  if (v.total === 0 && !confirm(`"${item.name}" ki ginti ZERO save karein?\n\n${zeroText(item)}`)) return;
  button.disabled = true;
  try {
    if (!(mode === 'save' && jama && v.total === countedPcs(old) && !add)) await writeCount(item, v, add);
    if (mode === 'baqi') { if (!baqi) await setFlag(item.id, { baqi: true }); const id = CSS.escape(String(item.id)); ['ctn', 'pcs', 'tot'].forEach(k => { const b = $('list').querySelector(`[data-count-${k}="${id}"]`); if (b) b.value = ''; }); }
    else if (baqi) await setFlag(item.id, { baqi: false });
    notice(item.name + (mode === 'baqi' ? ` — ab tak ${num(v.total)} ${item.uName || 'Pcs'} (baqi ginna hai)` : add ? ` — jama: kul ${num(v.total)} ${item.uName || 'Pcs'} ✓` : ' — ginti mehfooz'));
  } catch (e) {
    notice(e?.message || 'Ginti save nahi hui');
  } finally {
    button.disabled = false;
  }
}

// v1.97: ✓ Tick — "jitna system mein hai utna hi maal hai": system stock ko hi ginti maan kar save; history mein "✓ Tick" line
async function tickCount(itemId, button) {
  if (!round) { notice('Pehle "Nayi ginti shuru" dabayein'); return; }
  if (countLocked()) { notice('Malik ne counting band ki hui hai'); return; }
  const item = collect().items.find(r => String(r.id) === String(itemId));
  if (!item) return;
  // v2.95.6: khanon mein ginti likhi ho to Tick = wahi ginti Save (farq ke saath history mein), system jaisa NAHI
  { const typed = readCount(item, true); if (typed && !typed.bad) { await saveCount(itemId, button); return; } }
  const sys = Math.round((Number(item.stock) || 0) * 1000) / 1000;
  if (sys < 0) { notice(`System mein stock minus (${num(sys)}) hai — tick nahi hota, asal ginti likh kar Save karein`); return; }
  const per = Number(item.pack) || 0;
  const ctn = per > 1 ? Math.floor(sys / per + 1e-9) : 0;
  const pcs = Math.round((sys - ctn * (per > 1 ? per : 0)) * 1000) / 1000;
  const old = countOf(pickedBranch, item);
  if (old && countedPcs(old) !== sys && !confirm(`"${item.name}" ki pehle ginti ${num(countedPcs(old))} hai.\nTick se ginti system jaisi ${num(sys)} ho jayegi — theek?`)) return;
  if (sys === 0 && !confirm(`"${item.name}" — system mein 0 hai. Tick = ginti ZERO. Theek?`)) return;
  button.disabled = true;
  try {
    await writeCount(item, { ctn, pcs, total: sys, bad: false }, null, true);
    if (flagOf(item.id).baqi) await setFlag(item.id, { baqi: false });
    notice(`✓ ${item.name} — system jaisa ${num(sys)} ${item.uName || 'Pcs'} (tick)`);
  } catch (e) { notice(e?.message || 'Tick save nahi hua'); }
  finally { button.disabled = false; }
}

// Scan list ke sab items ek dafa save (jin ki ginti likhi hai aur badli hai)
async function saveAll(button) {
  if (countLocked()) { notice('Malik ne counting band ki hui hai'); return; }
  if (!round) { notice('Pehle "Nayi ginti shuru" dabayein'); return; }
  const { items } = collect();
  const byId = new Map(items.map(r => [String(r.id), r]));
  const jobs = [], bad = [];
  for (const id of scanList) {
    const item = byId.get(String(id));
    if (!item) continue;
    const v = readCount(item, true);
    if (!v) continue;
    if (v.bad) { bad.push(item.name); continue; }
    const old = countOf(pickedBranch, item);
    if (old && Number(old.total) === v.total && Number(old.ctn) === v.ctn && Number(old.pcs) === v.pcs) continue;  // pehle se yahi save hai
    jobs.push([item, v]);
  }
  if (bad.length) { notice('Ginti sahi likhein: ' + bad.join(', ')); return; }
  if (!jobs.length) { notice('Koi nayi ginti nahi likhi (ya sab pehle se save hain)'); return; }
  const zeros = jobs.filter(([, v]) => v.total === 0);
  const lines = jobs.map(([it, v]) => `• ${it.name}: ${num(v.total)}${v.total === 0 ? '  ← ZERO (' + zeroText(it) + ')' : ''}`);
  if (!confirm(`${jobs.length} items ki ginti save karein?${zeros.length ? `\n\n${zeros.length} item ZERO hain!` : ''}\n\n${lines.join('\n')}`)) return;
  button.disabled = true;
  let ok = 0;
  const fail = [];
  for (const [item, v] of jobs) {
    try { await writeCount(item, v); ok++; }
    catch (e) { fail.push(item.name); }
  }
  button.disabled = false;
  notice(fail.length ? `${ok} save hue · NAHI hue: ${fail.join(', ')}` : `${ok} items ki ginti mehfooz ✓`);
}

// Enter dabane par agla ginti ka khana
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches?.('[data-count-ctn],[data-count-pcs],[data-count-tot]')) return;
  const all = [...($('list')?.querySelectorAll('[data-count-ctn],[data-count-pcs],[data-count-tot]') || [])];
  const i = all.indexOf(e.target);
  if (i < 0) return;
  e.preventDefault();
  const next = all[i + 1];
  if (next) { next.focus(); try { next.select(); } catch {} next.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else e.target.blur();
});

// ============================================================
//  BARCODE SCAN (mobile camera) — Chrome (Android) ka BarcodeDetector
//  Camera khula rehta hai: ek ke baad ek items scan karein -> "Ho gaya" -> sirf woh items ki list
//  -> ginti likh kar "Sab save karein" -> "Saaf karein" se wapas poori list
// ============================================================
let scanHit = null;
let scanList = [];        // scan kiye hue item ids (tarteeb se)
let scanStream = null, scanTimer = null, scanBox = null, scanBusy = false;
let scanCamOff = false; try { scanCamOff = localStorage.getItem('sam-scan-camoff') === '1'; } catch {}   // v2.40: 📷 camera band/chalu (phone yaad rakhta hai)
function camOffBtn(tools) { const b = document.createElement('button'); b.type = 'button'; b.className = 'scan-camoff'; b.textContent = scanCamOff ? '📷 Camera chalu' : '📷 Camera band';
  b.onclick = () => { scanCamOff = !scanCamOff; try { localStorage.setItem('sam-scan-camoff', scanCamOff ? '1' : '0'); } catch {} closeScanner(); openScanner(); }; tools.appendChild(b); return b; }
let lastCode = '', lastCodeAt = 0;
let badCode = '', badN = 0, lastGoodAt = 0;   // v1.56: ghalat parhai ka filter
let camRetry = 0, audioCtx = null;            // v1.57: kaala camera dobara chalu, scan ki awaz
// v2.95.4: PC par scanner gun (keyboard) ka pehla scan hi awaz chalu kar de — mouse click ki zaroorat nahi
if (typeof document !== 'undefined') document.addEventListener('keydown', () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state !== 'running') audioCtx.resume(); } catch {} }, true);
// v1.74: "ek barcode chuno" mode — wohi bara scanner (Focus/Zoom/Camera/Light) sirf ek code parh kar wapas
let pickHook = null, pickMulti = null;   // v2.17: pickMulti = { done } — camera khula rahe, har code par cb (transfer note)
export function scanPick(cb) { pickMulti = null; pickHook = cb; if (scanBox) finishScan(); openScanner(); }
export function scanPickMany(cb, done) { if (scanBox) finishScan(); pickMulti = { done }; pickHook = cb; openScanner(); }
// v1.59: camera ka jawab 4 sec mein na aaye to intezar khatam (baad mein mila stream foran band, taake camera na phanse)
function gumT(c, ms = 4000) {
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { done = true; const e = new Error('Camera kahin aur khula hai'); e.name = 'Timeout'; rej(e); }, ms);
    navigator.mediaDevices.getUserMedia(c).then(s => {
      if (done) { s.getTracks().forEach(x => x.stop()); return; }
      clearTimeout(t); done = true; res(s);
    }, e => { if (!done) { clearTimeout(t); done = true; rej(e); } });
  });
}
// v1.59: tab / app peeche jaye (doosra tab, call, doosri app) to camera chhor do — warna doosri jagah kaala camera
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden && scanBox) finishScan(); });
function beep(ok) {
  try {
    if (!audioCtx) return;
    if (audioCtx.state !== 'running') audioCtx.resume();
    const t = audioCtx.currentTime + 0.01;
    // v1.60: zyada tez aur lambi awaz
    const tones = ok ? [[2200, 0, 0.18]] : [[380, 0, 0.2], [380, 0.28, 0.2]];
    for (const [f, s, d] of tones) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.6, t + s); g.gain.exponentialRampToValueAtTime(0.001, t + s + d);
      o.connect(g); g.connect(audioCtx.destination); o.start(t + s); o.stop(t + s + d + 0.02);
    }
  } catch {}
}

function clearScan() {
  $('list')?.querySelectorAll?.(COUNT_SEL).forEach(el => { el.value = el.defaultValue; });
  scanList = []; scanHit = null; scanQty = new Map(); lastScan = null; lastKey = ''; scanOrder = []; scanItems = new Map();
  const si = $('search'); if (si) si.value = '';
  limit = PAGE;
  rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// v2.71: search natije mein item ke SAARE barcode (code + extra barcode + sub-barcode tadad ke sath)
function hitCodes(r) {
  const sub = new Map((Array.isArray(r.bq) ? r.bq : []).filter(x => x && x.b).map(x => [String(x.b).trim(), x.q]));
  const all = [...new Set([r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...sub.keys()].map(x => String(x || '').trim()).filter(Boolean))];
  if (!all.length) return '';
  return `<span class="hit-codes">${all.map(c => `<i class="hc${sub.has(c) ? ' sub' : ''}">${esc(c)}${sub.has(c) ? ` <b>${num(sub.get(c))}</b>` : ''}</i>`).join('')}</span>`;
}
// v2.70: search natije mein 4 rate — Parchoon (Pcs / Ctn) · Wholesale (Pcs / Ctn)
function hitRates(r) {
  const pk = Number(r.pack) || 0, rp = Number(r.rate2) || Number(r.rate) || 0, rc = Number(r.rate) || 0, wp = Number(r.wrate) || Number(r.rate) || 0;
  if (!rp && !wp) return '';
  const c = (lbl, v, cls) => v ? `<i class="hr ${cls}">${lbl} <b>${num(Math.round(v * 100) / 100)}</b></i>` : '';
  return `<span class="hit-rates">${c('Parchoon', rp, 'r')}${pk > 1 ? c('P/' + (r.cName || 'Ctn'), rc * pk, 'r') : ''}${c('Wholesale', wp, 'w')}${pk > 1 ? c('W/' + (r.cName || 'Ctn'), wp * pk, 'w') : ''}</span>`;
}
function closeScanner() {
  try { clearInterval(scanBox?._billsTimer); } catch {}
  clearTimeout(scanTimer); try { cancelAnimationFrame(scanTimer); } catch {} scanTimer = null;
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  if (scanBox) { scanBox.remove(); scanBox = null; }
}

function finishScan() {
  camRetry = 0;
  const wasPick = !!pickHook, many = pickMulti; pickHook = null; pickMulti = null;
  closeScanner();
  if (many) { try { many.done?.(); } catch {} return; }   // v2.17: kai code wala chunao khatam
  if (wasPick) return;   // v1.74: sirf code chunna tha — sale/ginti ko haath na lagao
  if (saleRoot()) { saleSeen = []; rerender(); return; }
  if (!scanList.length) return;
  rerender();
  const { items } = collect();
  // camera par chuni hui tadad ginti ke khanon mein bhar do
  setTimeout(() => {
    for (const [id, q] of scanQty) {
      const esc_ = CSS.escape(String(id));
      const c = $('list')?.querySelector(`[data-count-ctn="${esc_}"]`), p = $('list')?.querySelector(`[data-count-pcs="${esc_}"]`), t = $('list')?.querySelector(`[data-count-tot="${esc_}"]`);
      if (c && q.ctn) c.value = q.ctn;
      if (p && q.pcs) p.value = q.pcs; else if (!p && t && q.pcs) t.value = q.pcs;
      liveCount(id);
    }
    scanQty = new Map(); lastScan = null; lastKey = '';
  }, 60);
  const first = items.find(r => String(r.id) === String(scanList[0]));
  if (first) setTimeout(() => focusItem(first), 80);
}

// code se item dhoondo (is branch mein): ItemCode + POS ke baqi barcode
function findByCode(code) {
  const clean = String(code).trim();
  const bare = clean.replace(/^0+/, '');
  const { items } = collect();
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : []), ...(Array.isArray(r.bq) ? r.bq.map(x => x?.b) : [])].map(x => String(x || '').trim()).filter(Boolean);   // v2.55: sub-barcode bhi
  return items.find(r => codesOf(r).includes(clean))
    || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare))
    || null;
}

// scan list mein daalo. Wapas: 'added' | 'again' | null (nahi mila)
function addScanned(code) {
  if (saleRoot()) {
    const r = saleHook ? saleHook(code) : { state: null };
    if (r.state) saleSeen.push(r.item.name);
    return r;
  }
  const item = findByCode(code);
  if (!item) return { state: null };
  if (scanList.some(id => String(id) === String(item.id))) return { state: 'again', item };
  scanList.push(item.id);
  scanHit = item.id;
  return { state: 'added', item };
}

// ---------- v1.69: iPhone ke liye barcode parhna (ZXing, vendor/zxing.min.js — pehli dafa aa kar phone mein mehfooz) ----------
let zxingP = null;
function zxingDetector() {
  if (!zxingP) zxingP = new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script');
    s.src = './vendor/zxing.min.js?v=0.21.3';
    s.onload = () => res();
    s.onerror = () => rej(new Error('zxing load'));
    document.head.appendChild(s);
  }).then(() => {
    const Z = window.ZXing, F = Z.BarcodeFormat;
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    return {
      detect: async video => {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return [];
        const k = Math.min(1, 1024 / vw);
        canvas.width = Math.round(vw * k); canvas.height = Math.round(vh * k);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const r = reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas))));
          return [{ rawValue: r.getText() }];
        } catch { return []; }
        finally { try { reader.reset(); } catch {} }
      }
    };
  }).catch(e => { zxingP = null; throw e; });
  return zxingP;
}

// v2.77: is device par camera hai? (PC par aksar nahi) — na ho to 📷 ki jagah 🔫 scanner gun wala tareeqa
let noCam = null;
try { if (localStorage.getItem('sam-nocam') === '1') noCam = true; } catch {}
export function camMissing() { return noCam === true; }
function camIco() { return noCam === true ? '🔫' : '📷'; }
export async function camCheck() {
  let none = false;
  try {
    if (!navigator.mediaDevices?.enumerateDevices) none = true;
    else none = !(await navigator.mediaDevices.enumerateDevices()).some(d => d.kind === 'videoinput');
  } catch { none = false; }
  noCam = none; try { localStorage.setItem('sam-nocam', none ? '1' : '0'); } catch {}
  return !none;
}
try { navigator.mediaDevices?.addEventListener?.('devicechange', () => { camCheck(); }); } catch {}
async function openScanner() {
  if (scanBox) return;
  const hasCam = await camCheck();   // v2.77
  if (scanBox) return;
  if (!pickHook) syncFromCart();
  // awaz: button dabane (user ke haath) par hi chalu ho sakti hai
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {}
  if (hasCam && !navigator.mediaDevices?.getUserMedia) {
    notice('Is phone/browser mein camera nahi khulta — code search mein likhein.');
    return;
  }
  let detector;
  if (!hasCam) { /* v2.77: camera nahi — detector ki zaroorat nahi */ }
  else if ('BarcodeDetector' in window) {   // Android Chrome: phone ka apna tez tareeqa
    let formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code'];
    try { const sup = await BarcodeDetector.getSupportedFormats(); formats = formats.filter(f => sup.includes(f)); } catch {}
    try { detector = new BarcodeDetector({ formats }); } catch { detector = new BarcodeDetector(); }
  } else {                              // v1.69: iPhone (Safari / iPhone Chrome) — ZXing library se
    try { detector = await zxingDetector(); }
    catch { notice('Barcode parhne wali library load nahi hui (internet check karein) — code search mein likhein.'); return; }
    if (scanBox) return;               // intezar ke dauran dobara na khul jaye
  }

  scanBox = document.createElement('div');
  scanBox.className = 'scan-box';
  scanBox.innerHTML = `<div class="scan-inner">
      <div class="scan-find"><div class="scan-find-row"><input class="scan-q" type="search" enterkeyhint="next" placeholder="🔍 Naam ya code likhein" autocomplete="off"><input class="scan-n" type="text" inputmode="decimal" enterkeyhint="done" placeholder="Pcs" autocomplete="off"><input class="scan-c" type="text" inputmode="decimal" enterkeyhint="done" placeholder="Ctn" autocomplete="off"><button type="button" class="scan-u" hidden>Pcs</button></div><div class="scan-hits" hidden></div></div>
      <div class="scan-mid">
        <div class="scan-left"></div>
        <div class="scan-cam"><video playsinline muted autoplay></video><div class="scan-line"></div></div>
        <div class="scan-pad" hidden>
          <div class="scan-pad-name"></div>
          <div class="scan-pad-row"><button type="button" data-unit="pcs" class="selected">Pcs</button><button type="button" data-unit="ctn">Ctn</button>
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<button type="button" data-qty="${n}">${n}</button>`).join('')}<button type="button" data-qty="+1">+1</button></div>
        </div>
      </div>
      <p class="scan-msg">Barcode camera ke saamne rakhein — ek ke baad ek scan karte jayein</p>
      <ol class="scan-names"></ol>
      <div class="scan-sum"></div>
      <button type="button" class="scan-done">✓ Ho gaya — list dikhao (<span>0</span>)</button>
      <button type="button" class="scan-close">✕ Band karein</button>
    </div>`;
  document.body.appendChild(scanBox);
  const msg = scanBox.querySelector('.scan-msg');
  if (pickHook) {   // v1.74: sirf ek code chunna hai — search/tadad/list chhupa do (v2.41: transfer wale pickMulti mein search rahe)
    scanBox.classList.add('pick-mode');
    if (!pickMulti) scanBox.querySelector('.scan-find')?.setAttribute('hidden', '');
    scanBox.querySelector('.scan-pad')?.setAttribute('hidden', '');
    if (pickMulti) { const dn = scanBox.querySelector('.scan-done'); if (dn) dn.innerHTML = '✓ Ho gaya — list dikhao (<span>0</span>)'; msg.textContent = 'Ek ke baad ek barcode camera ke saamne laayein — har item neeche list mein jurta jayega'; }
    else { scanBox.querySelector('.scan-done')?.setAttribute('hidden', ''); msg.textContent = 'Barcode camera ke saamne rakhein — parhte hi wapas form khulega'; }
  }
  const namesBox = scanBox.querySelector('.scan-names');
  const countBox = scanBox.querySelector('.scan-done span');
  const { items } = collect();
  const byId = new Map(items.map(r => [String(r.id), r]));
  const sumBox = scanBox.querySelector('.scan-sum');
  const lineOf = (it, k) => {
    const q = scanQty.get(k ?? String(it.id)) || { pcs: 0, ctn: 0 };
    const pack = Number(it.pack) || 0;
    const total = Math.round(((Number(q.ctn) || 0) * (pack > 1 ? pack : 0) + (Number(q.pcs) || 0)) * 1000) / 1000;
    const rate = Number(it.rate2) || Number(it.rate) || 0;   // v1.61: khula piece POS "Peice Rate"
    const ctnRate = Number(it.rate) || rate;                  // carton fi piece
    const qtxt = `${q.ctn ? num(q.ctn) + ' ' + (it.cName || 'Ctn') + (q.pcs ? ' + ' : '') : ''}${q.pcs || !q.ctn ? num(q.pcs || 0) + ' ' + (it.uName || 'Pcs') : ''}`;
    const ctnPcs = Math.round((Number(q.ctn) || 0) * (pack > 1 ? pack : 0) * 1000) / 1000;
    return { total, rate, amt: r2(ctnPcs * ctnRate + (Number(q.pcs) || 0) * rate), qtxt };
  };
  let liG = null;   // v2.95.1: godam list EK dafa fi draw (pehle har line par — scan dheema)
  const liGodam = (k, it) => { if (!saleLineGodamHook || !saleGodamHook) return ''; const g = liG; if (!g || !g.list || g.list.length < 2) return '';
    const cur = Number(it.g) || 1; return `<div class="li-g">${g.list.map(x => `<button type="button" data-lgk="${esc(k)}" data-lgb="${x.b}" title="${esc(x.full || x.name)}"${Number(x.b) === cur ? ' class="on"' : ''}>${esc(x.name)}</button>`).join('')}</div>`; };
  const drawNames = (keepScroll) => {
    const sale = saleRoot();
    if (sale) {
      const list = scanOrder.map(k => [k, scanItems.get(k)]).filter(x => x[1]);
      liG = null; if (saleLineGodamHook && saleGodamHook) { try { liG = saleGodamHook(); } catch {} }
      countBox.textContent = list.length;
      namesBox.innerHTML = list.slice().reverse().map(([k, it]) => { const L = lineOf(it, k);   // v2.33: nayi upar
        return `<li data-k="${esc(k)}"${k === lastKey ? ' class="now"' : ''}><button type="button" class="scan-del" data-del="${esc(k)}" aria-label="Hatao">✕</button><b>${esc(it.name)}</b><span>${esc(L.qtxt)}${L.rate ? ` x ${num(L.rate)} = <b>${num(L.amt)}</b>` : ''}</span>${(() => { const q = scanQty.get(k) || { pcs: 0, ctn: 0 }, pk = Number(it.pack) || 0; return `<div class="li-qty">${pk > 1 ? `<label>${esc(it.cName || 'Ctn')}<input class="li-in" data-li="${esc(k)}" data-u="ctn" type="text" inputmode="decimal" autocomplete="off" value="${q.ctn || ''}" placeholder="0"></label>` : ''}<label>${esc(it.uName || 'Pcs')}<input class="li-in" data-li="${esc(k)}" data-u="pcs" type="text" inputmode="decimal" autocomplete="off" value="${q.pcs || ''}" placeholder="0"></label><button type="button" class="li-neg${L.total < 0 ? ' on' : ''}" data-neg="${esc(k)}" title="Wapsi (minus)">${L.total < 0 ? '↩' : '±'}</button></div>`; })()}${liGodam(k, it)}</li>`; }).join('');   // v2.95: ± wapsi + line ka godam   // v2.67: har line par Pcs (aur Ctn) ke khane   // v2.42: transfer (rate 0) par sirf tadad
      namesBox.reversed = true; namesBox.start = list.length;
      const kul = list.reduce((n, [k, it]) => n + lineOf(it, k).amt, 0);
      sumBox.innerHTML = list.length ? (kul ? `Kul: <b>Rs ${num(kul)}</b>` : `<b>${list.length}</b> items`) : '';
      if (keepScroll) { namesBox.querySelector('li.now')?.scrollIntoView({ block: 'nearest' }); } else { try { namesBox.scrollTop = 0; } catch {} }   // v2.55.1: nayi line upar · v2.58: chuni line nazar mein
      return;
    }
    const names = scanList.slice(-6).map(id => byId.get(String(id))?.name || id);
    countBox.textContent = scanList.length;
    namesBox.innerHTML = names.map(x => `<li>${esc(x)}</li>`).join('');
    namesBox.start = Math.max(1, scanList.length - 5);
    sumBox.innerHTML = '';
  };
  drawNames();
  scanBox._redraw = () => { try { showPad(); drawNames(); } catch {} };
  scanBox._reload = () => { const keep = lastKey; syncFromCart(); if (keep && scanItems.has(keep)) { lastKey = keep; lastScan = scanItems.get(keep); } try { showPad(); drawNames(true); } catch {} };   // v2.95
  // v2.64: Pcs/Ctn ke sath GODAM chips (sale) — agla scan isi godam se
  if (saleRoot() && saleGodamHook && !pickHook) {
    const gw = document.createElement('div'); gw.className = 'scan-godam';
    const paintG = () => { let g = null; try { g = saleGodamHook(); } catch {} if (!g || !g.list || g.list.length < 2) { gw.hidden = true; return; } gw.hidden = false;
      gw.innerHTML = g.list.map(x => `<button type="button" data-sg="${x.b}" title="${esc(x.full || x.name)}"${Number(x.b) === Number(g.cur) ? ' class="on"' : ''}>${esc(x.name)}</button>`).join(''); };   // v2.90: chhote NT/G1/G2
    gw.addEventListener('click', e => { const b = e.target.closest('[data-sg]'); if (!b) return; try { saleGodamHook().set(Number(b.dataset.sg)); } catch {} paintG(); if (msg) msg.textContent = `✓ Godam: ${b.title || b.textContent} — agla item yahin se`; qBox?.focus?.(); });
    gw.className = 'scan-godam scan-godam-in'; paintG(); { const row = scanBox.querySelector('.scan-find-row'); if (row) row.appendChild(gw); else (scanBox.querySelector('.scan-find') || scanBox.firstElementChild).after(gw); }   // v2.90: Pcs/Ctn ke aage isi line mein
  }
  // v2.64: PC par baayein — AAJ KE BILLS (chips: ✓ paid · ✗ baqi · ⊘ cancel · ⏳ PC · ⚠ fail) + search
  if (saleRoot() && saleBillsHook && !pickHook && window.matchMedia && window.matchMedia('(min-width:1100px)').matches) {
    const side = document.createElement('aside'); side.className = 'scan-bills';   // v2.95: sale.js mountBills (PC + app, rang, posted, edit)
    scanBox.appendChild(side); scanBox.classList.add('has-bills');
    try { scanBox._billsTimer = saleBillsHook(side); } catch (e) { console.warn('bills', e); }
  }   // v2.59: naya bill par list saaf
  // v1.64: list ki line ka ✕ — bill se bhi kat jaye
  namesBox.addEventListener('pointerdown', e => { if (e.target.closest('.scan-del,.li-g,.li-neg')) e.preventDefault(); });
  namesBox.addEventListener('click', e => {   // v2.95: line ka godam chip / ± wapsi
    const gb = e.target.closest('[data-lgk]'); if (gb) { e.stopPropagation(); try { saleLineGodamHook?.(gb.dataset.lgk, Number(gb.dataset.lgb)); } catch {} scanBox._reload?.(); msg.textContent = '✓ Godam: ' + (gb.title || gb.textContent); return; }
    const nb = e.target.closest('[data-neg]'); if (nb) { e.stopPropagation(); const k = nb.dataset.neg, it = scanItems.get(k); if (!it) return; const q = scanQty.get(k) || { pcs: 0, ctn: 0 };
      const nq = (Number(q.pcs) || Number(q.ctn)) ? { pcs: -(Number(q.pcs) || 0), ctn: -(Number(q.ctn) || 0) } : { pcs: -1, ctn: 0 };
      scanQty.set(k, nq); lastKey = k; lastScan = it; if (saleQtyHook) saleQtyHook(it, nq, k); showPad(); drawNames(true); msg.textContent = (nq.pcs < 0 || nq.ctn < 0) ? `↩ ${it.name} — WAPSI (minus)` : `✓ ${it.name} — wapis plus`; return; }
  });
  // v2.58: list ki line par tap / ↑↓ = wo line chuno -> Pcs/Ctn pad aur Tadad usi par lagein
  const pickLine = k => { if (!k || !scanItems.has(k)) return; lastKey = k; lastScan = scanItems.get(k); showPad(); drawNames(true); };
  namesBox.addEventListener('click', e => { if (e.target.closest('.scan-del,.li-in,.li-qty,.li-g,.li-neg')) return;   // v2.69: khane par tap = sirf likhna (redraw nahi)
    const li = e.target.closest('li[data-k]'); if (li) { pickLine(li.dataset.k); kbLine = true; } });
  let kbLine = false, kbNum = '';
  // v2.67: list ki line ke khane — Shift / click = wahan jao, Tab = agla khana, Enter = lagao + wapas search. Scanner ke tez hindse = naya item.
  const liFocus = k => { const box = namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in[data-u="pcs"]`) || namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in`); if (box) { box.focus(); try { box.select(); } catch {} } };
  const liApply = (inp, redraw) => { const k = inp.dataset.li; if (!k || !scanItems.has(k)) return; const it = scanItems.get(k), li = inp.closest('li');
    const val = u => { const x = li.querySelector(`.li-in[data-u="${u}"]`); return x ? Number(String(x.value).replace(/[^0-9.\-]/g, '')) || 0 : 0; };   // v2.95: minus (wapsi) bhi
    const q = { pcs: val('pcs'), ctn: Number(it.pack) > 1 ? Math.trunc(val('ctn')) : 0 };
    scanQty.set(k, q); lastKey = k; lastScan = it; if (saleQtyHook) saleQtyHook(it, q, k);
    if (redraw) { showPad(); drawNames(true); } else { const L = lineOf(it, k), sp = li.querySelector(':scope > span'); if (sp) sp.innerHTML = `${esc(L.qtxt)}${L.rate ? ` x ${num(L.rate)} = <b>${num(L.amt)}</b>` : ''}`; } };
  let liT0 = 0, liLast = 0, liN = 0;
  namesBox.addEventListener('keydown', e => { const inp = e.target.closest?.('.li-in'); if (!inp) return;
    const now = performance.now(); if (/^[0-9]$/.test(e.key)) { if (!liN || now - liLast > 300) { liT0 = now; liN = 0; } liN++; liLast = now; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation();
      const raw = String(inp.value).replace(/[^0-9]/g, '');
      if (raw.length >= 5 && liN >= 5 && (liLast - liT0) / Math.max(1, liN - 1) < 40) { inp.value = inp.defaultValue; liN = 0; feedCode(raw); qBox?.focus(); return; }   // scanner ka barcode
      liN = 0; liApply(inp, true); qBox?.focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); inp.value = inp.defaultValue; qBox?.focus(); return; }
  }, true);
  namesBox.addEventListener('input', e => { const inp = e.target.closest?.('.li-in'); if (inp) liApply(inp, false); });
  namesBox.addEventListener('focusout', e => { const inp = e.target.closest?.('.li-in'); if (inp && !namesBox.contains(e.relatedTarget)) { liApply(inp, true); } });
  namesBox.addEventListener('pointerdown', e => { if (e.target.closest('.li-in,.scan-del,.li-g,.li-neg')) return; const li = e.target.closest('li[data-k]'); if (li) { e.preventDefault(); pickLine(li.dataset.k); setTimeout(() => liFocus(li.dataset.k), 0); } });
  const lineKeys = () => [...namesBox.querySelectorAll('li[data-k]')].map(li => li.dataset.k);
  scanBox.addEventListener('keydown', e => {
    if (!saleRoot()) return;
    const inQ = document.activeElement === qBox, inN = document.activeElement === nBox;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (inQ && !hitBox.hidden && hitBox.querySelector('[data-pick]')) return;   // search ke natije pehle (app.js)
      if (inN) return;
      const ks = lineKeys(); if (!ks.length) return;
      e.preventDefault(); e.stopPropagation();
      let i = kbLine ? ks.indexOf(lastKey) : -1;
      if (e.key === 'ArrowDown') i = Math.min(ks.length - 1, i + 1); else i = i - 1;
      if (i < 0) { kbLine = false; kbNum = ''; namesBox.querySelectorAll('li').forEach(li => li.classList.remove('kbsel')); qBox.focus(); return; }
      kbLine = true; kbNum = ''; if (inQ) qBox.blur(); pickLine(ks[i]);
      namesBox.querySelector(`li[data-k="${CSS.escape(ks[i])}"]`)?.classList.add('kbsel');
      msg.textContent = `↑↓ line chuno · tadad likh kar Enter · ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'} badalne ke liye C / P`;
      return;
    }
    if (document.activeElement?.closest?.('.li-in,.scan-c')) return;   // v2.69: line ke khane / Ctn khane mein likhna — rokna nahi
    if (!kbLine || inQ || inN || !lastScan) return;
    if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); kbNum += e.key; clearTimeout(scanBox._kbT); if (kbNum.length >= 8) scanBox._kbT = setTimeout(() => { if (kbNum.length >= 8) { const c = kbNum; kbNum = ''; kbLine = false; feedCode(c); } }, 220); msg.textContent = `${lastScan.name}: ${kbNum} ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'} — Enter dabayein`; return; }   // 8+ hindse = scanner ka barcode
    if (e.key === 'Backspace') { e.preventDefault(); kbNum = kbNum.slice(0, -1); return; }
    if (e.key.toLowerCase() === 'c' && Number(lastScan.pack) > 1) { e.preventDefault(); padUnit = 'ctn'; showPad(); return; }
    if (e.key.toLowerCase() === 'p') { e.preventDefault(); padUnit = 'pcs'; showPad(); return; }
    if (e.key === 'Enter' && kbNum) {
      e.preventDefault(); e.stopPropagation();
      if (kbNum.length >= 5) { const c = kbNum; kbNum = ''; kbLine = false; clearTimeout(scanBox._kbT); feedCode(c); return; }   // barcode, tadad nahi
      const v = Number(kbNum); kbNum = ''; if (!(v >= 0)) return;
      const id = lastKey || String(lastScan.id), q = scanQty.get(id) || { pcs: 0, ctn: 0 };
      q[padUnit] = v; scanQty.set(id, q);
      if (saleQtyHook) saleQtyHook(lastScan, q, lastKey);
      showPad(); drawNames(true); namesBox.querySelector('li.now')?.classList.add('kbsel');
      msg.textContent = `✓ ${lastScan.name} — ${v} ${padUnit === 'ctn' ? 'Ctn' : 'Pcs'}`; beep(true);
    }
  }, true);
  namesBox.addEventListener('click', e => {
    const b = e.target.closest('.scan-del'); if (!b) return;
    const k = b.dataset.del;
    if (saleRoot() && saleDelHook) saleDelHook(k);
    scanOrder = scanOrder.filter(x => x !== k); scanItems.delete(k); scanQty.delete(k);
    if (!saleRoot()) scanList = scanList.filter(id => String(id) !== k);
    if (lastKey === k || !scanItems.has(lastKey)) { lastKey = scanOrder[scanOrder.length - 1] || ''; lastScan = lastKey ? scanItems.get(lastKey) : null; }
    if (navigator.vibrate) navigator.vibrate(30);
    showPad(); drawNames();
  });
  const pad = scanBox.querySelector('.scan-pad'), padName = scanBox.querySelector('.scan-pad-name');
  const showPad = () => {
    if (!lastScan) { pad.hidden = true; return; }
    pad.hidden = false;
    const q = scanQty.get(lastKey || String(lastScan.id)) || { pcs: 0, ctn: 0 };
    padName.textContent = `${lastScan.name} — ${q.ctn ? q.ctn + ' ' + (lastScan.cName || 'Ctn') + ' + ' : ''}${q.pcs || 0} ${lastScan.uName || 'Pcs'}`;
    pad.querySelectorAll('[data-unit]').forEach(b => b.classList.toggle('selected', b.dataset.unit === padUnit));
    pad.querySelector('[data-unit="ctn"]').hidden = !(Number(lastScan.pack) > 1);
  };
  pad.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !lastScan) return;
    if (b.dataset.unit) { padUnit = b.dataset.unit; showPad(); return; }
    const id = lastKey || String(lastScan.id), q = scanQty.get(id) || { pcs: 0, ctn: 0 };
    const v = b.dataset.qty;
    if (v === '+1') q[padUnit] = (Number(q[padUnit]) || 0) + 1; else q[padUnit] = Number(v);
    scanQty.set(id, q);
    if (saleRoot() && saleQtyHook) saleQtyHook(lastScan, q, lastKey);
    if (navigator.vibrate) navigator.vibrate(30);
    showPad(); drawNames();
  });
  // camera ki screen par search: naam ya code se item add
  const qBox = scanBox.querySelector('.scan-q'), hitBox = scanBox.querySelector('.scan-hits'), nBox = scanBox.querySelector('.scan-n');
  let chosen = null;   // v1.59: search se chuna hua item, tadad ka intezar
  const uBtn = scanBox.querySelector('.scan-u');
  let nUnit = 'pcs';   // v1.60: Tadad ki ikai — hamesha Pcs se shuru, tap par Ctn
  const setUnit = (u, it) => {
    const canCtn = Number((it || chosen)?.pack) > 1;
    nUnit = canCtn ? u : 'pcs';
    uBtn.textContent = nUnit === 'ctn' ? ((it || chosen)?.cName || 'Ctn') : ((it || chosen)?.uName || 'Pcs');
    uBtn.classList.toggle('ctn', nUnit === 'ctn');
    uBtn.disabled = !canCtn;
    const cB = scanBox?.querySelector('.scan-c'); if (cB) { cB.disabled = !!(it || chosen) && !canCtn; cB.placeholder = (it || chosen)?.cName || 'Ctn'; }   // v2.69
    if (nBox) nBox.placeholder = (it || chosen)?.uName || 'Pcs';
  };
  uBtn.addEventListener('pointerdown', e => e.preventDefault());   // keyboard band na ho
  uBtn.onclick = () => { setUnit(nUnit === 'pcs' ? 'ctn' : 'pcs'); nBox.focus(); };
  setUnit('pcs', null);
  // v1.60: kuch phones par awaz tab chalu hoti hai jab screen chhui jaye
  scanBox.addEventListener('pointerdown', () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state !== 'running') audioCtx.resume(); } catch {} }, true);
  const scanSearch = () => {
    chosen = null;
    const q = String(qBox.value || '').toLowerCase().trim();
    if (!q) { hitBox.hidden = true; hitBox.innerHTML = ''; return; }
    const src = saleRoot() && saleFindHook ? saleFindHook(q) : smartSearch(items, q, 12);   // v1.75
    hitBox.hidden = false;
    hitBox.innerHTML = src.length ? src.map((r, i) => `<button type="button" data-pick="${i}"><b>${esc(r.name)}</b><small>${r.stock != null ? 'stock ' + num(r.stock) : ''}</small>${hitCodes(r)}${hitRates(r)}</button>`).join('') : '<p class="stat-note">Nahi mila</p>';
    hitBox._src = src;
  };
  showPad();   // v1.57: dobara kholne par aakhri item ki tadad fauran nazar aaye
  qBox.oninput = scanSearch;
  // v2.53: USB scanner (ya haath se poora barcode) is khane mein aaye to camera jaisa hi lagao — "Nahi mila" nahi
  const feedCode = code => {
    const r = addScanned(code);
    if (!r.state) { msg.textContent = `"${code}" stock mein nahi mila`; beep(false); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); return; }
    lastScan = r.item; const k = String(r.line || r.item.id); lastKey = k;
    if (r.pcs != null) scanQty.set(k, { pcs: Number(r.pcs) || 0, ctn: Number(r.ctn) || 0 }); else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 });
    if (!scanItems.has(k)) { scanItems.set(k, r.item); scanOrder.push(k); }
    showPad(); drawNames();
    msg.textContent = r.state === 'added' ? `✓ ${r.item.name} — tadad chunein ya agla scan karein` : `${r.item.name} pehle se list mein`;
    beep(true); if (navigator.vibrate) navigator.vibrate(80);
  };
  // v2.67: search mein akela SHIFT = neeche abhi wali line ke tadad ke khane mein (Tab = Ctn / agli line)
  { let shiftAlone = false;
    qBox.addEventListener('keydown', e => { if (e.key === 'Shift') shiftAlone = true; else shiftAlone = false; });
    qBox.addEventListener('keyup', e => { if (e.key !== 'Shift' || !shiftAlone) return; shiftAlone = false; if (!saleRoot()) return; const k = (lastKey && scanItems.has(lastKey)) ? lastKey : namesBox.querySelector('li[data-k]')?.dataset.k; if (!k) return; hitBox.hidden = true; pickLine(k); setTimeout(() => { const box = namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in[data-u="pcs"]`) || namesBox.querySelector(`li[data-k="${CSS.escape(k)}"] .li-in`); if (box) { box.focus(); try { box.select(); } catch {} } }, 0); });
  }
  const codeLike = v => /^[0-9]{6,}$/.test(v) || (v.length >= 1 && !/\s/.test(v) && !!findByCode(v));   // v2.55 / v2.60: chhota sub-code (jaise "99") pehle barcode samjho, naam-search baad mein
  qBox.addEventListener('input', () => { const v = String(qBox.value || '').trim(); if (/^[0-9]{8,}$/.test(v) && findByCode(v)) { clearTimeout(qBox._ft); qBox._ft = setTimeout(() => { if (String(qBox.value || '').trim() === v) { qBox.value = ''; hitBox.hidden = true; chosen = null; feedCode(v); } }, 140); } });   // Enter na bhejne wala scanner
  qBox.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = String(qBox.value || '').trim(); if (codeLike(v)) { clearTimeout(qBox._ft); qBox.value = ''; hitBox.hidden = true; chosen = null; feedCode(v); return; } if (chosen) { nBox.focus(); return; } const r = (hitBox._src || [])[0]; if (r) pickHit(r); } };
  // v1.59 (sale): item chunne par seedha add nahi — cursor "Tadad" mein; wahan Enter par add, phir cursor wapas search mein
  const pickHit = r => {
    if (pickHook && pickMulti) {   // v2.41: transfer note — search se chuna item bhi scan ki tarah list mein
      qBox.value = ''; hitBox.hidden = true;
      let res = null; try { res = pickHook(String(r.code || r.bc?.[0] || ''), r); } catch {}
      const ok = !!(res && res.ok); beep(ok); if (ok && navigator.vibrate) navigator.vibrate(60);
      if (msg) msg.innerHTML = res?.text || (ok ? '✓' : 'nahi mila'); const c = scanBox?.querySelector('.scan-done span'); if (c && res?.count != null) c.textContent = res.count;
      qBox.focus(); return;
    }
    if (saleRoot() && saleHook) {
      chosen = r; qBox.value = r.name; hitBox.hidden = true; nBox.value = ''; setUnit('pcs', r);
      msg.textContent = `${r.name} — tadad likh kar Enter dabayein (khali = 1)`;
      nBox.focus();
      return;
    }
    addHit(r, 0);
  };
  const addHit = (r, qty) => {
    qBox.value = ''; hitBox.hidden = true;
    if (saleRoot() && saleHook) { const res = saleHook(String(r.code || r.bc?.[0] || r.name), r, qty); if (res && res.item) { const k = String(res.line || res.item.id); lastScan = res.item; lastKey = k; if (res.pcs != null) scanQty.set(k, { pcs: Number(res.pcs) || 0, ctn: Number(res.ctn) || 0 }); else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 }); if (!scanItems.has(k)) { scanItems.set(k, res.item); scanOrder.push(k); } showPad(); drawNames(); } return; }
    addScanned(String(r.code || r.id)); drawNames();
  };
  nBox.onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!chosen) { const r = (hitBox._src || [])[0]; if (!r) { qBox.focus(); return; } chosen = r; setUnit('pcs', r); }
    const cBox = scanBox.querySelector('.scan-c');   // v2.69: upar Pcs + Ctn dono khane
    let q = Number(String(nBox.value || '').replace(',', '.').trim()) || 0, cq = Math.floor(Number(String(cBox?.value || '').replace(',', '.').trim()) || 0);
    const r = chosen, pk = Number(r.pack) || 0;
    if (!(pk > 1)) cq = 0;
    if (!(q > 0) && !(cq > 0)) q = 1;
    chosen = null; nBox.value = ''; if (cBox) cBox.value = '';
    addHit(r, cq * pk + q);   // Ctn = pack se zarb (bill khud carton mein badal deta hai)
    beep(true);
    msg.textContent = `✓ ${r.name} — ${cq ? cq + ' ' + (r.cName || 'Ctn') + (q ? ' + ' : '') : ''}${q ? num(q) + ' ' + (r.uName || 'Pcs') : ''} · agla item likhein`;
    setUnit('pcs', null);
    qBox.focus();
  };
  { const cB = scanBox.querySelector('.scan-c'); if (cB) cB.onkeydown = e => { if (e.key === 'Enter') nBox.onkeydown(e); }; }   // v2.69: Ctn khane mein Enter bhi wahi
  hitBox.addEventListener('pointerdown', e => e.preventDefault());   // list par tap se keyboard band na ho
  hitBox.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; const r = (hitBox._src || [])[Number(b.dataset.pick)]; if (r) pickHit(r); });
  scanBox.querySelector('.scan-done').onclick = finishScan;
  scanBox.querySelector('.scan-close').onclick = finishScan;
  const video = scanBox.querySelector('video');

  // Sahi lens chunna: phone ke peeche kai camera hote hain (wide/macro mein focus nahi hota) — main camera dhoondo
  const pickCamera = async () => {
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch {}
    const saved = localStorage.getItem('sam-scan-cam');
    if (saved && devs.some(d => d.deviceId === saved)) return { deviceId: { exact: saved } };
    const back = devs.filter(d => /back|rear|environment|پیچھے/i.test(d.label));
    const main = back.find(d => !/wide|ultra|macro|tele|depth|bokeh/i.test(d.label)) || back[0];
    return main ? { deviceId: { exact: main.deviceId } } : { facingMode: { ideal: 'environment' } };
  };
  if (scanCamOff || !hasCam) {   // v2.40: camera band — scanner / search se kaam, video nahi · v2.77: camera hai hi nahi (PC)
    scanBox.classList.add('cam-off');   // v2.56: camera band = safed screen
    if (!hasCam) scanBox.classList.add('no-cam');
    const msg0 = scanBox.querySelector('.scan-msg'); if (msg0) msg0.textContent = hasCam ? 'Camera band hai — barcode gun ya naam/code se item lagayein. Chalu karne ke liye 📷 dabayein.' : '🔫 Is PC par camera nahi — barcode scanner gun se scan karein, ya naam / code likh kar Enter.';
    const tools0 = document.createElement('div'); tools0.className = 'scan-tools';
    if (hasCam) camOffBtn(tools0); else { const g = document.createElement('span'); g.className = 'gun-chip'; g.textContent = '🔫 Scanner gun tayyar'; tools0.appendChild(g); }
    (scanBox.querySelector('.scan-left') || msg0).append(tools0);
    setTimeout(() => scanBox?.querySelector('.scan-q')?.focus(), 60);
    const v0 = scanBox.querySelector('video'); if (v0) v0.style.display = 'none';
    return;
  }
  try {
    // pehle ijazat (labels tabhi milte hain), phir sahi camera
    let cam = await pickCamera();
    if (!cam.deviceId) {
      const tmp = await gumT({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      tmp.getTracks().forEach(t => t.stop());
      cam = await pickCamera();
    }
    scanStream = await gumT({
      video: { ...cam, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 }, advanced: [{ focusMode: 'continuous' }] }, audio: false
    });
  } catch (e) {
    closeScanner();
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' || /device not found/i.test(e?.message || '')) {   // v2.77: camera mila hi nahi -> scanner gun
      noCam = true; try { localStorage.setItem('sam-nocam', '1'); } catch {}
      if (!await camCheck()) { setTimeout(openScanner, 200); return; }
    }
    if (e?.name === 'Timeout' && camRetry < 1) {   // ek dafa khud dobara (yaad kiya lens bhool kar)
      camRetry++; try { localStorage.removeItem('sam-scan-cam'); } catch {}
      setTimeout(openScanner, 600); return;
    }
    notice('Camera nahi khula: ' + (e?.name === 'NotAllowedError' ? 'camera ki ijazat dein (browser settings)'
      : e?.name === 'Timeout' || e?.name === 'NotReadableError' ? 'camera kahin aur khula hai — Chrome ke doosre tabs / doosri apps (call, camera) band karke dobara kholein'
      : (e?.message || e)));
    return;
  }
  if (!scanBox) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; return; }
  video.srcObject = scanStream;
  try { await video.play(); } catch {}
  // v1.57: kuch phones par band karke foran dobara kholne se camera kaala rehta hai.
  // 1.5 sec mein tasveer na aaye to camera khud dobara chalu (doosri dafa mein yaad kiya hua lens bhi bhool jao).
  setTimeout(() => {
    if (!scanBox || scanBox.querySelector('video') !== video) return;
    if (video.videoWidth > 0) { camRetry = 0; return; }
    if (camRetry < 2) {
      camRetry++;
      if (camRetry === 2) { try { localStorage.removeItem('sam-scan-cam'); } catch {} }
      closeScanner(); setTimeout(openScanner, 500);
    } else msg.textContent = 'Camera ki tasveer nahi aa rahi — 🔄 Camera dabayein, ya band karke dobara kholein';
  }, 1500);
  // Tez scan: continuous focus, aur zoom / torch ke buttons (chhote barcode ke liye)
  const track = scanStream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() || {};
  try { if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {}
  const tools = document.createElement('div'); tools.className = 'scan-tools';
  if (caps.zoom) {
    let z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, (track.getSettings().zoom || 1)));
    const setZ = async v => { z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, v)); try { await track.applyConstraints({ advanced: [{ zoom: z }] }); } catch {} zb.textContent = `🔍 ${z.toFixed(1)}x`; };
    const zb = document.createElement('button'); zb.type = 'button'; zb.textContent = `🔍 ${z.toFixed(1)}x`;
    zb.onclick = () => setZ(z + 1 > caps.zoom.max ? caps.zoom.min : z + (caps.zoom.step || 1));
    tools.appendChild(zb);
    setZ(caps.zoom.min || 1);   // default 1x (zoom se tasveer dhundli ho sakti hai)
  }
  // 🎯 Focus: camera ko dobara focus karne par majboor karo (single-shot -> continuous)
  const refocus = async () => {
    try {
      if (caps.focusMode?.includes('single-shot')) { await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }); await new Promise(r => setTimeout(r, 400)); }
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      else if (caps.focusMode?.includes('auto')) await track.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
      msg.textContent = 'Focus ho raha hai… barcode ko 12-15 cm door, seedha rakhein';
    } catch {}
  };
  const fb = document.createElement('button'); fb.type = 'button'; fb.textContent = '🎯 Focus'; fb.onclick = refocus;
  tools.prepend(fb);
  // 🔄 Camera badlein: agla lens (jo theek chale woh yaad rahega)
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    if (devs.length > 1) {
      const cb = document.createElement('button'); cb.type = 'button'; cb.textContent = `🔄 Camera (${devs.length})`;
      cb.onclick = () => {
        const cur = track.getSettings().deviceId;
        const i = devs.findIndex(d => d.deviceId === cur);
        const next = devs[(i + 1) % devs.length];
        localStorage.setItem('sam-scan-cam', next.deviceId);
        closeScanner(); openScanner();
      };
      tools.appendChild(cb);
      msg.textContent = `Camera: ${track.label || 'main'} — dhundla ho to 🔄 se badlein`;
    }
  } catch {}
  camOffBtn(tools);   // v2.40: 🔄 Camera ke neeche 📷 Camera band
  video.addEventListener('click', refocus);
  if (caps.torch) {
    let on = false; const tb = document.createElement('button'); tb.type = 'button'; tb.textContent = '🔦 Light';
    tb.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); } catch {} tb.textContent = on ? '🔦 Light ON' : '🔦 Light'; };
    tools.appendChild(tb);
  }
  if (tools.children.length) (scanBox.querySelector('.scan-left') || msg).append(tools);   // v1.63: camera ke buttons LEFT patti mein

  const loop = async () => {
    if (!scanBox) return;
    let wait = 0;
    if (!scanBusy && video.readyState >= 2) {
      scanBusy = true;
      try {
        const found = await detector.detect(video);
        const code = found.map(f => String(f.rawValue || '').trim()).find(Boolean);
        const now = Date.now();
        // v1.62: jab tak wahi barcode camera ke saamne hai, dobara na gino (warna har 1.5 sec nayi line banti)
        if (code && code === lastCode && now - lastCodeAt < 1500) lastCodeAt = now;
        if (code && pickHook && pickMulti) {   // v2.17: camera khula — har naya code list mein
          if (!(code === lastCode && now - lastCodeAt < 1500)) {
            lastCode = code; lastCodeAt = now;
            let res = null; try { res = pickHook(code); } catch {}
            const ok = !!(res && res.ok);
            beep(ok); if (ok && navigator.vibrate) navigator.vibrate(60);
            const m = scanBox?.querySelector('.scan-msg'); if (m) m.innerHTML = res?.text || (ok ? '✓' : '"' + code + '" nahi mila');
            const c = scanBox?.querySelector('.scan-done span'); if (c && res?.count != null) c.textContent = res.count;
          }
        } else
        if (code && pickHook) { const cb = pickHook; pickHook = null; beep(true); if (navigator.vibrate) navigator.vibrate(60); finishScan(); try { cb(code); } catch {} return; }
        if (code && !(code === lastCode && now - lastCodeAt < 1500)) {   // wahi barcode dobara foran na gine
          const r = addScanned(code);
          if (r.state) { lastCode = code; lastCodeAt = now; lastGoodAt = now; badCode = ''; badN = 0; }
          else {
            // v1.56: camera kabhi ek-do frame ghalat parhta hai. "Nahi mila" tabhi jab wahi code 3 dafa lagataar aaye
            // aur abhi (2.5 sec) koi sahi item add na hua ho — warna chupchaap agla frame dekho.
            if (code === badCode) badN++; else { badCode = code; badN = 1; }
            if (badN < 3 || now - lastGoodAt < 2500) { scanBusy = false; scanTimer = setTimeout(loop, 60); return; }
            badN = 0; lastCode = code; lastCodeAt = now;
          }
          if (r.state === 'added' || r.state === 'again') { lastScan = r.item; const k = String(r.line || r.item.id); lastKey = k;   // v1.62: sale mein har scan nayi line
            if (r.pcs != null) scanQty.set(k, { pcs: Number(r.pcs) || 0, ctn: Number(r.ctn) || 0 });   // v1.58: bill wali asal tadad
            else if (!scanQty.has(k)) scanQty.set(k, { pcs: 1, ctn: 0 });
            if (!scanItems.has(k)) { scanItems.set(k, r.item); scanOrder.push(k); }
            showPad(); drawNames(); }
          if (r.state === 'added') {
            msg.textContent = `✓ ${r.item.name} — tadad neeche se chunein ya agla scan karein`;
            beep(true);
            if (navigator.vibrate) navigator.vibrate(80);
            drawNames();
            wait = 350;
          } else if (r.state === 'again') {
            msg.textContent = `"${r.item.name}" pehle se list mein hai`;
            beep(true);
            if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
            wait = 350;
          } else {
            msg.textContent = `"${code}" stock mein nahi mila — doosra scan karein`;
            beep(false);
            if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
            wait = 700;
          }
        }
      } catch {}
      scanBusy = false;
    }
    scanTimer = wait ? setTimeout(loop, wait) : requestAnimationFrame(loop);
  };
  loop();
}

function focusItem(item) {
  const id = CSS.escape(String(item.id));
  const row = document.querySelector(`[data-stock-row="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const box = Number(item.pack) > 1
    ? row.querySelector(`[data-count-ctn="${id}"]`)
    : row.querySelector(`[data-count-tot="${id}"]`);
  if (box) { box.focus({ preventScroll: true }); try { box.select(); } catch {} }
}


// ============================================================
//  USB / Bluetooth BARCODE SCANNER (keyboard ki tarah likhta hai)
//  Mobile (OTG) ya PC — bohat tez aane wale akshar + Enter/Tab = barcode.
//  Kisi bhi khane mein cursor ho, barcode wahan nahi likha jata; item scan list mein judta hai.
// ============================================================
let kbBuf = '', kbFirst = 0, kbLast = 0, kbTarget = null, kbStartVal = null, kbTimer = null;
const KB_GAP = 90;          // is se zyada ms ka faasla = insaan likh raha hai (v2.52: 50 -> 90, aahista USB scanner bhi)
function kbReset() { kbBuf = ''; kbTarget = null; kbStartVal = null; clearTimeout(kbTimer); kbTimer = null; }
function kbIsScan(now) {
  const n = kbBuf.length;
  return n >= 4 && (kbLast - kbFirst) / Math.max(1, n - 1) < 60 && now - kbLast < 220;   // v2.52: 35ms -> 60ms fi akshar
}
function kbFinish() {
  const code = kbBuf.trim();
  const target = kbTarget, startVal = kbStartVal;
  kbReset();
  // jo akshar kisi khane mein chale gaye, hata do
  if (target && startVal !== null && 'value' in target) {
    target.value = startVal;
    if (target === $('search')) target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const trq = !saleRoot() && document.querySelector('#dialog[open] [data-tr-q]');   // v2.52: transfer note khula ho to code wahan
  if (trq) { trq.value = code; trq.dispatchEvent(new Event('input', { bubbles: true })); return; }
  hardScan(code);
}
document.addEventListener('keydown', e => {
  const onStock = stockActive && !saleRoot() && !!document.querySelector('.stock-head');
  const onTr = !!document.querySelector('#dialog[open] [data-tr-q]');
  if ((!onStock && !saleRoot() && !onTr) || scanBox || e.ctrlKey || e.altKey || e.metaKey) return;
  const now = performance.now();
  if (e.key.length === 1) {
    if (!kbBuf || now - kbLast > KB_GAP) {
      kbBuf = ''; kbFirst = now;
      kbTarget = e.target;
      kbStartVal = e.target && 'value' in e.target ? e.target.value : null;
    }
    kbBuf += e.key; kbLast = now;
    clearTimeout(kbTimer);
    kbTimer = setTimeout(() => { if (kbIsScan(performance.now() - 60)) kbFinish(); else kbReset(); }, 200);   // scanner jo Enter na bheje
    return;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && kbBuf) {
    if (kbIsScan(now)) { e.preventDefault(); e.stopImmediatePropagation(); kbFinish(); }
    else kbReset();
  }
}, true);

function hardScan(code) {
  if (!code) return;
  if (saleRoot()) {
    const r = saleHook ? saleHook(code) : { state: null };
    if (!r.state) { notice(`"${code}" stock mein nahi mila`); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); }
    else if (navigator.vibrate) navigator.vibrate(80);
    return;
  }
  const r = addScanned(code);
  if (!r.state) {
    notice(`"${code}" stock mein nahi mila`);
    if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
    return;
  }
  if (navigator.vibrate) navigator.vibrate(r.state === 'added' ? 80 : [40, 40, 40]);
  notice(r.state === 'added' ? `✓ ${r.item.name} (list mein ${scanList.length})` : `${r.item.name} pehle se list mein hai`);
  rerender();
  setTimeout(() => focusItem(r.item), 80);
}

// v1.75: alias save (malik) — likhne ke 1 sec baad
let aliasT = null;
document.addEventListener('input', e => {
  const t = e.target; if (!t.matches?.('[data-alias-item]')) return;
  clearTimeout(aliasT);
  aliasT = setTimeout(() => { cloud?.setAlias?.(t.dataset.aliasItem, t.value).then(() => notice('✓ Doosre naam save')).catch(er => notice('Nahi hua: ' + (er?.message || er))); }, 1200);
});

// v2.54: Esc = camera / scanner screen band
document.addEventListener('keydown', e => { if (e.key === 'Escape' && scanBox && !document.querySelector('#dialog[open]')) { e.preventDefault(); finishScan(); } });

// v2.59: bill save ho gaya -> scanner screen khuli ho to list saaf, search par cursor (naya bill)
export function scanNewBill() { if (!scanBox) return false; scanOrder = []; scanItems.clear(); scanQty.clear(); lastScan = null; lastKey = ''; saleSeen = []; scanBox._redraw?.(); const m = scanBox.querySelector('.scan-msg'); if (m) m.textContent = '✓ Bill save — naya bill: agla item scan karein'; const q = scanBox.querySelector('.scan-q'); if (q) { q.value = ''; setTimeout(() => q.focus(), 30); } return true; }

// ---------- v2.99.8: 🤖 NOOR AGENT — stock dekhna / rate badalna / naya item / godam transfer ----------
// Malik: "agent mein stock, sale, transfer, notes sab joro — bol kar rate change, purchase ke items bol kar chunwao".
// Sab WAHI raaste jo Stock screen ke (requestItem / requestTransfer -> PC). Item dhoondna: naam (Roman), Urdu naam (AI wala), barcode.
let agP = null, agKey = null, agUr = null;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
function agPool() {
  if (agP && agKey === rows && agUr === urdu) return agP;
  const { branches, names } = collect();
  const main = branches.includes(1) ? 1 : branches[0];
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items)), byId = new Map();
  for (const b of [main, ...branches.filter(x => x !== main)]) for (const c of chunks.filter(c => c.branch === b).sort((x, y) => (x.order || 0) - (y.order || 0))) for (const it of c.items) if (it && it.id != null && !byId.has(String(it.id))) byId.set(String(it.id), it);
  const list = [...byId.values()];
  const urList = Object.entries(urdu || {}).map(([id, ur]) => ({ id: 'u' + id, name: ur, _r: byId.get(String(id)) })).filter(x => x._r);
  agP = { list, byId, urList, branches: branches.filter(b => b !== JAMA), names, main }; agKey = rows; agUr = urdu;
  return agP;
}
export async function stockAgentReady(ms = 15000) {
  start(false);
  const t0 = Date.now();
  while (!loaded && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 120));
  if (failed) throw Error('Stock load nahi hua: ' + failed);
  if (!loaded) throw Error('Stock abhi load nahi hua (internet?) — thori der baad dobara poochein');
  return true;
}
export function stockAgentGodams() { const P = agPool(); return P.branches.map(b => ({ id: b, name: branchName(b, P.names), dukan: b === P.main })); }
const agCodes = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
const agQtyTxt = (s, pk, cn = 'Ctn', un = 'Pcs') => { s = r2(s); if (pk > 1) { const neg = s < 0, a = Math.abs(s), c = Math.floor(a / pk + 1e-9), p = r2(a - c * pk); return (neg ? '-' : '') + (c ? num(c) + ' ' + cn + (p ? ' + ' : '') : '') + (p || !c ? num(p) + ' ' + un : ''); } return num(s) + ' ' + un; };
export function stockAgentItem(id, { cost = true } = {}) {
  const P = agPool(), r = P.byId.get(String(id)); if (!r) return null;
  const pk = Number(r.pack) > 1 ? Number(r.pack) : 0, cn = r.cName || 'Ctn', un = r.uName || 'Pcs';
  const per = P.branches.map(b => ({ godam_id: b, godam: branchName(b, P.names), dukan: b === P.main, pcs: r2(Number(saleStockItem(b, r.id)?.stock) || 0) }))
    .filter(x => Math.abs(x.pcs) > 0.0005 || x.dukan).map(x => ({ ...x, text: agQtyTxt(x.pcs, pk, cn, un) }));
  const total = r2(per.reduce((n, x) => n + x.pcs, 0));
  const rp = Number(r.rate) || 0, wp = Number(r.wrate) || 0;
  const out = { item_id: String(r.id), name: r.name, code: r.code || '', urdu: urduOf(r.id), pack: pk || 1, ctn_naam: cn, pcs_naam: un,
    stock: per, stock_kul_pcs: total, stock_kul: agQtyTxt(total, pk, cn, un), band: !!hidden[String(r.id)],
    rate: { parchoon_ctn: pk ? ctnR(rp, pk) : 0, parchoon_pcs: r2(Number(r.rate2) || rp), wholesale_ctn: pk ? ctnR(wp || rp, pk) : 0, wholesale_pcs: r2(Number(r.ws) || wp || rp),
      ...(cost ? { khareed_ctn: pk ? ctnR(Number(r.prate) || 0, pk) : r2(r.prate), khareed_pcs: r2(Number(r.prate) || 0) } : {}) },
    // Sale screen jaisa bhao (sale.js rateFor / crateFor) — fi piece
    _sale: { wc: r2(wp || rp), wp: r2(wp || rp), cc: r2(rp), cp: r2(Number(r.rate2) || rp) } };
  return out;
}
export function stockAgentFind(query, alt = [], n = 6, opt = {}) {
  const P = agPool(), qs = [query, ...(Array.isArray(alt) ? alt : [])].map(s => String(s || '').trim()).filter(Boolean).slice(0, 5);
  if (!qs.length) return { decision: 'nahi_mila', note: 'naam khali' };
  const out = x => stockAgentItem(x.id, opt);
  for (const s of qs) {   // barcode bilkul
    const c = s.replace(/\s/g, ''); if (!/^\d{5,}$/.test(c)) continue;
    const hit = P.list.filter(r => agCodes(r).some(x => x === c || x.replace(/^0+/, '') === c.replace(/^0+/, '')));
    if (hit.length === 1) return { decision: 'pakka', item_id: String(hit[0].id), how: 'barcode', candidates: [out(hit[0])] };
  }
  const found = [];
  for (const s of qs) {
    const res = /[؀-ۿ]/.test(s) ? smartSearch(P.urList, s, n * 2).map(x => x._r) : smartSearch(P.list, s, n * 2);
    for (const r of res) if (r && !found.includes(r)) found.push(r);
  }
  if (!found.length) return { decision: 'nahi_mila', searched: qs };
  const fq = qs.map(s => fold(s)), exact = found.filter(r => fq.includes(fold(r.name)) || fq.includes(fold(urduOf(r.id))));
  let id = '';
  if (exact.length === 1) id = String(exact[0].id);
  else if (found.length === 1) id = String(found[0].id);
  else { const st = found.filter(r => fq.some(q => q && (fold(r.name) + ' ').startsWith(q + ' '))); if (st.length === 1) id = String(st[0].id); }
  return { decision: id ? 'pakka' : 'poochna', ...(id ? { item_id: id } : {}), candidates: found.slice(0, n).map(out) };
}
export const stockAgentCanEdit = () => canEditItem();
// rate badalna / naya item — itemSave jaisa job (POS fi PIECE rakhta hai; CTN = fi piece × pack)
export async function stockAgentItemSave(id, patch = {}) {
  if (!canEditItem()) throw Error('Rate / item sirf malik badal sakta hai (ya malik Stock screen par "Mulazim item aur rates badal sake" on kare)');
  if (!cloud?.requestItem) throw Error('Item ke liye app update karein');
  const isNew = !id, r = isNew ? null : agPool().byId.get(String(id));
  if (!isNew && !r) throw Error('Item nahi mila');
  const pk1 = Number(r?.pack) > 1 ? Number(r.pack) : 0;
  const v = { name: r?.name || '', code: r?.code || '', pack: Number(r?.pack) || 0, costP: Number(r?.prate) || 0, rpcs: Number(r?.rate2) || Number(r?.rate) || 0,
    rctn: (pk1 ? ctnR(Number(r?.rate) || 0, pk1) : 0) || 0, wpcs: Number(r?.ws) || Number(r?.wrate) || 0, wctn: (pk1 ? ctnR(Number(r?.wrate) || 0, pk1) : 0) || 0 };
  const P = {}; for (const k of ['name', 'code', 'pack', 'costC', 'costP', 'rctn', 'rpcs', 'wctn', 'wpcs']) if (patch[k] != null && patch[k] !== '') P[k] = k === 'name' || k === 'code' ? String(patch[k]).trim() : Math.max(0, Number(patch[k]) || 0);
  Object.assign(v, P);
  const pk = Number(v.pack) > 0 ? Number(v.pack) : 1;
  if (pk > 1) { if (!(v.rctn > 0) && v.rpcs > 0 && isNew) v.rctn = r2(v.rpcs * pk); if (!(v.wctn > 0) && v.wpcs > 0 && isNew) v.wctn = r2(v.wpcs * pk); }
  if (P.costC > 0 && !(P.costP > 0)) v.costP = Math.abs(r2(P.costC / pk) * pk - P.costC) <= 0.005 * pk + 1e-6 ? r2(P.costC / pk) : Math.round(P.costC / pk * 10000) / 10000;
  if (pk > 1 && P.costC > 0 && v.costP > 0 && Math.abs(v.costP * pk - P.costC) <= 0.005 * pk + 1e-6) v.costP = Math.round(P.costC / pk * 10000) / 10000;
  if (!v.name) throw Error('Item ka naam chahiye');
  const job = { op: isNew ? 'new' : 'edit', itemId: isNew ? '' : String(r.id), code: v.code, name: v.name, pack: v.pack, costP: v.costP, rctn: v.rctn, rpcs: v.rpcs, wctn: v.wctn, wpcs: v.wpcs };
  if (!isNew) job.subs = labelRows(r).filter(x => !x.main).map(x => ({ b: x.code, q: x.qty, r: x.rate || 0, s: x.show !== false }));
  const jid = await cloud.requestItem(job);
  return await new Promise(res => {
    let stopW = null, done = false;
    const end = x => { if (done) return; done = true; try { stopW && stopW(); } catch {} if (x.ok) rerender(); res(x); };
    stopW = cloud.watchItem ? cloud.watchItem(jid, j => { if (!j) return; if (j.status === 'done') end({ ok: true, code: j.code || '' }); else if (j.status === 'failed') end({ ok: false, why: j.error || 'nakam' }); }) : null;
    setTimeout(() => end({ ok: false, pending: true, why: 'PC se 45 second mein jawab nahi aaya — hukum mehfooz hai, PC (item-post) on hote hi POS mein lag jayega' }), 45000);
  });
}
// godam se godam — trSave jaisa (dukan / branch 1 ke ilawa "se" godam mein stock kam ho to mana)
export async function stockAgentTransfer({ from, to, lines, note = '' }) {
  if (!cloud?.requestTransfer) throw Error('Transfer ke liye app update karein');
  const P = agPool(); from = Number(from); to = Number(to);
  if (!P.branches.includes(from) || !P.branches.includes(to)) throw Error('Godam samajh nahi aaya');
  if (from === to) throw Error('"Se" aur "Ko" alag godam hon');
  const L = (lines || []).map(x => {
    const it = P.byId.get(String(x.id)); if (!it) throw Error('Item nahi mila: ' + (x.name || x.id));
    const pk = Number(it.pack) > 1 ? Number(it.pack) : 0, ctn = pk ? Math.max(0, Number(x.ctn) || 0) : 0, pcs = Math.max(0, Number(x.pcs) || 0) + (pk ? 0 : Math.max(0, Number(x.ctn) || 0));
    const qty = r3(ctn * pk + pcs); if (!(qty > 0)) throw Error('Tadad 0 — ' + it.name);
    return { itemId: it.id, name: it.name, qty, ctn, pcs, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs' };
  });
  if (!L.length) throw Error('Koi item nahi');
  const short = from !== 1 ? L.filter(l => trStockOf(from, l.itemId) < l.qty - 0.0005) : [];
  if (short.length) throw Error('⛔ ' + branchName(from, P.names) + ' mein stock kam: ' + short.map(l => l.name + ' (stock ' + num(trStockOf(from, l.itemId)) + ')').join(', '));
  const jid = await cloud.requestTransfer({ op: 'create', copies: trCopies, from, to, lines: L, note: String(note || '').slice(0, 300), byName: '' });
  return await new Promise(res => {
    let stopW = null, done = false;
    const end = x => { if (done) return; done = true; try { stopW && stopW(); } catch {} res(x); };
    stopW = cloud.watchTransfer ? cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end({ ok: true, no: j.transferNo || '' }); else if (j.status === 'failed') end({ ok: false, why: j.error || 'masla' }); }) : null;
    setTimeout(() => end({ ok: false, pending: true, why: 'PC se 45 second mein jawab nahi aaya — hukum mehfooz hai (transfer-sync on hote hi banega)' }), 45000);
  });
}
// v2.99.10: 🎤 awaz ke liye naam (Gemini ko "yeh naam hain" — sahi spelling pakre): zyada chalne wale + dukan mein stock wale
export function stockAgentNames(n = 350) {
  start(false);
  const P = agPool(); if (!P.list.length) return [];
  const out = new Set(topItems(P.list, Math.min(150, n)).map(r => r.name));
  for (const c of rows) { if (c.meta || c.branch !== P.main || !Array.isArray(c.items)) continue; for (const r of c.items) { if (out.size >= n) break; if ((Number(r.stock) || 0) > 0 && !hidden[String(r.id)]) out.add(r.name); } }
  return [...out].filter(Boolean).slice(0, n);
}
