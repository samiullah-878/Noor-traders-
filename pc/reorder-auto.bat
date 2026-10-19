@echo off
title reorder - mangwao (supplier se re-order), har 1 minute
cd /d C:\khata-sync
:loop
node reorder.js >> reorder-log.txt 2>&1
ping -n 61 127.0.0.1 >nul
goto loop
