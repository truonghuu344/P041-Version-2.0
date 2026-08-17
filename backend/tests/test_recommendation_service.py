"""Unit tests for the TopJobRecommendationService orchestrator."""

from unittest.mock import AsyncMock, MagicMock

import pytest

# pyrefly: ignore [missing-import]
from src.db.models import CVSnapshot

# pyrefly: ignore [missing-import]
from src.schemas.job_recommendation import JobRecommendationRequest

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.service import (
    TopJobRecommendationService,
)
from src.services.job_recommendations.bm25_retriever import RankedJob


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
    assert top_jobs[0].display_fit_score == 0.0
    assert top_jobs[0].fit_label == "Chua danh gia CV-JD"
    assert top_jobs[0].match_id == "RETRIEVAL_job_01"

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
