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
)
from src.services.interview_agenda_service import enabled_questions, get_existing_agenda
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


async def _authenticate_ws(websocket: WebSocket, token: str | None) -> str | None:
    """Validate JWT from query param or cookie, return user_id or None."""
    if not token:
        token = websocket.cookies.get("career_session")
    if not token:
        logger.warning("WS auth: no token in query param or cookie")
        return None
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("ver") != settings.jwt_token_version:
            logger.warning("WS auth: token version mismatch (got %s, expected %s)", payload.get("ver"), settings.jwt_token_version)
            return None
        return payload.get("sub")
    except jwt.PyJWTError as exc:
        logger.warning("WS auth: JWT decode failed: %s", exc)
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
        # Số hàng InterviewQuestion đã ghi cho phiên này. Dùng làm question_index
        # thay cho turn_count vì lượt chào không sinh hàng.
        self._recorded_questions: int = 0

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

            # Buổi phỏng vấn có thể đã chạy dở ở một kết nối trước. Hội thoại
            # của orchestrator không được lưu nên phải dựng lại từ các cặp
            # hỏi–đáp trong DB, nếu không AI sẽ chào và hỏi lại từ đầu.
            previous_pairs = await self._load_previous_qa(db)

            # Phase 1: Preparing
            await _send_json(self.ws, {
                "type": "status",
                "status": "preparing",
                "message": (
                    "Đợi tôi một chút, tôi sẽ xem lại phần chúng ta trao đổi dở..."
                    if previous_pairs
                    else "Đợi tôi một chút, tôi sẽ xem qua CV của bạn..."
                )
                if language == "vi"
                else (
                    "Give me a moment, I'll review where we left off..."
                    if previous_pairs
                    else "Give me a moment, I'll review your CV..."
                ),
            })

            # Nếu ứng viên đã tạo agenda ở trang phỏng vấn thì dùng luôn để
            # LLM bám câu hỏi đã duyệt. CỐ Ý chỉ TRA CỨU chứ không sinh mới:
            # sinh agenda tốn một lời gọi LLM vài giây, làm chậm lúc kết nối
            # WebSocket và tiêu quota của người dùng ngoài ý muốn.
            agenda_questions: list[dict[str, Any]] = []
            try:
                agenda = await get_existing_agenda(
                    db, user=session.user, cv=session.cv, jd=session.jd
                )
                if agenda:
                    agenda_questions = enabled_questions(agenda)
            except Exception as exc:
                logger.warning("Không nạp được agenda cho phiên voice: %s", exc)

            self.orchestrator = VoiceInterviewOrchestrator(
                cv_text=cv_text,
                jd_title=jd_title,
                jd_requirements=jd_requirements,
                language=language,
                agenda_questions=agenda_questions,
            )
            self.silence_handler = SilenceHandler(language=language)

            await _send_json(self.ws, {
                "type": "status",
                "status": "ready",
                "message": (
                    "Tôi đã xem lại phần chúng ta trao đổi dở. Mình tiếp tục nhé."
                    if previous_pairs
                    else "Tôi đã xem qua hồ sơ CV của bạn. Bắt đầu vào phòng phỏng vấn."
                )
                if language == "vi"
                else (
                    "I've reviewed where we left off. Let's continue."
                    if previous_pairs
                    else "I've reviewed your CV. Let's begin the interview."
                ),
            })

            # Phase 2: Chào lần đầu, hoặc nối lại buổi phỏng vấn dở
            opening = await self._begin_conversation(previous_pairs)
            await self._send_ai_message(opening, language)

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
                user_text = await self._collect_answer(msg.get("text"))
                if not user_text:
                    await _send_json(self.ws, {"type": "error", "message": "Không nhận được câu trả lời."})
                    continue

                await _send_json(self.ws, {"type": "ai_thinking"})

                result = await self.orchestrator.next_turn(user_text)
                await self._send_ai_message(result, language)

                # Store Q&A
<<<<<<< HEAD
                await self._record_answer(db, session, user_text, result)
=======
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
                # COMMIT chứ không flush: flush chỉ ghi vào transaction đang mở,
                # nên cả buổi phỏng vấn treo lơ lửng cho tới lúc `run()` kết thúc.
                # Backend restart hay mất kết nối đột ngột giữa chừng là mất SẠCH
                # buổi phỏng vấn, không phải mất một lượt. Chốt từng lượt thì tệ
                # nhất cũng chỉ mất lượt đang dở.
                # An toàn vì AsyncSessionLocal đặt expire_on_commit=False.
                await db.commit()
