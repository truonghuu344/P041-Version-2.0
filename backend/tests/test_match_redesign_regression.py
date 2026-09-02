from src.services.cv_jd_matching import (
    _build_atomic_requirements,
    _clean_requirement_title,
    _is_non_requirement,
    parse_job_description,
)
from src.services.cv_jd_pipeline import ChunkingService, _is_contact_or_header_text


def test_is_non_requirement_filters_markdown_and_fluff():
    # Markdown headings
    assert _is_non_requirement("### 4.") is True
    assert _is_non_requirement("## Yêu cầu công việc") is True
    assert _is_non_requirement("### 5. Quyền lợi ứng viên") is True
    assert _is_non_requirement("# Mô tả công việc") is True

    # Numbers and symbols only
    assert _is_non_requirement("4.") is True
    assert _is_non_requirement("1.2") is True
    assert _is_non_requirement("a)") is True
    assert _is_non_requirement("•") is True
    assert _is_non_requirement("-") is True

    # URLs, links, emails
    assert _is_non_requirement("Ứng tuyển tại: https://company.com/jobs/123") is True
    assert _is_non_requirement("Gửi CV về email: hr@techcorp.vn") is True
    assert _is_non_requirement("Link ứng tuyển: bit.ly/apply-job") is True

    # Marketing and non-requirement fluff
    assert _is_non_requirement("Chúng tôi là công ty công nghệ hàng đầu...") is True
    assert _is_non_requirement("Chương trình thực tập sinh tài năng 2026") is True
    assert _is_non_requirement("Welcome to our engineering team") is True
    assert _is_non_requirement("Chế độ đãi ngộ hấp dẫn, lương tháng 13") is True

    # Valid requirements must NOT be filtered
    assert _is_non_requirement("Thành thạo Python và FastAPI") is False
    assert _is_non_requirement("Kinh nghiệm thiết kế RESTful API") is False
    assert _is_non_requirement("Tối thiểu 2 năm kinh nghiệm làm việc với React") is False


def test_clean_requirement_title_removes_headings_and_prefixes():
    assert _clean_requirement_title("### 4. Thành thạo Python") == "Thành thạo Python"
    assert _clean_requirement_title("- Yêu cầu bắt buộc: Kinh nghiệm Docker") == "Kinh nghiệm Docker"
    assert _clean_requirement_title("1. Trách nhiệm: Phát triển backend service") == "Phát triển backend service"
    assert _clean_requirement_title("### 4.") == ""
    assert _clean_requirement_title("https://apply.here.com") == ""


def test_cv_chunking_strictly_excludes_contact_and_header():
    # Contact text detection
    assert _is_contact_or_header_text("Nguyễn Văn A - nguyenvana@gmail.com - 0912345678") is True
    assert _is_contact_or_header_text("Địa chỉ: 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội") is True
    assert _is_contact_or_header_text("github.com/nguyenvana | linkedin.com/in/nguyenvana") is True
    assert _is_contact_or_header_text("Số điện thoại: 0987654321") is True
    assert _is_contact_or_header_text("Kinh nghiệm phát triển hệ thống microservices với FastAPI") is False

    # Chunking test
    cv_text = """Nguyễn Văn A
Email: nguyenvana@gmail.com | SĐT: 0912345678
Địa chỉ: Quận Cầu Giấy, Hà Nội
github.com/nguyenvana

TÓM TẮT CHUYÊN MÔN
Kỹ sư phần mềm 3 năm kinh nghiệm phát triển hệ thống backend.

KINH NGHIỆM LÀM VIỆC
Công ty ABC (2022 - 2024)
- Xây dựng API bằng FastAPI và PostgreSQL.
- Triển khai dịch vụ lên AWS ECS và quản lý Docker containers.
"""
    parsed_cv = {
        "_candidate_id": "cand_test_01",
        "summary": "Kỹ sư phần mềm 3 năm kinh nghiệm phát triển hệ thống backend.",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        "experience": [
            {
                "company": "Công ty ABC",
                "role": "Backend Engineer",
                "description": "Xây dựng API bằng FastAPI và PostgreSQL. Triển khai dịch vụ lên AWS ECS.",
            }
        ],
    }

    _, _, chunks = ChunkingService.build(cv_text, parsed_cv)

    # Ensure no chunk contains candidate email, phone, or pure contact info
    for chunk in chunks:
        text = chunk["text"]
        assert "nguyenvana@gmail.com" not in text
        assert "0912345678" not in text
        assert "Quận Cầu Giấy" not in text


def test_clean_requirement_title_language_codes():
    assert _clean_requirement_title("en") == "Tiếng Anh"
    assert _clean_requirement_title("vi") == "Tiếng Việt"
    assert _clean_requirement_title("ja") == "Tiếng Nhật"
    assert _clean_requirement_title("ko") == "Tiếng Hàn"
    assert _clean_requirement_title("zh") == "Tiếng Trung"
    assert _clean_requirement_title("### 4.") == ""
    assert _clean_requirement_title("### 5.") == ""
    assert _clean_requirement_title("null") == ""
    assert _clean_requirement_title("undefined") == ""


def test_atomic_requirement_normalizes_machine_value_before_scoring():
    parsed = {
        "title": "Backend Engineer",
        "job_level": None,
        "must_have_skills": [{"name": "### 4. Docker"}],
        "nice_to_have_skills": [],
        "language_requirements": [],
        "responsibilities": [],
        "education_requirements": [],
        "certifications": [],
        "domains": [],
    }
    requirements = _build_atomic_requirements(parsed, "Docker is required")
    assert requirements[0]["normalized_value"] == "Docker"
    assert requirements[0]["text"] == "Docker"


def test_extract_jd_specification_filters_markdown_and_empty():
    jd_raw = """
    # Tuyển dụng Senior Python Developer
    ### 1. Về chúng tôi
    Công ty ABC là tập đoàn công nghệ hàng đầu Việt Nam.

    ### 2. Mô tả công việc
    - Tham gia phát triển hệ thống backend xử lý dữ liệu lớn.
    - Thiết kế kiến trúc microservices sử dụng FastAPI và Redis.

    ### 3. Yêu cầu công việc
    - Tối thiểu 3 năm kinh nghiệm với Python.
    - Thành thạo PostgreSQL, Docker, AWS.
    - Có khả năng đọc hiểu tài liệu tiếng Anh.

    ### 4. Quyền lợi
    - Lương thưởng tháng 13, bảo hiểm sức khỏe.

    ### 5. Cách thức ứng tuyển
    - Gửi CV về email: hr@abc.vn hoặc nộp tại https://abc.vn/apply
    """
    parsed = parse_job_description(title="Senior Python Developer", requirements_text=jd_raw)
    requirements = _build_atomic_requirements(parsed, jd_raw)

    req_texts = [r["text"] for r in requirements]
    for text in req_texts:
        assert not text.startswith("###")
        assert "hr@abc.vn" not in text
        assert "https://" not in text
        assert "Về chúng tôi" not in text
        assert "Quyền lợi" not in text
        assert "Cách thức ứng tuyển" not in text
