@echo off
REM nt-print-auto.bat - NT-PRINT: app ka bill is PC ke printer par (bina window), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node nt-print.js >> nt-print-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
