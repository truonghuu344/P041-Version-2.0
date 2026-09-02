"""Comprehensive test suite for the Dynamic JD-Driven CV-JD Matching & Scoring System (6-group taxonomy)."""

import pytest

from src.services.cv_jd_matching import (
    _build_atomic_requirements,
    _infer_importance,
    parse_job_description,
)
from src.services.cv_jd_pipeline import (
    calculate_requirement_weights,
    run_cv_jd_pipeline,
)
from src.services.job_recommendations.mandatory_gate import apply_mandatory_gate

CV_SAMPLE_BACKEND = """
NGUYỄN VĂN AN
Backend Engineer
Hà Nội, Việt Nam

TÓM TẮT CHUYÊN MÔN
Kỹ sư phần mềm với 3 năm kinh nghiệm phát triển backend bằng Python, FastAPI, PostgreSQL và Redis.

KINH NGHIỆM LÀM VIỆC
Công ty ABC (01/2023 - Hiện tại) - Backend Developer
- Thiết kế và triển khai RESTful API sử dụng FastAPI và PostgreSQL.
- Tối ưu hóa truy vấn cơ sở dữ liệu, thiết kế hệ thống caching với Redis.
- Triển khai ứng dụng container hóa bằng Docker và CI/CD trên GitLab.

Công ty XYZ (01/2022 - 12/2022) - Junior Python Developer
- Phát triển API backend với Python và Django.
- Viết unit test và tích hợp cơ sở dữ liệu PostgreSQL.

HỌC VẤN
Đại học Bách Khoa Hà Nội (2017 - 2021)
Cử nhân Công nghệ Thông tin

KỸ NĂNG
Python, FastAPI, Django, PostgreSQL, Redis, Docker, Git, REST API
"""


def test_six_groups_and_dynamic_weights_when_group_missing():
    """Test that 6-group taxonomy is used and inactive groups have 0 weight without penalizing candidate."""
    jd_text = """
    Tuyển dụng Python Developer
    Yêu cầu:
    - Thành thạo Python, FastAPI (bắt buộc)
    - Ưu tiên biết AWS, Docker
    - Tối thiểu 2 năm kinh nghiệm backend
    - Trách nhiệm: Xây dựng RESTful API và tối ưu database
    """
    parsed_jd = parse_job_description(title="Python Developer", requirements_text=jd_text)
    atomic_reqs = _build_atomic_requirements(parsed_jd, jd_text)

    # Verify 6-group taxonomy
    groups_present = {r.get("group") for r in atomic_reqs}
    assert "skills" in groups_present
    assert "experience_seniority" in groups_present
    assert "responsibilities_task_fit" in groups_present

    # Verify priority/type representation in skills group
    skill_types = {r.get("type") for r in atomic_reqs if r.get("group") == "skills"}
    assert "REQUIRED" in skill_types
    assert "PREFERRED" in skill_types

    parsed_cv = {
        "summary": "3 năm kinh nghiệm Python FastAPI PostgreSQL",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"],
        "experience": [
            {
                "title": "Backend Developer",
                "start_date": "2022-01",
                "end_date": "2025-01",
                "description": "Lập trình backend bằng Python, FastAPI, xây dựng RESTful API và tối ưu database PostgreSQL.",
            }
        ],
    }

    result = run_cv_jd_pipeline(
        cv_text=CV_SAMPLE_BACKEND,
        parsed_cv=parsed_cv,
        job_id="JOB_TEST_01",
        requirements=atomic_reqs,
    )

    criteria = result["criteria"]
    # Total weight must always sum to 100%
    total_weight = sum(c["weight"] for c in criteria)
    assert pytest.approx(total_weight, 0.1) == 100.0

    # Inactive groups must have 0 weight in groups list
    for g in result["groups"]:
        if not g["active"]:
            assert g["weight"] == 0.0


def test_preferred_vs_required_skills_in_skills_group():
    """Test that REQUIRED skills (importance 3) and PREFERRED skills (importance 1) are both in group 'skills'."""
    requirements = [
        {"requirement_id": "REQ_PY", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_AWS", "requirement_type": "JD_PREFERRED_SKILL", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": "AWS", "normalized_value": "aws", "mandatory": False},
    ]

    # CV has Python but not AWS
    parsed_cv = {
        "skills": ["Python"],
        "experience": [{"title": "Dev", "start_date": "2023-01", "end_date": "2024-01", "description": "Python dev"}]
    }

    result = run_cv_jd_pipeline(
        cv_text="Python dev",
        parsed_cv=parsed_cv,
        job_id="JOB_TEST_SKILLS",
        requirements=requirements,
    )

    # Score: Python (3.0 * 100) + AWS (1.0 * 0) / (3.0 + 1.0) = 75.0%
    assert pytest.approx(result["final_score"], 0.5) == 75.0
    evaluated_aws = next(r for r in result["evaluated_requirements"] if r["requirement_id"] == "REQ_AWS")
    assert evaluated_aws["group"] == "skills"
    assert evaluated_aws["type"] == "PREFERRED"
    assert "ưu tiên" in evaluated_aws["comparison"]


