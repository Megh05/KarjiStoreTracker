#!/bin/bash

echo "🚀 Starting KarjiStore JavaScript Chatbot..."
echo

# Check if Node.js is available
if command -v node &> /dev/null; then
    echo "✅ Using Node.js server..."
    node server.js
elif command -v python3 &> /dev/null; then
    echo "✅ Using Python 3 HTTP server..."
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "✅ Using Python HTTP server..."  
    python -m http.server 8080
else
    echo "❌ Error: Neither Node.js nor Python found!"
    echo "Please install Node.js from https://nodejs.org or Python from https://python.org"
    exit 1
fi