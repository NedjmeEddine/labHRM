import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Employee,
    EmployeeCreate,
    EmployeePublic,
    EmployeesPublic,
    EmployeeUpdate,
    Message,
    SalaryHistory,
    SalaryHistoryPublic,
    VacationBalance,
)

router = APIRouter(
    prefix="/employees",
    tags=["employees"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=EmployeesPublic)
def read_employees(
    session: SessionDep,
    status: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> EmployeesPublic:
    """List all employees with optional status and text search."""
    stmt = select(Employee).order_by(col(Employee.created_at).desc())
    if status:
        stmt = stmt.where(Employee.status == status)
    employees = session.exec(stmt).all()

    if search:
        q = search.strip().lower()
        employees = [
            e
            for e in employees
            if q in e.full_name.lower()
            or q in e.employee_code.lower()
            or q in e.job_title.lower()
            or q in e.department.lower()
        ]

    data = [EmployeePublic.model_validate(e) for e in employees]
    return EmployeesPublic(data=data, count=len(data))


@router.post("/", response_model=EmployeePublic)
def create_employee(session: SessionDep, employee_in: EmployeeCreate) -> EmployeePublic:
    """Add a new employee."""
    if employee_in.employee_code:
        existing = session.exec(
            select(Employee).where(
                Employee.employee_code == employee_in.employee_code.strip()
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Employee code already exists.")
    employee = crud.create_employee(session=session, employee_in=employee_in)
    return EmployeePublic.model_validate(employee)


@router.get("/{id}", response_model=EmployeePublic)
def read_employee(session: SessionDep, id: uuid.UUID) -> EmployeePublic:
    """Get a specific employee by ID."""
    employee = session.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeePublic.model_validate(employee)


@router.patch("/{id}", response_model=EmployeePublic)
def update_employee(
    session: SessionDep, id: uuid.UUID, employee_in: EmployeeUpdate
) -> EmployeePublic:
    """Update an employee (automatically records salary history if base_salary changes)."""
    employee = session.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if (
        employee_in.employee_code
        and employee_in.employee_code != employee.employee_code
    ):
        existing = session.exec(
            select(Employee).where(
                Employee.employee_code == employee_in.employee_code.strip()
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Employee code already exists.")
    updated = crud.update_employee(
        session=session, db_employee=employee, employee_in=employee_in
    )
    return EmployeePublic.model_validate(updated)


@router.delete("/{id}", response_model=Message)
def delete_employee(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete an employee and all associated HR records."""
    employee = session.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    session.delete(employee)
    session.commit()
    return Message(message="Employee deleted successfully")


@router.get("/{id}/salary-history", response_model=list[SalaryHistoryPublic])
def read_employee_salary_history(
    session: SessionDep, id: uuid.UUID
) -> list[SalaryHistoryPublic]:
    """Retrieve chronological salary progression history for an employee."""
    employee = session.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    history = session.exec(
        select(SalaryHistory)
        .where(SalaryHistory.employee_id == id)
        .order_by(col(SalaryHistory.changed_at).desc())
    ).all()
    return [SalaryHistoryPublic.model_validate(h) for h in history]


@router.get("/{id}/vacation-balance", response_model=VacationBalance)
def read_employee_vacation_balance(
    session: SessionDep,
    id: uuid.UUID,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> VacationBalance:
    """Calculate annual vacation balance (taken, pending, remaining) for an employee."""
    employee = session.get(Employee, id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    target_year = year or date.today().year
    taken, pending, remaining = crud.calculate_vacation_balance(
        session=session, employee=employee, year=target_year
    )
    return VacationBalance(
        employee_id=employee.id,
        employee_name=employee.full_name,
        employee_code=employee.employee_code,
        year=target_year,
        annual_allowance=employee.annual_vacation_days,
        days_taken=taken,
        days_pending=pending,
        days_remaining=remaining,
    )
