// =========================================================
//  pk-report.js  v1.2 (2026-10-27: item.st = har branch ka stock — app 'Godam 2 ke items' filter) · v1.1 (2026-10-27: SAB branches — NOOR TRADERS dukan + har godam; docs pkReport-<branchId>-<k>, meta.branches) · v1.0 (2026-10-27) — 📦 PACKET REPORT (malik: "poore 3 mahine ka Godam 2 ka barcode ke saath packets wala data —
//  kitne packet bike, sub-barcode + barcode, 1 packet ke hisaab se, jo scan hue")
//
//  SIRF PARHTI hai (POS mein kuch nahi likhti). Har ghante (aur app ke "🔄 Taza karo" = posStats/pkReq par 10 min ke andar):
//    • Har branch alag (NAAM ke saath; app mein chip — default NOOR TRADERS naam se), number par bharosa nahi (CLAUDE.md §4).
//    • Aakhri 3 calendar mahine (is mahine samet) ki sale lines: dbo.SaleDetail + dbo.Sale (cancel DocStatusID 3 nahi,
//      line ka godam = ISNULL(NULLIF(d.GBranchID,0), s.BranchID)).
//    • Packet = dbo.ItemSubCode (SBBarCode, SBItemQty). SCAN ka pata: agar SaleDetail mein barcode/subcode ka column hai to wahi
//      (exact "kaun sa barcode scan hua"); nahi to malik ka qaida (rack-bharo v1.16): line ki tadad kisi packet ke BILKUL barabar = 1 packet
//      (0.250 = 250 gm), guna / beech ki tadad = khula. Dono surat report mein 'how' likha hai: 'scan' ya 'size'.
//  Likhti hai: posStats/pkReport { at, from, to, months, branches:[{id,name,n,lines,chunks}], scanCol, how, reqAt }
//              posStats/pkReport-<branchId>-<k> { j: JSON text [ {i, c, n, pk, u, cu, mb, subs:{b:q}, m:{ 'YYYY-MM': {pk:{b:{n,q,sc}}, main:q, mainN, loose:q, looseN, bills} } } ] }
//  (list ke andar list NAHI — Firestore 'invalid nested entity'; sab JSON text). Chalana: pk-auto.bat (loop 10 min). Log: pk-report-log.txt.
// =========================================================
const path = require('path');
const sql = require('mssql');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const fs = require('fs'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(__dirname, 'firebase-key.json'))) });
const db = getFirestore(), col = db.collection('businesses').doc('noor-traders').collection('posStats');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const p2 = n => String(n).padStart(2, '0'), r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const MONTHS_BACK = 2, CHUNK = 250, EVERY = 60 * 60000, EPS = 1e-6;

