# khata-fix.ps1 (2026-10-22) - KHATA-DOCTOR THEEK + TAZA, SERVER PC par (ek command, AnyDesk PowerShell):
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/khata-fix.ps1 | iex
#   1) atka hua doctor (port 47830 wala) + atke WMIC band - sirf wahi process (poora tree NAHI)
#   2) GitHub se taza doctor.js + KHATA-DOCTOR.bat (sha256 manifest se milake - adhoori file nahi lagti)
#   3) KHATA-DOCTOR chupke chalao - woh khud baqi sab nayi files laga kar band scripts (stock waghera) chala deta hai
#   4) 2-3 min dekho aur haal batao (doctor-log / stock-log ki nayi lines)
#   Kuch nahi chhoota: local-config.json (SQL), firebase-key.json. Koi password screen par nahi aata.
$ErrorActionPreference = 'Continue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$K = 'C:\khata-sync'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
# file ka naya hissa (pehle $from bytes chhor kar) - bari log file bhi foran
function NewLines($path, $from) {
  try {
    $fs = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try {
      if ($fs.Length -le $from) { return @() }
      [void]$fs.Seek($from, 'Begin')
      $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8)
      return @($sr.ReadToEnd() -split "`r?`n" | Where-Object { $_.Trim() })
    } finally { $fs.Dispose() }
  } catch { return @() }
}
function SizeOf($path) { if (Test-Path $path) { return (Get-Item $path).Length } else { return 0 } }

Say ""; Say "===== KHATA-DOCTOR THEEK - $env:COMPUTERNAME =====" Cyan
Say "(Is window ke andar click na karein - click se Windows isay rok deta hai; ho jaye to Esc)" DarkGray
if (-not (Test-Path (Join-Path $K 'doctor.js'))) { Say "C:\khata-sync\doctor.js nahi mila - ye command SERVER PC (jahan KHATA-DOCTOR laga hai) par chalayein." Red; return }
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say "Node.js nahi mila - pehle https://nodejs.org se LTS install karein." Red; return }

# 1) atka doctor + atke WMIC band (sirf wahi PID)
Say "--- 1) Purana / atka doctor ---" Cyan
$pids = @()
try {
  $pids = @(netstat -ano -p TCP | Where-Object { $_ -match 'LISTENING' -and $_ -match '[:.]47830\s' } | ForEach-Object { [int](($_.Trim() -split '\s+')[-1]) } | Where-Object { $_ -gt 4 -and $_ -ne $PID } | Select-Object -Unique)
} catch { Say "  netstat nahi chala: $($_.Exception.Message)" Red }
if ($pids.Count -gt 0) {
  foreach ($p in $pids) { try { Stop-Process -Id $p -Force -ErrorAction Stop; Say "  band kiya: purana doctor (PID $p)" Yellow } catch { Say "  PID $p band nahi hua: $($_.Exception.Message)" Red } }
} else { Say "  doctor chal hi nahi raha tha (port 47830 khaali)" DarkGray }
$old = @(Get-Process -Name wmic -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -and ((Get-Date) - $_.StartTime).TotalMinutes -gt 2 })
foreach ($w in $old) { try { Stop-Process -Id $w.Id -Force -ErrorAction Stop; Say "  band kiya: atka WMIC (PID $($w.Id))" Yellow } catch {} }

