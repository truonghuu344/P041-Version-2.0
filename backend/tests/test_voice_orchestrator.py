"""
Regression tests cho backend/src/services/voice/voice_orchestrator.py

Bối cảnh: 3 hành vi vừa được sửa trong voice_orchestrator.py:
1. `_extract_llm_response` — khi parsing thất bại VÀ raw content trông như
   JSON/markdown bị cắt cụt (chứa "```", "{" hoặc chuỗi '"message"'), phải trả
   về message rỗng thay vì để lộ rác cho người dùng qua TTS/UI.
2. `_fallback_response` — phase advance PHẢI xảy ra TRƯỚC khi chọn câu hỏi
   fallback (nếu phase hiện tại đã từng được hỏi qua fallback), để field
   "phase" trả về luôn khớp với câu hỏi thực sự nằm trong "ai_message".
3. `get_qa_pairs()` — cặp câu hỏi đầu tiên (lời chào greeting) phải bị loại
   khỏi danh sách QA pairs dùng để chấm STAR.

Dữ liệu dùng trong test là synthetic — không phải CV/JD thật.
"""

from __future__ import annotations

from src.services.interview_agenda import COMPETENCY_TO_PHASE
from src.services.voice.voice_orchestrator import (
    _TURN_CAP,
    MAX_TURNS_PER_PHASE,
    NON_SCORED_PHASES,
    PHASES,
    VoiceInterviewOrchestrator,
    _extract_llm_response,
)


def _make_orchestrator(language: str = "vi") -> VoiceInterviewOrchestrator:
    """Tạo orchestrator với dữ liệu CV/JD synthetic, không gọi LLM thật."""
    return VoiceInterviewOrchestrator(
        cv_text="Sinh vien nam 4 nganh CNTT, ky nang Python, FastAPI, PostgreSQL.",
        jd_title="Backend Developer Intern",
        jd_requirements="Yeu cau: Python, FastAPI, REST API, Git.",
        language=language,
    )


# ─── (a) _extract_llm_response: không để lộ rác khi parsing thất bại ────────


class TestExtractLLMResponseGarbageHandling:
    def test_truncated_markdown_fence_returns_empty_message(self):
        """Content bị cắt cụt ngay giữa markdown fence -> message rỗng, không leak raw text."""
        content = "Here is the JSON requested: ```json"
        fallback_phase = "self_intro"

        message, phase, done = _extract_llm_response(content, fallback_phase)

        assert message == "", (
            f"Expected empty message for truncated garbage, got: {message!r}"
        )
        assert "```" not in message
        assert phase == fallback_phase
        assert done is False

    def test_content_with_unparseable_message_key_returns_empty(self):
        """Content chứa '"message"' nhưng không parse được -> vẫn phải trả rỗng, không leak."""
        content = 'partial output {"message": incomplete'
        fallback_phase = "experience"

        message, phase, done = _extract_llm_response(content, fallback_phase)

        # match phía regex '"message"\s*:\s*"...' yêu cầu value bọc trong dấu
        # ngoặc kép hợp lệ — content này không match nên rơi vào nhánh
        # last-resort. Vì có brace "{" và chuỗi '"message"' -> phải trả rỗng.
        assert message == ""
        assert "{" not in message
        assert phase == fallback_phase
        assert done is False

    def test_plain_text_without_json_markers_still_passes_through(self):
        """Regression guard: plain text KHÔNG chứa markdown/brace/message key vẫn
        được trả nguyên vẹn (hành vi cũ không bị phá vỡ ngoài phạm vi fix)."""
        content = "Xin chao, ban co the gioi thieu ban than khong?"
        fallback_phase = "self_intro"

        message, phase, done = _extract_llm_response(content, fallback_phase)

        assert message == content
        assert phase == fallback_phase
        assert done is False

    def test_valid_fenced_json_still_parses_correctly(self):
        """Regression guard: JSON hợp lệ bọc trong code fence vẫn parse đúng,
        không bị ảnh hưởng bởi fix cho trường hợp garbage."""
        content = '```json\n{"message": "Cau hoi tiep theo?", "phase": "skills_assessment", "done": false}\n```'
        message, phase, done = _extract_llm_response(content, "self_intro")

        assert message == "Cau hoi tiep theo?"
        assert phase == "skills_assessment"
        assert done is False


