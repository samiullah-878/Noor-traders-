// pk-report.js — v1.0 (2026-10-27, app v2.132.0) 📦 GODAM 2 PACKET REPORT (malik: "poore 3 mahine ka Godam 2 ka barcode ke saath
//   packets wala data — kitne packet bike, sub-barcode + barcode, 1 packet ke hisaab se, jo scan hue").
// Data: PC pk-report.js (sirf parhti hai) → posStats/pkReport (meta) + pkReport-<k> (JSON text) — app sirf parhti hai; "🔄 Taza karo" = posStats/pkReq.
// Screen: full khirki (Transfer/Stock tiles se) — ⋮: mahina (Aug · Sep · Oct · 3 mahine) · tarteeb; search; har item patli line
//   (naam · packets · main · khula) tap = barcode-war (har sub-barcode: packet size · packets · scan · kg) · 📄 PDF (kholo + bhejo) · 📊 CSV (Excel). AI nahi.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => { n = Number(n) || 0; return Math.abs(n - Math.round(n)) < 1e-6 ? new Intl.NumberFormat('en-PK').format(Math.round(n)) : String(Math.round(n * 1000) / 1000); };
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mLab = m => m === 'all' ? '3 mahine' : `${MN[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;
let C = null, R = null, stop = null, st = { m: 'all', q: '', sort: 'pk', open: new Set(), busy: false };
export function pkSetup(ctx) { C = ctx; }
const months = () => String(R?.meta?.months || '').split(',').filter(Boolean);
function rowsOf() {   // har item: chune mahine ka jor
  const ms = st.m === 'all' ? months() : [st.m], q = st.q.trim().toLowerCase();
  const out = [];
  for (const it of R?.items || []) {
    if (q && !(it.n.toLowerCase().includes(q) || it.c.toLowerCase().includes(q) || String(it.mb || '').includes(q) || Object.keys(it.subs || {}).some(b => b.includes(q)))) continue;
    let pk = 0, sc = 0, main = 0, mainN = 0, loose = 0, bills = 0; const sub = {};
    for (const mk of ms) { const M = it.m?.[mk]; if (!M) continue; main += M.main || 0; mainN += M.mainN || 0; loose += M.loose || 0; bills += M.bills || 0;
      for (const [b, P] of Object.entries(M.pk || {})) { const S = sub[b] || (sub[b] = { n: 0, q: 0, sc: 0, size: it.subs?.[b] || 0 }); S.n += P.n || 0; S.q += P.q || 0; S.sc += P.sc || 0; pk += P.n || 0; sc += P.sc || 0; } }
    if (!pk && !main && !loose) continue;
    out.push({ it, pk, sc, main, mainN, loose, bills, sub });
  }
  out.sort((a, b) => st.sort === 'name' ? a.it.n.localeCompare(b.it.n) : st.sort === 'main' ? b.main - a.main : b.pk - a.pk || b.main - a.main);
  return out;
}
const pill = () => `📅 ${mLab(st.m)} · ${esc(R?.meta?.godam?.name || 'Godam 2')}`;
function subHTML(r) {
  const it = r.it, ms = st.m === 'all' ? months() : [st.m];
  const perM = (b) => ms.map(mk => { const P = it.m?.[mk]?.pk?.[b]; return `<span class="pk-mm"><small>${esc(mLab(mk))}</small><b>${P ? num(P.n) : '0'}</b></span>`; }).join('');
  const subs = Object.entries(r.sub).sort((a, b) => b[1].n - a[1].n);
  return `<div class="pk-x">
    <div class="pk-row pk-main"><span class="pk-b">🏷 ${esc(it.mb || 'Main barcode')}<small>poora ${esc(it.u)}${it.pk > 1 ? ' · 1 ' + esc(it.cu) + ' = ' + num(it.pk) : ''}</small></span><span class="pk-n"><b>${num(r.main)}</b><small>${esc(it.u)} · ${num(r.mainN)} lines</small></span><span class="pk-ms">${ms.map(mk => `<span class="pk-mm"><small>${esc(mLab(mk))}</small><b>${num(it.m?.[mk]?.main || 0)}</b></span>`).join('')}</span></div>
    ${subs.map(([b, S]) => `<div class="pk-row"><span class="pk-b">📦 ${esc(b)}<small>packet ${num(S.size)} ${esc(it.u)}${R.meta.how === 'scan' ? ' · scan ' + num(S.sc) : ''}</small></span><span class="pk-n"><b>${num(S.n)}</b><small>packet · ${num(S.q)} ${esc(it.u)}</small></span><span class="pk-ms">${perM(b)}</span></div>`).join('')}
    ${Object.keys(it.subs || {}).filter(b => !r.sub[b]).map(b => `<div class="pk-row pk-zero"><span class="pk-b">📦 ${esc(b)}<small>packet ${num(it.subs[b])} ${esc(it.u)}</small></span><span class="pk-n"><b>0</b><small>nahi bika</small></span></div>`).join('')}
    ${r.loose ? `<div class="pk-row pk-loose"><span class="pk-b">⚖️ Khula<small>packet se alag tadad (kg / beech ki)</small></span><span class="pk-n"><b>${num(r.loose)}</b><small>${esc(it.u)}</small></span></div>` : ''}
  </div>`;
}
function rowHTML(r) {
  const it = r.it, open = st.open.has(it.i);
  return `<article class="pk-card${open ? ' open' : ''}" data-pk-tog="${esc(it.i)}"><div class="pk-l1"><b class="pk-nm">${esc(it.n)}</b><small class="pk-code">${esc(it.c)}${Object.keys(it.subs || {}).length ? ' · ' + Object.keys(it.subs).length + ' sub-barcode' : ''}</small>
    <span class="pk-chips"><i class="pk-c pk">${num(r.pk)} packet</i><i class="pk-c">${num(r.main)} ${esc(it.u)} main</i>${r.loose ? `<i class="pk-c lo">${num(r.loose)} khula</i>` : ''}<i class="pk-c bl">${num(r.bills)} bill</i>${R.meta.how === 'scan' && r.sc ? `<i class="pk-c sc">🔍 ${num(r.sc)} scan</i>` : ''}</span></div>${open ? subHTML(r) : ''}</article>`;
}
export function pkHTML() {
  if (!R) return '<div class="pk-root" data-pk-root="1"><p class="stat-note">⏳ Report load ho rahi hai…</p></div>';
  if (!R.meta) return `<div class="pk-root" data-pk-root="1"><div class="empty"><strong>Report abhi nahi bani</strong><p>Shop PC (pk-report) pehli dafa ~10 min mein bana dega.${R.err ? ' · ' + esc(R.err) : ''}</p></div>${C.owner() ? '<button type="button" class="got" data-pk-req="1">🔄 Abhi banao</button>' : ''}</div>`;
  const L = rowsOf(), T = L.reduce((a, r) => { a.pk += r.pk; a.main += r.main; a.bills += r.bills; return a; }, { pk: 0, main: 0, bills: 0 });
  const seg = (k, lab, i, opts) => `<div class="pk-seg" data-mn-seg="${k}" data-mn-i="${i}" data-mn-t="${lab}" data-mn-g="📦 Packet report">${opts.map(([v, t]) => `<button type="button" class="${st[k.split('.')[1]] === v ? 'is-in' : ''}" data-pk-${k.split('.')[1]}="${v}">${t}</button>`).join('')}</div>`;
  const at = R.meta.at ? new Date(Number(R.meta.at)).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  return `<div class="pk-root" data-pk-root="1">
    <div class="pk-top"><label class="pk-q"><span>🔍</span><input type="search" data-pk-q="1" value="${esc(st.q)}" placeholder="Item / code / barcode" autocomplete="off"></label><button type="button" class="rk-pill" data-mn-sheet="1">${pill()} <i>${L.length}</i></button></div>
    ${seg('pk.m', 'Mahina', '📅', [...months().map(m => [m, mLab(m)]), ['all', '3 mahine']])}
    ${seg('pk.sort', 'Tarteeb', '↕', [['pk', 'Zyada packet'], ['main', 'Zyada main'], ['name', 'Naam']])}
    <div class="pk-tools"><button type="button" data-pk-pdf="1" data-mn="pk.pdf" data-mn-i="📄" data-mn-t="PDF" data-mn-s="kholo + bhejo" data-mn-g="📦 Packet report">📄 PDF</button><button type="button" data-pk-csv="1" data-mn="pk.csv" data-mn-i="📊" data-mn-t="Excel (CSV)" data-mn-s="poori list download" data-mn-g="📦 Packet report">📊 Excel</button>${C.owner() ? `<button type="button" data-pk-req="1" data-mn="pk.req" data-mn-i="🔄" data-mn-t="Taza karo" data-mn-s="PC se abhi dobara" data-mn-g="📦 Packet report"${st.busy ? ' disabled' : ''}>🔄 Taza karo</button>` : ''}</div>
    <div class="pk-sum"><span><small>Packets</small><b>${num(T.pk)}</b></span><span><small>Main ${esc(R.meta.how === 'scan' ? '· scan se' : '')}</small><b>${num(T.main)}</b></span><span><small>Bills</small><b>${num(T.bills)}</b></span><span><small>Items</small><b>${L.length}</b></span></div>
    <p class="stat-note pk-note">${esc(R.meta.godam?.name || 'Godam 2')} · ${esc(R.meta.from || '')} se ${esc(R.meta.to || '')} · ${R.meta.how === 'scan' ? '🔍 POS line ka scan code mil gaya — packet = jo barcode scan hua' : '📏 POS line mein scan code nahi — packet = tadad packet size ke bilkul barabar (malik ka qaida); guna / beech ki tadad = khula'} · PC ne ${esc(at)} banayi${R.meta.err ? ' · ⚠️ ' + esc(R.meta.err) : ''}</p>
    <div class="pk-list">${L.length ? L.map(rowHTML).join('') : '<div class="empty"><strong>Kuch nahi mila</strong></div>'}</div></div>`;
}
export function pkOpen() {
  if (!C) return;
  if (!C.can('stock.pkrep')) { C.notice('📦 Packet report ki ijazat nahi — malik se kahein'); return; }
  C.modal('📦 Godam 2 packet report', pkHTML(), true);
  try { $('dialog').classList.add('pk-dialog'); } catch {}
  if (!stop && C.cloud?.listenPkReport) stop = C.cloud.listenPkReport(d => { R = d; paint(); });
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} }, 30);
}
function paint() {
  const r = document.querySelector('#dialogBody [data-pk-root]'); if (!r) return;
  const q = r.querySelector('[data-pk-q]'), foc = document.activeElement === q;
  r.outerHTML = pkHTML();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-pk-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
  try { window.ntDlgMenu?.(); } catch {}
}
function csv() {
  const ms = st.m === 'all' ? months() : [st.m], L = rowsOf(), rows = [['Item', 'Code', 'Barcode', 'Qism', 'Packet size', ...ms.map(mLab), 'Kul packet', 'Kul tadad', 'Scan']];
  for (const r of L) { const it = r.it;
    rows.push([it.n, it.c, it.mb || '', 'MAIN', '', ...ms.map(mk => it.m?.[mk]?.main || 0), '', r.main, '']);
    for (const [b, S] of Object.entries(r.sub)) rows.push([it.n, it.c, b, 'PACKET', S.size, ...ms.map(mk => it.m?.[mk]?.pk?.[b]?.n || 0), S.n, S.q, S.sc]);
    if (r.loose) rows.push([it.n, it.c, '', 'KHULA', '', ...ms.map(mk => it.m?.[mk]?.loose || 0), '', r.loose, '']); }
  const txt = '﻿' + rows.map(x => x.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const name = `Godam2-packet-${st.m === 'all' ? '3mahine' : st.m}.csv`, blob = new Blob([txt], { type: 'text/csv;charset=utf-8' }), f = new File([blob], name, { type: 'text/csv' });
  if (navigator.canShare?.({ files: [f] })) { navigator.share({ files: [f], title: name }).catch(() => dl(blob, name)); } else dl(blob, name);
}
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
function pdfHTML() {
  const ms = st.m === 'all' ? months() : [st.m], L = rowsOf();
  return `<h1>NOOR TRADERS</h1><h2>📦 ${esc(R.meta.godam?.name || 'Godam 2')} — Packet report (${esc(mLab(st.m))})</h2>
  <p>${esc(R.meta.from || '')} se ${esc(R.meta.to || '')} · ${R.meta.how === 'scan' ? 'packet = scan hua barcode' : 'packet = tadad packet size ke barabar (guna / beech ki = khula)'} · ${esc(new Date().toLocaleString('en-PK'))}</p>
  <table><thead><tr><th>Item</th><th>Barcode</th><th>Qism</th><th>Size</th>${ms.map(m => `<th>${esc(mLab(m))}</th>`).join('')}<th>Kul</th></tr></thead><tbody>
  ${L.map(r => { const it = r.it; return `<tr class="pk-h"><td><b>${esc(it.n)}</b> <small>${esc(it.c)}</small></td><td>${esc(it.mb || '')}</td><td>MAIN</td><td></td>${ms.map(mk => `<td>${num(it.m?.[mk]?.main || 0)}</td>`).join('')}<td><b>${num(r.main)}</b> ${esc(it.u)}</td></tr>`
    + Object.entries(r.sub).map(([b, S]) => `<tr><td></td><td>${esc(b)}</td><td>PACKET</td><td>${num(S.size)}</td>${ms.map(mk => `<td>${num(it.m?.[mk]?.pk?.[b]?.n || 0)}</td>`).join('')}<td><b>${num(S.n)}</b> pkt · ${num(S.q)} ${esc(it.u)}</td></tr>`).join('')
    + (r.loose ? `<tr><td></td><td></td><td>KHULA</td><td></td>${ms.map(mk => `<td>${num(it.m?.[mk]?.loose || 0)}</td>`).join('')}<td>${num(r.loose)} ${esc(it.u)}</td></tr>` : ''); }).join('')}
  </tbody></table>`;
}
document.addEventListener('input', e => { const t = e.target; if (!t?.dataset?.pkQ) return; st.q = t.value; paint(); });
document.addEventListener('click', async e => {
  if (!C) return;
  const b = e.target.closest?.('[data-pk-m],[data-pk-sort],[data-pk-pdf],[data-pk-csv],[data-pk-req],[data-pk-tog]'); if (!b) return;
  const d = b.dataset;
  if (d.pkM) { st.m = d.pkM; paint(); return; }
  if (d.pkSort) { st.sort = d.pkSort; paint(); return; }
  if (d.pkPdf) { if (!R?.meta) { C.notice('Report abhi nahi aayi'); return; } C.pdf(pdfHTML(), `Godam 2 packet ${mLab(st.m)}`); return; }
  if (d.pkCsv) { if (!R?.meta) { C.notice('Report abhi nahi aayi'); return; } csv(); return; }
  if (d.pkReq) { st.busy = true; paint(); try { await C.cloud.requestPkReport(); C.notice('🔄 PC ko kaha — 2–10 min mein nayi report'); } catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); } st.busy = false; paint(); return; }
  if (d.pkTog) { if (e.target.closest('button,a,input')) return; const id = d.pkTog; if (st.open.has(id)) st.open.delete(id); else st.open.add(id); paint(); return; }
});
