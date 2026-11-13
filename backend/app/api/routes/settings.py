from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.deps import SessionDep, get_current_user
from app.models import CompanySettings, CompanySettingsUpdate
from app.services import system as system_service

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/company", response_model=CompanySettings)
def read_company_settings(session: SessionDep) -> CompanySettings:
    """Get company and payroll settings."""
    return system_service.get_company_settings(session)


@router.patch("/company", response_model=CompanySettings)
def update_company_settings(
    session: SessionDep, settings_in: CompanySettingsUpdate
) -> CompanySettings:
    """Update company details, working days per month, or default vacation allowance."""
    company = system_service.get_company_settings(session)
    update_data = settings_in.model_dump(exclude_unset=True)
    company.sqlmodel_update(update_data)
    company.updated_at = datetime.now(UTC)
    session.add(company)
    session.commit()
    session.refresh(company)
    return company


@router.get("/backup")
def download_database_backup(session: SessionDep) -> Response:
    """Download a WAL-safe snapshot of the SQLite database."""
    payload, filename = system_service.create_sqlite_backup_bytes(session)
    return Response(
        content=payload,
        media_type="application/x-sqlite3",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
