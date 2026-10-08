// ============================================================
//  nt-posui.js  v1.7 (2026-10-08: 🔎 SEARCH KHIRKI — scan ke foran baad POS ki "Search Items" khule = barcode POS mein nahi -> 'SRCH MISS'
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

function start({ dir, log, cfg, onAdd, onErr, onProc, onDown, onSrch }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().posUi === false) return { active: () => false };
  const PS = path.join(dir, 'nt-posui.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPosUi8.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Diagnostics;using System.Threading;using System.Text;using System.Collections.Generic;using System.Windows.Automation;
public class NtPosUi8{
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
  Say("READY"); AutomationElement win=null,info=null; string last=null; int tick=0,pid=0,lastPid=-1; var seen=new Dictionary<string,bool>(); bool hadMsg=false,winOn=false; string srchKey=""; int srchSeenAt=0,repAt=-1,srchTry=0;
  while(true){
   try{
    if((win!=null)!=winOn){ winOn=win!=null; Say(winOn?"WIN 1":"WIN 0"); }
    if(pid>0&&pid!=lastPid){ lastPid=pid; try{ Say("PROC "+Process.GetProcessById(pid).ProcessName); }catch{} }
    bool chk=Environment.TickCount-chkUntil<0;
    if(win!=null&&pid>0&&(tick%2==0||chk)){
     // har ~0.3 sec (scan ke baad har 0.15 sec): POS ka error/message box?  naya ho to ERR (bzzz) · v1.7: Search Items khirki?
     var now=new Dictionary<string,bool>();   // HashSet System.Core mein — PowerShell Add-Type ke default mein pakka nahi
     AutomationElement sd=null; string sk="";
     foreach(var d in Dialogs(win,pid)){ string k=Key(d); if(k.Length==0)continue; string dn=""; try{ dn=d.Current.Name??""; }catch{}
      if(dn.IndexOf(stitle,StringComparison.OrdinalIgnoreCase)>=0){ sd=d; sk=k; continue; }
      string tx; if(!IsMsg(d,out tx))continue; now[k]=true; if(!seen.ContainsKey(k))Say("ERR "+tx); }
     if(sd==null){ srchKey=""; }
     else { if(sk!=srchKey){ srchKey=sk; srchSeenAt=Environment.TickCount; srchTry=0; }
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
[NtPosUi8]::Run([string]$args[0],[string]$args[1])
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
