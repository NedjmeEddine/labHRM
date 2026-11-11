import calendar
from datetime import UTC, date, datetime

from sqlmodel import Session, select

from app.core.security import verify_password
from app.models import (
    Absence,
    CompanySettings,
    Employee,
    EmployeeCreate,
    EmployeeUpdate,
    Payslip,
    PerformanceReview,
    SalaryHistory,
    User,
    Vacation,
)

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


def generate_next_employee_code(session: Session) -> str:
    employees = session.exec(select(Employee.employee_code)).all()
    max_num = 0
    for code in employees:
        if code and code.startswith("EMP-"):
            part = code.replace("EMP-", "")
            if part.isdigit():
                max_num = max(max_num, int(part))
    return f"EMP-{max_num + 1:03d}"


def create_employee(*, session: Session, employee_in: EmployeeCreate) -> Employee:
    code = employee_in.employee_code
    if not code or not code.strip():
        code = generate_next_employee_code(session)

    db_employee = Employee.model_validate(
        employee_in,
        update={"employee_code": code.strip()},
    )
    session.add(db_employee)
    session.flush()

    # Record initial salary history entry
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

    old_salary = db_employee.base_salary
    new_salary = update_data.get("base_salary")

    db_employee.sqlmodel_update(update_data)
    session.add(db_employee)

    if new_salary is not None and new_salary != old_salary:
        history = SalaryHistory(
            employee_id=db_employee.id,
            previous_salary=old_salary,
            new_salary=new_salary,
            reason=reason or "Manual salary adjustment",
        )
        session.add(history)

    session.commit()
    session.refresh(db_employee)
    return db_employee


def calculate_vacation_balance(
    *, session: Session, employee: Employee, year: int
) -> tuple[int, int, int]:
    """Returns (days_taken, days_pending, days_remaining) for annual vacations in given year."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    vacations = session.exec(
        select(Vacation)
        .where(Vacation.employee_id == employee.id)
        .where(Vacation.vacation_type == "annual")
        .where(Vacation.start_date <= year_end)
        .where(Vacation.end_date >= year_start)
    ).all()

    days_taken = 0
    days_pending = 0
    for vac in vacations:
        overlap_start = max(vac.start_date, year_start)
        overlap_end = min(vac.end_date, year_end)
        days_in_year = (overlap_end - overlap_start).days + 1
        if vac.status == "approved":
            days_taken += days_in_year
        elif vac.status == "pending":
            days_pending += days_in_year

    days_remaining = max(0, employee.annual_vacation_days - days_taken)
    return days_taken, days_pending, days_remaining


def build_payslip_draft(
    *,
    session: Session,
    employee: Employee,
    month: int,
    year: int,
    overwrite: bool = False,
) -> Payslip:
    existing = session.exec(
        select(Payslip)
        .where(Payslip.employee_id == employee.id)
        .where(Payslip.month == month)
        .where(Payslip.year == year)
    ).first()

    if existing and not overwrite:
        return existing

    company = get_company_settings(session)
    working_days = company.working_days_per_month or 22

    _, last_day = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    # 1. Absences in month
    absences = session.exec(
        select(Absence)
        .where(Absence.employee_id == employee.id)
        .where(Absence.date >= month_start)
        .where(Absence.date <= month_end)
    ).all()

    unpaid_days = 0.0
    for ab in absences:
        if not ab.is_paid:
            if ab.absence_type == "half_day":
                unpaid_days += 0.5
            else:
                unpaid_days += 1.0

    # 2. Vacations in month
    vacations = session.exec(
        select(Vacation)
        .where(Vacation.employee_id == employee.id)
        .where(Vacation.status == "approved")
        .where(Vacation.start_date <= month_end)
        .where(Vacation.end_date >= month_start)
    ).all()

    paid_vac_days = 0
    unpaid_vac_days = 0
    for vac in vacations:
        overlap_start = max(vac.start_date, month_start)
        overlap_end = min(vac.end_date, month_end)
        days_in_month = (overlap_end - overlap_start).days + 1
        if vac.vacation_type == "unpaid":
            unpaid_vac_days += days_in_month
        else:
            paid_vac_days += days_in_month

    total_unpaid_days = unpaid_days + float(unpaid_vac_days)

    # 3. Performance bonuses for month/year
    reviews = session.exec(
        select(PerformanceReview)
        .where(PerformanceReview.employee_id == employee.id)
        .where(PerformanceReview.period_month == month)
        .where(PerformanceReview.period_year == year)
    ).all()
    performance_bonus = round(sum(r.bonus_amount for r in reviews), 2)

    # 4. Salary computations
    daily_rate = employee.base_salary / float(working_days)
    absence_deduction = round(total_unpaid_days * daily_rate, 2)
    worked_days = max(0.0, float(working_days) - total_unpaid_days)
    gross_salary = round(employee.base_salary + performance_bonus, 2)
    net_salary = round(max(0.0, gross_salary - absence_deduction), 2)

    if existing and overwrite:
        existing.base_salary = employee.base_salary
        existing.performance_bonus = performance_bonus
        existing.absence_days = total_unpaid_days
        existing.absence_deduction = absence_deduction
        existing.worked_days = worked_days
        existing.vacation_days_taken = paid_vac_days + unpaid_vac_days
        existing.gross_salary = round(
            existing.base_salary
            + existing.performance_bonus
            + existing.other_allowances
            + existing.overtime_pay,
            2,
        )
        existing.net_salary = round(
            max(
                0.0,
                existing.gross_salary
                - existing.absence_deduction
                - existing.other_deductions,
            ),
            2,
        )
        existing.employee_name = employee.full_name
        existing.employee_code = employee.employee_code
        existing.job_title = employee.job_title
        existing.department = employee.department
        existing.social_security_number = employee.social_security_number
        existing.updated_at = datetime.now(UTC)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    payslip = Payslip(
        employee_id=employee.id,
        month=month,
        year=year,
        base_salary=employee.base_salary,
        performance_bonus=performance_bonus,
        other_allowances=0.0,
        overtime_pay=0.0,
        absence_days=total_unpaid_days,
        absence_deduction=absence_deduction,
        other_deductions=0.0,
        gross_salary=gross_salary,
        net_salary=net_salary,
        worked_days=worked_days,
        vacation_days_taken=paid_vac_days + unpaid_vac_days,
        payment_method="bank_transfer",
        status="draft",
        employee_name=employee.full_name,
        employee_code=employee.employee_code,
        job_title=employee.job_title,
        department=employee.department,
        social_security_number=employee.social_security_number,
    )
    session.add(payslip)
    session.commit()
    session.refresh(payslip)
    return payslip
