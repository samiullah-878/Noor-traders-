// ============================================================
//  nt-posui.js  v1.11 (2026-10-08: ⚡ bzzz TEZ — Search khirki ki nigrani ALAG thread par har 60 ms (pehle POS screen ke baqi kaam ke saath
//                   ~150-500 ms); likhai milte hi FORAN faisla (grid bharne ka 600 ms intezar khatam) · NtPosUi12.dll)
//                   · v1.10 (2026-10-08: 🔎 search khane ki likhai Win32 se — server ki jaanch (search-check.ps1): 'Search Items' alag khirki
//                   [WindowsForms10.Window] mil rahi thi (log: Search khirki: "" — 5 dafa) magar UIA Edit/ValuePattern KHALI deta tha. Ab khirki
//                   (GetAncestor root, main POS window nahi) ke andar WindowsForms EDIT dabbe ki likhai WM_GETTEXT se; UIA sirf fallback · NtPosUi11.dll)
//                   · v1.9 (2026-10-08: 🔎 SEARCH KHIRKI Win32 se — EnumWindows / EnumChildWindows: POS ki har NAYI dikhne wali khirki / dabba
//                   (sirf naye dabbon ki likhai WM_GETTEXT se — POS par bojh nahi) jis mein "Search Items" -> us ke search khane ki likhai + grid
//                   codes -> 'SBOX\t<likhai>\t<same>\t<qataren>' (scan pakra ho ya NAHI — server par scan pakra hi nahi ja raha tha) ·
//                   v1.8 wali UIA andar-talaash (dheemi, poori Sale list ginti thi) hata di · NtPosUi10.dll)
//                   · v1.8 (2026-10-08: 🔎 Search khirki Sale screen ke ANDAR (child form / pane) ya bina naam ke dabbe mein bhi — 'Search Items'
//                   likha element andar dhoondta hai (scan ke baad har 0.3 s, warna har 2 s), grid wala dabba = khirki · 'SRCHAT andar' log · NtPosUi9.dll)
//                   · v1.7 (2026-10-08: 🔎 SEARCH KHIRKI — scan ke foran baad POS ki "Search Items" khule = barcode POS mein nahi -> 'SRCH MISS'
//                   (bzzz); khirki mein wohi code kisi qatar ka Code ho (barcode 2 items par) = 'SRCH MULTI' (awaz nahi) · NT-PRINT stdin se 'CHK <code>'
//                   bhejta hai · NtPosUi8.dll) · v1.6 (2026-10-07: error box sirf ASLI — likhai + OK/Yes/No; settings/print/search jaisi window (likhne ka khana, list,
//                   checkbox) par bzzz nahi · Sale screen par wapsi 0.5 s mein (pehle 2 s)) · v1.5 (2026-10-07: NT-PRINT band ho to ye bhi band (purane bhatke posui processes shuru mein khatam) · 'PROC <naam>' (POS ka program — ghalat-window scan pakarne ko) · 'WIN 1/0' (Sale screen khuli/band) ·
//                   Sale screen khuli magar patti nahi = 0.5 s mein dobara dhoondo (pehle 1 s)) · v1.4 (2026-10-06: POS ka ERROR/message box (OK/Yes/No wala chhota window) pakro -> bzzz; box band hote hi patti foran dobara dhoondo
//                   taake awaz na ruke · local-config "posErrBeep": false = error par bzzz band) · v1.3 (2026-10-06: har 3 sec patti dobara dhoondo — Sale screen dobara khulne par purani patti murda, awaz band ho jati thi) · v1.2 (2026-10-06: screen-ginti (0 aati thi) chhori; ab POS ki 'Retail: .. PEICES: ..' patti ka NAAM (UIA) har 150 ms —
//                   item judte hi us item ki tafseel se badalti hai -> ADD) · v1.1 (2026-10-06: list 'table' nahi (sab Pane) -> SCREEN se: No. column ki patti (58px) ka screenshot har 200ms, likhai ki
//                   bands = qataren (header -1); window naam mein [Sale]; pane >900 chaura, 250-650 uncha, sab se chhota) · v1.0.2 (2026-10-06: 'miss' variable hataya — Add-Type warning ko error ginta tha) · v1.0.1 (2026-10-06: UIA assemblies poore raste se — pehle compile nahi hota tha) · v1.0 (2026-10-06) — 🔔 POS SCREEN DEKHO: POS (Cognitive "Retail Solution") ki Sale screen ki item-list (grid) ki
//  qataron ki ginti har 0.25 sec (Windows UI Automation, sirf PARHNA). Ginti barhi = item JURA (scan ho ya code likh kar) -> onAdd().
//  POS SQL mein sirf SAVE par likhta hai (pos-live test), is liye screen dekhna hi raasta hai. POS ko haath nahi lagata.
//  local-config: "posUi": false = band · "posTitle": "Retail Solution" (POS window ke naam ka hissa)
//  Apna alag PowerShell + NtPosUi6.dll — fail ho to scan awaz (nt-scan) par asar nahi.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function start({ dir, log, cfg, onAdd, onErr, onProc, onDown, onSrch, onSbox }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().posUi === false) return { active: () => false };
  const PS = path.join(dir, 'nt-posui.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPosUi12.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Diagnostics;using System.Threading;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Windows.Automation;
public class NtPosUi12{
 static void Say(string s){try{Console.Out.WriteLine(s);Console.Out.Flush();}catch{}}
 static AutomationElement FindWin(string t){
  foreach(AutomationElement w in AutomationElement.RootElement.FindAll(TreeScope.Children,Condition.TrueCondition)){
   string n="";try{n=w.Current.Name??"";}catch{} if(n.IndexOf(t,StringComparison.OrdinalIgnoreCase)>=0&&n.IndexOf("[Sale]",StringComparison.OrdinalIgnoreCase)>=0)return w;}
  return null;}
 // POS ki "Retail: .. CTN: .. PEICES: .. Pack Qty: .. -rate" wali patti — har item judne par us item ki tafseel se badalti hai
 static AutomationElement FindInfo(AutomationElement w){
  foreach(AutomationElement e in w.FindAll(TreeScope.Descendants,Condition.TrueCondition)){ try{ string n=e.Current.Name??""; if(n.StartsWith("Retail:")&&n.IndexOf("PEICES",StringComparison.OrdinalIgnoreCase)>=0)return e; }catch{} }
  return null;}
 static string Key(AutomationElement e){ try{ int[] r=e.GetRuntimeId(); return r==null?"":string.Join(".",Array.ConvertAll(r,x=>x.ToString())); }catch{ return ""; } }
 // v1.4: POS ka ERROR / message box · v1.6: SIRF asli box — likhai + OK/Yes/No jaise button; koi likhne ka khana / list / checkbox
 //   ho (settings, print, search window) to ye message box NAHI (pehle settings/print window par bhi bzzz baj sakti thi)
 static readonly string[] OKB={"OK","YES","NO","RETRY","TRY AGAIN"};
 static readonly string[] ANYB={"OK","YES","NO","RETRY","TRY AGAIN","CANCEL","ABORT","IGNORE","CLOSE","CONTINUE","HELP","MINIMIZE","MAXIMIZE","RESTORE"};
 static bool IsMsg(AutomationElement d, out string txt){
  txt=""; bool btn=false; var sb=new StringBuilder();
  try{ var r=d.Current.BoundingRectangle; if(r.Width>900||r.Height>600)return false; }catch{ return false; }
  try{ foreach(AutomationElement c in d.FindAll(TreeScope.Descendants,Condition.TrueCondition)){
    var ct=c.Current.ControlType; string n=(c.Current.Name??"").Trim();
    if(ct==ControlType.Button){ string b=n.Replace("&","").ToUpperInvariant(); if(Array.IndexOf(ANYB,b)<0)return false; if(Array.IndexOf(OKB,b)>=0)btn=true; }
    else if(ct==ControlType.Edit||ct==ControlType.ComboBox||ct==ControlType.List||ct==ControlType.ListItem||ct==ControlType.CheckBox||ct==ControlType.RadioButton||ct==ControlType.DataGrid||ct==ControlType.Table||ct==ControlType.Tree||ct==ControlType.Tab||ct==ControlType.Spinner||ct==ControlType.Slider||ct==ControlType.Menu||ct==ControlType.MenuBar||ct==ControlType.ToolBar)return false;
    else if(ct==ControlType.Text&&n.Length>0&&sb.Length<200){ sb.Append(n).Append(' '); } } }catch{ return false; }
  if(!btn)return false;
  string nm=""; try{ nm=d.Current.Name??""; }catch{}
  if(sb.Length==0&&nm.Length==0)return false;
  txt=(nm+": "+sb.ToString()).Replace((char)13,' ').Replace((char)10,' ').Trim(); return true; }
 static readonly Condition GRIDC=new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Table),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.DataGrid));
 // v1.9: 🔎 SEARCH KHIRKI — Windows ke seedhe tareeqe: POS process ki har dikhne wali khirki + us ke andar ke dabbe (EnumChildWindows).
 //   Sirf NAYE dabbon ki likhai poochi jati hai (WM_GETTEXT, 120 ms had) — POS par bojh nahi. "Search Items" wala naya dabba = khirki khuli.
 delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p,EnumProc f,IntPtr l);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint f);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 static string Cls(IntPtr h){ try{ var sb=new StringBuilder(200); GetClassName(h,sb,200); return sb.ToString(); }catch{ return ""; } }
 // v1.10: search khane ki likhai — khirki ke andar WindowsForms EDIT dabba (WM_GETTEXT). UIA ValuePattern is POS par khali deta tha.
 static string EditText(IntPtr box){ string got=""; EnumProc f=(h,l)=>{ if(got.Length==0&&IsWindowVisible(h)&&Cls(h).IndexOf("EDIT",StringComparison.OrdinalIgnoreCase)>=0){ string t=WTxt(h).Trim(); if(t.Length>0)got=t; } return true; };
  EnumChildWindows(box,f,IntPtr.Zero); GC.KeepAlive(f); return got; }
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,StringBuilder l,uint f,uint t,out IntPtr r);
 static string WTxt(IntPtr h){ try{ var sb=new StringBuilder(260); IntPtr r; SendMessageTimeout(h,0x000D,(IntPtr)260,sb,0x0002,120,out r); return sb.ToString(); }catch{ return ""; } }
 static List<IntPtr> VisibleOf(int pid){
  var tops=new List<IntPtr>(); var all=new List<IntPtr>();
  EnumProc ft=(h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==(uint)pid&&IsWindowVisible(h))tops.Add(h); return true; };
  EnumWindows(ft,IntPtr.Zero);
  EnumProc fc=(h,l)=>{ if(IsWindowVisible(h))all.Add(h); return true; };
  foreach(var t in tops){ all.Add(t); EnumChildWindows(t,fc,IntPtr.Zero); }
  GC.KeepAlive(ft); GC.KeepAlive(fc); return all; }
 static Dictionary<long,bool> visPrev=null; static IntPtr sH=IntPtr.Zero; static int sAt=0; static bool sDone=false; static int visPid=0;
 // v1.11: alag thread — main loop POS ka pid / main window batata hai, yeh har 60 ms naye dabbe dekhta hai
 static volatile int sbPid=0; static IntPtr sbMain=IntPtr.Zero;
 static void SboxLoop(string st){ while(true){ try{ int p=sbPid; if(p>0)SboxTick(p,st,sbMain); }catch{} Thread.Sleep(60); } }
 static void SboxTick(int pid,string st,IntPtr mainH){
  var vis=VisibleOf(pid); var cur=new Dictionary<long,bool>(); IntPtr hit=IntPtr.Zero; bool first=visPrev==null||visPid!=pid;
  foreach(var h in vis){ long k=h.ToInt64(); if(cur.ContainsKey(k))continue; cur[k]=true; if(first||hit!=IntPtr.Zero||visPrev.ContainsKey(k))continue;
   string t=WTxt(h); if(t.IndexOf(st,StringComparison.OrdinalIgnoreCase)>=0)hit=h; }
  visPrev=cur; visPid=pid; if(first)return;          // pehla chakkar: jo pehle se khula hai woh naya nahi
  if(sH!=IntPtr.Zero&&!cur.ContainsKey(sH.ToInt64()))sH=IntPtr.Zero;   // khirki band
  if(hit!=IntPtr.Zero&&hit!=sH){ sH=hit; sAt=Environment.TickCount; sDone=false; }
  if(sH==IntPtr.Zero||sDone)return;
  // v1.10: khirki = 'Search Items' wale dabbe ki root window (POS main window nahi — wahan Sale ka Code khana hai); andar ho to us ka parent
  IntPtr root=GetAncestor(sH,2), boxH=(root!=IntPtr.Zero&&root!=mainH)?root:GetParent(sH);
  string text=boxH!=IntPtr.Zero?EditText(boxH):"";
  AutomationElement box=null; IntPtr c=boxH!=IntPtr.Zero?boxH:sH;   // grid wala dabba (barcode 2 items par ho to pehchan) — POS main window tak nahi
  for(int i=0;i<4&&c!=IntPtr.Zero&&c!=mainH;i++){ AutomationElement e=null; try{ e=AutomationElement.FromHandle(c); }catch{}
   if(e!=null){ if(box==null)box=e; try{ if(e.FindFirst(TreeScope.Descendants,GRIDC)!=null){ box=e; break; } }catch{} }
   c=GetParent(c); }
  if(text.Length==0&&box!=null){ try{ foreach(AutomationElement ed in box.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit))){ string v=Val(ed).Trim(); if(v.Length>0){ text=v; break; } } }catch{} }   // UIA fallback
  int age=Environment.TickCount-sAt;
  if(text.Length==0&&age<1500)return;                 // likhai abhi nahi aayi
  var L=box!=null?Codes(box):new List<string>();      // v1.11: grid ka intezar nahi — likhai milte hi faisla (tez bzzz)
  int same=0; foreach(var x in L) if(string.Equals(x,text,StringComparison.OrdinalIgnoreCase))same++;
  sDone=true; Say("SBOX\t"+text.Replace((char)9,' ').Replace((char)10,' ').Replace((char)13,' ')+"\t"+same+"\t"+L.Count);
 }
 static List<AutomationElement> Dialogs(AutomationElement w,int pid){
  var L=new List<AutomationElement>();
  try{ foreach(AutomationElement t in AutomationElement.RootElement.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ProcessIdProperty,pid))){ if(!Automation.Compare(t,w))L.Add(t); } }catch{}
  try{ foreach(AutomationElement c in w.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Window)))L.Add(c); }catch{}
  return L; }
 // v1.7: 🔎 scan ke baad POS ki "Search Items" khirki — barcode nahi mila (ya kai items par)
 static volatile int chkUntil=0; static volatile int chkAt=0; static string chkCode=""; static readonly object ck=new object();
 static string Val(AutomationElement e){ try{ object o; if(e.TryGetCurrentPattern(ValuePattern.Pattern,out o)){ string v=((ValuePattern)o).Current.Value; if(v!=null)return v; } }catch{} try{ return e.Current.Name??""; }catch{ return ""; } }
 static List<string> Codes(AutomationElement d){
  var L=new List<string>();
  try{ var g=d.FindFirst(TreeScope.Descendants,new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Table),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.DataGrid)));
   if(g==null)return L; var tw=TreeWalker.ControlViewWalker; var r=tw.GetFirstChild(g); int n=0;
   while(r!=null&&n<60){ n++; string rn=""; try{ rn=r.Current.Name??""; }catch{}
    if(rn.IndexOf("Row",StringComparison.OrdinalIgnoreCase)>=0&&rn.IndexOf("Top",StringComparison.OrdinalIgnoreCase)<0){
     var c=tw.GetFirstChild(r); string first=null,code=null; int k=0;
     while(c!=null&&k<12){ k++; string cn=""; try{ cn=c.Current.Name??""; }catch{} string v=Val(c);
      if(cn.StartsWith("Code",StringComparison.OrdinalIgnoreCase)){ code=v; break; }
      if(first==null&&v.Length>0&&cn.IndexOf("Row",StringComparison.OrdinalIgnoreCase)>=0)first=v; c=tw.GetNextSibling(c); }
     string x=(code??first??"").Trim(); if(x.Length>0)L.Add(x); }
    r=tw.GetNextSibling(r); } }catch{}
  return L; }
 public static void Run(string title,string stitle){
  if(string.IsNullOrEmpty(stitle))stitle="Search Items";
  // v1.5: NT-PRINT band ho (stdin toota) to ye bhi band — pehle peeche chalta rehta tha (har restart par ek aur, CPU khata)
  var tq=new Thread(()=>{ try{ string s; while((s=Console.In.ReadLine())!=null){ if(s.StartsWith("CHK")){ lock(ck){ chkCode=s.Length>4?s.Substring(4).Trim():""; } chkAt=Environment.TickCount; chkUntil=chkAt+2600; } } }catch{} Environment.Exit(0); }); tq.IsBackground=true; tq.Start();
  var tsb=new Thread(()=>SboxLoop(stitle)); tsb.IsBackground=true; tsb.Start();   // v1.11: Search khirki ki tez nigrani
  Say("READY"); AutomationElement win=null,info=null; string last=null; int tick=0,pid=0,lastPid=-1; var seen=new Dictionary<string,bool>(); bool hadMsg=false,winOn=false; string srchKey=""; int srchSeenAt=0,repAt=-1,srchTry=0;
  while(true){
   try{
    if((win!=null)!=winOn){ winOn=win!=null; Say(winOn?"WIN 1":"WIN 0"); }
    if(pid>0&&pid!=lastPid){ lastPid=pid; try{ Say("PROC "+Process.GetProcessById(pid).ProcessName); }catch{} }
    bool chk=Environment.TickCount-chkUntil<0;
    sbPid=pid; if(win!=null){ try{ sbMain=new IntPtr(win.Current.NativeWindowHandle); }catch{} }   // v1.11: Search nigrani (alag thread) ko POS batao
    if(win!=null&&pid>0&&(tick%2==0||chk)){
     // har ~0.3 sec (scan ke baad har 0.15 sec): POS ka error/message box?  naya ho to ERR (bzzz) · v1.7: Search Items khirki?
     var now=new Dictionary<string,bool>();   // HashSet System.Core mein — PowerShell Add-Type ke default mein pakka nahi
     AutomationElement sd=null; string sk="";
     foreach(var d in Dialogs(win,pid)){ string k=Key(d); if(k.Length==0)continue; string dn=""; try{ dn=d.Current.Name??""; }catch{}
      if(dn.IndexOf(stitle,StringComparison.OrdinalIgnoreCase)>=0){ sd=d; sk=k; continue; }
      string tx; if(!IsMsg(d,out tx))continue; now[k]=true; if(!seen.ContainsKey(k))Say("ERR "+tx); }
     if(sd==null){ srchKey=""; }
     else if(sk!=srchKey){ srchKey=sk; srchSeenAt=Environment.TickCount; srchTry=0; }
     if(sd!=null){
      // scan ke aas paas khuli (scan se 0.5 s pehle tak) aur is scan ki report abhi nahi gayi
      if(chk&&repAt!=chkAt&&srchSeenAt-chkAt>-500){ var L=Codes(sd); srchTry++;
       if(L.Count>0||srchTry>=4){ string cc; lock(ck){ cc=chkCode; } int same=0; foreach(var x in L) if(string.Equals(x,cc,StringComparison.OrdinalIgnoreCase))same++;
        repAt=chkAt; Say((same>0?"SRCH MULTI ":"SRCH MISS ")+same+" "+L.Count+" "+string.Join(",",L.GetRange(0,Math.Min(6,L.Count)).ToArray())); } } }
     if(hadMsg&&now.Count==0){ info=null; last=null; Say("BACK"); }   // error band hua -> patti foran dobara dhoondo
     hadMsg=now.Count>0; seen=now;
    }
    // har ~3 sec dobara pakka karo: POS ki Sale screen band/dobara khuli ho to purani patti 'murda' ho jati hai
    if(info!=null&&++tick>=20){ tick=0; var w0=FindWin(title); var i0=w0==null?null:FindInfo(w0); if(i0==null){ Say("LOST"); info=null; last=null; } else { win=w0; pid=w0.Current.ProcessId; if(!Automation.Compare(i0,info)){ info=i0; last=info.Current.Name; Say("GRID info (nayi) "+last); } } }
    if(info==null){ tick++; var w=FindWin(title); if(w!=null){ win=w; pid=w.Current.ProcessId; info=FindInfo(w); if(info!=null){ last=info.Current.Name; tick=0; Say("GRID info "+last); } } else { win=null; pid=0; } }
    else { string n=info.Current.Name??""; if(last!=null&&n!=last&&n.StartsWith("Retail:"))Say("ADD 1"); last=n; }
   }catch{ if(info!=null)Say("LOST"); info=null; last=null; }
   Thread.Sleep(info!=null||Environment.TickCount-chkUntil<0?150:(hadMsg?300:500));   // v1.6: Sale screen par wapsi bhi 0.5 s mein (pehle 2 s) · v1.7: scan ke baad 0.15 s
  }}
}
"@ }
Add-Type -Path $dll
[NtPosUi12]::Run([string]$args[0],[string]$args[1])
`;
  let child = null, gridOn = false, winOn = false, fails = 0, stopped = false, swept = false;
  // v1.5: pehle ke NT-PRINT restarts se peeche reh gaye nt-posui PowerShell band karo (sirf ek dafa, apna naya chalane se pehle)
  const sweep = done => {
    const cmd = "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*nt-posui.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }";
    let out = '';
    try {
      const k = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(cmd, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      const t = setTimeout(() => { try { k.kill(); } catch {} }, 20000);
      k.stdout.on('data', d => { out += d; });
      k.on('exit', () => { clearTimeout(t); const n = out.split(/\s+/).filter(Boolean).length; if (n) log(`🔔 POS screen: ${n} purane bhatke watcher band kiye`); done(); });
      k.on('error', () => { clearTimeout(t); done(); });
    } catch { done(); }
  };
  const run = () => {
    if (stopped || C().posUi === false) return;
    if (!swept) { swept = true; sweep(run); return; }
    try { if (!fs.existsSync(PS) || fs.readFileSync(PS, 'utf8') !== TXT) fs.writeFileSync(PS, TXT); } catch (e) { log('🔔 POS screen: ' + e.message); return; }
    const w = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS, String(C().posTitle || 'Retail Solution'), String(C().posSearchTitle || 'Search Items')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    w.stdin.on('error', () => {});
    child = w; let buf = '', err = '';
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      if (l === 'READY') { fails = 0; log('🔔 POS screen dekhna chalu — POS ki Sale screen ka intezar'); }
      else if (l.startsWith('GRID ')) { gridOn = true; log('🔔 POS item patti mil gayi: ' + l.slice(5)); }
      else if (l.startsWith('ROWS ')) { if (C().posUiLog) log('🔔 POS qataren: ' + l.slice(5)); }
      else if (l === 'LOST') { gridOn = false; if (C().posUiLog) log('🔔 POS patti gum — dobara dhoond raha'); }
      else if (l.startsWith('ERR ')) { log('🔔 POS ERROR box: ' + l.slice(4).slice(0, 160)); if (C().posErrBeep !== false) try { onErr && onErr(l.slice(4)); } catch {} }   // v1.4
      else if (l.startsWith('PROC ')) { try { onProc && onProc(l.slice(5).trim()); } catch {} }   // v1.5
      else if (l === 'WIN 1' || l === 'WIN 0') { winOn = l === 'WIN 1'; if (!winOn) gridOn = false; }
      else if (l === 'BACK') { if (C().posUiLog) log('🔔 POS error band — patti dobara dhoond raha'); }
      else if (l.startsWith('SBOX\t')) { const [, text, same, n] = l.split('\t'); try { onSbox && onSbox({ text: String(text || '').trim(), same: Number(same) || 0, n: Number(n) || 0 }); } catch {} }   // v1.9
      else if (l.startsWith('SRCH ')) { const [, kind, same, n, codes] = l.split(' '); log(`🔎 POS Search khirki: ${kind === 'MULTI' ? 'barcode ' + same + ' item(s) par — chunna hai' : 'barcode POS mein NAHI'} (qataren ${n}${codes ? ': ' + codes : ''})`); try { onSrch && onSrch({ kind, same: Number(same) || 0, n: Number(n) || 0, codes: codes || '' }); } catch {} }   // v1.7
      else if (l.startsWith('ADD ')) { try { onAdd(Number(l.slice(4)) || 1); } catch {} } } });
    w.stderr.on('data', d => { err = (err + d).slice(-2000); });
    w.on('exit', code => { if (child === w) child = null; gridOn = false; winOn = false; if (stopped) return; fails++; try { onDown && onDown(); } catch {}
      const el = err.split(/\r?\n/).filter(x => /error|CS\d{4}/i.test(x)).slice(0, 3).join(' | ') || err.trim().split(/\r?\n/).pop();
      log(`🔔 POS screen dekhna band (code ${code})${err ? ' — ' + el : ''}` + (fails < 6 ? ' — 30 sec mein dobara' : ' — chhor diya'));
      if (fails < 6) setTimeout(run, 30000); });
  };
  setTimeout(run, 5000);
  // v1.7: scan hua — agle 2.6 s POS ki Search khirki dekho (code se milao)
  const check = code => { try { if (child) child.stdin.write('CHK ' + String(code || '').replace(/\s+/g, '').slice(0, 60) + '\n'); } catch {} };
  return { active: () => gridOn, win: () => winOn, alive: () => !!child, check, stop() { stopped = true; try { child && child.kill(); } catch {} } };
}
module.exports = { start };
