"""Regression test: POST /interviews/{id}/answer khi số hàng câu hỏi ÍT HƠN
`session.total_questions`.

Bối cảnh — hai con số này có thể lệch nhau:

- `POST /interviews/start` với mode="voice" đặt `total_questions` bằng con số
  người dùng chọn nhưng KHÔNG sinh hàng `InterviewQuestion` nào (luồng voice tự
  ghi hàng của nó qua WebSocket).
- `ws_interview.py` chỉ ghi đè `session.total_questions = len(history_list)` ở
  bước _complete_session. Phiên voice đứt giữa chừng (mất mạng, đóng tab) sẽ
  nằm lại với total_questions = N nhưng chỉ có k < N hàng thật.

Khi đó `/answer` kiểm tra kết thúc phiên bằng `total_questions` nhưng lại đọc
câu tiếp theo bằng chỉ số trên mảng hàng thật → vượt biên.

Dữ liệu trong test là synthetic.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from src.db.models import (
    CV,
    InterviewQuestion,
    InterviewReport,
    InterviewSession,
    JobDescription,
    User,
)
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login

EMAIL = "interview_overflow@example.com"


async def _seed_partial_session(
    *,
    user_email: str,
    total_questions: int,
    num_rows: int,
    current_index: int,
) -> str:
    """Dựng phiên có total_questions > số hàng câu hỏi thật."""
    async with TestingSessionLocal() as session:
        user = (
            await session.execute(select(User).where(User.email == user_email.lower()))
        ).scalar_one()
        cv = (await session.execute(select(CV))).scalars().first()
        jd = (await session.execute(select(JobDescription))).scalars().first()

        interview = InterviewSession(
            user_id=user.id,
            cv_id=cv.id,
            jd_id=jd.id,
            language="vi",
            mode="voice",
            status="ongoing",
            total_questions=total_questions,
            current_question_index=current_index,
        )
        session.add(interview)
        await session.flush()

        for idx in range(num_rows):
            session.add(
                InterviewQuestion(
                    session_id=interview.id,
                    question_index=idx,
                    question_text=f"Câu hỏi số {idx}",
                    user_answer="Đã trả lời." if idx < current_index else None,
                )
            )
        await session.commit()
        return interview.id


@pytest.mark.asyncio
async def test_answer_does_not_crash_when_rows_fewer_than_total(
    client: AsyncClient, monkeypatch
):
    """Trả lời câu cuối CÒN HÀNG THẬT không được làm API nổ 500.

    total_questions=5 nhưng chỉ có 2 hàng thật, đang ở câu index 1 (câu cuối
    còn hàng). Sau khi trả lời, chỉ số thành 2: chưa >= 5 nên code không kết
    thúc phiên, rồi đọc questions[2] trong mảng chỉ có 2 phần tử.
    """
    from src.api.v1 import interviews as interviews_module

    async def _fake_evaluate(**_kwargs):
        return {
            "star_score": {"situation": 8, "task": 8, "action": 8, "result": 8},
            "needs_followup": False,
            "follow_up_question": None,
        }

    monkeypatch.setattr(
        interviews_module, "evaluate_answer_and_check_followup", _fake_evaluate
    )

    _, headers = await register_and_login(client, email=EMAIL)
    await insert_cv(email=EMAIL)
    await insert_jd(owner_email=EMAIL)

    session_id = await _seed_partial_session(
        user_email=EMAIL, total_questions=5, num_rows=2, current_index=1
    )

    resp = await client.post(
        f"/api/v1/interviews/{session_id}/answer",
        json={"user_answer": "Em xin trả lời câu hỏi cuối cùng còn hàng thật."},
        headers=headers,
    )

    assert resp.status_code != 500, (
        "API nổ 500 do đọc questions[index] vượt biên: "
        f"body={resp.text[:300]}"
    )
    assert resp.status_code == 200, resp.text

    # Hết hàng câu hỏi thật => phiên phải kết thúc và sinh báo cáo, thay vì cố
    # đọc câu tiếp theo không tồn tại.
    body = resp.json()
    assert body["is_last_question"] is True

    async with TestingSessionLocal() as db:
        refreshed = await db.get(InterviewSession, session_id)
        assert refreshed.status == "completed"
        report = await db.scalar(
            select(InterviewReport).where(InterviewReport.session_id == session_id)
        )
        assert report is not None, "Phiên kết thúc nhưng không có báo cáo STAR"
