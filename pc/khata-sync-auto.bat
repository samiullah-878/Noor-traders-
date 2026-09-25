@echo off
cd /d C:\khata-sync
:loop
node pos-khata-sync.js --auto >> khata-sync-log.txt 2>&1
timeout /t 60 /nobreak >nul
goto loop
