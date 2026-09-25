@echo off
REM sale-auto.bat — app ki sale POS mein daalne wali script chalata hai, ruk jaye to dobara
cd /d C:\khata-sync
:loop
node sale-post.js >> sale-log.txt 2>&1
if errorlevel 3 if not errorlevel 4 exit /b
timeout /t 30 /nobreak >nul
goto loop
