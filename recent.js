// recent.js — v2.315.0: 🗂 HAAL HI MEIN (malik 17 Nov: "recents tab jaisa — ek screen se doosri par jana ho to baar baar search karna parta hai ·
//   kisi bhi screen par hon ya kisi bhi khata par, wo direct usi jagah se open hona chahiye").
//   Header ka 🗂 (shell.js rtBtnSetup, CAP app.recent) → apni <dialog id=rtDlg> (top layer — har khirki ke upar): aakhri 12 cards — 📱 screen ·
//   📒 khata · 🪟 khirki (⋮ chip / ☰ wali khirki / stock screen), naya upar. Card = WAHI jagah: route(view, khata id) / stockScreenOpen(desc) /
//   ⋮ chip dobara dabana (view + khata khol kar) + screen / khate ka scroll wahin (y). 🗂 do dafa (ya khirki khulte hi upar khali jagah) = foran
//   pichhli. ✕ har card · 🧹 Sab hatao. Har phone apna (localStorage sam-recent-win) — Firebase par kuch nahi. AI nahi.
//   (pehle v2.103.61: yahi list upar chips #recentBar mein — woh CSS se chhupi thi; v2.270.1 ka 'khate nahi' sirf un chips ka tha — 🗂 mein khate HAAN, malik.)
//   Classes / ids: rt-* · data-rt-* · #rtDlg · #rtBtn · window.ntRtOpen / ntRtClose (rate-chg ka ntRcClose / .rc-* alag).
const LS = 'sam-recent-win', MAX = 12;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const cssq = s => String(s).replace(/["\\]/g, '\\$&');
const EMO = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D|\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u;
const rd = () => { try { const a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.key) : []; } catch { return []; } };
const wr = a => { try { localStorage.setItem(LS, JSON.stringify(a.slice(0, MAX))); } catch {} };
const VI = { khata: ['📒', 'Khate'], daily: ['🧾', 'Daily Sale'], transfer: ['⇄', 'Transfer'], notes: ['🔔', 'Reminder'], due: ['⏰', 'Due'], purchase: ['🛒', 'Purchase'], ppurchase: ['🛒', 'POS Purchase'], pos: ['🖥', 'POS'], sale: ['🧾', 'Sale'], wsale: ['📲', 'WhatsApp Sale'], stock: ['📦', 'Stock'], expenses: ['💸', 'Akhrajat'], cash: ['💵', 'Cash'], dasti: ['💼', 'Dasti'], hbl: ['🏦', 'HBL'], barcode: ['🏷', 'Barcode'], history: ['🕘', 'History'], nazar: ['👀', 'Nazar'], galla: ['💰', 'Galla'], larka: ['🏆', 'Larka report'], irep: ['📊', 'Item report'], factory: ['🏭', 'Factory'], gaari: ['🚚', 'Gaari'] };
const sv = () => { try { return String(window.ntShellView?.() || ''); } catch { return ''; } };
const ss = () => { try { const s = window.ntShellSel?.(); return s ? String(s) : ''; } catch { return ''; } };
const note = m => { try { window.ntShellNotice?.(m); } catch {} };
const upOpen = () => [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'rtDlg');
let cur = '', pushAt = 0, pushKind = '', quietUntil = 0;
const routeKey = () => { const s = ss(), v = sv(); return s && v === 'khata' ? 'k:' + s : v ? 'v:' + v : ''; };

export function recentPush(e) {   // {key, icon, label, sub?, open:{...}} — key same ho to upar aa jata hai (label/open taza, scroll y wahi)
  if (!e || !e.key) return;
  const key = String(e.key).slice(0, 80), L = rd(), old = L.find(x => x.key === key) || {}, o = e.open || {};
  let icon = String(e.icon || ''), label = clean(e.label);
  const v = o.kind === 'route' && !o.id ? o.v : '';
  if (v && VI[v]) { if (!icon) icon = VI[v][0]; if (!label || label === v) label = VI[v][1]; }
  if (!icon && key.startsWith('k:')) icon = '👤';
  cur = key; pushAt = Date.now(); pushKind = o.kind || '';
  wr([{ key, icon: icon.slice(0, 8), label: label.slice(0, 40), sub: clean(e.sub || old.sub || '').slice(0, 40), open: o, at: Date.now(), y: Number(old.y) || 0 }, ...L.filter(x => x.key !== key)]);
  recentPaint();
}
export function recentList() { return rd(); }
export function recentClear() { wr(rd().filter(x => x.key === cur)); recentPaint(); }
export function recentPaint() { const b = document.getElementById('recentBar'); if (b) b.remove(); if (rtDlg()?.open) rtPaint(); }   // purani chips patti (CSS se chhupi thi) — ab sirf 🗂

// ---------- scroll yaad (sirf screen / khata — khirki nahi) ----------
function saveY() {
  if (Date.now() < quietUntil || upOpen().length) return;
  const L = rd(), x = L.find(e => e.key === cur); if (!x || (x.open || {}).kind !== 'route') return;
  const y = Math.round(window.scrollY || 0); if (Math.abs((Number(x.y) || 0) - y) < 20) return;
  x.y = y; wr(L);
}
let yT = 0;
addEventListener('scroll', () => { if (yT) return; yT = setTimeout(() => { yT = 0; saveY(); }, 500); }, { passive: true });
function yBack(y) {   // route ke baad khata / list der se banti hai — itni lambi ho jaye to wahin le jao (2 s tak)
  let n = 0;
  const t = () => { const h = document.documentElement.scrollHeight - innerHeight; if (h >= y - 5 || n > 13) { quietUntil = Date.now() + 500; scrollTo(0, Math.max(0, Math.min(y, h))); return; } n++; setTimeout(t, 150); };
  setTimeout(t, 140);
}
// khirki band = 'abhi yahan' wapas screen / khata par
document.addEventListener('close', e => { const d = e.target; if (!d || d.tagName !== 'DIALOG' || d.id === 'rtDlg') return; setTimeout(() => { if (upOpen().length) return; const k = routeKey(); if (k && rd().some(x => x.key === k)) cur = k; }, 0); }, true);

// ---------- 🪟 khirki yaad: ⋮ / screen ka chip (data-mn) ya ☰ ki khirki (…Nav) jis se nayi khirki khule ----------
const NAV_SKIP = new Set(['switchNav', 'qdNav']);
document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-mn],button[id$="Nav"]'); if (!el || el.closest('#rtDlg,#mnRoot')) return;
  const isNav = !el.hasAttribute('data-mn') && /Nav$/.test(el.id || '');
  if (isNav ? NAV_SKIP.has(el.id) : !el.closest('main')) return;   // khirki ke andar ke chips nahi (khirki ke andar khirki — dobara kholna pakka nahi)
  const before = new Set(upOpen()), t0 = Date.now(), v = sv(), id = ss(), k = el.getAttribute('data-mn') || '', nid = el.id;
  const lab0 = clean(el.dataset.mnT || el.textContent), ic0 = el.dataset.mnI || '';
  const chk = n => setTimeout(() => {
    const nw = upOpen().find(d => !before.has(d));
    if (!nw) { if (n < 2) chk(n + 1); return; }
    if (pushAt > t0 && pushKind && pushKind !== 'route') return;   // khirki ne khud yaad kar liya (stock screens / tolai — apni haalat ke saath)
    let label = (nw.id === 'dialog' ? clean(document.getElementById('dialogTitle')?.textContent) : '') || lab0, icon = ic0;
    const m = label.match(EMO); if (m) { icon = icon || m[1]; label = m[2] || label; }
    if (!label) return;
    if (isNav) { recentPush({ key: 'n:' + nid, icon: icon || '🪟', label, sub: '☰ Khirki', open: { kind: 'nav', id: nid } }); return; }
    const kh = id ? (rd().find(x => x.key === 'k:' + id)?.label || 'Khata') : '', sub = kh ? '📒 ' + kh : (VI[v] ? VI[v][0] + ' ' + VI[v][1] : v);
    recentPush({ key: 'm:' + v + ':' + id + ':' + k, icon: icon || '🪟', label, sub, open: { kind: 'mn', v, id: id || null, k } });
  }, n ? 700 : 450);
  chk(0);
}, true);

