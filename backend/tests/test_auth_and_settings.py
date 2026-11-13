from fastapi.testclient import TestClient

from app.core.config import settings


def test_health_check_and_frontend_served(client: TestClient) -> None:
    res = client.get(f"{settings.API_V1_STR}/utils/health-check/")
    assert res.status_code == 200
    assert res.json() is True

    root_res = client.get("/")
    assert root_res.status_code == 200
    assert "EL-AMEL LAB" in root_res.text


def test_login_failures_and_unauthenticated_access(client: TestClient) -> None:
    # Wrong password
    bad = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": settings.ADMIN_EMAIL, "password": "wrongpassword"},
    )
    assert bad.status_code == 400

    # Protected route without token (OAuth2PasswordBearer returns 401/403)
    unauth = client.get(f"{settings.API_V1_STR}/employees/")
    assert unauth.status_code in (401, 403)

    # Invalid token
    bad_tok = client.get(
        f"{settings.API_V1_STR}/employees/",
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )
    assert bad_tok.status_code == 403


def test_admin_profile_and_password_update(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    me = client.get(f"{settings.API_V1_STR}/users/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["email"] == settings.ADMIN_EMAIL

    upd = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"full_name": "Dr. Amel Directeur"},
        headers=auth_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["full_name"] == "Dr. Amel Directeur"

    # Reject wrong current password
    bad_pw = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        json={"current_password": "wrongpass", "new_password": "newstrongpassword"},
        headers=auth_headers,
    )
    assert bad_pw.status_code == 400

    # Reject identical new password
    same_pw = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        json={
            "current_password": settings.ADMIN_PASSWORD,
            "new_password": settings.ADMIN_PASSWORD,
        },
        headers=auth_headers,
    )
    assert same_pw.status_code == 400

    # Update password cleanly & login with new password
    ok_pw = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        json={
            "current_password": settings.ADMIN_PASSWORD,
            "new_password": "newstrongpassword",
        },
        headers=auth_headers,
    )
    assert ok_pw.status_code == 200

    new_login = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": settings.ADMIN_EMAIL, "password": "newstrongpassword"},
    )
    assert new_login.status_code == 200


def test_company_settings_defaults_and_update(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    res = client.get(f"{settings.API_V1_STR}/settings/company", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "EL-AMEL LAB"
    assert data["currency"] == "DZD"
    assert data["working_days_per_month"] == 22
    assert data["default_annual_vacation_days"] == 30

    upd = client.patch(
        f"{settings.API_V1_STR}/settings/company",
        json={
            "address": "12 Rue Didouche Mourad, Alger",
            "phone": "0550 12 34 56",
            "tax_id": "NIF 001234567890",
            "working_days_per_month": 26,
        },
        headers=auth_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["address"] == "12 Rue Didouche Mourad, Alger"
    assert upd.json()["working_days_per_month"] == 26


def test_sqlite_backup_download_and_cors_tauri_origin(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    backup = client.get(f"{settings.API_V1_STR}/settings/backup", headers=auth_headers)
    assert backup.status_code == 200
    assert ".db" in backup.headers["content-disposition"]
    assert backup.content[:16] == b"SQLite format 3\x00"

    cors = client.options(
        f"{settings.API_V1_STR}/utils/health-check/",
        headers={
            "Origin": "http://tauri.localhost",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert cors.status_code == 200
    assert cors.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in cors.headers


def test_secret_key_auto_generation_persistence(tmp_path) -> None:
    from app.core.config import load_or_create_secret_key

    first = load_or_create_secret_key(tmp_path)
    second = load_or_create_secret_key(tmp_path)
    assert len(first) == 64
    assert first == second
    assert (tmp_path / ".secret_key").is_file()
