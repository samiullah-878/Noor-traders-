// ============================================================
//  pos-khata-sync.js — Blue Khata app  <->  POS  (dono taraf)
//
//  ACCOUNTS
//    app mein "POS mein bhi banao" wala account   -> POS mein Party + Account banta hai
//    POS ka supplier account                       -> app mein aata hai (pos-party-<id>)
//    naam / mobile badla                           -> doosri taraf bhi badalta hai
//    delete                                        -> khali account delete, entries wala sirf BAND (inactive)
//
//  ENTRIES (sirf in accounts ki)
//    app "Party ko payment"  <->  POS Cash Payment  (CPV)
//    app "Wasooli"           <->  POS Cash Receipt  (CRV)
//    app Transfer            <->  POS Journal       (JV)
//    naya / edit / delete    -> doosri taraf bhi
//
//  Purchase pehle ki tarah sync.js hi laata hai. Sale/Purchase ke bill yahan nahi chhere jate.
//
//  Chalane ka tareeqa:
//    node pos-khata-sync.js --dry     -> sirf batata hai kya karega, kuch nahi likhta  (PEHLE YEH)
//    node pos-khata-sync.js           -> ek dafa sync
//    node pos-khata-sync.js --auto    -> har 60 second (khata-sync-auto.vbs isi ko chalata hai)
//    node pos-khata-sync.js --print-voucher CPV-000123  -> koi bhi voucher dobara print (kuch save nahi)
//  v8: voucher rasid (CPV/CRV/Transfer/Udhar) notepad ki jagah seedha TM-T88IV par, sale rasid jaisi
// ============================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ---------------- SETTINGS ----------------
const BUSINESS_ID = 'noor-traders';
const START_DATE = '2026-09-15';     // is se pehle ke POS vouchers nahi aate (sync.js wali tareekh)
const BRANCH_ID = 1;                 // NOOR TRADERS
const CASH_ACCOUNT_ID = 11;          // CASH in hand (POS Defaults.CashACID)
const EQUITY_ACCOUNT_ID = 13;
const SALE_ACCOUNT_ID = 7;           // Total Sales (POS Defaults.SaleACID) — app ki udhaar sale is ke khilaf        // shuru ke baqaye ka doosra khana (POS Defaults.EquityACID)
const CREATED_BY = 1;                // POS user: Administrator
const IMPORT_NEW_SUPPLIERS = true;   // POS mein NAYE bane supplier app mein laayein (purane app mein pehle se hain)
const LOOP_SECONDS = 60;
const AUTO_PRINT = true;             // app se POS mein nayi entry bante hi rasid print
const PRINT_WIDTH = 42;              // rasid ki chaurai (TM-T88IV 80mm = 42 akshar)
const PRINTER_NAME = 'TM-T88IV';     // Windows mein printer ka naam (sale-post.js wala)
const SHOP_PHONE = '03450412515';
// ------------------------------------------

const DIR = __dirname;
const DRY = process.argv.includes('--dry');
const AUTO = process.argv.includes('--auto');
const WRITER = 'pos-sync';
const STATE_FILE = path.join(DIR, 'pos-khata-state.json');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };

if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const biz = db.collection('businesses').doc(BUSINESS_ID);
const khata = biz.collection('blueKhata');
const linksCol = biz.collection('posLinks');

