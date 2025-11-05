@echo off
echo ========================================
echo Starting ngrok tunnel for HTTPS backend
echo ========================================
echo.
echo Make sure backend is running on https://localhost:8443
echo.
echo Press Ctrl+C to stop ngrok
echo.
pause

REM Check if ngrok exists in project directory
cd /d "%~dp0"
if exist ngrok.exe (
    echo Found ngrok.exe in project directory
    echo.
    echo Note: If backend uses HTTPS, use: ngrok http https://localhost:8443
    echo.
    ngrok.exe http https://localhost:8443 --host-header=localhost:8443
    goto :end
)

REM Check if ngrok is in PATH
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting ngrok tunnel...
    echo Note: Tunneling to HTTPS backend on port 8443
    echo.
    ngrok http https://localhost:8443 --host-header=localhost:8443
    goto :end
)

REM Not found
echo ERROR: ngrok not found!
echo.
echo Please:
echo   1. Run install-ngrok.bat to install ngrok in project directory, OR
echo   2. Download from: https://ngrok.com/download and place ngrok.exe here, OR
echo   3. Add ngrok.exe to PATH
echo.
pause
exit /b 1

:end

