// tally.js — 👀 BILL TALLY (v2.204.0, 2026-11-08) — Nigrani wale larke (ghar se) ki apni screen
// Malik: "maal chori hota hai — larka bill par kam likh de to kaise pakrein · camera wala banda ghar par · app mein us ki apni screen ·
//         ek insaan ek waqt mein items aur video dono dekh kar zyada se zyada parchiyan tally kar sake · easy rakhna hai"
// Data: posSales/<din>.bills (PC pos-sales-dekho) + posSaleLines/<SaleID> (items) + billClip/<SaleID> (PC bill-clip.js: counter camera ki 55 s
//       clip, hisse <SaleID>_<i>) → yahan ek waqt mein EK bill: upar video (khud chalti, 1.5×, loop), neeche items bari likhai, sirf do button
//       ✓ THEEK · ✕ KAM (✕ par items tap = kaun si nahi thi) → billTally/<SaleID>. Dabate hi agla bill. Agli clip pehle se load (jaldi).
// v2.204.1: bill ka waqt = banane / print ka (`ct`, PC pos-sales-dekho v2.4) — clip bhi usi se (malik: "posting se nahi, bill banane ke waqt se").
// Malik: ⋮ ⚙️ setup (NVR + counter ↔ camera channel), 📊 aaj ka hisaab. Larka: 📊 mera aaj, ↩ pichla, 💰 bare pehle. AI NAHI.
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const tm = t => t ? new Date(Number(t)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '';
const dayKey = off => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - (off || 0) * 86400000));
const ago = t => { const m = Math.round((Date.now() - Number(t)) / 60000); return m < 1 ? 'abhi' : m < 60 ? m + ' min' : Math.round(m / 60) + ' ghante'; };

let cloud = null, notice = () => {}, isOwner = () => false, byName = () => '', uidOf = () => '';
let offs = [], mounted = false, bills = new Map(), clips = new Map(), tallies = new Map(), lines = new Map(), urls = new Map(), pcSt = null;
let cur = '', mode = 'view', sel = new Set(), lastDone = '', reopen = '', order = 'new', speed = 1.5, loading = '', paintT = null;
try { order = localStorage.getItem('sam-bt-order') || 'new'; speed = Number(localStorage.getItem('sam-bt-speed')) || 1.5; } catch {}

export function tallySetup(o) { cloud = o.cloud; notice = o.notice || notice; isOwner = o.owner || isOwner; byName = o.byName || byName; uidOf = o.uid || uidOf; }

export function renderTally(host) {
  mounted = true;
  if (!host.querySelector('#btRoot')) {
    host.innerHTML = `<div id="btRoot" class="bt-root">
      <div class="bt-bar"><span class="bt-prog" id="btProg">…</span><span class="bt-pcline" id="btPc"></span>
        <span class="bt-chips" data-mn-box>
          <button type="button" data-bt-order="1" data-mn="bt.order" data-mn-i="💰" data-mn-t="Bare bill pehle" data-mn-s="warna naya pehle" data-mn-g="👀 Bill tally">💰 Bare pehle</button>
          <button type="button" data-bt-undo="1" data-mn="bt.undo" data-mn-i="↩" data-mn-t="Pichla wapas" data-mn-s="aakhri tally dobara" data-mn-g="👀 Bill tally">↩ Pichla</button>
          <button type="button" data-bt-sum="1" data-mn="bt.sum" data-mn-i="📊" data-mn-t="Aaj ka hisaab" data-mn-s="kitne ✓ / ✕" data-mn-g="👀 Bill tally">📊 Aaj</button>
          <button type="button" data-bt-setup="1" data-mn="bt.setup" data-mn-i="⚙️" data-mn-t="Camera setup" data-mn-s="NVR + counter ka channel (malik)" data-mn-g="👀 Bill tally" hidden>⚙️ Setup</button>
          <button type="button" data-bt-live="1" data-mn="bt.live" data-mn-i="📺" data-mn-t="Counter Nazar" data-mn-s="purani live screen" data-mn-g="👀 Bill tally">📺 Counter Nazar</button>
        </span></div>
      <div class="bt-main" id="btMain"></div>
      <div class="bt-btns" id="btBtns"></div>
    </div>`;
    host.querySelector('#btRoot').addEventListener('click', onClick);
    host.querySelector('[data-bt-setup]').hidden = !isOwner();
  }
  watch(); paint();
}
export function tallyStop() { if (!mounted) return; mounted = false; for (const f of offs) { try { f(); } catch {} } offs = []; for (const u of urls.values()) { try { URL.revokeObjectURL(u); } catch {} } urls.clear(); }

