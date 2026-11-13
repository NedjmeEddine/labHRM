from fastapi.testclient import TestClient

from app.core.config import settings


def test_vacation_creation_overlap_and_cross_year_balance(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    emp_res = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Meriem Hadj",
            "job_title": "Biologiste",
            "department": "Microbiologie",
            "hire_date": "2023-01-01",
            "base_salary": 65000.0,
            "annual_vacation_days": 30,
        },
        headers=auth_headers,
    )
    emp_id = emp_res.json()["id"]

    # Create 5-day approved annual vacation in Nov 2026
    v1 = client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-11-10",
            "end_date": "2026-11-14",
            "vacation_type": "annual",
            "status": "approved",
        },
        headers=auth_headers,
    )
    assert v1.status_code == 200
    assert v1.json()["days_count"] == 5

    # Reject overlapping vacation
    overlap = client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-11-12",
            "end_date": "2026-11-16",
            "vacation_type": "annual",
            "status": "pending",
        },
        headers=auth_headers,
    )
    assert overlap.status_code == 400

    # Cross-year vacation Dec 29, 2026 -> Jan 03, 2027 (3 days in 2026, 3 days in 2027)
    v_cross = client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-12-29",
            "end_date": "2027-01-03",
            "vacation_type": "annual",
            "status": "approved",
        },
        headers=auth_headers,
    )
    assert v_cross.status_code == 200
    assert v_cross.json()["days_count"] == 6

    # Check 2026 balance: 5 + 3 = 8 taken, 22 remaining
    bal_2026 = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/vacation-balance?year=2026",
        headers=auth_headers,
    )
    assert bal_2026.status_code == 200
    assert bal_2026.json()["days_taken"] == 8
    assert bal_2026.json()["days_remaining"] == 22

    # Check 2027 balance: 3 taken, 27 remaining
    bal_2027 = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/vacation-balance?year=2027",
        headers=auth_headers,
    )
    assert bal_2027.status_code == 200
    assert bal_2027.json()["days_taken"] == 3
    assert bal_2027.json()["days_remaining"] == 27

    # Pending vacation becomes approved
    v_pend = client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-10-01",
            "end_date": "2026-10-02",
            "vacation_type": "annual",
            "status": "pending",
        },
        headers=auth_headers,
    )
    assert v_pend.status_code == 200
    vac_id = v_pend.json()["id"]

    bal_before = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/vacation-balance?year=2026",
        headers=auth_headers,
    )
    assert bal_before.json()["days_pending"] == 2
    assert bal_before.json()["days_taken"] == 8

    client.patch(
        f"{settings.API_V1_STR}/vacations/{vac_id}",
        json={"status": "approved"},
        headers=auth_headers,
    )

    bal_after = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/vacation-balance?year=2026",
        headers=auth_headers,
    )
    assert bal_after.json()["days_pending"] == 0
    assert bal_after.json()["days_taken"] == 10
    assert bal_after.json()["days_remaining"] == 20

    # Reject PATCH shifting non-overlapping vacation onto an existing vacation
    v_other = client.post(
        f"{settings.API_V1_STR}/vacations/",
        json={
            "employee_id": emp_id,
            "start_date": "2026-09-01",
            "end_date": "2026-09-03",
            "vacation_type": "annual",
            "status": "approved",
        },
        headers=auth_headers,
    )
    assert v_other.status_code == 200
    other_id = v_other.json()["id"]

    bad_shift = client.patch(
        f"{settings.API_V1_STR}/vacations/{other_id}",
        json={"start_date": "2026-11-11", "end_date": "2026-11-13"},
        headers=auth_headers,
    )
    assert bad_shift.status_code == 400

    # Batch balances endpoint returns accurate totals (10 + 3 = 13 taken in 2026)
    batch_bal = client.get(
        f"{settings.API_V1_STR}/vacations/balances?year=2026",
        headers=auth_headers,
    )
    assert batch_bal.status_code == 200
    assert len(batch_bal.json()) == 1
    assert batch_bal.json()[0]["days_taken"] == 13
    assert batch_bal.json()[0]["days_remaining"] == 17
