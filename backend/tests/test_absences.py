from fastapi.testclient import TestClient

from app.core.config import settings


def _create_emp(
    client: TestClient, auth_headers: dict[str, str], salary: float = 44000.0
) -> str:
    res = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Amine Ziani",
            "job_title": "Préleveur",
            "department": "Prélèvement",
            "hire_date": "2024-02-01",
            "base_salary": salary,
        },
        headers=auth_headers,
    )
    assert res.status_code == 200
    return res.json()["id"]


def test_absences_single_range_and_interval_deduction(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    # Salary 44,000 DZD / 22 working days = 2,000 DZD/day
    emp_id = _create_emp(client, auth_headers, salary=44000.0)

    # Mark 1 unpaid full day
    r1 = client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-03",
            "absence_type": "unjustified",
            "is_paid": False,
            "reason": "Absence injustifiée",
        },
        headers=auth_headers,
    )
    assert r1.status_code == 200

    # Reject duplicate on same date
    dup = client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-03",
            "absence_type": "sick",
            "is_paid": True,
        },
        headers=auth_headers,
    )
    assert dup.status_code == 400

    # Mark 1 half day unpaid
    r2 = client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-04",
            "absence_type": "half_day",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    assert r2.status_code == 200

    # Mark 1 paid sick day (should NOT add to deduction)
    r3 = client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-05",
            "absence_type": "sick",
            "is_paid": True,
            "reason": "Certificat médical",
        },
        headers=auth_headers,
    )
    assert r3.status_code == 200

    # Mark range overlapping Nov 3..6 (Nov 3 already exists -> should skip it and create Nov 6 only if Nov 4-5 exist)
    rng = client.post(
        f"{settings.API_V1_STR}/absences/range",
        json={
            "employee_id": emp_id,
            "start_date": "2026-11-03",
            "end_date": "2026-11-06",
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    assert rng.status_code == 200
    # Nov 3, 4, 5 skipped; Nov 6 created
    assert len(rng.json()) == 1
    assert rng.json()[0]["date"] == "2026-11-06"

    # Query interval Nov 1 - Nov 10
    iv = client.get(
        f"{settings.API_V1_STR}/absences/?employee_id={emp_id}&start_date=2026-11-01&end_date=2026-11-10",
        headers=auth_headers,
    )
    assert iv.status_code == 200
    summary = iv.json()
    assert summary["total_count"] == 4
    # Unpaid: Nov 3 (1.0) + Nov 4 (0.5) + Nov 6 (1.0) = 2.5 days
    assert summary["unpaid_days"] == 2.5
    assert summary["paid_days"] == 1.0
    assert summary["half_days"] == 1
    # 2.5 * 2000 DZD = 5000.0 DZD
    assert summary["estimated_deduction"] == 5000.0

    # Query sub-interval Nov 5 - Nov 6
    sub_iv = client.get(
        f"{settings.API_V1_STR}/absences/?employee_id={emp_id}&start_date=2026-11-05&end_date=2026-11-06",
        headers=auth_headers,
    )
    assert sub_iv.json()["unpaid_days"] == 1.0
    assert sub_iv.json()["estimated_deduction"] == 2000.0


def test_absence_range_validation_and_csv_export(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    emp_id = _create_emp(client, auth_headers)

    bad_dates = client.post(
        f"{settings.API_V1_STR}/absences/range",
        json={
            "employee_id": emp_id,
            "start_date": "2026-11-10",
            "end_date": "2026-11-05",
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    assert bad_dates.status_code == 400

    too_long = client.post(
        f"{settings.API_V1_STR}/absences/range",
        json={
            "employee_id": emp_id,
            "start_date": "2026-01-01",
            "end_date": "2026-06-01",
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    assert too_long.status_code == 400

    client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-12",
            "absence_type": "unjustified",
            "is_paid": False,
            "reason": "Retard prolongé",
        },
        headers=auth_headers,
    )

    csv_res = client.get(
        f"{settings.API_V1_STR}/absences/export/csv", headers=auth_headers
    )
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    text = csv_res.content.decode("utf-8-sig")
    assert "Date;Matricule;Employe;Type;Payee;Motif" in text
    assert "Amine Ziani" in text
    assert "Retard prolongé" in text
