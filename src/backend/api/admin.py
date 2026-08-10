from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.core.dependencies import get_current_admin
from src.backend.db.database import get_db_session
from src.backend.db.models import User
from src.backend.models.auth import AdminUserCreateRequest, AdminUserUpdateRequest, UserResponse
from src.backend.services import admin as admin_service

router = APIRouter(prefix="/admin", tags=["Administration"])


def _service_error(exc: admin_service.AdminUserServiceError) -> HTTPException:
    if isinstance(exc, admin_service.AdminUserNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if isinstance(exc, admin_service.AdminDuplicateEmailError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/users", response_model=list[UserResponse], summary="List all users")
async def list_users(
    _current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session),
) -> list[User]:
    return await admin_service.list_users(session)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a managed user",
)
async def create_user(
    payload: AdminUserCreateRequest,
    _current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    try:
        return await admin_service.create_user(session, payload)
    except admin_service.AdminUserServiceError as exc:
        raise _service_error(exc) from exc


@router.put("/users/{user_id}", response_model=UserResponse, summary="Update a managed user")
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    try:
        return await admin_service.update_user(session, current_admin, user_id, payload)
    except admin_service.AdminUserServiceError as exc:
        raise _service_error(exc) from exc


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a managed user",
)
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    try:
        await admin_service.delete_user(session, current_admin, user_id)
    except admin_service.AdminUserServiceError as exc:
        raise _service_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
