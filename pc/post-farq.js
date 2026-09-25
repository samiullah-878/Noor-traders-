// post-farq.js — stock ginti ka farq POS mein darj karta hai: KAM nikla = udhaar Sale, ZYADA nikla = usi Sale se jura Return.
// Bill POS ke apne procedures se banta hai (usp_Sale_InsertUpdate, usp_SaleReturn_InsertUpdate),
// is liye bilkul waisa hi banta hai jaise POS ki Sale screen se.
//
// Do tareeqe:
//   node post-farq.js          -> list yahan PC par, "haan" likhne par bill
//   node post-farq.js --auto   -> khud chalta rehta hai: list MOBILE app par jati hai,
//                                 malik app mein "Bill banao" dabaye to PC khud bill bana deta hai
//                                 (farq-auto.vbs isi ko chupke se chalata hai)

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ---------------- SETTINGS ----------------
const PARTY_NAME = 'stock fraq';   // POS ka account — naam mein "stock" ke baad "fraq" ya "farq" ho, quotes/space se farq nahi parta
const RATE_MODE = 'cost';          // 'cost' = bill khareed ke bhao par (koi munafa nahi) · 'sale' = sale ke bhao par
const CREATED_BY = 1;              // POS user: 1 = Administrator
const SALE_PERSON = 1;             // SPID
const BUSINESS_ID = 'noor-traders';
const AUTO_PRINT = true;           // rasid script hi chhapti hai (PRINTER_NAME par, notepad ke baghair)
const PRINT_WIDTH = 32;            // rasid ki chaurai (akshar ek line mein) — lines tooten to kam karein
const PRINTER_NAME = 'TM-T88IV';   // Devices and Printers mein jo naam likha hai — ghalat ho to yahan theek karein
// ------------------------------------------

const DIR = __dirname;
const LOCAL_LOG = path.join(DIR, 'posted-farq.json');
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const round3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const pad = (s, n) => String(s).slice(0, n).padEnd(n);

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
// POS apne PC ke waqt (Pakistan) par tareekh rakhta hai — UTC mein mat likho
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };

if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const countCol = db.collection('businesses').doc(BUSINESS_ID).collection('stockCount');

const ask = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => { rl.close(); res(String(a || '').trim().toLowerCase()); });
});
const readLocal = () => { try { return JSON.parse(fs.readFileSync(LOCAL_LOG, 'utf8')); } catch { return {}; } };
const writeLocal = v => fs.writeFileSync(LOCAL_LOG, JSON.stringify(v, null, 1));


const AUTO = process.argv.includes('--auto');
const POLL_SECONDS = 20;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);


// ---- Item pehchano (ID + naam, warna sirf naam) ----
const PICK = `SELECT i.ItemID, i.ItemCode, i.ItemName, r.PurchaseRate AS Cost, r.SaleRate, r.CurrStock
  FROM dbo.Items i JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID AND r.BranchID = @b`;
async function findItem(pool, c, branch) {
  if (Number.isFinite(Number(c.itemId))) {
    const byId = (await pool.request().input('id', Number(c.itemId)).input('b', branch)
      .query(PICK + ' WHERE i.ItemID = @id')).recordset[0];
    if (byId && norm(byId.ItemName) === norm(c.name)) return byId;
  }
  const byName = (await pool.request().input('n', String(c.name || '').trim()).input('b', branch)
    .query(PICK + ' WHERE LTRIM(RTRIM(i.ItemName)) = @n')).recordset;
  return byName.length === 1 ? byName[0] : null;
}

// ---- Ginti ke waqt POS ka stock ----
// abhi ka stock  -  ginti ke BAAD aaya maal  +  ginti ke BAAD gaya maal
async function stockAt(pool, it, branch, c) {
  if (!c.at) return Number(c.sys) || 0;
  const r = (await pool.request()
    .input('id', sql.Int, it.ItemID).input('b', sql.Int, branch)
    .input('t', sql.DateTime, new Date(Number(c.at)))
    .query(`SELECT ISNULL(SUM(QtyIn),0) AS qi, ISNULL(SUM(QtyOut),0) AS qo
      FROM dbo.StockLedger WHERE ItemID = @id AND BranchID = @b AND LedgerDate > @t`)).recordset[0];
  return round3(Number(it.CurrStock || 0) - Number(r.qi) + Number(r.qo));
}

// ---- _round aur _post: LISTENER (v10). Pehle har 20 second get() hota tha = roz ~8,600 reads ----
let ctlRound;          // undefined = listener ka pehla jawab abhi nahi aaya
let ctlPost;           // _post ka aakhri snapshot
let kickFarq = null;   // _post badla -> foran tick
const listenFail = name => e => {
  log(`${name} listener toot gaya: ${e.message} — script band, bat 30 second mein dobara chalayega`);
  process.exit(1);
};
function watchCtl() {
  countCol.doc('_round').onSnapshot(d => { ctlRound = d.exists ? (d.data().round || '') : ''; }, listenFail('_round'));
  countCol.doc('_post').onSnapshot(d => {
    const first = ctlPost === undefined;
    ctlPost = d;
    if (!first && kickFarq) kickFarq();
  }, listenFail('_post'));
}

