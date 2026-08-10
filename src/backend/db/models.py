from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

json_type = JSON().with_variant(JSONB, "postgresql")


class UserRole(StrEnum):
    STUDENT = "student"
    COUNSELOR = "counselor"
    ENTERPRISE = "enterprise"
    ADMIN = "admin"


class JobDescriptionSource(StrEnum):
    INTERNAL = "internal"
    EXTERNAL = "external"


class InterviewStatus(StrEnum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column("hashed_password", String(255), nullable=True)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=UserRole.STUDENT,
        server_default=UserRole.STUDENT.value,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    student: Mapped[Student | None] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)
    counselor: Mapped[Counselor | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    enterprise: Mapped[Enterprise | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class Student(TimestampMixin, Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    university: Mapped[str | None] = mapped_column(String(255))
    major: Mapped[str | None] = mapped_column(String(255))
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    phone: Mapped[str | None] = mapped_column(String(32))

    user: Mapped[User] = relationship(back_populates="student")
    resumes: Mapped[list[Resume]] = relationship(back_populates="student", cascade="all, delete-orphan")
    interview_sessions: Mapped[list[InterviewSession]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
    counselor_feedbacks: Mapped[list[CounselorFeedback]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )


class Counselor(TimestampMixin, Base):
    __tablename__ = "counselors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    department: Mapped[str | None] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="counselor")
    feedbacks: Mapped[list[CounselorFeedback]] = relationship(back_populates="counselor", cascade="all, delete-orphan")


class Enterprise(TimestampMixin, Base):
    __tablename__ = "enterprises"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str | None] = mapped_column(String(255))
    website_url: Mapped[str | None] = mapped_column(String(2048))

    user: Mapped[User] = relationship(back_populates="enterprise")
    job_descriptions: Mapped[list[JobDescription]] = relationship(
        back_populates="enterprise", cascade="all, delete-orphan"
    )


class Resume(TimestampMixin, Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    template_id: Mapped[str | None] = mapped_column(String(100))
    raw_file_path: Mapped[str | None] = mapped_column(String(2048))
    parsed_content: Mapped[dict[str, Any]] = mapped_column(json_type, default=dict)
    accepted_suggestions: Mapped[list[dict[str, Any]]] = mapped_column(json_type, default=list)
    missing_information: Mapped[list[str]] = mapped_column(json_type, default=list)
    is_verified_real: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    student: Mapped[Student] = relationship(back_populates="resumes")
    matches: Mapped[list[CvJdMatch]] = relationship(back_populates="resume", cascade="all, delete-orphan")
    interview_sessions: Mapped[list[InterviewSession]] = relationship(back_populates="resume")


class JobDescription(TimestampMixin, Base):
    __tablename__ = "job_descriptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    enterprise_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("enterprises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), index=True)
    description_text: Mapped[str] = mapped_column(Text)
    required_skills: Mapped[list[str]] = mapped_column(json_type, default=list)
    source_type: Mapped[JobDescriptionSource] = mapped_column(
        Enum(
            JobDescriptionSource,
            name="job_description_source",
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=JobDescriptionSource.EXTERNAL,
        server_default=JobDescriptionSource.EXTERNAL.value,
    )
    vector_id: Mapped[str | None] = mapped_column(String(255), unique=True)

    enterprise: Mapped[Enterprise | None] = relationship(back_populates="job_descriptions")
    matches: Mapped[list[CvJdMatch]] = relationship(back_populates="job_description", cascade="all, delete-orphan")
    interview_sessions: Mapped[list[InterviewSession]] = relationship(back_populates="job_description")


class CvJdMatch(TimestampMixin, Base):
    __tablename__ = "cv_jd_matches"
    __table_args__ = (
        CheckConstraint("match_score >= 0 AND match_score <= 100", name="ck_match_score_range"),
        CheckConstraint("ats_score >= 0 AND ats_score <= 100", name="ck_ats_score_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    job_description_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="CASCADE"), index=True
    )
    match_score: Mapped[float] = mapped_column(Float)
    ats_score: Mapped[float] = mapped_column(Float)
    missing_skills: Mapped[list[str]] = mapped_column(json_type, default=list)
    guardrail_flags: Mapped[list[str]] = mapped_column(json_type, default=list)
    gap_analysis: Mapped[dict[str, Any]] = mapped_column(json_type, default=dict)

    resume: Mapped[Resume] = relationship(back_populates="matches")
    job_description: Mapped[JobDescription] = relationship(back_populates="matches")


class InterviewSession(TimestampMixin, Base):
    __tablename__ = "interview_sessions"
    __table_args__ = (
        CheckConstraint("total_questions >= 1", name="ck_interview_total_questions"),
        CheckConstraint("current_step >= 0", name="ck_interview_current_step"),
        CheckConstraint(
            "overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)",
            name="ck_interview_overall_score_range",
        ),
        CheckConstraint(
            "csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)",
            name="ck_interview_csat_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="RESTRICT"), index=True)
    job_description_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="RESTRICT"), index=True
    )
    total_questions: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    current_step: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[InterviewStatus] = mapped_column(
        Enum(
            InterviewStatus,
            name="interview_status",
            native_enum=False,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=InterviewStatus.CREATED,
        server_default=InterviewStatus.CREATED.value,
        index=True,
    )
    overall_score: Mapped[float | None] = mapped_column(Float)
    csat_score: Mapped[int | None] = mapped_column(Integer)
    csat_feedback: Mapped[str | None] = mapped_column(Text)

    student: Mapped[Student] = relationship(back_populates="interview_sessions")
    resume: Mapped[Resume] = relationship(back_populates="interview_sessions")
    job_description: Mapped[JobDescription] = relationship(back_populates="interview_sessions")
    qa_logs: Mapped[list[InterviewQALog]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="InterviewQALog.question_number"
    )
    evaluation_report: Mapped[EvaluationReport | None] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )
    counselor_feedbacks: Mapped[list[CounselorFeedback]] = relationship(back_populates="session")


class InterviewQALog(TimestampMixin, Base):
    __tablename__ = "interview_qa_logs"
    __table_args__ = (
        UniqueConstraint("session_id", "question_number", name="uq_session_question_number"),
        CheckConstraint("question_number >= 1", name="ck_question_number_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    question_number: Mapped[int] = mapped_column(Integer)
    question_text: Mapped[str] = mapped_column(Text)
    student_answer: Mapped[str | None] = mapped_column(Text)
    situation_text: Mapped[str | None] = mapped_column(Text)
    task_text: Mapped[str | None] = mapped_column(Text)
    action_text: Mapped[str | None] = mapped_column(Text)
    result_text: Mapped[str | None] = mapped_column(Text)
    is_followup_required: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    star_scores: Mapped[dict[str, Any]] = mapped_column(json_type, default=dict)

    session: Mapped[InterviewSession] = relationship(back_populates="qa_logs")


class EvaluationReport(TimestampMixin, Base):
    __tablename__ = "evaluation_reports"
    __table_args__ = (CheckConstraint("overall_score >= 0 AND overall_score <= 100", name="ck_report_score_range"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, index=True
    )
    overall_score: Mapped[float] = mapped_column(Float)
    star_scores: Mapped[dict[str, Any]] = mapped_column(json_type, default=dict)
    detailed_feedbacks: Mapped[list[dict[str, Any]]] = mapped_column(json_type, default=list)
    counselor_notes: Mapped[str | None] = mapped_column(Text)
    disclaimer_text: Mapped[str | None] = mapped_column(Text)

    session: Mapped[InterviewSession] = relationship(back_populates="evaluation_report")
    counselor_feedbacks: Mapped[list[CounselorFeedback]] = relationship(back_populates="report")


class CounselorFeedback(TimestampMixin, Base):
    __tablename__ = "counselor_feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    counselor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("counselors.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="SET NULL"), nullable=True, index=True
    )
    feedback_text: Mapped[str] = mapped_column(Text)
    assigned_task: Mapped[str | None] = mapped_column(Text)

    counselor: Mapped[Counselor] = relationship(back_populates="feedbacks")
    student: Mapped[Student] = relationship(back_populates="counselor_feedbacks")
    session: Mapped[InterviewSession | None] = relationship(back_populates="counselor_feedbacks")
    report: Mapped[EvaluationReport | None] = relationship(back_populates="counselor_feedbacks")
