// ============================================================
//  nt-posui.js  v1.0 (2026-10-06) — 🔔 POS SCREEN DEKHO: POS (Cognitive "Retail Solution") ki Sale screen ki item-list (grid) ki
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
$dll=Join-Path $PSScriptRoot 'NtPosUi1.dll'
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies UIAutomationClient,UIAutomationTypes,WindowsBase -OutputAssembly $dll -TypeDefinition @"
using System;using System.Threading;using System.Windows.Automation;
public class NtPosUi1{
 static void Say(string s){try{Console.Out.WriteLine(s);Console.Out.Flush();}catch{}}
 static AutomationElement FindWin(string t){
  foreach(AutomationElement w in AutomationElement.RootElement.FindAll(TreeScope.Children,Condition.TrueCondition)){
   string n="";try{n=w.Current.Name??"";}catch{} if(n.IndexOf(t,StringComparison.OrdinalIgnoreCase)>=0)return w;}
  return null;}
 static AutomationElement FindGrid(AutomationElement w){
  var c=new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Table),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.DataGrid));
  AutomationElement best=null;double area=0;
  foreach(AutomationElement g in w.FindAll(TreeScope.Descendants,c)){ try{ var r=g.Current.BoundingRectangle; double a=r.Width*r.Height; if(a>area){area=a;best=g;} }catch{} }
  return best;}
 static int Rows(AutomationElement g){
  object p; if(g.TryGetCurrentPattern(GridPattern.Pattern,out p)) return ((GridPattern)p).Current.RowCount;
  return g.FindAll(TreeScope.Children,Condition.TrueCondition).Count;}
 public static void Run(string title){
  Say("READY"); AutomationElement grid=null; int last=-1, miss=0;
  while(true){
   try{
    if(grid==null){ var w=FindWin(title); if(w!=null){ grid=FindGrid(w); if(grid!=null){ last=Rows(grid); string nm="";try{nm=grid.Current.AutomationId+"/"+grid.Current.Name;}catch{} Say("GRID "+nm+" "+last); } } }
    if(grid!=null){ int c=Rows(grid); if(last>=0&&c>last)Say("ADD "+(c-last)); last=c; miss=0; }
   }catch{ if(grid!=null){Say("LOST");} grid=null; last=-1; }
   Thread.Sleep(grid==null?3000:250);
  }}
}
"@ }
Add-Type -Path $dll
[NtPosUi1]::Run([string]$args[0])
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
      else if (l.startsWith('GRID ')) { gridOn = true; log('🔔 POS item-list mil gayi: ' + l.slice(5)); }
      else if (l === 'LOST') { gridOn = false; }
      else if (l.startsWith('ADD ')) { try { onAdd(Number(l.slice(4)) || 1); } catch {} } } });
    w.stderr.on('data', d => { err = (err + d).slice(-300); });
    w.on('exit', code => { if (child === w) child = null; gridOn = false; if (stopped) return; fails++;
      log(`🔔 POS screen dekhna band (code ${code})${err ? ' — ' + err.trim().split(/\r?\n/).pop() : ''}` + (fails < 6 ? ' — 30 sec mein dobara' : ' — chhor diya'));
      if (fails < 6) setTimeout(run, 30000); });
  };
  setTimeout(run, 5000);
  return { active: () => gridOn, stop() { stopped = true; try { child && child.kill(); } catch {} } };
}
module.exports = { start };
