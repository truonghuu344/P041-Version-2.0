import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.core.email_identity import canonicalize_email, find_user_by_email
from src.core.security import get_password_hash, require_role
from src.db.database import get_db
from src.db.models import (
    AIAuditLog,
    CounselorAssignment,
    CounselorProfile,
    JobApplication,
    JobDescription,
    Notification,
    StudentInternship,
    UsageEvent,
    User,
)
from src.models.schemas import (
    AdminAILogListOut,
    AdminAILogOut,
    AdminAILogStatsOut,
    AdminAuditLogListOut,
    AdminAuditLogOut,
    AdminBroadcastOut,
    AdminBroadcastRequest,
    AdminJobOut,
    AdminNotificationListOut,
    AdminNotificationOut,
    AdminUserCreate,
    AdminUserPageOut,
    CounselorAssignmentOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin User Management"])
MANAGED_ROLES = {"student", "counselor"}

logger = logging.getLogger("admin_portal")


def _managed_role(role: str) -> str:
    if role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hệ thống chỉ có một Admin. Không thể cấp quyền Admin cho tài khoản khác.",
        )
    return role if role in MANAGED_ROLES else "student"


@router.get("/users", response_model=list[UserOut])
async def list_all_users(
    search: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> list[UserOut]:
    """[ADMIN ONLY] Xem danh sách toàn bộ người dùng trong hệ thống."""
    filters = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if role in {"student", "counselor", "admin"}:
        filters.append(User.role == role)
    stmt = select(User).where(*filters).order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/dashboard", response_model=dict)
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> dict:
    """Operational overview backed by the same persisted entities as the role portals."""
    counts = {
        "users": int(await db.scalar(select(func.count(User.id))) or 0),
        "students": int(await db.scalar(select(func.count(User.id)).where(User.role == "student")) or 0),
        "counselors": int(await db.scalar(select(func.count(User.id)).where(User.role == "counselor")) or 0),
        "jobs": int(await db.scalar(select(func.count(JobDescription.id)).where(JobDescription.is_system.is_(False))) or 0),
        "applications": int(await db.scalar(select(func.count(JobApplication.id))) or 0),
        "internships": int(await db.scalar(select(func.count(StudentInternship.id))) or 0),
        "unread_notifications": int(await db.scalar(select(func.count(Notification.id)).where(Notification.is_read.is_(False))) or 0),
        "delayed_reports": int(
            await db.scalar(
                select(func.count(StudentInternship.id)).where(
                    StudentInternship.last_report_status == "delayed",
                    StudentInternship.status == "ongoing",
                )
            ) or 0
        ),
        "referrals": int(
            await db.scalar(
                select(func.count(JobApplication.id)).where(
                    JobApplication.source == "counselor_referral"
                )
            ) or 0
        ),
    }
    recent = (await db.execute(
        select(UsageEvent, User).join(User, User.id == UsageEvent.user_id, isouter=True)
        .order_by(UsageEvent.created_at.desc()).limit(12)
    )).all()
    return {"counts": counts, "recent_activity": [
        {"id": event.id, "event": event.event_name, "user_name": user.full_name if user else None,
         "created_at": event.created_at, "metadata": event.metadata_json or {}}
        for event, user in recent
    ]}


@router.get("/counselors", response_model=list[dict])
async def admin_counselors(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> list[dict]:
    rows = (await db.execute(select(User, CounselorProfile).join(CounselorProfile, CounselorProfile.user_id == User.id, isouter=True).where(User.role == "counselor").order_by(User.created_at.desc()))).all()
    result = []
    for user, profile in rows:
        assigned = await db.scalar(select(func.count(CounselorAssignment.id)).where(CounselorAssignment.counselor_id == user.id, CounselorAssignment.status == "active")) or 0
        result.append({"id": user.id, "name": user.full_name, "email": user.email, "created_at": user.created_at,
                       "title": profile.role_title if profile else None, "active_assignments": int(assigned)})
    return result


@router.get("/counselors/{counselor_id}/assignments", response_model=list[CounselorAssignmentOut])
async def admin_counselor_assignments(
    counselor_id: str,
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> list[CounselorAssignmentOut]:
    """[ADMIN ONLY] Danh sách phân công giữa cố vấn và sinh viên."""
    counselor = (
        await db.execute(select(User).where(User.id == counselor_id, User.role == "counselor"))
    ).scalar_one_or_none()
    if not counselor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cố vấn")

    filters = [CounselorAssignment.counselor_id == counselor_id]
    if status_filter in {"active", "revoked"}:
        filters.append(CounselorAssignment.status == status_filter)
    rows = (
        await db.execute(
            select(CounselorAssignment, User)
            .join(User, User.id == CounselorAssignment.student_id)
            .where(*filters)
            .order_by(CounselorAssignment.consented_at.desc())
        )
    ).all()
    return [
        CounselorAssignmentOut(
            id=assignment.id,
            counselor_id=counselor.id,
            counselor_name=counselor.full_name,
            counselor_email=counselor.email,
            student_id=student.id,
            student_name=student.full_name,
            student_email=student.email,
            status=assignment.status,
            consented_at=assignment.consented_at,
            revoked_at=assignment.revoked_at,
        )
        for assignment, student in rows
    ]


@router.get("/recruitment", response_model=dict)
async def admin_recruitment(
    limit: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> dict:
    jobs = (await db.execute(select(JobDescription, User).join(User, User.id == JobDescription.created_by_user_id).where(JobDescription.is_system.is_(False)).order_by(JobDescription.created_at.desc()).limit(limit))).all()
    applications = (await db.execute(select(JobApplication, User, JobDescription).join(User, User.id == JobApplication.student_id).join(JobDescription, JobDescription.id == JobApplication.jd_id).order_by(JobApplication.shared_at.desc()).limit(limit))).all()
    # Referral channel: applications submitted by counselors on behalf of students.
    student_user = aliased(User)
    counselor_user = aliased(User)
    referrals = (await db.execute(
        select(JobApplication, student_user, JobDescription, counselor_user)
        .join(student_user, student_user.id == JobApplication.student_id)
        .join(JobDescription, JobDescription.id == JobApplication.jd_id)
        .join(counselor_user, counselor_user.id == JobApplication.referred_by_counselor_id, isouter=True)
        .where(JobApplication.source == "counselor_referral")
        .order_by(JobApplication.shared_at.desc())
        .limit(limit)
    )).all()
    status_counts = dict(
        (await db.execute(
            select(JobApplication.status, func.count(JobApplication.id))
            .group_by(JobApplication.status)
        )).all()
    )
    return {
        "jobs": [{"id": jd.id, "title": jd.title, "company": jd.company, "is_published": jd.is_published, "enterprise": owner.full_name, "created_at": jd.created_at} for jd, owner in jobs],
        "applications": [{"id": app.id, "job_title": jd.title, "student": student.full_name, "status": app.status, "source": app.source, "match_score": app.match_score, "created_at": app.shared_at} for app, student, jd in applications],
        "referrals": [{"id": app.id, "job_title": jd.title, "student": student.full_name,
                       "counselor": counselor.full_name if counselor else None,
                       "status": app.status, "match_score": app.match_score, "created_at": app.shared_at}
                      for app, student, jd, counselor in referrals],
        "stats": {
            "total_jobs": int(await db.scalar(select(func.count(JobDescription.id)).where(JobDescription.is_system.is_(False))) or 0),
            "published_jobs": int(await db.scalar(select(func.count(JobDescription.id)).where(JobDescription.is_system.is_(False), JobDescription.is_published.is_(True))) or 0),
            "total_applications": int(await db.scalar(select(func.count(JobApplication.id))) or 0),
            "total_referrals": int(await db.scalar(select(func.count(JobApplication.id)).where(JobApplication.source == "counselor_referral")) or 0),
            "applications_by_status": {key: int(value) for key, value in status_counts.items()},
        },
    }


@router.get("/internships", response_model=list[dict])
async def admin_internships(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> list[dict]:
    rows = (await db.execute(select(StudentInternship, User).join(User, User.id == StudentInternship.student_id).order_by(StudentInternship.updated_at.desc()))).all()
    return [{"id": item.id, "student": student.full_name, "company": item.company_name, "position": item.position,
             "progress_percent": item.progress_percent, "last_report_status": item.last_report_status, "status": item.status,
             "updated_at": item.updated_at} for item, student in rows]


@router.get("/internships/summary", response_model=dict)
async def admin_internships_summary(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> dict:
    """[ADMIN ONLY] Tổng quan thực tập: số lượt, trạng thái và báo cáo."""
    status_counts = dict(
        (await db.execute(
            select(StudentInternship.status, func.count(StudentInternship.id))
            .group_by(StudentInternship.status)
        )).all()
    )
    report_counts = dict(
        (await db.execute(
            select(StudentInternship.last_report_status, func.count(StudentInternship.id))
            .group_by(StudentInternship.last_report_status)
        )).all()
    )
    evaluated = int(
        await db.scalar(
            select(func.count(StudentInternship.id)).where(StudentInternship.final_evaluation_json.isnot(None))
        ) or 0
    )
    return {
        "total": int(await db.scalar(select(func.count(StudentInternship.id))) or 0),
        "by_status": {key: int(value) for key, value in status_counts.items()},
        "reports_by_status": {key: int(value) for key, value in report_counts.items()},
        "evaluated": evaluated,
    }


@router.get("/internships/{internship_id}", response_model=dict)
async def admin_internship_detail(
    internship_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> dict:
    """[ADMIN ONLY] Chi tiết một kỳ thực tập: tiến độ, báo cáo tuần và đánh giá cuối."""
    row = (
        await db.execute(
            select(StudentInternship, User)
            .join(User, User.id == StudentInternship.student_id)
            .where(StudentInternship.id == internship_id)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy kỳ thực tập")
    item, student = row
    return {
        "id": item.id,
        "student": student.full_name,
        "student_email": student.email,
        "company": item.company_name,
        "position": item.position,
        "location": item.location,
        "mentor_name": item.mentor_name,
        "mentor_email": item.mentor_email,
        "current_week": item.current_week,
        "total_weeks": item.total_weeks,
        "progress_percent": item.progress_percent,
        "status": item.status,
        "status_label": item.status_label,
        "last_report_status": item.last_report_status,
        "weekly_reports": item.weekly_reports_json or [],
        "final_evaluation": item.final_evaluation_json,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("/system", response_model=dict)
async def admin_system(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> dict:
    notification_categories = dict(
        (await db.execute(
            select(Notification.category, func.count(Notification.id))
            .group_by(Notification.category)
        )).all()
    )
    return {"notification_count": int(await db.scalar(select(func.count(Notification.id))) or 0),
            "unread_notification_count": int(await db.scalar(select(func.count(Notification.id)).where(Notification.is_read.is_(False))) or 0),
            "ai_log_count": int(await db.scalar(select(func.count(AIAuditLog.id))) or 0),
            "usage_event_count": int(await db.scalar(select(func.count(UsageEvent.id))) or 0),
            "internship_count": int(await db.scalar(select(func.count(StudentInternship.id))) or 0),
            "notification_categories": {key: int(value) for key, value in notification_categories.items()}}


@router.get("/audit-logs", response_model=AdminAuditLogListOut)
async def admin_audit_logs(
    search: str | None = Query(default=None, max_length=120),
    event: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> AdminAuditLogListOut:
    """[ADMIN ONLY] Nhật ký hoạt động hệ thống (UsageEvent) có lọc và phân trang."""
    filters = []
    if event:
        filters.append(UsageEvent.event_name == event.strip())
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(UsageEvent.event_name.ilike(pattern), User.full_name.ilike(pattern)))
    total = int(
        await db.scalar(
            select(func.count(UsageEvent.id)).select_from(UsageEvent).join(User, User.id == UsageEvent.user_id, isouter=True).where(*filters)
        ) or 0
    )
    rows = (
        await db.execute(
            select(UsageEvent, User)
            .join(User, User.id == UsageEvent.user_id, isouter=True)
            .where(*filters)
            .order_by(UsageEvent.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return AdminAuditLogListOut(
        items=[
            AdminAuditLogOut(
                id=event_row.id,
                event_name=event_row.event_name,
                user_id=event_row.user_id,
                user_name=user.full_name if user else None,
                duration_ms=event_row.duration_ms,
                metadata_json=event_row.metadata_json or {},
                created_at=event_row.created_at,
            )
            for event_row, user in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/notifications", response_model=AdminNotificationListOut)
async def admin_notifications(
    category: str | None = Query(default=None, max_length=50),
    role: str | None = Query(default=None, max_length=50),
    unread_only: bool = Query(default=False),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> AdminNotificationListOut:
    """[ADMIN ONLY] Theo dõi toàn bộ thông báo hệ thống theo vai trò và danh mục."""
    filters = []
    if category and category != "all":
        filters.append(Notification.category == category)
    if role in {"student", "counselor", "admin"}:
        filters.append(Notification.recipient_role == role)
    if unread_only:
        filters.append(Notification.is_read.is_(False))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(Notification.title.ilike(pattern), Notification.message.ilike(pattern)))
    total = int(await db.scalar(select(func.count(Notification.id)).where(*filters)) or 0)
    rows = (
        await db.execute(
            select(Notification, User)
            .join(User, User.id == Notification.recipient_user_id, isouter=True)
            .where(*filters)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return AdminNotificationListOut(
        items=[
            AdminNotificationOut(
                id=notification.id,
                recipient_user_id=notification.recipient_user_id,
                recipient_name=user.full_name if user else None,
                recipient_role=notification.recipient_role,
                type=notification.type,
                category=notification.category,
                title=notification.title,
                message=notification.message,
                is_read=notification.is_read,
                priority=notification.priority,
                created_at=notification.created_at,
            )
            for notification, user in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/notifications/broadcast", response_model=AdminBroadcastOut, status_code=status.HTTP_201_CREATED)
async def admin_broadcast_notification(
    payload: AdminBroadcastRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> AdminBroadcastOut:
    """[ADMIN ONLY] Gửi thông báo nền tảng tới mọi tài khoản thuộc các vai trò chọn."""
    recipients = (
        await db.execute(select(User).where(User.role.in_(payload.target_roles)))
    ).scalars().all()
    for recipient in recipients:
        db.add(
            Notification(
                recipient_user_id=recipient.id,
                recipient_role=recipient.role,
                actor_user_id=admin_user.id,
                actor_role="admin",
                type="admin_broadcast",
                category="system",
                entity_type="message",
                title=payload.title,
                message=payload.message,
                priority=payload.priority,
                action_url="/notifications",
            )
        )
    # Single transaction for the whole fan-out: either every recipient gets the
    # announcement or none does.
    await db.commit()
    logger.info(
        "Admin broadcast sent: recipients=%d roles=%s admin=%s title=%r",
        len(recipients),
        ",".join(payload.target_roles),
        admin_user.id,
        payload.title[:80],
    )
    return AdminBroadcastOut(delivered=len(recipients), target_roles=list(payload.target_roles), title=payload.title)


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
        .where(JobDescription.is_system.is_(False))
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
    row = await db.execute(
        select(JobDescription, User, func.count(JobApplication.id))
        .join(User, User.id == JobDescription.created_by_user_id)
        .outerjoin(JobApplication, JobApplication.jd_id == JobDescription.id)
        .where(JobDescription.id == jd_id, JobDescription.is_system.is_(False))
        .group_by(JobDescription.id, User.id)
    )
    item = row.first()
    if not item:
        raise HTTPException(status_code=404, detail="Khong tim thay tin tuyen dung doanh nghiep.")
    jd, enterprise, application_count = item
    jd.is_published = is_published
    await db.commit()
    await db.refresh(jd)
    logger.info(
        "Admin toggled job publication: jd=%s published=%s admin=%s",
        jd_id,
        is_published,
        admin_user.id,
    )
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

@router.get("/users/page", response_model=AdminUserPageOut)
async def list_users_page(
    search: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(["admin"])),
) -> AdminUserPageOut:
    """[ADMIN ONLY] Danh sách tài khoản có phân trang cho console quản trị."""
    filters = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if role in {"student", "counselor", "admin"}:
        filters.append(User.role == role)
    total = int(await db.scalar(select(func.count(User.id)).where(*filters)) or 0)
    rows = (
        await db.execute(
            select(User).where(*filters).order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
    ).scalars().all()
    return AdminUserPageOut(items=list(rows), total=total, limit=limit, offset=offset)


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
    payload: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role(["admin"])),
) -> UserOut:
    """[ADMIN ONLY] Cấp tài khoản Student hoặc Counselor; không thể tạo Admin thứ hai.

    Đây là con đường DUY NHẤT để tạo tài khoản Cố vấn — cố vấn không tự đăng ký
    công khai được (public register chỉ mở cho student/enterprise).
    """
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
    logger.info("Admin created account: user=%s role=%s admin=%s", new_user.id, role, admin_user.id)
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
    logger.info("Admin updated account: user=%s admin=%s", user_id, admin_user.id)
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
    logger.info("Admin deleted account: user=%s role=%s admin=%s", user_id, user.role, admin_user.id)
