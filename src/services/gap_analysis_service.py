import json
import logging
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def perform_cv_jd_gap_analysis(
    cv_raw_text: str,
    cv_parsed_json: Dict[str, Any],
    jd_title: str,
    jd_requirements: str,
) -> Dict[str, Any]:
    """Phân tích Match Score, khoảng cách kỹ năng (Gap Analysis) và tạo đề xuất tối ưu CV chân thật (Anti-Hallucination)."""
    
    if not settings.openai_api_key:
        # Fallback simulation
        return {
            "match_score": 75.0,
            "hard_skills_matching": ["Python", "FastAPI", "RESTful API"],
            "hard_skills_missing": ["Docker", "PostgreSQL", "LangGraph"],
            "soft_skills_gap": ["Kỹ năng thuyết trình technical", "Quản lý tiến độ dự án"],
            "suggestions": [
                {
                    "original_text": "Đã từng phát triển API bằng Python",
                    "suggested_improvement": "Phát triển và tối ưu hóa các RESTful API hiệu năng cao sử dụng FastAPI và PostgreSQL, đạt thời gian phản hồi dưới 200ms",
                    "action_verb": "Phát triển và tối ưu hóa",
                    "reason": "Sử dụng Động từ hành động (Action Verb) và bổ sung kết quả định lượng cụ thể dựa trên kinh nghiệm sẵn có."
                }
            ],
        }

    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.2,
            api_key=settings.openai_api_key,
        )
        system_prompt = f"""Bạn là Chuyên gia Tuyển dụng và Tối ưu CV hàng đầu. Hãy phân tích độ tương thích giữa CV của sinh viên và Job Description (JD) vị trí '{jd_title}'.

NGUYÊN TẮC QUAN TRỌNG (STRICT ANTI-HALLUCINATION CONSTRAINT):
- Chỉ đưa ra gợi ý chỉnh sửa câu từ và bổ sung từ khóa chuẩn ATS từ KINH NGHIỆM THẬT của sinh viên.
- TUYỆT ĐỐI KHÔNG tự tạo thêm dự án, công ty, bằng cấp hoặc kỹ năng mà sinh viên chưa từng đề cập trong CV.

Hãy trả về phản hồi dạng JSON chuẩn theo định dạng:
{{
  "match_score": 82.5,
  "hard_skills_matching": ["Danh sách kỹ năng cứng có sẵn phù hợp với JD"],
  "hard_skills_missing": ["Danh sách kỹ năng cứng JD yêu cầu nhưng CV thiếu"],
  "soft_skills_gap": ["Danh sách kỹ năng mềm JD nhấn mạnh"],
  "suggestions": [
    {{
      "original_text": "Câu gốc trong CV",
      "suggested_improvement": "Câu đề xuất tối ưu hóa (dùng Action Verb + Kết quả định lượng dựa trên thông tin thật)",
      "action_verb": "Động từ hành động sử dụng",
      "reason": "Lý do tối ưu"
    }}
  ]
}}
Lưu ý: Trả về JSON thuần túy, không kèm markdown format khác.
"""

        user_content = f"""CV NGUYÊN BẢN:
{cv_raw_text}

CẤU TRÚC PARSED:
{json.dumps(cv_parsed_json, ensure_ascii=False)}

YÊU CẦU CÔNG VIỆC (JD):
Vị trí: {jd_title}
Mô tả/Yêu cầu:
{jd_requirements}
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_content),
        ]

        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        result = json.loads(content)
        # Standardize score boundaries
        result["match_score"] = max(0.0, min(100.0, float(result.get("match_score", 70.0))))
        return result
    except Exception as e:
        logger.error(f"Lỗi chạy Gap Analysis LLM: {e}")
        return {
            "match_score": 70.0,
            "hard_skills_matching": [],
            "hard_skills_missing": [],
            "soft_skills_gap": [],
            "suggestions": [],
        }
