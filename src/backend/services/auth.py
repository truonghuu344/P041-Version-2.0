from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.config import get_settings
from src.backend.core.security import hash_password, verify_password
from src.backend.db.models import User, UserRole
from src.backend.models.auth import RegisterRequest

DUMMY_PASSWORD_HASH = hash_password("Authentication-timing-placeholder1")


class AuthServiceError(Exception):
    pass


class DuplicateAccountError(AuthServiceError):
    pass


class InvalidCredentialsError(AuthServiceError):
    pass


class DisabledAccountError(AuthServiceError):
    pass


class GoogleAuthenticationError(AuthServiceError):
    pass


class GoogleAccountLinkRequiredError(AuthServiceError):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    full_name: str


async def find_user_by_email(session: AsyncSession, email: str) -> User | None:
    normalized_email = email.strip().lower()
    return await session.scalar(select(User).where(func.lower(User.email) == normalized_email))


async def register_user(session: AsyncSession, payload: RegisterRequest) -> User:
    if await find_user_by_email(session, str(payload.email)) is not None:
        raise DuplicateAccountError

    user = User(
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateAccountError from exc
    await session.refresh(user)
    return user


async def authenticate_password(session: AsyncSession, email: str, password: str) -> User:
    user = await find_user_by_email(session, email)
    password_hash = user.password_hash if user is not None and user.password_hash else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(password, password_hash)
    if user is None or user.password_hash is None or not password_is_valid:
        raise InvalidCredentialsError
    if not user.is_active:
        raise DisabledAccountError
    return user


def _verify_google_token(credential: str, client_id: str) -> dict[str, Any]:
    return google_id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        client_id,
    )


async def verify_google_credential(credential: str) -> GoogleIdentity:
    client_id = get_settings().google_oauth_client_id.strip()
    if not client_id:
        raise GoogleAuthenticationError("Google authentication is not configured")
    try:
        claims = await asyncio.to_thread(_verify_google_token, credential, client_id)
        subject = str(claims.get("sub", "")).strip()
        email = str(TypeAdapter(EmailStr).validate_python(claims.get("email"))).lower()
        if not subject or claims.get("email_verified") is not True:
            raise GoogleAuthenticationError("Google account email is not verified")
        full_name = str(claims.get("name") or email.split("@", 1)[0]).strip()
        if len(full_name) < 2:
            full_name = "Google User"
        return GoogleIdentity(subject=subject, email=email, full_name=full_name[:255])
    except GoogleAuthenticationError:
        raise
    except (ValueError, TypeError, ValidationError, GoogleAuthError) as exc:
        raise GoogleAuthenticationError("Invalid Google credential") from exc


async def authenticate_google(
    session: AsyncSession,
    credential: str,
    requested_role: UserRole,
) -> User:
    identity = await verify_google_credential(credential)
    user = await session.scalar(select(User).where(User.google_subject == identity.subject))
    if user is not None:
        if not user.is_active:
            raise DisabledAccountError
        return user

    existing_email_user = await find_user_by_email(session, identity.email)
    if existing_email_user is not None:
        # Do not silently link identities by matching email alone. A logged-in user
        # can explicitly link providers in a future account-settings endpoint.
        raise GoogleAccountLinkRequiredError

    user = User(
        email=identity.email,
        google_subject=identity.subject,
        full_name=identity.full_name,
        role=requested_role,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise DuplicateAccountError from exc
    await session.refresh(user)
    return user
