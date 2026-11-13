# EL-AMEL LAB (`lab-hrm`) — Agent Instructions & Handbook Guide

> **MANDATORY FOR ALL CODING AGENTS:** Read **`HANDOFF.md`** and the documents in **`mendatory-context/`** before proposing or applying code changes.

## 1. Documentation Map for Agents

| Document / Directory | What it covers & when to read it |
|---|---|
| **`HANDOFF.md`** | High-level system architecture, business background, past decisions, gotchas, and roadmap. |
| **`mendatory-context/00-core-inviolables.md`** | Hard boundaries ("Do Nots"): single-user only, no PostgreSQL/Alembic, single-process, language separation. |
| **`mendatory-context/01-system-design-and-architecture.md`** | Backend service layer, SQLite WAL concurrency & auto-migrations, zero-config secret key, CORS. |
| **`mendatory-context/02-business-logic-and-domain-rules.md`** | Payroll formulas, daily rates, absence weighting, vacation overlap arithmetic, PDF specs. |
| **`mendatory-context/03-frontend-architecture-and-standards.md`** | React 19 standards, feature modules, TanStack Query keys, local date helpers, Vercel guidelines. |
| **`mendatory-context/04-testing-contracts-and-qa.md`** | Inviolable Playwright `data-testid` contracts, test isolation, QA verification checklists. |
| **`mendatory-context/05-extension-playbook-inventory.md`** | Architectural extension blueprint for inventory models and features. |
| **`docs/inventory-audit.md`** | Audit of inventory code smells eliminated (Decimal money, derived stock ledger, soft deletions). |
| **`docs/assumptions.md`** | Business and fiscal assumptions for the laboratory (TVA 19%/9%/0%, single admin, payment attribution). |
| **`docs/inventory-demo.md`** | 5-minute walkthrough guide for demonstrating the inventory and supplier system to the owner. |
| **`INVENTORY_AGENT.md`** | Specialized specification for suppliers, purchase invoices, lots, and stock movements. |

## 2. Key Constraints & Conventions
* **Single-User App:** Do NOT re-introduce multi-user signup, user-management admin panels, SMTP email recovery, PostgreSQL, or multi-container Docker services.
* **Language Separation:** Keep all code, DB columns, API endpoints, comments, and developer docs in **English**. Keep UI user-facing copy bilingual (`FR` default for the Francophone client, `EN` toggle for developer testing) via `frontend/src/lib/i18n.tsx`. Payslip and statement PDFs (`backend/app/pdf_generator.py`) are in **French**.
* **Financial Precision:** Currency is `DZD`. Money is NEVER stored or calculated with `float`; always use `Decimal` with banker's rounding (`ROUND_HALF_UP`).
* **Derived Stock:** Stock on hand is ALWAYS derived from the signed `StockMovement` ledger ($\sum \text{quantity}$); never store mutable stock quantities on products or lots.
* **Single-Process Build:** Vite outputs directly to `backend/app/frontend/`. Always run `bun run build` in `frontend/` after frontend changes so FastAPI serves updated assets.
* **Desktop & Deployment Target:** For desktop packaging, use **Tauri v2** (NOT Electron) running the FastAPI backend as a PyInstaller sidecar on a fixed local port (`127.0.0.1:8000`) on the work PC with system tray keep-alive, **Cloudflare Tunnel** (`cloudflared`) for remote phone/home access, and a **GitHub-backed in-app Update button** (`tauri-plugin-updater` + GitHub Releases, or Git-based update with pre-update SQLite backup).

## 3. Quick Verification Commands
* **Backend tests:** `cd backend && uv run pytest -v` (21 automated tests)
* **Backend lint:** `cd backend && uv run ruff check app tests reset_admin.py`
* **Frontend build & E2E tests:** `cd frontend && bun run lint && bun run build && bun run test` (3 Playwright browser test suites)
