// =========================================================
//  post-pc.js v1.0 (2026-11-27, app v2.393.0) — 🧾 POSTING NIGRANI: DOOSRE PC SE BILL POST HUA = MALIK KO WHATSAPP
//  malik (photo: server par POS ki Sale list, 'waqar Logged In'): "es system ka ilawa agar koi aur system voucher posting mein involved ho to mujhe
//    WhatsApp par text chahiye — time, naam" · "POS har system ka naam likhta hai, kab kahan kis time bill post hota hai" · "chip PC script mein hi".
//  pos-sales-dekho.js (server) har badlaav par feed(day, rows) deta hai (sirf cache ka hawala — bill ka raasta kabhi nahi rukta). Yahan apni line (har 1 s):
//    posted bill (DocStatusID 2) ki SystemNotes mein POS ki posting wali line ('… Post… By:<login> On:<waqt> at PC:<host>') — aakhri posting line = wohi
//    posting (dobara post = nayi line = naya waqia). PC 'apna' na ho = qataar mein, 15 s (ya 12 bill) baad EK paigham (PC + login ke hisaab se) → waOut
//    rp-pp-<waqt> {kind 'rem', to = blueAccess/waParchi.prFrom[0] = malik} → wa-out (dukan ka Business number). Blue Khata / PC scripts ki apni posting = chup.
//  'Apna' system: blueAccess/postPc.ok [host, …] (malik, app Settings → 🖥️ PC scripts) · khali = pichhle 3 din mein SAB SE ZYADA posting wala PC (auto,
//    SELECT sirf parhna, har 6 ghante) · woh bhi na ho = yehi server PC. postPc.on false = sirf ginti, paigham nahi.
//  Haal: blueAccess/postPcSt {ver, at, day, ok, auto, own, hs JSON [[host, naam, aaj, aakhri, login, 3din]], al, la, nh, smp, err}. Posting line na mile
//    (POS ki likhai alag) = nh + namoona smp (app mein dikhta) — andaze se paigham KABHI nahi. POS mein KUCH nahi likhta. AI NAHI.
// =========================================================
const fs = require('fs');
const path = require('path');

const VER = '1.0';
const BATCH_MS = 15000;          // pehli posting ke baad itna intezar (ek saath kai bill = ek paigham)
const BATCH_MAX = 12;            // itne bill jama = foran bhejo
const MSG_LINES = 25;            // paigham mein bill (baqi "… aur N")
const KEEP = 3 * 86400000;
const SCAN_MS = 6 * 3600000;

