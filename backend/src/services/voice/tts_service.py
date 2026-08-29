from __future__ import annotations

import asyncio
import base64
import logging
from io import BytesIO

try:
    from elevenlabs.client import ElevenLabs
except ImportError:
    ElevenLabs = None

try:
    from gtts import gTTS
except ImportError:
    gTTS = None  # noqa: N816

from src.config import get_settings

logger = logging.getLogger(__name__)

LANG_MAP: dict[str, str] = {"vi": "vi", "en": "en"}

# Khớp với `new Blob([bytes], { type: 'audio/mpeg' })` ở playAudioBase64()
# trong frontend/app.js — đổi định dạng này là phải sửa cả frontend.
OUTPUT_FORMAT = "mp3_44100_128"


def _synthesize_elevenlabs_sync(text: str, language: str, gender: str) -> bytes:
    """Gọi ElevenLabs TTS. Trả về b"" nếu chưa cấu hình được (để caller fallback)."""
    if ElevenLabs is None:
        logger.warning("elevenlabs SDK chưa được cài; bỏ qua ElevenLabs")
        return b""

    settings = get_settings()
    voice_id = (
        settings.elevenlabs_voice_id_male
        if gender == "male"
        else settings.elevenlabs_voice_id_female
    )
    client = ElevenLabs(api_key=settings.elevenlabs_api_key)
    audio = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=settings.elevenlabs_model,
        language_code=LANG_MAP.get(language, "vi"),
        output_format=OUTPUT_FORMAT,
    )

    # SDK trả về generator các chunk bytes; một số phiên bản trả thẳng bytes.
    if isinstance(audio, (bytes, bytearray)):
        return bytes(audio)
    buf = BytesIO()
    for chunk in audio:
        if chunk:
            buf.write(chunk)
    return buf.getvalue()


def _synthesize_gtts_sync(text: str, language: str) -> bytes:
    if gTTS is None:
        logger.warning("gTTS is not installed; returning empty audio bytes")
        return b""
    lang = LANG_MAP.get(language, "vi")
    tts = gTTS(text=text, lang=lang)
    buf = BytesIO()
    tts.write_to_fp(buf)
    return buf.getvalue()


async def synthesize(
    text: str,
    language: str = "vi",
    gender: str = "female",
) -> bytes:
    """Chuyển text thành MP3 bytes.

    Ưu tiên ElevenLabs; tự động rơi về gTTS khi thiếu key, timeout, lỗi mạng
    hoặc hết quota. Giọng máy vẫn tốt hơn là ứng viên không nghe thấy gì.
    """
    if not text or not text.strip():
        return b""

    settings = get_settings()
    if settings.elevenlabs_api_key:
        try:
            audio = await asyncio.wait_for(
                asyncio.to_thread(_synthesize_elevenlabs_sync, text, language, gender),
                timeout=settings.elevenlabs_timeout_seconds,
            )
            if audio:
                logger.debug("ElevenLabs TTS %d bytes (lang=%s)", len(audio), language)
                return audio
            logger.warning("ElevenLabs trả về audio rỗng; fallback sang gTTS")
        except TimeoutError:
            logger.warning(
                "ElevenLabs TTS timeout sau %.1fs; fallback sang gTTS",
                settings.elevenlabs_timeout_seconds,
            )
        except Exception as exc:
            logger.warning("ElevenLabs TTS lỗi (%s); fallback sang gTTS", exc)

    audio = await asyncio.to_thread(_synthesize_gtts_sync, text, language)
    logger.debug("gTTS synthesized %d bytes (lang=%s)", len(audio), language)
    return audio


async def synthesize_base64(
    text: str,
    language: str = "vi",
    gender: str = "female",
) -> str:
    """Same as synthesize() but returns base64-encoded string."""
    audio = await synthesize(text, language, gender)
    return base64.b64encode(audio).decode("ascii")
