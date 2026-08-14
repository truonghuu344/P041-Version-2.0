from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.errors import PipelineError, pipeline_error_from_message
from src.core.security import get_current_user, require_role
from src.db.database import get_db
from src.db.models import CV, User
from src.models.schemas import JobCatalogResponse, JobRAGStatus, JobRAGSyncResponse
from src.services.file_security import FileSecurityError, scan_uploaded_file
from src.services.job_rag import get_market_job_rag, search_market_jobs

router = APIRouter(prefix="/jobs", tags=["Job Search"])


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Specification-compatible JD creation accepting JSON or multipart document upload."""
    from src.api.v1.jds import SUPPORTED_JD_EXTENSIONS, _extract_jd_text, _save_private_jd

    content_type = request.headers.get("content-type", "").casefold()
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise PipelineError("UPLOAD_002", "Trường file là bắt buộc.", status_code=422)
        filename = (file.filename or "").strip()
        if Path(filename).suffix.casefold() not in SUPPORTED_JD_EXTENSIONS:
            raise PipelineError("UPLOAD_002", "Định dạng JD không hỗ trợ.", status_code=400)
        content = await file.read()
        try:
            await scan_uploaded_file(filename, content)
        except FileSecurityError as exc:
            raise pipeline_error_from_message(str(exc), "UPLOAD_003", status_code=400) from exc
        try:
            description = await _extract_jd_text(filename, content, file.content_type or "")
        except ValueError as exc:
            raise pipeline_error_from_message(str(exc), "PARSER_001", status_code=422) from exc
        title = str(form.get("title") or Path(filename).stem)
        company = str(form.get("company") or "")
        location = str(form.get("location") or "")
    else:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Payload JSON không hợp lệ.") from exc
        title = str(payload.get("title") or "")
        description = str(payload.get("description") or payload.get("requirements_text") or "")
        company = str(payload.get("company") or "")
        location = str(payload.get("location") or "")
    if len(title.strip()) < 2 or len(description.strip()) < 10:
        raise HTTPException(status_code=422, detail="JD cần title và description hợp lệ.")
    jd = await _save_private_jd(
        db=db,
        current_user=current_user,
        title=title,
        company=company,
        location=location,
        requirements_text=description,
    )
    return {"job_id": jd.id, "status": "CREATED"}


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

    jobs, total, retrieval_mode = await search_market_jobs(
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
        retrieval_mode=retrieval_mode,
    )


@router.get("/rag/status", response_model=JobRAGStatus)
async def market_job_rag_status(
    admin_user: User = Depends(require_role(["admin"])),
) -> JobRAGStatus:
    """[ADMIN ONLY] Check pgvector index availability and indexed JD count."""
    return JobRAGStatus.model_validate(await get_market_job_rag().status())


@router.post("/rag/sync", response_model=JobRAGSyncResponse)
async def sync_market_job_rag(
    admin_user: User = Depends(require_role(["admin"])),
) -> JobRAGSyncResponse:
    """[ADMIN ONLY] Incrementally sync data/jds into PostgreSQL/pgvector."""
    try:
        result = await get_market_job_rag().sync_catalog()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể đồng bộ pgvector: {exc}",
        ) from exc
    return JobRAGSyncResponse.model_validate(result)
