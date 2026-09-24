// ============================================================
//  POS Ledger screen
//  POS (SQL Server) se aayi purchase entries dikhata hai.
//  Sirf padhne ke liye - yahan se kuch edit ya delete nahi hota.
//  Data: businesses/noor-traders/posLedger
// ============================================================

import { partyScore } from './smart-search.js?v=2.12.0';
import { money } from './model.js';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let deps = null;          // { cloud, rerender, notice }
let unsub = null;
let state = 'idle';       // idle | loading | ready | error
let errorMsg = '';
let rows = [];
let supplier = null;      // selected partyId
let from = '';
let to = '';
let wired = false;

// ---------- app.js is se baat karta hai ----------

export function posSetup(d) { deps = d; }

export function posStop() {
  if (unsub) { unsub(); unsub = null; }
  state = 'idle'; rows = []; supplier = null; errorMsg = '';
}

// Back button dabane par: pehle supplier se wapas, phir screen se
export function posBack() {
  if (supplier) { supplier = null; return true; }
  return false;
}

export function posHasSelection() { return !!supplier; }

// ---------- data ----------

function start() {
  if (state !== 'idle' || !deps) return;
  state = 'loading';
  try {
    unsub = deps.cloud.listenPOS(
      list => { rows = list; state = 'ready'; deps.rerender(); },
      err => { state = 'error'; errorMsg = err?.message || 'Data load nahi hua'; deps.rerender(); }
    );
  } catch (e) {
    state = 'error';
    errorMsg = e?.message || 'POS ledger available nahi';
  }
}

function inRange(r) {
  if (from && r.date < from) return false;
  if (to && r.date > to) return false;
  return true;
}

const pmemo = new Map();   // v1.87: smart search (spelling ki ghalti bhi) — party naam par
function matches(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  if (String(r.partyName || '').toLowerCase().includes(s)
      || String(r.partyPhone || '').includes(s)
      || String(r.note || '').toLowerCase().includes(s)) return true;
  const k = (r.partyName || '') + '|' + (r.partyPhone || '');
  let o = pmemo.get(k); if (!o) { o = { name: r.partyName || '', phone: r.partyPhone || '' }; pmemo.set(k, o); }
  return partyScore(o, q) > 0;
}

function suppliers(list) {
  const m = new Map();
  for (const r of list) {
    const key = r.partyId || 'unknown';
    if (!m.has(key)) m.set(key, { id: key, name: r.partyName || 'Supplier', phone: r.partyPhone || '', total: 0, count: 0, last: '' });
    const s = m.get(key);
    s.total += Number(r.amount) || 0;
    s.count++;
    if (r.date > s.last) s.last = r.date;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

// ---------- screen ----------

export function renderPOS() {
  wire();

  if (state === 'idle') start();

  if (state === 'loading') {
    $('summary').innerHTML = '';
    $('list').innerHTML = '<p>POS data load ho raha hai…</p>';
    $('actions').innerHTML = '';
    return;
  }

  if (state === 'error') {
    $('summary').innerHTML = '';
    $('list').innerHTML = `<p>POS ledger nahi khul saka.</p><p><small>${esc(errorMsg)}</small></p>`;
    $('actions').innerHTML = '<button data-pos-retry>Dobara koshish karein</button>';
    return;
  }

  const q = $('search').value;
  const ranged = rows.filter(inRange);

  const dateBar = `<div class="pos-dates">
    <label>Se<input type="date" data-pos-from value="${esc(from)}"></label>
    <label>Tak<input type="date" data-pos-to value="${esc(to)}"></label>
    ${(from || to) ? '<button data-pos-clear class="outline">Clear</button>' : ''}
  </div>`;

  if (!supplier) {
    const list = suppliers(ranged.filter(r => matches(r, q)));
    const total = list.reduce((n, s) => n + s.total, 0);
    const bills = list.reduce((n, s) => n + s.count, 0);

    $('summary').innerHTML =
      `<div><small>Kul purchase</small><strong>${money(total)}</strong></div>` +
      `<div><small>Suppliers</small><strong>${list.length}</strong></div>` +
      `<div><small>Bills</small><strong>${bills}</strong></div>`;

    $('list').innerHTML = dateBar +
      '<p><small>POS se aaya hua data. Yahan sirf dekha ja sakta hai — entry POS mein hoti hai.</small></p>' +
      (list.length
        ? list.map(s => `<article class="ledger-item" data-pos-open="${esc(s.id)}">
            <b>${esc(s.name)}</b>
            <strong>${money(s.total)}</strong>
            <small>${s.count} bill${s.count > 1 ? 's' : ''} · akhri ${esc(s.last || '-')}</small>
            ${s.phone ? `<p>${esc(s.phone)}</p>` : ''}
          </article>`).join('')
        : '<p>Is arse mein koi purchase nahi mili.</p>');

    $('actions').innerHTML = '';
    return;
  }

  // ek supplier ki detail
  const mine = ranged.filter(r => (r.partyId || 'unknown') === supplier);
  const name = mine[0]?.partyName || rows.find(r => r.partyId === supplier)?.partyName || 'Supplier';
  const total = mine.reduce((n, r) => n + (Number(r.amount) || 0), 0);

  $('summary').innerHTML =
    `<div><small>${esc(name)}</small><strong>${money(total)}</strong></div>` +
    `<div><small>Bills</small><strong>${mine.length}</strong></div>`;

  const sorted = [...mine].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  $('list').innerHTML =
    '<button data-pos-close class="outline">‹ Supplier list</button>' + dateBar +
    (sorted.length
      ? sorted.map(r => `<article class="ledger-item">
          <b>${esc(r.note || 'Purchase')}</b>
          <strong>${money(Number(r.amount) || 0)}</strong>
          <small>${esc(r.date)}</small>
        </article>`).join('')
      : '<p>Is arse mein koi purchase nahi.</p>');

  $('actions').innerHTML = '';
}

// ---------- clicks ----------

function wire() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', e => {
    const open = e.target.closest('[data-pos-open]');
    if (open) { supplier = open.dataset.posOpen; deps.rerender(); return; }

    if (e.target.closest('[data-pos-close]')) { supplier = null; deps.rerender(); return; }

    if (e.target.closest('[data-pos-clear]')) { from = ''; to = ''; deps.rerender(); return; }

    if (e.target.closest('[data-pos-retry]')) { posStop(); deps.rerender(); return; }
  });

  document.addEventListener('change', e => {
    if (e.target.matches('[data-pos-from]')) { from = e.target.value; deps.rerender(); }
    if (e.target.matches('[data-pos-to]')) { to = e.target.value; deps.rerender(); }
  });
}
