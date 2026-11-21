// ginti.js — 📦 LOADING GINTI (v2.331.0, 2026-11-20) — godam ke darwaze ka camera nag (carton / bori / crate) ginta hai jo lakeer paar karein
// Malik (20 Nov): "lakeer wala software install kar do · camera baad mein lagega · sab ek saath — ginti + note milan + bina note alarm +
//                  Gemini naam + reply se seekhna".
// PC ginti-cam.js (bill-clip ki recording ke tukre → YOLOE model PC par → lakeer) likhta hai: gintiEv (waqia: kab, ⬆ bahar ⬇ andar, st wait | doc |
//   bina | late | in) + gintiDoc (transfer note / gate pass: 📄 ctn + khule vs 📹 ginti, st ok | kam | zyada | wait) + blueAccess/gintiPc (haal).
// Yahan: list (aaj / kal) · 🚨 bina note ki 4 tasveerein + AI ka andaza → malik item chune (gintiLabel — PC agli dafa Gemini ko misaal deta hai) ·
//   ⚙️ Setup (sirf malik): camera · godam · lakeer (tasveer par 2 tap + bahar ki taraf) · alarm · waqt — blueAccess/gintiCam.
// Dekhna: malik + CAP nz.ginti (OPT_IN). AI app mein NAHI (PC: naam ke liye sirf 🚨 tasveer par Gemini).
import { saleStock } from './pos-stock.js?v=2.337.0';
import { smartFind } from './dukan/dhoond.js?v=2.337.0';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hm = t => { if (!t) return ''; const d = new Date(Number(t)); let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad2(d.getMinutes())} ${ap}`; };
const ago = t => { const s = Math.max(0, Math.round((Date.now() - Number(t || 0)) / 1000)); return s < 90 ? s + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' ghante'; };
const ckOf = n => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'cam';
const b64 = im => { try { return im && typeof im.toBase64 === 'function' ? im.toBase64() : ''; } catch { return ''; } };
const net = d => d.dirn === 'in' ? Math.max(0, (d.in || 0) - (d.out || 0)) : Math.max(0, (d.out || 0) - (d.in || 0));

let cloud = null, notice = () => {}, own = false, view = 'list', dayN = 0, evs = [], docs = [], err = '', pc = null, cfg = null, bcPc = null;
let unsubs = [], openDoc = '', evId = '', edit = null, dirty = false, lineCam = '', snap = null, snapUn = null, menu = false, q = '', busy = new Map(), help = false;

function dlg() {
  let d = $('gnDlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'gnDlg'; d.className = 'gn-dlg'; document.body.append(d);
    d.addEventListener('close', stop);
    d.addEventListener('click', onClick); d.addEventListener('input', onInput); d.addEventListener('change', onChange);
  }
  return d;
}
function stop() { unsubs.forEach(u => { try { u(); } catch {} }); unsubs = []; try { snapUn && snapUn(); } catch {} snapUn = null; }
// phone back = ek qadam
window.ntGnClose = () => {
  const f = $('gnFs'); if (f?.open) { f.close(); return true; }
  const d = $('gnDlg'); if (!d?.open) return false;
  if (menu) { menu = false; paint(); return true; }
  if (view === 'line') { view = 'set'; lineOff(); paint(); return true; }
  if (view === 'ev' || view === 'set') { view = 'list'; paint(); return true; }
  d.close(); return true;
};

export function openGinti(o) {
  cloud = o.cloud; notice = o.notice || notice; own = !!o.owner;
  view = o.tab === 'set' && own ? 'set' : 'list'; menu = false; help = false; evId = ''; openDoc = '';
  const d = dlg(); if (!d.open) d.showModal();
  if (view === 'set') edit = null;
  watch(); paint();
}
function watch() {
  stop(); err = '';
  const day = dayOf(Date.now() - dayN * 86400000);
  unsubs.push(cloud.listenGinti(day, (k, rows, e) => { if (e) { err = /permission/i.test(String(e.message || e)) ? 'Is screen ki ijazat nahi (malik se 📦 Loading ginti ON karwayein)' : String(e.message || e); paint(); return; } if (k === 'ev') evs = rows || []; else docs = rows || []; if (view === 'list' || view === 'ev') paint(); }));
  if (own) {
    unsubs.push(cloud.listenGintiPc(x => { pc = x; if (view !== 'line') paintPat(); }));
    unsubs.push(cloud.listenGintiCam(x => { cfg = x || {}; if (view === 'set' && !edit) paint(); }));
    unsubs.push(cloud.listenBillClipPc(x => { bcPc = x; if (view === 'set') paint(); }));
  }
}

// ---------- ⋮ ----------
function head() {
  const t = view === 'set' ? '⚙️ Ginti setup' : view === 'line' ? '➖ Lakeer — ' + esc(lineCam) : view === 'ev' ? '🚨 Bina note' : '📦 Loading ginti';
  const back = view === 'list' ? '' : `<button type="button" class="gn-chip gn-bk" data-gn-back="1">‹</button>`;
  return `<div class="gn-head">${back}<b class="gn-t">${t}</b><span class="gn-hx">${view === 'list' ? `<button type="button" class="gn-chip gn-day" data-gn-menu="1">${dayN ? '📅 Kal' : '📅 Aaj'} ⋮</button>` : ''}<button type="button" class="gn-x" data-gn-close="1" aria-label="Band">×</button></span>
    ${menu ? `<div class="gn-menu">${[['0', '📅 Aaj'], ['1', '📅 Kal']].map(([k, n]) => `<button type="button" class="gn-mi${String(dayN) === k ? ' is-in' : ''}" data-gn-day="${k}">${n}</button>`).join('')}${own ? '<button type="button" class="gn-mi" data-gn-set="1">⚙️ Setup — camera · lakeer · alarm</button>' : ''}<button type="button" class="gn-mi" data-gn-help="1">❓ Kaise kaam karta hai</button></div>` : ''}</div>`;
}
function patHTML() {
  const today = pc && pc.today && pc.today.day === dayOf(Date.now()) ? pc.today : null;
  let o = 0, i = 0, b = 0; for (const e of evs) { o += e.out || 0; i += e.in || 0; if (e.st === 'bina') b++; }
  const live = pc && Date.now() - Number(pc.at || 0) < 12 * 60000, cams = pc && pc.cams ? Object.values(pc.cams) : [];
  const lag = cams.length ? Math.max(...cams.map(c => Number(c.lag) || 0)) : 0;
  const st = !own ? '' : !pc ? '<span class="gn-pc off">🖥 PC: abhi nahi chala</span>' : !pc.on ? '<span class="gn-pc off">⏸ Band</span>' : !live ? `<span class="gn-pc off">🔴 PC chup (${ago(pc.at)})</span>` : `<span class="gn-pc on">🟢 PC · ${lag ? Math.round(lag / 60) + ' min peeche' : 'taza'}</span>`;
  return `<div class="gn-pat" id="gnPat">${st}<span class="gn-k">⬆ ${o}</span><span class="gn-k">⬇ ${i}</span>${b ? `<span class="gn-k al">🚨 ${b}</span>` : ''}${today && today.al ? `<span class="gn-k">📲 ${today.al}</span>` : ''}</div>`;
}
function paintPat() { const p = $('gnPat'); if (p) p.outerHTML = patHTML(); }

function paint() {
  const d = $('gnDlg'); if (!d) return;
  if (view === 'set') { d.innerHTML = head() + setHTML(); return; }
  if (view === 'line') { d.innerHTML = head() + lineHTML(); return; }
  if (view === 'ev') { d.innerHTML = head() + evHTML(); return; }
  d.innerHTML = head() + `<div class="gn-body">${patHTML()}${help ? helpHTML() : ''}${listHTML()}</div>`;
}
function helpHTML() {
  return `<div class="gn-help" data-gn-help="1">📹 Godam ke darwaze ka camera har nag (carton / bori / crate) ginta hai jo <b>lakeer</b> paar kare (⬆ bahar · ⬇ andar).<br>
  🧾 Usi waqt (±20 min) ka transfer note / 🚪 gate pass ho to us se milata hai: ✅ barabar · ⚠️ kam / zyada (📄 note ke ctn + khule vs 📹 camera).<br>
  🚨 Note na mile to malik ko WhatsApp par 4 tasveerein + AI ka andaza — usi paigham par reply: 1 / 2 / 3 ya item ka naam (0 = ghalat). Agli dafa AI yaad rakhta hai.<br>
  ⏱ Ginti 1-2 min peeche (recording ka tukra band hone ke baad). Ginti PC ka apna model (internet nahi) · 🤖 AI sirf 🚨 tasveer par naam ke liye.<span class="gn-mut"> · tap = band</span></div>`;
}
function listHTML() {
  if (err) return `<p class="gn-warn">${esc(err)}</p>`;
  const D = docs.map(d => ({ t: Number(d.t) || 0, h: docRow(d) }));
  const E = evs.filter(e => ['bina', 'late', 'wait', 'in'].includes(e.st)).map(e => ({ t: Number(e.t0) || 0, h: evRow(e) }));
  const L = [...D, ...E].sort((a, b) => b.t - a.t);
  if (!L.length) {
    const noCam = own && cfg && !(Array.isArray(cfg.cams) && cfg.cams.some(c => c.on !== false && Array.isArray(c.ln)));
    return `<div class="gn-empty">${noCam ? '📹 Camera abhi set nahi — ⋮ → ⚙️ Setup se camera, godam aur lakeer lagayein.<br><span class="gn-mut">Camera lagne ke baad ⚙️ Camera setup (Bill tally) mein ＋ Camera + ⏺ Rec ON karein.</span>' : `${dayN ? 'Kal' : 'Aaj'} abhi koi loading / note nahi.`}</div>`;
  }
  return `<div class="gn-list">${L.map(x => x.h).join('')}</div>`;
}
function docRow(d) {
  const n = net(d), st = d.x ? 'x' : d.st || 'wait';
  const chip = st === 'x' ? '✕ cancel' : st === 'wait' ? `⏳ ${n}` : st === 'ok' ? `✅ ${n}` : st === 'kam' ? `⚠️ kam ${n}/${d.ec}` : `⚠️ zyada ${n}/${d.ec + (d.ek || 0)}`;
  const ico = d.k === 'gp' ? '🚪 Gate pass' : '🧾 TN', dir = d.dirn === 'in' ? '← ' : '→ ';
  let ex = '';
  if (openDoc === d.id) {
    let ev = {}; try { ev = JSON.parse(d.ev || '{}'); } catch {}
    const L = Object.entries(ev).map(([id, [o, i]]) => { const e = evs.find(x => x.id === id); return `<div class="gn-xr">🕒 ${hm(e ? e.t0 : Number(id.split('-').pop()))} · ⬆ ${o} ⬇ ${i}${e && e.st === 'late' ? ' · 🚨 pehle bina note' : ''}</div>`; }).join('') || '<div class="gn-xr gn-mut">📹 Camera ne is note ke waqt (±20 min) kuch nahi dekha.</div>';
    ex = `<div class="gn-x2">${L}${own ? `<div class="gn-xa"><button type="button" class="gn-chip" data-gn-ok="${esc(d.id)}">${d.ok ? '↩ Theek mana hata do' : '✓ Theek mana'}</button>${busy.has(d.id) ? `<span class="gn-mut">${busy.get(d.id)}</span>` : ''}</div>` : ''}</div>`;
  }
  return `<div class="gn-r st-${st}${d.ok ? ' okd' : ''}${openDoc === d.id ? ' is-in' : ''}" data-gn-doc="${esc(d.id)}">
    <div class="gn-l1"><b>${ico} #${esc(d.no)}</b><span class="gn-p">${dir}${esc(d.p || '')}</span><span class="gn-st ${st}">${chip}${d.ok ? ' · ✓' : ''}</span></div>
    <div class="gn-l2">🕒 ${hm(d.t)} · 📄 ${d.ec} ctn${d.ek ? ' + ' + d.ek + ' khule' : ''} · 📹 ⬆${d.out || 0} ⬇${d.in || 0}${d.bn ? ' · ' + esc(d.bn) : ''}</div>${ex}</div>`;
}
function evRow(e) {
  const n = Math.abs((e.out || 0) - (e.in || 0)), ai = Array.isArray(e.ai) ? e.ai : [];
  if (e.st === 'wait') return `<div class="gn-r st-wait"><div class="gn-l1"><b>⏳ Note ka intezar</b><span class="gn-st wait">${n} nag</span></div><div class="gn-l2">🕒 ${hm(e.t0)} · 📹 ${esc(e.cam)} · ⬆${e.out || 0} ⬇${e.in || 0}</div></div>`;
  if (e.st === 'in') return `<div class="gn-r st-in"><div class="gn-l1"><b>⬇ Andar aaya (note nahi)</b><span class="gn-st in">${n} nag</span></div><div class="gn-l2">🕒 ${hm(e.t0)} · 📹 ${esc(e.cam)}</div></div>`;
  const lab = e.lab && e.lab.n ? `✓ ${esc(e.lab.n)}` : ai[0] ? `🤖 ${esc(ai[0].n)}?` : '❓ kya tha?';
  const late = e.st === 'late' ? ` · 🧾 baad mein ${esc(e.refNo || 'note bana')}` : '';
  const wa = e.alSent ? ' · 📲 ✓' : e.alWhy ? ' · 📵 ' + esc(e.alWhy) : '';
  return `<div class="gn-r st-${e.st === 'late' ? 'late' : 'bina'}${e.ok ? ' okd' : ''}" data-gn-ev="${esc(e.id)}"><div class="gn-l1"><b>🚨 Bina note · ${n} nag</b><span class="gn-st bina">${lab}</span></div>
    <div class="gn-l2">🕒 ${hm(e.t0)} · 📹 ${esc(e.cam)}${late}${wa}</div></div>`;
}

// ---------- 🚨 waqia: tasveerein + item chuno ----------
let ITEMS = null;
function items() { if (ITEMS && ITEMS.length) return ITEMS; try { const s = saleStock(); const b = s.branches.includes(1) ? 1 : s.branches[0]; ITEMS = (s.itemsFor(b) || []).filter(x => x && x.id != null && x.name).map(x => ({ id: String(x.id), name: String(x.name) })); } catch { ITEMS = []; } return ITEMS; }
function evHTML() {
  const e = evs.find(x => x.id === evId); if (!e) return '<div class="gn-body"><p class="gn-mut">Waqia nahi mila.</p></div>';
  const im = b64(e.im), ai = Array.isArray(e.ai) ? e.ai : [], b = busy.get(e.id) || '';
  let res = ''; if (q.trim()) { const L = items(), r = smartFind(L, q, x => x.name, x => x.id, 12); res = [...r.hits, ...r.near].slice(0, 12).map(x => `<button type="button" class="gn-it" data-gn-it="${esc(x.id)}" data-gn-nm="${esc(x.name)}">${esc(x.name)}</button>`).join('') || '<p class="gn-mut">Kuch nahi mila.</p>'; }
  return `<div class="gn-body gn-evv">
    ${im ? `<img class="gn-col" src="data:image/jpeg;base64,${im}" alt="" data-gn-full="1">` : '<div class="gn-col none">📷 Tasveer nahi bani (recording ka tukra mit gaya / PC chup)</div>'}
    <div class="gn-l2">🕒 ${hm(e.t0)} · 📹 ${esc(e.cam)}${e.bn ? ' (' + esc(e.bn) + ')' : ''} · ⬆ ${e.out || 0} bahar · ⬇ ${e.in || 0} andar${e.st === 'late' ? ' · 🧾 baad mein ' + esc(e.refNo || 'note') : ''}</div>
    ${e.lab && e.lab.n ? `<div class="gn-lab">✓ ${esc(e.lab.n)}${e.labBy === 'WhatsApp' ? ' <span class="gn-mut">(WhatsApp se)</span>' : ''}</div>` : ''}
    ${ai.length ? `<div class="gn-row"><span class="gn-mut">🤖 AI${e.what ? ' (' + esc(e.what) + ')' : ''}:</span>${ai.map((a, i) => own ? `<button type="button" class="gn-chip gn-ai" data-gn-pick="${i}">${i + 1}) ${esc(a.n)}</button>` : `<span class="gn-chip gn-ai">${i + 1}) ${esc(a.n)}</span>`).join('')}</div>` : ''}
    ${own ? `<label class="gn-search"><input data-gn-q placeholder="🔍 Asal item dhoondo (naam)" value="${esc(q)}" autocomplete="off"></label><div class="gn-res">${res}</div>
    <div class="gn-row"><button type="button" class="gn-chip gn-no" data-gn-wrong="1">✕ Ghalat alarm (kuch nahi gaya)</button>${b ? `<span class="gn-mut">${b}</span>` : ''}</div>` : ''}
  </div>`;
}
async function setLab(e, lab, ok) {
  busy.set(e.id, '⏳'); paint();
  try { await cloud.gintiLabel(e.id, lab, ok); busy.set(e.id, '✅ yaad kar liya'); q = ''; } catch (er) { busy.set(e.id, '✕ ' + (er?.message || er)); }
  paint(); setTimeout(() => { busy.delete(e.id); if (view === 'ev') paint(); }, 2500);
}
function fullImg(src) {
  let f = $('gnFs'); if (!f) { f = document.createElement('dialog'); f.id = 'gnFs'; f.className = 'gn-fs'; f.addEventListener('click', () => f.close()); document.body.append(f); }
  f.innerHTML = `<img src="${src}" alt="">`; f.showModal();
}

// ---------- ⚙️ setup (sirf malik) ----------
function camNames() {
  const S = new Set(); for (const c of (bcPc && Array.isArray(bcPc.cams) ? bcPc.cams : [])) if (c && c.n) S.add(String(c.n));
  for (const c of (edit && edit.cams) || []) S.add(c.n); return [...S];
}
function bcOf(n) { return (bcPc && Array.isArray(bcPc.cams) ? bcPc.cams : []).find(c => c.n === n) || null; }
function editInit() {
  const c = cfg || {};
  edit = { on: !!c.on, onAt: Number(c.onAt) || 0, fps: Number(c.fps) || 3, hrs: String(c.hrs || '09:00-21:30'), win: Number(c.win) || 20, alMax: c.alMax == null ? 20 : Number(c.alMax),
    cams: (Array.isArray(c.cams) ? c.cams : []).map(x => ({ n: String(x.n || ''), b: Number(x.b) || 0, bn: String(x.bn || ''), ln: Array.isArray(x.ln) ? x.ln.slice(0, 4).map(Number) : null, out: Number(x.out) === -1 ? -1 : 1, al: x.al !== false, on: x.on !== false })) };
  dirty = false;
}
function camOf(n) { let c = edit.cams.find(x => x.n === n); if (!c) { c = { n, b: 0, bn: '', ln: null, out: 1, al: true, on: false }; edit.cams.push(c); } return c; }
function godams() { try { const s = saleStock(); return s.branches.map(b => ({ b, n: s.names[b] || ('Branch ' + b) })); } catch { return []; } }
function setHTML() {
  if (!edit) { if (cfg == null) return '<div class="gn-body"><p class="gn-mut">⏳ Setting aa rahi hai…</p></div>'; editInit(); }
  const live = pc && Date.now() - Number(pc.at || 0) < 12 * 60000;
  const pcLine = !pc ? '🖥 PC: ginti-cam abhi nahi chala (PC on ho to 3-5 min mein khud lag jayega)' : `${live ? '🟢' : '🔴'} PC v${esc(pc.v || '?')} · ${ago(pc.at)} pehle · 🧠 model ${pc.model ? '✓' : '⏳ aa raha'} · ⚙️ ${esc(pc.mods || '…')}${pc.err ? ' · ⚠️ ' + esc(pc.err) : ''}`;
  const G = godams(), names = camNames();
  const camRows = names.length ? names.map(n => {
    const c = edit.cams.find(x => x.n === n) || { n, on: false, al: true, ln: null, b: 0, out: 1 }, bc = bcOf(n), ps = pc && pc.cams ? pc.cams[ckOf(n)] : null;
    const rec = bc ? (bc.c ? '🎥 counter' : bc.r ? (bc.on ? '⏺ Rec chal rahi' : '⏺ Rec ON (PC par abhi nahi)') : '') : '';
    return `<div class="gn-cam${c.on ? ' is-in' : ''}">
      <div class="gn-l1"><b>📹 ${esc(n)}</b><button type="button" class="gn-tg${c.on ? ' is-in' : ''}" data-gn-con="${esc(n)}">${c.on ? '✓ Ginti ON' : '○ Ginti band'}</button></div>
      <div class="gn-row">
        <select class="gn-sel" data-gn-gd="${esc(n)}"><option value="0">🏬 Godam chuno</option>${G.map(g => `<option value="${g.b}"${c.b === g.b ? ' selected' : ''}>${esc(g.n)}</option>`).join('')}</select>
        <button type="button" class="gn-chip" data-gn-line="${esc(n)}">${Array.isArray(c.ln) ? '➖ Lakeer ✓' : '➖ Lakeer lagao'}</button>
        <button type="button" class="gn-tg${c.al ? ' is-in' : ''}" data-gn-al="${esc(n)}">${c.al ? '🚨 Alarm ON' : '🔕 Alarm band'}</button>
      </div>
      <div class="gn-l2">${rec ? esc(rec) : ''}${bc && !bc.c && !bc.r ? `<button type="button" class="gn-chip gn-rec" data-gn-rec="${esc(n)}">⏺ Recording ON karein</button> <span class="gn-mut">(ginti ke liye zaroori)</span>` : ''}${ps ? ` · ${esc(ps.st === 'ok' ? '✓ chal rahi' : ps.st || '')}${ps.ms ? ' · ' + ps.ms + ' ms' : ''}${ps.sz ? ' · ' + esc(ps.sz) : ''}` : ''}</div>
    </div>`;
  }).join('') : '<p class="gn-mut">Koi camera nahi mila — pehle Bill tally ⋮ → ⚙️ Camera setup mein ＋ Camera (naam + channel) jorein.</p>';
  const ch = (k, L, f) => `<div class="gn-row"><span class="gn-lb">${k}</span>${L.map(([v, t]) => `<button type="button" class="gn-tg${edit[f] === v ? ' is-in' : ''}" data-gn-g="${f}" data-gn-v="${v}">${t}</button>`).join('')}</div>`;
  return `<div class="gn-body">
    <div class="gn-pcl">${pcLine}</div>
    <button type="button" class="gn-tg gn-main${edit.on ? ' is-in' : ''}" data-gn-on="1">${edit.on ? '✓ Loading ginti CHALU' : '○ Loading ginti BAND — dabayein'}</button>
    <div class="gn-sec">📹 Camera</div>${camRows}
    <div class="gn-sec">⚙️ Qaide</div>
    ${ch('⏱ Note ka intezar', [[10, '10 min'], [20, '20 min'], [30, '30 min'], [45, '45 min']], 'win')}
    ${ch('🚨 Roz alarm hadd', [[10, '10'], [20, '20'], [50, '50']], 'alMax')}
    ${ch('🎞 Raftar (fps)', [[3, '3'], [4, '4'], [5, '5']], 'fps')}
    <div class="gn-row"><span class="gn-lb">🕘 Dukan ka waqt</span><input class="gn-in" data-gn-hrs value="${esc(edit.hrs)}" placeholder="09:00-21:30" maxlength="11" inputmode="numeric"></div>
    <div class="gn-foot"><button type="button" class="gn-save${dirty ? ' is-in' : ''}" data-gn-save="1">💾 Save${dirty ? ' (badla hai)' : ''}</button>${busy.has('set') ? `<span class="gn-mut">${busy.get('set')}</span>` : ''}</div>
  </div>`;
}
async function save() {
  if (!edit) return; const hrs = String(edit.hrs || '').trim();
  if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(hrs)) { notice('Dukan ka waqt aise likhein: 09:00-21:30'); return; }
  const bad = edit.cams.find(c => c.on && (!c.b || !Array.isArray(c.ln))); if (bad) { notice(`"${bad.n}": ${!bad.b ? 'godam chuno' : 'lakeer lagao'} — phir Save`); return; }
  const G = godams(); for (const c of edit.cams) { const g = G.find(x => x.b === c.b); if (g) c.bn = g.n; }
  busy.set('set', '⏳'); paint();
  try {
    const was = !!(cfg && cfg.on);
    await cloud.saveGintiCam({ on: edit.on, onAt: edit.on ? (was && cfg.onAt ? cfg.onAt : Date.now()) : 0, fps: edit.fps, hrs, win: edit.win, alMax: edit.alMax, cams: edit.cams.filter(c => c.on || c.b || c.ln).slice(0, 8) });
    dirty = false; busy.set('set', '✅ Save — PC 1 min mein naya qaida le lega'); edit = null;
  } catch (e) { busy.set('set', '✕ ' + (e?.message || e)); }
  paint(); setTimeout(() => { busy.delete('set'); if (view === 'set') paint(); }, 3000);
}
async function recOn(n) {
  busy.set('set', '⏳ recording ON…'); paint();
  try { const c = await cloud.getBillClipCfg(), xc = (Array.isArray(c.xc) ? c.xc : []).map(x => ({ ...x })), x = xc.find(y => y.n === n); if (!x) throw Error('camera setup mein yeh camera nahi');
    x.r = 1; await cloud.setBillClipCfg({ xc }); busy.set('set', '✅ ⏺ Recording ON — PC 1-2 min mein shuru'); }
  catch (e) { busy.set('set', '✕ ' + (e?.message || e)); }
  paint(); setTimeout(() => { busy.delete('set'); if (view === 'set') paint(); }, 3500);
}

// ---------- ➖ lakeer (tasveer par 2 tap) ----------
let pts = [];
function lineOff() { try { snapUn && snapUn(); } catch {} snapUn = null; }
function lineStart(n) {
  lineCam = n; view = 'line'; const c = camOf(n); pts = Array.isArray(c.ln) ? [[c.ln[0], c.ln[1]], [c.ln[2], c.ln[3]]] : []; snap = null;
  lineOff(); snapUn = cloud.listenGintiSnap(ckOf(n), x => { snap = x; if (view === 'line') paint(); });
  askSnap();
}
function askSnap() { cloud.saveGintiCam({ snapReq: Date.now(), snapCam: lineCam }).catch(e => notice('Tasveer ka hukum nahi gaya: ' + (e?.message || e))); }
function lineHTML() {
  const c = camOf(lineCam), im = snap ? b64(snap.im) : '', fresh = snap && Number(snap.at) > Date.now() - 15 * 60000;
  let svg = '';
  if (pts.length) {
    const [a, b] = pts; svg += `<circle cx="${a[0]}" cy="${a[1]}" r="14" class="gn-pt"/>`;
    if (b) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = c.out * -dy / L, ny = c.out * dx / L, tx = mx + nx * 110, ty = my + ny * 110;
      svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="gn-ln"/><circle cx="${b[0]}" cy="${b[1]}" r="14" class="gn-pt"/><line x1="${mx}" y1="${my}" x2="${tx}" y2="${ty}" class="gn-ar" marker-end="url(#gnAh)"/><text x="${tx + nx * 40}" y="${ty + ny * 40 + 12}" class="gn-tx">BAHAR</text>`;
    }
  }
  return `<div class="gn-body">
    <p class="gn-hint">Darwaze ke beech <b>zameen par</b> lakeer: pehle ek kinare par tap, phir doosre par. Teer = <b>bahar</b> ki taraf (⇄ se badlo).</p>
    ${im ? `<div class="gn-snap" data-gn-snap="1"><img src="data:image/jpeg;base64,${im}" alt="" draggable="false"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><marker id="gnAh" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ffd23f"/></marker></defs>${svg}</svg></div>`
      : `<div class="gn-snap none">${snap && snap.err ? '⚠️ ' + esc(snap.err) : '⏳ PC se camera ki tasveer aa rahi hai (1 min tak)…'}</div>`}
    <div class="gn-row"><button type="button" class="gn-chip" data-gn-snapr="1">🔄 Nayi tasveer</button><button type="button" class="gn-chip" data-gn-flip="1">⇄ Bahar ki taraf</button><button type="button" class="gn-chip" data-gn-reset="1">↺ Dobara</button><button type="button" class="gn-save${pts.length === 2 ? ' is-in' : ''}" data-gn-lok="1">✓ Theek</button></div>
    <p class="gn-mut">${snap && snap.at ? `📸 ${ago(snap.at)} pehle ki tasveer${fresh ? '' : ' (purani — 🔄 dabayein)'}` : ''}</p>
  </div>`;
}

// ---------- clicks ----------
function onClick(ev) {
  const t = ev.target, g = s => t.closest(s);
  if (g('[data-gn-close]')) { $('gnDlg')?.close(); return; }
  if (g('[data-gn-back]')) { window.ntGnClose(); return; }
  if (g('[data-gn-menu]')) { menu = !menu; paint(); return; }
  if (menu && !g('.gn-menu')) { menu = false; paint(); return; }
  const dy = g('[data-gn-day]'); if (dy) { dayN = Number(dy.dataset.gnDay) || 0; menu = false; evs = []; docs = []; watch(); paint(); return; }
  if (g('[data-gn-set]')) { menu = false; view = 'set'; edit = null; paint(); return; }
  if (g('[data-gn-help]')) { menu = false; help = !help; paint(); return; }
  const ok = g('[data-gn-ok]'); if (ok) { const id = ok.dataset.gnOk, d = docs.find(x => x.id === id); if (!d) return; busy.set(id, '⏳'); paint(); cloud.gintiDocOk(id, !d.ok).then(() => busy.set(id, '✅')).catch(e => busy.set(id, '✕ ' + (e?.message || e))).finally(() => { paint(); setTimeout(() => { busy.delete(id); paint(); }, 2000); }); return; }
  const dr = g('[data-gn-doc]'); if (dr) { openDoc = openDoc === dr.dataset.gnDoc ? '' : dr.dataset.gnDoc; paint(); return; }
  const er = g('[data-gn-ev]'); if (er) { evId = er.dataset.gnEv; q = ''; view = 'ev'; paint(); return; }
  if (g('[data-gn-full]')) { fullImg(t.src); return; }
  const e = evs.find(x => x.id === evId);
  const pk = g('[data-gn-pick]'); if (pk && e) { const a = (e.ai || [])[Number(pk.dataset.gnPick)]; if (a) setLab(e, { id: a.id || '', n: a.n || '' }, 0); return; }
  const it = g('[data-gn-it]'); if (it && e) { setLab(e, { id: it.dataset.gnIt, n: it.dataset.gnNm }, 0); return; }
  if (g('[data-gn-wrong]') && e) { setLab(e, { id: '', n: 'Ghalat alarm' }, 1); return; }
  // setup
  if (g('[data-gn-on]')) { edit.on = !edit.on; dirty = true; paint(); return; }
  const con = g('[data-gn-con]'); if (con) { const c = camOf(con.dataset.gnCon); c.on = !c.on; dirty = true; paint(); return; }
  const al = g('[data-gn-al]'); if (al) { const c = camOf(al.dataset.gnAl); c.al = !c.al; dirty = true; paint(); return; }
  const gg = g('[data-gn-g]'); if (gg) { edit[gg.dataset.gnG] = Number(gg.dataset.gnV); dirty = true; paint(); return; }
  if (g('[data-gn-save]')) { save(); return; }
  const rc = g('[data-gn-rec]'); if (rc) { recOn(rc.dataset.gnRec); return; }
  const ln = g('[data-gn-line]'); if (ln) { lineStart(ln.dataset.gnLine); paint(); return; }
  // lakeer
  if (g('[data-gn-snapr]')) { snap = null; askSnap(); paint(); return; }
  if (g('[data-gn-flip]')) { const c = camOf(lineCam); c.out = c.out === 1 ? -1 : 1; dirty = true; paint(); return; }
  if (g('[data-gn-reset]')) { pts = []; paint(); return; }
  if (g('[data-gn-lok]')) { if (pts.length !== 2) { notice('Pehle tasveer par do tap (lakeer ke dono kinare)'); return; } const c = camOf(lineCam); c.ln = [...pts[0], ...pts[1]].map(v => Math.round(v)); dirty = true; view = 'set'; lineOff(); paint(); notice('➖ Lakeer lag gayi — 💾 Save dabayein'); return; }
  const sn = g('[data-gn-snap]'); if (sn) { const img = sn.querySelector('img'), r = img.getBoundingClientRect(); if (!r.width) return; const x = Math.max(0, Math.min(1000, (ev.clientX - r.left) / r.width * 1000)), y = Math.max(0, Math.min(1000, (ev.clientY - r.top) / r.height * 1000)); if (pts.length >= 2) pts = []; pts.push([x, y]); paint(); }
}
function onInput(ev) {
  const t = ev.target;
  if (t.matches('[data-gn-q]')) { q = t.value; const box = t.closest('.gn-evv')?.querySelector('.gn-res'); if (box && evId) { const L = items(), r = q.trim() ? smartFind(L, q, x => x.name, x => x.id, 12) : { hits: [], near: [] }; box.innerHTML = q.trim() ? ([...r.hits, ...r.near].slice(0, 12).map(x => `<button type="button" class="gn-it" data-gn-it="${esc(x.id)}" data-gn-nm="${esc(x.name)}">${esc(x.name)}</button>`).join('') || '<p class="gn-mut">Kuch nahi mila.</p>') : ''; } return; }   // likhte waqt poori screen dobara nahi (focus na toote)
  if (t.matches('[data-gn-hrs]')) { edit.hrs = t.value; if (!dirty) { dirty = true; const b = $('gnDlg')?.querySelector('[data-gn-save]'); if (b) { b.classList.add('is-in'); b.textContent = '💾 Save (badla hai)'; } } }
}
function onChange(ev) {
  const t = ev.target;
  if (t.matches('[data-gn-gd]')) { const c = camOf(t.dataset.gnGd); c.b = Number(t.value) || 0; dirty = true; paint(); }
}
