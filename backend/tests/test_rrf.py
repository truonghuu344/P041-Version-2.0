"""Unit tests for the weighted Reciprocal Rank Fusion module."""

import pytest

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.bm25_retriever import RankedJob

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.rrf import weighted_rrf

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

BM25 = [
    RankedJob(jd_snapshot_id="jd-python", rank=1, score=5.0),
    RankedJob(jd_snapshot_id="jd-java", rank=2, score=3.5),
    RankedJob(jd_snapshot_id="jd-go", rank=3, score=2.0),
]

VECTOR = [
    RankedJob(jd_snapshot_id="jd-java", rank=1, score=0.95),
    RankedJob(jd_snapshot_id="jd-python", rank=2, score=0.88),
    RankedJob(jd_snapshot_id="jd-rust", rank=3, score=0.80),
]


# ---------------------------------------------------------------------------
# Core fusion behaviour
# ---------------------------------------------------------------------------


def test_rrf_merges_both_lists_with_correct_formula():
    fused = weighted_rrf(BM25, VECTOR, rrf_k=60, candidate_k=10)

    ids = [r.jd_snapshot_id for r in fused]
    assert "jd-python" in ids
    assert "jd-java" in ids
    assert "jd-go" in ids
    assert "jd-rust" in ids
    assert len(fused) == 4


def test_rrf_bm25_rank_different_from_vector_rank():
    """Verify fusion when BM25 rank differs from Vector rank."""
    bm25_list = [
        RankedJob(jd_snapshot_id="jd-backend", rank=1, score=10.0),
        RankedJob(jd_snapshot_id="jd-frontend", rank=5, score=2.0),
    ]
    vector_list = [
        RankedJob(jd_snapshot_id="jd-frontend", rank=1, score=0.99),
        RankedJob(jd_snapshot_id="jd-backend", rank=4, score=0.70),
    ]

    fused = weighted_rrf(bm25_list, vector_list, rrf_k=60)
    # jd-backend: 1/(60+1) + 1/(60+4) = 1/61 + 1/64 = 0.016393 + 0.015625 = 0.032018
    # jd-frontend: 1/(60+5) + 1/(60+1) = 1/65 + 1/61 = 0.015385 + 0.016393 = 0.031778
    assert fused[0].jd_snapshot_id == "jd-backend"
    assert fused[1].jd_snapshot_id == "jd-frontend"


def test_rrf_duplicate_jd_handling_and_deduplication():
    """JDs present in both BM25 and Vector are merged into a single entry without duplication."""
    bm25_list = [
        RankedJob(jd_snapshot_id="jd-shared", rank=1, score=5.0),
        RankedJob(jd_snapshot_id="jd-unique-bm25", rank=2, score=3.0),
    ]
    vector_list = [
        RankedJob(jd_snapshot_id="jd-shared", rank=1, score=0.9),
        RankedJob(jd_snapshot_id="jd-unique-vec", rank=2, score=0.8),
    ]
    fused = weighted_rrf(bm25_list, vector_list, candidate_k=10)

    # Must contain 3 unique items, not 4
    assert len(fused) == 3
    assert len(set(r.jd_snapshot_id for r in fused)) == 3
    assert fused[0].jd_snapshot_id == "jd-shared"


def test_rrf_scores_follow_formula():
    fused = weighted_rrf(BM25, VECTOR, rrf_k=60, bm25_weight=1.0, vector_weight=1.0)

    scores = {r.jd_snapshot_id: r.score for r in fused}

    # jd-python: bm25 rank=1, vector rank=2
    expected_python = 1.0 / (60 + 1) + 1.0 / (60 + 2)
    assert abs(scores["jd-python"] - round(expected_python, 8)) < 1e-7

    # jd-java: bm25 rank=2, vector rank=1
    expected_java = 1.0 / (60 + 2) + 1.0 / (60 + 1)
    assert abs(scores["jd-java"] - round(expected_java, 8)) < 1e-7

    # Same formula, same score → tied candidates
    assert scores["jd-python"] == scores["jd-java"]


def test_rrf_same_score_tie_break():
    """Tied RRF scores break ties deterministically by jd_snapshot_id ASC."""
    # Create two items with identical ranks
    bm25_list = [
        RankedJob(jd_snapshot_id="jd_zeta", rank=1, score=5.0),
        RankedJob(jd_snapshot_id="jd_alpha", rank=2, score=3.0),
    ]
    vec_list = [
        RankedJob(jd_snapshot_id="jd_alpha", rank=1, score=0.9),
        RankedJob(jd_snapshot_id="jd_zeta", rank=2, score=0.8),
    ]
    # Both have rank 1 in one list and rank 2 in the other -> exact same score
    fused = weighted_rrf(bm25_list, vec_list)
    assert fused[0].score == fused[1].score
    assert fused[0].jd_snapshot_id == "jd_alpha"
    assert fused[1].jd_snapshot_id == "jd_zeta"


def test_rrf_same_input_yields_same_ranking():
    """Deterministic guarantee: identical inputs produce identical ranking every time."""
    fused_1 = weighted_rrf(BM25, VECTOR, candidate_k=10)
    fused_2 = weighted_rrf(BM25, VECTOR, candidate_k=10)

    assert [(r.jd_snapshot_id, r.rank, r.score) for r in fused_1] == [
        (r.jd_snapshot_id, r.rank, r.score) for r in fused_2
    ]


def test_rrf_items_only_in_one_list_get_partial_score():
    fused = weighted_rrf(BM25, VECTOR, rrf_k=60)

    scores = {r.jd_snapshot_id: r.score for r in fused}

    # jd-go: only in BM25 rank=3
    expected_go = 1.0 / (60 + 3)
    assert abs(scores["jd-go"] - round(expected_go, 8)) < 1e-7

    # jd-rust: only in VECTOR rank=3
    expected_rust = 1.0 / (60 + 3)
    assert abs(scores["jd-rust"] - round(expected_rust, 8)) < 1e-7


def test_rrf_ranks_are_sequential():
    fused = weighted_rrf(BM25, VECTOR, rrf_k=60)
    assert [r.rank for r in fused] == list(range(1, len(fused) + 1))


def test_rrf_candidate_k_caps_output():
    fused = weighted_rrf(BM25, VECTOR, candidate_k=2)
    assert len(fused) == 2
    assert [r.rank for r in fused] == [1, 2]


def test_rrf_returns_fewer_when_catalog_is_small():
    """If only 2 unique JDs exist, return 2 even when candidate_k=30."""
    small_bm25 = [RankedJob(jd_snapshot_id="jd-a", rank=1, score=1.0)]
    small_vec = [RankedJob(jd_snapshot_id="jd-b", rank=1, score=0.9)]
    fused = weighted_rrf(small_bm25, small_vec, candidate_k=30)
    assert len(fused) == 2


def test_rrf_empty_inputs():
    assert weighted_rrf([], [], candidate_k=10) == []


def test_rrf_invalid_params():
    with pytest.raises(ValueError, match="rrf_k"):
        weighted_rrf(BM25, VECTOR, rrf_k=0)
    with pytest.raises(ValueError, match="candidate_k"):
        weighted_rrf(BM25, VECTOR, candidate_k=0)


def test_rrf_output_has_no_fit_score_fields():
    fused = weighted_rrf(BM25, VECTOR)
    assert not hasattr(fused[0], "raw_fit_score")
    assert not hasattr(fused[0], "display_fit_score")
