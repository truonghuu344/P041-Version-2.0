"""Gemini Vision OCR adapter for image and document uploads."""

from __future__ import annotations

import base64
import logging
from pathlib import Path

from src.config import get_settings

logger = logging.getLogger(__name__)

MIME_TYPES: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


async def extract_text_with_gemini(
    file_bytes: bytes,
    filename: str,
    content_type: str = "",
) -> str:
    """Extract text from image or PDF bytes using Gemini Multimodal/Vision capabilities."""
    settings = get_settings()
    api_key = settings.google_genai_api_key
    if not api_key:
        raise ValueError("OCR_003: Chưa cấu hình Gemini API Key cho OCR fallback.")

    suffix = Path(filename).suffix.casefold()
    resolved_mime = content_type if content_type and "/" in content_type else MIME_TYPES.get(suffix, "image/jpeg")

    # If it's a generic octet-stream, infer from suffix
    if resolved_mime == "application/octet-stream":
        resolved_mime = MIME_TYPES.get(suffix, "image/jpeg")

    b64_data = base64.b64encode(file_bytes).decode("utf-8")

    try:
        from langchain_core.messages import HumanMessage
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            api_key=api_key,
            temperature=0.1,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )

        prompt_text = (
            "Bạn là chuyên gia OCR và số hóa tài liệu tuyển dụng. "
            "Hãy đọc và trích xuất toàn bộ nội dung văn bản từ ảnh/tài liệu này một cách chính xác, "
            "giữ nguyên các tiêu đề, đề mục, danh sách gạch đầu dòng, thông tin liên hệ, yêu cầu, quyền lợi và mức lương. "
            "Chỉ trả về nội dung văn bản đã nhận diện, không thêm lời chào, nhận xét hoặc giải thích."
        )

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt_text},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{resolved_mime};base64,{b64_data}"},
                },
            ]
        )

        response = await llm.ainvoke([message])
        extracted = str(response.content).strip()
        if not extracted:
            raise ValueError("Gemini không trả về nội dung trích xuất.")
        return extracted
    except Exception as exc:
        logger.warning("Gemini Vision OCR extraction failed for %s: %s", filename, exc)
        raise ValueError(f"OCR_003: Gemini OCR không thể xử lý tệp ({type(exc).__name__}).") from exc
