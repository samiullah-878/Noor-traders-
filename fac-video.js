// fac-video.js — v2.327.0 (19 Nov 2026): 🎬 FACTORY VIDEO — tasveer lagao (🤖 AI crop pehle se) → Urdu awaaz ke saath HD video → kholo + bhejo
//   Malik: "factory ki all items ka video · subah pictures upload karta hoon · aik screen — pictures lagayein, AI ka crop pehle se laga ho ·
//   HD pictures, baqi wo khud kaam kar le · upar bolne wala bhi · yeh sab tum khud handle karo".
//   Data WAHI (naya data model nahi): tasveer = factory/phIdx + ph_<id>_<v>_<i> (fac-photo.js saveHd / hdOf, HD 2048) ·
//   awaaz = factory/vq_<k>_… (malik maange {st new} → PC wa-parchi/fac-voice.js Microsoft Edge ki muft Urdu awaaz mp3 {st ok, b, ur}) —
//   tasveer lagte hi awaaz pehle se maangi jati hai (raat ko PC band ho tab bhi video awaaz ke saath) · phone mein IndexedDB 'sam-fac-vc'.
//   Video PHONE par banti hai (canvas 1080×1920 + WebAudio → MediaRecorder; MP4 jahan phone de, warna WebM) — PC ki zaroorat nahi.
//   AI: SIRF crop ka dabba (Gemini box_2d, malik ✅ Save se pehle dekhta hai). Awaaz / video mein AI nahi. Gaana nahi (copyright).
//   Khareed rate / nafa KABHI nahi — sirf Parchoon ya Wholesale (⋮ se) ya rate band.
const $ = id => document.getElementById(id);
let C = null, S = null;
const LSK = 'sam-fac-video';
const pref = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch {} return { vo: v.vo === 'f' ? 'f' : 'm', rate: ['r', 'w', '0'].includes(v.rate) ? v.rate : 'r', per: [0, 10, 20].includes(v.per) ? v.per : 0, sel: Array.isArray(v.sel) ? v.sel.map(String) : null }; })();
const keepPref = () => { try { localStorage.setItem(LSK, JSON.stringify(pref)); } catch {} };
const E = s => (C ? C.esc(s) : String(s ?? ''));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShort = t => { const d = new Date(Number(t) || Date.now()); return d.getDate() + ' ' + MON[d.getMonth()]; };
const sameDay = (a, b) => { const x = new Date(Number(a) || 0), y = new Date(Number(b) || 0); return x.toDateString() === y.toDateString(); };
const toBlob = (cv, type, q) => new Promise((ok, no) => { try { cv.toBlob(b => b ? ok(b) : no(Error('Tasveer nahi bani')), type, q); } catch (e) { no(e); } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const withT = (p, ms, msg) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(Error(msg)), ms); })]).finally(() => clearTimeout(t)); };
const title = () => String(C.cat().title || 'ADREES SOAP FACTORY').trim() || 'ADREES SOAP FACTORY';
const RATE_T = { r: 'Parchoon', w: 'Wholesale', '0': 'Rate nahi' };
const rateOf = it => { if (!it || pref.rate === '0') return 0; const R = C.rates(it) || {}; return Math.round(Number(pref.rate === 'w' ? R.wpcs : R.rpcs) || 0); };
const hasPh = id => !!C.idx()[String(id)]?.v;
const items = () => (C.sell() || []).filter(Boolean);

// ---------- 🔊 awaaz (factory/vq_*) ----------
const VSIG = 'v1';
const safe = s => String(s).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
const vq = {
  n: it => { const id = String(it.id), nm = String(it.name || '').trim(); return { doc: `vq_n_${safe(id)}_${pref.vo}`, sig: `n|${id}|${nm}|${VSIG}`, body: { k: 'n', id, nm, vo: pref.vo } }; },
  r: rs => ({ doc: `vq_r_${rs}_${pref.vo}`, sig: `r|${rs}|${VSIG}`, body: { k: 'r', rs, vo: pref.vo } }),
  i: () => { const tl = title(); return { doc: `vq_i_${pref.vo}`, sig: `i|${tl}|${VSIG}`, body: { k: 'i', tl, vo: pref.vo } }; },
  o: () => ({ doc: `vq_o_${pref.vo}`, sig: `o|${VSIG}`, body: { k: 'o', vo: pref.vo } }),
};
let vdbP = null;
const vdb = () => vdbP || (vdbP = new Promise(ok => { try { const r = indexedDB.open('sam-fac-vc', 1); r.onupgradeneeded = () => r.result.createObjectStore('a'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); } }));
async function vcGet(k) { const db = await vdb(); if (!db) return null; return new Promise(ok => { try { const q = db.transaction('a').objectStore('a').get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch { ok(null); } }); }
async function vcPut(k, v) { const db = await vdb(); if (!db) return; try { db.transaction('a', 'readwrite').objectStore('a').put(v, k); } catch {} }
const VOK = new Set();   // jin docs ki awaaz phone mein hai (list par 🔊)
async function vGet(R, ask, reErr) {   // -> {b, ur} | null (na ho to PC se maango)
  const c = await vcGet(R.doc); if (c && c.sig === R.sig && c.b) { VOK.add(R.doc); return c; }
  let d = null; try { d = await C.cloud.facVoiceGet(R.doc); } catch {}
  if (d && d.sig === R.sig && d.st === 'ok' && d.b) { const v = { sig: R.sig, b: d.b, ur: String(d.ur || '') }; vcPut(R.doc, v); VOK.add(R.doc); return v; }
  if (d && d.sig === R.sig && d.st === 'new' && Date.now() - (Number(d.at) || 0) < 15 * 60000) return null;   // PC bana raha hai
  if (d && d.sig === R.sig && d.st === 'err' && !reErr && Date.now() - (Number(d.doneAt) || 0) < 30 * 60000) return null;
  if (ask) { try { await C.cloud.facVoiceAsk(R.doc, { ...R.body, sig: R.sig }); } catch {} }
  return null;
}
async function pool(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; try { await fn(list[k], k); } catch {} } })); }
function needOf(list) {   // video / pehle se ke liye awaaz ki fehrist (rate ek jaisa = ek hi awaaz)
  const out = [vq.i(), vq.o()], rs = new Set();
  for (const it of list) { out.push(vq.n(it)); const r = rateOf(it); if (r > 0 && !rs.has(r)) { rs.add(r); out.push(vq.r(r)); } }
  return out;
}
let preT = 0;
function prefetch(list) {   // khamosh — tasveer wale items ki awaaz PC se pehle hi bana kar rakh lo
  clearTimeout(preT); preT = setTimeout(async () => { const st = S; if (!st || !C?.own) return; await pool(needOf(list), 4, R => vGet(R, true)); if (S === st && st.view === 'list') paintSoft(); }, 400);
}

