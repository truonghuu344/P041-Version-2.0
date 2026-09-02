from __future__ import annotations

from src.services.cv_jd_matching import (
    build_cv_jd_evidence,
    classify_jd_sentence,
    parse_job_description,
)
from src.services.semantic_relations import match_semantic_relation


def test_scenario_a_cicd_with_kubernetes_only():
    """Scenario A: JD has CI/CD, CV has Kubernetes only -> ADJACENT / partial, not full match, not no-evidence."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm vận hành và bảo trì cụm Kubernetes cluster cho hệ thống microservices.",
        parsed_cv={
            "skills": ["Kubernetes"],
            "projects": [{"title": "Cloud Infra", "description": "Vận hành cụm Kubernetes cluster cho hệ thống microservices."}],
        },
        jd_title="DevOps Engineer",
        jd_requirements="Bắt buộc có kinh nghiệm CI/CD pipeline.",
    )

    cicd_req = next(
        (item for item in result["requirement_evidence"] if "ci/cd" in item["requirement"].lower() or "ci cd" in item["requirement"].lower()),
        None,
    )
    assert cicd_req is not None
    assert cicd_req["status"] == "partial"
    assert cicd_req["match_classification"] == "ADJACENT"
    assert "Kubernetes" in cicd_req["reason"]
    assert "chưa đủ bằng chứng" in cicd_req["reason"].lower() or "pipeline" in cicd_req["reason"].lower()
    assert "CV không đề cập CI/CD" not in cicd_req["reason"]


def test_scenario_b_rest_api_inferred_from_fastapi_endpoints():
    """Scenario B: JD has REST API, CV has 'Built GET/POST endpoints with FastAPI' -> INFERRED semantic support."""
    result = build_cv_jd_evidence(
        cv_text="Built GET/POST endpoints with FastAPI for authentication and payments service.",
        parsed_cv={
            "skills": ["FastAPI", "Python"],
            "projects": [{"title": "Auth API", "description": "Built GET/POST endpoints with FastAPI for authentication and payments service."}],
        },
        jd_title="Backend Developer",
        jd_requirements="Yêu cầu thành thạo phát triển REST API.",
    )

    rest_req = next(
        (item for item in result["requirement_evidence"] if "rest api" in item["requirement"].lower()),
        None,
    )
    assert rest_req is not None
    assert rest_req["status"] == "matched"
    assert rest_req["match_classification"] == "INFERRED"
    assert rest_req["score"] >= 80.0


def test_scenario_c_computer_vision_not_satisfied_by_generic_ai():
    """Scenario C: JD has Computer Vision, CV has only generic AI experience -> NO_EVIDENCE."""
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm phát triển ứng dụng AI và Machine Learning sử dụng Scikit-learn.",
        parsed_cv={
            "skills": ["AI", "Machine Learning", "Scikit-learn"],
            "projects": [{"title": "AI Project", "description": "Xây dựng mô hình AI và Machine Learning dự đoán churn."}],
        },
        jd_title="AI Engineer",
        jd_requirements="Bắt buộc có kinh nghiệm với Computer Vision.",
    )

    cv_req = next(
        (item for item in result["requirement_evidence"] if "computer vision" in item["requirement"].lower() or "thị giác" in item["requirement"].lower()),
        None,
    )
    assert cv_req is not None
    assert cv_req["status"] == "missing"
    assert cv_req["match_classification"] in {"NO_EVIDENCE", "NOT_FOUND"}
    assert cv_req["score"] == 0.0


def test_scenario_d_teamwork_not_satisfied_by_logical_thinking():
    """Scenario D: JD has teamwork, CV has 'Strong logical thinking' -> NO_EVIDENCE (anti-reuse)."""
    result = build_cv_jd_evidence(
        cv_text="Strong logical thinking and analytical skills in algorithmic problem solving.",
        parsed_cv={
            "summary": "Strong logical thinking and analytical skills in algorithmic problem solving.",
            "skills": ["Logical Thinking"],
        },
        jd_title="Software Engineer",
        jd_requirements="Yêu cầu kỹ năng làm việc nhóm tốt (teamwork).",
    )

    team_req = next(
        (item for item in result["requirement_evidence"] if "teamwork" in item["requirement"].lower() or "làm việc nhóm" in item["requirement"].lower()),
        None,
    )
    assert team_req is not None
    assert team_req["status"] in {"missing", "unknown"}
    assert team_req["match_classification"] in {"NO_EVIDENCE", "NOT_FOUND"}
    assert team_req["score"] == 0.0


def test_scenario_e_logical_thinking_matched_when_mentioned():
    """Scenario E: JD has logical thinking, CV has 'Strong logical thinking' -> MATCHED / SUPPORTED."""
    result = build_cv_jd_evidence(
        cv_text="Strong logical thinking and analytical skills in algorithmic problem solving.",
        parsed_cv={
            "summary": "Strong logical thinking and analytical skills in algorithmic problem solving.",
            "skills": ["Logical Thinking"],
            "projects": [{"title": "Algo", "description": "Applied logical thinking to design optimal graph traversal algorithms."}],
        },
        jd_title="Software Engineer",
        jd_requirements="Yêu cầu tư duy logic tốt.",
    )

    logic_req = next(
        (item for item in result["requirement_evidence"] if "logic" in item["requirement"].lower()),
        None,
    )
    assert logic_req is not None
    assert logic_req["status"] in {"matched", "partial"}
    assert logic_req["score"] >= 50.0


def test_scenario_f_english_cv_contextual_evidence():
    """Scenario F: JD has English, CV is written in English without IELTS certificate -> INFERRED / Contextual support."""
    result = build_cv_jd_evidence(
        cv_text=(
            "John Doe - Senior Software Engineer\n"
            "Summary: Experienced backend engineer specializing in distributed systems and cloud architecture.\n"
            "Experience:\n"
            "Software Engineer at Tech Corp (2022 - Present)\n"
            "Developed scalable microservices using Python, Docker, and PostgreSQL.\n"
            "Designed and implemented REST APIs for user authentication and billing."
        ),
        parsed_cv={
            "candidate_name": "John Doe",
            "skills": ["Python", "Docker", "PostgreSQL"],
            "experience": [
                {
                    "title": "Software Engineer",
                    "company": "Tech Corp",
                    "description": "Developed scalable microservices using Python, Docker, and PostgreSQL.",
                }
            ],
        },
        jd_title="Backend Engineer",
        jd_requirements="Yêu cầu tiếng Anh giao tiếp tốt trong công việc.",
    )

    en_req = next(
        (item for item in result["requirement_evidence"] if "tiếng anh" in item["requirement"].lower() or "english" in item["requirement"].lower()),
        None,
    )
    assert en_req is not None
    assert en_req["status"] in {"partial", "matched", "unknown"}
    assert "tiếng anh" in en_req["reason"].lower() or "english" in en_req["reason"].lower()
    assert "CV không đề cập Tiếng Anh" not in en_req["reason"]


def test_scenario_g_employer_branding_and_marketing_excluded():
    """Scenario G: Employer culture, marketing questions, and branding are excluded from requirements."""
    jd_text = (
        "Vị trí: AI Engineer\n"
        "Bạn yêu thích trí tuệ nhân tạo và mong muốn phát triển sự nghiệp trong AI/ML?\n"
        "Trải nghiệm môi trường trẻ trung, sáng tạo và văn hóa doanh nghiệp đặc sắc tại công ty chúng tôi!\n"
        "Yêu cầu công việc:\n"
        "- Thành thạo Python\n"
        "- Có kinh nghiệm với PyTorch\n"
        "Quyền lợi:\n"
        "- Cung cấp MacBook Pro M3\n"
        "- Thưởng tháng 13 và bảo hiểm sức khỏe VIP\n"
    )

    parsed = parse_job_description(title="AI Engineer", requirements_text=jd_text)
    reqs = parsed.get("requirements", [])
    req_texts = [r.get("text", "") for r in reqs]

    assert not any("trẻ trung" in t.lower() or "môi trường" in t.lower() for t in req_texts)
    assert not any("yêu thích trí tuệ nhân tạo" in t.lower() for t in req_texts)
    assert not any("macbook" in t.lower() or "thưởng" in t.lower() for t in req_texts)


def test_scenario_h_markdown_headings_excluded():
    """Scenario H: Markdown headings such as '## YÊU CẦU ỨNG TUYỂN' are excluded."""
    cat, is_scorable = classify_jd_sentence("## YÊU CẦU ỨNG TUYỂN")
    assert cat == "HEADING"
    assert is_scorable is False

    cat2, is_scorable2 = classify_jd_sentence("### 2. Trách nhiệm chính")
    assert cat2 == "HEADING"
    assert is_scorable2 is False


def test_scenario_i_multiple_aliases_deduplicated():
    """Scenario I: AI, Artificial Intelligence, AI/ML deduplicate to a single concept."""
    jd_text = (
        "Yêu cầu công việc:\n"
        "- Kinh nghiệm về AI\n"
        "- Hiểu biết về Artificial Intelligence và AI/ML\n"
        "- Thành thạo Python\n"
    )
    parsed = parse_job_description(title="AI Developer", requirements_text=jd_text)
    reqs = parsed.get("requirements", [])

    ai_reqs = [r for r in reqs if r.get("canonical_name") in {"AI", "AI/ML", "Artificial Intelligence"}]
    # Should deduplicate down to at most 1 or 2 canonical entries, not 3 duplicate ones
    assert len(ai_reqs) <= 2


def test_scenario_j_unsupported_soft_skills_rejected():
    """Scenario J: A CV summary mentioning only problem solving rejects teamwork and responsibility."""
    res_teamwork = match_semantic_relation(
        target_requirement="Teamwork",
        cv_text="Passionate developer with strong analytical and problem solving skills in Python.",
    )
    assert res_teamwork["classification"] == "NO_EVIDENCE"
    assert res_teamwork["score_factor"] == 0.0

    res_problem = match_semantic_relation(
        target_requirement="Problem Solving",
        cv_text="Passionate developer with strong analytical and problem solving skills in Python.",
    )
    assert res_problem["classification"] in {"DIRECT", "EQUIVALENT"}
    assert res_problem["score_factor"] > 0.0
