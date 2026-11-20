@echo off
REM ginti-cam-auto.bat - godam camera ki LOADING GINTI (ginti-cam.js, lakeer paar karne wale nag), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node ginti-cam.js >> ginti-cam-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
