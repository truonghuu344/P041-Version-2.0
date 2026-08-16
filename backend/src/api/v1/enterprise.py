from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import require_role
from src.db.database import get_db
from src.db.models import ApplicationFeedback, CV, CVAnalysis, JobApplication, JobDescription, User
from src.models.schemas import (
    ApplicationFeedbackCreate,
    ApplicationFeedbackOut,
    CVOut,
    JDOut,
    JobApplicationCreate,
    JobApplicationDecision,
    JobApplicationOut,
)

router = APIRouter(prefix="/enterprise", tags=["Enterprise Recruitment"])


def _application_out(
    application: JobApplication,
    jd: JobDescription,
    candidate: User,
) -> JobApplicationOut:
    return JobApplicationOut(
        id=application.id,
        jd_id=jd.id,
        jd_title=jd.title,
        student_id=candidate.id,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        cv_id=application.cv_id,
        analysis_id=application.analysis_id,
        match_score=application.match_score,
        status=application.status,
        shared_at=application.shared_at,
        decided_at=application.decided_at,
    )


@router.get("/jds", response_model=list[JDOut])
async def list_enterprise_jds(
    db: AsyncSession = Depends(get_db),
    enterprise: User = Depends(require_role(["enterprise"])),
) -> list[JDOut]:
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.created_by_user_id == enterprise.id)
        .order_by(JobDescription.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/applications", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
async def share_cv_with_enterprise(
    payload: JobApplicationCreate,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> JobApplicationOut:
    jd_result = await db.execute(
        select(JobDescription, User)
        .join(User, User.id == JobDescription.created_by_user_id)
        .where(
            JobDescription.id == payload.jd_id,
            JobDescription.is_published.is_(True),
            User.role == "enterprise",
        )
    )
    row = jd_result.first()
    if not row:
        raise HTTPException(status_code=404, detail="JD doanh nghiệp chưa được công bố hoặc không tồn tại.")
    jd, _enterprise = row

    cv_result = await db.execute(select(CV).where(CV.id == payload.cv_id, CV.user_id == student.id))
    cv = cv_result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=404, detail="CV không thuộc tài khoản hiện tại.")

    analysis = None
    if payload.analysis_id:
        analysis_result = await db.execute(
            select(CVAnalysis).where(
                CVAnalysis.id == payload.analysis_id,
                CVAnalysis.user_id == student.id,
                CVAnalysis.cv_id == cv.id,
                CVAnalysis.jd_id == jd.id,
            )
        )
        analysis = analysis_result.scalar_one_or_none()
        if not analysis:
            raise HTTPException(status_code=404, detail="Kết quả Match Score không khớp CV và JD đã chọn.")
    else:
        latest_result = await db.execute(
            select(CVAnalysis)
            .where(
                CVAnalysis.user_id == student.id,
                CVAnalysis.cv_id == cv.id,
                CVAnalysis.jd_id == jd.id,
            )
            .order_by(CVAnalysis.created_at.desc())
            .limit(1)
        )
        analysis = latest_result.scalar_one_or_none()

    existing_result = await db.execute(
        select(JobApplication).where(
            JobApplication.jd_id == jd.id,
            JobApplication.student_id == student.id,
        )
    )
    application = existing_result.scalar_one_or_none()
    if application:
        application.cv_id = cv.id
        application.analysis_id = analysis.id if analysis else None
        application.match_score = analysis.match_score if analysis else 0.0
        application.status = "submitted"
        application.shared_at = datetime.now(UTC)
        application.decided_at = None
    else:
        application = JobApplication(
            jd_id=jd.id,
            student_id=student.id,
            cv_id=cv.id,
            analysis_id=analysis.id if analysis else None,
            match_score=analysis.match_score if analysis else 0.0,
        )
        db.add(application)
    await db.commit()
    await db.refresh(application)
    return _application_out(application, jd, student)


@router.get("/applications", response_model=list[JobApplicationOut])
async def list_my_applications(
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> list[JobApplicationOut]:
    rows = await db.execute(
        select(JobApplication, JobDescription)
        .join(JobDescription, JobDescription.id == JobApplication.jd_id)
        .where(JobApplication.student_id == student.id)
        .order_by(JobApplication.shared_at.desc())
    )
    return [_application_out(application, jd, student) for application, jd in rows.all()]


@router.get("/jds/{jd_id}/candidates", response_model=list[JobApplicationOut])
async def rank_candidates(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
    enterprise: User = Depends(require_role(["enterprise"])),
) -> list[JobApplicationOut]:
    jd_result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == jd_id,
            JobDescription.created_by_user_id == enterprise.id,
        )
    )
    jd = jd_result.scalar_one_or_none()
    if not jd:
        raise HTTPException(status_code=404, detail="JD không thuộc doanh nghiệp hiện tại.")
    rows = await db.execute(
        select(JobApplication, User)
        .join(User, User.id == JobApplication.student_id)
        .where(JobApplication.jd_id == jd.id)
        .order_by(JobApplication.match_score.desc(), JobApplication.shared_at.asc())
    )
    return [_application_out(application, jd, candidate) for application, candidate in rows.all()]


@router.get("/applications/{application_id}/cv", response_model=CVOut)
async def get_shared_candidate_cv(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    enterprise: User = Depends(require_role(["enterprise"])),
) -> CVOut:
    """Return only a CV explicitly shared with a JD owned by this enterprise."""
    result = await db.execute(
        select(CV)
        .join(JobApplication, JobApplication.cv_id == CV.id)
        .join(JobDescription, JobDescription.id == JobApplication.jd_id)
        .where(
            JobApplication.id == application_id,
            JobDescription.created_by_user_id == enterprise.id,
        )
    )
    cv = result.scalar_one_or_none()
    if not cv:
        raise HTTPException(status_code=404, detail="Không tìm thấy CV đã được chia sẻ cho doanh nghiệp.")
    return CVOut.model_validate(cv)


@router.patch("/applications/{application_id}", response_model=JobApplicationOut)
async def decide_application(
    application_id: str,
    payload: JobApplicationDecision,
    db: AsyncSession = Depends(get_db),
    enterprise: User = Depends(require_role(["enterprise"])),
) -> JobApplicationOut:
    result = await db.execute(
        select(JobApplication, JobDescription, User)
        .join(JobDescription, JobDescription.id == JobApplication.jd_id)
        .join(User, User.id == JobApplication.student_id)
        .where(
            JobApplication.id == application_id,
            JobDescription.created_by_user_id == enterprise.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ ứng tuyển thuộc doanh nghiệp.")
    application, jd, candidate = row
    application.status = payload.status
    application.decided_at = datetime.now(UTC) if payload.status != "submitted" else None
    await db.commit()
    await db.refresh(application)
    return _application_out(application, jd, candidate)


@router.post("/applications/{application_id}/feedback", response_model=ApplicationFeedbackOut)
async def submit_application_feedback(
    application_id: str,
    payload: ApplicationFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> ApplicationFeedbackOut:
    """Allow a candidate to rate a completed recruitment process once."""
    application = await db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.student_id == student.id,
        )
    )
    if not application:
        raise HTTPException(status_code=404, detail="Khong tim thay ho so ung tuyen.")
    if application.status not in {"hired", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chi co the danh gia sau khi quy trinh tuyen dung da ket thuc.",
        )

    feedback = await db.scalar(
        select(ApplicationFeedback).where(ApplicationFeedback.application_id == application_id)
    )
    if feedback:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
    else:
        feedback = ApplicationFeedback(
            application_id=application.id,
            user_id=student.id,
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback
