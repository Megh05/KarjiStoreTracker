@echo off
echo Starting KarjiStore JavaScript Chatbot with MSSQL Support...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Node.js found. Installing dependencies...
    
    REM Install npm dependencies if package.json exists
    if exist package.json (
        npm install
        if %ERRORLEVEL% NEQ 0 (
            echo Warning: Failed to install dependencies. MSSQL features may not work.
        )
    )
    
    echo.
    echo Starting server with MSSQL support...
    echo Configure your database in .env file for real data connection.
    echo.
    node server.js
) else (
    echo Node.js not found - falling back to simple HTTP server
    echo Note: MSSQL database features will not be available
    echo.
    
    REM Check if Python 3 is available
    python3 --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Using Python 3 HTTP server (mock data only)...
        python3 -m http.server 8080
    ) else (
        REM Check if Python is available
        python --version >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo Using Python HTTP server (mock data only)...
            python -m http.server 8080
        ) else (
            echo Error: Neither Node.js nor Python found!
            echo Please install Node.js from https://nodejs.org for full MSSQL support
            echo or Python from https://python.org for basic functionality
            pause
        )
    )
)

pause