@echo off
REM pc-vault-auto.bat - server ki chaabi / SQL setting ka taale wala backup Firestore mein (pc-vault.js), naye server PC ke liye
cd /d C:\khata-sync
:loop
node pc-vault.js >> pc-vault-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
