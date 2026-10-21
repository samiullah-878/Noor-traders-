// =====================================================================================================
//  shell.js — v2.104.0 (20 Oct 2026): 🧭 NAYA DHANCHA (malik: "sab chips ek ⋮ ke andar · jo chip chunein us ki POORI screen, neeche na
//  jana pare · chip ko screen par bahar laa sakein jaise mobile ki app · jo chip dabayein wo upar us screen ke neeche aaye ·
//  likhai / headings ka size aur rang apni marzi · ek tap mein screen badalne wale chips saath rahein").
//
//  ⋮ (header) = sheet:  ⚠️ Aaj ki haalat (#homeBar ke chips — wahi data-hb handler)
//                       + IS SCREEN KE KAAM — DOM se:  [data-mn="key"]      button  → tile (asal button ka .click(), purane handler wahi)
//                                                     [data-mn-seg="key"]  options ka dabba (Aaj · 7 din …) → sheet mein chips
//                                                     [data-mn-box="key"]  hissa (jaise +% · mazdoori) → "focus": screen par SIRF wohi, ‹ se wapas
//                         saath: data-mn-i (icon) · data-mn-t (naam) · data-mn-s (chhoti line) · data-mn-g (group) · data-mn-n (ginti)
//                         phone (<1100px) par yeh sab screen se chhup jate hain (style.css "SHELL"), PC par pehle jaise + ⋮ bhi.
//                       + ⚙️ App (Settings · Sync · Backup · 🔠 Apni marzi · Rules · Upload)
//  📌 pin + haal hi mein istemal → #subBar (header mein, .app-nav ke neeche) — sirf us screen ke. Lamba dabao = hatao / pin.
//  🔠 Apni marzi: likhai size (main zoom) · headings size · likhai rang · headings rang — har phone (localStorage sam-marzi);
//     malik "👑 Sab mulazimon par" = blueAccess/look {marzi, mAt} (cloud.setMarzi). AI nahi.
// =====================================================================================================
import { recentList } from './recent.js?v=2.105.3';
import { agentRegister } from './agent.js?v=2.105.3';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cssq = s => String(s).replace(/["\\]/g, '\\$&');
const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const phone = () => !(window.matchMedia && window.matchMedia('(min-width:1100px)').matches);
let H = {};
const vw = () => { try { return String(H.view?.() || ''); } catch { return ''; } };
const scr = () => vw() + (H.selected?.() ? ':acct' : '');

// ---------------- yaad (har phone) ----------------
const LS = 'sam-mn';
const rd = () => { try { const o = JSON.parse(localStorage.getItem(LS) || '{}'); return o && typeof o === 'object' ? { pins: o.pins || {}, rec: o.rec || {}, hide: o.hide || {} } : { pins: {}, rec: {}, hide: {} }; } catch { return { pins: {}, rec: {}, hide: {} }; } };
const wr = o => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} };
function recPush(s, k) { const o = rd(); o.rec[s] = [k, ...(o.rec[s] || []).filter(x => x !== k)].slice(0, 6); if (o.hide[s]) o.hide[s] = o.hide[s].filter(x => x !== k); wr(o); }
function pinToggle(s, k, on) { const o = rd(); const P = (o.pins[s] || []).filter(x => x !== k); if (on ?? !(o.pins[s] || []).includes(k)) P.push(k); o.pins[s] = P.slice(-8); wr(o); }
const pinned = (s, k) => (rd().pins[s] || []).includes(k);

// ---------------- harvest: screen ke kaam DOM se ----------------
const ON = el => !!el && (el.classList.contains('on') || el.classList.contains('is-in') || el.classList.contains('selected') || el.getAttribute('aria-pressed') === 'true');
// v2.105.2: khirki (dialog) khuli ho to ⋮ usi ke kaam dikhata hai (#dialogBody ke data-mn tags) — malik: "koi bhi chips ka kaam ho andar rakho"
const dlgOn = () => !!$('dialog')?.open;
const mainEl = () => document.querySelector('main');
const scopeEl = () => dlgOn() ? $('dialogBody') : mainEl();
function items(rootEl = scopeEl()) {
  const root = rootEl; if (!root) return [];
  const out = [], seen = new Set();
  for (const el of root.querySelectorAll('[data-mn],[data-mn-seg],[data-mn-box]')) {
    const type = el.hasAttribute('data-mn-box') ? 'box' : el.hasAttribute('data-mn-seg') ? 'seg' : 'btn';
    const k = el.getAttribute(type === 'box' ? 'data-mn-box' : type === 'seg' ? 'data-mn-seg' : 'data-mn');
    if (!k || seen.has(k)) continue; if (el.closest('[hidden]') || (type === 'btn' && el.disabled)) continue;
    seen.add(k);
    const d = el.dataset, t = clean(d.mnT || (type === 'btn' ? el.textContent : '')) || k;
    const it = { k, type, el, i: d.mnI || '', t, s: d.mnS || '', g: d.mnG || '', n: d.mnN || '', on: type === 'btn' ? ON(el) : type === 'box' ? (root.id === 'dialogBody' ? dShow.has(k) : document.body.dataset.mnf === k) : false };
    if (type === 'seg') it.opts = [...el.querySelectorAll('button')].filter(b => !b.hidden && !b.disabled).map((b, i) => ({ i, t: clean(b.textContent), on: ON(b) }));
    out.push(it);
  }
  if (root === mainEl()) out.unshift(...ftItems(seen));   // neeche wale kaam sab se upar (roz ke)
  return out;
}
const find = k => items().find(x => x.k === k);

