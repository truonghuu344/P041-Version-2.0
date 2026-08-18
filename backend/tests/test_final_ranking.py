"""Unit tests for the final ranking and Top-10 selection module."""

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import rank_top_jobs


def test_ranking_display_fit_score_descending():
    """Higher display fit score ranks first."""
    candidates = [
        {"jd_snapshot_id": "job_low", "display_fit_score": 70.0},
        {"jd_snapshot_id": "job_high", "display_fit_score": 90.0},
        {"jd_snapshot_id": "job_mid", "display_fit_score": 80.0},
    ]
    ranked = rank_top_jobs(candidates)
    assert [j.jd_snapshot_id for j in ranked] == ["job_high", "job_mid", "job_low"]
    assert [j.rank for j in ranked] == [1, 2, 3]


def test_ranking_tiebreak_level2_required_skills_coverage():
    """Tied display score -> higher required_skills_coverage ranks first."""
    candidates = [
        {"jd_snapshot_id": "job_cov_low", "display_fit_score": 85.0, "required_skills_coverage": 0.70},
        {"jd_snapshot_id": "job_cov_high", "display_fit_score": 85.0, "required_skills_coverage": 0.95},
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].jd_snapshot_id == "job_cov_high"
    assert ranked[1].jd_snapshot_id == "job_cov_low"


def test_ranking_tiebreak_level3_supported_requirements_count():
    """Tied score & coverage -> higher supported_requirements_count ranks first."""
    candidates = [
        {
            "jd_snapshot_id": "job_supp_5",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 5,
        },
        {
            "jd_snapshot_id": "job_supp_9",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 9,
        },
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].jd_snapshot_id == "job_supp_9"
    assert ranked[1].jd_snapshot_id == "job_supp_5"


def test_ranking_tiebreak_level4_rrf_rank():
    """Tied score, coverage & supported count -> lower (better) rrf_rank ranks first."""
    candidates = [
        {
            "jd_snapshot_id": "job_rrf_10",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 8,
            "rrf_rank": 10,
        },
        {
            "jd_snapshot_id": "job_rrf_2",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 8,
            "rrf_rank": 2,
        },
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].jd_snapshot_id == "job_rrf_2"
    assert ranked[1].jd_snapshot_id == "job_rrf_10"


def test_ranking_tiebreak_level5_jd_snapshot_id_alphabetical():
    """All metrics identical -> alphabetical jd_snapshot_id tie-breaker."""
    candidates = [
        {
            "jd_snapshot_id": "jd_zeta",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 8,
            "rrf_rank": 5,
        },
        {
            "jd_snapshot_id": "jd_alpha",
            "display_fit_score": 85.0,
            "required_skills_coverage": 0.80,
            "supported_requirements_count": 8,
            "rrf_rank": 5,
        },
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].jd_snapshot_id == "jd_alpha"
    assert ranked[1].jd_snapshot_id == "jd_zeta"


def test_ranking_selects_top_10_only():
    """From 15 candidates, returns exactly top 10 with sequential ranks 1..10."""
    candidates = [
        {"jd_snapshot_id": f"job_{i:02d}", "display_fit_score": 50.0 + i}
        for i in range(15)
    ]
    ranked = rank_top_jobs(candidates, top_k=10)
    assert len(ranked) == 10
    assert [j.rank for j in ranked] == list(range(1, 11))
    assert ranked[0].jd_snapshot_id == "job_14"  # highest score (50 + 14 = 64)
    assert ranked[9].jd_snapshot_id == "job_05"  # 10th highest


def test_ranking_empty_or_small_catalog():
    assert rank_top_jobs([]) == []

    small = [{"jd_snapshot_id": "only_one", "display_fit_score": 75.0}]
    ranked = rank_top_jobs(small, top_k=10)
    assert len(ranked) == 1
    assert ranked[0].rank == 1
