"""Unit tests for the Fit Score calculation service."""

import math

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.fit_score import (
    DEFAULT_RUBRIC_WEIGHTS,
    calculate_fit_score,
)


def test_fit_score_all_criteria_present():
    """All 5 criteria present: 35% Skills, 30% Exp, 10% Edu, 10% Pref, 15% Domain."""
    raw_scores = {
        "CRIT_REQUIRED_SKILL": 100.0,
        "CRIT_EXPERIENCE": 100.0,
        "CRIT_EDUCATION": 100.0,
        "CRIT_PREFERRED_SKILL": 100.0,
        "CRIT_DOMAIN": 100.0,
    }
    result = calculate_fit_score(raw_scores)
    assert math.isclose(result.raw_fit_score, 100.0, rel_tol=1e-5)
    assert math.isclose(result.display_fit_score, 100.0, rel_tol=1e-5)
    assert len(result.breakdown) == 5

    # Check that base weights match default rubric
    for item in result.breakdown:
        assert item.base_weight == DEFAULT_RUBRIC_WEIGHTS[item.criterion_id]
        assert math.isclose(item.normalized_weight, DEFAULT_RUBRIC_WEIGHTS[item.criterion_id], rel_tol=1e-4)


def test_fit_score_missing_education_normalizes_weights():
    """When Education has no requirements, active weights are normalized out of 90."""
    raw_scores = {
        "CRIT_REQUIRED_SKILL": 80.0,
        "CRIT_EXPERIENCE": 90.0,
        # No CRIT_EDUCATION
        "CRIT_PREFERRED_SKILL": 70.0,
        "CRIT_DOMAIN": 85.0,
    }
    result = calculate_fit_score(raw_scores)

    # Total active weight = 35 + 30 + 10 + 15 = 90
    expected_skill_weight = (35.0 / 90.0) * 100.0
    expected_exp_weight = (30.0 / 90.0) * 100.0
    expected_pref_weight = (10.0 / 90.0) * 100.0
    expected_domain_weight = (15.0 / 90.0) * 100.0

    assert math.isclose(result.active_weights["CRIT_REQUIRED_SKILL"], expected_skill_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_EXPERIENCE"], expected_exp_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_PREFERRED_SKILL"], expected_pref_weight, rel_tol=1e-4)
    assert math.isclose(result.active_weights["CRIT_DOMAIN"], expected_domain_weight, rel_tol=1e-4)
    assert "CRIT_EDUCATION" not in result.active_weights

    # Expected raw score = (80 * 35 + 90 * 30 + 70 * 10 + 85 * 15) / 90
    # = (2800 + 2700 + 700 + 1275) / 90 = 7475 / 90 = 83.0555...
    expected_score = (80.0 * 35.0 + 90.0 * 30.0 + 70.0 * 10.0 + 85.0 * 15.0) / 90.0
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)
    assert result.display_fit_score == round(expected_score, 1)


def test_fit_score_reuse_from_match_engine_criteria_list():
    """Reuse criteria list as returned by Match Engine (cv_jd_pipeline)."""
    match_criteria = [
        {"criterion_id": "CRIT_REQUIRED_SKILL", "raw_score": 90.0, "status": "SUPPORTED"},
        {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 80.0, "status": "SUPPORTED"},
        {"criterion_id": "CRIT_DOMAIN", "raw_score": 100.0, "status": "SUPPORTED"},
    ]
    result = calculate_fit_score(match_criteria)
    # Active: 35 + 30 + 15 = 80
    expected_score = (90.0 * 35.0 + 80.0 * 30.0 + 100.0 * 15.0) / 80.0
    # = (3150 + 2400 + 1500) / 80 = 7050 / 80 = 88.125
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)
    assert result.display_fit_score == 88.1


def test_fit_score_reuse_from_match_result_dict():
    """Reuse criteria from full match result dict."""
    match_result = {
        "final_score": 85.0,
        "criteria": [
            {"criterion_id": "CRIT_REQUIRED_SKILL", "raw_score": 100.0},
            {"criterion_id": "CRIT_EXPERIENCE", "raw_score": 50.0},
        ],
    }
    result = calculate_fit_score(match_result)
    # Active: 35 + 30 = 65
    expected_score = (100.0 * 35.0 + 50.0 * 30.0) / 65.0
    # = (3500 + 1500) / 65 = 5000 / 65 = 76.923...
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)
    assert result.display_fit_score == 76.9


def test_fit_score_aliases_mapping():
    """Support friendly keyword aliases."""
    raw_scores = {
        "required_skills": 80.0,
        "experience": 70.0,
        "education": 100.0,
    }
    result = calculate_fit_score(raw_scores)
    # Active: 35 + 30 + 10 = 75
    expected_score = (80.0 * 35.0 + 70.0 * 30.0 + 100.0 * 10.0) / 75.0
    assert math.isclose(result.raw_fit_score, expected_score, rel_tol=1e-4)


def test_fit_score_empty_criteria_returns_zero():
    result = calculate_fit_score({})
    assert result.raw_fit_score == 0.0
    assert result.display_fit_score == 0.0
    assert result.breakdown == []
