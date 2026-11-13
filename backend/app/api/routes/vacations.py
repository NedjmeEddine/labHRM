import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Message,
    Vacation,
    VacationBalance,
    VacationCreate,
    VacationPublic,
    VacationsPublic,
    VacationStatus,
    VacationUpdate,
)
from app.services import vacations as vacation_service

router = APIRouter(
    prefix="/vacations",
    tags=["vacations"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=VacationsPublic)
def read_vacations(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    status: Annotated[VacationStatus | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> VacationsPublic:
    """List vacations, supporting overlap filtering by start_date/end_date."""
    data = vacation_service.list_vacations(
        session=session,
        employee_id=employee_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
    )
    return VacationsPublic(data=data, count=len(data))


@router.get("/balances", response_model=list[VacationBalance])
def read_vacation_balances(
    session: SessionDep,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> list[VacationBalance]:
    """Get annual vacation balances for all active employees."""
    target_year = year or date.today().year
    return vacation_service.list_vacation_balances(session=session, year=target_year)


@router.post("/", response_model=VacationPublic)
def create_vacation(session: SessionDep, vac_in: VacationCreate) -> VacationPublic:
    """Create a vacation record for an employee."""
    return vacation_service.create_vacation(session=session, vac_in=vac_in)


@router.patch("/{id}", response_model=VacationPublic)
def update_vacation(
    session: SessionDep, id: uuid.UUID, vac_in: VacationUpdate
) -> VacationPublic:
    """Update vacation dates, type, status, or notes."""
    vac = session.get(Vacation, id)
    if not vac:
        raise HTTPException(status_code=404, detail="Vacation not found")
    return vacation_service.update_vacation(session=session, vac=vac, vac_in=vac_in)


@router.delete("/{id}", response_model=Message)
def delete_vacation(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete a vacation record."""
    vac = session.get(Vacation, id)
    if not vac:
        raise HTTPException(status_code=404, detail="Vacation not found")
    session.delete(vac)
    session.commit()
    return Message(message="Vacation deleted successfully")
