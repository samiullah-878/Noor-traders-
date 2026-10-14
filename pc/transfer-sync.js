// =========================================================
//  transfer-sync.js  v3  (2026-09-20: + POS POSTING — postJobs, usp_Voucher_Post, status app mein) — Blue Khata app se POS STOCK TRANSFER NOTE (STN) + PURCHASE BILL PRINT
//  1) transferJobs: app (Stock -> ⇄ Transfer) ka hukum -> POS ke apne procedures usp_StockTransfer_InsertUpdate +
//     usp_StockTransferDetail_InsertUpdate (bilkul POS ki Transfer screen jaisa: STN no, dono godam ka stock, ledger, voucher).
//     op 'delete' -> usp_StockTransfer_Delete. Note thermal printer (TM-T88IV) par bhi chhapta hai.
//  2) printJobs (kind 'purchase'): POS purchase bill (posBills) ya larke ki cash purchase ki rasid TM-T88IV par.
//  3) v4 (2026-10-10): 🖨 PURCHASE AUTO PRINT — purchase-parchi.js: POS mein naya purchase bill (POS / app) aate hi tafseeli
//     parchi (stock pehle -> ab, pichla rate, nafa, din ka maal, DHYAN); badla = "BADLA HUA BILL" + tabdeeli; mita / cancel =
//     chhoti parchi. App ka "Dobara print" bhi yahi tafseeli parchi. Setting: blueAccess/printConfig (malik). SQL sirf SELECT.
//  v4.1 (2026-10-11): app ke transfer note ki parchi par STN ka BARCODE (POS wali parchi jaisa) — Transfer check mein scan ho.
//  v4.2 (2026-10-11): har item ke neeche 'Baqi <se>: X | <ko>: Y' — transfer ke BAAD dono godam ka stock usi parchi par (alag parchi nahi). Reprint par bhi.
//  v4.3 (2026-10-11): har item ke neeche dono godam ka stock PEHLE -> BAAD ("Godam 1: 15 Ctn + 3 Pcs -> 12 Ctn + 3 Pcs"). Pehle = baad +/- transfer ki qty.
//  v4.4 (2026-10-11): POS MEIN BANE transfer note ki bhi yahi parchi (stock pehle -> baad) — POS apni parchi mein kuch jodne nahi deta, is liye
//     naya POS note aate hi (10 s mein) hamari parchi alag se. Sirf SELECT. Purane note kabhi nahi chhapte. Band: POS_NOTE_PRINT = false.
//  v4.6 (2026-10-12): printJobs kind 'voucher' chhor deta hai (pos-khata-sync chhapta hai).
//  v4.7 (2026-10-13): MALIK ke liye (app ki ⇄ Transfer screen): (1) 🖨 POS par bane note ka bhi dobara print — printJobs id 'pos:<TransferID>'
//     (POS se lines + dono godam ka abhi ka stock, upar "DOBARA PRINT"). (2) ❌ Cancel POS wala note bhi — job.force (sirf malik, rules 2.47).
//     (3) ✏️ op 'edit' = purana note usp_StockTransfer_Delete + naya createTransfer (naya STN). Naya na bane to saaf error (purana hat chuka).
//  v4.5 (2026-10-12): 💰 HBL parchi — bank-parchi.js: HBL Inbox mein naya SMS / email aate hi "PAISE AAYE" parchi. Setting printConfig.bankAuto.
//  v4.8 (2026-10-14): 🔤 TRANSFER NOTE PAR URDU — har item ke English naam ke neeche Urdu naam (urdu-names.js: blueAccess/urduNames LIVE,
//     printConfig.urduSlip). Urdu wali parchi nt-parchi ke tez worker se (tasveer); Urdu na ho to pehle jaisa RAW.
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
// 2026-10-01 HEARTBEAT: har 30 sec '<script>.alive' mein waqt — doctor 3 min purana dekhe to script ko latki samajh kar dobara chalata hai
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();   // 2026-10-11: 💓 sachi dhadkan (zinda.js) — purani 30-sec khud-likhne wali hatayi
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
let PP = null; try { PP = require('./purchase-parchi.js'); } catch (e) { log('purchase-parchi.js nahi mili (' + e.message + ') — purchase auto-print band, baqi sab chalta'); }   // v4
let PW = null;
const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const UR = require('./urdu-names.js'); UR.watch(db, BUSINESS_ID, m => { try { log(m); } catch { console.log(m); } });   // v4.8
let PARCHI = null; const getParchi = () => PARCHI || (PARCHI = require('./nt-parchi.js').make({ dir: DIR, width: PRINT_WIDTH, dots: 512 }));
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
    await addBaqi(p, rows, from, to);   // v4.2: har item ka baqi stock (se / ko) — usi parchi par chhapta hai
    return { transferId: h.TransferID, transferNo: String(h.TransferNo).trim(), from: names[from], to: names[to], rows, cogs, at: now };
  } catch (e) { try { await tx.rollback(); } catch {} throw e; }
}
// v4.2: transfer ke BAAD dono godam ka taza stock (POS ItemBranchRate.CurrStock) har row mein daal do: baqiFrom / baqiTo
async function addBaqi(p, rows, from, to) {
  for (const x of rows) {
    try {
      const q = (await p.request().input('i', sql.Int, x.itemId).input('f', sql.Int, from).input('t', sql.Int, to).query(
        `SELECT (SELECT ISNULL(CurrStock,0) FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = @f) AS F,
                (SELECT ISNULL(CurrStock,0) FROM dbo.ItemBranchRate WHERE ItemID = @i AND BranchID = @t) AS T`)).recordset[0] || {};
      x.baqiFrom = r3(q.F); x.baqiTo = r3(q.T);
    } catch (e) { log('Baqi stock nahi mila (' + x.name + '): ' + e.message); }
  }
}
async function deleteTransfer(j) {
  const p = await getPool();
  const id = Number(j.transferId);
  const h = (await p.request().input('i', sql.Int, id).query('SELECT TransferID, TransferNo, SystemNotes, TransferDate FROM dbo.StockTransfer WHERE TransferID = @i')).recordset[0];
  if (!h) throw new Error('Transfer note POS mein nahi mila (pehle se hata hua?)');
  if (!/BK-APP/.test(String(h.SystemNotes || '')) && j.force !== true) throw new Error('Yeh note POS se bana tha — POS mein hi delete karein');   // v4.7: malik (force) app se bhi
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
// v4.2: stock ka matn — pack ho to "12 Ctn + 3 Pcs", warna seedha qty
const ctnPcs = (q, l) => { const pk = Number(l.pack) || 0, v = Number(q) || 0; if (pk > 1) { const c = Math.floor(v / pk + 1e-9), p = r3(v - c * pk); return (c ? n(c) + ' ' + ascii(l.cName || 'Ctn') : '') + (c && p ? ' + ' : '') + (p || !c ? n(p) + ' ' + ascii(l.uName || 'Pcs') : ''); } return n(v); };
// v4.3: har godam ki line " <godam>: <pehle> -> <baad>" (transfer se pehle aur baad ka stock). Pehle = baad + qty (jahan se nikla) /
// baad - qty (jahan gaya) — alag SQL nahi, reprint par bhi wahi. 42 chars se lamba ho to do lines: "<godam> pehle: .." / "<godam> baad : ..".
function baqiText(x, r) {
  if (x.baqiFrom == null && x.baqiTo == null) return '';
  const q = Number(x.qty) || 0, out = [];
  const one = (name, after, before) => {
    const N = ascii(name);
    if (after == null) { out.push(` ${N}: ?`.slice(0, PRINT_WIDTH)); return; }
    const b = ctnPcs(before, x), a = ctnPcs(after, x), l = ` ${N}: ${b} -> ${a}`;
    if (l.length <= PRINT_WIDTH) out.push(l);
    else out.push(` ${N} pehle: ${b}`.slice(0, PRINT_WIDTH), ` ${N} baad : ${a}`.slice(0, PRINT_WIDTH));   // godam ka naam kabhi na gire
  };
  one(r.from, x.baqiFrom, x.baqiFrom == null ? null : r3(Number(x.baqiFrom) + q));
  one(r.to, x.baqiTo, x.baqiTo == null ? null : r3(Number(x.baqiTo) - q));
  return out.join('\r\n');
}
function transferText(r, note, reprint) {
  const out = head('STOCK TRANSFER NOTE');
  out.push(line('STN No: ' + r.transferNo, stamp(r.at)));
  { const c = String(r.transferNo || '').replace(/[^\x20-\x7e]/g, '').trim(); if (c) out.push(ESC + 'a' + '\x01' + GS + 'h' + '\x50' + GS + 'w' + '\x02' + GS + 'H' + '\x02' + GS + 'k' + '\x49' + String.fromCharCode(c.length + 2) + '{B' + c + '\n' + ESC + 'a' + '\x00'); }   // v4.1: barcode (CODE128) — app ka 🧾 Transfer check scan
  out.push(`Se : ${ascii(r.from)}`, `Ko : ${ascii(r.to)}`);
  if (r.pos) out.push('(POS se bana note - stock ki parchi)');   // v4.4
  if (note) out.push('Note: ' + ascii(note).slice(0, PRINT_WIDTH - 6));
  out.push('-'.repeat(PRINT_WIDTH), pad('Item', PRINT_WIDTH - 22) + pad('Qty', 22, true), '-'.repeat(PRINT_WIDTH));
  if (r.rows.some(x => x.baqiFrom != null || x.baqiTo != null)) out.push('(har item ke neeche stock: pehle -> baad)');   // v4.3
  for (const x of r.rows) {
    const q = qtyText(x); if (ascii(x.name).length + q.length + 1 > PRINT_WIDTH) { out.push(ascii(x.name).slice(0, PRINT_WIDTH)); out.push(pad('', PRINT_WIDTH - q.length) + q); } else out.push(pad(ascii(x.name), PRINT_WIDTH - q.length) + q);
    { const ur = UR.get(x.itemId); if (ur) out.push(UR.line(ur, 40)); }   // v4.8: 🔤 Urdu naam
    const b = baqiText(x, r); if (b) out.push(...b.split('\r\n'));   // v4.2: baqi stock usi parchi par
  }
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
  if (UR.has(text)) {   // v4.8: Urdu tasveer wali parchi — nt-parchi worker (tez). Na chale to bina Urdu purana tareeqa (parchi kabhi na ruke)
    return Promise.resolve().then(() => getParchi().sendJobs([UR.toJob(text, { font: getParchi().FONT_UR, dots: 512 })], PRINTER_NAME))
      .catch(e => (log('Urdu parchi masla: ' + e.message + ' — bina Urdu'), sendRaw(UR.strip(text), docName)));   // printer ki ghalti (Error wapas) = wahi lautao, dobara mat chhapo
  }
  const file = path.join(DIR, 'transfer-print.bin');
  fs.writeFileSync(file, Buffer.from(text, 'binary'));
  const ps = `
$ErrorActionPreference='Stop'
$name='${PRINTER_NAME.replace(/'/g, "''")}'
$bytes=[System.IO.File]::ReadAllBytes('${file.replace(/'/g, "''")}')
# 2026-10-02 TEZ PRINT: C# helper ek dafa RawCached.dll mein compile, phir har print par sirf load (pehle har dafa compile = 3-8 sec)
$dll=Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'RawCached.dll'
if(!(Test-Path $dll)){ Add-Type -TypeDefinition @"
using System;using System.IO;using System.Runtime.InteropServices;
public class RawCached{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DI{[MarshalAs(UnmanagedType.LPWStr)]public string n;[MarshalAs(UnmanagedType.LPWStr)]public string o;[MarshalAs(UnmanagedType.LPWStr)]public string t;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);
 [DllImport("winspool.Drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h,int l,ref DI di);
 [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
 public static void Send(string printer,byte[] data,string doc){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new Exception("printer nahi mila: "+printer);
  DI di=new DI();di.n=doc;di.t="RAW";StartDocPrinter(h,1,ref di);StartPagePrinter(h);
  IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);int w;WritePrinter(h,p,data.Length,out w);
  Marshal.FreeCoTaskMem(p);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);}
}
"@ -OutputAssembly $dll }
Add-Type -Path $dll
[RawCached]::Send($name,$bytes,"${docName.replace(/"/g, "")}")
`;
  const psFile = path.join(DIR, 'transfer-raw.ps1');
  fs.writeFileSync(psFile, ps);
  return new Promise(res => require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
    { timeout: 20000 }, (err, so, se) => { if (err) err.message = String(se || '').trim().split(/\r?\n/)[0] || err.message; res(err); }));
}

