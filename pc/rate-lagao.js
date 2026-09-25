// =========================================================
//  rate-lagao.js  v1  (2026-09-21) — Blue Khata app se POS mein NAYE RATES
//  App (purchase bill > "📌 Naye rates POS par lagao") rateJobs mein job likhti hai:
//    { lines: [{ itemId, code, name, pack, costP, wctn, wpcs, rctn, rpcs }], status:'new', by, at }
//    (sab RUPAY; costP = khareed fi piece; wctn/rctn = fi carton, wpcs/rpcs = fi piece)
//  Yeh script (sirf malik ki jobs, rules mein bhi sirf malik):
//    dbo.Items + item ki SAB dbo.ItemBranchRate rows:
//      SaleRate      = Parchoon "R Cotton / pack"  (rctn/pack, warna rpcs)
//      SaleRate2     = Parchoon "Peice Rate"       (rpcs)
//      SaleRate3     = Wholesale fi piece          (wctn/pack, warna wpcs)
//      SaleRateSize  = Wholesale "W Peice"         (wpcs)
//      PurchaseRate  = khareed — ItemBranchRate mein hamesha FI PIECE (costP);
//                      Items mein jis convention par pehle se hai usi par (carton wala tha to costP x pack)
//    SystemNotes mein POS jaisi Old/New line jorta hai. Jo khana job mein nahi (0/khali) usay HAATH NAHI lagata.
//  7 din se purani job nahi lagata (failed + wajah). Status: working -> done {applied} / failed {error}.
//  Chalana:  node rate-lagao.js   (rate-auto.bat loop mein). Log: rate-log.txt. Lock port 47819.
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const MAX_JOB_DIN = 7;              // is se purani job nahi lagegi
const LOCK_PORT = 47819;

const DIR = __dirname;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('rateJobs');

let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

// Items.PurchaseRate carton ka hai ya piece ka? (sync-stock wali pehchan)
function costIsCarton(cur, pack, sale) {
  cur = Number(cur) || 0; pack = Number(pack) || 0; sale = Number(sale) || 0;
  if (!(cur > 0) || pack <= 1 || !(sale > 0)) return false;
  const a = cur / pack;
  return Math.abs(Math.log(a / sale)) < Math.abs(Math.log(cur / sale));
}

