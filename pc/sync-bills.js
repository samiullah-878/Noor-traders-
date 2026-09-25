// =========================================================
//  sync-bills.js  —  POS ke purchase bill ki poori tafseel
//  item, godam, CTN rate, PCS rate, qty, total
//  SQL mein kuch LIKHTA nahi - sirf padhta hai.
//  v6 (22-Sep-2026): bills-now.flag (purchase-post v4 likhta hai) har 5 second dekhti hai — ho to FORAN chakkar (2 minute
//     ka intezar nahi). Baqi sab v5 jaisa.
//  v5 (22-Sep-2026, ASAL v4 par): app ki "✏️ POS Purchase screen mein Edit" ke liye bill par purchaseId, posPartyId,
//     docStatus, invoiceNo, stamp (purchase-post.js edit se pehle isi se milata hai) aur har line par itemId, qtyPcs
//     (asal Qty = pieces), ratePcs (asal Rate fi piece), godamId. v4 ke saare field (qty/loose/status...) waise hi.
// =========================================================

const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');

// ---------- SETTINGS ----------

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor) — password yahan NAHI

const BUSINESS_ID = 'noor-traders';
const START_DATE = '2026-09-15';   // is tareekh se aage ke bill
const ENTRY_PREFIX = 'pos-';       // sync.js wali id ka shuruati hissa
const LOOP_MINUTES = 2;            // 0 = ek dafa
const STATE_FILE = './last-bills.json';
const MAX_DELETE = 20;             // is se zyada bill ek dafa "gayab" hon to kuch nahi mitata (SQL ki ghalti ho sakti hai)

// ---------- neeche kuch badalne ki zaroorat nahi ----------

if (!getApps().length) {
  initializeApp({ credential: cert(require('./firebase-key.json')) });
}
const db = getFirestore();
const billCol = db.collection('businesses').doc(BUSINESS_ID).collection('posBills');

const paisa = n => Math.round((Number(n) || 0) * 100);
const num = n => Math.round((Number(n) || 0) * 1000) / 1000;
const hashOf = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const saveState = st => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(st)); } catch {} };
const dateStr = d => { const x = new Date(d), p = n => String(n).padStart(2, '0');
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); };

// Column ka naam alag ho sakta hai — jo mile wahi le lein
function pick(row, names) {
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === n.toLowerCase() && row[key] != null) return row[key];
    }
  }
  return null;
}

// Branch ke asal naam (Noor Traders, Godam 1 waghera)
// v5: bill ki haalat ka nishan — purchase-post.js mein BILKUL yahi function hai (dono ek jaise rehne chahiyein)
function billStamp(partyId, rows) {
  const s = rows.map(r => [Number(r.ItemID), Number(r.Qty), Number(r.Rate), Number(r.GBranchID) || 0].join('|')).sort().join(';');
  return crypto.createHash('sha1').update(String(partyId) + '#' + s).digest('hex').slice(0, 16);
}

async function branchNames(pool) {
  try {
    const t = await pool.request().query(`
      SELECT TOP 1 c.TABLE_NAME AS T, n.COLUMN_NAME AS N
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.COLUMNS n ON n.TABLE_NAME = c.TABLE_NAME
      WHERE c.COLUMN_NAME = 'BranchID' AND c.TABLE_NAME LIKE '%Branch%'
        AND n.COLUMN_NAME LIKE '%Name%'
      ORDER BY LEN(c.TABLE_NAME)`);
    if (!t.recordset.length) return {};
    const { T, N } = t.recordset[0];
    const r = await pool.request().query(`SELECT BranchID, [${N}] AS BranchName FROM dbo.[${T}]`);
    const map = {};
    r.recordset.forEach(x => { map[x.BranchID] = String(x.BranchName || '').trim(); });
    return map;
  } catch { return {}; }
}

