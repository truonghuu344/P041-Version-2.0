from src.services.cv_jd_matching import parse_job_description
from src.services.cv_jd_pipeline import run_cv_jd_pipeline

SAMPLE_CV_DATA = {
    "candidate_name": "Nguyễn Văn A",
    "job_title": "Backend Developer",
    "skills": ["Python", "FastAPI", "PostgreSQL", "Git"],
    "experience": [
        {
            "role": "Python Developer",
            "company": "Tech Corp",
            "start_date": "2022-01-01",
            "end_date": "2024-01-01",
            "description": "Phát triển hệ thống backend bằng Python, FastAPI và PostgreSQL. Viết clean code và unit test.",
        }
    ],
    "projects": [
        {
            "name": "E-Commerce API",
            "role": "Backend Lead",
            "technologies": ["Python", "FastAPI", "Docker"],
            "description": "Xây dựng hệ thống API RESTful bằng FastAPI, đóng gói container bằng Docker.",
        }
    ],
    "education": [
        {
            "school": "Đại học Bách Khoa",
            "degree": "Cử nhân",
            "degree_level": "bachelor",
            "major": "Công nghệ Thông tin",
        }
    ],
    "languages": [
        {
            "language": "English",
            "proficiency": "Professional",
            "normalized_language": "English",
        }
    ],
}


def test_no_duplicate_skill_scoring():
    """Verify that Python and FastAPI are not double counted when appearing in compound sentence."""
    jd_text = """
    Vị trí: Senior Python Developer
    Yêu cầu bắt buộc (Must-Have):
    - Thành thạo các công nghệ cốt lõi: Python, FastAPI
    - Thành thạo PostgreSQL và Redis
    - Có tối thiểu 3 năm kinh nghiệm lập trình backend
    """
    parsed = parse_job_description(title="Senior Python Developer", requirements_text=jd_text)
    reqs = parsed["requirements"]

    # Python & FastAPI should exist as individual skills
    skill_reqs = [r for r in reqs if r.get("group") == "skills"]
    skill_names = {r["text"] for r in skill_reqs}
    assert "Python" in skill_names
    assert "FastAPI" in skill_names

    # The compound sentence must NOT appear as a duplicate requirement
    compound_sentences = [
        r for r in reqs
        if "Thành thạo các công nghệ cốt lõi" in r.get("text", "")
        or "công nghệ cốt lõi" in r.get("text", "").lower()
    ]
    assert len(compound_sentences) == 0, "Compound skill sentence was duplicated as a separate requirement!"


def test_no_duplicate_microservices_cloud_scoring():
    """Verify AWS, GCP, Microservices are not double counted in compound sentence."""
    jd_text = """
    Vị trí: Backend Engineer
    Yêu cầu ưu tiên (Nice-To-Have):
    - Có kinh nghiệm với hệ thống phân tán (Microservices) hoặc điện toán đám mây (AWS / GCP / Cloudflare)
    """
    parsed = parse_job_description(title="Backend Engineer", requirements_text=jd_text)
    reqs = parsed["requirements"]

    # Compound sentence must not be duplicated into responsibilities or other requirements
    other_and_resp = [
        r for r in reqs
        if r.get("group") in {"responsibilities_task_fit", "certifications_languages_other"}
        and "hệ thống phân tán" in r.get("text", "").lower()
    ]
    assert len(other_and_resp) == 0, "Compound cloud/microservices sentence was duplicated!"


