from datetime import date

from fastapi.testclient import TestClient

from app.core.config import settings


def test_performance_batch_payroll_editable_pdf_and_dashboard(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # 1. Create active employee (salary 44,000 -> daily rate 2,000 DZD)
    e_act = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Élodie Chérif",
            "job_title": "Responsable Qualité",
            "department": "Contrôle Qualité",
            "hire_date": "2024-01-10",
            "base_salary": 44000.0,
            "social_security_number": "92 5544 3322 11",
        },
        headers=auth_headers,
    ).json()
    emp_id = e_act["id"]

    # Create a terminated employee (should be excluded from batch payroll)
    client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Ancien Employé",
            "job_title": "Assistant",
            "department": "Lab",
            "hire_date": "2022-01-01",
            "base_salary": 35000.0,
            "status": "terminated",
        },
        headers=auth_headers,
    )

    # 2. Mark 1.5 days unpaid absence in Oct 2026 (fixed deterministic month)
    client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-10-04",
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-10-05",
            "absence_type": "half_day",
            "is_paid": False,
        },
        headers=auth_headers,
    )

    # 3. Add a 2-day unpaid vacation in Oct 2026 + 3-day paid annual vacation
    client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-10-10",
            "end_date": "2026-10-11",
            "vacation_type": "unpaid",
            "status": "approved",
        },
        headers=auth_headers,
    )
    client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-10-16",
            "end_date": "2026-10-18",
            "vacation_type": "annual",
            "status": "approved",
        },
        headers=auth_headers,
    )

    # 4. Performance review in Oct 2026: +5000 bonus & raise base salary to 66,000 DZD (daily rate = 3,000 DZD)
    perf_res = client.post(
        f"{settings.API_V1_STR}/performance/",
        json={
            "employee_id": emp_id,
            "period_month": 10,
            "period_year": 2026,
            "score": 5,
            "bonus_amount": 5000.0,
            "new_base_salary": 66000.0,
            "notes": "Maîtrise exceptionnelle des procédures",
        },
        headers=auth_headers,
    )
    assert perf_res.status_code == 200

    # Verify salary history has 2 records
    hist = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/salary-history",
        headers=auth_headers,
    )
    assert len(hist.json()) == 2
    assert hist.json()[0]["new_salary"] == 66000.0

    # 5. Batch generate payslips for Oct 2026
    batch = client.post(
        f"{settings.API_V1_STR}/payslips/generate-batch",
        json={"month": 10, "year": 2026},
        headers=auth_headers,
    )
    assert batch.status_code == 200
    assert batch.json()["count"] == 1
    ps = batch.json()["data"][0]
    ps_id = ps["id"]

    # Math verification:
    # base_salary = 66000, daily_rate = 66000 / 22 = 3000
    # unpaid days: 1.5 (absences) + 2.0 (unpaid vac) = 3.5 days -> deduction = 10500
    assert ps["base_salary"] == 66000.0
    assert ps["performance_bonus"] == 5000.0
    assert ps["vacation_days_taken"] == 5
    assert ps["absence_days"] == 3.5
    assert ps["absence_deduction"] == 10500.0
    assert ps["gross_salary"] == 71000.0
    assert ps["net_salary"] == 60500.0

    # 6. Edit payslip manually (add transport allowance +3000, overtime +2000, advance deduction 1500)
    upd = client.put(
        f"{settings.API_V1_STR}/payslips/{ps_id}",
        json={
            "other_allowances": 3000.0,
            "overtime_pay": 2000.0,
            "other_deductions": 1500.0,
            "payment_method": "cash",
            "status": "paid",
            "notes": "Indemnité de panier & transport incluse — Payé à l'heure.",
        },
        headers=auth_headers,
    )
    assert upd.status_code == 200
    updated_ps = upd.json()
    assert updated_ps["gross_salary"] == 76000.0  # 66000 + 5000 + 3000 + 2000
    assert updated_ps["net_salary"] == 64000.0  # 76000 - 10500 - 1500
    assert updated_ps["status"] == "paid"

    # Re-running batch should NOT overwrite admin's edited/paid payslip
    batch_again = client.post(
        f"{settings.API_V1_STR}/payslips/generate-batch",
        json={"month": 10, "year": 2026},
        headers=auth_headers,
    )
    assert batch_again.json()["data"][0]["status"] == "paid"
    assert batch_again.json()["data"][0]["other_allowances"] == 3000.0

    # 7. Download French PDF with UTF-8 accents
    pdf = client.get(
        f"{settings.API_V1_STR}/payslips/{ps_id}/pdf", headers=auth_headers
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert "bulletin_paie_EMP-001_10_2026.pdf" in pdf.headers["content-disposition"]
    assert pdf.content[:4] == b"%PDF"
    assert len(pdf.content) > 5000

    # 8. Payroll CSV Export
    csv_res = client.get(
        f"{settings.API_V1_STR}/payslips/export/csv?month=10&year=2026",
        headers=auth_headers,
    )
    assert csv_res.status_code == 200
    csv_text = csv_res.content.decode("utf-8-sig")
    assert "Élodie Chérif" in csv_text
    assert "64000.00" in csv_text

    # 9. Mark absence today & verify Dashboard summary
    today_str = date.today().isoformat()
    client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": today_str,
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    dash = client.get(f"{settings.API_V1_STR}/dashboard/", headers=auth_headers)
    assert dash.status_code == 200
    d_json = dash.json()
    assert d_json["active_employees"] == 1
    assert d_json["total_employees"] == 2
    assert d_json["absent_today_count"] == 1
    assert "Élodie Chérif" in d_json["absent_today_names"]
    assert d_json["currency"] == "DZD"
