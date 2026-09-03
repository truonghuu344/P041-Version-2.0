from datetime import UTC, datetime
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import (
    CV,
    CounselorAssignment,
    InterviewFeedback,
    InterviewQuestion,
    InterviewReport,
    InterviewSession,
    JobDescription,
    UsageEvent,
    User,
)
from src.models.schemas import (
    AnswerSubmitRequest,
    InterviewFeedbackCreate,
    InterviewFeedbackOut,
    InterviewQAOut,
    InterviewQuestionOut,
    InterviewReportOut,
    InterviewSessionSummaryOut,
    InterviewStartRequest,
)
from src.services.interview_agenda_service import enabled_questions, ensure_agenda
from src.services.interview_service import (
    evaluate_answer_and_check_followup,
    generate_final_star_report,
    generate_interview_questions,
)
from src.services.pipeline_context import get_or_create_cv_snapshot, get_or_create_jd_snapshot

router = APIRouter(prefix="/interviews", tags=["Mock Interview Engine"])


@router.post("/start", response_model=InterviewQuestionOut, status_code=status.HTTP_201_CREATED)
async def start_interview_session(
    payload: InterviewStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewQuestionOut:
    """Bắt đầu phiên Phỏng vấn thử (Yêu cầu bắt buộc chọn 1 CV và 1 JD)."""
    started_at = perf_counter()
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
            JobDescription.is_published.is_(True),
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

<<<<<<< HEAD
    # Generate questions
    #
    # Luồng voice KHÔNG dùng bộ câu hỏi sinh sẵn: VoiceInterviewOrchestrator tự
    # dẫn dắt hội thoại và ws_interview.py ghi từng cặp hỏi–đáp thật vào DB.
    # Sinh trước ở đây vừa tốn một lời gọi LLM mỗi phiên, vừa tạo ra các hàng
    # InterviewQuestion không ai trả lời và trùng question_index với hàng thật.
    #
    # Luồng text lấy câu hỏi từ agenda của cặp (CV snapshot, JD snapshot) thay
    # vì sinh mới mỗi phiên: agenda được tái dùng nên mỗi cặp CV+JD chỉ tốn một
    # lời gọi LLM dù luyện bao nhiêu lần, và mỗi câu mang theo metadata
    # (competency, evidence, rubric) để chấm điểm có căn cứ.
    is_voice = payload.mode == "voice"
    question_texts: list[str] = []
    agenda_question_ids: list[str | None] = []
    agenda_id: str | None = None
    if not is_voice:
        agenda, _was_generated = await ensure_agenda(
            db,
            user=current_user,
            cv=cv,
            jd=jd,
            num_questions=payload.total_questions,
        )
        agenda_id = agenda.id
        picked = enabled_questions(agenda)[: payload.total_questions]
        prefer_en = str(payload.language or "vi").lower().startswith("en")
        for item in picked:
            text = str(item.get("question_en") or "") if prefer_en else ""
            if not text.strip():
                text = str(item.get("question_vi") or "")
            if text.strip():
                question_texts.append(text.strip())
                agenda_question_ids.append(str(item.get("id")) if item.get("id") else None)

        # Lưới an toàn: agenda rỗng bất thường (dữ liệu cũ, hoặc mọi câu bị tắt
        # ngoài luồng UI) không được làm hỏng việc bắt đầu phỏng vấn.
        if not question_texts:
            question_texts = await generate_interview_questions(
                cv_text=cv.raw_text or "",
                jd_title=jd.title,
                jd_requirements=jd.requirements_text,
                num_questions=payload.total_questions,
            )
            agenda_question_ids = [None] * len(question_texts)
=======
    # Chế độ voice KHÔNG sinh sẵn câu hỏi: orchestrator tự sinh theo diễn biến
    # hội thoại và ghi hàng InterviewQuestion riêng qua WebSocket. Sinh sẵn ở đây
    # vừa đốt quota LLM cho những câu bị vứt đi, vừa tạo ra các hàng mồ côi trùng
    # `question_index` với hàng thật — khiến `_complete_session` gắn nhầm điểm
    # STAR sang câu chưa ai trả lời.
    question_texts: list[str] = []
    if payload.mode != "voice":
        question_texts = await generate_interview_questions(
            cv_text=cv.raw_text or "",
            jd_title=jd.title,
            jd_requirements=jd.requirements_text,
            num_questions=payload.total_questions,
        )
>>>>>>> 50ef809c611dd4a2ff99e948272a10c09e3c0475

    # Create InterviewSession
    cv_snapshot = await get_or_create_cv_snapshot(db, cv)
    jd_snapshot = await get_or_create_jd_snapshot(db, jd)
    match_id = payload.match_id
    if match_id:
        from src.db.models import MatchRun

        match = await db.scalar(
            select(MatchRun).where(MatchRun.id == match_id, MatchRun.user_id == current_user.id)
        )
        if not match or match.cv_id != cv.id or match.jd_id != jd.id:
            raise HTTPException(status_code=422, detail="Match context không khớp CV và JD đã chọn.")
    session = InterviewSession(
        user_id=current_user.id,
        cv_id=cv.id,
        jd_id=jd.id,
        cv_snapshot_id=cv_snapshot.id,
        jd_snapshot_id=jd_snapshot.id,
        match_id=match_id,
        language=payload.language,
        mode=payload.mode,
        status="ongoing",
        # Voice chưa có câu hỏi nào ở thời điểm này; giữ con số người dùng chọn
        # làm mốc hiển thị tiến độ, sẽ được ghi đè bằng số câu thật khi kết thúc.
        total_questions=payload.total_questions if is_voice else len(question_texts),
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
            agenda_question_id=agenda_question_ids[idx] if idx < len(agenda_question_ids) else None,
        )
        question_objs.append(q_obj)
        db.add(q_obj)

    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="interview_start",
            duration_ms=round((perf_counter() - started_at) * 1000),
            metadata_json={
                "question_count": len(question_texts),
                "mode": payload.mode,
                "agenda_id": agenda_id,
            },
        )
    )

    await db.commit()

    return InterviewQuestionOut(
        session_id=session.id,
        question_index=0,
<<<<<<< HEAD
        # Voice: chưa có câu hỏi nào tồn tại — frontend voice chỉ dùng session_id
        # rồi mở WebSocket, nó không đọc field này.
=======
        # Voice: lời chào và câu hỏi đầu tiên do WebSocket gửi xuống, REST không
        # có gì để trả. Frontend chế độ voice chỉ đọc `session_id` từ đáp ứng này.
>>>>>>> 50ef809c611dd4a2ff99e948272a10c09e3c0475
        question_text=question_texts[0] if question_texts else "",
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
    started_at = perf_counter()
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
            db.add(
                UsageEvent(
                    user_id=current_user.id,
                    event_name="interview_answer",
                    duration_ms=round((perf_counter() - started_at) * 1000),
                    metadata_json={"follow_up": True},
                )
            )
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
    # Phiên kết thúc khi đạt số câu đã định HOẶC khi hết hàng câu hỏi thật —
    # hai con số này lệch nhau ở phiên voice đứt giữa chừng (total_questions
    # giữ con số người dùng chọn, còn hàng thật do WebSocket ghi dần).
    if session.current_question_index >= min(session.total_questions, len(questions)):
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
        db.add(
            UsageEvent(
                user_id=current_user.id,
                event_name="interview_answer",
                duration_ms=round((perf_counter() - started_at) * 1000),
                metadata_json={"completed": True},
            )
        )
        await db.commit()

        return InterviewQuestionOut(
            session_id=session.id,
            question_index=curr_idx,
            question_text="Phiên phỏng vấn hoàn tất! Vui lòng nhận báo cáo chi tiết.",
            follow_up_question=None,
            is_last_question=True,
        )

    db.add(
        UsageEvent(
            user_id=current_user.id,
            event_name="interview_answer",
            duration_ms=round((perf_counter() - started_at) * 1000),
            metadata_json={"completed": False},
        )
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


@router.get("", response_model=list[InterviewSessionSummaryOut])
async def list_interview_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InterviewSessionSummaryOut]:
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id)
        .options(selectinload(InterviewSession.report))
        .order_by(InterviewSession.created_at.desc())
    )
    return [
        InterviewSessionSummaryOut(
            id=session.id,
            cv_id=session.cv_id,
            jd_id=session.jd_id,
            cv_snapshot_id=session.cv_snapshot_id,
            jd_snapshot_id=session.jd_snapshot_id,
            match_id=session.match_id,
            language=session.language,
            mode=session.mode,
            status=session.status,
            total_questions=session.total_questions,
            current_question_index=session.current_question_index,
            created_at=session.created_at,
            completed_at=session.completed_at,
            total_score=session.report.total_score if session.report else None,
        )
        for session in result.scalars().all()
    ]


