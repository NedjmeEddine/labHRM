import uuid
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.models import (
    Absence,
    AbsenceCreate,
    AbsencePublic,
    AbsenceRangeCreate,
    AbsencesIntervalSummary,
    AbsenceType,
    AbsenceUpdate,
    Employee,
)
from app.services.employees import get_employees_map
from app.services.system import get_company_settings


def absence_day_weight(absence_type: AbsenceType | str) -> float:
    return 0.5 if absence_type == AbsenceType.HALF_DAY else 1.0


def to_absence_public(
    absence: Absence, employees_map: dict[uuid.UUID, Employee]
) -> AbsencePublic:
    emp = employees_map.get(absence.employee_id)
    return AbsencePublic(
        id=absence.id,
        employee_id=absence.employee_id,
        date=absence.date,
        absence_type=absence.absence_type,
        is_paid=absence.is_paid,
        reason=absence.reason,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        created_at=absence.created_at,
    )


def list_absences(
    *,
    session: Session,
    employee_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    absence_type: AbsenceType | None = None,
) -> tuple[list[Absence], dict[uuid.UUID, Employee]]:
    stmt = select(Absence).order_by(col(Absence.date).desc())
    if employee_id:
        stmt = stmt.where(Absence.employee_id == employee_id)
    if start_date:
        stmt = stmt.where(Absence.date >= start_date)
    if end_date:
        stmt = stmt.where(Absence.date <= end_date)
    if absence_type:
        stmt = stmt.where(Absence.absence_type == absence_type)

    absences = list(session.exec(stmt).all())
    employees = get_employees_map(session, (ab.employee_id for ab in absences))
    return absences, employees


def get_absences_summary(
    *,
    session: Session,
    employee_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    absence_type: AbsenceType | None = None,
) -> AbsencesIntervalSummary:
    absences, employees = list_absences(
        session=session,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        absence_type=absence_type,
    )
    company = get_company_settings(session)
    working_days = company.working_days_per_month or 22

    unpaid_days = 0.0
    paid_days = 0.0
    half_days = 0
    estimated_deduction = 0.0

    for ab in absences:
        day_weight = absence_day_weight(ab.absence_type)
        if ab.absence_type == AbsenceType.HALF_DAY:
            half_days += 1
        if ab.is_paid:
            paid_days += day_weight
        else:
            unpaid_days += day_weight
            emp = employees.get(ab.employee_id)
            if emp:
                estimated_deduction += day_weight * (
                    emp.base_salary / float(working_days)
                )

    data = [to_absence_public(ab, employees) for ab in absences]
    return AbsencesIntervalSummary(
        data=data,
        total_count=len(data),
        unpaid_days=round(unpaid_days, 2),
        paid_days=round(paid_days, 2),
        half_days=half_days,
        estimated_deduction=round(estimated_deduction, 2),
    )


def create_absence(*, session: Session, absence_in: AbsenceCreate) -> AbsencePublic:
    emp = session.get(Employee, absence_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = session.exec(
        select(Absence)
        .where(Absence.employee_id == absence_in.employee_id)
        .where(Absence.date == absence_in.date)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An absence is already recorded for this employee on this date.",
        )

    absence = Absence.model_validate(absence_in)
    session.add(absence)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=400,
            detail="An absence is already recorded for this employee on this date.",
        )
    session.refresh(absence)
    return to_absence_public(absence, {emp.id: emp})


def create_absence_range(
    *, session: Session, range_in: AbsenceRangeCreate
) -> list[AbsencePublic]:
    if range_in.end_date < range_in.start_date:
        raise HTTPException(
            status_code=400, detail="end_date cannot be before start_date."
        )
    if (range_in.end_date - range_in.start_date).days > 90:
        raise HTTPException(
            status_code=400,
            detail="Absence range cannot exceed 90 days. Use Vacations for longer leaves.",
        )

    emp = session.get(Employee, range_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing_dates = set(
        session.exec(
            select(Absence.date)
            .where(Absence.employee_id == range_in.employee_id)
            .where(Absence.date >= range_in.start_date)
            .where(Absence.date <= range_in.end_date)
        ).all()
    )

    created: list[Absence] = []
    cur = range_in.start_date
    while cur <= range_in.end_date:
        if cur not in existing_dates:
            ab = Absence(
                employee_id=range_in.employee_id,
                date=cur,
                absence_type=range_in.absence_type,
                is_paid=range_in.is_paid,
                reason=range_in.reason,
            )
            session.add(ab)
            created.append(ab)
        cur += timedelta(days=1)

    session.commit()
    for ab in created:
        session.refresh(ab)

    return [to_absence_public(ab, {emp.id: emp}) for ab in created]


def update_absence(
    *, session: Session, absence: Absence, absence_in: AbsenceUpdate
) -> AbsencePublic:
    update_data = absence_in.model_dump(exclude_unset=True)
    new_date = update_data.get("date")
    if new_date is not None and new_date != absence.date:
        duplicate = session.exec(
            select(Absence)
            .where(Absence.employee_id == absence.employee_id)
            .where(Absence.date == new_date)
            .where(Absence.id != absence.id)
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="An absence is already recorded for this employee on this date.",
            )

    absence.sqlmodel_update(update_data)
    session.add(absence)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=400,
            detail="An absence is already recorded for this employee on this date.",
        )
    session.refresh(absence)
    emp = session.get(Employee, absence.employee_id)
    return to_absence_public(absence, {emp.id: emp} if emp else {})
