import pytest
from sqlalchemy import func, select

from src.db.models import CVAnalysis, InterviewSession
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login


@pytest.mark.asyncio
async def test_gap_operation_does_not_run_without_explicit_confirmation(client):
    _user, headers = await register_and_login(client, email="nova-confirm@example.com")
    cv = await insert_cv(email="nova-confirm@example.com", title="CV Nova")
    jd = await insert_jd(title="JD Nova", owner_email="nova-confirm@example.com")

    response = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={
            "message": "Chưa xác nhận",
            "operation": {
                "action_type": "run_gap_analysis",
                "cv_id": cv.id,
                "jd_id": jd.id,
                "confirmed": False,
            },
        },
    )

    assert response.status_code == 200, response.text
    assert "chưa xác nhận" in response.json()["response"].lower()
    async with TestingSessionLocal() as session:
        count = await session.scalar(select(func.count(CVAnalysis.id)))
    assert count == 0


@pytest.mark.asyncio
async def test_nova_rejects_foreign_cv_for_confirmed_operation(client):
    _owner, _owner_headers = await register_and_login(client, email="nova-owner@example.com")
    _other, other_headers = await register_and_login(client, email="nova-other@example.com")
    foreign_cv = await insert_cv(email="nova-owner@example.com", title="Private CV")
    jd = await insert_jd(title="Public JD", owner_email="nova-other@example.com")

    response = await client.post(
        "/api/v1/assistant/chat",
        headers=other_headers,
        json={
            "message": "Xác nhận chạy phân tích",
            "operation": {
                "action_type": "run_gap_analysis",
                "cv_id": foreign_cv.id,
                "jd_id": jd.id,
                "confirmed": True,
            },
        },
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_confirmed_gap_operation_runs_real_analysis_with_evidence_contract(client):
    _user, headers = await register_and_login(client, email="nova-gap@example.com")
    cv = await insert_cv(
        email="nova-gap@example.com",
        title="Backend CV",
        raw_text="Backend Developer. Python FastAPI REST API PostgreSQL. Built an API service.",
        parsed_json={"skills": ["Python", "FastAPI", "PostgreSQL"]},
    )
    jd = await insert_jd(
        title="Backend Engineer",
        requirements_text="Yêu cầu Python, FastAPI, PostgreSQL và Docker.",
        owner_email="nova-gap@example.com",
    )

    response = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={
            "message": "Xác nhận chạy Gap Analysis",
            "operation": {
                "action_type": "run_gap_analysis",
                "cv_id": cv.id,
                "jd_id": jd.id,
                "confirmed": True,
            },
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "nova_orchestrator"
    assert body["model"] == "gap_analysis_agent"
    assert "Đã hoàn thành Gap Analysis" in body["response"]
    evidence = next(action for action in body["suggested_actions"] if action["action_type"] == "evidence")
    assert {source["source_type"] for source in evidence["sources"]} >= {"cv", "jd"}
    async with TestingSessionLocal() as session:
        count = await session.scalar(select(func.count(CVAnalysis.id)))
    assert count == 1


@pytest.mark.asyncio
async def test_confirmed_interview_operation_creates_real_session(client):
    _user, headers = await register_and_login(client, email="nova-interview@example.com")
    cv = await insert_cv(email="nova-interview@example.com", title="Interview CV")
    jd = await insert_jd(title="Backend Interview", owner_email="nova-interview@example.com")

    response = await client.post(
        "/api/v1/assistant/chat",
        headers=headers,
        json={
            "message": "Xác nhận tạo phiên phỏng vấn",
            "operation": {
                "action_type": "start_interview",
                "cv_id": cv.id,
                "jd_id": jd.id,
                "confirmed": True,
                "total_questions": 3,
            },
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "nova_orchestrator"
    assert "Câu hỏi đầu tiên" in body["response"]
    assert any(action["page"] == "interview" for action in body["suggested_actions"])
    async with TestingSessionLocal() as session:
        count = await session.scalar(select(func.count(InterviewSession.id)))
    assert count == 1
