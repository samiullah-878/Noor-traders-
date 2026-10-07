# nt-print-setup.ps1 (2026-10-07) - NT-PRINT naye counter PC par (scan awaz tik/bzzz/tu-tu-tu, POS screen awaz, app ka bill print)
#   Chalana (counter PC, PowerShell): irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/nt-print-setup.ps1 | iex
#   1) C:\khata-sync  2) Node.js (na ho to install)  3) GitHub se NT-PRINT files  4) local-config (PC ka naam)
#   5) firebase-key.json (server se network copy; na ho sake to haath se rakhna)  6) npm firebase-admin  7) Startup  8) chalu + log
$ErrorActionPreference = 'Continue'
$K = 'C:\khata-sync'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'; $SERVER = 'DESKTOP-Q1SLV77'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
Say ""; Say "===== NT-PRINT SETUP - $env:COMPUTERNAME =====" Cyan
New-Item -ItemType Directory -Force -Path $K | Out-Null
# 2) Node
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs'; $node = Get-Command node -ErrorAction SilentlyContinue }
if (-not $node) {
  Say "Node.js nahi hai - download ho raha hai (2-5 minute)..." Yellow
  $msi = "$env:TEMP\node-lts.msi"
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile $msi -UseBasicParsing } catch { Say "Node download nahi hua: $($_.Exception.Message)" Red; return }
  Say "Node install ho raha hai - 'Yes' dabayein agar Windows poochay..." Yellow
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait
  $env:Path += ';C:\Program Files\nodejs'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Say "Node install nahi hua - PC restart kar ke yehi command dobara chalayein" Red; return }
}
Say ("Node: " + (& node -v)) Green
# 3) files
$files = 'nt-print.js', 'nt-parchi.js', 'nt-scan.js', 'nt-posui.js', 'urdu-shape.js', 'nt-print-auto.bat', 'manifest.json'
foreach ($f in $files) {
  try { Invoke-WebRequest ($RAW + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $K $f) -UseBasicParsing; Say "  + $f" }
  catch { Say "  ! $f download nahi hua: $($_.Exception.Message)" Red }
}
# 4) local-config
$lc = Join-Path $K 'local-config.json'
if (-not (Test-Path $lc)) {
  $names = @{ 'DESKTOP-8BR23BF' = 'Mithu PC'; 'DESKTOP-KEIME1D' = 'Abdurehman PC'; 'DESKTOP-Q1SLV77' = 'Bilal (server)' }
  $nm = $names[$env:COMPUTERNAME]; if (-not $nm) { $nm = $env:COMPUTERNAME }
  ('{ "pcName": "' + $nm + '" }') | Set-Content -Path $lc -Encoding ASCII
  Say "local-config: pcName = $nm"
} else { Say "local-config pehle se hai" }
# 5) firebase-key
$key = Join-Path $K 'firebase-key.json'
if (-not (Test-Path $key)) {
  foreach ($src in "\\$SERVER\khata-sync\firebase-key.json", "\\$SERVER\c$\khata-sync\firebase-key.json") {
    try { Copy-Item $src $key -ErrorAction Stop; Say "firebase-key server se aa gayi ($src)" Green; break } catch {}
  }
}
if (-not (Test-Path $key)) {
  Say "" ; Say "!!! firebase-key.json NAHI mili (server se network copy ki ijazat nahi)." Red
  Say "    Server PC ($SERVER) ki C:\khata-sync\firebase-key.json pen drive / AnyDesk file transfer se" Yellow
  Say "    is PC ki C:\khata-sync\ mein rakhein, phir YEHI command dobara chalayein." Yellow
  Start-Process explorer.exe $K
  return
}
# 6) firebase-admin
if (-not (Test-Path (Join-Path $K 'node_modules\firebase-admin'))) {
  Say "firebase-admin install ho raha hai (1-3 minute)..." Yellow
  Push-Location $K; & npm.cmd install firebase-admin --no-audit --no-fund --loglevel=error; Pop-Location
}
if (-not (Test-Path (Join-Path $K 'node_modules\firebase-admin'))) { Say "firebase-admin install nahi hua - internet check kar ke dobara chalayein" Red; return }
# 7) Startup
$st = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$vbs = Join-Path $st 'NT-PRINT.vbs'
("' NT-PRINT - PC on hote hi chupke se`r`nCreateObject(""WScript.Shell"").Run ""cmd /c """"$K\nt-print-auto.bat"""""", 0, False") | Set-Content -Path $vbs -Encoding ASCII
Say "Startup mein laga diya (PC on hote hi khud chalega)" Green
# 8) chalu
$run = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*nt-print*' }
if ($run) { Say "NT-PRINT pehle se chal raha hai" Green } else { Start-Process wscript.exe "`"$vbs`""; Say "NT-PRINT chalu kiya - 25 second intezar..." Yellow; Start-Sleep 25 }
$lg = Join-Path $K 'nt-print-log.txt'
if (Test-Path $lg) { Say "--- NT-PRINT log ---" Cyan; Get-Content $lg -Tail 12 -Encoding UTF8 | ForEach-Object { Write-Host $_ } }
Say ""; Say "Ab POS par ek SAHI aur ek GHALAT barcode scan kar ke dekhein: tik / bzzz aani chahiye." Green
