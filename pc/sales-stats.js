// =========================================================
//  sales-stats.js  v1.6 (2026-10-20: ph → phj text (nested array galti, 4 din ruka) + item report alag chale) · v1.5 (2026-10-19: 🧾 stock fraq party + ginti farq bill bikri / khareed mein nahi) · v1.4 (2026-10-17: useUTC false — sham ki sale) · v1.3 (2026-10-14: + 📊 item-report.js — 3 mahine har item har din ginti / Rs / nafa) · v1.2 (2026-10-11: purchase history + mahina-war + mahine ke 4 hisse) · v1.1 (2026-09-28: Noor Traders ke apne bill bahar) · v1 (2026-09-28) — POS ki 6 MAHINE ki BIKRI + PURCHASE, har item ka khulasa -> Firestore posStats
//  App ka "🛒 Purchase order" isi se andaza lagata hai (roz kitna bikta hai, kitne din ka stock baqi, pichhli dafa kis se liya).
//  SQL mein KUCH NAHI likhti — sirf SELECT. Chalana: node sales-stats.js  (SALE-DATA.bat har ghante chalata hai)
//  posStats/meta {at, days, n, chunks, ptDays[4], months[7], parties[]}  ·  posStats/items-<k> {items:[{i, w[26 hafte], s30, s90, s180, p180, pn, lp{d,q,r,party}, ph, mo, pt}]}
//  v1.2 (2026-10-11): 🛒 order formula ke liye —
//    ph = aakhri 12 purchases (1 saal) [[din 'YYYY-MM-DD', tadad, rate, supplier# (meta.parties mein)], ...] naya pehle (ek bill ki kai lines = ek)
//    mo = mahine-war bikri (meta.months jaisi tarteeb: 6 purane + ye mahina)   pt = mahine ke 4 hisson ki bikri (6 mahine): [1-10, 11-20, 21-25, 26-31]
//    meta.ptDays = in 6 mahinon mein har hisse ke kitne din the (app roz ka rate nikalti hai)
// =========================================================
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };   // v1.4 (2026-10-17): 🐞 Pakistan ka waqt — pehle UTC jata tha, sham 7 ke baad ki sale item report mein raat 12 tak nahi aati thi
if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
const db = getFirestore(), col = db.collection('businesses').doc('noor-traders').collection('posStats');
const SKIP = "AND ISNULL(pt.PartyName, '') NOT LIKE '%noor%trader%' AND ISNULL(pt.PartyName, '') NOT LIKE '%our factory%' AND LOWER(ISNULL(pt.PartyName, '')) NOT LIKE '%stock%fraq%' AND LOWER(ISNULL(pt.PartyName, '')) NOT LIKE '%stock%farq%'";   // v1.5: stock fraq bhi
const SKIP_S = SKIP + " AND ISNULL(CAST(s.Description AS NVARCHAR(200)), '') NOT LIKE 'Stock ginti farq%'";   // v1.5: ginti farq ka sale bill   // andar ka lena-dena bikri/khareed nahi
const DAYS = 182, CHUNK = 250, r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;

const Q_SALE = `
SELECT d.ItemID, DATEDIFF(day, s.SaleDate, GETDATE()) / 7 AS wk, SUM(d.Qty) AS q
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP_S}
GROUP BY d.ItemID, DATEDIFF(day, s.SaleDate, GETDATE()) / 7`;
const Q_SALE_DAYS = `
SELECT d.ItemID,
  SUM(CASE WHEN s.SaleDate >= DATEADD(day, -30, GETDATE()) THEN d.Qty ELSE 0 END) AS s30,
  SUM(CASE WHEN s.SaleDate >= DATEADD(day, -90, GETDATE()) THEN d.Qty ELSE 0 END) AS s90,
  SUM(d.Qty) AS s180
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP_S}
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

const Q_PH = `
SELECT x.ItemID, x.d, x.q, x.r, x.party FROM (
  SELECT d.ItemID, p.PurchaseID, MAX(p.PurchaseDate) AS d, SUM(d.Qty) AS q, MAX(d.Rate) AS r, MAX(pt.PartyName) AS party,
    ROW_NUMBER() OVER (PARTITION BY d.ItemID ORDER BY MAX(p.PurchaseDate) DESC, p.PurchaseID DESC) AS rn
  FROM dbo.PurchaseDetail d JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = p.PartyID
  WHERE p.PurchaseDate >= DATEADD(day, -365, GETDATE()) AND ISNULL(p.DocStatusID, 0) <> 3 ${SKIP}
  GROUP BY d.ItemID, p.PurchaseID) x
