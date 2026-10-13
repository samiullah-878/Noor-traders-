@echo off
title LABEL NAAP - teeno label par dabba
cd /d C:\khata-sync 2>nul || (echo C:\khata-sync nahi mila & pause & exit /b)
where node >nul 2>&1 || (echo Node.js nahi mila & pause & exit /b)
echo Abhi ki setting:
node label-print.js --show-settings
echo.
echo Ek qatar chhap raha hoon - har label par DABBA (box) + naap...
node label-print.js --test
echo.
echo Dekhein: teeno dabbe poore label ke andar? 3rd dabba kata / khali ho to photo bhejein.
pause
