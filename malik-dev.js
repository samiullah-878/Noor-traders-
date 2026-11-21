// malik-dev.js v1.0 (app v2.344.0) — 👑 MALIK KE DEVICES + 👥 MULAZIM KE DEVICES (Mulazim screen ke do chips)
// malik (21 Nov 2026): "malik ki bhi aik screen — konsi konsi device par hum login hain · total kitni devices chal rahi hain · un ko hataya ja sake · chips mulazim ka alehda, mera alehda"
// Data: blueAccess/malikDevs {d:{<device id>:{nm, ua, at, tab, x}}} — har malik wala device khud apna naam likhta hai (har 10 min).
//   ✕ Hatao = x (waqt) → wo device apni x dekh kar khud logout (net par ho to foran, warna agli dafa kholte hi). x wala device list mein nahi dikhta;
//   wo dobara login kare to x khud hat jata hai (wapas nazar aata hai). Mulazim ke devices = purana staffDevices (cloud.deleteStaffDevice). AI NAHI.
let C = null, D = null, srv = false, stop = null, first = false, gone = false, V = 'm', Q = '';
const KEY = 'sam-md-x';
const handled = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const E = s => C.esc(String(s ?? ''));
const uaIcon = ua => /Windows|Macintosh|Linux x86/i.test(ua || '') ? '💻' : '📱';
const uaName = ua => { const u = String(ua || ''); const os = /Windows/i.test(u) ? 'Windows PC' : /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? 'Android phone' : /Macintosh/i.test(u) ? 'Mac' : 'Device'; const br = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : ''; return os + (br ? ' · ' + br : ''); };
const live = t => Date.now() - Number(t || 0) < 12 * 60000;

export function mdSetup(ctx) {
  C = ctx; if (stop) return;
  stop = C.cloud.listenMalikDevs((d, cache) => {
    if (d === null) { D = D || {}; chips(); return; }
    D = d; if (!cache) { srv = true; check(); }
    chips(); if (dlgEl()?.open) paint();
  });
  setInterval(beat, 10 * 60000);
  document.addEventListener('click', onClick);
  document.addEventListener('input', e => { if (e.target?.id !== 'mkdQ') return; Q = e.target.value; paint(true); });
}
function check() {
  const me = D?.[C.me];
  if (me?.x && String(me.x) !== handled()) { kick(me.x); return; }
  if (!first) { first = true; beat(); }
}
function beat() {   // sirf server ka taza data dekhne ke baad — purani yaad (cache) par x kabhi na mite
  if (!srv || gone || !C) return; const me = D?.[C.me];
  if (me?.x && String(me.x) !== handled()) return;
  C.cloud.malikDevBeat(C.me, { ua: String(navigator.userAgent).slice(0, 80), tab: C.tab ? 1 : 0 }, !!me?.x).catch(() => {});
}
function kick(x) {
  if (gone) return; gone = true; try { localStorage.setItem(KEY, String(x)); } catch {}
  try { C.notice('👑 Yeh device malik ne hata diya — logout ho raha hai'); } catch {}
  setTimeout(() => { try { C.logout(); } catch {} }, 1500);
}
const mine = () => Object.entries(D || {}).filter(([, v]) => v && !v.x).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.id === C.me) - (a.id === C.me) || Number(b.at || 0) - Number(a.at || 0));
const staff = () => (C.staffDevs() || []).slice().sort((a, b) => Number(b.seen || 0) - Number(a.seen || 0));
export function mdChipsHTML() {
  const m = D ? mine() : null, s = C ? staff() : [];
  const mo = m ? m.filter(x => live(x.at)).length : 0, so = s.filter(x => live(x.seen)).length;
  return `<button type="button" class="mkd-chip own" data-mkd-open="m">👑 Mere devices <i>${m ? m.length : '…'}</i>${mo ? `<em>🟢 ${mo}</em>` : ''}</button><button type="button" class="mkd-chip" data-mkd-open="s">👥 Mulazim ke devices <i>${s.length}</i>${so ? `<em>🟢 ${so}</em>` : ''}</button>`;
}
function chips() { const el = document.getElementById('mkdChips'); if (el) el.innerHTML = mdChipsHTML(); }
export const mdRepaint = () => { chips(); if (dlgEl()?.open) paint(true); };

