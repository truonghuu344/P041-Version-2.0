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
    "experience_deepdive",
    "skills_assessment",
    # Gộp position_knowledge + company_knowledge cũ: hai câu "bạn biết gì về vị
    # trí này" và "bạn hiểu gì về công ty" quá gần nhau, tách ra làm buổi phỏng
    # vấn dài mà không thêm tín hiệu đánh giá.
    "role_alignment",
    # Đảo vai: ứng viên hỏi, AI trả lời trong phạm vi JD.
    "candidate_qa",
    "admin_logistics",
    "closing",
]

# Các phase KHÔNG đưa vào chấm STAR: candidate_qa là lượt AI trả lời chứ không
# phải ứng viên trả lời, admin_logistics chỉ là thông tin hành chính.
NON_SCORED_PHASES: frozenset[str] = frozenset(("greeting", "candidate_qa", "admin_logistics"))

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
3. **experience_deepdive**: Đào sâu kinh nghiệm và dự án có trong CV. Hỏi 2-3 câu:
   - Nếu CV có kinh nghiệm khớp JD → hỏi về kinh nghiệm đó trước.
   - Follow-up: vai trò cụ thể, CON SỐ/kết quả đạt được, thách thức đã gặp.
   - "Bạn đã đóng vai trò gì trong dự án đó? Kết quả cụ thể ra sao?"
4. **skills_assessment**: Khảo sát kỹ năng chuyên môn VÀ đưa một bài toán tình huống. Hỏi 2-3 câu:
   - **Kỹ năng CV khớp JD**: chọn 1 kỹ năng có ở cả hai → hỏi sâu cách đã áp dụng.
   - **Kỹ năng JD mà CV không có**: hỏi ứng viên đã biết chưa. Nếu trả lời "chưa biết nhưng sẽ tìm hiểu" → ghi nhận tích cực rồi chuyển tiếp.
   - Một tình huống giả định sát công việc để xem cách xử lý, không hỏi lý thuyết suông.
5. **role_alignment**: Đánh giá mức độ hiểu việc và hiểu công ty trong cùng một mạch. Hỏi 1-2 câu, ví dụ "Theo bạn vị trí này đòi hỏi những gì, và điều gì khiến bạn phù hợp?".
6. **candidate_qa**: ĐẢO VAI — mời ứng viên đặt câu hỏi cho bạn: "Bạn có muốn hỏi gì về vị trí này không?".
   - Trả lời NGẮN GỌN và CHỈ dựa trên nội dung JD ở trên.
   - Câu hỏi vượt ngoài JD (lương thưởng chi tiết, văn hoá công ty, quy mô đội ngũ...) → nói thẳng là bạn chưa có thông tin đó. TUYỆT ĐỐI KHÔNG bịa thông tin về công ty.
   - Ứng viên nói không có gì để hỏi → cảm ơn và chuyển tiếp.
7. **admin_logistics**: Hỏi thông tin hành chính: kỳ vọng mức lương, thời gian có thể nhận việc. Hỏi tự nhiên, không ép nếu ứng viên không muốn trả lời.
8. **closing**: Cảm ơn ứng viên đã dành thời gian. Nhận xét ngắn gọn. Nêu bước tiếp theo. Chúc may mắn. PHẢI set done=true.

## Xử lý tình huống ngoài kịch bản — RẤT QUAN TRỌNG:
Đây là hội thoại bằng giọng nói nên chuyện nghe nhầm, hỏi lại, lạc đề xảy ra thường xuyên. Bốn tình huống dưới đây PHẢI xử lý đúng, và trong CẢ BỐN đều GIỮ NGUYÊN phase hiện tại:

