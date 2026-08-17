from __future__ import annotations

import pytest

from src.services.pdf_export import build_cv_pdf
from src.services.resume_optimization_service import optimize_resume_for_jd


@pytest.mark.asyncio
async def test_full_resume_optimization_service_flow():
    cv_text = """Nguyễn Văn A
Email: nguyenvana@gmail.com | Phone: 0912345678 | Hanoi, Vietnam

Tóm tắt chuyên môn:
Lập trình viên Backend với hơn 3 năm kinh nghiệm phát triển hệ thống bằng Python, FastAPI và cơ sở dữ liệu PostgreSQL.

Kinh nghiệm làm việc:
Công ty Cổ phần Công nghệ ABC (2021 - 2024)
Vị trí: Backend Developer
- Xây dựng và tối ưu hóa hệ thống RESTful API phục vụ 50.000 người dùng hàng ngày bằng FastAPI và Python.
- Thiết kế cơ sở dữ liệu PostgreSQL, tối ưu câu truy vấn giảm 40% thời gian phản hồi.
- Phối hợp với team frontend React để tích hợp giao diện người dùng.

Kỹ năng chuyên môn:
- Ngôn ngữ: Python, SQL
- Framework: FastAPI, Django
- Database: PostgreSQL, Redis
"""
    parsed_cv = {
        "personal_info": {"full_name": "Nguyễn Văn A", "email": "nguyenvana@gmail.com", "phone": "0912345678"},
        "summary": "Lập trình viên Backend với hơn 3 năm kinh nghiệm phát triển hệ thống bằng Python, FastAPI.",
        "skills": ["Python", "FastAPI", "PostgreSQL", "SQL", "Django", "Redis"],
        "experience": [
            {
                "company": "Công ty Cổ phần Công nghệ ABC",
                "role": "Backend Developer",
                "duration": "2021 - 2024",
                "bullets": [
                    "Xây dựng và tối ưu hóa hệ thống RESTful API phục vụ 50.000 người dùng hàng ngày bằng FastAPI và Python.",
                    "Thiết kế cơ sở dữ liệu PostgreSQL, tối ưu câu truy vấn giảm 40% thời gian phản hồi.",
                ],
            }
        ],
    }

    jd_title = "Senior Python Backend Developer"
    jd_text = """Yêu cầu công việc:
- Thành thạo Python, FastAPI trong xây dựng API hiệu năng cao.
- Kinh nghiệm làm việc sâu với PostgreSQL và Redis.
- Kỹ năng tối ưu hóa hệ thống và truy vấn SQL."""
    parsed_jd = {
        "title": jd_title,
        "must_have_skills": [{"name": "Python"}, {"name": "FastAPI"}, {"name": "PostgreSQL"}],
        "nice_to_have_skills": [{"name": "Redis"}],
    }

    analysis_data = {
        "hard_skills_matching": ["Python", "FastAPI", "PostgreSQL", "Redis"],
        "hard_skills_missing": [],
        "hard_skills_partial": [],
        "soft_skills_gap": [],
        "confidence_score": 0.85,
        "match_score": 90.0,
        "suggestions": [
            {
                "original_text": "Xây dựng và tối ưu hóa hệ thống RESTful API phục vụ 50.000 người dùng hàng ngày bằng FastAPI và Python.",
                "suggested_improvement": "Xây dựng và tối ưu hóa hệ thống RESTful API phục vụ 50.000 người dùng hàng ngày bằng FastAPI và Python.",
                "reason": "Phù hợp trực tiếp với yêu cầu JD.",
            }
        ],
    }

    result = await optimize_resume_for_jd(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title=jd_title,
        jd_text=jd_text,
        parsed_jd=parsed_jd,
        analysis=analysis_data,
        language="vi",
        optimization_mode="balanced",
    )

    assert result is not None
    assert result["status"] == "completed"
    assert "changes" in result

    # Test PDF build
    pdf_bytes = build_cv_pdf(
        title="CV Nguyễn Văn A",
        parsed=result["optimized_resume"],
        accepted_suggestions=[],
        template_name="classic",
    )
    assert len(pdf_bytes) > 0
