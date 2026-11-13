import calendar
import uuid
from datetime import UTC, date, datetime

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.models import (
    Absence,
    Employee,
    EmployeeStatus,
    PaymentMethod,
    Payslip,
    PayslipStatus,
    PayslipUpdate,
    PerformanceReview,
    PerformanceReviewCreate,
    PerformanceReviewPublic,
    Vacation,
    VacationStatus,
    VacationType,
)
from app.services.absences import absence_day_weight
from app.services.employees import get_employees_map, record_salary_change
from app.services.system import get_company_settings


def recompute_payslip_totals(payslip: Payslip) -> None:
    """Single source of truth for gross_salary and clamped net_salary."""
    payslip.gross_salary = round(
        payslip.base_salary
        + payslip.performance_bonus
        + payslip.other_allowances
        + payslip.overtime_pay,
        2,
    )
    payslip.net_salary = round(
        max(
            0.0,
            payslip.gross_salary - payslip.absence_deduction - payslip.other_deductions,
        ),
        2,
    )


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
    unpaid_days = sum(
        absence_day_weight(ab.absence_type) for ab in absences if not ab.is_paid
    )

    # 2. Approved vacations overlapping month
    vacations = session.exec(
        select(Vacation)
        .where(Vacation.employee_id == employee.id)
        .where(Vacation.status == VacationStatus.APPROVED)
        .where(Vacation.start_date <= month_end)
        .where(Vacation.end_date >= month_start)
    ).all()

    paid_vac_days = 0
    unpaid_vac_days = 0
    for vac in vacations:
        overlap_start = max(vac.start_date, month_start)
        overlap_end = min(vac.end_date, month_end)
        days_in_month = (overlap_end - overlap_start).days + 1
        if vac.vacation_type == VacationType.UNPAID:
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

    if existing and overwrite:
        payslip = existing
        payslip.base_salary = employee.base_salary
        payslip.performance_bonus = performance_bonus
        payslip.absence_days = total_unpaid_days
        payslip.absence_deduction = absence_deduction
        payslip.worked_days = worked_days
        payslip.vacation_days_taken = paid_vac_days + unpaid_vac_days
        payslip.employee_name = employee.full_name
        payslip.employee_code = employee.employee_code
        payslip.job_title = employee.job_title
        payslip.department = employee.department
        payslip.social_security_number = employee.social_security_number
        payslip.updated_at = datetime.now(UTC)
    else:
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
            worked_days=worked_days,
            vacation_days_taken=paid_vac_days + unpaid_vac_days,
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PayslipStatus.DRAFT,
            employee_name=employee.full_name,
            employee_code=employee.employee_code,
            job_title=employee.job_title,
            department=employee.department,
            social_security_number=employee.social_security_number,
        )

    recompute_payslip_totals(payslip)
    session.add(payslip)
    session.commit()
    session.refresh(payslip)
    return payslip


def generate_batch_payslips(
    *, session: Session, month: int, year: int
) -> list[Payslip]:
    active_employees = session.exec(
        select(Employee)
        .where(Employee.status == EmployeeStatus.ACTIVE)
        .order_by(col(Employee.full_name))
    ).all()
    return [
        build_payslip_draft(
            session=session,
            employee=emp,
            month=month,
            year=year,
            overwrite=False,
        )
        for emp in active_employees
    ]


def update_payslip(
    *, session: Session, payslip: Payslip, payslip_in: PayslipUpdate
) -> Payslip:
    update_data = payslip_in.model_dump(exclude_unset=True)
    payslip.sqlmodel_update(update_data)
    recompute_payslip_totals(payslip)
    payslip.updated_at = datetime.now(UTC)
    session.add(payslip)
    session.commit()
    session.refresh(payslip)
    return payslip


def to_performance_public(
    rev: PerformanceReview, employees_map: dict[uuid.UUID, Employee]
) -> PerformanceReviewPublic:
    emp = employees_map.get(rev.employee_id)
    return PerformanceReviewPublic(
        id=rev.id,
        employee_id=rev.employee_id,
        period_month=rev.period_month,
        period_year=rev.period_year,
        score=rev.score,
        bonus_amount=rev.bonus_amount,
        new_base_salary=rev.new_base_salary,
        notes=rev.notes,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        created_at=rev.created_at,
    )


def list_performance_reviews(
    *,
    session: Session,
    employee_id: uuid.UUID | None = None,
    period_month: int | None = None,
    period_year: int | None = None,
) -> list[PerformanceReviewPublic]:
    stmt = select(PerformanceReview).order_by(
        col(PerformanceReview.period_year).desc(),
        col(PerformanceReview.period_month).desc(),
        col(PerformanceReview.created_at).desc(),
    )
    if employee_id:
        stmt = stmt.where(PerformanceReview.employee_id == employee_id)
    if period_month:
        stmt = stmt.where(PerformanceReview.period_month == period_month)
    if period_year:
        stmt = stmt.where(PerformanceReview.period_year == period_year)

    reviews = session.exec(stmt).all()
    employees = get_employees_map(session, (r.employee_id for r in reviews))
    return [to_performance_public(r, employees) for r in reviews]


def create_performance_review(
    *, session: Session, review_in: PerformanceReviewCreate
) -> PerformanceReviewPublic:
    emp = session.get(Employee, review_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    review = PerformanceReview.model_validate(review_in)
    session.add(review)

    if review_in.new_base_salary is not None:
        record_salary_change(
            session=session,
            employee=emp,
            new_salary=review_in.new_base_salary,
            reason=f"Performance review ({review_in.period_month:02d}/{review_in.period_year} - Score {review_in.score}/5)",
        )

    session.commit()
    session.refresh(review)
    return to_performance_public(review, {emp.id: emp})
