// ============================================================
//  pos-khata-sync.js — Blue Khata app  <->  POS  (dono taraf)
//  2026-10-21: 📝 malik — "Tafseel ka lafz Urdu mein bara, har print par": Urdu line 'تفصیل: …' (52px) — AI 4 s mein na aaye to bhi (urdu-names v1.6 roman2ur)
//  2026-10-20: 📅 har voucher par Urdu tareekh bari (upar + neeche) · 📝 Tafseel Urdu bari (AI, urdu-names v1.5 fillNotes, 4 s) · 🏦 HBL Urdu sar-khi · dobara print: udhar sale ka sahi naam, BPV/BRV naam
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
//  2026-10-12: ⚡ tez raasta (quickEntries) — nayi payment / wasooli / udhar entry ka voucher + parchi seconds mein, poora sync baad mein.
//  2026-10-12: 🛒 app purchase ki parchi + samaan ki chhoti tasveer (photo-print.js, jpeg-decode.js).
//  2026-10-12: 🖨 printer ki haalat — printConfig.voucherLog / vLast / vErr / vAlive, entry par posPrintedAt / posPrintErr, printJobs kind voucher = dobara print.
//  2026-10-15: 💰 galla ki Urdu parchi (galla-parchi.js) — naqad supplier ki payment check hone par EK dafa (gallaCalls prnState).
//  2026-10-12: 🏦 HBL parchi — HBL account / HBL SMS-email wali entry: upar bara ulta "HBL", barcode nahi, raqam + baqaya lafzon mein (inWords, lakh/crore).
//  v8: voucher rasid (CPV/CRV/Transfer/Udhar) notepad ki jagah seedha TM-T88IV par, sale rasid jaisi
// ============================================================

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
require('./proc-fill.js').patch(sql, m => console.log(`[${new Date().toLocaleTimeString()}]`, m));   // 2026-10-20: POS update ke naye proc params khud (proc-fill.js)
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
// 2026-10-01 HEARTBEAT: har 30 sec '<script>.alive' mein waqt — doctor 3 min purana dekhe to script ko latki samajh kar dobara chalata hai
const ZINDA = (() => { try { return require('./zinda.js')(__filename, { sql: true }); } catch (e) { const f = require('path').join(__dirname, require('path').basename(__filename, '.js') + '.alive'), w = () => { try { require('fs').writeFileSync(f, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); return { beat: w, guard: fn => fn }; } })();   // 2026-10-11: 💓 sachi dhadkan (zinda.js) — purani 30-sec khud-likhne wali hatayi
const DRY = process.argv.includes('--dry');
const AUTO = process.argv.includes('--auto');
const WRITER = 'pos-sync';
const STATE_FILE = path.join(DIR, 'pos-khata-state.json');
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);

const SQL_CONFIG = require('./sql-config.js');   // v2026-09-25: setting local-config.json se (PC Doctor)
SQL_CONFIG.options = { ...(SQL_CONFIG.options || {}), useUTC: false };

if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const UR = require('./urdu-names.js'); UR.watch(db, BUSINESS_ID, m => log(m));   // 2026-10-14: 🔤 voucher par party ke Urdu naam
// 2026-10-14: 🤖 jin parties ka Urdu naam nahi — Server PC khud AI se (har 10 min, pehli dafa 1 min baad). Print ke waqt AI nahi.
const urFill = () => UR.fillParties({ db, businessId: BUSINESS_ID, parties: [...app.values()].filter(r => r && r.type === 'party' && !r.deleted), log }).catch(() => {});
setTimeout(urFill, 60000).unref?.(); setInterval(urFill, 10 * 60000).unref?.();   // unref: --print-voucher jaise ek-dafa kaam par script na atke
let PARCHI = null; const getParchi = () => PARCHI || (PARCHI = require('./nt-parchi.js').make({ dir: DIR, width: PRINT_WIDTH, dots: 512 }));
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
let kick = null, fresh = new Set(), lastAcct = null;
const inFlight = new Set(), syncMine = new Set();   // ⚡ tez raasta aur poora sync aik hi entry do baar na banayein   // app mein nayi/badli entry aate hi sync foran chalane ke liye
function listenApp() {
  return new Promise((resolve, reject) => {
    khata.onSnapshot(s => {
      let userChange = false;
      s.docChanges().forEach(c => {
        if (c.type === 'removed') app.delete(c.doc.id);
        else app.set(c.doc.id, { ...c.doc.data(), id: c.doc.id });
        if (c.type === 'removed' || c.doc.data().updatedBy !== WRITER) userChange = true;
        if (appReady && c.type !== 'removed' && c.doc.data().type === 'entry' && c.doc.data().updatedBy !== WRITER) fresh.add(c.doc.id);   // 2026-10-12: ⚡ tez raasta
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
// ⚡ tez raasta + poora sync saath chal sakte hain -> POS mein voucher aik waqt mein aik hi likha jaye (code / number takrao na)
let pwvLock = Promise.resolve();
function posWriteVoucher(pool, o) { const p = pwvLock.then(() => posWriteVoucherRaw(pool, o)); pwvLock = p.catch(() => {}); return p; }
async function posWriteVoucherRaw(pool, { voucherId = 0, type, date, remarks, marker, lines }) {
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
// 2026-10-02: larke ki CASH purchase jo POS ke purchase bill se juri ho = us bill ki CASH ADAYGI (app mein payment jaisi, POS mein CPV)
const CASH_LINK_FROM = '2026-09-20';
const cashPays = e => e.kind === 'purchaseCash' && !e.deleted && String(e.date || '') >= CASH_LINK_FROM && ((Array.isArray(e.posBillIds) && e.posBillIds.length > 0) || !!e.posBill);
function appBalance(partyId, skip) {   // 2026-10-09: skip = in entries ke baghair (parchi ka "Sabqa baqaya")
  const p = app.get(partyId);
  let b = p?.opening || 0;
  for (const e of app.values()) {
    if (e.type !== 'entry' || e.deleted || e.partyId !== partyId) continue;
    if (skip && skip.has(e.id)) continue;
    if (['credit', 'payment'].includes(e.kind) || cashPays(e)) b += e.amount;
    else if (['borrow', 'collection'].includes(e.kind)) b -= e.amount;
  }
  return b;
}
// 2026-10-12: raqam LAFZON mein (Pakistani lakh / crore) — HBL parchi par (malik: "lambe lafzo main")
function inWords(rs) {
  let n = Math.floor(Math.abs(Number(rs) || 0)); if (!n) return 'Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = [], cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push((cr > 999 ? inWords(cr).replace(/^Rupees | Only$/g, '') : three(cr)) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}
// 2026-10-14: 🔤 voucher par URDU — malik: "jitna bhi print … urdu bhi saath". Party ka Urdu naam blueAccess/urduParties (app: 🖨 Print setting),
//   pid na ho (POS se dobara print) to app ke khaton mein naam se. Setting printConfig.urduSlip. Urdu wali parchi nt-parchi worker se (tasveer).
const UR_TITLE = { 'TRANSFER VOUCHER': 'ٹرانسفر واؤچر', 'CASH PAYMENT VOUCHER': 'رقم دی گئی', 'CASH RECEIPT VOUCHER': 'رقم وصول ہوئی', 'UDHAR SALE VOUCHER': 'ادھار سیل', 'KHARCHA VOUCHER': 'خرچہ', 'PURCHASE - CASH': 'خریداری — نقد', 'PURCHASE - UDHAR': 'خریداری — ادھار', 'BANK PAYMENT VOUCHER': 'بینک سے ادائیگی', 'BANK RECEIPT VOUCHER': 'بینک میں وصولی' };
const nameKey = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function urPartyOf(l) {
  if (!UR.isOn() || !l) return '';
  let ur = l.pid ? UR.party(l.pid) : '';
  if (!ur && l.name) { const k = nameKey(l.name); if (k) for (const r of app.values()) if (r && r.type === 'party' && !r.deleted && nameKey(r.name) === k) { ur = UR.party(r.id); if (ur) break; } }
  return ur;
}
// 2026-10-16: 🔠 BARA NAAM + BARI RAQAM (malik: "Arman palydar 500 bara ho, baqi lafz chhote — galle wala banda paise de de").
//   Party ka naam 2 guna (English) + Urdu 60px, raqam 3 guna; voucher no / tareekh / sabqa / ab baqaya chhote (Font B).
//   Setting blueAccess/printConfig.bigSlip (default ON; app: 🖨 Print setting). Band = purani parchi. HBL parchi wahi purani.
let BIG_SLIP = true;
// 2026-10-17: 💵 PAYMENT DE DO / COPY (malik: "purchase cash ka koi bhi print dobara print karne se waisa nahi hoga jis par likha ho
//   payment de do bara sa"). Cash purchase (PURCHASE - CASH, ya POS bill se juri cash purchase ka CPV) ki PEHLI parchi = bara
//   "ادائیگی کر دیں · PAYMENT DE DO" — galla isi se paise de. Dobara print (aur har CPV ki dobara) = bara "کاپی — ادائیگی نہیں ·
//   COPY - PAYMENT NAHI". Pehli parchi chhapi hi nahi thi (posPrintedAt nahi) to agli = pehli. printConfig.payDo (default ON).
let PAY_DO = true;
const payMark = (pay, ur, big, C) => {   // pay 'do' | 'copy' — ulta (kala) bara patta + Urdu
  if (pay !== 'do' && pay !== 'copy') return [];
  const GS = '\x1d', rv = t => GS + 'B\x01' + t + GS + 'B\x00', o = [''];
  if (UR.isOn()) o.push(UR.line(pay === 'do' ? 'ادائیگی کر دیں' : 'کاپی — ادائیگی نہیں', pay === 'do' ? 64 : 50, 1));
  o.push(C + rv(big(pay === 'do' ? ' PAYMENT DE DO ' : ' COPY-PAYMENT NAHI ')), '');
  return o;
};
// 2026-10-18: 📅 BARI TAREEKH (malik: "ya bill kal ki date ka hai — upar likha ho bara sa aur neeche"). Voucher ki tareekh upar aur neeche 2 guna;
//   aaj ka nahi to kala patta "KAL KA BILL" / "N DIN PURANA" + Urdu. Print ka waqt ALAG ("Print: 18-Oct 12:50 pm") — pehle voucher ki tareekh ke
//   saath aaj ka waqt chhapta tha (17-Oct 12:50 pm = dhoka).
function dateInfo(date, now = new Date()) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? new Date(date + 'T00:00:00') : new Date(date);
  if (isNaN(d)) return null;
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()), n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), age = Math.round((n0 - d0) / 864e5);
  return { age, txt: `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()].toUpperCase()} ${d.getFullYear()}` };
}
const printStamp = (now = new Date()) => { const hh = now.getHours() % 12 || 12; return `Print: ${String(now.getDate()).padStart(2, '0')}-${MON[now.getMonth()]} ${hh}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'am' : 'pm'}`; };
const dateMark = (date, big, C, where) => {   // where 'top' | 'bot'
  const I = dateInfo(date); if (!I) return [];
  const GS = '\x1d', rv = t => GS + 'B\x01' + t + GS + 'B\x00', o = [];
  if (UR.isOn() && UR.dateLine) o.push(UR.dateLine(date, 56));   // 2026-10-20: 📅 Urdu tareekh bari (آج — ۲۰ اکتوبر ۲۰۲۶ / کل کا بل — … / N دن پرانا — …) upar + neeche
  if (I.age === 0) { o.push(C + big('AAJ - ' + I.txt)); return o; }
  const tag = I.age === 1 ? 'KAL KA BILL' : I.age > 1 ? I.age + ' DIN PURANA' : 'AAGE KI TAREEKH';
  if (where === 'top') o.push(C + rv(big(' ' + tag + ' ')));
  o.push(C + big(I.txt));
  if (where === 'bot') o.push(C + rv(' ' + tag + ' '));
  return o;
};
function receiptBig({ title, code, date, lines, note, copy, pay }) {
  const W = PRINT_WIDTH, WB = 56;                                  // Font A 42 / Font B 56 akshar (TM-T88IV 80mm)
  const n = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const rowW = (w, l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, w - l.length - r.length))).slice(0, w - r.length) + r; };
  const ESC = '\x1b', GS = '\x1d';
  const C = ESC + 'a\x01', L = ESC + 'a\x00';
  const sm = t => ESC + '!\x01' + t + ESC + '!\x00';               // chhota (Font B)
  const smb = t => ESC + '!\x09' + t + ESC + '!\x00';              // chhota mota
  const bold = t => ESC + 'E\x01' + t + ESC + 'E\x00';
  const big2 = t => ESC + '!\x38' + t + ESC + '!\x00';              // 2 guna + mota (naam)
  const huge = t => GS + '!' + (t.length <= 14 ? '\x22' : '\x11') + ESC + 'E\x01' + t + ESC + 'E\x00' + GS + '!\x00';   // 3 guna raqam (lambi ho to 2 guna)
  const hr = '-'.repeat(W), hrB = sm('-'.repeat(WB));
  const bar = c => { c = ascii(c); return c ? GS + 'h\x40' + GS + 'w\x02' + GS + 'H\x00' + GS + 'k\x49' + String.fromCharCode(c.length + 2) + '{B' + c : ''; };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? new Date(date + 'T00:00:00') : new Date(date);
  const dt = isNaN(d) ? String(date) : `${String(d.getDate()).padStart(2, '0')}-${MON[d.getMonth()]}-${d.getFullYear()}`;
  const now = new Date(), hh = now.getHours() % 12 || 12;
  const tm = `${hh}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'am' : 'pm'}`;
  const out = [ESC + '@', C + bold('NOOR TRADERS') + sm('  ' + SHOP_PHONE), bold(title)];
  if (UR.isOn() && UR_TITLE[title]) out.push(UR.line(UR_TITLE[title], 30, 1));
  if (copy) out.push(sm('(Dobara print)'));
  out.push(...payMark(pay, true, big2, C));
  out.push(...dateMark(date, big2, C, 'top'));   // 2026-10-18: 📅 bari tareekh
  out.push(L + sm(rowW(WB, ascii(code), 'Tareekh: ' + dt)), L + sm(rowW(WB, '', printStamp(now))), C + bar(code), L + hr);
  let total = 0; const many = lines.length > 1;
  for (const l of lines) {
    total = Math.max(total, Number(l.amount) || 0);
    const nm = ascii(l.name);
    if (many) out.push(L + smb(String(l.label || '').toUpperCase()));
    for (const x of (nm ? wrap(nm.toUpperCase(), Math.floor(W / 2)).slice(0, 3) : ['(NAAM URDU MEIN)'])) out.push(C + big2(x.trim()));
    { const ur = urPartyOf(l); if (ur) out.push(UR.line(ur, 60, 1)); }
    if (many) out.push(hr);
  }
  if (!many && lines[0]) out.push(L + hr, C + smb(String(lines[0].label || '').toUpperCase()));
  out.push(C + huge('Rs.' + n(total)), '');
  if (pay === 'copy') out.push(C + smb('*** COPY - IS PAR PAISE NA DEIN ***'), '');
  out.push(L + hr);
  // sabqa + ab baqaya — chhote (Font B), do party hon to naam saath
  for (const l of lines) {
    if (l.before == null && l.after == null) continue;
    const who = many ? (ascii(l.name) || 'Party').slice(0, 20) + ': ' : '';
    const side = v => (v > 0 ? 'Lene ' : v < 0 ? 'Dene ' : '') + 'Rs.' + n(Math.abs(v));
    if (l.before != null) out.push(sm(rowW(WB, who + 'Sabqa baqaya:', side(Number(l.before) || 0))));
    if (l.after != null) { const a = Number(l.after) || 0; out.push(smb(rowW(WB, who + 'Ab baqaya - ' + (a > 0 ? 'LENE' : a < 0 ? 'DENE' : 'BARABAR') + ':', 'Rs.' + n(Math.abs(a))))); }
  }
  const nl = wrap(note, WB);
  if (nl.length) out.push(hrB, ...(UR.note ? [UR.note(note, 52, 'تفصیل')].filter(Boolean) : []), sm('Tafseel:'), ...nl.map(sm));   // 2026-10-20: 📝 Tafseel Urdu (AI, print se pehle fillNotes)
  out.push(hrB, ...dateMark(date, big2, C, 'bot'), L + '', sm('Dastakhat: ______________________'), '', C + sm('Blue Khata app'), L, '', '');
  out.push(GS + 'V\x42\x00');                                    // kaghaz kaato
  return out.join('\r\n');
}
function receipt({ title, code, date, lines, note, copy, bank, pay }) {
  if (bank || !PAY_DO) pay = '';
  if (!bank && BIG_SLIP) return receiptBig({ title, code, date, lines, note, copy, pay });
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

  // 2026-10-12: 🏦 HBL PARCHI (sirf HBL account / HBL SMS-email wali entry) — upar bara ulta "HBL", barcode nahi, raqam + baqaya lafzon mein
  const huge = t => GS + '!\x33' + t + GS + '!\x00', rev = t => GS + 'B\x01' + t + GS + 'B\x00';
  const words = v => wrap(inWords(v), W - 2).map(x => '  ' + x.trim());
  const out = bank
    ? [ESC + '@', C + rev(huge(' HBL ')), '', bold('NOOR TRADERS') + '  ' + SHOP_PHONE, '', tall(bank.dir === 'out' ? 'HBL SE PAISE GAYE' : 'HBL MEIN PAISE AAYE')]
    : [ESC + '@', C + big('NOOR TRADERS'), SHOP_PHONE, '', tall(title)];
  if (!bank && UR.isOn() && UR_TITLE[title]) out.push(UR.line(UR_TITLE[title], 40));   // 2026-10-14: 🔤 Urdu
  if (bank && UR.isOn()) { out.push(UR.line(bank.dir === 'out' ? 'ایچ بی ایل سے پیسے گئے' : 'ایچ بی ایل میں پیسے آئے', 50, 1)); if (UR.dateLine) out.push(UR.dateLine(date, 56)); }   // 2026-10-20: 🏦 Urdu sar-khi + tareekh
  if (copy) out.push('(Dobara print)');
  out.push(...payMark(pay, false, big, C));   // 2026-10-17: 💵 payment de do / copy
  if (!bank) out.push(...dateMark(date, big, C, 'top'));   // 2026-10-18: 📅 bari tareekh
  if (bank) out.push(L + hr, row('Tareekh: ' + dt, 'Waqt: ' + tm), row('Voucher: ' + ascii(code), ''), L + hr);
  else out.push(L + hr, row('Voucher No: ' + ascii(code), ''), row('Tareekh: ' + dt, ''), row('', printStamp(now)), C + bar(code), L + hr);
  let total = 0; const bq = [];
  for (const l of lines) {
    total = Math.max(total, Number(l.amount) || 0);
    out.push(bold(ascii(l.name).slice(0, W) || '(naam Urdu mein)'));
    { const ur = urPartyOf(l); if (ur) out.push(UR.line(ur, 44)); }   // malik: font bara   // 2026-10-14: 🔤 party ka Urdu naam
    if (l.before != null) { const b0 = Number(l.before) || 0; out.push(bold(row('  Sabqa baqaya:', (b0 > 0 ? 'Lene ' : b0 < 0 ? 'Dene ' : '') + 'Rs.' + n(Math.abs(b0))))); }   // 2026-10-09: malik — sabqa raqam upar
    out.push(row('  ' + l.label, 'Rs.' + n(l.amount)));
    if (l.after != null) bq.push(l);
  }
  out.push(hr, R + big('Rs.' + n(total)), L);
  if (pay === 'copy') out.push(C + bold('*** COPY - IS PAR PAISE NA DEIN ***'), L);
  if (bank) out.push(...words(total));
  // 2026-10-09: AB BAQAYA bhi BARA (malik: "baqaya wali raqam bhi big size mein") — mota "Ab baqaya - LENE / DENE", raqam double size;
  //   do party hon (transfer voucher) to har ek ka naam saath. Pehle chhoti line upar thi — ab sirf yahan (do dafa nahi).
  for (const l of bq) {
    const a = Number(l.after) || 0, side = a > 0 ? ' - LENE' : a < 0 ? ' - DENE' : ' - BARABAR';
    const who = bq.length > 1 ? (ascii(l.name) || 'Party').slice(0, 16) + ': ' : '';
    out.push(L + hr, bold((who + 'Ab baqaya' + side).slice(0, W)));
    if (UR.isOn()) out.push(UR.line((bq.length > 1 && urPartyOf(l) ? urPartyOf(l) + ': ' : '') + 'اب بقایا — ' + (a > 0 ? 'لینے ہیں' : a < 0 ? 'دینے ہیں' : 'برابر'), 36));   // 2026-10-14
    out.push(R + big('Rs.' + n(Math.abs(a))));
    if (bank) out.push(L + words(a).join('\r\n'));
  }
  if (bq.length) out.push(L + hr);
  const nl = wrap(note, W);
  if (nl.length) out.push(...(UR.note ? [UR.note(note, bank ? 46 : 52, 'تفصیل')].filter(Boolean) : []), L + 'Tafseel:', ...nl, hr);   // 2026-10-20: 📝 Tafseel Urdu
  if (!bank) out.push(...dateMark(date, big, C, 'bot'), L + hr);
  out.push('', '', 'Dastakhat: ______________________', '', C + 'Blue Khata app', L, '', '', '');
  out.push(GS + 'V\x42\x00');                                    // kaghaz kaato
  return out.join('\r\n');
}
// RAW print: ESC/POS bytes seedha PRINTER_NAME ko (sale-post.js wala tareeqa, apni alag files)
const RAW_PS = String.raw`param([string]$Printer, [string]$Bin)
$ErrorActionPreference='Stop'
$bytes=[System.IO.File]::ReadAllBytes($Bin)
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
[RawCached]::Send($Printer,$bytes,'Voucher')
`;
// 2026-10-12: 🖨 PRINTER KI HAALAT (TSC label jaisa) — har parchi blueAccess/printConfig.voucherLog (aakhri 20) + vLast / vErr / vAlive.
//   App har entry par chip dikhati hai (posPrintedAt / posPrintErr) aur "🖨 Dobara print" = printJobs {kind:'voucher', id: CPV-…} (yahi script chhapta hai).
let lastPrintErr = '', vlog = null;
const cfgDoc = () => biz.collection('blueAccess').doc('printConfig');
try { cfgDoc().onSnapshot(s => { BIG_SLIP = !(s.exists && (s.data() || {}).bigSlip === false); PAY_DO = !(s.exists && (s.data() || {}).payDo === false); }, () => {}); } catch {}   // 2026-10-17: 💵 payDo   // 2026-10-16: 🔠 bara naam + raqam
async function logPrint(e) {
  if (DRY) return;
  try {
    if (!vlog) { const s = await cfgDoc().get(); vlog = (s.exists && Array.isArray(s.data().voucherLog)) ? s.data().voucherLog : []; }
    vlog = vlog.concat([{ code: String(e.code || ''), name: ascii(e.name).slice(0, 40), amt: Number(e.amt) || 0, at: Date.now(), ok: !!e.ok, err: e.ok ? '' : String(e.err || lastPrintErr || 'print nahi hua').slice(0, 120), again: !!e.again, bank: !!e.bank }]).slice(-20);
    await cfgDoc().set({ voucherLog: vlog, vLast: Date.now(), vErr: e.ok ? '' : String(e.err || lastPrintErr || '').slice(0, 160), vAlive: Date.now() }, { merge: true });
  } catch (er) { log('printConfig haalat nahi likhi: ' + er.message); }
}
let aliveAt = 0;
async function beatPrinter() { if (DRY || Date.now() - aliveAt < 5 * 60000) return; aliveAt = Date.now(); try { await cfgDoc().set({ vAlive: aliveAt }, { merge: true }); } catch {} }
// 2026-10-15: printer ek waqt ek kaam (voucher + 💰 galla parchi aapas mein na takrayein)
let prQ = Promise.resolve();
const withPrinter = fn => { const p = prQ.then(fn, fn); prQ = p.catch(() => {}); return p; };
const printReceipt = text => withPrinter(() => printReceipt0(text));
async function printReceipt0(text) {
  if (!AUTO_PRINT || DRY) return false;
  if (UR.fillNotes) { try { text = await UR.fillNotes(text, 4000); } catch { text = UR.strip(text); } }   // 2026-10-20: 📝 Tafseel Urdu (AI 4 s; na aaye = English hi)
  if (UR.has(text)) {   // 2026-10-14: 🔤 Urdu tasveer — nt-parchi worker (tez). Exception = bina Urdu purana tareeqa. Printer ki ghalti = dobara nahi.
    try { const P = getParchi(), e = await P.sendJobs([UR.toJob(text, { font: P.FONT_UR, dots: 512 })], PRINTER_NAME);
      lastPrintErr = e ? String(e.message || e).slice(0, 160) : ''; log(e ? 'Print nahi hua: ' + lastPrintErr : 'Voucher rasid print ho gayi (Urdu)'); return !e; }
    catch (er) { log('Urdu parchi masla: ' + er.message + ' — bina Urdu'); text = UR.strip(text); }
  }
  const bin = path.join(DIR, 'khata-print.bin'), ps = path.join(DIR, 'khata-raw-print.ps1');
  fs.writeFileSync(bin, Buffer.from(text, 'latin1'));
  fs.writeFileSync(ps, RAW_PS.replace(/\r?\n/g, '\r\n'));
  return new Promise(res => require('child_process').execFile('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Printer', PRINTER_NAME, '-Bin', bin], { timeout: 30000 }, (err, so, se) => {
      lastPrintErr = err ? (String(se || '').trim().split(/\r?\n/)[0] || err.message).slice(0, 160) : '';
      log(err ? 'Print nahi hua: ' + lastPrintErr : 'Voucher rasid print ho gayi');
      res(!err);
    }));
}
// node pos-khata-sync.js --print-voucher CPV-000123  -> POS ka koi bhi voucher dobara print (kuch save nahi hota)
async function reprintVoucher(code, copies = 1, fromJob = false) {
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
    const rem = String(rows[0].VoucherRemarks || ''), bank = /^HBL (aaye|gaye)/.test(rem.trim()) ? { dir: /^HBL gaye/.test(rem.trim()) ? 'out' : 'in' } : null;   // 2026-10-12: HBL design
    // 2026-10-17: 💵 CPV dobara = COPY-PAYMENT NAHI; sirf cash purchase jis ki pehli parchi chhapi hi nahi thi = PAYMENT DE DO
    const e0 = [...app.values()].find(e => e.type === 'entry' && !e.deleted && String(e.posCode || '').trim() === String(code).trim());
    const pay = type !== 'CPV' ? '' : e0 && e0.kind === 'purchaseCash' && !e0.posPrintedAt ? 'do' : 'copy';
    let ok = false;
    for (let i = 0; i < Math.min(3, Math.max(1, Number(copies) || 1)); i++) ok = await printReceipt(receipt({ title: type === 'JV' && /^udhar sale/i.test(rem.trim()) ? 'UDHAR SALE VOUCHER' : VTITLE[type] || type + ' VOUCHER',   // 2026-10-20: udhar sale ka dobara print "TRANSFER VOUCHER" likhta tha code: rows[0].VoucherCode, date: rows[0].VoucherDate,
      lines, note: rem, copy: true, bank, pay }));
    if (fromJob) {
      const ids = [...app.values()].filter(e => e.type === 'entry' && String(e.posCode || '').trim() === String(code).trim()).map(e => e.id);
      if (ok && ids.length) await markApp(ids, { posPrintedAt: Date.now(), posPrintErr: '' });
      await logPrint({ code, name: lines.map(l => l.name).join(' / '), amt: Math.max(0, ...lines.map(l => Number(l.amount) || 0)), ok, again: true, bank: !!bank });
    }
    return ok;
  } finally { await pool.close(); }
}
// 2026-10-12: kya yeh HBL ka len-den hai? (bank account wala khata, ya HBL SMS / email se bani entry) -> { dir: 'in' | 'out' } warna null
function bankSlip(base, isTransfer) {
  const isB = id => !!(id && app.get(id) && app.get(id).bank);
  if (isTransfer) { if (isB(base.fromPartyId)) return { dir: 'out' }; if (isB(base.toPartyId)) return { dir: 'in' }; }
  else if (isB(base.partyId)) return { dir: base.kind === 'collection' || base.kind === 'borrow' ? 'out' : 'in' };
  const nt = String(base.note || '');
  if (base.bankSms || /^HBL (aaye|gaye) /.test(nt)) return { dir: /^HBL gaye/.test(nt) || (!isTransfer && base.kind === 'payment' && !isB(base.partyId)) ? 'out' : 'in' };
  return null;
}
const VTITLE = { CPV: 'CASH PAYMENT VOUCHER', CRV: 'CASH RECEIPT VOUCHER', JV: 'TRANSFER VOUCHER', BPV: 'BANK PAYMENT VOUCHER', BRV: 'BANK RECEIPT VOUCHER' };

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
    if ((e.purchase && e.kind !== 'purchaseCash') || String(e.id).startsWith('pos-')) continue;          // sync.js wali purchase / sabqa (cash purchase neeche)
    if (e.posNo === true) continue;   // 2026-10-12: HBL se bill (GEPCO) — bank se kharcha, POS mein voucher nahi (galla / cash ka nahi)
    let base = e;
    if (isTransfer) {
      base = app.get(`transfer-${e.transferId}-out`) || e;
      if (!acct.has(base.fromPartyId) || !acct.has(base.toPartyId)) {
        await noteSkip(e, base, true, notInPos(!acct.has(base.fromPartyId) ? base.fromPartyId : base.toPartyId)); continue;
      }
    } else {
      if (e.kind === 'purchaseCash') {   // 2026-10-02: POS bill se juri cash purchase -> POS mein CPV (bill cash mein ada)
        const lk = links.get(key);
        if (cashPays(e)) base = { ...e, kind: 'payment', note: (String(e.note || '').trim() ? String(e.note).trim() + ' · ' : '') + 'Cash purchase (POS bill)' };
        else if (lk && lk.voucherId && !lk.deleted) base = { ...e, kind: 'payment', deleted: true };   // jor toota -> CPV hatao
        else continue;
      } else if (!['payment', 'collection', 'credit'].includes(e.kind)) continue;
      if (!acct.has(e.partyId)) { await noteSkip(e, e, false, notInPos(e.partyId)); continue; }
      // 2026-10-09: "CASH DIYA" (cashpay-: Cash Khata / Daily Sale ke Closing Cash se payment) = dukan ka cash us account ko -> POS mein
      //   CPV (Cash Payment, parchi "Diye"). Pehle 'credit' hone se "Udhar sale" JV banta tha (POS sale mein ghalat). Jo JV ban chuke, wese hi.
      if (String(e.id).startsWith('cashpay-') && e.kind === 'credit') { const lk0 = links.get(key); if (!lk0 || /^CPV/i.test(String(lk0.code || ''))) base = { ...e, kind: 'payment' }; }
    }
    const link = links.get(key);
    const h = appHashEntry(base);
    if (link && link.appHash === h) continue;
    if (!link && inFlight.has(key)) continue;                             // ⚡ tez raasta isay abhi bana raha hai
    if (!link) { inFlight.add(key); syncMine.add(key); }
    if (base.updatedBy === WRITER && link) { await setLink(key, { appHash: h }); continue; }
    if (!link && fromPos) continue;                                        // POS wali, abhi link nahi bana
    if (!link && ms(base.createdAt) < ENABLED_AT && e.kind !== 'purchaseCash') continue;                // purani entry — POS mein nahi bhejni (cash purchase ki hadd CASH_LINK_FROM)
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
          ? [{ pid: base.fromPartyId, name: acct.get(base.fromPartyId).name, label: 'Se (nikla)', amount: amt, after: rupees(appBalance(base.fromPartyId)), before: rupees(appBalance(base.fromPartyId, new Set(docIds))) },
             { pid: base.toPartyId, name: acct.get(base.toPartyId).name, label: 'Ko (gaya)', amount: amt, after: rupees(appBalance(base.toPartyId)), before: rupees(appBalance(base.toPartyId, new Set(docIds))) }]
          : [{ pid: base.partyId, name: acct.get(base.partyId).name, label: base.kind === 'payment' ? 'Diye' : base.kind === 'collection' ? 'Wasool kiye' : 'Udhar', amount: amt,
               after: rupees(appBalance(base.partyId)), before: rupees(appBalance(base.partyId, new Set(docIds))) }];   // 2026-10-09: sabqa = is voucher ke baghair
        const bank = bankSlip(base, isTransfer);   // 2026-10-12: HBL wali entry = HBL parchi
        const printed = await printReceipt(receipt({ title: T, code: r.code, date: base.date, lines: plines, note: String(base.note || '').trim(), bank, pay: e.kind !== 'purchaseCash' ? '' : e.posPrintedAt ? 'copy' : 'do' }));   // 2026-10-17: 💵 juri cash purchase ka CPV — purchase parchi pehle chhap chuki to COPY (do dafa paise nahi)
        if (printed) await markApp(docIds, { posPrintedAt: Date.now(), posPrintErr: '' });
        else await markApp(docIds, { posPrintErr: (lastPrintErr || 'print nahi hua').slice(0, 160), posPrintTry: Date.now() });
        await logPrint({ code: r.code, name, amt, ok: printed, bank: !!bank });
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

// ---------- 2026-10-12: 🧾 KHARCHA PARCHI — akhrajat (Ghar kharcha, Dukan ka kharcha…) POS mein nahi jate, phir bhi parchi nikle (malik) ----------
// Sirf AAJ ki kharcha entry, jis par posPrintedAt / posPrintErr nahi. Kamyab = posPrintedAt; nakam = posPrintErr. Dobara = printJobs id 'EXP:<entryId>'.
const tsOf = v => typeof v === 'number' ? v : Date.parse(v) || 0;
const todayPk = () => { const d = new Date(Date.now() + 5 * 3600000); return d.toISOString().slice(0, 10); };
function expenseSlip(e, copy) {
  return receipt({ title: 'KHARCHA VOUCHER', code: 'KH-' + String(e.id).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase(), date: e.date,
    lines: [{ name: e.account || 'Kharcha', label: 'Kharcha diya', amount: rupees(e.amount) }], note: String(e.note || '').trim(), copy });
}
async function printExpenses() {
  if (DRY || !AUTO_PRINT) return;
  const day = todayPk();
  for (const e of [...app.values()]) {
    if (e.type !== 'entry' || e.kind !== 'expense' || e.deleted || e.date !== day || e.posPrintedAt || e.posPrintErr) continue;
    if (Date.now() - tsOf(e.createdAt) > 20 * 3600000) continue;
    const ok = await printReceipt(expenseSlip(e));
    if (ok) await markApp([e.id], { posPrintedAt: Date.now(), posPrintErr: '' });
    else await markApp([e.id], { posPrintErr: (lastPrintErr || 'print nahi hua').slice(0, 160), posPrintTry: Date.now() });
    await logPrint({ code: 'Kharcha', name: e.account || 'Kharcha', amt: rupees(e.amount), ok });
  }
}

// ---------- 2026-10-12: 🛒 APP PURCHASE KI PARCHI + samaan ki chhoti tasveer (malik) ----------
// App ke Purchase screen ki entry (purchase:true, purchaseCash = cash / borrow = udhar), aaj ki, posPrintedAt / posPrintErr nahi.
// Samaan ki tasveer (goodsPhotos[0] — entry par ya entryPhotos/<id>) chhoti (aadha kaghaz) parchi ke neeche. Bill ki tasveer NAHI.
// Tasveer abhi upload ho rahi ho (pn > 0, 3 min tak) to agle chakkar tak ruko. Dobara = printJobs id 'PUR:<entryId>'.
let PH = null; try { PH = require('./photo-print.js'); } catch (e) { log('photo-print.js nahi mili — purchase parchi tasveer ke baghair'); }
async function goodsPhoto(e) {
  let a = Array.isArray(e.goodsPhotos) ? e.goodsPhotos : [];
  if (!a.length) { try { const d = await biz.collection('entryPhotos').doc(String(e.id)).get(); a = (d.exists && Array.isArray(d.data().goodsPhotos)) ? d.data().goodsPhotos : []; } catch {} }
  return a.find(x => /^data:image\/jpe?g;base64,/i.test(String(x))) || '';
}
async function purchaseSlip(e, copy) {
  const p = app.get(e.partyId), cash = e.kind === 'purchaseCash';
  const pay = !cash ? '' : copy && e.posPrintedAt ? 'copy' : 'do';   // 2026-10-17: 💵 pehli = payment de do, dobara = copy
  const txt = receipt({ title: cash ? 'PURCHASE - CASH' : 'PURCHASE - UDHAR', code: 'PU-' + String(e.id).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase(), date: e.date,
    lines: [{ pid: e.partyId, name: (p && p.name) || 'Supplier', label: cash ? 'Cash diya (maal liya)' : 'Udhar maal liya', amount: rupees(e.amount),
      before: e.partyId ? rupees(appBalance(e.partyId, new Set([e.id]))) : null, after: e.partyId ? rupees(appBalance(e.partyId)) : null }],
    note: String(e.note || '').trim(), copy, pay });
  let photo = '';
  if (PH) { const u = await goodsPhoto(e); if (u) photo = PH.photoRaster(u, 256, 320); }
  if (!photo) return { text: txt, photo: false };
  const cut = '\x1dV\x42\x00', k = txt.lastIndexOf(cut);
  return { text: k >= 0 ? txt.slice(0, k) + 'Samaan ki tasveer:\r\n' + photo + '\r\n\r\n\r\n' + txt.slice(k) : txt + photo, photo: true };
}
async function printPurchases() {
  if (DRY || !AUTO_PRINT) return;
  const day = todayPk();
  for (const e of [...app.values()]) {
    if (e.type !== 'entry' || e.purchase !== true || !['purchaseCash', 'borrow'].includes(e.kind) || e.deleted || e.date !== day || e.posPrintedAt || e.posPrintErr) continue;
    const age = Date.now() - tsOf(e.createdAt); if (age > 20 * 3600000) continue;
    const sl = await purchaseSlip(e);
    if (!sl.photo && Number(e.pn) > 0 && age < 3 * 60000) continue;   // tasveer abhi aa rahi hai
    const ok = await printReceipt(sl.text);
    if (ok) await markApp([e.id], { posPrintedAt: Date.now(), posPrintErr: '' });
    else await markApp([e.id], { posPrintErr: (lastPrintErr || 'print nahi hua').slice(0, 160), posPrintTry: Date.now() });
    const p = app.get(e.partyId); await logPrint({ code: 'Purchase', name: (p && p.name) || 'Purchase', amt: rupees(e.amount), ok });
  }
}

// ---------- 🖨 "Dobara print" hukum (app -> printJobs kind 'voucher') — tick ke andar, SQL pool ek waqt ek ----------
const vJobs = new Map();
function listenVoucherJobs() {
  biz.collection('printJobs').where('kind', '==', 'voucher').where('status', '==', 'new').onSnapshot(s => {
    for (const c of s.docChanges()) if (c.type !== 'removed') vJobs.set(c.doc.id, c.doc.data());
    if (vJobs.size && kick) kick();
  }, e => log('Dobara-print listener masla: ' + e.message));
}
async function runVoucherJobs() {
  for (const [id, j] of [...vJobs]) {
    vJobs.delete(id);
    const ref = biz.collection('printJobs').doc(id);
    try {
      const mine = await db.runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists || s.data().status !== 'new') return false; tx.update(ref, { status: 'printing', startedAt: Date.now() }); return true; });
      if (!mine) continue;
      log(`🖨 Dobara print: ${j.id} (${j.byName || ''})`);
      let ok;
      if (String(j.id).startsWith('PUR:')) {   // purchase parchi dobara (tasveer ke saath)
        const e = app.get(String(j.id).slice(4)); if (!e) throw new Error('Purchase entry nahi mili');
        ok = false; for (let i = 0; i < Math.min(3, Math.max(1, Number(j.copies) || 1)); i++) ok = await printReceipt((await purchaseSlip(e, true)).text);
        if (ok) await markApp([e.id], { posPrintedAt: Date.now(), posPrintErr: '' });
        const p = app.get(e.partyId); await logPrint({ code: 'Purchase', name: (p && p.name) || 'Purchase', amt: rupees(e.amount), ok, again: true });
      } else if (String(j.id).startsWith('EXP:')) {   // kharcha parchi dobara
        const e = app.get(String(j.id).slice(4)); if (!e) throw new Error('Kharcha entry nahi mili');
        ok = false; for (let i = 0; i < Math.min(3, Math.max(1, Number(j.copies) || 1)); i++) ok = await printReceipt(expenseSlip(e, true));
        if (ok) await markApp([e.id], { posPrintedAt: Date.now(), posPrintErr: '' });
        await logPrint({ code: 'Kharcha', name: e.account || 'Kharcha', amt: rupees(e.amount), ok, again: true });
      } else ok = await reprintVoucher(j.id, j.copies, true);
      await ref.update(ok ? { status: 'done', doneAt: Date.now() } : { status: 'error', doneAt: Date.now(), error: (lastPrintErr || 'print nahi hua').slice(0, 200) });
    } catch (e) { log('Dobara print masla: ' + e.message); try { await ref.update({ status: 'error', error: String(e.message).slice(0, 200), doneAt: Date.now() }); } catch {} }
  }
}

