@echo off
echo Creating self-signed certificate for localhost...
echo.

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo OpenSSL not found! Please install OpenSSL first.
    echo Download from: https://slproweb.com/products/Win32OpenSSL.html
    echo Or use: choco install openssl
    pause
    exit /b 1
)

echo Generating private key...
openssl genrsa -out localhost.key 2048

echo.
echo Generating certificate...
openssl req -new -x509 -key localhost.key -out localhost.crt -days 365 -subj "/CN=localhost"

echo.
echo Certificate created successfully!
echo Files:
echo   - localhost.key (private key)
echo   - localhost.crt (certificate)
echo.
echo You can now run the backend with HTTPS.
pause

