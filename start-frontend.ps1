Write-Host "Starting Frontend..." -ForegroundColor Green
Set-Location frontend

if (-not (Test-Path node_modules)) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting dev server on http://localhost:5173..." -ForegroundColor Green
npm run dev

