@echo off
echo ═══════════════════════════════════════
echo   TrendBrief AI — Dev Mode (16GB)
echo   Requires: start-shared-infra.bat running
echo ═══════════════════════════════════════
echo.

echo [1/3] Starting Python AI Engine (port 8000)...
start "TrendBrief-AI-Engine" cmd /k "cd trendbriefai-engine && .venv\Scripts\activate && uvicorn api:app --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Backend API (port 3000)...
start "TrendBrief-Backend" cmd /k "cd trendbriefai-service && npm run dev"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Web UI (port 4200)...
start "TrendBrief-UI" cmd /k "cd trendbriefai-ui && npm start"

echo.
echo ═══════════════════════════════════════
echo   ✅ TrendBrief AI running!
echo   Backend: http://localhost:3000
echo   AI:      http://localhost:8000
echo   UI:      http://localhost:4200
echo   Swagger: http://localhost:3000/api-docs
echo ═══════════════════════════════════════
