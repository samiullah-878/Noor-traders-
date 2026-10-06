// ============================================================
//  nt-posui.js  v1.1 (2026-10-06: list 'table' nahi (sab Pane) -> SCREEN se: No. column ki patti (58px) ka screenshot har 200ms, likhai ki
//                   bands = qataren (header -1); window naam mein [Sale]; pane >900 chaura, 250-650 uncha, sab se chhota) · v1.0.2 (2026-10-06: 'miss' variable hataya — Add-Type warning ko error ginta tha) · v1.0.1 (2026-10-06: UIA assemblies poore raste se — pehle compile nahi hota tha) · v1.0 (2026-10-06) — 🔔 POS SCREEN DEKHO: POS (Cognitive "Retail Solution") ki Sale screen ki item-list (grid) ki
//  qataron ki ginti har 0.25 sec (Windows UI Automation, sirf PARHNA). Ginti barhi = item JURA (scan ho ya code likh kar) -> onAdd().
//  POS SQL mein sirf SAVE par likhta hai (pos-live test), is liye screen dekhna hi raasta hai. POS ko haath nahi lagata.
//  local-config: "posUi": false = band · "posTitle": "Retail Solution" (POS window ke naam ka hissa)
//  Apna alag PowerShell + NtPosUi1.dll — fail ho to scan awaz (nt-scan) par asar nahi.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function start({ dir, log, cfg, onAdd }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().posUi === false) return { active: () => false };
  const PS = path.join(dir, 'nt-posui.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPosUi2.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase,System.Drawing
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location,[System.Drawing.Bitmap].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Threading;using System.Windows.Automation;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public class NtPosUi2{
 static void Say(string s){try{Console.Out.WriteLine(s);Console.Out.Flush();}catch{}}
 static AutomationElement FindWin(string t){
  foreach(AutomationElement w in AutomationElement.RootElement.FindAll(TreeScope.Children,Condition.TrueCondition)){
   string n="";try{n=w.Current.Name??"";}catch{} if(n.IndexOf(t,StringComparison.OrdinalIgnoreCase)>=0&&n.IndexOf("[Sale]",StringComparison.OrdinalIgnoreCase)>=0)return w;}
  return null;}
 // item-list = Sale window ka wo pane jo chaura (>900) aur 250..650 uncha ho; kai hon to sab se CHHOTA (andar wala)
 static System.Windows.Rect FindGrid(AutomationElement w){
  System.Windows.Rect best=System.Windows.Rect.Empty;double area=double.MaxValue;
  foreach(AutomationElement g in w.FindAll(TreeScope.Descendants,Condition.TrueCondition)){ try{ var r=g.Current.BoundingRectangle; if(r.Width>900&&r.Height>=250&&r.Height<=650){ double a=r.Width*r.Height; if(a<area){area=a;best=r;} } }catch{} }
  return best;}
 // "No." column ki patti (x 2..60) mein likhai ki qataren (bands) gino — pehli band header
 static int Rows(System.Windows.Rect r){
  int x0=(int)r.X+2,y0=(int)r.Y,w=58,h=(int)r.Height; if(h<10)return -1;
  using(var bmp=new Bitmap(w,h,PixelFormat.Format24bppRgb)){ using(var g=Graphics.FromImage(bmp)){ g.CopyFromScreen(x0,y0,0,0,new Size(w,h)); }
   var bd=bmp.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb); int st=bd.Stride; byte[] px=new byte[st*h]; Marshal.Copy(bd.Scan0,px,0,px.Length); bmp.UnlockBits(bd);
   // background = sab se aam rang (neeche ka hissa)
   int bq=(h-3)*st+30*3; int bb=px[bq],bg=px[bq+1],br=px[bq+2];
   int bands=0; bool inb=false; int bh=0;
   for(int y=0;y<h;y++){ bool dark=false; for(int x=4;x<w;x++){ int q=y*st+x*3; int d=Math.Abs(px[q]-bb)+Math.Abs(px[q+1]-bg)+Math.Abs(px[q+2]-br); if(d>120){dark=true;break;} }
    if(dark){ if(!inb){inb=true;bh=0;} bh++; } else { if(inb&&bh>=4&&bh<=40)bands++; inb=false; } }
   if(inb&&bh>=4&&bh<=40)bands++;
   return Math.Max(0,bands-1); } }
 public static void Run(string title){
  Say("READY"); System.Windows.Rect grid=System.Windows.Rect.Empty; int last=-1; int stable=0; int lastSeen=-1;
  while(true){
   try{
    if(grid.IsEmpty){ var w=FindWin(title); if(w!=null){ grid=FindGrid(w); if(!grid.IsEmpty){ last=-1; Say("GRID "+(int)grid.X+","+(int)grid.Y+" "+(int)grid.Width+"x"+(int)grid.Height); } } }
    if(!grid.IsEmpty){ var w=FindWin(title); if(w==null){ Say("LOST"); grid=System.Windows.Rect.Empty; } else {
     int c=Rows(grid);
     if(c==lastSeen)stable++; else {stable=0;lastSeen=c;}
     if(stable>=1){ if(last>=0&&c>last)Say("ADD "+(c-last)); if(last<0||c!=last)Say("ROWS "+c); last=c; } } }
   }catch{ if(!grid.IsEmpty)Say("LOST"); grid=System.Windows.Rect.Empty; last=-1; }
   Thread.Sleep(grid.IsEmpty?3000:200);
  }}
}
"@ }
Add-Type -Path $dll
[NtPosUi2]::Run([string]$args[0])
`;
  let child = null, gridOn = false, fails = 0, stopped = false;
  const run = () => {
    if (stopped || C().posUi === false) return;
    try { if (!fs.existsSync(PS) || fs.readFileSync(PS, 'utf8') !== TXT) fs.writeFileSync(PS, TXT); } catch (e) { log('🔔 POS screen: ' + e.message); return; }
    const w = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS, String(C().posTitle || 'Retail Solution')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child = w; let buf = '', err = '';
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      if (l === 'READY') { fails = 0; log('🔔 POS screen dekhna chalu — POS ki Sale screen ka intezar'); }
      else if (l.startsWith('GRID ')) { gridOn = true; log('🔔 POS item-list mil gayi (screen): ' + l.slice(5)); }
      else if (l.startsWith('ROWS ')) { if (C().posUiLog) log('🔔 POS qataren: ' + l.slice(5)); }
      else if (l === 'LOST') { gridOn = false; }
      else if (l.startsWith('ADD ')) { try { onAdd(Number(l.slice(4)) || 1); } catch {} } } });
    w.stderr.on('data', d => { err = (err + d).slice(-2000); });
    w.on('exit', code => { if (child === w) child = null; gridOn = false; if (stopped) return; fails++;
      const el = err.split(/\r?\n/).filter(x => /error|CS\d{4}/i.test(x)).slice(0, 3).join(' | ') || err.trim().split(/\r?\n/).pop();
      log(`🔔 POS screen dekhna band (code ${code})${err ? ' — ' + el : ''}` + (fails < 6 ? ' — 30 sec mein dobara' : ' — chhor diya'));
      if (fails < 6) setTimeout(run, 30000); });
  };
  setTimeout(run, 5000);
  return { active: () => gridOn, stop() { stopped = true; try { child && child.kill(); } catch {} } };
}
module.exports = { start };
