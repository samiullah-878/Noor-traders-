// ============================================================
//  nt-parchi.js  v1.1 (2026-10-06: ⚡ TEZ — PowerShell EK dafa khula (worker), har print seedha; Urdu tasveer LockBits se; parchiyon
//                     ke beech 150 ms; worker atke to purana tareeqa khud) · v1.0 (2026-10-04) — SAANJHI parchi: ESC/POS segments + Urdu/bara text ka raster + Windows RAW print (har job alag cut)
//  Istemal: nt-print.js (💻 PC) aur sale-post.js (counter: Abdurehman / Bilal / Mithu) — token parchi dono jagah ek jaisi.
//  make(opts) -> { Seg, tokenJobs(d), sendJobs(jobs, printer), ESC, GS, line, hr, big, bold, when, FONT_UR }
//  opts: { dir, width (harf/line, 32), dots (512), fontUr }
// ============================================================
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

function make(opts = {}) {
  const DIR = opts.dir || __dirname;
  const W = Math.max(24, Math.min(64, Number(opts.width) || 32));
  const DOTS = Math.max(256, Math.min(640, Number(opts.dots) || 512));
  const FONT_UR = opts.fontUr || 'Jameel Noori Nastaleeq,Urdu Typesetting,Segoe UI,Tahoma,Arial';
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

  const PS1 = path.join(DIR, 'nt-print.ps1');
const PS1_TXT = `param([string]$spec,[string]$printer)
$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPrint2.dll'
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies System.Drawing -OutputAssembly $dll -TypeDefinition @"
using System;using System.Collections.Generic;using System.Drawing;using System.Drawing.Text;using System.Runtime.InteropServices;
public class NtPrint2{
 static Dictionary<string,string> FC=new Dictionary<string,string>();
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
 static string Pick(string list){string r;if(FC.TryGetValue(list,out r))return r;r="Arial";var inst=new InstalledFontCollection();foreach(var n in list.Split(',')){string t=n.Trim();bool hit=false;foreach(var ff in inst.Families)if(string.Equals(ff.Name,t,StringComparison.OrdinalIgnoreCase)){r=ff.Name;hit=true;break;}if(hit)break;}FC[list]=r;return r;}
 public static byte[] Img(string text,string fonts,float px,bool bold,int width,int align){
  bool rtl=false;foreach(char c in text)if(c>=0x0600&&c<=0x06FF){rtl=true;break;}
  using(var f=new Font(Pick(fonts),px,bold?FontStyle.Bold:FontStyle.Regular,GraphicsUnit.Pixel)){
   var sf=new StringFormat();sf.Alignment=align==1?StringAlignment.Center:(align==2?StringAlignment.Far:StringAlignment.Near);if(rtl)sf.FormatFlags|=StringFormatFlags.DirectionRightToLeft;
   int h;using(var b0=new Bitmap(10,10))using(var g0=Graphics.FromImage(b0)){h=(int)Math.Ceiling(g0.MeasureString(text,f,width,sf).Height)+8;}
   using(var bmp=new Bitmap(width,h))using(var g=Graphics.FromImage(bmp)){
    g.Clear(Color.White);g.TextRenderingHint=TextRenderingHint.AntiAliasGridFit;
    g.DrawString(text,f,Brushes.Black,new RectangleF(0,4,width,h),sf);
    int bw=(width+7)/8;var o=new List<byte>();o.AddRange(new byte[]{0x1b,0x61,0x00,0x1d,0x76,0x30,0x00,(byte)(bw&255),(byte)(bw>>8),(byte)(h&255),(byte)(h>>8)});
    var bd=bmp.LockBits(new Rectangle(0,0,width,h),System.Drawing.Imaging.ImageLockMode.ReadOnly,System.Drawing.Imaging.PixelFormat.Format32bppArgb);int st=bd.Stride;byte[] px=new byte[st*h];Marshal.Copy(bd.Scan0,px,0,px.Length);bmp.UnlockBits(bd);
    for(int y=0;y<h;y++)for(int xb=0;xb<bw;xb++){int v=0;for(int k=0;k<8;k++){int x=xb*8+k;if(x<width){int q=y*st+x*4;if(px[q]+px[q+1]+px[q+2]<384)v|=0x80>>k;}}o.Add((byte)v);}
    return o.ToArray();}}}
}
"@ }
Add-Type -Path $dll
$o=Get-Content -Raw -Encoding UTF8 $spec | ConvertFrom-Json
$k=0
foreach($job in $o.jobs){
 $ms=New-Object System.IO.MemoryStream
 foreach($s in $job.s){ if($s.r){$b=[Convert]::FromBase64String([string]$s.r)} else {$b=[NtPrint2]::Img([string]$s.i,[string]$s.f,[float]$s.px,[bool]$s.b,[int]$s.w,[int]$s.a)}; $ms.Write($b,0,$b.Length) }
 $k++; [NtPrint2]::Send($printer,$ms.ToArray(),('NT-PRINT '+$k)); if($k -lt $o.jobs.Count){Start-Sleep -Milliseconds 150}
}
`;
// v1.1: WORKER — PowerShell ek dafa khulta hai (DLL load), phir har print ek line (base64 JSON) -> "OK" / "ERR ...".
const SRV = path.join(DIR, 'nt-print-srv.ps1');
const DLL_PART = PS1_TXT.slice(PS1_TXT.indexOf('$dll='), PS1_TXT.indexOf('$o=Get-Content'));
const SRV_TXT = `$ErrorActionPreference='Stop'
${DLL_PART}
[Console]::Out.WriteLine('READY'); [Console]::Out.Flush()
while($true){
 $line=[Console]::In.ReadLine(); if($line -eq $null){ break }
 try{
  $o=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line)) | ConvertFrom-Json
  $k=0
  foreach($job in $o.jobs){
   $ms=New-Object System.IO.MemoryStream
   foreach($s in $job.s){ if($s.r){$b=[Convert]::FromBase64String([string]$s.r)} else {$b=[NtPrint2]::Img([string]$s.i,[string]$s.f,[float]$s.px,[bool]$s.b,[int]$s.w,[int]$s.a)}; $ms.Write($b,0,$b.Length) }
   $k++; [NtPrint2]::Send([string]$o.printer,$ms.ToArray(),('NT-PRINT '+$k)); if($k -lt $o.jobs.Count){Start-Sleep -Milliseconds 150}
  }
  [Console]::Out.WriteLine('OK')
 } catch { [Console]::Out.WriteLine('ERR ' + ($_.Exception.Message -replace "[\r\n]+",' ')) }
 [Console]::Out.Flush()
}
`;
let wk = null;
function writeIf(f, t) { if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== t) fs.writeFileSync(f, t); }
function startWorker() {
  writeIf(PS1, PS1_TXT); writeIf(SRV, SRV_TXT);
  const w = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SRV], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  w.ready = false; w.buf = ''; w.wait = null; w.onReady = null;
  w.stdout.setEncoding('utf8');
  w.stdout.on('data', d => { w.buf += d; let i; while ((i = w.buf.indexOf('\n')) >= 0) { const l = w.buf.slice(0, i).trim(); w.buf = w.buf.slice(i + 1); if (!l) continue;
    if (l === 'READY') { w.ready = true; const f = w.onReady; w.onReady = null; f?.(); continue; }
    if (l === 'OK' || l.startsWith('ERR ')) { const f = w.wait; w.wait = null; f?.(l); } } });
  w.stderr.on('data', () => {});
  const dead = () => { if (wk === w) wk = null; const f = w.wait; w.wait = null; f?.('ERRW worker band'); const g = w.onReady; w.onReady = null; g?.(); };
  w.on('exit', dead); w.on('error', dead);
  w.stdin.on('error', () => {});
  wk = w; return w;
}
let wkBadUntil = 0;
function viaWorker(jobs, printer) {
  return new Promise(res => {
    if (Date.now() < wkBadUntil) { res('ERRW worker band (thori dair)'); return; }
    const w = wk || startWorker();
    if (!w.ready) {   // abhi tayyar nahi -> is dafa purana tareeqa (intezar NAHI), worker peeche tayyar hota rahe
      if (!w.t0) w.t0 = setTimeout(() => { if (!w.ready) { wkBadUntil = Date.now() + 10 * 60000; try { w.kill(); } catch {} } }, 40000);
      res('ERRW abhi tayyar nahi'); return;
    }
    const t = setTimeout(() => { w.wait = null; try { w.kill(); } catch {} res('ERRW 15 sec mein jawab nahi'); }, 15000);
    w.wait = l => { clearTimeout(t); res(l); };
    try { w.stdin.write(Buffer.from(JSON.stringify({ printer, jobs }), 'utf8').toString('base64') + '\n'); } catch { clearTimeout(t); w.wait = null; res('ERRW likh nahi saka'); }
  });
}
function oneShot(jobs, printer) {
  try { writeIf(PS1, PS1_TXT); } catch (e) { return Promise.resolve(e); }
  const spec = path.join(DIR, 'nt-print-job.json');
  fs.writeFileSync(spec, JSON.stringify({ jobs }), 'utf8');
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-spec', spec, '-printer', printer],
    { timeout: 90000, windowsHide: true }, (err, out, errOut) => res(err ? new Error((String(errOut || '').trim().split(/\r?\n/).pop()) || err.message) : null)));
}
let q = Promise.resolve();
function sendJobs(jobs, printer) {   // -> null (theek) ya Error
  const run = async () => {
    if (process.platform === 'win32' && opts.worker !== false) {
      const r = await viaWorker(jobs, printer);
      if (r === 'OK') return null;
      if (r.startsWith('ERR ')) return new Error(r.slice(4));   // printer ki ghalti — dobara mat chhapo
      // ERRW = worker ka masla -> purana tareeqa (print kabhi na ruke)
    }
    return oneShot(jobs, printer);
  };
  const p = q.then(run, run); q = p.catch(() => {}); return p;
}
// sirf ESC/POS bytes (rasid / gate pass) — ek job
const sendRaw = (bin, printer) => sendJobs([{ s: [{ r: Buffer.from(bin, 'binary').toString('base64') }] }], printer);
const warm = () => { try { if (process.platform === 'win32' && opts.worker !== false && !wk) { const w = startWorker(); w.t0 = setTimeout(() => { if (!w.ready) { wkBadUntil = Date.now() + 10 * 60000; try { w.kill(); } catch {} } }, 40000); } } catch {} };
  // worker mar jaye to agle print se pehle dobara garam
  setInterval(() => { if (!wk && Date.now() >= wkBadUntil) warm(); }, 60000).unref?.();


  return { Seg, tokenJobs, sendJobs, sendRaw, warm, ESC, GS, line, hr, when, dstr, tstr, FONT_UR, W, DOTS, num };
}
module.exports = { make };
