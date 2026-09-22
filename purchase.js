// purchase.js — v1.93.1 "POS Purchase" screen
// v1.93.1: POS ka KHULA bill yahan EDIT (editOf) -> PC wohi bill number update karta hai; supplier ki smart chips
//          (istemal ke hisaab se); supplier chunte hi "is supplier se aksar aane wale items" chips. (Purchase tab ke andar nayi screen)
// Sale screen jaisi: barcode scan / smart search / Ctn + Pcs. Har item par khareed rate + 4 naye rate
// (Wholesale Ctn/Pcs, Parchoon Ctn/Pcs) — PURANE NAFA se khud, % chips se wholesale.
// Save -> Firestore "appPurchases" (status new) -> PC ka purchase-post.js POS mein ASLI purchase bill
// banata hai (POS ke apne procedures, DocStatusID 1 — baqi bills jaisa) aur naye rates POS items par lagata hai.
// POS mein Qty = PIECES, Rate = FI PIECE khareed. Yahan sab RUPAY (paisa nahi).

import { saleStock, setSaleScanHook, setSaleQtyHook, setSaleFindHook, setSaleCartHook, setSaleDelHook, openSaleCamera } from './pos-stock.js?v=1.93.1';
import { smartSearch, noteHit, voiceSearch, notePartyPick } from './smart-search.js?v=1.93.1';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 100) / 100);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const r4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const BILL_BRANCH = 1;              // purchase bill hamesha NOOR TRADERS (branch 1); godam line par
const DRAFT_KEY = 'sam-pp-draft';
const W_CHIPS = [1, 1.25, 1.5, 2];

let cloud = null, rerender = () => {}, notice = () => {}, isOwner = () => false, uidOf = () => '';
let partiesOf = () => [], partyOf = () => null, matchesOf = () => true, canUse = () => false, rankOf = null, billIdsOf = () => [];
let edit = null;            // v1.87: {purchaseId, billNo, stamp, partyId, posPartyId, date} — POS ka khula bill edit ho raha hai
const supItems = new Map();  // partyId -> {loading, list:[{id,n}]}
let supplier = '', godam = BILL_BRANCH, day = '', invoiceNo = '', note = '', cart = [], saving = false;
let supQuery = '', supOpen = false;
let today = [], todayDay = '', stopToday = null, todayErr = '';

export function ppSetup(o) {
  cloud = o.cloud; rerender = o.rerender || rerender; notice = o.notice || notice;
  isOwner = o.owner || isOwner; uidOf = o.uid || uidOf;
  partiesOf = o.parties || partiesOf; partyOf = o.party || partyOf; matchesOf = o.accountMatches || matchesOf; canUse = o.canUse || canUse;
  rankOf = o.rank || rankOf; billIdsOf = o.billIdsOf || billIdsOf;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.saved === todayStr()) { supplier = d.supplier || ''; godam = d.godam ?? BILL_BRANCH; day = d.day || ''; invoiceNo = d.invoiceNo || ''; note = d.note || ''; cart = Array.isArray(d.cart) ? d.cart : []; edit = d.edit || null; }
  } catch {}
}
function keepDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ saved: todayStr(), supplier, godam, day, invoiceNo, note, cart, edit })); } catch {}
}

// ---------- data ----------
function stock() {
  const s = saleStock();
  const base = s.branches.includes(BILL_BRANCH) ? BILL_BRANCH : s.branches[0];
  const items = base == null ? [] : s.itemsFor(base);
  if (!s.branches.includes(Number(godam))) godam = base ?? BILL_BRANCH;
  return { ...s, base, items };
}
const packOf = l => Number(l.pack) > 1 ? Number(l.pack) : 0;
const linePcs = l => r3((Number(l.ctn) || 0) * packOf(l) + (Number(l.pcs) || 0));
const lineTotal = l => r2(linePcs(l) * (Number(l.costP) || 0));
const cartTotal = () => r2(cart.reduce((n, l) => n + lineTotal(l), 0));
const newKey = () => 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function findByCode(items, code) {
  const clean = String(code).trim(), bare = clean.replace(/^0+/, '');
  const codesOf = r => [r.code, ...(Array.isArray(r.bc) ? r.bc : [])].map(x => String(x || '').trim()).filter(Boolean);
  return items.find(r => codesOf(r).includes(clean)) || items.find(r => bare && codesOf(r).some(x => x.replace(/^0+/, '') === bare)) || null;
}

