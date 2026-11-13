from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    CompanySettings,
    InvoicePaymentStatus,
    InvoiceStatus,
    MovementType,
    PaymentMethod,
    ProductCategory,
)


def test_supplier_crud_and_balance_ledger(
    client: TestClient, auth_headers: dict[str, str], session: Session
) -> None:
    # 1. Create Supplier
    supplier_payload = {
        "name": "Bio-Maghreb Diagnostics",
        "contact_person": "Karim Amrani",
        "phone": "0550123456",
        "email": "contact@biomaghreb.dz",
        "address": "Route de l'Aéroport, Alger",
        "tax_id": "099812345678901",  # NIF
        "statistical_id": "0098123456789",  # NIS
        "trade_registry": "16/00-1234567B18",  # RC
        "payment_terms": "30 jours fin de mois",
        "notes": "Fournisseur principal de réactifs hématologie",
    }
    r = client.post(
        "/api/v1/suppliers/",
        headers=auth_headers,
        json=supplier_payload,
    )
    assert r.status_code == 200, r.text
    supplier_data = r.json()
    supplier_id = supplier_data["id"]
    assert supplier_data["name"] == "Bio-Maghreb Diagnostics"
    assert supplier_data["balance_owed"] == "0.00"

    # 2. Reject duplicate supplier name
    r_dup = client.post(
        "/api/v1/suppliers/",
        headers=auth_headers,
        json={"name": "bio-maghreb diagnostics"},
    )
    assert r_dup.status_code == 400

    # 3. Create Product
    product_payload = {
        "name": "Diluant d'Hématologie 20L",
        "reference_code": "DIL-HEM-20L",
        "category": ProductCategory.REAGENT.value,
        "unit": "bidon",
        "usual_supplier_id": supplier_id,
        "track_lots": True,
        "min_stock": "5.00",
        "storage_location": "Réserve A, Étagère 1",
    }
    r_prod = client.post(
        "/api/v1/products/",
        headers=auth_headers,
        json=product_payload,
    )
    assert r_prod.status_code == 200, r_prod.text
    prod_id = r_prod.json()["id"]

    # 4. Create Purchase Invoice with Lines and Decimal TVA (19%)
    # 10 units @ 4 500.00 DZD HT = 45 000.00 HT
    # TVA 19% = 8 550.00 DZD
    # Total TTC = 53 550.00 DZD
    invoice_payload = {
        "supplier_id": supplier_id,
        "invoice_number": "FAC-2026-0042",
        "invoice_date": "2026-11-01",
        "due_date": "2026-12-01",
        "supplier_stated_total": "53550.00",
        "status": InvoiceStatus.CONFIRMED.value,
        "lines": [
            {
                "product_id": prod_id,
                "quantity": "10.00",
                "unit_price_excl_tax": "4500.00",
                "tva_rate": "19.00",
                "discount_amount": "0.00",
            }
        ],
    }
    r_inv = client.post(
        "/api/v1/invoices/",
        headers=auth_headers,
        json=invoice_payload,
    )
    assert r_inv.status_code == 200, r_inv.text
    inv_data = r_inv.json()
    inv_id = inv_data["id"]
    assert inv_data["total_excl_tax"] == "45000.00"
    assert inv_data["total_tva"] == "8550.00"
    assert inv_data["total_incl_tax"] == "53550.00"
    assert inv_data["payment_status"] == InvoicePaymentStatus.UNPAID.value
    assert inv_data["warning_total_mismatch"] is False

    # Check Supplier Detail Ledger: balance owed should be 53 550.00
    r_supp_detail = client.get(
        f"/api/v1/suppliers/{supplier_id}",
        headers=auth_headers,
    )
    assert r_supp_detail.status_code == 200
    supp_detail = r_supp_detail.json()
    assert supp_detail["total_invoiced"] == "53550.00"
    assert supp_detail["total_paid"] == "0.00"
    assert supp_detail["balance_owed"] == "53550.00"

    # 5. Partial Payment (20 000.00 DZD)
    payment_payload = {
        "invoice_id": inv_id,
        "supplier_id": supplier_id,
        "payment_date": "2026-11-05",
        "amount": "20000.00",
        "payment_method": PaymentMethod.CHECK.value,
        "reference": "CHQ-887412",
        "notes": "Acompte par chèque BNA",
    }
    r_pay = client.post(
        f"/api/v1/invoices/{inv_id}/payments",
        headers=auth_headers,
        json=payment_payload,
    )
    assert r_pay.status_code == 200, r_pay.text

    # Re-check invoice payment status: should now be PARTIAL with remaining 33 550.00
    r_inv_check = client.get(
        f"/api/v1/invoices/{inv_id}",
        headers=auth_headers,
    )
    assert r_inv_check.status_code == 200
    assert r_inv_check.json()["payment_status"] == InvoicePaymentStatus.PARTIAL.value
    assert r_inv_check.json()["amount_paid"] == "20000.00"
    assert r_inv_check.json()["balance_remaining"] == "33550.00"

    # 6. Complete Payment (33 550.00 DZD)
    client.post(
        f"/api/v1/invoices/{inv_id}/payments",
        headers=auth_headers,
        json={
            "invoice_id": inv_id,
            "supplier_id": supplier_id,
            "payment_date": "2026-11-10",
            "amount": "33550.00",
            "payment_method": PaymentMethod.BANK_TRANSFER.value,
            "reference": "VIR-2026-110",
        },
    )

    r_inv_paid = client.get(
        f"/api/v1/invoices/{inv_id}",
        headers=auth_headers,
    )
    assert r_inv_paid.json()["payment_status"] == InvoicePaymentStatus.PAID.value
    assert r_inv_paid.json()["balance_remaining"] == "0.00"

    # 7. Check Supplier Statement PDF & CSV
    r_pdf = client.get(
        f"/api/v1/suppliers/{supplier_id}/statement/pdf",
        headers=auth_headers,
    )
    assert r_pdf.status_code == 200
    assert r_pdf.headers["content-type"] == "application/pdf"
    assert r_pdf.content.startswith(b"%PDF")

    r_csv = client.get(
        f"/api/v1/suppliers/{supplier_id}/statement/csv",
        headers=auth_headers,
    )
    assert r_csv.status_code == 200
    assert r_csv.content.startswith(b"\xef\xbb\xbf")
    assert b"Bio-Maghreb" in r_csv.headers["content-disposition"].encode()

    # 8. Check Price History for Product
    r_hist = client.get(
        f"/api/v1/products/{prod_id}/price-history",
        headers=auth_headers,
    )
    assert r_hist.status_code == 200
    hist_data = r_hist.json()
    assert len(hist_data) == 1
    assert hist_data[0]["unit_price_excl_tax"] == "4500.00"


