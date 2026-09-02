"""Logic thuần cho agenda phỏng vấn sinh từ một cặp (CV, JD).

Module này CỐ Ý không chạm database và không gọi LLM: mọi hàm ở đây là hàm
thuần, nhận vào dữ liệu và trả về dữ liệu, để test được bằng unit test không
cần fixture DB hay API key. Phần I/O (đọc snapshot, gọi Gemini, ghi bảng
`interview_agendas`) nằm ở tầng gọi.

Luồng dự kiến của tầng gọi:

    quotas = compute_quotas(num_questions, competency_focus)
    spec   = build_generation_spec(jd_title, jd_requirements, quotas)
    raw    = <gọi LLM với spec>
    agenda = sanitize_agenda(raw, cv_text=..., jd_text=..., quotas=quotas)

`sanitize_agenda()` là chốt chặn chống ảo giác: câu nào khai `source="cv"` hoặc
`"jd"` mà `evidence` không thực sự xuất hiện trong văn bản gốc thì bị hạ xuống
`"generic"`. Cùng tinh thần với `evidence_quote` trong
`cv_jd_matching.parse_job_description()` và với `guard_questions_node()` trong
`agents/nodes/interview_nodes.py`.

Phần phân bổ hạn ngạch (`compute_quotas`, `BASE_WEIGHTS`, `COMPETENCY_PRIORITY`)
được port gần như nguyên vẹn từ bản chọn-câu-từ-ngân-hàng-tĩnh trước đây; khác
biệt là hạn ngạch giờ dùng để RA ĐỀ cho LLM ("sinh đúng 3 câu technical") thay
vì để LỌC một pool có sẵn.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass, field, replace
from typing import Any

from src.agents.tools.career_tools import TECH_SKILLS, extract_known_terms

DEFAULT_NUM_QUESTIONS = 8

# Số câu tối thiểu/tối đa cho một agenda. Dưới 3 thì không đủ phủ năng lực,
# trên 12 thì buổi phỏng vấn dài quá mức hữu ích cho luyện tập.
MIN_NUM_QUESTIONS = 3
MAX_NUM_QUESTIONS = 12

# Thứ tự ưu tiên khi làm tròn/điều chỉnh hạn ngạch (competency chưa liệt kê ở
# đây coi như ít ưu tiên nhất khi phải cắt bớt).
COMPETENCY_PRIORITY: tuple[str, ...] = (
    "self_intro",
    "technical",
    "behavioral",
    "situational",
    "position",
    "motivation",
    "company",
)

# Trọng số mặc định khi phân bổ num_questions theo largest-remainder
# (Hare-Niemeyer). Không có nhóm "experience" riêng: nhu cầu hỏi về kinh
# nghiệm được phủ bởi technical (+ một phần situational).
BASE_WEIGHTS: dict[str, float] = {
    "self_intro": 1.0,
    "technical": 3.0,
    "situational": 1.0,
    "behavioral": 2.0,
    "position": 1.0,
    "motivation": 0.5,
    "company": 0.5,
}

COMPETENCIES: frozenset[str] = frozenset(BASE_WEIGHTS)
STAR_DIMENSIONS: frozenset[str] = frozenset(("situation", "task", "action", "result"))
SOURCES: frozenset[str] = frozenset(("cv", "jd", "generic"))

# Luôn phải có tối thiểu 1 câu (nếu num_questions đủ lớn để cho phép).
_REQUIRE_AT_LEAST_ONE = ("self_intro",)
# Ít nhất 1 câu trong nhóm "đóng phiên".
_CLOSING_GROUP = ("position", "company")

# Ánh xạ competency -> phase của luồng voice. Bảng này là điểm nối duy nhất
# giữa agenda và `services/voice/voice_orchestrator.py::PHASES`; khi danh sách
# phase đổi (kế hoạch GĐ3 nâng lên 8 phase) thì chỉ sửa ở đây.
COMPETENCY_TO_PHASE: dict[str, str] = {
    "self_intro": "self_intro",
    "technical": "skills_assessment",
    # situational thuộc skills_assessment: phase đó gồm cả khảo sát kỹ năng lẫn
    # bài toán tình huống (xem mô tả phase trong voice_orchestrator).
    "situational": "skills_assessment",
    "behavioral": "experience_deepdive",
    # position/company/motivation gộp vào role_alignment — phase đánh giá mức
    # độ hiểu việc và hiểu công ty trong cùng một mạch.
    "position": "role_alignment",
    "company": "role_alignment",
    "motivation": "role_alignment",
}

_ROLE_FAMILY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("fullstack", ("full-stack", "full stack", "fullstack")),
    ("backend", ("back-end", "back end", "backend")),
    ("frontend", ("front-end", "front end", "frontend")),
    ("data", ("data scientist", "data engineer", "data analyst", "data science", "data")),
    ("qa", ("qa", "tester", "kiểm thử", "quality assurance", "test engineer")),
    ("devops", ("devops", "dev ops", "site reliability", "sre")),
    ("marketing", ("marketing",)),
    ("design", ("ui/ux", "ux/ui", "designer", "design")),
)

# Câu hỏi tối thiểu dùng khi LLM lỗi hoặc trả thiếu. Cố ý KHÔNG import
# `_fallback_questions()` từ agents/nodes/interview_nodes.py: hàm đó trả về
# chuỗi trần không có metadata, và import nó sẽ kéo cả langchain vào một
# module đang cố giữ thuần.
#
# Số mẫu mỗi nhóm PHẢI đủ để lấp hạn ngạch lớn nhất mà compute_quotas() có thể
# yêu cầu, quét trên mọi tổ hợp (num_questions, competency_focus). Nếu thiếu,
# agenda sẽ âm thầm ra ít câu hơn số đã yêu cầu mỗi khi LLM lỗi hoặc hết quota
# — đúng lúc fallback cần đáng tin nhất. Test
# `test_generic_pool_covers_worst_case_quota` giữ bất biến này.
_GENERIC_BY_COMPETENCY: dict[str, tuple[str, ...]] = {
    "self_intro": (
        "Bạn có thể giới thiệu ngắn gọn về bản thân và hành trình nghề nghiệp của mình không?",
        "Điều gì trong hồ sơ của bạn mà bạn muốn nhà tuyển dụng chú ý nhất?",
        "Hãy kể về công việc gần đây nhất của bạn và vai trò cụ thể bạn đảm nhiệm.",
        "Bạn mô tả phong cách làm việc của mình như thế nào?",
    ),
    "technical": (
        "Hãy chọn một kỹ năng kỹ thuật bạn tự tin nhất và giải thích cách bạn đã áp dụng nó trong công việc.",
        "Khi gặp một vấn đề kỹ thuật chưa từng xử lý, quy trình tìm hiểu của bạn ra sao?",
        "Hãy mô tả kiến trúc của một hệ thống bạn từng tham gia xây dựng và lý do chọn kiến trúc đó.",
        "Bạn làm thế nào để đảm bảo chất lượng phần việc mình bàn giao?",
        "Kể về một quyết định kỹ thuật bạn từng đưa ra mà nhìn lại thấy nên làm khác đi.",
        "Bạn xử lý thế nào khi phải làm việc trên phần mã do người khác viết mà không có tài liệu?",
        "Hãy giải thích một khái niệm kỹ thuật bạn thành thạo cho một người không chuyên.",
        "Khi hiệu năng của hệ thống suy giảm, bạn bắt đầu điều tra từ đâu?",
    ),
    "situational": (
        "Hãy kể về một tình huống khó trong công việc: bối cảnh, nhiệm vụ của bạn, hành động bạn thực hiện và kết quả.",
        "Nếu được giao một nhiệm vụ mà yêu cầu chưa rõ ràng, bạn sẽ làm gì trước khi bắt tay vào?",
        "Giả sử bạn phát hiện một lỗi nghiêm trọng ngay trước hạn bàn giao, bạn xử lý thế nào?",
        "Kể về một lần bạn phải học nhanh một công nghệ mới để kịp hoàn thành công việc.",
    ),
    "behavioral": (
        "Khi bất đồng quan điểm với đồng đội, bạn đã xử lý thế nào và rút ra bài học gì?",
        "Bạn ưu tiên công việc ra sao khi nhiều nhiệm vụ cùng đến hạn?",
        "Hãy kể về một lần bạn nhận phản hồi tiêu cực và bạn đã làm gì sau đó.",
        "Kể về một lần bạn phải hoàn thành công việc dưới áp lực thời gian gấp.",
        "Bạn đã bao giờ hỗ trợ một đồng đội đang gặp khó khăn chưa? Cụ thể là thế nào?",
        "Hãy kể về một lần bạn mắc lỗi trong công việc và cách bạn khắc phục hậu quả.",
        "Khi làm việc với người có phong cách rất khác mình, bạn thích ứng ra sao?",
    ),
    "position": (
        "Bạn hiểu vị trí này đòi hỏi những gì, và điều gì khiến bạn phù hợp?",
        "Bạn hình dung 30 ngày đầu tiên ở vị trí này mình sẽ làm những gì?",
        "Theo bạn, thách thức lớn nhất của vai trò này là gì?",
        "Bạn muốn hỏi điều gì về công việc và đội ngũ mà bạn sẽ tham gia?",
    ),
    "motivation": (
        "Điều gì thúc đẩy bạn ứng tuyển vị trí này vào thời điểm hiện tại?",
        "Mục tiêu phát triển nghề nghiệp của bạn trong hai năm tới là gì?",
    ),
    "company": (
        "Bạn đã tìm hiểu được gì về công ty và đội ngũ mà bạn sẽ làm việc cùng?",
        "Điều gì ở công ty này khiến bạn muốn gắn bó lâu dài?",
    ),
}


@dataclass(frozen=True)
class AgendaQuestion:
    """Một câu hỏi trong agenda, kèm metadata đủ để chấm điểm có căn cứ.

    `evidence` là trích dẫn NGUYÊN VĂN từ CV hoặc JD đã sinh ra câu hỏi này;
    `source` cho biết trích từ đâu. Cặp trường này là thứ phân biệt agenda với
    cách sinh câu hỏi cũ (chuỗi trần, không truy vết được).
    """

    id: str
    question_vi: str
    question_en: str = ""
    competency: str = "technical"
    phase: str = "skills"
    linked_skills: list[str] = field(default_factory=list)
    star_dimensions: list[str] = field(default_factory=list)
    follow_up_prompts: list[str] = field(default_factory=list)
    good_answer_signals: list[str] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)
    evidence: str = ""
    source: str = "generic"
    is_enabled: bool = True

    def to_dict(self) -> dict[str, Any]:
        """Dạng lưu vào `interview_agendas.questions_json` và trả về cho API."""
        return {
            "id": self.id,
            "question_vi": self.question_vi,
            "question_en": self.question_en,
            "competency": self.competency,
            "phase": self.phase,
            "linked_skills": list(self.linked_skills),
            "star_dimensions": list(self.star_dimensions),
            "follow_up_prompts": list(self.follow_up_prompts),
            "good_answer_signals": list(self.good_answer_signals),
            "red_flags": list(self.red_flags),
            "evidence": self.evidence,
            "source": self.source,
            "is_enabled": self.is_enabled,
        }


def _fold(value: str) -> str:
    """Chuẩn hoá để so khớp: bỏ dấu, thường hoá, gộp khoảng trắng.

    Dùng cho việc đối chiếu `evidence` với văn bản gốc. Cùng cách tiếp cận với
    `_normalize_text()` trong services/assistant_rag.py — không tái sử dụng
    trực tiếp vì hàm đó là private của module khác.

    Lưu ý riêng cho tiếng Việt: `đ` (U+0111) KHÔNG tách được bằng NFD vì nét
    gạch ngang không phải combining mark, nên bước lọc category "Mn" bên dưới
    không đụng tới nó. Phải thay tay trước, nếu không "đã" và "da" sẽ không
    khớp nhau và evidence gõ không dấu sẽ bị coi là bịa.
    """
    text = (value or "").casefold().replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", text)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


def infer_role_family(jd_title: str) -> str:
    """Suy ra nhóm vai trò từ tiêu đề JD bằng keyword map đơn giản.

    Heuristic, không phải NLP: tiêu đề mơ hồ hoặc đa ngôn ngữ có thể suy sai,
    chấp nhận được vì giá trị này chỉ dùng làm ngữ cảnh cho prompt chứ không
    dùng để lọc dữ liệu.
    """
    title = f" {(jd_title or '').strip().lower()} "
    for role_family, keywords in _ROLE_FAMILY_KEYWORDS:
        if any(keyword in title for keyword in keywords):
            return role_family
    return "general"


def compute_quotas(num_questions: int, competency_focus: str | None = None) -> dict[str, int]:
    """Tính số câu cần sinh cho mỗi competency, tổng bằng `num_questions`.

    Phân bổ theo largest-remainder (Hare-Niemeyer) trên BASE_WEIGHTS. Nếu có
    `competency_focus` hợp lệ thì khuếch đại trọng số nhóm đó và giảm các nhóm
    còn lại. Cuối cùng đảm bảo tối thiểu 1 câu self_intro và tối thiểu 1 câu
    thuộc nhóm đóng phiên (position/company), miễn là `num_questions` cho phép.
    """
    num_questions = max(MIN_NUM_QUESTIONS, min(MAX_NUM_QUESTIONS, int(num_questions)))

    weights = dict(BASE_WEIGHTS)
    if competency_focus and competency_focus in weights:
        for key in weights:
            weights[key] = weights[key] * 2.5 if key == competency_focus else weights[key] * 0.6

    weight_sum = sum(weights.values()) or 1.0
    exact = {k: (w / weight_sum) * num_questions for k, w in weights.items()}
    quotas = {k: int(v) for k, v in exact.items()}  # floor: tổng luôn <= num_questions

    remainder = num_questions - sum(quotas.values())
    if remainder > 0:
        order = sorted(
            weights.keys(),
            key=lambda k: (
                -(exact[k] - quotas[k]),
                COMPETENCY_PRIORITY.index(k) if k in COMPETENCY_PRIORITY else 99,
            ),
        )
        for key in order[:remainder]:
            quotas[key] += 1

    # Ràng buộc tối thiểu, chỉ áp dụng nếu còn đủ "ngân sách" câu hỏi.
    for key in _REQUIRE_AT_LEAST_ONE:
        if quotas.get(key, 0) < 1:
            quotas[key] = quotas.get(key, 0) + 1
    if num_questions >= 2 and sum(quotas.get(k, 0) for k in _CLOSING_GROUP) < 1:
        quotas["position"] = quotas.get("position", 0) + 1

    # Sau khi áp ràng buộc tối thiểu, tổng có thể vượt num_questions; cắt bớt
    # từ nhóm đang nhiều câu nhất, không cắt xuống dưới 1 ở nhóm được bảo vệ.
    protected = set(_REQUIRE_AT_LEAST_ONE) | set(_CLOSING_GROUP)
    guard = 0
    while sum(quotas.values()) > num_questions and guard < 1000:
        guard += 1
        donors = sorted(
            (k for k, v in quotas.items() if v > 0),
            key=lambda k: (-quotas[k], k in protected),
        )
        trimmed = False
        for donor in donors:
            if donor in protected and quotas[donor] <= 1:
                continue
            quotas[donor] -= 1
            trimmed = True
            break
        if not trimmed:
            # Không còn gì cắt an toàn (num_questions quá nhỏ so với số nhóm
            # bảo vệ); dừng, chấp nhận tổng > num_questions.
            break

    return quotas


def build_generation_spec(
    *,
    jd_title: str,
    jd_requirements: str,
    quotas: dict[str, int],
    language: str = "vi",
) -> dict[str, Any]:
    """Gói dữ kiện để tầng gọi dựng prompt cho LLM.

    Trả về dict thay vì chuỗi prompt để tầng gọi tự quyết cách diễn đạt, và để
    test khẳng định được nội dung mà không phải so khớp văn bản prompt.
    """
    return {
        "role_family": infer_role_family(jd_title),
        "jd_title": (jd_title or "").strip(),
        "jd_skills": extract_known_terms(jd_requirements or "", TECH_SKILLS),
        "quotas": {k: v for k, v in quotas.items() if v > 0},
        "total": sum(quotas.values()),
        "language": language,
        "competencies": sorted(COMPETENCIES),
        "star_dimensions": sorted(STAR_DIMENSIONS),
    }


def _coerce_str_list(value: Any, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = re.sub(r"\s+", " ", str(item or "")).strip()
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


def verify_evidence(evidence: str, source_text: str, *, min_chars: int = 12) -> bool:
    """Kiểm tra `evidence` có thật sự xuất hiện trong `source_text` hay không.

    So khớp sau khi chuẩn hoá bỏ dấu và gộp khoảng trắng, nên chịu được khác
    biệt hoa/thường và cách xuống dòng. Trích dẫn quá ngắn bị coi là không hợp
    lệ vì một mẩu vài ký tự gần như chắc chắn khớp ngẫu nhiên và không chứng
    minh được điều gì.
    """
    folded_evidence = _fold(evidence)
    if len(folded_evidence) < min_chars:
        return False
    return folded_evidence in _fold(source_text)


def _new_question_id() -> str:
    """Id của một mục agenda — duy nhất, không mang thông tin vị trí.

    Trước đây id được gán theo vị trí (`A-001`, `A-002`, ...). Cách đó khiến id
    KHÔNG phải danh tính mà chỉ là số thứ tự, và sinh ra hai vấn đề:

    1. Mọi agenda đều có `A-001` — id không tra ngược được nếu chỉ cầm mình nó.
    2. `ensure_agenda(force_regenerate=True)` ghi đè `questions_json` tại chỗ,
       giữ nguyên không gian id. Sau một lần bấm "Sinh lại", `A-004` trỏ sang
       một câu hỏi khác hẳn, trong khi `interview_questions.agenda_question_id`
       của các phiên trước vẫn giữ giá trị cũ — và vẫn phân giải thành công.
       Con trỏ sai mà không có cách nào phát hiện.

    Id ngẫu nhiên không làm câu hỏi cũ sống lại, nhưng biến "sai âm thầm" thành
    "không tra ngược được" — một trạng thái nhìn thấy và xử lý được.

    Giữ tiền tố `A-` cho dễ nhận ra trong log; tổng 34 ký tự, vừa với
    `interview_questions.agenda_question_id` (String(36)).
    """
    return f"A-{uuid.uuid4().hex}"


def _normalize_question(raw: Any) -> AgendaQuestion | None:
    """Chuyển một phần tử thô từ LLM thành AgendaQuestion, hoặc None nếu hỏng."""
    if not isinstance(raw, dict):
        return None
    question_vi = re.sub(r"\s+", " ", str(raw.get("question_vi") or raw.get("question") or "")).strip()
    if len(question_vi) < 15:
        return None

    competency = str(raw.get("competency") or "").strip().casefold()
    if competency not in COMPETENCIES:
        competency = "technical"

    source = str(raw.get("source") or "").strip().casefold()
    if source not in SOURCES:
        source = "generic"

    star = [d for d in _coerce_str_list(raw.get("star_dimensions"), limit=4) if d.casefold() in STAR_DIMENSIONS]

    return AgendaQuestion(
        id=_new_question_id(),
        question_vi=question_vi,
        question_en=re.sub(r"\s+", " ", str(raw.get("question_en") or "")).strip(),
        competency=competency,
        phase=COMPETENCY_TO_PHASE.get(competency, "skills"),
        linked_skills=_coerce_str_list(raw.get("linked_skills")),
        star_dimensions=[d.casefold() for d in star],
        follow_up_prompts=_coerce_str_list(raw.get("follow_up_prompts"), limit=3),
        good_answer_signals=_coerce_str_list(raw.get("good_answer_signals"), limit=5),
        red_flags=_coerce_str_list(raw.get("red_flags"), limit=5),
        evidence=re.sub(r"\s+", " ", str(raw.get("evidence") or "")).strip(),
        source=source,
    )


def _generic_question(competency: str, used: set[str]) -> AgendaQuestion | None:
    for text in _GENERIC_BY_COMPETENCY.get(competency, ()):
        if _fold(text) not in used:
            return AgendaQuestion(
                id=_new_question_id(),
                question_vi=text,
                competency=competency,
                phase=COMPETENCY_TO_PHASE.get(competency, "skills"),
                source="generic",
            )
    return None


def sanitize_agenda(
    raw_questions: Any,
    *,
    cv_text: str,
    jd_text: str,
    quotas: dict[str, int],
) -> list[AgendaQuestion]:
    """Làm sạch danh sách câu hỏi thô từ LLM thành agenda dùng được.

    Bốn việc, theo thứ tự:

    1. Bỏ phần tử hỏng (không phải dict, câu hỏi quá ngắn).
    2. Khử trùng lặp theo nội dung đã chuẩn hoá.
    3. **Kiểm chứng evidence**: câu khai `source="cv"`/`"jd"` mà trích dẫn
       không tìm thấy trong văn bản tương ứng sẽ bị hạ xuống `source="generic"`
       và xoá `evidence`. Không loại bỏ hẳn — câu hỏi vẫn có thể hữu ích, chỉ
       là không được phép tự nhận là có căn cứ.
    4. Lấp cho đủ hạn ngạch từng competency bằng câu generic.

    Không ném exception: đầu vào rác trả về agenda toàn câu generic.
    """
    items = raw_questions if isinstance(raw_questions, list) else []
    seen: set[str] = set()
    accepted: list[AgendaQuestion] = []
    per_competency: dict[str, int] = dict.fromkeys(COMPETENCIES, 0)

    for raw in items:
        question = _normalize_question(raw)
        if question is None:
            continue
        key = _fold(question.question_vi)
        if key in seen:
            continue

        if question.source == "cv" and not verify_evidence(question.evidence, cv_text):
            question = replace(question, source="generic", evidence="")
        elif question.source == "jd" and not verify_evidence(question.evidence, jd_text):
            question = replace(question, source="generic", evidence="")

        # Không nhận quá hạn ngạch của một competency; phần thừa bị bỏ để giữ
        # đúng độ phủ năng lực đã tính.
        if per_competency[question.competency] >= quotas.get(question.competency, 0):
            continue

        seen.add(key)
        per_competency[question.competency] += 1
        accepted.append(question)

    for competency, quota in quotas.items():
        while per_competency.get(competency, 0) < quota:
            filler = _generic_question(competency, used=seen)
            if filler is None:
                break
            seen.add(_fold(filler.question_vi))
            per_competency[competency] = per_competency.get(competency, 0) + 1
            accepted.append(filler)

    # Sắp theo thứ tự trình bày cuối cùng, nhưng KHÔNG đánh số lại id: id là
    # danh tính của câu hỏi (xem _new_question_id), không phải vị trí của nó.
    return sorted(
        accepted,
        key=lambda q: COMPETENCY_PRIORITY.index(q.competency) if q.competency in COMPETENCY_PRIORITY else 99,
    )


def agenda_coverage(questions: list[AgendaQuestion]) -> dict[str, int]:
    """Đếm số câu theo competency — dùng cho chip đếm ở giao diện và cho test."""
    coverage = dict.fromkeys(COMPETENCIES, 0)
    for question in questions:
        if question.is_enabled:
            coverage[question.competency] = coverage.get(question.competency, 0) + 1
    return coverage
