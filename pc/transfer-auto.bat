@echo off
REM transfer-auto.bat - app se POS transfer note + purchase print wali script, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node transfer-sync.js >> transfer-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
timeout /t 30 /nobreak >nul
goto loop
