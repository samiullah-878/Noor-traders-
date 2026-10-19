// =========================================================
//  irep-today.js  v1.1 (2026-10-19: 📅 kal ka data bhi — posStats/irep-kal) · v1.0 (2026-10-17) — ⚡ ITEM REPORT ka AAJ ka data har 10 minute (irep-today-auto.bat)
//  Malik: "aaj ka data nahi aa raha". Poori 3 mahine ki report (sales-stats.js -> item-report.run) har ghante hi banti hai;
//  yeh sirf AAJ ki bikri posStats/irep-today mein likhta hai (item-report.runToday). App dono ko jor kar dikhati hai.
//  SQL mein KUCH NAHI likhti — sirf SELECT. Badla na ho to Firestore mein dobara nahi likhti (30 min mein ek dafa 'zinda').
// =========================================================
const sql = require('mssql');
const SQL_CONFIG = { ...require('./sql-config.js') };
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
(async () => {
  let pool;
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(require('./firebase-key.json')) });
    pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    await require('./item-report.js').runToday({ pool, sql, db: getFirestore() });
    try { await require('./item-report.js').runKal({ pool, sql, db: getFirestore() }); } catch (e) { console.log('📅 kal ka data nahi bana: ' + (e?.message || e)); }   // v1.1: 📅 kal bhi (ghante mein ek dafa)
    await pool.close(); process.exit(0);
  } catch (e) { console.log(new Date().toLocaleString('en-PK') + ' — GALTI: ' + (e?.message || e)); try { await pool?.close(); } catch {} process.exit(1); }
})();
