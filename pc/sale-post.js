// ============================================================
//  sale-post.js — Blue Khata app ki "Nayi Sale" -> POS Sale bill (v1)
//
//  App sale Firestore "appSales" mein status "new" ke saath likhta hai. Yeh script:
//   1) POS ke apne procedures (usp_Sale_InsertUpdate / usp_SaleDetail_InsertUpdate) se bill banati hai
//      — bilkul POS ki Sale screen jaisa (SJV voucher, stock kam, StockLedger sab POS khud karta hai)
//   2) Counter  = party COUNTER SALE (Defaults.DefCustomerID), cash
//      Wholesale = party "whole sale" (SaleAllowedParty mein), udhaar + usi waqt ka cash CRV (POS jaisa)
//   3) Mulazim (role staff) ki sale hamesha POS ke rate se (R / W). Malik ka likha rate chalta hai.
//   4) Rasid default printer par. App ka "Dobara print" (printReq) sirf print karta hai, kuch save nahi.
//   5) Ek sale do dafa na bane: Firestore transaction ("posting") + Sale.Description mein "BK-APP <id>" nishan.
//
//  Chalana:  node sale-post.js          (sale-auto.bat isi ko chalata rehta hai)
//            node sale-post.js --print 00115120   (POS ki kisi bhi sale ki rasid, kuch save nahi)
//  v1.6 (2026-09-21): GATE PASS — jis line ka godam bill ki branch se alag ho: (a) POS mein IsGetStore=1
//        (POS ka apna gate pass isi nishan se banta hai), (b) har godam ke liye alag "GATE PASS" thermal
//        rasid bhi chhapti hai (godam ka naam, bill no, customer, items CTN/PCS — rate nahi).
//  v1.5.1: tadad 3 decimal tak (sub-barcode 0.125 -> 0.13 nahi). Raqam 2 decimal.
//  v1.5 (2026-09-19): mulazim ki COUNTER sale POS jaisi — poore carton SaleRate (Cotton Rate / pack) se,
//        khule piece SaleRate2 ("Peice Rate", 0 ho to SaleRate) se; carton+piece wali line POS mein do lines.
//        Rasid (text/ESC-POS) waisi hi — v1.3 wali.
// ============================================================

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ---------------- SETTINGS ----------------
const BUSINESS_ID = 'noor-traders';
const CREATED_BY = 1;              // POS user: Administrator
const SALE_PERSON = 1;             // SPID
const WHOLESALE_NAME = 'whole sale';
const AUTO_PRINT = true;           // rasid script hi chhapti hai (PRINTER_NAME par, notepad ke baghair)
const PRINT_WIDTH = 32;
const PRINTER_NAME = 'TM-T88IV';   // Devices and Printers mein jo naam likha hai — ghalat ho to yahan theek karein
const LOCK_PORT = 47815;           // ek hi sale-post chale
const MARK = 'BK-APP ';            // Sale.Description mein nishan
// ------------------------------------------

const DIR = __dirname;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;   // v1.5.1: TADAD 3 decimal (0.125)
const clip = (s, n) => String(s ?? '').slice(0, n);

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };

if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const saleCol = db.collection('businesses').doc(BUSINESS_ID).collection('appSales');

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
  pool.on('error', e => { log('SQL masla: ' + e.message); pool = null; });
  return pool;
}