**(1) Ứng viên hỏi lại vì không nghe rõ:**
  - "Bạn có nghe tôi nói không?" → "Có, tôi nghe rõ rồi! Quay lại câu hỏi nhé — [Nhắc lại câu hỏi hiện tại]"
  - "Bạn nói lại được không?" → "Tất nhiên! [Nhắc lại câu hỏi hiện tại]"
  - "Xin chào", "Test thử" → Trả lời ngắn rồi nhắc lại câu hỏi.

**(2) Ứng viên nhờ giải thích một khái niệm/yêu cầu trong JD:**
  - Giải thích NGẮN GỌN (2-3 câu), CHỈ dựa trên nội dung JD ở trên. Không suy diễn, không thêm thông tin ngoài JD.
  - Nếu JD không nói gì về điều đó → nói thẳng "Phần này JD không nêu chi tiết", đừng bịa.
  - Giải thích xong thì quay lại đúng câu hỏi đang dở.

**(3) Ứng viên trả lời ngoài phạm vi câu hỏi:**
  - NÓI LỜI CẢM THÔNG trước, đừng cắt ngang cộc lốc: "Cảm ơn bạn đã chia sẻ, phần đó cũng thú vị đấy." rồi mới nhẹ nhàng kéo về: "Quay lại một chút — [Nhắc lại câu hỏi hiện tại]".
  - TUYỆT ĐỐI KHÔNG chuyển sang câu hỏi mới khi ứng viên chưa thực sự trả lời.

**(4) BẠN không nghe rõ hoặc không hiểu ứng viên** (transcript rời rạc, quá ngắn, không thành câu):
  - NÓI LỜI CẢM THÔNG và nhận phần về mình: "Xin lỗi bạn, có thể đường truyền hơi nhiễu nên tôi chưa nghe rõ ý này."
  - Rồi mời nói lại: "Bạn nói lại giúp tôi được không?"
  - TUYỆT ĐỐI KHÔNG đoán bừa ý ứng viên rồi chấm điểm, và KHÔNG chuyển phase.
- TUYỆT ĐỐI KHÔNG chuyển sang câu hỏi mới / phase mới khi ứng viên chưa thực sự trả lời.
- Giữ nguyên phase hiện tại cho đến khi ứng viên trả lời đúng nội dung phỏng vấn.
- Đây là lỗi nghiêm trọng nhất: bỏ qua câu hỏi lại của ứng viên và chuyển sang phase khác.

## Đồng bộ trường "phase" với nội dung "message" — BẮT BUỘC, KHÔNG NGOẠI LỆ:
- Trường "phase" trong JSON trả về PHẢI luôn khớp với giai đoạn của câu hỏi THỰC SỰ xuất hiện trong "message". Đây là ràng buộc tự-nhất-quán (self-consistency), áp dụng độc lập với số lượt đã trôi qua.
- Nếu nội dung "message" là nhắc lại / giữ nguyên câu hỏi của phase hiện tại (kể cả khi bạn đang hỏi lại "đã sẵn sàng chưa" ở phase "greeting" sau khi ứng viên hỏi ngược lại) → "phase" PHẢI giữ NGUYÊN bằng phase hiện tại. TUYỆT ĐỐI không tự tăng "phase" lên giai đoạn kế tiếp chỉ vì đã qua nhiều lượt hội thoại.
- CHỈ được đặt "phase" sang giai đoạn kế tiếp trong đúng lượt mà "message" chứa câu hỏi MỚI của giai đoạn kế tiếp đó, tức là NGAY SAU KHI ứng viên vừa trả lời đúng, thực chất vào câu hỏi của phase hiện tại.
- Ví dụ cụ thể: đang ở phase "greeting" với câu hỏi "Bạn đã sẵn sàng chưa?". Ứng viên hỏi lại "Câu hỏi này là gì vậy?". Bạn nhắc lại đúng câu hỏi sẵn sàng đó trong "message" → "phase" PHẢI vẫn là "greeting". TUYỆT ĐỐI KHÔNG được ghi "self_intro" hay bất kỳ phase nào khác trong trường hợp này, dù đây đã là lượt thứ 2, 3, hay bất kỳ ở phase "greeting".

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
3. **experience_deepdive**: Dig into the experience and projects listed in the CV. Ask 2-3 questions:
   - If CV matches JD → prioritize matching experience.
   - Follow-up: specific role, NUMBERS/results achieved, challenges faced.
   - "What was your role in that project? What were the concrete results?"