>>>>>>> 50ef809c611dd4a2ff99e948272a10c09e3c0475

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

    async def _load_previous_qa(self, db: AsyncSession) -> list[dict[str, str]]:
        """Các cặp hỏi–đáp đã lưu của phiên, dùng để nối lại buổi phỏng vấn dở."""
        rows = (
            await db.scalars(
                select(InterviewQuestion)
                .where(
                    InterviewQuestion.session_id == self.session_id,
                    InterviewQuestion.user_answer.is_not(None),
                )
                .order_by(InterviewQuestion.question_index)
            )
        ).all()
        return [
            {"question": row.question_text, "answer": row.user_answer or ""}
            for row in rows
        ]

    async def _begin_conversation(
        self, previous_pairs: list[dict[str, str]]
    ) -> dict[str, Any]:
        """Mở đầu buổi phỏng vấn: chào mới, hoặc nối tiếp phần đang dở."""
        if not previous_pairs:
            return await self.orchestrator.start()

        # Đánh số tiếp từ số câu đã lưu. Nếu bỏ bước này, kết nối lại sẽ ghi đè
        # question_index từ 0 và làm trùng chỉ số với các câu của lần trước.
        self._recorded_questions = len(previous_pairs)
        await _send_json(self.ws, {"type": "history", "pairs": previous_pairs})
        return await self.orchestrator.resume(previous_pairs)

    def _preceding_ai_question(self, current_ai_message: str) -> str:
        """Message assistant gần nhất đứng trước lượt trả lời hiện tại."""
        for message in reversed(self.orchestrator.conversation):
            if message["role"] == "assistant" and message["content"] != current_ai_message:
                return message["content"]
        return ""

    async def _record_answer(
        self,
        db: AsyncSession,
        session: InterviewSession,
        user_text: str,
        result: dict[str, Any],
    ) -> InterviewQuestion | None:
        """Ghi một cặp hỏi–đáp thật vào DB, trả về hàng vừa tạo (nếu có).

        Lượt trả lời đầu tiên bị bỏ qua: message assistant đứng trước nó là lời
        chào mở đầu, không phải câu hỏi phỏng vấn. Ghi lại lượt đó sẽ làm các
        hàng InterviewQuestion lệch một nhịp so với cặp hỏi–đáp dùng chấm STAR
        (`VoiceInterviewOrchestrator.get_qa_pairs()` loại lời chào ra).
        """
        if self.orchestrator.turn_count <= 1:
            return None

        q_obj = InterviewQuestion(
            session_id=self.session_id,
            question_index=self._recorded_questions,
            question_text=self._preceding_ai_question(result["ai_message"]),
            user_answer=user_text,
        )
        db.add(q_obj)
        self._recorded_questions += 1
        session.current_question_index = self._recorded_questions
        await db.flush()
        return q_obj

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

        cv_text = self.orchestrator.cv_text

        # Chấm điểm ngay trên từng hàng InterviewQuestion đã lưu, thay vì chấm
        # trên một danh sách riêng rồi ghép ngược lại bằng zip() theo vị trí.
        # Cách ghép theo vị trí từng gán điểm sang nhầm câu khi hai danh sách
        # không cùng độ dài hoặc không cùng thứ tự.
        answered_questions = (
            await db.scalars(
                select(InterviewQuestion)
                .where(
                    InterviewQuestion.session_id == self.session_id,
                    InterviewQuestion.user_answer.is_not(None),
                )
                .order_by(InterviewQuestion.question_index)
            )
        ).all()

        history_list: list[dict[str, Any]] = []
        for q_obj in answered_questions:
            try:
                evaluation = await evaluate_answer_and_check_followup(
                    question_text=q_obj.question_text,
                    user_answer=q_obj.user_answer or "",
                    cv_text=cv_text,
                )
            except Exception:
                evaluation = {"star_score": {"situation": 50, "task": 50, "action": 50, "result": 50}}

            star_score = evaluation.get("star_score", {})
            q_obj.star_score_json = star_score
            history_list.append({
                "question": q_obj.question_text,
                "answer": q_obj.user_answer or "",
                "score": star_score,
            })

        session.total_questions = len(history_list)

        if history_list:
            try:
                report_data = await generate_final_star_report(
                    qa_history=history_list,
                    jd_title=self.orchestrator.jd_title,
                )
            except Exception:
                logger.warning("Report generation failed, using defaults")
                report_data = {}
        else:
            report_data = {
                "total_score": 0,
                "star_scores": {"situation": 0, "task": 0, "action": 0, "result": 0},
                "strengths": [],
                "improvements": ["Phiên phỏng vấn kết thúc sớm, chưa có câu trả lời để đánh giá."],
                "recommendations": ["Hãy thử lại và trả lời ít nhất một câu hỏi để nhận phản hồi chi tiết."],
            }

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
                # user cần cho get_existing_agenda(); thiếu selectinload ở đây
                # thì truy cập session.user sẽ lazy-load trong ngữ cảnh async
                # và ném MissingGreenlet.
                selectinload(InterviewSession.user),
            )
        )
        return result.scalar_one_or_none()

    async def _collect_answer(self, client_text: str | None) -> str:
        """Chốt câu trả lời của ứng viên, ĐÓNG luồng STT trước khi đọc transcript.

        Thứ tự ở đây là bản chất chứ không phải chi tiết: `STTStream.close()`
        chờ server chốt nốt các đoạn nói cuối (`_drain`), và những đoạn đó chỉ
        rơi vào `_transcript_buffer` SAU khi close chạy xong. Đọc transcript
        trước khi đóng là vứt mất phần ứng viên vừa nói — quan sát được trên
        dữ liệu thật: câu trả lời cụt giữa chừng ở "…sau đó mình sẽ".

        Bản của server đầy đủ hơn bản client gửi lên, vì client chỉ có những
        `transcript_final` kịp về trước lúc bấm nút. Text từ client chỉ dùng khi
        ứng viên gõ tay thay vì nói.
        """
        if self.stt_stream:
            await self.stt_stream.close()
            self.stt_stream = None
        self._stop_silence_monitor()

        transcribed = " ".join(
            part.strip() for part in self._transcript_buffer if part and part.strip()
        )
        if transcribed:
            return transcribed
        return (client_text or "").strip()

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

    user_id = await _authenticate_ws(websocket, token)
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
