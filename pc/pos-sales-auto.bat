@echo off
title pos-sales-dekho (POS ke aaj ke bills -> app)
cd /d C:\khata-sync
:loop
node pos-sales-dekho.js
echo.
echo [%date% %time%] pos-sales-dekho band ho gaya - 30 second baad dobara...
ping -n 31 127.0.0.1 >nul
goto loop
