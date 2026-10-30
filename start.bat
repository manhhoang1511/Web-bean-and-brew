@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist backend\.venv goto need_setup
if not exist backend\shop.db goto need_setup
if not exist frontend\node_modules goto need_setup

start "Bean&Brew API" /d "%~dp0backend" cmd /k .venv\Scripts\python -m uvicorn app.main:app --port 8000
start "Bean&Brew Web" /d "%~dp0frontend" cmd /k npm run dev

echo Dang khoi dong, vui long cho...
set /a tries=0
:wait
curl -s -o nul -m 2 http://localhost:5173 && curl -s -o nul -m 2 http://localhost:8000/api/categories && goto ready
set /a tries+=1
if %tries% geq 60 goto timeout
timeout /t 1 /nobreak >nul
goto wait

:ready
start "" http://localhost:5173
exit /b 0

:timeout
echo Khoi dong qua lau. Hay xem loi trong 2 cua so "Bean^&Brew API" va "Bean^&Brew Web".
pause
exit /b 1

:need_setup
echo Chua cai dat. Hay chay setup.bat truoc (chi can 1 lan).
pause
exit /b 1
