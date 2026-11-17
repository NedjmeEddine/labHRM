# EL-AMEL LAB — Complete Project Context & Handoff

> **Purpose of this file:** Give any new developer or AI coding session complete, zero-ambiguity context on why this repository exists, what has been built, how everything works, what was tested, and what comes next (including the upcoming **Lab Inventory Management** expansion and **Tauri v2** desktop packaging).

---

## 1. Project Background & Client Requirements

### Business Context
* **Client:** **EL-AMEL LAB** (medical / biological laboratory, Francophone owner in Algeria).
* **Product Scope:** An integrated **HR + Lab Inventory Management** platform for the laboratory owner:
  * **Phase 1 (Implemented):** Employees, Absences & Calendar, Vacations, Performance & Salary Progression, Editable Payslips & French PDF Export, Company Settings & Database Backup.
  * **Phase 2 (Implemented):** **Suppliers & Inventory Management** (Phase A: Supplier directory & debt balances, purchase invoices with decimal TVA lines, payments, stated-total mismatch warnings, scan attachments, price history, PDF/CSV statement exports; Phase B: Lots & derived stock on hand; Phase C: Manual movement audit logs & settings toggles).
  * **Desktop Packaging Target:** **Tauri v2** PyInstaller sidecar on `127.0.0.1:8000` with system tray keep-alive and Cloudflare Tunnel for remote smartphone access.
* **Origin:** Built from scratch in `/home/nedjmo/labHRM/lab-hrm` as a streamlined replacement for the heavy multi-tenant scaffold located in `/home/nedjmo/labHRM/fastapi-template-test`.
* **Single-User Constraint:** The business owner is the **only user**. There are no employee logins, no public registrations, no role hierarchies, and no SMTP email recovery servers.

### Language & Localization Strategy
* **Client is Francophone; Developer prefers English.**
* **Backend code, database schema, API routes, TypeScript types, and comments:** 100% **English**.
* **Frontend UI:** 100% bilingual (`frontend/src/lib/i18n.tsx`) — defaults to **French** (`fr`) for the client, with an instant **`FR ⇄ EN` toggle** (`LanguageSwitcher.tsx`) in the header and login screen for development/testing.
* **Generated Payslip PDFs (*Bulletin de Paie*):** Generated in professional **French**.

### Confirmed Domain Rules
* **Currency:** `DZD` (`XX XXX,XX DZD`).
* **Standard Working Days / Month:** `22` (`daily_rate = base_salary / 22`, configurable in *Paramètres*).
* **Default Annual Vacation Allowance:** `30` days/year (configurable globally and per employee).

---

## 2. Git Repository State

* **Location:** `/home/nedjmo/labHRM/lab-hrm`
* **Current Branch:** `feat/hr-features`
* **Recent History:**
  1. `984d5c6` *(on `main`)* — `feat: initialize simplified single-user EL AME LAB baseline with SQLite`
  2. `49ebecb` *(on `feat/hr-features`)* — `feat(hr): implement employees, absences calendar, vacations, performance, editable payslips & French PDF export`
  3. `8a53a54` *(on `feat/hr-features`)* — `test(hr): add pytest backend test suite and Playwright E2E browser tests`
  4. `87adce7` *(on `feat/hr-features`)* — `fix(ui): resolve /vite.svg 404, widen payslip modal, align calendar brand palette & eliminate table overflow`
  5. `7d10084` .. `d186a19` — `HANDOFF.md` and `AGENTS.md` documentation updates
  6. *(Current)* — Full codebase refactoring (backend services, `StrEnum` + SQLite unique indexes, WAL + `.secret_key` auto-gen, WAL-safe `.db` backup, unified typed Axios client, feature-split React modules, Vercel React optimizations, full bilingual copy).

---

## 3. Tech Stack & Architecture

### Single-Process Serving Model
FastAPI serves **both** the REST API (`/api/v1/*`) and the compiled React SPA (`backend/app/frontend/` via `app.frontend("/", directory=FRONTEND_DIR)` in `backend/app/main.py`). CORS uses `allow_origins=["*"]` with `allow_credentials=False` (HTTP-spec compliant for `Authorization: Bearer` tokens across Tauri v2 WebViews, Cloudflare Tunnels, and Vite dev servers).

