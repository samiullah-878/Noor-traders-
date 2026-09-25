// =========================================================
//  transfer-sync.js  v3  (2026-09-20: + POS POSTING — postJobs, usp_Voucher_Post, status app mein) — Blue Khata app se POS STOCK TRANSFER NOTE (STN) + PURCHASE BILL PRINT
//  1) transferJobs: app (Stock -> ⇄ Transfer) ka hukum -> POS ke apne procedures usp_StockTransfer_InsertUpdate +
//     usp_StockTransferDetail_InsertUpdate (bilkul POS ki Transfer screen jaisa: STN no, dono godam ka stock, ledger, voucher).
//     op 'delete' -> usp_StockTransfer_Delete. Note thermal printer (TM-T88IV) par bhi chhapta hai.
//  2) printJobs (kind 'purchase'): POS purchase bill (posBills) ya larke ki cash purchase ki rasid TM-T88IV par.
//  Chalana:  node transfer-sync.js   (transfer-auto.bat loop mein)
// =========================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ---------------- SETTINGS ----------------
const BUSINESS_ID = 'noor-traders';
const CREATED_BY = 1;                // POS user: Administrator
const PRINTER_NAME = 'TM-T88IV';     // thermal rasid printer (sale-post wala)
const PRINT_WIDTH = 42;
const AUTO_PRINT = true;             // transfer note banate hi print
const SHOP_NAME = 'NOOR TRADERS', SHOP_PHONE = '03450412515';
const LOCK_PORT = 47818;
// ------------------------------------------

const DIR = __dirname;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const biz = db.collection('businesses').doc(BUSINESS_ID);
const trCol = biz.collection('transferJobs'), prCol = biz.collection('printJobs'), poCol = biz.collection('postJobs');
const khataCol = biz.collection('blueKhata'), linksCol = biz.collection('posLinks'), billsCol = biz.collection('posBills');

let pool = null;
async function getPool() { if (pool && pool.connected) return pool; pool = await new sql.ConnectionPool(SQL_CONFIG).connect(); return pool; }
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const n = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });
const clip = (s, k) => String(s ?? '').slice(0, k);

