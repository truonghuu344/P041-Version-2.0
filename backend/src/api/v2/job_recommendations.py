"""Top Jobs recommendation endpoints (API v2).

Endpoints:
- POST /api/v2/job-recommendations: Create a new Top Jobs recommendation run (supports Idempotency-Key header).
- GET  /api/v2/job-recommendations/history: Retrieve the authenticated user's recommendation history.
- GET  /api/v2/job-recommendations/{run_id}: Retrieve recommendation results for a specific run.

Strict security checks:
- The authenticated user must own the requested CV snapshot.
- The authenticated user must own the requested recommendation run.
- Users cannot view or query other users' recommendations.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from src.config import get_settings

# pyrefly: ignore [missing-import]
from src.core.security import get_current_user

# pyrefly: ignore [missing-import]
from src.db.database import get_db

# pyrefly: ignore [missing-import]
from src.db.models import CV, CVSnapshot, CVVariant, JobRecommendation, JobRecommendationRun, User

# pyrefly: ignore [missing-import]
from src.schemas.job_recommendation import (
    JobRecommendationItem,
    JobRecommendationRequest,
    JobRecommendationRunResponse,
)

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import get_fit_label

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.service import (
    TopJobRecommendationService,
    get_recommendation_service,
)

# pyrefly: ignore [missing-import]
from src.services.pipeline_context import get_or_create_cv_snapshot
from src.services.job_catalog import load_enterprise_job_catalog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/job-recommendations", tags=["Job Recommendations (v2)"])


def _top_jobs_cache_key(*, user_id: str, cv_snapshot_id: str, request: JobRecommendationRequest, catalog: list[dict[str, Any]]) -> str:
    """Fingerprint only reusable inputs; never include CV raw text or PII."""
    catalog_revision = [
        {
            "id": str(job.get("source_id") or ""),
            "title": str(job.get("title") or ""),
            "skills": list(job.get("skills") or []),
            "description": str(job.get("description") or ""),
            "location": str(job.get("location") or ""),
            "work_mode": str(job.get("work_mode") or job.get("remote_type") or ""),
        }
        for job in catalog
    ]
    payload = {
        "feature": "top_jobs",
        # Preview evaluations were added after retrieval-only recommendations.
        # Keep old cached runs from suppressing scores and evidence in the UI.
        "evaluation_mode": "preview_evidence_v1",
        "cache_version": get_settings().top_jobs_cache_version,
        "user_id": user_id,
        "cv_snapshot_id": cv_snapshot_id,
        "filters": request.model_dump(mode="json", exclude={"cv_snapshot_id"}),
        "catalog": catalog_revision,
    }
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


class JobRecommendationHistoryItem(BaseModel):
    """Summary of a past Top Jobs recommendation run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    cv_snapshot_id: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None
    filter_json: dict[str, Any] | None = None
    recommendations_count: int = 0


class JobRecommendationHistoryResponse(BaseModel):
    """Paginated list of historical recommendation runs."""

    model_config = ConfigDict(extra="forbid")

    runs: list[JobRecommendationHistoryItem] = Field(default_factory=list)
    total: int = 0


def _build_item_from_model(rec: JobRecommendation) -> JobRecommendationItem:
    """Map a JobRecommendation database row to the public JobRecommendationItem schema."""
    exp = dict(rec.explanation_json or {})
    retrieval_only = exp.get("evaluation_status") == "RETRIEVAL_ONLY"
    catalog_job = next(
        (
            job for job in load_enterprise_job_catalog()
            if str(job.get("source_id") or job.get("id") or "") == str(rec.job_id)
        ),
        {},
    )
    strengths = [s.get("message_vi") or s.get("code") for s in exp.get("strengths", []) if isinstance(s, dict)]
    gaps = [g.get("message_vi") or g.get("code") for g in exp.get("gaps", []) if isinstance(g, dict)]
    strengths = strengths or list(exp.get("top_strengths") or [])
    gaps = gaps or list(exp.get("top_gaps") or [])
    mandatory_gate = dict(rec.mandatory_gate_json or {})

    return JobRecommendationItem(
        rank=rec.rank,
        job_id=rec.job_id,
        title=f"Vị trí {rec.job_id}",
        company=catalog_job.get("company"),
        location=catalog_job.get("location"),
        work_mode=catalog_job.get("work_mode") or catalog_job.get("remote_type"),
        display_fit_score=rec.display_fit_score,
        raw_fit_score=rec.raw_fit_score,
        fit_label="Chua danh gia CV-JD" if retrieval_only else get_fit_label(rec.display_fit_score),
        evidence_confidence="high" if rec.confidence >= 0.8 else "medium" if rec.confidence >= 0.5 else "low",
        mandatory_requirement_failed=rec.mandatory_requirement_failed,
        required_skills_coverage=float(mandatory_gate.get("coverage") or 0.0),
        mandatory_requirements_matched=int(mandatory_gate.get("matched_requirements") or 0),
        total_mandatory_requirements=int(mandatory_gate.get("total_requirements") or 0),
        score_breakdown=list(exp.get("score_breakdown") or []),
        top_strengths=strengths[:4],
        top_gaps=gaps[:4],
        match_id=rec.match_id or (f"RETRIEVAL_{rec.job_id}" if retrieval_only else f"PREVIEW_{rec.job_id}"),
    )


