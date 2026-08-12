import pytest

from tests.helpers import insert_cv, insert_jd, register_and_login


@pytest.mark.asyncio
async def test_enterprise_can_upload_custom_jd(client):
    user, headers = await register_and_login(
        client,
        email="recruiter@company.com",
        full_name="Company Recruiter",
        role="enterprise",
    )
    assert user["role"] == "enterprise"

    response = await client.post(
        "/api/v1/jds/custom",
        headers=headers,
        json={
            "title": "Senior Backend Engineer",
            "company": "Example Company",
            "location": "Hà Nội",
            "requirements_text": "Yêu cầu Python, FastAPI, PostgreSQL, Docker và kỹ năng giao tiếp.",
        },
    )
    assert response.status_code == 201
    assert response.json()["is_system"] is False


@pytest.mark.asyncio
async def test_enterprise_can_upload_jd_template_file(client):
    _user, headers = await register_and_login(
        client,
        email="recruiter-file@company.com",
        full_name="File Recruiter",
        role="enterprise",
    )
    response = await client.post(
        "/api/v1/jds/upload",
        headers=headers,
        data={"company": "Example Company", "location": "Remote"},
        files={
            "file": (
                "Senior_Backend_Engineer.txt",
                "Yêu cầu Python, FastAPI, PostgreSQL, Docker và 3 năm kinh nghiệm.".encode(),
                "text/plain",
            )
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Senior Backend Engineer"
    assert response.json()["company"] == "Example Company"
    assert response.json()["requirements_text"].startswith("Yêu cầu Python")
    assert response.json()["is_system"] is False


@pytest.mark.asyncio
async def test_enterprise_can_use_cv_gap_interview_and_nova_like_student(client, monkeypatch):
    user, headers = await register_and_login(
        client,
        email="enterprise-full-access@company.com",
        role="enterprise",
    )
    cv = await insert_cv(email=user["email"])
    jd = await insert_jd(is_system=True)

    async def fake_gap(**_kwargs):
        return {
            "match_score": 75,
            "hard_skills_matching": ["Python"],
            "hard_skills_missing": ["Docker"],
            "soft_skills_gap": [],
            "suggestions": [],
            "executive_summary": "Enterprise user can run Gap Analysis.",
            "priority_actions": [],
            "learning_recommendations": [],
            "certification_recommendations": [],
            "project_recommendations": [],
            "cv_section_recommendations": [],
            "score_breakdown": {},
        }

    async def fake_questions(**_kwargs):
        return ["Câu hỏi 1?", "Câu hỏi 2?", "Câu hỏi 3?"]

    async def fake_nova(**_kwargs):
        return {
            "response": "Nova sẵn sàng hỗ trợ tài khoản doanh nghiệp.",
            "provider": "google_gemini",
            "model": "gemini-test",
            "llm_succeeded": True,
            "suggested_actions": [],
            "tools_used": [],
        }

    monkeypatch.setattr("src.api.v1.analysis.perform_cv_jd_gap_analysis", fake_gap)
    monkeypatch.setattr("src.api.v1.interviews.generate_interview_questions", fake_questions)
    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_nova)

    assert (await client.get("/api/v1/cvs", headers=headers)).status_code == 200
    gap = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    interview = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3},
    )
    nova = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={"message": "Hãy hỗ trợ tôi"},
    )

    assert gap.status_code == 201
    assert interview.status_code == 201
    assert nova.status_code == 200
    assert nova.json()["response"] == "Nova sẵn sàng hỗ trợ tài khoản doanh nghiệp."
