// =========================================================
//  v1.2 (2026-11-17, malik: 'rate change wali screen ghalat rate bata rahi hai' + 'jaise rate badla item us list mein seedha'):
//    (1) W / R ab dbo.ItemBranchRate (DUKAN — NOOR TRADERS, naam se) se — wahi jahan se item screen / sync-stock parhti hai. dbo.Items ke
//        SaleRate* purane reh jate hain jab POS screen se rate badlo (akhroot gree: Items W 1751 / R 2100, asal W 1850 / R 2250).
//    (2) Foran: har 10 s sasta sawal = khareed (60 din) ka CHECKSUM (naya bill, bill ka rate badla, cancel) + dukan ke rates ka CHECKSUM
//        -> kuch bhi badla = list dobara (pehle sirf MAX id dekhta tha — bill ka rate badalna 5 min baad aata).
//  rate-change.js  v1.1 (2026-11-10: shuru mein ek dafa 🔎 POS bill jaanch — pos-jaanch.js, sirf parhna) · v1.0 (2026-11-07) — 📈 RATE CHANGE: jin items ka KHAREED rate pichhli khareed se badla
//  (malik: "jo rates change hue hain pichli dafa se wo aayein · rates wahan se badal sakein · check box · stock jaisa jaldi update").
//
//  SIRF PARHTI hai (POS mein kuch nahi likhti). Har 30 s chhota sawal (MAX PurchaseDetailID + ginti) — nayi khareed aate hi
//  poori list dobara (1 min ke andar app mein); warna har 5 min (rate-lagao ke baad abhi ke W / R rate taza rahein) ya app ka
//  "🔄" (posStats/rateChgReq).
//  Qaida: har item ki aakhri khareed line (cancel DocStatusID 3 nahi) ka rate (FI PIECE) ≠ us se PEHLE wali khareed (alag bill) ka rate
//  → change. Sirf wo jin ki aakhri khareed pichhle DAYS (60) din mein. Rate = d.Rate (POS purchase detail, fi piece).
//  Likhti hai: posStats/rateChg { j: JSON text [ {k, i, n, c, pk, o, r, d, b, s, sid, w, wp, rr, rp, cp} ], n, at, maxId, reqAt, v }
//    k = PurchaseDetailID (pakki chaabi — app ka ✓ check isi par) · o = purana rate · r = naya · d = tareekh · b = bill no · s = supplier
//    w = SaleRate3 (W fi piece) · wp = SaleRateSize (W piece) · rr = SaleRate (R ctn÷pack) · rp = SaleRate2 (R piece) · cp = Items.PurchaseRate
//  Chalana: rate-change-auto.bat (loop). Log: rate-change-log.txt.
// =========================================================
const path = require('path');
const sql = require('mssql');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const fs = require('fs'); return { guard: (fn) => fn, beat: () => { try { fs.writeFileSync(f, String(Date.now())); } catch {} } }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const SQL_CONFIG = require('./sql-config.js');
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(__dirname, 'firebase-key.json'))) });
const db = getFirestore(), col = db.collection('businesses').doc('noor-traders').collection('posStats');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const VER = '1.2', DAYS = 60, HIST = 400, EVERY = 5 * 60000, POLL = 10000, EPS = 0.005, MAX = 800, DV = 2;
const p2 = n => String(n).padStart(2, '0'), dk = d => d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : '';
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