def test_experience_only_in_experience_group():
    """Verify experience requirement is strictly in experience_seniority group and not leaked to other groups."""
    jd_text = """
    Vị trí: Python Developer
    Yêu cầu:
    - Tối thiểu 2-3 năm kinh nghiệm thực tế trong vai trò Backend Developer
    - Tốt nghiệp Đại học chuyên ngành CNTT
    - Tiếng Anh giao tiếp tốt
    """
    parsed = parse_job_description(title="Python Developer", requirements_text=jd_text)
    reqs = parsed["requirements"]

    exp_reqs = [r for r in reqs if r.get("group") == "experience_seniority"]
    assert len(exp_reqs) >= 1
    assert exp_reqs[0]["requirement_type"] == "JD_EXPERIENCE"

    # Ensure no experience requirement leaked into certifications_languages_other
    other_exp = [
        r for r in reqs
        if r.get("group") == "certifications_languages_other"
        and ("kinh nghiệm" in r.get("text", "").lower() or "năm" in r.get("text", "").lower())
    ]
    assert len(other_exp) == 0, "Experience leaked into certifications_languages_other!"


def test_metadata_not_scoreable():
    """Verify work mode, location metadata and default values never enter scoreable requirements."""
    jd_text = """
    Vị trí: Fullstack Developer
    Địa điểm: Hà Nội (Hybrid)
    Hình thức: Toàn thời gian
    Yêu cầu:
    - Thành thạo JavaScript, Node.js
    """
    parsed = parse_job_description(
        title="Fullstack Developer",
        requirements_text=jd_text,
        metadata={"location": "Hà Nội", "remote_type": "hybrid", "employment_type": "full-time"}
    )
    reqs = parsed["requirements"]

    scoreable_reqs = [r for r in reqs if not r.get("is_hard_constraint") and r.get("type") != "HARD_CONSTRAINT"]
    scoreable_texts = {r["text"].lower() for r in scoreable_reqs}

    assert "hybrid" not in scoreable_texts
    assert "hà nội" not in scoreable_texts
    assert "chưa xác định" not in scoreable_texts
    assert "khác" not in scoreable_texts


def test_non_requirement_content_excluded():
    """Verify benefits, perks, equipment, lunch allowance, company culture never enter scoreable requirements."""
    jd_text = """
    Vị trí: Backend Engineer
    Giới thiệu công ty:
    - Về chúng tôi: Công ty công nghệ hàng đầu với môi trường trẻ trung, năng động.
    Quyền lợi & Đãi ngộ:
    - Mức lương hấp dẫn lên tới 2500$ + thưởng tháng 13 + thưởng KPI
    - Cung cấp MacBook Pro M3 và thiết bị làm việc hiện đại
    - Phụ cấp ăn trưa, trà, cà phê, snack miễn phí
    - Du lịch hàng năm (Company trip), khám sức khỏe định kỳ
    - Đóng đầy đủ BHXH, BHYT, BHTN theo luật
    Quy trình tuyển dụng & Nộp hồ sơ:
    - Cách thức ứng tuyển: Gửi CV về hr@company.com
    Yêu cầu công việc:
    - Thành thạo Python, FastAPI
    - Tối thiểu 2 năm kinh nghiệm
    """
    parsed = parse_job_description(title="Backend Engineer", requirements_text=jd_text)
    reqs = parsed["requirements"]

    for r in reqs:
        text_lower = r["text"].lower()
        assert "macbook" not in text_lower
        assert "ăn trưa" not in text_lower
        assert "mức lương" not in text_lower
        assert "thưởng tháng 13" not in text_lower
        assert "bhxh" not in text_lower
        assert "du lịch" not in text_lower
        assert "gửi cv" not in text_lower
        assert "về chúng tôi" not in text_lower


def test_garbage_numeric_cleaned():
    """Verify long crawler/timestamp numeric sequences are cleaned from requirement titles."""
    jd_text = """
    Vị trí: Python Developer
    Yêu cầu:
    - Tối thiểu 3 năm kinh nghiệm trong vai trò 1787577430444 4867317802322134103 234234234
    - Thành thạo Python
    """
    parsed = parse_job_description(title="Python Developer", requirements_text=jd_text)
    reqs = parsed["requirements"]

    for r in reqs:
        assert "1787577430444" not in r["text"]
        assert "4867317802322134103" not in r["text"]


