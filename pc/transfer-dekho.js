// =========================================================
//  transfer-dekho.js  v1  (2026-09-24) — POS ke STOCK TRANSFER app mein dikhane ke liye
//  POS ki dbo.StockTransfer + StockTransferDetail parhta hai (sirf SELECT — POS mein kuch nahi badalta)
//  aur pichhle DIN din ke transfer Firestore `posTransfers` mein rakhta hai. App ki
//  "📥 Aaya / gaya maal" screen wahi se dikhati hai — chahe transfer POS par bana ho ya app se.
//  App se bane transfer par SystemNotes mein "BK-APP" hota hai -> app:true (do dafa na dikhe).
//  Chalana: node transfer-dekho.js   (transfer-dekho-auto.bat loop mein). Log: transfer-dekho-log.txt
//  Lock port 47822.
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const DIN = 14;                 // kitne din ke transfer app mein rakhne hain
const EVERY = 2 * 60 * 1000;    // har 2 minute
const LOCK_PORT = 47822;

const DIR = __dirname;
const log = (...a) => {
  const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' ');
  console.log(line);
  try { fs.appendFileSync(path.join(DIR, 'transfer-dekho-log.txt'), line + '\r\n'); } catch {}
};
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('posTransfers');

let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;

let lastSent = new Map();       // TransferID -> kitni lines bheji thin (dobara na bhejein)

async function once() {
  const p = await getPool();
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DIN - 1));
  const heads = (await p.request().input('d', sql.DateTime, since).query(`
    SELECT t.TransferID, t.FromBranchID, t.ToBranchID, t.TransferNo, t.TransferDate, t.CreatedOn,
           t.Description, t.Remarks, t.SystemNotes
    FROM dbo.StockTransfer t WHERE t.TransferDate >= @d ORDER BY t.TransferID`)).recordset;
  if (!heads.length) return;

  const ids = heads.map(h => h.TransferID);
  const lines = (await p.request().input('d', sql.DateTime, since).query(`
    SELECT d.TransferID, d.ItemID, d.Qty, d.Rate, d.TransferRate, i.ItemName, i.PackQty
    FROM dbo.StockTransferDetail d
    JOIN dbo.StockTransfer t ON t.TransferID = d.TransferID
    LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID
    WHERE t.TransferDate >= @d`)).recordset;
  const byId = new Map();
  for (const l of lines) {
    if (!(Number(l.Qty) > 0)) continue;
    const a = byId.get(l.TransferID) || []; a.push(l); byId.set(l.TransferID, a);
  }

  let n = 0, batch = db.batch(), inBatch = 0;
  const keep = new Set();
  for (const h of heads) {
    const ls = byId.get(h.TransferID) || [];
    if (!ls.length) continue;
    const id = 'T' + h.TransferID;
    keep.add(id);
    if (lastSent.get(h.TransferID) === ls.length) continue;      // pehle jaisa hi hai
    const at = new Date(h.TransferDate || h.CreatedOn || Date.now()).getTime();
    batch.set(col.doc(id), {
      transferId: Number(h.TransferID),
      transferNo: String(h.TransferNo || '').trim(),
      from: Number(h.FromBranchID) || 0,
      to: Number(h.ToBranchID) || 0,
      at, day: new Date(at).toISOString().slice(0, 10),
      app: /BK-APP/i.test(String(h.SystemNotes || '')) || String(h.Remarks || '').trim().toLowerCase() === 'app',
      note: String(h.Description || h.Remarks || '').slice(0, 120),
      lines: ls.slice(0, 200).map(l => ({
        itemId: String(l.ItemID), name: String(l.ItemName || '').trim().slice(0, 120),
        qty: r3(l.Qty), pack: Number(l.PackQty) || 0,
        rate: r3(l.TransferRate || l.Rate),
      })),
      syncedAt: Date.now(),
    }, { merge: true });
    lastSent.set(h.TransferID, ls.length);
    n++; inBatch++;
    if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) await batch.commit();

  // purane hata do (DIN din se bahar)
  const old = await col.where('at', '<', since.getTime()).limit(300).get();
  if (!old.empty) {
    let b2 = db.batch(); old.docs.forEach(d => b2.delete(d.ref)); await b2.commit();
    log(`${old.size} purane transfer hataye`);
  }
  if (n) log(`${n} transfer app mein bheje (kul ${heads.length} pichhle ${DIN} din ke)`);
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('transfer-dekho pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log(`transfer-dekho chal raha hai — har ${EVERY / 60000} minute POS ke transfer app mein…`);
  const tick = async () => { try { await once(); } catch (e) { log('Masla: ' + e.message); } };
  await tick();
  setInterval(tick, EVERY);
});