// v2.105.2: malik (Daily Sale / HBL ke screenshot) — "ye neeche wali chips 3 dot mein aa jaye": phone par neeche ki patti (#actions) ke kaam ⋮ mein.
//   Screen par neeche sirf asal bara button: Khata "＋ Naya account" · Purchase "＋ Purchase" · Transfer "➕ Naya transfer note" · khate ke andar
//   "Saman diya / Paisa wasool kiya" · POS Purchase ke apne button. Baqi screens (FT_MOVE) ki patti chhupi, button wahi (⋮ se .click()).
const FT_MOVE = new Set(['daily', 'hbl', 'expenses', 'cash', 'dasti', 'due', 'notes', 'galla', 'factory', 'irep', 'larka', 'barcode', 'history', 'chart', 'gaari', 'nazar']);
const ftMove = () => phone() && !H.selected?.() && FT_MOVE.has(vw());
const EMO = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D|\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*(.*)$/u;
function ftItems(seen) {
  const a = $('actions'); if (!a || !ftMove()) return [];
  return [...a.querySelectorAll('button')].map((b, i) => {
    const k = 'ft.' + i; if (b.hidden || b.disabled || b.closest('[hidden]') || seen.has(k)) return null; seen.add(k);
    let txt = clean(b.textContent), ic = '';
    if (/^[＋+]\s*/.test(txt)) { ic = '➕'; txt = txt.replace(/^[＋+]\s*/, ''); }
    const m = txt.match(EMO); if (m) { ic = ic || m[1]; txt = m[2] || txt; }
    if (!ic) ic = /chart/i.test(txt) ? '📊' : /diya|payment/i.test(txt) ? '💸' : /daily/i.test(txt) ? '🧾' : /reminder/i.test(txt) ? '🔔' : /dasti/i.test(txt) ? '💼' : /account/i.test(txt) ? '👤' : '⚡';
    return { k, type: 'btn', el: b, i: ic, t: txt, s: '', g: '⬇️ Neeche wale kaam', n: '', on: ON(b) };
  }).filter(Boolean);
}
function ftPaint() { const on = ftMove(); if ((document.documentElement.dataset.ftmn === '1') !== on) { if (on) document.documentElement.dataset.ftmn = '1'; else delete document.documentElement.dataset.ftmn; } }

// ---------------- sheet ----------------
let root = null;
function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.createElement('div'); root.id = 'mnRoot'; root.hidden = true;
  root.innerHTML = '<div class="mn-dim" data-mn-x="1"></div><div class="mn-sheet" role="dialog" aria-modal="true"><div class="mn-hdl" data-mn-x="1"></div><button type="button" class="mn-close" data-mn-x="1" aria-label="Band">✕</button><div class="mn-body" id="mnBody"></div></div>';
  document.body.appendChild(root); return root;
}
const isOpen = () => !!root && !root.hidden;
function place() { const host = dlgOn() ? $('dialog') : document.body; if (root.parentNode !== host) host.appendChild(root); }   // khirki top-layer mein hoti hai — sheet usi ke andar warna peeche reh jaye
function close() { if (root) { root.hidden = true; document.documentElement.classList.remove('mn-open'); } }
function haalatHTML() {
  const bar = $('homeBar'); if (!bar || bar.hidden) return '';
  const ch = bar.querySelector('.hchips')?.innerHTML || '', nr = clean(bar.querySelector('.hnarr')?.textContent || '');
  if (!ch && !nr) return '';
  return `<div class="mn-gh">⚠️ Aaj ki haalat</div><div class="mn-hb hchips">${ch}</div>${nr ? `<p class="mn-nr">${esc(nr)}</p>` : ''}`;
}
// v2.105.2: "🔒 Din band karein" ka bara patta phone par screen se hata — jahan "Aaj ki haalat" nahi (khate ke andar, Gaari, Galla…) wahan ⋮ mein
function dinHTML() { const b = $('dayLockBtn'); if (!b || b.hidden || b.disabled || haalatHTML()) return ''; return `<div class="mn-gh">🌙 Din</div><div class="mn-app"><button type="button" data-mn-day="1">${esc(clean(b.textContent))}</button></div>`; }
function appHTML() {
  const A = [['set', '⚙️', 'Settings'], ['sync', '↻', 'Sync / Update'], ['backup', '💾', 'Backup'], ['marzi', '🔠', 'Apni marzi']];
  if ($('rulesBtn') && !$('rulesBtn').hidden) A.push(['rules', '🔐', 'Rules']);
  if ($('repoLink')) A.push(['repo', '⇪', 'Upload']);
  return `<div class="mn-gh">⚙️ App</div><div class="mn-app">${A.map(([k, i, t]) => `<button type="button" data-mn-app="${k}">${i} ${t}</button>`).join('')}</div>`;
}
function tileHTML(x, s, noPin) {
  const pin = !noPin && pinned(s, x.k);
  return `<button type="button" class="mn-tile${x.on ? ' is-in' : ''}${noPin ? ' np' : ''}" data-mn-go="${esc(x.k)}"><i>${esc(x.i || '•')}</i><span><b>${esc(x.t)}</b>${x.s ? `<small>${esc(x.s)}</small>` : ''}</span>${x.n && x.n !== '0' ? `<em class="mn-n">${esc(x.n)}</em>` : ''}${noPin ? '' : `<span class="mn-pin${pin ? ' is-in' : ''}" data-mn-pin="${esc(x.k)}" role="button" aria-label="${pin ? 'Screen se hatao' : 'Screen par lagao'}" title="${pin ? 'Screen se hatao' : 'Screen par lagao'}">📌</span>`}</button>`;
}
function segHTML(x) {
  return `<div class="mn-seg"><small>${esc(x.i)} ${esc(x.t)}</small><div>${x.opts.map(o => `<button type="button" class="${o.on ? 'is-in' : ''}" data-mn-opt="${esc(x.k)}|${o.i}">${esc(o.t)}</button>`).join('')}</div></div>`;
}
function bodyHTML() {
  const dlg = dlgOn(), s = scr(), L = items(), title = clean((dlg ? $('dialogTitle') : $('title'))?.textContent || 'Screen');
  const groups = new Map(); for (const x of L) { const g = x.g || (x.type === 'seg' ? '🔎 Dikhao' : '🧰 Kaam'); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); }
  const G = [...groups].map(([g, xs]) => { const segs = xs.filter(x => x.type === 'seg'), tiles = xs.filter(x => x.type !== 'seg');
    return `<div class="mn-gh">${esc(g)}</div>${segs.map(segHTML).join('')}${tiles.length ? `<div class="mn-grid">${tiles.map(x => tileHTML(x, s, dlg)).join('')}</div>` : ''}`; }).join('');
  if (dlg) return `<h3 class="mn-h">${esc(title)}</h3><p class="mn-sub">Is khirki ke chips aur kaam — chunein, khirki wahi rahegi</p>${G}`;
  return `<h3 class="mn-h">${esc(title)} — kya karna hai?</h3><p class="mn-sub">${L.length ? 'Jo chunein wohi poori screen par · 📌 = screen par bahar' : 'Is screen ke kaam jald yahan aayenge'}</p>${haalatHTML()}${dinHTML()}${G}${appHTML()}`;
}
function open() { ensureRoot(); place(); $('mnBody').innerHTML = bodyHTML(); root.hidden = false; document.documentElement.classList.add('mn-open'); }
function repaintOpen() { if (isOpen()) { const b = $('mnBody'), y = b?.scrollTop || 0; b.innerHTML = bodyHTML(); b.scrollTop = y; } }

