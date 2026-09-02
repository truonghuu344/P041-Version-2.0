import logging
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Notification,
    NotificationPreference,
    User,
)
from src.models.schemas import (
    NotificationCreate,
    NotificationPreferenceUpdate,
)

logger = logging.getLogger(__name__)



class NotificationService:
    """Centralized multi-role two-way notification service."""

    @staticmethod
    async def create_notification(
        db: AsyncSession, data: NotificationCreate
    ) -> Notification:
        notification = Notification(
            recipient_user_id=data.recipient_user_id,
            recipient_role=data.recipient_role,
            actor_user_id=data.actor_user_id,
            actor_role=data.actor_role,
            type=data.type,
            category=data.category,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            title=data.title,
            message=data.message,
            priority=data.priority,
            action_url=data.action_url,
            company_id=data.company_id,
            job_id=data.job_id,
            application_id=data.application_id,
            candidate_id=data.candidate_id,
            advisor_id=data.advisor_id,
            metadata_json=data.metadata_json,
            is_read=False,
        )
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        logger.info("Notification dispatched: recipient=%s, type=%s, title=%s", notification.recipient_user_id, notification.type, notification.title)
        return notification

    @staticmethod
    async def ensure_seed_notifications(db: AsyncSession, user_id: str) -> None:
        """Tự động khởi tạo thông báo ban đầu cho tài khoản nếu chưa có thông báo nào."""
        try:
            total_stmt = select(func.count(Notification.id)).where(Notification.recipient_user_id == user_id)
            count = await db.scalar(total_stmt) or 0
            if count > 0:
                return

            user = await db.scalar(select(User).where(User.id == user_id))
            if not user:
                return

            role = user.role or "student"
            seeds = []
            if role == "student":
                seeds = [
                    Notification(
                        recipient_user_id=user_id,
                        recipient_role="student",
                        actor_role="system",
                        type="WELCOME",
                        category="message",
                        title="Chào mừng bạn đến với Career Assistant!",
                        message="Hãy hoàn thiện hồ sơ và tải lên CV để nhận diện kỹ năng, so khớp việc làm và nhận gợi ý lộ trình phù hợp.",
                        priority="HIGH",
                        action_url="/student/profile",
                        is_read=False,
                    ),
                    Notification(
                        recipient_user_id=user_id,
                        recipient_role="student",
                        actor_role="enterprise",
                        type="JOB_MATCHED",
                        category="job",
                        title="Vị trí tuyển dụng mới phù hợp với bạn",
                        message="Nhiều cơ hội việc làm AI & Software Engineering vừa được doanh nghiệp đối tác đăng tuyển.",
                        priority="MEDIUM",
                        action_url="/student/find-jobs",
                        is_read=False,
                    ),
                    Notification(
                        recipient_user_id=user_id,
                        recipient_role="student",
                        actor_role="counselor",
                        type="ADVISOR_FEEDBACK",
                        category="advisor",
                        title="Cố vấn học tập sẵn sàng hỗ trợ bạn",
                        message="Cố vấn nghề nghiệp luôn sẵn sàng hỗ trợ đánh giá CV và giới thiệu các cơ hội thực tập doanh nghiệp.",
                        priority="LOW",
                        action_url="/student/internship",
                        is_read=False,
                    ),
                ]
            elif role == "counselor":
                seeds = [
                    Notification(
                        recipient_user_id=user_id,
                        recipient_role="counselor",
                        actor_role="system",
                        type="WELCOME",
                        category="message",
                        title="Chào mừng Cố vấn nghề nghiệp!",
                        message="Xem danh sách sinh viên cần định hướng và các cơ hội thực tập từ doanh nghiệp liên kết.",
                        priority="HIGH",
                        action_url="/counselor/students",
                        is_read=False,
                    ),
                ]
            elif role == "admin":
                seeds = [
                    Notification(
                        recipient_user_id=user_id,
                        recipient_role="admin",
                        actor_role="system",
                        type="SYSTEM_ALERT",
                        category="system",
                        title="Hệ thống Career Assistant vận hành ổn định",
                        message="Toàn bộ hệ thống AI Matching, Phân tích CV và Cổng doanh nghiệp đang hoạt động tốt.",
                        priority="MEDIUM",
                        action_url="/admin",
                        is_read=False,
                    ),
                ]

            for s in seeds:
                db.add(s)
            await db.commit()
        except Exception as exc:
            logger.warning("ensure_seed_notifications error: %s", exc)
            await db.rollback()

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: str,
        category: str | None = None,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Notification]:
        await NotificationService.ensure_seed_notifications(db, user_id)
        query = select(Notification).where(Notification.recipient_user_id == user_id)
        if category and category != "all":
            query = query.where(Notification.category == category)
        if unread_only:
            query = query.where(Notification.is_read.is_(False))

        query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
        result = await db.scalars(query)
        return result.all()

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: str) -> tuple[int, int]:
        await NotificationService.ensure_seed_notifications(db, user_id)
        unread_stmt = select(func.count(Notification.id)).where(
            Notification.recipient_user_id == user_id,
            Notification.is_read.is_(False),
        )
        total_stmt = select(func.count(Notification.id)).where(
            Notification.recipient_user_id == user_id
        )
        unread_count = await db.scalar(unread_stmt) or 0
        total_count = await db.scalar(total_stmt) or 0
        return int(unread_count), int(total_count)

    @staticmethod
    async def mark_as_read(
        db: AsyncSession, notification_id: str, user_id: str
    ) -> Notification | None:
        notification = await db.scalar(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.recipient_user_id == user_id,
            )
        )
        if not notification:
            return None
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(notification)
        return notification

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: str) -> int:
        now = datetime.now(UTC)
        stmt = (
            update(Notification)
            .where(
                Notification.recipient_user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount

    @staticmethod
    async def delete_notification(
        db: AsyncSession, notification_id: str, user_id: str
    ) -> bool:
        stmt = delete(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_user_id == user_id,
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def get_or_create_preferences(
        db: AsyncSession, user_id: str
    ) -> NotificationPreference:
        pref = await db.scalar(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        if not pref:
            pref = NotificationPreference(user_id=user_id)
            db.add(pref)
            await db.commit()
            await db.refresh(pref)
        return pref

    @staticmethod
    async def update_preferences(
        db: AsyncSession, user_id: str, update_data: NotificationPreferenceUpdate
    ) -> NotificationPreference:
        pref = await NotificationService.get_or_create_preferences(db, user_id)
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(pref, key, value)
        await db.commit()
        await db.refresh(pref)
        return pref

    # ─────────────────────────────────────────────────────────────
    # Domain Event Triggers: Two-Way Lifecycle between All Roles
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_job_published(
        db: AsyncSession,
        job_id: str,
        job_title: str,
        company_name: str,
        enterprise_user_id: str,
        job_tags: list[str] | None = None,
        job_location: str | None = None,
    ) -> list[Notification]:
        """Dispatch targeted JOB_MATCHED notification only to students with active job alerts."""
        location_str = f" tại {job_location}" if job_location else ""
        metadata = {
            "tags": job_tags or ["Toàn thời gian"],
            "location": job_location or "Toàn quốc",
        }

        # Gửi thông báo tới tất cả sinh viên
        stmt = (
            select(User.id)
            .join(NotificationPreference, NotificationPreference.user_id == User.id, isouter=True)
            .where(
                func.lower(User.role) == "student",
                (NotificationPreference.inapp_job_alerts.is_(True) | NotificationPreference.inapp_job_alerts.is_(None)),
            )
            .limit(500)
        )
        candidate_ids = (await db.scalars(stmt)).all()

        notifications = []
        for cand_id in candidate_ids:
            notif = Notification(
                recipient_user_id=cand_id,
                recipient_role="student",
                actor_user_id=enterprise_user_id,
                actor_role="enterprise",
                type="JOB_MATCHED",
                category="job",
                entity_type="job",
                entity_id=job_id,
                job_id=job_id,
                title="Có công việc mới phù hợp với bạn",
                message=f"{company_name} vừa đăng vị trí {job_title}{location_str}.",
                priority="normal",
                action_url=f"/jobs/{job_id}",
                metadata_json=metadata,
            )
            db.add(notif)
            notifications.append(notif)

        if notifications:
            await db.commit()
        return notifications

    @staticmethod
    async def trigger_application_submitted(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
        student_id: str,
        student_name: str,
        enterprise_user_id: str,
    ) -> tuple[Notification, Notification]:
        """Candidate submits application -> Both Candidate and Recruiter get notified."""
        # 1. Candidate Notification
        cand_notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=enterprise_user_id,
            actor_role="enterprise",
            type="APPLICATION_SUBMITTED",
            category="application",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            title="Đã gửi hồ sơ ứng tuyển",
            message=f"Hồ sơ của bạn đã được gửi tới {company_name} cho vị trí {job_title}.",
            priority="normal",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(cand_notif)

        # 2. Recruiter Notification
        rec_notif = Notification(
            recipient_user_id=enterprise_user_id,
            recipient_role="enterprise",
            actor_user_id=student_id,
            actor_role="student",
            type="APPLICATION_RECEIVED",
            category="application",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            candidate_id=student_id,
            title="Có ứng viên mới",
            message=f"{student_name} vừa ứng tuyển vị trí {job_title}.",
            priority="normal",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(rec_notif)

        await db.commit()
        return cand_notif, rec_notif

    @staticmethod
    async def trigger_application_viewed(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
        student_id: str,
        enterprise_user_id: str,
    ) -> Notification:
        """Recruiter views candidate application -> Candidate gets notified."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=enterprise_user_id,
            actor_role="enterprise",
            type="APPLICATION_VIEWED",
            category="application",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            title="Doanh nghiệp đã xem hồ sơ",
            message=f"{company_name} đã xem hồ sơ {job_title} của bạn.",
            priority="normal",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_application_decision(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
        student_id: str,
        enterprise_user_id: str,
        decision: str,  # 'accepted' | 'shortlisted' | 'rejected'
        next_stage: str | None = None,
    ) -> Notification:
        """Recruiter updates candidate application decision -> Candidate receives polite structured notification."""
        if decision in ("accepted", "shortlisted"):
            next_stage_msg = f" Bước tiếp theo: {next_stage}." if next_stage else ""
            title = "Hồ sơ của bạn đã được duyệt"
            message = f"{company_name} đã chuyển hồ sơ {job_title} của bạn sang bước tiếp theo.{next_stage_msg}"
            priority = "important"
            event_type = "APPLICATION_APPROVED"
        else:
            title = "Cập nhật kết quả ứng tuyển"
            message = f"{company_name} đã cập nhật kết quả ứng tuyển {job_title} của bạn."
            priority = "normal"
            event_type = "APPLICATION_REJECTED"

        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=enterprise_user_id,
            actor_role="enterprise",
            type=event_type,
            category="application",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            title=title,
            message=message,
            priority=priority,
            action_url=f"/jobs/{job_id}/applications/{application_id}",
            metadata_json={"decision": decision, "next_stage": next_stage} if next_stage else None,
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_interview_invited(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
        student_id: str,
        enterprise_user_id: str,
        interview_time: str | None = None,
    ) -> Notification:
        """Recruiter invites candidate to interview -> High priority notification."""
        time_msg = f" Thời gian: {interview_time}." if interview_time else ""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=enterprise_user_id,
            actor_role="enterprise",
            type="INTERVIEW_INVITED",
            category="interview",
            entity_type="interview",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            title="Bạn có lời mời phỏng vấn",
            message=f"{company_name} mời bạn phỏng vấn cho vị trí {job_title}.{time_msg}",
            priority="high",
            action_url=f"/applications/{application_id}/interview",
            metadata_json={"interview_time": interview_time} if interview_time else None,
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_interview_response(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        student_id: str,
        student_name: str,
        enterprise_user_id: str,
        response_status: str = "confirmed",  # confirmed | reschedule_requested
    ) -> Notification:
        """Candidate confirms or reschedules interview -> Recruiter gets notified."""
        if response_status == "confirmed":
            title = "Ứng viên đã phản hồi lịch phỏng vấn"
            message = f"{student_name} đã xác nhận lịch phỏng vấn {job_title}."
        else:
            title = "Ứng viên yêu cầu đổi lịch phỏng vấn"
            message = f"{student_name} đã yêu cầu đổi lịch phỏng vấn cho vị trí {job_title}."

        notif = Notification(
            recipient_user_id=enterprise_user_id,
            recipient_role="enterprise",
            actor_user_id=student_id,
            actor_role="student",
            type="INTERVIEW_CONFIRMED" if response_status == "confirmed" else "INTERVIEW_RESCHEDULED",
            category="interview",
            entity_type="interview",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            candidate_id=student_id,
            title=title,
            message=message,
            priority="high",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_offer_sent(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
        student_id: str,
        enterprise_user_id: str,
    ) -> Notification:
        """Recruiter sends official job offer -> High priority notification."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=enterprise_user_id,
            actor_role="enterprise",
            type="OFFER_SENT",
            category="offer",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            title="Bạn nhận được đề nghị tuyển dụng",
            message=f"{company_name} đã gửi đề nghị cho vị trí {job_title}.",
            priority="high",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_offer_response(
        db: AsyncSession,
        application_id: str,
        job_id: str,
        job_title: str,
        student_id: str,
        student_name: str,
        enterprise_user_id: str,
        accepted: bool = True,
    ) -> Notification:
        """Candidate accepts/declines job offer -> Recruiter receives high priority notification."""
        title = "Ứng viên đã chấp nhận Offer" if accepted else "Ứng viên đã phản hồi Offer"
        message = (
            f"{student_name} đã chấp nhận đề nghị cho vị trí {job_title}."
            if accepted
            else f"{student_name} đã từ chối đề nghị cho vị trí {job_title}."
        )

        notif = Notification(
            recipient_user_id=enterprise_user_id,
            recipient_role="enterprise",
            actor_user_id=student_id,
            actor_role="student",
            type="OFFER_ACCEPTED" if accepted else "OFFER_DECLINED",
            category="offer",
            entity_type="application",
            entity_id=application_id,
            job_id=job_id,
            application_id=application_id,
            candidate_id=student_id,
            title=title,
            message=message,
            priority="high",
            action_url=f"/jobs/{job_id}/applications/{application_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    # ─────────────────────────────────────────────────────────────
    # Advisor ↔ Candidate Two-Way Events
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_advisor_feedback(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        cv_title: str,
        cv_id: str,
    ) -> Notification:
        """Advisor leaves feedback on candidate CV -> Candidate gets notified."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="ADVISOR_FEEDBACK_SENT",
            category="advisor",
            entity_type="cv",
            entity_id=cv_id,
            advisor_id=advisor_id,
            title="Bạn có nhận xét mới từ cố vấn",
            message=f"Cố vấn {advisor_name} đã gửi nhận xét cho CV {cv_title} của bạn.",
            priority="normal",
            action_url=f"/cv/{cv_id}/feedback",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_advisor_job_recommendation(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        job_id: str,
        job_title: str,
        company_name: str,
    ) -> Notification:
        """Advisor recommends a job to Candidate."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="ADVISOR_JOB_RECOMMENDED",
            category="advisor",
            entity_type="job",
            entity_id=job_id,
            job_id=job_id,
            advisor_id=advisor_id,
            title="Cố vấn đề xuất một công việc",
            message=f"{advisor_name} đề xuất vị trí {job_title} tại {company_name} cho bạn.",
            priority="normal",
            action_url=f"/jobs/{job_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_candidate_cv_updated(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        advisor_id: str,
        cv_title: str,
        cv_id: str,
    ) -> Notification:
        """Candidate updates CV following advisor review -> Advisor gets notified."""
        notif = Notification(
            recipient_user_id=advisor_id,
            recipient_role="counselor",
            actor_user_id=student_id,
            actor_role="student",
            type="CANDIDATE_FEEDBACK_RESPONSE",
            category="advisor",
            entity_type="cv",
            entity_id=cv_id,
            candidate_id=student_id,
            title="Ứng viên đã cập nhật nội dung",
            message=f"{student_name} đã cập nhật CV sau nhận xét của bạn.",
            priority="normal",
            action_url=f"/counselor/students/{student_id}/cv/{cv_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_candidate_consultation_confirmed(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        advisor_id: str,
        time_str: str,
    ) -> Notification:
        """Candidate confirms advisory appointment -> Advisor gets notified."""
        notif = Notification(
            recipient_user_id=advisor_id,
            recipient_role="counselor",
            actor_user_id=student_id,
            actor_role="student",
            type="APPOINTMENT_CONFIRMED",
            category="advisor",
            entity_type="advisor_session",
            entity_id=student_id,
            candidate_id=student_id,
            title="Ứng viên đã xác nhận lịch",
            message=f"{student_name} đã xác nhận lịch tư vấn ngày {time_str}.",
            priority="important",
            action_url="/counselor/schedule",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_advisor_candidate_referral(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        student_name: str,
        enterprise_user_id: str,
        job_id: str,
        job_title: str,
    ) -> Notification:
        """Advisor refers candidate to Recruiter (permission-based, after Student consent)."""
        notif = Notification(
            recipient_user_id=enterprise_user_id,
            recipient_role="enterprise",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="ADVISOR_CANDIDATE_REFERRAL",
            category="candidate",
            entity_type="candidate",
            entity_id=student_id,
            job_id=job_id,
            candidate_id=student_id,
            advisor_id=advisor_id,
            title="Ứng viên được Cố vấn tiến cử",
            message=f"{advisor_name} đã tiến cử {student_name} cho vị trí {job_title}.",
            priority="important",
            action_url=f"/jobs/{job_id}/candidates/{student_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    # ─────────────────────────────────────────────────────────────
    # CV & Task Triggers
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_cv_confirmed(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        cv_title: str,
        cv_id: str,
    ) -> Notification:
        """Counselor confirms/validates Student CV -> Student gets notified."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="CV_CONFIRMED",
            category="advisor",
            entity_type="cv",
            entity_id=cv_id,
            advisor_id=advisor_id,
            title="CV đã được Cố vấn xác nhận",
            message=f"Cố vấn {advisor_name} đã xác nhận CV {cv_title} đạt chuẩn ứng tuyển.",
            priority="normal",
            action_url=f"/cv/{cv_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_counselor_task_assigned(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        task_title: str,
        task_id: str,
    ) -> Notification:
        """Counselor creates an improvement task for Student -> Student gets notified."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="COUNSELOR_TASK_ASSIGNED",
            category="advisor",
            entity_type="task",
            entity_id=task_id,
            advisor_id=advisor_id,
            title="Nhiệm vụ mới từ Cố vấn",
            message=task_title,
            priority="normal",
            action_url=f"/cv?task={task_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_student_task_completed(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        advisor_id: str,
        task_title: str,
        task_id: str,
    ) -> Notification:
        """Student finishes improvement task -> Counselor gets notified."""
        notif = Notification(
            recipient_user_id=advisor_id,
            recipient_role="counselor",
            actor_user_id=student_id,
            actor_role="student",
            type="STUDENT_TASK_COMPLETED",
            category="advisor",
            entity_type="task",
            entity_id=task_id,
            candidate_id=student_id,
            title=f"{student_name} đã hoàn thành nhiệm vụ",
            message=f"Sinh viên đã hoàn thành nhiệm vụ: {task_title}.",
            priority="normal",
            action_url=f"/counselor/students/{student_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    # ─────────────────────────────────────────────────────────────
    # Referral Consent Triggers
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_referral_consent_requested(
        db: AsyncSession,
        advisor_id: str,
        advisor_name: str,
        student_id: str,
        company_name: str,
        job_title: str,
        job_id: str,
    ) -> Notification:
        """Counselor asks Student for referral consent -> Student receives HIGH PRIORITY notification."""
        notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=advisor_id,
            actor_role="counselor",
            type="REFERRAL_CONSENT_REQUESTED",
            category="advisor",
            entity_type="job",
            entity_id=job_id,
            job_id=job_id,
            advisor_id=advisor_id,
            title="Yêu cầu đồng ý tiến cử",
            message=f"{advisor_name} muốn tiến cử bạn vào vị trí {job_title} tại {company_name}.",
            priority="high",
            action_url=f"/history?job_id={job_id}",
            metadata_json={"company": company_name, "job_title": job_title},
        )
        db.add(notif)
        await db.commit()
        return notif

    @staticmethod
    async def trigger_referral_consent_response(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        advisor_id: str,
        company_name: str,
        job_id: str,
        accepted: bool = True,
    ) -> Notification:
        """Student accepts/declines referral consent -> Counselor gets notified."""
        if accepted:
            title = "Sinh viên đã đồng ý tiến cử"
            message = f"{student_name} đã đồng ý chia sẻ hồ sơ với {company_name}."
            event_type = "REFERRAL_CONSENT_ACCEPTED"
            priority = "important"
        else:
            title = "Sinh viên từ chối tiến cử"
            message = f"{student_name} từ chối chia sẻ hồ sơ với {company_name}."
            event_type = "REFERRAL_CONSENT_DECLINED"
            priority = "normal"

        notif = Notification(
            recipient_user_id=advisor_id,
            recipient_role="counselor",
            actor_user_id=student_id,
            actor_role="student",
            type=event_type,
            category="advisor",
            entity_type="job",
            entity_id=job_id,
            job_id=job_id,
            candidate_id=student_id,
            title=title,
            message=message,
            priority=priority,
            action_url=f"/counselor/referrals?student_id={student_id}&job_id={job_id}",
        )
        db.add(notif)
        await db.commit()
        return notif

    # ─────────────────────────────────────────────────────────────
    # Talent Request Triggers
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_talent_request_created(
        db: AsyncSession,
        enterprise_user_id: str,
        company_name: str,
        counselor_ids: list[str],
        role_name: str,
        quantity: int,
        deadline: str,
        request_id: str,
    ) -> list[Notification]:
        """Enterprise creates Talent Request -> Assigned Counselors receive notification."""
        notifications = []
        for c_id in counselor_ids:
            notif = Notification(
                recipient_user_id=c_id,
                recipient_role="counselor",
                actor_user_id=enterprise_user_id,
                actor_role="enterprise",
                type="TALENT_REQUEST_CREATED",
                category="candidate",
                entity_type="talent_request",
                entity_id=request_id,
                title="Yêu cầu nhân lực mới",
                message=f"{company_name} cần tuyển {quantity} vị trí {role_name}. Hạn chót: {deadline}.",
                priority="normal",
                action_url="/counselor/opportunities",
                metadata_json={"company": company_name, "role": role_name, "quantity": quantity, "deadline": deadline},
            )
            db.add(notif)
            notifications.append(notif)
        if notifications:
            await db.commit()
        return notifications

    @staticmethod
    async def trigger_talent_request_matched(
        db: AsyncSession,
        counselor_id: str,
        counselor_name: str,
        enterprise_user_id: str,
        department_name: str,
        candidate_count: int,
        role_name: str,
        request_id: str,
    ) -> Notification:
        """Counselor submits matched candidates for Talent Request -> Enterprise gets notified."""
        notif = Notification(
            recipient_user_id=enterprise_user_id,
            recipient_role="enterprise",
            actor_user_id=counselor_id,
            actor_role="counselor",
            type="TALENT_REQUEST_MATCHED",
            category="candidate",
            entity_type="talent_request",
            entity_id=request_id,
            title="Đã có ứng viên cho yêu cầu nhân lực",
            message=f"{department_name} đã giới thiệu {candidate_count} sinh viên cho yêu cầu {role_name}.",
            priority="important",
            action_url="/enterprise/referrals",
        )
        db.add(notif)
        await db.commit()
        return notif

    # ─────────────────────────────────────────────────────────────
    # Internship Event Triggers
    # ─────────────────────────────────────────────────────────────

    @staticmethod
    async def trigger_internship_report_submitted(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        mentor_user_id: str,
        counselor_user_id: str,
        week_num: int,
        internship_id: str,
    ) -> tuple[Notification, Notification]:
        """Student submits weekly internship report -> Enterprise Mentor and Counselor get notified."""
        # 1. Mentor Notification
        mentor_notif = Notification(
            recipient_user_id=mentor_user_id,
            recipient_role="enterprise",
            actor_user_id=student_id,
            actor_role="student",
            type="INTERNSHIP_REPORT_SUBMITTED",
            category="application",
            entity_type="internship_report",
            entity_id=internship_id,
            candidate_id=student_id,
            title="Có báo cáo tuần mới cần đánh giá",
            message=f"{student_name} đã nộp báo cáo tuần {week_num}.",
            priority="normal",
            action_url=f"/enterprise/internships/{internship_id}",
        )
        db.add(mentor_notif)

        # 2. Counselor Notification
        counselor_notif = Notification(
            recipient_user_id=counselor_user_id,
            recipient_role="counselor",
            actor_user_id=student_id,
            actor_role="student",
            type="INTERNSHIP_REPORT_SUBMITTED",
            category="advisor",
            entity_type="internship_report",
            entity_id=internship_id,
            candidate_id=student_id,
            title="Sinh viên đã nộp báo cáo tuần",
            message=f"{student_name} đã nộp báo cáo tuần {week_num}.",
            priority="normal",
            action_url=f"/counselor/internships/{internship_id}",
        )
        db.add(counselor_notif)

        await db.commit()
        return mentor_notif, counselor_notif

    @staticmethod
    async def trigger_internship_report_evaluated(
        db: AsyncSession,
        mentor_user_id: str,
        mentor_name: str,
        student_id: str,
        counselor_user_id: str,
        student_name: str,
        week_num: int,
        internship_id: str,
    ) -> tuple[Notification, Notification]:
        """Mentor evaluates weekly report -> Student and Counselor get notified."""
        # 1. Student Notification
        student_notif = Notification(
            recipient_user_id=student_id,
            recipient_role="student",
            actor_user_id=mentor_user_id,
            actor_role="enterprise",
            type="INTERNSHIP_REPORT_EVALUATED",
            category="application",
            entity_type="internship_report",
            entity_id=internship_id,
            title=f"Mentor đã nhận xét báo cáo tuần {week_num}",
            message=f"Mentor {mentor_name} đã gửi đánh giá và nhận xét cho báo cáo tuần {week_num} của bạn.",
            priority="normal",
            action_url="/history",
        )
        db.add(student_notif)

        # 2. Counselor Notification
        counselor_notif = Notification(
            recipient_user_id=counselor_user_id,
            recipient_role="counselor",
            actor_user_id=mentor_user_id,
            actor_role="enterprise",
            type="INTERNSHIP_MENTOR_EVALUATED",
            category="advisor",
            entity_type="internship_report",
            entity_id=internship_id,
            candidate_id=student_id,
            title=f"Doanh nghiệp đã gửi đánh giá tuần {week_num}",
            message=f"Mentor {mentor_name} đã hoàn tất đánh giá tuần {week_num} cho {student_name}.",
            priority="normal",
            action_url=f"/counselor/internships/{internship_id}",
        )
        db.add(counselor_notif)

        await db.commit()
        return student_notif, counselor_notif

    @staticmethod
    async def trigger_internship_report_reminder(
        db: AsyncSession,
        student_id: str,
        student_name: str,
        counselor_user_id: str | None,
        week_num: int,
        status_type: str,  # 'due_soon' | 'overdue'
        internship_id: str,
    ) -> list[Notification]:
        """System/Cron triggers internship report deadline reminders."""
        notifications = []
        if status_type == "overdue":
            # Student Warning/Danger
            st_notif = Notification(
                recipient_user_id=student_id,
                recipient_role="student",
                actor_user_id=None,
                actor_role=None,
                type="INTERNSHIP_REPORT_OVERDUE",
                category="application",
                entity_type="internship_report",
                entity_id=internship_id,
                title=f"Báo cáo tuần {week_num} đã quá hạn",
                message=f"Hạn chót nộp báo cáo tuần {week_num} đã qua. Vui lòng nộp ngay để không bị ảnh hưởng đánh giá.",
                priority="high",
                action_url=f"/student/internship/{internship_id}",
            )
            db.add(st_notif)
            notifications.append(st_notif)

            # Counselor Danger alert
            if counselor_user_id:
                co_notif = Notification(
                    recipient_user_id=counselor_user_id,
                    recipient_role="counselor",
                    actor_user_id=None,
                    actor_role=None,
                    type="INTERNSHIP_STUDENT_OVERDUE",
                    category="advisor",
                    entity_type="internship_report",
                    entity_id=internship_id,
                    candidate_id=student_id,
                    title="Báo cáo thực tập quá hạn",
                    message=f"{student_name} chưa nộp báo cáo tuần {week_num}.",
                    priority="high",
                    action_url=f"/counselor/internships/{internship_id}",
                )
                db.add(co_notif)
                notifications.append(co_notif)
        else:
            # Student Due Soon Warning
            st_notif = Notification(
                recipient_user_id=student_id,
                recipient_role="student",
                actor_user_id=None,
                actor_role=None,
                type="INTERNSHIP_REPORT_DUE_SOON",
                category="application",
                entity_type="internship_report",
                entity_id=internship_id,
                title=f"Báo cáo tuần {week_num} sắp đến hạn",
                message=f"Báo cáo thực tập tuần {week_num} cần được nộp trước hạn chót.",
                priority="normal",
                action_url=f"/student/internship/{internship_id}",
            )
            db.add(st_notif)
            notifications.append(st_notif)

        if notifications:
            await db.commit()
        return notifications