def test_responsibility_normalization():
    """Verify verbose responsibility fluff is normalized into concise task titles."""
    jd_text = """
    Vị trí: Backend Architect
    Trách nhiệm công việc:
    - Chủ trì và tham gia phân tích, thiết kế kiến trúc hệ thống cho các tính năng mới
    - Phát triển mã nguồn chất lượng cao, tuân thủ các tiêu chuẩn clean code, testing và bảo mật
    - Tối ưu hóa hiệu năng hệ thống và cơ sở dữ liệu
    """
    parsed = parse_job_description(title="Backend Architect", requirements_text=jd_text)
    reqs = parsed["requirements"]
    resp_reqs = [r for r in reqs if r.get("group") == "responsibilities_task_fit"]

    resp_texts = {r["text"] for r in resp_reqs}
    assert "Phân tích và thiết kế kiến trúc hệ thống" in resp_texts
    assert "Clean code, testing và bảo mật" in resp_texts
    assert "Tối ưu hiệu năng hệ thống và CSDL" in resp_texts




def test_pipeline_evidence_and_score_consistency():
    """Verify that match pipeline runs cleanly, evidence distinguishes mention vs experience, and no vague text is generated."""
    jd_text = """
    Vị trí: Python Backend Developer
    Yêu cầu bắt buộc:
    - Thành thạo Python, FastAPI
    - Tối thiểu 3 năm kinh nghiệm
    - Thành thạo Docker
    Yêu cầu ưu tiên:
    - Có kinh nghiệm với Redis
    """
    parsed_jd = parse_job_description(title="Python Backend Developer", requirements_text=jd_text)
    result = run_cv_jd_pipeline(
        cv_text="Nguyễn Văn A - Backend Developer\nPython, FastAPI, Docker, PostgreSQL\n2 năm kinh nghiệm làm việc tại Tech Corp.\nDự án E-Commerce API bằng FastAPI và Docker.",
        parsed_cv=SAMPLE_CV_DATA,
        job_id="job_py_01",
        requirements=parsed_jd["requirements"],
    )

    evaluated = result.get("evaluated_requirements", [])
    assert len(evaluated) > 0

    for item in evaluated:
        comparison = item.get("comparison", "")
        # No vague placeholder text
        assert "Chưa tìm thấy bằng chứng cụ thể trong CV" not in comparison
        assert "Không đủ bằng chứng" not in comparison

        # Check Python evidence: CV has real experience in work & project
        if item.get("text") == "Python":
            assert item.get("match_status") == "MATCHED"
            assert "kinh nghiệm" in comparison or "đề cập" in comparison

        # Check Docker evidence: CV has project experience with Docker
        if item.get("text") == "Docker":
            assert item.get("match_status") == "MATCHED"
            assert "dự án" in comparison or "kinh nghiệm" in comparison

        # Check Redis: missing from CV
        if item.get("text") == "Redis":
            assert item.get("match_status") == "NOT_FOUND"
            assert "không đề cập" in comparison


def test_partial_matches_cannot_collapse_to_zero_score():
    """Regression test: verify that a result containing partially supported items never collapses to 0%."""
    from src.services.cv_jd_matching import build_cv_jd_evidence

    cv_text = """
    Nguyen Van B
    SKILLS: Docker, Python, Git
    PROJECTS:
    IVORA Wedding Platform
    Built frontend using React and NextJS.
    STRENGTHS:
    Problem Solving: strong analytical thinking and resolving production incidents.
    """
    parsed_cv = {
        "candidate_name": "Nguyen Van B",
        "skills": ["Docker", "Python", "Git"],
        "summary": "Problem Solving: strong analytical thinking and resolving production incidents.",
        "projects": [
            {
                "title": "IVORA Wedding Platform",
                "description": "Built frontend using React and NextJS.",
                "evidence_quote": "Built frontend using React and NextJS.",
            }
        ],
    }
    jd_title = "Backend Developer"
    jd_requirements = """
    Vị trí: Backend Developer
    Yêu cầu bắt buộc:
    - Docker
    - Giải quyết vấn đề
    Yêu cầu ưu tiên:
    - Kubernetes
    """
    res = build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title=jd_title,
        jd_requirements=jd_requirements,
    )
    assert res["final_score"] > 0.0
    assert res["raw_final_score"] > 0.0

    req_statuses = {item["requirement"]: item["status"] for item in res["requirement_evidence"]}
    # Docker is in skills -> partial or matched
    assert req_statuses.get("Docker") in {"partial", "matched"}
    # Problem solving / Giai quyet van de -> matched or partial
    assert req_statuses.get("giải quyết vấn đề") in {"matched", "partial"}


