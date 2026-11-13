import json
import uuid
from datetime import timedelta
from decimal import Decimal

from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, col, func, select

from app.models import (
    AuditLog,
    InvoiceLine,
    Lot,
    LotCreate,
    LotPublic,
    MovementType,
    Product,
    ProductCategory,
    ProductCreate,
    ProductPriceHistoryItem,
    ProductPublic,
    ProductUpdate,
    PurchaseInvoice,
    StockMovement,
    StockMovementCreate,
    StockMovementPublic,
    Supplier,
    get_datetime_utc,
)
from app.services.csv_export import build_csv_streaming_response
from app.services.purchases import quantize_money


def get_product_stock_on_hand(session: Session, product_id: uuid.UUID) -> Decimal:
    """Derive total stock on hand for a product by summing all signed stock movements."""
    result = session.exec(
        select(func.sum(StockMovement.quantity)).where(
            StockMovement.product_id == product_id
        )
    ).one_or_none()
    return Decimal(str(result)) if result is not None else Decimal("0.00")


def get_lot_stock_on_hand(session: Session, lot_id: uuid.UUID) -> Decimal:
    """Derive remaining quantity for a specific lot by summing all signed movements."""
    result = session.exec(
        select(func.sum(StockMovement.quantity)).where(StockMovement.lot_id == lot_id)
    ).one_or_none()
    return Decimal(str(result)) if result is not None else Decimal("0.00")


