"""Unit tests for the evidence confidence calculation module."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.confidence import calculate_evidence_confidence


def test_confidence_high_when_coverage_gte_80_percent():
    """8/10 requirements verified with evidence -> high confidence."""
    result = calculate_evidence_confidence(
        verified_count=8,
        uncertain_count=0,
        total_requirements=10,
    )
    assert result.confidence_level == "high"
    assert result.evidence_coverage == 0.80
    assert result.confidence_score >= 0.80


def test_confidence_medium_when_coverage_50_to_79_percent():
    """6/10 requirements verified with evidence -> medium confidence."""
    result = calculate_evidence_confidence(
        verified_count=6,
        uncertain_count=0,
        total_requirements=10,
    )
    assert result.confidence_level == "medium"
    assert result.evidence_coverage == 0.60


def test_confidence_low_when_coverage_below_50_percent():
    """3/10 requirements verified with evidence -> low confidence."""
    result = calculate_evidence_confidence(
        verified_count=3,
        uncertain_count=0,
        total_requirements=10,
    )
    assert result.confidence_level == "low"
    assert result.evidence_coverage == 0.30


def test_confidence_low_when_uncertain_ratio_is_high():
    """Even with 8/10 verified, 4/10 UNCERTAIN status downgrades to low confidence."""
    result = calculate_evidence_confidence(
        verified_count=8,
        uncertain_count=4,
        total_requirements=10,
    )
    assert result.confidence_level == "low"


def test_confidence_decoupled_from_fit_score():
    """Fit Score = 82.0 with Low Confidence is completely valid."""
    # Match object with 2 verified out of 10 requirements (low confidence)
    match_data = {
        "final_score": 82.0,
        "requirements": {
            "matched": [{"id": "1"}, {"id": "2"}],
            "partial": [{"id": "3"}, {"id": "4"}],
            "missing": [{"id": "5"}, {"id": "6"}, {"id": "7"}],
            "uncertain": [{"id": "8"}, {"id": "9"}, {"id": "10"}],
        },
    }
    result = calculate_evidence_confidence(match_data)
    assert result.confidence_level == "low"
    assert result.evidence_coverage == 0.20


def test_confidence_empty_requirements_returns_low():
    result = calculate_evidence_confidence(total_requirements=0)
    assert result.confidence_level == "low"
    assert result.confidence_score == 0.0