def test_score_explainability_consistency():
    """Verify that score_explanation, category_score_explanation, and requirements match final_score exactly."""
    from src.services.cv_jd_matching import build_cv_jd_evidence

    cv_text = """
    Nguyen Van C
    SKILLS: Python, FastAPI, Docker
    EXPERIENCE:
    2 years developing backend services with Python and FastAPI at Startup ABC.
    STRENGTHS:
    Strong logical thinking and teamwork.
    """
    parsed_cv = {
        "candidate_name": "Nguyen Van C",
        "skills": ["Python", "FastAPI", "Docker"],
        "summary": "Strong logical thinking and teamwork.",
        "experience": [
            {
                "role": "Backend Engineer",
                "company": "Startup ABC",
                "start_date": "2022-01-01",
                "end_date": "2024-01-01",
                "description": "Developing backend services with Python and FastAPI.",
            }
        ],
    }
    jd_title = "Senior AI & Backend Engineer"
    jd_requirements = """
    Vị trí: Senior AI & Backend Engineer
    Yêu cầu bắt buộc:
    - Python
    - FastAPI
    - Computer Vision
    - Tối thiểu 3 năm kinh nghiệm
    Yêu cầu ưu tiên:
    - Docker
    - Kubernetes
    """
    res = build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title=jd_title,
        jd_requirements=jd_requirements,
    )

    res["final_score"]
    score_exp = res.get("score_explanation", {})
    assert score_exp, "score_explanation must be present in match result"
    assert "positive_contributions" in score_exp
    assert "partial_contributions" in score_exp
    assert "lost_points" in score_exp

    # Check that score_explanation.earned_points matches sum of criteria weighted_score
    criteria = res.get("criteria", [])
    criteria_sum = round(sum(c.get("weighted_score", 0.0) for c in criteria), 1)
    # Check that score_explanation earned points is consistent with final_score (or raw score before gate)
    assert abs(score_exp["earned_points"] - criteria_sum) <= 0.5

    # Check category_score_explanation
    cat_exp = res.get("category_score_explanation", [])
    assert len(cat_exp) > 0
    cat_earned_sum = round(sum(c["earned_points"] for c in cat_exp), 1)
    assert abs(cat_earned_sum - score_exp["earned_points"]) <= 0.5

    # Check canonical requirement_summary
    req_summary = res.get("requirement_summary", {})
    assert req_summary["total"] == (
        req_summary["supported"] + req_summary["partial"] + req_summary["missing"] + req_summary["uncertain"]
    )

    # Check positive_contributions sorted DESC
    pos = score_exp["positive_contributions"]
    for i in range(len(pos) - 1):
        assert pos[i]["contribution"] >= pos[i + 1]["contribution"]

    # Check lost_points sorted DESC
    lost = score_exp["lost_points"]
    for i in range(len(lost) - 1):
        assert lost[i]["lost"] >= lost[i + 1]["lost"]

    # Check structured strengths and blockers
    assert len(res.get("structured_strengths", [])) <= 5
    assert len(res.get("structured_blockers", [])) <= 5

    # Missing mandatory requirement (Computer Vision / Experience) should be top blockers
    blocker_titles = [b["title"].lower() for b in res.get("structured_blockers", [])]
    assert any("computer vision" in t or "kinh nghiệm" in t for t in blocker_titles)