// ---------- STOCK TRANSFER ----------
async function branchNames(p) {
  const r = await p.request().query('SELECT BranchID, BranchName FROM dbo.Branch');
  const map = {}; r.recordset.forEach(x => { map[x.BranchID] = String(x.BranchName || '').trim(); }); return map;
}
async function createTransfer(j) {
  const p = await getPool();
  const from = Number(j.from), to = Number(j.to);
  if (!from || !to || from === to) throw new Error('Godam sahi chunein (se / ko alag hon)');
  const names = await branchNames(p);
  if (!names[from] || !names[to]) throw new Error('Godam POS mein nahi mila');
  const lines = Array.isArray(j.lines) ? j.lines : [];
  if (!lines.length) throw new Error('Koi item nahi');
  const rows = [];
  for (const l of lines) {
    const itemId = Number(l.itemId), qty = r3(l.qty);
    l._ui = { ctn: Number(l.ctn) || 0, pcs: Number(l.pcs) || 0, pack: Number(l.pack) || 0, cName: l.cName, uName: l.uName };
    if (!itemId || !(qty > 0)) throw new Error('Item / tadad ghalat');
    const r = (await p.request().input('i', sql.Int, itemId).input('b', sql.Int, from).query(
      `SELECT i.ItemName, ISNULL(r.CurrStock,0) AS Stock, ISNULL(NULLIF(r.PurchaseRate,0), i.PurchaseRate) AS PRate, ISNULL(NULLIF(r.SaleRate,0), i.SaleRate) AS SRate,
              (SELECT COUNT(*) FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = ${to}) AS HasTo
       FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = @b WHERE i.ItemID = @i`)).recordset[0];
    if (!r) throw new Error('Item POS mein nahi mila (ID ' + itemId + ')');
    const name = String(r.ItemName).trim();
    // POS ka qanoon: GODAM (branch 1 ke ilawa) mein stock kam ho to nahi
    if (from !== 1 && Number(r.Stock) < qty - 0.0005) throw new Error(`${name}: ${names[from]} mein stock ${n(r.Stock)}, chahiye ${n(qty)}`);
    if (!Number(r.HasTo)) {
      // "ko" godam mein item ka record na ho to POS ki tarah bana do (stock 0) — warna procedure ka Update kuch nahi badalta
      await p.request().input('i', sql.Int, itemId).input('t', sql.Int, to).input('f', sql.Int, from).query(
        `INSERT INTO dbo.ItemBranchRate (BranchID, ItemID, SaleRate, SaleRate2, SaleRate3, SaleRateSize, CurrStock, PurchaseRate, PackQty, SaleRate2Size)
         SELECT @t, i.ItemID, ISNULL(r.SaleRate, i.SaleRate), ISNULL(r.SaleRate2, i.SaleRate2), ISNULL(r.SaleRate3, i.SaleRate3), ISNULL(r.SaleRateSize, i.SaleRateSize), 0,
                ISNULL(r.PurchaseRate, i.PurchaseRate), ISNULL(r.PackQty, i.PackQty), ISNULL(r.SaleRate2Size, i.SaleRate2Size)
         FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = @f WHERE i.ItemID = @i`);
    }
    rows.push({ itemId, name, qty, prate: r2(r.PRate), srate: r2(r.SRate), ...l._ui });
  }
  const cogs = r2(rows.reduce((s, x) => s + x.qty * x.prate, 0));
  const mark = 'BK-APP ' + j.id;
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const now = new Date();
    await new sql.Request(tx)
      .input('TransferID', sql.Int, 0).input('FromBranchID', sql.Int, from).input('ToBranchID', sql.Int, to)
      .input('TransferNo', sql.VarChar(50), '').input('TransferDate', sql.DateTime, now)
      .input('Description', sql.VarChar(150), clip(j.note || 'Transfer (app)', 150))
      .input('CreatedBy', sql.Int, CREATED_BY).input('CreatedOn', sql.DateTime, now)
      .input('UpdatedBy', sql.Int, 0).input('UpdatedOn', sql.DateTime, now)
      .input('Remarks', sql.VarChar(150), clip(j.byName ? 'App: ' + j.byName : 'App', 150))
      .input('SystemNotes', sql.VarChar(1000), `Created By: Blue Khata app On: ${now.toLocaleString('en-PK')} [${mark}]`)
      .input('COGS', sql.Float, cogs).input('DocumentNo', sql.Int, 0).input('DocumentType', sql.VarChar(5), '')
      .execute('dbo.usp_StockTransfer_InsertUpdate');
    const h = (await new sql.Request(tx).input('m', sql.VarChar(1000), '%[' + mark + ']%').query(
      'SELECT TOP 1 TransferID, TransferNo FROM dbo.StockTransfer WHERE SystemNotes LIKE @m ORDER BY TransferID DESC')).recordset[0];
    if (!h) throw new Error('Transfer header nahi bana');
    for (const x of rows) {
      await new sql.Request(tx)
        .input('TransferDetailID', sql.Int, 0).input('TransferID', sql.Int, h.TransferID).input('ItemID', sql.Int, x.itemId)
        .input('Qty', sql.Float, x.qty).input('Rate', sql.Float, x.srate).input('TransferRate', sql.Float, x.prate)
        .execute('dbo.usp_StockTransferDetail_InsertUpdate');
    }
    await tx.commit();
    return { transferId: h.TransferID, transferNo: String(h.TransferNo).trim(), from: names[from], to: names[to], rows, cogs, at: now };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}
async function deleteTransfer(j) {
  const p = await getPool();
  const id = Number(j.transferId);
  const h = (await p.request().input('i', sql.Int, id).query('SELECT TransferID, TransferNo, SystemNotes, TransferDate FROM dbo.StockTransfer WHERE TransferID = @i')).recordset[0];
  if (!h) throw new Error('Transfer note POS mein nahi mila (pehle se hata hua?)');
  if (!/BK-APP/.test(String(h.SystemNotes || ''))) throw new Error('Yeh note POS se bana tha — POS mein hi delete karein');
  await p.request().input('i', sql.Int, id).execute('dbo.usp_StockTransfer_Delete');
  return { transferNo: String(h.TransferNo).trim() };
}

