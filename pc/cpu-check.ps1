# cpu-check.ps1 - sirf DEKHTA hai (kuch band / delete nahi karta). 5 minute: CPU 70%+ par top programs.
# Chalane ka tareeqa (PowerShell): irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/cpu-check.ps1|iex
$cores = [Environment]::ProcessorCount
Write-Host "=== CPU NIGRANI 5 MINUTE (PC ko aam tarah chalne dein) ===" -ForegroundColor Cyan
function Snap { $h=@{}; Get-Process -ErrorAction SilentlyContinue | ForEach-Object { if ($_.CPU -ne $null) { $h["$($_.Id)"] = @($_.Name, [double]$_.CPU) } }; $h }
$end = (Get-Date).AddMinutes(5); $a = Snap; $hits = 0; $seen = @{}
while ((Get-Date) -lt $end) {
  Start-Sleep -Seconds 2; $b = Snap; $rows = @()
  foreach ($k in $b.Keys) { if ($a.ContainsKey($k)) { $d = ($b[$k][1] - $a[$k][1]) / 2 / $cores * 100; if ($d -gt 0.5) { $rows += [pscustomobject]@{ Program = $b[$k][0]; CPU = [int]$d } } } }
  $tot = [int](($rows | Measure-Object CPU -Sum).Sum)
  if ($tot -ge 70) {
    $hits++; Write-Host ("{0}  KUL CPU {1}%" -f (Get-Date -Format T), $tot) -ForegroundColor Yellow
    $rows | Sort-Object CPU -Descending | Select-Object -First 5 | ForEach-Object { Write-Host ("     {0,-28} {1,3}%" -f $_.Program, $_.CPU); $seen[$_.Program] = 1 + [int]$seen[$_.Program] }
  }
  $a = $b
}
Write-Host ""
if ($hits -eq 0) { Write-Host "5 minute mein CPU 70% se upar NAHI gaya." -ForegroundColor Green }
else { Write-Host "SAB SE ZYADA DAFA UPAR AANE WALE:" -ForegroundColor Yellow; $seen.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 6 | ForEach-Object { Write-Host ("     {0,-28} {1} dafa" -f $_.Key, $_.Value) } }
Write-Host ""; Write-Host "RAM (sab se zyada):" -ForegroundColor Cyan
Get-Process | Sort-Object WS -Descending | Select-Object -First 8 | ForEach-Object { Write-Host ("     {0,-28} {1,5} MB" -f $_.Name, [int]($_.WS/1MB)) }
$os = $null; try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop } catch {}
if ($os) { Write-Host ("     KUL RAM: {0} GB mein se {1} GB khali" -f [math]::Round($os.TotalVisibleMemorySize/1MB,1), [math]::Round($os.FreePhysicalMemory/1MB,1)) }
Write-Host ""; Write-Host "ANJAAN PROGRAM KAHAN SE:" -ForegroundColor Cyan
foreach ($n in 'auto_eject','mshta','devicecontrollog','rustdesk') { Get-Process $n -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { Write-Host ("     {0,-18} {1}" -f $_.Name, $_.Path) } }
Write-Host ""; Write-Host "=== KHATAM - is screen ki tasveer bhej dein ===" -ForegroundColor Cyan
