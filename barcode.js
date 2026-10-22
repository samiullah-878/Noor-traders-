// barcode.js — v2.24.0: 🏷 BARCODE REPORT — asal data: labelJobs (app ka hukum -> PC label-print chhapta hai)
// labelJobs/<id>: {itemId, code, name, qty (packet mein kitne), rate, copies (kitne label), status new|printing|done|failed|skipped,
//                  by, at} + PC: {doneAt, numFrom, numTo, numCode, day}. Main barcode = item ka apna code, warna SUB-barcode.
// v2.97: 🖨 LIVE patti upar — chhap raha (sent/total), line mein (#), pichhle 10 min khatam; ✕ Cancel / Sab cancel (labelJobs.cancelReq).
// v2.98.8: Cancel dabate hi row par "✕ cancel ho raha…" (jawab ka intezar nahi) · nakam ho to BARA alert (rules wajah) ·
//          'printing' jis ki dhadkan (beatAt, label-print v4.1) 3 min se nahi = "⚠ atka hua" (Cancel = PC foran saaf karta hai).
// Screen: din ke hisaab se -> item -> har barcode (packet size) ki ginti. Chips: Aaj · Kal · 7 din · 30 din · status · search.
// PDF: app ka openReportPreview (poori screen + WhatsApp / share).
import { smartHit } from './smart-search.js?v=2.110.0';   // v2.98: 🔎 spelling-maafi list search
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('en-PK').format(Math.round((Number(n) || 0) * 100) / 100);
const dayOf = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const back = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); };
const nice = day => day === dayOf() ? 'Aaj' : day === dayOf(back(1)) ? 'Kal' : day;

// v2.111.0: 🏬 GODAM-WAR + 💰 MAZDOORI (malik: "Godam 2 ke kitne barcode, kitne sub-barcode — mazdoori se zarb = kitna paisa · har godam alag bhi ·
//   barcode screen Transfer ke andar"). Printer EK hi (TSC 244 Pro) — is liye godam = JIS LARKE NE CHHAPA us ki jagah (malik ⚙️ mein ek dafa chunta hai).
//   labelJobs.by (uid) → staffDevices (by → staffId, naam) → stockConfig.lbl {rb: Rs fi barcode label, rs: Rs fi sub-barcode label, g: {staffId|malik: branch},
//   u: {uid: {s, n}} (purane uid yaad — dobara login par bhi hisaab na toote)}. Ginti = ASAL chhape (done = copies, fail / cancel = sent). Paisa: malik + CAP tr.bcpaisa.
//   Waqt: Aaj · Kal · 7 · 30 din · Is mahina · Pichhla mahina · 📅 tareekh (purana = ek dafa getLabelJobs). Chips ⋮ mein (qaida). Rules NAHI badle. AI NAHI.
let cloud = null, notice = () => {}, itemsOf = () => [], pdfOf = null, godamsOf = () => [], isOwn = () => false, myUid = () => '', canK = () => true;
let jobs = [], stop = null, stopFrom = 0, fP = 'today', fS = 'done', fQ = '', open = new Set();
let fG = '', cus = { a: '', b: '' }, extra = null, extraKey = '', lbl = {}, cfgStop = null, devs = [], devStop = null, setOn = false;

export function barcodeSetup(o) { cloud = o.cloud || cloud; notice = o.notice || notice; itemsOf = o.items || itemsOf; pdfOf = o.pdf || pdfOf;
  godamsOf = o.godams || godamsOf; isOwn = o.owner || isOwn; myUid = o.uid || myUid; canK = o.can || canK; }
