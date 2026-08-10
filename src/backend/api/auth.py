from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.backend.config import get_settings
from src.backend.core.dependencies import get_current_user
from src.backend.core.security import create_access_token
from src.backend.db.database import get_db_session
from src.backend.db.models import User
from src.backend.models.auth import (
    AuthResponse,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from src.backend.models.common import MessageResponse
from src.backend.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _auth_response(response: Response, user: User) -> AuthResponse:
    settings = get_settings()
    access_token = create_access_token(user.id, user.role)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )
    return AuthResponse(
        access_token=access_token,
        user=user,
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register with email and password",
)
async def register(
    payload: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    try:
        user = await auth_service.register_user(session, payload)
    except auth_service.DuplicateAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from exc
    return _auth_response(response, user)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in with email and password",
)
async def login(
    payload: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    try:
        user = await auth_service.authenticate_password(
            session,
            str(payload.email),
            payload.password,
        )
    except auth_service.InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except auth_service.DisabledAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        ) from exc
    return _auth_response(response, user)


@router.post(
    "/google",
    response_model=AuthResponse,
    summary="Register or log in with a Google ID token",
)
async def google_auth(
    payload: GoogleAuthRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthResponse:
    try:
        user = await auth_service.authenticate_google(
            session,
            payload.credential,
            payload.role,
        )
    except auth_service.DisabledAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        ) from exc
    except auth_service.GoogleAccountLinkRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already uses password login; account linking is required",
        ) from exc
    except auth_service.DuplicateAccountError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from exc
    except auth_service.GoogleAuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) or "Invalid Google credential",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return _auth_response(response, user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out and clear the authentication cookie",
)
async def logout(response: Response) -> MessageResponse:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )
    return MessageResponse(message="Logged out")
