Write-Host "Starting Backend with HTTPS..." -ForegroundColor Green
Set-Location backend

# Check if certificate exists
if (-not (Test-Path "localhost.crt") -or -not (Test-Path "localhost.key")) {
    Write-Host "SSL certificate not found!" -ForegroundColor Yellow
    Write-Host "Creating certificate..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try OpenSSL first
    $openssl = Get-Command openssl -ErrorAction SilentlyContinue
    if ($openssl) {
        Write-Host "Using OpenSSL..." -ForegroundColor Cyan
        openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
        Write-Host "Certificate created!" -ForegroundColor Green
    } else {
        # Fallback to PowerShell
        Write-Host "OpenSSL not found. Using PowerShell method..." -ForegroundColor Yellow
        Write-Host "Note: This will create .pfx file. Convert to .crt/.key with OpenSSL if needed." -ForegroundColor Yellow
        
        try {
            $cert = New-SelfSignedCertificate `
                -DnsName "localhost" `
                -CertStoreLocation "cert:\CurrentUser\My" `
                -FriendlyName "Finance Manager Local Dev" `
                -NotAfter (Get-Date).AddYears(1) `
                -KeyAlgorithm RSA `
                -KeyLength 2048 `
                -KeyUsage DigitalSignature, KeyEncipherment
            
            $password = ConvertTo-SecureString -String "finance123" -Force -AsPlainText
            Export-PfxCertificate -Cert $cert -FilePath "localhost.pfx" -Password $password
            
            Write-Host "Certificate created as localhost.pfx" -ForegroundColor Green
            Write-Host "Converting to .crt and .key format..." -ForegroundColor Yellow
            
            # Convert PFX to CRT and KEY using Python
            python convert_pfx_to_crt.py localhost.pfx finance123
            
            if ($LASTEXITCODE -eq 0 -and (Test-Path "localhost.crt") -and (Test-Path "localhost.key")) {
                Write-Host "✅ Certificate converted successfully!" -ForegroundColor Green
                Remove-Item "localhost.pfx" -Force
            } else {
                Write-Host "⚠️  Could not convert automatically. Install OpenSSL and run:" -ForegroundColor Yellow
                Write-Host "   openssl pkcs12 -in localhost.pfx -nocerts -nodes -out localhost.key -passin pass:finance123" -ForegroundColor Cyan
                Write-Host "   openssl pkcs12 -in localhost.pfx -clcerts -nokeys -out localhost.crt -passin pass:finance123" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "Error creating certificate: $_" -ForegroundColor Red
            Write-Host "Please run create_cert_simple.bat manually" -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host ""
}

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt -q

Write-Host "Running migrations..." -ForegroundColor Yellow
python -m alembic upgrade head

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting HTTPS Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend: https://localhost:8443" -ForegroundColor Green
Write-Host "API Docs: https://localhost:8443/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Browser will show security warning - this is normal!" -ForegroundColor Yellow
Write-Host ""

python run_https.py

