// =====================================================================================================
//  ginti-post.js  v1.0 (2026-10-16) — 📋 GINTI KHUD POS MEIN (app Stock screen ⚙️ "Ginti khud POS mein" ON · 🏭 Factory 📊 Ginti tab)
//  Malik: "simple current stock − physical stock; physical likhein, Save — PC par bill saath saath banta rahe, nayi ginti shuru
//          nahi karni; dobara gino to edit ho jaye".
//  Firestore stockCount/c-<branch>-<itemId> {auto:true, round:'YYYY-MM-DD', total, at, sys0, pfAt, pfAdj, pfQ, del}:
//    har NAYI ginti (pfAt != at) par: farq = total − (POS ka stock ginti ke WAQT: CurrStock − baad ki harkat, StockLedger)
//    delta = farq − (ab tak POS mein gaya pfQ-ish) … asal mein: delta = total − stockAt(c.at) + 0  (pichhla delta pehle hi stock mein hai,
//    is liye stockAt ginti ke waqt ka stock pichhle delta SAMET deta hai) -> roz ke EK POS Adjustment "Ginti <din> <godam>" mein line (+/−).
//    Dobara gina = agla delta (pehla wapas nahi), hatao (del) = −pfQ. Doc par likhta hai: pfAt = at, pfAdj (Adjustment no), pfQ += delta,
//    sysPos / sysPosAt (app ka farq isi se). Kuch nahi badla (delta 0) to sirf pfAt.
//  Adjustment factory-post / post-farq jaisa (usp_Adjustment_InsertUpdate + usp_AdjustmentDetail_InsertUpdate, transaction, CurrStock
//  pehle / baad jaancha — na badla to ROLLBACK). Sale / khata / party par koi asar nahi. Rate = POS khareed fi piece.
//  Chalana: node ginti-post.js (ginti-auto.bat loop). Log: ginti-log.txt · Lock 47835. SQL password kabhi print nahi.
// =====================================================================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47835;
const CREATED_BY = 1;
const DIR = __dirname;
const BR_NAME = { 1: 'NT', 2: 'G1', 3: 'G2', 4: 'G3' };
try { require('./zinda.js')(__filename, { sql: true }); } catch { const f = path.join(__dirname, 'ginti-post.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref?.(); }
const log = (...a) => { const line = `[${new Date().toLocaleString('en-PK')}] ` + a.join(' '); console.log(line); try { fs.appendFileSync(path.join(DIR, 'ginti-log.txt'), line + '\r\n'); } catch {} };
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const col = db.collection('businesses').doc(BUSINESS_ID).collection('stockCount');
let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = v => Math.round((Number(v) || 0) * 100) / 100, r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const clean = (s, n) => String(s ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, n);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED/i.test(String(e?.message))) setTimeout(() => process.exit(1), 500); }); };

const PICK = `SELECT i.ItemID, i.ItemCode, i.ItemName, ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS Cost, ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SaleRate, r.CurrStock, ISNULL(NULLIF(i.PackQty,0),1) AS Pack
  FROM dbo.Items i JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = @b`;
async function findItem(p, c, branch) {
  if (Number.isFinite(Number(c.itemId))) {
    const byId = (await p.request().input('id', sql.Int, Number(c.itemId)).input('b', sql.Int, branch).query(PICK + ' WHERE i.ItemID = @id')).recordset[0];
    if (byId) return byId;
  }
  const byName = (await p.request().input('n', sql.NVarChar(200), String(c.name || '').trim()).input('b', sql.Int, branch).query(PICK + ' WHERE LTRIM(RTRIM(i.ItemName)) = @n')).recordset;
  return byName.length === 1 ? byName[0] : null;
}
// ginti ke WAQT ka stock = abhi − baad mein aaya + baad mein gaya (StockLedger)
async function stockAt(p, it, branch, at) {
  const r = (await p.request().input('id', sql.Int, it.ItemID).input('b', sql.Int, branch).input('t', sql.DateTime, new Date(Number(at)))
    .query(`SELECT ISNULL(SUM(QtyIn),0) AS qi, ISNULL(SUM(QtyOut),0) AS qo FROM dbo.StockLedger WHERE ItemID = @id AND BranchID = @b AND LedgerDate > @t`)).recordset[0];
  return r3(Number(it.CurrStock || 0) - Number(r.qi) + Number(r.qo));
}
// POS khareed fi piece (PurchaseRate carton ka ho sakta hai — pack se qareeb wala)
const pieceCost = (cost, pack, sale) => { cost = Number(cost) || 0; pack = Number(pack) || 0; sale = Number(sale) || 0; if (!cost || pack <= 1 || !sale) return cost; const g = v => Math.abs(Math.log(v / sale)); return g(cost / pack) < g(cost) ? r2(cost / pack) : cost; };

