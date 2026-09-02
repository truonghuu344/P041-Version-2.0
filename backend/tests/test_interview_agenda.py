from __future__ import annotations

import pytest

from src.services.interview_agenda import (
    _CLOSING_GROUP,
    _GENERIC_BY_COMPETENCY,
    COMPETENCIES,
    MAX_NUM_QUESTIONS,
    MIN_NUM_QUESTIONS,
    AgendaQuestion,
    agenda_coverage,
    build_generation_spec,
    compute_quotas,
    infer_role_family,
    sanitize_agenda,
    verify_evidence,
)

# ---------------------------------------------------------------------------
# compute_quotas
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("n", [3, 5, 8, 12])
def test_compute_quotas_total_matches_num_questions(n):
    quotas = compute_quotas(n)
    assert sum(quotas.values()) == n


@pytest.mark.parametrize("n", [3, 5, 8, 12])
def test_compute_quotas_always_has_self_intro(n):
    quotas = compute_quotas(n)
    assert quotas.get("self_intro", 0) >= 1


@pytest.mark.parametrize("n", [3, 5, 8, 12])
def test_compute_quotas_has_closing_group_when_n_at_least_two(n):
    quotas = compute_quotas(n)
    assert sum(quotas.get(k, 0) for k in _CLOSING_GROUP) >= 1


def test_compute_quotas_clamps_below_minimum():
    assert compute_quotas(1) == compute_quotas(MIN_NUM_QUESTIONS)


def test_compute_quotas_clamps_above_maximum():
    assert compute_quotas(99) == compute_quotas(MAX_NUM_QUESTIONS)


def test_compute_quotas_technical_focus_increases_technical_share():
    default_quotas = compute_quotas(8)
    focused_quotas = compute_quotas(8, competency_focus="technical")
    assert focused_quotas["technical"] > default_quotas["technical"]
    assert sum(focused_quotas.values()) == 8


def test_compute_quotas_invalid_focus_behaves_like_no_focus():
    default_quotas = compute_quotas(8)
    invalid_focus_quotas = compute_quotas(8, competency_focus="khong_ton_tai")
    assert invalid_focus_quotas == default_quotas


# Hai test dưới đây nhắm vào đúng các tổ hợp mà ràng buộc tối thiểu THỰC SỰ
# có tác dụng. Với trọng số mặc định ở n >= 8, self_intro và nhóm đóng phiên
# vốn đã được largest-remainder cấp cho ít nhất 1 câu, nên test ở dải đó không
# chứng minh được ràng buộc còn sống hay đã bị gỡ. Chỉ khi competency_focus
# bóp trọng số các nhóm khác xuống, hoặc khi n nhỏ, ràng buộc mới cắn.


@pytest.mark.parametrize("n", [3, 4, 5])
@pytest.mark.parametrize("focus", ["technical", "behavioral"])
def test_compute_quotas_keeps_self_intro_even_when_focus_starves_it(n, focus):
    quotas = compute_quotas(n, competency_focus=focus)
    assert quotas.get("self_intro", 0) >= 1
    assert sum(quotas.values()) == n


@pytest.mark.parametrize("n", [3, 4, 5, 6, 7])
@pytest.mark.parametrize("focus", [None, "technical", "behavioral"])
def test_compute_quotas_keeps_closing_group_at_small_sizes(n, focus):
    quotas = compute_quotas(n, competency_focus=focus)
    assert sum(quotas.get(k, 0) for k in _CLOSING_GROUP) >= 1
    assert sum(quotas.values()) == n


# ---------------------------------------------------------------------------
# verify_evidence
# ---------------------------------------------------------------------------


_SOURCE_TEXT_VI = (
    "Tôi đã xây dựng hệ thống backend bằng Python và đã triển khai trên AWS."
)


def test_verify_evidence_exact_quote_is_true():
    assert verify_evidence("Tôi đã xây dựng hệ thống backend bằng Python", _SOURCE_TEXT_VI) is True


def test_verify_evidence_case_and_whitespace_insensitive():
    noisy = "  TÔI\n ĐÃ xây   DỰNG hệ thống\n\nbackend bằng Python  "
    assert verify_evidence(noisy, _SOURCE_TEXT_VI) is True


