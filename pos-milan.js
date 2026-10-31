// pos-milan.js — v2.0 (2026-10-29, app v2.147.3: ↩ OPENING THEEK KI JAANCH — har opening theek ka asar + malik ka ↩ Wapas · opening mein 15-Sep se pehle ki SAB app entries · bank / HBL khata opening nahi · list mein khud ☑ nahi · PC khud opening nahi) · v1.9 (2026-10-28, app v2.144.0: 📜 OPENING FARQ — sab khate list ☑ + khate ki Farq screen, malik ke chip 🖥 POS ko app jaisa / 📱 App ko POS jaisa → milanJobs ids ['@opening']) · v1.8 (2026-10-28, app v2.143.0: 🔎 POS purchase bill ki farq ki WAJAH — PC bill jaanch blueAccess/billJaanch + chips 💵 Cash ada / 📌 Post / 🧾 Bill) · v1.7 (2026-10-27, app v2.135.0: 🤖 PC auto milan ki aaj ki list + POS opening voucher opening ke khane mein) · v1.6 (2026-10-27, app v2.134.0: ✕ entry-war 'POS mein nahi' khate ke card par + 📤 ek entry bhejo · ⇄ transfer bhi) · v1.5 (2026-10-27, app v2.133.7: 📤 sab khaton ki baqi entries POS mein — taza data → list ☑ → milanJobs) · v1.4 (2026-10-27, app v2.133.4: 🔄 Taza karo + POS data ka waqt, job ke baad khud taza, ↩ pehle se alag) · v1.3 (2026-10-27, app v2.133.0: ⚖️ barabar karo chips — milanJobs app/pos, rules 2.77) · v1.0 (2026-10-26, app v2.124.0) ⚖️ POS MILAN — har khate ka app baqaya vs POS ledger baqaya.
// Malik: "jitne bhi khate hain, POS ka ledger aur humara khata same aa raha hai — sab khaton ke liye check karna hai; har khate ki screen par bhi POS baqaya".
// v1.1 (app v2.125.0): 🔍 FARQ KI ENTRIES — posLines/<id> (PC har 15 min, sab khate) se entry-war milan: App mein hai POS nahi · POS mein hai app nahi · raqam farq.
// Data: blueAccess/posLedger {m:{appPartyId: paisa (lena +, dena −)}, at, n} — PC pos-khata-sync har 15 min. Yahan sirf UI. AI nahi.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + (Math.abs(Number(n) || 0) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
import { skipsBalance, cashPaysBill } from './model.js?v=2.156.1';
const TOL = 100, PRE_FROM = '2026-09-15';   // v2.0: PC LINES_FROM / START_DATE jaisa
const OPEN_RX = /opening|shuru ka baqaya|sabqa baqaya/i;   // v1.7 = PC autoMilan OPEN_RX   // paisa — Rs 1 tak farq = theek (POS 2 decimal rounding)
let C = null, st = { f: 'farq', q: '' };
export function pmSetup(ctx) { C = ctx; autoStart(); jzStart(); }
// v1.7 (app v2.135.0): 🤖 PC ka khud barabar — blueAccess/autoMilan {d, m:{appId:{at,name,n,fail,txt,farq}}} (sirf malik parhta)
let auto = null, autoStop = null;
function autoStart() { if (autoStop || !C || !C.listenAuto || !C.owner()) return; try { autoStop = C.listenAuto(d => { auto = d || null; try { pmPaint(); } catch {} try { C.linePaint && C.linePaint(); } catch {} }); } catch {} }
// v1.8 (app v2.143.0): 🔎 BILL JAANCH — malik: Waqas Traders bill 00002479 "ye entry pehle se farq hai, is ko sahi karna hai". PC (pos-khata-sync h) farq wale khate ki
//   "App mein hai — POS mein nahi" POS purchase bill ka POS mein haal dekhta hai: delete / cancel / party / raqam / 📌 khud theek; baqi WAJAH yahan (sirf malik parhta):
//   blueAccess/billJaanch {m:{entryId:{k,t,no,p}}, at}. k: cash → 💵 Cash ada likho (payment + posNo + dailyIncluded false + jzBill — POS mein voucher nahi, purane din ka galla / Daily nahi
//   badalta; purchaseCash NAHI — woh Daily ke akhrajat mein ginta) · open → 📌 Post karo
//   (wahi sendPost) · baqi → 🧾 Bill dekhein. AI nahi.
let jz = null, jzStop = null;
function jzStart() { if (jzStop || !C || !C.listenJz || !C.owner()) return; try { jzStop = C.listenJz(d => { jz = d || null; rerender(); try { const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r && jobParty && jobDoc) r.outerHTML = diffHTML(jobParty, jobDoc); } catch {} }); } catch {} }
const jzDone = new Set();   // is session mein chip daba diya (PC ke agle chakkar tak)
function jzOf(e) {
  const z = jz?.m?.[e?.id]; if (!z || !e || e.deleted || jzDone.has(e.id) || z.p !== e.partyId) return null;
  const p = C.parties().find(x => x.id === e.partyId); if (!p || pmRow(p).state !== 'farq') return null;
  return z;
}
function jzHTML(e, z) {
  const own = C.owner(), id = esc(e.id);
  const chip = z.k === 'cash' && own ? `<button type="button" class="pm-send" data-pm-cash="${id}">💵 Cash ada likho</button>`
    : z.k === 'open' && own ? `<button type="button" class="pm-send" data-pm-post="${id}">📌 Post karo</button>` : '';
  return `<div class="pm-ent jz"><small>🔎 🖥 ${esc(z.t)}</small><span class="pm-jzc">${chip}<button type="button" class="pm-send pm-bill" data-pm-bill="${id}">🧾 Bill dekhein</button></span></div>`;
}
const pkDay = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const autoToday = () => (auto && auto.m && auto.d === pkDay()) ? auto.m : {};   // ctx: parties, entries, balance, ledger, can, owner, notice, modal, openAccount
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
  const am = autoToday()[p.id], rob = am && am.n ? (big ? ` · 🤖 PC ne aaj khud barabar kiya${am.txt ? ' (' + esc(String(am.txt).split(' | ')[0].slice(0, 90)) + ')' : ''}` : ' 🤖') : '';
  if (r.state === 'ok') return `<button type="button" class="pm-line ok${big ? ' big' : ''}" data-pm-tog="${esc(p.id)}">🖥 POS ✓${big ? ` baqaya ${money(r.pos)} ${sideTxt(r.pos)} · barabar` : ''}${rob}</button>`;
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
function autoHTML() {
  const M = autoToday(), L = Object.entries(M).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)); if (!L.length) return '';
  const ok = L.filter(([, x]) => x.n && !x.fail).length;
  return `<details class="pm-auto"><summary>🤖 Aaj PC ne khud barabar kiye: <b>${ok}</b> khate${L.length > ok ? ` · ✕ ${L.length - ok} adhoore` : ''}</summary>${L.map(([id, x]) => `<button type="button" class="pm-ar ${x.fail ? 'bad' : 'ok'}" data-pm-diff="${esc(id)}"><b>${x.fail ? '✕' : '✅'} ${esc(x.name || id)}</b><small>${esc(String(x.txt || '').slice(0, 220))}</small><i>${new Date(x.at || 0).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</i></button>`).join('')}<p class="stat-note">PC har 15 min sirf PAKKE farq khud theek karta hai (sirf ek taraf ki entries / opening jab POS ka 15-Sep se pehle 0). Baqi aap ke chips se.</p></details>`;
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
    ${C.owner() ? `<div class="pm-bulkrow">${C.reqLedger && nF ? '<button type="button" class="pm-bulkbtn" data-pm-bulk="go" data-mn-keep="1">📤 Sab khaton ki baqi entries POS mein bhejo</button><button type="button" class="pm-bulkbtn pm-obbtn" data-pm-ob="go" data-mn-keep="1">📜 Opening farq barabar karo</button>' : ''}<button type="button" class="pm-bulkbtn pm-oubtn" data-pm-ou="go" data-mn-keep="1">↩ Opening theek ki jaanch</button></div>` : ''}
    ${autoHTML()}
    <div class="bc-list">${!L ? '<div class="empty"><strong>PC se POS ledger abhi nahi aaya</strong><p>pos-khata-sync 15 minute mein likhti hai — PC chal raha ho.</p></div>' : rows.length ? rows.map(({ p, r }) => `<button type="button" class="pm-r ${r.state}" data-pm-open="${esc(p.id)}">
      <span class="pm-n"><b>${esc(p.name)}</b><small>${esc(p.category || '')}</small></span>
      <span class="pm-v"><small>✍️ App</small><b>${money(r.app)} <i>${sideTxt(r.app)}</i></b></span>
      <span class="pm-v"><small>🖥 POS</small><b>${r.state === 'none' ? '—' : money(r.pos) + ' <i>' + sideTxt(r.pos) + '</i>'}</b></span>
      <span class="pm-d">${r.state === 'none' ? '<em class="n">POS mein nahi</em>' : r.state === 'ok' ? '<em class="o">✓</em>' : `<em class="b">⚠ ${money(r.farq)}</em><i class="pm-dbtn" data-pm-diff="${esc(p.id)}">🔍 Farq dhoondo</i>`}</span></button>`).join('') : `<div class="empty"><strong>${st.f === 'farq' ? 'Koi farq nahi ✓' : 'Kuch nahi'}</strong></div>`}</div>
    <p class="stat-note">Farq = app ka baqaya − POS ka ledger baqaya. Rs 1 tak farq = theek (POS ki rounding). Khate par tap = wo khata khule. PC har 15 min POS se taza karta hai.</p>
  </div>`;
}
// ---------- 📤 SAB KHATE EK SAATH (v2.133.7) — malik: "is tarah ki jitni bhi entries hain sab ko jorne ka order kar do" ----------
// Pehle 🔄 taza POS data (posLedgerReq) → har farq wale khate ki lines (1 read / khata) → pmDiff → "App mein hai — POS mein nahi" ki voucher wali entries
// (Payment / Wasooli / Udhaar diya / Saman liya / ⇄ Transfer; purchase bill, voucher no. wali nahi) → list ☑ (default: sirf wo khate jahan yahi entries poora farq hain
// aur POS mein koi alag / raqam-farq line nahi) → confirm → har khate ki EK milanJob (dir pos) — WAHI raasta jo khate ka "🖥 POS ko app jaisa".
let bulk = null;
const bulkElig = e => !/^pos-/.test(String(e.id)) && !e.purchase && !String(e.posCode || '').trim() && e.posNo !== true && ['payment', 'collection', 'credit', 'borrow'].includes(e.kind)
  && !(e.transferId && (String(e.transferId).startsWith('posv') || String(e.posVoucher || '').trim()));   // v1.6: ⇄ transfer bhi (PC milanTransfer — dono khate jude hon)
export const pmSendElig = bulkElig;
function bulkHTML() {
  const B = bulk; if (!B) return '';
  const head = `<button type="button" class="pm-back" data-pm-back="1">‹ POS milan</button><div class="pm-sum"><b>📤 Sab khaton ki baqi entries POS mein</b><small>App mein hain, POS mein nahi — har khate ka voucher (CPV / CRV / JV) shop PC banayega</small></div>`;
  let body = '';
  if (B.st === 'taza') body = `<div class="pm-fixst wait"><b>⏳ Pehle POS ka taza data mangwa raha hoon (1 min)…</b><small>Purane data se ghalat entries na jayen</small></div>`;
  else if (B.st === 'late') body = `<div class="pm-fixst warn"><b>⚠️ Shop PC ne 3 min mein taza data nahi bheja</b><small>PC / internet check karein. Purane data se bhejna khatarnak ho sakta hai.</small></div><div class="pm-fix"><button type="button" data-pm-bulkgo="old">Phir bhi purane data se dekho</button></div>`;
  else if (B.st === 'load') body = `<div class="pm-fixst wait"><b>⏳ Khaton ki POS lines parh raha hoon… ${B.done || 0}/${B.total || 0}</b></div>`;
  else if (B.st === 'sent') body = `<div class="pm-fixst ok"><b>✅ ${B.sent} khaton ki ${B.sentN} entries ka hukum shop PC ko chala gaya</b><small>PC 1–5 min mein POS mein banayega; har khata banne ke baad POS milan khud taza ho jayega.</small></div>`;
  else if (B.st === 'ready') {
    const R = B.rows, sel = R.filter(r => B.sel.has(r.p.id)), n = sel.reduce((a, r) => a + r.ids.length, 0), amt = sel.reduce((a, r) => a + r.amt, 0);
    const line = r => `<label class="pm-bk ${r.safe ? '' : 'warn'}"><input type="checkbox" data-pm-bsel="${esc(r.p.id)}"${B.sel.has(r.p.id) ? ' checked' : ''}><span class="pm-bn"><b>${esc(r.p.name)}</b><small>${r.ids.length} entries · ${money(r.amt)}${r.safe ? ' · ✓ is se khata barabar' : ' · ⚠ ' + esc(r.why)}</small></span><button type="button" class="pm-bo" data-pm-diff="${esc(r.p.id)}">🔍</button></label>`;
    body = `${R.length ? `<div class="pm-bsum"><b>${sel.length}/${R.length} khate · ${n} entries · ${money(amt)}</b><span><button type="button" data-pm-ball="1">☑ Sab</button><button type="button" data-pm-bsafe="1">✓ Sirf pakke</button><button type="button" data-pm-bnone="1">☐ Koi nahi</button></span></div>
      <div class="pm-blist">${R.map(line).join('')}</div>
      <button type="button" class="got pm-bgo" data-pm-bsend="1"${sel.length ? '' : ' disabled'}>📤 ${sel.length} khaton ki ${n} entries POS mein bhejo</button>` : '<div class="pm-fixst ok"><b>✓ Koi baqi entry nahi — jo farq hai wo POS ki taraf ya purchase bill ka hai</b></div>'}
      ${B.skip ? `<p class="stat-note">${B.skip} khaton mein bhejne wali entry nahi (farq POS ki taraf / purchase bill / voucher no. wali) — un ko 🔍 Farq se dekhein.</p>` : ''}`;
  }
  return `<div class="bc-root pm-droot pm-broot" data-pm-bulk="1">${head}${body}</div>`;
}
function bulkPaint() { const r = document.querySelector('#dialogBody [data-pm-bulk]'); if (r) r.outerHTML = bulkHTML(); }
async function bulkStart() {
  if (!C.owner()) { C.notice('Sirf malik'); return; }
  bulk = { st: 'taza', rows: [], sel: new Set() };
  $('dialogBody').innerHTML = bulkHTML();
  let at = 0; try { at = await C.reqLedger(); } catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); bulk.st = 'late'; bulkPaint(); return; }
  const t0 = Date.now();
  while (bulk && bulk.st === 'taza' && !(Number(led()?.req) >= at)) { if (Date.now() - t0 > 180000) { bulk.st = 'late'; bulkPaint(); return; } await new Promise(r => setTimeout(r, 2000)); }
  if (bulk && bulk.st === 'taza') bulkLoad();
}
async function bulkLoad() {
  const B = bulk; if (!B) return;
  const P = C.parties().filter(p => !p.bank && pmRow(p).state === 'farq');
  B.st = 'load'; B.total = P.length; B.done = 0; B.rows = []; B.skip = 0; bulkPaint();
  let k = 0;
  const work = async () => { while (k < P.length && bulk === B) { const p = P[k++]; let doc = null; try { doc = await C.getLines(p.id); } catch {} B.done++;
    if (doc) { const D = pmDiff(p, doc), E = D.appOnly.filter(a => bulkElig(a.e));
      if (E.length) { const safe = D.ok && !D.posOnly.length && !D.diff.length && E.length === D.appOnly.length;
        B.rows.push({ p, ids: E.map(a => a.e.id), amt: E.reduce((n, a) => n + Math.abs(a.amt), 0), safe, why: !D.ok ? 'in entries se poora farq nahi banta' : D.posOnly.length ? D.posOnly.length + ' POS line app mein nahi' : D.diff.length ? D.diff.length + ' raqam farq' : 'kuch entries yahan se nahi jati' });
      } else B.skip++; } else B.skip++;
    if (B.done % 3 === 0) bulkPaint(); } };
  await Promise.all([work(), work(), work(), work()]);
  if (bulk !== B) return;
  B.rows.sort((a, b) => (b.safe - a.safe) || b.amt - a.amt);
  B.sel = new Set(B.rows.filter(r => r.safe).map(r => r.p.id));
  B.st = 'ready'; bulkPaint();
}
async function bulkSend() {
  const B = bulk; if (!B || B.st !== 'ready') return;
  const sel = B.rows.filter(r => B.sel.has(r.p.id)); if (!sel.length) return;
  const n = sel.reduce((a, r) => a + r.ids.length, 0), amt = sel.reduce((a, r) => a + r.amt, 0);
  if (!confirm(`📤 ${sel.length} khaton ki ${n} entries (kul ${money(amt)}) POS mein voucher ban jayengi:\n\n${sel.slice(0, 15).map(r => `• ${r.p.name} — ${r.ids.length} · ${money(r.amt)}`).join('\n')}${sel.length > 15 ? '\n…' : ''}\n\nPOS mein likhna wapas nahi hota (POS mein hi delete). Theek?`)) return;
  let ok = 0, okN = 0;
  for (const r of sel) { try { await C.addJob({ partyId: r.p.id, dir: 'pos', ids: r.ids, n: r.ids.length, amt: r.amt }); ok++; okN += r.ids.length; } catch (err) { C.notice(r.p.name + ': ' + (err?.message || err)); } }
  B.st = 'sent'; B.sent = ok; B.sentN = okN; bulkPaint();
}
// ---------- 📜 OPENING FARQ BARABAR (v1.9, app v2.144.0) — malik: "opening farq jin khaton ka hai wo sab settle hone chahiye · settle meri ijazat se" ----------
// Sab farq wale khaton ki POS lines (pehle 🔄 taza) → pmDiff: app ka sabqa (+ opening) vs POS 15-Sep se pehle (+ opening voucher) → list ☑ → malik ka chip:
//   🖥 POS ko app jaisa = PC POS mein JV "Opening balance farq (app)" (party vs Equity) · 📱 App ko POS jaisa = PC app mein "Sabqa baqaya farq theek (POS jaisa)"
//   (15-Sep se pehle, posNo — POS mein nahi jati). Job = milanJobs {dir pos|app, ids:['@opening']} (rules 2.77 wahi — naya dir nahi). Har khate ka ⏳ / ✅ / ✕.
//   Khud (bina ijazat) sirf purana qaida: POS ka 15-Sep se pehle 0 = app wala (autoMilan). AI nahi.
let ob = null;
const ofOf = D => (D.pre.app + D.opening) - D.pre.pos;
const ofixJob = L => (L || []).find(j => Array.isArray(j.ids) && j.ids[0] === '@opening') || null;
const ofixSt = j => !j ? '' : j.status !== 'done' ? '⏳ PC kar raha…' : j.fail ? '✕ ' + String((j.log || [])[0] || 'nahi hua').replace(/^[^:]*:\s*/, '') : j.skip ? '↩ pehle se barabar' : '✅ barabar ho gaya';
const bankP = p => !!p && (!!p.bank || !!(C.isBank && C.isBank(p.id)));   // v2.0: HBL khata bhi (isBank)
function ofixHTML(p, of) {
  if (!C.owner() || bankP(p)) return '';
  const j = ofixJob(jobs);
  if (j && j.status !== 'done') return '<div class="pm-fixst wait"><b>⏳ Shop PC opening barabar kar raha hai… (1–2 min)</b></div>';
  return `<div class="pm-fix pm-ofix"><small>Opening barabar karo (aap ki ijazat):</small><button type="button" data-pm-ofix="pos">🖥 POS ko app jaisa</button><button type="button" data-pm-ofix="app">📱 App ko POS jaisa</button></div>${j ? `<small class="pm-ofl">Pichhli dafa: ${esc(ofixSt(j))} ${esc(String((j.log || [])[0] || '').slice(0, 140))}</small>` : ''}`;
}
const ofixAsk = (rows, dir) => confirm(`📜 ${rows.length} khaton ka OPENING (15-Sep se pehle) farq barabar:\n\n${rows.slice(0, 15).map(r => `• ${r.name} — farq ${money(r.of)}`).join('\n')}${rows.length > 15 ? '\n…' : ''}\n\n${dir === 'pos' ? '🖥 POS ko app jaisa: POS mein har khate ka JV "Opening balance farq (app)" (party vs Equity) banega — POS mein likhna wapas nahi hota.' : '📱 App ko POS jaisa: app mein har khate ki "Sabqa baqaya farq theek (POS jaisa)" entry (14-Sep, POS mein nahi jati) — app ka sabqa POS jitna.'}\n\nTheek?`);
async function ofixGo(dir) {
  const p = jobParty, doc = jobDoc; if (!p || !doc || !C.owner() || bankP(p)) return;
  const of = ofOf(pmDiff(p, doc)); if (Math.abs(of) <= TOL) { C.notice('✓ Opening pehle se barabar'); return; }
  if (!ofixAsk([{ name: p.name, of }], dir)) return;
  try { await C.addJob({ partyId: p.id, dir, ids: ['@opening'], n: 1, amt: of }); jobs = [{ status: 'new', dir, ids: ['@opening'], at: Date.now() }, ...jobs]; C.notice('⏳ Shop PC ko kaha — 1–2 min'); repaintDiff(); }
  catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); }
}
function obHTML() {
  const B = ob; if (!B) return '';
  const head = `<button type="button" class="pm-back" data-pm-back="1">‹ POS milan</button><div class="pm-sum"><b>📜 Opening farq — sab khate</b><small>App ka sabqa baqaya (15-Sep se pehle) vs POS — aap chunein kis taraf barabar ho</small></div>`;
  let body = '';
  if (B.st === 'taza') body = '<div class="pm-fixst wait"><b>⏳ Pehle POS ka taza data mangwa raha hoon (1 min)…</b></div>';
  else if (B.st === 'late') body = '<div class="pm-fixst warn"><b>⚠️ Shop PC ne 3 min mein taza data nahi bheja</b><small>PC / internet check karein.</small></div><div class="pm-fix"><button type="button" data-pm-obgo="old">Phir bhi purane data se dekho</button></div>';
  else if (B.st === 'load') body = `<div class="pm-fixst wait"><b>⏳ Khaton ki POS lines parh raha hoon… ${B.done || 0}/${B.total || 0}</b></div>`;
  else {
    const R = B.rows, sel = R.filter(r => B.sel.has(r.p.id)), amt = sel.reduce((a, r) => a + Math.abs(r.of), 0), sent = B.sent || new Map();
    const line = r => { const j = sent.get(r.p.id), s = j ? ofixSt(j.job) || '⏳ bheja' : ''; return `<label class="pm-bk${j ? ' sent' : ''}"><input type="checkbox" data-pm-obsel="${esc(r.p.id)}"${B.sel.has(r.p.id) ? ' checked' : ''}${j ? ' disabled' : ''}><span class="pm-bn"><b>${esc(r.p.name)}</b><small>✍️ App ${money(r.app)} ${sideTxt(r.app)} · 🖥 POS ${money(r.pos)} ${sideTxt(r.pos)} · <b>farq ${money(r.of)}</b>${s ? ' · ' + esc(s) : ''}</small></span><button type="button" class="pm-bo" data-pm-diff="${esc(r.p.id)}">🔍</button></label>`; };
    body = R.length ? `<div class="pm-bsum"><b>${sel.length}/${R.length} khate · farq ${money(amt)}</b><span><button type="button" data-pm-oball="1">☑ Sab</button><button type="button" data-pm-obnone="1">☐ Koi nahi</button></span></div>
      <div class="pm-blist">${R.map(line).join('')}</div>
      <div class="pm-fix pm-obgo"><button type="button" data-pm-obgo="pos"${sel.length ? '' : ' disabled'}>🖥 POS ko app jaisa <i>${sel.length}</i></button><button type="button" data-pm-obgo="app"${sel.length ? '' : ' disabled'}>📱 App ko POS jaisa <i>${sel.length}</i></button></div>
      <p class="stat-note">Koi khata khud ☑ nahi — aap chunein. Kuch nahi hota jab tak aap upar ka chip na dabayein. Har khate ka haal yahin aata hai (⏳ / ✅ / ✕). Bank khate is list mein nahi.</p>` : '<div class="pm-fixst ok"><b>✓ Kisi khate ka opening farq nahi</b></div>';
  }
  return `<div class="bc-root pm-droot pm-broot" data-pm-ob="1">${head}${body}</div>`;
}
function obPaint() { const r = document.querySelector('#dialogBody [data-pm-ob]:not(button)'); if (r) r.outerHTML = obHTML(); }
async function obStart() {
  if (!C.owner()) { C.notice('Sirf malik'); return; }
  ob = { st: 'taza', rows: [], sel: new Set(), sent: new Map() };
  $('dialogBody').innerHTML = obHTML();
  let at = 0; try { at = await C.reqLedger(); } catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); ob.st = 'late'; obPaint(); return; }
  const t0 = Date.now(), B = ob;
  while (ob === B && B.st === 'taza' && !(Number(led()?.req) >= at)) { if (Date.now() - t0 > 180000) { B.st = 'late'; obPaint(); return; } await new Promise(r => setTimeout(r, 2000)); }
  if (ob === B && B.st === 'taza') obLoad();
}
async function obLoad() {
  const B = ob; if (!B) return;
  const P = C.parties().filter(p => !bankP(p) && pmRow(p).state === 'farq');
  B.st = 'load'; B.total = P.length; B.done = 0; B.rows = []; obPaint();
  let k = 0;
  const work = async () => { while (k < P.length && ob === B) { const p = P[k++]; let doc = null; try { doc = await C.getLines(p.id); } catch {} B.done++;
    if (doc) { const D = pmDiff(p, doc), of = ofOf(D); if (Math.abs(of) > TOL) B.rows.push({ p, of, app: D.pre.app + D.opening, pos: D.pre.pos }); }
    if (B.done % 3 === 0) obPaint(); } };
  await Promise.all([work(), work(), work(), work()]);
  if (ob !== B) return;
  B.rows.sort((a, b) => Math.abs(b.of) - Math.abs(a.of));
  B.sel = new Set(); B.st = 'ready'; obPaint();   // v2.0: koi khud ☑ nahi — malik chune
}
async function obSend(dir) {
  const B = ob; if (!B || B.st !== 'ready') return;
  const sel = B.rows.filter(r => B.sel.has(r.p.id) && !B.sent.has(r.p.id)); if (!sel.length) return;
  if (!ofixAsk(sel.map(r => ({ name: r.p.name, of: r.of })), dir)) return;
  for (const r of sel) {
    try { const jid = await C.addJob({ partyId: r.p.id, dir, ids: ['@opening'], n: 1, amt: r.of }); const s = { jid, job: { status: 'new' }, stop: null }; B.sent.set(r.p.id, s); B.sel.delete(r.p.id);
      if (C.listenJobs && B.sent.size <= 80) s.stop = C.listenJobs(r.p.id, L => { const j = (L || []).find(x => x.id === jid); if (j) { s.job = j; obPaint(); } }); }
    catch (err) { C.notice(r.p.name + ': ' + (err?.message || err)); }
  }
  C.notice('⏳ ' + B.sent.size + ' khaton ka hukum shop PC ko — 1–5 min'); obPaint();
}
// ---------- ↩ OPENING THEEK KI JAANCH (v2.0, app v2.147.3) — malik (HBL: "App ko POS jaisa" ne ghalat "Sabqa baqaya farq theek" Rs 771,134 banaya):
//   "abhi history se khata disturb ho gaya · sahi karna hai · jo bhi ho meri ijazat ke bina na ho". Har '@opening' job (milanJobs ids array-contains) ki line:
//   khata · 📱 app / 🖥 POS · raqam · kab · ABHI ka farq vs WAPAS karne par farq (POS ledger se — app entry / JV ka asar) → ✓ sahi / ⚠ farq barha.
//   Malik ka chip "↩ Wapas" (ya "↩ Sab ⚠ wale") → milanJob {dir, ids:['@undo-opening', job]} → PC hata-ta hai (app entry 🗑 / POS JV delete). Khud kuch nahi. AI nahi.
let ou = null;
const ouPre = id => 'openfix-app-' + String(id).replace(/[^\w-]/g, '').slice(0, 40) + '-';
function ouRow(j) {
  const p = C.parties().find(x => x.id === j.partyId) || { id: j.partyId, name: j.partyId }, r = pmRow(p), L = Array.isArray(j.log) ? j.log.map(String) : [];
  let eff = null, amt = 0, gone = false, entry = null;
  if (j.dir === 'app') {
    const t = Number(j.doneAt) || Number(j.at) || 0, pre = ouPre(j.partyId);
    entry = (j.fix && j.fix.id && C.entries().find(e => e.id === j.fix.id)) || C.entries().filter(e => String(e.id).startsWith(pre) && !e.deleted && Math.abs((Number(e.createdAt) || 0) - t) < 30 * 60000).sort((a, b) => Math.abs((Number(a.createdAt) || 0) - t) - Math.abs((Number(b.createdAt) || 0) - t))[0] || null;
    if (!entry || entry.deleted) gone = true; else { eff = appAmt(entry); amt = Number(entry.amount) || 0; }
  } else {
    let jv = j.fix && Number.isFinite(Number(j.fix.amt)) ? Number(j.fix.amt) : null;
    if (jv == null) { const m = L.map(x => x.match(/Rs ([\d,]+(?:\.\d+)?) (lena|dena) \((Dr|Cr)\)/)).find(Boolean); if (m) jv = Math.round(Number(m[1].replace(/,/g, '')) * 100) * (m[2] === 'lena' ? 1 : -1); }
    if (jv != null) { eff = -jv; amt = Math.abs(jv); }
  }
  const now = r.state === 'none' ? null : r.farq, without = now == null || eff == null ? null : now - eff;
  const bad = !j.undoneAt && !gone && now != null && without != null && Math.abs(now) > TOL && Math.abs(without) + TOL < Math.abs(now);
  return { j, p, r, eff, amt, gone, entry, now, without, bad };
}
const ouSt = x => x.j.undoneAt ? '↩ wapas ho chuka' : x.gone ? '🗑 app entry pehle hi hati hui' : x.now == null ? 'POS ka baqaya nahi aaya' : Math.abs(x.now) <= TOL ? '✓ khata POS se barabar — yeh theek sahi tha'
  : x.bad ? `⚠ is se farq BARHA — abhi farq ${money(x.now)}, wapas karne par ${money(x.without)}` : `• abhi farq ${money(x.now)}${x.without != null ? ` · wapas karne par ${money(x.without)}` : ''}`;
function ouHTML() {
  const O = ou; if (!O) return '';
  const head = `<button type="button" class="pm-back" data-pm-back="1">‹ POS milan</button><div class="pm-sum"><b>↩ Opening theek ki jaanch</b><small>"📜 Opening farq" se jo jo bana (📱 app entry / 🖥 POS JV) — ⚠ wale ne khata bigaara. Aap ke "↩ Wapas" ke baghair kuch nahi hota.</small></div>`;
  if (O.st === 'load') return `<div class="bc-root pm-droot pm-broot" data-pm-ou="1">${head}<div class="pm-fixst wait"><b>⏳ Opening theek ki list aa rahi hai…</b></div></div>`;
  if (O.st === 'err') return `<div class="bc-root pm-droot pm-broot" data-pm-ou="1">${head}<div class="pm-fixst warn"><b>⚠ List nahi aayi: ${esc(O.err || '')}</b></div></div>`;
  const R = O.jobs.map(ouRow), bad = R.filter(x => x.bad && !O.sent.has(x.j.id));
  const line = x => { const s = O.sent.get(x.j.id), sj = s ? s.job : null, ss = !s ? '' : sj.status !== 'done' ? '⏳ PC wapas kar raha…' : sj.fail ? '✕ ' + String((sj.log || [])[0] || 'nahi hua') : sj.skip ? '↩ ' + String((sj.log || [])[0] || 'pehle se') : '✅ ' + String((sj.log || [])[0] || 'wapas ho gaya');
    const when = new Date(Number(x.j.doneAt) || Number(x.j.at) || 0).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const can = !x.j.undoneAt && !x.gone && !s && C.owner();
    return `<div class="pm-bk ou-r${x.bad ? ' warn' : ''}${x.j.undoneAt || x.gone ? ' sent' : ''}"><span class="pm-bn"><b>${esc(x.p.name)}</b><small>${x.j.dir === 'app' ? '📱 App ka sabqa POS jaisa' : '🖥 POS mein JV'}${x.amt ? ' · ' + money(x.amt) : ''} · ${esc(when)}</small><small class="ou-st">${esc(ss || ouSt(x))}</small></span>${can ? `<button type="button" class="pm-bo ou-go" data-pm-ougo="${esc(x.j.id)}">↩ Wapas</button>` : ''}<button type="button" class="pm-bo" data-pm-diff="${esc(x.p.id)}">🔍</button></div>`; };
  const body = R.length ? `<div class="pm-bsum"><b>${num(R.length)} opening theek · ⚠ ${num(R.filter(x => x.bad).length)} ne farq barhaya</b>${bad.length ? `<span><button type="button" class="ou-all" data-pm-ouall="1">↩ Sab ⚠ wale wapas (${num(bad.length)})</button></span>` : ''}</div><div class="pm-blist">${R.map(line).join('')}</div>`
    : '<div class="pm-fixst ok"><b>✓ Abhi tak koi opening theek nahi bana</b></div>';
  return `<div class="bc-root pm-droot pm-broot" data-pm-ou="1">${head}${body}<p class="stat-note">Farq = POS ledger ka abhi ka baqaya. "Wapas karne par" = woh app entry / POS JV hata dein to khata kitna farq dikhayega. Shop PC 1–2 min mein karta hai.</p></div>`;
}
const num = n => (Number(n) || 0).toLocaleString('en-PK');
function ouPaint() { const r = document.querySelector('#dialogBody [data-pm-ou]:not(button)'); if (r) r.outerHTML = ouHTML(); }
async function ouStart() {
  if (!C.owner()) { C.notice('Sirf malik'); return; }
  ou = { st: 'load', jobs: [], sent: new Map() }; $('dialogBody').innerHTML = ouHTML();
  try { const L = C.listOpenJobs ? await C.listOpenJobs() : []; if (!ou) return; ou.jobs = (L || []).filter(j => Array.isArray(j.ids) && j.ids[0] === '@opening' && j.status === 'done' && (Number(j.done) || 0) > 0).sort((a, b) => (Number(b.doneAt) || 0) - (Number(a.doneAt) || 0)); ou.st = 'ready'; }
  catch (err) { if (ou) { ou.st = 'err'; ou.err = err?.message || String(err); } }
  ouPaint();
}
async function ouSend(ids) {
  const O = ou; if (!O || O.st !== 'ready') return;
  const R = O.jobs.map(ouRow).filter(x => ids.includes(x.j.id) && !x.j.undoneAt && !x.gone && !O.sent.has(x.j.id)); if (!R.length) return;
  if (!confirm(`↩ ${R.length} opening theek WAPAS:\n\n${R.slice(0, 15).map(x => `• ${x.p.name} — ${x.j.dir === 'app' ? 'app entry 🗑' : 'POS JV hatao'}${x.amt ? ' ' + money(x.amt) : ''}`).join('\n')}${R.length > 15 ? '\n…' : ''}\n\nShop PC 1–2 min mein karega. Theek?`)) return;
  for (const x of R) {
    try { const jid = await C.addJob({ partyId: x.j.partyId, dir: x.j.dir === 'app' ? 'app' : 'pos', ids: ['@undo-opening', x.j.id], n: 1, amt: 0 }); const s = { jid, job: { status: 'new' }, stop: null }; O.sent.set(x.j.id, s);
      if (C.listenJobs && O.sent.size <= 80) s.stop = C.listenJobs(x.j.partyId, L => { const jj = (L || []).find(y => y.id === jid); if (jj) { s.job = jj; ouPaint(); } }); }
    catch (err) { C.notice(x.p.name + ': ' + (err?.message || err)); }
  }
  C.notice('⏳ ' + R.length + ' wapas ka hukum shop PC ko — 1–2 min'); ouPaint();
}
function ouClose() { if (ou?.sent) for (const s of ou.sent.values()) { try { s.stop && s.stop(); } catch {} } ou = null; }
function obClose() { if (ob?.sent) for (const s of ob.sent.values()) { try { s.stop && s.stop(); } catch {} } ob = null; }
export function pmOpen() {
  if (!C) return;
  if (!C.can('kh.posmilan')) { C.notice('⚖️ POS milan ki ijazat nahi — malik se kahein'); return; }
  bulk = null; obClose(); ouClose();
  C.modal('⚖️ POS milan', pmHTML(), true);
}
export function pmPaint() {
  if (document.querySelector('#dialogBody :is([data-pm-bulk],[data-pm-ob],[data-pm-ou]):not(button)')) return;   // v2.133.7: sab khate screen khud paint karti hai · v1.9 opening farq bhi
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
  const nA = D.posOnly.filter(x => x.code && x.dt !== 'PO').length, nP = D.appOnly.filter(a => bulkElig(a.e)).length;
  const chips = busy ? '' : `<div class="pm-fix"><small>Barabar karo:</small>${nA ? `<button type="button" data-pm-fix="app">📱 App ko POS jaisa <i>${nA}</i></button>` : ''}${nP ? `<button type="button" data-pm-fix="pos">🖥 POS ko app jaisa <i>${nP}</i></button>` : ''}${!nA && !nP ? '<span class="pm-fixok">✓ voucher wali koi entry baqi nahi (purchase bill sync.js se)' + (D.appOnly.some(a => /^pos-\d+$/.test(String(a.e.id)) && jzOf(a.e)) ? ' — bill ki 🔎 wajah neeche' : '') + '</span>' : ''}</div>`;
  const jt = j && j.status === 'done' ? (j.by === 'auto' ? '🤖 PC ne khud: ' : '') + ([j.done ? `✅ ${j.done} ban gayi` : '', j.skip ? `↩ ${j.skip} pehle se thi (kuch nahi kiya)` : '', j.fail ? `✕ ${j.fail} nahi bani` : ''].filter(Boolean).join(' · ') || '✓ kuch karna nahi para') : '';
  const stale = j && j.status === 'done' && (Number(led()?.at) || 0) < (Number(j.doneAt) || 0);
  const st = j ? `<div class="pm-fixst ${j.status === 'done' ? (j.fail ? 'warn' : 'ok') : 'wait'}"><b>${j.status === 'done' ? jt : (Array.isArray(j.ids) && j.ids[0] === '@opening' ? '⏳ Shop PC opening barabar kar raha hai — ' + (j.dir === 'app' ? 'app ka sabqa POS jaisa' : 'POS mein JV') + ' (1–2 min)' : '⏳ Shop PC bana raha hai — ' + (j.dir === 'app' ? 'app mein ' : 'POS mein ') + (j.n || '') + ' entries (1–2 min)')}</b>${j.status === 'done' ? `<small>${stale ? '⏳ POS ka naya baqaya aa raha hai (1 min) — screen khud taza hogi' : '✓ Neeche ka hisaab naye POS data se hai'}</small>` : ''}${Array.isArray(j.log) && j.log.length ? `<details><summary>tafseel (${j.log.length})</summary>${j.log.map(x => `<div>${esc(x)}</div>`).join('')}</details>` : ''}</div>` : '';
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
  const L = dir === 'app' ? D.posOnly.filter(x => x.code && x.dt !== 'PO') : D.appOnly.filter(a => bulkElig(a.e));   // purchase bill / cash purchase voucher nahi (POS mein bill hota hai) · v1.6 transfer bhi
  if (!L.length) { C.notice(dir === 'app' ? 'Sirf purchase bill wali lines hain — wo sync.js se aati hain' : 'In entries ka voucher nahi banta (purchase bill / cash purchase)'); return; }
  const ids = dir === 'app' ? L.map(x => x.code).filter(Boolean) : L.map(a => a.e.id);
  const amt = L.reduce((n, x) => n + Math.abs(dir === 'app' ? x.amt : x.amt), 0);
  const lines = L.slice(0, 12).map(x => dir === 'app' ? `${dTxt(x.d)} · ${x.code} · ${money(x.amt)} ${sideTxt(x.amt)}` : `${dTxt(x.e.date)} · ${(KIND[x.e.kind] || x.e.kind).replace(/^\S+\s/, '')} · ${money(x.amt)} ${sideTxt(x.amt)}`).join('\n');
  const msg = dir === 'app'
    ? `📱 APP KO POS JAISA — ${p.name}\n${L.length} POS vouchers app ke khate mein ENTRY ban jayengi (usi tareekh, raqam, POS number ke saath):\n\n${lines}${L.length > 12 ? '\n…' : ''}\n\nKul ${money(amt)}. Shop PC 1–2 min mein likhega. Theek?`
    : `🖥 POS KO APP JAISA — ${p.name}\n${L.length} app entries POS mein VOUCHER ban jayengi (Payment → CPV, Wasooli → CRV, Saman liya/diya · ⇄ Transfer → JV):\n\n${lines}${L.length > 12 ? '\n…' : ''}\n\nKul ${money(amt)}. Shop PC 1–2 min mein banayega. Theek?`;
  if (!confirm(msg)) return;
  try { await C.addJob({ partyId: p.id, dir, ids, n: ids.length, amt }); C.notice('⏳ Shop PC ko kaha — 1–2 min'); jobs = [{ status: 'new', dir, n: ids.length, at: Date.now() }, ...jobs]; const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r) r.outerHTML = diffHTML(p, doc); }
  catch (err) { C.notice('Nahi gaya: ' + (err?.message || err) + (/permission/i.test(String(err?.message)) ? ' — rules 2.77 abhi nahi lagi' : '')); }
}
// ---------- ✕ ENTRY-WAR "POS mein nahi" (v1.6, app v2.134.0) — malik: Sahid iqbal dhal "customer ke saath bhi, yahan bhi sahi honi chahiye" ----------
// Farq wale khate ki POS lines (1 read, ledger 'at' badle to dobara) → pmDiff appOnly → khate ke card par "✕ POS mein nahi" + malik ka "📤 POS mein bhejo"
// (EK entry ki milanJob dir pos — wahi raasta). Job ka jawab (listenJobs) card par: ⏳ ban raha · ✅ · ↩ pehle se · ✕ wajah.
const miss = new Map();   // pid -> { at, ids: Set|null, busy }
const sent = new Map();   // entry id -> { at, jid, pid }
const cardJobs = new Map();   // pid -> { stop, L }
const rowMemo = new Map();
const typing = () => { const a = document.activeElement; return !!(a && a.matches && a.matches('input,textarea,select')); };
function rerender() { if (typing()) return; try { C.rerender && C.rerender(); } catch {} }
function missIds(p) {
  if (!C || !p || p.bank || !C.can('kh.posmilan') || !led() || !C.getLines) return null;
  const now = Date.now(), lat = Number(led()?.at) || 0; let stt = rowMemo.get(p.id); if (!stt || now - stt.t > 1500 || stt.at !== lat) { stt = { t: now, at: lat, s: pmRow(p).state }; rowMemo.set(p.id, stt); }   // ek render mein har card ke liye baqaya dobara nahi
  if (stt.s !== 'farq') { if (miss.get(p.id)?.ids?.size) { miss.delete(p.id); setTimeout(rerender, 0); } return null; }
  const at = Number(led()?.at) || 0, c = miss.get(p.id);
  if (c && (c.at === at || c.busy)) return c.ids;
  miss.set(p.id, { at, ids: c?.ids || null, busy: true });
  C.getLines(p.id).then(doc => {
    const ids = doc ? new Set(pmDiff(p, doc).appOnly.map(a => a.e.id)) : new Set();
    const old = c?.ids; miss.set(p.id, { at, ids, busy: false });
    if (!old || old.size !== ids.size || [...ids].some(x => !old.has(x))) rerender();
  }).catch(() => miss.set(p.id, { at, ids: c?.ids || new Set(), busy: false }));
  return c?.ids || null;
}
export function pmMissKick(p) { if (p) missIds(p); }
function cardWatch(pid) {
  if (cardJobs.has(pid) || !C.listenJobs) return;
  const w = { stop: null, L: [] }; cardJobs.set(pid, w);
  w.stop = C.listenJobs(pid, L => { w.L = L || []; rerender(); });
}
function jobOf(id) { const s = sent.get(id); if (!s) return null; const w = cardJobs.get(s.pid); return (w && w.L.find(j => j.id === s.jid)) || { status: 'new' }; }
export function pmEntryState(e) {   // '' | 'miss' | 'wait' | 'fail' | 'skip' (+ msg)
  if (!C || !e || e.deleted || String(e.posCode || '').trim()) return null;
  const p = C.parties().find(x => x.id === e.partyId); if (!p) return null;
  const s = sent.get(e.id);
  if (s) {
    const j = jobOf(e.id);
    if (j.status !== 'done') return Date.now() - s.at < 10 * 60000 ? { st: 'wait' } : { st: 'fail', msg: 'Shop PC ne 10 min mein jawab nahi diya — PC / internet check karein' };
    const msg = (Array.isArray(j.log) && j.log.find(x => String(x).startsWith(e.id + ':'))) || (Array.isArray(j.log) && j.log[0]) || '';
    const clean = String(msg).replace(e.id + ':', '').trim();
    if (j.fail) return { st: 'fail', msg: clean || 'nahi bana' };
    if (j.skip) return { st: 'skip', msg: clean || 'pehle se POS mein' };
    return { st: 'wait', msg: 'ban gaya — voucher no. aa raha hai' };
  }
  const ids = missIds(p);
  return ids && ids.has(e.id) && bulkElig(e) ? { st: 'miss' } : null;
}
export function pmEntryTag(e) { const z = /^pos-\d+$/.test(String(e?.id || '')) ? jzOf(e) : null; if (z) return '<b class="pm-et miss">🔎 POS farq — wajah</b>'; const r = pmEntryState(e); if (!r) return ''; return r.st === 'wait' ? '<b class="pm-et wait">⏳ POS mein ban raha</b>' : r.st === 'skip' ? '<b class="pm-et skip">↩ POS mein pehle se</b>' : '<b class="pm-et miss">✕ POS mein nahi</b>'; }
export function pmEntryHTML(e) {
  const z = /^pos-\d+$/.test(String(e?.id || '')) ? jzOf(e) : null; if (z) return jzHTML(e, z);
  const r = pmEntryState(e); if (!r) return '';
  const btn = C.owner() && (r.st === 'miss' || r.st === 'fail') ? `<button type="button" class="pm-send" data-pm-send="${esc(e.id)}">📤 POS mein bhejo</button>` : '';
  const t = r.st === 'wait' ? `⏳ 🖥 Shop PC POS mein voucher bana raha hai…${r.msg ? ' (' + esc(r.msg) + ')' : ' (1–2 min)'}`
    : r.st === 'skip' ? `↩ 🖥 ${esc(r.msg)}`
    : r.st === 'fail' ? `✕ 🖥 POS mein nahi bana: ${esc(r.msg)}`
    : `✕ 🖥 POS mein nahi — is ki wajah se khate ka POS farq${C.owner() ? '' : ' (malik POS mein bhej sakta hai)'}`;
  return `<div class="pm-ent ${r.st}"><small>${t}</small>${btn}</div>`;
}
async function sendOne(id) {
  const e = C.entries().find(x => x.id === id); if (!e) return;
  const p = C.parties().find(x => x.id === e.partyId); if (!p || !C.owner()) return;
  const lab = e.transferId ? '⇄ Transfer' : (KIND[e.kind] || e.kind).replace(/^\S+\s/, '');
  const amt = Math.abs(appAmt(e) || Number(e.amount) || 0);
  if (!confirm(`🖥 POS MEIN BHEJO — ${p.name}\n${dTxt(e.date)} · ${lab} · ${money(amt)}${e.note ? '\n' + String(e.note).slice(0, 80) : ''}\n\nShop PC POS mein voucher banayega (Payment → CPV, Wasooli → CRV, Saman liya / Transfer → JV). POS mein pehle se ho to dobara NAHI banega. Theek?`)) return;
  try {
    const jid = await C.addJob({ partyId: p.id, dir: 'pos', ids: [id], n: 1, amt });
    sent.set(id, { at: Date.now(), jid, pid: p.id }); cardWatch(p.id);
    C.notice('⏳ Shop PC ko kaha — 1–2 min'); rerender();
  } catch (err) { C.notice('Nahi gaya: ' + (err?.message || err)); }
}
export function pmDiff(p, doc) {   // {appOnly:[], posOnly:[], diff:[], pre:{app,pos}, sum, farq, ok}
  let L = []; try { L = JSON.parse(doc?.j || '[]'); } catch {}
  const pos = L.filter(x => Number(x[7]) !== 3).map((x, i) => ({ i, d: x[0], code: x[1], dt: x[2], no: String(x[3] || ''), amt: (Number(x[4]) || 0) - (Number(x[5]) || 0), desc: x[6] || '', used: false }));
  const E = C.entries().filter(e => e.partyId === p.id && !e.deleted && !skipsBalance(e)).map(e => ({ e, amt: appAmt(e), used: false }));
  const appOnly = [], posOnly = [], diff = [];
  let preApp = 0; const preIds = [];
  for (const a of E) { if (/^pos-opening-/.test(String(a.e.id)) || /sabqa baqaya/i.test(String(a.e.note || '')) || (/^\d{4}-\d{2}-\d{2}$/.test(String(a.e.date || '')) && String(a.e.date) < PRE_FROM)) { preApp += a.amt; a.used = true; preIds.push(a); } }   // v2.0: 15-Sep se pehle ki SAB app entries (POS pre jaisa) — pehle sirf sabqa = HBL ghalti
  const pos0 = Number(doc?.pre) || 0; let prePos = pos0; const openL = [];
  for (const x of pos) if (OPEN_RX.test(x.desc)) { x.used = true; prePos += x.amt; openL.push(x); }   // v1.7: POS ka 'Opening balance (app)' / shuru ka baqaya JV = opening ke khane mein (app mein dobara nahi)
  const take = (a, x) => { a.used = true; x.used = true; if (Math.abs(a.amt - x.amt) > TOL) diff.push({ a: a.e, x, da: a.amt, dx: x.amt }); };
  for (const a of E) { if (a.used) continue; const c = String(a.e.posCode || '').trim().toUpperCase(); if (!c) continue; const x = pos.find(y => !y.used && y.code.toUpperCase() === c); if (x) take(a, x); }
  for (const a of E) { if (a.used) continue; const m = String(a.e.id).match(/^pos-(\d+)$/); if (!m) continue; const x = pos.find(y => !y.used && y.dt === 'PO' && String(Number(y.no)) === String(Number(m[1]))); if (x) take(a, x); }
  for (const a of E) { if (a.used || !a.amt) continue; const cands = pos.filter(y => !y.used && Math.abs(y.amt - a.amt) <= TOL && dayDiff(y.d, a.e.date || '') <= 3).sort((u, v) => dayDiff(u.d, a.e.date) - dayDiff(v.d, a.e.date)); if (cands[0]) take(a, cands[0]); }
  for (const a of E) if (!a.used && a.amt) appOnly.push({ e: a.e, amt: a.amt });
  for (const x of pos) if (!x.used && x.amt) posOnly.push(x);
  const opening = Number(p.opening) || 0;
  const sum = appOnly.reduce((n, a) => n + a.amt, 0) - posOnly.reduce((n, x) => n + x.amt, 0) + diff.reduce((n, d) => n + (d.da - d.dx), 0) + (preApp - prePos) + opening;
  const farq = pmRow(p).farq;
  return { appOnly, posOnly, diff, pre: { app: preApp, pos: prePos, ids: preIds, open: openL, pos0 }, opening, sum, farq, ok: Math.abs(sum - farq) <= TOL };
}
const amtTxt = v => `<b class="${v > 0 ? 'l' : 'd'}">${money(v)} ${sideTxt(v)}</b>`;
function diffHTML(p, doc) {
  const r = pmRow(p), D = pmDiff(p, doc), at = doc?.at;
  const appLine = (e, amt) => { const z = /^pos-\d+$/.test(String(e.id)) ? jzOf(e) : null; return `<div class="pm-e${z ? ' pm-ejz' : ''}"><span class="pm-ed">${dTxt(e.date)}</span><span class="pm-et"><b>${esc(KIND[e.kind] || e.kind)}</b><small>${esc(e.note || '')}${e.posCode ? ' · ' + esc(e.posCode) : ''}</small></span>${amtTxt(amt)}${z ? jzHTML(e, z) : ''}</div>`; };
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
    ${(() => { const aO = D.pre.app + D.opening, of = aO - D.pre.pos; if (Math.abs(of) <= TOL && !D.opening && !D.pre.open.length) return '';
      const st = Math.abs(of) <= TOL ? '<p class="pm-okl">✓ Opening barabar</p>' : `<p class="pm-badl">⚠ Opening farq ${money(of)} — PC khud kuch nahi karta (malik: "meri ijazat ke bina na ho"). ${bankP(p) ? 'Bank khata — yahan se opening nahi.' : 'Neeche chip se aap faisla karein.'}</p>`;
      return sec('📜 Sabqa baqaya (15-Sep-2026 se pehle) / opening', 'o', '', `<div class="pm-e"><span class="pm-ed"></span><span class="pm-et"><b>App: 15-Sep se pehle${D.opening ? ' + opening ' + money(D.opening) : ''}</b><small>sabqa baqaya + is se pehle ki saari app entries</small></span>${amtTxt(aO)}</div><div class="pm-e"><span class="pm-ed"></span><span class="pm-et"><b>POS: 15-Sep se pehle</b></span>${amtTxt(D.pre.pos0)}</div>${D.pre.open.map(x => `<div class="pm-e"><span class="pm-ed">${dTxt(x.d)}</span><span class="pm-et"><b>POS: ${esc(x.code)} · opening voucher</b><small>${esc(x.desc)}</small></span>${amtTxt(x.amt)}</div>`).join('')}${st}${Math.abs(of) > TOL ? ofixHTML(p, of) : ''}`); })()}
    <p class="stat-note">Milan: voucher number (CPV/CRV/JV) · POS purchase bill number · warna raqam + tareekh (±3 din). Cancel vouchers shamil nahi. PC har 15 min taza karta hai.</p>
  </div>`;
}
async function jzGo(b) {
  const id = b.dataset.pmCash || b.dataset.pmPost || b.dataset.pmBill, e = C.entries().find(x => x.id === id); if (!e) return;
  if (b.dataset.pmBill) { try { $('dialog')?.close(); } catch {} setTimeout(() => C.openBill && C.openBill(id), 60); return; }
  if (!C.owner()) return;
  if (b.dataset.pmCash) {
    if (!confirm(`💵 ${String(e.note || '').replace(/^POS Purchase\s*/i, 'Bill ')} · ${money(e.amount)}\nPOS mein yeh CASH bill hai — app mein "cash ada" likh dein? (POS mein kuch nahi badlega, galla / Daily mein nahi)`)) return;
    b.disabled = true; b.textContent = '⏳ likh raha…';
    try { await C.saveCash(e); jzDone.add(id); C.notice('✅ Cash ada likh diya — khata POS jaisa'); rerender(); const r = document.querySelector('#dialogBody [data-pm-droot]'); if (r && jobParty && jobDoc) r.outerHTML = diffHTML(jobParty, jobDoc); }
    catch (err) { b.disabled = false; b.textContent = '💵 Cash ada likho'; C.notice('Nahi likha: ' + (err?.message || err)); }
    return;
  }
  if (b.dataset.pmPost) { b.disabled = true; b.textContent = '⏳ PC ko bheja…'; try { await C.postBill(e); jzDone.add(id); } catch (err) { b.disabled = false; b.textContent = '📌 Post karo'; C.notice('Nahi gaya: ' + (err?.message || err)); } }
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
document.addEventListener('change', e => { const t = e.target; if (t?.dataset?.pmObsel && ob) { if (t.checked) ob.sel.add(t.dataset.pmObsel); else ob.sel.delete(t.dataset.pmObsel); obPaint(); return; } if (!t?.dataset?.pmBsel || !bulk) return; if (t.checked) bulk.sel.add(t.dataset.pmBsel); else bulk.sel.delete(t.dataset.pmBsel); bulkPaint(); });
document.addEventListener('click', e => {
  if (!C) return;
  const b = e.target.closest?.('[data-pm-ou],[data-pm-ougo],[data-pm-ouall],[data-pm-ofix],[data-pm-ob],[data-pm-obgo],[data-pm-oball],[data-pm-obnone],[data-pm-cash],[data-pm-post],[data-pm-bill],[data-pm-send],[data-pm-bulk],[data-pm-bulkgo],[data-pm-ball],[data-pm-bsafe],[data-pm-bnone],[data-pm-bsend],[data-pm-taza],[data-pm-fix],[data-pm-f],[data-pm-open],[data-pm-diff],[data-pm-back],[data-pm-tog]'); if (!b) return;
  if (b.dataset.pmSend) { e.stopPropagation(); e.preventDefault(); sendOne(b.dataset.pmSend); return; }
  if (b.dataset.pmOfix) { e.stopPropagation(); ofixGo(b.dataset.pmOfix); return; }
  if (b.dataset.pmOu === 'go') { e.stopPropagation(); ouStart(); return; }
  if (b.dataset.pmOugo) { e.stopPropagation(); ouSend([b.dataset.pmOugo]); return; }
  if (b.dataset.pmOuall != null && ou) { ouSend(ou.jobs.map(ouRow).filter(x => x.bad).map(x => x.j.id)); return; }
  if (b.dataset.pmOb === 'go') { e.stopPropagation(); obStart(); return; }
  if (b.dataset.pmObgo === 'old') { if (ob) obLoad(); return; }
  if (b.dataset.pmObgo) { obSend(b.dataset.pmObgo); return; }
  if (b.dataset.pmOball != null && ob) { ob.sel = new Set(ob.rows.filter(r => !ob.sent.has(r.p.id)).map(r => r.p.id)); obPaint(); return; }
  if (b.dataset.pmObnone != null && ob) { ob.sel = new Set(); obPaint(); return; }
  if (b.dataset.pmCash || b.dataset.pmPost || b.dataset.pmBill) { e.stopPropagation(); e.preventDefault(); jzGo(b); return; }
  if (b.dataset.pmFix) { e.stopPropagation(); fixGo(b.dataset.pmFix); return; }
  if (b.dataset.pmTaza) { e.stopPropagation(); tazaGo(); return; }
  if (b.dataset.pmBulk === 'go') { e.stopPropagation(); bulkStart(); return; }
  if (b.dataset.pmBulkgo === 'old') { if (bulk) bulkLoad(); return; }
  if (b.dataset.pmBall != null && bulk) { bulk.sel = new Set(bulk.rows.map(r => r.p.id)); bulkPaint(); return; }
  if (b.dataset.pmBsafe != null && bulk) { bulk.sel = new Set(bulk.rows.filter(r => r.safe).map(r => r.p.id)); bulkPaint(); return; }
  if (b.dataset.pmBnone != null && bulk) { bulk.sel = new Set(); bulkPaint(); return; }
  if (b.dataset.pmBsend != null) { bulkSend(); return; }
  if (b.dataset.pmTog) { pmOpenLine = pmOpenLine === b.dataset.pmTog ? '' : b.dataset.pmTog; const w = document.querySelector('#summary [data-pm-line]'); if (w) { const p = C.parties().find(x => x.id === b.dataset.pmTog); if (p) w.innerHTML = pmLineHTML(p); } return; }
  if (b.dataset.pmDiff) { e.stopPropagation(); e.preventDefault(); pmDiffOpen(b.dataset.pmDiff); return; }
  if (b.dataset.pmBack) { pmOpen(); return; }
  if (b.dataset.pmF) { st.f = b.dataset.pmF; pmPaint(); return; }
  if (b.dataset.pmOpen) { const id = b.dataset.pmOpen; try { $('close')?.click(); } catch {} try { $('dialog')?.close(); } catch {} setTimeout(() => C.openAccount(id), 60); }
});
