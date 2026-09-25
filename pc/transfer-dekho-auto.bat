@echo off
title transfer-dekho (POS transfer -> app)
cd /d C:\khata-sync
:loop
node transfer-dekho.js
echo.
echo [%date% %time%] transfer-dekho band ho gaya - 30 second baad dobara...
timeout /t 30 /nobreak >nul
goto loop
