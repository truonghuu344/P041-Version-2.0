import uuid

import pytest
from pydantic import ValidationError

from src.backend.db.models import UserRole
from src.backend.models import (
    AdminUserUpdateRequest,
    InterviewRatingRequest,
    InterviewReportResponse,
    InterviewSessionResponse,
    InterviewStartRequest,
    ManualResumeCreateRequest,
    RegisterRequest,
    SuggestionDecisionRequest,
)


def test_registration_accepts_public_roles_and_rejects_admin() -> None:
    registration = RegisterRequest(
        email="student@example.com",
        password="Strong-password1",
        full_name="Student Example",
        role="student",
    )

    assert registration.role is UserRole.STUDENT

    with pytest.raises(ValidationError):
        RegisterRequest(
            email="admin@example.com",
            password="Strong-password1",
            full_name="System Admin",
            role="admin",
        )


def test_manual_cv_payload_matches_frontend_and_normalizes_skills() -> None:
    payload = ManualResumeCreateRequest(
        title="Backend CV",
        template_name="classic",
        personal_info={
            "full_name": "Nguyen Van A",
            "email": "candidate@example.com",
            "phone": "0900000000",
        },
        summary="Backend developer candidate",
        skills=[" Python ", "FastAPI", "Python", ""],
        education=[{"description": "Computer Science"}],
        experience=[],
        projects=[{"description": "Career Assistant"}],
    )

    assert payload.skills == ["Python", "FastAPI"]
    assert payload.personal_info.email == "candidate@example.com"


@pytest.mark.parametrize("total_questions", [5, 6, 7])
def test_interview_accepts_documented_question_range(total_questions: int) -> None:
    request = InterviewStartRequest(
        cv_id=uuid.uuid4(),
        jd_id=uuid.uuid4(),
        total_questions=total_questions,
    )

    assert request.total_questions == total_questions


@pytest.mark.parametrize("total_questions", [4, 8])
def test_interview_rejects_question_count_outside_documented_range(
    total_questions: int,
) -> None:
    with pytest.raises(ValidationError):
        InterviewStartRequest(
            cv_id=uuid.uuid4(),
            jd_id=uuid.uuid4(),
            total_questions=total_questions,
        )


@pytest.mark.parametrize("rating", [0, 6])
def test_csat_rating_must_be_between_one_and_five(rating: int) -> None:
    with pytest.raises(ValidationError):
        InterviewRatingRequest(rating=rating)


def test_accepted_suggestion_requires_reviewed_final_text() -> None:
    with pytest.raises(ValidationError):
        SuggestionDecisionRequest(suggestion_index=0, accepted=True)

    rejected = SuggestionDecisionRequest(
        suggestion_index=0,
        accepted=False,
        final_text="This must not be persisted",
    )
    assert rejected.final_text is None


def test_admin_update_requires_a_change() -> None:
    with pytest.raises(ValidationError):
        AdminUserUpdateRequest()


def test_interview_responses_accept_database_column_names() -> None:
    session_id = uuid.uuid4()
    resume_id = uuid.uuid4()
    job_description_id = uuid.uuid4()

    session = InterviewSessionResponse.model_validate(
        {
            "id": session_id,
            "student_id": uuid.uuid4(),
            "resume_id": resume_id,
            "job_description_id": job_description_id,
            "total_questions": 5,
            "current_step": 0,
            "status": "created",
            "overall_score": None,
            "csat_score": None,
            "created_at": "2026-08-10T00:00:00Z",
        }
    )
    report = InterviewReportResponse.model_validate(
        {
            "id": uuid.uuid4(),
            "session_id": session_id,
            "overall_score": 85,
            "star_scores": {
                "situation": 80,
                "task": 85,
                "action": 90,
                "result": 85,
            },
            "created_at": "2026-08-10T00:00:00Z",
        }
    )

    assert session.cv_id == resume_id
    assert session.jd_id == job_description_id
    assert report.total_score == 85