4. **skills_assessment**: Probe technical skills AND pose a situational problem. Ask 2-3 questions:
   - **CV skills matching JD**: pick 1 skill in both → ask how they applied it.
   - **JD skills missing from CV**: ask whether they know it. "I don't know it yet but I'll learn" → acknowledge positively, then move on.
   - One realistic hypothetical situation to see how they reason, not textbook theory.
5. **role_alignment**: Assess understanding of the role AND the company in one thread. Ask 1-2 questions, e.g. "What do you think this role demands, and what makes you a fit?".
6. **candidate_qa**: SWITCH ROLES — invite the candidate to ask you questions: "Is there anything you'd like to ask about this role?".
   - Answer BRIEFLY and ONLY from the JD content above.
   - Questions beyond the JD (detailed compensation, company culture, team size...) → say plainly that you don't have that information. NEVER invent facts about the company.
   - If they have nothing to ask → thank them and move on.
7. **admin_logistics**: Ask administrative details: salary expectation, earliest start date. Keep it natural; do not press if they prefer not to answer.
8. **closing**: Thank the candidate for their time. Brief feedback. State next steps. Good luck. MUST set done=true.

## Handling situations outside the script — VERY IMPORTANT:
This is a spoken conversation, so mishearing, asking again and drifting off-topic happen often. All four situations below MUST be handled correctly, and in ALL FOUR you KEEP the current phase:

**(1) The candidate asks you to repeat because they didn't hear:**
  - "Can you hear me?" → "Yes, I can hear you! Let me repeat — [Repeat the current question]"
  - "Could you say that again?" → "Of course! [Repeat the current question]"
  - "Hello", "Testing" → Respond briefly then repeat the question.

**(2) The candidate asks you to explain a concept or requirement from the JD:**
  - Explain BRIEFLY (2-3 sentences), ONLY from the JD content above. No speculation, nothing beyond the JD.
  - If the JD says nothing about it → say plainly "The JD doesn't spell that out", do not invent.
  - After explaining, return to the pending question.

**(3) The candidate answers outside the scope of the question:**
  - Show EMPATHY first, don't cut them off bluntly: "Thanks for sharing, that's interesting." then gently steer back: "Coming back to my question — [Repeat the current question]".
  - ABSOLUTELY DO NOT advance to a new question when they haven't actually answered.

**(4) YOU cannot hear or understand the candidate** (fragmented, very short or incoherent transcript):
  - Show EMPATHY and take the blame yourself: "Sorry, the connection may be a bit noisy — I didn't catch that."
  - Then invite them to repeat: "Could you say that again for me?"
  - NEVER guess what they meant and score it, and DO NOT change phase.
- ABSOLUTELY DO NOT advance to a new question / new phase when the candidate hasn't actually answered.
- Keep the current phase until the candidate gives a proper interview answer.
- This is the most critical error to avoid: skipping the candidate's request and moving to a different phase.

