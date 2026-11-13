import uuid
from datetime import date as DateType
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.api.deps import SessionDep, get_current_user
from app.models import (
    InventoryDashboardMetrics,
    InvoiceStatus,
    PaymentCreate,
    PaymentPublic,
    PurchaseInvoiceCreate,
    PurchaseInvoiceDetail,
    PurchaseInvoicesPublic,
    PurchaseInvoiceUpdate,
)
from app.services import purchases as purchase_service

router = APIRouter(
    prefix="/invoices",
    tags=["invoices"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/dashboard", response_model=InventoryDashboardMetrics)
def get_inventory_dashboard_metrics(
    session: SessionDep,
) -> InventoryDashboardMetrics:
    """Retrieve overall inventory dashboard metrics (debt, due invoices, monthly spending)."""
    return purchase_service.get_inventory_dashboard_metrics(session=session)


@router.get("/tva-summary")
def get_monthly_tva_summary(
    session: SessionDep,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> list[dict[str, object]]:
    """Retrieve monthly TVA on purchases summary for a calendar year."""
    from app.models import get_datetime_utc

    target_year = year or get_datetime_utc().year
    return purchase_service.get_monthly_tva_summary(session=session, year=target_year)


@router.get("/export/csv")
def export_invoices_csv(
    session: SessionDep,
    supplier_id: Annotated[uuid.UUID | None, Query()] = None,
    start_date: Annotated[DateType | None, Query()] = None,
    end_date: Annotated[DateType | None, Query()] = None,
) -> StreamingResponse:
    """Download purchase invoices ledger as CSV for French Excel."""
    return purchase_service.export_invoices_csv(
        session=session,
        start_date=start_date,
        end_date=end_date,
        supplier_id=supplier_id,
    )


@router.get("/", response_model=PurchaseInvoicesPublic)
def read_purchase_invoices(
    session: SessionDep,
    supplier_id: Annotated[uuid.UUID | None, Query()] = None,
    status: Annotated[InvoiceStatus | None, Query()] = None,
    start_date: Annotated[DateType | None, Query()] = None,
    end_date: Annotated[DateType | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> PurchaseInvoicesPublic:
    """List purchase invoices with multi-criteria filtering and balance summaries."""
    items, count = purchase_service.list_purchase_invoices(
        session=session,
        supplier_id=supplier_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
        skip=skip,
        limit=limit,
    )
    return PurchaseInvoicesPublic(data=items, count=count)


@router.post("/", response_model=PurchaseInvoiceDetail)
def create_purchase_invoice(
    session: SessionDep, invoice_in: PurchaseInvoiceCreate
) -> PurchaseInvoiceDetail:
    """Create a new purchase invoice with line items, auto-computed TVA, and stated total validation."""
    invoice = purchase_service.create_purchase_invoice(session=session, data=invoice_in)
    return purchase_service.get_purchase_invoice_detail(
        session=session, invoice_id=invoice.id
    )


@router.get("/{invoice_id}", response_model=PurchaseInvoiceDetail)
def get_purchase_invoice(
    session: SessionDep, invoice_id: uuid.UUID
) -> PurchaseInvoiceDetail:
    """Get full purchase invoice details with lines and payment history."""
    return purchase_service.get_purchase_invoice_detail(
        session=session, invoice_id=invoice_id
    )


@router.patch("/{invoice_id}", response_model=PurchaseInvoiceDetail)
def update_purchase_invoice(
    session: SessionDep,
    invoice_id: uuid.UUID,
    invoice_in: PurchaseInvoiceUpdate,
) -> PurchaseInvoiceDetail:
    """Update purchase invoice metadata or transition status."""
    invoice = purchase_service.update_purchase_invoice(
        session=session, invoice_id=invoice_id, data=invoice_in
    )
    return purchase_service.get_purchase_invoice_detail(
        session=session, invoice_id=invoice.id
    )


@router.post("/{invoice_id}/payments", response_model=PaymentPublic)
def record_payment(
    session: SessionDep,
    invoice_id: uuid.UUID,
    payment_in: PaymentCreate,
) -> PaymentPublic:
    """Record a payment against a purchase invoice."""
    payment, _, _ = purchase_service.record_payment(
        session=session, invoice_id=invoice_id, data=payment_in
    )
    return PaymentPublic(
        id=payment.id,
        invoice_id=payment.invoice_id,
        invoice_number=payment.invoice.invoice_number if payment.invoice else None,
        supplier_id=payment.supplier_id,
        supplier_name=payment.supplier.name if payment.supplier else None,
        payment_date=payment.payment_date,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference=payment.reference,
        notes=payment.notes,
        created_at=payment.created_at,
    )


@router.post("/{invoice_id}/scan")
async def upload_invoice_scan(
    session: SessionDep,
    invoice_id: uuid.UUID,
    file: Annotated[UploadFile, File(...)],
) -> dict[str, str]:
    """Upload a scan or photo of the paper invoice."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    saved_filename = purchase_service.save_invoice_scan(
        session=session,
        invoice_id=invoice_id,
        file_bytes=contents,
        filename=file.filename or "scan.pdf",
    )
    return {
        "filename": saved_filename,
        "message": "Invoice scan uploaded successfully.",
    }


@router.get("/{invoice_id}/scan")
def download_invoice_scan(session: SessionDep, invoice_id: uuid.UUID) -> FileResponse:
    """Download or view the uploaded invoice scan."""
    path = purchase_service.get_invoice_scan_path(
        session=session, invoice_id=invoice_id
    )
    media_type = "application/pdf"
    if path.suffix.lower() in (".jpg", ".jpeg"):
        media_type = "image/jpeg"
    elif path.suffix.lower() == ".png":
        media_type = "image/png"

    return FileResponse(
        path=path,
        media_type=media_type,
        filename=f"facture_{path.name}",
    )
