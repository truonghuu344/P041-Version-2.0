from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, User
from src.models.schemas import JobCatalogResponse
from src.services.job_catalog import search_enterprise_jobs

router = APIRouter(prefix="/jobs", tags=["Job Search"])


@router.get("", response_model=JobCatalogResponse)
async def search_jobs(
    q: str = Query(default="", max_length=120),
    cv_id: str | None = Query(default=None),
    limit: int = Query(default=60, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobCatalogResponse:
    """Search enterprise JDs sourced from data/jds and optionally rank them for one owned CV."""
    cv_text: str | None = None
    parsed_cv: dict = {}
    if cv_id:
        cv_result = await db.execute(
            select(CV).where(CV.id == cv_id, CV.user_id == current_user.id)
        )
        cv = cv_result.scalar_one_or_none()
        if not cv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy CV thuộc tài khoản hiện tại.",
            )
        cv_text = cv.raw_text or ""
        parsed_cv = cv.parsed_json or {}

    jobs, total = search_enterprise_jobs(
        query=q,
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        limit=limit,
    )
    return JobCatalogResponse(
        jobs=jobs,
        total=total,
        returned=len(jobs),
        matched_by_cv=bool(cv_id),
    )
