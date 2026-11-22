// godam-v.js — 🏬 GODAM VIDEOS (v2.346.0, 2026-11-22)
// Malik (21 Nov): "maal aane / jane ki video AI khud banaye · phir hum training karwayein · sab model lagao godam wale cameras mein · HD kar do".
// PC ginti-cam v2.0 (godam ke darwaze ka camera: lakeer paar — ⬆ maal gaya / ⬇ aaya, 🧍 banda kuch utha kar, 🙂 chehra) → gintiEv
//   + PC bill-clip v2.20 (har waqie ki video, godam ke 1-2 camera, HD recording se) → billClip/gv~<evId> (+ gv~<evId>b)
//   + 📹 0: transfer note bana magar camera ne kuch nahi gina → billClip/gv~d-<gintiDoc id>.
// Yahan: din ki list (patli 2 line) → tap = video (dono camera saath) + chehre + ✓ Sahi / 🔢 Ginti / ✕ Ghalat (gintiEv.lb — yehi training ka data)
//   · ❓ chehre par naam (sirf malik → gintiEv.fl, PC seekhta hai) · ⋮ → 👤 Larkon ki tasveerein (faceRef / faceImg, sirf malik).
// Dekhna: malik + CAP nz.gvid (OPT_IN). AI app mein NAHI — pehchan / ginti PC ka apna model (internet nahi).

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hm = t => { if (!t) return ''; const d = new Date(Number(t)); let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad2(d.getMinutes())} ${ap}`; };
const ago = t => { const s = Math.max(0, Math.round((Date.now() - Number(t || 0)) / 1000)); return s < 90 ? s + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' ghante'; };
const b64 = im => { try { return im && typeof im.toBase64 === 'function' ? im.toBase64() : ''; } catch { return ''; } };
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

let cloud = null, notice = () => {}, whoF = () => '', own = false, canLb = false, view = 'list', dayN = 0, evs = [], docs = [], clips = new Map(), err = '', pc = null, gcfg = null;
let unsubs = [], menu = false, open = '', flt = '', busy = new Map(), faces = [], hz = [], fsel = '', pick = null, pq = '', help = false;
const VEL = new Map(), URLS = new Map();   // cid → <video> (paint ke beech chalti rahe) · "cid#i" → blob url

function dlg() {
  let d = $('gvDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'gvDlg'; d.className = 'gn-dlg'; document.body.append(d);
    d.addEventListener('close', stop); d.addEventListener('click', onClick); d.addEventListener('input', onInput); d.addEventListener('change', onChange);
  }
  return d;
}
function vidFree() { for (const v of VEL.values()) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch {} } VEL.clear(); for (const u of URLS.values()) { try { URL.revokeObjectURL(u); } catch {} } URLS.clear(); }
function stop() { unsubs.forEach(u => { try { u(); } catch {} }); unsubs = []; vidFree(); }
window.ntGvClose = () => {   // phone back = ek qadam
  const d = $('gvDlg'); if (!d?.open) return false;
  if (menu) { menu = false; paint(); return true; }
  if (view === 'pick') { view = 'list'; pick = null; paint(); return true; }
  if (view === 'face' && fsel) { fsel = ''; paint(); return true; }
  if (view === 'face') { view = 'list'; paint(); return true; }
  if (open) { open = ''; vidFree(); paint(); return true; }
  d.close(); return true;
};

export function openGodamV(o) {
  cloud = o.cloud; notice = o.notice || notice; whoF = o.who || whoF; own = !!o.owner; canLb = own || !!o.canLb;
  view = o.tab === 'face' && own ? 'face' : 'list'; menu = false; open = ''; pick = null; fsel = '';
  const d = dlg(); if (!d.open) d.showModal();
  watch(); paint();
}
function watch() {
  stop(); err = '';
  const day = dayOf(Date.now() - dayN * 86400000);
  unsubs.push(cloud.listenGinti(day, (k, rows, e) => { if (e) { err = /permission/i.test(String(e.message || e)) ? 'Is screen ki ijazat nahi (malik se 🏬 Godam videos ON karwayein)' : String(e.message || e); paint(); return; } if (k === 'ev') evs = rows || []; else docs = rows || []; if (view === 'list') paint(); }));
  unsubs.push(cloud.listenBillClips([day], (rows, e) => { if (e) return; clips = new Map((rows || []).filter(x => x && x.gv).map(x => [x.id, x])); if (view === 'list') paint(); }));
  if (own) {
    unsubs.push(cloud.listenGintiPc(x => { pc = x; if (view !== 'pick') paintPat(); }));
    unsubs.push(cloud.listenGintiCam(x => { gcfg = x || {}; if (view === 'list') paintPat(); }));
    unsubs.push(cloud.listenFaceRef((rows, e) => { if (e) return; faces = rows || []; if (view === 'face' || view === 'pick') paint(); }));
    cloud.getHzCodes().then(d => { const m = d.m || {}, nm = d.nm || {}; hz = Object.entries(m).map(([ph, n]) => ({ k: 'c' + n, n: String(nm[ph] || ('Code ' + n)).trim(), code: Number(n) })).sort((a, b) => a.code - b.code); if (view !== 'list') paint(); }).catch(() => {});
  }
}

// ---------- haal + ⋮ ----------
function head() {
  const t = view === 'face' ? (fsel ? '👤 ' + esc(personOf(fsel).n) : '👤 Larkon ki tasveerein') : view === 'pick' ? '🙂 Yeh kaun hai?' : '🏬 Godam videos';
  const back = view === 'list' ? '' : `<button type="button" class="gn-chip gn-bk" data-gv-back="1">‹</button>`;
  const F = [['', 'Sab'], ['out', '⬆ Gaya'], ['in', '⬇ Aaya'], ['pz', '🧍 Shak'], ['ms', '📹 0 (camera ne nahi dekha)'], ['fc', '❓ Chehre'], ['lb', '⏳ Baqi (✓ / ✕ nahi)']];
  return `<div class="gn-head">${back}<b class="gn-t">${t}</b><span class="gn-hx">${view === 'list' ? `<button type="button" class="gn-chip gn-day" data-gv-menu="1">${dayN ? '📅 Kal' : '📅 Aaj'}${flt ? ' · ' + esc((F.find(x => x[0] === flt) || [, ''])[1]) : ''} ⋮</button>` : ''}<button type="button" class="gn-x" data-gv-close="1" aria-label="Band">×</button></span>
    ${menu ? `<div class="gn-menu">${[['0', '📅 Aaj'], ['1', '📅 Kal']].map(([k, n]) => `<button type="button" class="gn-mi${String(dayN) === k ? ' is-in' : ''}" data-gv-day="${k}">${n}</button>`).join('')}
      ${F.map(([k, n]) => `<button type="button" class="gn-mi${flt === k ? ' is-in' : ''}" data-gv-f="${k}">${n}</button>`).join('')}
      ${own ? `<button type="button" class="gn-mi" data-gv-face="1">👤 Larkon ki tasveerein (chehra pehchan)</button>
      <button type="button" class="gn-mi" data-gv-tg="pz">${gcfg && gcfg.pz === false ? '○ 🧍 Pose band — chalu karo' : '✓ 🧍 Pose chalu — band karo'}</button>
      <button type="button" class="gn-mi" data-gv-tg="fc">${gcfg && gcfg.fc === false ? '○ 🙂 Chehra band — chalu karo' : '✓ 🙂 Chehra chalu — band karo'}</button>` : ''}
      <button type="button" class="gn-mi" data-gv-help="1">❓ Kaise kaam karta hai</button></div>` : ''}</div>`;
}
function patHTML() {
  const R = rowsOf(true); let o = 0, i = 0, p = 0, lb = 0; for (const r of R) { if (r.e) { o += r.e.out || 0; i += r.e.in || 0; p += (r.e.po || 0) + (r.e.pi || 0); if (r.e.lb) lb++; } }
  const live = pc && Date.now() - Number(pc.at || 0) < 12 * 60000, f = pc && typeof pc.face === 'object' ? pc.face : null;
  const st = !own ? '' : !pc ? '<span class="gn-pc off">🖥 PC: abhi nahi chala</span>' : !live ? `<span class="gn-pc off">🔴 PC chup (${ago(pc.at)})</span>` : `<span class="gn-pc on">🟢 PC v${esc(pc.v || '?')}</span>`;
  const ai = !own || !pc ? '' : `<span class="gn-k" title="PC ka model: pose · chehra">🤖 pose ${pc.pose === 'ok' ? '✓' : esc(String(pc.pose || '⏳')).slice(0, 14)} · 🙂 ${f ? (f.m === 'ok' ? `${f.ppl} larke` : esc(String(f.m)).slice(0, 14)) : esc(String(pc.face || '⏳')).slice(0, 14)}</span>`;
  const aiB = own && gcfg && Number(gcfg.ai) !== 1 ? '<span class="gn-k al" title="Settings → 🖥️ PC scripts → 🤖 Camera AI">🤖 AI band — PC scripts se chalu</span>' : '';   // v2.347.0
  return `<div class="gn-pat" id="gvPat">${aiB}${st}<span class="gn-k">⬆ ${o}</span><span class="gn-k">⬇ ${i}</span>${p ? `<span class="gn-k">🧍 ${p}</span>` : ''}<span class="gn-k">✓ ${lb}/${R.length}</span>${ai}</div>`;
}
function paintPat() { const p = $('gvPat'); if (p) p.outerHTML = patHTML(); }
function helpHTML() {
  return `<div class="gn-help" data-gv-help="1">📹 Godam ke darwaze ka camera khud dekhta hai: carton / bori lakeer paar kare = ⬆ gaya / ⬇ aaya · 🧍 banda kuch utha kar guzra (carton na dikhe tab bhi) = shak.<br>
  🎥 Har waqie ki video khud banti hai (20 s pehle → 20 s baad, godam ke dono camera). 📹 0 = transfer note bana magar camera ne kuch nahi gina — us waqt ki video.<br>
  🙂 Chehra: ⋮ → 👤 mein har larke ki 5–10 saaf tasveerein — phir video par naam. ❓ par tap = naam batao, agli dafa khud pehchanega.<br>
  ✓ Sahi / 🔢 Ginti / ✕ Ghalat = aap ka faisla — yehi agli training ka data. Sab PC ka apna model (internet / AI nahi).<span class="gn-mut"> · tap = band</span></div>`;
}

// ---------- list ----------
function rowsOf(all) {
  const R = [];
  for (const e of evs) { const goods = (e.out || 0) + (e.in || 0), pose = (e.po || 0) + (e.pi || 0); if (!goods && !pose) continue; R.push({ t: Number(e.t0) || 0, id: e.id, e, cid: 'gv~' + e.id }); }
  for (const d of docs) if (d.k === 'tn' && !d.x && d.st === 'kam' && !((d.out || 0) + (d.in || 0))) R.push({ t: Number(d.t) || 0, id: 'd:' + d.id, d, cid: 'gv~d-' + d.id });
  R.sort((a, b) => b.t - a.t); if (all || !flt) return R;
  return R.filter(r => { const e = r.e; if (flt === 'ms') return !!r.d; if (!e) return false;
    if (flt === 'out') return (e.out || 0) > (e.in || 0) || (!(e.out || e.in) && (e.po || 0) > (e.pi || 0));
    if (flt === 'in') return (e.in || 0) > (e.out || 0) || (!(e.out || e.in) && (e.pi || 0) > (e.po || 0));
    if (flt === 'pz') return !!e.pz; if (flt === 'lb') return !e.lb;
    if (flt === 'fc') return (Array.isArray(e.fc) ? e.fc : []).some((f, i) => !f.n && !(e.fl && e.fl[i] && e.fl[i].at));
    return true; });
}
function listHTML() {
  if (err) return `<p class="gn-warn">${esc(err)}</p>`;
  const R = rowsOf();
  if (!R.length) return `<div class="gn-empty">${flt ? 'Is filter mein kuch nahi.' : `${dayN ? 'Kal' : 'Aaj'} abhi godam ki koi video nahi.`}<br><span class="gn-mut">📦 Loading ginti ka camera + lakeer laga ho aur camera ⏺ Rec ON ho to har aana / jana khud yahan aata hai.</span></div>`;
  return `<div class="gn-list">${R.map(rowHTML).join('')}</div>`;
}
function camsOf(cid) { return [cid, cid + 'b'].map(id => clips.get(id)).filter(Boolean); }
function nameOfFace(e, i) { const f = (e.fc || [])[i] || {}, l = e.fl && e.fl[i]; if (l && l.at) return { n: l.n || '', man: 1 }; return { n: f.n || '', g: f.g || '' }; }
function rowHTML(r) {
  const e = r.e, d = r.d, C = camsOf(r.cid), c0 = C[0];
  const vid = !C.length ? '🎥 ⏳' : C.some(c => c.st === 'ok') ? `🎥 ${c0.dur ? Math.round(c0.dur) + ' s' : '✓'}${C.length > 1 ? ' ×2' : ''}` : c0.st === 'err' ? '🎥 ✕' : '🎥 ⏳';
  let l1, l2, st = '', stc = 'wait';
  if (d) {
    l1 = `<b>📹 0 · 🧾 TN #${esc(d.no || '')}</b><span class="gn-p">🏬 ${esc(d.bn || '')} · camera ne kuch nahi gina</span>`; st = '❓ dekhein'; stc = 'kam';
    l2 = `🕒 ${hm(d.t)} · 📄 ${d.ec || 0} ctn${d.ek ? ' + ' + d.ek + ' khule' : ''} · ${vid}`;
  } else {
    const o = e.out || 0, i = e.in || 0, po = e.po || 0, pi = e.pi || 0, n = Math.abs(o - i) || o || i;
    const dir = o > i ? `⬆ Gaya · ${n} nag` : i > o ? `⬇ Aaya · ${n} nag` : po + pi ? `🧍 Uthaya (shak) · ${po > pi ? '⬆' : '⬇'}` : `⇅ ${o}/${i}`;
    l1 = `<b>${dir}</b><span class="gn-p">🏬 ${esc(e.bn || e.cam || '')}</span>`;
    const L = e.lb; if (L) { st = L.k === 'ok' ? '✓ Sahi' : L.k === 'n' ? `🔢 ${L.n}` : '✕ Ghalat'; stc = L.k === 'x' ? 'bina' : 'ok'; }
    else if (e.st === 'bina') { st = '🚨 bina note'; stc = 'bina'; } else if (e.st === 'late') { st = '🧾 baad mein'; stc = 'kam'; } else if (e.st === 'doc') { st = '🧾 ' + (e.refNo || 'note'); stc = 'ok'; } else if (e.st === 'wait') st = '⏳ note';
    const fcs = (Array.isArray(e.fc) ? e.fc : []).map((f, k) => { const w = nameOfFace(e, k); return w.n || (w.g ? w.g + '?' : '❓'); });
    l2 = `🕒 ${hm(e.t0)} · ${vid}${po + pi && (o + i) ? ` · 🧍 ⬆${po} ⬇${pi}` : ''}${fcs.length ? ' · 🙂 ' + esc(fcs.join(', ')) : ''}`;
  }
  const isOpen = open === r.id;
  return `<div class="gn-r st-${stc === 'bina' ? 'bina' : stc === 'ok' ? 'ok' : stc === 'kam' ? 'kam' : 'wait'}${isOpen ? ' is-in' : ''}" data-gv-row="${esc(r.id)}">
    <div class="gn-l1">${l1}${st ? `<span class="gn-st ${stc}">${esc(st)}</span>` : ''}</div><div class="gn-l2">${l2}</div>${isOpen ? openHTML(r) : ''}</div>`;
}
function openHTML(r) {
  const e = r.e, C = camsOf(r.cid), b = busy.get(r.id) || '';
  const vids = C.length ? `<div class="gv-vs n${Math.min(2, C.length)}">${C.map(c => `<div class="gv-v" data-gv-slot="${esc(c.id)}"><span class="gv-vn">📹 ${esc(c.cam || '')}</span>${c.st === 'ok' ? '' : `<div class="gv-vm">${c.st === 'err' ? '✕ ' + esc(c.err || 'video nahi bani') : '⏳ video ban rahi hai (recording band hone ke 1-2 min baad)'}</div>`}</div>`).join('')}</div>`
    : `<div class="gv-v"><div class="gv-vm">⏳ Video abhi nahi bani — PC waqie ke 1-2 min baad banata hai (camera ⏺ Rec ON hona zaroori)</div></div>`;
  let fc = '';
  if (e && Array.isArray(e.fc) && e.fc.length) fc = `<div class="gv-fcs">${e.fc.map((f, k) => { const w = nameOfFace(e, k), im = b64(f.im); return `<button type="button" class="gv-fc${w.n ? ' ok' : ' q'}" data-gv-fc="${k}"${own ? '' : ' disabled'}>${im ? `<img src="data:image/jpeg;base64,${im}" alt="">` : ''}${esc(w.n || (w.g ? w.g + '?' : '❓ Kaun?'))}${w.man ? ' ✓' : ''}</button>`; }).join('')}</div>`;
  const L = e && e.lb, n0 = e ? Math.abs((e.out || 0) - (e.in || 0)) || (e.out || 0) || (e.in || 0) : 0;
  const lbr = e && canLb ? `<div class="gv-lbr"><button type="button" class="gn-chip${L && L.k === 'ok' ? ' is-in' : ''}" data-gv-lb="ok">✓ Sahi</button><input class="gv-n" data-gv-n type="number" inputmode="numeric" min="0" max="999" value="${L && L.k === 'n' ? L.n : n0}" aria-label="Asal ginti"><button type="button" class="gn-chip${L && L.k === 'n' ? ' is-in' : ''}" data-gv-lb="n">🔢 Ginti</button><button type="button" class="gn-chip gn-no${L && L.k === 'x' ? ' is-in' : ''}" data-gv-lb="x">✕ Ghalat</button>${b ? `<span class="gn-mut">${esc(b)}</span>` : L ? `<span class="gn-mut">${esc(L.nm || '')} · ${ago(L.at)} pehle</span>` : ''}</div>` : '';
  const ref = e ? `${e.st === 'bina' ? '🚨 Bina note — malik ko WhatsApp gaya' : e.refNo ? '🧾 ' + esc(e.refNo) : ''}${e.lab && e.lab.n ? ' · 📦 ' + esc(e.lab.n) : ''}` : `🧾 Transfer note #${esc(r.d.no || '')} · ${hm(r.d.t)} — note bana magar camera ne maal nikalte nahi dekha. Video dekh kar batayein.`;
  return `<div class="gn-x2" data-gv-in="1">${vids}${fc}${ref ? `<div class="gn-xr">${ref}</div>` : ''}${lbr}</div>`;
}

