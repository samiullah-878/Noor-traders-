// =========================================================
//  item-post.js  v1  (2026-09-23) — Blue Khata app se POS mein ITEM banana / badalna
//  App (Stock > "➕ Naya item" / "✏️ Item") itemJobs mein job likhti hai:
//    { op:'new'|'edit', itemId?, code, name, pack, costP, rctn, rpcs, wctn, wpcs,
//      subs:[{id?,b,q,r,s}], subsDel:[id], status:'new', by, at }
//    (sab RUPAY; costP/rpcs/wpcs = fi PIECE, rctn/wctn = fi CARTON)
//  POS ki APNI procedure se (POS form jaisa hi):
//    usp_Items_InsertUpdate  ->  SaleRate = R carton (rctn, warna rpcs)
//                                SaleRate2 = R piece (rpcs)
//                                SaleRate3 = W piece (wpcs)   SaleRateSize = W piece (wpcs)
//                                PurchaseRate = khareed fi piece × pack (POS Items mein carton wala)
//                                PackQty, PackQtyName 'CTN', QtyName 'PCS', UOMID 2, Qty1inctn 1
//    NAYA item: ItemCatID 80 (noor traders), ItemSubCatID 236 — naye items wahin jate hain.
//  ⚠️ usp_Items_InsertUpdate ke andar "Delete From ItemSubCode WHERE ItemID" hai — is liye hum
//     EDIT se pehle saare sub-barcode parh lete hain aur baad mein WAPAS daal dete hain (POS bhi yehi karta hai).
//  Sub-barcode: usp_ItemSubCode_InsertUpdate / usp_ItemSubCode_Delete.
//  7 din se purani job nahi lagti (failed + wajah). Status: working -> done {itemId, code} / failed {error}.
//  Chalana:  node item-post.js   (item-auto.bat loop mein). Log: item-log.txt. Lock port 47821.
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const MAX_JOB_DIN = 7;
const LOCK_PORT = 47823;   // 2026-09-25: pehle 47821 tha — purchase-post ka bhi yahi tha, dono ek doosre ko band kar deti thin
const NEW_CAT = 80, NEW_SUBCAT = 236;    // naye items: "noor traders" / jahan aap ke naye items jate hain
const MAIN_BRANCH = 1;

const DIR = __dirname;
const log = (...a) => {
  const line = `[${new Date().toLocaleTimeString()}] ` + a.join(' ');
  console.log(line);
  try { fs.appendFileSync(path.join(DIR, 'item-log.txt'), line + '\r\n'); } catch {}
};
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('itemJobs');

let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const n2 = v => Math.round((Number(v) || 0) * 10000) / 10000;
const clean = (s, n) => String(s ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, n);

