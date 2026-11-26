// =========================================================
//  ws-wa.js v1.0 (2026-11-26, app v2.388.0) — 📦 WHOLESALE BILL → MALIK KA WHATSAPP (foran)
//  malik: "wholesale ke all bills mujhe mere number par WhatsApp mein bhi chahiye — jaise hi bill bane / scan ho, tadad · rate waghera · total aa jaye".
//  pos-sales-dekho.js (server) har badlaav par feed(day, rows) deta hai — sirf cache ki qataron ka hawala (bill ka raasta kabhi nahi rukta). Yahan apni line (har 1 s):
//    naya 'whole sale' party ka bill (cancel nahi) 4 s tak wahi (total + line ginti) = POS se us ki lines (SELECT, sirf parhna) → waOut rp-ws-<SaleID>
//    {kind 'rem', to = blueAccess/waParchi.prFrom[0] = malik} → wa-out (dukan ka Business number; malik = tez line). 'rp-' = paigham par reply "print" = thermal.
//    Bhejne ke baad: total / lines badle = "✏️ BADLA" (kya badla + nayi list, 5 dafa tak) · cancel = "⛔" · party badli = "↪" · din ki list se gayab (10 s, 2 jaanch) = "🗑".
//  Setting: blueAccess/reportConfig.waWs (na ho = ON; app 📊 Reports mere number par). Band = naye bill chup-chaap "off" (dobara ON par purane ka sailaab nahi).
//  Pehli dafa (ws-wa-state.json nahi) = us waqt maujood bill nahi bhejta. Number na ho = bill 2 ghante tak intezar, phir chhor. Haal: blueAccess/wsWa
//  {day, n, at, no, err, errAt, ver}. POS mein KUCH nahi likhta. AI NAHI.
// =========================================================
const fs = require('fs');
const path = require('path');

const VER = '1.0';
const WAIT = 4000;              // naya / badla bill itni der wahi rahe (POS likh raha ho)
const MAX_AGE = 2 * 3600000;    // is se purana na-bheja bill = chhor do (number der se laga ho to sailaab nahi)
const EDIT_MAX = 5;             // ek bill ke "badla" paigham
const KEEP = 4 * 86400000;      // state mein itne din
const MAX_LINES = 100;          // paigham mein items (baqi "… aur N")