// ---- App ki PDF ke liye: har gini hui cheez par "sysPos" likh do ----
let lastRound = '';
// Ginti ki list LISTENER se: har 20 second poori list parhne ke bajaye sirf badli hui cheez aati hai
let roundUnsub = null, roundDocs = new Map();
function watchRound(round) {
  if (round === lastRound && roundUnsub) return;
  if (roundUnsub) { try { roundUnsub(); } catch {} }
  lastRound = round; roundDocs = new Map();
  roundUnsub = countCol.where('round', '==', round).onSnapshot(s => {
    s.docChanges().forEach(c => {
      if (c.type === 'removed') roundDocs.delete(c.doc.id); else roundDocs.set(c.doc.id, c.doc);
    });
  }, e => { log('Ginti listener masla: ' + e.message); roundUnsub = null; });
}
async function fillSysPos(pool) {
  let round = ctlRound;
  if (round === undefined) {   // listener abhi tayyar nahi (sirf shuru mein)
    const rd = await countCol.doc('_round').get();
    round = rd.exists ? rd.data().round : '';
  }
  if (!round) return;
  watchRound(round);
  let n = 0;
  for (const d of [...roundDocs.values()]) {
    const c = d.data();
    if (!c.at || c.sysPosAt === c.at || String(d.id).startsWith('_')) continue;
    const it = await findItem(pool, c, c.branch);
    if (!it) continue;
    const sysPos = await stockAt(pool, it, c.branch, c);
    await d.ref.set({ sysPos, sysPosAt: c.at }, { merge: true });
    n++;
  }
  if (n) log(`${n} ginti par POS ka us waqt ka stock likha`);
}

// ---- App ke hukam ki list banao (SQL mein kuch nahi likhta) ----
async function buildList(pool, req) {
  const { round, branch } = req;
  const postedKey = `_posted-${round}-${branch}`;
  const postedDoc = await countCol.doc(postedKey).get();
  const already = { ...(readLocal()[postedKey] || {}), ...(postedDoc.exists ? postedDoc.data().items || {} : {}) };

  const snap = await countCol.where('round', '==', round).get();
  const hidDoc = await countCol.doc('_hidden').get();
  const hidden = hidDoc.exists ? hidDoc.data().items || {} : {};
  const counts = snap.docs.map(d => d.data()).filter(c => c.branch === branch);

  const party = (await pool.request()
    .query(`SELECT PartyID, PartyName, AccountID FROM dbo.Party
      WHERE (LOWER(PartyName) LIKE '%stock%fraq%' OR LOWER(PartyName) LIKE '%stock%farq%')`)).recordset;
  if (party.length !== 1) {
    return { error: `POS mein "${PARTY_NAME}" naam ka ${party.length ? 'ek se zyada' : 'koi'} account mila` };
  }
  const P = party[0];

    const kam = [], zyada = [], skipped = [];
    for (const c of counts) {
      if (hidden[String(c.itemId)]) { skipped.push({ name: c.name, why: 'band item (safai ho chuki)' }); continue; }
      const it = await findItem(pool, c, branch);
      if (!it) {
        const d0 = round3(Number(c.total) - Number(c.sys));
        if (Math.abs(d0) >= 0.001) skipped.push({ name: c.name, why: 'POS mein yeh item pakka nahi pehchana gaya' });
        continue;
      }
      // Ginti ke lamhe ka asal stock (POS ledger se) — sync ki deri aur baad ki sale ka asar khatam
      const sysAt = await stockAt(pool, it, branch, c);
      const diff = round3(Number(c.total) - sysAt);
      if (Math.abs(diff) < 0.001) continue;
      const cost = Number(it.Cost) || 0;
      const rate = RATE_MODE === 'sale' ? (Number(it.SaleRate) || 0) : cost;
      // kam nikla = sale (key: ItemID) · zyada nikla = return (key: R + ItemID)
      const key = diff < 0 ? String(it.ItemID) : 'R' + it.ItemID;
      const qty = round3(Math.abs(diff) - (Number(already[key]) || 0));
      if (qty < 0.001) continue;
      const row = { ...it, key, qty, cost, rate, sys: sysAt, count: Number(c.total), amount: round2(qty * rate), cogs: round2(qty * cost) };
      (diff < 0 ? kam : zyada).push(row);
    }


  const sum = (list, f) => round2(list.reduce((s, k) => s + k[f], 0));
  const saleTotal = sum(kam, 'amount'), saleCogs = sum(kam, 'cogs');
  const retTotal = sum(zyada, 'amount'), retCogs = sum(zyada, 'cogs');
  return { P, round, branch, postedKey, already, kam, zyada, skipped,
    saleTotal, saleCogs, retTotal, retCogs, net: round2(saleTotal - retTotal) };
}

// Mobile par dikhane ke liye chhoti shakal
const brief = L => ({
  party: L.P.PartyName,
  kam: L.kam.map(k => ({ id: k.key, name: k.ItemName, sys: k.sys, count: k.count, qty: k.qty, rate: round2(k.rate), amount: k.amount })),
  zyada: L.zyada.map(k => ({ id: k.key, name: k.ItemName, sys: k.sys, count: k.count, qty: k.qty, rate: round2(k.rate), amount: k.amount })),
  skipped: L.skipped,
  kamRs: L.saleTotal, zyadaRs: L.retTotal, total: L.net
});
const sig = L => [...L.kam, ...L.zyada].map(k => `${k.key}:${k.qty}:${round2(k.rate)}`).sort().join('|');

