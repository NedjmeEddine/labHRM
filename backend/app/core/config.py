import os
import secrets
import sys
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    BACKEND_DIR = Path(sys._MEIPASS)
else:
    BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

DATA_DIR = Path(os.environ.get("DATA_DIR", BACKEND_DIR / "data")).resolve()
DEFAULT_DB_PATH = DATA_DIR / "app.db"

PLACEHOLDER_SECRET_KEYS = frozenset(
    {
        "",
        "replace-this-secret-key-in-production-random-hex-string",
        "generate_a_secure_random_key_here",
        "replace-with-a-secure-random-key-in-prod",
    }
)


def get_sqlite_db_path(database_url: str) -> Path | None:
    """Extract resolved filesystem path for file-based SQLite URLs, or None."""
    url = make_url(database_url)
    if not url.drivername.startswith("sqlite"):
        return None
    if not url.database or url.database == ":memory:":
        return None
    return Path(url.database).expanduser().resolve()


def load_or_create_secret_key(key_dir: Path) -> str:
    """Persist an auto-generated signing secret beside the app database for zero-config installs."""
    key_file = key_dir / ".secret_key"
    if key_file.is_file():
        existing = key_file.read_text(encoding="utf-8").strip()
        if existing:
            return existing

    key_dir.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_hex(32)
    key_file.write_text(generated, encoding="utf-8")
    try:
        os.chmod(key_file, 0o600)
    except OSError:
        pass
    return generated


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR.parent / ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "EL-AMEL LAB"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "replace-this-secret-key-in-production-random-hex-string"

    # 30 days token expiry for single-owner convenience
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30

    # Default SQLite in data/ folder; can be overridden via environment variable
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH}"

    # Default single admin credentials (initialized on first boot)
    ADMIN_EMAIL: str = "admin@elamel-lab.dz"
    ADMIN_PASSWORD: str = "ElAmelLab2026!"

    # Frontend host for CORS during dev
    FRONTEND_HOST: str = "http://localhost:5173"

    def model_post_init(self, context: Any, /) -> None:
        if self.SECRET_KEY.strip() in PLACEHOLDER_SECRET_KEYS:
            db_path = get_sqlite_db_path(self.DATABASE_URL)
            key_dir = db_path.parent if db_path is not None else DATA_DIR
            self.SECRET_KEY = load_or_create_secret_key(key_dir)


settings = Settings()
