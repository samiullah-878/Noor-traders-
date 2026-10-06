// pos-live.js v1.0 (2026-10-06) — sirf PARHTA hai. 2 minute tak har nayi SaleDetail line FORAN dikhata hai (har 0.5 sec):
// waqt · bill · item · bill ka haal (DocStatusID) · kis PC se. Is se pata chalta hai ke POS item add karte hi (save se pehle) likhta hai ya nahi.
const sql = require('mssql');
const cfg = require('./sql-config.js');
cfg.options = { ...(cfg.options || {}), useUTC: false };
(async () => {
  const pool = await new sql.ConnectionPool(cfg).connect();
  let last = Number((await pool.request().query('SELECT MAX(SaleDetailID) AS m FROM dbo.SaleDetail')).recordset[0].m) || 0;
  console.log('\n>>> Ab POS mein naya bill kholein aur EK EK kar ke 3 item add karein (SAVE NAHI). Har item par yahan line aani chahiye.');
  console.log('    (2 minute baad khud band — Ctrl+C se pehle bhi)\n');
  const t0 = Date.now();
  const tick = async () => {
    const r = (await pool.request().input('l', sql.Int, last).query(`SELECT TOP 50 d.SaleDetailID AS D, d.SaleID AS S, d.Qty AS Q, i.ItemName AS N, s.SaleNo AS No, s.DocStatusID AS St,
      CAST(s.SystemNotes AS NVARCHAR(400)) AS SN FROM dbo.SaleDetail d JOIN dbo.Sale s ON s.SaleID = d.SaleID LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID
      WHERE d.SaleDetailID > @l ORDER BY d.SaleDetailID`)).recordset;
    for (const x of r) { last = Math.max(last, x.D); const pc = (String(x.SN || '').match(/at PC:\s*([A-Za-z0-9_.-]+)/i) || [])[1] || '?';
      console.log(`${new Date().toLocaleTimeString()}  bill ${String(x.No || '').trim()} (haal ${x.St})  ${String(x.N || '').trim()} x ${x.Q}  · PC ${pc}`); }
    if (Date.now() - t0 > 120000) { console.log('\nBas — is screen ki tasveer bhejein.'); await pool.close(); process.exit(0); }
    setTimeout(tick, 500);
  };
  tick();
})().catch(e => { console.log('Masla: ' + e.message); process.exit(1); });
