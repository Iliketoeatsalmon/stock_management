@echo off
setlocal

REM Start Nginx only if it is not already running
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I "nginx.exe" >NUL
if %ERRORLEVEL%==0 exit /b 0

cd /d C:\nginx-1.28.0
"C:\nginx-1.28.0\nginx.exe"
