// sale.js — Nayi Sale (Counter / Wholesale) — v1.79.1
// App sale ko Firestore "appSales" mein "new" likhta hai. POS bill PC ka sale-post.js banata hai
// (POS ke apne procedures se), rasid print karta hai aur Sale No wapas likhta hai.
// Counter = R rate (COUNTER SALE, cash) · Wholesale = W rate ("whole sale" party, udhaar + cash ka CRV)
// Malik rate badal sakta hai; mulazim ka rate fix (PC bhi mulazim ki sale POS ke rate se hi banata hai).

import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, openSaleCamera } from './pos-stock.js?v=2.4.4';
import { smartSearch, topItems, noteHit, voiceSearch } from './smart-search.js?v=2.4.4';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);   // v1.61.1: tadad 3 decimal (0.125) tak dikhe
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;     // raqam / rate
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;   // v1.61.1: TADAD (0.125 -> 0.13 nahi)
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const SALE_BRANCH = 1;          // POS bill hamesha NOOR TRADERS (branch 1) mein
const DRAFT_KEY = 'sam-sale-draft';

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '';
let mode = 'counter', godam = null, cart = [], cash = null, note = '', saving = false;
let sales = [], salesDay = '', stopSales = null, salesErr = '';
let searchFocused = false;   // v1.75

export function saleSetup(o) {
  cloud = o.cloud; rerender = o.rerender || rerender; notice = o.notice || notice;
  isOwner = o.owner || isOwner; uidOf = o.uid || uidOf;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.day === todayStr()) { mode = d.mode || 'counter'; godam = d.godam ?? null; cart = d.cart || []; cash = d.cash ?? null; note = d.note || ''; }
  } catch {}
}
function keepDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ day: todayStr(), mode, godam, cart, cash, note })); } catch {}
}

// ---------- data ----------
function stock() {
  const s = saleStock();
  const pick = s.branches.includes(godam) ? godam : (s.branches.includes(SALE_BRANCH) ? SALE_BRANCH : s.branches[0]);
  godam = pick ?? null;
  const items = pick == null ? [] : s.itemsFor(pick).filter(r => !s.hidden[String(r.id)]);
  return { ...s, pick, items };
}
// v1.61: POS jaisa — counter mein KHULA PIECE "Peice Rate" (SaleRate2 -> item.rate2) se, POORA CARTON "Cotton Rate"
// (SaleRate -> item.rate, fi piece) se. rate2 na ho (purana sync) to dono item.rate. Wholesale pehle jaisa (ek hi rate).
const rateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate2) || Number(it.rate) || 0));
const crateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate) || 0));
const setStd = (l, it) => { l.rate = rateFor(it); l.std = l.rate; l.crate = crateFor(it); l.cstd = l.crate; };
const linePcs = l => r3((Number(l.ctn) || 0) * (Number(l.pack) > 1 ? Number(l.pack) : 0) + (Number(l.pcs) || 0));
const ctnPcsOf = l => r3((Number(l.ctn) || 0) * (Number(l.pack) > 1 ? Number(l.pack) : 0));
const crateOf = l => Number(l.crate ?? l.rate) || 0;
const lineTotal = l => r2(ctnPcsOf(l) * crateOf(l) + (Number(l.pcs) || 0) * (Number(l.rate) || 0));
const cartTotal = () => r2(cart.reduce((n, l) => n + lineTotal(l), 0));
const cashNow = () => cash == null ? cartTotal() : cash;

// kisi bhi godam ka item (line ke godam ke hisaab se stock/rate)
function itemIn(g, id) {
  const st = saleStock();
  return st.itemsFor(Number(g)).find(r => String(r.id) === String(id)) || null;
}
function findByCode(items, code) {
  const clean = String(code).trim(), bare = clean.replace(/^0+/, '');
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
  return items.find(r => codesOf(r).includes(clean))
    || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare)) || null;
}

// v1.58: POS sub-barcode ki tadad (sync-stock v5 -> item.bq [{b, q}]), misal garam masala label 0.25
function subQty(it, code) {
  const clean = String(code || '').trim(), bare = clean.replace(/^0+/, '');
  if (!clean || !Array.isArray(it?.bq)) return 1;
  const e = it.bq.find(x => { const b = String(x?.b || '').trim(); return b === clean || (bare && b.replace(/^0+/, '') === bare); });
  const q = Number(e?.q);
  return q > 0 ? q : 1;
}

