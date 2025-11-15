Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting ngrok tunnel for Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend should be running on http://localhost:5173" -ForegroundColor Yellow
Write-Host ""

# Check if ngrok exists in project directory
$ngrokPath = Join-Path $PSScriptRoot "ngrok.exe"

if (Test-Path $ngrokPath) {
    Write-Host "Found ngrok.exe in project directory" -ForegroundColor Green
    Write-Host "Starting tunnel to http://localhost:5173..." -ForegroundColor Green
    Write-Host "Web interface: http://127.0.0.1:4040" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    & $ngrokPath http 5173
    exit 0
}

# Check if ngrok is in PATH
$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
if ($ngrok) {
    Write-Host "Starting tunnel to http://localhost:5173..." -ForegroundColor Green
    Write-Host "Web interface: http://127.0.0.1:4040" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    ngrok http 5173
    exit 0
}

Write-Host "ERROR: ngrok not found!" -ForegroundColor Red
Write-Host "Please run install-ngrok.ps1 first" -ForegroundColor Yellow
pause
exit 1












