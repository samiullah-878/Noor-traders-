// =========================================================
//  sync-stock.js  —  POS ka stock Firestore par bhejta hai
//  SQL mein kuch LIKHTA nahi - sirf padhta hai.
//  2026-10-04: har item ke saath category ka naam (cat) — Items ka '%ategor%ID' khana + category table khud dhoondta hai
//  v2 (2026-10-11): har 5 sec fingerprint -> tabdeeli par foran sync · sachi dhadkan · 90 sec chowkidar · posStock/_live (app chip)
//  2026-10-08: ws = W PCS (SaleRateSize) jab W CTN÷pack (SaleRate3 = wrate) se alag ho — app CTN aur PCS alag dikhaye
//  v3 (2026-10-30): 🏪 ONLINE DUKAN — customer website ke liye webDukan/cat [[id, naam, category, RETAIL rate, unit]] (sirf majood + rate > 0, ⛔ band nahi;
//                   khareed / nafa / ginti KABHI nahi — ye doc sab parhte hain). Badla na ho to nahi likhta.
// =========================================================
//
//  Chalane ka tareeqa:   node sync-stock.js
//  Pehli dafa  : saara stock jayega
//  Us ke baad  : sirf woh hissa jayega jis mein tabdeeli hui
//  Stock na badle to ZERO writes.

const sql = require('mssql');
// v2 (2026-10-11) SACHI DHADKAN: '<script>.alive' ab sirf tab likha jata hai jab kaam WAQAI hua (chakkar poora / 5-sec check kamyab).
// Pehle har 30 sec khud likhta tha — chakkar atak jata to bhi doctor ko "zinda" dikhta (11-Oct shaam 12 min stock ruka raha). Ab atki to 3 min mein doctor dobara chalata hai.
const HB_FILE = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive');
const beat = () => { try { require('fs').writeFileSync(HB_FILE, String(Date.now())); } catch {} };
beat();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');

// ---------- SETTINGS ----------

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor) — password yahan NAHI

const BUSINESS_ID = 'noor-traders';

// Kaunsi branch ka stock chahiye.
// 'auto' = jitni branch ka stock mojood hai, sab
// Sirf kuch chahiye to aise likhein: [9, 1]
const BRANCHES = 'auto';

// Ek document mein kitne items (chhota = ek item badalne par kam data dobara)
const CHUNK_SIZE = 200;

// true = zero stock wale items bhi bhejein (app mein "Zero stock" ka filter chalega)
// false = sirf woh items jin ka stock zero nahi
const INCLUDE_ZERO = true;

// true = POS mein INACTIVE items aur jin ka naam sirf "-" / khali hai, app mein na bhejein
const SKIP_INACTIVE = true;

// 0 = ek dafa chala kar band. 2 = har 2 minute khud chalta rahega
const LOOP_MINUTES = 2;

// v2: har 5 second POS SQL se halki "fingerprint" (stock / rate badla?) — badla to foran poora chakkar
const FAST_SECONDS = 5;
// v2: ek chakkar is se zyada chale = atka hua -> script khud band, stock-auto.bat 30 sec mein dobara chalata hai
const CYCLE_LIMIT_SEC = 90, FIRST_CYCLE_LIMIT_SEC = 300;
// v2: app ke 🟢/🔴 chip ke liye posStock/_live (har chakkar par, takreeban 2 min — kam reads)
const LIVE_DOC = '_live';

// PC par hashon ki chhoti si list — is se har dafa Firestore parhna nahi parta
const STATE_FILE = './last-stock.json';
const FULL_CHECK_EVERY = 30;   // har 30 chakkar (takreeban 1 ghanta) poora milaan

// ---------- neeche kuch badalne ki zaroorat nahi ----------

if (!getApps().length) {
  initializeApp({ credential: cert(require('./firebase-key.json')) });
}
const db = getFirestore();
const stockCol = db.collection('businesses').doc(BUSINESS_ID).collection('posStock');

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const hashOf = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');

