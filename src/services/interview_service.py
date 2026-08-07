import json
import logging
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def generate_interview_questions(
    cv_text: str,
    jd_title: str,
    jd_requirements: str,
    num_questions: int = 5,
) -> List[str]:
    """Sinh bộ 5-7 câu hỏi phỏng vấn thử sát với CV và JD vị trí ứng tuyển."""
    if not settings.openai_api_key:
        return [
            f"Hãy giới thiệu bản thân và lý do bạn ứng tuyển vào vị trí {jd_title}?",
            "Hãy chia sẻ về một dự án thực tế nổi bật nhất mà bạn đã từng triển khai?",
            "Khi gặp khó khăn kỹ thuật hoặc xung đột ý kiến trong team, bạn giải quyết thế nào?",
            f"Bạn đánh giá kỹ năng của mình đáp ứng yêu cầu công việc {jd_title} ra sao?",
            "Bạn có định hướng phát triển nghề nghiệp như thế nào trong 2 năm tới?",
        ][:num_questions]

    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.4,
            api_key=settings.openai_api_key,
        )
        system_prompt = f"""Bạn là Trưởng phòng Tuyển dụng chuyên nghiệp. Dựa vào CV của ứng viên và Mô tả công việc (JD) vị trí '{jd_title}', hãy tạo ra đúng {num_questions} câu hỏi phỏng vấn chuyên sâu.
Các câu hỏi cần bao gồm:
1. Câu hỏi giới thiệu & động lực ứng tuyển.
2. 2-3 câu hỏi tình huống / trải nghiệm kỹ thuật (Behavioral & Technical Questions) xoay quanh các dự án trong CV.
3. Câu hỏi về cách xử lý thách thức / làm việc nhóm.
4. Câu hỏi định hướng phát triển.

Trả về danh sách câu hỏi dạng JSON Array hợp lệ:
["Câu hỏi 1", "Câu hỏi 2", ...]
Chỉ trả về JSON Array thuần túy.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"CV ỨNG VIÊN:\n{cv_text}\n\nJD VỊ TRÍ:\n{jd_requirements}"),
        ]
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        questions = json.loads(content)
        return questions[:num_questions]
    except Exception as e:
        logger.error(f"Lỗi tạo câu hỏi phỏng vấn: {e}")
        return [
            f"Hãy giới thiệu bản thân và lý do bạn ứng tuyển vào vị trí {jd_title}?",
            "Mô tả một dự án tiêu biểu bạn đã từng thực hiện?",
            "Cách bạn giải quyết các sự cố kỹ thuật phức tạp?",
            "Điểm mạnh lớn nhất của bạn phù hợp với JD này là gì?",
            "Mục tiêu nghề nghiệp của bạn trong thời gian tới?",
        ][:num_questions]


async def evaluate_answer_and_check_followup(
    question_text: str,
    user_answer: str,
    cv_text: str,
) -> Dict[str, Any]:
    """Đánh giá câu trả lời của sinh viên. Nếu câu trả lời quá ngắn hoặc thiếu ý, sinh câu hỏi gợi mở follow-up."""
    if not settings.openai_api_key:
        if len(user_answer.strip().split()) < 15:
            return {
                "needs_followup": True,
                "follow_up_question": "Câu trả lời của bạn hơi ngắn. Bạn có thể nói rõ hơn về hành động cụ thể và kết quả bạn đạt được không?",
                "star_score": {"situation": 60, "task": 60, "action": 50, "result": 40},
            }
        return {
            "needs_followup": False,
            "follow_up_question": None,
            "star_score": {"situation": 85, "task": 80, "action": 85, "result": 80},
        }

    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.3,
            api_key=settings.openai_api_key,
        )
        system_prompt = """Bạn là Nhà tuyển dụng đóng vai trong phòng Phỏng Vấn Thử.
Hãy phân tích câu trả lời của ứng viên theo chuẩn STAR (Situation, Task, Action, Result).
Nếu câu trả lời quá mập mờ, thiếu dữ kiện cụ thể (ví dụ chưa nêu rõ hành động cá nhân hoặc chưa có chỉ số kết quả), hãy yêu cầu một câu hỏi gợi mở (Follow-up Question) để ứng viên bổ sung.

Trả về kết quả dưới dạng JSON:
{
  "needs_followup": true/false,
  "follow_up_question": "Nội dung câu hỏi đào sâu (nếu needs_followup=true, ngược lại null)",
  "star_score": {
    "situation": 80.0,
    "task": 75.0,
    "action": 85.0,
    "result": 70.0
  }
}
Chỉ trả về JSON thuần túy.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"CÂU HỎI:\n{question_text}\n\nCÂU TRẢ LỜI CỦA ỨNG VIÊN:\n{user_answer}"),
        ]
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        return json.loads(content)
    except Exception as e:
        logger.error(f"Lỗi đánh giá câu trả lời: {e}")
        return {
            "needs_followup": False,
            "follow_up_question": None,
            "star_score": {"situation": 75.0, "task": 75.0, "action": 75.0, "result": 75.0},
        }


async def generate_final_star_report(
    qa_history: List[Dict[str, Any]],
    jd_title: str,
) -> Dict[str, Any]:
    """Tổng hợp và chấm điểm báo cáo phỏng vấn hoàn chỉnh theo Rubric STAR."""
    if not settings.openai_api_key:
        return {
            "total_score": 82.0,
            "star_scores": {"situation": 85.0, "task": 80.0, "action": 83.0, "result": 80.0},
            "strengths": ["Cấu trúc trả lời mạch lạc", "Thể hiện thái độ tự tin và tích cực"],
            "improvements": ["Cần bổ sung các con số/kết quả định lượng cụ thể hơn trong phần Result"],
            "recommendations": ["Áp dụng công thức STAR (Hành động -> Kết quả) cho mọi câu hỏi tình huống"],
        }

    try:
        llm = ChatOpenAI(
            model=settings.model_name,
            temperature=0.2,
            api_key=settings.openai_api_key,
        )
        system_prompt = f"""Bạn là Hội đồng Chấm điểm Phỏng vấn. Hãy tổng hợp toàn bộ lịch sử hỏi đáp phỏng vấn vị trí '{jd_title}' và đánh giá theo Rubric STAR (Situation, Task, Action, Result) thang điểm 100.

Trả về báo cáo tổng hợp dạng JSON với cấu trúc:
{{
  "total_score": 84.5,
  "star_scores": {{
    "situation": 85.0,
    "task": 82.0,
    "action": 86.0,
    "result": 85.0
  }},
  "strengths": ["Danh sách các điểm mạnh thể hiện qua phỏng vấn"],
  "improvements": ["Danh sách các điểm cần cải thiện"],
  "recommendations": ["Lời khuyên chi tiết cho lần phỏng vấn tiếp theo"]
}}
Chỉ trả về JSON thuần túy.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"LỊCH SỬ HỎI ĐÁP PHỎNG VẤN:\n{json.dumps(qa_history, ensure_ascii=False)}"),
        ]
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        return json.loads(content)
    except Exception as e:
        logger.error(f"Lỗi sinh báo cáo STAR: {e}")
        return {
            "total_score": 80.0,
            "star_scores": {"situation": 80.0, "task": 80.0, "action": 80.0, "result": 80.0},
            "strengths": ["Hoàn thành tốt các câu hỏi phỏng vấn"],
            "improvements": ["Cần luyện tập thêm khả năng phản xạ"],
            "recommendations": ["Tiếp tục phỏng vấn thử nhiều lượt để tăng sự tự tin"],
        }
