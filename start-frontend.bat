@echo off
echo Starting Frontend...
cd frontend
if not exist node_modules (
    echo Installing dependencies...
    npm install
)
echo Starting dev server on http://localhost:5173...
npm run dev
pause

