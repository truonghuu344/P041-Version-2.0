"""Hàng rào chống bịa dữ liệu trong parse JD và điểm số sơ bộ.

Các test này khoá hành vi sau cải tiến: mọi field hiển thị cho người dùng
phải đến từ văn bản JD gốc; thiếu dữ liệu phải hiển thị rỗng/chưa xác định,
tuyệt đối không gán giá trị mẫu.
"""

from __future__ import annotations

import pytest

from src.services.cv_jd_matching import parse_job_description
from src.services.jd_parser import validate_llm_fields_against_source
from src.services.job_catalog import _contains_skill, _score_job_for_cv
from src.services.text_cleaning import clean_jd_text, restore_diacritics

JD_NO_METADATA = (
    "Senior ReactJS Developer\n"
    "We are looking for a developer with React, TypeScript and Node.js experience.\n"
    "Must have strong knowledge of REST API.\n"
    "Nice to have GraphQL experience."
)


def test_deadline_is_empty_when_jd_does_not_state_one():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    assert parsed["deadline"] == ""
    assert parsed["deadline"] != "2026-09-30"


def test_experience_is_not_invented_when_jd_does_not_state_one():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    assert parsed["experience"] == ""
    assert parsed["experience"] != "1-3 năm"


def test_education_is_not_invented_when_jd_does_not_state_one():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    assert parsed["education"] == ""
    assert parsed["education"] != "Đại học / Cao đẳng"


def test_tags_are_empty_when_no_skill_is_recognized():
    parsed = parse_job_description(
        title="Vị trí hỗ trợ",
        requirements_text="Cần người chăm chỉ, chịu áp lực cao và làm việc nhóm tốt.",
    )
    assert parsed["tags"] == []


def test_location_falls_back_to_unknown_label():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    assert parsed["location"] == "Chưa xác định"


def test_level_and_work_model_are_unknown_without_evidence():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA.replace("Senior ", ""))
    assert parsed["level"] == "Chưa xác định"
    assert parsed["work_model"] == "Chưa xác định"


def test_quantity_is_empty_when_jd_does_not_state_one():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    assert parsed["quantity"] == ""


def test_sections_have_no_boilerplate_content():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    by_type = {sec["type"]: sec for sec in parsed["sections"]}
    benefits = by_type["benefits"]
    assert benefits["content"] == ""
    assert benefits["source"] == "empty"
    # Không bảng đãi ngộ mẫu "Thưởng tháng 13"
    assert "word-editor-table" not in benefits["content"]
    assert "Thưởng tháng 13" not in str(parsed["sections"])
    must = by_type["must_have"]
    assert "Tối thiểu 1-2 năm kinh nghiệm" not in must["content"]


def test_extracted_sections_keep_real_content():
    jd = (
        "Backend Developer\n"
        "Mô tả công việc:\n- Xây dựng API với FastAPI\n"
        "Yêu cầu công việc:\n- Thành thạo Python, Docker\n"
        "- Tối thiểu 2 năm kinh nghiệm\n"
        "Quyền lợi:\n- Lương 20 - 30 triệu\n"
        "Hạn nộp hồ sơ: 30/09/2026"
    )
    parsed = parse_job_description(title="Backend Developer", requirements_text=jd)
    by_type = {sec["type"]: sec for sec in parsed["sections"]}
    assert by_type["must_have"]["source"] == "extracted"
    assert "Docker" in by_type["must_have"]["content"]
    assert by_type["benefits"]["source"] == "extracted"
    assert "Lương 20 - 30 triệu" in by_type["benefits"]["content"]
    assert parsed["deadline"] == "2026-09-30"
    assert parsed["salary_visibility"] == "Công khai"
    assert parsed["experience"] == "2 năm"


def test_missing_fields_reported_in_parse_quality():
    parsed = parse_job_description(title="Dev", requirements_text=JD_NO_METADATA)
    missing = set(parsed["parse_quality"]["missing_fields"])
    assert {"deadline", "quantity", "location"} <= missing


def test_messy_ocr_text_still_extracts_core_skills():
    messy = (
        "Tuyen dung Laravel Developer\n"
        "- Phat trien website bang Laravel, PHP\n"
        "- Lam viec voi MySQL va Redis\n"
        "Yeu cau: Thanh thao PHP, Laravel, co 2 nam kinh nghiem tro len\n"
        "Luong 8 - 15 trieu\n"
        "Han nop ho so: 15/10/2026"
    )
    parsed = parse_job_description(title="JD-001", requirements_text=messy)
    folded_tags = {str(tag).casefold() for tag in parsed["tags"]}
    assert {"php", "laravel"} <= folded_tags
    assert parsed["deadline"] == "2026-10-15"
    assert parsed["salary_min"] == "8.000.000"


