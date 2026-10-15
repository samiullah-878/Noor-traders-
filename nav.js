// nav.js — v2.99.95: ☰ SAB SCREENS (malik: "screens bohat zyada ho gayi hain — screen dhoondni parti hai").
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
  $('dialogBody').innerHTML = `<div class="nv-root"><label class="hs-search nv-search"><input type="search" data-nv-q="1" placeholder="🔍 screen ka naam (jaise fac, galla, stock)…" autocomplete="off"></label><div id="nvGrid"></div><p class="nv-tip">⭐ dabayein = upar ki patti mein hamesha (har phone apni)</p></div>`;
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
export const navPaint = later;
