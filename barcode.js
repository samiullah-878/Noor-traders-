// barcode.js — v2.24.0: 🏷 BARCODE REPORT — asal data: labelJobs (app ka hukum -> PC label-print chhapta hai)
// labelJobs/<id>: {itemId, code, name, qty (packet mein kitne), rate, copies (kitne label), status new|printing|done|failed|skipped,
//                  by, at} + PC: {doneAt, numFrom, numTo, numCode, day}. Main barcode = item ka apna code, warna SUB-barcode.
// v2.97: 🖨 LIVE patti upar — chhap raha (sent/total), line mein (#), pichhle 10 min khatam; ✕ Cancel / Sab cancel (labelJobs.cancelReq).
// v2.98.8: Cancel dabate hi row par "✕ cancel ho raha…" (jawab ka intezar nahi) · nakam ho to BARA alert (rules wajah) ·
//          'printing' jis ki dhadkan (beatAt, label-print v4.1) 3 min se nahi = "⚠ atka hua" (Cancel = PC foran saaf karta hai).
// Screen: din ke hisaab se -> item -> har barcode (packet size) ki ginti. Chips: Aaj · Kal · 7 din · 30 din · status · search.
// PDF: app ka openReportPreview (poori screen + WhatsApp / share).
import { smartHit } from './smart-search.js?v=2.99.20';   // v2.98: 🔎 spelling-maafi list search
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
    .filter(j => fS === 'all' ? true : fS === 'done' ? j.status === 'done' : fS === 'wait' ? (j.status === 'new' || j.status === 'printing') : (j.status === 'failed' || j.status === 'skipped' || j.status === 'cancelled'))
    .filter(j => !q || smartHit([j.name, j.code, items.get(String(j.itemId))?.name].join(' '), q));
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
const cxLocal = new Map();   // v2.98.8: abhi cancel dabaya (id -> waqt) — snapshot aane se pehle bhi "cancel ho raha" dikhe
const isCx = j => !!j.cancelReq || (cxLocal.has(j.id) && Date.now() - cxLocal.get(j.id) < 3 * 60000);
const isStuck = (j, now) => j.status === 'printing' && now - (Number(j.beatAt) || Number(j.pickedAt) || Number(j.at) || 0) > 3 * 60000;
export function liveLabelsHTML(list, opts = {}) {   // v2.97: pos-stock bhi istemal karta hai
  const now = Date.now(), L = (list || []).filter(j => j && j.id);
  const act = L.filter(j => j.status === 'new' || j.status === 'printing').sort((a, b) => (a.status === 'printing' ? 0 : 1) - (b.status === 'printing' ? 0 : 1) || (Number(a.at) || 0) - (Number(b.at) || 0));
  const fin = opts.noRecent ? [] : L.filter(j => ['done', 'cancelled', 'failed', 'skipped'].includes(j.status) && now - (Number(j.doneAt) || 0) < 10 * 60000).sort((a, b) => (Number(b.doneAt) || 0) - (Number(a.doneAt) || 0)).slice(0, 5);
  if (!act.length && !fin.length) return '';
  let n = 0;
  const row = j => { const tot = Number(j.total) || Number(j.copies) || 1, sent = Math.min(tot, Number(j.sent) || 0), pr = j.status === 'printing', cx = isCx(j), st = isStuck(j, now);
    return `<div class="lv-row ${j.status}${cx ? ' cx' : ''}${st ? ' stuck' : ''}" data-lv-id="${esc(j.id)}"><div class="lv-t"><b>${esc(j.name || 'Item')}</b><small>${esc(j.code || '')}${Number(j.qty) > 1 ? ' · ' + num(j.qty) + ' wala' : ''}</small></div>
      <div class="lv-s">${cx && (pr || j.status === 'new') ? '<em class="cx">✕ cancel ho raha…</em>' : st ? `<em class="stk">⚠ atka hua · ${num(sent)} / ${num(tot)}</em>` : pr ? `<em class="pr">🖨 ${num(sent)} / ${num(tot)}</em>` : j.status === 'new' ? `<em>⏳ line mein #${++n} · ${num(tot)}</em>` : j.status === 'done' ? `<em class="ok">✓ ${num(tot)} chhap gaye</em>` : j.status === 'cancelled' ? `<em class="cx">✕ cancel${Number(j.sent) ? ' · ~' + num(j.sent) + ' chhape' : ''}</em>` : `<em class="bad">⚠ ${esc(j.error || j.status)}</em>`}
      ${pr && !st ? `<i class="lv-bar"><u style="width:${Math.round(sent / tot * 100)}%"></u></i>` : ''}</div>
      ${(pr || j.status === 'new') && !cx ? `<button type="button" class="lv-x" data-lv-cancel="${esc(j.id)}">✕ Cancel</button>` : ''}</div>`; };
  const open = act.filter(j => !isCx(j));
  return `<div class="lv-box"><div class="lv-h"><b>🖨 Label printer — abhi</b>${open.length > 1 ? `<button type="button" class="lv-x all" data-lv-cancel="${open.map(j => esc(j.id)).join(',')}">✕ Sab cancel</button>` : ''}</div>${act.map(row).join('')}${fin.map(row).join('')}</div>`;
}
function paint() {
  const root = $('bcRoot'); if (!root) return;
  const r = build();
  root.innerHTML = liveLabelsHTML(jobs) + `<div class="bc-head">
    <div class="mchips">${[['today', 'Aaj'], ['kal', 'Kal'], ['7', '7 din'], ['30', '30 din']].map(([k, l]) => `<button type="button" class="rc${fP === k ? ' on' : ''}" data-bc-p="${k}">${l}</button>`).join('')}</div>
    <div class="mchips">${[['done', '✓ Chhap gaye'], ['wait', '⏳ Line mein'], ['bad', '⚠️ Fail / cancel'], ['all', 'Sab']].map(([k, l]) => `<button type="button" class="rc${fS === k ? ' on' : ''}" data-bc-s="${k}">${l}</button>`).join('')}</div>
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
document.addEventListener('click', async e => {
  const cx = e.target.closest?.('[data-lv-cancel]');
  if (cx) { const ids = String(cx.dataset.lvCancel || '').split(',').filter(Boolean); if (!ids.length || !cloud?.cancelLabel) return;
    if (!confirm(ids.length > 1 ? `${ids.length} label hukum cancel karein?` : 'Ye label cancel karein? (jo printer mein pohanch chuke, woh 10-20 nikal sakte hain)')) return;
    cx.disabled = true; let ok = 0, bad = '';
    // v2.98.8: dabate hi row par "cancel ho raha" (jawab ka intezar nahi); nakam ho to wapas + BARA alert
    const mark = (id, on) => { if (on) cxLocal.set(id, Date.now()); else cxLocal.delete(id);
      document.querySelectorAll(`.lv-row[data-lv-id="${CSS.escape(id)}"]`).forEach(r => { r.classList.toggle('cx', on);
        const sEl = r.querySelector('.lv-s'), b = r.querySelector('.lv-x'); if (on) { if (sEl) { r._lvS = sEl.innerHTML; sEl.innerHTML = '<em class="cx">✕ cancel ho raha…</em>'; } if (b) b.style.display = 'none'; } else { if (sEl && r._lvS != null) sEl.innerHTML = r._lvS; if (b) { b.style.display = ''; b.disabled = false; } } }); };
    ids.forEach(id => mark(id, true)); if (ids.length > 1) cx.style.display = 'none';
    for (const id of ids) { try { await cloud.cancelLabel(id); ok++; } catch (er) { mark(id, false); bad = /permission/i.test(String(er?.code || er?.message)) ? 'rules' : String(er?.message || er); } }
    if (bad) { cx.disabled = false; cx.style.display = '';
      alert(bad === 'rules' ? '✕ Cancel NAHI hua — Firebase rules 2.34 publish nahi hue.\n\nMalik: app ka "firestore-rules-2.34.html" page khol kar Copy → Firebase Console → Firestore → Rules mein paste → Publish.'
        : '✕ Cancel NAHI hua: ' + bad + '\n\nInternet check karein aur dobara dabayein.'); }
    if (ok) notice(`✕ Cancel bhej diya${ok > 1 ? ' (' + ok + ')' : ''} — PC foran rok dega (jo printer mein pohanch chuke, 10-20 nikal sakte hain)`); return; }
  if (e.target.closest?.('[data-bc-pdf]')) { const r = build(); if (!r.labels) { notice('Is waqt mein koi label nahi'); return; } if (pdfOf) pdfOf(pdfHTML(), 'Barcode report ' + dayOf()); return; }
  if (!$('bcRoot')) return;
  const t = e.target.closest?.('[data-bc-p],[data-bc-s],[data-bc-open]'); if (!t) return;
  const d = t.dataset;
  if (d.bcP) { fP = d.bcP; paint(); return; }
  if (d.bcS) { fS = d.bcS; paint(); return; }
  if (d.bcOpen) { if (open.has(d.bcOpen)) open.delete(d.bcOpen); else open.add(d.bcOpen); paint(); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-bc-q]')) { fQ = e.target.value || ''; paint(); const q = document.querySelector('[data-bc-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