// ---- POS ki buniyadi cheezein (ek dafa) ----
let base = null;
async function basics(p) {
  if (base) return base;
  const d = (await p.request().query('SELECT TOP 1 DefCustomerID, CashACID FROM dbo.Defaults')).recordset[0] || {};
  const counter = (await p.request().input('id', sql.Int, d.DefCustomerID || 1)
    .query('SELECT PartyID, PartyName, AccountID FROM dbo.Party WHERE PartyID = @id')).recordset[0];
  let whole = [];
  const hasAllowed = (await p.request().query("SELECT OBJECT_ID('dbo.SaleAllowedParty') AS t")).recordset[0].t;
  if (hasAllowed) {
    whole = (await p.request().input('n', sql.VarChar(60), `%${WHOLESALE_NAME}%`).query(`SELECT p.PartyID, p.PartyName, p.AccountID
      FROM dbo.SaleAllowedParty a JOIN dbo.Party p ON p.PartyID = a.PartyID WHERE p.PartyName LIKE @n`)).recordset;
  }
  if (whole.length !== 1) {
    whole = (await p.request().input('n', sql.VarChar(60), `%${WHOLESALE_NAME}%`).query(`SELECT PartyID, PartyName, AccountID
      FROM dbo.Party WHERE PartyName LIKE @n`)).recordset;
  }
  if (!counter) throw new Error('COUNTER SALE party nahi mili');
  if (whole.length !== 1) throw new Error(`"${WHOLESALE_NAME}" party ${whole.length ? 'ek se zyada' : 'nahi'} mili: ` + whole.map(w => w.PartyName).join(', '));
  base = { counter, whole: whole[0], cashAc: d.CashACID || 11 };
  log(`Counter: ${counter.PartyName.trim()} [${counter.PartyID}] · Wholesale: ${base.whole.PartyName.trim()} [${base.whole.PartyID}] · Cash a/c ${base.cashAc}`);
  return base;
}

