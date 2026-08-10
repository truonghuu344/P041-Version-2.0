"""Create the initial Career Assistant relational schema.

Revision ID: 20260810_0001
Revises:
Create Date: 2026-08-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260810_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = sa.Enum("student", "counselor", "enterprise", "admin", name="user_role", native_enum=False)
job_description_source = sa.Enum("internal", "external", name="job_description_source", native_enum=False)
interview_status = sa.Enum(
    "created",
    "in_progress",
    "completed",
    "cancelled",
    name="interview_status",
    native_enum=False,
)


def timestamp_columns() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("google_subject", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, server_default="student", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("google_subject"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.create_table(
        "counselors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_counselors_user_id"), "counselors", ["user_id"], unique=True)

    op.create_table(
        "enterprises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=255), nullable=True),
        sa.Column("website_url", sa.String(length=2048), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_enterprises_user_id"), "enterprises", ["user_id"], unique=True)

    op.create_table(
        "students",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("university", sa.String(length=255), nullable=True),
        sa.Column("major", sa.String(length=255), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_students_user_id"), "students", ["user_id"], unique=True)

    op.create_table(
        "job_descriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("enterprise_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description_text", sa.Text(), nullable=False),
        sa.Column("required_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "source_type",
            job_description_source,
            server_default="external",
            nullable=False,
        ),
        sa.Column("vector_id", sa.String(length=255), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["enterprise_id"], ["enterprises.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vector_id"),
    )
    op.create_index(
        op.f("ix_job_descriptions_enterprise_id"),
        "job_descriptions",
        ["enterprise_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_descriptions_title"),
        "job_descriptions",
        ["title"],
        unique=False,
    )

    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=True),
        sa.Column("raw_file_path", sa.String(length=2048), nullable=True),
        sa.Column("parsed_content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "accepted_suggestions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "missing_information",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("is_verified_real", sa.Boolean(), server_default="false", nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resumes_student_id"), "resumes", ["student_id"], unique=False)

    op.create_table(
        "cv_jd_matches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("job_description_id", sa.Uuid(), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("ats_score", sa.Float(), nullable=False),
        sa.Column("missing_skills", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("guardrail_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("gap_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint("ats_score >= 0 AND ats_score <= 100", name="ck_ats_score_range"),
        sa.CheckConstraint("match_score >= 0 AND match_score <= 100", name="ck_match_score_range"),
        sa.ForeignKeyConstraint(["job_description_id"], ["job_descriptions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cv_jd_matches_job_description_id"),
        "cv_jd_matches",
        ["job_description_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cv_jd_matches_resume_id"),
        "cv_jd_matches",
        ["resume_id"],
        unique=False,
    )

    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("job_description_id", sa.Uuid(), nullable=False),
        sa.Column("total_questions", sa.Integer(), server_default="5", nullable=False),
        sa.Column("current_step", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", interview_status, server_default="created", nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("csat_score", sa.Integer(), nullable=True),
        sa.Column("csat_feedback", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint(
            "csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)",
            name="ck_interview_csat_range",
        ),
        sa.CheckConstraint("current_step >= 0", name="ck_interview_current_step"),
        sa.CheckConstraint(
            "overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)",
            name="ck_interview_overall_score_range",
        ),
        sa.CheckConstraint("total_questions >= 1", name="ck_interview_total_questions"),
        sa.ForeignKeyConstraint(["job_description_id"], ["job_descriptions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_interview_sessions_job_description_id"),
        "interview_sessions",
        ["job_description_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_sessions_resume_id"),
        "interview_sessions",
        ["resume_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_sessions_status"),
        "interview_sessions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_sessions_student_id"),
        "interview_sessions",
        ["student_id"],
        unique=False,
    )

    op.create_table(
        "evaluation_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("star_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "detailed_feedbacks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("counselor_notes", sa.Text(), nullable=True),
        sa.Column("disclaimer_text", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint(
            "overall_score >= 0 AND overall_score <= 100",
            name="ck_report_score_range",
        ),
        sa.ForeignKeyConstraint(["session_id"], ["interview_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_evaluation_reports_session_id"),
        "evaluation_reports",
        ["session_id"],
        unique=True,
    )

    op.create_table(
        "interview_qa_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("question_number", sa.Integer(), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("student_answer", sa.Text(), nullable=True),
        sa.Column("situation_text", sa.Text(), nullable=True),
        sa.Column("task_text", sa.Text(), nullable=True),
        sa.Column("action_text", sa.Text(), nullable=True),
        sa.Column("result_text", sa.Text(), nullable=True),
        sa.Column(
            "is_followup_required",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column("star_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint("question_number >= 1", name="ck_question_number_positive"),
        sa.ForeignKeyConstraint(["session_id"], ["interview_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "question_number", name="uq_session_question_number"),
    )
    op.create_index(
        op.f("ix_interview_qa_logs_session_id"),
        "interview_qa_logs",
        ["session_id"],
        unique=False,
    )

    op.create_table(
        "counselor_feedbacks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("counselor_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("report_id", sa.Uuid(), nullable=True),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("assigned_task", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["counselor_id"], ["counselors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["report_id"], ["evaluation_reports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["interview_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_counselor_feedbacks_counselor_id"),
        "counselor_feedbacks",
        ["counselor_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_counselor_feedbacks_report_id"),
        "counselor_feedbacks",
        ["report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_counselor_feedbacks_session_id"),
        "counselor_feedbacks",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_counselor_feedbacks_student_id"),
        "counselor_feedbacks",
        ["student_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_counselor_feedbacks_student_id"),
        table_name="counselor_feedbacks",
    )
    op.drop_index(
        op.f("ix_counselor_feedbacks_session_id"),
        table_name="counselor_feedbacks",
    )
    op.drop_index(
        op.f("ix_counselor_feedbacks_report_id"),
        table_name="counselor_feedbacks",
    )
    op.drop_index(
        op.f("ix_counselor_feedbacks_counselor_id"),
        table_name="counselor_feedbacks",
    )
    op.drop_table("counselor_feedbacks")
    op.drop_index(op.f("ix_interview_qa_logs_session_id"), table_name="interview_qa_logs")
    op.drop_table("interview_qa_logs")
    op.drop_index(op.f("ix_evaluation_reports_session_id"), table_name="evaluation_reports")
    op.drop_table("evaluation_reports")
    op.drop_index(op.f("ix_interview_sessions_student_id"), table_name="interview_sessions")
    op.drop_index(op.f("ix_interview_sessions_status"), table_name="interview_sessions")
    op.drop_index(op.f("ix_interview_sessions_resume_id"), table_name="interview_sessions")
    op.drop_index(
        op.f("ix_interview_sessions_job_description_id"),
        table_name="interview_sessions",
    )
    op.drop_table("interview_sessions")
    op.drop_index(op.f("ix_cv_jd_matches_resume_id"), table_name="cv_jd_matches")
    op.drop_index(op.f("ix_cv_jd_matches_job_description_id"), table_name="cv_jd_matches")
    op.drop_table("cv_jd_matches")
    op.drop_index(op.f("ix_resumes_student_id"), table_name="resumes")
    op.drop_table("resumes")
    op.drop_index(op.f("ix_job_descriptions_title"), table_name="job_descriptions")
    op.drop_index(op.f("ix_job_descriptions_enterprise_id"), table_name="job_descriptions")
    op.drop_table("job_descriptions")
    op.drop_index(op.f("ix_students_user_id"), table_name="students")
    op.drop_table("students")
    op.drop_index(op.f("ix_enterprises_user_id"), table_name="enterprises")
    op.drop_table("enterprises")
    op.drop_index(op.f("ix_counselors_user_id"), table_name="counselors")
    op.drop_table("counselors")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
