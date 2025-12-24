@echo off
setlocal
cd /d C:\stock_management\backend

REM Start FastAPI backend (production, no reload)
C:\stock_management\backend\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
