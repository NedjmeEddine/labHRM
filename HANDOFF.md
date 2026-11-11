# EL-AMEL LAB — Complete Project Context & Handoff

> **Purpose of this file:** Give any new developer or AI coding session complete, zero-ambiguity context on why this repository exists, what has been built, how everything works, what was tested, and what comes next.

---

## 1. Project Background & Client Requirements

### Business Context
* **Client:** **EL-AMEL LAB** (medical / biological laboratory, Francophone owner in Algeria).
* **Origin:** Built from scratch in `/home/nedjmo/labHRM/lab-hrm` as a streamlined replacement for the heavy multi-tenant scaffold located in `/home/nedjmo/labHRM/fastapi-template-test` (which had PostgreSQL, Traefik, Adminer, Mailpit, React-Email, Playwright Docker, public signup, and multi-user RBAC).
* **Single-User Constraint:** The business owner is the **only user**. There are no employee logins, no public registrations, no role hierarchies, and no SMTP email recovery servers.

### Language & Localization Strategy
* **Client is Francophone; Developer prefers English.**
* **Backend code, database schema, API routes, TypeScript types, and comments:** 100% **English**.
* **Frontend UI:** Bilingual (`frontend/src/lib/i18n.tsx`) — defaults to **French** (`fr`) for the client, with an instant **`FR ⇄ EN` toggle** (`LanguageSwitcher.tsx`) in the header and login screen for development/testing.
* **Generated Payslip PDFs (*Bulletin de Paie*):** Generated in professional **French**.

### Confirmed Domain Rules
* **Currency:** `DZD` (`XX XXX,XX DZD`).
* **Standard Working Days / Month:** `22` (`daily_rate = base_salary / 22`, configurable in *Paramètres*).
* **Default Annual Vacation Allowance:** `30` days/year (configurable globally and per employee).

---

## 2. Git Repository State

* **Location:** `/home/nedjmo/labHRM/lab-hrm`
* **Current Branch:** `feat/hr-features`
* **Commit History:**
  1. `984d5c6` *(on `main`)* — `feat: initialize simplified single-user EL AME LAB baseline with SQLite`
  2. `49ebecb` *(on `feat/hr-features`)* — `feat(hr): implement employees, absences calendar, vacations, performance, editable payslips & French PDF export`
  3. `8a53a54` *(on `feat/hr-features`)* — `test(hr): add pytest backend test suite and Playwright E2E browser tests`
  4. `87adce7` *(on `feat/hr-features`)* — `fix(ui): resolve /vite.svg 404, widen payslip modal, align calendar brand palette & eliminate table overflow`

*(Note: `HANDOFF.md` and `AGENTS.md` were added right after `87adce7` — commit them if desired.)*

---

## 3. Tech Stack & Architecture

### Single-Process Serving Model
FastAPI serves **both** the REST API (`/api/v1/*`) and the compiled React SPA (`backend/app/frontend/` via `app.frontend("/", directory=FRONTEND_DIR)` in `backend/app/main.py`). No Nginx, Traefik, or external DB daemon is required.

### Backend (`backend/`)
* **Python 3.12+ / `uv` package manager** (`backend/pyproject.toml`, `backend/uv.lock`)
* **FastAPI (`fastapi[standard]`)**
* **SQLite + SQLModel** (`backend/data/app.db` gitignored, auto-created & seeded on startup via `lifespan` -> `init_db`)
* **PyJWT + `pwdlib[argon2,bcrypt]`** (30-day JWT bearer tokens for single-owner convenience)
* **`fpdf2` (pure Python PDF generator)** with bundled UTF-8 `NotoSans` TTF fonts (`backend/app/assets/fonts/`) and logo (`backend/app/assets/el-amel-lab-logo.png`) — zero OS/GTK/Pango dependencies.
* **Testing & Linting:** `pytest`, `ruff`

### Frontend (`frontend/`)
* **React 19 + TypeScript + Vite + `bun`** (`frontend/package.json`, `frontend/bun.lock`)
* **TanStack Router** (file-based routing in `frontend/src/routes/`) + **TanStack Query**
* **Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons**
* **Calendar:** `react-day-picker` v10 + `date-fns` (`fr` and `enUS` locales)
* **Build output:** Compiles straight into `../backend/app/frontend/` (`frontend/vite.config.ts`). Dev server (`bun run dev`) proxies `/api` to `http://127.0.0.1:8000`.
* **Testing & Linting:** `@playwright/test`, `@biomejs/biome`

