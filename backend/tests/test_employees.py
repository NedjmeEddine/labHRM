from fastapi.testclient import TestClient

from app.core.config import settings


def test_create_list_search_employees(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    e1 = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Nadia Mansouri",
            "job_title": "Technicienne de Laboratoire",
            "department": "Hématologie",
            "hire_date": "2024-01-15",
            "base_salary": 55000.0,
        },
        headers=auth_headers,
    )
    assert e1.status_code == 200
    assert e1.json()["employee_code"] == "EMP-001"

    e2 = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Yacine Boudiaf",
            "job_title": "Réceptionniste",
            "department": "Accueil",
            "hire_date": "2025-05-01",
            "base_salary": 40000.0,
            "status": "on_leave",
        },
        headers=auth_headers,
    )
    assert e2.status_code == 200
    assert e2.json()["employee_code"] == "EMP-002"

    # Reject duplicate employee code
    dup = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "employee_code": "EMP-001",
            "full_name": "Autre Employé",
            "job_title": "Stagiaire",
            "department": "Lab",
            "hire_date": "2026-01-01",
            "base_salary": 30000.0,
        },
        headers=auth_headers,
    )
    assert dup.status_code == 400

    # Search by name/department
    search_res = client.get(
        f"{settings.API_V1_STR}/employees/?search=Hématologie", headers=auth_headers
    )
    assert search_res.status_code == 200
    assert search_res.json()["count"] == 1
    assert search_res.json()["data"][0]["full_name"] == "Nadia Mansouri"

    # Filter by status
    status_res = client.get(
        f"{settings.API_V1_STR}/employees/?status=on_leave", headers=auth_headers
    )
    assert status_res.status_code == 200
    assert status_res.json()["count"] == 1
    assert status_res.json()["data"][0]["full_name"] == "Yacine Boudiaf"


def test_employee_salary_history_and_cascade_delete(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    emp_res = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Sofiane Khelifi",
            "job_title": "Biochimiste",
            "department": "Biochimie",
            "hire_date": "2023-06-01",
            "base_salary": 60000.0,
        },
        headers=auth_headers,
    )
    emp_id = emp_res.json()["id"]

    # Update base salary with reason
    upd = client.patch(
        f"{settings.API_V1_STR}/employees/{emp_id}",
        json={
            "base_salary": 68000.0,
            "salary_change_reason": "Augmentation annuelle",
        },
        headers=auth_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["base_salary"] == 68000.0

    hist = client.get(
        f"{settings.API_V1_STR}/employees/{emp_id}/salary-history",
        headers=auth_headers,
    )
    assert hist.status_code == 200
    entries = hist.json()
    assert len(entries) == 2
    assert entries[0]["previous_salary"] == 60000.0
    assert entries[0]["new_salary"] == 68000.0
    assert entries[0]["reason"] == "Augmentation annuelle"
    assert entries[1]["previous_salary"] == 0.0
    assert entries[1]["new_salary"] == 60000.0

    # Add an absence before deleting employee
    ab = client.post(
        f"{settings.API_V1_STR}/absences/",
        json={
            "employee_id": emp_id,
            "date": "2026-11-02",
            "absence_type": "unjustified",
            "is_paid": False,
        },
        headers=auth_headers,
    )
    assert ab.status_code == 200

    # Delete employee -> cascade removes absences
    del_res = client.delete(
        f"{settings.API_V1_STR}/employees/{emp_id}", headers=auth_headers
    )
    assert del_res.status_code == 200

    ab_list = client.get(
        f"{settings.API_V1_STR}/absences/?employee_id={emp_id}", headers=auth_headers
    )
    assert ab_list.json()["total_count"] == 0


def test_employee_code_validation_and_enum_rejection(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    e1 = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Karim Zemmouri",
            "job_title": "Biologiste",
            "department": "Lab",
            "hire_date": "2025-01-10",
            "base_salary": 50000.0,
        },
        headers=auth_headers,
    )
    assert e1.status_code == 200
    emp_id = e1.json()["id"]

    # Reject empty/whitespace employee_code on PATCH
    empty_code = client.patch(
        f"{settings.API_V1_STR}/employees/{emp_id}",
        json={"employee_code": "   "},
        headers=auth_headers,
    )
    assert empty_code.status_code == 400

    # Reject invalid status enum
    bad_status = client.post(
        f"{settings.API_V1_STR}/employees/",
        json={
            "full_name": "Test Invalid",
            "job_title": "Biologiste",
            "department": "Lab",
            "hire_date": "2025-01-10",
            "base_salary": 50000.0,
            "status": "invalid_status",
        },
        headers=auth_headers,
    )
    assert bad_status.status_code == 422
