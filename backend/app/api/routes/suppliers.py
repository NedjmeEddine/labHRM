import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.api.deps import SessionDep, get_current_user
from app.models import (
    CompanySettings,
    Message,
    Supplier,
    SupplierCreate,
    SupplierDetail,
    SupplierPublic,
    SuppliersPublic,
    SupplierUpdate,
)
from app.pdf_generator import generate_supplier_statement_pdf
from app.services import suppliers as supplier_service

router = APIRouter(
    prefix="/suppliers",
    tags=["suppliers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=SuppliersPublic)
def read_suppliers(
    session: SessionDep,
    search: Annotated[str | None, Query()] = None,
    active_only: Annotated[bool, Query()] = True,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> SuppliersPublic:
    """List suppliers with search, debt summary, and pagination."""
    items, count = supplier_service.list_suppliers(
        session=session,
        search=search,
        active_only=active_only,
        skip=skip,
        limit=limit,
    )
    return SuppliersPublic(data=items, count=count)


@router.post("/", response_model=SupplierPublic)
def create_supplier(session: SessionDep, supplier_in: SupplierCreate) -> SupplierPublic:
    """Add a new supplier."""
    supplier = supplier_service.create_supplier(session=session, data=supplier_in)
    invoiced, paid, balance = supplier_service.compute_supplier_totals(
        session, supplier.id
    )
    return SupplierPublic(
        id=supplier.id,
        name=supplier.name,
        contact_person=supplier.contact_person,
        phone=supplier.phone,
        email=supplier.email,
        address=supplier.address,
        tax_id=supplier.tax_id,
        statistical_id=supplier.statistical_id,
        trade_registry=supplier.trade_registry,
        payment_terms=supplier.payment_terms,
        notes=supplier.notes,
        is_active=supplier.is_active,
        created_at=supplier.created_at,
        updated_at=supplier.updated_at,
        total_invoiced=invoiced,
        total_paid=paid,
        balance_owed=balance,
    )


@router.get("/{supplier_id}", response_model=SupplierDetail)
def get_supplier(session: SessionDep, supplier_id: uuid.UUID) -> SupplierDetail:
    """Get supplier profile with chronological ledger of invoices, payments, and balance."""
    return supplier_service.get_supplier_detail(
        session=session, supplier_id=supplier_id
    )


@router.patch("/{supplier_id}", response_model=SupplierPublic)
def update_supplier(
    session: SessionDep, supplier_id: uuid.UUID, supplier_in: SupplierUpdate
) -> SupplierPublic:
    """Update supplier profile."""
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    updated = supplier_service.update_supplier(
        session=session, supplier=supplier, data=supplier_in
    )
    invoiced, paid, balance = supplier_service.compute_supplier_totals(
        session, updated.id
    )
    return SupplierPublic(
        id=updated.id,
        name=updated.name,
        contact_person=updated.contact_person,
        phone=updated.phone,
        email=updated.email,
        address=updated.address,
        tax_id=updated.tax_id,
        statistical_id=updated.statistical_id,
        trade_registry=updated.trade_registry,
        payment_terms=updated.payment_terms,
        notes=updated.notes,
        is_active=updated.is_active,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        total_invoiced=invoiced,
        total_paid=paid,
        balance_owed=balance,
    )


@router.delete("/{supplier_id}", response_model=Message)
def delete_supplier(session: SessionDep, supplier_id: uuid.UUID) -> Message:
    """Soft-delete a supplier (retains invoices and payment history)."""
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    supplier_service.soft_delete_supplier(session=session, supplier=supplier)
    return Message(message="Supplier archived successfully.")


@router.get("/{supplier_id}/statement/pdf")
def get_supplier_statement_pdf(session: SessionDep, supplier_id: uuid.UUID) -> Response:
    """Generate professional branded French PDF statement of account."""
    detail = supplier_service.get_supplier_detail(
        session=session, supplier_id=supplier_id
    )
    company = session.get(CompanySettings, 1) or CompanySettings(id=1)
    pdf_bytes = generate_supplier_statement_pdf(detail=detail, company=company)
    clean_name = "".join(c for c in detail.name if c.isalnum() or c in ("-", "_"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="releve_{clean_name}.pdf"'},
    )


@router.get("/{supplier_id}/statement/csv")
def get_supplier_statement_csv(
    session: SessionDep, supplier_id: uuid.UUID
) -> StreamingResponse:
    """Download chronological statement of account CSV for French Excel."""
    return supplier_service.export_supplier_statement_csv(
        session=session, supplier_id=supplier_id
    )
