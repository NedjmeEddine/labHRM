import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.api.deps import SessionDep, get_current_user
from app.models import (
    CompanySettings,
    LotCreate,
    LotPublic,
    LotsPublic,
    StockMovementCreate,
    StockMovementPublic,
    StockMovementsPublic,
)
from app.services import inventory as inventory_service

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/lots", response_model=LotsPublic)
def read_lots(
    session: SessionDep,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    is_active: Annotated[bool, Query()] = True,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> LotsPublic:
    """List lots with derived remaining quantities and expiration tracking (Phase B)."""
    items, count = inventory_service.list_lots(
        session=session,
        product_id=product_id,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )
    return LotsPublic(data=items, count=count)


@router.post("/lots", response_model=LotPublic)
def create_lot(session: SessionDep, lot_in: LotCreate) -> LotPublic:
    """Manually register a lot with optional initial stock."""
    return inventory_service.create_lot_with_initial_stock(session=session, data=lot_in)


@router.get("/movements", response_model=StockMovementsPublic)
def read_stock_movements(
    session: SessionDep,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> StockMovementsPublic:
    """List stock movement ledger (audit trail of all IN, OUT, and ADJUSTMENT entries)."""
    items, count = inventory_service.list_stock_movements(
        session=session,
        product_id=product_id,
        skip=skip,
        limit=limit,
    )
    return StockMovementsPublic(data=items, count=count)


@router.post("/movements", response_model=StockMovementPublic)
def record_stock_movement(
    session: SessionDep, movement_in: StockMovementCreate
) -> StockMovementPublic:
    """
    Record a manual stock consumption (OUT) or adjustment (Phase C).
    Enforces that stock on hand can never drop below zero!
    """
    return inventory_service.record_manual_stock_movement(
        session=session, data=movement_in
    )


@router.get("/alerts/low-stock")
def get_low_stock_alerts(session: SessionDep) -> list[dict[str, object]]:
    """Retrieve products at or below their minimum stock threshold."""
    return inventory_service.get_low_stock_alerts(session=session)


@router.get("/alerts/expiring-lots", response_model=list[LotPublic])
def get_expiring_lots(
    session: SessionDep,
    days: Annotated[int | None, Query(ge=1, le=365)] = None,
) -> list[LotPublic]:
    """Retrieve active lots expiring within N days."""
    settings = session.get(CompanySettings, 1)
    threshold = (
        days
        if days is not None
        else (settings.default_expiry_alert_days if settings else 60)
    )
    return inventory_service.get_expiring_lots(session=session, days=threshold)


@router.get("/export/stock-csv")
def export_stock_csv(session: SessionDep) -> StreamingResponse:
    """Export current stock on hand and minimum threshold status to CSV."""
    return inventory_service.export_stock_status_csv(session=session)
