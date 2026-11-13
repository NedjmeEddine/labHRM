import json
import uuid
from decimal import Decimal

from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, col, func, select

from app.models import (
    AuditLog,
    InvoicePaymentStatus,
    InvoiceStatus,
    Payment,
    PurchaseInvoice,
    PurchaseInvoicePublic,
    Supplier,
    SupplierCreate,
    SupplierDetail,
    SupplierPublic,
    SupplierUpdate,
    get_datetime_utc,
)
from app.services.csv_export import build_csv_streaming_response


def compute_supplier_totals(
    session: Session, supplier_id: uuid.UUID
) -> tuple[Decimal, Decimal, Decimal]:
    """Compute (total_invoiced, total_paid, balance_owed) for a given supplier."""
    # Sum confirmed regular invoices
    reg_invoices = session.exec(
        select(PurchaseInvoice.total_incl_tax).where(
            PurchaseInvoice.supplier_id == supplier_id,
            PurchaseInvoice.status != InvoiceStatus.CANCELLED,
            PurchaseInvoice.is_credit_note.is_(False),  # type: ignore[attr-defined]
        )
    ).all()
    invoiced_sum = sum(reg_invoices, Decimal("0.00"))

    # Sum confirmed credit notes (deducted from debt)
    credit_notes = session.exec(
        select(PurchaseInvoice.total_incl_tax).where(
            PurchaseInvoice.supplier_id == supplier_id,
            PurchaseInvoice.status != InvoiceStatus.CANCELLED,
            PurchaseInvoice.is_credit_note.is_(True),  # type: ignore[attr-defined]
        )
    ).all()
    credit_sum = sum(credit_notes, Decimal("0.00"))

    # Sum payments
    payments = session.exec(
        select(Payment.amount).where(Payment.supplier_id == supplier_id)
    ).all()
    paid_sum = sum(payments, Decimal("0.00"))

    net_invoiced = invoiced_sum - credit_sum
    balance_owed = net_invoiced - paid_sum
    return net_invoiced, paid_sum, balance_owed


def list_suppliers(
    session: Session,
    search: str | None = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[SupplierPublic], int]:
    """List suppliers with search and dynamic balance calculations."""
    query = select(Supplier)
    if active_only:
        query = query.where(Supplier.is_active.is_(True))  # type: ignore[attr-defined]
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            col(Supplier.name).ilike(term)
            | col(Supplier.contact_person).ilike(term)
            | col(Supplier.phone).ilike(term)
            | col(Supplier.tax_id).ilike(term)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    suppliers = session.exec(
        query.order_by(Supplier.name.asc()).offset(skip).limit(limit)
    ).all()

    items: list[SupplierPublic] = []
    for s in suppliers:
        invoiced, paid, balance = compute_supplier_totals(session, s.id)
        items.append(
            SupplierPublic(
                id=s.id,
                name=s.name,
                contact_person=s.contact_person,
                phone=s.phone,
                email=s.email,
                address=s.address,
                tax_id=s.tax_id,
                statistical_id=s.statistical_id,
                trade_registry=s.trade_registry,
                payment_terms=s.payment_terms,
                notes=s.notes,
                is_active=s.is_active,
                created_at=s.created_at,
                updated_at=s.updated_at,
                total_invoiced=invoiced,
                total_paid=paid,
                balance_owed=balance,
            )
        )

    return items, total_count


def create_supplier(session: Session, data: SupplierCreate) -> Supplier:
    """Create a new supplier with duplicate name prevention."""
    existing = session.exec(
        select(Supplier).where(func.lower(Supplier.name) == data.name.strip().lower())
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A supplier with name '{data.name.strip()}' already exists.",
        )

    supplier = Supplier.model_validate(data)
    supplier.name = supplier.name.strip()
    session.add(supplier)
    session.commit()
    session.refresh(supplier)

    audit = AuditLog(
        entity_type="supplier",
        entity_id=str(supplier.id),
        action="create",
        new_values=json.dumps({"name": supplier.name, "phone": supplier.phone}),
    )
    session.add(audit)
    session.commit()

    return supplier


