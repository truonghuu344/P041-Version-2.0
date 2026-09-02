"""Regression tests cho dữ liệu của luồng phỏng vấn giọng nói (mode="voice").

Bối cảnh — hai lỗi dữ liệu vừa được sửa:

1. `POST /interviews/start` sinh sẵn N hàng `InterviewQuestion` (question_index
   0..N-1) cho MỌI phiên, kể cả voice. Luồng voice lại không dùng bộ câu hỏi đó
   mà tự ghi hàng của riêng nó, cũng bắt đầu từ 0 → question_index trùng theo
   pattern 0,0,1,1,2,2,... và mỗi phiên có N hàng "ma" không ai trả lời.

2. `VoiceInterviewSession._complete_session` ghép hàng DB với kết quả chấm STAR
   bằng `zip()` — tức là theo VỊ TRÍ. Hàng ma nằm xen kẽ (và lượt chào mở đầu
   cũng từng sinh ra một hàng) nên điểm STAR bị gán sang nhầm câu.

Dữ liệu dùng trong test là synthetic — không phải CV/JD thật.
"""

from __future__ import annotations

import json

from sqlalchemy import select

from src.api.v1.ws_interview import VoiceInterviewSession
from src.db.models import InterviewQuestion, InterviewSession
from src.services.voice.voice_orchestrator import VoiceInterviewOrchestrator
from tests.conftest import TestingSessionLocal
from tests.helpers import insert_cv, insert_jd, register_and_login

GREETING = "Chào bạn, mình là trợ lý phỏng vấn của Career Buddy. Bạn sẵn sàng chưa?"
Q1 = "Bạn có thể giới thiệu sơ qua một chút về bản thân không?"
Q2 = "Kể cho mình nghe về một dự án backend bạn tâm đắc nhất."
Q3 = "Bạn đã tối ưu hiệu năng API đó ra sao, con số cụ thể thế nào?"

A0 = "Vâng, em sẵn sàng ạ."
A1 = "Em là sinh viên năm 4 ngành CNTT, thiên về backend Python."
A2 = "Em làm một API quản lý kho bằng FastAPI cho môn đồ án."
A3 = "Em thêm index và cache, thời gian phản hồi giảm từ 800ms xuống 120ms."

# Điểm STAR suy ra từ NỘI DUNG câu trả lời. Nếu điểm bị gán sang nhầm câu thì
# assert sẽ bắt được ngay, khác với việc dùng cùng một điểm cho mọi câu.
ANSWER_SCORES = {
    A1: {"situation": 11, "task": 12, "action": 13, "result": 14},
    A2: {"situation": 21, "task": 22, "action": 23, "result": 24},
    A3: {"situation": 31, "task": 32, "action": 33, "result": 34},
}


class FakeWebSocket:
    """Chỉ nuốt các message gửi ra — test không quan tâm nội dung WS."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send_text(self, data: str) -> None:
        self.sent.append(data)


class StubOrchestrator:
    """Mô phỏng VoiceInterviewOrchestrator mà không gọi LLM."""

    def __init__(self) -> None:
        self.cv_text = "Sinh vien nam 4 nganh CNTT, ky nang Python, FastAPI."
        self.jd_title = "Backend Developer Intern"
        self.turn_count = 0
        # `start()` thật sinh ra đúng hai message này trước lượt đầu tiên.
        self.conversation: list[dict[str, str]] = [
            {"role": "user", "content": "(Ứng viên vừa kết nối. Hãy chào hỏi.)"},
            {"role": "assistant", "content": GREETING},
        ]

    def turn(self, user_text: str, ai_message: str) -> dict[str, object]:
        """Mô phỏng `next_turn`: ghi câu trả lời rồi ghi lượt nói kế tiếp của AI."""
        self.conversation.append({"role": "user", "content": user_text})
        self.turn_count += 1
        self.conversation.append({"role": "assistant", "content": ai_message})
        return {"ai_message": ai_message, "phase": "experience_deepdive", "is_complete": False}


async def _start_voice_session(client, monkeypatch, *, email: str) -> tuple[str, dict[str, str]]:
    """Tạo một phiên voice qua API thật, trả về (session_id, headers)."""
    _user, headers = await register_and_login(client, email=email)
    cv = await insert_cv(email=email)
    jd = await insert_jd(is_system=True)

    async def unexpected_generation(**_kwargs):
        raise AssertionError("Luồng voice không được sinh trước câu hỏi.")

    monkeypatch.setattr("src.api.v1.interviews.generate_interview_questions", unexpected_generation)

    started = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 5, "mode": "voice"},
    )
    assert started.status_code == 201, started.text
    return started.json()["session_id"], headers


async def _count_questions(session_id: str) -> int:
    async with TestingSessionLocal() as db:
        rows = await db.scalars(
            select(InterviewQuestion).where(InterviewQuestion.session_id == session_id)
        )
        return len(rows.all())


async def _drive_turns(db, db_session, voice_session, orchestrator, turns):
    """Chạy lần lượt các lượt (câu trả lời, lượt nói kế tiếp của AI)."""
    recorded = []
    for user_text, ai_message in turns:
        result = orchestrator.turn(user_text, ai_message)
        recorded.append(await voice_session._record_answer(db, db_session, user_text, result))
    return recorded


def _patch_scoring(monkeypatch):
    async def fake_evaluation(*, question_text, user_answer, cv_text):  # noqa: ARG001
        assert user_answer in ANSWER_SCORES, f"Câu trả lời lạ: {user_answer!r}"
        return {"star_score": ANSWER_SCORES[user_answer]}

    async def fake_report(**_kwargs):
        return {
            "total_score": 72,
            "star_scores": {"situation": 70, "task": 70, "action": 70, "result": 70},
            "strengths": ["Có số liệu cụ thể"],
            "improvements": ["Nói rõ vai trò cá nhân hơn"],
            "recommendations": ["Luyện thêm cấu trúc STAR"],
        }

    monkeypatch.setattr(
        "src.api.v1.ws_interview.evaluate_answer_and_check_followup", fake_evaluation
    )
    monkeypatch.setattr("src.api.v1.ws_interview.generate_final_star_report", fake_report)


# --- (1) /interviews/start khong sinh hang thua cho phien voice --------------


async def test_voice_start_creates_no_question_rows_and_skips_llm(client, monkeypatch):
    """Phiên voice: không gọi LLM sinh câu hỏi, không tạo hàng InterviewQuestion."""
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-start@example.com"
    )

    assert await _count_questions(session_id) == 0, (
        "Phiên voice không được có hàng InterviewQuestion nào trước khi ứng viên trả lời."
    )


async def test_text_start_still_pregenerates_question_rows(client, monkeypatch):
    """Chống hồi quy: luồng text vẫn phải sinh sẵn đủ bộ câu hỏi."""
    _user, headers = await register_and_login(client, email="text-start@example.com")
    cv = await insert_cv(email="text-start@example.com")
    jd = await insert_jd(is_system=True)

    async def fake_questions(**_kwargs):
        return ["Câu hỏi 1?", "Câu hỏi 2?", "Câu hỏi 3?"]

    monkeypatch.setattr("src.api.v1.interviews.generate_interview_questions", fake_questions)

    started = await client.post(
        "/api/v1/interviews/start",
        headers=headers,
        json={"cv_id": cv.id, "jd_id": jd.id, "total_questions": 3, "mode": "text"},
    )
    assert started.status_code == 201, started.text
    body = started.json()
    # Nguồn câu hỏi của luồng text nay là agenda (services/interview_agenda_service),
    # không còn là generate_interview_questions — hàm đó chỉ còn là lưới an toàn.
    # Ý định chống hồi quy của test vẫn giữ nguyên: text PHẢI sinh sẵn đủ hàng.
    assert body["question_text"].strip()
    assert await _count_questions(body["session_id"]) == 3


async def test_resume_rejects_voice_session(client, monkeypatch):
    """Phiên voice không tiếp tục được qua luồng hỏi–đáp dạng văn bản."""
    session_id, headers = await _start_voice_session(
        client, monkeypatch, email="voice-resume@example.com"
    )

    resumed = await client.get(f"/api/v1/interviews/{session_id}/resume", headers=headers)
    assert resumed.status_code == 409
    assert "WebSocket" in resumed.json()["detail"]


# --- (2) Ghi cap hoi-dap: bo luot chao, danh so lien tuc ---------------------


async def test_record_answer_skips_greeting_and_numbers_sequentially(client, monkeypatch):
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-record@example.com"
    )

    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        voice_session = VoiceInterviewSession(
            ws=FakeWebSocket(), session_id=session_id, user_id=db_session.user_id
        )
        orchestrator = StubOrchestrator()
        voice_session.orchestrator = orchestrator

        rows = await _drive_turns(
            db,
            db_session,
            voice_session,
            orchestrator,
            [(A0, Q1), (A1, Q2), (A2, Q3)],
        )
        await db.commit()

    # Lượt đầu tiên trả lời LỜI CHÀO, không phải câu hỏi phỏng vấn -> không ghi.
    assert rows[0] is None

    assert [row.question_index for row in rows[1:]] == [0, 1]
    assert [row.question_text for row in rows[1:]] == [Q1, Q2]
    assert [row.user_answer for row in rows[1:]] == [A1, A2]
    assert db_session.current_question_index == 2

    async with TestingSessionLocal() as db:
        stored = (
            await db.scalars(
                select(InterviewQuestion)
                .where(InterviewQuestion.session_id == session_id)
                .order_by(InterviewQuestion.question_index)
            )
        ).all()

    indices = [row.question_index for row in stored]
    assert indices == [0, 1], f"question_index phải liên tục và không trùng, nhận được {indices}"
    assert GREETING not in [row.question_text for row in stored]


# --- (3) Diem STAR phai gan dung cau ----------------------------------------


async def test_star_score_is_attached_to_its_own_question(client, monkeypatch):
    """Mỗi hàng phải nhận đúng điểm chấm cho CÂU TRẢ LỜI CỦA CHÍNH NÓ."""
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-score@example.com"
    )
    _patch_scoring(monkeypatch)

    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        voice_session = VoiceInterviewSession(
            ws=FakeWebSocket(), session_id=session_id, user_id=db_session.user_id
        )
        orchestrator = StubOrchestrator()
        voice_session.orchestrator = orchestrator

        await _drive_turns(
            db,
            db_session,
            voice_session,
            orchestrator,
            [(A0, Q1), (A1, Q2), (A2, Q3), (A3, "Cảm ơn bạn, buổi phỏng vấn kết thúc tại đây.")],
        )
        await voice_session._complete_session(db, db_session)

    async with TestingSessionLocal() as db:
        stored = (
            await db.scalars(
                select(InterviewQuestion)
                .where(InterviewQuestion.session_id == session_id)
                .order_by(InterviewQuestion.question_index)
            )
        ).all()
        reloaded_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )

    assert [row.question_text for row in stored] == [Q1, Q2, Q3]
    assert [row.user_answer for row in stored] == [A1, A2, A3]
    for row in stored:
        assert row.star_score_json == ANSWER_SCORES[row.user_answer], (
            f"Câu {row.question_index} nhận điểm của câu khác: {row.star_score_json}"
        )

    assert reloaded_session.status == "completed"
    assert reloaded_session.total_questions == 3


async def test_star_scores_never_land_on_unanswered_questions(client, monkeypatch):
    """Tái dựng hiện trạng dữ liệu cũ: hàng ma không được nhận điểm."""
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-ghost@example.com"
    )
    _patch_scoring(monkeypatch)

    # Hàng "ma" đúng như dữ liệu cũ: chưa ai trả lời, question_index trùng với
    # hàng thật nên phép ghép theo vị trí sẽ nhặt trúng chúng.
    async with TestingSessionLocal() as db:
        for idx, text in enumerate(["Câu sinh sẵn 1?", "Câu sinh sẵn 2?", "Câu sinh sẵn 3?"]):
            db.add(
                InterviewQuestion(
                    session_id=session_id, question_index=idx, question_text=text
                )
            )
        await db.commit()

    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        voice_session = VoiceInterviewSession(
            ws=FakeWebSocket(), session_id=session_id, user_id=db_session.user_id
        )
        orchestrator = StubOrchestrator()
        voice_session.orchestrator = orchestrator

        await _drive_turns(
            db,
            db_session,
            voice_session,
            orchestrator,
            [(A0, Q1), (A1, Q2), (A2, Q3), (A3, "Cảm ơn bạn nhé.")],
        )
        await voice_session._complete_session(db, db_session)

    async with TestingSessionLocal() as db:
        stored = (
            await db.scalars(
                select(InterviewQuestion).where(InterviewQuestion.session_id == session_id)
            )
        ).all()

    ghosts = [row for row in stored if row.user_answer is None]
    answered = [row for row in stored if row.user_answer is not None]

    assert len(ghosts) == 3
    assert all(row.star_score_json is None for row in ghosts), (
        "Hàng chưa có câu trả lời không bao giờ được nhận điểm STAR."
    )
    for row in answered:
        assert row.star_score_json == ANSWER_SCORES[row.user_answer]


# --- (4) Noi lai phien phong van dang do ------------------------------------
#
# Khong co GEMINI_API_KEY trong test (conftest ep rong) nen orchestrator that
# se roi vao nhanh fallback offline — deterministic, khong goi mang.


def _real_orchestrator() -> VoiceInterviewOrchestrator:
    return VoiceInterviewOrchestrator(
        cv_text="Sinh vien nam 4 nganh CNTT, ky nang Python, FastAPI.",
        jd_title="Backend Developer Intern",
        jd_requirements="Yeu cau: Python, FastAPI, REST API, Git.",
        language="vi",
    )


async def test_resume_replays_saved_qa_and_does_not_regreet():
    """`resume()` dựng lại hội thoại từ các cặp đã lưu và không chào lại."""
    orchestrator = _real_orchestrator()
    pairs = [{"question": Q1, "answer": A1}, {"question": Q2, "answer": A2}]

    result = await orchestrator.resume(pairs)

    replayed = [
        message
        for message in orchestrator.conversation
        if message["content"] in {Q1, A1, Q2, A2}
    ]
    assert [message["content"] for message in replayed] == [Q1, A1, Q2, A2]

    # turn_count phải tính cả lượt trả lời lời chào (lượt không sinh hàng DB).
    assert orchestrator.turn_count == len(pairs) + 1
    assert orchestrator.current_phase != "greeting"
    assert "sẵn sàng chưa" not in result["ai_message"], (
        f"Không được chào lại từ đầu khi nối lại phiên: {result['ai_message']!r}"
    )
    assert result["is_complete"] is False


async def test_begin_conversation_greets_when_session_has_no_answers(client, monkeypatch):
    """Phiên chưa có câu trả lời nào thì vẫn chào bình thường, không gửi history."""
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-fresh@example.com"
    )

    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        ws = FakeWebSocket()
        voice_session = VoiceInterviewSession(
            ws=ws, session_id=session_id, user_id=db_session.user_id
        )
        voice_session.orchestrator = _real_orchestrator()

        previous_pairs = await voice_session._load_previous_qa(db)
        await voice_session._begin_conversation(previous_pairs)

    assert previous_pairs == []
    assert voice_session._recorded_questions == 0
    assert all(json.loads(raw)["type"] != "history" for raw in ws.sent)


async def test_reconnect_continues_question_index_instead_of_restarting(client, monkeypatch):
    """Nối lại phiên dở phải đánh số tiếp, không ghi đè question_index từ 0."""
    session_id, _headers = await _start_voice_session(
        client, monkeypatch, email="voice-reconnect@example.com"
    )

    # --- Kết nối thứ nhất: trả lời lời chào rồi trả lời hai câu hỏi ---------
    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        first = VoiceInterviewSession(
            ws=FakeWebSocket(), session_id=session_id, user_id=db_session.user_id
        )
        orchestrator = StubOrchestrator()
        first.orchestrator = orchestrator
        await _drive_turns(
            db, db_session, first, orchestrator, [(A0, Q1), (A1, Q2), (A2, Q3)]
        )
        await db.commit()

    # --- Kết nối thứ hai: phiên vẫn ongoing, ứng viên quay lại -------------
    async with TestingSessionLocal() as db:
        db_session = await db.scalar(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        ws = FakeWebSocket()
        second = VoiceInterviewSession(
            ws=ws, session_id=session_id, user_id=db_session.user_id
        )
        second.orchestrator = _real_orchestrator()

        previous_pairs = await second._load_previous_qa(db)
        await second._begin_conversation(previous_pairs)

        # Câu trả lời tiếp theo sau khi nối lại.
        result = await second.orchestrator.next_turn(A3)
        new_row = await second._record_answer(db, db_session, A3, result)
        await db.commit()

    assert previous_pairs == [
        {"question": Q1, "answer": A1},
        {"question": Q2, "answer": A2},
    ]
    assert second._recorded_questions == 3

    history_messages = [json.loads(raw) for raw in ws.sent if json.loads(raw)["type"] == "history"]
    assert len(history_messages) == 1
    assert history_messages[0]["pairs"] == previous_pairs

    assert new_row is not None
    assert new_row.question_index == 2, (
        f"Nối lại phải đánh số tiếp từ 2, nhận được {new_row.question_index}"
    )

    async with TestingSessionLocal() as db:
        stored = (
            await db.scalars(
                select(InterviewQuestion)
                .where(InterviewQuestion.session_id == session_id)
                .order_by(InterviewQuestion.question_index)
            )
        ).all()

    indices = [row.question_index for row in stored]
    assert indices == [0, 1, 2], f"question_index bị trùng sau khi nối lại: {indices}"
    assert [row.user_answer for row in stored] == [A1, A2, A3]
