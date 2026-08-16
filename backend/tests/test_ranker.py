"""Unit tests for the final ranker service."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import rank_top_jobs


def test_ranker_same_score_5_level_tie_break():
    """Verify complete 5-level tie breaking chain."""
    # 1. Level 1: display_fit_score DESC
    c1 = [
        {"jd_snapshot_id": "job_a", "display_fit_score": 75.0},
        {"jd_snapshot_id": "job_b", "display_fit_score": 90.0},
    ]
    assert rank_top_jobs(c1)[0].jd_snapshot_id == "job_b"

    # 2. Level 2: required_skills_coverage DESC
    c2 = [
        {"jd_snapshot_id": "job_a", "display_fit_score": 85.0, "required_skills_coverage": 0.60},
        {"jd_snapshot_id": "job_b", "display_fit_score": 85.0, "required_skills_coverage": 0.90},
    ]
    assert rank_top_jobs(c2)[0].jd_snapshot_id == "job_b"

    # 3. Level 3: supported_requirements_count DESC
    c3 = [
        {"jd_snapshot_id": "job_a", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 4},
        {"jd_snapshot_id": "job_b", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 9},
    ]
    assert rank_top_jobs(c3)[0].jd_snapshot_id == "job_b"

    # 4. Level 4: rrf_rank ASC (better initial retrieval rank first)
    c4 = [
        {"jd_snapshot_id": "job_a", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 5, "rrf_rank": 8},
        {"jd_snapshot_id": "job_b", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 5, "rrf_rank": 2},
    ]
    assert rank_top_jobs(c4)[0].jd_snapshot_id == "job_b"

    # 5. Level 5: jd_snapshot_id ASC (lexicographical tie-breaker)
    c5 = [
        {"jd_snapshot_id": "jd_zeta", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 5, "rrf_rank": 2},
        {"jd_snapshot_id": "jd_alpha", "display_fit_score": 85.0, "required_skills_coverage": 0.80, "supported_requirements_count": 5, "rrf_rank": 2},
    ]
    assert rank_top_jobs(c5)[0].jd_snapshot_id == "jd_alpha"


def test_ranker_same_input_produces_same_ranking():
    """Deterministic guarantee: same candidate input produces identical ranking output."""
    candidates = [
        {"jd_snapshot_id": f"job_{i}", "display_fit_score": 60.0 + (i % 7), "required_skills_coverage": 0.5 + (i % 3) * 0.2}
        for i in range(20)
    ]
    run_1 = rank_top_jobs(candidates, top_k=10)
    run_2 = rank_top_jobs(candidates, top_k=10)

    assert [j.job_id for j in run_1] == [j.job_id for j in run_2]
    assert [j.rank for j in run_1] == [j.rank for j in run_2]
    assert [j.display_fit_score for j in run_1] == [j.display_fit_score for j in run_2]


def test_ranker_score_bounds_within_0_100():
    """All output scores are properly clamped and valid within [0.0, 100.0]."""
    candidates = [
        {"jd_snapshot_id": "job_min", "display_fit_score": 0.0, "raw_fit_score": 0.0},
        {"jd_snapshot_id": "job_max", "display_fit_score": 100.0, "raw_fit_score": 100.0},
    ]
    ranked = rank_top_jobs(candidates)
    for job in ranked:
        assert 0.0 <= job.display_fit_score <= 100.0
        assert 0.0 <= job.raw_fit_score <= 100.0
        assert 0.0 <= job.confidence_score <= 1.0


def test_ranker_returns_at_most_top_10():
    candidates = [{"jd_snapshot_id": f"job_{i}", "display_fit_score": float(i)} for i in range(25)]
    ranked = rank_top_jobs(candidates, top_k=10)
    assert len(ranked) == 10
    assert [j.rank for j in ranked] == list(range(1, 11))