// ---------- 2026-10-15: 💰 GALLA KI ADAIGI PARCHI (sirf Urdu, EK dafa) — galla-parchi.js ----------
// Malik: naqad supplier ki payment (purchase "Galla se abhi cash" -> gallaCalls needCheck) — Mubeen / Sonu / Zeeshan / Malik "✓ check" kare
// (app: checkBy / checkName / checkUr / checkAt) -> yahan TM-T88IV par EK Urdu parchi; prnState 'printing' -> 'done' (phir kabhi nahi) / 'err'.
// 'err' par sirf malik app se prnState '' (phir bhejo). Party ka Urdu naam: urduParties; na ho to pehle AI (urdu-names fillParties force).
const GP = require('./galla-parchi.js');
const gJobs = new Set(); let gRun = false;
function listenGallaChecks() {
  biz.collection('gallaCalls').where('needCheck', '==', true).where('status', '==', 'new').onSnapshot(s => {
    for (const d of s.docs) { const c = d.data(); if (c.checkAt && !c.prnState) gJobs.add(d.id); }
    if (gJobs.size) runGalla();
  }, e => log('Galla parchi listener masla: ' + e.message));
}
async function runGalla() {
  if (gRun) return; gRun = true;
  try {
    while (gJobs.size) {
      const id = [...gJobs][0]; gJobs.delete(id);
      const ref = biz.collection('gallaCalls').doc(id);
      try {
        const c = await db.runTransaction(async tx => { const s = await tx.get(ref); const d = s.exists ? s.data() : null;
          if (!d || d.status !== 'new' || !d.needCheck || !d.checkAt || d.prnState) return null; tx.update(ref, { prnState: 'printing', prnStart: Date.now() }); return d; });
        if (!c) continue;
        let pu = UR.partyAny(c.partyId);
        if (!pu || GP.hasLatin(pu)) { try { await UR.fillParties({ db, businessId: BUSINESS_ID, parties: [{ id: c.partyId, name: c.partyName }], log, force: true }); } catch {} pu = UR.partyAny(c.partyId); }
        const cu = String(c.checkUr || '').trim();
        if (!pu || GP.hasLatin(pu)) throw new Error('Party ka Urdu naam nahi bana — app mein party ka Urdu naam likh kar malik "phir bhejo" dabaye');
        if (!cu || GP.hasLatin(cu)) throw new Error('Check karne wale ka Urdu naam nahi — galla setting mein likhein');
        const P = getParchi(), job = GP.slipJob(P.Seg, P.ESC, c, pu, cu);
        const e = AUTO_PRINT && !DRY ? await withPrinter(() => P.sendJobs([job], PRINTER_NAME)) : null;
        if (e) throw new Error('Printer: ' + String(e.message || e).slice(0, 140));
        await ref.update({ prnState: 'done', prnAt: Date.now(), prnErr: '' });
        log(`💰 Galla parchi: ${c.partyName} Rs ${Math.round(c.amount / 100)} · check ${c.checkName || ''}`);
      } catch (er) { log('💰 Galla parchi NAHI: ' + er.message); try { await ref.update({ prnState: 'err', prnErr: String(er.message).slice(0, 200) }); } catch {} }
    }
  } finally { gRun = false; }
}

