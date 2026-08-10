import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

import src.backend.api.auth as auth_api
from src.backend.config import get_settings
from src.backend.core.security import create_access_token
from src.backend.db.database import get_db_session
from src.backend.db.models import User, UserRole
from src.backend.main import app


def _user() -> User:
    return User(
        id=uuid.uuid4(),
        email="student@example.com",
        full_name="Student Example",
        role=UserRole.STUDENT,
        is_active=True,
        created_at=datetime.now(UTC),
    )


def _client_with_fake_database(session=None):
    fake_session = session or AsyncMock(spec=AsyncSession)

    async def fake_database_session():
        yield fake_session

    app.dependency_overrides[get_db_session] = fake_database_session
    return TestClient(app)


def test_register_endpoint_returns_token_and_user(monkeypatch) -> None:
    register = AsyncMock(return_value=_user())
    monkeypatch.setattr(auth_api.auth_service, "register_user", register)
    client = _client_with_fake_database()
    try:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "Student@Example.com",
                "password": "Strong-password1",
                "full_name": "Student Example",
                "role": "student",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]
    assert response.json()["user"]["email"] == "student@example.com"
    assert register.await_args.args[1].email == "student@example.com"
    cookie = response.headers["set-cookie"]
    assert f"{get_settings().auth_cookie_name}=" in cookie
    assert "HttpOnly" in cookie


def test_register_endpoint_validates_password_before_database_call(monkeypatch) -> None:
    register = AsyncMock()
    monkeypatch.setattr(auth_api.auth_service, "register_user", register)
    client = _client_with_fake_database()
    try:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "student@example.com",
                "password": "weakpass",
                "full_name": "Student Example",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    register.assert_not_awaited()


def test_login_endpoint_uses_generic_error_for_invalid_credentials(monkeypatch) -> None:
    authenticate = AsyncMock(side_effect=auth_api.auth_service.InvalidCredentialsError())
    monkeypatch.setattr(auth_api.auth_service, "authenticate_password", authenticate)
    client = _client_with_fake_database()
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "student@example.com", "password": "wrong"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_google_endpoint_registers_or_logs_in_and_returns_token(monkeypatch) -> None:
    authenticate = AsyncMock(return_value=_user())
    monkeypatch.setattr(auth_api.auth_service, "authenticate_google", authenticate)
    client = _client_with_fake_database()
    try:
        response = client.post(
            "/api/v1/auth/google",
            json={"credential": "x" * 30, "role": "student"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["access_token"]
    authenticate.assert_awaited_once()


def test_me_endpoint_reads_user_from_http_only_cookie() -> None:
    user = _user()
    session = AsyncMock(spec=AsyncSession)
    session.get.return_value = user
    client = _client_with_fake_database(session)
    client.cookies.set(
        get_settings().auth_cookie_name,
        create_access_token(user.id, user.role),
    )
    try:
        response = client.get("/api/v1/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == str(user.id)
    assert response.json()["email"] == user.email
    session.get.assert_awaited_once_with(User, str(user.id))


def test_me_endpoint_returns_401_without_session_cookie() -> None:
    client = _client_with_fake_database()
    try:
        response = client.get("/api/v1/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_logout_endpoint_clears_session_cookie() -> None:
    response = TestClient(app).post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Logged out"}
    cookie = response.headers["set-cookie"]
    assert f"{get_settings().auth_cookie_name}=\"\"" in cookie
    assert "Max-Age=0" in cookie
