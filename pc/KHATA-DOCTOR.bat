@echo off
title KHATA-DOCTOR (PC ki scripts ka nigraan)
if not exist C:\khata-sync mkdir C:\khata-sync
cd /d C:\khata-sync
where node >nul 2>&1 || (echo. & echo Node.js install nahi hai - pehle https://nodejs.org se LTS install karein, phir dobara chalayein. & pause & exit /b)
if not exist doctor.js (
  echo doctor.js GitHub se aa raha hai...
  powershell -NoP -C "$u=@('https://raw.githubusercontent.com/samiullah-878/Noor-traders-/main/pc/','https://raw.githubusercontent.com/samiullah-878/Noor-traders/main/pc/');foreach($b in $u){try{Invoke-WebRequest ($b+'doctor.js') -OutFile doctor.js -UseBasicParsing;Invoke-WebRequest ($b+'manifest.json') -OutFile manifest.json -UseBasicParsing;break}catch{}}"
)
if not exist doctor.js (echo doctor.js nahi mili - internet check karein & pause & exit /b)
:loop
node doctor.js
if errorlevel 3 if not errorlevel 4 (echo KHATA-DOCTOR pehle se chal raha hai. & timeout /t 5 >nul & exit /b)
timeout /t 20 /nobreak >nul
goto loop
