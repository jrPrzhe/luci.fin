Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing ngrok for Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ngrokPath = "$PSScriptRoot\ngrok.exe"
$ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"

# Check if already installed
if (Test-Path $ngrokPath) {
    Write-Host "ngrok.exe already exists in project directory!" -ForegroundColor Green
    Write-Host "Path: $ngrokPath" -ForegroundColor Yellow
    Write-Host ""
    $useExisting = Read-Host "Use existing ngrok.exe? (Y/n)"
    if ($useExisting -eq "" -or $useExisting -eq "Y" -or $useExisting -eq "y") {
        Write-Host "Using existing ngrok.exe" -ForegroundColor Green
    } else {
        Remove-Item $ngrokPath -Force
    }
}

# Download if not exists
if (-not (Test-Path $ngrokPath)) {
    Write-Host "Downloading ngrok..." -ForegroundColor Yellow
    $zipPath = "$PSScriptRoot\ngrok.zip"
    
    try {
        Invoke-WebRequest -Uri $ngrokUrl -OutFile $zipPath -UseBasicParsing
        Write-Host "Download complete!" -ForegroundColor Green
        
        Write-Host "Extracting..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $PSScriptRoot -Force
        Remove-Item $zipPath -Force
        
        if (Test-Path $ngrokPath) {
            Write-Host "ngrok installed successfully!" -ForegroundColor Green
            Write-Host "Path: $ngrokPath" -ForegroundColor Yellow
        } else {
            Write-Host "ERROR: ngrok.exe not found after extraction!" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "ERROR downloading ngrok: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please download manually:" -ForegroundColor Yellow
        Write-Host "  1. Go to: https://ngrok.com/download" -ForegroundColor White
        Write-Host "  2. Download Windows version" -ForegroundColor White
        Write-Host "  3. Extract ngrok.exe to: $PSScriptRoot" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting up authtoken" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$authtoken = Read-Host "Enter your ngrok authtoken (get it from https://dashboard.ngrok.com/get-started/your-authtoken)"

if ($authtoken) {
    Write-Host "Configuring authtoken..." -ForegroundColor Yellow
    & $ngrokPath config add-authtoken $authtoken
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Authtoken configured successfully!" -ForegroundColor Green
    } else {
        Write-Host "Warning: Could not configure authtoken automatically" -ForegroundColor Yellow
        Write-Host "Run manually: .\ngrok.exe config add-authtoken YOUR_TOKEN" -ForegroundColor Cyan
    }
} else {
    Write-Host "Skipping authtoken setup" -ForegroundColor Yellow
    Write-Host "Configure later with: .\ngrok.exe config add-authtoken YOUR_TOKEN" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start ngrok tunnel, run:" -ForegroundColor Yellow
Write-Host "  .\ngrok.exe http 8443" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or use the script:" -ForegroundColor Yellow
Write-Host "  .\start-ngrok.bat" -ForegroundColor Cyan
Write-Host ""

