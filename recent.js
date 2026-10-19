// recent.js — v2.103.61: 🕘 HAAL HI KI KHIRKIYAN (malik: "jaise phone par recent tabs — button ki bajaye chhote chips upar saamne").
//   Har khirki / khata jo khula (Rack bharo → Mangwao · Godam 1, Transfer check, Stock milao, Rate list, Khata: Bilal …) upar .app-nav ke neeche
//   chhote chips mein, naya pehle, 8 tak, phone par yaad (localStorage sam-recent-win — har phone apna). Tap = wahi khirki usi haalat mein
//   (window.ntRecentOpen(desc) app.js mein — stockScreenOpen / route). Firebase par kuch nahi. AI nahi.
const LS = 'sam-recent-win', MAX = 8;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rd = () => { try { const a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const wr = a => { try { localStorage.setItem(LS, JSON.stringify(a.slice(0, MAX))); } catch {} };
let cur = '';   // abhi khuli hui (chip 'on')
export function recentPush(e) {   // {key, icon, label, open:{...}} — key same ho to upar aa jata hai (label/open taza)
  if (!e || !e.key) return; cur = e.key;
  wr([{ key: String(e.key).slice(0, 60), icon: String(e.icon || '').slice(0, 4), label: String(e.label || '').slice(0, 40), open: e.open || {}, at: Date.now() }, ...rd().filter(x => x.key !== e.key)]);
  recentPaint();
}
export function recentList() { return rd(); }
export function recentClear() { wr([]); recentPaint(); }
export function recentPaint() {
  const nav = document.querySelector('.app-nav'); if (!nav) return;
  let bar = document.getElementById('recentBar');
  const L = rd(); if (!L.length) { if (bar) bar.hidden = true; return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'recentBar'; bar.className = 'recent-bar'; nav.after(bar); }
  bar.hidden = false;
  bar.innerHTML = `<span class="rc-ic" title="Haal hi ki khirkiyan">🕘</span>${L.map(x => `<button type="button" class="rc-chip${x.key === cur ? ' on' : ''}" data-recent="${esc(x.key)}">${esc(x.icon)} ${esc(x.label)}</button>`).join('')}<button type="button" class="rc-x" data-recent-clear="1" aria-label="Saaf">✕</button>`;
}
document.addEventListener('click', e => {
  const c = e.target.closest?.('[data-recent-clear]'); if (c) { recentClear(); return; }
  const b = e.target.closest?.('[data-recent]'); if (!b) return;
  const x = rd().find(y => y.key === b.dataset.recent); if (!x) return;
  try { if (typeof window.ntRecentOpen === 'function') window.ntRecentOpen(x); } catch (er) { console.warn('recent', er); }
});
