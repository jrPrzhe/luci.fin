Write-Host "Starting Backend with SQLite (no PostgreSQL/Redis required)..." -ForegroundColor Green
Set-Location backend

if (-not (Test-Path venv)) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

Write-Host "Running migrations (will create finance.db)..." -ForegroundColor Yellow
alembic upgrade head

Write-Host "Starting server on http://localhost:8000..." -ForegroundColor Green
Write-Host "Database: SQLite (finance.db)" -ForegroundColor Cyan
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

