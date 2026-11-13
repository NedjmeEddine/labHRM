# Inventory & Suppliers Module: Agent Instructions

Read this whole file before writing code. Follow it over any default habit.

## 1. Context

- Management app for a single medical laboratory. The owner is francophone.
- The **HR module is finished**. You are now building **suppliers + inventory**.
- Runs **locally on the owner's Windows PC, fully offline**, used by **one admin user** (not by employees).
- Stack: **FastAPI + SQLite**, React frontend built to static files and served by FastAPI, packaged later with PyInstaller (`--onedir`).
- The owner mainly cares about **tracking suppliers**: what he bought, when, with which taxes, what he paid, what he still owes.
- The owner is unavailable, so build everything below, but ship it in layers (see section 5).

## 2. Hard constraints (never violate)

1. **No internet at runtime.** No CDN links, no remote fonts or icons, no external API calls, no analytics. Disable `/docs` and `/redoc` in production (`docs_url=None, redoc_url=None`).
2. **SQLite only.** No PostgreSQL-specific types (UUID columns, arrays, native enums, JSONB). Remove or replace any that exist.
3. **Money is never float.** Use `Decimal` (or integer centimes). Store the TVA rate on each invoice line.
4. **Stock on hand is derived**, always computed as the sum of stock movements. Never keep an editable `quantity` field on products or lots.
5. **Never hard-delete** invoices, payments, lots, or movements. Cancel or soft-delete them. Every table has `created_at` and `updated_at`.
6. **Audit trail** for anything touching money or stock: who, when, what changed (old and new value).
7. **Bind the server to `127.0.0.1` only.**
8. **French UI.** All user-facing strings go through a translation file (French now, Arabic possible later). Dates `DD/MM/YYYY`, currency `DA`.
9. **Do not break the HR module.** Only touch shared code (db session, auth, utils) when necessary, and keep the change minimal.

## 3. Step 0: audit the leftover code first

The codebase already contains **unused models and code** for reagents, consumables, lot numbers, expiration dates, suppliers and stock movements. Before changing anything:

1. Read all of it.
2. Write `docs/inventory-audit.md` listing: what exists, what is reusable, and every violation of section 2 (mutable quantity fields, float money, Postgres-only types, hard deletes, etc.).
3. Decide per model: **keep, modify, or drop**. Prefer keeping and fixing over rewriting.
4. Then continue with Phase A. Do not wait for approval unless something is genuinely ambiguous.

## 4. Target data model

Adapt existing models to this shape rather than duplicating them.

- **Supplier**: name, phone, address, contact person, NIF, NIS, RC, payment terms (free text), notes, is_active.
- **Product**: name, unit (box, bottle, piece...), category (`reagent` | `consumable` | `other`), usual_supplier (optional), `track_lots` (bool: reagents usually true), min_stock (optional), is_active.
- **PurchaseInvoice**: supplier, supplier_invoice_number, invoice_date, due_date, total_excl_tax, total_tva, total_incl_tax, supplier_stated_total (optional, entered by the owner), status (`draft` | `confirmed` | `cancelled`), scan_file_path (optional), notes. Payment status (`unpaid` | `partial` | `paid`) is **computed** from payments, never stored as an editable flag.
- **InvoiceLine**: invoice, product, quantity, unit_price_excl_tax, tva_rate (19, 9 or 0), computed line totals. Optional discount per line.
- **Payment**: invoice, date, amount, method (`cash` | `cheque` | `transfer`), reference.
- **CreditNote**: modeled as a negative invoice linked to the original invoice (returns, damaged or expired goods).
- **Lot** (Phase B): product, supplier, lot_number, expiry_date, received_date, source invoice line.
- **StockMovement** (Phase B): product, lot (nullable if not tracked by lot), type (`IN` | `OUT` | `ADJUSTMENT`), quantity (signed), date, reason, source (invoice line, manual entry, or cancellation).
- **AppSetting**: key/value store for feature toggles and thresholds.
- **AuditLog**: entity, entity_id, action, old/new values (JSON text), timestamp.

## 5. Phases and feature toggles

