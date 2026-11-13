# Business Logic & Domain Rules

> **Purpose:** Provide complete, zero-ambiguity documentation of all human resources, payroll calculation, attendance weighting, and French document generation rules for EL-AMEL LAB.

---

## 1. Domain Entities & Database Models (`backend/app/models.py`)

All database models use `SQLModel`. Enumerated status and type columns are defined using Python `StrEnum` mapped to SQLAlchemy `sa_type=String(30)` so lowercase strings are stored in SQLite while providing strict Pydantic API validation:

```python
class EmployeeStatus(StrEnum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"

class AbsenceType(StrEnum):
    UNJUSTIFIED = "unjustified"
    SICK = "sick"
    JUSTIFIED = "justified"
    HALF_DAY = "half_day"

class VacationType(StrEnum):
    ANNUAL = "annual"
    SICK = "sick"
    UNPAID = "unpaid"
    OTHER = "other"

class VacationStatus(StrEnum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"

class PaymentMethod(StrEnum):
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHECK = "check"

class PayslipStatus(StrEnum):
    DRAFT = "draft"
    PAID = "paid"
```

---

## 2. Attendance & Absence Rules (`backend/app/services/absences.py`)

1. **Uniqueness:** An employee can have at most **one** absence record on any given date.
   * Enforced in the database via `UniqueConstraint("employee_id", "date")`.
   * Enforced in application code on both `POST /api/v1/absences/` and `PATCH /api/v1/absences/{id}` (returns HTTP 400 if duplicate).
2. **Absence Deduction Weighting:**
   $$\text{weight} = \begin{cases} 0.5 \text{ days} & \text{if } \text{absence\_type} = \text{HALF\_DAY} \\ 1.0 \text{ days} & \text{otherwise} \end{cases}$$
   * If `is_paid = True` (e.g. approved sick leave or justified medical certificate), the deduction weight is **0.0 days**.
3. **Absence Date Range Marking (`POST /api/v1/absences/range`):**
   * Validates `start_date <= end_date` (HTTP 400 if inverted).
   * Restricts range length to a maximum of **90 days** (longer leaves must be scheduled as Vacations).
   * Iterates through every calendar date in the range: dates that already have an absence recorded for the employee are skipped silently; new records are created for unoccupied dates.

---

## 3. Vacation Management & Balance Computation (`backend/app/services/vacations.py`)

1. **Overlap Rejection:**
   * Non-rejected vacations (`status != VacationStatus.REJECTED`) cannot overlap in time for the same employee:
     $$\text{start}_A \le \text{end}_B \quad \text{and} \quad \text{end}_A \ge \text{start}_B$$
   * Enforced in `validate_vacation_dates_and_overlap()` on **both** vacation creation (`POST`) and update (`PATCH`). On update, the current vacation ID is excluded from the query so non-date modifications succeed.
2. **Duration Calculation:**
   $$\text{days\_count} = (\text{end\_date} - \text{start\_date}).\text{days} + 1$$
3. **Cross-Year Splitting Algorithm:**
   * When an employee takes a vacation that spans two calendar years (e.g. `2026-12-28` to `2027-01-04`):
     $$\text{overlap\_start} = \max(\text{start\_date}, \text{Jan 1 of Target Year})$$
     $$\text{overlap\_end} = \min(\text{end\_date}, \text{Dec 31 of Target Year})$$
     $$\text{days\_in\_year} = (\text{overlap\_end} - \text{overlap\_start}).\text{days} + 1$$
   * Only days falling within the targeted calendar year are counted against that year's balance.
4. **Annual Balance Formulas (`calculate_balance_from_vacations`):**
   * $\text{days\_taken}$: Total days of `annual` vacations with `status = APPROVED` overlapping the year.
   * $\text{days\_pending}$: Total days of `annual` vacations with `status = PENDING` overlapping the year.
   * $\text{days\_remaining} = \max(0, \text{annual\_allowance} - \text{days\_taken})$.
5. **Batch Balances (`GET /api/v1/vacations/balances`):**
   * Loads all active employees (`status != TERMINATED`) and queries overlapping annual vacations in **two SQL queries**, avoiding N+1 loops.

---

## 4. Payroll Arithmetic & Payslip Engine (`backend/app/services/payroll.py`)

Payslips are managed on a per-employee monthly ledger `(employee_id, month, year)` enforced by `UniqueConstraint("employee_id", "month", "year")`.

