@echo off
REM wa-out-auto.bat - gahak ko WhatsApp parchi (naya number) (wa-out.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node wa-out.js >> wa-out-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
