"""Unit tests for the mandatory eligibility gate module."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.mandatory_gate import (
    REASON_MUST_HAVE_BELOW_THRESHOLD,
    apply_mandatory_gate,
)


def test_mandatory_gate_fails_when_coverage_below_50_percent():
    """Coverage < 0.50 (e.g. 0.42) fails gate and caps display score at 49.0."""
    result = apply_mandatory_gate(
        82.5,
        must_have_coverage=0.42,
        failed_requirement_ids=["REQ_MUST_PYTHON", "REQ_MUST_FASTAPI"],
        threshold=0.50,
    )

    assert result.failed is True
    assert result.reason == REASON_MUST_HAVE_BELOW_THRESHOLD
    assert result.raw_score == 82.5
    assert result.display_score == 49.0

    assert result.gate_json == {
        "threshold": 0.50,
        "coverage": 0.42,
        "reason": REASON_MUST_HAVE_BELOW_THRESHOLD,
        "failed_requirement_ids": ["REQ_MUST_PYTHON", "REQ_MUST_FASTAPI"],
    }


def test_mandatory_gate_passes_when_coverage_exactly_50_percent():
    """Boundary test: Coverage exactly 0.50 (threshold=0.50) MUST pass gate."""
    result = apply_mandatory_gate(
        80.0,
        must_have_coverage=0.50,
        threshold=0.50,
    )

    assert result.failed is False
    assert result.reason is None
    assert result.raw_score == 80.0
    assert result.display_score == 80.0
    assert result.gate_json["coverage"] == 0.50


def test_mandatory_gate_passes_when_coverage_above_50_percent():
    """Coverage > 0.50 (e.g. 0.75) passes gate, display score unchanged."""
    result = apply_mandatory_gate(
        85.0,
        must_have_coverage=0.75,
        threshold=0.50,
    )

    assert result.failed is False
    assert result.reason is None
    assert result.raw_score == 85.0
    assert result.display_score == 85.0


def test_mandatory_gate_score_bounds_and_clamping():
    """Scores are properly bounded and preserved within [0, 100]."""
    # Raw score already below 49 is not boosted
    res_low = apply_mandatory_gate(35.0, must_have_coverage=0.30, score_cap=49.0)
    assert res_low.failed is True
    assert res_low.raw_score == 35.0
    assert res_low.display_score == 35.0

    # Raw score 0
    res_zero = apply_mandatory_gate(0.0, must_have_coverage=0.0)
    assert res_zero.raw_score == 0.0
    assert res_zero.display_score == 0.0

    # Raw score 100 passing
    res_max = apply_mandatory_gate(100.0, must_have_coverage=1.0)
    assert res_max.raw_score == 100.0
    assert res_max.display_score == 100.0


def test_mandatory_gate_with_dict_match_object():
    """Extract score and failed requirements from nested match object."""
    match_dict = {
        "final_score": 78.0,
        "must_have_coverage": 0.40,
        "result_json": {
            "requirements": {
                "missing": [
                    {"requirement_id": "REQ_01", "mandatory": True},
                    {"requirement_id": "REQ_02", "mandatory": False},
                ]
            }
        },
    }
    result = apply_mandatory_gate(match_dict)

    assert result.failed is True
    assert result.raw_score == 78.0
    assert result.display_score == 49.0
    assert result.gate_json["coverage"] == 0.40
    assert result.gate_json["failed_requirement_ids"] == ["REQ_01"]
