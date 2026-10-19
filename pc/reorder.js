// =========================================================
//  reorder.js  v1.1 (2026-10-20) — aakhri 6 purchase + har ek ka rate (r = avg); har 1 min (malik: 'stock ki tarah'). v1.0 (2026-10-19) — 🛒 MANGWAO (supplier se re-order) — malik: "godam ka stock sahi hai; usi ka re-order supplier se kaise dekhein —
//    aakhri purchase kab hui, kitna aaya, us waqt kitna stock tha → poora (100%) = us waqt + aaya; chips 10/20/30/40% reh gaya".
//  Har item (jo 365 din mein khareeda gaya): aakhri 3 purchase (Purchase + PurchaseDetail, cancel nahi): tareekh, tadad (pcs), party, aur us waqt
//  (purchase se theek pehle) SAB branches ka kul stock = abhi ka kul − ledger ka net (LedgerDate >= purchase date). Abhi ka stock branch-war.
//  Firestore posStats/reorder { at, h, n, j: JSON [{ i, n, pk, st:{branch:stock}, s30, h:[{at, q, pre, p, pid, r}] (naya pehle, 6 tak; r = us bill ka avg rate) }] }.
//  SQL mein KUCH NAHI likhta — sirf SELECT. Badla na ho to 10 min tak Firestore mein nahi likhta. Har 1 min (reorder-auto.bat); badla na ho to 10 min tak Firestore mein nahi likhta.
// =========================================================
const sql = require('mssql');
const crypto = require('crypto');
const SQL_CONFIG = { ...require('./sql-config.js') };
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const DAYS = 365, KEEP = 6;

async function read(p, now = new Date()) {
  const since = new Date(now); since.setDate(since.getDate() - DAYS);
  const s30 = new Date(now); s30.setDate(s30.getDate() - 30);
  // aakhri 3 purchase fi item (ek bill mein ek item kai line ho to jor)
  const pr = (await p.request().input('a', sql.DateTime, since).query(`
    WITH P AS (
      SELECT d.ItemID, p.PurchaseID, p.PurchaseDate, p.PartyID, SUM(d.Qty) AS Q, SUM(CAST(d.Qty AS FLOAT) * CAST(ISNULL(d.Rate, 0) AS FLOAT)) / NULLIF(SUM(CAST(d.Qty AS FLOAT)), 0) AS R
      FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID
      WHERE p.PurchaseDate >= @a AND ISNULL(p.DocStatusID, 0) <> 3 AND d.Qty > 0
      GROUP BY d.ItemID, p.PurchaseID, p.PurchaseDate, p.PartyID),
    R AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY PurchaseDate DESC, PurchaseID DESC) AS rn FROM P)
    SELECT R.ItemID, R.PurchaseDate, R.Q, R.R, R.PartyID, pt.PartyName,
      (SELECT ISNULL(SUM(ISNULL(l.QtyIn, 0) - ISNULL(l.QtyOut, 0)), 0) FROM dbo.StockLedger l WHERE l.ItemID = R.ItemID AND l.LedgerDate >= R.PurchaseDate) AS NetAfter
    FROM R LEFT JOIN dbo.Party pt ON pt.PartyID = R.PartyID WHERE R.rn <= ${KEEP} ORDER BY R.ItemID, R.rn`)).recordset;
  if (!pr.length) return [];
  const ids = [...new Set(pr.map(r => Number(r.ItemID)))];
  const st = (await p.request().query(`SELECT r.ItemID, r.BranchID, ISNULL(r.CurrStock, 0) AS St, i.ItemName, ISNULL(i.PackQty, 0) AS Pack
    FROM dbo.ItemBranchRate r JOIN dbo.Items i ON i.ItemID = r.ItemID WHERE r.ItemID IN (${ids.join(',')})`)).recordset;
  const sold = (await p.request().input('a', sql.DateTime, s30).query(`SELECT d.ItemID, SUM(d.Qty) AS q FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID
    WHERE s.SaleDate >= @a AND ISNULL(s.DocStatusID, 0) <> 3 AND d.ItemID IN (${ids.join(',')}) GROUP BY d.ItemID`)).recordset;
  const by = new Map();
  for (const r of st) { const id = Number(r.ItemID); if (!by.has(id)) by.set(id, { i: id, n: String(r.ItemName || '').trim().slice(0, 70), pk: Number(r.Pack) || 0, st: {}, s30: 0, h: [] }); by.get(id).st[Number(r.BranchID)] = r3(r.St); }
  for (const r of sold) { const x = by.get(Number(r.ItemID)); if (x) x.s30 = r3(r.q); }
  for (const r of pr) { const x = by.get(Number(r.ItemID)); if (!x) continue; const cur = Object.values(x.st).reduce((t, v) => t + v, 0);
    x.h.push({ at: new Date(r.PurchaseDate).getTime(), q: r3(r.Q), pre: r3(cur - Number(r.NetAfter || 0)), p: String(r.PartyName || '').trim().slice(0, 50), pid: Number(r.PartyID) || 0, r: Math.round((Number(r.R) || 0) * 100) / 100 }); }
  return [...by.values()].filter(x => x.h.length);
}
module.exports = { read };

if (require.main === module) (async () => {
  let pool; const t0 = Date.now();
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
    pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    const rows = await read(pool);
    await pool.close(); pool = null;
    const ref = getFirestore().collection('businesses').doc('noor-traders').collection('posStats').doc('reorder');
    const j = JSON.stringify(rows), h = crypto.createHash('sha1').update(j).digest('hex');
    if (j.length > 900000) throw new Error('data bohat bara (' + j.length + ')');
    let old = null; try { const o = await ref.get(); old = o.exists ? o.data() : null; } catch {}
    if (old && old.h === h && Date.now() - (Number(old.at) || 0) < 10 * 60000) { console.log(new Date().toLocaleString('en-PK') + ' — 🛒 wahi (' + rows.length + ')'); process.exit(0); }
    await ref.set({ at: Date.now(), h, n: rows.length, j });
    console.log(new Date().toLocaleString('en-PK') + ' — 🛒 reorder: ' + rows.length + ' items, ' + Math.round((Date.now() - t0) / 1000) + 's');
    process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