def test_canonical_requirement_classification_and_filtering():
    """Verify classification of scorable requirements vs non-scorable marketing/benefits."""
    from src.services.cv_jd_matching import _is_non_requirement, classify_jd_fragment

    # Non-scorable samples
    non_scorable_samples = [
        "VinSmart Future là công ty công nghệ thuộc tập đoàn VinGroup chuyên phát triển các sản phẩm thông minh",
        "Chương trình Internship được thiết kế nhằm mang đến cơ hội cho sinh viên năm cuối trải nghiệm thực tế",
        "Được đào tạo và phát triển nghề nghiệp trong môi trường chuyên nghiệp",
        "Có cơ hội hỗ trợ thi chứng chỉ quốc tế",
        "Website công ty để tham khảo thêm thông tin: https://vinsmart.vn",
        "Ứng tuyển qua email hr@vinsmart.vn trước ngày 30/09",
        "Quyền lợi được hưởng: Lương tháng 13, bảo hiểm full lương, teambuilding hàng năm",
        "Về chúng tôi: Tiên phong trong lĩnh vực công nghệ",
    ]

    for sample in non_scorable_samples:
        cat, is_scorable = classify_jd_fragment(sample)
        assert not is_scorable, f"Sample should NOT be scorable: '{sample}' (classified as {cat})"
        assert _is_non_requirement(sample), f"_is_non_requirement failed for: '{sample}'"

    # Scorable samples
    scorable_samples = [
        ("Computer Vision", "technical_skill"),
        ("Python", "technical_skill"),
        ("Tư duy logic", "soft_skill"),
        ("Làm việc nhóm", "soft_skill"),
        ("Tối thiểu 2 năm kinh nghiệm", "experience"),
        ("Có thể làm việc on-site tại văn phòng", "work_condition"),
        ("Tiếng Anh đọc hiểu tài liệu kỹ thuật", "language"),
        ("Phân tích và thiết kế kiến trúc hệ thống", "responsibility"),
        ("Tốt nghiệp Đại học chuyên ngành CNTT", "education"),
    ]

    for sample, expected_cat in scorable_samples:
        cat, is_scorable = classify_jd_fragment(sample)
        assert is_scorable, f"Sample should BE scorable: '{sample}' (classified as {cat})"
        assert not _is_non_requirement(sample), f"_is_non_requirement returned True for scorable: '{sample}'"