// ---------- video (hissa hissa — paint ke beech chalti rahe) ----------
function vidMount() {
  const d = $('gvDlg'); if (!d) return;
  for (const slot of d.querySelectorAll('[data-gv-slot]')) {
    const cid = slot.dataset.gvSlot, c = clips.get(cid); if (!c || c.st !== 'ok') continue;
    let v = VEL.get(cid);
    if (!v) { v = document.createElement('video'); v.playsInline = true; v.muted = true; v.controls = true; v.preload = 'auto'; v.dataset.i = '0'; VEL.set(cid, v); v.addEventListener('ended', () => nextSeg(cid, v)); loadSeg(cid, v, 0, true); }
    if (v.parentNode !== slot) slot.append(v);
  }
}
async function segUrl(cid, i) {
  const key = cid + '#' + i; if (URLS.has(key)) return URLS.get(key);
  const c = clips.get(cid), sg = c && Array.isArray(c.segs) ? c.segs : null; if (!sg || !sg[i]) return '';
  const u8 = await cloud.getBillClipSeg(cid, i, sg[i].n); if (!u8 || !u8.length) return '';
  const u = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' })); URLS.set(key, u); return u;
}
async function loadSeg(cid, v, i, play) {
  try { const u = await segUrl(cid, i); if (!u || VEL.get(cid) !== v) return; v.dataset.i = String(i); v.src = u; if (play) v.play().catch(() => {}); const c = clips.get(cid); if (c && Array.isArray(c.segs) && c.segs[i + 1]) segUrl(cid, i + 1).catch(() => {}); }
  catch (e) { const s = v.parentNode; if (s && !s.querySelector('.gv-vm')) s.insertAdjacentHTML('beforeend', `<div class="gv-vm">✕ video nahi khuli: ${esc(e?.message || e)}</div>`); }
}
function nextSeg(cid, v) { const c = clips.get(cid), i = Number(v.dataset.i) + 1; if (c && Array.isArray(c.segs) && c.segs[i]) loadSeg(cid, v, i, true); }