### Backend (`backend/`)
* **Python 3.12+ / `uv` package manager** (`backend/pyproject.toml`, `backend/uv.lock`)
* **FastAPI (`fastapi[standard]`)**
* **SQLite + SQLModel:**
  * `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`, `PRAGMA busy_timeout=5000` (`backend/app/core/db.py`).
  * Uses `SQLModel.metadata.create_all()` + idempotent `CREATE UNIQUE INDEX IF NOT EXISTS ...` in `init_db()` (no Alembic).
  * **Zero-Config `SECRET_KEY` (`backend/app/core/config.py`):** If no non-placeholder `SECRET_KEY` env var is set, a 64-char random hex key is auto-generated once and persisted next to the active SQLite database (e.g. `backend/data/.secret_key` locally or `%APPDATA%\...\ .secret_key` in Tauri).
* **Domain Services (`backend/app/services/`):** Explicit static imports (PyInstaller-friendly):
  * `services/system.py` — authentication, `CompanySettings`, and WAL-safe `sqlite3.Connection.backup()` snapshot export.
  * `services/csv_export.py` — reusable UTF-8 BOM `;`-delimited CSV `StreamingResponse` builder with spreadsheet formula-injection neutralization.
  * `services/employees.py` — employee listing (SQL `ilike`), auto-incrementing `EMP-xxx` codes, and centralized `SalaryHistory` tracking.
  * `services/absences.py` — absence weight rules, interval summary calculations, single/range creation, duplicate validation on `POST`/`PATCH`.
  * `services/vacations.py` — date/overlap validation on `POST`/`PATCH`, cross-year balance splitting, and 2-query batch balance aggregation.
  * `services/payroll.py` — payslip draft computation, batch generation, centralized `recompute_payslip_totals()`, and performance review raise integration.
* **PDF Generator (`backend/app/pdf_generator.py`):** `PayslipPdfBuilder` using `fpdf2` + bundled UTF-8 `NotoSans` TTF fonts + logo (`backend/app/assets/`), with `fr-DZ` comma formatting and overflow clipping/page-break protection.
* **Testing & Linting:** `pytest`, `ruff`

### Frontend (`frontend/`)
* **React 19 + TypeScript + Vite + `bun`** (`frontend/package.json`, `frontend/bun.lock`)
* **TanStack Router** (file-based routing in `frontend/src/routes/`) + **TanStack Query** (DevTools lazy-loaded strictly when `import.meta.env.DEV`)
* **Unified Manual Typed Axios Client:**
  * `src/lib/api/client.ts` — single Axios instance, single 401/403 interceptor (clears React Query cache + redirects to `/login`), `extractApiErrorMessage()`, and `downloadAuthenticatedFile()` (with delayed blob URL revocation).
  * `src/lib/api/auth.ts` — `authApi` & `usersApi` (old `@/client/*` and `@hey-api/openapi-ts` artifacts have been removed).
  * `src/lib/hr-api.ts` — typed HR & Settings APIs (re-exporting auth/client helpers).
* **Shared Frontend Utilities (`frontend/src/lib/` & `hooks/` & `components/`):**
  * `lib/query-keys.ts` — centralized React Query key factory.
  * `lib/domain-labels.ts` — centralized bilingual status badge & enum label mappers.
  * `lib/date.ts` — local `yyyy-MM-dd` helpers (`formatLocalDate`), safe interval expansion (`safeEachDayOfInterval`), locale-aware `formatDisplayDate()`.
  * `lib/storage.ts` — `try/catch` safe `localStorage` wrapper for WebView compatibility.
  * `hooks/useDebouncedValue.ts`, `hooks/useCopyToClipboard.ts`, `components/Common/DataTable.tsx` (`@tanstack/react-table` — localized and kept for upcoming Inventory tables), `components/Common/ConfirmDeleteDialog.tsx`.
* **Feature Modules (`frontend/src/features/`):**
  * `features/employees/` — `EmployeeFormDialog`, `EmployeeDetailTabs`
  * `features/attendance/` — `AttendanceFilterBar`, `AttendanceCalendarCard`, `AttendanceSelectedDayCard` (day-click inspection + quick-mark), `AttendanceSummaryCards`, `AttendanceTable`, `AbsenceFormDialog`
  * `features/vacations/` — `VacationBalancesCard`, `VacationsTable`, `VacationFormDialog`
  * `features/payroll/` — `PayslipsTab`, `PerformanceTab`, `SingleDraftDialog`, `PayslipEditorDialog`, `PerformanceReviewDialog`
  * `features/settings/` — `CompanySettingsTab` (keyed form + WAL-safe `.db` backup download button)
* **Build output:** Compiles straight into `../backend/app/frontend/` (`frontend/vite.config.ts`). Dev server (`bun run dev`) proxies `/api` to `http://127.0.0.1:8000`.
* **Testing & Linting:** `@playwright/test`, `@biomejs/biome`

