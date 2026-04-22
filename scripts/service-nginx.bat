@echo off
setlocal

:loop
REM Start Nginx only if it is not already running
tasklist /FI "IMAGENAME eq nginx.exe" 2>NUL | find /I "nginx.exe" >NUL
if %ERRORLEVEL%==0 (
  timeout /t 5 /nobreak >NUL
  goto loop
)

cd /d C:\nginx-1.28.0
"C:\nginx-1.28.0\nginx.exe"
timeout /t 5 /nobreak >NUL
goto loop