def test_stated_total_mismatch_and_credit_note(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # Create supplier
    r_s = client.post(
        "/api/v1/suppliers/",
        headers=auth_headers,
        json={"name": "Reagents Plus Algerie"},
    )
    supp_id = r_s.json()["id"]

    # Create product
    r_p = client.post(
        "/api/v1/products/",
        headers=auth_headers,
        json={
            "name": "Plaques Microtitrage 96 puits",
            "category": ProductCategory.CONSUMABLE.value,
            "unit": "boîte",
        },
    )
    prod_id = r_p.json()["id"]

    # Invoice with stated total mismatch:
    # 2 units @ 10 000.00 HT, 9% TVA = 20 000.00 HT + 1 800.00 TVA = 21 800.00 TTC
    # Owner enters stated total: 22 500.00 TTC (warning should be flagged, not blocking!)
    inv_payload = {
        "supplier_id": supp_id,
        "invoice_number": "FAC-WARN-001",
        "invoice_date": "2026-11-05",
        "supplier_stated_total": "22500.00",
        "status": InvoiceStatus.CONFIRMED.value,
        "lines": [
            {
                "product_id": prod_id,
                "quantity": "2.00",
                "unit_price_excl_tax": "10000.00",
                "tva_rate": "9.00",
            }
        ],
    }
    r = client.post(
        "/api/v1/invoices/",
        headers=auth_headers,
        json=inv_payload,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["warning_total_mismatch"] is True
    assert data["stated_difference"] == "700.00"
    assert data["total_incl_tax"] == "21800.00"

    # Add a Credit Note (Avoir) for damaged box: -1 unit @ 10 000.00 HT + 9% = 10 900.00 TTC
    credit_payload = {
        "supplier_id": supp_id,
        "invoice_number": "AVOIR-001",
        "invoice_date": "2026-11-08",
        "is_credit_note": True,
        "parent_invoice_id": data["id"],
        "status": InvoiceStatus.CONFIRMED.value,
        "lines": [
            {
                "product_id": prod_id,
                "quantity": "1.00",
                "unit_price_excl_tax": "10000.00",
                "tva_rate": "9.00",
            }
        ],
    }
    r_cr = client.post(
        "/api/v1/invoices/",
        headers=auth_headers,
        json=credit_payload,
    )
    assert r_cr.status_code == 200
    assert r_cr.json()["is_credit_note"] is True

    # Supplier total balance owed should now be 21 800.00 - 10 900.00 = 10 900.00
    r_supp = client.get(
        f"/api/v1/suppliers/{supp_id}",
        headers=auth_headers,
    )
    assert r_supp.json()["balance_owed"] == "10900.00"


def test_stock_movement_rules_and_never_below_zero(
    client: TestClient, auth_headers: dict[str, str], session: Session
) -> None:
    # Enable inventory tracking
    settings = session.get(CompanySettings, 1)
    if settings:
        settings.inventory_tracking_enabled = True
        session.add(settings)
        session.commit()

    # Create product
    r_p = client.post(
        "/api/v1/products/",
        headers=auth_headers,
        json={
            "name": "Réactif Glucose GOD-PAP",
            "category": ProductCategory.REAGENT.value,
            "unit": "kit",
            "track_lots": True,
            "min_stock": "10.00",
        },
    )
    prod_id = r_p.json()["id"]

    # 1. Register a Lot with initial quantity 15
    lot_payload = {
        "product_id": prod_id,
        "lot_number": "GLU-2026-09",
        "expiration_date": "2027-06-30",
        "received_date": "2026-11-01",
        "initial_quantity": "15.00",
    }
    r_lot = client.post(
        "/api/v1/inventory/lots",
        headers=auth_headers,
        json=lot_payload,
    )
    assert r_lot.status_code == 200
    lot_id = r_lot.json()["id"]
    assert r_lot.json()["current_quantity"] == "15.00"

    # Check product stock on hand: derived to 15.00
    r_prod_check = client.get(
        f"/api/v1/products/{prod_id}",
        headers=auth_headers,
    )
    assert r_prod_check.json()["current_stock"] == "15.00"

    # 2. Record routine consumption (OUT 5 units)
    move_payload = {
        "product_id": prod_id,
        "lot_id": lot_id,
        "movement_type": MovementType.OUT.value,
        "quantity": "5.00",
        "movement_date": "2026-11-10",
        "reason": "Consommation routine paillasse biochimie",
    }
    r_out = client.post(
        "/api/v1/inventory/movements",
        headers=auth_headers,
        json=move_payload,
    )
    assert r_out.status_code == 200
    assert r_out.json()["quantity"] == "-5.00"

    # Check updated lot stock: 15 - 5 = 10.00
    r_lots = client.get(
        f"/api/v1/inventory/lots?product_id={prod_id}",
        headers=auth_headers,
    )
    assert r_lots.json()["data"][0]["current_quantity"] == "10.00"

    # 3. Test "Never Below Zero" constraint:
    # Attempting to deduct 20 units when only 10 are available must fail with HTTP 400!
    r_fail = client.post(
        "/api/v1/inventory/movements",
        headers=auth_headers,
        json={
            "product_id": prod_id,
            "lot_id": lot_id,
            "movement_type": MovementType.OUT.value,
            "quantity": "20.00",
            "movement_date": "2026-11-12",
            "reason": "Tentative de déduction excessive",
        },
    )
    assert r_fail.status_code == 400
    assert "Insufficient stock" in r_fail.json()["detail"]


def test_inventory_dashboard_and_tva_summary(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # Query dashboard
    r_dash = client.get(
        "/api/v1/invoices/dashboard",
        headers=auth_headers,
    )
    assert r_dash.status_code == 200
    data = r_dash.json()
    assert "total_debt_owed" in data
    assert "invoices_due_7_days_count" in data
    assert "monthly_spending" in data
    assert "top_suppliers_spending" in data

    # Query TVA summary
    r_tva = client.get(
        "/api/v1/invoices/tva-summary?year=2026",
        headers=auth_headers,
    )
    assert r_tva.status_code == 200
    tva_items = r_tva.json()
    assert len(tva_items) == 12