@router.post(
    "",
    response_model=JobRecommendationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or retrieve a Top Jobs recommendation run",
)
async def create_job_recommendations(
    request: JobRecommendationRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: TopJobRecommendationService = Depends(get_recommendation_service),
) -> JobRecommendationRunResponse:
    """Generate Top 10 Job Recommendations for an owned CV Snapshot with optional filters."""
    # 1. Resolve the candidate's CV selection to an immutable snapshot.
    # The CV library exposes CV IDs, while the recommendation pipeline correctly
    # runs against snapshots. Supporting both IDs prevents a false 404 from a
    # valid CV selected in the UI.
    cv_snapshot = await db.scalar(
        select(CVSnapshot).where(
            CVSnapshot.id == request.cv_snapshot_id,
            CVSnapshot.user_id == current_user.id,
        )
    )
    if cv_snapshot is None:
        cv = await db.scalar(
            select(CV).where(
                CV.id == request.cv_snapshot_id,
                CV.user_id == current_user.id,
            )
        )
        if cv is not None:
            cv_snapshot = await get_or_create_cv_snapshot(db, cv)
        else:
            variant = await db.scalar(
                select(CVVariant).where(
                    CVVariant.id == request.cv_snapshot_id,
                    CVVariant.user_id == current_user.id,
                )
            )
            if variant is not None and variant.source_cv_snapshot_id:
                cv_snapshot = await db.scalar(
                    select(CVSnapshot).where(
                        CVSnapshot.id == variant.source_cv_snapshot_id,
                        CVSnapshot.user_id == current_user.id,
                    )
                )
            if cv_snapshot is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="CV không tồn tại hoặc bạn không có quyền truy cập.",
                )

    resolved_request = request.model_copy(update={"cv_snapshot_id": cv_snapshot.id})
    catalog = list(load_enterprise_job_catalog())
    cache_key = _top_jobs_cache_key(
        user_id=current_user.id,
        cv_snapshot_id=cv_snapshot.id,
        request=resolved_request,
        catalog=catalog,
    )

    # A cached run is valid only for the same immutable CV snapshot, filters,
    # catalog revision and cache version encoded in the fingerprint.
    if get_settings().top_jobs_cache_enabled:
        cached_run = await db.scalar(
            select(JobRecommendationRun).where(
                JobRecommendationRun.user_id == current_user.id,
                JobRecommendationRun.cv_snapshot_id == cv_snapshot.id,
                JobRecommendationRun.trace_id == cache_key,
                JobRecommendationRun.status == "COMPLETED",
            ).order_by(JobRecommendationRun.completed_at.desc()).limit(1)
        )
        if cached_run is not None:
            recs = (
                await db.scalars(
                    select(JobRecommendation)
                    .where(JobRecommendation.run_id == cached_run.id)
                    .order_by(JobRecommendation.rank.asc())
                )
            ).all()
            return JobRecommendationRunResponse(
                run_id=cached_run.id,
                status="COMPLETED",
                items=[_build_item_from_model(rec) for rec in recs],
                cache_hit=True,
            )

    # 2. Idempotency Check
    if idempotency_key:
        idemp_trace = f"IDEMP_{idempotency_key}"
        existing_run = await db.scalar(
            select(JobRecommendationRun).where(
                JobRecommendationRun.user_id == current_user.id,
                JobRecommendationRun.trace_id == idemp_trace,
                JobRecommendationRun.status == "COMPLETED",
            )
        )
        if existing_run is not None:
            logger.info("Serving idempotent recommendation results for trace_id=%s", idemp_trace)
            recs = (
                await db.scalars(
                    select(JobRecommendation)
                    .where(JobRecommendation.run_id == existing_run.id)
                    .order_by(JobRecommendation.rank.asc())
                )
            ).all()
            items = [_build_item_from_model(r) for r in recs]
            return JobRecommendationRunResponse(
                run_id=existing_run.id,
                status="COMPLETED",
                items=items,
                cache_hit=True,
            )

    # 3. Execute Recommendation Service
    try:
        run_id, top_jobs = await service.recommend_jobs(
            db,
            user_id=current_user.id,
            request=resolved_request,
            catalog=catalog,
            cache_trace_id=cache_key if get_settings().top_jobs_cache_enabled else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Failed to execute top job recommendations: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể thực hiện phiên gợi ý việc làm.",
        ) from exc

    # 4. Map output items
    items = [
        JobRecommendationItem(
            rank=job.rank,
            job_id=job.job_id,
            title=job.title,
            company=job.company,
            location=job.location,
            work_mode=job.work_mode,
            display_fit_score=job.display_fit_score,
            raw_fit_score=job.raw_fit_score,
            fit_label=job.fit_label,
            evidence_confidence=job.evidence_confidence,
            mandatory_requirement_failed=job.mandatory_requirement_failed,
            required_skills_coverage=job.required_skills_coverage,
            mandatory_requirements_matched=job.mandatory_requirements_matched,
            total_mandatory_requirements=job.total_mandatory_requirements,
            score_breakdown=job.score_breakdown,
            top_strengths=job.top_strengths,
            top_gaps=job.top_gaps,
            match_id=job.match_id,
        )
        for job in top_jobs
    ]

    return JobRecommendationRunResponse(
        run_id=run_id,
        status="COMPLETED",
        items=items,
        cache_hit=False,
    )


