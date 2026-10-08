# speaker-fix.ps1 (2026-10-08) - SPEAKER DHOONDO: PC ki awaz kis raaste (speaker / headphone / monitor HDMI) par ja rahi hai,
#   har chalu raaste par test awaz, jis par "h" kahen use DEFAULT (mute hata kar, volume 80%) - POS / NT-PRINT ki awaz wahin.
#   Chalana (AnyDesk, PowerShell): irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/speaker-fix.ps1 | iex
#   Kuch na chale to batata hai: taar nahi laga / raasta band (disabled) / driver nahi - aur Windows ki Sound window kholta hai.
$ErrorActionPreference = 'Continue'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
Say ""; Say "===== SPEAKER DHOONDO - $env:COMPUTERNAME =====" Cyan
Say "(Is window ke andar click na karein - click se Windows isay rok deta hai; ho jaye to Esc)" DarkGray
# 1) Windows ki awaz service
foreach ($sv in 'AudioEndpointBuilder', 'Audiosrv') {
  try { $s = Get-Service $sv -ErrorAction Stop
    if ($s.Status -ne 'Running') { try { Start-Service $sv -ErrorAction Stop; Say "$sv band thi - chalu kar di" Yellow } catch { Say "$sv band hai - chalane ke liye admin PowerShell chahiye" Red } }
  } catch {}
}
# 2) sound card / driver
$cards = @(Get-CimInstance Win32_SoundDevice -ErrorAction SilentlyContinue)
if (-not $cards.Count) { Say "Sound card / driver NAHI mila (Windows ko awaz ka hardware nazar nahi aa raha)" Red }
else { foreach ($c in $cards) { Say ("Sound card: " + $c.Name + "  [" + $c.Status + "]") } }
# 3) awaz ke raaste (Windows Core Audio) + default badalna (PolicyConfig)
if (-not ('NtSpk.Spk' -as [type])) {
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Collections.Generic;
namespace NtSpk {
 [StructLayout(LayoutKind.Sequential)] public struct PK { public Guid fmt; public int pid; }
 [StructLayout(LayoutKind.Explicit)] public struct PV { [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr p; [FieldOffset(16)] public IntPtr pad; }
 [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IPS { int GetCount(out int c); int GetAt(int i, out PK k); int GetValue(ref PK k, out PV v); }
 [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IDev { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); int OpenPropertyStore(int acc, out IPS ps); int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id); int GetState(out int st); }
 [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IColl { int GetCount(out int c); int Item(int i, out IDev d); }
 [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IEnumr { int EnumAudioEndpoints(int flow, int mask, out IColl c); int GetDefaultAudioEndpoint(int flow, int role, out IDev d); }
 [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class EnumCo { }
 [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IVol { int f1(); int f2(); int f3(); int f4(); int SetMasterVolumeLevelScalar(float l, ref Guid c); int f5(); int GetMasterVolumeLevelScalar(out float l); int f6(); int f7(); int f8(); int f9(); int SetMute([MarshalAs(UnmanagedType.Bool)] bool b, ref Guid c); int GetMute([MarshalAs(UnmanagedType.Bool)] out bool b); }
 [ComImport, Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 interface IPolicy { int p1(); int p2(); int p3(); int p4(); int p5(); int p6(); int p7(); int p8(); int p9(); int p10(); int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role); int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string id, int vis); }
 [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyCo { }
 public class Dev { public string Id = ""; public string Name = "?"; public int State; public bool IsDefault; }
 public static class Spk {
  static IEnumr E() { return (IEnumr)(new EnumCo()); }
  public static string DefId() { try { IDev d; if (E().GetDefaultAudioEndpoint(0, 1, out d) != 0 || d == null) return ""; string id; d.GetId(out id); return id ?? ""; } catch { return ""; } }
  static string Name(IDev d) { try { IPS ps; d.OpenPropertyStore(0, out ps); var k = new PK(); k.fmt = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); k.pid = 14; PV v; ps.GetValue(ref k, out v); if (v.vt == 31 && v.p != IntPtr.Zero) return Marshal.PtrToStringUni(v.p); } catch { } return "?"; }
  public static List<Dev> All() {
   var L = new List<Dev>(); IColl c; Marshal.ThrowExceptionForHR(E().EnumAudioEndpoints(0, 0xF, out c)); int n; c.GetCount(out n); string def = DefId();
   for (int i = 0; i < n; i++) { IDev d; if (c.Item(i, out d) != 0 || d == null) continue; var x = new Dev(); string id; d.GetId(out id); x.Id = id ?? ""; int st; d.GetState(out st); x.State = st; x.Name = Name(d); x.IsDefault = x.Id == def; L.Add(x); }
   return L; }
  public static void SetDefault(string id) { var p = (IPolicy)(new PolicyCo()); for (int r = 0; r < 3; r++) Marshal.ThrowExceptionForHR(p.SetDefaultEndpoint(id, r)); }
  public static string Loud(string id) {
   IColl c; E().EnumAudioEndpoints(0, 1, out c); int n; c.GetCount(out n);
   for (int i = 0; i < n; i++) { IDev d; c.Item(i, out d); string x; d.GetId(out x); if (x != id) continue;
    var g = typeof(IVol).GUID; object o; Marshal.ThrowExceptionForHR(d.Activate(ref g, 23, IntPtr.Zero, out o)); var v = (IVol)o; var e = Guid.Empty;
    bool m; v.GetMute(out m); float l; v.GetMasterVolumeLevelScalar(out l); string s = "volume " + Math.Round(l * 100) + "%" + (m ? ", MUTE tha" : "");
    if (m) v.SetMute(false, ref e); if (l < 0.6f) { v.SetMasterVolumeLevelScalar(0.8f, ref e); s += " -> 80%"; } return s; }
   return ""; }
  public static byte[] Wav() { int sr = 22050; int[] sp = { 880, 260, 90, 1320, 260, 90, 880, 260, 0 }; var ms = new System.IO.MemoryStream(); var bw = new System.IO.BinaryWriter(ms); int n = 0; for (int i = 0; i < sp.Length; i += 3) n += sr * (sp[i + 1] + sp[i + 2]) / 1000;
   bw.Write(0x46464952); bw.Write(36 + n * 2); bw.Write(0x45564157); bw.Write(0x20746D66); bw.Write(16); bw.Write((short)1); bw.Write((short)1); bw.Write(sr); bw.Write(sr * 2); bw.Write((short)2); bw.Write((short)16); bw.Write(0x61746164); bw.Write(n * 2);
   for (int i = 0; i < sp.Length; i += 3) { int f = sp[i], on = sr * sp[i + 1] / 1000, off = sr * sp[i + 2] / 1000; for (int t = 0; t < on; t++) { double ph = (double)t * f / sr; bw.Write((short)(((ph - Math.Floor(ph)) < 0.5 ? 1 : -1) * 16000 * Math.Min(1.0, Math.Min(t, on - t) / 60.0))); } for (int t = 0; t < off; t++) bw.Write((short)0); }
   bw.Flush(); return ms.ToArray(); }
 }
}
'@
}
$all = @(); try { $all = @([NtSpk.Spk]::All()) } catch { Say "Awaz ke raaste parh nahi saka: $($_.Exception.Message)" Red }
$stName = @{ 1 = 'CHALU'; 2 = 'BAND kiya hua (disabled)'; 4 = 'maujood nahi'; 8 = 'TAAR NAHI LAGA (unplugged)' }
Say "--- Awaz ke raaste ---" Cyan
$i = 0
foreach ($d in $all) { $i++; $tag = if ($d.IsDefault) { '   <= abhi DEFAULT' } else { '' }; $col = if ($d.State -eq 1) { 'Green' } else { 'DarkGray' }; Say ("{0}. {1}  - {2}{3}" -f $i, $d.Name, $stName[[int]$d.State], $tag) $col }
if (-not $all.Count) { Say "(koi raasta nahi mila)" Red }
$act = @($all | Where-Object { $_.State -eq 1 } | Sort-Object { if ($_.IsDefault) { 0 } else { 1 } })
$wav = $null; try { $wav = [NtSpk.Spk]::Wav() } catch {}
$ok = $null
foreach ($d in $act) {
  Say ""; Say ("TEST: " + $d.Name + " - awaz baj rahi hai...") Yellow
  try { [NtSpk.Spk]::SetDefault($d.Id) } catch { Say "  default nahi bana: $($_.Exception.Message)" Red }
  try { $lv = [NtSpk.Spk]::Loud($d.Id); if ($lv) { Say "  $lv" } } catch {}
  Start-Sleep -Milliseconds 500
  for ($r = 0; $r -lt 2; $r++) {
    try { if ($wav) { (New-Object System.Media.SoundPlayer (New-Object System.IO.MemoryStream (, $wav))).PlaySync() } } catch {}
    try { [console]::Beep(1000, 300) } catch {}
    Start-Sleep -Milliseconds 300
  }
  $a = Read-Host "Awaz aayi? (h = haan / n = nahi)"
  if ($a -match '^h') { $ok = $d; break }
}
Say ""
if ($ok) {
  Say ("THEEK! Ab PC ki saari awaz yahan: " + $ok.Name + "  (default, mute nahi, volume theek)") Green
  Say "NT-PRINT ki tik / bzzz bhi ab isi par aayegi - POS mein ek ghalat barcode scan kar ke dekhein." Green
} else {
  Say "Kisi raaste par awaz nahi aayi. Wajah:" Red
  $un = @($all | Where-Object { $_.State -eq 8 }); $dis = @($all | Where-Object { $_.State -eq 2 })
  if ($un.Count) { Say ("- Windows ko TAAR NAHI LAGA dikh raha: " + (($un | ForEach-Object { $_.Name }) -join ', ') + "  -> speaker ka taar PC ke peeche HARE (green) socket mein poora andar lagayein, phir yehi command dobara") Yellow }
  if ($dis.Count) { Say ("- BAND kiya hua raasta: " + (($dis | ForEach-Object { $_.Name }) -join ', ') + "  -> Sound window mein khaali jagah right-click -> 'Show Disabled Devices' -> us par right-click -> Enable, phir yehi command dobara") Yellow }
  if ($act.Count -and -not $un.Count -and -not $dis.Count) { Say "- Windows awaz bhej raha hai magar speaker se nahi nikal rahi -> speaker ki BATTI / bijli (USB) ka taar / volume KNOB / sahi socket (hara) dekhein" Yellow }
  if (-not $all.Count -or (-not $act.Count -and -not $un.Count -and -not $dis.Count)) { Say "- Windows ko koi speaker hi nahi mila -> sound DRIVER ka masla (ya sound card band). Photo bhej dein." Yellow }
  Say "Windows ki Sound window khul rahi hai..." Yellow
  Start-Process control.exe 'mmsys.cpl'
}
Say ""; Say "Is screen ki photo bhej dein." Yellow