---

## 4. Database Schema & Business Logic (`backend/app/models.py` & `crud.py`)

`PRAGMA foreign_keys=ON` is enabled on every SQLite connection (`backend/app/core/db.py`), paired with SQLModel `cascade_delete=True`.

1. **`User`:** Single administrator account seeded on first startup (`ADMIN_EMAIL=admin@example.com`, `ADMIN_PASSWORD=changethis` from `core/config.py` / `.env`). Password can be changed in UI (`/settings`) or via CLI (`python reset_admin.py --email ... --password ...`).
2. **`CompanySettings` (Singleton `id=1`):** `company_name` (`EL-AMEL LAB`), `address`, `phone`, `email`, `tax_id` (NIF/RC), `currency` (`DZD`), `working_days_per_month` (`22`), `default_annual_vacation_days` (`30`).
3. **`Employee`:** Auto-generates `EMP-001`, `EMP-002`, ... if `employee_code` is blank. Stores `full_name`, `email`, `phone`, `job_title`, `department`, `hire_date`, `status` (`active` | `on_leave` | `terminated`), `base_salary`, `annual_vacation_days`, `social_security_number` (CNAS), `notes`.
4. **`SalaryHistory`:** Automatically appended whenever an employee is created (`Initial hire salary`), updated via `PATCH /employees/{id}` with a changed salary, or given a permanent raise via `POST /performance/`.
5. **`Absence`:** `employee_id`, `date`, `absence_type` (`unjustified` | `sick` | `justified` | `half_day`), `is_paid`, `reason`.
   * Deduction weight: `0.5` day if `half_day`, else `1.0` day. Paid absences incur `0` deduction.
   * Duplicate `(employee_id, date)` rejected with HTTP `400`.
   * Range endpoint (`POST /absences/range`) skips dates already marked and caps ranges at 90 days.
6. **`Vacation`:** `employee_id`, `start_date`, `end_date`, `days_count` (auto-calculated `(end - start).days + 1`), `vacation_type` (`annual` | `sick` | `unpaid` | `other`), `status` (`approved` | `pending` | `rejected`), `notes`.
   * Rejects overlapping non-rejected vacations.
   * Balance calculation (`crud.calculate_vacation_balance`) splits cross-year vacations accurately per calendar year and counts `annual` + `approved` days against `employee.annual_vacation_days`.
7. **`PerformanceReview`:** `employee_id`, `period_month`, `period_year`, `score` (`1–5`), `bonus_amount`, `new_base_salary` (optional — updates employee salary + creates `SalaryHistory`), `notes`.
8. **`Payslip`:** Snapshot + editable payroll ledger per `(employee_id, month, year)`:
   * Draft formula (`crud.build_payslip_draft`):
     * `daily_rate = employee.base_salary / working_days_per_month`
     * `unpaid_days` = unpaid `Absence` weights in month + `unpaid` approved `Vacation` days overlapping month
     * `absence_deduction = round(unpaid_days * daily_rate, 2)`
     * `worked_days = max(0, working_days_per_month - unpaid_days)`
     * `performance_bonus` = sum of `PerformanceReview.bonus_amount` for `(month, year)`
     * `gross_salary = base_salary + performance_bonus + other_allowances + overtime_pay`
     * `net_salary = max(0, gross_salary - absence_deduction - other_deductions)`
   * Batch generation (`POST /payslips/generate-batch`) processes all `active` employees (skips `terminated`, preserves already existing/edited/paid payslips unless single-draft `overwrite: true` is passed).
   * Editing (`PUT /payslips/{id}`) persists admin overrides and recomputes `gross_salary` / `net_salary`.
   * PDF (`GET /payslips/{id}/pdf`) renders French *Bulletin de Paie* via `backend/app/pdf_generator.py`.

---

## 5. Complete API Routes (`backend/app/api/routes/`)

All routers except `/login/*` and `/utils/health-check/` require a valid Bearer JWT (`Depends(get_current_user)`).

* **Auth & Admin (`/api/v1`):**
  * `POST /login/access-token`, `POST /login/test-token`
  * `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`
  * `GET /utils/health-check/`
