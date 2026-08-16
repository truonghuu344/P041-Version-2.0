from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from src.config import get_settings

logger = logging.getLogger(__name__)

PHASES = [
    "greeting",
    "self_intro",
    "experience",
    "position_knowledge",
    "company_knowledge",
    "closing",
]

SYSTEM_PROMPT_VI = """Bạn là trợ lý phỏng vấn AI của Career Buddy. Bạn đang thực hiện buổi phỏng vấn thử cho vị trí **{jd_title}**.

## CV ứng viên:
{cv_text}

## Yêu cầu công việc (JD):
{jd_requirements}

## Quy tắc phỏng vấn — BẮT BUỘC tuân theo:
- Nói tự nhiên, thân thiện nhưng chuyên nghiệp như nhà tuyển dụng thật.
- KHÔNG BAO GIỜ nói "Câu 1", "Câu tiếp theo", "Câu hỏi số 2" — chuyển câu hỏi mượt mà.
- KHÔNG BAO GIỜ lặp lại lời chào hoặc giới thiệu bản thân lần thứ hai. Greeting chỉ xảy ra MỘT LẦN DUY NHẤT ở đầu buổi phỏng vấn.
- Mỗi lượt nói ngắn gọn (2–4 câu). Đây sẽ được đọc bằng giọng nói nên phải tự nhiên khi nghe.
- Chú trọng hỏi về CON SỐ, kết quả cụ thể khi hỏi về dự án.
- Nếu ứng viên trả lời quá ngắn/chung chung → hỏi follow-up để làm rõ.
- Nếu kinh nghiệm trong CV khớp với yêu cầu JD → ưu tiên hỏi về kinh nghiệm khớp đó trước.

## Các giai đoạn phỏng vấn (theo thứ tự NGHIÊM NGẶT):
1. **greeting**: Chào ứng viên, giới thiệu bản thân (trợ lý phỏng vấn Career Buddy), nêu vị trí phỏng vấn, hỏi sẵn sàng chưa. CHỈ LÀM MỘT LẦN.
2. **self_intro**: "Bạn có thể giới thiệu sơ qua một chút về bản thân không?"
3. **experience**: Hỏi về kinh nghiệm làm việc, dự án nổi bật, kỹ năng kỹ thuật.
   - Nếu CV có kinh nghiệm khớp JD → hỏi về kinh nghiệm đó trước.
   - Hỏi về dự án: "Hãy kể về dự án nổi bật nhất của bạn?"
   - Follow-up về con số: "Con số đó nghĩa là gì?"
   - Hỏi kỹ năng: "Bạn có thể giải thích ngắn gọn [khái niệm từ CV] là gì?"
   - Có thể hỏi 2-3 câu trong giai đoạn này.
4. **position_knowledge**: "Bạn biết những gì về vị trí này?"
5. **company_knowledge**: "Bạn hiểu gì về công ty chúng tôi?"
6. **closing**: Cảm ơn ứng viên đã dành thời gian cho buổi phỏng vấn. Nhận xét ngắn gọn. Chúc may mắn. PHẢI set done=true.

## QUAN TRỌNG — Tránh lỗi:
- SAU KHI đã greeting, KHÔNG BAO GIỜ quay lại phase "greeting".
- Mỗi phase chỉ đi theo chiều tới, không quay ngược.
- Khi đến phase "closing", LUÔN set "done": true.

## Format trả về — BẮT BUỘC trả về JSON duy nhất:
{{"message": "Câu nói của bạn...", "phase": "greeting", "done": false}}

- `message`: Nội dung bạn nói (ngắn gọn, tự nhiên).
- `phase`: Giai đoạn hiện tại (một trong: greeting, self_intro, experience, position_knowledge, company_knowledge, closing).
- `done`: `true` chỉ khi phase = "closing" VÀ bạn đã nói lời cảm ơn. Ngược lại `false`.

KHÔNG thêm text nào ngoài JSON. KHÔNG bọc trong markdown code block."""

SYSTEM_PROMPT_EN = """You are Career Buddy's AI interview assistant. You are conducting a mock interview for the position of **{jd_title}**.

## Candidate's CV:
{cv_text}

## Job Requirements (JD):
{jd_requirements}

## Interview Rules — MANDATORY:
- Speak naturally and professionally, like a real recruiter.
- NEVER say "Question 1", "Next question" — transition smoothly.
- NEVER repeat the greeting or self-introduction. Greeting happens ONCE at the start.
- Keep each response short (2–4 sentences). This will be read aloud by TTS.
- Focus on asking about NUMBERS and concrete results in projects.
- If the candidate gives a short/vague answer → ask a follow-up.
- If CV experience matches JD requirements → ask about matching experience first.

## Interview Phases (STRICT order):
1. **greeting**: Greet, introduce yourself (Career Buddy interview assistant), state the position, ask if ready. ONLY ONCE.
2. **self_intro**: "Could you briefly introduce yourself?"
3. **experience**: Ask about work experience, best projects, technical skills.
   - If CV matches JD → prioritize matching experience.
   - Ask about projects, numbers, skills. Can ask 2-3 questions here.
4. **position_knowledge**: "What do you know about this position?"
5. **company_knowledge**: "What do you know about our company?"
6. **closing**: Thank the candidate for their time. Brief feedback. Good luck. MUST set done=true.

## IMPORTANT — Avoid errors:
- AFTER greeting, NEVER return to phase "greeting".
- Phases only move forward, never backward.
- When reaching "closing", ALWAYS set "done": true.

## Response Format — MUST return JSON only:
{{"message": "Your response...", "phase": "greeting", "done": false}}

No additional text outside the JSON. No markdown code blocks."""


