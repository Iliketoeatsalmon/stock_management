@echo off
setlocal
cd /d C:\stock_management\frontend

:restart
REM Start Next.js frontend (requires existing build in .next)
"C:\Program Files\nodejs\node.exe" "C:\stock_management\frontend\node_modules\next\dist\bin\next" start -p 3000
REM If the process exits, wait a bit and restart
timeout /t 5 /nobreak >NUL
goto restart
