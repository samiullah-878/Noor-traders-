# rate-check.ps1 (2026-10-10) - EK ITEM ke rate: POS item master / har branch / aakhri purchase / app (POS se) / app ki yaad. SIRF PARHTA HAI.
#   Server PC (AnyDesk PowerShell) - item ka naam pehle likh kar:
#   $it='NAILS'; irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/rate-check.ps1 | iex
$ErrorActionPreference = 'Continue'
$rcK = 'C:\khata-sync'
$rcQ = if ($it) { [string]$it } else { Read-Host 'Item ka naam ya barcode likhein' }
$rcQ = $rcQ.Trim()
Write-Host ""
Write-Host "===== RATE CHECK - $rcQ - $env:COMPUTERNAME =====" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
if (-not (Test-Path (Join-Path $rcK 'sql-config.js'))) { Write-Host "Is PC par khata-sync (POS scripts) nahi - yeh command SERVER PC (DESKTOP-Q1SLV77) par chalayein." -ForegroundColor Red; return }
$rcJs = Join-Path $rcK 'rate-dhoondo.js'
try { Invoke-WebRequest ('https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/rate-dhoondo.js?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile $rcJs -UseBasicParsing }
catch { Write-Host "GitHub se file nahi aayi: $($_.Exception.Message)" -ForegroundColor Red; if (-not (Test-Path $rcJs)) { return } }
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Push-Location $rcK
try { & node $rcJs $rcQ } finally { Pop-Location }
Write-Host ""
Write-Host "Is screen ki photo bhej dein." -ForegroundColor Yellow