// Stock ki query — Items + ItemBranchRate
const Q_STOCK = `
SELECT i.ItemID, i.ItemCode, i.ItemName,
       r.CurrStock, i.PackQty, i.PackQtyName, i.QtyName, i.SaleRate, i.PurchaseRate,
       r.SaleRate AS BRetail, r.SaleRate3 AS BWhole, r.SaleRateSize AS BWholeSize,
       r.PurchaseRate AS BCost, r.SaleRate2 AS BRetail2
FROM dbo.ItemBranchRate r
JOIN dbo.Items i ON i.ItemID = r.ItemID
WHERE r.BranchID = @branch
ORDER BY i.ItemName
`;

const Q_STOCK_NONZERO = Q_STOCK.replace('WHERE r.BranchID = @branch', 'WHERE r.BranchID = @branch AND r.CurrStock <> 0');

// Har item ka AAKHRI purchase rate (asal bill se)
async function lastPurchaseRates(pool) {
  try {
    const r = await pool.request().query(`
      SELECT d.ItemID, d.Rate
      FROM dbo.PurchaseDetail d
      JOIN (
        SELECT ItemID, MAX(PurchaseDetailID) AS LastID
        FROM dbo.PurchaseDetail
        GROUP BY ItemID
      ) last ON last.ItemID = d.ItemID AND last.LastID = d.PurchaseDetailID`);
    const map = new Map();
    r.recordset.forEach(x => map.set(x.ItemID, Number(x.Rate) || 0));
    return map;
  } catch (e) {
    console.log('Aakhri purchase rate nahi mila:', e.message);
    return new Map();
  }
}

// Kaun kaun si branch ka stock mojood hai
async function branchList(pool) {
  if (Array.isArray(BRANCHES)) return BRANCHES;
  const r = await pool.request().query(
    INCLUDE_ZERO
      ? 'SELECT DISTINCT BranchID FROM dbo.ItemBranchRate'
      : 'SELECT DISTINCT BranchID FROM dbo.ItemBranchRate WHERE CurrStock <> 0'
  );
  return r.recordset.map(x => x.BranchID).sort((a, b) => a - b);
}

// Branch ke asal naam (Noor Traders, Godam 1 waghera) — na milein to koi baat nahi
async function branchNames(pool) {
  try {
    const t = await pool.request().query(`
      SELECT TOP 1 c.TABLE_NAME AS T, n.COLUMN_NAME AS N
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.COLUMNS n ON n.TABLE_NAME = c.TABLE_NAME
      WHERE c.COLUMN_NAME = 'BranchID'
        AND c.TABLE_NAME LIKE '%Branch%'
        AND n.COLUMN_NAME LIKE '%Name%'
      ORDER BY LEN(c.TABLE_NAME)`);
    if (!t.recordset.length) return {};
    const { T, N } = t.recordset[0];
    const r = await pool.request().query(`SELECT BranchID, [${N}] AS BranchName FROM dbo.[${T}]`);
    const map = {};
    r.recordset.forEach(x => { map[x.BranchID] = String(x.BranchName || '').trim(); });
    return map;
  } catch {
    return {};
  }
}

