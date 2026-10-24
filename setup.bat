@echo off
chcp 65001 >nul
echo === Cai dat Backend ===
cd backend
if not exist .venv python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
if not exist .env copy .env.example .env
.venv\Scripts\python seed.py
cd ..
echo === Cai dat Frontend ===
cd frontend
call npm install
cd ..
echo.
echo Xong! Chay start.bat de khoi dong.
pause
