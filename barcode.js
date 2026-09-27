// barcode.js — v2.24.0: 🏷 BARCODE REPORT — asal data: labelJobs (app ka hukum -> PC label-print chhapta hai)
// labelJobs/<id>: {itemId, code, name, qty (packet mein kitne), rate, copies (kitne label), status new|printing|done|failed|skipped,
//                  by, at} + PC: {doneAt, numFrom, numTo, numCode, day}. Main barcode = item ka apna code, warna SUB-barcode.
// Screen: din ke hisaab se -> item -> har barcode (packet size) ki ginti. Chips: Aaj · Kal · 7 din · 30 din · status · search.
// PDF: app ka openReportPreview (poori screen + WhatsApp / share).
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);
const dayOf = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const back = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); };
const nice = day => day === dayOf() ? 'Aaj' : day === dayOf(back(1)) ? 'Kal' : day;

let cloud = null, notice = () => {}, itemsOf = () => [], pdfOf = null;
let jobs = [], stop = null, stopFrom = 0, fP = 'today', fS = 'done', fQ = '', open = new Set();

export function barcodeSetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; itemsOf = o.items || itemsOf; pdfOf = o.pdf || pdfOf; }
export function barcodeStop() { if (stop) { try { stop(); } catch {} stop = null; stopFrom = 0; } }
const fromMs = () => fP === 'today' ? back(0) : fP === 'kal' ? back(1) : fP === '7' ? back(6) : back(29);
function watch() {
  const f = back(29);   // hamesha 30 din suno — chips sirf filter
  if (stop && stopFrom === f) return;
  barcodeStop(); stopFrom = f;
  stop = cloud?.listenLabelJobs ? cloud.listenLabelJobs(f, l => { jobs = (l || []).filter(j => j && j.id); paint(); }) : null;
}
const jobDay = j => j.day || dayOf(Number(j.doneAt) || Number(j.at) || 0);
function build() {
  const lo = fromMs(), hi = fP === 'kal' ? back(0) : Infinity, q = fQ.trim().toLowerCase();
  const items = new Map((itemsOf() || []).map(r => [String(r.id), r]));
  const sel = jobs.filter(j => { const t = Number(j.doneAt) || Number(j.at) || 0; return t >= lo && t < hi; })
    .filter(j => fS === 'all' ? true : fS === 'done' ? j.status === 'done' : fS === 'wait' ? (j.status === 'new' || j.status === 'printing') : (j.status === 'failed' || j.status === 'skipped'))
    .filter(j => !q || [j.name, j.code, items.get(String(j.itemId))?.name].join(' ').toLowerCase().includes(q));
  const days = new Map();
  for (const j of sel) {
    const d = jobDay(j); if (!days.has(d)) days.set(d, new Map());
    const im = days.get(d), key = String(j.itemId || j.name);
    const it = items.get(String(j.itemId));
    if (!im.has(key)) im.set(key, { name: it?.name || j.name || 'Item', mainCode: String(it?.code || ''), codes: new Map(), labels: 0, pieces: 0 });
    const row = im.get(key), code = String(j.code || '');
    if (!row.codes.has(code)) row.codes.set(code, { code, qty: Number(j.qty) || 1, rate: Number(j.rate) || 0, labels: 0, jobs: 0, nums: [], sub: row.mainCode ? code !== row.mainCode : false, fail: 0 });
    const c = row.codes.get(code), n = Math.max(1, Number(j.copies) || 1);
    c.labels += n; c.jobs += 1; if (j.numFrom != null && j.numTo != null) c.nums.push((j.numCode || '') + j.numFrom + '–' + j.numTo);
    if (j.status === 'failed' || j.status === 'skipped') c.fail += n;
    row.labels += n; row.pieces += n * (Number(j.qty) || 1);
  }
  const out = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, im]) => {
    const rows = [...im.values()].map(r => ({ ...r, codes: [...r.codes.values()].sort((a, b) => (a.sub - b.sub) || (a.qty - b.qty)) })).sort((a, b) => b.labels - a.labels);
    return { day: d, rows, labels: rows.reduce((n, r) => n + r.labels, 0), pieces: rows.reduce((n, r) => n + r.pieces, 0), subs: rows.reduce((n, r) => n + r.codes.filter(c => c.sub).reduce((m, c) => m + c.labels, 0), 0) };
  });
  return { days: out, labels: out.reduce((n, d) => n + d.labels, 0), items: new Set(out.flatMap(d => d.rows.map(r => r.name))).size, subs: out.reduce((n, d) => n + d.subs, 0), jobs: sel.length };
}
export function renderBarcode() {
  watch();
  $('summary').innerHTML = '<div class="bc-root" id="bcRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-bc-pdf="1">📄 PDF · WhatsApp</button>';
  paint();
}
const codeLine = c => `<div class="bc-code${c.sub ? ' sub' : ''}"><span class="bc-tag">${c.sub ? 'SUB' : 'MAIN'}</span><span class="bc-num">${esc(c.code)}</span><span class="bc-pack">📦 ${num(c.qty)} wala</span>${c.rate ? `<span class="bc-rate">Rs ${num(c.rate)}</span>` : ''}<b class="bc-cnt">× ${num(c.labels)}</b>${c.fail ? `<span class="bc-fail">⚠️ ${num(c.fail)} fail</span>` : ''}${c.nums.length ? `<small class="bc-nums">#${esc(c.nums.slice(0, 4).join(', '))}${c.nums.length > 4 ? '…' : ''}</small>` : ''}</div>`;
function paint() {
  const root = $('bcRoot'); if (!root) return;
  const r = build();
  root.innerHTML = `<div class="bc-head">
    <div class="mchips">${[['today', 'Aaj'], ['kal', 'Kal'], ['7', '7 din'], ['30', '30 din']].map(([k, l]) => `<button type="button" class="rc${fP === k ? ' on' : ''}" data-bc-p="${k}">${l}</button>`).join('')}</div>
    <div class="mchips">${[['done', '✓ Chhap gaye'], ['wait', '⏳ Line mein'], ['bad', '⚠️ Fail'], ['all', 'Sab']].map(([k, l]) => `<button type="button" class="rc${fS === k ? ' on' : ''}" data-bc-s="${k}">${l}</button>`).join('')}</div>
    <label class="hs-search"><input type="search" placeholder="🔍 item ya barcode…" value="${esc(fQ)}" data-bc-q="1"></label>
    <div class="bc-kpis"><div><b>${num(r.labels)}</b><small>label</small></div><div><b>${num(r.items)}</b><small>items</small></div><div><b>${num(r.subs)}</b><small>sub-barcode</small></div><div><b>${num(r.jobs)}</b><small>hukum</small></div></div></div>
    ${r.days.map(d => `<div class="bc-day"><div class="bc-dayhead"><b>${esc(nice(d.day))}</b><span>${num(d.labels)} label · ${d.rows.length} items${d.subs ? ' · ' + num(d.subs) + ' sub' : ''}</span></div>
      ${d.rows.map(row => { const k = d.day + '|' + row.name, op = open.has(k) || d.rows.length <= 6;
        return `<div class="bc-item${op ? ' open' : ''}"><button type="button" class="bc-ihead" data-bc-open="${esc(k)}"><b>${esc(row.name)}</b><span class="bc-ichips">${row.codes.map(c => `<i class="${c.sub ? 'sub' : ''}">${num(c.qty)}×${num(c.labels)}</i>`).join('')}</span><b class="bc-cnt">${num(row.labels)}</b></button>${op ? `<div class="bc-codes">${row.codes.map(codeLine).join('')}</div>` : ''}</div>`; }).join('')}</div>`).join('')
      || `<div class="nt-empty">🏷<b>Is waqt mein koi label nahi</b><small>Stock screen se label chhapwayein — yahan khud aa jayega</small></div>`}`;
}
function pdfHTML() {
  const r = build(), when = { today: 'Aaj', kal: 'Kal', '7': 'Pichhle 7 din', '30': 'Pichhle 30 din' }[fP];
  return `<h1>NOOR TRADERS</h1><h2>🏷 Barcode report — ${esc(when)} (${esc({ done: 'chhap gaye', wait: 'line mein', bad: 'fail', all: 'sab' }[fS])})</h2>
    <p>${num(r.labels)} label · ${num(r.items)} items · ${num(r.subs)} sub-barcode · ${esc(new Date().toLocaleString('en-PK'))}</p>
    ${r.days.map(d => `<h3>${esc(d.day)} — ${num(d.labels)} label</h3><table class="iv-tbl"><thead><tr><th>Item</th><th>Barcode</th><th>Packet</th><th>Label</th></tr></thead><tbody>
      ${d.rows.map(row => row.codes.map((c, i) => `<tr><td class="iv-item">${i ? '' : '<b>' + esc(row.name) + '</b>'}</td><td>${c.sub ? 'SUB ' : ''}${esc(c.code)}</td><td class="iv-n">${num(c.qty)}</td><td class="iv-n"><b>${num(c.labels)}</b></td></tr>`).join('') + `<tr><td></td><td></td><td class="iv-n"><small>kul</small></td><td class="iv-n"><b>${num(row.labels)}</b></td></tr>`).join('')}
      </tbody></table>`).join('')}`;
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-bc-pdf]')) { const r = build(); if (!r.labels) { notice('Is waqt mein koi label nahi'); return; } if (pdfOf) pdfOf(pdfHTML(), 'Barcode report ' + dayOf()); return; }
  if (!$('bcRoot')) return;
  const t = e.target.closest?.('[data-bc-p],[data-bc-s],[data-bc-open]'); if (!t) return;
  const d = t.dataset;
  if (d.bcP) { fP = d.bcP; paint(); return; }
  if (d.bcS) { fS = d.bcS; paint(); return; }
  if (d.bcOpen) { if (open.has(d.bcOpen)) open.delete(d.bcOpen); else open.add(d.bcOpen); paint(); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-bc-q]')) { fQ = e.target.value || ''; paint(); const q = document.querySelector('[data-bc-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
