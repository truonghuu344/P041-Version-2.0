"""Unit tests for the One-to-One Requirement Extraction Evaluator."""

from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from eval.runners.extraction_evaluator import (  # noqa: E402
    align_requirements_bipartite,
    compute_requirement_similarity,
    evaluate_job_extraction,
)


def test_one_expected_cannot_produce_two_tps():
    # 1 Expected Python requirement
    expected = [
        {"requirement_id": "REQ_1", "text": "Python", "group": "skills", "type": "REQUIRED"},
    ]
    # 2 Extracted requirements mentioning Python
    extracted = [
        {"requirement_id": "EXT_1", "text": "Python", "group": "skills", "type": "REQUIRED"},
        {"requirement_id": "EXT_2", "text": "Python backend development", "group": "skills", "type": "REQUIRED"},
    ]
    matched, fn, fp, dups = align_requirements_bipartite(expected, extracted)
    assert len(matched) == 1  # Exactly ONE TP
    assert len(fn) == 0
    assert len(fp) + len(dups) == 1  # The second Python extraction is marked as duplicate/extra


def test_one_extracted_cannot_satisfy_two_unrelated_expected():
    # 2 Expected requirements: Python and FastAPI
    expected = [
        {"requirement_id": "REQ_1", "text": "Python", "group": "skills", "type": "REQUIRED"},
        {"requirement_id": "REQ_2", "text": "FastAPI", "group": "skills", "type": "REQUIRED"},
    ]
    # Only 1 extracted requirement: Python
    extracted = [
        {"requirement_id": "EXT_1", "text": "Python", "group": "skills", "type": "REQUIRED"},
    ]
    matched, fn, fp, dups = align_requirements_bipartite(expected, extracted)
    assert len(matched) == 1  # Matched to Python only
    assert len(fn) == 1        # FastAPI remains FN
    assert fn[0]["text"] == "FastAPI"
    assert len(fp) == 0


def test_unrelated_technologies_have_zero_similarity():
    sim = compute_requirement_similarity(
        {"text": "Python", "normalized_value": "python"},
        {"text": "JavaScript", "normalized_value": "javascript"},
    )
    assert sim == 0.0

    sim_docker_pg = compute_requirement_similarity(
        {"text": "Docker", "normalized_value": "docker"},
        {"text": "PostgreSQL", "normalized_value": "postgresql"},
    )
    assert sim_docker_pg == 0.0


def test_semantic_paraphrase_alignment():
    sim = compute_requirement_similarity(
        {"text": "Minimum 5 years backend development experience", "group": "experience_seniority"},
        {"text": "5+ years backend software engineer experience", "group": "experience_seniority"},
    )
    assert sim >= 0.70


def test_precision_and_recall_bounded_in_zero_one():
    expected = [
        {"requirement_id": f"REQ_{i}", "text": f"Skill_{i}", "group": "skills", "type": "REQUIRED"}
        for i in range(10)
    ]
    # Extracted has 5 matching, 10 spurious
    extracted = [
        {"requirement_id": f"EXT_{i}", "text": f"Skill_{i}", "group": "skills", "type": "REQUIRED"}
        for i in range(5)
    ] + [
        {"requirement_id": f"EXT_SPUR_{j}", "text": f"Spurious_{j}", "group": "skills", "type": "REQUIRED"}
        for j in range(10)
    ]

    matched, fn, fp, dups = align_requirements_bipartite(expected, extracted)
    tp = len(matched)
    assert tp == 5
    assert len(fn) == 5
    assert len(fp) == 10

    precision = tp / (tp + len(fp) + len(dups))
    recall = tp / (tp + len(fn))

    assert 0.0 <= precision <= 1.0
    assert 0.0 <= recall <= 1.0
    assert math.isclose(precision, 5 / 15, abs_tol=1e-4)
    assert math.isclose(recall, 5 / 10, abs_tol=1e-4)


