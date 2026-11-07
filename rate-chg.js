// rate-chg.js — v1.0 (2026-11-07, app v2.194.0): 📈 RATE CHANGE — jin items ka KHAREED rate pichhli khareed se badla (malik: "jo rates change hue
//   pichli dafa se wo aayein · easy · rates wahan se badal sakein · ☐ tick = check ho kar list mein · baayein ⋮ settings · daayein ⋮ check hue · purchase jaisi chhoti lines").
// Data: PC rate-change.js (sirf parhti, har 30 s POS dekhti) → posStats/rateChg (JSON) — app sirf parhti; ✓ check = blueAccess/rateChk.m[k] (k = POS PurchaseDetailID).
// Rate badalna = WAHI raasta jo purchase ka "📌 Naye rates POS par lagao" (cloud.requestRates → PC rate-lagao). Sirf malik (CAP pur.ratechg OPT_IN mulazim ke liye). AI nahi.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => { n = Number(n) || 0; return Math.abs(n - Math.round(n)) < 1e-6 ? new Intl.NumberFormat('en-PK').format(Math.round(n)) : String(Math.round(n * 100) / 100); };
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch {} return null; };
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min pehle' : Math.round(m / 60) + ' ghante pehle'; };
let C = null, R = null, K = {}, stopR = null, stopK = null, jobs = {};
const st = { days: Number(LS('sam-rc-days')) || 30, dir: LS('sam-rc-dir') || 'all', sup: '', q: '', open: '' };
export function rcSetup(ctx) { C = ctx; }
const pct = x => { const o = Number(x.o) || 0; return o ? Math.round((x.r - o) / o * 100) : 0; };
function rows(all) {
  const cut = new Date(); cut.setDate(cut.getDate() - st.days); const ck = cut.toISOString().slice(0, 10), q = st.q.trim().toLowerCase();
  return (R?.list || []).filter(x => {
    if (!all && K[String(x.k)]) return false;
    if (x.d < ck) return false;
    if (st.dir === 'up' && x.r <= x.o) return false;
    if (st.dir === 'down' && x.r >= x.o) return false;
    if (st.sup && x.sid !== st.sup) return false;
    if (q && !(String(x.n).toLowerCase().includes(q) || String(x.c).includes(q) || String(x.s).toLowerCase().includes(q))) return false;
    return true;
  });
}
const sups = () => { const m = new Map(); for (const x of R?.list || []) if (x.sid && !m.has(x.sid)) m.set(x.sid, x.s || x.sid); return [...m.entries()]; };
export function rcCount() { try { return rows(false).length; } catch { return 0; } }
export function rcOpen() {
  if (!C) return;
  if (!C.can('pur.ratechg')) { C.notice('📈 Rate change ki ijazat nahi — malik se kahein'); return; }
  C.modal('📈 Rate change', html(), true);
  try { $('dialog').classList.add('rc-dialog'); } catch {}
  if (!stopR && C.cloud?.listenRateChg) stopR = C.cloud.listenRateChg(d => { R = d; paint(); });
  if (!stopK && C.cloud?.listenRateChk) stopK = C.cloud.listenRateChk(m => { K = m || {}; paint(); });
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} lbPaint(); }, 30);
}
function html() {
  const L = rows(false), n = L.length, nk = Object.keys(K).length;
  const head = `<div class="rc-mini" data-mn-sheet><span>📈 <b>${n}</b> ka rate badla · ${st.days} din${st.dir !== 'all' ? (st.dir === 'up' ? ' · ↑ barhe' : ' · ↓ ghate') : ''}${st.sup ? ' · 🏭 ' + esc(sups().find(s => s[0] === st.sup)?.[1] || '') : ''}</span><small>${R ? (R.err ? '⚠️ PC: ' + esc(R.err) : '🖥 ' + ago(R.at)) : '⏳ PC ka data…'}</small></div>
  <div class="rc-top"><input type="search" class="rc-q" data-rc-q placeholder="🔍 Item / supplier" value="${esc(st.q)}" autocomplete="off">
    <button type="button" class="rc-chip" data-rc-chk-list data-mn="rc.chk" data-mn-i="✅" data-mn-t="Check hue" data-mn-s="${nk} items — ✓ ho chuke" data-mn-n="${nk || ''}" data-mn-g="📈 Rate change">✅ ${nk} check hue</button>
    <button type="button" class="rc-chip" data-rc-refresh data-mn="rc.ref" data-mn-i="🔄" data-mn-t="Taza karo" data-mn-s="PC se dobara list" data-mn-g="📈 Rate change">🔄 Taza</button></div>`;
  const list = !R ? `<p class="rc-empty">⏳ PC se list aa rahi hai… (PC on ho aur rate-change script chal rahi ho)</p>`
    : !L.length ? `<p class="rc-empty">✅ ${st.days} din mein koi naya rate change nahi (ya sab check ho chuke)</p>`
    : L.map(row).join('');
  return `<div data-rc-root>${head}<div class="rc-list">${list}</div></div>`;
}
function row(x) {
  const p = pct(x), up = x.r > x.o, k = String(x.k), j = jobs[k];
  const stt = j ? (j.s === 'done' ? '<span class="rc-st ok">✅</span>' : j.s === 'fail' ? `<span class="rc-st bad" title="${esc(j.e || '')}">❌</span>` : '<span class="rc-st">⏳</span>') : '';
  return `<div class="rc-r ${st.open === k ? 'is-in' : ''}" data-rc-k="${k}">
    <label class="rc-cb"><input type="checkbox" data-rc-chk="${k}"></label>
    <div class="rc-main" data-rc-tap="${k}"><b>${esc(x.n)}</b><small>${esc(x.s || '')} · ${esc(x.b)} · ${esc(x.d.slice(5))}${x.pk ? ' · 1 ctn = ' + x.pk : ''}</small></div>
    <div class="rc-rt"><span class="rc-old">${num(x.o)}</span> → <b class="${up ? 'rc-up' : 'rc-dn'}">${num(x.r)}</b><small class="${up ? 'rc-up' : 'rc-dn'}">${p > 0 ? '+' : ''}${p}%</small><small class="rc-wr">W ${num(x.w)} · R ${num(x.rp)}</small>${stt}</div>
    ${st.open === k ? edit(x) : ''}</div>`;
}
function edit(x) {
  const sug = (Number(x.w) && Number(x.o)) ? Math.round(x.r * (x.w / x.o) * 100) / 100 : '';   // W ko usi nisbat se (purana nafa %)
  const sugR = (Number(x.rp) && Number(x.o)) ? Math.round(x.r * (x.rp / x.o) * 100) / 100 : '';
  return `<div class="rc-ed" data-rc-ed="${x.k}">
    <div class="rc-ed-row"><label>Khareed (naya)<input type="text" inputmode="decimal" value="${num(x.r)}" data-rc-cost readonly></label>
      <label>W pcs<input type="text" inputmode="decimal" value="${x.w ? num(x.w) : ''}" data-rc-w placeholder="${sug ? 'nisbat se ' + sug : ''}"></label>
      <label>R pcs<input type="text" inputmode="decimal" value="${x.rp ? num(x.rp) : ''}" data-rc-r placeholder="${sugR ? 'nisbat se ' + sugR : ''}"></label></div>
    <div class="rc-ed-row rc-ed-act">${sug ? `<button type="button" class="rc-chip" data-rc-sug="${x.k}">✨ Nisbat se W ${sug}${sugR ? ' · R ' + sugR : ''}</button>` : ''}<button type="button" class="rc-chip rc-go" data-rc-go="${x.k}">📌 POS mein lagao</button><button type="button" class="rc-chip" data-rc-close="1">✕</button></div>
    <small class="rc-ed-msg" data-rc-msg="${x.k}">Purana khareed ${num(x.o)} (${esc(x.pb)} · ${esc(x.pd)}) → naya ${num(x.r)} · abhi W ${num(x.w)} / R ${num(x.rp)}${x.w && x.o ? ' · purana nafa W ' + Math.round((x.w - x.o) / x.o * 100) + '%' : ''}</small></div>`;
}
function paint() {
  const r = document.querySelector('#dialogBody [data-rc-root]'); if (!r) return;
  const q = r.querySelector('[data-rc-q]'), foc = document.activeElement === q, act = document.activeElement, keep = act?.closest?.('[data-rc-ed]') ? (act.hasAttribute('data-rc-w') ? 'w' : act.hasAttribute('data-rc-r') ? 'r' : '') : '';
  const vals = keep ? { w: r.querySelector('[data-rc-w]')?.value, r: r.querySelector('[data-rc-r]')?.value } : null;
  r.outerHTML = html();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-rc-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(q2.value.length, q2.value.length); } catch {} } }
  if (vals) { const w = document.querySelector('#dialogBody [data-rc-w]'), rr = document.querySelector('#dialogBody [data-rc-r]'); if (w && vals.w != null) w.value = vals.w; if (rr && vals.r != null) rr.value = vals.r; (keep === 'w' ? w : rr)?.focus(); }
  try { window.ntDlgMenu?.(); } catch {} lbPaint();
}
// ---- baayein ⋮ = settings (apni <dialog>, phone back = ntRcClose) ----
function lbPaint() {
  const root = document.querySelector('#dialogBody [data-rc-root]'); let b = $('rcLb');
  const head = $('dialog')?.querySelector('.dialog-head');
  if (!root) { b?.remove(); setClose(); try { $('rcChk')?.close(); } catch {} return; }
  if (!b && head) { b = document.createElement('button'); b.type = 'button'; b.id = 'rcLb'; b.className = 'rc-lb'; b.dataset.rcLb = '1'; b.title = '⚙️ Settings'; b.textContent = '⋮'; head.insertBefore(b, $('dialogTitle') || head.firstChild); }
  if (b) b.classList.toggle('is-in', !!$('rcSet')?.open);
}
function setOpen() {
  let d = $('rcSet');
  if (!d) { d = document.createElement('dialog'); d.id = 'rcSet'; d.className = 'rc-set'; document.body.append(d); d.addEventListener('click', e => { if (e.target === d) setClose(); }); }
  d.innerHTML = setHTML(); try { d.showModal(); } catch { d.setAttribute('open', ''); } lbPaint();
}
export function setClose() { const d = $('rcSet'); if (!d?.open) return false; try { d.close(); } catch { d.removeAttribute('open'); } lbPaint(); return true; }
window.ntRcClose = () => { const c = $('rcChk'); if (c?.open) { try { c.close(); } catch {} return true; } return setClose(); };   // phone back = pehle yeh khirkiyan
function setHTML() {
  const c = (k, v, t) => `<button type="button" class="rc-chip ${st[k] === v ? 'is-in' : ''}" data-rc-set="${k}" data-rc-v="${esc(String(v))}">${t}</button>`;
  return `<div class="rc-set-in"><div class="rc-set-h"><b>⚙️ Rate change — settings</b><button type="button" class="rc-chip" data-rc-setclose>✕</button></div>
    <p>📅 Din</p><div class="rc-chips">${[7, 15, 30, 60].map(d => c('days', d, d + ' din')).join('')}</div>
    <p>↕ Kaun se</p><div class="rc-chips">${c('dir', 'all', 'Sab')}${c('dir', 'up', '↑ Barhe')}${c('dir', 'down', '↓ Ghate')}</div>
    <p>🏭 Supplier</p><div class="rc-chips">${c('sup', '', 'Sab')}${sups().map(([id, n]) => c('sup', id, esc(n))).join('')}</div>
    <small>Sirf is phone par yaad rehta hai.</small></div>`;
}
function chkOpen() {
  const L = rows(true).filter(x => K[String(x.k)]).sort((a, b) => (K[String(b.k)]?.at || 0) - (K[String(a.k)]?.at || 0));
  const body = L.length ? L.map(x => `<div class="rc-r rc-done"><div class="rc-main"><b>${esc(x.n)}</b><small>${esc(x.s || '')} · ${esc(x.b)} · ${esc(x.d.slice(5))} · ✓ ${ago(K[String(x.k)].at)}</small></div><div class="rc-rt"><span class="rc-old">${num(x.o)}</span> → <b>${num(x.r)}</b><small class="rc-wr">W ${num(x.w)} · R ${num(x.rp)}</small></div><button type="button" class="rc-chip" data-rc-unchk="${x.k}">↩</button></div>`).join('')
    : `<p class="rc-empty">Abhi koi check nahi hua</p>`;
  let d = $('rcChk');
  if (!d) { d = document.createElement('dialog'); d.id = 'rcChk'; d.className = 'rc-set'; document.body.append(d); d.addEventListener('click', e => { if (e.target === d) { try { d.close(); } catch {} } }); }
  d.innerHTML = `<div class="rc-set-in"><div class="rc-set-h"><b>✅ Check hue (${L.length})</b><button type="button" class="rc-chip" data-rc-chkclose>✕</button></div><div class="rc-list">${body}</div></div>`;
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
}
async function go(k) {
  const x = (R?.list || []).find(y => String(y.k) === String(k)); if (!x) return;
  const ed = document.querySelector(`#dialogBody [data-rc-ed="${k}"]`), msg = ed?.querySelector('[data-rc-msg]');
  const w = Number(String(ed?.querySelector('[data-rc-w]')?.value || '').replace(/,/g, '')) || 0, rp = Number(String(ed?.querySelector('[data-rc-r]')?.value || '').replace(/,/g, '')) || 0;
  if (!w && !rp) { if (msg) msg.textContent = '❌ W ya R mein naya rate likhein'; return; }
  if (w && w < x.r) { if (!confirm(`W rate (${w}) khareed (${x.r}) se KAM hai — phir bhi lagayein?`)) return; }
  try {
    jobs[k] = { s: 'wait' }; paint();
    const id = await C.cloud.requestRates({ lines: [{ itemId: String(x.i), code: String(x.c || ''), name: String(x.n || ''), pack: Number(x.pk) || 0, costP: Number(x.r) || 0, wctn: 0, wpcs: w, rctn: 0, rpcs: rp }] });
    const stop = C.cloud.watchRates(id, j => {
      if (!j) return;
      if (j.status === 'done') { jobs[k] = { s: 'done' }; stop(); C.notice('✅ ' + x.n + ' ke rates POS mein lag gaye'); try { C.cloud.requestRateChg?.(); } catch {} paint(); }
      else if (j.status === 'failed' || j.status === 'error') { jobs[k] = { s: 'fail', e: j.error || 'nakam' }; stop(); paint(); }
    });
    setTimeout(() => { if (jobs[k]?.s === 'wait') { jobs[k] = { s: 'wait', e: 'PC chup' }; paint(); C.notice('⏳ PC ka jawab nahi — job mehfooz hai, PC on hote hi lagegi'); } }, 30000);
  } catch (e) { jobs[k] = { s: 'fail', e: e?.message || String(e) }; paint(); C.notice('❌ ' + (e?.message || e)); }
}
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest?.('[data-rc-lb]')) { e.preventDefault(); if ($('rcSet')?.open) setClose(); else setOpen(); return; }
  const sb = t.closest?.('[data-rc-set]'); if (sb) { const k = sb.dataset.rcSet, v = sb.dataset.rcV; st[k] = k === 'days' ? Number(v) : v; if (k !== 'sup') LS('sam-rc-' + k, v); const d = $('rcSet'); if (d) d.innerHTML = setHTML(); paint(); return; }
  if (t.closest?.('[data-rc-setclose]')) { setClose(); return; }
  if (t.closest?.('[data-rc-chkclose]')) { try { $('rcChk')?.close(); } catch {} return; }
  if (t.closest?.('[data-rc-chk-list]')) { chkOpen(); return; }
  if (t.closest?.('[data-rc-refresh]')) { try { await C.cloud.requestRateChg(); C.notice('🔄 PC se taza list maangi'); } catch (er) { C.notice('❌ ' + (er?.message || er)); } return; }
  const un = t.closest?.('[data-rc-unchk]'); if (un) { try { await C.cloud.setRateChk(un.dataset.rcUnchk, false); } catch (er) { C.notice('❌ ' + (er?.message || er)); } chkOpen(); return; }
  const cb = t.closest?.('[data-rc-chk]'); if (cb) {
    const k = cb.dataset.rcChk, x = (R?.list || []).find(y => String(y.k) === k); const rowEl = cb.closest('.rc-r'); rowEl?.classList.add('rc-gone');   // pehle UI, server baad mein
    try { await C.cloud.setRateChk(k, true, x || {}); } catch (er) { rowEl?.classList.remove('rc-gone'); cb.checked = false; C.notice('❌ ' + (er?.message || er)); }
    return;
  }
  const tap = t.closest?.('[data-rc-tap]'); if (tap) { st.open = st.open === tap.dataset.rcTap ? '' : tap.dataset.rcTap; paint(); return; }
  if (t.closest?.('[data-rc-close]')) { st.open = ''; paint(); return; }
  const sg = t.closest?.('[data-rc-sug]'); if (sg) { const x = (R?.list || []).find(y => String(y.k) === sg.dataset.rcSug); const ed = sg.closest('[data-rc-ed]'); if (x && ed) { const w = ed.querySelector('[data-rc-w]'), r = ed.querySelector('[data-rc-r]'); if (w && x.w && x.o) w.value = Math.round(x.r * (x.w / x.o) * 100) / 100; if (r && x.rp && x.o) r.value = Math.round(x.r * (x.rp / x.o) * 100) / 100; } return; }
  const g = t.closest?.('[data-rc-go]'); if (g) { go(g.dataset.rcGo); return; }
});
document.addEventListener('input', e => { const q = e.target.closest?.('[data-rc-q]'); if (q) { st.q = q.value; clearTimeout(window.__rcQT); window.__rcQT = setTimeout(paint, 180); } });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('[data-rc-ed]')) { const ed = e.target.closest('[data-rc-ed]'); e.preventDefault(); go(ed.dataset.rcEd); } });
