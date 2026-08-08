from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_password_hash, require_role
from src.db.database import get_db
from src.db.models import User
from src.models.schemas import UserOut, UserRegister, UserUpdate

router = APIRouter(prefix="/admin", tags=["Admin User Management"])
MANAGED_ROLES = {"student", "counselor", "enterprise"}


def _managed_role(role: str) -> str:
    if role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hệ thống chỉ có một Admin. Không thể cấp quyền Admin cho tài khoản khác.",
        )
    return role if role in MANAGED_ROLES else "student"


@router.get("/users", response_model=list[UserOut])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> list[UserOut]:
    """[ADMIN ONLY] Xem danh sách toàn bộ người dùng trong hệ thống."""
    stmt = select(User).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/users/{user_id}", response_model=UserOut)
async def get_user_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> UserOut:
    """[ADMIN ONLY] Lấy thông tin chi tiết của người dùng theo ID."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng")
    return user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> UserOut:
    """[ADMIN ONLY] Thêm Student, Counselor hoặc Enterprise; không thể tạo Admin thứ hai."""
    stmt = select(User).where(User.email == payload.email.lower())
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã tồn tại trong hệ thống",
        )

    role = _managed_role(payload.role)

    new_user = User(
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user_by_admin(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> UserOut:
    """[ADMIN ONLY] Chỉnh sửa thông tin người dùng (Họ tên, Email, Vai trò, Mật khẩu mới)."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng",
        )

    if payload.email and payload.email.lower() != user.email:
        # Check if new email is taken
        stmt_check = select(User).where(User.email == payload.email.lower(), User.id != user_id)
        res_check = await db.execute(stmt_check)
        if res_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email mới đã được sử dụng bởi tài khoản khác",
            )
        user.email = payload.email.lower()

    if payload.full_name:
        user.full_name = payload.full_name.strip()

    if payload.role:
        if user.role == "admin" and payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể thay đổi vai trò của Admin duy nhất.",
            )
        if user.role != "admin":
            user.role = _managed_role(payload.role)

    if payload.password and len(payload.password.strip()) >= 6:
        user.hashed_password = get_password_hash(payload.password.strip())

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
):
    """[ADMIN ONLY] Xóa tài khoản người dùng khỏi hệ thống."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự xóa tài khoản Admin đang đăng nhập",
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản người dùng để xóa",
        )

    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa tài khoản Admin duy nhất.",
        )

    await db.delete(user)
    await db.commit()
