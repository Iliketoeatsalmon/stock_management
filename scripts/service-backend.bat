@echo off
setlocal
cd /d C:\stock_management\backend

:restart
REM Start FastAPI backend (production, no reload)
C:\stock_management\backend\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
REM If the process exits, wait a bit and restart
timeout /t 5 /nobreak >NUL
goto restart
