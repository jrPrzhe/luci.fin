# Load Testing Script Runner for Windows PowerShell
# Usage: .\run_tests.ps1 [scenario]

param(
    [string]$Scenario = "light",
    [string]$Host = $env:LOCUST_HOST
)

if (-not $Host) {
    $Host = "http://localhost:8000"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Finance Manager Load Testing" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Scenario: $Scenario" -ForegroundColor Yellow
Write-Host "Target: $Host" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Create reports directory if it doesn't exist
if (-not (Test-Path "reports")) {
    New-Item -ItemType Directory -Path "reports" | Out-Null
}

switch ($Scenario) {
    "light" {
        Write-Host "Running Light Load Test (20 users, 2 spawn rate, 10 minutes)..." -ForegroundColor Green
        locust -f locustfile.py --host=$Host --headless -u 20 -r 2 -t 10m --html reports/light_load.html --csv reports/light_load
    }
    "medium" {
        Write-Host "Running Medium Load Test (100 users, 10 spawn rate, 10 minutes)..." -ForegroundColor Green
        locust -f locustfile.py --host=$Host --headless -u 100 -r 10 -t 10m --html reports/medium_load.html --csv reports/medium_load
    }
    "high" {
        Write-Host "Running High Load Test (500 users, 20 spawn rate, 15 minutes)..." -ForegroundColor Green
        locust -f locustfile.py --host=$Host --headless -u 500 -r 20 -t 15m --html reports/high_load.html --csv reports/high_load
    }
    "stress" {
        Write-Host "Running Stress Test (1000 users, 50 spawn rate, 20 minutes)..." -ForegroundColor Yellow
        Write-Host "WARNING: This is a heavy load test!" -ForegroundColor Red
        locust -f locustfile.py --host=$Host --headless -u 1000 -r 50 -t 20m --html reports/stress_test.html --csv reports/stress_test
    }
    "spike" {
        Write-Host "Running Spike Test (200 users, 200 spawn rate, 2 minutes)..." -ForegroundColor Green
        locust -f locustfile.py --host=$Host --headless -u 200 -r 200 -t 2m --html reports/spike_test.html --csv reports/spike_test
    }
    "interactive" {
        Write-Host "Starting Locust Web UI..." -ForegroundColor Green
        Write-Host "Open http://localhost:8089 in your browser" -ForegroundColor Cyan
        locust -f locustfile.py --host=$Host
    }
    default {
        Write-Host "Unknown scenario: $Scenario" -ForegroundColor Red
        Write-Host "Available scenarios: light, medium, high, stress, spike, interactive" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test completed! Check reports/ directory" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan




