// =========================================================
//  sales-stats.js  v1.1 (2026-09-28: Noor Traders ke apne bill bahar) · v1 (2026-09-28) — POS ki 6 MAHINE ki BIKRI + PURCHASE, har item ka khulasa -> Firestore posStats
//  App ka "🛒 Purchase order" isi se andaza lagata hai (roz kitna bikta hai, kitne din ka stock baqi, pichhli dafa kis se liya).
//  SQL mein KUCH NAHI likhti — sirf SELECT. Chalana: node sales-stats.js  (SALE-DATA.bat har ghante chalata hai)
//  posStats/meta {at, days, n, chunks}  ·  posStats/items-<k> {items:[{i, w[26 hafte], s30, s90, s180, p180, pn, lp{d,q,r,party}}]}
// =========================================================
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const SQL_CONFIG = require('./sql-config.js');
if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
const db = getFirestore(), col = db.collection('businesses').doc('noor-traders').collection('posStats');
const SKIP = "AND ISNULL(pt.PartyName, '') NOT LIKE '%noor%trader%' AND ISNULL(pt.PartyName, '') NOT LIKE '%our factory%'";   // andar ka lena-dena bikri/khareed nahi
const DAYS = 182, CHUNK = 400, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;

const Q_SALE = `
SELECT d.ItemID, DATEDIFF(day, s.SaleDate, GETDATE()) / 7 AS wk, SUM(d.Qty) AS q
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP}
GROUP BY d.ItemID, DATEDIFF(day, s.SaleDate, GETDATE()) / 7`;
const Q_SALE_DAYS = `
SELECT d.ItemID,
  SUM(CASE WHEN s.SaleDate >= DATEADD(day, -30, GETDATE()) THEN d.Qty ELSE 0 END) AS s30,
  SUM(CASE WHEN s.SaleDate >= DATEADD(day, -90, GETDATE()) THEN d.Qty ELSE 0 END) AS s90,
  SUM(d.Qty) AS s180
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP}
GROUP BY d.ItemID`;
const Q_PUR = `
SELECT d.ItemID, SUM(d.Qty) AS q, COUNT(DISTINCT p.PurchaseID) AS n
FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
WHERE p.PurchaseDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(p.DocStatusID, 0) <> 3 ${SKIP}
GROUP BY d.ItemID`;
const Q_LAST = `
SELECT x.ItemID, x.Qty, x.Rate, x.PurchaseDate, x.PartyName FROM (
  SELECT d.ItemID, d.Qty, d.Rate, p.PurchaseDate, pt.PartyName,
    ROW_NUMBER() OVER (PARTITION BY d.ItemID ORDER BY p.PurchaseDate DESC, p.PurchaseID DESC) AS rn
  FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
  WHERE p.PurchaseDate >= DATEADD(day, -365, GETDATE()) AND ISNULL(p.DocStatusID, 0) <> 3 ${SKIP}) x
WHERE x.rn = 1`;

const day = d => { try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; } };
(async () => {
  const t0 = Date.now(); let pool;
  try {
    pool = await sql.connect(SQL_CONFIG);
    const [sw, sd, pu, la] = await Promise.all([Q_SALE, Q_SALE_DAYS, Q_PUR, Q_LAST].map(q => pool.request().query(q).then(r => r.recordset)));
    const M = new Map(), get = id => { const k = String(id); if (!M.has(k)) M.set(k, { i: k, w: new Array(26).fill(0), s30: 0, s90: 0, s180: 0, p180: 0, pn: 0, lp: null }); return M.get(k); };
    for (const r of sw) { const w = Number(r.wk); if (w >= 0 && w < 26) get(r.ItemID).w[w] = r3(r.q); }
    for (const r of sd) { const e = get(r.ItemID); e.s30 = r3(r.s30); e.s90 = r3(r.s90); e.s180 = r3(r.s180); }
    for (const r of pu) { const e = get(r.ItemID); e.p180 = r3(r.q); e.pn = Number(r.n) || 0; }
    for (const r of la) { const e = get(r.ItemID); e.lp = { d: day(r.PurchaseDate), q: r3(r.Qty), r: r3(r.Rate), party: String(r.PartyName || '').trim().slice(0, 80) }; }
    for (const e of M.values()) { while (e.w.length && !e.w[e.w.length - 1]) e.w.pop(); }   // khali purane hafte hata do (chhota doc)
    const all = [...M.values()], chunks = [];
    for (let k = 0; k < all.length; k += CHUNK) chunks.push(all.slice(k, k + CHUNK));
    const b = db.batch();
    chunks.forEach((items, k) => b.set(col.doc('items-' + k), { items, at: Date.now() }));
    b.set(col.doc('meta'), { at: Date.now(), days: DAYS, n: all.length, chunks: chunks.length });
    await b.commit();
    const old = await col.get();                                     // purane zyada chunks mitao
    for (const d of old.docs) { const m = /^items-(\d+)$/.exec(d.id); if (m && Number(m[1]) >= chunks.length) await d.ref.delete(); }
    console.log(new Date().toLocaleString('en-PK') + ' — posStats: ' + all.length + ' items, ' + chunks.length + ' hisse, ' + Math.round((Date.now() - t0) / 1000) + 's');
    await pool.close(); process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