// ---- ek sale POS mein ----
async function postSale(s) {
  const p = await getPool();
  const B = await basics(p);
  const marker = MARK + s.id;

  // pehle ban chuki? (script beech mein band hui ho)
  const had = (await p.request().input('m', sql.VarChar(150), marker)
    .query('SELECT TOP 1 SaleID, SaleNo, TotalSale FROM dbo.Sale WHERE Description = @m AND DocStatusID <> 3')).recordset[0];
  if (had) {
    const crv = (await p.request().input('id', sql.Int, had.SaleID)
      .query("SELECT TOP 1 VoucherCode FROM dbo.Voucher WHERE DocumentType = 'CRV' AND DocumentNo = @id")).recordset[0];
    return { saleId: had.SaleID, saleNo: had.SaleNo, total: had.TotalSale, crvNo: crv?.VoucherCode || '', again: true };
  }

  const wholesale = s.mode === 'wholesale';
  const party = wholesale ? B.whole : B.counter;
  const godam = Number(s.godam) || 1, branch = Number(s.branch) || 1;
  const staff = s.role !== 'owner';

  // lines: POS se item + rate + cost — v1.2: SAB items EK sawal mein (tez)
  const want = (s.lines || []).filter(l => r3(l.qty) > 0).map(l => ({ id: Number(l.id), g: Number(l.godam) || godam }));
  const itemMap = new Map();
  if (want.length) {
    const ids = [...new Set(want.map(w => w.id))].filter(Number.isFinite), gs = [...new Set(want.map(w => w.g))];
    const rows = (await p.request().query(`
      SELECT i.ItemID, i.ItemName, i.PackQty, r.BranchID, r.SaleRate, r.SaleRate2, r.SaleRate3, r.SaleRateSize, r.PurchaseRate, r.CurrStock
      FROM dbo.Items i JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID
      WHERE i.ItemID IN (${ids.join(',')}) AND r.BranchID IN (${gs.join(',')})`)).recordset;
    rows.forEach(r => itemMap.set(r.ItemID + '|' + r.BranchID, r));
  }
  const lines = [];
  for (const l of s.lines || []) {
    const qty = r3(l.qty);
    if (!(qty > 0)) continue;
    const lg = Number(l.godam) || godam;
    const it = itemMap.get(Number(l.id) + '|' + lg);
    if (!it) throw new Error(`Item nahi mila: ${l.name} (${l.id}) godam ${lg}`);
    const posRate = wholesale ? (Number(it.SaleRate3) || Number(it.SaleRateSize) || Number(it.SaleRate) || 0) : (Number(it.SaleRate) || 0);
    if (Number(it.CurrStock) < qty) log(`  Stock kam: ${String(it.ItemName).trim()} (stock ${it.CurrStock}, sale ${qty})`);
    const base = { ItemID: it.ItemID, name: String(it.ItemName).trim(), cost: Number(it.PurchaseRate) || 0, godam: lg, pack: Number(it.PackQty) || 0 };
    if (staff && !wholesale) {
      // v1.5: POS ki Sale screen jaisa — poore carton "Cotton Rate" (SaleRate fi piece), khule piece "Peice Rate" (SaleRate2)
      const pk = Number(it.PackQty) || 0;
      const ctnRate = r2(Number(it.SaleRate) || 0), pcsRate = r2(Number(it.SaleRate2) || Number(it.SaleRate) || 0);
      // app v1.61 line ki ikai batati hai (unit 'ctn' / 'pcs'); purani app (unit nahi) -> pack se khud taqseem
      const cq = l.unit === 'ctn' ? qty : l.unit === 'pcs' ? 0 : (pk > 1 ? Math.floor(qty / pk + 1e-9) * pk : 0), pq = r3(qty - cq);
      if (cq > 0) lines.push({ ...base, qty: cq, rate: ctnRate });
      if (pq > 0) lines.push({ ...base, qty: pq, rate: pcsRate });
    } else {
      const rate = r2(staff ? posRate : (Number(l.rate) >= 0 ? Number(l.rate) : posRate));
      lines.push({ ...base, qty, rate });
    }
  }
  if (!lines.length) throw new Error('Bill mein koi item nahi');
  const total = r2(lines.reduce((n, l) => n + l.qty * l.rate, 0));
  const cogs = lines.reduce((n, l) => n + l.qty * l.cost, 0);
  const cash = wholesale ? r2(Math.min(Math.max(Number(s.cash) || 0, 0), total)) : total;
  if (staff && Math.abs(total - Number(s.total)) > 0.5) log(`  Mulazim ka total ${s.total} tha, POS rate se ${total}`);

  const now = new Date();
  const who = s.role === 'owner' ? 'Malik' : 'Mulazim';
  let notes = `Created & Printed By:Blue Khata app (${who}) On:${now.toLocaleString('en-US')} at PC:${os.hostname()}\r\n`;
  if (wholesale && cash > 0) notes += `Cash Received By:Blue Khata app (${who}) On:${now.toLocaleString('en-US')} at PC:${os.hostname()}\r\n`;

  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const sale = (await new sql.Request(tx)
      .input('SaleID', sql.Int, 0)
      .input('PartyID', sql.Int, party.PartyID)
      .input('BranchID', sql.Int, branch)
      .input('SaleNo', sql.VarChar(50), '')
      .input('SaleDate', sql.DateTime, now)
      .input('Description', sql.VarChar(150), marker)
      .input('CreatedBy', sql.Int, CREATED_BY)
      .input('CreatedOn', sql.DateTime, now)
      .input('UpdatedBy', sql.Int, 0)
      .input('UpdatedOn', sql.DateTime, null)
      .input('Remarks', sql.VarChar(150), clip(s.note ? `${party.PartyName.trim()} - ${s.note}` : party.PartyName, 150))
      .input('SystemNotes', sql.VarChar(sql.MAX), notes)
      .input('IsDiscPerc', sql.Bit, 0)
      .input('DiscountAmt', sql.Float, 0)
      .input('SaleDiscount', sql.Float, 0)
      .input('IsTaxPerc', sql.Bit, 1)
      .input('TaxAmount', sql.Float, 0)
      .input('SPID', sql.Int, SALE_PERSON)
      .input('SPCommPerc', sql.Float, 0)
      .input('SPCommAmt', sql.Float, 0)
      .input('CCNo', sql.VarChar(80), String(total))
      .input('MemoNo', sql.VarChar(50), '')
      .input('CashReceived', sql.Float, wholesale ? 0 : total)
      .input('TotalSale', sql.Float, total)
      .input('IsCreditSale', sql.Bit, wholesale ? 1 : 0)
      .input('IsCreditCardSale', sql.Bit, 0)
      .input('COGS', sql.Float, cogs)
      .input('ItemsDiscount', sql.Float, 0)
      .input('DocStatusID', sql.Int, 1)
      .input('ItemsTax', sql.Float, 0)
      .input('CancelAndNew', sql.Bit, 1)
      .input('SaleCustomerPhone', sql.VarChar(50), '')
      .input('DONo', sql.VarChar(50), '0')
      .input('Transport', sql.VarChar(50), '0')
      .input('BiltyNo', sql.VarChar(50), String(total))
      .input('BiltyDate', sql.DateTime, now)
      .input('DueDate', sql.DateTime, now)
      .input('IsOnlineSale', sql.Bit, 0)
      .input('vNetAmount', sql.Float, total)
      .input('IsCancleReturn', sql.Bit, 0)
      .input('SupplyManID', sql.Int, null)
      .execute('dbo.usp_Sale_InsertUpdate')).recordset[0];

    for (const l of lines) {
      await new sql.Request(tx)
        .input('SaleDetailID', sql.Int, 0)
        .input('SaleID', sql.Int, sale.SaleID)
        .input('ItemID', sql.Int, l.ItemID)
        .input('Qty', sql.Float, l.qty)
        .input('Rate', sql.Float, l.rate)
        .input('Discount', sql.VarChar(10), '0')
        .input('Tax', sql.VarChar(10), '0')
        .input('Cost', sql.Float, l.cost)
        .input('ItemIncentive', sql.Float, 0)
        .input('Bonus', sql.Float, 0)
        .input('IsGetStore', sql.Bit, (l.godam || godam) !== branch ? 1 : 0)   // v1.6: godam wali line par POS gate pass
        .input('TradeOffer', sql.Float, 0)
        .input('Cotton', sql.Int, 0)
        .input('Bardana', sql.Int, 0)
        .input('GQgy', sql.Float, 0)
        .input('GBranchID', sql.Int, l.godam || godam)
        .execute('dbo.usp_SaleDetail_InsertUpdate');
    }

    // Wholesale ka usi waqt mila cash: CRV (POS jaisa: Cash Dr / party Cr, DocumentNo = SaleID)
    let crvNo = '';
    if (wholesale && cash > 0) {
      const v = (await new sql.Request(tx)
        .input('VoucherID', sql.Int, 0).input('BranchID', sql.Int, branch)
        .input('VoucherCode', sql.VarChar(20), '').input('VoucherDate', sql.DateTime, now)
        .input('VoucherType', sql.VarChar(10), 'CRV').input('DocumentType', sql.VarChar(10), 'CRV')
        .input('DocumentNo', sql.Int, sale.SaleID).input('VoucherStatusID', sql.Int, 1)
        .input('VoucherDesc', sql.VarChar(500), '').input('CreatedOn', sql.DateTime, now)
        .input('CreatedBy', sql.Int, CREATED_BY).input('UpdatedOn', sql.DateTime, null)
        .input('UpdatedBy', sql.Int, null).input('PostedOn', sql.DateTime, now)
        .input('PostedBy', sql.Int, CREATED_BY).input('ChequeDate', sql.DateTime, now)
        .input('ChequeNo', sql.VarChar(20), '').input('VoucherRemarks', sql.VarChar(500), `Sale No: ${sale.SaleNo}`)
        .input('SystemNote', sql.VarChar(8000), notes)
        .input('PartyID', sql.Int, party.PartyID).input('IsPresented', sql.Bit, 0).input('YearID', sql.Int, null)
        .execute('dbo.usp_Voucher_InsertUpdate')).recordset[0];
      for (const [ac, dr, cr] of [[B.cashAc, cash, 0], [party.AccountID, 0, cash]]) {
        await new sql.Request(tx)
          .input('VoucherDetailID', sql.Int, 0).input('VoucherID', sql.Int, v.VoucherID).input('CostCenterID', sql.Int, 0)
          .input('AccountID', sql.Int, ac).input('Description', sql.VarChar(500), `Sale No: ${sale.SaleNo}`)
          .input('Debit', sql.Float, dr).input('Credit', sql.Float, cr)
          .execute('dbo.usp_VoucherDetail_InsertUpdate');
      }
      crvNo = v.VoucherCode || '';
    }
    await tx.commit();
    return { saleId: sale.SaleID, saleNo: sale.SaleNo, total, cash, crvNo, lines, branch, partyName: String(party.PartyName || '').trim() };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

// ---- Rasid (POS se parh kar — kuch save nahi hota) ----
// ---- Rasid (POS jaisi): naam, barcode, jadwal, total, cash, balance, neeche shop ki lines ----
const SHOP = {
  name: 'NOOR TRADERS',
  phone: '03450412515',
  lines: [
    'Agar hamare bill mein koi cheez aap ke ghar nahi',
    'pohanchi ya koi bhi maslaha ho to is number par',
    'rabta karein: 03450412515 Sami Ullah',
    '',
    'Bank HBL',
    'IBAN: PK90HABB0002577900846303',
    'Accounts title: Noor Traders',
    '',
    'Saman nikalwane ya home delivery ke liye list',
    'WhatsApp karein. Delivery/packing time 3 to 5 ghante.'
  ]
};

async function receiptFor(saleNo, saleId) {
  const p = await getPool();
  const req = p.request();
  const head = (await (saleId ? req.input('id', sql.Int, saleId).query(`SELECT s.*, pt.PartyName, pt.Address1 AS PartyArea FROM dbo.Sale s
      LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE s.SaleID = @id`)
    : req.input('n', sql.VarChar(50), saleNo).query(`SELECT TOP 1 s.*, pt.PartyName, pt.Address1 AS PartyArea FROM dbo.Sale s
      LEFT JOIN dbo.Party pt ON pt.PartyID = s.PartyID WHERE LTRIM(RTRIM(s.SaleNo)) = @n AND s.DocStatusID <> 3 ORDER BY s.SaleID DESC`))).recordset[0];
  if (!head) throw new Error('Sale nahi mili: ' + (saleNo || saleId));
  const lines = (await p.request().input('id', sql.Int, head.SaleID).query(`SELECT d.Qty, d.Rate, d.Bonus, i.ItemName, i.PackQty
    FROM dbo.SaleDetail d JOIN dbo.Items i ON i.ItemID = d.ItemID WHERE d.SaleID = @id ORDER BY d.SaleDetailID`)).recordset;
  const crv = (await p.request().input('id', sql.Int, head.SaleID).query(`SELECT SUM(vd.Debit) AS cash FROM dbo.Voucher v
    JOIN dbo.VoucherDetail vd ON vd.VoucherID = v.VoucherID WHERE v.DocumentType = 'CRV' AND v.DocumentNo = @id`)).recordset[0];

  const W = PRINT_WIDTH;
  const n = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const n3 = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });   // v1.5.1: tadad
  const pad = (t, w, right) => { t = String(t ?? ''); if (t.length > w) t = t.slice(0, w); return right ? t.padStart(w) : t.padEnd(w); };
  const line = (l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, W - l.length - r.length))).slice(0, W - r.length) + r; };
  const center = t => { t = String(t).slice(0, W); return ' '.repeat(Math.max(0, Math.floor((W - t.length) / 2))) + t; };
  const hr = '-'.repeat(W);

  // ESC/POS: barcode (CODE128) + bara/chhota text
  const ESC = '\x1b', GS = '\x1d';
  const big = t => ESC + '!' + '\x30' + t + ESC + '!' + '\x00';        // double height+width
  const bold = t => ESC + 'E' + '\x01' + t + ESC + 'E' + '\x00';
  const barcode = code => {
    const c = String(code || '').trim();
    if (!c) return '';
    return GS + 'h' + '\x50' + GS + 'w' + '\x02' + GS + 'H' + '\x02' + GS + 'k' + '\x49' + String.fromCharCode(c.length + 2) + '{B' + c + '\n';
  };

  const total = Number(head.TotalSale) || 0;
  const cash = head.IsCreditSale ? (Number(crv?.cash) || 0) : (Number(head.CashReceived) || 0);
  const out = [];
  out.push(ESC + '@');                                   // reset
  out.push(ESC + 'a' + '\x01');                          // center
  out.push(big(SHOP.name));
  out.push(SHOP.phone);
  out.push(ESC + 'a' + '\x00');                          // left
  out.push(hr);
  out.push(line('Sale No: ' + String(head.SaleNo || '').trim(), new Date(head.SaleDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })));
  out.push(ESC + 'a' + '\x01');
  out.push(barcode(String(head.SaleNo || '').trim()));
  out.push(ESC + 'a' + '\x00');
  out.push('Customer: ' + String(head.PartyName || '').trim());
  if (head.PartyArea && String(head.PartyArea).trim()) out.push(String(head.PartyArea).trim());
  out.push(hr);
  out.push(bold(pad('Items', 14) + pad('PCS', 4, true) + pad('CTN', 4, true) + pad('Rate', 9, true)));
  out.push(hr);
  let pcsSum = 0, ctnSum = 0;
  for (const l of lines) {
    const pack = Number(l.PackQty) || 0, qty = Number(l.Qty) || 0;
    const ctn = pack > 1 ? Math.floor(qty / pack) : 0;
    const pcs = pack > 1 ? r3(qty - ctn * pack) : qty;
    pcsSum += pcs; ctnSum += ctn;
    const amt = Math.round(qty * Number(l.Rate) * 100) / 100;
    out.push(String(l.ItemName || '').trim().slice(0, W));
    out.push(pad('', 1) + pad(n3(pcs), 6, true) + pad(n(ctn), 5, true) + pad(n(l.Rate), 9, true) + pad(n(amt), 10, true));
  }
  out.push(hr);
  out.push(line('Total (PCS ' + n3(r3(pcsSum)) + ' / CTN ' + n(ctnSum) + ')', ''));
  out.push(ESC + 'a' + '\x02');                          // right
  out.push(big('Rs.' + n(total)));
  out.push(ESC + 'a' + '\x00');
  out.push(line('Cash Received:', 'Rs.' + n(cash)));
  out.push(line(head.IsCreditSale ? 'Balance (Udhaar):' : 'Balance:', 'Rs.' + n(Math.round((total - cash) * 100) / 100)));
  out.push(hr);
  for (const t of SHOP.lines) out.push(t);
  out.push('', '', '');
  out.push(GS + 'V' + '\x42' + '\x00');                  // paper cut
  return out.join('\r\n');
}