@router.get("/{session_id}/resume", response_model=InterviewQuestionOut)
async def resume_interview_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewQuestionOut:
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.id == session_id, InterviewSession.user_id == current_user.id)
        .options(selectinload(InterviewSession.questions))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phỏng vấn.")
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Phiên đã hoàn thành; hãy mở báo cáo STAR.")
    if session.mode == "voice":
        raise HTTPException(
            status_code=409,
            detail="Phiên phỏng vấn giọng nói phải được tiếp tục qua kênh WebSocket, không dùng luồng hỏi–đáp dạng văn bản.",
        )
    questions = sorted(session.questions, key=lambda item: item.question_index)
    if session.current_question_index >= len(questions):
        raise HTTPException(status_code=409, detail="Phiên không còn câu hỏi để tiếp tục.")
    question = questions[session.current_question_index]
    return InterviewQuestionOut(
        session_id=session.id,
        question_index=question.question_index,
        question_text=question.question_text,
        follow_up_question=question.follow_up_question if not question.follow_up_answer else None,
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
        select(InterviewReport, InterviewSession)
        .join(InterviewSession, InterviewSession.id == InterviewReport.session_id)
        .where(InterviewReport.session_id == session_id)
        .options(
            selectinload(InterviewSession.jd),
            selectinload(InterviewSession.cv),
        )
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Báo cáo phỏng vấn chưa sẵn sàng hoặc phiên phỏng vấn chưa hoàn thành",
        )

    report, session = row
    if session.user_id != current_user.id:
        if current_user.role == "counselor":
            assignment = await db.scalar(
                select(CounselorAssignment).where(
                    CounselorAssignment.counselor_id == current_user.id,
                    CounselorAssignment.student_id == session.user_id,
                    CounselorAssignment.status == "active",
                )
            )
            if not assignment:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền truy cập báo cáo này.")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền truy cập báo cáo này.")

    questions_result = await db.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.question_index)
    )
    qa_history = [
        InterviewQAOut(
            question_index=question.question_index,
            question_text=question.question_text,
            user_answer=question.user_answer,
            follow_up_question=question.follow_up_question,
            follow_up_answer=question.follow_up_answer,
            star_score=question.star_score_json or {},
        )
        for question in questions_result.scalars().all()
    ]

    return InterviewReportOut(
        id=report.id,
        session_id=report.session_id,
        total_score=report.total_score,
        star_scores=report.star_scores_json or {},
        strengths=report.strengths_json or [],
        improvements=report.improvements_json or [],
        recommendations=report.recommendations_json or [],
        created_at=report.created_at,
        qa_history=qa_history,
        jd_title=session.jd.title if session.jd else "",
        cv_title=session.cv.title if session.cv else "",
        mode=session.mode,
        language=session.language,
    )


@router.post(
    "/{session_id}/feedback",
    response_model=InterviewFeedbackOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_interview_feedback(
    session_id: str,
    payload: InterviewFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewFeedbackOut:
    session_result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
            InterviewSession.status == "completed",
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Chỉ có thể đánh giá phiên phỏng vấn đã hoàn thành.")
    existing_result = await db.execute(
        select(InterviewFeedback).where(InterviewFeedback.session_id == session_id)
    )
    feedback = existing_result.scalar_one_or_none()
    if feedback:
        feedback.rating = payload.rating
        feedback.comment = payload.comment
    else:
        feedback = InterviewFeedback(
            session_id=session_id,
            user_id=current_user.id,
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return InterviewFeedbackOut.model_validate(feedback)
