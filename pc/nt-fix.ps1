# nt-fix.ps1 (2026-10-08, v2 2026-11-18) - NT-PRINT THEEK + TAZA + JAANCH, kisi bhi counter PC par (ek command, AnyDesk PowerShell):
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/nt-fix.ps1 | iex
#   1) NT-PRINT laga hi na ho / Node na ho -> poora setup (nt-print-setup.ps1) - speaker jaanch (awaz-check: mute / volume / test awaz)
#   2) GitHub se taza files (sha256 manifest se milake - adhoori file nahi lagti)   3) Startup mein ho (isi folder ki bat)
#   4) NT-PRINT dobara chalu + version / AWAZ-ONLY / POS screen log   5) GHALAT barcode scan karwa kar Search / bzzz log
#   v2: jo PC pehle SERVER tha (C:\khata-sync mein server ke scripts) = seedha nt-print-setup (NT-PRINT C:\nt-print mein, purana folder band) ·
#       C:\nt-print ho to wahi folder · "Chal raha" sirf NAYI log line se (pehle purani line dekh kar jhoota 'chal raha' dikhta tha) ·
#       doosre folder ka NT-PRINT loop band
$ErrorActionPreference = 'Continue'
$OLD = 'C:\khata-sync'; $NEWD = 'C:\nt-print'; $SERVER = 'DESKTOP-Q1SLV77'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
function NewLog($lg, $from) {
  try {
    $fs = [IO.File]::Open($lg, 'Open', 'Read', 'ReadWrite')
    try { if ($from -gt $fs.Length) { $from = 0 }; [void]$fs.Seek($from, 'Begin'); $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8); $t = $sr.ReadToEnd() } finally { $fs.Close() }
    return @($t -split "`r?`n" | Where-Object { $_ })
  } catch { return @() }
}
Say ""; Say "===== NT-PRINT THEEK - $env:COMPUTERNAME =====" Cyan
Say "(Is window ke andar click na karein - click se Windows isay rok deta hai; ho jaye to Esc)" DarkGray
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
# purana server? (C:\khata-sync mein server ke scripts) -> setup: NT-PRINT alag C:\nt-print mein, purane folder mein kuch nahi
$srvF = @('doctor.js', 'sync.js', 'pos-khata-sync.js', 'transfer-sync.js', 'sale-post.js', 'KHATA-DOCTOR.bat') | Where-Object { Test-Path (Join-Path $OLD $_) }
$purana = [bool]$srvF -and (($env:COMPUTERNAME -ne $SERVER) -or -not (Test-Path (Join-Path $OLD 'firebase-key.json')))
$K = if (Test-Path (Join-Path $NEWD 'nt-print.js')) { $NEWD } else { $OLD }
if ($purana -or -not (Test-Path (Join-Path $K 'nt-print.js')) -or -not (Get-Command node -ErrorAction SilentlyContinue)) {
  if ($purana) { Say "Yeh PC pehle SERVER tha - NT-PRINT alag folder $NEWD mein (setup)..." Yellow } else { Say "NT-PRINT / Node is PC par poora nahi - setup chala raha hoon..." Yellow }
  Invoke-RestMethod ($RAW + 'nt-print-setup.ps1?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) | Invoke-Expression
  return
}
Say "Folder: $K"
# 1b) speaker / Windows awaz (mute hatao, volume, test awaz - awaz-check)
Say "--- Speaker jaanch ---" Cyan
# ALAG scope mein (& scriptblock) - awaz-check ka $k (chaabi lines) PowerShell mein $K hi hai (bara/chhota ek), pehle hamara $K bigad deta tha
try { $ac = Invoke-RestMethod ($RAW + 'awaz-check.ps1?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()); & ([scriptblock]::Create([string]$ac)) } catch { Say "awaz-check nahi chala: $($_.Exception.Message)" Red }
$K = if (Test-Path (Join-Path $NEWD 'nt-print.js')) { $NEWD } else { $OLD }
Say "--- NT-PRINT taza ---" Cyan
# 2) taza files (C:\nt-print ki bat apni hai - GitHub wali nahi)
$t = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$m = $null; try { $m = Invoke-RestMethod ($RAW + 'manifest.json?t=' + $t) } catch { Say "GitHub se manifest nahi aaya: $($_.Exception.Message)" Red }
if ($m) {
  Say "GitHub version: $($m.version)"
  $list = 'nt-print.js', 'nt-parchi.js', 'nt-scan.js', 'nt-posui.js', 'urdu-shape.js', 'urdu-names.js', 'zinda.js', 'sql-config.js', 'nt-print-auto.bat'
  if ($K -ne $OLD) { $list = $list | Where-Object { $_ -ne 'nt-print-auto.bat' } }
  foreach ($f in $list) {
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
# 3) Startup - NT-PRINT.vbs isi folder ki bat chalaye
$vbs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\NT-PRINT.vbs'
$vt = ''; if (Test-Path $vbs) { try { $vt = [IO.File]::ReadAllText($vbs) } catch {} }
if ($vt -notlike "*$K\nt-print-auto.bat*") {
  ("' NT-PRINT - PC on hote hi chupke se`r`nCreateObject(""WScript.Shell"").Run ""cmd /c """"$K\nt-print-auto.bat"""""", 0, False") | Set-Content -Path $vbs -Encoding ASCII
  Say "Startup mein laga diya (PC on hote hi khud chalega)" Green
}
# 4) dobara chalu - doosre folder ka loop band, phir NT-PRINT; faisla sirf NAYI log lines se
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like '*nt-print-auto*' -and $_.CommandLine -notlike "*$K*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$lg = Join-Path $K 'nt-print-log.txt'
$len0 = 0; if (Test-Path $lg) { $len0 = (Get-Item $lg).Length }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*nt-print.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$bat = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like "*$K\nt-print-auto*" }
if (-not $bat) { Start-Process wscript.exe "`"$vbs`""; Say "NT-PRINT chalu kiya" Green } else { Say "NT-PRINT dobara shuru ho raha hai" Green }
Say "Intezar (50 sec tak)..." Yellow
$new = @(); for ($i = 0; $i -lt 25; $i++) { Start-Sleep 2; $new = NewLog $lg $len0; if ($new | Select-String -Pattern 'NT-PRINT v[0-9.]+|pehle se chal raha') { Start-Sleep 4; $new = NewLog $lg $len0; break } }
$v = $new | Select-String -Pattern 'NT-PRINT v[0-9.]+' | Select-Object -Last 1
if ($v) { Say ("CHAL GAYA: " + $v.Matches[0].Value) Green }
elseif ($new | Select-String -Pattern 'pehle se chal raha') { Say "NAHI CHALA: doosra NT-PRINT pehle se chal raha hai - is screen ki photo bhej dein" Red }
else { Say "NAHI CHALA: 50 sec mein NT-PRINT ne log mein kuch nahi likha - is screen ki photo bhej dein" Red }
$new | Select-String -Pattern 'AWAZ-ONLY|Scan awaz chalu|POS screen|scan awaz band|CS[0-9]{4}|firebase-key' | Select-Object -Last 6 | ForEach-Object { Write-Host $_.Line }
# 5) test
Say ""; Say "AB: POS Sale screen par ek GHALAT barcode scan karein (Search khirki khule), phir is window par aa kar ENTER dabayein..." Yellow
$len1 = 0; if (Test-Path $lg) { $len1 = (Get-Item $lg).Length }
[void](Read-Host)
Start-Sleep 1
Say "--- scan ke baad ---" Cyan
$sc = NewLog $lg $len1 | Select-String -Pattern 'Search|bzzz|GHALAT|tik ki jagah'
if ($sc) { $sc | Select-Object -Last 6 | ForEach-Object { Write-Host $_.Line } } else { Say "Scan ke baad log mein kuch nahi aaya (NT-PRINT ko scan nazar nahi aaya)" Red }
Say ""; Say "Is screen ki photo bhej dein." Yellow