async function findAdj(p, desc, branch) {
  const r = (await p.request().input('d', sql.VarChar(150), desc).input('b', sql.Int, branch)
    .query(`SELECT TOP 1 AdjustmentID, AdjustmentNo FROM dbo.Adjustment WHERE Description = @d AND BranchID = @b AND ISNULL(DocStatusID, 1) <> 3 ORDER BY AdjustmentID DESC`)).recordset[0];
  return r ? { id: Number(r.AdjustmentID), no: String(r.AdjustmentNo || '').trim() } : null;
}
// roz ka ek Adjustment: mile to usi mein line, warna naya header — har line ke baad CurrStock jaanch (na badla = ROLLBACK)
async function addLine(p, branch, desc, it, delta, cost, who) {
  const now = new Date();
  const tx = new sql.Transaction(p); await tx.begin();
  try {
    let adj = await findAdj(p, desc, branch);
    if (!adj) {
      const mx = (await new sql.Request(tx).input('b', sql.Int, branch).query(`SELECT ISNULL(MAX(TRY_CAST(AdjustmentNo AS INT)),0) AS n FROM dbo.Adjustment WITH (UPDLOCK, HOLDLOCK) WHERE BranchID = @b`)).recordset[0].n;
      let adjNo = String(Number(mx) + 1).padStart(8, '0');
      const h = await new sql.Request(tx)
        .input('AdjustmentID', sql.Int, 0).input('BranchID', sql.Int, branch).input('AdjustmentNo', sql.VarChar(50), adjNo)
        .input('AdjustmentDate', sql.DateTime, now).input('Description', sql.VarChar(150), desc)
        .input('CreatedBy', sql.Int, CREATED_BY).input('CreatedOn', sql.DateTime, now).input('UpdatedBy', sql.Int, 0).input('UpdatedOn', sql.DateTime, null)
        .input('Remarks', sql.VarChar(150), clean('Blue Khata ginti (physical − system)', 150)).input('SystemNotes', sql.VarChar(sql.MAX), `Created By:Administrator On:${now.toLocaleString('en-US')} at PC:${os.hostname()} (Blue Khata ginti)\r\n`)
        .input('COGS', sql.Float, 0).input('DocStatusID', sql.Int, 1).input('SaleID', sql.Int, 0)
        .execute('dbo.usp_Adjustment_InsertUpdate');
      let adjId = Number(h.recordset?.[0]?.AdjustmentID) || 0;
      if (h.recordset?.[0]?.AdjustmentNo) adjNo = String(h.recordset[0].AdjustmentNo);
      if (!adjId) adjId = Number((await new sql.Request(tx).input('b', sql.Int, branch).input('n', sql.VarChar(50), adjNo).query(`SELECT TOP 1 AdjustmentID FROM dbo.Adjustment WHERE BranchID = @b AND AdjustmentNo = @n ORDER BY AdjustmentID DESC`)).recordset[0]?.AdjustmentID) || 0;
      if (!adjId) throw new Error('Adjustment ban gaya magar ID nahi mili');
      adj = { id: adjId, no: adjNo };
    }
    const cur = async () => Number((await new sql.Request(tx).input('i', sql.Int, it.ItemID).input('b', sql.Int, branch).query(`SELECT ISNULL(SUM(CurrStock),0) AS s FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = @b`)).recordset[0].s) || 0;
    const before = await cur();
    await new sql.Request(tx)
      .input('AdjustmentDetailID', sql.Int, 0).input('AdjustmentID', sql.Int, adj.id).input('ItemID', sql.Int, it.ItemID)
      .input('Qty', sql.Float, delta).input('Rate', sql.Float, r2(cost)).input('AdjustmentRate', sql.Float, 0).input('Narration', sql.VarChar(150), clean(`Ginti ${who || ''} ${new Date().toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}`, 150))
      .execute('dbo.usp_AdjustmentDetail_InsertUpdate');
    const after = await cur();
    if (Math.abs(after - before - delta) > 0.01) throw new Error(`POS ne stock nahi badla (${it.ItemName}: ${before} -> ${after}, chahiye ${r3(before + delta)}) — kuch save NAHI kiya`);
    await tx.commit();
    return adj;
  } catch (e) { await tx.rollback().catch(() => {}); throw e; }
}

