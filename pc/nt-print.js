// ============================================================
//  nt-print.js  v1.9 (2026-10-06: 🔔 POS BEEP — posBeep/<is PC ka host> badle = POS mein item jura -> beep; tab scan ki 'tik' band, ghalat scan ki bzzz chalu) · v1.8 (2026-10-06: 🔔 SCAN AWAZ — nt-scan.js: POS mein har scan par tik, ghalat scan par bzzz) · v1.7 (2026-10-06: 🔄 KHUD-UPDATE — har 5 min GitHub manifest, nt-print.js / nt-parchi.js naye hon to sha jaanch kar
//                   badal kar band; nt-print-auto.bat dobara chalata hai. local-config "autoUpdate": false = band) · v1.6 (2026-10-06: ⚡ TEZ PRINT — nt-parchi worker: PowerShell shuru se khula, bill aate hi seedha printer) · v1.4 (2026-10-05: 🔔 scan par beep — liveCarts, local-config beep/beepCounters) · v1.1 (2026-10-04) — 💻 NT-PRINT: app ka bill IS PC ke printer par, bina kisi window ke
//
//  App (Nayi Sale) mein counter "💻 <PC ka naam>" chuna ho to sale ka doc counter = 'pc:<id>' hota hai.
//  sale-post (main PC) POS mein bill banata hai (status done + saleNo) magar 'pc:' par PRINT NAHI karta.
//  Ye script (har us PC par jahan printer laga hai) wahi bill apne printer par chhapti hai:
//    bill x copies  ->  har gate pass (doosra godam)  ->  har crate ka TOKEN — har parchi ALAG job + cut.
//  Har 1 minute printPCs/<id> mein zinda report: naam, printer, printers list (app isi se chips dikhati hai).
//  App ka "Dobara print" (printReq) bhi yahi chhapti hai (sirf bill).
//
//  Setting (C:\khata-sync\local-config.json, sab ikhtiyari):
//    "pcName": "Counter PC"   (app mein yehi naam)      "ntPrinter": "TM-T88IV"  (warna Windows default printer)
//    "printWidth": 32  (harf fi line)   "dots": 512 (printer ki chaurai dots — 58mm = 384)
//    "godamNames": {"2": "Bara Godam"}  (SQL na ho to)
//    "beep": true  (v1.4: app mein scan par IS PC se beep)   "beepCounters": ["bilal","mithu"] ya "all"  (default: sirf is PC ka counter 'pc:<id>')
//  Chalana: nt-print-auto.bat (loop).   Test: node nt-print.js --test [--gate]   (naqli bill + 2 token; --gate = gate pass bhi)
//  v1.3 (2026-10-04): parchi/token/print ka code nt-parchi.js (saanjha, sale-post bhi istemal karta)
//  v1.2 (2026-10-04): app PC ke saath PRINTER bhi chun sakti hai (network wale Mithu/Abdurehman/Bilal bhi, jo is Windows mein lage hon):
//        counter 'pc:<id8>:<printer-hash6>'; printPCs.printers = [{n, h}]. Listener: aaj ke sab appSales, counter khud chhanta.
//  v1.1 (2026-10-04): rasid bilkul POS wali (sale-post receiptFor): phone, barcode, Items PCS CTN Rate, Total, Cash, Balance, shop lines
// ============================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const VER = '1.9.1';
const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47831;
const DIR = __dirname;
{ const hb = path.join(DIR, 'nt-print.alive'); const w = () => { try { fs.writeFileSync(hb, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); }
const log = (...a) => console.log(`[${new Date().toLocaleString('en-GB')}]`, ...a);
const cfg = () => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } };
const slug = s => String(s || 'pc').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 8) || 'pc';   // v1.2: 8 harf (counter 'pc:<id>:<printer6>' <= 20)
const h6 = s => require('crypto').createHash('sha1').update(String(s || '')).digest('hex').slice(0, 6);
const C0 = cfg();
const PC_ID = slug(C0.pcId || os.hostname());
const PC_NAME = String(C0.pcName || os.hostname()).trim().slice(0, 40);
const COUNTER = 'pc:' + PC_ID;
const W = Math.max(24, Math.min(64, Number(C0.printWidth) || 32));
const DOTS = Math.max(256, Math.min(640, Number(C0.dots) || 512));
const FONT_UR = 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial';
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const unauth = e => e?.code === 16 || /UNAUTHENTICATED|invalid authentication credentials/i.test(String(e?.message));

