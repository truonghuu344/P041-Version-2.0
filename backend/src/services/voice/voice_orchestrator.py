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
    "skills",
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
3. **experience**: Hỏi về kinh nghiệm làm việc và dự án nổi bật. Hỏi 2-3 câu:
   - Nếu CV có kinh nghiệm khớp JD → hỏi về kinh nghiệm đó trước.
   - "Hãy kể về dự án nổi bật nhất của bạn?"
   - Follow-up: hỏi về vai trò cụ thể, con số/kết quả đạt được, thách thức gặp phải.
   - "Bạn đã đóng vai trò gì trong dự án đó? Kết quả cụ thể ra sao?"
4. **skills**: Hỏi về kỹ năng kỹ thuật. Hỏi 1-2 câu:
   - **Kỹ năng CV khớp JD**: Chọn 1 kỹ năng có trong CV mà JD cũng yêu cầu → hỏi sâu: "Bạn có thể giải thích ngắn gọn [kỹ năng] là gì và bạn đã áp dụng nó như thế nào?"
   - **Kỹ năng JD mà CV không có**: Nếu JD yêu cầu kỹ năng mà CV không liệt kê → chọn random 1 kỹ năng và hỏi: "Trong JD có yêu cầu [kỹ năng], bạn có biết về kỹ năng này không?"
   - Nếu ứng viên trả lời "không biết nhưng sẽ tìm hiểu thêm" → ghi nhận tích cực: "Rất tốt, tinh thần học hỏi là một điểm cộng lớn." rồi chuyển tiếp.
   - Nếu ứng viên biết → hỏi follow-up ngắn về cách áp dụng.
5. **position_knowledge**: "Bạn biết những gì về vị trí này?"
6. **company_knowledge**: "Bạn hiểu gì về công ty chúng tôi?"
7. **closing**: Cảm ơn ứng viên đã dành thời gian cho buổi phỏng vấn. Nhận xét ngắn gọn. Chúc may mắn. PHẢI set done=true.

## Xử lý câu ngoài phỏng vấn — RẤT QUAN TRỌNG:
- Nếu ứng viên KHÔNG trả lời câu hỏi phỏng vấn mà nói những câu như:
  - "Bạn có nghe tôi nói không?" → "Có, tôi nghe rõ rồi! Quay lại câu hỏi nhé — bạn có thể giới thiệu sơ qua về bản thân không?"
  - "Tôi không hiểu câu hỏi, bạn có thể nói lại được không?" → "Tất nhiên! [Nhắc lại câu hỏi hiện tại]"
  - "Xin chào", "Test thử" → Trả lời ngắn rồi nhắc lại câu hỏi.
- TUYỆT ĐỐI KHÔNG chuyển sang câu hỏi mới / phase mới khi ứng viên chưa thực sự trả lời.
- Giữ nguyên phase hiện tại cho đến khi ứng viên trả lời đúng nội dung phỏng vấn.
- Đây là lỗi nghiêm trọng nhất: bỏ qua câu hỏi lại của ứng viên và chuyển sang phase khác.

## QUAN TRỌNG — Tránh lỗi:
- SAU KHI đã greeting, KHÔNG BAO GIỜ quay lại phase "greeting".
- Mỗi phase chỉ đi theo chiều tới, không quay ngược.
- Khi đến phase "closing", LUÔN set "done": true.

## Format trả về — BẮT BUỘC trả về JSON duy nhất:
{{"message": "Câu nói của bạn...", "phase": "greeting", "done": false}}

- `message`: Nội dung bạn nói (ngắn gọn, tự nhiên).
- `phase`: Giai đoạn hiện tại (một trong: greeting, self_intro, experience, skills, position_knowledge, company_knowledge, closing).
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
3. **experience**: Ask about work experience and notable projects. Ask 2-3 questions:
   - If CV matches JD → prioritize matching experience.
   - "Tell me about your most notable project?"
   - Follow-up: ask about specific role, numbers/results achieved, challenges faced.
   - "What was your role in that project? What were the concrete results?"
4. **skills**: Ask about technical skills. Ask 1-2 questions:
   - **CV skills matching JD**: Pick 1 skill listed in both CV and JD → ask deeper: "Can you briefly explain what [skill] is and how you've applied it?"
   - **JD skills missing from CV**: If JD requires a skill not in CV → pick 1 random skill and ask: "The JD mentions [skill], are you familiar with it?"
   - If candidate says "I don't know but I'll learn" → respond positively: "That's great, a willingness to learn is a big plus." then move on.
   - If candidate knows it → ask a short follow-up about practical application.
