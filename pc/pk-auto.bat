@echo off
REM pk-auto.bat - Godam 2 packet report (pk-report.js, sirf parhti hai), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node pk-report.js >> pk-report-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
