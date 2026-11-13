import json
import uuid
from datetime import date as DateType
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, col, func, select

from app.core.config import DATA_DIR
from app.models import (
    AuditLog,
    CompanySettings,
    InventoryDashboardMetrics,
    InvoiceLine,
    InvoicePaymentStatus,
    InvoiceStatus,
    Lot,
    MonthlySpendingItem,
    MovementType,
    Payment,
    PaymentCreate,
    PaymentPublic,
    Product,
    PurchaseInvoice,
    PurchaseInvoiceCreate,
    PurchaseInvoiceDetail,
    PurchaseInvoicePublic,
    PurchaseInvoiceUpdate,
    StockMovement,
    Supplier,
    SupplierSpendingItem,
    get_datetime_utc,
)
from app.services.csv_export import build_csv_streaming_response

INVOICE_SCANS_DIR = DATA_DIR / "invoice_scans"


def quantize_money(amount: Decimal) -> Decimal:
    """Format and round decimal money amount to 2 decimal places using standard commercial rounding."""
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_line_totals(
    quantity: Decimal,
    unit_price_excl_tax: Decimal,
    tva_rate: Decimal,
    discount_amount: Decimal = Decimal("0.00"),
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Calculate (total_line_excl_tax, total_line_tva, total_line_incl_tax) with Decimal precision.
    Formula:
      excl_tax = (qty * unit_price) - discount
      tva = excl_tax * (tva_rate / 100)
      incl_tax = excl_tax + tva
    """
    raw_excl = (quantity * unit_price_excl_tax) - discount_amount
    line_excl = quantize_money(max(Decimal("0.00"), raw_excl))
    line_tva = quantize_money(line_excl * (tva_rate / Decimal("100.00")))
    line_incl = line_excl + line_tva
    return line_excl, line_tva, line_incl


def create_purchase_invoice(
    session: Session, data: PurchaseInvoiceCreate
) -> PurchaseInvoice:
    """Create purchase invoice, compute totals from lines, log audit, and handle receiving if enabled."""
    supplier = session.get(Supplier, data.supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    # Check for duplicate invoice number for the same supplier
    existing = session.exec(
        select(PurchaseInvoice).where(
            PurchaseInvoice.supplier_id == data.supplier_id,
            func.lower(PurchaseInvoice.invoice_number)
            == data.invoice_number.strip().lower(),
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"An invoice with number '{data.invoice_number.strip()}' "
                f"already exists for supplier '{supplier.name}'."
            ),
        )

    # Validate products exist
    product_ids = {line.product_id for line in data.lines}
    db_products = {
        p.id: p
        for p in session.exec(
            select(Product).where(col(Product.id).in_(product_ids))
        ).all()
    }
    if len(db_products) != len(product_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more specified product IDs were not found.",
        )

    settings = session.get(CompanySettings, 1)
    track_inventory = settings.inventory_tracking_enabled if settings else False

    # Build invoice entity
    invoice = PurchaseInvoice(
        supplier_id=data.supplier_id,
        invoice_number=data.invoice_number.strip(),
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        supplier_stated_total=data.supplier_stated_total,
        status=data.status,
        is_credit_note=data.is_credit_note,
        parent_invoice_id=data.parent_invoice_id,
        notes=data.notes,
    )
    session.add(invoice)
    session.flush()

    total_excl = Decimal("0.00")
    total_tva = Decimal("0.00")
    total_incl = Decimal("0.00")

    for line_data in data.lines:
        prod = db_products[line_data.product_id]
        excl, tva, incl = calculate_line_totals(
            quantity=line_data.quantity,
            unit_price_excl_tax=line_data.unit_price_excl_tax,
            tva_rate=line_data.tva_rate,
            discount_amount=line_data.discount_amount,
        )
        total_excl += excl
        total_tva += tva
        total_incl += incl

        db_line = InvoiceLine(
            invoice_id=invoice.id,
            product_id=line_data.product_id,
            quantity=line_data.quantity,
            unit_price_excl_tax=line_data.unit_price_excl_tax,
            tva_rate=line_data.tva_rate,
            discount_amount=line_data.discount_amount,
            total_line_excl_tax=excl,
            total_line_tva=tva,
            total_line_incl_tax=incl,
        )
        session.add(db_line)
        session.flush()

        # Phase B: If inventory tracking is enabled and product tracks lots or stock
        if (
            track_inventory
            and data.status == InvoiceStatus.CONFIRMED
            and not data.is_credit_note
        ):
            created_lot_id = None
            if prod.track_lots and line_data.lot_number and line_data.expiration_date:
                lot = Lot(
                    product_id=prod.id,
                    supplier_id=supplier.id,
                    lot_number=line_data.lot_number.strip(),
                    expiration_date=line_data.expiration_date,
                    received_date=data.invoice_date,
                    source_invoice_line_id=db_line.id,
                )
                session.add(lot)
                session.flush()
                created_lot_id = lot.id

            movement = StockMovement(
                product_id=prod.id,
                lot_id=created_lot_id,
                movement_type=MovementType.IN,
                quantity=line_data.quantity,
                movement_date=data.invoice_date,
                reason="Purchase invoice reception",
                source_reference=f"Invoice #{invoice.invoice_number}",
            )
            session.add(movement)

    invoice.total_excl_tax = quantize_money(total_excl)
    invoice.total_tva = quantize_money(total_tva)
    invoice.total_incl_tax = quantize_money(total_incl)

    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    # Audit log
    audit = AuditLog(
        entity_type="invoice",
        entity_id=str(invoice.id),
        action="create",
        new_values=json.dumps(
            {
                "invoice_number": invoice.invoice_number,
                "supplier_id": str(invoice.supplier_id),
                "total_incl_tax": str(invoice.total_incl_tax),
                "status": str(invoice.status),
            }
        ),
    )
    session.add(audit)
    session.commit()

    return invoice


def to_invoice_public(
    inv: PurchaseInvoice, supplier_name: str | None = None
) -> PurchaseInvoicePublic:
    """Helper to convert a PurchaseInvoice DB model to PurchaseInvoicePublic schema."""
    paid = sum((p.amount for p in inv.payments), Decimal("0.00"))
    remaining = inv.total_incl_tax - paid

    if remaining <= Decimal("0.00") and paid > Decimal("0.00"):
        p_status = InvoicePaymentStatus.PAID
    elif paid > Decimal("0.00"):
        p_status = InvoicePaymentStatus.PARTIAL
    else:
        p_status = InvoicePaymentStatus.UNPAID

    diff = (
        abs(inv.supplier_stated_total - inv.total_incl_tax)
        if inv.supplier_stated_total is not None
        else None
    )
    mismatch = diff is not None and diff > Decimal("0.01")

    return PurchaseInvoicePublic(
        id=inv.id,
        supplier_id=inv.supplier_id,
        supplier_name=supplier_name or (inv.supplier.name if inv.supplier else None),
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
        amount_paid=paid,
        balance_remaining=remaining,
        payment_status=p_status,
        has_scan=bool(inv.scan_file_path),
        warning_total_mismatch=mismatch,
        stated_difference=diff,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


def list_purchase_invoices(
    session: Session,
    supplier_id: uuid.UUID | None = None,
    status: InvoiceStatus | None = None,
    start_date: DateType | None = None,
    end_date: DateType | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[PurchaseInvoicePublic], int]:
    """List purchase invoices with filtering, pagination, and calculated payment balances."""
    query = select(PurchaseInvoice)
    if supplier_id:
        query = query.where(PurchaseInvoice.supplier_id == supplier_id)
    if status:
        query = query.where(PurchaseInvoice.status == status)
    if start_date:
        query = query.where(PurchaseInvoice.invoice_date >= start_date)
    if end_date:
        query = query.where(PurchaseInvoice.invoice_date <= end_date)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Supplier).where(
            col(PurchaseInvoice.invoice_number).ilike(term)
            | col(Supplier.name).ilike(term)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    invoices = session.exec(
        query.order_by(PurchaseInvoice.invoice_date.desc()).offset(skip).limit(limit)
    ).all()

    items = [to_invoice_public(inv) for inv in invoices]
    return items, total_count


def get_purchase_invoice_detail(
    session: Session, invoice_id: uuid.UUID
) -> PurchaseInvoiceDetail:
    """Retrieve full purchase invoice details with lines and payments."""
    inv = session.get(PurchaseInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    pub = to_invoice_public(inv)

    from app.models import InvoiceLinePublic

    lines_public = [
        InvoiceLinePublic(
            id=line.id,
            invoice_id=line.invoice_id,
            product_id=line.product_id,
            product_name=line.product.name if line.product else None,
            product_unit=line.product.unit if line.product else None,
            product_reference=line.product.reference_code if line.product else None,
            quantity=line.quantity,
            unit_price_excl_tax=line.unit_price_excl_tax,
            tva_rate=line.tva_rate,
            discount_amount=line.discount_amount,
            total_line_excl_tax=line.total_line_excl_tax,
            total_line_tva=line.total_line_tva,
            total_line_incl_tax=line.total_line_incl_tax,
        )
        for line in inv.lines
    ]

    payments_public = [
        PaymentPublic(
            id=p.id,
            invoice_id=p.invoice_id,
            invoice_number=inv.invoice_number,
            supplier_id=p.supplier_id,
            supplier_name=inv.supplier.name if inv.supplier else None,
            payment_date=p.payment_date,
            amount=p.amount,
            payment_method=p.payment_method,
            reference=p.reference,
            notes=p.notes,
            created_at=p.created_at,
        )
        for p in inv.payments
    ]

    return PurchaseInvoiceDetail(
        **pub.model_dump(),
        lines=lines_public,
        payments=payments_public,
    )


def update_purchase_invoice(
    session: Session, invoice_id: uuid.UUID, data: PurchaseInvoiceUpdate
) -> PurchaseInvoice:
    """Update invoice metadata (notes, due date, stated total, status)."""
    inv = session.get(PurchaseInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    old_state = {
        "invoice_number": inv.invoice_number,
        "due_date": str(inv.due_date) if inv.due_date else None,
        "status": str(inv.status),
        "notes": inv.notes,
    }

    update_dict = data.model_dump(exclude_unset=True)
    if (
        "status" in update_dict
        and update_dict["status"] == InvoiceStatus.CANCELLED
        and inv.status != InvoiceStatus.CANCELLED
    ):
        # Handle cancellation & reversing movements
        transition_invoice_to_cancelled(session, inv, "Cancelled by user edit")
        update_dict.pop("status")

    for key, val in update_dict.items():
        setattr(inv, key, val)
    inv.updated_at = get_datetime_utc()

    session.add(inv)
    session.commit()
    session.refresh(inv)

    audit = AuditLog(
        entity_type="invoice",
        entity_id=str(inv.id),
        action="update",
        old_values=json.dumps(old_state),
        new_values=json.dumps(
            {
                "invoice_number": inv.invoice_number,
                "due_date": str(inv.due_date) if inv.due_date else None,
                "status": str(inv.status),
                "notes": inv.notes,
            }
        ),
    )
    session.add(audit)
    session.commit()

    return inv


def transition_invoice_to_cancelled(
    session: Session, inv: PurchaseInvoice, reason: str
) -> None:
    """
    Cancel an invoice cleanly:
    - Never delete stock movements!
    - Creates reversing ADJUSTMENT movements if the invoice originally introduced stock IN.
    """
    inv.status = InvoiceStatus.CANCELLED
    inv.updated_at = get_datetime_utc()

    # Find stock movements originating from this invoice
    ref_marker = f"Invoice #{inv.invoice_number}"
    orig_movements = session.exec(
        select(StockMovement).where(
            StockMovement.source_reference == ref_marker,
            StockMovement.movement_type == MovementType.IN,
        )
    ).all()

    for orig in orig_movements:
        # Reversing movement (negative quantity)
        reversal = StockMovement(
            product_id=orig.product_id,
            lot_id=orig.lot_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=-orig.quantity,
            movement_date=get_datetime_utc().date(),
            reason=f"Cancellation reversal for invoice #{inv.invoice_number}: {reason}",
            source_reference=f"Cancellation #{inv.invoice_number}",
        )
        session.add(reversal)

    session.add(inv)
    session.flush()


def record_payment(
    session: Session, invoice_id: uuid.UUID, data: PaymentCreate
) -> tuple[Payment, bool, Decimal]:
    """
    Record payment against a specific invoice.
    Returns (payment, exceeds_balance_flag, remaining_balance).
    """
    inv = session.get(PurchaseInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    if inv.status == InvoiceStatus.CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Cannot record payment against a cancelled invoice.",
        )

    current_paid = sum((p.amount for p in inv.payments), Decimal("0.00"))
    remaining_before = inv.total_incl_tax - current_paid
    exceeds_balance = data.amount > remaining_before

    payment = Payment(
        invoice_id=inv.id,
        supplier_id=inv.supplier_id,
        payment_date=data.payment_date,
        amount=quantize_money(data.amount),
        payment_method=data.payment_method,
        reference=data.reference,
        notes=data.notes,
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    new_remaining = remaining_before - payment.amount

    audit = AuditLog(
        entity_type="payment",
        entity_id=str(payment.id),
        action="create",
        new_values=json.dumps(
            {
                "invoice_id": str(payment.invoice_id),
                "supplier_id": str(payment.supplier_id),
                "amount": str(payment.amount),
                "method": str(payment.payment_method),
            }
        ),
    )
    session.add(audit)
    session.commit()

    return payment, exceeds_balance, new_remaining


def save_invoice_scan(
    session: Session, invoice_id: uuid.UUID, file_bytes: bytes, filename: str
) -> str:
    """Save an invoice scan file locally and record its path in the database."""
    inv = session.get(PurchaseInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    INVOICE_SCANS_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename).suffix.lower()
    if suffix not in (".pdf", ".jpg", ".jpeg", ".png"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported scan format. Allowed formats: PDF, JPG, PNG.",
        )

    dest_filename = f"{inv.id}{suffix}"
    dest_path = INVOICE_SCANS_DIR / dest_filename
    dest_path.write_bytes(file_bytes)

    inv.scan_file_path = dest_filename
    inv.updated_at = get_datetime_utc()
    session.add(inv)
    session.commit()

    return dest_filename


def get_invoice_scan_path(session: Session, invoice_id: uuid.UUID) -> Path:
    """Retrieve filesystem path for an invoice scan."""
    inv = session.get(PurchaseInvoice, invoice_id)
    if not inv or not inv.scan_file_path:
        raise HTTPException(
            status_code=404, detail="No scan file attached to this invoice."
        )

    file_path = INVOICE_SCANS_DIR / inv.scan_file_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Scan file not found on disk.")

    return file_path


def get_inventory_dashboard_metrics(session: Session) -> InventoryDashboardMetrics:
    """
    Compute supplier debt, invoices due in next 7 days, and monthly spending overview.
    """
    today = get_datetime_utc().date()
    seven_days = today + timedelta(days=7)

    # All non-cancelled invoices
    active_invoices = session.exec(
        select(PurchaseInvoice).where(PurchaseInvoice.status != InvoiceStatus.CANCELLED)
    ).all()

    total_invoiced = sum(
        (
            inv.total_incl_tax if not inv.is_credit_note else -inv.total_incl_tax
            for inv in active_invoices
        ),
        Decimal("0.00"),
    )

    all_payments = session.exec(select(Payment.amount)).all()
    total_paid = sum(all_payments, Decimal("0.00"))
    total_debt = max(Decimal("0.00"), total_invoiced - total_paid)

    # Invoices due within 7 days
    due_invoices = [
        inv
        for inv in active_invoices
        if inv.due_date
        and today <= inv.due_date <= seven_days
        and not inv.is_credit_note
    ]

    due_count = 0
    due_total = Decimal("0.00")
    for inv in due_invoices:
        paid = sum((p.amount for p in inv.payments), Decimal("0.00"))
        remaining = inv.total_incl_tax - paid
        if remaining > Decimal("0.00"):
            due_count += 1
            due_total += remaining

    # Top spending suppliers (last 12 months)
    supplier_spending: dict[uuid.UUID, Decimal] = {}
    supplier_names: dict[uuid.UUID, str] = {}
    for inv in active_invoices:
        if not inv.is_credit_note:
            supplier_spending[inv.supplier_id] = (
                supplier_spending.get(inv.supplier_id, Decimal("0.00"))
                + inv.total_incl_tax
            )
            if inv.supplier_id not in supplier_names and inv.supplier:
                supplier_names[inv.supplier_id] = inv.supplier.name

    top_suppliers = sorted(supplier_spending.items(), key=lambda x: x[1], reverse=True)[
        :5
    ]
    top_items = [
        SupplierSpendingItem(
            supplier_id=s_id,
            supplier_name=supplier_names.get(s_id, "Fournisseur"),
            total_spending=amt,
        )
        for s_id, amt in top_suppliers
    ]

    # Monthly spending (last 6 months)
    monthly_map: dict[tuple[int, int], Decimal] = {}
    for inv in active_invoices:
        if not inv.is_credit_note:
            key = (inv.invoice_date.year, inv.invoice_date.month)
            monthly_map[key] = (
                monthly_map.get(key, Decimal("0.00")) + inv.total_incl_tax
            )

    sorted_months = sorted(monthly_map.items(), key=lambda x: (x[0][0], x[0][1]))[-6:]
    monthly_items = [
        MonthlySpendingItem(year=y, month=m, total_spending=amt)
        for (y, m), amt in sorted_months
    ]

    # Alerts (Phase B)
    settings = session.get(CompanySettings, 1)
    low_stock_count = 0
    expiring_count = 0
    if settings and settings.inventory_tracking_enabled:
        from app.services.inventory import (
            count_expiring_lots,
            count_low_stock_alerts,
        )

        low_stock_count = count_low_stock_alerts(session)
        expiring_count = count_expiring_lots(
            session, days=settings.default_expiry_alert_days
        )

    return InventoryDashboardMetrics(
        total_debt_owed=total_debt,
        invoices_due_7_days_count=due_count,
        invoices_due_7_days_total=due_total,
        monthly_spending=monthly_items,
        top_suppliers_spending=top_items,
        low_stock_count=low_stock_count,
        expiring_lots_count=expiring_count,
        currency="DZD",
    )


def export_invoices_csv(
    session: Session,
    start_date: DateType | None = None,
    end_date: DateType | None = None,
    supplier_id: uuid.UUID | None = None,
) -> StreamingResponse:
    """Export purchase invoices ledger to UTF-8 BOM semicolon CSV for Excel."""
    items, _ = list_purchase_invoices(
        session,
        supplier_id=supplier_id,
        start_date=start_date,
        end_date=end_date,
        limit=10000,
    )
    headers = [
        "Date Facture",
        "N° Facture",
        "Fournisseur",
        "Total HT (DZD)",
        "TVA (DZD)",
        "Total TTC (DZD)",
        "Payé (DZD)",
        "Reste Dû (DZD)",
        "Statut Paiement",
        "Statut Facture",
        "Date Échéance",
        "Notes",
    ]

    rows = [
        (
            inv.invoice_date.strftime("%d/%m/%Y"),
            inv.invoice_number,
            inv.supplier_name or "",
            f"{inv.total_excl_tax:.2f}",
            f"{inv.total_tva:.2f}",
            f"{inv.total_incl_tax:.2f}",
            f"{inv.amount_paid:.2f}",
            f"{inv.balance_remaining:.2f}",
            str(inv.payment_status),
            str(inv.status),
            inv.due_date.strftime("%d/%m/%Y") if inv.due_date else "",
            inv.notes or "",
        )
        for inv in items
    ]

    filename = f"factures_achats_{get_datetime_utc().strftime('%Y%m%d')}.csv"
    return build_csv_streaming_response(headers=headers, rows=rows, filename=filename)


def get_monthly_tva_summary(session: Session, year: int) -> list[dict[str, object]]:
    """Generate monthly TVA breakdown on purchases for accounting records."""
    invoices = session.exec(
        select(PurchaseInvoice).where(
            PurchaseInvoice.status != InvoiceStatus.CANCELLED,
            func.strftime("%Y", PurchaseInvoice.invoice_date) == str(year),
        )
    ).all()

    months: dict[int, dict[str, Decimal]] = {
        m: {
            "excl_tax": Decimal("0.00"),
            "tva": Decimal("0.00"),
            "incl_tax": Decimal("0.00"),
        }
        for m in range(1, 13)
    }

    for inv in invoices:
        m = inv.invoice_date.month
        mult = Decimal("-1.00") if inv.is_credit_note else Decimal("1.00")
        months[m]["excl_tax"] += inv.total_excl_tax * mult
        months[m]["tva"] += inv.total_tva * mult
        months[m]["incl_tax"] += inv.total_incl_tax * mult

    return [
        {
            "month": m,
            "year": year,
            "total_excl_tax": quantize_money(data["excl_tax"]),
            "total_tva": quantize_money(data["tva"]),
            "total_incl_tax": quantize_money(data["incl_tax"]),
        }
        for m, data in sorted(months.items())
    ]
