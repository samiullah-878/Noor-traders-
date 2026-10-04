@echo off
REM purchase-auto.bat - app ke "POS Purchase" bills POS mein banane wali script, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node purchase-post.js >> purchase-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