// ---------- data ----------
function watch() {
  if (offs.length) return;
  const days = [dayKey(0), dayKey(1)];
  for (const d of days) offs.push(cloud.listenPosSales(d, b => { if (!Array.isArray(b)) return; for (const [id, x] of [...bills]) if (x._d === d) bills.delete(id); for (const x of b) bills.set(String(x.id), { ...x, _d: d }); schedule(); }));
  offs.push(cloud.listenBillClips(days, (l, e) => { if (!l) { if (e) $('btPc') && ($('btPc').textContent = '⚠ ' + (e.message || 'clip nahi parh sake')); return; } clips = new Map(l.map(c => [String(c.id), c])); schedule(); }));
  offs.push(cloud.listenBillTally(days, l => { if (!l) return; tallies = new Map(l.map(t => [String(t.id), t])); schedule(); }));
  offs.push(cloud.listenBillClipPc(s => { pcSt = s; paintPc(); }));
}
function schedule() { if (paintT) return; paintT = setTimeout(() => { paintT = null; paint(); }, 120); }
function queue() {
  const out = [];
  for (const [id, b] of bills) { if (b.x || Number(b.ps) !== 2 || (tallies.has(id) && id !== reopen)) continue; const c = clips.get(id); if (!c || c.st !== 'ok') continue; out.push(b); }
  out.sort((a, b) => order === 'big' ? (Number(b.t) - Number(a.t)) || (Number(b.pt) - Number(a.pt)) : Number(b.pt) - Number(a.pt));
  return out;
}
function counts() {
  const td = dayKey(0); let ok = 0, bad = 0, wait = 0, err = 0;
  for (const t of tallies.values()) if (t.day === td) { if (t.ok) ok++; else bad++; }
  for (const [id, b] of bills) { if (b.x || Number(b.ps) !== 2 || tallies.has(id)) continue; const c = clips.get(id); if (!c || c.st === 'wait') wait++; else if (c.st === 'err' || c.st === 'skip') err++; }
  return { ok, bad, wait, err, q: queue().length };
}
async function linesOf(id) {
  if (lines.has(id)) return lines.get(id);
  try { const l = await cloud.getPosSaleLines(id); lines.set(id, l || []); return l || []; } catch { return null; }
}
async function clipUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const c = clips.get(id); if (!c || c.st !== 'ok') return '';
  const u8 = await cloud.getBillClip(id, c.n);
  if (!u8 || !u8.length) return '';
  const u = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' }));
  urls.set(id, u); if (urls.size > 6) { const k = urls.keys().next().value; if (k !== cur) { try { URL.revokeObjectURL(urls.get(k)); } catch {} urls.delete(k); } }
  return u;
}

