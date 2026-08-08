import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.email_identity import canonicalize_email, find_user_by_email
from src.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from src.db.database import get_db
from src.db.models import User
from src.models.schemas import Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


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
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Lấy thông tin tài khoản hiện tại."""
    return current_user
