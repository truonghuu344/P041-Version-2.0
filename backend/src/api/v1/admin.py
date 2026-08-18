from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.email_identity import canonicalize_email, find_user_by_email
from src.core.security import get_password_hash, require_role
from src.db.database import get_db
from src.db.models import AIAuditLog, JobApplication, JobDescription, User
from src.models.schemas import (
    AdminAILogListOut,
    AdminAILogOut,
    AdminAILogStatsOut,
    AdminJobOut,
    UserOut,
    UserRegister,
    UserUpdate,
)

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


@router.get("/jobs", response_model=list[AdminJobOut])
async def list_enterprise_jobs(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> list[AdminJobOut]:
    """Admin overview of every recruiter posting, including the owning employer."""
    del admin_user
    rows = await db.execute(
        select(JobDescription, User, func.count(JobApplication.id))
        .join(User, User.id == JobDescription.created_by_user_id)
        .outerjoin(JobApplication, JobApplication.jd_id == JobDescription.id)
        .where(JobDescription.is_system.is_(False), User.role == "enterprise")
        .group_by(JobDescription.id, User.id)
        .order_by(JobDescription.created_at.desc())
    )
    return [
        AdminJobOut(
            id=jd.id,
            title=jd.title,
            company=jd.company,
            location=jd.location,
            is_published=jd.is_published,
            created_at=jd.created_at,
            enterprise_id=enterprise.id,
            enterprise_name=enterprise.full_name,
            enterprise_email=enterprise.email,
            application_count=application_count,
        )
        for jd, enterprise, application_count in rows.all()
    ]


@router.patch("/jobs/{jd_id}/publication", response_model=AdminJobOut)
async def set_job_publication(
    jd_id: str,
    is_published: bool,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> AdminJobOut:
    """Moderate a recruiter posting without changing its owner or content."""
    del admin_user
    row = await db.execute(
        select(JobDescription, User, func.count(JobApplication.id))
        .join(User, User.id == JobDescription.created_by_user_id)
        .outerjoin(JobApplication, JobApplication.jd_id == JobDescription.id)
        .where(JobDescription.id == jd_id, JobDescription.is_system.is_(False), User.role == "enterprise")
        .group_by(JobDescription.id, User.id)
    )
    item = row.first()
    if not item:
        raise HTTPException(status_code=404, detail="Khong tim thay tin tuyen dung doanh nghiep.")
    jd, enterprise, application_count = item
    jd.is_published = is_published
    await db.commit()
    await db.refresh(jd)
    return AdminJobOut(
        id=jd.id, title=jd.title, company=jd.company, location=jd.location,
        is_published=jd.is_published, created_at=jd.created_at,
        enterprise_id=enterprise.id, enterprise_name=enterprise.full_name,
        enterprise_email=enterprise.email, application_count=application_count,
    )


@router.get("/ai-logs/stats", response_model=AdminAILogStatsOut)
async def get_ai_log_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> AdminAILogStatsOut:
    total = await db.scalar(select(func.count(AIAuditLog.id))) or 0
    successful = await db.scalar(
        select(func.count(AIAuditLog.id)).where(AIAuditLog.llm_succeeded.is_(True))
    ) or 0
    unique_users = await db.scalar(select(func.count(func.distinct(AIAuditLog.user_id)))) or 0
    return AdminAILogStatsOut(
        total_requests=total,
        successful_requests=successful,
        failed_requests=total - successful,
        unique_users=unique_users,
    )


@router.get("/ai-logs", response_model=AdminAILogListOut)
async def list_ai_logs(
    search: str | None = Query(default=None, max_length=200),
    success: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> AdminAILogListOut:
    filters = []
    if success is not None:
        filters.append(AIAuditLog.llm_succeeded.is_(success))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
                AIAuditLog.prompt.ilike(pattern),
            )
        )

    total = await db.scalar(
        select(func.count(AIAuditLog.id)).join(User).where(*filters)
    ) or 0
    rows = (
        await db.execute(
            select(AIAuditLog, User)
            .join(User, User.id == AIAuditLog.user_id)
            .where(*filters)
            .order_by(AIAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return AdminAILogListOut(
        items=[
            AdminAILogOut(
                id=log.id,
                user_id=user.id,
                user_email=user.email,
                user_full_name=user.full_name,
                conversation_id=log.conversation_id,
                prompt=log.prompt,
                response=log.response,
                provider=log.provider,
                model=log.model,
                llm_succeeded=log.llm_succeeded,
                error_code=log.error_code,
                current_page=log.current_page,
                latency_ms=log.latency_ms,
                tools_used=log.tools_used_json or [],
                created_at=log.created_at,
            )
            for log, user in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )

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
    existing_user = await find_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã tồn tại trong hệ thống",
        )

    role = _managed_role(payload.role)

    new_user = User(
        email=canonicalize_email(payload.email),
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

    if payload.email and canonicalize_email(payload.email) != user.email:
        # Check if new email is taken
        if await find_user_by_email(db, payload.email, exclude_user_id=user_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email mới đã được sử dụng bởi tài khoản khác",
            )
        user.email = canonicalize_email(payload.email)

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