## Keeping "phase" consistent with "message" — MANDATORY, NO EXCEPTIONS:
- The "phase" field in your JSON response MUST always match the phase of the question that is ACTUALLY contained in "message". This is a self-consistency requirement, independent of how many turns have elapsed.
- If "message" re-asks or holds on the current phase's question (including re-asking readiness in the "greeting" phase after the candidate went off-topic) → "phase" MUST stay the SAME as the current phase. NEVER auto-advance "phase" just because several turns have passed.
- Only set "phase" to the next stage in the SAME turn where "message" actually contains that next stage's new question — i.e., immediately after the candidate has just given a real, on-topic answer to the current phase's question.
- Concrete example: you are in phase "greeting" asking "Are you ready?". The candidate replies "What question is this?". You re-ask the same readiness question in "message" → "phase" MUST still be "greeting". NEVER output "self_intro" or any other phase in this case, no matter whether this is the 2nd, 3rd, or any later turn in the "greeting" phase.

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
    # Parsing thất bại và nội dung thô trông như JSON/markdown bị cắt cụt
    # (chứa "```", "{" hoặc chuỗi "message") — KHÔNG BAO GIỜ để lộ rác này
    # cho người dùng qua TTS/UI, trả về rỗng để trigger fallback response.
    if "```" in content or "{" in content or '"message"' in content:
        return "", fallback_phase, False
    return content, fallback_phase, False


MAX_TURNS_PER_PHASE = {
    # "greeting" = 2, KHÔNG phải 1: lượt gọi start() (chào mở đầu, chưa có
    # input từ ứng viên) đã tiêu tốn sẵn 1 đơn vị ngân sách này. Nếu để 1,
    # thì NGAY lượt kế tiếp mà model tiếp tục hợp lệ trả về phase="greeting"
    # (VD: ứng viên hỏi ngược lại, model nhắc lại đúng câu hỏi sẵn sàng) sẽ
    # bị code này ép tăng phase sang "self_intro" dù "message" vẫn đang nói
    # nội dung greeting — gây lệch phase/message (bug xác nhận qua
    # round_17_disrupt.json, turn 1). Đặt 2 để cho phép một lượt nhắc lại/
    # xử lý lạc đề ở greeting trước khi bị ép chuyển phase.
    "greeting": 2,
    "self_intro": 2,
    "experience_deepdive": 4,
    "skills_assessment": 3,
    "role_alignment": 3,
    "candidate_qa": 2,
    "admin_logistics": 2,
    "closing": 1,
}

# Trần cứng cho cả phiên. PHẢI tính từ tổng ngân sách các phase chứ không đặt
# số cố định: trước đây trần là 15 trong khi tổng ngân sách đã là 18, nên phiên
# bị _force_closing() cắt ngang trước khi đi hết các phase cuối. Cộng thêm 3 để
# ứng viên còn dư lượt cho vài lần lạc đề.
_TURN_CAP = sum(MAX_TURNS_PER_PHASE.values()) + 3


