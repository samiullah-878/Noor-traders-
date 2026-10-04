@echo off
title transfer-dekho (POS transfer -> app)
cd /d C:\khata-sync
:loop
node transfer-dekho.js
echo.
echo [%date% %time%] transfer-dekho band ho gaya - 30 second baad dobara...
ping -n 31 127.0.0.1 >nul
goto loop
