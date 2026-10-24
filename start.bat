@echo off
chcp 65001 >nul
start "Bean&Brew API" cmd /k "cd backend && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"
start "Bean&Brew Web" cmd /k "cd frontend && npm run dev"
timeout /t 4 >nul
start http://localhost:5173
