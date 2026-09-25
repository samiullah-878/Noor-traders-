// =========================================================
//  subcode-sync.js  v1  (2026-09-20) — Blue Khata app se POS ke SUB-BARCODE banana / badalna / hatana
//  App (Stock -> item -> 🏷️ Label -> + Naya barcode / ✏️ / 🗑️) Firestore "subcodeJobs" mein hukum likhti hai.
//  Yeh script POS ke APNE procedures se kaam karti hai (usp_ItemSubCode_InsertUpdate / usp_ItemSubCode_Delete)
//  — bilkul waise jaise POS ki Items screen ka Add / Del button. Sirf dbo.ItemSubCode table badalti hai, aur kuch nahi.
//  Chalana:  node subcode-sync.js        (subcode-auto.bat loop mein chalata hai)
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47817;

const DIR = __dirname;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const jobCol = db.collection('businesses').doc(BUSINESS_ID).collection('subcodeJobs');

let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const cleanCode = c => String(c ?? '').trim().replace(/\s+/g, ' ').slice(0, 50);

// Barcode kisi aur jagah to nahi (Items.ItemCode ya doosra sub-barcode)?
async function whereUsed(p, code, skipSubId) {
  const a = (await p.request().input('c', sql.VarChar(50), code).query(
    `SELECT TOP 1 ItemName FROM dbo.Items WHERE LTRIM(RTRIM(ItemCode)) = @c`)).recordset[0];
  if (a) return `item "${String(a.ItemName).trim()}" ka asal code`;
  const b = (await p.request().input('c', sql.VarChar(50), code).input('s', sql.Int, skipSubId || 0).query(
    `SELECT TOP 1 i.ItemName FROM dbo.ItemSubCode sc JOIN dbo.Items i ON i.ItemID = sc.ItemID
     WHERE LTRIM(RTRIM(sc.SBBarCode)) = @c AND sc.ItemSubCodeID <> @s`)).recordset[0];
  if (b) return `item "${String(b.ItemName).trim()}" ka sub-barcode`;
  return '';
}

async function run(j) {
  const p = await getPool();
  const itemId = Number(j.itemId);
  const item = (await p.request().input('i', sql.Int, itemId).query('SELECT ItemID, ItemName FROM dbo.Items WHERE ItemID = @i')).recordset[0];
  if (!item) throw new Error('Item POS mein nahi mila (ID ' + itemId + ')');
  const name = String(item.ItemName).trim();
  if (j.op === 'delete') {
    const subId = Number(j.subId);
    const own = (await p.request().input('s', sql.Int, subId).input('i', sql.Int, itemId).query(
      'SELECT SBBarCode FROM dbo.ItemSubCode WHERE ItemSubCodeID = @s AND ItemID = @i')).recordset[0];
    if (!own) throw new Error('Yeh barcode is item ka nahi / pehle se hata hua hai');
    await p.request().input('s', sql.Int, subId).execute('dbo.usp_ItemSubCode_Delete');
    return { subId, code: String(own.SBBarCode).trim(), name };
  }
  const code = cleanCode(j.code);
  if (!code) throw new Error('Barcode khali hai');
  const qty = r3(j.qty); if (!(qty > 0)) throw new Error('Tadad 0 se zyada honi chahiye');
  const subId = j.op === 'edit' ? Number(j.subId) : 0;
  if (j.op === 'edit') {
    const own = (await p.request().input('s', sql.Int, subId).input('i', sql.Int, itemId).query(
      'SELECT 1 AS x FROM dbo.ItemSubCode WHERE ItemSubCodeID = @s AND ItemID = @i')).recordset[0];
    if (!own) throw new Error('Yeh barcode is item ka nahi / pehle se hata hua hai');
  }
  const used = await whereUsed(p, code, subId);
  if (used) throw new Error(`"${code}" pehle se ${used} hai`);
  const r = await p.request()
    .input('ItemSubCodeID', sql.Int, subId).input('ItemID', sql.Int, itemId)
    .input('SBBarCode', sql.VarChar(50), code).input('SBSaleRate', sql.Float, r2(j.rate))
    .input('SBItemQty', sql.Float, qty).input('IsShowOnLookup', sql.Bit, j.show !== false)
    .execute('dbo.usp_ItemSubCode_InsertUpdate');
  const newId = subId || Number(Object.values((r.recordset || [])[0] || {})[0]) || 0;
  return { subId: newId, code, name };
}

const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => log('Masla: ' + e.message)); };
async function handle(doc) {
  if (busy.has(doc.id)) return;
  busy.add(doc.id);
  try {
    const ref = jobCol.doc(doc.id);
    const j = await db.runTransaction(async t => {
      const cur = (await t.get(ref)).data();
      if (!cur || cur.status !== 'new') return null;
      t.update(ref, { status: 'working', pc: os.hostname(), pickedAt: Date.now() });
      return cur;
    });
    if (!j) return;
    try {
      const r = await run(j);
      await ref.update({ status: 'done', subId: r.subId, code: r.code, doneAt: Date.now(), error: FieldValue.delete() });
      log(`${j.op === 'delete' ? 'Hataya' : j.op === 'edit' ? 'Badla' : 'Banaya'}: ${r.name} · ${r.code}${j.op !== 'delete' ? ' · tadad ' + r3(j.qty) + (j.show === false ? ' · Show off' : '') : ''}`);
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 200), doneAt: Date.now() });
      log(`NAHI hua (${j.op} ${j.code || j.subId}): ${e.message}`);
    }
  } finally { busy.delete(doc.id); }
}

const lock = net.createServer();
lock.once('error', () => { console.log('subcode-sync pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', async () => {
  try { await getPool(); } catch (e) { log('SQL se nahi jura: ' + e.message); process.exit(1); }
  log('subcode-sync v1 chal raha hai — app ke barcode hukum ka intezar. Band: Ctrl+C');
  jobCol.where('status', '==', 'new').onSnapshot(s => {
    s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handle(c.doc)); });
  }, e => { log('Listener toot gaya: ' + e.message + ' — band, bat 30 second mein dobara chalayega'); process.exit(1); });
});