---

## 4. Database Schema & Business Logic (`backend/app/models.py` & `services/`)

`PRAGMA foreign_keys=ON` and `PRAGMA journal_mode=WAL` are enabled on every SQLite connection (`backend/app/core/db.py`), paired with SQLModel `cascade_delete=True`. Domain status/type columns use `StrEnum` validation paired with SQLite `VARCHAR(30)` (`sa_type=String(30)`).

1. **`User`:** Single administrator account seeded on first startup (`ADMIN_EMAIL=admin@elamel-lab.dz`, `ADMIN_PASSWORD=ElAmelLab2026!` from `core/config.py` / `.env`). Password can be changed in UI (`/settings`) or via CLI (`python reset_admin.py --email ... --password ...`).
2. **`CompanySettings` (Singleton `id=1`):** `company_name` (`EL-AMEL LAB`), `address`, `phone`, `email`, `tax_id` (NIF/RC), `currency` (`DZD`), `working_days_per_month` (`22`), `default_annual_vacation_days` (`30`).
3. **`Employee`:** Auto-generates `EMP-001`, `EMP-002`, ... if `employee_code` is blank. `status` (`EmployeeStatus`: `active` | `on_leave` | `terminated`). Rejects empty `employee_code` on `PATCH`.
4. **`SalaryHistory`:** Appended via `services.employees.record_salary_change` / `create_employee` whenever an employee is created (`Initial hire salary`), updated via `PATCH /employees/{id}` with a changed salary, or given a raise via `POST /performance/`.
5. **`Absence`:** `UniqueConstraint("employee_id", "date")`. `absence_type` (`AbsenceType`: `unjustified` | `sick` | `justified` | `half_day`), `is_paid`, `reason`.
   * Deduction weight: `0.5` day if `half_day`, else `1.0` day. Paid absences incur `0` deduction.
   * Duplicate `(employee_id, date)` rejected with HTTP `400` on both `POST` and `PATCH`.
   * Range endpoint (`POST /absences/range`) skips dates already marked and caps ranges at 90 days.
6. **`Vacation`:** `vacation_type` (`VacationType`: `annual` | `sick` | `unpaid` | `other`), `status` (`VacationStatus`: `approved` | `pending` | `rejected`), `days_count` auto-calculated `(end - start).days + 1`.
   * Rejects overlapping non-rejected vacations on both `POST` and `PATCH`.
   * Balance calculation splits cross-year vacations accurately per calendar year and counts `annual` + `approved` days against `employee.annual_vacation_days`.
7. **`PerformanceReview`:** `employee_id`, `period_month`, `period_year`, `score` (`1–5`), `bonus_amount`, `new_base_salary` (optional — updates employee salary + creates `SalaryHistory`), `notes`.
8. **`Payslip`:** `UniqueConstraint("employee_id", "month", "year")`. Snapshot + editable payroll ledger per `(employee_id, month, year)`:
   * `daily_rate = employee.base_salary / working_days_per_month`
   * `unpaid_days` = unpaid `Absence` weights in month + `unpaid` approved `Vacation` days overlapping month
   * `absence_deduction = round(unpaid_days * daily_rate, 2)`
   * `worked_days = max(0, working_days_per_month - unpaid_days)`
   * `performance_bonus` = sum of `PerformanceReview.bonus_amount` for `(month, year)`
   * `gross_salary = base_salary + performance_bonus + other_allowances + overtime_pay`
   * `net_salary = max(0, gross_salary - absence_deduction - other_deductions)`
   * Batch generation (`POST /payslips/generate-batch`) processes all `active` employees (skips `terminated`, preserves existing/edited/paid payslips unless single-draft `overwrite: true` is passed).

---

## 5. Complete API Routes (`backend/app/api/routes/`)

All routers except `/login/*` and `/utils/health-check/` require a valid Bearer JWT (`Depends(get_current_user)`).

* **Auth & Admin (`/api/v1`):**
  * `POST /login/access-token`, `POST /login/test-token`
  * `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`
  * `GET /utils/health-check/`
* **Dashboard:** `GET /api/v1/dashboard/`
* **Company Settings & Backup:**
  * `GET /api/v1/settings/company`, `PATCH /api/v1/settings/company`
  * `GET /api/v1/settings/backup` (streams a WAL-safe `.db` snapshot via `sqlite3.Connection.backup()`)
