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
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const tm = t => t ? new Date(Number(t)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '';
const dayKey = off => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - (off || 0) * 86400000));
const ago = t => { const m = Math.round((Date.now() - Number(t)) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : Math.round(m / 60) + ' ghante'; };

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '', canK = () => true;
let offs = [], mounted = false, bills = new Map(), clips = new Map(), tallies = new Map(), lines = new Map(), urls = new Map(), pcSt = null, reqs = new Map(), segIdx = 0, segBusy = '';
let fPc = '', cur = '', mode = 'view', sel = new Set(), lastDone = '', reopen = '', order = 'new', speed = 1.5, loading = '', paintT = null;
let fDay = 'aaj', skipped = new Set(), undoUntil = 0, undoT = null, tapT = null;   // v2.224.0: 📅 din (aaj | kal | dono) · ⏭ baad mein · ↩ 5 s
try { const o = JSON.parse(localStorage.getItem('sam-bt-day') || 'null'); if (o && o.d === dayKey(0) && /^(aaj|kal|dono)$/.test(o.v)) fDay = o.v; } catch {}
const dOk = d => fDay === 'dono' || d === dayKey(fDay === 'kal' ? 1 : 0);
const dayLbl = () => fDay === 'kal' ? 'Kal' : fDay === 'dono' ? 'Aaj + Kal' : 'Aaj';
try { fPc = localStorage.getItem('sam-bt-pc') || ''; order = localStorage.getItem('sam-bt-order') || 'new'; speed = Number(localStorage.getItem('sam-bt-speed')) || 1.5; } catch {}

export function tallySetup(o) { cloud = o.cloud; notice = o.notice || notice; canK = o.can || canK; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf; }

export function renderTally(host) {
  mounted = true; document.documentElement.classList.add('bt-on');
  if (!host.querySelector('#btRoot')) {
    host.innerHTML = `<div id="btRoot" class="bt-root">
      <div class="bt-bar"><span class="bt-prog" id="btProg">…</span><button type="button" class="bt-warn" id="btPc" data-bt-pcst="1" hidden></button>
        <span class="bt-chips" data-mn-box>
          <button type="button" data-bt-day="1" data-mn="bt.day" data-mn-i="📅" data-mn-t="Din" data-mn-s="Aaj · Kal · Dono ke bill" data-mn-g="👀 Bill tally">📅 Din</button>
          <button type="button" data-bt-pcf="1" data-mn="bt.pcf" data-mn-i="🖥" data-mn-t="Sab counter ke bill" data-mn-s="teeno counter ikathe" data-mn-g="👀 Bill tally">🖥 Sab counter</button>
          <button type="button" data-bt-order="1" data-mn="bt.order" data-mn-i="💰" data-mn-t="Bare bill pehle" data-mn-s="warna naya pehle" data-mn-g="👀 Bill tally">💰 Bare pehle</button>
          <button type="button" data-bt-undo="1" data-mn="bt.undo" data-mn-i="↩" data-mn-t="Pichla wapas" data-mn-s="aakhri tally dobara" data-mn-g="👀 Bill tally">↩ Pichla</button>
          <button type="button" data-bt-list="1" data-mn="bt.list" data-mn-i="📋" data-mn-t="Bills ki list" data-mn-s="jo chaho kholo" data-mn-g="👀 Bill tally">📋 Bills</button>
          <button type="button" data-bt-unp="1" data-mn="bt.unp" data-mn-i="🔵" data-mn-t="Un-posted bills" data-mn-s="clip mangwao (hukum par)" data-mn-g="👀 Bill tally">🔵 Un-posted</button>
          <button type="button" data-bt-sum="1" data-mn="bt.sum" data-mn-i="📊" data-mn-t="Aaj ka hisaab" data-mn-s="kitne ✓ / ✕" data-mn-g="👀 Bill tally">📊 Aaj</button>
          <button type="button" data-bt-setup="1" data-mn="bt.setup" data-mn-i="⚙️" data-mn-t="Camera setup" data-mn-s="NVR + counter ka channel (malik)" data-mn-g="👀 Bill tally" hidden>⚙️ Setup</button>
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
  }
  watch(); paint();
}
export function tallyStop() { document.documentElement.classList.remove('bt-on'); if (!mounted) return; mounted = false; for (const f of offs) { try { f(); } catch {} } offs = []; for (const u of urls.values()) { try { URL.revokeObjectURL(u); } catch {} } urls.clear(); }

// ---------- data ----------
function watch() {
  if (offs.length) return;
  const days = [dayKey(0), dayKey(1)];
  for (const d of days) offs.push(cloud.listenPosSales(d, b => { if (!Array.isArray(b)) return; for (const [id, x] of [...bills]) if (x._d === d) bills.delete(id); for (const x of b) bills.set(String(x.id), { ...x, _d: d }); schedule(); }));
  offs.push(cloud.listenBillClips(days, (l, e) => { if (!l) { if (e && $('btPc')) { $('btPc').hidden = false; $('btPc').textContent = '⚠'; $('btPc').dataset.full = '⚠ ' + (e.message || 'clip nahi parh sake'); $('btPc').classList.add('bad'); } return; } clips = new Map(l.map(c => [String(c.id), c])); schedule(); }));
  offs.push(cloud.listenBillTally(days, l => { if (!l) return; tallies = new Map(l.map(t => [String(t.id), t])); schedule(); }));
  offs.push(cloud.listenBillClipPc(s => { pcSt = s; paintPc(); }));
  offs.push(cloud.listenBillClipReq(dayKey(0), l => { if (!l) return; reqs = new Map(l.map(r => [String(r.id), r])); schedule(); if ($('btDlg')?.open && $('btDlg').dataset.unp) openUnposted(); }));
}
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
  urls.set(key, u); if (urls.size > 24) { const k = urls.keys().next().value; if (!k.startsWith(cur + '#')) { try { URL.revokeObjectURL(urls.get(k)); } catch {} urls.delete(k); } }
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
  else s = '🎥 PC chalu' + (c.wait ? ' · ⏳ ' + c.wait + ' clip ban rahi' : '');
  if (c.err && !/⚠/.test(s)) s += (s ? ' · ' : '') + '✕ ' + c.err + ' clip nahi bani';
  const bad = /⚠|chup|✕|band/.test(s);   // v2.224.0: screen par sirf chhota chip — tap = poori baat
  el.hidden = !(bad || c.wait); el.textContent = /chup/.test(s) ? '⚠ PC chup' : bad ? '⚠' : '⏳ ' + c.wait; el.dataset.full = s; el.title = s; el.classList.toggle('bad', bad);
}
function paint() {
  if (!mounted || !$('btRoot')) return;
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
  if (!main.querySelector(`[data-bt-bill="${cur}"]`)) {
    main.innerHTML = `<div class="bt-card" data-bt-bill="${esc(cur)}">
      <div class="bt-vcol"><div class="bt-vwrap"><video id="btVid" playsinline muted autoplay preload="auto"></video>
        <div class="bt-vload" id="btVload">⏳ video…</div><div class="bt-flash" id="btFlash" hidden></div><button type="button" class="bt-vend" id="btVend" data-bt-again="1" hidden>✅ Video khatam · ↺ Dobara dekho</button>
        <div class="bt-vchips"><span class="bt-segs" id="btSegs"></span><button type="button" class="bt-spd" data-bt-spc="1" title="raftar">${speed}×</button><button type="button" data-bt-full="1" title="poori screen">⛶</button></div>
      </div>
      <div class="bt-info"><span class="bt-inf1"><b class="bt-bno" id="btBno"></b> ${b._d !== dayKey(0) ? '<em>kal</em> ' : ''}${tm(b.ct || b.pt)}${b.ct ? '' : ' (post)'}${b.by ? ' · 👦 ' + esc(b.by) : ''}${!fPc && b.pc ? ' · 🖥 ' + esc(b.pc) : ''}${b.p ? ' · ' + esc(b.p) : ''}</span><b class="bt-rs">Rs ${num(b.t)}</b></div>
      <div class="bt-tip">👆 tap = ruk / chal · 2 dafa tap daayein / baayein = 10 s aage / peeche${cl.dur ? ' · ' + (cl.dur >= 120 ? Math.round(cl.dur / 60) + ' min' : cl.dur + ' s') : ''}</div></div>
      <div class="bt-side"><div class="bt-ihead">🧾 Bill ki items <b id="btN"></b>${t ? `<em>pehle ${t.ok ? '✓' : '✕'} (${esc(t.n || '')})</em>` : ''}</div><ol class="bt-items" id="btItems"><li class="none">⏳ items…</li></ol></div>
    </div>`;
    segIdx = 0; loadCur(cur);
    const vv = main.querySelector('#btVid');   // v2.210.0: hissa khatam = agla · v2.222.0: aakhri ke baad shuru se NAHI (malik: "6 items ke baad video phir se start") — ruko + ↺ chip
    if (vv) { vv.addEventListener('ended', () => { const sg = segsOf(clips.get(cur)); if (sg && segIdx + 1 < sg.length) { playSeg(segIdx + 1); return; } const e = $('btVend'); if (e) e.hidden = false; }); vv.addEventListener('play', () => { const e = $('btVend'); if (e) e.hidden = true; const f = $('btFlash'); if (f) f.hidden = true; }); vv.addEventListener('pause', () => { if (!vv.ended) flash('⏸ ruki — tap se chalao', true); }); }
  }
  const bn = $('btBno'); if (bn && b) { const po = Number(b.ps) === 2, tx = (po ? '📌 ' : '🔵 ') + '#' + (b.no || ''); if (bn.textContent !== tx) bn.textContent = tx; bn.classList.toggle('po', po); bn.classList.toggle('un', !po); bn.title = po ? 'Posted' : 'Un-posted'; }
  paintItems(); paintBtns();
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
  if (t.closest('[data-bt-cam]')) { const td = dayKey(0), L = [...new Set([...[...bills.values()].filter(b => b._d === td && b.pc).sort((a, b) => (Number(b.ct || b.pt) || 0) - (Number(a.ct || a.pt) || 0)).map(b => String(b.pc)), ...(Array.isArray(pcSt?.pcs) ? pcSt.pcs.map(String) : [])])];   /* v2.222.0: camera setting ke counter bhi (bina bill ke live) */ import('./live.js?v=2.269.0').then(m => m.openLive({ cloud, notice, list: L, cur: fPc })).catch(e => notice('Live nahi khula: ' + (e?.message || e))); return; }
  const rq = t.closest('[data-bt-rq]'); if (rq) { const id = rq.dataset.btRq, b = bills.get(id); rq.disabled = true; rq.textContent = '⏳'; cloud.reqBillClip(id, { no: b?.no, pc: b?.pc, day: dayKey(0) }).then(() => notice('🎥 PC ko hukum gaya — clip 1-2 min mein')).catch(e => { notice('Hukum nahi gaya: ' + (e?.message || e)); rq.disabled = false; rq.textContent = '🎥 Mangwao'; }); return; }
  const op = t.closest('[data-bt-open]'); if (op) { const c = clips.get(op.dataset.btOpen); if (!c || c.st !== 'ok') { notice(c?.st === 'err' || c?.st === 'skip' ? '⚠ Is bill ki clip nahi bani: ' + (c.err || '') : '⏳ Clip abhi ban rahi hai'); return; } reopen = op.dataset.btOpen; cur = op.dataset.btOpen; mode = 'view'; sel = new Set(); const dd = $('btDlg'); if (dd) { delete dd.dataset.list; delete dd.dataset.unp; dd.close(); } $('btMain').innerHTML = ''; paint(); return; }
  if (t.closest('[data-bt-full]')) { const v = $('btVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (v.closest('.bt-vwrap') || v).requestFullscreen?.(); } catch {} return; }
  if (t.closest('.bt-vwrap') && t.tagName === 'VIDEO') { const v = t, side = (e.offsetX || 0) < v.offsetWidth / 2 ? -1 : 1;   // v2.224.0: 1 tap = ruk / chal · 2 tap = ±10 s
    if (tapT) { clearTimeout(tapT); tapT = null; seek(side); } else tapT = setTimeout(() => { tapT = null; if (v.paused) v.play().catch(() => {}); else v.pause(); }, 260);
    return; }
  if (t.closest('[data-bt-order]')) { order = order === 'big' ? 'new' : 'big'; try { localStorage.setItem('sam-bt-order', order); } catch {} cur = ''; paint(); return; }
  if (t.closest('[data-bt-undo]')) { if (!lastDone) { notice('Abhi koi pichla nahi'); return; } const tl = tallies.get(lastDone); if (tl && tl.by && tl.by !== uidOf() && !isOwner()) { notice('Ye kisi aur ne tally kiya'); return; } reopen = lastDone; cur = lastDone; mode = 'view'; sel = new Set(); undoUntil = 0; $('btMain').innerHTML = ''; paint(); notice('↩ Bill dobara — ✓ ya ✕ dobara dabayein'); return; }
  if (t.closest('[data-bt-sum]')) { openSum(); return; }
  if (t.closest('[data-bt-setup]')) { openSetup(); return; }
  if (t.closest('[data-bt-live]')) { window.ntNazarLive?.(); return; }
}

// ---------- apni khirki (dialog) — phone back = band ----------
function dlg() {
  let d = $('btDlg');
  if (!d) { d = document.createElement('dialog'); d.id = 'btDlg'; d.className = 'bt-dlg'; document.body.append(d); d.addEventListener('click', ev => { if (ev.target === d) d.close(); }); }
  return d;
}
window.ntBtClose = () => { const d = $('btDlg'); if (!d?.open) return false; try { d.close(); } catch { d.removeAttribute('open'); } return true; };

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
function openList(refresh) {
  const d = dlg(); d.dataset.list = '1'; delete d.dataset.unp;
  const td = dayKey(0), q = listQ.trim().toLowerCase();
  const all = [...bills.values()].filter(b => !b.x && dOk(b._d) && inQ(b) && (!fPc || String(b.pc || '') === fPc)).sort((a, b) => Number(b.ct || b.pt) - Number(a.ct || a.pt));
  const list = q ? all.filter(b => String(b.no || '').toLowerCase().includes(q) || String(b.by || '').toLowerCase().includes(q) || String(b.pc || '').toLowerCase().includes(q) || String(b.p || '').toLowerCase().includes(q)) : all;
  const row = b => { const id = String(b.id), c = clips.get(id), tl = tallies.get(id);
    const st = tl ? `<em class="${tl.ok ? 'ok' : 'bad'}">${tl.ok ? '✓ theek' : '✕ kam'}</em>` : c?.st === 'ok' ? '<em class="go">▶ Dekho</em>' : c?.st === 'err' || c?.st === 'skip' ? `<em class="bad" title="${esc(c.err || '')}">⚠ nahi bani</em>` : '<em>⏳ clip…</em>';
    return `<div class="bt-badrow bt-lrow${id === cur ? ' cur' : ''}" data-bt-open="${esc(id)}"><b>#${esc(b.no)}</b><span>${tm(b.ct || b.pt)} · ${esc(b.pc || '?')}${b.by ? ' · 👦 ' + esc(b.by) : ''} · Rs ${num(b.t)}${b.p ? ' · ' + esc(b.p) : ''}</span>${st}</div>`; };
  const body = `<div class="bt-badlist">${list.map(row).join('') || '<p class="bt-sub">Koi bill nahi</p>'}</div>`;
  if (refresh && d.querySelector('.bt-badlist')) { d.querySelector('.bt-badlist').outerHTML = body; d.querySelector('[data-cnt]').textContent = list.length; return; }
  d.innerHTML = `<div class="bt-dhead"><b>📋 ${dayLbl()} ke bill${fPc ? ' · 🖥 ' + esc(fPc) : ''} <small data-cnt>${list.length}</small></b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody"><input type="search" class="bt-srch" placeholder="🔍 bill number · larka · counter" value="${esc(listQ)}" autocomplete="off">${body}</div>`;
  d.querySelector('[data-x]').onclick = () => { delete d.dataset.list; d.close(); };
  d.querySelector('.bt-srch').oninput = ev => { listQ = ev.target.value; openList(true); };
  if (!d.open) d.showModal();
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

async function openSetup() {
  if (!isOwner()) return;
  const d = dlg(); delete d.dataset.unp; delete d.dataset.list; d.innerHTML = '<div class="bt-dbody">⏳</div>'; if (!d.open) d.showModal();
  let cf = {}; try { cf = await cloud.getBillClipCfg(); } catch (e) { cf = {}; }
  const pcs = new Set(Object.keys(cf.ch || {})); for (const b of bills.values()) if (b.pc) pcs.add(String(b.pc));
  const st = pcSt || {};
  const inp = (k, ph, v, type) => `<label class="bt-f"><span>${ph}</span><input type="${type || 'text'}" data-cf="${k}" value="${esc(v ?? '')}" autocomplete="off"></label>`;
  d.innerHTML = `<div class="bt-dhead"><b>⚙️ Camera setup (malik)</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody bt-setup">
      <p class="bt-sub">PC har counter ke camera ki live video apne paas 1-1 min ke tukron mein rakhta hai aur har POSTED bill ki clip (print se <b>pehle</b> + <b>baad</b> ke second, default 5 min) usi se foran banata hai; tukre na hon to NVR ki recording se. NVR ka password sirf malik ke login mein (Firestore malik-only).</p>
      <div class="bt-row"><button type="button" class="bt-tg${cf.on !== false && cf.ip ? ' on' : ''}" data-tg="on">${cf.on !== false && cf.ip ? '🟢 ON' : '⚫ Band'}</button>
        <button type="button" class="bt-tg${!/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="dahua">Dahua (DMSS)</button><button type="button" class="bt-tg${/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="hik">Hikvision</button>
        <button type="button" class="bt-tg${cf.sub === 0 ? '' : ' on'}" data-tg="sub">${cf.sub === 0 ? 'Main stream' : 'Sub stream (halki)'}</button></div>
      <div class="bt-ihead">🎯 Clip kahan se shuru ho</div>
      <div class="bt-row bt-pre">${[[0, '⏱ Pehli item se'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, t]) => `<button type="button" class="bt-tg${(cf.pre === undefined ? 0 : Number(cf.pre)) === v ? ' on' : ''}" data-pre="${v}">${t}</button>`).join('')}</div>
      <p class="bt-sub">⏱ Pehli item = PC har bill ki pehli scan ka waqt yaad rakhta hai — clip wahan se 15 s pehle shuru, print ke baad khatam (bill jitna lamba, clip utni). Waqt na mile to 2 min.</p>
      <div class="bt-grid">${inp('ip', 'NVR ka IP (LAN)', cf.ip)}${inp('port', 'RTSP port', cf.port || 554, 'number')}${inp('user', 'NVR user', cf.user || 'admin')}${inp('pw', 'NVR password', cf.pw, 'password')}
        ${inp('post', 'Print ke BAAD (s)', cf.post || 20, 'number')}${inp('keep', 'Clip rakho (din)', cf.keep || 2, 'number')}${inp('rk', 'PC par live recording rakho (min)', cf.rk || 180, 'number')}${inp('rep', 'Shaam ka paigham (HH:MM)', cf.rep || '20:30')}</div>
      <div class="bt-ihead">🖥 Counter ↔ camera channel (NVR ka channel number)</div>
      <div class="bt-chlist">${[...pcs].sort().map(p => `<label class="bt-ch"><b>${esc(p)}</b><input type="number" min="0" max="64" data-ch="${esc(p)}" value="${esc((cf.ch || {})[p] ?? '')}" placeholder="ch"></label>`).join('') || '<small>Aaj koi POS bill nahi — bill aane par counter ke naam yahan aayenge</small>'}</div>
      <p class="bt-sub">🖥 PC: ${st.at ? (Date.now() - st.at < 5 * 60000 ? '🟢 chalu' : '⚫ chup ' + ago(st.at)) + ' · v' + esc(st.ver || '?') + (st.ff ? ' · ffmpeg ✓' : ' · ffmpeg ⏳') + (st.today ? ` · aaj ${st.today.n} (✓ ${st.today.ok} ✕ ${st.today.err})` : '') + (st.last ? ' · ' + esc(st.last) : '') + (st.err ? ' · ⚠ ' + esc(st.err) : '') : 'abhi report nahi (PC 3-5 min mein script lagata hai)'}</p>
      ${st.rec && Object.keys(st.rec).length ? `<p class="bt-sub">🎞 Recording: ${Object.entries(st.rec).map(([ch, r]) => `ch ${esc(ch)} ${r.on ? '🟢' : '⚫'} ${r.n || 0} min${r.last ? ' · ' + tm(r.last) : ''}${r.err ? ' · ' + esc(r.err) : ''}`).join(' · ')}</p>` : ''}
      ${st.test ? `<p class="bt-sub bt-test${st.test.ok ? '' : ' bad'}">🔎 Rabta test (${tm(st.test.at)}, ch ${esc(st.test.ch)}): ${st.test.ok ? '✅ NVR se live video mili — password / IP theek' : '✕ ' + esc(st.test.err) + (st.test.raw ? `<br><small>${esc(st.test.raw)}</small>` : '')}</p>` : ''}
      <div class="bt-row"><button type="button" class="bt-save" data-save="1">💾 Save</button></div>
    </div>`;
  let on = cf.on !== false && !!cf.ip, kind = /hik/i.test(cf.kind || '') ? 'hik' : 'dahua', sub = cf.sub === 0 ? 0 : 1, pre = cf.pre === undefined ? 0 : Number(cf.pre) || 0;
  d.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { pre = Number(b.dataset.pre) || 0; d.querySelectorAll('[data-pre]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelector('[data-tg="on"]').onclick = ev => { on = !on; ev.currentTarget.classList.toggle('on', on); ev.currentTarget.textContent = on ? '🟢 ON' : '⚫ Band'; };
  d.querySelector('[data-tg="sub"]').onclick = ev => { sub = sub ? 0 : 1; ev.currentTarget.classList.toggle('on', !!sub); ev.currentTarget.textContent = sub ? 'Sub stream (halki)' : 'Main stream'; };
  d.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; d.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('[data-save]').onclick = async ev => {
    const g = k => d.querySelector(`[data-cf="${k}"]`)?.value ?? '';
    const ch = {}; d.querySelectorAll('[data-ch]').forEach(i => { const v = Number(i.value); if (v > 0) ch[i.dataset.ch] = v; });
    const out = { on, onAt: on ? ((cf.on !== false && cf.ip && cf.onAt) ? cf.onAt : Date.now()) : 0, kind, sub, ip: String(g('ip')).trim(), port: Number(g('port')) || 554, user: String(g('user')).trim() || 'admin', pw: String(g('pw')), pre, post: Number(g('post')) || 20, keep: Number(g('keep')) || 2, rk: Number(g('rk')) || 180, rep: String(g('rep')).trim() || '20:30', ch };
    ev.currentTarget.disabled = true;
    try { await cloud.setBillClipCfg(out); notice('💾 Camera setup save — PC 30 s mein uthata hai'); d.close(); }
    catch (e) { notice('Save nahi hua: ' + (e?.message || e)); ev.currentTarget.disabled = false; }
  };
}
