from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.email_identity import canonicalize_email
from src.core.security import require_role
from src.db.database import get_db
from src.db.models import (
    CV,
    CounselorAssignment,
    CounselorFeedback,
    CVAnalysis,
    InterviewReport,
    InterviewSession,
    User,
)
from src.models.schemas import (
    CounselorAssignmentOut,
    CounselorConsentCreate,
    CounselorFeedbackCreate,
    CounselorFeedbackOut,
    CounselorStudentOverview,
    UserOut,
)

router = APIRouter(prefix="/counselor", tags=["Counselor HITL"])


def _assignment_out(assignment: CounselorAssignment, counselor: User, student: User) -> CounselorAssignmentOut:
    return CounselorAssignmentOut(
        id=assignment.id,
        counselor_id=counselor.id,
        counselor_name=counselor.full_name,
        counselor_email=counselor.email,
        student_id=student.id,
        student_name=student.full_name,
        student_email=student.email,
        status=assignment.status,
        consented_at=assignment.consented_at,
        revoked_at=assignment.revoked_at,
    )


async def _active_assignment(db: AsyncSession, *, counselor_id: str, student_id: str) -> CounselorAssignment:
    result = await db.execute(
        select(CounselorAssignment).where(
            CounselorAssignment.counselor_id == counselor_id,
            CounselorAssignment.student_id == student_id,
            CounselorAssignment.status == "active",
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sinh viên chưa cấp quyền hoặc đã thu hồi quyền truy cập.",
        )
    return assignment


@router.post("/consents", response_model=CounselorAssignmentOut, status_code=status.HTTP_201_CREATED)
async def grant_counselor_consent(
    payload: CounselorConsentCreate,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> CounselorAssignmentOut:
    email = canonicalize_email(str(payload.counselor_email))
    counselor_result = await db.execute(select(User).where(User.email == email, User.role == "counselor"))
    counselor = counselor_result.scalar_one_or_none()
    if not counselor:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản Counselor với email này.")

    existing_result = await db.execute(
        select(CounselorAssignment).where(
            CounselorAssignment.counselor_id == counselor.id,
            CounselorAssignment.student_id == student.id,
        )
    )
    assignment = existing_result.scalar_one_or_none()
    if assignment:
        assignment.status = "active"
        assignment.revoked_at = None
        assignment.consented_at = datetime.now(UTC)
    else:
        assignment = CounselorAssignment(counselor_id=counselor.id, student_id=student.id)
        db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return _assignment_out(assignment, counselor, student)


@router.get("/consents", response_model=list[CounselorAssignmentOut])
async def list_my_consents(
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> list[CounselorAssignmentOut]:
    rows = await db.execute(
        select(CounselorAssignment, User)
        .join(User, User.id == CounselorAssignment.counselor_id)
        .where(CounselorAssignment.student_id == student.id)
        .order_by(CounselorAssignment.consented_at.desc())
    )
    return [_assignment_out(assignment, counselor, student) for assignment, counselor in rows.all()]


@router.delete("/consents/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_counselor_consent(
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> None:
    result = await db.execute(
        select(CounselorAssignment).where(
            CounselorAssignment.id == assignment_id,
            CounselorAssignment.student_id == student.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy quyền cố vấn.")
    assignment.status = "revoked"
    assignment.revoked_at = datetime.now(UTC)
    await db.commit()


@router.get("/students", response_model=list[CounselorAssignmentOut])
async def list_assigned_students(
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor"])),
) -> list[CounselorAssignmentOut]:
    rows = await db.execute(
        select(CounselorAssignment, User)
        .join(User, User.id == CounselorAssignment.student_id)
        .where(
            CounselorAssignment.counselor_id == counselor.id,
            CounselorAssignment.status == "active",
        )
        .order_by(User.full_name)
    )
    return [_assignment_out(assignment, counselor, student) for assignment, student in rows.all()]


@router.get("/students/{student_id}", response_model=CounselorStudentOverview)
async def get_student_overview(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor"])),
) -> CounselorStudentOverview:
    await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)
    student_result = await db.execute(select(User).where(User.id == student_id, User.role == "student"))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")

    cv_count = await db.scalar(select(func.count(CV.id)).where(CV.user_id == student_id)) or 0
    analysis_count = await db.scalar(select(func.count(CVAnalysis.id)).where(CVAnalysis.user_id == student_id)) or 0
    interview_count = await db.scalar(
        select(func.count(InterviewSession.id)).where(InterviewSession.user_id == student_id)
    ) or 0
    completed_count = await db.scalar(
        select(func.count(InterviewSession.id)).where(
            InterviewSession.user_id == student_id,
            InterviewSession.status == "completed",
        )
    ) or 0
    average_score = await db.scalar(
        select(func.avg(InterviewReport.total_score))
        .join(InterviewSession, InterviewSession.id == InterviewReport.session_id)
        .where(InterviewSession.user_id == student_id)
    )
    feedback_result = await db.execute(
        select(CounselorFeedback)
        .where(CounselorFeedback.student_id == student_id)
        .order_by(CounselorFeedback.created_at.desc())
        .limit(20)
    )
    return CounselorStudentOverview(
        student=UserOut.model_validate(student),
        cv_count=int(cv_count),
        analysis_count=int(analysis_count),
        interview_count=int(interview_count),
        completed_interview_count=int(completed_count),
        average_star_score=round(float(average_score or 0.0), 2),
        recent_feedback=[CounselorFeedbackOut.model_validate(item) for item in feedback_result.scalars().all()],
    )


@router.post(
    "/students/{student_id}/feedback",
    response_model=CounselorFeedbackOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_feedback(
    student_id: str,
    payload: CounselorFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor"])),
) -> CounselorFeedbackOut:
    assignment = await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)
    if payload.interview_report_id:
        report_result = await db.execute(
            select(InterviewReport)
            .join(InterviewSession, InterviewSession.id == InterviewReport.session_id)
            .where(
                InterviewReport.id == payload.interview_report_id,
                InterviewSession.user_id == student_id,
            )
        )
        if not report_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Báo cáo STAR không thuộc sinh viên được cấp quyền.")

    feedback = CounselorFeedback(
        assignment_id=assignment.id,
        counselor_id=counselor.id,
        student_id=student_id,
        interview_report_id=payload.interview_report_id,
        kind=payload.kind,
        content=payload.content.strip(),
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return CounselorFeedbackOut.model_validate(feedback)


@router.get("/my-feedback", response_model=list[CounselorFeedbackOut])
async def list_student_feedback(
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role(["student"])),
) -> list[CounselorFeedbackOut]:
    result = await db.execute(
        select(CounselorFeedback)
        .where(CounselorFeedback.student_id == student.id)
        .order_by(CounselorFeedback.created_at.desc())
    )
    return [CounselorFeedbackOut.model_validate(item) for item in result.scalars().all()]
