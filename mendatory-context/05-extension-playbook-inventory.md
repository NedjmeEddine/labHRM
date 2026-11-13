# Extension Playbook: Lab Inventory Management

> **Purpose:** Step-by-step developer and AI agent guide for implementing Phase 2 (Lab Inventory Management) without architectural drift or breaking existing HR functionality.

---

## 1. Inventory Domain Scope & Requirements

EL-AMEL LAB requires an embedded inventory management module to monitor reagents, consumables, and laboratory supplies:
1. **Suppliers Directory:** Supplier name, contact person, phone, email, address, and notes.
2. **Reagents & Consumables Catalog:** Product name, reference code (SKU/barcode), category (e.g. Hematology, Biochemistry, Microbiology, General), unit of measure (e.g. Box, Kit, Vial, Liter), minimum stock threshold, and physical storage location (e.g. Fridge A, Shelf 2).
3. **Product Lots & Expiration Tracking:** Lot/Batch number, linked reagent, expiration date, initial quantity, remaining quantity, and status (`active`, `near_expiry`, `expired`, `exhausted`).
4. **Stock Movements (Audit Log):** Type (`in`, `out`, `adjustment`, `expired`), quantity, lot reference, date, reason/notes.
5. **Dashboard Alerts:** Reagents at or below minimum threshold, and lots expiring within 30/60 days.

---

## 2. Architectural Extension Blueprint

Follow the established patterns of the refactored codebase:

```text
Backend:
backend/app/models.py             ──► Add Inventory StrEnums & SQLModel Tables
backend/app/core/db.py            ──► Register tables & idempotent unique indexes
backend/app/services/inventory.py ──► Domain logic, lot deduction, threshold checks
backend/app/services/csv_export.py──► Reuse build_csv_streaming_response for stock/expiry exports
backend/app/api/routes/inventory.py─► Thin route handlers
backend/app/api/main.py           ──► Include inventory router

Frontend:
frontend/src/lib/api/inventory.ts ──► Typed Axios methods (using lib/api/client.ts)
frontend/src/lib/query-keys.ts    ──► Add inventory query keys
frontend/src/features/inventory/  ──► Catalog table, lot cards, movement dialogs
frontend/src/components/Common/   ──► REUSE DataTable.tsx (@tanstack/react-table)
frontend/src/hooks/               ──► REUSE useCopyToClipboard.ts (for Lot/SKU codes)
frontend/src/routes/_layout/      ──► inventory.tsx route
frontend/src/components/Sidebar/  ──► Add Inventory navigation item in AppSidebar.tsx
```

---

## 3. Backend Implementation Recipe

### Step 1: Declare Models & Enums (`backend/app/models.py`)

Add typed enums using `sa_type=String(30)`:
```python
class MovementType(StrEnum):
    STOCK_IN = "in"
    STOCK_OUT = "out"
    ADJUSTMENT = "adjustment"
    EXPIRED = "expired"

class LotStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    EXHAUSTED = "exhausted"

class Supplier(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=get_datetime_utc)

class ReagentItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sku: str = Field(unique=True, index=True, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="Biologie", max_length=100)
    unit: str = Field(default="Boîte", max_length=50)
    min_threshold: float = Field(default=5.0, ge=0)
    storage_location: str | None = Field(default=None, max_length=150)
    current_stock: float = Field(default=0.0, ge=0)
    supplier_id: uuid.UUID | None = Field(default=None, foreign_key="supplier.id", ondelete="SET NULL")
    created_at: datetime = Field(default_factory=get_datetime_utc)

class ReagentLot(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("reagent_id", "lot_number", name="uq_reagent_lot_number"),
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reagent_id: uuid.UUID = Field(foreign_key="reagentitem.id", ondelete="CASCADE")
    lot_number: str = Field(max_length=64)
    expiration_date: DateType
    initial_quantity: float = Field(ge=0)
    remaining_quantity: float = Field(ge=0)
    status: LotStatus = Field(default=LotStatus.ACTIVE, sa_type=String(30))
    created_at: datetime = Field(default_factory=get_datetime_utc)

class StockMovement(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reagent_id: uuid.UUID = Field(foreign_key="reagentitem.id", ondelete="CASCADE")
    lot_id: uuid.UUID | None = Field(default=None, foreign_key="reagentlot.id", ondelete="SET NULL")
    movement_type: MovementType = Field(sa_type=String(30))
    quantity: float = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=get_datetime_utc)
```