# ─── (b) _fallback_response: phase luôn khớp với câu hỏi thực sự trả về ─────


class TestFallbackResponsePhaseConsistency:
    def _fallback_lookup(self, orchestrator: VoiceInterviewOrchestrator) -> dict[str, str]:
        """Xây bảng tra phase -> fallback text bằng cách gọi trực tiếp
        _fallback_response trên các bản sao orchestrator độc lập, tránh
        hard-code lại nội dung câu hỏi (vốn thuộc source, có thể đổi)."""
        lookup: dict[str, str] = {}
        for phase in PHASES:
            probe = _make_orchestrator(orchestrator.language)
            probe.current_phase = phase
            result = probe._fallback_response()
            lookup[phase] = result["ai_message"]
        return lookup

    def test_two_consecutive_gemini_failures_keep_phase_and_message_in_sync(self):
        """Gemini fail 2 lần liên tiếp (start() rồi 1 lần fail nữa) -> mỗi lần
        gọi, "phase" trả về phải khớp với câu hỏi thực sự trong "ai_message"."""
        orchestrator = _make_orchestrator()
        lookup = self._fallback_lookup(orchestrator)

        first = orchestrator._fallback_response()
        second = orchestrator._fallback_response()

        # Lần đầu: current_phase ban đầu là "greeting" (chưa từng hỏi qua
        # fallback) -> không advance, message khớp phase "greeting".
        assert first["phase"] == "greeting"
        assert first["ai_message"] == lookup["greeting"]

        # Lần hai: "greeting" đã nằm trong _fallback_asked_phases -> phải
        # advance TRƯỚC khi chọn câu hỏi -> phase = "self_intro", và message
        # phải là câu hỏi của self_intro (không phải câu hỏi cũ gắn nhãn mới).
        assert second["phase"] == "self_intro"
        assert second["ai_message"] == lookup["self_intro"]

        # Bất biến cốt lõi: với MỌI lần gọi, ai_message phải luôn là câu hỏi
        # đúng của phase được trả về -- không bao giờ lệch pha.
        for result in (first, second):
            assert result["ai_message"] == lookup[result["phase"]], (
                "phase trả về không khớp với nội dung câu hỏi thực sự "
                f"trong ai_message: {result}"
            )

    def test_fallback_response_appends_to_conversation_history(self):
        """Mỗi fallback message phải được ghi vào conversation để giữ ngữ cảnh."""
        orchestrator = _make_orchestrator()
        orchestrator._fallback_response()
        orchestrator._fallback_response()

        assistant_messages = [
            m["content"] for m in orchestrator.conversation if m["role"] == "assistant"
        ]
        assert len(assistant_messages) == 2


# ─── (c) get_qa_pairs(): loại bỏ cặp câu hỏi chào mở đầu ────────────────────