// ---------------- khirki ka box (v2.105.2): ⋮ se chuna → khirki mein wahin khul jaye (khirki band hone tak) ----------------
const dShow = new Set(); let dStyle = null;
function dPaint() { if (!dStyle) { dStyle = document.createElement('style'); dStyle.id = 'mnDlgCss'; document.head.appendChild(dStyle); }
  dStyle.textContent = [...dShow].map(k => `html body #dialog #dialogBody [data-mn-box="${cssq(k)}"][data-mn-box]:not([data-mn-keep]){display:block!important}`).join('\n'); }
function dShowBox(k) { dShow.add(k); dPaint(); const x = find(k); if (!x) return; try { if (x.el.tagName === 'DETAILS' && !x.el.open) x.el.open = true; } catch {} setTimeout(() => { try { x.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {} }, 60); }
function dReset() { if (!dShow.size) return; dShow.clear(); dPaint(); }

// ---------------- focus (box = poori screen) ----------------
let F = '', styleEl = null;
function focusCss(k) {
  const q = `[data-mn-box="${cssq(k)}"]`;
  return `body.mnf main ${q}{display:block!important}
body.mnf main > :not(header):not(:has(${q})){display:none!important}
body.mnf main > header > :not(.top):not(:has(${q})):not(${q}){display:none!important}
body.mnf main :has(${q}) > :not(${q}):not(:has(${q})):not(.top):not(#mnfBar){display:none!important}`;
}
function focus(k) {
  const x = find(k); if (!x || x.type !== 'box') return false;
  F = k; document.body.dataset.mnf = k; document.body.classList.add('mnf');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'mnfCss'; document.head.appendChild(styleEl); }
  styleEl.textContent = focusCss(k);
  const t = $('title'); if (t) t.dataset.mnfT = (x.i ? x.i + ' ' : '') + x.t;
  fbar(x); recPush(scr(), k); paintSub(); try { window.scrollTo({ top: 0 }); } catch {}
  return true;
}
function unfocus() { if (!F) return; F = ''; delete document.body.dataset.mnf; document.body.classList.remove('mnf'); if (styleEl) styleEl.textContent = ''; const t = $('title'); if (t) delete t.dataset.mnfT; $('mnfBar')?.remove(); paintSub(); }
function fbar(x) {   // focus ke upar chhoti patti: "‹ wapas" — header ka ‹ bhi kaam karta hai
  let b = $('mnfBar'); if (!b) { b = document.createElement('div'); b.id = 'mnfBar'; b.className = 'mnf-bar'; }
  if (b.nextElementSibling !== x.el) x.el.parentNode.insertBefore(b, x.el);
  const h = `<button type="button" data-mn-unfocus="1">‹ Wapas</button><b>${esc(x.i)} ${esc(x.t)}</b>`; if (b.innerHTML !== h) b.innerHTML = h;
}

