// =========================================================
//  purchase-post.js  v4  (2026-09-22) — Blue Khata app ki "🧾 POS Purchase" -> POS PURCHASE BILL
//  v4.1 (2026-09-23): BILLS_FLAG / pokeBills ko DIR aur log ke BAAD kiya — v4 chalte hi gir jati thi.
//  App Firestore "appPurchases" mein status "new" likhti hai:
//    { partyId, partyName, date, branch:1, godam, invoiceNo, note,
//      lines:[{ id, code, name, pack, godam, qty (PIECES), costP (khareed FI PIECE), wctn, wpcs, rctn, rpcs }], total }
//  Yeh script:
//   1) POS ke apne procedures (usp_Purchase_InsertUpdate / usp_PurchaseDetail_InsertUpdate) se bill banati hai —
//      baqi bills jaisa: CREDIT, DocStatusID 1 (open; post baad mein app ke "📌 post" se). Qty PIECES, Rate FI PIECE.
//      Procedures ke parameter POS se KHUD parhe jate hain (sys.parameters). Koi ANJAAN parameter ho to bill NAHI
//      banta — job "failed" + naam (andhe andaz se POS kharab nahi hota). Tasdeeq: node purchase-post.js --dekho
//   2) Bill commit hone ke baad naye rates (rate-lagao jaisa): Items + item ki SAB ItemBranchRate rows —
//      SaleRate = parchoon ctn/pack, SaleRate2 = parchoon piece, SaleRate3 + SaleRateSize = wholesale, PurchaseRate
//      = khareed. SIRF jo badla. SystemNotes mein Old/New line.
//   3) Supplier: posLinks "party:<appId>" -> posPartyId (khata-sync ka jor), ya app id "pos-party-<n>", warna POS
//      mein BILKUL isi naam ki EK party. Naam milta-julta ho to bhi khud nahi jorta (Saim wale alag suppliers!).
//   4) Ek bill do dafa na bane: transaction (posting) + Purchase.Description mein "BK-PUR <id>" nishan.
//  v4: bill banate / badalte hi C:\khata-sync\bills-now.flag likhta hai -> sync-bills v6 foran (5 sec mein) chalti hai,
//      taake app mein Edit ki tafseel 2 minute ki jagah ~15 second mein aa jaye.
//  v3: POS ke procedures ke ASAL khane (status-dekho.txt + --dekho se): header @Stock = bill ki kul qeemat (Qty x Rate),
//      @TotalDisc = 0; har line par @SaleRate/@SaleRate2/@SaleRate3/@SaleRateSize/@SaleRate2Size = item ke rates (naye agar
//      app ne diye, warna POS ke MAUJOODA — kabhi 0 nahi). 'ANJAAN parameter' wali failed jobs (POS ko chhua hi nahi) khud dobara.
//  v2: EDIT — job mein editOf {purchaseId, billNo, stamp, partyId, posPartyId} ho to NAYA bill nahi: POS ka wohi KHULA
//      bill (DocStatusID 1) usi number par update (header InsertUpdate PurchaseID ke saath, CancelAndNew 0; purani lines
//      usp_PurchaseDetail_DeleteByPurchaseID; nayi lines). Pehle tasdeeq: bill khula ho, mulazim ke liye AAJ ka ho, aur
//      stamp (sync-bills v5 wala nishan) abhi bhi wohi ho — warna "bill badal chuka" (kuch nahi likhta). Sab ek transaction.
//  Chalana: node purchase-post.js   (purchase-auto.bat loop).  Log: purchase-log.txt.  Lock port 47821.
// =========================================================
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const BUSINESS_ID = 'noor-traders';
const CREATED_BY = 1;          // POS user: Administrator (sale-post jaisa)
const MARK = 'BK-PUR ';        // Purchase.Description mein nishan
const MAX_JOB_DIN = 7;
const LOCK_PORT = 47821;
const SCRIPT_VER = 3;

const DIR = __dirname;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const BILLS_FLAG = path.join(DIR, 'bills-now.flag');   // v4: sync-bills ko 'abhi chalo'
const pokeBills = () => { try { fs.writeFileSync(BILLS_FLAG, String(Date.now())); } catch (e) { log('bills-now.flag nahi likha: ' + e.message); } };          // failed job par likha jata hai — 'ANJAAN' wali job sirf NAYI version par ek dafa dobara
const clip = (s, n) => String(s ?? '').slice(0, n);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const biz = db.collection('businesses').doc(BUSINESS_ID);
const col = biz.collection('appPurchases');
const linksCol = biz.collection('posLinks');

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
  pool.on('error', e => { log('SQL masla: ' + e.message); pool = null; });
  return pool;
}

