# Inventory & Suppliers Architecture Audit (Step 0)

> **Date:** November 2026  
> **Auditor:** Senior Software Developer  
> **Target:** EL-AMEL LAB Inventory & Suppliers Module

---

## 1. Inventory Code & Models Audit

### Current State of the Codebase
1. **`backend/app/models.py`**:
   - Currently contains clean models for HR: `User`, `CompanySettings`, `Employee`, `Absence`, `Vacation`, `PerformanceReview`, `SalaryHistory`, `Payslip`.
   - Does **not yet contain** active database tables for inventory or suppliers.
2. **`mendatory-context/05-extension-playbook-inventory.md`**:
   - Contains an initial architectural sketch that proposed:
     - `Supplier`
     - `ReagentItem`
     - `ReagentLot`
     - `StockMovement`
3. **Reusable Frontend Primitives**:
   - `frontend/src/components/Common/DataTable.tsx` (`@tanstack/react-table`): fully reusable for sortable, paginated supplier directories, invoice ledgers, and product catalogs.
   - `frontend/src/hooks/useCopyToClipboard.ts`: fully reusable for one-click copying of supplier tax IDs (NIF/NIS), invoice numbers, and SKU codes.
   - `frontend/src/components/Common/ConfirmDeleteDialog.tsx`: reusable for soft-delete/cancellation confirmations.
   - `frontend/src/lib/api/client.ts`: provides authenticated Axios requests and binary file downloading (`downloadAuthenticatedFile`).

---

## 2. Identified Violations of Hard Constraints (Section 2)

Evaluating the proposed models in `05-extension-playbook-inventory.md` against `INVENTORY_AGENT.md`:

| Proposed Element in Initial Sketch | Identified Violation | Correction / Resolution |
|---|---|---|
| `ReagentItem.current_stock: float = 0.0` | **Violation 2.4 & 2.3**: Mutable stock field on product table; uses `float`. | **DROP** mutable column. Stock on hand will be **derived** by summing signed `StockMovement` records. |
| `ReagentLot.remaining_quantity: float` | **Violation 2.4 & 2.3**: Mutable quantity field; uses `float`. | **DROP** mutable column. Lot remaining quantity will be computed from movements. |
| `ReagentItem.min_threshold: float` | **Violation 2.3**: Uses `float` instead of `Decimal`. | **MODIFY** to `Decimal` (`sa_type=Numeric(12, 2)`). |
| `StockMovement.quantity: float` | **Violation 2.3**: Uses `float` instead of `Decimal`. | **MODIFY** to `Decimal` (`sa_type=Numeric(12, 2)`). |
| Foreign key `ondelete="CASCADE"` on stock records | **Violation 2.5**: Hard-deleting parent drops financial and audit history. | **MODIFY** to `RESTRICT` or soft-deletion lifecycle. |
| Missing Invoices, Lines, Payments, Credit Notes | **Violation 4.0**: Missing core supplier financial tracking requirements. | **ADD** `PurchaseInvoice`, `InvoiceLine`, `Payment`, and `AuditLog` models with `Decimal` money and TVA rates. |

---

## 3. Decisions Per Model

1. **`Supplier`**:
   * **Decision:** **Keep and Expand**.
   * Add fields: `contact_name`, `phone`, `email`, `address`, `tax_id` (NIF), `statistical_id` (NIS), `trade_registry` (RC), `payment_terms`, `notes`, `is_active`, `created_at`, `updated_at`.
2. **`Product` (replacing `ReagentItem`)**:
   * **Decision:** **Adopt and Generalize**.
   * Products cover reagents, consumables, and general supplies.
   * Fields: `name`, `reference_code` (SKU), `category` (`reagent`, `consumable`, `equipment`, `other`), `unit` (box, vial, test, piece, liter), `usual_supplier_id`, `track_lots` (bool, default true for reagents), `min_stock` (`Decimal | None`), `is_active`, `created_at`, `updated_at`.
   * **No `current_stock` column.**
3. **`PurchaseInvoice` & `InvoiceLine`**:
   * **Decision:** **New Implementation**.
   * Stored totals: `total_excl_tax`, `total_tva`, `total_incl_tax` (all `Decimal`).
   * Optional `supplier_stated_total` for non-blocking mismatch warnings.
   * Status lifecycle: `draft`, `confirmed`, `cancelled`.
   * Line totals computed from `quantity * unit_price_excl_tax * (1 + tva_rate/100)`.
4. **`Payment`**:
   * **Decision:** **New Implementation**.
   * Linked to `PurchaseInvoice` and `Supplier`.
   * Stored amount: `Decimal`.
   * Payment status of invoice is derived: `paid` if $\sum \text{payments} \ge \text{total\_incl\_tax}$, `partial` if $0 < \sum < \text{total}$, otherwise `unpaid`.
5. **`Lot` (Phase B)**:
   * **Decision:** **Adopt without mutable quantity**.
   * Fields: `product_id`, `lot_number`, `expiration_date`, `received_date`, `source_invoice_line_id`, `is_active`, `created_at`.
6. **`StockMovement` (Phase B & C)**:
   * **Decision:** **Adopt with signed Decimal quantity**.
   * Movement types: `IN`, `OUT`, `ADJUSTMENT`.
   * Quantities: `+` for incoming, `-` for outgoing, `+/-` for adjustment.
7. **`AuditLog`**:
   * **Decision:** **New Implementation**.
   * Records changes to money, invoices, payments, and movements (`entity_type`, `entity_id`, `action`, `old_values`, `new_values`, `timestamp`).