function printList(L) {
  console.log(`\nGinti: ${L.round} · Branch ${L.branch} · Account: ${L.P.PartyName}\n`);
  const show = (title, list) => {
    if (!list.length) return;
    console.log(title);
    console.log(pad('Item', 32) + pad('Qty', 10) + pad('Bhao', 12) + 'Raqam');
    console.log('-'.repeat(66));
    list.forEach(k => console.log(pad(k.ItemName, 32) + pad(k.qty, 10) + pad(round2(k.rate), 12) + k.amount
      + (k.cost ? '' : '   <-- Cost nahi')));
    console.log('');
  };
  show('KAM nikle (Sale — stock kam hoga):', L.kam);
  show('ZYADA nikle (Return — stock barhega):', L.zyada);
  console.log('-'.repeat(66));
  console.log(`Kam: Rs ${L.saleTotal} (${L.kam.length} items) · Zyada: Rs ${L.retTotal} (${L.zyada.length} items)`);
  console.log(`Kul farq: Rs ${L.net}  ("${L.P.PartyName}" ke khate mein)\n`);
  if (L.skipped.length) {
    console.log('Yeh items chhor diye:');
    L.skipped.forEach(s => console.log('  ' + s.name + ' — ' + s.why));
    console.log('');
  }
}

// ---- POS mein bill banao (sab ya kuch nahi) ----
async function createBill(pool, L) {
  const { P, round, branch, kam, zyada, saleTotal, saleCogs, retTotal, retCogs } = L;
  const net = L.net;
  const now = new Date();
  const note = `Created By:Administrator On:${now.toLocaleString('en-US')} at PC:${os.hostname()} (stock ginti ${round})\r\n`;
  const desc = `Stock ginti farq ${round}`;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let saleNo = '', returnNo = '';
  try {
      // 1) Sale (POS ki tarah: kam wali lines; TotalSale = kul farq)
      const s = await new sql.Request(tx)
        .input('SaleID', sql.Int, 0)
        .input('PartyID', sql.Int, P.PartyID)
        .input('BranchID', sql.Int, branch)
        .input('SaleNo', sql.VarChar(50), '')
        .input('SaleDate', sql.DateTime, now)
        .input('Description', sql.VarChar(150), desc)
        .input('CreatedBy', sql.Int, CREATED_BY)
        .input('CreatedOn', sql.DateTime, now)
        .input('UpdatedBy', sql.Int, 0)
        .input('UpdatedOn', sql.DateTime, null)
        .input('Remarks', sql.VarChar(150), P.PartyName)
        .input('SystemNotes', sql.VarChar(sql.MAX), note)
        .input('IsDiscPerc', sql.Bit, 1)
        .input('DiscountAmt', sql.Float, 0)
        .input('SaleDiscount', sql.Float, 0)
        .input('IsTaxPerc', sql.Bit, 1)
        .input('TaxAmount', sql.Float, 0)
        .input('SPID', sql.Int, SALE_PERSON)
        .input('SPCommPerc', sql.Float, 0)
        .input('SPCommAmt', sql.Float, 0)
        .input('CCNo', sql.VarChar(80), String(saleTotal))
        .input('MemoNo', sql.VarChar(50), '')
        .input('CashReceived', sql.Float, 0)
        .input('TotalSale', sql.Float, net)
        .input('IsCreditSale', sql.Bit, 1)
        .input('IsCreditCardSale', sql.Bit, 0)
        .input('COGS', sql.Float, saleCogs)
        .input('ItemsDiscount', sql.Float, 0)
        .input('DocStatusID', sql.Int, 1)
        .input('ItemsTax', sql.Float, 0)
        .input('CancelAndNew', sql.Bit, 1)
        .input('SaleCustomerPhone', sql.VarChar(50), '')
        .input('DONo', sql.VarChar(50), '0')
        .input('Transport', sql.VarChar(50), '0')
        .input('BiltyNo', sql.VarChar(50), zyada.length ? '0' : String(saleTotal))
        .input('BiltyDate', sql.DateTime, now)
        .input('DueDate', sql.DateTime, now)
        .input('IsOnlineSale', sql.Bit, 0)
        .input('vNetAmount', sql.Float, saleTotal)
        .input('IsCancleReturn', sql.Bit, 0)
        .input('SupplyManID', sql.Int, null)
        .execute('dbo.usp_Sale_InsertUpdate');
      const sale = s.recordset[0];
      saleNo = sale.SaleNo;

      for (const k of kam) {
        await new sql.Request(tx)
          .input('SaleDetailID', sql.Int, 0)
          .input('SaleID', sql.Int, sale.SaleID)
          .input('ItemID', sql.Int, k.ItemID)
          .input('Qty', sql.Float, k.qty)
          .input('Rate', sql.Float, k.rate)
          .input('Discount', sql.VarChar(10), '0')
          .input('Tax', sql.VarChar(10), '0')
          .input('Cost', sql.Float, k.cost)
          .input('ItemIncentive', sql.Float, 0)
          .input('Bonus', sql.Float, 0)
          .input('IsGetStore', sql.Bit, 0)
          .input('TradeOffer', sql.Float, 0)
          .input('Cotton', sql.Int, 0)
          .input('Bardana', sql.Int, 0)
          .input('GQgy', sql.Float, 0)
          .input('GBranchID', sql.Int, branch)
          .execute('dbo.usp_SaleDetail_InsertUpdate');
      }

      // 2) Isi Sale se jura Return (zyada wali lines) — POS minus lines ko aise hi save karta hai
      if (zyada.length) {
        const r = await new sql.Request(tx)
          .input('SaleReturnID', sql.Int, 0)
          .input('PartyID', sql.Int, P.PartyID)
          .input('BranchID', sql.Int, branch)
          .input('SaleID', sql.Int, sale.SaleID)
          .input('SaleReturnNo', sql.VarChar(50), '')
          .input('SaleReturnDate', sql.DateTime, now)
          .input('Description', sql.VarChar(150), desc)
          .input('CreatedBy', sql.Int, CREATED_BY)
          .input('CreatedOn', sql.DateTime, now)
          .input('UpdatedBy', sql.Int, 0)
          .input('UpdatedOn', sql.DateTime, null)
          .input('Remarks', sql.VarChar(150), P.PartyName)
          .input('SystemNotes', sql.VarChar(1000), note)
          .input('IsDiscPerc', sql.Bit, 0)
          .input('DiscountAmt', sql.Float, 0)
          .input('IsTaxPerc', sql.Bit, 0)
          .input('TaxAmount', sql.Float, 0)
          .input('TotalSaleReturn', sql.Float, retTotal)
          .input('COGS', sql.Float, retCogs)
          .input('SPID', sql.Int, null)
          .input('SPCommPerc', sql.Float, 0)
          .input('SPCommAmt', sql.Float, 0)
          .input('ItemsDiscount', sql.Float, 0)
          .input('DocStatusID', sql.Int, 1)
          .input('ItemsTax', sql.Float, 0)
          .input('DONo', sql.VarChar(50), '')
          .input('Transport', sql.VarChar(50), '')
          .input('BiltyNo', sql.VarChar(50), '')
          .input('BiltyDate', sql.DateTime, now)
          .input('SaleReturnDiscount', sql.Float, 0)
          .input('IsCreditRturn', sql.Bit, 1)
          .input('SupplyManID', sql.Int, null)
          .execute('dbo.usp_SaleReturn_InsertUpdate');
        const ret = r.recordset[0];
        returnNo = ret.SaleReturnNo;

        for (const k of zyada) {
          await new sql.Request(tx)
            .input('SaleReturnDetailID', sql.Int, 0)
            .input('SaleReturnID', sql.Int, ret.SaleReturnID)
            .input('ItemID', sql.Int, k.ItemID)
            .input('Qty', sql.Float, k.qty)
            .input('Rate', sql.Float, k.rate)
            .input('Discount', sql.VarChar(10), '0')
            .input('Tax', sql.VarChar(10), '0')
            .input('ItemIncentive', sql.Float, 0)
            .input('SaleReturnRate', sql.Float, k.cost)
            .input('Bonus', sql.Float, 0)
            .input('TradeOffer', sql.Float, 0)
            .input('Cotton', sql.Int, 0)
            .input('Bardana', sql.Int, 0)
            .input('GQgy', sql.Float, 0)
            .input('GBranchID', sql.Int, branch)
            .execute('dbo.usp_SaleReturnDetail_InsertUpdate');
        }
      }
      await tx.commit();
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }

  // Kitna bill mein chala gaya, yaad rakhein (dobara na jaye)
  const items = { ...L.already };
  [...kam, ...zyada].forEach(k => { items[k.key] = round3((Number(items[k.key]) || 0) + k.qty); });
  const local = readLocal(); local[L.postedKey] = items; writeLocal(local);
  await countCol.doc(L.postedKey).set({ round, branch, items, updatedAt: Date.now() }, { merge: true });
  return { saleNo, returnNo };
}