const num = v => Math.round((Number(v) || 0) * 100) / 100;
const fmt = x => { const v = num(x); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
const tm12 = ms => { if (!ms) return ''; const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap; };
const isApp = by => /blue\s*khata/i.test(String(by || ''));

// ---------- POS ki likhai parhna (pure — test hota hai) ----------
// "Created & Printed By:waqar On:11/27/2026 12:40:10 PM at PC:DESKTOP-X" · "Posted By:waqar On:… at PC:DESKTOP-Y" (ek line mein kai bhi)
const ACT_RE = /([^\r\n]*?)(?:\bBy\s*:\s*([^\r\n]*?)\s+)?On\s*:\s*([^\r\n]*?)\s+at\s*PC\s*:\s*([A-Za-z0-9_.-]+)/gi;
function acts(sn) {
  const out = [];
  for (const m of String(sn || '').matchAll(ACT_RE)) {
    out.push({ a: String(m[1] || '').replace(/[\s:,;|-]+$/, '').trim().slice(0, 60), by: String(m[2] || '').trim().slice(0, 40), on: String(m[3] || '').trim(), host: String(m[4] || '').toUpperCase(), raw: m[0].trim().slice(0, 160) });
  }
  return out;
}
const isPost = x => /post/i.test(x.a) && !/un\s*-?\s*post/i.test(x.a);
function postLine(sn) { const A = acts(sn).filter(isPost); return A.length ? A[A.length - 1] : null; }
function allowed(host, ok) { const h = String(host || '').toUpperCase(); return (ok || []).some(x => { const k = String(x || '').toUpperCase(); return k === h || 'DESKTOP-' + k === h || k === 'DESKTOP-' + h; }); }

// ---------- faisla (pure): state + din ki qataren → nayi postings ----------
// m[id] = {d din, s posting line (nishan)} · nikalta hai [{id, r, P}] sirf un ki jin ki posting line NAYI hai
function plan(m, day, rows, fresh) {
  const out = [];
  for (const r of rows || []) {
    if (Number(r.DocStatusID) !== 2) continue;
    const id = String(r.SaleID), P = postLine(r.SystemNotes), sig = P ? P.raw : '?';
    const e = m[id];
    if (e && e.s === sig) continue;
    m[id] = { d: day, s: sig };
    if (fresh) continue;
    out.push({ id, r, P });
  }
  return out;
}
function prune(m, day) { const lim = Date.now() - KEEP; for (const [id, e] of Object.entries(m)) { const t = Date.parse(String(e.d || '') + 'T12:00:00'); if (!t || t < lim) delete m[id]; } }

// ---------- paigham (pure) ----------
function txtAlert(q, own, nameOf) {
  const groups = new Map();
  for (const x of q) { const k = x.host + '|' + (x.by || ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const out = ['⚠️ *DOOSRE SYSTEM SE POSTING*'];
  let n = 0, tot = 0, shown = 0;
  for (const [, L] of groups) {
    const g = L[0], nm = nameOf(g.host);
    out.push(`🖥 *${nm}*${nm.toUpperCase() !== g.host && !g.host.endsWith(nm.toUpperCase()) ? ' (' + g.host + ')' : ''}${g.by ? ' · 👤 ' + g.by : ''}`);
    for (const x of L) {
      n++; tot += num(x.t);
      if (shown < MSG_LINES) { shown++; out.push(`• ${tm12(x.at)} · Bill #${x.no || x.id} · Rs ${fmt(x.t)}${x.p && !/counter\s*sale/i.test(x.p) ? ' · ' + x.p : ''}`); }
    }
  }
  if (n > shown) out.push(`… aur ${n - shown} bill`);
  out.push(`Kul ${n} bill · Rs ${fmt(tot)}`);
  out.push(`(Apna system: ${own.map(nameOf).join(', ') || '?'} — app Settings → 🖥️ PC scripts se badlein)`);
  return out.join('\n');
}

// ---------- chalana ----------
let O = null, S = null, F = null, cfg = { on: true, ok: [] }, to = '', cfgSeen = false, toSeen = false, busy = false, busyAt = 0, started = false;
let auto = '', hs3 = {}, scanAt = 0, scanErr = '', lastSt = '', stAt = 0, errLog = 0;
const OWN = (() => { try { return require('os').hostname().toUpperCase(); } catch { return ''; } })();
const SF = () => path.join(O.DIR, 'post-pc-state.json');
function load() { try { S = JSON.parse(fs.readFileSync(SF(), 'utf8')); } catch { S = null; } if (!S || typeof S !== 'object' || !S.m || typeof S.m !== 'object') S = { since: Date.now(), m: {}, q: [], fresh: 1 }; if (!Array.isArray(S.q)) S.q = []; if (!S.t || typeof S.t !== 'object') S.t = { day: '', h: {}, al: 0, nh: 0 }; }
function save() { try { fs.writeFileSync(SF() + '.tmp', JSON.stringify(S)); fs.renameSync(SF() + '.tmp', SF()); } catch (e) { O.log('post-pc state: ' + e.message); } }
const BA = () => O.db.collection('businesses').doc(O.BUSINESS_ID).collection('blueAccess');
const nameOf = h => { let n = ''; try { n = O.pcName ? O.pcName(h) : ''; } catch {} return String(n || String(h || '').replace(/^DESKTOP-/i, '') || '?').slice(0, 30); };
function okList() { const L = Array.isArray(cfg.ok) ? cfg.ok.map(x => String(x || '').toUpperCase()).filter(Boolean) : []; return L.length ? L : (auto ? [auto] : (OWN ? [OWN] : [])); }

async function scan() {   // pichhle 3 din: kis PC se kitni posting (sirf parhna) — 'apna' ka andaza
  scanAt = Date.now();
  try {
    const p = await O.getPool(), d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 3);
    const rs = (await p.request().input('d', O.sql.DateTime, d).query(`SELECT TOP 4000 CAST(s.SystemNotes AS NVARCHAR(4000)) AS SN FROM dbo.Sale s
      WHERE s.SaleDate >= @d AND s.DocStatusID = 2 ORDER BY s.SaleID DESC`)).recordset;
    const c = {}; let none = 0, smp = '';
    for (const r of rs) { const P = postLine(r.SN); if (!P) { none++; if (!smp) smp = acts(r.SN).slice(-2).map(x => x.raw).join(' ⏎ ') || String(r.SN || '').replace(/\s+/g, ' ').slice(-160); continue; } if (isApp(P.by)) continue; c[P.host] = (c[P.host] || 0) + 1; }
    hs3 = c; const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    auto = top && top[1] >= 5 ? top[0] : '';
    scanErr = '';
    if (!Object.keys(c).length && rs.length) { S.t.smp = smp; O.log(`🧾 post-pc: 3 din ke ${rs.length} posted bill mein POS ki posting wali line (at PC) nahi mili — namoona: ${smp.slice(0, 120)}`); }
    else O.log(`🧾 post-pc: 3 din ki posting — ${Object.entries(c).map(([h, n]) => nameOf(h) + ' ' + n).join(' · ') || 'kuch nahi'}${auto ? ' · apna (auto) = ' + nameOf(auto) : ''}`);
  } catch (e) { scanErr = 'purani posting nahi parhi: ' + String(e.message || e).slice(0, 80); O.log('🧾 post-pc scan: ' + e.message); }
}
async function status(force) {
  const now = Date.now(), t = S.t, hs = [];
  for (const h of new Set([...Object.keys(t.h || {}), ...Object.keys(hs3)])) { const x = (t.h || {})[h] || {}; hs.push([h, nameOf(h), x.n || 0, x.at || 0, x.by || '', hs3[h] || 0]); }
  hs.sort((a, b) => (b[2] - a[2]) || (b[5] - a[5]));
  const st = { ver: VER, day: t.day || '', ok: okList(), auto, own: OWN, mine: Array.isArray(cfg.ok) && cfg.ok.length ? 1 : 0, on: cfg.on !== false ? 1 : 0, hs: JSON.stringify(hs.slice(0, 20)),
    al: t.al || 0, la: t.la || null, nh: t.nh || 0, smp: String(t.smp || '').slice(0, 200), q: S.q.length, err: String(t.err || scanErr || '').slice(0, 140) };
  const sig = JSON.stringify(st);
  if (!force && sig === lastSt && now - stAt < 10 * 60000) return;
  if (!force && now - stAt < 15000) return;
  lastSt = sig; stAt = now;
  try { await BA().doc('postPcSt').set({ ...st, at: now }); } catch (e) { O.log('post-pc haal: ' + e.message); }
}
async function put(id, txt) {
  try { await O.db.collection('businesses').doc(O.BUSINESS_ID).collection('waOut').doc(id).create({ st: 'new', at: Date.now(), to, nm: 'Malik', kind: 'rem', eid: id, txt }); return true; }
  catch (e) { if (/already exists|ALREADY_EXISTS/i.test(String(e.message || e)) || e.code === 6) return true; throw e; }
}
async function step() {
  const now = Date.now(), { day, rows } = F;
  if (S.t.day !== day) S.t = { day, h: {}, al: 0, nh: 0, smp: S.t.smp || '' };
  if (now - scanAt > SCAN_MS) await scan();
  const fresh = !!S.fresh, ok = okList(), on = cfg.on !== false;
  const nw = plan(S.m, day, rows, fresh);
  if (fresh) { delete S.fresh; save(); O.log(`🧾 post-pc v${VER}: pehli dafa — aaj ke maujood posted bill chhore; ab se doosre PC ki posting malik ke WhatsApp par`); await status(true); return; }
  for (const { id, r, P } of nw) {
    if (!P) { S.t.nh = (S.t.nh || 0) + 1; if (!S.t.smp) S.t.smp = acts(r.SystemNotes).slice(-2).map(x => x.raw).join(' ⏎ ') || String(r.SystemNotes || '').replace(/\s+/g, ' ').slice(-160); continue; }
    const at = (O.onTime ? O.onTime(P.raw, r.SaleDate) : 0) || now;
    const h = S.t.h[P.host] || (S.t.h[P.host] = { n: 0, at: 0, by: '' }); h.n++; if (at >= h.at) { h.at = at; h.by = P.by; }
    if (isApp(P.by) || allowed(P.host, ok) || !on) continue;
    S.q.push({ id, no: String(r.SaleNo || '').trim(), t: num(r.TotalSale), p: String(r.PartyName || '').trim().slice(0, 30), host: P.host, by: P.by, at, qa: now });
  }
  if (nw.length) save();
  if (S.q.length && (S.q.length >= BATCH_MAX || now - (Number(S.q[0].qa) || now) >= BATCH_MS)) {
    if (!to) { S.t.err = 'Malik ka WhatsApp number nahi mila (WhatsApp setting ① upar wala) — posting ka paigham ruka'; }
    else {
      const q = S.q.slice(0, 60), id = 'rp-pp-' + now;
      await put(id, txtAlert(q, ok, nameOf));
      S.q = S.q.slice(q.length); S.t.al = (S.t.al || 0) + 1; S.t.la = { at: now, host: q[0].host, n: q.length }; S.t.err = '';
      save(); O.log(`🧾 Doosre PC ki posting → WhatsApp: ${q.length} bill (${[...new Set(q.map(x => nameOf(x.host)))].join(', ')})`);
      await status(true); return;
    }
  }
  if (S.q.length && now - (Number(S.q[0].qa) || now) > 3 * 3600000) { S.q = []; save(); }   // 3 ghante number na mila = chhor (sailaab nahi)
  if (now - (S.pr || 0) > 3600000) { prune(S.m, day); S.pr = now; save(); }
  await status(false);
}
async function tick() {
  if (!started || !F || !S || !cfgSeen || !toSeen) return;
  if (busy) { if (Date.now() - busyAt > 120000) { O.log('🧾 post-pc: 2 min se atka — chhor kar dobara'); busy = false; } else return; }
  busy = true; busyAt = Date.now();
  try { await step(); } catch (e) { if (Date.now() - errLog > 60000) { errLog = Date.now(); O.log('🧾 post-pc masla: ' + e.message); } }
  finally { busy = false; }
}
function feed(day, rows) { F = { day, rows, at: Date.now() }; }
function start(opts) {
  if (started) return; O = opts; started = true; load();
  BA().doc('postPc').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}; cfg = { on: d.on !== false, ok: Array.isArray(d.ok) ? d.ok : [] }; cfgSeen = true; lastSt = ''; }, e => { O.log('post-pc setting: ' + e.message); cfgSeen = true; });
  BA().doc('waParchi').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}, pf = Array.isArray(d.prFrom) ? d.prFrom : []; to = String(pf[0] || '').trim(); toSeen = true; }, e => { O.log('post-pc number: ' + e.message); toSeen = true; });
  const g = typeof O.guard === 'function' ? O.guard(tick, 5 * 60000, 'posting nigrani') : tick;
  setInterval(g, 1000);
  O.log(`🧾 post-pc v${VER}: doosre PC ki posting → malik ka WhatsApp (setting blueAccess/postPc)`);
}
module.exports = { start, feed, _t: { acts, postLine, isPost, allowed, plan, txtAlert, VER } };
