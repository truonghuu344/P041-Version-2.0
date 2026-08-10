from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.core.security import hash_password
from src.backend.db.models import User, UserRole
from src.backend.models.auth import AdminUserCreateRequest, AdminUserUpdateRequest


class AdminUserServiceError(Exception):
    pass


class AdminUserNotFoundError(AdminUserServiceError):
    pass


class AdminDuplicateEmailError(AdminUserServiceError):
    pass


class AdminProtectedAccountError(AdminUserServiceError):
    pass


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at.desc(), User.email.asc()))
    return list(result.scalars().all())


async def create_user(session: AsyncSession, payload: AdminUserCreateRequest) -> User:
    if payload.role is UserRole.ADMIN:
        raise AdminProtectedAccountError("Additional admin accounts cannot be created here")
    duplicate = await session.scalar(select(User.id).where(func.lower(User.email) == str(payload.email)))
    if duplicate is not None:
        raise AdminDuplicateEmailError

    user = User(
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AdminDuplicateEmailError from exc
    await session.refresh(user)
    return user


async def update_user(
    session: AsyncSession,
    current_admin: User,
    user_id: str,
    payload: AdminUserUpdateRequest,
) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise AdminUserNotFoundError

    if payload.role is UserRole.ADMIN and user.role is not UserRole.ADMIN:
        raise AdminProtectedAccountError("Users cannot be promoted to admin here")
    if user.role is UserRole.ADMIN:
        if payload.role is not None and payload.role is not UserRole.ADMIN:
            raise AdminProtectedAccountError("The system admin role cannot be changed")
        if payload.is_active is False:
            raise AdminProtectedAccountError("The system admin cannot be disabled")
    if current_admin.id == user.id and payload.is_active is False:
        raise AdminProtectedAccountError("You cannot disable your current account")

    if payload.email is not None and payload.email != user.email:
        duplicate = await session.scalar(
            select(User.id).where(
                func.lower(User.email) == str(payload.email),
                User.id != user.id,
            )
        )
        if duplicate is not None:
            raise AdminDuplicateEmailError
        user.email = str(payload.email)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AdminDuplicateEmailError from exc
    await session.refresh(user)
    return user


async def delete_user(
    session: AsyncSession,
    current_admin: User,
    user_id: str,
) -> None:
    user = await session.get(User, user_id)
    if user is None:
        raise AdminUserNotFoundError
    if current_admin.id == user.id:
        raise AdminProtectedAccountError("You cannot delete your current account")
    if user.role is UserRole.ADMIN:
        raise AdminProtectedAccountError("Admin accounts cannot be deleted here")

    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()