// ---- Bill ki history app ke liye ----
async function saveHistory(L, r) {
  const v = brief(L);
  const doc = {
    round: L.round, branch: L.branch, saleNo: r.saleNo || '', returnNo: r.returnNo || '',
    party: v.party, kam: v.kam, zyada: v.zyada, kamRs: v.kamRs, zyadaRs: v.zyadaRs, total: v.total,
    lines: L.kam.length + L.zyada.length, doneAt: Date.now()
  };
  await countCol.doc('_bill-' + (r.saleNo || Date.now())).set(doc);
  return doc;
}

// ---- Rasid print ----
function receiptText(b) {
  const W = PRINT_WIDTH;
  const n = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const line = (l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, W - l.length - r.length))).slice(0, W - r.length) + r; };
  const center = t => { t = String(t).slice(0, W); return ' '.repeat(Math.floor((W - t.length) / 2)) + t; };
  const hr = '-'.repeat(W);
  const ESC = '\x1b', GS = '\x1d';
  const big = t => ESC + '!' + '\x30' + t + ESC + '!' + '\x00';
  const barcode = code => { const c = String(code || '').trim(); if (!c) return '';
    return GS + 'h' + '\x50' + GS + 'w' + '\x02' + GS + 'H' + '\x02' + GS + 'k' + '\x49' + String.fromCharCode(c.length + 2) + '{B' + c + '\n'; };
  const out = [ESC + '@', ESC + 'a' + '\x01', big('NOOR TRADERS'), 'STOCK GINTI FARQ', ESC + 'a' + '\x00', hr,
    line('Sale No:', b.saleNo || '-')];
  if (b.saleNo) { out.push(ESC + 'a' + '\x01', barcode(String(b.saleNo).trim()), ESC + 'a' + '\x00'); }
  if (b.returnNo) out.push(line('Return No:', b.returnNo));
  out.push(line('Tareekh:', new Date(b.doneAt || Date.now()).toLocaleString('en-GB')));
  out.push(line('Ginti:', b.round || ''));
  out.push(line('Account:', String(b.party || '').replace(/["']/g, '')));
  const section = (title, list, sign) => {
    if (!list || !list.length) return;
    out.push(hr, title, hr);
    list.forEach(x => {
      out.push(String(x.name).slice(0, W));
      out.push(line(`  ${sign}${n(x.qty)} x ${n(x.rate)}`, sign + n(x.amount)));
    });
  };
  section('KAM NIKLE (Sale)', b.kam, '-');
  section('ZYADA NIKLE (Return)', b.zyada, '+');
  out.push(hr, line('Kam:', '-' + n(b.kamRs)), line('Zyada:', '+' + n(b.zyadaRs)), hr);
  out.push(line('KUL FARQ:', 'Rs ' + n(b.total)), hr, '', '', '');
  out.push(GS + 'V' + '\x42' + '\x00');
  return out.join('\r\n');
}

// RAW print: ESC/POS bytes seedha printer ko (barcode/bara text chalta hai)
function printText(text) {
  const file = path.join(DIR, 'farq-print.bin');
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
  const psFile = path.join(DIR, 'farq-raw-print.ps1');
  fs.writeFileSync(psFile, ps);
  return new Promise(res => {
    require('child_process').execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
      { timeout: 20000 }, err => res(err));
  });
}

async function printBill(b) {
  if (!AUTO_PRINT) return;
  const err = await printText(receiptText(b));
  log(err ? 'Print nahi hua: ' + err.message : 'Rasid print ke liye bhej di: Sale ' + b.saleNo);
}

// ---- Tareeqa 1: PC par "haan" ----
async function manual() {
  const reqDoc = await countCol.doc('_post').get();
  const req = reqDoc.exists ? reqDoc.data() : null;
  if (!req || !['pending', 'preview', 'approved'].includes(req.status)) {
    console.log('App se koi naya hukam nahi aaya. Pehle app mein "Farq ka bill PC par banao" dabayein.');
    return;
  }
  const base = { round: req.round, branch: req.branch, at: req.at };
  const setStatus = d => countCol.doc('_post').set({ ...base, ...d, doneAt: Date.now() });
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const L = await buildList(pool, req);
    if (L.error) { console.log(L.error + '. POS mein account theek karein.'); await setStatus({ status: 'failed', error: L.error }); return; }
    if (!L.kam.length && !L.zyada.length) { console.log('Bill ke liye koi naya farq wala item nahi.'); await setStatus({ status: 'nothing' }); return; }
    printList(L);
    const ans = await ask('Bill banana hai? "haan" likh kar Enter dabayein: ');
    if (!['haan', 'han', 'ok'].includes(ans)) {
      console.log('Cancel. Kuch nahi bana.');
      await setStatus({ status: 'cancelled' });
      return;
    }
    try {
      const r = await createBill(pool, L);
      const h = await saveHistory(L, r).catch(e => { console.log('History nahi likhi: ' + e.message); return null; });
      await printBill(h || { ...brief(L), ...r, round: L.round });
      await setStatus({ status: 'done', ...r, total: L.net, kamRs: L.saleTotal, zyadaRs: L.retTotal, lines: L.kam.length + L.zyada.length });
      console.log(`\nBill ban gaya: Sale No ${r.saleNo}${r.returnNo ? ' · Return No ' + r.returnNo : ''} · Kul farq Rs ${L.net}`);
      console.log(`POS mein "${L.P.PartyName}" ka khata aur Sale Register dekh lein.`);
    } catch (e) {
      console.log('\nBill NAHI bana, POS mein kuch nahi badla. Wajah: ' + e.message);
      await setStatus({ status: 'failed', error: e.message });
    }
  } finally {
    await pool.close();
  }
}

// ---- Tareeqa 2: khud chalta rahe, OK mobile se ----
async function autoOnce() {
  const pool0 = await sql.connect(SQL_CONFIG);
  try { await fillSysPos(pool0); } finally { await pool0.close(); }
  const ref = countCol.doc('_post');
  const snap = ctlPost || await ref.get();   // listener wala snapshot; "posting" ka taala transaction mein taaza parhta hai
  const req = snap.exists ? snap.data() : null;
  if (!req || !['pending', 'approved'].includes(req.status)) return;
  const base = { round: req.round, branch: req.branch, at: req.at };

  const pool = await sql.connect(SQL_CONFIG);
  try {
    const L = await buildList(pool, req);
    if (L.error) { await ref.set({ ...base, status: 'failed', error: L.error, doneAt: Date.now() }); log(L.error); return; }
    if (!L.kam.length && !L.zyada.length) { await ref.set({ ...base, status: 'nothing', doneAt: Date.now() }); log('Koi farq nahi'); return; }

    if (req.status === 'pending') {
      await ref.set({ ...base, status: 'preview', preview: brief(L), sig: sig(L), previewAt: Date.now() });
      log(`List mobile par bhej di: ${L.kam.length + L.zyada.length} items, kul farq Rs ${L.net}`);
      return;
    }

    // approved: list wahi honi chahiye jo malik ne dekhi thi
    if (req.sig !== sig(L)) {
      await ref.set({ ...base, status: 'preview', preview: brief(L), sig: sig(L), previewAt: Date.now(),
        note: 'Ginti badal gayi thi — nayi list dekh kar dobara OK karein' });
      log('Ginti badal gayi, nayi list mobile par bhej di');
      return;
    }
    // Do dafa na bane: pehle "posting" par taala lagao
    const locked = await db.runTransaction(async t => {
      const cur = (await t.get(ref)).data();
      if (!cur || cur.status !== 'approved' || cur.sig !== req.sig) return false;
      t.set(ref, { ...cur, status: 'posting', postingAt: Date.now() });
      return true;
    });
    if (!locked) return;
    try {
      const r = await createBill(pool, L);
      const h = await saveHistory(L, r).catch(e => { log('History nahi likhi: ' + e.message); return null; });
      await printBill(h || { ...brief(L), ...r, round: L.round });
      await ref.set({ ...base, status: 'done', ...r, total: L.net, kamRs: L.saleTotal, zyadaRs: L.retTotal,
        lines: L.kam.length + L.zyada.length, doneAt: Date.now() });
      log(`Bill ban gaya: Sale ${r.saleNo}${r.returnNo ? ' / Return ' + r.returnNo : ''} · Rs ${L.net}`);
    } catch (e) {
      await ref.set({ ...base, status: 'failed', error: e.message, doneAt: Date.now() });
      log('Bill nahi bana: ' + e.message);
    }
  } finally {
    await pool.close();
  }
}

// ============================================================
//  "BAND" ITEMS: app mein Band ka tick -> POS mein stock 0 (stock fraq bill) + item INACTIVE
//  Tick hataya -> POS mein item dobara ACTIVE (stock wapas nahi aata)
//  Jo items yeh feature lagne se PEHLE band the, un ko nahi chheda jata
//  (un ke liye: node post-farq.js --band-old  /  --band-old --yes)
// ============================================================
const BAND_STATE = path.join(DIR, 'band-state.json');
const BAND_MAX_PER_TURN = 25;
const PARTY_SQL_TEXT = `SELECT PartyID, PartyName, AccountID FROM dbo.Party
  WHERE (LOWER(PartyName) LIKE '%stock%fraq%' OR LOWER(PartyName) LIKE '%stock%farq%')`;
const readBand = () => { try { return JSON.parse(fs.readFileSync(BAND_STATE, 'utf8')); } catch { return null; } };
const writeBand = v => fs.writeFileSync(BAND_STATE, JSON.stringify(v, null, 1));
const bandDay = () => { const x = new Date(), q = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${q(x.getMonth() + 1)}-${q(x.getDate())}`; };
const hiddenIds = d => { const m = d.exists ? d.data().items || {} : {}; return new Set(Object.keys(m).filter(k => m[k])); };
let bandHidden = null;
let hasActiveCol = null;

function watchBand() {
  countCol.doc('_hidden').onSnapshot(d => {
    bandHidden = hiddenIds(d);
    if (!readBand()) {
      writeBand({ old: [...bandHidden], done: {}, fail: {} });
      log(`Band feature chalu: ${bandHidden.size} purane band items ko nahi chheda jayega`);
    }
  }, listenFail('_hidden'));
}

async function activeCol(pool) {
  if (hasActiveCol === null) {
    hasActiveCol = (await pool.request().query(`SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Items' AND COLUMN_NAME = 'IsActive'`)).recordset[0].n > 0;
  }
  return hasActiveCol;
}

