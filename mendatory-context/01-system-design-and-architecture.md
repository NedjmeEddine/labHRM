# System Design & Architecture

> **Purpose:** Document the architectural topology, service-layer patterns, SQLite concurrency, and zero-config deployment mechanisms of EL-AMEL LAB.

---

## 1. High-Level Architectural Topology

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Web Application                        │
│                 (Single-Process Serving Model :8000)                   │
├──────────────────────────────────┬─────────────────────────────────────┤
│        Frontend Delivery         │          REST API Routes            │
│  FastAPI Static Files Mount      │           Prefix: /api/v1           │
│  app.frontend("/", FRONTEND_DIR) │  (/employees, /absences, /payroll)  │
└────────────────┬─────────────────┴──────────────────┬──────────────────┘
                 │                                    │
                 ▼                                    ▼
       Compiled React 19 SPA                 Service Layer
     (TanStack Router + Query)       (Pure Python Business Services)
     (backend/app/frontend/)         (backend/app/services/*)
                                                      │
                                                      ▼
                                            SQLite Database (WAL)
                                            (backend/data/app.db)
```

FastAPI acts as the single web server. In development, Vite runs on port `5173` proxying `/api` requests to `127.0.0.1:8000`. In production, `frontend/` builds directly into `backend/app/frontend/`, and FastAPI serves the compiled SPA and assets with zero reverse proxy dependencies.

---

## 2. Backend Service Layer (`backend/app/services/`)

The backend follows a **pragmatic service-layer pattern**. Route handlers under `backend/app/api/routes/` are strictly thin HTTP adapters:
1. Extract request parameters, path variables, and validated Pydantic bodies.
2. Delegate business logic, transactions, and arithmetic to `backend/app/services/`.
3. Return response models or streaming file responses.

### Service Modules Overview

```text
backend/app/services/
├── __init__.py      # Explicit re-exports (PyInstaller static analysis safe)
├── system.py        # Admin auth, singleton CompanySettings, WAL-safe SQLite backups
├── employees.py     # Employee CRUD, SQL ilike search, EMP-xxx code generator, salary history
├── absences.py      # Absence weights, interval calculations, date-range expansion
├── vacations.py     # Date overlap checking, cross-year vacation balances
├── payroll.py       # Draft payslip builder, batch generation, gross/net recalculation
└── csv_export.py    # Reusable UTF-8 BOM semicolon CSV response builder with injection defense
```

### PyInstaller-Safe Static Imports Rule
All service modules must be explicitly imported and re-exported in `services/__init__.py`. **Do not use dynamic module scanning (`importlib.import_module`, `pkgutil.walk_packages`)**, as dynamic imports fail when the backend is packaged by PyInstaller as a desktop sidecar.

---

## 3. SQLite Concurrency, WAL Mode & Pragmas

SQLite is configured for safe multi-read / single-writer concurrency across simultaneous local and remote accesses:

```python
# backend/app/core/db.py
def apply_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any = None) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")       # Enforce relational integrity & cascade deletes
    cursor.execute("PRAGMA journal_mode=WAL")      # Write-Ahead Logging: non-blocking concurrent reads
    cursor.execute("PRAGMA synchronous=NORMAL")    # Fast safe fsync in WAL mode
    cursor.execute("PRAGMA busy_timeout=5000")     # Wait up to 5s on locks before raising OperationalError
    cursor.close()
```

### Zero-Alembic Schema & Index Migration
Because the project uses `SQLModel.metadata.create_all()` without Alembic:
* `create_all()` creates missing tables but does **not** add newly declared unique constraints to pre-existing tables in existing `.db` files.
* `init_db()` executes idempotent index creation on startup:
  ```python
  def _ensure_sqlite_unique_indexes(session: Session) -> None:
      index_statements = (
          "CREATE UNIQUE INDEX IF NOT EXISTS uq_absence_employee_date_idx ON absence (employee_id, date)",
          "CREATE UNIQUE INDEX IF NOT EXISTS uq_payslip_employee_period_idx ON payslip (employee_id, month, year)",
      )
      for stmt in index_statements:
          try:
              session.exec(text(stmt))
          except IntegrityError:
              logger.warning("Could not enforce unique index due to pre-existing duplicate rows.")
  ```

---

## 4. Zero-Config Secret Key Persistence

To support one-click `./start.sh` execution and desktop installers without forcing the user to create a `.env` file manually:
1. `backend/app/core/config.py` identifies placeholder secrets (`replace-this-secret-key...`, `generate_a_secure_random_key_here`, etc.).
2. When a placeholder is detected, `load_or_create_secret_key()` resolves the storage directory:
   * It locates the active SQLite database path from `DATABASE_URL` and uses its parent directory.
   * If running locally: `backend/data/.secret_key`.
   * If packaged in desktop Tauri: `%APPDATA%\com.elamel-lab.hrm\.secret_key`.
   * Storing the secret next to the database avoids write errors inside read-only `Program Files` or ephemeral PyInstaller `_MEIPASS` directories.
3. If no key file exists, it generates a 64-character cryptographic token (`secrets.token_hex(32)`), writes it with `0o600` permissions, and re-reads it on subsequent startups.

---

## 5. WAL-Safe Database Backup Architecture

Directly copying an active SQLite database in WAL mode from disk can produce a corrupted copy if uncheckpointed transactions remain in `-wal` or `-shm` files.

The application implements a dedicated backup endpoint:
* **Route:** `GET /api/v1/settings/backup` (authenticated).
* **Implementation (`services/system.py`):**
  1. Inspects the active database path from `session.get_bind().url.database`.
  2. Creates a temporary destination file using `tempfile.TemporaryDirectory()`.
  3. Uses SQLite's native backup API:
     ```python
     src_conn = sqlite3.connect(str(source_path))
     dst_conn = sqlite3.connect(str(dest_path))
     try:
         with dst_conn:
             src_conn.backup(dst_conn)
     finally:
         dst_conn.close()
         src_conn.close()
     ```
  4. Flushes all WAL frames cleanly into the snapshot and returns the binary stream with header:
     `Content-Disposition: attachment; filename="el_amel_lab_backup_YYYYMMDD_HHMMSS.db"`.

---

## 6. Remote Access & Desktop Packaging (Target State)

```text
┌───────────────────────────────────────────────────────────────┐
│               LABORATORY OFFICE PC (Source of Truth)          │
│                                                               │
│   [Tauri v2 Desktop App]                                      │
│   (System Tray keep-alive, minimizes on close)                │
│             │                                                 │
│             ▼                                                 │
│   [FastAPI PyInstaller Sidecar] ──► http://127.0.0.1:8000     │
│             ▲                       (Embedded SQLite WAL)     │
│             │                                                 │
│   [cloudflared Service] ────────────┘                         │
└─────────────┼─────────────────────────────────────────────────┘
              │ Encrypted HTTPS Tunnel
              ▼
   [Remote Browser / Owner's Phone]
   https://rh.your-domain.com
```

### CORS Configuration for Desktop & Cloudflare
Because the API uses `Authorization: Bearer <token>` (stored in client storage, not browser cookies), `backend/app/main.py` configures:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Setting `allow_credentials=False` ensures `allow_origins=["*"]` complies strictly with the W3C CORS specification. It cleanly allows cross-origin requests from Tauri WebViews (`http://tauri.localhost` on Windows, `tauri://localhost` on Linux/macOS), local Vite dev (`localhost:5173`), and arbitrary Cloudflare Tunnel domains without configuration changes.
