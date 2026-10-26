// pos-milan.js — v1.0 (2026-10-26, app v2.124.0) ⚖️ POS MILAN — har khate ka app baqaya vs POS ledger baqaya.
// Malik: "jitne bhi khate hain, POS ka ledger aur humara khata same aa raha hai — sab khaton ke liye check karna hai; har khate ki screen par bhi POS baqaya".
// Data: blueAccess/posLedger {m:{appPartyId: paisa (lena +, dena −)}, at, n} — PC pos-khata-sync har 15 min. Yahan sirf UI. AI nahi.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + (Math.abs(Number(n) || 0) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
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
export function pmLineHTML(p) {   // khate ki screen ke upar
  if (!C || !p || p.bank || !C.can('kh.posmilan') || !led()) return '';
  const r = pmRow(p);
  if (r.state === 'none') return `<div class="pm-line none">🖥 POS mein yeh khata nahi juda</div>`;
  if (r.state === 'ok') return `<div class="pm-line ok">🖥 POS baqaya ${money(r.pos)} ${sideTxt(r.pos)} · ✓ barabar</div>`;
  return `<div class="pm-line bad">🖥 POS baqaya <b>${money(r.pos)} ${sideTxt(r.pos)}</b> · ⚠ farq <b>${money(r.farq)}</b> (app ${money(r.app)} ${sideTxt(r.app)})</div>`;
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
      <span class="pm-d">${r.state === 'none' ? '<em class="n">POS mein nahi</em>' : r.state === 'ok' ? '<em class="o">✓</em>' : `<em class="b">⚠ ${money(r.farq)}</em>`}</span></button>`).join('') : `<div class="empty"><strong>${st.f === 'farq' ? 'Koi farq nahi ✓' : 'Kuch nahi'}</strong></div>`}</div>
    <p class="stat-note">Farq = app ka baqaya − POS ka ledger baqaya. Rs 1 tak farq = theek (POS ki rounding). Khate par tap = wo khata khule. PC har 15 min POS se taza karta hai.</p>
  </div>`;
}
export function pmOpen() {
  if (!C) return;
  if (!C.can('kh.posmilan')) { C.notice('⚖️ POS milan ki ijazat nahi — malik se kahein'); return; }
  C.modal('⚖️ POS milan', pmHTML(), true);
}
export function pmPaint() {
  const r = document.querySelector('#dialogBody [data-pm-root]'); if (!r || !$('dialog')?.open) return;
  const q = r.querySelector('[data-pm-q]'), foc = document.activeElement === q;
  r.outerHTML = pmHTML();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-pm-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
}
document.addEventListener('input', e => { const t = e.target; if (!t?.dataset?.pmQ) return; st.q = t.value; pmPaint(); });
document.addEventListener('click', e => {
  if (!C) return;
  const b = e.target.closest?.('[data-pm-f],[data-pm-open]'); if (!b) return;
  if (b.dataset.pmF) { st.f = b.dataset.pmF; pmPaint(); return; }
  if (b.dataset.pmOpen) { const id = b.dataset.pmOpen; try { $('close')?.click(); } catch {} try { $('dialog')?.close(); } catch {} setTimeout(() => C.openAccount(id), 60); }
});
