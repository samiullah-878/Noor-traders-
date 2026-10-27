// fac-photo.js — v2.108.0 (22 Oct 2026): 📷 FACTORY ITEMS KI HD TASVEER · ✨ AI COMMAND · 📄 "ADREES SOAP FACTORY" RATE LIST PDF
//   Malik: "photos cloud mein save hon · HD upload bhi, download bhi · har item ki AI command pehle se likhi (background) — copy kar ke
//   ChatGPT / Gemini, edit wali photo download kar ke wahin lagao · PDF: upar sab tasveerein, neeche har item ☑ wholesale / ☑ parchoon ·
//   download dabate hi seedha phone (notification) · kholo + bhejo · tasveer par rate · jis ko bhejein wo yaad rakhe".
//   Data (cloud.js): factory/phIdx {items:{id:{v, n, sz, w, h, t (chhota namoona Bytes ~3 KB), nm, at, by}}} + factory/ph_<id>_<v>_<i> {b: Bytes ≤ 1 MB}.
//   Likhe SIRF malik (rules factory/* pehle se: malik likhe · malik / Full / Stock parhe — rules nahi badle). PC (auto-backup) Google Drive mein copy.
//   HD ek dafa aa kar phone ke IndexedDB 'sam-fac-ph' mein (dobara internet nahi). PDF = jsPDF, JPEG seedha andar (dobara dabaya nahi = asal HD).
//   AI NAHI: app khud AI nahi chalati — command malik khud ChatGPT / Gemini mein dalta hai.
const $ = id => document.getElementById(id);
let C = null;   // factory.js ka ctx (har khulne par naya)
let ps = null;  // 📷 tasveer khirki {id, busy, hd, w, r}
let cs = null;  // 📸 sab items ki commands {f}
let ct = null;  // 📄 rate list PDF {sel, q, w, r, hd, title, foot}
const LSK = 'sam-fac-ph';
const pref = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch {} return { bg: v.bg || 'w', w: v.w !== false, r: v.r !== false, hd: v.hd !== false, sel: Array.isArray(v.sel) ? v.sel.map(String) : null, cf: v.cf === 'sab' ? 'sab' : 'baqi' }; })();
const keepPref = () => { try { localStorage.setItem(LSK, JSON.stringify(pref)); } catch {} };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dShort = t => { const d = new Date(Number(t) || Date.now()); return d.getDate() + ' ' + MON[d.getMonth()]; };
const kb = n => (Number(n) || 0) >= 1e6 ? (Math.round(n / 1e5) / 10) + ' MB' : Math.max(1, Math.round((Number(n) || 0) / 1000)) + ' KB';
const toBlob = (cv, type, q) => new Promise((ok, no) => { try { cv.toBlob(b => b ? ok(b) : no(Error('Tasveer nahi bani')), type, q); } catch (e) { no(e); } });
const say = t => { const s = $('reportDownloadStatus'); if (s && s.isConnected) s.textContent = t; };

// ---------- ✨ AI command (har item ki pehle se likhi — background chunein) ----------
const BG = [['w', '⚪', 'Safed', 'a clean pure white (#FFFFFF) studio background'], ['b', '🩵', 'Halka neela', 'a soft light-blue to white gradient studio background'], ['g', '🩶', 'Premium', 'a premium soft grey-to-white gradient background with a gentle reflection under the product']];
const bgOf = k => BG.find(b => b[0] === k) || BG[0];
export function aiCmd(name, size, bg) {
  const B = bgOf(bg);
  return `Edit this product photo of "${String(name || '').trim()}"${size ? ` (${size})` : ''} - Adrees Soap Factory.
1. Keep the product EXACTLY the same: same bottle / packet shape, label, logo, text, colours and size. Do not redraw, retype, translate or change any writing.
2. Remove the old background completely and place the product on ${B[3]}, with a soft natural shadow under it.
3. Centre the product, straight (not tilted), filling about 80% of the frame. Bright, sharp, high detail, true colours.
4. Output: one square 1:1 HD image (2048 x 2048). No extra text, no price, no watermark, no border.`;
}
const tagTxt = (R, w, r) => { const a = []; if (w && R.wpcs) a.push('W Rs ' + C.num(R.wpcs)); if (r && R.rpcs) a.push('R Rs ' + C.num(R.rpcs)); return a.join(' · '); };

