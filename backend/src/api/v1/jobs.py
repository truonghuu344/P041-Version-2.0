import html
import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.errors import PipelineError, pipeline_error_from_message
from src.core.security import get_current_user, get_optional_current_user, require_role
from src.db.database import get_db
from src.db.models import CV, JobDescription, User
from src.models.schemas import JobCatalogResponse, JobRAGStatus, JobRAGSyncResponse
from src.services.file_security import FileSecurityError, scan_uploaded_file
from src.services.job_catalog import (
    _score_job_for_cv,
    _search_text,
    canonicalize_job_location,
    load_enterprise_job_catalog,
)
from src.services.job_rag import get_market_job_rag, search_market_jobs

router = APIRouter(prefix="/jobs", tags=["Job Search"])
logger = logging.getLogger(__name__)



@router.get("/locations", response_model=dict[str, list[str]])
async def list_job_locations(
    db: AsyncSession = Depends(get_db),
) -> dict[str, list[str]]:
    """Return unique, user-facing location facets for the Student job flow."""
    locations = {
        location
        for job in load_enterprise_job_catalog()
        if (location := canonicalize_job_location(job.get("location")))
    }
    enterprise_locations = await db.scalars(
        select(JobDescription.location).where(
            JobDescription.is_published.is_(True),
            JobDescription.is_system.is_(False),
        )
    )
    locations.update(
        location
        for raw_location in enterprise_locations.all()
        if (location := canonicalize_job_location(raw_location))
    )
    return {"locations": sorted(locations, key=lambda location: _search_text(location))}


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
    role: str = Query(default="", max_length=120),
    location: str = Query(default="", max_length=120),
    work_mode: str = Query(default="", max_length=40),
    limit: int = Query(default=60, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> JobCatalogResponse:
    """Search enterprise JDs sourced from database and data/jds, optionally ranked for one owned CV."""
    cv_text: str | None = None
    parsed_cv: dict = {}
    if cv_id:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cần đăng nhập để so khớp theo CV.")
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

    # 1. Lấy các JD do doanh nghiệp tạo đã publish từ database
    enterprise_stmt = (
        select(JobDescription)
        .where(
            JobDescription.is_published.is_(True),
            JobDescription.is_system.is_(False),
        )
        .order_by(JobDescription.created_at.desc())
    )
    enterprise_res = await db.execute(enterprise_stmt)
    db_rows = enterprise_res.scalars().all()

    db_items: list[dict[str, Any]] = []
    for jd in db_rows:
        profile_logo = None
        norm = jd.normalized_json or {}
        raw_skills = norm.get("skills") or norm.get("tags") or []
        skills = raw_skills if isinstance(raw_skills, list) else []
        domain = norm.get("domain") or norm.get("domain_category") or "Công nghệ"
        desc = jd.requirements_text or ""
        searchable_text = _search_text(
            f"{jd.title} {jd.company or ''} {jd.location or ''} {domain} {' '.join([str(s) for s in skills])} {desc}"
        )
        raw_qty = norm.get("quantity") or norm.get("openings")
        openings_val = int(raw_qty) if raw_qty and str(raw_qty).isdigit() else None
        deadline_val = str(norm.get("deadline") or norm.get("application_deadline") or "").strip() or None
        posted_at_val = jd.created_at.isoformat() if jd.created_at else None
        company_logo_val = str(norm.get("company_logo") or profile_logo or norm.get("logo_url") or "").strip() or None
        source_name_val = str(norm.get("source_name") or norm.get("source") or ("Doanh nghiệp" if norm.get("creator_role") == "enterprise" else "Cố vấn định hướng" if norm.get("creator_role") == "counselor" else "")).strip() or None
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
        raw_req = norm.get("must_have_skills") or norm.get("required_skills") or skills
        raw_pref = norm.get("nice_to_have_skills") or norm.get("preferred_skills") or []
        req_skills = [
            s.get("name", str(s)) if isinstance(s, dict) else str(s)
            for s in (raw_req if isinstance(raw_req, list) else [])
        ]
        pref_skills = [
            s.get("name", str(s)) if isinstance(s, dict) else str(s)
            for s in (raw_pref if isinstance(raw_pref, list) else [])
        ]

        norm_sections = norm.get("sections") if isinstance(norm.get("sections"), list) else []
        extracted_resp: list[str] = [str(item).strip() for item in (norm.get("responsibilities") or []) if str(item).strip()]
        if not extracted_resp and norm_sections:
            resp_sec = next((s for s in norm_sections if isinstance(s, dict) and s.get("type") in ("responsibilities", "tasks")), None)
            if resp_sec and resp_sec.get("content"):
                clean_txt = re.sub(r"<li[^>]*>(.*?)</li>", r"\1\n", str(resp_sec["content"]), flags=re.IGNORECASE)
                clean_txt = re.sub(r"<[^>]+>", " ", clean_txt)
                lines = [html.unescape(line_text.strip()) for line_text in clean_txt.split("\n") if len(line_text.strip()) > 3]
                extracted_resp = lines[:8]

        extracted_req: list[str] = [str(item).strip() for item in (norm.get("requirements") or []) if str(item).strip()]
        if not extracted_req and norm_sections:
            req_sec = next((s for s in norm_sections if isinstance(s, dict) and s.get("type") in ("must_have", "requirements", "qualifications")), None)
            if req_sec and req_sec.get("content"):
                clean_txt = re.sub(r"<li[^>]*>(.*?)</li>", r"\1\n", str(req_sec["content"]), flags=re.IGNORECASE)
                clean_txt = re.sub(r"<[^>]+>", " ", clean_txt)
                lines = [html.unescape(line_text.strip()) for line_text in clean_txt.split("\n") if len(line_text.strip()) > 3]
                extracted_req = lines[:8]

        item: dict[str, Any] = {
            "source_id": str(jd.id),
            "title": jd.title,
            "company": jd.company or "Doanh nghiệp",
            "location": jd.location or "Chưa xác định",
            "job_level": resolved_level,
            "seniority": resolved_level,
            "employment_type": norm.get("employment_type") or "Full-time",
            "remote_type": norm.get("remote_type") or norm.get("work_model") or "On-site",
            "work_mode": norm.get("remote_type") or norm.get("work_model") or "On-site",
            "domain": domain,
            "skills": [s.get("name", str(s)) if isinstance(s, dict) else str(s) for s in skills],
            "required_skills": req_skills,
            "preferred_skills": pref_skills,
            "description": desc,
            "responsibilities": extracted_resp,
            "requirements": extracted_req,
            "source_url": norm.get("source_url"),
            "source_name": source_name_val,
            "salary": sal_val,
            "salary_range": sal_val,
            "openings": openings_val,
            "quantity": openings_val,
            "deadline": deadline_val,
            "posted_at": posted_at_val,
            "company_logo": company_logo_val,
            "match_score": None,
            "matched_skills": [],
            "missing_skills": [],
            "retrieval_score": None,
            "_search": searchable_text,
        }
        item["location"] = canonicalize_job_location(jd.location) or item["location"]
        db_items.append(item)

    logger.info("search_jobs: loaded %d published DB jobs for search (query='%s')", len(db_items), q)

    # Lọc theo keyword nếu có
    terms = _search_text(q).split()
    if terms:
        filtered_db = [it for it in db_items if all(term in it["_search"] for term in terms)]
    else:
        filtered_db = db_items

    if cv_text is not None:
        ranked_db = [_score_job_for_cv(it, cv_text, parsed_cv) for it in filtered_db]
    else:
        ranked_db = [
            {k: v for k, v in it.items() if not k.startswith("_")} for it in filtered_db
        ]

    # 2. Tìm kiếm trong catalog tĩnh (data/jds)
    jobs, total, retrieval_mode = await search_market_jobs(
        query=q,
        cv_text=cv_text,
        parsed_cv=parsed_cv,
        limit=limit,
    )

    # 3. Gộp các JD từ database lên đầu danh sách và loại bỏ trùng ID
    seen_ids: set[str] = set()
    merged_jobs: list[dict[str, Any]] = []
    for item in ranked_db:
        sid = str(item.get("source_id"))
        if sid not in seen_ids:
            seen_ids.add(sid)
            merged_jobs.append(item)

    for item in jobs:
        sid = str(item.get("source_id"))
        if sid not in seen_ids:
            seen_ids.add(sid)
            merged_jobs.append(item)

    def matches_filters(item: dict[str, Any]) -> bool:
        role_text = _search_text(role)
        if role_text and role_text not in _search_text(
            f"{item.get('title', '')} {item.get('domain', '')} {' '.join(item.get('skills') or [])}"
        ):
            return False
        selected_location = canonicalize_job_location(location)
        if selected_location and canonicalize_job_location(item.get("location")) != selected_location:
            return False
        requested_mode = _search_text(work_mode)
        actual_mode = _search_text(item.get("work_mode") or item.get("remote_type"))
        if requested_mode == "remote" and not ("remote" in actual_mode and "hybrid" not in actual_mode):
            return False
        if requested_mode and requested_mode != "remote" and requested_mode not in actual_mode:
            return False
        return True

    merged_jobs = [item for item in merged_jobs if matches_filters(item)]
    total_count = len(merged_jobs)
    logger.info("search_jobs: returning %d total merged jobs (%d from DB, %d in catalog)", total_count, len(ranked_db), len(jobs))

    return JobCatalogResponse(
        jobs=merged_jobs[:limit],
        total=total_count,
        returned=len(merged_jobs[:limit]),
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