# 2) taza doctor.js + KHATA-DOCTOR.bat
Say "--- 2) GitHub se taza doctor ---" Cyan
$t = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$m = $null
try { $m = Invoke-RestMethod ($RAW + 'manifest.json?t=' + $t) } catch { Say "  GitHub se manifest nahi aaya (internet?): $($_.Exception.Message)" Red }
if ($m) {
  Say "  GitHub version: $($m.version)"
  foreach ($f in @('doctor.js', 'KHATA-DOCTOR.bat')) {
    $want = [string]$m.files.$f; $p = Join-Path $K $f
    if (-not $want) { continue }
    $have = ''; if (Test-Path $p) { $have = (Get-FileHash $p -Algorithm SHA256).Hash.ToLower() }
    if ($have -eq $want) { Say "  = $f pehle se taza" DarkGray; continue }
    try {
      Invoke-WebRequest ($RAW + $f + '?t=' + $t) -OutFile ($p + '.new') -UseBasicParsing
      if ((Get-FileHash ($p + '.new') -Algorithm SHA256).Hash.ToLower() -eq $want) {
        if (Test-Path $p) { $bd = Join-Path $K ('backup\' + (Get-Date -Format 'yyyy-MM-dd')); New-Item -ItemType Directory -Force -Path $bd | Out-Null; Copy-Item $p (Join-Path $bd $f) -Force -ErrorAction SilentlyContinue }
        Move-Item ($p + '.new') $p -Force; Say "  + naya: $f" Green
      } else { Remove-Item ($p + '.new') -ErrorAction SilentlyContinue; Say "  ! $f adhoora aaya - purana rakha (2 min baad dobara chalayein)" Red }
    } catch { Say "  ! ${f}: $($_.Exception.Message)" Red }
  }
}
$dv = ''; try { $mm = Select-String -Path (Join-Path $K 'doctor.js') -Pattern 'doctor\.js\s+v([0-9.]+)' -List; if ($mm) { $dv = $mm.Matches[0].Groups[1].Value } } catch {}
Say "  doctor.js: v$dv"

# 3) chalao (chupke - koi window nahi)
Say "--- 3) KHATA-DOCTOR chala raha hoon ---" Cyan
$log = Join-Path $K 'doctor-log.txt'; $slog = Join-Path $K 'stock-log.txt'
$L0 = SizeOf $log; $S0 = SizeOf $slog
'khata-fix.ps1 (command) ne chalaya' | Set-Content -Path (Join-Path $K 'doctor-jaga.txt') -Encoding UTF8
$bat = Join-Path $K 'KHATA-DOCTOR.bat'; $vbs = Join-Path $K 'chupa.vbs'
if (Test-Path $vbs) { Start-Process wscript.exe -ArgumentList @('//B', '//Nologo', "`"$vbs`"", "`"$bat`"") -WorkingDirectory $K }
else { Start-Process cmd.exe -ArgumentList @('/c', "`"$bat`"") -WorkingDirectory $K -WindowStyle Hidden }

# 4) intezar + haal
Say "--- 4) Doctor kaam kar raha hai (2-3 min, nayi files + band scripts) ---" Cyan
$done = $false; $seen = 0
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 5
  $new = @(NewLines $log $L0)
  for ($j = $seen; $j -lt $new.Count; $j++) { Write-Host ('  ' + $new[$j]) }
  $seen = $new.Count
  if ($new | Where-Object { $_ -match 'chal rahi' }) { $done = $true; break }
  if ($new | Where-Object { $_ -match 'pehle se chal raha' }) { break }
}
if ($done) {
  Say ""; Say "--- Stock (sync-stock) ---" Cyan
  for ($i = 0; $i -lt 12; $i++) { if ((SizeOf $slog) -gt $S0) { break }; Start-Sleep -Seconds 5 }
  $sl = @(NewLines $slog $S0)
  if ($sl.Count) { $sl | Select-Object -Last 6 | ForEach-Object { Write-Host ('  ' + $_) } } else { Say "  stock-log mein abhi nayi line nahi - 1-2 min mein aa jayegi" DarkGray }
  if ($new | Where-Object { $_ -match 'list nahi mili' }) { Say ""; Say "WMI atka hua hai (scripts ki list nahi milti) - PC ek dafa RESTART kar dein, sab khud chal jayega." Yellow }
  else { Say ""; Say "THEEK HO GAYA - app mein (3 dots) -> PC scripts mein aaj ka waqt; Stock ki lal patti 2-3 min mein hat jayegi." Green }
} else {
  Say ""; Say "Doctor ne abhi tak poori jaanch nahi likhi. 2 min baad app mein (3 dots) -> PC scripts dekhein; tab bhi purana ho to is screen ki photo bhej dein." Yellow
}
Say ""; Say "Is screen ki photo bhej dein." DarkGray