// ---------------- 📌 / haal hi: #subBar ----------------
function subItems() {
  const s = scr(), o = rd(), L = items(mainEl()), by = new Map(L.map(x => [x.k, x])), hide = new Set(o.hide[s] || []);
  const out = [], seen = new Set();
  for (const k of o.pins[s] || []) { const x = by.get(k); if (x && x.type !== 'seg' && !seen.has(k)) { seen.add(k); out.push({ ...x, pin: true }); } }
  for (const k of o.rec[s] || []) { const x = by.get(k); if (x && x.type !== 'seg' && !seen.has(k) && !hide.has(k)) { seen.add(k); out.push(x); } }
  // recent.js ki khirkiyan (stock windows / khate) — isi screen ki
  const v = vw(); let R = []; try { R = recentList() || []; } catch {}
  for (const r of R) { const o2 = r.open || {}; const mine = (o2.kind === 'stock' || o2.kind === 'tolai') ? (v === 'stock' || v === 'transfer') : (o2.kind === 'route' && o2.v === 'khata' && o2.id) ? (v === 'khata' && !H.selected?.()) : false;
    if (mine && !hide.has('r:' + r.key)) out.push({ k: 'r:' + r.key, rk: r.key, i: r.icon, t: r.label }); }
  return out.slice(0, 9);
}
let lastSub = '';
function paintSub() {
  const nav = document.querySelector('.app-nav'); if (!nav) return;
  let bar = $('subBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'subBar'; bar.className = 'sub-bar'; (($('recentBar') && $('recentBar').parentNode === nav.parentNode) ? $('recentBar') : nav).after(bar); }
  const L = subItems();
  const h = L.length ? L.map(x => x.rk ? `<button type="button" class="sb-c" data-recent="${esc(x.rk)}" data-sb-k="${esc(x.k)}">${esc(x.i)} ${esc(x.t)}</button>`
    : `<button type="button" class="sb-c${x.pin ? ' pin' : ''}${(x.type === 'box' ? F === x.k : x.on) ? ' is-in' : ''}" data-mn-go="${esc(x.k)}" data-sb-k="${esc(x.k)}">${x.pin ? '<span class="sb-p">📌</span>' : ''}${esc(x.i)} ${esc(x.t)}${x.n && x.n !== '0' ? `<em>${esc(x.n)}</em>` : ''}</button>`).join('') : '';
  if (h === lastSub && bar.hidden === !L.length) return; lastSub = h;
  bar.hidden = !L.length; bar.innerHTML = h;
}
// lamba dabao → chhota menu
let lpT = 0, lpFired = false;
function lpMenu(btn) {
  const k = btn.dataset.sbK, s = scr(), isPin = pinned(s, k), isRec = String(k).startsWith('r:') || !isPin;
  let m = $('sbMenu'); if (!m) { m = document.createElement('div'); m.id = 'sbMenu'; m.className = 'sb-menu'; document.body.appendChild(m); }
  m.innerHTML = `${!String(k).startsWith('r:') ? `<button type="button" data-sb-act="pin|${esc(k)}">📌 ${isPin ? 'Screen se hatao' : 'Screen par pakka lagao'}</button>` : ''}${isRec ? `<button type="button" data-sb-act="hide|${esc(k)}">✕ Is patti se hatao</button>` : ''}${isPin ? `<button type="button" data-sb-act="left|${esc(k)}">◀ Aage karo</button>` : ''}<button type="button" data-sb-act="x|">Band</button>`;
  const r = btn.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(window.innerWidth - 220, r.left)) + 'px'; m.style.top = (r.bottom + 6) + 'px'; m.hidden = false;
}
document.addEventListener('pointerdown', e => { const b = e.target.closest?.('#subBar .sb-c'); if (!b) return; lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; lpMenu(b); }, 550); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) document.addEventListener(ev, () => clearTimeout(lpT));
document.addEventListener('contextmenu', e => { const b = e.target.closest?.('#subBar .sb-c'); if (b) { e.preventDefault(); lpFired = true; lpMenu(b); } });

