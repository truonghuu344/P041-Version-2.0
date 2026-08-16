"""Reuse-aware match engine for Top Jobs.

Before running the full CV-JD matching pipeline, this module checks whether
an identical match (same CV snapshot, same JD snapshot, same pipeline version,
same rubric version) already exists with a ``COMPLETED`` status.  If so, the
persisted result is returned directly — avoiding redundant LLM calls,
embedding computations, and database writes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.db.models import MatchRun

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MatchResult:
    """Lightweight container returned by the reuse-aware match engine.

    Attributes
    ----------
    match_id:
        Primary key of the ``matches`` row.
    final_score:
        Deterministic rubric-weighted score (0-100).
    rating:
        Human-readable bucket (POOR / AVERAGE / GOOD / EXCELLENT).
    mandatory_requirement_failed:
        Whether any mandatory JD requirement was unmet.
    result_json:
        Full pipeline result blob (criteria, evidence, etc.).
    reused:
        ``True`` when the result was served from a persisted match
        without re-running the pipeline.
    """

    match_id: str
    final_score: float
    rating: str
    mandatory_requirement_failed: bool
    result_json: dict[str, Any]
    reused: bool


async def find_existing_match(
    db: AsyncSession,
    *,
    cv_snapshot_id: str,
    jd_snapshot_id: str,
    pipeline_version: str,
    rubric_version: str | None = None,
) -> MatchRun | None:
    """Find a completed match for the exact (snapshot, version) tuple.

    Returns ``None`` if no reusable match exists.
    """
    query = (
        select(MatchRun)
        .where(
            MatchRun.cv_snapshot_id == cv_snapshot_id,
            MatchRun.jd_snapshot_id == jd_snapshot_id,
            MatchRun.pipeline_version == pipeline_version,
            MatchRun.status == "COMPLETED",
        )
        .order_by(MatchRun.completed_at.desc())
        .limit(1)
    )

    if rubric_version is not None:
        # versions_json->'rubric' is stored as a JSON string inside a JSONB
        # column.  For PostgreSQL we use the ->> operator; for SQLite tests
        # we fall back to a LIKE pattern.
        try:
            query = query.where(
                MatchRun.versions_json["rubric"].as_string() == rubric_version
            )
        except Exception:
            # SQLite / fallback: filter in Python after fetching.
            pass

    match = await db.scalar(query)

    # Post-fetch rubric guard for backends that don't support JSON operators.
    if match and rubric_version is not None:
        stored_rubric = (match.versions_json or {}).get("rubric")
        if str(stored_rubric) != str(rubric_version):
            return None

    return match


async def get_or_run_match(
    db: AsyncSession,
    *,
    cv_snapshot_id: str,
    jd_snapshot_id: str,
    pipeline_version: str,
    rubric_version: str | None = None,
    run_pipeline: Any,  # Callable that runs the full match pipeline
    pipeline_kwargs: dict[str, Any] | None = None,
) -> MatchResult:
    """Return a match result, reusing a persisted one when possible.

    Parameters
    ----------
    db:
        Active database session.
    cv_snapshot_id:
        Immutable CV snapshot identifier.
    jd_snapshot_id:
        Immutable JD snapshot identifier.
    pipeline_version:
        Current pipeline version string (e.g. ``"2.0"``).
    rubric_version:
        Current rubric version string (e.g. ``"1.0"``).  ``None`` skips
        the rubric version check.
    run_pipeline:
        An async callable that executes the full matching pipeline and
        returns a ``MatchResult``-compatible dict when no reusable match
        is found.  Signature:
        ``async (db, cv_snapshot_id, jd_snapshot_id, **kwargs) -> dict``
    pipeline_kwargs:
        Extra keyword arguments forwarded to ``run_pipeline``.

    Returns
    -------
    MatchResult
        Either a reused result or a freshly computed one.
    """
    existing = await find_existing_match(
        db,
        cv_snapshot_id=cv_snapshot_id,
        jd_snapshot_id=jd_snapshot_id,
        pipeline_version=pipeline_version,
        rubric_version=rubric_version,
    )

    if existing is not None:
        logger.info(
            "Reusing persisted match %s for cv_snapshot=%s jd_snapshot=%s "
            "pipeline=%s rubric=%s",
            existing.id,
            cv_snapshot_id,
            jd_snapshot_id,
            pipeline_version,
            rubric_version,
        )
        return MatchResult(
            match_id=existing.id,
            final_score=float(existing.final_score or 0.0),
            rating=str(existing.rating or "POOR"),
            mandatory_requirement_failed=bool(existing.mandatory_requirement_failed),
            result_json=dict(existing.result_json or {}),
            reused=True,
        )

    logger.info(
        "No reusable match found for cv_snapshot=%s jd_snapshot=%s "
        "pipeline=%s rubric=%s — running pipeline.",
        cv_snapshot_id,
        jd_snapshot_id,
        pipeline_version,
        rubric_version,
    )

    result = await run_pipeline(
        db,
        cv_snapshot_id=cv_snapshot_id,
        jd_snapshot_id=jd_snapshot_id,
        **(pipeline_kwargs or {}),
    )

    return MatchResult(
        match_id=str(result.get("match_id", "")),
        final_score=float(result.get("final_score", 0.0)),
        rating=str(result.get("rating", "POOR")),
        mandatory_requirement_failed=bool(result.get("mandatory_requirement_failed", False)),
        result_json=dict(result),
        reused=False,
    )
