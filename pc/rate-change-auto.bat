@echo off
REM rate-change-auto.bat - Rate change list (rate-change.js, sirf parhti hai), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node rate-change.js >> rate-change-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
