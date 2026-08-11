import logging
import os
import uuid
from io import BytesIO
from time import perf_counter

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, CVAnalysis, CVOptimizationDecision, UsageEvent, User
from src.models.schemas import CVBulkDeleteRequest, CVBulkDeleteResponse, CVOut, ManualCVCreate
from src.services.cv_parser import extract_text_from_docx, extract_text_from_pdf, parse_cv_to_structured_json
from src.services.pdf_export import build_cv_pdf

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


@router.post("/upload", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    use_llm: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Upload CV (dạng .pdf hoặc .docx), trích xuất văn bản & tự động parse thành cấu trúc JSON."""
    started_at = perf_counter()
    filename = file.filename.lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng file không hỗ trợ. Vui lòng upload file PDF (.pdf) hoặc Word (.docx)",
        )

    content_bytes = await file.read()
    if len(content_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng file vượt quá giới hạn cho phép (tối đa 10 MB)",
        )

    # Extract text based on file type
    try:
        if filename.endswith(".pdf"):
            raw_text = extract_text_from_pdf(content_bytes)
        else:
            raw_text = extract_text_from_docx(content_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể trích xuất văn bản từ file upload. Vui lòng kiểm tra lại nội dung file",
        )

    # Structured JSON Parsing via LLM/Fallback
    try:
        parsed_json = await parse_cv_to_structured_json(raw_text, use_llm=use_llm)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    # Chỉ lưu file sau khi đã xác nhận có thể trích xuất và parse, tránh file rác khi lỗi.
    file_ext = ".pdf" if filename.endswith(".pdf") else ".docx"
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
            metadata_json={"use_llm": use_llm, "file_type": file_ext},
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
    """Danh sách tất cả CV của người dùng hiện tại."""
    stmt = select(CV).where(CV.user_id == current_user.id).order_by(CV.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


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
    if analysis_id:
        analysis_result = await db.execute(
            select(CVAnalysis).where(
                CVAnalysis.id == analysis_id,
                CVAnalysis.cv_id == cv.id,
                CVAnalysis.user_id == current_user.id,
            )
        )
        if not analysis_result.scalar_one_or_none():
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
        accepted_texts = [item.final_text for item in decision_result.scalars().all() if item.final_text]

    parsed = cv.parsed_json or {}
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
    result = await db.execute(
        select(CV).where(CV.user_id == current_user.id, CV.id.in_(requested_ids))
    )
    cvs = result.scalars().all()
    if not cvs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy CV hợp lệ để xóa")

    deleted_ids = [cv.id for cv in cvs]
    saved_filepaths = [cv.file_path for cv in cvs]
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
    await db.delete(cv)
    await db.commit()

    _remove_uploaded_file(saved_filepath)