// RAW print: ESC/POS bytes seedha printer ko (barcode/bara text chalta hai)
function printText(text) {
  const file = path.join(DIR, 'sale-print.bin');
  fs.writeFileSync(file, Buffer.from(text, 'binary'));
  const ps = `
$ErrorActionPreference='Stop'
$name='${PRINTER_NAME.replace(/'/g, "''")}'
$bytes=[System.IO.File]::ReadAllBytes('${file.replace(/'/g, "''")}')
Add-Type -TypeDefinition @"
using System;using System.IO;using System.Runtime.InteropServices;
public class RawP{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DI{[MarshalAs(UnmanagedType.LPWStr)]public string n;[MarshalAs(UnmanagedType.LPWStr)]public string o;[MarshalAs(UnmanagedType.LPWStr)]public string t;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);
 [DllImport("winspool.Drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h,int l,ref DI di);
 [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
 public static void Send(string printer,byte[] data){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new Exception("printer nahi mila: "+printer);
  DI di=new DI();di.n="Rasid";di.t="RAW";StartDocPrinter(h,1,ref di);StartPagePrinter(h);
  IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);int w;WritePrinter(h,p,data.Length,out w);
  Marshal.FreeCoTaskMem(p);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);}
}
"@
[RawP]::Send($name,$bytes)
`;
  const psFile = path.join(DIR, 'raw-print.ps1');
  fs.writeFileSync(psFile, ps);
  return new Promise(res => {
    require('child_process').execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
      { timeout: 20000 }, err => res(err));
  });
}
// ---- v1.6: GATE PASS (godam ke liye alag rasid — rate NAHI likha jata) ----
function gatePassText(godamName, rows, saleNo, partyName, when) {
  const ESC = '\x1b', GS = '\x1d', W = PRINT_WIDTH;
  const n = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const n3 = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });
  const pad = (t, w, right) => { t = String(t ?? ''); if (t.length > w) t = t.slice(0, w); return right ? t.padStart(w) : t.padEnd(w); };
  const line = (l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, W - l.length - r.length))).slice(0, W - r.length) + r; };
  const hr = '-'.repeat(W);
  const big = t => ESC + '!' + '\x30' + t + ESC + '!' + '\x00';
  const bold = t => ESC + 'E' + '\x01' + t + ESC + 'E' + '\x00';
  const barcode = code => { const c = String(code || '').trim(); if (!c) return '';
    return GS + 'h' + '\x50' + GS + 'w' + '\x02' + GS + 'H' + '\x02' + GS + 'k' + '\x49' + String.fromCharCode(c.length + 2) + '{B' + c + '\n'; };
  const r3v = v => Math.round((Number(v) || 0) * 1000) / 1000;
  const out = [];
  out.push(ESC + '@');
  out.push(ESC + 'a' + '\x01');
  out.push(big('GATE PASS'));
  out.push(big(String(godamName || '').trim()));
  out.push(ESC + 'a' + '\x00');
  out.push(hr);
  out.push(bold('Sale No: ' + String(saleNo || '').trim()));
  out.push(when.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }));
  out.push(ESC + 'a' + '\x01');
  out.push(barcode(String(saleNo || '').trim()));
  out.push(ESC + 'a' + '\x00');
  out.push('Customer: ' + String(partyName || '').trim());
  out.push(hr);
  out.push(bold(pad('Items', W - 12) + pad('CTN', 5, true) + pad('PCS', 7, true)));
  out.push(hr);
  let pcsSum = 0, ctnSum = 0;
  // ek item ki carton/piece wali do lines jama kar ke ek qatar
  const byItem = new Map();
  for (const l of rows) { const k = l.ItemID; const o = byItem.get(k) || { name: l.name, pack: l.pack, qty: 0 }; o.qty = r3v(o.qty + l.qty); byItem.set(k, o); }
  for (const o of byItem.values()) {
    const pack = Number(o.pack) || 0, qty = o.qty;
    const ctn = pack > 1 ? Math.floor(qty / pack + 1e-9) : 0;
    const pcs = pack > 1 ? r3v(qty - ctn * pack) : qty;
    pcsSum = r3v(pcsSum + pcs); ctnSum += ctn;
    out.push(String(o.name || '').trim().slice(0, W));
    out.push(pad('', W - 12) + pad(n(ctn), 5, true) + pad(n3(pcs), 7, true));
  }
  out.push(hr);
  out.push(bold(line('Total', 'CTN ' + n(ctnSum) + ' / PCS ' + n3(pcsSum))));
  out.push(hr);
  out.push('Dene wale ke dastakhat: ________');
  out.push('', '', '');
  out.push(GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}