// ---------------- printers ----------------
const ps = cmd => execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
let PR_LIST = [], PR_DEF = '', prAt = 0;
function scanPrinters() {
  try { PR_LIST = ps('Get-Printer | Select-Object -ExpandProperty Name').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 30); } catch { PR_LIST = []; }
  try { PR_DEF = ps("(Get-CimInstance Win32_Printer -Filter 'Default=TRUE').Name").trim(); } catch { PR_DEF = ''; }
  prAt = Date.now();
}
const printerName = (hash) => { if (hash) { const p = PR_LIST.find(x => h6(x) === hash); if (p) return p; } return String(cfg().ntPrinter || PR_DEF || '').trim(); };   // v1.2: app ne printer chuna ho (hash) to wahi, warna default
const mine = c => c === COUNTER || String(c || '').startsWith(COUNTER + ':');
const hashOf = c => (String(c || '').split(':')[2] || '');

// ---------------- ESC/POS parchi ----------------
const P = require('./nt-parchi.js').make({ dir: DIR, width: W, dots: DOTS, fontUr: FONT_UR });
const { ESC, GS, Seg, line, hr, when, dstr, tstr, num, tokenJobs, sendJobs } = P;
const ascii = t => !/[^\x00-\x7f]/.test(String(t));
// qtxt (pehle) ab bill mein nahi — ctnPcs hai
const qtxt = l => l.unit === 'ctn' && Number(l.pack) > 1 ? `${num(Number(l.qty) / Number(l.pack))} ${l.cName || 'Ctn'}` : `${num(l.qty)} ${l.uName || 'Pcs'}`;

// ---- Rasid bilkul POS / sale-post wali: naam, phone, barcode, jadwal (Items PCS CTN Rate), total, cash, balance, neeche shop ki lines ----
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
const n3 = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const pad = (t, w, right) => { t = String(t ?? ''); if (t.length > w) t = t.slice(0, w); return right ? t.padStart(w) : t.padEnd(w); };
const big = t => ESC + '!' + '\x30' + t + ESC + '!' + '\x00';
const bold = t => ESC + 'E' + '\x01' + t + ESC + 'E' + '\x00';
const barcode = code => { const c = String(code || '').trim(); if (!c) return ''; return GS + 'h' + '\x50' + GS + 'w' + '\x02' + GS + 'H' + '\x02' + GS + 'k' + '\x49' + String.fromCharCode(c.length + 2) + '{B' + c + '\n'; };
const whenStr = t => t.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
const custName = d => d.mode === 'wholesale' ? 'whole sale' : 'COUNTER SALE';
// app ki line: qty = pieces, pack = carton mein pieces (POS PackQty) -> CTN / PCS
const ctnPcs = l => { const pack = Number(l.pack) || 0, qty = Number(l.qty) || 0; const ctn = pack > 1 ? Math.floor(qty / pack + 1e-9) : 0; return { ctn, pcs: pack > 1 ? r3(qty - ctn * pack) : qty }; };