// 2026-10-04: CATEGORY (item ki category ka naam — app mein "apni factory" wale items pehchanne ke liye). Items mein jo bhi khana
// 'categ' naam ka ho (CategoryID / ItemCategoryID) aur jis table ke naam mein 'categ' ho us ka Name khana — khud dhoondta hai.
let catJoin = null;   // null = abhi nahi dekha, '' = nahi mila
async function categoryJoin(pool) {
  if (catJoin !== null) return catJoin;
  catJoin = '';
  try {
    const col = (await pool.request().query(`SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Items' AND COLUMN_NAME LIKE '%ategor%ID%'`)).recordset[0]?.c;
    if (!col) return catJoin;
    const tabs = (await pool.request().query(`SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS k FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME LIKE '%ategor%' AND c.COLUMN_NAME = '${col}'`)).recordset;
    for (const t of tabs) {
      const nm = (await pool.request().query(`SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t.t}' AND (COLUMN_NAME LIKE '%Name%' OR COLUMN_NAME LIKE '%Title%') AND DATA_TYPE IN ('varchar','nvarchar','char','nchar')`)).recordset[0]?.c;
      if (nm) { catJoin = { col, table: t.t, key: t.k, name: nm }; break; }
    }
  } catch (e) { console.log('Category nahi mili: ' + e.message); }
  return catJoin;
}
let hasActiveCol = null;
async function skipFilter(pool) {
  if (!SKIP_INACTIVE) return '';
  if (hasActiveCol === null) {
    const r = await pool.request().query(`SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Items' AND COLUMN_NAME = 'IsActive'`);
    hasActiveCol = r.recordset[0].n > 0;
  }
  return (hasActiveCol ? ' AND ISNULL(i.IsActive, 1) = 1' : '') +
    ` AND LTRIM(RTRIM(ISNULL(i.ItemName, ''))) NOT IN ('', '-', '--', N'\u2013', N'\u2014')`;
}

// ---------- BARCODES (POS ke "SB Barcode" wale khane) ----------
// POS mein ek item ke kai barcode ho sakte hain. Woh table khud dhoondi jati hai:
// jis table ke naam mein "barcode" ho aur us mein ItemID ho (ya Items table ka barcode khana).
let barcodeSrc;   // undefined = abhi nahi dekha, [] = nahi mila
async function barcodeMap(pool) {
  if (barcodeSrc === undefined) {
    try {
      const r = await pool.request().query(`
        SELECT c.TABLE_SCHEMA AS S, c.TABLE_NAME AS T, c.COLUMN_NAME AS C
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
        JOIN INFORMATION_SCHEMA.COLUMNS k ON k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = 'ItemID'
        WHERE c.COLUMN_NAME LIKE '%barcode%'
          AND c.DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar')
          AND (c.TABLE_NAME LIKE '%barcode%' OR c.TABLE_NAME LIKE '%subcode%' OR c.TABLE_NAME = 'Items')`);
      barcodeSrc = r.recordset;
      console.log('Barcode khane: ' + (barcodeSrc.length ? barcodeSrc.map(x => `${x.T}.${x.C}`).join(', ') : 'koi nahi mila'));
    } catch (e) { barcodeSrc = []; console.log('Barcode table nahi dekh saka: ' + e.message); }
  }
  const map = new Map();
  for (const src of barcodeSrc) {
    try {
      const col = `[${src.C.replace(/]/g, ']]')}]`;
      const tbl = `[${src.S.replace(/]/g, ']]')}].[${src.T.replace(/]/g, ']]')}]`;
      const r = await pool.request().query(`SELECT ItemID, LTRIM(RTRIM(CAST(${col} AS varchar(100)))) AS B
        FROM ${tbl} WHERE ${col} IS NOT NULL AND LTRIM(RTRIM(CAST(${col} AS varchar(100)))) <> ''`);
      for (const x of r.recordset) {
        const b = String(x.B || '').trim();
        if (!b) continue;
        if (!map.has(x.ItemID)) map.set(x.ItemID, new Set());
        map.get(x.ItemID).add(b);
      }
    } catch (e) { console.log(`Barcode nahi parhe (${src.T}): ${e.message}`); }
  }
  return map;
}