* **Dashboard:** `GET /api/v1/dashboard/` (active/total staff, absent today, on vacation today, current month payroll, upcoming 30-day vacations)
* **Company Settings:** `GET /api/v1/settings/company`, `PATCH /api/v1/settings/company`
* **Employees:**
  * `GET /api/v1/employees/` (`?status=&search=`), `POST /api/v1/employees/`
  * `GET /api/v1/employees/{id}`, `PATCH /api/v1/employees/{id}`, `DELETE /api/v1/employees/{id}`
  * `GET /api/v1/employees/{id}/salary-history`
  * `GET /api/v1/employees/{id}/vacation-balance` (`?year=`)
* **Absences:**
  * `GET /api/v1/absences/` (`?employee_id=&start_date=&end_date=&absence_type=` -> returns `AbsencesIntervalSummary`)
  * `POST /api/v1/absences/`, `POST /api/v1/absences/range`, `PATCH /api/v1/absences/{id}`, `DELETE /api/v1/absences/{id}`
  * `GET /api/v1/absences/export/csv` (UTF-8 BOM + `;` delimiter for French Excel)
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

## 6. Frontend Routes & Key Files (`frontend/src/`)

* `routes/login.tsx` — Single-admin login (`AuthLayout` + `LanguageSwitcher`)
* `routes/_layout.tsx` — Main sidebar shell + top bar with `LanguageSwitcher`
* `routes/_layout/index.tsx` — Executive HR Dashboard (`/`)
* `routes/_layout/employees/index.tsx` — Searchable employee table + Add/Edit modal (`/employees`)
* `routes/_layout/employees/$employeeId.tsx` — 360° Employee Profile (Overview, Absences, Vacations, Salary Progression History, Payslip Archive)
* `routes/_layout/attendance.tsx` — Absences & Calendar (`DayPicker` range selector + color-coded absence/vacation markers + Interval Checker + CSV export + Single/Range marking modals)
* `routes/_layout/vacations.tsx` — Vacation balance progress cards + Leave management table (`/vacations`)
* `routes/_layout/payroll.tsx` — Payslips & Performance (`Generate All`, `Generate Single`, CSV export, Interactive Editable Payslip Editor with live preview, PDF preview/download, 1–5★ Performance evaluation modal)
* `routes/_layout/settings.tsx` — Tabs: *Entreprise & Paie*, *Mon profil*, *Mot de passe*
* `lib/hr-api.ts` — Axios client with auth/401 interceptors + typed HR APIs + `downloadAuthenticatedFile` helper
* `lib/i18n.tsx` — `I18nProvider`, `useTranslation()`, `formatDZD()`, `MONTHS_FR`, `MONTHS_EN`

---

## 7. Essential Commands

### Run Locally (Production Single-Process Mode)
```bash
cd /home/nedjmo/labHRM/lab-hrm
./start.sh
# App available at http://localhost:8000 (admin@example.com / changethis)
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

### Build & Lint
```bash
# Backend lint/format
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run ruff check app tests reset_admin.py
uv run ruff format --check app tests reset_admin.py

# Frontend lint & production build (outputs to backend/app/frontend/)
cd /home/nedjmo/labHRM/lab-hrm/frontend
bun run lint
bun run build
```

### Automated Tests
```bash
# Backend Pytest (13 tests, isolated temp SQLite DB)
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run pytest -v