WHERE x.rn <= 12`;
const Q_MO = `
SELECT d.ItemID, YEAR(s.SaleDate) AS y, MONTH(s.SaleDate) AS m, SUM(d.Qty) AS q
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 6, 0) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP_S}
GROUP BY d.ItemID, YEAR(s.SaleDate), MONTH(s.SaleDate)`;
const Q_PT = `
SELECT d.ItemID, CASE WHEN DAY(s.SaleDate) <= 10 THEN 0 WHEN DAY(s.SaleDate) <= 20 THEN 1 WHEN DAY(s.SaleDate) <= 25 THEN 2 ELSE 3 END AS b, SUM(d.Qty) AS q
FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
WHERE s.SaleDate >= DATEADD(day, -${DAYS}, GETDATE()) AND ISNULL(s.DocStatusID, 0) <> 3 ${SKIP_S}
GROUP BY d.ItemID, CASE WHEN DAY(s.SaleDate) <= 10 THEN 0 WHEN DAY(s.SaleDate) <= 20 THEN 1 WHEN DAY(s.SaleDate) <= 25 THEN 2 ELSE 3 END`;
const partOf = dd => dd <= 10 ? 0 : dd <= 20 ? 1 : dd <= 25 ? 2 : 3;
// 6 mahine (DAYS) mein har hisse ke kitne din — aaj samait
function ptDaysOf(now = new Date()) { const c = [0, 0, 0, 0]; for (let k = 0; k <= DAYS; k++) { const d = new Date(now); d.setDate(d.getDate() - k); c[partOf(d.getDate())]++; } return c; }
// meta.months: 6 purane + ye mahina, 'YYYY-MM'
function monthsOf(now = new Date()) { const out = []; for (let k = 6; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); } return out; }
// SQL ke rows -> items par ph / mo / pt (alag function: test ho sake)
function addExtra(get, { ph = [], mo = [], pt = [] }, now = new Date()) {
  const parties = [], pIdx = new Map(), months = monthsOf(now);
  const pi = name => { const k = String(name || '').trim().slice(0, 80); if (!pIdx.has(k)) { pIdx.set(k, parties.length); parties.push(k); } return pIdx.get(k); };
  const byItem = new Map();
  for (const r of ph) { const k = String(r.ItemID); if (!byItem.has(k)) byItem.set(k, []); byItem.get(k).push([day(r.d), r3(r.q), r3(r.r), pi(r.party)]); }
  for (const [k, L] of byItem) get(k).ph = L.sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  for (const r of mo) { const i = months.indexOf(r.y + '-' + String(r.m).padStart(2, '0')); if (i < 0) continue; const e = get(r.ItemID); if (!e.mo) e.mo = new Array(7).fill(0); e.mo[i] = r3(r.q); }
  for (const r of pt) { const b = Number(r.b); if (!(b >= 0 && b < 4)) continue; const e = get(r.ItemID); if (!e.pt) e.pt = [0, 0, 0, 0]; e.pt[b] = r3(r.q); }
  return { parties, months, ptDays: ptDaysOf(now) };
}
module.exports = { addExtra, ptDaysOf, monthsOf, partOf };
const day = d => { try { const x = new Date(d); if (isNaN(x)) return ''; return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; } catch { return ''; } };   // v1.4: useUTC false = Pakistan ka din (toISOString ek din peeche karta)
if (require.main === module) (async () => {
  const t0 = Date.now(); let pool;
  try {
    pool = await sql.connect(SQL_CONFIG);
    const [sw, sd, pu, la] = await Promise.all([Q_SALE, Q_SALE_DAYS, Q_PUR, Q_LAST].map(q => pool.request().query(q).then(r => r.recordset)));
    const xq = q => pool.request().query(q).then(r => r.recordset).catch(e => { console.log('v1.2 extra query nahi chali: ' + e.message); return []; });   // na chale to purana data phir bhi jaye
    const [ph, mo, pt] = [await xq(Q_PH), await xq(Q_MO), await xq(Q_PT)];
    const M = new Map(), get = id => { const k = String(id); if (!M.has(k)) M.set(k, { i: k, w: new Array(26).fill(0), s30: 0, s90: 0, s180: 0, p180: 0, pn: 0, lp: null }); return M.get(k); };
    for (const r of sw) { const w = Number(r.wk); if (w >= 0 && w < 26) get(r.ItemID).w[w] = r3(r.q); }
    for (const r of sd) { const e = get(r.ItemID); e.s30 = r3(r.s30); e.s90 = r3(r.s90); e.s180 = r3(r.s180); }
    for (const r of pu) { const e = get(r.ItemID); e.p180 = r3(r.q); e.pn = Number(r.n) || 0; }
    for (const r of la) { const e = get(r.ItemID); e.lp = { d: day(r.PurchaseDate), q: r3(r.Qty), r: r3(r.Rate), party: String(r.PartyName || '').trim().slice(0, 80) }; }
    const extra = addExtra(get, { ph, mo, pt });
    for (const e of M.values()) { while (e.w.length && !e.w[e.w.length - 1]) e.w.pop(); }   // khali purane hafte hata do (chhota doc)
    const all = [...M.values()], chunks = [];
    for (let k = 0; k < all.length; k += CHUNK) chunks.push(all.slice(k, k + CHUNK));
    // v1.6 (2026-10-20): FIX — 4 din se 'INVALID_ARGUMENT: Property array contains an invalid nested entity': ph = list ke andar list (Firestore nahi leta)
    //   → ph ab JSON text 'phj' (app cloud.getPosStats wapas ph bana leti hai). Har doc ALAG save (ek fail = baqi bach jayein).
    //   Aur 📊 item report (Commission / Asal nafa) ab is ke fail hone par bhi chalti hai (pehle yahan ki galti use bhi rok deti thi).
    const flat = e => { if (!e.ph) return e; const { ph, ...r } = e; return { ...r, phj: JSON.stringify(ph) }; };
    const errs = [], put = async (id, data) => { try { await col.doc(id).set(data); } catch (e) { errs.push(id + ': ' + String(e?.message || e)); } };
    try {
      for (let k = 0; k < chunks.length; k++) await put('items-' + k, { items: chunks[k].map(flat), at: Date.now() });
      await put('meta', { at: Date.now(), days: DAYS, n: all.length, chunks: chunks.length, ver: '1.6', ptDays: extra.ptDays.map(Number), months: extra.months.map(String), parties: extra.parties.slice(0, 3000).map(String) });
      const old = await col.get();                                     // purane zyada chunks mitao
      for (const d of old.docs) { const m = /^items-(\d+)$/.exec(d.id); if (m && Number(m[1]) >= chunks.length) await d.ref.delete(); }
      console.log(new Date().toLocaleString('en-PK') + ' — posStats: ' + all.length + ' items, ' + chunks.length + ' hisse, ' + Math.round((Date.now() - t0) / 1000) + 's' + (errs.length ? ' · ⚠️ ' + errs.length + ' save nahi: ' + errs[0].slice(0, 200) : ''));
    } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — ⚠️ posStats save: ' + (e?.message || e)); }
    try { await require('./item-report.js').run({ pool, sql, db }); } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — 📊 item report nahi bani: ' + (e?.message || e)); }   // v1.3: 📊 Item Sale Report (app)
    await pool.close(); process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