5. **position_knowledge**: "What do you know about this position?"
6. **company_knowledge**: "What do you know about our company?"
7. **closing**: Thank the candidate for their time. Brief feedback. Good luck. MUST set done=true.

## Handling off-topic responses — VERY IMPORTANT:
- If the candidate does NOT answer the interview question but says things like:
  - "Can you hear me?" → "Yes, I can hear you! Let me repeat — could you briefly introduce yourself?"
  - "I don't understand, can you repeat?" → "Of course! [Repeat the current question]"
  - "Hello", "Testing" → Respond briefly then repeat the question.
- ABSOLUTELY DO NOT advance to a new question / new phase when the candidate hasn't actually answered.
- Keep the current phase until the candidate gives a proper interview answer.
- This is the most critical error to avoid: skipping the candidate's request and moving to a different phase.

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


def _try_parse_dict(text: str) -> dict | None:
    """Try to parse text as JSON dict, handling double-encoded strings."""
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except (json.JSONDecodeError, ValueError):
            return None
    return parsed if isinstance(parsed, dict) else None


def _dict_to_tuple(d: dict, fallback_phase: str) -> tuple[str, str, bool] | None:
    msg = d.get("message") or d.get("text") or d.get("response")
    if isinstance(msg, str) and msg.strip():
        phase = d.get("phase", fallback_phase)
        return msg.strip(), phase if phase in PHASES else fallback_phase, bool(d.get("done", False))
    return None


def _extract_llm_response(
    content: str, fallback_phase: str,
) -> tuple[str, str, bool]:
    """Extract (message, phase, done) from LLM output, handling all edge cases."""
    text = content.strip()

    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        parsed = _try_parse_dict(fenced.group(1).strip())
        if parsed:
            result = _dict_to_tuple(parsed, fallback_phase)
            if result:
                return result

    parsed = _try_parse_dict(text)
    if parsed:
        result = _dict_to_tuple(parsed, fallback_phase)
        if result:
            return result

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        parsed = _try_parse_dict(text[brace_start:brace_end + 1])
        if parsed:
            result = _dict_to_tuple(parsed, fallback_phase)
            if result:
                return result

    match = re.search(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)"', content)
    if match:
        phase_m = re.search(r'"phase"\s*:\s*"(\w+)"', content)
        phase = phase_m.group(1) if phase_m and phase_m.group(1) in PHASES else fallback_phase
        done_m = re.search(r'"done"\s*:\s*true', content, re.IGNORECASE)
        return match.group(1), phase, bool(done_m)

    if text.startswith("{") or text.startswith('"'):
        return "", fallback_phase, False
    return content, fallback_phase, False


MAX_TURNS_PER_PHASE = {
    "greeting": 1,
    "self_intro": 3,
    "experience": 5,
    "skills": 3,
    "position_knowledge": 2,
    "company_knowledge": 2,
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
        if self.turn_count >= 15:
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
                f"CHỈ chuyển sang phase tiếp theo khi ứng viên ĐÃ TRẢ LỜI ĐÚNG nội dung câu hỏi. "
                f"Nếu ứng viên hỏi lại, nói không hiểu, hoặc nói ngoài lề → GIỮ NGUYÊN phase hiện tại và nhắc lại câu hỏi.]"
            )
        return (
            f'[Current phase: "{self.current_phase}". '
            f"Set the phase field correctly in your JSON response. "
            f"ONLY advance to the next phase when the candidate HAS ACTUALLY ANSWERED the question. "
            f"If they ask to repeat, say they don't understand, or go off-topic → KEEP the current phase and re-ask.]"
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
            "skills": "Trong CV bạn có đề cập một số kỹ năng kỹ thuật. Bạn có thể chia sẻ thêm về kỹ năng mà bạn tự tin nhất không?",
            "position_knowledge": "Bạn biết những gì về vị trí này?",
            "company_knowledge": "Bạn hiểu gì về công ty chúng tôi?",
            "closing": "Cảm ơn bạn đã dành thời gian cho buổi phỏng vấn thử hôm nay. Chúc bạn may mắn!",
        }
        fallbacks_en = {
            "greeting": f"Hello! I'm Career Buddy's interview assistant. Today we'll have a mock interview for the {self.jd_title} position. Are you ready?",
            "self_intro": "Could you briefly introduce yourself?",
            "experience": "Can you tell me about your most notable project or experience?",
            "skills": "Your CV mentions some technical skills. Could you share more about the skill you're most confident in?",
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