// ---------- jobs ----------
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message))) { log('Firebase ka rabta toot gaya (UNAUTHENTICATED) — script 30 sec mein nayi chabi se dobara shuru hogi'); setTimeout(() => process.exit(1), 500); } }); };   // 2026-09-30: pehle bas likh kar aage chal padti thi, bill atak jate
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
        await ref.update({ status: 'done', doneAt: Date.now(), error: FieldValue.delete(), oldNo: r.transferNo });
        log(`Transfer note HATAYA: ${r.transferNo}${j.reason ? ' · wajah: ' + j.reason : ''}`);
      } else if (j.op === 'edit') {   // v4.7: purana hatao, naya banao
        const old = await deleteTransfer(j);
        log(`✏️ Edit: purana note ${old.transferNo} hataya — naya bana raha hoon`);
        let r;
        try { r = await createTransfer({ ...j, id: doc.id }); }
        catch (e) { throw new Error(`Purana note ${old.transferNo} cancel ho gaya magar naya NAHI bana: ${e.message} — app se naya note dobara banayein`); }
        await ref.update({ status: 'done', transferId: r.transferId, transferNo: r.transferNo, oldNo: old.transferNo, oldId: Number(j.transferId) || 0, cogs: r.cogs, doneAt: Date.now(), error: FieldValue.delete(), baqi: r.rows.map(x => ({ itemId: x.itemId, f: x.baqiFrom ?? null, t: x.baqiTo ?? null })) });
        log(`✏️ Edit ho gaya: ${old.transferNo} -> naya ${r.transferNo} · ${r.rows.length} items`);
        { const nC = Math.min(3, Math.max(1, Number(j.copies) || 1)), txt = transferText(r, (j.note ? j.note + ' · ' : '') + 'EDIT (purana ' + old.transferNo + ')'); let e = null; for (let i = 0; i < nC && !e; i++) e = await sendRaw(txt, 'STN ' + r.transferNo); if (e) log('Print masla: ' + e.message); }
      } else {
        const r = await createTransfer({ ...j, id: doc.id });
        await ref.update({ status: 'done', transferId: r.transferId, transferNo: r.transferNo, cogs: r.cogs, doneAt: Date.now(), error: FieldValue.delete(), baqi: r.rows.map(x => ({ itemId: x.itemId, f: x.baqiFrom ?? null, t: x.baqiTo ?? null })) });   // v4.2: baqi save — reprint par bhi dikhe
        log(`Transfer note bana: ${r.transferNo} · ${r.from} -> ${r.to} · ${r.rows.length} items`);
        if (AUTO_PRINT || j.print) { const nC = Math.min(3, Math.max(1, Number(j.copies) || 1)), txt = transferText(r, j.note); let e = null; for (let i = 0; i < nC && !e; i++) e = await sendRaw(txt, 'STN ' + r.transferNo); if (e) log('Print masla: ' + e.message); else log('Transfer note print ho gaya' + (nC > 1 ? ' x' + nC : '')); }   // 2026-10-02: copies 1-3
      }
    } catch (e) {
      await ref.update({ status: 'failed', error: String(e.message).slice(0, 250), doneAt: Date.now() });
      log(`Transfer NAHI hua: ${e.message}`);
    }
  } finally { busy.delete(doc.id); }
}
async function handlePrint(doc) {
  if ((doc.data() || {}).kind === 'voucher') return;   // v4.6: voucher dobara print pos-khata-sync karta hai
  if (busy.has('p' + doc.id)) return; busy.add('p' + doc.id);
  try {
    const ref = prCol.doc(doc.id), j = await claim(ref, 'printing'); if (!j) return;
    try {
      let text = null;
      if (j.kind === 'purchase') {
        const bill = (await biz.collection('posBills').doc(String(j.id)).get()).data();
        if (bill && Number(bill.purchaseId) > 0 && PW) {   // v4: tafseeli parchi (stock / rate / nafa)
          try {
            await PW.reprint(Number(bill.purchaseId), j.copies, sendRaw);
            await ref.update({ status: 'done', doneAt: Date.now(), error: FieldValue.delete() });
            log(`Print ho gaya (tafseeli): purchase ${j.id}`); return;
          } catch (e) { log('Tafseeli parchi nahi bani (' + e.message + ') — purani saadi parchi'); }
        }
        const entry = bill ? null : (await biz.collection('blueKhata').doc(String(j.id)).get()).data();
        if (!bill && !entry) throw new Error('Purchase nahi mili');
        if (entry && entry.partyId) { const pd = (await biz.collection('blueKhata').doc(entry.partyId).get()).data(); entry.partyName = pd?.name || j.partyName || ''; }
        text = purchaseText(bill, entry);
      } else if (j.kind === 'transfer' && /^pos:\d+$/.test(String(j.id))) {   // v4.7: POS par bana note — dobara print
        const d = await posNoteData(await getPool(), Number(String(j.id).slice(4)));
        text = transferText(d.r, d.note, { n: 1, reason: j.reason || '', at: Date.now(), by: j.byName || '' });
      } else if (j.kind === 'transfer') {
        const tRef = trCol.doc(String(j.id)), tj = (await tRef.get()).data();
        if (!tj || tj.status !== 'done') throw new Error('Transfer note nahi mila');
        const names = await branchNames(await getPool());
        const rp = { n: (Array.isArray(tj.reprints) ? tj.reprints.length : 0) + 1, reason: j.reason || '', at: Date.now(), by: j.byName || '' };
        text = transferText({ transferNo: tj.transferNo, at: tj.doneAt || Date.now(), from: names[tj.from] || tj.from, to: names[tj.to] || tj.to, rows: (tj.lines || []).map(l => { const b = (tj.baqi || []).find(z => Number(z.itemId) === Number(l.itemId)); return b ? { ...l, baqiFrom: b.f, baqiTo: b.t } : l; }) }, tj.note, rp);   // v4.2: reprint par bhi baqi
        await tRef.update({ reprints: FieldValue.arrayUnion({ at: rp.at, reason: rp.reason, by: j.by || '', n: rp.n }) });
      } else throw new Error('Print ki qisam nahi pehchani: ' + j.kind);
      const nC = Math.min(3, Math.max(1, Number(j.copies) || 1)); let e = null; for (let i = 0; i < nC && !e; i++) e = await sendRaw(text, 'Print ' + j.kind);   // 2026-10-02: copies 1-3
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

// ---------- v4.4: POS MEIN BANE transfer note ki bhi hamari parchi (har item ka stock pehle -> baad) ----------
// POS apni parchi khud chhapta hai aur us mein hum kuch nahi jod sakte. Is liye POS mein naya note (dbo.StockTransfer, jis par app ka
// nishan BK-APP nahi) aate hi yahi parchi alag se chhapti hai. POS mein sirf SELECT. Pehli dafa: aaj tak ke sab note "ho chuke"
// (purane kabhi nahi chhapte). Stock = abhi ka CurrStock (transfer ke baad); pehle = baad +/- qty — is liye 15 minute se purana note
// nahi chhapta (stock badal chuka hoga).
const POS_NOTE_PRINT = true, TN_EVERY_MS = 10000, TN_SETTLE_SEC = 8, TN_MAX_AGE_SEC = 900;
const TN_FILE = path.join(DIR, 'transfer-print.json');
const tnRead = () => { try { const o = JSON.parse(fs.readFileSync(TN_FILE, 'utf8')); return Number.isFinite(Number(o.last)) ? { last: Number(o.last) } : null; } catch { return null; } };
const tnSave = o => { try { fs.writeFileSync(TN_FILE, JSON.stringify(o)); } catch {} };
let tnWarned = 0, tnErr = '';
// v4.7: POS ke kisi bhi note ki lines + dono godam ka abhi ka stock (dobara print ke liye)
async function posNoteData(p, id) {
  const h = (await p.request().input('i', sql.Int, id).query('SELECT TransferID, FromBranchID, ToBranchID, TransferNo, Remarks, TransferDate FROM dbo.StockTransfer WHERE TransferID = @i')).recordset[0];
  if (!h) throw new Error('Transfer note POS mein nahi mila (hata diya gaya?)');
  const det = (await p.request().input('i', sql.Int, id).input('f', sql.Int, Number(h.FromBranchID)).input('t', sql.Int, Number(h.ToBranchID)).query(
    `SELECT d.ItemID, SUM(d.Qty) AS Qty, MAX(i.ItemName) AS ItemName, MAX(i.PackQty) AS PackQty, MAX(i.PackQtyName) AS PackQtyName, MAX(i.QtyName) AS QtyName,
            (SELECT TOP 1 ISNULL(r.CurrStock,0) FROM dbo.ItemBranchRate r WHERE r.ItemID = d.ItemID AND r.BranchID = @f) AS F,
            (SELECT TOP 1 ISNULL(r.CurrStock,0) FROM dbo.ItemBranchRate r WHERE r.ItemID = d.ItemID AND r.BranchID = @t) AS T
     FROM dbo.StockTransferDetail d LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID
     WHERE d.TransferID = @i AND d.Qty > 0 GROUP BY d.ItemID ORDER BY MAX(i.ItemName)`)).recordset;
  const names = await branchNames(p);
  const rows = det.map(d => { const qty = r3(d.Qty), pack = Number(d.PackQty) || 0, c = pack > 1 ? Math.floor(qty / pack + 1e-9) : 0;
    return { itemId: Number(d.ItemID), name: String(d.ItemName || 'Item ' + d.ItemID).trim(), qty, pack, ctn: c, pcs: pack > 1 ? r3(qty - c * pack) : 0,
      cName: String(d.PackQtyName || 'Ctn').trim(), uName: String(d.QtyName || 'Pcs').trim(), baqiFrom: d.F == null ? null : r3(d.F), baqiTo: d.T == null ? null : r3(d.T) }; });
  return { r: { transferNo: String(h.TransferNo ?? '').trim(), at: h.TransferDate ? new Date(h.TransferDate).getTime() : Date.now(), from: names[h.FromBranchID] || 'Godam ' + h.FromBranchID, to: names[h.ToBranchID] || 'Godam ' + h.ToBranchID, rows, pos: true }, note: String(h.Remarks || '').trim() };
}
async function posNotesOnce(p, st, print) {
  const heads = (await p.request().input('l', sql.Int, st.last).query(
    `SELECT TOP 5 t.TransferID, t.FromBranchID, t.ToBranchID, t.TransferNo, t.Remarks, t.SystemNotes,
            DATEDIFF(second, ISNULL(t.CreatedOn, t.TransferDate), GETDATE()) AS AgeSec
     FROM dbo.StockTransfer t WHERE t.TransferID > @l ORDER BY t.TransferID`)).recordset;
  for (const h of heads) {
    const id = Number(h.TransferID), no = String(h.TransferNo ?? '').trim(), age = Number(h.AgeSec);
    if (/BK-APP/.test(String(h.SystemNotes || ''))) { st = { last: id }; continue; }     // app ka note — us ki parchi handleTransfer chhap chuka
    if (age >= 0 && age < TN_SETTLE_SEC) break;                                          // abhi ban raha hai — agli dafa
    if (age > TN_MAX_AGE_SEC) { log(`POS transfer note ${no}: ${Math.round(age / 60)} minute purana — stock ki parchi nahi chhapi (script band thi?)`); st = { last: id }; continue; }
    const det = (await p.request().input('i', sql.Int, id).input('f', sql.Int, Number(h.FromBranchID)).input('t', sql.Int, Number(h.ToBranchID)).query(
      `SELECT d.ItemID, SUM(d.Qty) AS Qty, MAX(i.ItemName) AS ItemName, MAX(i.PackQty) AS PackQty, MAX(i.PackQtyName) AS PackQtyName, MAX(i.QtyName) AS QtyName,
              (SELECT TOP 1 ISNULL(r.CurrStock,0) FROM dbo.ItemBranchRate r WHERE r.ItemID = d.ItemID AND r.BranchID = @f) AS F,
              (SELECT TOP 1 ISNULL(r.CurrStock,0) FROM dbo.ItemBranchRate r WHERE r.ItemID = d.ItemID AND r.BranchID = @t) AS T
       FROM dbo.StockTransferDetail d LEFT JOIN dbo.Items i ON i.ItemID = d.ItemID
       WHERE d.TransferID = @i AND d.Qty > 0 GROUP BY d.ItemID ORDER BY MAX(i.ItemName)`)).recordset;
    if (!det.length) { if (age >= 0 && age < 120) break; st = { last: id }; continue; }   // lines abhi nahi aayin — thora intezar; 2 minute baad chhor do
    const names = await branchNames(p);
    const rows = det.map(d => {
      const qty = r3(d.Qty), pack = Number(d.PackQty) || 0, c = pack > 1 ? Math.floor(qty / pack + 1e-9) : 0;
      return { itemId: Number(d.ItemID), name: String(d.ItemName || 'Item ' + d.ItemID).trim(), qty, pack, ctn: c, pcs: pack > 1 ? r3(qty - c * pack) : 0,
        cName: String(d.PackQtyName || 'Ctn').trim(), uName: String(d.QtyName || 'Pcs').trim(), baqiFrom: d.F == null ? null : r3(d.F), baqiTo: d.T == null ? null : r3(d.T) };
    });
    const text = transferText({ transferNo: no, at: Date.now(), from: names[h.FromBranchID] || 'Godam ' + h.FromBranchID, to: names[h.ToBranchID] || 'Godam ' + h.ToBranchID, rows, pos: true }, String(h.Remarks || '').trim(), null);
    const err = await print(text, 'Transfer ' + no);
    if (err) { if (tnWarned !== id) { tnWarned = id; log(`POS transfer note ${no} ki stock parchi print NAHI hui: ${err.message} — dobara koshish hogi`); } break; }
    log(`POS transfer note ${no} ki stock parchi chhapi (${rows.length} items)`);
    st = { last: id };
  }
  return st;
}
async function posNotes() {
  if (!POS_NOTE_PRINT) return;
  try {
    const p = await getPool(); const st = tnRead();
    if (!st) {
      const m = (await p.request().query('SELECT ISNULL(MAX(TransferID), 0) AS M FROM dbo.StockTransfer')).recordset[0];
      const first = { last: Number(m && m.M) || 0 }; tnSave(first);
      log(`POS transfer note ki stock parchi chalu — TransferID ${first.last} ke BAAD wale note chhapenge (purane nahi)`);
      return;
    }
    const nx = await posNotesOnce(p, st, sendRaw);
    if (nx.last !== st.last) tnSave(nx);
    tnErr = '';
  } catch (e) { const m = String(e && e.message).slice(0, 160); if (tnErr !== m) { tnErr = m; log('POS transfer note dekhne mein masla: ' + m); } }
}

const lock = net.createServer();
lock.once('error', () => { console.log('transfer-sync pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', async () => {
  try { await getPool(); } catch (e) { log('SQL se nahi jura: ' + e.message); process.exit(1); }
  log('transfer-sync v4.7 chal raha hai — transfer note, print, POSTING aur 🖨 purchase auto-print. Band: Ctrl+C');
  const fail = name => e => { log(`${name} listener toot gaya: ${e.message} — band, bat 30 sec mein dobara chalayega`); process.exit(1); };
  trCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleTransfer(c.doc)); }); }, fail('transfer'));
  prCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handlePrint(c.doc)); }); }, fail('print'));
  poCol.where('status', '==', 'new').onSnapshot(s => { s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handlePost(c.doc)); }); }, fail('post'));
  setTimeout(() => later(sweepStatus), 20000); setInterval(() => later(sweepStatus), SWEEP_MS);
  if (POS_NOTE_PRINT) { setTimeout(() => later(posNotes), 15000); setInterval(() => later(posNotes), TN_EVERY_MS); }   // v4.4: POS ke note ki stock parchi (printer wali hi qataar)
  // v4: 🖨 purchase auto-print — printer ka kaam transfer / print jobs wali queue mein (ek waqt ek parchi, files na takrayein)
  if (PP) {
    try {
      const sendQ = (text, docName) => new Promise(res => { later(async () => res(await sendRaw(text, docName))); });
      PW = PP.createWatcher({ getPool, sql, log, sendRaw: sendQ, branchNames, cfgRef: biz.collection('blueAccess').doc('printConfig'),
        stateFile: path.join(DIR, 'purchase-print.json'),
        appWho: async id => { const d = (await biz.collection('appPurchases').doc(String(id)).get()).data(); return d ? (d.role === 'owner' ? 'Malik' : 'Mulazim') : ''; } });
      PW.start();
    } catch (e) { log('Purchase auto-print shuru nahi hua: ' + e.message); }
  }
  // v4.5: 💰 HBL parchi — naya SMS / email (bankSms) aate hi "PAISE AAYE" parchi (printConfig.bankAuto)
  try {
    const BP = require('./bank-parchi.js');
    const sendQ2 = (text, docName) => new Promise(res => { later(async () => res(await sendRaw(text, docName))); });
    BP.createBankWatcher({ biz, log, head, sendRaw: sendQ2, stateFile: path.join(DIR, 'bank-print.json'), cfgRef: biz.collection('blueAccess').doc('printConfig') }).start(fail('HBL parchi'));
  } catch (e) { log('HBL parchi shuru nahi hui: ' + e.message); }
});
