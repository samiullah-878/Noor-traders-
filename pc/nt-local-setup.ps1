# nt-local-setup.ps1 (2026-10-24) - LAPTOP ko NT LOCAL SERVER banana (Update 1: camera band + jaanch)
#   Chalana (laptop, AnyDesk -> PowerShell "Run as administrator"):
#     irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/nt-local-setup.ps1 | iex
#   1) NT Camera band (program + chowkidar task + Startup shortcut) - C:\NTCam ki files NAHI mitti
#   2) C:\khata-sync + Node + mssql   3) local-config (server PC ka SQL, laptop se)   4) firewall port 47900
#   5) Sleep band (bijli par)   6) Startup NT-LOCAL.vbs   7) chalu + jaanch
#   KHATA-DOCTOR is laptop par NAHI lagana - warna sale/purchase POS mein do dafa jayein.
$ErrorActionPreference = 'Continue'
$K = 'C:\khata-sync'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'; $SERVER = 'DESKTOP-Q1SLV77'; $PORT = 47900
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
Say ""; Say "===== NT LOCAL SERVER SETUP - $env:COMPUTERNAME =====" Cyan
if ($env:COMPUTERNAME -eq $SERVER) { Say "Ye SERVER PC hai - ye setup sirf LAPTOP par chalana hai." Red; return }
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Say "Note: PowerShell admin nahi - firewall nahi lagega. Behtar: PowerShell 'Run as administrator' se dobara." Yellow }

# 1) NT Camera band
Say "--- 1) NT Camera band ---" Cyan
try { schtasks /Delete /F /TN "NT Camera chowkidar" 2>$null | Out-Null; Say "  chowkidar task hata diya" } catch {}
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'NT Camera.lnk'
if (Test-Path $lnk) {
  New-Item -ItemType Directory -Force -Path 'C:\NTCam' | Out-Null
  Move-Item $lnk 'C:\NTCam\NT Camera.lnk.band' -Force; Say "  Startup se hata diya (wapas chahiye: C:\NTCam\NT Camera.lnk.band)"
}
$cam = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ntcam.py*' -or ($_.Name -eq 'ffmpeg.exe' -and $_.CommandLine -like '*rtsp*') }
foreach ($p in $cam) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Say "  band: $($p.Name) ($($p.ProcessId))" } catch {} }
if (Test-Path 'C:\NTCam\ntcam.log') { Add-Content 'C:\NTCam\ntcam.log' ("{0} NT Camera BAND kiya (laptop = local server)" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) }
Say "  [OK] NT Camera band. Files C:\NTCam mein mehfooz." Green

# 2) folder + Node + mssql
Say "--- 2) Node + files ---" Cyan
New-Item -ItemType Directory -Force -Path $K | Out-Null
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs'; $node = Get-Command node -ErrorAction SilentlyContinue }
if (-not $node) {
  Say "  Node.js nahi hai - download (2-5 minute)..." Yellow
  $msi = "$env:TEMP\node-lts.msi"
  try { Invoke-WebRequest 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile $msi -UseBasicParsing } catch { Say "  Node download nahi hua: $($_.Exception.Message)" Red; return }
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait
  $env:Path += ';C:\Program Files\nodejs'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Say "  Node install nahi hua - laptop restart kar ke yehi command dobara" Red; return }
}
Say ("  Node: " + (& node -v)) Green
foreach ($f in 'nt-local.js', 'nt-local-auto.bat') {
  try { Invoke-WebRequest ($RAW + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $K $f) -UseBasicParsing; Say "  + $f" }
  catch { Say "  ! $f download nahi hua: $($_.Exception.Message)" Red; return }
}
if (-not (Test-Path (Join-Path $K 'node_modules\mssql'))) {
  Say "  mssql install (1-3 minute)..." Yellow
  Push-Location $K; & npm.cmd install mssql --no-audit --no-fund --loglevel=error; Pop-Location
}
if (-not (Test-Path (Join-Path $K 'node_modules\mssql'))) { Say "  mssql install nahi hua - net check kar ke dobara chalayein" Red; return }