@router.get(
    "/history",
    response_model=JobRecommendationHistoryResponse,
    summary="Get user recommendation run history",
)
async def get_recommendation_history(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobRecommendationHistoryResponse:
    """Retrieve history of Top Jobs recommendation runs for the authenticated user only."""
    total = int(
        await db.scalar(
            select(func.count())
            .select_from(JobRecommendationRun)
            .where(JobRecommendationRun.user_id == current_user.id)
        )
        or 0
    )

    runs = (
        await db.scalars(
            select(JobRecommendationRun)
            .where(JobRecommendationRun.user_id == current_user.id)
            .order_by(JobRecommendationRun.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()

    history_items: list[JobRecommendationHistoryItem] = []
    for run in runs:
        count = int(
            await db.scalar(
                select(func.count())
                .select_from(JobRecommendation)
                .where(JobRecommendation.run_id == run.id)
            )
            or 0
        )
        history_items.append(
            JobRecommendationHistoryItem(
                run_id=run.id,
                cv_snapshot_id=run.cv_snapshot_id,
                status=run.status,
                created_at=run.created_at,
                completed_at=run.completed_at,
                filter_json=run.filter_json,
                recommendations_count=count,
            )
        )

    return JobRecommendationHistoryResponse(
        runs=history_items,
        total=total,
    )


@router.get(
    "/{run_id}",
    response_model=JobRecommendationRunResponse,
    summary="Get recommendations by run_id",
)
async def get_recommendations_by_run_id(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobRecommendationRunResponse:
    """Retrieve the Top Jobs recommendations from a specific run."""
    run = await db.scalar(
        select(JobRecommendationRun).where(JobRecommendationRun.id == run_id)
    )
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phiên gợi ý việc làm không tồn tại.",
        )

    # Ownership check
    if run.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập phiên gợi ý việc làm này.",
        )

    recs = (
        await db.scalars(
            select(JobRecommendation)
            .where(JobRecommendation.run_id == run_id)
            .order_by(JobRecommendation.rank.asc())
        )
    ).all()

    items = [_build_item_from_model(r) for r in recs]

    return JobRecommendationRunResponse(
        run_id=run.id,
        status=run.status,  # type: ignore[arg-type]
        items=items,
    )