class TestGetQaPairsSkipsGreeting:
    def test_greeting_pair_excluded_but_real_qa_pairs_kept(self):
        orchestrator = _make_orchestrator()
        orchestrator.conversation = [
            {
                "role": "assistant",
                "content": "Chao ban, toi la tro ly phong van Career Buddy. Ban san sang chua?",
            },
            {"role": "user", "content": "Da, toi san sang roi."},
            {
                "role": "assistant",
                "content": "Ban co the gioi thieu so qua ve ban than khong?",
            },
            {"role": "user", "content": "Toi ten A, sinh vien nam 4 nganh CNTT."},
            {
                "role": "assistant",
                "content": "Ban tung lam du an noi bat nao chua?",
            },
            {"role": "user", "content": "Toi lam mot du an quan ly sinh vien bang FastAPI."},
        ]

        pairs = orchestrator.get_qa_pairs()

        assert len(pairs) == 2, f"Expected 2 real QA pairs (greeting excluded), got {len(pairs)}"

        questions = [p["question"] for p in pairs]
        assert "Chao ban, toi la tro ly phong van Career Buddy. Ban san sang chua?" not in questions

        assert questions == [
            "Ban co the gioi thieu so qua ve ban than khong?",
            "Ban tung lam du an noi bat nao chua?",
        ]
        assert pairs[0]["answer"] == "Toi ten A, sinh vien nam 4 nganh CNTT."
        assert pairs[1]["answer"] == "Toi lam mot du an quan ly sinh vien bang FastAPI."

    def test_greeting_with_no_answer_still_excluded(self):
        """Ngay ca khi user khong tra loi loi chao (vd disconnect ngay), cap
        greeting van khong duoc dua vao qa_pairs (theo dinh nghia no chua co
        answer nen von da bi loai bo boi dieu kien answer_parts)."""
        orchestrator = _make_orchestrator()
        orchestrator.conversation = [
            {"role": "assistant", "content": "Chao ban, ban san sang chua?"},
        ]

        pairs = orchestrator.get_qa_pairs()
        assert pairs == []

    def test_empty_conversation_returns_empty_list(self):
        orchestrator = _make_orchestrator()
        orchestrator.conversation = []
        assert orchestrator.get_qa_pairs() == []


# ─── (d) 8 phase: ngân sách lượt, phase không chấm điểm, agenda hint ────────


class TestEightPhaseFlow:
    """Bất biến của bộ 8 phase (greeting → ... → closing)."""

    def test_every_phase_has_a_turn_budget(self):
        assert sorted(MAX_TURNS_PER_PHASE) == sorted(PHASES)

    def test_turn_cap_covers_full_phase_budget(self):
        """Trần lượt PHẢI lớn hơn tổng ngân sách các phase.

        Trước GĐ3 trần là hằng số 15 trong khi tổng ngân sách đã là 18, nên
        _force_closing() cắt phiên trước khi tới các phase cuối. Đặt cứng lại
        một con số nhỏ hơn tổng sẽ tái tạo đúng lỗi đó mà không test nào kêu
        nếu thiếu bất biến này.
        """
        assert _TURN_CAP > sum(MAX_TURNS_PER_PHASE.values())

    def test_greeting_budget_stays_two(self):
        """Bản vá off-by-one: start() đã tiêu sẵn 1 đơn vị ngân sách greeting."""
        assert MAX_TURNS_PER_PHASE["greeting"] == 2

    def test_every_phase_has_fallback_text_in_both_languages(self):
        for language in ("vi", "en"):
            orchestrator = _make_orchestrator(language)
            for phase in PHASES:
                orchestrator.current_phase = phase
                orchestrator._fallback_asked_phases = set()
                orchestrator.conversation = []
                result = orchestrator._fallback_response()
                assert result["ai_message"].strip(), f"{language}/{phase} thiếu câu fallback"

    def test_agenda_competency_mapping_points_at_real_phases(self):
        """Ánh xạ competency→phase là điểm nối duy nhất giữa agenda và voice."""
        assert set(COMPETENCY_TO_PHASE.values()) <= set(PHASES)


