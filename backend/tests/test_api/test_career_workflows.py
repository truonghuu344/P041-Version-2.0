
import pytest

from tests.helpers import insert_cv, insert_jd, register_and_login

GAP_RESULT = {
    "match_score": 62.5,
    "hard_skills_matching": ["Python", "FastAPI"],
    "hard_skills_missing": ["Docker"],
    "soft_skills_gap": ["Communication"],
    "suggestions": [
        {
            "original_text": "Python FastAPI REST API teamwork",
            "suggested_improvement": "Xây dựng REST API bằng Python và FastAPI.",
            "action_verb": "Xây dựng",
            "reason": "Làm rõ hành động đã thực hiện.",
        }
    ],
    "executive_summary": "CV phù hợp một phần với JD.",
    "priority_actions": [
        {"priority": 1, "gap": "Docker", "why_it_matters": "JD yêu cầu", "action": "Học Docker"}
    ],
    "learning_recommendations": [
        {
            "skill": "Docker",
            "learning_goal": "Đóng gói ứng dụng",
            "topics": ["Dockerfile"],
            "practice": "Container hóa API",
        }
    ],
    "certification_recommendations": [],
    "project_recommendations": [],
    "cv_section_recommendations": [],
    "score_breakdown": {"hard_skills": 62.5},
}


@pytest.mark.asyncio
async def test_gap_analysis_persists_result_and_returns_history(client, monkeypatch):
    _user, headers = await register_and_login(client, email="gap-success@example.com")
    cv = await insert_cv(email="gap-success@example.com")
    jd = await insert_jd(is_system=True)

    async def fake_analysis(**kwargs):
        assert kwargs["cv_raw_text"] == cv.raw_text
        assert kwargs["jd_title"] == jd.title
        return GAP_RESULT

    monkeypatch.setattr("src.api.v1.analysis.perform_cv_jd_gap_analysis", fake_analysis)

    response = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert response.status_code == 201, response.text
    assert response.json()["match_score"] == 62.5
    assert response.json()["hard_skills_missing"] == ["Docker"]

    history = await client.get("/api/v1/analysis/history", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["id"] == response.json()["id"]


@pytest.mark.asyncio
async def test_gap_analysis_rejects_foreign_cv_and_private_jd(client, monkeypatch):
    await register_and_login(client, email="gap-owner@example.com")
    _other, other_headers = await register_and_login(client, email="gap-other@example.com")
    foreign_cv = await insert_cv(email="gap-owner@example.com")
    private_jd = await insert_jd(owner_email="gap-owner@example.com")

    async def should_not_run(**_kwargs):
        raise AssertionError("Gap agent must not run for inaccessible input")

    monkeypatch.setattr("src.api.v1.analysis.perform_cv_jd_gap_analysis", should_not_run)

    foreign_cv_response = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=other_headers,
        json={"cv_id": foreign_cv.id, "jd_id": private_jd.id},
    )
    assert foreign_cv_response.status_code == 404

    own_cv = await insert_cv(email="gap-other@example.com")
    private_jd_response = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=other_headers,
        json={"cv_id": own_cv.id, "jd_id": private_jd.id},
    )
    assert private_jd_response.status_code == 404


@pytest.mark.asyncio
async def test_analysis_history_is_isolated_per_user(client, monkeypatch):
    _owner, owner_headers = await register_and_login(client, email="history-owner@example.com")
    _other, other_headers = await register_and_login(client, email="history-other@example.com")
    cv = await insert_cv(email="history-owner@example.com")
    jd = await insert_jd(is_system=True)
    monkeypatch.setattr(
        "src.api.v1.analysis.perform_cv_jd_gap_analysis",
        lambda **_kwargs: None,
    )

    async def fake_analysis(**_kwargs):
        return GAP_RESULT

    monkeypatch.setattr("src.api.v1.analysis.perform_cv_jd_gap_analysis", fake_analysis)
    created = await client.post(
        "/api/v1/analysis/gap-analysis",
        headers=owner_headers,
        json={"cv_id": cv.id, "jd_id": jd.id},
    )
    assert created.status_code == 201
    assert (await client.get("/api/v1/analysis/history", headers=other_headers)).json() == []


@pytest.mark.asyncio
async def test_interview_validates_question_count_and_requires_owned_cv(client):
    await register_and_login(client, email="interview-owner@example.com")
    _other, other_headers = await register_and_login(client, email="interview-other@example.com")
    cv = await insert_cv(email="interview-owner@example.com")
    jd = await insert_jd(is_system=True)

    invalid_count = await client.post(
        "/api/v1/interviews/start",
        headers=other_headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 2},
    )
    assert invalid_count.status_code == 422

    foreign_cv = await client.post(
        "/api/v1/interviews/start",
        headers=other_headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3},
    )
    assert foreign_cv.status_code == 400


