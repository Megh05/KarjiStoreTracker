#!/usr/bin/env python3
"""
Simple HTTP server to serve the JavaScript chatbot application.
Run with: python3 server.py
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse, parse_qs
import json
import requests
from datetime import datetime

# Port for the server
PORT = 8080
BACKEND_URL = "http://localhost:5000"

class ChatbotRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve files from the javascript-version directory
        super().__init__(*args, directory="javascript-version", **kwargs)
    
    def do_POST(self):
        """Handle POST requests - proxy to backend API"""
        if self.path == "/api/track-order":
            self.proxy_to_backend()
        else:
            self.send_error(404, "API endpoint not found")
    
    def proxy_to_backend(self):
        """Proxy API requests to the Express.js backend"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Forward to backend
            response = requests.post(
                f"{BACKEND_URL}/api/track-order",
                data=post_data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            # Send response back to client
            self.send_response(response.status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(response.content)
            
        except requests.exceptions.ConnectionError:
            # Backend not available, send error
            self.send_error(503, "Backend service unavailable")
        except Exception as e:
            print(f"Proxy error: {e}")
            self.send_error(500, "Internal server error")
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    # Change to project root directory
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    try:
        with socketserver.TCPServer(("", PORT), ChatbotRequestHandler) as httpd:
            print(f"🚀 JavaScript Chatbot Server running at:")
            print(f"   http://localhost:{PORT}")
            print(f"   http://127.0.0.1:{PORT}")
            print(f"\n📋 Demo credentials:")
            print(f"   john.doe@example.com / ORD-2024-001")
            print(f"   jane.smith@company.com / ORD-2024-002")
            print(f"\n🔗 Backend API: {BACKEND_URL}")
            print(f"🛑 Press Ctrl+C to stop the server\n")
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try a different port.")
        else:
            print(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()