// ---------- chhote kaam ----------
const paisa = n => Math.round((Number(n) || 0) * 100);
const rupees = p => Math.round(Number(p || 0)) / 100;
const hash = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const ymd = d => { const x = new Date(d), p = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const ms = v => typeof v === 'number' ? v : (v && v.toMillis ? v.toMillis() : (Date.parse(v) || 0));
const clip = (s, n) => String(s || '').slice(0, n);
const nowIso = () => Date.now();
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const state = readState();
if (!state.enabledAt) { state.enabledAt = Date.now(); if (!DRY) fs.writeFileSync(STATE_FILE, JSON.stringify(state)); }
// Is waqt se pehle app mein bani entries POS mein NAHI bheji jatin (purana hisaab dobara na jaye)
const ENABLED_AT = state.enabledAt;

// ---------- app data (listener se, taake har chakkar mein poora na parhna pare) ----------
const app = new Map();
let appReady = false;
let kick = null;   // app mein nayi/badli entry aate hi sync foran chalane ke liye
function listenApp() {
  return new Promise((resolve, reject) => {
    khata.onSnapshot(s => {
      let userChange = false;
      s.docChanges().forEach(c => {
        if (c.type === 'removed') app.delete(c.doc.id);
        else app.set(c.doc.id, { ...c.doc.data(), id: c.doc.id });
        if (c.type === 'removed' || c.doc.data().updatedBy !== WRITER) userChange = true;
      });
      if (appReady && userChange && kick) kick();
      if (!appReady) { appReady = true; resolve(); }
    }, e => {
      // Shuru ke baad listener toota to purane data par chalte rehna khatarnak hai -> band ho jao, bat dobara chalayega
      if (!appReady) return reject(e);
      log('App listener toot gaya: ' + e.message + ' — script band, bat 60 second mein dobara chalayega');
      process.exit(1);
    });
  });
}
const links = new Map();
function loadLinks() {
  // live: doosra script (pos-milan) link likhe to foran pata chale
  return new Promise((resolve, reject) => {
    let first = true;
    linksCol.onSnapshot(s => {
      s.docChanges().forEach(c => {
        if (c.type === 'removed') links.delete(c.doc.id);
        else links.set(c.doc.id, { ...(links.get(c.doc.id) || {}), ...c.doc.data() });
      });
      if (first) { first = false; resolve(); }
    }, e => {
      if (first) return reject(e);
      log('Links listener toot gaya: ' + e.message + ' — script band, bat 60 second mein dobara chalayega');
      process.exit(1);
    });
  });
}
async function setLink(key, v) {
  const next = { ...(links.get(key) || {}), ...v, syncedAt: Date.now() };
  links.set(key, next);
  if (!DRY) await linksCol.doc(key.replace(/\//g, '_')).set(next, { merge: true });
}
async function dropLink(key) {
  links.delete(key);
  if (!DRY) await linksCol.doc(key.replace(/\//g, '_')).delete();
}
async function appWrite(id, data, old) {
  const rec = { ...data, id, updatedBy: WRITER, updatedAt: nowIso(),
    by: old?.by || WRITER, createdAt: old?.createdAt || nowIso(), rev: (old?.rev || 0) + 1 };
  if (DRY) { log('  (dry) app likhta:', id, data.kind || data.type, data.amount != null ? rupees(data.amount) : '', data.deleted ? 'DELETE' : ''); return rec; }
  await khata.doc(id).set(rec);
  app.set(id, rec);
  return rec;
}

const isParty = r => r && r.type === 'party';
const partySynced = p => isParty(p) && (String(p.id).startsWith('pos-party-') || p.posSync === true);
const posHashOf = (name, phone) => hash({ n: String(name || '').trim(), ph: String(phone || '').trim() });
const appHashParty = p => hash({ n: String(p.name || '').trim(), ph: String(p.phone || '').trim(), c: p.category, d: !!p.deleted });
const appHashEntry = e => hash({ k: e.kind, p: e.partyId, a: e.amount, d: e.date, n: e.note || '', x: !!e.deleted,
  f: e.fromPartyId || '', t: e.toPartyId || '' });

// ---------- POS: accounts ----------
const TYPE = {
  Supplier: { partyType: 2, group: 2, head: 6, sub: 4, accType: 'Payables', prefix: '02' },
  Customer: { partyType: 1, group: 1, head: 1, sub: 3, accType: 'Receivables', prefix: '01' }
};
const nextNum = (max, width) => String((parseInt(String(max || '0').replace(/\D/g, '').slice(-width), 10) || 0) + 1).padStart(width, '0');

async function posCreateParty(tx, p) {
  const t = TYPE[p.category === 'Supplier' ? 'Supplier' : 'Customer'];
  const r = new sql.Request(tx);
  const acc = (await r.input('g', t.group).input('h', t.head).input('s', t.sub).query(`
    SELECT ISNULL(MAX(AccountCode),'') AS mx, (SELECT AccountSubHeadCode FROM dbo.AccountSubHead WHERE AccountSubHeadID=@s) AS sub
    FROM dbo.Account WITH (UPDLOCK, HOLDLOCK) WHERE AccountGroupID=@g AND AccountHeadID=@h AND AccountSubHeadID=@s`)).recordset[0];
  const accountCode = `${acc.sub}-${nextNum(acc.mx, 4)}`;
  const name = clip(String(p.name).trim(), 50);
  const accountId = (await new sql.Request(tx)
    .input('AccountID', sql.Int, 0).input('AccountGroupID', sql.Int, t.group).input('AccountHeadID', sql.Int, t.head)
    .input('AccountSubHeadID', sql.Int, t.sub).input('AccountCode', sql.VarChar(13), accountCode)
    .input('AccountName', sql.VarChar(100), name).input('AccountType', sql.VarChar(20), t.accType)
    .input('IsActive', sql.Bit, 1).input('AccountNoteID', sql.Int, null).input('AccountBudget', sql.Float, 0)
    .execute('dbo.usp_Account_InsertUpdate')).recordset[0];
  const newAccountId = Number(Object.values(accountId)[0]);

  const px = (await new sql.Request(tx).input('t', t.partyType).query(`
    SELECT ISNULL(MAX(PartyCode),'') AS pc, ISNULL(MAX(MemNo),'') AS mn FROM dbo.Party WITH (UPDLOCK, HOLDLOCK) WHERE PartyTypeID=@t`)).recordset[0];
  const partyCode = `${t.prefix}-${nextNum(px.pc, 4)}`;
  const memNo = '00' + String(t.partyType) + nextNum(String(px.mn).slice(3), 3);
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const barcode = clip(memNo + pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear(), 15);
  const partyRow = (await new sql.Request(tx)
    .input('PartyID', sql.Int, 0).input('AccountID', sql.Int, newAccountId).input('PartyTypeID', sql.Int, t.partyType)
    .input('PartyCode', sql.VarChar(50), partyCode).input('PartyName', sql.VarChar(50), name)
    .input('ContactPerson', sql.VarChar(35), '').input('Phone1', sql.VarChar(15), clip(p.phone || '0', 15))
    .input('Phone2', sql.VarChar(15), '').input('FaxNo', sql.VarChar(15), '').input('Address1', sql.VarChar(100), '')
    .input('Address2', sql.VarChar(100), '').input('Email', sql.VarChar(50), '').input('STNO', sql.VarChar(50), '')
    .input('NTNNO', sql.VarChar(50), '').input('City', sql.VarChar(50), '').input('MemNo', sql.VarChar(6), memNo)
    .input('RefNo', sql.VarChar(10), '').input('CNIC', sql.VarChar(15), '').input('Barcode', sql.VarChar(15), barcode)
    .input('CreditLimit', sql.Float, 0).input('OpenningBalance', sql.Float, 0).input('Discount', sql.Float, 0)
    .input('AreaID', sql.Int, 0).input('SaleRate', sql.VarChar(20), t.partyType === 1 ? 'RT' : '')
    .input('PartyUrduName', sql.NVarChar(200), '')
    .execute('dbo.usp_Party_InsertUpdate')).recordset[0];
  return { partyId: Number(Object.values(partyRow)[0]), accountId: newAccountId, accountCode };
}

async function posUpdateParty(pool, posPartyId, p) {
  const cur = (await pool.request().input('id', posPartyId).query('SELECT * FROM dbo.Party WHERE PartyID=@id')).recordset[0];
  if (!cur) return false;
  const name = clip(String(p.name).trim(), 50);
  await pool.request().input('id', posPartyId).input('n', sql.VarChar(50), name).input('ph', sql.VarChar(15), clip(p.phone || cur.Phone1 || '0', 15))
    .query('UPDATE dbo.Party SET PartyName=@n, Phone1=@ph WHERE PartyID=@id');
  await pool.request().input('a', cur.AccountID).input('n', sql.VarChar(100), name)
    .query('UPDATE dbo.Account SET AccountName=@n WHERE AccountID=@a');
  return true;
}

async function posRemoveParty(pool, posPartyId) {
  const cur = (await pool.request().input('id', posPartyId).query('SELECT PartyID, AccountID FROM dbo.Party WHERE PartyID=@id')).recordset[0];
  if (!cur) return 'gone';
  const used = (await pool.request().input('a', cur.AccountID).query('SELECT COUNT(*) AS n FROM dbo.VoucherDetail WHERE AccountID=@a')).recordset[0].n;
  if (used > 0) {
    await pool.request().input('a', cur.AccountID).query('UPDATE dbo.Account SET IsActive=0 WHERE AccountID=@a');
    return 'inactive';
  }
  await pool.request().input('PartyID', sql.Int, posPartyId).execute('dbo.usp_Party_Delete');
  return 'deleted';
}

// ---------- POS: vouchers ----------
// lines: [{accountId, debit, credit, desc}]
async function posWriteVoucher(pool, { voucherId = 0, type, date, remarks, marker, lines }) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const now = new Date();
    const vdate = new Date(`${date}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`);
    const note = voucherId
      ? null
      : `Created By:Blue Khata app On:${now.toLocaleString('en-US')} at PC:${os.hostname()} [app:${marker}]`;
    const req = new sql.Request(tx)
      .input('VoucherID', sql.Int, voucherId).input('BranchID', sql.Int, BRANCH_ID)
      .input('VoucherCode', sql.VarChar(20), '').input('VoucherDate', sql.DateTime, vdate)
      .input('VoucherType', sql.VarChar(10), type).input('DocumentType', sql.VarChar(10), type)
      .input('DocumentNo', sql.Int, 0).input('VoucherStatusID', sql.Int, 1)
      .input('VoucherDesc', sql.VarChar(500), '').input('CreatedOn', sql.DateTime, now)
      .input('CreatedBy', sql.Int, CREATED_BY).input('UpdatedOn', sql.DateTime, voucherId ? now : null)
      .input('UpdatedBy', sql.Int, voucherId ? CREATED_BY : null).input('PostedOn', sql.DateTime, vdate)
      .input('PostedBy', sql.Int, CREATED_BY).input('ChequeDate', sql.DateTime, vdate)
      .input('ChequeNo', sql.VarChar(20), '').input('VoucherRemarks', sql.VarChar(500), clip(remarks, 500))
      .input('PartyID', sql.Int, null).input('IsPresented', sql.Bit, 0).input('YearID', sql.Int, null);
    if (voucherId) {
      const old = (await new sql.Request(tx).input('id', voucherId).query('SELECT SystemNote FROM dbo.Voucher WHERE VoucherID=@id')).recordset[0];
      req.input('SystemNote', sql.VarChar(8000), clip((old?.SystemNote || '') + `\r\nModified By:Blue Khata app On:${now.toLocaleString('en-US')}`, 8000));
    } else {
      req.input('SystemNote', sql.VarChar(8000), note);
    }
    const v = (await req.execute('dbo.usp_Voucher_InsertUpdate')).recordset[0];
    const id = v.VoucherID;
    await new sql.Request(tx).input('VoucherID', sql.Int, id).execute('dbo.usp_VoucherDetail_DeleteByVoucherID');
    for (const l of lines) {
      await new sql.Request(tx)
        .input('VoucherDetailID', sql.Int, 0).input('VoucherID', sql.Int, id).input('CostCenterID', sql.Int, 0)
        .input('AccountID', sql.Int, l.accountId).input('Description', sql.VarChar(500), clip(l.desc, 500))
        .input('Debit', sql.Float, l.debit).input('Credit', sql.Float, l.credit)
        .execute('dbo.usp_VoucherDetail_InsertUpdate');
    }
    await tx.commit();
    return { voucherId: id, code: v.VoucherCode };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}
// POS se aaye (do line wale) voucher mein sirf raqam / tareekh / note badlo — accounts wahi rahen
async function posEditSimple(pool, voucherId, partyAccountId, amount, date, note) {
  const lines = (await pool.request().input('id', voucherId).query('SELECT * FROM dbo.VoucherDetail WHERE VoucherID=@id')).recordset;
  if (lines.length !== 2) throw Error('Is voucher mein 2 se zyada lines hain — POS mein hi badlein');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const l of lines) {
      const mine = l.AccountID === partyAccountId;
      await new sql.Request(tx).input('id', l.VoucherDetailID)
        .input('d', sql.Float, l.Debit > 0 ? amount : 0).input('c', sql.Float, l.Credit > 0 ? amount : 0)
        .input('t', sql.VarChar(500), mine ? clip(note, 500) : l.Description)
        .query('UPDATE dbo.VoucherDetail SET Debit=@d, Credit=@c, Description=@t WHERE VoucherDetailID=@id');
    }
    const now = new Date();
    await new sql.Request(tx).input('id', voucherId).input('dt', sql.VarChar(10), date).input('now', sql.DateTime, now)
      .input('n', sql.VarChar(200), `\r\nModified By:Blue Khata app On:${now.toLocaleString('en-US')}`)
      .query(`UPDATE dbo.Voucher SET VoucherDate = DATEADD(day, DATEDIFF(day, CAST(VoucherDate AS date), CAST(@dt AS date)), VoucherDate),
        UpdatedOn=@now, UpdatedBy=${CREATED_BY}, SystemNote = ISNULL(SystemNote,'') + @n WHERE VoucherID=@id`);
    await tx.commit();
  } catch (e) { await tx.rollback().catch(() => {}); throw e; }
}

async function posDeleteVoucher(pool, voucherId) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).input('VoucherID', sql.Int, voucherId).execute('dbo.usp_VoucherDetail_DeleteByVoucherID');
    await new sql.Request(tx).input('VoucherID', sql.Int, voucherId).execute('dbo.usp_Voucher_Delete');
    await tx.commit();
  } catch (e) { await tx.rollback().catch(() => {}); throw e; }
}

