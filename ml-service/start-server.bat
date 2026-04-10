@echo off
REM Start the Dr.Nexus API server from the correct directory
cd /d "%~dp0"

echo.
echo ======================================================
echo   Dr.Nexus AI Brain — Startup
echo ======================================================
echo.

REM ── Check if trained model exists; bootstrap if missing ──────────────────────
IF NOT EXIST "models\transaction-classifier\tokenizer\label_encoder.pkl" (
    echo [Model] No trained model found. Running bootstrap training...
    echo [Model] This takes ~10 seconds and only happens once.
    echo.
    .venv\Scripts\python.exe training\bootstrap_train.py
    echo.
    echo [Model] Bootstrap complete. Starting server...
    echo.
) ELSE (
    echo [Model] Trained model found. ML predictions active.
    echo.
)

echo Starting server on http://localhost:8000
echo.
.venv\Scripts\python.exe run.py
pause