// ---------------- clicks ----------------
function go(k) {
  const x = find(k); if (!x) { H.notice?.('Yeh kaam abhi is screen par nahi'); return; }
  close();
  if (dlgOn()) { if (x.type === 'box') dShowBox(k); else try { x.el.click(); } catch (er) { console.warn('mn go', er); } return; }
  if (x.type === 'box') { focus(k); return; }
  if (F) unfocus();
  recPush(scr(), k); paintSub();
  try { x.el.click(); } catch (er) { console.warn('mn go', er); }
}
document.addEventListener('click', e => {
  const t = e.target;
  if (lpFired && t.closest?.('#subBar')) { lpFired = false; e.preventDefault(); e.stopPropagation(); return; }
  const sm = t.closest?.('[data-sb-act]');
  if (sm) { const [a, k] = sm.dataset.sbAct.split('|'), s = scr(), m = $('sbMenu'); if (m) m.hidden = true;
    if (a === 'pin') pinToggle(s, k); else if (a === 'hide') { const o = rd(); o.hide[s] = [...new Set([...(o.hide[s] || []), k])].slice(-20); o.rec[s] = (o.rec[s] || []).filter(x => x !== k); wr(o); }
    else if (a === 'left') { const o = rd(); const P = o.pins[s] || [], i = P.indexOf(k); if (i > 0) { P.splice(i, 1); P.splice(i - 1, 0, k); o.pins[s] = P; wr(o); } }
    lastSub = ''; paintSub(); return; }
  if (!t.closest?.('#sbMenu')) { const m = $('sbMenu'); if (m && !m.hidden) m.hidden = true; }
  if (t.closest?.('[data-mn-unfocus]')) { unfocus(); return; }
  const pin = t.closest?.('[data-mn-pin]');
  if (pin && t.closest('#mnRoot')) { e.preventDefault(); e.stopPropagation(); const k = pin.dataset.mnPin, on = !pinned(scr(), k); pinToggle(scr(), k, on); H.notice?.(on ? '📌 Screen par lag gaya — upar chhota chip' : 'Screen se hata diya'); lastSub = ''; paintSub(); repaintOpen(); return; }
  const g = t.closest?.('[data-mn-go]'); if (g) { e.preventDefault(); go(g.dataset.mnGo); return; }
  const op = t.closest?.('[data-mn-opt]');
  if (op) { const [k, i] = op.dataset.mnOpt.split('|'), x = find(k); close(); const b = x?.type === 'seg' ? [...x.el.querySelectorAll('button')].filter(b2 => !b2.hidden && !b2.disabled)[Number(i)] : null; try { b?.click(); } catch {} return; }
  const ob = t.closest?.('[data-mn-open]'); if (ob) { focus(ob.dataset.mnOpen); return; }
  if (t.closest?.('[data-mn-day]')) { close(); $('dayLockBtn')?.click(); return; }
  const ap = t.closest?.('[data-mn-app]');
  if (ap) { const k = ap.dataset.mnApp; close();
    if (k === 'set') { try { H.openSettings?.(); } catch (er) { console.warn(er); } }
    else if (k === 'sync') document.querySelector('button.sync')?.click();
    else if (k === 'backup') $('dailyBackupButton')?.click();
    else if (k === 'marzi') marziOpen();
    else if (k === 'rules') $('rulesBtn')?.click();
    else if (k === 'repo') $('repoLink')?.click();
    return; }
  if (t.closest?.('[data-mn-x]')) { close(); return; }
  if (t.closest?.('[data-mn-sheet]')) { e.preventDefault(); open(); return; }   // screen ki "📅 Aaj · 🔎 Sab — ⋮ se badlein" patti
  if (t.closest?.('#mnRoot .mn-hb [data-hb]')) { setTimeout(close, 0); }   // haalat chip: app.js ka handler chale, sheet band
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) close(); });

// ---------------- ⋮ par ginti (haalat) ----------------
function paintBadge() {
  const st = $('settings'); if (!st) return; const bar = $('homeBar');
  const n = bar && !bar.hidden ? bar.querySelectorAll('.hchip.warn,.hchip.bad,.hchip.hot').length : 0;
  let b = st.querySelector('.mn-badge'); if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('span'); b.className = 'mn-badge'; st.appendChild(b); } b.textContent = n > 9 ? '9+' : String(n);
}

