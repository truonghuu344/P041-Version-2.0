import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.errors import PipelineError, pipeline_error_from_message
from src.core.security import get_current_user, require_role
from src.db.database import get_db
from src.db.models import JobDescription, User
from src.models.schemas import JDCreate, JDOut
from src.services.cv_jd_matching import parse_job_description
from src.services.cv_parser import extract_text_from_document, sanitize_extracted_text
from src.services.file_security import FileSecurityError, scan_uploaded_file
from src.services.job_catalog import load_enterprise_job_catalog
from src.services.object_storage import ObjectStorageError, delete_async, put_bytes_async

router = APIRouter(prefix="/jds", tags=["Job Description Management"])

SUPPORTED_JD_EXTENSIONS = {".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png"}

SYSTEM_JD_SEEDS = [
    (
        "Lập Trình Viên Python / Backend Developer",
        "Tech Corp Vietnam",
        "Hà Nội",
        "Python, FastAPI hoặc Django, PostgreSQL, SQLAlchemy, Redis, REST API, Git, Docker và CI/CD.",
    ),
    (
        "AI / ML Engineer (Junior)",
        "AI Innovation Lab",
        "TP. Hồ Chí Minh",
        "Python, Machine Learning, Deep Learning, NLP, PyTorch hoặc TensorFlow, LangChain, LangGraph và RAG.",
    ),
    (
        "Frontend Developer Intern",
        "Digital Product Studio",
        "Hà Nội / Hybrid",
        "JavaScript, TypeScript, React, Next.js, HTML, CSS, REST API, Git và tư duy UI/UX.",
    ),
    (
        "Java Backend Intern",
        "Fintech Solutions",
        "TP. Hồ Chí Minh",
        "Java, Spring Boot, SQL, REST API, unit test, Docker và microservices cơ bản.",
    ),
    (
        "Data Analyst Fresher",
        "Retail Analytics",
        "Remote",
        "SQL, Excel, Python hoặc R, Power BI/Tableau, thống kê và trình bày insight.",
    ),
    (
        "Data Engineer Junior",
        "Cloud Data Vietnam",
        "Hà Nội",
        "Python, SQL, ETL, Airflow, Spark, data warehouse, Docker và cloud.",
    ),
    (
        "DevOps Engineer Intern",
        "Platform Hub",
        "Đà Nẵng",
        "Linux, Git, Docker, CI/CD, networking, shell scripting và Kubernetes cơ bản.",
    ),
    (
        "QA Automation Intern",
        "Quality First",
        "TP. Hồ Chí Minh",
        "Test case, API testing, Selenium/Playwright, JavaScript hoặc Python, Git và CI.",
    ),
    (
        "Business Analyst Fresher",
        "Enterprise Systems",
        "Hà Nội",
        "Thu thập yêu cầu, BPMN/UML, user story, SQL cơ bản và viết tài liệu.",
    ),
    (
        "UI/UX Designer Intern",
        "Creative Apps",
        "Remote",
        "Figma, wireframe, prototype, design system, usability testing và portfolio.",
    ),
    (
        "Mobile Developer Intern",
        "Mobile Factory",
        "TP. Hồ Chí Minh",
        "Flutter/Dart hoặc React Native, REST API, state management, Git và mobile UI.",
    ),
    (
        "Cybersecurity Intern",
        "SecureOps",
        "Hà Nội",
        "Linux, networking, OWASP Top 10, SIEM, Python cơ bản và phân tích lỗ hổng.",
    ),
    (
        "Cloud Engineer Fresher",
        "Cloud Native Lab",
        "Remote",
        "AWS/GCP/Azure, Linux, networking, Docker, Terraform cơ bản và monitoring.",
    ),
    (
        "Product Management Intern",
        "SaaS Growth",
        "TP. Hồ Chí Minh",
        "Product discovery, phân tích dữ liệu, viết PRD, Agile/Scrum và stakeholder.",
    ),
    (
        "Node.js Fullstack Junior",
        "Commerce Platform",
        "Hà Nội",
        "TypeScript, Node.js, React, PostgreSQL, REST API, testing, Git và Docker.",
    ),
]


