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


def test_ranking_demotes_mandatory_gate_failures_before_fit_score():
    """An ineligible job cannot outrank an eligible job solely on fit score."""
    candidates = [
        {
            "jd_snapshot_id": "failed_mandatory",
            "display_fit_score": 49.0,
            "mandatory_requirement_failed": True,
        },
        {
            "jd_snapshot_id": "eligible",
            "display_fit_score": 40.0,
            "mandatory_requirement_failed": False,
        },
    ]

    ranked = rank_top_jobs(candidates)

    assert [job.jd_snapshot_id for job in ranked] == ["eligible", "failed_mandatory"]


def test_ranking_demotes_role_mismatch_even_with_higher_coverage():
    candidates = [
        {"jd_snapshot_id": "penetration", "display_fit_score": 90, "role_relevant": False, "application_ready": True},
        {"jd_snapshot_id": "backend", "display_fit_score": 40, "role_relevant": True, "application_ready": True},
    ]

    ranked = rank_top_jobs(candidates)

    assert [job.jd_snapshot_id for job in ranked] == ["backend", "penetration"]


def test_at_05_primary_beats_higher_scoring_adjacent_when_both_ready():
    """AT-05: JD AI adjacent score cao hơn JD Backend primary, cả hai ready -> JD primary xếp trước."""
    ranked = rank_top_jobs([
        {
            "jd_snapshot_id": "ai-adjacent",
            "title": "AI Engineer Intern",
            "display_fit_score": 53.8,
            "role_relevant": True,
            "role_track": "adjacent",
            "role_reason": "JD AI application có backend/API; phù hợp hướng phụ.",
            "mandatory_requirement_failed": False,
        },
        {
            "jd_snapshot_id": "backend-primary",
            "title": "NodeJS Fresher",
            "display_fit_score": 46.2,
            "role_relevant": True,
            "role_track": "primary",
            "role_reason": "Requirement/skills có tín hiệu Backend: express, node, rest.",
            "mandatory_requirement_failed": False,
        },
    ])
    assert [job.jd_snapshot_id for job in ranked] == ["backend-primary", "ai-adjacent"]
    assert ranked[0].rank == 1
    assert ranked[0].role_track == "primary"
    assert ranked[1].rank == 2
    assert ranked[1].role_track == "adjacent"


def test_at_06_adjacent_ready_beats_primary_mandatory_failed():
    """AT-06: JD primary fail mandatory, JD adjacent ready -> JD adjacent ready xếp trước."""
    ranked = rank_top_jobs([
        {
            "jd_snapshot_id": "backend-failed",
            "title": "Backend Intern",
            "display_fit_score": 49.0,
            "role_relevant": True,
            "role_track": "primary",
            "role_reason": "Requirement/skills có tín hiệu Backend.",
            "mandatory_requirement_failed": True,
        },
        {
            "jd_snapshot_id": "ai-ready",
            "title": "AI Engineer Intern",
            "display_fit_score": 53.8,
            "role_relevant": True,
            "role_track": "adjacent",
            "role_reason": "JD AI application có backend/API.",
            "mandatory_requirement_failed": False,
        },
    ])
    assert [job.jd_snapshot_id for job in ranked] == ["ai-ready", "backend-failed"]
    assert ranked[0].jd_snapshot_id == "ai-ready"
    assert ranked[0].application_ready is True
    assert ranked[1].jd_snapshot_id == "backend-failed"
    assert ranked[1].application_ready is False


def test_at_07_fit_score_evidence_mandatory_gate_unchanged():
    """AT-07: Fit score, evidence quote, mandatory gate không đổi -> Chỉ đổi thứ tự/nhãn role."""
    candidate = {
        "jd_snapshot_id": "job-sample",
        "display_fit_score": 46.2,
        "raw_fit_score": 46.2,
        "role_relevant": True,
        "role_track": "primary",
        "role_reason": "Requirement/skills có tín hiệu Backend.",
        "mandatory_requirement_failed": False,
        "required_skills_coverage": 0.86,
        "mandatory_requirements_matched": 6,
        "total_mandatory_requirements": 7,
        "user_explanation": {
            "verdict": "Có các điểm phù hợp có thể kiểm chứng với yêu cầu của vị trí.",
            "matched_requirements": [{"requirement": "Node.js", "status": "SUPPORTED", "cv_evidence_quotes": ["Node.js project"]}],
        },
    }
    ranked = rank_top_jobs([candidate])
    job = ranked[0]
    assert job.display_fit_score == 46.2
    assert job.raw_fit_score == 46.2
    assert job.required_skills_coverage == 0.86
    assert job.mandatory_requirement_failed is False
    assert job.user_explanation["matched_requirements"][0]["cv_evidence_quotes"] == ["Node.js project"]


def test_at_08_api_exposes_role_track_and_role_reason():
    """AT-08: API trả role_track và role_reason để giải thích tại sao xếp hạng."""
    ranked = rank_top_jobs([
        {
            "jd_snapshot_id": "node-job",
            "display_fit_score": 46.2,
            "role_relevant": True,
            "role_track": "primary",
            "role_reason": "Requirement/skills có tín hiệu Backend: express, node.",
            "mandatory_requirement_failed": False,
        }
    ])
    item_dict = ranked[0].to_dict()
    assert item_dict["role_track"] == "primary"
    assert item_dict["role_reason"] == "Requirement/skills có tín hiệu Backend: express, node."
    assert item_dict["user_explanation"]["role_track"] == "primary"
    assert item_dict["user_explanation"]["role_reason"] == "Requirement/skills có tín hiệu Backend: express, node."


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


