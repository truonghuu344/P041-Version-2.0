from sqlalchemy import CheckConstraint, UniqueConstraint

from src.backend.db.models import (
    Base,
    InterviewSession,
    InterviewStatus,
    JobDescriptionSource,
    User,
    UserRole,
)

EXPECTED_TABLES = {
    "users",
    "students",
    "counselors",
    "enterprises",
    "resumes",
    "counselor_feedbacks",
    "job_descriptions",
    "cv_jd_matches",
    "interview_sessions",
    "interview_qa_logs",
    "evaluation_reports",
    "chat_conversations",
    "chat_messages",
    "ai_audit_logs",
}


def test_all_erd_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_user_email_and_actor_profiles_are_unique() -> None:
    assert User.__table__.c.email.unique is True
    assert Base.metadata.tables["students"].c.user_id.unique is True
    assert Base.metadata.tables["counselors"].c.user_id.unique is True
    assert Base.metadata.tables["enterprises"].c.user_id.unique is True


def test_foreign_keys_match_the_documented_erd() -> None:
    expected_targets = {
        "resumes.student_id": "students.id",
        "job_descriptions.enterprise_id": "enterprises.id",
        "cv_jd_matches.resume_id": "resumes.id",
        "cv_jd_matches.job_description_id": "job_descriptions.id",
        "interview_sessions.student_id": "students.id",
        "interview_sessions.resume_id": "resumes.id",
        "interview_sessions.job_description_id": "job_descriptions.id",
        "interview_qa_logs.session_id": "interview_sessions.id",
        "evaluation_reports.session_id": "interview_sessions.id",
    }

    for column_path, target in expected_targets.items():
        table_name, column_name = column_path.split(".")
        foreign_key = next(iter(Base.metadata.tables[table_name].c[column_name].foreign_keys))
        assert foreign_key.target_fullname == target


def test_interview_report_and_question_number_are_unique_per_session() -> None:
    report_session_id = Base.metadata.tables["evaluation_reports"].c.session_id
    qa_constraints = Base.metadata.tables["interview_qa_logs"].constraints

    assert report_session_id.unique is True
    assert any(
        isinstance(constraint, UniqueConstraint)
        and {column.name for column in constraint.columns} == {"session_id", "question_number"}
        for constraint in qa_constraints
    )


def test_score_and_csat_constraints_are_defined() -> None:
    constraints = {
        constraint.name
        for table in Base.metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }

    assert {
        "ck_match_score_range",
        "ck_ats_score_range",
        "ck_interview_overall_score_range",
        "ck_interview_csat_range",
        "ck_report_score_range",
    }.issubset(constraints)


def test_domain_enums_expose_supported_values() -> None:
    assert {role.value for role in UserRole} == {
        "student",
        "counselor",
        "enterprise",
        "admin",
    }
    assert {source.value for source in JobDescriptionSource} == {"internal", "external"}
    assert InterviewSession.__table__.c.status.default.arg is InterviewStatus.CREATED