// ---------- SUB-BARCODE KI TADAD (v5, 2026-09-19) ----------
// POS ItemSubCode: har sub-barcode ke saath SBItemQty (misal garam masala label 0.25, khajoor 0.5).
// Sirf woh bhejte hain jin ki tadad 1 nahi. App scan par wohi tadad daalti hai. SQL mein kuch nahi likhta.
async function subQtyMap(pool) {
  const map = new Map();
  try {
    const r = await pool.request().query(`SELECT ItemID, LTRIM(RTRIM(SBBarCode)) AS B, SBItemQty AS Q
      FROM dbo.ItemSubCode
      WHERE SBItemQty IS NOT NULL AND SBItemQty > 0 AND SBItemQty <> 1
        AND LTRIM(RTRIM(ISNULL(SBBarCode, ''))) <> ''`);
    for (const x of r.recordset) {
      const b = String(x.B || '').trim(), q = Math.round((Number(x.Q) || 0) * 1000) / 1000;   // v7: 3 decimal (0.125)
      if (!b || !(q > 0)) continue;
      if (!map.has(x.ItemID)) map.set(x.ItemID, []);
      map.get(x.ItemID).push({ b, q });
    }
    for (const list of map.values()) list.sort((a, c) => a.b < c.b ? -1 : a.b > c.b ? 1 : 0);
  } catch (e) { console.log('Sub-barcode ki tadad nahi parhi: ' + e.message); }
  return map;
}

// ---------- SUB-BARCODE "Show" CHECK (v8, 2026-09-19) ----------
// Jis item ke sub-barcode hain us ke liye bs: [Show ✓ wale barcode] (khali bhi ho sakti hai). Sirf SELECT.
async function showMap(pool) {
  const map = new Map();
  try {
    const r = await pool.request().query(`SELECT ItemID, LTRIM(RTRIM(SBBarCode)) AS B, IsShowOnLookup AS S
      FROM dbo.ItemSubCode WHERE LTRIM(RTRIM(ISNULL(SBBarCode, ''))) <> ''`);
    for (const x of r.recordset) {
      if (!map.has(x.ItemID)) map.set(x.ItemID, []);
      const b = String(x.B || '').trim();
      if (x.S === true || x.S === 1) map.get(x.ItemID).push(b);
    }
    for (const list of map.values()) list.sort();
  } catch (e) { console.log('Sub-barcode ka Show check nahi parha: ' + e.message); }
  return map;
}

// ---------- SUB-BARCODE POORI TAFSEEL (v9, 2026-09-20) ----------
// sb: [{ id: ItemSubCodeID, b: barcode, q: tadad, r: SBSaleRate, s: Show }] — app is id se edit / delete bhejti hai.
async function subFullMap(pool) {
  const map = new Map();
  try {
    const r = await pool.request().query(`SELECT ItemSubCodeID AS I, ItemID, LTRIM(RTRIM(SBBarCode)) AS B, SBItemQty AS Q, SBSaleRate AS R, IsShowOnLookup AS S
      FROM dbo.ItemSubCode WHERE LTRIM(RTRIM(ISNULL(SBBarCode, ''))) <> '' ORDER BY ItemSubCodeID`);
    for (const x of r.recordset) {
      if (!map.has(x.ItemID)) map.set(x.ItemID, []);
      map.get(x.ItemID).push({ id: x.I, b: String(x.B || '').trim(), q: Math.round((Number(x.Q) || 1) * 1000) / 1000,
        r: round2(x.R), s: x.S === true || x.S === 1 });
    }
  } catch (e) { console.log('Sub-barcode ki tafseel nahi parhi: ' + e.message); }
  return map;
}

