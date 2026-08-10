"""
WF3-001 → WF3-006: Workflow 3 — Full Interview Flow

Kịch bản: Analyze CV + JD → Start interview session → Trả lời câu hỏi →
          AI hỏi follow-up khi câu trả lời ngắn → Session completed → Lấy STAR report.

Chain dependency: analyzed_cv → started_session → answer loop → report

NOTE MVP: Endpoints /api/v1/interview/* chưa implement. Tests sẽ skip.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.test_e2e.conftest import (
    build_mock_answer_followup,
    build_mock_answer_next,
    build_mock_session_complete,
    build_mock_star_report,
)

ENDPOINT_NOT_IMPL = pytest.mark.skip(reason="Endpoint chưa được implement trong MVP")


# ─── WF3-001: Analyze xong → có thể start interview với cv_id đó ─────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_analyze_enables_interview_start(analyzed_cv):
    """WF3-001: cv_id từ analyze phải đủ điều kiện để start interview (AC F-05).

    Verify:
    - analyzed_cv["cv_id"] là UUID hợp lệ
    - match_score > 0 (có điểm → có thể tạo câu hỏi liên quan)
    - Gap analysis có dữ liệu để AI generate câu hỏi phỏng vấn
    """
    assert "cv_id" in analyzed_cv
    uuid.UUID(analyzed_cv["cv_id"])  # Phải là UUID hợp lệ

    assert analyzed_cv.get("match_score", 0) > 0, (
        "WF3-001: match_score = 0 — không thể generate câu hỏi phỏng vấn có ý nghĩa"
    )

    gap = analyzed_cv.get("gap_analysis", {})
    assert "matched_skills" in gap, "WF3-001: Thiếu matched_skills trong gap_analysis"


# ─── WF3-002: Start interview → session_id + câu hỏi đầu tiên ────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_start_interview_returns_session_id(started_session):
    """WF3-002: Start interview với cv_id + jd_id → session_id và câu hỏi đầu tiên.

    Verify:
    - session_id là UUID hợp lệ
    - Có câu hỏi đầu tiên (current_question)
    - total_questions trong [5, 7] (AC F-05)
    - status == "active"
    """
    assert "session_id" in started_session
    uuid.UUID(started_session["session_id"])

    assert "current_question" in started_session, (
        "WF3-002 FAIL: Start interview phải trả về câu hỏi đầu tiên ngay"
    )
    assert len(started_session["current_question"]) > 10, (
        "WF3-002 FAIL: Câu hỏi quá ngắn — không phải câu hỏi phỏng vấn thật"
    )

    total_q = started_session.get("total_questions", 0)
    assert 5 <= total_q <= 7, (
        f"WF3-002 FAIL: total_questions={total_q} không trong [5, 7] (AC F-05)"
    )

    assert started_session.get("status") == "active"


# ─── WF3-003: Trả lời câu hỏi đủ ý → chuyển sang câu tiếp ───────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_sufficient_answer_advances_to_next_question(e2e_client, started_session):
    """WF3-003: Câu trả lời đầy đủ STAR → không trigger follow-up, chuyển câu tiếp.

    Verify:
    - session_id từ started_session được dùng đúng
    - is_follow_up == False
    - current_question_index tăng lên 1
    - status vẫn "active"
    """
    session_id = started_session["session_id"]
    next_q_mock = build_mock_answer_next(session_id, question_index=1)

    # Câu trả lời đủ STAR
    good_answer = (
        "Tình huống: Trong dự án thực tập ở FPT Software, team cần tích hợp payment gateway. "
        "Nhiệm vụ: Tôi phụ trách viết module thanh toán với VNPay. "
        "Hành động: Tôi đọc docs VNPay API, implement HMAC signature, viết unit test coverage 90%+. "
        "Kết quả: Module hoạt động ổn định, xử lý 500+ transaction trong tuần đầu go-live."
    )

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=next_q_mock,
    ):
        response = await e2e_client.post(
            f"/api/v1/interview/{session_id}/answer",
            json={"answer": good_answer},
        )

    assert response.status_code == 200
    data = response.json()

    assert data.get("is_follow_up", False) is False, (
        "WF3-003 FAIL: Câu trả lời đủ ý không được trigger follow-up"
    )
    assert data.get("current_question_index", 0) == 1, (
        f"WF3-003 FAIL: Sau câu trả lời đủ ý, question_index phải là 1, "
        f"nhưng là {data.get('current_question_index')}"
    )
    assert data.get("status") == "active"


# ─── WF3-004: Câu trả lời ngắn → AI hỏi follow-up ───────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_short_answer_triggers_followup(e2e_client, started_session):
    """WF3-004: Câu trả lời quá ngắn → AI đặt follow-up, không chuyển câu (AC F-05).

    Verify:
    - session_id được dùng đúng
    - is_follow_up == True
    - current_question_index KHÔNG tăng (vẫn ở câu cũ)
    - Câu hỏi follow-up là câu hỏi gợi mở (không phải câu hỏi chính mới)
    """
    session_id = started_session["session_id"]
    followup_mock = build_mock_answer_followup(session_id)

    short_answer = "Tôi đã làm dự án Python."  # Quá ngắn, thiếu hoàn toàn STAR

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=followup_mock,
    ):
        response = await e2e_client.post(
            f"/api/v1/interview/{session_id}/answer",
            json={"answer": short_answer},
        )

    assert response.status_code == 200
    data = response.json()

    assert data.get("is_follow_up") is True, (
        f"WF3-004 FAIL: Câu trả lời '{short_answer}' phải trigger follow-up (AC F-05)"
    )
    # Index không tăng khi cần follow-up
    assert data.get("current_question_index", -1) == 0, (
        f"WF3-004 FAIL: Khi follow-up, question_index không được tăng — "
        f"nhận {data.get('current_question_index')}"
    )


# ─── WF3-005: Hoàn thành phiên → lấy STAR report ────────────────────────────

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_get_star_report_after_completion(e2e_client, started_session):
    """WF3-005: Sau khi phiên hoàn thành → GET report trả đủ STAR scores.

    Verify (AC F-06):
    - 4 tiêu chí STAR có mặt: situation, task, action, result
    - total_score trong [0, 100]
    - Có strengths và improvements
    - Có sample_answers dạng guidance (không phải nội dung bịa đặt)
    """
    session_id = started_session["session_id"]
    cv_id = started_session["cv_id"]
    report_mock = build_mock_star_report(session_id, cv_id)

    with patch(
        "src.services.interview_service.get_report",
        new_callable=AsyncMock,
        return_value=report_mock,
    ):
        response = await e2e_client.get(f"/api/v1/interview/{session_id}/report")

    assert response.status_code == 200
    data = response.json()

    # Kiểm tra đủ 4 tiêu chí STAR
    star = data.get("star_scores", {})
    for criterion in ("situation", "task", "action", "result"):
        assert criterion in star, f"WF3-005 FAIL: Thiếu tiêu chí STAR: {criterion}"
        score = star[criterion]
        assert 0 <= score <= 100, (
            f"WF3-005 FAIL: {criterion}={score} ngoài thang [0, 100]"
        )

    # Total score hợp lệ
    total = data.get("total_score", -1)
    assert 0 <= total <= 100, f"WF3-005 FAIL: total_score={total} ngoài [0, 100]"

    # Phải có feedback
    assert len(data.get("strengths", [])) > 0, "WF3-005 FAIL: Thiếu strengths"
    assert len(data.get("improvements", [])) > 0, "WF3-005 FAIL: Thiếu improvements"


# ─── WF3-006: Sample answers trong report phải là guidance, không bịa nội dung ─

@ENDPOINT_NOT_IMPL
@pytest.mark.asyncio
async def test_wf3_sample_answers_are_guidance_not_fabrication(e2e_client, started_session):
    """WF3-006: Gợi ý câu trả lời mẫu trong STAR report phải là hướng dẫn cấu trúc.

    AC F-06 + Guardrail nguyên tắc liêm chính:
    - sample_answers nên dạng HƯỚNG DẪN ("Dùng cấu trúc: S → T → A → R")
    - Không được là câu trả lời thay thế chứa thành tích bịa đặt
    - Phải có field "guidance" hoặc "ideal_answer" (không được là empty)

    Kết hợp với G-013: AI phải hỏi thay vì tự điền số liệu.
    """
    session_id = started_session["session_id"]
    cv_id = started_session["cv_id"]
    report_mock = build_mock_star_report(session_id, cv_id)

    with patch(
        "src.services.interview_service.get_report",
        new_callable=AsyncMock,
        return_value=report_mock,
    ):
        response = await e2e_client.get(f"/api/v1/interview/{session_id}/report")

    data = response.json()
    sample_answers = data.get("sample_answers", [])

    # Phải có ít nhất 1 sample answer
    assert len(sample_answers) > 0, (
        "WF3-006 FAIL: STAR report phải có sample_answers để guide student"
    )

    # Mỗi sample answer phải có guidance hoặc ideal_answer
    for sa in sample_answers:
        has_guidance = "guidance" in sa or "ideal_answer" in sa
        assert has_guidance, (
            f"WF3-006 FAIL: sample_answer thiếu field 'guidance' hoặc 'ideal_answer'.\n"
            f"Fields hiện tại: {list(sa.keys())}"
        )

        # Kiểm tra không có số liệu bịa đặt kiểu "300% increase", "$1M revenue"
        content = sa.get("guidance", sa.get("ideal_answer", ""))
        suspicious_patterns = ["300%", "$1M", "10,000 users", "tripled revenue"]
        for pattern in suspicious_patterns:
            assert pattern not in content, (
                f"WF3-006 FAIL: sample_answer chứa số liệu bịa đặt '{pattern}'!\n"
                f"Content: {content[:150]}"
            )
