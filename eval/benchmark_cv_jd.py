"""Deterministic benchmark for the evidence-based CV–JD matching pipeline."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

os.environ["CV_JD_EMBEDDING_PROVIDER"] = "hashing"

from src.services.cv_jd_matching import PIPELINE_VERSION, build_cv_jd_evidence

ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = ROOT / "eval" / "cv_jd_cases.json"
RESULT_PATH = ROOT / "eval" / "results" / "cv_jd_report.json"


def _recall(expected: set[str], actual: set[str]) -> float:
    return 1.0 if not expected else len(expected.intersection(actual)) / len(expected)


def run_benchmark() -> dict[str, Any]:
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    details = []
    for case in cases:
        result = build_cv_jd_evidence(
            cv_text=case["cv_text"],
            parsed_cv=case["cv_parsed"],
            jd_title=case["jd_title"],
            jd_requirements=case["jd_requirements"],
        )
        expected_matching = set(case.get("expected_matching", []))
        expected_missing = set(case.get("expected_missing", []))
        expected_partial = set(case.get("expected_partial", []))
        actual_matching = set(result["hard_skills_matching"])
        actual_missing = set(result["hard_skills_missing"])
        actual_partial = set(result["hard_skills_partial"])
        assertions = {
            "matching_recall": _recall(expected_matching, actual_matching),
            "missing_recall": _recall(expected_missing, actual_missing),
            "partial_recall": _recall(expected_partial, actual_partial),
            "level_correct": case.get("expected_level") in {None, result["match_level"]},
            "score_gate_correct": result["match_score"] <= case.get("max_score", 100),
            "must_coverage_correct": (
                "expected_must_coverage" not in case
                or result["must_have_coverage"] == case["expected_must_coverage"]
            ),
            "unknown_soft_correct": (
                not case.get("expected_unknown_soft")
                or any(
                    item["requirement_type"] == "soft_skill" and item["status"] == "unknown"
                    for item in result["requirement_evidence"]
                )
            ),
            "score_range": 0 <= result["final_score"] <= 100,
            "score_traceable": result["final_score"]
            == round(sum(item["weighted_score"] for item in result["criteria"]), 1),
            "weights_valid": sum(item["weight"] for item in result["criteria"]) == 100,
            "evidence_traceable": all(
                evidence["requirement_id"] and evidence["chunk_id"]
                for evidence in result["evidence"]
            ),
            "states_complete": [item["pipeline_step"] for item in result["processing_trace"]]
            == [
                "PENDING",
                "PARSING",
                "EXTRACTING",
                "NORMALIZING",
                "CHUNKING",
                "INDEXING",
                "RETRIEVING",
                "EVALUATING",
                "COMPLETED",
            ],
        }
        passed = (
            assertions["matching_recall"] == 1
            and assertions["missing_recall"] == 1
            and assertions["partial_recall"] == 1
            and all(value for key, value in assertions.items() if not key.endswith("recall"))
        )
        details.append(
            {
                "case_id": case["case_id"],
                "passed": passed,
                "match_score": result["match_score"],
                "match_level": result["match_level"],
                "confidence_score": result["confidence_score"],
                "assertions": assertions,
            }
        )

    high_scores = [item["match_score"] for item in details if item["case_id"] in {"high_backend", "frontend_exact_stack"}]
    negative_scores = [item["match_score"] for item in details if item["case_id"] in {"low_missing_core_stack", "java_not_javascript", "cpp_not_csharp"}]
    report = {
        "pipeline_version": PIPELINE_VERSION,
        "total_cases": len(details),
        "passed_cases": sum(item["passed"] for item in details),
        "pass_rate": round(sum(item["passed"] for item in details) / max(1, len(details)), 4),
        "score_separation": {
            "positive_mean": round(sum(high_scores) / max(1, len(high_scores)), 2),
            "negative_mean": round(sum(negative_scores) / max(1, len(negative_scores)), 2),
            "passed": bool(high_scores and negative_scores and min(high_scores) > max(negative_scores)),
        },
        "details": details,
    }
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(run_benchmark(), ensure_ascii=False, indent=2))
