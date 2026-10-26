// ============================================================
//  Noor Traders - POS se Blue Khata sync  (version 3)
//  v3 (2026-10-26): ⛔ POS mein CANCEL hua purchase bill = khate ki entry bhi 🗑 (deleted, posStatus 3, note "⛔ POS mein CANCEL").
//     Pehle cancel bill bas chhor diya jata tha — purani entry khate mein pari rehti (malik: bill 00002710 Rs 298,500 cancel ke baad bhi dena dikha).
//     Har chakkar pichhle 60 din ke cancel bills bhi dekhta hai (cancel-done.json yaad — Firestore ki faltu reads nahi). AI nahi.
//
//  POS ki purchase ab SEEDHA blueKhata mein jati hai:
//    - har supplier ka asal party record banta hai
//    - sabqa baqaya ek entry ki soorat mein aata hai
//    - nayi purchase 'borrow' (hum ne dena hai) ban kar jurti hai
//    - wasooli aap app mein karte hain -> balance khud ghatta hai
//
//  SQL mein kuch LIKHTA nahi - sirf padhta hai.
// ============================================================

const sql = require('mssql');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// ---------- SETTINGS ----------

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor) — password yahan NAHI

const BUSINESS_ID = 'noor-traders';

// Is tareekh se nayi purchase alag alag entry ban kar aayegi.
// Is se purana sab kuch ek "Sabqa baqaya" entry mein aa jayega.
const START_DATE = '2026-09-15';

// Jin DocStatusID ko chhorna hai (cancelled/draft)
const SKIP_STATUS = [3];
const CANCEL_DAYS = 60;                      // v3: itne din purane cancel bills har chakkar check
const CANCEL_FILE = './cancel-done.json';    // v3: jo cancel pehle hi khate se hat chuke

// ---------- neeche kuch badalne ki zaroorat nahi ----------

const STATE_FILE = './last-sync.json';
const WRITER = 'pos-sync';

const readLastSync = () => {
  try { return new Date(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).lastSync); }
  catch { return new Date(START_DATE); }
};
const saveLastSync = d => fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSync: d.toISOString() }));

const paisa = n => Math.round((Number(n) || 0) * 100);
const dateStr = d => {
  const x = new Date(d), p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};
const now = () => new Date().toISOString();

// Sabqa baqaya: START_DATE se pehle ka poora ledger balance
const Q_OPENING = `
SELECT p.PartyID, p.PartyName, p.Phone1,
       SUM(ISNULL(vd.Credit,0) - ISNULL(vd.Debit,0)) AS Bal
FROM dbo.Party p
JOIN dbo.VoucherDetail vd ON vd.AccountID = p.AccountID
JOIN dbo.Voucher v       ON v.VoucherID  = vd.VoucherID
WHERE v.VoucherDate < @startDate
GROUP BY p.PartyID, p.PartyName, p.Phone1
HAVING SUM(ISNULL(vd.Credit,0) - ISNULL(vd.Debit,0)) <> 0
`;

// Nayi / badli hui purchases
const Q_PURCHASE = `
SELECT p.PurchaseID, p.PurchaseNo, p.PurchaseDate, p.PartyID,
       pt.PartyName, pt.Phone1, p.DocStatusID,
       ISNULL(p.UpdatedOn, p.CreatedOn) AS ChangedOn,
       SUM(d.Qty * d.Rate) + ISNULL(p.TaxAmount,0) - ISNULL(p.DiscountAmt,0) AS NetAmount
FROM dbo.Purchase p
JOIN dbo.Party pt         ON pt.PartyID   = p.PartyID
JOIN dbo.PurchaseDetail d ON d.PurchaseID = p.PurchaseID
WHERE ISNULL(p.UpdatedOn, p.CreatedOn) > @since
  AND p.PurchaseDate >= @startDate
GROUP BY p.PurchaseID, p.PurchaseNo, p.PurchaseDate, p.PartyID,
         pt.PartyName, pt.Phone1, p.DocStatusID,
         p.UpdatedOn, p.CreatedOn, p.TaxAmount, p.DiscountAmt
ORDER BY ChangedOn
`;

