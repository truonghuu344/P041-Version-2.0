from __future__ import annotations

from src.services.cv_jd_matching import build_cv_jd_evidence, parse_job_description


def test_jd_parser_separates_must_have_and_nice_to_have_with_quotes():
    parsed = parse_job_description(
        title="Backend Developer",
        requirements_text=(
            "Yêu cầu bắt buộc: Python, FastAPI và PostgreSQL.\nPhát triển và duy trì REST API.\nDocker là một lợi thế."
        ),
    )

    must = {item["name"] for item in parsed["must_have_skills"]}
    nice = {item["name"] for item in parsed["nice_to_have_skills"]}

    assert {"Python", "FastAPI", "PostgreSQL", "REST API"} <= must
    assert nice == {"Docker"}
    assert all(item["evidence_quote"] for item in parsed["must_have_skills"])
    assert parsed["responsibilities"][0]["text"] == "Phát triển và duy trì REST API."


def test_pipeline_normalizes_aliases_and_marks_related_database_as_partial():
    result = build_cv_jd_evidence(
        cv_text="Xây dựng RESTful API bằng JS và lưu dữ liệu trong MySQL.",
        parsed_cv={"skills": ["JS", "MySQL"]},
        jd_title="Backend Developer",
        jd_requirements="Yêu cầu JavaScript, REST API và PostgreSQL.",
    )

    # A Skills-only declaration remains visible as partial evidence; it cannot
    # be promoted to a verified match without experience/project evidence.
    assert "JavaScript" in result["hard_skills_partial"]
    assert "PostgreSQL" in result["hard_skills_partial"]
    postgres = next(item for item in result["requirement_evidence"] if item["requirement"] == "PostgreSQL")
    assert postgres["status"] == "partial"
    assert postgres["evidence"]


def test_pipeline_matches_nodejs_from_direct_cv_evidence_despite_retrieval_miss():
    result = build_cv_jd_evidence(
        cv_text="Technologies: NextJS, TailwindCSS, Node.js, DynamoDB, Cloudinary, AI.",
        parsed_cv={"skills": ["NextJS", "Node.js", "AI"]},
        jd_title="NodeJS Developer",
        jd_requirements="Required Node.js and AI.",
    )

    node = next(item for item in result["requirement_evidence"] if item["requirement"] == "Node.js")
    assert node["status"] == "partial"
    assert any("Node.js" in item["quote"] for item in node["evidence"])


def test_jd_parser_does_not_turn_career_aspiration_into_requirement():
    parsed = parse_job_description(
        title="NodeJS Developer",
        requirements_text="Required Node.js. Aim to grow into a Junior → Middle NodeJS / Fullstack Developer.",
    )

    assert not any(
        "aim to grow" in str(item["text"]).lower()
        for item in parsed["requirements"]
    )


def test_mandatory_failure_limits_the_score_to_the_cap():
    result = build_cv_jd_evidence(
        cv_text="Tôi sử dụng Python trong đồ án.",
        parsed_cv={"skills": ["Python"], "projects": [{"description": "Đồ án Python"}]},
        jd_title="Backend Developer",
        jd_requirements="Bắt buộc Python, FastAPI, Docker và Kubernetes.",
    )

    assert result["must_have_coverage"] < 0.5
    assert result["mandatory_requirement_failed"] is True
    assert result["raw_match_score"] >= result["match_score"]
    assert result["match_score"] <= 49.0
    assert result["warnings"]
    assert result["match_level"] in {"partial_match", "low_match"}


def test_soft_skill_without_cv_evidence_is_unknown_not_a_negative_claim():
    result = build_cv_jd_evidence(
        cv_text="Phát triển ứng dụng bằng Python.",
        parsed_cv={"skills": ["Python"]},
        jd_title="Python Developer",
        jd_requirements="Yêu cầu Python và kỹ năng giao tiếp tốt.",
    )

    communication = next(item for item in result["requirement_evidence"] if item["requirement_type"] == "soft_skill")
    assert communication["status"] == "unknown"
    assert "Chưa có đủ bằng chứng" in communication["reason"]
    assert "soft_skills" not in result["score_breakdown"]


def test_pipeline_returns_explainable_versioned_output():
    result = build_cv_jd_evidence(
        cv_text="Backend Developer. Xây dựng REST API bằng Python và FastAPI.",
        parsed_cv={
            "skills": ["Python", "FastAPI", "REST API"],
            "projects": [{"id": "p1", "description": "Xây dựng REST API bằng Python và FastAPI."}],
            "ats_quality": {"score": 85},
        },
        jd_title="Junior Backend Developer",
        jd_requirements="Yêu cầu Python, FastAPI, REST API và Docker.",
    )

    assert result["pipeline_version"] == "1.0"
    assert 0 <= result["match_score"] <= 100
    assert 0 <= result["confidence_score"] <= 1
    assert result["requirement_evidence"]
    assert result["strengths"]
    assert result["risks"]
    assert all("reason" in item and "confidence" in item for item in result["requirement_evidence"])


def test_declared_skill_is_capped_without_experience_or_project_evidence():
    result = build_cv_jd_evidence(
        cv_text="Skills: Python",
        parsed_cv={"skills": ["Python"]},
        jd_title="Python Developer",
        jd_requirements="Python is required.",
    )

    python = next(item for item in result["requirement_evidence"] if item["requirement"] == "Python")
    assert python["status"] == "partial"
    assert python["score"] == 50.0
    assert result["match_score"] == 50.0


def test_skill_requires_experience_or_project_evidence_for_high_score():
    result = build_cv_jd_evidence(
        cv_text="Built Python APIs for an internal product.",
        parsed_cv={
            "skills": ["Python"],
            "projects": [{"description": "Built Python APIs for an internal product."}],
        },
        jd_title="Python Developer",
        jd_requirements="Python is required.",
    )

    python = next(item for item in result["requirement_evidence"] if item["requirement"] == "Python")
    assert python["status"] == "matched"
    assert python["score"] == 100.0


def test_missing_normal_required_preserves_score_without_hard_gate_cap():
    result = build_cv_jd_evidence(
        cv_text="Built backend APIs with Python and FastAPI.",
        parsed_cv={
            "skills": ["Python", "FastAPI"],
            "projects": [{"description": "Built backend APIs with Python and FastAPI."}],
        },
        jd_title="Backend Developer",
        jd_requirements="Python, FastAPI, and Kubernetes are required.",
    )

    assert result["mandatory_requirement_failed"] is True
    assert result["raw_match_score"] > 49.0
    # Normal REQUIRED does not artificially cap to 49.0 (only true hard gates cap)
    assert result["match_score"] >= 60.0
    assert result.get("hard_gate_failed") is False or not result.get("hard_gate_failed")


def test_missing_hard_gate_caps_score():
    result = build_cv_jd_evidence(
        cv_text="Kinh nghiệm 5 năm tư vấn pháp lý doanh nghiệp.",
        parsed_cv={
            "skills": ["Tư vấn pháp lý"],
            "projects": [{"description": "Tư vấn hợp đồng doanh nghiệp"}],
        },
        jd_title="Trưởng phòng Pháp chế",
        jd_requirements=(
            "Yêu cầu bắt buộc:\n"
            "- Tư vấn pháp lý doanh nghiệp\n"
            "- Bắt buộc phải có thẻ Luật sư do Bộ Tư pháp cấp\n"
        ),
    )

    assert result.get("hard_gate_failed") is True
    assert result["match_score"] <= 49.0