async function printGatePasses(r) {
  if (!AUTO_PRINT || !Array.isArray(r.lines)) return;
  const gp = r.lines.filter(l => Number(l.godam) && Number(l.godam) !== Number(r.branch));
  if (!gp.length) return;
  const p = await getPool();
  const names = {};
  (await p.request().query('SELECT BranchID, BranchName FROM dbo.Branch')).recordset
    .forEach(x => { names[x.BranchID] = String(x.BranchName || '').trim(); });
  const godams = [...new Set(gp.map(l => Number(l.godam)))];
  const when = new Date();
  for (const g of godams) {
    const err = await printText(gatePassText(names[g] || ('Godam ' + g), gp.filter(l => Number(l.godam) === g), r.saleNo, r.partyName, when));
    log(err ? 'Gate pass print nahi hua (' + (names[g] || g) + '): ' + err.message : 'GATE PASS print: ' + (names[g] || g) + ' · Sale ' + r.saleNo);
  }
}
async function printSale(saleNo, saleId) {
  if (!AUTO_PRINT) return;
  const err = await printText(await receiptFor(saleNo, saleId));
  log(err ? 'Print nahi hua: ' + err.message : 'Rasid print: Sale ' + saleNo);
}

// ---- Firestore se kaam ----
const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => log('Masla: ' + e.message)); };