async def _extract_jd_text(filename: str, content: bytes, content_type: str = "") -> str:
    suffix = Path(filename).suffix.casefold()
    if suffix != ".txt":
        return await extract_text_from_document(content, filename, content_type)
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
    file_path: str | None = None,
) -> JobDescription:
    normalized = parse_job_description(
        title=title,
        requirements_text=requirements_text,
        metadata={"company": company, "location": location},
    )
    new_jd = JobDescription(
        title=title,
        company=company or "Cá nhân / Công ty ngoài",
        location=location or "Chưa xác định",
        requirements_text=requirements_text,
        file_path=file_path,
        normalized_json=normalized,
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
    # Bảo đảm DB cũ lẫn DB mới đều có đủ thư viện 15 JD demo.
    existing_result = await db.execute(select(JobDescription.title).where(JobDescription.is_system.is_(True)))
    existing_titles = set(existing_result.scalars().all())
    missing_jds = [
        JobDescription(
            title=title,
            company=company,
            location=location,
            requirements_text=f"Yêu cầu công việc:\n- {requirements}",
            normalized_json=parse_job_description(
                title=title,
                requirements_text=f"Yêu cầu công việc:\n- {requirements}",
                metadata={"company": company, "location": location},
            ),
            is_system=True,
            is_published=True,
        )
        for title, company, location, requirements in SYSTEM_JD_SEEDS
        if title not in existing_titles
    ]
    if missing_jds:
        db.add_all(missing_jds)
        await db.commit()

    stmt = (
        select(JobDescription)
        .where(
            or_(
                JobDescription.is_system.is_(True),
                JobDescription.is_published.is_(True),
                JobDescription.created_by_user_id == current_user.id,
            )
        )
        .order_by(JobDescription.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/catalog/{source_id}/select", response_model=JDOut)
async def select_catalog_jd(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JDOut:
    """Chọn một JD doanh nghiệp trong data/jds và đưa vào luồng phân tích CV."""
    del current_user  # Xác thực vẫn bắt buộc; JD được lưu là dữ liệu hệ thống dùng chung.
    catalog_item = next(
        (
            item
            for item in load_enterprise_job_catalog()
            if str(item.get("source_id") or "").casefold() == source_id.casefold()
        ),
        None,
    )
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy JD trong data/jds.")

    existing_result = await db.execute(select(JobDescription).where(JobDescription.is_system.is_(True)))
    for existing in existing_result.scalars().all():
        normalized = existing.normalized_json or {}
        if str(normalized.get("source_id") or "").casefold() == source_id.casefold():
            return existing

    description = str(catalog_item.get("description") or "").strip()
    skills = [str(skill).strip() for skill in catalog_item.get("skills") or [] if str(skill).strip()]
    requirements_text = description or f"Yêu cầu kỹ năng: {', '.join(skills)}"
    source_metadata = {
        "source": "data/jds",
        "source_id": catalog_item["source_id"],
        "skills": skills,
        "job_level": catalog_item.get("job_level"),
        "employment_type": catalog_item.get("employment_type"),
        "remote_type": catalog_item.get("remote_type"),
        "source_url": catalog_item.get("source_url"),
        "company": catalog_item.get("company"),
        "location": catalog_item.get("location"),
        "domain": catalog_item.get("domain"),
    }
    normalized = parse_job_description(
        title=str(catalog_item.get("title") or "Vị trí chưa đặt tên").strip(),
        requirements_text=requirements_text,
        metadata=source_metadata,
    )
    normalized.update({key: value for key, value in source_metadata.items() if value is not None})
    selected_jd = JobDescription(
        title=str(catalog_item.get("title") or "Vị trí chưa đặt tên").strip(),
        company=str(catalog_item.get("company") or "Doanh nghiệp chưa xác định").strip(),
        location=str(catalog_item.get("location") or "Chưa xác định").strip(),
        requirements_text=requirements_text,
        normalized_json=normalized,
        is_system=True,
        is_published=True,
    )
    db.add(selected_jd)
    await db.commit()
    await db.refresh(selected_jd)
    return selected_jd


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
    """Tạo JD cá nhân từ PDF, DOCX, TXT, JPG, JPEG hoặc PNG."""
    filename = (file.filename or "").strip()
    suffix = Path(filename).suffix.casefold()
    if suffix not in SUPPORTED_JD_EXTENSIONS:
        raise PipelineError(
            "UPLOAD_002",
            "Định dạng JD không hỗ trợ. Dùng PDF, DOCX, TXT, JPG, JPEG hoặc PNG.",
            status_code=400,
        )

    content = await file.read()
    if not content:
        raise PipelineError("PARSER_002", "File JD đang trống.", status_code=400)
    max_file_mb = get_settings().document_max_file_size_mb
    if len(content) > max_file_mb * 1024 * 1024:
        raise PipelineError("UPLOAD_001", f"Dung lượng file JD vượt quá {max_file_mb} MB.", status_code=400)
    try:
        await scan_uploaded_file(filename, content)
    except FileSecurityError as exc:
        raise pipeline_error_from_message(str(exc), "UPLOAD_003", status_code=400) from exc

    try:
        requirements_text = await _extract_jd_text(filename, content, file.content_type or "")
    except ValueError as exc:
        raise pipeline_error_from_message(str(exc), "PARSER_001", status_code=422) from exc

    if len(requirements_text) < 10:
        raise PipelineError(
            "PARSER_002",
            "Không trích xuất được nội dung JD hợp lệ (tối thiểu 10 ký tự).",
            status_code=422,
        )

    resolved_title = title.strip() or Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    if len(resolved_title) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tên vị trí phải có ít nhất 2 ký tự.",
        )

    stored_file_path: str | None = None
    stored_filename = f"{uuid.uuid4().hex}{suffix}"
    try:
        stored_file_path = await put_bytes_async(
            content=content,
            key=f"jds/{current_user.id}/{stored_filename}",
            content_type=file.content_type or "application/octet-stream",
            local_path=Path("data/uploads/jds") / stored_filename,
        )
        return await _save_private_jd(
            db=db,
            current_user=current_user,
            title=resolved_title,
            company=company.strip(),
            location=location.strip(),
            requirements_text=requirements_text,
            file_path=stored_file_path,
        )
    except ObjectStorageError as exc:
        raise PipelineError("STORAGE_001", "Không thể lưu file JD. Vui lòng thử lại sau.", status_code=503) from exc
    except Exception:
        await delete_async(stored_file_path, local_root=Path("data/uploads"))
        raise


@router.patch("/{jd_id}/publish", response_model=JDOut)
async def publish_enterprise_jd(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    enterprise: User = Depends(require_role(["enterprise"])),
) -> JDOut:
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.created_by_user_id == enterprise.id,
            JobDescription.is_system.is_(False),
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="JD không thuộc doanh nghiệp hiện tại.")
    jd.is_published = True
    await db.commit()
    await db.refresh(jd)
    return jd


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
            JobDescription.is_published.is_(True),
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
