// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

import { smartSearch, setAliases, aliasOf } from './smart-search.js?v=2.0.0';
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
export function stockSetup(opts) {
  if (!aliasStop && opts?.cloud?.listenAliases) aliasStop = opts.cloud.listenAliases(m => setAliases(m));   // v1.75: doosre naam
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

function start(withCounts = true) {
  if (!cloud) return;
  if (!stop) {
    loaded = false; failed = '';
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
export function setSaleDelHook(fn) { saleDelHook = fn; }   // v1.64: camera ki list se line katna
export function setSaleCartHook(fn) { saleCartHook = fn; }
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
const saleRoot = () => !!document.querySelector('[data-sale-root],[data-pp-root]');   // v1.86: POS Purchase screen bhi

// ---------- data ----------

function collect() {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const pick = branches.includes(branch) ? branch : (branches.includes(1) ? 1 : branches[0]);   // v1.67: shuru mein NOOR TRADERS (branch 1)
  const items = chunks
    .filter(c => c.branch === pick)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap(c => c.items);
  const meta = rows.find(r => r.meta && r.branch === pick) || null;
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  return { branches, pick, items, meta, names };
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
  const { branches, pick, items, meta, names } = collect();
  pickedBranch = pick;

  $('actions').innerHTML = '';
  $('summary').innerHTML = summaryHTML(branches, pick, items, meta, names);

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
        <button class="sh-wide" data-stock-scan="1">📷 Aur scan karein</button>
        <button class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button>
      </div>`;
    return;
  }

  if (pickedBranch !== 1 && filter === 'all' && !godamAll) filter = 'has';   // v1.97: godam khula ho to shuru se sirf usi ke items
  let shown = items.filter(passes);
  if (q) { const hit = new Set(smartSearch(shown, q, 500)); shown = shown.filter(r => hit.has(r)); }   // v1.75: smart search

  if (sort === 'stock') shown.sort((a, b) => b.stock - a.stock);
  else shown.sort((a, b) => NAMEC.compare(String(a.name), String(b.name)));

  const extra = shown.length - limit;
  const list = shown.slice(0, limit);

  $('list').innerHTML =
    (q ? `<p class="stat-note">${shown.length} item mile</p>` : '') +
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
    + (isOwner() ? `<p class="muted" style="margin-top:12px;font-size:.85em">Farq ka bill banne ke baad nayi ginti shuru karein, taake purani ginti dobara na gine.</p>
       <div class="account-tools"><button data-stock-round="new">Nayi ginti shuru</button></div>` : '');
  if (!d.open) d.showModal();
}

function summaryHTML(branches, pick, items, meta, names) {
  const totalPcs = meta?.totalPcs ?? items.reduce((s, r) => s + (r.stock || 0), 0);
  const stamp = meta?.syncedAt;

  const branchBar = branches.length > 1
    ? `<div class="account-tools">${branches.map(b =>
        `<button data-stock-branch="${b}"${b === pick ? ' class="selected"' : ''}>${esc(branchName(b, names))}</button>`
      ).join('')}</div>`
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
  return `<div class="stock-head">
    <div class="sh-title">
      <strong>${num(shownCount)} items</strong>
      <small>${esc(branchName(pick, names))} · kul ${num(totalPcs)} pcs${stamp ? ' · ' + esc(since(stamp)) : ''}</small>
    </div>
    <div class="account-tools">
      ${scanList.length
        ? `<button class="sh-wide sh-scan" data-stock-scan="1">📷 Aur scan karein (${num(scanList.length)} list mein)</button>
           <button class="sh-wide sh-clear" data-stock-clear="1">✕ Saaf karein — wapas poori list</button>`
        : `<button class="sh-wide sh-scan" data-stock-scan="1">📷 Barcode scan karein (ek ya kai items)</button>
           <button class="sh-wide" data-stock-transfer="1">⇄ Transfer note (godam se godam)</button>
           ${($('search')?.value || '').trim() ? '<button class="sh-wide" data-stock-clear="1">✕ Search saaf karein</button>' : ''}`}
    </div>
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
  if (!navigator.mediaDevices?.getUserMedia) { notice('Camera nahi khulta'); return; }
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
  catch (e) { close(); notice('Camera nahi khula: ' + (e?.message || e)); return; }
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
      ${x.show === false ? '' : `<input type="number" min="1" max="200" value="1" inputmode="numeric" data-label-copies="${i}" aria-label="Kitne label">
      <button type="button" class="primary" data-label-print="${i}" data-label-item="${esc(r.id)}">🖨️</button>`}
      ${x.subId ? `<button type="button" data-sub-edit="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Badlein">✏️</button><button type="button" class="danger" data-sub-del="${x.subId}" data-sub-item="${esc(r.id)}" aria-label="Hatao">🗑️</button>` : ''}
    </div>`).join('') || '<p>Is item ka koi barcode nahi.</p>'}</div>
    <div class="account-tools" style="margin-top:8px"><button type="button" data-sub-new="${esc(r.id)}">➕ Naya barcode</button></div>
    ${isOwner() ? `<label style="display:block;margin-top:10px">Doosre naam (search ke liye, comma se alag)<input type="text" data-alias-item="${esc(r.id)}" value="${esc(aliasOf(r.id))}" placeholder="misal: surkh mirch, lal mirch, chilli" maxlength="120"></label>` : (aliasOf(r.id) ? `<p class="muted" style="font-size:.85em">Doosre naam: ${esc(aliasOf(r.id))}</p>` : '')}
    <p class="muted" style="font-size:.85em;margin-top:8px">Label PC ke TSC printer par chhapta hai (PC par label-print chalna chahiye).</p>`;
  if (!d.open) d.showModal();
}
async function printLabel(btn) {
  const r = rowCache.get(String(btn.dataset.labelItem)); if (!r) return;
  const i = Number(btn.dataset.labelPrint), x = labelRows(r)[i]; if (!x) return;
  const inp = document.querySelector(`[data-label-copies="${i}"]`);
  const copies = Math.max(1, Math.min(200, Math.floor(Number(inp?.value) || 1)));
  if (!cloud?.requestLabel) { notice('Label ke liye app update karein'); return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Bhej rahe...';
  try {
    const jid = await cloud.requestLabel({ itemId: r.id, code: x.code, name: r.name, qty: x.qty, rate: x.price, copies });
    btn.textContent = '⏳ PC...';
    let stop = null, done = false;
    const end = (msg, ok) => { if (done) return; done = true; try { stop && stop(); } catch {} btn.disabled = false; btn.textContent = ok ? '✓ Chhap gaya' : old; notice(msg); setTimeout(() => { if (btn.isConnected) btn.textContent = old; }, 4000); };
    stop = cloud.watchLabel ? cloud.watchLabel(jid, j => {
      if (!j) return;
      if (j.status === 'done') end(`✓ ${copies} label chhap gaye`, true);
      else if (j.status === 'failed' || j.status === 'skipped') end('Label nahi chhapa: ' + (j.error || j.status), false);
    }) : null;
    setTimeout(() => end('PC se jawab nahi aaya — PC on hai aur label-print chal raha hai? (hukum mehfooz hai, PC on hote hi chhapega)', false), 45000);
  } catch (e) { btn.disabled = false; btn.textContent = old; notice('Label nahi bheja: ' + (e?.message || e)); }
}

// ---------- v1.73: STOCK TRANSFER NOTE (godam se godam) — PC transfer-sync.js POS mein STN banata hai ----------
let trLines = [], trFrom = null, trTo = null, trStop = null, trList = [];
function trBranches() { const { branches, names } = collect(); return branches.map(b => ({ id: b, name: branchName(b, names) })); }
function trStockOf(b, id) { return Number(saleStockItem(b, id)?.stock || 0); }
function saleStockItem(b, id) { const chunks = rows.filter(r => !r.meta && Array.isArray(r.items) && r.branch === Number(b)); for (const c of chunks) { const it = c.items.find(x => String(x.id) === String(id)); if (it) return it; } return null; }
function openTransfer() {
  const d = $('dialog'); if (!d) return;
  const bs = trBranches();
  if (trFrom == null) trFrom = bs.find(b => b.id !== 1)?.id ?? bs[0]?.id;
  if (trTo == null) trTo = 1;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = '⇄ Transfer note';
  const sel = (name, val) => `<select data-tr-${name}>${bs.map(b => `<option value="${b.id}"${b.id === val ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`;
  const kul = trLines.reduce((s, l) => s + l.qty, 0);
  $('dialogBody').innerHTML = `<div class="tr-head"><label>Se (nikle)${sel('from', trFrom)}</label><label>Ko (jaye)${sel('to', trTo)}</label></div>
    <div class="scan-find" style="margin:8px 0"><input class="scan-q" data-tr-q type="search" placeholder="🔍 Item ka naam / code likhein" autocomplete="off"><div class="scan-hits" data-tr-hits hidden></div></div>
    <div class="account-tools"><button type="button" data-tr-scan="1">📷 Scan</button></div>
    <div class="tr-lines">${trLines.map((l, i) => { const have = trStockOf(trFrom, l.id); const short = trFrom !== 1 && have < l.qty - 0.0005; const pk = Number(l.pack) || 0;
      return `<div class="tr-line${short ? ' short' : ''}"><div class="tr-name"><b>${esc(l.name)}</b><small>${esc(branchName(trFrom, collect().names))} mein stock ${num(have)}${pk > 1 ? ' · 1 ' + esc(l.cName || 'Ctn') + ' = ' + num(pk) : ''}${short ? ' · <b class="red">⛔ kam hai</b>' : ''}</small>${pk > 1 ? `<small>= ${num(l.qty)} ${esc(l.uName || 'Pcs')}</small>` : ''}</div>
      ${pk > 1 ? `<label class="tr-q"><span>${esc(l.cName || 'Ctn')}</span><input type="text" inputmode="decimal" value="${num(l.ctn || 0)}" data-tr-ctn="${i}"></label>` : ''}
      <label class="tr-q"><span>${esc(l.uName || 'Pcs')}</span><input type="text" inputmode="decimal" value="${num(l.pcs ?? l.qty)}" data-tr-pcs="${i}"></label><button type="button" class="danger" data-tr-del="${i}">✕</button></div>`; }).join('') || '<p class="muted">Upar se item chunein ya scan karein.</p>'}</div>
    ${trLines.length ? `<p class="tr-sum">${trLines.length} items · kul ${num(kul)}</p>` : ''}
    <label>Note<input type="text" data-tr-note maxlength="150" placeholder="ikhtiyari"></label>
    <div class="account-tools"><button type="button" class="primary" data-tr-save="1"${trLines.length ? '' : ' disabled'}>✓ POS mein transfer note banao</button>${trLines.length ? '<button type="button" data-tr-clear="1">Saaf</button>' : ''}</div>
    <p class="muted tr-msg" style="font-size:.85em"></p>
    <div class="tr-hist"><b>Pichhle 14 din ke transfer (app se)</b><div data-tr-hist>${trHistHTML()}</div></div>`;
  if (!d.open) d.showModal();
  if (!trStop && cloud?.listenTransfers) trStop = cloud.listenTransfers(list => { trList = list; const h = document.querySelector('[data-tr-hist]'); if (h) h.innerHTML = trHistHTML(); });
  const q = $('dialogBody').querySelector('[data-tr-q]'), hits = $('dialogBody').querySelector('[data-tr-hits]');
  q.oninput = () => { const t = norm(q.value); if (t.length < 2) { hits.hidden = true; return; } const { items } = collect();
    const found = smartSearch(items, q.value, 8);   // v1.75
    hits._src = found; hits.innerHTML = found.map((r, i) => `<button type="button" data-tr-pick="${i}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · ${esc(branchName(trFrom, collect().names))} ${num(trStockOf(trFrom, r.id))}</small></button>`).join('') || '<p>Nahi mila</p>'; hits.hidden = false; };
  hits.onclick = e => { const b = e.target.closest('[data-tr-pick]'); if (!b) return; trAdd(hits._src[Number(b.dataset.trPick)]); };
  q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const r = (hits._src || [])[0]; if (r) trAdd(r); } };
}
function trCalc(l) { const pk = Number(l.pack) || 0; l.qty = Math.round(((pk > 1 ? (Number(l.ctn) || 0) * pk : 0) + (Number(l.pcs) || 0)) * 1000) / 1000; return l; }
function trAdd(r, qty = 1) { if (!r) return; const old = trLines.find(l => String(l.id) === String(r.id)); if (old) { old.pcs = Math.round(((Number(old.pcs) || 0) + qty) * 1000) / 1000; trCalc(old); } else trLines.push(trCalc({ id: r.id, name: r.name, pack: Number(r.pack) || 0, cName: r.cName || 'Ctn', uName: r.uName || 'Pcs', ctn: 0, pcs: qty, qty })); openTransfer(); }
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
    const jid = await cloud.requestTransfer({ op: 'create', from: trFrom, to: trTo, lines: trLines.map(l => ({ itemId: l.id, name: l.name, qty: l.qty, ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, pack: Number(l.pack) || 0, cName: l.cName || 'Ctn', uName: l.uName || 'Pcs' })), note, byName: '' });
    let stop = null, done = false;
    const end = (ok, t) => { if (done) return; done = true; try { stop && stop(); } catch {} btn.disabled = false;
      if (ok) { trLines = []; notice('✓ Transfer note ' + t + ' ban gaya'); openTransfer(); } else { msg.textContent = '⚠️ ' + t; notice('Transfer nahi bana: ' + t); } };
    stop = cloud.watchTransfer(jid, j => { if (!j) return; if (j.status === 'done') end(true, j.transferNo || ''); else if (j.status === 'failed') end(false, j.error || 'masla'); });
    setTimeout(() => end(false, 'PC se jawab nahi aaya — PC on hai aur transfer-sync chal raha hai? (hukum mehfooz hai)'), 45000);
  } catch (e) { btn.disabled = false; msg.textContent = '⚠️ ' + (e?.message || e); }
}
document.addEventListener('click', e => {
  const t = e.target.closest?.('[data-tr-del],[data-tr-save],[data-tr-clear],[data-tr-scan],[data-tr-print],[data-tr-undo]');
  if (!t) return;
  if (t.dataset.trDel) { trLines.splice(Number(t.dataset.trDel), 1); openTransfer(); }
  else if (t.dataset.trClear) { trLines = []; openTransfer(); }
  else if (t.dataset.trSave) trSave(t);
  else if (t.dataset.trScan) { try { $('dialog').close(); } catch {} scanPick(c => { const { items } = collect(); c = String(c).trim(); const r = items.find(x => String(x.code).trim() === c || (Array.isArray(x.bc) && x.bc.some(b => String(b).trim() === c))); if (r) trAdd(r); else { notice('"' + c + '" stock mein nahi mila'); openTransfer(); } }); }
  else if (t.dataset.trPrint) {   // v1.75: dobara print — wajah zaroori, note par bara "DOBARA PRINT" chhapta hai
    const j = trList.find(x => x.id === t.dataset.trPrint); const n = (j?.reprints?.length || 0) + 1;
    const reason = prompt(`Dobara print (${n}) ki wajah likhein:`); if (reason == null) return; if (!reason.trim()) { notice('Wajah likhna zaroori hai'); return; }
    t.disabled = true; cloud.requestPrint({ kind: 'transfer', id: t.dataset.trPrint, reason: reason.trim().slice(0, 100) }).then(() => notice('🖨️ Dobara print PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')).finally(() => { t.disabled = false; }); }
  else if (t.dataset.trUndo) { const j = trList.find(x => x.id === t.dataset.trUndo); if (!j || !confirm('Transfer note ' + (j.transferNo || '') + ' POS se hata dein? Dono godam ka stock wapas ho jayega.')) return; t.disabled = true;
    cloud.requestTransfer({ op: 'delete', from: j.from, to: j.to, transferId: j.transferId, lines: j.lines }).then(() => notice('Hatane ka hukum PC ko bheja')).catch(er => notice(er?.message || 'Nahi hua')); }
});
document.addEventListener('change', e => {
  const t = e.target;
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
  ${historyHTML(r, c)}`;
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
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · R ' + num(r.rate) : ''}${r.wrate ? ' · W ' + num(r.wrate) : ''}${r.prate ? ' · Khareed ' + num(r.prate) : ''}</small>
    </div>
    <div class="amount">
      <strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>
      <button type="button" class="stock-label-btn" data-stock-label="${esc(r.id)}">🏷️ Label</button>
      ${isOwner() ? `<label style="display:block;font-size:.85em;white-space:nowrap"><input type="checkbox" style="width:auto" data-stock-hide="${esc(r.id)}"${isHidden(r) ? ' checked' : ''}> Band</label>` : ''}
    </div>
    </div>
    ${countHTML(r)}
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { branch = Number(b.dataset.stockBranch); godamAll = false; if (branch !== 1) filter = 'has'; limit = PAGE; rerender(); return; }   // v1.95/97: godam kholte hi sirf USI godam ka stock
  if (e.target.closest?.('[data-stock-scan]')) { openScanner(); return; }
  if (e.target.closest?.('[data-stock-clear]')) { clearScan(); return; }
  const sa = e.target.closest?.('[data-scan-saveall]');
  if (sa) { saveAll(sa); return; }
  const hb = e.target.closest?.('[data-stock-hide]');
  if (hb) { toggleHidden(hb.dataset.stockHide, hb.checked, hb); return; }
  if (e.target.closest?.('[data-stock-more]')) { limit += PAGE; rerender(); return; }
  if (e.target.closest?.('[data-stock-bills]')) { openBills(); return; }
  if (e.target.closest?.('[data-stock-ginti]')) { openGinti(); return; }
  if (e.target.closest?.('[data-stock-transfer]')) { openTransfer(); return; }
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
  if (tk) { tickCount(tk.dataset.countTick, tk); return; }
  const sv = e.target.closest?.('[data-count-save]');
  if (sv) { saveCount(sv.dataset.countSave, sv); return; }
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
let lastCode = '', lastCodeAt = 0;
let badCode = '', badN = 0, lastGoodAt = 0;   // v1.56: ghalat parhai ka filter
let camRetry = 0, audioCtx = null;            // v1.57: kaala camera dobara chalu, scan ki awaz
// v1.74: "ek barcode chuno" mode — wohi bara scanner (Focus/Zoom/Camera/Light) sirf ek code parh kar wapas
let pickHook = null;
export function scanPick(cb) { pickHook = cb; if (scanBox) finishScan(); openScanner(); }
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

function closeScanner() {
  clearTimeout(scanTimer); try { cancelAnimationFrame(scanTimer); } catch {} scanTimer = null;
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  if (scanBox) { scanBox.remove(); scanBox = null; }
}

function finishScan() {
  camRetry = 0;
  const wasPick = !!pickHook; pickHook = null;
  closeScanner();
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
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
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

async function openScanner() {
  if (scanBox) return;
  if (!pickHook) syncFromCart();
  // awaz: button dabane (user ke haath) par hi chalu ho sakti hai
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch {}
  if (!navigator.mediaDevices?.getUserMedia) {
    notice('Is phone/browser mein camera nahi khulta — code search mein likhein.');
    return;
  }
  let detector;
  if ('BarcodeDetector' in window) {   // Android Chrome: phone ka apna tez tareeqa
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
      <div class="scan-find"><div class="scan-find-row"><input class="scan-q" type="search" enterkeyhint="next" placeholder="🔍 Naam ya code likhein" autocomplete="off"><input class="scan-n" type="text" inputmode="decimal" enterkeyhint="done" placeholder="Tadad" autocomplete="off"><button type="button" class="scan-u">Pcs</button></div><div class="scan-hits" hidden></div></div>
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
  if (pickHook) {   // v1.74: sirf ek code chunna hai — search/tadad/list chhupa do
    scanBox.classList.add('pick-mode');
    scanBox.querySelector('.scan-find')?.setAttribute('hidden', '');
    scanBox.querySelector('.scan-pad')?.setAttribute('hidden', '');
    scanBox.querySelector('.scan-done')?.setAttribute('hidden', '');
    msg.textContent = 'Barcode camera ke saamne rakhein — parhte hi wapas form khulega';
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
  const drawNames = () => {
    const sale = saleRoot();
    if (sale) {
      const list = scanOrder.map(k => [k, scanItems.get(k)]).filter(x => x[1]);
      countBox.textContent = list.length;
      namesBox.innerHTML = list.map(([k, it]) => { const L = lineOf(it, k);
        return `<li${k === lastKey ? ' class="now"' : ''}><button type="button" class="scan-del" data-del="${esc(k)}" aria-label="Hatao">✕</button><b>${esc(it.name)}</b><span>${esc(L.qtxt)} x ${num(L.rate)} = <b>${num(L.amt)}</b></span></li>`; }).join('');
      namesBox.start = 1;
      const kul = list.reduce((n, [k, it]) => n + lineOf(it, k).amt, 0);
      sumBox.innerHTML = list.length ? `Kul: <b>Rs ${num(kul)}</b>` : '';
      try { namesBox.scrollTop = namesBox.scrollHeight; } catch {}
      return;
    }
    const names = scanList.slice(-6).map(id => byId.get(String(id))?.name || id);
    countBox.textContent = scanList.length;
    namesBox.innerHTML = names.map(x => `<li>${esc(x)}</li>`).join('');
    namesBox.start = Math.max(1, scanList.length - 5);
    sumBox.innerHTML = '';
  };
  drawNames();
  // v1.64: list ki line ka ✕ — bill se bhi kat jaye
  namesBox.addEventListener('pointerdown', e => { if (e.target.closest('.scan-del')) e.preventDefault(); });
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
    hitBox.innerHTML = src.length ? src.map((r, i) => `<button type="button" data-pick="${i}"><b>${esc(r.name)}</b><small>${esc(r.code || '')}${r.rate ? ' · ' + num(r.rate) : ''}${r.stock != null ? ' · stock ' + num(r.stock) : ''}</small></button>`).join('') : '<p class="stat-note">Nahi mila</p>';
    hitBox._src = src;
  };
  showPad();   // v1.57: dobara kholne par aakhri item ki tadad fauran nazar aaye
  qBox.oninput = scanSearch;
  qBox.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (chosen) { nBox.focus(); return; } const r = (hitBox._src || [])[0]; if (r) pickHit(r); } };
  // v1.59 (sale): item chunne par seedha add nahi — cursor "Tadad" mein; wahan Enter par add, phir cursor wapas search mein
  const pickHit = r => {
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
    let q = Number(String(nBox.value || '').replace(',', '.').trim());
    if (!(q > 0)) q = 1;
    const r = chosen, ctn = nUnit === 'ctn' && Number(r.pack) > 1;
    chosen = null; nBox.value = '';
    addHit(r, ctn ? q * Number(r.pack) : q);   // Ctn = pack se zarb (bill khud carton mein badal deta hai)
    beep(true);
    msg.textContent = `✓ ${r.name} — ${num(q)} ${ctn ? (r.cName || 'Ctn') : (r.uName || 'Pcs')} · agla item likhein`;
    setUnit('pcs', null);
    qBox.focus();
  };
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
const KB_GAP = 50;          // is se zyada ms ka faasla = insaan likh raha hai
function kbReset() { kbBuf = ''; kbTarget = null; kbStartVal = null; clearTimeout(kbTimer); kbTimer = null; }
function kbIsScan(now) {
  const n = kbBuf.length;
  return n >= 6 && (kbLast - kbFirst) / Math.max(1, n - 1) < 35 && now - kbLast < 150;
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
  hardScan(code);
}
document.addEventListener('keydown', e => {
  const onStock = stockActive && !saleRoot() && !!document.querySelector('.stock-head');
  if ((!onStock && !saleRoot()) || scanBox || e.ctrlKey || e.altKey || e.metaKey) return;
  const now = performance.now();
  if (e.key.length === 1) {
    if (!kbBuf || now - kbLast > KB_GAP) {
      kbBuf = ''; kbFirst = now;
      kbTarget = e.target;
      kbStartVal = e.target && 'value' in e.target ? e.target.value : null;
    }
    kbBuf += e.key; kbLast = now;
    clearTimeout(kbTimer);
    kbTimer = setTimeout(() => { if (kbIsScan(performance.now() - 60)) kbFinish(); else kbReset(); }, 120);   // scanner jo Enter na bheje
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
