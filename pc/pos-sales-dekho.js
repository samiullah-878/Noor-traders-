// =========================================================
//  pos-sales-dekho.js  v1.1 (2026-10-03: har 10 sec, pehle chhota sawal) · v1  (2026-10-03) — POS par bane AAJ ke SALE BILLS app mein (sirf SELECT, POS mein kuch nahi badalta)
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
const EVERY = 10 * 1000;            // v1.1: 10 sec — pehle sirf ginti/aakhri bill dekhta hai, badle to poori list
const FULL_EVERY = 5 * 60 * 1000;    // phir bhi har 5 min poori list (koi badlaav na chhoote)
let lastKey = '', lastFull = 0;
const LOCK_PORT = 47824;
const DIR = __dirname;
// HEARTBEAT (doctor v2.3+): har 30 sec
{ const _hb = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const _w = () => { try { fs.writeFileSync(_hb, String(Date.now())); } catch {} }; _w(); setInterval(_w, 30000).unref(); }
const log = (...a) => { const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' '); console.log(line); try { fs.appendFileSync(path.join(DIR, 'pos-sales-log.txt'), line + '\r\n'); } catch {} };
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('posSales');
let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const dayOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let lastHash = '';

async function once() {
  const p = await getPool();
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const k = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT COUNT(*) AS C, MAX(SaleID) AS M, SUM(CASE WHEN DocStatusID = 3 THEN 1 ELSE 0 END) AS X, SUM(CAST(TotalSale AS FLOAT)) AS T, SUM(CAST(CashReceived AS FLOAT)) AS R
    FROM dbo.Sale WHERE SaleDate >= @a AND SaleDate < @b`)).recordset[0] || {};
  const key = `${dayOf(d0)}|${k.C}|${k.M}|${k.X}|${Math.round(k.T || 0)}|${Math.round(k.R || 0)}`;
  if (key === lastKey && Date.now() - lastFull < FULL_EVERY) return;   // kuch nahi badla
  lastKey = key; lastFull = Date.now();
  const rows = (await p.request().input('a', sql.DateTime, d0).input('b', sql.DateTime, d1).query(`
    SELECT s.SaleID, s.SaleNo, s.SaleDate, s.TotalSale, s.CashReceived, s.IsCreditSale, s.DocStatusID, s.Description, pt.PartyName,
           (SELECT COUNT(*) FROM dbo.SaleDetail d WHERE d.SaleID = s.SaleID) AS N
    FROM dbo.Sale s LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID
    WHERE s.SaleDate >= @a AND s.SaleDate < @b ORDER BY s.SaleID DESC`)).recordset;
  const bills = rows.slice(0, 600).map(r => {
    const desc = String(r.Description || ''), m = desc.match(/BK-APP[ :]([A-Za-z0-9_-]+)/);
    return { id: r.SaleID, no: String(r.SaleNo || '').trim(), t: r2(r.TotalSale), c: r2(r.CashReceived), cr: r.IsCreditSale ? 1 : 0,
      x: Number(r.DocStatusID) === 3 ? 1 : 0, p: String(r.PartyName || '').slice(0, 60), n: Number(r.N) || 0,
      tm: r.SaleDate ? new Date(r.SaleDate).getTime() : 0, app: m ? m[1] : '' };
  });
  const day = dayOf(d0), hash = day + JSON.stringify(bills);
  if (hash === lastHash) return;
  await col.doc(day).set({ day, at: Date.now(), bills });
  lastHash = hash;
  log(`Aaj ke ${bills.length} POS bills app mein (cancel ${bills.filter(b => b.x).length}, udhaar ${bills.filter(b => b.cr && !b.x).length})`);
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('pos-sales-dekho pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('pos-sales-dekho v1.1 chal raha hai — har 10 second (sirf badlaav par likhta hai)…');
  const tick = async () => { try { await once(); } catch (e) { log('Masla: ' + e.message); if (e.code === 16 || /UNAUTHENTICATED/.test(String(e.message))) process.exit(1); } };
  await tick();
  setInterval(tick, EVERY);
});
