"""Unit tests for the deterministic explanation generator."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.explanation import (
    generate_deterministic_explanations,
)


def test_explanation_generates_structured_strength_and_gap_codes():
    """Generates auditable reason codes: STRONG_REQUIRED_SKILLS, MISSING_REQUIRED_SKILL, etc."""
    match_data = {
        "final_score": 75.0,
        "criteria": [
            {
                "criterion_id": "CRIT_REQUIRED_SKILL",
                "raw_score": 85.0,
                "evidence_ids": ["ev_py1", "ev_py2"],
            },
            {
                "criterion_id": "CRIT_EXPERIENCE",
                "raw_score": 90.0,
                "evidence_ids": ["ev_exp1"],
            },
        ],
        "requirements": {
            "matched": [
                {
                    "requirement_id": "req_python",
                    "normalized_value": "Python",
                    "status": "SUPPORTED",
                    "evidence_ids": ["ev_py1"],
                }
            ],
            "missing": [
                {
                    "requirement_id": "req_redis",
                    "normalized_value": "Redis",
                    "mandatory": True,
                    "requirement_type": "JD_REQUIRED_SKILL",
                    "status": "NOT_FOUND",
                },
                {
                    "requirement_id": "req_k8s",
                    "normalized_value": "Kubernetes",
                    "mandatory": False,
                    "requirement_type": "JD_PREFERRED_SKILL",
                    "status": "NOT_FOUND",
                },
            ],
            "partial": [],
            "uncertain": [],
        },
    }

    result = generate_deterministic_explanations(match_data, lang="vi")

    # Check structured strength reason codes
    strength_codes = [s["code"] for s in result.strengths]
    assert "STRONG_REQUIRED_SKILLS" in strength_codes
    assert "STRONG_EXPERIENCE" in strength_codes

    skill_strength = next(s for s in result.strengths if s["code"] == "STRONG_REQUIRED_SKILLS")
    assert skill_strength["criterion"] == "required_skills"
    assert skill_strength["evidence_ids"] == ["ev_py1", "ev_py2"]

    # Check structured gap reason codes
    gap_codes = [g["code"] for g in result.gaps]
    assert "MISSING_REQUIRED_SKILL" in gap_codes
    assert "MISSING_PREFERRED_SKILL" in gap_codes

    redis_gap = next(g for g in result.gaps if g["requirement_id"] == "req_redis")
    assert redis_gap["code"] == "MISSING_REQUIRED_SKILL"
    assert redis_gap["mandatory"] is True
    assert redis_gap["requirement_text"] == "Redis"

    # Check Vietnamese UI messages
    assert any("Kỹ năng bắt buộc được hỗ trợ tốt bởi CV" in msg for msg in result.top_strengths)
    assert any("Chưa tìm thấy evidence cho Redis" in msg for msg in result.top_gaps)

    # Check persistence payload
    assert "strengths" in result.explanation_json
    assert "gaps" in result.explanation_json
    assert result.explanation_json["summary"]["mandatory_gaps_count"] == 1


def test_explanation_english_messages():
    match_data = {
        "criteria": [
            {
                "criterion_id": "CRIT_REQUIRED_SKILL",
                "raw_score": 85.0,
                "evidence_ids": ["ev1"],
            }
        ],
        "requirements": {
            "matched": [],
            "missing": [
                {
                    "requirement_id": "req_aws",
                    "normalized_value": "AWS",
                    "mandatory": True,
                }
            ],
        },
    }
    result = generate_deterministic_explanations(match_data, lang="en")
    assert any("Required skills are strongly supported" in msg for msg in result.top_strengths)
    assert any("Missing evidence for AWS" in msg for msg in result.top_gaps)