@pytest.mark.asyncio
async def test_interview_followup_completion_and_report(client, monkeypatch):
    _user, headers = await register_and_login(client, email="interview-flow@example.com")
    cv = await insert_cv(email="interview-flow@example.com")
    jd = await insert_jd(is_system=True)

    async def fake_questions(**_kwargs):
        return ["Câu hỏi tình huống 1?", "Câu hỏi tình huống 2?", "Câu hỏi tình huống 3?"]

    evaluation_calls = 0

    async def fake_evaluation(**_kwargs):
        nonlocal evaluation_calls
        evaluation_calls += 1
        if evaluation_calls == 1:
            return {
                "needs_followup": True,
                "follow_up_question": "Kết quả cụ thể là gì?",
                "star_score": {"situation": 60, "task": 60, "action": 60, "result": 20},
            }
        return {
            "needs_followup": False,
            "follow_up_question": None,
            "star_score": {"situation": 80, "task": 80, "action": 80, "result": 80},
        }

    async def fake_report(**_kwargs):
        return {
            "total_score": 80,
            "star_scores": {"situation": 80, "task": 80, "action": 80, "result": 80},
            "strengths": ["Action rõ ràng"],
            "improvements": ["Bổ sung số liệu"],
            "recommendations": ["Tiếp tục luyện STAR"],
        }

    monkeypatch.setattr("src.api.v1.interviews.generate_interview_questions", fake_questions)
    monkeypatch.setattr("src.api.v1.interviews.evaluate_answer_and_check_followup", fake_evaluation)
    monkeypatch.setattr("src.api.v1.interviews.generate_final_star_report", fake_report)

    started = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3},
    )
    assert started.status_code == 201
    session_id = started.json()["session_id"]
    assert (await client.get(f"/api/v1/interviews/{session_id}/report", headers=headers)).status_code == 404

    first = await client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=headers,
        json={"user_answer": "Tôi đã xử lý một sự cố trong dự án."},
    )
    assert first.json()["follow_up_question"] == "Kết quả cụ thể là gì?"
    assert first.json()["question_index"] == 0

    followup = await client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=headers,
        json={"user_answer": "Kết quả thời gian phản hồi giảm 20%."},
    )
    assert followup.json()["question_index"] == 1

    for _index in range(2):
        completed = await client.post(
            f"/api/v1/interviews/{session_id}/answer",
            headers=headers,
            json={"user_answer": "Tình huống, nhiệm vụ, hành động và kết quả đều rõ ràng."},
        )
    assert completed.json()["is_last_question"] is True

    report = await client.get(f"/api/v1/interviews/{session_id}/report", headers=headers)
    assert report.status_code == 200
    assert report.json()["total_score"] == 80
    assert report.json()["strengths"] == ["Action rõ ràng"]

    after_completion = await client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=headers,
        json={"user_answer": "Không thể gửi thêm."},
    )
    assert after_completion.status_code == 400


@pytest.mark.asyncio
async def test_user_cannot_access_another_users_interview(client, monkeypatch):
    _owner, owner_headers = await register_and_login(client, email="session-owner@example.com")
    _other, other_headers = await register_and_login(client, email="session-other@example.com")
    cv = await insert_cv(email="session-owner@example.com")
    jd = await insert_jd(is_system=True)

    async def fake_questions(**_kwargs):
        return ["Câu hỏi thứ nhất?", "Câu hỏi thứ hai?", "Câu hỏi thứ ba?"]

    monkeypatch.setattr("src.api.v1.interviews.generate_interview_questions", fake_questions)
    started = await client.post(
        "/api/v1/interviews/start",
        headers=owner_headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3},
    )
    session_id = started.json()["session_id"]

    answer = await client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=other_headers,
        json={"user_answer": "Câu trả lời trái phép"},
    )
    report = await client.get(f"/api/v1/interviews/{session_id}/report", headers=other_headers)
    assert answer.status_code == 404
    assert report.status_code == 404


@pytest.mark.asyncio
async def test_assistant_chat_passes_verified_user_context_to_agent(client, monkeypatch):
    user, headers = await register_and_login(
        client,
        email="nova-context@example.com",
        full_name="Nova Context User",
    )
    await insert_cv(email=user["email"], title="Latest CV")
    captured = {}

    async def fake_run(*, message, history, user_context):
        captured.update({"message": message, "history": history, "user_context": user_context})
        return {
            "response": "Mở trang Gap Analysis để bắt đầu.",
            "provider": "google_gemini",
            "model": "gemini-test",
            "llm_succeeded": True,
            "suggested_actions": [{"label": "Mở Gap Analysis", "page": "gap"}],
        }

    monkeypatch.setattr("src.api.v1.assistant.career_assistant_agent.run", fake_run)
    response = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={
            "message": "Tôi cần so khớp JD",
            "history": [{"role": "user", "content": "Xin chào"}],
            "current_page": "dashboard",
        },
    )
    assert response.status_code == 200
    assert response.json()["suggested_actions"][0]["page"] == "gap"
    assert captured["user_context"]["full_name"] == "Nova Context User"
    assert captured["user_context"]["cv_count"] == 1
    assert captured["user_context"]["latest_cv_title"] == "Latest CV"
    assert captured["history"] == [{"role": "user", "content": "Xin chào"}]


@pytest.mark.asyncio
async def test_assistant_request_limits_history_and_message_size(client):
    _user, headers = await register_and_login(client, email="nova-validation@example.com")
    too_much_history = [{"role": "user", "content": "hello"} for _ in range(13)]

    response = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={"message": "x" * 4001, "history": too_much_history, "current_page": "dashboard"},
    )
    assert response.status_code == 422