// ---------- app mein entry par POS ka haal ----------
// v9 (2026-09-20): entry POS mein na ja sake to wajah entry par likh do (app "POS mein nahi bani: ..." dikhati hai)
async function noteSkip(e, base, isTransfer, msg) {
  const fromPos = String(e.id).startsWith('posv-') || String(e.transferId || '').startsWith('posv');
  if (fromPos || base.deleted || ms(base.createdAt) < ENABLED_AT) return;
  const ids = isTransfer ? [`transfer-${e.transferId}-out`, `transfer-${e.transferId}-in`] : [e.id];
  if (ids.every(id => (app.get(id) || {}).posError === msg)) return;
  log('POS mein nahi bhej sakta: ' + msg);
  await markApp(ids, { posError: msg });
}
const nameOf = id => String((app.get(id) || {}).name || id);
const notInPos = id => nameOf(id) + ' POS mein nahi hai — Account edit > POS mein bhi banao';

async function markApp(ids, fields) {
  if (DRY) return;
  for (const id of ids) {
    if (!app.has(id)) continue;
    await khata.doc(id).set(fields, { merge: true });
    app.set(id, { ...app.get(id), ...fields });
  }
}

// ---------- rasid (v8: seedha TM-T88IV par, sale rasid jaisi — notepad ke baghair) ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();   // printer Urdu nahi chhapta
function wrap(t, W) {
  const out = []; let cur = '';
  for (const w of ascii(t).split(' ')) {
    if (!w) continue;
    if ((cur ? cur.length + 1 : 0) + w.length <= W) cur = cur ? cur + ' ' + w : w;
    else { if (cur) out.push(cur); cur = w.length > W ? w.slice(0, W) : w; }
  }
  if (cur) out.push(cur);
  return out;
}
function appBalance(partyId) {
  const p = app.get(partyId);
  let b = p?.opening || 0;
  for (const e of app.values()) {
    if (e.type !== 'entry' || e.deleted || e.partyId !== partyId) continue;
    if (['credit', 'payment'].includes(e.kind)) b += e.amount;
    else if (['borrow', 'collection'].includes(e.kind)) b -= e.amount;
  }
  return b;
}
function receipt({ title, code, date, lines, note, copy }) {
  const W = PRINT_WIDTH;
  const n = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const row = (l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, W - l.length - r.length))).slice(0, W - r.length) + r; };
  const hr = '-'.repeat(W);
  const ESC = '\x1b', GS = '\x1d';
  const C = ESC + 'a\x01', L = ESC + 'a\x00', R = ESC + 'a\x02';
  const big = t => ESC + '!\x30' + t + ESC + '!\x00';          // double height + width
  const tall = t => ESC + '!\x18' + t + ESC + '!\x00';         // bold + double height
  const bold = t => ESC + 'E\x01' + t + ESC + 'E\x00';
  const bar = c => { c = ascii(c); return c ? GS + 'h\x50' + GS + 'w\x02' + GS + 'H\x02' + GS + 'k\x49' + String.fromCharCode(c.length + 2) + '{B' + c : ''; };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? new Date(date + 'T00:00:00') : new Date(date);
  const dt = isNaN(d) ? String(date) : `${String(d.getDate()).padStart(2, '0')}-${MON[d.getMonth()]}-${d.getFullYear()}`;
  const now = new Date(), hh = now.getHours() % 12 || 12;
  const tm = `${hh}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'am' : 'pm'}`;

  const out = [ESC + '@', C + big('NOOR TRADERS'), SHOP_PHONE, '', tall(title)];
  if (copy) out.push('(Dobara print)');
  out.push(L + hr, row('Voucher No: ' + ascii(code), ''), row('Tareekh: ' + dt, 'Waqt: ' + tm), C + bar(code), L + hr);
  let total = 0;
  for (const l of lines) {
    total = Math.max(total, Number(l.amount) || 0);
    out.push(bold(ascii(l.name).slice(0, W) || '(naam Urdu mein)'));
    out.push(row('  ' + l.label, 'Rs.' + n(l.amount)));
    if (l.after != null) out.push(row('  Ab baqaya:', (l.after > 0 ? 'Lene ' : l.after < 0 ? 'Dene ' : '') + 'Rs.' + n(Math.abs(l.after))));
  }
  out.push(hr, R + big('Rs.' + n(total)), L);
  const nl = wrap(note, W);
  if (nl.length) out.push('Tafseel:', ...nl, hr);
  out.push('', '', 'Dastakhat: ______________________', '', C + 'Blue Khata app', L, '', '', '');
  out.push(GS + 'V\x42\x00');                                    // kaghaz kaato
  return out.join('\r\n');
}
// RAW print: ESC/POS bytes seedha PRINTER_NAME ko (sale-post.js wala tareeqa, apni alag files)
const RAW_PS = String.raw`param([string]$Printer, [string]$Bin)
$ErrorActionPreference='Stop'
$bytes=[System.IO.File]::ReadAllBytes($Bin)
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public class RawK{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DI{[MarshalAs(UnmanagedType.LPWStr)]public string n;[MarshalAs(UnmanagedType.LPWStr)]public string o;[MarshalAs(UnmanagedType.LPWStr)]public string t;}
 [DllImport("winspool.Drv",EntryPoint="OpenPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string p,out IntPtr h,IntPtr d);
 [DllImport("winspool.Drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartDocPrinterW",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h,int l,ref DI di);
 [DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
 [DllImport("winspool.Drv",EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
 public static void Send(string printer,byte[] data){IntPtr h;if(!OpenPrinter(printer,out h,IntPtr.Zero))throw new Exception("printer nahi mila: "+printer);
  DI di=new DI();di.n="Voucher";di.t="RAW";StartDocPrinter(h,1,ref di);StartPagePrinter(h);
  IntPtr p=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,p,data.Length);int w;WritePrinter(h,p,data.Length,out w);
  Marshal.FreeCoTaskMem(p);EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h);}
}
"@
[RawK]::Send($Printer,$bytes)
`;
async function printReceipt(text) {
  if (!AUTO_PRINT || DRY) return false;
  const bin = path.join(DIR, 'khata-print.bin'), ps = path.join(DIR, 'khata-raw-print.ps1');
  fs.writeFileSync(bin, Buffer.from(text, 'latin1'));
  fs.writeFileSync(ps, RAW_PS.replace(/\r?\n/g, '\r\n'));
  return new Promise(res => require('child_process').execFile('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Printer', PRINTER_NAME, '-Bin', bin], { timeout: 30000 }, (err, so, se) => {
      log(err ? 'Print nahi hua: ' + (String(se || '').trim().split(/\r?\n/)[0] || err.message) : 'Voucher rasid print ho gayi');
      res(!err);
    }));
}
// node pos-khata-sync.js --print-voucher CPV-000123  -> POS ka koi bhi voucher dobara print (kuch save nahi hota)
async function reprintVoucher(code) {
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const rows = (await pool.request().input('c', sql.VarChar(30), String(code || '').trim()).query(`
      SELECT v.VoucherCode, v.VoucherType, v.VoucherDate, v.VoucherRemarks, vd.AccountID, vd.Debit, vd.Credit, a.AccountName
      FROM dbo.Voucher v JOIN dbo.VoucherDetail vd ON vd.VoucherID = v.VoucherID
      LEFT JOIN dbo.Account a ON a.AccountID = vd.AccountID
      WHERE LTRIM(RTRIM(v.VoucherCode)) = @c ORDER BY vd.VoucherDetailID`)).recordset;
    if (!rows.length) throw new Error('Voucher nahi mila: ' + code);
    const type = String(rows[0].VoucherType || '').trim().toUpperCase();
    const lines = rows.filter(r => !(['CPV', 'CRV'].includes(type) && r.AccountID === CASH_ACCOUNT_ID)).map(r => {
      const dr = Number(r.Debit) || 0, cr = Number(r.Credit) || 0;
      const label = type === 'CPV' ? (dr ? 'Diye' : 'Wapas') : type === 'CRV' ? (cr ? 'Wasool kiye' : 'Wapas') : (cr ? 'Se (nikla)' : 'Ko (gaya)');
      return { name: String(r.AccountName || '').trim(), label, amount: dr || cr };
    });
    const ok = await printReceipt(receipt({ title: VTITLE[type] || type + ' VOUCHER', code: rows[0].VoucherCode, date: rows[0].VoucherDate,
      lines, note: String(rows[0].VoucherRemarks || ''), copy: true }));
    return ok;
  } finally { await pool.close(); }
}
const VTITLE = { CPV: 'CASH PAYMENT VOUCHER', CRV: 'CASH RECEIPT VOUCHER', JV: 'TRANSFER VOUCHER' };

