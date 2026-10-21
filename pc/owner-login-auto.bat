@echo off
REM owner-login-auto.bat - malik ka pakka code (login screen) shop PC par jaanch, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node owner-login.js >> owner-login-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
