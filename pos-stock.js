// pos-stock.js — POS ka stock (posStock collection) app mein dikhata hai
// Data sirf padha jata hai. Likhne ka kaam PC par chalne wala sync-stock.js karta hai.

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);

const MAX_ROWS = 300;   // itni se zyada rows par search karne ka kehta hai

let cloud = null, rerender = () => {}, notice = () => {};
let stop = null, rows = [], loaded = false, failed = '';
let branch = null, sort = 'name';

export function stockSetup(opts) {
  cloud = opts.cloud;
  rerender = opts.rerender || (() => {});
  notice = opts.notice || (() => {});
}

function start() {
  if (stop || !cloud) return;
  loaded = false; failed = '';
  stop = cloud.listenStock(
    list => { rows = list; loaded = true; failed = ''; rerender(); },
    e => { failed = e?.message || 'Stock load nahi hua'; loaded = true; rerender(); }
  );
}

export function stockStop() {
  if (stop) { stop(); stop = null; }
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

  let shown = q
    ? items.filter(r => norm(r.name).includes(q) || norm(r.code).includes(q))
    : items.slice();

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

  return `<div>
      <strong>${num(items.length)} items</strong>
      <small>${esc(branchName(pick, names))} · kul ${num(totalPcs)} pcs${stamp ? ' · ' + esc(since(stamp)) : ''}</small>
    </div>
    ${branchBar}
    <div class="account-tools">
      <button data-stock-sort="name"${sort === 'name' ? ' class="selected"' : ''}>Naam se</button>
      <button data-stock-sort="stock"${sort === 'stock' ? ' class="selected"' : ''}>Zyada stock pehle</button>
    </div>`;
}

function rowHTML(r) {
  const pack = Number(r.pack) || 0;
  const big = pack > 0
    ? `${num(r.ctn)} ${esc(r.cName || 'Ctn')} + ${num(r.pcs)} ${esc(r.uName || 'Pcs')}`
    : `${num(r.stock)} ${esc(r.uName || 'Pcs')}`;

  return `<div class="party">
    <div class="name">
      <b>${esc(r.name)}</b>
      <small>${esc(r.code || '')}${pack > 0 ? ` · 1 ${esc(r.cName || 'Ctn')} = ${num(pack)}` : ''}${r.rate ? ' · Rate ' + num(r.rate) : ''}</small>
    </div>
    <div class="amount">
      <strong>${big}</strong>
      <small>${num(r.stock)} ${esc(r.uName || 'Pcs')}</small>
    </div>
  </div>`;
}

// branch aur sort ke buttons
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-stock-branch]');
  if (b) { branch = Number(b.dataset.stockBranch); rerender(); return; }
  const s = e.target.closest?.('[data-stock-sort]');
  if (s) { sort = s.dataset.stockSort; rerender(); }
});
