@echo off
cd /d C:\stock_management\backend

REM เปิด virtualenv
call venv\Scripts\activate.bat

REM รัน FastAPI backend ด้วย Uvicorn
uvicorn main:app --host 127.0.0.1 --port 8000 --reload