"""Integration tests for Top Jobs recommendation API v2 endpoints."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

# pyrefly: ignore [missing-import]
from src.core.security import get_current_user

# pyrefly: ignore [missing-import]
from src.db.database import get_db

# pyrefly: ignore [missing-import]
from src.db.models import CVSnapshot, JobRecommendation, JobRecommendationRun, User

# pyrefly: ignore [missing-import]
from src.main import app

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import RankedTopJob

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.service import get_recommendation_service

TEST_USER_ID = "user_test_001"
OTHER_USER_ID = "user_other_999"


@pytest.fixture
def mock_user() -> User:
    user = MagicMock(spec=User)
    user.id = TEST_USER_ID
    user.email = "test@example.com"
    user.full_name = "Nguyen Van A"
    user.is_active = True
    return user


@pytest.fixture
def mock_cv_snapshot() -> CVSnapshot:
    cv = MagicMock(spec=CVSnapshot)
    cv.id = "cv_snap_valid"
    cv.user_id = TEST_USER_ID
    cv.raw_text = "Python FastAPI PostgreSQL developer."
    cv.profile_json = {"skills": ["Python", "FastAPI"]}
    return cv


@pytest.mark.asyncio
async def test_create_job_recommendations_success(mock_user: User, mock_cv_snapshot: CVSnapshot):
    """POST /api/v2/job-recommendations generates recommendations for owned CV snapshot."""
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=mock_cv_snapshot)

    fake_top_job = RankedTopJob(
        rank=1,
        job_id="job_001",
        jd_snapshot_id="job_001",
        title="Senior Python Developer",
        company="Tech Corp",
        display_fit_score=85.0,
        raw_fit_score=85.0,
        fit_label="Rất phù hợp",
        evidence_confidence="high",
        confidence_score=0.85,
        mandatory_requirement_failed=False,
        required_skills_coverage=0.90,
        supported_requirements_count=8,
        rrf_rank=1,
        match_id="MATCH_001",
        top_strengths=["Kỹ năng bắt buộc được hỗ trợ tốt bởi CV"],
        top_gaps=[],
    )

    mock_service = MagicMock()
    mock_service.recommend_jobs = AsyncMock(return_value=("run_12345", [fake_top_job]))

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_recommendation_service] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "cv_snapshot_id": "cv_snap_valid",
                "role": "Python Developer",
            }
            response = await client.post("/api/v2/job-recommendations", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == "run_12345"
        assert data["status"] == "COMPLETED"
        assert len(data["items"]) == 1
        assert data["items"][0]["job_id"] == "job_001"
        assert data["items"][0]["rank"] == 1
        assert data["items"][0]["display_fit_score"] == 85.0
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_job_recommendations_unauthorized_cv(mock_user: User):
    """POST /api/v2/job-recommendations returns 404 when CV snapshot does not belong to user."""
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=None)  # Not found for current user

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {"cv_snapshot_id": "cv_snap_other"}
            response = await client.post("/api/v2/job-recommendations", json=payload)

        assert response.status_code == 404
        assert "không tồn tại hoặc bạn không có quyền" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_job_recommendations_cv_not_found(mock_user: User):
    """POST /api/v2/job-recommendations returns 404 when CV snapshot ID does not exist."""
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {"cv_snapshot_id": "cv_nonexistent_999"}
            response = await client.post("/api/v2/job-recommendations", json=payload)

        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_job_recommendations_empty_catalog(mock_user: User, mock_cv_snapshot: CVSnapshot):
    """POST returns status COMPLETED with empty items list when no jobs match filters."""
    mock_db = AsyncMock()
    mock_db.scalar = AsyncMock(return_value=mock_cv_snapshot)

    mock_service = MagicMock()
    mock_service.recommend_jobs = AsyncMock(return_value=("run_empty_001", []))

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_recommendation_service] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {"cv_snapshot_id": "cv_snap_valid"}
            response = await client.post("/api/v2/job-recommendations", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == "run_empty_001"
        assert data["status"] == "COMPLETED"
        assert data["items"] == []
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_job_recommendations_idempotency(mock_user: User, mock_cv_snapshot: CVSnapshot):
    """POST with same Idempotency-Key returns cached completed run without re-running."""
    mock_db = AsyncMock()

    cached_run = MagicMock(spec=JobRecommendationRun)
    cached_run.id = "run_cached_999"
    cached_run.user_id = TEST_USER_ID
    cached_run.status = "COMPLETED"

    cached_rec = MagicMock(spec=JobRecommendation)
    cached_rec.rank = 1
    cached_rec.job_id = "job_cached"
    cached_rec.display_fit_score = 92.0
    cached_rec.raw_fit_score = 92.0
    cached_rec.confidence = 0.9
    cached_rec.mandatory_requirement_failed = False
    cached_rec.match_id = "MATCH_CACHED"
    cached_rec.explanation_json = {"strengths": [{"code": "STRONG_SKILLS", "message_vi": "Khớp tốt"}]}

    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [cached_rec]

    mock_db.scalar = AsyncMock(side_effect=[mock_cv_snapshot, cached_run])
    mock_db.scalars = AsyncMock(return_value=mock_scalars)

    mock_service = MagicMock()
    mock_service.recommend_jobs = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_recommendation_service] = lambda: mock_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Idempotency-Key": "req_key_abc_123"}
            response = await client.post(
                "/api/v2/job-recommendations",
                json={"cv_snapshot_id": "cv_snap_valid"},
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == "run_cached_999"
        assert data["items"][0]["job_id"] == "job_cached"
        mock_service.recommend_jobs.assert_not_called()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_recommendation_history(mock_user: User):
    """GET /api/v2/job-recommendations/history returns paginated runs for authenticated user."""
    mock_db = AsyncMock()

    fake_run = MagicMock(spec=JobRecommendationRun)
    fake_run.id = "run_hist_01"
    fake_run.user_id = TEST_USER_ID
    fake_run.cv_snapshot_id = "cv_snap_valid"
    fake_run.status = "COMPLETED"
    fake_run.created_at = "2026-08-15T12:00:00"
    fake_run.completed_at = "2026-08-15T12:00:05"
    fake_run.filter_json = {"role": "Backend"}

    mock_db.scalar = AsyncMock(side_effect=[1, 10])  # total runs count = 1, recommendations count = 10
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [fake_run]
    mock_db.scalars = AsyncMock(return_value=mock_scalars)

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v2/job-recommendations/history?skip=0&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["runs"]) == 1
        assert data["runs"][0]["run_id"] == "run_hist_01"
        assert data["runs"][0]["recommendations_count"] == 10
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_recommendations_by_run_id_forbidden_for_other_user(mock_user: User):
    """GET /api/v2/job-recommendations/{run_id} returns 403 when run belongs to someone else."""
    mock_db = AsyncMock()

    other_user_run = MagicMock(spec=JobRecommendationRun)
    other_user_run.id = "run_secret"
    other_user_run.user_id = OTHER_USER_ID  # Different user!

    mock_db.scalar = AsyncMock(return_value=other_user_run)

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v2/job-recommendations/run_secret")

        assert response.status_code == 403
        assert "không có quyền" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()
