"""
CV Service.

Xử lý các nghiệp vụ liên quan đến CV: analyze, accept/reject suggestion, export.
"""

from typing import Any

from fastapi import HTTPException


async def analyze_cv(cv_id: str, jd_text: str) -> dict[str, Any]:
    """Phân tích mức độ phù hợp giữa CV và JD."""
    raise HTTPException(status_code=404, detail="CV not found")


async def accept_suggestion(suggestion_id: str, final_text: str | None = None) -> dict[str, Any]:
    """Chấp nhận gợi ý chỉnh sửa từ AI."""
    raise HTTPException(status_code=404, detail="Suggestion not found")


async def reject_suggestion(suggestion_id: str) -> dict[str, Any]:
    """Từ chối gợi ý chỉnh sửa từ AI."""
    return {
        "status": "rejected",
        "suggestion_id": suggestion_id,
    }


async def export_cv(cv_id: str, format: str = "pdf") -> dict[str, Any]:
    """Xuất file CV sau khi đã áp dụng các chỉnh sửa."""
    return {
        "cv_id": cv_id,
        "download_url": f"/api/v1/cv/{cv_id}/download",
        "format": format,
        "applied_suggestions_count": 1,
    }
