import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

import src.backend.api.admin as admin_api
from src.backend.core.dependencies import get_current_admin, get_current_user
from src.backend.db.database import get_db_session
from src.backend.db.models import User, UserRole
from src.backend.main import app


def _user(role: UserRole = UserRole.ADMIN) -> User:
    return User(
        id=str(uuid.uuid4()),
        email=f"{role.value}@example.com",
        full_name=f"{role.value.title()} Example",
        role=role,
        is_active=True,
        created_at=datetime.now(UTC),
    )


def _admin_client(admin: User | None = None) -> TestClient:
    current_admin = admin or _user()
    session = AsyncMock(spec=AsyncSession)

    async def fake_database_session():
        yield session

    async def fake_current_admin():
        return current_admin

    app.dependency_overrides[get_db_session] = fake_database_session
    app.dependency_overrides[get_current_admin] = fake_current_admin
    return TestClient(app)


def test_admin_list_users_returns_frontend_contract(monkeypatch) -> None:
    users = [_user(UserRole.ADMIN), _user(UserRole.STUDENT)]
    list_users = AsyncMock(return_value=users)
    monkeypatch.setattr(admin_api.admin_service, "list_users", list_users)
    client = _admin_client()
    try:
        response = client.get("/api/v1/admin/users")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert [item["role"] for item in response.json()] == ["admin", "student"]
    list_users.assert_awaited_once()


def test_admin_create_user_validates_password_before_service(monkeypatch) -> None:
    create_user = AsyncMock()
    monkeypatch.setattr(admin_api.admin_service, "create_user", create_user)
    client = _admin_client()
    try:
        response = client.post(
            "/api/v1/admin/users",
            json={
                "email": "new@example.com",
                "password": "weakpass",
                "full_name": "New User",
                "role": "student",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    create_user.assert_not_awaited()


def test_admin_service_errors_are_mapped_without_internal_details(monkeypatch) -> None:
    create_user = AsyncMock(side_effect=admin_api.admin_service.AdminDuplicateEmailError())
    monkeypatch.setattr(admin_api.admin_service, "create_user", create_user)
    client = _admin_client()
    try:
        response = client.post(
            "/api/v1/admin/users",
            json={
                "email": "new@example.com",
                "password": "Strong-password1",
                "full_name": "New User",
                "role": "student",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already exists"}


def test_non_admin_user_is_forbidden() -> None:
    async def fake_current_user():
        return _user(UserRole.STUDENT)

    app.dependency_overrides[get_current_user] = fake_current_user
    try:
        response = TestClient(app).get("/api/v1/admin/users")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json() == {"detail": "Administrator access required"}
