// ============================================================
//  nt-posui.js  v1.4 (2026-10-06: POS ka ERROR/message box (OK/Yes/No wala chhota window) pakro -> bzzz; box band hote hi patti foran dobara dhoondo
//                   taake awaz na ruke · local-config "posErrBeep": false = error par bzzz band) · v1.3 (2026-10-06: har 3 sec patti dobara dhoondo — Sale screen dobara khulne par purani patti murda, awaz band ho jati thi) · v1.2 (2026-10-06: screen-ginti (0 aati thi) chhori; ab POS ki 'Retail: .. PEICES: ..' patti ka NAAM (UIA) har 150 ms —
//                   item judte hi us item ki tafseel se badalti hai -> ADD) · v1.1 (2026-10-06: list 'table' nahi (sab Pane) -> SCREEN se: No. column ki patti (58px) ka screenshot har 200ms, likhai ki
//                   bands = qataren (header -1); window naam mein [Sale]; pane >900 chaura, 250-650 uncha, sab se chhota) · v1.0.2 (2026-10-06: 'miss' variable hataya — Add-Type warning ko error ginta tha) · v1.0.1 (2026-10-06: UIA assemblies poore raste se — pehle compile nahi hota tha) · v1.0 (2026-10-06) — 🔔 POS SCREEN DEKHO: POS (Cognitive "Retail Solution") ki Sale screen ki item-list (grid) ki
//  qataron ki ginti har 0.25 sec (Windows UI Automation, sirf PARHNA). Ginti barhi = item JURA (scan ho ya code likh kar) -> onAdd().
//  POS SQL mein sirf SAVE par likhta hai (pos-live test), is liye screen dekhna hi raasta hai. POS ko haath nahi lagata.
//  local-config: "posUi": false = band · "posTitle": "Retail Solution" (POS window ke naam ka hissa)
//  Apna alag PowerShell + NtPosUi5.dll — fail ho to scan awaz (nt-scan) par asar nahi.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function start({ dir, log, cfg, onAdd, onErr }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().posUi === false) return { active: () => false };
  const PS = path.join(dir, 'nt-posui.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtPosUi5.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Threading;using System.Text;using System.Collections.Generic;using System.Windows.Automation;
public class NtPosUi5{
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
 // v1.4: POS ka ERROR / message box — POS hi ka chhota window jis mein OK / Yes / No button ho
 static bool IsMsg(AutomationElement d, out string txt){
  txt=""; bool btn=false; var sb=new StringBuilder();
  try{ var r=d.Current.BoundingRectangle; if(r.Width>900||r.Height>600)return false; }catch{ return false; }
  try{ foreach(AutomationElement c in d.FindAll(TreeScope.Descendants,Condition.TrueCondition)){
    try{ var ct=c.Current.ControlType; string n=(c.Current.Name??"").Trim();
     if(ct==ControlType.Button){ string b=n.Replace("&","").ToUpperInvariant(); if(b=="OK"||b=="YES"||b=="NO"||b=="CANCEL"||b=="RETRY")btn=true; }
     else if(ct==ControlType.Text&&n.Length>0&&sb.Length<200){ sb.Append(n).Append(' '); } }catch{} } }catch{}
  if(!btn)return false;
  string nm=""; try{ nm=d.Current.Name??""; }catch{}
  txt=(nm+": "+sb.ToString()).Replace((char)13,' ').Replace((char)10,' ').Trim(); return true; }
 static List<AutomationElement> Dialogs(AutomationElement w,int pid){
  var L=new List<AutomationElement>();
  try{ foreach(AutomationElement t in AutomationElement.RootElement.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ProcessIdProperty,pid))){ if(!Automation.Compare(t,w))L.Add(t); } }catch{}
  try{ foreach(AutomationElement c in w.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Window)))L.Add(c); }catch{}
  return L; }
 public static void Run(string title){
  Say("READY"); AutomationElement win=null,info=null; string last=null; int tick=0,pid=0; var seen=new HashSet<string>(); bool hadMsg=false;
  while(true){
   try{
    if(win!=null&&pid>0&&tick%2==0){
     // har ~0.3 sec: POS ka error/message box?  naya ho to ERR (bzzz)
     var now=new HashSet<string>();
     foreach(var d in Dialogs(win,pid)){ string k=Key(d); if(k.Length==0)continue; string tx; if(!IsMsg(d,out tx))continue; now.Add(k); if(!seen.Contains(k))Say("ERR "+tx); }
     if(hadMsg&&now.Count==0){ info=null; last=null; Say("BACK"); }   // error band hua -> patti foran dobara dhoondo
     hadMsg=now.Count>0; seen=now;
    }
    // har ~3 sec dobara pakka karo: POS ki Sale screen band/dobara khuli ho to purani patti 'murda' ho jati hai
    if(info!=null&&++tick>=20){ tick=0; var w0=FindWin(title); var i0=w0==null?null:FindInfo(w0); if(i0==null){ Say("LOST"); info=null; last=null; } else { win=w0; pid=w0.Current.ProcessId; if(!Automation.Compare(i0,info)){ info=i0; last=info.Current.Name; Say("GRID info (nayi) "+last); } } }
    if(info==null){ tick++; var w=FindWin(title); if(w!=null){ win=w; pid=w.Current.ProcessId; info=FindInfo(w); if(info!=null){ last=info.Current.Name; tick=0; Say("GRID info "+last); } } else { win=null; pid=0; } }
    else { string n=info.Current.Name??""; if(last!=null&&n!=last&&n.StartsWith("Retail:"))Say("ADD 1"); last=n; }
   }catch{ if(info!=null)Say("LOST"); info=null; last=null; }
   Thread.Sleep(info!=null?150:(hadMsg?300:(win==null?2000:1000)));
  }}
}
"@ }
Add-Type -Path $dll
[NtPosUi5]::Run([string]$args[0])
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
      else if (l.startsWith('GRID ')) { gridOn = true; log('🔔 POS item patti mil gayi: ' + l.slice(5)); }
      else if (l.startsWith('ROWS ')) { if (C().posUiLog) log('🔔 POS qataren: ' + l.slice(5)); }
      else if (l === 'LOST') { gridOn = false; if (C().posUiLog) log('🔔 POS patti gum — dobara dhoond raha'); }
      else if (l.startsWith('ERR ')) { log('🔔 POS ERROR box: ' + l.slice(4).slice(0, 160)); if (C().posErrBeep !== false) try { onErr && onErr(l.slice(4)); } catch {} }   // v1.4
      else if (l === 'BACK') { if (C().posUiLog) log('🔔 POS error band — patti dobara dhoond raha'); }
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
