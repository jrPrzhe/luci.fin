@echo off
echo Creating test user...
cd backend
call venv\Scripts\activate
python create_test_user.py
pause








