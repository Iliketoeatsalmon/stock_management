@echo off
REM === Start FastAPI backend (no reload, production style) ===
cd /d C:\stock_management\backend

REM ถ้าเคยติดค้าง port 8000 จะไม่ทำให้ล่ม แต่กันไว้เฉย ๆ
REM taskkill /F /IM python.exe /FI "WINDOWTITLE eq uvicorn*"

REM ใช้ python จาก venv โดยตรง
C:\stock_management\backend\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000