// ---------- 💾 HD cache (IndexedDB — ek dafa aa kar phone mein) ----------
let dbP = null;
function idb() { if (dbP) return dbP; dbP = new Promise((ok, no) => { try { const r = indexedDB.open('sam-fac-ph', 1); r.onupgradeneeded = () => r.result.createObjectStore('hd'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }).catch(() => null); return dbP; }
async function cGet(k) { const db = await idb(); if (!db) return null; return new Promise(ok => { try { const q = db.transaction('hd').objectStore('hd').get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch { ok(null); } }); }
async function cPut(k, v) { const db = await idb(); if (!db) return; try { db.transaction('hd', 'readwrite').objectStore('hd').put(v, k); } catch {} }
async function cSweep(id, keepK) { const db = await idb(); if (!db) return; try { const s = db.transaction('hd', 'readwrite').objectStore('hd'), q = s.getAllKeys(); q.onsuccess = () => { for (const k of q.result || []) if (String(k).startsWith(id + '@') && k !== keepK) s.delete(k); }; } catch {} }
const hdMem = new Map();   // id@v -> Blob (khirki ke liye — 8 tak)
async function hdBlob(id, mem = true) {
  id = String(id); const m = C.idx()[id]; if (!m?.v) throw Error('Is item ki tasveer nahi');
  const key = id + '@' + m.v; if (hdMem.has(key)) return hdMem.get(key);
  let b = await cGet(key);
  if (!b) { const P = await C.cloud.getFacPhoto(id, m.v, m.n); b = new Blob(P, { type: 'image/jpeg' }); cPut(key, b); cSweep(id, key); }
  if (mem) { hdMem.set(key, b); if (hdMem.size > 8) hdMem.delete(hdMem.keys().next().value); }
  return b;
}
const urlMem = new Map();   // id@v -> object URL (khirki / poori screen)
function hdUrlOf(id, b) { const m = C.idx()[id], key = id + '@' + m?.v; let u = urlMem.get(key); if (!u) { u = URL.createObjectURL(b); urlMem.set(key, u); if (urlMem.size > 6) { const [k0, u0] = urlMem.entries().next().value; urlMem.delete(k0); try { URL.revokeObjectURL(u0); } catch {} } } return u; }

// ---------- 🖼 tasveer ko HD (2048) + chhota namoona (112) ----------
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  const url = URL.createObjectURL(file); try { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 8000); }
}
function cvOf(src, W, H, bg = '#fff') { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d'); cx.fillStyle = bg; cx.fillRect(0, 0, W, H); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'; if (src) cx.drawImage(src, 0, 0, W, H); return cv; }
export async function hdEncode(file, max = 2048) {
  const bm = await decode(file), W0 = bm.width || bm.naturalWidth, H0 = bm.height || bm.naturalHeight; if (!W0 || !H0) throw Error('Tasveer khul nahi saki');
  const k = Math.min(1, max / Math.max(W0, H0)), W = Math.max(1, Math.round(W0 * k)), H = Math.max(1, Math.round(H0 * k)), cv = cvOf(bm, W, H);
  let blob = await toBlob(cv, 'image/jpeg', 0.92); if (blob.size > 3e6) blob = await toBlob(cv, 'image/jpeg', 0.85);
  const mid = cvOf(cv, Math.max(1, Math.round(W * Math.min(1, 448 / Math.max(W, H)))), Math.max(1, Math.round(H * Math.min(1, 448 / Math.max(W, H)))));   // do qadam mein chhota (saaf namoona)
  const T = 112, tc = cvOf(null, T, T), s = Math.min(T / mid.width, T / mid.height); tc.getContext('2d').drawImage(mid, (T - mid.width * s) / 2, (T - mid.height * s) / 2, mid.width * s, mid.height * s);
  const tb = await toBlob(tc, 'image/jpeg', 0.72); try { bm.close?.(); } catch {}
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: W, h: H, thumb: new Uint8Array(await tb.arrayBuffer()), blob };
}