// ---------- 🙂 chehra: kaun hai? (sirf malik) ----------
function people() {
  const M = new Map(); for (const h of hz) M.set(h.k, { k: h.k, n: h.n, code: h.code });
  for (const f of faces) if (f.k && !M.has(f.k)) M.set(f.k, { k: f.k, n: f.n || f.k });
  for (const p of M.values()) { const F = faces.filter(f => f.k === p.k); p.cnt = F.length; p.ok = F.filter(f => f.ok === 1).length; p.th = (F.find(f => f.th && !f.al) || F.find(f => f.th) || {}).th || ''; }
  return [...M.values()].sort((a, b) => (a.code || 999) - (b.code || 999) || a.n.localeCompare(b.n));
}
function personOf(k) { return people().find(p => p.k === k) || { k, n: k, cnt: 0, ok: 0 }; }
function pickHTML() {
  const e = evs.find(x => x.id === pick?.ev), f = e && (e.fc || [])[pick.i]; if (!f) return '<div class="gn-body"><p class="gn-mut">Chehra nahi mila.</p></div>';
  const im = b64(f.im), q = pq.trim().toLowerCase(), P = people().filter(p => !q || p.n.toLowerCase().includes(q) || String(p.code || '') === q);
  return `<div class="gn-body">
    <div class="gn-row">${im ? `<img src="data:image/jpeg;base64,${im}" alt="" style="width:96px;height:96px;border-radius:14px">` : ''}<span class="gn-mut">Video ka chehra · ${f.g ? 'andaza: ' + esc(f.g) + '?' : 'pehchana nahi'}${f.s ? ' · milan ' + Math.round(f.s * 100) + '%' : ''}</span></div>
    <label class="gn-search"><input data-gv-pq placeholder="🔍 Naam / code" value="${esc(pq)}" autocomplete="off"></label>
    <div class="gv-pp">${P.map(p => `<button type="button" class="gv-pb" data-gv-pk="${esc(p.k)}" data-gv-pn="${esc(p.n)}">${p.th ? `<img src="data:image/jpeg;base64,${p.th}" alt="">` : '<span class="gv-ph">👤</span>'}<span>${p.code ? p.code + ' · ' : ''}${esc(p.n)}</span></button>`).join('') || '<p class="gn-mut">Koi naam nahi mila.</p>'}</div>
    <div class="gn-row"><input class="gn-in" data-gv-nn placeholder="＋ Naya naam" maxlength="30" style="width:180px"><button type="button" class="gn-chip" data-gv-nadd="1">＋ Is naam se</button></div>
    <div class="gn-row"><button type="button" class="gn-chip gn-no" data-gv-pk="" data-gv-pn="">🚫 Kisi ka nahi / ghalat chehra</button></div>
  </div>`;
}
async function setFace(k, n) {
  const p = pick; if (!p) return; view = 'list'; pick = null; busy.set(p.ev, '⏳ naam'); paint();
  try { await cloud.gintiFace(p.ev, p.i, { k, n }); busy.set(p.ev, k ? `✅ ${n} — PC 1 min mein seekh lega` : '✅ hata diya'); } catch (e) { busy.set(p.ev, '✕ ' + (e?.message || e)); }
  paint(); setTimeout(() => { busy.delete(p.ev); if (view === 'list') paint(); }, 3500);
}

