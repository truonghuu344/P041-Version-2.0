"""Unit tests cho STTStream (Gemini Live), chạy hoàn toàn offline.

Trọng tâm là bẫy lại lỗi đã từng mắc: `close()` dừng ngay ở
`generation_complete` ĐẦU TIÊN, nên mọi thứ ứng viên nói sau lần ngập ngừng
đầu bị mất sạch mà không có exception nào. Đó là lỗi câm, chỉ lộ ra khi nghe
lại bản ghi, nên phải có test giữ.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

# pyrefly: ignore [missing-import]
from src.services.voice import stt_service
from src.services.voice.stt_service import STTStream


def _content(interim=None, final=None, done=False):
    return SimpleNamespace(
        interim_input_transcription=SimpleNamespace(text=interim) if interim else None,
        input_transcription=SimpleNamespace(text=final) if final else None,
        generation_complete=done,
    )


def _msg(content):
    return SimpleNamespace(server_content=content)


class _FakeSession:
    """Phát lại kịch bản message, sau đó im lặng như API thật.

    API thật không tự đóng iterator sau khi chốt, nên fake cũng không đóng —
    nếu không thì test sẽ dễ hơn thực tế và bỏ lọt lỗi.
    """

    def __init__(self, script, gap: float = 0.0):
        self._script = script
        self._gap = gap
        self.sent: list[dict] = []

    async def send_realtime_input(self, **kwargs):
        self.sent.append(kwargs)

    async def receive(self):
        for item in self._script:
            if item is None:  # điểm ngập ngừng của ứng viên
                await asyncio.sleep(self._gap)
                continue
            yield _msg(item)
        while True:
            await asyncio.sleep(0.05)


class _FakeCM:
    def __init__(self, session):
        self._session = session
        self.exited = False

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        self.exited = True
        return False


def _install(monkeypatch, session):
    cm = _FakeCM(session)
    captured: dict = {}

    def connect(model=None, config=None):
        captured["model"] = model
        captured["config"] = config
        return cm

    fake_client = SimpleNamespace(
        aio=SimpleNamespace(live=SimpleNamespace(connect=connect))
    )
    monkeypatch.setattr(
        stt_service, "genai", SimpleNamespace(Client=lambda api_key=None: fake_client)
    )
    monkeypatch.setattr(
        stt_service,
        "types",
        SimpleNamespace(
            AudioTranscriptionConfig=lambda **kw: SimpleNamespace(**kw),
            LiveConnectConfig=lambda **kw: SimpleNamespace(**kw),
            Blob=lambda **kw: SimpleNamespace(**kw),
        ),
    )
    monkeypatch.setattr(
        stt_service,
        "get_settings",
        lambda: SimpleNamespace(
            google_genai_api_key="test-key",
            gemini_stt_model="gemini-3.5-transcribe-live",
        ),
    )
    return cm, captured


@pytest.fixture
def fast_drain(monkeypatch):
    """Rút ngắn cửa sổ chờ để test không chạy lâu."""
    monkeypatch.setattr(stt_service, "FINALIZE_QUIET_SECONDS", 0.4)
    monkeypatch.setattr(stt_service, "FINALIZE_TIMEOUT_SECONDS", 5.0)


async def _collect(session, monkeypatch, **kwargs):
    partials, finals, ends = [], [], []

    async def on_partial(text):
        partials.append(text)

    async def on_final(text):
        finals.append(text)

    async def on_end():
        ends.append(1)

    cm, captured = _install(monkeypatch, session)
    stream = STTStream(
        on_partial=on_partial, on_final=on_final, on_utterance_end=on_end, **kwargs
    )
    await stream.start()
    await stream.close()
    return partials, finals, ends, cm, captured


# ---------------------------------------------------------------------------
# Lỗi câm: mất phần sau chỗ ngập ngừng
# ---------------------------------------------------------------------------


async def test_captures_every_segment_after_a_pause(monkeypatch, fast_drain):
    """Câu trả lời dài có nhiều đoạn thì phải giữ đủ, không dừng ở đoạn đầu."""
    session = _FakeSession(
        [
            _content(interim="Tôi có"),
            _content(final="Tôi có ba năm kinh nghiệm.", done=True),
            None,  # ứng viên ngập ngừng
            _content(interim="Dự án"),
            _content(final="Dự án gần nhất dùng Redis.", done=True),
        ],
        gap=0.15,
    )

    _, finals, ends, _, _ = await _collect(session, monkeypatch)

    assert len(finals) == 2, "dừng ở generation_complete đầu tiên là mất câu trả lời"
    assert "ba năm" in finals[0]
    assert "Redis" in finals[1]
    assert len(ends) == 2, "mỗi đoạn nói xong phải báo utterance_end một lần"


async def test_partial_and_final_reach_the_right_callbacks(monkeypatch, fast_drain):
    session = _FakeSession(
        [
            _content(interim="Tôi"),
            _content(interim="Tôi có ba"),
            _content(final="Tôi có ba năm.", done=True),
        ]
    )
    partials, finals, ends, _, _ = await _collect(session, monkeypatch)
    assert partials == ["Tôi", "Tôi có ba"]
    assert finals == ["Tôi có ba năm."]
    assert len(ends) == 1


# ---------------------------------------------------------------------------
# Gửi audio
# ---------------------------------------------------------------------------


async def test_large_payload_is_split_into_100ms_chunks(monkeypatch, fast_drain):
    """Gemini không chốt transcript nếu nuốt một khối lớn nên phải tự cắt nhỏ."""
    session = _FakeSession([])
    _install(monkeypatch, session)
    stream = STTStream()
    await stream.start()
    await stream.send_audio(b"\x00" * 8000)  # ~250ms, cỡ chunk frontend gửi

    audio_sends = [s for s in session.sent if "audio" in s]
    assert [len(s["audio"].data) for s in audio_sends] == [3200, 3200, 1600]
    assert all(s["audio"].mime_type == "audio/pcm;rate=16000" for s in audio_sends)


async def test_close_signals_end_of_audio(monkeypatch, fast_drain):
    session = _FakeSession([])
    await _collect(session, monkeypatch)
    assert any(s.get("audio_stream_end") for s in session.sent)


async def test_empty_audio_is_not_sent(monkeypatch, fast_drain):
    session = _FakeSession([])
    _install(monkeypatch, session)
    stream = STTStream()
    await stream.start()
    await stream.send_audio(b"")
    await stream.send_audio_base64("")
    assert [s for s in session.sent if "audio" in s] == []


# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------


async def test_keyterms_are_passed_as_custom_vocabulary(monkeypatch, fast_drain):
    """Đo được: bật custom_vocabulary đưa WER từ 3.39% về 0% trên bộ thử."""
    session = _FakeSession([])
    _, _, _, _, captured = await _collect(
        session, monkeypatch, keyterms=["FastAPI", "OAuth2"]
    )
    transcription = captured["config"].input_audio_transcription
    assert transcription.custom_vocabulary == ["FastAPI", "OAuth2"]
    assert captured["model"] == "gemini-3.5-transcribe-live"


async def test_no_keyterms_sends_none_not_empty_list(monkeypatch, fast_drain):
    session = _FakeSession([])
    _, _, _, _, captured = await _collect(session, monkeypatch)
    assert captured["config"].input_audio_transcription.custom_vocabulary is None


async def test_session_is_closed_on_exit(monkeypatch, fast_drain):
    session = _FakeSession([])
    _, _, _, cm, _ = await _collect(session, monkeypatch)
    assert cm.exited is True


async def test_start_without_api_key_fails_loudly(monkeypatch):
    """Thiếu key phải ném lỗi rõ ràng, không im lặng nuốt tiếng ứng viên."""
    _install(monkeypatch, _FakeSession([]))
    monkeypatch.setattr(
        stt_service,
        "get_settings",
        lambda: SimpleNamespace(google_genai_api_key="", gemini_stt_model="x"),
    )
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        await STTStream().start()