// ============================================================
//  1) ACCOUNTS
// ============================================================
async function syncAccounts(pool, acct) {
  // POS ke parties (suppliers + jo link hain)
  const posParties = (await pool.request().query(`
    SELECT p.PartyID, p.PartyTypeID, p.PartyName, p.Phone1, p.AccountID, p.OpenningDate, a.IsActive
    FROM dbo.Party p LEFT JOIN dbo.Account a ON a.AccountID = p.AccountID`)).recordset;
  const byPos = new Map(posParties.map(r => [r.PartyID, r]));

  // app party id -> POS party id
  const appToPos = new Map();
  for (const [k, l] of links) if (k.startsWith('party:') && l.posPartyId) appToPos.set(k.slice(6), l.posPartyId);
  for (const p of app.values()) {
    const mm = String(p.id).match(/^pos-party-(\d+)$/);
    if (mm && !appToPos.has(p.id)) appToPos.set(p.id, Number(mm[1]));
  }

  // --- app -> POS ---
  for (const p of app.values()) {
    if (!isParty(p)) continue;
    const key = 'party:' + p.id;
    const link = links.get(key);
    const posId = appToPos.get(p.id);
    const h = appHashParty(p);

    if (!posId && p.posSync === true && !p.deleted) {
      // pakki tasdeeq: link ab tak bana to nahi (doosre script ne)?
      const fresh = await linksCol.doc(key).get();
      if (fresh.exists && fresh.data().posPartyId) {
        links.set(key, fresh.data()); appToPos.set(p.id, fresh.data().posPartyId);
        log(`Pehle se jura mila: ${p.name}`); continue;
      }
      // POS mein isi naam ka ACTIVE account ho aur kisi aur app account se na jura ho -> usi se jor do
      const taken = new Set([...appToPos.values()]);
      const same = posParties.filter(r => r.IsActive !== false && !taken.has(r.PartyID)
        && String(r.PartyName || '').trim().toLowerCase() === String(p.name || '').trim().toLowerCase().slice(0, 50)
        && r.PartyTypeID === (p.category === 'Supplier' ? 2 : 1));
      if (same.length === 1) {
        log(`POS ke maujooda account se jora: ${p.name}`);
        appToPos.set(p.id, same[0].PartyID);
        await setLink(key, { posPartyId: same[0].PartyID, accountId: same[0].AccountID, appHash: h,
          posHash: posHashOf(same[0].PartyName, same[0].Phone1), since: Date.now() });
        continue;
      }
      log(`Naya POS account: ${p.name} (${p.category || 'Customer'})`);
      if (DRY) continue;
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const made = await posCreateParty(tx, p);
        await tx.commit();
        appToPos.set(p.id, made.partyId);
        await setLink(key, { posPartyId: made.partyId, accountId: made.accountId, appHash: h, posHash: posHashOf(clip(String(p.name).trim(), 50), clip(p.phone || '0', 15)) });
        byPos.set(made.partyId, { PartyID: made.partyId, AccountID: made.accountId, PartyName: clip(String(p.name).trim(), 50), Phone1: clip(p.phone || '0', 15), IsActive: true });
        log(`  POS mein bana: ${made.accountCode}`);
        if (p.opening) {
          const amt = rupees(Math.abs(p.opening));
          const partyDebit = p.opening > 0;
          const r = await posWriteVoucher(pool, { type: 'JV', date: ymd(Date.now()), marker: 'opening-' + p.id,
            remarks: `Shuru ka baqaya - ${p.name}`,
            lines: [
              { accountId: made.accountId, debit: partyDebit ? amt : 0, credit: partyDebit ? 0 : amt, desc: 'Shuru ka baqaya (app)' },
              { accountId: EQUITY_ACCOUNT_ID, debit: partyDebit ? 0 : amt, credit: partyDebit ? amt : 0, desc: 'Shuru ka baqaya - ' + p.name }
            ] });
          log(`  Shuru ka baqaya POS mein: ${r.code}`);
        }
      } catch (e) { await tx.rollback().catch(() => {}); log('  Account nahi bana: ' + e.message); }
      continue;
    }
    if (!posId || !partySynced(p)) continue;
    if (link && link.appHash === h) continue;
    if (!link) { await setLink(key, { posPartyId: posId, accountId: byPos.get(posId)?.AccountID, appHash: h }); continue; }
    // app mein badla
    if (p.updatedBy === WRITER) { await setLink(key, { appHash: h }); continue; }
    if (p.deleted) {
      log(`Account hataya: ${p.name}`);
      if (!DRY) { const r = await posRemoveParty(pool, posId); log('  POS: ' + r); }
    } else {
      log(`Account badla: ${p.name}`);
      if (!DRY) await posUpdateParty(pool, posId, p);
      const row = byPos.get(posId);
      if (row) { row.PartyName = clip(String(p.name).trim(), 50); row.Phone1 = clip(p.phone || row.Phone1, 15); }
    }
    const row2 = byPos.get(posId);
    await setLink(key, { appHash: h, posHash: row2 ? posHashOf(row2.PartyName, row2.Phone1) : link.posHash });
  }

  // --- POS -> app ---
  const posToApp = new Map([...appToPos].map(([a, b]) => [b, a]));
  for (const r of posParties) {
    let appId = posToApp.get(r.PartyID);
    const want = appId || (IMPORT_NEW_SUPPLIERS && r.PartyTypeID === 2 && r.IsActive !== false
      && new Date(r.OpenningDate || 0).getTime() >= ENABLED_AT);
    if (!want) continue;
    const ph = posHashOf(r.PartyName, r.Phone1);
    if (!appId) {
      // app mein isi naam ka (haath se bana) supplier pehle se ho to usi se jor do — naya na banao
      const nm = String(r.PartyName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const same = [...app.values()].filter(p => isParty(p) && !p.deleted && !String(p.id).startsWith('pos-party-')
        && !appToPos.has(p.id) && String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === nm);
      if (nm && same.length === 1) {
        log(`Naam se jora: app "${same[0].name}"  <->  POS ${r.PartyID}`);
        appToPos.set(same[0].id, r.PartyID);
        posToApp.set(r.PartyID, same[0].id);
        await setLink('party:' + same[0].id, { posPartyId: r.PartyID, accountId: r.AccountID, posHash: ph,
          appHash: appHashParty(same[0]), since: Date.now() });
        continue;
      }
      appId = 'pos-party-' + r.PartyID;
      if (!app.has(appId)) {
        log(`POS se naya account app mein: ${r.PartyName}`);
        const rec = await appWrite(appId, { type: 'party', name: String(r.PartyName || '').trim() || ('Supplier ' + r.PartyID),
          phone: String(r.Phone1 || '').trim(), category: r.PartyTypeID === 2 ? 'Supplier' : 'Customer', opening: 0 });
        // sabqa baqaya (sync.js wala tareeqa) — START_DATE se pehle ka POS hisaab
        const bal = (await pool.request().input('a', r.AccountID).input('d', sql.Date, new Date(START_DATE)).query(`
          SELECT SUM(ISNULL(vd.Debit,0) - ISNULL(vd.Credit,0)) AS b FROM dbo.VoucherDetail vd
          JOIN dbo.Voucher v ON v.VoucherID = vd.VoucherID WHERE vd.AccountID = @a AND v.VoucherDate < @d`)).recordset[0].b || 0;
        const oid = 'pos-opening-' + r.PartyID;
        if (Math.abs(bal) >= 0.01 && !app.has(oid)) {
          await appWrite(oid, { type: 'entry', kind: bal > 0 ? 'credit' : 'borrow', partyId: appId,
            amount: paisa(Math.abs(bal)), date: START_DATE, note: 'Sabqa baqaya (POS)', dailyIncluded: false });
        }
        await setLink('party:' + appId, { posPartyId: r.PartyID, accountId: r.AccountID, appHash: appHashParty(rec), posHash: ph });
        continue;
      }
    }
    const link = links.get('party:' + appId);
    const cur = app.get(appId);
    if (!cur) continue;
    if (link && link.posHash && link.posHash !== ph) {
      log(`POS mein naam/mobile badla: ${r.PartyName}`);
      const rec = await appWrite(appId, { ...cur, name: String(r.PartyName || '').trim(), phone: String(r.Phone1 || '').trim() }, cur);
      await setLink('party:' + appId, { posHash: ph, appHash: appHashParty(rec) });
    } else if (!link || !link.posHash) {
      await setLink('party:' + appId, { posPartyId: r.PartyID, accountId: r.AccountID, posHash: ph, appHash: link?.appHash || appHashParty(cur) });
    }
  }
  // POS mein party delete ho gayi
  for (const [appId, posId] of appToPos) {
    if (byPos.has(posId)) continue;
    const p = app.get(appId);
    if (!p || p.deleted) continue;
    const used = [...app.values()].some(e => e.type === 'entry' && !e.deleted && e.partyId === appId);
    if (used) { log(`POS mein ${p.name} delete hua, app mein entries hain — app mein rehne diya`); continue; }
    log(`POS mein delete hua, app se bhi: ${p.name}`);
    await appWrite(appId, { ...p, deleted: true }, p);
  }

  // account id map wapas
  for (const [appId, posId] of appToPos) {
    const r = byPos.get(posId);
    // App ka khata sahi hai: POS ke sirf woh vouchers aate hain jo sync chalu hone (ya account jurne) ke BAAD bane
    const since = Math.max(ENABLED_AT, links.get('party:' + appId)?.since || 0);
    if (r) acct.set(appId, { accountId: r.AccountID, name: String(r.PartyName || '').trim(), posPartyId: posId, since });
    const pd = app.get(appId);
    if (r && pd && !pd.posLinked && !pd.deleted) await markApp([appId], { posLinked: true });
  }
}