// v1.62: har add (scan / search) bill mein NAYI line — jama nahi hota. Har line ki apni pehchan (k).
const newKey = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function addItem(it, qtyPcs = 1) {
  noteHit(it.id);   // v1.75: ranking ke liye
  {
    cart.push({
      k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0,
      cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', godam: Number(godam) || SALE_BRANCH,
      ctn: 0, pcs: qtyPcs, rate: rateFor(it), std: rateFor(it), crate: crateFor(it), cstd: crateFor(it), edited: false
    });
    // v1.60: nayi line par bhi poore carton alag (misal 2 Ctn likha = 24 pcs -> 2 Ctn)
    const nl = cart[cart.length - 1], pk = Number(nl.pack) || 0;
    if (pk > 1 && nl.pcs >= pk) { nl.ctn = Math.floor(nl.pcs / pk); nl.pcs = r3(nl.pcs % pk); }
  }
  cash = null; keepDraft();
  return cart[cart.length - 1];
}

// camera ki screen ka search
// v1.61.2: camera ki list bill se (rate bhi bill wala: khula piece l.rate, carton crate)
// v1.64: camera ki list ka ✕ -> bill ki wohi line (pehchan k se)
// v1.86: hooks function mein — POS Purchase screen bhi yahi hooks leti hai; jo screen khule woh apne laga leti hai
function installSaleHooks() {
setSaleDelHook(key => {
  const i = cart.findIndex(l => l.k === key);
  if (i < 0) return;
  cart.splice(i, 1); cash = null; keepDraft(); rerender();
});
setSaleCartHook(() => cart.map(l => ({ key: l.k || (l.k = newKey()),
  item: { id: l.id, code: l.code, name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: crateOf(l), rate2: Number(l.rate) || 0 },
  pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
setSaleFindHook(q => smartSearch(stock().items, q, 12));   // v1.75: smart search
// camera par tadad ke buttons -> bill ki line
setSaleQtyHook((it, q, key) => {
  // v1.62: camera ke buttons AAKHRI scan wali line par (line ki pehchan se), warna is item ki aakhri line
  const l = (key && cart.find(x => x.k === key)) || [...cart].reverse().find(x => String(x.id) === String(it.id));
  if (!l) return;
  l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0;
  cash = null; keepDraft(); rerender();
});
// scan (camera / USB scanner) — pos-stock.js yahan bhejta hai
setSaleScanHook((code, direct, qty) => {
  const { items } = stock();
  const it = direct || findByCode(items, code);
  if (!it) return { state: null };
  const q = Number(qty) > 0 ? Math.round(Number(qty) * 1000) / 1000 : (direct ? 1 : subQty(it, code));   // v1.59: search wale khane ki tadad
  const nl = addItem(it, q);
  notice(`✓ ${it.name}${q !== 1 ? ' — ' + q : ''}`);
  const s = $('search'); if (s && s.value) s.value = '';
  rerender();
  // v1.58: bill ki asal tadad wapas (camera ki list bhi wohi dikhaye — pehle dobara scan par list 1 hi dikhati thi)
  return { state: 'added', item: it, line: nl.k, pcs: Number(nl.pcs) || 0, ctn: Number(nl.ctn) || 0 };
});
}
installSaleHooks();

// ---------- aaj ki app sales ----------
function watchSales() {
  const day = todayStr();
  if (stopSales && salesDay === day) return;
  if (stopSales) { stopSales(); stopSales = null; }
  if (!cloud?.listenAppSales) return;
  salesDay = day;
  stopSales = cloud.listenAppSales(day, list => {
    sales = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); salesErr = '';
    const box = $('saleTodayBtn'); if (box) box.textContent = todayLabel();
    if ($('dialog')?.open && $('dialogTitle')?.textContent.startsWith('Aaj ki app sales')) openToday();
  }, e => { salesErr = e?.message || 'Load nahi hui'; stopSales = null; });
}
const statusText = s => s.status === 'done' ? `✓ Sale ${esc(s.saleNo || '')}${s.crvNo ? ' · ' + esc(s.crvNo) : ''}`
  : s.status === 'failed' ? `✕ Nahi bani: ${esc(s.error || '')}`
  : s.status === 'posting' ? '… PC bill bana raha hai' : '⏳ PC ka intezar';
const todayLabel = () => {
  const wait = sales.filter(s => s.status === 'new' || s.status === 'posting').length;
  return `📋 Aaj ki app sales (${num(sales.length)})${wait ? ' · ' + num(wait) + ' intezar mein' : ''}`;
};
function openToday() {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = `Aaj ki app sales (${num(sales.length)})`;
  $('dialogBody').innerHTML = salesErr ? `<p>${esc(salesErr)}</p>` : !sales.length ? '<p>Aaj app se koi sale nahi hui.</p>' :
    sales.map(s => `<details class="sale-hist">
      <summary><b>${s.mode === 'wholesale' ? 'Wholesale' : 'Counter'} · Rs ${num(s.total)}</b>
        <small>${esc(new Date(s.createdAt || 0).toLocaleTimeString('en-PK'))} · ${statusText(s)}</small></summary>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Rs</th></tr></thead><tbody>
      ${(s.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td>${qtyText(l)}</td><td>${num(l.rate)}</td><td>${num(r2(l.qty * l.rate))}</td></tr>`).join('')}
      </tbody></table></div>
      <p>Cash: Rs ${num(s.cash)}${s.mode === 'wholesale' && s.total - s.cash > 0 ? ' · Udhaar Rs ' + num(s.total - s.cash) : ''}${s.note ? ' · ' + esc(s.note) : ''}</p>
      ${s.status === 'done' ? `<button type="button" data-sale-reprint="${esc(s.id)}">🖨 Dobara print (kuch save nahi hoga)</button>` : ''}
    </details>`).join('');
  if (!d.open) d.showModal();
}
function qtyText(l) {
  const pk = Number(l.pack) || 0, q = Number(l.qty) || 0;
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk), p = r3(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''} (${num(q)})`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
export function renderSale() {
  installSaleHooks(); watchSales();
  const s = stock();
  const owner = isOwner();
  const total = cartTotal();
  // rate: mulazim ke liye hamesha POS ka rate
  if (!owner) cart.forEach(l => { const it = s.items.find(r => String(r.id) === String(l.id)); if (it) { setStd(l, it); l.edited = false; } });

  // v1.54: godam ke buttons hata diye — bill hamesha main branch se; line ke andar godam badla ja sakta hai
  $('summary').innerHTML = `<div class="stock-head sale-head" data-sale-root="1">
    <div class="account-tools">
      <button class="sale-mode${mode === 'counter' ? ' selected' : ''}" data-sale-mode="counter">🛒 Counter Sale</button>
      <button class="sale-mode${mode === 'wholesale' ? ' selected' : ''}" data-sale-mode="wholesale">📦 Wholesale</button>
    </div>
    <div class="sale-total"><small>${mode === 'wholesale' ? 'Wholesale (W rate)' : 'Counter (R rate)'} · ${num(cart.length)} items</small>
      <strong id="saleTotal">Rs ${num(total)}</strong></div>
    <div class="account-tools">
      <button class="sh-wide" id="saleTodayBtn" data-sale-today="1">${todayLabel()}</button>
    </div>
  </div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya naam / code likhein (Enter)';

  if (s.failed) { $('list').innerHTML = `<div class="empty"><strong>Stock nahi mila</strong><p>${esc(s.failed)}</p></div>`; $('actions').innerHTML = ''; return; }
  if (!s.loaded) { $('list').innerHTML = '<p class="stat-note">Items load ho rahe hain…</p>'; $('actions').innerHTML = ''; return; }

  const q = norm(si?.value || '');
  let found = '';
  const camRow = `<div class="sale-camrow"><button type="button" class="sale-cam" data-sale-camera="1">📷 Scan</button><button type="button" class="sale-mic" data-sale-mic="1" title="Awaz se">🎤</button><span class="stat-note">Naam likhein ya scan karein</span></div>`;
  if (!q && searchFocused) {   // v1.75: khali search par aksar bikne wale items
    const top = topItems(s.items, 10);
    if (top.length) found = `<div class="sale-found"><p class="stat-note" style="margin:0 0 4px">Aksar bikne wale</p>${top.map(r => `<button type="button" class="sale-hit" data-sale-add="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate)} · stock ${num(r.stock)}</small></button>`).join('')}</div>`;
  }
  if (q) {
    const codeKey = r => { const c = String(r.code || '').trim(); const n = Number(c); return Number.isFinite(n) && c !== '' ? String(n).padStart(20, '0') : c; };
    const hits = smartSearch(s.items, q, 25);   // v1.75: smart search (spelling, tarteeb, alias, zyada bikne wale pehle)
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-sale-add="${esc(r.id)}">
        <b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate)}${r.wrate ? ' · W ' + num(r.wrate) : ''} · stock ${num(r.stock)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''}</small>
      </button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }

  const rows = cart.map((l, i) => {
    const lg = Number(l.godam) || s.pick;
    const it = itemIn(lg, l.id) || s.items.find(r => String(r.id) === String(l.id));
    const pcs = linePcs(l), short = it && pcs > Number(it.stock), block = short && lg !== SALE_BRANCH;   // v1.72: godam mein rok
    const gsel = s.branches.length > 1 ? `<label>Godam<select data-sale-lg="${i}">${s.branches.map(b => `<option value="${b}"${b === lg ? ' selected' : ''}>${esc(s.branchName(b, s.names))}</option>`).join('')}</select></label>` : '';
    return `<div class="sale-line" data-sale-line="${i}">
      <div class="sale-line-top"><b>${esc(l.name)}</b><button type="button" class="danger sale-x" data-sale-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${it ? ' · stock ' + num(it.stock) + ' (' + esc(s.branchName(lg, s.names)) + ')' : ''}${block ? ' · <b class="red">⛔ godam mein stock nahi — godam badlein</b>' : short ? ' · <span class="red">stock kam hai</span>' : ''}</small>
      <div class="sale-inputs">
        <label>${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-sale-pcs="${i}" value="${l.pcs || ''}"></label>
        ${Number(l.pack) > 1 ? `<label>${esc(l.cName)} (${num(l.pack)})<input type="number" min="0" step="1" inputmode="numeric" data-sale-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
        <label>Rate${l.edited ? ' ✎' : ''}<input type="number" min="0" step="any" inputmode="decimal" data-sale-rate="${i}" value="${l.rate}"${owner ? '' : ' readonly'}></label>
        ${gsel}
        ${Number(l.pack) > 1 && Math.abs(crateOf(l) - (Number(l.rate) || 0)) > 0.004 ? `<small class="sale-crate">${esc(l.cName)} rate ${num(r2(crateOf(l) * Number(l.pack)))}</small>` : ''}
        <div class="sale-amt"><small>${num(pcs)} ${esc(l.uName)}</small><b id="saleAmt${i}">${num(lineTotal(l))}</b></div>
      </div>
    </div>`;
  }).join('');

  const due = r2(total - cashNow());
  const pay = cart.length ? `<div class="sale-pay">
      <label>${mode === 'wholesale' ? 'Cash mila (baqi whole sale khate mein udhaar)' : 'Cash mila'}
        <input type="number" min="0" step="any" inputmode="decimal" data-sale-cash="1" value="${cashNow()}"></label>
      <p id="saleDue" class="stat-note">${dueText(due)}</p>
      <label>Note (ikhtiyari)<input maxlength="100" data-sale-note="1" value="${esc(note)}"></label>
    </div>` : '';

  $('list').innerHTML = camRow + found + (cart.length ? `<div class="sale-cart">${rows}</div>${pay}` :
    (q ? '' : `<div class="empty"><strong>Naya bill</strong><p>Upar item ka naam likhein ya 📷 se scan karein.</p></div>`));
  $('actions').innerHTML = cart.length ? `<button class="give" data-sale-clear="1">✕ Naya bill</button><button data-sale-camera="1" title="Barcode scan">📷</button>
    <button class="got" data-sale-save="1"${saving ? ' disabled' : ''}>${saving ? 'Save ho raha hai…' : '💾 Save + Print · Rs ' + num(total)}</button>` : '';
}
function dueText(due) {
  if (mode === 'wholesale') return due > 0 ? `Udhaar: Rs ${num(due)}` : due < 0 ? `<span class="red">Cash bill se zyada hai (Rs ${num(-due)})</span>` : 'Poora cash';
  return due > 0 ? `<span class="red">Rs ${num(due)} kam hain — counter sale mein poora cash chahiye</span>` : due < 0 ? `Wapas dein: Rs ${num(-due)}` : '';
}
function refreshTotals() {
  const total = cartTotal();
  const t = $('saleTotal'); if (t) t.textContent = 'Rs ' + num(total);
  cart.forEach((l, i) => { const a = $('saleAmt' + i); if (a) a.textContent = num(lineTotal(l)); });
  const c = document.querySelector('[data-sale-cash]');
  if (c && cash == null && document.activeElement !== c) c.value = total;
  const d = $('saleDue'); if (d) d.innerHTML = dueText(r2(total - cashNow()));
  const b = document.querySelector('[data-sale-save]'); if (b && !saving) b.textContent = '💾 Save + Print · Rs ' + num(total);
}

// ---------- events ----------
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest?.('#list')) return;
  let i;
  if ((i = t.dataset.saleCtn) != null) { cart[i].ctn = Math.max(0, Math.floor(Number(t.value) || 0)); cash = null; }
  else if ((i = t.dataset.salePcs) != null) { cart[i].pcs = Math.max(0, Number(t.value) || 0); cash = null; }
  else if ((i = t.dataset.saleRate) != null) { if (!isOwner()) return; cart[i].rate = Math.max(0, Number(t.value) || 0); cart[i].crate = cart[i].rate; cart[i].edited = cart[i].rate !== cart[i].std; cash = null; }   // malik ka apna rate: carton par bhi wohi
  else if (t.dataset.saleCash != null) { cash = t.value === '' ? 0 : Math.max(0, Number(t.value) || 0); }
  else if (t.dataset.saleNote != null) { note = t.value.slice(0, 100); }
  else return;
  keepDraft(); refreshTotals();
});

