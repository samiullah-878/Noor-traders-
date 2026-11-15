// =========================================================
//  larka-stats.js  v3 (2026-11-15, malik: 'Godam 1 / 2 / 3 se jo items bikein wo larkon ki sale mein NA aayein — apps mein aur WhatsApp par wohi report'):
//    LARKA (SP Man) ki sale = bill ka total MINUS wo lines jin ka godam (SaleDetail.GBranchID, na ho = bill ki branch) naam mein 'godam' rakhta ho;
//    jis bill ki sab lines godam ki hon wo bill ginti mein bhi nahi. POS user wala hissa pehle jaisa. SQL na chale = purana hisaab (report kabhi na ruke) + j.gd 0.
//  v2 (2026-10-13 raat: 📦 WHOLESALE alag — malik: "larkon ki sale screen par wholesale ke bill ke baghair / saath, check box".
//                     'whole sale' party ke bill: sum.larka.wdays / wbina, sum.user.wdays (sirf wholesale ka hissa — app minus karti hai)
//                     aur har bill ke aakhir mein 8th khana ws (1 = wholesale). v: 2) · v1 (2026-10-13) — LARKA SALE REPORT app ke liye: POS -> Firestore posStats (har 5 minute, larka-auto.bat)
//  Wohi hisaab jo larka-report\larka-report.js v3 (larka-report.html) banata hai — ab app ki "👦 Larka Sale" screen mein bhi.
//    Larka (SP Man) = Sale.SupplyManID · POS user = Sale.CreatedBy -> Users.FullName. Cancel (DocStatusID 3) nahi ginay jate;
//    POS user mein "stock fraq" party ke bills bhi nahi.
//  SQL mein KUCH NAHI likhti — sirf SELECT. Chalana: node larka-stats.js   (--dekho = sirf dikhao, Firestore mein kuch nahi)
//  posStats/larka        { at, v, j }   j = JSON: { larka: { men:[{id,name}], days:[[din,id,bills,total]], bina:[[din,bills,total]] },
//                                                    user:  { men, days } }           (din-wise total shuru se)
//  posStats/larka-bills  { at, v, j }   j = JSON: { larka: { from, days, bills:[[billNo,din,waqt,id,total,udhaar,customer]] }, user: {...} }
//  (j = JSON ki string: Firestore list ke andar list nahi rakhta. App ka getPosStats in dono ko chhor deta hai — in mein 'items' nahi.)
//  Bills ki list: larka 90 din, POS user 3 din (roz 300+ bill) — doc chhota rahe. Na badle to larka-bills dobara nahi likhti.
// =========================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');

const DEKHO = process.argv.includes('--dekho');
const SQL_CONFIG = { ...require('./sql-config.js') };
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
const BILL_DAYS = 90, USER_BILL_DAYS = 3, MAX_BILLS = 2500, MAX_JSON = 900000;
const STATE_FILE = path.join(__dirname, 'last-larka.json');

const p2 = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const toDate = s => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const rs = v => Math.round(Number(v) || 0);
const hashOf = s => crypto.createHash('sha1').update(s).digest('hex');
const ago = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };

const gdSrc = cond => `(SELECT s0.SaleID, s0.SaleNo, s0.SaleDate, s0.SupplyManID, s0.CreatedBy, s0.PartyID, s0.DocStatusID, s0.IsCreditSale, s0.BranchID,
    CASE WHEN CAST(s0.TotalSale AS FLOAT) - ISNULL(g.GA, 0) < 0 THEN 0 ELSE CAST(s0.TotalSale AS FLOAT) - ISNULL(g.GA, 0) END AS TotalSale
  FROM dbo.Sale s0 LEFT JOIN (SELECT d.SaleID,
      SUM(CASE WHEN LOWER(ISNULL(b.BranchName, '')) LIKE '%godam%' THEN CAST(d.Qty AS FLOAT) * CAST(d.Rate AS FLOAT) ELSE 0 END) AS GA,
      SUM(CASE WHEN LOWER(ISNULL(b.BranchName, '')) LIKE '%godam%' THEN 0 ELSE 1 END) AS DN
    FROM dbo.SaleDetail d JOIN dbo.Sale h ON h.SaleID = d.SaleID LEFT JOIN dbo.Branch b ON b.BranchID = ISNULL(NULLIF(d.GBranchID, 0), h.BranchID)
    ${cond ? 'WHERE ' + cond : ''} GROUP BY d.SaleID) g ON g.SaleID = s0.SaleID WHERE ISNULL(g.DN, 1) > 0)`;
async function read(p, gd = true) {
  const men = (await p.request().query('SELECT SupplyManID, SupplyManName FROM dbo.SupplyMan ORDER BY SupplyManName')).recordset
    .map(r => ({ id: r.SupplyManID, name: String(r.SupplyManName || '').trim() }));
  // v2: wholesale party ("whole sale", "whole sale (purana)" …) — un ka hissa alag, app "baghair / saath" chun le
  const wsIds = (await p.request().query(`SELECT PartyID FROM dbo.Party WHERE LOWER(PartyName) LIKE '%whole%sale%'`)).recordset.map(r => Number(r.PartyID)).filter(Boolean);
  const inWs = `ISNULL(s.PartyID, 0) IN (${wsIds.length ? wsIds.join(',') : '0'})`;
  let days, first, bina, wdays, wbina;
  if (gd) {   // v3: EK sawal (godam ki lines minus) -> din x larka x wholesale; baqi jor yahin (SaleDetail ka poora chakkar sirf ek dafa)
    const all = (await p.request().query(`
      SELECT CONVERT(char(10), s.SaleDate, 120) AS D, ISNULL(s.SupplyManID, 0) AS M, CASE WHEN ${inWs} THEN 1 ELSE 0 END AS W, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T
      FROM ${gdSrc('')} s WHERE s.DocStatusID <> 3
      GROUP BY CONVERT(char(10), s.SaleDate, 120), ISNULL(s.SupplyManID, 0), CASE WHEN ${inWs} THEN 1 ELSE 0 END`)).recordset;
    const agg = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r), o = m.get(k) || { D: r.D, M: r.M, N: 0, T: 0 }; o.N += Number(r.N) || 0; o.T += Number(r.T) || 0; m.set(k, o); } return [...m.values()]; };
    days = agg(all.filter(r => Number(r.M)), r => r.D + '|' + r.M);
    first = days.reduce((a, r) => (!a || r.D < a ? r.D : a), '');
    bina = first ? agg(all.filter(r => !Number(r.M) && r.D >= first), r => r.D) : [];
    wdays = agg(all.filter(r => Number(r.M) && Number(r.W)), r => r.D + '|' + r.M);
    wbina = first ? agg(all.filter(r => !Number(r.M) && Number(r.W) && r.D >= first), r => r.D) : [];
  } else {   // purana hisaab (poora bill) — sirf jab upar wala sawal POS par na chale
    days = (await p.request().query(`
      SELECT CONVERT(char(10), s.SaleDate, 120) AS D, s.SupplyManID AS M, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T
      FROM dbo.Sale s WHERE ISNULL(s.SupplyManID, 0) <> 0 AND s.DocStatusID <> 3
      GROUP BY CONVERT(char(10), s.SaleDate, 120), s.SupplyManID`)).recordset;
    first = days.reduce((a, r) => (!a || r.D < a ? r.D : a), '');
    bina = first ? (await p.request().input('a', sql.DateTime, toDate(first)).query(`
      SELECT CONVERT(char(10), SaleDate, 120) AS D, COUNT(*) AS N, SUM(CAST(TotalSale AS FLOAT)) AS T FROM dbo.Sale
      WHERE SaleDate >= @a AND ISNULL(SupplyManID, 0) = 0 AND DocStatusID <> 3 GROUP BY CONVERT(char(10), SaleDate, 120)`)).recordset : [];
    wdays = wsIds.length ? (await p.request().query(`
      SELECT CONVERT(char(10), s.SaleDate, 120) AS D, s.SupplyManID AS M, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T
      FROM dbo.Sale s WHERE ISNULL(s.SupplyManID, 0) <> 0 AND s.DocStatusID <> 3 AND ${inWs}
      GROUP BY CONVERT(char(10), s.SaleDate, 120), s.SupplyManID`)).recordset : [];
    wbina = wsIds.length && first ? (await p.request().input('a', sql.DateTime, toDate(first)).query(`
      SELECT CONVERT(char(10), s.SaleDate, 120) AS D, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T FROM dbo.Sale s
      WHERE s.SaleDate >= @a AND ISNULL(s.SupplyManID, 0) = 0 AND s.DocStatusID <> 3 AND ${inWs} GROUP BY CONVERT(char(10), s.SaleDate, 120)`)).recordset : [];
  }
  const since = ago(BILL_DAYS);
  const bills = (await p.request().input('b', sql.DateTime, since).query(`
    SELECT TOP ${MAX_BILLS} s.SaleNo, CONVERT(char(16), s.SaleDate, 120) AS W, s.SupplyManID AS M, s.TotalSale, s.IsCreditSale, pt.PartyName
    FROM ${gd ? gdSrc('h.SaleDate >= @b') : 'dbo.Sale'} s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE ISNULL(s.SupplyManID, 0) <> 0 AND s.DocStatusID <> 3 AND s.SaleDate >= @b ORDER BY s.SaleDate DESC, s.SaleID DESC`)).recordset;

  // ---- POS user (jis login se bill bana = Sale.CreatedBy). "stock fraq" ke bills asal sale nahi (post-farq.js) — nahi ginay jate.
  const farq = (await p.request().query(`SELECT PartyID FROM dbo.Party
    WHERE (LOWER(PartyName) LIKE '%stock%fraq%' OR LOWER(PartyName) LIKE '%stock%farq%')`)).recordset.map(r => Number(r.PartyID)).filter(Boolean);
  const notFarq = `s.PartyID NOT IN (${farq.length ? farq.join(',') : '0'})`;
  const udays = (await p.request().query(`
    SELECT CONVERT(char(10), s.SaleDate, 120) AS D, ISNULL(s.CreatedBy, 0) AS M, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T
    FROM dbo.Sale s WHERE s.DocStatusID <> 3 AND ${notFarq}
    GROUP BY CONVERT(char(10), s.SaleDate, 120), ISNULL(s.CreatedBy, 0)`)).recordset;
  const uwdays = wsIds.length ? (await p.request().query(`
    SELECT CONVERT(char(10), s.SaleDate, 120) AS D, ISNULL(s.CreatedBy, 0) AS M, COUNT(*) AS N, SUM(CAST(s.TotalSale AS FLOAT)) AS T
    FROM dbo.Sale s WHERE s.DocStatusID <> 3 AND ${notFarq} AND ${inWs}
    GROUP BY CONVERT(char(10), s.SaleDate, 120), ISNULL(s.CreatedBy, 0)`)).recordset : [];
  const usince = ago(USER_BILL_DAYS - 1);
  const ubills = (await p.request().input('b', sql.DateTime, usince).query(`
    SELECT TOP ${MAX_BILLS} s.SaleNo, CONVERT(char(16), s.SaleDate, 120) AS W, ISNULL(s.CreatedBy, 0) AS M, s.TotalSale, s.IsCreditSale, pt.PartyName
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE s.DocStatusID <> 3 AND ${notFarq} AND s.SaleDate >= @b ORDER BY s.SaleDate DESC, s.SaleID DESC`)).recordset;
  const sold = new Set(udays.map(r => r.M));
  const users = (await p.request().query('SELECT UserID, FullName, IsActive FROM dbo.Users ORDER BY FullName')).recordset
    .filter(r => r.IsActive || sold.has(r.UserID))            // band user sirf tab jab us ke bills hon
    .map(r => ({ id: r.UserID, name: String(r.FullName || '').trim() }));

  for (const r of days) if (!men.some(m => m.id === r.M)) men.push({ id: r.M, name: 'ID ' + r.M });   // list se mita hua naam
  for (const r of udays) if (!users.some(m => m.id === r.M)) users.push({ id: r.M, name: 'ID ' + r.M });
  const bill = r => [String(r.SaleNo || '').trim(), r.W.slice(0, 10), r.W.slice(11, 16), r.M, rs(r.TotalSale), r.IsCreditSale ? 1 : 0, String(r.PartyName || '').trim().slice(0, 30), /whole\s*sale/i.test(String(r.PartyName || '')) ? 1 : 0];   // v2: 8th = wholesale
  const srt = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);   // hamesha ek hi tarteeb (na badle to hash bhi na badle)
  return {
    sum: { larka: { men, days: days.map(r => [r.D, r.M, r.N, rs(r.T)]).sort(srt), bina: bina.map(r => [r.D, r.N, rs(r.T)]).sort(srt),
                    wdays: wdays.map(r => [r.D, r.M, r.N, rs(r.T)]).sort(srt), wbina: wbina.map(r => [r.D, r.N, rs(r.T)]).sort(srt) },
           user: { men: users, days: udays.map(r => [r.D, r.M, r.N, rs(r.T)]).sort(srt), wdays: uwdays.map(r => [r.D, r.M, r.N, rs(r.T)]).sort(srt) } },
    bills: { larka: { from: dayOf(since), days: BILL_DAYS, bills: bills.map(bill) },
             user: { from: dayOf(usince), days: USER_BILL_DAYS, bills: ubills.map(bill) } } };
}

(async () => {
  const t0 = Date.now(); let pool;
  try {
    pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    let D, gdOk = 1; try { D = await read(pool, true); } catch (e) { gdOk = 0; console.log('⚠ godam ke baghair wala hisaab nahi chala (' + String(e.message || e).slice(0, 160) + ') — purana hisaab'); D = await read(pool, false); }
    D.sum.gd = gdOk;
    await pool.close(); pool = null;
    while (JSON.stringify(D.bills).length > MAX_JSON && D.bills.user.bills.length > 100) D.bills.user.bills.length = Math.floor(D.bills.user.bills.length * 0.8);
    const js = JSON.stringify(D.sum), jb = JSON.stringify(D.bills);
    if (js.length > MAX_JSON) throw Error('din-wise data bohat bara ho gaya (' + js.length + ') — larka-stats.js mein purane din kaatne honge');
    const tot = a => a.reduce((n, r) => n + r[2], 0);
    const line = `larka ${tot(D.sum.larka.days)} bills / ${D.sum.larka.men.length} naam, POS user ${tot(D.sum.user.days)} bills / ${D.sum.user.men.length} user | data ${Math.round(js.length / 1024)} KB + bills ${Math.round(jb.length / 1024)} KB`;
    if (DEKHO) { fs.writeFileSync(path.join(__dirname, 'larka-dekho.json'), JSON.stringify(D)); console.log('DEKHO (Firestore mein kuch nahi likha, data larka-dekho.json mein): ' + line); process.exit(0); }

    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
    const col = getFirestore().collection('businesses').doc('noor-traders').collection('posStats');
    let st = {}; try { st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {}; } catch {}
    const at = Date.now(), hb = hashOf(jb);
    await col.doc('larka').set({ at, v: 2, j: js });
    const billsNew = st.bills !== hb;
    if (billsNew) await col.doc('larka-bills').set({ at, v: 2, j: jb });
    try { fs.writeFileSync(STATE_FILE, JSON.stringify({ bills: hb, at })); } catch {}
    console.log(new Date().toLocaleString('en-PK') + ' — ' + line + (billsNew ? '' : ' (bills wahi)') + ', ' + Math.round((Date.now() - t0) / 1000) + 's');
    process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
