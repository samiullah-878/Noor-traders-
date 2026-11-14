// wa-learn.js — v2.181.0: 📒 NAAM SEEKHO (WhatsApp Parchi Sale ⋮, sirf malik)
//   Malik: "jin items ka naam nahi mil raha wo alehda aik khane mein daalte jao — jab time mila hum wo names AI ko yaad karwa dein ge · aur wo pattern bhi —
//          agli dafa yaad hua naam aur parchi ka naam (jis ki AI ko samajh nahi aayi) ikattha chhap sake · shak ki gunjaish kam ho jaye".
//   Khana: pichhle 30 din ki parchiyon (parchiOrders.j) ki ❓ lines (item nahi mila ya s < 0.5) — ek jaisa lafz (lkey) EK qatar (×N parchi).
//   Tap item = blueAccess/waLearn.m[key] {r gahak ka lafz, it AI ka parha, id, n, at, by} → PC wa-parchi v1.6: agli parchi mein wohi lafz = pakka item
//   (thermal par gahak ke lafz ke neeche ">> yaad: <item>"), AI ko bhi yaad ke lafz. ✕ Chhoro = sk[key]. 🧠 Yaad tab = ghalat yaad hatao.
//   Data attr SIRF `data-wl-*`, root `[data-wl-root]` (khirki ke andar). AI app mein NAHI. Agent action NAHI.
import { saleStock } from './pos-stock.js?v=2.279.1';
import { smartSearch } from './smart-search.js?v=2.279.1';

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMF = new Intl.NumberFormat('en-PK');
const num = n => NUMF.format(Math.round((Number(n) || 0) * 1000) / 1000);
const dayStr = (off = 0) => { const d = new Date(Date.now() + off * 864e5), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const ago = t => { const m = Math.round((Date.now() - (Number(t) || 0)) / 60000); return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' ghante' : Math.round(m / 1440) + ' din'; };

// ---- lafz ki ek shakal (PC wa-parchi lkey jaisa — tadad / unit / harakat / harf ke roop hata kar) ----
const UNITS = 'kg kgs kilo kilos kilogram kilograms کلو کلوگرام g gm gms gram grams gr گرام l ltr ltrs liter liters litre litres لیٹر ml ملی pc pcs piece pieces nos adad dana daney dane عدد دانے دانہ پیس packet packets pkt pkts پیکٹ pack packs dozen dz dzn darjan درجن bag bags thaila thaile thela thele bori bora تھیلا تھیلے تھیلی بوری بورا bottle bottles btl botal بوتل box boxes dabba dabbe dibba ڈبہ ڈبے ڈبی carton cartons ctn peti پیٹی کارٹن tin tins ٹین roll rolls رول bar bars tikki ٹکی sachet sachets jar jars pouch pouches litre';
const DROP = new Set([...UNITS.split(' '), 'x', 'aadha', 'adha', 'pao', 'pau', 'paao', 'derh', 'dedh', 'dhai', 'آدھا', 'پاؤ', 'ڈیڑھ', 'ڈھائی', 'wala', 'wali', 'wale', 'والا', 'والی', 'والے']);
const isNumTok = t => /^[\d۰-۹٠-٩.,/½¼¾]+$/.test(t) || /^\d+(?:\.\d+)?[a-z]{1,3}$/i.test(t);
export function lkey(s) {
  const t = String(s || '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u06EA-\u06ED]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ةهۀ]/g, 'ہ').replace(/ؤ/g, 'و')
    .replace(/[\d۰-۹٠-٩]+(?:[.,/][\d۰-۹٠-٩]+)?/g, ' ').replace(/[^\p{L}\s]/gu, ' ');
  return t.split(/\s+/).filter(w => w && !DROP.has(w) && !isNumTok(w)).join(' ').trim().slice(0, 80);
}
const hash = s => { let x = 2166136261; for (const ch of String(s)) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; } return x.toString(36); };
export const wlKey = r => { const k = lkey(r); return k ? 'k' + hash(k) : ''; };

let C = null, L = null, un = null, data = null, loading = false, tab = 'q', open = '', shown = 20;
const qv = new Map(), busy = new Set(), imgC = new Map(), cropC = new Map();
export function wlSetup(o) { C = o; }
const owner = () => !!C?.owner?.();
const root = () => document.querySelector('#dialog[open] #dialogBody [data-wl-root]');
function watch() {
  if (un || !C?.cloud?.listenWaLearn || !owner()) return;
  un = C.cloud.listenWaLearn((d, e) => { if (e) { L = L || { err: 1 }; } else L = d || {}; paint(); });
}
const M = () => (L && L.m) || {}, SK = () => (L && L.sk) || {};
// ❓ baqi: yaad / chhori nahi — zyada parchiyon wala pehle
export const wlRows = () => !data?.g ? [] : [...data.g.values()].filter(e => !M()[e.k] && !SK()[e.k]).sort((a, b) => (b.n - a.n) || (b.at - a.at));
export const wlCount = () => (data?.g ? wlRows().length : null);
// parchiOrders → ❓ lines ka khana (hatai hui parchi chhor kar)
export function wlBuild(list) {
  const g = new Map();
  for (const o of list || []) {
    if (!o || /^x:/.test(String(o.st || ''))) continue;
    let J = []; try { J = JSON.parse(o.j || '[]'); } catch {} if (!Array.isArray(J)) continue;
    J.forEach(x => {
      if (!x || typeof x !== 'object') return;
      const s = x.s == null ? 1 : Number(x.s) || 0; if (x.id && s >= 0.5) return;
      const r = String(x.r || x.it || '').replace(/\s+/g, ' ').trim(), k = wlKey(r); if (!k) return;
      let e = g.get(k);
      if (!e) { e = { k, r, it: String(x.it || ''), sug: x.id && x.n ? { id: String(x.id), n: String(x.n) } : null, n: 0, at: 0, ex: [] }; g.set(k, e); }
      e.n++; const at = Number(o.at) || 0; if (at > e.at) e.at = at;
      if (e.ex.length < 2 && Array.isArray(x.b) && x.b.length === 4) e.ex.push({ o: o.id, b: x.b.map(Number) });
      if (!e.it && x.it) e.it = String(x.it); if (!e.sug && x.id && x.n) e.sug = { id: String(x.id), n: String(x.n) };
    });
  }
  return { g, at: Date.now(), n: (list || []).length };
}
async function load(force) {
  if (loading || (data && !data.err && !force)) return;
  if (!C?.cloud?.getParchiOrdersDays) { data = { err: 'App purani — Update karein' }; paint(); return; }
  loading = true; paint();
  try { const list = await C.cloud.getParchiOrdersDays(Array.from({ length: 30 }, (_, i) => dayStr(-i))); data = wlBuild(list); shown = 20; }
  catch (e) { data = { err: (e && (e.code || e.message)) || 'nahi aaya' }; }
  finally { loading = false; paint(); }
}
function stock() {   // wa-sale stock() jaisa — dukan (branch 1) ke items, band nahi
  const s = saleStock(), base = (s.branches || []).includes(1) ? 1 : (s.branches || [])[0];
  return { ...s, base, items: base == null ? [] : s.itemsFor(base).filter(r => !s.hidden?.[String(r.id)]) };
}
function itemAny(id) {
  const s = stock(), k = String(id), a = s.items.find(r => String(r.id) === k); if (a) return a;
  for (const b of s.branches || []) { if (b === s.base) continue; const x = s.itemsFor(b).find(r => String(r.id) === k); if (x) return x; }
  return null;
}
// ---- likhai ka tukda (parchiImg + AI box) ----
const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(Error('x')); im.src = src; });
function cropOf(im, b) {
  const W = im.naturalWidth || 1, H = im.naturalHeight || 1;
  let [y0, x0, y1, x1] = b.map(v => Math.max(0, Math.min(1000, Number(v) || 0))); if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 < x0) [x0, x1] = [x1, x0];
  const bh = y1 - y0, bw = x1 - x0;
  y0 = Math.max(0, y0 - bh * 0.35 - 6); y1 = Math.min(1000, y1 + bh * 0.35 + 6); x0 = Math.max(0, x0 - bw * 0.06 - 8); x1 = Math.min(1000, x1 + bw * 0.06 + 8);
  const sx = x0 / 1000 * W, sy = y0 / 1000 * H, sw = Math.max(4, (x1 - x0) / 1000 * W), sh = Math.max(4, (y1 - y0) / 1000 * H);
  const k = Math.min(1, 520 / sw, 150 / sh), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.8);
}
const imgOf = id => { if (!imgC.has(id)) { imgC.set(id, (C?.cloud?.getParchiImg ? C.cloud.getParchiImg(id) : Promise.resolve('')).catch(() => '')); while (imgC.size > 6) imgC.delete(imgC.keys().next().value); } return imgC.get(id); };
let cropBusy = false;
async function paintCrops() {
  if (cropBusy) return; const R = root(); if (!R) return;
  const need = [...R.querySelectorAll('[data-wl-crop]')].map(el => el.dataset.wlCrop).filter(k => !cropC.has(k)).slice(0, 8);
  if (!need.length) return; cropBusy = true;
  try {
    for (const k of need) {
      const e = data?.g?.get(k), x = e && e.ex[0]; if (!x) { cropC.set(k, ''); continue; }
      let v = ''; try { const src = await imgOf(x.o); if (src) v = cropOf(await loadImg(src), x.b); } catch {}
      cropC.set(k, v); const el = root()?.querySelector(`[data-wl-crop="${k}"]`); if (el) el.innerHTML = v ? `<img src="${v}" alt="">` : '📄';
    }
  } finally { cropBusy = false; if (need.length === 8) setTimeout(paintCrops, 50); }   // agle 8 (ek waqt chhota kaam)
}
// ---- khirki ----
function hitsHTML(e) {
  const q = String(qv.get(e.k) ?? e.it ?? '').trim();
  const s = stock(), L0 = q ? smartSearch(s.items, q, 8) : [];
  const sug = e.sug && itemAny(e.sug.id) ? `<button type="button" class="wl-h wl-sug" data-wl-pick="${esc(e.k)}|${esc(e.sug.id)}">✓ ${esc(e.sug.n)}<small>AI ka andaza</small></button>` : '';
  const hs = L0.filter(r => !e.sug || String(r.id) !== e.sug.id).slice(0, 6).map(r => `<button type="button" class="wl-h" data-wl-pick="${esc(e.k)}|${esc(r.id)}">${esc(r.name)}<small>R ${num(r.rate2 || r.rate)} · stock ${num(r.stock)}</small></button>`).join('');
  return sug + hs || `<small class="wl-mut">${q ? 'Kuch nahi mila — naam badal kar likhein' : 'Item ka naam likhein'}</small>`;
}
function rowHTML(e) {
  const isO = open === e.k, crop = cropC.get(e.k);
  const pic = e.ex.length ? `<span class="wl-crop" data-wl-crop="${esc(e.k)}">${crop ? `<img src="${esc(crop)}" alt="">` : crop === '' ? '📄' : '⏳'}</span>` : '';
  const sub = [e.it && e.it !== e.r ? 'AI: ' + esc(e.it) : '', e.n > 1 ? `<b>×${e.n} parchi</b>` : '', esc(ago(e.at)) + ' pehle'].filter(Boolean).join(' · ');
  return `<div class="wl-r${isO ? ' is-in' : ''}${busy.has(e.k) ? ' wl-busy' : ''}" data-wl-row="${esc(e.k)}">
    <div class="wl-r1" data-wl-tap="${esc(e.k)}">${pic}<span class="wl-t"><b dir="auto">${esc(e.r)}</b><small>${sub}</small></span><button type="button" class="wl-x" data-wl-skip="${esc(e.k)}" title="Chhoro — list se hata do" aria-label="Chhoro">✕</button></div>
    ${isO ? `<label class="wl-ql"><input type="search" data-wl-q="${esc(e.k)}" value="${esc(qv.get(e.k) ?? e.it ?? '')}" placeholder="🔍 sahi item ka naam" autocomplete="off" enterkeyhint="done"></label><div class="wl-hits" data-wl-hits="${esc(e.k)}">${hitsHTML(e)}</div>` : ''}
  </div>`;
}
function bodyHTML() {
  if (!owner()) return '<p class="wl-mut">📒 Naam seekho sirf malik ke liye.</p>';
  const m = Object.entries(M()).sort((a, b) => (Number(b[1]?.at) || 0) - (Number(a[1]?.at) || 0)), sk = Object.entries(SK()).sort((a, b) => (Number(b[1]?.at) || 0) - (Number(a[1]?.at) || 0));
  const R = wlRows(), cnt = data?.g ? R.length : '…';
  const T = (k, lab) => `<button type="button" class="wl-tab${tab === k ? ' is-in' : ''}" data-wl-tab="${k}">${lab}</button>`;
  let h = `<div class="wl-tabs">${T('q', '❓ Baqi ' + cnt)}${T('y', '🧠 Yaad ' + m.length)}${sk.length ? T('s', '✕ Chhori ' + sk.length) : ''}<button type="button" class="wl-tab wl-rf" data-wl-reload="1" title="Dobara dekho">🔄</button></div>`;
  if (L && L.err) h += '<p class="wl-err">⚠️ Yaad ki list nahi parh saka (internet?) — dobara kholein.</p>';
  if (tab === 'y') {
    h += m.length ? `<p class="wl-mut">Agli parchi mein yeh lafz aaye to PC isi item se milata hai aur thermal par saath naam chhapta hai. Ghalat ho to ✕.</p><div class="wl-list">${m.map(([k, v]) => `<div class="wl-y"><span class="wl-t"><b dir="auto">${esc(v?.r || '')}</b><small>🧠 ${esc(v?.n || '')}${v?.at ? ' · ' + esc(ago(v.at)) + ' pehle' : ''}</small></span><button type="button" class="wl-x" data-wl-forget="${esc(k)}" title="Yaad se hatao" aria-label="Hatao">✕</button></div>`).join('')}</div>`
      : '<p class="wl-mut">Abhi kuch yaad nahi — ❓ Baqi mein lafz par tap kar ke sahi item chunein.</p>';
    return h;
  }
  if (tab === 's') {
    h += sk.length ? `<div class="wl-list">${sk.map(([k, v]) => `<div class="wl-y"><span class="wl-t"><b dir="auto">${esc(v?.r || k)}</b><small>chhora ${v?.at ? esc(ago(v.at)) + ' pehle' : ''}</small></span><button type="button" class="wl-back" data-wl-unskip="${esc(k)}">↩ Wapas</button></div>`).join('')}</div>` : '<p class="wl-mut">Koi chhora hua lafz nahi.</p>';
    return h;
  }
  if (loading && !data) return h + '<p class="wl-mut">⏳ Pichhle 30 din ki parchiyan dekh raha hoon…</p>';
  if (data?.err) return h + `<p class="wl-err">✕ Parchiyan nahi aayin: ${esc(data.err)} — 🔄 dabayein.</p>`;
  if (!data) return h + '<p class="wl-mut">⏳</p>';
  if (!R.length) return h + `<p class="wl-ok">✓ Pichhle 30 din (${num(data.n)} parchi) ki sab lines ka naam mil gaya ya yaad hai.</p>`;
  h += `<p class="wl-mut">Lafz par tap → sahi item chunein = 🧠 yaad. ${num(data.n)} parchi · 30 din.</p><div class="wl-list">${R.slice(0, shown).map(rowHTML).join('')}</div>`;
  if (R.length > shown) h += `<button type="button" class="wl-more" data-wl-more="1">Aur ${Math.min(20, R.length - shown)} dikhao (${R.length - shown} baqi)</button>`;
  return h;
}
function paint() { const R = root(); if (!R) return; const y = R.parentElement?.scrollTop; R.innerHTML = bodyHTML(); if (y != null && R.parentElement) R.parentElement.scrollTop = y; paintCrops(); }
function hitsPaint(k) { const el = root()?.querySelector(`[data-wl-hits="${CSS.escape(k)}"]`), e = data?.g?.get(k); if (el && e) el.innerHTML = hitsHTML(e); }
export function wlOpen() {
  if (!C?.modal) return;
  if (!owner()) { C.notice?.('📒 Naam seekho sirf malik'); return; }
  watch(); tab = 'q'; open = '';
  C.modal('📒 Naam seekho', '<div data-wl-root="1"></div>', true);
  paint(); load(false);
}
async function learn(k, id) {
  const e = data?.g?.get(k), it = itemAny(id); if (!e) return;
  if (!it) { C.notice('Yeh item stock list mein nahi (band?) — doosra chunein'); return; }
  const val = { r: e.r.slice(0, 120), it: String(e.it || '').slice(0, 80), id: String(it.id), n: String(it.name).slice(0, 100), at: Date.now(), by: String(C.uid?.() || '') };
  L = L || {}; L.m = { ...M(), [k]: val }; busy.add(k); open = ''; paint();   // foran list se hata (pehle UI)
  C.notice(`⏳ Yaad ho raha hai: ${e.r} → ${it.name}`);
  try { await C.cloud.saveWaLearn('m', k, val); C.notice(`🧠 Yaad ho gaya: ${e.r} = ${it.name} — agli parchi se pakka`); }
  catch (er) { const m = { ...M() }; delete m[k]; L.m = m; C.notice('✕ Yaad nahi hua: ' + (er?.code || er?.message || er)); }
  finally { busy.delete(k); paint(); }
}
async function setSk(k, val, msg) {
  L = L || {}; const sk = { ...SK() }; if (val) sk[k] = val; else delete sk[k]; L.sk = sk; paint();
  try { await C.cloud.saveWaLearn('sk', k, val); C.notice(msg); } catch (er) { C.notice('✕ Nahi hua: ' + (er?.code || er?.message || er)); }
}
async function forget(k) {
  const v = M()[k]; if (!v || !confirm(`"${v.r}" ki yaad (${v.n}) hata dein?`)) return;
  const m = { ...M() }; delete m[k]; L.m = m; paint();
  try { await C.cloud.saveWaLearn('m', k, null); C.notice('✓ Yaad se hata diya'); } catch (er) { L.m = { ...M(), [k]: v }; paint(); C.notice('✕ Nahi hata: ' + (er?.code || er?.message || er)); }
}
document.addEventListener('click', e => {
  const t = e.target; if (!t?.closest || !t.closest('#dialogBody [data-wl-root]')) return;
  const b = t.closest('[data-wl-tab],[data-wl-reload],[data-wl-tap],[data-wl-skip],[data-wl-pick],[data-wl-forget],[data-wl-unskip],[data-wl-more]'); if (!b) return;
  const d = b.dataset;
  if (d.wlSkip) { e.stopPropagation(); const x = data?.g?.get(d.wlSkip); setSk(d.wlSkip, { r: (x?.r || '').slice(0, 120), at: Date.now() }, '✕ Chhor diya — "✕ Chhori" tab se ↩ wapas'); return; }
  if (d.wlTab) { tab = d.wlTab; paint(); return; }
  if (d.wlReload) { load(true); return; }
  if (d.wlMore) { shown += 20; paint(); return; }
  if (d.wlPick) { const [k, id] = d.wlPick.split('|'); learn(k, id); return; }
  if (d.wlForget) { forget(d.wlForget); return; }
  if (d.wlUnskip) { setSk(d.wlUnskip, null, '↩ Wapas ❓ Baqi mein'); return; }
  if (d.wlTap) { open = open === d.wlTap ? '' : d.wlTap; paint(); if (open) setTimeout(() => { const q = root()?.querySelector(`[data-wl-q="${CSS.escape(open)}"]`); if (q) { q.focus(); try { q.select(); } catch {} } }, 30); }
});
document.addEventListener('input', e => {
  const t = e.target; if (!t?.matches?.('#dialogBody [data-wl-root] [data-wl-q]')) return;
  qv.set(t.dataset.wlQ, t.value); hitsPaint(t.dataset.wlQ);
});
document.addEventListener('keydown', e => {
  const t = e.target; if (e.key !== 'Enter' || !t?.matches?.('#dialogBody [data-wl-root] [data-wl-q]')) return;
  e.preventDefault(); root()?.querySelector(`[data-wl-hits="${CSS.escape(t.dataset.wlQ)}"] [data-wl-pick]`)?.click();
}, true);
