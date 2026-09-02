"""Unit tests for the Fit Score calculation service (6-group taxonomy)."""

import math

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.fit_score import (
    DEFAULT_RUBRIC_WEIGHTS,
    calculate_fit_score,
)


def test_fit_score_all_criteria_present():
    """All 6 criteria present with default weights summing to 100%."""
    raw_scores = {
        "CRIT_SKILLS": 100.0,
        "CRIT_RESPONSIBILITIES": 100.0,
        "CRIT_EXPERIENCE": 100.0,
        "CRIT_EDUCATION": 100.0,
        "CRIT_DOMAIN": 100.0,
        "CRIT_CERTIFICATIONS_OTHER": 100.0,
    }
    result = calculate_fit_score(raw_scores)
    assert math.isclose(result.raw_fit_score, 100.0, rel_tol=1e-5)
    assert math.isclose(result.display_fit_score, 100.0, rel_tol=1e-5)
    assert len(result.breakdown) == 6

    # Check that base weights match default rubric
    for item in result.breakdown:
        assert item.base_weight == DEFAULT_RUBRIC_WEIGHTS[item.criterion_id]
        assert math.isclose(item.normalized_weight, DEFAULT_RUBRIC_WEIGHTS[item.criterion_id], rel_tol=1e-4)


def test_fit_score_missing_education_normalizes_weights():
    """When Education has no requirements, active weights are normalized dynamically."""
    raw_scores = {
        "CRIT_SKILLS": 80.0,
        "CRIT_RESPONSIBILITIES": 90.0,
        "CRIT_EXPERIENCE": 90.0,
        # No CRIT_EDUCATION (10%)
        "CRIT_DOMAIN": 85.0,
        "CRIT_CERTIFICATIONS_OTHER": 100.0,
    }
    result = calculate_fit_score(raw_scores)

    # Total active weight = 35 + 20 + 20 + 10 + 5 = 90
    expected_skill_weight = (35.0 / 90.0) * 100.0
    expected_resp_weight = (20.0 / 90.0) * 100.0
    expected_exp_weight = (20.0 / 90.0) * 100.0
    expected_domain_weight = (10.0 / 90.0) * 100.0
    expected_cert_weight = (5.0 / 90.0) * 100.0

    assert math.isclose(result.active_weights["CRIT_SKILLS"], expected_skill_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_RESPONSIBILITIES"], expected_resp_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_EXPERIENCE"], expected_exp_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_DOMAIN"], expected_domain_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_CERTIFICATIONS_OTHER"], expected_cert_weight, rel_tol=1e-4)
    assert "CRIT_EDUCATION" not in result.active_weights


def test_fit_score_reuse_from_match_engine_criteria_list():
    """Reuse criteria list as returned by Match Engine (cv_jd_pipeline)."""
    match_criteria = [
        {"criterion_id": "CRIT_SKILLS", "raw_score": 90.0, "status": "SUPPORTED"},
        {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 80.0, "status": "SUPPORTED"},
        {"criterion_id": "CRIT_DOMAIN", "raw_score": 100.0, "status": "SUPPORTED"},
    ]
    result = calculate_fit_score(match_criteria)
    # Active: 35 + 20 + 10 = 65
    expected_score = (90.0 * 35.0 + 80.0 * 20.0 + 100.0 * 10.0) / 65.0
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)
    assert result.display_fit_score == round(expected_score, 1)


def test_fit_score_reuse_from_match_result_dict():
    """Reuse criteria from full match result dict."""
    match_result = {
        "final_score": 85.0,
        "criteria": [
            {"criterion_id": "CRIT_SKILLS", "raw_score": 100.0},
            {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 50.0},
        ],
    }
    result = calculate_fit_score(match_result)
    # Active: 35 + 20 = 55
    expected_score = (100.0 * 35.0 + 50.0 * 20.0) / 55.0
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)
    assert result.display_fit_score == round(expected_score, 1)


def test_fit_score_aliases_mapping():
    """Support friendly keyword aliases mapping both required_skills and preferred_skills to CRIT_SKILLS."""
    raw_scores = {
        "skills": 80.0,
        "experience": 70.0,
        "education": 100.0,
    }
    result = calculate_fit_score(raw_scores)
    # Active: 35 + 20 + 10 = 65
    expected_score = (80.0 * 35.0 + 70.0 * 20.0 + 100.0 * 10.0) / 65.0
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)


def test_fit_score_empty_criteria_returns_zero():
    result = calculate_fit_score({})
    assert result.raw_fit_score == 0.0
    assert result.display_fit_score == 0.0
    assert result.breakdown == []