def test_low_fit_verdict_only_calls_rank_one_closest_available():
    candidates = [
        {"jd_snapshot_id": "job_one", "display_fit_score": 45, "mandatory_requirement_failed": True, "user_explanation": {"verdict": "old"}},
        {"jd_snapshot_id": "job_two", "display_fit_score": 40, "mandatory_requirement_failed": True, "user_explanation": {"verdict": "old"}},
    ]
    ranked = rank_top_jobs(candidates)

    assert "gần nhất" in ranked[0].user_explanation["verdict"]
    assert "xếp hạng #2" in ranked[1].user_explanation["verdict"]


def test_vl_01_ready_job_with_sub_50_score_has_positive_verdict():
    """VL-01: JD application_ready=true, mandatory_failed=false, điểm < 50 phải có verdict tích cực."""
    candidates = [
        {
            "jd_snapshot_id": "node-fresher",
            "title": "JOB OPENING: FRESHER NODEJS (MERN STACK)",
            "display_fit_score": 46.2,
            "mandatory_requirement_failed": False,
            "application_ready": True,
            "role_relevant": True,
            "role_track": "primary",
            "user_explanation": {"verdict": "old"},
        }
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].application_ready is True
    assert "Chưa phù hợp" not in ranked[0].user_explanation["verdict"]
    assert "phù hợp" in ranked[0].user_explanation["verdict"].casefold()


def test_vl_02_ready_job_fit_label_preserves_readiness():
    """VL-02: JD application_ready=true, điểm < 50 được gắn nhãn tối thiểu 'Tiềm năng'."""
    candidates = [
        {
            "jd_snapshot_id": "node-fresher",
            "title": "JOB OPENING: FRESHER NODEJS (MERN STACK)",
            "display_fit_score": 46.2,
            "mandatory_requirement_failed": False,
            "application_ready": True,
            "role_relevant": True,
            "role_track": "primary",
        }
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].fit_label in ("Tiềm năng", "Phù hợp", "Rất phù hợp")
    assert ranked[0].fit_label != "Cần cải thiện"


def test_vl_03_failed_mandatory_verdict_and_label():
    """VL-03: JD mandatory_failed=true có verdict nêu rõ chưa đạt yêu cầu bắt buộc và label 'Cần cải thiện'."""
    candidates = [
        {
            "jd_snapshot_id": "python-intern",
            "title": "Python Internship",
            "display_fit_score": 49.0,
            "mandatory_requirement_failed": True,
            "application_ready": False,
            "role_relevant": True,
            "role_track": "primary",
            "user_explanation": {"verdict": "old"},
        }
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].mandatory_requirement_failed is True
    assert ranked[0].application_ready is False
    assert ranked[0].fit_label == "Cần cải thiện"


def test_vl_04_adjacent_track_verdict_and_reasoning():
    """VL-04: JD adjacent có role_track='adjacent' và giải thích phù hợp hướng phụ."""
    candidates = [
        {
            "jd_snapshot_id": "ai-intern",
            "title": "AI Engineer Intern",
            "display_fit_score": 53.8,
            "mandatory_requirement_failed": False,
            "application_ready": True,
            "role_relevant": True,
            "role_track": "adjacent",
            "role_reason": "JD AI application có backend/API; phù hợp hướng phụ so với Backend/Fullstack.",
            "user_explanation": {"verdict": "old"},
        }
    ]
    ranked = rank_top_jobs(candidates)
    assert ranked[0].role_track == "adjacent"
    assert "hướng phụ" in ranked[0].role_reason


def test_vl_05_mismatch_track_demoted():
    """VL-05: JD mismatch bị xếp sau các JD role_relevant."""
    candidates = [
        {
            "jd_snapshot_id": "pen-tester",
            "title": "Penetration Tester",
            "display_fit_score": 80.0,
            "mandatory_requirement_failed": False,
            "application_ready": True,
            "role_relevant": False,
            "role_track": "mismatch",
        },
        {
            "jd_snapshot_id": "backend-dev",
            "title": "Backend Developer",
            "display_fit_score": 45.0,
            "mandatory_requirement_failed": False,
            "application_ready": True,
            "role_relevant": True,
            "role_track": "primary",
        },
    ]
    ranked = rank_top_jobs(candidates)
    assert [j.jd_snapshot_id for j in ranked] == ["backend-dev", "pen-tester"]


def test_vl_07_full_tiered_ranking_invariants():
    """VL-07: Invariant: Primary Ready > Adjacent Ready > Primary Failed > Adjacent Failed > Mismatch."""
    candidates = [
        {"jd_snapshot_id": "mismatch", "display_fit_score": 90.0, "role_relevant": False, "role_track": "mismatch", "mandatory_requirement_failed": False},
        {"jd_snapshot_id": "adj_fail", "display_fit_score": 49.0, "role_relevant": True, "role_track": "adjacent", "mandatory_requirement_failed": True},
        {"jd_snapshot_id": "prim_fail", "display_fit_score": 49.0, "role_relevant": True, "role_track": "primary", "mandatory_requirement_failed": True},
        {"jd_snapshot_id": "adj_ready", "display_fit_score": 60.0, "role_relevant": True, "role_track": "adjacent", "mandatory_requirement_failed": False},
        {"jd_snapshot_id": "prim_ready", "display_fit_score": 45.0, "role_relevant": True, "role_track": "primary", "mandatory_requirement_failed": False},
    ]
    ranked = rank_top_jobs(candidates)
    assert [j.jd_snapshot_id for j in ranked] == [
        "prim_ready",
        "adj_ready",
        "prim_fail",
        "adj_fail",
        "mismatch",
    ]

