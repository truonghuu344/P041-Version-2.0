import hashlib
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.errors import PipelineError, pipeline_error_from_message
from src.core.security import get_current_user, get_optional_current_user, require_role
from src.db.database import get_db
from src.db.models import JobDescription, PartnerOrganization, User
from src.models.schemas import JDCreate, JDOut
from src.services.cv_jd_matching import parse_job_description
from src.services.cv_parser import extract_text_from_document, sanitize_extracted_text
from src.services.file_security import FileSecurityError, scan_uploaded_file
from src.services.jd_workflow import attach_jd_provenance
from src.services.job_catalog import canonicalize_job_location, load_enterprise_job_catalog
from src.services.object_storage import ObjectStorageError, delete_async, put_bytes_async

router = APIRouter(prefix="/jds", tags=["Job Description Management"])
logger = logging.getLogger(__name__)

SUPPORTED_JD_EXTENSIONS = {".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp"}

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


def _content_hash(value: str | bytes) -> str:
    """Stable digest used to avoid re-processing an unchanged JD."""
    if isinstance(value, str):
        value = re.sub(r"\s+", " ", value).strip().encode("utf-8")
    return hashlib.sha256(value).hexdigest()


async def _find_duplicate_private_jd(
    db: AsyncSession,
    *,
    user_id: str,
    source_file_hash: str | None = None,
    requirements_hash: str | None = None,
) -> JobDescription | None:
    """Return an owned private JD created from identical source content."""
    rows = (
        await db.scalars(
            select(JobDescription).where(
                JobDescription.created_by_user_id == user_id,
                JobDescription.is_system.is_(False),
            )
        )
    ).all()
    for jd in rows:
        metadata = dict(jd.normalized_json or {})
        if source_file_hash and metadata.get("source_file_hash") == source_file_hash:
            return jd
        if requirements_hash and metadata.get("requirements_content_hash") == requirements_hash:
            return jd
    return None


