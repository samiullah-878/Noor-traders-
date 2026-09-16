// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);

const MAX_ROWS = 300;   // itni se zyada rows par search karne ka kehta hai

let cloud = null, rerender = () => {}, notice = () => {};
let stop = null, rows = [], loaded = false, failed = '';
let branch = null, sort = 'name', filter = 'all';
let counts = new Map(), round = '', stopCount = null, isOwner = () => false;

export function stockSetup(opts) {
  cloud = opts.cloud;
  rerender = opts.rerender || (() => {});
  notice = opts.notice || (() => {});
  isOwner = opts.owner || (() => false);
}

function start() {
  if (stop || !cloud) return;
  loaded = false; failed = '';
  stop = cloud.listenStock(
    list => { rows = list; loaded = true; failed = ''; rerender(); },
    e => { failed = e?.message || 'Stock load nahi hua'; loaded = true; rerender(); }
  );
  if (cloud.listenStockCount) {
    stopCount = cloud.listenStockCount(list => {
      counts = new Map();
      round = list.find(r => r.id === '_round')?.round || '';
      list.forEach(r => { if (r.id !== '_round') counts.set(r.id, r); });
      rerender();
    }, () => {});
  }
}

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

export function stockStop() {
  if (stop) { stop(); stop = null; }
  if (stopCount) { stopCount(); stopCount = null; }
  counts = new Map(); round = '';
  rows = []; loaded = false; failed = '';
}

export function stockBack() { stockStop(); }

// ---------- data ----------

function collect() {
  const chunks = rows.filter(r => !r.meta && Array.isArray(r.items));
  const branches = [...new Set(chunks.map(c => c.branch))].sort((a, b) => a - b);
  const pick = branches.includes(branch) ? branch : branches[0];
  const items = chunks
    .filter(c => c.branch === pick)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap(c => c.items);
  const meta = rows.find(r => r.meta && r.branch === pick) || null;
  const names = {};
  rows.forEach(r => { if (r.branch != null && r.name) names[r.branch] = r.name; });
  return { branches, pick, items, meta, names };
}

const passes = r => {
  if (filter === 'minus') return r.stock < 0;
  if (filter === 'baqi') return !countOf(pickedBranch, r);
  if (filter === 'farq') { const c = countOf(pickedBranch, r); return c && Math.abs(countedPcs(c) - r.stock) > 0.001; }
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

export function renderStock() {
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

  let shown = items.filter(passes);
  if (q) shown = shown.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q));

  if (sort === 'stock') shown.sort((a, b) => b.stock - a.stock);
  else shown.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const extra = shown.length - MAX_ROWS;
  const list = shown.slice(0, MAX_ROWS);

  $('list').innerHTML =
    (q ? `<p class="stat-note">${shown.length} item mile</p>` : '') +
    list.map(rowHTML).join('') +
    (extra > 0 ? `<p class="stat-note">…aur ${num(extra)} items. Naam ya code search karein.</p>` : '');
}

function summaryHTML(branches, pick, items, meta, names) {
  const totalPcs = meta?.totalPcs ?? items.reduce((s, r) => s + (r.stock || 0), 0);
  const stamp = meta?.syncedAt;

  const branchBar = branches.length > 1
    ? `<div class="account-tools">${branches.map(b =>
        `<button data-stock-branch="${b}"${b === pick ? ' class="selected"' : ''}>${esc(branchName(b, names))}</button>`
      ).join('')}</div>`
    : '';

  const minus = items.filter(r => r.stock < 0).length;
  const done = items.filter(r => countOf(pick, r)).length;
  const gap = items.filter(r => { const c = countOf(pick, r); return c && Math.abs(countedPcs(c) - r.stock) > 0.001; }).length;
  const shownCount = items.filter(passes).length;
  return `<div>
      <strong>${num(shownCount)} items</strong>
      <small>${esc(branchName(pick, names))} · kul ${num(totalPcs)} pcs${stamp ? ' · ' + esc(since(stamp)) : ''}</small>
    </div>
    ${branchBar}
    <div class="account-tools">
      <button data-stock-filter="all"${filter === 'all' ? ' class="selected"' : ''}>Sab</button>
      <button data-stock-filter="minus"${filter === 'minus' ? ' class="selected"' : ''}>Minus stock (${num(minus)})</button>
      <button data-stock-filter="baqi"${filter === 'baqi' ? ' class="selected"' : ''}>Ginti baqi (${num(items.length - done)})</button>
      <button data-stock-filter="farq"${filter === 'farq' ? ' class="selected"' : ''}>Farq wale (${num(gap)})</button>
    </div>
    <div class="account-tools">
      <small style="align-self:center">${round ? 'Ginti ' + esc(round) + ' — ' + num(done) + ' / ' + num(items.length) + ' hue' : 'Ginti shuru nahi hui'}</small>
      ${isOwner() ? '<button data-stock-round="new">Nayi ginti shuru</button>' : ''}
    </div>
    <div class="account-tools">
      <button data-stock-sort="name"${sort === 'name' ? ' class="selected"' : ''}>Naam se</button>
      <button data-stock-sort="stock"${sort === 'stock' ? ' class="selected"' : ''}>Zyada stock pehle</button>
    </div>`;
}

