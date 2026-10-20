// nav.js — v2.101.1: ☰ SAB SCREENS (malik: "screens bohat zyada ho gayi hain — screen dhoondni parti hai").
// Phone par upar ki patti mein sirf: ⭐ pin ki hui (har phone apni, localStorage) + aakhri 2 kholi hui + abhi wali + "☰ Sab screens".
// "☰ Sab screens" = poori screen par bare dabbe, groups mein (Rozana / Maal / Sale-Galla / Report), search, ⭐ pin.
// Ijazat wahi jo app.js .app-nav buttons ke `hidden` se deti hai (mulazim ko sirf apni). Computer (1100px+) par baayein list pehle jaisi.
// Tez: sab phone ke andar — Firebase par kuch nahi.
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GROUPS = [
  ['📒 Rozana', ['khataNav', 'dailyNav', 'expenseNav', 'cashNav', 'dastiNav', 'dueNav', 'notesNav']],
  ['📦 Maal', ['stockNav', 'transferNav', 'purchaseNav', 'posNav', 'barcodeNav', 'factoryNav']],
  ['🧾 Sale / Galla', ['saleNav', 'gallaNav', 'nazarNav', 'larkaNav', 'gaariNav']],
  ['📊 Report', ['irepNav', 'historyNav', 'hblNav']],
];
const DEF_PINS = ['khataNav', 'dailyNav', 'stockNav', 'purchaseNav'];
const LS_P = 'sam-nav-pins', LS_R = 'sam-nav-recent';
const rd = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const mq = window.matchMedia ? window.matchMedia('(min-width:1100px)') : { matches: false, addEventListener() {} };
const allowed = () => [...document.querySelectorAll('.app-nav button')].filter(b => !b.hidden && b.id && !['navAll', 'switchNav'].includes(b.id));
const label = b => (b.dataset.navLabel || b.textContent || '').trim();
function pins(list) { const p = rd(LS_P); const ids = new Set(list.map(b => b.id)); return (Array.isArray(p) ? p : DEF_PINS).filter(id => ids.has(id)).slice(0, 6); }
const recent = () => (Array.isArray(rd(LS_R)) ? rd(LS_R) : []);
function touch(id) { if (!id || id === 'navAll' || id === 'switchNav') return; wr(LS_R, [id, ...recent().filter(x => x !== id)].slice(0, 4)); }
const cur = () => { try { return typeof window.ntCurNav === 'function' ? window.ntCurNav() : ''; } catch { return ''; } };
const badge = id => { try { const b = typeof window.ntNavBadges === 'function' ? window.ntNavBadges() : {}; return b?.[id] || ''; } catch { return ''; } };

let busy = false;
function paint() {
  const nav = document.querySelector('.app-nav'); if (!nav || busy) return; busy = true;
  try {
    const list = allowed(); let all = $('navAll');
    if (mq.matches || list.length <= 6) { list.forEach(b => { b.classList.remove('nav-off'); b.style.order = ''; }); if (all) all.hidden = true; return; }
    const P = pins(list), R = recent(), c = cur(), keep = [...new Set([c, ...P, ...R.slice(0, 2)].filter(Boolean))];
    list.forEach(b => { const i = keep.indexOf(b.id); b.classList.toggle('nav-off', i < 0); b.style.order = i < 0 ? '' : String(i + 1); });
    if (!all) { all = document.createElement('button'); all.type = 'button'; all.id = 'navAll'; all.className = 'nav-all'; nav.appendChild(all); }
    all.hidden = false; all.style.order = '99'; all.textContent = `☰ Sab screens (${list.length})`;
  } finally { busy = false; }
}
let pT = 0; const later = () => { clearTimeout(pT); pT = setTimeout(paint, 40); };

