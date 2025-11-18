# Production Load Testing Script
# Usage: .\run_tests_prod.ps1 [scenario]

param(
    [string]$Scenario = "light",
    [string]$TargetHost = $env:LOCUST_HOST
)

if (-not $TargetHost) {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "ERROR: Production URL not set!" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set LOCUST_HOST environment variable:" -ForegroundColor Yellow
    Write-Host '  $env:LOCUST_HOST="https://lucifin-production.up.railway.app"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or specify URL when running:" -ForegroundColor Yellow
    Write-Host '  .\run_tests_prod.ps1 light -TargetHost "https://lucifin-production.up.railway.app"' -ForegroundColor Cyan
    exit 1
}

if ($TargetHost -notmatch "https://" -and $TargetHost -notmatch "http://") {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "WARNING: URL must start with http:// or https://" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "PRODUCTION LOAD TESTING" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "You are about to run load test on PRODUCTION!" -ForegroundColor Red
Write-Host ""
Write-Host "Make sure:" -ForegroundColor Yellow
Write-Host "  [OK] Team approval received" -ForegroundColor White
Write-Host "  [OK] Monitoring is set up" -ForegroundColor White
Write-Host "  [OK] Logs are available" -ForegroundColor White
Write-Host "  [OK] Not peak hours" -ForegroundColor White
Write-Host "  [OK] Rollback plan exists" -ForegroundColor White
Write-Host ""
Write-Host "Target: $TargetHost" -ForegroundColor Cyan
Write-Host "Scenario: $Scenario" -ForegroundColor Cyan
Write-Host ""

if ($Scenario -eq "stress" -or $Scenario -eq "spike") {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "AGGRESSIVE TEST" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "You selected aggressive scenario: $Scenario" -ForegroundColor Yellow
    Write-Host "This test may create high load on the system!" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Are you sure? Type 'YES' to continue"
    if ($confirm -ne "YES") {
        Write-Host "Test cancelled." -ForegroundColor Green
        exit 0
    }
}

Write-Host "Checking server availability..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-WebRequest -Uri "$TargetHost/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($healthCheck.StatusCode -eq 200) {
        Write-Host "[OK] Server is available" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Server returned status: $($healthCheck.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Failed to connect to server: $_" -ForegroundColor Red
    Write-Host "Check URL and server availability before continuing." -ForegroundColor Yellow
    $continue = Read-Host "Continue despite error? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host ""
Write-Host "Starting test in 5 seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to cancel" -ForegroundColor Yellow
Start-Sleep -Seconds 5

if (-not (Test-Path "reports")) {
    New-Item -ItemType Directory -Path "reports" | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$reportPrefix = "prod_${Scenario}_${timestamp}"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting Load Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

switch ($Scenario) {
    "light" {
        Write-Host "Scenario: Light Load" -ForegroundColor Green
        Write-Host "Users: 10" -ForegroundColor White
        Write-Host "Spawn rate: 1 user/sec" -ForegroundColor White
        Write-Host "Duration: 5 minutes" -ForegroundColor White
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost --headless -u 10 -r 1 -t 5m --html "reports/${reportPrefix}.html" --csv "reports/$reportPrefix"
    }
    "medium" {
        Write-Host "Scenario: Medium Load" -ForegroundColor Yellow
        Write-Host "Users: 50" -ForegroundColor White
        Write-Host "Spawn rate: 5 users/sec" -ForegroundColor White
        Write-Host "Duration: 10 minutes" -ForegroundColor White
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost --headless -u 50 -r 5 -t 10m --html "reports/${reportPrefix}.html" --csv "reports/$reportPrefix"
    }
    "high" {
        Write-Host "Scenario: High Load" -ForegroundColor Yellow
        Write-Host "Users: 200" -ForegroundColor White
        Write-Host "Spawn rate: 10 users/sec" -ForegroundColor White
        Write-Host "Duration: 15 minutes" -ForegroundColor White
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost --headless -u 200 -r 10 -t 15m --html "reports/${reportPrefix}.html" --csv "reports/$reportPrefix"
    }
    "stress" {
        Write-Host "Scenario: Stress Test" -ForegroundColor Red
        Write-Host "Users: 500" -ForegroundColor White
        Write-Host "Spawn rate: 20 users/sec" -ForegroundColor White
        Write-Host "Duration: 20 minutes" -ForegroundColor White
        Write-Host ""
        Write-Host "WARNING: This is a very aggressive test!" -ForegroundColor Red
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost --headless -u 500 -r 20 -t 20m --html "reports/${reportPrefix}.html" --csv "reports/$reportPrefix"
    }
    "spike" {
        Write-Host "Scenario: Spike Test" -ForegroundColor Red
        Write-Host "Users: 100" -ForegroundColor White
        Write-Host "Spawn rate: 100 users/sec (instant)" -ForegroundColor White
        Write-Host "Duration: 2 minutes" -ForegroundColor White
        Write-Host ""
        Write-Host "WARNING: Sudden load spike!" -ForegroundColor Red
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost --headless -u 100 -r 100 -t 2m --html "reports/${reportPrefix}.html" --csv "reports/$reportPrefix"
    }
    "interactive" {
        Write-Host "Interactive Mode" -ForegroundColor Green
        Write-Host "Open http://localhost:8089 in browser" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "IMPORTANT: Start with minimal values!" -ForegroundColor Yellow
        Write-Host "Recommended to start with 5-10 users" -ForegroundColor Yellow
        Write-Host ""
        python -m locust -f locustfile.py --host=$TargetHost
    }
    default {
        Write-Host "Unknown scenario: $Scenario" -ForegroundColor Red
        Write-Host "Available scenarios: light, medium, high, stress, spike, interactive" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Reports saved in reports/ directory:" -ForegroundColor Green
Write-Host "  HTML: reports/${reportPrefix}.html" -ForegroundColor Cyan
Write-Host "  CSV:  reports/${reportPrefix}_*.csv" -ForegroundColor Cyan
Write-Host ""
Write-Host "To analyze results:" -ForegroundColor Yellow
Write-Host "  python analyze_results.py reports/${reportPrefix}_stats.csv" -ForegroundColor Cyan
Write-Host ""
Write-Host "Don't forget to check system metrics!" -ForegroundColor Yellow
Write-Host ""

