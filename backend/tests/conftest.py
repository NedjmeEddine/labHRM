from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

import app.api.deps as deps_module
import app.core.db as db_module
import app.main as main_module
from app.core.config import settings
from app.core.db import apply_sqlite_pragmas, init_db
from app.main import app


@pytest.fixture()
def test_engine(tmp_path: Path):
    db_file = tmp_path / "test_hr.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )

    event.listen(engine, "connect", apply_sqlite_pragmas)

    # Patch engine references across modules so lifespan & helpers use isolated DB
    orig_db_engine = db_module.engine
    orig_deps_engine = deps_module.engine
    orig_main_engine = main_module.engine

    db_module.engine = engine
    deps_module.engine = engine
    main_module.engine = engine

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        init_db(session)

    yield engine

    engine.dispose()
    db_module.engine = orig_db_engine
    deps_module.engine = orig_deps_engine
    main_module.engine = orig_main_engine


@pytest.fixture()
def session(test_engine) -> Generator[Session]:
    with Session(test_engine) as s:
        yield s


@pytest.fixture()
def client(test_engine) -> Generator[TestClient]:
    def _get_test_db() -> Generator[Session]:
        with Session(test_engine) as s:
            yield s

    app.dependency_overrides[deps_module.get_db] = _get_test_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient) -> dict[str, str]:
    res = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={
            "username": settings.ADMIN_EMAIL,
            "password": settings.ADMIN_PASSWORD,
        },
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
