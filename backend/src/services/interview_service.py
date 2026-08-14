import uuid
from typing import Any

from fastapi import HTTPException

from src.agents.interview_agent import interview_agent


async def generate_interview_questions(
    cv_text: str,
    jd_title: str,
    jd_requirements: str,
    num_questions: int = 5,
) -> list[str]:
    """Compatibility facade: bắt đầu workflow của Mock Interview Agent."""
    return await interview_agent.start(
        cv_text=cv_text,
        jd_title=jd_title,
        jd_requirements=jd_requirements,
        num_questions=num_questions,
    )


async def evaluate_answer_and_check_followup(
    question_text: str,
    user_answer: str,
    cv_text: str,
) -> dict[str, Any]:
    """Compatibility facade: chấm STAR và quyết định follow-up."""
    return await interview_agent.evaluate(
        question_text=question_text,
        user_answer=user_answer,
        cv_text=cv_text,
    )


async def generate_final_star_report(
    qa_history: list[dict[str, Any]],
    jd_title: str,
) -> dict[str, Any]:
    """Compatibility facade: tổng hợp báo cáo của Mock Interview Agent."""
    return await interview_agent.report(qa_history=qa_history, jd_title=jd_title)


async def start_session(cv_id: str, jd_id: str, total_questions: int = 5) -> dict[str, Any]:
    """Bắt đầu một phiên phỏng vấn thử mới."""
    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "cv_id": cv_id,
        "jd_id": jd_id,
        "status": "active",
        "total_questions": total_questions,
        "current_question_index": 0,
        "current_question": (
            "Hãy giới thiệu bản thân và một dự án tiêu biểu mà bạn tự hào nhất."
        ),
    }


async def submit_answer(session_id: str, answer: str, question_index: int = 0) -> dict[str, Any]:
    """Nhận câu trả lời và chuyển câu hỏi hoặc follow-up."""
    raise HTTPException(status_code=404, detail="Session not found")


async def get_report(session_id: str, cv_id: str | None = None) -> dict[str, Any]:
    """Lấy báo cáo STAR cho phiên phỏng vấn đã hoàn thành."""
    raise HTTPException(status_code=404, detail="Session not found or not completed")
