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
import inspect
import json
import logging
from collections.abc import Sequence
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
from src.db.models import (
    CV,
    CVSnapshot,
    CVVariant,
    JobDescription,
    JobRecommendation,
    JobRecommendationRun,
    User,
)

# pyrefly: ignore [missing-import]
from src.schemas.job_recommendation import (
    JobRecommendationItem,
    JobRecommendationRequest,
    JobRecommendationRunResponse,
)

# pyrefly: ignore [missing-import]
from src.services.job_catalog import canonicalize_job_location, load_enterprise_job_catalog

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.final_ranking import get_fit_label

# pyrefly: ignore [missing-import]
from src.services.job_recommendations.service import (
    TopJobRecommendationService,
    extract_candidate_target_role,
    get_recommendation_service,
)

# pyrefly: ignore [missing-import]
from src.services.pipeline_context import get_or_create_cv_snapshot

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


def _build_item_from_model(
    rec: JobRecommendation,
    catalog: Sequence[dict[str, Any]] | None = None,
) -> JobRecommendationItem:
    """Map a JobRecommendation database row to the public JobRecommendationItem schema."""
    exp = dict(rec.explanation_json or {})
    retrieval_only = exp.get("evaluation_status") == "RETRIEVAL_ONLY"
    full_catalog = list(catalog) if catalog is not None else list(load_enterprise_job_catalog())
    catalog_job = next(
        (
            job for job in full_catalog
            if str(job.get("source_id") or job.get("id") or "") == str(rec.job_id)
        ),
        {},
    )
    strengths = [s.get("message_vi") or s.get("code") for s in exp.get("strengths", []) if isinstance(s, dict)]
    gaps = [g.get("message_vi") or g.get("code") for g in exp.get("gaps", []) if isinstance(g, dict)]
    strengths = strengths or list(exp.get("top_strengths") or [])
    gaps = gaps or list(exp.get("top_gaps") or [])
    mandatory_gate = dict(rec.mandatory_gate_json or {})

    title = catalog_job.get("title") or exp.get("title") or f"Vị trí {rec.job_id}"
    company = catalog_job.get("company") or exp.get("company") or "Doanh nghiệp tuyển dụng"
    location = canonicalize_job_location(catalog_job.get("location") or exp.get("location")) or "Chưa xác định"
    work_mode = catalog_job.get("work_mode") or catalog_job.get("remote_type") or exp.get("work_mode") or "On-site"
    source_url = catalog_job.get("source_url") or exp.get("source_url")
    source_name = catalog_job.get("source_name") or catalog_job.get("source") or exp.get("source_name") or exp.get("source")
    seniority = catalog_job.get("seniority") or catalog_job.get("job_level") or exp.get("seniority") or exp.get("job_level")
    employment_type = catalog_job.get("employment_type") or exp.get("employment_type")
    salary = catalog_job.get("salary") or catalog_job.get("salary_range") or exp.get("salary")
    openings = catalog_job.get("openings") or catalog_job.get("quantity") or exp.get("openings") or exp.get("quantity")
    deadline = catalog_job.get("deadline") or exp.get("deadline")
    posted_at = catalog_job.get("posted_at") or catalog_job.get("created_at") or exp.get("posted_at")
    applicant_count = catalog_job.get("applicant_count") or exp.get("applicant_count")
    company_logo = catalog_job.get("company_logo") or catalog_job.get("logo_url") or exp.get("company_logo")
    required_skills = catalog_job.get("required_skills") or catalog_job.get("must_have_skills") or exp.get("required_skills") or []
    preferred_skills = catalog_job.get("preferred_skills") or catalog_job.get("nice_to_have_skills") or exp.get("preferred_skills") or []
    skills = catalog_job.get("skills") or exp.get("skills") or []

    return JobRecommendationItem(
        rank=rec.rank,
        job_id=rec.job_id,
        title=title,
        company=company,
        location=location,
        work_mode=work_mode,
        source_url=source_url,
        source_name=source_name,
        seniority=seniority,
        employment_type=employment_type,
        salary=salary,
        openings=openings,
        deadline=deadline,
        posted_at=posted_at,
        applicant_count=applicant_count,
        company_logo=company_logo,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        skills=skills,
        display_fit_score=rec.display_fit_score,
        raw_fit_score=rec.raw_fit_score,
        fit_label="Chưa đánh giá CV–JD" if retrieval_only else get_fit_label(rec.display_fit_score),
        evidence_confidence="high" if rec.confidence >= 0.8 else "medium" if rec.confidence >= 0.5 else "low",
        mandatory_requirement_failed=rec.mandatory_requirement_failed,
        role_relevant=bool(exp.get("role_relevant", True)),
        role_track=str(exp.get("role_track") or "mismatch"),
        role_reason=str(exp.get("role_reason") or ""),
        application_ready=not rec.mandatory_requirement_failed,
        retrieval_rank=int(exp.get("retrieval_rank") or 0),
        role_affinity_score=float(exp.get("role_affinity_score") or 0.0),
        ready_candidate_boost=float(exp.get("ready_candidate_boost") or 0.0),
        required_skills_coverage=float(mandatory_gate.get("coverage") or 0.0),
        mandatory_requirements_matched=int(mandatory_gate.get("matched_requirements") or 0),
        total_mandatory_requirements=int(mandatory_gate.get("total_requirements") or 0),
        score_breakdown=list(exp.get("score_breakdown") or []),
        top_strengths=strengths[:4],
        top_gaps=gaps[:4],
        user_explanation=dict(exp.get("user_explanation") or {}),
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
    if not resolved_request.role:
        target_role = extract_candidate_target_role(cv_snapshot, user=current_user)
        if target_role:
            resolved_request = resolved_request.model_copy(update={"role": target_role})
    catalog = list(load_enterprise_job_catalog())
    db_published_rows = []
    try:
        jd_query_res = await db.execute(
            select(JobDescription)
            .where(
                JobDescription.is_published.is_(True),
                JobDescription.is_system.is_(False),
            )
        )
        if hasattr(jd_query_res, "all") and callable(getattr(jd_query_res, "all")):
            res_all = jd_query_res.all()
            if inspect.isawaitable(res_all):
                res_all = await res_all
            db_published_rows = list(res_all) if isinstance(res_all, (list, tuple, Sequence)) else []
        elif isinstance(jd_query_res, (list, tuple, Sequence)):
            db_published_rows = list(jd_query_res)
        else:
            db_published_rows = []
    except Exception:
        db_published_rows = []

    for row in (db_published_rows or []):
        jd = row[0] if isinstance(row, (tuple, list)) else row
        profile_logo = row[1] if isinstance(row, (tuple, list)) and len(row) > 1 else None
        if not isinstance(jd, JobDescription):
            continue
        norm = getattr(jd, "normalized_json", None) or {}
        skills = norm.get("skills") or []
        if not isinstance(skills, list):
            skills = []
        domain = norm.get("domain") or norm.get("domain_category") or "Công nghệ"
        desc = getattr(jd, "requirements_text", "") or ""
        raw_qty = norm.get("quantity") or norm.get("openings")
        openings_val = int(raw_qty) if raw_qty and str(raw_qty).isdigit() else None
        deadline_val = str(norm.get("deadline") or norm.get("application_deadline") or "").strip() or None
        posted_at_val = jd.created_at.isoformat() if getattr(jd, "created_at", None) else None
        company_logo_val = str(norm.get("company_logo") or profile_logo or norm.get("logo_url") or "").strip() or None
        source_name_val = str(norm.get("source_name") or norm.get("source") or "").strip() or None

        salary_vis = str(norm.get("salary_visibility") or "")
        sal_min = norm.get("salary_min")
        sal_max = norm.get("salary_max")
        sal_cur = norm.get("salary_currency") or "VND"
        sal_val = None
        if salary_vis == "Công khai" and sal_min and sal_max:
            sal_val = f"{sal_min} - {sal_max} {sal_cur}"
        elif norm.get("salary") or norm.get("salary_range"):
            sal_val = str(norm.get("salary") or norm.get("salary_range")).strip() or None

        resolved_level = norm.get("job_level") or norm.get("level") or "Chưa xác định"
        req_skills = norm.get("must_have_skills") or norm.get("required_skills") or skills
        pref_skills = norm.get("nice_to_have_skills") or norm.get("preferred_skills") or []

        catalog.append(
            {
                "source_id": str(getattr(jd, "id", "")),
                "title": getattr(jd, "title", "Job"),
                "company": getattr(jd, "company", None) or "Doanh nghiệp tuyển dụng",
                "location": canonicalize_job_location(getattr(jd, "location", None)) or "Chưa xác định",
                "job_level": resolved_level,
                "seniority": resolved_level,
                "employment_type": norm.get("employment_type") or "Full-time",
                "remote_type": norm.get("remote_type") or norm.get("work_model") or "On-site",
                "work_mode": norm.get("remote_type") or norm.get("work_model") or "On-site",
                "domain": domain,
                "skills": skills,
                "required_skills": req_skills if isinstance(req_skills, list) else [],
                "preferred_skills": pref_skills if isinstance(pref_skills, list) else [],
                "description": desc,
                "source_url": norm.get("source_url"),
                "source_name": source_name_val,
                "salary": sal_val,
                "salary_range": sal_val,
                "openings": openings_val,
                "quantity": openings_val,
                "deadline": deadline_val,
                "posted_at": posted_at_val,
                "company_logo": company_logo_val,
            }
        )
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
        # ``AsyncMock.scalar`` in endpoint tests can return the CV snapshot for
        # every query. Only a real recommendation-run row is eligible as cache.
        if isinstance(cached_run, JobRecommendationRun):
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
                items=[_build_item_from_model(rec, catalog=catalog) for rec in recs],
                cache_hit=True,
                diagnostic=dict(cached_run.filter_json or {}).get("candidate_diagnostic", {}),
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
        if isinstance(existing_run, JobRecommendationRun):
            logger.info("Serving idempotent recommendation results for trace_id=%s", idemp_trace)
            recs = (
                await db.scalars(
                    select(JobRecommendation)
                    .where(JobRecommendation.run_id == existing_run.id)
                    .order_by(JobRecommendation.rank.asc())
                )
            ).all()
            items = [_build_item_from_model(r, catalog=catalog) for r in recs]
            return JobRecommendationRunResponse(
                run_id=existing_run.id,
                status="COMPLETED",
                items=items,
                cache_hit=True,
                diagnostic=dict(existing_run.filter_json or {}).get("candidate_diagnostic", {}),
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
            source_url=job.source_url,
            source_name=job.source_name,
            seniority=job.seniority,
            employment_type=job.employment_type,
            salary=job.salary,
            openings=job.openings,
            deadline=job.deadline,
            posted_at=job.posted_at,
            applicant_count=job.applicant_count,
            company_logo=job.company_logo,
            required_skills=job.required_skills,
            preferred_skills=job.preferred_skills,
            skills=job.skills,
            display_fit_score=job.display_fit_score,
            raw_fit_score=job.raw_fit_score,
            fit_label=job.fit_label,
            evidence_confidence=job.evidence_confidence,
            mandatory_requirement_failed=job.mandatory_requirement_failed,
            role_relevant=job.role_relevant,
            role_track=job.role_track,
            role_reason=job.role_reason,
            application_ready=job.application_ready,
            retrieval_rank=job.rrf_rank,
            role_affinity_score=job.role_affinity_score,
            ready_candidate_boost=job.ready_candidate_boost,
            required_skills_coverage=job.required_skills_coverage,
            mandatory_requirements_matched=job.mandatory_requirements_matched,
            total_mandatory_requirements=job.total_mandatory_requirements,
            score_breakdown=job.score_breakdown,
            top_strengths=job.top_strengths,
            top_gaps=job.top_gaps,
            user_explanation=job.user_explanation,
            match_id=job.match_id,
        )
        for job in top_jobs
    ]

    completed_run = await db.scalar(select(JobRecommendationRun).where(JobRecommendationRun.id == run_id))
    diagnostic = (
        dict(completed_run.filter_json or {}).get("candidate_diagnostic", {})
        if isinstance(completed_run, JobRecommendationRun) else {}
    )
    return JobRecommendationRunResponse(
        run_id=run_id,
        status="COMPLETED",
        items=items,
        cache_hit=False,
        diagnostic=diagnostic,
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
