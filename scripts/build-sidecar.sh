#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Building EL-AMEL LAB Sidecar Binary ==="

TARGET_TRIPLE="$(rustc -vV | sed -n 's|host: ||p')"
echo ">> Detected target triple: ${TARGET_TRIPLE}"

echo ">> 1. Building React frontend..."
cd "${ROOT_DIR}/frontend"
bun run build

echo ">> 2. Compiling FastAPI backend via PyInstaller..."
cd "${ROOT_DIR}/backend"
uv run pyinstaller --clean backend.spec

echo ">> 3. Staging sidecar binary for Tauri v2..."
mkdir -p "${ROOT_DIR}/frontend/src-tauri/binaries"
DEST="${ROOT_DIR}/frontend/src-tauri/binaries/el-amel-backend-${TARGET_TRIPLE}"
cp "${ROOT_DIR}/backend/dist/el-amel-backend" "${DEST}"
chmod +x "${DEST}"

echo ">> Sidecar ready at: ${DEST}"
