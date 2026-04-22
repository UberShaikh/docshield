@echo off
REM ============================================================
REM  DocShield — Windows Start Script
REM ============================================================
title DocShield - Document Fraud Detection

echo.
echo  ██████╗  ██████╗  ██████╗███████╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗
echo  ██╔══██╗██╔═══██╗██╔════╝██╔════╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗
echo  ██║  ██║██║   ██║██║     ███████╗███████╗███████║██║█████╗  ██║     ██║  ██║
echo  ██║  ██║██║   ██║██║     ╚════██║╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║
echo  ██████╔╝╚██████╔╝╚██████╗███████║███████║██║  ██║██║███████╗███████╗██████╔╝
echo  ╚═════╝  ╚═════╝  ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝
echo.
echo  Document Fraud Detection System
echo.

SET SCRIPT_DIR=%~dp0

REM ── AI Service ────────────────────────────────────────────────────────────
echo [1/3] Setting up AI Service...
cd /d "%SCRIPT_DIR%ai-service"
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo     AI Service ready
echo.

REM ── Backend ───────────────────────────────────────────────────────────────
echo [2/3] Setting up Backend...
cd /d "%SCRIPT_DIR%backend"
if not exist node_modules (
    npm install --silent
)
echo     Backend ready
echo.

REM ── Frontend ──────────────────────────────────────────────────────────────
echo [3/3] Setting up Frontend...
cd /d "%SCRIPT_DIR%frontend"
if not exist node_modules (
    npm install --silent
)
echo     Frontend ready
echo.

REM ── Launch ────────────────────────────────────────────────────────────────
echo Starting all services in separate windows...
echo.

cd /d "%SCRIPT_DIR%ai-service"
start "DocShield AI Service :8000" cmd /k "call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

cd /d "%SCRIPT_DIR%backend"
start "DocShield Backend :4000" cmd /k "set AI_SERVICE_URL=http://localhost:8000 && node server.js"

timeout /t 2 /nobreak >nul

cd /d "%SCRIPT_DIR%frontend"
start "DocShield Frontend :3000" cmd /k "set REACT_APP_API_URL= && set PORT=3000 && npm start"

echo.
echo ============================================
echo   DocShield is starting up!
echo ============================================
echo.
echo   Frontend  -^>  http://localhost:3000
echo   Backend   -^>  http://localhost:4000
echo   AI API    -^>  http://localhost:8000/docs
echo.
echo   Close this window or press any key to exit
echo   (individual service windows will stay open)
echo.
pause
