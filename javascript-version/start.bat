@echo off
echo Starting KarjiStore JavaScript Chatbot...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using Node.js server...
    node server.js
) else (
    REM Check if Python 3 is available
    python3 --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Using Python 3 HTTP server...
        python3 -m http.server 8080
    ) else (
        REM Check if Python is available
        python --version >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo Using Python HTTP server...
            python -m http.server 8080
        ) else (
            echo Error: Neither Node.js nor Python found!
            echo Please install Node.js from https://nodejs.org or Python from https://python.org
            pause
        )
    )
)

pause