### Phase A: suppliers and purchases (ON by default)
- CRUD for suppliers and products. Adding a product must be possible in one click from the invoice screen.
- Purchase invoice entry with lines. Totals are computed from lines.
- If the owner enters the supplier's stated total and it differs from the computed one, **show a warning, never block**.
- Payments against invoices, partial payments allowed. Warn (do not block) if a payment exceeds the balance.
- Supplier page: balance owed, all invoices, all payments.
- Dashboard: total owed, invoices due in the next 7 days, spending per month and per supplier.
- Attach a scan or photo of the paper invoice (stored in a local folder).
- Credit notes.
- Price history per product and supplier (query over invoice lines).

### Phase B: lots and stock (OFF by default, toggle `inventory_tracking_enabled`)
- When enabled, confirming an invoice offers a "receive goods" step: enter lot number and expiry date per line (for products with `track_lots`), then create the Lot and an `IN` movement **in one transaction**.
- Current stock per product (and per lot), computed from movements.
- Alerts: low stock (vs `min_stock`) and lots expiring within N days (setting, default 60).
- Cancelling an invoice that created movements creates reversing `ADJUSTMENT` movements. It does not delete them.
- A movement must never push a lot's quantity below zero.

### Phase C: extras (OFF by default, toggle `manual_stock_out_enabled`)
- Manual stock-out entries (`OUT`) with a required reason, for example "routine use" or "expired".
- Manual stock adjustments with a required reason.
- **Do not build any link to lab tests or results.** That module does not exist.

The settings page lets the admin switch B and C on and off. Hidden features must not appear in navigation, dashboards, or exports.

## 6. Business rules

- TVA rates: 19%, 9%, 0%. Keep the list configurable in settings.
- Round at line level, then sum. Document the rounding rule in code comments and test it.
- An invoice in `confirmed` status can only be changed through logged edits. Cancelled invoices stay visible, shown as cancelled.
- Search and filter everywhere: by supplier, by date range, by status.
- Supplier balance = sum of confirmed invoice totals minus credit notes minus payments.

## 7. Exports

Using pandas/openpyxl for Excel and ReportLab for PDF:
- Supplier statement (all invoices and payments, running balance)
- Invoices by date range
- Monthly TVA summary (TVA on purchases)
- Stock status and expiring lots (only if Phase B is enabled)

All exports in French, with `DD/MM/YYYY` dates and `DA` amounts.

## 8. Assumptions (the owner has not confirmed these)

Keep them in `docs/assumptions.md` and **append any new assumption you make**:

1. Payments are recorded per invoice, not as lump sums per supplier account.
2. TVA rates are only 19%, 9% and 0%.
3. Goods are received and invoiced together (no separate delivery notes).
4. Lot numbers and expiry dates matter for reagents, not for consumables like gloves.
5. Credit notes are rare and entered manually.
6. A single admin user. Keep a simple login or PIN, but no roles.

## 9. Testing

- `pytest` unit tests for: money and TVA math, rounding, balance computation, payment status, stock derived from movements, lot creation on receiving, invoice cancellation reversal, and "never below zero".
- A seed script with realistic demo data (French supplier and product names) for manual testing.
- **Offline test:** run with the network disabled, click through every screen, and confirm the browser makes no non-localhost requests.
- Test on SQLite from a fresh database and from the existing HR database (migrations must not touch HR data).

## 10. Order of work

1. Step 0 audit, then clean up models.
2. Phase A end to end (backend, UI, exports, tests).
3. Phase B behind its toggle.
4. Phase C behind its toggle.
5. Settings page, backup button (copy the SQLite file to a chosen folder), "export logs" button, visible version number.
6. Final offline pass.

Commit after each phase with a clear message.

## 11. Do not

- Add features beyond this file.
- Rewrite the HR module or the auth system.
- Introduce a new database, ORM, or frontend framework.
- Add Docker, Node runtime services, or any cloud dependency.
- Leave dead code. Delete leftovers that you decided to drop.
- Block the user with hard validation where a warning is enough.

## 12. Definition of done

- Phase A works end to end with real exports.
- B and C are complete but invisible until toggled on.
- All tests pass, the offline test passes, and `docs/inventory-audit.md` and `docs/assumptions.md` are up to date.
- A short `docs/inventory-demo.md` explains how to demo Phase A to the owner in five minutes.
