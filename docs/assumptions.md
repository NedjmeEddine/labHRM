# Inventory & Suppliers Module: Assumptions

> Documenting business and technical assumptions for the EL-AMEL LAB Inventory & Suppliers module.
> Any new assumption made during implementation must be appended here.

1. **Payments are recorded per invoice**, not as untied lump sums per supplier account. If the laboratory owner makes a partial or full payment, it is attributed to a specific purchase invoice, which immediately updates the remaining balance on that invoice and the overall supplier debt.
2. **Standard Algerian TVA rates** are 19%, 9%, and 0% (exempt). The rate is selected per invoice line.
3. **Goods are received and invoiced together** by default for standard laboratory operations (no decoupled delivery note workflow unless Phase B lot receiving is triggered).
4. **Lot numbers and expiration dates matter primarily for reagents and biological controls**, but are optional for general laboratory consumables (e.g. gloves, tubes, tips, cotton). This is controlled by the `track_lots` flag on each product.
5. **Credit notes are modeled as negative invoices** or credit adjustments linked to a supplier and original invoice.
6. **Single admin user**: All inventory, supplier, and financial records are managed exclusively by the authenticated laboratory director.
7. **Offline-safe file uploads**: Scanned copies or photos of paper supplier invoices are stored locally in `backend/data/invoices/` and accessed through authenticated streaming endpoints without any public CDN or cloud storage.
8. **Monetary precision**: All amounts are represented in Algerian Dinars (`DZD` / `DA`) using exact `Decimal` representation with 2 decimal places. Floating-point types are strictly forbidden for currency.
9. **Derived stock**: Current product and lot quantities are always computed by aggregating signed `StockMovement` records ($+IN$, $-OUT$, $\pm ADJUSTMENT$). No mutable stock fields are stored on the product or lot tables.