def test_real_polluted_jd_match_invariants_and_blocker_quality():
    """Test full pipeline with heavily polluted real-world JD containing company intros, internship copy, and benefits."""
    from src.services.cv_jd_matching import build_cv_jd_evidence

    cv_text = """
    Nguyen Van A
    Kỹ sư phần mềm với 2 năm kinh nghiệm phát triển Python, FastAPI và SQL.
    Kỹ năng: Python, FastAPI, PostgreSQL, Git, Tư duy logic, Làm việc nhóm.
    Kinh nghiệm:
    2022 - 2024: Backend Developer tại ABC Tech, phát triển hệ thống RESTful API và tối ưu database.
    Học vấn:
    Cử nhân Công nghệ Thông tin - Đại học Bách Khoa Hà Nội.
    """
    parsed_cv = {
        "candidate_name": "Nguyen Van A",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Git", "Tư duy logic", "Làm việc nhóm"],
        "summary": "Kỹ sư phần mềm với 2 năm kinh nghiệm phát triển Python, FastAPI và SQL.",
        "experience": [
            {
                "role": "Backend Developer",
                "company": "ABC Tech",
                "start_date": "2022-01-01",
                "end_date": "2024-01-01",
                "duration_months": 24,
                "description": "Phát triển hệ thống RESTful API và tối ưu database.",
            }
        ],
        "education": [
            {
                "degree": "Cử nhân",
                "degree_level": "bachelor",
                "school": "Đại học Bách Khoa Hà Nội",
                "major": "Công nghệ Thông tin",
            }
        ],
    }

    # Polluted JD with company intro, internship description, training benefit, website, application instructions
    jd_title = "Computer Vision & Python Intern"
    jd_requirements = """
    # Tuyển dụng Computer Vision & Python Intern

    1. Giới thiệu công ty:
    VinSmart Future là công ty công nghệ thuộc tập đoàn VinGroup tiên phong trong lĩnh vực AI.
    Chương trình Internship được thiết kế nhằm mang đến cơ hội cho sinh viên trải nghiệm thực tế.

    2. Mô tả công việc:
    - Phát triển API và dịch vụ Backend xử lý dữ liệu
    - Tối ưu hiệu năng hệ thống và CSDL

    3. Yêu cầu ứng viên:
    - Thành thạo Python (Bắt buộc)
    - Có kiến thức về Computer Vision (Bắt buộc)
    - Tối thiểu 1 năm kinh nghiệm hoặc dự án tương đương
    - Có khả năng tư duy logic và làm việc nhóm tốt

    4. Quyền lợi:
    - Được đào tạo và phát triển nghề nghiệp từ các chuyên gia
    - Cơ hội hỗ trợ thi chứng chỉ quốc tế
    - Phụ cấp thực tập hấp dẫn, ăn trưa tại công ty, gửi xe miễn phí

    5. Hướng dẫn ứng tuyển:
    Website công ty để tham khảo: https://vinsmart.vn
    Ứng tuyển qua email hr@vinsmart.vn trước 30/12/2026.
    """

    res = build_cv_jd_evidence(
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        jd_title=jd_title,
        jd_requirements=jd_requirements,
    )

    # Invariant 1: Final score arithmetic consistency
    criteria = res.get("criteria", [])
    total_weights = round(sum(c.get("weight", 0.0) for c in criteria), 1)
    total_weighted_scores = round(sum(c.get("weighted_score", 0.0) for c in criteria), 1)
    assert abs(total_weights - 100.0) <= 0.5, f"Criteria weights sum {total_weights} != 100.0"
    assert abs(res["final_score"] - total_weighted_scores) <= 0.5, f"Final score {res['final_score']} != {total_weighted_scores}"

    # Invariant 2: Blocker Quality Regression Assertion
    # All blockers must come strictly from scorable candidate requirements
    structured_blockers = res.get("structured_blockers", [])
    assert len(structured_blockers) > 0, "Should have at least one blocker (Computer Vision missing)"
    for blocker in structured_blockers:
        assert blocker.get("is_scorable") is True, f"Blocker is not marked scorable: {blocker}"
        b_title = blocker.get("title", "").lower()
        # Non-scorable markers must NEVER appear in blockers
        assert "vinsmart" not in b_title, "Company intro leaked into blockers!"
        assert "chuong trinh internship" not in b_title, "Internship description leaked into blockers!"
        assert "duoc dao tao" not in b_title, "Training benefit leaked into blockers!"
        assert "chung chi" not in b_title or "ho tro" not in b_title, "Subsidized cert leaked into blockers!"
        assert "website" not in b_title, "Website leaked into blockers!"
        assert "ung tuyen" not in b_title, "Application instruction leaked into blockers!"

    # Invariant 3: Top blocker must be Computer Vision (mandatory missing skill)
    top_blocker_title = structured_blockers[0]["title"].lower()
    assert "computer vision" in top_blocker_title, f"Top blocker should be Computer Vision, got '{top_blocker_title}'"

    # Invariant 4: Strengths must not contain company info/benefits
    for strength in res.get("structured_strengths", []):
        s_title = strength.get("title", "").lower()
        assert "vinsmart" not in s_title
        assert "duoc dao tao" not in s_title
        assert "quyen loi" not in s_title

    # Invariant 5: Requirement summary consistency
    req_summary = res["requirement_summary"]
    assert req_summary["total"] == (
        req_summary["supported"] + req_summary["partial"] + req_summary["missing"] + req_summary["uncertain"]
    )



