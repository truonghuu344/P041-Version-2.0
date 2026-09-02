"""Tests for the CV-JD Benchmark and Evaluation Framework."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from eval.datasets.loader import (  # noqa: E402
    CandidateCase,
    load_benchmark_dataset,
)
from eval.runners.error_analyzer import diagnose_inversion  # noqa: E402
from eval.runners.evaluator import BenchmarkEvaluator  # noqa: E402
from eval.runners.metrics import (  # noqa: E402
    calculate_binary_ranking_metrics,
    calculate_classification_metrics,
    calculate_mae,
    calculate_ndcg,
    calculate_pairwise_inversions,
    calculate_pearson_r,
    calculate_spearman_rho,
)


def test_ndcg_calculation_ideal_and_imperfect():
    # Ideal ranking: 4, 3, 2, 1, 0 -> NDCG@5 = 1.0
    ideal = [4, 3, 2, 1, 0]
    assert math.isclose(calculate_ndcg(ideal, k=5), 1.0, abs_tol=1e-4)

    # Sub-optimal ranking: 0, 1, 2, 3, 4 -> NDCG@5 < 0.7
    reverse = [0, 1, 2, 3, 4]
    ndcg_rev = calculate_ndcg(reverse, k=5)
    assert 0.0 < ndcg_rev < 0.7

    # All zeros
    assert calculate_ndcg([0, 0, 0], k=3) == 0.0

    # Empty
    assert calculate_ndcg([], k=5) == 0.0


def test_spearman_rho_and_tied_ranking():
    # Monotonic increasing
    x = [10.0, 20.0, 30.0, 40.0]
    y = [1.0, 2.0, 3.0, 4.0]
    assert math.isclose(calculate_spearman_rho(x, y), 1.0, abs_tol=1e-4)

    # Monotonic decreasing
    y_rev = [4.0, 3.0, 2.0, 1.0]
    assert math.isclose(calculate_spearman_rho(x, y_rev), -1.0, abs_tol=1e-4)

    # Tied ranks
    x_tied = [10.0, 20.0, 20.0, 40.0]
    y_tied = [1.0, 2.0, 3.0, 4.0]
    rho = calculate_spearman_rho(x_tied, y_tied)
    assert 0.8 < rho < 1.0

    # Constant vector
    assert calculate_spearman_rho([5.0, 5.0, 5.0], [1.0, 2.0, 3.0]) == 0.0


def test_pearson_r_and_mae():
    x = [10.0, 20.0, 30.0]
    y = [20.0, 40.0, 60.0]
    assert math.isclose(calculate_pearson_r(x, y), 1.0, abs_tol=1e-4)

    mae = calculate_mae([80.0, 60.0], [100.0, 50.0])
    assert math.isclose(mae, 15.0, abs_tol=1e-4)


def test_pairwise_inversions_and_tie_handling():
    # Candidates with clear human preferences: A(4) > B(3) > C(1)
    # System scores: A=90, B=80, C=40 -> 0 inversions, 3 correct pairs
    ranked_perfect = [
        {"cv_id": "A", "human_relevance": 4, "system_score": 90.0},
        {"cv_id": "B", "human_relevance": 3, "system_score": 80.0},
        {"cv_id": "C", "human_relevance": 1, "system_score": 40.0},
    ]
    res_perf = calculate_pairwise_inversions(ranked_perfect)
    assert res_perf["total_pairs"] == 3
    assert res_perf["correct_pairs"] == 3
    assert res_perf["inverted_pairs"] == 0
    assert res_perf["inversion_rate"] == 0.0

    # Inverted: System scores A=70, B=85, C=40 -> 1 inversion (A vs B)
    ranked_inverted = [
        {"cv_id": "B", "human_relevance": 3, "system_score": 85.0},
        {"cv_id": "A", "human_relevance": 4, "system_score": 70.0},
        {"cv_id": "C", "human_relevance": 1, "system_score": 40.0},
    ]
    res_inv = calculate_pairwise_inversions(ranked_inverted)
    assert res_inv["total_pairs"] == 3
    assert res_inv["inverted_pairs"] == 1
    assert res_inv["correct_pairs"] == 2
    assert math.isclose(res_inv["inversion_rate"], 1 / 3, abs_tol=1e-4)

    # Tied human relevance: D(4) and E(4) should be skipped from pairwise comparisons
    ranked_with_ties = [
        {"cv_id": "D", "human_relevance": 4, "system_score": 95.0},
        {"cv_id": "E", "human_relevance": 4, "system_score": 90.0},
        {"cv_id": "F", "human_relevance": 2, "system_score": 50.0},
    ]
    res_ties = calculate_pairwise_inversions(ranked_with_ties)
    assert res_ties["total_pairs"] == 2  # (D vs F) and (E vs F) only


def test_binary_ranking_metrics_with_threshold():
    # Relevances in system order: [4, 3, 1, 0, 2], threshold = 3.0 -> [1, 1, 0, 0, 0]
    metrics = calculate_binary_ranking_metrics([4, 3, 1, 0, 2], binary_threshold=3.0, k=5)
    assert metrics["precision_at_5"] == 0.4  # 2 relevant out of 5
    assert metrics["recall_at_5"] == 1.0     # 2 relevant out of 2 total
    assert metrics["mrr"] == 1.0             # First item at rank 1 is relevant


def test_classification_metrics_and_confusion_matrix():
    y_true = ["ELIGIBLE", "ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"]
    y_pred = ["ELIGIBLE", "UNKNOWN", "NOT_ELIGIBLE", "UNKNOWN"]
    metrics = calculate_classification_metrics(y_true, y_pred)
    assert metrics["accuracy"] == 0.75
    assert "ELIGIBLE" in metrics["confusion_matrix"]
    assert metrics["per_class"]["NOT_ELIGIBLE"]["f1"] == 1.0


def test_dataset_loader_validation_and_deterministic_splits(tmp_path):
    # Test valid dataset loading and deterministic splits
    dataset_file = ROOT / "eval" / "datasets" / "benchmark_dataset_v1.json"
    dataset = load_benchmark_dataset(dataset_file)
    assert len(dataset.jobs) == 10
    assert dataset.total_candidates > 50

    dev_jobs = dataset.get_split("dev")
    holdout_jobs = dataset.get_split("holdout")
    all_jobs = dataset.get_split("all")

    assert len(dev_jobs) == 5
    assert len(holdout_jobs) == 5
    assert len(all_jobs) == 10

    # Ensure deterministic split idempotency
    dev_ids_1 = [j.job_id for j in dataset.get_split("dev")]
    dev_ids_2 = [j.job_id for j in dataset.get_split("dev")]
    assert dev_ids_1 == dev_ids_2

    # Test invalid human score outside 0..4 raises ValueError
    invalid_candidate = CandidateCase(
        cv_id="INVALID_CV",
        cv_text="Python",
        cv_parsed={},
        human_relevance=5,  # Invalid (>4)
    )
    with pytest.raises(ValueError, match="invalid human_relevance"):
        invalid_candidate.validate()

    # Test invalid eligibility raises ValueError
    invalid_eligibility = CandidateCase(
        cv_id="INVALID_ELIG",
        cv_text="Python",
        cv_parsed={},
        human_relevance=3,
        eligibility="MAYBE",  # Invalid
    )
    with pytest.raises(ValueError, match="invalid eligibility"):
        invalid_eligibility.validate()


def test_error_analyzer_diagnoses_inversions():
    cand_better = {"cv_id": "CV_A", "human_relevance": 4}
    cand_worse = {"cv_id": "CV_B", "human_relevance": 2}

    # Case 1: Preferred inflation
    eval_better = {
        "final_score": 60.0,
        "eligibility_status": "ELIGIBLE",
        "evaluated_requirements": [
            {"requirement_id": "REQ_1", "type": "REQUIRED", "group": "skills", "weighted_score": 60.0},
        ],
    }
    eval_worse = {
        "final_score": 80.0,
        "eligibility_status": "ELIGIBLE",
        "evaluated_requirements": [
            {"requirement_id": "REQ_1", "type": "REQUIRED", "group": "skills", "weighted_score": 50.0},
            {"requirement_id": "PREF_1", "type": "PREFERRED", "group": "skills", "weighted_score": 30.0},
        ],
    }
    diagnosis = diagnose_inversion("JD_TEST", cand_better, cand_worse, eval_better, eval_worse)
    assert diagnosis["likely_failure_layer"] == "PREFERRED_GUARDRAIL_ERROR"

    # Case 2: Hard constraint mismatch
    eval_worse_hc = {
        "final_score": 85.0,
        "eligibility_status": "NOT_ELIGIBLE",
        "evaluated_requirements": [],
    }
    diagnosis_hc = diagnose_inversion("JD_TEST", cand_better, cand_worse, eval_better, eval_worse_hc)
    assert diagnosis_hc["likely_failure_layer"] == "HARD_CONSTRAINT_ERROR"


def test_evaluator_end_to_end_on_benchmark_subset():
    dataset_file = ROOT / "eval" / "datasets" / "benchmark_dataset_v1.json"
    dataset = load_benchmark_dataset(dataset_file)
    evaluator = BenchmarkEvaluator(scoring_version="test_scoring_v1")

    # Evaluate single job
    job = dataset.jobs[0]
    job_result = evaluator.evaluate_job(job)
    assert job_result["job_id"] == "JD-BE-001"
    assert job_result["ndcg_at_5"] > 0.8
    assert len(job_result["candidates"]) == len(job.candidates)

    # Evaluate full dev split
    report = evaluator.evaluate_dataset(dataset, split="dev")
    assert report["metadata"]["scoring_version"] == "test_scoring_v1"
    assert report["metadata"]["split"] == "dev"
    assert report["summary_metrics"]["ndcg_at_5"] > 0.8
    assert "error_analysis" in report
    assert "layer_metrics" in report
