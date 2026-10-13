@echo off
title LABEL JAANCH - Urdu ke saath / baghair
cd /d C:\khata-sync 2>nul || (echo C:\khata-sync nahi mila & pause & exit /b)
where node >nul 2>&1 || (echo Node.js nahi mila & pause & exit /b)
echo ================================================
echo   Label jaanch: 4 qatar (12 label) chhapengi
echo   U-1..6 = Urdu naam ke SAATH
echo   N-1..6 = Urdu naam ke BAGHAIR
echo ================================================
node label-print.js --test-mix
echo.
echo Labels ki photo bhej dein - kaun si qatar kharab nikli (U ya N).
pause