// ---------- paint ----------
function paintPc() {
  const el = $('btPc'); if (!el) return;
  const c = counts(); let s = '';
  if (!pcSt) s = '';
  else if (Date.now() - (Number(pcSt.at) || 0) > 5 * 60000) s = '🖥 PC chup (' + ago(pcSt.at) + ')';
  else if (!pcSt.on) s = '⚙️ camera band — ' + (pcSt.err || 'setup');
  else if (pcSt.err) s = '⚠ ' + pcSt.err;
  else s = '🎥 PC chalu' + (c.wait ? ' · ⏳ ' + c.wait + ' clip ban rahi' : '');
  if (c.err && !/⚠/.test(s)) s += (s ? ' · ' : '') + '✕ ' + c.err + ' clip nahi bani';
  el.textContent = s; el.classList.toggle('bad', /⚠|chup|✕/.test(s));
}
function paint() {
  if (!mounted || !$('btRoot')) return;
  const c = counts(), q = queue();
  const pg = $('btProg'); if (pg) pg.innerHTML = `<b class="ok">✓ ${c.ok}</b> · <b class="bad">✕ ${c.bad}</b> · baqi <b>${c.q}</b>`;
  paintPc();
  const ob = $('btRoot').querySelector('[data-bt-order]'); if (ob) { ob.classList.toggle('on', order === 'big'); ob.textContent = order === 'big' ? '💰 Bare pehle ✓' : '💰 Bare pehle'; }
  if (!cur || !q.some(b => String(b.id) === cur)) { cur = q.length ? String(q[0].id) : ''; mode = 'view'; sel = new Set(); }
  const main = $('btMain'), btns = $('btBtns'); if (!main) return;
  if (!cur) {
    const why = c.wait ? `⏳ ${c.wait} bill ki clip ban rahi hai (PC 1-2 min lagata hai) — khud aa jayegi.` : c.err ? `✕ ${c.err} bill ki clip nahi bani — malik ⚙️ / PC dekhe.` : 'Aaj ke sab bill tally ho gaye 👏 — naya bill post hote hi yahan aayega.';
    main.innerHTML = `<div class="bt-empty"><div class="bt-big">${c.q ? '…' : c.wait ? '⏳' : c.err ? '⚠' : '✅'}</div><p>${esc(why)}</p>${lastDone ? `<button type="button" class="bt-sm" data-bt-undo="1">↩ Pichla bill dobara dekho</button>` : ''}</div>`;
    btns.innerHTML = ''; return;
  }
  const b = bills.get(cur), cl = clips.get(cur) || {}, t = tallies.get(cur);
  if (!main.querySelector(`[data-bt-bill="${cur}"]`)) {
    main.innerHTML = `<div class="bt-card" data-bt-bill="${esc(cur)}">
      <div class="bt-vwrap"><video id="btVid" playsinline muted autoplay loop preload="auto"></video>
        <div class="bt-vtop"><b>#${esc(b.no)}</b> · ${tm(b.ct || b.pt)}${b.ct ? '' : ' (post)'} · ${esc(b.pc || '?')}${b.by ? ' · 👦 ' + esc(b.by) : ''} · Rs ${num(b.t)}${b.p ? ' · ' + esc(b.p) : ''}</div>
        <div class="bt-vload" id="btVload">⏳ video…</div>
        <div class="bt-vchips"><button type="button" data-bt-sp="1"${speed === 1 ? ' class="on"' : ''}>1×</button><button type="button" data-bt-sp="1.5"${speed === 1.5 ? ' class="on"' : ''}>1.5×</button><button type="button" data-bt-sp="2"${speed === 2 ? ' class="on"' : ''}>2×</button><button type="button" data-bt-back10="1">↺ 10s</button><button type="button" data-bt-full="1">⛶</button><span class="bt-dur">${cl.dur ? cl.dur + ' s' : ''}</span></div>
      </div>
      <div class="bt-side"><div class="bt-ihead">🧾 Bill ki items <b id="btN"></b>${t ? `<em>pehle ${t.ok ? '✓' : '✕'} (${esc(t.n || '')})</em>` : ''}</div><ol class="bt-items" id="btItems"><li class="none">⏳ items…</li></ol></div>
    </div>`;
    loadCur(cur);
  }
  paintItems(); paintBtns();
  const nxt = q.find(x => String(x.id) !== cur); if (nxt) clipUrl(String(nxt.id)).catch(() => {});   // agli clip pehle se
}
async function loadCur(id) {
  loading = id;
  const [u, l] = await Promise.all([clipUrl(id).catch(e => { notice('Video nahi aayi: ' + (e?.message || e)); return ''; }), linesOf(id)]);
  if (loading !== id || cur !== id) return;
  const v = $('btVid'), ld = $('btVload');
  if (v) { if (u) { v.src = u; v.playbackRate = speed; v.play().catch(() => {}); if (ld) ld.hidden = true; } else if (ld) ld.textContent = '✕ video nahi mili'; }
  paintItems();
}
function paintItems() {
  const ol = $('btItems'), n = $('btN'); if (!ol) return;
  const l = lines.get(cur);
  if (!l) { ol.innerHTML = '<li class="none">⏳ items…</li>'; return; }
  if (!l.length) { ol.innerHTML = '<li class="none">(POS lines abhi nahi — PC 1 min mein likhta hai)</li>'; return; }
  if (n) n.textContent = l.length + ' cheezein';
  const miss = mode === 'miss';
  ol.innerHTML = l.map((x, i) => { const k = String(x.n || ''); return `<li${miss ? ' class="tap' + (sel.has(k) ? ' sel' : '') + '"' : ''} data-bt-item="${esc(k)}"><b>${esc(k)}</b><span>× ${esc(x.q)}</span>${miss ? `<i>${sel.has(k) ? '✕' : '☐'}</i>` : ''}</li>`; }).join('');
}
function paintBtns() {
  const b = $('btBtns'); if (!b) return;
  if (mode === 'miss') b.innerHTML = `<button type="button" class="bt-cancel" data-bt-cancel="1">↩</button><button type="button" class="bt-dk" data-bt-dk="1">🤷 Pata nahi kaun si</button><button type="button" class="bt-save" data-bt-save="1">✕ KAM — Save${sel.size ? ' (' + sel.size + ')' : ''}</button>`;
  else b.innerHTML = `<button type="button" class="bt-ok" data-bt-ok="1">✓ THEEK</button><button type="button" class="bt-bad" data-bt-bad="1">✕ KAM</button>`;
}

