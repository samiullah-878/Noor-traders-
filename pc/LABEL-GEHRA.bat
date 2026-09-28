@echo off
title LABEL GEHRA - barcode ki chhapai gehri karo
cd /d C:\khata-sync 2>nul || (echo C:\khata-sync nahi mila & pause & exit /b)
where node >nul 2>&1 || (echo Node.js nahi mila & pause & exit /b)
echo ================================================
echo   Barcode label ki chhapai - kitni gehri?
echo ================================================
echo   Pehle: density 8, speed 4  (density 0 se 15)
echo.
echo   1 = thora gehra    density 11, speed 3
echo   2 = gehra          density 13, speed 3   (salah)
echo   3 = bohat gehra    density 15, speed 2
echo   0 = wapas pehle jaisa  density 8, speed 4
echo.
choice /c 1230 /n /m "Kaunsa? 1 / 2 / 3 / 0 : "
set D=11
set S=3
if errorlevel 2 set D=13
if errorlevel 2 set S=3
if errorlevel 3 set D=15
if errorlevel 3 set S=2
if errorlevel 4 set D=8
if errorlevel 4 set S=4
powershell -NoP -C "$f='C:\khata-sync\label-settings.json';$o=[ordered]@{};if(Test-Path $f){try{$j=Get-Content $f -Raw | ConvertFrom-Json;$j.PSObject.Properties | ForEach-Object {$o[$_.Name]=$_.Value}}catch{}};$o['density']=[int]'%D%';$o['speed']=[int]'%S%';[IO.File]::WriteAllText($f,($o | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))"
if errorlevel 1 goto fail
echo.
echo [OK] Setting lag gayi: density %D%, speed %S%. Chalti hui label script agle label se khud yahi lagayegi.
echo Ab ek TEST label chhap raha hoon - dekh lein gehra hua ya nahi...
node label-print.js --test
echo.
echo Zyada gehra ho kar barcode phail jaye / scan na ho to yahi file dobara chala kar 1 ya 0 chunein.
goto end
:fail
echo [X] label-settings.json nahi likhi gayi - screenshot bhejein.
:end
echo.
pause