async function bandRows(pool, ids) {
  const list = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (!list.length) return [];
  const act = (await activeCol(pool)) ? 'ISNULL(i.IsActive,1)' : '1';
  const rows = (await pool.request().query(`
    SELECT i.ItemID, i.ItemCode, i.ItemName, ${act} AS Active,
           r.BranchID, ISNULL(r.CurrStock,0) AS Stock, ISNULL(r.PurchaseRate,0) AS Cost
    FROM dbo.Items i LEFT JOIN dbo.ItemBranchRate r ON r.ItemID = i.ItemID
    WHERE i.ItemID IN (${list.join(',')})`)).recordset;
  const items = new Map();
  for (const r of rows) {
    if (!items.has(r.ItemID)) items.set(r.ItemID, { id: r.ItemID, code: String(r.ItemCode || '').trim(),
      name: String(r.ItemName || '').trim() || '-', active: !!r.Active, branches: [] });
    if (r.BranchID != null) items.get(r.ItemID).branches.push({ branch: r.BranchID, stock: round3(r.Stock), cost: Number(r.Cost) || 0 });
  }
  return [...items.values()];
}

function bandReceipt(L, r) {
  const W = PRINT_WIDTH;
  const n = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const row = (a, b) => { a = String(a); b = String(b); return (a + ' '.repeat(Math.max(1, W - a.length - b.length))).slice(0, W - b.length) + b; };
  const center = t => { t = String(t).slice(0, W); return ' '.repeat(Math.floor((W - t.length) / 2)) + t; };
  const hr = '-'.repeat(W);
  const out = [center('NOOR TRADERS'), center('ITEM BAND - STOCK 0'), hr, row('Sale No:', r.saleNo || '-')];
  if (r.returnNo) out.push(row('Return No:', r.returnNo));
  out.push(row('Branch:', L.branchName), row('Tareekh:', new Date().toLocaleString('en-GB')), hr);
  for (const k of [...L.kam, ...L.zyada]) {
    out.push(String(k.ItemName).slice(0, W));
    out.push(row(`  ${k.positive ? '-' : '+'}${n(k.qty)} x ${n(k.cost)}`, 'Rs ' + n(k.amount)));
  }
  out.push(hr, row('Kul:', 'Rs ' + n(L.net)), center('POS mein item INACTIVE'), '', '', '');
  return out.join('\r\n');
}