async function handleSale(doc) {
  const id = doc.id;
  if (busy.has(id)) return;
  busy.add(id);
  try {
    const ref = saleCol.doc(id);
    const ok = await db.runTransaction(async t => {
      const cur = (await t.get(ref)).data();
      if (!cur || !['new', 'posting'].includes(cur.status)) return null;
      t.update(ref, { status: 'posting', postingAt: Date.now(), pc: os.hostname() });
      return cur;
    });
    if (!ok) return;
    try {
      const r = await postSale({ ...ok, id });
      await ref.update({ status: 'done', saleNo: r.saleNo, saleId: r.saleId, crvNo: r.crvNo || '', total: r.total,
        ...(r.cash != null ? { cash: r.cash } : {}), doneAt: Date.now(), error: FieldValue.delete() });
      log(`${r.again ? 'Pehle se bani thi' : 'Sale ban gayi'}: ${r.saleNo} · ${ok.mode} · Rs ${r.total}${r.crvNo ? ' · ' + r.crvNo : ''}`);
      if (!r.again) {
        await printSale(r.saleNo, r.saleId).catch(e => log('Print masla: ' + e.message));
        await printGatePasses(r).catch(e => log('Gate pass masla: ' + e.message));
      }
    } catch (e) {
      log(`Sale NAHI bani (${id}): ${e.message}`);
      await ref.update({ status: 'failed', error: clip(e.message, 300), doneAt: Date.now() }).catch(() => {});
    }
  } finally { busy.delete(id); }
}

