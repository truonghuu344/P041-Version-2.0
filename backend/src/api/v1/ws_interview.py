from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import get_settings
from src.db.database import AsyncSessionLocal
from src.db.models import (
    InterviewQuestion,
    InterviewReport,
    InterviewSession,
    UsageEvent,
    User,
)
from src.services.interview_service import (
    evaluate_answer_and_check_followup,
    generate_final_star_report,
)
from src.services.voice import tts_service
from src.services.voice.silence_handler import SilenceHandler
from src.services.voice.stt_service import STTStream
from src.services.voice.voice_orchestrator import VoiceInterviewOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter()


async def _authenticate_ws(token: str | None) -> str | None:
    """Validate JWT and return user_id, or None on failure."""
    if not token:
        return None
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("ver") != settings.jwt_token_version:
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


async def _send_json(ws: WebSocket, data: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(data, ensure_ascii=False))


class VoiceInterviewSession:
    """Manages one voice interview WebSocket session."""

    def __init__(
        self,
        ws: WebSocket,
        session_id: str,
        user_id: str,
    ) -> None:
        self.ws = ws
        self.session_id = session_id
        self.user_id = user_id
        self.orchestrator: VoiceInterviewOrchestrator | None = None
        self.stt_stream: STTStream | None = None
        self.silence_handler: SilenceHandler | None = None
        self._transcript_buffer: list[str] = []
        self._silence_task: asyncio.Task[None] | None = None

    async def run(self) -> None:
        started_at = perf_counter()
        async with AsyncSessionLocal() as db:
            session = await self._load_session(db)
            if not session:
                await _send_json(self.ws, {"type": "error", "message": "Phiên phỏng vấn không tồn tại."})
                return

            if session.status == "completed":
                await _send_json(self.ws, {"type": "error", "message": "Phiên phỏng vấn đã hoàn thành."})
                return

            language = session.language or "vi"
            cv_text = session.cv.raw_text or ""
            jd_title = session.jd.title
            jd_requirements = session.jd.requirements_text

            # Phase 1: Preparing
            await _send_json(self.ws, {
                "type": "status",
                "status": "preparing",
                "message": "Đợi tôi một chút, tôi sẽ xem qua CV của bạn..."
                if language == "vi"
                else "Give me a moment, I'll review your CV...",
            })

            self.orchestrator = VoiceInterviewOrchestrator(
                cv_text=cv_text,
                jd_title=jd_title,
                jd_requirements=jd_requirements,
                language=language,
            )
            self.silence_handler = SilenceHandler(language=language)

            await _send_json(self.ws, {
                "type": "status",
                "status": "ready",
                "message": "Tôi đã xem qua hồ sơ CV của bạn. Bắt đầu vào phòng phỏng vấn."
                if language == "vi"
                else "I've reviewed your CV. Let's begin the interview.",
            })

            # Phase 2: Greeting
            greeting = await self.orchestrator.start()
            await self._send_ai_message(greeting, language)

            # Main loop
            try:
                await self._message_loop(db, session, language)
            except WebSocketDisconnect:
                logger.info("Client disconnected from session %s", self.session_id)
            finally:
                if self.stt_stream:
                    await self.stt_stream.close()
                if self._silence_task:
                    self._silence_task.cancel()

            duration_ms = round((perf_counter() - started_at) * 1000)
            db.add(UsageEvent(
                user_id=self.user_id,
                event_name="voice_interview_session",
                duration_ms=duration_ms,
                metadata_json={"session_id": self.session_id, "turns": self.orchestrator.turn_count},
            ))
            await db.commit()

    async def _message_loop(
        self,
        db: AsyncSession,
        session: InterviewSession,
        language: str,
    ) -> None:
        while True:
            raw = await self.ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "audio_chunk":
                if self.stt_stream:
                    await self.stt_stream.send_audio_base64(msg.get("data", ""))

            elif msg_type == "start_recording":
                self._transcript_buffer.clear()
                self.silence_handler.on_speech_start()
                self.stt_stream = STTStream(
                    language=language,
                    on_partial=self._on_stt_partial,
                    on_final=self._on_stt_final,
                    on_utterance_end=self._on_utterance_end,
                )
                await self.stt_stream.start()
                self._start_silence_monitor()

            elif msg_type == "stop_recording":
                if self.stt_stream:
                    await self.stt_stream.close()
                    self.stt_stream = None
                self._stop_silence_monitor()

            elif msg_type == "submit_answer":
                user_text = msg.get("text") or " ".join(self._transcript_buffer)
                if not user_text.strip():
                    await _send_json(self.ws, {"type": "error", "message": "Không nhận được câu trả lời."})
                    continue

                if self.stt_stream:
                    await self.stt_stream.close()
                    self.stt_stream = None
                self._stop_silence_monitor()

                await _send_json(self.ws, {"type": "ai_thinking"})

                result = await self.orchestrator.next_turn(user_text)
                await self._send_ai_message(result, language)

                # Store Q&A
                q_index = self.orchestrator.turn_count - 1
                prev_messages = self.orchestrator.conversation
                ai_question = ""
                for m in reversed(prev_messages):
                    if m["role"] == "assistant" and m["content"] != result["ai_message"]:
                        ai_question = m["content"]
                        break

                q_obj = InterviewQuestion(
                    session_id=self.session_id,
                    question_index=q_index,
                    question_text=ai_question,
                    user_answer=user_text,
                )
                db.add(q_obj)
                session.current_question_index = q_index + 1
                await db.flush()

                if result["is_complete"]:
                    await self._complete_session(db, session)
                    return

                self._transcript_buffer.clear()

            elif msg_type == "end_session":
                if self.stt_stream:
                    await self.stt_stream.close()
                    self.stt_stream = None
                self._stop_silence_monitor()
                result = await self.orchestrator._force_closing()
                await self._send_ai_message(result, language)
                await self._complete_session(db, session)
                return

    async def _send_ai_message(self, result: dict[str, Any], language: str) -> None:
        ai_text = result["ai_message"]
        try:
            audio_b64 = await tts_service.synthesize_base64(ai_text, language)
        except Exception as exc:
            logger.warning("TTS failed: %s", exc)
            audio_b64 = ""

        await _send_json(self.ws, {
            "type": "ai_message",
            "text": ai_text,
            "audio": audio_b64,
            "phase": result.get("phase", ""),
        })

    async def _complete_session(self, db: AsyncSession, session: InterviewSession) -> None:
        session.status = "completed"
        session.completed_at = datetime.now(UTC)

        qa_pairs = self.orchestrator.get_qa_pairs()
        cv_text = self.orchestrator.cv_text

        history_list: list[dict[str, Any]] = []
        for pair in qa_pairs:
            try:
                evaluation = await evaluate_answer_and_check_followup(
                    question_text=pair["question"],
                    user_answer=pair["answer"],
                    cv_text=cv_text,
                )
            except Exception:
                evaluation = {"star_score": {"situation": 50, "task": 50, "action": 50, "result": 50}}

            history_list.append({
                "question": pair["question"],
                "answer": pair["answer"],
                "score": evaluation.get("star_score", {}),
            })

        # Update stored questions with STAR scores
        questions = await db.scalars(
            select(InterviewQuestion)
            .where(InterviewQuestion.session_id == self.session_id)
            .order_by(InterviewQuestion.question_index)
        )
        for q_obj, hist in zip(questions.all(), history_list):
            q_obj.star_score_json = hist["score"]

        session.total_questions = len(history_list)

        report_data = await generate_final_star_report(
            qa_history=history_list,
            jd_title=self.orchestrator.jd_title,
        )

        db.add(InterviewReport(
            session_id=self.session_id,
            total_score=report_data.get("total_score", 0),
            star_scores_json=report_data.get("star_scores", {}),
            strengths_json=report_data.get("strengths", []),
            improvements_json=report_data.get("improvements", []),
            recommendations_json=report_data.get("recommendations", []),
        ))

        await db.commit()
        await _send_json(self.ws, {"type": "session_complete"})

    async def _load_session(self, db: AsyncSession) -> InterviewSession | None:
        result = await db.execute(
            select(InterviewSession)
            .where(
                InterviewSession.id == self.session_id,
                InterviewSession.user_id == self.user_id,
            )
            .options(
                selectinload(InterviewSession.cv),
                selectinload(InterviewSession.jd),
            )
        )
        return result.scalar_one_or_none()

    async def _on_stt_partial(self, text: str) -> None:
        nudge = self.silence_handler.on_transcript(text)
        await _send_json(self.ws, {"type": "transcript_partial", "text": text})
        if nudge:
            await _send_json(self.ws, {
                "type": "nudge",
                "key": nudge,
                "message": self.silence_handler.get_message(nudge),
            })

    async def _on_stt_final(self, text: str) -> None:
        self._transcript_buffer.append(text)
        self.silence_handler.on_transcript(text)
        await _send_json(self.ws, {"type": "transcript_final", "text": text})

    async def _on_utterance_end(self) -> None:
        pass

    def _start_silence_monitor(self) -> None:
        self._stop_silence_monitor()
        self._silence_task = asyncio.create_task(self._silence_loop())

    def _stop_silence_monitor(self) -> None:
        if self._silence_task:
            self._silence_task.cancel()
            self._silence_task = None

    async def _silence_loop(self) -> None:
        last_nudge: str | None = None
        try:
            while True:
                await asyncio.sleep(2)
                nudge = self.silence_handler.check_silence()
                if nudge and nudge != last_nudge:
                    last_nudge = nudge
                    await _send_json(self.ws, {
                        "type": "nudge",
                        "key": nudge,
                        "message": self.silence_handler.get_message(nudge),
                    })
                    if nudge == "skip":
                        await _send_json(self.ws, {"type": "auto_skip"})
                        break
        except asyncio.CancelledError:
            pass


@router.websocket("/ws/interview/{session_id}")
async def voice_interview_ws(websocket: WebSocket, session_id: str, token: str | None = None):
    """WebSocket endpoint for voice mock interviews."""
    await websocket.accept()

    user_id = await _authenticate_ws(token)
    if not user_id:
        await _send_json(websocket, {"type": "error", "message": "Xác thực thất bại."})
        await websocket.close(code=4001, reason="Unauthorized")
        return

    voice_session = VoiceInterviewSession(
        ws=websocket,
        session_id=session_id,
        user_id=user_id,
    )
    try:
        await voice_session.run()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("Voice interview error for session %s: %s", session_id, exc)
        try:
            await _send_json(websocket, {"type": "error", "message": "Lỗi hệ thống."})
        except Exception:
            pass
