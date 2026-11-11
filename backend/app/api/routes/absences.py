import csv
import io
import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import col, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Absence,
    AbsenceCreate,
    AbsencePublic,
    AbsenceRangeCreate,
    AbsencesIntervalSummary,
    AbsenceUpdate,
    Employee,
    Message,
)

router = APIRouter(
    prefix="/absences",
    tags=["absences"],
    dependencies=[Depends(get_current_user)],
)


def _to_public(
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


@router.get("/", response_model=AbsencesIntervalSummary)
def read_absences(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    absence_type: Annotated[str | None, Query()] = None,
) -> AbsencesIntervalSummary:
    """
    Retrieve absences and compute interval totals (unpaid days, paid days, estimated DZD deduction).
    """
    stmt = select(Absence).order_by(col(Absence.date).desc())
    if employee_id:
        stmt = stmt.where(Absence.employee_id == employee_id)
    if start_date:
        stmt = stmt.where(Absence.date >= start_date)
    if end_date:
        stmt = stmt.where(Absence.date <= end_date)
    if absence_type:
        stmt = stmt.where(Absence.absence_type == absence_type)

    absences = session.exec(stmt).all()
    employees = {e.id: e for e in session.exec(select(Employee)).all()}
    company = crud.get_company_settings(session)
    working_days = company.working_days_per_month or 22

    unpaid_days = 0.0
    paid_days = 0.0
    half_days = 0
    estimated_deduction = 0.0

    for ab in absences:
        day_weight = 0.5 if ab.absence_type == "half_day" else 1.0
        if ab.absence_type == "half_day":
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

    data = [_to_public(ab, employees) for ab in absences]
    return AbsencesIntervalSummary(
        data=data,
        total_count=len(data),
        unpaid_days=round(unpaid_days, 2),
        paid_days=round(paid_days, 2),
        half_days=half_days,
        estimated_deduction=round(estimated_deduction, 2),
    )


@router.post("/", response_model=AbsencePublic)
def create_absence(session: SessionDep, absence_in: AbsenceCreate) -> AbsencePublic:
    """Mark a single absence date for an employee."""
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
    session.commit()
    session.refresh(absence)
    return _to_public(absence, {emp.id: emp})


@router.post("/range", response_model=list[AbsencePublic])
def create_absence_range(
    session: SessionDep, range_in: AbsenceRangeCreate
) -> list[AbsencePublic]:
    """Mark absences across a date interval (skips dates already marked for the employee)."""
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

    return [_to_public(ab, {emp.id: emp}) for ab in created]


@router.patch("/{id}", response_model=AbsencePublic)
def update_absence(
    session: SessionDep, id: uuid.UUID, absence_in: AbsenceUpdate
) -> AbsencePublic:
    """Update an absence record."""
    absence = session.get(Absence, id)
    if not absence:
        raise HTTPException(status_code=404, detail="Absence record not found")
    update_data = absence_in.model_dump(exclude_unset=True)
    absence.sqlmodel_update(update_data)
    session.add(absence)
    session.commit()
    session.refresh(absence)
    emp = session.get(Employee, absence.employee_id)
    return _to_public(absence, {emp.id: emp} if emp else {})


@router.delete("/{id}", response_model=Message)
def delete_absence(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete an absence record."""
    absence = session.get(Absence, id)
    if not absence:
        raise HTTPException(status_code=404, detail="Absence record not found")
    session.delete(absence)
    session.commit()
    return Message(message="Absence deleted successfully")


@router.get("/export/csv")
def export_absences_csv(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> StreamingResponse:
    """Export attendance / absences to CSV for Excel & accounting."""
    stmt = select(Absence).order_by(col(Absence.date).desc())
    if employee_id:
        stmt = stmt.where(Absence.employee_id == employee_id)
    if start_date:
        stmt = stmt.where(Absence.date >= start_date)
    if end_date:
        stmt = stmt.where(Absence.date <= end_date)

    absences = session.exec(stmt).all()
    employees = {e.id: e for e in session.exec(select(Employee)).all()}

    output = io.StringIO()
    # UTF-8 BOM for clean Excel French accent rendering
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Date", "Matricule", "Employe", "Type", "Payee", "Motif"])
    for ab in absences:
        emp = employees.get(ab.employee_id)
        writer.writerow(
            [
                ab.date.isoformat(),
                emp.employee_code if emp else "",
                emp.full_name if emp else "",
                ab.absence_type,
                "Oui" if ab.is_paid else "Non",
                ab.reason or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="absences_export.csv"'},
    )
