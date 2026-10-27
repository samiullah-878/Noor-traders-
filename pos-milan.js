// pos-milan.js — v1.4 (2026-10-27, app v2.133.4: 🔄 Taza karo + POS data ka waqt, job ke baad khud taza, ↩ pehle se alag) · v1.3 (2026-10-27, app v2.133.0: ⚖️ barabar karo chips — milanJobs app/pos, rules 2.77) · v1.0 (2026-10-26, app v2.124.0) ⚖️ POS MILAN — har khate ka app baqaya vs POS ledger baqaya.
// Malik: "jitne bhi khate hain, POS ka ledger aur humara khata same aa raha hai — sab khaton ke liye check karna hai; har khate ki screen par bhi POS baqaya".
// v1.1 (app v2.125.0): 🔍 FARQ KI ENTRIES — posLines/<id> (PC har 15 min, sab khate) se entry-war milan: App mein hai POS nahi · POS mein hai app nahi · raqam farq.
// Data: blueAccess/posLedger {m:{appPartyId: paisa (lena +, dena −)}, at, n} — PC pos-khata-sync har 15 min. Yahan sirf UI. AI nahi.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + (Math.abs(Number(n) || 0) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
import { skipsBalance, cashPaysBill } from './model.js?v=2.133.5';
const TOL = 100;   // paisa — Rs 1 tak farq = theek (POS 2 decimal rounding)
let C = null, st = { f: 'farq', q: '' };
export function pmSetup(ctx) { C = ctx; }   // ctx: parties, entries, balance, ledger, can, owner, notice, modal, openAccount
const led = () => C.ledger() || null;
const posOf = p => { const m = led()?.m; if (!m || !p) return null; const v = m[p.id]; return v == null ? null : Number(v) || 0; };
const sideTxt = v => v > 0 ? 'lena' : v < 0 ? 'dena' : 'barabar';
export function pmRow(p) {   // {app, pos, farq, state: 'ok'|'farq'|'none'}
  const app = C.balance(p), pos = posOf(p);
  if (pos == null) return { app, pos: null, farq: 0, state: 'none' };
  const farq = app - pos; return { app, pos, farq, state: Math.abs(farq) <= TOL ? 'ok' : 'farq' };
}
let pmOpenLine = '';   // v1.2: chhoti chip, tap = bara (malik: "chips small, click karein to bara")
export function pmLineHTML(p) {   // khate ki screen ke upar — chhoti chip; tap = poori baat + 🔍 Farq dhoondo
  if (!C || !p || p.bank || !C.can('kh.posmilan') || !led()) return '';
  const r = pmRow(p), big = pmOpenLine === p.id;
  if (r.state === 'none') return `<button type="button" class="pm-line none${big ? ' big' : ''}" data-pm-tog="${esc(p.id)}">🖥 POS ${big ? 'mein yeh khata nahi juda' : '—'}</button>`;
  if (r.state === 'ok') return `<button type="button" class="pm-line ok${big ? ' big' : ''}" data-pm-tog="${esc(p.id)}">🖥 POS ✓${big ? ` baqaya ${money(r.pos)} ${sideTxt(r.pos)} · barabar` : ''}</button>`;
  return `<span class="pm-lw"><button type="button" class="pm-line bad${big ? ' big' : ''}" data-pm-tog="${esc(p.id)}">🖥 POS ⚠ ${money(r.farq)}${big ? ` farq · POS ${money(r.pos)} ${sideTxt(r.pos)} · app ${money(r.app)} ${sideTxt(r.app)}` : ''}</button>${big ? `<button type="button" class="pm-dbtn" data-pm-diff="${esc(p.id)}">🔍 Farq</button>` : ''}</span>`;
}
export function pmCount() { if (!C || !led()) return 0; let n = 0; for (const p of C.parties()) { if (p.bank) continue; if (pmRow(p).state === 'farq') n++; } return n; }
const agoTxt = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : m < 1440 ? Math.round(m / 60) + ' ghante pehle' : Math.round(m / 1440) + ' din pehle'; };
function list() {
  const q = st.q.trim().toLowerCase();
  return C.parties().filter(p => !p.bank && (!q || String(p.name || '').toLowerCase().includes(q))).map(p => ({ p, r: pmRow(p) }))
    .filter(x => st.f === 'sab' ? true : st.f === 'farq' ? x.r.state === 'farq' : st.f === 'ok' ? x.r.state === 'ok' : x.r.state === 'none')
    .sort((a, b) => Math.abs(b.r.farq) - Math.abs(a.r.farq) || String(a.p.name).localeCompare(String(b.p.name)));
}
export function pmHTML() {
  const L = led(), all = C.parties().filter(p => !p.bank).map(p => pmRow(p)), nF = all.filter(r => r.state === 'farq').length, nO = all.filter(r => r.state === 'ok').length, nN = all.filter(r => r.state === 'none').length;
  const rows = list();
  const seg = `<div class="bc-seg" data-mn-seg="pm.f" data-mn-i="⚖️" data-mn-t="Kaun se khate" data-mn-g="⚖️ POS milan">${[['farq', '⚠ Farq wale', nF], ['ok', '✓ Theek', nO], ['none', 'POS mein nahi', nN], ['sab', 'Sab', all.length]].map(([v, t, n]) => `<button type="button" class="${st.f === v ? 'is-in' : ''}" data-pm-f="${v}">${t} <i>${n}</i></button>`).join('')}</div>`;
  const lab = { farq: '⚠ Farq wale', ok: '✓ Theek', none: 'POS mein nahi', sab: 'Sab' }[st.f];
  return `<div class="bc-root pm-root" data-pm-root="1">
    <div class="bc-top"><label class="bc-q"><span>🔍</span><input type="search" data-pm-q="1" value="${esc(st.q)}" placeholder="Khata dhoondein" autocomplete="off"></label><button type="button" class="rk-pill" data-mn-sheet="1">⚖️ ${lab} <i>${rows.length}</i></button></div>
    ${seg}
    <div class="pm-sum ${nF ? 'bad' : 'ok'}"><b>${nF ? '⚠ ' + nF + ' khate POS se farq' : '✓ Sab khate POS se barabar'}</b><small>${all.length} khate · ${nO} theek · ${nN} POS mein nahi · 🖥 ${L ? 'POS se ' + agoTxt(L.at) : 'PC se abhi nahi aaya'}</small></div>
    <div class="bc-list">${!L ? '<div class="empty"><strong>PC se POS ledger abhi nahi aaya</strong><p>pos-khata-sync 15 minute mein likhti hai — PC chal raha ho.</p></div>' : rows.length ? rows.map(({ p, r }) => `<button type="button" class="pm-r ${r.state}" data-pm-open="${esc(p.id)}">
      <span class="pm-n"><b>${esc(p.name)}</b><small>${esc(p.category || '')}</small></span>
      <span class="pm-v"><small>✍️ App</small><b>${money(r.app)} <i>${sideTxt(r.app)}</i></b></span>
      <span class="pm-v"><small>🖥 POS</small><b>${r.state === 'none' ? '—' : money(r.pos) + ' <i>' + sideTxt(r.pos) + '</i>'}</b></span>
      <span class="pm-d">${r.state === 'none' ? '<em class="n">POS mein nahi</em>' : r.state === 'ok' ? '<em class="o">✓</em>' : `<em class="b">⚠ ${money(r.farq)}</em><i class="pm-dbtn" data-pm-diff="${esc(p.id)}">🔍 Farq dhoondo</i>`}</span></button>`).join('') : `<div class="empty"><strong>${st.f === 'farq' ? 'Koi farq nahi ✓' : 'Kuch nahi'}</strong></div>`}</div>
    <p class="stat-note">Farq = app ka baqaya − POS ka ledger baqaya. Rs 1 tak farq = theek (POS ki rounding). Khate par tap = wo khata khule. PC har 15 min POS se taza karta hai.</p>
  </div>`;
}
export function pmOpen() {
  if (!C) return;
  if (!C.can('kh.posmilan')) { C.notice('⚖️ POS milan ki ijazat nahi — malik se kahein'); return; }
  C.modal('⚖️ POS milan', pmHTML(), true);
}
export function pmPaint() {
  try { if (document.querySelector('#dialogBody [data-pm-droot]')) { diffRefresh(); return; } } catch {}
  const r = document.querySelector('#dialogBody [data-pm-root]'); if (!r || !$('dialog')?.open) return;
  const q = r.querySelector('[data-pm-q]'), foc = document.activeElement === q;
  r.outerHTML = pmHTML();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-pm-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
}
// ---------- 🔍 FARQ KI ENTRIES ----------
const dayDiff = (a, b) => Math.abs((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5);
const appAmt = e => (['credit', 'payment'].includes(e.kind) || cashPaysBill(e)) ? Number(e.amount) || 0 : ['borrow', 'collection'].includes(e.kind) ? -(Number(e.amount) || 0) : 0;   // lena +, dena − (model.balance jaisa)
const KIND = { payment: '💸 Payment di', collection: '💰 Wasooli', borrow: '📦 Saman liya', credit: '🧾 Udhaar diya', purchaseCash: '💵 Cash purchase', sale: '🧾 Sale' };
const dTxt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
// ---------- ⚖️ BARABAR KARO (v2.133.0, rules 2.77) — malik: "konsa baqaya barabar ho: app wala / POS wala — jo entries nahi wo daal de" ----------
let jobs = [], jobStop = null, jobPid = '', jobDoc = null, jobParty = null;
const fixState = () => { const j = jobs[0]; if (!j) return null; if (j.status === 'done' && Date.now() - (Number(j.doneAt) || 0) > 6 * 3600000) return null; return j; };
let reqAt = 0, reqT = 0, linesAt = 0;   // v2.133.4: 🔄 Taza karo (blueAccess/posLedgerReq → PC foran, posLedger.req)
function freshHTML(doc) {
  const t = Math.max(Number(led()?.at) || 0, Number(doc?.at) || 0);
  const waiting = reqAt && !(Number(led()?.req) >= reqAt);
  return `<div class="pm-fresh${waiting ? ' wait' : ''}"><span>🖥 POS data: <b>${t ? agoTxt(t) : '—'}</b>${waiting ? ' · ⏳ PC se naya aa raha hai…' : ''}</span>${C.owner() && C.reqLedger ? `<button type="button" data-pm-taza="1"${waiting ? ' disabled' : ''}>🔄 Taza karo</button>` : ''}</div>`;
}
async function tazaGo() {
  try { reqAt = await C.reqLedger(); } catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); return; }
  repaintDiff();
  clearTimeout(reqT); reqT = setTimeout(() => { if (reqAt && !(Number(led()?.req) >= reqAt)) { reqAt = 0; repaintDiff(); C.notice('⚠️ Shop PC ne 3 min mein jawab nahi diya — PC / internet check karein, ya malik ko batayein'); } }, 180000);
}
function repaintDiff() { const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r && jobParty && jobDoc && r.dataset.pmDroot === jobParty.id) r.outerHTML = diffHTML(jobParty, jobDoc); }
async function diffRefresh() {   // ledger badla (PC ne likha) aur farq screen khuli — lines dobara (1 read) + repaint
  const r = document.querySelector('#dialogBody [data-pm-droot]'); if (!r || !jobParty) return;
  const at = Number(led()?.at) || 0; if (!at || at <= linesAt) { repaintDiff(); return; }
  linesAt = at;
  try { const d = await C.getLines(jobParty.id); if (d) jobDoc = d; } catch {}
  if (reqAt && Number(led()?.req) >= reqAt) { reqAt = 0; clearTimeout(reqT); C.notice('✅ POS data taza ho gaya'); }
  repaintDiff();
}
function fixHTML(p, D) {
  if (!C.owner()) return '';
  const j = fixState();
  const busy = j && j.status !== 'done';
  const nA = D.posOnly.filter(x => x.code && x.dt !== 'PO').length, nP = D.appOnly.filter(a => !/^pos-/.test(String(a.e.id)) && !a.e.purchase && ['payment', 'collection', 'credit', 'borrow'].includes(a.e.kind)).length;
  const chips = busy ? '' : `<div class="pm-fix"><small>Barabar karo:</small>${nA ? `<button type="button" data-pm-fix="app">📱 App ko POS jaisa <i>${nA}</i></button>` : ''}${nP ? `<button type="button" data-pm-fix="pos">🖥 POS ko app jaisa <i>${nP}</i></button>` : ''}${!nA && !nP ? '<span class="pm-fixok">✓ voucher wali koi entry baqi nahi (purchase bill sync.js se)</span>' : ''}</div>`;
  const jt = j && j.status === 'done' ? [j.done ? `✅ ${j.done} ban gayi` : '', j.skip ? `↩ ${j.skip} pehle se thi (kuch nahi kiya)` : '', j.fail ? `✕ ${j.fail} nahi bani` : ''].filter(Boolean).join(' · ') || '✓ kuch karna nahi para' : '';
  const stale = j && j.status === 'done' && (Number(led()?.at) || 0) < (Number(j.doneAt) || 0);
  const st = j ? `<div class="pm-fixst ${j.status === 'done' ? (j.fail ? 'warn' : 'ok') : 'wait'}"><b>${j.status === 'done' ? jt : '⏳ Shop PC bana raha hai — ' + (j.dir === 'app' ? 'app mein ' : 'POS mein ') + (j.n || '') + ' entries (1–2 min)'}</b>${j.status === 'done' ? `<small>${stale ? '⏳ POS ka naya baqaya aa raha hai (1 min) — screen khud taza hogi' : '✓ Neeche ka hisaab naye POS data se hai'}</small>` : ''}${Array.isArray(j.log) && j.log.length ? `<details><summary>tafseel (${j.log.length})</summary>${j.log.map(x => `<div>${esc(x)}</div>`).join('')}</details>` : ''}</div>` : '';
  return chips + st;
}
function jobWatch(pid) {
  if (jobPid === pid && jobStop) return;
  if (jobStop) { try { jobStop(); } catch {} jobStop = null; }
  jobPid = pid; jobs = [];
  if (C.listenJobs) jobStop = C.listenJobs(pid, L => { jobs = L || []; const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r && r.dataset.pmDroot === pid && jobParty && jobDoc) r.outerHTML = diffHTML(jobParty, jobDoc); });
}
async function fixGo(dir) {
  const p = jobParty, doc = jobDoc; if (!p || !doc) return;
  const D = pmDiff(p, doc);
  const L = dir === 'app' ? D.posOnly.filter(x => x.code && x.dt !== 'PO') : D.appOnly.filter(a => !/^pos-/.test(String(a.e.id)) && !a.e.purchase && ['payment', 'collection', 'credit', 'borrow'].includes(a.e.kind));   // purchase bill / cash purchase voucher nahi (POS mein bill hota hai)
  if (!L.length) { C.notice(dir === 'app' ? 'Sirf purchase bill wali lines hain — wo sync.js se aati hain' : 'In entries ka voucher nahi banta (purchase bill / cash purchase)'); return; }
  const ids = dir === 'app' ? L.map(x => x.code).filter(Boolean) : L.map(a => a.e.id);
  const amt = L.reduce((n, x) => n + Math.abs(dir === 'app' ? x.amt : x.amt), 0);
  const lines = L.slice(0, 12).map(x => dir === 'app' ? `${dTxt(x.d)} · ${x.code} · ${money(x.amt)} ${sideTxt(x.amt)}` : `${dTxt(x.e.date)} · ${(KIND[x.e.kind] || x.e.kind).replace(/^\S+\s/, '')} · ${money(x.amt)} ${sideTxt(x.amt)}`).join('\n');
  const msg = dir === 'app'
    ? `📱 APP KO POS JAISA — ${p.name}\n${L.length} POS vouchers app ke khate mein ENTRY ban jayengi (usi tareekh, raqam, POS number ke saath):\n\n${lines}${L.length > 12 ? '\n…' : ''}\n\nKul ${money(amt)}. Shop PC 1–2 min mein likhega. Theek?`
    : `🖥 POS KO APP JAISA — ${p.name}\n${L.length} app entries POS mein VOUCHER ban jayengi (Payment → CPV, Wasooli → CRV, Saman liya/diya → JV):\n\n${lines}${L.length > 12 ? '\n…' : ''}\n\nKul ${money(amt)}. Shop PC 1–2 min mein banayega. Theek?`;
  if (!confirm(msg)) return;
  try { await C.addJob({ partyId: p.id, dir, ids, n: ids.length, amt }); C.notice('⏳ Shop PC ko kaha — 1–2 min'); jobs = [{ status: 'new', dir, n: ids.length, at: Date.now() }, ...jobs]; const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r) r.outerHTML = diffHTML(p, doc); }
  catch (err) { C.notice('Nahi gaya: ' + (err?.message || err) + (/permission/i.test(String(err?.message)) ? ' — rules 2.77 abhi nahi lagi' : '')); }
}
export function pmDiff(p, doc) {   // {appOnly:[], posOnly:[], diff:[], pre:{app,pos}, sum, farq, ok}
  let L = []; try { L = JSON.parse(doc?.j || '[]'); } catch {}
  const pos = L.filter(x => Number(x[7]) !== 3).map((x, i) => ({ i, d: x[0], code: x[1], dt: x[2], no: String(x[3] || ''), amt: (Number(x[4]) || 0) - (Number(x[5]) || 0), desc: x[6] || '', used: false }));
  const E = C.entries().filter(e => e.partyId === p.id && !e.deleted && !skipsBalance(e)).map(e => ({ e, amt: appAmt(e), used: false }));
  const appOnly = [], posOnly = [], diff = [];
  let preApp = 0; const preIds = [];
  for (const a of E) { if (/^pos-opening-/.test(String(a.e.id)) || /sabqa baqaya/i.test(String(a.e.note || ''))) { preApp += a.amt; a.used = true; preIds.push(a); } }
  const prePos = Number(doc?.pre) || 0;
  const take = (a, x) => { a.used = true; x.used = true; if (Math.abs(a.amt - x.amt) > TOL) diff.push({ a: a.e, x, da: a.amt, dx: x.amt }); };
  for (const a of E) { if (a.used) continue; const c = String(a.e.posCode || '').trim().toUpperCase(); if (!c) continue; const x = pos.find(y => !y.used && y.code.toUpperCase() === c); if (x) take(a, x); }
  for (const a of E) { if (a.used) continue; const m = String(a.e.id).match(/^pos-(\d+)$/); if (!m) continue; const x = pos.find(y => !y.used && y.dt === 'PO' && String(Number(y.no)) === String(Number(m[1]))); if (x) take(a, x); }
  for (const a of E) { if (a.used || !a.amt) continue; const cands = pos.filter(y => !y.used && Math.abs(y.amt - a.amt) <= TOL && dayDiff(y.d, a.e.date || '') <= 3).sort((u, v) => dayDiff(u.d, a.e.date) - dayDiff(v.d, a.e.date)); if (cands[0]) take(a, cands[0]); }
  for (const a of E) if (!a.used && a.amt) appOnly.push({ e: a.e, amt: a.amt });
  for (const x of pos) if (!x.used && x.amt) posOnly.push(x);
  const opening = Number(p.opening) || 0;
  const sum = appOnly.reduce((n, a) => n + a.amt, 0) - posOnly.reduce((n, x) => n + x.amt, 0) + diff.reduce((n, d) => n + (d.da - d.dx), 0) + (preApp - prePos) + opening;
  const farq = pmRow(p).farq;
  return { appOnly, posOnly, diff, pre: { app: preApp, pos: prePos, ids: preIds }, opening, sum, farq, ok: Math.abs(sum - farq) <= TOL };
}
const amtTxt = v => `<b class="${v > 0 ? 'l' : 'd'}">${money(v)} ${sideTxt(v)}</b>`;
function diffHTML(p, doc) {
  const r = pmRow(p), D = pmDiff(p, doc), at = doc?.at;
  const appLine = (e, amt) => `<div class="pm-e"><span class="pm-ed">${dTxt(e.date)}</span><span class="pm-et"><b>${esc(KIND[e.kind] || e.kind)}</b><small>${esc(e.note || '')}${e.posCode ? ' · ' + esc(e.posCode) : ''}</small></span>${amtTxt(amt)}</div>`;
  const posLine = x => `<div class="pm-e"><span class="pm-ed">${dTxt(x.d)}</span><span class="pm-et"><b>${esc(x.code || x.dt || 'POS')}${x.dt === 'PO' ? ' · Purchase bill ' + esc(x.no) : x.dt ? ' · ' + esc(x.dt) + (x.no ? ' ' + esc(x.no) : '') : ''}</b><small>${esc(x.desc)}</small></span>${amtTxt(x.amt)}</div>`;
  const sec = (t, cls, n, body) => `<div class="pm-sec ${cls}"><div class="pm-sh"><b>${t}</b><i>${n}</i></div>${body || '<p class="pm-none">koi nahi</p>'}</div>`;
  return `<div class="bc-root pm-droot" data-pm-droot="${esc(p.id)}">
    <button type="button" class="pm-back" data-pm-back="1">‹ POS milan</button>
    <div class="pm-sum ${r.state === 'farq' ? 'bad' : 'ok'}"><b>${esc(p.name)} — ${r.state === 'farq' ? '⚠ farq ' + money(r.farq) : '✓ barabar'}</b><small>✍️ App ${money(r.app)} ${sideTxt(r.app)} · 🖥 POS ${r.pos == null ? '—' : money(r.pos) + ' ' + sideTxt(r.pos)} · POS lines ${at ? agoTxt(at) : '—'}</small>
      <small class="${D.ok ? 'pm-okl' : 'pm-badl'}">${D.ok ? '✓ Neeche wali entries se poora farq ban jata hai' : '⚠ Neeche wali entries se ' + money(D.sum) + ' banta hai — baqi ' + money(D.farq - D.sum) + ' kisi aur wajah se (cancel voucher / tareekh)'}</small></div>
    ${freshHTML(doc)}
    ${fixHTML(p, D)}
    ${sec('📱 App mein hai — POS mein nahi', 'a', D.appOnly.length, D.appOnly.map(a => appLine(a.e, a.amt)).join(''))}
    ${sec('🖥 POS mein hai — app mein nahi', 'p', D.posOnly.length, D.posOnly.map(posLine).join(''))}
    ${sec('⚠ Dono mein — raqam farq', 'd', D.diff.length, D.diff.map(d => `<div class="pm-e2">${appLine(d.a, d.da)}${posLine(d.x)}<small class="pm-fq">farq ${money(d.da - d.dx)}</small></div>`).join(''))}
    ${Math.abs(D.pre.app - D.pre.pos) > TOL || D.opening ? sec('📜 Sabqa baqaya (15-Sep-2026 se pehle) / opening', 'o', '', `<div class="pm-e"><span class="pm-ed"></span><span class="pm-et"><b>App: Sabqa baqaya ${D.opening ? '+ opening ' + money(D.opening) : ''}</b><small>POS ki purani lines ka jor</small></span>${amtTxt(D.pre.app + D.opening)}</div><div class="pm-e"><span class="pm-ed"></span><span class="pm-et"><b>POS: 15-Sep se pehle</b></span>${amtTxt(D.pre.pos)}</div>`) : ''}
    <p class="stat-note">Milan: voucher number (CPV/CRV/JV) · POS purchase bill number · warna raqam + tareekh (±3 din). Cancel vouchers shamil nahi. PC har 15 min taza karta hai.</p>
  </div>`;
}
export async function pmDiffOpen(id) {
  const p = C.parties().find(x => x.id === id); if (!p) return;
  if (!C.can('kh.posmilan')) { C.notice('⚖️ POS milan ki ijazat nahi'); return; }
  C.modal('🔍 Farq ki entries', '<p class="stat-note">⏳ POS lines…</p>', true);
  let doc = null; try { doc = await C.getLines(p.id); } catch (e) { C.notice('POS lines nahi mili: ' + (e?.message || e)); }
  if (!$('dialog')?.open) return;
  if (!doc) { $('dialogBody').innerHTML = `<div class="bc-root"><button type="button" class="pm-back" data-pm-back="1">‹ POS milan</button><div class="empty"><strong>Is khate ki POS lines abhi PC se nahi aayin</strong><p>PC (pos-khata-sync) har 15 min likhta hai — rules 2.75 publish hon aur PC chal raha ho.</p></div></div>`; return; }
  jobParty = p; jobDoc = doc; linesAt = Number(led()?.at) || 0; jobWatch(p.id);
  $('dialogBody').innerHTML = diffHTML(p, doc);
}
document.addEventListener('input', e => { const t = e.target; if (!t?.dataset?.pmQ) return; st.q = t.value; pmPaint(); });
document.addEventListener('click', e => {
  if (!C) return;
  const b = e.target.closest?.('[data-pm-taza],[data-pm-fix],[data-pm-f],[data-pm-open],[data-pm-diff],[data-pm-back],[data-pm-tog]'); if (!b) return;
  if (b.dataset.pmFix) { e.stopPropagation(); fixGo(b.dataset.pmFix); return; }
  if (b.dataset.pmTaza) { e.stopPropagation(); tazaGo(); return; }
  if (b.dataset.pmTog) { pmOpenLine = pmOpenLine === b.dataset.pmTog ? '' : b.dataset.pmTog; const w = document.querySelector('#summary [data-pm-line]'); if (w) { const p = C.parties().find(x => x.id === b.dataset.pmTog); if (p) w.innerHTML = pmLineHTML(p); } return; }
  if (b.dataset.pmDiff) { e.stopPropagation(); e.preventDefault(); pmDiffOpen(b.dataset.pmDiff); return; }
  if (b.dataset.pmBack) { pmOpen(); return; }
  if (b.dataset.pmF) { st.f = b.dataset.pmF; pmPaint(); return; }
  if (b.dataset.pmOpen) { const id = b.dataset.pmOpen; try { $('close')?.click(); } catch {} try { $('dialog')?.close(); } catch {} setTimeout(() => C.openAccount(id), 60); }
});
