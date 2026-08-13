import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, TypeDecorator, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.database import Base


class EmbeddingVector(TypeDecorator):
    """Store embeddings as pgvector in PostgreSQL and JSON in local SQLite tests."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector())
        return dialect.type_descriptor(JSON())


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
    snapshots: Mapped[list["CVSnapshot"]] = relationship("CVSnapshot", back_populates="cv", cascade="all, delete-orphan")


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
    snapshots: Mapped[list["JDSnapshot"]] = relationship("JDSnapshot", back_populates="jd", cascade="all, delete-orphan")


class CVSnapshot(Base):
    """Immutable normalized CV version used by matching, optimization and interviews."""

    __tablename__ = "cv_snapshots"
    __table_args__ = (Index("uq_cv_snapshot_version", "cv_id", "version_number", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    profile_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    pages_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    parser_version: Mapped[str] = mapped_column(String(40), default="2.0", nullable=False)
    normalizer_version: Mapped[str] = mapped_column(String(40), default="1.0", nullable=False)
    source_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ready", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    cv: Mapped["CV"] = relationship("CV", back_populates="snapshots")


class JDSnapshot(Base):
    """Immutable normalized JD version used by matching, optimization and interviews."""

    __tablename__ = "jd_snapshots"
    __table_args__ = (Index("uq_jd_snapshot_version", "jd_id", "version_number", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    requirements_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    pages_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    parser_version: Mapped[str] = mapped_column(String(40), default="1.0", nullable=False)
    normalizer_version: Mapped[str] = mapped_column(String(40), default="1.0", nullable=False)
    source_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ready", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    jd: Mapped["JobDescription"] = relationship("JobDescription", back_populates="snapshots")


class MarketJobEmbedding(Base):
    """Semantic index for the read-only market-JD catalog, stored in PostgreSQL."""

    __tablename__ = "market_job_embeddings"

    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    document: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    embedding_provider: Mapped[str] = mapped_column(String(255), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(EmbeddingVector(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CVAnalysis(Base):
    __tablename__ = "cv_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    cv_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    jd_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jd_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    pipeline_version: Mapped[str] = mapped_column(String(40), default="1.0", nullable=False)
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    gap_analysis_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    optimized_suggestions_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="analyses")
    cv: Mapped["CV"] = relationship("CV", back_populates="analyses")
    jd: Mapped["JobDescription"] = relationship("JobDescription", back_populates="analyses")


class MatchRun(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    cv_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    jd_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jd_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_analyses.id", ondelete="SET NULL"), nullable=True, index=True)
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    current_step: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rating: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mandatory_requirement_failed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Rubric IDs are versioned application identifiers. Keep this scalar
    # backwards-compatible while existing installations migrate their data.
    rubric_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pipeline_version: Mapped[str] = mapped_column(String(40), default="1.0", nullable=False)
    pipeline_config_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    versions_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    result_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CVChunkArtifact(Base):
    __tablename__ = "cv_chunks"
    __table_args__ = (Index("uq_match_chunk", "match_id", "chunk_id", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id: Mapped[str] = mapped_column(String(80), nullable=False)
    candidate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    document_id: Mapped[str] = mapped_column(String(64), nullable=False)
    chunk_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    embedding_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class JDRequirementArtifact(Base):
    __tablename__ = "jd_requirements"
    __table_args__ = (Index("uq_match_requirement", "match_id", "requirement_id", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    requirement_id: Mapped[str] = mapped_column(String(80), nullable=False)
    requirement_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    criterion_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    payload_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class RetrievalArtifact(Base):
    __tablename__ = "retrieval_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    requirement_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    bm25_results_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    semantic_results_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    hybrid_results_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class MatchEvidenceArtifact(Base):
    __tablename__ = "evidences"
    __table_args__ = (Index("uq_match_evidence", "match_id", "evidence_id", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[str] = mapped_column(String(80), nullable=False)
    requirement_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    chunk_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    semantic_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    bm25_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    fusion_score: Mapped[float] = mapped_column(Float, nullable=False)
    ranks_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class CriterionEvaluationArtifact(Base):
    __tablename__ = "criterion_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    raw_score: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    weighted_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_ids_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    evidence_ids_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class RubricDefinition(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(30), nullable=False)
    config_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RubricCriterionDefinition(Base):
    __tablename__ = "rubric_criteria"
    __table_args__ = (Index("uq_rubric_criterion", "rubric_id", "criterion_id", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    rubric_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    criterion_id: Mapped[str] = mapped_column(String(80), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)


class CandidateArtifact(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    current_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobArtifact(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_jd_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title_original: Mapped[str] = mapped_column(String(255), nullable=False)
    title_normalized: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    structured_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentArtifact(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source_entity_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_snapshot_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    normalized_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    pages_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CVProfileArtifact(Base):
    __tablename__ = "cv_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    candidate_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVExperienceArtifact(Base):
    __tablename__ = "cv_experiences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVProjectArtifact(Base):
    __tablename__ = "cv_projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVSkillArtifact(Base):
    __tablename__ = "cv_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVEducationArtifact(Base):
    __tablename__ = "cv_education"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVCertificationArtifact(Base):
    __tablename__ = "cv_certifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class CVLanguageArtifact(Base):
    __tablename__ = "cv_languages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[Any] = mapped_column(JSON, nullable=False)


class MatchResultArtifact(Base):
    __tablename__ = "match_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    match_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    rating: Mapped[str] = mapped_column(String(30), nullable=False)
    result_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[str] = mapped_column(String(36), ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False)
    jd_id: Mapped[str] = mapped_column(String(36), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False)
    cv_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    jd_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jd_snapshots.id", ondelete="SET NULL"), nullable=True, index=True)
    match_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("matches.id", ondelete="SET NULL"), nullable=True, index=True)
    language: Mapped[str] = mapped_column(String(16), default="vi", nullable=False)
    mode: Mapped[str] = mapped_column(String(16), default="text", nullable=False)
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
