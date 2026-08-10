from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.config import get_settings
from src.backend.core.security import InvalidAccessTokenError, decode_access_token
from src.backend.db.database import get_db_session
from src.backend.db.models import User


def _access_token_from_request(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() == "bearer" and credentials:
        return credentials.strip()
    return request.cookies.get(get_settings().auth_cookie_name)


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _access_token_from_request(request)
    if not token:
        raise unauthorized

    try:
        payload = decode_access_token(token)
        user_id = str(payload["sub"])
        uuid.UUID(user_id)
    except (InvalidAccessTokenError, KeyError, TypeError, ValueError) as exc:
        raise unauthorized from exc

    user = await session.get(User, user_id)
    if user is None:
        raise unauthorized
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    return user
