"""Unit tests for the TopJobRecommendationService orchestrator."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

# pyrefly: ignore [missing-import]
from src.db.models import CVSnapshot

# pyrefly: ignore [missing-import]
from src.schemas.job_recommendation import JobRecommendationRequest

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.bm25_retriever import RankedJob

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.service import (
    TopJobRecommendationService,
    _build_user_explanation,
    _ready_candidate_boost,
    _rerank_by_metadata_preference,
    _reserve_ready_role_candidates,
)


@pytest.mark.asyncio
async def test_recommend_jobs_full_orchestration_flow():
    """Verify the complete end-to-end recommendation flow."""
    # 1. Setup mock database session & models
    mock_db = AsyncMock()

    mock_cv = MagicMock(spec=CVSnapshot)
    mock_cv.id = "cv_snap_001"
    mock_cv.user_id = "user_123"
    mock_cv.raw_text = "Experienced Backend Python FastAPI Engineer with PostgreSQL skills."
    mock_cv.profile_json = {
        "title": "Backend Engineer",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    }

    # First scalar call loads CVSnapshot; no completed MatchRun exists.
    mock_db.scalar = AsyncMock(side_effect=[mock_cv, None, None, None, None])
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    # 2. Setup mock job catalog
    catalog = [
        {
            "source_id": "job_01",
            "title": "Senior Python Developer",
            "company": "Tech Corp",
            "location": "Hà Nội",
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "description": "Develop high-scale backend services with Python.",
        },
        {
            "source_id": "job_02",
            "title": "Junior Java Developer",
            "company": "Enterprise Ltd",
            "location": "Hồ Chí Minh",
            "skills": ["Java", "Spring Boot"],
            "description": "Java development with Spring.",
        },
    ]

    service = TopJobRecommendationService()

    request = JobRecommendationRequest(
        cv_snapshot_id="cv_snap_001",
        role="Backend",
    )

    run_id, top_jobs = await service.recommend_jobs(
        mock_db,
        user_id="user_123",
        request=request,
        catalog=catalog,
    )

    assert run_id is not None
    assert len(top_jobs) == 2
    assert top_jobs[0].rank == 1
    assert top_jobs[0].job_id == "job_01"
    assert top_jobs[0].display_fit_score > 0.0
    assert top_jobs[0].fit_label != "Chua danh gia CV-JD"
    assert top_jobs[0].match_id == "PREVIEW_job_01"

    # Verify db.add was called for run and top recommendations
    assert mock_db.add.call_count >= 1


@pytest.mark.asyncio
async def test_recommend_jobs_unauthorized_cv_raises_value_error():
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=None)  # Not found / unauthorized

    service = TopJobRecommendationService()
    request = JobRecommendationRequest(cv_snapshot_id="non_existent_cv")

    with pytest.raises(ValueError, match="not found or does not belong to user"):
        await service.recommend_jobs(
            mock_db,
            user_id="user_123",
            request=request,
        )


@pytest.mark.asyncio
async def test_existing_match_is_reused_without_running_a_new_match(monkeypatch):
    from src.services.job_recommendations import service as recommendation_service

    snapshot = MagicMock(id="cv-1")
    existing = MagicMock(
        id="match-existing",
        result_json={"criteria": [], "requirements": {"matched": [], "missing": []}},
    )
    find_match = AsyncMock(return_value=existing)
    monkeypatch.setattr(recommendation_service, "find_existing_match", find_match)

    result = await TopJobRecommendationService().evaluate_candidate(
        AsyncMock(),
        cv_snapshot=snapshot,
        candidate_retrieval=RankedJob(jd_snapshot_id="jd-1", rank=1, score=1.0),
        job_catalog_map={"jd-1": {"source_id": "jd-1", "title": "Backend Engineer"}},
    )

    assert result["match_id"] == "match-existing"
    assert result["display_fit_score"] == 0.0
    find_match.assert_awaited_once()


def test_metadata_preference_reranks_candidates_without_changing_fit_score():
    candidates = [
        RankedJob(jd_snapshot_id="generic", rank=1, score=1.0),
        RankedJob(jd_snapshot_id="preferred", rank=2, score=1.0),
    ]
    ranked = _rerank_by_metadata_preference(
        candidates,
        {
            "generic": {"metadata_preference_score": 0.0},
            "preferred": {"metadata_preference_score": 100.0},
        },
    )

    assert [candidate.jd_snapshot_id for candidate in ranked] == ["preferred", "generic"]
    assert [candidate.rank for candidate in ranked] == [1, 2]


def test_ready_candidate_reserve_keeps_role_relevant_entry_level_job_in_pool():
    catalog = {
        "generic": {"role_relevant": True, "ready_candidate_boost": 0.0},
        "ready": {"role_relevant": True, "ready_candidate_boost": 0.15},
        "security": {"role_relevant": False, "ready_candidate_boost": 0.0},
    }
    selected = _reserve_ready_role_candidates(
        [RankedJob(jd_snapshot_id="generic", rank=1, score=1.0)],
        catalog,
        candidate_k=2,
        reserve=1,
    )

    assert [candidate.jd_snapshot_id for candidate in selected] == ["ready", "generic"]


def test_ready_candidate_boost_is_bounded_and_never_applies_to_role_mismatch():
    ready_job = {
        "role_relevant": True,
        "job_level": "Junior",
        "title": "Python React Developer",
        "skills": ["Python", "React", "AI", "JavaScript"],
    }
    mismatched_job = {**ready_job, "role_relevant": False, "title": "Penetration Tester"}
    retrieval_text = "Python React AI JavaScript backend projects"

    assert 0.0 < _ready_candidate_boost(ready_job, retrieval_text) <= 0.15
    assert _ready_candidate_boost(mismatched_job, retrieval_text) == 0.0


@pytest.mark.asyncio
async def test_semantic_results_outside_hard_filtered_catalog_are_excluded(monkeypatch):
    """A global vector index must not reintroduce jobs rejected by filters."""
    from src.services.job_recommendations import service as recommendation_service

    class FakeSemanticRetriever:
        def __init__(self, *, settings):
            self.settings = settings

        async def retrieve(self, *_args, **_kwargs):
            return [
                RankedJob(jd_snapshot_id="allowed-01", rank=1, score=0.9),
                RankedJob(jd_snapshot_id="outside-filter", rank=2, score=0.8),
            ]

    monkeypatch.setattr(recommendation_service, "SemanticRetriever", FakeSemanticRetriever)
    service = TopJobRecommendationService(
        settings=SimpleNamespace(
            job_recommend_bm25_k=5,
            job_recommend_vector_k=5,
            job_recommend_rrf_k=60,
            job_recommend_bm25_weight=1.0,
            job_recommend_vector_weight=1.0,
        )
    )
    filtered_catalog = [
        {
            "source_id": f"allowed-{index:02d}",
            "description": "Python backend FastAPI service",
            "metadata_preference_score": 0.0,
        }
        for index in range(1, 32)
    ]

    candidates = await service.retrieve_candidates(
        cv_retrieval_text="Python FastAPI backend",
        filtered_jobs=filtered_catalog,
        candidate_k=5,
    )

    assert candidates
    assert {candidate.jd_snapshot_id for candidate in candidates}.issubset(
        {job["source_id"] for job in filtered_catalog}
    )
    assert all(candidate.jd_snapshot_id != "outside-filter" for candidate in candidates)


def test_user_explanation_is_evidence_first_and_actionable_for_low_fit():
    explanation = _build_user_explanation(
        {
            "criteria": [
                {
                    "criterion_id": "CRIT_REQUIRED_SKILL",
                    "raw_score": 57.1,
                    "weight": 53.8,
                    "weighted_score": 30.8,
                    "status": "PARTIALLY_SUPPORTED",
                    "reason": "4/7 requirement được hỗ trợ đầy đủ.",
                }
            ],
            "requirements": {
                "matched": [
                    {
                        "requirement_id": "req-react",
                        "normalized_value": "React",
                        "mandatory": True,
                        "reason": "Tìm thấy bằng chứng trong dự án.",
                        "evidence": [{"text": "Built React dashboards for internal users."}],
                    }
                ],
                "partial": [],
                "missing": [
                    {
                        "requirement_id": "req-node",
                        "normalized_value": "Node.js",
                        "mandatory": True,
                        "reason": "Chưa tìm thấy bằng chứng trong CV.",
                    }
                ],
                "uncertain": [],
            },
        },
        display_score=47.3,
        confidence_level="low",
        mandatory_failed=True,
    )

    assert "gần nhất trong danh mục" in explanation["verdict"]
    assert "Độ tin cậy thấp" in explanation["confidence_message"]
    assert explanation["matched_requirements"][0]["requirement"] == "React"
    assert explanation["matched_requirements"][0]["cv_evidence_quotes"] == [
        "Built React dashboards for internal users."
    ]
    assert explanation["priority_gaps"][0]["mandatory"] is True
    assert explanation["priority_actions"][0]["requirement"] == "Node.js"
    assert explanation["score_breakdown"][0]["label"] == "Kỹ năng bắt buộc"


def test_user_explanation_filters_noisy_requirements_from_candidate_actions():
    """AQ-01..AQ-06: only concise requirements are exposed to the candidate."""
    explanation = _build_user_explanation(
        {
            "requirements": {
                "matched": [{"normalized_value": "Node.js", "mandatory": True}],
                "partial": [],
                "missing": [
                    {"normalized_value": "en", "mandatory": True},
                    {"normalized_value": "Microservices", "mandatory": True},
                    {
                        "normalized_value": (
                            "Qualifications At least 3 years of experience focused on API "
                            "integration, REST API, and technical documentation for distributed systems."
                        ),
                        "mandatory": True,
                    },
                    {"normalized_value": "AI", "mandatory": True},
                    {"normalized_value": "Go", "mandatory": True},
                    {"normalized_value": "C#", "mandatory": True},
                ],
                "uncertain": [],
            }
        },
        display_score=40.0,
        confidence_level="low",
        mandatory_failed=True,
    )

    displayed_gaps = {item["requirement"] for item in explanation["priority_gaps"]}
    action_requirements = {item["requirement"] for item in explanation["priority_actions"]}

    assert "en" not in displayed_gaps
    assert all("Qualifications At least" not in requirement for requirement in displayed_gaps)
    assert {"Microservices", "AI", "Go", "C#"}.issubset(displayed_gaps)
    assert "Node.js" not in displayed_gaps
    assert "en" not in action_requirements
    assert all(len(requirement.split()) <= 12 for requirement in action_requirements)


def test_user_explanation_has_no_actions_when_all_mandatory_gaps_are_noise():
    """AQ-06: the frontend can use its explicit empty state for no valid gaps."""
    explanation = _build_user_explanation(
        {
            "requirements": {
                "matched": [],
                "partial": [],
                "missing": [
                    {"normalized_value": "en", "mandatory": True},
                    {
                        "normalized_value": "Qualifications At least 3 years of experience in distributed systems.",
                        "mandatory": True,
                    },
                ],
                "uncertain": [],
            }
        },
        display_score=20.0,
        confidence_level="low",
        mandatory_failed=True,
    )

    assert explanation["priority_gaps"] == []
    assert explanation["priority_actions"] == []


def test_vl_06_priority_actions_cleanliness():
    """VL-06: Priority actions & gaps only contain actionable technical requirements."""
    explanation = _build_user_explanation(
        {
            "requirements": {
                "matched": [
                    {"normalized_value": "Node.js", "mandatory": True, "evidence": [{"text": "Node.js 20"}]}
                ],
                "partial": [],
                "missing": [
                    {"normalized_value": "REST API", "mandatory": True},
                    {"normalized_value": "vi", "mandatory": True},
                    {"normalized_value": "A very long multi line prose text that is not a clean skill name.", "mandatory": True},
                ],
                "uncertain": [],
            }
        },
        display_score=46.2,
        confidence_level="medium",
        mandatory_failed=False,
    )
    gaps = [item["requirement"] for item in explanation["priority_gaps"]]
    actions = [item["requirement"] for item in explanation["priority_actions"]]

    assert "REST API" in gaps
    assert "vi" not in gaps
    assert "vi" not in actions
    assert len(actions) == 1
    assert actions[0] == "REST API"
    assert "Phù hợp" in explanation["verdict"] or "kiểm chứng" in explanation["verdict"]


def test_mandatory_count_consistency_excludes_non_mandatory_requirements():
    """Issue 1: mandatory_summary must only count actual mandatory requirements."""
    evidence = {
        "requirements": {
            "matched": [
                {"normalized_value": "Java", "mandatory": True, "requirement_type": "JD_REQUIRED_SKILL"},
                {"normalized_value": "Git", "mandatory": False, "requirement_type": "JD_REQUIRED_SKILL"},
                {"normalized_value": "Docker", "mandatory": False, "requirement_type": "JD_PREFERRED_SKILL"},
            ],
            "partial": [
                {"normalized_value": "Spring Boot", "mandatory": True, "requirement_type": "JD_REQUIRED_SKILL"},
                {"normalized_value": "Kubernetes", "mandatory": False, "requirement_type": "JD_PREFERRED_SKILL"},
            ],
            "missing": [
                {"normalized_value": "English", "mandatory": True, "requirement_type": "JD_EDUCATION"},
                {"normalized_value": "Microservices", "mandatory": False, "requirement_type": "JD_RESPONSIBILITY"},
                {"normalized_value": "Agile", "mandatory": False, "requirement_type": "JD_REQUIRED_SKILL"},
            ],
            "uncertain": [],
        }
    }
    # Total evaluated items = 8, but actual mandatory items = 3 (Java [matched], Spring Boot [partial], English [missing]).
    # Matched mandatory items = 1 (Java).
    explanation = _build_user_explanation(
        evidence,
        display_score=55.0,
        confidence_level="medium",
        mandatory_failed=True,
    )

    summary = explanation["mandatory_summary"]
    assert summary["matched"] == 1
    assert summary["total"] == 3
    assert summary["failed"] is True


@pytest.mark.asyncio
async def test_role_affinity_from_cv_target_role():
    """Issue 2: target role in CV/profile is used for role affinity without explicit request role."""
    from src.services.job_recommendations.service import extract_candidate_target_role

    mock_db = AsyncMock()
    mock_cv = MagicMock(spec=CVSnapshot)
    mock_cv.id = "cv_snap_backend"
    mock_cv.user_id = "user_backend"
    mock_cv.raw_text = "Backend Developer experienced in Python, FastAPI, and PostgreSQL."
    mock_cv.profile_json = {
        "target_role": "Backend Engineer",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    }

    mock_db.scalar = AsyncMock(side_effect=[mock_cv, None, None, None, None])
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    extracted = extract_candidate_target_role(mock_cv)
    assert extracted == "Backend Engineer"

    catalog = [
        {
            "source_id": "job_be",
            "title": "Backend Developer",
            "company": "Tech Corp",
            "location": "Hà Nội",
            "skills": ["Python", "FastAPI"],
            "description": "Backend API development.",
        },
    ]

    service = TopJobRecommendationService()
    # Request without explicit role
    request = JobRecommendationRequest(cv_snapshot_id="cv_snap_backend")

    run_id, top_jobs = await service.recommend_jobs(
        mock_db,
        user_id="user_backend",
        request=request,
        catalog=catalog,
    )

    assert len(top_jobs) == 1
    job = top_jobs[0]
    # Role affinity should be computed based on the CV's target role ("Backend Engineer")
    assert job.role_affinity_score > 0.0
    assert job.role_relevant is True
    assert job.role_track == "primary"
    assert "Backend" in job.role_reason
    assert "Không có role mục tiêu" not in job.role_reason


@pytest.mark.asyncio
async def test_role_affinity_when_no_target_role_exists():
    """Issue 2: when no target role exists in CV or request, role affinity is 0.0 and no role is invented."""
    from src.services.job_recommendations.service import extract_candidate_target_role

    mock_db = AsyncMock()
    mock_cv = MagicMock(spec=CVSnapshot)
    mock_cv.id = "cv_snap_norole"
    mock_cv.user_id = "user_norole"
    mock_cv.raw_text = "Software intern."
    mock_cv.profile_json = {
        "skills": ["Python"],
    }

    mock_db.scalar = AsyncMock(side_effect=[mock_cv, None, None, None, None])
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()

    extracted = extract_candidate_target_role(mock_cv)
    assert extracted is None

    catalog = [
        {
            "source_id": "job_any",
            "title": "Data Analyst",
            "company": "Data Corp",
            "location": "Hà Nội",
            "skills": ["Python"],
            "description": "Data analysis.",
        },
    ]

    service = TopJobRecommendationService()
    request = JobRecommendationRequest(cv_snapshot_id="cv_snap_norole")

    run_id, top_jobs = await service.recommend_jobs(
        mock_db,
        user_id="user_norole",
        request=request,
        catalog=catalog,
    )

    assert len(top_jobs) == 1
    job = top_jobs[0]
    assert job.role_affinity_score == 0.0
    assert "Không có role mục tiêu nên không loại theo role." in job.role_reason