const isWs = n => /whole\s*sale/i.test(String(n || ''));
const num = v => Math.round((Number(v) || 0) * 100) / 100;
const fmt = x => { const v = num(x); return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
const qty = x => { const v = Math.round((Number(x) || 0) * 1000) / 1000; return (v < 0 ? '−' : '') + String(Math.abs(v)); };
const tm12 = ms => { if (!ms) return ''; const d = new Date(ms); let h = d.getHours(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap; };
const RS = x => 'Rs ' + fmt(x);
const LINE = '────────────';

// ---------- paigham ki likhai (pure — test hoti hai) ----------
function headLine(b, at) {
  const a = [];
  const w = at || b.ct || b.tm; if (w) a.push('🕒 ' + tm12(w));
  if (b.pc) a.push('🖥 ' + b.pc);
  if (b.by) a.push('👦 ' + b.by);
  return a.join(' · ');
}
function partyLine(b) {
  const p = String(b.p || '').trim(), d = String(b.desc || '').trim();
  const out = [];
  if (p && !/^\s*whole\s*sale\s*$/i.test(p)) out.push('👤 ' + p);
  if (d && !/BK-APP/i.test(d)) out.push('📝 ' + d.slice(0, 80));
  return out;
}
function bodyLines(b, L) {
  const out = [LINE];
  L.slice(0, MAX_LINES).forEach((l, i) => { const [n, q, r] = l; out.push(`${i + 1}) ${n || '?'}: ${qty(q)} × ${fmt(r)} = *${fmt(q * r)}*`); });
  if (L.length > MAX_LINES) out.push(`… aur ${L.length - MAX_LINES} items (POS mein)`);
  out.push(LINE);
  const t = num(b.t), sum = num(L.reduce((s, l) => s + (Number(l[1]) || 0) * (Number(l[2]) || 0), 0)), df = num(t - sum);
  out.push(`Items ${L.length} · *Kul ${RS(t)}*`);
  if (L.length && Math.abs(df) >= 1) out.push(df < 0 ? `± Discount / gol: −${fmt(-df)} (items ka jor ${fmt(sum)})` : `± Bill items se zyada: +${fmt(df)} (items ka jor ${fmt(sum)})`);
  const c = num(b.c);
  if (b.cr || c < t - 0.5) out.push(`💵 Cash mila ${RS(c)} · 📒 Udhaar ${RS(Math.max(0, t - c))}`);
  return out;
}
function diffLines(oldL, newL) {
  const ag = L => { const m = new Map(); for (const [n, q, r] of L || []) { const k = String(n || '?'); const x = m.get(k) || { q: 0, r: 0 }; x.q = Math.round((x.q + (Number(q) || 0)) * 1000) / 1000; x.r = num(r); m.set(k, x); } return m; };
  const A = ag(oldL), B = ag(newL), out = [];
  for (const [k, b] of B) { const a = A.get(k); if (!a) out.push(`➕ ${k}: ${qty(b.q)} × ${fmt(b.r)}`); else if (Math.abs(a.q - b.q) > 0.0005 || Math.abs(a.r - b.r) > 0.004) out.push(`🔁 ${k}: ${qty(a.q)} × ${fmt(a.r)} → ${qty(b.q)} × ${fmt(b.r)}`); }
  for (const [k, a] of A) if (!B.has(k)) out.push(`➖ ${k}: ${qty(a.q)} × ${fmt(a.r)} (hata diya)`);
  return out.length > 12 ? [...out.slice(0, 12), `… aur ${out.length - 12} badlaav`] : out;
}
function txtNew(b, L) {
  return [`📦 *WHOLESALE BILL #${b.no || b.id}*`, headLine(b), ...partyLine(b), ...bodyLines(b, L)].filter(Boolean).join('\n');
}
function txtEdit(b, L, e, now) {
  const t0 = num(e.t), t1 = num(b.t), d = diffLines(e.L || [], L);
  return [`✏️ *WHOLESALE BILL #${b.no || b.id} BADLA*`, Math.abs(t1 - t0) >= 0.5 ? `Pehle ${RS(t0)} → ab *${RS(t1)}*` : `Total wahi: ${RS(t1)}`, headLine(b, now), ...partyLine(b),
    ...(d.length ? ['Kya badla:', ...d] : []), ...bodyLines(b, L)].filter(Boolean).join('\n');
}
function txtCancel(b, e) { return [`⛔ *WHOLESALE BILL #${b.no || e.no || b.id} CANCEL*`, `${RS(b.t != null ? b.t : e.t)}${b.pc ? ' · 🖥 ' + b.pc : ''} · bheja tha ${tm12(e.at)}`].join('\n'); }
function txtParty(b, e) { return [`↪ *BILL #${b.no || e.no} ab wholesale nahi*`, `Party: ${String(b.p || '?').trim()} · ${RS(b.t)}${b.pc ? ' · 🖥 ' + b.pc : ''} · bheja tha ${tm12(e.at)}`].join('\n'); }
function txtGone(e) { return [`🗑 *WHOLESALE BILL #${e.no || '?'} POS mein nahi raha*`, `(hata diya ya tareekh badli) · ${RS(e.t)} · bheja tha ${tm12(e.at)}`].join('\n'); }

// ---------- faisla (pure — test hota hai): state m + din ki qataren → kaam ----------
// e = {d din, seen, st (thehrav ka waqt), t, n, h (bheje hue ka nishan), L, at, no, p, e (badla ginti), x, pw, g, off, ct, cst, gone}
function plan(m, day, rows, now, on) {
  const jobs = [], byId = new Map();
  for (const r of rows || []) byId.set(String(r.SaleID), r);
  for (const [id, r] of byId) {
    const ws = isWs(r.PartyName), x = Number(r.DocStatusID) === 3, t = num(r.TotalSale), n = Number(r.N) || 0, e = m[id];
    if (!e) { if (ws && !x) m[id] = { d: day, seen: now, st: now, t, n }; continue; }
    e.gone = 0;
    if (e.off) continue;
    if (!e.h) {   // abhi bheja nahi
      if (!ws || x) { delete m[id]; continue; }   // intezar ke dauran cancel / party badli = bhool jao
      if (e.t !== t || e.n !== n) { e.t = t; e.n = n; e.st = now; continue; }   // POS abhi likh raha hai
      if (!n) continue;   // abhi koi item nahi — khali paigham nahi
      if (now - e.st < WAIT) continue;
      if (now - (e.seen || now) > MAX_AGE) { e.off = 1; continue; }
      if (!on) { e.off = 1; continue; }
      jobs.push({ id, r, kind: 'new' }); continue;
    }
    if (x) { if (!e.x) { if (on) jobs.push({ id, r, kind: 'cx' }); else e.x = 1; } continue; }
    if (!ws) { if (!e.pw) { if (on) jobs.push({ id, r, kind: 'party' }); else e.pw = 1; } continue; }
    if (e.t !== t || e.n !== n) {
      if ((e.e || 0) >= EDIT_MAX) continue;
      const k = t + '|' + n; if (e.ct !== k) { e.ct = k; e.cst = now; continue; }
      if (now - (e.cst || now) < WAIT) continue;
      if (!on) { e.t = t; e.n = n; continue; }
      jobs.push({ id, r, kind: 'edit' });
    }
  }
  for (const [id, e] of Object.entries(m)) {   // din ki list se gayab (POS se hata / tareekh badli)
    if (e.d !== day || byId.has(id) || !e.h || e.x || e.g || e.off) continue;
    if (!e.gone) { e.gone = now; continue; }
    if (now - e.gone >= 10000) { if (on) jobs.push({ id, r: null, kind: 'gone' }); else e.g = 1; }
  }
  return jobs;
}
function prune(m, now) { for (const [id, e] of Object.entries(m)) if (now - (Number(e.at) || Number(e.seen) || 0) > KEEP) delete m[id]; }

// ---------- chalana ----------
let O = null, S = null, F = null, on = true, to = '', cfgSeen = false, toSeen = false, busy = false, busyAt = 0, errLog = 0, lastErr = '', lastErrAt = 0, started = false;
const SF = () => path.join(O.DIR, 'ws-wa-state.json');
function load() { try { S = JSON.parse(fs.readFileSync(SF(), 'utf8')); } catch { S = null; } if (!S || typeof S !== 'object' || !S.m || typeof S.m !== 'object') S = { since: Date.now(), m: {}, fresh: 1 }; }
function save() { try { fs.writeFileSync(SF() + '.tmp', JSON.stringify(S)); fs.renameSync(SF() + '.tmp', SF()); } catch (e) { O.log('ws-wa state: ' + e.message); } }
const BA = () => O.db.collection('businesses').doc(O.BUSINESS_ID).collection('blueAccess');
async function status(p) { try { await BA().doc('wsWa').set({ ...p, ver: VER }, { merge: true }); } catch (e) { O.log('ws-wa haal: ' + e.message); } }
async function err(txt) { if (txt === lastErr && Date.now() - lastErrAt < 10 * 60000) return; lastErr = txt; lastErrAt = Date.now(); O.log('📦 ws-wa: ' + txt); await status({ err: txt, errAt: Date.now() }); }
async function linesOf(ids) {
  const p = await O.getPool(), rq = p.request();
  const ph = ids.map((id, i) => { rq.input('s' + i, O.sql.Int, Number(id)); return '@s' + i; });
  const rs = (await rq.query(`SELECT d.SaleID, d.SaleDetailID, i.ItemName, d.Qty, d.Rate FROM dbo.SaleDetail d LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID
    WHERE d.SaleID IN (${ph.join(',')}) ORDER BY d.SaleID, d.SaleDetailID`)).recordset;
  const by = new Map();
  for (const r of rs) { const k = String(r.SaleID); if (!by.has(k)) by.set(k, []); by.get(k).push([String(r.ItemName || '').trim().slice(0, 60), Math.round((Number(r.Qty) || 0) * 1000) / 1000, num(r.Rate)]); }
  return by;
}
async function put(id, txt) {
  try { await O.db.collection('businesses').doc(O.BUSINESS_ID).collection('waOut').doc(id).create({ st: 'new', at: Date.now(), to, nm: 'Malik', kind: 'rem', eid: id, txt }); return true; }
  catch (e) { if (/already exists|ALREADY_EXISTS/i.test(String(e.message || e)) || e.code === 6) return true; throw e; }
}
const billOf = r => { let b = {}; try { b = O.billOf ? O.billOf(r) || {} : {}; } catch {} return { id: r.SaleID, no: String(r.SaleNo || '').trim(), t: num(r.TotalSale), c: num(r.CashReceived), cr: r.IsCreditSale ? 1 : 0, p: String(r.PartyName || '').slice(0, 60), desc: String(r.Description || ''), tm: r.SaleDate ? new Date(r.SaleDate).getTime() : 0, ...b }; };
async function step() {
  const now = Date.now(), m = S.m, { day, rows } = F;
  if (S.fresh) {   // pehli dafa: jo bill abhi maujood hain un ka paigham nahi
    let k = 0; for (const r of rows || []) if (isWs(r.PartyName)) { m[String(r.SaleID)] = { d: day, off: 1, seen: now, at: now, t: num(r.TotalSale), n: Number(r.N) || 0 }; k++; }
    delete S.fresh; save(); O.log(`📦 ws-wa v${VER}: pehli dafa — aaj ke ${k} maujood wholesale bill chhore; ab se har naya bill malik ke WhatsApp par`); return;
  }
  const jobs = plan(m, day, rows, now, on);
  if (!jobs.length) { if (now - (S.pr || 0) > 3600000) { prune(m, now); S.pr = now; } if (now - (S.sv || 0) > 30000) { S.sv = now; save(); } return; }   // intezar wale bill bhi yaad (restart)
  if (!to) { await err('Malik ka WhatsApp number nahi mila (WhatsApp setting ① upar wala) — wholesale bill ruke hain'); return; }
  const work = jobs.slice(0, 4), need = work.filter(j => j.kind === 'new' || j.kind === 'edit').map(j => j.id);
  let LM = new Map(); if (need.length) LM = await linesOf(need);
  let sent = 0, lastNo = '';
  try { for (const j of work) {
    const e = m[j.id]; if (!e) continue;
    if (j.kind === 'new' || j.kind === 'edit') {
      const b = billOf(j.r), L = LM.get(j.id) || [], n = Number(j.r.N) || 0;
      if (L.length !== n) { if (j.kind === 'new') e.st = now; else e.cst = now; continue; }   // POS ne abhi saari lines nahi likhin — agla chakkar
      const h = JSON.stringify([b.t, L]);
      if (j.kind === 'edit' && h === e.h) { e.t = b.t; e.n = n; continue; }   // asal mein kuch nahi badla
      const k = j.kind === 'new' ? `rp-ws-${j.id}` : `rp-ws-${j.id}-e${(e.e || 0) + 1}`;
      await put(k, j.kind === 'new' ? txtNew(b, L) : txtEdit(b, L, e, now));
      if (j.kind === 'edit') e.e = (e.e || 0) + 1; else e.at = now;
      Object.assign(e, { h, L, t: b.t, n, no: b.no, p: b.p }); e.ct = ''; sent++; lastNo = b.no;
    } else if (j.kind === 'cx') { const b = billOf(j.r); await put(`rp-ws-${j.id}-x`, txtCancel(b, e)); e.x = 1; sent++; lastNo = b.no; }
    else if (j.kind === 'party') { const b = billOf(j.r); await put(`rp-ws-${j.id}-p`, txtParty(b, e)); e.pw = 1; sent++; lastNo = b.no; }
    else if (j.kind === 'gone') { await put(`rp-ws-${j.id}-g`, txtGone(e)); e.g = 1; sent++; lastNo = e.no || ''; }
  } } finally { save(); }
  if (sent) {
    const n = Object.values(m).filter(e => e.d === day && e.h && !e.off).length;
    O.log(`📦 Wholesale bill → WhatsApp: ${sent} paigham (#${lastNo}) · aaj ${n} bill`);
    lastErr = ''; await status({ day, n, at: Date.now(), no: lastNo, err: '', errAt: 0 });
  }
}
async function tick() {
  if (!started || !F || !S || !cfgSeen || !toSeen) return;
  if (busy) { if (Date.now() - busyAt > 120000) { O.log('📦 ws-wa: 2 min se atka — chhor kar dobara'); busy = false; } else return; }
  busy = true; busyAt = Date.now();
  try { await step(); } catch (e) { if (Date.now() - errLog > 60000) { errLog = Date.now(); O.log('📦 ws-wa masla: ' + e.message); } }
  finally { busy = false; }
}
function feed(day, rows) { F = { day, rows, at: Date.now() }; }
function start(opts) {
  if (started) return; O = opts; started = true; load();
  BA().doc('reportConfig').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}; on = d.waWs !== false; cfgSeen = true; }, e => { O.log('ws-wa setting: ' + e.message); cfgSeen = true; });
  BA().doc('waParchi').onSnapshot(s => { const d = s.exists ? s.data() || {} : {}, pf = Array.isArray(d.prFrom) ? d.prFrom : []; to = String(pf[0] || '').trim(); toSeen = true; }, e => { O.log('ws-wa number: ' + e.message); toSeen = true; });
  const g = typeof O.guard === 'function' ? O.guard(tick, 5 * 60000, 'wholesale WhatsApp') : tick;
  setInterval(g, 1000);
  O.log(`📦 ws-wa v${VER}: wholesale bill → malik ka WhatsApp (setting reportConfig.waWs)`);
}
module.exports = { start, feed, _t: { plan, txtNew, txtEdit, txtCancel, txtParty, txtGone, diffLines, bodyLines, isWs, prune, VER } };
