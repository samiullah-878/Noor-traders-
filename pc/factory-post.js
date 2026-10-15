// =====================================================================================================
//  factory-post.js  v1.1 (2026-10-15 raat: ⏳ 'job:' naye item — pehle item bane, phir batch) · v1.0 (2026-10-15) — 🏭 FACTORY PRODUCTION -> POS STOCK (app "🏭 Factory" / stock screen "Factory batch (OK)")
//  Malik: "apni factory ki items — formula ke saath batch, larka OK kare to production auto stock mein aa jaye aur raw maal auto minus;
//          shop ki sale se stock minus hota rahe; batch ka barcode label OK par khud chhap jaye (sub barcode bhi)".
//  Firestore factoryBatches/<id> status 'new' -> POS mein EK Adjustment (dukan godam, BranchID 1):
//     + tayyar maal (out, rate = laagat / out)   − har raw maal (q, rate = POS ka khareed fi piece)
//  (post-farq.js createAdjustment jaisa: usp_Adjustment_InsertUpdate + usp_AdjustmentDetail_InsertUpdate, transaction, har item ka
//   CurrStock pehle / baad jaancha — na badla to ROLLBACK, kuch save nahi). Description "Prod <id> <batch no>" — dobara kabhi nahi (pehle dhoondta hai).
//  Sale / khata / party par koi asar nahi (Adjustment) — Item report / sale stats saaf. Shop ka minus stock production + se khud barabar.
//  Phir labels: batch.labels -> labelJobs (200 tak fi job, job.batch = batch no -> label-print v4.5 daayein kone par).
//  'cancelReq' (malik "wapas lo") -> asal Adjustment ki lines ULTI (Prod WAPAS …) -> 'cancelled'. POS mein kuch delete NAHI.
//  Chalana: node factory-post.js (factory-auto.bat loop). Log: factory-log.txt · Lock 47834. SQL password print nahi.
// =====================================================================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47834;
const MAIN_BRANCH = 1;          // NOOR TRADERS (dukan)
const CREATED_BY = 1;           // POS user: Administrator
const DIR = __dirname;
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'), w = () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();
const log = (...a) => { const line = `[${new Date().toLocaleString('en-PK')}] ` + a.join(' '); console.log(line); try { fs.appendFileSync(path.join(DIR, 'factory-log.txt'), line + '\r\n'); } catch {} };
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const biz = db.collection('businesses').doc(BUSINESS_ID);
const col = biz.collection('factoryBatches'), labels = biz.collection('labelJobs');
let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = v => Math.round((Number(v) || 0) * 100) / 100, r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const clean = (s, n) => String(s ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, n);
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED/i.test(String(e?.message))) setTimeout(() => process.exit(1), 500); }); };

async function findAdj(p, desc) {
  const r = (await p.request().input('d', sql.VarChar(150), desc).input('b', sql.Int, MAIN_BRANCH)
    .query(`SELECT TOP 1 AdjustmentID, AdjustmentNo FROM dbo.Adjustment WHERE Description = @d AND BranchID = @b AND ISNULL(DocStatusID, 1) <> 3 ORDER BY AdjustmentID DESC`)).recordset[0];
  return r ? { id: Number(r.AdjustmentID), no: String(r.AdjustmentNo || '').trim() } : null;
}
// rows: [{ItemID, sq (+/−), cost, name}] -> ek Adjustment (transaction + stock jaanch)
async function writeAdj(p, desc, remarks, rows) {
  const now = new Date();
  const note = `Created By:Administrator On:${now.toLocaleString('en-US')} at PC:${os.hostname()} (Blue Khata factory)\r\n`;
  const cogs = r2(rows.reduce((t, k) => t + k.sq * k.cost, 0));
  const tx = new sql.Transaction(p); await tx.begin();
  try {
    const mx = (await new sql.Request(tx).input('b', sql.Int, MAIN_BRANCH)
      .query(`SELECT ISNULL(MAX(TRY_CAST(AdjustmentNo AS INT)),0) AS n FROM dbo.Adjustment WITH (UPDLOCK, HOLDLOCK) WHERE BranchID = @b`)).recordset[0].n;
    let adjNo = String(Number(mx) + 1).padStart(8, '0');
    const h = await new sql.Request(tx)
      .input('AdjustmentID', sql.Int, 0).input('BranchID', sql.Int, MAIN_BRANCH).input('AdjustmentNo', sql.VarChar(50), adjNo)
      .input('AdjustmentDate', sql.DateTime, now).input('Description', sql.VarChar(150), desc)
      .input('CreatedBy', sql.Int, CREATED_BY).input('CreatedOn', sql.DateTime, now).input('UpdatedBy', sql.Int, 0).input('UpdatedOn', sql.DateTime, null)
      .input('Remarks', sql.VarChar(150), clean(remarks, 150)).input('SystemNotes', sql.VarChar(sql.MAX), note)
      .input('COGS', sql.Float, cogs).input('DocStatusID', sql.Int, 1).input('SaleID', sql.Int, 0)
      .execute('dbo.usp_Adjustment_InsertUpdate');
    let adjId = Number(h.recordset?.[0]?.AdjustmentID) || 0;
    if (h.recordset?.[0]?.AdjustmentNo) adjNo = String(h.recordset[0].AdjustmentNo);
    if (!adjId) adjId = Number((await new sql.Request(tx).input('b', sql.Int, MAIN_BRANCH).input('n', sql.VarChar(50), adjNo)
      .query(`SELECT TOP 1 AdjustmentID FROM dbo.Adjustment WHERE BranchID = @b AND AdjustmentNo = @n ORDER BY AdjustmentID DESC`)).recordset[0]?.AdjustmentID) || 0;
    if (!adjId) throw new Error('Adjustment ban gaya magar ID nahi mili');
    const cur = async id => Number((await new sql.Request(tx).input('i', sql.Int, id).input('b', sql.Int, MAIN_BRANCH)
      .query(`SELECT ISNULL(SUM(CurrStock),0) AS s FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = @b`)).recordset[0].s) || 0;
    for (const k of rows) {
      const before = await cur(k.ItemID);
      await new sql.Request(tx)
        .input('AdjustmentDetailID', sql.Int, 0).input('AdjustmentID', sql.Int, adjId).input('ItemID', sql.Int, k.ItemID)
        .input('Qty', sql.Float, k.sq).input('Rate', sql.Float, r2(k.cost)).input('AdjustmentRate', sql.Float, 0).input('Narration', sql.VarChar(150), clean(remarks, 150))
        .execute('dbo.usp_AdjustmentDetail_InsertUpdate');
      const after = await cur(k.ItemID);
      if (Math.abs(after - before - k.sq) > 0.01) throw new Error(`POS ne stock nahi badla (${k.name}: ${before} -> ${after}, chahiye ${r3(before + k.sq)}) — kuch save NAHI kiya`);
    }
    await tx.commit();
    return { id: adjId, no: adjNo };
  } catch (e) { await tx.rollback().catch(() => {}); throw e; }
}

