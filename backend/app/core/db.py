import logging
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import get_sqlite_db_path, settings
from app.core.security import get_password_hash
from app.models import (  # noqa: F401 - ensure all tables registered before create_all
    Absence,
    AuditLog,
    CompanySettings,
    Employee,
    InvoiceLine,
    Lot,
    Payment,
    Payslip,
    PerformanceReview,
    Product,
    PurchaseInvoice,
    SalaryHistory,
    StockMovement,
    Supplier,
    User,
    Vacation,
)

logger = logging.getLogger(__name__)

# Ensure parent directory for SQLite database exists
_sqlite_path = get_sqlite_db_path(settings.DATABASE_URL)
if _sqlite_path is not None:
    _sqlite_path.parent.mkdir(parents=True, exist_ok=True)

connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)


def apply_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any = None) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


if settings.DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", apply_sqlite_pragmas)


def _ensure_sqlite_unique_indexes(session: Session) -> None:
    """Idempotently add unique indexes for legacy SQLite databases created before constraints."""
    bind = session.get_bind()
    if bind.dialect.name != "sqlite":
        return

    index_statements = (
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_absence_employee_date_idx ON absence (employee_id, date)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_payslip_employee_period_idx ON payslip (employee_id, month, year)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_name_idx ON supplier (name)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sku_idx ON product (reference_code)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_product_number_idx ON lot (product_id, lot_number)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_supplier_number_idx ON purchaseinvoice (supplier_id, invoice_number)",
    )
    for stmt in index_statements:
        try:
            session.exec(text(stmt))  # type: ignore[call-overload]
        except IntegrityError:
            logger.warning(
                "Could not enforce unique index (%s) due to pre-existing duplicate rows.",
                stmt,
            )


def _ensure_sqlite_columns(session: Session) -> None:
    """Idempotently add new columns to pre-existing SQLite tables."""
    bind = session.get_bind()
    if bind.dialect.name != "sqlite":
        return

    try:
        existing_cols = {
            row[1]
            for row in session.exec(text("PRAGMA table_info(companysettings)")).all()  # type: ignore[call-overload]
        }
        if "inventory_tracking_enabled" not in existing_cols:
            session.exec(  # type: ignore[call-overload]
                text(
                    "ALTER TABLE companysettings ADD COLUMN inventory_tracking_enabled BOOLEAN DEFAULT 0"
                )
            )
        if "manual_stock_out_enabled" not in existing_cols:
            session.exec(  # type: ignore[call-overload]
                text(
                    "ALTER TABLE companysettings ADD COLUMN manual_stock_out_enabled BOOLEAN DEFAULT 0"
                )
            )
        if "default_expiry_alert_days" not in existing_cols:
            session.exec(  # type: ignore[call-overload]
                text(
                    "ALTER TABLE companysettings ADD COLUMN default_expiry_alert_days INTEGER DEFAULT 60"
                )
            )
        session.commit()
    except (OperationalError, SQLAlchemyError) as exc:
        logger.warning("Could not migrate companysettings columns: %s", exc)


def init_db(session: Session) -> None:
    SQLModel.metadata.create_all(session.get_bind())
    _ensure_sqlite_columns(session)
    _ensure_sqlite_unique_indexes(session)

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
    elif admin.email == "admin@example.com":
        admin.email = settings.ADMIN_EMAIL
        admin.hashed_password = get_password_hash(settings.ADMIN_PASSWORD)
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
