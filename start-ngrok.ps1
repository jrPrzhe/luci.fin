Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting ngrok tunnel for HTTPS backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure backend is running on https://localhost:8443" -ForegroundColor Yellow
Write-Host ""

# Check if ngrok exists in project directory first
$ngrokPath = Join-Path $PSScriptRoot "ngrok.exe"

if (Test-Path $ngrokPath) {
    Write-Host "Found ngrok.exe in project directory" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starting ngrok tunnel to HTTPS backend..." -ForegroundColor Green
    Write-Host "Backend: https://localhost:8443" -ForegroundColor Yellow
    Write-Host "Web interface: http://127.0.0.1:4040" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    & $ngrokPath http https://localhost:8443 --host-header=localhost:8443
    exit 0
}

# Check if ngrok is in PATH
$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
if ($ngrok) {
    Write-Host "Starting ngrok tunnel to HTTPS backend..." -ForegroundColor Green
    Write-Host "Backend: https://localhost:8443" -ForegroundColor Yellow
    Write-Host "Web interface: http://127.0.0.1:4040" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    ngrok http https://localhost:8443 --host-header=localhost:8443
    exit 0
}

# Not found
Write-Host "ERROR: ngrok not found!" -ForegroundColor Red
Write-Host ""
Write-Host "Please:" -ForegroundColor Yellow
Write-Host "  1. Run install-ngrok.ps1 to install ngrok in project directory, OR" -ForegroundColor White
Write-Host "  2. Download from: https://ngrok.com/download and place ngrok.exe here, OR" -ForegroundColor White
Write-Host "  3. Add ngrok.exe to PATH" -ForegroundColor White
Write-Host ""
pause
exit 1