def test_verify_evidence_matches_without_diacritics_including_d_with_stroke():
    # Nguồn có "đã" (chứa "đ"), evidence gõ không dấu là "da". "đ" không tách
    # được bằng NFD nên module phải xử lý riêng; test này khẳng định điều đó.
    source = "Dự án đã hoàn thành đúng tiến độ đề ra trong quý vừa qua."
    evidence_no_diacritics = "du an da hoan thanh dung tien do de ra"
    assert verify_evidence(evidence_no_diacritics, source) is True


def test_verify_evidence_content_not_in_source_is_false():
    assert verify_evidence("Tôi đã học machine learning chuyên sâu tại MIT", _SOURCE_TEXT_VI) is False


def test_verify_evidence_too_short_is_false_even_if_present():
    # "Python" xuất hiện thật trong source nhưng dưới min_chars mặc định (12).
    assert "Python" in _SOURCE_TEXT_VI
    assert verify_evidence("Python", _SOURCE_TEXT_VI) is False


def test_verify_evidence_respects_custom_min_chars():
    assert verify_evidence("Python", _SOURCE_TEXT_VI, min_chars=4) is True


# ---------------------------------------------------------------------------
# sanitize_agenda
# ---------------------------------------------------------------------------


_CV_TEXT = "Toi da xay dung he thong backend bang Python tai cong ty ABC trong 3 nam."
_JD_TEXT = "Vi tri yeu cau kinh nghiem voi Python, Django va trien khai he thong tren AWS."

_FULL_QUOTAS = {
    "technical": 2,
    "self_intro": 1,
    "behavioral": 2,
    "position": 1,
    "situational": 1,
    "motivation": 1,
    "company": 1,
}


def test_sanitize_agenda_keeps_cv_source_when_evidence_is_real():
    raw = [
        {
            "question_vi": "Ban co the mo ta cach ban da xay dung he thong backend bang Python khong?",
            "competency": "technical",
            "source": "cv",
            "evidence": "Toi da xay dung he thong backend bang Python",
        }
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 1})
    technical = [q for q in result if q.source == "cv"]
    assert len(technical) == 1
    assert technical[0].evidence == "Toi da xay dung he thong backend bang Python"


def test_sanitize_agenda_downgrades_cv_source_when_evidence_is_fabricated():
    raw = [
        {
            "question_vi": "Ban da tung lam viec tai NASA voi vai tro gi khi truoc day?",
            "competency": "technical",
            "source": "cv",
            "evidence": "Toi da tung lam viec tai NASA",
        }
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 1})
    assert len(result) == 1
    question = result[0]
    # Câu hỏi vẫn còn trong agenda, chỉ bị hạ cấp nguồn và xoá evidence.
    assert question.source == "generic"
    assert question.evidence == ""
    assert "NASA" in question.question_vi


def test_sanitize_agenda_keeps_jd_source_when_evidence_is_real():
    raw = [
        {
            "question_vi": "JD yeu cau kinh nghiem voi Django, ban co the chia se khong?",
            "competency": "technical",
            "source": "jd",
            "evidence": "kinh nghiem voi Python, Django",
        }
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 1})
    assert len(result) == 1
    assert result[0].source == "jd"
    assert result[0].evidence == "kinh nghiem voi Python, Django"


def test_sanitize_agenda_downgrades_jd_source_when_evidence_is_fabricated():
    raw = [
        {
            "question_vi": "JD co nhac den Ruby on Rails, ban da dung no bao gio chua?",
            "competency": "technical",
            "source": "jd",
            "evidence": "chung toi dung Ruby on Rails va PHP",
        }
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 1})
    assert len(result) == 1
    question = result[0]
    assert question.source == "generic"
    assert question.evidence == ""


