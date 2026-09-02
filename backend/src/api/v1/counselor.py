import logging
import math
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.email_identity import canonicalize_email
from src.core.security import require_role
from src.db.database import get_db
from src.db.models import (
    APPLICATION_SOURCE_COUNSELOR_REFERRAL,
    CV,
    CounselorAssignment,
    CounselorFeedback,
    CounselorProfile,
    CVAnalysis,
    InterviewFeedback,
    InterviewReport,
    InterviewSession,
    JobApplication,
    JobDescription,
    PartnerOrganization,
    StudentInternship,
    User,
)
from src.models.schemas import (
    CounselorAssignmentOut,
    CounselorCandidateMatchItem,
    CounselorConsentCreate,
    CounselorDashboardOut,
    CounselorFeedbackCreate,
    CounselorFeedbackOut,
    CounselorInternshipItemOut,
    CounselorOpportunityItem,
    CounselorPartnerItemOut,
    CounselorProfileDataOut,
    CounselorProfileUpdate,
    CounselorReferralCreate,
    CounselorReferralItemOut,
    CounselorReferralUpdate,
    CounselorStudentListItem,
    CounselorStudentListResponse,
    CounselorStudentOverview,
    CounselorTaskCreate,
    CounselorVerifyProfileRequest,
    CVOut,
    GapAnalysisResponse,
    InterviewSessionSummaryOut,
    UserOut,
)
from src.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

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
        counselor = await db.get(User, counselor_id)
        if counselor and counselor.role == "admin":
            student = await db.get(User, student_id)
            if student and student.role == "student":
                assignment = CounselorAssignment(
                    counselor_id=counselor_id,
                    student_id=student_id,
                    status="active",
                )
                db.add(assignment)
                await db.commit()
                await db.refresh(assignment)
                return assignment

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sinh viên chưa cấp quyền hoặc đã thu hồi quyền truy cập.",
        )
    return assignment


# ─────────────────────────────────────────────────────────────────────────────
# 1. CONSENT & ASSIGNMENTS
# ─────────────────────────────────────────────────────────────────────────────

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
    logger.info("Counselor consent active: student_id=%s, counselor_id=%s", student.id, counselor.id)
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


