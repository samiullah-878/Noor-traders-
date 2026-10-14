# gate-check.ps1 (2026-10-14) - POS (Retail Solution) ka APNA gate pass kis report file se banta hai? SIRF PARHTA HAI, kuch nahi badalta.
#   Server PC (DESKTOP-Q1SLV77) - POS khula ho - AnyDesk PowerShell:
#   irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/gate-check.ps1 | iex
#   Natija screen par + C:\khata-sync\_gate.txt (notepad khulta hai) - photo bhej dein.
$ErrorActionPreference = 'Continue'
$gcK = 'C:\khata-sync'
$gcOut = New-Object System.Collections.Generic.List[string]
function gcSay($t) { $gcOut.Add([string]$t); Write-Host $t }
gcSay "===== GATE PASS CHECK - $env:COMPUTERNAME - $(Get-Date -Format 'dd-MMM-yyyy HH:mm') ====="

# 1) POS program kahan hai (khuli window "Retail Solution" se, warna Program Files mein dhoondo)
$gcDirs = @()
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Retail Solution*' } | ForEach-Object {
  try { if ($_.Path) { gcSay "POS chal raha hai: $($_.ProcessName)  ->  $($_.Path)"; $gcDirs += (Split-Path $_.Path) } } catch {}
}
if (-not $gcDirs.Count) {
  gcSay "POS ki khuli window nahi mili - Program Files mein dhoond raha hoon..."
  foreach ($r in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\')) {
    if (-not $r -or -not (Test-Path $r)) { continue }
    Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'retail|pos|solution' } | ForEach-Object { gcSay "Folder: $($_.FullName)"; $gcDirs += $_.FullName }
  }
}
$gcDirs = $gcDirs | Select-Object -Unique

foreach ($d in $gcDirs) {
  gcSay ""
  gcSay "----- $d -----"
  # 2) report engine (kaun si DLL)
  $eng = Get-ChildItem $d -Recurse -Depth 2 -Filter *.dll -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Crystal|ReportViewer|XtraReports|DevExpress|FastReport|Stimulsoft|Telerik|ActiveReports' } | Select-Object -ExpandProperty Name -Unique | Select-Object -First 12
  gcSay ("Report engine DLL: " + $(if ($eng) { $eng -join ', ' } else { '(koi nahi mili)' }))
  # 3) report files
  $rep = Get-ChildItem $d -Recurse -Depth 4 -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -match '^\.(rpt|rdlc|rdl|repx|frx|mrt|fr3|trdx|trdp|rpx)$' }
  gcSay "Report files: $(@($rep).Count)"
  $rep | Where-Object { $_.Name -match 'gate|pass|store|get|godam' } | ForEach-Object { gcSay ("  >> GATE?  " + $_.FullName.Substring($d.Length) + "  (" + [math]::Round($_.Length / 1kb) + " KB, " + $_.LastWriteTime.ToString('dd-MMM-yyyy') + ")") }
  $rep | Where-Object { $_.Name -match 'sale|invoice|bill|receipt' } | Select-Object -First 15 | ForEach-Object { gcSay ("  sale/bill: " + $_.FullName.Substring($d.Length)) }
  # 4) text wali report files ke andar "Gate" likha hai?
  $rep | Where-Object { $_.Extension -match '^\.(rdlc|rdl|repx|frx|mrt|trdx)$' -and $_.Length -lt 5mb } | ForEach-Object {
    if (Select-String -Path $_.FullName -Pattern 'gate ?pass' -Quiet -ErrorAction SilentlyContinue) { gcSay ("  >> andar 'Gate Pass' likha: " + $_.FullName.Substring($d.Length)) }
  }
  if (-not @($rep).Count) {
    $ext = Get-ChildItem $d -Recurse -Depth 3 -File -ErrorAction SilentlyContinue | Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { "$($_.Name)=$($_.Count)" }
    gcSay ("Files ki qismein: " + ($ext -join ' '))
  }
}

# 5) POS database mein gate pass ki setting? (sirf SELECT)
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $env:Path += ';C:\Program Files\nodejs' }
if ((Test-Path (Join-Path $gcK 'sql-config.js')) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $js = @'
const sql = require('mssql'); const cfg = require('./sql-config.js');
(async () => {
  const p = await sql.connect(cfg); const out = [];
  const c = await p.request().query("SELECT TABLE_NAME + '.' + COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%gate%' OR COLUMN_NAME LIKE '%GetStore%' OR (COLUMN_NAME LIKE '%print%' AND TABLE_NAME NOT LIKE 'v%') ORDER BY 1");
  out.push('DB khane (gate / print): ' + (c.recordset.map(x => x.c).join(', ') || 'koi nahi'));
  const t = await p.request().query("SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%setting%' OR TABLE_NAME LIKE '%default%' OR TABLE_NAME LIKE '%config%' OR TABLE_NAME LIKE '%report%' OR TABLE_NAME LIKE '%print%'");
  for (const { t: n } of t.recordset) {
    try { const r = await p.request().query('SELECT TOP 1 * FROM [' + n.replace(/]/g, '') + ']'); const o = r.recordset[0] || {};
      const k = Object.keys(o).filter(x => /gate|store|print|report|bill/i.test(x)); out.push('[' + n + '] ' + (k.length ? k.map(x => x + '=' + String(o[x]).slice(0, 40)).join(' | ') : '(gate/print ka khana nahi; khane: ' + Object.keys(o).slice(0, 25).join(',') + ')'));
    } catch (e) { out.push('[' + n + '] ' + e.message); }
  }
  console.log(out.join('\n')); process.exit(0);
})().catch(e => { console.log('SQL masla: ' + e.message); process.exit(1); });
'@
  [IO.File]::WriteAllText((Join-Path $gcK '_gatecheck.js'), $js)
  Push-Location $gcK
  try { gcSay ""; gcSay "----- POS database -----"; (& node _gatecheck.js 2>&1) | ForEach-Object { gcSay $_ } } finally { Pop-Location }
} else { gcSay ""; gcSay "(Is PC par khata-sync / node nahi - database wala hissa chhor diya. SERVER PC par chalayein.)" }

$gcFile = Join-Path $(if (Test-Path $gcK) { $gcK } else { $env:TEMP }) '_gate.txt'
[IO.File]::WriteAllLines($gcFile, $gcOut, [Text.Encoding]::UTF8)
Write-Host ""
Write-Host "Is screen (ya notepad) ki photo bhej dein." -ForegroundColor Yellow
notepad $gcFile
