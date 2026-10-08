# search-check.ps1 (2026-10-08) - POS ki "Search Items" khirki NT-PRINT ko DIKHTI hai ya nahi. Sirf PARHTA hai, kuch nahi badalta.
#   Pehle POS mein koi GHALAT barcode scan karein (Search khirki khuli rahe), phir AnyDesk PowerShell mein:
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/search-check.ps1 | iex
$ErrorActionPreference = 'Continue'
Write-Host ""
Write-Host "===== SEARCH CHECK - $env:COMPUTERNAME =====" -ForegroundColor Cyan
$K = 'C:\khata-sync'
try {
  $c = Get-Content (Join-Path $K 'local-config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $s = @(); foreach ($n in 'posBeep', 'scanGood', 'posUi', 'posSearchBeep', 'scanHold', 'scanAwaz') { if ($null -ne $c.$n) { $s += "$n=$($c.$n)" } }
  Write-Host ("Setting: " + ($(if ($s.Count) { $s -join '  ' } else { '(default)' })))
} catch { Write-Host "Setting: (local-config nahi parhi)" }
$lg = Join-Path $K 'nt-print-log.txt'
if (Test-Path $lg) {
  $all = Get-Content $lg -Tail 3000 -Encoding UTF8
  $v = $all | Select-String -Pattern 'NT-PRINT v[0-9.]+' | Select-Object -Last 1; if ($v) { Write-Host ("Version: " + $v.Matches[0].Value) -ForegroundColor Cyan }
  Write-Host "--- log (POS screen / Search / bzzz / scan) ---"
  $all | Select-String -Pattern 'POS screen|Search|bzzz|GHALAT|Scan awaz chalu|CS[0-9]{4}|tik ki jagah' | Select-Object -Last 15 | ForEach-Object { Write-Host $_.Line }
}
if (-not ('NtWinChk' -as [type])) {
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class NtWinChk {
  public delegate bool EP(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EP f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EP f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, StringBuilder l, uint f, uint t, out IntPtr r);
  public static string Txt(IntPtr h) { var sb = new StringBuilder(260); IntPtr r; SendMessageTimeout(h, 0x000D, (IntPtr)260, sb, 2, 200, out r); return sb.ToString(); }
  public static string Cls(IntPtr h) { var sb = new StringBuilder(200); GetClassName(h, sb, 200); return sb.ToString(); }
  public static List<string> Scan(uint pid, string want) {
    var o = new List<string>(); var tops = new List<IntPtr>(); int n = 0, hits = 0;
    EP ft = (h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) tops.Add(h); return true; };
    EnumWindows(ft, IntPtr.Zero);
    foreach (var t in tops) {
      string tt = Txt(t); o.Add("KHIRKI: '" + tt + "'  [" + Cls(t) + "]"); if (tt.IndexOf(want, StringComparison.OrdinalIgnoreCase) >= 0) hits++;
      EP fc = (h, l) => { n++; if (IsWindowVisible(h)) { string x = Txt(h); if (x.IndexOf(want, StringComparison.OrdinalIgnoreCase) >= 0) { hits++; o.Add("   ANDAR: '" + x + "'  [" + Cls(h) + "]"); } } return true; };
      EnumChildWindows(t, fc, IntPtr.Zero); GC.KeepAlive(fc);
    }
    GC.KeepAlive(ft);
    o.Add("Kul khirkiyan " + tops.Count + " · andar ke dabbe " + n + " · '" + want + "' mila: " + hits);
    return o;
  }
}
'@
}
$pos = Get-Process | Where-Object { $_.MainWindowTitle -like '*Retail Solution*' } | Select-Object -First 1
if (-not $pos) { Write-Host "POS (Retail Solution) khula nahi mila" -ForegroundColor Red }
else {
  Write-Host ("POS: " + $pos.ProcessName + " (pid " + $pos.Id + ")")
  [NtWinChk]::Scan([uint32]$pos.Id, 'Search') | ForEach-Object { Write-Host $_ }
}
Write-Host ""
Write-Host "Is screen ki photo bhej dein." -ForegroundColor Yellow