// purane rates (POS abhi jo hain) — sab FI PIECE: prate khareed, wrate W, rate R (carton wala), rate2 khula piece
function oldOf(it) {
  return { oldCost: r4(Number(it.prate) || 0), oldW: r2(Number(it.wrate) || 0), oldR: r2(Number(it.rate) || 0), oldR2: r2(Number(it.rate2) || Number(it.rate) || 0) };
}
const pct = (a, b) => b > 0 && a > 0 ? Math.round((a / b - 1) * 1000) / 10 : null;
// cost ya mode badle to rates dobara (wMode: 'old' | % number | 'manual'; rMode: 'old' | 'manual')
function recalc(l) {
  const c = Number(l.costP) || 0, pk = packOf(l);
  if (!(c > 0)) return;
  if (l.wMode === 'old' && l.oldCost > 0 && l.oldW > 0) { const m = l.oldW / l.oldCost; l.wpcs = r2(c * m); l.wctn = pk ? Math.round(c * m * pk) : 0; }
  else if (typeof l.wMode === 'number') { const m = 1 + l.wMode / 100; l.wpcs = r2(c * m); l.wctn = pk ? Math.round(c * m * pk) : 0; }
  if (l.rMode === 'old' && l.oldCost > 0 && l.oldR > 0) {
    l.rctn = pk ? Math.round(c * (l.oldR / l.oldCost) * pk) : 0;
    l.rpcs = r2(c * ((pk ? l.oldR2 : l.oldR) / l.oldCost));
  }
}
function addItem(it, again = true) {
  noteHit(it.id);
  const had = again && [...cart].reverse().find(l => String(l.id) === String(it.id));
  if (had) {   // dobara scan / chunna = +1 Ctn (khula item ho to +1 Pcs)
    if (packOf(had)) had.ctn = (Number(had.ctn) || 0) + 1; else had.pcs = r3((Number(had.pcs) || 0) + 1);
    keepDraft(); return { line: had, again: true };
  }
  const o = oldOf(it), pk = Number(it.pack) > 1 ? Number(it.pack) : 0;
  const l = {
    k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs',
    godam: Number(godam) || BILL_BRANCH, ctn: pk ? 1 : 0, pcs: pk ? 0 : 1, costP: o.oldCost, ...o,
    wpcs: o.oldW, wctn: pk ? Math.round(o.oldW * pk) : 0, rpcs: pk ? o.oldR2 : o.oldR, rctn: pk ? Math.round(o.oldR * pk) : 0,
    wMode: 'old', rMode: 'old'
  };
  cart.push(l); keepDraft();
  return { line: l, again: false };
}