async function applyItem(j) {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const rq = () => new sql.Request(tx);
    const isNew = j.op === 'new';
    const code = clean(j.code, 50), name = clean(j.name, 150);
    if (!name) throw new Error('Item ka naam khali hai');
    const pack = Math.max(0, Number(j.pack) || 0);
    const costP = n2(j.costP), rpcs = n2(j.rpcs), wpcs = n2(j.wpcs);
    const rctn = n2(j.rctn) || (pack > 1 ? n2(rpcs * pack) : rpcs);
    const wctn = n2(j.wctn) || (pack > 1 ? n2(wpcs * pack) : wpcs);

    // barcode kisi aur item ka to nahi
    if (code) {
      const dup = await rq().input('c', sql.VarChar(50), code)
        .query(`SELECT TOP 1 ItemID, ItemName FROM dbo.Items WHERE ItemCode=@c
                UNION ALL SELECT TOP 1 s.ItemID, i.ItemName FROM dbo.ItemSubCode s JOIN dbo.Items i ON i.ItemID=s.ItemID WHERE s.SBBarCode=@c`);
      const hit = dup.recordset.find(r => isNew || Number(r.ItemID) !== Number(j.itemId));
      if (hit) throw new Error(`Yeh barcode pehle se "${String(hit.ItemName).trim()}" ka hai`);
    }

    let itemId = isNew ? 0 : Number(j.itemId) || 0;
    let old = null, keepSubs = [];
    if (!isNew) {
      if (!itemId) throw new Error('Item nahi mila (id khali)');
      const r = await rq().input('id', sql.Int, itemId).query('SELECT * FROM dbo.Items WHERE ItemID=@id');
      old = r.recordset[0];
      if (!old) throw new Error('Item POS mein nahi mila (shayad hata diya gaya)');
      // ⚠️ POS ki procedure sub-barcode mita deti hai — pehle mehfooz kar lo
      const s = await rq().input('id', sql.Int, itemId).query('SELECT * FROM dbo.ItemSubCode WHERE ItemID=@id');
      keepSubs = s.recordset;
    }

    // SystemNotes — POS jaisa
    const stamp = `${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US')}`;
    const noteLine = `>>${isNew ? 'Created' : 'Modified'} By:Blue Khata On:${stamp} at PC:${os.hostname()}`;
    const changes = [];
    if (old) {
      const oldPP = Number(old.PackQty) > 1 ? Number(old.PurchaseRate) / Number(old.PackQty) : Number(old.PurchaseRate);
      const pairs = [['Name', String(old.ItemName).trim(), name], ['Code', old.ItemCode, code],
        ['PackQty', old.PackQty, pack], ['Purchase', Math.round(oldPP * 100) / 100, costP],
        ['SaleRate', old.SaleRate, rctn], ['SaleRate2', old.SaleRate2, rpcs], ['SaleRate3', old.SaleRate3, wpcs]];
      for (const [k, a, b] of pairs) if (String(a ?? '') !== String(b ?? '')) changes.push(`${k}: ${a} -> ${b}`);
    }
    const notes = clean(String(old?.SystemNotes || '') + noteLine + (changes.length ? ' [' + changes.join('; ') + ']' : '') + '\r\n', 3800)
      .replace(/ \[/g, '\r\n   [');

    const req = rq()
      .input('ItemID', sql.Int, itemId)
      .input('ItemCode', sql.VarChar(50), code)
      .input('ItemCatID', sql.Int, isNew ? NEW_CAT : Number(old.ItemCatID) || NEW_CAT)
      .input('ItemSubCatID', sql.Int, isNew ? NEW_SUBCAT : Number(old.ItemSubCatID) || NEW_SUBCAT)
      .input('ItemModelID', sql.Int, isNew ? 0 : Number(old.ItemModelID) || 0)
      .input('ItemName', sql.VarChar(150), name)
      .input('SaleRate', sql.Float, rctn)
      .input('UOMID', sql.Int, isNew ? 2 : Number(old.UOMID) || 2)
      .input('PurchaseRate', sql.Float, pack > 1 ? n2(costP * pack) : costP)   // POS Items mein carton wala
      .input('OpenningBalance', sql.Float, isNew ? 0 : Number(old.OpenningBalance) || 0)
      .input('OpenningBalanceRate', sql.Float, isNew ? 0 : Number(old.OpenningBalanceRate) || 0)
      .input('OpenningDate', sql.DateTime, isNew ? new Date() : (old.OpenningDate || new Date()))
      .input('SystemNotes', sql.VarChar(sql.MAX), notes)
      .input('AutoCode', sql.Bit, isNew && !code ? 1 : 0)      // code khali -> POS khud banaye (000xxx)
      .input('ReOrderLevel', sql.Float, isNew ? 0 : Number(old.ReOrderLevel) || 0)
      .input('SaleRate2', sql.Float, rpcs)
      .input('SaleRate3', sql.Float, wpcs)
      .input('IsTaxable', sql.Bit, isNew ? 0 : (old.IsTaxable ? 1 : 0))
      .input('IsActive', sql.Bit, 1)
      .input('PackQty', sql.Float, pack)
      .input('ItemUrduName', sql.NVarChar(200), isNew ? '' : (old.ItemUrduName || ''))
      .input('PackQtyName', sql.NVarChar(200), 'CTN')
      .input('QtyName', sql.NVarChar(200), 'PCS')
      .input('PurchaseRateSize', sql.Float, isNew ? 0 : Number(old.PurchaseRateSize) || 0)
      .input('SaleRateSize', sql.Float, wpcs)
      .input('SaleRate2Size', sql.Float, isNew ? 0 : Number(old.SaleRate2Size) || 0)
      .input('ItemDisc', sql.Float, isNew ? 0 : Number(old.ItemDisc) || 0)
      .input('ScheemOnQty', sql.Float, isNew ? 0 : Number(old.ScheemOnQty) || 0)
      .input('ScheemQty', sql.Float, isNew ? 0 : Number(old.ScheemQty) || 0)
      .input('TradeOffer', sql.Float, isNew ? 0 : Number(old.TradeOffer) || 0)
      .input('BranchID', sql.Int, MAIN_BRANCH)
      .input('Qty1inctn', sql.Bit, 1);
    const res = await req.execute('dbo.usp_Items_InsertUpdate');
    const rows = (res.recordsets || []).flat();
    const got = rows.map(r => Number(Object.values(r)[0])).filter(v => v > 0).pop();
    if (isNew) { itemId = got || 0; if (!itemId) throw new Error('Naya item bana nahi (id nahi mila)'); }

    // POS ki procedure ne ItemSubCode mita diye — purane wapas daalo
    for (const s of keepSubs) {
      await rq().input('ItemSubCodeID', sql.Int, 0).input('ItemID', sql.Int, itemId)
        .input('SBBarCode', sql.VarChar(50), s.SBBarCode).input('SBSaleRate', sql.Float, Number(s.SBSaleRate) || 0)
        .input('SBItemQty', sql.Float, Number(s.SBItemQty) || 1).input('IsShowOnLookup', sql.Bit, s.IsShowOnLookup ? 1 : 0)
        .execute('dbo.usp_ItemSubCode_InsertUpdate');
    }
    // app se aaye sub-barcode: hatana, phir naye / badle hue (barcode se milan, kyunke id badal chuki hai)
    const del = (j.subsDel || []).map(x => String(x).trim()).filter(Boolean);
    for (const b of del) await rq().input('id', sql.Int, itemId).input('b', sql.VarChar(50), b)
      .query('DELETE FROM dbo.ItemSubCode WHERE ItemID=@id AND SBBarCode=@b');
    for (const x of (j.subs || []).slice(0, 50)) {
      const b = clean(x.b, 50); if (!b) continue;
      const cur = await rq().input('id', sql.Int, itemId).input('b', sql.VarChar(50), b)
        .query('SELECT TOP 1 ItemSubCodeID FROM dbo.ItemSubCode WHERE ItemID=@id AND SBBarCode=@b');
      const sid = Number(cur.recordset[0]?.ItemSubCodeID) || 0;
      await rq().input('ItemSubCodeID', sql.Int, sid).input('ItemID', sql.Int, itemId)
        .input('SBBarCode', sql.VarChar(50), b).input('SBSaleRate', sql.Float, Number(x.r) || 0)
        .input('SBItemQty', sql.Float, Number(x.q) || 1).input('IsShowOnLookup', sql.Bit, x.s === false ? 0 : 1)
        .execute('dbo.usp_ItemSubCode_InsertUpdate');
    }

    const fin = await rq().input('id', sql.Int, itemId).query('SELECT ItemCode, ItemName FROM dbo.Items WHERE ItemID=@id');
    await tx.commit();
    return { itemId, code: fin.recordset[0]?.ItemCode || code, name, subs: (j.subs || []).length, kept: keepSubs.length, changes };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}

// ---- job claim + status (rate-lagao jaisa) ----
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
async function handleJob(doc) {
  if (busy.has(doc.id)) return; busy.add(doc.id);
  try {
    const ref = col.doc(doc.id), j = await claim(ref); if (!j) return;
    try {
      if (Date.now() - Number(j.at || 0) > MAX_JOB_DIN * 86400000) throw new Error(`Job ${MAX_JOB_DIN} din se purani thi — dobara bhejein`);
      const r = await applyItem(j);
      await ref.update({ status: 'done', itemId: r.itemId, code: r.code, doneAt: Date.now(), error: FieldValue.delete() });
      log(`ITEM ${j.op === 'new' ? 'BAN GAYA' : 'BADAL GAYA'}: ${r.name} (id ${r.itemId}, code ${r.code})${r.changes.length ? ' — ' + r.changes.join('; ') : ''}`);
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 250), doneAt: Date.now() });
      log(`ITEM NAHI laga: ${e.message}`);
    }
  } finally { busy.delete(doc.id); }
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('item-post pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('item-post chal raha hai — app se item banane / badalne ka intezar…');
  col.where('status', '==', 'new').onSnapshot(
    s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleJob(c.doc)); }); },
    e => { log('Firestore masla: ' + e.message); process.exit(1); });
});
