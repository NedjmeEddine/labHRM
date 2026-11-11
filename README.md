# EL AME LAB — Single-User Business Management System

A simplified, streamlined, single-process web application tailored specifically for the business owner.

---

## 🚀 Key Improvements & Architecture Highlights

Compared to the multi-container full-stack template:

1. **Zero External Database Services (SQLite)**:
   - Uses embedded SQLite (`backend/data/app.db`).
   - Backups are as simple as copying a single `.db` file.
   - Zero PostgreSQL installation, zero network latency, zero DB configuration.
2. **Single User / Owner Security Model**:
   - Removed public signups, password recovery via SMTP, and multi-tenant user CRUD.
   - The entire app is authenticated for one administrator.
   - Seeded automatically on first startup from `.env`.
   - Built-in CLI password reset tool: `uv run python reset_admin.py --email admin@example.com --password newpass`.
3. **Unified Single-Process Web Serving**:
   - FastAPI natively serves both the REST API (`/api/v1`) and the compiled React single-page frontend.
   - The entire system can run in a single process (`uv run fastapi run`) or a single lightweight Docker container (~50MB RAM).
   - Removed Traefik, Adminer, Mailpit, Playwright containers, and the React-Email monorepo.
4. **Preserved EL AME LAB Branding**:
   - Custom logo, color palette, dark/light theme, and layout components are preserved and fully functional.

---

## 💻 Quick Start (Local Run)

### Method 1: One-Click Script
```bash
./start.sh
```
Open **http://localhost:8000** in your browser.
Default credentials:
* **Email:** `admin@example.com`
* **Password:** `changethis`

### Method 2: Development Mode (Hot Reload)
Run the backend and frontend separately for instant hot-reloading:

**Terminal 1 (Backend):**
```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
bun install
bun run dev
```
Open **http://localhost:5173**.

---

## 🐳 Docker Deployment (Single Container)

Run the full application as a single self-contained Docker container:

```bash
docker compose up -d --build
```
Your SQLite database will be automatically persisted in the `./data` folder on your host machine.

---

## 🔑 Administrative Password Reset

If the admin password is forgotten, run this CLI script from the `backend` folder without needing email recovery:

```bash
cd backend
uv run python reset_admin.py --email admin@example.com --password "YourNewStrongPassword"
```

---

## 🌐 Remote Access & Free Hosting Guide

### Option A: Local PC + Cloudflare Tunnel (Recommended for SQLite & Privacy)
Run the app on the admin's PC and access it securely from anywhere (phone, home laptop) without opening router ports:
1. Install Cloudflare `cloudflared`:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```
2. Create a free Cloudflare Tunnel:
   ```bash
   cloudflared tunnel create el-ame-lab
   ```
3. Route your domain (e.g., `admin.elamelab.com`) directly to `http://localhost:8000`.
4. Benefit: **100% Free SSL, DDoS protection, Zero Trust access login, and persistent local SQLite on the owner's PC.**

### Option B: Cloud Hosting (Render / Fly.io)
* **Fly.io:** Excellent for SQLite. Provides a 1GB persistent volume mounted to `/app/backend/data`.
* **Render Free Tier Warning:** Render free web services have **ephemeral disks** and spin down after 15 minutes of inactivity. **Do not use SQLite on Render Free**, as the database will reset when the instance restarts. If hosting on Render Free, configure `DATABASE_URL` in `.env` to point to a free managed PostgreSQL instance such as **Neon.tech** or **Supabase**.