const busy = new Set();
async function handle(id) {
  if (busy.has(id)) return; busy.add(id);
  try {
    const ref = col.doc(id), s = await ref.get(); if (!s.exists) return;
    const c = s.data(); if (!c.auto || !c.at || c.pfAt === c.at || String(id).startsWith('_')) return;
    const branch = Number(c.branch) || 1, p = await getPool();
    const it = await findItem(p, c, branch);
    if (!it) { await ref.set({ pfAt: c.at, pfErr: 'POS mein item nahi mila' }, { merge: true }); log(`❌ ${c.name}: POS mein item nahi mila`); return; }
    const day = String(c.day || c.round || '').slice(0, 10), desc = `Ginti ${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)} ${BR_NAME[branch] || 'B' + branch}`;
    let delta;
    if (c.del) delta = -(Number(c.pfQ) || 0);                              // hatao = jo gaya tha wapas
    else { const sysAt = await stockAt(p, it, branch, c.at); delta = r3(Number(c.total) - sysAt); }
    const cost = pieceCost(it.Cost, it.Pack, it.SaleRate) || Number(it.Cost) || 0;
    let adj = null;
    if (Math.abs(delta) > 0.0005) adj = await addLine(p, branch, desc, it, delta, cost, c.byName);
    const pfQ = c.del ? 0 : r3((Number(c.pfQ) || 0) + delta);
    const sysPos = c.del ? null : r3(Number(c.total) - delta);              // ginti ke waqt POS mein itna tha (app ka "us waqt system")
    await ref.set({ pfAt: c.at, pfQ, ...(adj ? { pfAdj: adj.no } : {}), pfErr: null, pfDone: Date.now(), ...(sysPos != null ? { sysPos, sysPosAt: c.at } : {}) }, { merge: true });
    log(`${c.del ? '🗑' : '✓'} ${c.name}: gina ${c.total} · delta ${delta > 0 ? '+' : ''}${delta}${adj ? ' -> Adjustment #' + adj.no : ' (kuch nahi badla)'}`);
  } catch (e) {
    log(`❌ ${id}: ${e.message}`);
    try { await col.doc(id).set({ pfErr: clean(e.message, 200), pfTry: Date.now() }, { merge: true }); } catch {}
  } finally { busy.delete(id); }
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('ginti-post pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('ginti-post v1.0 chal raha hai — app ki ginti ka intezar (auto)…');
  col.where('auto', '==', true).onSnapshot(
    s => { s.docChanges().forEach(ch => { if (ch.type === 'removed') return; const c = ch.doc.data(); if (c.at && c.pfAt !== c.at) later(() => handle(ch.doc.id)); }); },
    e => { log('Firestore masla: ' + e.message); process.exit(1); });
  setInterval(() => later(async () => {   // pfErr wale 5 min baad dobara
    const s = await col.where('auto', '==', true).get();
    for (const d of s.docs) { const c = d.data(); if (c.at && c.pfAt !== c.at && (!c.pfTry || Date.now() - c.pfTry > 5 * 60000)) await handle(d.id); }
  }), 5 * 60000).unref?.();
});
