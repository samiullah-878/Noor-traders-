@echo off
cd /d C:\khata-sync
:loop
node post-farq.js --auto >> farq-log.txt 2>&1
timeout /t 30 /nobreak >nul
goto loop
