// tally.js — 👀 BILL TALLY (v2.204.0, 2026-11-08) — Nigrani wale larke (ghar se) ki apni screen
// Malik: "maal chori hota hai — larka bill par kam likh de to kaise pakrein · camera wala banda ghar par · app mein us ki apni screen ·
//         ek insaan ek waqt mein items aur video dono dekh kar zyada se zyada parchiyan tally kar sake · easy rakhna hai"
// Data: posSales/<din>.bills (PC pos-sales-dekho) + posSaleLines/<SaleID> (items) + billClip/<SaleID> (PC bill-clip.js: counter camera ki 55 s
//       clip, hisse <SaleID>_<i>) → yahan ek waqt mein EK bill: upar video (khud chalti, 1.5×, loop), neeche items bari likhai, sirf do button
//       ✓ THEEK · ✕ KAM (✕ par items tap = kaun si nahi thi) → billTally/<SaleID>. Dabate hi agla bill. Agli clip pehle se load (jaldi).
// v2.204.1: bill ka waqt = banane / print ka (`ct`, PC pos-sales-dekho v2.4) — clip bhi usi se (malik: "posting se nahi, bill banane ke waqt se").
// v2.210.0 (9 Nov, malik: "print se 5 min pehle · un-posted ki clip jab hum order karein · Netflix jaisi speed"): PC bill-clip v2.0 apni local recording se
//   5 min ki clip 60-60 s ke HISSON mein (meta.segs, billClip/<id>_s<i>_<j>) — yahan pehla hissa aate hi chalta hai, baqi peeche load, khatam par agla khud,
//   neeche minute ke chips (1 2 3 4 5 ▶) — aakhri minute = print ka waqt. ⋮ 🔵 Un-posted: aaj ke un-posted bill → 🎥 Mangwao (billClipReq) → clip aate hi tally mein.
// Malik: ⋮ ⚙️ setup (NVR + counter ↔ camera channel), 📊 aaj ka hisaab. Larka: 📊 mera aaj, ↩ pichla, 💰 bare pehle. AI NAHI.
// v2.332.0 (20 Nov, malik: 'PC par bhi WhatsApp wala view · 2-3 cameras ki ikatthi recording · clip slow'): 🪟 PC (>= 900px) par video poori chaurai, items
//   video ke upar DAAYEIN transparent patti (group video jaisi; ⋮ se purana view) · 🎥 ⋮ Cameras = counter ke saath 1-2 aur camera (phone par yaad
//   sam-bt-xcam) → billClipCam hukum → PC bill-clip v2.12 usi waqt ki recording → billClip/<id>~<key>; sab videos ek saath chalein / rukein / aage-peeche.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const tm = t => t ? new Date(Number(t)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '';
const dayKey = off => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - (off || 0) * 86400000));
const ago = t => { const m = Math.round((Date.now() - Number(t)) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : Math.round(m / 60) + ' ghante'; };

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '', canK = () => true;
let offs = [], mounted = false, bills = new Map(), clips = new Map(), tallies = new Map(), lines = new Map(), urls = new Map(), pcSt = null, reqs = new Map(), segIdx = 0, segBusy = '';
let fPc = '', cur = '', mode = 'view', sel = new Set(), lastDone = '', reopen = '', order = 'new', speed = 1.5, loading = '', paintT = null;
let fDay = 'aaj', skipped = new Set(), undoUntil = 0, undoT = null, tapT = null;
let xcams = [], waPref = true; const xcReq = new Set();
// v2.373.0 (24 Nov, malik: 'is monitoring ki ab zaroorat nahi — WhatsApp par videos ja rahi hain · off karne ka option · screen khule to seedha menu hi main screen'):
//   🏠 home = menu (har dafa screen khulte hi) · 👀 Bill tally sirf card se · tally BAND (har phone ka apna, sam-bt-off) = clips / tally ke listener hi nahi (data bachta).
let home = true, offsT = [], homeSig = '';
const tOff = () => { try { return localStorage.getItem('sam-bt-off') === '1'; } catch { return false; } };   // v2.332.0: 🎥 mazeed cameras (naam, max 2) · 🪟 WhatsApp jaisa view
try { const a = JSON.parse(localStorage.getItem('sam-bt-xcam') || '[]'); if (Array.isArray(a)) xcams = a.filter(x => typeof x === 'string' && x).slice(0, 2); waPref = localStorage.getItem('sam-bt-wa') !== '0'; } catch {}
const isWa = () => waPref && (!!window.ntPcm || window.innerWidth >= 900);
const camKey = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'cam';
function xcFor(b) { if (!b || !xcams.length) return []; const own = String(b.pc || '').toLowerCase(); return xcams.filter(n => n.toLowerCase() !== own).map(n => ({ n, k: camKey(n), id: String(b.id) + '~' + camKey(n) })); }   // v2.224.0: 📅 din (aaj | kal | dono) · ⏭ baad mein · ↩ 5 s
try { const o = JSON.parse(localStorage.getItem('sam-bt-day') || 'null'); if (o && o.d === dayKey(0) && /^(aaj|kal|dono)$/.test(o.v)) fDay = o.v; } catch {}
const dOk = d => fDay === 'dono' || d === dayKey(fDay === 'kal' ? 1 : 0);
const dayLbl = () => fDay === 'kal' ? 'Kal' : fDay === 'dono' ? 'Aaj + Kal' : 'Aaj';
try { fPc = localStorage.getItem('sam-bt-pc') || ''; order = localStorage.getItem('sam-bt-order') || 'new'; speed = Number(localStorage.getItem('sam-bt-speed')) || 1.5; } catch {}

export function tallySetup(o) { cloud = o.cloud; notice = o.notice || notice; canK = o.can || canK; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf; }

export function renderTally(host) {
  mounted = true; document.documentElement.classList.add('bt-on');
  if (!host.querySelector('#btRoot')) {
    home = true; homeSig = '';   // v2.373.0: screen naye sire se khuli = menu
    host.innerHTML = `<div id="btRoot" class="bt-root is-home">
      <div class="bt-home" id="btHome"></div>
      <div class="bt-bar" hidden><button type="button" class="bt-menu" data-bt-home="1" title="Menu">‹ Menu</button><span class="bt-prog" id="btProg">…</span><button type="button" class="bt-warn" id="btPc" data-bt-pcst="1" hidden></button>
        <span class="bt-chips" data-mn-box>
          <button type="button" data-bt-day="1" data-mn="bt.day" data-mn-i="📅" data-mn-t="Din" data-mn-s="Aaj · Kal · Dono ke bill" data-mn-g="👀 Bill tally">📅 Din</button>
          <button type="button" data-bt-pcf="1" data-mn="bt.pcf" data-mn-i="🖥" data-mn-t="Sab counter ke bill" data-mn-s="teeno counter ikathe" data-mn-g="👀 Bill tally">🖥 Sab counter</button>
          <button type="button" data-bt-order="1" data-mn="bt.order" data-mn-i="💰" data-mn-t="Bare bill pehle" data-mn-s="warna naya pehle" data-mn-g="👀 Bill tally">💰 Bare pehle</button>
          <button type="button" data-bt-undo="1" data-mn="bt.undo" data-mn-i="↩" data-mn-t="Pichla wapas" data-mn-s="aakhri tally dobara" data-mn-g="👀 Bill tally">↩ Pichla</button>
          <button type="button" data-bt-list="1" data-mn="bt.list" data-mn-i="📋" data-mn-t="Bills ki list" data-mn-s="jo chaho kholo" data-mn-g="👀 Bill tally">📋 Bills</button>
          <button type="button" data-bt-unp="1" data-mn="bt.unp" data-mn-i="🔵" data-mn-t="Un-posted bills" data-mn-s="clip mangwao (hukum par)" data-mn-g="👀 Bill tally">🔵 Un-posted</button>
          <button type="button" data-bt-sum="1" data-mn="bt.sum" data-mn-i="📊" data-mn-t="Aaj ka hisaab" data-mn-s="kitne ✓ / ✕" data-mn-g="👀 Bill tally">📊 Aaj</button>
          <button type="button" data-bt-setup="1" data-mn="bt.setup" data-mn-i="⚙️" data-mn-t="Camera setup" data-mn-s="NVR + counter ka channel (malik)" data-mn-g="👀 Bill tally" hidden>⚙️ Setup</button>
          <button type="button" data-bt-wg="1" data-mn="bt.wg" data-mn-i="👥" data-mn-t="Group videos" data-mn-s="har bill ki video WhatsApp group mein (malik)" data-mn-g="👀 Bill tally" hidden>👥 Group videos</button>
          <button type="button" data-bt-gn="1" data-mn="bt.gn" data-mn-i="📦" data-mn-t="Loading ginti" data-mn-s="godam camera — nag ginti · note milan · 🚨 bina note" data-mn-g="👀 Bill tally" hidden>📦 Loading ginti</button>
          <button type="button" data-bt-xc="1" data-mn="bt.xc" data-mn-i="🎥" data-mn-t="Cameras (2-3 ek saath)" data-mn-s="counter ke saath godam / gate ki video bhi" data-mn-g="👀 Bill tally">🎥 Cameras</button>
          <button type="button" data-bt-wav="1" data-mn="bt.wav" data-mn-i="🪟" data-mn-t="WhatsApp jaisa view" data-mn-s="PC: items video ke upar daayein · ya purana" data-mn-g="👀 Bill tally">🪟 View</button>
          <button type="button" data-bt-wa="1" data-mn="bt.wa" data-mn-i="📲" data-mn-t="Video WhatsApp par" data-mn-s="bill number likho → malik + Mubeen" data-mn-g="👀 Bill tally">📲 Video WhatsApp</button>
          <button type="button" data-bt-cam="1" data-mn="bt.cam" data-mn-i="🔴" data-mn-t="Live camera" data-mn-s="counter ki seedhi video" data-mn-g="👀 Bill tally">🔴 Live camera</button>
          <button type="button" data-bt-live="1" data-mn="bt.live" data-mn-i="📺" data-mn-t="Counter Nazar" data-mn-s="purani live screen" data-mn-g="👀 Bill tally">📺 Counter Nazar</button>
        </span></div>
      <div class="bt-line"><i id="btLine"></i></div>
      <div class="bt-main" id="btMain"></div>
      <div class="bt-btns" id="btBtns"></div>
    </div>`;
    host.querySelector('#btRoot').addEventListener('click', onClick);
    host.querySelector('[data-bt-setup]').hidden = !isOwner();
    host.querySelector('[data-bt-cam]').hidden = !canK('nz.live');
    host.querySelector('[data-bt-wa]').hidden = !canK('nz.wa');   // v2.322.0
    host.querySelector('[data-bt-wg]').hidden = !isOwner();   // v2.328.0
    host.querySelector('[data-bt-gn]').hidden = !canK('nz.ginti');   // v2.331.0
  }
  watch(); paint();
}
export function tallyStop() { document.documentElement.classList.remove('bt-on'); if (!mounted) return; mounted = false; for (const f of offs) { try { f(); } catch {} } offs = []; stopT(); for (const u of urls.values()) { try { URL.revokeObjectURL(u); } catch {} } urls.clear(); }

// ---------- data ----------
function watch() {
  const days = [dayKey(0), dayKey(1)];
  if (!offs.length) {
    for (const d of days) offs.push(cloud.listenPosSales(d, b => { if (!Array.isArray(b)) return; for (const [id, x] of [...bills]) if (x._d === d) bills.delete(id); for (const x of b) bills.set(String(x.id), { ...x, _d: d }); schedule(); }));
    offs.push(cloud.listenBillClipPc(s => { pcSt = s; paintPc(); wgPaintSt(); }));
  }
  if (tOff() || offsT.length) return;   // v2.373.0: tally BAND = video / tally ke listener nahi
  offsT.push(cloud.listenBillClips(days, (l, e) => { if (!l) { if (e && $('btPc')) { $('btPc').hidden = false; $('btPc').textContent = '⚠'; $('btPc').dataset.full = '⚠ ' + (e.message || 'clip nahi parh sake'); $('btPc').classList.add('bad'); } return; } clips = new Map(l.map(c => [String(c.id), c])); schedule(); }));
  offsT.push(cloud.listenBillTally(days, l => { if (!l) return; tallies = new Map(l.map(t => [String(t.id), t])); schedule(); }));
  offsT.push(cloud.listenBillClipReq(dayKey(0), l => { if (!l) return; reqs = new Map(l.map(r => [String(r.id), r])); schedule(); if ($('btDlg')?.open && $('btDlg').dataset.unp) openUnposted(); }));
}
function stopT() { for (const f of offsT) { try { f(); } catch {} } offsT = []; clips = new Map(); tallies = new Map(); reqs = new Map(); cur = ''; }
function schedule() { if (paintT) return; paintT = setTimeout(() => { paintT = null; paint(); if ($('btDlg')?.open && $('btDlg').dataset.list) openList(true); }, 120); }
// v2.230.0: PRINT hote hi tally (malik: "first item likhte hi aur print ke baad hum tally kar sakein") — posted YA chhapa hua (ct)
const inQ = b => Number(b.ps) === 2 || Number(b.ct) > 0, wq = b => Number(b.pt) || Number(b.ct) || 0;
function queue() {
  const out = [];
  for (const [id, b] of bills) { if (b.x || (tallies.has(id) && id !== reopen)) continue; if (fPc && String(b.pc || '') !== fPc && id !== reopen) continue; const c = clips.get(id); if (!c || c.st !== 'ok') continue; if (!inQ(b) && !c.rq) continue; if (!dOk(b._d) && id !== reopen) continue; out.push(b); }   // v2.210.0: un-posted sirf jab clip mangwai (rq)
  out.sort((a, b) => (skipped.has(String(a.id)) - skipped.has(String(b.id))) || (order === 'big' ? (Number(b.t) - Number(a.t)) || (wq(b) - wq(a)) : wq(b) - wq(a)));   // ⏭ baad mein wale aakhir mein
  return out;
}
function counts() {
  const td = dayKey(0); let ok = 0, bad = 0, wait = 0, err = 0;
  for (const t of tallies.values()) if (dOk(t.day) && (!fPc || String(t.pc || '') === fPc)) { if (t.ok) ok++; else bad++; }
  const on0 = Number(pcSt?.on0) || 0;   // v2.209.1: sirf aaj ke bill (PC kal ke nahi kaatta) + camera ON hone ke baad wale — warna jhoota "429 ban rahi"
  for (const [id, b] of bills) { if (b.x || !inQ(b) || tallies.has(id) || b._d !== td || (fPc && String(b.pc || '') !== fPc)) continue; const c = clips.get(id); if (!c || c.st === 'wait') { if (!on0 || Number(b.ct || b.pt) >= on0 - 10 * 60000) wait++; } else if (c.st === 'err' || c.st === 'skip') err++; }
  let kalQ = 0; if (fDay === 'aaj') { const k = dayKey(1); for (const [id, b] of bills) { if (b._d !== k || b.x || tallies.has(id) || !inQ(b) || (fPc && String(b.pc || '') !== fPc)) continue; if (clips.get(id)?.st === 'ok') kalQ++; } }
  if (fDay === 'kal') { wait = 0; err = 0; }
  return { ok, bad, wait, err, kalQ, q: queue().length };
}
async function linesOf(id) {
  if (lines.has(id)) return lines.get(id);
  try { const l = await cloud.getPosSaleLines(id); lines.set(id, l || []); return l || []; } catch { return null; }
}
const segsOf = c => (c && Array.isArray(c.segs) && c.segs.length) ? c.segs : null;
async function segUrl(id, i) {   // v2.210.0: hissa i (v1 clip = ek hi hissa, key id#0)
  const key = id + '#' + i; if (urls.has(key)) return urls.get(key);
  const c = clips.get(id); if (!c || c.st !== 'ok') return '';
  const sg = segsOf(c); const u8 = sg ? await cloud.getBillClipSeg(id, i, sg[i]?.n) : (i ? null : await cloud.getBillClip(id, c.n));
  if (!u8 || !u8.length) return '';
  const u = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' }));
  urls.set(key, u); if (urls.size > 24) { const k = urls.keys().next().value; if (!k.startsWith(cur + '#') && !k.startsWith(cur + '~')) { try { URL.revokeObjectURL(urls.get(k)); } catch {} urls.delete(k); } }
  if (id === cur) paintSegs();
  return u;
}
const clipUrl = id => segUrl(id, 0);
async function loadRest(id) {   // baqi hisse peeche ek ek (Netflix jaisa) — sirf jab tak yehi bill khula hai
  if (segBusy === id) return; segBusy = id;
  try { const sg = segsOf(clips.get(id)); for (let i = 1; sg && i < sg.length; i++) { if (cur !== id) break; await segUrl(id, i); } } catch {} finally { if (segBusy === id) segBusy = ''; }
}
function paintSegs() {
  const el = $('btSegs'); if (!el) return;
  const sg = segsOf(clips.get(cur)); if (!sg || sg.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = sg.map((x, i) => `<button type="button" data-bt-seg="${i}" class="${i === segIdx ? 'on' : ''}${urls.has(cur + '#' + i) ? '' : ' dim'}" title="minute ${i + 1}">${i === sg.length - 1 ? '▶' + (i + 1) : i + 1}</button>`).join('');
}
async function playSeg(i, keepTime) {
  const id = cur, sg = segsOf(clips.get(id)); if (!sg) return; i = Math.max(0, Math.min(sg.length - 1, i)); segIdx = i; paintSegs();
  const v = $('btVid'), ld = $('btVload'); if (!v) return;
  if (!urls.has(id + '#' + i) && ld) { ld.hidden = false; ld.textContent = '⏳ minute ' + (i + 1) + '…'; }
  const u = await segUrl(id, i).catch(() => ''); if (cur !== id || segIdx !== i) return;
  if (!u) { if (ld) ld.textContent = '✕ hissa ' + (i + 1) + ' nahi mila'; return; }
  if (ld) ld.hidden = true; v.src = u; v.playbackRate = speed; if (keepTime) v.currentTime = keepTime; v.play().catch(() => {});
  xcPaint();   // v2.332.0: baqi cameras bhi isi minute par
}

// ---------- 🪟 v2.332.0: PC par WhatsApp jaisi patti (video ke upar daayein, transparent — group video jaisi) ----------
// Video ki oonchai = screen mein jitni jagah (upar ki patti se neeche ke buttons tak) — zoom (html .92) ke saath bhi sahi: asal naap se
function fitStage() {
  const st = $('btStage'); if (!st || !st.classList.contains('wa')) return;
  const r = st.getBoundingClientRect(), cw = parseFloat(getComputedStyle(st).width) || r.width, k = r.width && cw ? r.width / cw : 1;
  const bt = $('btBtns'), bh = bt && !bt.classList.contains('is-empty') ? bt.getBoundingClientRect().height : 0;
  const avail = Math.max(220, (window.innerHeight - r.top - bh - 74) / (k || 1));
  st.style.setProperty('--vh', Math.round(avail) + 'px');
}
window.addEventListener('resize', () => { clearTimeout(fitStage._t); fitStage._t = setTimeout(() => { if (mounted) { fitStage(); schedule(); } }, 150); });
function patHTML(b, t) {
  return `<div class="bt-pat" id="btPat"><div class="bt-ph"><b class="bt-pno">Bill #${esc(b.no || b.id)}</b><small>${esc(b.pc || '?')} · ${tm(b.ct || b.pt)}${b._d !== dayKey(0) ? ' (kal)' : ''}</small><b class="bt-prs">Rs ${num(b.t)}</b><small><span id="btN"></span>${b.by ? ' · ' + esc(b.by) : ''}${t ? ` · pehle ${t.ok ? '✓' : '✕'}` : ''}</small></div><ol class="bt-items" id="btItems"><li class="none">⏳ items…</li></ol></div>`;
}

// ---------- 🎥 v2.332.0: 2-3 camera ek saath (malik: 'aik hi time par do cameras ya teen cameras ki ikatthi recording') ----------
// Counter wali video bari (asal tally), saath 1-2 aur camera (⋮ 🎥 Cameras, phone par yaad). Har camera ki video PC (bill-clip v2.12) USI waqt ki recording se
// banata hai (billClipCam hukum → billClip/<id>~<key>) — counter video chale / ruke / aage-peeche ho to baqi bhi (xcSync).
function xcEnsure(b) {
  if (!b || !cloud?.reqBillCam) return;
  for (const x of xcFor(b)) { if (clips.has(x.id) || xcReq.has(x.id)) continue; xcReq.add(x.id); cloud.reqBillCam(String(b.id), x.n, x.k, b._d || dayKey(0)).catch(e => { xcReq.delete(x.id); notice('🎥 ' + x.n + ': ' + (e?.code === 'permission-denied' ? 'rules abhi nahi lagi (PC 5 min mein lagata hai)' : (e?.message || e))); }); }
}
function xcPaint() {
  const st = $('btStage'); if (!st) return;
  st.querySelectorAll('[data-xk]').forEach(tile => {
    const id = tile.dataset.xk, c = clips.get(id), lb = tile.querySelector('.bt-xl'), v = tile.querySelector('video');
    if (!c || c.st === 'wait') { if (lb) { lb.hidden = false; lb.textContent = '⏳ PC bana raha…'; } return; }
    if (c.st !== 'ok') { if (lb) { lb.hidden = false; lb.textContent = '✕ ' + (c.err || 'nahi bani'); } return; }
    const i = Math.min(segIdx, (segsOf(c) || [0]).length - 1);
    if (v.dataset.seg === String(i) && v.src) { if (lb) lb.hidden = true; return; }
    if (lb) { lb.hidden = false; lb.textContent = '⏳ video…'; }
    segUrl(id, i).then(u => { if (!u || !tile.isConnected || segIdx !== i) return; v.dataset.seg = String(i); v.src = u; v.playbackRate = speed; if (lb) lb.hidden = true;
      v.onloadedmetadata = () => xcSync(); }).catch(() => { if (lb) lb.textContent = '✕ video nahi aayi'; });
  });
}
function xcSync() {
  const v = $('btVid'), st = $('btStage'); if (!v || !st) return;
  st.querySelectorAll('video.bt-xv').forEach(x => {
    if (!x.src || x.dataset.seg !== String(segIdx) || x.readyState < 1) return;
    if (x.playbackRate !== v.playbackRate) x.playbackRate = v.playbackRate;
    if (Math.abs(x.currentTime - v.currentTime) > 0.6) { try { x.currentTime = Math.min(v.currentTime, Math.max(0, (x.duration || 1e9) - 0.05)); } catch {} }
    if (v.paused || v.ended) { if (!x.paused) x.pause(); } else if (x.paused) x.play().catch(() => {});
  });
}
// ---------- 🚪 v2.337.0: GATE PASS — godam ki video (malik 21 Nov: 'jis item ka gate pass banta hai us item ka godam ka camera — screen ke upar bhi') ----------
// PC bill-clip v2.18: billClip/<SaleID>~g<godam> {gp 1, st wait|ok|err, gn, cam, it [{n, qs, ok}], nt / nl, gb} — post se 20 s pehle → godam wale ke ✓ de diya ke
// 1 min baad (✓ na ho = post + 10 min). Yahan counter video ke UPAR chhoti (apna waqt — counter video ke saath sync NAHI, alag lamha hai). Tap = ruk / chal · ⛶ poori screen.
const gpFor = id => [...clips.values()].filter(c => c && c.gp && String(c.sid) === String(id) && c.st !== 'skip');
// v2.338.0: ek godam par 2 camera (malik 21 Nov: 'aik hi godam par two cameras — dono side by side') — ~g<g> (ci 1) + ~g<g>b (ci 2), WAHI waqt → ek dabbe mein saath saath, ek saath chalein / rukein
function gpGroups(id) { const m = new Map(); for (const c of gpFor(id)) { const g = Number(c.g) || 0; if (!m.has(g)) m.set(g, []); m.get(g).push(c); } for (const L of m.values()) L.sort((a, c) => (Number(a.ci) || 1) - (Number(c.ci) || 1)); return [...m.entries()].sort((a, c) => a[0] - c[0]); }
const durS = s => { s = Number(s) || 0; return s >= 120 ? Math.round(s / 60) + ' min' : s + ' s'; };
const gpMaster = t => (t ? [...t.querySelectorAll('[data-gk]')].find(cell => clips.get(cell.dataset.gk)?.st === 'ok' && cell.querySelector('video')?.src) || null : null);
function gpLoad(cell, c, i) {
  const id = String(c.id), v = cell.querySelector('video'), lb = cell.querySelector('.bt-gl'); if (!v) return; v.dataset.seg = String(i);
  segUrl(id, i).then(u => { if (!u || !cell.isConnected || v.dataset.seg !== String(i)) return; v.src = u; v.playbackRate = speed; v.play().catch(() => {}); if (lb) lb.hidden = true; const sg = segsOf(c); if (sg && i + 1 < sg.length) segUrl(id, i + 1).catch(() => {}); }).catch(() => { if (lb) { lb.hidden = false; lb.textContent = '✕ video nahi aayi'; } });
}
function gpSync(t) {
  const mv = gpMaster(t)?.querySelector('video'); if (!mv) return;
  t.querySelectorAll('video.bt-gv').forEach(x => {
    if (x === mv || !x.src || x.dataset.seg !== mv.dataset.seg || x.readyState < 1) return;
    if (x.playbackRate !== mv.playbackRate) x.playbackRate = mv.playbackRate;
    if (Math.abs(x.currentTime - mv.currentTime) > 0.6) { try { x.currentTime = Math.min(mv.currentTime, Math.max(0, (x.duration || 1e9) - 0.05)); } catch {} }
    if (mv.paused || mv.ended) { if (!x.paused) x.pause(); } else if (x.paused) x.play().catch(() => {});
  });
}
function gpNext(t) {   // pehle camera ka hissa khatam = sab camera agla hissa
  const m = gpMaster(t), mv = m?.querySelector('video'); if (!mv) return;
  const sg = segsOf(clips.get(m.dataset.gk)), i = Number(mv.dataset.seg) || 0; if (!sg || i + 1 >= sg.length) return;
  t.querySelectorAll('[data-gk]').forEach(cell => { const c = clips.get(cell.dataset.gk); if (c && c.st === 'ok') gpLoad(cell, c, i + 1); });
}
function gpPaint() {
  const box = $('btGp'); if (!box) return;
  const G = gpGroups(cur), want = new Set(G.map(([g]) => String(g)));
  box.hidden = !G.length;
  box.querySelectorAll('[data-gg]').forEach(t => { if (!want.has(t.dataset.gg)) t.remove(); });
  for (const [g, L] of G) {
    const sig = L.map(c => c.id).join('|'), find = () => [...box.querySelectorAll('[data-gg]')].find(x => x.dataset.gg === String(g));
    let t = find();
    if (!t || t.dataset.sig !== sig) {
      const html = `<div class="bt-gt" data-gg="${esc(g)}" data-sig="${esc(sig)}"><div class="bt-gh"><b></b><small></small><button type="button" class="bt-gfull" data-bt-gfull="1" title="poori screen" hidden>⛶</button></div><div class="bt-gvs n${L.length}" hidden>${L.map(c => `<div class="bt-gc" data-gk="${esc(c.id)}"><video class="bt-gv" playsinline muted autoplay preload="auto"></video><span class="bt-gcn"></span><div class="bt-gl"></div></div>`).join('')}</div><div class="bt-gi" hidden></div></div>`;
      if (t) t.outerHTML = html; else box.insertAdjacentHTML('beforeend', html);
      const tt = find(); t = tt;
      tt.querySelectorAll('video').forEach(v => {
        ['play', 'pause', 'seeked', 'ratechange', 'timeupdate'].forEach(ev => v.addEventListener(ev, () => { if (gpMaster(tt)?.querySelector('video') === v) gpSync(tt); }));
        v.addEventListener('ended', () => { if (gpMaster(tt)?.querySelector('video') === v) gpNext(tt); });
        v.addEventListener('loadedmetadata', () => gpSync(tt));
      });
    }
    const okL = L.filter(c => c.st === 'ok'), p = okL[0] || L[0], ok = !!okL.length, nl = Number(p.nl) || (Array.isArray(p.it) ? p.it.length : 0), nt = Number(p.nt) || 0;
    t.classList.toggle('ok', ok); t.classList.toggle('bad', !ok && L.every(c => c.st === 'err')); t.classList.toggle('n2', L.length > 1);
    t.querySelector('.bt-gh b').textContent = '🚪 ' + (p.gn || 'Godam');
    t.querySelector('.bt-gh small').textContent = ok ? `${nt && nt === nl ? '✓ sab diya' : nt ? `✓ ${nt}/${nl} diya` : '✓ tick nahi hua'}${p.gb ? ' · ' + p.gb : ''} · ${durS(p.dur)}`
      : L.every(c => c.st === 'err') ? '✕ ' + (p.err || 'video nahi bani') : `⏳ ✓ de diya ke 1 min baad video aayegi${p.due ? ' (zyada se zyada ' + tm(p.due) + ')' : ''}`;
    const gi = t.querySelector('.bt-gi'), its = Array.isArray(p.it) ? p.it : [];
    gi.hidden = !ok || !its.length; gi.textContent = its.map(x => `${x.n} ${x.qs || ('×' + x.q)}${x.ok ? ' ✓' : ''}`).join(' · ');
    t.querySelector('.bt-gfull').hidden = !ok; t.querySelector('.bt-gvs').hidden = !ok;
    if (!ok) continue;
    const mv = gpMaster(t)?.querySelector('video');
    for (const c of L) {
      const cell = [...t.querySelectorAll('[data-gk]')].find(x => x.dataset.gk === String(c.id)); if (!cell) continue;
      const v = cell.querySelector('video'), lb = cell.querySelector('.bt-gl');
      cell.querySelector('.bt-gcn').textContent = L.length > 1 ? '📹 ' + (c.cam || '') : '';
      if (c.st === 'ok') { if (!v.dataset.seg) { lb.hidden = false; lb.textContent = '⏳ video…'; gpLoad(cell, c, mv && mv !== v ? Number(mv.dataset.seg) || 0 : 0); } }
      else { lb.hidden = false; lb.textContent = c.st === 'err' ? '✕ ' + (c.err || 'nahi bani') : '⏳ ban rahi…'; }
    }
  }
}

function openXc() {
  const d = dlg(); delete d.dataset.list; delete d.dataset.unp; delete d.dataset.wa; delete d.dataset.wg;
  const cams = (Array.isArray(pcSt?.cams) ? pcSt.cams : []).filter(c => c && c.n);
  const sel = new Set(xcams.filter(n => cams.some(c => c.n === n)));
  const row = c => `<button type="button" class="bt-tg bt-xcb${sel.has(c.n) ? ' on' : ''}" data-xcn="${esc(c.n)}"${c.r ? '' : ' disabled'}>${c.c ? '🖥' : '📹'} ${esc(c.n)} <small>${c.r ? (c.on ? '⏺ 🟢' : '⏺ ⚫ ruki') : '⏹ recording band'}</small></button>`;
  d.innerHTML = `<div class="bt-dhead"><b>🎥 Kitne camera ek saath?</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><p class="bt-sub">Bill ke counter ka camera hamesha bara. Saath <b>1-2 aur</b> chunein — usi waqt ki video saath chalegi (pehli dafa PC 5-20 s leta hai). Sirf ⏺ recording wale camera; recording malik ⚙️ Camera setup se ON karta hai.</p>
      <div class="bt-row bt-pcs">${cams.map(row).join('') || '<small>Camera ki list abhi PC se nahi aayi</small>'}</div>
      <div class="bt-warow0"><button type="button" class="bt-sm" data-xc-none="1">✕ Sirf counter</button><button type="button" class="bt-sm bt-wago" data-xc-ok="1">✅ Lagao</button></div></div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelectorAll('[data-xcn]').forEach(b => b.onclick = () => { const n = b.dataset.xcn; if (sel.has(n)) sel.delete(n); else { if (sel.size >= 2) { notice('Zyada se zyada 2 aur camera (kul 3)'); return; } sel.add(n); } b.classList.toggle('on', sel.has(n)); });
  const done = list => { xcams = list.slice(0, 2); try { localStorage.setItem('sam-bt-xcam', JSON.stringify(xcams)); } catch {} d.close(); const mn = $('btMain'); if (mn) mn.innerHTML = ''; paint(); notice(xcams.length ? '🎥 ' + (xcams.length + 1) + ' camera ek saath' : '🎥 Sirf counter ka camera'); };
  d.querySelector('[data-xc-none]').onclick = () => done([]);
  d.querySelector('[data-xc-ok]').onclick = () => done([...sel]);
  if (!d.open) d.showModal();
}


// ---------- paint ----------
// v2.230.0: upar teeno counter ke chips (Live jaisa) — har chip par us counter ke baqi bill; dabao = neeche usi ke bill. Sab counter / din ⋮ mein.
function pcChips() {
  const m = new Map(); for (const k of (Array.isArray(pcSt?.pcs) ? pcSt.pcs : [])) if (k) m.set(String(k), 0);
  for (const [id, b] of bills) { if (b.x || !dOk(b._d)) continue; const k = String(b.pc || ''); if (!k) continue; if (!m.has(k)) m.set(k, 0); const c = clips.get(id); if (!tallies.has(id) && c && c.st === 'ok' && (inQ(b) || c.rq)) m.set(k, m.get(k) + 1); }
  if (fPc && !m.has(fPc)) m.set(fPc, 0);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function setPc(v) { fPc = v || ''; try { localStorage.setItem('sam-bt-pc', fPc); } catch {} reopen = ''; cur = ''; mode = 'view'; sel = new Set(); const mn = $('btMain'); if (mn) mn.innerHTML = ''; paint(); }
function paintPc() {
  const el = $('btPc'); if (!el) return;
  const c = counts(); let s = '';
  if (!pcSt) s = '';
  else if (Date.now() - (Number(pcSt.at) || 0) > 5 * 60000) s = '🖥 PC chup (' + ago(pcSt.at) + ')';
  else if (!pcSt.on) s = '⚙️ camera band — ' + (pcSt.err || 'setup');
  else if (pcSt.test && !pcSt.test.ok) s = '🔎 Rabta ✕ (' + tm(pcSt.test.at) + ') ' + (pcSt.test.web ? pcSt.test.web + ' · ' : '') + (pcSt.test.err || '');
  else if (pcSt.err) s = '⚠ ' + pcSt.err;
  else { const ln = pcSt.ln || {}, a = ln.a || {}, bb = ln.b || {};   // v2.332.0: PC bill-clip v2.12 ki do line
    s = '🎥 PC chalu' + (c.wait ? ' · ⏳ ' + c.wait + ' clip ban rahi' : '') + (a.ms ? ` · ⚡ naya bill: ek clip ~${Math.max(1, Math.round(a.ms / 1000))} s` : '') + (bb.cur ? ` · 🐢 purana ${bb.cur} NVR se (asal waqt jitna)` : '') + (Number(pcSt.q) ? ` · line mein ${pcSt.q}` : ''); }
  if (c.err && !/⚠/.test(s)) s += (s ? ' · ' : '') + '✕ ' + c.err + ' clip nahi bani';
  const bad = /⚠|chup|✕|band/.test(s);   // v2.224.0: screen par sirf chhota chip — tap = poori baat
  el.hidden = !(bad || c.wait); el.textContent = /chup/.test(s) ? '⚠ PC chup' : bad ? '⚠' : '⏳ ' + c.wait; el.dataset.full = s; el.title = s; el.classList.toggle('bad', bad);
}
// ---------- 🏠 v2.373.0: MENU = Nigrani ki pehli screen ----------
function homeCards() {
  const off = tOff(), c = off ? null : counts(), L = [], add = (show, k, i, t, sub) => { if (show) L.push([k, i, t, sub]); };
  add(!off, 'tally', '👀', 'Bill tally', c ? `${c.q} bill baqi${c.wait ? ' · ⏳ ' + c.wait + ' ban rahi' : ''}` : '');
  add(canK('nz.live'), 'cam', '🔴', 'Live camera', 'counter / godam ki seedhi video');
  add(canK('nz.wa'), 'wa', '📲', 'Video WhatsApp par', 'bill number → malik + Mubeen');
  add(isOwner(), 'wg', '👥', 'Group videos', 'har bill + 📼 sab cameras group mein');
  add(canK('nz.ginti'), 'gn', '📦', 'Loading ginti', 'godam camera ki ginti');
  add(canK('nz.gvid') && typeof window.ntGodamV === 'function', 'gv', '🏬', 'Godam videos', 'godam ke waqie ki video');
  add(!off, 'list', '📋', 'Bills ki list', 'har bill ki video · ⚡ / 🐢 raftar');
  add(!off, 'unp', '🔵', 'Un-posted bills', 'clip mangwao');
  add(!off, 'sum', '📊', 'Aaj ka hisaab', '✓ theek / ✕ kam');
  add(isOwner(), 'setup', '⚙️', 'Camera setup', 'NVR + counter ke camera');
  add(isOwner() && typeof window.ntPcLoad === 'function', 'pcl', '🔥', 'PC ka bojh', 'CPU · RAM · network chart');
  add(true, 'live', '📺', 'Counter Nazar', 'purani live screen');
  return L;
}
function paintHome() {
  const el = $('btHome'); if (!el) return;
  const off = tOff(), L = homeCards(), sig = JSON.stringify([off, L]); if (sig === homeSig && el.firstChild) return; homeSig = sig;
  el.innerHTML = `<div class="bt-hgrid">${L.map(([k, i, t, sub]) => `<button type="button" class="bt-hcard" data-bt-h="${k}"><span class="bt-hi">${i}</span><span class="bt-ht"><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`).join('')}</div>
    <div class="bt-hsw"><span><b>👀 Bill tally</b><small>${off ? 'BAND — is phone par bill ki videos load nahi hotin (data bachta hai). WhatsApp group videos pehle jaisi jati rahengi.' : 'CHALU — sirf 👀 card kholne par video chalti hai.'}</small></span><button type="button" class="bt-hswb${off ? '' : ' is-in'}" data-bt-toff="1">${off ? '⚪ BAND' : '🟢 CHALU'}</button></div>`;
}
function goHome() { home = true; const mn = $('btMain'); if (mn) mn.innerHTML = ''; mode = 'view'; sel = new Set(); paint(); }
function paint() {
  if (!mounted || !$('btRoot')) return;
  { const root = $('btRoot'), hm = home || tOff(), bar = root.querySelector('.bt-bar'), he = $('btHome');   // v2.373.0: 🏠 menu ya tally
    root.classList.toggle('is-home', hm); if (bar && bar.hidden !== hm) bar.hidden = hm; if (he) he.hidden = !hm;
    if (hm) { paintHome(); return; } }
  const c = counts(), q = queue();
  const pg = $('btProg'); if (pg) { const sig = pcChips().map(([k, n]) => k + ':' + n).join('|') + '|' + fPc + '|' + fDay + '|' + c.ok + '|' + c.bad + '|' + c.q;
    if (pg.dataset.sig !== sig) { pg.dataset.sig = sig; const sl = pg.scrollLeft;
      pg.innerHTML = pcChips().map(([k, n]) => `<button type="button" class="bt-pcchip${fPc === k ? ' is-in' : ''}" data-bt-pcv="${esc(k)}">🖥 ${esc(k)}${n ? ` <i>${n}</i>` : ''}</button>`).join('') + (fDay !== 'aaj' ? `<button type="button" class="bt-pcchip is-day" data-bt-day="1">📅 ${dayLbl()}</button>` : '') + `<span class="bt-cnt"><b class="ok">✓ ${c.ok}</b>${c.bad ? ` <b class="bad">✕ ${c.bad}</b>` : ''}${fPc ? '' : ` · baqi <b>${c.q}</b>`}</span>`; pg.scrollLeft = sl; } }
  const ln = $('btLine'); if (ln) { const tot = c.ok + c.bad + c.q; ln.style.width = (tot ? Math.round((c.ok + c.bad) / tot * 100) : 0) + '%'; }
  paintPc();
  const ob = $('btRoot').querySelector('[data-bt-order]'); if (ob) { ob.classList.toggle('on', order === 'big'); ob.textContent = order === 'big' ? '💰 Bare pehle ✓' : '💰 Bare pehle'; }
  if (!cur || !q.some(b => String(b.id) === cur)) { cur = q.length ? String(q[0].id) : ''; mode = 'view'; sel = new Set(); }
  const main = $('btMain'), btns = $('btBtns'); if (!main) return;
  if (!cur) {
    const dl = fDay === 'kal' ? 'Kal' : 'Aaj';
    const why = c.wait ? `⏳ ${c.wait} bill ki clip ban rahi hai (PC 1-2 min lagata hai) — khud aa jayegi.` : c.err ? `✕ ${c.err} bill ki clip nahi bani — malik ⚙️ / PC dekhe.` : fDay === 'kal' ? 'Kal ka koi bill baqi nahi (clip 2 din baad khud mit jati hai).' : `${dl} ke sab bill tally ho gaye 👏 — naya bill post hote hi yahan aayega.`;
    main.innerHTML = `<div class="bt-empty"><div class="bt-big">${c.wait ? '⏳' : c.err ? '⚠' : '✅'}</div><p>${esc(why)}</p><div class="bt-erow">${c.kalQ ? `<button type="button" class="bt-sm go" data-bt-dayv="kal">📅 Kal ke ${c.kalQ} bill dekhein</button>` : ''}${fDay !== 'aaj' ? `<button type="button" class="bt-sm go" data-bt-dayv="aaj">📅 Aaj par wapas</button>` : ''}${lastDone ? `<button type="button" class="bt-sm" data-bt-undo="1">↩ Pichla bill dobara dekho</button>` : ''}</div></div>`;
    paintBtns(true); return;
  }
  const b = bills.get(cur), cl = clips.get(cur) || {}, t = tallies.get(cur);
  const wa = isWa(), xs = xcFor(b), sig = (wa ? 'w' : 'p') + xs.map(x => x.k).join(','), card0 = main.querySelector(`[data-bt-bill="${cur}"]`);   // v2.332.0: view / cameras badle = dobara banao
  if (!card0 || card0.dataset.sig !== sig) {
    main.innerHTML = `<div class="bt-card${wa ? ' bt-wa1' : ''}" data-bt-bill="${esc(cur)}" data-sig="${esc(sig)}">
      <div class="bt-vcol"><div class="bt-gpv" id="btGp" hidden></div><div class="bt-stage n${1 + xs.length}${wa ? ' wa' : ''}" id="btStage"><div class="bt-vwrap bt-vmain"><video id="btVid" playsinline muted autoplay preload="auto"></video>
        <div class="bt-vload" id="btVload">⏳ video…</div><div class="bt-flash" id="btFlash" hidden></div><button type="button" class="bt-vend" id="btVend" data-bt-again="1" hidden>✅ Video khatam · ↺ Dobara dekho</button>
        <div class="bt-vchips"><span class="bt-segs" id="btSegs"></span><button type="button" class="bt-spd" data-bt-spc="1" title="raftar">${speed}×</button><button type="button" data-bt-full="1" title="poori screen">⛶</button></div>
      ${wa ? patHTML(b, t) : ''}</div>${xs.map(x => `<div class="bt-vwrap bt-vx" data-xk="${esc(x.id)}"><video class="bt-xv" playsinline muted preload="auto"></video><span class="bt-xn">📹 ${esc(x.n)}</span><div class="bt-xl">⏳ PC bana raha…</div></div>`).join('')}${wa && xs.length === 1 ? '<button type="button" class="bt-xadd" data-bt-xc="1">＋ 📹 aur camera</button>' : ''}
      </div>
      <div class="bt-info"><span class="bt-inf1"><b class="bt-bno" id="btBno"></b> ${b._d !== dayKey(0) ? '<em>kal</em> ' : ''}${tm(b.ct || b.pt)}${b.ct ? '' : ' (post)'}${b.by ? ' · 👦 ' + esc(b.by) : ''}${!fPc && b.pc ? ' · 🖥 ' + esc(b.pc) : ''}${b.p ? ' · ' + esc(b.p) : ''}</span><b class="bt-rs">Rs ${num(b.t)}</b></div>
      <div class="bt-tip">👆 tap = ruk / chal · 2 dafa tap daayein / baayein = 10 s aage / peeche${cl.dur ? ' · ' + (cl.dur >= 120 ? Math.round(cl.dur / 60) + ' min' : cl.dur + ' s') : ''}</div></div>
      ${wa ? '' : `<div class="bt-side"><div class="bt-ihead">🧾 Bill ki items <b id="btN"></b>${t ? `<em>pehle ${t.ok ? '✓' : '✕'} (${esc(t.n || '')})</em>` : ''}</div><ol class="bt-items" id="btItems"><li class="none">⏳ items…</li></ol></div>`}
    </div>`;
    segIdx = 0; loadCur(cur);
    const vv = main.querySelector('#btVid');   // v2.210.0: hissa khatam = agla · v2.222.0: aakhri ke baad shuru se NAHI (malik: "6 items ke baad video phir se start") — ruko + ↺ chip
    if (vv) { vv.addEventListener('ended', () => { const sg = segsOf(clips.get(cur)); if (sg && segIdx + 1 < sg.length) { playSeg(segIdx + 1); return; } const e = $('btVend'); if (e) e.hidden = false; }); vv.addEventListener('play', () => { const e = $('btVend'); if (e) e.hidden = true; const f = $('btFlash'); if (f) f.hidden = true; }); vv.addEventListener('pause', () => { if (!vv.ended) flash('⏸ ruki — tap se chalao', true); }); }
    if (vv) ['play', 'pause', 'ratechange', 'seeked', 'timeupdate'].forEach(ev => vv.addEventListener(ev, xcSync));   // v2.332.0: 🎥 baqi cameras saath
    if (vv) vv.addEventListener('loadedmetadata', () => { const st = $('btStage'); if (st && vv.videoWidth && vv.videoHeight) st.style.setProperty('--ar', (vv.videoWidth / vv.videoHeight).toFixed(3)); });   // v2.332.0: dabba video ki asal shakal (kale kinare nahi)
  }
  const bn = $('btBno'); if (bn && b) { const po = Number(b.ps) === 2, tx = (po ? '📌 ' : '🔵 ') + '#' + (b.no || ''); if (bn.textContent !== tx) bn.textContent = tx; bn.classList.toggle('po', po); bn.classList.toggle('un', !po); bn.title = po ? 'Posted' : 'Un-posted'; }
  paintItems(); paintBtns(); xcEnsure(b); xcPaint(); gpPaint(); fitStage();
  { const nx = q.find(x => String(x.id) !== cur); if (nx) xcEnsure(nx); }   // v2.332.0: agle bill ke cameras bhi pehle se maango
  for (const x of q.filter(x => String(x.id) !== cur).slice(0, 3)) { clipUrl(String(x.id)).catch(() => {}); linesOf(String(x.id)); }   // v2.212.0: aage 3 bill ki video + items pehle se (✓ par agla foran)
}
async function loadCur(id) {
  loading = id;
  linesOf(id).then(() => { if (cur === id) paintItems(); });   // v2.212.0: items jaise hi aayein — video ka intezar nahi
  const u = await clipUrl(id).catch(e => { notice('Video nahi aayi: ' + (e?.message || e)); return ''; });
  if (loading !== id || cur !== id) return;
  const v = $('btVid'), ld = $('btVload');
  if (v) { if (u) { v.src = u; v.playbackRate = speed; v.play().catch(() => {}); if (ld) ld.hidden = true; } else if (ld) ld.textContent = '✕ video nahi mili'; }
  paintSegs(); loadRest(id);
  paintItems();
}
function paintItems() {
  const ol = $('btItems'), n = $('btN'); if (!ol) return;
  const l = lines.get(cur);
  if (!l) { ol.innerHTML = '<li class="none">⏳ items…</li>'; return; }
  if (!l.length) { ol.innerHTML = '<li class="none">(POS lines abhi nahi — PC 1 min mein likhta hai)</li>'; return; }
  if (n) n.textContent = l.length + ' cheezein';
  ol.classList.toggle('two', l.length > 7);
  const miss = mode === 'miss';
  ol.innerHTML = l.map((x, i) => { const k = String(x.n || ''); return `<li${miss ? ' class="tap' + (sel.has(k) ? ' sel' : '') + '"' : ''} data-bt-item="${esc(k)}"><b>${esc(k)}</b><span class="bt-q">× ${esc(x.q)}</span>${miss ? `<i>${sel.has(k) ? '✕' : '☐'}</i>` : ''}</li>`; }).join('');
}
function paintBtns(empty) {
  const b = $('btBtns'); if (!b) return;
  const ld = undoUntil > Date.now() && lastDone ? bills.get(lastDone) : null, tl = ld ? tallies.get(lastDone) : null;
  const un = ld && tl ? `<button type="button" class="bt-undo" data-bt-undo="1">${tl.ok ? '✓' : '✕'} #${esc(ld.no)} · ↩ Wapas</button>` : '';
  if (empty || !cur) { b.innerHTML = un; b.className = 'bt-btns is-empty'; return; }
  b.className = 'bt-btns' + (mode === 'miss' ? ' is-miss' : '');
  if (mode === 'miss') b.innerHTML = `<button type="button" class="bt-cancel" data-bt-cancel="1">↩</button><button type="button" class="bt-dk" data-bt-dk="1">🤷 Pata nahi kaun si</button><button type="button" class="bt-save" data-bt-save="1">✕ KAM — Save${sel.size ? ' (' + sel.size + ')' : ''}</button>`;
  else b.innerHTML = un + `<button type="button" class="bt-ok" data-bt-ok="1">✓ THEEK</button><button type="button" class="bt-bad" data-bt-bad="1">✕ KAM</button><button type="button" class="bt-skip" data-bt-skip="1" title="Baad mein">⏭<small>baad mein</small></button>`;
}
function flash(t, keep) { const f = $('btFlash'); if (!f) return; f.textContent = t; f.hidden = false; clearTimeout(f._t); if (!keep) f._t = setTimeout(() => { f.hidden = true; }, 700); }
function seek(dir) {   // v2.224.0: 2 dafa tap = ±10 s (hisson ke paar bhi)
  const v = $('btVid'); if (!v) return; const sg = segsOf(clips.get(cur));
  if (dir < 0) { if (v.currentTime < 10 && segIdx > 0 && sg) { playSeg(segIdx - 1, 50); flash('⏪ 10 s'); return; } v.currentTime = Math.max(0, v.currentTime - 10); }
  else { if (v.duration && v.currentTime + 10 >= v.duration) { if (sg && segIdx + 1 < sg.length) { playSeg(segIdx + 1); flash('⏩ 10 s'); return; } v.currentTime = Math.max(0, v.duration - 0.3); } else v.currentTime += 10; }
  v.play().catch(() => {}); flash(dir < 0 ? '⏪ 10 s' : '⏩ 10 s');
}
function setDay(v) { fDay = v; try { localStorage.setItem('sam-bt-day', JSON.stringify({ d: dayKey(0), v })); } catch {} reopen = ''; cur = ''; mode = 'view'; sel = new Set(); const mn = $('btMain'); if (mn) mn.innerHTML = ''; paint(); }

// ---------- save ----------
async function save(ok, miss) {
  const id = cur, b = bills.get(id); if (!b) return;
  const d = { ok: ok ? 1 : 0, miss: miss || [], n: (byName() || 'Nigrani').slice(0, 40), day: b._d || dayKey(0), no: String(b.no || ''), pc: String(b.pc || ''), t: Number(b.t) || 0, by2: String(b.by || '') };
  tallies.set(id, { ...d, id, by: uidOf(), at: Date.now() });   // pehle UI (foran agla), server baad mein
  lastDone = id; reopen = ''; cur = ''; mode = 'view'; sel = new Set(); skipped.delete(id); undoUntil = Date.now() + 5000; clearTimeout(undoT); undoT = setTimeout(() => { undoUntil = 0; paintBtns(!cur); }, 5100); paint();
  try { await cloud.saveBillTally(id, d); if (!ok) notice(`✕ Bill #${b.no} — kam likha (${(miss || []).join(', ') || 'kaun si: pata nahi'})`); }
  catch (e) { tallies.delete(id); notice('Save nahi hua: ' + (e?.message || e)); paint(); }
}

// ---------- click ----------
async function onClick(e) {
  const t = e.target;
  { const h = t.closest('[data-bt-h]'); if (h) { const k = h.dataset.btH;   // v2.373.0: 🏠 menu ke cards
      if (k === 'tally') { if (tOff()) return; home = false; const mn = $('btMain'); if (mn) mn.innerHTML = ''; watch(); paint(); return; }
      if (k === 'cam') { openCam(); return; } if (k === 'wa') { openWa(); return; } if (k === 'wg') { openWg(); return; } if (k === 'setup') { openSetup(); return; }
      if (k === 'list') { openList(); return; } if (k === 'unp') { openUnposted(); return; } if (k === 'sum') { openSum(); return; }
      if (k === 'gn') { try { window.ntGinti?.(); } catch (er) { notice('Loading ginti: ' + (er?.message || er)); } return; }
      if (k === 'gv') { try { window.ntGodamV?.(); } catch {} return; } if (k === 'pcl') { window.ntPcLoad?.(); return; } if (k === 'live') { window.ntNazarLive?.(); return; }
      return; } }
  if (t.closest('[data-bt-toff]')) { const off = !tOff(); try { localStorage.setItem('sam-bt-off', off ? '1' : '0'); } catch {} if (off) stopT(); else watch(); home = true; homeSig = ''; paint(); notice(off ? '👀 Bill tally BAND — is phone par videos load nahi hongi' : '👀 Bill tally CHALU'); return; }
  if (t.closest('[data-bt-home]')) { goHome(); return; }
  if (t.closest('[data-bt-ok]')) { save(true, []); return; }
  if (t.closest('[data-bt-bad]')) { mode = 'miss'; sel = new Set(); paintItems(); paintBtns(); return; }
  if (t.closest('[data-bt-cancel]')) { mode = 'view'; sel = new Set(); paintItems(); paintBtns(); return; }
  if (t.closest('[data-bt-dk]')) { save(false, ['?']); return; }
  if (t.closest('[data-bt-save]')) { save(false, [...sel]); return; }
  const it = t.closest('[data-bt-item]'); if (it && mode === 'miss') { const k = it.dataset.btItem; if (sel.has(k)) sel.delete(k); else sel.add(k); paintItems(); paintBtns(); return; }
  if (t.closest('[data-bt-skip]')) { const q = queue(); if (q.length < 2) { notice('Bas yehi ek bill baqi hai'); return; } skipped.add(cur); cur = ''; mode = 'view'; sel = new Set(); $('btMain').innerHTML = ''; paint(); notice('⏭ Baad mein — ye bill aakhir mein aayega'); return; }
  if (t.closest('[data-bt-spc]')) { speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; try { localStorage.setItem('sam-bt-speed', String(speed)); } catch {} const v = $('btVid'); if (v) v.playbackRate = speed; t.closest('[data-bt-spc]').textContent = speed + '×'; flash(speed + '×'); return; }
  if (t.closest('[data-bt-pcst]')) { notice($('btPc')?.dataset.full || ''); return; }
  const dv = t.closest('[data-bt-dayv]'); if (dv) { setDay(dv.dataset.btDayv); return; }
  if (t.closest('[data-bt-day]')) { openDayPick(); return; }
  const sp = t.closest('[data-bt-sp]'); if (sp) { speed = Number(sp.dataset.btSp) || 1.5; try { localStorage.setItem('sam-bt-speed', String(speed)); } catch {} const v = $('btVid'); if (v) v.playbackRate = speed; sp.parentElement.querySelectorAll('[data-bt-sp]').forEach(x => x.classList.toggle('on', x === sp)); return; }
  if (t.closest('[data-bt-back10]')) { const v = $('btVid'); if (v) { if (v.currentTime < 10 && segIdx > 0 && segsOf(clips.get(cur))) { playSeg(segIdx - 1, 50); return; } v.currentTime = Math.max(0, v.currentTime - 10); v.play().catch(() => {}); } return; }
  const sg = t.closest('[data-bt-seg]'); if (sg) { playSeg(Number(sg.dataset.btSeg) || 0); return; }
  if (t.closest('[data-bt-again]')) { const e = $('btVend'); if (e) e.hidden = true; if (segsOf(clips.get(cur))) playSeg(0); else { const v = $('btVid'); if (v) { v.currentTime = 0; v.play().catch(() => {}); } } return; }
  if (t.closest('[data-bt-unp]')) { openUnposted(); return; }
  if (t.closest('[data-bt-list]')) { openList(); return; }
  const pv = t.closest('[data-bt-pcv]'); if (pv) { setPc(fPc === pv.dataset.btPcv ? '' : pv.dataset.btPcv); return; }
  if (t.closest('[data-bt-pcf]')) { setPc(''); notice('🖥 Sab counter ke bill'); return; }
  if (t.closest('[data-bt-cam]')) { openCam(); return; }
  const rq = t.closest('[data-bt-rq]'); if (rq) { const id = rq.dataset.btRq, b = bills.get(id); rq.disabled = true; rq.textContent = '⏳'; cloud.reqBillClip(id, { no: b?.no, pc: b?.pc, day: dayKey(0) }).then(() => notice('🎥 PC ko hukum gaya — clip 1-2 min mein')).catch(e => { notice('Hukum nahi gaya: ' + (e?.message || e)); rq.disabled = false; rq.textContent = '🎥 Mangwao'; }); return; }
  const op = t.closest('[data-bt-open]'); if (op) { const c = clips.get(op.dataset.btOpen); if (!c || c.st !== 'ok') { notice(c?.st === 'err' || c?.st === 'skip' ? '⚠ Is bill ki clip nahi bani: ' + (c.err || '') : '⏳ Clip abhi ban rahi hai'); return; } reopen = op.dataset.btOpen; cur = op.dataset.btOpen; mode = 'view'; sel = new Set(); const dd = $('btDlg'); if (dd) { delete dd.dataset.list; delete dd.dataset.unp; dd.close(); } $('btMain').innerHTML = ''; paint(); return; }
  if (t.closest('[data-bt-gfull]')) { const tile = t.closest('.bt-gt'), v = tile?.querySelector('video'); try { if (document.fullscreenElement) document.exitFullscreen(); else if (v?.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else tile?.requestFullscreen?.(); } catch {} return; }   // v2.337.0: 🚪 godam video
  if (t.tagName === 'VIDEO' && t.classList.contains('bt-gv')) { const tile = t.closest('.bt-gt'), mv = gpMaster(tile)?.querySelector('video') || t; if (mv.paused) mv.play().catch(() => {}); else mv.pause(); if (tile) gpSync(tile); return; }   // v2.338.0: dono camera saath ruk / chal
  if (t.tagName === 'VIDEO' && t.classList.contains('bt-xv')) { const tile = t.closest('.bt-vx'); try { if (document.fullscreenElement) document.exitFullscreen(); else tile?.requestFullscreen?.(); } catch {} return; }   // v2.332.0: doosre camera par tap = us ki poori screen
  if (t.closest('[data-bt-full]')) { const v = $('btVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (($('btStage')?.querySelector('.bt-vx') && $('btStage')) || v.closest('.bt-vwrap') || v).requestFullscreen?.(); } catch {} return; }
  if (t.closest('.bt-vwrap') && t.tagName === 'VIDEO') { const v = t, side = (e.offsetX || 0) < v.offsetWidth / 2 ? -1 : 1;   // v2.224.0: 1 tap = ruk / chal · 2 tap = ±10 s
    if (tapT) { clearTimeout(tapT); tapT = null; seek(side); } else tapT = setTimeout(() => { tapT = null; if (v.paused) v.play().catch(() => {}); else v.pause(); }, 260);
    return; }
  if (t.closest('[data-bt-order]')) { order = order === 'big' ? 'new' : 'big'; try { localStorage.setItem('sam-bt-order', order); } catch {} cur = ''; paint(); return; }
  if (t.closest('[data-bt-undo]')) { if (!lastDone) { notice('Abhi koi pichla nahi'); return; } const tl = tallies.get(lastDone); if (tl && tl.by && tl.by !== uidOf() && !isOwner()) { notice('Ye kisi aur ne tally kiya'); return; } reopen = lastDone; cur = lastDone; mode = 'view'; sel = new Set(); undoUntil = 0; $('btMain').innerHTML = ''; paint(); notice('↩ Bill dobara — ✓ ya ✕ dobara dabayein'); return; }
  if (t.closest('[data-bt-sum]')) { openSum(); return; }
  if (t.closest('[data-bt-xc]')) { openXc(); return; }   // v2.332.0
  if (t.closest('[data-bt-wav]')) { waPref = !isWa(); try { localStorage.setItem('sam-bt-wa', waPref ? '1' : '0'); } catch {} const mn = $('btMain'); if (mn) mn.innerHTML = ''; paint(); notice(waPref ? '🪟 WhatsApp jaisa view' : '🪟 Purana view'); return; }
  if (t.closest('[data-bt-wa]')) { openWa(); return; }
  if (t.closest('[data-bt-wg]')) { openWg(); return; }
  if (t.closest('[data-bt-gn]')) { try { window.ntGinti?.(); } catch (e) { notice('Loading ginti: ' + (e?.message || e)); } return; }   // v2.331.0: 📦 godam camera ki ginti
  if (t.closest('[data-bt-setup]')) { openSetup(); return; }
  if (t.closest('[data-bt-live]')) { window.ntNazarLive?.(); return; }
}

function openCam() { const td = dayKey(0), L = [...new Set([...[...bills.values()].filter(b => b._d === td && b.pc).sort((a, b) => (Number(b.ct || b.pt) || 0) - (Number(a.ct || a.pt) || 0)).map(b => String(b.pc)), ...(Array.isArray(pcSt?.pcs) ? pcSt.pcs.map(String) : []), ...xcN()])];   /* v2.222.0: camera setting ke counter bhi (bina bill ke live) · v2.329.0: 📹 mazeed cameras bhi */ import('./live.js?v=2.400.0').then(m => m.openLive({ cloud, notice, list: L, cur: fPc, xc: xcN(), sab: canK('nz.sab') /* v2.360.0: 🎛 sab cameras ek screen */ })).catch(e => notice('Live nahi khula: ' + (e?.message || e))); }   // v2.373.0: menu card + ⋮ dono se
// ---------- apni khirki (dialog) — phone back = band ----------
const xcN = () => (Array.isArray(pcSt?.cams) ? pcSt.cams : []).filter(c => c && c.n && !c.c).map(c => String(c.n));   // v2.329.0: 📹 mazeed cameras (PC bill-clip v2.10)
function dlg() {
  let d = $('btDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'btDlg'; d.className = 'bt-dlg'; document.body.append(d); d.addEventListener('click', ev => { if (ev.target === d) d.close(); }); }
  return d;
}
window.ntBtClose = () => { const d = $('btDlg'); if (!d?.open) { if (mounted && !home && $('btRoot')) { goHome(); return true; } return false; } try { d.close(); } catch { d.removeAttribute('open'); } return true; };   // v2.373.0: tally se back = menu
window.ntBtWg = () => openWg();   // v2.373.0: 📊 PC ka bojh ke mashwaray se

function openSum() {
  const d = dlg();
  const list = [...tallies.values()].filter(t => dOk(t.day)).sort((a, b) => Number(b.at) - Number(a.at));
  const who = {}, byBoy = {};
  for (const t of list) { who[t.n || '?'] = (who[t.n || '?'] || 0) + 1; if (!t.ok) { const k = t.by2 || t.pc || '?'; byBoy[k] = (byBoy[k] || 0) + 1; } }
  const bad = list.filter(t => !t.ok);
  d.innerHTML = `<div class="bt-dhead"><b>📊 ${dayLbl()} ka hisaab</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody">
      <div class="bt-kpi"><span>✓ <b>${list.length - bad.length}</b></span><span class="bad">✕ <b>${bad.length}</b></span><span>👀 ${Object.entries(who).map(([k, v]) => esc(k) + ' ' + v).join(' · ') || '—'}</span></div>
      ${bad.length ? `<p class="bt-sub">✕ Kis larke ke bill: ${Object.entries(byBoy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<b>${esc(k)}</b> ×${v}`).join(' · ')}</p>
      <div class="bt-badlist">${bad.map(t => `<div class="bt-badrow"><b>#${esc(t.no)}</b><span>${esc(t.pc)}${t.by2 ? ' · 👦 ' + esc(t.by2) : ''} · Rs ${num(t.t)} · ${tm(t.at)}</span><em>${(t.miss || []).map(x => x === '?' ? 'pata nahi kaun si' : x).map(esc).join(', ')}</em><small>👀 ${esc(t.n || '')}</small></div>`).join('')}</div>` : '<p class="bt-sub">Koi ✕ nahi 👍</p>'}
    </div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  if (!d.open) d.showModal();
}

// ---------- 🖥 counter / camera chunna (v2.214.0, malik: "har camera ke lehaz se us ka bill") — phone par yaad (sam-bt-pc) ----------
function openPcPick() {
  const d = dlg(); delete d.dataset.list; delete d.dataset.unp;
  const td = dayKey(0), m = new Map();
  for (const [id, b] of bills) { if (b.x || !dOk(b._d) || !inQ(b)) continue; const k = String(b.pc || ''); if (!k) continue; const o = m.get(k) || { n: 0, q: 0 }; o.n++; const c = clips.get(id); if (!tallies.has(id) && c && c.st === 'ok') o.q++; m.set(k, o); }
  if (fPc && !m.has(fPc)) m.set(fPc, { n: 0, q: 0 });
  const all = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const chip = (k, t, o) => `<button type="button" class="bt-tg${fPc === k ? ' on' : ''}" data-pcv="${esc(k)}">${t}${o ? ` <small>${o.n} bill · baqi ${o.q}</small>` : ''}</button>`;
  d.innerHTML = `<div class="bt-dhead"><b>🖥 Kis counter ke bill?</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><p class="bt-sub">Har counter ka apna camera — jo chunein sirf us ke bill tally mein aayenge (aap ke phone par yaad).</p>
      <div class="bt-row bt-pcs">${chip('', '🖥 Sab counter', null)}${all.map(([k, o]) => chip(k, '🖥 ' + esc(k), o)).join('')}</div></div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelectorAll('[data-pcv]').forEach(b => b.onclick = () => { fPc = b.dataset.pcv || ''; try { localStorage.setItem('sam-bt-pc', fPc); } catch {} reopen = ''; cur = ''; mode = 'view'; sel = new Set(); d.close(); const mn = $('btMain'); if (mn) mn.innerHTML = ''; paint(); notice(fPc ? '🖥 Sirf ' + fPc + ' ke bill' : '🖥 Sab counter ke bill'); });
  if (!d.open) d.showModal();
}

// ---------- 📅 din chunna (v2.224.0, malik: "date wise bhi chahiye — kal ka bill aa raha, mujhe aaj ke chahiye") ----------
function openDayPick() {
  const d = dlg(); delete d.dataset.list; delete d.dataset.unp;
  const n = k => { let q = 0, a = 0; for (const [id, b] of bills) { if (b.x || b._d !== k || Number(b.ps) !== 2 || (fPc && String(b.pc || '') !== fPc)) continue; a++; if (!tallies.has(id) && clips.get(id)?.st === 'ok') q++; } return { a, q }; };
  const t = n(dayKey(0)), k = n(dayKey(1));
  const chip = (v, lb, o) => `<button type="button" class="bt-tg${fDay === v ? ' on' : ''}" data-dayv="${v}">${lb} <small>${o.a} bill · baqi ${o.q}</small></button>`;
  d.innerHTML = `<div class="bt-dhead"><b>📅 Kis din ke bill?</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><div class="bt-row bt-pcs">${chip('aaj', '📅 Aaj', t)}${chip('kal', '📅 Kal', k)}${chip('dono', '📅 Aaj + Kal', { a: t.a + k.a, q: t.q + k.q })}</div>
      <p class="bt-sub">Video 2 din tak rehti hai — is liye sirf aaj aur kal. Agle din khud "Aaj" par aa jata hai.</p></div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelectorAll('[data-dayv]').forEach(b => b.onclick = () => { d.close(); setDay(b.dataset.dayv); notice('📅 ' + dayLbl() + ' ke bill'); });
  if (!d.open) d.showModal();
}

// ---------- 📋 bills ki list (v2.211.0, malik: "bill ki list aaye, jis ko chahein khol kar tally karein") ----------
let listQ = '';
// ⏱ v2.336.0: har bill ki video kitni der mein bani (malik: 'time calculate kar ke dekho fi video kitna time laga')
// bill chhapne (ct, warna post pt) se video tayyar (PC bill-clip v2.17 `rd`; purani clip par sirf `at` = PC ne shuru ki = ≈) · ⚡ apni recording / 🐢 NVR se.
const dur2 = ms => { const x = Math.max(0, Math.round(ms / 1000)); return x < 60 ? x + ' s' : x < 3600 ? Math.round(x / 60) + ' min' : Math.floor(x / 3600) + 'h ' + Math.round((x % 3600) / 60) + 'm'; };
function rfOf(b, c) { if (!b || !c || c.st !== 'ok') return null; const bt = Number(b.ct || b.pt) || 0, rd = Number(c.rd) || 0, at = Number(c.at) || 0, end = rd || at; if (!bt || !end || end < bt) return null; return { ms: end - bt, mk: rd && at ? rd - at : 0, nvr: c.src === 'nvr', est: !rd }; }
const rfHTML = r => r ? `<i class="bt-rf ${r.ms <= 120000 ? 'g' : r.ms <= 900000 ? 'w' : 'r'}" title="Bill ke baad video tayyar${r.mk ? ' · PC ne ' + dur2(r.mk) + ' mein banai' : ''}${r.nvr ? ' · NVR se (dheemi)' : ' · apni recording se'}">${r.nvr ? '🐢' : '⚡'} ${r.est ? '≈' : ''}${dur2(r.ms)}</i>` : '';
function rfSum(list) {
  const L = list.map(b => rfOf(b, clips.get(String(b.id)))).filter(Boolean); if (!L.length) return '';
  const av = a => a.reduce((x, y) => x + y.ms, 0) / a.length, f = L.filter(r => !r.nvr), w = L.filter(r => r.nvr), mx = L.reduce((m, r) => r.ms > m ? r.ms : m, 0);
  return `⏱ ${L.length} video · average <b>${dur2(av(L))}</b>${f.length ? ` · ⚡ apni recording ${f.length} (${dur2(av(f))})` : ''}${w.length ? ` · 🐢 NVR ${w.length} (${dur2(av(w))})` : ''} · sab se der ${dur2(mx)}${L.some(r => r.est) ? ' · ≈ = purani clip (andaza)' : ''}`;
}
function openList(refresh) {
  const d = dlg(); d.dataset.list = '1'; delete d.dataset.unp;
  const td = dayKey(0), q = listQ.trim().toLowerCase();
  const all = [...bills.values()].filter(b => !b.x && dOk(b._d) && inQ(b) && (!fPc || String(b.pc || '') === fPc)).sort((a, b) => Number(b.ct || b.pt) - Number(a.ct || a.pt));
  const list = q ? all.filter(b => String(b.no || '').toLowerCase().includes(q) || String(b.by || '').toLowerCase().includes(q) || String(b.pc || '').toLowerCase().includes(q) || String(b.p || '').toLowerCase().includes(q)) : all;
  const gpS = new Set([...clips.values()].filter(c => c && c.gp && c.st !== 'skip').map(c => String(c.sid)));   // v2.337.0: 🚪 gate pass wale bill
  const row = b => { const id = String(b.id), c = clips.get(id), tl = tallies.get(id);
    const st = tl ? `<em class="${tl.ok ? 'ok' : 'bad'}">${tl.ok ? '✓ theek' : '✕ kam'}</em>` : c?.st === 'ok' ? '<em class="go">▶ Dekho</em>' : c?.st === 'err' || c?.st === 'skip' ? `<em class="bad" title="${esc(c.err || '')}">⚠ nahi bani</em>` : '<em>⏳ clip…</em>';
    return `<div class="bt-badrow bt-lrow${id === cur ? ' cur' : ''}" data-bt-open="${esc(id)}"><b>#${esc(b.no)}${gpS.has(id) ? ' <i class="bt-gpi" title="Gate pass — godam ki video bhi">🚪</i>' : ''}</b><span>${tm(b.ct || b.pt)} · ${esc(b.pc || '?')}${b.by ? ' · 👦 ' + esc(b.by) : ''} · Rs ${num(b.t)}${b.p ? ' · ' + esc(b.p) : ''}</span>${st}${rfHTML(rfOf(b, c))}</div>`; };
  const body = `<div class="bt-badlist">${list.map(row).join('') || '<p class="bt-sub">Koi bill nahi</p>'}</div>`;
  if (refresh && d.querySelector('.bt-badlist')) { d.querySelector('.bt-badlist').outerHTML = body; d.querySelector('[data-cnt]').textContent = list.length; const rs = d.querySelector('[data-rfs]'); if (rs) rs.innerHTML = rfSum(list); return; }
  d.innerHTML = `<div class="bt-dhead"><b>📋 ${dayLbl()} ke bill${fPc ? ' · 🖥 ' + esc(fPc) : ''} <small data-cnt>${list.length}</small></b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><input type="search" class="bt-srch" placeholder="🔍 bill number · larka · counter" value="${esc(listQ)}" autocomplete="off"><p class="bt-rfs" data-rfs>${rfSum(list)}</p>${body}</div>`;
  d.querySelector('[data-x]').onclick = () => { delete d.dataset.list; d.close(); };
  d.querySelector('.bt-srch').oninput = ev => { listQ = ev.target.value; openList(true); };
  if (!d.open) d.showModal();
}

// ---------- 📲 v2.322.0: bill ki video WhatsApp par (malik: "bill number likhein to us ki video hamare aur Mubeen ke WhatsApp par full speed se — customer ko wait na karna pare") ----------
// billClipWa hukum → PC (bill-clip v2.8) bani clip / apni recording se video → wa-out malik + Mubeen. Yahan sirf likhna + haal (⏳ / ✅ / ✕).
let waQ = '', waList = new Map(), waOff = null;
const waSt = r => { const s = r.s || {}, ks = Object.keys(s), okN = ks.filter(k => s[k] === 'ok');
  if (r.st === 'err') return { k: 'bad', t: '✕ ' + (r.err || 'nahi gayi') };
  if (r.st === 'q') { if (ks.length && okN.length === (r.to || ks).length) return { k: 'ok', t: '✅ ' + okN.join(' + ') + ' ko gayi' }; const bad = ks.filter(k => s[k] !== 'ok'); if (bad.length) return { k: 'bad', t: bad.map(k => k + ' ' + s[k]).join(' · ') + (okN.length ? ' · ✅ ' + okN.join(' + ') : '') }; return { k: 'run', t: (okN.length ? '✅ ' + okN.join(' + ') + ' · ' : '') + '📲 WhatsApp par ja rahi…' }; }
  if (r.st === 'run') return { k: 'run', t: r.m || '⏳ PC bana raha…' };
  return { k: 'run', t: Date.now() - (Number(r.at) || 0) > 60000 ? '⏳ PC ne abhi nahi uthaya (band / update?)' : '⏳ PC ko gaya…' }; };
function waPaint() {
  const d = $('btDlg'); if (!d?.open || !d.dataset.wa) return;
  const q = waQ.replace(/\D/g, ''), nn = Number(q) || 0;
  const hits = q.length >= 2 ? [...bills.values()].filter(b => inQ(b) && String(b.no || '').replace(/\D/g, '').replace(/^0+/, '').startsWith(q.replace(/^0+/, ''))).sort((a, b) => wq(b) - wq(a)).slice(0, 6) : [];
  const hEl = d.querySelector('[data-wa-hits]'); if (hEl) hEl.innerHTML = hits.map(b => `<div class="bt-badrow bt-lrow" data-wa-go="${esc(b.id)}"><b>#${esc(b.no)}</b><span>${b._d !== dayKey(0) ? 'kal · ' : ''}${tm(b.ct || b.pt)} · ${esc(b.pc || '?')} · Rs ${num(b.t)}${b.by ? ' · 👦 ' + esc(b.by) : ''}</span><em class="go">📲 Bhejo</em></div>`).join('') || (q.length >= 3 && !hits.length ? '<p class="bt-sub">Aaj / kal ke bills mein nahi — 📲 dabayein to PC parson tak dhoondega</p>' : '');
  const L = [...waList.values()].sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(0, 12);
  const lEl = d.querySelector('[data-wa-list]'); if (lEl) lEl.innerHTML = L.length ? '<div class="bt-sub">Aaj bheji videos</div>' + L.map(r => { const s = waSt(r); return `<div class="bt-warow ${s.k}"><b>${r.kind === 'live' ? (r.cam === '*' ? '📸 Sab' : '📹 ' + esc(r.cam || '?')) + (r.sec ? ' · ' + (r.sec >= 60 ? Math.round(r.sec / 60) + ' min' : r.sec + ' s') : ' · 📸') : '#' + esc(r.no || r.sid || '?')}</b><span>${tm(r.at)}${r.pc ? ' · ' + esc(r.pc) : ''}${r.src === 'wa' ? ' · 📲 WhatsApp se' : ''}</span><em>${esc(s.t)}</em></div>`; }).join('') : '';
  const btn = d.querySelector('[data-wa-send]'); if (btn) btn.disabled = !nn;
}
async function waSend(b, no) {
  const n = String(b?.no || no || '').replace(/\D/g, ''); if (!n) { notice('Bill number likhein'); return; }
  try { const id = await cloud.reqBillWa({ no: n, sid: b ? String(b.id) : '', pc: b?.pc || '', day: dayKey(0) }); waList.set(id, { id, st: 'new', at: Date.now(), no: n, pc: b?.pc || '' }); waQ = ''; const i = $('btDlg')?.querySelector('[data-wa-in]'); if (i) { i.value = ''; i.focus(); } waPaint(); notice('📲 PC ko gaya — video malik + Mubeen ko (10-30 s)'); }
  catch (e) { notice('Nahi gaya: ' + (e?.code === 'permission-denied' ? 'rules abhi nahi lagi / ijazat nahi (PC 5 min mein rules lagata hai)' : (e?.message || e))); }
}
function openWa() {
  if (!cloud?.reqBillWa) { notice('App update karein'); return; }
  const d = dlg(); d.dataset.wa = '1'; delete d.dataset.list; delete d.dataset.unp;
  const b0 = cur ? bills.get(cur) : null; waQ = b0 ? String(b0.no || '').replace(/\D/g, '') : '';
  d.innerHTML = `<div class="bt-dhead"><b>📲 Bill ki video WhatsApp par</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><div class="bt-warow0"><input type="text" inputmode="numeric" class="bt-srch" data-wa-in placeholder="🔢 Bill number (jaise 138841)" value="${esc(waQ)}" autocomplete="off"><button type="button" class="bt-sm bt-wago" data-wa-send="1">📲 Bhejo</button></div>
      <p class="bt-sub">Video aap + Mubeen ke WhatsApp par (Business number se). PC bani hui clip ya apni recording se foran banata hai — NVR se nahi. 2 din se purane bill ki nahi milti.</p>
      <div class="bt-badlist" data-wa-hits></div><div class="bt-walist" data-wa-list></div></div>`;
  d.querySelector('[data-x]').onclick = () => { delete d.dataset.wa; d.close(); };
  const inp = d.querySelector('[data-wa-in]');
  inp.oninput = ev => { waQ = ev.target.value; waPaint(); };
  inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); const q = waQ.replace(/\D/g, ''); const ex = [...bills.values()].find(b => Number(String(b.no || '').replace(/\D/g, '')) === Number(q)); waSend(ex || null, q); } };
  d.querySelector('[data-wa-send]').onclick = () => { const q = waQ.replace(/\D/g, ''); const ex = [...bills.values()].find(b => Number(String(b.no || '').replace(/\D/g, '')) === Number(q)); waSend(ex || null, q); };
  d.querySelector('[data-wa-hits]').onclick = ev => { const g = ev.target.closest('[data-wa-go]'); if (g) waSend(bills.get(g.dataset.waGo) || null, ''); };
  if (!waOff && cloud.listenBillWa) { waOff = cloud.listenBillWa(dayKey(0), l => { if (!l) return; waList = new Map(l.map(r => [String(r.id), r])); waPaint(); }); offs.push(() => { try { waOff && waOff(); } catch {} waOff = null; }); }
  if (!d.open) d.showModal();
  waPaint(); setTimeout(() => { try { inp.focus(); inp.select(); } catch {} }, 60);
}

// ---------- 👥 v2.328.0: HAR bill ki video WhatsApp GROUP mein (malik 19 Nov: 'din mein jitni videos banein SAB · counter-wise · transparent patti, blur nahi') ----------
// blueAccess/billWaGroup {on, g: {counter: jid}, gd (baqi sab), gn: {jid: naam}, lim, end} — SIRF malik. PC bill-clip v2.9 har kamyab clip patti ke saath bana kar
// wa-out v1.28 se group mein. Groups ki list = blueAccess/waOutGroups (wa-out, Business number jin groups mein hai). Yahan sirf setting + haal.
let wgGr = null, wgOff = null, wgCf = null, sbCf = null, sbPc = null, sbOff = null, wlk = null, wlkOff = null;   // v2.372.0: wlk = waLinkOut (Business number + video ki line: vq / vl, PC wa-out v1.35)   // v2.367.0: 📼 sb = Sab cameras ki recording (blueAccess/sabRec · haal liveCamPc.sr)
const wgRows = () => { try { const a = JSON.parse(wgGr?.j || '[]'); return Array.isArray(a) ? a.filter(r => Array.isArray(r) && /@g\.us$/.test(String(r[0] || ''))) : []; } catch { return []; } };
const phP = p => /^03\d{9}$/.test(String(p || '')) ? String(p).slice(0, 4) + '-' + String(p).slice(4) : String(p || '');
const bizNo = () => String(wgGr?.me || wlk?.me || '');
const verLt = (v, a, b) => { const [x, y] = String(v || '').split('.').map(Number); return !(x > a || (x === a && y >= b)); };
function wgPcs() {
  const td = dayKey(0), s = new Set();
  for (const k of (Array.isArray(pcSt?.pcs) ? pcSt.pcs : [])) if (k) s.add(String(k));
  for (const b of bills.values()) if (b._d === td && b.pc) s.add(String(b.pc));
  for (const k of Object.keys(wgCf?.g || {})) s.add(k);
  return [...s].sort();
}
function wgOpts(sel, none) {
  const R = wgRows(), gn = wgCf?.gn || {};
  let h = `<option value="">${esc(none)}</option>` + R.map(r => `<option value="${esc(r[0])}"${r[0] === sel ? ' selected' : ''}>${esc(r[1] || r[0])} · ${Number(r[2]) || 0} log${r[3] ? ' · 🔒 sirf admin' : ''}</option>`).join('');
  if (sel && !R.some(r => r[0] === sel)) h += `<option value="${esc(sel)}" selected>${esc(gn[sel] || (sbCf?.g === sel && sbCf.gn) || sel)} (list mein nahi)</option>`;
  return h;
}
function wgPaintSt() {
  const d = $('btDlg'), el = d?.open && d.querySelector('[data-wg-st]'); if (!el) return;
  const w = pcSt?.wg, v = String(pcSt?.ver || '');
  el.textContent = !pcSt ? '' : Date.now() - (Number(pcSt.at) || 0) > 5 * 60000 ? '🖥 PC chup (' + ago(pcSt.at) + ')'
    : v && verLt(v, 2, 9) ? `⏳ PC ka bill-clip purana (v${v}) — 3-5 min mein khud update`
    : !w ? (wgCf?.on ? '⏳ abhi koi video nahi gayi' : '')
    : `${w.err ? '⚠ ' + w.err + ' · ' : ''}aaj ${w.n || 0} gayi${w.last ? ' · aakhri ' + w.last + (w.at ? ' (' + ago(w.at) + ')' : '') : ''}`;
  const g = d.querySelector('[data-wg-gs]'); if (g) { const n = wgRows().length;
    const bz = bizNo() ? `📲 Business number ${phP(bizNo())} — group mein YEHI number add karein (doosra number nahi chalega). ` : '';
    g.textContent = bz + (!wgGr ? '⏳ Groups ki list abhi PC se nahi aayi — 🔄 dabayein (Business number juda ho)' : wgGr.err ? '⚠ list: ' + wgGr.err : `${n} group mile · ${ago(wgGr.at)} pehle${n ? '' : ' — Business number ko group mein add karein, phir 🔄'} · naya group 15 min mein khud aa jata hai`); }
}
function wgPaintOpts() {   // list badli — chuna hua wahi rahe
  const d = $('btDlg'); if (!d?.open || !d.dataset.wg) return;
  d.querySelectorAll('select[data-wg-gd],select[data-wg-pc]').forEach(s => { const v = s.value; s.innerHTML = wgOpts(v, s.dataset.wgGd ? '— koi nahi —' : '— upar wala (sab ka) —'); });
  d.querySelectorAll('select[data-sb-g]').forEach(s => { const v = s.value; s.innerHTML = wgOpts(v, '— group chunein —'); });
  wgPaintSt(); sbPaintSt();
}
async function wgSave(btn, onNow) {
  const d = $('btDlg'); if (!d?.open) return;
  const gd = d.querySelector('[data-wg-gd]').value, g = {}, gn = {}, R = wgRows();
  d.querySelectorAll('select[data-wg-pc]').forEach(s => { if (s.value) g[s.dataset.wgPc] = s.value; });
  const on = onNow === undefined ? !!wgCf?.on : onNow;
  if (on && !gd && !Object.keys(g).length) { notice('Pehle group chunein'); return false; }
  for (const j of [gd, ...Object.values(g)]) if (j) { const r = R.find(x => x[0] === j); gn[j] = String((r && r[1]) || (wgCf?.gn || {})[j] || '').slice(0, 40); }
  const lim = Math.max(1, Math.min(2000, Number(d.querySelector('[data-wg-lim]').value) || 400)), end = /^\d{1,2}:\d{2}$/.test(d.querySelector('[data-wg-end]').value) ? d.querySelector('[data-wg-end]').value : '22:00';
  const nx = { on, g, gd, gn, lim, end }, old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try { await cloud.setBillWaGroup(nx); wgCf = nx; if (btn) btn.textContent = '✅'; notice(on ? '👥 Chalu — har nayi video group mein' : 'Group videos band'); return true; }
  catch (e) { if (btn) btn.textContent = '✕'; notice('Save nahi hua: ' + (e?.message || e)); return false; }
  finally { if (btn) setTimeout(() => { btn.disabled = false; btn.textContent = old; }, 1400); wgPaintSt(); }
}
// v2.367.0: 📼 SAB CAMERAS ki ek-screen recording -> group (malik 23 Nov: 'recording ko PC mein save karne ki zaroorat nahi — sab cameras ki live screen record ho · group mein lagatar')
const sbHm = v => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : '';
function sbPaintSt() {
  const d = $('btDlg'), el = d?.open && d.querySelector('[data-sb-stt]'); if (!el) return;
  const p = sbPc, r = p?.sr, v = String(p?.ver || '');
  el.textContent = !p ? '⏳ PC ka haal abhi nahi aaya' : Date.now() - (Number(p.at) || 0) > 5 * 60000 ? '🖥 PC chup (' + ago(p.at) + ') — PC on hote hi khud'
    : v && verLt(v, 2, 3) ? `⏳ PC ka live-cam purana (v${v}) — 3-5 min mein khud update`
    : !r || !r.on ? 'PC: recording band'
    : r.f ? `${r.rec ? '🎞 PC ki recording se ban rahi (' + (r.lg || '2-7') + ' min peeche)' + (r.n ? ' — ' + r.n + ' camera' : '') + (r.job ? ' · abhi ' + r.job + ' wali ban rahi' : '') + (r.mk ? ' · ' + r.mk + ' s fi video' : '') + (r.bn ? ' · 🧾 ' + r.bn + ' bill ke naam' : r.bw ? ' · 🧾 ' + r.bw : '') : '⚪ abhi nahi ban rahi'}${r.err ? ' · ⚠ ' + r.err : ''}${r.g ? '' : ' · group nahi chuna'}${r.sent ? ' · aaj ' + r.sent + ' gayi' : ''}${r.last ? ' · aakhri ' + r.last : ''}`   // v2.377.0: PC live-cam v2.7 — live line se nahi, recording files se
    : `${r.rec ? '🔴 record ho rahi — ' + (r.n || 0) + ' camera' : '⚪ abhi record nahi ho rahi'}${r.err ? ' · ⚠ ' + r.err : ''}${r.g ? '' : ' · group nahi chuna'}${r.sent ? ' · aaj ' + r.sent + ' gayi' : ''}${r.last ? ' · aakhri ' + r.last : ''}`;
  // v2.372.0: WhatsApp ki video line (PC wa-out v1.35) — video ruki to yahan wajah (internet dheema / line mein kitni)
  const w = wlk, vl = w?.vl, vq = Number(w?.vq) || 0;
  if (w && (vl || vq)) el.textContent += `\n📲 WhatsApp: ${vq ? vq + ' video line mein' : 'line khali'}${vl ? ' · aakhri video ' + (Math.round((Number(vl.kb) || 0) / 102.4) / 10) + ' MB ' + (vl.ok ? '✓ ' + (Number(vl.s) || 0) + ' s mein' + (vl.late ? ' (der se)' : '') : '✕ ' + String(vl.why || '')) + ' (' + ago(vl.at) + ')' : ''}`;
}
async function sbSave(btn, onNow) {
  const d = $('btDlg'); if (!d?.open) return false;
  const g = d.querySelector('[data-sb-g]').value, R = wgRows(), on = onNow === undefined ? !!sbCf?.on : onNow;
  if (on && !g) { notice('Pehle group chunein'); return false; }
  const row = R.find(x => x[0] === g), gn = String((row && row[1]) || (sbCf?.g === g && sbCf?.gn) || '').slice(0, 40);
  const nx = { on, g, gn, kd: Math.max(1, Math.min(30, Number(d.querySelector('[data-sb-kd]').value) || 2)), st: sbHm(d.querySelector('[data-sb-st]').value) || '08:00', end: sbHm(d.querySelector('[data-sb-end]').value) || '22:00' };
  if (on && !sbCf?.on && !confirm('📼 Sab cameras ki ek video lagatar record ho kar is group mein jayegi (har 5 min ek video).\n\nSaath har camera ki ALAG recording PC par sirf 3 ghante rakhi jayegi — purani (10 din wali) alag recording MIT jayegi, wapas nahi aati.\n\nOK?')) return false;
  const old = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    await cloud.setSabRec(nx);
    if (on && !sbCf?.on && cloud.setBillClipPart) await cloud.setBillClipPart({ rkd: 0.125 });   // har camera ki alag recording 3 ghante (bill / gate pass video ke liye kaafi)
    sbCf = nx; if (btn) btn.textContent = '✅'; notice(on ? '📼 Chalu — sab cameras ki recording group mein' : 'Sab cameras ki recording band'); return true;
  } catch (e) { if (btn) btn.textContent = '✕'; notice('Save nahi hua: ' + (e?.message || e)); return false; }
  finally { if (btn) setTimeout(() => { btn.disabled = false; btn.textContent = old; }, 1400); sbPaintSt(); }
}
function sbHTML() {
  const c = sbCf || {}, on = !!c.on, kd = Number(c.kd) || 2;
  return `<div class="bt-sbbox"><div class="bt-wgtop"><button type="button" class="bt-sm bt-wgon${on ? ' is-in' : ''}" data-sb-on="1">${on ? '🟢 CHALU' : '⚪ BAND'}</button><b class="bt-sbh">📼 Sab cameras ki recording</b></div>
      <select data-sb-g="1">${wgOpts(String(c.g || ''), '— group chunein —')}</select>
      <div class="bt-wgrow"><b>📅 PC par rakho</b><select data-sb-kd>${[1, 2, 3, 7].map(n => `<option value="${n}"${n === kd ? ' selected' : ''}>${n} din</option>`).join('')}</select></div>
      <div class="bt-wgrow"><b>🌅 Shuru</b><input type="time" data-sb-st value="${esc(sbHm(c.st) || '08:00')}"></div>
      <div class="bt-wgrow"><b>🌙 Band</b><input type="time" data-sb-end value="${esc(sbHm(c.end) || '22:00')}"></div>
      <div class="bt-warow0"><button type="button" class="bt-sm bt-wago" data-sb-save="1">💾 Save</button></div>
      <p class="bt-sub" data-sb-stt></p>
      <p class="bt-sub">🎛 Sab cameras EK video (har 5 min) khud is group mein — roz taqreeban 140. PC apni saaf recording se banata hai (2-7 min peeche, grey nahi). Har camera ki alag recording sirf 3 ghante rehti hai (bill / gate pass ki video usi se banti hai). Khane chhote hain: 'kya ho raha tha' dikhta hai, chehra / item saaf nahi.</p></div>`;
}
async function openWg() {
  if (!isOwner() || !cloud?.setBillWaGroup) { notice(isOwner() ? 'App update karein' : 'Sirf malik'); return; }
  const d = dlg(); d.dataset.wg = '1'; delete d.dataset.wa; delete d.dataset.list; delete d.dataset.unp;
  d.innerHTML = '<div class="bt-dbody">⏳</div>'; if (!d.open) d.showModal();
  try { wgCf = await cloud.getBillWaGroup(); } catch { wgCf = wgCf || {}; }
  try { if (cloud.getSabRec) sbCf = await cloud.getSabRec(); } catch { sbCf = sbCf || {}; }
  if (!d.open || !d.dataset.wg) return;   // beech mein band
  const on = !!wgCf.on, g = wgCf.g || {}, lim = Number(wgCf.lim) || 400, end = /^\d{1,2}:\d{2}$/.test(String(wgCf.end || '')) ? wgCf.end : '22:00';
  d.innerHTML = `<div class="bt-dhead"><b>👥 Har bill ki video — group</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><div class="bt-wgtop"><button type="button" class="bt-sm bt-wgon${on ? ' is-in' : ''}" data-wg-on="1">${on ? '🟢 CHALU' : '⚪ BAND'}</button><span class="bt-sub" data-wg-st></span></div>
      <label class="bt-wgl">🖥 Sab counters ka group</label><select data-wg-gd="1">${wgOpts(String(wgCf.gd || ''), '— koi nahi —')}</select>
      <div class="bt-sub">Kisi counter ka ALAG group (khali = upar wala):</div>
      ${wgPcs().map(pc => `<div class="bt-wgrow"><b>🖥 ${esc(pc)}</b><select data-wg-pc="${esc(pc)}">${wgOpts(String(g[pc] || ''), '— upar wala (sab ka) —')}</select></div>`).join('') || '<p class="bt-sub">Counter abhi nahi mile (camera setup ke baad aate hain)</p>'}
      <div class="bt-wgrow"><b>📊 Din ki hadd</b><input type="number" inputmode="numeric" min="1" max="2000" data-wg-lim value="${lim}"></div>
      <div class="bt-wgrow"><b>🌙 Raat band</b><input type="time" data-wg-end value="${esc(end)}"></div>
      <div class="bt-warow0"><button type="button" class="bt-sm" data-wg-ref="1">🔄 Groups ki list</button><button type="button" class="bt-sm bt-wago" data-wg-save="1">💾 Save</button></div>
      <p class="bt-sub" data-wg-gs></p>
      <p class="bt-sub">Video ke upar transparent patti (sirf kinara, peeche video saaf): bill #, Rs, items × tadad. Business number (gahak wala WhatsApp) ko group mein add karein. Har video ke beech 20 s · raat ke waqt / din ki hadd ke baad nahi.</p>
      ${cloud.setSabRec ? sbHTML() : ''}</div>`;
  d.querySelector('[data-x]').onclick = () => { delete d.dataset.wg; d.close(); };
  d.querySelector('[data-wg-save]').onclick = ev => wgSave(ev.currentTarget);
  d.querySelector('[data-wg-on]').onclick = async ev => { const b = ev.currentTarget, nv = !wgCf?.on; b.classList.toggle('is-in', nv); b.textContent = nv ? '🟢 CHALU' : '⚪ BAND';
    if (!(await wgSave(null, nv))) { b.classList.toggle('is-in', !nv); b.textContent = !nv ? '🟢 CHALU' : '⚪ BAND'; } };
  d.querySelector('[data-wg-ref]').onclick = async ev => { const b = ev.currentTarget; b.disabled = true; b.textContent = '⏳';
    try { await cloud.reqWaOutGroups(); b.textContent = '✅'; } catch (e) { b.textContent = '✕'; notice('Nahi hua: ' + (e?.message || e)); } setTimeout(() => { b.disabled = false; b.textContent = '🔄 Groups ki list'; }, 2500); };
  { const sv = d.querySelector('[data-sb-save]'), so = d.querySelector('[data-sb-on]');   // v2.367.0: 📼
    if (sv) sv.onclick = ev => sbSave(ev.currentTarget);
    if (so) so.onclick = async ev => { const b = ev.currentTarget, nv = !sbCf?.on; if (await sbSave(null, nv)) { b.classList.toggle('is-in', nv); b.textContent = nv ? '🟢 CHALU' : '⚪ BAND'; } };
    if (!wlkOff && cloud.listenWaLinkOut) { wlkOff = cloud.listenWaLinkOut(x => { wlk = x || null; sbPaintSt(); wgPaintSt(); }); offs.push(() => { try { wlkOff && wlkOff(); } catch {} wlkOff = null; }); }
    if (!sbOff && cloud.listenLiveCamPc) { sbOff = cloud.listenLiveCamPc(x => { sbPc = x; sbPaintSt(); }); offs.push(() => { try { sbOff && sbOff(); } catch {} sbOff = null; }); } }
  if (!wgOff && cloud.listenWaOutGroups) { wgOff = cloud.listenWaOutGroups(s => { wgGr = s; wgPaintOpts(); }); offs.push(() => { try { wgOff && wgOff(); } catch {} wgOff = null; }); }
  wgPaintOpts();
}

// ---------- 🔵 un-posted bills (v2.210.0) — clip sirf hukum par ----------
function openUnposted() {
  const d = dlg(); d.dataset.unp = '1'; delete d.dataset.list;
  const td = dayKey(0), list = [...bills.values()].filter(b => !b.x && b._d === td && Number(b.ps) !== 2).sort((a, b) => Number(b.ct || b.tm) - Number(a.ct || a.tm));
  const row = b => { const id = String(b.id), c = clips.get(id), r = reqs.get(id), tl = tallies.get(id);
    const st = c?.st === 'ok' ? (tl ? `<em>${tl.ok ? '✓ theek' : '✕ kam'}</em>` : `<button type="button" class="bt-sm" data-bt-open="${esc(id)}">▶ Dekho</button>`) : c?.st === 'err' ? `<em class="bad">✕ ${esc(c.err || 'nahi bani')}</em>` : r ? (r.st === 'err' ? `<em class="bad">✕ ${esc(r.err || '')}</em>` : '<em>⏳ PC bana raha…</em>') : `<button type="button" class="bt-sm" data-bt-rq="${esc(id)}">🎥 Mangwao</button>`;
    return `<div class="bt-badrow"><b>#${esc(b.no)}</b><span>${tm(b.ct || b.tm)} · ${esc(b.pc || '?')}${b.by ? ' · 👦 ' + esc(b.by) : ''} · Rs ${num(b.t)}${b.p ? ' · ' + esc(b.p) : ''}</span>${st}</div>`; };
  d.innerHTML = `<div class="bt-dhead"><b>🔵 Aaj ke un-posted bill <small>${list.length}</small></b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><p class="bt-sub">In ki clip PC khud nahi banata — jis bill ki chahiye us par 🎥 Mangwao (1-2 min). Clip aate hi ▶ Dekho / tally mein khud aa jayega.</p>
      <div class="bt-badlist">${list.map(row).join('') || '<p class="bt-sub">Aaj koi un-posted bill nahi</p>'}</div></div>`;
  d.querySelector('[data-x]').onclick = () => { delete d.dataset.unp; d.close(); };
  if (!d.open) d.showModal();
}

// v2.337.0: 🚪 har godam ka camera — PC (bill-clip v2.18) jo faisla kar raha (gpm) + malik ka chunao (gc [{g, c, i}], '-' = koi nahi)
// v2.338.0: har godam par 2 camera (i 1 | 2) — PC bill-clip v2.19 gpm cam2 / how2 / r2
function gpRows(cf, st) {
  const gm = Array.isArray(st.gpm) ? st.gpm : [], cams = (Array.isArray(st.cams) ? st.cams : []).filter(c => c && c.n), set = {};
  for (const x of (Array.isArray(cf.gc) ? cf.gc : [])) if (x && x.g) { const k = String(x.g); set[k] = set[k] || ['', '']; set[k][Number(x.i) === 2 ? 1 : 0] = String(x.c || ''); }
  if (!gm.length) return `<p class="bt-sub">${st.ver && verLt(st.ver, 2, 18) ? `⏳ PC ka bill-clip purana (v${esc(st.ver)}) — 3-5 min mein khud update, phir godam yahan aayenge` : '⏳ Godam ki list PC se abhi nahi aayi (pehle gate pass ke baad khud aati hai)'}</p>`;
  const how = { set: 'aap ka chuna', naam: 'naam se', ginti: '📦 Loading ginti se', off: 'band', gum: 'chuna camera list mein nahi' };
  const rs = (cam, r, h, w) => cam ? (r === 2 ? '⏺ 🟢 recording chal rahi' : r === 1 ? '⏺ ⚫ recording ruki' : '⏹ recording BAND — upar ⏺ Rec ON karein') + ' · ' + (how[h] || '') : h === 'off' ? 'band' : h === 'gum' ? `✕ "${w}" camera list mein nahi` : '';
  const sel = (g, i, v, cam, h) => `<select data-gc="${esc(g)}" data-gi="${i}"><option value="">${esc((h === 'naam' || h === 'ginti') && cam ? `Auto: ${cam} (${how[h]})` : i === 1 ? 'Auto (naam se dhoondo)' : 'Auto (doosra camera naam se)')}</option>${cams.map(c => `<option value="${esc(c.n)}"${v === c.n ? ' selected' : ''}>${c.c ? '🖥' : '📹'} ${esc(c.n)}${c.r ? '' : ' (⏹ recording band)'}</option>`).join('')}${v && v !== '-' && !cams.some(c => c.n === v) ? `<option value="${esc(v)}" selected>${esc(v)} (list mein nahi)</option>` : ''}<option value="-"${v === '-' ? ' selected' : ''}>✕ Koi nahi</option></select>`;
  return gm.map(g => { const v = set[String(g.g)] || ['', ''], s1 = rs(g.cam, g.r, g.how, g.want), s2 = rs(g.cam2, g.r2, g.how2, g.want2), none = !g.cam && !g.cam2 && g.how !== 'off';
    return `<div class="bt-wgrow"><b>🏬 ${esc(g.n)} · 📹 1</b>${sel(g.g, 1, v[0], g.cam, g.how)}</div><div class="bt-wgrow"><b>📹 2</b>${sel(g.g, 2, v[1], g.cam2, g.how2)}</div><p class="bt-sub bt-gpst${(g.cam && g.r === 2) || (g.cam2 && g.r2 === 2) ? '' : ' bad'}">${none ? '✕ camera nahi mila — chunein ya camera ke naam mein godam ka naam likhein' : esc([s1 && '1: ' + s1, s2 && '2: ' + s2].filter(Boolean).join(' · '))}</p>`; }).join('') + (st.gp && st.gp.day === dayKey(0) ? `<p class="bt-sub">🚪 Aaj: ✓ ${Number(st.gp.ok) || 0} video${st.gp.w ? ' · ⏳ ' + st.gp.w + ' intezar mein' : ''}${st.gp.err ? ' · ✕ ' + st.gp.err : ''}${st.gp.le ? ' (' + esc(st.gp.le) + ')' : ''}</p>` : '');
}

async function openSetup() {
  if (!isOwner()) return;
  const d = dlg(); delete d.dataset.unp; delete d.dataset.list; d.innerHTML = '<div class="bt-dbody">⏳</div>'; if (!d.open) d.showModal();
  // v2.316.0: sab TAZA server se (purani yaad nahi — malik: list purani dikhti thi)
  let cf = {}; try { cf = await cloud.getBillClipCfg(); } catch (e) { cf = {}; }
  // v2.302.0 / v2.316.0: counter ka naam = PC ka APNA naam (NT-PRINT se) — malik 17 Nov: "Abdurehman ki bajaye PC ka naam". Qaida PC pc-names v1.1 disp() HUBAHU:
  //   NT-PRINT setting ka naam host se alag ho to wohi, warna host (DESKTOP- hata kar). LEG = purane insaanon wale naam — sirf purana channel dhoondne ke liye.
  //   🔗 POS par PC ka naam NT-PRINT se alag ho (ek PC do dafa) = ⚪ qatar par "Yeh kaun sa PC?" → blueAccess/pcAlias (PC scripts bhi wahi naam).
  const LEG = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-RN6QU6D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };   // v2.370.0: KEIME1D hata, us ka camera RN6QU6D ka (malik 24 Nov)
  const bareH = h => String(h || '').trim().replace(/^DESKTOP-/i, ''), disp = x => { const h = String(x.host || '').toUpperCase().trim(), n = String(x.name || '').trim().slice(0, 40); return n && n.toUpperCase() !== h ? n : bareH(h); };
  let nts = [], al = {};
  try { nts = cloud.getPrintPCsFresh ? await cloud.getPrintPCsFresh() : []; } catch { nts = []; }
  try { al = cloud.getPcAlias ? await cloud.getPcAlias() : {}; } catch { al = {}; }
  const ch0 = cf.ch || {}, rows = new Map(), alias = new Set(Object.keys(al)), srvH = String((pcSt || {}).host || '').toUpperCase();
  for (const x of nts) {
    const h = String(x.host || '').toUpperCase(), nm = disp(x); if (!nm) continue;
    const bare = bareH(h), raw = String(x.name || '').trim(), m = Math.max(0, Math.round((Date.now() - (Number(x.at) || 0)) / 60000));
    const froms = Object.keys(al).filter(f => al[f] === nm);
    [LEG[h], h, bare, raw].forEach(a => a && a !== nm && alias.add(a));
    rows.set(nm, { v: ch0[nm] ?? ch0[nm.toLowerCase()] ?? ch0[LEG[h]] ?? ch0[h] ?? ch0[bare] ?? ch0[raw] ?? froms.map(f => ch0[f] ?? ch0[LEG['DESKTOP-' + f.toUpperCase()]]).find(v => v != null) ?? '', srv: !!srvH && srvH === h, nt: 1,
      st: (m <= 5 ? `🟢 NT-PRINT v${x.ver || '?'}` : `🔴 NT-PRINT band ${m > 120 ? Math.round(m / 60) + ' ghante' : m + ' min'}`) + (h && h !== nm.toUpperCase() ? ' · ' + h : '') });
  }
  if (!nts.length) for (const k of Object.keys(ch0)) rows.set(k, { v: ch0[k], st: '' });
  for (const b of bills.values()) { const p = String(b.pc || ''); if (p && !rows.has(p) && !alias.has(p)) rows.set(p, { v: ch0[p] ?? '', st: '⚪ NT-PRINT nahi laga', link: 1 }); }
  const pcs = new Set(rows.keys()), ntNames = [...rows.keys()].filter(k => rows.get(k).nt).sort();
  const alHTML = Object.keys(al).length ? `<div class="bt-alias">🔗 Jore hue (ek hi PC): ${Object.entries(al).map(([f, t]) => `<button type="button" class="bt-alx" data-al-x="${esc(f)}">${esc(f)} → ${esc(t)} ✕</button>`).join('')}</div>` : '';
  const st = pcSt || {};
  // v2.346.0: 🎞 HD — Auto (godam camera khud HD, PC bill-clip v2.20) · HD · Halki — billClip.hdc [{ch, hd}] (list)
  const hdOf = c => { const h = (Array.isArray(cf.hdc) ? cf.hdc : []).find(z => Number(z && z.ch) === Number(c)); return h ? (Number(h.hd) ? 'hd' : 'lo') : 'auto'; };
  const pcHd = c => ((Array.isArray(st.cams) ? st.cams : []).find(z => Number(z && z.ch) === Number(c)) || {}).hd ? 1 : 0;
  const hdTxt = (v, c) => v === 'hd' ? '🎞 HD' : v === 'lo' ? '🎞 Halki' : `🎞 Auto${c && pcHd(c) ? '·HD' : ''}`;
  const xcRow = x => `<div class="bt-xc" data-xc><input data-xn maxlength="30" placeholder="Naam (jaise Godam 1)" value="${esc(x?.n || '')}" autocomplete="off"><input data-xch type="number" inputmode="numeric" min="1" max="899" placeholder="Ch" value="${esc(x?.ch || '')}"><button type="button" class="bt-tg${x?.r ? ' on' : ''}" data-xr="1">${x?.r ? '⏺ Rec' : '⏹ Rec'}</button><button type="button" class="bt-tg${x && hdOf(x.ch) !== 'auto' ? ' on' : ''}" data-xhd="${x ? hdOf(x.ch) : 'auto'}" title="Recording ki safai: Auto = godam camera HD">${hdTxt(x ? hdOf(x.ch) : 'auto', x?.ch)}</button><button type="button" class="bt-alx" data-xx="1" aria-label="Hatao">✕</button></div>`;   // v2.329.0
  // v2.398.0: 🌐 SEEDHA camera (NVR mein nahi — jaise galla ka Wi-Fi camera): naam · IP · ⏺ · 🎞 · ✕ + neeche password + PC ka rabta test (billClipPc.dct)
  const dcSt = x => { if (!x) return ''; const t = (Array.isArray(st.dct) ? st.dct : []).find(z => Number(z && z.ch) === Number(x.ch)); if (!t || (!t.at && !t.err)) return '<small class="bt-xst">⏳ Save ke baad PC ~30 s mein camera aazmayega — yeh khirki dobara kholein to nateeja yahan</small>'; return t.ok && !t.err ? `<small class="bt-xst ok">✅ PC ko camera se seedhi video mili${t.rec ? ' · ⏺ recording chal rahi' : ''} · ${tm(t.at)}</small>` : `<small class="bt-xst bad">✕ ${esc(t.err || 'video nahi mili')}${t.at ? ' · ' + tm(t.at) : ''}</small>`; };
  const dcRow = x => { const rOn = x ? !!x.r : true, hv = x ? hdOf(x.ch) : 'auto'; return `<div class="bt-xc dc" data-xc data-xdc="1" data-xchv="${esc(x?.ch || '')}"><input data-xn maxlength="30" placeholder="Naam (jaise Galla)" value="${esc(x?.n || '')}" autocomplete="off"><input data-xip maxlength="24" autocapitalize="characters" placeholder="🌐 IP ya 🛰 Serial number" value="${esc(x?.sn ? x.sn : x?.ip ? x.ip + (Number(x.port) && Number(x.port) !== 554 ? ':' + x.port : '') : '')}" autocomplete="off"><button type="button" class="bt-tg${rOn ? ' on' : ''}" data-xr="1">${rOn ? '⏺ Rec' : '⏹ Rec'}</button><button type="button" class="bt-tg${hv !== 'auto' ? ' on' : ''}" data-xhd="${hv}">${hdTxt(hv, x?.ch)}</button><button type="button" class="bt-alx" data-xx="1" aria-label="Hatao">✕</button><input data-xpw type="password" maxlength="64" placeholder="🔑 Camera ka password (DMSS wala)" value="${esc(x?.pw || '')}" autocomplete="new-password">${dcSt(x)}</div>`; };
  const chNm = c => { const x = (Array.isArray(cf.xc) ? cf.xc : []).find(z => Number(z && z.ch) === Number(c)); return x ? (x.sn ? '🛰 ' : x.ip ? '🌐 ' : '📹 ') + x.n : 'ch ' + c; };
  const inp = (k, ph, v, type) => `<label class="bt-f"><span>${ph}</span><input type="${type || 'text'}" data-cf="${k}" value="${esc(v ?? '')}" autocomplete="off"></label>`;
  d.innerHTML = `<div class="bt-dhead"><b>⚙️ Camera setup (malik)</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody bt-setup">
      <p class="bt-sub">PC har counter ke camera ki live video apne paas 1-1 min ke tukron mein rakhta hai aur har POSTED bill ki clip (print se <b>pehle</b> + <b>baad</b> ke second, default 5 min) usi se foran banata hai; tukre na hon to NVR ki recording se. NVR ka password sirf malik ke login mein (Firestore malik-only).</p>
      <div class="bt-row"><button type="button" class="bt-tg${cf.on !== false && cf.ip ? ' on' : ''}" data-tg="on">${cf.on !== false && cf.ip ? '🟢 ON' : '⚫ Band'}</button>
        <button type="button" class="bt-tg${!/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="dahua">Dahua (DMSS)</button><button type="button" class="bt-tg${/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="hik">Hikvision</button>
        <button type="button" class="bt-tg${cf.sub === 0 ? '' : ' on'}" data-tg="sub">${cf.sub === 0 ? 'Main stream' : 'Sub stream (halki)'}</button><button type="button" class="bt-tg${cf.wa === false ? '' : ' on'}" data-tg="wa">${cf.wa === false ? '📲 Band ho to WhatsApp: nahi' : '📲 Band ho to WhatsApp'}</button></div>
      <div class="bt-ihead">🎯 Clip kahan se shuru ho</div>
      <div class="bt-row bt-pre">${[[0, '⏱ Pehli item se'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, t]) => `<button type="button" class="bt-tg${(cf.pre === undefined ? 0 : Number(cf.pre)) === v ? ' on' : ''}" data-pre="${v}">${t}</button>`).join('')}</div>
      <p class="bt-sub">⏱ Pehli item = PC har bill ki pehli scan ka waqt yaad rakhta hai — clip wahan se 15 s pehle shuru, print ke baad khatam (bill jitna lamba, clip utni). Waqt na mile to 2 min.</p>
      <div class="bt-grid">${inp('ip', 'NVR ka IP (LAN)', cf.ip)}${inp('port', 'RTSP port', cf.port || 554, 'number')}${inp('user', 'NVR user', cf.user || 'admin')}${inp('pw', 'NVR password', cf.pw, 'password')}
        ${inp('post', 'Print ke BAAD (s)', cf.post || 20, 'number')}${inp('keep', 'Clip rakho (din)', cf.keep || 2, 'number')}${inp('rkd', 'PC par recording rakho (din)', cf.rkd || 10, 'number')}${inp('rep', 'Shaam ka paigham (HH:MM)', cf.rep || '20:30')}</div>
      <div class="bt-ihead">🖥 Counter ↔ camera channel (NVR ka channel number)</div>
      <div class="bt-chlist">${[...pcs].sort().map(p => { const r = rows.get(p) || {}; const tg = r.link && ntNames.length ? 'div' : 'label'; return `<${tg} class="bt-ch" data-chrow="${esc(p)}"><span class="bt-chn"><b>${esc(p)}</b><small>${esc(r.st || '')}${r.srv ? ' · 🖥 server' : ''}</small>${r.link && ntNames.length ? `<select class="bt-alsel" data-al="${esc(p)}"><option value="">🔗 Yeh kaun sa PC hai?</option>${ntNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>` : ''}</span><input type="number" min="0" max="64" data-ch="${esc(p)}" value="${esc(r.v ?? '')}" placeholder="ch"></${tg}>`; }).join('') || '<small>Koi counter nahi mila — counter PC par NT-PRINT chalu ho to naam yahan khud aayega</small>'}</div>
      ${alHTML}
      <div class="bt-ihead">📹 Mazeed cameras (counter ke ilawa)</div>
      <div class="bt-xcl" data-xcl>${(Array.isArray(cf.xc) ? cf.xc : []).map(x => x && (x.ip || x.sn) ? dcRow(x) : xcRow(x)).join('')}</div>
      <div class="bt-row"><button type="button" class="bt-tg" data-xc-add="1">＋ Camera</button><button type="button" class="bt-tg" data-xd-add="1">＋ 🌐 Seedha camera (IP / 🛰 serial)</button></div>
      <p class="bt-sub">Godam / gate jaisa koi bhi camera: naam + NVR channel. ⏺ Rec = PC us ki recording rakhe (WhatsApp par pichhle waqt ki video sirf recording wale ki) · ⏹ = sirf live / 📸 tasveer. Live (app + WhatsApp: likhein <b>live</b>) har camera ka. 🎞 <b>Auto</b> = godam ka camera HD (chehra pehchanne ke liye), baqi halki · <b>HD</b> recording zyada jagah leti hai (roz ≈ 15–25 GB fi camera).</p>
      <p class="bt-sub">🌐 <b>Seedha camera</b> = jo NVR mein nahi (jaise galla ka Wi-Fi camera): naam + camera ka IP (DMSS → camera → Device info / Network) + camera ka password. PC camera se seedha video leta hai — recording, Live, 🎛 Sab cameras, WhatsApp live sab mein aata hai. Shart: server PC aur camera ek hi router / network par. Abhi sirf Dahua (DMSS) camera.</p>
      <div class="bt-ihead">🚪 Gate pass — godam ka camera <button type="button" class="bt-tg${cf.gpv === false ? '' : ' on'}" data-tg="gpv">${cf.gpv === false ? '⚫ Band' : '🟢 ON'}</button></div>
      ${gpRows(cf, st)}
      <p class="bt-sub">Bill ki jo item godam se nikalti hai (gate pass), us godam ke camera ki video: post se pehle → godam wale ke ✓ de diya ke 1 min baad (✓ na ho = 10 min). Tally screen par counter video ke upar + WhatsApp (group / video) mein bill ki video ke baad. Ek godam par 2 camera ho sakte hain (dono saath saath; WhatsApp par ek ke upar doosra). Camera ⏺ Rec ON hona chahiye. Auto = camera ke naam mein godam ka naam (jaise "Godam 2 gate") ya 📦 Loading ginti wala camera.</p>
      <p class="bt-sub">🖥 Naam = har PC ka apna naam (NT-PRINT se). 🟢 = NT-PRINT chal raha · 🔴 = band · ⚪ = bill is naam se aaye magar NT-PRINT nahi mila — wohi PC ho to 🔗 se jor dein.</p>
      <p class="bt-sub">🖥 PC: ${st.at ? (Date.now() - st.at < 5 * 60000 ? '🟢 chalu' : '⚫ chup ' + ago(st.at)) + ' · v' + esc(st.ver || '?') + (st.ff ? ' · ffmpeg ✓' : ' · ffmpeg ⏳') + (st.today ? ` · aaj ${st.today.n} (✓ ${st.today.ok} ✕ ${st.today.err})` : '') + (st.last ? ' · ' + esc(st.last) : '') + (st.err ? ' · ⚠ ' + esc(st.err) : '') : 'abhi report nahi (PC 3-5 min mein script lagata hai)'}</p>
      ${st.rec && Object.keys(st.rec).length ? `<p class="bt-sub">🎞 Recording: ${Object.entries(st.rec).map(([ch, r]) => `${esc(chNm(ch))} ${r.on ? '🟢' : '⚫'} ${r.n || 0} min${r.last ? ' · ' + tm(r.last) : ''}${r.err ? ' · ' + esc(r.err) : ''}`).join(' · ')}</p>` : ''}${st.dk ? `<p class="bt-sub">💾 Recording ${esc(String(st.dk.d || ''))}${st.dk.d ? ':' : ''} · ${esc(String(st.dk.free ?? '?'))} GB khali / ${esc(String(st.dk.tot ?? '?'))} GB · ${esc(String(st.rkd || 10))} din rakhi jati hai${st.dk.day ? ' · roz ≈ ' + esc(String(st.dk.day)) + ' GB · jagah ≈ ' + esc(String(st.dk.can || 0)) + ' din' : ''}${st.dk.old ? ' · sab se purani ' + new Date(Number(st.dk.old)).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}${st.dk.cut ? ' · ⚠️ jagah kam — purane tukre mitaye' : ''}${st.dk.err ? ' · ✕ ' + esc(st.dk.err) : ''} · drive badalni ho: Settings → 🖥️ PC scripts → 💽</p>` : ''}
      ${st.net ? `<p class="bt-sub bt-test${st.net.p554 ? '' : ' bad'}">🌐 Network (${tm(st.net.at)}): server PC <b>${esc((st.net.my || []).join(', ') || '?')}</b> · NVR <b>${esc(st.net.ip || '?')}</b>:${esc(st.net.port || 554)} — ${st.net.p554 ? '✅ rasta hai' : '✕ rasta nahi'}${st.net.p80 ? ' · web ✓' : ''}${!st.net.same ? ' · ⚠️ dono alag network par (IP ke pehle 3 hisse alag)' : ''}${st.net.found && st.net.found.length ? `<br>🔎 Server ke network par camera port khula: <b>${st.net.found.map(esc).join(', ')}</b> — NVR shayad yahan hai: upar IP yeh likh kar 💾 Save` : (!st.net.p554 ? '<br>Server ke network par koi camera port nahi mila — NVR ki taar / Wi-Fi ya server PC ka network dekhein' : '')}</p>` : ''}
      ${st.test ? `<p class="bt-sub bt-test${st.test.ok ? '' : ' bad'}">🔎 Rabta test (${tm(st.test.at)}, ch ${esc(st.test.ch)}): ${st.test.ok ? '✅ NVR se live video mili — password / IP theek' : '✕ ' + esc(st.test.err) + (st.test.raw ? `<br><small>${esc(st.test.raw)}</small>` : '')}</p>` : ''}
      <div class="bt-row"><button type="button" class="bt-save" data-save="1">💾 Save</button></div>
    </div>`;
  let on = cf.on !== false && !!cf.ip, kind = /hik/i.test(cf.kind || '') ? 'hik' : 'dahua', sub = cf.sub === 0 ? 0 : 1, pre = cf.pre === undefined ? 0 : Number(cf.pre) || 0;
  d.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { pre = Number(b.dataset.pre) || 0; d.querySelectorAll('[data-pre]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('[data-x]').onclick = () => d.close();
  // v2.316.0: 🔗 ek hi PC ke do naam jorna / kholna (blueAccess/pcAlias — PC scripts 3-5 min mein wahi naam)
  d.querySelectorAll('[data-al]').forEach(sl => sl.onchange = async () => {
    const from = sl.dataset.al, to = sl.value; if (!to) return;
    if (!confirm(`🔗 "${from}" aur "${to}" ek hi PC hain?\n\nAage se "${from}" ke bill "${to}" ke naam se aayenge (camera channel bhi wahi).`)) { sl.value = ''; return; }
    sl.disabled = true;
    try { await cloud.setPcAlias(from, to); notice('🔗 Jor diya — PC 3-5 min mein naya naam lagayega'); const row = sl.closest('[data-chrow]'); if (row) row.remove(); }
    catch (e) { sl.disabled = false; sl.value = ''; notice('Nahi jura: ' + (e?.message || e)); }
  });
  d.querySelectorAll('[data-al-x]').forEach(b => b.onclick = async () => {
    const from = b.dataset.alX; if (!confirm(`"${from}" ka jor hata dein? (alag PC dikhega)`)) return;
    b.disabled = true;
    try { await cloud.setPcAlias(from, null); notice('Jor hata diya'); b.remove(); } catch (e) { b.disabled = false; notice('Nahi hata: ' + (e?.message || e)); }
  });
  const xl = d.querySelector('[data-xcl]');   // v2.329.0: 📹 mazeed cameras — ＋ / ⏺ / ✕ (Save par jata hai)
  d.querySelector('[data-xc-add]').onclick = () => { if (xl.children.length >= 16) { notice('16 tak camera'); return; } xl.insertAdjacentHTML('beforeend', xcRow(null)); xl.lastElementChild.querySelector('[data-xn]').focus(); };
  d.querySelector('[data-xd-add]').onclick = () => { if (xl.children.length >= 16) { notice('16 tak camera'); return; } xl.insertAdjacentHTML('beforeend', dcRow(null)); xl.lastElementChild.querySelector('[data-xn]').focus(); };   // v2.398.0
  xl.onclick = ev => { const r = ev.target.closest('[data-xr]'); if (r) { const on = !r.classList.contains('on'); r.classList.toggle('on', on); r.textContent = on ? '⏺ Rec' : '⏹ Rec'; return; }
    const hb = ev.target.closest('[data-xhd]'); if (hb) { const nx = { auto: 'hd', hd: 'lo', lo: 'auto' }[hb.dataset.xhd] || 'auto'; hb.dataset.xhd = nx; hb.classList.toggle('on', nx !== 'auto'); hb.textContent = hdTxt(nx, Number(hb.closest('[data-xc]')?.querySelector('[data-xch]')?.value || hb.closest('[data-xc]')?.dataset.xchv) || 0); return; }
    const x = ev.target.closest('[data-xx]'); if (x) x.closest('[data-xc]').remove(); };   // v2.346.0: 🎞 HD chip
  d.querySelector('[data-tg="on"]').onclick = ev => { on = !on; ev.currentTarget.classList.toggle('on', on); ev.currentTarget.textContent = on ? '🟢 ON' : '⚫ Band'; };
  let gpv = cf.gpv !== false; d.querySelector('[data-tg="gpv"]').onclick = ev => { gpv = !gpv; ev.currentTarget.classList.toggle('on', gpv); ev.currentTarget.textContent = gpv ? '🟢 ON' : '⚫ Band'; };   // v2.337.0
  let waA = cf.wa !== false; d.querySelector('[data-tg="wa"]').onclick = ev => { waA = !waA; ev.currentTarget.classList.toggle('on', waA); ev.currentTarget.textContent = waA ? '📲 Band ho to WhatsApp' : '📲 Band ho to WhatsApp: nahi'; };   // v2.399.0: recording 10 min ruke = malik ko WhatsApp, har ghante
  d.querySelector('[data-tg="sub"]').onclick = ev => { sub = sub ? 0 : 1; ev.currentTarget.classList.toggle('on', !!sub); ev.currentTarget.textContent = sub ? 'Sub stream (halki)' : 'Main stream'; };
  d.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; d.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('[data-save]').onclick = async ev => {
    const g = k => d.querySelector(`[data-cf="${k}"]`)?.value ?? '';
    const ch = {}; d.querySelectorAll('[data-ch]').forEach(i => { const v = Number(i.value); if (v > 0) ch[i.dataset.ch] = v; });
    const xc = [], hdc = [], seenX = new Set(); let xBad = '';
    const used = new Set(), dcCh = new Set(); d.querySelectorAll('[data-xc]').forEach(r => { const c = Math.floor(Number(r.dataset.xdc ? r.dataset.xchv : r.querySelector('[data-xch]')?.value) || 0); if (c) used.add(c); });   // v2.398.0: 🌐 seedha camera ka pakka number 901–916
    d.querySelectorAll('[data-xc]').forEach(r => { const n = String(r.querySelector('[data-xn]').value || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      if (r.dataset.xdc) {
        const raw = String(r.querySelector('[data-xip]').value || '').replace(/\s+/g, ''), pw = String(r.querySelector('[data-xpw]').value || ''), m = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/), sn = /^[A-Za-z0-9]{10,24}$/.test(raw) && /[A-Za-z]/.test(raw) ? raw.toUpperCase() : '';   // v2.400.0: 🛰 serial number (P2P) — IP ke baghair
        if (!n && !raw) return;
        if (!n || (!sn && (!m || m[1].split('.').some(v => Number(v) > 255)))) { xBad = xBad || `🌐 "${n || '?'}": naam / IP ya serial number adhoora (IP jaise 192.168.1.50 · serial DMSS ke Device Details se)`; return; }
        if (!pw) { xBad = xBad || `🌐 "${n}": camera ka password likhein`; return; }
        if (seenX.has(n.toLowerCase()) || pcs.has(n)) { xBad = xBad || `"${n}" naam dohra hai`; return; } seenX.add(n.toLowerCase());
        let c = Math.floor(Number(r.dataset.xchv) || 0); if (!(c >= 901 && c <= 916) || dcCh.has(c)) { c = 0; for (let k = 901; k <= 916; k++) if (!used.has(k) && !dcCh.has(k)) { c = k; break; } }
        if (!c) { xBad = xBad || '🌐 16 se zyada seedhe camera nahi'; return; } dcCh.add(c); used.add(c);
        xc.push(sn ? { n, ch: c, r: r.querySelector('[data-xr]').classList.contains('on') ? 1 : 0, sn, u: 'admin', pw } : { n, ch: c, r: r.querySelector('[data-xr]').classList.contains('on') ? 1 : 0, ip: m[1], port: Number(m[2]) || 554, u: 'admin', pw });
        const hv = r.querySelector('[data-xhd]')?.dataset.xhd; if (hv === 'hd' || hv === 'lo') hdc.push({ ch: c, hd: hv === 'hd' ? 1 : 0 }); return;
      }
      const c = Math.floor(Number(r.querySelector('[data-xch]').value) || 0);
      if (!n && !c) return; if (!n || !(c > 0 && c < 900)) { xBad = xBad || `"${n || '?'}" ka naam / channel adhoora`; return; } if (seenX.has(n.toLowerCase()) || pcs.has(n)) { xBad = xBad || `"${n}" naam dohra hai`; return; } seenX.add(n.toLowerCase()); xc.push({ n, ch: c, r: r.querySelector('[data-xr]').classList.contains('on') ? 1 : 0 }); const hv = r.querySelector('[data-xhd]')?.dataset.xhd; if (hv === 'hd' || hv === 'lo') hdc.push({ ch: c, hd: hv === 'hd' ? 1 : 0 }); });
    if (xBad) { notice('📹 ' + xBad); return; }
    const gc = []; d.querySelectorAll('select[data-gc]').forEach(sl => { const v = String(sl.value || ''); if (v) gc.push({ g: Number(sl.dataset.gc), c: v.slice(0, 30), i: Number(sl.dataset.gi) === 2 ? 2 : 1 }); });   // v2.337.0: 🚪 list (merge mein poori badalti) · v2.338.0: i = 1 / 2 camera
    const out = { xc, hdc, gc, gpv, wa: waA, on, onAt: on ? ((cf.on !== false && cf.ip && cf.onAt) ? cf.onAt : Date.now()) : 0, kind, sub, ip: String(g('ip')).trim(), port: Number(g('port')) || 554, user: String(g('user')).trim() || 'admin', pw: String(g('pw')), pre, post: Number(g('post')) || 20, keep: Number(g('keep')) || 2, rkd: (Number(cf.rkd) > 0 && Number(cf.rkd) < 1 && Number(g('rkd')) === Number(cf.rkd)) ? Number(cf.rkd) : Math.max(1, Math.min(90, Math.round(Number(g('rkd')) || 10))), rep: String(g('rep')).trim() || '20:30', ch };
    ev.currentTarget.disabled = true;
    try { await cloud.setBillClipCfg(out); notice('💾 Camera setup save — PC 30 s mein uthata hai'); d.close(); }
    catch (e) { notice('Save nahi hua: ' + (e?.message || e)); ev.currentTarget.disabled = false; }
  };
}