function billJob(d) {
  const s = Seg(), t = when(d), tok = Number(d.token) || 0, total = Number(d.total) || 0;
  const cash = d.mode === 'wholesale' ? (Number(d.cash) || 0) : total;
  s.raw(ESC + '@' + ESC + 'a\x01');
  s.ln(big(SHOP.name)); s.ln(SHOP.phone);
  s.raw(ESC + 'a\x00'); s.ln(hr());
  { const sn = 'Sale No: ' + String(d.saleNo || '').trim(), ws = whenStr(t); if (sn.length + ws.length + 1 <= W) s.ln(line(sn, ws)); else { s.ln(bold(sn)); s.ln(line('', ws)); } }
  if (tok) s.ln(bold(line('Token: ' + tok, '')));
  s.raw(ESC + 'a\x01'); s.ln(barcode(String(d.saleNo || '').trim())); s.raw(ESC + 'a\x00');
  s.ln('Customer: ' + custName(d));
  s.ln(hr());
  s.ln(bold(pad('Items', 14) + pad('PCS', 4, true) + pad('CTN', 4, true) + pad('Rate', 9, true)));
  s.ln(hr());
  let pcsSum = 0, ctnSum = 0;
  for (const l of Array.isArray(d.lines) ? d.lines : []) {
    const { ctn, pcs } = ctnPcs(l); pcsSum = r3(pcsSum + pcs); ctnSum += ctn;
    const amt = Math.round(Number(l.qty) * Number(l.rate) * 100) / 100;
    s.ln(String(l.name || '').trim().slice(0, ascii(l.name) ? W : 60));
    s.ln(pad('', 1) + pad(n3(pcs), 6, true) + pad(num(ctn), 5, true) + pad(num(l.rate), 9, true) + pad(num(amt), 10, true));
  }
  s.ln(hr());
  s.ln(line('Total (PCS ' + n3(pcsSum) + ' / CTN ' + num(ctnSum) + ')', ''));
  s.raw(ESC + 'a\x02'); s.ln(big('Rs.' + num(total))); s.raw(ESC + 'a\x00');
  s.ln(line('Cash Received:', 'Rs.' + num(cash)));
  s.ln(line(d.mode === 'wholesale' ? 'Balance (Udhaar):' : 'Balance:', 'Rs.' + num(Math.round((total - cash) * 100) / 100)));
  s.ln(hr());
  for (const x of SHOP.lines) s.ln(x);
  return s.end();
}
function gateJobs(d, names) {
  const gp = {}; for (const l of Array.isArray(d.lines) ? d.lines : []) { const g = Number(l.godam) || 1; if (g !== Number(d.branch || 1)) (gp[g] = gp[g] || []).push(l); }
  const t = when(d);
  return Object.entries(gp).map(([g, ls]) => {
    const s = Seg(); const gn = names[g] || ('Godam ' + g);
    s.raw(ESC + '@' + ESC + 'a\x01'); s.ln(big('GATE PASS'));
    if (ascii(gn)) s.ln(big(gn.slice(0, Math.floor(W / 2)))); else s.img(gn, 34, true);
    s.raw(ESC + 'a\x00'); s.ln(hr());
    s.ln(bold('Sale No: ' + String(d.saleNo || '').trim()));
    s.ln(whenStr(t));
    s.raw(ESC + 'a\x01'); s.ln(barcode(String(d.saleNo || '').trim())); s.raw(ESC + 'a\x00');
    s.ln('Customer: ' + custName(d));
    s.ln(hr());
    s.ln(bold(pad('Items', W - 12) + pad('CTN', 5, true) + pad('PCS', 7, true)));
    s.ln(hr());
    let pcsSum = 0, ctnSum = 0;
    for (const l of ls) { const { ctn, pcs } = ctnPcs(l); pcsSum = r3(pcsSum + pcs); ctnSum += ctn;
      s.ln(String(l.name || '').trim().slice(0, ascii(l.name) ? W : 60)); s.ln(pad('', W - 12) + pad(num(ctn), 5, true) + pad(n3(pcs), 7, true)); }
    s.ln(hr());
    s.ln(bold(line('Total', 'CTN ' + num(ctnSum) + ' / PCS ' + n3(pcsSum))));
    s.ln(hr());
    s.ln('Dene wale ke dastakhat: ________');
    return s.end();
  });
}
// ---------------- godam ke naam ----------------
let GNAMES = null;
async function godamNames() {
  if (GNAMES) return GNAMES;
  GNAMES = {};
  try { const g = cfg().godamNames; if (g && typeof g === 'object') Object.assign(GNAMES, g); } catch {}
  try {
    const sql = require('mssql');
    const pool = await new sql.ConnectionPool(require('./sql-config.js')).connect();
    (await pool.request().query('SELECT BranchID, BranchName FROM dbo.Branch')).recordset.forEach(x => { GNAMES[x.BranchID] = String(x.BranchName || '').trim(); });
    await pool.close();
  } catch {}   // doosre PC par SQL nahi — "Godam N" ya local-config godamNames
  return GNAMES;
}

// ---------------- test ----------------
if (process.argv.includes('--test')) {
  scanPrinters();
  const pr = printerName();
  const d = { saleNo: 'TEST-1', token: 7, crates: 2, mode: 'counter', branch: 1, total: 513.75, cash: 0, doneAt: Date.now(),
    lines: [{ name: 'kala chana', qty: 0.05, rate: 275, unit: 'pcs' }, { name: 'ghee 1kg', qty: 14, rate: 500, unit: 'ctn', pack: 12, cName: 'Ctn', uName: 'Pcs', godam: process.argv.includes('--gate') ? 2 : 1 }] };
  console.log('Printer:', pr || '(nahi mila)', '| PC:', PC_NAME, '| id:', COUNTER);
  if (!pr) { console.log('Windows mein default printer set karein, ya local-config.json mein "ntPrinter"'); process.exit(1); }
  sendJobs([billJob(d), ...gateJobs(d, { 2: 'Godam 2' }), ...tokenJobs(d)], pr).then(e => { console.log(e ? 'NAHI HUA: ' + e.message : 'Theek — bill + 2 token (aur --gate ho to gate pass bhi), har ek alag cut'); process.exit(e ? 1 : 0); });
  return;
}

