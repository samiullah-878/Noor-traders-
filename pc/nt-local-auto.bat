@echo off
REM nt-local-auto.bat - NT LOCAL SERVER (laptop): net na ho to WiFi par app isi se. Chalne se pehle GitHub se taaza nt-local.js (net ho to).
cd /d C:\khata-sync
:loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;Invoke-WebRequest 'https://api.github.com/repos/samiullah-878/Noor-traders-/contents/pc/nt-local.js?ref=main' -Headers @{Accept='application/vnd.github.raw'} -UserAgent 'nt-local' -OutFile 'nt-local-new.js' -UseBasicParsing -TimeoutSec 20}catch{}" >nul 2>&1
if exist nt-local-new.js (
  node --check nt-local-new.js >nul 2>&1 && move /y nt-local-new.js nt-local.js >nul
  if exist nt-local-new.js del nt-local-new.js
)
node nt-local.js >> nt-local-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 11 127.0.0.1 >nul
goto loop
