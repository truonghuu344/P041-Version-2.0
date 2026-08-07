import json
import logging
from typing import Dict, Any
from io import BytesIO
from pypdf import PdfReader
import docx
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Trích xuất chuỗi văn bản từ file PDF."""
    try:
        pdf = PdfReader(BytesIO(file_bytes))
        text = ""
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Lỗi đọc file PDF: {e}")
        raise ValueError(f"Không thể trích xuất văn bản từ file PDF: {str(e)}")


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Trích xuất chuỗi văn bản từ file Word (.docx)."""
    try:
        doc = docx.Document(BytesIO(file_bytes))
        text = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(text).strip()
    except Exception as e:
        logger.error(f"Lỗi đọc file DOCX: {e}")
        raise ValueError(f"Không thể trích xuất văn bản từ file Word (.docx): {str(e)}")


async def parse_cv_to_structured_json(raw_text: str) -> Dict[str, Any]:
    """Phân tích văn bản thô của CV thành cấu trúc JSON chuẩn hóa (Học vấn, Kinh nghiệm, Kỹ năng, Dự án)."""
    if not settings.openai_api_key:
        # Fallback parser cơ bản khi chưa cài OPENAI_API_KEY
        return {
            "summary": raw_text[:200] + "..." if len(raw_text) > 200 else raw_text,
            "education": [{"degree": "Đại học", "field": "Chưa xác định"}],
            "experience": [{"title": "Kinh nghiệm thực tế", "details": raw_text[:300]}],
            "skills": ["Python", "FastAPI", "Kỹ năng làm việc nhóm"],
            "projects": [],
        }

    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.1,
            api_key=settings.openai_api_key,
        )
        system_prompt = """Bạn là chuyên gia phân tích CV hàng đầu. Hãy phân tích văn bản CV được cung cấp và trích xuất thành định dạng JSON hợp lệ với cấu trúc sau:
{
  "summary": "Tóm tắt ngắn gọn mục tiêu nghề nghiệp và thế mạnh",
  "education": [{"school": "Tên trường", "degree": "Bằng cấp/Chuyên ngành", "year": "Thời gian"}],
  "experience": [{"company": "Tên công ty", "role": "Vị trí", "duration": "Thời gian", "description": "Mô tả công việc"}],
  "skills": ["Danh sách kỹ năng cứng, kỹ năng mềm, công cụ"],
  "projects": [{"name": "Tên dự án", "description": "Chi tiết dự án & vai trò", "tech_stack": ["Công nghệ sử dụng"]}]
}
Lưu ý: Chỉ trả về JSON thuần túy, không kèm theo Markdown formatting bổ sung.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Nội dung CV:\n{raw_text}"),
        ]
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()
        
        return json.loads(content)
    except Exception as e:
        logger.warning(f"Lỗi parse CV bằng LLM, sử dụng fallback parser: {e}")
        return {
            "summary": raw_text[:200],
            "education": [],
            "experience": [],
            "skills": [],
            "projects": [],
        }
