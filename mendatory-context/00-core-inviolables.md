# Core Inviolables & Foundational Guardrails

> **Target Audience:** Any human engineer or AI coding agent operating in `/home/nedjmo/labHRM/lab-hrm`.  
> **Mandate:** Read this file first before inspecting, modifying, or proposing changes to the codebase. The rules below are non-negotiable architectural boundaries.

---

## 1. Business & Product Identity

* **Client:** **EL-AMEL LAB** — A private medical analysis and biological laboratory located in Algeria.
* **Sole User:** The laboratory owner/director is the **only authenticated user**.
* **System Scope:**
  1. **Phase 1 (Active):** Comprehensive Human Resources Management (Staff Directory, Absences Calendar, Vacation Allowance & Balances, Performance Evaluations, Chronological Salary Progression, Interactive Editable Payslips, Branded French PDF Payslips, Database Backups).
  2. **Phase 2 (Upcoming Roadmap):** Lab Inventory Management (Reagents, Consumables, Suppliers, Lots, Expiration Dates, Stock Movements & Threshold Alerts).

---

## 2. Inviolable Architectural Guardrails ("Do Nots")

Future coding agents frequently hallucinate patterns from generic web templates. **Under no circumstances should any of the following be re-introduced:**

1. **NO Multi-Tenant User Management or Public Signups:**
   * There are no employee logins, role hierarchies (RBAC), team accounts, or self-service password recovery servers.
   * Authentication is exclusively for the single administrator (`admin@example.com`).
   * Password reset is performed in-app at `/settings` or via the CLI utility:
     ```bash
     cd backend && uv run python reset_admin.py --email admin@example.com --password "NewPassword123"
     ```
2. **NO External Database Services (No PostgreSQL, MySQL, Redis, or Alembic):**
   * The database is embedded **SQLite** with Write-Ahead Logging (`PRAGMA journal_mode=WAL`).
   * Do not introduce external database daemons, connection pools, or migrations. Schema tables and idempotent unique indexes are initialized on boot via `SQLModel.metadata.create_all()` and `_ensure_sqlite_unique_indexes()` in `backend/app/core/db.py`.
3. **NO Multi-Container Topologies (No Traefik, Nginx, Mailpit, or Redis):**
   * The application runs as a **single process** in production. FastAPI serves both the JSON API (`/api/v1/*`) and the compiled React single-page application (`backend/app/frontend/`).
4. **NO Code Generation Artifacts or Dual API Clients:**
   * All API interaction on the frontend is unified in manual, strongly typed Axios clients (`frontend/src/lib/api/` and `frontend/src/lib/hr-api.ts`).
   * Do not run or reinstall `@hey-api/openapi-ts` or create generated client folders (`src/client/`).

---

## 3. Language & Localization Separation Boundary

The application operates under a strict language separation contract:

| Layer | Language | Enforced Convention |
|---|---|---|
| **Backend Code & Logic** | **100% English** | Python files, function names, class names, database tables, column names, API route paths, JSON payload keys, and developer comments must be written exclusively in English. |
| **Database Enums & Values** | **100% English** | Stored values in SQLite use lowercase English strings (`active`, `on_leave`, `unjustified`, `annual`, `approved`, `draft`, `bank_transfer`). |
| **Frontend Codebase** | **100% English** | TypeScript interfaces, component names, hook names, variable names, and code comments are strictly in English. |
| **User-Facing UI Copy** | **Bilingual (`FR` / `EN`)** | User copy is managed through `frontend/src/lib/i18n.tsx`. It defaults to **French (`fr`)** for the laboratory owner, with an instant **`FR ⇄ EN` switcher** in the header and login screen for testing. |
| **Generated Payslip PDFs** | **Professional French** | French labor and accounting terminology is used for the *Bulletin de Paie* generated in `backend/app/pdf_generator.py` (*Désignation des rubriques*, *Salaire Brut*, *Retenues*, *Net à Payer*, *Cachet et Signature de l'Employeur*). |

---

## 4. Confirmed Domain Constants

* **Currency:** Algerian Dinar (`DZD`). Formatted with narrow no-break space and comma decimals: `XX XXX,XX DZD` (e.g., `48 000,00 DZD`).
* **Standard Working Days per Month:** `22` days (formula: `daily_rate = base_salary / working_days_per_month`). Configurable in *Paramètres* (`CompanySettings.working_days_per_month`).
* **Default Annual Vacation Allowance:** `30` days per year (configurable globally in *Paramètres* and individually per employee).
* **Workweek & Absence Weights:**
  * Full-day absence: deduction weight = `1.0` day.
  * Half-day absence: deduction weight = `0.5` day.
  * Paid absence / justified illness: deduction weight = `0.0` days.

---

## 5. Verification Commands (Must Pass Cleanly)

Before submitting or committing any change, run the full verification suite:

```bash
# 1. Backend Lint, Formatting & Tests
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run ruff check app tests reset_admin.py
uv run ruff format --check app tests reset_admin.py
uv run pytest -v

# 2. Frontend Lint, Static Build & Browser E2E Tests
cd /home/nedjmo/labHRM/lab-hrm/frontend
bun run lint
bun run build
bun run test
```