// ---------- kholna (WAHI jagah) ----------
const UP_CLOSE = ['ntShellClose', 'ntPclClose', 'ntSdjClose', 'ntGtpClose', 'ntLvClose', 'ntDlvClose', 'ntNsClose', 'ntBtClose', 'ntRcClose', 'ntQtrClose', 'ntAwClose', 'ntKdClose', 'ntWebClose', 'ntGnClose', 'ntGvClose'];
function upClose() {   // jo khirki khuli ho band (phone ke back jaisa — app.js popstate wali fehrist), phir aam khirki
  for (const h of UP_CLOSE) for (let n = 0; n < 10; n++) { const f = window[h]; if (typeof f !== 'function') break; let r = false; try { r = f(); } catch { break; } if (!r) break; }
  const d = document.getElementById('dialog'); if (d && d.open) { try { d.close(); } catch {} }
}
const waitFor = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await new Promise(r => setTimeout(r, 120)); } };
async function openMn(o, x) {
  if (sv() !== o.v || ss() !== String(o.id || '')) { try { window.ntRecentOpen?.({ open: { kind: 'route', v: o.v, id: o.id || null } }); } catch {} }
  const q = 'main [data-mn="' + cssq(o.k) + '"]';
  const el = await waitFor(() => { for (const b of document.querySelectorAll(q)) if (!b.closest('[hidden]') && !b.disabled) return b; return null; }, 5000);
  if (!el) { note('“' + x.label + '” abhi is screen par nahi mili (ijazat / abhi ki haalat)'); return; }
  try { el.click(); } catch (er) { console.warn('rt', er); }
}
function openEntry(x) {
  if (!x) return;
  const o = x.open || {}; quietUntil = Date.now() + 1500;
  upClose();
  if (o.kind === 'mn') { openMn(o, x); return; }
  if (o.kind === 'nav') { const b = document.getElementById(o.id); if (b) b.click(); else note('“' + x.label + '” abhi nahi khul sakti'); return; }
  try { window.ntRecentOpen?.(x); } catch (er) { console.warn('rt', er); }
  if (o.kind === 'route' && Number(x.y) > 30) yBack(Number(x.y));
}

