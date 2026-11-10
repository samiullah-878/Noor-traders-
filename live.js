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
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
let cloud = null, notice = () => {}, list = [], cur = '', S = null, pcSt = null, pcStop = null, VP8 = false;   // VP8: v2.223.0 phone H.264 na chala sake to
let B = { un: null, sid: 0, prev: new Map(), del: [], fl: new Map(), recv: 0, doc: null, t: null, cnt: 0 };
const bOn = () => { try { return localStorage.getItem('sam-lv-bill') !== '0'; } catch { return true; } };

export function openLive(o) {
  cloud = o.cloud; notice = o.notice || notice; list = (o.list || []).filter(Boolean); cur = o.cur && list.includes(o.cur) ? o.cur : (list[0] || '');
  let d = $('lvDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'lvDlg'; d.className = 'lv-dlg'; document.body.append(d); d.addEventListener('cancel', ev => { ev.preventDefault(); closeLive(); }); }
  d.innerHTML = `<div class="lv-head"><b>🔴 Live</b><span class="lv-chips">${list.map(p => `<button type="button" data-lv-pc="${esc(p)}" class="${p === cur ? 'is-in' : ''}">🖥 ${esc(p)}</button>`).join('') || '<small>Koi counter nahi mila — malik ⚙️ Bill tally setup mein counter ↔ camera jorein</small>'}</span><button type="button" class="lv-bt ${bOn() ? 'is-in' : ''}" data-lv-bt="1" title="Bill ki patti">🧾</button><button type="button" class="lv-x" data-lv-x="1">×</button></div>
    <div class="lv-body"><video id="lvVid" playsinline muted autoplay></video><div class="lv-st" id="lvSt">⏳ jor raha…</div><div class="lv-shot" id="lvShot" hidden></div><div class="lv-bill" id="lvBill" ${bOn() ? '' : 'hidden'}></div>
      <div class="lv-tools"><button type="button" data-lv-re="1">🔄 Dobara</button><button type="button" data-lv-full="1">⛶</button></div></div>`;
  d.onclick = ev => {
    const t = ev.target;
    if (t.closest('[data-lv-x]')) { closeLive(); return; }
    const c = t.closest('[data-lv-pc]'); if (c) { cur = c.dataset.lvPc; d.querySelectorAll('[data-lv-pc]').forEach(x => x.classList.toggle('is-in', x === c)); start(); return; }
    if (t.closest('[data-lv-re]')) { start(); return; }
    if (t.closest('#lvShot')) { const e = $('lvShot'); e.classList.toggle('is-fit'); try { localStorage.setItem('sam-lv-shotfit', e.classList.contains('is-fit') ? '1' : '0'); } catch {} return; }
    const bt = t.closest('[data-lv-bt]'); if (bt) { const on = !bOn(); try { localStorage.setItem('sam-lv-bill', on ? '1' : '0'); } catch {} bt.classList.toggle('is-in', on); const e = $('lvBill'); if (e) e.hidden = !on; return; }
    if (t.closest('[data-lv-full]')) { const v = $('lvVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (d.querySelector('.lv-body') || v).requestFullscreen?.(); } catch {} return; }
  };
  if (!d.open) d.showModal();
  if (!pcStop && cloud.listenLiveCamPc) pcStop = cloud.listenLiveCamPc(s => { pcSt = s; });
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
export function closeLive() { RES = false; billStop(); stop(true); const d = $('lvDlg'); try { d?.close(); } catch { d?.removeAttribute('open'); } try { pcStop && pcStop(); } catch {} pcStop = null; }
window.ntLvClose = () => { const d = $('lvDlg'); if (!d?.open) return false; closeLive(); return true; };
let RES = false;   // v2.226.0: app peeche ja kar wapas aaye (popup / call) = KHUD dobara (malik: "jab bhi on karein foran aana chahiye")
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S) { stop(true); RES = true; stat('⏸ App peeche gayi — wapas aate hi khud jur jayega'); } } else if (RES && $('lvDlg')?.open && cur) { RES = false; start(); } });

