import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.database import get_db
from src.db.models import User, CV
from src.core.security import get_current_user
from src.models.schemas import CVOut
from src.services.cv_parser import extract_text_from_pdf, extract_text_from_docx, parse_cv_to_structured_json

router = APIRouter(prefix="/cvs", tags=["CV Management"])

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=CVOut, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CVOut:
    """Upload CV (dạng .pdf hoặc .docx), trích xuất văn bản & tự động parse thành cấu trúc JSON."""
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

    # Save file to disk
    file_ext = ".pdf" if filename.endswith(".pdf") else ".docx"
    saved_filename = f"{uuid.uuid4().hex}{file_ext}"
    saved_filepath = os.path.join(UPLOAD_DIR, saved_filename)
    with open(saved_filepath, "wb") as f:
        f.write(content_bytes)

    # Extract text based on file type
    if filename.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content_bytes)
    else:
        raw_text = extract_text_from_docx(content_bytes)

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể trích xuất văn bản từ file upload. Vui lòng kiểm tra lại nội dung file",
        )

    # Structured JSON Parsing via LLM/Fallback
    parsed_json = await parse_cv_to_structured_json(raw_text)

    cv_title = title.strip() if title.strip() else file.filename

    new_cv = CV(
        user_id=current_user.id,
        title=cv_title,
        file_path=saved_filepath,
        raw_text=raw_text,
        parsed_json=parsed_json,
    )
    db.add(new_cv)
    await db.commit()
    await db.refresh(new_cv)
    return new_cv


@router.get("", response_model=List[CVOut])
async def list_user_cvs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[CVOut]:
    """Danh sách tất cả CV của người dùng hiện tại."""
    stmt = select(CV).where(CV.user_id == current_user.id).order_by(CV.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


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

    await db.delete(cv)
    await db.commit()
