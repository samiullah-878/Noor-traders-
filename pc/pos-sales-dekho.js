// =========================================================
//  pos-sales-dekho.js  v2.6 (2026-11-09: 🔴🧾 LIVE BILL — Live camera dekhte waqt us counter ka bante hue bill ki lines har 1 s posLive/<counter> mein (sirf parhna) · v2.5 (2026-11-09: 🎥 bill ki PEHLI ITEM ka waqt `ft` — POS har scan par SaleDetail likhta hai (save se pehle), PC har 1 s naye SaleID ki pehli line dekh kar waqt yaad (pos-first-seen.json); bill-clip clip pehli item se shuru karta hai (malik: "pehli item ka time likh le to kaisa rahe")) · v2.4 (2026-11-08: 🎥 bill ka `ct` = BANANE / PRINT ka waqt (SystemNotes "Created & Printed By:… On:… at PC:") — Bill tally ki clip post ke waqt se nahi, bill banane ke waqt se (malik: "Abdurehman ne jis time bill bana kar print kiya, PC us time se peeche jaye, posting se nahi")) · v2.3 (2026-11-06: 🔎 JAANCH malik: "jo wapsi bill ke andar minus ho chuki wo dobara nahi" — har wapsi ke saath juda SaleID, us bill ka TotalSale aur
//                     SaleDetail ka jor (Qty×Rate) → sum.rtd (app milane ke liye) + note mein "bill se juri N · alag N"; MINUS abhi pehle jaisa (qaida data dekh kar)) · v2.2 (2026-11-04: ↩ malik: "Daily Sale mein sale return add hai ke nahi" → POS ki SALE RETURN (dbo.SaleReturn, us din ki) ab auto sale se MINUS —
//                     cancel (DocStatusID 3) / stock fraq bahar; udhaar party ki wapsi (IsCreditRturn, wholesale nahi) = cash wapas nahi diya = minus NAHI (note mein ginti);
//                     wholesale ki wapsi poori minus (wholesale bill bhi poora gina jata hai). Note: "↩ wapsi N bill Rs X minus". Parh na sake = pehle jaisa (minus nahi)) · v2.1 (2026-10-31: ⚡ har ½ sec · sirf naye/badle bill parho (cache + COUNT/SUM se milao, na mile = poori list) · sum / Daily Sale / items alag peeche ki lane · doc.pm raftar) · v2.0 (2026-10-28: 📌 har posted bill par post ka waqt `pt` — PC ne pehli dafa posted dekha (pos-posted-seen.json), shuru se pehle wale = UpdatedOn) · v1.9 (2026-10-28: ⚡ malik — "posting POS mein jaldi, app mein late": har 1 sec; bills ka haal (posted / un-posted) PEHLE likho, items + Daily Sale
//                     baad mein; items aam chakkar mein sirf aakhri 40 bills ke (har 5 min sab)) · v1.8 (2026-10-16: malik — "haath se likhi jaye, auto sale band / on ka option": blueAccess/saleConfig.posAuto
//                     (default BAND) — band = possale-<aaj> hata do, kuch na likho (pichhle din wese hi); posSales/<din>.sum hamesha (app: sirf
//                     malik ko "POS ke hisaab se" milane ke liye, ginti mein nahi)) · v1.7 (2026-10-13 sham: malik (POS Sale Register Summary ki photo) — "wholesale ka bill sale mein, SYSTEM ki sale":
//                     'whole sale' party ka bill POORA (TotalSale) Sale mein, POS ke Total Sale jaisa; baqi udhaar bill pehle jaisa (cash)) · v1.6 (2026-10-13: 📦 WHOLESALE / udhaar bill ka usi waqt mila cash (CRV, DocumentNo = SaleID) bhi Sale mein; note mein
//                     wholesale bill / cash / udhaar alag) · v1.5 (2026-10-12: 🖥 POS KI SALE (AUTO) -> Daily Sale ka Sale khana, blueKhata 'possale-<din>'; "stock fraq" account ke bill nahi) · v1.4 (2026-10-06: 🔔 POS mein item judte hi (scan ya code) us PC ko beep — posBeep/<PC host>, har 0.4 sec) · v1.3 (2026-10-06: ⚡ har 2 sec + app ka bill bante / edit hote hi foran) · v1.2 (2026-10-06: ps = DocStatusID (1 un-posted / 2 posted), pc + by (SystemNotes se), items posSaleLines/<SaleID>, _sync har 30 sec) · v1.1 (2026-10-03: har 10 sec, pehle chhota sawal) · v1  (2026-10-03) — POS par bane AAJ ke SALE BILLS app mein (sirf SELECT, POS mein kuch nahi badalta)
//  Har 1 minute dbo.Sale (aaj) parhta hai -> Firestore posSales/<YYYY-MM-DD> (ek doc, sirf badle to likhta hai).
//  App: scanner screen ke baayein "Aaj ke bills" mein chips — ✓ cash/poora · ✗ udhaar · ⊘ cancel (DocStatusID 3).
//  App se bani sale (Description = "BK-APP <id>") ko app:<id> nishan — app wali chip se jod deta hai (do dafa na dikhe).
//  Chalana: node pos-sales-dekho.js (pos-sales-auto.bat loop mein). Log: pos-sales-log.txt · Lock 47824.
// =========================================================
const fs = require('fs');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const EVERY = 500;                 // v2.1 (2026-10-31): ½ sec (malik: "ek second mein bill pohnche") · v1.9 (2026-10-27): 1 sec (malik: "posting POS mein jaldi, app mein late") · v1.3: 2 sec (sirf ginti; Firestore par likhna sirf badlaav par) · v1.1: 10 sec — pehle sirf ginti/aakhri bill dekhta hai, badle to poori list
const FULL_EVERY = 5 * 60 * 1000;    // phir bhi har 5 min poori list (koi badlaav na chhoote)
let lastKey = '', lastFull = 0, lastLinesFull = 0;
const LOCK_PORT = 47824;
const cfgLocal = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } };
const DIR = __dirname;
// HEARTBEAT (doctor v2.3+): har 30 sec
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();   // 2026-10-11: 💓 sachi dhadkan (zinda.js) — purani 30-sec khud-likhne wali hatayi
const log = (...a) => { const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' '); console.log(line); try { fs.appendFileSync(path.join(DIR, 'pos-sales-log.txt'), line + '\r\n'); } catch {} };
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('posSales');
const linesCol = db.collection('businesses').doc(BUSINESS_ID).collection('posSaleLines');   // v1.2: har bill ke items (edit / un-posted print)
// v1.2: PC ka naam (SystemNotes "at PC:DESKTOP-xxx") -> dukaan ka naam. local-config.json "pcNames": {"DESKTOP-xxx": "Naam"} se badlein.
const PC_DEFAULT = { 'DESKTOP-8BR23BF': 'Mithu', 'DESKTOP-KEIME1D': 'Abdurehman', 'DESKTOP-Q1SLV77': 'Bilal (server)' };
const pcNames = () => { try { return { ...PC_DEFAULT, ...(JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')).pcNames || {}) }; } catch { return PC_DEFAULT; } };
const lineHash = new Map();
let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const dayOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let lastHash = '';
// v2.0 (2026-10-28): 📌 POST KA WAQT (malik: "post hua bill number-wise aa raha hai, time-wise aa sakte hain") — PC jab pehli dafa bill ko posted
//   (DocStatusID 2) dekhe us waqt ko yaad (pos-posted-seen.json, din ke hisaab se). Script shuru hone se pehle ke posted = POS ka UpdatedOn (andaza).
const SEEN_FILE = path.join(__dirname, 'pos-posted-seen.json');
let postSeen = { day: '', m: {} }, seenBoot = true;
try { postSeen = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')) || postSeen; if (!postSeen.m) postSeen.m = {}; } catch {}
// v2.5: 🎥 PEHLI ITEM ka waqt — har 1 s: naye SaleDetailID ki qataren → jis SaleID ki pehli line ab dikhi us ka waqt (PC ki ghari). Restart par purane bill = nahi (bill-clip setting wala waqt).
const FIRST_FILE = path.join(__dirname, 'pos-first-seen.json');
let firstSeen = { m: {} }, firstLast = 0, firstRun = false;
try { firstSeen = JSON.parse(fs.readFileSync(FIRST_FILE, 'utf8')) || firstSeen; if (!firstSeen.m) firstSeen.m = {}; } catch {}
async function firstTick() {
  if (firstRun) return; firstRun = true;
  try {
    const p = await getPool();
    if (!firstLast) { firstLast = Number((await p.request().query('SELECT MAX(SaleDetailID) AS m FROM dbo.SaleDetail')).recordset[0].m) || 0; return; }
    const r = (await p.request().input('l', sql.Int, firstLast).query('SELECT d.SaleID AS S, MIN(d.SaleDetailID) AS D, MAX(d.SaleDetailID) AS X FROM dbo.SaleDetail d WHERE d.SaleDetailID > @l GROUP BY d.SaleID')).recordset;
    if (!r.length) return;
    const now = Date.now(); let ch = false;
    for (const x of r) { firstLast = Math.max(firstLast, Number(x.X) || 0); const id = String(x.S); if (!firstSeen.m[id]) { firstSeen.m[id] = now; ch = true; } }
    if (ch) { const cut = now - 3 * 86400000; for (const [k, v] of Object.entries(firstSeen.m)) if (Number(v) < cut) delete firstSeen.m[k]; try { fs.writeFileSync(FIRST_FILE, JSON.stringify(firstSeen)); } catch {} }
  } catch (e) { log('pehli item: ' + e.message); }
  finally { firstRun = false; }
}

// v2.6 (2026-11-09): 🔴🧾 LIVE BILL — malik: "camera ke upar transparent patti — jis waqt item NT print par aaye usi waqt camera par bhi chalti nazar aaye".
//   SIRF jab koi Live camera dekh raha ho (liveReq st 'ok' — doc har 15 s hb se badalta; PC ki ghari se 45 s ke andar dekha = zinda): us counter
//   (NAAM → host, pcNames ulta) ka aaj ka AAKHRI bill (SystemNotes "at PC: host") + us ki lines har 1 s → posLive/<counter naam>
//   {pc, sid, no, st (DocStatusID), pr (Printed By), t (TotalSale), j: JSON [[detailId, naam, qty, rate]], n, ft, at} — sirf badla ho ya 20 s baad.
//   POS mein KUCH nahi likhta (sirf parhna). Koi na dekh raha ho = koi sawal nahi. AI nahi.
const liveCol = db.collection('businesses').doc(BUSINESS_ID).collection('posLive');
const liveW = new Map(), liveLast = new Map(); let liveRun = false;
function liveWatchStart() {
  db.collection('businesses').doc(BUSINESS_ID).collection('liveReq').where('st', '==', 'ok').onSnapshot(s => {
    const now = Date.now();
    s.docChanges().forEach(c => { if (c.type === 'removed') liveW.delete(c.doc.id); else liveW.set(c.doc.id, { pc: String((c.doc.data() || {}).pc || ''), seen: now }); });
  }, e => log('live bill listener: ' + e.message));
}
function liveHosts() {
  const now = Date.now(), names = pcNames(), want = new Set();
  for (const [id, w] of liveW) { if (now - w.seen > 45000) { liveW.delete(id); continue; } if (w.pc) want.add(w.pc); }
  const out = [];
  for (const nm of want) {
    let host = Object.keys(names).find(h => names[h] === nm) || (/^DESKTOP-/i.test(nm) ? nm : 'DESKTOP-' + nm);
    host = String(host).replace(/[^A-Za-z0-9.-]/g, '');
    if (host) out.push([nm, host]);
  }
  return out.slice(0, 4);
}
async function livePut(nm, d) {
  const k = JSON.stringify(d), o = liveLast.get(nm);
  if (o && o.k === k && Date.now() - o.at < 20000) return;
  liveLast.set(nm, { k, at: Date.now() });
  await liveCol.doc(String(nm).replace(/\//g, '_').slice(0, 100)).set({ ...d, at: Date.now() });
}
async function liveTick() {
  if (liveRun) return;
  const W = liveHosts(); if (!W.length) return;
  liveRun = true;
  try {
    const p = await getPool(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
    for (const [nm, host] of W) {
      const h = (await p.request().input('d', sql.DateTime, d0).input('h', sql.NVarChar(120), '%at PC:%' + host + '%').query(`SELECT TOP 1 s.SaleID, s.SaleNo, s.TotalSale, s.DocStatusID,
        CAST(s.SystemNotes AS NVARCHAR(600)) AS SN FROM dbo.Sale s WHERE s.SaleDate >= @d AND CAST(s.SystemNotes AS NVARCHAR(600)) LIKE @h ORDER BY s.SaleID DESC`)).recordset[0];
      if (!h) { await livePut(nm, { pc: nm, sid: 0, no: '', st: 0, pr: 0, t: 0, j: '[]', n: 0, ft: 0 }); continue; }
      const L = (await p.request().input('s', sql.Int, h.SaleID).query(`SELECT TOP 150 d.SaleDetailID AS D, i.ItemName AS N, d.Qty AS Q, d.Rate AS R
        FROM dbo.SaleDetail d LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.SaleID = @s ORDER BY d.SaleDetailID`)).recordset;
      const j = JSON.stringify(L.map(x => [Number(x.D) || 0, String(x.N || '').trim().slice(0, 50), Math.round((Number(x.Q) || 0) * 1000) / 1000, r2(x.R)]));
      await livePut(nm, { pc: nm, sid: Number(h.SaleID) || 0, no: String(h.SaleNo || '').trim(), st: Number(h.DocStatusID) || 0, pr: /Printed\s*By/i.test(String(h.SN || '')) ? 1 : 0,
        t: r2(h.TotalSale), j, n: L.length, ft: Number(firstSeen.m[String(h.SaleID)]) || 0 });
    }
  } catch (e) { log('live bill: ' + e.message); }
  finally { liveRun = false; }
}

// v1.5 (2026-10-12): 🖥 POS KI SALE (AUTO) — malik: "Sale screen (Daily Sale) mein sale auto aani chahiye, us mein farq wale account ki entry
// nahi aani chahiye. Khana abhi khula hi rahe, sale auto aati jaye". blueKhata/possale-<YYYY-MM-DD>: kind 'sale', posAuto (app mein edit /
// delete nahi), posNo (POS mein voucher nahi). Raqam = cash bill ka TotalSale + udhar bill mein jitna cash mila (min CashReceived, Total);
// cancel (DocStatusID 3) nahi; "stock fraq" party (ginti ka farq) bilkul nahi. Badle to likhta hai; har 5 min jaanch; shuru par kal ka bhi.
const KHATA = db.collection('businesses').doc(BUSINESS_ID).collection('blueKhata');
const isFarqName = n => /stock\s*['"]?\s*f[ae]?r?a?q/i.test(String(n || ''));
// v1.6: malik — "wholesale wala bill bhi sale mein". Wholesale (party "whole sale") = POS mein UDHAAR bill (CashReceived 0); jo cash usi
// waqt mila wo alag CRV (DocumentNo = SaleID, isi party ka — sale-post.js / POS jaisa). Ab udhaar bill ka cash = max(CashReceived, CRV)
// (bill se zyada nahi) — galla jaisa: sirf MILA HUA cash (malik ne A chuna), udhaar 'whole sale' khate mein hi. Khata-sync DocumentNo 0
// wale voucher hi laata hai — yeh CRV app mein wasooli nahi bante, do dafa nahi gine jate.
const isWsName = n => /whole\s*sale/i.test(String(n || ''));
function saleSum(rows, crv = new Map(), rets = null) {
  let cash = 0, n = 0, fq = 0, fqRs = 0, cx = 0, ws = 0, wsRs = 0, wsCash = 0, rt = 0, rtRs = 0, rtU = 0;
  for (const r of rows) {
    if (Number(r.DocStatusID) === 3) { cx++; continue; }
    if (isFarqName(r.PartyName)) { fq++; fqRs += Number(r.TotalSale) || 0; continue; }
    const t = Number(r.TotalSale) || 0, c = Number(r.CashReceived) || 0, v = Number(crv.get(Number(r.SaleID))) || 0;
    const paid = r.IsCreditSale ? Math.max(0, Math.min(Math.max(c, v), t)) : t, wsB = isWsName(r.PartyName);
    cash += wsB ? t : paid; n++;   // v1.7: wholesale = POORA bill (POS Total Sale jaisa)
    if (wsB) { ws++; wsRs += t; wsCash += paid; }
  }
  const rtd = []; let rtL = 0, rtA = 0;   // v2.3: 🔎 jaanch — bill se juri (SaleID) / alag
  for (const r of rets || []) {   // v2.2: ↩ POS Sale Return
    if (Number(r.DocStatusID) === 3 || isFarqName(r.PartyName)) continue;
    const t = Number(r.TotalSaleReturn) || 0; if (!(t > 0)) continue;
    const cr = r.IsCreditRturn === true || Number(r.IsCreditRturn) === 1, sid = Number(r.SaleID) || 0;
    rtd.push({ no: String(r.SaleReturnNo || r.SaleReturnID).trim(), p: String(r.PartyName || '').trim().slice(0, 30), t: Math.round(t), cr: cr ? 1 : 0, sid,
      sno: sid ? String(r.LSaleNo || '').trim() : '', st: sid ? Math.round(Number(r.LTotal) || 0) : 0, sd: sid ? Math.round(Number(r.LDet) || 0) : 0,
      sday: sid && r.LDate ? dayOf(new Date(r.LDate)) : '', at: r.SaleReturnDate ? new Date(r.SaleReturnDate).toISOString().slice(11, 16) : '' });
    if (sid) rtL++; else rtA++;
    if (cr && !isWsName(r.PartyName)) { rtU++; continue; }   // udhaar party ki wapsi — galle se cash nahi gaya
    rt++; rtRs += t;
  }
  cash -= rtRs;
  return { amt: Math.round(cash * 100), n, fq, fqRs: Math.round(fqRs), cx, ws, wsRs: Math.round(wsRs), wsCash: Math.round(wsCash), rt, rtRs: Math.round(rtRs), rtU, rtL, rtA, rtd: rtd.slice(0, 40), rok: rets != null };
}
async function retFor(p, d0, d1) {   // v2.2: ↩ us din ki POS Sale Return (r.* — IsCreditRturn POS ke version par na ho to bhi chale) · ghalti = null (minus nahi)
  try {
    return (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
      SELECT r.*, pt.PartyName, s.SaleNo AS LSaleNo, CAST(s.TotalSale AS FLOAT) AS LTotal, s.SaleDate AS LDate,
        (SELECT SUM(CAST(d.Qty AS FLOAT) * CAST(d.Rate AS FLOAT)) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS LDet
      FROM dbo.SaleReturn r LEFT JOIN dbo.Party pt ON pt.PartyID = r.PartyID LEFT JOIN dbo.Sale s ON s.SaleID = r.SaleID
      WHERE r.SaleReturnDate >= @a AND r.SaleReturnDate < @b`)).recordset;
  } catch (e) { log('Sale Return nahi parhi: ' + e.message); return null; }
}
async function crvFor(p, d0, d1) {   // v1.6: udhaar bill ke saath usi bill ka CRV (cash) — SaleID -> raqam
  const m = new Map();
  try {
    const rs = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
      SELECT v.DocumentNo AS SaleID, SUM(CAST(d.Debit AS FLOAT)) AS Cash
      FROM dbo.Voucher v JOIN dbo.VoucherDetail d ON d.VoucherID = v.VoucherID
      JOIN dbo.Sale s ON s.SaleID = v.DocumentNo AND s.PartyID = v.PartyID
      WHERE v.VoucherType = 'CRV' AND ISNULL(v.DocumentNo, 0) > 0 AND ISNULL(v.VoucherStatusID, 1) <> 3 AND d.Debit > 0
        AND s.SaleDate >= @a AND s.SaleDate < @b AND s.IsCreditSale = 1
      GROUP BY v.DocumentNo`)).recordset;
    for (const r of rs) m.set(Number(r.SaleID), Number(r.Cash) || 0);
  } catch (e) { log('Wholesale CRV nahi parhe: ' + e.message); }
  return m;
}
const saleSeen = new Map();
// v1.8: 🔘 AUTO SALE ON / BAND — blueAccess/saleConfig {posAuto} (app: Settings → 🖥 Daily Sale: POS ki sale khud). Default BAND.
//   Setting aane se pehle kuch nahi likhte / hatate (cfgReady). Band = sirf AAJ ki auto entry hatao (pichhle din ki wesi).
let AUTO = false, cfgReady = false;
try { db.collection('businesses').doc(BUSINESS_ID).collection('blueAccess').doc('saleConfig').onSnapshot(sn => {
  const v = !!(sn.exists && (sn.data() || {}).posAuto === true); const ch = !cfgReady || v !== AUTO; AUTO = v; cfgReady = true;
  if (ch) { saleSeen.clear(); lastKey = ''; log(`🔘 POS sale auto: ${AUTO ? 'ON — Daily Sale mein khud' : 'BAND — haath se (aaj ki auto entry hat jayegi)'}`); }
}, e => log('saleConfig nahi parha: ' + e.message)); } catch (e) { log('saleConfig: ' + e.message); }
async function writeSale(day, s, force = false) {
  if (!cfgReady) return;
  if (!AUTO) {
    if (day !== dayOf(new Date())) return;
    const ref = KHATA.doc('possale-' + day), ex = await ref.get(), old = ex.exists ? ex.data() : null;
    if (old && !old.deleted && old.posAuto) { await ref.set({ deleted: true, offBand: true, updatedAt: Date.now(), updatedBy: 'pc-sale' }, { merge: true }); log(`🔘 ${day}: auto sale BAND — POS sale entry hatayi (haath se likhein)`); }
    return;
  }
  const key = `${s.amt}|${s.n}|${s.fq}|${s.cx}|${s.ws}|${s.wsRs}|${s.rt}|${s.rtRs}|${s.rtU}`, prev = saleSeen.get(day);
  if (!force && prev && prev.key === key && Date.now() - prev.at < 5 * 60000) return;
  const ref = KHATA.doc('possale-' + day), ex = await ref.get(), old = ex.exists ? ex.data() : null, t = Date.now();
  saleSeen.set(day, { key, at: t }); if (saleSeen.size > 10) saleSeen.delete(saleSeen.keys().next().value);
  if (s.amt <= 0) { if (old && !old.deleted) { await ref.set({ deleted: true, updatedAt: t, updatedBy: 'pc-sale' }, { merge: true }); log(`🖥 ${day}: POS sale 0 — auto entry hatayi`); } return; }
  const note = `🖥 POS ki sale (auto) · ${s.n} bill${s.cx ? ' · ' + s.cx + ' cancel' : ''}${s.ws ? ` · 📦 Wholesale ${s.ws} bill Rs ${s.wsRs.toLocaleString('en-US')} POORA shamil (cash mila ${s.wsCash.toLocaleString('en-US')}${s.wsRs - s.wsCash > 0 ? ' · udhaar ' + (s.wsRs - s.wsCash).toLocaleString('en-US') : ''})` : ''}${s.fq ? ` · stock fraq ke ${s.fq} bill (Rs ${s.fqRs.toLocaleString('en-US')}) nahi gine` : ''}${s.rt ? ` · ↩ wapsi ${s.rt} bill Rs ${s.rtRs.toLocaleString('en-US')} minus` : ''}${s.rtU ? ` · udhaar wapsi ${s.rtU} (cash nahi — minus nahi)` : ''}${(s.rtL || s.rtA) ? ` · 🔎 wapsi: bill se juri ${s.rtL || 0} · alag ${s.rtA || 0}` : ''}`;   // v2.3: 🔎 jaanch · v2.2: ↩
  if (old && !old.deleted && old.amount === s.amt && old.note === note) return;
  await ref.set({ id: 'possale-' + day, type: 'entry', kind: 'sale', amount: s.amt, date: day, note, partyId: '', account: '', posAuto: true, posNo: true, deleted: false,
    by: 'pc-sale', updatedBy: 'pc-sale', createdAt: Number(old && old.createdAt) || t, updatedAt: t, rev: (Number(old && old.rev) || 0) + 1 }, { merge: true });
  log(`🖥 ${day}: Daily Sale mein POS sale Rs ${(s.amt / 100).toLocaleString('en-US')} (${s.n} bill${s.fq ? ', stock fraq ' + s.fq + ' nahi' : ''})`);
}
async function saleFor(p, d0, d1) {
  const rows = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT s.SaleID, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, pt.PartyName FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b`)).recordset;
  return saleSum(rows, await crvFor(p, d0, d1), await retFor(p, d0, d1));
}

// v1.2: aaj ke har bill ke items -> posSaleLines/<SaleID> {day, no, at, lines:[{i,n,q,r,g}]} — sirf badle hue likhe
async function syncLines(p, d0, d1, day, fromId = 0) {   // v1.9: fromId = sirf is SaleID se naye (aakhri 40) — 0 = sab
  const rs = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).input('f', sql.Int, Number(fromId) || 0).query(`
    SELECT d.SaleID, s.SaleNo, d.ItemID, i.ItemName, d.Qty, d.Rate, d.GBranchID
    FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID JOIN dbo.Items i ON i.ItemID = d.ItemID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b AND s.SaleID >= @f ORDER BY d.SaleID, d.SaleDetailID`)).recordset;
  const by = new Map();
  for (const r of rs) { if (!by.has(r.SaleID)) by.set(r.SaleID, { no: String(r.SaleNo || '').trim(), lines: [] });
    by.get(r.SaleID).lines.push({ i: r.ItemID, n: String(r.ItemName || '').trim().slice(0, 60), q: Math.round((Number(r.Qty) || 0) * 1000) / 1000, r: r2(r.Rate), g: Number(r.GBranchID) || 0 }); }
  let batch = db.batch(), n = 0, w = 0;
  for (const [id, v] of by) {
    const h = JSON.stringify(v.lines.slice(0, 150)); if (lineHash.get(id) === h) continue;
    batch.set(linesCol.doc(String(id)), { day, no: v.no, at: Date.now(), lines: v.lines.slice(0, 150) }); lineHash.set(id, h); n++; w++;
    if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  if (w) log(`Items: ${w} bills ke items app mein`);
  if (lineHash.size > 3000) lineHash.clear();
}
// v2.1 (2026-10-31): ⚡ malik — "yahan scan ho aur Bills screen par EK SECOND mein bill pohnche". Teen kaam:
//   1) jaanch har ½ sec (EVERY), saste COUNT/MAX query se (SaleID >= aaj ka pehla bill = sirf aaj ki qataren);
//   2) badlaav par POORI din ki list nahi — sirf naye (SaleID > pichhla max) + badle (UpdatedOn) + aakhri 15 bill (scan chal raha ho) parh kar
//      memory ki list (cache) mein jorna; phir COUNT / MAX / SUM khud mila kar dekhna — na mile (delete, purana bill badla) = foran poori list;
//   3) Daily Sale + items (posSaleLines) + sum ALAG peeche ki lane (slow) mein — bill ka likhna inhein ka intezar nahi karta.
//   Doc par `pm` {q: dekh+parhne ka ms, w: pichhle likhne ka ms, e: jaanch ms, f: 1 = poori list} — app ⋮ "⏱ Raftar".
// v2.4: SystemNotes ki pehli "On:<waqt> at PC:" line (POS "Created & Printed By:naam On:11/8/2026 5:30:12 PM at PC:DESKTOP-…") → ms. dd/mm ya mm/dd ka shak = SaleDate ke din se.
function onTime(sn, saleDate) {
  const m = String(sn || '').match(/Printed\s*By:[^\r\n]*?On:\s*([^\r\n]+?)\s+at PC/i) || String(sn || '').match(/On:\s*([^\r\n]+?)\s+at PC/i);
  if (!m) return 0;
  const sd = saleDate ? new Date(saleDate) : null; if (sd) sd.setHours(0, 0, 0, 0);
  const okDay = t => !isNaN(t) && t > 0 && (!sd || (t >= sd.getTime() - 3600000 && t <= sd.getTime() + 2 * 86400000));   // us din ka nahi = bharosa nahi
  const cands = [];
  const d = m[1].match(/(?<!\d)(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\D+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i);
  if (d) { let h = +d[4]; if (d[7]) { h %= 12; if (/pm/i.test(d[7])) h += 12; }
    const a = +d[1], b = +d[2], mk = (dd, mm) => new Date(+d[3], mm - 1, dd, h, +d[5], +(d[6] || 0)).getTime();
    const ddmm = a > 12 || (sd && a === sd.getDate() && b === sd.getMonth() + 1 && a !== b);   // default mm/dd (en-US)
    cands.push(ddmm ? mk(a, b) : mk(b, a), ddmm ? mk(b, a) : mk(a, b)); }
  cands.push(Date.parse(m[1]));
  for (const t of cands) if (okDay(t)) return t;
  return 0;
}
const SEL = `SELECT s.SaleID, s.SaleNo, s.SaleDate, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, s.Description, s.SystemNotes, s.UpdatedOn, pt.PartyName,
           (SELECT COUNT(*) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS N
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID`;
let cache = new Map(), cacheDay = '', firstId = 0, lastMax = 0, lastU = null, lastWm = 0, needFull = false, slowDirty = true;
function cacheAgg() {
  let C = 0, M = 0, X = 0, S = 0, T = 0, R = 0;
  for (const r of cache.values()) { C++; M = Math.max(M, Number(r.SaleID) || 0); const st = Number(r.DocStatusID) || 0; if (st === 3) X++; S += st; T += Number(r.TotalSale) || 0; R += Number(r.CashReceived) || 0; }
  return { C, M, X, S, T, R };
}
function aggOk(k) {
  const a = cacheAgg();
  return a.C === (Number(k.C) || 0) && a.M === (Number(k.M) || 0) && a.X === (Number(k.X) || 0) && a.S === (Number(k.S) || 0) && Math.abs(a.T - (Number(k.T) || 0)) < 1 && Math.abs(a.R - (Number(k.R) || 0)) < 1;
}
async function readFull(p, d0, d1) {
  const rows = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`${SEL}
    WHERE s.SaleDate >= @a AND s.SaleDate < @b ORDER BY s.SaleID DESC`)).recordset;
  cache = new Map(rows.map(r => [Number(r.SaleID), r])); cacheDay = dayOf(d0); lastFull = Date.now(); needFull = false;
  firstId = rows.length ? Math.min(...rows.map(r => Number(r.SaleID) || 0)) : 0;
  return rows;
}
async function once() {
  const t0 = Date.now();
  const p = await getPool();
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const day = dayOf(d0);
  if (cacheDay !== day) { cache = new Map(); firstId = 0; lastMax = 0; lastU = null; needFull = true; }
  const k = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).input('f', sql.Int, firstId).query(`
    SELECT COUNT(*) AS C, MAX(SaleID) AS M, SUM(CASE WHEN DocStatusID = 3 THEN 1 ELSE 0 END) AS X, SUM(DocStatusID) AS S, SUM(CAST(TotalSale AS FLOAT)) AS T, SUM(CAST(CashReceived AS FLOAT)) AS R, MAX(UpdatedOn) AS U
    FROM dbo.Sale WHERE SaleID >= @f AND SaleDate >= @a AND SaleDate < @b`)).recordset[0] || {};
  const key = `${day}|${k.C}|${k.M}|${k.X}|${k.S}|${Math.round(k.T || 0)}|${Math.round(k.R || 0)}|${k.U ? new Date(k.U).getTime() : 0}`;   // v1.2: post hona / edit bhi
  if (key === lastKey && Date.now() - lastFull < FULL_EVERY) return;   // kuch nahi badla
  let full = needFull || !cache.size || Date.now() - lastFull >= FULL_EVERY, rows;
  if (full) rows = await readFull(p, d0, d1);
  else {   // v2.1: sirf naye + badle + aakhri 15
    rows = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).input('f', sql.Int, firstId).input('m', sql.Int, lastMax)
      .input('u', sql.DateTime, lastU || d0).query(`${SEL}
      WHERE s.SaleID >= @f AND s.SaleDate >= @a AND s.SaleDate < @b AND (s.SaleID > @m OR s.UpdatedOn >= @u
        OR s.SaleID IN (SELECT TOP 15 x.SaleID FROM dbo.Sale x WHERE x.SaleID >= @f AND x.SaleDate >= @a AND x.SaleDate < @b ORDER BY x.SaleID DESC))`)).recordset;
    for (const r of rows) cache.set(Number(r.SaleID), r);
    if (!aggOk(k)) { full = true; rows = await readFull(p, d0, d1); }   // mila nahi (delete / purana badla) = poori list
  }
  lastKey = key; lastMax = Number(k.M) || 0; lastU = k.U || lastU;
  const names = pcNames();
  { if (postSeen.day !== day) postSeen = { day, m: {} }; let ch = false;   // v2.0: 📌 post ka waqt (v2.1: sirf parhi hui qataren — baqi wese hi)
    for (const r of rows) { const id = String(r.SaleID), posted = Number(r.DocStatusID) === 2;
      if (posted && !postSeen.m[id]) { postSeen.m[id] = seenBoot ? (r.UpdatedOn ? new Date(r.UpdatedOn).getTime() : Date.now()) : Date.now(); ch = true; }
      else if (!posted && postSeen.m[id]) { delete postSeen.m[id]; ch = true; } }   // un-post hua = bhool jao (dobara post par naya waqt)
    if (full) for (const id of Object.keys(postSeen.m)) if (!cache.has(Number(id))) { delete postSeen.m[id]; ch = true; }
    seenBoot = false; if (ch) { try { fs.writeFileSync(SEEN_FILE, JSON.stringify(postSeen)); } catch {} } }
  const all = [...cache.values()].sort((a, b) => (Number(b.SaleID) || 0) - (Number(a.SaleID) || 0));
  const bills = all.slice(0, 600).map(r => {
    const desc = String(r.Description || ''), m = desc.match(/BK-APP[ :]([A-Za-z0-9_-]+)/);
    const sn = String(r.SystemNotes || ''), host = (sn.match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || '', by = (sn.match(/By:\s*([^\r\n]+?)\s+On:/i) || [])[1] || '';
    const ct = onTime(sn, r.SaleDate);   // v2.4: banane / print ka waqt
    return { id: r.SaleID, ct, no: String(r.SaleNo || '').trim(), t: r2(r.TotalSale), c: r2(r.CashReceived), cr: r.IsCreditSale ? 1 : 0,
      x: Number(r.DocStatusID) === 3 ? 1 : 0, p: String(r.PartyName || '').slice(0, 60), n: Number(r.N) || 0,
      tm: r.SaleDate ? new Date(r.SaleDate).getTime() : 0, app: m ? m[1] : '',
      ps: Number(r.DocStatusID) || 0, pt: Number(postSeen.m[String(r.SaleID)]) || 0, ft: Number(firstSeen.m[String(r.SaleID)]) || 0, pc: String(names[host] || host.replace(/^DESKTOP-/i, '') || '').slice(0, 30), by: /blue khata/i.test(by) ? '' : String(by).trim().slice(0, 20) };
  });
  const hash = day + JSON.stringify(bills);
  slowDirty = true;
  // v1.9: bills ka haal SAB SE PEHLE app ko · v2.1: sum / Daily Sale / items peeche ki lane mein (slow) — yahan intezar nahi
  if (hash !== lastHash) {
    const qm = Date.now() - t0, tw = Date.now();
    await col.doc(day).set({ day, at: tw, bills, pm: { q: qm, w: lastWm, e: EVERY, f: full ? 1 : 0 } }, { merge: true });
    lastWm = Date.now() - tw; lastHash = hash;
    log(`Aaj ke ${bills.length} POS bills app mein (cancel ${bills.filter(b => b.x).length}, udhaar ${bills.filter(b => b.cr && !b.x).length}) · parha ${qm}ms · bheja ${lastWm}ms${full ? ' · poori list' : ''}`);
  }
}
// v2.1: PEECHE KI LANE — sum (app milane ke liye) + Daily Sale (possale-<din>) + items (posSaleLines). Bill likhne ko kabhi nahi rokti.
let slowRun = false, lastSumHash = '';
async function slow() {
  if (slowRun || !cfgReady) return;
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1); const day = dayOf(d0);
  if (cacheDay !== day || !cache.size) return;
  const fullLines = Date.now() - lastLinesFull > FULL_EVERY;
  if (!slowDirty && !fullLines) return;
  slowRun = true; slowDirty = false;
  try {
    const p = await getPool(), rows = [...cache.values()], sm = saleSum(rows, await crvFor(p, d0, d1), await retFor(p, d0, d1));
    const sum = { amt: sm.amt, n: sm.n, cx: sm.cx, fq: sm.fq, fqRs: sm.fqRs, ws: sm.ws, wsRs: sm.wsRs, wsCash: sm.wsCash, rt: sm.rt, rtRs: sm.rtRs, rtU: sm.rtU, rtL: sm.rtL, rtA: sm.rtA, rtd: JSON.stringify(sm.rtd || []), auto: AUTO };   // v2.3: rtd JSON text (list ke andar list nahi)   // v2.2: ↩ wapsi   // v1.8: app milane ke liye (ginti nahi)
    const sh = day + JSON.stringify(sum);
    if (sh !== lastSumHash) { await col.doc(day).set({ sum }, { merge: true }); lastSumHash = sh; }
    await writeSale(day, sm).catch(e => log('POS sale (auto) masla: ' + e.message));   // v1.5 · v1.6 wholesale CRV · v1.8 band = hata
    if (fullLines) lastLinesFull = Date.now();
    const ids = rows.map(r => Number(r.SaleID) || 0).sort((a, b) => b - a);
    await syncLines(p, d0, d1, day, fullLines ? 0 : (ids[Math.min(39, ids.length - 1)] || 0)).catch(e => log('Items masla: ' + e.message));   // v1.9: aam chakkar = sirf aakhri 40 bills ke items, har 5 min sab
  } catch (e) { slowDirty = true; log('Peeche ki lane: ' + e.message); }
  finally { slowRun = false; }
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('pos-sales-dekho pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  for (let i = 0; i < 50 && !cfgReady; i++) await new Promise(r => setTimeout(r, 200));   // v1.8: setting (10 sec tak)
  try { const p = await getPool(), y1 = new Date(); y1.setHours(0, 0, 0, 0); const y0 = new Date(y1); y0.setDate(y0.getDate() - 1);   // v1.5: kal ki aakhri sale bhi (PC raat ko band ho gaya ho)
    await writeSale(dayOf(y0), await saleFor(p, y0, y1), true); } catch (e) { log('Kal ki POS sale: ' + e.message); }
  log('pos-sales-dekho v2.5 chal raha hai — har ½ second (sirf naye / badle bill parhta hai, bill pehle — Daily Sale / items peeche)…');
  let running = false, again = false;
  const tick = async () => { if (running) { again = true; return; } running = true;
    try { await once(); } catch (e) { log('Masla: ' + e.message); if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); }
    finally { running = false; if (again) { again = false; setTimeout(tick, 50); } } };
  await tick();
  setInterval(ZINDA.guard(tick, 5 * 60000, 'bills tick'), EVERY);   // 2026-10-11: chowkidar
  setInterval(ZINDA.guard(slow, 10 * 60000, 'peeche ki lane'), 1500);   // v2.1: sum + Daily Sale + items alag
  setInterval(ZINDA.guard(firstTick, 10 * 60000, 'pehli item'), 1000);   // v2.5: 🎥 pehli item ka waqt
  liveWatchStart(); setInterval(ZINDA.guard(liveTick, 10 * 60000, 'live bill'), 1000);   // v2.6: 🔴🧾 live bill (sirf jab koi dekh raha ho)
  firstTick();
  // v1.3: app ka bill POS mein bana (done) / edit hua -> foran dekho (2 sec ka intezar bhi nahi)
  const kick = () => setTimeout(() => { lastKey = ''; tick(); }, 150);
  const base = db.collection('businesses').doc(BUSINESS_ID), seen = new Map();
  const watch = (name, field) => base.collection(name).where(field, '>', Date.now() - 6 * 3600000).onSnapshot(sn => {
    sn.docChanges().forEach(c => { const d = c.doc.data() || {}, st = d.status, prev = seen.get(c.doc.id); seen.set(c.doc.id, st); if (prev !== undefined && st === 'done' && prev !== 'done') kick(); });
    if (seen.size > 5000) seen.clear();
  }, e => log('Foran-dekho listener: ' + e.message));
  watch('appSales', 'createdAt'); watch('saleEdits', 'at');
  // v1.4: 🔔 POS BEEP — nayi SaleDetail line (save se pehle bhi POS likhta hai) -> us PC (SystemNotes "at PC:") ke posBeep doc par waqt.
  // NT-PRINT (us PC par) dekh kar beep karta hai. App ke bill (BK-APP) aur bari kheep (> 30 line = save/import) par nahi.
  if (cfgLocal().posBeep === true) {   // v1.4.1: opt-in
    const beepCol = db.collection('businesses').doc(BUSINESS_ID).collection('posBeep');
    let lastLine = 0, bRun = false;
    const beepTick = async () => { if (bRun) return; bRun = true;
      try {
        if (!lastLine) { lastLine = Number((await p0.request().query('SELECT MAX(SaleDetailID) AS m FROM dbo.SaleDetail')).recordset[0].m) || 0; return; }
        const r = (await p0.request().input('l', sql.Int, lastLine).query(`SELECT TOP 200 d.SaleDetailID AS D, CAST(s.SystemNotes AS NVARCHAR(400)) AS SN,
          CAST(s.Description AS NVARCHAR(200)) AS DS, i.ItemName AS N FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
          LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.SaleDetailID > @l ORDER BY d.SaleDetailID`)).recordset;
        if (!r.length) return;
        lastLine = Math.max(lastLine, ...r.map(x => Number(x.D) || 0));
        if (r.length > 30) return;
        const by = new Map();
        for (const x of r) { if (/BK-APP/i.test(String(x.DS || ''))) continue;
          const host = ((String(x.SN || '').match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || 'UNKNOWN').toUpperCase();
          const o = by.get(host) || { n: 0, item: '' }; o.n++; o.item = String(x.N || '').trim().slice(0, 40); by.set(host, o); }
        for (const [k, o] of by) beepCol.doc(k).set({ at: Date.now(), n: o.n, item: o.item }).catch(() => {});
      } catch (e) { log('POS beep: ' + e.message); }
      finally { bRun = false; } };
    const p0 = await getPool();
    setInterval(beepTick, 400);
    log('🔔 POS beep chalu — har nayi line par us PC ko awaz');
  }
  const beat = () => col.doc('_sync').set({ at: Date.now() }).catch(() => {});   // v1.2: app mein "PC sync X sec pehle"
  beat(); setInterval(beat, 30000);
});
