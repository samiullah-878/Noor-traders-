@echo off
REM gaari-gps-auto.bat - gaari ke phone (MacroDroid) ki jagah -> din ke km (gaari-gps.js), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node gaari-gps.js >> gaari-gps-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