// ---------- 2026-10-12: ⚡ TEZ RAASTA — nayi app entry (payment / wasooli / udhar) seconds mein POS voucher + parchi ----------
// Malik: "printing bohat late hoti hai, seconds mein karo". Poora sync (sab accounts + sab vouchers) 1 min+ leta tha. Ab app mein nayi
// entry aate hi (0.8 s) sirf USI ka voucher + parchi; baqi milan pehle jaisa poore sync mein. Shart: pichhle poore sync ka accounts naqsha
// (lastAcct), link nahi, POS mein [app:id] wala voucher pehle se nahi. Transfer / purchase / cashpay / purani = poora sync hi.
async function quickEntries() {
  if (DRY || !lastAcct || !fresh.size) return;
  const ids = [...fresh]; fresh.clear();
  const todo = ids.map(id => app.get(id)).filter(e => e && e.type === 'entry' && !e.deleted && !e.transferId && !e.purchase && e.posNo !== true && ['payment', 'collection', 'credit'].includes(e.kind)
    && !/^(pos|cashpay-)/.test(String(e.id)) && !links.has('entry:' + e.id) && lastAcct.has(e.partyId) && ms(e.createdAt) >= ENABLED_AT && Date.now() - ms(e.createdAt) < 30 * 60000);
  if (!todo.length) return;
  const t0 = Date.now(), pool = await qPoolGet();
  for (const e of todo) {
    const key = 'entry:' + e.id;
    if (links.has(key) || inFlight.has(key)) continue;
    inFlight.add(key);
    try {
      const spec = appEntryToVoucher(e, lastAcct); if (!spec) continue;
      const ex = (await pool.request().input('m', sql.VarChar(120), '%[[]app:' + e.id + ']%').query('SELECT TOP 1 VoucherID FROM dbo.Voucher WHERE SystemNote LIKE @m')).recordset[0];
      if (ex) continue;   // pehle ban chuka — poora sync jorega
      const name = lastAcct.get(e.partyId).name;
      const r = await posWriteVoucher(pool, { voucherId: 0, type: spec.type, date: e.date, remarks: spec.remarks, marker: e.id, lines: spec.lines });
      await setLink(key, { appHash: appHashEntry(e), voucherId: r.voucherId, code: r.code, posHash: null });
      await markApp([e.id], { posCode: r.code, posError: null });
      log(`⚡ POS mein bana (tez): ${spec.type} · ${name} · Rs ${rupees(e.amount)} · ${r.code} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      const T = { CPV: VTITLE.CPV, CRV: VTITLE.CRV, JV: 'UDHAR SALE VOUCHER' }[spec.type] || spec.type, amt = rupees(e.amount), docIds = [e.id];
      const plines = [{ pid: e.partyId, name, label: e.kind === 'payment' ? 'Diye' : e.kind === 'collection' ? 'Wasool kiye' : 'Udhar', amount: amt, after: rupees(appBalance(e.partyId)), before: rupees(appBalance(e.partyId, new Set(docIds))) }];
      const bank = bankSlip(e, false);
      const printed = await printReceipt(receipt({ title: T, code: r.code, date: e.date, lines: plines, note: String(e.note || '').trim(), bank, pay: e.kind !== 'purchaseCash' ? '' : e.posPrintedAt ? 'copy' : 'do' }));   // 2026-10-17: 💵
      if (printed) await markApp(docIds, { posPrintedAt: Date.now(), posPrintErr: '' });
      else await markApp(docIds, { posPrintErr: (lastPrintErr || 'print nahi hua').slice(0, 160), posPrintTry: Date.now() });
      await logPrint({ code: r.code, name, amt, ok: printed, bank: !!bank });
    } catch (err) { log(`⚡ tez raasta (${e.id}) masla: ${err.message} — poora sync banayega`); if (/connect|socket|closed|timeout/i.test(err.message)) await qPoolDrop(); }
    finally { inFlight.delete(key); }
  }
}
// tez raaste ka apna SQL pool (poora sync apna pool band karta hai — is par asar na ho)
let qPool = null;
async function qPoolGet() {
  if (qPool && qPool.connected) return qPool;
  await qPoolDrop();
  qPool = new sql.ConnectionPool({ ...SQL_CONFIG, pool: { max: 2, min: 0, idleTimeoutMillis: 120000 } });
  await qPool.connect();
  return qPool;
}
async function qPoolDrop() { const p = qPool; qPool = null; if (p) await p.close().catch(() => {}); }
// tez kaam (nayi entry ki parchi + kharcha + purchase parchi) — poore sync ke chalte hue bhi foran; khud aik waqt mein aik
let qBusy = false, qAgain = false;
async function quickRun() {
  if (qBusy) { qAgain = true; return; }
  qBusy = true;
  try {
    do {
      qAgain = false;
      try { await quickEntries(); } catch (e) { log('⚡ tez raasta masla: ' + e.message); }
      try { await printExpenses(); await printPurchases(); } catch (e) { log('Print kaam masla: ' + e.message); }
    } while (qAgain);
  } finally { qBusy = false; }
}

// ============================================================
async function once() {
  if (fs.existsSync(path.join(DIR, 'khata-sync.pause'))) { log('Ruka hua (khata-sync.pause file mojood hai)'); return; }
  const pool = await sql.connect(SQL_CONFIG);
  try {
    const acct = new Map();
    await syncAccounts(pool, acct);
    lastAcct = acct;   // ⚡ tez raasta isi naqshe se
    try { await syncEntries(pool, acct); }
    finally { for (const k of syncMine) inFlight.delete(k); syncMine.clear(); }
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
  if (AUTO && !DRY) listenVoucherJobs();   // 2026-10-12: 🖨 dobara print
  if (AUTO && !DRY) listenGallaChecks();   // 2026-10-15: 💰 galla ki Urdu parchi
  log(`App records: ${app.size} · links: ${links.size}`);
  if (!AUTO) { await once(); log('Ho gaya.'); process.exit(0); }
  let busy = false, again = false, timer = null;
  const tick = async () => {
    if (busy) { again = true; return; }
    busy = true;
    do {
      again = false;
      await quickRun();   // pehle tez (seconds), phir poora milan
      try { await runVoucherJobs(); } catch (e) { log('Print kaam masla: ' + e.message); }
      try { await once(); } catch (e) { log('Masla: ' + e.message); }
      try { await beatPrinter(); } catch {}
    } while (again);
    busy = false;
  };
  // app mein entry aayi: 3 second ruk kar (taake saath wali entries bhi aa jayein) foran sync
  // 2026-10-12: 3 s -> 0.8 s; aur tez raasta FORAN (poora sync chal raha ho tab bhi) — parchi seconds mein
  kick = () => { quickRun(); if (timer) return; timer = setTimeout(() => { timer = null; tick(); }, 800); };
  await tick();
  setInterval(ZINDA.guard(tick, 10 * 60000, 'khata tick'), LOOP_SECONDS * 1000);   // 2026-10-11: chowkidar
})().catch(e => { console.error('Nahi hua:', e.message); process.exit(1); });
