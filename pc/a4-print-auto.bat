@echo off
REM a4-print-auto.bat - app ki har tasveer -> HP WiFi printer par A4 (a4-print.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node a4-print.js >> a4-print-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
