from pathlib import Path
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import User

# Ensure parent directory for SQLite database exists
if settings.DATABASE_URL.startswith("sqlite"):
    db_file_str = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_file_str).resolve().parent.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)


def init_db(session: Session) -> None:
    # Automatically create tables (no Alembic overhead needed for single-user SQLite)
    SQLModel.metadata.create_all(engine)

    # Check if admin user exists; create initial admin if database is empty
    admin = session.exec(select(User)).first()
    if not admin:
        admin = User(
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            full_name="Business Owner",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        session.commit()