def test_sanitize_agenda_deduplicates_questions_differing_only_by_case_or_whitespace():
    raw = [
        {
            "question_vi": "Ban co the mo ta mot du an ban tam dac nhat khong?",
            "competency": "technical",
            "source": "generic",
        },
        {
            "question_vi": "  BAN CO THE mo ta   MOT du an ban tam dac nhat khong?  ",
            "competency": "technical",
            "source": "generic",
        },
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 5})
    technical_questions = [q for q in result if q.competency == "technical"]
    # Chỉ có một câu độc nhất được giữ lại từ cặp trùng lặp; phần còn lại (nếu
    # có) là câu generic lấp đầy hạn ngạch, không phải bản sao của câu trên.
    matching_texts = [q.question_vi for q in technical_questions if "tam dac" in q.question_vi]
    assert len(matching_texts) == 1


def test_sanitize_agenda_drops_questions_shorter_than_minimum_length():
    raw = [
        {"question_vi": "Qua ngan", "competency": "technical", "source": "generic"},
        {
            "question_vi": "Cau hoi nay du dai de vuot qua nguong toi thieu 15 ky tu.",
            "competency": "technical",
            "source": "generic",
        },
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 5})
    assert all(q.question_vi != "Qua ngan" for q in result)


def test_sanitize_agenda_skips_non_dict_elements_without_raising():
    raw = [
        "not a dict",
        None,
        12345,
        3.14,
        ["also", "not", "a", "dict"],
        {
            "question_vi": "Day la cau hoi hop le duy nhat trong danh sach thu.",
            "competency": "technical",
            "source": "generic",
        },
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 1})
    assert len(result) == 1
    assert "hop le" in result[0].question_vi


@pytest.mark.parametrize("garbage", ["just a string", None, 12345, {"a": 1}, 3.14])
def test_sanitize_agenda_handles_completely_garbage_input(garbage):
    result = sanitize_agenda(garbage, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas=_FULL_QUOTAS)
    assert sum(_FULL_QUOTAS.values()) == len(result)
    assert all(q.source == "generic" for q in result)


def test_sanitize_agenda_does_not_exceed_quota_per_competency():
    raw = [
        {
            "question_vi": "Ban co the mo ta cach ban da xay dung he thong backend bang Python khong?",
            "competency": "technical",
            "source": "cv",
            "evidence": "Toi da xay dung he thong backend bang Python",
        },
        {
            "question_vi": "Ban da tung lam viec tai NASA voi vai tro gi khi truoc day?",
            "competency": "technical",
            "source": "cv",
            "evidence": "Toi da tung lam viec tai NASA",
        },
        {
            "question_vi": "JD yeu cau kinh nghiem voi Django, ban co the chia se khong?",
            "competency": "technical",
            "source": "jd",
            "evidence": "kinh nghiem voi Python, Django",
        },
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas={"technical": 2})
    technical_questions = [q for q in result if q.competency == "technical"]
    assert len(technical_questions) == 2
    # Câu thứ 3 (nguồn JD hợp lệ) bị bỏ vì hạn ngạch đã đầy trước khi tới lượt nó.
    assert not any("Django" in q.question_vi for q in technical_questions)


def test_sanitize_agenda_fills_missing_quota_with_generic_questions():
    raw = [
        {
            "question_vi": "Cau hoi ky thuat co ban da duoc chuan bi san day du.",
            "competency": "technical",
            "source": "generic",
        }
    ]
    result = sanitize_agenda(raw, cv_text="", jd_text="", quotas={"technical": 3})
    technical_questions = [q for q in result if q.competency == "technical"]
    assert len(technical_questions) == 3
    assert all(q.source == "generic" for q in technical_questions)


def test_sanitize_agenda_ids_are_contiguous_without_gaps():
    raw = [
        {
            "question_vi": "Ban co the mo ta cach ban da xay dung he thong backend bang Python khong?",
            "competency": "technical",
            "source": "cv",
            "evidence": "Toi da xay dung he thong backend bang Python",
        }
    ]
    result = sanitize_agenda(raw, cv_text=_CV_TEXT, jd_text=_JD_TEXT, quotas=_FULL_QUOTAS)
    ids = [q.id for q in result]
    # Id là DANH TÍNH của câu hỏi, không phải vị trí: cố ý không kiểm tra chúng
    # liên tục hay theo thứ tự. Gán theo vị trí ("A-001", "A-002", ...) khiến
    # mọi agenda dùng chung một không gian id, và một lần bấm "Sinh lại" —
    # vốn ghi đè questions_json tại chỗ — làm id cũ trỏ sang câu hỏi khác mà
    # vẫn phân giải thành công. Xem interview_agenda.py::_new_question_id.
    assert len(ids) == len(set(ids)), "id phải duy nhất trong một agenda"
    assert all(q.id.startswith("A-") for q in result)