document.addEventListener('change', e => {
  const t = e.target; if (t.dataset?.saleLg == null) return;
  const l = cart[t.dataset.saleLg]; if (!l) return;
  l.godam = Number(t.value);
  const it = itemIn(l.godam, l.id);
  if (it && !l.edited) setStd(l, it);
  cash = null; keepDraft(); rerender();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target?.id !== 'search' || !document.querySelector('[data-sale-root]')) return;
  const v = e.target.value.trim(); if (!v) return;
  e.preventDefault();
  const { items } = stock();
  let it = findByCode(items, v);
  if (!it) { const hs = smartSearch(items, v, 2); if (hs.length === 1) it = hs[0]; }
  if (!it) {
    const q = norm(v);
    const hits = items.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q));
    if (hits.length === 1) it = hits[0];
  }
  if (!it) { notice('Ek item nahi mila — list se chunein'); return; }
  addItem(it); e.target.value = ''; notice(`✓ ${it.name}`); rerender();
  setTimeout(() => qtyPad(cart.length - 1), 60);
});

document.addEventListener('click', async e => {
  const mic = e.target.closest?.('[data-sale-mic]');
  if (mic) { const ok = voiceSearch(t => { const s = $('search'); if (s) { s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); } }); if (!ok) notice('Is phone/browser mein awaz se search nahi chalti'); return; }
  const t = e.target.closest?.('[data-sale-mode],[data-sale-godam],[data-sale-add],[data-sale-del],[data-sale-clear],[data-sale-save],[data-sale-today],[data-sale-reprint],[data-sale-camera]');
  if (!t) return;
  if (t.dataset.saleMode) {
    if (mode === t.dataset.saleMode) return;
    mode = t.dataset.saleMode;
    const { items } = stock();
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (it && (!l.edited || !isOwner())) { setStd(l, it); l.edited = false; } });
    cash = null; keepDraft(); rerender(); return;
  }
  if (t.dataset.saleGodam) {
    if (cart.length && !confirm('Godam badalne par bill ke rate us godam ke hisaab se lagenge. Theek hai?')) return;
    godam = Number(t.dataset.saleGodam);
    const { items } = stock();
    cart = cart.filter(l => items.some(r => String(r.id) === String(l.id)));
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (!l.edited && it) setStd(l, it); });
    keepDraft(); rerender(); return;
  }
  if (t.dataset.saleAdd) {
    const it = stock().items.find(r => String(r.id) === t.dataset.saleAdd);
    if (it) { addItem(it); const s = $('search'); if (s) s.value = ''; rerender(); setTimeout(() => qtyPad(cart.length - 1), 60); }
    return;
  }
  if (t.dataset.saleDel != null) { cart.splice(Number(t.dataset.saleDel), 1); cash = null; keepDraft(); rerender(); return; }
  if (t.dataset.saleClear) { if (!confirm('Yeh bill saaf kar dein?')) return; cart = []; cash = null; note = ''; keepDraft(); rerender(); return; }
  if (t.dataset.saleCamera) { openSaleCamera(); return; }
  if (t.dataset.saleToday) { openToday(); return; }
  if (t.dataset.saleReprint) {
    try { t.disabled = true; await cloud.reprintAppSale(t.dataset.saleReprint); notice('Print ka hukam PC ko bhej diya'); }
    catch (err) { notice('Nahi hua: ' + (err?.message || err)); t.disabled = false; }
    return;
  }
  if (t.dataset.saleSave) save();
});
// chhota modal (app.js ka modal yahan nahi milta)
function saleModal(title, html) {
  const d = $('dialog'); if (!d) return null;
  d.classList.remove('search-dialog');
  $('dialogTitle').textContent = title;
  $('dialogBody').innerHTML = html;
  if (!d.open) d.showModal();
  return d;
}
// Item chunne par tadad ka pad (keyboard ke baghair) — scanner wale pad jaisa
function qtyPad(i) {
  const l = cart[i]; if (!l) return;
  const pack = Number(l.pack) || 0;
  const row = (unit, vals) => vals.map(v => `<button type="button" data-qp="${unit}:${v}">${v === '+1' ? '+1' : v}</button>`).join('');
  saleModal(`${l.name}${l.label ? ' · ' + l.label : ''}`, `<div class="qtypad">
    <div class="qtypad-now" id="qpNow">${num(l.pcs || 0)} ${esc(l.uName)}${pack > 1 && l.ctn ? ' · ' + num(l.ctn) + ' ' + esc(l.cName) : ''}</div>
    <div class="qtypad-lab">${esc(l.uName)}</div><div class="qtypad-row">${row('pcs', [1, 2, 3, 6, 12, 24, '+1'])}</div>
    ${pack > 1 ? `<div class="qtypad-lab">${esc(l.cName)} (1 = ${num(pack)})</div><div class="qtypad-row">${row('ctn', [1, 2, 3, 5, 10, '+1'])}</div>` : ''}
    <div class="qtypad-row"><button type="button" class="got" data-qp="done">✓ Theek hai</button><button type="button" class="danger" data-qp="del">✕ Hatao</button></div>
  </div>`);
  $('dialogBody').onclick = e => {
    const b = e.target.closest('[data-qp]'); if (!b) return;
    const v = b.dataset.qp;
    if (v === 'done') { $('dialog').close(); rerender(); return; }
    if (v === 'del') { cart.splice(i, 1); cash = null; keepDraft(); $('dialog').close(); rerender(); return; }
    const [unit, val] = v.split(':');
    if (val === '+1') l[unit] = (Number(l[unit]) || 0) + 1; else l[unit] = Number(val);
    cash = null; keepDraft();
    $('qpNow').textContent = `${num(l.pcs || 0)} ${l.uName}${pack > 1 && l.ctn ? ' · ' + num(l.ctn) + ' ' + l.cName : ''}`;
  };
}
function focusLast() {
  const i = cart.length - 1;
  const box = document.querySelector(`[data-sale-pcs="${i}"]`) || document.querySelector(`[data-sale-ctn="${i}"]`);
  if (box) { box.scrollIntoView({ block: 'center' }); box.focus(); try { box.select(); } catch {} }
}

