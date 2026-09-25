@echo off
title item-post (Blue Khata -> POS items)
cd /d C:\khata-sync
:loop
node item-post.js
echo.
echo [%date% %time%] item-post band ho gaya - 30 second baad dobara...
timeout /t 30 /nobreak >nul
goto loop
