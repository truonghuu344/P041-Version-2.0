from types import SimpleNamespace

import pytest

from src.agents.nodes.cv_parser_nodes import CVStructuredExtraction
from src.services.cv_parser import (
    parse_cv_locally,
    parse_cv_to_structured_json,
    sanitize_extracted_text,
)

CV_TEXT = """
NGUYỄN VĂN A
SUMMARY
Sinh viên Backend mong muốn phát triển hệ thống web.
EDUCATION
Đại học Công nghệ, ngành Công nghệ thông tin, 2022-2026
SKILLS
Python, Django, MySQL, Git, teamwork
PROJECTS
Xây dựng REST API quản lý công việc bằng Python và Django.
"""


def test_local_cv_parser_extracts_only_present_skills():
    result = parse_cv_locally(CV_TEXT)

    assert result["parser_mode"] == "local"
    assert {"Python", "Django", "MySQL", "Git", "teamwork"}.issubset(result["skills"])
    assert "FastAPI" not in result["skills"]
    assert result["education"]
    assert result["projects"]


def test_parser_does_not_treat_localized_section_heading_as_candidate_name():
    result = parse_cv_locally(
        "Trần Hoàng Nam\nnam@example.com\n0901234567\nMỤC TIÊU\nBackend developer\nWORK HISTORY\nBuilt APIs"
    )

    assert result["personal_info"]["full_name"] == "Trần Hoàng Nam"


@pytest.mark.asyncio
async def test_cv_parser_does_not_require_external_ai(monkeypatch):
    monkeypatch.setattr(
        "src.services.cv_parser.get_settings",
        lambda: SimpleNamespace(google_genai_api_key="", model_name="gemini-3.5-flash", cv_parser_mode="local"),
    )

    result = await parse_cv_to_structured_json(CV_TEXT)

    assert result["parser_mode"] == "local"
    assert "Python" in result["skills"]


@pytest.mark.asyncio
async def test_match_auto_parse_skips_llm_when_local_evidence_is_sufficient():
    result = await parse_cv_to_structured_json(CV_TEXT, use_llm="auto")

    assert result["agent_metadata"]["llm_policy"] == "auto"
    assert result["agent_metadata"]["llm_requested"] is False
    assert result["agent_metadata"]["llm_called"] is False


@pytest.mark.asyncio
async def test_match_auto_parse_requests_llm_only_for_unstructured_long_cv():
    unstructured = "\n".join(
        ["Professional background with responsibilities and delivered work outcomes."] * 18
    )

    result = await parse_cv_to_structured_json(unstructured, use_llm="auto")

    assert result["agent_metadata"]["llm_policy"] == "auto"
    assert result["agent_metadata"]["llm_requested"] is True
    # Test configuration has no API key, so the safe local fallback remains usable.
    assert result["agent_metadata"]["llm_called"] is False
    assert result["parser_mode"] == "local_fallback"


def test_sanitize_extracted_text_removes_postgres_invalid_null_bytes():
    dirty = "Backend: Django\x00Python\x00\nFrontend: HTML"

    clean = sanitize_extracted_text(dirty)

    assert "\x00" not in clean
    assert clean == "Backend: Django Python\nFrontend: HTML"


def test_local_parser_repairs_fragmented_vietnamese_name_and_location():
    pdf_text = """
0363616300
truonghuu344@gmail.com
Xã Tây Ph ươ ng, TP.Hà N ộ i
Soft skills
Teamwork & Collaboration
Interests
Learning new things
V ũ H ữ u Tr ư ờ ng
SUMMARY
Final-year Information Technology student.
EDUCATION
Hanoi University of Business and Technology 2022-2026
SKILLS
Python, FastAPI, ReactJS
"""

    result = parse_cv_locally(pdf_text)

    assert result["personal_info"]["full_name"] == "Vũ Hữu Trường"
    assert result["personal_info"]["location"] == "Xã Tây Phương, TP.Hà Nội"


@pytest.mark.asyncio
async def test_cv_agent_calls_structured_llm_and_rejects_hallucinated_skill(monkeypatch):
    called = {"value": False}

    class FakeStructuredLLM:
        def with_structured_output(self, schema, **kwargs):
            assert schema is CVStructuredExtraction
            assert kwargs["strict"] is True
            return self

        async def ainvoke(self, messages):
            called["value"] = True
            return CVStructuredExtraction.model_validate(
                {
                    "personal_info": {
                        "full_name": "NGUYỄN VĂN A",
                        "email": "",
                        "phone": "",
                        "location": "",
                    },
                    "professional_summary": "Sinh viên Backend mong muốn phát triển hệ thống web.",
                    "hard_skills": ["Python", "Kubernetes"],
                    "soft_skills": ["teamwork"],
                    "education": [
                        {
                            "title": "Công nghệ thông tin",
                            "organization": "Đại học Công nghệ",
                            "period": "2022-2026",
                            "description": "Ngành Công nghệ thông tin",
                            "evidence_quote": "Đại học Công nghệ, ngành Công nghệ thông tin, 2022-2026",
                        }
                    ],
                    "experience": [],
                    "projects": [],
                    "certifications": [],
                    "missing_information": ["Email", "Số điện thoại"],
                }
            )

    monkeypatch.setattr(
        "src.agents.nodes.cv_parser_nodes.get_settings",
        lambda: SimpleNamespace(
            google_genai_api_key="test-key",
            model_name="gemini-3.5-flash",
            cv_parser_mode="local",
            cv_structured_parse_llm_enabled=True,
            llm_timeout_seconds=20,
            llm_max_retries=0,
        ),
    )
    monkeypatch.setattr(
        "src.agents.nodes.cv_parser_nodes.ChatGoogleGenerativeAI",
        lambda **kwargs: FakeStructuredLLM(),
    )

    result = await parse_cv_to_structured_json(CV_TEXT, use_llm=True)

    assert called["value"] is True
    assert result["parser_mode"] == "gemini_agent"
    assert result["agent_metadata"]["llm_called"] is True
    assert result["agent_metadata"]["llm_succeeded"] is True
    assert "Python" in result["hard_skills"]
    assert "Kubernetes" not in result["hard_skills"]
    assert result["guardrail"]["rejected_unverified_claims"] >= 1
