import sys

import pytest
from fastapi.testclient import TestClient

import reset_admin
from app.core.config import settings
from app.models import CompanySettings, Payslip
from app.pdf_generator import generate_payslip_pdf


def test_pdf_generator_minimal_and_long_notes() -> None:
    company = CompanySettings(
        id=1,
        company_name="EL-AMEL LAB",
        currency="DZD",
        working_days_per_month=22,
    )
    payslip = Payslip(
        employee_id="00000000-0000-0000-0000-000000000001",
        month=12,
        year=2026,
        base_salary=50000.0,
        performance_bonus=0.0,
        other_allowances=0.0,
        overtime_pay=0.0,
        absence_days=0.0,
        absence_deduction=0.0,
        other_deductions=0.0,
        gross_salary=50000.0,
        net_salary=50000.0,
        worked_days=22.0,
        vacation_days_taken=0,
        payment_method="bank_transfer",
        status="draft",
        notes="Observation très longue avec caractères spéciaux : àéèêîôùç — Prime exceptionnelle à prévoir pour le trimestre prochain.",
        employee_name="Sonia Aït-Kaci",
        employee_code="EMP-099",
        job_title="Biologiste",
        department="Laboratoire",
        social_security_number=None,
    )
    pdf_bytes = generate_payslip_pdf(payslip=payslip, company=company)
    assert pdf_bytes[:4] == b"%PDF"
    assert len(pdf_bytes) > 5000


def test_payslip_net_salary_clamped_to_zero(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    emp = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Test Clamp",
            "job_title": "Assistant",
            "department": "Lab",
            "hire_date": "2026-01-01",
            "base_salary": 20000.0,
        },
        headers=auth_headers,
    ).json()

    ps = client.post(
        f"{settings.API_V1_STR}/payslips/generate-draft",
        json={"employee_id": emp["id"], "month": 9, "year": 2026},
        headers=auth_headers,
    ).json()

    # Enter huge deduction -> net_salary must clamp to 0.0, not negative
    upd = client.put(
        f"{settings.API_V1_STR}/payslips/{ps['id']}",
        json={"other_deductions": 50000.0},
        headers=auth_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["net_salary"] == 0.0


def test_reset_admin_cli(
    test_engine, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Patch engine inside reset_admin to use isolated test DB
    monkeypatch.setattr(reset_admin, "engine", test_engine)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "reset_admin.py",
            "--email",
            settings.ADMIN_EMAIL,
            "--password",
            "CliResetPass99",
        ],
    )
    reset_admin.main()

    login = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": settings.ADMIN_EMAIL, "password": "CliResetPass99"},
    )
    assert login.status_code == 200
