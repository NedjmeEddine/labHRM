#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$DIR/../../backend" && pwd)"

rm -f "$BACKEND_DIR/data/e2e_test.db"
cd "$BACKEND_DIR"

export DATABASE_URL="sqlite:///$BACKEND_DIR/data/e2e_test.db"
exec uv run fastapi run app/main.py --host 127.0.0.1 --port 8002