def test_experience_accuracy_detects_lost_threshold():
    expected = [
        {
            "requirement_id": "REQ_EXP",
            "text": "5+ years Python backend",
            "group": "experience_seniority",
            "type": "REQUIRED",
            "minimum_years": 5.0,
        }
    ]
    # Mock parser that extracted Python skill but lost minimum_years threshold
    def mock_parser_lost_years(title: str, requirements_text: str):
        return {
            "requirements": [
                {
                    "requirement_id": "EXT_1",
                    "text": "Python backend",
                    "group": "skills",
                    "type": "REQUIRED",
                    "minimum_years": None,
                }
            ]
        }

    res = evaluate_job_extraction(
        job_id="TEST_JD",
        title="Python Dev",
        raw_jd_text="5+ years Python backend",
        expected_requirements=expected,
        parser_fn=mock_parser_lost_years,
    )
    assert res.true_positives == 1
    assert res.group_accuracy == 0.0        # Expected experience_seniority vs Predicted skills
    assert res.experience_accuracy == 0.0   # Lost 5.0 threshold
    assert len(res.structural_errors) == 1


def test_experience_accuracy_accepts_preserved_threshold():
    expected = [
        {
            "requirement_id": "REQ_EXP",
            "text": "5+ years Python backend",
            "group": "experience_seniority",
            "type": "REQUIRED",
            "minimum_years": 5.0,
        }
    ]
    def mock_parser_good(title: str, requirements_text: str):
        return {
            "requirements": [
                {
                    "requirement_id": "EXT_1",
                    "text": "5+ years Python backend",
                    "group": "experience_seniority",
                    "type": "REQUIRED",
                    "minimum_years": 5.0,
                }
            ]
        }

    res = evaluate_job_extraction(
        job_id="TEST_JD",
        title="Python Dev",
        raw_jd_text="5+ years Python backend",
        expected_requirements=expected,
        parser_fn=mock_parser_good,
    )
    assert res.true_positives == 1
    assert res.group_accuracy == 1.0
    assert res.experience_accuracy == 1.0
    assert len(res.structural_errors) == 0


def test_hard_constraint_alignment():
    expected = [
        {
            "requirement_id": "REQ_HC",
            "text": "Có quốc tịch Việt Nam hoặc giấy phép lao động hợp lệ",
            "group": "certifications_languages_other",
            "type": "HARD_CONSTRAINT",
            "is_hard_constraint": True,
        }
    ]
    def mock_parser_hc(title: str, requirements_text: str):
        return {
            "requirements": [
                {
                    "requirement_id": "EXT_HC",
                    "text": "Giấy phép lao động hợp lệ",
                    "group": "certifications_languages_other",
                    "type": "HARD_CONSTRAINT",
                    "is_hard_constraint": True,
                }
            ]
        }

    res = evaluate_job_extraction(
        job_id="TEST_JD",
        title="DevOps",
        raw_jd_text="Giấy phép lao động",
        expected_requirements=expected,
        parser_fn=mock_parser_hc,
    )
    assert res.true_positives == 1
    assert res.hard_constraint_accuracy == 1.0


def test_deterministic_bipartite_matching():
    expected = [
        {"requirement_id": f"REQ_{i}", "text": f"Requirement_{i}", "group": "skills", "type": "REQUIRED"}
        for i in range(15)
    ]
    extracted = [
        {"requirement_id": f"EXT_{i}", "text": f"Requirement_{i}", "group": "skills", "type": "REQUIRED"}
        for i in range(15)
    ]

    matched1, fn1, fp1, _ = align_requirements_bipartite(expected, extracted)
    matched2, fn2, fp2, _ = align_requirements_bipartite(expected, extracted)

    assert len(matched1) == len(matched2) == 15
    assert len(fn1) == len(fn2) == 0
    assert len(fp1) == len(fp2) == 0
    for (e1, x1, s1), (e2, x2, s2) in zip(matched1, matched2, strict=True):
        assert e1["requirement_id"] == e2["requirement_id"]
        assert x1["requirement_id"] == x2["requirement_id"]
        assert s1 == s2
