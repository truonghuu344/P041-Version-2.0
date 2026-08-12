from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.core.security import get_password_hash
from src.db.models import CV, User
from tests.conftest import TestingSessionLocal


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_auth_and_jds_flow(client):
    # 1. Register Student
    register_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "student1@vinuni.edu.vn",
            "password": "Password123!",
            "full_name": "Nguyễn Văn A",
            "role": "student",
        },
    )
    assert register_res.status_code == 201
    user_data = register_res.json()
    assert user_data["email"] == "student1@vinuni.edu.vn"

    # 2. Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "student1@vinuni.edu.vn", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get /auth/me
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Nguyễn Văn A"

    # 4. List System JDs
    jds_res = await client.get("/api/v1/jds", headers=headers)
    assert jds_res.status_code == 200
    jds = jds_res.json()
    assert len(jds) >= 1

    # 5. Create Custom JD
    custom_jd_res = await client.post(
        "/api/v1/jds/custom",
        json={
            "title": "Backend AI Developer",
            "company": "VinUni AI Lab",
            "location": "Hà Nội",
            "requirements_text": "Yêu cầu kiến thức về Python, FastAPI, PostgreSQL, LangGraph và Docker.",
        },
        headers=headers,
    )
    assert custom_jd_res.status_code == 201
    assert custom_jd_res.json()["title"] == "Backend AI Developer"


@pytest.mark.asyncio
async def test_system_allows_exactly_one_immutable_admin(client):
    async with TestingSessionLocal() as session:
        primary_admin = User(
            email="primary-admin@example.com",
            hashed_password=get_password_hash("Admin123!"),
            full_name="Primary Admin",
            role="admin",
        )
        session.add(primary_admin)
        await session.commit()
        await session.refresh(primary_admin)
        admin_id = primary_admin.id

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "primary-admin@example.com", "password": "Admin123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    public_admin_attempt = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "public-admin-attempt@example.com",
            "password": "Password123!",
            "full_name": "Public Attempt",
            "role": "admin",
        },
    )
    assert public_admin_attempt.status_code == 201
    assert public_admin_attempt.json()["role"] == "student"

    create_admin = await client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": "second-admin@example.com",
            "password": "Password123!",
            "full_name": "Second Admin",
            "role": "admin",
        },
    )
    assert create_admin.status_code == 403

    create_student = await client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": "managed-user@example.com",
            "password": "Password123!",
            "full_name": "Managed User",
            "role": "student",
        },
    )
    assert create_student.status_code == 201
    managed_user_id = create_student.json()["id"]

    promote_user = await client.put(
        f"/api/v1/admin/users/{managed_user_id}",
        headers=headers,
        json={"role": "admin"},
    )
    assert promote_user.status_code == 403

    demote_primary_admin = await client.put(
        f"/api/v1/admin/users/{admin_id}",
        headers=headers,
        json={"role": "student"},
    )
    assert demote_primary_admin.status_code == 400

    async with TestingSessionLocal() as session:
        admins = (await session.execute(select(User).where(User.role == "admin"))).scalars().all()
    assert len(admins) == 1
    assert admins[0].id == admin_id

    async with TestingSessionLocal() as session:
        session.add(
            User(
                email="db-level-admin@example.com",
                hashed_password=get_password_hash("Password123!"),
                full_name="DB-level Attempt",
                role="admin",
            )
        )
        with pytest.raises(IntegrityError):
            await session.commit()


@pytest.mark.asyncio
async def test_delete_cv_removes_database_record_and_uploaded_file(client, tmp_path, monkeypatch):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "delete-cv@example.com",
            "password": "Password123!",
            "full_name": "Delete CV User",
            "role": "student",
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "delete-cv@example.com", "password": "Password123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    uploaded_file = tmp_path / "delete-me.pdf"
    uploaded_file.write_bytes(b"temporary cv")
    monkeypatch.setattr("src.api.v1.cvs.UPLOAD_DIR", str(tmp_path))

    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == "delete-cv@example.com"))).scalar_one()
        cv = CV(
            user_id=user.id,
            title="CV cần xóa",
            file_path=str(uploaded_file),
            raw_text="Temporary CV text",
            parsed_json={},
        )
        session.add(cv)
        await session.commit()
        await session.refresh(cv)
        cv_id = cv.id

    response = await client.delete(f"/api/v1/cvs/{cv_id}", headers=headers)

    assert response.status_code == 204
    assert not uploaded_file.exists()
    async with TestingSessionLocal() as session:
        assert await session.get(CV, cv_id) is None