async function readStock(pool, branch, lastRates, codes, subq, shows, subs) {
  const base = INCLUDE_ZERO ? Q_STOCK : Q_STOCK_NONZERO;
  let q = base.replace('WHERE r.BranchID = @branch', 'WHERE r.BranchID = @branch' + await skipFilter(pool));
  const cj = await categoryJoin(pool);   // 2026-10-04: category ka naam (cat)
  if (cj) q = q.replace('SELECT i.ItemID,', `SELECT i.ItemID, cat.[${cj.name}] AS CatName,`).replace('JOIN dbo.Items i ON i.ItemID = r.ItemID', `JOIN dbo.Items i ON i.ItemID = r.ItemID LEFT JOIN dbo.[${cj.table}] cat ON cat.[${cj.key}] = i.[${cj.col}]`);
  const res = await pool.request().input('branch', sql.Int, branch).query(q);

  return res.recordset.map(r => {
    const stock = round2(r.CurrStock);
    const pack = Number(r.PackQty) || 0;
    const ctn = pack > 0 ? Math.floor(stock / pack) : 0;
    const pcs = pack > 0 ? round2(stock - ctn * pack) : stock;

    const code = String(r.ItemCode || '').trim();
    const extra = codes && codes.has(r.ItemID) ? [...codes.get(r.ItemID)].filter(b => b !== code) : [];
    return {
      id: r.ItemID,
      code,
      ...(extra.length ? { bc: extra.sort() } : {}),     // item ke baqi barcode (scan ke liye)
      ...(subq && subq.has(r.ItemID) ? { bq: subq.get(r.ItemID) } : {}),   // v5: sub-barcode ki tadad [{b, q}]
      ...(shows && shows.has(r.ItemID) ? { bs: shows.get(r.ItemID) } : {}),   // v8: Show ✓ wale sub-barcode
      ...(subs && subs.has(r.ItemID) ? { sb: subs.get(r.ItemID) } : {}),   // v9: poori tafseel (edit/delete ke liye)
      name: String(r.ItemName || '').trim(),
      ...(r.CatName ? { cat: String(r.CatName).trim().slice(0, 40) } : {}),   // 2026-10-04: category (jaise 'apni factory')
      stock,                                        // kul pieces
      pack,                                         // ek carton mein kitne
      ctn,                                          // poore carton
      pcs,                                          // bacha hua
      cName: String(r.PackQtyName || 'Ctn').trim(),
      uName: String(r.QtyName || 'Pcs').trim(),
      // v2 rate (2026-09-17): POS item screen wale rate ItemBranchRate mein hain (branch ke hisaab se)
      //   SaleRate = R Peice (counter)  ·  SaleRate3 / SaleRateSize = W Peice (wholesale)
      //   PurchaseRate = khareed, pehle se EK PIECE ka
      rate: round2(Number(r.BRetail) || r.SaleRate),
      wrate: round2(Number(r.BWhole) || Number(r.BWholeSize) || 0),
      // 2026-10-08: W PCS (SaleRateSize) alag — sirf jab W CTN÷pack (SaleRate3) se farq ho (warna wrate hi kaafi, writes kam)
      ...(Number(r.BWhole) > 0 && Number(r.BWholeSize) > 0 && Math.abs(round2(r.BWholeSize) - round2(r.BWhole)) > 0.004 ? { ws: round2(r.BWholeSize) } : {}),
      ...(Number(r.BRetail2) > 0 ? { rate2: round2(r.BRetail2) } : {}),   // v6: POS "Peice Rate" (SaleRate2) — khula piece
      // Khareed ka bhao PER PIECE.
      // POS ke Items mein PurchaseRate poore carton/bore ka hota hai (misal 8500),
      // aur pack se taqseem karne par ek piece ka banta hai (8500 / 25 = 340).
      prate: (() => {
      // POS mein kisi item ka PurchaseRate poore carton/bore ka hai (Baba rice 8500),
      // kisi ka ek piece ka (ghee pouch 590.4). Jo SaleRate ke qareeb ho woh piece ka bhao hai.
      if (Number(r.BCost) > 0) return round2(r.BCost);   // branch ka asal khareed bhao (fi piece)
      const sale = Number(r.BRetail) || Number(r.SaleRate) || 0;
      const perPiece = v => {
        v = Number(v) || 0;
        if (!v || pack <= 1) return v;
        if (!sale) return v / pack;
        const a = v / pack;
        return Math.abs(Math.log(a / sale)) < Math.abs(Math.log(v / sale)) ? a : v;
      };
      const itemRate = perPiece(r.PurchaseRate);
      if (itemRate > 0) return round2(itemRate);
      const billRate = lastRates && lastRates.has(r.ItemID) ? lastRates.get(r.ItemID) : 0;
      return round2(perPiece(billRate));
    })()
    };
  });
}

