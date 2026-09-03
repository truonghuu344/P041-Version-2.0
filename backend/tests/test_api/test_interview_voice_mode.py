"""Chế độ voice không được sinh sẵn câu hỏi ở `/interviews/start`.

Bug đã xảy ra trên dữ liệu thật: một buổi phỏng vấn voice 7 lượt lại có 12 hàng
`InterviewQuestion`, vì hai luồng cùng ghi cho một phiên —

  * `POST /interviews/start` sinh sẵn N câu (luồng chế độ text), `user_answer` NULL
  * WebSocket voice ghi từng lượt hội thoại thật

Hai bộ dùng chung dải `question_index` bắt đầu từ 0, nên `_complete_session`
zip nhầm và gắn điểm STAR sang câu chưa ai trả lời — trong dữ liệu thật có câu
`⚠ RỖNG` nhưng mang điểm `S=20, T=40, A=70, R=70`.

Ngoài ra mỗi phiên voice còn đốt oan một lượt sinh câu hỏi bằng LLM, đáng kể khi
free tier chỉ có RPD 500.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

# pyrefly: ignore [missing-import]
from src.db.models import InterviewQuestion
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login


async def _count_questions(session_id: str) -> int:
    async with TestingSessionLocal() as db:
        return await db.scalar(
            select(func.count())
            .select_from(InterviewQuestion)
            .where(InterviewQuestion.session_id == session_id)
        )


@pytest.fixture
def spy_question_generator(monkeypatch):
    """Đếm số lần gọi bộ sinh câu hỏi mà không chạm mạng."""
    calls: list[int] = []

    async def fake_questions(*, cv_text, jd_title, jd_requirements, num_questions):
        calls.append(num_questions)
        return [f"Câu hỏi {i + 1}?" for i in range(num_questions)]

    monkeypatch.setattr(
        "src.api.v1.interviews.generate_interview_questions", fake_questions
    )
    return calls


async def _start(client, headers, cv, jd, **extra):
    body = {"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3, **extra}
    response = await client.post(
        "/api/v1/interviews/start", headers=headers, json=body
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_voice_mode_creates_no_pregenerated_questions(
    client, spy_question_generator
):
    """Voice: orchestrator tự sinh câu hỏi qua WebSocket, REST không được ghi gì."""
    _user, headers = await register_and_login(client, email="voice-mode@example.com")
    cv = await insert_cv(email="voice-mode@example.com")
    jd = await insert_jd(is_system=True)

    data = await _start(client, headers, cv, jd, mode="voice")

    assert await _count_questions(data["session_id"]) == 0, (
        "hàng sinh sẵn sẽ trùng question_index với hàng thật của voice "
        "và làm điểm STAR gắn nhầm câu"
    )
    assert spy_question_generator == [], "voice không được đốt quota sinh câu hỏi"
    # Frontend chế độ voice chỉ đọc session_id; câu mở đầu đến từ WebSocket.
    assert data["question_text"] == ""


@pytest.mark.asyncio
async def test_text_mode_still_pregenerates_questions(client, spy_question_generator):
    """Không được sửa nhầm luồng text — nó vẫn phải sinh sẵn như cũ."""
    _user, headers = await register_and_login(client, email="text-mode@example.com")
    cv = await insert_cv(email="text-mode@example.com")
    jd = await insert_jd(is_system=True)

    data = await _start(client, headers, cv, jd)

    assert await _count_questions(data["session_id"]) == 3
    assert spy_question_generator == [3]
    assert data["question_text"] == "Câu hỏi 1?"


@pytest.mark.asyncio
async def test_voice_question_indexes_stay_unique(client, spy_question_generator):
    """Không còn hàng sinh sẵn thì dải question_index của voice mới liền mạch.

    Chính chỗ trùng index làm `_complete_session` zip lệch; test này giữ điều kiện
    tiên quyết để nó zip đúng.
    """
    _user, headers = await register_and_login(client, email="voice-idx@example.com")
    cv = await insert_cv(email="voice-idx@example.com")
    jd = await insert_jd(is_system=True)

    data = await _start(client, headers, cv, jd, mode="voice")

    async with TestingSessionLocal() as db:
        indexes = (
            await db.scalars(
                select(InterviewQuestion.question_index).where(
                    InterviewQuestion.session_id == data["session_id"]
                )
            )
        ).all()

    assert len(indexes) == len(set(indexes)), f"question_index bị trùng: {indexes}"
