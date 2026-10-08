// =========================================================
//  item-post.js  v1  (2026-09-23) — Blue Khata app se POS mein ITEM banana / badalna
//  v1.1 (2026-10-08): ⚠️ RATE KI GHALTI THEEK — POS Items mein sab rate FI PIECE hain (POS form CTN khana = rate × pack khud
//      dikhata hai). v1 SaleRate mein R CTN aur PurchaseRate mein khareed × pack likhti thi (mujhid ghee 1kg: R Cotton 136,800,
//      Purchase 135,201). Ab: SaleRate = R CTN ÷ pack · SaleRate2 = R PCS · SaleRate3 = W CTN ÷ pack · SaleRateSize = W PCS ·
//      PurchaseRate = khareed fi PIECE. CTN khali (app ne na bheja) ho to purana POS rate (pehle R PCS × pack ban jata tha).
//      Phir item ki SAB ItemBranchRate rows bhi yahi (counter sale yahin se rate leta hai) — purchase-post jaisa.
//      PURANE ghalat rate: shuru par EK dafa (item-fix-v1.done) har item ki aakhri 'done' job dekh kar SIRF woh khana theek jo
//      bilkul v1 wali ghalat qeemat par hai (baad mein haath se theek kiya = nahi chhedte). SystemNotes + log mein list.
//  App (Stock > "➕ Naya item" / "✏️ Item") itemJobs mein job likhti hai:
//    { op:'new'|'edit', itemId?, code, name, pack, costP, rctn, rpcs, wctn, wpcs,
//      subs:[{id?,b,q,r,s}], subsDel:[id], status:'new', by, at }
//    (sab RUPAY; costP/rpcs/wpcs = fi PIECE, rctn/wctn = fi CARTON)
//  POS ki APNI procedure se (POS form jaisa hi):
//    usp_Items_InsertUpdate  ->  SaleRate = R CTN ÷ pack (v1.1; v1 mein ghalti se poora CTN)
//                                SaleRate2 = R piece (rpcs)
//                                SaleRate3 = W CTN ÷ pack     SaleRateSize = W piece (wpcs)
//                                PurchaseRate = khareed FI PIECE (v1.1; v1 mein ghalti se × pack)
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
// 2026-10-01 HEARTBEAT: har 30 sec '<script>.alive' mein waqt — doctor 3 min purana dekhe to script ko latki samajh kar dobara chalata hai
{ const _hb = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'); const _w = () => { try { require('fs').writeFileSync(_hb, String(Date.now())); } catch {} }; _w(); setInterval(_w, 30000).unref(); }
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
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const near = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.011;
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
    const rctn = n2(j.rctn), wctn = n2(j.wctn);   // v1.1: fi CARTON (khali = app ne nahi bheja)

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

    // v1.1: POS Items mein sab FI PIECE (form ka CTN khana = × pack). CTN khali ho to purana POS rate (pack wahi ho), warna PCS.
    //   ÷ pack 4 decimal tak — POS ka CTN khana bilkul wohi dikhaye jo app mein likha (8600 ÷ 16 = 537.5, 5150 ÷ 12 = 429.1667)
    const samePack = old && Math.abs((Number(old.PackQty) || 0) - pack) < 0.001;
    const sR = pack > 1 ? (rctn > 0 ? n2(rctn / pack) : (samePack && Number(old.SaleRate) > 0 ? Number(old.SaleRate) : rpcs)) : (rpcs || rctn);
    const sR2 = rpcs || sR;
    const sW = pack > 1 ? (wctn > 0 ? n2(wctn / pack) : (samePack && Number(old.SaleRate3) > 0 ? Number(old.SaleRate3) : wpcs)) : (wpcs || wctn);
    const sWS = wpcs || sW;
    const sP = costP;   // fi piece

    // SystemNotes — POS jaisa
    const stamp = `${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US')}`;
    const noteLine = `>>${isNew ? 'Created' : 'Modified'} By:Blue Khata On:${stamp} at PC:${os.hostname()}`;
    const changes = [];
    if (old) {
      const pairs = [['Name', String(old.ItemName).trim(), name], ['Code', old.ItemCode, code],
        ['PackQty', old.PackQty, pack], ['Purchase', r2(old.PurchaseRate), r2(sP)],
        ['SaleRate', r2(old.SaleRate), r2(sR)], ['SaleRate2', r2(old.SaleRate2), r2(sR2)], ['SaleRate3', r2(old.SaleRate3), r2(sW)], ['SaleRateSize', r2(old.SaleRateSize), r2(sWS)]];
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
      .input('SaleRate', sql.Float, sR)
      .input('UOMID', sql.Int, isNew ? 2 : Number(old.UOMID) || 2)
      .input('PurchaseRate', sql.Float, sP)   // v1.1: fi PIECE (v1 × pack likhti thi — ghalat)
      .input('OpenningBalance', sql.Float, isNew ? 0 : Number(old.OpenningBalance) || 0)
      .input('OpenningBalanceRate', sql.Float, isNew ? 0 : Number(old.OpenningBalanceRate) || 0)
      .input('OpenningDate', sql.DateTime, isNew ? new Date() : (old.OpenningDate || new Date()))
      .input('SystemNotes', sql.VarChar(sql.MAX), notes)
      .input('AutoCode', sql.Bit, isNew && !code ? 1 : 0)      // code khali -> POS khud banaye (000xxx)
      .input('ReOrderLevel', sql.Float, isNew ? 0 : Number(old.ReOrderLevel) || 0)
      .input('SaleRate2', sql.Float, sR2)
      .input('SaleRate3', sql.Float, sW)
      .input('IsTaxable', sql.Bit, isNew ? 0 : (old.IsTaxable ? 1 : 0))
      .input('IsActive', sql.Bit, 1)
      .input('PackQty', sql.Float, pack)
      .input('ItemUrduName', sql.NVarChar(200), isNew ? '' : (old.ItemUrduName || ''))
      .input('PackQtyName', sql.NVarChar(200), 'CTN')
      .input('QtyName', sql.NVarChar(200), 'PCS')
      .input('PurchaseRateSize', sql.Float, isNew ? 0 : Number(old.PurchaseRateSize) || 0)
      .input('SaleRateSize', sql.Float, sWS)
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

    // v1.1: item ki SAB godam rows (ItemBranchRate) — counter sale yahin se rate leta hai (purchase-post jaisa)
    await rq().input('id', sql.Int, itemId).input('r', sql.Float, sR).input('r2', sql.Float, sR2).input('w', sql.Float, sW)
      .input('ws', sql.Float, sWS).input('pc', sql.Float, sP)
      .query(`UPDATE dbo.ItemBranchRate SET SaleRate = @r, SaleRate2 = @r2, SaleRate3 = @w, SaleRateSize = @ws${sP > 0 ? ', PurchaseRate = @pc' : ''} WHERE ItemID = @id`);

    const fin = await rq().input('id', sql.Int, itemId).query('SELECT ItemCode, ItemName FROM dbo.Items WHERE ItemID=@id');
    await tx.commit();
    return { itemId, code: fin.recordset[0]?.ItemCode || code, name, subs: (j.subs || []).length, kept: keepSubs.length, changes };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}

// ---- job claim + status (rate-lagao jaisa) ----
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message))) { log('Firebase ka rabta toot gaya (UNAUTHENTICATED) — script 30 sec mein nayi chabi se dobara shuru hogi'); setTimeout(() => process.exit(1), 500); } }); };   // 2026-09-30: pehle bas likh kar aage chal padti thi, bill atak jate
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

