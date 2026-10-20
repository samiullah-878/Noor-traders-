@echo off
title rack-bharo - rack bharo (godam se lao), har 1 minute
cd /d C:\khata-sync
:loop
node rack-bharo.js >> rack-log.txt 2>&1
ping -n 61 127.0.0.1 >nul
goto loop
