@echo off
REM label-auto.bat - app se barcode label (TSC) chhapne wali script, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node label-print.js >> label-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
timeout /t 30 /nobreak >nul
goto loop