// v3: pichhle CANCEL_DAYS din ke cancel (DocStatusID 3) purchase bills
const Q_CANCELLED = `
SELECT p.PurchaseID, p.PurchaseNo, p.PartyID, ISNULL(p.UpdatedOn, p.CreatedOn) AS ChangedOn
FROM dbo.Purchase p
WHERE p.DocStatusID = 3 AND p.PurchaseDate >= @fromDate
`;
const readCancelDone = () => { try { return JSON.parse(fs.readFileSync(CANCEL_FILE, 'utf8')) || {}; } catch { return {}; } };
const saveCancelDone = o => { try { fs.writeFileSync(CANCEL_FILE, JSON.stringify(o)); } catch {} };

// v3: ⛔ cancel bill ki khata entry 🗑 — bina pooche, kyunke POS hi asal hai. 🗑 Hataye huye list se wapas aa sakti hai.
async function cancelEntries(col, cancelled) {
  const done = readCancelDone(); let n = 0, linked = 0;
  for (const r of cancelled) {
    const id = 'pos-' + r.PurchaseID;
    if (done[id]) continue;
    const snap = await col.doc(id).get();
    if (!snap.exists) { done[id] = 1; continue; }
    const e = snap.data() || {};
    if (e.deleted === true) { done[id] = 1; continue; }
    const note = String(e.note || '').includes('⛔') ? String(e.note || '') : (String(e.note || '') + ' — ⛔ POS mein CANCEL').trim();
    await col.doc(id).set({ ...e, deleted: true, posStatus: 3, note, cancelledAt: now(), updatedBy: WRITER, updatedAt: now(), rev: (e.rev || 1) + 1 });
    done[id] = 1; n++;
    console.log('⛔ Cancel bill ' + r.PurchaseNo + ' -> khata entry hatai (' + (e.amount / 100).toLocaleString('en-PK') + ')');
    // is bill se judi cash payment (purchaseCash posBillIds) ho to sirf nishan — malik khud dekhe
    try {
      const q = await col.where('posBillIds', 'array-contains', id).get();
      for (const d of q.docs) { const c = d.data() || {}; if (c.deleted || c.posCancelWarn) continue; await d.ref.set({ ...c, posCancelWarn: 'Bill ' + r.PurchaseNo + ' POS mein CANCEL — payment check karein', updatedAt: now() }); linked++; }
    } catch (err) { console.log('  (judi payment check nahi hui: ' + err.message + ')'); }
  }
  saveCancelDone(done);
  if (n || linked) console.log('Cancel bills khate se hataye :', n, linked ? '(judi payment par nishan: ' + linked + ')' : '');
}

