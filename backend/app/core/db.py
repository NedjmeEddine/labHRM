from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (  # noqa: F401 - ensure all tables registered before create_all
    Absence,
    CompanySettings,
    Employee,
    Payslip,
    PerformanceReview,
    SalaryHistory,
    User,
    Vacation,
)

# Ensure parent directory for SQLite database exists
if settings.DATABASE_URL.startswith("sqlite"):
    db_file_str = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_file_str).resolve().parent.mkdir(parents=True, exist_ok=True)

connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)

if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db(session: Session) -> None:
    SQLModel.metadata.create_all(engine)

    # Seed single admin account
    admin = session.exec(select(User)).first()
    if not admin:
        admin = User(
            email=settings.ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            full_name="Directeur / Administrateur",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)

    # Seed singleton CompanySettings
    company = session.get(CompanySettings, 1)
    if not company:
        company = CompanySettings(
            id=1,
            company_name=settings.PROJECT_NAME,
            currency="DZD",
            working_days_per_month=22,
            default_annual_vacation_days=30,
        )
        session.add(company)

    session.commit()
