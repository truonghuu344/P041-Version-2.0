from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

import src.backend.main as backend_main
from src.backend.db.database import async_session_factory, get_db_session
from src.backend.db.models import Base


def test_sqlalchemy_base_and_async_session_factory_are_configured() -> None:
    assert Base.metadata is not None
    assert async_session_factory.class_ is AsyncSession


@pytest.mark.asyncio
async def test_database_dependency_yields_async_session() -> None:
    dependency: AsyncIterator[AsyncSession] = get_db_session()
    session = await anext(dependency)

    assert isinstance(session, AsyncSession)

    await dependency.aclose()


def test_ready_endpoint_returns_200_when_database_is_connected(monkeypatch) -> None:
    check = AsyncMock(return_value=True)
    monkeypatch.setattr(backend_main, "check_database_connection", check)

    response = TestClient(backend_main.app).get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "connected"}
    check.assert_awaited_once()


def test_ready_endpoint_returns_503_when_database_is_unavailable(monkeypatch) -> None:
    check = AsyncMock(side_effect=ConnectionError("database unavailable"))
    monkeypatch.setattr(backend_main, "check_database_connection", check)

    response = TestClient(backend_main.app).get("/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not ready"}
