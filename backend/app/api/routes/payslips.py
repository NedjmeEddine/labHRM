import csv
import io
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlmodel import col, select

from app import crud
from app.api.deps import SessionDep, get_current_user
from app.models import (
    Employee,
    Message,
    Payslip,
    PayslipBatchGenerateRequest,
    PayslipGenerateRequest,
    PayslipPublic,
    PayslipsPublic,
    PayslipUpdate,
)
from app.pdf_generator import generate_payslip_pdf

router = APIRouter(
    prefix="/payslips",
    tags=["payslips"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=PayslipsPublic)
def read_payslips(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    status: Annotated[str | None, Query()] = None,
) -> PayslipsPublic:
    """List payslips filtered by period, employee, or status."""
    stmt = select(Payslip).order_by(
        col(Payslip.year).desc(),
        col(Payslip.month).desc(),
        col(Payslip.employee_name),
    )
    if employee_id:
        stmt = stmt.where(Payslip.employee_id == employee_id)
    if month:
        stmt = stmt.where(Payslip.month == month)
    if year:
        stmt = stmt.where(Payslip.year == year)
    if status:
        stmt = stmt.where(Payslip.status == status)

    payslips = session.exec(stmt).all()
    data = [PayslipPublic.model_validate(p) for p in payslips]
    return PayslipsPublic(data=data, count=len(data))


@router.post("/generate-draft", response_model=PayslipPublic)
def generate_payslip_draft(
    session: SessionDep, req: PayslipGenerateRequest
) -> PayslipPublic:
    """Auto-calculate a payslip draft for an employee using DB attendance, vacations, and performance bonuses."""
    employee = session.get(Employee, req.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    payslip = crud.build_payslip_draft(
        session=session,
        employee=employee,
        month=req.month,
        year=req.year,
        overwrite=req.overwrite,
    )
    return PayslipPublic.model_validate(payslip)


@router.post("/generate-batch", response_model=PayslipsPublic)
def generate_payslips_batch(
    session: SessionDep, req: PayslipBatchGenerateRequest
) -> PayslipsPublic:
    """Generate draft payslips for all active employees for a given month/year."""
    active_employees = session.exec(
        select(Employee)
        .where(Employee.status == "active")
        .order_by(col(Employee.full_name))
    ).all()

    results: list[PayslipPublic] = []
    for emp in active_employees:
        p = crud.build_payslip_draft(
            session=session,
            employee=emp,
            month=req.month,
            year=req.year,
            overwrite=False,
        )
        results.append(PayslipPublic.model_validate(p))

    return PayslipsPublic(data=results, count=len(results))


@router.get("/export/csv")
def export_payslips_csv(
    session: SessionDep,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> StreamingResponse:
    """Export monthly payroll ledger to CSV for Excel & accountant."""
    stmt = select(Payslip).order_by(
        col(Payslip.year).desc(),
        col(Payslip.month).desc(),
        col(Payslip.employee_name),
    )
    if month:
        stmt = stmt.where(Payslip.month == month)
    if year:
        stmt = stmt.where(Payslip.year == year)

    payslips = session.exec(stmt).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(
        [
            "Periode",
            "Matricule",
            "Nom Complet",
            "Poste",
            "Salaire Base (DZD)",
            "Prime Performance (DZD)",
            "Autres Indemnites (DZD)",
            "Heures Sup (DZD)",
            "Salaire Brut (DZD)",
            "Jours Absence",
            "Retenue Absences (DZD)",
            "Autres Retenues (DZD)",
            "Net a Payer (DZD)",
            "Statut",
            "Mode Paiement",
        ]
    )
    for p in payslips:
        writer.writerow(
            [
                f"{p.month:02d}/{p.year}",
                p.employee_code,
                p.employee_name,
                p.job_title,
                f"{p.base_salary:.2f}",
                f"{p.performance_bonus:.2f}",
                f"{p.other_allowances:.2f}",
                f"{p.overtime_pay:.2f}",
                f"{p.gross_salary:.2f}",
                f"{p.absence_days:g}",
                f"{p.absence_deduction:.2f}",
                f"{p.other_deductions:.2f}",
                f"{p.net_salary:.2f}",
                p.status,
                p.payment_method,
            ]
        )

    output.seek(0)
    filename = f"paie_{year or 'all'}_{month or 'all'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{id}", response_model=PayslipPublic)
def read_payslip(session: SessionDep, id: uuid.UUID) -> PayslipPublic:
    """Get a single payslip."""
    payslip = session.get(Payslip, id)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return PayslipPublic.model_validate(payslip)


@router.put("/{id}", response_model=PayslipPublic)
def update_payslip(
    session: SessionDep, id: uuid.UUID, payslip_in: PayslipUpdate
) -> PayslipPublic:
    """Modify payslip figures/notes and automatically recompute gross & net salary."""
    payslip = session.get(Payslip, id)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    update_data = payslip_in.model_dump(exclude_unset=True)
    payslip.sqlmodel_update(update_data)

    # Recompute gross & net totals cleanly
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
    payslip.updated_at = datetime.now(UTC)

    session.add(payslip)
    session.commit()
    session.refresh(payslip)
    return PayslipPublic.model_validate(payslip)


@router.delete("/{id}", response_model=Message)
def delete_payslip(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete a payslip record."""
    payslip = session.get(Payslip, id)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    session.delete(payslip)
    session.commit()
    return Message(message="Payslip deleted successfully")


@router.get("/{id}/pdf")
def download_payslip_pdf(
    session: SessionDep,
    id: uuid.UUID,
    inline: Annotated[bool, Query()] = False,
) -> Response:
    """Generate and return the branded French Bulletin de Paie PDF."""
    payslip = session.get(Payslip, id)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    company = crud.get_company_settings(session)
    pdf_bytes = generate_payslip_pdf(payslip=payslip, company=company)

    disposition = "inline" if inline else "attachment"
    filename = (
        f"bulletin_paie_{payslip.employee_code}_{payslip.month:02d}_{payslip.year}.pdf"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
        },
    )
