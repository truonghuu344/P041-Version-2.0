from datetime import UTC, datetime

import pytest

from src.db.models import CVAnalysis, InterviewReport, InterviewSession, JobDescription
from tests.conftest import TestingSessionLocal
from tests.helpers import create_admin, insert_cv, register_and_login


@pytest.mark.asyncio
async def test_google_oauth_token_is_verified_by_backend(client, monkeypatch):
    monkeypatch.setattr("src.api.v1.auth.settings.google_oauth_client_id", "web-client-id")
    monkeypatch.setattr(
        "src.api.v1.auth.id_token.verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "email": "verified.user@gmail.com",
            "email_verified": True,
            "name": "Verified User",
        },
    )
    response = await client.post(
        "/api/v1/auth/google",
        json={"credential": "verified-google-id-token-value", "role": "student"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == "verifieduser@gmail.com"
    assert response.json()["access_token"] != "google-oauth-jwt-token"


@pytest.mark.asyncio
async def test_student_controls_counselor_consent_and_feedback(client):
    student, student_headers = await register_and_login(
        client, email="student-hitl@example.com", full_name="Student HITL"
    )
    _counselor, counselor_headers = await register_and_login(
        client, email="counselor-hitl@example.com", full_name="Counselor HITL", role="counselor"
    )

    denied = await client.get(f"/api/v1/counselor/students/{student['id']}", headers=counselor_headers)
    assert denied.status_code == 403

    granted = await client.post(
        "/api/v1/counselor/consents",
        headers=student_headers,
        json={"counselor_email": "counselor-hitl@example.com"},
    )
    assert granted.status_code == 201, granted.text
    assignment_id = granted.json()["id"]

    students = await client.get("/api/v1/counselor/students", headers=counselor_headers)
    assert students.status_code == 200
    assert students.json()[0]["student_id"] == student["id"]

    overview = await client.get(f"/api/v1/counselor/students/{student['id']}", headers=counselor_headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["first_interview_score"] is None
    assert overview.json()["latest_interview_score"] is None
    assert overview.json()["interview_score_delta"] is None
    assert overview.json()["average_csat"] is None

    feedback = await client.post(
        f"/api/v1/counselor/students/{student['id']}/feedback",
        headers=counselor_headers,
        json={"kind": "task", "content": "Bổ sung số liệu cho dự án gần nhất."},
    )
    assert feedback.status_code == 201, feedback.text
    mine = await client.get("/api/v1/counselor/my-feedback", headers=student_headers)
    assert mine.json()[0]["kind"] == "task"

    revoked = await client.delete(f"/api/v1/counselor/consents/{assignment_id}", headers=student_headers)
    assert revoked.status_code == 204
    denied_again = await client.get(f"/api/v1/counselor/students/{student['id']}", headers=counselor_headers)
    assert denied_again.status_code == 403


@pytest.mark.asyncio
async def test_manual_cv_decisions_and_pdf_export(client):
    user, headers = await register_and_login(client, email="manual-cv@example.com")
    created = await client.post(
        "/api/v1/cvs/manual",
        headers=headers,
        json={
            "title": "CV Backend",
            "template_name": "modern",
            "personal_info": {"full_name": "Manual User", "email": user["email"]},
            "summary": "Backend developer",
            "skills": ["Python", "FastAPI"],
            "education": [{"school": "University"}],
            "experience": [],
            "projects": [{"name": "Career Assistant", "description": "Built API with FastAPI"}],
        },
    )
    assert created.status_code == 201, created.text
    cv_id = created.json()["id"]

    async with TestingSessionLocal() as session:
        jd = JobDescription(
            title="Backend Developer",
            requirements_text="Python FastAPI Docker PostgreSQL",
            is_system=True,
            is_published=True,
        )
        session.add(jd)
        await session.flush()
        analysis = CVAnalysis(
            user_id=user["id"],
            cv_id=cv_id,
            jd_id=jd.id,
            match_score=75,
            optimized_suggestions_json=[
                {
                    "original_text": "Built API with FastAPI",
                    "suggested_improvement": "Developed API with FastAPI",
                    "reason": "Rõ công nghệ",
                }
            ],
        )
        session.add(analysis)
        await session.commit()
        analysis_id = analysis.id

    accepted = await client.put(
        f"/api/v1/analysis/{analysis_id}/suggestions",
        headers=headers,
        json={"suggestion_index": 0, "accepted": True, "final_text": "Developed API with FastAPI"},
    )
    assert accepted.status_code == 200, accepted.text
    exported = await client.get(
        f"/api/v1/cvs/{cv_id}/export?analysis_id={analysis_id}&template=modern",
        headers=headers,
    )
    assert exported.status_code == 200, exported.text
    assert exported.headers["content-type"] == "application/pdf"
    assert exported.content.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_enterprise_publishes_jd_and_human_decides_ranked_application(client):
    enterprise, enterprise_headers = await register_and_login(
        client, email="enterprise-prd@example.com", role="enterprise"
    )
    student, student_headers = await register_and_login(client, email="candidate-prd@example.com")
    cv = await insert_cv(email=student["email"])

    jd_response = await client.post(
        "/api/v1/jds/custom",
        headers=enterprise_headers,
        json={"title": "Python Engineer", "company": "Enterprise", "requirements_text": "Python FastAPI Docker"},
    )
    assert jd_response.status_code == 201
    jd_id = jd_response.json()["id"]
    published = await client.patch(f"/api/v1/jds/{jd_id}/publish", headers=enterprise_headers)
    assert published.status_code == 200
    assert published.json()["is_published"] is True

    applied = await client.post(
        "/api/v1/enterprise/applications",
        headers=student_headers,
        json={"jd_id": jd_id, "cv_id": cv.id},
    )
    assert applied.status_code == 201, applied.text
    application_id = applied.json()["id"]

    candidates = await client.get(f"/api/v1/enterprise/jds/{jd_id}/candidates", headers=enterprise_headers)
    assert candidates.status_code == 200
    assert candidates.json()[0]["candidate_email"] == student["email"]
    shared_cv = await client.get(
        f"/api/v1/enterprise/applications/{application_id}/cv", headers=enterprise_headers
    )
    assert shared_cv.status_code == 200
    assert shared_cv.json()["id"] == cv.id
    decided = await client.patch(
        f"/api/v1/enterprise/applications/{application_id}",
        headers=enterprise_headers,
        json={"status": "interview"},
    )
    assert decided.json()["status"] == "interview"

    _other_enterprise, other_headers = await register_and_login(
        client, email="other-enterprise@example.com", role="enterprise"
    )
    denied = await client.get(f"/api/v1/enterprise/jds/{jd_id}/candidates", headers=other_headers)
    assert denied.status_code == 404
    denied_cv = await client.get(
        f"/api/v1/enterprise/applications/{application_id}/cv", headers=other_headers
    )
    assert denied_cv.status_code == 404


@pytest.mark.asyncio
async def test_interview_resume_csat_and_product_metrics(client):
    user, headers = await register_and_login(client, email="star-metrics@example.com")
    cv = await insert_cv(email=user["email"])
    async with TestingSessionLocal() as session:
        jd = JobDescription(title="QA", requirements_text="Testing automation", is_system=True)
        session.add(jd)
        await session.flush()
        interview = InterviewSession(
            user_id=user["id"], cv_id=cv.id, jd_id=jd.id, status="completed", total_questions=5,
            current_question_index=5, completed_at=datetime.now(UTC),
        )
        session.add(interview)
        await session.flush()
        session.add(InterviewReport(session_id=interview.id, total_score=82, star_scores_json={}))
        await session.commit()
        session_id = interview.id

    feedback = await client.post(
        f"/api/v1/interviews/{session_id}/feedback",
        headers=headers,
        json={"rating": 5, "comment": "Hữu ích"},
    )
    assert feedback.status_code == 201
    admin, admin_headers = await create_admin(client, email="metrics-admin@example.com")
    metrics = await client.get("/api/v1/metrics/product", headers=admin_headers)
    assert metrics.status_code == 200, metrics.text
    assert metrics.json()["average_csat"] == 5
    assert metrics.json()["adoption_target"] == 60
    assert isinstance(metrics.json()["adoption_target_met"], bool)
    assert metrics.json()["csat_target"] == 4
    assert metrics.json()["csat_target_met"] is True
    assert admin["role"] == "admin"