// ---------- ☰ launcher ----------
let q = '';
function open() {
  const d = $('dialog'); if (!d) return; q = '';
  d.classList.remove('search-dialog'); d.classList.add('full-dialog'); $('dialogTitle').textContent = '☰ Sab screens';
  $('dialogBody').innerHTML = `<div class="nv-root"><label class="hs-search nv-search"><input type="search" data-nv-q="1" placeholder="🔍 screen ka naam (jaise fac, galla, stock)…" autocomplete="off"></label><div id="nvGrid"></div><p class="nv-tip">⭐ dabayein = upar ki patti mein hamesha (har phone apni)</p><button type="button" class="nv-ftg" data-nv-float="1">${floatTxt()}</button></div>`;
  if (!d.open) d.showModal(); grid();
}
function grid() {
  const el = $('nvGrid'); if (!el) return;
  const list = allowed(), by = new Map(list.map(b => [b.id, b])), P = new Set(pins(list)), c = cur(), qq = q.trim().toLowerCase();
  const seen = new Set(), tile = b => { seen.add(b.id); const t = label(b), bd = badge(b.id);
    return `<div class="nv-tile${b.id === c ? ' cur' : ''}"><button type="button" class="nv-go" data-nv-go="${esc(b.id)}"><b>${esc(t)}</b>${bd ? `<span class="nv-badge">${esc(bd)}</span>` : ''}${b.id === c ? '<small>abhi yahan</small>' : ''}</button><button type="button" class="nv-pin${P.has(b.id) ? ' on' : ''}" data-nv-pin="${esc(b.id)}" aria-label="Pin">${P.has(b.id) ? '★' : '☆'}</button></div>`; };
  const match = b => !qq || label(b).toLowerCase().includes(qq) || b.id.toLowerCase().includes(qq);
  let html = GROUPS.map(([g, ids]) => { const ts = ids.map(id => by.get(id)).filter(b => b && match(b)); return ts.length ? `<h4 class="nv-h">${g}</h4><div class="nv-grid">${ts.map(tile).join('')}</div>` : ''; }).join('');
  const rest = list.filter(b => !seen.has(b.id) && match(b) && !GROUPS.some(([, ids]) => ids.includes(b.id)));
  if (rest.length) html += `<h4 class="nv-h">➕ Aur</h4><div class="nv-grid">${rest.map(tile).join('')}</div>`;
  el.innerHTML = html || '<p class="nv-tip">Koi screen nahi mili</p>';
}
document.addEventListener('click', e => {
  const n = e.target.closest?.('.app-nav button'); if (n) { if (n.id === 'navAll') { e.preventDefault(); open(); return; } touch(n.id); later(); return; }
  const g = e.target.closest?.('[data-nv-go]'); if (g) { const b = $(g.dataset.nvGo); $('dialog')?.close(); touch(g.dataset.nvGo); if (b) b.click(); later(); return; }
  const p = e.target.closest?.('[data-nv-pin]'); if (p) { const list = allowed(), cur0 = pins(list), id = p.dataset.nvPin;
    const next = cur0.includes(id) ? cur0.filter(x => x !== id) : [...cur0, id].slice(-6); wr(LS_P, next); grid(); later(); }
});
document.addEventListener('input', e => { if (e.target.matches?.('[data-nv-q]')) { q = e.target.value || ''; grid(); } });
// app.js buttons ka hidden badle (login / ijazat / screen) -> patti dobara
const obs = new MutationObserver(later);
function hook() { const nav = document.querySelector('.app-nav'); if (!nav) { setTimeout(hook, 300); return; } obs.observe(nav, { attributes: true, subtree: true, attributeFilter: ['hidden'] }); later(); }
hook();
try { mq.addEventListener('change', later); } catch {}
// ---------- v2.103.9: 📌 UPAR PATTI (malik: "ek tab khula ho aur doosri jagah jana ho to upar jana parta hai") ----------
// Neeche scroll kiya hua ho aur ungli zara neeche khiskayein (page upar chale) = upar patli patti: wahi chips jo upar hain (⭐ pin,
// aakhri kholi, abhi wali) + ☰. Phir neeche parhein = chhup jaye. Ek tap = wahi screen (asal .app-nav button click — ijazat wahi).
// Har phone ki apni on / off (☰ Sab screens mein). Computer (baayein list) par nahi.
const LS_F = 'sam-nav-float', floatOn = () => rd(LS_F) !== false;
let fl = null, lastY = 0, shown = false, fT = 0;
function navBottom() { const n = document.querySelector('.app-nav'); if (!n) return 0; const r = n.getBoundingClientRect(); return r.bottom + window.scrollY; }
function flPaint(el = fl) {
  if (!el) return; const nav = document.querySelector('.app-nav'); if (!nav) return;
  const c = cur(), btns = [...nav.querySelectorAll('button')].filter(b => !b.hidden && b.id && b.id !== 'switchNav' && (b.id === 'navAll' || !b.classList.contains('nav-off')))
    .sort((a, b) => (Number(a.style.order) || 0) - (Number(b.style.order) || 0));
  el.innerHTML = `<div class="nvf-row">${btns.map(b => `<button type="button" class="nvf-b${b.id === c ? ' is-in' : ''}${b.id === 'navAll' ? ' nvf-all' : ''}" data-nvf="${esc(b.id)}">${esc(b.id === 'navAll' ? '☰ Sab' : label(b))}${badge(b.id) ? `<i>${esc(badge(b.id))}</i>` : ''}</button>`).join('')}</div>`;
}
function flShow(on) {
  if (!fl || shown === on) return; shown = on; if (on) flPaint(); fl.classList.toggle('nvf-on', on); fl.setAttribute('aria-hidden', on ? 'false' : 'true');
}
function onScroll() {
  if (!fl) return; const y = window.scrollY || 0, dy = y - lastY;
  if (!floatOn() || mq.matches || !document.querySelector('main:not([hidden]) .app-nav') || y < navBottom() + 20) { flShow(false); lastY = y; return; }
  if (dy < -8) flShow(true); else if (dy > 8) flShow(false);
  if (Math.abs(dy) > 8) lastY = y;
}
// v2.103.11: 🪟 poori screen wali KHIRKI (dialog) ke andar bhi — #dialogBody scroll; tap = khirki band + screen. Kuch likha / badla
//   (search ke ilawa) aur save nahi hua = pehle poochho. dirty: khirki khulne par saaf, andar input / change par true.
let fd = null, dShown = false, dLast = 0, dirty = false;
const dlgEl = () => $('dialog');
function fdShow(on) { const d = dlgEl(); if (!d) return; if (on && !fd) { fd = document.createElement('div'); fd.id = 'navFloatD'; fd.className = 'nv-float nv-floatd'; }
  if (fd && fd.parentNode !== d) d.appendChild(fd); if (!fd || dShown === on) return; dShown = on; if (on) flPaint(fd); fd.classList.toggle('nvf-on', on); }
