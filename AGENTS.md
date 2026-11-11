# EL-AMEL LAB (`lab-hrm`) — Agent Instructions

Read **`HANDOFF.md`** first for full architectural, domain, and historical context before making changes.

## Key Constraints & Conventions
* **Single-User App:** Do NOT re-introduce multi-user signup, user-management admin panels, SMTP email recovery, PostgreSQL, or multi-container Docker services.
* **Language Separation:** Keep all code, DB columns, API endpoints, comments, and developer docs in **English**. Keep UI user-facing copy bilingual (`FR` default for the Francophone client, `EN` toggle for developer testing) via `frontend/src/lib/i18n.tsx`. Payslip PDFs (`backend/app/pdf_generator.py`) are in **French**.
* **Payroll Defaults:** Currency is `DZD`; default working days/month is `22`; default vacation allowance is `30` days.
* **Single-Process Build:** Vite outputs to `backend/app/frontend/`. Always run `bun run build` in `frontend/` after frontend changes so FastAPI serves updated assets.
* **Desktop & Deployment Target:** For desktop packaging, use **Tauri v2** (NOT Electron) running the FastAPI backend as a PyInstaller sidecar on a fixed local port (`127.0.0.1:8000`) on the work PC with system tray keep-alive, **Cloudflare Tunnel** (`cloudflared`) for remote phone/home access, and a **GitHub-backed in-app Update button** (`tauri-plugin-updater` + GitHub Releases, or Git-based update with pre-update SQLite backup).

## Quick Verification Commands
* **Backend tests:** `cd backend && uv run pytest -v`
* **Backend lint:** `cd backend && uv run ruff check app tests reset_admin.py`
* **Frontend build & E2E tests:** `cd frontend && bun run lint && bun run build && bun run test`
