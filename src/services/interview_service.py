"""
Interview Service.

Xử lý luồng phỏng vấn thử: tạo phiên, nộp câu trả lời và xuất báo cáo STAR.
"""

import uuid
from typing import Any

from fastapi import HTTPException


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
    # Mặc định: trả 404 cho session_id không hợp lệ / không tồn tại
    raise HTTPException(status_code=404, detail="Session not found")


async def get_report(session_id: str, cv_id: str | None = None) -> dict[str, Any]:
    """Lấy báo cáo STAR cho phiên phỏng vấn đã hoàn thành."""
    # Mặc định: trả 404/409 cho session chưa completed hoặc không tồn tại
    raise HTTPException(status_code=404, detail="Session not found or not completed")