* **Employees:**
  * `GET /api/v1/employees/` (`?status=&search=`), `POST /api/v1/employees/`
  * `GET /api/v1/employees/{id}`, `PATCH /api/v1/employees/{id}`, `DELETE /api/v1/employees/{id}`
  * `GET /api/v1/employees/{id}/salary-history`
  * `GET /api/v1/employees/{id}/vacation-balance` (`?year=`)
* **Absences:**
  * `GET /api/v1/absences/` (`?employee_id=&start_date=&end_date=&absence_type=` -> returns `AbsencesIntervalSummary`)
  * `POST /api/v1/absences/`, `POST /api/v1/absences/range`, `PATCH /api/v1/absences/{id}`, `DELETE /api/v1/absences/{id}`
  * `GET /api/v1/absences/export/csv` (`?employee_id=&start_date=&end_date=&absence_type=`, UTF-8 BOM + `;` + formula-injection escaped)
* **Vacations:**
  * `GET /api/v1/vacations/`, `GET /api/v1/vacations/balances` (`?year=`)
  * `POST /api/v1/vacations/`, `PATCH /api/v1/vacations/{id}`, `DELETE /api/v1/vacations/{id}`
* **Performance:** `GET /api/v1/performance/`, `POST /api/v1/performance/`, `PATCH /api/v1/performance/{id}`, `DELETE /api/v1/performance/{id}`
* **Payslips & PDF:**
  * `GET /api/v1/payslips/`, `GET /api/v1/payslips/{id}`, `PUT /api/v1/payslips/{id}`, `DELETE /api/v1/payslips/{id}`
  * `POST /api/v1/payslips/generate-draft`, `POST /api/v1/payslips/generate-batch`
  * `GET /api/v1/payslips/{id}/pdf` (`?inline=true|false`)
  * `GET /api/v1/payslips/export/csv`

---

## 6. Essential Commands

### Run Locally (Production Single-Process Mode)
```bash
cd /home/nedjmo/labHRM/lab-hrm
./start.sh
# App available at http://localhost:8000 (admin@elamel-lab.dz / ElAmelLab2026!)
```

### Development Mode (Hot Reload)
```bash
# Terminal 1 (Backend)
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run fastapi dev app/main.py

# Terminal 2 (Frontend, proxies /api -> 127.0.0.1:8000)
cd /home/nedjmo/labHRM/lab-hrm/frontend
bun run dev
```

### Build, Lint & Automated Tests
```bash
# Backend lint, format & tests (21 tests, isolated temp SQLite DB)
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run ruff check app tests reset_admin.py
uv run ruff format --check app tests reset_admin.py
uv run pytest -v

# Frontend lint, production build (outputs to backend/app/frontend/) & Playwright E2E (3 browser suites)
cd /home/nedjmo/labHRM/lab-hrm/frontend
bun run lint
bun run build
bun run test
```

### CLI Admin Password Reset
```bash
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run python reset_admin.py --email admin@elamel-lab.dz --password "NewPassword123"
```

---

## 7. Important Gotchas & Technical Nuances

1. **SQLite UUIDs (`app/api/deps.py`):** SQLite's SQLAlchemy UUID processor fails if given a raw `str`. Always convert `uuid.UUID(token_data.sub)` before calling `session.get(User, user_id)`.
2. **Pydantic Field Shadowing (`app/models.py`):** `AbsenceBase` has a field named `date`, so the type is imported as `from datetime import date as DateType` to prevent class-scope annotation shadowing in Python 3.14+/3.15.
3. **`StrEnum` + SQLite (`app/models.py`):** Always pair `StrEnum` fields on `table=True` SQLModel classes with `sa_type=String(30)` so SQLite stores lowercase enum values (`"active"`, `"approved"`) rather than uppercase enum member names.
4. **`email-validator` Reserved TLD:** Do not use `.local` domains for `ADMIN_EMAIL` (e.g. `admin@elamelab.local` fails `EmailStr` validation). Use real domain formats like `admin@elamel-lab.dz`.
5. **Always Rebuild Frontend After Route/UI Changes:** FastAPI serves compiled static assets from `backend/app/frontend/`. When adding a new TanStack Router file, run `bun run build` (or `bun run dev`) first so `src/routeTree.gen.ts` updates before `tsc -p tsconfig.build.json` runs.
6. **Playwright `data-testid` Contracts:** Keep existing `data-testid`s intact when modifying dialogs (`emp-full-name`, `emp-job-title`, `emp-base-salary`, `emp-hire-date`, `absence-date`, `interval-start`, `interval-end`, `vac-start`, `vac-end`, `payroll-month-trigger`, `perf-bonus-input`, `edit-other-allowances`, `edit-live-net`, `download-backup-button`), and keep `"Initial hire salary"` intact in `services/employees.py`.
7. **Tailwind v4 `DialogContent` Width:** `ui/dialog.tsx` applies `sm:max-w-lg`. To widen modals on desktop, pass `sm:max-w-2xl` or `sm:max-w-4xl` (not unprefixed `max-w-3xl`).
8. **French Locale Number Formatting (`\u202f`):** `toLocaleString("fr-DZ")` outputs narrow no-break space (`\u202f`). Playwright's `toBeVisible()` normalizes whitespace automatically, while raw DOM checks must account for `\u202f`.
9. **Hyprland Dev Environment:** On Wayland/Hyprland, Chrome DevTools MCP `resize_page` errors; use `emulate({ pageId, viewport: "1440x900x1" })` instead.

