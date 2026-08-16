"""Weighted Reciprocal Rank Fusion (RRF) for Top Jobs candidate merging.

Combines the BM25 and semantic (vector) ranked lists into a single
candidate list.  The fused score is a **retrieval-only** signal used
solely to decide which JDs proceed to the evidence/rubric evaluation
stage — it must never be surfaced as a CV-JD fit score.
"""

from __future__ import annotations

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.bm25_retriever import RankedJob


def weighted_rrf(
    bm25_results: list[RankedJob],
    vector_results: list[RankedJob],
    *,
    rrf_k: int = 60,
    bm25_weight: float = 1.0,
    vector_weight: float = 1.0,
    candidate_k: int = 30,
) -> list[RankedJob]:
    """Merge two ranked lists using weighted Reciprocal Rank Fusion.

    Parameters
    ----------
    bm25_results:
        Ranked candidates from the BM25 retriever.
    vector_results:
        Ranked candidates from the semantic (vector) retriever.
    rrf_k:
        Smoothing constant (default 60).  Higher values reduce the
        influence of top-ranked items.
    bm25_weight:
        Multiplicative weight for the BM25 signal.
    vector_weight:
        Multiplicative weight for the vector signal.
    candidate_k:
        Maximum number of fused candidates to return.  If fewer unique
        candidates exist across both lists, all of them are returned
        (no padding).

    Returns
    -------
    list[RankedJob]
        Up to ``candidate_k`` candidates sorted by descending RRF score,
        with stable tie-breaking by ``jd_snapshot_id``.
    """
    if rrf_k < 1:
        raise ValueError("rrf_k must be at least 1.")
    if candidate_k < 1:
        raise ValueError("candidate_k must be at least 1.")

    bm25_ranks: dict[str, int] = {r.jd_snapshot_id: r.rank for r in bm25_results}
    vector_ranks: dict[str, int] = {r.jd_snapshot_id: r.rank for r in vector_results}

    all_ids = dict.fromkeys(
        [r.jd_snapshot_id for r in bm25_results]
        + [r.jd_snapshot_id for r in vector_results]
    )

    scored: list[tuple[str, float]] = []
    for jd_id in all_ids:
        score = 0.0
        if jd_id in bm25_ranks:
            score += bm25_weight / (rrf_k + bm25_ranks[jd_id])
        if jd_id in vector_ranks:
            score += vector_weight / (rrf_k + vector_ranks[jd_id])
        scored.append((jd_id, score))

    # Descending by score, ascending by jd_snapshot_id for stable tie-breaking.
    scored.sort(key=lambda item: (-item[1], item[0]))

    return [
        RankedJob(jd_snapshot_id=jd_id, rank=index, score=round(score, 8))
        for index, (jd_id, score) in enumerate(scored[:candidate_k], start=1)
    ]
