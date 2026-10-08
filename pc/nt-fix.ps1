# nt-fix.ps1 (2026-10-08) - NT-PRINT THEEK + TAZA + JAANCH, kisi bhi counter PC par (ek command, AnyDesk PowerShell):
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/nt-fix.ps1 | iex
#   1) NT-PRINT laga hi na ho / Node na ho -> poora setup (nt-print-setup.ps1) - speaker jaanch (awaz-check: mute / volume / test awaz)
#   2) GitHub se taza files (sha256 manifest se milake - adhoori file nahi lagti)   3) Startup mein ho
#   4) NT-PRINT dobara chalu + version / AWAZ-ONLY / POS screen log   5) GHALAT barcode scan karwa kar Search / bzzz log
$ErrorActionPreference = 'Continue'
$K = 'C:\khata-sync'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
Say ""; Say "===== NT-PRINT THEEK - $env:COMPUTERNAME =====" Cyan
Say "(Is window ke andar click na karein - click se Windows isay rok deta hai; ho jaye to Esc)" DarkGray
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
if (-not (Test-Path (Join-Path $K 'nt-print.js')) -or -not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say "NT-PRINT / Node is PC par poora nahi - setup chala raha hoon..." Yellow
  Invoke-RestMethod ($RAW + 'nt-print-setup.ps1?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) | Invoke-Expression
  return
}
# 1b) speaker / Windows awaz (mute hatao, volume, test awaz - awaz-check)
Say "--- Speaker jaanch ---" Cyan
try { Invoke-RestMethod ($RAW + 'awaz-check.ps1?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) | Invoke-Expression } catch { Say "awaz-check nahi chala: $($_.Exception.Message)" Red }
Say "--- NT-PRINT taza ---" Cyan
# 2) taza files
$t = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$m = $null; try { $m = Invoke-RestMethod ($RAW + 'manifest.json?t=' + $t) } catch { Say "GitHub se manifest nahi aaya: $($_.Exception.Message)" Red }
if ($m) {
  Say "GitHub version: $($m.version)"
  foreach ($f in 'nt-print.js', 'nt-parchi.js', 'nt-scan.js', 'nt-posui.js', 'urdu-shape.js', 'nt-print-auto.bat') {
    $want = [string]$m.files.$f; $p = Join-Path $K $f
    $have = if (Test-Path $p) { (Get-FileHash $p -Algorithm SHA256).Hash.ToLower() } else { '' }
    if (-not $want -or $have -eq $want) { continue }
    try {
      Invoke-WebRequest ($RAW + $f + '?t=' + $t) -OutFile ($p + '.new') -UseBasicParsing
      if ((Get-FileHash ($p + '.new') -Algorithm SHA256).Hash.ToLower() -eq $want) { Move-Item ($p + '.new') $p -Force; Say "  + naya: $f" Green }
      else { Remove-Item ($p + '.new') -ErrorAction SilentlyContinue; Say "  ! $f adhoora aaya - purana rakha (2 min baad dobara chalayein)" Red }
    } catch { Say "  ! ${f}: $($_.Exception.Message)" Red }
  }
  try { Invoke-WebRequest ($RAW + 'manifest.json?t=' + $t) -OutFile (Join-Path $K 'manifest.json') -UseBasicParsing } catch {}
}
# 3) Startup
$vbs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\NT-PRINT.vbs'
if (-not (Test-Path $vbs)) {
  ("' NT-PRINT - PC on hote hi chupke se`r`nCreateObject(""WScript.Shell"").Run ""cmd /c """"$K\nt-print-auto.bat"""""", 0, False") | Set-Content -Path $vbs -Encoding ASCII
  Say "Startup mein laga diya (PC on hote hi khud chalega)" Green
}
# 4) dobara chalu
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*nt-print.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$bat = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like '*nt-print-auto*' }
if (-not $bat) { Start-Process wscript.exe "`"$vbs`""; Say "NT-PRINT chalu kiya" Green } else { Say "NT-PRINT dobara shuru ho raha hai" Green }
Say "35 sec intezar..." Yellow; Start-Sleep 35
$lg = Join-Path $K 'nt-print-log.txt'
if (Test-Path $lg) {
  $all = Get-Content $lg -Tail 400 -Encoding UTF8
  $v = $all | Select-String -Pattern 'NT-PRINT v[0-9.]+' | Select-Object -Last 1; if ($v) { Say ("Chal raha: " + $v.Matches[0].Value) Cyan }
  $all | Select-String -Pattern 'AWAZ-ONLY|Scan awaz chalu|POS screen|scan awaz band|CS[0-9]{4}|firebase-key' | Select-Object -Last 6 | ForEach-Object { Write-Host $_.Line }
} else { Say "Log nahi bana - NT-PRINT chala hi nahi (photo bhej dein)" Red }
# 5) test
Say ""; Say "AB: POS Sale screen par ek GHALAT barcode scan karein (Search khirki khule), phir is window par aa kar ENTER dabayein..." Yellow
[void](Read-Host)
Start-Sleep 1
if (Test-Path $lg) { Say "--- scan ke baad ---" Cyan; Get-Content $lg -Tail 80 -Encoding UTF8 | Select-String -Pattern 'Search|bzzz|GHALAT|tik ki jagah' | Select-Object -Last 6 | ForEach-Object { Write-Host $_.Line } }
Say ""; Say "Is screen ki photo bhej dein." Yellow
