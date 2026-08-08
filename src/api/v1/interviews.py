from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import CV, InterviewQuestion, InterviewReport, InterviewSession, JobDescription, User
from src.models.schemas import (
    AnswerSubmitRequest,
    InterviewQuestionOut,
    InterviewReportOut,
    InterviewStartRequest,
)
from src.services.interview_service import (
    evaluate_answer_and_check_followup,
    generate_final_star_report,
    generate_interview_questions,
)

router = APIRouter(prefix="/interviews", tags=["Mock Interview Engine"])


@router.post("/start", response_model=InterviewQuestionOut, status_code=status.HTTP_201_CREATED)
async def start_interview_session(
    payload: InterviewStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewQuestionOut:
    """Bắt đầu phiên Phỏng vấn thử (Yêu cầu bắt buộc chọn 1 CV và 1 JD)."""
    # Verify CV
    stmt_cv = select(CV).where(CV.id == payload.cv_id, CV.user_id == current_user.id)
    res_cv = await db.execute(stmt_cv)
    cv = res_cv.scalar_one_or_none()
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bắt buộc phải chọn 1 CV hợp lệ của bạn trước khi bắt đầu phỏng vấn",
        )

    # Verify JD
    stmt_jd = select(JobDescription).where(
        JobDescription.id == payload.jd_id,
        or_(
            JobDescription.is_system.is_(True),
            JobDescription.created_by_user_id == current_user.id,
        ),
    )
    res_jd = await db.execute(stmt_jd)
    jd = res_jd.scalar_one_or_none()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bắt buộc phải chọn 1 Job Description hợp lệ trước khi bắt đầu phỏng vấn",
        )

    # Generate questions
    question_texts = await generate_interview_questions(
        cv_text=cv.raw_text or "",
        jd_title=jd.title,
        jd_requirements=jd.requirements_text,
        num_questions=payload.total_questions,
    )

    # Create InterviewSession
    session = InterviewSession(
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        status="ongoing",
        total_questions=len(question_texts),
        current_question_index=0,
    )
    db.add(session)
    await db.flush()

    # Create InterviewQuestions
    question_objs = []
    for idx, q_text in enumerate(question_texts):
        q_obj = InterviewQuestion(
            session_id=session.id,
            question_index=idx,
            question_text=q_text,
        )
        question_objs.append(q_obj)
        db.add(q_obj)

    await db.commit()

    return InterviewQuestionOut(
        session_id=session.id,
        question_index=0,
        question_text=question_texts[0],
        follow_up_question=None,
        # Frontend dùng cờ này như `session_completed`, không phải "đây là câu cuối".
        is_last_question=False,
    )


@router.post("/{session_id}/answer", response_model=InterviewQuestionOut)
async def submit_interview_answer(
    session_id: str,
    payload: AnswerSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewQuestionOut:
    """Gửi câu trả lời của sinh viên -> nhận phản hồi / follow-up / câu hỏi tiếp theo."""
    # Fetch session with questions
    stmt_session = (
        select(InterviewSession)
        .where(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id)
        .options(
            selectinload(InterviewSession.questions),
            selectinload(InterviewSession.cv),
            selectinload(InterviewSession.jd),
        )
    )
    res_session = await db.execute(stmt_session)
    session = res_session.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiên phỏng vấn",
        )

    if session.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phiên phỏng vấn này đã hoàn thành. Vui lòng xem báo cáo đánh giá STAR.",
        )

    curr_idx = session.current_question_index
    questions = sorted(session.questions, key=lambda x: x.question_index)

    if curr_idx >= len(questions):
        session.status = "completed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đã hết danh sách câu hỏi phỏng vấn.",
        )

    current_q = questions[curr_idx]

    # If currently answering follow up question
    if current_q.follow_up_question and not current_q.follow_up_answer:
        current_q.follow_up_answer = payload.user_answer.strip()
        # Chấm lại trên toàn bộ câu trả lời sau khi ứng viên đã bổ sung ý còn thiếu.
        combined_answer = f"{current_q.user_answer or ''}\nBổ sung: {current_q.follow_up_answer}".strip()
        followup_evaluation = await evaluate_answer_and_check_followup(
            question_text=current_q.question_text,
            user_answer=combined_answer,
            cv_text=session.cv.raw_text or "",
        )
        current_q.star_score_json = followup_evaluation.get("star_score", current_q.star_score_json or {})
        # Advance to next question
        session.current_question_index += 1
    else:
        current_q.user_answer = payload.user_answer.strip()
        # Evaluate answer
        evaluation = await evaluate_answer_and_check_followup(
            question_text=current_q.question_text,
            user_answer=current_q.user_answer,
            cv_text=session.cv.raw_text or "",
        )
        current_q.star_score_json = evaluation.get("star_score", {})

        if evaluation.get("needs_followup") and evaluation.get("follow_up_question"):
            current_q.follow_up_question = evaluation.get("follow_up_question")
            await db.commit()
            return InterviewQuestionOut(
                session_id=session.id,
                question_index=curr_idx,
                question_text=current_q.question_text,
                follow_up_question=current_q.follow_up_question,
                is_last_question=False,
            )
        else:
            # No follow-up needed, advance to next question
            session.current_question_index += 1

    # Check if session is completed
    if session.current_question_index >= session.total_questions:
        session.status = "completed"
        session.completed_at = datetime.now(UTC)

        # Generate STAR Report
        history_list = []
        for q in questions:
            history_list.append(
                {
                    "question": q.question_text,
                    "answer": q.user_answer,
                    "follow_up": q.follow_up_question,
                    "follow_up_answer": q.follow_up_answer,
                    "score": q.star_score_json,
                }
            )

        report_data = await generate_final_star_report(
            qa_history=history_list,
            jd_title=session.jd.title if session.jd else "Vị trí ứng tuyển",
        )

        new_report = InterviewReport(
            session_id=session.id,
            total_score=report_data.get("total_score", 80.0),
            star_scores_json=report_data.get("star_scores", {}),
            strengths_json=report_data.get("strengths", []),
            improvements_json=report_data.get("improvements", []),
            recommendations_json=report_data.get("recommendations", []),
        )
        db.add(new_report)
        await db.commit()

        return InterviewQuestionOut(
            session_id=session.id,
            question_index=curr_idx,
            question_text="Phiên phỏng vấn hoàn tất! Vui lòng nhận báo cáo chi tiết.",
            follow_up_question=None,
            is_last_question=True,
        )

    await db.commit()
    next_q = questions[session.current_question_index]
    return InterviewQuestionOut(
        session_id=session.id,
        question_index=session.current_question_index,
        question_text=next_q.question_text,
        follow_up_question=None,
        is_last_question=False,
    )


@router.get("/{session_id}/report", response_model=InterviewReportOut)
async def get_interview_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewReportOut:
    """Lấy báo cáo kết quả phỏng vấn thử được chấm theo Rubric STAR."""
    stmt = (
        select(InterviewReport)
        .join(InterviewSession)
        .where(InterviewReport.session_id == session_id, InterviewSession.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Báo cáo phỏng vấn chưa sẵn sàng hoặc phiên phỏng vấn chưa hoàn thành",
        )

    return InterviewReportOut(
        id=report.id,
        session_id=report.session_id,
        total_score=report.total_score,
        star_scores=report.star_scores_json or {},
        strengths=report.strengths_json or [],
        improvements=report.improvements_json or [],
        recommendations=report.recommendations_json or [],
        created_at=report.created_at,
    )
