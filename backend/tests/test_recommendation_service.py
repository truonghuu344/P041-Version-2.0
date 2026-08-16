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

    # First scalar call loads CVSnapshot, subsequent scalar calls for existing MatchRun return None
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
    assert top_jobs[0].display_fit_score >= top_jobs[1].display_fit_score
    assert len(top_jobs[0].top_strengths) > 0

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
