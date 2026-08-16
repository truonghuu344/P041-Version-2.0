"""Unit tests for Top K Recommendation Benchmark Suite (Bước 26)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

# pyrefly: ignore [missing-import]
from eval.top_k_benchmark.benchmark_top_k import (
    GOLDEN_SET_PATH,
    InMemorySemanticIndex,
    _dcg_at_k,
    _ndcg_at_k,
    run_benchmark_for_k,
)


def test_dcg_and_ndcg_calculation() -> None:
    """Test standard DCG and nDCG calculation against known values."""
    # Perfect ranking: [3, 2, 1]
    relevances = [3.0, 2.0, 1.0]
    ideal = [3.0, 2.0, 1.0]
    ndcg = _ndcg_at_k(relevances, ideal, k=3)
    assert pytest.approx(ndcg, 0.001) == 1.0

    # Sub-optimal ranking: [1, 2, 3] vs ideal [3, 2, 1]
    sub_optimal = [1.0, 2.0, 3.0]
    ndcg_sub = _ndcg_at_k(sub_optimal, ideal, k=3)
    assert 0.0 < ndcg_sub < 1.0

    # Zero relevance
    zeros = [0.0, 0.0, 0.0]
    assert _ndcg_at_k(zeros, ideal, k=3) == 0.0


def test_golden_dataset_integrity() -> None:
    """Verify the golden dataset exists and contains >= 50 valid cases."""
    assert GOLDEN_SET_PATH.exists(), f"Golden set not found at {GOLDEN_SET_PATH}"
    cases = json.loads(GOLDEN_SET_PATH.read_text(encoding="utf-8"))
    assert len(cases) >= 50, f"Expected >= 50 cases, found {len(cases)}"

    for case in cases:
        assert "cv_id" in case
        assert "cv_title" in case
        assert "skills" in case and isinstance(case["skills"], list) and len(case["skills"]) > 0
        assert "relevant_jds" in case and isinstance(case["relevant_jds"], dict)
        assert "ideal_top_3" in case and isinstance(case["ideal_top_3"], list)


def test_in_memory_semantic_index() -> None:
    """Test fast in-memory semantic indexing."""
    sample_jobs = [
        {"source_id": "JD-001", "title": "Python Developer", "skills": ["Python", "FastAPI"], "description": "Backend"},
        {"source_id": "JD-002", "title": "React Frontend", "skills": ["React", "TypeScript"], "description": "Frontend"},
    ]
    index = InMemorySemanticIndex(sample_jobs, vector_size=128)
    results = index.retrieve("Python FastAPI developer", k=2)

    assert len(results) == 2
    assert results[0].jd_snapshot_id == "JD-001"
    assert results[0].score >= results[1].score


def test_benchmark_runner_single_k() -> None:
    """Test benchmark runner for K=10 on a subset of 3 golden cases."""
    cases = json.loads(GOLDEN_SET_PATH.read_text(encoding="utf-8"))[:3]
    sample_jobs = [
        {"source_id": "JD-001", "title": "Software Engineer Intern - Backend", "skills": ["Python", "FastAPI", "Docker"], "description": "Backend API"},
        {"source_id": "JD-002", "title": "Senior Java Developer", "skills": ["Java", "Spring Boot", "Kafka"], "description": "Enterprise Core"},
        {"source_id": "JD-003", "title": "Frontend React Developer", "skills": ["React", "TypeScript", "Next.js"], "description": "Web UI"},
    ]
    index = InMemorySemanticIndex(sample_jobs, vector_size=128)

    summary, details = run_benchmark_for_k(
        golden_cases=cases,
        catalog_jobs=sample_jobs,
        semantic_index=index,
        candidate_k=10,
    )

    assert summary.total_cases == 3
    assert summary.candidate_k == 10
    assert 0.0 <= summary.avg_recall_at_k <= 1.0
    assert 0.0 <= summary.avg_ndcg_at_10 <= 1.0
    assert len(details) == 3
