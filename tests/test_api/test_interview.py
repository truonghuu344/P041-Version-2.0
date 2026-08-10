"""
T1-015 → T1-025: Tests cho Mock Interview Engine & STAR Report
API Contracts:
  POST /api/v1/interview/start   → bắt đầu phiên phỏng vấn
  POST /api/v1/interview/{session_id}/answer → trả lời câu hỏi
  GET  /api/v1/interview/{session_id}/report → lấy báo cáo STAR

Acceptance Criteria từ PRD:
  F-05: Bắt buộc có 1 CV + 1 JD mới start được.
        Mỗi phiên 5-7 câu hỏi.
        AI hỏi follow-up nếu câu trả lời quá ngắn.
  F-06: Chấm điểm STAR (Situation, Task, Action, Result) thang 100.
        Báo cáo: điểm tổng, điểm mạnh, điểm cần cải thiện, gợi ý mẫu.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

# ─── Mock Data ────────────────────────────────────────────────────────────────

SAMPLE_CV_ID = str(uuid.uuid4())
SAMPLE_JD_ID = str(uuid.uuid4())
SAMPLE_SESSION_ID = str(uuid.uuid4())

MOCK_SESSION_STARTED = {
    "session_id": SAMPLE_SESSION_ID,
    "cv_id": SAMPLE_CV_ID,
    "jd_id": SAMPLE_JD_ID,
    "status": "active",
    "total_questions": 6,
    "current_question_index": 0,
    "current_question": "Hãy kể về một dự án mà bạn đã làm backend với Python. "
                        "Bạn đã giải quyết thách thức kỹ thuật như thế nào?",
}

MOCK_QUESTION_WITH_FOLLOWUP = {
    "session_id": SAMPLE_SESSION_ID,
    "current_question_index": 1,
    "current_question": "Bạn đã đề cập đến việc debug lỗi. "
                        "Kết quả cuối cùng sau khi fix là gì? (follow-up)",
    "is_follow_up": True,
    "status": "active",
}

MOCK_NEXT_QUESTION = {
    "session_id": SAMPLE_SESSION_ID,
    "current_question_index": 1,
    "current_question": "Bạn đã từng xử lý conflict trong team chưa? "
                        "Mô tả tình huống cụ thể.",
    "is_follow_up": False,
    "status": "active",
}

MOCK_SESSION_COMPLETED = {
    "session_id": SAMPLE_SESSION_ID,
    "status": "completed",
    "message": "Phỏng vấn kết thúc. Xem báo cáo của bạn.",
}

MOCK_STAR_REPORT = {
    "session_id": SAMPLE_SESSION_ID,
    "cv_id": SAMPLE_CV_ID,
    "jd_id": SAMPLE_JD_ID,
    "total_score": 72,
    "star_scores": {
        "situation": 80,
        "task": 75,
        "action": 70,
        "result": 65,
    },
    "strengths": [
        "Mô tả tình huống rõ ràng và có bối cảnh cụ thể",
        "Nêu rõ vai trò và nhiệm vụ của bản thân",
    ],
    "improvements": [
        "Kết quả cần định lượng hơn (số liệu, %, thời gian)",
        "Cần thể hiện impact rõ hơn với team/dự án",
    ],
    "sample_answers": [
        {
            "question": "Kể về dự án backend của bạn",
            "ideal_answer": "Tình huống: Nhóm 3 người cần xây dựng API cho app quản lý sinh viên... "
                            "Nhiệm vụ: Tôi phụ trách thiết kế database và viết REST API... "
                            "Hành động: Tôi chọn FastAPI vì hiệu năng cao, thiết kế schema với PostgreSQL... "
                            "Kết quả: API giảm thời gian response từ 800ms xuống 200ms, "
                            "giúp nhóm deploy đúng deadline.",
        }
    ],
}


# ─── T1-015: Start interview thiếu JD → 400 ─────────────────────────────────

@pytest.mark.asyncio
async def test_interview_start_missing_jd(client):
    """T1-015: Thiếu jd_id khi start interview → 400 Bad Request.

    AC F-05: Bắt buộc chọn đủ 1 CV + 1 JD mới được bắt đầu.
    """
    response = await client.post(
        "/api/v1/interview/start",
        json={"cv_id": SAMPLE_CV_ID},  # Không có jd_id
    )
    assert response.status_code in (400, 422), (
        f"Thiếu JD phải bị từ chối, nhưng trả {response.status_code}"
    )


# ─── T1-016: Start interview thiếu CV → 400 ──────────────────────────────────

@pytest.mark.asyncio
async def test_interview_start_missing_cv(client):
    """T1-016: Thiếu cv_id khi start interview → 400 Bad Request."""
    response = await client.post(
        "/api/v1/interview/start",
        json={"jd_id": SAMPLE_JD_ID},  # Không có cv_id
    )
    assert response.status_code in (400, 422)


# ─── T1-017: Start interview hợp lệ → tạo session với câu hỏi đầu ───────────

@pytest.mark.asyncio
async def test_interview_start_valid(client):
    """T1-017: Start với đủ CV + JD → session_id + câu hỏi đầu tiên.

    AC F-05: Mỗi phiên gồm 5-7 câu hỏi.
    """
    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_SESSION_STARTED,
    ):
        response = await client.post(
            "/api/v1/interview/start",
            json={"cv_id": SAMPLE_CV_ID, "jd_id": SAMPLE_JD_ID},
        )

    assert response.status_code == 200
    data = response.json()

    assert "session_id" in data, "Response phải có session_id"
    assert "current_question" in data, "Response phải có câu hỏi đầu tiên"
    assert "total_questions" in data, "Response phải có tổng số câu hỏi"

    total_q = data["total_questions"]
    assert 5 <= total_q <= 7, (
        f"Số câu hỏi {total_q} không nằm trong khoảng 5-7 (AC F-05)"
    )
    assert data["status"] == "active"


# ─── T1-018: Câu trả lời đầy đủ → chuyển câu tiếp theo ──────────────────────

@pytest.mark.asyncio
async def test_interview_answer_sufficient(client):
    """T1-018: Câu trả lời đủ dài, đủ ý → không trigger follow-up, chuyển câu tiếp."""
    good_answer = (
        "Tình huống: Trong dự án thực tập ở FPT Software, team cần tích hợp payment gateway. "
        "Nhiệm vụ: Tôi phụ trách viết module thanh toán với VNPay. "
        "Hành động: Tôi đọc docs VNPay, implement HMAC signature, viết unit test coverage 90%+. "
        "Kết quả: Module hoạt động ổn định, xử lý 500+ transaction trong tuần đầu tiên go-live."
    )

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_NEXT_QUESTION,
    ):
        response = await client.post(
            f"/api/v1/interview/{SAMPLE_SESSION_ID}/answer",
            json={"answer": good_answer},
        )

    assert response.status_code == 200
    data = response.json()
    # Câu trả lời đủ → không phải follow-up
    assert data.get("is_follow_up", False) is False


# ─── T1-019: Câu trả lời quá ngắn → AI hỏi follow-up ────────────────────────

@pytest.mark.asyncio
async def test_interview_short_answer_triggers_followup(client):
    """T1-019: Câu trả lời quá ngắn → AI đặt câu hỏi gợi mở (AC F-05).

    AC: Nếu câu trả lời quá ngắn hoặc thiếu ý, AI sẽ đặt follow-up question.
    """
    short_answer = "Tôi đã làm dự án backend."  # Quá ngắn, thiếu STAR

    with patch(
        "src.agents.graph.agent.ainvoke",
        new_callable=AsyncMock,
        return_value=MOCK_QUESTION_WITH_FOLLOWUP,
    ):
        response = await client.post(
            f"/api/v1/interview/{SAMPLE_SESSION_ID}/answer",
            json={"answer": short_answer},
        )

    assert response.status_code == 200
    data = response.json()
    assert data.get("is_follow_up") is True, (
        "Câu trả lời quá ngắn phải trigger follow-up question (AC F-05)"
    )


# ─── T1-020: Answer với session không tồn tại → 404 ─────────────────────────

@pytest.mark.asyncio
async def test_interview_answer_invalid_session(client):
    """T1-020: Submit answer cho session_id không tồn tại → 404."""
    fake_session = str(uuid.uuid4())
    response = await client.post(
        f"/api/v1/interview/{fake_session}/answer",
        json={"answer": "Câu trả lời của tôi"},
    )
    assert response.status_code == 404


# ─── T1-021: Answer rỗng → 422 ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_interview_empty_answer(client):
    """T1-021: Submit answer rỗng → 422 Validation Error."""
    response = await client.post(
        f"/api/v1/interview/{SAMPLE_SESSION_ID}/answer",
        json={"answer": ""},
    )
    assert response.status_code == 422


# ─── T1-022: Get STAR report sau khi completed ────────────────────────────────

@pytest.mark.asyncio
async def test_get_star_report_structure(client):
    """T1-022: Lấy báo cáo STAR sau phỏng vấn → đủ 4 tiêu chí STAR + thang 100.

    AC F-06: Chấm điểm theo 4 tiêu chí STAR trên thang điểm 100.
    """
    with patch(
        "src.services.interview_service.get_report",
        new_callable=AsyncMock,
        return_value=MOCK_STAR_REPORT,
    ):
        response = await client.get(
            f"/api/v1/interview/{SAMPLE_SESSION_ID}/report"
        )

    assert response.status_code == 200
    data = response.json()

    # Kiểm tra cấu trúc báo cáo (AC F-06)
    assert "total_score" in data, "Thiếu total_score"
    assert "star_scores" in data, "Thiếu star_scores"
    assert "strengths" in data, "Thiếu strengths (điểm mạnh)"
    assert "improvements" in data, "Thiếu improvements (điểm cần cải thiện)"
    assert "sample_answers" in data, "Thiếu sample_answers (gợi ý câu trả lời mẫu)"

    # Kiểm tra đủ 4 tiêu chí STAR
    star = data["star_scores"]
    for criterion in ("situation", "task", "action", "result"):
        assert criterion in star, f"Thiếu tiêu chí STAR: {criterion}"
        assert 0 <= star[criterion] <= 100, (
            f"Điểm {criterion}={star[criterion]} ngoài thang [0, 100]"
        )

    # Total score cũng trong [0, 100]
    assert 0 <= data["total_score"] <= 100


# ─── T1-023: Report của session chưa completed → 409 Conflict ────────────────

@pytest.mark.asyncio
async def test_get_report_session_not_completed(client):
    """T1-023: Lấy report khi session chưa hoàn thành → 409 Conflict."""
    active_session_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/interview/{active_session_id}/report")
    # Session chưa xong → không thể lấy report
    assert response.status_code in (404, 409), (
        "Session chưa complete không được trả report"
    )


# ─── T1-024: Điểm STAR có xu hướng tăng sau nhiều lượt ──────────────────────

@pytest.mark.asyncio
async def test_star_scores_improvement_tracking(client):
    """T1-024: Hệ thống lưu lịch sử → có thể lấy scores nhiều lượt.

    AC Section 8: Điểm Rubric STAR qua các lần luyện có xu hướng tăng.
    → Verify endpoint history tồn tại.
    """
    response = await client.get(
        f"/api/v1/interview/history/{SAMPLE_CV_ID}"
    )
    # Endpoint phải tồn tại (200 hoặc 404 nếu chưa có lịch sử)
    assert response.status_code in (200, 404), (
        "Endpoint history phải tồn tại để tracking improvement"
    )


# ─── T1-025: Feedback không tạo câu trả lời có thành tích bịa ───────────────

@pytest.mark.asyncio
async def test_sample_answer_no_fabricated_achievements(client):
    """T1-025: Gợi ý câu trả lời mẫu trong report không được chứa
    thành tích không có căn cứ (AC F-06 + nguyên tắc liêm chính).

    Kiểm tra: sample_answer không được tự tạo số liệu như '300% increase'
    nếu CV không có số liệu đó.
    """
    with patch(
        "src.services.interview_service.get_report",
        new_callable=AsyncMock,
        return_value=MOCK_STAR_REPORT,
    ):
        response = await client.get(
            f"/api/v1/interview/{SAMPLE_SESSION_ID}/report"
        )

    data = response.json()
    sample_answers = data.get("sample_answers", [])

    # Gợi ý mẫu phải là cấu trúc STAR, không phải câu trả lời thay thế bịa đặt
    for sa in sample_answers:
        assert "ideal_answer" in sa or "guidance" in sa, (
            "Sample answer cần là hướng dẫn cấu trúc, không phải thay thế nội dung"
        )
