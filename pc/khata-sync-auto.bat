@echo off
cd /d C:\khata-sync
:loop
node pos-khata-sync.js --auto >> khata-sync-log.txt 2>&1
ping -n 61 127.0.0.1 >nul
goto loop