const dlgEl = () => document.getElementById('mkdDlg');
function open(v) {
  V = v === 's' ? 's' : 'm'; Q = '';
  let d = dlgEl(); if (!d) { d = document.createElement('dialog'); d.id = 'mkdDlg'; d.className = 'mkd-dlg'; document.body.appendChild(d); d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
  paint(); if (!d.open) d.showModal();
}
function rowsHTML() {
  if (V === 'm') {
    if (!D) return '<p class="mkd-none">⏳ List aa rahi hai…</p>';
    const l = mine(); if (!l.length) return '<p class="mkd-none">Abhi koi device darj nahi — har malik wala phone / PC ek dafa app khole to yahan aa jayega.</p>';
    return l.map(x => { const me = x.id === C.me; return `<div class="mkd-row${me ? ' me' : ''}"><span class="mkd-ic">${uaIcon(x.ua)}</span><span class="mkd-tx"><b>${E(x.nm || uaName(x.ua))}${me ? ' <u>📍 Yehi</u>' : ''}${x.tab ? ' <u class="t">mulazim ke phone par</u>' : ''}</b><small>${live(x.at) ? '🟢 abhi chalu' : '⚪ ' + E(C.ago(x.at))} · ${E(x.id)}${x.nm ? ' · ' + E(uaName(x.ua)) : ''}</small></span><span class="mkd-bt"><button type="button" data-mkd-nm="${E(x.id)}" title="Naam">✏️</button>${me ? '' : `<button type="button" class="x" data-mkd-x="${E(x.id)}" title="Hatao">✕</button>`}</span></div>`; }).join('');
  }
  const q = Q.trim().toLowerCase(), l = staff().filter(x => !q || [x.name, x.dn, x.id].some(t => String(t || '').toLowerCase().includes(q)));
  if (!l.length) return `<p class="mkd-none">${q ? 'Koi device nahi mila.' : 'Kisi mulazim ka device jura hua nahi.'}</p>`;
  return l.map(x => `<div class="mkd-row"><span class="mkd-ic">${uaIcon(x.ua)}</span><span class="mkd-tx"><b>${E(x.name || 'Mulazim')}${x.dn ? ' <u class="t">' + E(x.dn) + '</u>' : ''}</b><small>${live(x.seen) ? '🟢 abhi chalu' : '⚪ ' + E(C.ago(x.seen))} · ${E(x.id)} · ${E(uaName(x.ua))}</small></span><span class="mkd-bt"><button type="button" class="x" data-mkd-sx="${E(x.id)}" title="Hatao">✕</button></span></div>`).join('');
}
function paint(listOnly) {
  const d = dlgEl(); if (!d) return;
  const body = d.querySelector('[data-mkd-list]');
  if (listOnly && body) { body.innerHTML = rowsHTML(); const tb = d.querySelector('[data-mkd-tabs]'); if (tb) tb.innerHTML = tabsHTML(); return; }
  d.innerHTML = `<div class="mkd-hd"><b>📱 Devices</b><button type="button" class="mkd-cl" data-mkd-close="1" aria-label="Band">✕</button></div>
   <div class="mkd-tabs" data-mkd-tabs>${tabsHTML()}</div>
   ${V === 's' ? `<label class="mkd-q"><span>🔍</span><input id="mkdQ" type="text" inputmode="search" autocomplete="off" placeholder="Naam ya ID…" value="${E(Q)}"></label>` : ''}
   <div class="mkd-list" data-mkd-list>${rowsHTML()}</div>
   <p class="mkd-ft">${V === 'm' ? '✕ = us device par app logout (band ho to agli dafa kholte hi). Jis ke paas aap ka login code / password ho wo dobara login kar sakta hai — pakka ilaaj code badalna.' : '✕ = wo phone foran band — dobara chalane ke liye phir se jorna hoga.'}</p>`;
}
function tabsHTML() { const m = D ? mine().length : '…', s = staff().length; return `<button type="button" class="${V === 'm' ? 'is-in' : ''}" data-mkd-open="m">👑 Mere <i>${m}</i></button><button type="button" class="${V === 's' ? 'is-in' : ''}" data-mkd-open="s">👥 Mulazim <i>${s}</i></button><span>📱 Kul ${D ? mine().length + s : s}</span>`; }
async function onClick(e) {
  const t = e.target.closest?.('[data-mkd-open],[data-mkd-close],[data-mkd-x],[data-mkd-nm],[data-mkd-sx]'); if (!t || !C) return;
  const d = t.dataset;
  if (d.mkdClose) { dlgEl()?.close(); return; }
  if (d.mkdOpen) { if (dlgEl()?.open) { V = d.mkdOpen === 's' ? 's' : 'm'; Q = ''; paint(); } else open(d.mkdOpen); return; }
  try {
    if (d.mkdNm) { const cur = D?.[d.mkdNm]; const nm = prompt('Is device ka naam (jaise: Mera OnePlus, Ghar ka laptop)', cur?.nm || ''); if (nm === null) return; await C.cloud.malikDevSet(d.mkdNm, { nm: String(nm).trim().slice(0, 30) }); C.notice('✅ Naam save'); return; }
    if (d.mkdX) { const cur = D?.[d.mkdX]; if (d.mkdX === C.me) return; if (!confirm((cur?.nm || uaName(cur?.ua)) + ' (' + d.mkdX + ') hatana hai?\n\nUs device par malik ka login khatam ho jayega.')) return; t.disabled = true; t.textContent = '⏳'; await C.cloud.malikDevSet(d.mkdX, { x: Date.now() }); C.notice('🗑 Device hata diya — wahan logout'); try { C.audit({ area: 'login', act: 'malik-device-remove', what: (cur?.nm || uaName(cur?.ua)) + ' · ' + d.mkdX }); } catch {} return; }
    if (d.mkdSx) { const dv = (C.staffDevs() || []).find(x => x.id === d.mkdSx); if (!confirm((dv?.name || 'Mulazim') + ' — ' + (dv?.dn || 'device') + ' (' + d.mkdSx + ') hatana hai?\n\nWo phone foran band ho jayega — dobara chalane ke liye phir se jorna hoga.')) return; t.disabled = true; t.textContent = '⏳'; await C.cloud.deleteStaffDevice(d.mkdSx, dv?.by); C.notice('🗑 Device hata diya — wo phone logout'); try { C.audit({ area: 'staff', act: 'device-delete', what: (dv?.name || '') + ' · ' + d.mkdSx }); } catch {} return; }
  } catch (er) { C.notice('❌ Nahi hua: ' + (er?.message || er)); if (dlgEl()?.open) paint(true); }
}