// v3 (2026-10-30): 🏪 ONLINE DUKAN (website dukan/) — halki public list. Dukan (NOOR TRADERS, naam se) ka retail rate, warna kisi godam ka.
const webCol = db.collection('businesses').doc(BUSINESS_ID).collection('webDukan');
const bandRef = db.collection('businesses').doc(BUSINESS_ID).collection('stockCount').doc('_hidden');
let webHash = '', webBandAt = 0, webBand = {};
async function pushWeb(byBranch, names) {
  try {
    if (Date.now() - webBandAt > 10 * 60e3) { try { const b = await bandRef.get(); webBand = (b.exists && b.data() && b.data().items) || {}; } catch {} webBandAt = Date.now(); }
    const keys = [...byBranch.keys()];
    const shopB = keys.find(b => /noor/i.test(String(names[b] || ''))) ?? (byBranch.has(1) ? 1 : keys[0]);
    const M = new Map();
    for (const [b, items] of byBranch) for (const r of items) {
      const k = String(r.id); let m = M.get(k);
      if (!m) { m = { id: r.id, n: r.name, c: r.cat || '', r: 0, u: r.uName || 'Pcs', s: 0, shop: false }; M.set(k, m); }
      m.s += Number(r.stock) || 0;
      if (!m.c && r.cat) m.c = r.cat;
      if (b === shopB && Number(r.rate) > 0) { m.r = Number(r.rate); m.shop = true; m.u = r.uName || m.u; }
      else if (!m.shop && Number(r.rate) > m.r) m.r = Number(r.rate);
    }
    const rows = [...M.values()].filter(m => m.s > 0 && m.r > 0 && m.n && !webBand[String(m.id)])
      .sort((a, b) => Number(a.id) - Number(b.id)).map(m => [m.id, m.n, m.c, round2(m.r), m.u]);
    const h = hashOf(rows);
    if (h === webHash) return;
    await webCol.doc('cat').set({ j: JSON.stringify(rows), n: rows.length, h, at: Date.now(), by: 'pc' });
    webHash = h;
    console.log(`[${new Date().toLocaleTimeString()}] 🏪 Online dukan: ${rows.length} items website par`);
  } catch (e) { console.log('🏪 Online dukan list nahi likhi:', e.message); }
}

let cycle = 0;

const readState = () => {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
};
const saveState = st => {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(st)); } catch {}
};

async function pushBranch(branch, items, name) {
  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) chunks.push(items.slice(i, i + CHUNK_SIZE));

  // Maujooda chunks ke hash: PC ki list se, aur ghante mein ek dafa Firestore se
  const state = readState();
  const fullCheck = cycle % FULL_CHECK_EVERY === 0 || !state[branch];
  const current = new Map();

  if (fullCheck) {
    const existing = await stockCol.where('branch', '==', branch).get();
    existing.forEach(d => current.set(d.id, { hash: d.data().hash }));
  } else {
    for (const [id, hash] of Object.entries(state[branch])) current.set(id, { hash });
  }

  const batch = db.batch();
  let written = 0, skipped = 0, removed = 0;

  chunks.forEach((rows, i) => {
    const id = `b${branch}-${String(i).padStart(3, '0')}`;
    const hash = hashOf(rows);

    if (current.get(id) && current.get(id).hash === hash) skipped++;
    else {
      batch.set(stockCol.doc(id), {
        branch, name, order: i, hash,
        count: rows.length,
        items: rows,
        updatedAt: Date.now()
      });
      written++;
    }
    current.delete(id);
  });

  // items kam ho gaye to purane fazool chunks hata dein
  current.delete(`b${branch}-meta`);
  for (const leftover of current.keys()) {
    batch.delete(stockCol.doc(leftover));
    removed++;
  }

  // Meta sirf tab likhein jab kuch badla ho, ya ghante mein ek dafa.
  // Warna roz hazaron fazool writes ban jate hain.
  const metaDue = written > 0 || removed > 0 || fullCheck;
  if (metaDue) {
    batch.set(stockCol.doc(`b${branch}-meta`), {
      branch, name, order: -1, meta: true,
      chunks: chunks.length,
      totalItems: items.length,
      totalPcs: round2(items.reduce((s, r) => s + r.stock, 0)),
      totalCtn: items.reduce((s, r) => s + r.ctn, 0),
      writer: 'pos-stock-sync',
      syncedAt: Date.now()
    });
    written++;
  }

  if (written > 0 || removed > 0) await batch.commit();

  // nayi haalat PC par mehfooz kar lein
  const fresh = {};
  chunks.forEach((r, i) => { fresh[`b${branch}-${String(i).padStart(3, '0')}`] = hashOf(r); });
  const st = readState();
  st[branch] = fresh;
  saveState(st);

  return { written, skipped, removed, total: items.length, chunks: chunks.length, fullCheck };
}

