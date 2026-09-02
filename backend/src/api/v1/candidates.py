from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.cvs import upload_cv
from src.core.errors import PipelineError
from src.core.security import get_current_user, require_role
from src.db.database import get_db
from src.db.models import (
    CandidateArtifact,
    CounselorAssignment,
    CounselorFeedback,
    JobApplication,
    JobDescription,
    Notification,
    StudentInternship,
    User,
)
from src.models.schemas import CandidateProfilePayload
from src.services.notification_service import NotificationService

router = APIRouter(prefix="/candidates", tags=["CV-JD Candidates"])


class ReferralConsentPayload(BaseModel):
    accepted: bool = Field(True, description="Sinh viên chấp nhận tiến cử hay từ chối")


class WeeklyInternshipReportPayload(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    work_done: str = Field(min_length=1, max_length=12000)
    challenges: str = Field(default="", max_length=8000)
    next_plan: str = Field(default="", max_length=8000)


async def _student_internship_detail(db: AsyncSession, intern: StudentInternship) -> dict:
    advisor_row = (await db.execute(select(CounselorAssignment, User).join(
        User, User.id == CounselorAssignment.counselor_id
    ).where(CounselorAssignment.student_id == intern.student_id, CounselorAssignment.status == "active").limit(1))).first()
    counselor = advisor_row[1] if advisor_row else None
    feedback = (await db.execute(select(CounselorFeedback).where(
        CounselorFeedback.student_id == intern.student_id
    ).order_by(CounselorFeedback.created_at.desc()).limit(30))).scalars().all()
    reports = list(intern.weekly_reports_json or [])
    return {
        "id": intern.id, "company_name": intern.company_name, "position": intern.position,
        "location": intern.location, "mentor_name": intern.mentor_name, "mentor_title": intern.mentor_title,
        "counselor_name": counselor.full_name if counselor else None,
        "started_at": intern.created_at.isoformat() if intern.created_at else None,
        "current_week": intern.current_week, "total_weeks": intern.total_weeks,
        "progress_percent": intern.progress_percent, "last_report_status": intern.last_report_status,
        "status_label": intern.status_label, "status": intern.status, "weekly_reports": reports,
        "mentor_feedback": [item for item in reports if item.get("mentor_feedback")],
        "counselor_feedback": [{"id": item.id, "kind": item.kind, "content": item.content,
            "created_at": item.created_at.isoformat() if item.created_at else None}
            for item in feedback if "internship" in (item.content or "").lower() or "thá»±c táº­p" in (item.content or "").lower()],
        "final_evaluation": intern.final_evaluation_json,
    }


@router.get("/internships", response_model=list[dict])
async def list_my_internships(db: AsyncSession = Depends(get_db), student: User = Depends(require_role(["student"]))) -> list[dict]:
    rows = (await db.execute(select(StudentInternship).where(
        StudentInternship.student_id == student.id
    ).order_by(StudentInternship.created_at.desc()))).scalars().all()
    return [await _student_internship_detail(db, item) for item in rows]


@router.get("/internships/{internship_id}", response_model=dict)
async def get_my_internship_detail(internship_id: str, db: AsyncSession = Depends(get_db), student: User = Depends(require_role(["student"]))) -> dict:
    intern = await db.get(StudentInternship, internship_id)
    if not intern or intern.student_id != student.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình thực tập.")
    return await _student_internship_detail(db, intern)


@router.put("/internships/{internship_id}/reports/{week}", response_model=dict)
async def save_weekly_internship_report(internship_id: str, week: int, payload: WeeklyInternshipReportPayload, db: AsyncSession = Depends(get_db), student: User = Depends(require_role(["student"]))) -> dict:
    intern = await db.get(StudentInternship, internship_id)
    if week < 1 or week > 52:
        raise HTTPException(status_code=422, detail="Tuần báo cáo không hợp lệ.")
    if not intern or intern.student_id != student.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình thực tập.")
    if intern.status != "ongoing":
        raise HTTPException(status_code=409, detail="Chỉ có thể nộp báo cáo khi đang thực tập.")
    reports = list(intern.weekly_reports_json or [])
    report = next((item for item in reports if int(item.get("week", -1)) == week), None)
    if report and report.get("reviewed_at"):
        raise HTTPException(status_code=409, detail="Báo cáo đã được Mentor đánh giá, không thể sửa.")
    if report is None:
        report = {"week": week}
        reports.append(report)
    report.update(payload.model_dump())
    report["status"] = "submitted"
    report["submitted_at"] = datetime.now(UTC).isoformat()
    intern.weekly_reports_json = reports
    intern.last_report_status = "submitted"
    await db.commit()
    assignment = await db.scalar(
        select(CounselorAssignment).where(
            CounselorAssignment.student_id == student.id,
            CounselorAssignment.status == "active",
        ).order_by(CounselorAssignment.consented_at.desc()).limit(1)
    )
    if assignment:
        db.add(Notification(
            recipient_user_id=assignment.counselor_id,
            recipient_role="counselor",
            actor_user_id=student.id,
            actor_role="student",
            type="INTERNSHIP_REPORT_SUBMITTED",
            category="advisor",
            entity_type="internship_report",
            entity_id=intern.id,
            candidate_id=student.id,
            title="Student submitted an internship report",
            message=f"{student.full_name or student.email} submitted week {week} for {intern.position}.",
            priority="normal",
            action_url=f"/counselor/internships/{intern.id}",
        ))
        await db.commit()
    return await _student_internship_detail(db, intern)


@router.get("/profile", response_model=dict)
async def get_candidate_profile(
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> dict:
    artifact = await db.get(CandidateArtifact, f"CAND_{student.id}")
    profile = artifact.profile_json if artifact and isinstance(artifact.profile_json, dict) else {}
    return {"profile": profile}


@router.put("/profile", response_model=dict)
async def update_candidate_profile(
    payload: CandidateProfilePayload,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> dict:
    artifact_id = f"CAND_{student.id}"
    artifact = await db.get(CandidateArtifact, artifact_id)
    if artifact is None:
        artifact = CandidateArtifact(id=artifact_id, user_id=student.id)
        db.add(artifact)
    artifact.profile_json = payload.profile

    personal = payload.profile.get("personalInfo")
    career = payload.profile.get("careerGoals")
    if isinstance(personal, dict):
        student.phone = str(personal.get("phone") or student.phone or "") or None
        student.major = str(personal.get("major") or student.major or "") or None
        student.university = str(personal.get("university") or student.university or "") or None
    if isinstance(career, dict):
        student.target_role = str(career.get("targetRole") or student.target_role or "") or None
    skills = payload.profile.get("skills")
    if isinstance(skills, list):
        student.skills_json = [str(skill) for skill in skills if isinstance(skill, str)][:100]
    await db.commit()
    return {"profile": payload.profile}


@router.post("/{candidate_id}/cv", response_model=dict, status_code=201)
async def upload_candidate_cv(
    candidate_id: str,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    use_llm: bool = Form(default=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Specification-compatible upload alias; the account is the candidate owner."""
    if candidate_id not in {current_user.id, f"CAND_{current_user.id}"}:
        raise PipelineError("MATCH_001", "Candidate không tồn tại hoặc không thuộc tài khoản.", status_code=404)
    cv = await upload_cv(file=file, title=title, use_llm=use_llm, db=db, current_user=current_user)
    return {
        "candidate_id": f"CAND_{current_user.id}",
        "document_id": cv.id,
        "status": "UPLOADED",
        "cv_id": cv.id,
    }


@router.post("/referrals/{application_id}/consent", response_model=dict)
async def respond_referral_consent(
    application_id: str,
    payload: ReferralConsentPayload,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> dict:
    row = (
        await db.execute(
            select(JobApplication, JobDescription)
            .join(JobDescription, JobDescription.id == JobApplication.jd_id)
            .where(JobApplication.id == application_id, JobApplication.student_id == student.id)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu tiến cử.")
    app, jd = row

    if app.status != "pending_consent":
        return {
            "status": "success",
            "accepted": payload.accepted,
            "message": "This application is already in progress; consent is no longer required.",
        }

    if payload.accepted:
        app.status = "submitted"
        message = "Bạn đã đồng ý tiến cử. Hồ sơ của bạn đã được chuyển đến doanh nghiệp."
    else:
        app.status = "rejected"
        message = "Bạn đã từ chối yêu cầu tiến cử này."

    await db.commit()

    if payload.accepted:
        await NotificationService.trigger_application_submitted(
            db=db,
            application_id=app.id,
            job_id=jd.id,
            job_title=jd.title,
            company_name=jd.company or "Enterprise",
            student_id=student.id,
            student_name=student.full_name or student.email,
            enterprise_user_id=jd.created_by_user_id,
        )

    if app.referred_by_counselor_id:
        await NotificationService.trigger_referral_consent_response(
            db=db,
            student_id=student.id,
            student_name=student.full_name or student.email,
            advisor_id=app.referred_by_counselor_id,
            company_name=jd.company or "Doanh nghiệp",
            job_id=jd.id,
            accepted=payload.accepted,
        )

    return {"status": "success", "accepted": payload.accepted, "message": message}


@router.get("/internship", response_model=dict | None)
async def get_my_internship(
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> dict | None:
    intern = (
        await db.execute(
            select(StudentInternship)
            .where(StudentInternship.student_id == student.id)
            .order_by(StudentInternship.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if not intern:
        return None

    return {
        "id": intern.id,
        "company_name": intern.company_name,
        "position": intern.position,
        "location": intern.location,
        "mentor_name": intern.mentor_name,
        "mentor_title": intern.mentor_title,
        "current_week": intern.current_week,
        "total_weeks": intern.total_weeks,
        "progress_percent": intern.progress_percent,
        "last_report_status": intern.last_report_status,
        "status_label": intern.status_label,
        "status": intern.status,
    }