async function save() {
  if (saving) return;
  // v1.61: carton aur khule piece ke rate alag hon to POS ko DO lines (unit 'ctn' / 'pcs'), warna ek line
  const lines = [];
  let emptyLines = 0;
  cart.forEach(l => {
    const base = { id: String(l.id), code: String(l.code || ''), name: String(l.name || ''), pack: Number(l.pack) || 0,
      cName: l.cName, uName: l.uName, godam: Number(l.godam) || Number(godam) || SALE_BRANCH };
    const cq = ctnPcsOf(l), pq = r3(Number(l.pcs) || 0), cr = r2(crateOf(l)), pr = r2(l.rate);
    if (!(cq + pq > 0)) { emptyLines++; return; }
    if (cq > 0 && pq > 0 && Math.abs(cr - pr) > 0.004) {
      lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
      lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    } else if (cq > 0 && !(pq > 0)) lines.push({ ...base, unit: 'ctn', qty: cq, rate: cr, std: r2(l.cstd ?? l.std) });
    else if (!(cq > 0)) lines.push({ ...base, unit: 'pcs', qty: pq, rate: pr, std: r2(l.std) });
    else lines.push({ ...base, qty: r3(cq + pq), rate: pr, std: r2(l.std) });
  });
  if (!lines.length) { notice('Kisi item ki qty likhein'); return; }
  // v1.72: POS ka qanoon — GODAM (branch 1 NOOR TRADERS ke ilawa) mein stock tadad se kam ho to sale nahi (dukaan par rok nahi)
  const s2 = stock();
  const shortG = [];
  for (const l of cart) {
    const g = Number(l.godam) || Number(godam) || SALE_BRANCH;
    if (g === SALE_BRANCH) continue;
    const need = linePcs(l); if (!(need > 0)) continue;
    const it = itemIn(g, l.id);
    const have = it ? Number(it.stock) || 0 : 0;
    if (have < need - 0.0005) shortG.push(`${l.name}: ${s2.branchName(g, s2.names)} mein stock ${num(have)}, chahiye ${num(need)}`);
  }
  if (shortG.length) { alert('Godam mein stock kam hai — sale nahi ban sakti:\n\n' + shortG.join('\n') + '\n\nGodam badlein (NOOR TRADERS par rok nahi).'); return; }
  if (emptyLines && !confirm('Jin items ki qty khali hai woh bill mein nahi jayenge. Theek hai?')) return;
  if (lines.some(l => !(l.rate > 0)) && !confirm('Kisi item ka rate 0 hai. Phir bhi save karein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  let paid = r2(cashNow());
  if (mode === 'counter' && paid < total) { notice('Counter sale mein poora cash likhein (ya Wholesale chunein)'); return; }
  if (mode === 'counter') paid = total;                     // POS: counter sale ka CashReceived = bill
  if (paid > total) { notice('Cash bill se zyada nahi ho sakta'); return; }
  const msg = `${mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE'}\n${lines.length} items · Rs ${num(total)}` +
    (mode === 'wholesale' ? `\nCash Rs ${num(paid)}${total - paid > 0 ? ' · Udhaar Rs ' + num(total - paid) : ''}` : '') + '\n\nSave karke POS mein bill banayein?';
  if (!confirm(msg)) return;
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const doc = { id, date: todayStr(), at: new Date().toISOString(), mode, branch: SALE_BRANCH, godam: Number(godam) || SALE_BRANCH,
    lines, total, cash: paid, note: note.trim(), role: isOwner() ? 'owner' : 'staff', by: uidOf(), status: 'new', createdAt: Date.now() };
  saving = true; rerender();
  try {
    const p = cloud.saveAppSale(doc);
    // internet na ho to bhi phone par mehfooz; net aate hi chali jayegi
    await Promise.race([p, new Promise(r => setTimeout(r, 4000))]);
    cart = []; cash = null; note = ''; keepDraft();
    notice('Sale save ho gayi — PC bill bana kar print karega');
    p.catch(err => {
      // server ne mana kar diya: bill wapas screen par le aao (khoye nahi)
      if (!cart.length) {
        mode = doc.mode; note = doc.note; cash = null;
        cart = lines.map(l => ({ id: l.id, code: l.code, name: l.name, pack: l.pack, cName: l.cName, uName: l.uName,
          ctn: 0, pcs: l.qty, rate: l.rate, std: l.std, edited: l.rate !== l.std }));
        keepDraft(); rerender();
      }
      alert('Sale PC tak NAHI gayi: ' + (err?.message || err) + '\nBill wapas screen par hai — dobara Save karein.');
    });
  } catch (err) {
    notice('Sale save nahi hui: ' + (err?.message || err));
  } finally {
    saving = false; rerender();
  }
}

// v1.75: search khali ho aur focus mein aaye to "aksar bikne wale" dikhao
document.addEventListener('focusin', e => { if (e.target?.id === 'search' && document.querySelector('[data-sale-root]') && !searchFocused) { searchFocused = true; if (!e.target.value.trim()) rerender(); } });
document.addEventListener('focusout', e => { if (e.target?.id === 'search' && searchFocused) { searchFocused = false; setTimeout(() => { if (document.querySelector('[data-sale-root]') && !$('search')?.value.trim() && document.activeElement?.id !== 'search') rerender(); }, 250); } });
