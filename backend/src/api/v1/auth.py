import asyncio
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, status
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.email_identity import canonicalize_email, find_user_by_email
from src.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from src.db.database import get_db
from src.db.models import PasswordResetOTP, User
from src.models.schemas import (
    GoogleAuthRequest,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdateRequest,
    Token,
    UserLogin,
    UserOut,
    UserRegister,
)
from src.services.email_service import send_password_reset_otp

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
settings = get_settings()

PASSWORD_RESET_REQUEST_MESSAGE = "Nếu email tồn tại, mã OTP đặt lại mật khẩu đã được gửi."


def _otp_hash(email: str, otp: str) -> str:
    payload = f"{email}:{otp}".encode()
    return hmac.new(settings.secret_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


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
            detail="Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.",
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
            detail="Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.",
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


@router.post("/password-reset/request")
async def request_password_reset(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Gửi OTP 6 chữ số. Phản hồi chung để không tiết lộ email có tồn tại hay không."""
    if not settings.smtp_username or not settings.smtp_password:
        raise HTTPException(status_code=503, detail="Dịch vụ gửi email chưa được cấu hình.")

    email = canonicalize_email(str(payload.email))
    user = await _find_user_by_email(db, email)
    if not user:
        return {"message": PASSWORD_RESET_REQUEST_MESSAGE}

    now = datetime.now(UTC)
    latest = await db.scalar(
        select(PasswordResetOTP)
        .where(PasswordResetOTP.email == email, PasswordResetOTP.used_at.is_(None))
        .order_by(PasswordResetOTP.created_at.desc())
        .limit(1)
    )
    if latest and latest.created_at and now - _as_utc(latest.created_at) < timedelta(seconds=settings.password_reset_otp_resend_seconds):
        return {"message": PASSWORD_RESET_REQUEST_MESSAGE}

    otp = f"{secrets.randbelow(1_000_000):06d}"
    record = PasswordResetOTP(
        email=email,
        otp_hash=_otp_hash(email, otp),
        expires_at=now + timedelta(minutes=settings.password_reset_otp_expire_minutes),
    )
    db.add(record)
    await db.commit()
    try:
        await send_password_reset_otp(recipient=email, otp=otp)
    except Exception as exc:
        logger.exception("Could not send password reset OTP")
        await db.delete(record)
        await db.commit()
        raise HTTPException(status_code=503, detail="Không thể gửi email OTP. Vui lòng thử lại sau.") from exc

    return {"message": PASSWORD_RESET_REQUEST_MESSAGE}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    payload: PasswordResetConfirm,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    email = canonicalize_email(str(payload.email))
    now = datetime.now(UTC)
    record = await db.scalar(
        select(PasswordResetOTP)
        .where(
            PasswordResetOTP.email == email,
            PasswordResetOTP.used_at.is_(None),
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .limit(1)
    )
    if not record or _as_utc(record.expires_at) < now:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")
    if record.attempts >= settings.password_reset_otp_max_attempts:
        raise HTTPException(status_code=400, detail="Bạn đã nhập sai OTP quá nhiều lần. Hãy yêu cầu mã mới.")

    if not hmac.compare_digest(record.otp_hash, _otp_hash(email, payload.otp)):
        record.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")

    user = await _find_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")
    user.hashed_password = get_password_hash(payload.new_password)
    record.used_at = now
    await db.execute(
        delete(PasswordResetOTP).where(
            PasswordResetOTP.email == email,
            PasswordResetOTP.id != record.id,
        )
    )
    await db.commit()
    response.delete_cookie(key="career_session", path="/", httponly=True)
    return {"message": "Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới."}


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
    google_picture = token_info.get("picture") or None
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=(token_info.get("name") or email.split("@", 1)[0])[:255],
            # Google does not provide a trustworthy application role. New Google
            # accounts are always students; counselor and enterprise accounts
            # must be provisioned through the email registration flow.
            role="student",
            avatar_url=google_picture,
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
    else:
        # Đồng bộ avatar Google nếu user chưa có avatar tùy chỉnh
        if not user.avatar_url and google_picture:
            user.avatar_url = google_picture
            await db.commit()
            await db.refresh(user)

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


@router.put("/me", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Cập nhật thông tin tài khoản (Họ và tên, Mật khẩu mới)."""
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()

    if payload.new_password:
        if not payload.current_password or not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác.")
        current_user.hashed_password = get_password_hash(payload.new_password)

    try:
        await db.commit()
        await db.refresh(current_user)
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("User profile update failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể lưu thông tin hồ sơ. Vui lòng thử lại sau.",
        ) from exc

    return current_user


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Đổi mật khẩu người dùng đang đăng nhập."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác.")

    current_user.hashed_password = get_password_hash(payload.new_password)
    try:
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Password change failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể cập nhật mật khẩu. Vui lòng thử lại sau.",
        ) from exc

    return {"message": "Đổi mật khẩu thành công."}


_AVATAR_DIR = Path("data/avatars")
_ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Upload hoặc thay đổi avatar của người dùng."""
    if file.content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.",
        )
    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ảnh avatar không được vượt quá 2 MB.",
        )

    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(file.content_type, ".jpg")
    _AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    # Xóa avatar cũ nếu là file local
    if current_user.avatar_url and current_user.avatar_url.startswith("/api/v1/avatars/"):
        old_path = _AVATAR_DIR / current_user.avatar_url.split("/")[-1]
        old_path.unlink(missing_ok=True)

    filename = f"{current_user.id}{ext}"
    file_path = _AVATAR_DIR / filename
    file_path.write_bytes(content)

    current_user.avatar_url = f"/api/v1/avatars/{filename}"
    try:
        await db.commit()
        await db.refresh(current_user)
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Avatar upload failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể lưu avatar. Vui lòng thử lại sau.",
        ) from exc

    return current_user


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Xóa avatar hiện tại, trở về icon mặc định."""
    if current_user.avatar_url and current_user.avatar_url.startswith("/api/v1/avatars/"):
        old_path = _AVATAR_DIR / current_user.avatar_url.split("/")[-1]
        old_path.unlink(missing_ok=True)

    current_user.avatar_url = None
    try:
        await db.commit()
        await db.refresh(current_user)
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Avatar delete failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể xóa avatar. Vui lòng thử lại sau.",
        ) from exc

    return current_user
