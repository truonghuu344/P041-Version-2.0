import logging
import os
import uuid
from io import BytesIO
from time import perf_counter
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.errors import PipelineError, pipeline_error_from_message
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import (
    CV,
    CVAnalysis,
    CVOptimizationDecision,
    CVSnapshot,
    CVVariant,
    DocumentArtifact,
    JobRecommendationRun,
    MatchRun,
    UsageEvent,
    User,
)
from src.models.schemas import CVBulkDeleteRequest, CVBulkDeleteResponse, CVOut, ManualCVCreate
from src.services.cv_blocks import apply_cv_block_patches
from src.services.cv_parser import extract_text_from_document, parse_cv_to_structured_json
from src.services.file_security import FileSecurityError, scan_uploaded_file
from src.services.pdf_export import apply_accepted_rewrites, build_cv_pdf

router = APIRouter(prefix="/cvs", tags=["CV Management"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _remove_uploaded_file(saved_filepath: str | None) -> None:
    if not saved_filepath:
        return
    upload_root = os.path.abspath(UPLOAD_DIR)
    resolved_path = os.path.abspath(saved_filepath)
    try:
        if os.path.commonpath([upload_root, resolved_path]) == upload_root:
            os.remove(resolved_path)
        else:
            logger.warning("Bỏ qua đường dẫn CV nằm ngoài upload directory: %s", resolved_path)
    except FileNotFoundError:
        logger.info("File CV đã không còn trên filesystem: %s", resolved_path)
    except (OSError, ValueError):
        logger.warning("Không thể xóa file CV khỏi filesystem: %s", resolved_path, exc_info=True)


def _manual_cv_raw_text(payload: ManualCVCreate) -> str:
    lines = [payload.title]
    lines.extend(value for value in payload.personal_info.values() if value)
    if payload.summary:
        lines.extend(["Summary", payload.summary])
    for heading, items in (
        ("Education", payload.education),
        ("Experience", payload.experience),
        ("Projects", payload.projects),
    ):
        if items:
            lines.append(heading)
            for item in items:
                lines.append(" | ".join(str(value) for value in item.values() if value))
    if payload.skills:
        lines.extend(["Skills", ", ".join(payload.skills)])
    return "\n".join(lines)


CV_TEMPLATE_DOWNLOADS = {
    "modern": ("cv-template-modern.pdf", "Mẫu CV Modern Tech - Hai Cột"),
    "classic": ("cv-template-classic-ats.pdf", "Mẫu CV Harvard ATS - Một Cột"),
    "elegant": ("cv-template-topcv-emerald.pdf", "Mẫu CV TopCV Emerald - Doanh Nghiệp"),
    "compact": ("cv-template-creative-tech.pdf", "Mẫu CV Compact - Tối Ưu 1 Trang"),
    "creative": ("cv-template-creative-dark.pdf", "Mẫu CV Creative Dark - Timeline"),
}


def _cv_template_sample() -> dict:
    """Nội dung gợi ý giúp người dùng thấy rõ cấu trúc của PDF mẫu tải về."""
    return {
        "headline": "VỊ TRÍ ỨNG TUYỂN / CHUYÊN MÔN CỦA BẠN",
        "personal_info": {
            "full_name": "HỌ VÀ TÊN CỦA BẠN",
            "email": "email@example.com",
            "phone": "(+84) 000 000 000",
            "location": "Thành phố, Việt Nam",
        },
        "summary": "Viết 2-3 câu về mục tiêu nghề nghiệp, kinh nghiệm và giá trị nổi bật của bạn.",
        "skills": ["Kỹ năng chuyên môn", "Công cụ", "Ngoại ngữ", "Kỹ năng mềm"],
        "education": [
            {"description": "Tên trường - Chuyên ngành - Thời gian - Thành tích nổi bật"},
        ],
        "experience": [
            {"description": "Vị trí - Doanh nghiệp - Thời gian - Kết quả có số liệu"},
            {"description": "Mô tả trách nhiệm và tác động nổi bật của bạn"},
        ],
        "projects": [
            {"description": "Tên dự án - Vai trò - Công nghệ - Kết quả"},
        ],
    }


@router.post("/upload", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    use_llm: bool = Form(default=True),
    parse_mode: Literal["configured", "auto"] = Form(default="configured"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Upload CV PDF/DOCX/JPG/JPEG/PNG, parse/OCR và trích xuất JSON có cấu trúc."""
    started_at = perf_counter()
    filename = file.filename.lower()
    supported = (".pdf", ".docx", ".jpg", ".jpeg", ".png")
    if not filename.endswith(supported):
        raise PipelineError(
            "UPLOAD_002",
            "Định dạng file không hỗ trợ. Dùng PDF, DOCX, JPG, JPEG hoặc PNG.",
            status_code=400,
        )

    content_bytes = await file.read()
    max_file_mb = get_settings().document_max_file_size_mb
    if len(content_bytes) > max_file_mb * 1024 * 1024:
        raise PipelineError("UPLOAD_001", f"Dung lượng file vượt quá {max_file_mb} MB.", status_code=400)
    try:
        await scan_uploaded_file(filename, content_bytes)
    except FileSecurityError as exc:
        raise pipeline_error_from_message(str(exc), "UPLOAD_003", status_code=400) from exc

    # Extract text based on file type
    try:
        raw_text = await extract_text_from_document(content_bytes, filename, file.content_type or "")
    except ValueError as exc:
        raise pipeline_error_from_message(str(exc), "PARSER_001", status_code=422) from exc

    if not raw_text:
        raise PipelineError(
            "PARSER_002",
            "Không thể trích xuất văn bản từ file upload. Vui lòng kiểm tra lại nội dung file.",
            status_code=400,
        )

    # Match CV uses auto mode: parse locally first and escalate to the LLM only
    # when the deterministic extraction is not structured enough.
    parse_policy: bool | Literal["auto"] = "auto" if parse_mode == "auto" else use_llm
    try:
        parsed_json = await parse_cv_to_structured_json(raw_text, use_llm=parse_policy)
    except ValueError as exc:
        raise pipeline_error_from_message(str(exc), "EXTRACTION_001", status_code=422) from exc

    # Chỉ lưu file sau khi đã xác nhận có thể trích xuất và parse, tránh file rác khi lỗi.
    file_ext = os.path.splitext(filename)[1]
    saved_filename = f"{uuid.uuid4().hex}{file_ext}"
    saved_filepath = os.path.join(UPLOAD_DIR, saved_filename)
    with open(saved_filepath, "wb") as f:
        f.write(content_bytes)

    cv_title = title.strip() if title.strip() else file.filename

    new_cv = CV(
        user_id=current_user.id,
        title=cv_title,
        file_path=saved_filepath,
        raw_text=raw_text,
        parsed_json=parsed_json,
    )
    db.add(new_cv)
    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="cv_parse",
            duration_ms=round((perf_counter() - started_at) * 1000),
            metadata_json={
                "use_llm": bool(parsed_json.get("agent_metadata", {}).get("llm_called")),
                "llm_policy": parse_mode,
                "file_type": file_ext,
            },
        )
    )
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        try:
            os.remove(saved_filepath)
        except OSError:
            logger.warning("Không thể dọn file CV sau khi database rollback: %s", saved_filepath)
        logger.exception("Không thể lưu CV vào database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể lưu CV vào cơ sở dữ liệu. File đã được dọn an toàn.",
        ) from exc
    await db.refresh(new_cv)
    return new_cv


@router.get("", response_model=list[CVOut])
async def list_user_cvs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CVOut]:
    """Danh sách tất cả CV của người dùng hiện tại kèm trạng thái (CV gốc, Đã Match, Đã tối ưu) và sắp xếp theo lần sử dụng gần nhất."""
    stmt = select(CV).where(CV.user_id == current_user.id)
    result = await db.execute(stmt)
    cvs = list(result.scalars().all())
    if not cvs:
        return []

    cv_ids = [cv.id for cv in cvs]

    # 1. Lấy tất cả CVAnalysis của user
    analyses_stmt = select(CVAnalysis).where(
        CVAnalysis.user_id == current_user.id,
        CVAnalysis.cv_id.in_(cv_ids),
    )
    analyses = (await db.scalars(analyses_stmt)).all()

    # 2. Lấy tất cả MatchRun của user
    matches_stmt = select(MatchRun).where(
        MatchRun.user_id == current_user.id,
        MatchRun.cv_id.in_(cv_ids),
    )
    matches = (await db.scalars(matches_stmt)).all()

    # 3. Lấy snapshots và variants của user
    snapshots_stmt = select(CVSnapshot).where(
        CVSnapshot.user_id == current_user.id,
        CVSnapshot.cv_id.in_(cv_ids),
    )
    snapshots = (await db.scalars(snapshots_stmt)).all()
    snap_id_to_cv_id = {s.id: s.cv_id for s in snapshots}
    snap_ids = list(snap_id_to_cv_id.keys())

    variants_by_cv_id: dict[str, list] = {cid: [] for cid in cv_ids}
    if snap_ids:
        variants_stmt = select(CVVariant).where(
            CVVariant.user_id == current_user.id,
            CVVariant.source_cv_snapshot_id.in_(snap_ids),
        )
        variants = (await db.scalars(variants_stmt)).all()
        for var in variants:
            cid = snap_id_to_cv_id.get(var.source_cv_snapshot_id)
            if cid:
                variants_by_cv_id.setdefault(cid, []).append(var)

    # 4. Lấy JobRecommendationRun của user
    rec_runs_by_cv_id: dict[str, list] = {cid: [] for cid in cv_ids}
    if snap_ids:
        rec_stmt = select(JobRecommendationRun).where(
            JobRecommendationRun.user_id == current_user.id,
            JobRecommendationRun.cv_snapshot_id.in_(snap_ids),
        )
        rec_runs = (await db.scalars(rec_stmt)).all()
        for r in rec_runs:
            cid = snap_id_to_cv_id.get(r.cv_snapshot_id)
            if cid:
                rec_runs_by_cv_id.setdefault(cid, []).append(r)

    # Nhóm analyses và matches theo cv_id
    analyses_by_cv_id: dict[str, list] = {cid: [] for cid in cv_ids}
    for a in analyses:
        analyses_by_cv_id.setdefault(a.cv_id, []).append(a)

    matches_by_cv_id: dict[str, list] = {cid: [] for cid in cv_ids}
    for m in matches:
        matches_by_cv_id.setdefault(m.cv_id, []).append(m)

    enriched_cvs: list[CVOut] = []
    for cv in cvs:
        cv_analyses = analyses_by_cv_id.get(cv.id, [])
        cv_matches = matches_by_cv_id.get(cv.id, [])
        cv_variants = variants_by_cv_id.get(cv.id, [])
        cv_rec_runs = rec_runs_by_cv_id.get(cv.id, [])

        match_count = len(cv_matches) if cv_matches else len(cv_analyses)
        has_variant = len(cv_variants) > 0
        has_optimized_analysis = any(bool(a.optimized_suggestions_json) for a in cv_analyses)
        is_title_optimized = any(k in (cv.title or "").lower() for k in ["tối ưu", "optimized", "variant"])

        is_optimized = has_variant or has_optimized_analysis or is_title_optimized
        if is_optimized:
            status_type = "optimized"
            status_label = "Đã tối ưu"
        elif match_count > 0:
            status_type = "matched"
            status_label = "Đã Match"
        else:
            status_type = "raw"
            status_label = "CV gốc"

        # Tính thời điểm sử dụng gần nhất
        timestamps = [cv.updated_at, cv.created_at]
        timestamps.extend(a.created_at for a in cv_analyses if a.created_at)
        timestamps.extend(m.created_at for m in cv_matches if m.created_at)
        timestamps.extend(v.updated_at or v.created_at for v in cv_variants if (v.updated_at or v.created_at))
        timestamps.extend(r.created_at for r in cv_rec_runs if r.created_at)
        valid_timestamps = [t for t in timestamps if t is not None]
        last_used_at = max(valid_timestamps) if valid_timestamps else cv.created_at

        enriched_cvs.append(
            CVOut(
                id=cv.id,
                user_id=cv.user_id,
                title=cv.title,
                file_path=cv.file_path,
                raw_text=cv.raw_text,
                parsed_json=cv.parsed_json,
                created_at=cv.created_at,
                updated_at=cv.updated_at,
                status_type=status_type,
                status_label=status_label,
                match_count=match_count,
                is_optimized=is_optimized,
                last_used_at=last_used_at,
            )
        )

    # Sắp xếp ưu tiên CV được sử dụng gần nhất lên đầu
    enriched_cvs.sort(key=lambda item: item.last_used_at or item.created_at, reverse=True)
    return enriched_cvs


@router.post("/manual", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def create_manual_cv(
    payload: ManualCVCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Tạo CV từ biểu mẫu; không gọi LLM và không thêm thông tin ngoài dữ liệu người dùng nhập."""
    parsed = payload.model_dump(exclude={"title", "template_name"})
    parsed["template_name"] = payload.template_name
    cv = CV(
        user_id=current_user.id,
        title=payload.title.strip(),
        file_path=None,
        raw_text=_manual_cv_raw_text(payload),
        parsed_json=parsed,
    )
    db.add(cv)
    await db.commit()
    await db.refresh(cv)
    return cv


@router.get("/templates/{template_name}/download")
async def download_cv_template(template_name: str) -> StreamingResponse:
    """Tải PDF mẫu công khai để người dùng xem và điền theo một trong ba cấu trúc CV."""
    template = CV_TEMPLATE_DOWNLOADS.get(template_name)
    if not template:
        raise HTTPException(status_code=404, detail="Template CV không tồn tại.")

    filename, title = template
    pdf_bytes = build_cv_pdf(
        title=title,
        parsed=_cv_template_sample(),
        accepted_suggestions=[],
        template_name=template_name,
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
        },
    )


@router.put("/{cv_id}/manual", response_model=CVOut)
async def update_manual_cv(
    cv_id: str,
    payload: ManualCVCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    result = await db.execute(select(CV).where(CV.id == cv_id, CV.user_id == current_user.id))
    cv = result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=404, detail="Không tìm thấy CV để chỉnh sửa.")
    parsed = payload.model_dump(exclude={"title", "template_name"})
    parsed["template_name"] = payload.template_name
    cv.title = payload.title.strip()
    cv.raw_text = _manual_cv_raw_text(payload)
    cv.parsed_json = parsed
    await db.commit()
    await db.refresh(cv)
    return cv


@router.get("/{cv_id}/export")
async def export_cv_pdf(
    cv_id: str,
    analysis_id: str | None = None,
    template: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    result = await db.execute(select(CV).where(CV.id == cv_id, CV.user_id == current_user.id))
    cv = result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=404, detail="Không tìm thấy CV để xuất PDF.")

    accepted_texts: list[str] = []
    accepted_replacements: list[tuple[str, str]] = []
    accepted_block_patches: list[dict[str, str]] = []
    if analysis_id:
        analysis_result = await db.execute(
            select(CVAnalysis).where(
                CVAnalysis.id == analysis_id,
                CVAnalysis.cv_id == cv.id,
                CVAnalysis.user_id == current_user.id,
            )
        )
        analysis = analysis_result.scalar_one_or_none()
        if not analysis:
            raise HTTPException(status_code=404, detail="Kết quả tối ưu không thuộc CV này.")
        decision_result = await db.execute(
            select(CVOptimizationDecision)
            .where(
                CVOptimizationDecision.analysis_id == analysis_id,
                CVOptimizationDecision.user_id == current_user.id,
                CVOptimizationDecision.accepted.is_(True),
            )
            .order_by(CVOptimizationDecision.suggestion_index)
        )
        suggestions = list(analysis.optimized_suggestions_json or [])
        for decision in decision_result.scalars().all():
            if not decision.final_text:
                continue
            source = suggestions[decision.suggestion_index] if decision.suggestion_index < len(suggestions) else {}
            original = str(source.get("original_text") or "").strip()
            block_id = str(source.get("block_id") or "").strip()
            section = str(source.get("section") or "").strip()
            if block_id and original and section:
                accepted_block_patches.append(
                    {
                        "block_id": block_id,
                        "section": section,
                        "original_text": original,
                        "optimized_text": decision.final_text,
                    }
                )
            elif original:
                accepted_replacements.append((original, decision.final_text))
            else:
                accepted_texts.append(decision.final_text)

    parsed = dict(cv.parsed_json or {})
    if accepted_block_patches:
        parsed, _, invalid_block_ids = apply_cv_block_patches(parsed, accepted_block_patches)
        if invalid_block_ids:
            logger.warning(
                "Bỏ qua patch CV không hợp lệ khi export; không append nội dung: %s",
                ", ".join(block_id or "<empty>" for block_id in invalid_block_ids),
            )
    if accepted_replacements:
        parsed, unmatched_texts = apply_accepted_rewrites(parsed, accepted_replacements)
        accepted_texts.extend(unmatched_texts)
    template_name = template or parsed.get("template_name") or "classic"
    if template_name not in {"classic", "modern", "compact"}:
        raise HTTPException(status_code=422, detail="Template CV không hợp lệ.")
    pdf_bytes = build_cv_pdf(
        title=cv.title,
        parsed=parsed,
        accepted_suggestions=accepted_texts,
        template_name=template_name,
    )
    safe_filename = "".join(char for char in cv.title if char.isalnum() or char in "-_ ").strip() or "optimized-cv"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}.pdf"'},
    )


@router.post("/bulk-delete", response_model=CVBulkDeleteResponse)
async def bulk_delete_cvs(
    payload: CVBulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVBulkDeleteResponse:
    """Xóa nhiều CV thuộc người dùng hiện tại trong cùng một transaction."""
    requested_ids = list(dict.fromkeys(payload.cv_ids))
    result = await db.execute(select(CV).where(CV.user_id == current_user.id, CV.id.in_(requested_ids)))
    cvs = result.scalars().all()
    if not cvs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy CV hợp lệ để xóa")

    deleted_ids = [cv.id for cv in cvs]
    saved_filepaths = [cv.file_path for cv in cvs]
    await db.execute(
        delete(DocumentArtifact).where(
            DocumentArtifact.document_type == "CV",
            DocumentArtifact.source_entity_id.in_(deleted_ids),
        )
    )
    for cv in cvs:
        await db.delete(cv)
    await db.commit()

    for saved_filepath in saved_filepaths:
        _remove_uploaded_file(saved_filepath)
    return CVBulkDeleteResponse(deleted_ids=deleted_ids, deleted_count=len(deleted_ids))


@router.get("/agent/status")
async def get_cv_agent_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Thông tin runtime công khai của CV Agent; không bao giờ trả API key."""
    settings = get_settings()
    configured = bool(settings.google_genai_api_key)
    return {
        "agent_name": "CV Parsing & ATS Agent",
        "workflow_version": "2.0",
        "provider": "google_gemini",
        "model": settings.model_name,
        "default_mode": settings.cv_parser_mode,
        "configured": configured,
        "workflow": [
            "validate_input",
            "extract_local_evidence",
            "llm_structured_parse",
            "evidence_guardrail",
            "ats_quality_gate",
        ],
    }


@router.post("/{cv_id}/analyze", response_model=CVOut)
async def reanalyze_cv(
    cv_id: str,
    use_llm: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Chạy lại CV Agent; mặc định dùng Gemini và luôn qua guardrail kiểm chứng."""
    stmt = select(CV).where(CV.id == cv_id, CV.user_id == current_user.id)
    result = await db.execute(stmt)
    cv = result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy CV")
    try:
        cv.parsed_json = await parse_cv_to_structured_json(cv.raw_text, use_llm=use_llm)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(cv)
    return cv


@router.get("/{cv_id}", response_model=CVOut)
async def get_cv_detail(
    cv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Lấy thông tin chi tiết một bản CV."""
    stmt = select(CV).where(CV.id == cv_id, CV.user_id == current_user.id)
    result = await db.execute(stmt)
    cv = result.scalar_one_or_none()

    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy CV hoặc bạn không có quyền truy cập",
        )
    return cv


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cv(
    cv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa một bản CV."""
    stmt = select(CV).where(CV.id == cv_id, CV.user_id == current_user.id)
    result = await db.execute(stmt)
    cv = result.scalar_one_or_none()

    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy CV để xóa",
        )

    saved_filepath = cv.file_path
    await db.execute(
        delete(DocumentArtifact).where(
            DocumentArtifact.document_type == "CV",
            DocumentArtifact.source_entity_id == cv.id,
        )
    )
    await db.delete(cv)
    await db.commit()

    _remove_uploaded_file(saved_filepath)
