@echo off
REM bills-auto.bat — bill sync chalata hai, ruk jaye to dobara
cd /d C:\khata-sync

:loop
echo ---- shuru: %date% %time% >> bills-log.txt
node sync-bills.js >> bills-log.txt 2>&1
echo ---- ruk gaya: %date% %time% >> bills-log.txt
timeout /t 30 /nobreak >nul
goto loop
