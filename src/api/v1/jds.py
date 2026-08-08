from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import JobDescription, User
from src.models.schemas import JDCreate, JDOut

router = APIRouter(prefix="/jds", tags=["Job Description Management"])


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
    new_jd = JobDescription(
        title=payload.title,
        company=payload.company or "Cá nhân / Công ty ngoài",
        location=payload.location or "Chưa xác định",
        requirements_text=payload.requirements_text,
        is_system=False,
        created_by_user_id=current_user.id,
    )
    db.add(new_jd)
    await db.commit()
    await db.refresh(new_jd)
    return new_jd


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