// v1.1: 🔧 PURANE GHALAT RATE — v1 ne pack wale items par SaleRate = poora R CTN aur PurchaseRate = khareed × pack likha tha.
// Har item ki AAKHRI 'done' job se wohi ghalat qeemat dobara nikal kar milate hain; SIRF bilkul wohi qeemat ho to theek
// (haath se baad mein badla = nahi chhedte). Items + ItemBranchRate. Ek dafa (item-fix-v1.done), nakam ho to agli dafa phir.
const FIX_FLAG = path.join(DIR, 'item-fix-v1.done');
async function repairV1() {
  if (fs.existsSync(FIX_FLAG)) return;
  const snap = await col.where('status', '==', 'done').get();
  const last = new Map();
  snap.forEach(d => { const j = d.data() || {}, id = Number(j.itemId) || 0; if (!id) return;
    const t = Number(j.doneAt) || Number(j.at) || 0, p = last.get(id); if (!p || t > p.t) last.set(id, { t, j }); });
  const p = await getPool(); let fixed = 0, seen = 0;
  for (const [id, { j }] of last) {
    const pack = Number(j.pack) || 0; if (!(pack > 1)) continue; seen++;
    const costP = n2(j.costP), rpcs = n2(j.rpcs), wpcs = n2(j.wpcs), wctn = n2(j.wctn);
    const rBad = n2(j.rctn) || n2(rpcs * pack), pBad = n2(costP * pack);      // v1 ne yahi likha tha
    const rGood = n2(rBad / pack), pGood = costP, wGood = wctn > 0 ? n2(wctn / pack) : 0;   // 4 decimal: CTN wapas bilkul wohi (8550 ÷ 16 = 534.375)
    const tx = new sql.Transaction(p); await tx.begin();
    try {
      const it = (await new sql.Request(tx).input('id', sql.Int, id).query('SELECT ItemID, ItemName, PackQty, SaleRate, SaleRate3, PurchaseRate FROM dbo.Items WHERE ItemID=@id')).recordset[0];
      if (!it || Math.abs((Number(it.PackQty) || 0) - pack) > 0.001) { await tx.rollback(); continue; }
      const fixRow = r => { const f = {};
        if (rBad > 0 && near(r.SaleRate, rBad) && !near(rGood, rBad)) f.SaleRate = rGood;
        if (pBad > 0 && near(r.PurchaseRate, pBad) && !near(pGood, pBad)) f.PurchaseRate = pGood;
        if (wGood > 0 && near(r.SaleRate3, wpcs) && !near(wGood, wpcs)) f.SaleRate3 = wGood;
        return f; };
      const setSql = f => Object.keys(f).map(k => `${k} = @${k}`).join(', ');
      const bind = (rq, f) => { for (const [k, v] of Object.entries(f)) rq.input(k, sql.Float, v); return rq; };
      const fi = fixRow(it), parts = [];
      if (Object.keys(fi).length) {
        const nt = `\r\n>>Fixed By:Blue Khata item-post v1.1 On:${new Date().toLocaleString()} (v1 ne CTN wala rate PCS ke khane mein likha tha)` +
          (fi.SaleRate != null ? `\r\nOld Sale Rate: ${r2(it.SaleRate)}\r\nNew Sale Rate: ${fi.SaleRate}` : '') +
          (fi.PurchaseRate != null ? `\r\nOld Purchase Rate: ${r2(it.PurchaseRate)}\r\nNew Purchase Rate: ${fi.PurchaseRate}` : '') +
          (fi.SaleRate3 != null ? `\r\nOld W Rate: ${r2(it.SaleRate3)}\r\nNew W Rate: ${fi.SaleRate3}` : '') + '\r\n';
        await bind(new sql.Request(tx).input('id', sql.Int, id).input('nt', sql.NVarChar(sql.MAX), nt), fi)
          .query(`UPDATE dbo.Items SET ${setSql(fi)}, SystemNotes = ISNULL(SystemNotes,'') + @nt WHERE ItemID=@id`);
        if (fi.SaleRate != null) parts.push(`R CTN ${Math.round(it.SaleRate * pack)} -> ${Math.round(fi.SaleRate * pack * 100) / 100} (fi PCS ${fi.SaleRate})`);
        if (fi.PurchaseRate != null) parts.push(`khareed ${r2(it.PurchaseRate)} -> ${fi.PurchaseRate} fi PCS`);
        if (fi.SaleRate3 != null) parts.push(`W ${r2(it.SaleRate3)} -> ${fi.SaleRate3}`);
      }
      const brs = (await new sql.Request(tx).input('id', sql.Int, id).query('SELECT BranchID, SaleRate, SaleRate3, PurchaseRate FROM dbo.ItemBranchRate WHERE ItemID=@id')).recordset;
      let nb = 0;
      for (const b of brs) { const fb = fixRow(b); if (!Object.keys(fb).length) continue; nb++;
        await bind(new sql.Request(tx).input('id', sql.Int, id).input('b', sql.Int, b.BranchID), fb)
          .query(`UPDATE dbo.ItemBranchRate SET ${setSql(fb)} WHERE ItemID=@id AND BranchID=@b`); }
      await tx.commit();
      if (parts.length || nb) { fixed++; log(`🔧 THEEK: ${String(it.ItemName || '').trim()} (id ${id}) — ${parts.join(' · ') || 'Items theek tha'}${nb ? ` · ${nb} godam row` : ''}`); }
    } catch (e) { try { await tx.rollback(); } catch {} throw e; }
  }
  log(`🔧 Purane ghalat rate ki jaanch: ${seen} pack wale items dekhe, ${fixed} theek kiye`);
  try { fs.writeFileSync(FIX_FLAG, new Date().toISOString() + ' fixed ' + fixed); } catch {}
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('item-post pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  try { await repairV1(); } catch (e) { log('🔧 purane rate theek nahi hue (agli dafa phir): ' + e.message); }
  log('item-post v1.1 chal raha hai — app se item banane / badalne ka intezar…');
  col.where('status', '==', 'new').onSnapshot(
    s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleJob(c.doc)); }); },
    e => { log('Firestore masla: ' + e.message); process.exit(1); });
});
