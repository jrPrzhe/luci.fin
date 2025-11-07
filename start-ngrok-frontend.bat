@echo off
echo ========================================
echo Starting ngrok tunnel for Frontend
echo ========================================
echo.
echo Frontend should be running on http://localhost:5173
echo.
echo Press Ctrl+C to stop ngrok
echo.

REM Check if ngrok exists in project directory
cd /d "%~dp0"
if exist ngrok.exe (
    echo Found ngrok.exe in project directory
    echo Starting tunnel to http://localhost:5173...
    echo.
    ngrok.exe http 5173
    goto :end
)

REM Check if ngrok is in PATH
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting tunnel to http://localhost:5173...
    echo.
    ngrok http 5173
    goto :end
)

REM Not found
echo ERROR: ngrok not found!
echo.
echo Please run install-ngrok.bat first
echo.
pause
exit /b 1

:end








