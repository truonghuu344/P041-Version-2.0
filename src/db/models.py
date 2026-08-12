import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.database import Base


def generate_uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_single_admin",
            "role",
            unique=True,
            postgresql_where=text("role = 'admin'"),
            sqlite_where=text("role = 'admin'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="student", nullable=False)  # student, counselor, enterprise
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    cvs: Mapped[list["CV"]] = relationship("CV", back_populates="user", cascade="all, delete-orphan")
    analyses: Mapped[list["CVAnalysis"]] = relationship("CVAnalysis", back_populates="user", cascade="all, delete-orphan")
    interview_sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="user", cascade="all, delete-orphan")
    chat_conversations: Mapped[list["ChatConversation"]] = relationship(
        "ChatConversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"
    __table_args__ = (
        Index("ix_password_reset_otps_email_created", "email", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CV(Base):
    __tablename__ = "cvs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="cvs")
    analyses: Mapped[list["CVAnalysis"]] = relationship("CVAnalysis", back_populates="cv", cascade="all, delete-orphan")
    interview_sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="cv", cascade="all, delete-orphan")


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requirements_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    analyses: Mapped[list["CVAnalysis"]] = relationship("CVAnalysis", back_populates="jd", cascade="all, delete-orphan")
    interview_sessions: Mapped[list["InterviewSession"]] = relationship("InterviewSession", back_populates="jd", cascade="all, delete-orphan")


class CVAnalysis(Base):
    __tablename__ = "cv_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    gap_analysis_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    optimized_suggestions_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="analyses")
    cv: Mapped["CV"] = relationship("CV", back_populates="analyses")
    jd: Mapped["JobDescription"] = relationship("JobDescription", back_populates="analyses")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ongoing", nullable=False)  # ongoing, completed
    total_questions: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="interview_sessions")
    cv: Mapped["CV"] = relationship("CV", back_populates="interview_sessions")
    jd: Mapped["JobDescription"] = relationship("JobDescription", back_populates="interview_sessions")
    questions: Mapped[list["InterviewQuestion"]] = relationship("InterviewQuestion", back_populates="session", cascade="all, delete-orphan", order_by="InterviewQuestion.question_index")
    report: Mapped[Optional["InterviewReport"]] = relationship("InterviewReport", back_populates="session", uselist=False, cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    user_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    star_score_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="questions")


class InterviewReport(Base):
    __tablename__ = "interview_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    star_scores_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    strengths_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    improvements_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    recommendations_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="report")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        index=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="chat_conversations")
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    llm_succeeded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    suggested_actions_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["ChatConversation"] = relationship(
        "ChatConversation",
        back_populates="messages",
    )


class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("chat_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    llm_succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_code: Mapped[str | None] = mapped_column(String(160), nullable=True)
    current_page: Mapped[str | None] = mapped_column(String(50), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tools_used_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class CounselorAssignment(Base):
    """Sinh viên chủ động cấp quyền cho một cố vấn xem tiến độ của mình."""

    __tablename__ = "counselor_assignments"
    __table_args__ = (
        Index("uq_counselor_student", "counselor_id", "student_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    counselor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CounselorFeedback(Base):
    __tablename__ = "counselor_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    assignment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("counselor_assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    counselor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    interview_report_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("interview_reports.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), default="comment", nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CVOptimizationDecision(Base):
    __tablename__ = "cv_optimization_decisions"
    __table_args__ = (
        Index("uq_analysis_suggestion", "analysis_id", "suggestion_index", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    analysis_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cv_analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suggestion_index: Mapped[int] = mapped_column(Integer, nullable=False)
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        Index("uq_application_jd_student", "jd_id", "student_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    jd_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    analysis_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cv_analyses.id", ondelete="SET NULL"), nullable=True
    )
    match_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="submitted", nullable=False)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"
    __table_args__ = (
        Index("uq_interview_feedback_session", "session_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
