// ============================================================
//  nt-print.js  v1.0 (2026-10-04) — 💻 NT-PRINT: app ka bill IS PC ke printer par, bina kisi window ke
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
//  Chalana: nt-print-auto.bat (loop).   Test: node nt-print.js --test   (naqli bill + token isi printer par)
// ============================================================
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const VER = '1.0';
const BUSINESS_ID = 'noor-traders';
const LOCK_PORT = 47831;
const DIR = __dirname;
{ const hb = path.join(DIR, 'nt-print.alive'); const w = () => { try { fs.writeFileSync(hb, String(Date.now())); } catch {} }; w(); setInterval(w, 30000).unref(); }
const log = (...a) => console.log(`[${new Date().toLocaleString('en-GB')}]`, ...a);
const cfg = () => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'local-config.json'), 'utf8')) || {}; } catch { return {}; } };
const slug = s => String(s || 'pc').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 17) || 'pc';
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
const printerName = () => String(cfg().ntPrinter || PR_DEF || '').trim();

// ---------------- ESC/POS parchi ----------------
const ESC = '\x1b', GS = '\x1d';
const num = v => Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const line = (l, r) => { l = String(l); r = String(r); return (l + ' '.repeat(Math.max(1, W - l.length - r.length))).slice(0, Math.max(0, W - r.length)) + r; };
const hr = () => '-'.repeat(W);
const ascii = t => !/[^\x00-\x7f]/.test(String(t));
function Seg() {
  const a = []; let buf = '';
  const flush = () => { if (buf) { a.push({ r: Buffer.from(buf, 'latin1').toString('base64') }); buf = ''; } };
  return {
    raw(t) { buf += t; },
    ln(t = '') { t = String(t); if (ascii(t)) buf += t + '\r\n'; else { flush(); a.push({ i: t, f: FONT_UR, px: 24, b: false, w: DOTS, a: 0 }); } },
    img(t, px, bold, align = 1, font = FONT_UR) { flush(); a.push({ i: String(t), f: font, px, b: !!bold, w: DOTS, a: align }); },
    end() { buf += '\r\n\r\n\r\n\r\n' + GS + 'V' + '\x42' + '\x00'; flush(); return { s: a }; }
  };
}
const when = d => new Date(Number(d.doneAt) || Number(d.createdAt) || Date.now());
const dstr = t => t.toLocaleDateString('en-GB');
const tstr = t => t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
const qtxt = l => l.unit === 'ctn' && Number(l.pack) > 1 ? `${num(Number(l.qty) / Number(l.pack))} ${l.cName || 'Ctn'}` : `${num(l.qty)} ${l.uName || 'Pcs'}`;