// ---------- 🖼 khirki ----------
export function open(ctx) {
  C = ctx; const all = items();
  let sel = pref.sel ? new Set(pref.sel.filter(id => all.some(x => String(x.id) === id))) : null;
  if (!sel || !sel.size) sel = new Set(all.filter(x => hasPh(x.id)).map(x => String(x.id)));
  S = { view: 'list', q: '', sel, crop: null, outs: [], mk: null, ur: {}, pick: '' };
  C.dlg('🎬 Factory video', `<div class="fv-root" id="fvRoot"></div><input type="file" accept="image/*" hidden id="fvFile">`);
  const d = $('dialog'); if (d && !d._fv) { d._fv = 1; d.addEventListener('close', onClose); }
  $('fvFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) gotFile(f); };
  try { const st = S; let un = null, done = false; un = C.cloud.listenUrdu?.(m => { if (S === st) { st.ur = m || {}; if (st.view === 'list') paintSoft(); } done = true; if (un) { try { un(); } catch {} } }); if (done && un) { try { un(); } catch {} } } catch {}
  paint(); prefetch(all.filter(x => hasPh(x.id)));
}
function onClose() {   // ‹ / × = ek qadam (crop / nateeja → list); video ban rahi ho to rok do
  const d = $('dialog'); if (!S || !$('fvRoot')) return;
  if (S.view === 'make') { if (S.mk) S.mk.stop = 'close'; S = null; return; }
  if (S.view === 'crop' || S.view === 'done') { try { d.showModal(); } catch { return; } toList(); return; }
  S = null;
}
function toList() { if (S?.crop?.url) { try { URL.revokeObjectURL(S.crop.url); } catch {} } if (S) { S.crop = null; S.view = 'list'; } paint(); }
const paint = () => { const r = $('fvRoot'); if (!r || !S) return; r.innerHTML = S.view === 'crop' ? cropHTML() : S.view === 'make' ? makeHTML() : S.view === 'done' ? doneHTML() : listHTML(); r.dataset.v = S.view; if (S.view === 'crop') cropReady(); if (S.view === 'make') mkMount(); };
function paintSoft() {   // list dobara — search mein likhai / scroll na toote
  const r = $('fvRoot'); if (!r || !S || S.view !== 'list') return; const sc = r.closest('#dialogBody')?.scrollTop || 0, q = $('fvQ'), f = document.activeElement === q, pos = f ? q.selectionStart : 0;
  r.innerHTML = listHTML(); const b = r.closest('#dialogBody'); if (b) b.scrollTop = sc; if (f) { const n = $('fvQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
}
function listHTML() {
  const all = items(), idx = C.idx(), now = Date.now(); const rows = S.q ? C.srch(all, S.q, 300) : all;
  const nPh = all.filter(x => hasPh(x.id)).length, inV = all.filter(x => hasPh(x.id) && S.sel.has(String(x.id))), next = all.find(x => !hasPh(x.id));
  const segs = (k, i, t, opts) => `<div class="fv-seg" data-mn-seg="fv.${k}" data-mn-i="${i}" data-mn-t="${t}" data-mn-g="🎬 Video">${opts.map(([v, l]) => `<button type="button" class="${String(pref[k]) === String(v) ? 'is-in' : ''}" data-fv-p="${k}|${v}">${l}</button>`).join('')}</div>`;
  const row = it => { const id = String(it.id), m = idx[id], ph = !!m?.v, on = ph && S.sel.has(id), th = ph ? C.thumb(id) : '', r = rateOf(it), sz = C.size(id), vk = VOK.has(vq.n(it).doc);
    return `<div class="fv-r${ph ? '' : ' no'}${next && String(next.id) === id ? ' is-next' : ''}" data-fv-row="${E(id)}">
      ${ph ? `<button type="button" class="fv-ck${on ? ' is-in' : ''}" data-fv-ck="${E(id)}" aria-label="Video mein">${on ? '✓' : ''}</button>` : '<span class="fv-ck off"></span>'}
      <button type="button" class="fv-th" data-fv-ph="${E(id)}" aria-label="Tasveer">${th ? `<img src="${E(th)}" alt="" loading="lazy">` : '📷'}</button>
      <span class="fv-nm"><b>${E(it.name)}</b><small>${[sz ? E(sz) : '', r ? 'Rs ' + C.num(r) : '', vk ? '🔊' : '', S.ur[id] ? `<i class="fv-ur">${E(S.ur[id])}</i>` : ''].filter(Boolean).join(' · ')}</small></span>
      <button type="button" class="fv-st${ph ? ' ok' : ''}" data-fv-ph="${E(id)}">${ph ? (sameDay(m.at, now) ? '✅ Aaj' : '✅ ' + dShort(m.at)) : '📷 Lagao'}</button></div>`; };
  return `<div class="fv-top"><label class="fv-q"><span>⌕</span><input id="fvQ" type="search" placeholder="Item dhoondein" value="${E(S.q)}" autocomplete="off"></label></div>
    <button type="button" class="fv-pat" data-mn-sheet="1">🎬 <b>${inV.length}</b> video mein · ${pref.vo === 'f' ? '👩' : '👨'} awaaz · 💰 ${RATE_T[pref.rate]}${pref.per ? ` · ${pref.per}-${pref.per}` : ''} — ⋮ se badlein</button>
    <div class="fv-mn">${segs('vo', '🔊', 'Awaaz', [['m', '👨 Mard'], ['f', '👩 Aurat']])}${segs('rate', '💰', 'Video par rate', [['r', 'Parchoon'], ['w', 'Wholesale'], ['0', 'Rate nahi']])}${segs('per', '🎞', 'Ek video mein items', [[0, 'Sab'], [10, '10-10'], [20, '20-20']])}
      <button type="button" data-mn="fv.all" data-mn-i="☑" data-mn-t="Sab tasveer wale video mein" data-mn-g="☑ Items" data-fv-a="all">☑ Sab</button>
      <button type="button" data-mn="fv.today" data-mn-i="🆕" data-mn-t="Sirf aaj ki tasveer wale" data-mn-g="☑ Items" data-fv-a="today">🆕 Aaj ke</button>
      <button type="button" data-mn="fv.none" data-mn-i="☐" data-mn-t="Sab hatao" data-mn-g="☑ Items" data-fv-a="none">☐ Koi nahi</button></div>
    <div class="fv-sum"><span class="fv-k ok">✅ ${nPh} tasveer</span>${all.length - nPh ? `<span class="fv-k">⏳ ${all.length - nPh} baqi</span>` : ''}<span class="fv-k">☑ ${inV.length}/${nPh}</span></div>
    <div class="fv-list">${rows.length ? rows.map(row).join('') : '<p class="fv-empty">Koi factory item nahi mila</p>'}</div>
    <div class="fv-foot">${S.outs.length ? `<button type="button" class="fv-x" data-fv-a="outs">▶ Bani video (${S.outs.length})</button>` : ''}${next ? `<button type="button" class="fv-x" data-fv-ph="${E(next.id)}">📷 Agla: ${E(String(next.name).slice(0, 22))}</button>` : ''}<button type="button" class="fv-main" data-fv-a="make"${inV.length ? '' : ' disabled'}>🎬 Video banao (${inV.length})</button></div>`;
}

// ---------- ✂️ tasveer + 🤖 AI crop (Online Dukan wala qaida) ----------
async function decode(file) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {} const url = URL.createObjectURL(file); try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 8000); } }
async function gotFile(f) {
  if (!S) return; const id = S.pick; if (!id) return;
  if (!/^image\//.test(f.type || 'image/')) { C.notice('Yeh tasveer nahi'); return; }
  let bm; try { bm = await decode(f); } catch { C.notice('❌ Tasveer khul nahi saki'); return; }
  const w = bm.width || bm.naturalWidth, h = bm.height || bm.naturalHeight; if (!w || !h) { C.notice('❌ Tasveer khul nahi saki'); return; }
  S.crop = { id, bm, w, h, url: URL.createObjectURL(f), box: { x: w * 0.06, y: h * 0.06, w: w * 0.88, h: h * 0.88 }, ai: null, touch: 0, busy: '' };
  S.view = 'crop'; paint(); acRun();
}
const AC_PROMPT = 'This photo was taken by a shopkeeper to show ONE retail product (a packet, box, bottle, jar, pouch, soap bar, tin, sachet strip or bag). It may lie on a table, stand on a shelf or be held in a hand, and other things may be visible around it. Return the tight bounding box of the MAIN product only: the single item the photo is about (the largest / most central one). If the photo shows a neat stack or pile of the same product, box the whole stack. Do NOT include the table, hand, background or neighbouring products. Answer ONLY with JSON like {"box_2d":[ymin,xmin,ymax,xmax]} using numbers 0-1000 (normalized to image height and width). If no product is visible answer {"box_2d":null}.';
function acBox(out, K) {
  const re = /box_2d"?\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g; let m, best = null;
  while ((m = re.exec(String(out || '')))) {
    let [y0, x0, y1, x1] = m.slice(1, 5).map(Number); if (![y0, x0, y1, x1].every(Number.isFinite)) continue;
    [y0, x0, y1, x1] = [y0, x0, y1, x1].map(v => Math.max(0, Math.min(1000, v))); if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
    if (x1 - x0 < 50 || y1 - y0 < 50) continue; const a = (x1 - x0) * (y1 - y0); if (!best || a > best.a) best = { a, x0, y0, x1, y1 };
  }
  if (!best) return null;
  const px = (best.x1 - best.x0) * 0.03, py = (best.y1 - best.y0) * 0.03, X0 = Math.max(0, best.x0 - px), Y0 = Math.max(0, best.y0 - py), X1 = Math.min(1000, best.x1 + px), Y1 = Math.min(1000, best.y1 + py);
  return { x: X0 / 1000 * K.w, y: Y0 / 1000 * K.h, w: (X1 - X0) / 1000 * K.w, h: (Y1 - Y0) / 1000 * K.h };
}
async function smallB64(bm, M) { const W0 = bm.width || bm.naturalWidth, H0 = bm.height || bm.naturalHeight, k = Math.min(1, M / Math.max(W0, H0)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W0 * k)); cv.height = Math.max(1, Math.round(H0 * k)); cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height); const u = cv.toDataURL('image/jpeg', 0.85); return u.slice(u.indexOf(',') + 1); }
const acChip = K => { const a = K && K.ai; if (!C.aiImage) return '<span class="fv-k" id="fvAc">✂️ Ungli se dabba banayein</span>'; if (!a) return '<span class="fv-k" id="fvAc">🤖 ⏳</span>';
  return a.run ? '<span class="fv-k" id="fvAc">🤖 AI dabba laga raha hai ⏳</span>' : a.st === 'ok' ? '<span class="fv-k ok" id="fvAc">🤖 AI ka dabba ✅ theek ho to Save</span>' : a.st === 'hold' ? '<span class="fv-k" id="fvAc">🤖 AI tayyar — 🤖 dabayein</span>' : `<span class="fv-k bad" id="fvAc">🤖 ${a.st === 'no' ? 'AI ko cheez nahi mili' : 'AI nahi chala'} ✕ khud dabba</span>`; };
