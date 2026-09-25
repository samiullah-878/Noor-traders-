// =========================================================
//  sync-stock.js  —  POS ka stock Firestore par bhejta hai
//  SQL mein kuch LIKHTA nahi - sirf padhta hai.
// =========================================================
//
//  Chalane ka tareeqa:   node sync-stock.js
//  Pehli dafa  : saara stock jayega
//  Us ke baad  : sirf woh hissa jayega jis mein tabdeeli hui
//  Stock na badle to ZERO writes.

const sql = require('mssql');
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
  const q = base.replace('WHERE r.BranchID = @branch', 'WHERE r.BranchID = @branch' + await skipFilter(pool));
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

async function runOnce() {
  const pool = await sql.connect(SQL_CONFIG);
  cycle++;
  try {
    const list = await branchList(pool);
    const names = await branchNames(pool);
    const lastRates = await lastPurchaseRates(pool);
    const codes = await barcodeMap(pool);
    const subq = await subQtyMap(pool);
    const shows = await showMap(pool);
    const subs = await subFullMap(pool);

    for (const branch of list) {
      const name = names[branch] || ('Branch ' + branch);
      const items = await readStock(pool, branch, lastRates, codes, subq, shows, subs);
      const r = await pushBranch(branch, items, name);
      const tag = r.fullCheck ? ' | poora milaan' : '';
      console.log(`[${new Date().toLocaleTimeString()}] ${name} (${branch}): ${r.total} items, ${r.chunks} chunks | likhe ${r.written} | chhore ${r.skipped} | hataye ${r.removed}${tag}`);
    }
  } finally {
    await pool.close();
  }
}

(async () => {
  try {
    await runOnce();
    if (LOOP_MINUTES > 0) {
      console.log(`Har ${LOOP_MINUTES} minute par dobara chalega. Band karne ke liye Ctrl+C.`);
      let busy = false;   // pichla chakkar khatam na hua ho to naya shuru na ho (SQL connection takrata tha)
      setInterval(async () => {
        if (busy) { console.log('Pichla chakkar abhi chal raha hai — yeh chakkar chhora'); return; }
        busy = true;
        try { await runOnce(); } catch (e) { console.error('Stock sync fail:', e.message); } finally { busy = false; }
      }, LOOP_MINUTES * 60 * 1000);
    } else {
      process.exit(0);
    }
  } catch (e) {
    console.error('Stock sync fail:', e);
    process.exit(1);
  }
})();