async function main() {
  const since = readLastSync();
  const firstRun = !fs.existsSync(STATE_FILE);
  console.log('Pichhla sync:', since.toISOString());

  initializeApp({ credential: cert(require('./firebase-key.json')) });
  const db = getFirestore();
  const col = db.collection('businesses').doc(BUSINESS_ID).collection('blueKhata');

  const pool = await sql.connect(SQL_CONFIG);

  const purchases = (await pool.request()
    .input('since', sql.DateTime, since)
    .input('startDate', sql.Date, new Date(START_DATE))
    .query(Q_PURCHASE)).recordset;

  console.log('SQL se aayi purchases:', purchases.length);

  // pehli dafa: sabqa baqaya bhi le aayein
  let openings = [];
  if (firstRun) {
    openings = (await pool.request()
      .input('startDate', sql.Date, new Date(START_DATE))
      .query(Q_OPENING)).recordset;
    console.log('Sabqa baqaya wale suppliers:', openings.length);
  }

  // v3: cancel bills (pichhle CANCEL_DAYS din)
  let cancelled = [];
  try { cancelled = (await pool.request().input('fromDate', sql.Date, new Date(Date.now() - CANCEL_DAYS * 864e5)).query(Q_CANCELLED)).recordset; }
  catch (e) { console.log('Cancel bills nahi parhe: ' + e.message); }

  await pool.close();

  const parties = new Map();
  for (const r of purchases) parties.set(r.PartyID, { name: r.PartyName, phone: r.Phone1 });
  for (const r of openings)  if (!parties.has(r.PartyID)) parties.set(r.PartyID, { name: r.PartyName, phone: r.Phone1 });

  let madeParty = 0, madeOpening = 0, wrote = 0, skipped = 0, untouched = 0;

  // ---- 1. party records (sirf ek dafa bantay hain) ----
  for (const [pid, info] of parties) {
    const id = 'pos-party-' + pid;
    const ref = col.doc(id);
    if ((await ref.get()).exists) continue;
    await ref.set({
      id, type: 'party',
      name: info.name || ('Supplier ' + pid),
      phone: info.phone || '',
      category: 'Supplier',
      opening: 0,
      by: WRITER, createdAt: now(), updatedBy: WRITER, updatedAt: now(), rev: 1
    });
    madeParty++;
  }

  // ---- 2. sabqa baqaya (ek entry, sirf pehli dafa) ----
  for (const r of openings) {
    const amt = paisa(r.Bal);
    if (amt <= 0) continue;                 // sirf jo hum ne dena hai
    const id = 'pos-opening-' + r.PartyID;
    const ref = col.doc(id);
    if ((await ref.get()).exists) continue;
    await ref.set({
      id, type: 'entry', kind: 'borrow',
      partyId: 'pos-party-' + r.PartyID,
      amount: amt,
      date: START_DATE,
      note: 'Sabqa baqaya (POS)',
      by: WRITER, createdAt: now(), updatedBy: WRITER, updatedAt: now(), rev: 1
    });
    madeOpening++;
  }

  // ---- 3. purchases ----
  let newest = since;
  for (const r of purchases) {
    const changed = new Date(r.ChangedOn);
    if (changed > newest) newest = changed;

    if (SKIP_STATUS.includes(r.DocStatusID)) { skipped++; continue; }

    const id = 'pos-' + r.PurchaseID;
    const ref = col.doc(id);
    const snap = await ref.get();

    // agar aap ne app mein khud edit kiya hai to usay chhera nahi jayega
    if (snap.exists && snap.data().updatedBy !== WRITER) { untouched++; continue; }

    const base = {
      id, type: 'entry', kind: 'borrow', purchase: true,
      partyId: 'pos-party-' + r.PartyID,
      amount: paisa(r.NetAmount),
      date: dateStr(r.PurchaseDate),
      note: 'POS Purchase ' + r.PurchaseNo,
      posStatus: Number(r.DocStatusID) || 1,   /* v-posting */
      updatedBy: WRITER, updatedAt: now()
    };

    if (snap.exists) {
      await ref.set({ ...base, by: snap.data().by || WRITER,
        createdAt: snap.data().createdAt || now(),
        rev: (snap.data().rev || 1) + 1 });
    } else {
      await ref.set({ ...base, by: WRITER, createdAt: now(), rev: 1 });
    }
    wrote++;
  }

  saveLastSync(newest);
  try { await cancelEntries(col, cancelled); } catch (e) { console.log('Cancel entries masla: ' + e.message); }

  console.log('Naye supplier accounts :', madeParty);
  console.log('Sabqa baqaya entries   :', madeOpening);
  console.log('Purchase entries likhi :', wrote);
  console.log('Chhori (cancelled)     :', skipped);
  console.log('Aap ki edit ki hui     :', untouched);
  console.log('Naya sync waqt         :', newest.toISOString());
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
