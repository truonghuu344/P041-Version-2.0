from __future__ import annotations

import asyncio
import base64
import logging
import time
from collections.abc import Callable, Coroutine
from typing import Any

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - chỉ xảy ra khi thiếu dependency
    genai = None
    types = None

from src.config import get_settings

logger = logging.getLogger(__name__)

LanguageCode = str

# PCM16 @16kHz: 16000 mẫu/s × 2 byte = 32000 byte/s, nên 3200 byte ≈ 100ms.
# Gemini Live KHÔNG chốt transcript nếu nhận audio thành một khối lớn duy nhất —
# phải đẩy theo nhịp như luồng thật, nên mọi payload lớn đều được cắt nhỏ ở đây.
AUDIO_MIME = "audio/pcm;rate=16000"
CHUNK_BYTES = 3200

# Server chỉ chốt transcript sau khi nhận `audio_stream_end` (~1.1s).
# Một câu trả lời dài có nhiều đoạn: mỗi lần ứng viên ngập ngừng, VAD chốt một
# `generation_complete` rồi phiên âm tiếp. KHÔNG được dừng ở lần chốt đầu —
# làm vậy là mất sạch phần sau chỗ ngập ngừng mà không có lỗi nào.
# Vì vậy chờ đến khi luồng lặng hẳn, có trần cứng để không treo vô hạn.
FINALIZE_QUIET_SECONDS = 1.5
FINALIZE_TIMEOUT_SECONDS = 8.0


class STTStream:
    """Wraps a single Gemini Live transcription session.

    Interface cố ý giữ mỏng (start / send_audio_base64 / close + 3 callback)
    để đổi nhà cung cấp STT chỉ phải thay ruột file này, không đụng tầng
    WebSocket ở trên.
    """

    def __init__(
        self,
        language: LanguageCode = "vi",
        on_partial: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_final: Callable[[str], Coroutine[Any, Any, None]] | None = None,
        on_utterance_end: Callable[[], Coroutine[Any, Any, None]] | None = None,
        keyterms: list[str] | None = None,
    ) -> None:
        self._language = language
        self._on_partial = on_partial
        self._on_final = on_final
        self._on_utterance_end = on_utterance_end
        # Thuật ngữ rút từ CV/JD. Đã đo: bật custom_vocabulary đưa WER trên bộ
        # thử từ 3.39% về 0% (sửa đúng các ca "CI/CD", "OAuth2").
        self._keyterms = keyterms or []
        self._last_message_at: float | None = None
        self._cm: Any = None
        self._session: Any = None
        self._recv_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if genai is None:
            raise RuntimeError("google-genai chưa được cài")
        settings = get_settings()
        api_key = settings.google_genai_api_key
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY chưa được cấu hình")

        client = genai.Client(api_key=api_key)
        transcription = types.AudioTranscriptionConfig(
            custom_vocabulary=self._keyterms or None,
        )
        config = types.LiveConnectConfig(input_audio_transcription=transcription)

        # connect() là async context manager nhưng vòng đời của session trải dài
        # giữa start() và close(), nên phải vào/ra thủ công.
        self._cm = client.aio.live.connect(model=settings.gemini_stt_model, config=config)
        self._session = await self._cm.__aenter__()
        self._recv_task = asyncio.create_task(self._receive_loop())
        logger.info(
            "Gemini Live STT started (model=%s, lang=%s, keyterms=%d)",
            settings.gemini_stt_model, self._language, len(self._keyterms),
        )

    async def send_audio(self, audio_bytes: bytes) -> None:
        if not self._session or not audio_bytes:
            return
        for offset in range(0, len(audio_bytes), CHUNK_BYTES):
            await self._session.send_realtime_input(
                audio=types.Blob(
                    data=audio_bytes[offset:offset + CHUNK_BYTES],
                    mime_type=AUDIO_MIME,
                )
            )

    async def send_audio_base64(self, b64_data: str) -> None:
        if not b64_data:
            return
        await self.send_audio(base64.b64decode(b64_data))

    async def close(self) -> None:
        if self._session:
            try:
                await self._session.send_realtime_input(audio_stream_end=True)
                self._last_message_at = time.monotonic()
                await self._drain()
            except Exception as exc:  # phiên có thể đã đóng từ phía server
                logger.debug("Không gửi được audio_stream_end: %s", exc)

        if self._recv_task:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except (asyncio.CancelledError, Exception):
                pass
            self._recv_task = None

        if self._cm:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception as exc:
                logger.debug("Lỗi khi đóng phiên Gemini Live: %s", exc)
        self._cm = None
        self._session = None
        logger.info("Gemini Live STT closed")

    async def _drain(self) -> None:
        """Chờ server chốt hết các đoạn còn lại sau `audio_stream_end`."""
        deadline = time.monotonic() + FINALIZE_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            last = self._last_message_at
            if last is not None and (time.monotonic() - last) >= FINALIZE_QUIET_SECONDS:
                return
            await asyncio.sleep(0.1)
        logger.warning(
            "Luồng STT chưa lặng sau %.1fs, đóng phiên với transcript hiện có",
            FINALIZE_TIMEOUT_SECONDS,
        )

    async def _receive_loop(self) -> None:
        """Chuyển async-iterator của Gemini thành các callback của lớp này."""
        try:
            async for message in self._session.receive():
                self._last_message_at = time.monotonic()
                content = getattr(message, "server_content", None)
                if content is None:
                    continue

                # LƯU Ý: interim là TÍCH LUỸ, không phải delta.
                interim = getattr(content, "interim_input_transcription", None)
                if interim is not None and interim.text and self._on_partial:
                    await self._on_partial(interim.text)

                final = getattr(content, "input_transcription", None)
                if final is not None and final.text and self._on_final:
                    await self._on_final(final.text)

                # Mỗi đoạn nói kết thúc là một generation_complete; phiên vẫn
                # chạy tiếp cho đoạn sau.
                if getattr(content, "generation_complete", False) and self._on_utterance_end:
                    await self._on_utterance_end()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Gemini Live STT receive error: %s", exc)
