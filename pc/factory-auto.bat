@echo off
title factory-post (Factory batch -> POS stock + label)
cd /d C:\khata-sync
:loop
node factory-post.js
echo.
echo [%date% %time%] factory-post band ho gaya - 30 second baad dobara...
ping -n 31 127.0.0.1 >nul
goto loop
