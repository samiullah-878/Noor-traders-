# nt-print-setup.ps1 (2026-10-07, v2 2026-11-09: urdu-names / zinda / sql-config bhi - RN6QU6D par MODULE_NOT_FOUND, v3 2026-11-18: PURANA SERVER) - NT-PRINT counter PC par (scan awaz tik/bzzz/tu-tu-tu, POS screen awaz, app ka bill print)
#   Chalana (counter PC, PowerShell): irm https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/nt-print-setup.ps1 | iex
#   1) C:\khata-sync  2) Node.js (na ho to install)  3) GitHub se NT-PRINT files  4) local-config (PC ka naam)
#   5) firebase-key.json (server se network copy; na ho sake to haath se rakhna)  6) npm firebase-admin  7) Startup  8) chalu + log (sirf NAYI lines)
#   v3: jo PC pehle SERVER tha (C:\khata-sync mein server ke scripts, chaabi .BAND / doosra naam) = NT-PRINT ALAG folder C:\nt-print mein:
#       purane folder mein KUCH nahi likhta (chaabi wapas wahan gayi = purane scripts jaag kar app ki entries hata sakte - 16 Nov),
#       chaabi purani .BAND file se sirf C:\nt-print mein, purani local-config se sirf printer setting (SQL / naam / id NAHI),
#       apni bat (cd /d C:\nt-print), sleep band, phir malik ke 'h' par purana C:\khata-sync BAND (startup hata kar naam badla - mitaya kuch nahi).
$ErrorActionPreference = 'Continue'
$OLD = 'C:\khata-sync'; $NEWD = 'C:\nt-print'; $RAW = 'https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/'; $SERVER = 'DESKTOP-Q1SLV77'; $PROJ = 'note-traders-khata-7ccc1'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }
function NewLog($lg, $from) {
  try {
    $fs = [IO.File]::Open($lg, 'Open', 'Read', 'ReadWrite')
    try { if ($from -gt $fs.Length) { $from = 0 }; [void]$fs.Seek($from, 'Begin'); $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8); $t = $sr.ReadToEnd() } finally { $fs.Close() }
    return @($t -split "`r?`n" | Where-Object { $_ })
  } catch { return @() }
}
function KeyOk($f) {
  try { $j = [IO.File]::ReadAllText($f) | ConvertFrom-Json; return [bool]($j.type -eq 'service_account' -and $j.project_id -eq $PROJ -and ([string]$j.private_key) -match 'PRIVATE KEY' -and $j.client_email) } catch { return $false }
}
$srvF = @('doctor.js', 'sync.js', 'pos-khata-sync.js', 'transfer-sync.js', 'sale-post.js', 'KHATA-DOCTOR.bat') | Where-Object { Test-Path (Join-Path $OLD $_) }
$purana = [bool]$srvF -and (($env:COMPUTERNAME -ne $SERVER) -or -not (Test-Path (Join-Path $OLD 'firebase-key.json')))
$K = if ($purana -or (Test-Path (Join-Path $NEWD 'nt-print.js'))) { $NEWD } else { $OLD }
Say ""; Say "===== NT-PRINT SETUP - $env:COMPUTERNAME - $K =====" Cyan
if ($purana) { Say "Yeh PC pehle SERVER tha: NT-PRINT ALAG folder $K mein lag raha hai. Purane $OLD mein kuch nahi likha jayega." Yellow }
New-Item -ItemType Directory -Force -Path $K | Out-Null
# 0) pehle wala NT-PRINT (kisi bhi folder ka) band - naya isi folder se chalega
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like '*nt-print-auto*' -and $_.CommandLine -notlike "*$K*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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
# 3) files (C:\nt-print ki bat apni - GitHub wali 'cd /d C:\khata-sync' karti hai)
$files = 'nt-print.js', 'nt-parchi.js', 'nt-scan.js', 'nt-posui.js', 'urdu-shape.js', 'urdu-names.js', 'zinda.js', 'sql-config.js', 'nt-print-auto.bat', 'manifest.json'
if ($K -ne $OLD) { $files = $files | Where-Object { $_ -ne 'nt-print-auto.bat' } }
foreach ($f in $files) {
  try { Invoke-WebRequest ($RAW + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $K $f) -UseBasicParsing; Say "  + $f" }
  catch { Say "  ! $f download nahi hua: $($_.Exception.Message)" Red }
}
if ($K -ne $OLD) {
  $bt = "@echo off`r`nREM nt-print-auto.bat - NT-PRINT ($K): app ka bill is PC ke printer par (bina window), ruk jaye to dobara`r`ncd /d $K`r`n:loop`r`nnode nt-print.js >> nt-print-log.txt 2>&1`r`nif errorlevel 3 if not errorlevel 4 exit /b`r`nping -n 31 127.0.0.1 >nul`r`ngoto loop`r`n"
  [IO.File]::WriteAllText((Join-Path $K 'nt-print-auto.bat'), $bt, [Text.Encoding]::ASCII); Say "  + nt-print-auto.bat ($K)"
}
# 4) local-config
$lc = Join-Path $K 'local-config.json'
if (-not (Test-Path $lc)) {
  if ($K -ne $OLD) {
    # purani setting se sirf printer / awaz wali cheezein - SQL, naam, id KABHI nahi (naam = PC ka apna naam)
    $src = @(Get-ChildItem $OLD -File -Filter 'local-config*' -ErrorAction SilentlyContinue | Sort-Object { if ($_.Name -eq 'local-config.json') { 0 } else { 1 } })
    $done = $false
    foreach ($s in $src) {
      try {
        $j = [IO.File]::ReadAllText($s.FullName) | ConvertFrom-Json
        $o = [ordered]@{}
        foreach ($p in $j.PSObject.Properties) { if ($p.Name -notin @('sql', 'pcName', 'pcId') -and $p.Name -notmatch 'pass|key|token|secret') { $o[$p.Name] = $p.Value } }
        [IO.File]::WriteAllText($lc, ($o | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))
        Say "local-config: purani printer / awaz setting li ($($o.Keys.Count) cheezein) - SQL / naam nahi" Green; $done = $true; break
      } catch {}
    }
    if (-not $done) { Say "local-config: nahi bani - NT-PRINT PC ka apna naam ($env:COMPUTERNAME) lega" }
  } else {
    $names = @{ 'DESKTOP-8BR23BF' = 'Mithu PC'; 'DESKTOP-KEIME1D' = 'Abdurehman PC'; 'DESKTOP-Q1SLV77' = 'Bilal (server)' }
    $nm = $names[$env:COMPUTERNAME]; if (-not $nm) { $nm = $env:COMPUTERNAME }
    ('{ "pcName": "' + $nm + '" }') | Set-Content -Path $lc -Encoding ASCII
    Say "local-config: pcName = $nm"
  }
} else { Say "local-config pehle se hai" }
# 5) firebase-key (purane server par: purani .BAND chaabi se SIRF $K mein - purane folder mein wapas KABHI nahi)
$key = Join-Path $K 'firebase-key.json'
if (-not (Test-Path $key) -and $K -ne $OLD) {
  foreach ($c in @(Get-ChildItem $OLD -File -Filter 'firebase-key*' -ErrorAction SilentlyContinue)) {
    if (KeyOk $c.FullName) { [IO.File]::Copy($c.FullName, $key, $true); Say "firebase-key purani file se $K mein rakh di (purana folder waisa hi)" Green; break }
  }
}
if (-not (Test-Path $key)) {
  foreach ($src in "\\$SERVER\khata-sync\firebase-key.json", "\\$SERVER\c$\khata-sync\firebase-key.json") {
    try { Copy-Item $src $key -ErrorAction Stop; Say "firebase-key server se aa gayi ($src)" Green; break } catch {}
  }
}
if (-not (Test-Path $key)) {
  Say "firebase-key.json nahi mili (server network se nahi deta) - koi baat nahi:" Yellow
  Say "  NT-PRINT AWAZ-ONLY chalega: scan tik, POS error par bzzz, ghalat jagah tu-tu-tu. (App se print / status baad mein)" Yellow
}
# 6) firebase-admin
if (-not (Test-Path (Join-Path $K 'node_modules\firebase-admin'))) {
  Say "firebase-admin install ho raha hai (1-3 minute)..." Yellow
  Push-Location $K; & npm.cmd install firebase-admin --no-audit --no-fund --loglevel=error; Pop-Location
}
if (-not (Test-Path (Join-Path $K 'node_modules\firebase-admin'))) { Say "firebase-admin install nahi hua - awaz phir bhi chalegi (print / app status ke liye baad mein dobara chalayein)" Yellow }
# 7) Startup (NT-PRINT.vbs isi folder ki bat chalaye)
$st = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$vbs = Join-Path $st 'NT-PRINT.vbs'
("' NT-PRINT - PC on hote hi chupke se`r`nCreateObject(""WScript.Shell"").Run ""cmd /c """"$K\nt-print-auto.bat"""""", 0, False") | Set-Content -Path $vbs -Encoding ASCII
Say "Startup mein laga diya (PC on hote hi khud chalega, ruk jaye to 30 sec mein dobara)" Green
if ($K -ne $OLD) {
  powercfg /change standby-timeout-ac 0 2>$null | Out-Null; $e1 = $LASTEXITCODE
  powercfg /change hibernate-timeout-ac 0 2>$null | Out-Null; $e2 = $LASTEXITCODE
  if ($e1 -eq 0 -and $e2 -eq 0) { Say "PC ka sleep band (bijli par) - NT-PRINT band nahi hoga" Green } else { Say "Sleep band nahi hua (Windows ne mana kiya) - Settings > Power mein 'Sleep: Never' kar dein" Yellow }
}
# 8) chalu - purana NT-PRINT band, naya isi folder se; sirf NAYI log lines dekh kar faisla
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*nt-print.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$lg = Join-Path $K 'nt-print-log.txt'
$len0 = 0; if (Test-Path $lg) { $len0 = (Get-Item $lg).Length }
$bat = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like "*$K\nt-print-auto*" }
if (-not $bat) { Start-Process wscript.exe "`"$vbs`"" }
Say "NT-PRINT chalu ho raha hai - intezar (50 sec tak)..." Yellow
$new = @(); for ($i = 0; $i -lt 25; $i++) { Start-Sleep 2; $new = NewLog $lg $len0; if ($new | Select-String -Pattern 'NT-PRINT v[0-9.]+|pehle se chal raha') { Start-Sleep 4; $new = NewLog $lg $len0; break } }
$v = $new | Select-String -Pattern 'NT-PRINT v[0-9.]+' | Select-Object -Last 1
if ($v) { Say ("CHAL GAYA: " + $v.Matches[0].Value + " ($K)") Green }
elseif ($new | Select-String -Pattern 'pehle se chal raha') { Say "NAHI CHALA: doosra NT-PRINT pehle se chal raha hai - is screen ki photo bhej dein" Red }
else { Say "NAHI CHALA: NT-PRINT ne log mein kuch nahi likha - is screen ki photo bhej dein" Red }
if ($new.Count) { Say "--- NT-PRINT log (nayi lines) ---" Cyan; $new | Select-Object -Last 12 | ForEach-Object { Write-Host $_ } }
# 9) purana server folder BAND (sirf malik ke 'h' par): startup / Run / task hatao, chalte purane scripts band, naam badlo - mitaya kuch nahi
if ($purana) {
  Say ""; Say "--- Purana $OLD (server ke scripts) ---" Cyan
  $sh = New-Object -ComObject WScript.Shell
  $stF = @(foreach ($d in (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp')) {
    Get-ChildItem $d -File -ErrorAction SilentlyContinue | Where-Object { $t = ''; try { if ($_.Extension -eq '.lnk') { $l = $sh.CreateShortcut($_.FullName); $t = "$($l.TargetPath) $($l.Arguments) $($l.WorkingDirectory)" } else { $t = [IO.File]::ReadAllText($_.FullName) } } catch {}; $t -match 'khata-sync' } })
  $runV = @(foreach ($rk in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run') {
    $p = Get-ItemProperty $rk -ErrorAction SilentlyContinue
    if ($p) { foreach ($pr in $p.PSObject.Properties) { if ($pr.Name -notlike 'PS*' -and ([string]$pr.Value) -match 'khata-sync') { [pscustomobject]@{ Key = $rk; Name = $pr.Name; Val = [string]$pr.Value } } } } })
  $tasks = @(); try { $tasks = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { (($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments) $($_.WorkingDirectory)" }) -join ' ') -match 'khata-sync' }) } catch {}
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe' OR Name='wscript.exe'" | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -notlike '*nt-print.js*' -and $_.CommandLine -notlike '*npm*') -or ($_.Name -ne 'node.exe' -and $_.CommandLine -like '*khata-sync*') })
  Say "Is PC par purane folder se khud chalne wali cheezein:"
  foreach ($x in $stF) { Say "  Startup: $($x.Name)" }
  foreach ($x in $runV) { Say "  Run: $($x.Name)" }
  foreach ($x in $tasks) { Say "  Task: $($x.TaskName)" }
  foreach ($x in $procs) { $nm = [regex]::Match([string]$x.CommandLine, '[\w.-]+\.(js|bat|vbs|cmd)').Value; Say "  Chal raha: $($x.Name) $nm" }
  if (-not ($stF.Count + $runV.Count + $tasks.Count + $procs.Count)) { Say "  (koi nahi)" }
  $nn = 'khata-sync-PURANA-' + (Get-Date -Format 'yyyyMMdd')
  $a = Read-Host "Purana $OLD BAND kar doon? (startup se hata kar naam '$nn' - koi file nahi mitegi) h = haan / n = nahi"
  if ($a -match '^(h|y)') {
    $procs | Sort-Object { if ($_.Name -eq 'node.exe') { 1 } else { 0 } } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $bk = Join-Path $OLD '_startup-hataya'; New-Item -ItemType Directory -Force -Path $bk | Out-Null
    foreach ($x in $stF) { try { Move-Item $x.FullName (Join-Path $bk $x.Name) -Force -ErrorAction Stop; Say "  hataya (Startup): $($x.Name)" Green } catch { Say "  ! $($x.Name) nahi hata: $($_.Exception.Message)" Red } }
    foreach ($x in $runV) { try { Add-Content (Join-Path $bk 'run-hataye.txt') "$($x.Key) | $($x.Name) | $($x.Val)"; Remove-ItemProperty -Path $x.Key -Name $x.Name -ErrorAction Stop; Say "  hataya (Run): $($x.Name)" Green } catch { Say "  ! Run $($x.Name) nahi hata (admin chahiye)" Red } }
    foreach ($x in $tasks) { try { Disable-ScheduledTask -TaskName $x.TaskName -TaskPath $x.TaskPath -ErrorAction Stop | Out-Null; Add-Content (Join-Path $bk 'task-band.txt') "$($x.TaskPath)$($x.TaskName)"; Say "  band (Task): $($x.TaskName)" Green } catch { Say "  ! Task $($x.TaskName) band nahi hua (admin chahiye)" Red } }
    Start-Sleep 2
    try { Rename-Item -Path $OLD -NewName $nn -ErrorAction Stop; Say "HO GAYA: purana folder band - naya naam C:\$nn (kuch mitaya nahi)" Green }
    catch { Say "NAAM NAHI BADLA (koi file abhi khuli hai): PC restart kar ke yehi line dobara chalayein - startup se pehle hi hat chuka hai" Red }
  } else { Say "Theek - purana folder waise hi rakha. Band karna ho to yehi line dobara chalayein." Yellow }
}
Say ""; Say "Ab POS par ek SAHI aur ek GHALAT barcode scan kar ke dekhein: sahi par tik, ghalat par bzzz." Green
