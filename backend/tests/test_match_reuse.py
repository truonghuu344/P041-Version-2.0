"""Unit tests for the match reuse module."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.job_recommendations.match_reuse import (
    MatchResult,
    find_existing_match,
    get_or_run_match,
)

# ---------------------------------------------------------------------------
# MatchResult contract
# ---------------------------------------------------------------------------


def test_match_result_has_reused_flag():
    result = MatchResult(
        match_id="m-1",
        final_score=72.5,
        rating="GOOD",
        mandatory_requirement_failed=False,
        result_json={"final_score": 72.5},
        reused=True,
    )
    assert result.reused is True
    assert result.final_score == 72.5
    assert result.match_id == "m-1"


def test_match_result_is_frozen():
    result = MatchResult(
        match_id="m-1",
        final_score=50.0,
        rating="AVERAGE",
        mandatory_requirement_failed=False,
        result_json={},
        reused=False,
    )
    with pytest.raises(AttributeError):
        result.reused = True  # type: ignore[misc]


# ---------------------------------------------------------------------------
# find_existing_match
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_find_existing_match_returns_none_when_no_match():
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=None)

    result = await find_existing_match(
        db,
        cv_snapshot_id="cv-1",
        jd_snapshot_id="jd-1",
        pipeline_version="2.0",
    )
    assert result is None


@pytest.mark.asyncio
async def test_find_existing_match_returns_match_when_found():
    mock_match = MagicMock()
    mock_match.id = "match-123"
    mock_match.versions_json = {"rubric": "1.0"}
    mock_match.mandatory_requirement_failed = False

    db = AsyncMock()
    db.scalar = AsyncMock(return_value=mock_match)

    result = await find_existing_match(
        db,
        cv_snapshot_id="cv-1",
        jd_snapshot_id="jd-1",
        pipeline_version="2.0",
        rubric_version="1.0",
    )
    assert result is not None
    assert result.id == "match-123"


@pytest.mark.asyncio
async def test_find_existing_match_rejects_mismatched_rubric():
    mock_match = MagicMock()
    mock_match.versions_json = {"rubric": "1.0"}

    db = AsyncMock()
    db.scalar = AsyncMock(return_value=mock_match)

    result = await find_existing_match(
        db,
        cv_snapshot_id="cv-1",
        jd_snapshot_id="jd-1",
        pipeline_version="2.0",
        rubric_version="2.0",  # Mismatch!
    )
    assert result is None


# ---------------------------------------------------------------------------
# get_or_run_match — reuse path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_or_run_match_reuses_existing():
    mock_match = MagicMock()
    mock_match.id = "match-reused"
    mock_match.final_score = 85.0
    mock_match.rating = "EXCELLENT"
    mock_match.mandatory_requirement_failed = False
    mock_match.result_json = {"final_score": 85.0}
    mock_match.versions_json = {"rubric": "1.0"}

    db = AsyncMock()
    db.scalar = AsyncMock(return_value=mock_match)

    pipeline_fn = AsyncMock()

    result = await get_or_run_match(
        db,
        cv_snapshot_id="cv-1",
        jd_snapshot_id="jd-1",
        pipeline_version="2.0",
        rubric_version="1.0",
        run_pipeline=pipeline_fn,
    )

    assert result.reused is True
    assert result.match_id == "match-reused"
    assert result.final_score == 85.0
    pipeline_fn.assert_not_called()


# ---------------------------------------------------------------------------
# get_or_run_match — fresh pipeline path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_or_run_match_runs_pipeline_when_no_existing():
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=None)

    pipeline_fn = AsyncMock(return_value={
        "match_id": "match-new",
        "final_score": 60.0,
        "rating": "AVERAGE",
        "mandatory_requirement_failed": False,
    })

    result = await get_or_run_match(
        db,
        cv_snapshot_id="cv-1",
        jd_snapshot_id="jd-1",
        pipeline_version="2.0",
        run_pipeline=pipeline_fn,
    )

    assert result.reused is False
    assert result.match_id == "match-new"
    assert result.final_score == 60.0
    pipeline_fn.assert_called_once()
