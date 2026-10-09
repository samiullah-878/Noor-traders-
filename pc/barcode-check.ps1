# barcode-check.ps1 (2026-10-09) - EK BARCODE kis item mein hai? POS + app dono mein. SIRF PARHTA HAI, kuch nahi badalta.
#   Server PC (AnyDesk PowerShell) - barcode pehle likh kar:
#   $bc='8964001187073'; irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/barcode-check.ps1 | iex
$ErrorActionPreference = 'Continue'
$bcK = 'C:\khata-sync'
$bcCode = if ($bc) { [string]$bc } else { Read-Host 'Barcode likhein' }
$bcCode = $bcCode.Trim()
Write-Host ""
Write-Host "===== BARCODE CHECK - $env:COMPUTERNAME =====" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
if (-not (Test-Path (Join-Path $bcK 'sql-config.js'))) { Write-Host "Is PC par khata-sync (POS scripts) nahi - yeh command SERVER PC (DESKTOP-Q1SLV77) par chalayein." -ForegroundColor Red; return }
$bcJs = Join-Path $bcK 'barcode-dhoondo.js'
try { Invoke-WebRequest ('https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/barcode-dhoondo.js?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile $bcJs -UseBasicParsing }
catch { Write-Host "GitHub se file nahi aayi: $($_.Exception.Message)" -ForegroundColor Red; if (-not (Test-Path $bcJs)) { return } }
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # node ki likhai (✓ ❌) sahi dikhe
Push-Location $bcK
try { & node $bcJs $bcCode } finally { Pop-Location }
$bcLog = Join-Path $bcK 'item-log.txt'
if (Test-Path $bcLog) {
  $bcL = Get-Content $bcLog -Tail 2000 -Encoding UTF8 | Select-String -SimpleMatch $bcCode | Select-Object -Last 5
  if ($bcL) { Write-Host "--- item-log (is barcode ki lines) ---" -ForegroundColor Cyan; $bcL | ForEach-Object { Write-Host $_.Line } }
}
Write-Host ""
Write-Host "Is screen ki photo bhej dein." -ForegroundColor Yellow
