import re
from io import BytesIO

import pypdf

from src.services.cv_jd_matching import build_cv_jd_evidence
from src.services.cv_normalization import normalize_cv_data, normalized_cv_errors
from src.services.pdf_export import build_cv_pdf


def _pdf_text(pdf: bytes) -> str:
    return "\n".join(page.extract_text() or "" for page in pypdf.PdfReader(BytesIO(pdf)).pages)


def test_markdown_is_normalized_without_damaging_technical_symbols_or_vietnamese():
    source = {
        "personal_info": {"full_name": "# Nguyễn Thị Ánh", "email": "anh@example.com"},
        "headline": "In Progress",
        "summary": "**Kỹ sư phần mềm** xây dựng [portfolio](https://example.com).",
        "skills": ["- C#", "* C++", ".NET", "Node.js", "CI/CD", "C#"],
        "projects": [
            {"title": "## Nền tảng bán hàng", "bullets": ["- Xây dựng API", "• Xây dựng API"], "technologies": ["C#", ".NET"]},
            {"name": "Nền tảng bán hàng", "description": "Xây dựng API"},
        ],
        "education": [{"school": "Đại học Bách Khoa", "degree": "Cử nhân CNTT"}, {"school": "Đại học Bách Khoa", "degree": "Cử nhân CNTT"}],
    }
    normalized = normalize_cv_data(source)

    assert normalized["personal_info"]["full_name"] == "Nguyễn Thị Ánh"
    assert normalized["headline"] == ""
    assert normalized["skills"] == ["C#", "C++", ".NET", "Node.js", "CI/CD"]
    assert len(normalized["projects"]) == 1
    assert normalized["projects"][0]["bullets"] == ["Xây dựng API"]
    assert len(normalized["education"]) == 1
    assert "**" not in normalized["summary"] and "https://example.com" in normalized["summary"]
    assert normalized_cv_errors(source, normalized) == []


def test_markdown_source_sections_are_structured_and_empty_sections_are_safe():
    raw = """# Trần Văn Bình
## Professional Summary
**Backend developer**
## Skills
- Python
- CI/CD
## Education
- Đại học Khoa học Tự nhiên
"""
    normalized = normalize_cv_data({"personal_info": {}, "skills": [], "experience": []}, source_text=raw)
    assert normalized["personal_info"]["full_name"] == "Trần Văn Bình"
    assert normalized["summary"] == "Backend developer"
    assert normalized["skills"] == ["Python", "CI/CD"]
    assert normalized["experience"] == []
    assert normalized["education"][0]["title"] == "Đại học Khoa học Tự nhiên"


def test_pdf_uses_sanitized_structured_data_and_has_no_raw_markdown_artifacts():
    parsed = normalize_cv_data({
        "personal_info": {"full_name": "# Lê Minh", "email": "le@example.com"},
        "summary": "**Xây dựng** dịch vụ Node.js",
        "skills": ["- C#", "C++", ".NET", "Node.js", "CI/CD"],
        "experience": [{"company": "ACME", "role": "Engineer", "bullets": ["- Built APIs", "- Built APIs"]}],
        "projects": [], "education": [],
    })
    pdf = build_cv_pdf(title="In Progress", parsed=parsed, template_name="classic")
    text = _pdf_text(pdf)
    assert "lê minh" in text.casefold() and "In Progress" not in text
    assert all(value in text for value in ("C#", "C++", ".NET", "Node.js", "CI/CD"))
    assert "# Lê Minh" not in text and "**" not in text
    assert len(re.findall("Built APIs", text)) == 1


def test_field_mapping_keeps_contact_out_of_summary_and_deduplicates_parser_variants():
    source = {
        "personal_info": {"full_name": "# Nguyen Minh Anh", "email": "anh@example.com", "phone": "+84 912 345 678"},
        "headline": "Software Engineer",
        "summary": "**Builds** reliable systems.\nEmail: anh@example.com\n+84 912 345 678",
        "projects": [
            {"title": "## Recruitment Platform", "period": "2024", "bullets": ["- Built API", "* Built API"], "technologies": ["Node.js", "React"]},
            {"name": "Recruitment Platform", "period": "2024-2025", "description": "Built API", "tech_stack": ["Node.js", "React"]},
        ],
        "experience": [{"company": "Acme Corp", "role": "Backend Engineer", "start_date": "2023", "end_date": "2024", "bullets": ["- Delivered services"]}],
        "education": [{"school": "University A", "degree": "BSc Computer Science", "period": "2019-2023"}],
    }
    normalized = normalize_cv_data(source)
    assert normalized["summary"] == "Builds reliable systems."
    assert len(normalized["projects"]) == 1

    text = _pdf_text(build_cv_pdf(title="In Progress", parsed=source, template_name="classic"))
    assert "NGUYEN MINH ANH" in text
    assert "Software Engineer" in text
    assert "Backend Engineer" in text and "Acme Corp" in text and "2023 - 2024" in text
    assert "BSc Computer Science" in text and "University A" in text
    assert text.count("Recruitment Platform") == 1
    summary_text = text.split("PROFESSIONAL SUMMARY", 1)[1].split("EDUCATION", 1)[0]
    assert "anh@example.com" not in summary_text and "+84 912 345 678" not in summary_text


def test_renderer_allows_one_or_two_clean_pages_instead_of_overcompressing():
    base = {"personal_info": {"full_name": "Page Test"}, "skills": ["Python"], "education": [], "projects": []}
    one_page = build_cv_pdf(title="CV", parsed={**base, "summary": "Short summary.", "experience": []}, template_name="classic")
    two_page = build_cv_pdf(
        title="CV",
        parsed={**base, "summary": "Long summary.", "experience": [{"company": f"Company {i}", "role": "Engineer", "bullets": [f"Delivered verified service outcome {i} with readable documentation."]} for i in range(26)]},
        template_name="classic",
    )
    assert len(pypdf.PdfReader(BytesIO(one_page)).pages) == 1
    assert len(pypdf.PdfReader(BytesIO(two_page)).pages) >= 2


def test_gap_detection_canonicalizes_skill_aliases_and_ignores_placeholders():
    evidence = build_cv_jd_evidence(
        cv_text="Built web applications with JavaScript, Python, Git, SQL, NextJS/Next.js and ReactJS/React.",
        parsed_cv={"skills": ["JavaScript", "Python", "Git", "SQL", "NextJS/Next.js", "ReactJS/React", "-", "N/A", "   "]},
        jd_title="Frontend Engineer",
        jd_requirements="Required JavaScript, Python, Git, SQL, Next.js and React.",
        jd_parsed={},
    )
    assert not set(evidence["hard_skills_missing"]).intersection({"JavaScript", "Python", "Git", "SQL", "Next.js", "React"})
    assert "-" not in evidence["cv_skills"] and "N/A" not in evidence["cv_skills"]