async function branchMap(pool) {   // sync-stock.js jaisa: branch table + naam ka column khud dhoondo
  const t = await pool.request().query(`SELECT TOP 1 c.TABLE_NAME AS T, n.COLUMN_NAME AS N FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.COLUMNS n ON n.TABLE_NAME = c.TABLE_NAME WHERE c.COLUMN_NAME = 'BranchID' AND c.TABLE_NAME LIKE '%Branch%' AND n.COLUMN_NAME LIKE '%Name%' ORDER BY LEN(c.TABLE_NAME)`);
  if (!t.recordset.length) return {};
  const { T, N } = t.recordset[0];
  const r = await pool.request().query(`SELECT BranchID, [${N}] AS BranchName FROM dbo.[${T}]`);
  const m = {}; r.recordset.forEach(x => { m[Number(x.BranchID)] = String(x.BranchName || '').trim(); }); return m;
}
async function colOf(pool, table, likes) {
  const r = await pool.request().query(`SELECT COLUMN_NAME AS C FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'`);
  const cols = r.recordset.map(x => String(x.C));
  for (const l of likes) { const hit = cols.find(c => c.toLowerCase().includes(l)); if (hit) return hit; }
  return '';
}
function monthsOf(now = new Date()) { const out = []; for (let k = MONTHS_BACK; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); out.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`); } return out; }

async function build(pool, reqAt) {
  const now = new Date(), months = monthsOf(now), from = new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK, 1);
  const bm = await branchMap(pool);
  const bids = Object.keys(bm).map(Number).filter(n => n > 0);   // v1.1: SAB branches (NOOR TRADERS dukan + har godam) — malik: "NOOR TRADERS ka data chahiye"
  if (!bids.length) throw Error('POS mein branch list nahi mili');
  const scanCol = await colOf(pool, 'SaleDetail', ['subcode', 'barcode', 'scancode']);   // POS line par scanned code?
  const mbCol = await colOf(pool, 'Items', ['barcode']);
  const items = (await pool.request().query(`SELECT i.ItemID, i.ItemCode, i.ItemName, ISNULL(i.PackQty, 0) AS PackQty, i.QtyName, i.PackQtyName${mbCol ? `, i.[${mbCol}] AS MB` : ''} FROM dbo.Items i`)).recordset;
  const subs = (await pool.request().query(`SELECT ItemID, LTRIM(RTRIM(SBBarCode)) AS B, SBItemQty AS Q FROM dbo.ItemSubCode WHERE LTRIM(RTRIM(ISNULL(SBBarCode, ''))) <> ''`)).recordset;
  const stMap = new Map();   // v1.2: har item ka har branch mein stock (malik: "jo items Godam 2 mein hain un ka NOOR TRADERS ka data") — app filter 'Godam 2 ke items'
  try { for (const r of (await pool.request().query(`SELECT ItemID, BranchID, ISNULL(CurrStock, 0) AS S FROM dbo.ItemBranchRate`)).recordset) { const id = String(r.ItemID); if (!stMap.has(id)) stMap.set(id, {}); if (Number(r.S)) stMap.get(id)[String(r.BranchID)] = r3(r.S); } } catch (e) { log('ItemBranchRate: ' + e.message); }
  const linesAll = (await pool.request().input('a', sql.DateTime, from).query(`
    SELECT d.ItemID, d.Qty, s.SaleDate, s.SaleID, ISNULL(NULLIF(d.GBranchID, 0), s.BranchID) AS B${scanCol ? `, LTRIM(RTRIM(CAST(d.[${scanCol}] AS NVARCHAR(80)))) AS SC` : ''}
    FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND ISNULL(s.DocStatusID, 0) <> 3`)).recordset;
  const subBy = new Map(); for (const s of subs) { const id = String(s.ItemID); if (!subBy.has(id)) subBy.set(id, []); subBy.get(id).push({ b: String(s.B), q: Number(s.Q) || 0 }); }
  const byId = new Map(items.map(r => [String(r.ItemID), r]));
  const batch = db.batch(); const brOut = [];
  for (const gid of bids) {
  const lines = linesAll.filter(l => Number(l.B) === gid);
  const out = new Map(), bills = new Map();
  const get = r => { const id = String(r.ItemID); if (!out.has(id)) out.set(id, { i: id, c: String(r.ItemCode || ''), n: String(r.ItemName || '').trim(), pk: Number(r.PackQty) || 0, u: String(r.QtyName || 'Pcs'), cu: String(r.PackQtyName || 'Ctn'), mb: String(r.MB || '').trim(), subs: Object.fromEntries((subBy.get(id) || []).map(x => [x.b, x.q])), st: stMap.get(id) || {}, m: {} }); return out.get(id); };
  for (const l of lines) {
    const it = byId.get(String(l.ItemID)); if (!it) continue;
    const d = new Date(l.SaleDate), mk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; if (!months.includes(mk)) continue;
    const e = get(it), M = e.m[mk] || (e.m[mk] = { pk: {}, main: 0, mainN: 0, loose: 0, looseN: 0, bills: 0 });
    const bk = mk + '|' + e.i; if (!bills.has(bk)) bills.set(bk, new Set()); bills.get(bk).add(String(l.SaleID));
    const q = Number(l.Qty) || 0, S = subBy.get(e.i) || [];
    let hit = null, sc = false;
    if (scanCol && l.SC) { hit = S.find(x => x.b === String(l.SC)) || null; sc = !!hit; }
    if (!hit) hit = S.find(x => x.q > 0 && Math.abs(x.q - q) < EPS) || null;   // malik ka qaida: BILKUL barabar = 1 packet
    if (hit) { const P = M.pk[hit.b] || (M.pk[hit.b] = { n: 0, q: 0, sc: 0 }); P.n += 1; P.q = r3(P.q + q); if (sc) P.sc += 1; }
    else if (Math.abs(q - Math.round(q)) < EPS) { M.main = r3(M.main + q); M.mainN += 1; }
    else { M.loose = r3(M.loose + q); M.looseN += 1; }
  }
  for (const [bk, set] of bills) { const [mk, id] = bk.split('|'); const e = out.get(id); if (e && e.m[mk]) e.m[mk].bills = set.size; }
  const all = [...out.values()].sort((a, b) => a.n.localeCompare(b.n));
  const chunks = []; for (let k = 0; k < all.length; k += CHUNK) chunks.push(all.slice(k, k + CHUNK));
  chunks.forEach((c, k) => batch.set(col.doc(`pkReport-${gid}-${k}`), { j: JSON.stringify(c), k, b: gid, at: Date.now() }));
  for (let k = chunks.length; k < 12; k++) batch.delete(col.doc(`pkReport-${gid}-${k}`));   // purane faltu chunk
  brOut.push({ id: gid, name: bm[gid], n: all.length, lines: lines.length, chunks: chunks.length });
  log(`  ${bm[gid]} (#${gid}): ${lines.length} lines · ${all.length} items`);
  }
  for (let k = 0; k < 12; k++) batch.delete(col.doc('pkReport-' + k));   // v1.0 wale purane chunk
  batch.set(col.doc('pkReport'), { at: Date.now(), from: `${from.getFullYear()}-${p2(from.getMonth() + 1)}-01`, to: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`, months: months.join(','), branches: brOut, scanCol, how: scanCol ? 'scan' : 'size', lines: linesAll.length, reqAt: reqAt || 0, v: 3 });
  await batch.commit();
  log(`✅ ${brOut.length} branches (${brOut.map(b => b.name).join(', ')}) · ${months.join(' ')} · scan: ${scanCol || 'nahi (packet-size se)'}`);
}
let lastRun = 0;
const tick = ZINDA.guard(async () => {
  const meta = (await col.doc('pkReport').get()).data() || {}, req = (await col.doc('pkReq').get()).data() || {};
  const reqAt = Number(req.at) || 0, due = Date.now() - (Number(meta.at) || 0) > EVERY || reqAt > (Number(meta.reqAt) || 0) || Number(meta.v || 0) < 3;   // v1.2: purani (sirf Godam 2) report ho to foran nayi
  if (!due || Date.now() - lastRun < 5 * 60000) return;
  lastRun = Date.now(); let pool;
  try { pool = await sql.connect(SQL_CONFIG); await build(pool, reqAt); }
  catch (e) { log('❌ ' + (e.message || e)); await col.doc('pkReport').set({ err: String(e.message || e).slice(0, 300), errAt: Date.now() }, { merge: true }).catch(() => {}); }
  finally { try { await pool?.close(); } catch {} }
}, 8 * 60000, 'tick');
if (require.main === module) {
  const lock = require('net').createServer();
  lock.once('error', () => { console.log('pk-report pehle se chal raha hai.'); process.exit(3); });
  lock.listen(47837, '127.0.0.1', () => { log('pk-report v1.0 shuru — Godam 2 packet report, har ghante / taza-karo par'); tick().catch(e => log('tick: ' + (e.message || e))); setInterval(() => tick().catch(e => log('tick: ' + (e.message || e))), 2 * 60000); });
}
module.exports = { monthsOf };