// ---------- 📷 tasveer ki khirki ----------
export function photoSheet(ctx, id) {
  C = ctx; id = String(id); const it = C.item(id); if (!it) { C.notice('Item nahi mila'); return; }
  ps = { id, busy: '', hd: '', w: pref.w, r: pref.r };
  C.dlg('📷 ' + it.name, `<div class="ph-root" id="phSheet">${sheetHTML()}</div>`); loadHd();
}
function sheetPaint() { const el = $('phSheet'); if (el && ps) el.innerHTML = sheetHTML(); }
async function loadHd() { const id = ps?.id; if (!id || !C.idx()[id]?.v) return; try { const b = await hdBlob(id); if (ps?.id !== id) return; ps.hd = hdUrlOf(id, b); const im = $('phImg'); if (im) im.src = ps.hd; } catch (e) { if (ps?.id === id) C.notice('HD tasveer nahi aayi: ' + (e?.message || e)); } }
function sheetHTML() {
  const id = ps.id, it = C.item(id) || { name: id }, m = C.idx()[id], own = C.own, R = C.rates(it), sz = C.size(id), img = ps.hd || C.thumb(id), tag = tagTxt(R, ps.w, ps.r), E = C.esc;
  return `<div class="ph-stage${img ? '' : ' empty'}">${img ? `<img id="phImg" src="${E(img)}" alt="${E(it.name)}">` : `<div class="ph-none"><b>📷</b><span>Abhi tasveer nahi${own ? ' — neeche Camera / Gallery' : ''}</span></div>`}
      ${img && tag ? `<span class="ph-tag">${E(tag)}</span>` : ''}${img ? '<button type="button" class="ph-full" data-ph-full="1" aria-label="Poori screen">⛶</button>' : ''}${ps.busy ? `<div class="ph-busy">⏳ ${E(ps.busy)}</div>` : ''}</div>
    <div class="ph-meta"><b>${E(it.name)}</b><small>${sz ? E(sz) + ' · ' : ''}${m?.v ? `HD ${C.num(m.w)} × ${C.num(m.h)} · ${kb(m.sz)} · ${dShort(m.at)}` : 'tasveer baqi'}</small></div>
    ${own ? `<div class="ph-acts"><button type="button" class="ph-btn pri" data-ph-pick="cam"${ps.busy ? ' disabled' : ''}>📷 Camera</button><button type="button" class="ph-btn" data-ph-pick="gal"${ps.busy ? ' disabled' : ''}>🖼 Gallery</button></div>` : ''}
    ${own ? aiBoxHTML(it, sz) : ''}
    ${m?.v ? `<div class="ph-box"><div class="ph-bh"><b>📤 Customer ko bhejo</b><small>tasveer + rate (neeche patti)</small></div>
      <div class="ph-wr"><label class="ph-ck"><input type="checkbox" data-ph-wr="w"${ps.w ? ' checked' : ''}> Wholesale${R.wpcs ? ' · Rs ' + C.num(R.wpcs) : ''}</label><label class="ph-ck"><input type="checkbox" data-ph-wr="r"${ps.r ? ' checked' : ''}> Parchoon${R.rpcs ? ' · Rs ' + C.num(R.rpcs) : ''}</label></div>
      <button type="button" class="ph-btn wa" data-ph-share="1"${ps.busy ? ' disabled' : ''}>📤 Rate ke saath bhejo</button></div>` : ''}
    <div class="ph-mn">${m?.v ? `<button type="button" data-mn="ph.dl" data-mn-i="⬇️" data-mn-t="HD tasveer download" data-mn-s="phone mein (Downloads)" data-mn-g="📷 Tasveer" data-ph-dl="1">⬇️ HD download</button>` : ''}${own && m?.v ? `<button type="button" data-mn="ph.del" data-mn-i="🗑" data-mn-t="Tasveer hatao" data-mn-s="cloud se bhi" data-mn-g="📷 Tasveer" data-ph-del="1">🗑 Tasveer hatao</button>` : ''}${own ? BG.map(b => `<button type="button" class="${pref.bg === b[0] ? 'is-in' : ''}" data-mn="ph.bg${b[0]}" data-mn-i="${b[1]}" data-mn-t="Background: ${b[2]}" data-mn-s="AI command mein" data-mn-g="✨ AI background" data-ph-bg="${b[0]}">${b[1]} ${b[2]}</button>`).join('') : ''}</div>
    <input type="file" accept="image/*" capture="environment" hidden data-ph-file="cam"><input type="file" accept="image/*" hidden data-ph-file="gal">`;
}
function aiBoxHTML(it, sz) {
  const b = bgOf(pref.bg);
  return `<div class="ph-box ai"><div class="ph-bh"><b>✨ AI se background</b><small>ChatGPT / Gemini — app mein AI nahi</small></div>
    <ol class="ph-steps"><li><b>📋 Command copy</b> (ya 📤 tasveer + command bhejo)</li><li>ChatGPT / Gemini mein <b>tasveer + command</b></li><li>Nayi tasveer download → <b>⬆️ AI wali lagao</b></li></ol>
    <button type="button" class="ph-pat" data-mn-sheet="1">${b[1]} Background: <b>${b[2]}</b> — ⋮ se badlein</button>
    <textarea class="ph-cmd" readonly rows="7" id="phCmd">${C.esc(aiCmd(it.name, sz, pref.bg))}</textarea>
    <div class="ph-acts"><button type="button" class="ph-btn pri" data-ph-copy="1">📋 Command copy</button><button type="button" class="ph-btn" data-ph-ai="1">📤 Tasveer + command</button></div>
    <button type="button" class="ph-btn ok" data-ph-pick="ai"${ps?.busy ? ' disabled' : ''}>⬆️ AI wali nayi tasveer lagao</button></div>`;
}
async function upload(id, file, kind) {
  if (!C.own) { C.notice('Tasveer sirf malik lagata hai'); return; }
  if (!file || !/^image\//.test(file.type || 'image/')) { C.notice('Yeh tasveer nahi'); return; }
  const it = C.item(id); ps.busy = 'HD tasveer ban rahi hai…'; sheetPaint();
  try {
    const x = await hdEncode(file); ps.busy = 'Cloud mein ja rahi hai (' + kb(x.bytes.length) + ')…'; sheetPaint();
    const r = await C.cloud.putFacPhoto(id, { bytes: x.bytes, w: x.w, h: x.h, thumb: x.thumb, nm: it?.name || '' });
    const key = id + '@' + r.v; cPut(key, x.blob); cSweep(id, key); hdMem.set(key, x.blob);
    C.setIdx(id, { v: r.v, n: r.n, sz: x.bytes.length, w: x.w, h: x.h, t: x.thumb, nm: it?.name || '', at: r.v });
    if (ps?.id === id) { ps.busy = ''; ps.hd = hdUrlOf(id, x.blob); sheetPaint(); }
    C.notice(`✓ HD tasveer save — ${x.w} × ${x.h} · ${kb(x.bytes.length)}${kind === 'ai' ? ' · ✨ AI wali' : ''}`); C.repaint();
    if (kind === 'cam') { try { const { blurScore } = await import('./pic-check.js?v=2.132.0'); const s = await blurScore(file, { limit: 60 }); if (s?.blur && ps?.id === id) C.notice('⚠️ Tasveer thori dhundli lag rahi hai — chahein to dobara lein (haath na hile)'); } catch {} }
  } catch (e) { if (ps) { ps.busy = ''; sheetPaint(); } C.notice('Tasveer save nahi hui: ' + (e?.message || e)); }
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch {} try { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.append(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch { return false; } }
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }
const fileName = s => String(s || 'item').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
async function shareFile(file, text) {
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text, title: file.name }); return 'share'; } } catch (e) { if (e?.name === 'AbortError') return 'abort'; }
  download(file.name, file); return 'dl';
}
// 🏷 tasveer + rate ki patti (customer ko bhejne wali) — 1600 × 1600
async function ratedFile(id, w, r) {
  const it = C.item(id), R = C.rates(it), b = await hdBlob(id), bm = await decode(b), S = 1600, band = 300, cv = cvOf(null, S, S), cx = cv.getContext('2d');
  const W0 = bm.width || bm.naturalWidth, H0 = bm.height || bm.naturalHeight, k = Math.min((S - 80) / W0, (S - band - 60) / H0), dw = W0 * k, dh = H0 * k; cx.drawImage(bm, (S - dw) / 2, 30 + (S - band - 60 - dh) / 2, dw, dh);
  const g = cx.createLinearGradient(0, S - band, 0, S); g.addColorStop(0, '#16264A'); g.addColorStop(1, '#0E1A36'); cx.fillStyle = g; cx.fillRect(0, S - band, S, band); cx.fillStyle = '#C9A24B'; cx.fillRect(0, S - band, S, 8);
  const fit = (t, px, wt, maxW) => { let p = px; do { cx.font = `${wt} ${p}px Poppins, "Segoe UI", system-ui, sans-serif`; if (cx.measureText(t).width <= maxW) break; p -= 2; } while (p > 20); return p; };
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = '#fff'; const nm = String(it?.name || ''); fit(nm, 70, 700, S - 120); cx.fillText(nm, S / 2, S - band + 104);
  const a = []; if (w && R.wpcs) a.push('Wholesale Rs ' + C.num(R.wpcs)); if (r && R.rpcs) a.push('Parchoon Rs ' + C.num(R.rpcs)); const rt = a.join('   ·   ') || ''; if (rt) { cx.fillStyle = '#E7C873'; fit(rt, 58, 700, S - 120); cx.fillText(rt, S / 2, S - band + 190); }
  cx.fillStyle = 'rgba(255,255,255,.72)'; cx.font = '600 34px Poppins, "Segoe UI", system-ui, sans-serif'; cx.fillText(String(C.cat().title || 'ADREES SOAP FACTORY').toUpperCase().split('').join(' '), S / 2, S - 44);
  try { bm.close?.(); } catch {}
  const blob = await toBlob(cv, 'image/jpeg', 0.9); return { file: new File([blob], fileName(nm) + '-rate.jpg', { type: 'image/jpeg' }), text: nm + (rt ? ' — ' + rt : '') };
}
function fullView(src, tag) {   // apni <dialog> (showModal) — khuli khirki ke UPAR (top layer); tap / ✕ / Back = band
  closeFull(); const d = document.createElement('dialog'); d.className = 'ph-fs'; d.id = 'phFs'; d.setAttribute('data-ph-fsx', '1');
  d.innerHTML = `<img src="${C.esc(src)}" alt="">${tag ? `<span class="ph-tag">${C.esc(tag)}</span>` : ''}<button type="button" class="ph-fsx" data-ph-fsx="1" aria-label="Band">✕</button>`;
  document.body.append(d); d.addEventListener('close', () => d.remove()); try { d.showModal(); } catch { d.setAttribute('open', ''); }
}
const closeFull = () => { const d = $('phFs'); if (!d) return; try { d.close(); } catch {} d.remove(); };