// ---------- 👤 larkon ki tasveerein (sirf malik) ----------
function faceHTML() {
  if (!fsel) {
    const P = people(), f = pc && typeof pc.face === 'object' ? pc.face : null;
    return `<div class="gn-body"><p class="gn-hint">Har larke ki <b>5–10 saaf tasveerein</b> (saamne se, roshni mein, alag din / kapde). PC un se chehra pehchanna seekhta hai — video par naam aata hai. Tasveerein sirf aap aur dukan ka PC dekh sakte hain.</p>
      ${f ? `<div class="gn-pcl">🖥 PC: ${f.m === 'ok' ? `✓ ${f.ppl} larkon ki pehchan · ${f.n} tasveerein${f.q ? ` · ⏳ ${f.q} baqi` : ''}` : esc(String(f.m))}${f.err ? ' · ⚠️ ' + esc(f.err) : ''}</div>` : ''}
      <div class="gv-pp">${P.map(p => `<button type="button" class="gv-pb" data-gv-ps="${esc(p.k)}">${p.th ? `<img src="data:image/jpeg;base64,${p.th}" alt="">` : '<span class="gv-ph">👤</span>'}<span>${p.code ? p.code + ' · ' : ''}${esc(p.n)}</span><small>${p.cnt ? `📷 ${p.ok}/${p.cnt}` : '＋'}</small></button>`).join('') || '<p class="gn-mut">Hazri ke code abhi nahi aaye — neeche naya naam likh kar shuru karein.</p>'}</div>
      <div class="gn-row"><input class="gn-in" data-gv-nn placeholder="＋ Naya naam (hazri mein na ho)" maxlength="30" style="width:200px"><button type="button" class="gn-chip" data-gv-pnew="1">＋ Jorein</button></div></div>`;
  }
  const p = personOf(fsel), F = faces.filter(f => f.k === fsel).sort((a, b) => b.at - a.at), b = busy.get('face') || '';
  return `<div class="gn-body">
    <div class="gn-row"><label class="gn-chip gn-save is-in gv-add">📷 Tasveer lo / chuno<input type="file" accept="image/*" multiple data-gv-up="1"></label>${b ? `<span class="gn-mut">${esc(b)}</span>` : `<span class="gn-mut">${F.length} tasveerein · ✅ ${F.filter(f => f.ok === 1).length} ki pehchan bani</span>`}</div>
    <div class="gv-ths">${F.map(f => `<div class="gv-th${f.ok === 1 ? ' ok' : f.ok === 0 ? ' bad' : ''}">${f.th ? `<img src="data:image/jpeg;base64,${f.th}" alt="">` : ''}<span class="gv-ts">${f.ok === 1 ? '✅ pehchan bani' : f.ok === 0 ? '✕ ' + esc(f.why) : '⏳ PC dekh raha'}${f.al ? ' · 🎥 video se' : ''}</span><button type="button" class="gv-del" data-gv-del="${esc(f.id)}" aria-label="Hatao">🗑</button></div>`).join('') || '<p class="gn-mut">Abhi koi tasveer nahi — upar 📷 se lein.</p>'}</div>
  </div>`;
}
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(Error('tasveer nahi khuli')); }; im.src = u; }); }
async function jpg(im, max, q) {
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
  const bl = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); return new Uint8Array(await bl.arrayBuffer());
}
async function upload(files) {
  const p = personOf(fsel); let n = 0, bad = 0;
  for (const f of files) {
    busy.set('face', `⏳ ${n + bad + 1}/${files.length} bhej raha…`); paint();
    try { const im = await loadImg(f), big = await jpg(im, 800, 0.86), th = await jpg(im, 140, 0.72); await cloud.addFaceRef({ k: p.k, n: p.n, im: big, th }); n++; } catch (e) { bad++; notice('Tasveer nahi gayi: ' + (e?.message || e)); }
  }
  busy.set('face', `✅ ${n} tasveer${n === 1 ? '' : 'ein'} gayi${bad ? ` · ✕ ${bad}` : ''} — PC 1 min mein pehchan banata hai`); paint();
  setTimeout(() => { busy.delete('face'); if (view === 'face') paint(); }, 4000);
}