// ---------------- 🔠 apni marzi (poori app — har screen + khirki) ----------------
// v2.105.0 (malik: "chips big / small ka option · fonts colours sab poori app ke liye"): + 🔘 chips Chhote / Bare (data-chip) ·
//   🔤 font (data-ff + --font) · andheri look ke apne halke rang (txd / hxd — look badle to khud sahi rang) · 📊 card · 🧭 screen chips.
const ML = 'sam-marzi';
const FS = [['s', 'Chhota'], ['m', 'Aam'], ['l', 'Bara'], ['xl', 'Bohat bara']], HS = [['s', 'Chhoti'], ['m', 'Aam'], ['l', 'Bari'], ['xl', 'Bohat bari']];
const TX = ['', '#10192b', '#1d3466', '#0f5132', '#7c2d12', '#4c1d95', '#000000'], HX = ['', '#10192b', '#1d3466', '#b45309', '#15803d', '#b91c1c', '#6d28d9'];
const TXD = ['', '#ffffff', '#e8eeff', '#bfe3ff', '#c8f7d8', '#ffe6a8', '#ffd0dc'], HXD = ['', '#ffffff', '#8fd8ff', '#ffd27a', '#7cf0b5', '#ff9fb5', '#c9b5ff'];
const HR = [['', 'Chhota'], ['big', 'Bara']], NV = [['', '☰ se (chhupe)'], ['all', 'Hamesha dikhao']], CH = [['', 'Chhote'], ['big', 'Bare']];
const FF = [['', 'Look jaisa'], ['poppins', 'Poppins'], ['sora', 'Sora'], ['outfit', 'Outfit'], ['jakarta', 'Jakarta'], ['arial', 'Saada']];
const FFN = { poppins: "'Poppins'", sora: "'Sora'", outfit: "'Outfit'", jakarta: "'Plus Jakarta Sans'", arial: 'Arial' };
const HEX = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));
const mGet = () => { try { const o = JSON.parse(localStorage.getItem(ML) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
const isDk = () => document.documentElement.classList.contains('dk');
function mApply(m = mGet()) {
  const h = document.documentElement, dk = isDk();
  for (const [k, a] of [['fs', 'fs'], ['hs', 'hs']]) { const v = m[k]; if (v && v !== 'm' && ['s', 'l', 'xl'].includes(v)) h.dataset[a] = v; else delete h.dataset[a]; }
  const tx = dk ? m.txd : m.tx, hx = dk ? m.hxd : m.hx;   // andheri look = apne halke rang
  if (HEX(tx)) { h.dataset.tx = '1'; h.style.setProperty('--mn-tx', tx); } else { delete h.dataset.tx; h.style.removeProperty('--mn-tx'); }
  if (HEX(hx)) { h.dataset.hx = '1'; h.style.setProperty('--mn-hx', hx); } else { delete h.dataset.hx; h.style.removeProperty('--mn-hx'); }
  if (m.hero === 'big') h.dataset.hero = 'big'; else delete h.dataset.hero;
  if (m.nav === 'all') h.dataset.nav = 'all'; else delete h.dataset.nav;
  if (m.chip === 'big') h.dataset.chip = 'big'; else delete h.dataset.chip;
  if (FFN[m.ff]) { h.dataset.ff = m.ff; h.style.setProperty('--font', FFN[m.ff]); h.style.setProperty('--mn-ff', FFN[m.ff]); } else { delete h.dataset.ff; h.style.removeProperty('--font'); h.style.removeProperty('--mn-ff'); }
}
function mSet(patch, at = Date.now()) { const m = { ...mGet(), ...patch, at }; try { localStorage.setItem(ML, JSON.stringify(m)); } catch {} mApply(m); return m; }
const mPack = m => ({ fs: m.fs || 'm', hs: m.hs || 'm', tx: m.tx || '', hx: m.hx || '', txd: m.txd || '', hxd: m.hxd || '', hero: m.hero === 'big' ? 'big' : '', nav: m.nav === 'all' ? 'all' : '', chip: m.chip === 'big' ? 'big' : '', ff: FFN[m.ff] ? m.ff : '' });
export function marziCloud(mz, mAt) {   // app.js listenLook se — malik ne "sab par" lagaya ho to (naya ho tab)
  if (!mz || typeof mz !== 'object' || !(Number(mAt) > 0)) return; if (Number(mAt) <= (Number(mGet().at) || 0)) return;
  mSet(mPack(mz), Number(mAt));
}
function marziHTML() {
  const m = mGet(), dk = isDk();
  const chips = (L, k, cur) => L.map(([v, t]) => `<button type="button" class="${(cur || 'm') === v ? 'is-in' : ''}" data-mz="${k}|${v}">${t}</button>`).join('');
  const opt = (L, k, cur) => L.map(([v, t]) => `<button type="button" class="${(cur || '') === v ? 'is-in' : ''}" data-mz="${k}|${v}">${t}</button>`).join('');
  const sw = (L, k, cur) => L.map(c => `<button type="button" class="mz-sw${(cur || '') === c ? ' is-in' : ''}" data-mz="${k}|${c}" style="${c ? `--sw:${c}` : ''}" aria-label="${c || 'pehle jaisa'}">${c ? '' : '↺'}</button>`).join('');
  return `<h3 class="mn-h">🔠 Apni marzi — poori app</h3><p class="mn-sub">Sirf is phone par · har screen aur khirki par · foran lagta hai</p>
  <div class="mn-gh">🔠 Likhai ka size</div><div class="mz-row">${chips(FS, 'fs', m.fs)}</div>
  <div class="mn-gh">🔡 Headings (naam / sar-khi) ka size</div><div class="mz-row">${chips(HS, 'hs', m.hs)}</div>
  <div class="mn-gh">🔘 Chips (Aaj · 7 din · Godam…) ka size</div><div class="mz-row">${opt(CH, 'chip', m.chip)}</div>
  <div class="mn-gh">📊 Upar ka card (Purchase, Khata, Daily…)</div><div class="mz-row">${opt(HR, 'hero', m.hero)}</div>
  <div class="mn-gh">🧭 Screen chips (Khata, Purchase…)</div><div class="mz-row">${opt(NV, 'nav', m.nav)}</div>
  <div class="mn-gh">🔤 Font (likhai ki shakal)</div><div class="mz-row mz-ff">${FF.map(([v, t]) => `<button type="button" class="${(m.ff || '') === v ? 'is-in' : ''}" data-mz="ff|${v}" style="${FFN[v] ? `font-family:${FFN[v]},sans-serif` : ''}">${t}</button>`).join('')}</div>
  <div class="mn-gh">🖍 Likhai ka rang ${dk ? '(🌙 andheri look)' : ''}</div><div class="mz-row">${dk ? sw(TXD, 'txd', m.txd) : sw(TX, 'tx', m.tx)}</div>
  <div class="mn-gh">🎯 Headings ka rang ${dk ? '(🌙 andheri look)' : ''}</div><div class="mz-row">${dk ? sw(HXD, 'hxd', m.hxd) : sw(HX, 'hx', m.hx)}</div>
  <div class="mz-prev"><b class="mz-ph">Arman palydar</b><span>Lene hain Rs 13,000 · aaj</span><div class="mz-pc"><button type="button" class="is-in">Aaj</button><button type="button">7 din</button><button type="button">Godam 1</button></div><small>↑ aisa nazar aayega</small></div>
  <div class="mn-app"><button type="button" data-mz="reset|1">↺ Pehle jaisa</button>${H.owner?.() ? '<button type="button" class="mz-all" data-mz="all|1">👑 Sab mulazimon par bhi</button>' : ''}</div>`;
}
function marziOpen() { ensureRoot(); place(); $('mnBody').innerHTML = marziHTML(); root.hidden = false; document.documentElement.classList.add('mn-open'); }
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-mz]'); if (!b) return; const [k, v] = b.dataset.mz.split('|');
  if (k === 'reset') { mSet({ fs: 'm', hs: 'm', tx: '', hx: '', txd: '', hxd: '', hero: '', nav: '', chip: '', ff: '' }); }
  else if (k === 'all') { const m = mGet(); if (!H.cloud?.setMarzi) { H.notice?.('App update karein'); return; } H.cloud.setMarzi(mPack(m)).then(() => H.notice?.('👑 Sab mulazimon ke phone par bhi lag jayega')).catch(er => H.notice?.('Nahi hua: ' + (er?.message || er))); return; }
  else mSet({ [k]: v });
  if (isOpen()) $('mnBody').innerHTML = marziHTML();
});
// look (roshan ⇄ andheri) badle to sahi rang khud
try { new MutationObserver(() => mApply()).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch {}
document.addEventListener('click', e => { if (e.target.closest?.('#marziBtn')) { try { $('dialog')?.close(); } catch {} marziOpen(); } });

// ---------------- ☰ screen chips (v2.105.0 — malik: "chips oper top par chhote · screen ke andar chhupe rahein · upar baayein se khulein") ----------------
const navOpen = () => document.documentElement.classList.contains('nav-open');
function navSet(on) { document.documentElement.classList.toggle('nav-open', !!on); paintNavBtn(); }
function navBtnSetup() {
  const top = document.querySelector('main>header .top'); if (!top || $('navBtn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'navBtn'; b.className = 'round nav-btn'; b.setAttribute('aria-label', 'Screens badlein'); b.title = 'Screens badlein'; b.textContent = '☰';
  top.insertBefore(b, top.firstChild);
  b.addEventListener('click', () => navSet(!navOpen()));
  document.querySelector('.app-nav')?.addEventListener('click', e => { if (e.target.closest?.('button')) setTimeout(() => navSet(false), 0); });
}
function paintNavBtn() {
  const b = $('navBtn'); if (!b) return;
  const L = [...document.querySelectorAll('.app-nav button')].filter(x => !x.hidden && x.id !== 'navAll');
  b.hidden = L.length < 2; b.classList.toggle('is-in', navOpen());
  let n = 0; for (const x of L) if (x.classList.contains('has-count')) n += Number(x.dataset.count) || 0;
  let s = b.querySelector('.mn-badge');
  if (!n || navOpen()) { s?.remove(); return; }
  if (!s) { s = document.createElement('span'); s.className = 'mn-badge'; b.appendChild(s); } s.textContent = n > 99 ? '99+' : String(n);
}
// ---------------- setup ----------------
let moT = 0;
const later = () => { clearTimeout(moT); moT = setTimeout(() => { shellRoute(); if (F) { const x = items(mainEl()).find(y => y.k === F); if (!x) unfocus(); else fbar(x); } repaintOpen(); }, 120); };
export function shellRoute() { const v = scr(); if (shellRoute.v !== v) { shellRoute.v = v; if (F) unfocus(); lastSub = ''; if (navOpen()) navSet(false); } ftPaint(); paintSub(); paintBadge(); paintNavBtn(); }
// v2.105.1: malik — "screen side par na khiske, fix rahe" (phone). Poori screen / khirki (#dialogBody, main, list) ka daayein-baayein
//   khisakna hamesha 0 par wapas — chahe focus / scrollIntoView ne khiskaya ho. Chips ki qatar aur tables apni jagah khiskti rehti hain.
function lockX() {
  if (lockX.on) return; lockX.on = 1;
  document.addEventListener('scroll', e => {
    if (innerWidth >= 1100) return;
    const t = e.target;
    if (t === document || t === document.documentElement || t === document.body) { if (window.scrollX) window.scrollTo(0, window.scrollY); return; }
    if (t && t.nodeType === 1 && t.scrollLeft && (t.id === 'dialogBody' || t.id === 'dialog' || t.matches('main,.workspace,#list,#summary,.mn-body'))) t.scrollLeft = 0;
  }, { capture: true, passive: true });
}
// v2.105.2: khirki ke upar ⋮ (× ke saath) — sirf phone par aur jab khirki mein data-mn tags hon
function dlgBtnSetup() {
  const d = $('dialog'), head = d?.querySelector('.dialog-head'), body = $('dialogBody'); if (!head || !body || $('dlgMn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'dlgMn'; b.className = 'dlg-mn'; b.textContent = '⋮'; b.hidden = true;
  b.setAttribute('aria-label', 'Is khirki ke chips aur kaam'); b.title = 'Is khirki ke chips aur kaam';
  head.insertBefore(b, $('close') || null);
  b.addEventListener('click', e => { e.preventDefault(); open(); });
  const upd = () => { const on = dlgOn(); const n = on ? items(body).length : 0; if (b.hidden !== !n) b.hidden = !n; };
  let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(() => { upd(); if (isOpen() && root?.parentNode === d) repaintOpen(); }, 120); };
  new MutationObserver(soon).observe(body, { childList: true, subtree: true });
  new MutationObserver(() => { if (!dlgOn()) { if (root?.parentNode === d) close(); dReset(); } soon(); }).observe(d, { attributes: true, attributeFilter: ['open'] });
  d.addEventListener('close', () => { if (root?.parentNode === d) close(); dReset(); upd(); });
  let lastT = ''; new MutationObserver(() => { const tt = $('dialogTitle')?.textContent || ''; if (tt !== lastT) { lastT = tt; dReset(); } soon(); }).observe($('dialogTitle') || d, { childList: true, characterData: true, subtree: true });   // nayi khirki = purane khule box band
}
export function shellSetup(h = {}) {
  H = h; mApply(); navBtnSetup(); lockX(); dlgBtnSetup();
  const st = $('settings');
  if (st && !st.dataset.mn0) { st.dataset.mn0 = '1'; const old = st.onclick; H.openSettings = H.openSettings || (() => old?.call(st)); st.onclick = () => { if (isOpen()) close(); else open(); }; st.setAttribute('aria-label', 'Is screen ke kaam'); st.title = 'Is screen ke kaam'; }
  // header ka ‹ — focus ho to pehle focus se wapas
  $('back')?.addEventListener('click', e => { if (F) { e.preventDefault(); e.stopImmediatePropagation(); unfocus(); } }, true);
  const mo = new MutationObserver(later); for (const id of ['summary', 'list', 'actions', 'homeBar']) if ($(id)) mo.observe($(id), { childList: true, subtree: id === 'homeBar' || id === 'actions' });
  window.ntShellRoute = shellRoute; window.ntShellOpen = open; window.ntShellFocus = focus;
  shellRoute();
}
mApply();   // pehli paint se pehle (flash nahi)

// ---------------- 🤖 Agent ----------------
const S_ = { type: 'STRING' }, B_ = { type: 'BOOLEAN' }, O_ = (p, r = []) => ({ type: 'OBJECT', properties: p, required: r });
const fold = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pick = q => { const f = fold(q), L = items().filter(x => x.type !== 'seg'); return L.find(x => fold(x.t) === f) || L.find(x => fold(x.t).includes(f) || f.includes(fold(x.t))) || L.find(x => fold(x.k).includes(f)); };
agentRegister([
  { name: 'screen_kaam_list', read: true, desc: 'Abhi khuli screen ke ⋮ (teen nuqte) wale saare kaam / dabbe ki fehrist.', params: O_({}),
    summary: () => '⋮ ke kaam', run() { return { screen: clean($('title')?.textContent || ''), kaam: items().map(x => ({ naam: x.t, kism: x.type, ginti: x.n || undefined, pin: pinned(scr(), x.k) })) }; } },
  { name: 'screen_kaam_kholo', desc: 'Abhi khuli screen ke ⋮ mein se koi kaam kholo (jaise "Aaj ke bill", "% Mazdoori", "Milao").', params: O_({ kaam: S_ }, ['kaam']),
    summary: a => `⋮ → ${a.kaam}`, run({ kaam }) { const x = pick(kaam); if (!x) throw Error('Is screen par yeh kaam nahi: ' + kaam); go(x.k); return '✓ ' + x.t + ' khul gaya'; } },
  { name: 'chip_pin', desc: 'Screen ke ⋮ wale kaam ko screen par chhota chip bana kar lagao (pin=true) ya hatao (pin=false) — mobile app jaisa.', params: O_({ kaam: S_, pin: B_ }, ['kaam']),
    summary: a => `📌 ${a.kaam} ${a.pin === false ? 'hatao' : 'lagao'}`, run({ kaam, pin = true }) { const x = pick(kaam); if (!x) throw Error('Is screen par yeh kaam nahi: ' + kaam); pinToggle(scr(), x.k, pin !== false); lastSub = ''; paintSub(); return pin === false ? '✓ Hata diya' : '✓ Screen par lag gaya'; } },
  { name: 'likhai_marzi', desc: 'Is phone par likhai ka size (Chhota/Aam/Bara/Bohat bara), headings ka size, likhai ka rang, headings ka rang (hex jaise #1d3466; khali = pehle jaisa), upar ka card (Chhota/Bara), screen chips (chhupe/hamesha), chips (Chhote/Bare), font (Poppins/Sora/Outfit/Jakarta/Saada).', params: O_({ size: S_, heading: S_, rang: S_, heading_rang: S_, card: S_, screen_chips: S_, chips: S_, font: S_ }),
    summary: a => '🔠 ' + Object.entries(a).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + ' ' + v).join(' · '),
    run(a) { const lv = (v, L) => { const f = fold(v); const hit = L.find(([k, t]) => fold(t) === f || k === f); return hit ? hit[0] : null; }; const p = {};
      if (a.size) { const v = lv(a.size, FS); if (!v) throw Error('Size: Chhota / Aam / Bara / Bohat bara'); p.fs = v; }
      if (a.heading) { const v = lv(a.heading, HS); if (!v) throw Error('Heading: Chhoti / Aam / Bari / Bohat bari'); p.hs = v; }
      for (const [k, kk] of [['rang', isDk() ? 'txd' : 'tx'], ['heading_rang', isDk() ? 'hxd' : 'hx']]) if (a[k] != null) { const v = String(a[k]).trim(); if (v && !/^#[0-9a-f]{6}$/i.test(v)) throw Error('Rang hex mein (#1d3466)'); p[kk] = v; }
      if (a.card) { const f = fold(a.card); p.hero = /bar|big/.test(f) ? 'big' : ''; }
      if (a.chips) { const f = fold(a.chips); p.chip = /bar|big/.test(f) ? 'big' : ''; }
      if (a.font) { const f = fold(a.font); const hit = FF.find(([k, t]) => k && (f.includes(k) || f.includes(fold(t)))); p.ff = hit ? hit[0] : ''; }
      if (a.screen_chips) { const f = fold(a.screen_chips); p.nav = /hamesha|all|dikha/.test(f) ? 'all' : ''; }
      if (!Object.keys(p).length) throw Error('Kya badalna hai?'); mSet(p); return '✓ Lag gaya'; } },
]);