def list_products(
    session: Session,
    category: ProductCategory | None = None,
    search: str | None = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[ProductPublic], int]:
    """List products with search, category filtering, and derived stock levels."""
    query = select(Product)
    if active_only:
        query = query.where(Product.is_active.is_(True))  # type: ignore[attr-defined]
    if category:
        query = query.where(Product.category == category)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            col(Product.name).ilike(term) | col(Product.reference_code).ilike(term)
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    products = session.exec(
        query.order_by(Product.name.asc()).offset(skip).limit(limit)
    ).all()

    items: list[ProductPublic] = []
    for p in products:
        current_stock = get_product_stock_on_hand(session, p.id)
        supplier_name = p.usual_supplier.name if p.usual_supplier else None
        items.append(
            ProductPublic(
                id=p.id,
                name=p.name,
                reference_code=p.reference_code,
                category=p.category,
                unit=p.unit,
                usual_supplier_id=p.usual_supplier_id,
                usual_supplier_name=supplier_name,
                track_lots=p.track_lots,
                min_stock=p.min_stock,
                storage_location=p.storage_location,
                notes=p.notes,
                is_active=p.is_active,
                current_stock=current_stock,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return items, total_count


def create_product(session: Session, data: ProductCreate) -> Product:
    """Create a new product with duplicate reference code prevention."""
    if data.reference_code and data.reference_code.strip():
        ref = data.reference_code.strip()
        existing = session.exec(
            select(Product).where(func.lower(Product.reference_code) == ref.lower())
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"A product with reference code '{ref}' already exists.",
            )

    product = Product.model_validate(data)
    product.name = product.name.strip()
    if product.reference_code:
        product.reference_code = product.reference_code.strip()

    session.add(product)
    session.commit()
    session.refresh(product)

    audit = AuditLog(
        entity_type="product",
        entity_id=str(product.id),
        action="create",
        new_values=json.dumps(
            {"name": product.name, "category": str(product.category)}
        ),
    )
    session.add(audit)
    session.commit()

    return product


def update_product(session: Session, product: Product, data: ProductUpdate) -> Product:
    """Update product details with audit logging."""
    old_state = {
        "name": product.name,
        "reference_code": product.reference_code,
        "category": str(product.category),
        "unit": product.unit,
        "track_lots": product.track_lots,
    }

    update_dict = data.model_dump(exclude_unset=True)
    if update_dict.get("reference_code"):
        ref = update_dict["reference_code"].strip()
        existing = session.exec(
            select(Product).where(
                func.lower(Product.reference_code) == ref.lower(),
                Product.id != product.id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Another product with reference code '{ref}' already exists.",
            )
        update_dict["reference_code"] = ref

    for key, val in update_dict.items():
        setattr(product, key, val)
    product.updated_at = get_datetime_utc()

    session.add(product)
    session.commit()
    session.refresh(product)

    audit = AuditLog(
        entity_type="product",
        entity_id=str(product.id),
        action="update",
        old_values=json.dumps(old_state),
        new_values=json.dumps(
            {
                "name": product.name,
                "reference_code": product.reference_code,
                "category": str(product.category),
                "unit": product.unit,
                "track_lots": product.track_lots,
            }
        ),
    )
    session.add(audit)
    session.commit()

    return product


def soft_delete_product(session: Session, product: Product) -> None:
    """Soft-delete product so invoice lines and movements remain valid."""
    product.is_active = False
    product.updated_at = get_datetime_utc()
    session.add(product)

    audit = AuditLog(
        entity_type="product",
        entity_id=str(product.id),
        action="soft_delete",
        new_values=json.dumps({"is_active": False}),
    )
    session.add(audit)
    session.commit()


def get_product_price_history(
    session: Session, product_id: uuid.UUID
) -> list[ProductPriceHistoryItem]:
    """Retrieve chronological purchase history across all suppliers for a product."""
    lines = session.exec(
        select(InvoiceLine, PurchaseInvoice, Supplier)
        .join(PurchaseInvoice, col(InvoiceLine.invoice_id) == col(PurchaseInvoice.id))
        .join(Supplier, col(PurchaseInvoice.supplier_id) == col(Supplier.id))
        .where(
            InvoiceLine.product_id == product_id,
            PurchaseInvoice.is_credit_note.is_(False),  # type: ignore[attr-defined]
        )
        .order_by(PurchaseInvoice.invoice_date.desc())
    ).all()

    return [
        ProductPriceHistoryItem(
            invoice_id=inv.id,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            supplier_id=supp.id,
            supplier_name=supp.name,
            quantity=line.quantity,
            unit_price_excl_tax=line.unit_price_excl_tax,
            tva_rate=line.tva_rate,
            total_line_incl_tax=line.total_line_incl_tax,
        )
        for line, inv, supp in lines
    ]


def to_lot_public(session: Session, lot: Lot) -> LotPublic:
    """Convert Lot model to LotPublic with derived current quantity and expiry countdown."""
    current_qty = get_lot_stock_on_hand(session, lot.id)
    today = get_datetime_utc().date()
    days_left = (lot.expiration_date - today).days

    return LotPublic(
        id=lot.id,
        product_id=lot.product_id,
        product_name=lot.product.name if lot.product else None,
        product_unit=lot.product.unit if lot.product else None,
        supplier_id=lot.supplier_id,
        supplier_name=lot.supplier.name if lot.supplier else None,
        lot_number=lot.lot_number,
        expiration_date=lot.expiration_date,
        received_date=lot.received_date,
        source_invoice_line_id=lot.source_invoice_line_id,
        is_active=lot.is_active,
        current_quantity=current_qty,
        is_expired=days_left < 0,
        days_until_expiry=days_left,
        created_at=lot.created_at,
    )


def list_lots(
    session: Session,
    product_id: uuid.UUID | None = None,
    is_active: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[LotPublic], int]:
    """List lots with derived remaining quantities and days until expiry."""
    query = select(Lot)
    if is_active:
        query = query.where(Lot.is_active.is_(True))  # type: ignore[attr-defined]
    if product_id:
        query = query.where(Lot.product_id == product_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    lots = session.exec(
        query.order_by(Lot.expiration_date.asc()).offset(skip).limit(limit)
    ).all()

    items = [to_lot_public(session, lot) for lot in lots]
    return items, total_count


def create_lot_with_initial_stock(session: Session, data: LotCreate) -> LotPublic:
    """Create a new lot and optionally record an initial IN stock movement in one transaction."""
    product = session.get(Product, data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    existing = session.exec(
        select(Lot).where(
            Lot.product_id == data.product_id,
            func.lower(Lot.lot_number) == data.lot_number.strip().lower(),
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Lot number '{data.lot_number.strip()}' already exists for this product.",
        )

    lot = Lot(
        product_id=data.product_id,
        supplier_id=data.supplier_id,
        lot_number=data.lot_number.strip(),
        expiration_date=data.expiration_date,
        received_date=data.received_date,
        source_invoice_line_id=data.source_invoice_line_id,
        is_active=data.is_active,
    )
    session.add(lot)
    session.flush()

    if data.initial_quantity and data.initial_quantity > Decimal("0.00"):
        movement = StockMovement(
            product_id=product.id,
            lot_id=lot.id,
            movement_type=MovementType.IN,
            quantity=quantize_money(data.initial_quantity),
            movement_date=data.received_date,
            reason="Initial lot creation",
            source_reference=f"Lot #{lot.lot_number}",
        )
        session.add(movement)

    session.commit()
    session.refresh(lot)

    audit = AuditLog(
        entity_type="lot",
        entity_id=str(lot.id),
        action="create",
        new_values=json.dumps(
            {
                "lot_number": lot.lot_number,
                "product_id": str(lot.product_id),
                "expiration_date": str(lot.expiration_date),
            }
        ),
    )
    session.add(audit)
    session.commit()

    return to_lot_public(session, lot)


def record_manual_stock_movement(
    session: Session, data: StockMovementCreate
) -> StockMovementPublic:
    """
    Record manual stock consumption or adjustment (Phase C).
    Enforces that stock on hand can NEVER be pushed below zero!
    """
    product = session.get(Product, data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    # Calculate current stock
    if data.lot_id:
        lot = session.get(Lot, data.lot_id)
        if not lot:
            raise HTTPException(status_code=404, detail="Lot not found.")
        current_available = get_lot_stock_on_hand(session, lot.id)
    else:
        current_available = get_product_stock_on_hand(session, product.id)

    qty_to_apply = quantize_money(data.quantity)

    # Determine signed quantity based on movement type
    if data.movement_type == MovementType.OUT:
        signed_qty = -abs(qty_to_apply)
        if current_available + signed_qty < Decimal("0.00"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient stock on hand. Available: {current_available} {product.unit}, "
                    f"requested deduction: {qty_to_apply} {product.unit}."
                ),
            )
    elif data.movement_type == MovementType.IN:
        signed_qty = abs(qty_to_apply)
    else:  # ADJUSTMENT
        signed_qty = qty_to_apply
        if current_available + signed_qty < Decimal("0.00"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Adjustment would push stock below zero. Current stock: {current_available} {product.unit}."
                ),
            )

    movement = StockMovement(
        product_id=product.id,
        lot_id=data.lot_id,
        movement_type=data.movement_type,
        quantity=signed_qty,
        movement_date=data.movement_date,
        reason=data.reason.strip(),
        source_reference="Manual movement",
    )
    session.add(movement)
    session.commit()
    session.refresh(movement)

    audit = AuditLog(
        entity_type="stock_movement",
        entity_id=str(movement.id),
        action="manual_movement",
        new_values=json.dumps(
            {
                "product_id": str(movement.product_id),
                "lot_id": str(movement.lot_id) if movement.lot_id else None,
                "type": str(movement.movement_type),
                "quantity": str(movement.quantity),
                "reason": movement.reason,
            }
        ),
    )
    session.add(audit)
    session.commit()

    return StockMovementPublic(
        id=movement.id,
        product_id=movement.product_id,
        product_name=product.name,
        lot_id=movement.lot_id,
        lot_number=movement.lot.lot_number if movement.lot else None,
        movement_type=movement.movement_type,
        quantity=movement.quantity,
        movement_date=movement.movement_date,
        reason=movement.reason,
        source_reference=movement.source_reference,
        created_at=movement.created_at,
    )


def list_stock_movements(
    session: Session,
    product_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[StockMovementPublic], int]:
    """List stock movement audit ledger."""
    query = select(StockMovement)
    if product_id:
        query = query.where(StockMovement.product_id == product_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    movements = session.exec(
        query.order_by(
            StockMovement.movement_date.desc(), StockMovement.created_at.desc()
        )
        .offset(skip)
        .limit(limit)
    ).all()

    items = [
        StockMovementPublic(
            id=m.id,
            product_id=m.product_id,
            product_name=m.product.name if m.product else None,
            lot_id=m.lot_id,
            lot_number=m.lot.lot_number if m.lot else None,
            movement_type=m.movement_type,
            quantity=m.quantity,
            movement_date=m.movement_date,
            reason=m.reason,
            source_reference=m.source_reference,
            created_at=m.created_at,
        )
        for m in movements
    ]
    return items, total_count


def count_low_stock_alerts(session: Session) -> int:
    """Count products where current stock on hand <= min_stock."""
    products = session.exec(
        select(Product).where(
            Product.is_active.is_(True),  # type: ignore[attr-defined]
            Product.min_stock.is_not(None),  # type: ignore[attr-defined]
        )
    ).all()
    count = 0
    for p in products:
        if (
            p.min_stock is not None
            and get_product_stock_on_hand(session, p.id) <= p.min_stock
        ):
            count += 1
    return count


def count_expiring_lots(session: Session, days: int = 60) -> int:
    """Count active lots expiring within N days."""
    today = get_datetime_utc().date()
    target_date = today + timedelta(days=days)
    lots = session.exec(
        select(Lot).where(
            Lot.is_active.is_(True),  # type: ignore[attr-defined]
            Lot.expiration_date <= target_date,
        )
    ).all()
    count = 0
    for lot in lots:
        if get_lot_stock_on_hand(session, lot.id) > Decimal("0.00"):
            count += 1
    return count


def get_low_stock_alerts(session: Session) -> list[dict[str, object]]:
    """Return products at or below minimum threshold."""
    products = session.exec(
        select(Product).where(
            Product.is_active.is_(True),  # type: ignore[attr-defined]
            Product.min_stock.is_not(None),  # type: ignore[attr-defined]
        )
    ).all()

    alerts: list[dict[str, object]] = []
    for p in products:
        stock = get_product_stock_on_hand(session, p.id)
        if p.min_stock is not None and stock <= p.min_stock:
            alerts.append(
                {
                    "product_id": str(p.id),
                    "product_name": p.name,
                    "reference_code": p.reference_code,
                    "unit": p.unit,
                    "current_stock": float(stock),
                    "min_stock": float(p.min_stock),
                    "deficit": float(p.min_stock - stock),
                }
            )
    return alerts


def get_expiring_lots(session: Session, days: int = 60) -> list[LotPublic]:
    """Return active lots with positive stock expiring within N days."""
    today = get_datetime_utc().date()
    target_date = today + timedelta(days=days)
    lots = session.exec(
        select(Lot)
        .where(
            Lot.is_active.is_(True),  # type: ignore[attr-defined]
            Lot.expiration_date <= target_date,
        )
        .order_by(Lot.expiration_date.asc())
    ).all()

    results: list[LotPublic] = []
    for lot in lots:
        qty = get_lot_stock_on_hand(session, lot.id)
        if qty > Decimal("0.00"):
            results.append(to_lot_public(session, lot))
    return results


def export_stock_status_csv(session: Session) -> StreamingResponse:
    """Export product catalog and stock levels to French Excel CSV."""
    products, _ = list_products(session, active_only=True, limit=10000)
    headers = [
        "Nom Produit",
        "Référence (Code)",
        "Catégorie",
        "Unité",
        "Fournisseur Habituel",
        "Stock Actuel",
        "Seuil Minimum",
        "Alerte Seuil",
        "Emplacement",
    ]

    rows = []
    for p in products:
        is_low = p.min_stock is not None and p.current_stock <= p.min_stock
        rows.append(
            (
                p.name,
                p.reference_code or "",
                str(p.category),
                p.unit,
                p.usual_supplier_name or "",
                f"{p.current_stock:.2f}",
                f"{p.min_stock:.2f}" if p.min_stock is not None else "",
                "OUI (Stock Faible)" if is_low else "NON",
                p.storage_location or "",
            )
        )

    filename = f"etat_stocks_{get_datetime_utc().strftime('%Y%m%d')}.csv"
    return build_csv_streaming_response(headers=headers, rows=rows, filename=filename)
