from __future__ import annotations

import asyncio
import base64
import logging
from io import BytesIO

try:
    from gtts import gTTS
except ImportError:
    gTTS = None

logger = logging.getLogger(__name__)

LANG_MAP: dict[str, str] = {"vi": "vi", "en": "en"}


def _synthesize_sync(text: str, language: str) -> bytes:
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
    """Convert text to MP3 audio bytes using Google Translate TTS."""
    if not text or not text.strip():
        return b""
    audio = await asyncio.to_thread(_synthesize_sync, text, language)
    logger.debug("TTS synthesized %d bytes (lang=%s)", len(audio), language)
    return audio


async def synthesize_base64(
    text: str,
    language: str = "vi",
    gender: str = "female",
) -> str:
    """Same as synthesize() but returns base64-encoded string."""
    audio = await synthesize(text, language, gender)
    return base64.b64encode(audio).decode("ascii")