// ---------- paint + clicks ----------
function paint() {
  const d = $('gvDlg'); if (!d) return;
  if (view === 'face') { d.innerHTML = head() + faceHTML(); return; }
  if (view === 'pick') { d.innerHTML = head() + pickHTML(); return; }
  const y = d.querySelector('.gn-body')?.scrollTop;
  d.innerHTML = head() + `<div class="gn-body">${patHTML()}${help ? helpHTML() : ''}${listHTML()}</div>`;
  vidMount(); void y;
}
async function setLb(r, k) {
  const e = r.e; if (!e) return; const nIn = $('gvDlg')?.querySelector('[data-gv-n]'), n = Math.max(0, Math.round(Number(nIn?.value) || 0));
  const same = e.lb && e.lb.k === k && (k !== 'n' || e.lb.n === n);
  busy.set(r.id, '⏳'); paint();
  try { await cloud.gintiLb(e.id, same ? null : { k, n: k === 'n' ? n : 0, nm: whoF() || (own ? 'Malik' : '') }); busy.set(r.id, same ? '↩ hata diya' : '✅ yaad'); }
  catch (er) { busy.set(r.id, '✕ ' + (er?.message || er)); }
  paint(); setTimeout(() => { busy.delete(r.id); if (view === 'list') paint(); }, 2200);
}
function onClick(ev) {
  const t = ev.target, g = s => t.closest(s);
  if (g('[data-gv-close]')) { $('gvDlg')?.close(); return; }
  if (g('[data-gv-back]')) { window.ntGvClose(); return; }
  if (g('[data-gv-menu]')) { menu = !menu; paint(); return; }
  if (menu && !g('.gn-menu')) { menu = false; paint(); return; }
  const dy = g('[data-gv-day]'); if (dy) { dayN = Number(dy.dataset.gvDay) || 0; menu = false; open = ''; evs = []; docs = []; clips = new Map(); watch(); paint(); return; }
  const fl = g('[data-gv-f]'); if (fl) { flt = fl.dataset.gvF || ''; menu = false; paint(); return; }
  if (g('[data-gv-help]')) { menu = false; help = !help; paint(); return; }
  if (g('[data-gv-face]')) { menu = false; view = 'face'; fsel = ''; paint(); return; }
  const tg = g('[data-gv-tg]'); if (tg && own) { const k = tg.dataset.gvTg, on = gcfg ? gcfg[k] === false : false; menu = false; cloud.saveGintiCam({ [k]: on }).then(() => notice(`${k === 'pz' ? '🧍 Pose' : '🙂 Chehra'} ${on ? 'chalu' : 'band'} — PC 1 min mein`)).catch(e => notice('Nahi hua: ' + (e?.message || e))); paint(); return; }
  // face (larkon ki tasveerein)
  const ps = g('[data-gv-ps]'); if (ps) { fsel = ps.dataset.gvPs; paint(); return; }
  if (g('[data-gv-pnew]')) { const i = $('gvDlg').querySelector('[data-gv-nn]'), n = String(i?.value || '').replace(/\s+/g, ' ').trim(); if (!n) { notice('Naam likhein'); return; } const k = 'n-' + slug(n); if (!slug(n)) { notice('Naam angrezi harf mein likhein'); return; } hz.push({ k, n }); fsel = k; paint(); return; }
  const del = g('[data-gv-del]'); if (del) { if (!confirm('Yeh tasveer hata dein? (pehchan se bhi nikal jayegi)')) return; cloud.delFaceRef(del.dataset.gvDel).then(() => notice('🗑 Hata di')).catch(e => notice('Nahi hati: ' + (e?.message || e))); return; }
  // pick (kaun hai)
  const pk = g('[data-gv-pk]'); if (pk && view === 'pick') { setFace(pk.dataset.gvPk, pk.dataset.gvPn); return; }
  if (g('[data-gv-nadd]')) { const i = $('gvDlg').querySelector('[data-gv-nn]'), n = String(i?.value || '').replace(/\s+/g, ' ').trim(); if (!n || !slug(n)) { notice('Naam angrezi harf mein likhein'); return; } setFace('n-' + slug(n), n); return; }
  // list
  const fc = g('[data-gv-fc]'); if (fc && own) { const r = g('[data-gv-row]'); if (!r) return; pick = { ev: r.dataset.gvRow, i: Number(fc.dataset.gvFc) || 0 }; pq = ''; view = 'pick'; paint(); return; }
  const lb = g('[data-gv-lb]'); if (lb) { const id = g('[data-gv-row]')?.dataset.gvRow, r = rowsOf(true).find(x => x.id === id); if (r) setLb(r, lb.dataset.gvLb); return; }
  if (g('[data-gv-in]')) return;   // khule hisse ke andar tap = band nahi
  const row = g('[data-gv-row]'); if (row) { const id = row.dataset.gvRow; open = open === id ? '' : id; vidFree(); paint(); return; }
}
function onInput(ev) {
  const t = ev.target;
  if (t.matches('[data-gv-pq]')) { pq = t.value; const pos = t.selectionStart; paint(); const i = $('gvDlg')?.querySelector('[data-gv-pq]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch {} } }
}
function onChange(ev) {
  const t = ev.target;
  if (t.matches('[data-gv-up]') && t.files && t.files.length) { const F = [...t.files].slice(0, 12); t.value = ''; upload(F); }
}
