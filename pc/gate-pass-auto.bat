@echo off
REM gate-pass-auto.bat - POS ke POSTED bills ka gate pass -> app (gate-pass.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node gate-pass.js >> gate-pass-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