// v1.2: DUKAN ki branch (NOOR TRADERS) — naam se, number se nahi (CLAUDE.md qaida). Na mile = sab se chhoti branch jahan rate hain.
let SHOP = null, SHOP_AT = 0;
async function shopBranch(pool) {
  if (SHOP != null && Date.now() - SHOP_AT < 30 * 60000) return SHOP;
  let id = null;
  try {
    const t = (await pool.request().query(`SELECT TOP 1 c.TABLE_NAME AS T, n.COLUMN_NAME AS N FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.COLUMNS n ON n.TABLE_NAME = c.TABLE_NAME
      WHERE c.COLUMN_NAME = 'BranchID' AND c.TABLE_NAME LIKE '%Branch%' AND n.COLUMN_NAME LIKE '%Name%' ORDER BY LEN(c.TABLE_NAME)`)).recordset[0];
    if (t && /^[A-Za-z0-9_]+$/.test(t.T) && /^[A-Za-z0-9_]+$/.test(t.N)) {
      const rows = (await pool.request().query(`SELECT BranchID, [${t.N}] AS Nm FROM dbo.[${t.T}]`)).recordset;
      const hit = rows.find(r => /noor\s*traders/i.test(String(r.Nm || ''))) || rows.find(r => !/godam/i.test(String(r.Nm || '')));
      if (hit) id = Number(hit.BranchID);
    }
  } catch (e) { log('branch naam: ' + (e.message || e)); }
  if (id == null) { try { id = Number((await pool.request().query('SELECT MIN(BranchID) AS b FROM dbo.ItemBranchRate')).recordset[0]?.b) || null; } catch {} }
  SHOP = id; SHOP_AT = Date.now();
  return id;
}
async function stamp(pool) {   // sasta sawal — kuch badla? (v1.2: bill ka rate / cancel / dukan ka rate bhi)
  const a = new Date(); a.setDate(a.getDate() - DAYS - 1);
  const r = (await pool.request().input('a', sql.DateTime, a).query(`SELECT MAX(d.PurchaseDetailID) AS m, COUNT(*) AS n,
      CHECKSUM_AGG(CHECKSUM(d.PurchaseDetailID, d.ItemID, d.Rate, ISNULL(h.DocStatusID, 0), h.PurchaseDate)) AS c
    FROM dbo.PurchaseDetail d JOIN dbo.Purchase h ON h.PurchaseID = d.PurchaseID WHERE h.PurchaseDate >= @a`)).recordset[0] || {};
  let rc = 0;
  const b = await shopBranch(pool);
  if (b != null) { try { rc = Number((await pool.request().input('b', sql.Int, b).query(`SELECT CHECKSUM_AGG(CHECKSUM(ItemID, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate)) AS c FROM dbo.ItemBranchRate WHERE BranchID = @b`)).recordset[0]?.c) || 0; } catch {} }
  return `${Number(r.m) || 0}|${Number(r.n) || 0}|${Number(r.c) || 0}|${b ?? ''}:${rc}`;
}
async function build(pool, reqAt, st) {
  const now = new Date(), from = new Date(now); from.setDate(from.getDate() - HIST);
  const items = new Map();
  for (const it of (await pool.request().query(`SELECT ItemID, ItemName, LTRIM(RTRIM(ISNULL(ItemCode, ''))) AS Code, ISNULL(PackQty, 0) AS PackQty,
      ISNULL(SaleRate, 0) AS SaleRate, ISNULL(SaleRate2, 0) AS SaleRate2, ISNULL(SaleRate3, 0) AS SaleRate3, ISNULL(SaleRateSize, 0) AS SaleRateSize, ISNULL(PurchaseRate, 0) AS PurchaseRate FROM dbo.Items`)).recordset)
    items.set(String(it.ItemID), it);
  // v1.2: dukan (NOOR TRADERS) ke asal rates — POS item screen wale (dbo.Items ke SaleRate* purane reh jate hain)
  const shop = await shopBranch(pool), br = new Map();
  if (shop != null) {
    try {
      for (const x of (await pool.request().input('b', sql.Int, shop).query(`SELECT ItemID, ISNULL(SaleRate, 0) AS SaleRate, ISNULL(SaleRate2, 0) AS SaleRate2,
          ISNULL(SaleRate3, 0) AS SaleRate3, ISNULL(SaleRateSize, 0) AS SaleRateSize, ISNULL(PurchaseRate, 0) AS PurchaseRate FROM dbo.ItemBranchRate WHERE BranchID = @b`)).recordset)
        br.set(String(x.ItemID), x);
    } catch (e) { log('branch rates: ' + (e.message || e)); }
  }
  const lines = (await pool.request().input('a', sql.DateTime, from).query(`
    SELECT d.PurchaseDetailID AS K, d.ItemID, CAST(d.Rate AS FLOAT) AS Rate, CAST(ISNULL(d.Qty, 0) AS FLOAT) AS Qty, h.PurchaseID, h.PurchaseNo, h.PurchaseDate, h.PartyID, pt.PartyName
    FROM dbo.PurchaseDetail d JOIN dbo.Purchase h ON h.PurchaseID = d.PurchaseID LEFT JOIN dbo.Party pt ON pt.PartyID = h.PartyID
    WHERE h.PurchaseDate >= @a AND ISNULL(h.DocStatusID, 0) <> 3 AND ISNULL(d.Rate, 0) > 0
    ORDER BY d.ItemID, h.PurchaseDate, d.PurchaseDetailID`)).recordset;
  const by = new Map();
  for (const l of lines) { const id = String(l.ItemID); if (!by.has(id)) by.set(id, []); by.get(id).push(l); }
  const cut = new Date(now); cut.setDate(cut.getDate() - DAYS);
  const out = [];
  for (const [id, L] of by) {
    const last = L[L.length - 1]; if (!last || !last.PurchaseDate || new Date(last.PurchaseDate) < cut) continue;
    let prev = null;   // aakhri bill se PEHLE wala alag bill (usi bill ki doosri line nahi)
    for (let k = L.length - 2; k >= 0; k--) if (String(L[k].PurchaseID) !== String(last.PurchaseID)) { prev = L[k]; break; }
    if (!prev) continue;
    if (Math.abs((Number(last.Rate) || 0) - (Number(prev.Rate) || 0)) < EPS) continue;
    const it0 = items.get(id) || {}, b = br.get(id), pick = k => (b && Number(b[k]) > 0) ? b[k] : it0[k];
    const it = { ...it0, SaleRate: pick('SaleRate'), SaleRate2: pick('SaleRate2'), SaleRate3: pick('SaleRate3'), SaleRateSize: pick('SaleRateSize'), PurchaseRate: pick('PurchaseRate') };   // v1.2
    out.push({ k: Number(last.K), i: id, n: String(it.ItemName || '').trim(), c: String(it.Code || ''), pk: Number(it.PackQty) || 0,
      o: r2(prev.Rate), r: r2(last.Rate), d: dk(new Date(last.PurchaseDate)), pd: dk(new Date(prev.PurchaseDate)), b: String(last.PurchaseNo || '').trim(), pb: String(prev.PurchaseNo || '').trim(),
      s: String(last.PartyName || '').trim(), sid: String(last.PartyID || ''), q: r2(last.Qty),
      w: r2(it.SaleRate3), wp: r2(it.SaleRateSize), rr: r2(it.SaleRate), rp: r2(it.SaleRate2), cp: r2(it.PurchaseRate) });
  }
  out.sort((a, b) => b.k - a.k);
  const list = out.slice(0, MAX);
  await col.doc('rateChg').set({ j: JSON.stringify(list), n: list.length, all: out.length, at: Date.now(), maxId: st, reqAt: reqAt || 0, days: DAYS, v: DV, br: shop ?? null, err: '' });
  log(`✅ ${list.length} items ka rate badla (${DAYS} din) · lines ${lines.length}`);
}
let lastSt = '', lastRun = 0, lastFs = 0;
const tick = ZINDA.guard(async () => {
  let pool;
  try {
    pool = await sql.connect(SQL_CONFIG);
    const st = await stamp(pool);
    if (st === lastSt && Date.now() - lastFs < 60000) return;   // v1.2: POS mein kuch nahi badla = Firestore se sawal bhi nahi (har 10 s ke reads bachao); app ka 🔄 / 5 min wala minute mein
    lastFs = Date.now();
    const meta = (await col.doc('rateChg').get()).data() || {}, req = (await col.doc('rateChgReq').get()).data() || {};
    const reqAt = Number(req.at) || 0;
    const due = st !== lastSt || st !== String(meta.maxId || '') || reqAt > (Number(meta.reqAt) || 0) || Date.now() - (Number(meta.at) || 0) > EVERY || Number(meta.v || 0) < DV;
    if (!due) return;
    if (Date.now() - lastRun < 5000) return;
    lastRun = Date.now(); lastSt = st;
    await build(pool, reqAt, st);
  } catch (e) { log('❌ ' + (e.message || e)); await col.doc('rateChg').set({ err: String(e.message || e).slice(0, 300), errAt: Date.now() }, { merge: true }).catch(() => {}); }
  finally { try { await pool?.close(); } catch {} ZINDA.beat?.(); }
}, 4 * 60000, 'tick');
// v1.1: 🔎 POS bill jaanch (pos-jaanch.js, sirf parhna) — shuru ke 20 s baad ek dafa, apne alag rabte se (tick ke pool ko nahi chherta)
function jaanchOnce() { setTimeout(async () => { let p; try { p = await new sql.ConnectionPool(SQL_CONFIG).connect(); await require('./pos-jaanch.js').run(p, sql, db.collection('businesses').doc('noor-traders').collection('blueAccess').doc('posBillJaanch'), log); } catch (e) { log('jaanch: ' + (e.message || e)); } finally { try { await p?.close(); } catch {} } }, 20000); }
if (require.main === module) {
  const lock = require('net').createServer();
  lock.once('error', () => { console.log('rate-change pehle se chal raha hai.'); process.exit(3); });
  lock.listen(47841, '127.0.0.1', () => { log(`rate-change v${VER} shuru — khareed rate badla to app mein (har ${POLL / 1000} s dekh)`); jaanchOnce(); tick().catch(e => log('tick: ' + (e.message || e))); setInterval(() => tick().catch(e => log('tick: ' + (e.message || e))), POLL); });
}
module.exports._t = { build, stamp, shopBranch };   // v1.2: sirf test ke liye
