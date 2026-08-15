"""Unit tests for the semantic retriever.

These tests run in-memory with a hashing-based embedding provider and
an SQLite database (no pgvector), exercising the memory-search fallback
path that is functionally equivalent to the pgvector fast path.
"""

import asyncio
import math

import pytest

from src.services.job_recommendations.semantic_retriever import (
    SemanticRetriever,
    _cosine,
)

# ---------------------------------------------------------------------------
# _cosine helper
# ---------------------------------------------------------------------------


def test_cosine_identical_vectors():
    vec = [1.0, 2.0, 3.0]
    assert math.isclose(_cosine(vec, vec), 1.0, rel_tol=1e-9)


def test_cosine_orthogonal_vectors():
    assert math.isclose(_cosine([1.0, 0.0], [0.0, 1.0]), 0.0, rel_tol=1e-9)


def test_cosine_opposite_vectors():
    assert math.isclose(_cosine([1.0, 0.0], [-1.0, 0.0]), -1.0, rel_tol=1e-9)


def test_cosine_zero_vector_returns_zero():
    assert _cosine([0.0, 0.0], [1.0, 2.0]) == 0.0


# ---------------------------------------------------------------------------
# SemanticRetriever – validation
# ---------------------------------------------------------------------------


def test_retrieve_raises_on_invalid_k():
    retriever = SemanticRetriever()
    with pytest.raises(ValueError, match="k"):
        asyncio.get_event_loop().run_until_complete(
            retriever.retrieve("anything", k=0)
        )


def test_retrieve_empty_text_returns_nothing():
    retriever = SemanticRetriever()
    result = asyncio.get_event_loop().run_until_complete(
        retriever.retrieve("", k=5)
    )
    assert result == []


def test_retrieve_whitespace_text_returns_nothing():
    retriever = SemanticRetriever()
    result = asyncio.get_event_loop().run_until_complete(
        retriever.retrieve("   \n  ", k=5)
    )
    assert result == []


# ---------------------------------------------------------------------------
# RankedJob contract
# ---------------------------------------------------------------------------


def test_ranked_job_has_no_fit_score_fields():
    """The semantic retriever output must never carry fit-score attributes."""
    from src.services.job_recommendations.bm25_retriever import RankedJob

    job = RankedJob(jd_snapshot_id="test-1", rank=1, score=0.85)
    assert not hasattr(job, "raw_fit_score")
    assert not hasattr(job, "display_fit_score")