class VoiceInterviewOrchestrator:
    """Conversational interview engine using Gemini Flash for fast responses."""

    def __init__(
        self,
        cv_text: str,
        jd_title: str,
        jd_requirements: str,
        language: str = "vi",
        agenda_questions: list[dict[str, Any]] | None = None,
    ) -> None:
        self.cv_text = cv_text
        self.jd_title = jd_title
        self.jd_requirements = jd_requirements
        self.language = language
        # Agenda (nếu ứng viên đã tạo ở trang phỏng vấn) được chèn vào phase
        # hint từng lượt để LLM bám câu hỏi đã duyệt thay vì tự nghĩ. Không bắt
        # buộc: phiên voice vẫn chạy bình thường khi chưa có agenda.
        self.agenda_questions = list(agenda_questions or [])
        self.conversation: list[dict[str, str]] = []
        self.current_phase: str = "greeting"
        self.is_done: bool = False
        self.turn_count: int = 0
        self._phase_turn_count: int = 0
        # Các phase đã từng được hỏi qua fallback text (dùng để quyết định
        # thứ tự advance-trước-hay-sau trong _fallback_response).
        self._fallback_asked_phases: set[str] = set()
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
        if self.turn_count >= _TURN_CAP:
            return await self._force_closing()
        return await self._call_llm()

    async def resume(self, qa_pairs: list[dict[str, str]]) -> dict[str, Any]:
        """Nạp lại một buổi phỏng vấn đang dở rồi sinh lượt nói kế tiếp.

        Hội thoại của orchestrator chỉ nằm trong bộ nhớ, nên khi ứng viên nối
        lại WebSocket nó phải được dựng lại từ các cặp hỏi–đáp đã lưu trong DB.
        Không phát lại lời chào: buổi phỏng vấn đã bắt đầu từ trước.
        """
        if not qa_pairs:
            return await self.start()

        intro = (
            "(Đây là buổi phỏng vấn đang dở của ứng viên. Dưới đây là những câu "
            "bạn đã hỏi và câu trả lời đã nhận.)"
            if self.language == "vi"
            else "(This is the candidate's interview in progress. Below are the "
            "questions you already asked and the answers you received.)"
        )
        self.conversation = [{"role": "user", "content": intro}]
        for pair in qa_pairs:
            self.conversation.append({"role": "assistant", "content": pair["question"]})
            self.conversation.append({"role": "user", "content": pair["answer"]})

        # turn_count đếm số lượt next_turn đã chạy. Lượt đầu tiên trả lời lời
        # chào nên không sinh hàng trong DB — cộng lại ở đây để trần 15 lượt và
        # điều kiện bỏ qua lời chào bên ws_interview vẫn đúng sau khi nối lại.
        self.turn_count = len(qa_pairs) + 1
        self._phase_turn_count = 0
        self.current_phase = self._phase_after(len(qa_pairs))

        self.conversation.append({
            "role": "user",
            "content": (
                "(Ứng viên vừa kết nối lại sau khi buổi phỏng vấn bị gián đoạn. "
                "Chào lại thật ngắn một câu, KHÔNG giới thiệu lại bản thân, "
                "KHÔNG lặp lại câu đã hỏi, rồi hỏi tiếp câu kế tiếp.)"
                if self.language == "vi"
                else "(The candidate just reconnected after the interview was "
                "interrupted. Greet them back in one short sentence, do NOT "
                "reintroduce yourself, do NOT repeat a question you already "
                "asked, then continue with the next question.)"
            ),
        })
        return await self._call_llm()

    def _phase_after(self, answered_count: int) -> str:
        """Đoán giai đoạn phỏng vấn sau `answered_count` câu đã trả lời.

        Giai đoạn không được lưu xuống DB nên không khôi phục chính xác được.
        Đây chỉ là giá trị khởi tạo: LLM tự báo lại phase trong phản hồi kế tiếp
        dựa trên toàn bộ hội thoại vừa nạp. Chặn trên dừng lại trước "closing"
        để việc nối lại không làm kết thúc phiên ngay lập tức.
        """
        index = min(answered_count + 1, len(PHASES) - 2)
        return PHASES[index]

    def get_qa_pairs(self) -> list[dict[str, str]]:
        """Extract question-answer pairs from conversation history for STAR scoring."""
        pairs: list[dict[str, str]] = []
        messages = self.conversation
        is_first_assistant_message = True
        i = 0
        while i < len(messages):
            if messages[i]["role"] == "assistant":
                question = messages[i]["content"]
                # Bỏ qua lời chào mở đầu (greeting) — không có nội dung để
                # chấm STAR, không nên đưa vào cặp hỏi-đáp.
                #
                # Ngoài ra loại luôn các phase trong NON_SCORED_PHASES:
                # candidate_qa là lượt AI trả lời chứ không phải ứng viên trả
                # lời, admin_logistics chỉ là thông tin hành chính. Chấm STAR
                # hai phần đó sẽ kéo điểm xuống bằng thứ không đo năng lực.
                # Message cũ (phiên nối lại từ DB) không có khoá "phase" —
                # coi như chấm được, giữ nguyên hành vi trước đây.
                is_greeting = is_first_assistant_message
                is_first_assistant_message = False
                skip_phase = messages[i].get("phase") in NON_SCORED_PHASES
                answer_parts: list[str] = []
                j = i + 1
                while j < len(messages) and messages[j]["role"] == "user":
                    answer_parts.append(messages[j]["content"])
                    j += 1
                if answer_parts and not is_greeting and not skip_phase:
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

    def _agenda_hint(self) -> str:
        """Các câu agenda thuộc phase hiện tại, dạng gợi ý cho LLM bám theo."""
        if not self.agenda_questions:
            return ""
        prefer_en = self.language != "vi"
        picked: list[str] = []
        for item in self.agenda_questions:
            if item.get("phase") != self.current_phase or not item.get("is_enabled", True):
                continue
            text = str(item.get("question_en") or "") if prefer_en else ""
            if not text.strip():
                text = str(item.get("question_vi") or "")
            if text.strip():
                picked.append(text.strip())
        if not picked:
            return ""
        joined = " | ".join(picked[:3])
        if self.language == "vi":
            return (
                f" Bộ câu hỏi đã duyệt cho giai đoạn này: {joined}. "
                f"Hãy bám sát ý các câu đó, diễn đạt lại cho tự nhiên khi nói; "
                f"follow-up thì vẫn tự do đặt theo câu trả lời thực tế."
            )
        return (
            f" Approved questions for this phase: {joined}. "
            f"Stick to their intent, rephrase naturally for speech; "
            f"you remain free to improvise follow-ups from the actual answer."
        )

    def _build_phase_hint(self) -> str:
        agenda_part = self._agenda_hint()
        if self.language == "vi":
            return (
                f'[Giai đoạn hiện tại: "{self.current_phase}". '
                f"Hãy set phase đúng trong JSON. "
                f"CHỈ chuyển sang phase tiếp theo khi ứng viên ĐÃ TRẢ LỜI ĐÚNG nội dung câu hỏi. "
                f"Nếu ứng viên hỏi lại, nói không hiểu, hoặc nói ngoài lề → GIỮ NGUYÊN phase hiện tại và nhắc lại câu hỏi."f"{agenda_part}]"
            )
        return (
            f'[Current phase: "{self.current_phase}". '
            f"Set the phase field correctly in your JSON response. "
            f"ONLY advance to the next phase when the candidate HAS ACTUALLY ANSWERED the question. "
            f"If they ask to repeat, say they don't understand, or go off-topic → KEEP the current phase and re-ask."f"{agenda_part}]"
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
        self.conversation.append({"role": "assistant", "content": ai_message, "phase": phase})
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
            # Gemini API không có message role "system": mọi chỉ dẫn hệ thống phải
            # đi qua `system_instruction`. Phải GOM tất cả message role="system" vào
            # đó, không được chỉ lọc bỏ: ngoài system prompt tĩnh, `_call_llm` còn
            # append phase hint động (`_build_phase_hint`) của từng lượt. Trước đây
            # hint này bị drop im lặng nên model không bao giờ biết `current_phase`
            # lẫn quy tắc "chỉ advance phase khi ứng viên đã thực sự trả lời".
            system_parts: list[str] = []
            gemini_contents = []
            for msg in messages:
                if msg["role"] == "system":
                    instruction = msg["content"].strip()
                    if instruction:
                        system_parts.append(instruction)
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
                        system_instruction="\n\n".join(system_parts) or self._system_prompt,
                        temperature=0.7,
                        max_output_tokens=800,
                        response_mime_type="application/json",
                        # Gemini 3.x (cả model chính lẫn fallback) dùng
                        # `thinking_level` thay cho `thinking_budget` (đã
                        # deprecated). Dùng thinking_budget=0 với model 3.x
                        # gây 400 INVALID_ARGUMENT trên gemini-3.5-flash-lite
                        # (xác nhận qua test trực tiếp). "minimal" giữ đúng ý
                        # định ban đầu: giảm tối đa token suy luận để không ăn
                        # vào max_output_tokens, tránh JSON bị cắt cụt.
                        thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                    ),
                ),
                timeout=30,
            )
            if not response.text:
                finish_reason = None
                if response.candidates:
                    finish_reason = response.candidates[0].finish_reason
                logger.warning(
                    "Gemini model %s returned empty text (finish_reason=%s, prompt_feedback=%s)",
                    model,
                    finish_reason,
                    getattr(response, "prompt_feedback", None),
                )
                return None
            return response.text
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
        self.conversation.append({"role": "assistant", "content": closing, "phase": "closing"})
        return {"ai_message": closing, "phase": "closing", "is_complete": True}

    def _fallback_response(self) -> dict[str, Any]:
        fallbacks_vi = {
            "greeting": f"Chào bạn. Tôi là trợ lý phỏng vấn của Career Buddy. Hôm nay chúng ta sẽ có một buổi phỏng vấn thử cho vị trí {self.jd_title}. Bạn đã sẵn sàng chưa?",
            "self_intro": "Bạn có thể giới thiệu sơ qua một chút về bản thân không?",
            "experience_deepdive": "Bạn có thể kể về một dự án hoặc kinh nghiệm nổi bật nhất của mình không?",
            "skills_assessment": "Trong CV bạn có đề cập một số kỹ năng kỹ thuật. Bạn có thể chia sẻ thêm về kỹ năng mà bạn tự tin nhất không?",
            "role_alignment": "Theo bạn, vị trí này đòi hỏi những gì và điều gì khiến bạn phù hợp với nó?",
            "candidate_qa": "Bạn có muốn hỏi tôi điều gì về vị trí này không?",
            "admin_logistics": "Bạn có thể chia sẻ kỳ vọng mức lương và thời gian có thể nhận việc không?",
            "closing": "Cảm ơn bạn đã dành thời gian cho buổi phỏng vấn thử hôm nay. Chúc bạn may mắn!",
        }
        fallbacks_en = {
            "greeting": f"Hello! I'm Career Buddy's interview assistant. Today we'll have a mock interview for the {self.jd_title} position. Are you ready?",
            "self_intro": "Could you briefly introduce yourself?",
            "experience_deepdive": "Can you tell me about your most notable project or experience?",
            "skills_assessment": "Your CV mentions some technical skills. Could you share more about the skill you're most confident in?",
            "role_alignment": "What do you think this role demands, and what makes you a good fit for it?",
            "candidate_qa": "Is there anything you'd like to ask me about this role?",
            "admin_logistics": "Could you share your salary expectation and earliest possible start date?",
            "closing": "Thank you for your time in this mock interview. Good luck!",
        }
        fallbacks = fallbacks_vi if self.language == "vi" else fallbacks_en

        # QUAN TRỌNG — thứ tự advance rồi mới chọn câu hỏi:
        # nếu phase hiện tại đã được hỏi qua fallback ở lượt trước (LLM vẫn
        # tiếp tục lỗi), phải CHUYỂN SANG phase kế tiếp TRƯỚC KHI chọn câu
        # hỏi fallback. Nếu chọn câu hỏi trước rồi mới advance, "phase" trả
        # về sẽ không khớp với nội dung câu hỏi thực sự đọc ra (VD: câu hỏi
        # self_intro nhưng lại gắn nhãn "experience").
        phase_already_asked = self.current_phase in self._fallback_asked_phases
        if (
            phase_already_asked
            and self.current_phase in PHASES
            and self.current_phase != "closing"
        ):
            idx = PHASES.index(self.current_phase)
            if idx + 1 < len(PHASES):
                self.current_phase = PHASES[idx + 1]

        msg = fallbacks.get(self.current_phase, fallbacks["closing"])
        done = self.current_phase == "closing"
        self._fallback_asked_phases.add(self.current_phase)

        self.conversation.append({"role": "assistant", "content": msg, "phase": self.current_phase})
        return {"ai_message": msg, "phase": self.current_phase, "is_complete": done}
