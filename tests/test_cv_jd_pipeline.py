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

    assert {"JavaScript", "REST API"} <= set(result["hard_skills_matching"])
    assert result["hard_skills_partial"] == ["PostgreSQL"]
    postgres = next(item for item in result["requirement_evidence"] if item["requirement"] == "PostgreSQL")
    assert postgres["status"] == "partial"
    assert postgres["evidence"]


def test_mandatory_failure_warns_without_applying_a_score_cap():
    result = build_cv_jd_evidence(
        cv_text="Tôi sử dụng Python trong đồ án.",
        parsed_cv={"skills": ["Python"], "projects": [{"description": "Đồ án Python"}]},
        jd_title="Backend Developer",
        jd_requirements="Bắt buộc Python, FastAPI, Docker và Kubernetes.",
    )

    assert result["must_have_coverage"] < 0.5
    assert result["mandatory_requirement_failed"] is True
    assert result["must_have_gate"]["applied"] is False
    assert result["raw_match_score"] == result["match_score"]
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
