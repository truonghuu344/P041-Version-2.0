from pathlib import Path

# 1. Update schemas.py
schemas_path = Path("backend/src/models/schemas.py")
content = schemas_path.read_text(encoding="utf-8")

old_role_block = '''class UserRegister(BaseModel):
    """Public self-registration payload.

    SECURITY CONTRACT: the client never picks a privileged role. Public
    registration only creates STUDENT or ENTERPRISE accounts. Counselor and Admin
    accounts remain provisioned by the system.
    """

    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: str = Field(..., min_length=2, description="Họ và tên người dùng")
    role: Literal["student", "enterprise"] = Field(
        default="student",
        description="Chỉ chấp nhận 'student' hoặc 'enterprise'.",
    )'''

new_role_block = '''class UserRegister(BaseModel):
    """Public self-registration payload.

    SECURITY CONTRACT: the client never picks a privileged role. Public
    registration only creates STUDENT or COUNSELOR accounts. Admin accounts
    remain provisioned by the system.
    """

    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: str = Field(..., min_length=2, description="Họ và tên người dùng")
    role: Literal["student", "counselor"] = Field(
        default="student",
        description="Chỉ chấp nhận 'student' hoặc 'counselor'.",
    )'''

if old_role_block in content:
    content = content.replace(old_role_block, new_role_block)
    schemas_path.write_text(content, encoding="utf-8")
    print("Updated schemas.py to student/counselor")
else:
    print("Could not find old_role_block in schemas.py")

# 2. Update auth.py
auth_code = '''import asyncio
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


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _otp_hash(email: str, otp: str) -> str:
    key = settings.secret_key.encode("utf-8")
    message = f"{canonicalize_email(email)}:{otp}".encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


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
    """Đăng ký công khai: chỉ tạo tài khoản Sinh viên hoặc Cố vấn."""
    # Kiểm tra email đã tồn tại chưa
    existing_user = await _find_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.",
        )

    new_role = payload.role if payload.role in ("student", "counselor") else "student"

    # Khởi tạo user mới
    new_user = User(
        email=canonicalize_email(payload.email),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=new_role,
    )
    logger.info("Registering user: email=%s, role=%s", new_user.email, new_user.role)
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
        logger.info("User registered successfully: id=%s, role=%s", new_user.id, new_user.role)
    except IntegrityError as exc:
        await db.rollback()
        logger.warning("User registration conflict: email=%s already exists", new_user.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("User registration database write failed for email %s", new_user.email)
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
        logger.warning("Failed login attempt for email: %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
        )

    if user.role == "enterprise":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản Doanh nghiệp không còn được hỗ trợ. Vui lòng liên hệ quản trị viên để chuyển đổi sang tài khoản Cố vấn.",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    _set_auth_cookie(response, request, access_token)
    logger.info("User login successful: id=%s, role=%s", user.id, user.role)
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
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Xác thực OTP và cập nhật mật khẩu mới."""
    email = canonicalize_email(str(payload.email))
    expected_hash = _otp_hash(email, payload.otp)
    now = datetime.now(UTC)

    record = await db.scalar(
        select(PasswordResetOTP)
        .where(
            PasswordResetOTP.email == email,
            PasswordResetOTP.otp_hash == expected_hash,
            PasswordResetOTP.used_at.is_(None),
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .limit(1)
    )
    if not record or _as_utc(record.expires_at) < now:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn.")

    user = await _find_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="Mã OTP không chính xác hoặc đã hết hạn.")

    record.used_at = now
    user.hashed_password = get_password_hash(payload.new_password)
    await db.execute(
        delete(PasswordResetOTP).where(PasswordResetOTP.email == email, PasswordResetOTP.id != record.id)
    )
    await db.commit()
    return {"message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại."}


@router.post("/google", response_model=Token)
async def google_login(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Xác thực Google ID Token và đăng nhập/đăng ký user."""
    google_id = getattr(settings, "google_oauth_client_id", None) or getattr(settings, "google_client_id", None)
    if not google_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth chưa được cấu hình trên server.",
        )

    try:
        idinfo = await asyncio.to_thread(
            id_token.verify_oauth2_token,
            payload.credential,
            GoogleRequest(),
            google_id,
        )
    except (ValueError, GoogleAuthError) as exc:
        logger.warning("Invalid Google ID token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token không hợp lệ hoặc đã hết hạn.",
        ) from exc

    email = canonicalize_email(idinfo.get("email", ""))
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không tìm thấy email từ Google ID token.",
        )

    full_name = idinfo.get("name") or email.split("@")[0]
    avatar_url = idinfo.get("picture")

    user = await _find_user_by_email(db, email)
    if not user:
        new_user = User(
            email=email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=full_name,
            role="student",
            avatar_url=avatar_url,
        )
        db.add(new_user)
        try:
            await db.commit()
            await db.refresh(new_user)
            user = new_user
            logger.info("New user registered via Google: email=%s, role=%s", user.email, user.role)
        except IntegrityError:
            await db.rollback()
            user = await _find_user_by_email(db, email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể tạo tài khoản từ Google OAuth.",
                )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    _set_auth_cookie(response, request, access_token)
    logger.info("Google login successful: id=%s, role=%s", user.id, user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(response: Response) -> Response:
    """Đăng xuất người dùng bằng cách xóa auth cookie."""
    response.delete_cookie(key="career_session", path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Lấy thông tin người dùng đang đăng nhập."""
    return UserOut.model_validate(current_user)


@router.put("/me", response_model=UserOut)
@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Cập nhật thông tin profile của người dùng."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.",
            )
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác.",
            )
        current_user.hashed_password = get_password_hash(payload.new_password)

    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Đổi mật khẩu người dùng."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác.",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"message": "Đổi mật khẩu thành công."}


@router.post("/profile/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Tải lên avatar mới."""
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng file không được hỗ trợ. Vui lòng tải lên file ảnh (JPEG, PNG, WebP, GIF).",
        )

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng file vượt quá giới hạn cho phép (5MB).",
        )

    ext = Path(file.filename or "avatar.png").suffix or ".png"
    filename = f"avatar_{current_user.id}_{int(datetime.now().timestamp())}{ext}"
    upload_dir = Path("data/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(content)

    current_user.avatar_url = f"/data/avatars/{filename}"
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)
'''

Path("backend/src/api/v1/auth.py").write_text(auth_code, encoding="utf-8")
print("Updated auth.py to student/counselor with 403 on enterprise")
