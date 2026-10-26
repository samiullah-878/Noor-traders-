// bill-check.js — v1.1 (2026-10-27, app v2.128.0: bcGo export + ntBcNav ‹ › list) · v1.0 (2026-10-26, app v2.122.0) ✅ BILL CHECK — POS ke purchase bills ki check-list.
// Malik: "bill check karne ka checkbox chahiye aur ek screen jis mein POS ka bill check aur jo check nahi hua wo bhi aaye —
//   aaj / 7 din / 15 din / mahina ke jo check nahi hue saamne lao; bill check + bill post ek hi click."
// Data: billChecks/<pos-id> {at, by, n, billNo, date, pid, amt, ts} (rules 2.73) — app.js listen karta hai, yahan sirf UI. AI nahi.
// Screen: full dialog — ☰ tabs (⋮) Baqi / Check hue · din (Aaj · 7 din · 15 din · Mahina · Sab) · search; har bill: ☐ tick + "✓ Check + 📌 Post".
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMF = new Intl.NumberFormat('en-PK');
const money = n => 'Rs ' + NUMF.format(Math.round((Number(n) || 0) / 100));
const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const agoStr = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const DAYS = [['aaj', 'Aaj', 0], ['7', '7 din', 6], ['15', '15 din', 14], ['mah', 'Mahina', 29], ['sab', 'Sab', 3650]];
const LS = 'sam-bc-d';
let C = null;   // ctx (app.js se): entries, party, checks, can, owner, cloud, uid, name, notice, modal, openBill, post, isPosted, rerender
let st = { tab: 'baqi', d: (() => { try { return localStorage.getItem(LS) || '7'; } catch { return '7'; } })(), q: '', busy: new Set() };
export function bcSetup(ctx) { C = ctx; }
const bills = () => (C.entries() || []).filter(e => e && !e.deleted && e.purchase === true && e.kind === 'borrow' && /^pos-\d+$/.test(String(e.id)));
const billNo = e => String(e.note || '').replace(/^POS Purchase\s*/i, '').trim() || String(e.id).slice(4);
const chk = e => (C.checks() || {})[e.id] || null;
const since = () => agoStr((DAYS.find(x => x[0] === st.d) || DAYS[1])[2]);
export function bcCount(d = st.d) {   // chip / badge: itne din ke bill jo check nahi hue
  const s = agoStr((DAYS.find(x => x[0] === d) || DAYS[1])[2]);
  return bills().filter(e => String(e.date || '') >= s && !chk(e)).length;
}
function list() {
  const s = since(), q = st.q.trim().toLowerCase();
  return bills().filter(e => String(e.date || '') >= s && (st.tab === 'baqi' ? !chk(e) : !!chk(e)))
    .filter(e => !q || (C.party(e.partyId)?.name || '').toLowerCase().includes(q) || billNo(e).includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || billNo(b).localeCompare(billNo(a)));
}
const tm = t => t ? new Date(t).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
export function bcTickHTML(id, cls = '') {   // khate ke card / bill khirki ke liye ☐ Check
  if (!C || !C.can('pur.check')) return '';
  const e = bills().find(x => x.id === id); if (!e) return '';
  const c = chk(e), busy = st.busy.has(id);
  return `<label class="bc-tick ${c ? 'on' : ''} ${cls}" data-bc-tickbox="${esc(id)}" data-bc-cls="${esc(cls)}"><input type="checkbox" data-bc-tick="${esc(id)}"${c ? ' checked' : ''}${busy ? ' disabled' : ''}> ${c ? `✅ Check kiya · ${esc(c.n || '')} ${esc(tm(c.at))}` : '☐ Bill check kiya'}</label>`;
}
function rowHTML(e) {
  const p = C.party(e.partyId), c = chk(e), posted = C.isPosted(e), busy = st.busy.has(e.id), canPost = C.can('pur.post');
  return `<div class="bc-r${c ? ' done' : ''}${busy ? ' busy' : ''}" data-bc-row="${esc(e.id)}">
    <label class="bc-cb"><input type="checkbox" data-bc-tick="${esc(e.id)}"${c ? ' checked' : ''}${busy ? ' disabled' : ''}></label>
    <button type="button" class="bc-main" data-bc-open="${esc(e.id)}"><span class="bc-l1"><b>${esc(p?.name || 'Supplier')}</b><em>${money(e.amount)}</em></span><small>Bill ${esc(billNo(e))} · ${esc(e.date || '')} <i class="bc-st ${posted ? 'p' : 'o'}">${posted ? '📌 Posted' : 'Khula'}</i>${c ? `<i class="bc-who">✅ ${esc(c.n || '')} ${esc(tm(c.at))}</i>` : ''}</small></button>
    ${!c ? `<button type="button" class="bc-go" data-bc-go="${esc(e.id)}"${busy ? ' disabled' : ''}>${busy ? '⏳' : posted || !canPost ? '✓ Check' : '✓ Check<br>+ 📌 Post'}</button>` : `<button type="button" class="bc-un" data-bc-un="${esc(e.id)}" title="Check hatao">↩</button>`}
  </div>`;
}
const pill = () => `✅ ${st.tab === 'baqi' ? 'Baqi' : 'Check hue'} · ${(DAYS.find(x => x[0] === st.d) || DAYS[1])[1]}`;
export function bcHTML() {
  const L = list(), nB = bills().filter(e => String(e.date || '') >= since() && !chk(e)).length, nD = bills().filter(e => String(e.date || '') >= since() && chk(e)).length;
  const seg = (k, lab, i, opts, cur) => `<div class="bc-seg" data-mn-seg="${k}" data-mn-i="${i}" data-mn-t="${lab}" data-mn-g="✅ Bill check">${opts.map(([v, t, n]) => `<button type="button" class="${cur === v ? 'is-in' : ''}" data-bc-${k.split('.')[1]}="${v}">${t}${n != null ? ` <i>${n}</i>` : ''}</button>`).join('')}</div>`;
  return `<div class="bc-root" data-bc-root="1">
    <div class="bc-top"><label class="bc-q"><span>🔍</span><input type="search" data-bc-q="1" value="${esc(st.q)}" placeholder="Supplier / bill #" autocomplete="off"></label><button type="button" class="rk-pill" data-mn-sheet="1">${pill()} <i>${L.length}</i></button></div>
    ${seg('bc.tab', 'Kaun se bill', '✅', [['baqi', 'Baqi (check nahi hue)', nB], ['done', 'Check hue', nD]], st.tab)}
    ${seg('bc.d', 'Kitne din ke', '📅', DAYS.map(x => [x[0], x[1]]), st.d)}
    <div class="bc-list">${L.length ? L.map(rowHTML).join('') : `<div class="empty"><strong>${st.tab === 'baqi' ? 'Sab bill check ho chuke ✓' : 'Abhi koi bill check nahi hua'}</strong><p>${(DAYS.find(x => x[0] === st.d) || DAYS[1])[1]} ke POS purchase bills${st.q ? ' (is search mein)' : ''}</p></div>`}</div>
    <p class="stat-note">Bill par tap = items dekhein · ☐ tick = sirf check · "✓ Check + 📌 Post" = check + PC ko post ka hukum (ek click). Check server par mehfooz (kis ne, kab).</p>
  </div>`;
}
export function bcOpen() {
  if (!C) return;
  if (!C.can('pur.check')) { C.notice('✅ Bill check ki ijazat nahi — malik se kahein'); return; }
  C.modal('✅ Bill check', bcHTML(), true);
  try { $('dialog').classList.add('bc-dialog'); } catch {}
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} }, 30);
}
export function bcPaint() {   // checks / entries badlein to list + ☐ ticks taza
  const r = document.querySelector('#dialogBody [data-bc-root]');
  if (!r || !$('dialog')?.open) { for (const el of document.querySelectorAll('[data-bc-tickbox]')) { const h = bcTickHTML(el.dataset.bcTickbox, el.dataset.bcCls || ''); if (h) el.outerHTML = h; } return; }
  const q = r.querySelector('[data-bc-q]'), foc = document.activeElement === q;
  r.outerHTML = bcHTML();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-bc-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
  try { window.ntDlgMenu?.(); } catch {}
  for (const el of document.querySelectorAll('[data-bc-tickbox]')) { const id = el.dataset.bcTickbox, h = bcTickHTML(id, el.dataset.bcCls || ''); if (h) el.outerHTML = h; }
}
async function setCheck(id, on) {
  const e = bills().find(x => x.id === id); if (!e || st.busy.has(id)) return false;
  st.busy.add(id); bcPaint();
  try {
    await C.cloud.setBillCheck(id, on, { n: C.name(), billNo: billNo(e), date: e.date || '', pid: e.partyId || '', amt: Number(e.amount) || 0 });
    return true;
  } catch (err) { C.notice('Check save nahi hua: ' + (err?.message || err)); return false; }
  finally { st.busy.delete(id); bcPaint(); }
}
document.addEventListener('change', e => {
  const t = e.target; if (!C || !t?.dataset?.bcTick) return;
  const id = t.dataset.bcTick, on = t.checked;
  setCheck(id, on).then(ok => { if (!ok) { t.checked = !on; } else C.notice(on ? '✅ Bill check ho gaya' : '↩ Check hata diya'); });
});
document.addEventListener('input', e => { const t = e.target; if (!t?.dataset?.bcQ) return; st.q = t.value; bcPaint(); });
document.addEventListener('click', async e => {
  if (!C) return;
  const b = e.target.closest?.('[data-bc-tab],[data-bc-d],[data-bc-open],[data-bc-go],[data-bc-un]'); if (!b) return;
  const d = b.dataset;
  if (d.bcTab) { st.tab = d.bcTab; bcPaint(); return; }
  if (d.bcD) { st.d = d.bcD; try { localStorage.setItem(LS, st.d); } catch {} bcPaint(); return; }
  if (d.bcOpen) { bcSetNav(d.bcOpen); C.openBill(d.bcOpen); return; }
  if (d.bcUn) { if (await setCheck(d.bcUn, false)) C.notice('↩ Check hata diya'); return; }
  if (d.bcGo) { await bcGo(d.bcGo); return; }
});
export async function bcGo(id) {   // v2.128.0: ✓ Check + 📌 Post — list ke button aur POS Purchase screen ke button dono yahi (ek raasta)
  const ent = bills().find(x => x.id === id); if (!ent) return false;
  const ok = await setCheck(id, true); if (!ok) return false;
  if (!C.isPosted(ent) && C.can('pur.post')) { try { await C.post([ent]); } catch (err) { C.notice('Post nahi gaya: ' + (err?.message || err)); } }
  else C.notice('✅ Bill check ho gaya');
  return true;
}
function bcSetNav(id) {   // v2.128.0: list se bill khola = ‹ › isi list (Baqi, chuna hua din) ke bills — purchase.js ppOpenFromKhata parhta hai
  const L = list().filter(e => !chk(e) || e.id === id).map(e => ({ id: e.id, partyId: e.partyId, label: `${C.party(e.partyId)?.name || 'Supplier'} · Bill ${billNo(e)} · ${money(e.amount)}` }));
  try { window.ntBcNav = L.some(n => n.id === id) ? { list: L, at: Date.now() } : null; } catch {}
}