// ids ka stock 0 + inactive. st (band-state) update karta hai.
async function bandProcess(pool, ids, st) {
  const items = await bandRows(pool, ids);
  const found = new Set(items.map(it => String(it.id)));
  for (const id of ids) if (!found.has(String(id))) { st.done[id] = { at: Date.now(), note: 'POS mein item nahi mila' }; }
  if (!items.length) return;
  const P = (await pool.request().query(PARTY_SQL_TEXT)).recordset;
  if (P.length !== 1) throw Error('"stock fraq" account POS mein nahi mila (ya ek se zyada)');
  const names = Object.fromEntries((await pool.request().query('SELECT BranchID, BranchName FROM dbo.Branch')
    .catch(() => ({ recordset: [] }))).recordset.map(b => [b.BranchID, String(b.BranchName || '').trim()]));
  const day = bandDay();
  const byBranch = new Map();
  for (const it of items) for (const b of it.branches) {
    if (Math.abs(b.stock) <= 0.0001) continue;
    if (!byBranch.has(b.branch)) byBranch.set(b.branch, []);
    byBranch.get(b.branch).push({ itemId: it.id, ItemID: it.id, ItemName: it.name, key: (b.stock > 0 ? '' : 'R') + it.id,
      qty: round3(Math.abs(b.stock)), cost: b.cost, rate: b.cost, amount: round2(Math.abs(b.stock) * b.cost),
      cogs: round2(Math.abs(b.stock) * b.cost), positive: b.stock > 0 });
  }
  const failed = new Set();
  const bills = {};
  for (const [branch, lines] of byBranch) {
    const kam = lines.filter(l => l.positive), zyada = lines.filter(l => !l.positive);
    const sum = (a, f) => round2(a.reduce((t, x) => t + x[f], 0));
    const postedKey = `_posted-band-${day}-${branch}`;
    const L = { P: P[0], round: 'band-' + day, branch, branchName: names[branch] || 'Branch ' + branch, postedKey,
      already: readLocal()[postedKey] || {}, kam, zyada, skipped: [],
      saleTotal: sum(kam, 'amount'), saleCogs: sum(kam, 'cogs'), retTotal: sum(zyada, 'amount'), retCogs: sum(zyada, 'cogs') };
    L.net = round2(L.saleTotal - L.retTotal);
    try {
      const r = await createBill(pool, L);
      log(`Band: ${L.branchName} stock 0 - Sale ${r.saleNo}${r.returnNo ? ' / Return ' + r.returnNo : ''} (${lines.length} items, Rs ${L.net})`);
      lines.forEach(l => { (bills[l.itemId] = bills[l.itemId] || []).push(r.saleNo + (r.returnNo ? '/' + r.returnNo : '')); });
      if (AUTO_PRINT) {
        const err = await printText(bandReceipt(L, r));
        log(err ? 'Print nahi hua: ' + err.message : 'Band rasid print ke liye bhej di');
      }
    } catch (e) {
      log(`Band: ${L.branchName} stock 0 NAHI HUA - ${e.message}`);
      lines.forEach(l => failed.add(l.itemId));
    }
  }
  const canOff = await activeCol(pool);
  for (const it of items) {
    const id = String(it.id);
    if (failed.has(it.id)) { st.fail[id] = (st.fail[id] || 0) + 1; continue; }
    try {
      if (canOff && it.active) await pool.request().input('id', sql.Int, it.id).query('UPDATE dbo.Items SET IsActive = 0 WHERE ItemID = @id');
      st.done[id] = { at: Date.now(), code: it.code, name: it.name, wasActive: it.active, bills: bills[it.id] || [] };
      delete st.fail[id];
      st.old = (st.old || []).filter(x => x !== id);
      log(`Band: ${it.code} ${it.name} - POS mein inactive`);
    } catch (e) {
      st.fail[id] = (st.fail[id] || 0) + 1;
      log(`Band: ${it.code} inactive NAHI HUA - ${e.message}`);
    }
  }
}