### The Core Payroll Formulas

1. **Daily Rate:**
   $$\text{daily\_rate} = \frac{\text{base\_salary}}{\text{working\_days\_per\_month}} \quad (\text{default working days} = 22)$$
2. **Unpaid Absence & Leave Days in Month:**
   $$\text{unpaid\_days} = \sum_{\text{absences in month}} \text{weight}(\text{unpaid}) + \sum_{\text{unpaid vacations in month}} \text{days}$$
3. **Absence Deduction:**
   $$\text{absence\_deduction} = \text{round}(\text{unpaid\_days} \times \text{daily\_rate}, 2)$$
4. **Worked Days:**
   $$\text{worked\_days} = \max(0.0, \text{working\_days\_per\_month} - \text{unpaid\_days})$$
5. **Performance Bonus:**
   $$\text{performance\_bonus} = \sum_{\text{reviews for (month, year)}} \text{bonus\_amount}$$
6. **Gross Salary:**
   $$\text{gross\_salary} = \text{round}(\text{base\_salary} + \text{performance\_bonus} + \text{other\_allowances} + \text{overtime\_pay}, 2)$$
7. **Net Salary (Clamped to Zero):**
   $$\text{net\_salary} = \text{round}(\max(0.0, \text{gross\_salary} - \text{absence\_deduction} - \text{other\_deductions}), 2)$$

### Batch & Draft Rules
* **Batch Generation (`POST /api/v1/payslips/generate-batch`):**
  * Iterates over all employees with `status = ACTIVE`.
  * Terminated employees (`status = TERMINATED`) are skipped.
  * Existing payslips for the month/year are **not overwritten** by batch runs.
* **Single Draft Overwrite (`POST /api/v1/payslips/generate-draft`):**
  * When `overwrite = False`, returns the existing payslip unchanged.
  * When `overwrite = True`, recalculates figures from current base salary, absences, approved vacations, and performance bonuses, while preserving manually entered allowances and deductions.
* **Manual Edits (`PUT /api/v1/payslips/{id}`):**
  * Allows the admin to adjust allowances, overtime, deductions, payment method, status, or notes.
  * Always calls `recompute_payslip_totals()` to ensure `gross_salary` and `net_salary` match the inputs.

---

## 5. Chronological Salary Progression (`backend/app/services/employees.py`)

A permanent audit log of employee compensation is stored in `SalaryHistory`:
* Created automatically on employee hire: `previous_salary = 0.0`, `new_salary = base_salary`, `reason = "Initial hire salary"`.
* Created automatically when `base_salary` is updated via `PATCH /api/v1/employees/{id}`: records the previous salary, new salary, and optional `salary_change_reason`.
* Created automatically when a performance evaluation (`POST /api/v1/performance/`) specifies a `new_base_salary` that differs from the employee's current salary.

---

## 6. CSV Formula Injection Defense (`backend/app/services/csv_export.py`)

When exporting attendance or payroll data to CSV for French Microsoft Excel:
1. Files are encoded with a UTF-8 Byte Order Mark (`\ufeff`) and use semicolon (`;`) delimiters.
2. Any string cell starting with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote (`'`), while legitimate numeric strings (including negative numbers like `-1500.00`) remain untouched.

---

## 7. Branded French Payslip PDF Specification (`backend/app/pdf_generator.py`)

* **Engine:** Pure Python `fpdf2` using bundled `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` fonts and the EL-AMEL LAB logo. Zero OS C-library dependencies (no Pango, GTK, or Cairo).
* **Color Palette:**
  * Primary Brand Blue: `RGB(0, 86, 150)`
  * Deep Navy: `RGB(0, 45, 90)`
  * Light Mist Fill: `RGB(230, 241, 248)`
  * Border Stroke: `RGB(199, 220, 236)`
  * Deduction Crimson: `RGB(189, 21, 58)`
* **Number Formatting:** French format using commas for decimals (`f"{amount:,.2f}".replace(",", " ").replace(".", ",")`).
* **Text Fitting:** `_fit_text()` uses font metrics to clip long employee names and titles with an ellipsis (`…`), preventing text overflow across table boundaries.
* **Page-Break Protection:** Checks cursor position before signatures (`if y > 230: pdf.add_page()`) so employer cachet and employee signature boxes never overlap footer text.