// v2: ek hi pakka SQL connection (har 5 sec naya connect / close nahi) + query ki had (atke nahi)
let poolP = null;
async function getPool() {
  if (poolP) { try { const p = await poolP; if (p.connected) return p; } catch {} }
  poolP = new sql.ConnectionPool({ requestTimeout: 45000, connectionTimeout: 15000, ...SQL_CONFIG }).connect();
  poolP.catch(() => { poolP = null; });
  return poolP;
}
async function resetPool() { const p = poolP; poolP = null; try { (await p)?.close(); } catch {} }

// v2: halki fingerprint — har godam ke stock + rates aur items ke naam/pack ka checksum (sirf parhta hai, ek line ka jawab)
const Q_FP = `
SELECT 'b' + CAST(BranchID AS varchar(10)) AS k, COUNT_BIG(*) AS n,
       CHECKSUM_AGG(CHECKSUM(ItemID, CurrStock, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate, PackQty)) AS c
FROM dbo.ItemBranchRate GROUP BY BranchID
UNION ALL
SELECT 'items', COUNT_BIG(*), CHECKSUM_AGG(CHECKSUM(ItemID, ItemName, PackQty, PackQtyName, QtyName, SaleRate, PurchaseRate)) FROM dbo.Items`;
// agar kisi POS version mein koi khana na ho to sirf stock wali halki query; woh bhi na chale to 5-sec check band (2 min wala chalta rahe)
const Q_FP_SIMPLE = `SELECT 'b' + CAST(BranchID AS varchar(10)) AS k, COUNT_BIG(*) AS n, CHECKSUM_AGG(CHECKSUM(ItemID, CurrStock)) AS c FROM dbo.ItemBranchRate GROUP BY BranchID`;
let fpMode = 0, fpFails = 0;
async function fingerprint() {
  if (fpMode > 1) return '';
  const p = await getPool();
  try {
    const r = await p.request().query(fpMode ? Q_FP_SIMPLE : Q_FP);
    fpFails = 0;
    return r.recordset.map(x => `${x.k}:${x.n}:${x.c}`).sort().join('|');
  } catch (e) {
    if (/Invalid column|Invalid object|Operand type clash|not valid/i.test(e.message) || ++fpFails >= 5) { fpMode++; fpFails = 0; console.log(fpMode > 1 ? '5-sec check BAND (POS query nahi chali) — sirf 2 min wala chakkar' : '5-sec check: choti query par aa gaye'); }
    throw e;
  }
}

let lastChange = 0;
async function markLive(changed) {
  const now = Date.now();
  if (changed) lastChange = now;
  try { await stockCol.doc(LIVE_DOC).set({ live: true, checkedAt: now, ...(lastChange ? { changedAt: lastChange } : {}), fastSec: FAST_SECONDS, writer: 'pos-stock-sync v2' }, { merge: true }); } catch (e) { console.log('_live nahi likha:', e.message); }
}