async def _save_private_jd(
    *,
    db: AsyncSession,
    current_user: User,
    title: str,
    company: str,
    location: str,
    requirements_text: str,
    file_path: str | None = None,
    source_file_hash: str | None = None,
    file_bytes: bytes | None = None,
    filename: str = "",
    content_type: str = "",
    metadata: dict | None = None,
) -> JobDescription:
    location = canonicalize_job_location(location) or "Chưa xác định"
    requirements_hash = _content_hash(requirements_text)
    duplicate = await _find_duplicate_private_jd(
        db,
        user_id=current_user.id,
        source_file_hash=source_file_hash,
        requirements_hash=requirements_hash,
    )
    if duplicate is not None:
        return duplicate
    from src.services.jd_parser import parse_structured_jd

    normalized = await parse_structured_jd(
        title=title,
        requirements_text=requirements_text,
        metadata={"company": company, "location": location, **(metadata or {})},
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
    )
    final_title = str(normalized.get("title") or title).strip() or title
    normalized = attach_jd_provenance(
        normalized,
        creator=current_user,
        creation_source=f"{current_user.role}_upload" if file_bytes is not None else f"{current_user.role}_manual",
    )
    if metadata:
        for k, v in metadata.items():
            if v is not None:
                normalized[k] = v
    normalized["requirements_content_hash"] = requirements_hash
    if source_file_hash:
        normalized["source_file_hash"] = source_file_hash
    new_jd = JobDescription(
        title=final_title,
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

    # Tự động đồng bộ hóa Vector Embedding cho Chatbot Cascading RAG
    try:
        from src.services.assistant_rag import get_assistant_rag_service

        rag_service = get_assistant_rag_service()
        await rag_service.index_jd(
            session=db,
            user_id=current_user.id,
            jd_id=new_jd.id,
            title=new_jd.title,
            company=new_jd.company,
            requirements_text=new_jd.requirements_text,
            normalized_json=new_jd.normalized_json,
        )
        await db.commit()
    except Exception:
        # Logging lỗi mà không làm gián đoạn luồng chính của người dùng
        pass

    return new_jd


async def _update_private_jd(
    *,
    jd: JobDescription,
    current_user: User,
    title: str,
    company: str,
    location: str,
    requirements_text: str,
    metadata: dict | None = None,
) -> JobDescription:
    """Re-parse edited private JD content with the same parser used on upload."""
    from src.services.jd_parser import parse_structured_jd

    canonical_location = canonicalize_job_location(location) or "Chưa xác định"
    normalized = await parse_structured_jd(
        title=title,
        requirements_text=requirements_text,
        metadata={"company": company, "location": canonical_location, **(metadata or {})},
    )
    final_title = str(normalized.get("title") or title).strip() or title
    normalized = attach_jd_provenance(
        normalized,
        creator=current_user,
        creation_source=f"{current_user.role}_manual",
    )
    if metadata:
        for k, v in metadata.items():
            if v is not None:
                normalized[k] = v
    normalized["requirements_content_hash"] = _content_hash(requirements_text)
    previous_metadata = jd.normalized_json or {}
    if previous_metadata.get("source_file_hash"):
        normalized["source_file_hash"] = previous_metadata["source_file_hash"]

    jd.title = final_title
    jd.company = company or "Cá nhân / Công ty ngoài"
    jd.location = canonical_location
    jd.requirements_text = requirements_text
    jd.normalized_json = normalized
    return jd


@router.get("", response_model=list[JDOut])
async def list_jds(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
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

    conditions = [
        JobDescription.is_system.is_(True),
        JobDescription.is_published.is_(True),
    ]
    if current_user is not None:
        conditions.append(JobDescription.created_by_user_id == current_user.id)

    stmt = (
        select(JobDescription)
        .where(or_(*conditions))
        .order_by(JobDescription.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/mine", response_model=list[JDOut])
async def list_my_jds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JDOut]:
    """Return private drafts and published JDs created by the signed-in user."""
    result = await db.execute(
        select(JobDescription)
        .where(
            JobDescription.created_by_user_id == current_user.id,
            JobDescription.is_system.is_(False),
        )
        .order_by(JobDescription.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/catalog/{source_id}/select", response_model=JDOut)
async def select_catalog_jd(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> JDOut:
    """Chọn một JD doanh nghiệp trong database hoặc data/jds và đưa vào luồng phân tích CV."""
    del current_user  # Xác thực vẫn bắt buộc; JD được lưu là dữ liệu hệ thống dùng chung.

    # 1. Kiểm tra nếu source_id là ID của JD đã có sẵn trong database
    existing_db_jd = await db.execute(select(JobDescription).where(JobDescription.id == source_id))
    db_jd = existing_db_jd.scalar_one_or_none()
    if db_jd:
        return db_jd
    catalog_item = next(
        (
            item
            for item in load_enterprise_job_catalog()
            if str(item.get("source_id") or "").casefold() == source_id.casefold()
        ),
        None,
    )
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy JD trong data/jds hoặc database.")

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
    metadata = dict(payload.metadata or {})
    company = payload.company or ""
    location = payload.location or ""
    if current_user.role == "counselor":
        company_id = str(metadata.get("company_id") or "").strip()
        if not company_id:
            logger.warning("Counselor %s attempted to create custom JD without company_id", current_user.id)
            raise HTTPException(status_code=422, detail="Vui lòng chọn doanh nghiệp đối tác cho JD.")
        partner = await db.get(PartnerOrganization, company_id)
        if not partner:
            logger.warning("Counselor %s provided unknown company_id: %s", current_user.id, company_id)
            raise HTTPException(status_code=404, detail="Không tìm thấy doanh nghiệp đối tác.")
        metadata["company_id"] = partner.id
        metadata["company_name"] = partner.name
        metadata["company_logo"] = partner.logo
        metadata["creator_role"] = "counselor"
        metadata["creator_user_id"] = current_user.id
        company = partner.name
        location = location or partner.location
    jd = await _save_private_jd(
        db=db,
        current_user=current_user,
        title=payload.title,
        company=company,
        location=location,
        requirements_text=payload.requirements_text,
        metadata=metadata,
    )
    logger.info("Created custom JD %s for user %s (role=%s, title=%s, company=%s)", jd.id, current_user.id, current_user.role, jd.title, jd.company)
    return jd


@router.put("/{jd_id}", response_model=JDOut)
async def update_counselor_jd(
    jd_id: str,
    payload: JDCreate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor"])),
) -> JDOut:
    """Persist Counselor edits to an uploaded draft using the shared JD parser."""
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.created_by_user_id == counselor.id,
            JobDescription.is_system.is_(False),
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        logger.warning("Counselor %s update JD %s failed: JD not found or not owned", counselor.id, jd_id)
        raise HTTPException(status_code=404, detail="JD không thuộc tài khoản hiện tại.")

    metadata = dict(payload.metadata or {})
    company_id = str(metadata.get("company_id") or "").strip()
    if not company_id:
        logger.warning("Counselor %s update JD %s failed: missing company_id", counselor.id, jd_id)
        raise HTTPException(status_code=422, detail="Vui lòng chọn doanh nghiệp đối tác cho JD.")
    partner = await db.get(PartnerOrganization, company_id)
    if not partner:
        logger.warning("Counselor %s update JD %s failed: unknown partner %s", counselor.id, jd_id, company_id)
        raise HTTPException(status_code=404, detail="Không tìm thấy doanh nghiệp đối tác.")

    metadata["company_id"] = partner.id
    metadata["company_name"] = partner.name
    metadata["company_logo"] = partner.logo
    metadata["creator_role"] = "counselor"
    metadata["creator_user_id"] = counselor.id
    await _update_private_jd(
        jd=jd,
        current_user=counselor,
        title=payload.title,
        company=partner.name,
        location=payload.location or partner.location,
        requirements_text=payload.requirements_text,
        metadata=metadata,
    )
    await db.commit()
    await db.refresh(jd)
    logger.info("Counselor %s updated JD %s (%s) for partner %s (location=%s)", counselor.id, jd.id, jd.title, partner.name, jd.location)
    return jd


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

    # Avoid a second MinerU request when the same source file was already
    # uploaded by this user. The content digest, not the filename, is used.
    source_file_hash = _content_hash(content)
    duplicate = await _find_duplicate_private_jd(
        db,
        user_id=current_user.id,
        source_file_hash=source_file_hash,
    )
    if duplicate is not None:
        return duplicate

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
            source_file_hash=source_file_hash,
            file_bytes=content,
            filename=filename,
            content_type=file.content_type or "",
        )
    except ObjectStorageError as exc:
        raise PipelineError("STORAGE_001", "Không thể lưu file JD. Vui lòng thử lại sau.", status_code=503) from exc
    except Exception:
        await delete_async(stored_file_path, local_root=Path("data/uploads"))
        raise


@router.patch("/{jd_id}/publish", response_model=JDOut)
async def publish_owned_jd(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    owner: User = Depends(require_role(["enterprise", "counselor"])),
) -> JDOut:
    logger.info("Publishing JD %s requested by user %s (role=%s)", jd_id, owner.id, owner.role)
    result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.created_by_user_id == owner.id,
            JobDescription.is_system.is_(False),
        )
    )
    jd = result.scalar_one_or_none()
    if not jd:
        logger.warning("Publish JD %s failed: not found or not owned by user %s (role=%s)", jd_id, owner.id, owner.role)
        raise HTTPException(status_code=404, detail="JD không thuộc tài khoản hiện tại.")
    jd.is_published = True
    await db.commit()
    await db.refresh(jd)
    norm = jd.normalized_json or {}
    logger.info(
        "JD %s successfully published (title=%s, company=%s, location=%s, creator_role=%s, company_id=%s)",
        jd.id,
        jd.title,
        jd.company,
        jd.location,
        norm.get("creator_role"),
        norm.get("company_id"),
    )

    try:
        from src.services.notification_service import NotificationService
        await NotificationService.trigger_job_published(
            db=db,
            job_id=jd.id,
            job_title=jd.title,
            company_name=jd.company or owner.full_name or "Tổ chức",
            enterprise_user_id=owner.id,
            job_tags=norm.get("required_skills") or norm.get("tags") or [],
            job_location=jd.location,
        )
    except Exception as exc:
        logger.warning("trigger_job_published error on publish_owned_jd: %s", exc)

    return jd


@router.get("/{jd_id}", response_model=JDOut)
async def get_jd_detail(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> JDOut:
    """Lấy chi tiết Job Description."""
    conditions = [
        JobDescription.is_system.is_(True),
        JobDescription.is_published.is_(True),
    ]
    if current_user is not None:
        conditions.append(JobDescription.created_by_user_id == current_user.id)

    stmt = select(JobDescription).where(
        JobDescription.id == jd_id,
        or_(*conditions),
    )
    result = await db.execute(stmt)
    jd = result.scalar_one_or_none()

    if not jd:
        logger.warning(
            "get_jd_detail failed: JD %s not found or access denied for user %s (role=%s)",
            jd_id,
            current_user.id if current_user else "anonymous",
            current_user.role if current_user else "guest",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy Job Description được yêu cầu",
        )
    return jd