def _build_system_prompt(
    cv_text: str,
    jd_title: str,
    jd_requirements: str,
    language: str,
) -> str:
    template = SYSTEM_PROMPT_VI if language == "vi" else SYSTEM_PROMPT_EN
    cv_truncated = cv_text[:3000] if len(cv_text) > 3000 else cv_text
    jd_truncated = jd_requirements[:2000] if len(jd_requirements) > 2000 else jd_requirements
    return template.format(
        jd_title=jd_title,
        cv_text=cv_truncated,
        jd_requirements=jd_truncated,
    )


def _extract_llm_response(
    content: str, fallback_phase: str,
) -> tuple[str, str, bool]:
    """Extract (message, phase, done) from LLM output, handling all edge cases."""
    text = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    parsed = None
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except (json.JSONDecodeError, ValueError):
            parsed = None

    if isinstance(parsed, dict):
        msg = parsed.get("message") or parsed.get("text") or parsed.get("response")
        if isinstance(msg, str) and msg.strip():
            phase = parsed.get("phase", fallback_phase)
            return msg.strip(), phase if phase in PHASES else fallback_phase, bool(parsed.get("done", False))

    match = re.search(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)"', content)
    if match:
        phase_m = re.search(r'"phase"\s*:\s*"(\w+)"', content)
        phase = phase_m.group(1) if phase_m and phase_m.group(1) in PHASES else fallback_phase
        done_m = re.search(r'"done"\s*:\s*true', content, re.IGNORECASE)
        return match.group(1), phase, bool(done_m)

    if content.strip().startswith("{") or content.strip().startswith('"'):
        return "", fallback_phase, False
    return content, fallback_phase, False


MAX_TURNS_PER_PHASE = {
    "greeting": 1,
    "self_intro": 1,
    "experience": 3,
    "position_knowledge": 1,
    "company_knowledge": 1,
    "closing": 1,
}


