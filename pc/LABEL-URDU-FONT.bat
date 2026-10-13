@echo off
title LABEL - Urdu FONT printer mein bhejo + test
cd /d C:\khata-sync 2>nul || (echo C:\khata-sync nahi mila & pause & exit /b)
where node >nul 2>&1 || (echo Node.js nahi mila & pause & exit /b)
powershell -NoP -C "$f='C:\khata-sync\label-settings.json';$o=[ordered]@{};if(Test-Path $f){try{$j=Get-Content $f -Raw | ConvertFrom-Json;$j.PSObject.Properties | ForEach-Object {$o[$_.Name]=$_.Value}}catch{}};$o['urdu']=$true;$o['urduMode']='ttf';[IO.File]::WriteAllText($f,($o | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))"
if errorlevel 1 (echo [X] setting nahi likhi gayi - screenshot bhejein & pause & exit /b)
echo [OK] Urdu ab FONT (TEXT) se.
node label-print.js --send-font
echo.
echo Photo bhej dein. Wapas tasveer wala Urdu: LABEL-URDU-TASVEER.bat
pause
