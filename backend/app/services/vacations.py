import uuid
from collections import defaultdict
from collections.abc import Iterable
from datetime import date

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import (
    Employee,
    EmployeeStatus,
    Vacation,
    VacationBalance,
    VacationCreate,
    VacationPublic,
    VacationStatus,
    VacationType,
    VacationUpdate,
)
from app.services.employees import get_employees_map


def to_vacation_public(
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


def validate_vacation_dates_and_overlap(
    *,
    session: Session,
    employee_id: uuid.UUID,
    start_date: date,
    end_date: date,
    status: VacationStatus | str,
    exclude_vacation_id: uuid.UUID | None = None,
) -> int:
    if end_date < start_date:
        raise HTTPException(
            status_code=400, detail="end_date cannot be before start_date."
        )

    if status != VacationStatus.REJECTED:
        stmt = (
            select(Vacation)
            .where(Vacation.employee_id == employee_id)
            .where(Vacation.status != VacationStatus.REJECTED)
            .where(Vacation.start_date <= end_date)
            .where(Vacation.end_date >= start_date)
        )
        if exclude_vacation_id is not None:
            stmt = stmt.where(Vacation.id != exclude_vacation_id)
        if session.exec(stmt).first():
            raise HTTPException(
                status_code=400,
                detail="This employee already has a scheduled vacation overlapping these dates.",
            )

    return (end_date - start_date).days + 1


def calculate_balance_from_vacations(
    *,
    annual_allowance: int,
    vacations: Iterable[Vacation],
    year: int,
) -> tuple[int, int, int]:
    """Compute (days_taken, days_pending, days_remaining) for annual vacations in a year."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    days_taken = 0
    days_pending = 0
    for vac in vacations:
        if vac.vacation_type != VacationType.ANNUAL:
            continue
        if vac.end_date < year_start or vac.start_date > year_end:
            continue
        overlap_start = max(vac.start_date, year_start)
        overlap_end = min(vac.end_date, year_end)
        days_in_year = (overlap_end - overlap_start).days + 1
        if vac.status == VacationStatus.APPROVED:
            days_taken += days_in_year
        elif vac.status == VacationStatus.PENDING:
            days_pending += days_in_year

    days_remaining = max(0, annual_allowance - days_taken)
    return days_taken, days_pending, days_remaining


def calculate_vacation_balance(
    *, session: Session, employee: Employee, year: int
) -> tuple[int, int, int]:
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    vacations = session.exec(
        select(Vacation)
        .where(Vacation.employee_id == employee.id)
        .where(Vacation.vacation_type == VacationType.ANNUAL)
        .where(Vacation.start_date <= year_end)
        .where(Vacation.end_date >= year_start)
    ).all()

    return calculate_balance_from_vacations(
        annual_allowance=employee.annual_vacation_days,
        vacations=vacations,
        year=year,
    )


def list_vacation_balances(*, session: Session, year: int) -> list[VacationBalance]:
    """Batch-load active employees and annual vacations to compute all balances in 2 queries."""
    employees = session.exec(
        select(Employee)
        .where(Employee.status != EmployeeStatus.TERMINATED)
        .order_by(col(Employee.full_name))
    ).all()
    if not employees:
        return []

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    emp_ids = [emp.id for emp in employees]

    annual_vacations = session.exec(
        select(Vacation)
        .where(col(Vacation.employee_id).in_(emp_ids))
        .where(Vacation.vacation_type == VacationType.ANNUAL)
        .where(Vacation.start_date <= year_end)
        .where(Vacation.end_date >= year_start)
    ).all()

    vacs_by_emp: dict[uuid.UUID, list[Vacation]] = defaultdict(list)
    for vac in annual_vacations:
        vacs_by_emp[vac.employee_id].append(vac)

    balances: list[VacationBalance] = []
    for emp in employees:
        taken, pending, remaining = calculate_balance_from_vacations(
            annual_allowance=emp.annual_vacation_days,
            vacations=vacs_by_emp[emp.id],
            year=year,
        )
        balances.append(
            VacationBalance(
                employee_id=emp.id,
                employee_name=emp.full_name,
                employee_code=emp.employee_code,
                year=year,
                annual_allowance=emp.annual_vacation_days,
                days_taken=taken,
                days_pending=pending,
                days_remaining=remaining,
            )
        )
    return balances


def list_vacations(
    *,
    session: Session,
    employee_id: uuid.UUID | None = None,
    status: VacationStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[VacationPublic]:
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

    vacations = list(session.exec(stmt).all())
    employees = get_employees_map(session, (v.employee_id for v in vacations))
    return [to_vacation_public(v, employees) for v in vacations]


def create_vacation(*, session: Session, vac_in: VacationCreate) -> VacationPublic:
    emp = session.get(Employee, vac_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    days_count = validate_vacation_dates_and_overlap(
        session=session,
        employee_id=vac_in.employee_id,
        start_date=vac_in.start_date,
        end_date=vac_in.end_date,
        status=vac_in.status,
    )

    vac = Vacation.model_validate(vac_in, update={"days_count": days_count})
    session.add(vac)
    session.commit()
    session.refresh(vac)
    return to_vacation_public(vac, {emp.id: emp})


def update_vacation(
    *, session: Session, vac: Vacation, vac_in: VacationUpdate
) -> VacationPublic:
    update_data = vac_in.model_dump(exclude_unset=True)
    new_start = update_data.get("start_date", vac.start_date)
    new_end = update_data.get("end_date", vac.end_date)
    new_status = update_data.get("status", vac.status)

    days_count = validate_vacation_dates_and_overlap(
        session=session,
        employee_id=vac.employee_id,
        start_date=new_start,
        end_date=new_end,
        status=new_status,
        exclude_vacation_id=vac.id,
    )

    update_data["days_count"] = days_count
    vac.sqlmodel_update(update_data)
    session.add(vac)
    session.commit()
    session.refresh(vac)
    emp = session.get(Employee, vac.employee_id)
    return to_vacation_public(vac, {emp.id: emp} if emp else {})
