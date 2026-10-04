@echo off
REM subcode-auto.bat - app se POS sub-barcode banane/badalne wali script, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node subcode-sync.js >> subcode-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