function billJob(d) {
  const s = Seg(), t = when(d), tok = Number(d.token) || 0, total = Number(d.total) || 0, cash = Number(d.cash) || 0;
  s.raw(ESC + '@' + ESC + 'a\x01'); s.ln(ESC + '!\x30NOOR TRADERS' + ESC + '!\x00'); s.ln(d.mode === 'wholesale' ? 'WHOLESALE' : 'COUNTER SALE');
  s.raw(ESC + 'a\x00'); s.ln(hr());
  s.ln(ESC + 'E\x01' + line('Bill # ' + String(d.saleNo || ''), 'Token ' + (tok || '-')) + ESC + 'E\x00');
  s.ln(line(dstr(t), tstr(t))); s.ln(hr());
  for (const l of Array.isArray(d.lines) ? d.lines : []) {
    s.ln(String(l.name || '').slice(0, ascii(l.name) ? W : 60));
    s.ln(line('  ' + qtxt(l) + ' x ' + num(l.rate), num(Math.round(Number(l.qty) * Number(l.rate)))));
  }
  s.ln(hr());
  s.ln(ESC + '!\x10' + ESC + 'E\x01' + line('KUL', 'Rs ' + num(total)) + ESC + 'E\x00' + ESC + '!\x00');
  if (d.mode === 'wholesale') { s.ln(line('Cash', num(cash))); if (total - cash > 0.5) s.ln(ESC + 'E\x01' + line('Udhaar', num(total - cash)) + ESC + 'E\x00'); }
  s.raw(ESC + 'a\x01'); s.ln(hr()); s.ln('Shukriya - Blue Khata');
  return s.end();
}
function gateJobs(d, names) {
  const gp = {}; for (const l of Array.isArray(d.lines) ? d.lines : []) { const g = Number(l.godam) || 1; if (g !== Number(d.branch || 1)) (gp[g] = gp[g] || []).push(l); }
  const t = when(d), tok = Number(d.token) || 0;
  return Object.entries(gp).map(([g, ls]) => {
    const s = Seg(); const gn = names[g] || ('Godam ' + g);
    s.raw(ESC + '@' + ESC + 'a\x01'); s.ln(ESC + '!\x30GATE PASS' + ESC + '!\x00');
    if (ascii(gn)) s.ln(ESC + '!\x30' + gn.slice(0, Math.floor(W / 2)) + ESC + '!\x00'); else s.img(gn, 34, true);
    s.raw(ESC + 'a\x00'); s.ln(hr());
    s.ln(ESC + 'E\x01' + line('Bill # ' + String(d.saleNo || ''), 'Token ' + (tok || '-')) + ESC + 'E\x00');
    s.ln(line(dstr(t), tstr(t))); s.ln(hr());
    for (const l of ls) { s.ln(String(l.name || '').slice(0, ascii(l.name) ? W : 60)); s.ln(ESC + 'E\x01' + line('', qtxt(l)) + ESC + 'E\x00'); }
    s.ln(hr()); s.raw(ESC + 'a\x01'); s.ln('Maal de kar parchi rakh lein');
    return s.end();
  });
}
function tokenJobs(d) {
  const n = Math.max(1, Math.min(20, Number(d.crates) || 1)), tok = Number(d.token) || 0, t = when(d);
  return Array.from({ length: n }, (_, i) => {
    const s = Seg();
    s.raw(ESC + '@' + ESC + 'a\x01'); s.ln(ESC + 'E\x01T O K E N' + ESC + 'E\x00');
    s.img(String(tok || '-'), 170, true, 1, 'Arial Black,Arial');
    s.img(`اس بل کے ${n} کریٹ ہیں`, 38, true, 1);
    s.raw(ESC + 'a\x01'); s.ln(ESC + '!\x30Crate ' + (i + 1) + ' / ' + n + ESC + '!\x00');
    s.raw(ESC + 'a\x00'); s.ln(line('Bill # ' + String(d.saleNo || ''), tstr(t)));
    return s.end();
  });
}

