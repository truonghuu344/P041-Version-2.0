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
OUTPUT_FORMAT = "mp3_44100_128"


def _synthesize_elevenlabs_sync(
    text: str,
    language: str,
    gender: str,
) -> bytes:
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
    if isinstance(audio, (bytes, bytearray)):
        return bytes(audio)
    buffer = BytesIO()
    for chunk in audio:
        if chunk:
            buffer.write(chunk)
    return buffer.getvalue()


def _synthesize_gtts_sync(text: str, language: str) -> bytes:
    if gTTS is None:
        logger.warning("gTTS is not installed; returning empty audio bytes")
        return b""
    tts = gTTS(text=text, lang=LANG_MAP.get(language, "vi"))
    buffer = BytesIO()
    tts.write_to_fp(buffer)
    return buffer.getvalue()


async def synthesize(
    text: str,
    language: str = "vi",
    gender: str = "female",
) -> bytes:
    """Prefer ElevenLabs and fall back to gTTS for MP3 speech."""
    if not text or not text.strip():
        return b""

    settings = get_settings()
    if settings.elevenlabs_api_key:
        try:
            audio = await asyncio.wait_for(
                asyncio.to_thread(
                    _synthesize_elevenlabs_sync,
                    text,
                    language,
                    gender,
                ),
                timeout=settings.elevenlabs_timeout_seconds,
            )
            if audio:
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
    """Return synthesized audio as base64."""
    audio = await synthesize(text, language, gender)
    return base64.b64encode(audio).decode("ascii")
