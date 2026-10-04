@echo off 
cd /d "C:\khata-sync" 
:loop 
node sync.js >> sync-log.txt 2>&1 
ping -n 301 127.0.0.1 >nul 
goto loop 