// ---------- 🗂 khirki ----------
let shown = [], openedAt = 0;
const rtDlg = () => document.getElementById('rtDlg');
const ago = t => { const s = Math.max(0, (Date.now() - (Number(t) || 0)) / 1000); return s < 60 ? 'abhi' : s < 3600 ? Math.floor(s / 60) + ' min pehle' : s < 86400 ? Math.floor(s / 3600) + ' ghante pehle' : Math.floor(s / 86400) + ' din pehle'; };
const kindTxt = x => { const o = x.open || {}; return x.key.startsWith('k:') ? '📒 Khata' : o.kind === 'route' ? '📱 Screen' : '🪟 Khirki'; };
// pichhli = 'abhi yahan' ke ilawa sab se nayi — khirki band ho to isi screen ki khirkiyan nahi (pichhli SCREEN / khata chahiye)
const prevOf = L => { const v = sv(), s = ss(), dlg = upOpen().length; return L.find(x => { if (x.key === cur) return false; const o = x.open || {}; return dlg || !(o.kind === 'mn' && o.v === v && String(o.id || '') === s); }); };
function rtPaint() {
  const g = document.getElementById('rtG'); if (!g) return;
  const L = rd(), prevKey = (prevOf(L) || {}).key; shown = L;
  g.innerHTML = L.length ? L.map((x, i) => { const isCur = x.key === cur, isPrev = x.key === prevKey;
    return `<div class="rt-c${isCur ? ' is-cur' : ''}${isPrev ? ' is-prev' : ''}"><button type="button" class="rt-go" data-rt-go="${i}"><i>${esc(x.icon || '📄')}</i><span><b>${esc(x.label)}</b><small>${isCur ? '📍 Abhi yahan' : (isPrev ? '↩ Pichhli · ' : '') + esc(x.sub || kindTxt(x)) + ' · ' + ago(x.at)}</small></span></button><button type="button" class="rt-del" data-rt-del="${i}" aria-label="Hatao">✕</button></div>`; }).join('')
    : '<p class="rt-none">Abhi kuch yaad nahi — koi screen / khata kholein, phir yahan nazar aayega.</p>';
}
function rtClose() { const d = rtDlg(); if (d && d.open) { try { d.close(); } catch { d.removeAttribute('open'); } return true; } return false; }
function rtPrev() { const x = prevOf(rd()); rtClose(); if (x) openEntry(x); else note('Pichhli screen abhi yaad nahi'); }
function ensureDlg() {
  let d = rtDlg(); if (d) return d;
  d = document.createElement('dialog'); d.id = 'rtDlg'; d.className = 'rt-dlg';
  d.innerHTML = '<div class="rt-sh" tabindex="-1" autofocus><div class="rt-hd"><b>🗂 Haal hi mein</b><small>Dabayein = wahin wapas · 🗂 do dafa = pichhli</small><button type="button" class="rt-x" data-rt-x="1" aria-label="Band">✕</button></div><div class="rt-g" id="rtG"></div><div class="rt-ft"><button type="button" class="rt-clr" data-rt-clr="1">🧹 Sab hatao</button></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', e => {
    const t = e.target;
    if (t === d) { if (Date.now() - openedAt < 450) rtPrev(); else rtClose(); return; }   // upar khali jagah: foran doosra tap = pichhli, warna band
    if (t.closest('[data-rt-x]')) { rtClose(); return; }
    if (t.closest('[data-rt-clr]')) { recentClear(); return; }
    const del = t.closest('[data-rt-del]'); if (del) { const x = shown[Number(del.dataset.rtDel)]; if (x) wr(rd().filter(y => y.key !== x.key)); rtPaint(); return; }
    const go = t.closest('[data-rt-go]'); if (go) { const x = shown[Number(go.dataset.rtGo)]; rtClose(); if (x && x.key !== cur) openEntry(x); }
  });
  return d;
}
export function rtOpen() {
  const d = ensureDlg();
  if (d.open) { if (Date.now() - openedAt < 450) rtPrev(); else rtClose(); return; }
  if (!upOpen().length) { const k = routeKey(); if (k && rd().some(x => x.key === k)) cur = k; saveY(); }
  rtPaint(); openedAt = Date.now();
  try { d.showModal(); } catch { d.setAttribute('open', ''); }
}
window.ntRtOpen = rtOpen;
window.ntRtClose = rtClose;   // app.js popstate: phone ka back = pehle yeh khirki

// purani chips patti (agar kahin bachi ho) ka click
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-recent]'); if (!b) return;
  openEntry(rd().find(y => y.key === b.dataset.recent));
});