class VoiceInterviewOrchestrator:
    """Conversational interview engine using Gemini Flash for fast responses."""

    def __init__(
        self,
        cv_text: str,
        jd_title: str,
        jd_requirements: str,
        language: str = "vi",
    ) -> None:
        self.cv_text = cv_text
        self.jd_title = jd_title
        self.jd_requirements = jd_requirements
        self.language = language
        self.conversation: list[dict[str, str]] = []
        self.current_phase: str = "greeting"
        self.is_done: bool = False
        self.turn_count: int = 0
        self._phase_turn_count: int = 0
        self._system_prompt = _build_system_prompt(
            cv_text, jd_title, jd_requirements, language,
        )

    async def start(self) -> dict[str, Any]:
        """Generate the opening greeting (no user input needed)."""
        synthetic_msg = (
            "(Ứng viên vừa kết nối. Hãy chào hỏi.)"
            if self.language == "vi"
            else "(The candidate just connected. Please greet them.)"
        )
        self.conversation.append({"role": "user", "content": synthetic_msg})
        return await self._call_llm()

    async def next_turn(self, user_text: str) -> dict[str, Any]:
        """Process user's response and generate next interviewer utterance."""
        self.conversation.append({"role": "user", "content": user_text})
        self.turn_count += 1
        if self.turn_count >= 10:
            return await self._force_closing()
        return await self._call_llm()

    def get_qa_pairs(self) -> list[dict[str, str]]:
        """Extract question-answer pairs from conversation history for STAR scoring."""
        pairs: list[dict[str, str]] = []
        messages = self.conversation
        i = 0
        while i < len(messages):
            if messages[i]["role"] == "assistant":
                question = messages[i]["content"]
                answer_parts: list[str] = []
                j = i + 1
                while j < len(messages) and messages[j]["role"] == "user":
                    answer_parts.append(messages[j]["content"])
                    j += 1
                if answer_parts:
                    pairs.append({
                        "question": question,
                        "answer": " ".join(answer_parts),
                    })
                i = j
            else:
                i += 1
        return pairs

    def _next_phase(self, current: str) -> str:
        if current not in PHASES or current == "closing":
            return current
        idx = PHASES.index(current)
        return PHASES[idx + 1] if idx + 1 < len(PHASES) else current

    def _build_phase_hint(self) -> str:
        if self.language == "vi":
            return (
                f'[Giai đoạn hiện tại: "{self.current_phase}". '
                f"Hãy set phase đúng trong JSON. "
                f"Nếu đã xong giai đoạn này, chuyển sang phase tiếp theo.]"
            )
        return (
            f'[Current phase: "{self.current_phase}". '
            f"Set the phase field correctly in your JSON response. "
            f"If this phase is done, advance to the next phase.]"
        )

    async def _call_llm(self) -> dict[str, Any]:
        settings = get_settings()
        api_key = settings.google_genai_api_key
        if not api_key:
            return self._fallback_response()

        messages: list[dict[str, str]] = [
            {"role": "system", "content": self._system_prompt},
        ]
        messages.extend(self.conversation)
        messages.append({"role": "system", "content": self._build_phase_hint()})

        content = await self._try_gemini(api_key, settings.voice_llm_model, messages)
        if content is None:
            logger.info("Primary model failed, trying fallback: %s", settings.voice_llm_fallback_model)
            content = await self._try_gemini(api_key, settings.voice_llm_fallback_model, messages)
        if content is None:
            return self._fallback_response()

        ai_message, phase, done = _extract_llm_response(content, self.current_phase)
        if not ai_message:
            return self._fallback_response()

        phase_index = PHASES.index(phase) if phase in PHASES else -1
        current_index = PHASES.index(self.current_phase) if self.current_phase in PHASES else -1
        if phase_index < current_index and phase != "closing":
            phase = self.current_phase

        if phase == self.current_phase:
            self._phase_turn_count += 1
            max_turns = MAX_TURNS_PER_PHASE.get(phase, 1)
            if self._phase_turn_count > max_turns:
                phase = self._next_phase(phase)
                self._phase_turn_count = 0
        else:
            self._phase_turn_count = 0

        if phase == "closing":
            done = True

        self.current_phase = phase
        self.is_done = done
        self.conversation.append({"role": "assistant", "content": ai_message})
        return {
            "ai_message": ai_message,
            "phase": phase,
            "is_complete": done,
        }

    async def _try_gemini(self, api_key: str, model: str, messages: list[dict]) -> str | None:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            gemini_contents = []
            for msg in messages:
                if msg["role"] == "system":
                    continue
                gemini_contents.append(
                    types.Content(
                        role="model" if msg["role"] == "assistant" else "user",
                        parts=[types.Part(text=msg["content"])],
                    )
                )
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents=gemini_contents,
                    config=types.GenerateContentConfig(
                        system_instruction=self._system_prompt,
                        temperature=0.7,
                        max_output_tokens=400,
                        response_mime_type="application/json",
                    ),
                ),
                timeout=30,
            )
            return response.text or None
        except TimeoutError:
            logger.warning("Gemini timed out after 30s")
            return None
        except Exception as exc:
            logger.warning("Gemini failed: %s", exc)
            return None

    async def _force_closing(self) -> dict[str, Any]:
        closing = (
            "Cảm ơn bạn đã dành thời gian cho buổi phỏng vấn thử hôm nay. "
            "Kết quả chi tiết sẽ được chấm theo tiêu chí STAR. Chúc bạn may mắn!"
            if self.language == "vi"
            else "Thank you for your time in this mock interview. "
            "Detailed results will be scored using STAR criteria. Good luck!"
        )
        self.current_phase = "closing"
        self.is_done = True
        self.conversation.append({"role": "assistant", "content": closing})
        return {"ai_message": closing, "phase": "closing", "is_complete": True}

    def _fallback_response(self) -> dict[str, Any]:
        fallbacks_vi = {
            "greeting": f"Chào bạn. Tôi là trợ lý phỏng vấn của Career Buddy. Hôm nay chúng ta sẽ có một buổi phỏng vấn thử cho vị trí {self.jd_title}. Bạn đã sẵn sàng chưa?",
            "self_intro": "Bạn có thể giới thiệu sơ qua một chút về bản thân không?",
            "experience": "Bạn có thể kể về một dự án hoặc kinh nghiệm nổi bật nhất của mình không?",
            "position_knowledge": "Bạn biết những gì về vị trí này?",
            "company_knowledge": "Bạn hiểu gì về công ty chúng tôi?",
            "closing": "Cảm ơn bạn đã dành thời gian cho buổi phỏng vấn thử hôm nay. Chúc bạn may mắn!",
        }
        fallbacks_en = {
            "greeting": f"Hello! I'm Career Buddy's interview assistant. Today we'll have a mock interview for the {self.jd_title} position. Are you ready?",
            "self_intro": "Could you briefly introduce yourself?",
            "experience": "Can you tell me about your most notable project or experience?",
            "position_knowledge": "What do you know about this position?",
            "company_knowledge": "What do you know about our company?",
            "closing": "Thank you for your time in this mock interview. Good luck!",
        }
        fallbacks = fallbacks_vi if self.language == "vi" else fallbacks_en
        msg = fallbacks.get(self.current_phase, fallbacks["closing"])
        done = self.current_phase == "closing"

        if self.current_phase in PHASES and self.current_phase != "closing":
            idx = PHASES.index(self.current_phase)
            if idx + 1 < len(PHASES):
                self.current_phase = PHASES[idx + 1]

        self.conversation.append({"role": "assistant", "content": msg})
        return {"ai_message": msg, "phase": self.current_phase, "is_complete": done}
