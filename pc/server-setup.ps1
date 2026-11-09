# server-setup.ps1 (2026-11-09) - NAYA SERVER PC: Node + chaabi (malik ki app se, 6 hindse ka code) + KHATA-DOCTOR (baqi sab khud)
#   Chalana (naye PC par, PowerShell - Run as administrator):
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/server-setup.ps1 | iex
#   1) C:\khata-sync  2) Node.js (na ho to)  3) GitHub se doctor + server-join  4) code -> malik app -> chaabi  5) KHATA-DOCTOR chalu
#   DHYAN: purana server PC band ho - dono chale to POS mein bill do dafa.
$ErrorActionPreference = 'Continue'
$K = 'C:\khata-sync'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
Say ""; Say "===== NAYA SERVER SETUP - $env:COMPUTERNAME =====" Cyan
New-Item -ItemType Directory -Force -Path $K | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# 2) Node
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs'; $node = Get-Command node -ErrorAction SilentlyContinue }
if (-not $node) {
  Say "Node.js nahi hai - download ho raha hai (2-5 minute)..." Yellow
  $msi = "$env:TEMP\node-lts.msi"
  try { Invoke-WebRequest 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi' -OutFile $msi -UseBasicParsing } catch { Say "Node download nahi hua: $($_.Exception.Message)" Red; return }
  Say "Node install ho raha hai - 'Yes' dabayein agar Windows poochay..." Yellow
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait
  $env:Path += ';C:\Program Files\nodejs'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Say "Node install nahi hua - PC restart kar ke yehi command dobara chalayein" Red; return }
}
Say ("Node: " + (& node -v)) Green
# 3) files
foreach ($f in 'pc/server-join.js', 'pc/doctor.js', 'pc/KHATA-DOCTOR.bat', 'pc/manifest.json', 'firebase-config.js') {
  $n = Split-Path $f -Leaf
  try { Invoke-WebRequest ($RAW + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $K $n) -UseBasicParsing; Say "  + $n" }
  catch { Say "  ! $n download nahi hua: $($_.Exception.Message)" Red }
}
if (-not (Test-Path (Join-Path $K 'server-join.js'))) { Say "server-join.js nahi aayi - internet dekhein" Red; return }
# 4) chaabi (code -> malik app)
Push-Location $K
if ((Test-Path 'firebase-key.json') -and (Test-Path 'local-config.json')) { Say "Chaabi + local-config pehle se hain - phir bhi naya lena ho to dono hata kar dobara chalayein" Yellow }
else {
  & node server-join.js
  if ($LASTEXITCODE -ne 0) { Pop-Location; Say "Chaabi nahi aayi - yehi command dobara chalayein" Red; return }
}
Pop-Location
# 5) KHATA-DOCTOR (npm packages, Startup, sab services khud)
Say "KHATA-DOCTOR chalu ho raha hai - pehli dafa packages 2-5 minute..." Green
Start-Process cmd.exe -ArgumentList "/c `"$K\KHATA-DOCTOR.bat`"" -WorkingDirectory $K -WindowStyle Minimized
Say ""
Say "HO GAYA. 5-10 minute mein app ki Settings > PC scripts mein naya PC nazar aayega." Green
Say "WhatsApp ke QR app ke settings se dobara jorne honge (WhatsApp ki apni hifazat)." Yellow
Say "POS (Cognitive) + SQL Server is PC par pehle se hona chahiye - local-config wahi SQL dhoondti hai." Yellow