# ---------------------------------------------------------------------------
# agenda_coverage
# ---------------------------------------------------------------------------


def test_agenda_coverage_counts_by_competency_and_ignores_disabled():
    questions = [
        AgendaQuestion(id="A-001", question_vi="x" * 20, competency="technical", is_enabled=True),
        AgendaQuestion(id="A-002", question_vi="y" * 20, competency="technical", is_enabled=False),
        AgendaQuestion(id="A-003", question_vi="z" * 20, competency="self_intro", is_enabled=True),
    ]
    coverage = agenda_coverage(questions)
    assert coverage["technical"] == 1
    assert coverage["self_intro"] == 1
    assert coverage["behavioral"] == 0


# ---------------------------------------------------------------------------
# infer_role_family
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("jd_title", "expected"),
    [
        ("Backend Developer (Python/Django)", "backend"),
        ("Frontend Engineer - ReactJS", "frontend"),
        ("Full-stack Developer", "fullstack"),
        ("Data Analyst", "data"),
        ("QA Engineer / Tester", "qa"),
        ("DevOps Engineer", "devops"),
        ("Senior Barista", "general"),
    ],
)
def test_infer_role_family(jd_title, expected):
    assert infer_role_family(jd_title) == expected


# ---------------------------------------------------------------------------
# build_generation_spec (sanity-check thêm ngoài yêu cầu, không tốn công sức)
# ---------------------------------------------------------------------------


def test_build_generation_spec_total_matches_quota_sum():
    quotas = compute_quotas(8)
    spec = build_generation_spec(jd_title="Backend Developer", jd_requirements="Can Python, SQL", quotas=quotas)
    assert spec["total"] == sum(quotas.values())
    assert spec["role_family"] == "backend"
    assert all(v > 0 for v in spec["quotas"].values())


# ---------------------------------------------------------------------------
# Bất biến của kho câu generic
# ---------------------------------------------------------------------------


def test_generic_pool_covers_worst_case_quota():
    """Kho câu generic phải lấp được hạn ngạch lớn nhất có thể yêu cầu.

    Nếu thiếu, `sanitize_agenda()` sẽ trả về ít câu hơn `num_questions` mỗi khi
    LLM lỗi hoặc hết quota — đúng lúc đường fallback cần đáng tin nhất. Test
    này quét toàn bộ tổ hợp (num_questions, competency_focus) để chốt chặn.
    """
    worst_case = dict.fromkeys(COMPETENCIES, 0)
    for n in range(MIN_NUM_QUESTIONS, MAX_NUM_QUESTIONS + 1):
        for focus in [None, *sorted(COMPETENCIES)]:
            for competency, quota in compute_quotas(n, focus).items():
                worst_case[competency] = max(worst_case[competency], quota)

    thieu = {
        competency: (needed, len(_GENERIC_BY_COMPETENCY.get(competency, ())))
        for competency, needed in worst_case.items()
        if len(_GENERIC_BY_COMPETENCY.get(competency, ())) < needed
    }
    assert not thieu, f"Nhóm thiếu mẫu generic (cần, đang có): {thieu}"


@pytest.mark.parametrize("n", [3, 5, 8, 12])
@pytest.mark.parametrize("focus", [None, "technical", "behavioral"])
def test_sanitize_agenda_fallback_always_fills_requested_count(n, focus):
    """Đầu vào rác (LLM hỏng hoàn toàn) vẫn phải trả về đủ số câu yêu cầu."""
    quotas = compute_quotas(n, competency_focus=focus)
    questions = sanitize_agenda(None, cv_text="", jd_text="", quotas=quotas)
    assert len(questions) == sum(quotas.values())
    assert all(q.source == "generic" for q in questions)
