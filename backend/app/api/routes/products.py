import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Message,
    Product,
    ProductCategory,
    ProductCreate,
    ProductPriceHistoryItem,
    ProductPublic,
    ProductsPublic,
    ProductUpdate,
)
from app.services import inventory as inventory_service

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=ProductsPublic)
def read_products(
    session: SessionDep,
    category: Annotated[ProductCategory | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    active_only: Annotated[bool, Query()] = True,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ProductsPublic:
    """List products with search, category filtering, and derived stock levels."""
    items, count = inventory_service.list_products(
        session=session,
        category=category,
        search=search,
        active_only=active_only,
        skip=skip,
        limit=limit,
    )
    return ProductsPublic(data=items, count=count)


@router.post("/", response_model=ProductPublic)
def create_product(session: SessionDep, product_in: ProductCreate) -> ProductPublic:
    """Add a new product (reagent, consumable, or general lab supply)."""
    product = inventory_service.create_product(session=session, data=product_in)
    stock = inventory_service.get_product_stock_on_hand(session, product.id)
    return ProductPublic(
        id=product.id,
        name=product.name,
        reference_code=product.reference_code,
        category=product.category,
        unit=product.unit,
        usual_supplier_id=product.usual_supplier_id,
        usual_supplier_name=product.usual_supplier.name
        if product.usual_supplier
        else None,
        track_lots=product.track_lots,
        min_stock=product.min_stock,
        storage_location=product.storage_location,
        notes=product.notes,
        is_active=product.is_active,
        current_stock=stock,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("/{product_id}", response_model=ProductPublic)
def get_product(session: SessionDep, product_id: uuid.UUID) -> ProductPublic:
    """Get single product details with current derived stock."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    stock = inventory_service.get_product_stock_on_hand(session, product.id)
    return ProductPublic(
        id=product.id,
        name=product.name,
        reference_code=product.reference_code,
        category=product.category,
        unit=product.unit,
        usual_supplier_id=product.usual_supplier_id,
        usual_supplier_name=product.usual_supplier.name
        if product.usual_supplier
        else None,
        track_lots=product.track_lots,
        min_stock=product.min_stock,
        storage_location=product.storage_location,
        notes=product.notes,
        is_active=product.is_active,
        current_stock=stock,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.patch("/{product_id}", response_model=ProductPublic)
def update_product(
    session: SessionDep, product_id: uuid.UUID, product_in: ProductUpdate
) -> ProductPublic:
    """Update product information."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    updated = inventory_service.update_product(
        session=session, product=product, data=product_in
    )
    stock = inventory_service.get_product_stock_on_hand(session, updated.id)
    return ProductPublic(
        id=updated.id,
        name=updated.name,
        reference_code=updated.reference_code,
        category=updated.category,
        unit=updated.unit,
        usual_supplier_id=updated.usual_supplier_id,
        usual_supplier_name=updated.usual_supplier.name
        if updated.usual_supplier
        else None,
        track_lots=updated.track_lots,
        min_stock=updated.min_stock,
        storage_location=updated.storage_location,
        notes=updated.notes,
        is_active=updated.is_active,
        current_stock=stock,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.delete("/{product_id}", response_model=Message)
def delete_product(session: SessionDep, product_id: uuid.UUID) -> Message:
    """Soft-delete a product to preserve movement and invoice history."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    inventory_service.soft_delete_product(session=session, product=product)
    return Message(message="Product archived successfully.")


@router.get("/{product_id}/price-history", response_model=list[ProductPriceHistoryItem])
def get_product_price_history(
    session: SessionDep, product_id: uuid.UUID
) -> list[ProductPriceHistoryItem]:
    """Retrieve chronological purchase history across all suppliers for a product."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    return inventory_service.get_product_price_history(
        session=session, product_id=product_id
    )
