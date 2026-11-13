import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Absence,
    AbsenceCreate,
    AbsencePublic,
    AbsenceRangeCreate,
    AbsencesIntervalSummary,
    AbsenceType,
    AbsenceUpdate,
    Message,
)
from app.services import absences as absence_service
from app.services.csv_export import build_csv_streaming_response

router = APIRouter(
    prefix="/absences",
    tags=["absences"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=AbsencesIntervalSummary)
def read_absences(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    absence_type: Annotated[AbsenceType | None, Query()] = None,
) -> AbsencesIntervalSummary:
    """Retrieve absences and compute interval totals (unpaid days, paid days, estimated DZD deduction)."""
    return absence_service.get_absences_summary(
        session=session,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        absence_type=absence_type,
    )


@router.post("/", response_model=AbsencePublic)
def create_absence(session: SessionDep, absence_in: AbsenceCreate) -> AbsencePublic:
    """Mark a single absence date for an employee."""
    return absence_service.create_absence(session=session, absence_in=absence_in)


@router.post("/range", response_model=list[AbsencePublic])
def create_absence_range(
    session: SessionDep, range_in: AbsenceRangeCreate
) -> list[AbsencePublic]:
    """Mark absences across a date interval (skips dates already marked for the employee)."""
    return absence_service.create_absence_range(session=session, range_in=range_in)


@router.patch("/{id}", response_model=AbsencePublic)
def update_absence(
    session: SessionDep, id: uuid.UUID, absence_in: AbsenceUpdate
) -> AbsencePublic:
    """Update an absence record."""
    absence = session.get(Absence, id)
    if not absence:
        raise HTTPException(status_code=404, detail="Absence record not found")
    return absence_service.update_absence(
        session=session, absence=absence, absence_in=absence_in
    )


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
    absence_type: Annotated[AbsenceType | None, Query()] = None,
) -> StreamingResponse:
    """Export attendance / absences to CSV for Excel & accounting."""
    absences, employees = absence_service.list_absences(
        session=session,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        absence_type=absence_type,
    )
    rows = []
    for ab in absences:
        emp = employees.get(ab.employee_id)
        rows.append(
            [
                ab.date.isoformat(),
                emp.employee_code if emp else "",
                emp.full_name if emp else "",
                str(ab.absence_type),
                "Oui" if ab.is_paid else "Non",
                ab.reason or "",
            ]
        )

    return build_csv_streaming_response(
        headers=["Date", "Matricule", "Employe", "Type", "Payee", "Motif"],
        rows=rows,
        filename="absences_export.csv",
    )