def test_preferred_share_guardrail_few_preferred():
    """Test that when preferred requirements form <= 25% of total importance, natural linear share applies."""
    # 2 required (3.0 each = 6.0) + 1 preferred (1.0) -> total = 7.0 (preferred is 1/7 = 14.3% <= 25%)
    requirements = [
        {"requirement_id": "REQ_1", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_2", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "FastAPI", "normalized_value": "fastapi", "mandatory": True},
        {"requirement_id": "PREF_1", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": "Docker", "normalized_value": "docker", "mandatory": False},
    ]
    calculate_requirement_weights(requirements, decimal_places=1)

    # Weights should sum to 100%
    assert sum(r["weight"] for r in requirements) == pytest.approx(100.0, 0.1)
    # Preferred weight is approx 1/7 * 100 = 14.3%
    assert pytest.approx(requirements[2]["weight"], 0.5) == 14.3


def test_preferred_share_guardrail_many_preferred():
    """Test that when a JD has many preferred requirements, the guardrail caps their total share at 25%."""
    # 2 required (3.0 each = 6.0) + 10 preferred (1.0 each = 10.0) -> raw preferred = 10/16 = 62.5%
    requirements = [
        {"requirement_id": "REQ_1", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_2", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "FastAPI", "normalized_value": "fastapi", "mandatory": True},
    ] + [
        {"requirement_id": f"PREF_{i}", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": f"Tool_{i}", "normalized_value": f"tool_{i}", "mandatory": False}
        for i in range(10)
    ]
    calculate_requirement_weights(requirements, decimal_places=1)

    core_weights = sum(r["weight"] for r in requirements[:2])
    pref_weights = sum(r["weight"] for r in requirements[2:])

    # Core must retain 75% and preferred capped at 25%
    assert pytest.approx(core_weights, 0.5) == 75.0
    assert pytest.approx(pref_weights, 0.5) == 25.0
    assert sum(r["weight"] for r in requirements) == pytest.approx(100.0, 0.1)


def test_preferred_share_guardrail_only_preferred():
    """Test that when a JD contains ONLY preferred requirements, preferred gets 100% budget."""
    requirements = [
        {"requirement_id": f"PREF_{i}", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": f"Tool_{i}", "normalized_value": f"tool_{i}", "mandatory": False}
        for i in range(4)
    ]
    calculate_requirement_weights(requirements, decimal_places=1)

    assert sum(r["weight"] for r in requirements) == pytest.approx(100.0, 0.1)
    for r in requirements:
        assert pytest.approx(r["weight"], 0.5) == 25.0


def test_preferred_share_guardrail_adding_more_preferred_does_not_dilute_required():
    """Test that changing the number of preferred requirements does not unexpectedly overwhelm required requirements."""
    # Candidate matches all required skills (Python + FastAPI) but none of the preferred
    parsed_cv = {"skills": ["Python", "FastAPI"], "experience": []}

    # Case A: 2 required + 2 preferred (raw pref = 2/8 = 25%) -> candidate gets 75%
    jd_a = [
        {"requirement_id": "REQ_1", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_2", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "FastAPI", "normalized_value": "fastapi", "mandatory": True},
        {"requirement_id": "PREF_1", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": "Docker", "normalized_value": "docker", "mandatory": False},
        {"requirement_id": "PREF_2", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": "K8s", "normalized_value": "k8s", "mandatory": False},
    ]
    res_a = run_cv_jd_pipeline(cv_text="Python FastAPI", parsed_cv=parsed_cv, job_id="JD_A", requirements=jd_a)

    # Case B: 2 required + 10 preferred -> without guardrail score would drop to 37.5%, with guardrail it stays solid at 75%
    jd_b = [
        {"requirement_id": "REQ_1", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_2", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "FastAPI", "normalized_value": "fastapi", "mandatory": True},
    ] + [
        {"requirement_id": f"PREF_{i}", "group": "skills", "type": "PREFERRED", "importance": 1.0, "text": f"Tool_{i}", "normalized_value": f"tool_{i}", "mandatory": False}
        for i in range(10)
    ]
    res_b = run_cv_jd_pipeline(cv_text="Python FastAPI", parsed_cv=parsed_cv, job_id="JD_B", requirements=jd_b)

    assert pytest.approx(res_a["final_score"], 0.5) == 75.0
    assert pytest.approx(res_b["final_score"], 0.5) == 75.0


def test_candidate_missing_one_required_skill_is_not_capped_at_49():
    """Test that missing 1 skill does not trigger a 49% hard cap."""
    requirements = [
        {"requirement_id": "REQ_1", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_2", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "FastAPI", "normalized_value": "fastapi", "mandatory": True},
        {"requirement_id": "REQ_3", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "PostgreSQL", "normalized_value": "postgresql", "mandatory": True},
        {"requirement_id": "REQ_4", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Docker", "normalized_value": "docker", "mandatory": True},
        {"requirement_id": "REQ_5", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Kubernetes", "normalized_value": "kubernetes", "mandatory": True},
    ]

    parsed_cv = {
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "experience": [
            {
                "title": "Backend Developer",
                "start_date": "2023-01",
                "end_date": "2025-01",
                "description": "Phát triển với Python, FastAPI, PostgreSQL và đóng gói container với Docker.",
            }
        ]
    }

    result = run_cv_jd_pipeline(
        cv_text="Python FastAPI PostgreSQL Docker backend",
        parsed_cv=parsed_cv,
        job_id="JOB_TEST_02",
        requirements=requirements,
    )

    # 4/5 matched = 80% score. It must NOT be capped at 49%!
    assert result["final_score"] >= 75.0
    assert result["final_score"] == result["raw_final_score"]


def test_two_jds_same_categories_different_composition_produce_different_weights_and_scores():
    """Test that two JDs having the same categories (skills + experience) produce different weights and scores based on requirement composition."""
    # Candidate has Python (matched) and 2 years experience (matched), but lacks Golang and Java
    parsed_cv = {
        "skills": ["Python"],
        "experience": [{"title": "Dev", "start_date": "2022-01", "end_date": "2024-01", "description": "Python dev"}]
    }

    # JD 1: Heavy on Skills (3 skills @ importance 3.0 + 1 exp @ importance 3.0) -> Total imp = 12
    # Candidate matches Python (3) + Exp (3) = 6/12 = 50.0%
    jd1_requirements = [
        {"requirement_id": "REQ_PY", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_GO", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Golang", "normalized_value": "golang", "mandatory": True},
        {"requirement_id": "REQ_JAVA", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Java", "normalized_value": "java", "mandatory": True},
        {"requirement_id": "REQ_EXP", "requirement_type": "JD_EXPERIENCE", "group": "experience_seniority", "type": "REQUIRED", "importance": 3.0, "text": "2 năm kinh nghiệm", "minimum_years": 2.0, "mandatory": True},
    ]
    res1 = run_cv_jd_pipeline(cv_text="Python 2022-01 - 2024-01", parsed_cv=parsed_cv, job_id="JD1", requirements=jd1_requirements)

    # JD 2: Heavy on Experience (1 skill @ importance 3.0 + 1 exp @ importance 9.0) -> Total imp = 12
    # Candidate matches Python (3) + Exp (9) = 12/12 = 100.0%
    jd2_requirements = [
        {"requirement_id": "REQ_PY", "requirement_type": "JD_REQUIRED_SKILL", "group": "skills", "type": "REQUIRED", "importance": 3.0, "text": "Python", "normalized_value": "python", "mandatory": True},
        {"requirement_id": "REQ_EXP", "requirement_type": "JD_EXPERIENCE", "group": "experience_seniority", "type": "REQUIRED", "importance": 9.0, "text": "2 năm kinh nghiệm", "minimum_years": 2.0, "mandatory": True},
    ]
    res2 = run_cv_jd_pipeline(cv_text="Python 2022-01 - 2024-01", parsed_cv=parsed_cv, job_id="JD2", requirements=jd2_requirements)

    # Final scores must be dynamically driven by requirement composition, NOT fixed category weights
    assert pytest.approx(res1["final_score"], 0.5) == 50.0
    assert pytest.approx(res2["final_score"], 0.5) == 100.0
    assert res1["final_score"] != res2["final_score"]


def test_wording_based_dynamic_importance_assignment():
    """Test that parser infers higher importance for 'essential / cực kỳ quan trọng' vs 'basic / có hiểu biết'."""
    jd_text = """
    Tuyển dụng Backend Engineer
    Yêu cầu:
    - Strong Python expertise is essential (bắt buộc chuyên sâu)
    - Basic SQL knowledge required (biết SQL cơ bản)
    """
    parsed_jd = parse_job_description(title="Backend Engineer", requirements_text=jd_text)
    atomic_reqs = _build_atomic_requirements(parsed_jd, jd_text)

    py_req = next((r for r in atomic_reqs if "python" in r["text"].lower()), None)
    sql_req = next((r for r in atomic_reqs if "sql" in r["text"].lower()), None)

    assert py_req is not None
    assert sql_req is not None
    # Python has stronger importance signal (4.5) than SQL (2.0)
    assert py_req["importance"] > sql_req["importance"]


def test_infer_importance_multifactor_signals():
    """Test multi-factor importance inference: title centrality, measurable experience years, and seniority."""
    # 1. Title Centrality
    imp_central = _infer_importance("Python programming", 3.0, "REQUIRED", job_title="Senior Python Developer")
    imp_non_central = _infer_importance("Redis caching", 3.0, "REQUIRED", job_title="Senior Python Developer")
    assert imp_central > imp_non_central

    # 2. Measurable Experience Thresholds
    imp_senior_exp = _infer_importance("5+ years experience", 3.0, "REQUIRED", min_years=5.0)
    imp_junior_exp = _infer_importance("1 year experience", 3.0, "REQUIRED", min_years=1.0)
    assert imp_senior_exp >= 4.5
    assert imp_junior_exp == 3.0

    # 3. Seniority expectations
    imp_lead_arch = _infer_importance("System design and architecture", 2.0, "RESPONSIBILITY", seniority="Lead")
    imp_junior_arch = _infer_importance("System design and architecture", 2.0, "RESPONSIBILITY", seniority="Junior")
    assert imp_lead_arch > imp_junior_arch


def test_multiple_hard_constraints_aggregation_all_combinations():
    """Test multiple HARD_CONSTRAINT aggregation across all mixed combinations."""
    # 1. ELIGIBLE + UNKNOWN -> UNKNOWN (failed = False)
    reqs_el_un = [
        {"requirement_id": "REQ_LIC", "type": "HARD_CONSTRAINT", "is_hard_constraint": True, "text": "Chứng chỉ luật sư", "mandatory": True},
        {"requirement_id": "REQ_VISA", "type": "HARD_CONSTRAINT", "is_hard_constraint": True, "text": "Work permit", "mandatory": True},
    ]
    cv_el_un = {
        "skills": [],
        "other": ["Có chứng chỉ luật sư hợp lệ"],
        "experience": [{"title": "Legal", "description": "Có chứng chỉ luật sư"}],
    }
    res_el_un = run_cv_jd_pipeline(cv_text="Có chứng chỉ luật sư", parsed_cv=cv_el_un, job_id="J1", requirements=reqs_el_un)
    gate_el_un = apply_mandatory_gate(res_el_un)
    assert res_el_un["eligibility_status"] == "UNKNOWN"
    assert gate_el_un.failed is False

    # 2. UNKNOWN + NOT_ELIGIBLE -> NOT_ELIGIBLE (failed = True)
    gate_un_ne = apply_mandatory_gate(70.0, failed_requirement_ids=["REQ_VISA"])
    assert gate_un_ne.failed is True
    assert gate_un_ne.reason == "HARD_CONSTRAINT_NOT_MET"

    # 3. ELIGIBLE + ELIGIBLE -> ELIGIBLE (failed = False)
    cv_el_el = {
        "skills": [],
        "other": ["Có chứng chỉ luật sư hợp lệ", "Có work permit hợp lệ"],
        "experience": [{"title": "Legal", "description": "Có chứng chỉ luật sư và work permit"}],
    }
    res_el_el = run_cv_jd_pipeline(cv_text="Có chứng chỉ luật sư và work permit", parsed_cv=cv_el_el, job_id="J2", requirements=reqs_el_un)
    gate_el_el = apply_mandatory_gate(res_el_el)
    assert res_el_el["eligibility_status"] == "ELIGIBLE"
    assert gate_el_el.failed is False

    # 4. ELIGIBLE + UNKNOWN + ELIGIBLE -> UNKNOWN (failed = False)
    reqs_3 = [
        {"requirement_id": "REQ_1", "type": "HARD_CONSTRAINT", "is_hard_constraint": True, "text": "Chứng chỉ A", "mandatory": True},
        {"requirement_id": "REQ_2", "type": "HARD_CONSTRAINT", "is_hard_constraint": True, "text": "Giấy phép B", "mandatory": True},
        {"requirement_id": "REQ_3", "type": "HARD_CONSTRAINT", "is_hard_constraint": True, "text": "Bằng lái C", "mandatory": True},
    ]
    cv_3 = {
        "skills": [],
        "other": ["Có Chứng chỉ A", "Có Bằng lái C"],
        "experience": [{"title": "Driver", "description": "Có Chứng chỉ A và Bằng lái C"}],
    }
    res_3 = run_cv_jd_pipeline(cv_text="Có Chứng chỉ A và Bằng lái C", parsed_cv=cv_3, job_id="J3", requirements=reqs_3)
    gate_3 = apply_mandatory_gate(res_3)
    assert res_3["eligibility_status"] == "UNKNOWN"
    assert gate_3.failed is False


def test_partial_experience_calculation_and_vietnamese_comparison():
    """Test that experience gap is calculated with concrete numbers in Vietnamese."""
    requirements = [
        {
            "requirement_id": "REQ_EXP",
            "requirement_type": "JD_EXPERIENCE",
            "group": "experience_seniority",
            "type": "REQUIRED",
            "importance": 3.0,
            "text": "Tối thiểu 2 năm kinh nghiệm backend",
            "minimum_years": 2.0,
            "mandatory": True,
        }
    ]

    parsed_cv = {
        "experience": [
            {
                "title": "Backend Dev",
                "start_date": "2023-01",
                "end_date": "2023-12",
                "description": "Backend development",
            }
        ]
    }

    result = run_cv_jd_pipeline(
        cv_text="Backend Dev 2023-01 - 2023-12",
        parsed_cv=parsed_cv,
        job_id="JOB_TEST_04",
        requirements=requirements,
    )

    evaluated_req = result["evaluated_requirements"][0]
    assert evaluated_req["match_status"] == "PARTIAL"
    assert evaluated_req["match_score"] == 0.5
    # Verification of Vietnamese 3-part comparison
    comparison = evaluated_req["comparison"]
    assert "2 năm" in comparison or "2" in comparison
    assert "1" in comparison or "12" in comparison or "tháng" in comparison


def test_absent_skill_phrasing():
    """Test that missing requirement is phrased as 'CV không đề cập' instead of 'Ứng viên không biết'."""
    requirements = [
        {
            "requirement_id": "REQ_SKILL",
            "requirement_type": "JD_REQUIRED_SKILL",
            "group": "skills",
            "type": "REQUIRED",
            "importance": 3.0,
            "text": "Golang",
            "normalized_value": "golang",
            "mandatory": True,
        }
    ]

    parsed_cv = {"skills": ["Python"], "experience": []}

    result = run_cv_jd_pipeline(
        cv_text="Python dev",
        parsed_cv=parsed_cv,
        job_id="JOB_TEST_05",
        requirements=requirements,
    )

    evaluated_req = result["evaluated_requirements"][0]
    assert evaluated_req["match_status"] == "NOT_FOUND"
    assert "CV không đề cập" in evaluated_req["comparison"]
    assert "không biết" not in evaluated_req["comparison"]


def test_ranking_candidate_a_9_of_10_vs_candidate_b_5_of_10():
    """Test that Candidate A (9/10 skills) strictly ranks higher than Candidate B (5/10 skills)."""
    skills = ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "Git", "Linux", "CI/CD", "REST API", "SQL"]
    requirements = [
        {
            "requirement_id": f"REQ_{i}",
            "requirement_type": "JD_REQUIRED_SKILL",
            "group": "skills",
            "type": "REQUIRED",
            "importance": 3.0,
            "text": s,
            "normalized_value": s.lower(),
            "mandatory": True,
        }
        for i, s in enumerate(skills)
    ]

    parsed_cv_a = {
        "skills": skills[:9],
        "experience": [{"title": "Dev", "description": " ".join(skills[:9])}],
    }
    res_a = run_cv_jd_pipeline(cv_text=" ".join(skills[:9]), parsed_cv=parsed_cv_a, job_id="JOB_RANK", requirements=requirements)

    parsed_cv_b = {
        "skills": skills[:5],
        "experience": [{"title": "Dev", "description": " ".join(skills[:5])}],
    }
    res_b = run_cv_jd_pipeline(cv_text=" ".join(skills[:5]), parsed_cv=parsed_cv_b, job_id="JOB_RANK", requirements=requirements)

    assert res_a["final_score"] > res_b["final_score"]
    assert pytest.approx(res_a["final_score"], 2.0) == 90.0
    assert pytest.approx(res_b["final_score"], 2.0) == 50.0
