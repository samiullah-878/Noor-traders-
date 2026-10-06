// ============================================================
//  nt-posui.js  v1.2 (2026-10-06: screen-ginti (0 aati thi) chhori; ab POS ki 'Retail: .. PEICES: ..' patti ka NAAM (UIA) har 150 ms —
//                   item judte hi us item ki tafseel se badalti hai -> ADD) · v1.1 (2026-10-06: list 'table' nahi (sab Pane) -> SCREEN se: No. column ki patti (58px) ka screenshot har 200ms, likhai ki
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
$dll=Join-Path $PSScriptRoot 'NtPosUi3.dll'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$refs=@([System.Windows.Automation.AutomationElement].Assembly.Location,[System.Windows.Automation.ControlType].Assembly.Location,[System.Windows.Rect].Assembly.Location)
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies $refs -OutputAssembly $dll -TypeDefinition @"
using System;using System.Threading;using System.Windows.Automation;
public class NtPosUi3{
 static void Say(string s){try{Console.Out.WriteLine(s);Console.Out.Flush();}catch{}}
 static AutomationElement FindWin(string t){
  foreach(AutomationElement w in AutomationElement.RootElement.FindAll(TreeScope.Children,Condition.TrueCondition)){
   string n="";try{n=w.Current.Name??"";}catch{} if(n.IndexOf(t,StringComparison.OrdinalIgnoreCase)>=0&&n.IndexOf("[Sale]",StringComparison.OrdinalIgnoreCase)>=0)return w;}
  return null;}
 // POS ki "Retail: .. CTN: .. PEICES: .. Pack Qty: .. -rate" wali patti — har item judne par us item ki tafseel se badalti hai
 static AutomationElement FindInfo(AutomationElement w){
  foreach(AutomationElement e in w.FindAll(TreeScope.Descendants,Condition.TrueCondition)){ try{ string n=e.Current.Name??""; if(n.StartsWith("Retail:")&&n.IndexOf("PEICES",StringComparison.OrdinalIgnoreCase)>=0)return e; }catch{} }
  return null;}
 public static void Run(string title){
  Say("READY"); AutomationElement info=null; string last=null;
  while(true){
   try{
    if(info==null){ var w=FindWin(title); if(w!=null){ info=FindInfo(w); if(info!=null){ last=info.Current.Name; Say("GRID info "+last); } } }
    else { string n=info.Current.Name??""; if(last!=null&&n!=last&&n.StartsWith("Retail:"))Say("ADD 1"); last=n; }
   }catch{ if(info!=null)Say("LOST"); info=null; last=null; }
   Thread.Sleep(info==null?3000:150);
  }}
}
"@ }
Add-Type -Path $dll
[NtPosUi3]::Run([string]$args[0])
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
