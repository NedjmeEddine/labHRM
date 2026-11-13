# Testing Contracts & QA Guardrails

> **Purpose:** Document testing architecture, isolation strategies, Playwright contract test IDs, and required QA verification commands to prevent regressions.

---

## 1. Test Architecture Overview

The repository enforces end-to-end quality through two decoupled test suites:

1. **Backend Integration Suite (`backend/tests/`):**
   * Uses `pytest` with `TestClient` (HTTP requests against actual FastAPI routes).
   * Runs against an **isolated temporary SQLite database** (`test_hr.db` in `tmp_path`) created fresh for every test run.
   * `backend/tests/conftest.py` patches `engine` and registers `apply_sqlite_pragmas` to guarantee WAL mode and foreign key constraints are active in tests.
2. **Frontend End-to-End Suite (`frontend/tests/`):**
   * Uses `@playwright/test` running in a single worker (`workers: 1`) using system Chromium (`/usr/bin/chromium`).
   * Spawns an isolated FastAPI test instance on port `8002` using a dedicated SQLite database (`backend/data/e2e_test.db`) via `frontend/tests/e2e-server.sh`.
   * Automatically executes login, bilingual language switching, employee creation, calendar intervals, vacations, performance bonus evaluation, interactive payslip editing, French PDF download, and database backup verification.

---

## 2. Inviolable Playwright Contract Test IDs (`data-testid`)

The Playwright browser automation suite in `frontend/tests/hr-workflow.spec.ts` and `frontend/tests/login-and-i18n.spec.ts` relies on explicit `data-testid` contracts. **These attributes must not be renamed, moved to unclickable wrappers, or removed when refactoring components:**

| Test ID | Element Location | Used In Test |
|---|---|---|
| `email-input` | Login screen email input (`login.tsx`) | Admin login |
| `password-input` | Login screen password input (`login.tsx`) | Admin login |
| `emp-full-name` | Employee form full name input (`EmployeeFormDialog.tsx`) | Add Employee workflow |
| `emp-job-title` | Employee form job title input (`EmployeeFormDialog.tsx`) | Add Employee workflow |
| `emp-base-salary` | Employee form base salary input (`EmployeeFormDialog.tsx`) | Add Employee workflow |
| `emp-hire-date` | Employee form hire date input (`EmployeeFormDialog.tsx`) | Add Employee workflow |
| `absence-date` | Absence modal date input (`AbsenceFormDialog.tsx`) | Mark Single Day |
| `interval-start` | Interval checker start date input (`AttendanceFilterBar.tsx`) | Absences verification |
| `interval-end` | Interval checker end date input (`AttendanceFilterBar.tsx`) | Absences verification |
| `vac-start` | Vacation modal start date input (`VacationFormDialog.tsx`) | Schedule leave |
| `vac-end` | Vacation modal end date input (`VacationFormDialog.tsx`) | Schedule leave |
| `payroll-month-trigger` | Payroll page month dropdown trigger (`payroll.tsx`) | Select payroll month |
| `perf-bonus-input` | Performance evaluation bonus input (`PerformanceReviewDialog.tsx`) | Add bonus |
| `edit-other-allowances` | Payslip editor other allowances input (`PayslipEditorDialog.tsx`) | Interactive payslip edit |
| `edit-live-net` | Payslip editor live net pay preview span (`PayslipEditorDialog.tsx`) | Live net salary assertion |
| `download-backup-button` | Settings page backup download button (`CompanySettingsTab.tsx`) | SQLite snapshot download |

### Inviolable String & Binary Assertions
* **Database initial salary string:** When an employee is created, the salary history reason must remain exactly `"Initial hire salary"` (`backend/app/services/employees.py`). Playwright asserts this text on the employee profile page.
* **Downloaded Payslip PDF:** Must return status 200, have `Content-Type: application/pdf`, and start with the binary magic bytes `b"%PDF"`.
* **Downloaded Database Backup:** Must return a filename matching `/^el_amel_lab_backup_.*\.db$/` and start with the SQLite magic string `"SQLite format 3"`.

---

## 3. Backend Test Coverage Matrix (`backend/tests/`)

The 17 automated Pytest tests cover:

1. `test_auth_and_settings.py`:
   * Health check endpoint (`/api/v1/utils/health-check/`) and frontend index serving.
   * Authentication failures, invalid tokens, and 401/403 protections.
   * Admin profile updates and password change validations (rejects wrong current password, rejects identical new password).
   * Company settings read & patch.
   * SQLite backup download verification (verifies `b"SQLite format 3\x00"` header).
   * CORS headers (verifies `Origin: http://tauri.localhost` receives `access-control-allow-origin: *` without credentials).
   * Zero-config `.secret_key` auto-generation and persistence.
2. `test_employees.py`:
   * Employee creation with auto-incrementing `EMP-001`, `EMP-002`.
   * Rejection of duplicate employee codes.
   * Case-insensitive SQL `ilike` text search across name, code, title, and department.
   * Status filtering (`active`, `on_leave`, `terminated`).
   * Chronological salary progression history tracking on creation and manual salary updates.
   * Cascade deletion (deleting an employee cascades to absences and vacations).
   * Rejection of empty/whitespace `employee_code` on `PATCH`.
   * Rejection of invalid enum values on employee creation (HTTP 422).
3. `test_absences.py`:
   * Unpaid full-day and half-day absence recording with estimated interval deduction math.
   * Rejection of duplicate absences on the same date for the same employee on both `POST` and `PATCH`.
   * Absence range marking (skipping existing dates, rejecting ranges > 90 days, rejecting inverted dates).
   * Semicolon-delimited CSV export with UTF-8 BOM.
   * Spreadsheet formula-injection sanitization (escaping `=CMD|...` triggers).
4. `test_vacations.py`:
   * Vacation creation and automatic duration calculation.
   * Rejection of overlapping non-rejected vacations on both `POST` and `PATCH`.
   * Cross-year vacation balance calculation splitting days accurately across calendar boundaries.
   * Pending vs approved balance tracking.
   * Batch vacation balance loading for all active employees.
5. `test_performance_and_payroll.py`:
   * Performance review creation with automated salary raise and `SalaryHistory` logging.
   * Batch payslip generation (excluding terminated employees, preserving edited payslips).
   * Complete payroll formula verification (base salary, daily rate, absence deductions, bonus, gross, and net pay).
   * Manual payslip editing and automatic net pay recalculation.
   * Branded French PDF payslip generation and payroll CSV export.
   * Live dashboard summary metrics computation.
6. `test_pdf_and_cli.py`:
   * PDF generation with long notes and special French characters.
   * Clamping of net pay to `0.0` when deductions exceed gross salary.
   * `reset_admin.py` CLI script password reset verification.

---

## 4. Linting & Formatting Standards

* **Python Linting:** Run via `ruff`:
  ```bash
  cd backend && uv run ruff check app tests reset_admin.py && uv run ruff format --check app tests reset_admin.py
  ```
* **Frontend Linting:** Run via `biome`:
  ```bash
  cd frontend && bun run lint
  ```
  Note: `frontend/biome.json` is configured with schema version `2.6.6` and excludes `test-results`, `playwright-report`, and `src/routeTree.gen.ts`.
