from __future__ import annotations

import asyncio
import base64
import logging
from collections.abc import Callable, Coroutine
from typing import Any

from deepgram import DeepgramClient, LiveOptions, LiveTranscriptionEvents

from src.config import get_settings

logger = logging.getLogger(__name__)

LanguageCode = str


def _live_options(language: LanguageCode) -> LiveOptions:
    lang_map = {"vi": "vi", "en": "en-US"}
    return LiveOptions(
        model="nova-3",
        language=lang_map.get(language, "vi"),
        smart_format=True,
        interim_results=True,
        utterance_end_ms=1500,
        vad_events=True,
    )


class STTStream:
    """Wraps a single Deepgram live-transcription session."""

    def __init__(
        self,
        language: LanguageCode = "vi",
        on_partial: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_final: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_utterance_end: Callable[[], Coroutine[Any, Any, None]] | None = None,
    ) -> None:
        self._language = language
        self._on_partial = on_partial
        self._on_final = on_final
        self._on_utterance_end = on_utterance_end
        self._connection = None
        self._loop = asyncio.get_event_loop()

    async def start(self) -> None:
        settings = get_settings()
        if not settings.deepgram_api_key:
            raise RuntimeError("DEEPGRAM_API_KEY chưa được cấu hình")

        client = DeepgramClient(settings.deepgram_api_key)
        self._connection = client.listen.asynclive.v("1")

        self._connection.on(LiveTranscriptionEvents.Transcript, self._handle_transcript)
        self._connection.on(LiveTranscriptionEvents.UtteranceEnd, self._handle_utterance_end)
        self._connection.on(LiveTranscriptionEvents.Error, self._handle_error)

        await self._connection.start(_live_options(self._language))
        logger.info("Deepgram STT stream started (lang=%s)", self._language)

    async def send_audio(self, audio_bytes: bytes) -> None:
        if self._connection:
            await self._connection.send(audio_bytes)

    async def send_audio_base64(self, b64_data: str) -> None:
        await self.send_audio(base64.b64decode(b64_data))

    async def close(self) -> None:
        if self._connection:
            await self._connection.finish()
            self._connection = None
            logger.info("Deepgram STT stream closed")

    async def _handle_transcript(self, _conn: Any, result: Any, **_kw: Any) -> None:
        transcript = result.channel.alternatives[0].transcript
        if not transcript:
            return
        if result.is_final:
            if self._on_final:
                await self._on_final(transcript)
        else:
            if self._on_partial:
                await self._on_partial(transcript)

    async def _handle_utterance_end(self, _conn: Any, _result: Any, **_kw: Any) -> None:
        if self._on_utterance_end:
            await self._on_utterance_end()

    async def _handle_error(self, _conn: Any, error: Any, **_kw: Any) -> None:
        logger.error("Deepgram STT error: %s", error)
