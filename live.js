// live.js — 🔴 COUNTER CAMERA KI LIVE VIDEO (v2.215.0, 2026-11-09) — WebRTC: video SEEDHA shop PC se phone (PC pc/live-cam.js)
// Malik: "kya direct live nahi chal sakti, koi tareeqa nikalo · only live video wala chahiye".
// Raasta: phone offer (SDP) → liveReq/<id> {pc: counter ka naam} → PC answer {ans} → video PC → phone (Firestore se nahi guzarti).
// Counter ka camera channel / NVR password app ko KABHI nahi milta (PC malik ki setting se leta hai). Har 15 s `hb` — band / chhupa = PC 45 s mein band.
// Rabta na bane (kuch mobile networks) = saaf paigham, khamosh nahi. AI NAHI.
// v2.222.0 (malik: "bill na ban raha ho tab bhi live · bill banana start ho to screen par aa jaye"): counter list camera setting se bhi (billClipPc.pcs, tally.js);
//   PC pos-sales-dekho v2.7 bante hue bill ko counter ke login se pehchanta hai (d.src 'chalu') — pehli item se patti par; koi na ban raha ho = pichhla (src 'aakhri').
// v2.219.0: 🧾 LIVE BILL PATTI — malik: "camera ke upar transparent patti, ek side par item ke naam — jis waqt NT print par item aaye usi waqt camera par bhi".
//   PC pos-sales-dekho v2.6 dekhe ja rahe counter ka aakhri bill har 1 s posLive/<counter> mein → yahan daayein taraf patti: naya item hara chamke,
//   hataya laal kata (12 s), tadad badli peeli; upar #bill + ⏳ ban raha / 🖨 Print ✓ / 📌 Post ✓; neeche items + Kul. 🧾 chip = patti chhupao / dikhao (phone yaad).
// v2.348.0: 🏬 GODAM — SAB EK SAATH (malik 22 Nov: 'live ma godam ka cameras akhetha chahie'): pehla chip '🏬 Godam' → liveReq pc '@godam' → PC live-cam v1.9
//   saare godam cameras jor kar EK video (2 = aamne saamne, 3-4 = 2x2, 5-6 = 3x2) + jawab mo {c, r, n}. Video ke upar har khane par naam (#lvMo, container units —
//   html zoom se farq nahi); khane par tap = wohi camera akela, '‹ 🏬 Sab' / phone back = wapas sab. Godam par bill patti / POS screen nahi (counter nahi). AI nahi.
// v2.321.0: 🖐 POS screen ka dabba KHISKAO + chhota / bara (malik 18 Nov: 'background nazar nahi aa raha — movable, hum khud aage peeche karein'):
//   landscape / PC par dabbe ki upar wali patti pakar kar ghaseeto, neeche daayein kone (◢) se naap; jagah + naap har phone / PC par yaad (sam-lv-shotpos,
//   lv-body ke hisse % mein — html zoom se farq nahi). ↺ = pehli jagah. Phone seedha (portrait) = pehle jaisa (dabba video ke neeche). AI nahi.
// v2.360.0: 🎛 SAB CAMERAS EK SCREEN (malik 23 Nov: 'aik screen jis par sab cameras aik saath · gate pass bane to godam wali par gate pass, bill wali par bill ki screen live'):
//   chip '🎛 Sab cameras' (CAP nz.sab) → liveReq pc '@sab' → PC live-cam v2.0 counter + godam + mazeed cameras EK video (9 tak) + mo {n, k:[c|g|x], g:[godam]}.
//   Har khane ke upar (#lvMo .lv-tb, sirf kinara + kaale kinare wali likhai — rang / blur nahi): counter = banta bill (posLive) + POS screen ki tasveer
//   (aakhri item par); godam = us godam ka taza gate pass (gatePass — WAHI data, ✓ diya hua; sab ✓ ke 20 s baad / 10 min baad khud hat-ta). Tap = wohi camera akela. AI nahi.
// v2.370.0: 🧾 COUNTER KE KHANE PAR ITEMS KE NAAM + 🖨 BILL CHIPS + ⏰ RUKE BILLS (malik 24 Nov: 'live items ke names aayein · pehle bill bane items ke names ·
//   us ke baad bill ka number aur amount side par · bill post ho to wahan se ghayab · koi bill 30 minute tak post na ho to video ke saath alag screen mein · sab auto ·
//   screen yahi · 5 bills ikathe'): counter NT-PRINT v1.36 dekhte waqt har scan ka barcode posLive/<naam>__scan → PC pos-sales-dekho v2.17 naam (posLive.sn).
//   Khane ke daayein = BANTA BILL (counter ke aakhri chhape bill ke baad ke scan, naya upar, ×ginti); baayein = us counter ke chhape magar post na hue bill
//   (🖨 #no · Rs, naya upar, 5 + '+N') — post / cancel hote hi khud ghayab (posSales). Haath se likhi item print ke baad (POS SQL mein print par hi likhta hai).
//   Purana NT-PRINT (scan ka doc nahi) = pehle jaisa (POS screen ki tasveer). ⏰ chip = aaj ke bill jo chhapne ke 30 min baad bhi post nahi — har bill ka ▶ video
//   (billClip; na ho to 🎬 maango = billClipReq) + items; post hote hi list se khud hat-ta. AI nahi.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
// v2.378.0: 🔁 RELAY (TURN) — malik 25 Nov: 'WiFi pr shi chlta ha' (4G par '✕ Rabta nahi bana' — mobile network seedha PC → phone rasta nahi banne deta).
//   PC live-cam v2.9 malik ki Cloudflare chaabi se 24 ghante ka chhota pass liveIce/cur mein likhta hai → yahan STUN ke saath TURN; offer se pehle relay candidate
//   ka intezar (3 s tak). Seedha rasta mile to seedha hi (relay sirf zaroorat par). Juda = getStats se rasta (🔁 relay / seedha) 🩺 chip ki baat mein.
//   Pass na ho / na mile = pehle jaisa sirf STUN (kuch nahi tootta). AI NAHI.
let ICE = null, iceT = 0, iceP = null, stT = 0;
function iceGet() {
  if (ICE && Date.now() - iceT < (ICE.none ? 120000 : 600000) && (ICE.none || ICE.exp - Date.now() > 20 * 60000)) return Promise.resolve(ICE.L);
  if (iceP) return iceP;
  iceP = (async () => {
    try {
      const d = cloud?.getLiveIce ? await cloud.getLiveIce() : null; let L = null;
      try { L = d && d.j ? JSON.parse(d.j) : null; } catch {}
      L = Array.isArray(L) ? L.filter(s => s && s.urls && s.username && s.credential) : [];
      ICE = L.length && Number(d.exp) - Date.now() > 20 * 60000 ? { L, exp: Number(d.exp) } : { L: null, none: 1 };
    } catch { ICE = { L: null, none: 1 }; }
    iceT = Date.now(); iceP = null; return ICE.L;
  })();
  return iceP;
}
async function viaOf(pc) {   // juda hua rasta: relay (Cloudflare) ya seedha
  try {
    const st = await pc.getStats(); let pair = null;
    st.forEach(x => { if (!pair && x.type === 'transport' && x.selectedCandidatePairId) pair = st.get(x.selectedCandidatePairId); });
    if (!pair) st.forEach(x => { if (!pair && x.type === 'candidate-pair' && x.nominated && x.state === 'succeeded') pair = x; });
    if (!pair) return '';
    const l = st.get(pair.localCandidateId), r = st.get(pair.remoteCandidateId);
    return (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay') ? 'relay' : 'seedha';
  } catch { return ''; }
}
let xcs = [];   // v2.329.0: 📹 mazeed cameras (chip par 📹)
// v2.368.0: 🎛 DABBE SCREEN KE HISAAB SE (malik 23 Nov: 'dabbon ka size screen ke mutabiq adjust · upar neeche aur chhota bara apni marzi se'): PC ki EK mosaic video
//   app mein har camera ka alag dabba (canvas, `TL`) — video ke us hisse se khinchta hai. ▦ chip = Auto (sab dabbe bina scroll ke sab se bare) · 1 · 2 · 3 fi qatar
//   ('sam-lv-cols'); dabba daba kar rakho = ▲ ▼ ✓ (tarteeb 'sam-lv-ord:<@sab|@godam>', sirf is phone par). Tap = wohi camera akela (pehle jaisa). PC nahi badla.
const GD = '@godam', ALL = '@sab', isMoP = p => p === GD || p === ALL; let MO = null, moBack = false, moHome = GD;   // v2.348.0: 🏬 sab godam cameras ek video
const lvLbl = p => p === ALL ? '🎛 Sab cameras' : p === GD ? '🏬 Godam (sab)' : `${xcs.includes(p) ? '📹' : '🖥'} ${esc(p)}`, lvName = p => p === ALL ? 'Sab cameras' : p === GD ? 'Godam cameras' : p;
let cloud = null, notice = () => {}, list = [], cur = '', S = null, pcSt = null, pcStop = null, VP8 = false;   // VP8: v2.223.0 phone H.264 na chala sake to
let B = { un: null, sid: 0, prev: new Map(), del: [], fl: new Map(), recv: 0, doc: null, t: null, cnt: 0 };
const bOn = () => { try { return localStorage.getItem('sam-lv-bill') !== '0'; } catch { return true; } };
// v2.377.0: ⏪ SAAF — PC ki apni recording files se ~2 min peeche (malik 24 Nov: 'PC khud se live banaye jo kuch minute peeche chale') · liveReq pc '<naam>~' (PC live-cam v2.7)
const dlOn = () => { try { return localStorage.getItem('sam-lv-dl') === '1'; } catch { return false; } };
const pcOld = () => { const a = String(pcSt?.ver || '').split('.').map(Number); return a.length > 1 && (a[0] < 2 || (a[0] === 2 && (a[1] || 0) < 7)); };

export function openLive(o) {
  cloud = o.cloud; notice = o.notice || notice; xcs = Array.isArray(o.xc) ? o.xc : []; list = (o.list || []).filter(Boolean); list = [...(o.sab ? [ALL] : []), GD, ...list.filter(x => !isMoP(x))]; MO = null; moBack = false; cur = o.cur && list.includes(o.cur) ? o.cur : (list.find(x => !isMoP(x)) || list[0] || '');
  { let last = ''; try { last = localStorage.getItem('sam-lv-last') || ''; } catch {} if (isMoP(last) && list.includes(last)) { cur = last; moHome = last; } }   // v2.361.0: pichhli dafa 'Sab cameras' / 'Godam' tha = seedha wohi (khirki khulte hi jurna shuru)
  let d = $('lvDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'lvDlg'; d.className = 'lv-dlg'; document.body.append(d); d.addEventListener('cancel', ev => { ev.preventDefault(); closeLive(); }); }
  d.innerHTML = `<div class="lv-head"><b>🔴 Live</b><span class="lv-chips">${list.map(p => `<button type="button" data-lv-pc="${esc(p)}" class="${p === cur ? 'is-in' : ''}${isMoP(p) ? ' lv-gd' : ''}">${lvLbl(p)}</button>`).join('') || '<small>Koi counter nahi mila — malik ⚙️ Bill tally setup mein counter ↔ camera jorein</small>'}</span><button type="button" class="lv-bt ${bOn() ? 'is-in' : ''}" data-lv-bt="1" title="Bill ki patti">🧾</button><button type="button" class="lv-x" data-lv-x="1">×</button></div>
    <div class="lv-body"><video id="lvVid" playsinline muted autoplay></video><div class="lv-st" id="lvSt">⏳ jor raha…</div><div class="lv-shot" id="lvShot" hidden></div><div class="lv-bill" id="lvBill" ${bOn() ? '' : 'hidden'}></div>
      <div class="lv-tools"><button type="button" class="lv-mob" id="lvMoB" data-lv-mob="1" hidden>‹ 🏬 Sab</button><button type="button" class="lv-q" id="lvQ" data-lv-q="1" hidden></button><button type="button" class="lv-cols" id="lvCols" data-lv-cols="1" hidden>▦ Auto</button><button type="button" class="lv-rk is-z" id="lvRk" data-lv-rk="1" title="Chhape magar 30 min se post nahi">⏰ Ruke …</button><button type="button" class="lv-dl${dlOn() ? ' is-in' : ''}" data-lv-dl="1" title="PC ki recording se — 2 min peeche, grey nahi">⏪ Saaf</button><button type="button" data-lv-re="1">🔄 Dobara</button><button type="button" data-lv-full="1">⛶</button></div></div>`;
  d.onclick = ev => {
    const t = ev.target;
    if (t.closest('[data-lv-x]')) { closeLive(); return; }
    const c = t.closest('[data-lv-pc]'); if (c) { cur = c.dataset.lvPc; moBack = false; if (isMoP(cur)) moHome = cur; d.querySelectorAll('[data-lv-pc]').forEach(x => x.classList.toggle('is-in', x === c)); start(); return; }
    const mv = t.closest('[data-lv-mv]'); if (mv) { const b = mv.closest('.lv-mot'); if (b) tlMove(b, Number(mv.dataset.lvMv)); return; }   // v2.368.0
    if (t.closest('[data-lv-cols]')) { const L = ['a', '1', '2', '3'], nx = L[(L.indexOf(tlCols()) + 1) % L.length]; try { localStorage.setItem(TL_K, nx); } catch {} tlLayout(); return; }
    const mt = t.closest('[data-lv-mo]'); if (mt) { if (Date.now() - TL.lpT < 700) return; if (TL.arr) { tlMove(TL.arr, 0); return; } moGo(mt.dataset.lvMo); return; }   // v2.348.0: khane par tap = wohi camera akela
    if (t.closest('[data-lv-mob]')) { moGo(moHome); return; }
    if (t.closest('[data-lv-rk]')) { rkOpen(); return; }   // v2.370.0: ⏰ Ruke bills
    const dlb = t.closest('[data-lv-dl]'); if (dlb) { const on = !dlOn(); try { localStorage.setItem('sam-lv-dl', on ? '1' : '0'); } catch {} dlb.classList.toggle('is-in', on); notice(on ? '⏪ Saaf — PC ki recording se, 2 min peeche (grey nahi)' : '🔴 Asal live — usi waqt'); start(); return; }   // v2.377.0
    if (t.closest('[data-lv-re]')) { start(); return; }
    const qb = t.closest('[data-lv-q]'); if (qb) { notice(qb.dataset.why || ''); return; }   // v2.322.0: 🩺 poori baat
    if (Date.now() - SPM < 450) return;   // v2.321.0: khiskane ke foran baad wala click (bara / chhota nahi)
    if (t.closest('[data-lvs-re]')) { spReset(); return; }
    if (t.closest('#lvShot .lvs-h, #lvShot .lvs-rz')) return;   // patti / kona = khiskana
    if (t.closest('#lvShot')) { const e = $('lvShot'); e.classList.toggle('is-fit'); SH.touch = 0; setTimeout(() => shotFollow(e.querySelector('img')), 60); try { localStorage.setItem('sam-lv-shotfit', e.classList.contains('is-fit') ? '1' : '0'); } catch {} return; }
    const bt = t.closest('[data-lv-bt]'); if (bt) { const on = !bOn(); try { localStorage.setItem('sam-lv-bill', on ? '1' : '0'); } catch {} bt.classList.toggle('is-in', on); const e = $('lvBill'); if (e) e.hidden = !on; return; }
    if (t.closest('[data-lv-full]')) { const v = $('lvVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (d.querySelector('.lv-body') || v).requestFullscreen?.(); } catch {} return; }
  };
  if (!d.open) d.showModal();
  spWire(d); setTimeout(spApply, 0);   // v2.321.0
  if (!pcStop && cloud.listenLiveCamPc) pcStop = cloud.listenLiveCamPc(s => { pcSt = s; });
  rkSync();   // v2.370.0: aaj ke bill (khane ke 🖨 chips + ⏰ Ruke bills)
  if (cur) start(); else stat('✕ Koi counter nahi', true);
}
function stat(t, bad) { const e = $('lvSt'); if (!e) return; e.textContent = t; e.classList.toggle('bad', !!bad); e.hidden = false; }
function stop(sendEnd) {
  const s = S; S = null; if (!s) return;
  clearInterval(s.hb); clearTimeout(s.to); clearInterval(s.fr); clearInterval(s.cn); try { s.unsub && s.unsub(); } catch {}
  try { s.pc.close(); } catch {}
  if (sendEnd && s.id && cloud.liveEnd) cloud.liveEnd(s.id).catch(() => {});
  const v = $('lvVid'); if (v) v.srcObject = null;
}
export function closeLive() { RES = false; MO = null; moBack = false; rkClose(); rkStop(); tlStop(); tbStop(); billStop(); stop(true); const d = $('lvDlg'); try { d?.close(); } catch { d?.removeAttribute('open'); } try { pcStop && pcStop(); } catch {} pcStop = null; }
window.ntLvClose = () => { const d = $('lvDlg'); if (!d?.open) return false; if ($('lvRkDlg')?.open) { rkClose(); return true; } if (moBack && !isMoP(cur)) { moGo(moHome); return true; } closeLive(); return true; };   // v2.348.0: pehle wapas sab godam
function moGo(p) {   // v2.348.0
  if (isMoP(p)) { moBack = false; moHome = p; } else moBack = true; cur = p;
  $('lvDlg')?.querySelectorAll('[data-lv-pc]').forEach(x => x.classList.toggle('is-in', x.dataset.lvPc === p)); start();
}
function moPaint(mo) {   // v2.348.0: video ke upar har khane par naam — tap = wohi camera
  const body = $('lvDlg')?.querySelector('.lv-body'); if (!body) return; let e = $('lvMo');
  if (!mo || !Array.isArray(mo.n) || !mo.n.length) { if (e) e.remove(); tlStop(); tbStop(); const cb = $('lvCols'); if (cb) cb.hidden = true; return; }
  const c = Math.max(1, Number(mo.c) || 1), r = Math.max(1, Number(mo.r) || 1), sig = JSON.stringify([c, r, mo.n, mo.k || 0, mo.g || 0]), K = Array.isArray(mo.k) ? mo.k : [];
  if (e && e.dataset.sig === sig) return;
  if (!e) { e = document.createElement('div'); e.id = 'lvMo'; e.className = 'lv-mo tl'; const v = $('lvVid'); v ? v.after(e) : body.append(e); tlWire(e); }
  e.dataset.sig = sig; TL.mo = mo; TL.c = c; TL.r = r;
  e.innerHTML = `<div class="lv-tlg">${tlOrder(mo).map(i => `<button type="button" class="lv-mot" data-lv-mo="${esc(mo.n[i])}" data-i="${i}"><canvas></canvas><span>${K[i] === 'c' ? '🖥 ' : K[i] === 'g' ? '🏬 ' : K.length ? '📹 ' : ''}${esc(mo.n[i])}</span><div class="lv-tb" data-tb="${i}"></div><div class="lv-tbc" data-tbc="${i}"></div><div class="lv-mv"><b data-lv-mv="-1">▲</b><b data-lv-mv="1">▼</b><b data-lv-mv="0">✓</b></div></button>`).join('')}</div>`;
  const cb = $('lvCols'); if (cb) cb.hidden = false;
  tlLayout(); tlDraw();
  try { if (!localStorage.getItem('sam-lv-tlh')) { localStorage.setItem('sam-lv-tlh', '1'); notice('💡 Dabba daba kar rakhein = ▲ ▼ se upar neeche · ▦ = ek qatar mein kitne dabbe'); } } catch {}
  tbSync(cur === ALL && !dlOn() ? mo : null);   // v2.377.0: ⏪ saaf (2 min peeche) mein abhi ka bill / gate pass video se nahi milta — nahi dikhate
}

// ---------- 🎛 v2.368.0: dabbe — PC ki ek mosaic video se har camera ka alag canvas ----------
const TL_K = 'sam-lv-cols', tlOrdK = () => 'sam-lv-ord:' + cur;
let TL = { mo: null, c: 1, r: 1, t: 0, ro: null, lpT: 0, arr: null };
const tlCols = () => { try { const v = localStorage.getItem(TL_K) || 'a'; return ['a', '1', '2', '3'].includes(v) ? v : 'a'; } catch { return 'a'; } };
function tlOrder(mo) {   // dikhane ki tarteeb = mosaic ke index; nayi camera aakhir mein
  let ord = []; try { ord = JSON.parse(localStorage.getItem(tlOrdK()) || '[]'); } catch {} if (!Array.isArray(ord)) ord = [];
  const pos = i => { const j = ord.indexOf(mo.n[i]); return j < 0 ? 1e6 + i : j; };
  return mo.n.map((_, i) => i).sort((a, b) => pos(a) - pos(b));
}
function tlStop() { clearTimeout(TL.t); try { TL.ro && TL.ro.disconnect(); } catch {} TL = { mo: null, c: 1, r: 1, t: 0, ro: null, lpT: 0, arr: null }; }
function tlLayout() {   // Auto = sab dabbe bina scroll ke sab se bare · 1 / 2 / 3 = itne fi qatar (poori chaurai, zaroorat ho to scroll)
  const e = $('lvMo'), g = e && e.querySelector('.lv-tlg'), mo = TL.mo; if (!g || !mo) return;
  const n = mo.n.length, ar = (Number(mo.th) || 252) / (Number(mo.tw) || 448), gap = 3, W = Math.max(120, e.clientWidth - 6), H = Math.max(120, e.clientHeight - 56), set = tlCols();
  let best = 1, bw = 0;
  if (set === 'a') { for (let c = 1; c <= Math.min(n, 4); c++) { const rows = Math.ceil(n / c), w = Math.min((W - gap * (c - 1)) / c, (H - gap * (rows - 1)) / rows / ar); if (w > bw + 0.5) { bw = w; best = c; } } }
  else { best = Math.min(n, Number(set)); bw = (W - gap * (best - 1)) / best; }
  bw = Math.max(90, Math.floor(bw));
  g.style.gridTemplateColumns = `repeat(${best},${bw}px)`; g.style.setProperty('--th', Math.round(bw * ar) + 'px');
  const cb = $('lvCols'); if (cb) cb.textContent = '▦ ' + (set === 'a' ? 'Auto' : set);
}
function tlDraw() {   // ~10 dafa fi second video ke har hisse ko us ke dabbe mein (PC 6-8 fps bhejta hai)
  clearTimeout(TL.t); const mo = TL.mo, e = $('lvMo'), v = $('lvVid'); if (!mo || !e || !v) return;
  if (!document.hidden && v.videoWidth && v.videoHeight) {
    const sw = v.videoWidth / TL.c, sh = v.videoHeight / TL.r, W = Math.round(sw), H = Math.round(sh);
    for (const b of e.querySelectorAll('.lv-mot')) { const i = Number(b.dataset.i), cv = b.firstElementChild; if (!cv || cv.tagName !== 'CANVAS') continue;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      try { cv.getContext('2d', { alpha: false }).drawImage(v, (i % TL.c) * sw, Math.floor(i / TL.c) * sh, sw, sh, 0, 0, W, H); } catch {} }
  }
  TL.t = setTimeout(tlDraw, 100);
}
function tlWire(e) {   // lamba dabana (½ s) = ▲ ▼ ✓
  let tm = 0, x0 = 0, y0 = 0; const cancel = () => { clearTimeout(tm); tm = 0; };
  e.addEventListener('pointerdown', ev => { const b = ev.target.closest('.lv-mot'); if (!b || ev.target.closest('[data-lv-mv]')) return; x0 = ev.clientX; y0 = ev.clientY; cancel();
    tm = setTimeout(() => { tm = 0; TL.lpT = Date.now(); e.querySelectorAll('.lv-mot.is-ar').forEach(x => x.classList.remove('is-ar')); b.classList.add('is-ar'); TL.arr = b; try { navigator.vibrate && navigator.vibrate(25); } catch {} }, 520); });
  e.addEventListener('pointermove', ev => { if (tm && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cancel(); });
  e.addEventListener('pointerup', cancel); e.addEventListener('pointercancel', cancel); e.addEventListener('contextmenu', ev => ev.preventDefault());
  try { TL.ro = new ResizeObserver(() => tlLayout()); TL.ro.observe(e); } catch {}
}
function tlMove(b, dir) {
  if (!dir) { b.classList.remove('is-ar'); TL.arr = null; return; }
  const g = b.parentElement; if (!g) return;
  if (dir < 0) { const pv = b.previousElementSibling; if (pv) g.insertBefore(b, pv); } else { const nx = b.nextElementSibling; if (nx) g.insertBefore(nx, b); }
  try { localStorage.setItem(tlOrdK(), JSON.stringify([...g.children].map(x => TL.mo && TL.mo.n[Number(x.dataset.i)]).filter(Boolean))); } catch {}
  try { b.scrollIntoView({ block: 'nearest' }); } catch {}
}

// ---------- 🎛 v2.360.0: har khane ka apna data — counter = bill + POS screen · godam = gate pass ----------
let TB = { un: [], t: null, bill: new Map(), shot: new Map(), scan: new Map(), ocr: new Map(), gp: null, mo: null, cv: null, want: null, pcs: null };
const tbMs = v => typeof v === 'number' ? v : v?.toMillis ? v.toMillis() : v?.seconds ? v.seconds * 1000 : 0;
const tbDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function tbStop() { for (const f of TB.un) { try { f && f(); } catch {} } for (const o of TB.shot.values()) { try { o.url && URL.revokeObjectURL(o.url); } catch {} } clearInterval(TB.t); TB = { un: [], t: null, bill: new Map(), shot: new Map(), scan: new Map(), ocr: new Map(), gp: null, mo: null, cv: null, want: null, pcs: null }; }
function tbSync(mo) {
  tbStop(); if (!mo || !Array.isArray(mo.k) || !cloud) return; TB.mo = mo; TB.t0 = Date.now();
  mo.n.forEach((n, i) => {
    if (mo.k[i] !== 'c') return;
    if (cloud.listenPosLive) TB.un.push(cloud.listenPosLive(n, (d, err) => { if (err || !d || TB.mo !== mo) return; let L = [], sn = {}; try { L = JSON.parse(d.j || '[]'); } catch {} try { sn = JSON.parse(d.sn || '{}') || {}; } catch {} TB.bill.set(n, { d, L, sn, at: Date.now() }); tbPaint(i); }));
    if (cloud.listenPosScan) TB.un.push(cloud.listenPosScan(n, (d, err, cache) => { if (err || TB.mo !== mo) return; const o = TB.scan.get(n);
      // v2.371.0: 🩺 PC ki ghari ka farq — sirf taza (doosri ya baad wali, cache nahi) snapshot par: likhai ke ~1 s mein pohanchti hai
      if (d) TB.scan.set(n, { dat: Number(d.at) || 0, a: d.a || [], ver: d.ver || '', ok: d.ok, sc: d.sc, rw: d.rw, w: d.w, sp: d.sp, rd: d.rd, al: d.al, er: String(d.er || '').slice(0, 60), fg: String(d.fg || '').slice(0, 24), at: Date.now(), ns: (o ? o.ns : 0) + 1, sk: o && !cache && Number(d.at) ? Number(d.at) - Date.now() : (o ? o.sk : null) }); else TB.scan.delete(n); tbPaint(i); }));   // v2.370.0
    if (cloud.listenPosShot) TB.un.push(cloud.listenPosShot(n, (d, err, cache) => { if (err || cache || TB.mo !== mo) return; const o = TB.shot.get(n); try { o && o.url && URL.revokeObjectURL(o.url); } catch {}
      const on = d && Number(d.on) === 1 && d.im; TB.shot.set(n, { url: on ? URL.createObjectURL(new Blob([d.im], { type: 'image/jpeg' })) : '', at: Date.now(), ex: !!d, ver: d ? String(d.ver || '') : '', dat: d ? Number(d.at) || 0 : 0, why: d && !on ? String(d.why || '').slice(0, 140) : '' }); tbPaint(i); }));
    // v2.385.0: 🔤 POS screen ka OCR (counter NT-PRINT v1.39) — bante bill ki items ke naam + tadad
    if (cloud.listenPosOcr) TB.un.push(cloud.listenPosOcr(n, (d, err, cache) => { if (err || cache || TB.mo !== mo) return; TB.ocr.set(n, { d, rt: Date.now() }); tbPaint(i); }));
  });
  // v2.386.0: 🩺 khana kabhi khali nahi — server ka hukum (posLive/_want) + counter NT-PRINT ka haal (printPCs), wahi jo akele camera ki 🖥 patti dekhti hai
  if (mo.k.includes('c')) {
    if (cloud.listenPosLive) TB.un.push(cloud.listenPosLive('_want', (d, err) => { if (err || TB.mo !== mo) return; TB.want = d || {}; }));
    if (cloud.listenPrintPCs) TB.un.push(cloud.listenPrintPCs(L => { if (TB.mo === mo) TB.pcs = L || []; }));
  }
  if (mo.k.includes('g') && cloud.listenGatePass) TB.un.push(cloud.listenGatePass(tbDay(1), tbDay(0), list => { if (!list || TB.mo !== mo) return; TB.gp = list; tbAll(); }));
  TB.t = setInterval(tbAll, 5000);
}
function tbAll() { const mo = TB.mo; if (mo) mo.n.forEach((_, i) => tbPaint(i)); }
function tbGodam(i) {   // khane ka godam: PC ka bataya (gate pass godam camera / Loading ginti) warna naam ke hindse se ('Godam 2')
  const mo = TB.mo, g = Number((mo.g || [])[i]) || 0; if (g) return g;
  const m = String(mo.n[i] || '').match(/(\d+)/); if (!m) return 0;
  const re = new RegExp('go?dd?a+m\\s*' + m[1] + '(?!\\d)', 'i');
  for (const d of TB.gp || []) for (const [id, nm] of Object.entries(d.gn || {})) if (re.test(String(nm))) return Number(id) || 0;
  return 0;
}
function tbGate(i) {   // us godam ke khule gate pass: sab ✓ ke 20 s baad / 10 min baad khud hat jata
  const g = tbGodam(i), now = Date.now(), out = []; if (!g) return out;
  for (const d of TB.gp || []) {
    if (d.off) continue; const L = (d.l || []).filter(x => Number(x.g) === g); if (!L.length) continue;
    const tk = L.map(x => d.g && d.g[x.k] ? (tbMs(d.g[x.k].t) || now) : 0), done = tk.every(Boolean), t0 = Number(d.pt) || Number(d.at) || Number(d.tm) || 0;
    if (done ? now - Math.max(...tk) > 20000 : now - t0 > 10 * 60000) continue;
    out.push({ d, L, tk, t0 });
  }
  return out.sort((a, b) => b.t0 - a.t0);
}
function tbFollow(img) {   // POS list mein nayi item neeche judti hai — sab se lamba khali hissa dhoondo, us se upar wali qatar dikhao
  try {
    const box = img.parentElement; if (!box || !img.naturalWidth) return;
    const W = 120, H = Math.max(8, Math.round(img.naturalHeight * W / img.naturalWidth)), c = TB.cv || (TB.cv = document.createElement('canvas'));
    c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data; let best = 0, bs = -1, run = 0, rs = 0;
    for (let y = 0; y < H; y++) { let nw = 0; for (let j = y * W * 4, e = j + W * 4; j < e; j += 4) if (d[j] < 232 || d[j + 1] < 232 || d[j + 2] < 232) nw++;
      if (nw <= W * 0.03) { if (!run) rs = y; run++; if (run > best) { best = run; bs = rs; } } else run = 0; }
    box.scrollTop = best >= H * 0.1 && bs >= 0 ? Math.max(0, bs / H * img.clientHeight - box.clientHeight + 4) : 0;
    return best >= H * 0.88;   // v2.363.0: poori screen khali (bill chhap chuka) = sach
  } catch {}
  return false;
}
// ---------- 🔤 v2.385.0: POS screen ka OCR (counter NT-PRINT v1.39 — Windows ka apna OCR, internet / AI nahi) -> bante bill ki items ----------
// r = [[y, h, [[x, w, 'lafz'], ...]], ...] upar se neeche. Header (Code / Item Name / Qty …) mile to har lafz us ke khane mein; na mile = andaza (naam + hindse).
const OC_K = [['no', /^(s\s*no|s\s*#|sr(\s*no)?|no|#|sno|sl(\s*no)?)$/i], ['code', /^((item|bar)\s*)?(code|barcode)$/i], ['unit', /^(unit|uom)$/i],
  ['qty', /^(qty|quantity|pcs|pieces?|peices?|ctn|cartons?|crtn|pack\s*qty|packs?)$/i], ['rate', /(rate|price)/i], ['amt', /(amount|amt|total|net)/i],
  ['name', /(item|description|desc|name|product|particulars?|detail)/i]];
const ocKind = t => { const s = String(t || '').replace(/[.:]/g, '').replace(/\s+/g, ' ').trim(); for (const [k, re] of OC_K) if (re.test(s)) return k; return ''; };
const ocNum = t => { const s = String(t || '').replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; };
function ocCells(ws, gap) {   // paas paas wale lafz = ek khana
  const C = []; for (const [x, w, t] of ws) { const c = C[C.length - 1]; if (c && x - c.x2 <= gap) { c.t += ' ' + t; c.x2 = Math.max(c.x2, x + w); } else C.push({ x1: x, x2: x + w, t: String(t) }); } return C;
}
function ocParse(r) {
  const R = (Array.isArray(r) ? r : []).filter(x => Array.isArray(x) && Array.isArray(x[2]) && x[2].length);
  const hs = R.map(x => Number(x[1]) || 0).filter(Boolean).sort((a, b) => a - b), mh = hs[Math.floor(hs.length / 2)] || 12;
  const clean = s => String(s || '').split(/\s+/).filter(w => w && !/^\d{7,}$/.test(w)).join(' ').trim();   // naam mein ghus aaya barcode hatao
  const bad = s => !/[a-z]{2,}/i.test(s) || /^(total|grand|net\s|sub\s*total|items?\b|bill\b)/i.test(s);
  let hi = -1, cols = null;
  for (let i = 0; i < R.length && i < 8; i++) {   // header sirf upar ki 8 qataron mein
    const C = ocCells(R[i][2], mh * 0.8).map(c => ({ ...c, k: ocKind(c.t) })), K = new Set(C.map(c => c.k).filter(Boolean));
    if (K.size >= 3 || (K.size >= 2 && (K.has('name') || K.has('qty')))) { hi = i; cols = C; break; }
  }
  const items = [];
  if (cols) {
    const b = cols.slice(0, -1).map((c, j) => Math.max(c.x2, cols[j + 1].x1 - mh * 0.3)), hq = cols.filter(c => c.k === 'qty');
    const ys = R.slice(hi).map(x => Number(x[0]) || 0), ds = ys.slice(1).map((y, j) => y - ys[j]).filter(d => d > 0).sort((a, c) => a - c), md = ds[Math.floor(ds.length / 2)] || mh * 1.8;
    for (let i = hi + 1; i < R.length; i++) {
      if (i > hi + 1 && (Number(R[i][0]) || 0) - (Number(R[i - 1][0]) || 0) > md * 3.5) break;   // bara khali faasla = list khatam (neeche total waghera)
      const by = cols.map(() => []);
      for (const [x, w, t] of R[i][2]) { const cx = x + w / 2; let j = b.findIndex(v => cx < v); if (j < 0) j = cols.length - 1; by[j].push(t); }
      const nm = clean(cols.map((c, j) => c.k === 'name' ? by[j].join(' ') : '').filter(Boolean).join(' '));
      if (bad(nm)) continue;
      items.push({ nm, q: hq.map(c => ({ l: c.t, v: by[cols.indexOf(c)].join(' ') })).filter(o => o.v), un: cols.map((c, j) => c.k === 'unit' ? by[j].join(' ') : '').filter(Boolean).join(' ') });
    }
  } else {
    for (const x of R) {
      const C = ocCells(x[2], mh * 0.9).map(c => c.t.trim()).filter(Boolean);
      if (C.length && /^\d{1,3}[.)]?$/.test(C[0])) C.shift();   // qatar ka number
      const L = C.filter(t => !/^\d{7,}$/.test(t)), ni = L.findIndex(t => /[a-z]{2,}/i.test(t)); if (ni < 0) continue;
      const nm = clean(L[ni]); if (bad(nm)) continue;
      items.push({ nm, n: L.slice(ni + 1).filter(t => !isNaN(ocNum(t))).slice(0, 4) });
    }
  }
  return { hdr: !!cols, cols: cols ? cols.map(c => c.t) : [], items: items.slice(-40) };
}
function ocQ(it) {   // tadad ki likhai: ×2 · 1 CTN · 6 PCS · (header na ho) sab hindse chhote
  if (it.q && it.q.length === 1) { const v = ocNum(it.q[0].v); return `<b>×${escB(isNaN(v) ? it.q[0].v : q3(v))}${it.un ? ' ' + escB(it.un) : ''}</b>`; }
  if (it.q && it.q.length) { const L = it.q.filter(o => ocNum(o.v) !== 0); return L.length ? `<b>${L.map(o => escB(o.v) + ' ' + escB(o.l)).join(' · ')}</b>` : ''; }
  if (it.n && it.n.length) return `<small>${it.n.map(escB).join(' · ')}</small>`;
  return '';
}
const OC_SEEN = new Map();   // naya item 4 s hara: key -> {m: Map(sig -> pehli dafa), k: kitni dafa dekha}
function ocSeen(key, items, now) {
  const o = OC_SEEN.get(key) || { m: new Map(), k: 0 }, sig = x => x.nm + '|' + (x.q || []).map(q => q.v).join(',') + '|' + (x.n || []).join(','), cur = new Set();
  for (const x of items) { const s = sig(x); cur.add(s); if (!o.m.has(s)) o.m.set(s, o.k ? now : 0); }
  for (const s of [...o.m.keys()]) if (!cur.has(s)) o.m.delete(s);
  o.k++; OC_SEEN.set(key, o);
  return x => { const t = o.m.get(sig(x)); return !!t && now - t < 4000; };
}
const ocFresh = (O, now) => { const d = O && O.d; if (!d || Number(d.on) !== 1 || now - O.rt > 60000) return false; const t = Number(d.hb) || Number(d.at) || 0; return !(t && Date.now() - t > 30 * 60000); };
// v2.386.0: doc IS Live ke dauran likha (PC ki ghari, ±2 min) — pichhle Live ka 'Live band' / purani wajah taza na lage
const lvFr = (at, t0) => Number(at) > 0 && Number(at) >= (t0 || Date.now()) - 120000;
function ocWhy(O, sh, now, t0) {   // OCR kyun nahi — saaf wajah (khamosh nahi)
  const d = O && O.d;
  if (d && Number(d.on) === 0 && d.why && lvFr(d.at, t0)) return '🔤 ' + String(d.why).slice(0, 120);
  if (d && Number(d.on) === 1) return '🔤 OCR ruka hua — counter PC / NT-PRINT dekhein';
  const v = sh && sh.ver ? parseFloat(sh.ver) : 0;
  if (v && v < 1.39) return `🔤 NT-PRINT v${sh.ver} purana — naya (v1.39) 3-5 min mein khud aayega`;
  if (v && now - (t0 || now) > 20000) return '🔤 OCR ka jawab nahi (is PC par band — posOcr?)';
  return '';
}
// v2.386.0 (malik 26 Nov ki photo: teeno counter khane bilkul khali): khane par items na hon to HAMESHA ek line — zanjeer ki kaun si kadi tooti:
//   ① server ne hukum bheja? (posLive/_want) ② counter ke NT-PRINT ne suna? (is Live ke dauran shot / ocr / scan doc + printPCs haal) ③ POS screen mili? ④ OCR
function tbDiag(n, O, sh, S0, now) {
  const t0 = TB.t0 || now, d = O && O.d, fd = d && lvFr(d.at, t0), fs = sh && sh.ex && lvFr(sh.dat, t0), fc = S0 && lvFr(S0.dat, t0);
  if (fd && Number(d.on) === 0 && d.why) return '🔤 ' + String(d.why).slice(0, 110);
  if (fs && !sh.url && sh.why) return '🖥 ' + sh.why.slice(0, 110);
  const vs = [fs && sh.ver, fd && d.ver, fc && S0.ver].map(v => parseFloat(v) || 0).filter(Boolean), v = vs.length ? Math.max(...vs) : 0;
  if (v && v < 1.39) return `🔤 NT-PRINT v${v} purana — v1.39 3-5 min mein khud aayega`;
  if (now - t0 < 20000) return '';
  if (fd || fs || fc) {
    if (fd && Number(d.on) === 1) return '🔤 OCR ruka hua — counter PC / NT-PRINT dekhein';
    if (fs && sh.url) return '🔤 POS screen aa rahi hai, OCR ka jawab nahi (NT-PRINT v' + (sh.ver || '?') + ')';
    return '🔤 counter PC jura hai magar POS screen / OCR nahi bheji (NT-PRINT v' + (v || '?') + ')';
  }
  const W = TB.want, hs = W && W.hosts, host = hs ? Object.keys(hs).find(h => hs[h] === n) : '';
  if (!W) return '🩺 server ka haal nahi mila (posLive/_want)';
  if (!host) return '🩺 server ne is counter ko hukum nahi bheja' + (Number(W.at) && now - Number(W.at) > 120000 ? ' — server PC ki script chup?' : '');
  return ('🩺 hukum ' + host + ' ko gaya — ' + ntpSay(host, TB.pcs)).slice(0, 170);
}
function ocTileHTML(n, d, now) {
  const it = ocParse(d.r).items;
  if (!it.length) return '<div class="lv-tbr m">🧾 POS khali — naya bill shuru hote hi yahan</div>';
  const nw = ocSeen('t:' + n, it, now), R = [...it].reverse();   // POS mein nayi item NEECHE judti hai — yahan UPAR
  return `<div class="lv-tbh nw">🧾 Bill ban raha · ${it.length} item</div>` + R.slice(0, 6).map(x => { const q = ocQ(x); return `<div class="lv-tbr${nw(x) ? ' nw' : ''}">${escB(x.nm)}${q ? ' ' + q : ''}</div>`; }).join('')
    + (R.length > 6 ? `<div class="lv-tbr m">+${R.length - 6} items</div>` : '');
}
function tbPaint(i) {
  const mo = TB.mo, e = mo && $('lvMo')?.querySelector(`[data-tb="${i}"]`); if (!e) return;
  const k = mo.k[i], n = mo.n[i], now = Date.now(); let h = '', img = '';
  const ch = '';   // v2.385.0: khane par 🖨 ruke bill ke chips NAHI (malik: 'yahan pending bill nahi chahiye') — ⏰ Ruke bills apni jagah wahi
  if (k === 'c') {   // v2.385.0: SIRF bante bill ki items — ① POS screen ka OCR (NT-PRINT v1.39) ② na ho = scan ke naam ③ na ho = POS screen ki tasveer. Pichhla 📌 bill khane par nahi.
    const O = TB.ocr.get(n), sh = TB.shot.get(n);
    if (ocFresh(O, now)) h = ocTileHTML(n, O.d, now);
    else {
      const S0 = TB.scan.get(n), P = rkPcBills(n), lastPr = P.reduce((m, x) => Math.max(m, Number(x.ct) || 0), 0), sn = (TB.bill.get(n) || {}).sn || {};   // v2.371.0: sirf PRINT ka waqt (post ka nahi)
      const A = ((S0 && S0.a) || []).filter(x => Array.isArray(x) && Number(x[0]) > lastPr + 500), G = new Map();
      for (const [t, c] of A) { const o = G.get(c) || { c, n: 0, t: 0 }; o.n++; o.t = Math.max(o.t, Number(t) || 0); G.set(c, o); }
      const R = [...G.values()].sort((a, b) => b.t - a.t);
      if (R.length) {   // v2.370.0: scan ke barcode se (POS ke andar aksar nahi pakra jata — 26 Nov sabaq)
        const row = o => { const v = sn[o.c], nm = Array.isArray(v) ? v[0] : '', q = Array.isArray(v) ? Number(v[1]) || 1 : 1;
          return `<div class="lv-tbr${now - o.t < 4000 ? ' nw' : ''}">${nm ? escB(nm) : '🔖 ' + escB(String(o.c).slice(-10))}${q !== 1 ? ` <small>(${q3(q)})</small>` : ''} <b>×${o.n}</b></div>`; };
        h = `<div class="lv-tbh nw">🧾 Bill ban raha · ${R.length} item</div>` + R.slice(0, 6).map(row).join('') + (R.length > 6 ? `<div class="lv-tbr m">+${R.length - 6} items</div>` : '');
      } else if (sh && sh.url && !sh.empty && now - sh.at < 45000) { h = '<div class="lv-tbh nw">⏳ bill ban raha…</div>'; img = sh.url; }   // v2.363.0: khali screen = tasveer nahi
      const why = tbDiag(n, O, sh, S0, now);   // v2.386.0: pehle sirf OCR ki wajah thi — purana scan doc pada ho to khana chup reh jata tha
      if (why) h += `<div class="lv-tbd">${escB(why)}</div>`;
    }
  } else if (k === 'g') {
    const G = tbGate(i);
    if (G.length) {
      const { d, L, tk } = G[0];
      h = `<div class="lv-tbh gp${Number(d.ps) === 1 ? ' un' : ''}">🚪 #${escB(d.no || d.id)}${d.p ? ' · ' + escB(d.p) : ''}</div>` + L.slice(0, 4).map((x, j) => `<div class="lv-tbr${tk[j] ? ' ok' : ''}">${tk[j] ? '✓' : '☐'} ${escB(x.n)} <b>×${q3(x.q)}</b></div>`).join('')
        + (L.length > 4 ? `<div class="lv-tbr m">+${L.length - 4} items</div>` : '') + (G.length > 1 ? `<div class="lv-tbr m">+${G.length - 1} aur gate pass</div>` : '');
    }
  }
  const ce = $('lvMo')?.querySelector(`[data-tbc="${i}"]`); if (ce && ce.dataset.sig !== ch) { ce.dataset.sig = ch; ce.innerHTML = ch; }   // v2.370.0
  const sig = h + '|' + img; if (e.dataset.sig === sig) return; e.dataset.sig = sig;
  e.innerHTML = h + (img ? '<div class="lv-tsh"><img alt=""></div>' : '');
  if (img) { const im = e.querySelector('img'), sh0 = TB.shot.get(n); im.onload = () => { if (tbFollow(im) && sh0 && TB.shot.get(n) === sh0) { sh0.empty = 1; tbPaint(i); } }; im.src = img; }
}
// ---------- v2.370.0: aaj ke bill — khane ke 🖨 chips + ⏰ RUKE BILLS (chhape, 30 min se post nahi) ----------
const RK_MIN = 30;
const rkDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
let RK = { un: null, day: '', bills: [], t: null, cu: null, clips: new Map(), asked: new Set(), open: '', vu: '', vi: 0, lines: new Map(), keep: null };
const rkUnp = b => b && !Number(b.x) && Number(b.ps) !== 2 && Number(b.ps) !== 3 && Number(b.ct) > 0;   // chhapa magar post / cancel nahi
const rkNo = b => String(b.no || b.id || '').replace(/^0+(?=\d)/, '');
const rkPcBills = n => RK.bills.filter(b => String(b.pc || '') === String(n));
const rkLate = () => { const now = Date.now(); return RK.bills.filter(b => rkUnp(b) && now - Number(b.ct) >= RK_MIN * 60000).sort((a, b) => Number(b.ct) - Number(a.ct)); };
function rkStop() { try { RK.un && RK.un(); } catch {} clearInterval(RK.t); RK.un = null; RK.t = null; RK.bills = []; RK.day = ''; }
function rkSync() {
  const d = rkDay(); if (RK.un && RK.day === d) return; rkStop(); if (!cloud?.listenPosSales) return; RK.day = d;
  RK.un = cloud.listenPosSales(d, L => { if (!Array.isArray(L)) return; RK.bills = L; rkChip(); tbAll(); if ($('lvRkDlg')?.open) rkPaint(); });
  RK.t = setInterval(() => { if (rkDay() !== RK.day) rkSync(); rkChip(); if ($('lvRkDlg')?.open) rkPaint(); }, 30000);
}
function rkChip() { const e = $('lvRk'); if (!e) return; const n = rkLate().length; e.textContent = `⏰ Ruke ${n}`; e.classList.toggle('is-z', !n); }
const rkTm = t => { try { return new Date(Number(t)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' }); } catch { return ''; } };
const rkAgo = t => { const m = Math.max(0, Math.round((Date.now() - Number(t)) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} ghante ${m % 60} min` : `${m} min`; };
function rkOpen() {
  let d = $('lvRkDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'lvRkDlg'; d.className = 'lv-rkd'; document.body.append(d);
    d.addEventListener('cancel', ev => { ev.preventDefault(); rkClose(); });
    d.addEventListener('click', ev => { const t = ev.target;
      if (t.closest('[data-rk-x]')) { rkClose(); return; }
      const pl = t.closest('[data-rk-play]'); if (pl) { const id = pl.dataset.rkPlay; if (RK.open === id) { RK.open = ''; rkVidStop(); rkPaint(); } else rkPlay(id); return; }
      const rq = t.closest('[data-rk-req]'); if (rq) { rkReq(rq.dataset.rkReq); return; }
    }); }
  if (!RK.cu && cloud?.listenBillClips) RK.cu = cloud.listenBillClips([rkDay()], L => { if (!Array.isArray(L)) return; RK.clips = new Map(L.filter(c => c && !String(c.id).includes('~')).map(c => [String(c.id), c])); if (d.open) rkPaint(); });
  rkPaint(); if (!d.open) d.showModal();
}
function rkClose() { rkVidStop(); RK.open = ''; RK.keep = null; try { RK.cu && RK.cu(); } catch {} RK.cu = null; const d = $('lvRkDlg'); try { d?.open && d.close(); } catch { d?.removeAttribute('open'); } }
function rkVidStop() { const v = $('lvRkVid'); try { v && v.pause(); } catch {} if (RK.vu) { try { URL.revokeObjectURL(RK.vu); } catch {} RK.vu = ''; } }
function rkVidHTML(b) {
  const id = String(b.id), c = RK.clips.get(id), L = RK.lines.get(id);
  const it = Array.isArray(L) ? (L.length ? `<div class="rk-it">${L.slice(0, 40).map(x => `<span>${escB(x.n ?? x.name ?? x[1] ?? '')} <b>×${q3(x.q ?? x.qty ?? x[2])}</b></span>`).join('')}</div>` : '<div class="rk-it m">items nahi mile</div>') : '<div class="rk-it m">⏳ items…</div>';
  const v = c && c.st === 'ok' ? '<video id="lvRkVid" playsinline controls autoplay muted></video><div class="rk-vs" id="lvRkVs">⏳ video aa rahi…</div>' : '';
  return `<div class="rk-box">${v}${it}</div>`;
}
function rkPaint() {
  const d = $('lvRkDlg'); if (!d) return;
  const L = rkLate(), ids = new Set(L.map(b => String(b.id)));
  if (RK.open && !ids.has(RK.open)) { const b = RK.bills.find(x => String(x.id) === RK.open); if (b) { RK.keep = { ...b, _post: !rkUnp(b) }; } } else if (!RK.open) RK.keep = null;
  const rows = [...(RK.keep && !ids.has(String(RK.keep.id)) ? [RK.keep] : []), ...L];
  const btn = b => { const id = String(b.id), c = RK.clips.get(id);
    if (c && c.st === 'ok') return `<button type="button" class="rk-b ok" data-rk-play="${escB(id)}">${RK.open === id ? '▲ Band' : '▶ Video'}</button>`;
    if (RK.asked.has(id) || (c && c.st === 'wait')) return `<button type="button" class="rk-b" data-rk-play="${escB(id)}">⏳ ban rahi</button>`;
    return `<button type="button" class="rk-b q" data-rk-req="${escB(id)}">🎬 ${c && (c.st === 'err' || c.st === 'skip') ? 'Dobara maango' : 'Video maango'}</button>`; };
  const html = `<div class="rk-head"><b>⏰ Ruke bills · ${L.length}</b><small>Chhape magar ${RK_MIN} min se post nahi — post hote hi khud hat jate hain</small><button type="button" class="rk-x" data-rk-x="1">×</button></div>
    <div class="rk-list">${rows.length ? rows.map(b => { const id = String(b.id), op = RK.open === id;
      return `<div class="rk-row${op ? ' is-op' : ''}${b._post ? ' is-po' : ''}" data-rk-id="${escB(id)}"><div class="rk-l1"><b>#${escB(rkNo(b))}</b><span class="rk-rs">Rs ${nf(b.t)}</span>${btn(b)}</div>
        <div class="rk-l2">🖥 ${escB(b.pc || '?')} · 🖨 ${escB(rkTm(b.ct))} · ⏱ ${escB(rkAgo(b.ct))}${b.p ? ' · ' + escB(String(b.p).slice(0, 24)) : ''}${b._post ? ' · <i>📌 Post ho gaya</i>' : ''}</div>${op ? rkVidHTML(b) : ''}</div>`; }).join('') : `<div class="rk-empty">✅ Koi ruka bill nahi — sab chhape bill ${RK_MIN} min ke andar post ho gaye</div>`}</div>`;
  const sig = html; if (d.dataset.sig === sig) return;
  const v0 = $('lvRkVid'), keepV = v0 && RK.open && d.querySelector(`[data-rk-id="${CSS.escape(RK.open)}"] video`) ? v0 : null, vs = $('lvRkVs')?.textContent || '';   // chalti video wahi rahe (dobara load nahi)
  const ls = d.querySelector('.rk-list')?.scrollTop || 0;
  d.dataset.sig = sig; d.innerHTML = html;
  const lst = d.querySelector('.rk-list'); if (lst) lst.scrollTop = ls;
  if (keepV) { const nv = $('lvRkVid'); if (nv) { nv.replaceWith(keepV); const s2 = $('lvRkVs'); if (s2) s2.textContent = vs; } } else if (RK.open && $('lvRkVid')) rkLoadVid(RK.open, RK.vi || 0);
}
async function rkLoadVid(id, i) {
  const c = RK.clips.get(id); if (!c || c.st !== 'ok') return; const sg = Array.isArray(c.segs) && c.segs.length ? c.segs : null;
  const st = $('lvRkVs'); if (st) st.textContent = '⏳ video aa rahi…';
  let u8 = null; try { u8 = sg ? await cloud.getBillClipSeg(id, i, sg[i]?.n) : (i ? null : await cloud.getBillClip(id, c.n)); } catch { u8 = null; }
  if (RK.open !== id) return; const v = $('lvRkVid'), s2 = $('lvRkVs'); if (!v) return;
  if (!u8 || !u8.length) { if (s2) s2.textContent = '⚠ video nahi mili'; return; }
  rkVidStop(); RK.vu = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' })); RK.vi = i;
  v.src = RK.vu; v.onended = () => { if (sg && i + 1 < sg.length && RK.open === id) rkLoadVid(id, i + 1); else if (s2) s2.textContent = '✓ video khatam'; };
  v.play().catch(() => {}); if (s2) s2.textContent = sg && sg.length > 1 ? `▶ hissa ${i + 1} / ${sg.length}` : '▶';
}
async function rkPlay(id) {
  rkVidStop(); RK.open = id; RK.vi = 0; rkPaint();
  if (!RK.lines.has(id) && cloud?.getPosSaleLines) { try { RK.lines.set(id, await cloud.getPosSaleLines(id) || []); } catch { RK.lines.set(id, []); } if (RK.open === id) { const d = $('lvRkDlg'); if (d) { delete d.dataset.sig; rkPaint(); } } }
}
async function rkReq(id) {
  const b = RK.bills.find(x => String(x.id) === String(id)); if (!b || !cloud?.reqBillClip) return;
  RK.asked.add(String(id)); rkPaint();
  try { await cloud.reqBillClip(id, { no: b.no, pc: b.pc, day: RK.day }); notice('🎬 Video maangi — PC 1-2 min mein bana dega'); }
  catch (e) { RK.asked.delete(String(id)); rkPaint(); notice('✕ Video nahi maang saka: ' + (e.message || e)); }
}
let RES = false;   // v2.226.0: app peeche ja kar wapas aaye (popup / call) = KHUD dobara (malik: "jab bhi on karein foran aana chahiye")
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S) { stop(true); RES = true; stat('⏸ App peeche gayi — wapas aate hi khud jur jayega'); } } else if (RES && $('lvDlg')?.open && cur) { RES = false; start(); } });

async function start() {
  try { localStorage.setItem('sam-lv-last', moBack ? moHome : cur); } catch {}
  const dlv = dlOn();   // v2.377.0: ⏪
  stop(true); { const gd = isMoP(cur), dl = $('lvDlg'); dl?.classList.toggle('is-mo', gd); MO = null; moPaint(null); if (gd || dlv) billStop(); else billStart(); const mb = $('lvMoB'); if (mb) { mb.hidden = !(moBack && !gd); mb.textContent = moHome === ALL ? '‹ 🎛 Sab' : '‹ 🏬 Sab'; } }   // v2.348.0: godam = bill patti / POS screen nahi
  { const qe = $('lvQ'); if (qe) qe.hidden = true; }   // v2.322.0: naya rabta = 🩺 nayi ginti
  if (!cloud?.liveStart) { stat('✕ App update karein', true); return; }
  if (dlv && pcOld()) { stat(`⏳ PC ka live-cam purana (v${pcSt.ver}) — ⏪ Saaf 3-5 min mein khud aa jayega (PC update). Abhi asal live ke liye ⏪ dobara dabayein.`, true); return; }
  if (pcSt && Date.now() - (Number(pcSt.at) || 0) > 5 * 60000) stat('⚠ Shop PC chup lag raha (' + Math.round((Date.now() - pcSt.at) / 60000) + ' min) — phir bhi koshish…', true); else stat('⏳ ' + lvName(cur) + (dlv ? ' · ⏪ recording se (2 min peeche) jor raha…' : isMoP(cur) ? ' jor raha…' : ' ka camera jor raha…'));
  const myT = ++stT, turn = await Promise.race([iceGet(), new Promise(r => setTimeout(() => r(null), 1500))]);   // v2.378.0: 🔁 relay pass (aam taur par pehle se yaad)
  if (myT !== stT || !$('lvDlg')?.open) return;
  let rpc = null, useT = !!turn;
  if (useT) { try { rpc = new RTCPeerConnection({ iceServers: [...STUN, ...turn] }); } catch { useT = false; ICE = { L: null, none: 1 }; iceT = Date.now(); } }   // ghalat pass = sirf STUN (live kabhi na ruke)
  if (!rpc) rpc = new RTCPeerConnection({ iceServers: STUN });
  const s = S = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), pc: rpc, ok: 0, turn: useT };
  const v = $('lvVid');
  const tr = s.pc.addTransceiver('video', { direction: 'recvonly' });
  if (VP8) { try { const cs = (RTCRtpReceiver.getCapabilities('video')?.codecs || []).filter(c => /vp8/i.test(c.mimeType)); if (cs.length) tr.setCodecPreferences(cs); } catch {} }
  s.pc.ontrack = e => { if (S !== s) return; v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); };
  s.pc.onconnectionstatechange = () => {
    if (S !== s) return; const st = s.pc.connectionState;
    if (st === 'connected') {
      s.ok = 1; const base = (dlv ? '⏪ Saaf · 2 min peeche · ' : '🟢 Live · ') + lvName(cur); stat(base); setTimeout(() => { if (S === s && s.ok) $('lvSt').hidden = true; }, 2500);
      viaOf(s.pc).then(v => { if (S !== s) return; s.via = v; if (v === 'relay' && !$('lvSt').hidden && !$('lvSt').classList.contains('bad')) stat(base + ' · 🔁 relay se'); qPaint(s); });   // v2.378.0
    }
    else if (st === 'failed') { iceT = 0; stat(s.turn ? '✕ Rabta nahi bana (relay se bhi) — 🔄 dobara dabayein. Phir bhi na bane to Settings → 🖥️ PC scripts → 🔁 Relay ka haal dekhein' : '✕ Rabta nahi bana — is internet par seedha rabta nahi banta. Wi-Fi par chal jayega · 4G ke liye malik: Settings → 🖥️ PC scripts → 🔁 Relay lagayein · ya 🔄', true); }
    else if (st === 'disconnected') stat('⏳ Rabta kamzor — wapas jor raha…');
  };
  try {
    await s.pc.setLocalDescription(await s.pc.createOffer());
    await new Promise(r => {   // v2.226.0: 3 s ka pakka intezar nahi — bahar ka raasta (srflx) milte hi aage (zyada se zyada 1.5 s) · v2.378.0: relay pass ho to RELAY candidate ka intezar (3 s tak) — warna offer mein relay jata hi nahi
      if (s.pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, s.turn ? 3000 : 1500);
      s.pc.addEventListener('icecandidate', e => { const c = (e.candidate && e.candidate.candidate) || ''; if (s.turn ? / typ relay/.test(c) : / typ srflx/.test(c)) setTimeout(r, s.turn ? 250 : 120); });
      s.pc.addEventListener('icegatheringstatechange', () => { if (s.pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
    if (S !== s) return;
    await cloud.liveStart(s.id, { pc: cur + (dlv ? '~' : ''), offer: s.pc.localDescription.sdp });
  } catch (e) { if (S === s) stat('✕ Shuru nahi hua: ' + (e?.message || e), true); return; }
  let answered = false;
  s.unsub = cloud.liveWatch(s.id, async r => {
    if (S !== s || !r) return; s.r = r; qPaint(s); if (isMoP(cur) && r.mo) { MO = r.mo; moPaint(r.mo); }   // v2.348.0
    if (r.warn && r.st !== 'err' && !r.rtp) stat('⚠ ' + r.warn, true);   // v2.223.0: PC ki asal wajah
    if (r.st === 'err') { stat('✕ ' + (r.err || 'PC ne mana kiya'), true); return; }
    if (r.st === 'ok' && r.ans && !answered) { answered = true; clearTimeout(s.to); stat('⏳ Video aa rahi…'); try { await s.pc.setRemoteDescription({ type: 'answer', sdp: r.ans }); } catch (e) { stat('✕ ' + (e?.message || e), true); } }
  });
  s.to = setTimeout(() => { if (S === s && !answered) stat('✕ Shop PC ne 20 s mein jawab nahi diya — PC band hai ya live-cam abhi laga nahi (3-5 min)', true); }, 20000);
  s.hb = setInterval(() => { if (S === s) cloud.liveHb(s.id).catch(() => {}); }, 15000);
  s.t0 = Date.now(); s.cn = setInterval(() => { if (S !== s) { clearInterval(s.cn); return; } const e = $('lvSt'), v2 = $('lvVid'); if (v2 && v2.videoWidth && !v2.paused && v2.currentTime > 0.1) { clearInterval(s.cn); if (e && !e.classList.contains('bad')) e.hidden = true; return; } if (e && !e.hidden && !e.classList.contains('bad')) e.textContent = e.textContent.replace(/ · \d+ s$/, '') + ' · ' + Math.round((Date.now() - s.t0) / 1000) + ' s'; }, 1000);
  s.fr = setInterval(async () => {   // jura hua par tasveer nahi = saaf batao
    if (S !== s || !s.ok) return;
    try {
      const st = await s.pc.getStats(); let f = 0, lo = 0, rc = 0; st.forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') { f = x.framesDecoded || 0; lo = Math.max(0, x.packetsLost || 0); rc = x.packetsReceived || 0; } });
      { const dl = lo - (s.pl ?? lo), dr = rc - (s.pr ?? rc); s.pl = lo; s.pr = rc; (s.lh = s.lh || []).push([dl, dr]); if (s.lh.length > 3) s.lh.shift(); const L = s.lh.reduce((a, x) => a + x[0], 0), R = s.lh.reduce((a, x) => a + x[1], 0); s.loss = L + R > 0 ? L * 100 / (L + R) : 0; s.f = f; qPaint(s); }   // v2.322.0: 📱 phone tak tukre gum (12 s)
      if (f) { if (s.bad) { s.bad = 0; $('lvSt').hidden = true; } return; }
      if (Date.now() - (s.okAt || (s.okAt = Date.now())) < 16000) return;   // v2.224.0: recording ki line se video 6-8 s mein shuru hoti hai
      s.bad = 1;
      if (s.r?.rtp) {   // PC video bhej raha hai par phone nahi chala raha
        if (!VP8) { VP8 = true; stat('⏳ Phone par video nahi chali — doosre tareeqe (VP8) se dobara…'); start(); return; }
        stat('⚠ PC video bhej raha hai par is phone par nahi chal rahi — 🔄 Dobara, ya Wi-Fi / doosra internet', true);
      } else stat('⚠ ' + (s.r?.warn || 'Juda hai par PC ko camera se video nahi mil rahi — wajah aa rahi hai… (PC update 3-5 min)'), true);
    } catch {}
  }, 4000);
}

// ---------- 🩺 v2.322.0: video kahan toot rahi hai (malik: "video blur aa raha") ----------
// PC (live-cam v1.7) har 10 s liveReq.q {d: NVR→PC decode ghaltiyan, g: PC ke andar gire tukre, r: RTP gire, at}; phone apne getStats se tukre gum %.
function qPaint(s) {
  const e = $('lvQ'); if (!e || S !== s) return;
  const q = s.r && s.r.q, fr = q && Date.now() - (Number(q.at) || 0) < 35000;
  let t = '', k = '', why = '';
  if (fr && Number(q.d) >= 2) { k = 'bad'; t = '🩺 NVR→PC toot'; why = 'Camera (NVR) se server PC tak video ke tukre gum ho rahe hain — is liye grey / dhundli. Ilaaj: server PC aur NVR ek hi network par (LAN taar).'; }
  else if (fr && (Number(q.g) > 0 || Number(q.r) > 0)) { k = 'bad'; t = '🩺 PC ke andar toot'; why = 'Server PC ke andar video ke tukre gire (PC us waqt bohat busy) — Settings → 🖥️ PC scripts ka 🔥 CPU dabba dekhein.'; }
  else if ((s.loss || 0) >= 2) { k = 'warn'; t = `📱 Net kamzor ${Math.round(s.loss)}%`; why = `PC se video saaf ja rahi hai — aap ke phone ke internet par ${Math.round(s.loss)}% tukre gum ho rahe hain. Wi-Fi / doosra internet try karein.`; }
  else if (s.f) { k = 'ok'; t = '🩺 Saaf'; why = fr ? 'Camera → PC → phone: kahin tukre gum nahi ho rahe.' : 'Phone tak video saaf aa rahi hai (PC ka haal: live-cam update 3-5 min mein).'; }
  if (t && fr && Number(q.kf) > 4) why += ` · Camera ki poori tasveer (keyframe) har ${Number(q.kf)} second mein aati hai — tukra gire to itni der grey / ruki. Ilaaj: NVR mein us camera ka I-frame interval 2 second (fps x 2) aur Smart Codec / H.264+ band.`;   // v2.374.0 (live-cam v2.6)
  if (t && s.via) why += s.via === 'relay' ? ' · Rasta: 🔁 relay (Cloudflare) — 4G / bahar ke internet par.' : ' · Rasta: seedha (PC → phone).';   // v2.378.0
  e.hidden = !t; e.textContent = t; e.className = 'lv-q' + (k ? ' ' + k : ''); e.dataset.why = why;
}

// ---------- 🧾 live bill patti (posLive) ----------
const escB = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = v => Math.round(Number(v) || 0).toLocaleString('en-US');
const q3 = v => String(Math.round((Number(v) || 0) * 1000) / 1000);
function billStop() { shotStop(); try { B.un && B.un(); } catch {} try { B.uo && B.uo(); } catch {} clearInterval(B.t); B = { un: null, uo: null, ocr: null, sid: 0, prev: new Map(), del: [], fl: new Map(), recv: 0, doc: null, t: null, cnt: 0, pc: '' }; }
function billStart() {
  if (!cloud?.listenPosLive) return;
  if (B.pc === cur && B.un) return;
  billStop(); B.pc = cur; B.st0 = Date.now();
  billPaint();
  B.un = cloud.listenPosLive(cur, (d, err) => { if (err) { B.err = err.message || String(err); billPaint(); return; } if (d) { B.recv = Date.now(); billGot(d); } });
  if (cloud.listenPosOcr) { const pc = cur; B.uo = cloud.listenPosOcr(pc, (d, err, cache) => { if (err || cache || B.pc !== pc) return; B.ocr = { d, rt: Date.now() }; billPaint(true); }); }   // v2.385.0: 🔤 bante bill ki items (POS screen ka OCR)
  B.t = setInterval(billPaint, 4000);
  shotStart();
}
// ---------- 🖥 POS screen ki tasveer (v2.229.0) ----------
// POS bill ko Print par hi save karta hai — is liye bante bill ki items counter PC (NT-PRINT v1.28) ki POS screen ki chhoti tasveer se:
// item likhi / scan = ~1 s mein yahan · hatai = hat gayi · print = list khali · nayi item = naya bill. Tap = poori chaurai / bara.
let SH = { un: null, un2: null, t: null, recv: 0, url: '', st0: 0, d: null, want: null };
function shotStop() { try { SH.un && SH.un(); } catch {} try { SH.un2 && SH.un2(); } catch {} clearInterval(SH.t); try { SH.url && URL.revokeObjectURL(SH.url); } catch {} SH = { un: null, un2: null, t: null, recv: 0, url: '', st0: 0, d: null, want: null }; const e = $('lvShot'); if (e) { e.hidden = true; e.innerHTML = ''; } }
function shotStart() {
  if (!cloud?.listenPosShot || !cur) return;
  SH.st0 = Date.now();
  const e = $('lvShot'); if (e) { let fit = false; try { fit = localStorage.getItem('sam-lv-shotfit') === '1'; } catch {} e.classList.toggle('is-fit', fit); }
  SH.un = cloud.listenPosShot(cur, (d, err, cache) => { if (err || cache) return; SH.recv = Date.now(); SH.d = d; shotPaint(true); });
  const u2 = cloud.listenPosLive('_want', (d, err) => { if (!err) SH.want = d || {}; }), u3 = cloud.listenPrintPCs ? cloud.listenPrintPCs(L => { SH.pcs = L || []; }) : null;
  SH.un2 = () => { try { u2 && u2(); } catch {} try { u3 && u3(); } catch {} };
  SH.t = setInterval(() => shotPaint(false), 5000);
}
// v2.229.3: POS mein nayi item list ke NEECHE judti hai — tasveer mein sab se lamba khali (safed) hissa dhoondo, us se upar wali qatar = aakhri item;
// dabba khud wahan le jao (malik ne 6 s ke andar khud ungli lagayi ho to nahi).
function shotFollow(img) {
  try {
    const box = img && img.parentElement; if (!box || !img.naturalWidth || Date.now() - (SH.touch || 0) < 6000) return;
    const W = 160, H = Math.max(8, Math.round(img.naturalHeight * W / img.naturalWidth)), c = SH.cv || (SH.cv = document.createElement('canvas'));
    c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data; let best = 0, bs = -1, run = 0, rs = 0;
    for (let y = 0; y < H; y++) { let nw = 0; for (let i = y * W * 4, e = i + W * 4; i < e; i += 4) if (d[i] < 232 || d[i + 1] < 232 || d[i + 2] < 232) nw++;
      if (nw <= W * 0.03) { if (!run) rs = y; run++; if (run > best) { best = run; bs = rs; } } else run = 0; }
    if (best >= H * 0.1 && bs >= 0) box.scrollTop = Math.max(0, bs / H * img.clientHeight - box.clientHeight + 12);
  } catch {}
}
// counter ke NT-PRINT ka haal (printPCs) — malik ko saaf wajah
function ntpSay(host, L0) {   // v2.386.0: L0 = Sab cameras ki list (TB.pcs)
  const bare = x => String(x || '').toUpperCase().replace(/^[A-Z]+-/, ''), L = L0 || SH.pcs;
  if (!L) return 'NT-PRINT ka haal load nahi hua';
  const d = L.find(x => bare(x.host) === bare(host));
  if (!d) return 'is counter ka NT-PRINT app se juda hi nahi (PC par NT-PRINT nahi laga / firebase chaabi nahi). Jude PC: ' + (L.map(x => String(x.host || x.name || x.id) + ' v' + (x.ver || '?')).join(', ') || 'koi nahi');
  const m = Math.round((Date.now() - (Number(d.at) || 0)) / 60000), v = String(d.ver || '?');
  if (m > 5) return 'NT-PRINT v' + v + ' ' + (m > 120 ? Math.round(m / 60) + ' ghante' : m + ' min') + ' se chup (band / PC so gaya)';
  if (parseFloat(v) < 1.28) return 'NT-PRINT purana v' + v + ' chal raha hai — khud update nahi hua';
  return 'NT-PRINT v' + v + ' chal raha hai (host ' + String(d.host || '?') + ') magar hukum nahi suna';
}
function shotPaint(fresh) {
  const e = $('lvShot'); if (!e) return;
  const d = SH.d, now = Date.now(), live = d && Number(d.on) === 1 && d.im && now - SH.recv < 45000;
  const note = t => { e.hidden = false; e.classList.add('is-note'); e.innerHTML = `<div class="lvs-n">🖥 ${escB(t)}</div>`; spApply(); };
  if (live) {
    if (fresh) { const u = URL.createObjectURL(new Blob([d.im], { type: 'image/jpeg' })); let img = e.querySelector('img');
      if (!img) { e.classList.remove('is-note'); e.innerHTML = '<div class="lvs-h"><b>🖥 POS screen · live</b><small class="lvs-tip"><span class="lvs-tl">patti pakar kar khiskao · </span>tap = bara / poora</small><button type="button" class="lvs-re" data-lvs-re="1" title="Pehli jagah" aria-label="Pehli jagah">↺</button></div><div class="lvs-b"><img alt=""></div><span class="lvs-rz" title="Chhota / bara" aria-hidden="true"></span>'; img = e.querySelector('img'); const bx = e.querySelector('.lvs-b'); if (bx) bx.addEventListener('pointerdown', () => { SH.touch = Date.now(); }, { passive: true }); }
      img.onload = () => shotFollow(img); img.src = u; try { SH.url && URL.revokeObjectURL(SH.url); } catch {} SH.url = u;
      const h = e.querySelector('.lvs-h'); if (h) { h.classList.remove('is-new'); void h.offsetWidth; h.classList.add('is-new'); } }
    e.hidden = false; spApply(); return;
  }
  if (d && Number(d.on) === 0 && now - SH.recv < 60000) { note('POS screen: ' + (d.why || 'nahi mili') + (d.err ? ' (counter PC ki ghalti)' : '')); return; }
  if (d && SH.recv && now - SH.recv >= 45000) { note('POS screen ki tasveer ruk gayi — counter PC / NT-PRINT dekhein'); return; }
  if (now - SH.st0 > 25000) { const hs = (SH.want && SH.want.hosts) || null, host = hs ? Object.keys(hs).find(h => hs[h] === cur) : '';
    note(!SH.want ? 'POS screen: server ka haal nahi mila' : !hs ? 'POS screen: server PC ki script purani hai (pos-sales-dekho v2.9 nahi) — 3-5 min' : !host ? 'POS screen: server ne is counter ko hukum nahi bheja (counter ka PC naam nahi mila)' : 'POS screen: server ne ' + host + ' ko hukum bheja, jawab nahi — ' + ntpSay(host)); return; }
  e.hidden = true;
}
function billGot(d) {
  let L = []; try { L = JSON.parse(d.j || '[]'); } catch {}
  const now = Date.now(), cur2 = new Map(L.map(x => [x[0], x]));
  if (Number(d.sid) !== B.sid) { B.sid = Number(d.sid) || 0; B.del = []; B.fl = new Map(); if (B.cnt++ > 0) for (const x of L) B.fl.set(x[0], { k: 'n', at: now }); }
  else {
    for (const x of L) { const o = B.prev.get(x[0]); if (!o) B.fl.set(x[0], { k: 'n', at: now }); else if (o[2] !== x[2]) B.fl.set(x[0], { k: 'c', at: now }); }
    for (const [id, o] of B.prev) if (!cur2.has(id)) B.del.push({ x: o, at: now });
  }
  B.prev = cur2; B.doc = d; B.L = L;
  billPaint(true);
}
function billPaint(scroll) {
  const e = $('lvBill'); if (!e) return;
  const d = B.doc, now = Date.now();
  if (ocFresh(B.ocr, now)) {   // v2.385.0: 🔤 POS screen par bill ban raha ho to WOHI (OCR) — khali ho to neeche pehle jaisa (pichhla bill)
    const od = B.ocr.d, P = ocParse(od.r);
    if (P.items.length) {
      const nw = ocSeen('b:' + B.pc, P.items, now);
      const rows = [...P.items].reverse().map(x => `<div class="lvb-r${nw(x) ? ' is-new' : ''}"><span class="n">${escB(x.nm)}</span><span class="q">${ocQ(x)}</span><span class="a"></span></div>`).join('');
      e.innerHTML = `<div class="lvb-h"><b>🧾 Bill ban raha</b><small class="lvb-old">POS screen se</small><span class="lvb-st w">⏳ ${P.items.length} items</span></div><div class="lvb-l">${rows}</div>`
        + `<div class="lvb-dg">🔤 ${P.hdr ? 'khane: ' + escB(P.cols.join(' · ').slice(0, 90)) : 'header nahi mila — naam + hindse andaze se'}${Number(od.ms) ? ' · ' + Math.round(Number(od.ms)) + ' ms' : ''}</div>`;
      if (scroll) { const l = e.querySelector('.lvb-l'); if (l) l.scrollTop = 0; }
      return;
    }
  }
  const ow = ocWhy(B.ocr, SH.d ? { ver: SH.d.ver } : null, now, B.st0), owH = ow ? `<div class="lvb-dg">${escB(ow)}</div>` : '';   // v2.385.0
  if (!d) { e.innerHTML = `<div class="lvb-h"><b>🧾 Bill</b></div><div class="lvb-e">${B.err ? '✕ ' + escB(B.err) : now - (B.st0 || now) > 15000 ? '⏳ PC se bill nahi aa raha — PC on? (update 3-5 min)' : '⏳ bill dekh raha…'}</div>${owH}`; return; }
  B.del = B.del.filter(r => now - r.at < 12000);
  const L = B.L || [], sum = L.reduce((a, x) => a + (Number(x[2]) || 0) * (Number(x[3]) || 0), 0);
  const st = Number(d.st) === 3 ? '<span class="lvb-st x">✕ Cancel</span>' : Number(d.st) === 2 ? '<span class="lvb-st ok">📌 Post ✓</span>' : d.pr ? '<span class="lvb-st ok">🖨 Print ✓</span>' : d.sid ? '<span class="lvb-st w">⏳ ban raha</span>' : '';
  const row = (x, cls) => `<div class="lvb-r ${cls}"><span class="n">${escB(x[1])}</span><span class="q">×${q3(x[2])}</span><span class="a">${nf((Number(x[2]) || 0) * (Number(x[3]) || 0))}</span></div>`;
  const rows = B.del.map(r => row(r.x, 'is-del')).join('') + [...L].reverse().map(x => { const f = B.fl.get(x[0]); return row(x, f && now - f.at < 4000 ? (f.k === 'n' ? 'is-new' : 'is-chg') : ''); }).join('');   // v2.226.0: nayi item UPAR (malik: "list upar se neeche aaye")
  const stale = B.recv && now - B.recv > 60000 ? '<div class="lvb-e">⚠ PC se bill ruka hua (1 min+)</div>' : '';
  const tot = (d.pr || Number(d.st) === 2) && Number(d.t) > 0 ? Number(d.t) : sum;
  e.innerHTML = `<div class="lvb-h"><b>${d.sid ? '#' + escB(d.no || d.sid) : '🧾 Aaj koi bill nahi'}</b>${d.sid && d.src === 'aakhri' && (Number(d.st) === 2 || (d.pr && !(now - (Number(d.la) || 0) < 90000))) ? '<small class="lvb-old">pichhla · naya bill shuru hote hi yahan</small>' : d.src === 'andaza' ? '<small class="lvb-old">⏳ ban raha (andaza — counter pakka nahi)</small>' : ''}${st}</div>${stale}<div class="lvb-l">${rows || (d.sid ? '<div class="lvb-e">pehli item ka intezar…</div>' : '')}</div>${d.sid ? `<div class="lvb-f"><span>${L.length} items</span><b>Rs ${nf(tot)}</b></div>` : ''}${d.dg && d.src !== 'chalu' ? `<div class="lvb-dg">🩺 ${escB(d.dg)}</div>` : ''}${owH}`;
  if (scroll) { const l = e.querySelector('.lvb-l'); if (l) l.scrollTop = 0; }
}

// ---------- 🖐 v2.321.0: POS screen dabba khiskao / chhota-bara (sirf landscape / PC) ----------
const SP_K = 'sam-lv-shotpos';
let SPM = 0;   // aakhri khiskane ka waqt (us ke baad ka click = kuch nahi)
const spPort = () => { try { return matchMedia('(orientation:portrait)').matches; } catch { return false; } };
const spCl = (v, a, b) => Math.min(b, Math.max(a, v));
function spGet() { try { const o = JSON.parse(localStorage.getItem(SP_K) || 'null'); return o && [o.x, o.y, o.w, o.h].every(n => Number.isFinite(n)) ? o : null; } catch { return null; } }
function spPut(e, o) { Object.assign(e.style, { left: (o.x * 100).toFixed(2) + '%', top: (o.y * 100).toFixed(2) + '%', width: (o.w * 100).toFixed(2) + '%', height: (o.h * 100).toFixed(2) + '%', right: 'auto', bottom: 'auto', maxHeight: 'none' }); }
function spClear(e) { ['left', 'top', 'width', 'height', 'right', 'bottom', 'maxHeight'].forEach(k => { e.style[k] = ''; }); }
function spApply() {
  const e = $('lvShot'); if (!e) return;
  const o = spGet(); if (!o || spPort()) { spClear(e); return; }
  const w = spCl(o.w, 0.2, 1), h = spCl(o.h, 0.15, 1);
  spPut(e, { w, h, x: spCl(o.x, 0, 1 - w), y: spCl(o.y, 0, 1 - h) });
}
function spReset() { try { localStorage.removeItem(SP_K); } catch {} spApply(); }
function spWire(d) {
  if (d.dataset.spw) return; d.dataset.spw = '1';
  let g = null;
  d.addEventListener('pointerdown', ev => {
    if (spPort()) return;
    const e = $('lvShot'); if (!e || e.hidden || !e.contains(ev.target) || ev.target.closest?.('[data-lvs-re]')) return;
    const rz = !!ev.target.closest?.('.lvs-rz'); if (!rz && !ev.target.closest?.('.lvs-h, .lvs-n')) return;
    const br = (e.offsetParent || e.parentElement).getBoundingClientRect(), r = e.getBoundingClientRect(); if (!br.width || !br.height) return;
    g = { id: ev.pointerId, rz, sx: ev.clientX, sy: ev.clientY, x: (r.left - br.left) / br.width, y: (r.top - br.top) / br.height, w: r.width / br.width, h: r.height / br.height, W: br.width, H: br.height, e, mv: false, o: null };
    try { e.setPointerCapture(ev.pointerId); } catch {}
    ev.preventDefault();
  });
  d.addEventListener('pointermove', ev => {
    if (!g || ev.pointerId !== g.id) return;
    const dx = (ev.clientX - g.sx) / g.W, dy = (ev.clientY - g.sy) / g.H;
    if (!g.mv && Math.abs(ev.clientX - g.sx) + Math.abs(ev.clientY - g.sy) < 5) return;
    g.mv = true; g.e.classList.add('is-drag');
    g.o = g.rz ? { x: g.x, y: g.y, w: spCl(g.w + dx, 0.2, 1 - g.x), h: spCl(g.h + dy, 0.15, 1 - g.y) }
      : { x: spCl(g.x + dx, 0, 1 - g.w), y: spCl(g.y + dy, 0, 1 - g.h), w: g.w, h: g.h };
    spPut(g.e, g.o);
  });
  const end = ev => {
    if (!g || ev.pointerId !== g.id) return;
    const x = g; g = null; x.e.classList.remove('is-drag'); try { x.e.releasePointerCapture(ev.pointerId); } catch {}
    SPM = Date.now();   // patti / kone ka tap (khiska ho ya nahi) = bara / chhota nahi (capture ke baad click ka target poora dabba hota hai)
    if (x.mv && x.o) { try { localStorage.setItem(SP_K, JSON.stringify(x.o)); } catch {} }
  };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => { if ($('lvDlg')?.open) spApply(); });
}