// ---------- POS procedure ke parameter khud parhna ----------
const procCache = new Map();
async function procParams(p, name) {
  if (procCache.has(name)) return procCache.get(name);
  const rows = (await p.request().input('n', sql.NVarChar(300), 'dbo.' + name).query(`
    SELECT REPLACE(name,'@','') AS n, TYPE_NAME(user_type_id) AS t, max_length AS len, precision AS pr, scale AS sc, is_output AS o
    FROM sys.parameters WHERE object_id = OBJECT_ID(@n) ORDER BY parameter_id`)).recordset;
  if (!rows.length) throw new Error(`POS mein procedure ${name} nahi mila`);
  procCache.set(name, rows); return rows;
}
function sqlType(r) {
  const t = String(r.t).toLowerCase(), len = Number(r.len);
  if (t === 'int') return sql.Int; if (t === 'bigint') return sql.BigInt; if (t === 'smallint') return sql.SmallInt; if (t === 'tinyint') return sql.TinyInt;
  if (t === 'bit') return sql.Bit; if (t === 'float') return sql.Float; if (t === 'real') return sql.Real;
  if (t === 'money') return sql.Money; if (t === 'smallmoney') return sql.SmallMoney;
  if (t === 'decimal' || t === 'numeric') return sql.Decimal(r.pr || 18, r.sc || 4);
  if (t === 'datetime') return sql.DateTime; if (t === 'smalldatetime') return sql.SmallDateTime; if (t === 'date') return sql.Date; if (t === 'datetime2') return sql.DateTime2;
  if (t === 'varchar') return sql.VarChar(len < 0 ? sql.MAX : len); if (t === 'char') return sql.Char(len);
  if (t === 'nvarchar') return sql.NVarChar(len < 0 ? sql.MAX : len / 2); if (t === 'nchar') return sql.NChar(len / 2);
  if (t === 'text') return sql.Text; if (t === 'ntext') return sql.NText;
  return null;
}
const isStr = r => /char|text/i.test(String(r.t));
const isDate = r => /date/i.test(String(r.t));
// values: jo hum jaante hain. soft: jo POS ki sale detail mein bhi 0 jate hain (andaz nahi, POS ki aam default)
function buildRequest(tx, params, values, soft, label) {
  const req = new sql.Request(tx), unknown = [], used = [];
  const V = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  const S = new Map(Object.entries(soft).map(([k, v]) => [k.toLowerCase(), v]));
  for (const r of params) {
    const type = sqlType(r);
    if (!type) { unknown.push(`${r.n} (${r.t})`); continue; }
    const k = r.n.toLowerCase();
    let v;
    if (V.has(k)) v = V.get(k);
    else if (S.has(k)) v = S.get(k);
    else { unknown.push(`${r.n} (${r.t})`); continue; }
    if (v === undefined) v = isStr(r) ? '' : isDate(r) ? null : 0;
    if (isStr(r) && v != null) v = clip(String(v), Number(r.len) > 0 ? (/^n/i.test(r.t) ? r.len / 2 : r.len) : 100000);
    if (r.o) req.output(r.n, type, v); else req.input(r.n, type, v);
    used.push(r.n);
  }
  if (unknown.length) throw new Error(`${label}: POS ke ANJAAN parameter (bill nahi banaya): ${unknown.join(', ')} — "node purchase-post.js --dekho" chala kar purchase-dekho.txt AI ko bhejein`);
  return req;
}

// v2: bill ki haalat ka nishan — sync-bills.js v5 mein BILKUL yahi function hai (dono ek jaise rehne chahiyein)
function billStamp(partyId, rows) {
  const s = rows.map(r => [Number(r.ItemID), Number(r.Qty), Number(r.Rate), Number(r.GBranchID) || 0].join('|')).sort().join(';');
  return crypto.createHash('sha1').update(String(partyId) + '#' + s).digest('hex').slice(0, 16);
}

