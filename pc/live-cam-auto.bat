@echo off
REM live-cam-auto.bat - counter camera ki LIVE video app ko (live-cam.js, WebRTC), ruk jaye to dobara
cd /d C:\khata-sync
:loop
node live-cam.js >> live-cam-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
ping -n 31 127.0.0.1 >nul
goto loop
