@echo off
REM rules-auto.bat - Firestore rules GitHub se khud publish (rules-publish.js), ruk jaye to dobara (owner-login-auto.bat jaisa)
cd /d C:\khata-sync
:loop
node rules-publish.js >> rules-publish-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
