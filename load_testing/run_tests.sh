#!/bin/bash

# Load Testing Script Runner
# Usage: ./run_tests.sh [scenario]

SCENARIO=${1:-light}
HOST=${LOCUST_HOST:-http://localhost:8000}

echo "=========================================="
echo "Finance Manager Load Testing"
echo "=========================================="
echo "Scenario: $SCENARIO"
echo "Target: $HOST"
echo "=========================================="
echo ""

case $SCENARIO in
    light)
        echo "Running Light Load Test (20 users, 2 spawn rate, 10 minutes)..."
        locust -f locustfile.py --host=$HOST --headless -u 20 -r 2 -t 10m --html reports/light_load.html --csv reports/light_load
        ;;
    medium)
        echo "Running Medium Load Test (100 users, 10 spawn rate, 10 minutes)..."
        locust -f locustfile.py --host=$HOST --headless -u 100 -r 10 -t 10m --html reports/medium_load.html --csv reports/medium_load
        ;;
    high)
        echo "Running High Load Test (500 users, 20 spawn rate, 15 minutes)..."
        locust -f locustfile.py --host=$HOST --headless -u 500 -r 20 -t 15m --html reports/high_load.html --csv reports/high_load
        ;;
    stress)
        echo "Running Stress Test (1000 users, 50 spawn rate, 20 minutes)..."
        locust -f locustfile.py --host=$HOST --headless -u 1000 -r 50 -t 20m --html reports/stress_test.html --csv reports/stress_test
        ;;
    spike)
        echo "Running Spike Test (200 users, 200 spawn rate, 2 minutes)..."
        locust -f locustfile.py --host=$HOST --headless -u 200 -r 200 -t 2m --html reports/spike_test.html --csv reports/spike_test
        ;;
    interactive)
        echo "Starting Locust Web UI..."
        locust -f locustfile.py --host=$HOST
        ;;
    *)
        echo "Unknown scenario: $SCENARIO"
        echo "Available scenarios: light, medium, high, stress, spike, interactive"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Test completed! Check reports/ directory"
echo "=========================================="