// v1.1 (2026-10-15): ⏳ 'job:<itemJobId>' — app ka naya item jo abhi POS mein nahi bana (PC band tha). item-post pehle banata hai;
//   yahan itemJobs/<id> done + itemId -> asli id (batch doc mein bhi likh deta hai). Abhi 'new' / 'working' = waitItem (har 60 s dobara);
//   cancelled / failed = 'error'. Label ka khali barcode = bana hua item ka code.
const waiting = new Set();
class WaitItem extends Error {}
async function resolveJobs(ref, b) {
  const ids = [String(b.itemId), ...(b.lines || []).map(l => String(l.id))].filter(x => x.startsWith('job:'));
  if (!ids.length) return b;
  const map = new Map(), codes = new Map();
  for (const x of [...new Set(ids)]) {
    const s = await biz.collection('itemJobs').doc(x.slice(4)).get(), j = s.exists ? s.data() : null;
    if (!j) throw new Error('Naya item ki darkhwast nahi mili (' + x + ')');
    if (j.status === 'done' && j.itemId) { map.set(x, String(j.itemId)); codes.set(String(j.itemId), String(j.code || '')); continue; }
    if (j.status === 'new' || j.status === 'working') throw new WaitItem(String(j.name || x));
    throw new Error(`Naya item "${j.name || x}" POS mein nahi bana (${j.status}${j.error ? ': ' + j.error : ''}) — item theek kar ke dobara`);
  }
  const m = id => map.get(String(id)) || String(id);
  const nb = { ...b, itemId: m(b.itemId), lines: (b.lines || []).map(l => ({ ...l, id: m(l.id) })),
    labels: (b.labels || []).map(L => ({ ...L, code: L.code || codes.get(m(b.itemId)) || '' })).filter(L => L.code) };
  await ref.update({ itemId: nb.itemId, lines: nb.lines, labels: nb.labels, waitItem: FieldValue.delete(), resolvedAt: Date.now() });
  log(`⏳ -> ✓ ${b.no}: naye item POS mein ban gaye, asli id lag gayi`);
  return nb;
}
async function post(ref, b) {
  try { b = await resolveJobs(ref, b); }
  catch (e) { if (e instanceof WaitItem) { waiting.add(ref.id); if (!b.waitItem) { await ref.update({ waitItem: true, waitAt: Date.now() }); log(`⏳ ${b.no}: "${e.message}" abhi POS mein nahi bana — intezar`); } return; } throw e; }
  waiting.delete(ref.id);
  const p = await getPool();
  const desc = clean(`Prod ${b.id} ${b.no}`, 150);
  let adj = await findAdj(p, desc);
  if (adj) log(`Pehle se POS mein mila: ${b.no} (# ${adj.no}) — dobara nahi`);
  else {
    const out = r3(b.out), lines = Array.isArray(b.lines) ? b.lines : [];
    if (!(out > 0)) throw new Error('Kitne bane — 0');
    const ids = [...new Set([String(b.itemId), ...lines.map(l => String(l.id))])].map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (!ids.length) throw new Error('Item nahi');
    const info = new Map((await p.request().input('b', sql.Int, MAIN_BRANCH).query(`
      SELECT i.ItemID, i.ItemName, ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS PR, r.ItemID AS RB
      FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = @b WHERE i.ItemID IN (${ids.join(',')})`)).recordset.map(x => [Number(x.ItemID), x]));
    const miss = ids.filter(id => !info.get(id) || info.get(id).RB == null);
    if (miss.length) throw new Error('Ye item POS ki dukan godam mein nahi: ' + miss.join(', '));
    const raw = new Map();
    for (const l of lines) { const id = Number(l.id), q = r3(l.q); if (!(q > 0) || id === Number(b.itemId)) continue; raw.set(id, r3((raw.get(id) || 0) + q)); }
    const rows = [], fin = info.get(Number(b.itemId));
    let rawCost = 0;
    for (const [id, q] of raw) { const x = info.get(id), c = Number(x.PR) || 0; rawCost += q * c; rows.push({ ItemID: id, sq: -q, cost: c, name: String(x.ItemName || '').trim() }); }
    const total = Math.max(Number(b.cost) || 0, rawCost + (Number(b.oh) || 0));
    rows.unshift({ ItemID: Number(b.itemId), sq: out, cost: r2(total / out), name: String(fin.ItemName || '').trim() });
    adj = await writeAdj(p, desc, `Production ${b.no} · ${b.n} batch · ${b.byName || ''}`, rows);
    log(`✓ ${b.no} ${b.name}: +${out} · ${raw.size} raw − · Adjustment # ${adj.no}`);
  }
  await ref.update({ status: 'posted', adjNo: adj.no, adjId: adj.id, postedAt: Date.now(), err: FieldValue.delete() });
  // 🏷 labels (sirf ek dafa)
  const fresh = (await ref.get()).data() || {};
  if (!fresh.lblDone && Array.isArray(b.labels) && b.labels.length) {
    const made = [];
    for (const L of b.labels.slice(0, 6)) {
      let left = Math.max(0, Math.floor(Number(L.copies) || 0));
      while (left > 0) { const c = Math.min(200, left); left -= c;
        const id = 'fb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await labels.doc(id).set({ itemId: String(b.itemId), code: clean(L.code, 60), name: clean(L.name || b.name, 120), qty: Number(L.qty) || 1, rate: Number(L.rate) || 0, copies: c, status: 'new', by: 'pc-factory', at: Date.now(), batch: clean(b.no, 20) });
        made.push(id); }
    }
    await ref.update({ lblDone: true, lblIds: made.slice(0, 50) });
    if (made.length) log(`🏷 ${b.no}: ${made.length} label job printer ko`);
  }
}
async function reverse(ref, b) {
  const p = await getPool();
  const orig = await findAdj(p, clean(`Prod ${b.id} ${b.no}`, 150));
  if (!orig) { await ref.update({ status: 'cancelled', cancelledAt: Date.now(), revNo: '' }); log(`↩ ${b.no}: POS mein tha hi nahi — sirf band`); return; }
  const rdesc = clean(`Prod WAPAS ${b.id} ${b.no}`, 150);
  let rev = await findAdj(p, rdesc);
  if (!rev) {
    const lines = (await p.request().input('a', sql.Int, orig.id).query(`SELECT d.ItemID, d.Qty, d.Rate, i.ItemName FROM dbo.AdjustmentDetail d JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.AdjustmentID = @a`)).recordset;
    if (!lines.length) throw new Error('Asal adjustment ki lines nahi mili');
    rev = await writeAdj(p, rdesc, `Production ${b.no} WAPAS`, lines.map(x => ({ ItemID: Number(x.ItemID), sq: -Number(x.Qty), cost: Number(x.Rate) || 0, name: String(x.ItemName || '').trim() })));
    log(`↩ ${b.no} wapas: Adjustment # ${rev.no}`);
  }
  await ref.update({ status: 'cancelled', cancelledAt: Date.now(), revNo: rev.no });
}
async function handle(id) {
  const ref = col.doc(id), s = await ref.get(); if (!s.exists) return; const b = { ...s.data(), id };
  try {
    if (b.status === 'new') await post(ref, b);
    else if (b.status === 'cancelReq') await reverse(ref, b);
  } catch (e) {
    log(`❌ ${b.no || id}: ${e.message}`);
    try { await ref.update(b.status === 'cancelReq' ? { status: 'posted', err: clean('Wapas nahi hua: ' + e.message, 300) } : { status: 'error', err: clean(e.message, 300) }); } catch {}
  }
}

const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
lock.on('error', () => { console.log('factory-post pehle se chal raha hai — yeh copy band.'); process.exit(3); });
lock.on('listening', async () => {
  try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
  log('factory-post v1.1 chal raha hai — factory batch ka intezar…');
  col.where('status', 'in', ['new', 'cancelReq']).onSnapshot(
    s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handle(c.doc.id)); }); },
    e => { log('Firestore masla: ' + e.message); process.exit(1); });
  setInterval(() => { for (const id of [...waiting]) later(() => handle(id)); }, 60000).unref?.();   // v1.1: ⏳ naye item ka intezar
});
