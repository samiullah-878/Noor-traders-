@echo off
title pos-sales-dekho (POS ke aaj ke bills -> app)
cd /d C:\khata-sync
:loop
node pos-sales-dekho.js
echo.
echo [%date% %time%] pos-sales-dekho band ho gaya - 30 second baad dobara...
timeout /t 30 /nobreak >nul
goto loop