# 3) local-config: server PC ka SQL (password kabhi screen par nahi)
Say "--- 3) POS database ki setting ---" Cyan
$lc = Join-Path $K 'local-config.json'
$cfg = $null
if (Test-Path $lc) { try { $cfg = Get-Content $lc -Raw | ConvertFrom-Json } catch {} }
if (-not ($cfg -and $cfg.sql -and $cfg.sql.server)) {
  $src = $null
  foreach ($s in "\\$SERVER\khata-sync\local-config.json", "\\$SERVER\c$\khata-sync\local-config.json") { try { $src = Get-Content $s -Raw -ErrorAction Stop | ConvertFrom-Json; Say "  server PC se setting aa gayi" Green; break } catch {} }
  if ($src -and $src.sql) { $sq = $src.sql }
  else {
    Say "  Server PC se setting nahi mili - haath se likhein (POS ka SQL login):" Yellow
    $u = Read-Host "  SQL user (Enter = sa)"; if (-not $u) { $u = 'sa' }
    $pw = Read-Host "  SQL password" -AsSecureString
    $pt = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
    $sq = [pscustomobject]@{ server = "$SERVER\SQLEXPRESS"; database = 'POS'; user = $u; password = $pt }
  }
  $srv = [string]$sq.server
  if ($srv -match '^(localhost|127\.0\.0\.1|\.|\(local\))(\\|$)') { $srv = $SERVER + $srv.Substring($Matches[1].Length) }
  $sq.server = $srv
  $cfg = [pscustomobject]@{ pcName = 'Laptop (local server)'; sql = $sq }
  ($cfg | ConvertTo-Json -Depth 5) | Set-Content -Path $lc -Encoding UTF8
}
Say ("  SQL server: " + $cfg.sql.server + " · database: " + $cfg.sql.database) Green

# 4) firewall
if ($admin) {
  netsh advfirewall firewall delete rule name="NT Local Server" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="NT Local Server" dir=in action=allow protocol=TCP localport=$PORT profile=any | Out-Null
  Say "  [OK] Firewall: port $PORT khula (sirf andar ke WiFi ke liye)" Green
}

# 5) sleep band (charger par)
try { powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0; Say "  [OK] Charger par laptop Sleep nahi hoga" Green } catch {}

# 6) Startup
$st = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$vbs = Join-Path $st 'NT-LOCAL.vbs'
("' NT LOCAL SERVER - laptop on hote hi chupke se`r`nCreateObject(""WScript.Shell"").Run ""cmd /c """"$K\nt-local-auto.bat"""""", 0, False") | Set-Content -Path $vbs -Encoding ASCII
Say "  [OK] Startup mein laga (laptop on hote hi khud chalega)" Green

# 7) chalu + jaanch
$run = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*nt-local*' }
foreach ($p in $run) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
Start-Process wscript.exe "`"$vbs`""; Say "  chalu kiya - 15 second intezar..." Yellow; Start-Sleep 15
try {
  $r = Invoke-RestMethod "http://localhost:$PORT/ping" -TimeoutSec 15
  Say "  [OK] Local server chal raha hai (v$($r.ver))" Green
  if ($r.sql.ok) { Say "  [OK] POS database jura: $($r.sql.items) items, $($r.sql.ms) ms" Green } else { Say "  [!!] POS database nahi juda: $($r.sql.err)" Red }
} catch { Say "  [!!] Local server ne jawab nahi diya - log dekhein: $K\nt-local-log.txt" Red }
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
Say ""; Say "LAPTOP KA IP: $ip   (app mein Settings -> Local server jaanch mein yehi)" Cyan
Say "Phone ke Chrome mein bhi khol kar dekh sakte hain: http://${ip}:$PORT" Cyan
