@echo off
title ginti-post (App ginti -> POS Adjustment)
cd /d C:\khata-sync
:loop
node ginti-post.js
echo.
echo [%date% %time%] ginti-post band ho gaya - 30 second baad dobara...
ping -n 31 127.0.0.1 >nul
goto loop
