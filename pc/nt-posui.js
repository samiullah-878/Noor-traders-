// ============================================================
//  nt-posui.js  v1.16 (2026-11-26: 🔤 POS screen ka OCR — malik: 'Live par item ke naam'. Scanner ki keys POS ke andar NT-PRINT tak nahi
//                   pohanchti (pakre 0), is liye shot() ki Sale list wali tasveer par Windows ka APNA OCR (Windows.Media.Ocr — internet / AI nahi):
//                   tasveer 2 guna bari, har ~1 s se zyada nahi (OCR ke waqt ka 3 guna), pehle dekhi shakal yaad se (cursor ki jhapak), BelowNormal;
//                   'OCR\t w \t h \t ms \t [[x,y,w,h,"lafz"],...] \t mode' -> ocrRows() qataren -> NT-PRINT posLive/<naam>__ocr. Sirf jab NT-PRINT
//                   ocr:true bheje (purana NT-PRINT = OCR band) · local-config "posOcr": false = band · ghalti = sirf OCR band, tasveer chalti rahe)
//                   · v1.15 (2026-11-17: 🧠 memory chowkidar — malik ke PC par watcher 9:19 se 4.5 GB (managed UI Automation memory nahi chhorta,
//                   ~800 MB / ghanta). Har 2 min tasklist se watcher ki memory; 600 MB (local-config posUiMem) se upar = band + 2 s mein naya (30 s
//                   wala intezar / fails ginti nahi). POS / printer / spooler ko haath nahi.) · v1.14 (2026-11-10: 🖥 shot tez — har 0.2 s dekh, 0.35 s gap; malik: "kuch seconds ka farq") · v1.13 (2026-11-10: 🖥 shot() — live camera ke saath POS ki Sale list ki chhoti tasveer, sirf jab koi Live dekh raha ho; neeche tafseel)
//                   · v1.12 (2026-10-08: 🔎 Abdurehman PC: Search khirki POS ke ANDAR (child form) — v1.10/1.11 us ka PARENT (Sale screen) parhta
//                   tha -> likhai "00123402" (Sale No) / "0". Ab dabba = jo KHUD 'Search Items' hai (label ho to us ka parent); us mein khana na
//                   mile to sirf alag root khirki · NtPosUi13.dll)
//                   · v1.11 (2026-10-08: ⚡ bzzz TEZ — Search khirki ki nigrani ALAG thread par har 60 ms (pehle POS screen ke baqi kaam ke saath
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
const { spawn, execFile } = require('child_process');

