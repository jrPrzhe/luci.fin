Write-Host "Creating test user..." -ForegroundColor Green
Set-Location backend

if (-not (Test-Path venv)) {
    Write-Host "Virtual environment not found. Please run start-backend-simple.ps1 first." -ForegroundColor Red
    exit 1
}

& .\venv\Scripts\Activate.ps1
python create_test_user.py

