# ─────────────────────────────────────────────────────────────────────────────
# 2. COUNSELOR DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=CounselorDashboardOut)
async def get_counselor_dashboard(
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorDashboardOut:
    # 1. Total assigned students
    total_assigned = await db.scalar(
        select(func.count(CounselorAssignment.id)).where(
            CounselorAssignment.counselor_id == counselor.id,
            CounselorAssignment.status == "active",
        )
    ) or 0

    if total_assigned == 0:
        total_students_in_sys = await db.scalar(select(func.count(User.id)).where(User.role == "student")) or 0
        total_assigned = max(total_students_in_sys, 0)

    # 2. Pending CV reviews (cv_status == 'pending')
    pending_cvs = await db.scalar(
        select(func.count(CV.id)).where(CV.cv_status == "pending")
    ) or 0

    # 3. Partner companies count
    partner_count = await db.scalar(
        select(func.count(PartnerOrganization.id))
    ) or 0
    if partner_count == 0:
        enterprise_users = await db.scalar(
            select(func.count(User.id)).where(User.role == "enterprise")
        ) or 0
        partner_count = max(enterprise_users, 6)

    # 4. Open talent requests
    open_requests = await db.scalar(
        select(func.count(JobDescription.id)).where(
            JobDescription.is_published.is_(True)
        )
    ) or 0

    # 5. Upcoming interviews
    interviews_count = await db.scalar(
        select(func.count(InterviewSession.id)).where(
            InterviewSession.status.in_(["ongoing", "scheduled", "interviewing"])
        )
    ) or 0

    # 6. Active interviewing students
    interview_rows = await db.execute(
        select(InterviewSession, User, JobDescription)
        .join(User, User.id == InterviewSession.user_id)
        .join(JobDescription, JobDescription.id == InterviewSession.jd_id)
        .order_by(InterviewSession.created_at.desc())
        .limit(5)
    )
    interviewing_students = []
    for session, student_user, jd in interview_rows.all():
        interviewing_students.append({
            "id": student_user.id,
            "name": student_user.full_name or student_user.email,
            "major": student_user.major or "Công nghệ Thông tin",
            "avatar": student_user.avatar_url,
            "position": jd.title,
            "company": jd.company or "Doanh nghiệp",
            "companyType": "tech",
            "status": "INTERVIEW" if session.status == "ongoing" else "COMPLETED",
            "statusLabel": f"Vòng phỏng vấn ({session.current_question_index + 1}/{session.total_questions})",
        })

    # 7. Urgent action items dynamically computed
    urgent_actions = []
    pending_cv_rows = await db.execute(
        select(CV, User)
        .join(User, User.id == CV.user_id)
        .where(CV.cv_status == "pending")
        .order_by(CV.created_at.desc())
        .limit(2)
    )
    for pending_cv, stu in pending_cv_rows.all():
        urgent_actions.append({
            "id": f"act-cv-{pending_cv.id}",
            "severity": "warning",
            "title": f"CV {stu.full_name or stu.email} chờ thẩm định",
            "desc": f"Sinh viên vừa cập nhật hồ sơ ứng tuyển '{pending_cv.title}'.",
            "timeText": "Cần duyệt sớm",
            "targetTab": "students",
            "studentId": stu.id,
        })

    intern_rows = await db.execute(
        select(StudentInternship, User)
        .join(User, User.id == StudentInternship.student_id)
        .where(
            StudentInternship.last_report_status.in_(["pending", "submitted"]),
            StudentInternship.student_id.in_(
                select(CounselorAssignment.student_id).where(
                    CounselorAssignment.counselor_id == counselor.id,
                    CounselorAssignment.status == "active",
                )
            ),
        )
        .limit(2)
    )
    for intern, stu in intern_rows.all():
        urgent_actions.append({
            "id": f"act-intern-{intern.id}",
            "severity": "danger" if intern.last_report_status == "pending" else "info",
            "title": f"Báo cáo thực tập {stu.full_name or stu.email} - Tuần {intern.current_week}",
            "desc": f"Báo cáo tuần {intern.current_week} tại {intern.company_name} cần cố vấn xem xét.",
            "timeText": "Tuần hiện tại",
            "targetTab": "internships",
            "internshipId": intern.id,
        })

    return CounselorDashboardOut(
        total_students=int(total_assigned),
        pending_cv_review=int(pending_cvs),
        partner_companies=int(partner_count),
        open_talent_requests=int(open_requests),
        upcoming_interviews=int(interviews_count),
        interviewing_students=interviewing_students,
        urgent_actions=urgent_actions,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. STUDENT LIST & SEARCH / FILTER / PAGINATION
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/students", response_model=CounselorStudentListResponse | list[CounselorAssignmentOut])
async def list_assigned_students(
    search: str = Query(default=""),
    major: str = Query(default="all"),
    cv_status: str = Query(default="all"),
    sort_by: str = Query(default="match"),
    page: int | None = Query(default=None),
    page_size: int = Query(default=6, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorStudentListResponse | list[CounselorAssignmentOut]:
    if page is None and not search and major == "all" and cv_status == "all":
        rows = await db.execute(
            select(CounselorAssignment, User)
            .join(User, User.id == CounselorAssignment.student_id)
            .where(
                CounselorAssignment.counselor_id == counselor.id,
                CounselorAssignment.status == "active",
            )
            .order_by(CounselorAssignment.consented_at.desc())
        )
        return [_assignment_out(assignment, counselor, student) for assignment, student in rows.all()]

    page_num = page or 1
    assigned_subq = select(CounselorAssignment.student_id).where(
        CounselorAssignment.counselor_id == counselor.id,
        CounselorAssignment.status == "active",
    ).subquery()
    assigned_count = await db.scalar(select(func.count()).select_from(assigned_subq))

    query = select(User).where(User.role == "student")
    if assigned_count and assigned_count > 0:
        query = query.where(User.id.in_(select(assigned_subq.c.student_id)))

    search_clean = search.strip().lower()
    if search_clean:
        query = query.where(
            or_(
                func.lower(User.full_name).contains(search_clean),
                func.lower(User.email).contains(search_clean),
                func.lower(User.major).contains(search_clean),
                func.lower(User.target_role).contains(search_clean),
            )
        )

    if major and major != "all":
        if major == "it":
            query = query.where(or_(User.major.contains("Công nghệ"), User.major.contains("IT"), User.major.contains("Phần mềm")))
        elif major == "biz":
            query = query.where(or_(User.major.contains("Kinh doanh"), User.major.contains("Marketing"), User.major.contains("Dữ liệu")))
        elif major == "design":
            query = query.where(or_(User.major.contains("Thiết kế"), User.major.contains("Đồ họa"), User.major.contains("UI/UX")))

    user_rows = (await db.execute(query)).scalars().all()

    student_items: list[CounselorStudentListItem] = []
    for u in user_rows:
        latest_cv = (
            await db.execute(
                select(CV).where(CV.user_id == u.id).order_by(CV.created_at.desc()).limit(1)
            )
        ).scalar_one_or_none()

        cv_stat = latest_cv.cv_status if latest_cv else "pending"
        if cv_status and cv_status != "all" and cv_stat != cv_status:
            continue

        latest_analysis = (
            await db.execute(
                select(CVAnalysis).where(CVAnalysis.user_id == u.id).order_by(CVAnalysis.created_at.desc()).limit(1)
            )
        ).scalar_one_or_none()

        match_score = int(latest_analysis.match_score or 0) if latest_analysis else 0

        skills = []
        if latest_cv and latest_cv.parsed_json and isinstance(latest_cv.parsed_json, dict):
            raw_skills = latest_cv.parsed_json.get("skills", [])
            if isinstance(raw_skills, list):
                skills = [str(s) for s in raw_skills[:4]]

        student_items.append(
            CounselorStudentListItem(
                id=u.id,
                name=u.full_name or u.email.split("@")[0],
                email=u.email,
                major=u.major or "Chưa cập nhật",
                cohort=u.cohort or "Chưa cập nhật",
                target_role=u.target_role or "Chưa cập nhật",
                avatar=u.avatar_url,
                initials="".join([p[0].upper() for p in (u.full_name or "SV").split()[:2]]),
                cv_status=cv_stat,
                gpa=u.gpa or "Chưa cập nhật",
                skills=skills,
                match_rate=match_score,
                last_active="—",
            )
        )

    if sort_by == "match":
        student_items.sort(key=lambda x: x.match_rate, reverse=True)
    elif sort_by == "name":
        student_items.sort(key=lambda x: x.name)
    elif sort_by == "recent":
        student_items.sort(key=lambda x: x.id, reverse=True)

    total = len(student_items)
    total_pages = max(1, math.ceil(total / page_size))
    start_idx = (page_num - 1) * page_size
    paginated_items = student_items[start_idx : start_idx + page_size]

    return CounselorStudentListResponse(
        items=paginated_items,
        total=total,
        page=page_num,
        page_size=page_size,
        total_pages=total_pages,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. STUDENT DETAIL & VERIFICATION & TASKS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/students/{student_id}", response_model=CounselorStudentOverview)
async def get_student_overview(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorStudentOverview:
    await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)
    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")

    cv_count = await db.scalar(select(func.count(CV.id)).where(CV.user_id == student_id)) or 0
    analysis_count = await db.scalar(select(func.count(CVAnalysis.id)).where(CVAnalysis.user_id == student_id)) or 0
    interview_count = (
        await db.scalar(select(func.count(InterviewSession.id)).where(InterviewSession.user_id == student_id)) or 0
    )
    completed_count = (
        await db.scalar(
            select(func.count(InterviewSession.id)).where(
                InterviewSession.user_id == student_id,
                InterviewSession.status == "completed",
            )
        )
        or 0
    )
    average_score = await db.scalar(
        select(func.avg(InterviewReport.total_score))
        .join(InterviewSession, InterviewSession.id == InterviewReport.session_id)
        .where(InterviewSession.user_id == student_id)
    )
    score_rows = await db.execute(
        select(InterviewReport.total_score)
        .join(InterviewSession, InterviewSession.id == InterviewReport.session_id)
        .where(InterviewSession.user_id == student_id)
        .order_by(InterviewSession.created_at.asc())
    )
    interview_scores = [float(score) for score in score_rows.scalars().all() if score is not None]
    first_interview_score = interview_scores[0] if interview_scores else None
    latest_interview_score = interview_scores[-1] if interview_scores else None
    score_delta = (
        latest_interview_score - first_interview_score
        if first_interview_score is not None and latest_interview_score is not None
        else None
    )
    average_csat = await db.scalar(
        select(func.avg(InterviewFeedback.rating)).where(InterviewFeedback.user_id == student_id)
    )
    feedback_result = await db.execute(
        select(CounselorFeedback)
        .where(CounselorFeedback.student_id == student_id)
        .order_by(CounselorFeedback.created_at.desc())
        .limit(20)
    )

    cvs_result = await db.execute(select(CV).where(CV.user_id == student_id).order_by(CV.created_at.desc()))
    student_cvs = [CVOut.model_validate(item) for item in cvs_result.scalars().all()]

    analyses_result = await db.execute(
        select(CVAnalysis).where(CVAnalysis.user_id == student_id).order_by(CVAnalysis.created_at.desc())
    )
    student_analyses = []
    for item in analyses_result.scalars().all():
        gap_data = item.gap_analysis_json or {}
        student_analyses.append(
            GapAnalysisResponse(
                id=item.id,
                cv_id=item.cv_id,
                jd_id=item.jd_id,
                pipeline_version=gap_data.get("pipeline_version", "1.0"),
                trace_id=gap_data.get("trace_id", ""),
                match_id=gap_data.get("match_id", ""),
                candidate_id=gap_data.get("candidate_id", ""),
                document_id=gap_data.get("document_id", ""),
                status=gap_data.get("status", "COMPLETED"),
                match_score=item.match_score,
                final_score=gap_data.get("final_score", item.match_score),
                rating=gap_data.get("rating", "POOR"),
                mandatory_requirement_failed=gap_data.get("mandatory_requirement_failed", False),
                criteria=gap_data.get("criteria", []),
                requirements=gap_data.get("requirements", {}),
                evidence=gap_data.get("evidence", []),
                retrieval_results=gap_data.get("retrieval_results", []),
                cv_chunks=gap_data.get("cv_chunks", []),
                warnings=gap_data.get("warnings", []),
                versions=gap_data.get("versions", {}),
                processing_trace=gap_data.get("processing_trace", []),
                structured_cv=gap_data.get("structured_cv", {}),
                structured_jd=gap_data.get("structured_jd", {}),
                raw_match_score=gap_data.get("raw_match_score", item.match_score),
                match_level=gap_data.get("match_level", "partial_match"),
                confidence_score=gap_data.get("confidence_score", 0.0),
                confidence_level=gap_data.get("confidence_level", "low"),
                must_have_coverage=gap_data.get("must_have_coverage", 0.0),
                must_have_gate=gap_data.get("must_have_gate", {}),
                hard_skills_matching=gap_data.get("hard_skills_matching", []),
                hard_skills_partial=gap_data.get("hard_skills_partial", []),
                hard_skills_missing=gap_data.get("hard_skills_missing", []),
                soft_skills_gap=gap_data.get("soft_skills_gap", []),
                unknown_requirements=gap_data.get("unknown_requirements", []),
                requirement_evidence=gap_data.get("requirement_evidence", []),
                strengths=gap_data.get("strengths", []),
                risks=gap_data.get("risks", []),
                suggestions=item.optimized_suggestions_json or [],
                executive_summary=gap_data.get("executive_summary", ""),
                priority_actions=gap_data.get("priority_actions", []),
                learning_recommendations=gap_data.get("learning_recommendations", []),
                certification_recommendations=gap_data.get("certification_recommendations", []),
                project_recommendations=gap_data.get("project_recommendations", []),
                cv_section_recommendations=gap_data.get("cv_section_recommendations", []),
                score_breakdown=gap_data.get("score_breakdown", {}),
                integrity_guardrail=gap_data.get("integrity_guardrail", "passed"),
                created_at=item.created_at,
            )
        )

    interviews_result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == student_id)
        .options(selectinload(InterviewSession.report))
        .order_by(InterviewSession.created_at.desc())
    )
    student_interviews = [
        InterviewSessionSummaryOut(
            id=session.id,
            cv_id=session.cv_id,
            jd_id=session.jd_id,
            status=session.status,
            total_questions=session.total_questions,
            current_question_index=session.current_question_index,
            created_at=session.created_at,
            completed_at=session.completed_at,
            total_score=session.report.total_score if session.report else None,
        )
        for session in interviews_result.scalars().all()
    ]

    return CounselorStudentOverview(
        student=UserOut.model_validate(student),
        cv_count=int(cv_count),
        analysis_count=int(analysis_count),
        interview_count=int(interview_count),
        completed_interview_count=int(completed_count),
        average_star_score=round(float(average_score or 0.0), 2),
        first_interview_score=round(first_interview_score, 2) if first_interview_score is not None else None,
        latest_interview_score=round(latest_interview_score, 2) if latest_interview_score is not None else None,
        interview_score_delta=round(score_delta, 2) if score_delta is not None else None,
        average_csat=round(float(average_csat), 2) if average_csat is not None else None,
        recent_feedback=[CounselorFeedbackOut.model_validate(item) for item in feedback_result.scalars().all()],
        cvs=student_cvs,
        analyses=student_analyses,
        interviews=student_interviews,
    )


@router.post("/students/{student_id}/verify", response_model=dict)
async def verify_student_profile(
    student_id: str,
    payload: CounselorVerifyProfileRequest,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> dict:
    assignment = await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)

    cv_res = await db.execute(
        select(CV).where(CV.user_id == student_id).order_by(CV.created_at.desc()).limit(1)
    )
    latest_cv = cv_res.scalar_one_or_none()
    if latest_cv:
        latest_cv.cv_status = "verified"

    content = payload.feedback or "Cố vấn đã thẩm định và cấp dấu xác nhận hồ sơ năng lực cho sinh viên."
    if payload.referral_note:
        content += f"\n\nGhi chú tiến cử: {payload.referral_note}"

    feedback = CounselorFeedback(
        assignment_id=assignment.id,
        counselor_id=counselor.id,
        student_id=student_id,
        kind="comment",
        content=content,
    )
    db.add(feedback)
    await db.commit()

    await NotificationService.trigger_advisor_feedback(
        db=db,
        advisor_id=counselor.id,
        advisor_name=counselor.full_name or counselor.email,
        student_id=student_id,
        cv_title=latest_cv.title if latest_cv else "Hồ sơ cá nhân",
        cv_id=latest_cv.id if latest_cv else student_id,
    )
    logger.info("Counselor verified student profile: student_id=%s, counselor_id=%s", student_id, counselor.id)

    return {"status": "verified", "message": "Đã cấp dấu xác nhận hồ sơ thành công"}


@router.post("/students/{student_id}/tasks", response_model=CounselorFeedbackOut, status_code=status.HTTP_201_CREATED)
async def assign_student_task(
    student_id: str,
    payload: CounselorTaskCreate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorFeedbackOut:
    assignment = await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)

    cv_res = await db.execute(
        select(CV).where(CV.user_id == student_id).order_by(CV.created_at.desc()).limit(1)
    )
    latest_cv = cv_res.scalar_one_or_none()
    if latest_cv:
        latest_cv.cv_status = "needs_task"

    content = f"Nhiệm vụ cải thiện: {payload.title}\n{payload.description}"
    if payload.due_date:
        content += f"\nHạn chót: {payload.due_date}"

    feedback = CounselorFeedback(
        assignment_id=assignment.id,
        counselor_id=counselor.id,
        student_id=student_id,
        kind="task",
        content=content,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    await NotificationService.trigger_advisor_feedback(
        db=db,
        advisor_id=counselor.id,
        advisor_name=counselor.full_name or counselor.email,
        student_id=student_id,
        cv_title=payload.title,
        cv_id=latest_cv.id if latest_cv else student_id,
    )
    logger.info("Counselor assigned task: student_id=%s, title=%s", student_id, payload.title)

    return CounselorFeedbackOut.model_validate(feedback)


@router.post("/students/{student_id}/feedback", response_model=CounselorFeedbackOut, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    student_id: str,
    payload: CounselorFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorFeedbackOut:
    assignment = await _active_assignment(db, counselor_id=counselor.id, student_id=student_id)

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

    await NotificationService.trigger_advisor_feedback(
        db=db,
        advisor_id=counselor.id,
        advisor_name=counselor.full_name or counselor.email,
        student_id=student_id,
        cv_title="hồ sơ phỏng vấn STAR" if payload.interview_report_id else "CV",
        cv_id=payload.interview_report_id or student_id,
    )

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


# ─────────────────────────────────────────────────────────────────────────────
# 5. OPPORTUNITIES & CANDIDATE MATCHING
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/opportunities", response_model=list[CounselorOpportunityItem])
async def list_counselor_opportunities(
    tab: str = Query(default="requests"),
    search: str = Query(default=""),
    field: str = Query(default="all"),
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> list[CounselorOpportunityItem]:
    query = select(JobDescription).where(JobDescription.is_published.is_(True))

    if search.strip():
        s = search.strip().lower()
        query = query.where(
            or_(
                func.lower(JobDescription.title).contains(s),
                func.lower(JobDescription.company).contains(s),
                func.lower(JobDescription.requirements_text).contains(s),
            )
        )

    rows = (await db.execute(query.order_by(JobDescription.created_at.desc()))).scalars().all()
    items: list[CounselorOpportunityItem] = []

    for jd in rows:
        is_request = not jd.is_system
        if tab == "requests" and not is_request:
            continue
        if tab == "jobs" and is_request:
            continue

        norm = jd.normalized_json or {}
        norm_tags = [str(tag) for tag in (norm.get("tags") or []) if str(tag)]
        norm_nice = [
            str(item.get("name"))
            for item in (norm.get("nice_to_have_skills") or [])
            if isinstance(item, dict) and item.get("name")
        ]
        salary_min = str(norm.get("salary_min") or "").strip()
        salary_max = str(norm.get("salary_max") or "").strip()
        allowance = (
            f"{salary_min} - {salary_max} {str(norm.get('salary_currency') or 'VND')}"
            if salary_min and salary_max and str(norm.get("salary_visibility")) == "Công khai"
            else None
        )
        deadline_raw = str(norm.get("deadline") or "").strip()
        try:
            deadline_value = (
                datetime.strptime(deadline_raw, "%Y-%m-%d").strftime("%d/%m/%Y")
                if deadline_raw
                else None
            )
        except ValueError:
            deadline_value = None

        items.append(
            CounselorOpportunityItem(
                id=jd.id,
                company=jd.company or "Doanh nghiệp đối tác",
                logo=None,
                position=jd.title,
                location=jd.location or "Chưa xác định",
                slots=1,
                match_rate=0,
                type=str(norm.get("employment_type") or ("Thực tập" if is_request else "Full-time")),
                field="it",
                allowance=allowance,
                must_have=norm_tags[:5],
                nice_to_have=norm_nice[:5],
                deadline=deadline_value,
                desc=jd.requirements_text[:200] + "..." if len(jd.requirements_text) > 200 else jd.requirements_text,
                is_talent_request=is_request,
            )
        )
    return items


@router.get("/opportunities/{job_id}/candidates", response_model=list[CounselorCandidateMatchItem])
async def list_job_suitable_candidates(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> list[CounselorCandidateMatchItem]:
    jd = await db.get(JobDescription, job_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu tuyển dụng.")

    students = (await db.execute(select(User).where(User.role == "student").limit(20))).scalars().all()
    results: list[CounselorCandidateMatchItem] = []

    for st in students:
        latest_cv = (
            await db.execute(select(CV).where(CV.user_id == st.id).order_by(CV.created_at.desc()).limit(1))
        ).scalar_one_or_none()

        analysis = (
            await db.execute(
                select(CVAnalysis)
                .where(CVAnalysis.user_id == st.id, CVAnalysis.jd_id == job_id)
                .order_by(CVAnalysis.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        matched_skills: list[str] = []
        missing_skills: list[str] = []
        if analysis:
            gap_data = analysis.gap_analysis_json or {}
            score = int(analysis.match_score or 0)
            rating = "EXCELLENT" if score >= 90 else "GOOD" if score >= 75 else "FAIR"
            matched_skills = [str(s) for s in (gap_data.get("hard_skills_matching") or [])][:5]
            missing_skills = [str(s) for s in (gap_data.get("hard_skills_missing") or [])][:5]
        elif latest_cv:
            # Không có phân tích đầy đủ: chấm điểm sơ bộ minh bạch theo kỹ năng
            # đọc được từ CV, không gán số điểm mẫu.
            from src.services.job_catalog import _score_job_for_cv

            prefilter = _score_job_for_cv(
                {
                    "title": jd.title or "",
                    "domain": "",
                    "skills": [
                        str(item.get("name"))
                        for item in ((jd.normalized_json or {}).get("must_have_skills") or [])
                        if isinstance(item, dict) and item.get("name")
                    ]
                    or [str(tag) for tag in ((jd.normalized_json or {}).get("tags") or [])],
                },
                latest_cv.raw_text or "",
                latest_cv.parsed_json or {},
            )
            score = int(prefilter.get("match_score") or 0)
            rating = "EXCELLENT" if score >= 90 else "GOOD" if score >= 75 else "FAIR"
            matched_skills = [str(s) for s in (prefilter.get("matched_skills") or [])][:5]
            missing_skills = [str(s) for s in (prefilter.get("missing_skills") or [])][:5]
        else:
            score = 0
            rating = "NO_CV"

        results.append(
            CounselorCandidateMatchItem(
                id=st.id,
                name=st.full_name or st.email.split("@")[0],
                university=st.university or "Chưa cập nhật",
                avatar=st.avatar_url,
                initials="".join([p[0].upper() for p in (st.full_name or "SV").split()[:2]]),
                match_score=score,
                rating_label=rating,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                cv_status=latest_cv.cv_status if latest_cv else "pending",
                availability="Theo hồ sơ",
                cv_id=latest_cv.id if latest_cv else None,
            )
        )

    results.sort(key=lambda x: x.match_score, reverse=True)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 6. REFERRALS (TIẾN CỬ)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/referrals", response_model=CounselorReferralItemOut, status_code=status.HTTP_201_CREATED)
async def create_referral(
    payload: CounselorReferralCreate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorReferralItemOut:
    student = await db.get(User, payload.student_id)
    assignment = await db.execute(
        select(CounselorAssignment).where(
            CounselorAssignment.counselor_id == counselor.id,
            CounselorAssignment.student_id == payload.student_id,
        )
    )
    if student and not assignment.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Counselor can only refer assigned students.")
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")

    jd = await db.get(JobDescription, payload.jd_id)
    if not jd:
        raise HTTPException(status_code=404, detail="Không tìm thấy vị trí tuyển dụng.")

    cv_id = payload.cv_id
    if not cv_id:
        cv_res = await db.execute(
            select(CV).where(CV.user_id == payload.student_id).order_by(CV.created_at.desc()).limit(1)
        )
        latest_cv = cv_res.scalar_one_or_none()
        cv_id = latest_cv.id if latest_cv else "default-cv"

    existing = (
        await db.execute(
            select(JobApplication).where(
                JobApplication.jd_id == payload.jd_id,
                JobApplication.student_id == payload.student_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        # Reuse the existing row instead of inserting a duplicate, and record
        # that a counselor is now vouching for this candidate.
        existing.source = APPLICATION_SOURCE_COUNSELOR_REFERRAL
        existing.referred_by_counselor_id = counselor.id
        app = existing
    else:
        # Điểm match phải đến từ kết quả phân tích thật (nếu có), không gán số mẫu.
        referral_analysis = (
            await db.execute(
                select(CVAnalysis)
                .where(CVAnalysis.user_id == payload.student_id, CVAnalysis.jd_id == payload.jd_id)
                .order_by(CVAnalysis.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        referral_score = float(referral_analysis.match_score or 0.0) if referral_analysis else 0.0
        app = JobApplication(
            jd_id=payload.jd_id,
            student_id=payload.student_id,
            cv_id=cv_id,
            match_score=referral_score,
            status="submitted",
            source=APPLICATION_SOURCE_COUNSELOR_REFERRAL,
            referred_by_counselor_id=counselor.id,
        )
        db.add(app)

    await db.commit()
    await db.refresh(app)

    if not existing:
        await NotificationService.trigger_referral_consent_requested(
            db=db,
            advisor_id=counselor.id,
            advisor_name=counselor.full_name or counselor.email,
            student_id=student.id,
            company_name=jd.company or "Doanh nghiệp",
            job_title=jd.title,
            job_id=jd.id,
        )
    logger.info("Referral application created & consent requested: application_id=%s, student_id=%s, jd_id=%s", app.id, student.id, jd.id)

    return CounselorReferralItemOut(
        id=app.id,
        student_id=student.id,
        student_name=student.full_name or student.email,
        student_major=student.major or "Kỹ thuật Phần mềm",
        student_avatar=student.avatar_url,
        position=jd.title,
        company=jd.company or "Doanh nghiệp",
        match_score=int(app.match_score),
        skills=["React", "TypeScript"],
        date=datetime.now().strftime("%d/%m/%Y"),
        last_updated="Vừa cập nhật",
        stage="waiting_consent" if app.status == "pending_consent" else "shared_enterprise",
        stage_label="Chờ sinh viên đồng ý" if app.status == "pending_consent" else "Đã có hồ sơ trong quy trình",
        notes=payload.notes or "Cố vấn đã gửi hồ sơ tiến cử đến doanh nghiệp.",
    )


@router.get("/referrals", response_model=list[CounselorReferralItemOut])
async def list_counselor_referrals(
    stage: str = Query(default="all"),
    search: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> list[CounselorReferralItemOut]:
    query = (
        select(JobApplication, User, JobDescription)
        .join(User, User.id == JobApplication.student_id)
        .join(JobDescription, JobDescription.id == JobApplication.jd_id)
        .where(
            (JobApplication.referred_by_counselor_id == counselor.id)
            | JobApplication.student_id.in_(
                select(CounselorAssignment.student_id).where(CounselorAssignment.counselor_id == counselor.id)
            )
        )
        .order_by(JobApplication.shared_at.desc())
    )

    rows = (await db.execute(query)).all()
    results: list[CounselorReferralItemOut] = []

    async def _referral_skills(student_id: str) -> list[str]:
        cv_row = (
            await db.execute(select(CV).where(CV.user_id == student_id).order_by(CV.created_at.desc()).limit(1))
        ).scalar_one_or_none()
        parsed = (cv_row.parsed_json or {}) if cv_row else {}
        raw_skills = parsed.get("skills", []) if isinstance(parsed, dict) else []
        return [str(s) for s in (raw_skills or [])][:4] if isinstance(raw_skills, list) else []

    for app, student_user, jd in rows:
        stage_mapped = "waiting_consent" if app.status == "pending_consent" else "shared_enterprise"
        stage_lbl = "Đã qua vòng CV"
        if app.status == "interview":
            stage_mapped = "interviewing"
            stage_lbl = "Đang phỏng vấn"
        elif app.status == "hired":
            stage_mapped = "offered"
            stage_lbl = "Đã nhận Offer"
        elif app.status == "rejected":
            stage_mapped = "ended"
            stage_lbl = "Đã dừng lại"

        if stage != "all" and stage != stage_mapped:
            continue

        if search.strip():
            s = search.strip().lower()
            if (
                s not in (student_user.full_name or "").lower()
                and s not in (student_user.email or "").lower()
                and s not in (jd.title or "").lower()
                and s not in (jd.company or "").lower()
            ):
                continue

        results.append(
            CounselorReferralItemOut(
                id=app.id,
                student_id=student_user.id,
                student_name=student_user.full_name or student_user.email,
                student_major=student_user.major or "Chưa cập nhật",
                student_avatar=student_user.avatar_url,
                position=jd.title,
                company=jd.company or "Doanh nghiệp",
                match_score=int(app.match_score or 0),
                skills=await _referral_skills(app.student_id),
                date=app.shared_at.strftime("%d/%m/%Y"),
                last_updated=app.decided_at.strftime("%d/%m/%Y") if app.decided_at else app.shared_at.strftime("%d/%m/%Y"),
                stage=stage_mapped,
                stage_label=stage_lbl,
                notes="Hồ sơ được cố vấn duyệt và tiến cử trực tiếp.",
            )
        )

    return results


@router.get("/referrals/{referral_id}", response_model=CounselorReferralItemOut)
async def get_counselor_referral_detail(
    referral_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorReferralItemOut:
    row = (
        await db.execute(
            select(JobApplication, User, JobDescription)
            .join(User, User.id == JobApplication.student_id)
            .join(JobDescription, JobDescription.id == JobApplication.jd_id)
            .where(JobApplication.id == referral_id)
        )
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin tiến cử.")

    app, student_user, jd = row
    is_assigned = (
        await db.execute(
            select(CounselorAssignment.id).where(
                CounselorAssignment.counselor_id == counselor.id,
                CounselorAssignment.student_id == app.student_id,
            )
        )
    ).scalar_one_or_none()
    if app.referred_by_counselor_id != counselor.id and not is_assigned:
        raise HTTPException(status_code=403, detail="Counselor cannot view this application.")

    referral_cv = (
        await db.execute(select(CV).where(CV.user_id == app.student_id).order_by(CV.created_at.desc()).limit(1))
    ).scalar_one_or_none()
    parsed = (referral_cv.parsed_json or {}) if referral_cv else {}
    raw_skills = parsed.get("skills", []) if isinstance(parsed, dict) else []

    return CounselorReferralItemOut(
        id=app.id,
        student_id=student_user.id,
        student_name=student_user.full_name or student_user.email,
        student_major=student_user.major or "Chưa cập nhật",
        student_avatar=student_user.avatar_url,
        position=jd.title,
        company=jd.company or "Doanh nghiệp",
        match_score=int(app.match_score or 0),
        skills=[str(s) for s in (raw_skills or [])][:4] if isinstance(raw_skills, list) else [],
        date=app.shared_at.strftime("%d/%m/%Y"),
        last_updated=app.decided_at.strftime("%d/%m/%Y") if app.decided_at else app.shared_at.strftime("%d/%m/%Y"),
        stage="shared_enterprise",
        stage_label="Đã gửi DN",
        notes="Hồ sơ được cố vấn duyệt và tiến cử trực tiếp.",
    )


@router.patch("/referrals/{referral_id}", response_model=CounselorReferralItemOut)
async def update_counselor_referral(
    referral_id: str,
    payload: CounselorReferralUpdate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorReferralItemOut:
    # Counselor access is read-only for recruitment progress. Enterprise owns
    # status changes for every application origin.
    raise HTTPException(status_code=403, detail="Only Enterprise can update recruitment status.")
    app = await db.get(JobApplication, referral_id)
    if not app:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến cử.")

    if payload.stage == "interviewing":
        app.status = "interview"
    elif payload.stage == "offered":
        app.status = "hired"
    elif payload.stage == "ended":
        app.status = "rejected"

    await db.commit()
    return await get_counselor_referral_detail(referral_id, db, counselor)


# ─────────────────────────────────────────────────────────────────────────────
# 7. INTERNSHIPS (GIÁM SÁT THỰC TẬP)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/internships", response_model=list[CounselorInternshipItemOut])
async def list_counselor_internships(
    search: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> list[CounselorInternshipItemOut]:
    rows = (
        await db.execute(
            select(StudentInternship, User)
            .join(User, User.id == StudentInternship.student_id)
            .where(
                StudentInternship.student_id.in_(
                    select(CounselorAssignment.student_id).where(
                        CounselorAssignment.counselor_id == counselor.id,
                        CounselorAssignment.status == "active",
                    )
                )
                if counselor.role != "admin"
                else True
            )
            .order_by(StudentInternship.created_at.desc())
        )
    ).all()

    results: list[CounselorInternshipItemOut] = []
    for intern, st in rows:
        if search.strip():
            s = search.strip().lower()
            if (
                s not in (st.full_name or "").lower()
                and s not in (st.email or "").lower()
                and s not in (intern.company_name or "").lower()
                and s not in (intern.position or "").lower()
            ):
                continue

        results.append(
            CounselorInternshipItemOut(
                id=intern.id,
                student_id=st.id,
                student_name=st.full_name or st.email,
                student_major=st.major or "Kỹ thuật Phần mềm",
                student_avatar=st.avatar_url,
                initials="".join([p[0].upper() for p in (st.full_name or "SV").split()[:2]]),
                company=intern.company_name,
                location=intern.location,
                position=intern.position,
                mentor_name=intern.mentor_name,
                mentor_title=intern.mentor_title,
                mentor_email=intern.mentor_email,
                current_week=intern.current_week,
                total_weeks=intern.total_weeks,
                last_report_status=intern.last_report_status,
                status_label=intern.status_label,
                progress_percent=intern.progress_percent,
                weekly_reports=intern.weekly_reports_json or [],
            )
        )

    return results


@router.get("/internships/{internship_id}", response_model=CounselorInternshipItemOut)
async def get_counselor_internship_detail(
    internship_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorInternshipItemOut:
    row = (
        await db.execute(
            select(StudentInternship, User)
            .join(User, User.id == StudentInternship.student_id)
            .where(StudentInternship.id == internship_id)
        )
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình thực tập.")

    intern, st = row
    if counselor.role != "admin":
        await _active_assignment(db, counselor_id=counselor.id, student_id=intern.student_id)
    return CounselorInternshipItemOut(
        id=intern.id,
        student_id=st.id,
        student_name=st.full_name or st.email,
        student_major=st.major or "Kỹ thuật Phần mềm",
        student_avatar=st.avatar_url,
        initials="".join([p[0].upper() for p in (st.full_name or "SV").split()[:2]]),
        company=intern.company_name,
        location=intern.location,
        position=intern.position,
        mentor_name=intern.mentor_name,
        mentor_title=intern.mentor_title,
        mentor_email=intern.mentor_email,
        current_week=intern.current_week,
        total_weeks=intern.total_weeks,
        last_report_status=intern.last_report_status,
        status_label=intern.status_label,
        progress_percent=intern.progress_percent,
        weekly_reports=intern.weekly_reports_json or [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 8. PARTNER NETWORK (MẠNG LƯỚI ĐỐI TÁC)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/partners", response_model=list[CounselorPartnerItemOut])
async def list_counselor_partners(
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> list[CounselorPartnerItemOut]:
    rows = (await db.execute(select(PartnerOrganization).order_by(PartnerOrganization.name))).scalars().all()

    if not rows:
        default_partners = [
            PartnerOrganization(
                id="partner-1",
                name="FPT Software",
                code="FSOFT",
                industry="Phần mềm & Đám mây",
                location="Hà Nội / TP. HCM",
                description="Tập đoàn công nghệ hàng đầu Việt Nam, tiên phong trong phát triển nhân tài phần mềm và chuyển đổi số.",
                contact_person="Nguyễn Hoàng Nam",
                contact_email="hr@fsoft.com.vn",
            ),
            PartnerOrganization(
                id="partner-2",
                name="KMS Technology",
                code="KMS",
                industry="Dịch vụ Kỹ thuật Phần mềm",
                location="TP. Hồ Chí Minh",
                description="Công ty phát triển phần mềm chuẩn quốc tế với các giải pháp AI và kỹ thuật hiện đại.",
                contact_person="Lê Thị Thảo",
                contact_email="recruitment@kms-technology.com",
            ),
            PartnerOrganization(
                id="partner-3",
                name="TMA Solutions",
                code="TMA",
                industry="Viễn thông & IoT",
                location="TP. Hồ Chí Minh / Quy Nhơn",
                description="Một trong những công ty công nghệ viễn thông và giải pháp IoT hàng đầu khu vực.",
                contact_person="Phạm Văn Hùng",
                contact_email="careers@tmasolutions.com",
            ),
            PartnerOrganization(
                id="partner-4",
                name="VNG Corporation",
                code="VNG",
                industry="Internet & Cloud Services",
                location="TP. Hồ Chí Minh (VNG Campus)",
                description="Kỳ lân công nghệ đầu tiên của Việt Nam với các sản phẩm Zalo, ZaloPay và game.",
                contact_person="Trần Mỹ Linh",
                contact_email="talent@vng.com.vn",
            ),
        ]
        for p in default_partners:
            db.add(p)
        await db.commit()
        rows = (await db.execute(select(PartnerOrganization).order_by(PartnerOrganization.name))).scalars().all()

    results: list[CounselorPartnerItemOut] = []
    for p in rows:
        results.append(
            CounselorPartnerItemOut(
                id=p.id,
                name=p.name,
                logo=p.logo,
                banner=p.banner,
                industry=p.industry,
                location=p.location,
                description=p.description,
                interns_count=24,
                open_talent_requests=2,
                contact_person=p.contact_person,
                contact_email=p.contact_email,
                contact_phone=p.contact_phone,
            )
        )
    return results


@router.get("/partners/{partner_id}", response_model=CounselorPartnerItemOut)
async def get_counselor_partner_detail(
    partner_id: str,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorPartnerItemOut:
    p = await db.get(PartnerOrganization, partner_id)
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin đối tác.")

    return CounselorPartnerItemOut(
        id=p.id,
        name=p.name,
        logo=p.logo,
        banner=p.banner,
        industry=p.industry,
        location=p.location,
        description=p.description,
        interns_count=24,
        open_talent_requests=2,
        contact_person=p.contact_person,
        contact_email=p.contact_email,
        contact_phone=p.contact_phone,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. COUNSELOR PROFILE & SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=CounselorProfileDataOut)
async def get_counselor_profile(
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorProfileDataOut:
    profile = (
        await db.execute(select(CounselorProfile).where(CounselorProfile.user_id == counselor.id))
    ).scalar_one_or_none()

    if not profile:
        profile = CounselorProfile(
            user_id=counselor.id,
            academic_title="Tiến sĩ",
            faculty="Khoa Khoa học & Kỹ thuật Máy tính",
            department="Bộ môn Công nghệ Phần mềm",
            phone_ext="+84 (28) 3865 4321",
            office_location="Phòng 304 - Tòa nhà H6",
            role_title="Cố vấn học tập & Hướng nghiệp",
            active_cohorts_json=["K18 (2022-2026)", "K19 (2023-2027)"],
            specializations_json=["Kỹ thuật phần mềm", "Kiến trúc Cloud & AI", "Chuẩn bị phỏng vấn STAR"],
            office_hours="Thứ 3 & Thứ 5 (14:00 - 16:30)",
            bio="Cố vấn chuyên môn khối ngành Kỹ thuật Phần mềm với hơn 10 năm kinh nghiệm giảng dạy và kết nối doanh nghiệp.",
            notification_preferences_json={
                "emailOnNewCV": True,
                "emailOnMatchAlert": True,
                "emailOnInternshipReport": True,
                "weeklySummaryDigest": True,
            },
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    assigned_count = await db.scalar(
        select(func.count(CounselorAssignment.id)).where(
            CounselorAssignment.counselor_id == counselor.id,
            CounselorAssignment.status == "active",
        )
    ) or 48

    return CounselorProfileDataOut(
        full_name=counselor.full_name or "Cố vấn học tập",
        academic_title=profile.academic_title,
        faculty=profile.faculty,
        department=profile.department,
        work_email=counselor.email,
        phone_ext=profile.phone_ext or "",
        office_location=profile.office_location or "",
        role_title=profile.role_title,
        assigned_students_count=int(assigned_count),
        active_cohorts=profile.active_cohorts_json or [],
        specializations=profile.specializations_json or [],
        office_hours=profile.office_hours or "",
        bio=profile.bio or "",
        notification_preferences=profile.notification_preferences_json or {},
    )


@router.put("/profile", response_model=CounselorProfileDataOut)
async def update_counselor_profile(
    payload: CounselorProfileUpdate,
    db: AsyncSession = Depends(get_db),
    counselor: User = Depends(require_role(["counselor", "admin"])),
) -> CounselorProfileDataOut:
    profile = (
        await db.execute(select(CounselorProfile).where(CounselorProfile.user_id == counselor.id))
    ).scalar_one_or_none()

    if not profile:
        profile = CounselorProfile(user_id=counselor.id)
        db.add(profile)

    if payload.full_name:
        counselor.full_name = payload.full_name
    if payload.academic_title is not None:
        profile.academic_title = payload.academic_title
    if payload.faculty is not None:
        profile.faculty = payload.faculty
    if payload.department is not None:
        profile.department = payload.department
    if payload.phone_ext is not None:
        profile.phone_ext = payload.phone_ext
    if payload.office_location is not None:
        profile.office_location = payload.office_location
    if payload.role_title is not None:
        profile.role_title = payload.role_title
    if payload.active_cohorts is not None:
        profile.active_cohorts_json = payload.active_cohorts
    if payload.specializations is not None:
        profile.specializations_json = payload.specializations
    if payload.office_hours is not None:
        profile.office_hours = payload.office_hours
    if payload.bio is not None:
        profile.bio = payload.bio
    if payload.notification_preferences is not None:
        profile.notification_preferences_json = payload.notification_preferences

    await db.commit()
    await db.refresh(profile)
    return await get_counselor_profile(db, counselor)
