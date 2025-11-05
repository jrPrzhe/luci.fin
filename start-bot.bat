@echo off
echo Starting Telegram Bot...
cd telegram-bot
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Error installing dependencies. Please check requirements.txt
    pause
    exit /b 1
)
echo Starting bot...
python bot.py
pause

