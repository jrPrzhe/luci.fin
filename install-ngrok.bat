@echo off
echo ========================================
echo Installing ngrok for Windows
echo ========================================
echo.

cd /d "%~dp0"

if exist ngrok.exe (
    echo ngrok.exe already exists!
    echo.
    pause
    exit /b 0
)

echo Downloading ngrok...
echo.

powershell -Command "& { $ErrorActionPreference = 'Stop'; try { Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile 'ngrok.zip' -UseBasicParsing; Write-Host 'Download complete!'; Expand-Archive -Path 'ngrok.zip' -DestinationPath '.' -Force; Remove-Item 'ngrok.zip' -Force; Write-Host 'ngrok installed successfully!'; } catch { Write-Host 'ERROR:' $_.Exception.Message; Write-Host 'Please download manually from: https://ngrok.com/download'; exit 1 } }"

if exist ngrok.exe (
    echo.
    echo ========================================
    echo ngrok installed successfully!
    echo ========================================
    echo.
    echo To configure authtoken, run:
    echo   ngrok.exe config add-authtoken YOUR_TOKEN
    echo.
    echo Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken
    echo.
) else (
    echo.
    echo ERROR: ngrok.exe not found!
    echo Please download manually from: https://ngrok.com/download
    echo.
)

pause