def get_supplier_detail(session: Session, supplier_id: uuid.UUID) -> SupplierDetail:
    """Get supplier profile with chronological invoices, payments, and balance ledger."""
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    invoiced, paid, balance = compute_supplier_totals(session, supplier_id)

    # Invoices for this supplier
    invoices = session.exec(
        select(PurchaseInvoice)
        .where(PurchaseInvoice.supplier_id == supplier_id)
        .order_by(PurchaseInvoice.invoice_date.desc())
    ).all()

    invoices_public: list[PurchaseInvoicePublic] = []
    for inv in invoices:
        paid_for_inv = sum(
            (p.amount for p in inv.payments),
            Decimal("0.00"),
        )
        remaining = inv.total_incl_tax - paid_for_inv
        if remaining <= Decimal("0.00") and paid_for_inv > Decimal("0.00"):
            p_status = InvoicePaymentStatus.PAID
        elif paid_for_inv > Decimal("0.00"):
            p_status = InvoicePaymentStatus.PARTIAL
        else:
            p_status = InvoicePaymentStatus.UNPAID

        diff = (
            abs(inv.supplier_stated_total - inv.total_incl_tax)
            if inv.supplier_stated_total is not None
            else None
        )
        mismatch = diff is not None and diff > Decimal("0.01")

        invoices_public.append(
            PurchaseInvoicePublic(
                id=inv.id,
                supplier_id=inv.supplier_id,
                supplier_name=supplier.name,
                invoice_number=inv.invoice_number,
                invoice_date=inv.invoice_date,
                due_date=inv.due_date,
                supplier_stated_total=inv.supplier_stated_total,
                status=inv.status,
                is_credit_note=inv.is_credit_note,
                parent_invoice_id=inv.parent_invoice_id,
                notes=inv.notes,
                total_excl_tax=inv.total_excl_tax,
                total_tva=inv.total_tva,
                total_incl_tax=inv.total_incl_tax,
                amount_paid=paid_for_inv,
                balance_remaining=remaining,
                payment_status=p_status,
                has_scan=bool(inv.scan_file_path),
                warning_total_mismatch=mismatch,
                stated_difference=diff,
                created_at=inv.created_at,
                updated_at=inv.updated_at,
            )
        )

    # Payments for this supplier
    from app.models import PaymentPublic

    payments = session.exec(
        select(Payment)
        .where(Payment.supplier_id == supplier_id)
        .order_by(Payment.payment_date.desc())
    ).all()
    payments_public = [
        PaymentPublic(
            id=p.id,
            invoice_id=p.invoice_id,
            invoice_number=p.invoice.invoice_number if p.invoice else None,
            supplier_id=p.supplier_id,
            supplier_name=supplier.name,
            payment_date=p.payment_date,
            amount=p.amount,
            payment_method=p.payment_method,
            reference=p.reference,
            notes=p.notes,
            created_at=p.created_at,
        )
        for p in payments
    ]

    return SupplierDetail(
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
        invoices=invoices_public,
        payments=payments_public,
    )


def update_supplier(
    session: Session, supplier: Supplier, data: SupplierUpdate
) -> Supplier:
    """Update supplier profile with audit logging."""
    old_state = {
        "name": supplier.name,
        "phone": supplier.phone,
        "payment_terms": supplier.payment_terms,
    }
    update_dict = data.model_dump(exclude_unset=True)
    if "name" in update_dict and update_dict["name"] is not None:
        new_name = update_dict["name"].strip()
        existing = session.exec(
            select(Supplier).where(
                func.lower(Supplier.name) == new_name.lower(),
                Supplier.id != supplier.id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Another supplier with name '{new_name}' already exists.",
            )
        update_dict["name"] = new_name

    for key, val in update_dict.items():
        setattr(supplier, key, val)
    supplier.updated_at = get_datetime_utc()

    session.add(supplier)
    session.commit()
    session.refresh(supplier)

    audit = AuditLog(
        entity_type="supplier",
        entity_id=str(supplier.id),
        action="update",
        old_values=json.dumps(old_state),
        new_values=json.dumps(
            {
                "name": supplier.name,
                "phone": supplier.phone,
                "payment_terms": supplier.payment_terms,
            }
        ),
    )
    session.add(audit)
    session.commit()

    return supplier


def soft_delete_supplier(session: Session, supplier: Supplier) -> None:
    """Soft-delete supplier to preserve financial history."""
    supplier.is_active = False
    supplier.updated_at = get_datetime_utc()
    session.add(supplier)

    audit = AuditLog(
        entity_type="supplier",
        entity_id=str(supplier.id),
        action="soft_delete",
        new_values=json.dumps({"is_active": False}),
    )
    session.add(audit)
    session.commit()


def export_supplier_statement_csv(
    session: Session, supplier_id: uuid.UUID
) -> StreamingResponse:
    """Generate a chronological statement of account CSV for French Excel."""
    detail = get_supplier_detail(session, supplier_id)
    headers = [
        "Date",
        "Type",
        "Référence",
        "Débit (Facturé DZD)",
        "Crédit (Payé DZD)",
        "Statut / Mode",
        "Notes",
    ]

    # Combine invoices and payments into a chronological ledger
    transactions: list[tuple[str, str, str, str, str, str, str]] = []

    for inv in detail.invoices:
        inv_type = "Avoir" if inv.is_credit_note else "Facture"
        transactions.append(
            (
                inv.invoice_date.strftime("%d/%m/%Y"),
                inv_type,
                inv.invoice_number,
                f"{inv.total_incl_tax:.2f}",
                "",
                str(inv.status),
                inv.notes or "",
            )
        )

    for p in detail.payments:
        transactions.append(
            (
                p.payment_date.strftime("%d/%m/%Y"),
                "Paiement",
                p.invoice_number or "",
                "",
                f"{p.amount:.2f}",
                str(p.payment_method),
                p.reference or p.notes or "",
            )
        )

    # Sort by date
    transactions.sort(key=lambda x: x[0], reverse=False)

    # Append summary row
    transactions.append(
        (
            "SOLDE FINAL",
            "TOTAL",
            "",
            f"{detail.total_invoiced:.2f}",
            f"{detail.total_paid:.2f}",
            f"SOLDE DÛ: {detail.balance_owed:.2f} DZD",
            "",
        )
    )

    clean_name = "".join(c for c in detail.name if c.isalnum() or c in ("-", "_"))
    filename = f"releve_compte_{clean_name}.csv"
    return build_csv_streaming_response(
        headers=headers, rows=transactions, filename=filename
    )
