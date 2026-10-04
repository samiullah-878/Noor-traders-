@echo off
title sales-stats - POS ki 6 mahine ki bikri / purchase, har ghante
cd /d C:\khata-sync
REM KHATA-DOCTOR ab ise chalata hai - SALE-DATA.bat wala Startup launcher hatao taake do jagah se na chale
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\blue-khata-sale-data.bat" >nul 2>&1
:loop
node sales-stats.js >> sales-stats-log.txt 2>&1
ping -n 3601 127.0.0.1 >nul
goto loop