async function handlePrint(doc) {
  const d = doc.data();
  const key = 'p' + doc.id;
  if (busy.has(key)) return;
  busy.add(key);
  try {
    if (d.status === 'done' && d.saleNo) await printSale(d.saleNo, d.saleId);
    await doc.ref.update({ printReq: FieldValue.delete(), printedAt: Date.now() });
  } catch (e) { log('Dobara print masla: ' + e.message); }
  finally { busy.delete(key); }
}

function listen() {
  const fail = name => e => { log(`${name} listener toot gaya: ${e.message} — band, bat 30 second mein dobara chalayega`); process.exit(1); };
  saleCol.where('status', 'in', ['new', 'posting']).onSnapshot(s => {
    s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handleSale(c.doc)); });
  }, fail('Sale'));
  saleCol.where('printReq', '>', 0).onSnapshot(s => {
    s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => handlePrint(c.doc)); });
  }, fail('Print'));
}

// ---- shuru ----
if (process.argv.includes('--print')) {
  const no = process.argv[process.argv.indexOf('--print') + 1];
  printSale(no).then(() => process.exit(0)).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
} else {
  const lock = net.createServer();
  lock.once('error', () => { console.log('sale-post pehle se chal raha hai.'); process.exit(3); });
  lock.listen(LOCK_PORT, '127.0.0.1', async () => {
    try {
      await basics(await getPool());
      log('sale-post v1.5.1 chal raha hai — app ki sale ka intezar. Band: Ctrl+C');
      listen();
    } catch (e) { log('Shuru nahi hua: ' + e.message); process.exit(1); }
  });
}
