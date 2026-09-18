// sale.js — Nayi Sale (Counter / Wholesale) — v1.52.2
// App sale ko Firestore "appSales" mein "new" likhta hai. POS bill PC ka sale-post.js banata hai
// (POS ke apne procedures se), rasid print karta hai aur Sale No wapas likhta hai.
// Counter = R rate (COUNTER SALE, cash) · Wholesale = W rate ("whole sale" party, udhaar + cash ka CRV)
// Malik rate badal sakta hai; mulazim ka rate fix (PC bhi mulazim ki sale POS ke rate se hi banata hai).

import { saleStock, setSaleScanHook, openSaleCamera } from './pos-stock.js?v=1.52.2';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 100) / 100);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const SALE_BRANCH = 1;          // POS bill hamesha NOOR TRADERS (branch 1) mein
const DRAFT_KEY = 'sam-sale-draft';

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '';
let mode = 'counter', godam = null, cart = [], cash = null, note = '', saving = false;
let sales = [], salesDay = '', stopSales = null, salesErr = '';

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
const rateFor = (it, m = mode) => r2(m === 'wholesale' ? (Number(it.wrate) || Number(it.rate) || 0) : (Number(it.rate) || 0));
const linePcs = l => r2((Number(l.ctn) || 0) * (Number(l.pack) > 1 ? Number(l.pack) : 0) + (Number(l.pcs) || 0));
const lineTotal = l => r2(linePcs(l) * (Number(l.rate) || 0));
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

function addItem(it, qtyPcs = 1) {
  const old = cart.find(l => String(l.id) === String(it.id));
  if (old) {
    old.pcs = r2((Number(old.pcs) || 0) + qtyPcs);
    const pk = Number(old.pack) || 0;
    if (pk > 1 && old.pcs >= pk) { old.ctn = (Number(old.ctn) || 0) + Math.floor(old.pcs / pk); old.pcs = r2(old.pcs % pk); }
  } else {
    cart.push({
      id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0,
      cName: it.cName || 'Ctn', uName: it.uName || 'Pcs', godam: Number(godam) || SALE_BRANCH,
      ctn: 0, pcs: qtyPcs, rate: rateFor(it), std: rateFor(it), edited: false
    });
  }
  cash = null; keepDraft();
}

// scan (camera / USB scanner) — pos-stock.js yahan bhejta hai
setSaleScanHook(code => {
  const { items } = stock();
  const it = findByCode(items, code);
  if (!it) return { state: null };
  addItem(it);
  notice(`✓ ${it.name}`);
  const s = $('search'); if (s && s.value) s.value = '';
  rerender();
  return { state: 'added', item: it };
});

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
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk), p = r2(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''} (${num(q)})`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
export function renderSale() {
  watchSales();
  const s = stock();
  const owner = isOwner();
  const total = cartTotal();
  // rate: mulazim ke liye hamesha POS ka rate
  if (!owner) cart.forEach(l => { const it = s.items.find(r => String(r.id) === String(l.id)); if (it) { l.rate = rateFor(it); l.std = l.rate; l.edited = false; } });

  const godamBar = s.branches.length > 1 ? `<div class="sh-label">Maal kis godam se</div><div class="account-tools">${
    s.branches.map(b => `<button data-sale-godam="${b}"${b === s.pick ? ' class="selected"' : ''}>${esc(s.branchName(b, s.names))}</button>`).join('')}</div>` : '';
  $('summary').innerHTML = `<div class="stock-head sale-head" data-sale-root="1">
    <div class="account-tools">
      <button class="sale-mode${mode === 'counter' ? ' selected' : ''}" data-sale-mode="counter">🛒 Counter Sale</button>
      <button class="sale-mode${mode === 'wholesale' ? ' selected' : ''}" data-sale-mode="wholesale">📦 Wholesale</button>
    </div>
    ${godamBar}
    <div class="sale-total"><small>${mode === 'wholesale' ? 'Wholesale (W rate)' : 'Counter (R rate)'} · ${num(cart.length)} items</small>
      <strong id="saleTotal">Rs ${num(total)}</strong></div>
    <div class="account-tools">
      <button class="sh-wide sh-scan" data-sale-camera="1">📷 Barcode scan karein</button>
      <button class="sh-wide" id="saleTodayBtn" data-sale-today="1">${todayLabel()}</button>
    </div>
  </div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya naam / code likhein (Enter)';

  if (s.failed) { $('list').innerHTML = `<div class="empty"><strong>Stock nahi mila</strong><p>${esc(s.failed)}</p></div>`; $('actions').innerHTML = ''; return; }
  if (!s.loaded) { $('list').innerHTML = '<p class="stat-note">Items load ho rahe hain…</p>'; $('actions').innerHTML = ''; return; }

  const q = norm(si?.value || '');
  let found = '';
  if (q) {
    const hits = s.items.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q)
      || (Array.isArray(r.bc) && r.bc.some(b => norm(b).includes(q)))).slice(0, 25);
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-sale-add="${esc(r.id)}">
        <b>${esc(r.name)}</b><small>${esc(r.code || '')} · R ${num(r.rate)}${r.wrate ? ' · W ' + num(r.wrate) : ''} · stock ${num(r.stock)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''}</small>
      </button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }

  const rows = cart.map((l, i) => {
    const lg = Number(l.godam) || s.pick;
    const it = itemIn(lg, l.id) || s.items.find(r => String(r.id) === String(l.id));
    const pcs = linePcs(l), short = it && pcs > Number(it.stock);
    const gsel = s.branches.length > 1 ? `<label>Godam<select data-sale-lg="${i}">${s.branches.map(b => `<option value="${b}"${b === lg ? ' selected' : ''}>${esc(s.branchName(b, s.names))}</option>`).join('')}</select></label>` : '';
    return `<div class="sale-line" data-sale-line="${i}">
      <div class="sale-line-top"><b>${esc(l.name)}</b><button type="button" class="danger sale-x" data-sale-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${it ? ' · stock ' + num(it.stock) + ' (' + esc(s.branchName(lg, s.names)) + ')' : ''}${short ? ' · <span class="red">stock kam hai</span>' : ''}</small>
      <div class="sale-inputs">
        <label>${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-sale-pcs="${i}" value="${l.pcs || ''}"></label>
        ${Number(l.pack) > 1 ? `<label>${esc(l.cName)} (${num(l.pack)})<input type="number" min="0" step="1" inputmode="numeric" data-sale-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
        <label>Rate${l.edited ? ' ✎' : ''}<input type="number" min="0" step="any" inputmode="decimal" data-sale-rate="${i}" value="${l.rate}"${owner ? '' : ' readonly'}></label>
        ${gsel}
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

  $('list').innerHTML = found + (cart.length ? `<div class="sale-cart">${rows}</div>${pay}` :
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
  else if ((i = t.dataset.saleRate) != null) { if (!isOwner()) return; cart[i].rate = Math.max(0, Number(t.value) || 0); cart[i].edited = cart[i].rate !== cart[i].std; cash = null; }
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
  if (it && !l.edited) { l.rate = rateFor(it); l.std = l.rate; }
  cash = null; keepDraft(); rerender();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target?.id !== 'search' || !document.querySelector('[data-sale-root]')) return;
  const v = e.target.value.trim(); if (!v) return;
  e.preventDefault();
  const { items } = stock();
  let it = findByCode(items, v);
  if (!it) {
    const q = norm(v);
    const hits = items.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q));
    if (hits.length === 1) it = hits[0];
  }
  if (!it) { notice('Ek item nahi mila — list se chunein'); return; }
  addItem(it); e.target.value = ''; notice(`✓ ${it.name}`); rerender();
});