// ---------- camera / scanner hooks (Sale wale hi; jo screen khule woh apne laga leti hai) ----------
function installHooks() {
  setSaleDelHook(key => { const i = cart.findIndex(l => l.k === key); if (i < 0) return; cart.splice(i, 1); keepDraft(); rerender(); });
  setSaleCartHook(() => cart.map(l => ({ key: l.k,
    item: { id: l.id, code: l.code, name: l.name, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName, rate: Number(l.costP) || 0, rate2: Number(l.costP) || 0 },
    pcs: Number(l.pcs) || 0, ctn: Number(l.ctn) || 0 })));
  setSaleFindHook(q => smartSearch(stock().items, q, 12));
  setSaleQtyHook((it, q, key) => {
    const l = (key && cart.find(x => x.k === key)) || [...cart].reverse().find(x => String(x.id) === String(it.id));
    if (!l) return; l.pcs = Number(q.pcs) || 0; l.ctn = Number(q.ctn) || 0; keepDraft(); rerender();
  });
  setSaleScanHook((code, direct) => {
    const it = direct || findByCode(stock().items, code);
    if (!it) return { state: null };
    const r = addItem(it);
    notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`);
    const s = $('search'); if (s && s.value) s.value = '';
    rerender();
    return { state: 'added', item: it, line: r.line.k, pcs: Number(r.line.pcs) || 0, ctn: Number(r.line.ctn) || 0 };
  });
}

// ---------- aaj ke app purchase bills ----------
function watchToday() {
  const d = todayStr();
  if (stopToday && todayDay === d) return;
  if (stopToday) { stopToday(); stopToday = null; }
  if (!cloud?.listenAppPurchases) return;
  todayDay = d;
  stopToday = cloud.listenAppPurchases(d, list => {
    today = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); todayErr = '';
    const b = $('ppTodayBtn'); if (b) b.textContent = todayLabel();
    if ($('dialog')?.open && $('dialogTitle')?.textContent.startsWith('Aaj ke app purchase')) openToday();
  }, e => { todayErr = e?.message || 'Load nahi hue'; stopToday = null; });
}
const statusText = p => p.status === 'done' ? `✓ POS bill ${esc(p.purchaseNo || '')}${p.editOf ? ' UPDATE ho gaya' : ''}${p.rates ? ' · ' + esc(String(p.rates)) + ' items ke rate lage' : ''}${p.rateError ? ' · <span class="red">rates: ' + esc(p.rateError) + '</span>' : ''}`
  : p.status === 'failed' ? `<span class="red">✕ Nahi bana: ${esc(p.error || '')}</span>`
  : p.status === 'posting' ? '… PC bill bana raha hai' : '⏳ PC ka intezar (PC on ho)';
const todayLabel = () => { const w = today.filter(p => p.status === 'new' || p.status === 'posting').length; return `📋 Aaj ke app purchase (${today.length})${w ? ' · ' + w + ' intezar' : ''}`; };
function dlg(title, html) {
  const d = $('dialog'); if (!d) return;
  d.classList.remove('search-dialog', 'full-dialog');
  $('dialogTitle').textContent = title; $('dialogBody').innerHTML = html;
  if (!d.open) d.showModal();
}
function openToday() {
  dlg(`Aaj ke app purchase (${today.length})`, todayErr ? `<p>${esc(todayErr)}</p>` : !today.length ? '<p>Aaj app se koi purchase bill nahi bana.</p>' :
    today.map(p => `<details class="sale-hist"><summary><b>${p.editOf ? '✏️ ' + esc(p.editOf.billNo || '') + ' · ' : ''}${esc(p.partyName || '')} · Rs ${num(p.total)}</b><small>${esc(new Date(p.createdAt || 0).toLocaleTimeString('en-PK'))} · ${statusText(p)}</small></summary>
      <div style="overflow-x:auto"><table><thead><tr><th>Item</th><th>Qty</th><th>Khareed</th><th>Rs</th></tr></thead><tbody>
      ${(p.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td>${qtyText(l)}</td><td>${num(l.costP)}/${esc(l.uName || 'Pcs')}</td><td>${num(r2(l.qty * l.costP))}</td></tr>`).join('')}
      </tbody></table></div>${p.invoiceNo ? `<p>Supplier bill # ${esc(p.invoiceNo)}</p>` : ''}${p.note ? `<p>${esc(p.note)}</p>` : ''}</details>`).join(''));
}
function qtyText(l) {
  const pk = Number(l.pack) || 0, q = Number(l.qty) || 0;
  if (pk > 1 && q >= pk) { const c = Math.floor(q / pk + 1e-9), p = r3(q - c * pk); return `${num(c)} ${esc(l.cName || 'Ctn')}${p ? ' + ' + num(p) : ''}`; }
  return `${num(q)} ${esc(l.uName || 'Pcs')}`;
}

// ---------- screen ----------
function supplierBox() {
  const p = partyOf(supplier);
  if (p && !supOpen) return `<div class="pp-sup"><div><small>Supplier</small><b>${esc(p.name)}</b></div><button type="button" data-pp-sup-change>Badlein</button></div>`;
  return `<div class="pp-sup-pick"><label>Supplier chunein<input id="ppSupQ" type="search" placeholder="Naam / mobile (spelling ghalat bhi chalegi)" value="${esc(supQuery)}" autocomplete="off"></label>
    <div class="pp-sup-list">${supList()}</div></div>`;
}
function supList() {
  const q = supQuery.trim();
  const list = rankOf ? rankOf(partiesOf(), q, 25) : partiesOf().filter(x => !x.deleted && matchesOf(x, q)).slice(0, 25);
  return (list.length && !q ? '<small class="pchip-h">⭐ Aksar</small>' : '') + (list.map(x => `<button type="button" data-pp-sup="${esc(x.id)}">${esc(x.name)}</button>`).join('') || `<small>${q ? 'Koi supplier nahi mila' : 'Naam likhein'}</small>`);
}
export function renderPP() {
  installHooks(); watchToday();
  const s = stock();
  const total = cartTotal();
  const gopts = b => s.branches.map(x => `<option value="${x}"${Number(x) === Number(b) ? ' selected' : ''}>${esc(s.branchName(x, s.names))}</option>`).join('');
  $('summary').innerHTML = `<div class="stock-head sale-head pp-head" data-pp-root="1">
    ${edit ? `<div class="pp-edit"><b>✏️ EDIT — POS bill ${esc(edit.billNo || '')}</b><small>Save par yahi bill POS mein UPDATE hoga (naya nahi banega)</small><button type="button" data-pp-edit-off="1">✕ Edit chhodo</button></div>` : ''}
    ${supplierBox()}
    <div class="pp-meta">
      ${s.branches.length ? `<label>Godam (sab items)<select data-pp-godam="1">${gopts(godam)}</select></label>` : ''}
      <label>Supplier bill # <input maxlength="40" data-pp-inv="1" value="${esc(invoiceNo)}" placeholder="ikhtiyari"></label>
    </div>
    <div class="sale-total"><small>Purchase · ${cart.length} items</small><strong id="ppTotal">Rs ${num(total)}</strong></div>
    <div class="account-tools"><button class="sh-wide" id="ppTodayBtn" data-pp-today="1">${todayLabel()}</button>${supplier ? '<button data-pp-copy="1">📑 Pichhla bill copy</button>' : ''}</div>
  </div>`;
  const si = $('search'); if (si) si.placeholder = '📷 scan ya item ka naam / code (Enter)';
  if (s.failed) { $('list').innerHTML = `<div class="empty"><strong>Items nahi mile</strong><p>${esc(s.failed)}</p></div>`; $('actions').innerHTML = ''; return; }
  if (!s.loaded) { $('list').innerHTML = '<p class="stat-note">Items load ho rahe hain…</p>'; $('actions').innerHTML = ''; return; }

  const q = norm(si?.value || '');
  const camRow = `<div class="sale-camrow"><button type="button" class="sale-cam" data-pp-camera="1">📷 Scan</button><button type="button" class="sale-mic" data-pp-mic="1" title="Awaz se">🎤</button><span class="stat-note">Wohi item dobara = +1 ${'Ctn'}</span></div>`;
  let found = '';
  if (q) {
    const hits = smartSearch(s.items, q, 25);
    found = `<div class="sale-found">${hits.length ? hits.map(r => `<button type="button" class="sale-hit" data-pp-add="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.code || '')} · khareed ${num(r.prate)}${Number(r.pack) > 1 ? ' · 1 ' + esc(r.cName || 'Ctn') + ' = ' + num(r.pack) : ''} · stock ${num(r.stock)}</small></button>`).join('') : '<p class="stat-note">Koi item nahi mila</p>'}</div>`;
  }
  if (supplier && !q) loadSupItems(supplier);
  const si2 = supplier && !q ? (supItems.get(supplier)?.list || []).map(x => s.items.find(r => String(r.id) === String(x.id))).filter(Boolean).slice(0, 12) : [];
  if (si2.length) found = `<div class="sale-found"><p class="stat-note" style="margin:0 0 4px">📦 Is supplier se aksar aane wale</p><div class="mchips">${si2.map(r => `<button type="button" data-pp-add="${esc(r.id)}">${esc(r.name)}</button>`).join('')}</div></div>`;
  const bar = cart.length ? `<div class="ws-chips"><small>Wholesale nafa SAB items par (naye khareed ke upar):</small>${W_CHIPS.map(p => `<button type="button" data-pp-wall="${p}">+${p}%</button>`).join('')}<input id="ppWCustom" type="number" inputmode="decimal" min="0" step="0.01" placeholder="apni %"><button type="button" data-pp-wall-custom="1">Lagao</button><button type="button" data-pp-old-all="1">↺ Sab par purana nafa</button></div>` : '';
  const rows = cart.map((l, i) => {
    const pk = packOf(l), pcs = linePcs(l);
    const wN = pct(l.oldW, l.oldCost), rN = pct(l.oldR, l.oldCost);
    const hint = v => v > 0 ? `pehle ${num(v)}` : '—';
    const ch = (v, now) => v > 0 && Math.abs((Number(now) || 0) - v) > 0.004 ? ' changed' : '';
    return `<div class="sale-line pp-line" data-pp-line="${i}">
      <div class="sale-line-top"><b><span class="pp-no">${i + 1}.</span> ${esc(l.name)}</b><button type="button" class="danger sale-x" data-pp-del="${i}" aria-label="Hatao">✕</button></div>
      <small>${esc(l.code)}${pk ? ' · 1 ' + esc(l.cName) + ' = ' + num(pk) : ''} · purana khareed <b>${l.oldCost > 0 ? num(l.oldCost) + '/' + esc(l.uName) + (pk ? ' (' + num(r2(l.oldCost * pk)) + '/' + esc(l.cName) + ')' : '') : 'maloom nahi'}</b>${wN != null ? ' · nafa W ' + wN + '%' : ''}${rN != null ? ' · R ' + rN + '%' : ''}</small>
      <div class="sale-inputs pp-inputs">
        ${pk ? `<label>${esc(l.cName)} (${num(pk)})<input type="number" min="0" step="1" inputmode="numeric" data-pp-ctn="${i}" value="${l.ctn || ''}"></label>` : ''}
        <label>${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-pcs="${i}" value="${l.pcs || ''}"></label>
        ${pk ? `<label>Khareed / ${esc(l.cName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-costc="${i}" value="${l.costP ? r2(l.costP * pk) : ''}"></label>` : ''}
        <label>Khareed / ${esc(l.uName)}<input type="number" min="0" step="any" inputmode="decimal" data-pp-costp="${i}" value="${l.costP ? r2(l.costP) : ''}"></label>
        ${s.branches.length > 1 ? `<label>Godam<select data-pp-lg="${i}">${gopts(l.godam)}</select></label>` : ''}
        <div class="sale-amt"><small>${num(pcs)} ${esc(l.uName)}</small><b id="ppAmt${i}">${num(lineTotal(l))}</b></div>
      </div>
      <div class="pp-rates">
        <small class="pp-rates-h">Naye rates (POS mein lagenge)${l.wMode === 'old' && l.rMode === 'old' ? ' · purane nafa se' : ''}</small>
        <div class="pp-rate-grid">
          ${pk ? `<label>Wholesale ${esc(l.cName)}<input class="${ch(r2(l.oldW * pk), l.wctn)}" type="number" min="0" step="any" inputmode="decimal" data-pp-wctn="${i}" value="${l.wctn || ''}" placeholder="${hint(Math.round(l.oldW * pk))}"><small>${hint(Math.round(l.oldW * pk))}</small></label>` : ''}
          <label>Wholesale ${esc(l.uName)}<input class="${ch(l.oldW, l.wpcs)}" type="number" min="0" step="any" inputmode="decimal" data-pp-wpcs="${i}" value="${l.wpcs || ''}"><small>${hint(l.oldW)}</small></label>
          ${pk ? `<label>Parchoon ${esc(l.cName)}<input class="${ch(Math.round(l.oldR * pk), l.rctn)}" type="number" min="0" step="any" inputmode="decimal" data-pp-rctn="${i}" value="${l.rctn || ''}"><small>${hint(Math.round(l.oldR * pk))}</small></label>` : ''}
          <label>Parchoon ${esc(l.uName)}<input class="${ch(pk ? l.oldR2 : l.oldR, l.rpcs)}" type="number" min="0" step="any" inputmode="decimal" data-pp-rpcs="${i}" value="${l.rpcs || ''}"><small>${hint(pk ? l.oldR2 : l.oldR)}</small></label>
        </div>
        <div class="mchips">${l.oldCost > 0 ? `<button type="button" class="${l.wMode === 'old' && l.rMode === 'old' ? 'on' : ''}" data-pp-old="${i}">↺ Purana nafa${wN != null ? ' W ' + wN + '%' : ''}${rN != null ? ' · R ' + rN + '%' : ''}</button>` : ''}${W_CHIPS.map(p => `<button type="button" class="${l.wMode === p ? 'on' : ''}" data-pp-w="${i}:${p}">W +${p}%</button>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
  const foot = cart.length ? `<div class="sale-pay"><label>Note (ikhtiyari)<input maxlength="100" data-pp-note="1" value="${esc(note)}"></label>
    <p class="stat-note">Bill POS mein baqi bills jaisa (credit, open) banega — post baad mein "📌 post" se. Payment ki entry pehle jaisi alag.</p></div>` : '';
  $('list').innerHTML = camRow + found + (cart.length ? bar + `<div class="sale-cart">${rows}</div>` + foot :
    (q ? '' : `<div class="empty"><strong>Naya purchase bill</strong><p>Upar supplier chunein, phir item ka naam likhein ya 📷 se scan karein.</p></div>`));
  $('actions').innerHTML = cart.length ? `<button class="give" data-pp-clear="1">✕ Naya bill</button><button data-pp-camera="1" title="Barcode scan">📷</button>
    <button class="got" data-pp-save="1"${saving ? ' disabled' : ''}>${saving ? 'Bhej raha hoon…' : saveLabel(total)}</button>` : '';
}
const saveLabel = t => (edit ? '💾 POS bill UPDATE · Rs ' : '💾 POS mein bhejo · Rs ') + num(t);
function refreshTotals() {
  const t = $('ppTotal'); if (t) t.textContent = 'Rs ' + num(cartTotal());
  cart.forEach((l, i) => { const a = $('ppAmt' + i); if (a) a.textContent = num(lineTotal(l)); });
  const b = document.querySelector('[data-pp-save]'); if (b && !saving) b.textContent = saveLabel(cartTotal());
}
// rates ke khane (focus kharab kiye baghair) taza karo
function paintRates(i) {
  const l = cart[i]; if (!l) return;
  for (const [k, v] of [['wctn', l.wctn], ['wpcs', l.wpcs], ['rctn', l.rctn], ['rpcs', l.rpcs], ['costc', l.costP ? r2(l.costP * packOf(l)) : ''], ['costp', l.costP ? r2(l.costP) : '']]) {
    const el = document.querySelector(`[data-pp-${k}="${i}"]`);
    if (el && document.activeElement !== el) el.value = v || '';
  }
}

// ---------- events ----------
const inPP = t => !!t?.closest?.('#list,#summary') && !!document.querySelector('[data-pp-root]');
document.addEventListener('input', e => {
  const t = e.target;
  if (t?.id === 'ppSupQ') { supQuery = t.value; const box = t.closest('.pp-sup-pick')?.querySelector('.pp-sup-list');
    if (box) box.innerHTML = supList(); return; }
  if (!inPP(t)) return;
  const d = t.dataset; let i;
  if ((i = d.ppCtn) != null) cart[i].ctn = Math.max(0, Math.floor(Number(t.value) || 0));
  else if ((i = d.ppPcs) != null) cart[i].pcs = Math.max(0, Number(t.value) || 0);
  else if ((i = d.ppCostc) != null) { const l = cart[i]; l.costP = packOf(l) ? r4((Number(t.value) || 0) / packOf(l)) : Number(t.value) || 0; recalc(l); paintRates(i); }
  else if ((i = d.ppCostp) != null) { const l = cart[i]; l.costP = r4(Number(t.value) || 0); recalc(l); paintRates(i); }
  else if ((i = d.ppWctn) != null) { cart[i].wctn = Number(t.value) || 0; cart[i].wMode = 'manual'; }
  else if ((i = d.ppWpcs) != null) { cart[i].wpcs = Number(t.value) || 0; cart[i].wMode = 'manual'; }
  else if ((i = d.ppRctn) != null) { cart[i].rctn = Number(t.value) || 0; cart[i].rMode = 'manual'; }
  else if ((i = d.ppRpcs) != null) { cart[i].rpcs = Number(t.value) || 0; cart[i].rMode = 'manual'; }
  else if (d.ppNote != null) note = t.value.slice(0, 100);
  else if (d.ppInv != null) invoiceNo = t.value.slice(0, 40);
  else return;
  keepDraft(); refreshTotals();
});
document.addEventListener('change', e => {
  const t = e.target; if (!inPP(t)) return;
  if (t.dataset.ppGodam != null) {
    godam = Number(t.value);
    if (cart.length && confirm('Sab items ka godam bhi yahi kar dein?')) cart.forEach(l => { l.godam = godam; });
    keepDraft(); rerender(); return;
  }
  if (t.dataset.ppLg != null) { const l = cart[t.dataset.ppLg]; if (l) { l.godam = Number(t.value); keepDraft(); } return; }
  if (t.dataset.ppDay != null) { day = t.value; keepDraft(); return; }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target?.id !== 'search' || !document.querySelector('[data-pp-root]')) return;
  const v = e.target.value.trim(); if (!v) return;
  e.preventDefault();
  const { items } = stock();
  let it = findByCode(items, v);
  if (!it) { const hs = smartSearch(items, v, 2); if (hs.length === 1) it = hs[0]; }
  if (!it) { notice('Ek item nahi mila — list se chunein'); return; }
  const r = addItem(it); e.target.value = ''; notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`); rerender(); focusLine(r.line.k);
});
function focusLine(k) {
  setTimeout(() => { const i = cart.findIndex(l => l.k === k); const box = document.querySelector(`[data-pp-ctn="${i}"]`) || document.querySelector(`[data-pp-pcs="${i}"]`);
    if (box) { box.scrollIntoView({ block: 'center' }); } }, 60);
}
document.addEventListener('click', async e => {
  if (!document.querySelector('[data-pp-root]')) return;
  const mic = e.target.closest?.('[data-pp-mic]');
  if (mic) { const ok = voiceSearch(t => { const s = $('search'); if (s) { s.value = t; s.dispatchEvent(new Event('input', { bubbles: true })); } }); if (!ok) notice('Is phone/browser mein awaz se search nahi chalti'); return; }
  const off = e.target.closest?.('[data-pp-edit-off]');
  if (off) { if (!confirm('Edit chhor dein? (POS ka bill waisa hi rahega; screen saaf ho jayegi)')) return; edit = null; cart = []; note = ''; invoiceNo = ''; day = ''; keepDraft(); rerender(); return; }
  const t = e.target.closest?.('[data-pp-sup],[data-pp-sup-change],[data-pp-add],[data-pp-del],[data-pp-clear],[data-pp-save],[data-pp-today],[data-pp-camera],[data-pp-old],[data-pp-w],[data-pp-wall],[data-pp-wall-custom],[data-pp-old-all],[data-pp-copy]');
  if (!t) return;
  const d = t.dataset;
  if (d.ppSup) { supplier = d.ppSup; notePartyPick(supplier); supOpen = false; supQuery = ''; keepDraft(); rerender(); return; }
  if (d.ppSupChange != null) { supOpen = true; rerender(); setTimeout(() => $('ppSupQ')?.focus(), 50); return; }
  if (d.ppAdd) { const it = stock().items.find(r => String(r.id) === d.ppAdd); if (it) { const r = addItem(it); const s = $('search'); if (s) s.value = ''; notice(r.again ? `+1 · ${it.name}` : `✓ ${it.name}`); rerender(); focusLine(r.line.k); } return; }
  if (d.ppDel != null) { cart.splice(Number(d.ppDel), 1); keepDraft(); rerender(); return; }
  if (d.ppClear) { if (!confirm(edit ? 'Edit chhor kar screen saaf kar dein? (POS ka bill waisa hi rahega)' : 'Yeh purchase bill saaf kar dein?')) return; cart = []; note = ''; invoiceNo = ''; edit = null; day = ''; keepDraft(); rerender(); return; }
  if (d.ppCamera) { openSaleCamera(); return; }
  if (d.ppToday) { openToday(); return; }
  if (d.ppOld != null) { const l = cart[d.ppOld]; if (l) { l.wMode = 'old'; l.rMode = 'old'; recalc(l); keepDraft(); rerender(); } return; }
  if (d.ppW) { const [i, p] = d.ppW.split(':'); const l = cart[i]; if (l) { l.wMode = Number(p); recalc(l); keepDraft(); rerender(); } return; }
  if (d.ppWall || d.ppWallCustom) {
    const p = Number(d.ppWall || $('ppWCustom')?.value) || 0; if (!(p > 0)) { notice('Pehle % likhein'); return; }
    cart.forEach(l => { l.wMode = p; recalc(l); }); keepDraft(); rerender(); notice(`Wholesale +${p}% sab items par`); return;
  }
  if (d.ppOldAll) { cart.forEach(l => { l.wMode = 'old'; l.rMode = 'old'; recalc(l); }); keepDraft(); rerender(); return; }
  if (d.ppCopy) { copyLast(t); return; }
  if (d.ppSave) save();
});

// isi supplier ka app se bana aakhri bill — items/tadad/khareed wapas (rates naye hisaab se)
async function copyLast(btn) {
  if (!cloud?.appPurchasesOf || !supplier) return;
  if (cart.length && !confirm('Maujooda items ke saath pichhle bill ke items bhi jor dein?')) return;
  btn.disabled = true;
  try {
    const list = (await cloud.appPurchasesOf(supplier)).filter(p => p.status !== 'failed').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const last = list[0];
    if (!last) { notice('Is supplier ka app se koi pichhla bill nahi (pehla bill yahin se banayein)'); return; }
    const { items } = stock(); let n = 0;
    for (const x of last.lines || []) {
      const it = items.find(r => String(r.id) === String(x.id)); if (!it) continue;
      const r = addItem(it, false), l = r.line, pk = packOf(l), q = Number(x.qty) || 0;
      l.ctn = pk ? Math.floor(q / pk + 1e-9) : 0; l.pcs = pk ? r3(q - l.ctn * pk) : q;
      if (Number(x.costP) > 0) { l.costP = r4(x.costP); recalc(l); }
      l.godam = Number(x.godam) || l.godam; n++;
    }
    keepDraft(); rerender(); notice(`${n} items pichhle bill (${last.date}) se aa gaye — ginti/rate check karein`);
  } catch (err) { notice('Pichhla bill nahi mila: ' + (err?.message || err)); }
  finally { btn.disabled = false; }
}

async function save() {
  if (saving) return;
  if (!canUse()) { notice('Is login par POS purchase ki ijazat nahi'); return; }
  const p = partyOf(supplier);
  if (!p) { notice('Pehle supplier chunein'); supOpen = true; rerender(); return; }
  const lines = [], zero = [], noCost = [];
  for (const l of cart) {
    const qty = linePcs(l);
    if (!(qty > 0)) { zero.push(l.name); continue; }
    if (!(Number(l.costP) > 0)) noCost.push(l.name);
    lines.push({ id: String(l.id), code: String(l.code || ''), name: String(l.name || '').slice(0, 120), pack: Number(l.pack) || 0,
      cName: String(l.cName || 'Ctn'), uName: String(l.uName || 'Pcs'), godam: Number(l.godam) || Number(godam) || BILL_BRANCH,
      qty: r3(qty), costP: r4(l.costP), wctn: r2(l.wctn), wpcs: r2(l.wpcs), rctn: r2(l.rctn), rpcs: r2(l.rpcs) });
  }
  if (!lines.length) { notice('Kisi item ki ginti likhein'); return; }
  if (noCost.length) { alert('In items ka khareed rate khali hai:\n\n' + noCost.join('\n')); return; }
  if (zero.length && !confirm('Jin items ki ginti khali hai woh bill mein nahi jayenge:\n' + zero.join('\n') + '\n\nTheek hai?')) return;
  const low = cart.filter(l => linePcs(l) > 0 && ((Number(l.wpcs) > 0 && Number(l.wpcs) < Number(l.costP)) || (Number(l.rpcs) > 0 && Number(l.rpcs) < Number(l.costP)))).map(l => l.name);
  if (low.length && !confirm('Dhyan: in items ka naya sale rate KHAREED SE KAM hai:\n\n' + low.join('\n') + '\n\nPhir bhi bhejein?')) return;
  const total = r2(lines.reduce((n, l) => n + l.qty * l.costP, 0));
  const date = todayStr();   // v1.93.1: tareekh ka khana nahi — naya bill hamesha AAJ ka
  const date2 = edit ? edit.date : date;   // edit: bill ki apni purani tareekh
  if (!confirm(`${edit ? 'POS BILL ' + edit.billNo + ' — UPDATE' : 'POS PURCHASE BILL'}\n${p.name}\n${lines.length} items · Rs ${num(total)}${invoiceNo ? '\nSupplier bill # ' + invoiceNo : ''}\n\n${edit ? 'POS mein yahi bill badlein (purani lines hat kar yeh lagengi) aur naye rates lagayein?' : 'POS mein bill banayein aur naye rates lagayein?'}`)) return;
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const doc = { id, date: date2, at: new Date().toISOString(), branch: BILL_BRANCH, godam: Number(godam) || BILL_BRANCH,
    partyId: String(p.id), partyName: String(p.name || '').slice(0, 120), invoiceNo: invoiceNo.trim(), note: note.trim(),
    lines, total, role: isOwner() ? 'owner' : 'staff', by: uidOf(), status: 'new', createdAt: Date.now(),
    ...(edit ? { editOf: { purchaseId: Number(edit.purchaseId), billNo: String(edit.billNo || ''), stamp: String(edit.stamp || ''), partyId: String(edit.partyId || ''), posPartyId: Number(edit.posPartyId) || 0 } } : {}) };
  saving = true; rerender();
  try {
    const w = cloud.saveAppPurchase(doc);
    await Promise.race([w, new Promise(r => setTimeout(r, 4000))]);
    const keep = { cart, invoiceNo, note, edit, day };
    cart = []; note = ''; invoiceNo = ''; edit = null; day = ''; keepDraft();
    notice(keep.edit ? 'Update PC ko bhej diya — PC POS mein wohi bill badal dega (Aaj ke app purchase mein status)' : 'Purchase bill bhej diya — PC POS mein bana dega (Aaj ke app purchase mein status)');
    w.catch(err => {
      if (!cart.length) { cart = keep.cart; invoiceNo = keep.invoiceNo; note = keep.note; edit = keep.edit; day = keep.day; keepDraft(); rerender(); }
      alert('Purchase bill PC tak NAHI gaya: ' + (err?.message || err) + '\nBill wapas screen par hai — dobara bhejein.');
    });
  } catch (err) { notice('Nahi gaya: ' + (err?.message || err)); }
  finally { saving = false; rerender(); }
}

// ---------- v1.87: is supplier se aksar aane wale items (app ke bills + POS ke pichhle 6 bills) ----------
async function loadSupItems(pid) {
  if (!pid || supItems.has(pid) || !cloud) return;
  supItems.set(pid, { loading: true, list: [] });
  try {
    const cnt = new Map(), add = id => { if (id != null && id !== '') cnt.set(String(id), (cnt.get(String(id)) || 0) + 1); };
    const apps = cloud.appPurchasesOf ? await cloud.appPurchasesOf(pid).catch(() => []) : [];
    apps.filter(p => p.status !== 'failed').forEach(p => (p.lines || []).forEach(l => add(l.id)));
    const { items } = stock();
    for (const id of billIdsOf(pid).slice(0, 6)) {
      const b = await cloud.purchaseBill(id).catch(() => null);
      for (const l of b?.lines || []) {
        if (l.itemId) { add(l.itemId); continue; }
        const it = items.find(r => norm(r.name) === norm(l.name)) || items.find(r => l.code && String(r.code) === String(l.code));
        if (it) add(it.id);
      }
    }
    supItems.set(pid, { loading: false, list: [...cnt].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n).slice(0, 12) });
  } catch { supItems.set(pid, { loading: false, list: [] }); }
  if (document.querySelector('[data-pp-root]') && supplier === pid && !$('search')?.value.trim()) rerender();
}

// ---------- v1.87: POS ka KHULA bill is screen par (edit) ----------
// b = posBills doc (sync-bills v5: purchaseId, stamp, posPartyId, invoiceNo, lines[{itemId, qtyPcs, ratePcs, godamId}])
export function ppLoadBill(b, ent) {
  if (!b || !Number(b.purchaseId) || !b.stamp || !(b.lines || []).every(l => l.itemId)) return 'Is bill ki poori tafseel abhi nahi aayi — PC par nayi sync-bills.js lagayein, 2 minute baad dobara kholein.';
  const s = stock();
  if (!s.loaded) return 'Items abhi load ho rahe hain — thori der baad dobara dabayein.';
  if (cart.length && !confirm('POS Purchase screen par pehle se items hain — woh hata kar yeh bill kholein?')) return 'cancel';
  const missing = [], next = [];
  const gcount = new Map();
  for (const x of b.lines) {
    const it = s.items.find(r => String(r.id) === String(x.itemId));
    if (!it) { missing.push(x.name); continue; }
    const o = oldOf(it), pk = Number(it.pack) > 1 ? Number(it.pack) : 0, q = Number(x.qtyPcs) || 0;
    const g = Number(x.godamId) || BILL_BRANCH; gcount.set(g, (gcount.get(g) || 0) + 1);
    next.push({ k: newKey(), id: it.id, code: it.code || '', name: it.name, pack: Number(it.pack) || 0, cName: it.cName || 'Ctn', uName: it.uName || 'Pcs',
      godam: g, ctn: pk ? Math.floor(q / pk + 1e-9) : 0, pcs: pk ? r3(q - Math.floor(q / pk + 1e-9) * pk) : q, costP: r4(Number(x.ratePcs) || o.oldCost), ...o,
      wpcs: o.oldW, wctn: pk ? Math.round(o.oldW * pk) : 0, rpcs: pk ? o.oldR2 : o.oldR, rctn: pk ? Math.round(o.oldR * pk) : 0, wMode: 'old', rMode: 'old' });
  }
  if (missing.length) return 'Yeh items POS stock list mein nahi mile, is liye edit nahi ho sakta:\n' + missing.join('\n');
  cart = next;
  godam = [...gcount].sort((a, c) => c[1] - a[1])[0]?.[0] ?? BILL_BRANCH;
  supplier = String(ent?.partyId || ''); supOpen = !partyOf(supplier); supQuery = '';
  day = b.date || ''; invoiceNo = String(b.invoiceNo || ''); note = '';
  edit = { purchaseId: Number(b.purchaseId), billNo: String(b.billNo || ''), stamp: String(b.stamp), partyId: supplier, posPartyId: Number(b.posPartyId) || 0, date: b.date || todayStr() };
  keepDraft();
  return '';
}
