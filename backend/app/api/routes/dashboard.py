from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import col, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Absence,
    DashboardSummary,
    Employee,
    Payslip,
    Vacation,
    VacationPublic,
)

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
    company = crud.get_company_settings(session)

    employees = session.exec(select(Employee)).all()
    emp_map = {e.id: e for e in employees}

    total_employees = len(employees)
    active_employees = sum(1 for e in employees if e.status == "active")

    # Absent today
    absences_today = session.exec(select(Absence).where(Absence.date == today)).all()
    absent_today_names = [
        emp_map[a.employee_id].full_name
        for a in absences_today
        if a.employee_id in emp_map
    ]

    # On vacation today
    vacations_today = session.exec(
        select(Vacation)
        .where(Vacation.status == "approved")
        .where(Vacation.start_date <= today)
        .where(Vacation.end_date >= today)
    ).all()
    on_vacation_today_names = [
        emp_map[v.employee_id].full_name
        for v in vacations_today
        if v.employee_id in emp_map
    ]

    # Upcoming vacations (next 30 days)
    upcoming_limit = today + timedelta(days=30)
    upcoming_vacs = session.exec(
        select(Vacation)
        .where(Vacation.status != "rejected")
        .where(Vacation.end_date >= today)
        .where(Vacation.start_date <= upcoming_limit)
        .order_by(col(Vacation.start_date))
        .limit(5)
    ).all()

    upcoming_vacations = [
        VacationPublic(
            id=v.id,
            employee_id=v.employee_id,
            start_date=v.start_date,
            end_date=v.end_date,
            days_count=v.days_count,
            vacation_type=v.vacation_type,
            status=v.status,
            notes=v.notes,
            employee_name=emp_map[v.employee_id].full_name
            if v.employee_id in emp_map
            else None,
            employee_code=emp_map[v.employee_id].employee_code
            if v.employee_id in emp_map
            else None,
            created_at=v.created_at,
        )
        for v in upcoming_vacs
    ]

    # Current month payroll summary (if payslips exist, sum them; otherwise estimate from active base salaries)
    month_payslips = session.exec(
        select(Payslip)
        .where(Payslip.month == cur_month)
        .where(Payslip.year == cur_year)
    ).all()

    if month_payslips:
        payroll_total = round(sum(p.net_salary for p in month_payslips), 2)
        paid_count = sum(1 for p in month_payslips if p.status == "paid")
        draft_count = sum(1 for p in month_payslips if p.status == "draft")
    else:
        payroll_total = round(
            sum(e.base_salary for e in employees if e.status == "active"), 2
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
