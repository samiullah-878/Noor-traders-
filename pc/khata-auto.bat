@echo off 
cd /d "C:\khata-sync" 
:loop 
node sync.js >> sync-log.txt 2>&1 
timeout /t 300 /nobreak > nul 
goto loop 
