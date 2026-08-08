from typing import Any

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
