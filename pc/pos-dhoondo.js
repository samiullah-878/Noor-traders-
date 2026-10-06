// pos-dhoondo.js v1.0 (2026-10-06) — sirf PARHTA hai (POS mein kuch nahi likhta).
// Sawal: POS bill mein item add karte hi (save se PEHLE) SQL mein kuch likhta hai? Agar haan, to kis table mein —
// taake har add par PC se "beep" ho sake (scan ho ya code likh kar).
// Chalana: node pos-dhoondo.js  -> pehli ginti -> "POS mein 2-3 item add karein (SAVE NAHI), phir Enter" -> farq dikhata hai.
const sql = require('mssql');
const cfg = require('./sql-config.js');
cfg.options = { ...(cfg.options || {}), useUTC: false };
const Q = `SELECT s.name + '.' + t.name AS T, SUM(p.rows) AS N FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) GROUP BY s.name, t.name`;
const TQ = `SELECT name AS T, create_date AS C FROM tempdb.sys.tables WHERE name LIKE '#%'`;
(async () => {
  const pool = await new sql.ConnectionPool(cfg).connect();
  const snap = async () => new Map((await pool.request().query(Q)).recordset.map(r => [r.T, Number(r.N)]));
  const a = await snap(), ta = (await pool.request().query(TQ)).recordset.length;
  console.log(`\nPehli ginti: ${a.size} tables.`);
  console.log('>>> Ab POS mein naya bill kholein, 2-3 ITEM ADD karein (scan ya code likh kar) — SAVE NA KAREIN. Phir yahan ENTER dabayein.');
  await new Promise(r => process.stdin.once('data', r));
  const b = await snap(), tb = (await pool.request().query(TQ)).recordset.length;
  const diff = [...b].filter(([t, n]) => (a.get(t) ?? 0) !== n).map(([t, n]) => `${t}: ${a.get(t) ?? 0} -> ${n}`);
  console.log('\n===== NATIJA =====');
  if (diff.length) { console.log('In tables mein badlaav hua:'); diff.forEach(x => console.log('  ' + x)); }
  else console.log('Kisi table mein kuch NAHI badla — POS item add par SQL mein nahi likhta (sirf save par).');
  console.log(`(temp tables: ${ta} -> ${tb})`);
  console.log('Is screen ki tasveer bhejein.');
  await pool.close(); process.exit(0);
})().catch(e => { console.log('Masla: ' + e.message); process.exit(1); });