const Q_HEAD = `
SELECT p.PurchaseID, p.PurchaseNo, p.PurchaseDate, p.DocStatusID, p.PartyID, p.PartyInvoiceNo,
       pt.PartyName, pt.Phone1,
       ISNULL(p.TaxAmount,0) AS TaxAmount,
       ISNULL(p.DiscountAmt,0) AS DiscountAmt
FROM dbo.Purchase p
JOIN dbo.Party pt ON pt.PartyID = p.PartyID
WHERE p.PurchaseDate >= @startDate
`;

// d.* — taake har column mil jaye, naam chahe kuch bhi ho
const Q_LINES = `
SELECT d.*, i.ItemName, i.ItemCode, i.PackQty AS ItemPackQty, i.PackQtyName, i.QtyName
FROM dbo.PurchaseDetail d
JOIN dbo.Items i ON i.ItemID = d.ItemID
JOIN dbo.Purchase p ON p.PurchaseID = d.PurchaseID
WHERE p.PurchaseDate >= @startDate
`;

async function readBills(pool, names) {
  const heads = (await pool.request().input('startDate', sql.Date, START_DATE).query(Q_HEAD)).recordset;
  const lines = (await pool.request().input('startDate', sql.Date, START_DATE).query(Q_LINES)).recordset;

  const byId = new Map();
  for (const h of heads) {
    byId.set(h.PurchaseID, {
      id: ENTRY_PREFIX + h.PurchaseID,
      billNo: String(h.PurchaseNo || '').trim(),
      status: Number(h.DocStatusID) || 1,   /* v-posting */
      date: dateStr(h.PurchaseDate),
      partyName: String(h.PartyName || '').trim(),
      partyPhone: String(h.Phone1 || '').trim(),
      tax: paisa(h.TaxAmount),
      discount: paisa(h.DiscountAmt),
      purchaseId: h.PurchaseID,                      /* v5 */
      posPartyId: h.PartyID,
      docStatus: h.DocStatusID == null ? null : Number(h.DocStatusID),
      invoiceNo: String(h.PartyInvoiceNo || '').trim(),
      lines: [],
      _raw: []
    });
  }

  for (const l of lines) {
    const bill = byId.get(l.PurchaseID);
    if (!bill) continue;

    // GBranchID = godam. Qty = carton ki ginti. Rate = ek carton ka bhao.
    const branchId = pick(l, ['GBranchID','BranchID']);
    // v4: Qty = pieces (kg) aur Rate = fi piece (POS PurchaseDetail) — carton khud nikaalo
    const pcsQty   = Number(pick(l, ['Qty','Quantity']) ?? 0);          // kul pieces
    const pcsRate  = Number(pick(l, ['Rate','PreRate']) ?? 0);          // ek piece ka bhao
    const perCtn   = Number(l.ItemPackQty) || 0;                        // ek carton mein kitne pcs
    const ctnQty   = perCtn > 1 ? Math.floor(pcsQty / perCtn + 1e-9) : pcsQty;
    const loosePcs = perCtn > 1 ? Math.round((pcsQty - ctnQty * perCtn) * 1000) / 1000 : 0;
    const ctnRate  = perCtn > 1 ? pcsRate * perCtn : pcsRate;
    const bonus    = pick(l, ['Bonus','BonusQty']);
    const amount   = pick(l, ['Amount','NetAmount','TotalAmount','LineTotal']);
    const total    = amount != null ? Number(amount) : pcsRate * pcsQty;

    bill.lines.push({
      name: String(l.ItemName || '').trim(),
      code: String(l.ItemCode || '').trim(),
      godam: branchId != null ? (names[branchId] || ('Branch ' + branchId)) : '',
      qty: num(ctnQty),                                   // poore carton
      loose: perCtn > 1 ? num(loosePcs) : null,           // baqi khule pcs
      perCtn: perCtn > 1 ? num(perCtn) : null,            // 1 carton = kitne pcs
      totalPcs: perCtn > 1 ? num(pcsQty) : null,          // kul pieces
      ctn: paisa(ctnRate),                                // carton ka rate
      pcs: perCtn > 1 ? paisa(pcsRate) : null,            // ek piece ka rate
      bonus: bonus != null ? num(bonus) : null,
      cName: String(l.PackQtyName || 'Ctn').trim(),
      uName: String(l.QtyName || 'Pcs').trim(),
      total: paisa(total),
      itemId: l.ItemID,                                   // v5
      qtyPcs: num(pcsQty),
      ratePcs: Math.round((pcsRate || 0) * 10000) / 10000,
      godamId: branchId != null ? Number(branchId) : null
    });
    bill._raw.push(l);
  }

  for (const bill of byId.values()) {
    bill.stamp = billStamp(bill.posPartyId, bill._raw);   // v5
    delete bill._raw;
    bill.items = bill.lines.length;
    bill.net = bill.lines.reduce((s, l) => s + l.total, 0) + bill.tax - bill.discount;
  }
  return [...byId.values()];
}

