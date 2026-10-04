@echo off
REM rate-auto.bat - app se naye rates POS mein lagane wali script, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node rate-lagao.js >> rate-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
