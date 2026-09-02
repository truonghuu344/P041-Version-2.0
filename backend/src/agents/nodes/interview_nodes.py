from __future__ import annotations

import json
import logging
import re
from statistics import mean
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from src.agents.state import InterviewAgentState
from src.agents.tools.career_tools import TECH_SKILLS, clamp_star_scores, extract_known_terms
from src.config import get_settings

logger = logging.getLogger(__name__)


def _json_value(content: Any) -> Any:
    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, list):
        text = "\n".join(
            str(block.get("text", ""))
            for block in content
            if isinstance(block, dict) and block.get("text")
        ).strip()
    else:
        text = str(content or "").strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1)
    return json.loads(text)


async def validate_interview_input(state: InterviewAgentState) -> dict[str, Any]:
    operation = state.get("operation")
    if operation == "start":
        if not (state.get("cv_text") or "").strip():
            return {"error": "CV không có nội dung để tạo câu hỏi phỏng vấn."}
        if not (state.get("jd_title") or "").strip() or not (state.get("jd_requirements") or "").strip():
            return {"error": "JD không có đủ dữ liệu để tạo câu hỏi phỏng vấn."}
        count = int(state.get("num_questions", 5))
        if not 3 <= count <= 10:
            return {"error": "Số câu hỏi phỏng vấn phải từ 3 đến 10."}
    elif operation == "evaluate":
        if not (state.get("question_text") or "").strip():
            return {"error": "Thiếu câu hỏi phỏng vấn cần đánh giá."}
        if len((state.get("user_answer") or "").strip()) < 2:
            return {"error": "Câu trả lời quá ngắn để đánh giá."}
    elif operation == "report":
        if not state.get("qa_history"):
            return {"error": "Chưa có lịch sử hỏi đáp để tạo báo cáo."}
    else:
        return {"error": "Operation của Interview Agent không hợp lệ."}
    return {"error": ""}


def _fallback_questions(state: InterviewAgentState) -> list[str]:
    title = state["jd_title"]
    count = int(state.get("num_questions", 5))
    skills = extract_known_terms(state.get("jd_requirements", ""), TECH_SKILLS)
    skill_label = ", ".join(skills[:3]) or "các yêu cầu kỹ thuật chính"
    pool = [
        f"Hãy giới thiệu ngắn gọn về bản thân và lý do bạn ứng tuyển vị trí {title}?",
        f"Hãy kể về một dự án trong CV chứng minh năng lực liên quan đến {skill_label}.",
        "Mô tả một tình huống kỹ thuật khó: nhiệm vụ của bạn, hành động bạn trực tiếp thực hiện và kết quả.",
        "Khi bất đồng với thành viên trong nhóm, bạn đã xử lý thế nào và rút ra bài học gì?",
        f"Điểm mạnh nào trong CV giúp bạn đáp ứng tốt nhất vị trí {title}, và điểm nào bạn cần cải thiện?",
        "Hãy kể về một lần bạn phải học nhanh công nghệ mới để hoàn thành công việc.",
        "Bạn ưu tiên công việc thế nào khi có nhiều nhiệm vụ cùng thời hạn?",
        "Mục tiêu phát triển nghề nghiệp của bạn trong hai năm tới là gì?",
        "Bạn sẽ làm gì trong 30 ngày đầu tiên nếu được nhận vào vị trí này?",
        "Bạn muốn hỏi nhà tuyển dụng điều gì về vai trò và đội ngũ?",
    ]
    return pool[:count]