// ---------------- Firestore ----------------
if (!getApps().length) initializeApp({ credential: cert(require(path.join(DIR, 'firebase-key.json'))) });
const db = getFirestore();
const base = db.collection('businesses').doc(BUSINESS_ID);
const saleCol = base.collection('appSales');
const pcDoc = base.collection('printPCs').doc(PC_ID);

async function beat() {
  if (!prAt || Date.now() - prAt > 10 * 60000) scanPrinters();
  try { await pcDoc.set({ name: PC_NAME, host: os.hostname(), printer: printerName(), printers: PR_LIST.map(n => ({ n, h: h6(n) })), at: Date.now(), ver: VER, width: W }); }
  catch (e) { log('⚠ report: ' + e.message); if (unauth(e)) { log('Firebase rabta toota (UNAUTHENTICATED) — dobara shuru'); setTimeout(() => process.exit(1), 500); } }
}

const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (unauth(e)) setTimeout(() => process.exit(1), 500); }); };

async function onDoc(doc) {
  const d = doc.data() || {}, id = doc.id;
  if (!mine(d.counter) || d.status !== 'done' || !d.saleNo || busy.has(id)) return;
  const printed = Number(d.pcPrintedAt) || 0;
  const fresh = !printed && Date.now() - (Number(d.doneAt) || Number(d.createdAt) || 0) < 30 * 60000;   // purane din ki history dobara na chhape
  const again = Number(d.printReq) > printed;
  if (!fresh && !again) return;
  busy.add(id);
  try {
    const pr = printerName(hashOf(d.counter));
    if (!pr) throw new Error('printer nahi mila — Windows mein default printer set karein');
    const cp = Math.min(3, Math.max(1, Number(d.copies) || 1));
    const jobs = Array.from({ length: cp }, () => billJob(d));
    if (fresh) { jobs.push(...gateJobs(d, await godamNames())); jobs.push(...tokenJobs(d)); }
    const err = await sendJobs(jobs, pr);
    if (err) throw err;
    await doc.ref.update({ pcPrintedAt: Date.now(), pcPrintedBy: PC_ID, printReq: FieldValue.delete(), pcError: FieldValue.delete() });
    log(`🖨 ${fresh ? 'Bill' : 'Dobara'} ${d.saleNo} · token ${d.token || '-'} · ${jobs.length} parchi -> ${pr}`);
  } catch (e) {
    log(`Print NAHI hua (${d.saleNo}): ${e.message}`);
    if (unauth(e)) throw e;
    await doc.ref.update({ pcError: String(e.message).slice(0, 200), pcPrintedAt: Date.now(), printReq: FieldValue.delete() }).catch(() => {});
  } finally { busy.delete(id); }
}

// v1.4: 🔔 SCAN KI AWAZ — liveCarts (app ka live bill) dekh kar lines/total badle to PowerShell beep (jaise app karti hai)
const beepSeen = new Map();
function beep(kind) {
  try {
    const f = kind === 'saved' ? '[console]::beep(900,90);[console]::beep(1300,160)' : kind === 'stop' ? '[console]::beep(400,500)' : '[console]::beep(1500,110)';
    require('child_process').spawn('powershell.exe', ['-NoProfile', '-Command', f], { windowsHide: true, stdio: 'ignore', detached: true }).unref();
  } catch {}
}
function beepFor(counter) {
  const c = cfg(); if (c.beep === false) return false;
  const list = c.beepCounters; if (list === 'all') return true;
  if (Array.isArray(list) && list.map(x => String(x).toLowerCase()).includes(String(counter).toLowerCase())) return true;
  return String(counter).startsWith(COUNTER);
}
function listenBeep() {
  base.collection('liveCarts').onSnapshot(s => {
    s.docChanges().forEach(ch => {
      if (ch.type === 'removed') { beepSeen.delete(ch.doc.id); return; }
      const d = ch.doc.data() || {}, id = ch.doc.id;
      if (!beepFor(id)) return;
      const prev = beepSeen.get(id); const cur = { n: Number(d.n) || 0, total: Number(d.total) || 0, status: d.status, at: Number(d.at) || 0, stop: d.stop ? 1 : 0 };
      beepSeen.set(id, cur);
      if (!prev) return;   // pehli dafa = sirf yaad
      if (cur.stop && !prev.stop) beep('stop');
      else if (cur.status === 'saved' && prev.status !== 'saved') beep('saved');
      else if (cur.status === 'open' && (cur.n > prev.n || cur.total !== prev.total)) beep('scan');
    });
  }, e => log('liveCarts beep: ' + e.message));
}
function listen() {
  listenBeep();
  let scan = null;
  const posBeepOn = () => cfg().posBeep === true;   // v1.9.1: sirf jab local-config posBeep:true (POS live likhta hai ya nahi — pakka nahi)
  try { scan = require('./nt-scan.js').start({ dir: DIR, base, log, cfg: () => ({ ...cfg(), ...(posBeepOn() ? { scanGood: false } : {}) }) }); } catch (e) { log('🔔 scan awaz shuru nahi hui: ' + e.message); }   // v1.8
  // v1.9: 🔔 POS BEEP — server (pos-sales-dekho v1.4) har nayi POS line par posBeep/<HOST> likhta hai
  if (posBeepOn()) { let first = true, lastAt = 0;
    base.collection('posBeep').doc(os.hostname().toUpperCase()).onSnapshot(d => {
      const at = Number((d.data() || {}).at) || 0;
      if (first) { first = false; lastAt = at; return; }
      if (at <= lastAt || !posBeepOn()) return; lastAt = at;
      if (Date.now() - at > 15000) return;   // purani khabar
      if (!(scan && scan.beep && scan.beep('OK'))) beep('scan');
    }, e => log('🔔 POS beep listener: ' + e.message));
    log('🔔 POS beep sun raha hai: ' + os.hostname().toUpperCase()); }
  const day = today();
  saleCol.where('date', '==', day).onSnapshot(s => {   // v1.2: aaj ke sab, phir counter 'pc:<id>[:printer]' khud chhanta (range + date ko index chahiye hota)
    s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => onDoc(c.doc)); });
  }, e => { log('Listener toota: ' + e.message + ' — 30 sec mein dobara'); process.exit(1); });
  setInterval(() => { if (today() !== day) { log('Naya din — dobara shuru'); process.exit(0); } }, 60000);
}

