@echo off
REM report-auto.bat - RAAT KI REPORT + MAAL KHATAM ALERT (raat-report.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node raat-report.js >> report-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