// ============================================================
//  2) ENTRIES
// ============================================================
function appEntryToVoucher(e, acct) {
  const a = acct.get(e.partyId);
  const amt = rupees(e.amount);
  const note = String(e.note || '').trim();
  if (e.kind === 'payment') return { type: 'CPV', remarks: `${note} - ${a.name}`, lines: [
    { accountId: CASH_ACCOUNT_ID, debit: 0, credit: amt, desc: `${note} - ${a.name}` },
    { accountId: a.accountId, debit: amt, credit: 0, desc: note }] };
  if (e.kind === 'collection') return { type: 'CRV', remarks: `${note} - ${a.name}`, lines: [
    { accountId: CASH_ACCOUNT_ID, debit: amt, credit: 0, desc: `${note} - ${a.name}` },
    { accountId: a.accountId, debit: 0, credit: amt, desc: note }] };
  if (e.kind === 'credit') return { type: 'JV', remarks: `Udhar sale (app) ${note} - ${a.name}`.replace(/\s+/g, ' '), lines: [
    { accountId: a.accountId, debit: amt, credit: 0, desc: note || 'Udhar sale (app)' },
    { accountId: SALE_ACCOUNT_ID, debit: 0, credit: amt, desc: `Udhar sale - ${a.name}` }] };
  return null;
}
function transferToVoucher(out, acct) {
  const from = acct.get(out.fromPartyId), to = acct.get(out.toPartyId);
  const amt = rupees(out.amount), note = String(out.note || '').trim();
  return { type: 'JV', remarks: `${note} - ${from.name} se ${to.name}`, lines: [
    { accountId: to.accountId, debit: amt, credit: 0, desc: `${note} (${from.name} se transfer)` },
    { accountId: from.accountId, debit: 0, credit: amt, desc: `${note} (${to.name} ko transfer)` }] };
}

