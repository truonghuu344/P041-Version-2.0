import asyncio
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.email_identity import canonicalize_email, find_user_by_email
from src.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from src.db.database import get_db
from src.db.models import User
from src.models.schemas import GoogleAuthRequest, Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
settings = get_settings()


def _cookie_is_secure(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    return settings.app_env == "production" and forwarded_proto.casefold() == "https"


def _set_auth_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        key="career_session",
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=_cookie_is_secure(request),
        samesite="lax",
        path="/",
    )


async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
    try:
        return await find_user_by_email(db, email)
    except SQLAlchemyError as exc:
        logger.exception("Authentication database query failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cơ sở dữ liệu chưa sẵn sàng. Vui lòng thử lại sau ít phút.",
        ) from exc


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Đăng ký tài khoản người dùng mới (Sinh viên, Cố vấn, Doanh nghiệp)."""
    # Kiểm tra email đã tồn tại chưa
    existing_user = await _find_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được đăng ký trong hệ thống",
        )

    # Khởi tạo user mới
    new_user = User(
        email=canonicalize_email(payload.email),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role if payload.role in ["student", "counselor", "enterprise"] else "student",
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được đăng ký trong hệ thống",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("User registration database write failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể lưu tài khoản do cơ sở dữ liệu chưa sẵn sàng.",
        ) from exc
    return new_user


@router.post("/login", response_model=Token)
async def login_user(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Đăng nhập bằng Email và Password, nhận JWT Token."""
    user = await _find_user_by_email(db, payload.email)

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    _set_auth_cookie(response, request, access_token)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/google", response_model=Token)
async def login_with_google(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Xác minh Google Identity Services ID token ở backend rồi phát JWT nội bộ."""
    if not settings.google_oauth_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth chưa được cấu hình trên máy chủ.",
        )
    try:
        token_info = await asyncio.to_thread(
            id_token.verify_oauth2_token,
            payload.credential,
            GoogleRequest(),
            settings.google_oauth_client_id,
        )
    except (GoogleAuthError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Google ID token không hợp lệ hoặc đã hết hạn.") from exc

    if not token_info.get("email_verified") or not token_info.get("email"):
        raise HTTPException(status_code=401, detail="Google chưa xác minh địa chỉ email này.")

    email = canonicalize_email(token_info["email"])
    user = await _find_user_by_email(db, email)
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=(token_info.get("name") or email.split("@", 1)[0])[:255],
            role=payload.role,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError as exc:
            await db.rollback()
            user = await _find_user_by_email(db, email)
            if not user:
                raise HTTPException(status_code=409, detail="Không thể liên kết tài khoản Google.") from exc

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    _set_auth_cookie(response, request, access_token)
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(request: Request) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key="career_session",
        path="/",
        httponly=True,
        secure=_cookie_is_secure(request),
        samesite="lax",
    )
    return response


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Lấy thông tin tài khoản hiện tại."""
    return current_user