def test_text_cleaning_repairs_mojibake_and_diacritics():
    dirty = "Dia diem: Ha Noi - Cong ty Admatic \ufffd\ufffd tuy?n d?ng"
    cleaned = clean_jd_text(dirty)
    assert "\ufffd" not in cleaned
    restored = restore_diacritics(cleaned)
    assert "Địa điểm" in restored
    assert "Công ty" in restored


class TestLLMFieldValidation:
    """Hàng rào chống bịa cho output LLM khi bật enrichment."""

    RAW = (
        "Tuyển dụng Senior AI Engineer tại Hà Nội\n"
        "Yêu cầu: Python, PyTorch, FastAPI\n"
        "Lương 25.000.000 - 45.000.000 VND\n"
        "Hạn nộp: 30/09/2026"
    )

    def test_traceable_fields_pass(self):
        validated = validate_llm_fields_against_source(
            {
                "title": "Senior AI Engineer",
                "tags": ["Python", "PyTorch"],
                "salary_min": "25.000.000",
                "salary_max": "45.000.000",
                "deadline": "2026-09-30",
            },
            self.RAW,
            fallback_title="",
        )
        assert validated["title"] == "Senior AI Engineer"
        assert set(validated["tags"]) == {"Python", "PyTorch"}
        assert validated["salary_max"] == "45.000.000"
        assert validated["deadline"] == "2026-09-30"

    def test_fabricated_fields_are_rejected(self):
        validated = validate_llm_fields_against_source(
            {
                "title": "Principal Architect Cloud Native Platform",
                "tags": ["Kubernetes", "Python"],
                "salary_min": "100",
                "salary_max": "200",
                "deadline": "2030-01-01",
                "quantity": "5",
            },
            self.RAW,
            fallback_title="AI Engineer",
        )
        rejected = set(validated["_rejected_fields"])
        assert "title" in rejected
        assert "tags:Kubernetes" in rejected
        assert "salary" in rejected
        assert "deadline" in rejected
        assert "title" not in validated or validated["title"] != "Principal Architect Cloud Native Platform"
        assert "salary_min" not in validated
        assert "deadline" not in validated
        # Python có trong JD gốc nên được giữ lại
        assert validated.get("tags") == ["Python"]

    def test_html_sections_sanitized(self):
        validated = validate_llm_fields_against_source(
            {
                "overview_html": '<p>Giới thiệu</p><script>alert(1)</script><style>x</style>',
                "benefits_html": '<ul onclick="steal()"><li>Lương theo JD</li></ul>',
            },
            self.RAW,
            fallback_title="AI",
        )
        overview = validated.get("overview_html", "")
        assert "<script>" not in overview
        assert "<style>" not in overview
        assert "Giới thiệu" in overview
        benefits = validated.get("benefits_html", "")
        assert "onclick" not in benefits


def test_prefilter_short_skills_require_word_boundaries():
    haystack = _score_job_for_cv_haystack_helper("carbon footprint carbonara coca")
    assert _contains_skill(haystack, "C") is False
    assert _contains_skill(haystack, "Go") is False
    real = _score_job_for_cv_haystack_helper("làm việc với ngôn ngữ C và Go")
    assert _contains_skill(real, "C") is True
    assert _contains_skill(real, "Go") is True


def _score_job_for_cv_haystack_helper(text: str) -> str:
    from src.services.job_catalog import _search_text

    return _search_text(text)


def test_prefilter_breakdown_has_no_hardcoded_scores():
    job = {
        "title": "Backend Developer",
        "domain": "Backend",
        "skills": ["Python", "Docker", "PostgreSQL"],
    }
    cv_text = "Có kinh nghiệm xây dựng REST API bằng Python và PostgreSQL."
    parsed_cv = {
        "skills": ["Python", "PostgreSQL"],
        "experience": [{"title": "Intern"}],
    }
    result = _score_job_for_cv(job, cv_text, parsed_cv)
    breakdown = {item["criterion_id"]: item for item in result["score_breakdown"]}
    # Điểm kinh nghiệm tính từ số bản ghi thật, không phải hằng số 85/40
    expected_exp = round(min(100.0, 1 * 25.0), 1)
    assert breakdown["experience"]["raw_score"] == expected_exp
    assert result["match_score"] == result["display_fit_score"]
    assert result["score_scale"] == "prefilter"


@pytest.mark.parametrize(
    "field,value",
    [
        ("deadline", ""),
        ("experience", ""),
        ("quantity", ""),
        ("tags", []),
    ],
)
def test_empty_inputs_yield_honest_defaults(field, value):
    parsed = parse_job_description(title="job", requirements_text="Không có thông tin chuyên môn.")
    assert parsed[field] == value
