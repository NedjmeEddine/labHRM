from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import CompanySettings, CompanySettingsUpdate

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/company", response_model=CompanySettings)
def read_company_settings(session: SessionDep) -> CompanySettings:
    """Get company and payroll settings."""
    return crud.get_company_settings(session)


@router.patch("/company", response_model=CompanySettings)
def update_company_settings(
    session: SessionDep, settings_in: CompanySettingsUpdate
) -> CompanySettings:
    """Update company details, working days per month, or default vacation allowance."""
    company = crud.get_company_settings(session)
    update_data = settings_in.model_dump(exclude_unset=True)
    company.sqlmodel_update(update_data)
    company.updated_at = datetime.now(UTC)
    session.add(company)
    session.commit()
    session.refresh(company)
    return company
