@echo off
title irep-today - item report ka AAJ ka data, har 10 minute
cd /d C:\khata-sync
:loop
node irep-today.js >> irep-today-log.txt 2>&1
ping -n 601 127.0.0.1 >nul
goto loop