// ---------- RAW ESC/POS print (sale-post jaisa) ----------
const ESC = '\x1b', GS = '\x1d';
const pad = (s, w, right) => { s = String(s ?? '').slice(0, w); return right ? s.padStart(w) : s.padEnd(w); };
const line = (l, r) => pad(l, PRINT_WIDTH - String(r).length) + r;
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
function stamp(d) { const x = new Date(d); const h = x.getHours() % 12 || 12; return `${String(x.getDate()).padStart(2, '0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]}-${x.getFullYear()} ${h}:${String(x.getMinutes()).padStart(2, '0')} ${x.getHours() < 12 ? 'am' : 'pm'}`; }
function head(title) {
  return [ESC + '@', ESC + 'a' + '\x01', ESC + '!' + '\x30' + SHOP_NAME + ESC + '!' + '\x00', SHOP_PHONE, ESC + '!' + '\x08' + title + ESC + '!' + '\x00', ESC + 'a' + '\x00', '-'.repeat(PRINT_WIDTH)];
}
const qtyText = l => { const pk = Number(l.pack) || 0; if (pk > 1 && (Number(l.ctn) || Number(l.pcs) != null)) { const c = Number(l.ctn) || 0, p = Number(l.pcs) || 0; return (c ? n(c) + ' ' + ascii(l.cName || 'Ctn') : '') + (c && p ? ' + ' : '') + (p || !c ? n(p) + ' ' + ascii(l.uName || 'Pcs') : '') + ' (' + n(l.qty) + ')'; } return n(l.qty); };
function transferText(r, note, reprint) {
  const out = head('STOCK TRANSFER NOTE');
  out.push(line('STN No: ' + r.transferNo, stamp(r.at)));
  out.push(`Se : ${ascii(r.from)}`, `Ko : ${ascii(r.to)}`);
  if (note) out.push('Note: ' + ascii(note).slice(0, PRINT_WIDTH - 6));
  out.push('-'.repeat(PRINT_WIDTH), pad('Item', PRINT_WIDTH - 22) + pad('Qty', 22, true), '-'.repeat(PRINT_WIDTH));
  for (const x of r.rows) { const q = qtyText(x); if (ascii(x.name).length + q.length + 1 > PRINT_WIDTH) { out.push(ascii(x.name).slice(0, PRINT_WIDTH)); out.push(pad('', PRINT_WIDTH - q.length) + q); } else out.push(pad(ascii(x.name), PRINT_WIDTH - q.length) + q); }
  out.push('-'.repeat(PRINT_WIDTH), line('Items: ' + r.rows.length, 'Kul pcs: ' + n(r.rows.reduce((s, x) => s + (Number(x.qty) || 0), 0))));
  if (reprint) {
    out.push('', ESC + 'a' + '\x01', ESC + '!' + '\x30' + 'DOBARA PRINT (' + reprint.n + ')' + ESC + '!' + '\x00', ESC + 'a' + '\x00');
    out.push('Wajah: ' + ascii(reprint.reason).slice(0, PRINT_WIDTH - 7), stamp(reprint.at) + (reprint.by ? ' · ' + ascii(reprint.by) : ''));
  }
  out.push('', 'Dastakhat (nikala): ____________', '', 'Dastakhat (mila):   ____________', '', '', '', GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
function purchaseText(b, entry) {
  const money = c => (Math.round((Number(c) || 0)) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const out = head('PURCHASE BILL');
  if (b) {
    out.push(line('Bill No: ' + b.billNo, b.date), 'Supplier: ' + ascii(b.partyName).slice(0, PRINT_WIDTH - 10));
    out.push('-'.repeat(PRINT_WIDTH), pad('Item', 18) + pad('Qty', 8, true) + pad('Rate', 8, true) + pad('Rs', 8, true), '-'.repeat(PRINT_WIDTH));
    for (const l of b.lines || []) {
      out.push(ascii(l.name).slice(0, PRINT_WIDTH));
      out.push(pad('', 18) + pad(l.qty + ' ' + ascii(l.cName || 'Ctn'), 8, true) + pad(money(l.ctn), 8, true) + pad(money(l.total), 8, true));
    }
    out.push('-'.repeat(PRINT_WIDTH));
    if (b.discount) out.push(line('Discount:', money(b.discount)));
    if (b.tax) out.push(line('Tax:', money(b.tax)));
    out.push(ESC + 'a' + '\x02', ESC + '!' + '\x30' + 'Rs.' + money(b.net) + ESC + '!' + '\x00', ESC + 'a' + '\x00');
  } else if (entry) {
    out.push(line('Cash purchase', entry.date), 'Supplier: ' + ascii(entry.partyName || '').slice(0, PRINT_WIDTH - 10));
    if (entry.note) out.push('Note: ' + ascii(entry.note).slice(0, PRINT_WIDTH - 6));
    out.push('-'.repeat(PRINT_WIDTH), ESC + 'a' + '\x02', ESC + '!' + '\x30' + 'Rs.' + money(entry.amount) + ESC + '!' + '\x00', ESC + 'a' + '\x00');
  }
  out.push('', '', '', GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
function sendRaw(text, docName) {
  const file = path.join(DIR, 'transfer-print.bin');
  fs.writeFileSync(file, Buffer.from(text, 'binary'));
  const ps = `
$ErrorActionPreference='Stop'
$name='${PRINTER_NAME.replace(/'/g, "''")}'
$bytes=[System.IO.File]::ReadAllBytes('${file.replace(/'/g, "''")}')
Add-Type -TypeDefinition @"
using System;using System.IO;using System.Runtime.InteropServices;
public class RawT{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DI{[MarshalAs(UnmanagedType.LPWStr)]public string n;[MarshalAs(UnmanagedType.LPWStr)]public string o;[MarshalAs(UnmanagedType.LPWStr)]public string t;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);
 [DllImport("winspool.Drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h,int l,ref DI di);
 [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
 public static void Send(string printer,byte[] data){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new Exception("printer nahi mila: "+printer);
  DI di=new DI();di.n="${docName}";di.t="RAW";StartDocPrinter(h,1,ref di);StartPagePrinter(h);
  IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);int w;WritePrinter(h,p,data.Length,out w);
  Marshal.FreeCoTaskMem(p);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);}
}
"@
[RawT]::Send($name,$bytes)
`;
  const psFile = path.join(DIR, 'transfer-raw.ps1');
  fs.writeFileSync(psFile, ps);
  return new Promise(res => require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
    { timeout: 20000 }, (err, so, se) => { if (err) err.message = String(se || '').trim().split(/\r?\n/)[0] || err.message; res(err); }));
}

// ---------- jobs ----------
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => log('Masla: ' + e.message)); };
async function claim(ref, workingStatus) {
  return db.runTransaction(async t => {
    const cur = (await t.get(ref)).data();
    if (!cur || cur.status !== 'new') return null;
    t.update(ref, { status: workingStatus, pc: os.hostname(), pickedAt: Date.now() });
    return cur;
  });
}
async function handleTransfer(doc) {
  if (busy.has(doc.id)) return; busy.add(doc.id);
  try {
    const ref = trCol.doc(doc.id), j = await claim(ref, 'working'); if (!j) return;
    try {
      if (j.op === 'delete') {
        const r = await deleteTransfer(j);
        await ref.update({ status: 'done', doneAt: Date.now(), error: FieldValue.delete() });
        log(`Transfer note HATAYA: ${r.transferNo}`);
      } else {
        const r = await createTransfer({ ...j, id: doc.id });
        await ref.update({ status: 'done', transferId: r.transferId, transferNo: r.transferNo, cogs: r.cogs, doneAt: Date.now(), error: FieldValue.delete() });
        log(`Transfer note bana: ${r.transferNo} · ${r.from} -> ${r.to} · ${r.rows.length} items`);
        if (AUTO_PRINT || j.print) { const e = await sendRaw(transferText(r, j.note), 'STN ' + r.transferNo); if (e) log('Print masla: ' + e.message); else log('Transfer note print ho gaya'); }
      }
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 250), doneAt: Date.now() });
      log(`Transfer NAHI hua: ${e.message}`);
    }
  } finally { busy.delete(doc.id); }
}
async function handlePrint(doc) {
  if (busy.has('p' + doc.id)) return; busy.add('p' + doc.id);
  try {
    const ref = prCol.doc(doc.id), j = await claim(ref, 'printing'); if (!j) return;
    try {
      let text = null;
      if (j.kind === 'purchase') {
        const bill = (await biz.collection('posBills').doc(String(j.id)).get()).data();
        const entry = bill ? null : (await biz.collection('blueKhata').doc(String(j.id)).get()).data();
        if (!bill && !entry) throw new Error('Purchase nahi mili');
        if (entry && entry.partyId) { const pd = (await biz.collection('blueKhata').doc(entry.partyId).get()).data(); entry.partyName = pd?.name || j.partyName || ''; }
        text = purchaseText(bill, entry);
      } else if (j.kind === 'transfer') {
        const tRef = trCol.doc(String(j.id)), tj = (await tRef.get()).data();
        if (!tj || tj.status !== 'done') throw new Error('Transfer note nahi mila');
        const names = await branchNames(await getPool());
        const rp = { n: (Array.isArray(tj.reprints) ? tj.reprints.length : 0) + 1, reason: j.reason || '', at: Date.now(), by: j.byName || '' };
        text = transferText({ transferNo: tj.transferNo, at: tj.doneAt || Date.now(), from: names[tj.from] || tj.from, to: names[tj.to] || tj.to, rows: tj.lines || [] }, tj.note, rp);
        await tRef.update({ reprints: FieldValue.arrayUnion({ at: rp.at, reason: rp.reason, by: j.by || '', n: rp.n }) });
      } else throw new Error('Print ki qisam nahi pehchani: ' + j.kind);
      const e = await sendRaw(text, 'Print ' + j.kind);
      if (e) throw e;
      await ref.update({ status: 'done', doneAt: Date.now(), error: FieldValue.delete() });
      log(`Print ho gaya: ${j.kind} ${j.id}`);
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 250), doneAt: Date.now() });
      log(`Print NAHI hua (${j.kind}): ${e.message}`);
    }
  } finally { busy.delete('p' + doc.id); }
}

