from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import col, select

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Absence,
    DashboardSummary,
    Employee,
    EmployeeStatus,
    Payslip,
    PayslipStatus,
    Vacation,
    VacationStatus,
)
from app.services import system as system_service
from app.services import vacations as vacation_service

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=DashboardSummary)
def get_dashboard_summary(session: SessionDep) -> DashboardSummary:
    """Return live HR metrics for the executive dashboard."""
    today = date.today()
    cur_month = today.month
    cur_year = today.year
    company = system_service.get_company_settings(session)

    employees = session.exec(select(Employee)).all()
    emp_map = {e.id: e for e in employees}

    total_employees = len(employees)
    active_employees = sum(1 for e in employees if e.status == EmployeeStatus.ACTIVE)

    absences_today = session.exec(select(Absence).where(Absence.date == today)).all()
    absent_today_names = list(
        dict.fromkeys(
            emp_map[a.employee_id].full_name
            for a in absences_today
            if a.employee_id in emp_map
        )
    )

    vacations_today = session.exec(
        select(Vacation)
        .where(Vacation.status == VacationStatus.APPROVED)
        .where(Vacation.start_date <= today)
        .where(Vacation.end_date >= today)
    ).all()
    on_vacation_today_names = list(
        dict.fromkeys(
            emp_map[v.employee_id].full_name
            for v in vacations_today
            if v.employee_id in emp_map
        )
    )

    upcoming_limit = today + timedelta(days=30)
    upcoming_vacs = session.exec(
        select(Vacation)
        .where(Vacation.status != VacationStatus.REJECTED)
        .where(Vacation.end_date >= today)
        .where(Vacation.start_date <= upcoming_limit)
        .order_by(col(Vacation.start_date))
        .limit(5)
    ).all()
    upcoming_vacations = [
        vacation_service.to_vacation_public(v, emp_map) for v in upcoming_vacs
    ]

    month_payslips = session.exec(
        select(Payslip)
        .where(Payslip.month == cur_month)
        .where(Payslip.year == cur_year)
    ).all()

    if month_payslips:
        payroll_total = round(sum(p.net_salary for p in month_payslips), 2)
        paid_count = sum(1 for p in month_payslips if p.status == PayslipStatus.PAID)
        draft_count = sum(1 for p in month_payslips if p.status == PayslipStatus.DRAFT)
    else:
        payroll_total = round(
            sum(e.base_salary for e in employees if e.status == EmployeeStatus.ACTIVE),
            2,
        )
        paid_count = 0
        draft_count = 0

    return DashboardSummary(
        total_employees=total_employees,
        active_employees=active_employees,
        absent_today_count=len(absent_today_names),
        on_vacation_today_count=len(on_vacation_today_names),
        absent_today_names=absent_today_names,
        on_vacation_today_names=on_vacation_today_names,
        current_month_payroll_total=payroll_total,
        current_month_paid_count=paid_count,
        current_month_draft_count=draft_count,
        upcoming_vacations=upcoming_vacations,
        currency=company.currency,
    )