# Frontend Playwright E2E (2 browser tests, uses /usr/bin/chromium & isolated port 8002 DB)
cd /home/nedjmo/labHRM/lab-hrm/frontend
bun run build && bun run test
```

### CLI Admin Password Reset
```bash
cd /home/nedjmo/labHRM/lab-hrm/backend
uv run python reset_admin.py --email admin@example.com --password "NewPassword123"
```

---

## 8. Important Gotchas & Technical Nuances

1. **SQLite UUIDs (`app/api/deps.py`):** SQLite's SQLAlchemy UUID processor fails if given a raw `str`. Always convert `uuid.UUID(token_data.sub)` before calling `session.get(User, user_id)`.
2. **Pydantic Field Shadowing (`app/models.py`):** `AbsenceBase` has a field named `date`, so the type is imported as `from datetime import date as DateType` to prevent class-scope annotation shadowing in Python 3.14+/3.15.
3. **`email-validator` Reserved TLD:** Do not use `.local` domains for `ADMIN_EMAIL` (e.g. `admin@elamelab.local` fails `EmailStr` validation). Stick to `admin@example.com` or real domains.
4. **Always Rebuild Frontend After Route/UI Changes:** FastAPI serves compiled static assets from `backend/app/frontend/`. Also, if adding a new TanStack Router file, run `bunx vite build` (or `bun run dev`) first so `src/routeTree.gen.ts` updates before `tsc -p tsconfig.build.json` runs.
5. **Tailwind v4 `DialogContent` Width:** `ui/dialog.tsx` applies `sm:max-w-lg`. To widen modals on desktop, pass `sm:max-w-2xl` or `sm:max-w-4xl` (not unprefixed `max-w-3xl`).
6. **`DayPicker` CSS Cascade (`attendance.tsx`):** `react-day-picker/style.css` overrides `index.css`, so brand `--rdp-accent-*` variables are passed inline via `<DayPicker style={...} />`.
7. **French Locale Number Formatting (`\u202f`):** `toLocaleString("fr-DZ")` outputs narrow no-break space (`\u202f`). Playwright's `toBeVisible()` normalizes whitespace automatically, while raw DOM checks must account for `\u202f`.
8. **Hyprland Dev Environment:** On Wayland/Hyprland, Chrome DevTools MCP `resize_page` errors; use `emulate({ pageId, viewport: "1440x900x1" })` instead.

---

## 9. Target Desktop + Remote Deployment & GitHub Auto-Update Plan

### Approved Desktop Choice: **Tauri v2** (NOT Electron)
* **Decision:** Use **Tauri v2** instead of Electron.js for smaller binary size (~15–50 MB vs ~150+ MB), lower RAM/CPU usage via native OS WebView (WebView2 on Windows), and minimal configuration.
* **Sidecar Pattern:** Tauri (`src-tauri/`) bundles the FastAPI + SQLite + `fpdf2` backend (compiled via `PyInstaller`) as a Tauri sidecar (`tauri-plugin-shell`).

### Target Hybrid Deployment Topology (Work PC Backend + Cloudflare Remote Access)
```
┌───────────────────────────────────────────────────────────┐
│              OFFICE / WORK PC (Source of Truth)           │
│                                                           │
│  [Tauri v2 Window + Tray] ──► http://127.0.0.1:8000       │
│  (Hides to tray on close)     (FastAPI Sidecar + SQLite)  │
│                               SQLite in %APPDATA% (WAL)   │
│  [cloudflared service] ───────┘         ▲                 │
└─────────────────────────────────────────┼─────────────────┘
                                          │ Encrypted HTTPS
                                          ▼
                        [Owner's Phone / Home PC Browser]
                           https://rh.your-domain.com
```
1. **Work PC as Live Server:**
   * Tauri spawns the FastAPI sidecar on a **fixed localhost port** (e.g., `127.0.0.1:8000`) so `cloudflared` always knows where to forward traffic.
   * Store SQLite outside `Program Files` in OS `app_data_dir` (e.g., `%APPDATA%\com.elamel-lab.hrm\app.db`), passed via `DATABASE_URL` env var.
   * **System Tray (`TrayIconBuilder`) + Autostart (`tauri-plugin-autostart`):** Closing the Tauri window minimizes to the system tray instead of killing the FastAPI sidecar, keeping remote access active. Disable Windows sleep while plugged in.
   * **SQLite WAL Mode:** Enable `PRAGMA journal_mode=WAL` in `backend/app/core/db.py` so simultaneous Work PC + Phone reads/writes never hit lock errors.
2. **Remote Access via Cloudflare Tunnel (`cloudflared`):**
   * Exposes `127.0.0.1:8000` over HTTPS with free SSL, zero router port forwarding, and optional Cloudflare Zero Trust Access protection.
   * *(Fallback if Work PC cannot stay powered on after hours: deploy the Docker container to Fly.io with a 1GB persistent SQLite volume or a VPS. **Render Free Tier Warning:** Render free web services wipe local files on sleep/restart — never run local SQLite on Render Free without external managed Postgres like Neon/Supabase.)*

### Planned Feature: GitHub-Powered In-App Update Button
The business owner needs an in-app **"Vérifier les mises à jour / Update App"** button to keep the application up to date from code stored in **GitHub**:
1. **Recommended for Tauri Desktop App (`tauri-plugin-updater` + GitHub Releases):**
   * Set up **GitHub Actions** (`.github/workflows/release.yml` on `windows-latest`) triggered on git version tags (`v*`): builds React (`bun run build`), compiles FastAPI (`PyInstaller`), packages Tauri installer + signed `latest.json`, and publishes a **GitHub Release**.
   * Inside Settings (`/settings`, desktop mode), the Update button triggers `@tauri-apps/plugin-updater` (`check()` -> `downloadAndInstall()`), automatically backing up `app.db` in `app_data_dir/backups/` before replacing binaries and restarting the sidecar cleanly.
2. **Alternative for Git-Deployed Host (`GET /api/v1/system/update-status`, `POST /api/v1/system/update`):**
   * Checks GitHub API (`commits/main` or `releases/latest`) against local commit/version.
   * On click: creates timestamped SQLite backup -> pulls code/release artifact from GitHub -> syncs `uv`/frontend assets -> restarts supervised service.
3. Because remote phone/home browsers load directly from the Work PC's FastAPI server, updating the Work PC automatically updates remote access too.

### Recommended Next Steps (Not Yet Done)
1. **Client Validation & Business Rules Confirmation:**
   * Visually review a generated French PDF (*Bulletin de Paie*) with the client.
   * Confirm Algerian workweek / weekend days (e.g., should multi-day vacations/absence ranges skip Fri/Sat or Fri automatically?).
   * Confirm whether statutory Algerian payroll deductions (**CNAS 9%**, **IRG**, **Prime de panier/transport**) need automated calculation lines or if manual editable fields are sufficient.
2. **Pre-Packaging Hardening:**
   * Enable SQLite WAL mode (`PRAGMA journal_mode=WAL`) in `backend/app/core/db.py`.
   * Add a one-click **"Télécharger sauvegarde (.db)"** button in Settings (`/settings`) + backend backup endpoint.
   * Merge `feat/hr-features` into `main` once validated.
3. **Desktop + Auto-Update + Tunnel Implementation (`feat/tauri-desktop` branch):**
   * Add `src-tauri/` (Tauri v2 + `tauri-plugin-shell` sidecar + `TrayIconBuilder` + `tauri-plugin-autostart` + `tauri-plugin-updater`).
   * Add `PyInstaller` spec for FastAPI backend (bundling `app/frontend`, `app/assets/fonts`, `app/assets/el-amel-lab-logo.png`).
   * Add GitHub Actions workflow on `windows-latest` to build signed Windows installers & `latest.json` to GitHub Releases.
   * Configure `cloudflared` tunnel on Work PC pointing to `http://127.0.0.1:8000`.

---

## 10. Known Minor Cleanups & Audit Notes

1. **Dual Frontend API Clients (`@/client` vs `lib/hr-api.ts`):**
   * `main.tsx`, `hooks/useAuth.ts`, `UserSettings/UserInformation.tsx`, and `UserSettings/ChangePassword.tsx` still use the template's generated `@/client` (`LoginService`, `UsersService`).
   * All new HR routes use `frontend/src/lib/hr-api.ts`.
   * `frontend/src/client/` and `useAuth.ts` (`signUpMutation`) still contain unused template artifacts (`ItemsService`, `registerUser`) since `openapi-ts` was not re-run. Do not delete `src/client/` without migrating `useAuth.ts`, `UserInformation.tsx`, and `ChangePassword.tsx` to `hr-api.ts` (or regenerating `openapi-ts`).
2. **Remaining Unlocalized Template Strings:**
   * `UserInformation.tsx`, `ChangePassword.tsx`, and the `Light`/`Dark`/`System` items in `Appearance.tsx` still use hardcoded English copy instead of `useTranslation()`.
   * Success toast strings on HR mutations (`"Employé ajouté"`, `"Congé enregistré"`, etc.) are currently French-only regardless of `FR/EN` toggle.
3. **Environment & Docker Notes:**
   * Root `.env` does not exist yet (only `.env.example`), so the app defaults to `admin@example.com` / `changethis` and a dev `SECRET_KEY`. Always create `.env` with strong values before any live deployment.
   * `frontend/.env` sets `VITE_API_URL=` (empty) so compiled builds call relative `/api/v1` paths cleanly.
   * `Dockerfile` and `docker-compose.yml` have not been tested via `docker build` in this session (if using `--frozen`, update `Dockerfile` to copy `backend/uv.lock*` alongside `backend/pyproject.toml`).
4. **Sibling Reference Folder:** `/home/nedjmo/labHRM/fastapi-template-test/` is the original template workspace and is unrelated to runtime execution of `lab-hrm`.
