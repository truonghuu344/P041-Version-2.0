from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.core.security import verify_password
from src.backend.db.models import User, UserRole
from src.backend.models.auth import RegisterRequest
from src.backend.services import auth as auth_service


@pytest.mark.asyncio
async def test_register_user_hashes_password_and_commits() -> None:
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = None
    payload = RegisterRequest(
        email="  Student@Example.com ",
        password="Strong-password1",
        full_name="  Student   Example  ",
        role=UserRole.STUDENT,
    )

    user = await auth_service.register_user(session, payload)

    assert user.email == "student@example.com"
    assert user.full_name == "Student Example"
    assert user.password_hash is not None
    assert verify_password(payload.password, user.password_hash)
    session.add.assert_called()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_register_user_rejects_duplicate_email() -> None:
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = User(email="student@example.com", full_name="Student")
    payload = RegisterRequest(
        email="student@example.com",
        password="Strong-password1",
        full_name="Student Example",
    )

    with pytest.raises(auth_service.DuplicateAccountError):
        await auth_service.register_user(session, payload)

    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_password_login_accepts_correct_password_and_rejects_wrong_password() -> None:
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = None
    payload = RegisterRequest(
        email="student@example.com",
        password="Strong-password1",
        full_name="Student Example",
    )
    user = await auth_service.register_user(session, payload)
    user.is_active = True
    session.reset_mock()
    session.scalar.return_value = user

    authenticated = await auth_service.authenticate_password(
        session, user.email, "Strong-password1"
    )
    assert authenticated is user

    with pytest.raises(auth_service.InvalidCredentialsError):
        await auth_service.authenticate_password(session, user.email, "Wrong-password1")


@pytest.mark.asyncio
async def test_google_login_registers_a_new_verified_identity(monkeypatch) -> None:
    identity = auth_service.GoogleIdentity(
        subject="google-subject-123",
        email="student@example.com",
        full_name="Student Example",
    )
    monkeypatch.setattr(
        auth_service,
        "verify_google_credential",
        AsyncMock(return_value=identity),
    )
    session = AsyncMock(spec=AsyncSession)
    session.scalar.side_effect = [None, None]

    user = await auth_service.authenticate_google(
        session,
        "google-id-token",
        UserRole.STUDENT,
    )

    assert user.google_subject == identity.subject
    assert user.email == identity.email
    assert user.password_hash is None
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_google_credential_is_verified_for_configured_client(monkeypatch) -> None:
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: SimpleNamespace(google_oauth_client_id="client-id.apps.googleusercontent.com"),
    )
    verify = AsyncMock()
    monkeypatch.setattr(
        auth_service.asyncio,
        "to_thread",
        verify,
    )
    verify.return_value = {
        "sub": "google-subject-123",
        "email": "Student@Example.com",
        "email_verified": True,
        "name": "Student Example",
    }

    identity = await auth_service.verify_google_credential("google-id-token")

    assert identity.email == "student@example.com"
    assert identity.subject == "google-subject-123"
    assert verify.await_args.args[2] == "client-id.apps.googleusercontent.com"


@pytest.mark.asyncio
async def test_google_login_does_not_silently_link_an_existing_password_account(
    monkeypatch,
) -> None:
    identity = auth_service.GoogleIdentity(
        subject="google-subject-123",
        email="student@example.com",
        full_name="Student Example",
    )
    monkeypatch.setattr(
        auth_service,
        "verify_google_credential",
        AsyncMock(return_value=identity),
    )
    existing_user = User(
        email=identity.email,
        password_hash="existing-hash",
        full_name=identity.full_name,
    )
    session = AsyncMock(spec=AsyncSession)
    session.scalar.side_effect = [None, existing_user]

    with pytest.raises(auth_service.GoogleAccountLinkRequiredError):
        await auth_service.authenticate_google(
            session,
            "google-id-token",
            UserRole.STUDENT,
        )

    session.commit.assert_not_awaited()
