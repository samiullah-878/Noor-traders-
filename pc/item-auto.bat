@echo off
title item-post (Blue Khata -> POS items)
cd /d C:\khata-sync
:loop
node item-post.js
echo.
echo [%date% %time%] item-post band ho gaya - 30 second baad dobara...
ping -n 31 127.0.0.1 >nul
goto loop
