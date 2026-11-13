#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================="
echo " Starting EL-AMEL LAB (Single-User App)"
echo "=========================================="

# Build frontend if requested or not built yet
if [ "${BUILD_FRONTEND:-0}" = "1" ] || [ ! -d "backend/app/frontend" ] || [ ! -f "backend/app/frontend/index.html" ]; then
    echo ">> Building React frontend..."
    cd frontend
    bun install
    bun run build
    cd "$DIR"
fi

# Ensure backend dependencies and virtualenv are ready
cd backend
if [ ! -d ".venv" ]; then
    echo ">> Installing backend dependencies..."
    uv sync
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

echo ">> Starting FastAPI server at http://${HOST}:${PORT} ..."
echo ">> Default Admin Login: admin@example.com / changethis"
uv run fastapi run app/main.py --host "$HOST" --port "$PORT"
