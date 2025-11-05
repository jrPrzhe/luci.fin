@echo off
echo Starting Backend with SQLite (no PostgreSQL/Redis required)...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt
echo Running migrations (will create finance.db)...
alembic upgrade head
echo Starting server on http://localhost:8000...
echo Database: SQLite (finance.db)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

