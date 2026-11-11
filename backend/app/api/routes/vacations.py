import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Employee,
    Message,
    Vacation,
    VacationBalance,
    VacationCreate,
    VacationPublic,
    VacationsPublic,
    VacationUpdate,
)

router = APIRouter(
    prefix="/vacations",
    tags=["vacations"],
    dependencies=[Depends(get_current_user)],
)


def _to_public(
    vac: Vacation, employees_map: dict[uuid.UUID, Employee]
) -> VacationPublic:
    emp = employees_map.get(vac.employee_id)
    return VacationPublic(
        id=vac.id,
        employee_id=vac.employee_id,
        start_date=vac.start_date,
        end_date=vac.end_date,
        days_count=vac.days_count,
        vacation_type=vac.vacation_type,
        status=vac.status,
        notes=vac.notes,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        created_at=vac.created_at,
    )


@router.get("/", response_model=VacationsPublic)
def read_vacations(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> VacationsPublic:
    """List vacations, supporting overlap filtering by start_date/end_date."""
    stmt = select(Vacation).order_by(col(Vacation.start_date).desc())
    if employee_id:
        stmt = stmt.where(Vacation.employee_id == employee_id)
    if status:
        stmt = stmt.where(Vacation.status == status)
    if start_date and end_date:
        stmt = stmt.where(Vacation.start_date <= end_date).where(
            Vacation.end_date >= start_date
        )
    elif start_date:
        stmt = stmt.where(Vacation.end_date >= start_date)
    elif end_date:
        stmt = stmt.where(Vacation.start_date <= end_date)

    vacations = session.exec(stmt).all()
    employees = {e.id: e for e in session.exec(select(Employee)).all()}
    data = [_to_public(v, employees) for v in vacations]
    return VacationsPublic(data=data, count=len(data))


@router.get("/balances", response_model=list[VacationBalance])
def read_vacation_balances(
    session: SessionDep,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> list[VacationBalance]:
    """Get annual vacation balances for all active employees."""
    target_year = year or date.today().year
    employees = session.exec(
        select(Employee)
        .where(Employee.status != "terminated")
        .order_by(col(Employee.full_name))
    ).all()

    balances: list[VacationBalance] = []
    for emp in employees:
        taken, pending, remaining = crud.calculate_vacation_balance(
            session=session, employee=emp, year=target_year
        )
        balances.append(
            VacationBalance(
                employee_id=emp.id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                year=target_year,
                annual_allowance=emp.annual_vacation_days,
                days_taken=taken,
                days_pending=pending,
                days_remaining=remaining,
            )
        )
    return balances


@router.post("/", response_model=VacationPublic)
def create_vacation(session: SessionDep, vac_in: VacationCreate) -> VacationPublic:
    """Create a vacation record for an employee."""
    if vac_in.end_date < vac_in.start_date:
        raise HTTPException(
            status_code=400, detail="end_date cannot be before start_date."
        )

    emp = session.get(Employee, vac_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check overlapping approved/pending vacations
    overlap = session.exec(
        select(Vacation)
        .where(Vacation.employee_id == vac_in.employee_id)
        .where(Vacation.status != "rejected")
        .where(Vacation.start_date <= vac_in.end_date)
        .where(Vacation.end_date >= vac_in.start_date)
    ).first()
    if overlap:
        raise HTTPException(
            status_code=400,
            detail="This employee already has a scheduled vacation overlapping these dates.",
        )

    days_count = (vac_in.end_date - vac_in.start_date).days + 1
    vac = Vacation.model_validate(vac_in, update={"days_count": days_count})
    session.add(vac)
    session.commit()
    session.refresh(vac)
    return _to_public(vac, {emp.id: emp})


@router.patch("/{id}", response_model=VacationPublic)
def update_vacation(
    session: SessionDep, id: uuid.UUID, vac_in: VacationUpdate
) -> VacationPublic:
    """Update vacation dates, type, status, or notes."""
    vac = session.get(Vacation, id)
    if not vac:
        raise HTTPException(status_code=404, detail="Vacation not found")

    update_data = vac_in.model_dump(exclude_unset=True)
    new_start = update_data.get("start_date", vac.start_date)
    new_end = update_data.get("end_date", vac.end_date)

    if new_end < new_start:
        raise HTTPException(
            status_code=400, detail="end_date cannot be before start_date."
        )

    update_data["days_count"] = (new_end - new_start).days + 1
    vac.sqlmodel_update(update_data)
    session.add(vac)
    session.commit()
    session.refresh(vac)
    emp = session.get(Employee, vac.employee_id)
    return _to_public(vac, {emp.id: emp} if emp else {})


@router.delete("/{id}", response_model=Message)
def delete_vacation(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete a vacation record."""
    vac = session.get(Vacation, id)
    if not vac:
        raise HTTPException(status_code=404, detail="Vacation not found")
    session.delete(vac)
    session.commit()
    return Message(message="Vacation deleted successfully")