async def generate_questions_node(state: InterviewAgentState) -> dict[str, Any]:
    fallback = _fallback_questions(state)
    settings = get_settings()
    if not settings.google_genai_api_key:
        return {"interview_questions": fallback}

    count = int(state.get("num_questions", 5))
    prompt = f"""Bạn là Mock Interview Agent. Tạo đúng {count} câu hỏi cho vị trí {state["jd_title"]}.
Câu hỏi phải bám sát CV/JD, gồm động lực, kỹ thuật/dự án, hành vi và định hướng. Không giả định ứng viên có kinh nghiệm không ghi trong CV.
Trả về duy nhất JSON array các chuỗi."""
    context = f"CV:\n{state['cv_text']}\n\nJD:\n{state['jd_requirements']}"
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            temperature=1.0,
            api_key=settings.google_genai_api_key,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )
        response = await llm.ainvoke([SystemMessage(content=prompt), HumanMessage(content=context)])
        value = _json_value(response.content)
        questions = [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []
        return {"interview_questions": questions[:count] or fallback}
    except Exception as exc:
        logger.warning("Interview Agent dùng bộ câu hỏi fallback do lỗi LLM: %s", exc)
        return {"interview_questions": fallback}


async def guard_questions_node(state: InterviewAgentState) -> dict[str, Any]:
    count = int(state.get("num_questions", 5))
    questions: list[str] = []
    seen: set[str] = set()
    for question in state.get("interview_questions", []):
        normalized = re.sub(r"\s+", " ", str(question)).strip()
        key = normalized.casefold()
        if len(normalized) >= 15 and key not in seen:
            questions.append(normalized)
            seen.add(key)
    for question in _fallback_questions(state):
        if len(questions) >= count:
            break
        if question.casefold() not in seen:
            questions.append(question)
            seen.add(question.casefold())
    return {"interview_questions": questions[:count]}


def _fallback_star_evaluation(answer: str) -> dict[str, Any]:
    lowered = answer.casefold()
    word_count = len(answer.split())
    cue_groups = {
        "situation": ("khi ", "trong dự án", "bối cảnh", "tình huống", "lúc đó"),
        "task": ("nhiệm vụ", "mục tiêu", "trách nhiệm", "được giao", "cần phải"),
        "action": ("tôi đã", "tôi thực hiện", "tôi xây dựng", "tôi đề xuất", "tôi phân tích"),
        "result": ("kết quả", "đạt được", "cải thiện", "giảm ", "tăng ", "%"),
    }
    scores: dict[str, float] = {}
    length_bonus = min(25.0, word_count * 0.6)
    for dimension, cues in cue_groups.items():
        cue_bonus = 35.0 if any(cue in lowered for cue in cues) else 0.0
        scores[dimension] = min(100.0, 30.0 + length_bonus + cue_bonus)
    scores = clamp_star_scores(scores)
    weakest = min(scores, key=scores.get)
    followups = {
        "situation": "Bạn có thể mô tả rõ hơn bối cảnh và vấn đề xảy ra lúc đó không?",
        "task": "Trách nhiệm hoặc mục tiêu cụ thể của riêng bạn trong tình huống đó là gì?",
        "action": "Bạn đã trực tiếp thực hiện những hành động nào để giải quyết vấn đề?",
        "result": "Kết quả cụ thể là gì, và bạn có bằng chứng hoặc chỉ số nào đã có để minh họa không?",
    }
    needs_followup = word_count < 20 or scores[weakest] < 65.0
    return {
        "needs_followup": needs_followup,
        "follow_up_question": followups[weakest] if needs_followup else None,
        "star_score": scores,
        "feedback": f"Thành phần cần làm rõ nhất: {weakest.title()}.",
    }


async def evaluate_answer_node(state: InterviewAgentState) -> dict[str, Any]:
    fallback = _fallback_star_evaluation(state["user_answer"])
    settings = get_settings()
    if not settings.google_genai_api_key:
        return {"answer_evaluation": fallback}
    prompt = """Bạn là STAR Interview Evaluator. Chấm câu trả lời theo Situation, Task, Action, Result từ 0-100.
Chỉ đánh giá thông tin ứng viên thực sự nói. Nếu thiếu một thành phần quan trọng, đặt đúng một câu follow-up trung lập, không gợi ý thành tích giả.
Trả về JSON: {"needs_followup":true,"follow_up_question":"...","star_score":{"situation":0,"task":0,"action":0,"result":0},"feedback":"..."}"""
    content = f"Câu hỏi: {state['question_text']}\nCâu trả lời: {state['user_answer']}\nCV tham chiếu: {state.get('cv_text', '')}"
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            temperature=1.0,
            api_key=settings.google_genai_api_key,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )
        response = await llm.ainvoke([SystemMessage(content=prompt), HumanMessage(content=content)])
        value = _json_value(response.content)
        if not isinstance(value, dict):
            raise ValueError("Expected object")
        value["star_score"] = clamp_star_scores(value.get("star_score", {}))
        value["needs_followup"] = bool(value.get("needs_followup"))
        if not value["needs_followup"]:
            value["follow_up_question"] = None
        return {"answer_evaluation": value}
    except Exception as exc:
        logger.warning("Interview Agent dùng STAR evaluator fallback do lỗi LLM: %s", exc)
        return {"answer_evaluation": fallback}


def _fallback_report(history: list[dict[str, Any]]) -> dict[str, Any]:
    score_sets = [clamp_star_scores(item.get("score") or {}) for item in history]
    averages = {
        key: round(mean(scores[key] for scores in score_sets), 2) for key in ("situation", "task", "action", "result")
    }
    total = round(mean(averages.values()), 2)
    strongest = max(averages, key=averages.get)
    weakest = min(averages, key=averages.get)
    return {
        "total_score": total,
        "star_scores": averages,
        "strengths": [f"Thành phần {strongest.title()} được thể hiện tốt nhất ({averages[strongest]}/100)."],
        "improvements": [f"Cần làm rõ hơn thành phần {weakest.title()} ({averages[weakest]}/100)."],
        "recommendations": ["Trả lời theo thứ tự Bối cảnh → Nhiệm vụ → Hành động cá nhân → Kết quả có bằng chứng."],
    }


async def generate_report_node(state: InterviewAgentState) -> dict[str, Any]:
    fallback = _fallback_report(state["qa_history"])
    settings = get_settings()
    if not settings.google_genai_api_key:
        return {"final_report": fallback}
    prompt = """Bạn là Interview Report Agent. Tổng hợp lịch sử hỏi đáp và điểm đã chấm thành báo cáo STAR.
Không thay đổi điểm thành phần đã có và không bịa nhận xét. Trả về JSON gồm total_score, star_scores, strengths, improvements, recommendations."""
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.model_name,
            temperature=1.0,
            api_key=settings.google_genai_api_key,
            request_timeout=settings.llm_timeout_seconds,
            retries=settings.llm_max_retries,
        )
        response = await llm.ainvoke(
            [
                SystemMessage(content=prompt),
                HumanMessage(content=json.dumps(state["qa_history"], ensure_ascii=False)),
            ]
        )
        value = _json_value(response.content)
        if not isinstance(value, dict):
            raise ValueError("Expected object")
        # Điểm là dữ kiện đã tính, LLM chỉ được diễn giải nhận xét.
        value["star_scores"] = fallback["star_scores"]
        value["total_score"] = fallback["total_score"]
        for key in ("strengths", "improvements", "recommendations"):
            if not isinstance(value.get(key), list):
                value[key] = fallback[key]
        return {"final_report": value}
    except Exception as exc:
        logger.warning("Interview Agent dùng report fallback do lỗi LLM: %s", exc)
        return {"final_report": fallback}