// ---------- supplier ----------
async function posPartyOf(p, j) {
  const id = String(j.partyId || '');
  const mm = id.match(/^pos-party-(\d+)$/);
  let pid = mm ? Number(mm[1]) : 0;
  if (!pid) { const l = await linksCol.doc(('party:' + id).replace(/\//g, '_')).get().catch(() => null); if (l && l.exists) pid = Number(l.data().posPartyId) || 0; }
  if (pid) {
    const r = (await p.request().input('i', sql.Int, pid).query('SELECT PartyID, PartyName FROM dbo.Party WHERE PartyID = @i')).recordset[0];
    if (r) return r;
  }
  const name = String(j.partyName || '').trim();
  const same = (await p.request().input('n', sql.VarChar(150), name).query('SELECT PartyID, PartyName FROM dbo.Party WHERE LTRIM(RTRIM(PartyName)) = @n')).recordset;
  if (same.length === 1) return same[0];
  throw new Error(same.length ? `POS mein "${name}" naam ki ${same.length} parties hain — kaunsi? (app mein supplier ka POS jor theek karein)` : `Supplier "${name}" POS mein nahi mila (pehle POS / khata-sync mein supplier banayein)`);
}

// ---------- ek purchase POS mein ----------
async function postPurchase(j, jobId) {
  const p = await getPool();
  const marker = MARK + jobId;
  const had = (await p.request().input('m', sql.VarChar(150), marker)
    .query('SELECT TOP 1 PurchaseID, PurchaseNo FROM dbo.Purchase WHERE Description = @m AND ISNULL(DocStatusID,0) <> 3')).recordset[0];
  if (had) return { purchaseId: had.PurchaseID, purchaseNo: String(had.PurchaseNo || '').trim(), again: true };

  const party = await posPartyOf(p, j);
  const branch = Number(j.branch) || 1;
  const { lines, total } = await checkLines(p, j, branch);
  return insertNew(p, j, jobId, marker, party, branch, lines, total);
}
async function checkLines(p, j, branch) {
  // lines: POS se item ki tasdeeq
  const want = (j.lines || []).filter(l => Number(l.qty) > 0 && Number(l.id) > 0);
  if (!want.length) throw new Error('Bill mein koi item nahi');
  const ids = [...new Set(want.map(l => Number(l.id)))];
  const items = new Map((await p.request().query(`SELECT ItemID, ItemName, PackQty FROM dbo.Items WHERE ItemID IN (${ids.join(',')})`)).recordset.map(r => [r.ItemID, r]));
  const lines = want.map(l => {
    const it = items.get(Number(l.id));
    if (!it) throw new Error(`Item POS mein nahi mila: ${l.name} (${l.id})`);
    const qty = Math.round(Number(l.qty) * 1000) / 1000, rate = r4(l.costP);
    if (!(rate > 0)) throw new Error(`Khareed rate khali: ${l.name}`);
    return { ...l, ItemID: it.ItemID, name: String(it.ItemName || '').trim(), qty, rate, godam: Number(l.godam) || branch };
  });
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  return { lines, total };
}
async function insertNew(p, j, jobId, marker, party, branch, lines, total) {
  const now = new Date();
  const when = /^\d{4}-\d{2}-\d{2}$/.test(String(j.date || '')) && j.date !== ymd(now)
    ? new Date(`${j.date}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`) : now;
  const who = j.role === 'owner' ? 'Malik' : 'Mulazim';
  const notes = `Created By:Blue Khata app (${who}) On:${now.toLocaleString('en-US')} at PC:${os.hostname()}\r\n`;

  const HP = await procParams(p, 'usp_Purchase_InsertUpdate');
  const DP = await procParams(p, 'usp_PurchaseDetail_InsertUpdate');
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const hv = {
      PurchaseID: 0, PartyID: party.PartyID, BranchID: branch, PurchaseNo: '', PurchaseDate: when, Description: marker,
      CreatedBy: CREATED_BY, CreatedOn: now, UpdatedBy: 0, UpdatedOn: null,
      Remarks: clip(j.note ? `${String(party.PartyName).trim()} - ${j.note}` : String(party.PartyName).trim(), 150),
      SystemNotes: notes, IsTaxPerc: 0, TaxAmount: 0, IsCreditPurchase: 1, DocStatusID: 1, IsDiscPerc: 1, DiscountAmt: 0,
      PartyInvoiceNo: clip(j.invoiceNo || '', 50), SPID: 0, SupplyManID: null, CancelAndNew: 1,
      Stock: total, TotalDisc: 0
    };
    // raqam wale parameter (agar proc maange): kul bill
    for (const r of HP) { const k = r.n; if (!(k in hv) && /total|net|vnet|amount/i.test(k) && !/tax|disc|forward/i.test(k)) { hv[k] = total; log(`  (parameter ${k} = bill total ${total})`); } }
    const head = await buildRequest(tx, HP, hv, {}, 'Purchase').execute('dbo.usp_Purchase_InsertUpdate');
    let purchaseId = Number(head.output?.PurchaseID) || 0;
    const row = head.recordset?.[0];
    if (!purchaseId && row) purchaseId = Number(row.PurchaseID ?? Object.values(row)[0]) || 0;
    if (!purchaseId) {
      const f = (await new sql.Request(tx).input('m', sql.VarChar(150), marker)
        .query('SELECT TOP 1 PurchaseID FROM dbo.Purchase WHERE Description = @m ORDER BY PurchaseID DESC')).recordset[0];
      purchaseId = Number(f?.PurchaseID) || 0;
    }
    if (!purchaseId) throw new Error('POS ne PurchaseID nahi diya');
    await insertLines(tx, DP, purchaseId, lines, total);
    let no = String((await new sql.Request(tx).input('i', sql.Int, purchaseId).query('SELECT PurchaseNo FROM dbo.Purchase WHERE PurchaseID = @i')).recordset[0]?.PurchaseNo || '').trim();
    if (!no) {   // POS ne number na diya ho to agla number (00000680 jaisa)
      const mx = (await new sql.Request(tx).query("SELECT MAX(CASE WHEN ISNUMERIC(PurchaseNo) = 1 THEN CAST(PurchaseNo AS BIGINT) ELSE 0 END) AS m FROM dbo.Purchase")).recordset[0];
      no = String((Number(mx?.m) || 0) + 1).padStart(8, '0');
      await new sql.Request(tx).input('i', sql.Int, purchaseId).input('no', sql.VarChar(50), no).query('UPDATE dbo.Purchase SET PurchaseNo = @no WHERE PurchaseID = @i');
    }
    await tx.commit();
    return { purchaseId, purchaseNo: no, total, lines };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}
const SOFT_DETAIL = { Discount: '0', Tax: '0', Cost: 0, ItemIncentive: 0, TradeOffer: 0, Cotton: 0, Bardana: 0, GQgy: 0, IsGetStore: 0 };
// v3: line ke sale rates — app ke naye (agar diye) warna POS ke maujooda (branch 1, phir Items). Sab FI PIECE (POS jaisa).
async function lineRates(tx, l) {
  const cur = (await new sql.Request(tx).input('i', sql.Int, l.ItemID).query(`
    SELECT TOP 1 ISNULL(r.SaleRate, i.SaleRate) AS SaleRate, ISNULL(r.SaleRate2, i.SaleRate2) AS SaleRate2,
      ISNULL(r.SaleRate3, i.SaleRate3) AS SaleRate3, ISNULL(r.SaleRateSize, i.SaleRateSize) AS SaleRateSize,
      ISNULL(r.SaleRate2Size, i.SaleRate2Size) AS SaleRate2Size, i.PackQty
    FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID
    WHERE i.ItemID = @i ORDER BY CASE WHEN r.BranchID = 1 THEN 0 ELSE 1 END`)).recordset[0] || {};
  const pack = Number(cur.PackQty) > 0 ? Number(cur.PackQty) : (Number(l.pack) || 1);
  const rctn = num(l.rctn), rpcs = num(l.rpcs), wctn = num(l.wctn), wpcs = num(l.wpcs);
  const out = { SaleRate: Number(cur.SaleRate) || 0, SaleRate2: Number(cur.SaleRate2) || 0, SaleRate3: Number(cur.SaleRate3) || 0,
    SaleRateSize: Number(cur.SaleRateSize) || 0, SaleRate2Size: Number(cur.SaleRate2Size) || 0 };
  if (rctn > 0 || rpcs > 0) { out.SaleRate = r2(rctn > 0 && pack > 1 ? rctn / pack : (rpcs || rctn)); out.SaleRate2 = r2(rpcs || out.SaleRate); }
  if (wctn > 0 || wpcs > 0) { out.SaleRate3 = r2(wctn > 0 && pack > 1 ? wctn / pack : (wpcs || wctn)); out.SaleRateSize = r2(wpcs || out.SaleRate3); }
  return out;
}
async function insertLines(tx, DP, purchaseId, lines, total) {
  for (const l of lines) {
    await buildRequest(tx, DP, {
      PurchaseDetailID: 0, PurchaseID: purchaseId, ItemID: l.ItemID,
      Forwarder1ID: null, Forwarder1Rate: 0, Forwarder2ID: null, Forwarder2Rate: 0, Forwarder3ID: null, Forwarder3Rate: 0,
      Qty: l.qty, Rate: l.rate, IsApplyDisc: 1, PreRate: l.rate, Bonus: 0, GBranchID: l.godam,
      ...(await lineRates(tx, l))
    }, SOFT_DETAIL, 'PurchaseDetail').execute('dbo.usp_PurchaseDetail_InsertUpdate');
  }
  // tasdeeq: POS mein jo gaya woh app wala hi hai
  const chk = (await new sql.Request(tx).input('i', sql.Int, purchaseId)
    .query('SELECT COUNT(*) AS n, SUM(Qty * Rate) AS s FROM dbo.PurchaseDetail WHERE PurchaseID = @i')).recordset[0];
  if (Number(chk.n) !== lines.length || Math.abs((Number(chk.s) || 0) - total) > 1)
    throw new Error(`POS mein lines/total nahi mile (POS ${chk.n} lines Rs ${r2(chk.s)} / app ${lines.length} lines Rs ${total}) — kuch save nahi hua`);
}

// ---------- v2: POS ka KHULA bill usi number par EDIT ----------
async function editPurchase(j, jobId) {
  const p = await getPool();
  const e = j.editOf || {}, pid = Number(e.purchaseId) || 0, tag = 'BK-EDIT ' + jobId;
  if (!pid) throw new Error('Edit: bill ka PurchaseID nahi');
  const cur = (await p.request().input('i', sql.Int, pid).query('SELECT * FROM dbo.Purchase WHERE PurchaseID = @i')).recordset[0];
  if (!cur) throw new Error(`Bill ${e.billNo || pid} POS mein nahi mila`);
  if (String(cur.SystemNotes || '').includes(tag)) return { purchaseId: pid, purchaseNo: String(cur.PurchaseNo || '').trim(), again: true };
  const st = Number(cur.DocStatusID) || 0;
  if (st === 3) throw new Error('Yeh bill POS mein CANCEL hai — edit nahi hota');
  if (st !== 1) throw new Error('Bill khula nahi (POSTED hai) — pehle malik Unpost kare, phir dobara edit');
  const now = new Date();
  if (j.role !== 'owner' && ymd(new Date(cur.PurchaseDate)) !== ymd(now)) throw new Error('Mulazim sirf AAJ ka bill edit kar sakta hai');
  const oldRows = (await p.request().input('i', sql.Int, pid).query('SELECT ItemID, Qty, Rate, GBranchID FROM dbo.PurchaseDetail WHERE PurchaseID = @i')).recordset;
  if (billStamp(cur.PartyID, oldRows) !== String(e.stamp || '')) throw new Error('Bill POS mein is dauran BADAL chuka hai — app mein "Bill dekhein" se dobara khol kar edit karein (kuch nahi badla)');
  const branch = Number(cur.BranchID) || Number(j.branch) || 1;
  const party = String(j.partyId || '') === String(e.partyId || '') ? { PartyID: cur.PartyID, PartyName: null } : await posPartyOf(p, j);
  const { lines, total } = await checkLines(p, j, branch);
  let when = cur.PurchaseDate;
  if (j.role === 'owner' && /^\d{4}-\d{2}-\d{2}$/.test(String(j.date || '')) && j.date !== ymd(new Date(cur.PurchaseDate))) {
    const t = new Date(cur.PurchaseDate); when = new Date(`${j.date}T${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:00`);
  }
  const who = j.role === 'owner' ? 'Malik' : 'Mulazim';
  const HP = await procParams(p, 'usp_Purchase_InsertUpdate');
  const DP = await procParams(p, 'usp_PurchaseDetail_InsertUpdate');
  const DEL = await procParams(p, 'usp_PurchaseDetail_DeleteByPurchaseID');
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    // header: POS ka maujooda bill hi buniyad; sirf jo app ne badla
    const hv = { ...cur, PurchaseID: pid, PartyID: party.PartyID, PurchaseDate: when, BranchID: branch,
      UpdatedBy: CREATED_BY, UpdatedOn: now, DocStatusID: 1, CancelAndNew: 0, Stock: total, TotalDisc: 0,
      PartyInvoiceNo: clip(j.invoiceNo || cur.PartyInvoiceNo || '', 50),
      SystemNotes: (String(cur.SystemNotes || '') + `\r\nModified By:Blue Khata app (${who}) On:${now.toLocaleString('en-US')} at PC:${os.hostname()} (${tag})\r\n`).slice(-1000) };   // 1000 ki had: aakhri hissa (BK-EDIT nishan) rahe
    if (party.PartyName) hv.Remarks = clip(String(party.PartyName).trim(), 150);
    for (const r of HP) { const k = r.n; if (!Object.keys(hv).some(x => x.toLowerCase() === k.toLowerCase()) && /total|net|vnet|amount/i.test(k) && !/tax|disc|forward/i.test(k)) { hv[k] = total; log(`  (parameter ${k} = bill total ${total})`); } }
    const head = await buildRequest(tx, HP, hv, {}, 'Purchase').execute('dbo.usp_Purchase_InsertUpdate');
    const back = Number(head.output?.PurchaseID) || Number(head.recordset?.[0]?.PurchaseID ?? (head.recordset?.[0] ? Object.values(head.recordset[0])[0] : 0)) || pid;
    const after = (await new sql.Request(tx).input('i', sql.Int, pid).query('SELECT PurchaseNo, DocStatusID FROM dbo.Purchase WHERE PurchaseID = @i')).recordset[0];
    if (back !== pid || !after || Number(after.DocStatusID) !== 1 || String(after.PurchaseNo || '').trim() !== String(cur.PurchaseNo || '').trim())
      throw new Error(`POS ne bill update ki jagah kuch aur kiya (ID ${back}/${pid}) — kuch save nahi hua`);
    await buildRequest(tx, DEL, { PurchaseID: pid }, {}, 'PurchaseDetail_Delete').execute('dbo.usp_PurchaseDetail_DeleteByPurchaseID');
    await insertLines(tx, DP, pid, lines, total);
    await tx.commit();
    return { purchaseId: pid, purchaseNo: String(cur.PurchaseNo || '').trim(), total, lines, edited: true };
  } catch (err) { try { await tx.rollback(); } catch {} throw err; }
}
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- naye rates (sirf jo badla) ----------
function costIsCarton(cur, pack, sale) {
  cur = Number(cur) || 0; pack = Number(pack) || 0; sale = Number(sale) || 0;
  if (!(cur > 0) || pack <= 1 || !(sale > 0)) return false;
  return Math.abs(Math.log(cur / pack / sale)) < Math.abs(Math.log(cur / sale));
}
const diff = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) > 0.004;
async function applyRates(lines, jobId) {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  let applied = 0;
  try {
    for (const l of lines) {
      const cur = (await new sql.Request(tx).input('i', sql.Int, l.ItemID)
        .query('SELECT ItemID, ItemName, PackQty, SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate FROM dbo.Items WHERE ItemID = @i')).recordset[0];
      if (!cur) continue;
      const br = (await new sql.Request(tx).input('i', sql.Int, l.ItemID)
        .query('SELECT TOP 1 SaleRate, SaleRate2, SaleRate3, SaleRateSize, PurchaseRate FROM dbo.ItemBranchRate WHERE ItemID = @i ORDER BY CASE WHEN BranchID = 1 THEN 0 ELSE 1 END')).recordset[0] || cur;
      const pack = Number(cur.PackQty) > 0 ? Number(cur.PackQty) : (Number(l.pack) || 1);
      const rctn = num(l.rctn), rpcs = num(l.rpcs), wctn = num(l.wctn), wpcs = num(l.wpcs), costP = num(l.rate);
      const newR = r2(rctn > 0 && pack > 1 ? rctn / pack : (rpcs || rctn)), newR2 = r2(rpcs || newR);
      const newW = r2(wctn > 0 && pack > 1 ? wctn / pack : (wpcs || wctn)), newWS = r2(wpcs || newW);
      const doR = (rctn > 0 || rpcs > 0) && (diff(br.SaleRate, newR) || diff(br.SaleRate2, newR2));
      const doW = (wctn > 0 || wpcs > 0) && (diff(br.SaleRate3, newW) || diff(br.SaleRateSize, newWS));
      const doC = costP > 0 && diff(br.PurchaseRate, costP);
      if (!doR && !doW && !doC) continue;
      const itemCost = r2(doC ? (costIsCarton(cur.PurchaseRate, pack, Number(cur.SaleRate) || newR) ? costP * pack : costP) : 0);
      let note = `\r\n>>Modified via Blue Khata POS Purchase On:${new Date().toLocaleString()} (job ${jobId})`;
      if (doR) note += `\r\nOld Sale Rate: ${r2(cur.SaleRate)}\r\nNew Sale Rate: ${newR}`;
      if (doW) note += `\r\nOld W Rate: ${r2(cur.SaleRate3)}\r\nNew W Rate: ${newW}`;
      if (doC) note += `\r\nOld Purchase Rate: ${r2(cur.PurchaseRate)}\r\nNew Purchase Rate: ${itemCost}`;
      note += '\r\n';
      const sets = [], bsets = [];
      if (doR) { sets.push('SaleRate = @r', 'SaleRate2 = @r2'); bsets.push('SaleRate = @r', 'SaleRate2 = @r2'); }
      if (doW) { sets.push('SaleRate3 = @w', 'SaleRateSize = @ws'); bsets.push('SaleRate3 = @w', 'SaleRateSize = @ws'); }
      if (doC) { sets.push('PurchaseRate = @ic'); bsets.push('PurchaseRate = @pc'); }
      const q = () => new sql.Request(tx).input('i', sql.Int, l.ItemID).input('r', sql.Float, newR).input('r2', sql.Float, newR2)
        .input('w', sql.Float, newW).input('ws', sql.Float, newWS).input('ic', sql.Float, itemCost).input('pc', sql.Float, r4(costP));
      await q().input('nt', sql.NVarChar(sql.MAX), note).query(`UPDATE dbo.Items SET ${sets.join(', ')}, SystemNotes = ISNULL(SystemNotes,'') + @nt WHERE ItemID = @i`);
      await q().query(`UPDATE dbo.ItemBranchRate SET ${bsets.join(', ')} WHERE ItemID = @i`);
      applied++;
      log(`  rate: ${String(cur.ItemName || '').trim()} ` + (doC ? `cost ${r4(costP)}/pc ` : '') + (doW ? `W ${newW} ` : '') + (doR ? `R ${newR} (peice ${newR2})` : ''));
    }
    await tx.commit();
    return applied;
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}

// ---------- Firestore ----------
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => log('Masla: ' + e.message)); };
async function handle(doc) {
  const id = doc.id;
  if (busy.has(id)) return; busy.add(id);
  try {
    const ref = col.doc(id);
    const j = await db.runTransaction(async t => {
      const cur = (await t.get(ref)).data();
      const retry = cur && cur.status === 'failed' && /ANJAAN parameter/.test(String(cur.error || '')) && (Number(cur.failVer) || 0) < SCRIPT_VER;
      if (!cur || (!['new', 'posting'].includes(cur.status) && !retry)) return null;
      t.update(ref, { status: 'posting', postingAt: Date.now(), pc: os.hostname() });
      return cur;
    });
    if (!j) return;
    try {
      if (Date.now() - Number(j.createdAt || 0) > MAX_JOB_DIN * 86400000) throw new Error(`Bill ${MAX_JOB_DIN} din se purana tha — dobara bhejein`);
      const r = j.editOf ? await editPurchase(j, id) : await postPurchase(j, id);
      let rates = 0, rateError = '';
      if (!r.again) { try { rates = await applyRates(r.lines, id); } catch (e) { rateError = clip(e.message, 200); log('  Rates NAHI lage: ' + e.message); } }
      await ref.update({ status: 'done', purchaseNo: r.purchaseNo, purchaseId: r.purchaseId, ...(r.total != null ? { posTotal: r.total } : {}),
        rates, ...(rateError ? { rateError } : {}), doneAt: Date.now(), error: FieldValue.delete() });
      pokeBills();
      log(`${r.again ? 'Pehle se ho chuka tha' : r.edited ? 'PURCHASE BILL UPDATE HO GAYA' : 'PURCHASE BILL BAN GAYA'}: ${r.purchaseNo} · ${j.partyName} · Rs ${r.total ?? ''}${rates ? ' · ' + rates + ' items ke rate' : ''}`);
    } catch (e) {
      log(`Purchase NAHI bana (${id}): ${e.message}`);
      await ref.update({ status: 'failed', error: clip(e.message, 300), failVer: SCRIPT_VER, doneAt: Date.now() }).catch(() => {});
    }
  } finally { busy.delete(id); }
}

