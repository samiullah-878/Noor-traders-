@echo off
REM stock-auto.bat — stock sync chalata hai aur ruk jaye to dobara chala deta hai
cd /d C:\khata-sync

:loop
echo ---- shuru: %date% %time% >> stock-log.txt
node sync-stock.js >> stock-log.txt 2>&1
echo ---- ruk gaya: %date% %time% >> stock-log.txt
ping -n 31 127.0.0.1 >nul
goto loop
