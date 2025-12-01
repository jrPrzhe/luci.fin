# Quick Start Guide - Load Testing

## 🚀 Fast Setup (5 minutes)

### Step 1: Install Locust
```bash
cd load_testing
pip install -r requirements.txt
```

### Step 2: Start Your Backend
Make sure your Finance Manager backend is running:
```bash
# In backend directory
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 3: Run Your First Test

**Windows (PowerShell):**
```powershell
.\run_tests.ps1 light
```

**Linux/Mac:**
```bash
chmod +x run_tests.sh
./run_tests.sh light
```

**Or use Locust directly:**
```bash
locust -f locustfile.py --host=http://localhost:8000
```
Then open http://localhost:8089 in your browser.

## 📊 Test Scenarios

### 1. Light Load (Start Here!)
Simulates 20 concurrent users - safe for testing:
```bash
# Windows
.\run_tests.ps1 light

# Linux/Mac
./run_tests.sh light
```

### 2. Medium Load
Simulates 100 concurrent users:
```bash
.\run_tests.ps1 medium
```

### 3. High Load
Simulates 500 concurrent users:
```bash
.\run_tests.ps1 high
```

### 4. Interactive Mode (Recommended for First Time)
Use the web UI to control the test:
```bash
.\run_tests.ps1 interactive
# Then open http://localhost:8089
```

## 📈 Understanding Results

After running a test, check the `reports/` directory:
- **HTML file**: Visual report with charts
- **CSV files**: Raw data for analysis

### Key Metrics:
- **Response Time**: Should be < 500ms for most requests
- **Failure Rate**: Should be < 1%
- **RPS (Requests Per Second)**: Higher is better

## ⚠️ Important Notes

1. **Start with light load** - Don't overwhelm your system
2. **Monitor your backend** - Watch CPU, memory, database
3. **Check logs** - Look for errors in backend logs
4. **Test incrementally** - Gradually increase load

## 🆘 Troubleshooting

**Connection refused?**
- Make sure backend is running on port 8000
- Check the host URL in the command

**All requests failing?**
- Check backend logs for errors
- Verify database is running
- Check authentication is working

**Too slow?**
- Start with fewer users
- Check database performance
- Monitor server resources

## 📝 Next Steps

1. Run a light load test first
2. Review the results
3. Gradually increase load
4. Monitor system resources
5. Identify bottlenecks
6. Optimize based on findings

For detailed documentation, see [README.md](README.md)







