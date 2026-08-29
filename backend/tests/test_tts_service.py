"""Unit tests cho TTS service: ElevenLabs là chính, gTTS là fallback.

Mục tiêu chính là chứng minh fallback THẬT SỰ chạy — nếu ElevenLabs sập hoặc
hết quota mà fallback hỏng thì ứng viên sẽ ngồi trước một buổi phỏng vấn im
lặng, và đó là lỗi khó phát hiện nhất trên production.

Toàn bộ test chạy offline: không gọi ElevenLabs, không gọi Google.
"""

from __future__ import annotations

import time

import pytest

# pyrefly: ignore [missing-import]
from src.services.voice import tts_service

# Header ID3 để phân biệt được đây là MP3 bytes chứ không phải chuỗi bất kỳ.
ELEVEN_MP3 = b"ID3\x04\x00\x00\x00\x00\x00\x00elevenlabs-audio"
GTTS_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00gtts-audio"


class _FakeSettings:
    def __init__(self, api_key: str = "test-key", timeout: float = 15.0) -> None:
        self.elevenlabs_api_key = api_key
        self.elevenlabs_model = "eleven_flash_v2_5"
        self.elevenlabs_voice_id_female = "voice-female"
        self.elevenlabs_voice_id_male = "voice-male"
        self.elevenlabs_timeout_seconds = timeout


def _install_elevenlabs(monkeypatch, result, calls: list[dict]) -> None:
    """Cắm một ElevenLabs client giả. `result` là bytes, iterable, hoặc Exception."""

    class _FakeTextToSpeech:
        def convert(self, **kwargs):
            calls.append(kwargs)
            if isinstance(result, Exception):
                raise result
            if callable(result):
                return result()
            return result

    class _FakeClient:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.text_to_speech = _FakeTextToSpeech()

    monkeypatch.setattr(tts_service, "ElevenLabs", _FakeClient)


def _install_gtts(monkeypatch, calls: list[dict]) -> None:
    class _FakeGTTS:
        def __init__(self, text: str, lang: str) -> None:
            calls.append({"text": text, "lang": lang})

        def write_to_fp(self, fp) -> None:
            fp.write(GTTS_MP3)

    monkeypatch.setattr(tts_service, "gTTS", _FakeGTTS)


@pytest.fixture
def settings(monkeypatch):
    """Cho phép mỗi test tự chọn settings; mặc định là có key ElevenLabs."""
    holder = {"value": _FakeSettings()}
    monkeypatch.setattr(tts_service, "get_settings", lambda: holder["value"])
    return holder


# --------------------------------------------------------------------------
# Đường đi chính: ElevenLabs
# --------------------------------------------------------------------------


async def test_uses_elevenlabs_when_api_key_configured(settings, monkeypatch):
    calls: list[dict] = []
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, calls)

    audio = await tts_service.synthesize("Xin chào", language="vi")

    assert audio == ELEVEN_MP3
    assert audio.startswith(b"ID3"), "output phải là MP3 bytes"
    assert len(calls) == 1
    assert calls[0]["model_id"] == "eleven_flash_v2_5"
    assert calls[0]["voice_id"] == "voice-female"
    assert calls[0]["language_code"] == "vi"
    # Frontend dựng Blob với type audio/mpeg — đổi format là vỡ playAudioBase64().
    assert calls[0]["output_format"] == "mp3_44100_128"


async def test_male_gender_selects_male_voice(settings, monkeypatch):
    calls: list[dict] = []
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, calls)

    await tts_service.synthesize("Xin chào", language="vi", gender="male")

    assert calls[0]["voice_id"] == "voice-male"


async def test_generator_chunks_are_joined(settings, monkeypatch):
    """SDK trả generator các chunk; phải nối lại thành một file MP3 hoàn chỉnh."""
    calls: list[dict] = []
    _install_elevenlabs(monkeypatch, lambda: iter([b"ID3", b"chunk-1", b"", b"chunk-2"]), calls)

    audio = await tts_service.synthesize("Xin chào")

    assert audio == b"ID3chunk-1chunk-2"


async def test_english_maps_to_en_language_code(settings, monkeypatch):
    calls: list[dict] = []
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, calls)

    await tts_service.synthesize("Hello", language="en")

    assert calls[0]["language_code"] == "en"


# --------------------------------------------------------------------------
# Fallback sang gTTS — phần quan trọng nhất của file này
# --------------------------------------------------------------------------


async def test_falls_back_to_gtts_when_elevenlabs_raises(settings, monkeypatch):
    el_calls: list[dict] = []
    gtts_calls: list[dict] = []
    _install_elevenlabs(monkeypatch, RuntimeError("quota_exceeded"), el_calls)
    _install_gtts(monkeypatch, gtts_calls)

    audio = await tts_service.synthesize("Xin chào", language="vi")

    assert audio == GTTS_MP3
    assert len(el_calls) == 1, "phải thử ElevenLabs trước"
    assert gtts_calls == [{"text": "Xin chào", "lang": "vi"}]


async def test_falls_back_to_gtts_when_elevenlabs_returns_empty(settings, monkeypatch):
    _install_elevenlabs(monkeypatch, b"", [])
    gtts_calls: list[dict] = []
    _install_gtts(monkeypatch, gtts_calls)

    audio = await tts_service.synthesize("Xin chào")

    assert audio == GTTS_MP3
    assert len(gtts_calls) == 1


async def test_falls_back_to_gtts_on_timeout(settings, monkeypatch):
    settings["value"] = _FakeSettings(timeout=0.05)
    el_calls: list[dict] = []
    gtts_calls: list[dict] = []

    def _slow():
        time.sleep(0.5)
        return ELEVEN_MP3

    _install_elevenlabs(monkeypatch, _slow, el_calls)
    _install_gtts(monkeypatch, gtts_calls)

    audio = await tts_service.synthesize("Xin chào")

    assert audio == GTTS_MP3, "timeout phải rơi về gTTS, không được treo lượt phỏng vấn"


async def test_skips_elevenlabs_entirely_when_no_api_key(settings, monkeypatch):
    settings["value"] = _FakeSettings(api_key="")
    el_calls: list[dict] = []
    gtts_calls: list[dict] = []
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, el_calls)
    _install_gtts(monkeypatch, gtts_calls)

    audio = await tts_service.synthesize("Xin chào")

    assert audio == GTTS_MP3
    assert el_calls == [], "không có key thì không được gọi ElevenLabs"


async def test_returns_empty_when_both_providers_unavailable(settings, monkeypatch):
    settings["value"] = _FakeSettings(api_key="")
    monkeypatch.setattr(tts_service, "gTTS", None)

    assert await tts_service.synthesize("Xin chào") == b""


# --------------------------------------------------------------------------
# Biên và encoding
# --------------------------------------------------------------------------


@pytest.mark.parametrize("text", ["", "   ", "\n\t "])
async def test_blank_text_returns_no_audio(settings, monkeypatch, text):
    el_calls: list[dict] = []
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, el_calls)

    assert await tts_service.synthesize(text) == b""
    assert el_calls == [], "không được đốt quota cho text rỗng"


async def test_synthesize_base64_roundtrips(settings, monkeypatch):
    import base64

    _install_elevenlabs(monkeypatch, ELEVEN_MP3, [])

    encoded = await tts_service.synthesize_base64("Xin chào")

    assert isinstance(encoded, str)
    assert base64.b64decode(encoded) == ELEVEN_MP3


async def test_synthesize_base64_of_blank_text_is_empty_string(settings, monkeypatch):
    _install_elevenlabs(monkeypatch, ELEVEN_MP3, [])
    assert await tts_service.synthesize_base64("") == ""
