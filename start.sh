#!/bin/bash
# ==========================================================================
# NEXO Scholarship Portal - Local Server Launcher
# ==========================================================================

echo "======================================================"
echo "  Starting NEXO Scholarship Portal Local Server..."
echo "======================================================"

PORT=${PORT:-3000}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Ensure bin/node is executable
if [ -f "./bin/node" ]; then
  chmod +x ./bin/node
fi

# Try launching with Node first
if [ -x "./bin/node" ]; then
  echo "Launching with Node runtime..."
  exec ./bin/node backend/server.js
elif command -v node >/dev/null 2>&1; then
  echo "Launching with system node..."
  exec node backend/server.js
elif command -v python3 >/dev/null 2>&1; then
  echo "Launching with Python 3 runtime..."
  exec python3 backend/server.py
else
  echo "Error: Neither Node nor Python 3 found to run backend server." >&2
  exit 1
fi