document.addEventListener('click', async e => {
  const t = e.target.closest?.('[data-sale-mode],[data-sale-godam],[data-sale-add],[data-sale-del],[data-sale-clear],[data-sale-save],[data-sale-today],[data-sale-reprint],[data-sale-camera]');
  if (!t) return;
  if (t.dataset.saleMode) {
    if (mode === t.dataset.saleMode) return;
    mode = t.dataset.saleMode;
    const { items } = stock();
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (it && (!l.edited || !isOwner())) { l.rate = rateFor(it); l.std = l.rate; l.edited = false; } });
    cash = null; keepDraft(); rerender(); return;
  }
  if (t.dataset.saleGodam) {
    if (cart.length && !confirm('Godam badalne par bill ke rate us godam ke hisaab se lagenge. Theek hai?')) return;
    godam = Number(t.dataset.saleGodam);
    const { items } = stock();
    cart = cart.filter(l => items.some(r => String(r.id) === String(l.id)));
    cart.forEach(l => { const it = items.find(r => String(r.id) === String(l.id)); if (!l.edited) { l.rate = rateFor(it); l.std = l.rate; } });
    keepDraft(); rerender(); return;
  }
  if (t.dataset.saleAdd) {
    const it = stock().items.find(r => String(r.id) === t.dataset.saleAdd);
    if (it) { addItem(it); const s = $('search'); if (s) s.value = ''; rerender(); setTimeout(() => focusLast(), 60); }
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
function focusLast() {
  const i = cart.length - 1;
  const box = document.querySelector(`[data-sale-pcs="${i}"]`) || document.querySelector(`[data-sale-ctn="${i}"]`);
  if (box) { box.scrollIntoView({ block: 'center' }); box.focus(); try { box.select(); } catch {} }
}

async function save() {
  if (saving) return;
  const lines = cart.map(l => ({ id: String(l.id), code: String(l.code || ''), name: String(l.name || ''), pack: Number(l.pack) || 0,
    cName: l.cName, uName: l.uName, godam: Number(l.godam) || Number(godam) || SALE_BRANCH, qty: linePcs(l), rate: r2(l.rate), std: r2(l.std) })).filter(l => l.qty > 0);
  if (!lines.length) { notice('Kisi item ki qty likhein'); return; }
  if (lines.length !== cart.length && !confirm('Jin items ki qty khali hai woh bill mein nahi jayenge. Theek hai?')) return;
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
