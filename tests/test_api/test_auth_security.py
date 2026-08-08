from datetime import timedelta

import pytest

from src.core.security import create_access_token
from tests.helpers import create_admin, register_and_login


@pytest.mark.asyncio
async def test_register_normalizes_email_and_rejects_duplicate(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "Student@Example.com",
            "password": "Password123!",
            "full_name": "Student One",
            "role": "student",
        },
    )
    assert response.status_code == 201
    assert response.json()["email"] == "student@example.com"

    duplicate = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "STUDENT@example.com",
            "password": "AnotherPassword123!",
            "full_name": "Duplicate User",
            "role": "student",
        },
    )
    assert duplicate.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "missing_field"),
    [
        ({"email": "not-an-email", "password": "Password123!", "full_name": "User"}, "email"),
        ({"email": "user@example.com", "password": "123", "full_name": "User"}, "password"),
        ({"email": "user@example.com", "password": "Password123!", "full_name": "A"}, "full_name"),
    ],
)
async def test_register_validates_input(client, payload, missing_field):
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert any(missing_field in [str(part) for part in item["loc"]] for item in response.json()["detail"])


@pytest.mark.asyncio
async def test_login_rejects_wrong_password_without_leaking_account_state(client):
    await register_and_login(client, email="login@example.com")

    wrong_password = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "wrong-password"},
    )
    unknown_email = await client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "wrong-password"},
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "authorization",
    [None, "Bearer invalid.jwt.token"],
)
async def test_protected_endpoint_rejects_missing_or_invalid_token(client, authorization):
    headers = {"Authorization": authorization} if authorization else {}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_is_rejected(client):
    user, _headers = await register_and_login(client, email="expired@example.com")
    expired_token = create_access_token(
        {"sub": user["id"], "email": user["email"], "role": user["role"]},
        expires_delta=timedelta(seconds=-1),
    )

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_non_admin_cannot_access_admin_api(client):
    _user, headers = await register_and_login(client, email="student-admin-api@example.com")

    response = await client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_manage_regular_user_but_cannot_delete_self(client):
    admin, admin_headers = await create_admin(client)
    created = await client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={
            "email": "managed@example.com",
            "password": "Password123!",
            "full_name": "Managed User",
            "role": "counselor",
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]

    updated = await client.put(
        f"/api/v1/admin/users/{user_id}",
        headers=admin_headers,
        json={"full_name": "Updated User", "role": "enterprise"},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Updated User"
    assert updated.json()["role"] == "enterprise"

    deleted = await client.delete(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert deleted.status_code == 204

    delete_self = await client.delete(f"/api/v1/admin/users/{admin['id']}", headers=admin_headers)
    assert delete_self.status_code == 400
