@echo off
echo ========================================
echo Creating Self-Signed SSL Certificate
echo ========================================
echo.

REM Simple method using OpenSSL if available
where openssl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using OpenSSL...
    echo.
    openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
    echo.
    echo ✅ Certificate created successfully!
    echo    - localhost.key (private key)
    echo    - localhost.crt (certificate)
    echo.
    echo You can now run: python run_https.py
    pause
    exit /b 0
)

REM Alternative: Use PowerShell
echo OpenSSL not found. Trying PowerShell method...
echo.

powershell -Command "& { $ErrorActionPreference = 'Stop'; try { $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(1); $pwd = ConvertTo-SecureString -String 'finance123' -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath 'localhost.pfx' -Password $pwd; Write-Host 'Certificate created as localhost.pfx. Converting...'; } catch { Write-Host 'Error:' $_.Exception.Message; exit 1 } }"

if exist localhost.pfx (
    echo.
    echo ✅ Certificate created as localhost.pfx
    echo.
    echo To use with uvicorn, convert to .crt and .key:
    echo   1. Install OpenSSL
    echo   2. Run:
    echo      openssl pkcs12 -in localhost.pfx -nocerts -nodes -out localhost.key -passin pass:finance123
    echo      openssl pkcs12 -in localhost.pfx -clcerts -nokeys -out localhost.crt -passin pass:finance123
    echo.
    echo Or download OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html
) else (
    echo.
    echo ❌ Could not create certificate automatically.
    echo.
    echo Please install OpenSSL and run:
    echo   openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
)

pause