export function barcodeStop() { if (stop) { try { stop(); } catch {} stop = null; stopFrom = 0; } }
const monthStart = (k = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1); d.setMonth(d.getMonth() - k); return d.getTime(); };
const dayMs = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : 0; };
const fromMs = () => fP === 'today' ? back(0) : fP === 'kal' ? back(1) : fP === '7' ? back(6) : fP === 'mon' ? monthStart(0) : fP === 'pmon' ? monthStart(1) : fP === 'cus' ? (dayMs(cus.a) || back(29)) : back(29);
const toMs = () => fP === 'kal' ? back(0) : fP === 'pmon' ? monthStart(0) : fP === 'cus' && dayMs(cus.b) ? dayMs(cus.b) + 864e5 : Infinity;
const liveFrom = () => Math.min(back(29), monthStart(0));
const PL = { today: 'Aaj', kal: 'Kal', '7': '7 din', '30': '30 din', mon: 'Is mahina', pmon: 'Pichhla mahina', cus: '📅 Tareekh' };
const paisaOn = () => isOwn() || canK('tr.bcpaisa');
function watch() {
  const f = liveFrom();   // 30 din / is mahina — jo pehle; chips sirf filter
  if (!(stop && stopFrom === f)) { barcodeStop(); stopFrom = f;
    stop = cloud?.listenLabelJobs ? cloud.listenLabelJobs(f, l => { jobs = (l || []).filter(j => j && j.id); paint(); }) : null; }
  if (!cfgStop && cloud?.listenStockConfig) cfgStop = cloud.listenStockConfig(c => { lbl = c?.lbl || {}; paint(); });
  if (!devStop && isOwn() && cloud?.listenStaffDevices) devStop = cloud.listenStaffDevices(l => { devs = Array.isArray(l) ? l : []; uidSave(); paint(); });
  wantExtra();
}
function wantExtra() {   // live (30 din / is mahina) se purana = ek dafa server se
  const lo = fromMs(), hi = toMs();
  if (lo >= liveFrom() || !cloud?.getLabelJobs) { extra = null; extraKey = ''; return; }
  const k = lo + '|' + hi; if (extraKey === k) return; extraKey = k; extra = 'wait';
  cloud.getLabelJobs(lo, hi === Infinity ? Date.now() + 864e5 : hi).then(l => { if (extraKey !== k) return; extra = (l || []).filter(j => j && j.id); paint(); })
    .catch(er => { if (extraKey !== k) return; extra = []; notice('Purana data nahi aaya: ' + (er?.message || er)); paint(); });
}
const pool = () => (Array.isArray(extra) && fromMs() < liveFrom()) ? extra : jobs;
// 👤 kis ne chhapa → 🏬 kis godam ka
function uidSave() {   // staffDevices ke uid → staffId yaad (purane bhi, taake dobara login par hisaab na toote) — sirf malik, sirf naye
  if (!isOwn() || !cloud?.setLblUids) return; const u = lbl.u || {}, add = {};
  for (const d of devs) { const uid = String(d.by || ''), sid = String(d.staffId || ''); if (!uid || !sid) continue; const o = u[uid]; if (!o || o.s !== sid || (d.name && o.n !== String(d.name).slice(0, 40))) add[uid] = { s: sid, n: String(d.name || o?.n || '').slice(0, 40) }; }
  const me = String(myUid() || ''); if (me && (u[me]?.s !== 'malik')) add[me] = { s: 'malik', n: 'Malik' };   // larke ki app bhi malik ke label pehchane
  if (Object.keys(add).length) cloud.setLblUids(add).catch(() => {});
}
function whoOf(j) {
  const uid = String(j.by || '');
  if (uid && uid === myUid() && isOwn()) return { k: 'malik', n: 'Malik' };
  const d = devs.find(x => String(x.by || '') === uid && x.staffId), o = (lbl.u || {})[uid];
  if (d) return { k: String(d.staffId), n: String(d.name || o?.n || 'Mulazim') };
  if (o?.s) return { k: String(o.s), n: String(o.n || 'Mulazim') };
  return { k: 'u:' + uid.slice(0, 8), n: uid ? 'Pata nahi (' + uid.slice(0, 4) + ')' : 'Pata nahi' };
}
const godamOf = j => { const g = (lbl.g || {})[whoOf(j).k]; return g == null ? 'x' : Number(g); };
const gName = b => b === 'x' ? '❓ Pata nahi' : (godamsOf().find(x => x.b === Number(b))?.name || 'Godam ' + b);
const printed = j => j.status === 'done' ? Math.max(1, Number(j.copies) || Number(j.total) || 1) : ['failed', 'cancelled', 'skipped'].includes(j.status) ? Math.max(0, Math.min(Number(j.sent) || 0, Number(j.total) || Number(j.copies) || 0)) : 0;
const jobDay = j => j.day || dayOf(Number(j.doneAt) || Number(j.at) || 0);
function inRange(j) { const t = Number(j.doneAt) || Number(j.at) || 0; return t >= fromMs() && t < toMs(); }
function build() {
  const q = fQ.trim().toLowerCase();
  const items = new Map((itemsOf() || []).map(r => [String(r.id), r]));
  const sel = pool().filter(inRange).filter(j => fG === '' || String(godamOf(j)) === String(fG))
    .filter(j => fS === 'all' ? true : fS === 'done' ? j.status === 'done' : fS === 'wait' ? (j.status === 'new' || j.status === 'printing') : (j.status === 'failed' || j.status === 'skipped' || j.status === 'cancelled'))
    .filter(j => !q || smartHit([j.name, j.code, items.get(String(j.itemId))?.name].join(' '), q));
  const days = new Map();
  for (const j of sel) {
    const d = jobDay(j); if (!days.has(d)) days.set(d, new Map());
    const im = days.get(d), key = String(j.itemId || j.name);
    const it = items.get(String(j.itemId));
    if (!im.has(key)) im.set(key, { name: it?.name || j.name || 'Item', mainCode: String(it?.code || ''), codes: new Map(), labels: 0, pieces: 0 });
    const row = im.get(key), code = String(j.code || '');
    if (!row.codes.has(code)) row.codes.set(code, { code, qty: Number(j.qty) || 1, rate: Number(j.rate) || 0, labels: 0, jobs: 0, nums: [], sub: row.mainCode ? code !== row.mainCode : false, fail: 0 });
    const c = row.codes.get(code), n = Math.max(1, Number(j.copies) || 1);
    c.labels += n; c.jobs += 1; if (j.numFrom != null && j.numTo != null) c.nums.push((j.numCode || '') + j.numFrom + '–' + j.numTo);
    if (j.status === 'failed' || j.status === 'skipped') c.fail += n;
    row.labels += n; row.pieces += n * (Number(j.qty) || 1);
  }
  const out = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, im]) => {
    const rows = [...im.values()].map(r => ({ ...r, codes: [...r.codes.values()].sort((a, b) => (a.sub - b.sub) || (a.qty - b.qty)) })).sort((a, b) => b.labels - a.labels);
    return { day: d, rows, labels: rows.reduce((n, r) => n + r.labels, 0), pieces: rows.reduce((n, r) => n + r.pieces, 0), subs: rows.reduce((n, r) => n + r.codes.filter(c => c.sub).reduce((m, c) => m + c.labels, 0), 0) };
  });
  return { days: out, labels: out.reduce((n, d) => n + d.labels, 0), items: new Set(out.flatMap(d => d.rows.map(r => r.name))).size, subs: out.reduce((n, d) => n + d.subs, 0), jobs: sel.length, pay: payOf(items, q) };
}
// 💰 asal chhape label (status chip se azad) — barcode / sub · larka-war · paisa
function payOf(items, q) {
  const rb = Math.max(0, Number(lbl.rb) || 0), rs = Math.max(0, Number(lbl.rs) || 0), per = new Map(); let B = 0, S = 0;
  for (const j of pool()) { if (!inRange(j)) continue; const g = godamOf(j); if (fG !== '' && String(g) !== String(fG)) continue;
    if (q && !smartHit([j.name, j.code, items.get(String(j.itemId))?.name].join(' '), q)) continue;
    const n = printed(j); if (!n) continue;
    const it = items.get(String(j.itemId)), main = String(it?.code || ''), sub = main ? String(j.code || '') !== main : false, w = whoOf(j);
    if (sub) S += n; else B += n;
    const o = per.get(w.k) || { k: w.k, n: w.n, g, b: 0, s: 0 }; if (sub) o.s += n; else o.b += n; per.set(w.k, o); }
  const P = [...per.values()].map(o => ({ ...o, rs: o.b * rb + o.s * rs })).sort((a, b) => (b.b + b.s) - (a.b + a.s));
  return { B, S, rb, rs, rsB: B * rb, rsS: S * rs, total: B * rb + S * rs, per: P };
}
export function renderBarcode() {
  watch();
  $('summary').innerHTML = '<div class="bc-root" id="bcRoot"></div>';
  if ($('list')) $('list').innerHTML = '';
  $('actions').innerHTML = '<button class="got" data-bc-pdf="1">📄 PDF · WhatsApp</button>';
  paint();
}
const codeLine = c => `<div class="bc-code${c.sub ? ' sub' : ''}"><span class="bc-tag">${c.sub ? 'SUB' : 'MAIN'}</span><span class="bc-num">${esc(c.code)}</span><span class="bc-pack">📦 ${num(c.qty)} wala</span>${c.rate ? `<span class="bc-rate">Rs ${num(c.rate)}</span>` : ''}<b class="bc-cnt">× ${num(c.labels)}</b>${c.fail ? `<span class="bc-fail">⚠️ ${num(c.fail)} fail</span>` : ''}${c.nums.length ? `<small class="bc-nums">#${esc(c.nums.slice(0, 4).join(', '))}${c.nums.length > 4 ? '…' : ''}</small>` : ''}</div>`;
const cxLocal = new Map();   // v2.98.8: abhi cancel dabaya (id -> waqt) — snapshot aane se pehle bhi "cancel ho raha" dikhe
const isCx = j => !!j.cancelReq || (cxLocal.has(j.id) && Date.now() - cxLocal.get(j.id) < 3 * 60000);
const isStuck = (j, now) => j.status === 'printing' && now - (Number(j.beatAt) || Number(j.pickedAt) || Number(j.at) || 0) > 3 * 60000;
// v2.99.74: 🔁 kharab nikle labels dobara — sirf utne (naye number ke saath). Mulazim: Settings → Mulazim → Stock → 'stock.lblagain'
const lvJobs = new Map(), agVals = new Map();   // agVals: likhi hui ginti (live patti dobara bane to bhi rahe)
document.addEventListener('input', e => { const t = e.target; if (t?.dataset?.lvN) agVals.set(t.dataset.lvN, t.value); });
const canAgain = () => { try { return typeof window.ntCan === 'function' ? window.ntCan('stock.lblagain') : true; } catch { return true; } };
// v2.103.25: ▶ BAQI CHHAPO — printer ruk gaya / cancel / fail ho to sirf baqi labels (agle number se). Mulazim CAP 'stock.lblbaqi'
const canBaqi = () => { try { return typeof window.ntCan === 'function' ? window.ntCan('stock.lblbaqi') : true; } catch { return true; } };
const baqiOf = j => { const tot = Number(j.total) || Number(j.copies) || 0, s = Math.max(0, Number(j.sent) || 0); return ['failed', 'cancelled'].includes(j.status) && !j.baqiSent && tot > s ? tot - s : 0; };
const baqiDone = new Set();
const againHTML = j => `<div class="lv-ag"><small>Kharab nikle?</small><input type="number" min="1" max="200" step="1" inputmode="numeric" placeholder="3" value="${esc(agVals.get(j.id) || '')}" data-lv-n="${esc(j.id)}" aria-label="Kitne label dobara"><button type="button" data-lv-again="${esc(j.id)}">🔁 Dobara chhapo</button></div>`;
export function liveLabelsHTML(list, opts = {}) {   // v2.97: pos-stock bhi istemal karta hai
  const now = Date.now(), L = (list || []).filter(j => j && j.id);
  for (const j of L) lvJobs.set(j.id, j); if (lvJobs.size > 400) { const k = [...lvJobs.keys()].slice(0, 200); k.forEach(x => lvJobs.delete(x)); }
  const ag = canAgain();
  const act = L.filter(j => j.status === 'new' || j.status === 'printing').sort((a, b) => (a.status === 'printing' ? 0 : 1) - (b.status === 'printing' ? 0 : 1) || (Number(a.at) || 0) - (Number(b.at) || 0));
  const fin = opts.noRecent ? [] : L.filter(j => ['done', 'cancelled', 'failed', 'skipped'].includes(j.status) && now - (Number(j.doneAt) || 0) < (j.status === 'done' ? 30 : 10) * 60000).sort((a, b) => (Number(b.doneAt) || 0) - (Number(a.doneAt) || 0)).slice(0, 5);
  if (!act.length && !fin.length) return '';
  let n = 0;
  const row = j => { const tot = Number(j.total) || Number(j.copies) || 1, sent = Math.min(tot, Number(j.sent) || 0), pr = j.status === 'printing', cx = isCx(j), st = isStuck(j, now), sk = pr && j.stuck && j.stuck.why ? j.stuck : null, bq = canBaqi() && !baqiDone.has(j.id) ? baqiOf(j) : 0;
    return `<div class="lv-row ${j.status}${cx ? ' cx' : ''}${st ? ' stuck' : ''}" data-lv-id="${esc(j.id)}"><div class="lv-t"><b>${esc(j.name || 'Item')}</b><small>${esc(j.code || '')}${Number(j.qty) > 1 ? ' · ' + num(j.qty) + ' wala' : ''}</small></div>
      <div class="lv-s">${cx && (pr || j.status === 'new') ? '<em class="cx">✕ cancel ho raha…</em>' : st ? `<em class="stk">⚠ atka hua · ${num(sent)} / ${num(tot)}</em>` : sk ? `<em class="stk">⚠️ Printer ruk gaya — ${esc(sk.why)} · ${num(sent)} / ${num(tot)}</em><small class="lv-hint">Printer par FEED dabayein — chal pare to khud aage chhapega</small>` : pr ? `<em class="pr">🖨 ${num(sent)} / ${num(tot)}</em>` : j.status === 'new' ? `<em>⏳ line mein #${++n} · ${num(tot)}</em>` : j.status === 'done' ? `<em class="ok">✓ ${num(tot)} chhap gaye</em>` : j.status === 'cancelled' ? `<em class="cx">✕ cancel${Number(j.sent) ? ' · ~' + num(j.sent) + ' chhape' : ''}</em>` : `<em class="bad">⚠ ${esc(j.error || j.status)}</em>`}
      ${pr && !st ? `<i class="lv-bar"><u style="width:${Math.round(sent / tot * 100)}%"></u></i>` : ''}</div>
      ${(pr || j.status === 'new') && !cx ? `<button type="button" class="lv-x" data-lv-cancel="${esc(j.id)}">✕ Cancel</button>` : ''}${j.status === 'done' && ag ? againHTML(j) : ''}${bq ? `<button type="button" class="lv-bq" data-lv-baqi="${esc(j.id)}">▶ Baqi chhapo (${num(Math.min(200, bq))})</button>` : ''}</div>`; };
  const open = act.filter(j => !isCx(j));
  return `<div class="lv-box"><div class="lv-h"><b>🖨 Label printer — abhi</b>${open.length > 1 ? `<button type="button" class="lv-x all" data-lv-cancel="${open.map(j => esc(j.id)).join(',')}">✕ Sab cancel</button>` : ''}</div>${act.map(row).join('')}${fin.map(row).join('')}</div>`;
}
function paint() {
  const root = $('bcRoot'); if (!root) return;
  const r = build(), own = isOwn(), G = godamsOf(), P = r.pay, unk = pool().some(j => inRange(j) && godamOf(j) === 'x');
  const mn = (k, i, t, a, on) => `<button type="button"${on ? ' class="is-in"' : ''} data-mn="${k}" data-mn-i="${i}" data-mn-t="${esc(t)}" data-mn-g="🏷 Barcode" ${a}>${i} ${esc(t)}</button>`;
  const gl = fG === '' ? '🏬 Sab godam' : gName(fG), sl = { done: '✓ Chhap gaye', wait: '⏳ Line mein', bad: '⚠️ Fail / cancel', all: 'Sab' }[fS];
  const pl = fP === 'cus' ? `📅 ${cus.a || '…'} → ${cus.b || '…'}` : PL[fP];
  const chips = `<button type="button" class="bc-pat" data-mn-sheet="1">${esc(gl)} · ${esc(pl)} · ${esc(sl)} — ⋮ se badlein</button>
    <div class="bc-mn">${[['', '🏬', 'Sab godam'], ...G.map(g => [String(g.b), g.b === 1 ? '🏪' : '🏬', g.name]), ...(unk ? [['x', '❓', 'Pata nahi (larka chunein ⚙️)']] : [])].map(([k, i, t]) => mn('bc.g' + (k || 'all'), i, t, `data-bc-f="${esc(k)}"`, String(fG) === k)).join('')}
      ${Object.entries(PL).map(([k, t]) => mn('bc.p' + k, '📅', t, `data-bc-p="${k}"`, fP === k)).join('')}
      ${[['done', '✓', 'Chhap gaye'], ['wait', '⏳', 'Line mein'], ['bad', '⚠️', 'Fail / cancel'], ['all', '📋', 'Sab']].map(([k, i, t]) => mn('bc.s' + k, i, t, `data-bc-s="${k}"`, fS === k)).join('')}
      ${own ? mn('bc.set', '⚙️', 'Mazdoori rate + larkon ki godam', 'data-bc-set="1"', setOn) : ''}</div>
    ${fP === 'cus' ? `<div class="bc-cus"><label>Se<input type="date" data-bc-da="1" value="${esc(cus.a)}" max="${dayOf()}"></label><label>Tak<input type="date" data-bc-db="1" value="${esc(cus.b)}" max="${dayOf()}"></label></div>` : ''}`;
  const rs = n => 'Rs ' + num(n);
  const pay = paisaOn() ? `<div class="bc-pay"><div class="bc-pk"><div><b>${num(P.B)}</b><small>🏷 Barcode label</small></div><div><b>${num(P.S)}</b><small>🔖 Sub-barcode</small></div><div><b>${num(P.B + P.S)}</b><small>Kul (asal chhape)</small></div></div>
      ${P.rb || P.rs ? `<div class="bc-rs"><span>💰 Mazdoori</span><b>${rs(P.total)}</b><small>${num(P.B)} × Rs ${num(P.rb)} + ${num(P.S)} × Rs ${num(P.rs)}</small></div>` : own ? '<button type="button" class="bc-rsno" data-bc-set="1">⚙️ Mazdoori ka rate likhein — phir paisa yahan</button>' : ''}
      ${P.per.length ? `<div class="bc-who">${P.per.map(o => `<div class="bc-wr"><span class="bc-wn"><b>${esc(o.n)}</b><small>${esc(gName(o.g))}</small></span><span class="bc-wc">🏷 ${num(o.b)} · 🔖 ${num(o.s)}</span>${P.rb || P.rs ? `<b class="bc-wrs">${rs(o.rs)}</b>` : ''}</div>`).join('')}</div>` : ''}
      ${extra === 'wait' ? '<small class="bc-wait">⏳ purana data aa raha hai…</small>' : ''}</div>` : '';
  const people = () => { const m = new Map(); for (const j of [...jobs, ...(Array.isArray(extra) ? extra : [])]) { const w = whoOf(j); if (!m.has(w.k)) m.set(w.k, w); } return [...m.values()].sort((a, b) => a.n.localeCompare(b.n)); };
  const set = own && setOn ? `<div class="bc-set"><b>💰 Mazdoori ka rate (fi label)</b>
      <div class="bc-rates"><label>🏷 Barcode<span>Rs</span><input type="number" min="0" step="any" inputmode="decimal" data-bc-rb="1" value="${esc(lbl.rb ?? '')}" placeholder="0"></label>
        <label>🔖 Sub-barcode<span>Rs</span><input type="number" min="0" step="any" inputmode="decimal" data-bc-rs="1" value="${esc(lbl.rs ?? '')}" placeholder="0"></label><button type="button" class="bc-rsave" data-bc-rsave="1">💾 Save</button></div>
      <b>🏬 Kis larke ke label kis godam ke?</b><small>Printer ek hai (TSC 244 Pro) — jis larke ne chhape, us ki godam. Ek dafa chunein, purana data bhi.</small>
      <div class="bc-ppl">${people().map(w => { const cur = (lbl.g || {})[w.k]; return `<div class="bc-pr"><b>${esc(w.n)}</b><span>${G.map(g => `<button type="button" class="${Number(cur) === g.b ? 'is-in' : ''}" data-bc-asg="${esc(w.k)}|${g.b}">${esc(g.name)}</button>`).join('')}<button type="button" class="${cur == null ? 'is-in' : ''}" data-bc-asg="${esc(w.k)}|">—</button></span></div>`; }).join('') || '<small>Abhi kisi ne label nahi chhape</small>'}</div></div>` : '';
  root.innerHTML = liveLabelsHTML(jobs) + `<div class="bc-head">${chips}${set}${pay}
    <label class="hs-search"><input type="search" placeholder="🔍 item ya barcode…" value="${esc(fQ)}" data-bc-q="1"></label>
    <div class="bc-kpis"><div><b>${num(r.labels)}</b><small>label</small></div><div><b>${num(r.items)}</b><small>items</small></div><div><b>${num(r.subs)}</b><small>sub-barcode</small></div><div><b>${num(r.jobs)}</b><small>hukum</small></div></div></div>
    ${r.days.map(d => `<div class="bc-day"><div class="bc-dayhead"><b>${esc(nice(d.day))}</b><span>${num(d.labels)} label · ${d.rows.length} items${d.subs ? ' · ' + num(d.subs) + ' sub' : ''}</span></div>
      ${d.rows.map(row => { const k = d.day + '|' + row.name, op = open.has(k) || d.rows.length <= 6;
        return `<div class="bc-item${op ? ' open' : ''}"><button type="button" class="bc-ihead" data-bc-open="${esc(k)}"><b>${esc(row.name)}</b><span class="bc-ichips">${row.codes.map(c => `<i class="${c.sub ? 'sub' : ''}">${num(c.qty)}×${num(c.labels)}</i>`).join('')}</span><b class="bc-cnt">${num(row.labels)}</b></button>${op ? `<div class="bc-codes">${row.codes.map(codeLine).join('')}</div>` : ''}</div>`; }).join('')}</div>`).join('')
      || `<div class="nt-empty">🏷<b>Is waqt mein koi label nahi</b><small>Stock screen se label chhapwayein — yahan khud aa jayega</small></div>`}`;
}
function pdfHTML() {
  const r = build(), P = r.pay, when = fP === 'cus' ? `${cus.a} se ${cus.b}` : { today: 'Aaj', kal: 'Kal', '7': 'Pichhle 7 din', '30': 'Pichhle 30 din', mon: 'Is mahina', pmon: 'Pichhla mahina' }[fP];
  const payT = paisaOn() ? `<h3>💰 ${esc(fG === '' ? 'Sab godam' : gName(fG))} — asal chhape label</h3><table class="iv-tbl"><thead><tr><th>Larka</th><th>Godam</th><th>Barcode</th><th>Sub</th>${P.rb || P.rs ? '<th>Rs</th>' : ''}</tr></thead><tbody>
      ${P.per.map(o => `<tr><td class="iv-item"><b>${esc(o.n)}</b></td><td>${esc(gName(o.g).replace(/^❓ /, ''))}</td><td class="iv-n">${num(o.b)}</td><td class="iv-n">${num(o.s)}</td>${P.rb || P.rs ? `<td class="iv-n"><b>${num(o.rs)}</b></td>` : ''}</tr>`).join('')}
      <tr><td class="iv-item"><b>Kul</b></td><td></td><td class="iv-n"><b>${num(P.B)}</b></td><td class="iv-n"><b>${num(P.S)}</b></td>${P.rb || P.rs ? `<td class="iv-n"><b>${num(P.total)}</b></td>` : ''}</tr></tbody></table>
      ${P.rb || P.rs ? `<p><b>Mazdoori: ${num(P.B)} × Rs ${num(P.rb)} + ${num(P.S)} × Rs ${num(P.rs)} = Rs ${num(P.total)}</b></p>` : ''}` : '';
  return `<h1>NOOR TRADERS</h1><h2>🏷 Barcode report — ${esc(when)}${fG === '' ? '' : ' · ' + esc(gName(fG).replace(/^❓ /, ''))} (${esc({ done: 'chhap gaye', wait: 'line mein', bad: 'fail', all: 'sab' }[fS])})</h2>
    <p>${num(r.labels)} label · ${num(r.items)} items · ${num(r.subs)} sub-barcode · ${esc(new Date().toLocaleString('en-PK'))}</p>${payT}
    ${r.days.map(d => `<h3>${esc(d.day)} — ${num(d.labels)} label</h3><table class="iv-tbl"><thead><tr><th>Item</th><th>Barcode</th><th>Packet</th><th>Label</th></tr></thead><tbody>
      ${d.rows.map(row => row.codes.map((c, i) => `<tr><td class="iv-item">${i ? '' : '<b>' + esc(row.name) + '</b>'}</td><td>${c.sub ? 'SUB ' : ''}${esc(c.code)}</td><td class="iv-n">${num(c.qty)}</td><td class="iv-n"><b>${num(c.labels)}</b></td></tr>`).join('') + `<tr><td></td><td></td><td class="iv-n"><small>kul</small></td><td class="iv-n"><b>${num(row.labels)}</b></td></tr>`).join('')}
      </tbody></table>`).join('')}`;
}
document.addEventListener('click', async e => {
  const ab = e.target.closest?.('[data-lv-again]');   // v2.99.74: 🔁 kharab label dobara
  if (ab) { const id = ab.dataset.lvAgain, j = lvJobs.get(id); if (!j || !cloud?.requestLabel) { notice('Label ke liye app update karein'); return; }
    if (!canAgain()) { notice('Is kaam ki ijazat nahi — malik se kahein'); return; }
    const box = ab.closest('.lv-ag'), inp = box?.querySelector('[data-lv-n]'), n = Math.floor(Number(inp?.value) || 0);
    if (!(n >= 1 && n <= 200)) { notice('Kitne label kharab nikle? 1 se 200 tak likhein'); inp?.focus(); return; }
    if (!confirm(`${n} label dobara chhapein?\n${j.name || ''} · ${j.code || ''}\n(naye number ke saath)`)) return;
    ab.disabled = true; ab.textContent = '⏳ Bhej rahe…';
    try { await cloud.requestLabel({ itemId: j.itemId, code: j.code, name: j.name, qty: Number(j.qty) || 1, rate: Number(j.rate) || 0, copies: n });
      ab.textContent = '✓ Bhej diya'; if (inp) inp.value = ''; agVals.delete(id); notice(`🔁 ${n} label dobara line mein — ${j.name || ''}`); }
    catch (er) { ab.disabled = false; ab.textContent = '🔁 Dobara chhapo'; alert('Dobara nahi gaya: ' + (er?.message || er)); }
    setTimeout(() => { if (ab.isConnected) { ab.disabled = false; ab.textContent = '🔁 Dobara chhapo'; } }, 4000);
    return; }
  const bb = e.target.closest?.('[data-lv-baqi]');   // v2.103.25: ▶ baqi chhapo
  if (bb) { const id = bb.dataset.lvBaqi, j = lvJobs.get(id); if (!j || !cloud?.requestLabel) { notice('Label ke liye app update karein'); return; }
    if (!canBaqi()) { notice('Is kaam ki ijazat nahi — malik se kahein'); return; }
    const n = Math.min(200, baqiOf(j)); if (!n) return;
    if (!confirm(`Baqi ${n} label chhapein?\n${j.name || ''} · ${j.code || ''}\n(agle number se — pehle wale dobara nahi)`)) return;
    bb.disabled = true; bb.textContent = '⏳ Bhej rahe…';
    try { await cloud.requestLabel({ itemId: j.itemId, code: j.code, name: j.name, qty: Number(j.qty) || 1, rate: Number(j.rate) || 0, copies: n, ...(j.batch ? { batch: j.batch } : {}) });
      baqiDone.add(id); bb.textContent = '✓ Line mein'; notice(`▶ Baqi ${n} label line mein — ${j.name || ''}`); }
    catch (er) { bb.disabled = false; bb.textContent = `▶ Baqi chhapo (${n})`; alert('Nahi gaya: ' + (er?.message || er)); }
    return; }
  const cx = e.target.closest?.('[data-lv-cancel]');
  if (cx) { const ids = String(cx.dataset.lvCancel || '').split(',').filter(Boolean); if (!ids.length || !cloud?.cancelLabel) return;
    if (!confirm(ids.length > 1 ? `${ids.length} label hukum cancel karein?` : 'Ye label cancel karein? (jo printer mein pohanch chuke, woh 10-20 nikal sakte hain)')) return;
    cx.disabled = true; let ok = 0, bad = '';
    // v2.98.8: dabate hi row par "cancel ho raha" (jawab ka intezar nahi); nakam ho to wapas + BARA alert
    const mark = (id, on) => { if (on) cxLocal.set(id, Date.now()); else cxLocal.delete(id);
      document.querySelectorAll(`.lv-row[data-lv-id="${CSS.escape(id)}"]`).forEach(r => { r.classList.toggle('cx', on);
        const sEl = r.querySelector('.lv-s'), b = r.querySelector('.lv-x'); if (on) { if (sEl) { r._lvS = sEl.innerHTML; sEl.innerHTML = '<em class="cx">✕ cancel ho raha…</em>'; } if (b) b.style.display = 'none'; } else { if (sEl && r._lvS != null) sEl.innerHTML = r._lvS; if (b) { b.style.display = ''; b.disabled = false; } } }); };
    ids.forEach(id => mark(id, true)); if (ids.length > 1) cx.style.display = 'none';
    for (const id of ids) { try { await cloud.cancelLabel(id); ok++; } catch (er) { mark(id, false); bad = /permission/i.test(String(er?.code || er?.message)) ? 'rules' : String(er?.message || er); } }
    if (bad) { cx.disabled = false; cx.style.display = '';
      alert(bad === 'rules' ? '✕ Cancel NAHI hua — Firebase rules 2.34 publish nahi hue.\n\nMalik: app ka "firestore-rules-2.34.html" page khol kar Copy → Firebase Console → Firestore → Rules mein paste → Publish.'
        : '✕ Cancel NAHI hua: ' + bad + '\n\nInternet check karein aur dobara dabayein.'); }
    if (ok) notice(`✕ Cancel bhej diya${ok > 1 ? ' (' + ok + ')' : ''} — PC foran rok dega (jo printer mein pohanch chuke, 10-20 nikal sakte hain)`); return; }
  if (e.target.closest?.('[data-bc-pdf]')) { const r = build(); if (!r.labels) { notice('Is waqt mein koi label nahi'); return; } if (pdfOf) pdfOf(pdfHTML(), 'Barcode report ' + dayOf()); return; }
  if (!$('bcRoot')) return;
  const t = e.target.closest?.('[data-bc-p],[data-bc-s],[data-bc-open],[data-bc-f],[data-bc-set],[data-bc-rsave],[data-bc-asg]'); if (!t) return;
  const d = t.dataset;
  if (d.bcP) { fP = d.bcP; if (fP === 'cus' && !cus.a) cus = { a: dayOf(back(6)), b: dayOf() }; wantExtra(); paint(); return; }
  if (d.bcF != null) { fG = d.bcF; paint(); return; }
  if (d.bcSet) { setOn = !setOn; paint(); if (setOn) setTimeout(() => $('bcRoot')?.querySelector('.bc-set')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 60); return; }
  if (d.bcRsave) { const rb = Number($('bcRoot')?.querySelector('[data-bc-rb]')?.value), rsv = Number($('bcRoot')?.querySelector('[data-bc-rs]')?.value);
    if (!(rb >= 0) || !(rsv >= 0)) { notice('Rate sahi likhein (0 ya zyada)'); return; }
    try { await cloud.setLblRate(rb, rsv); lbl = { ...lbl, rb, rs: rsv }; notice(`💾 Mazdoori: barcode Rs ${num(rb)} · sub-barcode Rs ${num(rsv)}`); paint(); } catch (er) { notice('Save nahi hua: ' + (er?.message || er)); } return; }
  if (d.bcAsg) { const [k, b] = d.bcAsg.split('|'); const v = b === '' ? null : Number(b);
    lbl = { ...lbl, g: { ...(lbl.g || {}) } }; if (v == null) delete lbl.g[k]; else lbl.g[k] = v; paint();   // foran (server baad mein)
    try { await cloud.setLblGodam(k, v); } catch (er) { notice('Save nahi hua: ' + (er?.message || er)); } return; }
  if (d.bcS) { fS = d.bcS; paint(); return; }
  if (d.bcOpen) { if (open.has(d.bcOpen)) open.delete(d.bcOpen); else open.add(d.bcOpen); paint(); }
});
document.addEventListener('change', e => { const t = e.target; if (!t?.matches?.('[data-bc-da],[data-bc-db]')) return; if (t.dataset.bcDa) cus.a = t.value || ''; else cus.b = t.value || ''; if (cus.a && cus.b && cus.a > cus.b) [cus.a, cus.b] = [cus.b, cus.a]; wantExtra(); paint(); });
document.addEventListener('input', e => { if (e.target.matches?.('[data-bc-q]')) { fQ = e.target.value || ''; paint(); const q = document.querySelector('[data-bc-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } } });
