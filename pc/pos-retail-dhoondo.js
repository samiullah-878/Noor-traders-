// pos-retail-dhoondo.js (2026-10-07) — SIRF PARHNA: POS mein "Retail" (company ki likhi qeemat) ka khana kaunsa hai?
// Chalana (server PC): cd C:\khata-sync; irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/pos-retail-dhoondo.js -OutFile pos-retail-dhoondo.js; node pos-retail-dhoondo.js
// 1) Items / ItemBranchRate / ItemSubCode ke rate / price / retail / mrp wale columns  2) ek item (softlan, ya diya hua code) ke un ki qeematein
// Kuch LIKHTA / BADALTA NAHI.
const sql = require('mssql');
const code = process.argv[2] || '8886950018058';
(async () => {
  const pool = await new sql.ConnectionPool(require('./sql-config.js')).connect();
  const cols = (await pool.request().query(`SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('Items','ItemBranchRate','ItemSubCode')
      AND (COLUMN_NAME LIKE '%Retail%' OR COLUMN_NAME LIKE '%MRP%' OR COLUMN_NAME LIKE '%Print%' OR COLUMN_NAME LIKE '%Rate%' OR COLUMN_NAME LIKE '%Price%' OR COLUMN_NAME LIKE '%Consumer%' OR COLUMN_NAME LIKE '%List%')
      AND DATA_TYPE IN ('money','decimal','numeric','float','real','int','bigint','smallmoney')
    ORDER BY TABLE_NAME, COLUMN_NAME`)).recordset;
  console.log('\n=== POS ke rate / retail wale khane ==='); console.table(cols);
  const it = (await pool.request().input('c', sql.VarChar(50), code).query(`SELECT TOP 1 ItemID, ItemName FROM dbo.Items WHERE ItemCode=@c
    UNION ALL SELECT TOP 1 s.ItemID, i.ItemName FROM dbo.ItemSubCode s JOIN dbo.Items i ON i.ItemID=s.ItemID WHERE s.SBBarCode=@c`)).recordset[0];
  if (!it) { console.log('\nItem code ' + code + ' nahi mila — node pos-retail-dhoondo.js <barcode>'); process.exit(0); }
  console.log(`\n=== ${it.ItemName} (ItemID ${it.ItemID}) — har khane ki qeemat ===`);
  for (const t of ['Items', 'ItemBranchRate']) {
    const cs = cols.filter(x => x.t === t).map(x => '[' + x.c + ']'); if (!cs.length) continue;
    const rows = (await pool.request().input('id', sql.Int, it.ItemID).query(`SELECT ${t === 'ItemBranchRate' ? 'BranchID, ' : ''}${cs.join(', ')} FROM dbo.${t} WHERE ItemID = @id`)).recordset;
    console.log('\n' + t + ':'); console.table(rows);
  }
  await pool.close(); process.exit(0);
})().catch(e => { console.log('Masla: ' + e.message); process.exit(1); });
