import uuid
from collections.abc import Iterable

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, or_, select

from app.models import (
    Employee,
    EmployeeCreate,
    EmployeeStatus,
    EmployeeUpdate,
    SalaryHistory,
)


def generate_next_employee_code(session: Session) -> str:
    codes = session.exec(select(Employee.employee_code)).all()
    max_num = 0
    for code in codes:
        if code and code.startswith("EMP-"):
            part = code.removeprefix("EMP-")
            if part.isdigit():
                max_num = max(max_num, int(part))
    return f"EMP-{max_num + 1:03d}"


def get_employees_map(
    session: Session, employee_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, Employee]:
    ids = {emp_id for emp_id in employee_ids if emp_id is not None}
    if not ids:
        return {}
    employees = session.exec(select(Employee).where(col(Employee.id).in_(ids))).all()
    return {e.id: e for e in employees}


def list_employees(
    *,
    session: Session,
    status: EmployeeStatus | None = None,
    search: str | None = None,
) -> list[Employee]:
    stmt = select(Employee).order_by(col(Employee.created_at).desc())
    if status:
        stmt = stmt.where(Employee.status == status)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                col(Employee.full_name).ilike(pattern),
                col(Employee.employee_code).ilike(pattern),
                col(Employee.job_title).ilike(pattern),
                col(Employee.department).ilike(pattern),
            )
        )
    return list(session.exec(stmt).all())


def record_salary_change(
    *,
    session: Session,
    employee: Employee,
    new_salary: float,
    reason: str,
) -> None:
    """Update employee base_salary and append a SalaryHistory entry when salary changes."""
    if new_salary == employee.base_salary:
        return
    history = SalaryHistory(
        employee_id=employee.id,
        previous_salary=employee.base_salary,
        new_salary=new_salary,
        reason=reason,
    )
    employee.base_salary = new_salary
    session.add(employee)
    session.add(history)


def _assert_unique_employee_code(
    session: Session, code: str, exclude_employee_id: uuid.UUID | None = None
) -> None:
    stmt = select(Employee).where(Employee.employee_code == code)
    if exclude_employee_id is not None:
        stmt = stmt.where(Employee.id != exclude_employee_id)
    if session.exec(stmt).first():
        raise HTTPException(status_code=400, detail="Employee code already exists.")


def create_employee(*, session: Session, employee_in: EmployeeCreate) -> Employee:
    raw_code = employee_in.employee_code.strip() if employee_in.employee_code else ""
    code = raw_code or generate_next_employee_code(session)
    _assert_unique_employee_code(session, code)

    db_employee = Employee.model_validate(
        employee_in,
        update={"employee_code": code},
    )
    session.add(db_employee)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Employee code already exists.")

    history = SalaryHistory(
        employee_id=db_employee.id,
        previous_salary=0.0,
        new_salary=db_employee.base_salary,
        reason="Initial hire salary",
    )
    session.add(history)
    session.commit()
    session.refresh(db_employee)
    return db_employee


def update_employee(
    *, session: Session, db_employee: Employee, employee_in: EmployeeUpdate
) -> Employee:
    update_data = employee_in.model_dump(exclude_unset=True)
    reason = update_data.pop("salary_change_reason", None)

    if "employee_code" in update_data:
        raw_code = update_data["employee_code"]
        cleaned_code = raw_code.strip() if isinstance(raw_code, str) else ""
        if not cleaned_code:
            raise HTTPException(
                status_code=400, detail="Employee code cannot be empty."
            )
        if cleaned_code != db_employee.employee_code:
            _assert_unique_employee_code(
                session, cleaned_code, exclude_employee_id=db_employee.id
            )
        update_data["employee_code"] = cleaned_code

    new_salary = update_data.pop("base_salary", None)

    db_employee.sqlmodel_update(update_data)
    session.add(db_employee)

    if new_salary is not None and new_salary != db_employee.base_salary:
        record_salary_change(
            session=session,
            employee=db_employee,
            new_salary=new_salary,
            reason=reason or "Manual salary adjustment",
        )

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Employee code already exists.")

    session.refresh(db_employee)
    return db_employee
