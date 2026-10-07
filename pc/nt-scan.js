// ============================================================
//  nt-scan.js  v1.3.1 (2026-10-07: base (Firestore) na ho to bhi chale — awaz-only) · v1.3 (2026-10-07: ⚠️ 'tu-tu-tu' (WARN) awaz — scan POS ke bajaye kisi AUR window mein gaya (scanWhere) to tu-tu-tu, tik/bzzz nahi;
//                     onReady (PC on hote hi awazon ka test) · onScanOk/onScanBad ko code + window) · v1.2.1 (2026-10-06: onScanBad — ghalat scan ka waqt bahar batao, POS error box ki bzzz dohri na ho) · v1.2 (2026-10-06: ASLI awaz — WAV (SoundPlayer): sahi = chhoti oonchi tik, ghalat = 3 moti bzzz; Console.Beep Windows
//                     ki 'ding' ban jati thi aur dono ek jaisi) · v1.1 (2026-10-06: beep() bahar se — POS item-add) · v1.0 (2026-10-06) — 🔔 SCAN AWAZ (POS ya koi bhi software): har scan par "tik", GHALAT scan (item POS mein nahi /
//  band) par alag zor ki "bzzz bzzz bzzz" — larka screen dekhe baghair scan karta rahe.
//  NT-PRINT (nt-print.js) isay chalata hai (khud-update saath). POS ko haath NAHI lagata — sirf awaz.
//  Kaise: nt-scan.ps1 (C# NtScan3.dll) Windows ka keyboard hook — sirf SCANNER pakarta hai: 4+ harf bohat tez (< ~45 ms fasla)
//  aur aakhir mein Enter/Tab. Haath se type karna (dheema) nahi pakarta, kuch save/record NAHI karta. Code ko Firestore posStock
//  (POS items: code, barcode, sub-barcode — sirf chalu items) se milata hai.
//  local-config.json: "scanAwaz": false = band · "scanSkip": ["chrome","msedge"] (in programs mein app ki apni awaz hai)
//                     "scanGap": 45 (ms, scanner ki raftar) · "scanGood": false = sahi scan par khamoshi
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function start({ dir, base, log, cfg, onScanOk, onScanBad, onReady, onDown, scanWhere, onScanWrong }) {
  const C = () => { try { return cfg() || {}; } catch { return {}; } };
  if (process.platform !== 'win32' || C().scanAwaz === false) return null;
  const norm = s => String(s || '').trim().toUpperCase();
  let codes = new Set(), loaded = false;
  const chunks = new Map();
  const rebuild = () => { const s = new Set(); for (const items of chunks.values()) for (const it of items) {
      if (it.code) s.add(norm(it.code));
      for (const b of it.bc || []) s.add(norm(b));
      for (const x of it.bq || []) if (x && x.b) s.add(norm(x.b));
      for (const x of it.sb || []) if (x && x.b) s.add(norm(x.b));
      for (const b of it.bs || []) s.add(norm(typeof b === 'string' ? b : b && b.b));
    } s.delete(''); codes = s; loaded = s.size > 50; };
  if (base) base.collection('posStock').where('branch', '==', 1).onSnapshot(sn => {
    sn.docChanges().forEach(c => { if (c.type === 'removed') chunks.delete(c.doc.id); else chunks.set(c.doc.id, (c.doc.data() || {}).items || []); });
    rebuild();
  }, e => log('🔔 scan: items nahi mile — ' + e.message));
  else log('🔔 scan: barcode list nahi (awaz-only) — har scan par tik, ghalat item ki bzzz POS ke error box se');   // v1.3.1

  const PS = path.join(dir, 'nt-scan.ps1');
  const TXT = `$ErrorActionPreference='Stop'
$dll=Join-Path $PSScriptRoot 'NtScan3.dll'
if(!(Test-Path $dll)){ Add-Type -ReferencedAssemblies System.Windows.Forms -OutputAssembly $dll -TypeDefinition @"
using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Text;using System.Threading;using System.Windows.Forms;
public class NtScan3{
 delegate IntPtr LLProc(int n,IntPtr w,IntPtr l);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetWindowsHookEx(int id,LLProc fn,IntPtr mod,uint tid);
 [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h,int n,IntPtr w,IntPtr l);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 static LLProc proc=Hook; static IntPtr hh; static StringBuilder buf=new StringBuilder(); static int last=0; static int gap=45;
 static string Fg(){try{uint pid;GetWindowThreadProcessId(GetForegroundWindow(),out pid);return Process.GetProcessById((int)pid).ProcessName.ToLower();}catch{return "";}}
 static object lk=new object();
 static IntPtr Hook(int n,IntPtr w,IntPtr l){
  try{ if(n>=0&&(w==(IntPtr)0x100||w==(IntPtr)0x104)){ int vk=Marshal.ReadInt32(l); int now=Environment.TickCount; char c='\\0';
   if(vk>=0x30&&vk<=0x39)c=(char)vk; else if(vk>=0x41&&vk<=0x5A)c=(char)vk; else if(vk>=0x60&&vk<=0x69)c=(char)('0'+vk-0x60);
   else if(vk==0xBD||vk==0x6D)c='-'; else if(vk==0xBE||vk==0x6E)c='.'; else if(vk==0xBF||vk==0x6F)c='/';
   if(vk==0x0D||vk==0x09){ if(buf.Length>=4&&now-last<=gap*2){ string code=buf.ToString(); ThreadPool.QueueUserWorkItem(_=>{try{string fg=Fg();lock(lk){Console.Out.WriteLine("SCAN\\t"+code+"\\t"+fg);Console.Out.Flush();}}catch{}});} buf.Length=0; }
   else if(c!='\\0'){ if(buf.Length>0&&now-last>gap)buf.Length=0; buf.Append(c); last=now; }
   else if(vk!=0x10&&vk!=0xA0&&vk!=0xA1&&vk!=0x14){ buf.Length=0; } } }catch{}
  return CallNextHookEx(hh,n,w,l);}
 static byte[] Wav(int[] spec){ int sr=22050; var ms=new System.IO.MemoryStream(); var bw=new System.IO.BinaryWriter(ms); int n=0; for(int i=0;i<spec.Length;i+=3)n+=sr*(spec[i+1]+spec[i+2])/1000;
  bw.Write(0x46464952);bw.Write(36+n*2);bw.Write(0x45564157);bw.Write(0x20746D66);bw.Write(16);bw.Write((short)1);bw.Write((short)1);bw.Write(sr);bw.Write(sr*2);bw.Write((short)2);bw.Write((short)16);bw.Write(0x61746164);bw.Write(n*2);
  for(int i=0;i<spec.Length;i+=3){ int f=spec[i],on=sr*spec[i+1]/1000,off=sr*spec[i+2]/1000; for(int t=0;t<on;t++){ double ph=(double)t*f/sr; short v=(short)(((ph-Math.Floor(ph))<0.5?1:-1)*14000*Math.Min(1.0,Math.Min(t,on-t)/60.0)); bw.Write(v);} for(int t=0;t<off;t++)bw.Write((short)0);} bw.Flush(); return ms.ToArray(); }
 static System.Media.SoundPlayer okP=new System.Media.SoundPlayer(new System.IO.MemoryStream(Wav(new int[]{1900,70,0})));
 static System.Media.SoundPlayer warnP=new System.Media.SoundPlayer(new System.IO.MemoryStream(Wav(new int[]{700,110,70,700,110,70,700,110,0})));
 static System.Media.SoundPlayer badP=new System.Media.SoundPlayer(new System.IO.MemoryStream(Wav(new int[]{260,230,90,260,230,90,260,320,0})));
 static object pl=new object();
 static void Play(string k){ThreadPool.QueueUserWorkItem(_=>{try{ lock(pl){ if(k=="OK")okP.PlaySync(); else if(k=="BAD")badP.PlaySync(); else if(k=="WARN")warnP.PlaySync(); } }catch{}});}
 static void ReadIn(){try{string s;while((s=Console.In.ReadLine())!=null){Play(s.Trim());}}catch{} Application.Exit();}
 public static void Run(int g){ gap=g; var t=new Thread(ReadIn);t.IsBackground=true;t.Start();
  using(var p=Process.GetCurrentProcess())using(var m=p.MainModule){hh=SetWindowsHookEx(13,proc,GetModuleHandle(m.ModuleName),0);}
  if(hh==IntPtr.Zero){Console.Out.WriteLine("ERR hook nahi laga");Console.Out.Flush();return;}
  Console.Out.WriteLine("READY");Console.Out.Flush(); Application.Run(); }
}
"@ }
Add-Type -Path $dll
[NtScan3]::Run([int]$args[0])
`;
  let child = null, fails = 0, stopped = false;
  const skipList = () => { const s = C().scanSkip; return Array.isArray(s) ? s.map(x => String(x).toLowerCase()) : ['chrome', 'msedge', 'firefox']; };
  const run = () => {
    if (stopped || C().scanAwaz === false) return;
    try { if (!fs.existsSync(PS) || fs.readFileSync(PS, 'utf8') !== TXT) fs.writeFileSync(PS, TXT); } catch (e) { log('🔔 scan: ' + e.message); return; }
    const gap = Math.max(15, Math.min(150, Number(C().scanGap) || 45));
    const w = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS, String(gap)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child = w; let buf = '', err = '';
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); onLine(l, w); } });
    w.stderr.on('data', d => { err = (err + d).slice(-300); });
    w.stdin.on('error', () => {});
    w.on('exit', code => { if (child === w) child = null; if (stopped) return; fails++;
      log(`🔔 scan awaz band ho gayi (code ${code})${err ? ' — ' + err.trim().split(/\r?\n/).pop() : ''}` + (fails < 6 ? ' — 30 sec mein dobara' : ' — ab chhor diya (NT-PRINT restart par dobara)'));
      try { onDown && onDown(); } catch {}
      if (fails < 6) setTimeout(run, 30000); });
  };
  const onLine = (l, w) => {
    if (l === 'READY') { fails = 0; log(`🔔 Scan awaz chalu — ${codes.size} barcode yaad`); try { onReady && onReady(); } catch {} return; }
    if (l.startsWith('ERR ')) { log('🔔 scan: ' + l.slice(4)); return; }
    if (!l.startsWith('SCAN\t')) return;
    const [, code, fg] = l.split('\t');
    if (skipList().includes(String(fg || '').toLowerCase())) return;   // hamari app (Chrome) ki apni awaz hai
    // v1.3: scan POS mein nahi, kisi AUR window mein gaya (jaise chat / desktop) -> tu-tu-tu, item POS mein nahi jura
    let where = 'pos'; try { where = scanWhere ? scanWhere(fg) : 'pos'; } catch {}
    if (where === 'other') { try { w.stdin.write('WARN\n'); } catch {} log(`🔔 GHALAT JAGAH scan: "${code}" "${fg || '?'}" mein gaya — POS mein nahi`); try { onScanWrong && onScanWrong(code, fg); } catch {} return; }
    const ok = !loaded || codes.has(norm(code)) || codes.has(norm(code).replace(/^0+/, ''));
    if (ok) { try { onScanOk && onScanOk(code, fg); } catch {} if (C().scanGood !== false) try { w.stdin.write('OK\n'); } catch {} }
    else { try { onScanBad && onScanBad(code, fg); } catch {} try { w.stdin.write('BAD\n'); } catch {} log(`🔔 GHALAT scan: "${code}" (${fg || '?'}) — POS mein ye barcode nahi / item band`); }
  };
  setTimeout(run, 3000);
  // v1.1: bahar se awaz (POS beep) — worker chal raha ho to us se (foran), warna null
  const beep = kind => { if (!child) return false; try { child.stdin.write((kind || 'OK') + '\n'); return true; } catch { return false; } };
  return { stop() { stopped = true; try { child && child.kill(); } catch {} }, size: () => codes.size, beep, alive: () => !!child };
}
module.exports = { start };