async function bandOnce() {
  if (!bandHidden) return;
  const st = readBand();
  if (!st) return;
  st.done = st.done || {}; st.fail = st.fail || {};
  const before = JSON.stringify(st);
  st.old = (st.old || []).filter(id => bandHidden.has(id));         // tick hata to "purana" nahi raha
  const back = Object.keys(st.done).filter(id => !bandHidden.has(id));
  for (const id of Object.keys(st.fail)) if (!bandHidden.has(id)) delete st.fail[id];
  const old = new Set(st.old);
  const fresh = [...bandHidden].filter(id => !old.has(id) && !st.done[id] && (st.fail[id] || 0) < 3);
  if (!fresh.length && !back.length) { if (JSON.stringify(st) !== before) writeBand(st); return; }
  const pool = await sql.connect(SQL_CONFIG);
  try {
    for (const id of back) {
      const d = st.done[id];
      try {
        if (d.wasActive !== false && Number(id) > 0 && await activeCol(pool)) {
          await pool.request().input('id', sql.Int, Number(id)).query('UPDATE dbo.Items SET IsActive = 1 WHERE ItemID = @id');
          log(`Band hataya: ${d.code || id} ${d.name || ''} - POS mein dobara active (stock 0 hi rahega)`);
        }
        delete st.done[id];
      } catch (e) { log(`Band hataya: ${id} active NAHI HUA - ${e.message}`); }
    }
    if (fresh.length) await bandProcess(pool, fresh.slice(0, BAND_MAX_PER_TURN), st);
  } finally {
    writeBand(st);
    await pool.close();
  }
}

