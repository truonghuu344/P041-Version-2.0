from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import JobDescription, User
from src.models.schemas import JDCreate, JDOut
from src.services.cv_parser import extract_text_from_docx, extract_text_from_pdf, sanitize_extracted_text

router = APIRouter(prefix="/jds", tags=["Job Description Management"])

MAX_JD_FILE_SIZE = 5 * 1024 * 1024
SUPPORTED_JD_EXTENSIONS = {".pdf", ".docx", ".txt"}


def _extract_jd_text(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.casefold()
    if suffix == ".pdf":
        return extract_text_from_pdf(content)
    if suffix == ".docx":
        return extract_text_from_docx(content)
    try:
        return sanitize_extracted_text(content.decode("utf-8-sig"))
    except UnicodeDecodeError as exc:
        raise ValueError("File TXT phải sử dụng bảng mã UTF-8.") from exc


async def _save_private_jd(
    *,
    db: AsyncSession,
    current_user: User,
    title: str,
    company: str,
    location: str,
    requirements_text: str,
) -> JobDescription:
    new_jd = JobDescription(
        title=title,
        company=company or "Cá nhân / Công ty ngoài",
        location=location or "Chưa xác định",
        requirements_text=requirements_text,
        is_system=False,
        created_by_user_id=current_user.id,
    )
    db.add(new_jd)
    await db.commit()
    await db.refresh(new_jd)
    return new_jd


@router.get("", response_model=list[JDOut])
async def list_jds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JDOut]:
    """Danh sách Job Description (gồm JD mặc định của hệ thống & JD cá nhân tự dán)."""
    # Auto-seed sample JDs if system JDs are empty
    stmt_check = select(JobDescription).where(JobDescription.is_system.is_(True))
    res_check = await db.execute(stmt_check)
    if not res_check.scalars().first():
        sample_jds = [
            JobDescription(
                title="Lập Trình Viên Python / Backend Developer",
                company="Tech Corp Vietnam",
                location="Hà Nội",
                requirements_text="""Yêu cầu công việc:
- Thành thạo ngôn ngữ lập trình Python (1-2 năm kinh nghiệm hoặc sinh viên mới tốt nghiệp khá/giỏi).
- Có kinh nghiệm làm việc với FastAPI, Django hoặc Flask.
- Sử dụng thành thạo PostgreSQL, SQLAlchemy, Redis.
- Hiểu biết về RESTful API design, Git, Docker và CI/CD.
- Ưu tiên ứng viên có sản phẩm thực tế hoặc hiểu biết về AI Agent / LangGraph.""",
                is_system=True,
            ),
            JobDescription(
                title="AI / ML Engineer (Junior)",
                company="AI Innovation Lab",
                location="TP. Hồ Chí Minh",
                requirements_text="""Yêu cầu công việc:
- Nắm vững kiến thức Machine Learning, Deep Learning, NLP.
- Thành thạo Python, PyTorch / TensorFlow, LangChain, LangGraph.
- Có kinh nghiệm làm việc với OpenAI API, RAG, Vector DB (Qdrant, Chroma).
- Kỹ năng tư duy giải quyết vấn đề và đọc hiểu tài liệu tiếng Anh tốt.""",
                is_system=True,
            ),
        ]
        db.add_all(sample_jds)
        await db.commit()

    stmt = select(JobDescription).where(
        or_(
            JobDescription.is_system.is_(True),
            JobDescription.created_by_user_id == current_user.id,
        )
    ).order_by(JobDescription.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/custom", response_model=JDOut, status_code=status.HTTP_201_CREATED)
async def create_custom_jd(
    payload: JDCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDOut:
    """Tạo JD tùy chỉnh từ công ty bên ngoài bằng cách dán nội dung."""
    return await _save_private_jd(
        db=db,
        current_user=current_user,
        title=payload.title,
        company=payload.company or "",
        location=payload.location or "",
        requirements_text=payload.requirements_text,
    )


@router.post("/upload", response_model=JDOut, status_code=status.HTTP_201_CREATED)
async def upload_jd(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    company: str = Form(default=""),
    location: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDOut:
    """Tạo JD cá nhân từ file mẫu PDF, DOCX hoặc TXT."""
    filename = (file.filename or "").strip()
    suffix = Path(filename).suffix.casefold()
    if suffix not in SUPPORTED_JD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng JD không hỗ trợ. Vui lòng dùng file PDF, DOCX hoặc TXT.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File JD đang trống.")
    if len(content) > MAX_JD_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dung lượng file JD vượt quá 5 MB.",
        )

    try:
        requirements_text = _extract_jd_text(filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    if len(requirements_text) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Không trích xuất được nội dung JD hợp lệ (tối thiểu 10 ký tự).",
        )

    resolved_title = title.strip() or Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    if len(resolved_title) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tên vị trí phải có ít nhất 2 ký tự.",
        )

    return await _save_private_jd(
        db=db,
        current_user=current_user,
        title=resolved_title,
        company=company.strip(),
        location=location.strip(),
        requirements_text=requirements_text,
    )


@router.get("/{jd_id}", response_model=JDOut)
async def get_jd_detail(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDOut:
    """Lấy chi tiết Job Description."""
    stmt = select(JobDescription).where(
        JobDescription.id == jd_id,
        or_(
            JobDescription.is_system.is_(True),
            JobDescription.created_by_user_id == current_user.id,
        ),
    )
    result = await db.execute(stmt)
    jd = result.scalar_one_or_none()

    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy Job Description được yêu cầu",
        )
    return jd
