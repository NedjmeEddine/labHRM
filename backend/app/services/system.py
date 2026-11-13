import sqlite3
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException
from sqlmodel import Session, select

from app.core.security import verify_password
from app.models import CompanySettings, User

DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def get_company_settings(session: Session) -> CompanySettings:
    company = session.get(CompanySettings, 1)
    if not company:
        company = CompanySettings(id=1)
        session.add(company)
        session.commit()
        session.refresh(company)
    return company


def create_sqlite_backup_bytes(session: Session) -> tuple[bytes, str]:
    """Safely snapshot the active SQLite database (including WAL frames) via sqlite3.backup."""
    bind = session.get_bind()
    if bind.dialect.name != "sqlite":
        raise HTTPException(
            status_code=400,
            detail="Database backup is only supported for SQLite databases.",
        )

    db_file = bind.url.database
    if not db_file or db_file == ":memory:":
        raise HTTPException(
            status_code=400,
            detail="In-memory SQLite databases cannot be exported.",
        )

    source_path = Path(db_file).expanduser().resolve()
    if not source_path.is_file():
        raise HTTPException(status_code=404, detail="SQLite database file not found.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        dest_path = Path(tmp_dir) / "backup.db"
        src_conn = sqlite3.connect(str(source_path))
        dst_conn = sqlite3.connect(str(dest_path))
        try:
            with dst_conn:
                src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
            src_conn.close()
        payload = dest_path.read_bytes()

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"el_amel_lab_backup_{timestamp}.db"
    return payload, filename
