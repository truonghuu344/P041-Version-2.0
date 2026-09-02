"""Unit tests for the mandatory eligibility gate module under dynamic JD-driven scoring."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.mandatory_gate import (
    apply_mandatory_gate,
)


def test_mandatory_gate_does_not_distort_or_cap_score_when_coverage_low():
    """Normal REQUIRED coverage below threshold must NOT cap score or fail candidate."""
    result = apply_mandatory_gate(
        82.5,
        must_have_coverage=0.42,
        failed_requirement_ids=[],
        threshold=0.50,
    )

    assert result.failed is False
    assert result.raw_score == 82.5
    assert result.display_score == 82.5
    assert result.gate_json["coverage"] == 0.42


def test_mandatory_gate_preserves_score_at_boundary():
    """Coverage exactly 0.50 preserves raw score."""
    result = apply_mandatory_gate(
        80.0,
        must_have_coverage=0.50,
        threshold=0.50,
    )

    assert result.failed is False
    assert result.raw_score == 80.0
    assert result.display_score == 80.0
    assert result.gate_json["coverage"] == 0.50


def test_mandatory_gate_fails_only_on_hard_constraint():
    """Gate fails ONLY when candidate violates genuine HARD_CONSTRAINT."""
    result = apply_mandatory_gate(
        78.0,
        must_have_coverage=0.80,
        failed_requirement_ids=["REQ_WORK_PERMIT"],
    )

    assert result.failed is True
    assert result.reason == "HARD_CONSTRAINT_NOT_MET"
    # Even if hard constraint fails, display score preserves true match score
    assert result.display_score == 78.0
    assert result.gate_json["failed_requirement_ids"] == ["REQ_WORK_PERMIT"]


def test_mandatory_gate_scores_bounds():
    """Scores are properly bounded and preserved within [0, 100]."""
    res_zero = apply_mandatory_gate(0.0, must_have_coverage=0.0)
    assert res_zero.raw_score == 0.0
    assert res_zero.display_score == 0.0

    res_max = apply_mandatory_gate(100.0, must_have_coverage=1.0)
    assert res_max.raw_score == 100.0
    assert res_max.display_score == 100.0


def test_mandatory_gate_with_dict_match_object():
    """Extract score, coverage, and hard constraint status from match object."""
    match_dict = {
        "final_score": 78.0,
        "must_have_coverage": 0.60,
        "eligibility_status": "ELIGIBLE",
        "result_json": {
            "requirements": {
                "missing": [
                    {"requirement_id": "REQ_01", "mandatory": True, "type": "REQUIRED"},
                ]
            }
        },
    }
    result = apply_mandatory_gate(match_dict)

    # Normal required missing -> no hard constraint failure
    assert result.failed is False
    assert result.raw_score == 78.0
    assert result.display_score == 78.0
    assert result.gate_json["coverage"] == 0.60