### Step 2: Register Idempotent SQLite Unique Index in `backend/app/core/db.py`
Add to `_ensure_sqlite_unique_indexes`:
```python
"CREATE UNIQUE INDEX IF NOT EXISTS uq_reagent_lot_number_idx ON reagentlot (reagent_id, lot_number)"
```

### Step 3: Implement `backend/app/services/inventory.py`
Use explicit static imports:
1. `record_stock_movement(session, reagent_id, lot_id, movement_type, quantity, notes)`:
   * Adjusts `lot.remaining_quantity` and updates `lot.status` to `EXHAUSTED` if zero.
   * Recalculates and updates `reagent.current_stock`.
   * Creates and commits `StockMovement`.
2. `get_low_stock_alerts(session)`: Returns reagents where `current_stock <= min_threshold`.
3. `get_expiring_lots(session, days=30)`: Queries active lots where `expiration_date <= today + timedelta(days=days)`.
4. `export_inventory_csv(session)`: Reuses `services.csv_export.build_csv_streaming_response` to stream stock ledgers.

---

## 4. Frontend Implementation Recipe

### Step 1: Add `src/lib/api/inventory.ts`
Reuse the shared Axios client:
```typescript
import { api, downloadAuthenticatedFile } from "@/lib/api/client"

export const inventoryApi = {
  listReagents: (params?: { category?: string; low_stock?: boolean }) =>
    api.get("/api/v1/inventory/reagents", { params }).then(r => r.data),
  createMovement: (data: StockMovementCreate) =>
    api.post("/api/v1/inventory/movements", data).then(r => r.data),
  exportStockCsv: () =>
    downloadAuthenticatedFile("/api/v1/inventory/export/csv", "stock_el_amel_lab.csv"),
}
```

### Step 2: Add Query Keys in `src/lib/query-keys.ts`
```typescript
inventory: {
  all: ["inventory"] as const,
  reagents: (filters?: object) => ["inventory-reagents", filters ?? "all"] as const,
  lots: (reagentId: string) => ["inventory-lots", reagentId] as const,
  alerts: ["inventory-alerts"] as const,
}
```

### Step 3: Reuse Existing Pre-Preserved Components
1. **`src/components/Common/DataTable.tsx`:** Use the generic, sortable, paginated `@tanstack/react-table` component (which is already bilingual and localized) to render reagent catalogs, lot tables, and movement audit logs.
2. **`src/hooks/useCopyToClipboard.ts`:** Attach a copy button to SKU and lot numbers on the reagent details screen:
   ```tsx
   const [copied, copy] = useCopyToClipboard()
   <Button variant="ghost" size="icon" onClick={() => copy(lot.lot_number)}>
     <Copy className="h-4 w-4" />
   </Button>
   ```
3. **`src/components/Common/ConfirmDeleteDialog.tsx`:** Attach to reagent and supplier deletions.
4. **`src/lib/i18n.tsx`:** Add inventory translation keys (`navInventory`, `reagents`, `stockLevel`, `lotNumber`, `expiryDate`, `lowStock`, etc.) for French and English.

---

## 5. Non-Regression Checklist

When introducing the inventory module:
* Run `cd backend && uv run pytest -v` — all 17 existing HR tests must continue to pass.
* Run `cd frontend && bun run test` — both Playwright browser tests must remain green.
* Verify that `backend/app/services/__init__.py` explicitly exports the new `inventory` service.
* Verify that date inputs inside `src/features/inventory/` use `formatLocalDate()` from `src/lib/date.ts` instead of `.toISOString()`.