// Feature se pehle ke band items: node post-farq.js --band-old [--yes]
async function bandOld(yes) {
  const d = await countCol.doc('_hidden').get();
  const hidden = hiddenIds(d);
  const st = readBand() || { old: [...hidden], done: {}, fail: {} };
  st.done = st.done || {}; st.fail = st.fail || {};
  const ids = (st.old || []).filter(id => hidden.has(id) && !st.done[id]);
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const items = (await bandRows(pool, ids)).filter(it => it.active || it.branches.some(b => Math.abs(b.stock) > 0.0001));
    console.log('\n' + pad('Code', 16) + pad('Naam', 24) + pad('Status', 10) + 'Stock (branch: qty)');
    console.log('-'.repeat(90));
    for (const it of items) {
      const stock = it.branches.filter(b => Math.abs(b.stock) > 0.0001).map(b => `${b.branch}: ${b.stock}`).join(' · ') || '0';
      console.log(pad(it.code, 16) + pad(it.name, 24) + pad(it.active ? 'ACTIVE' : 'inactive', 10) + stock);
    }
    console.log('-'.repeat(90));
    console.log(`Purane band items jin ka kaam baqi: ${items.length}`);
    if (!yes) { console.log('\nTheek ho to chalayein:  node post-farq.js --band-old --yes'); writeBand(st); return; }
    for (let i = 0; i < items.length; i += BAND_MAX_PER_TURN) {
      await bandProcess(pool, items.slice(i, i + BAND_MAX_PER_TURN).map(it => String(it.id)), st);
      writeBand(st);
    }
    const doneNow = new Set(Object.keys(st.done));
    st.old = (st.old || []).filter(id => !doneNow.has(id));
    writeBand(st);
    console.log('Ho gaya.');
  } finally {
    await pool.close();
  }
}

async function autoLoop() {
  log(`post-farq v12 --auto chal raha hai. App ka hukam listener se (foran), SQL kaam har ${POLL_SECONDS} second. Band: Ctrl+C`);
  let busy = false, again = false, timer = null;
  const tick = async () => {
    if (busy) { again = true; return; }
    busy = true;
    do {
      again = false;
      try { await autoOnce(); } catch (e) { log('Masla: ' + e.message); }
      try { await bandOnce(); } catch (e) { log('Band masla: ' + e.message); }
    } while (again);
    busy = false;
  };
  kickFarq = () => { if (timer) return; timer = setTimeout(() => { timer = null; tick(); }, 1500); };
  watchBand();
  watchCtl();
  await tick();
  setInterval(tick, POLL_SECONDS * 1000);
}

module.exports = { createBill, PARTY_SQL: `SELECT PartyID, PartyName, AccountID FROM dbo.Party
  WHERE (LOWER(PartyName) LIKE '%stock%fraq%' OR LOWER(PartyName) LIKE '%stock%farq%')`, SQL_CONFIG, round2, round3 };

if (require.main === module) {
  const PRINT_ARG = process.argv.indexOf('--print');
  if (PRINT_ARG > 0) {
    const no = process.argv[PRINT_ARG + 1];
    countCol.doc('_bill-' + no).get().then(async d => {
      if (!d.exists) { console.log('Is bill ki history nahi mili. Pehle: node add-bill-history.js ' + no); return; }
      const err = await printText(receiptText(d.data()));
      console.log(err ? 'Print nahi hua: ' + err.message : 'Print ke liye bhej diya.');
    }).then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
  } else if (process.argv.includes('--band-old')) {
    bandOld(process.argv.includes('--yes')).then(() => process.exit(0)).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
  } else if (AUTO) {
    autoLoop();
  } else {
    console.log('post-farq v9');
    manual().then(() => process.exit(0)).catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
  }
}