async function runOnce() {
  const pool = await getPool();
  cycle++;
  let anyChange = false;
  try {
    const list = await branchList(pool);
    const names = await branchNames(pool);
    const lastRates = await lastPurchaseRates(pool);
    const codes = await barcodeMap(pool);
    const subq = await subQtyMap(pool);
    const shows = await showMap(pool);
    const subs = await subFullMap(pool);

    const byBranch = new Map();   // v3: 🏪 online dukan
    for (const branch of list) {
      const name = names[branch] || ('Branch ' + branch);
      const items = await readStock(pool, branch, lastRates, codes, subq, shows, subs);
      byBranch.set(branch, items);
      const r = await pushBranch(branch, items, name);
      if (r.written || r.removed) anyChange = true;
      beat();   // har godam ke baad = kaam chal raha hai
      const tag = r.fullCheck ? ' | poora milaan' : '';
      console.log(`[${new Date().toLocaleTimeString()}] ${name} (${branch}): ${r.total} items, ${r.chunks} chunks | likhe ${r.written} | chhore ${r.skipped} | hataye ${r.removed}${tag}`);
    }
    await pushWeb(byBranch, names);
  } catch (e) { await resetPool(); throw e; }
  await markLive(anyChange);
  return anyChange;
}

// v2: chakkar chalane wala — ek waqt mein ek; CHOWKIDAR: had se lamba chale to script band (bat dobara chalayega)
let busy = false, lastFp = '', pendingFast = false;
async function cycleNow(why) {
  if (busy) { if (why === 'tabdeeli') pendingFast = true; return false; }
  busy = true;
  const limit = (cycle === 0 ? FIRST_CYCLE_LIMIT_SEC : CYCLE_LIMIT_SEC) * 1000;
  const dog = setTimeout(() => { console.error(`[${new Date().toLocaleTimeString()}] CHOWKIDAR: chakkar ${limit / 1000} sec se atka (${why}) — script band, bat dobara chalayega`); process.exit(3); }, limit);
  try {
    let fp = ''; try { fp = await fingerprint(); } catch (e) { console.log('Fingerprint nahi mili:', e.message); }
    const t0 = Date.now();
    const ch = await runOnce();
    if (fp) lastFp = fp;
    beat();
    if (why === 'tabdeeli') console.log(`[${new Date().toLocaleTimeString()}] ⚡ POS mein tabdeeli — ${((Date.now() - t0) / 1000).toFixed(1)} sec mein app tak${ch ? '' : ' (stock wahi, sirf doosri cheez badli)'}`);
    return true;
  } catch (e) { console.error('Stock sync fail:', e.message); return false; }
  finally { clearTimeout(dog); busy = false; if (pendingFast) { pendingFast = false; setTimeout(() => fastTick(), 500); } }
}
async function fastTick() {
  if (busy || fpMode > 1) return;
  try {
    const fp = await fingerprint();
    if (!fp) return;
    beat();   // SQL ne jawab diya = zinda
    if (lastFp && fp !== lastFp) await cycleNow('tabdeeli');
    else if (!lastFp) lastFp = fp;
  } catch (e) { console.log('5-sec check fail:', e.message); if (!/Invalid|clash|not valid/i.test(e.message)) await resetPool(); }
}
module.exports._t = { fingerprint, runOnce, cycleNow, fastTick, markLive, getPool, Q_FP };

if (require.main === module) (async () => {
  const ok = await cycleNow('shuru');
  if (!ok) { console.error('Pehla chakkar fail — 30 sec baad bat dobara chalayega'); process.exit(1); }
  if (LOOP_MINUTES > 0) {
    console.log(`Har ${FAST_SECONDS} sec POS check (tabdeeli par foran) + har ${LOOP_MINUTES} min poora chakkar. Band karne ke liye Ctrl+C.`);
    setInterval(() => { cycleNow('2 min'); }, LOOP_MINUTES * 60 * 1000);
    setInterval(() => { fastTick(); }, FAST_SECONDS * 1000);
  } else process.exit(0);
})();