async function applyRates(j, jobId) {
  const p = await getPool();
  const lines = (Array.isArray(j.lines) ? j.lines : []).filter(l => Number(l.itemId) > 0);
  if (!lines.length) throw new Error('Job mein koi item nahi');
  const tx = new sql.Transaction(p);
  await tx.begin();
  let applied = 0; const names = [];
  try {
    for (const l of lines) {
      const itemId = Number(l.itemId);
      const cur = (await new sql.Request(tx).input('i', sql.Int, itemId)
        .query('SELECT ItemID, ItemName, PackQty, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate FROM dbo.Items WHERE ItemID = @i')).recordset[0];
      if (!cur) throw new Error(`Item POS mein nahi mila (ID ${itemId} · ${l.name || l.code || ''})`);
      const pack = Number(cur.PackQty) > 0 ? Number(cur.PackQty) : (Number(l.pack) || 1);
      const rctn = num(l.rctn), rpcs = num(l.rpcs), wctn = num(l.wctn), wpcs = num(l.wpcs), costP = num(l.costP);
      const hasR = rctn > 0 || rpcs > 0, hasW = wctn > 0 || wpcs > 0, hasC = costP > 0;
      if (!hasR && !hasW && !hasC) continue;
      // fi-piece values (SaleRate = carton rate / pack — POS isi tarah rakhta hai)
      const newR  = r2(rctn > 0 && pack > 1 ? rctn / pack : (rpcs || rctn));
      const newR2 = r2(rpcs || newR);
      const newW  = r2(wctn > 0 && pack > 1 ? wctn / pack : (wpcs || wctn));
      const newWS = r2(wpcs || newW);
      const itemCost = r2(hasC ? (costIsCarton(cur.PurchaseRate, pack, Number(cur.SaleRate) || newR) ? costP * pack : costP) : 0);
      // SystemNotes — POS jaisi Old/New line (sirf jo badla)
      let note = `\r\n>>Modified via Blue Khata app On:${new Date().toLocaleString()} (job ${jobId})`;
      if (hasR && r2(cur.SaleRate) !== newR) note += `\r\nOld Sale Rate: ${r2(cur.SaleRate)}\r\nNew Sale Rate: ${newR}`;
      if (hasC && r2(cur.PurchaseRate) !== itemCost) note += `\r\nOld Purchase Rate: ${r2(cur.PurchaseRate)}\r\nNew Purchase Rate: ${itemCost}`;
      note += '\r\n';
      const sets = [];
      if (hasR) sets.push('SaleRate = @r', 'SaleRate2 = @r2');
      if (hasW) sets.push('SaleRate3 = @w', 'SaleRateSize = @ws');
      if (hasC) sets.push('PurchaseRate = @ic');
      await new sql.Request(tx)
        .input('i', sql.Int, itemId).input('r', sql.Float, newR).input('r2', sql.Float, newR2)
        .input('w', sql.Float, newW).input('ws', sql.Float, newWS).input('ic', sql.Float, itemCost)
        .input('nt', sql.NVarChar(sql.MAX), note)
        .query(`UPDATE dbo.Items SET ${sets.join(', ')}, SystemNotes = ISNULL(SystemNotes,'') + @nt WHERE ItemID = @i`);
      // Branch rates: PurchaseRate yahan hamesha FI PIECE (sync-stock isi ko asal khareed maanti hai)
      const bsets = [];
      if (hasR) bsets.push('SaleRate = @r', 'SaleRate2 = @r2');
      if (hasW) bsets.push('SaleRate3 = @w', 'SaleRateSize = @ws');
      if (hasC) bsets.push('PurchaseRate = @pc');
      await new sql.Request(tx)
        .input('i', sql.Int, itemId).input('r', sql.Float, newR).input('r2', sql.Float, newR2)
        .input('w', sql.Float, newW).input('ws', sql.Float, newWS).input('pc', sql.Float, r2(costP))
        .query(`UPDATE dbo.ItemBranchRate SET ${bsets.join(', ')} WHERE ItemID = @i`);
      applied++; names.push(String(cur.ItemName || '').trim());
      log(`  ${String(cur.ItemName || '').trim()} (pack ${pack}): ` +
        (hasC ? `cost ${r2(costP)}/pc ` : '') + (hasW ? `W ${newW}/pc ` : '') + (hasR ? `R ${newR}/pc (peice ${newR2})` : ''));
    }
    if (!applied) throw new Error('Kisi line par naya rate nahi tha');
    await tx.commit();
    return { applied, names };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}

// ---- job claim + status (transfer-sync jaisa) ----
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => log('Masla: ' + e.message)); };
async function claim(ref) {
  return db.runTransaction(async t => {
    const s = await t.get(ref); const cur = s.exists ? s.data() : null;
    if (!cur || cur.status !== 'new') return null;
    t.update(ref, { status: 'working', pc: os.hostname(), pickedAt: Date.now() });
    return cur;
  });
}
async function handleRate(doc) {
  if (busy.has(doc.id)) return; busy.add(doc.id);
  try {
    const ref = col.doc(doc.id), j = await claim(ref); if (!j) return;
    try {
      if (Date.now() - Number(j.at || 0) > MAX_JOB_DIN * 86400000) throw new Error(`Job ${MAX_JOB_DIN} din se purani thi — dobara bhejein`);
      const r = await applyRates(j, doc.id);
      await ref.update({ status: 'done', applied: r.applied, doneAt: Date.now(), error: FieldValue.delete() });
      log(`RATES LAG GAYE: ${r.applied} items (${r.names.slice(0, 5).join(', ')}${r.names.length > 5 ? '…' : ''})`);
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 250), doneAt: Date.now() });
      log(`Rates NAHI lage: ${e.message}`);
    }
  } finally { busy.delete(doc.id); }
}

// ---- ek hi copy chale ----
const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('rate-lagao pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('rate-lagao chal raha hai — app se "Naye rates POS par lagao" ka intezar…');
  col.where('status', '==', 'new').onSnapshot(
    s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleRate(c.doc)); }); },
    e => { log('Firestore masla: ' + e.message); process.exit(1); });
});
