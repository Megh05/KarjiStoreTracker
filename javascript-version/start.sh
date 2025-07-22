#!/bin/bash

echo "🚀 Starting KarjiStore JavaScript Chatbot with MSSQL Support..."
echo

# Check if Node.js is available
if command -v node &> /dev/null; then
    echo "✅ Node.js found. Installing dependencies..."
    
    # Install npm dependencies if package.json exists
    if [ -f "package.json" ]; then
        npm install
        if [ $? -ne 0 ]; then
            echo "⚠️  Warning: Failed to install dependencies. MSSQL features may not work."
        fi
    fi
    
    echo
    echo "🚀 Starting server with MSSQL support..."
    echo "💡 Configure your database in .env file for real data connection."
    echo
    node server.js
elif command -v python3 &> /dev/null; then
    echo "⚠️  Node.js not found - falling back to simple HTTP server"
    echo "📋 Note: MSSQL database features will not be available"
    echo "✅ Using Python 3 HTTP server (mock data only)..."
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "⚠️  Node.js not found - falling back to simple HTTP server"
    echo "📋 Note: MSSQL database features will not be available"  
    echo "✅ Using Python HTTP server (mock data only)..."
    python -m http.server 8080
else
    echo "❌ Error: Neither Node.js nor Python found!"
    echo "Please install Node.js from https://nodejs.org for full MSSQL support"
    echo "or Python from https://python.org for basic functionality"
    exit 1
fi