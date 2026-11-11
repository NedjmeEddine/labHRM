# Stage 1: Build Frontend Single Page App
FROM oven/bun:1 AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock* /app/frontend/
RUN bun install --frozen-lockfile || bun install

COPY frontend /app/frontend
RUN bun run build

# Stage 2: Python Backend with FastAPI & SQLite
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Install backend dependencies
COPY backend/pyproject.toml /app/backend/
WORKDIR /app/backend
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Copy backend code
COPY backend/app /app/backend/app
COPY backend/reset_admin.py /app/backend/

# Copy compiled frontend from stage 1 into FastAPI static directory
COPY --from=frontend-builder /app/backend/app/frontend /app/backend/app/frontend

# Create persistent storage folder for SQLite database
RUN mkdir -p /app/backend/data

VOLUME ["/app/backend/data"]
EXPOSE 8000

CMD ["uv", "run", "fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
