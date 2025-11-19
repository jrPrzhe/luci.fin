# Load Testing Guide for Finance Manager

This directory contains load testing scripts to simulate high user traffic and test system stability.

## 📋 Overview

The load testing setup uses **Locust**, a Python-based load testing tool that allows you to:
- Simulate thousands of concurrent users
- Test different load scenarios
- Monitor response times and failure rates
- Identify bottlenecks and performance issues

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd load_testing
pip install -r requirements.txt
```

### 2. Configure Target URL

Set the target URL in the environment or modify `locustfile.py`:

```bash
# Windows PowerShell
$env:LOCUST_HOST="http://localhost:8000"

# Linux/Mac
export LOCUST_HOST="http://localhost:8000"
```

Or use the `--host` parameter when running Locust.

### 3. Run Load Tests

#### Basic Test (Web UI)
```bash
locust -f locustfile.py --host=http://localhost:8000
```

Then open your browser to `http://localhost:8089` to configure and start the test.

#### Command Line Test (No UI)
```bash
# Run with 100 users, spawn rate 10 users/second, for 5 minutes
locust -f locustfile.py --host=http://localhost:8000 --headless -u 100 -r 10 -t 5m
```

#### Different User Types
```bash
# Only regular users
locust -f locustfile.py --host=http://localhost:8000 -u 50 -r 5

# Only read-only users
locust -f locustfile.py:ReadOnlyUser --host=http://localhost:8000 -u 30 -r 3
```

## 📊 Test Scenarios

### Scenario 1: Light Load (Current Usage)
Simulates ~10-20 concurrent users:
```bash
locust -f locustfile.py --host=http://localhost:8000 --headless -u 20 -r 2 -t 10m
```

### Scenario 2: Medium Load
Simulates ~50-100 concurrent users:
```bash
locust -f locustfile.py --host=http://localhost:8000 --headless -u 100 -r 10 -t 10m
```

### Scenario 3: High Load
Simulates ~200-500 concurrent users:
```bash
locust -f locustfile.py --host=http://localhost:8000 --headless -u 500 -r 20 -t 15m
```

### Scenario 4: Stress Test
Simulates ~1000+ concurrent users to find breaking point:
```bash
locust -f locustfile.py --host=http://localhost:8000 --headless -u 1000 -r 50 -t 20m
```

### Scenario 5: Spike Test
Simulates sudden traffic spike:
```bash
locust -f locustfile.py --host=http://localhost:8000 --headless -u 200 -r 200 -t 2m
```

## 📈 Monitoring Results

### Web UI Dashboard
When running Locust with UI (default), you'll see:
- **Real-time statistics**: Requests per second, response times, failure rates
- **Charts**: Response time distribution, requests over time
- **Failures**: List of failed requests with error details
- **Download reports**: CSV/HTML reports

### Command Line Output
When running headless, Locust outputs:
- Current statistics every 10 seconds
- Final summary at the end

### Export Results
```bash
# Generate HTML report
locust -f locustfile.py --host=http://localhost:8000 --headless -u 100 -r 10 -t 5m --html report.html

# Generate CSV reports
locust -f locustfile.py --host=http://localhost:8000 --headless -u 100 -r 10 -t 5m --csv results
```

## 🎯 What Gets Tested

The load test simulates realistic user behavior:

1. **Authentication** (Register/Login)
2. **View Dashboard** - Most common action
3. **View Accounts** - Check account balances
4. **View Categories** - Browse expense categories
5. **Create Transactions** - Add income/expenses
6. **View Analytics** - Check reports and statistics
7. **View Goals** - Check financial goals
8. **Create Accounts** - Add new accounts
9. **View Shared Budgets** - Check shared budgets
10. **AI Assistant** - Interact with AI features
11. **Health Checks** - System health monitoring

## ⚙️ Configuration

### Adjust User Behavior

Edit `locustfile.py` to modify:
- **Wait times**: `wait_time = between(1, 3)` - Time between requests
- **Task weights**: `@task(5)` - Higher number = more frequent
- **User types**: Create custom user classes for different behaviors

### Test Different Endpoints

Add new `@task` methods to test specific endpoints:

```python
@task(2)
def my_custom_endpoint(self):
    self.client.get(
        "/api/v1/my-endpoint",
        headers=self.get_headers(),
        name="My Custom Endpoint"
    )
```

## 🔍 Interpreting Results

### Key Metrics to Watch

1. **Response Time (ms)**
   - < 200ms: Excellent
   - 200-500ms: Good
   - 500-1000ms: Acceptable
   - > 1000ms: Needs optimization

2. **Requests per Second (RPS)**
   - Higher is better
   - Should remain stable under load

3. **Failure Rate**
   - Should be < 1%
   - Monitor for 5xx errors (server errors)
   - Monitor for 429 errors (rate limiting)

4. **Response Time Percentiles**
   - 50th percentile (median): Typical user experience
   - 95th percentile: Most users experience
   - 99th percentile: Worst case for most users

### Red Flags

- **Increasing response times** as load increases
- **High failure rates** (> 5%)
- **Database connection errors**
- **Memory leaks** (monitor server resources)
- **Rate limiting** (429 errors) - may need to adjust limits

## 🛠️ Troubleshooting

### Connection Refused
- Ensure backend is running
- Check the host URL is correct
- Verify firewall settings

### Authentication Failures
- Check if test users are being created properly
- Verify JWT token generation is working
- Check database connectivity

### High Failure Rates
- Check backend logs for errors
- Monitor database performance
- Check Redis connection (if used)
- Verify rate limiting settings

### Slow Response Times
- Check database query performance
- Monitor CPU and memory usage
- Check for N+1 query problems
- Verify caching is working

## 📝 Best Practices

1. **Start Small**: Begin with light load and gradually increase
2. **Monitor Resources**: Watch CPU, memory, and database during tests
3. **Test Realistic Scenarios**: Simulate actual user behavior patterns
4. **Run During Off-Peak**: Don't test on production during business hours
5. **Document Results**: Keep records of test results for comparison
6. **Test Regularly**: Run load tests after major changes

## 🔗 Additional Resources

- [Locust Documentation](https://docs.locust.io/)
- [Performance Testing Best Practices](https://k6.io/docs/test-types/load-testing/)
- [FastAPI Performance Tips](https://fastapi.tiangolo.com/deployment/performance/)

## 📊 Example Test Results

After running a test, you should see output like:

```
Type     Name                          # reqs      # fails  |     Avg     Min     Max  |  Median   req/s
--------|------------------------------|-------|-------------|-------|-------|-------|-------|----------
GET      View Dashboard                5000    0(0.00%)      |     45     12    234  |     38   50.2
POST     Create Transaction            1000    2(0.20%)      |     78     23    456  |     65   10.1
GET      View Accounts                 2000    0(0.00%)      |     32     10    189  |     28   20.1
--------|------------------------------|-------|-------------|-------|-------|-------|-------|----------
         Aggregated                    8000    2(0.03%)      |     48     10    456  |     42   80.4
```

## 🚨 Important Notes

- **Don't run load tests on production** without proper monitoring and approval
- **Start with lower user counts** and gradually increase
- **Monitor your database** - high load can impact DB performance
- **Check rate limiting** - you may hit rate limits during testing
- **Use separate test data** - don't pollute production data