// ---------- 📸 sab items ki commands ----------
export function commandsDlg(ctx) { C = ctx; cs = { f: pref.cf }; C.dlg('📸 Sab items ki AI commands', `<div class="ph-root" id="phCmds">${cmdsHTML()}</div>`); }
function cmdsPaint() { const el = $('phCmds'); if (el && cs) el.innerHTML = cmdsHTML(); }
function cmdsHTML() {
  const L = C.sell(), idx = C.idx(), baqi = L.filter(x => !idx[x.id]?.v), show = cs.f === 'sab' ? L : baqi, b = bgOf(pref.bg), E = C.esc;
  const mn = (k, i, t, s, a, on) => `<button type="button"${on ? ' class="is-in"' : ''} data-mn="${k}" data-mn-i="${i}" data-mn-t="${E(t)}" data-mn-s="${E(s)}" data-mn-g="📸 Commands" ${a}>${i} ${E(t)}</button>`;
  return `<button type="button" class="ph-pat" data-mn-sheet="1">${cs.f === 'sab' ? '📋 Sab items' : '📷 Tasveer baqi'} (${C.num(show.length)}) · ${b[1]} ${b[2]} — ⋮ se badlein</button>
    <div class="ph-mn">${mn('pc.baqi', '📷', 'Sirf tasveer baqi', C.num(baqi.length) + ' items', 'data-pcm-f="baqi"', cs.f !== 'sab')}${mn('pc.sab', '📋', 'Sab items', C.num(L.length) + ' items', 'data-pcm-f="sab"', cs.f === 'sab')}${BG.map(x => mn('pc.bg' + x[0], x[1], 'Background: ' + x[2], 'sab commands mein', `data-ph-bg="${x[0]}"`, pref.bg === x[0])).join('')}${mn('pc.all', '📋', 'Sab commands copy', 'ek saath (' + C.num(show.length) + ')', 'data-pcm-all="1"')}</div>
    <ol class="ph-steps"><li><b>📋 Copy</b> — ChatGPT / Gemini mein us item ki tasveer + command</li><li>Nayi tasveer download → item par <b>📷</b> → <b>⬆️ AI wali lagao</b></li></ol>
    <div class="ph-cl">${show.map(x => { const th = C.thumb(x.id), sz = C.size(x.id);
      return `<div class="ph-ci"><div class="ph-cih"><button type="button" class="ph-th" data-ph-open="${E(x.id)}" aria-label="${E(x.name)} tasveer">${th ? `<img src="${E(th)}" alt="">` : '📷'}</button><span><b>${E(x.name)}</b><small>${sz ? E(sz) + ' · ' : ''}${idx[x.id]?.v ? '✓ tasveer hai' : '📷 tasveer baqi'}</small></span><button type="button" class="ph-btn sm pri" data-pcm-copy="${E(x.id)}">📋 Copy</button></div>
        <pre class="ph-cmd sm">${E(aiCmd(x.name, sz, pref.bg))}</pre></div>`; }).join('') || `<p class="lk-note">${cs.f === 'sab' ? 'Factory mein abhi koi bikne wala item nahi (formula / packing wala).' : '✓ Sab items ki tasveer lag chuki — ⋮ → 📋 Sab items'}</p>`}</div>`;
}

// ---------- 📄 rate list PDF ----------
export function catalogOpen(ctx) {
  C = ctx; const L = C.sell(), idx = C.idx(), c = C.cat(), have = new Set(L.map(x => x.id));
  let sel = pref.sel ? pref.sel.filter(id => have.has(id)) : null; if (!sel || !sel.length) { sel = L.filter(x => idx[x.id]?.v).map(x => x.id); if (!sel.length) sel = L.map(x => x.id); }
  ct = { sel: new Set(sel), q: '', w: pref.w, r: pref.r, hd: pref.hd, title: String(c.title || 'ADREES SOAP FACTORY'), foot: String(c.foot || '') };
  C.dlg('📄 Rate list PDF', `<div class="ph-root" id="phCat">${catHTML()}</div>`);
}
function catPaint(ids) { const el = $('phCat'); if (!el || !ct) return; if (!ids) { el.innerHTML = catHTML(); return; } const tmp = document.createElement('div'); tmp.innerHTML = catHTML(); for (const id of ids) { const a = $(id), b = tmp.querySelector('#' + id); if (a && b && a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML; } }
function catRows() {
  const L = C.sell(), idx = C.idx(), q = ct.q.trim(), E = C.esc, show = q ? C.srch(L, q, 300) : L;
  return show.map(x => { const on = ct.sel.has(x.id), th = C.thumb(x.id), R = C.rates(x), sz = C.size(x.id);
    return `<label class="ph-row${on ? ' is-in' : ''}"><input type="checkbox" data-pc-it="${E(x.id)}"${on ? ' checked' : ''}><span class="ph-th">${th ? `<img src="${E(th)}" alt="">` : '📷'}</span><span class="ph-rt"><b>${E(x.name)}</b><small>${sz ? E(sz) + ' · ' : ''}W ${R.wpcs ? 'Rs ' + C.num(R.wpcs) : '—'} · R ${R.rpcs ? 'Rs ' + C.num(R.rpcs) : '—'}${idx[x.id]?.v ? '' : ' · <i>📷 tasveer nahi (sirf list mein)</i>'}</small></span></label>`; }).join('') || '<p class="lk-note">Koi item nahi mila.</p>';
}
function catHTML() {
  const own = C.own, idx = C.idx(), E = C.esc, nSel = ct.sel.size, nPh = [...ct.sel].filter(id => idx[id]?.v).length, L = C.sell();
  const mn = (k, i, t, s, a) => `<button type="button" data-mn="${k}" data-mn-i="${i}" data-mn-t="${E(t)}" data-mn-s="${E(s)}" data-mn-g="📄 Items chunna" ${a}>${i} ${E(t)}</button>`;
  return `<button type="button" class="ph-pat" data-mn-sheet="1" id="phCatPat">☑ ${C.num(nSel)} item · 📷 ${C.num(nPh)} tasveer — ⋮ se sab / koi nahi</button>
    <div class="ph-mn">${mn('pd.all', '☑', 'Sab chuno', C.num(L.length) + ' items', 'data-pc-all="1"')}${mn('pd.none', '☐', 'Koi nahi', 'sab tick hatao', 'data-pc-all="0"')}${mn('pd.ph', '📷', 'Sirf tasveer wale', C.num(L.filter(x => idx[x.id]?.v).length) + ' items', 'data-pc-all="ph"')}</div>
    <div class="ph-box"><label class="ek-f"><span>Upar naam</span><input type="text" maxlength="40" data-pc-f="title" value="${E(ct.title)}"${own ? '' : ' disabled'}></label>
      <label class="ek-f"><span>Neeche likhai (phone / pata)</span><input type="text" maxlength="120" data-pc-f="foot" value="${E(ct.foot)}" placeholder="jaise: 0300-1234567 · Gujranwala"${own ? '' : ' disabled'}></label></div>
    <div class="ph-box"><div class="ph-bh"><b>Kaun se rate?</b><small>jo ☑ wohi PDF mein</small></div>
      <div class="ph-wr"><label class="ph-ck"><input type="checkbox" data-pc-wr="w"${ct.w ? ' checked' : ''}> Wholesale</label><label class="ph-ck"><input type="checkbox" data-pc-wr="r"${ct.r ? ' checked' : ''}> Parchoon</label></div>
      <div class="ph-wr"><label class="ph-ck"><input type="radio" name="phq" data-pc-hd="1"${ct.hd ? ' checked' : ''}> HD (asal tasveer)</label><label class="ph-ck"><input type="radio" name="phq" data-pc-hd="0"${ct.hd ? '' : ' checked'}> Halki — WhatsApp tez</label></div></div>
    <div class="ph-box"><div class="ph-bh"><b>Items</b><small id="phCatN">${C.num(nSel)} chune</small></div>
      <label class="hs-search"><input type="search" data-pc-q="1" placeholder="🔍 item dhoondein" value="${E(ct.q)}" autocomplete="off"></label>
      <div class="ph-list" id="phCatList">${catRows()}</div></div>
    <div id="phCatGo"><button type="button" class="fc-ok-btn" data-pc-go="1"${nSel && (ct.w || ct.r) ? '' : ' disabled'}>📄 PDF banao — ${C.num(nSel)} item · ${C.num(nPh)} tasveer</button>${!ct.w && !ct.r ? '<small class="ek-warn">⚠️ Wholesale ya Parchoon — kam az kam ek</small>' : ''}</div>`;
}
const pdfSafe = s => String(s ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/×/g, 'x').replace(/[^\x20-\x7E -ÿ]/g, '').replace(/\s+/g, ' ').trim();
function rateCell(it, R, k) { const pk = Number(it.pack) || 0, cn = String(it.cn || 'Ctn').toLowerCase(), c = k === 'w' ? R.wctn : R.rctn, p = k === 'w' ? R.wpcs : R.rpcs; return [pk > 1 && c ? `Rs ${C.num(c)} / ${cn}` : '', p ? `Rs ${C.num(p)} / pc` : ''].filter(Boolean); }
function catGo() {
  const list = C.sell().filter(x => ct.sel.has(x.id)); if (!list.length) { C.notice('Kam az kam ek item chunein'); return; } if (!ct.w && !ct.r) { C.notice('Wholesale ya Parchoon — ek rate chunein'); return; }
  pref.sel = [...ct.sel]; pref.w = ct.w; pref.r = ct.r; pref.hd = ct.hd; keepPref();
  const d = new Date(), ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, o = { w: ct.w, r: ct.r, hd: ct.hd, title: ct.title || 'ADREES SOAP FACTORY', foot: ct.foot, date: d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() };
  const fname = fileName(o.title) + '-Rate-List-' + ymd + '.pdf';
  if (!C.pdf) { buildPdf(list, o).then(b => download(fname, b)).catch(e => C.notice('PDF nahi bani: ' + (e?.message || e))); return; }
  C.pdf(previewHTML(list, o), 'Rate list — ' + o.title, () => buildPdf(list, o), fname);   // (html, sar-khi, prepare, file ka naam)
}
function previewHTML(list, o) {
  const E = C.esc, idx = C.idx(), ph = list.filter(x => idx[x.id]?.v);
  const cell = x => { const R = C.rates(x), t = []; if (o.w && R.wpcs) t.push('W Rs ' + C.num(R.wpcs)); if (o.r && R.rpcs) t.push('R Rs ' + C.num(R.rpcs)); return `<div style="border:1px solid #E2E6EE;border-radius:10px;padding:6px;text-align:center;background:#fff"><div style="position:relative;aspect-ratio:1;display:grid;place-items:center"><img src="${E(C.thumb(x.id))}" alt="" style="max-width:100%;max-height:100%;object-fit:contain">${t.length ? `<span style="position:absolute;left:4px;bottom:4px;background:#16264A;color:#fff;font:700 9px/1.6 system-ui;padding:1px 6px;border-radius:9px">${E(t.join(' · '))}</span>` : ''}</div><b style="display:block;font:700 11px/1.3 system-ui;margin-top:4px;color:#18202F">${E(x.name)}</b></div>`; };
  const th = 'style="text-align:left;padding:6px 8px;background:#16264A;color:#fff;font:700 11px system-ui"', td = 'style="padding:6px 8px;border-bottom:1px solid #E8ECF3;font:12px/1.35 system-ui;color:#18202F;vertical-align:top"';
  return `<div style="font-family:system-ui;color:#18202F"><div style="background:#16264A;color:#fff;padding:18px 12px;border-radius:12px;text-align:center;border-bottom:4px solid #C9A24B"><b style="font:800 22px/1.2 system-ui;letter-spacing:2px">${E(o.title)}</b><div style="color:#E7C873;font:600 11px system-ui;letter-spacing:1.5px;margin-top:6px">RATE LIST · ${E(o.date)}</div></div>
    ${ph.length ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0">${ph.map(cell).join('')}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;margin-top:8px"><thead><tr><th ${th}>#</th><th ${th}>Item</th>${o.w ? `<th ${th}>Wholesale</th>` : ''}${o.r ? `<th ${th}>Parchoon</th>` : ''}</tr></thead><tbody>${list.map((x, i) => { const R = C.rates(x); return `<tr><td ${td}>${i + 1}</td><td ${td}><b>${E(x.name)}</b>${C.size(x.id) ? `<br><small style="color:#6E7687">${E(C.size(x.id))}</small>` : ''}</td>${o.w ? `<td ${td}>${rateCell(x, R, 'w').map(E).join('<br>') || '—'}</td>` : ''}${o.r ? `<td ${td}>${rateCell(x, R, 'r').map(E).join('<br>') || '—'}</td>` : ''}</tr>`; }).join('')}</tbody></table>
    ${o.foot ? `<p style="font:12px system-ui;color:#6E7687;text-align:center;margin-top:10px">${E(o.foot)}</p>` : ''}</div>`;
}
let jsLoad = null;
function jspdf() { if (window.jspdf) return Promise.resolve(); if (!jsLoad) jsLoad = new Promise((ok, no) => { const s = document.createElement('script'); s.src = new URL('./vendor/jspdf.js', import.meta.url).href; s.onload = () => window.jspdf ? ok() : no(Error('PDF library nahi chali')); s.onerror = () => { jsLoad = null; no(Error('PDF library load nahi hui — internet dekhein')); }; document.head.append(s); }); return jsLoad; }
async function halki(b) { const bm = await decode(b), W0 = bm.width || bm.naturalWidth, H0 = bm.height || bm.naturalHeight, k = Math.min(1, 1100 / Math.max(W0, H0)), cv = cvOf(bm, Math.round(W0 * k), Math.round(H0 * k)); try { bm.close?.(); } catch {} return { u8: new Uint8Array(await (await toBlob(cv, 'image/jpeg', 0.8)).arrayBuffer()), w: cv.width, h: cv.height }; }
export async function buildPdf(list, o) {
  await jspdf(); const idx = C.idx(), ph = list.filter(x => idx[x.id]?.v), img = new Map(); let done = 0, fail = 0;
  say(ph.length ? `📷 Tasveerein aa rahi hain 0 / ${ph.length}…` : '📄 PDF ban rahi hai…');
  const Q = [...ph]; await Promise.all([0, 1, 2].map(async () => { while (Q.length) { const x = Q.shift(); try { const b = await hdBlob(x.id, false), m = idx[x.id]; img.set(x.id, o.hd ? { u8: new Uint8Array(await b.arrayBuffer()), w: m.w, h: m.h } : await halki(b)); } catch { fail++; } done++; say(`📷 Tasveerein aa rahi hain ${done} / ${ph.length}…`); } }));
  say('📄 PDF ban rahi hai…');
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true }), W = 595.28, H = 841.89, M = 28, FOOT = 34;
  const NAVY = [22, 38, 74], GOLD = [201, 162, 75], INK = [24, 32, 47], MUTE = [110, 118, 135], LINE = [226, 230, 238], ZEB = [245, 247, 251];
  const T = pdfSafe(o.title).toUpperCase() || 'ADREES SOAP FACTORY', DT = 'RATE LIST  ·  ' + pdfSafe(o.date).toUpperCase();
  const top = first => { if (first) { doc.setFillColor(...NAVY); doc.rect(0, 0, W, 98, 'F'); doc.setFillColor(...GOLD); doc.rect(0, 98, W, 3.5, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); let fs = 26; doc.setFontSize(fs); while (doc.getTextWidth(T) + T.length * 1.6 > W - 2 * M && fs > 14) { fs -= 1; doc.setFontSize(fs); } doc.text(T, W / 2, 52, { align: 'center', charSpace: 1.6 }); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...GOLD); doc.text(DT, W / 2, 76, { align: 'center', charSpace: 1 }); return 122; }
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 36, 'F'); doc.setFillColor(...GOLD); doc.rect(0, 36, W, 2, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(T, M, 23, { charSpace: 1 }); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(DT, W - M, 23, { align: 'right' }); return 56; };
  const sec = (t, y) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...NAVY); doc.text(t, M, y, { charSpace: 1.2 }); doc.setFillColor(...GOLD); doc.rect(M, y + 5, 34, 2.2, 'F'); return y + 20; };
  let y = top(true);
  // ① upar sab tasveerein (3 qatar) + rate ki patti
  const G = ph.filter(x => img.has(x.id));
  if (G.length) { y = sec('OUR PRODUCTS', y); const cols = 3, gap = 14, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = cw + 44;
    G.forEach((x, i) => { const col = i % cols; if (col === 0 && i) y += ch + 12; if (col === 0 && y + ch > H - FOOT) { doc.addPage(); y = top(false); }
      const cx = M + col * (cw + gap), im = img.get(x.id), R = C.rates(x);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.8); doc.setFillColor(255, 255, 255); doc.roundedRect(cx, y, cw, cw, 8, 8, 'FD');
      const pad = 6, k = Math.min((cw - 2 * pad) / im.w, (cw - 2 * pad) / im.h), dw = im.w * k, dh = im.h * k;
      try { doc.addImage(im.u8, 'JPEG', cx + (cw - dw) / 2, y + (cw - dh) / 2, dw, dh, 'p' + x.id, 'NONE'); } catch { fail++; }
      const tg = []; if (o.w && R.wpcs) tg.push('W Rs ' + C.num(R.wpcs)); if (o.r && R.rpcs) tg.push('R Rs ' + C.num(R.rpcs));
      if (tg.length) { const t = pdfSafe(tg.join('  |  ')); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); const tw = doc.getTextWidth(t) + 14; doc.setFillColor(...NAVY); doc.roundedRect(cx + 7, y + cw - 24, Math.min(tw, cw - 14), 17, 8.5, 8.5, 'F'); doc.setTextColor(255, 255, 255); doc.text(t, cx + 14, y + cw - 12.5, { maxWidth: cw - 28 }); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); const nl = doc.splitTextToSize(pdfSafe(x.name), cw - 6).slice(0, 2); doc.text(nl, cx + cw / 2, y + cw + 14, { align: 'center' });
      const sz = pdfSafe(C.size(x.id)); if (sz) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTE); doc.text(sz, cx + cw / 2, y + cw + 14 + nl.length * 11, { align: 'center' }); } });
    y += ch + 22; }
  // ② neeche har item — ☑ wholesale / ☑ parchoon
  if (y + 90 > H - FOOT) { doc.addPage(); y = top(false); }
  y = sec('RATE LIST', y);
  const cols = [['#', 24], ['ITEM', 0], ...(o.w ? [['WHOLESALE', 128]] : []), ...(o.r ? [['PARCHOON', 128]] : [])], fixed = cols.reduce((t, c) => t + c[1], 0); cols[1][1] = W - 2 * M - fixed;
  const head = () => { doc.setFillColor(...NAVY); doc.rect(M, y, W - 2 * M, 20, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255); let x = M; for (const [t, w] of cols) { doc.text(t, x + 6, y + 13.5, { charSpace: 0.6 }); x += w; } y += 20; };
  head();
  list.forEach((it, i) => { const R = C.rates(it), nm = doc.splitTextToSize(pdfSafe(it.name), cols[1][1] - 12).slice(0, 2), sz = pdfSafe(C.size(it.id)), cells = [o.w ? rateCell(it, R, 'w') : null, o.r ? rateCell(it, R, 'r') : null].filter(c => c);
    const lines = Math.max(nm.length + (sz ? 1 : 0), ...cells.map(c => c.length || 1)), h = Math.max(26, lines * 12 + 10);
    if (y + h > H - FOOT) { doc.addPage(); y = top(false); head(); }
    if (i % 2) { doc.setFillColor(...ZEB); doc.rect(M, y, W - 2 * M, h, 'F'); }
    let x = M; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(String(i + 1), x + 6, y + 15); x += cols[0][1];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(nm, x + 6, y + 15); if (sz) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTE); doc.text(sz, x + 6, y + 15 + nm.length * 12); } x += cols[1][1];
    for (const c of cells) { if (!c.length) { doc.setTextColor(...MUTE); doc.text('-', x + 6, y + 15); } c.forEach((t, k) => { doc.setFont('helvetica', k ? 'normal' : 'bold'); doc.setFontSize(k ? 8.5 : 9.5); doc.setTextColor(...(k ? MUTE : INK)); doc.text(pdfSafe(t), x + 6, y + 15 + k * 12); }); x += 128; }
    y += h; doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); });
  const n = doc.getNumberOfPages(), F = pdfSafe(o.foot);
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, H - 26, W - M, H - 26); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTE); if (F) doc.text(F, M, H - 13, { maxWidth: W - 2 * M - 70 }); doc.text(`${p} / ${n}`, W - M, H - 13, { align: 'right' }); }
  if (fail) C.notice(`⚠️ ${fail} tasveer nahi aayi — PDF baqi ke saath bani`);
  return doc.output('blob');
}