async function syncEntries(pool, acct) {
  const acctIds = new Map([...acct].map(([appId, a]) => [a.accountId, appId]));
  if (!acctIds.size) return;

  // ---------- POS vouchers (CPV / CRV / JV) ----------
  const vrows = (await pool.request().input('d', sql.Date, new Date(START_DATE)).query(`
    SELECT v.VoucherID, v.VoucherCode, v.VoucherType, v.VoucherDate, v.VoucherRemarks, v.SystemNote, v.UpdatedOn, v.CreatedOn,
           vd.VoucherDetailID, vd.AccountID, vd.Description, vd.Debit, vd.Credit
    FROM dbo.Voucher v JOIN dbo.VoucherDetail vd ON vd.VoucherID = v.VoucherID
    WHERE v.VoucherType IN ('CPV','CRV','JV','BPV','BRV') AND v.DocumentType = v.VoucherType
      AND ISNULL(v.DocumentNo,0) = 0 AND v.VoucherStatusID <> 3 AND v.VoucherDate >= @d`)).recordset;
  const vouchers = new Map();
  for (const r of vrows) {
    if (!vouchers.has(r.VoucherID)) vouchers.set(r.VoucherID, { ...r, lines: [] });
    vouchers.get(r.VoucherID).lines.push(r);
  }
  // app se bani (marker) — un ka voucherId
  const appMade = new Map();
  for (const v of vouchers.values()) {
    const mk = String(v.SystemNote || '').match(/\[app:([^\]]+)\]/);
    if (mk) appMade.set(mk[1], v);
  }

  // ---------- app -> POS ----------
  const done = new Set();
  for (const e of app.values()) {
    if (e.type !== 'entry') continue;
    const isTransfer = !!e.transferId;
    const key = isTransfer ? 'transfer:' + e.transferId : 'entry:' + e.id;
    if (done.has(key)) continue;
    done.add(key);
    const fromPos = String(e.id).startsWith('posv-') || String(e.transferId || '').startsWith('posv');
    if (e.purchase || String(e.id).startsWith('pos-')) continue;          // sync.js wali purchase / sabqa
    let base = e;
    if (isTransfer) {
      base = app.get(`transfer-${e.transferId}-out`) || e;
      if (!acct.has(base.fromPartyId) || !acct.has(base.toPartyId)) {
        await noteSkip(e, base, true, notInPos(!acct.has(base.fromPartyId) ? base.fromPartyId : base.toPartyId)); continue;
      }
    } else {
      if (!['payment', 'collection', 'credit'].includes(e.kind)) continue;
      if (!acct.has(e.partyId)) { await noteSkip(e, e, false, notInPos(e.partyId)); continue; }
    }
    const link = links.get(key);
    const h = appHashEntry(base);
    if (link && link.appHash === h) continue;
    if (base.updatedBy === WRITER && link) { await setLink(key, { appHash: h }); continue; }
    if (!link && fromPos) continue;                                        // POS wali, abhi link nahi bana
    if (!link && ms(base.createdAt) < ENABLED_AT) continue;                // purani entry — POS mein nahi bhejni
    if (!link && base.deleted) continue;

    const recovered = !link && appMade.get(isTransfer ? 't-' + e.transferId : e.id);
    const vid = link?.voucherId || recovered?.VoucherID || 0;
    const name = isTransfer ? `${acct.get(base.fromPartyId).name} -> ${acct.get(base.toPartyId).name}` : acct.get(base.partyId).name;
    try {
      if (base.deleted && fromPos && !link.simple) {
        log(`${link.code}: POS mein kai lines hain — delete POS mein hi karein`); await setLink(key, { appHash: h }); continue;
      }
      if (base.deleted) {
        log(`POS se hataya: ${name} · Rs ${rupees(base.amount)} (${link?.code || vid})`);
        if (!DRY && vid) await posDeleteVoucher(pool, vid);
        vouchers.delete(vid);
        await setLink(key, { appHash: h, voucherId: 0, deleted: true });
        continue;
      }
      if (fromPos) {                                               // POS se aayi entry app mein badli
        if (!link.simple) { log(`${link.code}: POS mein kai lines hain — yeh tabdeeli POS mein hi karein`); await setLink(key, { appHash: h }); continue; }
        const partyAcc = isTransfer ? acct.get(base.toPartyId).accountId : acct.get(base.partyId).accountId;
        const cleanNote = String(base.note || '').replace(/\s*\(POS [^)]*\)\s*$/, '');
        log(`POS mein badla: ${link.code} · ${name} · Rs ${rupees(base.amount)} · ${base.date}`);
        if (!DRY) await posEditSimple(pool, vid, partyAcc, rupees(base.amount), base.date, cleanNote);
        await setLink(key, { appHash: h, posHash: null });
        vouchers.delete(vid);
        continue;
      }
      const spec = isTransfer ? transferToVoucher(base, acct) : appEntryToVoucher(base, acct);
      if (!spec) continue;
      log(`${vid ? 'POS mein badla' : 'POS mein bana'}: ${spec.type} · ${name} · Rs ${rupees(base.amount)} · ${base.date}`);
      if (DRY) continue;
      const r = await posWriteVoucher(pool, { voucherId: vid, type: spec.type, date: base.date, remarks: spec.remarks,
        marker: isTransfer ? 't-' + e.transferId : e.id, lines: spec.lines });
      await setLink(key, { appHash: h, voucherId: r.voucherId, code: r.code, posHash: null });
      const docIds = isTransfer ? [`transfer-${e.transferId}-out`, `transfer-${e.transferId}-in`] : [e.id];
      await markApp(docIds, { posCode: r.code, posError: null });
      if (!vid) {                                                   // sirf nayi entry par rasid
        const T = { CPV: VTITLE.CPV, CRV: VTITLE.CRV, JV: isTransfer ? VTITLE.JV : 'UDHAR SALE VOUCHER' }[spec.type] || spec.type;
        const amt = rupees(base.amount);
        const plines = isTransfer
          ? [{ name: acct.get(base.fromPartyId).name, label: 'Se (nikla)', amount: amt, after: rupees(appBalance(base.fromPartyId)) },
             { name: acct.get(base.toPartyId).name, label: 'Ko (gaya)', amount: amt, after: rupees(appBalance(base.toPartyId)) }]
          : [{ name: acct.get(base.partyId).name, label: base.kind === 'payment' ? 'Diye' : base.kind === 'collection' ? 'Wasool kiye' : 'Udhar', amount: amt,
               after: rupees(appBalance(base.partyId)) }];
        const printed = await printReceipt(receipt({ title: T, code: r.code, date: base.date, lines: plines, note: String(base.note || '').trim() }));
        if (printed) await markApp(docIds, { posPrintedAt: Date.now() });
      }
      for (const [k2, l2] of links) if (k2 !== key && l2.voucherId === r.voucherId) await setLink(k2, { posHash: null });
      appMade.set(isTransfer ? 't-' + e.transferId : e.id, { VoucherID: r.voucherId });
      vouchers.delete(r.voucherId);                                       // is chakkar mein wapas na aaye
    } catch (err) {
      log('  Nahi hua: ' + err.message);
      await markApp(isTransfer ? [`transfer-${e.transferId}-out`, `transfer-${e.transferId}-in`] : [e.id],
        { posError: String(err.message || 'masla').slice(0, 120) });
    }
  }

  // ---------- POS -> app ----------
  const linkedVoucher = new Map();
  for (const [k, l] of links) if (l.voucherId && !linkedVoucher.has(l.voucherId)) linkedVoucher.set(l.voucherId, k);

  for (const v of vouchers.values()) {
    if (/\[app:/.test(String(v.SystemNote || '')) && !linkedVoucher.has(v.VoucherID)) continue; // app ki, link baad mein
    const existingKey0 = linkedVoucher.get(v.VoucherID);
    const created = new Date(v.CreatedOn || v.VoucherDate).getTime();
    const partyLines = v.lines.filter(l => acctIds.has(l.AccountID)
      && (existingKey0 || created >= acct.get(acctIds.get(l.AccountID)).since));
    if (!partyLines.length) continue;
    const date = ymd(v.VoucherDate);
    const code = v.VoucherCode;
    const posH = hash(v.lines.map(l => [l.AccountID, l.Debit, l.Credit, l.Description]).concat([date, v.VoucherRemarks]));
    const existingKey = linkedVoucher.get(v.VoucherID);
    const link = existingKey && links.get(existingKey);
    if (link && link.posHash === posH) continue;
    const appOrigin = existingKey && !/^(entry:posv-|transfer:posv)/.test(existingKey);
    if (link && !link.posHash) {                                   // app ne abhi likha — POS ka naya roop yaad rakho
      for (const [k2, l2] of links) if (l2.voucherId === v.VoucherID) await setLink(k2, { posHash: posH });
      continue;
    }
    if (appOrigin) {                                               // app wali entry POS mein badli gayi
      const d0 = partyLines.find(l => l.Debit > 0) || partyLines[0];
      const amount = paisa(d0.Debit || d0.Credit);
      const ids = existingKey.startsWith('transfer:')
        ? [`transfer-${existingKey.slice(9)}-out`, `transfer-${existingKey.slice(9)}-in`] : [existingKey.slice(6)];
      const docs = ids.map(id => app.get(id)).filter(Boolean);
      if (!docs.length) { await setLink(existingKey, { posHash: posH }); continue; }
      log(`POS mein badli (app wali): ${code} · Rs ${rupees(amount)}`);
      const rev = Math.max(...docs.map(d => d.rev || 0)) + 1;
      let first = null;
      for (const d of docs) {
        const rec = await appWrite(d.id, { ...d, amount, date }, { ...d, rev: rev - 1 });
        if (!first) first = rec;
      }
      await setLink(existingKey, { posHash: posH, appHash: appHashEntry(first) });
      continue;
    }

    const debit = partyLines.filter(l => l.Debit > 0), credit = partyLines.filter(l => l.Credit > 0);
    const noteOf = l => `${String(l.Description || v.VoucherRemarks || '').replace(/^\s*-\s*/, '').trim()} (POS ${code})`.trim();

    // do party accounts ke beech JV = transfer
    if (v.VoucherType === 'JV' && debit.length === 1 && credit.length === 1 && partyLines.length === 2) {
      const tid = 'posv' + v.VoucherID, key = 'transfer:' + tid;
      const from = acctIds.get(credit[0].AccountID), to = acctIds.get(debit[0].AccountID);
      const out = app.get(`transfer-${tid}-out`);
      const amount = paisa(debit[0].Debit), note = noteOf(debit[0]);
      const common = { type: 'entry', transferId: tid, fromPartyId: from, toPartyId: to, amount, date, note, dailyIncluded: false, posCode: code };
      log(`${out ? 'App mein badla' : 'App mein aaya'}: Transfer ${code} · Rs ${rupees(amount)}`);
      const rev = (out?.rev || 0) + 1;
      await appWrite(`transfer-${tid}-out`, { ...common, kind: 'collection', transferRole: 'out', partyId: from, rev }, out ? { ...out, rev: rev - 1 } : null);
      const inc = app.get(`transfer-${tid}-in`);
      await appWrite(`transfer-${tid}-in`, { ...common, kind: 'payment', transferRole: 'in', partyId: to, rev }, inc ? { ...inc, rev: rev - 1 } : null);
      await setLink(key, { voucherId: v.VoucherID, code, simple: v.lines.length === 2, posHash: posH, appHash: appHashEntry({ ...common, kind: 'collection', partyId: from }) });
      continue;
    }
    // warna har party account ek entry
    const byAcc = new Map();
    for (const l of partyLines) {
      const x = byAcc.get(l.AccountID) || { ...l, Debit: 0, Credit: 0 };
      x.Debit += Number(l.Debit) || 0; x.Credit += Number(l.Credit) || 0;
      byAcc.set(l.AccountID, x);
    }
    const keep = new Set([...byAcc.keys()].map(a => `posv-${v.VoucherID}-${a}`));
    for (const e of app.values()) {
      if (e.id.startsWith(`posv-${v.VoucherID}-`) && !keep.has(e.id) && !e.deleted) {
        log(`POS voucher ${code} se line hati: ${e.id}`);
        await appWrite(e.id, { ...e, deleted: true }, e);
      }
    }
    for (const l0 of byAcc.values()) {
      const net = Math.round((l0.Debit - l0.Credit) * 100) / 100;
      const l = { ...l0, Debit: net > 0 ? net : 0, Credit: net < 0 ? -net : 0 };
      const id = `posv-${v.VoucherID}-${l.AccountID}`, key = 'entry:' + id;
      const cur = app.get(id);
      const saleJV = v.VoucherType === 'JV' && v.lines.some(z => z.AccountID === SALE_ACCOUNT_ID);
      const kind = saleJV ? (l.Debit > 0 ? 'credit' : 'borrow') : (l.Debit > 0 ? 'payment' : 'collection');
      const data = { type: 'entry', kind, partyId: acctIds.get(l.AccountID), amount: paisa(l.Debit || l.Credit), date,
        note: noteOf(l), dailyIncluded: false, deleted: false, posCode: code };
      if (!data.amount) continue;
      log(`${cur ? 'App mein badla' : 'App mein aaya'}: ${code} · ${acct.get(data.partyId).name} · Rs ${rupees(data.amount)}`);
      const rec = await appWrite(id, data, cur);
      await setLink(key, { voucherId: v.VoucherID, code, simple: v.lines.length === 2 && byAcc.size === 1, posHash: posH, appHash: appHashEntry(rec) });
    }
  }

  // ---------- POS mein delete hue ----------
  const alive = new Set((await pool.request().query(`SELECT VoucherID FROM dbo.Voucher
    WHERE VoucherType IN ('CPV','CRV','JV','BPV','BRV') AND VoucherStatusID <> 3`)).recordset.map(r => r.VoucherID));
  for (const [k, l] of [...links]) {
    if (!l.voucherId || alive.has(l.voucherId) || l.deleted) continue;
    const ids = k.startsWith('transfer:') ? [`transfer-${k.slice(9)}-out`, `transfer-${k.slice(9)}-in`] : [k.slice(6)];
    for (const id of ids) {
      const cur = app.get(id);
      if (cur && !cur.deleted) {
        log(`POS mein delete hua, app se bhi: ${cur.note || id}`);
        const rec = await appWrite(id, { ...cur, deleted: true }, cur);
        await setLink(k, { appHash: appHashEntry(rec) });
      }
    }
    await setLink(k, { voucherId: 0, deleted: true });
  }
}