function countHTML(r) {
  const c = countOf(pickedBranch, r);
  const diff = c ? countedPcs(c) - r.stock : 0;
  return `<div class="pos-dates" style="margin:0 4px 14px">
    <label>Ctn<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-ctn="${esc(r.id)}" value="${c ? esc(String(c.ctn ?? '')) : ''}"></label>
    <label>${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:4.6em" data-count-pcs="${esc(r.id)}" value="${c ? esc(String(c.pcs ?? '')) : ''}"></label>
    <label>Kul ${esc(r.uName || 'Pcs')}<input type="number" step="any" inputmode="decimal" style="width:5.6em" data-count-tot="${esc(r.id)}" value=""></label>
    <button type="button" data-count-save="${esc(r.id)}">Save</button>
    ${c ? `<small style="align-self:center">Ginti ${num(countedPcs(c))} · Farq ${diff > 0 ? '+' : ''}${num(diff)}${
      isOwner() && r.prate ? ' · Rs ' + (diff > 0 ? '+' : '') + num(diff * r.prate) : ''}</small>` : ''}
  </div>
  ${historyHTML(r, c)}`;
}

function historyHTML(r, c) {
  const list = Array.isArray(c?.history) ? c.history.slice().reverse() : [];
  if (!list.length) return '';
  return `<div class="stat-note" style="margin:0 4px 12px">${list.map(h => {
    const d = Number(h.total) - Number(h.sys);
    return `${esc(stampText(h.at))} — ${num(h.total)} ${esc(r.uName || 'Pcs')} · System ${num(h.sys)} · Farq ${d > 0 ? '+' : ''}${num(d)}${
      isOwner() && r.prate ? ' · Rs ' + (d > 0 ? '+' : '') + num(d * r.prate) : ''}`;
  }).join('<br>')}</div>`;
}

function rowHTML(r) {
  const pack = Number(r.pack) || 0;
  const big = pack > 0
    ? `${num(r.ctn)} ${esc(r.cName || 'Ctn')} + ${num(r.pcs)} ${esc(r.uName || 'Pcs')}`
    : `${num(r.stock)} ${esc(r.uName || 'Pcs')}`;

  return `<div style="border-bottom:1px solid #edf1f7">
    <div class="party" style="border-bottom:0">
    <div class="name">
      <b>${esc(r.name)}</b>
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · Rate ' + num(r.rate) : ''}${isOwner() && r.prate ? ' · Khareed ' + num(r.prate) : ''}</small>
    </div>
    <div class="amount">
      <strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>
    </div>
    </div>
    ${countHTML(r)}
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { branch = Number(b.dataset.stockBranch); rerender(); return; }
  const s = e.target.closest?.('[data-stock-sort]');
  if (s) { sort = s.dataset.stockSort; rerender(); return; }
  const f = e.target.closest?.('[data-stock-filter]');
  if (f) { filter = f.dataset.stockFilter; rerender(); return; }

  const nr = e.target.closest?.('[data-stock-round]');
  if (nr) { startNewRound(); return; }

  const sv = e.target.closest?.('[data-count-save]');
  if (sv) saveCount(sv.dataset.countSave, sv);
});

async function startNewRound() {
  if (!cloud?.setStockRound) return;
  const label = new Date().toISOString().slice(0, 10);
  if (!confirm('Nayi ginti shuru karein? Purani ginti hat jayegi.')) return;
  try { await cloud.setStockRound(label); notice('Nayi ginti shuru — ' + label); }
  catch (e) { notice(e?.message || 'Nahi hua'); }
}

async function saveCount(itemId, button) {
  if (!round) { notice('Pehle "Nayi ginti shuru" dabayein'); return; }
  const { items } = collect();
  const item = items.find(r => String(r.id) === String(itemId));
  if (!item) return;

  const box = sel => $('list').querySelector(`[data-count-${sel}="${CSS.escape(String(itemId))}"]`);
  const per = Number(item.pack) || 0;
  const rawTot = (box('tot')?.value ?? '').trim();
  let ctn, pcs, total;

  if (rawTot !== '') {
    // Sirf kul pieces likhe gaye — carton khud ban jayega
    total = Math.round(Number(rawTot) * 100) / 100;
    ctn = per > 1 ? Math.floor(total / per) : 0;
    pcs = Math.round((total - ctn * (per > 1 ? per : 0)) * 100) / 100;
  } else {
    ctn = Number(box('ctn')?.value || 0);
    pcs = Number(box('pcs')?.value || 0);
    total = Math.round((ctn * (per > 0 ? per : 1) + pcs) * 100) / 100;
  }

  const at = Date.now();
  const old = counts.get(countId(pickedBranch, item.id));
  const past = Array.isArray(old?.history) ? old.history : [];
  const history = [...past, { at, ctn, pcs, total, sys: item.stock }].slice(-20);

  button.disabled = true;
  try {
    await cloud.saveStockCount({
      id: countId(pickedBranch, item.id),
      round, branch: pickedBranch, itemId: item.id,
      name: item.name, sys: item.stock,
      ctn, pcs, total, at, history
    });
    notice(item.name + ' — ginti mehfooz');
  } catch (e) {
    notice(e?.message || 'Ginti save nahi hui');
  } finally {
    button.disabled = false;
  }
}
