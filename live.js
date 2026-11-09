// live.js — 🔴 COUNTER CAMERA KI LIVE VIDEO (v2.215.0, 2026-11-09) — WebRTC: video SEEDHA shop PC se phone (PC pc/live-cam.js)
// Malik: "kya direct live nahi chal sakti, koi tareeqa nikalo · only live video wala chahiye".
// Raasta: phone offer (SDP) → liveReq/<id> {pc: counter ka naam} → PC answer {ans} → video PC → phone (Firestore se nahi guzarti).
// Counter ka camera channel / NVR password app ko KABHI nahi milta (PC malik ki setting se leta hai). Har 15 s `hb` — band / chhupa = PC 45 s mein band.
// Rabta na bane (kuch mobile networks) = saaf paigham, khamosh nahi. AI NAHI.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
let cloud = null, notice = () => {}, list = [], cur = '', S = null, pcSt = null, pcStop = null;

export function openLive(o) {
  cloud = o.cloud; notice = o.notice || notice; list = (o.list || []).filter(Boolean); cur = o.cur && list.includes(o.cur) ? o.cur : (list[0] || '');
  let d = $('lvDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'lvDlg'; d.className = 'lv-dlg'; document.body.append(d); d.addEventListener('cancel', ev => { ev.preventDefault(); closeLive(); }); }
  d.innerHTML = `<div class="lv-head"><b>🔴 Live</b><span class="lv-chips">${list.map(p => `<button type="button" data-lv-pc="${esc(p)}" class="${p === cur ? 'is-in' : ''}">🖥 ${esc(p)}</button>`).join('') || '<small>Aaj koi counter bill nahi — counter ka naam bill aane par aata hai</small>'}</span><button type="button" class="lv-x" data-lv-x="1">×</button></div>
    <div class="lv-body"><video id="lvVid" playsinline muted autoplay></video><div class="lv-st" id="lvSt">⏳ jor raha…</div>
      <div class="lv-tools"><button type="button" data-lv-re="1">🔄 Dobara</button><button type="button" data-lv-full="1">⛶</button></div></div>`;
  d.onclick = ev => {
    const t = ev.target;
    if (t.closest('[data-lv-x]')) { closeLive(); return; }
    const c = t.closest('[data-lv-pc]'); if (c) { cur = c.dataset.lvPc; d.querySelectorAll('[data-lv-pc]').forEach(x => x.classList.toggle('is-in', x === c)); start(); return; }
    if (t.closest('[data-lv-re]')) { start(); return; }
    if (t.closest('[data-lv-full]')) { const v = $('lvVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (d.querySelector('.lv-body') || v).requestFullscreen?.(); } catch {} return; }
  };
  if (!d.open) d.showModal();
  if (!pcStop && cloud.listenLiveCamPc) pcStop = cloud.listenLiveCamPc(s => { pcSt = s; });
  if (cur) start(); else stat('✕ Koi counter nahi', true);
}
function stat(t, bad) { const e = $('lvSt'); if (!e) return; e.textContent = t; e.classList.toggle('bad', !!bad); e.hidden = false; }
function stop(sendEnd) {
  const s = S; S = null; if (!s) return;
  clearInterval(s.hb); clearTimeout(s.to); clearInterval(s.fr); try { s.unsub && s.unsub(); } catch {}
  try { s.pc.close(); } catch {}
  if (sendEnd && s.id && cloud.liveEnd) cloud.liveEnd(s.id).catch(() => {});
  const v = $('lvVid'); if (v) v.srcObject = null;
}
export function closeLive() { stop(true); const d = $('lvDlg'); try { d?.close(); } catch { d?.removeAttribute('open'); } try { pcStop && pcStop(); } catch {} pcStop = null; }
window.ntLvClose = () => { const d = $('lvDlg'); if (!d?.open) return false; closeLive(); return true; };
document.addEventListener('visibilitychange', () => { if (document.hidden && S) { stop(true); stat('⏸ App peeche gayi — 🔄 Dobara dabayein'); } });

async function start() {
  stop(true);
  if (!cloud?.liveStart) { stat('✕ App update karein', true); return; }
  if (pcSt && Date.now() - (Number(pcSt.at) || 0) > 5 * 60000) stat('⚠ Shop PC chup lag raha (' + Math.round((Date.now() - pcSt.at) / 60000) + ' min) — phir bhi koshish…', true); else stat('⏳ ' + cur + ' ka camera jor raha…');
  const s = S = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), pc: new RTCPeerConnection({ iceServers: STUN }), ok: 0 };
  const v = $('lvVid');
  s.pc.addTransceiver('video', { direction: 'recvonly' });
  s.pc.ontrack = e => { if (S !== s) return; v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); };
  s.pc.onconnectionstatechange = () => {
    if (S !== s) return; const st = s.pc.connectionState;
    if (st === 'connected') { s.ok = 1; stat('🟢 Live · ' + cur); setTimeout(() => { if (S === s && s.ok) $('lvSt').hidden = true; }, 2500); }
    else if (st === 'failed') stat('✕ Rabta nahi bana — is internet par seedha rabta band hai. Wi-Fi / doosra internet try karein, ya 🔄', true);
    else if (st === 'disconnected') stat('⏳ Rabta kamzor — wapas jor raha…');
  };
  try {
    await s.pc.setLocalDescription(await s.pc.createOffer());
    await new Promise(r => { if (s.pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 3000); s.pc.addEventListener('icegatheringstatechange', () => { if (s.pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
    if (S !== s) return;
    await cloud.liveStart(s.id, { pc: cur, offer: s.pc.localDescription.sdp });
  } catch (e) { if (S === s) stat('✕ Shuru nahi hua: ' + (e?.message || e), true); return; }
  let answered = false;
  s.unsub = cloud.liveWatch(s.id, async r => {
    if (S !== s || !r) return;
    if (r.st === 'err') { stat('✕ ' + (r.err || 'PC ne mana kiya'), true); return; }
    if (r.st === 'ok' && r.ans && !answered) { answered = true; clearTimeout(s.to); stat('⏳ Video aa rahi…'); try { await s.pc.setRemoteDescription({ type: 'answer', sdp: r.ans }); } catch (e) { stat('✕ ' + (e?.message || e), true); } }
  });
  s.to = setTimeout(() => { if (S === s && !answered) stat('✕ Shop PC ne 20 s mein jawab nahi diya — PC band hai ya live-cam abhi laga nahi (3-5 min)', true); }, 20000);
  s.hb = setInterval(() => { if (S === s) cloud.liveHb(s.id).catch(() => {}); }, 15000);
  s.fr = setInterval(async () => {   // jura hua par tasveer nahi = saaf batao
    if (S !== s || !s.ok) return;
    try { const st = await s.pc.getStats(); let f = 0; st.forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') f = x.framesDecoded || 0; }); if (!f && Date.now() - (s.okAt || (s.okAt = Date.now())) > 10000) stat('⚠ Juda hai par video nahi aa rahi — NVR / camera dekhein, 🔄', true); } catch {}
  }, 4000);
}