let firstRun = true;   // script shuru hone par ek dafa Firestore se milaan (purane bache hue bill)

async function push(bills) {
  const state = readState(), fresh = {};
  if (!bills.length) {   // SQL se kuch na aaya: kuch mat mitao, purani haalat rakho
    return { written: 0, skipped: 0, removed: 0, total: 0 };
  }
  let written = 0, skipped = 0;
  for (let i = 0; i < bills.length; i += 400) {
    const batch = db.batch();
    let inBatch = 0;
    for (const bill of bills.slice(i, i + 400)) {
      const hash = hashOf(bill);
      fresh[bill.id] = hash;
      if (state[bill.id] === hash) { skipped++; continue; }
      batch.set(billCol.doc(bill.id), { ...bill, updatedAt: Date.now() });
      written++; inBatch++;
    }
    if (inBatch) await batch.commit();
  }

  // POS mein delete hue bill app se bhi hatao (sirf "pos-" wale, START_DATE ke baad ke)
  const gone = new Set(Object.keys(state).filter(id => !(id in fresh)));
  if (firstRun) {
    const snap = await billCol.where('date', '>=', START_DATE).select().get();
    snap.forEach(d => { if (d.id.startsWith(ENTRY_PREFIX) && !(d.id in fresh)) gone.add(d.id); });
  }
  let removed = 0;
  if (gone.size > MAX_DELETE) {
    console.log(`KHABARDAR: ${gone.size} bill POS mein nahi mile — ehtiyatan kuch nahi mitaya`);
    for (const id of gone) if (state[id]) fresh[id] = state[id];   // agli dafa phir dekhein
  } else if (gone.size) {
    const batch = db.batch();
    gone.forEach(id => batch.delete(billCol.doc(id)));
    await batch.commit();
    removed = gone.size;
  }
  firstRun = false;
  saveState(fresh);
  return { written, skipped, removed, total: bills.length };
}

async function runOnce() {
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const names = await branchNames(pool);
    const bills = await readBills(pool, names);
    const r = await push(bills);
    console.log(`[${new Date().toLocaleTimeString()}] Bills: ${r.total} | likhe ${r.written} | chhore ${r.skipped} | hataye ${r.removed}`);
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
        try { await runOnce(); } catch (e) { console.error('Bill sync fail:', e.message); } finally { busy = false; }
      }, LOOP_MINUTES * 60 * 1000);
      // v6: purchase-post ne bill banaya/badla -> bills-now.flag -> foran chakkar
      const FLAG = require('path').join(__dirname, 'bills-now.flag');
      setInterval(async () => {
        if (busy || !fs.existsSync(FLAG)) return;
        try { fs.unlinkSync(FLAG); } catch {}
        busy = true;
        console.log(`[${new Date().toLocaleTimeString()}] App/PC ne naya bill bataya — foran sync`);
        try { await runOnce(); } catch (e) { console.error('Bill sync fail:', e.message); } finally { busy = false; }
      }, 5000);
    } else { process.exit(0); }
  } catch (e) {
    console.error('Bill sync fail:', e);
    process.exit(1);
  }
})();
