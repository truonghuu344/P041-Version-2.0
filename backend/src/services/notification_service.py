from datetime import UTC, datetime
from typing import Any, Sequence

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CV,
    JobApplication,
    JobDescription,
    Notification,
    NotificationPreference,
    User,
)
from src.models.schemas import (
    NotificationCreate,
    NotificationPreferenceUpdate,
)


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
        return notification

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: str,
        category: str | None = None,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Notification]:
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

        # Query candidates who opted in
        stmt = (
            select(User.id)
            .join(NotificationPreference, NotificationPreference.user_id == User.id, isouter=True)
            .where(
                User.role == "student",
                (NotificationPreference.inapp_job_alerts.is_(True) | NotificationPreference.inapp_job_alerts.is_(None)),
            )
            .limit(20)  # limit batch size
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
            action_url=f"/counselor/schedule",
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
        """Advisor refers candidate to Recruiter (permission-based)."""
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
            title="Cố vấn đã giới thiệu ứng viên",
            message=f"Cố vấn {advisor_name} đã giới thiệu {student_name} cho vị trí {job_title}.",
            priority="important",
            action_url=f"/jobs/{job_id}/candidates/{student_id}",
        )
        db.add(notif)
        await db.commit()
        return notif
