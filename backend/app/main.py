import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.routing import APIRoute
from sqlmodel import Session
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.db import engine, init_db

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    _bundle_root = Path(sys._MEIPASS)
    FRONTEND_DIR = _bundle_root / "app" / "frontend"
    if not FRONTEND_DIR.is_dir():
        FRONTEND_DIR = _bundle_root / "frontend"
else:
    FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure SQLite tables, indexes, and default admin account exist
    with Session(engine) as session:
        init_db(session)
    yield


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

# Bearer-token auth does not use cookies: allow_credentials=False makes allow_origins=["*"]
# CORS-spec compliant for Tauri v2 WebViews, Cloudflare Tunnels, and Vite dev servers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve built frontend single-page application if directory exists
if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)