// ---------- v3: POS POSTING (VoucherStatus 1 = UnPosted, 2 = Posted, 3 = Cancelled) ----------
const POST_TYPES = ['PO', 'CPV', 'CRV', 'JV', 'BPV', 'BRV'];
const SWEEP_DAYS = 60, SWEEP_MS = 5 * 60 * 1000;
const STATUS_FILE = path.join(DIR, 'post-status.json');
function readStatus() { try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return null; } }
function saveStatus(o) { try { fs.writeFileSync(STATUS_FILE, JSON.stringify(o)); } catch {} }
// POS voucher -> app ki doc ids (khata entries)
async function appIdsFor(v) {
  if (v.DocumentType === 'PO') return ['pos-' + v.DocumentNo];
  const snap = await linksCol.where('voucherId', '==', v.VoucherID).get();
  const ids = [];
  snap.forEach(d => { const k = d.id; if (k.startsWith('entry:')) ids.push(k.slice(6)); else if (k.startsWith('transfer:')) ids.push(`transfer-${k.slice(9)}-out`, `transfer-${k.slice(9)}-in`); });
  return ids;
}
async function applyStatus(v, status) {
  const ids = await appIdsFor(v); let n = 0;
  for (const id of ids) {
    const ref = khataCol.doc(id), sn = await ref.get();
    if (!sn.exists || Number(sn.data().posStatus || 1) === status) continue;
    await ref.set({ posStatus: status, posStatusAt: Date.now() }, { merge: true }); n++;
  }
  if (v.DocumentType === 'PO') { const b = billsCol.doc('pos-' + v.DocumentNo), bs = await b.get(); if (bs.exists && Number(bs.data().status || 1) !== status) await b.set({ status }, { merge: true }); }
  return n;
}
async function findVoucher(p, it) {
  const r = p.request();
  if (it.kind === 'purchase') r.input('n', sql.Int, Number(it.purchaseId));
  else r.input('c', sql.VarChar(50), String(it.code || '').trim());
  const q = it.kind === 'purchase'
    ? `SELECT TOP 1 VoucherID, DocumentType, DocumentNo, VoucherStatusID, VoucherCode FROM dbo.Voucher WHERE DocumentType = 'PO' AND DocumentNo = @n ORDER BY VoucherID DESC`
    : `SELECT TOP 1 VoucherID, DocumentType, DocumentNo, VoucherStatusID, VoucherCode FROM dbo.Voucher WHERE VoucherCode = @c ORDER BY VoucherID DESC`;
  return (await r.query(q)).recordset[0] || null;
}
async function handlePost(doc) {
  if (busy.has('o' + doc.id)) return; busy.add('o' + doc.id);
  try {
    const ref = poCol.doc(doc.id), j = await claim(ref, 'working'); if (!j) return;
    const p = await getPool(), want = j.op === 'unpost' ? 1 : 2, errors = []; let ok = 0;
    for (const it of (j.items || []).slice(0, 100)) {
      const label = it.kind === 'purchase' ? 'Purchase ' + it.purchaseId : String(it.code);
      try {
        const v = await findVoucher(p, it);
        if (!v) throw new Error('POS mein voucher nahi mila');
        if (Number(v.VoucherStatusID) === 3) throw new Error('POS mein Cancelled hai');
        if (Number(v.VoucherStatusID) !== want) {
          const note = `${want === 2 ? 'Posted' : 'UnPosted'} By: Blue Khata app On: ${new Date().toLocaleString('en-PK')}\r\n`;
          await p.request().input('VoucherID', sql.Int, v.VoucherID).input('DocumentType', sql.VarChar(10), String(v.DocumentType || '').trim())
            .input('DocumentNo', sql.Int, Number(v.DocumentNo) || 0).input('VoucherStatusID', sql.Int, want)
            .input('PostedBy', sql.Int, CREATED_BY).input('SystemNote', sql.VarChar(sql.MAX), note).execute('dbo.usp_Voucher_Post');
        }
        await applyStatus(v, want);
        const st = readStatus(); if (st) { st.v[v.VoucherID] = want; saveStatus(st); }
        ok++; log(`${want === 2 ? 'POST' : 'UNPOST'}: ${String(v.VoucherCode || '').trim() || label}`);
      } catch (e) { errors.push(label + ': ' + e.message); log(`Post nahi hua (${label}): ${e.message}`); }
    }
    await ref.update({ status: ok || !errors.length ? 'done' : 'failed', ok, errors: errors.slice(0, 20), doneAt: Date.now() });
  } finally { busy.delete('o' + doc.id); }
}
// Har 5 minute: POS mein status badla ho (POS se post / unpost / cancel) to app mein bhi
async function sweepStatus() {
  try {
    const p = await getPool();
    const rows = (await p.request().query(`SELECT VoucherID, DocumentType, DocumentNo, VoucherStatusID FROM dbo.Voucher
      WHERE DocumentType IN ('${POST_TYPES.join("','")}') AND VoucherDate >= DATEADD(day, -${SWEEP_DAYS}, GETDATE())`)).recordset;
    let st = readStatus(); const first = !st; if (!st) st = { v: {} };
    let changed = 0;
    for (const v of rows) {
      const s = Number(v.VoucherStatusID) || 1, old = st.v[v.VoucherID];
      if (old === s) continue;
      if (old === undefined && s === 1) { st.v[v.VoucherID] = s; continue; }   // naya khula voucher: app mein pehle se khula
      try { changed += await applyStatus(v, s); st.v[v.VoucherID] = s; } catch (e) { log('Status masla: ' + e.message); }
    }
    saveStatus(st);
    if (changed || first) log(`POS status milaya: ${rows.length} voucher dekhe, ${changed} app mein badle`);
  } catch (e) { log('Status sweep masla: ' + e.message); }
}

const lock = net.createServer();
lock.once('error', () => { console.log('transfer-sync pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', async () => {
  try { await getPool(); } catch (e) { log('SQL se nahi jura: ' + e.message); process.exit(1); }
  log('transfer-sync v3 chal raha hai — transfer note, print aur POSTING ka intezar. Band: Ctrl+C');
  const fail = name => e => { log(`${name} listener toot gaya: ${e.message} — band, bat 30 sec mein dobara chalayega`); process.exit(1); };
  trCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleTransfer(c.doc)); }); }, fail('transfer'));
  prCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handlePrint(c.doc)); }); }, fail('print'));
  poCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handlePost(c.doc)); }); }, fail('post'));
  setTimeout(() => later(sweepStatus), 20000); setInterval(() => later(sweepStatus), SWEEP_MS);
});
