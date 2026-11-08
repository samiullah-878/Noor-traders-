@echo off
REM bill-clip-auto.bat - har POS bill ki chhoti video counter camera se (bill-clip.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node bill-clip.js >> bill-clip-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