// ---------- --dekho: sirf parhna (kuch nahi likhta) ----------
async function dekho() {
  const p = await getPool(), out = [];
  for (const n of ['usp_Purchase_InsertUpdate', 'usp_PurchaseDetail_InsertUpdate', 'usp_PurchaseDetail_DeleteByPurchaseID']) {
    const ps = await procParams(p, n);
    out.push(`== ${n} (${ps.length} parameter)`);
    for (const r of ps) out.push(`  ${r.n}  ${r.t}${r.len > 0 ? '(' + r.len + ')' : ''}${r.o ? '  OUTPUT' : ''}${sqlType(r) ? '' : '  <-- type anjaan'}`);
  }
  const known = new Set('PurchaseID PartyID BranchID PurchaseNo PurchaseDate Description CreatedBy CreatedOn UpdatedBy UpdatedOn Remarks SystemNotes IsTaxPerc TaxAmount IsCreditPurchase DocStatusID IsDiscPerc DiscountAmt PartyInvoiceNo SPID SupplyManID CancelAndNew PurchaseDetailID ItemID Forwarder1ID Forwarder1Rate Forwarder2ID Forwarder2Rate Forwarder3ID Forwarder3Rate Qty Rate IsApplyDisc PreRate Bonus GBranchID Discount Tax Cost ItemIncentive TradeOffer Cotton Bardana GQgy IsGetStore Stock TotalDisc SaleRate SaleRate2 SaleRate3 SaleRateSize SaleRate2Size'.toLowerCase().split(' '));
  const anj = [];
  for (const n of ['usp_Purchase_InsertUpdate', 'usp_PurchaseDetail_InsertUpdate', 'usp_PurchaseDetail_DeleteByPurchaseID'])
    for (const r of await procParams(p, n)) if (!known.has(r.n.toLowerCase()) && !(n.includes('Purchase_') && /total|net|vnet|amount/i.test(r.n) && !/tax|disc|forward/i.test(r.n))) anj.push(n + ': ' + r.n);
  out.push('', anj.length ? 'ANJAAN parameter (in ke hote bill NAHI banega — yeh file AI ko bhejein): ' + anj.join(', ') : 'SAB PARAMETER PEHCHANE GAYE ✓ — script bill bana sakti hai');
  const last = (await p.request().query('SELECT TOP 2 * FROM dbo.Purchase WHERE ISNULL(DocStatusID,0) <> 3 ORDER BY PurchaseID DESC')).recordset;
  for (const h of last) {
    out.push('', '== POS purchase ' + h.PurchaseNo + ' ' + JSON.stringify(h));
    const d = (await p.request().input('i', sql.Int, h.PurchaseID).query('SELECT TOP 5 d.*, i.ItemName, i.PackQty FROM dbo.PurchaseDetail d JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.PurchaseID = @i')).recordset;
    d.forEach(x => out.push('   ' + JSON.stringify(x)));
  }
  const txt = out.join('\r\n');
  fs.writeFileSync(path.join(DIR, 'purchase-dekho.txt'), txt);
  console.log(txt);
  console.log('\n(purchase-dekho.txt ban gayi — kuch save nahi hua)');
}

if (process.argv.includes('--dekho')) {
  dekho().then(() => process.exit(0)).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
} else {
  const lock = net.createServer().listen(LOCK_PORT, '127.0.0.1');
  lock.on('error', () => { console.log('purchase-post pehle se chal raha hai — yeh copy band.'); process.exit(3); });
  lock.on('listening', async () => {
    try { await getPool(); log('SQL se jur gaya'); } catch (e) { log('SQL masla: ' + e.message); process.exit(1); }
    log('purchase-post chal raha hai — app ke "🧾 POS Purchase" bills ka intezar…');
    col.where('status', 'in', ['new', 'posting', 'failed']).onSnapshot(
      s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handle(c.doc)); }); },
      e => { log('Firestore masla: ' + e.message); process.exit(1); });
  });
}