// ============================================================
async function once() {
  if (fs.existsSync(path.join(DIR, 'khata-sync.pause'))) { log('Ruka hua (khata-sync.pause file mojood hai)'); return; }
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const acct = new Map();
    await syncAccounts(pool, acct);
    await syncEntries(pool, acct);
  } finally {
    await pool.close();
  }
}

(async () => {
  if (process.argv.includes('--print-voucher')) {
    const code = process.argv[process.argv.indexOf('--print-voucher') + 1];
    const ok = await reprintVoucher(code);
    process.exit(ok ? 0 : 1);
  }
  console.log(`pos-khata-sync v8${DRY ? ' (DRY — kuch nahi likhega)' : ''}`);
  await listenApp();
  await loadLinks();
  log(`App records: ${app.size} · links: ${links.size}`);
  if (!AUTO) { await once(); log('Ho gaya.'); process.exit(0); }
  let busy = false, again = false, timer = null;
  const tick = async () => {
    if (busy) { again = true; return; }
    busy = true;
    do {
      again = false;
      try { await once(); } catch (e) { log('Masla: ' + e.message); }
    } while (again);
    busy = false;
  };
  // app mein entry aayi: 3 second ruk kar (taake saath wali entries bhi aa jayein) foran sync
  kick = () => { if (timer) return; timer = setTimeout(() => { timer = null; tick(); }, 3000); };
  await tick();
  setInterval(tick, LOOP_SECONDS * 1000);
})().catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