// ---------- save ----------
async function save(ok, miss) {
  const id = cur, b = bills.get(id); if (!b) return;
  const d = { ok: ok ? 1 : 0, miss: miss || [], n: (byName() || 'Nigrani').slice(0, 40), day: b._d || dayKey(0), no: String(b.no || ''), pc: String(b.pc || ''), t: Number(b.t) || 0, by2: String(b.by || '') };
  tallies.set(id, { ...d, id, by: uidOf(), at: Date.now() });   // pehle UI (foran agla), server baad mein
  lastDone = id; reopen = ''; cur = ''; mode = 'view'; sel = new Set(); paint();
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
  const sp = t.closest('[data-bt-sp]'); if (sp) { speed = Number(sp.dataset.btSp) || 1.5; try { localStorage.setItem('sam-bt-speed', String(speed)); } catch {} const v = $('btVid'); if (v) v.playbackRate = speed; sp.parentElement.querySelectorAll('[data-bt-sp]').forEach(x => x.classList.toggle('on', x === sp)); return; }
  if (t.closest('[data-bt-back10]')) { const v = $('btVid'); if (v) { v.currentTime = Math.max(0, v.currentTime - 10); v.play().catch(() => {}); } return; }
  if (t.closest('[data-bt-full]')) { const v = $('btVid'); try { if (v.webkitEnterFullscreen && /iPhone|iPad/.test(navigator.userAgent)) v.webkitEnterFullscreen(); else (v.closest('.bt-vwrap') || v).requestFullscreen?.(); } catch {} return; }
  if (t.closest('.bt-vwrap') && t.tagName === 'VIDEO') { const v = t; if (v.paused) v.play().catch(() => {}); else v.pause(); return; }
  if (t.closest('[data-bt-order]')) { order = order === 'big' ? 'new' : 'big'; try { localStorage.setItem('sam-bt-order', order); } catch {} cur = ''; paint(); return; }
  if (t.closest('[data-bt-undo]')) { if (!lastDone) { notice('Abhi koi pichla nahi'); return; } const tl = tallies.get(lastDone); if (tl && tl.by && tl.by !== uidOf() && !isOwner()) { notice('Ye kisi aur ne tally kiya'); return; } reopen = lastDone; cur = lastDone; mode = 'view'; sel = new Set(); $('btMain').innerHTML = ''; paint(); notice('↩ Bill dobara — ✓ ya ✕ dobara dabayein'); return; }
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
  const td = dayKey(0), d = dlg();
  const list = [...tallies.values()].filter(t => t.day === td).sort((a, b) => Number(b.at) - Number(a.at));
  const who = {}, byBoy = {};
  for (const t of list) { who[t.n || '?'] = (who[t.n || '?'] || 0) + 1; if (!t.ok) { const k = t.by2 || t.pc || '?'; byBoy[k] = (byBoy[k] || 0) + 1; } }
  const bad = list.filter(t => !t.ok);
  d.innerHTML = `<div class="bt-dhead"><b>📊 Aaj ka hisaab</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody">
      <div class="bt-kpi"><span>✓ <b>${list.length - bad.length}</b></span><span class="bad">✕ <b>${bad.length}</b></span><span>👀 ${Object.entries(who).map(([k, v]) => esc(k) + ' ' + v).join(' · ') || '—'}</span></div>
      ${bad.length ? `<p class="bt-sub">✕ Kis larke ke bill: ${Object.entries(byBoy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<b>${esc(k)}</b> ×${v}`).join(' · ')}</p>
      <div class="bt-badlist">${bad.map(t => `<div class="bt-badrow"><b>#${esc(t.no)}</b><span>${esc(t.pc)}${t.by2 ? ' · 👦 ' + esc(t.by2) : ''} · Rs ${num(t.t)} · ${tm(t.at)}</span><em>${(t.miss || []).map(x => x === '?' ? 'pata nahi kaun si' : x).map(esc).join(', ')}</em><small>👀 ${esc(t.n || '')}</small></div>`).join('')}</div>` : '<p class="bt-sub">Aaj koi ✕ nahi 👍</p>'}
    </div>`;
  d.querySelector('[data-x]').onclick = () => d.close();
  if (!d.open) d.showModal();
}

async function openSetup() {
  if (!isOwner()) return;
  const d = dlg(); d.innerHTML = '<div class="bt-dbody">⏳</div>'; if (!d.open) d.showModal();
  let cf = {}; try { cf = await cloud.getBillClipCfg(); } catch (e) { cf = {}; }
  const pcs = new Set(Object.keys(cf.ch || {})); for (const b of bills.values()) if (b.pc) pcs.add(String(b.pc));
  const st = pcSt || {};
  const inp = (k, ph, v, type) => `<label class="bt-f"><span>${ph}</span><input type="${type || 'text'}" data-cf="${k}" value="${esc(v ?? '')}" autocomplete="off"></label>`;
  d.innerHTML = `<div class="bt-dhead"><b>⚙️ Camera setup (malik)</b><button type="button" class="bt-x" data-x="1">×</button></div>
    <div class="bt-dbody bt-setup">
      <p class="bt-sub">PC counter ke camera se har POSTED bill ki chhoti video (post se <b>pehle</b> + <b>baad</b> ke second) NVR ki recording se kaat kar app mein bhejta hai. NVR ka password sirf malik ke login mein (Firestore malik-only).</p>
      <div class="bt-row"><button type="button" class="bt-tg${cf.on !== false && cf.ip ? ' on' : ''}" data-tg="on">${cf.on !== false && cf.ip ? '🟢 ON' : '⚫ Band'}</button>
        <button type="button" class="bt-tg${!/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="dahua">Dahua (DMSS)</button><button type="button" class="bt-tg${/hik/i.test(cf.kind || '') ? ' on' : ''}" data-kind="hik">Hikvision</button>
        <button type="button" class="bt-tg${cf.sub === 0 ? '' : ' on'}" data-tg="sub">${cf.sub === 0 ? 'Main stream' : 'Sub stream (halki)'}</button></div>
      <div class="bt-grid">${inp('ip', 'NVR ka IP (LAN)', cf.ip)}${inp('port', 'RTSP port', cf.port || 554, 'number')}${inp('user', 'NVR user', cf.user || 'admin')}${inp('pw', 'NVR password', cf.pw, 'password')}
        ${inp('pre', 'Post se PEHLE (s)', cf.pre || 45, 'number')}${inp('post', 'Post ke BAAD (s)', cf.post || 10, 'number')}${inp('keep', 'Clip rakho (din)', cf.keep || 2, 'number')}${inp('rep', 'Shaam ka paigham (HH:MM)', cf.rep || '20:30')}</div>
      <div class="bt-ihead">🖥 Counter ↔ camera channel (NVR ka channel number)</div>
      <div class="bt-chlist">${[...pcs].sort().map(p => `<label class="bt-ch"><b>${esc(p)}</b><input type="number" min="0" max="64" data-ch="${esc(p)}" value="${esc((cf.ch || {})[p] ?? '')}" placeholder="ch"></label>`).join('') || '<small>Aaj koi POS bill nahi — bill aane par counter ke naam yahan aayenge</small>'}</div>
      <p class="bt-sub">🖥 PC: ${st.at ? (Date.now() - st.at < 5 * 60000 ? '🟢 chalu' : '⚫ chup ' + ago(st.at)) + ' · v' + esc(st.ver || '?') + (st.ff ? ' · ffmpeg ✓' : ' · ffmpeg ⏳') + (st.today ? ` · aaj ${st.today.n} (✓ ${st.today.ok} ✕ ${st.today.err})` : '') + (st.last ? ' · ' + esc(st.last) : '') + (st.err ? ' · ⚠ ' + esc(st.err) : '') : 'abhi report nahi (PC 3-5 min mein script lagata hai)'}</p>
      <div class="bt-row"><button type="button" class="bt-save" data-save="1">💾 Save</button></div>
    </div>`;
  let on = cf.on !== false && !!cf.ip, kind = /hik/i.test(cf.kind || '') ? 'hik' : 'dahua', sub = cf.sub === 0 ? 0 : 1;
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelector('[data-tg="on"]').onclick = ev => { on = !on; ev.currentTarget.classList.toggle('on', on); ev.currentTarget.textContent = on ? '🟢 ON' : '⚫ Band'; };
  d.querySelector('[data-tg="sub"]').onclick = ev => { sub = sub ? 0 : 1; ev.currentTarget.classList.toggle('on', !!sub); ev.currentTarget.textContent = sub ? 'Sub stream (halki)' : 'Main stream'; };
  d.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; d.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('[data-save]').onclick = async ev => {
    const g = k => d.querySelector(`[data-cf="${k}"]`)?.value ?? '';
    const ch = {}; d.querySelectorAll('[data-ch]').forEach(i => { const v = Number(i.value); if (v > 0) ch[i.dataset.ch] = v; });
    const out = { on, kind, sub, ip: String(g('ip')).trim(), port: Number(g('port')) || 554, user: String(g('user')).trim() || 'admin', pw: String(g('pw')), pre: Number(g('pre')) || 45, post: Number(g('post')) || 10, keep: Number(g('keep')) || 2, rep: String(g('rep')).trim() || '20:30', ch };
    ev.currentTarget.disabled = true;
    try { await cloud.setBillClipCfg(out); notice('💾 Camera setup save — PC 30 s mein uthata hai'); d.close(); }
    catch (e) { notice('Save nahi hua: ' + (e?.message || e)); ev.currentTarget.disabled = false; }
  };
}
