@echo off
title larka-stats - larka sale report app ke liye, har 5 minute
cd /d C:\khata-sync
:loop
node larka-stats.js >> larka-log.txt 2>&1
ping -n 301 127.0.0.1 >nul
goto loop