// v1.7: 🔄 KHUD-UPDATE — counter PCs par haath se command nahi. GitHub (pc/manifest.json) ke sha256 se milata hai.
const UPD_BASE = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/';
const UPD_FILES = ['nt-print.js', 'nt-parchi.js', 'nt-scan.js'];
const sha256 = b => require('crypto').createHash('sha256').update(b).digest('hex');
function getBuf(url, n = 0) {
  return new Promise((res, rej) => {
    const req = require('https').get(url, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'nt-print' }, timeout: 20000 }, r => {
      if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location && n < 3) { r.resume(); getBuf(new URL(r.headers.location, url).href, n + 1).then(res, rej); return; }
      if (r.statusCode !== 200) { r.resume(); rej(new Error('HTTP ' + r.statusCode)); return; }
      const a = []; r.on('data', c => a.push(c)); r.on('end', () => res(Buffer.concat(a))); r.on('error', rej);
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', rej);
  });
}
let updBusy = false;
async function selfUpdate() {
  if (updBusy || cfg().autoUpdate === false) return;
  updBusy = true;
  try {
    const m = JSON.parse((await getBuf(UPD_BASE + 'manifest.json?t=' + Date.now())).toString('utf8'));
    const want = UPD_FILES.filter(f => m.files && m.files[f] && (() => { try { return sha256(fs.readFileSync(path.join(DIR, f))) !== m.files[f]; } catch { return true; } })());
    if (!want.length) return;
    const got = [];
    for (const f of want) {
      const b = await getBuf(UPD_BASE + f + '?t=' + Date.now());
      if (sha256(b) !== m.files[f]) { log(`🔄 Update: ${f} ka sha nahi mila (GitHub abhi purana de raha) — baad mein`); return; }
      got.push([f, b]);
    }
    for (const [f, b] of got) { const tmp = path.join(DIR, f + '.new'); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(DIR, f)); }
    log(`🔄 KHUD-UPDATE: ${got.map(x => x[0]).join(', ')} naye (manifest ${m.version || '?'}) — print khatam hote hi dobara shuru`);
    const bye = () => { if (busy.size) { setTimeout(bye, 2000); return; } queue.then(() => process.exit(0)); };
    bye();
  } catch (e) { log('🔄 Update check nahi hua: ' + e.message); }
  finally { updBusy = false; }
}

const lock = net.createServer();
lock.once('error', () => { console.log('nt-print pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', async () => {
  scanPrinters();
  log(`💻 NT-PRINT v${VER} — PC "${PC_NAME}" (${COUNTER}) · printer: ${printerName() || 'NAHI MILA'} · ${W} harf / ${DOTS} dots`);
  try { P.warm(); } catch {}   // v1.6: print worker pehle se garam
  await beat(); setInterval(beat, 60000);
  listen();
  setTimeout(selfUpdate, 60000); setInterval(selfUpdate, 5 * 60000);   // v1.7
});