@pytest.mark.asyncio
async def test_bulk_delete_cvs_removes_selected_records_and_files(client, tmp_path, monkeypatch):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "bulk-delete-cv@example.com",
            "password": "Password123!",
            "full_name": "Bulk Delete CV User",
            "role": "student",
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "bulk-delete-cv@example.com", "password": "Password123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    monkeypatch.setattr("src.api.v1.cvs.UPLOAD_DIR", str(tmp_path))

    uploaded_files = [tmp_path / f"cv-{index}.pdf" for index in range(3)]
    for uploaded_file in uploaded_files:
        uploaded_file.write_bytes(b"temporary cv")

    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == "bulk-delete-cv@example.com"))).scalar_one()
        cvs = [
            CV(
                user_id=user.id,
                title=f"CV {index}",
                file_path=str(uploaded_file),
                raw_text="Temporary CV text",
                parsed_json={},
            )
            for index, uploaded_file in enumerate(uploaded_files)
        ]
        session.add_all(cvs)
        await session.commit()
        for cv in cvs:
            await session.refresh(cv)
        cv_ids = [cv.id for cv in cvs]

    response = await client.post(
        "/api/v1/cvs/bulk-delete",
        headers=headers,
        json={"cv_ids": [cv_ids[0], cv_ids[1], cv_ids[0]]},
    )

    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2
    assert set(response.json()["deleted_ids"]) == {cv_ids[0], cv_ids[1]}
    assert not uploaded_files[0].exists()
    assert not uploaded_files[1].exists()
    assert uploaded_files[2].exists()
    async with TestingSessionLocal() as session:
        assert await session.get(CV, cv_ids[0]) is None
        assert await session.get(CV, cv_ids[1]) is None
        assert await session.get(CV, cv_ids[2]) is not None


@pytest.mark.asyncio
async def test_two_ai_agent_workflows_match_frontend_contract(client, monkeypatch):
    fallback_settings = SimpleNamespace(google_genai_api_key="", model_name="gemini-3.5-flash")
    monkeypatch.setattr("src.agents.nodes.gap_analysis_nodes.get_settings", lambda: fallback_settings)
    monkeypatch.setattr("src.agents.nodes.interview_nodes.get_settings", lambda: fallback_settings)

    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "agents@vinuni.edu.vn",
            "password": "Password123!",
            "full_name": "Agent Test Student",
            "role": "student",
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "agents@vinuni.edu.vn", "password": "Password123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    async with TestingSessionLocal() as session:
        user_result = await session.execute(select(User).where(User.email == "agents@vinuni.edu.vn"))
        user = user_result.scalar_one()
        cv = CV(
            user_id=user.id,
            title="Backend CV",
            raw_text=(
                "Tôi đã phát triển REST API bằng Python và FastAPI cho đồ án tốt nghiệp. "
                "Tôi phối hợp làm việc nhóm và phân tích log để sửa lỗi hệ thống."
            ),
            parsed_json={"skills": ["Python", "FastAPI", "REST API"]},
        )
        session.add(cv)
        await session.commit()
        await session.refresh(cv)
        cv_id = cv.id

    jd_response = await client.post(
        "/api/v1/jds/custom",
        json={
            "title": "Backend Developer",
            "company": "AI Lab",
            "location": "Hà Nội",
            "requirements_text": ("Yêu cầu Python, FastAPI, REST API, PostgreSQL, Docker và kỹ năng làm việc nhóm."),
        },
        headers=headers,
    )
    jd_id = jd_response.json()["id"]

    gap_response = await client.post(
        "/api/v1/analysis/gap-analysis",
        json={"cv_id": cv_id, "jd_id": jd_id},
        headers=headers,
    )
    assert gap_response.status_code == 201
    gap = gap_response.json()
    assert set(gap["hard_skills_matching"]) == {"Python", "FastAPI", "REST API"}
    assert set(gap["hard_skills_missing"]) == {"PostgreSQL", "Docker"}
    assert gap["pipeline_version"] == "1.0"
    assert gap["requirement_evidence"]
    assert gap["final_score"] == gap["match_score"]
    assert gap["criteria"]
    assert gap["retrieval_results"]
    assert gap["evidence"]
    assert gap["versions"]["retrieval"] == "1.0-bm25-vector-rrf"
    assert sum(item["weighted_score"] for item in gap["criteria"]) == pytest.approx(gap["final_score"])
    assert 0 <= gap["confidence_score"] <= 1
    assert gap["suggestions"]
    assert gap["priority_actions"]
    assert gap["learning_recommendations"]
    assert gap["certification_recommendations"]
    assert gap["project_recommendations"]
    assert gap["cv_section_recommendations"]

    evidence_response = await client.get(
        f"/api/v1/analysis/{gap['id']}/evidence",
        headers=headers,
    )
    report_response = await client.get(
        f"/api/v1/analysis/{gap['id']}/report",
        headers=headers,
    )
    assert evidence_response.status_code == 200
    assert evidence_response.json()
    assert report_response.status_code == 200
    assert report_response.json()["final_score"] == gap["final_score"]

    start_response = await client.post(
        "/api/v1/interviews/start",
        json={"cv_id": cv_id, "jd_id": jd_id, "total_questions": 5},
        headers=headers,
    )
    assert start_response.status_code == 201
    session_id = start_response.json()["session_id"]

    star_answer = (
        "Khi hệ thống bị chậm, nhiệm vụ của tôi là tìm nguyên nhân. "
        "Tôi đã phân tích log, tối ưu truy vấn và kết quả thời gian phản hồi giảm 20%."
    )
    for question_index in range(5):
        answer_response = await client.post(
            f"/api/v1/interviews/{session_id}/answer",
            json={"user_answer": star_answer},
            headers=headers,
        )
        assert answer_response.status_code == 200
        assert answer_response.json()["is_last_question"] is (question_index == 4)

    report_response = await client.get(f"/api/v1/interviews/{session_id}/report", headers=headers)
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["total_score"] > 70
    assert set(report["star_scores"]) == {"situation", "task", "action", "result"}
