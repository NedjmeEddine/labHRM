from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"
DEFAULT_DB_PATH = DATA_DIR / "app.db"


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
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "changethis"

    # Frontend host for CORS during dev
    FRONTEND_HOST: str = "http://localhost:5173"


settings = Settings()