async function start() {
  stop(true); billStart();
  if (!cloud?.liveStart) { stat('✕ App update karein', true); return; }
  if (pcSt && Date.now() - (Number(pcSt.at) || 0) > 5 * 60000) stat('⚠ Shop PC chup lag raha (' + Math.round((Date.now() - pcSt.at) / 60000) + ' min) — phir bhi koshish…', true); else stat('⏳ ' + cur + ' ka camera jor raha…');
  const s = S = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), pc: new RTCPeerConnection({ iceServers: STUN }), ok: 0 };
  const v = $('lvVid');
  const tr = s.pc.addTransceiver('video', { direction: 'recvonly' });
  if (VP8) { try { const cs = (RTCRtpReceiver.getCapabilities('video')?.codecs || []).filter(c => /vp8/i.test(c.mimeType)); if (cs.length) tr.setCodecPreferences(cs); } catch {} }
  s.pc.ontrack = e => { if (S !== s) return; v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); };
  s.pc.onconnectionstatechange = () => {
    if (S !== s) return; const st = s.pc.connectionState;
    if (st === 'connected') { s.ok = 1; stat('🟢 Live · ' + cur); setTimeout(() => { if (S === s && s.ok) $('lvSt').hidden = true; }, 2500); }
    else if (st === 'failed') stat('✕ Rabta nahi bana — is internet par seedha rabta band hai. Wi-Fi / doosra internet try karein, ya 🔄', true);
    else if (st === 'disconnected') stat('⏳ Rabta kamzor — wapas jor raha…');
  };
  try {
    await s.pc.setLocalDescription(await s.pc.createOffer());
    await new Promise(r => {   // v2.226.0: 3 s ka pakka intezar nahi — bahar ka raasta (srflx) milte hi aage (zyada se zyada 1.5 s)
      if (s.pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 1500);
      s.pc.addEventListener('icecandidate', e => { if (e.candidate && / typ srflx/.test(e.candidate.candidate || '')) setTimeout(r, 120); });
      s.pc.addEventListener('icegatheringstatechange', () => { if (s.pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
    if (S !== s) return;
    await cloud.liveStart(s.id, { pc: cur, offer: s.pc.localDescription.sdp });
  } catch (e) { if (S === s) stat('✕ Shuru nahi hua: ' + (e?.message || e), true); return; }
  let answered = false;
  s.unsub = cloud.liveWatch(s.id, async r => {
    if (S !== s || !r) return; s.r = r;
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
      const st = await s.pc.getStats(); let f = 0; st.forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') f = x.framesDecoded || 0; });
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

// ---------- 🧾 live bill patti (posLive) ----------
const escB = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = v => Math.round(Number(v) || 0).toLocaleString('en-US');
const q3 = v => String(Math.round((Number(v) || 0) * 1000) / 1000);
function billStop() { shotStop(); try { B.un && B.un(); } catch {} clearInterval(B.t); B = { un: null, sid: 0, prev: new Map(), del: [], fl: new Map(), recv: 0, doc: null, t: null, cnt: 0, pc: '' }; }
function billStart() {
  if (!cloud?.listenPosLive) return;
  if (B.pc === cur && B.un) return;
  billStop(); B.pc = cur; B.st0 = Date.now();
  billPaint();
  B.un = cloud.listenPosLive(cur, (d, err) => { if (err) { B.err = err.message || String(err); billPaint(); return; } if (d) { B.recv = Date.now(); billGot(d); } });
  B.t = setInterval(billPaint, 4000);
  shotStart();
}
// ---------- 🖥 POS screen ki tasveer (v2.229.0) ----------
// POS bill ko Print par hi save karta hai — is liye bante bill ki items counter PC (NT-PRINT v1.28) ki POS screen ki chhoti tasveer se:
// item likhi / scan = ~1 s mein yahan · hatai = hat gayi · print = list khali · nayi item = naya bill. Tap = poori chaurai / bara.
let SH = { un: null, t: null, recv: 0, url: '', st0: 0, d: null };
function shotStop() { try { SH.un && SH.un(); } catch {} clearInterval(SH.t); try { SH.url && URL.revokeObjectURL(SH.url); } catch {} SH = { un: null, t: null, recv: 0, url: '', st0: 0, d: null }; const e = $('lvShot'); if (e) { e.hidden = true; e.innerHTML = ''; } }
function shotStart() {
  if (!cloud?.listenPosShot || !cur) return;
  SH.st0 = Date.now();
  const e = $('lvShot'); if (e) { let fit = false; try { fit = localStorage.getItem('sam-lv-shotfit') === '1'; } catch {} e.classList.toggle('is-fit', fit); }
  SH.un = cloud.listenPosShot(cur, (d, err, cache) => { if (err || cache) return; SH.recv = Date.now(); SH.d = d; shotPaint(true); });
  SH.t = setInterval(() => shotPaint(false), 5000);
}
function shotPaint(fresh) {
  const e = $('lvShot'); if (!e) return;
  const d = SH.d, now = Date.now(), live = d && Number(d.on) === 1 && d.im && now - SH.recv < 45000;
  const note = t => { e.hidden = false; e.classList.add('is-note'); e.innerHTML = `<div class="lvs-n">🖥 ${escB(t)}</div>`; };
  if (live) {
    if (fresh) { const u = URL.createObjectURL(new Blob([d.im], { type: 'image/jpeg' })); let img = e.querySelector('img');
      if (!img) { e.classList.remove('is-note'); e.innerHTML = '<div class="lvs-h"><b>🖥 POS screen · live</b><small>tap = bara / poora</small></div><div class="lvs-b"><img alt=""></div>'; img = e.querySelector('img'); }
      img.src = u; try { SH.url && URL.revokeObjectURL(SH.url); } catch {} SH.url = u;
      const h = e.querySelector('.lvs-h'); if (h) { h.classList.remove('is-new'); void h.offsetWidth; h.classList.add('is-new'); } }
    e.hidden = false; return;
  }
  if (d && Number(d.on) === 0 && now - SH.recv < 60000) { note('POS screen: ' + (d.why || 'nahi mili') + (d.err ? ' (counter PC ki ghalti)' : '')); return; }
  if (d && SH.recv && now - SH.recv >= 45000) { note('POS screen ki tasveer ruk gayi — counter PC / NT-PRINT dekhein'); return; }
  if (now - SH.st0 > 25000) { note('POS screen ki tasveer nahi aa rahi — counter PC ka NT-PRINT (update 3-5 min) / POS ki Sale screen khuli ho'); return; }
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
  if (!d) { e.innerHTML = `<div class="lvb-h"><b>🧾 Bill</b></div><div class="lvb-e">${B.err ? '✕ ' + escB(B.err) : now - (B.st0 || now) > 15000 ? '⏳ PC se bill nahi aa raha — PC on? (update 3-5 min)' : '⏳ bill dekh raha…'}</div>`; return; }
  B.del = B.del.filter(r => now - r.at < 12000);
  const L = B.L || [], sum = L.reduce((a, x) => a + (Number(x[2]) || 0) * (Number(x[3]) || 0), 0);
  const st = Number(d.st) === 3 ? '<span class="lvb-st x">✕ Cancel</span>' : Number(d.st) === 2 ? '<span class="lvb-st ok">📌 Post ✓</span>' : d.pr ? '<span class="lvb-st ok">🖨 Print ✓</span>' : d.sid ? '<span class="lvb-st w">⏳ ban raha</span>' : '';
  const row = (x, cls) => `<div class="lvb-r ${cls}"><span class="n">${escB(x[1])}</span><span class="q">×${q3(x[2])}</span><span class="a">${nf((Number(x[2]) || 0) * (Number(x[3]) || 0))}</span></div>`;
  const rows = B.del.map(r => row(r.x, 'is-del')).join('') + [...L].reverse().map(x => { const f = B.fl.get(x[0]); return row(x, f && now - f.at < 4000 ? (f.k === 'n' ? 'is-new' : 'is-chg') : ''); }).join('');   // v2.226.0: nayi item UPAR (malik: "list upar se neeche aaye")
  const stale = B.recv && now - B.recv > 60000 ? '<div class="lvb-e">⚠ PC se bill ruka hua (1 min+)</div>' : '';
  const tot = (d.pr || Number(d.st) === 2) && Number(d.t) > 0 ? Number(d.t) : sum;
  e.innerHTML = `<div class="lvb-h"><b>${d.sid ? '#' + escB(d.no || d.sid) : '🧾 Aaj koi bill nahi'}</b>${d.sid && d.src === 'aakhri' && (Number(d.st) === 2 || (d.pr && !(now - (Number(d.la) || 0) < 90000))) ? '<small class="lvb-old">pichhla · naya bill shuru hote hi yahan</small>' : d.src === 'andaza' ? '<small class="lvb-old">⏳ ban raha (andaza — counter pakka nahi)</small>' : ''}${st}</div>${stale}<div class="lvb-l">${rows || (d.sid ? '<div class="lvb-e">pehli item ka intezar…</div>' : '')}</div>${d.sid ? `<div class="lvb-f"><span>${L.length} items</span><b>Rs ${nf(tot)}</b></div>` : ''}${d.dg && d.src !== 'chalu' ? `<div class="lvb-dg">🩺 ${escB(d.dg)}</div>` : ''}`;
  if (scroll) { const l = e.querySelector('.lvb-l'); if (l) l.scrollTop = 0; }
}
