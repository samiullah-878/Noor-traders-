@echo off
REM auto-backup-auto.bat - AUTO BACKUP (din mein 2 dafa, Google Drive folder), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node auto-backup.js >> auto-backup-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 61 127.0.0.1 >nul
goto loop