// ---------------- Windows ko bhejna (RAW, har job alag) ----------------
const PS1 = path.join(DIR, 'nt-print.ps1');
const PS1_TXT = `param([string]$spec,[string]$printer)
$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPrint1.dll'
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies System.Drawing -OutputAssembly $dll -TypeDefinition @"
using System;using System.Collections.Generic;using System.Drawing;using System.Drawing.Text;using System.Runtime.InteropServices;
public class NtPrint{
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
 static string Pick(string list){var inst=new InstalledFontCollection();foreach(var n in list.Split(',')){string t=n.Trim();foreach(var ff in inst.Families)if(string.Equals(ff.Name,t,StringComparison.OrdinalIgnoreCase))return ff.Name;}return "Arial";}
 public static byte[] Img(string text,string fonts,float px,bool bold,int width,int align){
  bool rtl=false;foreach(char c in text)if(c>=0x0600&&c<=0x06FF){rtl=true;break;}
  using(var f=new Font(Pick(fonts),px,bold?FontStyle.Bold:FontStyle.Regular,GraphicsUnit.Pixel)){
   var sf=new StringFormat();sf.Alignment=align==1?StringAlignment.Center:(align==2?StringAlignment.Far:StringAlignment.Near);if(rtl)sf.FormatFlags|=StringFormatFlags.DirectionRightToLeft;
   int h;using(var b0=new Bitmap(10,10))using(var g0=Graphics.FromImage(b0)){h=(int)Math.Ceiling(g0.MeasureString(text,f,width,sf).Height)+8;}
   using(var bmp=new Bitmap(width,h))using(var g=Graphics.FromImage(bmp)){
    g.Clear(Color.White);g.TextRenderingHint=TextRenderingHint.AntiAliasGridFit;
    g.DrawString(text,f,Brushes.Black,new RectangleF(0,4,width,h),sf);
    int bw=(width+7)/8;var o=new List<byte>();o.AddRange(new byte[]{0x1b,0x61,0x00,0x1d,0x76,0x30,0x00,(byte)(bw&255),(byte)(bw>>8),(byte)(h&255),(byte)(h>>8)});
    for(int y=0;y<h;y++)for(int xb=0;xb<bw;xb++){int v=0;for(int k=0;k<8;k++){int x=xb*8+k;if(x<width){Color c=bmp.GetPixel(x,y);if(c.R+c.G+c.B<384)v|=0x80>>k;}}o.Add((byte)v);}
    return o.ToArray();}}}
}
"@ }
Add-Type -Path $dll
$o=Get-Content -Raw -Encoding UTF8 $spec | ConvertFrom-Json
$k=0
foreach($job in $o.jobs){
 $ms=New-Object System.IO.MemoryStream
 foreach($s in $job.s){ if($s.r){$b=[Convert]::FromBase64String([string]$s.r)} else {$b=[NtPrint]::Img([string]$s.i,[string]$s.f,[float]$s.px,[bool]$s.b,[int]$s.w,[int]$s.a)}; $ms.Write($b,0,$b.Length) }
 $k++; [NtPrint]::Send($printer,$ms.ToArray(),('NT-PRINT '+$k)); Start-Sleep -Milliseconds 500
}
`;
function sendJobs(jobs, printer) {
  try { if (!fs.existsSync(PS1) || fs.readFileSync(PS1, 'utf8') !== PS1_TXT) fs.writeFileSync(PS1, PS1_TXT); } catch (e) { return Promise.resolve(e); }
  const spec = path.join(DIR, 'nt-print-job.json');
  fs.writeFileSync(spec, JSON.stringify({ jobs }), 'utf8');
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-spec', spec, '-printer', printer],
    { timeout: 90000, windowsHide: true }, (err, out, errOut) => res(err ? new Error((String(errOut || '').trim().split(/\r?\n/).pop()) || err.message) : null)));
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
    lines: [{ name: 'kala chana', qty: 0.05, rate: 275, unit: 'pcs' }, { name: 'ghee 1kg', qty: 1, rate: 500, unit: 'pcs', godam: 2 }] };
  console.log('Printer:', pr || '(nahi mila)', '| PC:', PC_NAME, '| id:', COUNTER);
  if (!pr) { console.log('Windows mein default printer set karein, ya local-config.json mein "ntPrinter"'); process.exit(1); }
  sendJobs([billJob(d), ...gateJobs(d, { 2: 'Godam 2' }), ...tokenJobs(d)], pr).then(e => { console.log(e ? 'NAHI HUA: ' + e.message : 'Theek — 4 alag parchiyan aani chahiye (bill, gate pass, 2 token)'); process.exit(e ? 1 : 0); });
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
  try { await pcDoc.set({ name: PC_NAME, host: os.hostname(), printer: printerName(), printers: PR_LIST, at: Date.now(), ver: VER, width: W }); }
  catch (e) { log('⚠ report: ' + e.message); if (unauth(e)) { log('Firebase rabta toota (UNAUTHENTICATED) — dobara shuru'); setTimeout(() => process.exit(1), 500); } }
}

const busy = new Set();
let queue = Promise.resolve();
const later = fn => { queue = queue.then(fn).catch(e => { log('Masla: ' + e.message); if (unauth(e)) setTimeout(() => process.exit(1), 500); }); };

async function onDoc(doc) {
  const d = doc.data() || {}, id = doc.id;
  if (d.counter !== COUNTER || d.status !== 'done' || !d.saleNo || busy.has(id)) return;
  const printed = Number(d.pcPrintedAt) || 0;
  const fresh = !printed && Date.now() - (Number(d.doneAt) || Number(d.createdAt) || 0) < 30 * 60000;   // purane din ki history dobara na chhape
  const again = Number(d.printReq) > printed;
  if (!fresh && !again) return;
  busy.add(id);
  try {
    const pr = printerName();
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

function listen() {
  const day = today();
  saleCol.where('counter', '==', COUNTER).where('date', '==', day).onSnapshot(s => {
    s.docChanges().forEach(c => { if (c.type !== 'removed') later(() => onDoc(c.doc)); });
  }, e => { log('Listener toota: ' + e.message + ' — 30 sec mein dobara'); process.exit(1); });
  setInterval(() => { if (today() !== day) { log('Naya din — dobara shuru'); process.exit(0); } }, 60000);
}

const lock = net.createServer();
lock.once('error', () => { console.log('nt-print pehle se chal raha hai.'); process.exit(3); });
lock.listen(LOCK_PORT, '127.0.0.1', async () => {
  scanPrinters();
  log(`💻 NT-PRINT v${VER} — PC "${PC_NAME}" (${COUNTER}) · printer: ${printerName() || 'NAHI MILA'} · ${W} harf / ${DOTS} dots`);
  await beat(); setInterval(beat, 60000);
  listen();
});
