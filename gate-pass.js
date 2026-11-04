// gate-pass.js — v1.1 (2026-11-01, app v2.165.0: 🔵 / 🔴 — malik: "Bills jaisa: laal = posted (tick), neela = un-posted (baad mein laal) · do ⋮: daayein sab cheezein,
//   baayein un-posted · keyboard khule to screen chhoti — saamne sirf asal kaam": saamne SIRF laal cards (+ hare chips, ⚠️ cancel jis ka maal diya tha);
//   baayan ⋮ (header, neela + ginti) = apni <dialog> mein un-posted (tick band); daayan ⋮ = din · tareekh · godam · dikhao · ginti · PDF · cancel list; 🔍 chhota chip) ·
// v1.0 (2026-11-01, app v2.164.0) 🚪 GATE PASS KA RECORD
//   Malik: "jitne bhi gate pass nikal rahe hain un ka record app mein · larka tick kare (Zeeshan, Sonu — jis ko access dein) · transfer check jaisi
//   screen, usi tarteeb se · har customer alag · jo bill POST ho jaye usi ka gate pass 1–1½ second mein · upar gate pass number aur customer,
//   neeche tadad — wahan Zeeshan ya Sonu tick kar de · ⋮ ke andar din / mahina / tareekh se har jagah record".
// Data: PC gate-pass.js (sirf POS parhti) → gatePass/<SaleID> {no, day, pt, br, p, pc, by, l:[{k,i,n,q,pk,g}], gs, gn, off} · tick = gatePass.g.<k> {n, t, q}
//   (rules 2.81 — mulazim sirf `g`). Ek bill ke do godam = do gate pass card. Tick ke baad bill ki tadad badli (q farq) = tick khud baqi + ✏️.
// Screen (Transfer check ka "📦 Jane wala maal" jaisa): ⋮ = din · godam · Baqi/De diye/Sab · 📄 PDF (kholo + bhejo). CAP app.gate (OPT_IN). AI NAHI.
import { smartFind } from './dukan/dhoond.js?v=2.181.2';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => { n = Number(n) || 0; return Math.abs(n - Math.round(n)) < 1e-6 ? new Intl.NumberFormat('en-PK').format(Math.round(n)) : String(Math.round(n * 1000) / 1000); };
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = n => String(n).padStart(2, '0'), dk = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return dk(d); };
const dLab = s => s ? `${+s.slice(8, 10)} ${MN[+s.slice(5, 7) - 1]}` : '';
const tms = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0;
const clock = ms => ms ? new Date(ms).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : '';
const ago = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' ghante' : Math.floor(m / 1440) + ' din'; };
export const gpQty = (q, pk) => { q = Number(q) || 0; pk = Number(pk) || 0; if (pk > 1) { const c = Math.floor(q / pk + 1e-9), p = r3(q - c * pk); return c && p ? `${num(c)} ctn + ${num(p)} pcs` : c ? `${num(c)} ctn` : `${num(p)} pcs`; } return `${num(q)} pcs`; };
const LS = 'sam-gtp-g', lsGet = () => { try { return localStorage.getItem(LS) || 'all'; } catch { return 'all'; } }, lsSet = v => { try { localStorage.setItem(LS, v); } catch {} };
let C = null, L = [], stop = null, subKey = '', err = '', loaded = false, timer = null;
const st = { r: 'aaj', d: '', g: lsGet(), v: 'sab', q: '', qo: false, open: new Set() };
const seen = new Map(), fresh = new Map(), pendT = new Map();   // seen: id -> ps (neela → laal = ✨)
const psOf = d => Number(d?.ps) === 1 ? 1 : 2;   // v1.0 ke docs (ps nahi) = posted   // fresh: naya aaya card (✨ 5 sec) · pendT: 'id|k' -> {on, n, q, t, s: wait|ok|err}
export function gpSetup(ctx) { C = ctx; }
function range() {
  const t = back(0);
  if (st.r === 'kal') return [back(1), back(1)];
  if (st.r === '7') return [back(6), t];
  if (st.r === '30') return [back(29), t];
  if (st.r === 'mah') return [t.slice(0, 8) + '01', t];
  if (st.r === 'd' && st.d) return [st.d, st.d];
  return [t, t];
}
const rLab = () => ({ aaj: 'Aaj', kal: 'Kal', 7: '7 din', 30: '30 din', mah: 'Is mahine' })[st.r] || (st.d ? dLab(st.d) : 'Aaj');
function listen() {
  const [a, b] = range(), key = a + '|' + b;
  if (stop && subKey === key) return;
  try { stop?.(); } catch {} stop = null; subKey = key; loaded = false; err = '';
  if (!C?.cloud?.listenGatePass) { err = 'old'; return; }
  stop = C.cloud.listenGatePass(a, b, (list, e) => {
    if (!list) { err = /permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? 'rules' : 'net'; try { stop?.(); } catch {} stop = null; subKey = ''; paint(); return; }
    err = '';
    const now = Date.now();
    for (const d of list) { const ps = psOf(d), was = seen.get(d.id); if (loaded && ps === 2 && was !== 2) fresh.set(d.id, now); seen.set(d.id, ps); }
    L = list; loaded = true; paint();
  });
}
// tick: server (g) + abhi dabaya (pendT) — ⏳ jab tak server ✓ na kare
function tickOf(d, x) {
  const key = d.id + '|' + x.k, p = pendT.get(key), srv = d.g?.[x.k] || null;
  if (p && p.s !== 'err') {
    if (p.s === 'ok' && (p.on ? !!srv : !srv)) { pendT.delete(key); }
    else return p.on ? { n: p.n, q: p.q, t: p.t, w: 1 } : null;
  }
  return srv ? { n: srv.n, q: Number(srv.q), t: tms(srv.t), w: d.pend ? 1 : 0 } : null;
}
// card = ek bill × ek godam (har customer alag)
function cards() {
  const out = [];
  for (const d of L) {
    for (const g of (Array.isArray(d.gs) && d.gs.length ? d.gs : [...new Set((d.l || []).map(x => x.g))])) {
      if (st.g !== 'all' && String(g) !== st.g) continue;
      const items = (d.l || []).filter(x => Number(x.g) === Number(g)).map(x => { const t = tickOf(d, x), ok = !!t && Math.abs(r3(t.q) - r3(x.q)) < 1e-6; return { x, t, ok, ch: !!t && !ok }; });
      if (!items.length) continue;
      const left = items.filter(r => !r.ok).length;
      out.push({ d, g: Number(g), id: d.id + '|' + g, items, left, k: d.off ? 'off' : psOf(d) === 1 ? 'blue' : left ? 'open' : 'done' });
    }
  }
  return out.sort((a, b) => (Number(b.d.pt) || Number(b.d.tm) || 0) - (Number(a.d.pt) || Number(a.d.tm) || 0));
}
const gName = (d, g) => String(d.gn?.[String(g)] || (Number(g) === 1 ? 'NOOR TRADERS' : 'Godam ' + g));
const cText = c => [c.d.no, c.d.p, ...c.items.map(r => r.x.n)].join(' ');
function godams() { const m = new Map(); for (const d of L) for (const g of d.gs || []) m.set(String(g), gName(d, g)); if (st.g !== 'all' && !m.has(st.g)) m.set(st.g, 'Godam ' + st.g); return [...m].sort((a, b) => a[1].localeCompare(b[1])); }
const canTick = () => C.owner() || C.can('app.gate');
function rowHTML(c, r) {
  const x = r.x;
  return `<div class="tc-ir gtp-ir"><span><b>${esc(x.n)}</b>${r.ch ? `<small class="gtp-ch">✏️ bill badla — pehle ${esc(gpQty(r.t.q, x.pk))} diya (${esc(r.t.n || '')})</small>` : ''}</span><b class="gtp-q">${esc(gpQty(x.q, x.pk))}</b>${c.k === 'open' && canTick() ? `<button type="button" class="tc-iok gtp-ok" data-gtp-tk="${esc(c.d.id)}|${esc(x.k)}|1">✓ de diya</button>` : ''}</div>`;
}
function chipHTML(c, r) {
  const x = r.x, t = r.t;
  return `<button type="button" class="tc-ic ok${t.w ? ' gtp-w' : ''}" data-gtp-tk="${esc(c.d.id)}|${esc(x.k)}|"${c.k === 'off' || !canTick() ? ' disabled' : ''}>${t.w ? '⏳' : '✓'} ${esc(x.n)} <i>${esc(gpQty(x.q, x.pk))} · ${esc(t.n || '')} ${esc(clock(t.t))}</i></button>`;
}
function cardHTML(c, full) {
  const d = c.d, multi = range()[0] !== range()[1], open = c.items.filter(r => !r.ok), done = c.items.filter(r => r.ok), isNew = fresh.has(d.id) && Date.now() - fresh.get(d.id) < 6000;
  return `<div class="tc-ig gtp-card ${c.k}${isNew ? ' gtp-new' : ''}" data-gtp-card="${esc(c.id)}">
    <div class="gtp-h"><span class="gtp-no">🚪 Gate pass <b>#${esc(String(d.no || '').replace(/^0+/, '') || d.id)}</b></span><span class="gtp-cu">👤 ${esc(d.p || 'Customer')}</span>${full ? `<button type="button" class="gtp-x" data-gtp-show="${esc(c.id)}" aria-label="Band">✕</button>` : ''}</div>
    <small class="gtp-sub">🏬 ${esc(gName(d, c.g))} → ${esc(gName(d, d.br))} · 📌 post ${multi ? esc(dLab(d.day)) + ' ' : ''}${esc(clock(d.pt))} · ${esc(ago(d.pt))}${d.pc ? ' · 🖥 ' + esc(d.pc) : ''} · ${c.items.length} item</small>
    ${c.k === 'off' ? `<p class="gtp-off">❌ Bill POS mein cancel / delete ho gaya${done.length ? ` — ⚠️ ${done.length} item de diye the: maal wapas lo ya malik ko batao` : ' — maal mat dena'}</p>` : ''}
    ${c.k === 'off' ? c.items.map(r => `<div class="tc-ir gtp-ir"><span><b>${esc(r.x.n)}</b></span><b class="gtp-q">${esc(gpQty(r.x.q, r.x.pk))}</b>${r.ok ? '<i class="gtp-was">✓ diya</i>' : ''}</div>`).join('') : open.map(r => rowHTML(c, r)).join('')}
    ${c.k !== 'off' && done.length ? `<div class="tc-ich"><small>✓ De diya (chip dabao = wapas)</small>${done.map(r => chipHTML(c, r)).join('')}</div>` : ''}</div>`;
}
function ncHTML(c) {
  const d = c.d, last = c.items.map(r => r.t).filter(Boolean).sort((a, b) => b.t - a.t)[0];
  const lab = c.k === 'off' ? `❌ #${esc(String(d.no || '').replace(/^0+/, ''))} · ${esc(d.p || 'Customer')}` : `✓ #${esc(String(d.no || '').replace(/^0+/, ''))} · ${esc(d.p || 'Customer')}`;
  return `<button type="button" class="tc-nc ${c.k === 'off' ? 'cancel' : 'ok'}" data-gtp-show="${esc(c.id)}"><b>${lab}</b><small>🏬 ${esc(gName(d, c.g))} · ${c.items.length} item${last ? ` · ${esc(last.n || '')} ${esc(clock(last.t))}` : ''}${c.k === 'off' && c.items.some(r => r.ok) ? ' · ⚠️ diya tha' : ''}</small></button>`;
}
const C2 = (on, k, v, lab) => `<button type="button" class="rc${on ? ' on' : ''}" data-gtp-${k}="${v}">${lab}</button>`;
// 🔵 un-posted card (tick band) — baayein ⋮ ki khirki mein
function blueCard(c) {
  const d = c.d, given = c.items.filter(r => r.ok).length;
  return `<div class="gtb-card"><div class="gtp-h"><span class="gtp-no">🚪 <b>#${esc(String(d.no || '').replace(/^0+/, '') || d.id)}</b></span><span class="gtp-cu">👤 ${esc(d.p || 'Customer')}</span></div>
    <small class="gtp-sub">🏬 ${esc(gName(d, c.g))} → ${esc(gName(d, d.br))}${d.pc ? ' · 🖥 ' + esc(d.pc) : ''} · bana ${esc(clock(d.tm))} · ${c.items.length} item</small>
    ${given ? `<p class="gtp-off">⚠️ Bill post hua tha, ab un-post — ${given} item de diye ja chuke</p>` : ''}
    ${c.items.map(r => `<div class="tc-ir gtp-ir"><span><b>${esc(r.x.n)}</b></span><b class="gtp-q">${esc(gpQty(r.x.q, r.x.pk))}</b>${r.ok ? '<i class="gtp-was">✓ diya</i>' : ''}</div>`).join('')}</div>`;
}
function blueHTML() {
  const B = cards().filter(c => c.k === 'blue');
  return `<div class="gtb-hd"><b>🔵 Un-posted gate pass <em>${B.length}</em></b><button type="button" class="gtb-x" data-gtp-bx="1" aria-label="Band karo">✕</button></div>
  <div class="gtb-body"><p class="gtb-note">POS mein bill bana, abhi POST nahi — tick band. Post hote hi 🔴 laal ban kar saamne ki screen par aa jayega.</p>
  ${B.map(blueCard).join('') || '<p class="gtb-none">✓ Koi un-posted gate pass nahi</p>'}</div>`;
}
function blueOpen() {
  let d = $('gtpBlue');
  if (!d) { d = document.createElement('dialog'); d.id = 'gtpBlue'; d.className = 'gtb-dlg'; document.body.append(d);
    d.addEventListener('click', e => { if (e.target === d) blueClose(); }); d.addEventListener('close', () => lbPaint()); }
  d.innerHTML = blueHTML(); try { if (!d.open) d.showModal(); } catch { d.setAttribute('open', ''); } lbPaint();
}
export function blueClose() { const d = $('gtpBlue'); if (!d?.open) return false; try { d.close(); } catch { d.removeAttribute('open'); } return true; }
window.ntGtpClose = blueClose;   // app.js popstate: phone ka back = pehle yeh khirki
// baayan ⋮ (khirki ke header mein, title se pehle) — neela + un-posted ginti
function lbPaint() {
  const root = document.querySelector('#dialogBody [data-gtp-root]'); let b = $('gtpLb');
  if (!root) { b?.remove(); blueClose(); return; }
  const head = $('dialog')?.querySelector('.dialog-head');
  if (!b && head) { b = document.createElement('button'); b.type = 'button'; b.id = 'gtpLb'; b.className = 'gtp-lb'; b.dataset.gtpBo = '1'; b.setAttribute('aria-label', 'Un-posted gate pass'); b.title = '🔵 Un-posted gate pass'; head.insertBefore(b, $('dialogTitle') || head.firstChild); }
  if (!b) return;
  const n = cards().filter(c => c.k === 'blue').length, h = `⋮${n ? `<b>${n}</b>` : ''}`;
  if (b.innerHTML !== h) b.innerHTML = h;
  b.classList.toggle('is-in', !!$('gtpBlue')?.open);
}
export function gpHTML() {
  const all = cards(), q = st.q.trim();
  const hit = q ? new Set(smartFind(all, q, cText, c => 'gp' + c.id).hits) : null, A = hit ? all.filter(c => hit.has(c)) : all;
  const blueN = all.filter(c => c.k === 'blue').length, open = A.filter(c => c.k === 'open'), done = A.filter(c => c.k === 'done'), off = A.filter(c => c.k === 'off');
  const offWarn = off.filter(c => c.items.some(r => r.ok)), offQuiet = off.filter(c => !c.items.some(r => r.ok));
  const leftN = open.reduce((n, c) => n + c.left, 0);
  const G = godams(), gl = st.g === 'all' ? 'Sab godam' : (G.find(x => x[0] === st.g)?.[1] || 'Godam ' + st.g), vl = { baqi: 'Sirf baqi', done: 'Sirf de diye', sab: '' }[st.v];
  const msg = err === 'rules' ? '<p class="gtp-err">🔐 Firebase rules 2.81 abhi nahi lagi — shop PC 5 min mein khud lagata hai. Phir yahan gate pass aayenge.</p>' : err === 'net' ? '<p class="gtp-err">📵 Internet / server se jawab nahi — thori der baad khud.</p>' : err === 'old' ? '<p class="gtp-err">App purani hai — Update karein.</p>' : '';
  const showOpen = st.v !== 'done', showDone = st.v !== 'baqi';
  const top = st.qo || st.q
    ? `<div class="gtp-top"><label class="hs-search tc-iq gtp-qbox"><input type="search" data-gtp-q="1" placeholder="🔍 customer / item / gate pass no…" value="${esc(st.q)}" autocomplete="off"></label><button type="button" class="gtp-qx" data-gtp-qx="1" aria-label="Dhoondo band">✕</button></div>`
    : `<div class="gtp-top"><button type="button" class="gtp-sq" data-gtp-qo="1" aria-label="Dhoondo">🔍</button><button type="button" class="rk-pill gtp-pill" data-mn-sheet="1"><span>📅 ${esc(rLab())} · 🏬 ${esc(gl)}${vl ? ' · ' + vl : ''} · 🔴 ${num(leftN)} baqi</span><i>⋮</i></button></div>`;
  return `<div class="gtp-root" data-gtp-root="1">
    ${top}
    <div class="mchips" data-mn-seg="gtp.r" data-mn-i="📅" data-mn-t="Kis din ke gate pass" data-mn-g="🚪 Gate pass">${C2(st.r === 'aaj', 'r', 'aaj', 'Aaj')}${C2(st.r === 'kal', 'r', 'kal', 'Kal')}${C2(st.r === '7', 'r', '7', '7 din')}${C2(st.r === '30', 'r', '30', '30 din')}${C2(st.r === 'mah', 'r', 'mah', 'Is mahine')}</div>
    <label class="gtp-date" data-mn-box="gtp.date" data-mn-i="📆" data-mn-t="Apni tareekh" data-mn-s="ek din ke gate pass" data-mn-g="🚪 Gate pass"><small>📆 Tareekh</small><input type="date" data-gtp-date="1" max="${back(0)}" value="${st.r === 'd' ? esc(st.d) : ''}"></label>
    <div class="mchips" data-mn-seg="gtp.g" data-mn-i="🏬" data-mn-t="Kis godam ke gate pass" data-mn-s="is phone par yaad" data-mn-g="🚪 Gate pass">${C2(st.g === 'all', 'g', 'all', 'Sab')}${G.map(([id, n]) => C2(st.g === id, 'g', esc(id), esc(n))).join('')}</div>
    <div class="mchips" data-mn-seg="gtp.v" data-mn-i="👁" data-mn-t="Kaun se dikhao" data-mn-g="🚪 Gate pass">${C2(st.v === 'sab', 'v', 'sab', 'Sab')}${C2(st.v === 'baqi', 'v', 'baqi', '🔴 Baqi')}${C2(st.v === 'done', 'v', 'done', '✓ De diye')}</div>
    <div class="tc-kpis gtp-kpis" data-mn-box="gtp.kpi" data-mn-i="📊" data-mn-t="Ginti" data-mn-s="neela · laal · hara" data-mn-g="🚪 Gate pass"><div class="blue"><b>${blueN}</b><small>🔵 un-posted</small></div><div class="${open.length ? 'bad' : ''}"><b>${open.length}</b><small>🔴 tick baqi</small></div><div class="good"><b>${done.length}</b><small>✓ de diye</small></div>${off.length ? `<div class="warn"><b>${off.length}</b><small>❌ cancel</small></div>` : ''}</div>
    <button type="button" class="gtp-pdf" data-gtp-pdf="1" data-mn="gtp.pdf" data-mn-i="📄" data-mn-t="Gate pass PDF" data-mn-s="kholo + bhejo" data-mn-g="🚪 Gate pass">📄 PDF</button>
    ${offQuiet.length ? `<div class="gtp-offl" data-mn-box="gtp.off" data-mn-i="❌" data-mn-t="Cancel / delete (${offQuiet.length})" data-mn-s="maal nahi diya tha" data-mn-g="🚪 Gate pass">${offQuiet.filter(c => st.open.has(c.id)).map(c => cardHTML(c, 1)).join('')}<div class="tc-ncw">${offQuiet.map(ncHTML).join('')}</div></div>` : ''}
    ${msg}
    ${offWarn.map(c => cardHTML(c)).join('')}
    ${showOpen ? open.map(c => cardHTML(c)).join('') || (q ? '<p class="muted">Kuch nahi mila</p>' : loaded ? `<p class="tc-iall">✓ Koi posted gate pass baqi nahi${blueN ? ` · 🔵 ${blueN} un-posted (baayan ⋮)` : ''}</p>` : err ? '' : '<p class="muted">⏳ Gate pass aa rahe hain…</p>') : ''}
    ${showDone && done.length ? `<div class="tc-ncs"><h4 class="tc-hh">✓ Poore de diye (${done.length}) <small>— chip dabao = poora gate pass</small></h4>${done.filter(c => st.open.has(c.id)).map(c => cardHTML(c, 1)).join('')}<div class="tc-ncw">${done.map(ncHTML).join('')}</div></div>` : ''}
    ${loaded && !all.length && !err ? `<p class="muted gtp-empty">${esc(rLab())} koi gate pass nahi (${st.g === 'all' ? 'sab godam' : esc(gl)}). Dukan ke bill mein godam ka maal ho — bill bante hi 🔵, POST hote hi 🔴 yahan ~1 second mein.</p>` : ''}
  </div>`;
}
export function gpOpen() {
  if (!C) return;
  if (!canTick()) { C.notice('🚪 Gate pass ki ijazat nahi — malik se kahein'); return; }
  listen();
  C.modal('🚪 Gate pass', gpHTML(), true);
  try { $('dialog').classList.add('gtp-dialog'); } catch {}
  lbPaint();
  if (!gpOpen.mo && $('dialogBody')) { gpOpen.mo = new MutationObserver(() => { if (!document.querySelector('#dialogBody [data-gtp-root]')) lbPaint(); }); gpOpen.mo.observe($('dialogBody'), { childList: true }); }
  clearInterval(timer); timer = setInterval(() => { if (!document.querySelector('#dialogBody [data-gtp-root]')) { clearInterval(timer); timer = null; try { stop?.(); } catch {} stop = null; subKey = ''; return; } const [a, b] = range(); if (a + '|' + b !== subKey) listen(); paint(); }, 30000);   // v2.177.0: 🐞 raat 12 ke baad khuli screen = khud aaj ke bill
  setTimeout(() => { try { window.ntDlgMenu?.(); } catch {} }, 30);
}
function paint() {
  const r = document.querySelector('#dialogBody [data-gtp-root]'); if (!r) return;
  const q = r.querySelector('[data-gtp-q]'), foc = document.activeElement === q, sel = foc ? q.selectionStart : 0;
  r.outerHTML = gpHTML();
  lbPaint(); const bd = $('gtpBlue'); if (bd?.open) bd.innerHTML = blueHTML();
  if (foc) { const q2 = document.querySelector('#dialogBody [data-gtp-q]'); if (q2) { q2.focus(); try { q2.setSelectionRange(sel, sel); } catch {} } }
  try { window.ntDlgMenu?.(); } catch {}
}
async function tick(id, k, on) {
  const d = L.find(x => x.id === id), x = d?.l?.find(y => y.k === k); if (!d || !x) return;
  if (!canTick()) { C.notice('Ijazat nahi'); return; }
  if (d.off || psOf(d) !== 2) { C.notice(d.off ? '❌ Yeh bill cancel ho gaya — tick nahi' : '🔵 Bill abhi POST nahi hua — post hone ke baad tick'); return; }
  const key = id + '|' + k, nm = C.name() || 'Mulazim';
  pendT.set(key, { on, n: nm, q: x.q, t: Date.now(), s: 'wait' }); paint();   // pehle UI (foran)
  try { await C.cloud.setGateTick(id, k, on ? { n: nm, q: x.q } : null); const p = pendT.get(key); if (p) p.s = 'ok'; }
  catch (e) {
    pendT.delete(key);
    C.notice(/permission|insufficient/i.test(String(e?.code || '') + String(e?.message || '')) ? '🔐 Rules 2.81 abhi nahi lagi — tick save nahi hua (shop PC 5 min mein khud lagata hai)' : '✕ Tick save nahi hua: ' + (e?.message || e));
  }
  paint();
}
function pdfHTML() {
  const [a, b] = range(), all = cards().filter(c => c.k !== 'blue' && (st.v === 'sab' || (st.v === 'baqi' ? c.k === 'open' : c.k === 'done'))).sort((x, y) => (Number(x.d.pt) || 0) - (Number(y.d.pt) || 0));
  const G = godams(), gl = st.g === 'all' ? 'Sab godam' : (G.find(x => x[0] === st.g)?.[1] || 'Godam ' + st.g);
  const rows = all.map(c => c.items.map((r, i) => `<tr${i ? '' : ' class="gtp-h"'}>${i ? '<td></td><td></td><td></td><td></td>' : `<td>${esc(dLab(c.d.day))} ${esc(clock(c.d.pt))}</td><td><b>#${esc(String(c.d.no || '').replace(/^0+/, ''))}</b></td><td>${esc(c.d.p || '')}</td><td>${esc(gName(c.d, c.g))}</td>`}<td>${esc(r.x.n)}</td><td><b>${esc(gpQty(r.x.q, r.x.pk))}</b></td><td>${c.k === 'off' ? '❌ cancel' + (r.ok ? ' (diya tha)' : '') : r.ok ? `✓ ${esc(r.t.n || '')} ${esc(clock(r.t.t))}` : '⏳ baqi'}</td></tr>`).join('')).join('');
  return `<h1>NOOR TRADERS</h1><h2>🚪 Gate pass record — ${esc(a === b ? dLab(a) : dLab(a) + ' se ' + dLab(b))} · ${esc(gl)}</h2>
  <p>${all.length} gate pass · ${all.filter(c => c.k === 'done').length} poore de diye · ${all.filter(c => c.k === 'open').length} baqi${all.some(c => c.k === 'off') ? ' · ' + all.filter(c => c.k === 'off').length + ' cancel' : ''} · ${esc(new Date().toLocaleString('en-PK'))}</p>
  <table><thead><tr><th>Waqt</th><th>GP #</th><th>Customer</th><th>Godam</th><th>Item</th><th>Tadad</th><th>De diya</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Koi gate pass nahi</td></tr>'}</tbody></table>`;
}
document.addEventListener('input', e => { const t = e.target; if (!t?.closest?.('[data-gtp-root]')) return; if (t.dataset.gtpQ) { st.q = t.value || ''; paint(); } });
document.addEventListener('change', e => { const t = e.target; if (!t?.dataset?.gtpDate) return; if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { st.r = 'd'; st.d = t.value; st.open.clear(); listen(); paint(); } });
document.addEventListener('click', e => {
  if (!C) return;
  const b = e.target.closest?.('[data-gtp-r],[data-gtp-g],[data-gtp-v],[data-gtp-pdf],[data-gtp-tk],[data-gtp-show],[data-gtp-bo],[data-gtp-bx],[data-gtp-qo],[data-gtp-qx]'); if (!b) return;
  const d = b.dataset;
  if (d.gtpBo) { if ($('gtpBlue')?.open) blueClose(); else blueOpen(); return; }
  if (d.gtpBx) { blueClose(); return; }
  if (d.gtpQo) { st.qo = true; paint(); setTimeout(() => { try { document.querySelector('#dialogBody [data-gtp-q]')?.focus(); } catch {} }, 0); return; }
  if (d.gtpQx) { st.qo = false; st.q = ''; paint(); return; }
  if (d.gtpR) { st.r = d.gtpR; st.d = ''; st.open.clear(); listen(); paint(); return; }
  if (d.gtpG) { st.g = d.gtpG; lsSet(st.g); paint(); return; }
  if (d.gtpV) { st.v = d.gtpV; paint(); return; }
  if (d.gtpShow) { if (st.open.has(d.gtpShow)) st.open.delete(d.gtpShow); else st.open.add(d.gtpShow); paint(); return; }
  if (d.gtpPdf) { if (!loaded) { C.notice('Gate pass abhi aa rahe hain'); return; } C.pdf(pdfHTML(), `Gate pass ${rLab()}`); return; }
  if (d.gtpTk) { const [id, k, on] = d.gtpTk.split('|'); tick(id, k, on === '1'); return; }
});