---

## 8. Roadmap: Lab Inventory Management & Tauri v2 Desktop Packaging

### Lab Inventory Management (Phase 2 — Implemented)
The inventory and suppliers module is integrated alongside the HR modules:
* **Implemented Domain Entities:** `Supplier`, `Product`, `PurchaseInvoice`, `InvoiceLine`, `Payment`, `Lot`, `StockMovement`, and `AuditLog`.
* **Key Architecture & Business Rules:**
  1. **Derived Stock Ledger:** Quantities are computed strictly by summing signed movements—never stored in mutable columns.
  2. **Decimal Precision:** Exact calculations for prices, payments, and Algerian TVA (19%, 9%, 0%) with banker's rounding.
  3. **Non-blocking Warnings:** If stated totals differ from line items, an amber alert warns the owner without blocking entry.
  4. **Never-Below-Zero Invariant:** Outgoing movements that would push stock negative are rejected with HTTP 400.
  5. **Secure Local Scans:** Attached paper invoices are stored in `backend/data/invoice_scans/` and streamed only through authenticated endpoints.
  6. **Branded French PDF Statement:** `generate_supplier_statement_pdf` creates a full *Relevé de Compte Fournisseur*.
  7. **Feature Toggles in Settings:** Phase B (Lots & Stock) and Phase C (Manual stock out) are toggled from `/settings`.

### Desktop Packaging: **Tauri v2** + Cloudflare Tunnel + GitHub Auto-Update (Implemented)
* **Sidecar Architecture:** Tauri (`frontend/src-tauri/`) bundles the FastAPI + SQLite + `fpdf2` backend (compiled via `PyInstaller` using `scripts/build-sidecar.sh`) as a Tauri sidecar (`tauri-plugin-shell`) on `127.0.0.1:8000`.
* **Zero Web Lock-in:** The web frontend does not import Tauri APIs directly; `frontend/src/lib/platform.ts` provides `isTauri()` runtime detection, automatically switching Axios `baseURL` to `http://127.0.0.1:8000` in desktop mode while keeping `""` in web mode.
* **Data & Signing Secret Storage:** Tauri sets `DATA_DIR=<app_data_dir>/data` and `DATABASE_URL=sqlite:///<app_data_dir>/data/app.db`. SQLite WAL mode (`app.db`), `.secret_key`, and `invoice_scans/` persist automatically inside standard OS user directories outside read-only `Program Files`.
* **System Tray Keep-Alive:** Closing the desktop window hides to system tray (`WindowEvent::CloseRequested` interception) so the FastAPI backend and `cloudflared` remote tunnel stay continuously online. Reopening from the tray menu or clicking the desktop shortcut restores the window without page reload.
* **Remote Access Script & Guide:** Documented in `docs/remote-access-cloudflare.md` with interactive helper script `scripts/setup-tunnel.sh` (supporting Quick Tunnels and permanent Zero Trust named tunnels).
* **Desktop Commands:**
  * Build sidecar binary: `./scripts/build-sidecar.sh`
  * Run desktop app in dev: `cd frontend && bun run tauri:dev`
  * Build release package: `cd frontend && bun run tauri:build`
* **Client Validation Pending:**
  1. Visually review a generated French PDF (*Bulletin de Paie*) with the client.
  2. Confirm Algerian workweek / weekend rules (Fri vs Fri/Sat skipping on multi-day leaves/absences).
  3. Confirm whether statutory Algerian payroll deductions (**CNAS 9%**, **IRG**, **Prime de panier/transport**) need automated calculation lines or if manual editable fields are sufficient.