function acPaint() { const K = S?.crop; if (!K || S.view !== 'crop') return; const o = $('fvAc'); if (o) o.outerHTML = acChip(K); const b = document.querySelector('#fvRoot [data-fv-a="ai"]'); if (b) b.disabled = !!K.ai?.run; boxPaint(); }
async function acRun(manual) {
  const st = S, K = st && st.crop; if (!K || !C.aiImage || K.ai?.run) return;
  if (manual && K.ai?.box) { K.box = { ...K.ai.box }; K.ai = { st: 'ok', box: K.ai.box }; K.touch = 0; acPaint(); return; }
  K.ai = { run: true }; if (manual) K.touch = 0; acPaint();
  const mine = () => S === st && st.crop === K;
  try {
    const out = await withT(C.aiImage(await smallB64(K.bm, 768), AC_PROMPT), 30000, 'AI ne 30 sec mein jawab nahi diya'); if (!mine()) return;
    const box = acBox(out, K);
    if (!box) K.ai = { st: 'no' }; else if (K.touch) K.ai = { st: 'hold', box }; else { K.box = { ...box }; K.ai = { st: 'ok', box }; }
  } catch (e) { if (!mine()) return; K.ai = { st: 'err' }; C.notice('🤖 AI nahi chala — khud dabba banayein (' + String(e?.message || e).slice(0, 70) + ')'); }
  acPaint();
}
function cropHTML() {
  const K = S.crop, it = C.item(K.id) || { name: K.id };
  return `<div class="fv-cs"><b>✂️ ${E(it.name)}</b>${acChip(K)}</div>
    <div class="fv-cw" id="fvCw"><div class="fv-ci"><img id="fvCi" src="${K.url}" alt="" draggable="false"><div class="fv-box" id="fvBox"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div></div></div>
    ${K.busy ? `<p class="fv-busy">⏳ ${E(K.busy)}</p>` : ''}
    <div class="fv-foot"><button type="button" class="fv-x" data-fv-a="cx">✕ Rehne do</button>${C.aiImage ? `<button type="button" class="fv-x" data-fv-a="ai"${K.ai?.run ? ' disabled' : ''}>🤖 AI</button>` : ''}<button type="button" class="fv-main" data-fv-a="save"${K.busy ? ' disabled' : ''}>✅ Save HD</button></div>`;
}
function cropReady() {
  const img = $('fvCi'); if (!img) return; const b = $('dialogBody');
  img.style.maxHeight = Math.max(240, ((b && b.clientHeight) || 520) - 150) + 'px';   // vh nahi (html zoom)
  const go = () => { boxPaint(); cropPointer(); }; if (img.complete) go(); else img.onload = go;
}
function boxPaint() { const K = S?.crop, b = $('fvBox'); if (!K || !b) return; const P = (v, t) => (v / t * 100).toFixed(3) + '%'; Object.assign(b.style, { left: P(K.box.x, K.w), top: P(K.box.y, K.h), width: P(K.box.w, K.w), height: P(K.box.h, K.h) }); }
function cropPointer() {
  const wrap = document.querySelector('#fvCw .fv-ci'); if (!wrap || wrap._on) return; wrap._on = 1;
  let mode = '', sx = 0, sy = 0, b0 = null;
  const pt = e => { const r = $('fvCi').getBoundingClientRect(), K = S.crop, k = K.w / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
  const clamp = B => { const K = S.crop, m = Math.max(24, Math.min(K.w, K.h) * 0.03); B.w = Math.max(m, Math.min(B.w, K.w)); B.h = Math.max(m, Math.min(B.h, K.h)); B.x = Math.max(0, Math.min(B.x, K.w - B.w)); B.y = Math.max(0, Math.min(B.y, K.h - B.h)); return B; };
  wrap.addEventListener('pointerdown', e => {
    if (!S?.crop) return; e.preventDefault(); S.crop.touch = 1; const p = pt(e), B = S.crop.box, h = e.target.dataset && e.target.dataset.h;
    sx = p.x; sy = p.y; b0 = { ...B }; mode = h ? h : (p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h) ? 'mv' : 'new';
    if (mode === 'new') { S.crop.box = clamp({ x: p.x, y: p.y, w: 1, h: 1 }); boxPaint(); }
    try { wrap.setPointerCapture(e.pointerId); } catch {}
  });
  wrap.addEventListener('pointermove', e => {
    if (!mode || !S?.crop) return; const p = pt(e), dx = p.x - sx, dy = p.y - sy, B = { ...b0 };
    if (mode === 'mv') { B.x += dx; B.y += dy; } else if (mode === 'new') { B.x = Math.min(sx, p.x); B.y = Math.min(sy, p.y); B.w = Math.abs(p.x - sx); B.h = Math.abs(p.y - sy); }
    else { if (mode.includes('l')) { B.x += dx; B.w -= dx; } if (mode.includes('r')) B.w += dx; if (mode.includes('t')) { B.y += dy; B.h -= dy; } if (mode.includes('b')) B.h += dy; if (B.w < 0) { B.x += B.w; B.w = -B.w; } if (B.h < 0) { B.y += B.h; B.h = -B.h; } }
    S.crop.box = clamp(B); boxPaint();
  });
  const end = () => { mode = ''; }; wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
}
async function cropSave() {
  const st = S, K = st?.crop; if (!K || K.busy) return;
  K.busy = 'HD tasveer ban rahi hai…'; paint();
  try {
    const B = K.box, k = Math.min(1, 2048 / Math.max(B.w, B.h)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(B.w * k)); cv.height = Math.max(1, Math.round(B.h * k));
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.imageSmoothingQuality = 'high'; cx.drawImage(K.bm, B.x, B.y, B.w, B.h, 0, 0, cv.width, cv.height);
    const blob = await toBlob(cv, 'image/jpeg', 0.96); if (S !== st) return; K.busy = 'Cloud mein ja rahi hai…'; paint();
    const ph = await C.ph(), r = await ph.saveHd(C, K.id, new File([blob], 'item.jpg', { type: 'image/jpeg' }));
    try { K.bm.close?.(); } catch {}
    const it = C.item(K.id); st.sel.add(String(K.id)); pref.sel = [...st.sel]; keepPref();
    C.notice(`✅ HD tasveer save — ${C.num(r.w)} × ${C.num(r.h)}`); C.repaint();
    if (it) prefetch([it]);
    if (S === st) { toList(); setTimeout(() => document.querySelector('#fvRoot .fv-r.is-next')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 80); }
  } catch (e) { if (S === st && st.crop === K) { K.busy = ''; paint(); } C.notice('❌ Tasveer save nahi hui: ' + (e?.message || e)); }
}

// ---------- 🎬 video (phone par: canvas + WebAudio → MediaRecorder) ----------
const VW = 1080, VH = 1920;
const MIMES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4D0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.640028,opus', 'video/mp4;codecs=avc1.42E028,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];   // H.264 pehle (WhatsApp / TikTok har phone par chalti)
const pickMime = () => { try { for (const m of MIMES) if (window.MediaRecorder?.isTypeSupported?.(m)) return m; } catch {} return ''; };
const FT = '"Poppins","Segoe UI",system-ui,sans-serif', FU = '"Noto Nastaliq Urdu","Jameel Noori Nastaleeq","Noto Naskh Arabic",serif';
const ease = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
function mkCanvas(w = VW, h = VH) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rr(cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function fit(cx, t, px, wt, maxW, fam = FT, min = 26) { let p = px; do { cx.font = `${wt} ${p}px ${fam}`; if (cx.measureText(t).width <= maxW) break; p -= 2; } while (p > min); return p; }
function spaced(t) { return String(t).toUpperCase().split('').join(' '); }
function bgLayer() {
  const c = mkCanvas(), cx = c.getContext('2d'), g = cx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#0A1430'); g.addColorStop(0.5, '#132650'); g.addColorStop(1, '#0A1430'); cx.fillStyle = g; cx.fillRect(0, 0, VW, VH);
  const rg = cx.createRadialGradient(VW / 2, 240, 40, VW / 2, 240, 900); rg.addColorStop(0, 'rgba(231,200,115,.20)'); rg.addColorStop(1, 'rgba(231,200,115,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, VW, VH);
  cx.strokeStyle = 'rgba(255,255,255,.035)'; cx.lineWidth = 2; for (let x = -VH; x < VW; x += 46) { cx.beginPath(); cx.moveTo(x, VH); cx.lineTo(x + VH, 0); cx.stroke(); }
  cx.fillStyle = '#C9A24B'; cx.fillRect(140, 92, VW - 280, 3);
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = '#E7C873'; fit(cx, spaced(title()), 40, 700, VW - 160); cx.fillText(spaced(title()), VW / 2, 160);
  cx.fillStyle = '#C9A24B'; cx.fillRect(140, 192, VW - 280, 3);
  return c;
}
function introLayer(part, parts, n) {
  const c = mkCanvas(), cx = c.getContext('2d'); cx.textAlign = 'center';
  const t = title().toUpperCase(), ws = t.split(/\s+/), l1 = ws.length > 2 ? ws.slice(0, Math.ceil(ws.length / 2)).join(' ') : ws[0], l2 = ws.length > 2 ? ws.slice(Math.ceil(ws.length / 2)).join(' ') : ws.slice(1).join(' ');
  const gg = cx.createLinearGradient(0, 640, 0, 960); gg.addColorStop(0, '#F6E3A6'); gg.addColorStop(1, '#C9A24B'); cx.fillStyle = gg;
  fit(cx, l1, 120, 800, VW - 120); cx.fillText(l1, VW / 2, 780); if (l2) { fit(cx, l2, 96, 800, VW - 120); cx.fillText(l2, VW / 2, 900); }
  cx.fillStyle = '#fff'; cx.font = `600 84px ${FU}`; cx.direction = 'rtl'; cx.fillText(/adrees\s*soap\s*factory/i.test(title()) ? 'ادریس سوپ فیکٹری' : '', VW / 2, 1090); cx.direction = 'ltr';
  const d = new Date(), sub = `Aaj ke rates · ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; cx.fillStyle = 'rgba(255,255,255,.82)'; cx.font = `600 46px ${FT}`; cx.fillText(sub, VW / 2, 1240);
  cx.fillStyle = 'rgba(231,200,115,.95)'; cx.font = `700 40px ${FT}`; cx.fillText(`${n} items${parts > 1 ? ` · Part ${part}/${parts}` : ''}`, VW / 2, 1320);
  return c;
}
function outroLayer() {
  const c = mkCanvas(), cx = c.getContext('2d'); cx.textAlign = 'center';
  cx.fillStyle = '#fff'; fit(cx, 'Order ke liye rabta karein', 70, 800, VW - 140); cx.fillText('Order ke liye rabta karein', VW / 2, 820);
  cx.fillStyle = '#E7C873'; cx.font = `600 76px ${FU}`; cx.direction = 'rtl'; cx.fillText('آرڈر کے لیے رابطہ کریں', VW / 2, 990); cx.direction = 'ltr';
  const foot = String(C.cat().foot || '').trim(); if (foot) { cx.fillStyle = 'rgba(255,255,255,.88)'; const ls = foot.split(/\n|\s{2,}|·/).map(s => s.trim()).filter(Boolean).slice(0, 3); ls.forEach((l, i) => { fit(cx, l, 48, 600, VW - 140); cx.fillText(l, VW / 2, 1160 + i * 70); }); }
  cx.fillStyle = 'rgba(255,255,255,.75)'; cx.font = `700 54px ${FT}`; cx.fillText('Shukriya 🙏', VW / 2, foot ? 1420 : 1220);
  return c;
}
const CARD = { x: 90, y: 300, w: 900, h: 1020, pad: 46 };
function cardLayer() { const c = mkCanvas(), cx = c.getContext('2d'); cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 50; cx.shadowOffsetY = 18; cx.fillStyle = '#fff'; rr(cx, CARD.x, CARD.y, CARD.w, CARD.h, 44); cx.fill(); cx.shadowColor = 'transparent'; cx.strokeStyle = 'rgba(201,162,75,.85)'; cx.lineWidth = 5; rr(cx, CARD.x + 2, CARD.y + 2, CARD.w - 4, CARD.h - 4, 42); cx.stroke(); return c; }
function textLayer(it, k, n) {
  const c = mkCanvas(), cx = c.getContext('2d'); cx.textAlign = 'center'; cx.fillStyle = '#fff';
  const nm = String(it.name || ''); fit(cx, nm, 66, 800, VW - 120); cx.fillText(nm, VW / 2, 1440);
  if (it.ur) { cx.fillStyle = '#F2DFA5'; cx.direction = 'rtl'; fit(cx, it.ur, 60, 600, VW - 140, FU, 30); cx.fillText(it.ur, VW / 2, 1555); cx.direction = 'ltr'; }
  if (it.rs > 0) {
    const t = 'Rs ' + C.num(it.rs); cx.font = `800 84px ${FT}`; const tw = cx.measureText(t).width, pw = tw + 120, px = (VW - pw) / 2, py = 1620, ph = 128;
    const g = cx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#F6E3A6'); g.addColorStop(1, '#C9A24B'); cx.fillStyle = g; cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 24; rr(cx, px, py, pw, ph, ph / 2); cx.fill(); cx.shadowColor = 'transparent';
    cx.fillStyle = '#16264A'; cx.fillText(t, VW / 2, py + 96); cx.fillStyle = 'rgba(255,255,255,.7)'; cx.font = `600 30px ${FT}`; cx.fillText(RATE_T[pref.rate] + ' rate', VW / 2, py + ph + 44);
  }
  cx.fillStyle = 'rgba(255,255,255,.55)'; cx.font = `600 30px ${FT}`; cx.fillText(`${k} / ${n}`, VW / 2, 1880);
  return c;
}
async function audioOf(ac, v) { if (!v?.b) return null; try { const u = v.b instanceof Uint8Array ? v.b : new Uint8Array(v.b); return await ac.decodeAudioData(u.slice().buffer); } catch { return null; } }

function makeHTML() {
  const M = S.mk || {};
  return `<div class="fv-mk"><div class="fv-cvw"><canvas id="fvCv" width="${VW}" height="${VH}"></canvas></div>
    <p class="fv-mkt" id="fvMkT">${E(M.msg || '⏳ Tayyari…')}</p><div class="fv-bar"><i id="fvBar" style="width:${Math.round((M.pc || 0) * 100)}%"></i></div>
    <p class="fv-note">📱 Video ban rahi hai — screen khuli rakhein, app band na karein</p>
    <div class="fv-foot">${M.vwait ? '<button type="button" class="fv-x" data-fv-a="skipv">⏭ Bina awaaz aage</button>' : ''}<button type="button" class="fv-x bad" data-fv-a="stop">✕ Rok do</button></div></div>`;
}
function mkMount() { const M = S?.mk; if (!M) return; M.cv = $('fvCv'); }
function mkSay(msg, pc, vwait) { const M = S?.mk; if (!M) return; M.msg = msg; if (pc != null) M.pc = pc; const t = $('fvMkT'); if (t) t.textContent = msg; const b = $('fvBar'); if (b && pc != null) b.style.width = Math.round(pc * 100) + '%'; if (vwait != null && !!M.vwait !== !!vwait) { M.vwait = vwait; paint(); } }
async function makeStart() {
  const st = S; if (!st || st.mk) return;
  const list = items().filter(x => hasPh(x.id) && st.sel.has(String(x.id))); if (!list.length) { C.notice('Pehle items ✓ karein (tasveer wale)'); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { C.notice('❌ Is phone / browser mein video banana mumkin nahi (MediaRecorder nahi) — Chrome update karein'); return; }
  let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch {}   // ungli ke saath hi (warna awaaz band rehti)
  st.mk = { stop: '', msg: '⏳ Tayyari…', pc: 0, ac }; st.outs = []; st.view = 'make'; paint();
  let lock = null; try { lock = await navigator.wakeLock?.request?.('screen'); } catch {}
  try {
    const per = pref.per || list.length, parts = Math.ceil(list.length / per);
    const V = await voicesFor(st, list); if (st.mk.stop) throw Error(st.mk.stop);
    for (let p = 0; p < parts; p++) {
      const chunk = list.slice(p * per, (p + 1) * per);
      const out = await renderOne(st, chunk, V, p + 1, parts); if (st.mk.stop) throw Error(st.mk.stop);
      st.outs.push(out);
    }
    st.mk = null; st.view = 'done'; if (S === st) paint();
    C.notice(`🎬 Video tayyar — ${st.outs.length > 1 ? st.outs.length + ' videos' : '1 video'}`);
  } catch (e) {
    const m = String(e?.message || e); if (st.mk?.rec && st.mk.rec.state !== 'inactive') { try { st.mk.rec.stop(); } catch {} }
    st.mk = null; if (m !== 'close') { if (S === st) { st.view = st.outs.length ? 'done' : 'list'; paint(); } C.notice(m === 'stop' ? 'Video rok di' : '❌ Video nahi bani: ' + m); }
  } finally { try { await lock?.release?.(); } catch {} try { ac?.close?.(); } catch {} }
}
async function voicesFor(st, list) {   // phone / cloud se awaaz; jo baqi hon PC se maango aur intezar (koi nayi na aaye to 25 s baad aage)
  const need = needOf(list), V = new Map(), pend = [];
  mkSay('🔊 Awaaz dhoond raha hoon…', 0.02);
  await pool(need, 6, async R => { const v = await vGet(R, true, true); if (v) V.set(R.doc, v); else pend.push(R); });
  if (!pend.length || st.mk.stop) return V;
  const total = need.length; let last = Date.now(); const unsubs = [];
  await new Promise(done => {
    const left = new Set(pend.map(R => R.doc)), fin = () => { for (const u of unsubs) { try { u(); } catch {} } done(); };
    for (const R of pend) {
      try { unsubs.push(C.cloud.listenFacVoice(R.doc, d => { if (!d || d.sig !== R.sig || !left.has(R.doc)) return; if (d.st === 'ok' && d.b) { const v = { sig: R.sig, b: d.b, ur: String(d.ur || '') }; vcPut(R.doc, v); VOK.add(R.doc); V.set(R.doc, v); left.delete(R.doc); last = Date.now(); } else if (d.st === 'err') { left.delete(R.doc); } })); } catch { left.delete(R.doc); }
    }
    const tick = setInterval(() => {
      const w = Math.round((Date.now() - last) / 1000);
      mkSay(`🔊 Awaaz PC se ban rahi hai ${total - left.size}/${total}${w > 6 ? ` · ${25 - Math.min(25, w)} s` : ''}`, 0.02 + 0.08 * (total - left.size) / total, true);
      if (!left.size || st.mk.stop || st.mk.skipV || Date.now() - last > 25000) { clearInterval(tick); if (left.size && !st.mk.stop) C.notice(`🔇 ${left.size} awaaz nahi aayi (PC band / dheera) — un par sirf likhai. Agli dafa khud hogi.`); mkSay('⏳ Tayyari…', 0.1, false); fin(); }
    }, 500);
  });
  return V;
}
async function renderOne(st, chunk, V, part, parts) {
  const M = st.mk, ac = M.ac;
  mkSay(`🖼 Tasveerein tayyar ${parts > 1 ? `(part ${part}/${parts}) ` : ''}…`, 0.1);
  try { await withT(Promise.all([document.fonts.load(`800 80px ${FT}`), document.fonts.load(`600 60px ${FU}`, 'اردو')]), 6000, 'font'); } catch {}
  const ph = await C.ph(), its = [];
  for (let i = 0; i < chunk.length; i++) {
    if (M.stop) throw Error(M.stop);
    const it = chunk[i], id = String(it.id), meta = C.idx()[id] || {}; let bm = null;
    try { const b = await ph.hdOf(C, id), k = Math.min(1, 1100 / Math.max(Number(meta.w) || 1100, Number(meta.h) || 1100)); bm = await createImageBitmap(b, k < 1 && meta.w && meta.h ? { resizeWidth: Math.round(meta.w * k), resizeHeight: Math.round(meta.h * k), resizeQuality: 'high' } : {}); } catch {}
    const rs = rateOf(it), nv = V.get(vq.n(it).doc), rv = rs > 0 ? V.get(vq.r(rs).doc) : null;
    its.push({ id, name: it.name, ur: String(st.ur[id] || nv?.ur || '').trim(), rs, bm, an: ac ? await audioOf(ac, nv) : null, ar: ac ? await audioOf(ac, rv) : null });
    mkSay(`🖼 Tasveerein tayyar ${i + 1}/${chunk.length}`, 0.1 + 0.1 * (i + 1) / chunk.length);
  }
  const ai = ac ? await audioOf(ac, V.get(vq.i().doc)) : null, ao = ac ? await audioOf(ac, V.get(vq.o().doc)) : null;
  // ⏱ waqt ki fehrist — har item utni der jitni awaaz (kam az kam 2.6 s)
  const segs = []; let t = 0;
  const dI = Math.max(3, (ai ? ai.duration + 0.9 : 0)); segs.push({ k: 'i', t0: t, d: dI, au: ai ? [[ai, 0.5]] : [] }); t += dI;
  its.forEach((x, i) => { const a = []; let o = 0.45; if (x.an) { a.push([x.an, o]); o += x.an.duration + 0.15; } if (x.ar) { a.push([x.ar, o]); o += x.ar.duration; } const d = Math.max(2.6, o + 0.75); segs.push({ k: 'it', x, n: i + 1, t0: t, d, au: a }); t += d; });
  const dO = Math.max(3, (ao ? ao.duration + 1.1 : 0)); segs.push({ k: 'o', t0: t, d: dO, au: ao ? [[ao, 0.4]] : [] }); t += dO;
  const total = t;
  const BG = bgLayer(), CD = cardLayer(), IN = introLayer(part, parts, chunk.length), OU = outroLayer();
  for (const s of segs) if (s.k === 'it') s.tl = textLayer(s.x, s.n, its.length);
  // 🎥 recording
  const cv = $('fvCv') || mkCanvas(); M.cv = cv; const cx = cv.getContext('2d');
  const draw = tt => {
    cx.globalAlpha = 1; cx.drawImage(BG, 0, 0);
    let s = segs[segs.length - 1]; for (const g of segs) if (tt < g.t0 + g.d) { s = g; break; }
    const lt = tt - s.t0, inA = ease(lt / 0.45), outA = 1 - ease((lt - (s.d - 0.3)) / 0.3);
    if (s.k === 'i' || s.k === 'o') { const L = s.k === 'i' ? IN : OU, sc = 0.94 + 0.06 * inA; cx.save(); cx.globalAlpha = Math.max(0, Math.min(inA, outA)); cx.translate(VW / 2, VH / 2); cx.scale(sc, sc); cx.translate(-VW / 2, -VH / 2); cx.drawImage(L, 0, 0); cx.restore(); return; }
    const x = s.x, dx = (1 - inA) * VW * 0.55; cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, outA)); cx.translate(dx, 0); cx.drawImage(CD, 0, 0);
    if (x.bm) { const iw = CARD.w - CARD.pad * 2, ih = CARD.h - CARD.pad * 2, W0 = x.bm.width, H0 = x.bm.height, k0 = Math.min(iw / W0, ih / H0), z = 1 + 0.07 * Math.min(1, lt / s.d), w = W0 * k0 * z, h = H0 * k0 * z;
      cx.save(); rr(cx, CARD.x + 8, CARD.y + 8, CARD.w - 16, CARD.h - 16, 38); cx.clip(); cx.imageSmoothingQuality = 'high'; cx.drawImage(x.bm, CARD.x + CARD.w / 2 - w / 2, CARD.y + CARD.h / 2 - h / 2, w, h); cx.restore(); }
    cx.drawImage(s.tl, 0, 0); cx.restore();
  };
  draw(0);
  const mime = pickMime(), vs = cv.captureStream(30), tracks = [...vs.getVideoTracks()]; let dst = null;
  if (ac) { try { dst = ac.createMediaStreamDestination(); tracks.push(...dst.stream.getAudioTracks()); } catch { dst = null; } }
  const rec = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 4500000, audioBitsPerSecond: 128000 }); M.rec = rec;
  const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(ok => { rec.onstop = ok; });
  rec.start(1000);
  const clock = () => (ac ? ac.currentTime : performance.now() / 1000);
  if (ac?.state === 'suspended') { try { await ac.resume(); } catch {} }
  const T0 = clock() + 0.3;
  if (ac && dst) for (const s of segs) for (const [buf, off] of s.au) { try { const src = ac.createBufferSource(); src.buffer = buf; src.connect(dst); src.start(T0 + s.t0 + off); } catch {} }
  await new Promise((done, fail) => {
    let lastPaint = 0; const step = () => {
      if (M.stop) { fail(Error(M.stop)); return; }
      if (document.hidden) { M.stop = 'Screen band ho gayi — video adhoori. Dobara banayein (screen khuli rakhein)'; fail(Error(M.stop)); return; }
      const tt = clock() - T0; draw(Math.max(0, tt));
      if (performance.now() - lastPaint > 400) { lastPaint = performance.now(); const sec = Math.max(0, Math.min(total, tt)); mkSay(`🎬 Ban rahi hai ${parts > 1 ? `(part ${part}/${parts}) ` : ''}${Math.floor(sec)} / ${Math.ceil(total)} s`, 0.2 + 0.8 * sec / total); }
      if (tt >= total + 0.25) { done(); return; }
      requestAnimationFrame(step);
    }; requestAnimationFrame(step);
  });
  rec.stop(); await withT(stopped, 8000, 'video band nahi hui');
  for (const x of its) { try { x.bm?.close?.(); } catch {} }
  const type = (mime || chunks[0]?.type || 'video/webm').split(';')[0], ext = /mp4/.test(type) ? 'mp4' : 'webm', blob = new Blob(chunks, { type });
  if (blob.size < 20000) throw Error('video khali bani (phone ne record nahi kiya)');
  const d = new Date(), nm = `${String(title()).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')}-video-${d.getDate()}-${MON[d.getMonth()]}${parts > 1 ? `-part${part}` : ''}.${ext}`;
  const vc = /avc1|h264/i.test(mime) ? 'H.264' : /vp9/i.test(mime) ? 'VP9' : /vp8/i.test(mime) ? 'VP8' : ''; return { blob, url: URL.createObjectURL(blob), name: nm, ext, vc, n: chunk.length, sec: Math.round(total), mb: Math.round(blob.size / 1e5) / 10, voices: its.filter(x => x.an).length, part, parts };
}
function doneHTML() {
  const O = S.outs || [];
  return `<div class="fv-done">${O.map((o, i) => `<div class="fv-out"><video src="${o.url}" controls playsinline preload="metadata"></video>
      <div class="fv-oi"><b>🎬 ${o.parts > 1 ? `Part ${o.part}/${o.parts} · ` : ''}${o.n} items · ${o.sec} s</b><small>${o.ext.toUpperCase()}${o.vc ? ' ' + o.vc : ''} · ${o.mb} MB · 🔊 ${o.voices}/${o.n} awaaz${o.ext === 'webm' ? ' · ⚠️ phone ne MP4 nahi banayi' : ''}</small>
      <div class="fv-oa"><button type="button" class="fv-x" data-fv-open="${i}">⛶ Kholo</button><button type="button" class="fv-main" data-fv-share="${i}">📤 Bhejo</button><button type="button" class="fv-x" data-fv-dl="${i}">⬇️ Save</button></div></div></div>`).join('')}
    <p class="fv-note">Gaana TikTok / WhatsApp par khud lagayein (copyright ki wajah se video mein nahi).</p>
    <div class="fv-foot"><button type="button" class="fv-x" data-fv-a="back">‹ Items</button><button type="button" class="fv-main" data-fv-a="make">🔁 Dobara banao</button></div></div>`;
}
function fullVideo(o) {   // apni <dialog> — khuli khirki ke upar, poori screen
  document.getElementById('fvFs')?.remove(); const d = document.createElement('dialog'); d.id = 'fvFs'; d.className = 'fv-fs';
  d.innerHTML = `<video src="${o.url}" controls autoplay playsinline></video><button type="button" class="fv-fsx" aria-label="Band">✕</button>`;
  document.body.append(d); d.addEventListener('close', () => d.remove()); d.querySelector('.fv-fsx').onclick = () => d.close(); try { d.showModal(); } catch { d.setAttribute('open', ''); }
}
async function shareOut(o) {
  const f = new File([o.blob], o.name, { type: o.blob.type });
  try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: o.name, text: `${title()} — ${o.n} items` }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  dl(o); C.notice('📥 Share nahi khula — video Downloads mein save');
}
function dl(o) { const a = document.createElement('a'); a.href = o.url; a.download = o.name; document.body.append(a); a.click(); a.remove(); }

// ---------- 👆 clicks ----------
document.addEventListener('input', e => { if (e.target?.id !== 'fvQ' || !S) return; S.q = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(paintSoft, 120); });
document.addEventListener('click', e => {
  if (!S || !$('fvRoot')) return; const t = e.target.closest?.('[data-fv-ck],[data-fv-ph],[data-fv-row],[data-fv-a],[data-fv-p],[data-fv-open],[data-fv-share],[data-fv-dl]'); if (!t || !t.closest('#fvRoot')) return;
  const d = t.dataset;
  if (d.fvCk != null) { e.preventDefault(); const id = d.fvCk; if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); pref.sel = [...S.sel]; keepPref(); paintSoft(); return; }
  if (d.fvPh != null) { e.preventDefault(); S.pick = d.fvPh; $('fvFile')?.click(); return; }   // ungli ke saath hi (warna phone file khirki nahi kholta)
  if (d.fvP) { const [k, v] = d.fvP.split('|'); pref[k] = k === 'per' ? Number(v) : v; keepPref(); paintSoft(); if (k !== 'per') prefetch(items().filter(x => hasPh(x.id))); return; }
  if (d.fvOpen != null) { const o = S.outs[Number(d.fvOpen)]; if (o) fullVideo(o); return; }
  if (d.fvShare != null) { const o = S.outs[Number(d.fvShare)]; if (o) shareOut(o); return; }
  if (d.fvDl != null) { const o = S.outs[Number(d.fvDl)]; if (o) { dl(o); C.notice('⬇️ Video Downloads mein'); } return; }
  const a = d.fvA;
  if (a === 'all') { S.sel = new Set(items().filter(x => hasPh(x.id)).map(x => String(x.id))); pref.sel = [...S.sel]; keepPref(); paintSoft(); return; }
  if (a === 'none') { S.sel = new Set(); pref.sel = []; keepPref(); paintSoft(); return; }
  if (a === 'today') { const now = Date.now(); S.sel = new Set(items().filter(x => hasPh(x.id) && sameDay(C.idx()[String(x.id)].at, now)).map(x => String(x.id))); pref.sel = [...S.sel]; keepPref(); paintSoft(); if (!S.sel.size) C.notice('Aaj koi tasveer nahi lagi'); return; }
  if (a === 'make') { makeStart(); return; }
  if (a === 'stop') { if (S.mk) S.mk.stop = 'stop'; return; }
  if (a === 'skipv') { if (S.mk) S.mk.skipV = true; return; }
  if (a === 'back') { S.view = 'list'; paint(); return; }
  if (a === 'outs') { if (S.outs.length) { S.view = 'done'; paint(); } return; }
  if (a === 'cx') { toList(); return; }
  if (a === 'ai') { acRun(true); return; }
  if (a === 'save') { cropSave(); return; }
  if (d.fvRow != null && !e.target.closest('button')) { const id = d.fvRow; if (hasPh(id)) { if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); pref.sel = [...S.sel]; keepPref(); paintSoft(); } else { S.pick = id; $('fvFile')?.click(); } }
});
export const _fvTest = { get S() { return S; }, pref, needOf, vq, acBox, open, makeStart, renderOne, voicesFor };