class TestNonScoredPhasesExcludedFromStar:
    def test_candidate_qa_and_admin_logistics_are_not_scored(self):
        """candidate_qa là lượt AI trả lời, admin_logistics là thông tin hành
        chính — chấm STAR hai phần đó sẽ kéo điểm xuống bằng thứ không đo năng lực."""
        orchestrator = _make_orchestrator()
        orchestrator.conversation = [
            {"role": "assistant", "content": "Chao ban", "phase": "greeting"},
            {"role": "user", "content": "San sang"},
            {"role": "assistant", "content": "Gioi thieu ban than?", "phase": "self_intro"},
            {"role": "user", "content": "Toi la A"},
            {"role": "assistant", "content": "Ban muon hoi gi khong?", "phase": "candidate_qa"},
            {"role": "user", "content": "Luong bao nhieu?"},
            {"role": "assistant", "content": "Ky vong luong cua ban?", "phase": "admin_logistics"},
            {"role": "user", "content": "20 trieu"},
            {"role": "assistant", "content": "Ke ve du an Alpha?", "phase": "experience_deepdive"},
            {"role": "user", "content": "Toi toi uu query"},
        ]
        questions = [pair["question"] for pair in orchestrator.get_qa_pairs()]
        assert questions == ["Gioi thieu ban than?", "Ke ve du an Alpha?"]

    def test_non_scored_set_matches_phase_names(self):
        assert NON_SCORED_PHASES <= set(PHASES)

    def test_messages_without_phase_key_are_still_scored(self):
        """Phiên nối lại từ DB dựng message không có khoá "phase" — phải giữ
        nguyên hành vi cũ là chấm được, không âm thầm bỏ qua."""
        orchestrator = _make_orchestrator()
        orchestrator.conversation = [
            {"role": "assistant", "content": "Loi chao"},
            {"role": "user", "content": "San sang"},
            {"role": "assistant", "content": "Cau hoi that su?"},
            {"role": "user", "content": "Cau tra loi"},
        ]
        pairs = orchestrator.get_qa_pairs()
        assert [p["question"] for p in pairs] == ["Cau hoi that su?"]


class TestAgendaHintInPhasePrompt:
    _AGENDA = [
        {"id": "A-001", "question_vi": "Cau self intro tu agenda", "phase": "self_intro", "is_enabled": True},
        {"id": "A-002", "question_vi": "Cau da bi tat", "phase": "self_intro", "is_enabled": False},
        {"id": "A-003", "question_vi": "Cau kinh nghiem", "phase": "experience_deepdive", "is_enabled": True},
    ]

    def _with_agenda(self) -> VoiceInterviewOrchestrator:
        return VoiceInterviewOrchestrator(
            cv_text="CV synthetic",
            jd_title="Backend Developer Intern",
            jd_requirements="Python, FastAPI",
            agenda_questions=self._AGENDA,
        )

    def test_hint_contains_agenda_question_of_current_phase(self):
        orchestrator = self._with_agenda()
        orchestrator.current_phase = "self_intro"
        assert "Cau self intro tu agenda" in orchestrator._build_phase_hint()

    def test_disabled_question_is_not_offered(self):
        orchestrator = self._with_agenda()
        orchestrator.current_phase = "self_intro"
        assert "Cau da bi tat" not in orchestrator._build_phase_hint()

    def test_other_phase_questions_are_not_leaked(self):
        orchestrator = self._with_agenda()
        orchestrator.current_phase = "self_intro"
        assert "Cau kinh nghiem" not in orchestrator._build_phase_hint()

    def test_without_agenda_hint_is_unchanged(self):
        """Không có agenda thì phiên voice vẫn chạy như trước, không thêm gì."""
        orchestrator = _make_orchestrator()
        orchestrator.current_phase = "self_intro"
        assert orchestrator._agenda_hint() == ""


class TestE2EHarnessStaysInSync:
    """Harness E2E (scripts/e2e_voice_interview.py) giữ một bản sao PHASES riêng
    vì nó chạy standalone, không import backend. Bản sao lệch thì mọi vòng chạy
    E2E sau đó báo FAIL giả — đã xảy ra một lần ở round 20 (17/22 lượt bị báo
    sai chỉ vì harness còn tên phase cũ)."""

    def test_e2e_harness_phase_list_is_in_sync(self):
        import ast
        from pathlib import Path

        harness = Path(__file__).resolve().parents[2] / "scripts" / "e2e_voice_interview.py"
        if not harness.exists():
            import pytest

            pytest.skip("Không tìm thấy harness E2E")

        tree = ast.parse(harness.read_text(encoding="utf-8"))
        harness_phases = None
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "PHASES" for t in node.targets
            ):
                harness_phases = ast.literal_eval(node.value)
                break

        assert harness_phases is not None, "Không đọc được PHASES trong harness"
        assert harness_phases == PHASES, (
            "PHASES trong scripts/e2e_voice_interview.py lệch với voice_orchestrator.py"
        )
