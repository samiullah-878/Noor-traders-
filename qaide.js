// qaide.js — v2.183.1: 🧠 PSYCHO-CYBERNETICS ke 6 qaide (Maxwell Maltz) — SIRF malik. Malik: "ye 6 rules app mein — baar baar screen par aayein".
// App khulte hi (3 s baad) aur khuli app mein har 2 ghante ek qaida (bari bari 1→6) upar chhota card — popover (top layer: khuli khirki ke upar bhi).
// Tap = sab 6 · ✕ = band · 🔕 Aaj nahi. Sirf is phone ki yaad (localStorage) — server / AI kuch nahi.
const RULES = [
  ['🪞', 'Apni tasveer badlo', 'Insaan wahi karta hai jo woh apne baare mein sochta hai. Andar ki tasveer theek karo — kaam khud badlega.'],
  ['🎯', 'Saaf nishana do', 'Dimagh auto-pilot hai: nishana saaf ho to raasta khud dhoondta hai. Ghalti = sirf rukh theek karna, rukna nahi.'],
  ['🎬', 'Andar ka theater — roz 30 min', 'Aankhein band karke apne aap ko kaam theek karte hue saaf saaf dekho. Dimagh soche hue ko bhi tajurba maanta hai.'],
  ['🩹', 'Purane zakhm saaf karo', 'Maaf karo — doosron ko bhi, apne aap ko bhi. Purani nakami tumhari pehchan nahi.'],
  ['😊', 'Khushi ek aadat hai', 'Halaat ka intezar mat karo — aaj, abhi khush rehne ki mashq karo.'],
  ['🧘', 'Pehle sukoon, phir faisla', 'Ghabrahat mein auto-pilot kharab chalta hai. Saans lo, relax karo, phir faisla.'],
];
const GAP = 2 * 3600e3;
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch {} return null; };
const today = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let O = null, el = null, hideT = 0, all = false, started = false;

export function qdStart(o) {
  O = o || {}; if (started) return; started = true;
  setTimeout(() => maybe(true), 3000);   // app khulte hi — har dafa
  setInterval(maybe, 60e3);   // har minute dekho — 2 ghante ho gaye hon to agla qaida
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(maybe, 1500); });
}
function maybe(open) {
  if (document.hidden || !O.owner?.() || LS('sam-qd-off') === today()) return;
  if (!open && Date.now() - Number(LS('sam-qd-at') || 0) < GAP) return;
  show();
}
export function qdShow(allSix) { all = !!allSix; show(true); }
function show(manual) {
  const i = Number(LS('sam-qd-i') || 0) % RULES.length;
  if (!manual) { LS('sam-qd-at', Date.now()); LS('sam-qd-i', (i + 1) % RULES.length); }
  if (!el) {
    el = document.createElement('div'); el.id = 'qdCard'; el.className = 'qd'; el.setAttribute('popover', 'manual');
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', () => clearTimeout(hideT));   // chhua = khud band nahi
  }
  paint(i);
  // khuli modal khirki baqi sab ko 'inert' kar deti hai — card usi khirki ke andar rakho taake ungli chale
  const host = [...document.querySelectorAll('dialog')].filter(d => { try { return d.matches(':modal'); } catch { return false; } }).pop() || document.body;
  if (el.parentNode !== host) { try { el.hidePopover(); } catch {} host.appendChild(el); }
  try { el.showPopover(); } catch { el.hidden = false; }
  clearTimeout(hideT); if (!all) hideT = setTimeout(close, 15000);
}
function paint(i) {
  const [ic, t, s] = RULES[i];
  el.innerHTML = `<div class="qd-h"><small>🧠 Psycho-Cybernetics · ${i + 1}/6</small><button type="button" class="qd-x" data-qd="x" aria-label="Band">✕</button></div>`
    + (all ? `<ol class="qd-all">${RULES.map((r, k) => `<li${k === i ? ' class="is-in"' : ''}><b>${r[0]} ${esc(r[1])}</b><span>${esc(r[2])}</span></li>`).join('')}</ol>`
      : `<div class="qd-b" data-qd="all"><span class="qd-ic">${ic}</span><div><b>${esc(t)}</b><p>${esc(s)}</p></div></div>`)
    + `<div class="qd-f">${all ? '<button type="button" class="qd-c" data-qd="one">‹ Ek qaida</button>' : '<button type="button" class="qd-c" data-qd="all">📖 Sab 6</button>'}<button type="button" class="qd-c" data-qd="off">🔕 Aaj nahi</button></div>`;
  el.dataset.i = i;
}
function close() { clearTimeout(hideT); all = false; try { el?.hidePopover(); } catch { if (el) el.hidden = true; } }
function onClick(e) {
  const b = e.target.closest('[data-qd]'); if (!b) return;
  const k = b.dataset.qd, i = Number(el.dataset.i || 0);
  if (k === 'x') { close(); return; }
  if (k === 'off') { LS('sam-qd-off', today()); close(); O.notice?.('🔕 Aaj ke qaide band — kal phir'); return; }
  if (k === 'all') { all = true; clearTimeout(hideT); paint(i); return; }
  if (k === 'one') { all = false; paint(i); return; }
}
