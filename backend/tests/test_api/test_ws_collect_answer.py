"""Chốt câu trả lời phải ĐÓNG luồng STT trước khi đọc transcript.

Bug quan sát được trên dữ liệu thật: câu trả lời của ứng viên cụt giữa chừng ở
"…mục đích dùng YOLO để làm gì, sau đó mình sẽ" — lượt STT chạy 31 giây nhưng
chỉ ra 199 ký tự, trong khi lượt tương đương 37 giây ra 438 ký tự.

Nguyên nhân: `submit_answer` đọc `_transcript_buffer` TRƯỚC khi gọi
`stt_stream.close()`. Mà `close()` mới là chỗ chạy `_drain()` — chờ server chốt
nốt các đoạn nói cuối rồi đẩy vào buffer qua `_on_stt_final`. Đọc trước là vứt
mất đúng phần vừa nói xong.

Không có exception, không có cảnh báo trong log. Chỉ lộ ra khi đọc lại
transcript và thấy câu cụt giữa chừng.
"""

from __future__ import annotations

import pytest

# pyrefly: ignore [missing-import]
from src.api.v1.ws_interview import VoiceInterviewSession


class _FakeSTTStream:
    """Mô phỏng STTStream: close() còn đẩy thêm transcript vào buffer (drain)."""

    def __init__(self, session: VoiceInterviewSession, late_text: str | None):
        self._session = session
        self._late_text = late_text
        self.closed = False

    async def close(self) -> None:
        self.closed = True
        if self._late_text:
            self._session._transcript_buffer.append(self._late_text)


def _session() -> VoiceInterviewSession:
    # `_collect_answer` không chạm tới WebSocket hay database.
    return VoiceInterviewSession(ws=None, session_id="s1", user_id="u1")


@pytest.mark.asyncio
async def test_keeps_transcript_arriving_during_close():
    """Đoạn nói cuối chỉ về sau khi close() drain xong — không được bỏ sót."""
    session = _session()
    session._transcript_buffer.append("Ban đầu mình chẳng biết YOLO là gì,")
    session.stt_stream = _FakeSTTStream(session, "sau đó mình đi research và áp dụng.")

    answer = await session._collect_answer(client_text=None)

    assert "sau đó mình đi research và áp dụng." in answer, (
        "đọc transcript trước khi close() là mất phần ứng viên vừa nói"
    )
    assert answer.startswith("Ban đầu mình chẳng biết")


@pytest.mark.asyncio
async def test_server_transcript_wins_over_partial_client_text():
    """Client chỉ có các final kịp về trước lúc bấm nút, server đầy đủ hơn."""
    session = _session()
    session.stt_stream = _FakeSTTStream(session, "phần cuối câu.")
    session._transcript_buffer.append("Phần đầu câu")

    answer = await session._collect_answer(client_text="Phần đầu câu")

    assert answer == "Phần đầu câu phần cuối câu."


@pytest.mark.asyncio
async def test_falls_back_to_client_text_when_nothing_transcribed():
    """Ứng viên gõ tay thay vì nói: buffer rỗng thì mới dùng text của client."""
    session = _session()
    session.stt_stream = _FakeSTTStream(session, None)

    answer = await session._collect_answer(client_text="  Tôi gõ tay câu này.  ")

    assert answer == "Tôi gõ tay câu này."


@pytest.mark.asyncio
async def test_stream_is_always_closed():
    session = _session()
    stream = _FakeSTTStream(session, None)
    session.stt_stream = stream

    await session._collect_answer(client_text="x")

    assert stream.closed is True
    assert session.stt_stream is None, "phải nhả stream để lượt sau mở phiên mới"


@pytest.mark.asyncio
async def test_returns_empty_when_nothing_heard_and_nothing_typed():
    session = _session()
    session.stt_stream = _FakeSTTStream(session, None)

    assert await session._collect_answer(client_text=None) == ""
    assert await session._collect_answer(client_text="   ") == ""


@pytest.mark.asyncio
async def test_works_when_recording_never_started():
    """Không có stt_stream (ứng viên gõ tay ngay) thì không được vỡ."""
    session = _session()
    assert await session._collect_answer(client_text="Câu trả lời gõ tay") == (
        "Câu trả lời gõ tay"
    )


@pytest.mark.asyncio
async def test_blank_transcript_parts_are_ignored():
    session = _session()
    session._transcript_buffer.extend(["Câu một.", "", "   ", "Câu hai."])
    session.stt_stream = _FakeSTTStream(session, None)

    assert await session._collect_answer(client_text=None) == "Câu một. Câu hai."
