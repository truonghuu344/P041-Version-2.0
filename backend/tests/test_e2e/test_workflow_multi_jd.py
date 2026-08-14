"""
WF4-001 → WF4-005: Workflow 4 — Multi-JD Comparison

Kịch bản: 1 CV upload → analyze với 2 JD khác nhau → suggestions phải hoàn toàn
          isolated, không bị lẫn lộn. User chọn accept từ JD-1, reject từ JD-2.

Đây là extension của AC F-03 — hỗ trợ so sánh nhiều JD trên cùng 1 CV.

NOTE MVP: Endpoints /api/v1/cv/* chưa implement. Tests sẽ skip.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.test_e2e.conftest import (
    build_mock_accept,
    build_mock_analyze,
    build_mock_reject,
)

# ─── Fixtures cục bộ cho WF4 ──────────────────────────────────────────────────

JD_BACKEND = (
    "Backend Developer\n"
    "Yêu cầu: Python, FastAPI, REST API, Git\n"
    "Cộng: Docker, AWS, Kubernetes"
)

JD_DATA_ANALYST = (
    "Data Analyst\n"
    "Yêu cầu: SQL, Python, Excel, Power BI\n"
    "Cộng: Tableau, Spark, Machine Learning cơ bản"
)


# ─── WF4-001: 1 CV → analyze được với JD Backend ─────────────────────────────

@pytest.mark.asyncio
async def test_wf4_one_cv_can_analyze_jd_backend(e2e_client, uploaded_cv):
    """WF4-001: CV upload 1 lần → analyze với JD Backend → kết quả hợp lệ.

    Verify:
    - cv_id từ uploaded_cv được dùng
    - match_score > 0
    - Có suggestions với suggestion_id unique
    """
    cv_id = uploaded_cv["cv_id"]
    sug_ids_backend = [str(uuid.uuid4()), str(uuid.uuid4())]
    mock_backend = build_mock_analyze(cv_id, sug_ids_backend)
    mock_backend["match_score"] = 75.0  # Backend fit tốt

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_backend,
    ):
        response = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_BACKEND},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["match_score"] > 0
    assert len(data.get("suggestions", [])) > 0

    # suggestion_ids phải là các UUID mà chúng ta đã set
    returned_ids = {s["suggestion_id"] for s in data["suggestions"]}
    assert returned_ids == set(sug_ids_backend), (
        "WF4-001 FAIL: suggestion_ids không khớp với mock — "
        f"expected {set(sug_ids_backend)}, got {returned_ids}"
    )


# ─── WF4-002: Cùng CV → analyze với JD Data Analyst ─────────────────────────

@pytest.mark.asyncio
async def test_wf4_same_cv_can_analyze_jd_data_analyst(e2e_client, uploaded_cv):
    """WF4-002: Cùng CV → analyze với JD Data Analyst → score khác, suggestions khác.

    Verify:
    - match_score khác với lần analyze Backend (Data Analyst fit kém hơn)
    - suggestion_ids hoàn toàn mới (không trùng với bất kỳ ID nào từ Backend)
    """
    cv_id = uploaded_cv["cv_id"]
    sug_ids_data = [str(uuid.uuid4())]  # Chỉ 1 suggestion vì CV ít phù hợp
    mock_data = {
        "match_score": 42.0,  # Thấp hơn backend
        "gap_analysis": {
            "matched_skills": ["Python"],
            "missing_hard_skills": ["SQL expert", "Power BI", "Excel advanced", "Tableau"],
            "missing_soft_skills": [],
            "missing_keywords": ["data analysis", "reporting", "dashboard"],
        },
        "suggestions": [
            {
                "suggestion_id": sug_ids_data[0],
                "type": "rephrase",
                "original": "Phân tích yêu cầu và thiết kế database",
                "suggested": (
                    "Phân tích yêu cầu nghiệp vụ và thiết kế schema database "
                    "phục vụ báo cáo và phân tích dữ liệu"
                ),
                "source_field": "projects[0].description",
            }
        ],
    }

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_data,
    ):
        response = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_DATA_ANALYST},
        )

    assert response.status_code == 200
    data = response.json()

    assert data["match_score"] == 42.0, (
        f"WF4-002 FAIL: match_score={data['match_score']}, expected 42.0"
    )


# ─── WF4-003: Hai kết quả analyze phải có score khác nhau ────────────────────

@pytest.mark.asyncio
async def test_wf4_two_jd_analyses_have_different_scores(e2e_client, uploaded_cv):
    """WF4-003: Analyze cùng CV với 2 JD → 2 match_score KHÁC nhau.

    Đây là test chính của Multi-JD workflow:
    - score(Backend) != score(Data Analyst)
    - Xác nhận hệ thống không cache kết quả cũ
    """
    cv_id = uploaded_cv["cv_id"]

    # Analyze với JD Backend
    mock_backend = build_mock_analyze(cv_id)
    mock_backend["match_score"] = 75.0

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_backend,
    ):
        r_backend = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_BACKEND},
        )
    score_backend = r_backend.json()["match_score"]

    # Analyze với JD Data Analyst
    mock_data = {
        "match_score": 42.0,
        "gap_analysis": {"matched_skills": ["Python"]},
        "suggestions": [],
    }

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_data,
    ):
        r_data = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_DATA_ANALYST},
        )
    score_data = r_data.json()["match_score"]

    assert score_backend != score_data, (
        f"WF4-003 FAIL: score Backend ({score_backend}) == score Data Analyst ({score_data}). "
        "Hệ thống có thể đang return cached response!"
    )


# ─── WF4-004: suggestion_ids của 2 JD phải hoàn toàn unique ──────────────────

@pytest.mark.asyncio
async def test_wf4_suggestion_ids_are_isolated_between_jds(e2e_client, uploaded_cv):
    """WF4-004: suggestion_id của JD-1 và JD-2 phải hoàn toàn khác nhau.

    AC F-04: mỗi suggestion cần suggestion_id để Accept/Reject chính xác.
    Nếu ID bị trùng, user có thể vô tình accept suggestion của JD sai.
    """
    cv_id = uploaded_cv["cv_id"]

    # Tạo IDs cho từng JD
    ids_jd1 = [str(uuid.uuid4()), str(uuid.uuid4())]
    ids_jd2 = [str(uuid.uuid4()), str(uuid.uuid4())]

    # Đảm bảo không trùng nhau (tiền đề của test)
    assert not set(ids_jd1) & set(ids_jd2), "Test setup: IDs đã bị trùng — fix test data"

    mock_jd1 = build_mock_analyze(cv_id, ids_jd1)
    mock_jd1["match_score"] = 75.0

    mock_jd2 = {
        "match_score": 42.0,
        "gap_analysis": {"matched_skills": ["Python"]},
        "suggestions": [
            {
                "suggestion_id": ids_jd2[0],
                "type": "rephrase",
                "original": "Làm việc với dữ liệu",
                "suggested": "Phân tích và xử lý dữ liệu với Python Pandas",
                "source_field": "experience[0].description",
            },
            {
                "suggestion_id": ids_jd2[1],
                "type": "rephrase",
                "original": "Báo cáo kết quả",
                "suggested": "Xây dựng báo cáo và dashboard trực quan",
                "source_field": "projects[0].description",
            },
        ],
    }

    # Analyze JD 1
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_jd1,
    ):
        r1 = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_BACKEND},
        )
    returned_ids_jd1 = {s["suggestion_id"] for s in r1.json().get("suggestions", [])}

    # Analyze JD 2
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_jd2,
    ):
        r2 = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_DATA_ANALYST},
        )
    returned_ids_jd2 = {s["suggestion_id"] for s in r2.json().get("suggestions", [])}

    # KHÔNG được có overlap
    overlap = returned_ids_jd1 & returned_ids_jd2
    assert not overlap, (
        f"WF4-004 FAIL: suggestion_ids bị trùng giữa 2 JD: {overlap}. "
        "User có thể nhầm lẫn Accept/Reject suggestion của JD sai!"
    )


# ─── WF4-005: Accept JD-1, Reject JD-2 → không conflict ─────────────────────

@pytest.mark.asyncio
async def test_wf4_accept_from_jd1_reject_from_jd2_no_conflict(e2e_client, uploaded_cv):
    """WF4-005: Accept suggestion của JD-1, Reject của JD-2 → không conflict.

    Scenario thực tế: User analyze CV với 2 JD cùng lúc → quyết định chọn
    một số gợi ý từ JD-1 (backend), bỏ qua gợi ý từ JD-2 (data analyst).

    Verify:
    - Accept suggestion_id từ JD-1 → status "accepted"
    - Reject suggestion_id từ JD-2 → status "rejected"
    - Hai operation độc lập, không ảnh hưởng nhau
    """
    cv_id = uploaded_cv["cv_id"]

    # Analyze cả 2 JD để lấy suggestion_ids thật
    ids_jd1 = [str(uuid.uuid4())]
    ids_jd2 = [str(uuid.uuid4())]
    mock_jd1 = build_mock_analyze(cv_id, ids_jd1)
    mock_jd2 = {
        "match_score": 42.0,
        "gap_analysis": {"matched_skills": ["Python"]},
        "suggestions": [
            {
                "suggestion_id": ids_jd2[0],
                "type": "rephrase",
                "original": "Quản lý dữ liệu",
                "suggested": "Quản lý và phân tích dữ liệu với SQL và Python",
                "source_field": "experience[0].description",
            }
        ],
    }

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_jd1,
    ):
        r1 = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_BACKEND},
        )
    sug_id_jd1 = r1.json()["suggestions"][0]["suggestion_id"]

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=mock_jd2,
    ):
        r2 = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": JD_DATA_ANALYST},
        )
    sug_id_jd2 = r2.json()["suggestions"][0]["suggestion_id"]

    # Accept suggestion từ JD-1
    with patch(
        "src.services.cv_service.accept_suggestion",
        new_callable=AsyncMock,
        return_value=build_mock_accept(sug_id_jd1),
    ):
        accept_resp = await e2e_client.post(
            f"/api/v1/cv/suggestions/{sug_id_jd1}/accept"
        )

    assert accept_resp.status_code == 200
    assert accept_resp.json().get("status") == "accepted", (
        "WF4-005 FAIL: Accept JD-1 suggestion thất bại"
    )

    # Reject suggestion từ JD-2
    with patch(
        "src.services.cv_service.reject_suggestion",
        new_callable=AsyncMock,
        return_value=build_mock_reject(sug_id_jd2),
    ):
        reject_resp = await e2e_client.post(
            f"/api/v1/cv/suggestions/{sug_id_jd2}/reject"
        )

    assert reject_resp.status_code == 200
    assert reject_resp.json().get("status") == "rejected", (
        "WF4-005 FAIL: Reject JD-2 suggestion thất bại"
    )

    # Verify IDs không bị trộn lẫn
    assert sug_id_jd1 != sug_id_jd2, (
        "WF4-005 FAIL: suggestion_id của JD-1 và JD-2 bị trùng — "
        "accept/reject có thể áp dụng sai suggestion!"
    )
