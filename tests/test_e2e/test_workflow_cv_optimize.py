"""
WF1-001 → WF1-006: Workflow 1 — Happy Path CV Optimization

Kịch bản: Người dùng upload CV → analyze với JD → accept/reject suggestions → download.
Kiểm tra state nhất quán: cv_id và suggestion_id thực sự chảy từ step này sang step khác.

Khác với unit tests (test_api/): E2E tests dùng FIXTURE CHAINING —
  uploaded_cv → analyzed_cv → accept/reject/export
mỗi test nhận dữ liệu thật từ response của bước trước, không hardcode UUID.

NOTE MVP: Các endpoints /api/v1/cv/upload, /api/v1/cv/analyze, /api/v1/cv/suggestions/*,
/api/v1/cv/{id}/export cần được implement. Tests sẽ skip nếu endpoint chưa có.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.test_e2e.conftest import (
    build_mock_accept,
    build_mock_export,
    build_mock_reject,
)

ENDPOINT_NOT_IMPL = pytest.mark.skip(reason="Endpoint chưa được implement trong MVP")


# ─── WF1-001: Upload CV → nhận cv_id hợp lệ ──────────────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_upload_returns_valid_cv_id(uploaded_cv):
    """WF1-001: Bước đầu tiên của workflow — upload CV phải trả về cv_id có thể dùng tiếp.

    Verify:
    - cv_id là string không rỗng (UUID format)
    - parse_confidence >= 0.90 (AC F-02)
    - Có đủ 4 sections: education, skills, experience, projects
    """
    assert "cv_id" in uploaded_cv, "Upload phải trả về cv_id"
    assert len(uploaded_cv["cv_id"]) > 0, "cv_id không được rỗng"

    # Kiểm tra UUID format (có thể parse được)
    uuid.UUID(uploaded_cv["cv_id"])  # Raises nếu không hợp lệ

    assert uploaded_cv.get("parse_confidence", 0) >= 0.90, (
        f"WF1-001 FAIL: parse_confidence={uploaded_cv.get('parse_confidence')} < 0.90 (AC F-02)"
    )

    sections = uploaded_cv.get("sections", {})
    for section in ("education", "skills", "experience", "projects"):
        assert section in sections, f"WF1-001 FAIL: Thiếu section '{section}'"


# ─── WF1-002: Analyze dùng cv_id từ upload ────────────────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_analyze_uses_uploaded_cv_id(uploaded_cv, analyzed_cv):
    """WF1-002: cv_id từ upload phải được dùng đúng trong bước analyze.

    Verify:
    - analyzed_cv["cv_id"] khớp với uploaded_cv["cv_id"] (state nhất quán)
    - match_score trong [0, 100]
    - Có ít nhất 1 suggestion
    - Mỗi suggestion có suggestion_id (cần cho Accept/Reject — AC F-04)
    """
    assert analyzed_cv["cv_id"] == uploaded_cv["cv_id"], (
        "WF1-002 FAIL: cv_id trong analyze khác với cv_id từ upload — state không nhất quán!"
    )

    score = analyzed_cv.get("match_score", -1)
    assert 0 <= score <= 100, f"WF1-002 FAIL: match_score={score} ngoài [0, 100]"

    suggestions = analyzed_cv.get("suggestions", [])
    assert len(suggestions) > 0, (
        "WF1-002 FAIL: CV có skills phù hợp JD nhưng không có suggestion nào"
    )

    for s in suggestions:
        assert "suggestion_id" in s, (
            f"WF1-002 FAIL: Suggestion thiếu suggestion_id (không Accept/Reject được)\n"
            f"Suggestion: {s}"
        )


# ─── WF1-003: Accept suggestion dùng suggestion_id thật từ analyze ───────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_accept_suggestion_from_analyze(e2e_client, analyzed_cv):
    """WF1-003: Lấy suggestion_id từ kết quả analyze → accept thành công.

    Verify:
    - Dùng suggestion_id THẬT từ step trước, không hardcode
    - Response status == "accepted"
    - suggestion_id trong response khớp với cái đã gửi
    """
    suggestions = analyzed_cv.get("suggestions", [])
    assert len(suggestions) > 0, "WF1-003: Cần có suggestions từ bước analyze"

    # Lấy suggestion đầu tiên — đây là ID thật từ response analyze
    first_suggestion = suggestions[0]
    suggestion_id = first_suggestion["suggestion_id"]

    with patch(
        "src.services.cv_service.accept_suggestion",
        new_callable=AsyncMock,
        return_value=build_mock_accept(suggestion_id),
    ):
        response = await e2e_client.post(
            f"/api/v1/cv/suggestions/{suggestion_id}/accept"
        )

    assert response.status_code == 200, (
        f"WF1-003 FAIL: Accept suggestion trả {response.status_code}"
    )
    data = response.json()
    assert data.get("status") == "accepted", (
        f"WF1-003 FAIL: status không phải 'accepted', nhận: {data.get('status')}"
    )
    assert data.get("suggestion_id") == suggestion_id, (
        "WF1-003 FAIL: suggestion_id trong response khác với cái đã gửi"
    )


# ─── WF1-004: Reject suggestion khác trong cùng phiên ────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_reject_other_suggestion(e2e_client, analyzed_cv):
    """WF1-004: Reject suggestion thứ 2 trong cùng phiên analyze.

    Verify:
    - User có thể chọn lọc: accept cái này, reject cái kia
    - Reject trả status == "rejected"
    - suggestion_id khớp
    """
    suggestions = analyzed_cv.get("suggestions", [])
    assert len(suggestions) >= 2, "WF1-004: Cần ít nhất 2 suggestions để test accept/reject mix"

    # Reject suggestion thứ 2
    second_suggestion = suggestions[1]
    suggestion_id = second_suggestion["suggestion_id"]

    with patch(
        "src.services.cv_service.reject_suggestion",
        new_callable=AsyncMock,
        return_value=build_mock_reject(suggestion_id),
    ):
        response = await e2e_client.post(
            f"/api/v1/cv/suggestions/{suggestion_id}/reject"
        )

    assert response.status_code == 200, (
        f"WF1-004 FAIL: Reject suggestion trả {response.status_code}"
    )
    data = response.json()
    assert data.get("status") == "rejected", (
        f"WF1-004 FAIL: status không phải 'rejected', nhận: {data.get('status')}"
    )


# ─── WF1-005: Download CV sau khi accept suggestion ──────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_export_cv_after_accept(e2e_client, analyzed_cv):
    """WF1-005: Sau khi accept suggestions → export CV phải thành công.

    Verify:
    - Export dùng cv_id thật từ bước analyze
    - Response có download_url
    - cv_id trong export khớp với cv_id đã analyze
    """
    cv_id = analyzed_cv["cv_id"]

    with patch(
        "src.services.cv_service.export_cv",
        new_callable=AsyncMock,
        return_value=build_mock_export(cv_id),
    ):
        response = await e2e_client.get(f"/api/v1/cv/{cv_id}/export")

    assert response.status_code == 200, (
        f"WF1-005 FAIL: Export CV trả {response.status_code} — "
        f"cv_id={cv_id}"
    )
    data = response.json()
    assert "download_url" in data, "WF1-005 FAIL: Response thiếu download_url"
    assert data.get("cv_id") == cv_id, (
        "WF1-005 FAIL: cv_id trong export khác với cv_id đã analyze"
    )


# ─── WF1-006: cv_id idempotent — tra cứu lại được sau download ───────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf1_cv_id_idempotent_after_export(e2e_client, uploaded_cv, analyzed_cv):
    """WF1-006: Sau khi download, cv_id vẫn còn trong hệ thống — có thể analyze lại.

    Verify:
    - cv_id không bị xóa hay invalidate sau export
    - Analyze lại cùng cv_id với JD khác → vẫn trả 200 (không 404)
    - match_score của lần analyze mới độc lập (khác JD → khác score)

    Đây là property quan trọng: CV là immutable asset, user có thể analyze
    nhiều lần với nhiều JD khác nhau mà không cần upload lại.
    """
    cv_id = analyzed_cv["cv_id"]
    assert cv_id == uploaded_cv["cv_id"], "Prerequisite: cv_id phải nhất quán"

    # Analyze lần 2 với JD hoàn toàn khác
    new_jd_text = (
        "Data Analyst\n"
        "Yêu cầu: SQL, Python, Excel, Power BI\n"
        "Cộng: Tableau, Spark, Machine Learning cơ bản"
    )
    second_analyze_mock = {
        "match_score": 55.0,  # Khác với lần 1 (72.5) vì JD khác
        "gap_analysis": {
            "matched_skills": ["Python"],
            "missing_hard_skills": ["SQL expertise", "Power BI", "Excel advanced"],
            "missing_soft_skills": [],
            "missing_keywords": ["data analysis", "visualization"],
        },
        "suggestions": [],
    }

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=second_analyze_mock,
    ):
        response = await e2e_client.post(
            "/api/v1/cv/analyze",
            json={"cv_id": cv_id, "jd_text": new_jd_text},
        )

    assert response.status_code == 200, (
        f"WF1-006 FAIL: cv_id={cv_id} không còn valid sau export — "
        f"nhận {response.status_code} thay vì 200"
    )
    data = response.json()
    # Score lần 2 khác lần 1 vì JD khác → verify không bị cache bẩn
    assert data["match_score"] != analyzed_cv["match_score"], (
        "WF1-006 WARN: match_score hai lần analyze với JD khác nhau lại giống nhau — "
        "có thể bị cache"
    )
