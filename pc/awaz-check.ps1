# awaz-check.ps1 (2026-10-07) - NT AWAZ CHECK: is PC ka speaker / Windows awaz jaancho aur theek karo
#   Chalana (AnyDesk, PowerShell): irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/awaz-check.ps1 | iex
#   1) sound card + haal  2) volume / mute (mute ho to hatao, 40% se kam ho to 80%)  3) test awaz  4) scan-awaz program chalu?
#   5) log ki aakhri awaz wali lines  6) awaz na aaye to Windows "Sound" window khol do (sahi speaker = Set Default)
$ErrorActionPreference = 'Continue'
Write-Host ""
Write-Host "===== NT AWAZ CHECK - $env:COMPUTERNAME =====" -ForegroundColor Cyan
try { Get-CimInstance Win32_SoundDevice | ForEach-Object { Write-Host ("Sound card: " + $_.Name + "   [" + $_.Status + "]") } } catch { Write-Host "Sound card list nahi mili" -ForegroundColor Red }
if (-not ('NtVol' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface INtAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface INtMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out INtAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface INtMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out INtMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class NtMMDeviceEnumeratorCom { }
public class NtVol {
  static INtAudioEndpointVolume V() {
    var en = new NtMMDeviceEnumeratorCom() as INtMMDeviceEnumerator; INtMMDevice dev = null;
    Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));
    INtAudioEndpointVolume epv = null; var id = typeof(INtAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref id, 23, 0, out epv)); return epv; }
  public static float Volume { get { float v = -1; Marshal.ThrowExceptionForHR(V().GetMasterVolumeLevelScalar(out v)); return v; } set { Marshal.ThrowExceptionForHR(V().SetMasterVolumeLevelScalar(value, Guid.Empty)); } }
  public static bool Mute { get { bool m; Marshal.ThrowExceptionForHR(V().GetMute(out m)); return m; } set { Marshal.ThrowExceptionForHR(V().SetMute(value, Guid.Empty)); } }
}
'@ -ErrorAction SilentlyContinue
}
try {
  $mu = [NtVol]::Mute; $vo = [math]::Round([NtVol]::Volume * 100)
  Write-Host "Volume: $vo%    Mute: $mu"
  if ($mu) { [NtVol]::Mute = $false; Write-Host "  -> MUTE hata diya" -ForegroundColor Yellow }
  if ($vo -lt 40) { [NtVol]::Volume = 0.8; Write-Host "  -> Volume 80% kar diya" -ForegroundColor Yellow }
} catch { Write-Host "Volume parh nahi saka - Windows mein koi speaker (default device) nahi mila: $($_.Exception.Message)" -ForegroundColor Red }
try { $as = Get-Service Audiosrv; Write-Host ("Windows Audio service: " + $as.Status); if ($as.Status -ne 'Running') { try { Start-Service Audiosrv; Write-Host "  -> Audio service chalu kar di" -ForegroundColor Yellow } catch { Write-Host "  -> Audio service band hai (chalane ke liye admin chahiye)" -ForegroundColor Red } } } catch {}
$sc = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*nt-scan.ps1*' })
if ($sc.Count) { Write-Host "Scan awaz program (nt-scan): CHALU ($($sc.Count))" -ForegroundColor Green } else { Write-Host "Scan awaz program (nt-scan): BAND - NT-PRINT chal raha hai?" -ForegroundColor Red }
$lg = 'C:\khata-sync\nt-print-log.txt'
if (Test-Path $lg) { Write-Host "--- log (awaz) ---"; Get-Content $lg -Tail 600 -Encoding UTF8 | Select-String -Pattern 'scan|POS|awaz|tu-tu|NT-PRINT v' | Select-Object -Last 10 | ForEach-Object { Write-Host $_.Line } }
Write-Host ""
Write-Host "TEST AWAZ baj rahi hai (3 dafa)..." -ForegroundColor Cyan
for ($i = 0; $i -lt 3; $i++) { try { [System.Media.SystemSounds]::Exclamation.Play() } catch {}; Start-Sleep -Milliseconds 700; try { [console]::beep(1200, 250) } catch {}; Start-Sleep -Milliseconds 500 }
$a = Read-Host "Awaz aayi? (h = haan / n = nahi)"
if ($a -match '^n') {
  Write-Host "Speaker ka button / volume knob / taar (peeche hara socket) check karein. Ab 'Sound' window khul rahi hai:" -ForegroundColor Yellow
  Write-Host "  Playback mein jo speaker laga hai us par right-click -> 'Set as Default Device' -> OK. Phir yehi command dobara chalayein." -ForegroundColor Yellow
  Start-Process control.exe 'mmsys.cpl'
} else { Write-Host "Theek! Ab scan kar ke dekhein - tik / bzzz / tu-tu-tu aani chahiye." -ForegroundColor Green }