function start({ dir, log, cfg, onAdd, onErr, onProc, onDown, onSrch, onSbox }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().posUi === false) return { active: () => false };
  const PS = path.join(dir, 'nt-posui.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPosUi13.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Diagnostics;using System.Threading;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Windows.Automation;
public class NtPosUi13{
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
  // v1.12: dabba = jo KHUD 'Search Items' hai (alag khirki ho ya POS ke andar ka form); 'Search Items...' likha LABEL ho to us ka parent.
  //   (v1.10 andar wale form ka PARENT — Sale screen — parhta tha: Sale No "00123402" / "0" aata tha.) Khana na mile to alag root khirki.
  IntPtr root=GetAncestor(sH,2);
  IntPtr boxH=Cls(sH).IndexOf("STATIC",StringComparison.OrdinalIgnoreCase)>=0?GetParent(sH):sH;
  string text=boxH!=IntPtr.Zero?EditText(boxH):"";
  if(text.Length==0&&root!=IntPtr.Zero&&root!=mainH&&root!=boxH)text=EditText(root);
  AutomationElement box=null; IntPtr c=boxH!=IntPtr.Zero?boxH:sH;   // grid wala dabba (barcode 2 items par ho to pehchan) — POS main window tak nahi
  for(int i=0;i<1&&c!=IntPtr.Zero&&c!=mainH;i++){ AutomationElement e=null; try{ e=AutomationElement.FromHandle(c); }catch{}   // v1.12: sirf wohi dabba (upar Sale screen ki list / Sale No nahi)
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
[NtPosUi13]::Run([string]$args[0],[string]$args[1])
`;
  let child = null, gridOn = false, winOn = false, fails = 0, stopped = false, swept = false, memKill = false;
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
    w.on('exit', code => { if (child === w) child = null; gridOn = false; winOn = false; if (stopped) return;
      if (memKill) { memKill = false; setTimeout(run, 2000); return; }   // v1.15: memory wala restart — foran naya, fails mein nahi
      fails++; try { onDown && onDown(); } catch {}
      const el = err.split(/\r?\n/).filter(x => /error|CS\d{4}/i.test(x)).slice(0, 3).join(' | ') || err.trim().split(/\r?\n/).pop();
      log(`🔔 POS screen dekhna band (code ${code})${err ? ' — ' + el : ''}` + (fails < 6 ? ' — 30 sec mein dobara' : ' — chhor diya'));
      if (fails < 6) setTimeout(run, 30000); });
  };
  setTimeout(run, 5000);
  // v1.15: 🧠 memory chowkidar — watcher (managed UIA) memory chhorta nahi; had se upar = band + 2 s mein naya. tasklist halka hai (spooler / POS nahi chhoota).
  const memCheck = () => {
    const w = child; if (!w || !w.pid || stopped || memKill) return;
    execFile('tasklist', ['/FI', 'PID eq ' + w.pid, '/FO', 'CSV', '/NH'], { timeout: 10000, windowsHide: true }, (e, out) => {
      if (e || child !== w || memKill) return;
      const cols = (String(out || '').trim().split(/\r?\n/)[0] || '').match(/"([^"]*)"/g) || []; if (cols.length < 5) return;
      const mb = Math.round((Number(cols[cols.length - 1].replace(/[^\d]/g, '')) || 0) / 1024), lim = Math.max(200, Number(C().posUiMem) || 600);
      if (mb > lim) { log(`🧠 POS screen watcher ${mb} MB (had ${lim}) — naya chala raha`); memKill = true; try { w.kill(); } catch { memKill = false; } }
    });
  };
  const memT = setInterval(memCheck, 120000);
  // v1.7: scan hua — agle 2.6 s POS ki Search khirki dekho (code se milao)
  const check = code => { try { if (child) child.stdin.write('CHK ' + String(code || '').replace(/\s+/g, '').slice(0, 60) + '\n'); } catch {} };
  return { active: () => gridOn, win: () => winOn, alive: () => !!child, check, stop() { stopped = true; clearInterval(memT); try { child && child.kill(); } catch {} } };
}
// ============================================================
//  v1.13 (2026-11-10) 🖥 POS SCREEN KI TASVEER (live camera ke saath) — malik: "item likho wo app mein aaye · remove = remove · print ke baad naya bill".
//  POS SQL mein sirf Print / Save par likhta hai aur Sale list UIA ko text nahi deti (sab Pane) -> list ke hisse ki CHHOTI TASVEER (sirf badle to).
//  SIRF jab koi Live dekh raha ho (nt-print set(true)) — warna yeh PowerShell chalta hi nahi. Sirf screen PARHTA hai, POS ko haath nahi lagata.
//  Alag PowerShell (bina C# compile) — fail ho to awaz system par asar nahi. local-config "posShot": false = band.
// ============================================================
const SHOT_TXT = String.raw`param([string]$Title='Retail Solution',[int]$Pp=0,[int]$Ocr=0)
$ErrorActionPreference='Stop'
function Say($s){ [Console]::Out.WriteLine($s); [Console]::Out.Flush() }
try{
 Add-Type -AssemblyName System.Drawing
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 Add-Type -AssemblyName WindowsBase
}catch{ Say ("ERR"+[char]9+"assembly: "+$_.Exception.Message); exit 2 }
$AE=[System.Windows.Automation.AutomationElement]
$TS=[System.Windows.Automation.TreeScope]
$paneC=New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty,[System.Windows.Automation.ControlType]::Pane)
$codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$ep=New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,50L)
$md5=[System.Security.Cryptography.MD5]::Create()
$T=[char]9
# v1.16: OCR = Windows ka apna (internet / AI nahi). Sirf jab NT-PRINT -Ocr 1 bheje. Ghalti = sirf OCR band, tasveer chalti rahe.
$OCRON=$false; $OcrEng=$null; $GA=$null; $TyEng=$null; $TyRes=$null; $TyDec=$null; $TySbm=$null; $TyFile=$null; $TyFam=$null; $TyRas=$null; $ocrMax=2600; $oFile=$false
if($Ocr -eq 1){
 try{
  try{ (Get-Process -Id $PID).PriorityClass='BelowNormal' }catch{}
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $TyEng=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
  $TyRes=[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
  $TyDec=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
  $TySbm=[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation,ContentType=WindowsRuntime]
  $GA=[System.WindowsRuntimeSystemExtensions].GetMember('GetAwaiter') | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq ('IAsyncOperation'+[char]96+'1') } | Select-Object -First 1
  if($GA -eq $null){ throw 'GetAwaiter nahi mila' }
  $OcrEng=$TyEng::TryCreateFromUserProfileLanguages()
  if($OcrEng -eq $null){ $TyLang=[Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime]; $OcrEng=$TyEng::TryCreateFromLanguage($TyLang::new('en-US')) }
  if($OcrEng -eq $null){ throw 'Windows OCR ki zaban (English) is PC par nahi' }
  try{ $mx=[int]$TyEng::MaxImageDimension; if($mx -ge 500){ $ocrMax=$mx } }catch{}
  $ocLang=''; try{ $ocLang=[string]$OcrEng.RecognizerLanguage.LanguageTag }catch{}
  $OCRON=$true
  Say ("OCRON"+$T+$ocLang+$T+$ocrMax)
 }catch{ Say ("OCRERR"+$T+"OCR shuru nahi hua: "+$_.Exception.Message) }
}
function AwaitR($op,$rt){ $a=$GA.MakeGenericMethod($rt).Invoke($null,@($op)); return ,($a.GetResult()) }
function OcrSoft($big){
 if(-not $script:oFile){
  $m=New-Object System.IO.MemoryStream
  try{
   $big.Save($m,[System.Drawing.Imaging.ImageFormat]::Bmp); $m.Position=0
   $ras=[System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($m)
   $dec=AwaitR ($TyDec::CreateAsync($ras)) $TyDec
   return ,(AwaitR ($dec.GetSoftwareBitmapAsync()) $TySbm)
  }catch{ $script:oFile=$true; Say ("OCRINFO"+$T+"stream nahi chala, ab file se: "+$_.Exception.Message) }finally{ $m.Dispose() }
 }
 if($script:TyFile -eq $null){
  $script:TyFile=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
  $script:TyFam=[Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]
  $script:TyRas=[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
 }
 $sf=$script:TyFile; $fam=$script:TyFam; $rs=$script:TyRas
 $tf=Join-Path $env:TEMP ('nt-ocr-'+$PID+'.bmp')
 $big.Save($tf,[System.Drawing.Imaging.ImageFormat]::Bmp)
 $f=AwaitR ($sf::GetFileFromPathAsync($tf)) $sf
 $st=AwaitR ($f.OpenAsync($fam::Read)) $rs
 try{ $dec=AwaitR ($TyDec::CreateAsync($st)) $TyDec; return ,(AwaitR ($dec.GetSoftwareBitmapAsync()) $TySbm) }finally{ try{ $st.Dispose() }catch{} }
}
function JEsc([string]$s){
 $o=New-Object System.Text.StringBuilder
 foreach($c in $s.ToCharArray()){
  $i=[int]$c
  if($i -eq 34 -or $i -eq 92){ [void]$o.Append([char]92); [void]$o.Append($c) }
  elseif($i -lt 32 -or $i -gt 126){ [void]$o.Append([char]92); [void]$o.Append(('u{0:x4}' -f $i)) }
  else{ [void]$o.Append($c) }
 }
 return $o.ToString()
}
# grid ki tasveer 2 guna bari (OCR chhoti likhai behtar parhta hai, MaxImageDimension ke andar) -> lafz + jagah: [[x,y,w,h,"lafz"],...] asal pixel mein
function OcrRun($src,$cw,$ch){
 $s=2.0; $lim=[double]$ocrMax-8
 if($cw*$s -gt $lim){ $s=$lim/$cw }
 if($ch*$s -gt $lim){ $s=$lim/$ch }
 $bw=[int]($cw*$s); $bh=[int]($ch*$s)
 $big=New-Object System.Drawing.Bitmap($bw,$bh,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
 try{
  $gg=[System.Drawing.Graphics]::FromImage($big)
  try{ $gg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $gg.DrawImage($src,0,0,$bw,$bh) }finally{ $gg.Dispose() }
  $sbm=OcrSoft $big
 }finally{ $big.Dispose() }
 try{ $res=AwaitR ($OcrEng.RecognizeAsync($sbm)) $TyRes }finally{ try{ $sbm.Dispose() }catch{} }
 $o=New-Object System.Text.StringBuilder
 [void]$o.Append('[')
 $n=0
 foreach($ln in $res.Lines){
  foreach($wd in $ln.Words){
   $tx=[string]$wd.Text; if(-not $tx){ continue }
   $r=$wd.BoundingRect
   if($n -gt 0){ [void]$o.Append(',') }
   [void]$o.Append('['+[int]($r.X/$s)+','+[int]($r.Y/$s)+','+[int]($r.Width/$s)+','+[int]($r.Height/$s)+','+[char]34+(JEsc $tx)+[char]34+']')
   $n++
  }
  if($n -ge 700){ break }
 }
 [void]$o.Append(']')
 return $o.ToString()
}
function FindWin{
 foreach($x in $AE::RootElement.FindAll($TS::Children,[System.Windows.Automation.Condition]::TrueCondition)){
  $n=''; try{ $n=[string]$x.Current.Name }catch{}
  if($n -and $n.IndexOf($Title,[StringComparison]::OrdinalIgnoreCase) -ge 0 -and $n.IndexOf('[Sale]',[StringComparison]::OrdinalIgnoreCase) -ge 0){ return $x }
 }
 return $null
}
# Sale list ka dabba: chaura (>= 60% khirki), 25%-80% uncha, sab se chhota. Na mile = poori khirki.
function FindGrid($w,$wr){
 $best=$null; $ba=0.0; $n=0
 foreach($p in $w.FindAll($TS::Descendants,$paneC)){
  $n++; if($n -gt 4000){ break }
  $r=$null; try{ $r=$p.Current.BoundingRectangle }catch{ continue }
  if($r.IsEmpty){ continue }
  if($r.Width -ge $wr.Width*0.6 -and $r.Height -ge $wr.Height*0.25 -and $r.Height -le $wr.Height*0.8){
   $a=$r.Width*$r.Height
   if($best -eq $null -or $a -lt $ba){ $best=$r; $ba=$a }
  }
 }
 $script:panes=$n
 return $best
}
$sw=[System.Diagnostics.Stopwatch]::StartNew(); $w=$null; $wr=$null; $gr=$null; $gt=0; $grAt=0; $last=''; $lastSend=-99999; $off=''; $buf=$null; $bad=0; $panes=0; $wkey=''
$oc=@{}; $oj=''; $oAt=-99999; $oGap=900; $oBad=0; $memAt=0
Say 'READY'
while($true){
 try{
  if($Pp -gt 0 -and -not (Get-Process -Id $Pp -ErrorAction SilentlyContinue)){ exit 0 }
  $now=[long]$sw.ElapsedMilliseconds
  if($OCRON -and ($now-$memAt) -gt 60000){ $memAt=$now; $wsz=0; try{ $wsz=(Get-Process -Id $PID).WorkingSet64 }catch{}; if($wsz -gt 700MB){ Say ("OCRINFO"+$T+"memory "+[int]($wsz/1MB)+" MB - dobara shuru"); exit 5 } }
  if($w -eq $null){ $w=FindWin; $gt=$now; $wkey='' }
  elseif(($now-$gt) -gt 15000){ $w=FindWin; $gt=$now }
  if(($now-$grAt) -gt 60000){ $wkey='' }
  if($w -eq $null){ if($off -ne 'nowin'){ $off='nowin'; $last=''; $oj=''; Say ("OFF"+$T+"POS ki Sale screen khuli nahi") }; Start-Sleep -Milliseconds 1500; continue }
  $wr=$null; try{ $wr=$w.Current.BoundingRectangle }catch{ $w=$null; continue }
  if($wr.IsEmpty -or $wr.Left -lt -10000 -or $wr.Width -lt 300 -or $wr.Height -lt 200){ if($off -ne 'min'){ $off='min'; $last=''; $oj=''; Say ("OFF"+$T+"POS ki khirki chhoti (minimize) hai") }; Start-Sleep -Milliseconds 1500; continue }
  $k=''+[int]$wr.Left+','+[int]$wr.Top+','+[int]$wr.Width+','+[int]$wr.Height
  if($k -ne $wkey){ $wkey=$k; $grAt=$now; $gr=$null; try{ $gr=FindGrid $w $wr }catch{ $gr=$null } }
  $mode='g'; $r=$gr; if($r -eq $null){ $mode='w'; $r=$wr }
  $x=[int]$r.Left; $y=[int]$r.Top; $cw=[int]$r.Width; $ch=[int]$r.Height
  if($cw -lt 50 -or $ch -lt 50){ Start-Sleep -Milliseconds 1000; continue }
  $bmp=New-Object System.Drawing.Bitmap($cw,$ch)
  try{
   $g=[System.Drawing.Graphics]::FromImage($bmp)
   try{ $g.CopyFromScreen($x,$y,0,0,$bmp.Size) }finally{ $g.Dispose() }
   $rect=New-Object System.Drawing.Rectangle(0,0,$cw,$ch)
   $bd=$bmp.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
   try{
    $len=[Math]::Abs($bd.Stride)*$ch
    if($buf -eq $null -or $buf.Length -ne $len){ $buf=New-Object byte[] $len }
    [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0,$buf,0,$len)
   }finally{ $bmp.UnlockBits($bd) }
   $sig=[BitConverter]::ToString($md5.ComputeHash($buf))
   $gap=350; if($mode -eq 'w'){ $gap=1200 }
   $since=$now-$lastSend
   if($sig -ne $last -and $since -ge $gap){
    $ow=$cw; $oh=$ch
    if($cw -gt 900){ $ow=900; $oh=[int]($ch*900/$cw) }
    $out=$bmp; $own=$false
    if($ow -ne $cw){ $out=New-Object System.Drawing.Bitmap($bmp,(New-Object System.Drawing.Size($ow,$oh))); $own=$true }
    $ms=New-Object System.IO.MemoryStream
    try{ $out.Save($ms,$codec,$ep); $b=[Convert]::ToBase64String($ms.ToArray()) }finally{ $ms.Dispose(); if($own){ $out.Dispose() } }
    $dg=$mode+' '+$cw+'x'+$ch+' | khirki '+[int]$wr.Width+'x'+[int]$wr.Height+' | dabbe '+$panes
    Say ("IMG"+$T+$mode+$T+$ow+$T+$oh+$T+$dg+$T+$b)
    $last=$sig; $lastSend=$now; $off=''
   }
   # v1.16: OCR — tasveer badli ho to (pehle dekhi hui shakal = yaad se, OCR nahi; cursor ki jhapak 2 shaklein), har ~1 s se zyada nahi
   if($OCRON -and ($now-$oAt) -ge $oGap){
    if($oc.ContainsKey($sig)){ $ov=$oc[$sig]; if($ov[0] -ne $oj){ Say ("OCR"+$T+$cw+$T+$ch+$T+$ov[1]+$T+$ov[0]+$T+$mode); $oj=$ov[0]; $oAt=$now } }
    else{
     $t0=[long]$sw.ElapsedMilliseconds
     try{
      $j=OcrRun $bmp $cw $ch
      $oms=[long]$sw.ElapsedMilliseconds-$t0
      if($oc.Count -ge 6){ $oc.Clear() }
      $oc[$sig]=@($j,$oms)
      if($j -ne $oj){ Say ("OCR"+$T+$cw+$T+$ch+$T+$oms+$T+$j+$T+$mode); $oj=$j }
      $oBad=0; $oGap=[Math]::Max(900,[int]($oms*3)); if($mode -ne 'g' -and $oGap -lt 2000){ $oGap=2000 }
     }catch{
      $oBad++; $oGap=4000; $oj=''
      Say ("OCRERR"+$T+$_.Exception.Message)
      if($oBad -ge 5){ $OCRON=$false; Say ("OCRERR"+$T+"5 dafa ghalti - OCR band (tasveer chalti rahegi)") }
     }
     $oAt=[long]$sw.ElapsedMilliseconds
    }
   }
  }finally{ $bmp.Dispose() }
  $bad=0
  Start-Sleep -Milliseconds 200
 }catch{
  $bad++; $oj=''
  try{ Say ("ERR"+$T+$_.Exception.Message) }catch{ exit 3 }
  if($bad -ge 8){ exit 4 }
  $w=$null
  Start-Sleep -Milliseconds 2000
 }
}
`;
function shot({ dir, log, cfg, onMsg, ocr }) {   // v1.16: ocr = true sirf naya NT-PRINT (v1.39+) bhejta hai — purana NT-PRINT OCR ki line ko ghalti samajhta
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  const PS = path.join(dir, 'nt-posshot.ps1');
  let k = null, want = false, buf = '', fails = 0, timer = null;
  const emit = m => { try { onMsg && onMsg(m); } catch (e) { log('🖥 POS tasveer: ' + (e.message || e)); } };
  const line = l => {
    if (l.startsWith('IMG\t')) { const a = l.split('\t'); if (a.length >= 6 && a[5]) { fails = 0; emit({ k: 'img', mode: a[1], w: Number(a[2]) || 0, h: Number(a[3]) || 0, dg: a[4], b64: a[5] }); } }
    else if (l.startsWith('OCR\t')) { const a = l.split('\t'); if (ocr && a.length >= 5) emit({ k: 'ocr', w: Number(a[1]) || 0, h: Number(a[2]) || 0, ms: Number(a[3]) || 0, j: a[4], mode: a[5] || '' }); }
    else if (l.startsWith('OCRON\t')) { const a = l.split('\t'); if (ocr) emit({ k: 'ocron', lg: a[1] || '', mx: Number(a[2]) || 0 }); }
    else if (l.startsWith('OCRERR\t')) { if (ocr) emit({ k: 'ocrerr', why: l.slice(7).slice(0, 200) }); }
    else if (l.startsWith('OCRINFO\t')) log('🔤 POS OCR: ' + l.slice(8).slice(0, 200));
    else if (l.startsWith('OFF\t')) emit({ k: 'off', why: l.slice(4) });
    else if (l.startsWith('ERR\t')) { log('🖥 POS tasveer: ' + l.slice(4).slice(0, 200)); emit({ k: 'err', why: l.slice(4).slice(0, 200) }); }
  };
  const run = () => {
    timer = null;
    if (k || !want) return;
    if (process.platform !== 'win32' || C().posShot === false) { emit({ k: 'off', why: 'is PC par band (posShot)' }); return; }
    const TXT = '﻿' + SHOT_TXT.replace(/\r?\n/g, '\r\n');
    try { if (!fs.existsSync(PS) || fs.readFileSync(PS, 'utf8') !== TXT) fs.writeFileSync(PS, TXT); } catch (e) { log('🖥 POS tasveer: ' + e.message); emit({ k: 'err', why: e.message }); return; }
    let err = '';
    const w = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS, '-Title', String(C().posTitle || 'Retail Solution'), '-Pp', String(process.pid), '-Ocr', ocr && C().posOcr !== false ? '1' : '0'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    k = w; buf = '';
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); line(l); } if (buf.length > 4e6) buf = ''; });
    w.stderr.on('data', d => { err = (err + d).slice(-1500); });
    w.on('error', e => { log('🖥 POS tasveer shuru nahi hui: ' + e.message); });
    w.on('exit', code => { if (k === w) k = null; if (!want) return; fails++;
      const el = err.trim().split(/\r?\n/).filter(Boolean).slice(0, 2).join(' | ').slice(0, 200);
      log(`🖥 POS tasveer band (code ${code})${el ? ' — ' + el : ''}`); emit({ k: 'err', why: 'tasveer wala program band (code ' + code + ')' + (el ? ' — ' + el : '') });
      if (fails < 8 && !timer) timer = setTimeout(run, 6000); });
  };
  return { set(on) { on = !!on; if (on === want) return; want = on; if (on) { fails = 0; run(); } else { if (timer) { clearTimeout(timer); timer = null; } try { k && k.kill(); } catch {} } }, on: () => want, alive: () => !!k };
}
// v1.16: OCR ke lafz -> qataren. words [[x, y, w, h, 'lafz'], ...] (grid ke asal pixel) -> [[y, h, [[x, w, 'lafz'], ...]], ...]
//   upar se neeche, har qatar baayein se daayein. Qatar = lafz jin ka beech (cy) ek doosre se 0.6 x aam oonchai ke andar.
//   Kaun sa lafz kis khane ka (naam / tadad) — app header dekh kar khud tay karti hai (live.js ocParse) taake qaida app update se badle.
function ocrRows(words) {
  const W = (Array.isArray(words) ? words : []).filter(a => Array.isArray(a) && a.length >= 5 && String(a[4] == null ? '' : a[4]).trim())
    .slice(0, 800).map(a => ({ x: Number(a[0]) || 0, y: Number(a[1]) || 0, w: Math.max(1, Number(a[2]) || 0), h: Math.max(1, Number(a[3]) || 0), t: String(a[4]).trim().slice(0, 60) }));
  if (!W.length) return [];
  const hs = W.map(o => o.h).sort((a, b) => a - b), mh = hs[Math.floor(hs.length / 2)] || 10;
  W.forEach(o => { o.cy = o.y + o.h / 2; });
  W.sort((a, b) => a.cy - b.cy || a.x - b.x);
  const R = [];
  for (const o of W) {
    const r = R[R.length - 1];
    if (r && Math.abs(o.cy - r.cy) <= mh * 0.6) { r.ws.push(o); r.cy += (o.cy - r.cy) / r.ws.length; }
    else R.push({ cy: o.cy, ws: [o] });
  }
  return R.slice(0, 60).map(r => {
    r.ws.sort((a, b) => a.x - b.x);
    let y = Infinity, y2 = -Infinity; for (const o of r.ws) { y = Math.min(y, o.y); y2 = Math.max(y2, o.y + o.h); }
    return [Math.round(y), Math.round(y2 - y), r.ws.slice(0, 40).map(o => [Math.round(o.x), Math.round(o.w), o.t])];
  });
}
module.exports = { start, shot, ocrRows };
