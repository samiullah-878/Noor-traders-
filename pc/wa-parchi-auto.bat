@echo off
REM wa-parchi-auto.bat - WhatsApp parchi -> packing list (thermal + A4) (wa-parchi.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node wa-parchi.js >> wa-parchi-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
