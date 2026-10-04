@echo off
cd /d C:\khata-sync
:loop
node post-farq.js --auto >> farq-log.txt 2>&1
ping -n 31 127.0.0.1 >nul
goto loop
