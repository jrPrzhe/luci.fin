@echo off
echo Starting Backend with HTTPS...
cd backend

REM Check if certificate exists
if not exist localhost.crt (
    echo SSL certificate not found!
    echo.
    echo Creating certificate...
    call create_cert_simple.bat
    echo.
    
    REM If only .pfx was created, convert it
    if exist localhost.pfx (
        if not exist localhost.crt (
            echo Converting .pfx to .crt and .key...
            python convert_pfx_to_crt.py localhost.pfx finance123
            if exist localhost.crt (
                del localhost.pfx
            )
        )
    )
)

if not exist localhost.key (
    echo SSL key not found!
    echo Please run: create_cert_simple.bat
    pause
    exit /b 1
)

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt -q

echo Running migrations...
python -m alembic upgrade head

echo.
echo ========================================
echo Starting HTTPS Backend
echo ========================================
echo Backend: https://localhost:8443
echo API Docs: https://localhost:8443/docs
echo.
echo Note: Browser will show security warning - this is normal!
echo.

python run_https.py
pause