// ---------- clicks ----------
document.addEventListener('click', async e => {
  const t = e.target.closest?.('[data-ph-pick],[data-ph-full],[data-ph-fsx],[data-ph-copy],[data-ph-ai],[data-ph-bg],[data-ph-share],[data-ph-dl],[data-ph-del],[data-ph-open],[data-pcm-f],[data-pcm-all],[data-pcm-copy],[data-pc-all],[data-pc-go]');
  if (!t || !C) return; const d = t.dataset;
  if (d.phFsx != null) { closeFull(); return; }
  if (!t.closest('.ph-root')) return;
  if (d.phOpen) { photoSheet(C, d.phOpen); return; }
  if (d.phBg) { pref.bg = d.phBg; keepPref(); if ($('phSheet')) sheetPaint(); if ($('phCmds')) cmdsPaint(); C.notice(bgOf(pref.bg)[1] + ' Background: ' + bgOf(pref.bg)[2]); return; }
  if (d.pcmF) { cs.f = pref.cf = d.pcmF; keepPref(); cmdsPaint(); return; }
  if (d.pcmAll != null) { const L = C.sell(), idx = C.idx(), show = cs?.f === 'sab' ? L : L.filter(x => !idx[x.id]?.v); const ok = await copyText(show.map(x => '### ' + x.name + '\n' + aiCmd(x.name, C.size(x.id), pref.bg)).join('\n\n')); C.notice(ok ? `📋 ${show.length} commands copy — ek ek item ki tasveer ke saath dein` : 'Copy nahi hua'); return; }
  if (d.pcmCopy) { const x = C.item(d.pcmCopy); const ok = await copyText(aiCmd(x?.name, C.size(d.pcmCopy), pref.bg)); if (ok) { t.textContent = '✓ Copy'; t.classList.add('done'); } C.notice(ok ? '📋 ' + (x?.name || '') + ' ki command copy — ChatGPT / Gemini mein tasveer ke saath' : 'Copy nahi hua — command dabaa kar copy karein'); return; }
  if (d.pcAll != null && ct) { const L = C.sell(), idx = C.idx(); ct.sel = new Set(d.pcAll === '1' ? L.map(x => x.id) : d.pcAll === 'ph' ? L.filter(x => idx[x.id]?.v).map(x => x.id) : []); catPaint(); return; }
  if (d.pcGo != null && ct) { catGo(); return; }
  if (!ps) return; const id = ps.id;
  if (d.phPick) { if (ps.busy) return; const inp = document.querySelector(`#phSheet [data-ph-file="${d.phPick === 'cam' ? 'cam' : 'gal'}"]`); if (inp) { inp.dataset.kind = d.phPick; inp.value = ''; inp.click(); } return; }
  if (d.phFull != null) { const R = C.rates(C.item(id)); fullView(ps.hd || C.thumb(id), tagTxt(R, ps.w, ps.r)); if (!ps.hd) loadHd().then(() => { const im = document.querySelector('#phFs img'); if (im && ps?.hd) im.src = ps.hd; }); return; }
  if (d.phCopy != null) { const ok = await copyText($('phCmd')?.value || ''); C.notice(ok ? '📋 Command copy — ChatGPT / Gemini kholein, tasveer lagayein, command paste' : 'Copy nahi hua — upar likhai dabaa kar copy karein'); return; }
  if (d.phAi != null) { const cmd = $('phCmd')?.value || ''; if (!C.idx()[id]?.v) { const ok = await copyText(cmd); C.notice((ok ? '📋 Command copy · ' : '') + 'Pehle 📷 tasveer lagayein — phir bhejein'); return; }
    const key = id + '@' + C.idx()[id].v; const b = hdMem.get(key); if (!b) { C.notice('⏳ HD tasveer aa rahi hai — 2 second baad dobara dabayein'); loadHd(); return; }
    copyText(cmd); const r = await shareFile(new File([b], fileName(C.item(id)?.name) + '.jpg', { type: 'image/jpeg' }), cmd); if (r === 'dl') C.notice('⬇️ Tasveer download + 📋 command copy — ChatGPT / Gemini mein dono dein'); else if (r === 'share') C.notice('📋 Command bhi copy hai — agar likhai na pahunche to paste karein'); return; }
  if (d.phShare != null) { if (!C.idx()[id]?.v) return; if (!ps.w && !ps.r) { C.notice('Wholesale ya Parchoon — ek ☑ karein (ya dono)'); }
    try { const f = await ratedFile(id, ps.w, ps.r); const r = await shareFile(f.file, f.text); if (r === 'dl') C.notice('⬇️ Rate wali tasveer download — WhatsApp mein lagayein'); } catch (er) { C.notice('Nahi bani: ' + (er?.message || er)); } return; }
  if (d.phDl != null) { try { const b = await hdBlob(id); download(fileName(C.item(id)?.name) + '-HD.jpg', b); C.notice('⬇️ HD tasveer download (Downloads)'); } catch (er) { C.notice('Download nahi hui: ' + (er?.message || er)); } return; }
  if (d.phDel != null) { if (!C.own) return; if (!confirm((C.item(id)?.name || 'Is item') + ' ki tasveer hata dein? (cloud se bhi)')) return;
    try { await C.cloud.delFacPhoto(id); C.setIdx(id, null); ps.hd = ''; sheetPaint(); C.repaint(); C.notice('🗑 Tasveer hata di'); } catch (er) { C.notice('Nahi hata saka: ' + (er?.message || er)); } return; }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t?.dataset || !C) return; const d = t.dataset;
  if (d.phFile && ps) { const f = t.files?.[0]; if (f) upload(ps.id, f, t.dataset.kind || d.phFile); return; }
  if (d.phWr && ps) { ps[d.phWr] = !!t.checked; pref[d.phWr] = ps[d.phWr]; keepPref(); const tg = document.querySelector('#phSheet .ph-tag'), R = C.rates(C.item(ps.id)), txt = tagTxt(R, ps.w, ps.r); if (tg) { tg.textContent = txt; tg.hidden = !txt; } return; }
  if (!ct || !t.closest?.('#phCat')) return;
  if (d.pcIt) { if (t.checked) ct.sel.add(d.pcIt); else ct.sel.delete(d.pcIt); t.closest('.ph-row')?.classList.toggle('is-in', t.checked); catPaint(['phCatPat', 'phCatN', 'phCatGo']); return; }
  if (d.pcWr) { ct[d.pcWr] = !!t.checked; catPaint(['phCatGo']); return; }
  if (d.pcHd != null) { ct.hd = d.pcHd === '1'; return; }
  if (d.pcF && C.own) { const k = d.pcF, v = String(t.value || '').trim().slice(0, k === 'title' ? 40 : 120); ct[k] = v || (k === 'title' ? 'ADREES SOAP FACTORY' : ''); C.saveCat({ [k]: ct[k] }).then(() => C.notice('✓ Save — har PDF mein yahi')).catch(er => C.notice('Save nahi hua: ' + (er?.message || er))); return; }
});
let qT = 0;
document.addEventListener('input', e => { const t = e.target; if (t?.dataset?.pcQ == null || !ct) return; ct.q = t.value || ''; clearTimeout(qT); qT = setTimeout(() => { const el = $('phCatList'); if (el && ct) el.innerHTML = catRows(); }, 150); });
export const _phTest = { aiCmd, hdEncode, buildPdf: (ctx, list, o) => { C = ctx; return buildPdf(list, o); }, pref, get ps() { return ps; }, get ct() { return ct; }, tagTxt: (ctx, R, w, r) => { C = ctx; return tagTxt(R, w, r); } };