function onDlgScroll(e) {
  const b = e.target; if (!b || b.id !== 'dialogBody') return; const y = b.scrollTop || 0, dy = y - dLast;
  if (!floatOn() || mq.matches || b.querySelector('.nv-root') || y < 60 || dlgEl()?.classList.contains('full-dialog')) { fdShow(false); dLast = y; return; }   // v2.103.79: poori screen khirki mein upar patti nahi
  if (dy < -8) fdShow(true); else if (dy > 8) fdShow(false);
  if (Math.abs(dy) > 8) dLast = y;
}
const isSearch = t => t?.type === 'search' || /🔍|dhoond/i.test(t?.placeholder || '');
function dlgWatch() {
  const d = dlgEl(); if (!d || d._nvW) return; d._nvW = true;
  new MutationObserver(() => { if (d.open) { dirty = false; dLast = 0; } else { dirty = false; fdShow(false); } }).observe(d, { attributes: true, attributeFilter: ['open'] });
  const mark = e => { if (e.target.closest?.('#dialogBody') && !isSearch(e.target)) dirty = true; };
  d.addEventListener('input', mark, true); d.addEventListener('change', mark, true);
  d.addEventListener('submit', () => { dirty = false; }, true);
}
function flInit() {
  if (fl || !document.body) return; fl = document.createElement('nav'); fl.id = 'navFloat'; fl.className = 'nv-float'; fl.setAttribute('aria-hidden', 'true'); document.body.appendChild(fl);
  window.addEventListener('scroll', () => { if (!fT) fT = requestAnimationFrame(() => { fT = 0; onScroll(); }); }, { passive: true });
  document.addEventListener('scroll', e => { if (e.target?.id === 'dialogBody') onDlgScroll(e); }, { passive: true, capture: true });
  dlgWatch(); if (!dlgEl()) setTimeout(dlgWatch, 800);
}
document.addEventListener('click', e => {
  const f = e.target.closest?.('[data-nvf]'); if (f) { e.preventDefault(); const id = f.dataset.nvf, inDlg = !!f.closest('#navFloatD');
    if (inDlg) { if (dirty && !confirm('⚠️ Badlav save nahi hua — chhor kar jayein?')) return; fdShow(false); dirty = false; try { dlgEl()?.close(); } catch {} }
    flShow(false); if (id === 'navAll') { open(); return; } const b = $(id); touch(id); if (b) b.click(); window.scrollTo(0, 0); later(); return; }
  const t = e.target.closest?.('[data-nv-float]'); if (t) { wr(LS_F, !floatOn()); t.textContent = floatTxt(); if (!floatOn()) flShow(false); }
});
const floatTxt = () => `📌 Upar patti (scroll karte waqt — screen aur khirki dono): ${floatOn() ? 'ON ✓' : 'OFF'}`;
flInit(); if (!fl) document.addEventListener('DOMContentLoaded', flInit);
export const navPaint = later;
